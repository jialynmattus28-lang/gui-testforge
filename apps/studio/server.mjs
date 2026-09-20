import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, copyFile, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createReplayProvider } from '../../packages/ai-replay/index.mjs';
import { createOpenAICompatibleProvider } from '../../packages/ai-openai-compatible/index.mjs';
import { sha256 } from '../../packages/ir/index.mjs';
import {
  allCasesReviewed,
  approveAllCases,
  approveCase,
  confirmRequirements,
  createWorkspace,
  editCase,
  freezeAsset,
  rejectCase,
  setCases,
} from '../../packages/workflow/index.mjs';
import { checkPlaywrightProject, compilePlaywrightProject } from '../../packages/integration-playwright/index.mjs';
import { loadAiConfiguration } from '../../scripts/configure-ai.mjs';
import { validateDriverModule } from '../../packages/driver-contract/index.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

const AI_ENVIRONMENT_KEY = /(^|_)(OPENAI|ANTHROPIC|GEMINI|GOOGLE_GENERATIVE_AI|MISTRAL|COHERE|GROQ|DEEPSEEK|XAI|GUI_TESTFORGE_AI|AI_API|MODEL_API)(_|$)/i;
const UNIMPLEMENTED_DRIVER_SOURCE = `export async function createDriver() {
  return {
    async act(action) { throw new Error(\`DRIVER_NOT_IMPLEMENTED: \${action?.name ?? 'act'}\`); },
    async observe(query) { throw new Error(\`DRIVER_NOT_IMPLEMENTED: \${query?.target ?? 'observe'}\`); },
    async close() {},
  };
}
`;

export function withoutAiCredentials(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key, value]) => value !== undefined && !AI_ENVIRONMENT_KEY.test(key)),
  );
}

const requirements = [
  { id: 'REQ-1', title: 'Identity read', text: 'A successful synthetic identity read is required before continuing.' },
  { id: 'REQ-2', title: 'Face verification', text: 'Successful synthetic face verification is required before cards are shown.' },
  { id: 'REQ-3', title: 'Eligible card selection', text: 'Only cards in normal status are selectable; other cards remain visible and disabled.' },
  { id: 'REQ-4', title: 'Complete card loss', text: 'The correct password changes the selected card status to lost.' },
  { id: 'REQ-5', title: 'Incorrect password', text: 'An incorrect password is rejected and does not change card status.' },
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, content, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  response.end(content);
}

function runProcess(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function emptyExecutionSetup() {
  return {
    ready: false,
    mode: null,
    targetUrl: null,
    driverFileName: null,
    driverStatus: 'MISSING',
  };
}

function validateTargetUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, 'Target application URL must be a valid HTTP or HTTPS URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'Target application URL must use HTTP or HTTPS');
  }
  return parsed.toString();
}

async function prepareHostProject({ repoRoot, workspaceDirectory }) {
  const source = path.join(repoRoot, 'examples', 'existing-playwright');
  const hostDirectory = path.join(workspaceDirectory, 'existing-playwright-host');
  const copies = [
    ['playwright.config.mjs', 'playwright.config.mjs'],
    ['testforge.config.mjs', 'testforge.config.mjs'],
    ['fixtures/test.mjs', 'fixtures/test.mjs'],
    ['tests/existing-api.spec.mjs', 'tests/existing-api.spec.mjs'],
    ['testforge/progress-reporter.mjs', 'testforge/progress-reporter.mjs'],
  ];
  for (const [from, to] of copies) {
    const destination = path.join(hostDirectory, to);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(source, from), destination);
  }
  const hostDriverPath = path.join(hostDirectory, 'testforge', 'gui-driver.mjs');
  try {
    await access(hostDriverPath);
  } catch {
    await writeFile(hostDriverPath, UNIMPLEMENTED_DRIVER_SOURCE, 'utf8');
  }
  await mkdir(path.join(hostDirectory, 'testforge', 'frozen'), { recursive: true });
  const hostNodeModules = path.join(hostDirectory, 'node_modules');
  try {
    await access(hostNodeModules);
  } catch {
    await symlink(path.join(repoRoot, 'node_modules'), hostNodeModules, process.platform === 'win32' ? 'junction' : 'dir');
  }
  return {
    directory: hostDirectory,
    configPath: path.join(hostDirectory, 'testforge.config.mjs'),
    playwrightConfigPath: path.join(hostDirectory, 'playwright.config.mjs'),
    frozenAssetPath: path.join(hostDirectory, 'testforge', 'frozen', 'card-loss.json'),
    driverPath: hostDriverPath,
  };
}

