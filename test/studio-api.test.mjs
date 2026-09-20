import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { normalizePlaywrightReport, startStudio, withoutAiCredentials } from '../apps/studio/server.mjs';

let root;
let studio;

test('native Playwright execution cannot inherit AI credentials', () => {
  assert.deepEqual(withoutAiCredentials({
    PATH: '/bin',
    CI: '1',
    OPENAI_API_KEY: 'openai-secret',
    ANTHROPIC_API_KEY: 'anthropic-secret',
    GUI_TESTFORGE_AI_API_KEY: 'testforge-secret',
    MODEL_API_TOKEN: 'model-secret',
    APP_AUTH_TOKEN: 'keep-this',
  }), {
    PATH: '/bin',
    CI: '1',
    APP_AUTH_TOKEN: 'keep-this',
  });
});

test('native report recognizes generated specs with relative paths', () => {
  const result = normalizePlaywrightReport({
    suites: [{
      specs: [{
        file: 'generated/testforge/card-loss.spec.mjs',
        title: 'CL-001 · Card loss',
        tests: [{ results: [{ status: 'passed' }] }],
      }],
    }],
    stats: {},
  }, 0);

  assert.equal(result.testVerdict, 'PASS');
  assert.equal(result.summary.passed, 1);
  assert.equal(result.cases[0].caseId, 'CL-001');
});

async function request(pathname, body) {
  const response = await fetch(`${studio.url}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-studio-'));
  studio = await startStudio({ port: 0, workspaceDirectory: root, demoAppUrl: 'http://127.0.0.1:65535' });
});

after(async () => {
  if (studio) await studio.close();
  if (root) await rm(root, { recursive: true, force: true });
});

test('workflow API enforces requirements, human decisions, freeze, and compile gates', async () => {
  let response = await request('/api/status');
  assert.equal(response.body.requirements.length, 5);
  assert.equal(response.body.requirementsConfirmed, false);
  assert.deepEqual(response.body.executionSetup, {
    ready: false,
    mode: null,
    targetUrl: null,
    driverFileName: null,
    driverStatus: 'MISSING',
  });
  assert.equal(response.body.bundledDemoAvailable, true);

  response = await request('/api/generate', { mode: 'offline' });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /Confirm requirements/);

  await request('/api/requirements/confirm', {});
  response = await request('/api/generate', { mode: 'offline' });
  assert.equal(response.status, 200);
  assert.equal(response.body.cases.length, 7);
  assert.equal(response.body.proposalSource, 'offline-replay');

  response = await request('/api/freeze', {});
  assert.equal(response.status, 409);
  assert.match(response.body.error, /review every Test IR case/);

  response = await request('/api/status');
  const rejected = await request(`/api/cases/${response.body.cases[0].id}/reject`, { reason: 'Review again in the batch' });
  assert.equal(rejected.status, 200);
  response = await request('/api/cases/approve-all', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.reviewComplete, true);
  assert.equal(Object.values(response.body.decisions).every((decision) => decision.status === 'approved'), true);

  response = await request('/api/freeze', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.frozenAsset.cases.length, 7);

  response = await request('/api/compile', { framework: 'playwright' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.compilation.manifest.compilerId, 'playwright');
  assert.equal(response.body.compilation.manifest.framework, 'playwright-test');
  assert.equal(response.body.compilation.manifest.cases.length, 7);
  assert.equal(response.body.compilation.executionStatus, 'NOT_EVALUATED');
  assert.equal(response.body.compilation.discovery.total, 8);
  assert.equal(response.body.compilation.discovery.generated, 7);
  assert.equal(response.body.compilation.hostProject.existingTests, 1);
  assert.equal(response.body.compilation.hostProject.runner, 'Playwright Test');

  response = await request('/api/run', {});
  assert.equal(response.status, 409);
  assert.match(response.body.error, /target application URL and GUI Driver/i);

  response = await request('/api/execution/setup', {
    targetUrl: 'file:///tmp/demo.html',
    driverFileName: 'gui-driver.mjs',
    driverSource: 'export async function createDriver() {}',
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /HTTP or HTTPS/);

  response = await request('/api/execution/setup', {
    targetUrl: 'https://example.test/app',
    driverFileName: 'gui-driver.js',
    driverSource: 'export async function createDriver() {}',
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /\.mjs/);

  response = await request('/api/execution/setup', {
    targetUrl: 'https://example.test/app',
    driverFileName: 'gui-driver.mjs',
    driverSource: 'export const value = 1;',
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /must export createDriver/);

  response = await request('/api/execution/setup', {
    targetUrl: 'https://example.test/app',
    driverFileName: 'project-driver.mjs',
    driverSource: 'export async function createDriver() { return { act() {}, observe() {}, close() {} }; }',
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.executionSetup, {
    ready: true,
    mode: 'external',
    targetUrl: 'https://example.test/app',
    driverFileName: 'project-driver.mjs',
    driverStatus: 'READY',
  });
  assert.equal(Object.hasOwn(response.body.executionSetup, 'driverSource'), false);

  response = await request('/api/execution/use-bundled-demo', {});
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.executionSetup.ready, true);
  assert.equal(response.body.executionSetup.mode, 'bundled');
  assert.equal(response.body.executionSetup.targetUrl, 'http://127.0.0.1:65535/');
  assert.equal(response.body.executionSetup.driverFileName, 'gui-driver.mjs');

  response = await request('/api/run', {});
  assert.equal(response.status, 202);
  response = await request('/api/execution/setup', {
    targetUrl: 'https://example.test/changed',
    driverFileName: 'changed-driver.mjs',
    driverSource: 'export async function createDriver() { return { act() {}, observe() {}, close() {} }; }',
  });
  assert.equal(response.status, 409);
  assert.match(response.body.error, /run is active/i);
});
