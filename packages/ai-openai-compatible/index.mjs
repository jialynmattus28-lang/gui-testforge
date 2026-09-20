import { parseJsonContent, validateProviderProposal } from '../ai-provider/index.mjs';

function requireConfig(config) {
  if (!config?.baseUrl || !config?.apiKey || !config?.model) {
    throw new Error('OpenAI-compatible provider requires a base URL, API key, and model');
  }
}

export function createOpenAICompatibleProvider(config, { fetchImpl = globalThis.fetch } = {}) {
  requireConfig(config);
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  async function request(task, payload, signal) {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Return JSON only. Test IR must use semantic actions and non-empty assertions. Never use selectors or framework calls.',
          },
          { role: 'user', content: JSON.stringify({ task, ...payload }) },
        ],
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`AI provider request failed with HTTP ${response.status}`);
    }
    const data = await response.json();
    return parseJsonContent(data?.choices?.[0]?.message?.content);
  }

  return {
    id: 'openai-compatible',
    status() {
      return { id: 'openai-compatible', configured: true, baseUrl, model: config.model };
    },
    async healthCheck(signal) {
      const response = await fetchImpl(`${baseUrl}/models`, {
        headers: { authorization: `Bearer ${config.apiKey}` },
        signal,
      });
      return { ok: response.ok, status: response.status };
    },
    async generateTestIR(requestPayload, signal) {
      return validateProviderProposal(await request('generateTestIR', requestPayload, signal));
    },
    async reviewTestIR(requestPayload, signal) {
      return request('reviewTestIR', requestPayload, signal);
    },
    async refineTestIR(requestPayload, signal) {
      return request('refineTestIR', requestPayload, signal);
    },
  };
}
