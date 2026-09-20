# 变更日志

[English](CHANGELOG.md) | [简体中文](CHANGELOG.zh-CN.md)

本文件记录项目的重要变更。格式遵循 Keep a Changelog 和语义化版本。

## [未发布]

### 新增

- 完成步骤后自动前进，同时保留手工“下一步”。
- 人工 Test IR 审核的确定性“审批所有”操作。
- 执行前必须校验被测 URL 和 GUI Driver 的明确准入控制。
- 面向 Discussions、Issues 和私密漏洞报告的中英文支持说明。
- 面向现有宿主项目的原生 Playwright 预编译器。
- 所有路径相对配置文件解析的 `compile`、`check` 命令行和程序接口。
- 项目自定义语义动作、观察项及冻结语义契约。
- 使用现有 Playwright Fixture 的宿主式 GUI Driver 契约。
- 可运行的现有 Playwright 示例，包含自定义 Fixture、原有 API 用例、生成 GUI 用例和原生报告。
- 两阶段 Demo：GUI 启动前编译并发现用例，GUI 可用后运行同一份未修改的生成源码。
- 人工审核并与内容哈希绑定的 Test IR 工作流。
- 可选 OpenAI-compatible 提案 Provider 和离线录制提案。
- 全英文界面及成对的英文和简体中文文档。

### 变更

- GUI TestForge 从独立测试执行器重新定位为现有 Playwright 框架的接入层。
- 公开执行路径改用宿主 Playwright Runner；原内部执行器只保留兼容用途。
