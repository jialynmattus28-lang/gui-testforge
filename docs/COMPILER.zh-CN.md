# Playwright 预编译器接入

[English](COMPILER.md) | [简体中文](COMPILER.zh-CN.md)

GUI TestForge 是预编译器，不是替代 Runner。它读取通过校验的冻结 Test IR，把原生 Playwright spec 输出到宿主项目现有的 `testDir`。

## 配置

```javascript
export default {
  frozenAsset: './testforge/frozen/card-loss.json',
  outputDir: './tests/generated/testforge',
  testModule: './fixtures/test.mjs',
  driverModule: './testforge/gui-driver.mjs',
  playwrightConfig: './playwright.config.mjs',
  fileExtension: '.spec.mjs',
  fixtureNames: ['page', 'context', 'request'],
};
```

所有相对路径都以配置文件所在目录为基准。`testModule` 导入宿主现有的 `test` 和 `expect`，因此可以保留自定义 Fixture。`driverModule` 只会写入生成文件，编译时不会加载。

## 命令

```bash
npm run testforge -- compile --config testforge.config.mjs
npm run testforge -- check --config testforge.config.mjs
```

`compile` 不需要 URL、浏览器、DOM、模型或已经实现的 Driver。它输出：

- `testforge.generated.spec.mjs` 或配置的其他扩展名；
- 包含资产、语义契约、配置和文件哈希的 `manifest.json`；
- 描述动作和观察项要求的 `driver-contract.json`；
- 供兼容工具使用的 `test-cases.json`。

`check` 校验上述哈希、冻结资产、宿主 Fixture 模块和 Driver 就绪状态。Driver 缺失时报告 `NOT_IMPLEMENTED`；文件被篡改或 Fixture 模块无法解析时直接失败。

## 使用宿主原生执行

生成文件为每条已审批 Test IR 声明一个 Playwright `test()`，并使用 `test.step` 和宿主的 `expect`。它接收配置的 Fixture，调用 GUI Driver，再把实际观察值与冻结预期值比较。

宿主继续运行原来的命令：

```bash
npx playwright test --list
npx playwright test
```

宿主的 Project、浏览器、重试、分片、Reporter、认证、Trace、截图和 CI 都保持不变。Driver 缺失或不完整时会抛出 `DRIVER_NOT_IMPLEMENTED`，不可能产生 `PASS`。

编译器和接入模块不导入任何 AI Provider。相同冻结资产和配置必须生成字节完全一致的源文件。

参见可运行的[现有 Playwright 示例](../examples/existing-playwright/README.md)和[设计规格](superpowers/specs/2026-09-20-existing-playwright-integration-design.zh-CN.md)。
