import { createHash } from 'node:crypto';

export const IR_VERSION = '1';

const SEMANTIC_IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;
const FORBIDDEN_UI_KEYS = new Set(['selector', 'locator', 'css', 'xpath', 'coordinates']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

function containsUiImplementationDetail(value) {
  if (Array.isArray(value)) return value.some(containsUiImplementationDetail);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) => (
    FORBIDDEN_UI_KEYS.has(key.toLowerCase()) || containsUiImplementationDetail(child)
  ));
}

function isSemanticIdentifier(value) {
  return typeof value === 'string' && SEMANTIC_IDENTIFIER.test(value);
}

export function canonicalStringify(value) {
  return JSON.stringify(normalize(value));
}

export function sha256(value) {
  const input = typeof value === 'string' ? value : canonicalStringify(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function caseHash(testCase) {
  return sha256(testCase);
}

export function validateCases(cases) {
  const errors = [];
  if (!Array.isArray(cases) || cases.length === 0) {
    return ['cases must contain at least one item'];
  }

  const ids = new Set();
  cases.forEach((testCase, caseIndex) => {
    const path = `cases[${caseIndex}]`;
    if (!isObject(testCase)) {
      errors.push(`${path} must be an object`);
      return;
    }
    for (const key of ['id', 'title', 'expectedBusinessOutcome']) {
      if (typeof testCase[key] !== 'string' || testCase[key].trim() === '') {
        errors.push(`${path}.${key} must be a non-empty string`);
      }
    }
    if (typeof testCase.id === 'string') {
      if (ids.has(testCase.id)) errors.push(`${path}.id must be unique`);
      ids.add(testCase.id);
    }
    if (!Array.isArray(testCase.requirementRefs) || testCase.requirementRefs.length === 0) {
      errors.push(`${path}.requirementRefs must contain at least one item`);
    }
    if (!isObject(testCase.fixture)) errors.push(`${path}.fixture must be an object`);
    if (containsUiImplementationDetail(testCase.fixture)) {
      errors.push(`${path}.fixture must not contain selectors or coordinates`);
    }
    if (!Array.isArray(testCase.steps) || testCase.steps.length === 0) {
      errors.push(`${path}.steps must contain at least one item`);
      return;
    }
    testCase.steps.forEach((step, stepIndex) => {
      const stepPath = `${path}.steps[${stepIndex}]`;
      if (!isObject(step?.action) || !isSemanticIdentifier(step.action.name)) {
        errors.push(`${stepPath}.action.name must be a portable semantic identifier`);
      }
      if (step?.action?.args !== undefined && !isObject(step.action.args)) {
        errors.push(`${stepPath}.action.args must be an object`);
      }
      if (containsUiImplementationDetail(step?.action?.args)) {
        errors.push(`${stepPath}.action.args must not contain selectors or coordinates`);
      }
      if (!Array.isArray(step?.assertions) || step.assertions.length === 0) {
        errors.push(`${stepPath}.assertions must contain at least one item`);
        return;
      }
      step.assertions.forEach((assertion, assertionIndex) => {
        const assertionPath = `${stepPath}.assertions[${assertionIndex}]`;
        if (!isObject(assertion) || !isSemanticIdentifier(assertion.target)) {
          errors.push(`${assertionPath}.target must be a portable semantic identifier`);
        }
        if (!Object.hasOwn(assertion ?? {}, 'equals')) {
          errors.push(`${assertionPath}.equals is required`);
        }
        if (assertion?.args !== undefined && !isObject(assertion.args)) {
          errors.push(`${assertionPath}.args must be an object`);
        }
        if (containsUiImplementationDetail(assertion?.args)) {
          errors.push(`${assertionPath}.args must not contain selectors or coordinates`);
        }
      });
    });
  });
  return errors;
}

export function deriveSemanticContract(cases) {
  assertValidCases(cases);
  const actions = new Set();
  const observations = new Set(['businessOutcome']);
  for (const testCase of cases) {
    for (const step of testCase.steps) {
      actions.add(step.action.name);
      for (const assertion of step.assertions) observations.add(assertion.target);
    }
  }
  return {
    actions: [...actions].sort(),
    observations: [...observations].sort(),
  };
}

export function assertValidCases(cases) {
  const errors = validateCases(cases);
  if (errors.length > 0) {
    throw new Error(`Test IR validation failed:\n${errors.join('\n')}`);
  }
  return cases;
}
