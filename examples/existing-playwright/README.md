# Existing Playwright Project Example

[English](README.md) | [简体中文](README.zh-CN.md)

This directory behaves like a team-owned Playwright project. It keeps its own configuration, custom fixture, reporter, and existing API test.

Before the GUI exists:

```bash
npm run testforge -- compile --config examples/existing-playwright/testforge.config.mjs
npx playwright test --config examples/existing-playwright/playwright.config.mjs --list
```

This compiles and discovers seven native GUI tests without a URL or a running application. The tests are `NOT_EVALUATED` until the GUI Driver and target application are available.

After the GUI exists, set `GUI_TESTFORGE_BASE_URL`, implement `testforge/gui-driver.mjs`, and use the host project's normal command:

```bash
npx playwright test --config examples/existing-playwright/playwright.config.mjs
```

The existing API test and TestForge-generated GUI tests run together. TestForge does not replace this project's Playwright configuration or runner.
