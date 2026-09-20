# ADR 0003：编译器只接收已校验冻结资产

[English](0003-compiler-contract.md) | [简体中文](0003-compiler-contract.zh-CN.md)

**状态：** 已接受

编译器声明其支持的 Test IR 版本，并且只接收内容哈希校验通过的冻结资产。Manifest 记录编译器版本、资产哈希、语义契约哈希、编译配置哈希、生成文件哈希、用例编号和宿主 Peer Dependency。

相同编译器版本、冻结资产和接入配置必须在所有支持的操作系统上生成逐字节一致的原生 Playwright 源代码。
