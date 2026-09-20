import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  accountSession: async ({ request }, use) => {
    await use({ request, source: 'existing-playwright-fixture' });
  },
});

export { expect };
