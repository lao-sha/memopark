# pallet-memo-sacrifice

- 目标：提供“祭祀品目录（Sacrifice）”主数据管理，供 `pallet-memo-offerings` 读取价格与可购性，实现“目录/交易”分层与低耦合。
- 治理：`AdminOrigin` 负责上/下架与元数据维护。
- 安全：创建时可保留押金 `ListingDeposit`，成熟期 `ComplaintPeriod` 后可退；预留投诉计数项，与现有 Data/Life/Eulogy 风格一致。

主要类型：
- `SacrificeItem`：名称、资源 URL、描述、状态、是否会员专属、定价（fixed 或 unit/周）、类目/场景、创建者与时间戳。
- `SacrificeStatus`：Enabled/Disabled/Hidden。

存储：
- `NextSacrificeId: u64`
- `SacrificeOf: map u64 => SacrificeItem`
- `SacrificeDeposits / SacrificeMaturity / SacrificeComplaints`

对外只读接口：
- 通过实现 `pallet-memo-offerings::pallet::SacrificeCatalog` 暴露：
  - `spec_of(id) -> (fixed, unit, enabled, vip_only, exclusive_subjects)`
    - `exclusive_subjects: Vec<(domain,u64)>`，为空则表示非专属；非空仅允许命中条目下单
  - `can_purchase(who, id, is_vip) -> bool`

Extrinsics（管理员/签名）：
- `create_sacrifice(...)`：创建并保留押金，设置成熟期。
- `update_sacrifice(...)`：可选字段更新。
- `set_status(id, status)`：0/1/2 → 启用/下架/隐藏。
- `claim_deposit(id)`：到期且无投诉时退款押金。

与 `pallet-memo-offerings` 协作：
- offerings 新增 `offer_by_sacrifice(...)`，自动读取目录定价并完成转账与记录；当存在专属主体时，要求 `target==(domain,u64)` 命中其一。

前端建议：
- 目录后台：创建/编辑/上下架；
- 用户端：详情页显示价格与有效期（天→区块换算在前端）。


