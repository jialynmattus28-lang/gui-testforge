import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caseHash } from '../packages/ir/index.mjs';
import {
  allCasesReviewed,
  approveAllCases,
  approveCase,
  confirmRequirements,
  createWorkspace,
  editCase,
  freezeAsset,
  rejectCase,
  setCases,
  verifyFrozenAsset,
} from '../packages/workflow/index.mjs';

function makeCase(id = 'CL-001') {
  return {
    id,
    title: `Case ${id}`,
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
}

function makeSemanticCase(id, action, target) {
  const testCase = makeCase(id);
  testCase.steps[0].action.name = action;
  testCase.steps[0].assertions[0].target = target;
  return testCase;
}

test('approval binds to exact case content and edits invalidate it', () => {
  let state = createWorkspace({ prdHash: 'prd-hash', requirements: [{ id: 'REQ-1' }] });
  state = confirmRequirements(state);
  state = setCases(state, [makeCase()]);
  state = approveCase(state, 'CL-001');
  assert.equal(state.decisions['CL-001'].caseHash, caseHash(state.cases[0]));
  assert.equal(allCasesReviewed(state), true);

  const changed = { ...state.cases[0], title: 'Changed title' };
  state = editCase(state, 'CL-001', changed);
  assert.equal(state.decisions['CL-001'], undefined);
  assert.equal(allCasesReviewed(state), false);
});

test('batch approval records a content-bound approval for every current case', () => {
  let state = createWorkspace({ prdHash: 'prd-hash', requirements: [{ id: 'REQ-1' }] });
  state = confirmRequirements(state);
  state = setCases(state, [makeCase('CL-001'), makeCase('CL-002')]);
  state = rejectCase(state, 'CL-002', 'Needs another review');

  state = approveAllCases(state);

  assert.equal(allCasesReviewed(state), true);
  assert.deepEqual(Object.keys(state.decisions).sort(), ['CL-001', 'CL-002']);
  for (const testCase of state.cases) {
    assert.deepEqual(state.decisions[testCase.id], {
      status: 'approved',
      caseHash: caseHash(testCase),
    });
  }
});

test('freeze includes approved cases, excludes rejected cases, and detects tampering', () => {
  let state = createWorkspace({ prdHash: 'prd-hash', requirements: [{ id: 'REQ-1' }] });
  state = confirmRequirements(state);
  state = setCases(state, [makeCase('CL-001'), makeCase('CL-002')]);
  state = approveCase(state, 'CL-001');
  state = rejectCase(state, 'CL-002', 'Duplicate coverage');
  state = freezeAsset(state, { frozenAt: '2026-09-19T00:00:00.000Z' });

  assert.equal(state.frozenAsset.cases.length, 1);
  assert.equal(state.frozenAsset.cases[0].id, 'CL-001');
  assert.equal(verifyFrozenAsset(state.frozenAsset), true);

  const tampered = structuredClone(state.frozenAsset);
  tampered.cases[0].title = 'Tampered';
  assert.equal(verifyFrozenAsset(tampered), false);
});

test('freeze derives a sorted unique semantic contract from approved cases', () => {
  let state = createWorkspace({ prdHash: 'prd-hash', requirements: [{ id: 'REQ-1' }] });
  state = confirmRequirements(state);
  state = setCases(state, [
    makeSemanticCase('CL-001', 'card.select', 'screen.name'),
    makeSemanticCase('CL-002', 'identity.read', 'screen.name'),
  ]);
  state = approveCase(state, 'CL-001');
  state = approveCase(state, 'CL-002');
  state = freezeAsset(state, { frozenAt: '2026-09-19T00:00:00.000Z' });

  assert.deepEqual(state.frozenAsset.semanticContract, {
    actions: ['card.select', 'identity.read'],
    observations: ['businessOutcome', 'screen.name'],
  });
});

test('freeze is blocked until every proposal has a human decision', () => {
  let state = createWorkspace({ prdHash: 'prd-hash', requirements: [{ id: 'REQ-1' }] });
  state = confirmRequirements(state);
  state = setCases(state, [makeCase()]);
  assert.throws(() => freezeAsset(state), /review every Test IR case/);
});
