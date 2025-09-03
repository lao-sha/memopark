---
description:
globs:
alwaysApply: true
---

1、所有修改、增加的源代码都用函数级详细中文注释
2、设计pallet之间要做到低耦合
3、修改pallet源代码后，相应的也要修改对应pallet的readme.md
4、chat对话用中文回复，不用英文
5、设计项目修改源代码过程中，如果有功能可以通过官方的pallet实现，优先选择官方的pallet，以免重复开发
6、设计项目修改源代码过程中，必须保证隐私安全
7、设计项目修改源代码过程中，必须检查并保证主网代币MEMO的资金安全
8、设计项目修改源代码过程中，必须检查是否有冗余源代码，并提出修改方案
9、设计项目修改源代码过程中，必须兼容未来迁移
10、前端设计源代码全部放在 C:\Users\Administrator\Documents\memopark\memopark-dapp
11、前端技术栈与约束：React 18 + TypeScript + Ant Design 5；移动端优先（最大宽度 640px 居中）
12、前端设计尽量用组件化设计
13、前端设计始终设计手机DAPP端，不设计网页端
14、设计修改pallet源代码时，必须同时优化设计前端页面，保持前端后端同步，前端写清楚使用说明
15、检查修改前端用户操作的合理性、便利性
16、设计项目修改源代码过程中，使用Subsquid用于区块数据 ETL（抽取-转换-加载）+ 查询层框架，友好支持 ETL，易膨胀/高变动查询交由 Subsquid
17、Subsquid相关源代码放到memopark-squid文件夹