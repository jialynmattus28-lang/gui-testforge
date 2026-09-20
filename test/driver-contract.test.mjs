import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  assertDriverFactory,
  assertDriverFactoryInput,
  assertDriverInstance,
  assertKnownAction,
  assertKnownObservation,
  driverNotImplemented,
  validateDriverModule,
} from '../packages/driver-contract/index.mjs';

test('driver contract requires a host-style factory and three semantic methods', () => {
  assert.throws(() => assertDriverFactory({}), /createDriver/);
  assert.doesNotThrow(() => assertDriverFactory({ createDriver() {} }));
  assert.throws(() => assertDriverInstance({ act() {} }), /observe, close/);
  assert.doesNotThrow(() => assertDriverInstance({
    act() {},
    observe() {},
    close() {},
  }));
});

test('factory input accepts Playwright fixtures but rejects expected values', () => {
  const input = { page: {}, context: {}, request: {}, caseId: 'CASE-1', fixture: { account: 'A' } };
  assert.equal(assertDriverFactoryInput(input), input);
  assert.throws(
    () => assertDriverFactoryInput({ ...input, expected: 'PASS' }),
    /must not receive expected assertion values/,
  );
  assert.throws(() => assertDriverFactoryInput({ fixture: {} }), /caseId/);
});

test('semantic guards produce explicit missing-operation errors', () => {
  const contract = { actions: ['card.select'], observations: ['card.status'] };
  assert.doesNotThrow(() => assertKnownAction(contract, { name: 'card.select', args: {} }));
  assert.doesNotThrow(() => assertKnownObservation(contract, { target: 'card.status', args: {} }));
  assert.throws(() => assertKnownAction(contract, { name: 'card.delete' }), /UNKNOWN_ACTION: card\.delete/);
  assert.throws(() => assertKnownObservation(contract, { target: 'card.balance' }), /UNKNOWN_OBSERVATION: card\.balance/);
  assert.throws(() => driverNotImplemented('card.select'), /DRIVER_NOT_IMPLEMENTED: card\.select/);
});

test('module validation runs without AI credentials and rejects an invalid factory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gui-testforge-driver-validation-'));
  const validPath = path.join(root, 'valid.mjs');
  const invalidPath = path.join(root, 'invalid.mjs');
  const markerPath = path.join(root, 'environment.txt');
  try {
    await writeFile(validPath, `
      import { writeFileSync } from 'node:fs';
      writeFileSync(process.env.VALIDATION_MARKER, process.env.OPENAI_API_KEY ?? 'missing');
      export async function createDriver() {}
    `, 'utf8');
    await writeFile(invalidPath, 'export const value = 1;\n', 'utf8');

    await validateDriverModule(validPath, {
      ...process.env,
      OPENAI_API_KEY: 'must-not-be-visible',
      VALIDATION_MARKER: markerPath,
    });
    assert.equal(await readFile(markerPath, 'utf8'), 'missing');
    await assert.rejects(() => validateDriverModule(invalidPath), /must export createDriver/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
