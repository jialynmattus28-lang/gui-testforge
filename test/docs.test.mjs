import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';

const pairs = [
  ['README.md', 'README.zh-CN.md'],
  ['CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md'],
  ['SECURITY.md', 'SECURITY.zh-CN.md'],
  ['CODE_OF_CONDUCT.md', 'CODE_OF_CONDUCT.zh-CN.md'],
  ['CHANGELOG.md', 'CHANGELOG.zh-CN.md'],
  ['SUPPORT.md', 'SUPPORT.zh-CN.md'],
  ['docs/USER_GUIDE.md', 'docs/USER_GUIDE.zh-CN.md'],
  ['docs/GUI_DRIVER.md', 'docs/GUI_DRIVER.zh-CN.md'],
  ['docs/AI_PROVIDER.md', 'docs/AI_PROVIDER.zh-CN.md'],
  ['docs/COMPILER.md', 'docs/COMPILER.zh-CN.md'],
  ['docs/architecture/README.md', 'docs/architecture/README.zh-CN.md'],
  ['docs/architecture/adr/0001-test-ir.md', 'docs/architecture/adr/0001-test-ir.zh-CN.md'],
  ['docs/architecture/adr/0002-ai-boundary.md', 'docs/architecture/adr/0002-ai-boundary.zh-CN.md'],
  ['docs/architecture/adr/0003-compiler-contract.md', 'docs/architecture/adr/0003-compiler-contract.zh-CN.md'],
  ['docs/superpowers/specs/2026-09-19-gui-testforge-open-source-design.md', 'docs/superpowers/specs/2026-09-19-gui-testforge-open-source-design.zh-CN.md'],
  ['docs/superpowers/specs/2026-09-20-existing-playwright-integration-design.md', 'docs/superpowers/specs/2026-09-20-existing-playwright-integration-design.zh-CN.md'],
  ['docs/superpowers/specs/2026-09-20-guided-stage-transitions-and-execution-gate-design.md', 'docs/superpowers/specs/2026-09-20-guided-stage-transitions-and-execution-gate-design.zh-CN.md'],
  ['examples/existing-playwright/README.md', 'examples/existing-playwright/README.zh-CN.md'],
];

test('English and Chinese documentation pairs link to each other', async () => {
  for (const [englishPath, chinesePath] of pairs) {
    const [english, chinese] = await Promise.all([readFile(englishPath, 'utf8'), readFile(chinesePath, 'utf8')]);
    assert.match(english, new RegExp(chinesePath.split('/').at(-1).replace('.', '\\.')));
    assert.match(chinese, new RegExp(englishPath.split('/').at(-1).replace('.', '\\.')));
  }
});

test('user guide is concise, actionable, and points to detailed specifications', async () => {
  const [english, chinese] = await Promise.all([
    readFile('docs/USER_GUIDE.md', 'utf8'),
    readFile('docs/USER_GUIDE.zh-CN.md', 'utf8'),
  ]);
  for (const guide of [english, chinese]) {
    assert.match(guide, /npm run demo/);
    assert.match(guide, /Test IR/);
    assert.match(guide, /Playwright/);
    assert.match(guide, /2026-09-20-existing-playwright-integration-design/);
    assert.match(guide, /testforge\.config\.mjs/);
    assert.match(guide, /playwright test --list/);
    assert.ok(guide.split('\n').length < 140, 'User guide must remain concise');
  }
});

test('public documentation positions TestForge as an existing Playwright precompiler', async () => {
  const [readme, compiler, architecture] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile('docs/COMPILER.md', 'utf8'),
    readFile('docs/architecture/README.md', 'utf8'),
  ]);
  const source = `${readme}\n${compiler}\n${architecture}`;
  assert.match(source, /existing Playwright/);
  assert.match(source, /COMPILED \/ NOT_EVALUATED/);
  assert.match(source, /host.*Playwright Runner/is);
  assert.match(source, /before GUI development is complete/i);
});

test('public guidance distinguishes compilation from explicit execution handoff', async () => {
  const [readme, guide, chineseGuide] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile('docs/USER_GUIDE.md', 'utf8'),
    readFile('docs/USER_GUIDE.zh-CN.md', 'utf8'),
  ]);
  assert.match(`${readme}\n${guide}`, /Use bundled demo/);
  assert.match(guide, /target application URL.*GUI Driver/is);
  assert.match(chineseGuide, /被测程序 URL.*GUI Driver/is);
});

test('bilingual training decks are published and linked from both READMEs', async () => {
  const englishDeck = 'docs/presentations/GUI_TestForge_Test_Team_Training_en_V1.1.pptx';
  const chineseDeck = 'docs/presentations/GUI_TestForge_Test_Team_Training_zh-CN_V1.1.pptx';
  const [readme, chineseReadme, englishStat, chineseStat] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile('README.zh-CN.md', 'utf8'),
    stat(englishDeck),
    stat(chineseDeck),
  ]);

  assert.ok(englishStat.size > 10_000, 'English training deck must be a real PPTX file');
  assert.ok(chineseStat.size > 10_000, 'Chinese training deck must be a real PPTX file');
  assert.match(readme, new RegExp(englishDeck.replaceAll('.', '\\.')));
  assert.match(readme, new RegExp(chineseDeck.replaceAll('.', '\\.')));
  assert.match(chineseReadme, new RegExp(englishDeck.replaceAll('.', '\\.')));
  assert.match(chineseReadme, new RegExp(chineseDeck.replaceAll('.', '\\.')));
});

test('internal implementation plans are not included in the public tree', async () => {
  const files = await readdir('docs/superpowers/plans').catch(() => []);
  assert.deepEqual(files, []);
});
