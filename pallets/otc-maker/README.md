# pallet-otc-maker

- 职责：做市商（经销商）准入、资料、支付方式承诺哈希、启用/停牌。
- 隐私：支付方式/联系方式走链下加密存储，链上仅保存 `H(encrypted_cid||salt)` 承诺。

## 接口
- `upsert_maker(payment_cid_commit: H256)`：注册或更新做市商资料（启用）。
- `set_active(active: bool)`：做市商启用/停牌切换。

## 存储
- `Makers: AccountId -> (H256, bool)`：支付承诺哈希与启用状态。

> 注意：权限与保证金、风控参数可后续通过治理或自定义适配器扩展；为保持低耦合，当前不强绑定额外依赖。
