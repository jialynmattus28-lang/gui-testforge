import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditRepository } from '../scripts/audit-public-release.mjs';

test('public release audit finds no secrets, private paths, Chinese UI, or AI execution imports', async () => {
  const findings = await auditRepository(process.cwd());
  assert.deepEqual(findings, []);
});
