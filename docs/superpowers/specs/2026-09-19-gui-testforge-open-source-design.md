# GUI TestForge Open Source Design

[English](2026-09-19-gui-testforge-open-source-design.md) | [简体中文](2026-09-19-gui-testforge-open-source-design.zh-CN.md)

**Status:** Updated for the existing Playwright integration direction

**Detailed integration contract:** [Existing Playwright Integration Design](2026-09-20-existing-playwright-integration-design.md)

## 1. Product Definition

GUI TestForge is a requirements-to-native-test precompiler for teams that already operate a Playwright framework.

Its purpose is to let those teams complete executable GUI test scripts before the tested GUI, URL, selectors, or final DOM exist. It does not replace the host Playwright configuration or Runner.

The two product guarantees are:

1. Human-approved semantic tests can be compiled into native Playwright specs before the GUI exists.
2. Compilation, execution, assertions, reports, and verdicts contain zero AI decision-making.

## 2. User Assumption and Scope

The primary user already has:

- a working Playwright Test project;
- project configuration, fixtures, reporters, CI, and browser settings;
- existing API and GUI tests;
- a normal command that discovers and executes Playwright specs.

GUI TestForge supplies only the missing pre-GUI layer:

- requirement analysis and optional AI proposals;
- human review and approval;
- frozen Test IR;
- deterministic native Playwright compilation;
- a GUI Driver contract that development implements when the GUI arrives.

Selenium is a future compiler target. It remains disabled until it has an equivalent compiler, Driver contract, examples, and conformance tests.

## 3. End-to-End Workflow

1. Import reviewed product requirements.
2. Create Test IR proposals manually, from another tool, or through an optional AI provider.
3. Validate structure and identify missing requirement coverage.
4. Have a person approve, edit, or reject every case.
5. Freeze approved cases and their exact hashes as a formal test asset.
6. Compile the asset into native Playwright specs inside the host `testDir`.
7. Run `playwright test --list` before the GUI exists.
8. When the application is delivered, implement the GUI Driver only.
9. Run the host project's normal `playwright test` command.
10. Use native Playwright reports, traces, screenshots, projects, retries, and CI.

## 4. Test IR

Test IR is framework-independent structured data. It contains:

- a stable case ID and title;
- requirement references;
- fixture data;
- semantic actions and arguments;
- semantic observations and frozen expected values;
- the expected business outcome.

Test IR must not contain selectors, coordinates, URLs, arbitrary source code, Playwright calls, or Selenium calls.

Action and observation identifiers are project-defined portable names. Freezing derives a sorted unique semantic contract so the Driver obligations are explicit and hashable.

Approval is bound to the exact case hash. Editing a case invalidates its approval. Freezing is blocked until every proposal has a human decision.

## 5. Native Playwright Integration

A host project adds:

```text
testforge.config.mjs
testforge/
  frozen/*.json
  gui-driver.mjs
tests/
  generated/testforge/*.spec.mjs
```

The deterministic integration commands are:

```bash
testforge compile --config testforge.config.mjs
testforge check --config testforge.config.mjs
playwright test --list
playwright test
```

The generated spec imports `test` and `expect` from the host's selected fixture module. It declares one native Playwright test per approved Test IR case, uses `test.step`, calls the GUI Driver, and uses deterministic deep equality for assertions.

The compiler does not import Playwright, the Driver, an AI provider, or the target application. It requires no URL and launches no browser.

The manifest records the frozen asset hash, semantic contract hash, compiler configuration hash, and every generated file hash. Identical input and configuration produce byte-identical generated source.

## 6. GUI Driver

The GUI Driver is the application-specific mapping layer:

```javascript
export async function createDriver({ page, context, request, caseId, fixture }) {
  return {
    async act(action) {},
    async observe(query) {},
    async close() {},
  };
}
```

It owns locators, navigation, waits, and actual-state reading. It never receives expected values and never decides PASS or FAIL. Unknown semantics and missing methods fail explicitly with `UNKNOWN_ACTION`, `UNKNOWN_OBSERVATION`, or `DRIVER_NOT_IMPLEMENTED`.

## 7. AI and Human Boundaries

AI may:

- propose Test IR;
- explain requirements;
- suggest missing cases;
- revise an unapproved case at a person's request.

AI must not:

- approve or freeze a case;
- alter a frozen asset;
- compile runtime source outside deterministic templates;
- choose which tests to run;
- read actual values and decide verdicts;
- skip failures or fabricate evidence.

People approve each case and the final frozen asset. Frozen Test IR, generated source hashes, and native Playwright reports are the primary auditable artifacts.

## 8. Demonstration

The repository includes a synthetic Card Loss PRD, recorded AI proposal, independent GUI application, existing Playwright host example, and prebuilt GUI Driver.

The one-command demo shows two phases:

1. **Before GUI:** review, freeze, compile, and discover native tests. The status is `COMPILED / NOT_EVALUATED`; the target GUI is not running.
2. **After GUI:** start the independent application and execute the unchanged generated source through the host Playwright Runner.

The example proves that one existing API test and seven generated GUI tests are discovered and executed together. The generated source hash remains unchanged between phases.

## 9. Portability, Security, and Release Gates

- Node.js 22 or later.
- Windows, Linux, and macOS CI.
- Paths resolve relative to the integration config and generated imports use portable separators.
- Secrets, personal paths, runtime data, and private AI endpoints are excluded from the repository.
- AI credentials never enter compiler or execution modules.
- A missing Driver or unavailable target cannot produce PASS.
- Unit, integration, real-browser host, Studio E2E, clean-install, documentation, and public audit checks must pass before release.

## 10. Repository Shape

```text
apps/studio/                       optional authoring workbench
packages/ir/                       Test IR validation and hashing
packages/workflow/                 approval and freeze lifecycle
packages/compiler-playwright/      native spec generation
packages/integration-playwright/   host config, compile, and check APIs
packages/driver-contract/          Driver boundary and errors
examples/existing-playwright/      real host integration example
examples/card-loss/                independent synthetic target application
```

The legacy internal runner is retained only for compatibility and is not the public integration route.
