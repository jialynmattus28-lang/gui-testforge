# GUI TestForge User Guide

[English](USER_GUIDE.md) | [简体中文](USER_GUIDE.zh-CN.md)

## Purpose

GUI TestForge helps an existing Playwright team finish native GUI test scripts before the tested GUI is available. It does not replace the team's Playwright framework.

The stable flow is:

1. Requirements define business behavior.
2. Test IR records semantic actions and assertions without GUI implementation details.
3. People review and freeze every accepted case.
4. The deterministic compiler writes native specs into the existing Playwright `testDir`.
5. Playwright can discover those specs immediately.
6. When the GUI exists, development implements only the GUI Driver and runs the normal Playwright command.

## Try the Demo

Install Node.js 22 or later and run:

```bash
npm run demo
```

Use the six stages in the workbench. Successful completion automatically opens the next stage; a completed stage also keeps a manual Next action. At **Compile**, confirm the status `COMPILED / NOT_EVALUATED`: the existing host project has discovered the generated tests, but no GUI test has been executed.

At **Run and Trace**, execution remains disabled until both the target application URL and GUI Driver are validated. Select **Use bundled demo** for the repository walkthrough. This explicit handoff starts no GUI by itself; the independent application starts only when the native Playwright run begins.

## Integrate With Your Project

Create `testforge.config.mjs` in the host project. Point `testModule` to the module that already exports your customized `test` and `expect`; point `outputDir` inside the existing `testDir`.

```bash
npm run testforge -- compile --config testforge.config.mjs
npm run testforge -- check --config testforge.config.mjs
npx playwright test --list
```

No target URL, browser launch, final DOM, or working Driver is required for compilation and discovery. `check` verifies the frozen asset, generated hashes, fixture module, and Driver readiness.

After the GUI exists, implement `createDriver`, provide the target application URL, keep the frozen asset and generated spec unchanged, and run the host project's normal command:

```bash
npx playwright test
```

## Ownership

- Test design owns requirements, Test IR, human approval, and the frozen asset.
- Application development owns selectors and interactions inside the GUI Driver.
- The existing Playwright project owns fixtures, projects, reporters, CI, browser settings, and execution.
- AI may assist before freezing, but cannot participate in compilation, execution, assertions, evidence, or verdicts.

Read [Compiler Integration](COMPILER.md), [GUI Driver](GUI_DRIVER.md), and the [Design Specification](superpowers/specs/2026-09-20-existing-playwright-integration-design.md) for details.
