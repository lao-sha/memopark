# pallet-memo-bridge（MEMO ↔ ETH 联邦多签桥最小版）

本模块提供链上 MEMO 锁定/解锁、风控参数与紧急暂停控制；跨链放行在以太坊侧由 Gnosis Safe 多签执行。参数与暂停由 Root/委员会阈值治理；所有动作发链上事件并记录证据 CID（明文）。

自 v0.2 起可选对接 `pallet-pricing` 以支持“带最小可得 ETH 保护的锁定（报价保护）”与“按价值的限额风控”，仍不改变桥的最小信任模型（ETH 放行在链外多签）。

## Extrinsics
- lock_memo(amount, eth_address: Vec<u8>)：用户锁定 MEMO 并指定以太坊收款地址；收取 fee（bps）入国库。
- unlock_memo(to, amount, evidence_cid)：治理/多签解锁 MEMO（用于 ETH→MEMO 入金方向）。
- set_params(single_max, daily_max, fee_bps)：治理设置单笔/日限与费率。
- set_pause(on)：治理紧急暂停。
- lock_memo_with_protection(amount, eth_address, min_eth_out)：读取价格源，按净额估算 ETH 并校验最小可得；事件中记录价格快照与估算值。
- set_value_limits(single_value_max, daily_value_max)：治理设置按价值（估算 ETH）的单笔/日上限（0 表示不限制）。

## 事件
- MemoLocked { who, net_amount, fee, eth }
- MemoUnlocked { to, amount, evidence }
- ParamsUpdated { single_max, daily_max, fee_bps }
- Paused { on }
- MemoLockedWithQuote { who, net_amount, fee, eth, price_num, price_den, quote_eth_out }
- ValueLimitsUpdated { single_value_max, daily_value_max }

- Params：{ single_max, daily_max, fee_bps, paused, single_value_max, daily_value_max }
- DailyUsed[(account, day)]：当日累计额度

## 集成
- Config:
  - Currency：balances
  - FeeCollector：国库账户
  - GovernanceOrigin：Root 或 委员会 2/3
  - MinLock：最小锁定额
  - BridgePalletId：桥托管账户 PalletId
  - PriceFeed：价格源（实现 PriceProvider），仅用于保护/风控；未配置则只能使用 `lock_memo`
