# pallet-forwarder

## 概述
- 实现“元交易转发 + 会话许可 + 赞助者代付”，允许用户线下签名，赞助者代为上链并付费。
- 白名单与可转发范围由 runtime 内的适配器决定（当前为 Noop，占位）。

## 核心能力
- 会话许可：TTL、命名空间、范围、nonce/上限，用户单次签名建立会话。
- 元交易：外层由赞助者签名付费，内层以用户身份执行 RuntimeCall。
- 反逃逸：`ForbiddenCalls` 禁用如 `Sudo` 等高权限或逃逸调用。

## 关键设计
- 为避免 `RuntimeCall` 类型循环与 `DecodeWithMemTracking` 约束，Extrinsic 参数使用 `BoundedVec<u8>` 承载 SCALE 编码后的 `SessionPermit` 与 `MetaTx`，在链上内部解码。
- `Config`:
  - `type RuntimeCall`、`type Authorizer`、`type ForbiddenCalls`、`type MaxMetaLen`、`type MaxPermitLen`。

## 主要 Extrinsic（示意）
- `open_session(permit_bytes: BoundedVec<u8>)`
- `forward(meta_bytes: BoundedVec<u8>)`

## 集成与白名单
- 在 `runtime/src/configs/mod.rs` 的 `AuthorizerAdapter::is_call_allowed` 匹配允许代付的 RuntimeCall 变体（按命名空间）。
- 原 `pallet-exchange` 已移除，相关白名单说明不再适用。
- 仲裁 `dispute/arbitrate` 的放行范围由 runtime 适配器决定。
