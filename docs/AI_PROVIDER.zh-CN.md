# AI Provider 扩展说明

[English](AI_PROVIDER.md) | [简体中文](AI_PROVIDER.zh-CN.md)

AI 是可选能力，并且只允许用于测试设计区。Provider 输出始终被视为不可信输入，必须先通过确定性的 Test IR 校验，才能由人类决定是否采用。

第一阶段包含：

- 用于离线 Demo 的 `ReplayProvider`，不会发起模型网络请求。
- 使用用户提供的 Base URL、API Key 和 Model 配置的 `OpenAICompatibleProvider`。

```javascript
{
  async healthCheck(signal) {},
  async generateTestIR(request, signal) {},
  async reviewTestIR(request, signal) {},
  async refineTestIR(request, signal) {},
}
```

执行 `npm run configure-ai` 可创建被 Git 忽略的本地配置。API Key 只保留在可选测试设计服务中，不出现在浏览器响应中，也不会成为编译或宿主 Playwright 执行的输入。

增加新 Provider 前，请先阅读[设计规格](superpowers/specs/2026-09-19-gui-testforge-open-source-design.zh-CN.md)。
