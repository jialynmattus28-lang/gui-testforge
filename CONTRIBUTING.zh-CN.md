# 参与 GUI TestForge 贡献

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

感谢参与贡献。请保持修改范围清晰，并维护信任边界：AI Adapter 可以提出 Test IR 建议，但编译器、接入层、生成测试和宿主执行阶段不得导入 AI 代码，也不得接收 AI 凭据。

## 开发环境

1. 安装 Node.js 22 或更高版本。
2. 执行 `npm install`。
3. 执行 `npx playwright install chromium`。
4. 执行 `npm test`。
5. 执行 `npm run test:demo` 验证真实浏览器闭环。
6. 执行 `npm run test:host` 验证现有 Playwright 项目兼容性。

修改行为、安装方式、架构或公开 API 时，必须在同一个 Pull Request 中同步更新英文和简体中文文档。先写测试再实现，并确保 Test IR 不包含 Selector 或框架调用。

增加 Provider、编译器、宿主接入或 GUI Driver 前，请先阅读设计规格和 `docs/` 下的扩展说明。不要再引入第二套公开 Runner，生成测试必须继续使用宿主 Playwright Runner。
