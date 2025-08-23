# pallet-otc-maker

- 职责：做市商（经销商）准入、资料、支付方式承诺哈希、启用/停牌。
- 隐私：支付方式/联系方式走链下加密存储，链上仅保存 `H(encrypted_cid||salt)` 承诺。
 - KYC：基于 `pallet-identity` 的正向裁决（KnownGood/Reasonable）作为准入门槛；在 `runtime` 通过 `KycByIdentity` 适配。

## 接口
- `upsert_maker(payment_cid_commit: H256)`：注册或更新做市商资料（启用）。
- `set_active(active: bool)`：做市商启用/停牌切换。
 - 以上调用前置校验 `Kyc::is_verified(who)`。

## 存储
- `Makers: AccountId -> (H256, bool)`：支付承诺哈希与启用状态。

> 注意：权限与保证金、风控参数可后续通过治理或自定义适配器扩展；为保持低耦合，当前不强绑定额外依赖。

## 证据/材料存储建议
- KYC/支付材料请使用 `pallet-evidence::commit_hash(ns, subject_id, commit)` 登记承诺：
  - `ns = b"kyc_____"`（示例）；`subject_id = who` 的短码/数值映射。
  - `commit = blake2b_256(ns||subject_id||cid_enc||salt||ver)`。
- 业务模块仅保存 `evidence_id` 或承诺哈希引用，不保存可逆 CID。
