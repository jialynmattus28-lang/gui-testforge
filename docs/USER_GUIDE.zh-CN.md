# GUI TestForge 用户指南

[English](USER_GUIDE.md) | [简体中文](USER_GUIDE.zh-CN.md)

## 工具作用

GUI TestForge 帮助已经使用 Playwright 的团队，在被测 GUI 尚未提供时提前完成原生 GUI 测试脚本。它不替换使用方现有的 Playwright 框架。

固定流程如下：

1. 需求定义业务行为。
2. Test IR 记录不包含界面实现细节的语义动作和断言。
3. 人工逐条审核并冻结采用的用例。
4. 确定性编译器把原生 spec 写入现有 Playwright 的 `testDir`。
5. Playwright 可以立即发现这些 spec。
6. GUI 完成后，开发方只实现 GUI Driver，再运行原来的 Playwright 命令。

## 体验 Demo

安装 Node.js 22 或更高版本，然后执行：

```bash
npm run demo
```

按工作台中的六个阶段操作。当前步骤成功完成后会自动进入下一步，已经完成的页面也保留手工“下一步”。在 **Compile** 阶段确认状态为 `COMPILED / NOT_EVALUATED`：现有宿主项目已经发现生成用例，但尚未执行 GUI 测试。

进入 **Run and Trace** 后，只有被测程序 URL 和 GUI Driver 都通过校验，运行按钮才会启用。体验仓库 Demo 时请明确点击 **Use bundled demo**。这个交接动作本身不会启动 GUI；只有开始原生 Playwright 执行时，独立被测程序才会启动。

## 接入自己的项目

在宿主项目中创建 `testforge.config.mjs`。`testModule` 指向项目中现有的自定义 `test` 和 `expect` 导出模块，`outputDir` 放在现有 `testDir` 内。

```bash
npm run testforge -- compile --config testforge.config.mjs
npm run testforge -- check --config testforge.config.mjs
npx playwright test --list
```

编译和发现不需要目标 URL、浏览器启动、最终 DOM 或已经实现的 Driver。`check` 会检查冻结资产、生成文件哈希、Fixture 模块和 Driver 就绪状态。

GUI 完成后，实现 `createDriver`、提供被测程序 URL，保持冻结资产和生成 spec 不变，再执行宿主项目原来的命令：

```bash
npx playwright test
```

## 职责划分

- 测试设计方负责需求、Test IR、人工审批和冻结资产。
- 应用开发方负责 GUI Driver 中的定位器和真实交互。
- 现有 Playwright 项目负责 Fixture、Project、Reporter、CI、浏览器设置和执行。
- AI 可以在冻结前辅助设计，但不能参与编译、执行、断言、证据或结果判定。

详细内容见[编译器接入](COMPILER.zh-CN.md)、[GUI Driver](GUI_DRIVER.zh-CN.md)和[设计规格](superpowers/specs/2026-09-20-existing-playwright-integration-design.zh-CN.md)。
