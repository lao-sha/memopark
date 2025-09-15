# pallet-memo-sacrifice

- 目标：提供“祭祀品目录（Sacrifice）”主数据管理，供 `pallet-memo-offerings` 读取价格与可购性，实现“目录/交易”分层与低耦合。
- 治理：`AdminOrigin` 负责上/下架与元数据维护。
- 安全：创建时可保留押金 `ListingDeposit`，成熟期 `ComplaintPeriod` 后可退；预留投诉计数项，与现有 Data/Life/Eulogy 风格一致。

主要类型：
- `SacrificeItem`：名称、资源 URL、描述、状态、是否会员专属、定价（fixed 或 unit/周）、类目/场景、创建者与时间戳。
- `SacrificeStatus`：Enabled/Disabled/Hidden。
- 二级类目：`primary_category_id`（一级）/`secondary_category_id`（二级，父为一级）；并维护 `CategoryOf/ChildrenByCategory` 与反向索引 `SacrificesByPrimary/SacrificesBySecondary`。
- 效果元数据：`EffectOf(id) -> (consumable, target_domain, effect_kind, effect_value, cooldown_secs, inventory_mint)`，供消费侧（如 memo-pet）解释。

存储：
- `NextSacrificeId: u64`
- `SacrificeOf: map u64 => SacrificeItem`
- `SacrificeDeposits / SacrificeMaturity / SacrificeComplaints`
- `CategoryOf / NextCategoryId / ChildrenByCategory / SacrificesByPrimary / SacrificesBySecondary`
- `EffectOf: map id => (bool, u8, u8, i32, u32, bool)`

对外只读接口：
- 通过实现 `pallet-memo-offerings::pallet::SacrificeCatalog` 暴露：
  - `spec_of(id) -> (fixed, unit, enabled, vip_only, exclusive_subjects)`
  - `can_purchase(who, id, is_vip) -> bool`
  - `effect_of(id) -> Option<EffectSpec>`：提供可选的消费效果定义

Extrinsics（管理员/签名）：
- `create_sacrifice(...)`：创建并保留押金，设置成熟期。
- `update_sacrifice(...)`：可选字段更新。
- `set_status(id, status)`：0/1/2 → 启用/下架/隐藏。
- `claim_deposit(id)`：到期且无投诉时退款押金。
- `create_category(name, parent?) / update_category(id, name?, parent?)`：管理类目树（仅两层）。
- `assign_category(id, primary?, secondary?)`：为目录项设置类目并维护反向索引。
- `set_effect(id, effect?)`：设置/清除效果元数据。

与 `pallet-memo-offerings` 协作：
- offerings 提供 `offer_by_sacrifice(...)`，自动读取目录定价并完成转账与记录；当存在专属主体时，要求 `target==(domain,u64)` 命中其一。
- 若 `effect_of(id)` 返回 Some，则由 offerings 调用消费回调 `Consumer::apply(...)`，在目标域应用效果（失败不回滚交易）。

前端建议：
- 目录后台：创建/编辑/上下架/类目/效果管理；
- 用户端：详情页显示价格/有效期与二级类目浏览；
- IPFS 资源：仅存 CID，隐私明文放链下。


