import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { startDemoApp } from '../examples/card-loss/demo-app/server.mjs';
import { checkPlaywrightProject, compilePlaywrightProject } from '../packages/integration-playwright/index.mjs';
import { sha256 } from '../packages/ir/index.mjs';

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve('examples/existing-playwright');
const configPath = path.join(projectDirectory, 'testforge.config.mjs');
const playwrightConfig = path.join(projectDirectory, 'playwright.config.mjs');
const generatedDirectory = path.join(projectDirectory, 'tests', 'generated', 'testforge');
const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js');
let app;

before(async () => {
  await rm(generatedDirectory, { recursive: true, force: true });
  await rm(path.join(projectDirectory, '.playwright-report'), { recursive: true, force: true });
  await rm(path.join(projectDirectory, '.playwright-results.json'), { force: true });
  await rm(path.join(projectDirectory, 'test-results'), { recursive: true, force: true });
});

after(async () => {
  if (app) await app.close();
  await rm(generatedDirectory, { recursive: true, force: true });
  await rm(path.join(projectDirectory, '.playwright-report'), { recursive: true, force: true });
  await rm(path.join(projectDirectory, '.playwright-results.json'), { force: true });
  await rm(path.join(projectDirectory, 'test-results'), { recursive: true, force: true });
});

test('generated tests join an existing Playwright project before and after the GUI exists', async () => {
  const compiled = await compilePlaywrightProject({ configPath });
  const sourceBeforeGui = await readFile(compiled.entryPath, 'utf8');
  const hashBeforeGui = sha256(sourceBeforeGui);

  const discovered = await execFileAsync(process.execPath, [
    playwrightCli,
    'test',
    '--config',
    playwrightConfig,
    '--list',
  ], { cwd: projectDirectory, env: { ...process.env, GUI_TESTFORGE_BASE_URL: '' } });
  assert.match(discovered.stdout, /existing host API health check/);
  assert.match(discovered.stdout, /CL-LOSS-001/);
  assert.match(discovered.stdout, /Total: 8 tests in 2 files/);

  app = await startDemoApp({ port: 0 });
  const executed = await execFileAsync(process.execPath, [
    playwrightCli,
    'test',
    '--config',
    playwrightConfig,
  ], {
    cwd: projectDirectory,
    env: { ...process.env, GUI_TESTFORGE_BASE_URL: app.url },
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.match(executed.stdout, /8 passed/);

  const checked = await checkPlaywrightProject({ configPath });
  const sourceAfterGui = await readFile(compiled.entryPath, 'utf8');
  assert.equal(checked.readyForExecution, true);
  assert.equal(sha256(sourceAfterGui), hashBeforeGui);
});
