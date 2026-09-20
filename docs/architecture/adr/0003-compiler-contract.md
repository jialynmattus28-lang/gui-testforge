# ADR 0003: Compilers Consume Only Verified Frozen Assets

[English](0003-compiler-contract.md) | [简体中文](0003-compiler-contract.zh-CN.md)

**Status:** Accepted

A compiler declares supported Test IR versions and accepts only a frozen asset whose content hash verifies. Its manifest records compiler version, asset hash, semantic-contract hash, compiler-configuration hash, generated-file hashes, case identifiers, and host peer dependencies.

The same compiler version, frozen asset, and integration configuration must produce byte-identical native Playwright source on every supported operating system.
