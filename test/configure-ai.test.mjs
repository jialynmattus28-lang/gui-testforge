import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { loadAiConfiguration, saveAiConfiguration } from '../scripts/configure-ai.mjs';

let root;

before(async () => { root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-ai-')); });
after(async () => { await rm(root, { recursive: true, force: true }); });

test('AI configuration is local, complete, and never echoed by the API object', async () => {
  await saveAiConfiguration(root, {
    baseUrl: 'https://api.example.invalid/v1',
    apiKey: 'local-secret',
    model: 'example-model',
  });
  const loaded = await loadAiConfiguration(root);
  assert.equal(loaded.apiKey, 'local-secret');
  assert.doesNotMatch(JSON.stringify(loaded.status), /local-secret/);
  const file = path.join(root, '.gui-testforge', 'ai-config.json');
  assert.match(await readFile(file, 'utf8'), /local-secret/);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
});
