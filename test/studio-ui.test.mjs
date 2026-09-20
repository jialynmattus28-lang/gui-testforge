import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('workbench exposes the six English stages and explicit trust labels', async () => {
  const html = await readFile('apps/studio/public/index.html', 'utf8');
  const app = await readFile('apps/studio/public/app.mjs', 'utf8');
  const server = await readFile('apps/studio/server.mjs', 'utf8');
  const source = `${html}\n${app}`;
  for (const label of ['Requirements', 'Test IR Design', 'Human Review', 'Freeze Asset', 'Compile', 'Run and Trace']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Offline replay/);
  assert.match(source, /Human approved/);
  assert.match(source, /AI-free execution/);
  assert.match(source, /Locked/);
  assert.match(source, /Before GUI/);
  assert.match(source, /COMPILED \/ NOT_EVALUATED/);
  assert.match(source, /Existing Playwright host/);
  assert.match(source, /After GUI/);
  assert.match(source, /Native Playwright execution/);
  assert.doesNotMatch(server, /runner-playwright/);
});

test('workflow exposes guided navigation, batch review, and explicit execution setup', async () => {
  const app = await readFile('apps/studio/public/app.mjs', 'utf8');
  for (const contract of [
    'advanceAfterSuccess',
    'renderNextAction',
    'Approve all',
    'Next: Freeze Asset',
    'Target application URL',
    'GUI Driver (.mjs)',
    'Validate execution setup',
    'Use bundled demo',
    'Waiting for application and GUI Driver',
  ]) {
    assert.match(app, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(app, /disabled: !state\.executionSetup\.ready/);
});
