# 架构概览

[English](README.md) | [简体中文](README.zh-CN.md)

GUI TestForge 是位于现有 Playwright 项目旁边的测试设计和预编译层。

```text
需求 -> Test IR 提案 -> 人工审批 -> 冻结资产
                                  |
                                  v
现有 Playwright 项目 <- 原生 spec <- 确定性编译器
          |
          +-- 原有配置、Fixture、Project、Reporter、CI
          +-- 应用专属 GUI Driver
          +-- 原有 playwright test 命令
```

## 信任区域

1. **提案区：** 可选 AI Adapter 可以提出或修改 Test IR，输出不受信任。
2. **治理区：** Workflow 和 IR 模块校验内容，把审批与精确用例哈希绑定，并冻结已批准资产。
3. **确定性接入区：** 编译器和接入模块在没有 AI、目标 URL 和浏览器执行的情况下生成并校验原生 Playwright 文件。
4. **宿主执行区：** 使用方自己的 Playwright Runner 加载生成 spec 和 GUI Driver，读取实际状态、执行断言并生成原生报告。

## 依赖方向

- AI Adapter 依赖 Provider 边界和 IR 校验。
- Workflow 依赖 IR 校验与哈希。
- 编译器只依赖冻结 IR 和确定性模板。
- 接入层依赖编译器和文件系统校验。
- 生成测试依赖宿主 Fixture 模块和 GUI Driver。
- 被测应用不依赖 GUI TestForge。

旧的内部执行器只为兼容测试保留，不再是公开接入路径。新的接入方式把 spec 编译到宿主 `testDir`，并使用宿主原来的 Playwright Runner。

详细内容见[现有 Playwright 接入设计](../superpowers/specs/2026-09-20-existing-playwright-integration-design.zh-CN.md)和 [`adr/`](adr/) 下的架构决策记录。
