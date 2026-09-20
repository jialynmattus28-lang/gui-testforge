# GUI Driver Integration

[English](GUI_DRIVER.md) | [简体中文](GUI_DRIVER.zh-CN.md)

The GUI Driver is a thin, application-specific adapter between stable Test IR semantics and the delivered GUI. One application usually has one Driver module that grows with its semantic contract; it is not rewritten for every case.

```javascript
export async function createDriver({ page, context, request, caseId, fixture }) {
  return {
    async act(action) {},
    async observe(query) {},
    async close() {},
  };
}
```

## Mapping Example

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

## Boundary Rules

- The Driver owns selectors, waits, navigation, test-data setup, and reading actual state.
- The Driver receives semantic actions, observation queries, and fixture data.
- The Driver never receives expected assertion values and never decides PASS or FAIL.
- Unknown actions and observations fail explicitly.
- Missing methods fail with `DRIVER_NOT_IMPLEMENTED`.
- The Driver must read the real UI or documented test interfaces; it must not recreate the business state machine to manufacture passing values.

When control IDs or page structure change, update only the Driver. When business intent changes, update and reapprove Test IR, freeze a new asset, and recompile.

See the working host-style example at [`examples/existing-playwright/testforge/gui-driver.mjs`](../examples/existing-playwright/testforge/gui-driver.mjs) and the [Design Specification](superpowers/specs/2026-09-20-existing-playwright-integration-design.md).
