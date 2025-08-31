# pallet-memo-endowment

- 管理“永久存储基金”：本金池（Principal）与收益池（Yield）分账。
- 接收入账：来自存储业务的一次性费用 `deposit_from_storage`。
- 治理接口：发布年度报告哈希、更新参数（骨架）。

安全：
- 使用 PalletId 派生资金账户，地址稳定可审计。
- 未来通过治理白名单限制本金动用策略。

集成：
- 在 runtime 为 `Currency=Balances` 绑定，设置 `PrincipalPalletId`/`YieldPalletId`。
- 通过运行时 `SlaProvider`（示例 `SlaFromIpfs`）桥接 `pallet-memo-ipfs` 的 `OperatorSla`。

## 结算（close_epoch_and_pay）
- 输入 `budget`：本期预算；自动取 `min(budget, 收益池可用余额, 年度剩余额度)`。
- SLA 权重：默认按 `ok/(ok+fail)` 计算；过滤黑名单、过期未上报（MaxSlaStaleBlocks）、SLA 低于阈值（MinSlaPermill）。
- 发放：可将款项发往 `PayoutRecipientOf[operator]`，否则发往运营者自身账户；失败会记录 `OperatorSkipped` 原因，不会错误记账为已支付。
- 汇总：`EpochClosed(epoch, budget_in, paid_total, operators_processed, skipped_count)`。

## 风控与治理
- `Paused`：紧急暂停；
- `Blacklisted{op}`：黑名单；
- `MinSlaPermill`：最低 SLA 门槛；
- `MaxSlaStaleBlocks`：最长未上报区块数；
- `MaxAnnualBudget{year}` + `YearlySpent{year}` + `CurrentYear`：年度预算与累计；
- `PayoutRecipientOf{operator}`：代理收款账户；
- `transfer_principal_to_yield(amount)`：本金向收益池划转（治理）。

## 调度与自动化
- 已在 runtime 集成 `pallet_scheduler` 与 `pallet_preimage`；建议由 Root/collective 定期调度 `close_epoch_and_pay`，或使用预镜像 + 调度进行治理安排。

## 事件
- `OneOffFeeReceived(payer, amount, order_ref)`
- `OperatorPaid(operator_or_recipient, amount)`
- `OperatorSkipped(operator, reason_code)`（1=LowSla,2=Stale,3=Blacklisted,4=Paused,5=ZeroAmount,6=InsufficientBudget）
- `EpochClosed(epoch, budget_in, paid_total, operators_processed, skipped_count)`
