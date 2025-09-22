# pallet-escrow

## 概述
- 通用托管账户管理：锁定、释放、退款、转移，面向多业务复用（订单、OTC、仲裁）。
- 使用 `PalletId` 派生托管主账户与子账户（按业务对象 ID）。

## 接口（Trait）
- `lock_from(buyer, id, amount)`：从 `buyer` 锁定 `amount` 到 `id` 对应的托管子账户。
- `transfer_from_escrow(id, to, amount)`：从托管子账户转出到 `to`。
- `release_all(id, to)`：释放该子账户全部资金到 `to`。
- `refund_all(id, to)`：退款全部资金到 `to`。
- `amount_of(id) -> Balance`：查询托管子账户余额。

## 外部 Extrinsic（受控）
- `lock(id, payer, amount)`：仅 `AuthorizedOrigin | Root`；支持全局 `Paused`。常规业务推荐走内部 Trait。
- `lock_with_nonce(id, payer, amount, nonce)`：带幂等的锁定；相同 `(id, nonce)` 重放将被忽略。
- `release(id, to)`：仅 `AuthorizedOrigin | Root`；争议状态下拒绝普通释放。
- `refund(id, to)`：仅 `AuthorizedOrigin | Root`；争议状态下拒绝普通退款。
- `release_split(id, [(to, amount)…])`：原子分账释放，合计不得超过当前托管余额。
- `dispute(id, reason)`：进入争议状态（Locked→Disputed）。
- `apply_decision_release_all(id, to)` / `apply_decision_refund_all(id, to)` / `apply_decision_partial_bps(id, to, refund_to, bps)`：仲裁决议接口。
- `set_pause(paused)`：管理员暂停/恢复托管入口。

## Config
- `type Currency`：底层代币实现（MEMO）。
- `type EscrowPalletId`：派生模块账户。
- `type AuthorizedOrigin`：白名单 Origin（如 Root | 内容委员会阈值）。
- `type AdminOrigin`：管理员 Origin（Root | 内容委员会阈值）。

## 用例
- 订单履约结算：由订单或仲裁调用，释放给代办或退还买家。
- OTC 卖单保证金：下单锁定、取消退款。
- 平台分账：`release_split(id, [(seller, net), (fee, fee_amt)])` 原子化结算。

## 安全
- 外部入口仅对 `AuthorizedOrigin | Root` 开放，常规推荐走内部 Trait。
- 争议状态仅允许仲裁决议接口处理出金；所有出金路径统一透支校验。
- 幂等 `nonce` 防重放；`Paused` 总开关可应急止血。
