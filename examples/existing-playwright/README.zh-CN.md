# 现有 Playwright 项目示例

[English](README.md) | [简体中文](README.zh-CN.md)

此目录模拟一套由使用方维护的 Playwright 项目，保留自己的配置、自定义 Fixture、Reporter 和一条已有 API 用例。

GUI 尚未出现时：

```bash
npm run testforge -- compile --config examples/existing-playwright/testforge.config.mjs
npx playwright test --config examples/existing-playwright/playwright.config.mjs --list
```

这会在没有 URL 和运行中应用的情况下，编译并发现七条原生 GUI 测试。Driver 和被测目标就绪前，这些测试保持 `NOT_EVALUATED`。

GUI 出现后，设置 `GUI_TESTFORGE_BASE_URL`，实现 `testforge/gui-driver.mjs`，再使用宿主项目原来的命令：

```bash
npx playwright test --config examples/existing-playwright/playwright.config.mjs
```

原有 API 用例与 TestForge 生成的 GUI 用例会一起运行。TestForge 不替换本项目的 Playwright 配置和 Runner。
