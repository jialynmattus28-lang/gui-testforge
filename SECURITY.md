# Security Policy

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

Do not open a public issue for a suspected vulnerability. Until a project security address is published, use GitHub's private vulnerability reporting feature.

Never commit API keys, cookies, customer data, private endpoints, local execution history, or generated reports. AI credentials stay in the optional design service and never enter compiler, integration, generated-test, Driver, or host Playwright execution inputs.

GUI Drivers are executable code and run with the current user's privileges. Review third-party Driver source before trusting and running it.
