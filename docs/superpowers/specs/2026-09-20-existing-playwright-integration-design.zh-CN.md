# 现有 Playwright 框架集成设计

[English](2026-09-20-existing-playwright-integration-design.md) | [简体中文](2026-09-20-existing-playwright-integration-design.zh-CN.md)

**日期：** 2026-09-20
**状态：** 已批准实施
**主要用户：** 已有完整 Playwright Test 框架，但在被测程序交付前无法完成 GUI 自动化脚本的团队。

## 1. 产品定位

GUI TestForge 是现有 Playwright 项目的 GUI 前置编译器。它不替代 Playwright Test，不引入第二套 Runner，也不要求用户迁移测试平台。它在 URL、选择器和最终页面结构出现前，将人工审批后的语义 GUI 用例编译为原生 Playwright `.spec.ts` 或 `.spec.mjs` 文件。

生成脚本保存稳定的业务流程、测试数据和断言。项目专属 GUI Driver 在界面交付后实现，把语义动作和观察项映射到真实界面。补充映射时，冻结的 Test IR 和已生成测试文件保持不变。

## 2. 已验证的集成模式

该集成模式已经在微软公开仓库 `microsoft/playwright-examples` 的提交 `4eb82aedf58321da90332e5f7316b64d5914a6b1` 上完成验证：

- 接入前，仓库原有 3 条时钟测试通过。
- 不修改原 `playwright.config.ts`、包文件和原测试，即可发现新生成的原生 Playwright 文件。
- Driver 未实现时明确报错 `DRIVER_NOT_IMPLEMENTED`。
- 只实现 Driver 后，原有 3 条和新增 2 条测试共同通过。
- Driver 实现前后，生成源码哈希保持不变。
- 原始配置自动在 Chromium、Firefox 和 WebKit 项目中发现生成用例。

因此，第一期正式采用“预先生成到用户现有 `testDir`”的集成模式。

## 3. 集成契约

用户项目增加：

```text
testforge.config.mjs
testforge/
  frozen/*.json
  gui-driver.mjs
tests/
  generated/testforge/*.spec.mjs
```

用户执行：

```bash
testforge compile
playwright test
```

编译配置声明：

```javascript
export default {
  frozenAsset: './testforge/frozen/card-loss.json',
  outputDir: './tests/generated/testforge',
  testModule: '../../fixtures/test.mjs',
  driverModule: '../../../testforge/gui-driver.mjs',
  fileExtension: '.spec.mjs',
};
```

`testModule` 指向用户项目原有的 `test` 和 `expect` 导出，也可以使用 `@playwright/test`。`driverModule` 会写入生成脚本的导入语句，但编译阶段绝不会加载它。

如果输出目录本来就在用户的 `testDir` 内，则不需要修改 Playwright 配置。浏览器项目、重试、Fixture、Reporter、登录状态、Trace、截图、分片和 CI 继续由用户框架管理。

## 4. GUI 前后两个阶段

### 被测程序出现前

用户可以完成：

- 导入或编写测试用例；
- 审核并冻结 Test IR；
- 编译原生 Playwright 文件；
- 校验确定性哈希；
- 对生成文件做类型检查；
- 执行 `playwright test --list`；
- 审查生成的 Driver 契约。

这些工作不需要目标 URL、选择器、DOM 快照或运行中的被测程序。Driver 未完成时运行 GUI 用例，必须失败或显示未评价，绝不能通过回放证据或模型判断产生假通过。

### 被测程序出现后

开发人员只实现 GUI Driver。冻结的 Test IR 和生成文件不变。用户仍执行原来的 `playwright test`，继续获得 Playwright 原生报告、Trace、截图、重试和项目展开能力。

## 5. 通用语义 Test IR

Test IR 不再使用银行业务专属的全局白名单。动作名和观察目标由项目定义，核心只校验其为非空、可移植的稳定标识符，并要求每个步骤至少包含一个断言。

冻结时确定性地提取排序后的动作名和观察目标，形成语义契约。编译器在 manifest 中记录契约哈希。Driver 缺少动作或观察能力时必须明确失败。

Test IR 不包含选择器、坐标、URL、Playwright 调用或任意源码。生成代码只来自编译器模板和结构化数据序列化。

