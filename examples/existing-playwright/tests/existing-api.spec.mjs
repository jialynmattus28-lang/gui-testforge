import { test, expect } from '../fixtures/test.mjs';

test('existing host API health check', async ({ request, accountSession }) => {
  expect(accountSession.source).toBe('existing-playwright-fixture');
  const response = await request.get('/health');
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ ok: true, service: 'card-loss-demo' });
});
