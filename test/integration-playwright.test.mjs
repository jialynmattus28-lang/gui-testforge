import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { approveCase, confirmRequirements, createWorkspace, freezeAsset, setCases } from '../packages/workflow/index.mjs';
import {
  checkPlaywrightProject,
  compilePlaywrightProject,
  loadPlaywrightIntegrationConfig,
} from '../packages/integration-playwright/index.mjs';

const execFileAsync = promisify(execFile);
let root;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-integration-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

function frozenAsset() {
  const testCase = {
    id: 'SEARCH-001',
    title: 'Search returns matching records',
    requirementRefs: ['REQ-SEARCH'],
    fixture: { query: 'alpha' },
    steps: [{
      action: { name: 'search.submit', args: { query: 'alpha' } },
      assertions: [{ target: 'search.resultCount', equals: 1 }],
    }],
    expectedBusinessOutcome: 'COMPLETED',
  };
  let state = createWorkspace({ prdHash: 'prd', requirements: [{ id: 'REQ-SEARCH' }] });
  state = setCases(confirmRequirements(state), [testCase]);
  state = approveCase(state, testCase.id);
  return freezeAsset(state, { frozenAt: '2026-09-20T00:00:00.000Z' }).frozenAsset;
}

async function createHost(name, { withFixture = true, withDriver = false } = {}) {
  const host = path.join(root, name);
  await mkdir(path.join(host, 'testforge', 'frozen'), { recursive: true });
  await mkdir(path.join(host, 'fixtures'), { recursive: true });
  await writeFile(path.join(host, 'testforge', 'frozen', 'search.json'), `${JSON.stringify(frozenAsset(), null, 2)}\n`, 'utf8');
  if (withFixture) {
    await writeFile(path.join(host, 'fixtures', 'test.mjs'), "export const test = () => {}; export const expect = () => {};\n", 'utf8');
  }
  if (withDriver) {
    await writeFile(path.join(host, 'testforge', 'gui-driver.mjs'), 'export async function createDriver() {}\n', 'utf8');
  }
  const configPath = path.join(host, 'testforge.config.mjs');
  await writeFile(configPath, `export default {
  frozenAsset: './testforge/frozen/search.json',
  outputDir: './tests/generated/testforge',
  testModule: './fixtures/test.mjs',
  driverModule: './testforge/gui-driver.mjs',
  fileExtension: '.spec.mjs',
  fixtureNames: ['page', 'accountSession'],
};
`, 'utf8');
  return { host, configPath };
}

test('config paths resolve from the config file and compile without a URL or Driver', async () => {
  const { host, configPath } = await createHost('compile');
  const config = await loadPlaywrightIntegrationConfig(configPath);
  assert.equal(config.frozenAssetPath, path.join(host, 'testforge', 'frozen', 'search.json'));
  assert.equal(config.outputDirectory, path.join(host, 'tests', 'generated', 'testforge'));
  assert.equal(config.compilerOptions.testModule, '../../../fixtures/test.mjs');
  assert.equal(config.compilerOptions.driverModule, '../../../testforge/gui-driver.mjs');

  const result = await compilePlaywrightProject({ configPath });
  const source = await readFile(path.join(config.outputDirectory, result.manifest.entryFile), 'utf8');
  assert.match(source, /accountSession/);
  assert.equal(result.executionStatus, 'NOT_EVALUATED');
  assert.equal(result.driverStatus, 'NOT_IMPLEMENTED');
});

test('check accepts a real host fixture, reports Driver readiness, and rejects tampered output', async () => {
  const { configPath } = await createHost('check', { withDriver: true });
  const compiled = await compilePlaywrightProject({ configPath });
  const ready = await checkPlaywrightProject({ configPath });
  assert.equal(ready.integrity, 'VERIFIED');
  assert.equal(ready.driverStatus, 'READY');
  assert.equal(ready.readyForDiscovery, true);
  assert.equal(ready.readyForExecution, true);

  await writeFile(compiled.entryPath, '// tampered\n', 'utf8');
  await assert.rejects(() => checkPlaywrightProject({ configPath }), /Generated file hash mismatch/);
});

test('check rejects missing frozen assets and unresolved host fixture modules', async () => {
  const missingAsset = await createHost('missing-asset');
  await rm(path.join(missingAsset.host, 'testforge', 'frozen', 'search.json'));
  await assert.rejects(() => compilePlaywrightProject({ configPath: missingAsset.configPath }), /Frozen asset not found/);

  const missingFixture = await createHost('missing-fixture', { withFixture: false });
  await compilePlaywrightProject({ configPath: missingFixture.configPath });
  await assert.rejects(() => checkPlaywrightProject({ configPath: missingFixture.configPath }), /Test module not found/);
});

test('CLI compiles and checks a host project deterministically', async () => {
  const { configPath } = await createHost('cli');
  const cliPath = path.resolve('scripts/testforge.mjs');
  const compiled = await execFileAsync(process.execPath, [cliPath, 'compile', '--config', configPath]);
  const checked = await execFileAsync(process.execPath, [cliPath, 'check', '--config', configPath]);
  assert.equal(JSON.parse(compiled.stdout).framework, 'playwright-test');
  assert.equal(JSON.parse(checked.stdout).readyForDiscovery, true);
});
