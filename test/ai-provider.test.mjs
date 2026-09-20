import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReplayProvider } from '../packages/ai-replay/index.mjs';
import { createOpenAICompatibleProvider } from '../packages/ai-openai-compatible/index.mjs';
import { validateProviderProposal } from '../packages/ai-provider/index.mjs';

test('offline replay returns cloned validated cases without network access', async () => {
  let networkCalls = 0;
  const provider = createReplayProvider({
    recordingPath: new URL('../examples/card-loss/replay-response.json', import.meta.url),
    fetchImpl: async () => {
      networkCalls += 1;
      throw new Error('network must not be used');
    },
  });

  const first = await provider.generateTestIR({});
  first.cases[0].title = 'mutated';
  const second = await provider.generateTestIR({});

  assert.equal(networkCalls, 0);
  assert.notEqual(second.cases[0].title, 'mutated');
  assert.equal(second.source, 'offline-replay');
  assert.ok(second.cases.length >= 5);
});

test('provider boundary rejects structurally invalid proposals', () => {
  assert.throws(
    () => validateProviderProposal({ cases: [{ id: 'broken', steps: [] }] }),
    /Test IR validation failed/,
  );
});

test('live provider keeps the API key out of status and validates JSON output', async () => {
  const calls = [];
  const provider = createOpenAICompatibleProvider(
    {
      baseUrl: 'https://api.example.invalid/v1',
      apiKey: 'secret-value',
      model: 'example-model',
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const replay = await import('../examples/card-loss/replay-response.json', { with: { type: 'json' } });
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replay.default) } }] }));
      },
    },
  );

  assert.deepEqual(provider.status(), {
    id: 'openai-compatible',
    configured: true,
    baseUrl: 'https://api.example.invalid/v1',
    model: 'example-model',
  });
  assert.doesNotMatch(JSON.stringify(provider.status()), /secret-value/);
  const result = await provider.generateTestIR({ prd: 'Synthetic PRD' });
  assert.ok(result.cases.length >= 5);
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-value');
});

test('live provider requires all configuration fields', () => {
  assert.throws(
    () => createOpenAICompatibleProvider({ baseUrl: '', apiKey: '', model: '' }),
    /base URL, API key, and model/,
  );
});
