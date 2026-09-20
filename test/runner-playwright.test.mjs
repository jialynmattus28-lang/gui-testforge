import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { startDemoApp } from '../examples/card-loss/demo-app/server.mjs';
import { approveCase, confirmRequirements, createWorkspace, freezeAsset, setCases } from '../packages/workflow/index.mjs';
import { compileFrozenAsset } from '../packages/compiler-playwright/index.mjs';
import { executeCompiledBundle } from '../packages/runner-playwright/index.mjs';

let root;
let app;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-runner-'));
  app = await startDemoApp({ port: 0 });
});

after(async () => {
  if (app) await app.close();
  if (root) await rm(root, { recursive: true, force: true });
});

async function buildBundle(cases, name) {
  let state = createWorkspace({ prdHash: 'prd', requirements: [{ id: 'REQ-1' }] });
  state = setCases(confirmRequirements(state), cases);
  for (const testCase of cases) state = approveCase(state, testCase.id);
  state = freezeAsset(state, { frozenAt: '2026-09-19T00:00:00.000Z' });
  const bundleDirectory = path.join(root, name);
  const manifest = await compileFrozenAsset(state.frozenAsset, bundleDirectory);
  return { bundleDirectory, manifest, frozenAsset: state.frozenAsset };
}

function oneCase(expectedScreen = 'face') {
  return [{
    id: `CL-${expectedScreen}`,
    title: 'Identity read',
    requirementRefs: ['REQ-1'],
    fixture: { identityOutcome: 'success' },
    steps: [{
      action: { name: 'readIdentity', args: {} },
      assertions: [{ target: 'screen', equals: expectedScreen }],
    }],
    expectedBusinessOutcome: 'IN_PROGRESS',
  }];
}

test('runner records PASS evidence and excludes AI credentials from its child process', async () => {
  const compiled = await buildBundle(oneCase(), 'pass');
  const progress = [];
  const result = await executeCompiledBundle({
    ...compiled,
    driverPath: path.resolve('examples/card-loss/playwright-driver/guidriver.mjs'),
    baseUrl: app.url,
    artifactDirectory: path.join(root, 'pass-artifacts'),
    environment: { ...process.env, GUI_TESTFORGE_AI_API_KEY: 'must-not-cross-boundary' },
    onProgress: (event) => progress.push(event),
  });

  assert.equal(result.testVerdict, 'PASS');
  assert.equal(result.executionStatus, 'COMPLETED');
  assert.equal(result.cases[0].evidence[0].actual, 'face');
  assert.ok(progress.length > 0);
  assert.equal(
    result.environmentKeys.some((key) => /AI|OPENAI|ANTHROPIC/i.test(key)),
    false,
    `Unexpected AI-like environment keys: ${result.environmentKeys.join(', ')}`,
  );
});

test('runner reports a wrong expectation as FAIL without changing execution status', async () => {
  const compiled = await buildBundle(oneCase('cards'), 'fail');
  const result = await executeCompiledBundle({
    ...compiled,
    driverPath: path.resolve('examples/card-loss/playwright-driver/guidriver.mjs'),
    baseUrl: app.url,
    artifactDirectory: path.join(root, 'fail-artifacts'),
  });
  assert.equal(result.testVerdict, 'FAIL');
  assert.equal(result.executionStatus, 'COMPLETED');
  assert.equal(result.cases[0].evidence[0].actual, 'face');
});

test('runner reports a missing Driver as BLOCKED and NOT_EVALUATED', async () => {
  const compiled = await buildBundle(oneCase(), 'blocked');
  const result = await executeCompiledBundle({
    ...compiled,
    driverPath: path.join(root, 'missing-driver.mjs'),
    baseUrl: app.url,
    artifactDirectory: path.join(root, 'blocked-artifacts'),
  });
  assert.equal(result.testVerdict, 'NOT_EVALUATED');
  assert.equal(result.executionStatus, 'BLOCKED');
  assert.match(result.error, /GUI Driver not found/);
});

test('runner blocks a frozen asset changed after compilation', async () => {
  const compiled = await buildBundle(oneCase(), 'tampered-asset');
  compiled.frozenAsset.cases[0].title = 'Changed after compilation';
  const result = await executeCompiledBundle({
    ...compiled,
    driverPath: path.resolve('examples/card-loss/playwright-driver/guidriver.mjs'),
    baseUrl: app.url,
    artifactDirectory: path.join(root, 'tampered-artifacts'),
  });
  assert.equal(result.testVerdict, 'NOT_EVALUATED');
  assert.equal(result.executionStatus, 'BLOCKED');
  assert.match(result.error, /Frozen asset hash verification failed/);
});

test('runner reports a Driver exception as ERROR and NOT_EVALUATED', async () => {
  const compiled = await buildBundle(oneCase(), 'driver-error');
  const brokenDriver = path.join(root, 'broken-driver.mjs');
  await writeFile(brokenDriver, "export async function createDriver() { throw new Error('Driver setup failed'); }\n", 'utf8');
  const result = await executeCompiledBundle({
    ...compiled,
    driverPath: brokenDriver,
    baseUrl: app.url,
    artifactDirectory: path.join(root, 'driver-error-artifacts'),
  });
  assert.equal(result.testVerdict, 'NOT_EVALUATED');
  assert.equal(result.executionStatus, 'ERROR');
  assert.match(result.cases[0].error, /Driver setup failed/);
});
