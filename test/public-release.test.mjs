import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const requiredFiles = [
  'README.md',
  'README.zh-CN.md',
  'LICENSE',
  'NOTICE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  'SUPPORT.md',
  'SUPPORT.zh-CN.md',
];

test('public repository metadata is complete and bilingual', async () => {
  const contents = await Promise.all(requiredFiles.map((file) => readFile(file, 'utf8')));
  assert.match(contents[0], /README\.zh-CN\.md/);
  assert.match(contents[1], /README\.md/);
  assert.match(contents[2], /Apache License/);
  assert.match(contents[3], /Copyright 2026 吴笛（Dean Wu）/);
  assert.match(contents[0], /npm run demo/);
  assert.match(contents[1], /npm run demo/);
  assert.match(contents[0], /git clone https:\/\/github\.com\/jialynmattus28-lang\/gui-testforge\.git/);
  assert.match(contents[1], /git clone https:\/\/github\.com\/jialynmattus28-lang\/gui-testforge\.git/);
  assert.match(contents[0], /existing Playwright project/);
  assert.match(contents[1], /现有.*Playwright 项目/);
  assert.match(contents[0], /zero AI/);
  assert.match(contents[1], /零 AI/);
  assert.match(contents[8], /Discussions/);
  assert.match(contents[9], /Discussions/);
});
