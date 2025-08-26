# pallet-deceased

本模块用于在单个墓位（grave）下维护多个逝者（deceased）记录，提供增删改迁移等操作。其与墓位模块保持低耦合：通过 `GraveInspector` Trait 抽象交互，不直接依赖具体实现。为保护隐私，链上仅存有限文本与链下外链，不涉及任何 MEMO 代币逻辑；所有文本/集合均使用有界长度限制以防止状态膨胀。

## Config 示例

```rust
impl pallet_deceased::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type GraveId = u64;
    type MaxDeceasedPerGrave = MaxDeceasedPerGrave;
    type StringLimit = DeceasedStringLimit;
    type MaxLinks = DeceasedMaxLinks;
    type GraveProvider = GraveProviderAdapter; // 由 runtime 实现
    type WeightInfo = ();
}
```

## Extrinsics

- create_deceased(grave_id, name, bio, birth_ts, death_ts, links)
- update_deceased(id, name?, bio?, birth_ts??, death_ts??, links?)
- remove_deceased(id)
- transfer_deceased(id, new_grave)

权限：
- 创建/迁移：`GraveProvider::can_attach(who, grave_id)`。
  - 判定规则（单一权威源：`pallet-memo-grave`）：
    - 若 `who` 为墓主 → 允许
    - 若 `who` 在 `pallet-memo-grave::GraveAdmins[grave_id]` 中 → 允许
    - 若 `who` 为墓位所在陵园的管理员（`ParkAdminOrigin::ensure(park_id, Signed(who))` 通过）→ 允许
- 修改/删除：记录 `owner`。

## 存储
- NextDeceasedId: DeceasedId
- DeceasedOf: DeceasedId -> Deceased
- DeceasedByGrave: GraveId -> BoundedVec<DeceasedId>

## 安全与隐私
- 不在链上存储敏感个人信息；仅存少量文本与链下链接（IPFS/HTTPS 等）。
- 不进行任何 MEMO 代币相关操作，避免资金风险。
- 字段长度、数量受限，防止滥用与状态膨胀。

## 冗余与迁移
- 若墓位以 NFT/唯一资产表示，可复用官方 `pallet-nfts` 管理所有权，本模块仅做“关系与最小元数据”。
- 可在未来增加与 `pallet-nfts` 的映射字段，平滑迁移。


