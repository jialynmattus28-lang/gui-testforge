# Architecture Overview

[English](README.md) | [简体中文](README.zh-CN.md)

GUI TestForge is an authoring and precompilation layer beside an existing Playwright project.

```text
Requirements -> Test IR proposal -> Human approval -> Frozen asset
                                                     |
                                                     v
Existing Playwright project <- native spec <- deterministic compiler
          |
          +-- existing config, fixtures, projects, reporters, CI
          +-- application-specific GUI Driver
          +-- normal playwright test command
```

## Trust Zones

1. **Proposal zone:** optional AI adapters can propose or refine Test IR. Their output is untrusted.
2. **Governance zone:** workflow and IR modules validate content, bind approvals to exact case hashes, and freeze the approved asset.
3. **Deterministic integration zone:** compiler and integration modules emit and verify native Playwright files without AI, a target URL, or browser execution.
4. **Host execution zone:** the user's own Playwright runner loads the generated spec and GUI Driver, reads actual state, performs assertions, and produces native reports.

## Dependency Direction

- AI adapters depend on the provider boundary and IR validation.
- Workflow depends on IR hashing and validation.
- The compiler depends only on frozen IR and deterministic templates.
- The integration layer depends on the compiler and filesystem checks.
- Generated tests depend on the host fixture module and GUI Driver.
- The host application does not depend on GUI TestForge.

The legacy internal runner remains only for compatibility tests and is not the public integration route. New integrations compile into the host `testDir` and use the host's normal Playwright Runner.

See the [existing Playwright integration design](../superpowers/specs/2026-09-20-existing-playwright-integration-design.md) and architecture decision records in [`adr/`](adr/).
