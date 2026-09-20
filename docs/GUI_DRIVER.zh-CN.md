# GUI Driver 接入说明

[English](GUI_DRIVER.md) | [简体中文](GUI_DRIVER.zh-CN.md)

GUI Driver 是稳定 Test IR 语义与已经交付 GUI 之间的一层轻量、应用专属适配器。一个应用通常维护一个 Driver 模块，并随语义契约扩展；不需要为每条用例重新写一个 Driver。

```javascript
export async function createDriver({ page, context, request, caseId, fixture }) {
  return {
    async act(action) {},
    async observe(query) {},
    async close() {},
  };
}
```

## 映射示例

```javascript
export async function createDriver({ page, request, fixture }) {
  await request.post('/api/test/reset', { data: fixture });
  await page.goto('/');

  return {
    async act(action) {
      switch (action.name) {
        case 'card.select':
          await page.getByTestId(`card-${action.args.cardId}`).click();
          return;
        default:
          throw new Error(`UNKNOWN_ACTION: ${action.name}`);
      }
    },
    async observe(query) {
      switch (query.target) {
        case 'card.status':
          return page.getByTestId(`card-${query.args.cardId}`).getAttribute('data-status');
        default:
          throw new Error(`UNKNOWN_OBSERVATION: ${query.target}`);
      }
    },
    async close() {},
  };
}
```

## 边界规则

- Driver 负责 Selector、等待、导航、测试数据准备和实际状态读取。
- Driver 接收语义动作、观察查询和 Fixture 数据。
- Driver 永远不接收预期断言值，也不决定 PASS 或 FAIL。
- 未知动作和观察项必须明确失败。
- 缺少必要方法时必须返回 `DRIVER_NOT_IMPLEMENTED`。
- Driver 必须读取真实 UI 或正式测试接口，不能复制业务状态机来制造通过结果。

控件 ID 或页面结构变化时，只修改 Driver。业务意图变化时，才修改并重新审批 Test IR、冻结新资产并重新编译。

可运行的宿主式示例位于 [`examples/existing-playwright/testforge/gui-driver.mjs`](../examples/existing-playwright/testforge/gui-driver.mjs)。完整规则见[设计规格](superpowers/specs/2026-09-20-existing-playwright-integration-design.zh-CN.md)。
