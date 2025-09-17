# pallet-memo-grave

- 作用：管理墓地（单/双/多人）、归属陵园、容量/转让、安葬/起掘记录。
- 隐私：仅记录承诺/加密 CID 的元数据；不落明文；媒体走 `pallet-evidence`。
- 解耦：与陵园通过 `park_id` 关联（可选 `Option<ParkId>`）；与逝者通过 `deceased_id` 关联；安葬事件通过 `OnIntermentCommitted` 钩子联动。

## 存储
- `NextGraveId: u64`
- `Graves: GraveId -> Grave { park_id?: Option<ParkId>, owner, admin_group, name(CID), deceased_tokens[], active }`
- `GravesByPark: ParkId -> BoundedVec<GraveId>`（仅当 `park_id=Some(park)` 时维护索引）
- `Interments: GraveId -> BoundedVec<IntermentRecord>`
 - `GraveMetaOf: GraveId -> { categories: u32, religion: u8 }`
 - `ModerationOf: GraveId -> { restricted: bool, removed: bool, reason_code: u8 }`
 - `ComplaintsByGrave: GraveId -> BoundedVec<Complaint>`
 - `NameIndex: blake2_256(lowercase(name)) -> BoundedVec<GraveId>`
 - `GraveAdmins: GraveId -> BoundedVec<AccountId>`（墓位管理员集合，供子模块只读引用）
- `SlugOf: GraveId -> BoundedVec<u8, SlugLen>`（10 位数字）
- `GraveBySlug: Slug -> GraveId`
- `JoinPolicyOf: GraveId -> u8`（0=Open,1=Whitelist）
- `Members: (GraveId, AccountId) -> ()`
- `PendingApplications: (GraveId, AccountId) -> BlockNumber`
- `FollowersOf / IsFollower / LastFollowAction / BannedFollowers`（关注相关：已停用）
- `CoverCidOf: GraveId -> Option<CID>`（墓地封面 CID）
- `LegacyFollowRefunds: AccountId -> Balance`（迁移退款口）

### 新增（公共封面目录）
- `CoverOptions: BoundedVec<CID, MaxCoverOptions>`：全局可选封面列表，仅治理可增删；任意墓地可选择其一作为封面。CID 明文保存（不加密）。

## 常量参数（由 runtime 注入）
- `MaxCidLen`：CID 最大字节数（建议 64）。
- `MaxPerPark`、`MaxIntermentsPerGrave`、`MaxIdsPerName`、`MaxComplaintsPerGrave`、`MaxAdminsPerGrave`、`SlugLen`、`MaxFollowers`。
- `FollowCooldownBlocks`、`FollowDeposit`（关注相关，已停用）。
- `CreateFee`/`FeeCollector`：创建费与收款账户。
- 新增：`MaxCoverOptions`：公共封面目录容量上限（例如 256）。

## Extrinsics
- `create_grave(park_id?: Option<ParkId>, name)`
- `update_grave(id, name?, active?, is_public?)`
- `transfer_grave(id, new_owner)`
- `set_park(id, park_id?)`
- `inter(id, deceased_id, slot?, note_cid?)`
- `exhume(id, deceased_id)`
- `set_meta(id, categories?, religion?)`
- `complain(id, cid)`
- `restrict(id, on, reason_code)` / `remove(id, reason_code)`
- `set_name_hash(id, name_hash)` / `clear_name_hash(id, name_hash)`
- `add_admin(id, who)` / `remove_admin(id, who)`
- `set_policy(id, policy)`（0/1）
- `join_open(id)` / `apply_join(id)` / `approve_member(id, who)` / `reject_member(id, who)`
- （停用）`set_visibility/follow/unfollow`
- `claim_legacy_follow_refund()`

### 封面相关
- `set_cover(id, cid)`：仅墓主；事件 `CoverSet { id }`。
- `clear_cover(id)`：仅墓主；事件 `CoverCleared { id }`。
- `set_cover_via_governance(id, cid)` / `clear_cover_via_governance(id)`：治理路径。
- 新增（公共目录）：
  - `add_cover_option(cid)`：仅治理；若存在则 `CoverOptionExists`；事件 `CoverOptionAdded {}`。
  - `remove_cover_option(cid)`：仅治理；若不存在则 `CoverOptionNotFound`；事件 `CoverOptionRemoved {}`。
  - `set_cover_from_option(id, index)`：仅墓主；按索引选择目录项；越界报 `InvalidCoverIndex`；事件 `CoverSet { id }`。

## 事件
- `CoverSet { id }`、`CoverCleared { id }`
- 新增：`CoverOptionAdded {}`、`CoverOptionRemoved {}`

## 押金/成熟/投诉规则
- 墓地封面设置沿用本模块既有权限模型；目录项由治理维护，建议免押金。
- IPFS 要求：CID 全局不加密；由前端/IPFS 网关渲染。

## 前端调用建议
- 墓地设置封面弹窗提供两种方式：
  1) 自定义 CID：上传至 IPFS，获取 CID 后调用 `set_cover` 或治理版。
  2) 从公共目录选择：读取 `CoverOptions` 展示网格，选择后调用 `set_cover_from_option`。
- Subsquid 建议订阅 `CoverOptionAdded/Removed` 与 `CoverSet/CoverCleared`，做缓存与审计。
