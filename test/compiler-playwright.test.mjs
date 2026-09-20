import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { approveCase, confirmRequirements, createWorkspace, freezeAsset, setCases } from '../packages/workflow/index.mjs';
import { compileFrozenAsset } from '../packages/compiler-playwright/index.mjs';
import { sha256 } from '../packages/ir/index.mjs';

let root;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-compiler-'));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

function frozenAsset() {
  const testCase = {
    id: 'CL-001',
    title: 'Identity read',
    requirementRefs: ['REQ-1'],
    fixture: {},
    steps: [
      {
        action: { name: 'readIdentity', args: {} },
        assertions: [{ target: 'screen', equals: 'face' }],
      },
    ],
    expectedBusinessOutcome: 'IN_PROGRESS',
  };
  let state = createWorkspace({ prdHash: 'prd', requirements: [{ id: 'REQ-1' }] });
  state = setCases(confirmRequirements(state), [testCase]);
  state = approveCase(state, testCase.id);
  return freezeAsset(state, { frozenAt: '2026-09-19T00:00:00.000Z' }).frozenAsset;
}

test('compiler produces byte-identical portable output for identical frozen input', async () => {
  const firstDir = path.join(root, 'first');
  const secondDir = path.join(root, 'second');
  const options = {
    testModule: '../../fixtures/test.mjs',
    driverModule: '../../../testforge/gui-driver.mjs',
    fileExtension: '.spec.mjs',
    fixtureNames: ['page', 'accountSession'],
  };
  const first = await compileFrozenAsset(frozenAsset(), firstDir, options);
  const second = await compileFrozenAsset(frozenAsset(), secondDir, options);
  const firstSource = await readFile(path.join(firstDir, first.entryFile), 'utf8');
  const secondSource = await readFile(path.join(secondDir, second.entryFile), 'utf8');

  assert.equal(firstSource, secondSource);
  assert.deepEqual(first, second);
  assert.doesNotMatch(firstSource, /\/Users\/|C:\\\\Users\\|AI_API|OPENAI|ANTHROPIC/i);
  assert.match(firstSource, /import \{ test, expect \} from ["']\.\.\/\.\.\/fixtures\/test\.mjs["']/);
  assert.match(firstSource, /import \{ createDriver \} from ["']\.\.\/\.\.\/\.\.\/testforge\/gui-driver\.mjs["']/);
  assert.match(firstSource, /test\(`\$\{testCase\.id\} · \$\{testCase\.title\}`/);
  assert.match(firstSource, /await test\.step/);
  assert.match(firstSource, /expect\(actual/);
  assert.match(firstSource, /createDriver\(\{ page, accountSession, caseId: testCase\.id, fixture: testCase\.fixture \}\)/);
  assert.equal(first.framework, 'playwright-test');
  assert.equal(first.semanticContractHash, sha256(frozenAsset().semanticContract));
  assert.equal(first.files[first.entryFile], sha256(firstSource));
  assert.equal(first.discoveryCommand, 'playwright test --list');
  assert.equal(first.executionCommand, 'playwright test');
});

test('compiler supports TypeScript output and never requires a URL or Driver implementation', async () => {
  const outputDirectory = path.join(root, 'typescript');
  const manifest = await compileFrozenAsset(frozenAsset(), outputDirectory, {
    testModule: '@playwright/test',
    driverModule: './missing-driver.mjs',
    fileExtension: '.spec.ts',
    fixtureNames: ['page'],
  });
  const source = await readFile(path.join(outputDirectory, manifest.entryFile), 'utf8');

  assert.match(manifest.entryFile, /\.spec\.ts$/);
  assert.match(source, /from ["']@playwright\/test["']/);
  assert.match(source, /from ["']\.\/missing-driver\.mjs["']/);
  assert.doesNotMatch(source, /baseURL|https?:\/\//);
});

test('compiler rejects a tampered frozen asset', async () => {
  const asset = frozenAsset();
  asset.cases[0].title = 'Tampered';
  await assert.rejects(() => compileFrozenAsset(asset, path.join(root, 'tampered')), /hash verification failed/);
});
