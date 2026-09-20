# AI Provider Extension

[English](AI_PROVIDER.md) | [简体中文](AI_PROVIDER.zh-CN.md)

AI is optional and restricted to the design zone. Provider output is always untrusted and must pass deterministic Test IR validation before a person can adopt it.

Phase 1 includes:

- `ReplayProvider` for the offline demo. It never performs a model network request.
- `OpenAICompatibleProvider` for user-supplied base URL, API key, and model configuration.

```javascript
{
  async healthCheck(signal) {},
  async generateTestIR(request, signal) {},
  async reviewTestIR(request, signal) {},
  async refineTestIR(request, signal) {},
}
```

Run `npm run configure-ai` to create ignored local configuration. Keys remain in the optional design service, never appear in browser responses, and are never inputs to compilation or host Playwright execution.

Read the [Design Specification](superpowers/specs/2026-09-19-gui-testforge-open-source-design.md) before adding a provider.
