import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertValidCases,
  canonicalStringify,
  caseHash,
  sha256,
  validateCases,
} from '../packages/ir/index.mjs';

const validCase = {
  id: 'CL-ID-001',
  title: 'Identity must be read before continuing',
  requirementRefs: ['REQ-1'],
  fixture: { identityOutcome: 'success' },
  steps: [
    {
      action: { name: 'readIdentity', args: {} },
      assertions: [{ target: 'screen', equals: 'face' }],
    },
  ],
  expectedBusinessOutcome: 'IN_PROGRESS',
};

test('validates portable project-defined semantics and rejects empty assertions', () => {
  assert.deepEqual(validateCases([validCase]), []);
  const projectDefined = structuredClone(validCase);
  projectDefined.steps[0].action.name = 'account.choose-card';
  projectDefined.steps[0].assertions[0].target = 'account.selected-card-id';
  assert.deepEqual(validateCases([projectDefined]), []);

  const invalid = structuredClone(validCase);
  invalid.steps[0].assertions = [];
  assert.match(validateCases([invalid]).join('\n'), /assertions must contain at least one item/);
  assert.throws(() => assertValidCases([invalid]), /Test IR validation failed/);
});

test('rejects selectors and malformed semantic identifiers', () => {
  const fixtureWithSelector = structuredClone(validCase);
  fixtureWithSelector.fixture = { card: { selector: '[data-card-id="001"]' } };
  assert.match(validateCases([fixtureWithSelector]).join('\n'), /fixture must not contain selectors or coordinates/);

  const invalid = structuredClone(validCase);
  invalid.steps[0].action = { name: 'click', args: { selector: '#continue' } };
  assert.match(validateCases([invalid]).join('\n'), /selectors or coordinates/);

  const malformedAction = structuredClone(validCase);
  malformedAction.steps[0].action.name = 'choose card';
  assert.match(validateCases([malformedAction]).join('\n'), /portable semantic identifier/);

  const malformedObservation = structuredClone(validCase);
  malformedObservation.steps[0].assertions[0].target = 'screen[0]';
  assert.match(validateCases([malformedObservation]).join('\n'), /portable semantic identifier/);
});

test('canonical hashing ignores object key order', () => {
  const left = { b: 2, a: { d: 4, c: 3 } };
  const right = { a: { c: 3, d: 4 }, b: 2 };
  assert.equal(canonicalStringify(left), canonicalStringify(right));
  assert.equal(sha256(left), sha256(right));
  assert.equal(caseHash(validCase), caseHash(structuredClone(validCase)));
});
