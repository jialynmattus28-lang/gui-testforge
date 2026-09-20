# Contributing to GUI TestForge

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

Thank you for contributing. Keep changes focused and preserve the trust boundary: AI adapters may propose Test IR, but compiler, integration, generated tests, and host execution must not import AI code or receive AI credentials.

## Development

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Run `npx playwright install chromium`.
4. Run `npm test`.
5. Run `npm run test:demo` for the real-browser workflow.
6. Run `npm run test:host` for existing Playwright project compatibility.

Behavior, setup, architecture, and public API changes must update both English and Simplified Chinese documentation in the same pull request. Add tests before implementation and keep Test IR free of selectors and framework calls.

See the design specification and the contribution guides under `docs/` before adding providers, compilers, host integrations, or GUI Drivers. Do not introduce a second public runner; generated tests must continue to use the host Playwright Runner.
