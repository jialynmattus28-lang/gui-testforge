import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAPTIONS,
  POST_RESULT_PAUSE_MS,
  PRE_CLICK_PAUSE_MS,
} from '../scripts/capture-readme-demo.mjs';

const expectedSteps = [
  'requirements',
  'generate',
  'approve',
  'freeze',
  'compile',
  'connect',
  'run',
  'results',
];

test('README demo captions cover the same workflow in both languages', () => {
  assert.deepEqual(Object.keys(CAPTIONS.en), expectedSteps);
  assert.deepEqual(Object.keys(CAPTIONS['zh-CN']), expectedSteps);
  for (const locale of ['en', 'zh-CN']) {
    for (const caption of Object.values(CAPTIONS[locale])) {
      assert.ok(caption.trim().length >= 8, `${locale} captions must be explanatory`);
    }
  }
});

test('README demo pauses long enough to understand each interaction', () => {
  assert.ok(PRE_CLICK_PAUSE_MS >= 2_000);
  assert.ok(POST_RESULT_PAUSE_MS >= 2_000);
});
