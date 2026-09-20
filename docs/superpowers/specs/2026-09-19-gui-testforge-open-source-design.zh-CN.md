# GUI TestForge 开源设计规格

[English](2026-09-19-gui-testforge-open-source-design.md) | [简体中文](2026-09-19-gui-testforge-open-source-design.zh-CN.md)

**状态：** 已按“接入现有 Playwright 项目”的方向更新

**详细接入契约：** [现有 Playwright 接入设计](2026-09-20-existing-playwright-integration-design.zh-CN.md)

## 1. 产品定义

GUI TestForge 是面向已经使用 Playwright 团队的“需求到原生测试脚本”预编译器。

它让团队在被测 GUI、URL、Selector 和最终 DOM 尚未出现时，提前完成可执行 GUI 测试脚本。它不替换宿主 Playwright 配置和 Runner。

产品有两个核心保证：

1. 经人工审批的语义测试可以在 GUI 出现前编译成原生 Playwright spec。
2. 编译、执行、断言、报告和结果判定过程中没有 AI 决策。

## 2. 用户前提与范围

主要使用方已经具备：

- 可正常工作的 Playwright Test 项目；
- 项目配置、Fixture、Reporter、CI 和浏览器设置；
- 已有接口和 GUI 测试；
- 能发现和执行 Playwright spec 的正常命令。

GUI TestForge 只补充原框架缺少的“GUI 前置阶段”：

- 需求分析和可选 AI 提案；
- 人工审核和审批；
- 冻结 Test IR；
- 确定性的原生 Playwright 编译；
- GUI 到位后由开发方实现的 GUI Driver 契约。

Selenium 是后续编译目标。在具备等价编译器、Driver 契约、示例和一致性测试前，界面中保持禁用。

## 3. 完整流程

1. 导入已经评审的产品需求。
2. 通过人工、其他工具或可选 AI Provider 创建 Test IR 提案。
3. 校验结构，并识别未覆盖的需求。
4. 人工逐条批准、修改或拒绝。
5. 冻结已批准用例及其精确哈希，形成正式测试资产。
6. 把冻结资产编译成宿主 `testDir` 内的原生 Playwright spec。
7. 在 GUI 不存在时运行 `playwright test --list`。
8. 应用交付后，只实现 GUI Driver。
9. 运行宿主项目原来的 `playwright test` 命令。
10. 使用原生 Playwright 报告、Trace、截图、Project、重试和 CI。

## 4. Test IR

Test IR 是与执行框架无关的结构化数据，包含：

- 稳定用例 ID 和标题；
- 需求引用；
- Fixture 数据；
- 语义动作及参数；
- 语义观察项和冻结预期值；
- 预期业务结果。

Test IR 不得包含 Selector、坐标、URL、任意源代码、Playwright 调用或 Selenium 调用。

动作和观察项是项目自定义的可移植标识符。冻结时自动生成排序且去重的语义契约，使 Driver 义务明确并可计算哈希。

审批与用例精确哈希绑定。修改用例会使审批失效。在所有提案都有人工决定前，不能冻结。

## 5. 原生 Playwright 接入

宿主项目增加：

```text
testforge.config.mjs
testforge/
  frozen/*.json
  gui-driver.mjs
tests/
  generated/testforge/*.spec.mjs
```

确定性接入命令为：

```bash
testforge compile --config testforge.config.mjs
testforge check --config testforge.config.mjs
playwright test --list
playwright test
```

生成 spec 从宿主指定的 Fixture 模块导入 `test` 和 `expect`。它为每条已批准 Test IR 声明一个原生 Playwright 测试，使用 `test.step`，调用 GUI Driver，并以确定性深度相等规则执行断言。

编译器不导入 Playwright、Driver、AI Provider 或被测应用，不需要 URL，也不启动浏览器。

Manifest 记录冻结资产哈希、语义契约哈希、编译配置哈希和所有生成文件哈希。相同输入和配置必须生成字节完全一致的源文件。

## 6. GUI Driver

GUI Driver 是应用专属映射层：

```javascript
export async function createDriver({ page, context, request, caseId, fixture }) {
  return {
    async act(action) {},
    async observe(query) {},
    async close() {},
  };
}
```

它负责定位器、导航、等待和实际状态读取。它永远不接收预期值，也不决定 PASS 或 FAIL。未知语义和缺失方法必须明确返回 `UNKNOWN_ACTION`、`UNKNOWN_OBSERVATION` 或 `DRIVER_NOT_IMPLEMENTED`。

## 7. AI 与人工边界

AI 可以：

- 提出 Test IR；
- 解释需求；
- 建议遗漏用例；
- 按人工指令修改尚未审批的用例。

AI 不得：

- 审批或冻结用例；
- 修改冻结资产；
- 在确定性模板之外编译运行源码；
- 选择执行哪些测试；
- 读取实际值并决定结果；
- 跳过失败或伪造证据。

人工负责逐条审批和最终冻结。冻结 Test IR、生成源码哈希和原生 Playwright 报告是主要审计资产。

## 8. 演示

仓库提供虚拟银行卡挂失 PRD、录制 AI 提案、独立 GUI 应用、现有 Playwright 宿主示例和预制 GUI Driver。

一键 Demo 展示两个阶段：

1. **GUI 之前：** 审核、冻结、编译并发现原生测试。状态为 `COMPILED / NOT_EVALUATED`，被测 GUI 没有运行。
2. **GUI 之后：** 启动独立应用，通过宿主 Playwright Runner 执行同一份未修改的生成源码。

示例证明一条宿主已有 API 用例和七条生成 GUI 用例可以一起被发现和执行，两个阶段之间生成源码哈希不变。

## 9. 跨平台、安全与发布门禁

- Node.js 22 或更高版本。
- Windows、Linux 和 macOS CI。
- 路径相对接入配置解析，生成 import 使用可移植分隔符。
- 仓库排除密钥、个人路径、运行数据和私有 AI 地址。
- AI 凭据不进入编译器和执行模块。
- Driver 缺失或被测目标不可用时不能产生 PASS。
- 发布前必须通过单元、集成、真实浏览器宿主、Studio E2E、干净安装、文档和公开审计检查。

## 10. 仓库结构

```text
apps/studio/                       可选测试设计工作台
packages/ir/                       Test IR 校验和哈希
packages/workflow/                 审批和冻结生命周期
packages/compiler-playwright/      原生 spec 生成
packages/integration-playwright/   宿主配置、编译和检查接口
packages/driver-contract/          Driver 边界和错误
examples/existing-playwright/      真实宿主接入示例
examples/card-loss/                独立虚拟被测应用
```

旧内部执行器只为兼容性保留，不再是公开接入路径。
