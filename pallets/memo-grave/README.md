# pallet-memo-grave

- 作用：管理墓地（单/双/多人）、归属陵园、容量/转让、安葬/起掘记录。
- 隐私：仅记录承诺/加密 CID 的元数据；不落明文；媒体走 `pallet-evidence`。
- 解耦：与陵园通过 `park_id` 关联（可选 `Option<ParkId>`）；与逝者通过 `deceased_id` 关联；安葬事件通过 `OnIntermentCommitted` 钩子联动。

## 存储
- `NextGraveId: u64`
- `Graves: GraveId -> Grave { park_id?: Option<ParkId>, owner, admin_group, kind_code, capacity, metadata_cid, active }`
- `GravesByPark: ParkId -> BoundedVec<GraveId>`（仅当 `park_id=Some(park)` 时维护索引）
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

### 新增（可见性与关注）
- `VisibilityPolicyOf: GraveId -> { public_offering, public_guestbook, public_sweep, public_follow }`
- `FollowersOf: GraveId -> BoundedVec<AccountId, MaxFollowers>`

### 变更（Hall 拆分）
- Hall 相关逻辑已迁移至独立 `pallet-memo-hall`；本模块不再包含 Hall 的存储与调用。

## Extrinsics
- `create_grave(park_id?: Option<ParkId>, kind_code, capacity?, metadata_cid)`
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
 - 新增：`set_visibility(id, public_offering, public_guestbook, public_sweep, public_follow)`
 - 新增：`follow(id)` / `unfollow(id)`
- （移除）`create_hall/attach_deceased/set_hall_params` 已迁移至 `pallet-memo-hall`

## 权限
- 墓地主人、墓位管理员，或 `ParkAdminOrigin::ensure(park_id, origin)` 通过的起源（部分接口）。当 `park_id=None` 时，仅墓主可管理（园区管理员校验不可用）。
  - `pallet-deceased` 通过运行时适配器只读引用 `Graves/GraveAdmins` 做权限判定，无独立管理员集合，天然保持同步。
- 存储版本：StorageVersion=4（v3: `park_id` 改为 Option；v4: 移除 Hall），提供迁移以兼容旧数据。
- 与 `pallet-memo-hall` 的关系：通过 `Hall::link_grave_id` 可选关联，无循环依赖，建议由查询层整合展示。

### 编译零警告策略（-D warnings）
- 全仓库已启用 `-D warnings`：所有警告视为错误，确保上链代码安全可审计。
- 本 pallet 已为每个 extrinsic 显式声明 `#[pallet::call_index(N)]`，避免隐式索引弃用警告。
- 权重标注将由临时常量迁移到 `weights::WeightInfo`：后续将补充基准测试与 `weights.rs`，逐步移除常量权重。
- 迁移 API 使用 `in_code_storage_version` 替代已弃用的 `current_storage_version`。
