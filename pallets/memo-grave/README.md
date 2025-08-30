# pallet-memo-grave

- 作用：管理墓地（单/双/多人）、归属陵园、容量/转让、安葬/起掘记录。
- 隐私：仅记录承诺/加密 CID 的元数据；不落明文；媒体走 `pallet-evidence`。
- 解耦：与陵园通过 `park_id` 关联；与逝者通过 `deceased_id` 关联；安葬事件通过 `OnIntermentCommitted` 钩子联动。

## 存储
- `NextGraveId: u64`
- `Graves: GraveId -> Grave { park_id, owner, admin_group, kind_code, capacity, metadata_cid, active }`
- `GravesByPark: ParkId -> BoundedVec<GraveId>`
- `Interments: GraveId -> BoundedVec<IntermentRecord>`
 - `GraveMetaOf: GraveId -> { categories: u32, religion: u8 }`
 - `ModerationOf: GraveId -> { restricted: bool, removed: bool, reason_code: u8 }`
 - `ComplaintsByGrave: GraveId -> BoundedVec<Complaint>`
 - `NameIndex: blake2_256(lowercase(name)) -> BoundedVec<GraveId>`
 - `GraveAdmins: GraveId -> BoundedVec<AccountId>`（墓位管理员集合，供子模块只读引用）

### 新增（Slug 与成员）
- `SlugOf: GraveId -> BoundedVec<u8, SlugLen>`（10 位数字）
- `GraveBySlug: Slug -> GraveId`
- `JoinPolicyOf: GraveId -> u8`（0=Open,1=Whitelist）
- `Members: (GraveId, AccountId) -> ()`
- `PendingApplications: (GraveId, AccountId) -> BlockNumber`

## Extrinsics
- `create_grave(park_id, kind_code, capacity?, metadata_cid)`
- `update_grave(id, kind_code?, capacity?, metadata_cid?, active?)`
- `transfer_grave(id, new_owner)`
- `inter(id, deceased_id, slot?, note_cid?)`
- `exhume(id, deceased_id)`
 - `set_meta(id, categories?, religion?)`
 - `complain(id, cid)`
 - `restrict(id, on, reason_code)` / `remove(id, reason_code)`
 - `set_name_hash(id, name_hash)` / `clear_name_hash(id, name_hash)`
 - `add_admin(id, who)` / `remove_admin(id, who)`（仅墓主或园区管理员）
 - 新增：`set_policy(id, policy)`（0/1）
 - 新增：`join_open(id)` / `apply_join(id)` / `approve_member(id, who)` / `reject_member(id, who)`

## 权限
- 墓地主人、墓位管理员，或 `ParkAdminOrigin::ensure(park_id, origin)` 通过的起源（部分接口）。
  - `pallet-deceased` 通过运行时适配器只读引用 `Graves/GraveAdmins` 做权限判定，无独立管理员集合，天然保持同步。
- 命名变更：本模块已由 `pallet-grave` 更名为 `pallet-memo-grave`，与 `memo-*` 命名统一。
- 存储版本：StorageVersion=1，兼容 Slug/成员/策略升级。
