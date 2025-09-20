# pallet-memo-bridge（MEMO ↔ ETH 联邦多签桥最小版）

本模块提供链上 MEMO 锁定/解锁、风控参数与紧急暂停控制；跨链放行在以太坊侧由 Gnosis Safe 多签执行。参数与暂停由 Root/委员会阈值治理；所有动作发链上事件并记录证据 CID（明文）。

## Extrinsics
- lock_memo(amount, eth_address: Vec<u8>)：用户锁定 MEMO 并指定以太坊收款地址；收取 fee（bps）入国库。
- unlock_memo(to, amount, evidence_cid)：治理/多签解锁 MEMO（用于 ETH→MEMO 入金方向）。
- set_params(single_max, daily_max, fee_bps)：治理设置单笔/日限与费率。
- set_pause(on)：治理紧急暂停。

## 事件
- MemoLocked { who, net_amount, fee, eth }
- MemoUnlocked { to, amount, evidence }
- ParamsUpdated { single_max, daily_max, fee_bps }
- Paused { on }

## 存储/风控
- Params：{ single_max, daily_max, fee_bps, paused }
- DailyUsed[(account, day)]：当日累计额度

## 集成
- Config:
  - Currency：balances
  - FeeCollector：国库账户
  - GovernanceOrigin：Root 或 委员会 2/3
  - MinLock：最小锁定额
  - BridgePalletId：桥托管账户 PalletId
