# pallet-forwarder（会话签名 + 代付）

## 概述
- 实现“元交易转发 + 会话许可 + 赞助者代付”，允许用户线下签名，赞助者代为上链并付费。
- 白名单与可转发范围由 runtime 内的适配器决定（本链：平台账户限权 + 按命名空间放行）。

## 核心能力
- 会话许可：TTL、命名空间、范围、nonce/上限，用户单次签名建立会话。
- 元交易：外层由赞助者签名付费，内层以用户身份执行 RuntimeCall。
- 反逃逸：`ForbiddenCalls` 禁用如 `Sudo` 等高权限或逃逸调用。

## 关键设计
- 为避免 `RuntimeCall` 类型循环与 `DecodeWithMemTracking` 约束，Extrinsic 参数使用 `BoundedVec<u8>` 承载 SCALE 编码后的 `SessionPermit` 与 `MetaTx`，在链上内部解码。
- `Config`:
  - `type RuntimeCall`、`type Authorizer`、`type ForbiddenCalls`、`type MaxMetaLen`、`type MaxPermitLen`、`type RequireMetaSig`、`type MaxCallsPerSession`、`type MaxWeightPerSessionRefTime`、`type WeightInfo`。

## 主要 Extrinsic（示意）
- `open_session(permit_bytes: BoundedVec<u8>)`
- `forward(meta_bytes: BoundedVec<u8>, session_sig: Vec<u8>, owner: LookupSource)`
- `close_session(ns, session_id)`
- `purge_expired(ns, limit)`：批量清理 owner+ns 下已过期会话

## 签名与安全
- 运行时可设置 `RequireMetaSig=true`，将校验 `session_sig` 为 `Sessions[(owner,ns,session_id)].session_pubkey` 对以下消息的 sr25519 签名：
  - `msg = scale(meta_bytes) || genesis_hash(block0) || "/mp/fwd/v1"`
- 建议赞助者账户启用 `pallet-fee-guard`（仅手续费账户保护）。
- 默认通过 `ForbiddenCalls` 拒绝高危调用（如 sudo/batch/dispatch_as/forwarder 自身等）。

## 配额与预算
- `MaxCallsPerSession`：每会话最大转发次数（失败也计数）。
- `MaxWeightPerSessionRefTime`：每会话累计 `ref_time` 权重上限（`call_weight + extension_weight`）。

## 事件
- `SessionOpened { owner, ns, session_id }`
- `SessionClosed { owner, ns, session_id }`
- `Forwarded { owner, sponsor, ns, session_id }`
- `ForwardFailed { owner, sponsor, ns, session_id, code }`（6=签名/会话无效；7=内层调用失败）

## 集成与白名单
- 运行时 `AuthorizerAdapter` 策略：
  - 仅允许平台账户 `PlatformAccount` 作为赞助者。
  - 命名空间放行：
    - `OtcListingNsBytes = b"otc_lst_"`：允许 `otc-listing::create_listing`（买/卖由参数 `side` 决定）。
    - `OtcOrderNsBytes   = b"otc_ord_"`：允许 `otc-order::open_order`（吃单）。
    - `ArbitrationNsBytes` 与 `EvidenceNsBytes` 按需放行各自调用。

## 端到端调用示例（Polkadot.js）
```javascript
// 平台账户 sponsor 开启会话（ns=otc_lst_）
const nsListing = new Uint8Array([111,116,99,95,108,115,116,95]); // "otc_lst_"
const permit = { ns: nsListing, owner, sessionId, sessionPubkey, expiresAt };
const permitBytes = api.createType('Bytes', api.createType('(ForwarderSessionPermit)', permit).toU8a());
await api.tx.forwarder.openSession(permitBytes).signAndSend(platformAccount);

// 用户业务调用（由平台代付）：创建“买/卖”挂单
const call = api.tx.otcListing.createListing(side, base, quote, price, minQty, maxQty, total, partial, expireAt, termsCommitOpt);
const meta = { ns: nsListing, sessionId, call, nonce, validTill };
const metaBytes = api.createType('Bytes', api.createType('(ForwarderMetaTx)', meta).toU8a());
await api.tx.forwarder.forward(metaBytes, sessionSig, owner).signAndSend(platformAccount);

// 吃单创建订单：命名空间改为 nsOrder（"otc_ord_"）
const nsOrder = new Uint8Array([111,116,99,95,111,114,100,95]);
const call2 = api.tx.otcOrder.openOrder(listingId, price, qty, amount, paymentCommit, contactCommit);
const meta2 = { ns: nsOrder, sessionId, call: call2, nonce: nonce+1, validTill };
const metaBytes2 = api.createType('Bytes', api.createType('(ForwarderMetaTx)', meta2).toU8a());
await api.tx.forwarder.forward(metaBytes2, sessionSig2, owner).signAndSend(platformAccount);
```

> 注意：生产环境应校验 `session_sig` 与 `session_pubkey`；平台代付需配合额度、频控、黑名单等风控策略，并建议引入治理可控的授权中心。
