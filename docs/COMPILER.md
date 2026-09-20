# Playwright Precompiler Integration

[English](COMPILER.md) | [简体中文](COMPILER.zh-CN.md)

GUI TestForge is a precompiler, not a replacement runner. It reads a verified frozen Test IR asset and emits a native Playwright spec into the host project's existing `testDir`.

## Configuration

```javascript
export default {
  frozenAsset: './testforge/frozen/card-loss.json',
  outputDir: './tests/generated/testforge',
  testModule: './fixtures/test.mjs',
  driverModule: './testforge/gui-driver.mjs',
  playwrightConfig: './playwright.config.mjs',
  fileExtension: '.spec.mjs',
  fixtureNames: ['page', 'context', 'request'],
};
```

All relative paths resolve from the configuration file. `testModule` preserves the host's custom fixtures by importing its existing `test` and `expect`. `driverModule` is written as an import but is not loaded during compilation.

## Commands

```bash
npm run testforge -- compile --config testforge.config.mjs
npm run testforge -- check --config testforge.config.mjs
```

`compile` needs no URL, browser, DOM, model, or implemented Driver. It writes:

- `testforge.generated.spec.mjs` or the configured extension;
- `manifest.json` with asset, semantic-contract, config, and file hashes;
- `driver-contract.json` with required actions and observations;
- `test-cases.json` for compatibility tooling.

`check` verifies those hashes, the frozen asset, the host fixture module, and Driver readiness. A missing Driver is reported as `NOT_IMPLEMENTED`; tampering or an unresolved fixture module is a hard error.

## Native Host Execution

The generated file declares one Playwright `test()` per approved Test IR case and uses `test.step` plus the host's `expect`. It receives the configured fixtures, calls the GUI Driver, and compares actual observations with frozen expected values.

The host then runs its normal commands:

```bash
npx playwright test --list
npx playwright test
```

The host's projects, browsers, retries, sharding, reporters, authentication, traces, screenshots, and CI remain unchanged. A missing or incomplete Driver raises `DRIVER_NOT_IMPLEMENTED`; it cannot produce `PASS`.

The compiler and integration modules import no AI provider. The same frozen asset and configuration produce byte-identical generated source.

See the runnable [existing Playwright example](../examples/existing-playwright/README.md) and the [Design Specification](superpowers/specs/2026-09-20-existing-playwright-integration-design.md).
