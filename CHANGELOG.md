# Changelog

[English](CHANGELOG.md) | [简体中文](CHANGELOG.zh-CN.md)

All notable changes to this project are documented here. The format follows Keep a Changelog and Semantic Versioning.

## [Unreleased]

### Added

- Guided automatic stage transitions with manual Next actions.
- Deterministic Approve all action for human Test IR review.
- Explicit target URL and GUI Driver validation gate before execution.
- Bilingual support guidance for Discussions, Issues, and private vulnerability reporting.
- Native Playwright precompiler for existing host projects.
- Configuration-relative `compile` and `check` CLI and library APIs.
- Project-defined semantic actions and observations with a frozen semantic contract.
- Host-style GUI Driver contract using existing Playwright fixtures.
- Runnable existing-Playwright example with a custom fixture, existing API test, generated GUI tests, and native reports.
- Two-phase demo: compile and discover before the GUI starts, then run the unchanged generated source after the GUI is available.
- Human-reviewed and hash-bound Test IR workflow.
- Optional OpenAI-compatible proposal provider and offline recorded proposal.
- English UI and paired English and Simplified Chinese documentation.

### Changed

- Repositioned GUI TestForge from a standalone test runner to an integration layer for an existing Playwright framework.
- Moved public execution to the host Playwright Runner; the former internal runner is retained only for compatibility.