## 6. 原生 Playwright 编译器

编译器输出：

- 一份原生 Playwright spec；
- 包含资产、编译器、源码和语义契约哈希的 manifest；
- Driver 契约说明；
- 准确的 Playwright 发现与执行命令。

生成 spec：

- 从 `testModule` 导入 `test` 和 `expect`；
- 从 `driverModule` 导入 `createDriver`；
- 每条审批通过的 Test IR 生成一条 Playwright test；
- 将语义动作生成为 `test.step`；
- 使用确定性深度相等比较 Driver 实际观察值与冻结预期值；
- 在 `finally` 中关闭 Driver；
- 不导入 AI 模块，也不接收 AI 凭据。

相同冻结资产和编译配置在各支持操作系统上必须生成字节完全一致的输出。

## 7. GUI Driver 契约

```javascript
export async function createDriver({ page, context, request, caseId, fixture }) {
  return {
    async act(action) {},
    async observe(query) {},
    async close() {},
  };
}
```

Driver 接收用户 Playwright Fixture 和语义输入，但绝不接收预期断言值。它只上报真实观察结果，不能审批、跳过或重写用例。

编译器通过可配置 Fixture 参数支持用户已有 Fixture。第一期必须支持 `page`，其他 Fixture 名可以透传，TestForge 不定义也不替换它们。

## 8. CLI 与库边界

第一期提供确定性的 Node 库和轻量 CLI：

```text
testforge compile --config testforge.config.mjs
testforge check --config testforge.config.mjs
```

`compile` 校验冻结资产并写入原生 spec。`check` 校验路径、配置、生成哈希和 Driver 模块形状，但不启动浏览器。库函数也可以由现有测试平台直接调用，不必启动 CLI 子进程。

可发布的集成包把 Playwright 声明为 peer dependency，不能在用户框架中再安装或捆绑第二套 Playwright。

## 9. Demo 重构

仓库提供 `examples/existing-playwright` 示例宿主项目，包含自身的配置、Fixture、Reporter 设置、API 测试和 GUI 测试目录。

Demo 明确展示两个阶段：

1. **GUI 出现前：** 冻结并编译用例，展示原生生成源码和稳定哈希，证明宿主 Playwright Runner 能发现测试。界面标记为 `COMPILED / NOT_EVALUATED`。
2. **GUI 出现后：** 启动独立银行卡挂失应用，使用预制真实 Driver，通过宿主 Playwright Runner 执行未改动的生成 spec。界面提供 Playwright 原生报告和 Trace 证据入口。

Demo 必须展示宿主配置没有被替换，原有测试和生成测试能够共同执行。旧自定义 Runner 仅作为内部兼容组件暂时保留；当所有界面执行入口都切换到原生 Playwright 后，在后续清理中删除。

## 10. 兼容性与失败规则

- 使用用户项目已经安装的 Playwright 版本。
- 测试支持的版本范围，不固定第二套运行时。
- 所有相对路径以 TestForge 配置文件所在目录为基准。
- 通过显式配置路径和工作目录支持普通仓库及 monorepo。
- Driver 缺失：`DRIVER_NOT_IMPLEMENTED` 或 `NOT_EVALUATED`，绝不能是 `PASS`。
- 未知动作或观察项：明确指出标识符并失败。
- 资产或生成源码被篡改：阻止编译或执行。
- 用户 Fixture 导入失败：检查阶段显示无法解析的模块路径。
- `compile` 和 `check` 不需要应用 URL。

## 11. 验收标准

- 标准 Playwright 项目不替换配置和 Runner 即可完成接入。
- 生成测试继承用户项目、Fixture、Reporter、重试和 CI 行为。
- 编译不需要应用 URL、Driver 实现、浏览器启动或模型调用。
- 应用出现前，`playwright test --list` 能发现生成用例。
- 未完成 Driver 不能产生 GUI 测试通过结果。
- 只实现 Driver 后，同一批生成文件可以直接测试真实 GUI。
- Driver 实现前后，生成源码哈希保持不变。
- 内置 Demo 使用原生 Playwright Runner 证明两个阶段。
- Windows、Linux 和 macOS 上的单元、集成、外部宿主兼容、干净安装和公开发布测试全部通过。
