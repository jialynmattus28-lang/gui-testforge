# Existing Playwright Integration Design

[English](2026-09-20-existing-playwright-integration-design.md) | [简体中文](2026-09-20-existing-playwright-integration-design.zh-CN.md)

**Date:** 2026-09-20
**Status:** Approved for implementation
**Primary user:** A team with an established Playwright Test framework that cannot finish GUI automation scripts before the tested application exists.

## 1. Product Position

GUI TestForge is a pre-GUI compiler for existing Playwright projects. It does not replace Playwright Test, introduce a second runner, or require a new test platform. It converts human-approved semantic GUI cases into native Playwright `.spec.ts` or `.spec.mjs` files before URLs, selectors, and final page structure are available.

The generated tests keep stable business flow, data, and assertions. A project-specific GUI Driver is implemented later to map semantic actions and observations to the delivered interface. The frozen Test IR and generated test files do not change when that mapping is added.

## 2. Validated Integration Pattern

The integration pattern was proven against commit `4eb82aedf58321da90332e5f7316b64d5914a6b1` of Microsoft's public `microsoft/playwright-examples` repository:

- The repository's original three clock tests passed before integration.
- A generated native Playwright file was discovered without changing its original `playwright.config.ts`, package files, or tests.
- An unimplemented Driver failed explicitly with `DRIVER_NOT_IMPLEMENTED`.
- Implementing only the Driver made the original three and generated two tests pass together.
- The generated source hash remained unchanged before and after Driver implementation.
- The untouched original configuration discovered the generated tests in Chromium, Firefox, and WebKit projects.

This establishes pre-generation into the host `testDir` as the Phase 1 integration model.

## 3. Integration Contract

A host project adds:

```text
testforge.config.mjs
testforge/
  frozen/*.json
  gui-driver.mjs
tests/
  generated/testforge/*.spec.mjs
```

The host runs:

```bash
testforge compile
playwright test
```

The compiler configuration declares:

```javascript
export default {
  frozenAsset: './testforge/frozen/card-loss.json',
  outputDir: './tests/generated/testforge',
  testModule: '../../fixtures/test.mjs',
  driverModule: '../../../testforge/gui-driver.mjs',
  fileExtension: '.spec.mjs',
};
```

`testModule` points to the host project's existing export of `test` and `expect`. It may also be `@playwright/test`. `driverModule` is emitted as an import in generated tests but is never loaded during compilation.

If the output directory is already under the host `testDir`, the Playwright configuration does not need to change. Projects, browsers, retries, fixtures, reporters, authentication state, traces, screenshots, sharding, and CI remain owned by the host.

## 4. Pre-GUI and Post-GUI States

### Before the application exists

The user can:

- import or author test cases;
- review and freeze Test IR;
- compile native Playwright files;
- verify deterministic hashes;
- type-check generated files;
- run `playwright test --list`;
- review the generated Driver contract.

No target URL, selector, DOM snapshot, or running application is required. Running a generated GUI test with an incomplete Driver must fail or be reported as not evaluated. It must never pass through replayed evidence or a model-generated verdict.

### After the application exists

The developer implements only the GUI Driver. The frozen Test IR and generated files remain unchanged. The host executes its normal `playwright test` command and receives native Playwright reports, traces, screenshots, retries, and project expansion.

## 5. Generic Semantic IR

Test IR must not contain a global bank-specific allowlist. Action names and observation targets are project-defined stable identifiers. The core validates that they are non-empty portable identifiers and that every step has at least one assertion.

Freezing derives a deterministic semantic contract containing sorted unique action names and observation targets. The compiler embeds the contract hash in its manifest. Unsupported or missing Driver operations fail explicitly at runtime.

Test IR contains no selectors, coordinates, URLs, Playwright calls, or arbitrary source code. Generated source is created only from compiler templates and serialized structured data.

## 6. Native Playwright Compiler

The compiler emits:

- one native Playwright spec file;
- a manifest with asset, compiler, source, and semantic-contract hashes;
- a Driver contract description;
- the exact Playwright discovery and execution commands.

The generated spec:

- imports `test` and `expect` from `testModule`;
- imports `createDriver` from `driverModule`;
- declares one Playwright test per approved Test IR case;
- emits semantic actions as `test.step` entries;
- compares actual Driver observations with frozen expected values using deterministic deep equality;
- closes the Driver in `finally`;
- never imports an AI module or receives AI credentials.

The same frozen asset and compiler configuration produce byte-identical output across supported operating systems.

## 7. GUI Driver Contract

```javascript
export async function createDriver({ page, context, request, caseId, fixture }) {
  return {
    async act(action) {},
    async observe(query) {},
    async close() {},
  };
}
```

The Driver receives the host Playwright fixtures needed for execution and the semantic input. It never receives expected assertion values. It reports actual observations and cannot approve, skip, or rewrite cases.

The compiler must support host-defined fixtures by making the fixture arguments configurable. Phase 1 requires `page`; optional fixture names can be forwarded without requiring TestForge to define or replace them.

## 8. CLI and Library Boundary

Phase 1 provides a deterministic Node library and a thin CLI:

```text
testforge compile --config testforge.config.mjs
testforge check --config testforge.config.mjs
```

`compile` validates the frozen asset and writes native specs. `check` validates paths, configuration, generated hashes, and Driver module shape without launching a browser. The library functions remain callable by an existing platform without spawning the CLI.

Playwright is a peer dependency for the distributable integration package. TestForge must not install or bundle a second Playwright version into the host framework.

## 9. Demo Redesign

The repository ships an `examples/existing-playwright` host project with its own configuration, fixture, reporter settings, API test, and GUI test directory.

The demo has two observable phases:

1. **Before GUI:** freeze and compile cases, display the native generated source and stable hash, and prove that the host's Playwright runner discovers the tests. The UI labels the result `COMPILED / NOT_EVALUATED`.
2. **After GUI:** start the independent Card Loss application, use the prebuilt real Driver, and execute the unchanged generated specs through the host Playwright runner. The UI links to the native Playwright report and trace evidence.

The demo shows that the host configuration is not replaced and that existing and generated tests execute together. The former custom runner is retained only as an internal compatibility component until all UI execution routes use native Playwright, then removed in a later cleanup.

## 10. Compatibility and Failure Rules

- Use the host project's installed Playwright version.
- Test a supported version range rather than pinning a second runtime.
- Resolve all relative paths from the TestForge configuration file.
- Support ordinary repositories and monorepos through an explicit config path and working directory.
- Missing Driver: `DRIVER_NOT_IMPLEMENTED` or `NOT_EVALUATED`, never `PASS`.
- Unknown action or observation: hard failure naming the identifier.
- Tampered asset or generated source: compilation or execution blocked.
- Host fixture import failure: compilation check fails with the unresolved module path.
- No application URL is required by `compile` or `check`.

## 11. Acceptance Criteria

- A standard Playwright project integrates without replacing its config or runner.
- Generated tests inherit host projects, fixtures, reporters, retries, and CI behavior.
- Compilation works with no application URL, Driver implementation, browser launch, or model call.
- `playwright test --list` discovers generated cases before the application exists.
- Incomplete Drivers cannot yield passing GUI results.
- Implementing only the Driver makes the same generated files executable against the real GUI.
- Generated source hashes remain unchanged across Driver implementation.
- The bundled demo proves both phases using the native Playwright Runner.
- Unit, integration, external-host compatibility, clean-install, and public-release tests pass on Windows, Linux, and macOS.
