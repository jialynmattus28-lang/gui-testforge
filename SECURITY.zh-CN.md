# 安全策略

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

发现疑似漏洞时，请不要创建公开 Issue。在项目公布专用安全邮箱前，请使用 GitHub 的私密漏洞报告功能。

禁止提交 API Key、Cookie、客户数据、私有接口、本地执行历史或生成报告。AI 凭据只保留在可选测试设计服务中，不得进入编译器、接入层、生成测试、Driver 或宿主 Playwright 执行输入。

GUI Driver 是可执行代码，并使用当前用户权限运行。信任和运行第三方 Driver 前，必须先审核其源代码。
