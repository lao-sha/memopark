# pallet-otc-claim

基于 `pallet-balances` 的“命名预留（reserve_named）+ 预留再归属（repatriate_reserved_named）”的 OTC 领取 Pallet。

目标：
- 做市商（发行方）在链下确认法币支付后签发领取授权，用户链上调用 `claim` 原子领取 MEMO（原生代币）。
- 服务器不持有链上转账权限，资金仅受链上规则控制。

接口：
- `upsert_issuer(issuer, pubkey, status, single_max, daily_max)`：注册/更新发行方（Root/治理）。
- `revoke_issuer(issuer)`：吊销发行方（Root/治理）。
- `claim(issuer, order_id, beneficiary, amount, deadline_block, nonce, signature)`：领取。

签名规范（sr25519）：
```
payload = "MEMOPARK_OTC_V1" | genesis_hash | issuer_account | order_id | beneficiary | amount | deadline_block | nonce
sig = sr25519_sign(issuer_pubkey, blake2_256(payload))
```

事件：
- `IssuerUpserted`、`IssuerRevoked`、`ClaimSucceeded { issuer, order_id, beneficiary, amount }`、`ClaimRejected { .. }`

错误：
- `IssuerNotFound/IssuerRevoked/OrderConsumed/SignatureInvalid/DeadlineExceeded/InvalidChain/InsufficientFreeBalance/DailyLimitExceeded/BeneficiaryInvalid`

安全说明：
- 领取交易内原子执行 `reserve_named -> repatriate_reserved_named(…Free)`，避免余额竞态。
- `(issuer, order_id)` 一次性消费；`deadline_block` + `genesis_hash` 防重放与跨链重放。


