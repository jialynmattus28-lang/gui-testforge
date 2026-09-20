import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startDemoApp } from '../examples/card-loss/demo-app/server.mjs';

let app;

async function post(path, body = {}) {
  const response = await fetch(`${app.url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  app = await startDemoApp({ port: 0 });
});

after(async () => {
  await app.close();
});

test('identity and face outcomes gate the card screen', async () => {
  await post('/api/test/reset', { identityOutcome: 'failure' });
  let result = await post('/api/action/read-identity');
  assert.equal(result.body.screen, 'identity');
  assert.equal(result.body.messageCode, 'IDENTITY_READ_FAILED');

  await post('/api/test/reset', { identityOutcome: 'success', faceOutcome: 'failure' });
  result = await post('/api/action/read-identity');
  assert.equal(result.body.screen, 'face');
  result = await post('/api/action/verify-face');
  assert.equal(result.body.screen, 'face');
  assert.equal(result.body.messageCode, 'FACE_VERIFICATION_FAILED');
});

test('ineligible cards stay visible and cannot be selected', async () => {
  await post('/api/test/reset', { identityOutcome: 'success', faceOutcome: 'success' });
  await post('/api/action/read-identity');
  await post('/api/action/verify-face');
  const result = await post('/api/action/select-card', { cardId: 'CARD-2002' });
  assert.equal(result.body.cards.find((card) => card.id === 'CARD-2002').selectable, false);
  assert.equal(result.body.selectedCardId, null);
});

test('wrong password is rejected and correct password changes actual card state', async () => {
  await post('/api/test/reset', { correctPassword: '123456' });
  await post('/api/action/read-identity');
  await post('/api/action/verify-face');
  await post('/api/action/select-card', { cardId: 'CARD-1001' });
  await post('/api/action/continue');

  let result = await post('/api/action/submit-password', { value: '000000' });
  assert.equal(result.body.messageCode, 'PASSWORD_INCORRECT');
  assert.equal(result.body.cards.find((card) => card.id === 'CARD-1001').status, 'normal');

  result = await post('/api/action/submit-password', { value: '123456' });
  assert.equal(result.body.screen, 'result');
  assert.equal(result.body.businessOutcome, 'SUCCEEDED');
  assert.equal(result.body.cards.find((card) => card.id === 'CARD-1001').status, 'lost');
});
