import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertSafeDemoWorkspace, findFreePort } from '../scripts/demo.mjs';
import { browserCommand } from '../scripts/open-browser.mjs';

test('demo workspace guard only accepts the repository demo directory', () => {
  const root = path.resolve('/project/gui-testforge');
  assert.doesNotThrow(() => assertSafeDemoWorkspace(root, path.join(root, '.gui-testforge', 'demo')));
  assert.throws(() => assertSafeDemoWorkspace(root, path.join(root, 'examples')), /Refusing to reset/);
  assert.throws(() => assertSafeDemoWorkspace(root, root), /Refusing to reset/);
});

test('free-port selection returns an available local port', async () => {
  const port = await findFreePort('127.0.0.1');
  assert.ok(Number.isInteger(port));
  assert.ok(port > 0);
});

test('browser opening is platform-specific and shell-free', () => {
  assert.deepEqual(browserCommand('https://example.test', 'darwin'), { command: 'open', args: ['https://example.test'] });
  assert.deepEqual(browserCommand('https://example.test', 'win32'), { command: 'cmd', args: ['/c', 'start', '', 'https://example.test'] });
  assert.deepEqual(browserCommand('https://example.test', 'linux'), { command: 'xdg-open', args: ['https://example.test'] });
});

test('one-command demo exposes a bundled target that starts only after explicit execution setup', async () => {
  const source = await readFile('scripts/demo.mjs', 'utf8');
  assert.match(source, /beforeRun/);
  assert.match(source, /if \(!demo\) demo = await startDemoApp/);
  assert.match(source, /demoAppUrl: demoUrl/);
  assert.match(source, /targetStarted: false/);
});
