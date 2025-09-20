# Endowment 定时结算（Scheduler）配置说明（已调整）

> 注意：当前运行时已移除 `pallet-preimage` 与 `pallet-scheduler` 的集成。本说明仅作为历史参考。如需定时任务，请在未来版本按需恢复 Scheduler，并改用“委员会阈值 + 申诉治理”或链下自动化（外部服务）触发。

## 替代路径（建议）
- 委员会阈值 + 申诉治理：通过 `pallet_memo_content_governance` 发起“定期执行结算”的申诉，委员会批量审批后按公示期到点执行（适合低频、人工复核场景）。
- 外部调度服务：使用后端 Cron/Serverless 定期触发 `memo_endowment.close_epoch_and_pay(budget)` 的 Root/委员会动议或直调（需具备权限且做好限频与风控）。

## 历史步骤（仅参考，不再适用当前运行时）
1. 构造待调度的调用：`MemoEndowment.close_epoch_and_pay(budget)`。
2. 通过 `preimage.notePreimage(call)` 上链存证，得到 `callHash`。
3. 通过 `scheduler.scheduleNamed` 指定：`id/when/maybe_periodic/priority/callHash` 等参数。

## 风控联动
- 暂停：`set_paused(true)` 时调度执行会直接失败；
- 黑名单：`set_blacklist(op, true)` 后该运营者被跳过；
- 阈值：`set_min_sla(parts)` 与 `set_max_sla_stale_blocks(blocks)` 约束发放对象。


