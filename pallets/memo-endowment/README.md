# pallet-memo-endowment

- 管理“永久存储基金”：本金池（Principal）与收益池（Yield）分账。
- 接收入账：来自存储业务的一次性费用 `deposit_from_storage`。
- 治理接口：发布年度报告哈希、更新参数（骨架）。

安全：
- 使用 PalletId 派生资金账户，地址稳定可审计。
- 未来通过治理白名单限制本金动用策略。

集成：
- 在 runtime 为 `Currency=Balances` 绑定，设置 `PrincipalPalletId`/`YieldPalletId`。
