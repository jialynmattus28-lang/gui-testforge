import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const validatorPath = fileURLToPath(new URL('./validate-module.mjs', import.meta.url));
const AI_ENVIRONMENT_KEY = /(^|_)(OPENAI|ANTHROPIC|GEMINI|GOOGLE_GENERATIVE_AI|MISTRAL|COHERE|GROQ|DEEPSEEK|XAI|GUI_TESTFORGE_AI|AI_API|MODEL_API)(_|$)/i;

function withoutAiCredentials(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key, value]) => value !== undefined && !AI_ENVIRONMENT_KEY.test(key)),
  );
}

export async function validateDriverModule(modulePath, environment = process.env) {
  try {
    await execFileAsync(process.execPath, [validatorPath, modulePath], {
      env: withoutAiCredentials(environment),
      windowsHide: true,
    });
  } catch (error) {
    const message = error.stderr?.trim() || error.message;
    throw new Error(`GUI Driver validation failed: ${message}`);
  }
  return { status: 'READY' };
}

export function assertDriverFactory(module) {
  if (!module || typeof module.createDriver !== 'function') {
    throw new Error('GUI Driver module must export createDriver({ page, context, request, caseId, fixture })');
  }
  return module;
}

export function assertDriverInstance(driver) {
  const missing = ['act', 'observe', 'close'].filter((name) => typeof driver?.[name] !== 'function');
  if (missing.length > 0) throw new Error(`DRIVER_NOT_IMPLEMENTED: missing methods ${missing.join(', ')}`);
  return driver;
}

function containsExpectedValue(value) {
  if (Array.isArray(value)) return value.some(containsExpectedValue);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => (
    ['expected', 'expectedValue', 'equals', 'assertion', 'assertions'].includes(key)
      || containsExpectedValue(child)
  ));
}

export function assertDriverFactoryInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('GUI Driver factory input must be an object');
  }
  if (typeof input.caseId !== 'string' || input.caseId.trim() === '') {
    throw new Error('GUI Driver factory input requires caseId');
  }
  if (!input.fixture || typeof input.fixture !== 'object' || Array.isArray(input.fixture)) {
    throw new Error('GUI Driver factory input requires fixture');
  }
  const explicitExpected = ['expected', 'expectedValue', 'assertion', 'assertions']
    .some((key) => Object.hasOwn(input, key));
  if (explicitExpected || containsExpectedValue(input.fixture)) {
    throw new Error('GUI Driver must not receive expected assertion values');
  }
  return input;
}

export function assertKnownAction(contract, action) {
  if (!contract?.actions?.includes(action?.name)) {
    throw new Error(`UNKNOWN_ACTION: ${action?.name ?? '<missing>'}`);
  }
  return action;
}

export function assertKnownObservation(contract, query) {
  if (!contract?.observations?.includes(query?.target)) {
    throw new Error(`UNKNOWN_OBSERVATION: ${query?.target ?? '<missing>'}`);
  }
  return query;
}

export function driverNotImplemented(operation = 'createDriver') {
  throw new Error(`DRIVER_NOT_IMPLEMENTED: ${operation}`);
}
