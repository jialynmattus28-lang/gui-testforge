import { assertValidCases, caseHash, deriveSemanticContract, sha256 } from '../ir/index.mjs';

function copy(value) {
  return structuredClone(value);
}

function findCase(state, id) {
  const testCase = state.cases.find((candidate) => candidate.id === id);
  if (!testCase) throw new Error(`Unknown Test IR case: ${id}`);
  return testCase;
}

export function createWorkspace({ prdHash, requirements }) {
  return {
    version: 1,
    prdHash,
    requirements: copy(requirements),
    requirementsConfirmed: false,
    cases: [],
    decisions: {},
    frozenAsset: null,
  };
}

export function confirmRequirements(state) {
  return { ...copy(state), requirementsConfirmed: true };
}

export function setCases(state, cases) {
  if (!state.requirementsConfirmed) throw new Error('Confirm requirements before generating Test IR');
  assertValidCases(cases);
  return { ...copy(state), cases: copy(cases), decisions: {}, frozenAsset: null };
}

export function approveCase(state, id) {
  const next = copy(state);
  const testCase = findCase(next, id);
  next.decisions[id] = { status: 'approved', caseHash: caseHash(testCase) };
  next.frozenAsset = null;
  return next;
}

export function approveAllCases(state) {
  return state.cases.reduce((next, testCase) => approveCase(next, testCase.id), copy(state));
}

export function rejectCase(state, id, reason) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('A rejection reason is required');
  }
  const next = copy(state);
  findCase(next, id);
  next.decisions[id] = { status: 'rejected', reason: reason.trim() };
  next.frozenAsset = null;
  return next;
}

export function editCase(state, id, replacement) {
  assertValidCases([replacement]);
  if (replacement.id !== id) throw new Error('A case edit cannot change its stable ID');
  const next = copy(state);
  const index = next.cases.findIndex((candidate) => candidate.id === id);
  if (index < 0) throw new Error(`Unknown Test IR case: ${id}`);
  next.cases[index] = copy(replacement);
  delete next.decisions[id];
  next.frozenAsset = null;
  return next;
}

export function allCasesReviewed(state) {
  return state.cases.length > 0 && state.cases.every((testCase) => {
    const decision = state.decisions[testCase.id];
    if (!decision) return false;
    if (decision.status === 'rejected') return true;
    return decision.status === 'approved' && decision.caseHash === caseHash(testCase);
  });
}

export function freezeAsset(state, { frozenAt = new Date().toISOString() } = {}) {
  if (!allCasesReviewed(state)) {
    throw new Error('Human review must review every Test IR case before freezing');
  }
  const approvedCases = state.cases.filter((testCase) => state.decisions[testCase.id]?.status === 'approved');
  if (approvedCases.length === 0) throw new Error('At least one approved Test IR case is required');

  const body = {
    format: 'gui-testforge-frozen-asset',
    version: 1,
    irVersion: '1',
    frozenAt,
    prdHash: state.prdHash,
    requirements: copy(state.requirements),
    cases: copy(approvedCases),
    semanticContract: deriveSemanticContract(approvedCases),
    approvals: Object.fromEntries(
      approvedCases.map((testCase) => [testCase.id, copy(state.decisions[testCase.id])]),
    ),
  };
  return { ...copy(state), frozenAsset: { ...body, assetHash: sha256(body) } };
}

export function verifyFrozenAsset(asset) {
  if (!asset || typeof asset.assetHash !== 'string') return false;
  const { assetHash, ...body } = asset;
  return sha256(body) === assetHash;
}