function parseDiscovery(output, generatedCount) {
  const match = output.match(/Total:\s+(\d+)\s+tests?\s+in\s+(\d+)\s+files?/i);
  if (!match) throw new Error(`Playwright discovery did not report a test total.\n${output.trim()}`);
  const total = Number(match[1]);
  return {
    status: 'DISCOVERED',
    total,
    generated: generatedCount,
    existing: Math.max(0, total - generatedCount),
    files: Number(match[2]),
  };
}

function collectSpecs(suites, collected = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) collected.push(spec);
    collectSpecs(suite.suites, collected);
  }
  return collected;
}

export function normalizePlaywrightReport(report, exitCode) {
  const generatedSpecs = collectSpecs(report.suites).filter((spec) => (
    /(^|\/)generated\/testforge\//.test(String(spec.file ?? '').split(path.sep).join('/'))
  ));
  const cases = generatedSpecs.map((spec) => {
    const attempts = spec.tests?.flatMap((item) => item.results ?? []) ?? [];
    const last = attempts.at(-1) ?? {};
    const passed = last.status === 'passed';
    const skipped = last.status === 'skipped';
    const error = last.error?.message ?? last.errors?.map((item) => item.message).filter(Boolean).join('\n') ?? null;
    return {
      caseId: spec.title.split(' · ')[0],
      title: spec.title.includes(' · ') ? spec.title.split(' · ').slice(1).join(' · ') : spec.title,
      testVerdict: passed ? 'PASS' : skipped ? 'NOT_EVALUATED' : 'FAIL',
      executionStatus: skipped ? 'NOT_EVALUATED' : 'COMPLETED',
      evidence: [],
      error,
    };
  });
  const passed = cases.filter((item) => item.testVerdict === 'PASS').length;
  const failed = cases.filter((item) => item.testVerdict === 'FAIL').length;
  const notEvaluated = cases.filter((item) => item.testVerdict === 'NOT_EVALUATED').length;
  return {
    testVerdict: exitCode === 0 && failed === 0 && notEvaluated === 0 ? 'PASS' : failed > 0 || exitCode !== 0 ? 'FAIL' : 'NOT_EVALUATED',
    executionStatus: 'COMPLETED',
    cases,
    summary: { total: cases.length, passed, failed, notEvaluated },
    hostSummary: report.stats ?? null,
  };
}

function publicState(state, liveConfigured, bundledDemoAvailable = false) {
  const copy = structuredClone(state);
  if (copy.compilation) {
    delete copy.compilation.directory;
    delete copy.compilation.configPath;
  }
  if (copy.run) {
    delete copy.run.reportDirectory;
    delete copy.run.resultPath;
    delete copy.run.progressPath;
  }
  return {
    ...copy,
    reviewComplete: allCasesReviewed(state),
    bundledDemoAvailable,
    provider: {
      selectedMode: state.proposalMode ?? 'offline',
      offline: { configured: true, networkRequired: false },
      live: { configured: liveConfigured },
    },
    artifactLinks: {
      prd: '/artifacts/prd.md',
      driver: '/artifacts/guidriver.mjs',
      frozen: state.frozenAsset ? '/artifacts/frozen-asset.json' : null,
      generated: state.compilation ? '/artifacts/generated.spec.mjs' : null,
      report: state.run?.result ? '/playwright-report/index.html' : null,
    },
  };
}

