# ADR 0002：AI 在冻结资产边界停止

[English](0002-ai-boundary.md) | [简体中文](0002-ai-boundary.zh-CN.md)

**状态：** 已接受

AI Adapter 可以分析需求，并提出或修改 Test IR 建议。所有审批和冻结决定由人类完成。编译器和接入层不导入 AI Adapter。生成测试、GUI Driver 和宿主 Playwright Runner 不接收 AI 凭据或模型会话。

这样可以防止模型静默重写断言、跳过用例、选择结果或伪造运行证据。
