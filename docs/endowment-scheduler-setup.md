# Endowment 定时结算（Scheduler）配置说明

本文档说明如何使用预镜像（preimage）+ 调度（scheduler）来周期调用 `MemoEndowment.close_epoch_and_pay(budget)`。

## 运行时前提
- runtime 已集成 `pallet-preimage` 与 `pallet-scheduler`（本仓库已完成）。

## 步骤（polkadot.js Apps）
1. 构造待调度的调用：`MemoEndowment.close_epoch_and_pay(budget)`，例如 `budget=1_000_000_000_000`。
2. 通过 `preimage.notePreimage(call)` 上链存证，得到 `callHash`（Apps 会显示）。
3. 通过 `scheduler.scheduleNamed` 指定：
   - `id`: 任意字节标识（建议 blake2 过的唯一值）；
   - `when`: 起始区块（e.g. 当前区块+10）；
   - `maybe_periodic`: 周期参数 `{ period, count }`，例如每 `7*24*60*10` 区块一次；
   - `priority`: 建议 127；
   - `call`: 使用 `preimage` 的 `callHash` 引用。

## 预算建议
- 结合 `set_annual_budget(year, max_budget)` 设置年度预算上限；
- 定时任务 `budget` 可为固定值，或按周/月更新预镜像以反映“收益池余额的 x%”。

## 风控联动
- 暂停：`set_paused(true)` 时调度执行会直接失败；
- 黑名单：`set_blacklist(op, true)` 后该运营者被跳过；
- 阈值：`set_min_sla(parts)` 与 `set_max_sla_stale_blocks(blocks)` 约束发放对象。


