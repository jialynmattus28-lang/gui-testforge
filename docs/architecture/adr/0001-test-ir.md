# ADR 0001: Test IR Is the Stable Test Asset

[English](0001-test-ir.md) | [简体中文](0001-test-ir.zh-CN.md)

**Status:** Accepted

Test IR stores requirement references, fixtures, ordered semantic actions, typed semantic assertions, and expected business outcomes. It excludes selectors, coordinates, framework calls, and executable snippets.

This boundary lets testing finish and freeze business intent before the real GUI exists. Framework compilers and application Drivers can change without rewriting approved intent.
