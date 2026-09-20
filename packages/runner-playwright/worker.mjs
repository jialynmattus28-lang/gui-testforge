import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { assertDriverFactory } from '../driver-contract/index.mjs';

const configuration = JSON.parse(await readFile(process.argv[2], 'utf8'));

function progress(event) {
  process.stdout.write(`PROGRESS ${JSON.stringify(event)}\n`);
}

try {
  const driverModule = assertDriverFactory(await import(pathToFileURL(configuration.driverPath).href));
  const testCases = JSON.parse(await readFile(configuration.casesPath, 'utf8'));
  const cases = [];
  for (let caseIndex = 0; caseIndex < testCases.length; caseIndex += 1) {
    const testCase = testCases[caseIndex];
    let driver;
    const evidence = [];
    let failed = false;
    try {
      driver = await driverModule.createDriver(testCase.fixture, {
        baseUrl: configuration.baseUrl,
        artifactDir: configuration.artifactDirectory,
        headless: configuration.headless,
        caseId: testCase.id,
      });
      for (let stepIndex = 0; stepIndex < testCase.steps.length; stepIndex += 1) {
        const step = testCase.steps[stepIndex];
        progress({ phase: 'action', caseId: testCase.id, caseIndex, caseCount: testCases.length, stepIndex, action: step.action.name });
        await driver.act(step.action);
        for (const assertion of step.assertions) {
          const query = { target: assertion.target, args: assertion.args ?? {} };
          const actual = await driver.observe(query);
          const passed = isDeepStrictEqual(actual, assertion.equals);
          failed ||= !passed;
          evidence.push({ stepIndex, action: step.action.name, query, expected: assertion.equals, actual, passed });
        }
      }
      const businessOutcome = await driver.observe({ target: 'businessOutcome', args: {} });
      failed ||= !isDeepStrictEqual(businessOutcome, testCase.expectedBusinessOutcome);
      const snapshot = await driver.snapshot();
      cases.push({ caseId: testCase.id, title: testCase.title, businessOutcome, expectedBusinessOutcome: testCase.expectedBusinessOutcome, testVerdict: failed ? 'FAIL' : 'PASS', executionStatus: 'COMPLETED', evidence, snapshot });
    } catch (error) {
      cases.push({ caseId: testCase.id, title: testCase.title, businessOutcome: 'UNKNOWN', expectedBusinessOutcome: testCase.expectedBusinessOutcome, testVerdict: 'NOT_EVALUATED', executionStatus: 'ERROR', evidence, error: error.message });
    } finally {
      if (driver) await driver.close();
    }
  }

  const hasError = cases.some((item) => item.executionStatus === 'ERROR');
  const hasFailure = cases.some((item) => item.testVerdict === 'FAIL');
  const result = {
    testVerdict: hasError ? 'NOT_EVALUATED' : hasFailure ? 'FAIL' : 'PASS',
    executionStatus: hasError ? 'ERROR' : 'COMPLETED',
    cases,
    summary: {
      total: cases.length,
      passed: cases.filter((item) => item.testVerdict === 'PASS').length,
      failed: cases.filter((item) => item.testVerdict === 'FAIL').length,
      notEvaluated: cases.filter((item) => item.testVerdict === 'NOT_EVALUATED').length,
    },
    environmentKeys: Object.keys(process.env).sort(),
  };
  await writeFile(configuration.resultPath, JSON.stringify(result, null, 2), 'utf8');
} catch (error) {
  const result = {
    testVerdict: 'NOT_EVALUATED',
    executionStatus: 'ERROR',
    error: error.stack ?? error.message,
    cases: [],
    environmentKeys: Object.keys(process.env).sort(),
  };
  await writeFile(configuration.resultPath, JSON.stringify(result, null, 2), 'utf8');
  process.exitCode = 1;
}