export async function startStudio({
  host = '127.0.0.1',
  port = 0,
  workspaceDirectory,
  demoAppUrl,
  beforeRun = async () => {},
  repoRoot = repositoryRoot,
  driverPath = path.join(repoRoot, 'examples/existing-playwright/testforge/gui-driver.mjs'),
} = {}) {
  if (!workspaceDirectory) throw new Error('Studio requires a workspaceDirectory');
  await mkdir(workspaceDirectory, { recursive: true });
  const hostProject = await prepareHostProject({ repoRoot, workspaceDirectory });
  const playwrightCli = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js');

  const prdPath = path.join(repoRoot, 'examples/card-loss/prd.md');
  const replayPath = path.join(repoRoot, 'examples/card-loss/replay-response.json');
  const statePath = path.join(workspaceDirectory, 'state.json');
  const prd = await readFile(prdPath, 'utf8');
  let state;
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    state = {
      ...createWorkspace({ prdHash: sha256(prd), requirements }),
      prd: { title: 'Card Loss Demo PRD', content: prd },
      proposalSource: null,
      proposalMode: 'offline',
      compilation: null,
      run: null,
      executionSetup: emptyExecutionSetup(),
    };
  }
  state.executionSetup = { ...emptyExecutionSetup(), ...(state.executionSetup ?? {}) };

  const replayProvider = createReplayProvider({ recordingPath: replayPath });
  const liveConfiguration = await loadAiConfiguration(repoRoot);
  const liveConfigured = liveConfiguration.status.configured;
  const liveProvider = liveConfigured ? createOpenAICompatibleProvider(liveConfiguration) : null;
  const bundledDemoAvailable = Boolean(demoAppUrl && driverPath);
  let activeRun = null;

  async function installDriver({ driverSource, driverFileName }) {
    if (typeof driverFileName !== 'string' || path.extname(driverFileName).toLowerCase() !== '.mjs') {
      throw new HttpError(400, 'GUI Driver filename must end with .mjs');
    }
    if (typeof driverSource !== 'string' || driverSource.trim() === '') {
      throw new HttpError(400, 'GUI Driver source is required');
    }
    const candidatePath = `${hostProject.driverPath}.candidate-${Date.now()}.mjs`;
    try {
      await writeFile(candidatePath, driverSource, 'utf8');
      await validateDriverModule(candidatePath);
      await copyFile(candidatePath, hostProject.driverPath);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, `GUI Driver validation failed: ${error.message}`);
    } finally {
      await rm(candidatePath, { force: true });
    }
    return path.basename(driverFileName);
  }

  async function save() {
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
  await save();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);
      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { ok: true, service: 'gui-testforge-studio' });
      }
      if (request.method === 'GET' && url.pathname === '/api/status') {
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }
      if (request.method === 'POST' && url.pathname === '/api/requirements/confirm') {
        state = confirmRequirements(state);
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }
      if (request.method === 'POST' && url.pathname === '/api/generate') {
        if (!state.requirementsConfirmed) throw new HttpError(409, 'Confirm requirements before generating Test IR');
        const body = await readJson(request);
        const mode = body.mode ?? 'offline';
        if (mode === 'live' && !liveProvider) throw new HttpError(409, 'Live AI is not configured');
        const provider = mode === 'live' ? liveProvider : replayProvider;
        const proposal = await provider.generateTestIR({ prd, requirements, strategy: body.strategy ?? '' });
        state = setCases(state, proposal.cases);
        state.proposalSource = proposal.source ?? mode;
        state.proposalMode = mode;
        state.compilation = null;
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      if (request.method === 'POST' && url.pathname === '/api/cases/approve-all') {
        state = approveAllCases(state);
        state.compilation = null;
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      const caseMatch = url.pathname.match(/^\/api\/cases\/([^/]+)\/(approve|reject|edit|refine)$/);
      if (request.method === 'POST' && caseMatch) {
        const id = decodeURIComponent(caseMatch[1]);
        const operation = caseMatch[2];
        const body = await readJson(request);
        if (operation === 'approve') state = approveCase(state, id);
        if (operation === 'reject') state = rejectCase(state, id, body.reason);
        if (operation === 'edit') state = editCase(state, id, body.testCase);
        if (operation === 'refine') {
          if (!liveProvider) throw new HttpError(409, 'Configure Live AI before using per-case refinement');
          const current = state.cases.find((testCase) => testCase.id === id);
          const refined = await liveProvider.refineTestIR({ testCase: current, instruction: body.instruction });
          state = editCase(state, id, refined.testCase);
        }
        state.compilation = null;
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      if (request.method === 'POST' && url.pathname === '/api/freeze') {
        if (!allCasesReviewed(state)) throw new HttpError(409, 'Human review must review every Test IR case before freezing');
        state = freezeAsset(state);
        const assetDirectory = path.join(workspaceDirectory, 'assets');
        await mkdir(assetDirectory, { recursive: true });
        await writeFile(path.join(assetDirectory, 'frozen-asset.json'), `${JSON.stringify(state.frozenAsset, null, 2)}\n`, 'utf8');
        await writeFile(hostProject.frozenAssetPath, `${JSON.stringify(state.frozenAsset, null, 2)}\n`, 'utf8');
        state.compilation = null;
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      if (request.method === 'POST' && url.pathname === '/api/compile') {
        const body = await readJson(request);
        if (body.framework !== 'playwright') throw new HttpError(409, 'Only Playwright is implemented in Phase 1');
        if (!state.frozenAsset) throw new HttpError(409, 'Freeze the approved Test IR asset before compilation');
        await writeFile(hostProject.frozenAssetPath, `${JSON.stringify(state.frozenAsset, null, 2)}\n`, 'utf8');
        const outputDirectory = path.join(hostProject.directory, 'tests', 'generated', 'testforge');
        await rm(outputDirectory, { recursive: true, force: true });
        const compiled = await compilePlaywrightProject({ configPath: hostProject.configPath });
        const checked = await checkPlaywrightProject({ configPath: hostProject.configPath });
        const discoveryProcess = await runProcess(process.execPath, [
          playwrightCli,
          'test',
          '--config',
          hostProject.playwrightConfigPath,
          '--list',
        ], {
          cwd: hostProject.directory,
          env: { ...withoutAiCredentials(), GUI_TESTFORGE_BASE_URL: '' },
        });
        if (discoveryProcess.code !== 0) {
          throw new Error(`Native Playwright discovery failed.\n${discoveryProcess.stderr || discoveryProcess.stdout}`);
        }
        const discovery = parseDiscovery(discoveryProcess.stdout, compiled.manifest.cases.length);
        state.compilation = {
          framework: 'playwright',
          manifest: compiled.manifest,
          directory: outputDirectory,
          configPath: hostProject.configPath,
          sourceHash: checked.sourceHash,
          executionStatus: 'NOT_EVALUATED',
          discovery,
          hostProject: {
            runner: 'Playwright Test',
            existingTests: discovery.existing,
            generatedTests: discovery.generated,
            configPreserved: true,
          },
        };
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      if (request.method === 'POST' && url.pathname === '/api/execution/setup') {
        if (!state.compilation) throw new HttpError(409, 'Compile the Playwright scripts before configuring execution');
        if (activeRun) throw new HttpError(409, 'Execution setup cannot change while a test run is active');
        const body = await readJson(request);
        const targetUrl = validateTargetUrl(body.targetUrl);
        const driverFileName = await installDriver(body);
        state.executionSetup = {
          ready: true,
          mode: 'external',
          targetUrl,
          driverFileName,
          driverStatus: 'READY',
        };
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      if (request.method === 'POST' && url.pathname === '/api/execution/use-bundled-demo') {
        if (!state.compilation) throw new HttpError(409, 'Compile the Playwright scripts before configuring execution');
        if (activeRun) throw new HttpError(409, 'Execution setup cannot change while a test run is active');
        if (!bundledDemoAvailable) throw new HttpError(409, 'Bundled demo execution is not available');
        const targetUrl = validateTargetUrl(demoAppUrl);
        const driverFileName = await installDriver({
          driverSource: await readFile(driverPath, 'utf8'),
          driverFileName: path.basename(driverPath),
        });
        state.executionSetup = {
          ready: true,
          mode: 'bundled',
          targetUrl,
          driverFileName,
          driverStatus: 'READY',
        };
        state.run = null;
        await save();
        return sendJson(response, 200, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      if (request.method === 'POST' && url.pathname === '/api/run') {
        if (!state.compilation) throw new HttpError(409, 'Compile a test bundle before execution');
        if (activeRun) throw new HttpError(409, 'A test run is already active');
        if (!state.executionSetup?.ready) {
          throw new HttpError(409, 'A target application URL and GUI Driver are required for execution');
        }
        if (state.executionSetup.mode === 'bundled') await beforeRun();
        const artifactDirectory = path.join(workspaceDirectory, 'runs', `run-${Date.now()}`);
        const resultPath = path.join(artifactDirectory, 'playwright-results.json');
        const progressPath = path.join(artifactDirectory, 'progress.jsonl');
        const reportDirectory = path.join(artifactDirectory, 'playwright-report');
        await mkdir(artifactDirectory, { recursive: true });
        state.run = {
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
          progress: { current: 0, total: state.compilation.discovery.total, phase: 'starting native Playwright' },
          result: null,
          resultPath,
          progressPath,
          reportDirectory,
        };
        await save();
        activeRun = (async () => {
          let progressTimer;
          try {
            progressTimer = setInterval(async () => {
              try {
                const lines = (await readFile(progressPath, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
                const begin = lines.find((event) => event.type === 'begin');
                const latest = lines.filter((event) => event.type === 'testEnd').at(-1);
                if (begin || latest) {
                  state.run.progress = {
                    current: latest?.current ?? 0,
                    total: begin?.total ?? state.compilation.discovery.total,
                    phase: latest ? latest.status : 'discovering tests',
                    caseId: latest?.caseId,
                  };
                  await save();
                }
              } catch {
                // The native reporter has not created its first event yet.
              }
            }, 200);
            const executed = await runProcess(process.execPath, [
              playwrightCli,
              'test',
              '--config',
              hostProject.playwrightConfigPath,
            ], {
              cwd: hostProject.directory,
              env: {
                ...withoutAiCredentials(),
                GUI_TESTFORGE_BASE_URL: state.executionSetup.targetUrl,
                GUI_TESTFORGE_JSON_REPORT: resultPath,
                GUI_TESTFORGE_PROGRESS_REPORT: progressPath,
                GUI_TESTFORGE_HTML_REPORT: reportDirectory,
              },
            });
            const report = JSON.parse(await readFile(resultPath, 'utf8'));
            const result = normalizePlaywrightReport(report, executed.code);
            state.run = {
              ...state.run,
              status: 'COMPLETED',
              completedAt: new Date().toISOString(),
              progress: { current: state.compilation.discovery.total, total: state.compilation.discovery.total, phase: 'complete' },
              result,
              output: executed.code === 0 ? null : (executed.stderr || executed.stdout).trim(),
            };
          } catch (error) {
            state.run = { ...state.run, status: 'ERROR', completedAt: new Date().toISOString(), error: error.message };
          } finally {
            clearInterval(progressTimer);
            activeRun = null;
            await save();
          }
        })();
        return sendJson(response, 202, publicState(state, liveConfigured, bundledDemoAvailable));
      }

      const artifactFiles = new Map([
        ['/artifacts/prd.md', [prdPath, 'text/markdown; charset=utf-8']],
        ['/artifacts/guidriver.mjs', [hostProject.driverPath, 'text/javascript; charset=utf-8']],
        ['/artifacts/frozen-asset.json', [path.join(workspaceDirectory, 'assets', 'frozen-asset.json'), 'application/json; charset=utf-8']],
        ['/artifacts/generated.spec.mjs', [state.compilation ? path.join(state.compilation.directory, state.compilation.manifest.entryFile) : '', 'text/javascript; charset=utf-8']],
      ]);
      if (request.method === 'GET' && artifactFiles.has(url.pathname)) {
        const [filePath, contentType] = artifactFiles.get(url.pathname);
        return sendText(response, 200, await readFile(filePath), contentType);
      }
      if (request.method === 'GET' && url.pathname.startsWith('/playwright-report/') && state.run?.reportDirectory) {
        const requested = url.pathname.slice('/playwright-report/'.length) || 'index.html';
        const reportRoot = path.resolve(state.run.reportDirectory);
        const reportFile = path.resolve(reportRoot, requested);
        if (reportFile !== reportRoot && !reportFile.startsWith(`${reportRoot}${path.sep}`)) {
          throw new HttpError(400, 'Invalid report path');
        }
        const extension = path.extname(reportFile);
        const contentType = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.zip': 'application/zip',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        }[extension] ?? 'application/octet-stream';
        return sendText(response, 200, await readFile(reportFile), contentType);
      }
      if (request.method === 'GET' && publicFiles.has(url.pathname)) {
        const [fileName, contentType] = publicFiles.get(url.pathname);
        return sendText(response, 200, await readFile(new URL(`./public/${fileName}`, import.meta.url)), contentType);
      }
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(response, error.status ?? 500, { error: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const url = `http://${host}:${address.port}`;
  return {
    url,
    server,
    close: async () => {
      if (activeRun) await activeRun;
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const studio = await startStudio({
    port: Number(process.env.PORT ?? 4317),
    workspaceDirectory: process.env.GUI_TESTFORGE_WORKSPACE ?? path.join(repositoryRoot, '.gui-testforge', 'demo'),
    demoAppUrl: process.env.GUI_TESTFORGE_DEMO_URL ?? 'http://127.0.0.1:4318',
  });
  console.log(`GUI TestForge: ${studio.url}`);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await studio.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
