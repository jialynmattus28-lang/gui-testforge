# ADR 0002: AI Stops at the Frozen Asset Boundary

[English](0002-ai-boundary.md) | [简体中文](0002-ai-boundary.zh-CN.md)

**Status:** Accepted

AI adapters may analyze requirements and propose or refine Test IR. People make every approval and freeze decision. Compiler and integration packages do not import AI adapters. Generated tests, GUI Drivers, and the host Playwright Runner receive no AI credentials or model session.

This prevents model output from silently rewriting assertions, skipping cases, choosing verdicts, or fabricating runtime evidence.
