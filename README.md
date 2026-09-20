# GUI TestForge

[English](README.md) | [简体中文](README.zh-CN.md)

GUI TestForge addresses two problems:

1. How to generate all GUI test scripts from test cases before GUI development is complete.
2. In serious commercial environments, how to ensure test scripts are generated and executed without AI, eliminating AI-related risks such as skipping test cases, fabricating test results, or temporarily modifying test scripts to accommodate incorrect application code.

It compiles human-approved semantic Test IR into native Playwright specs and writes them into the host project's existing `testDir`. The host keeps its Playwright config, fixtures, projects, reporters, retries, traces, CI, and normal `playwright test` command.

![GUI TestForge native Playwright report](docs/assets/demo-workflow.png)

[Watch the real end-to-end demo](docs/assets/demo-workflow.webm)

## Five-Minute Demo

Prerequisite: Node.js 22 or later.

```bash
git clone https://github.com/jialynmattus28-lang/gui-testforge.git
cd gui-testforge
npm run demo
```

Follow the six stages in the browser. Completing a stage automatically opens the next one, while every completed stage keeps a manual Next action. The target Card Loss GUI is deliberately not started during requirements, Test IR review, freezing, compilation, or Playwright discovery.

After compilation, **Run and Trace** remains blocked until a target application URL and GUI Driver are supplied. For the repository walkthrough, select **Use bundled demo** to load the prebuilt handoff inputs, then run the unchanged compiled tests.

The pre-GUI milestone is shown as `COMPILED / NOT_EVALUATED`: native scripts exist and Playwright can discover them, but no test result has been claimed.

The offline demo needs no API key. Its recorded AI proposal, application, and GUI Driver are prebuilt and inspectable; the validation, approval, freezing, native compilation, Playwright discovery, execution, and report are real.

## Add It to an Existing Playwright Project

Add a frozen Test IR asset, a project-owned GUI Driver, and one configuration file:

```javascript
// testforge.config.mjs
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

Compile before a GUI or URL exists, then use the host runner:

```bash
npm run testforge -- compile --config testforge.config.mjs
npm run testforge -- check --config testforge.config.mjs
npx playwright test --list
npx playwright test
```

The first three commands work before the target application exists. Actual execution must fail or remain `NOT_EVALUATED` until the GUI Driver and target are ready; it can never produce a false pass.

See the runnable [existing Playwright project example](examples/existing-playwright/README.md).

## Why Test IR

Test IR freezes business actions, data, and assertions without CSS selectors, XPath, coordinates, URLs, or Playwright calls. When the GUI arrives, development maps those semantics to real controls in the GUI Driver. The frozen asset and generated spec remain unchanged unless the business intent changes.

## Trust Boundary

- **AI may propose:** AI output is an untrusted design draft.
- **People approve:** every accepted case is reviewed and hash-bound before freezing.
- **The compiler is deterministic:** identical frozen input and config produce identical native specs.
- **Playwright decides:** execution, actual observations, assertions, reports, and verdicts contain no AI decision-making.

Start with the concise [User Guide](docs/USER_GUIDE.md). Read [Compiler Integration](docs/COMPILER.md), [GUI Driver](docs/GUI_DRIVER.md), or the [Design Specification](docs/superpowers/specs/2026-09-20-existing-playwright-integration-design.md) for details. Use [Support](SUPPORT.md) to choose the correct public help channel.

## Status

Playwright integration is implemented and validated against a real existing Playwright repository pattern. Selenium remains a future compiler target and is disabled in the UI.

## License

Apache License 2.0. See [LICENSE](LICENSE).

Copyright 2026 吴笛（Dean Wu）.
