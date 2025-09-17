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

- create_deceased(grave_id, name, name_badge, gender_code, bio, birth_ts, death_ts, links)
  - 新增：name_full_cid?（可选，链下全名 CID）→ 实际签名接口为
    `create_deceased(grave_id, name, name_badge, gender_code, bio, name_full_cid?, birth_ts, death_ts, links)`
  - 说明：
    - name_badge：姓名拼音徽标（仅 A-Z，大写，去空格/符号）；
    - gender_code：0=M，1=F，2=B；
    - birth_ts/death_ts：字符串，格式 YYYYMMDD（如 19811224），必填；
    - deceased_token：链上自动生成，不需作为参数传入，格式为 性别字母 + 出生 + 去世 + name_badge，例如 M1981122420250901LIUXIAODONG。
    - 可见性：创建时默认将 `VisibilityOf(id)` 设为 `true`（公开）。
    - 去重规则：创建前将按 `deceased_token` 做唯一性校验，若已存在相同 token，则拒绝创建并返回错误 `DeceasedTokenExists`。
- update_deceased(id, name?, name_badge?, gender_code?, bio?, birth_ts??, death_ts??, links?)
  - 新增：name_full_cid??（外层 Option 表示是否修改，内层 Option 表示设置/清空）
  - 说明：
    - birth_ts??/death_ts??：外层 Option 表示是否更新；内层 Option 表示设置为 Some(YYYYMMDD) 或 None（清空）。
    - 令牌约束：上述字段变更会导致 `deceased_token` 重新生成；若新 token 与他人记录冲突，将拒绝更新并返回 `DeceasedTokenExists`，不会移除旧 token 或写入新 token。
    - 所有权：`owner` 为创建者且永久不可更换；任何试图变更所有者的行为将被拒绝（OwnerImmutable）。
- remove_deceased(id)
  - 已禁用：为合规与审计保全，逝者创建后不可删除；本调用将始终返回 `DeletionForbidden`。
  - 替代方案：
    1) 使用 `transfer_deceased(id, new_grave)` 将逝者迁移至新的 GRAVE；
    2) 通过逝者关系功能，加入亲友团（族谱）以表示关联。
- transfer_deceased(id, new_grave)

- set_visibility(id, public)
  - 仅 Admin（含 owner）
  - 修改该逝者的公开可见性；默认公开（创建时已设为 true）

- set_main_image(id, cid)
  - 说明：设置/修改逝者主图（链下 CID，如 IPFS CID）。
  - 权限：owner 可直接调用；非 owner 需 Root 治理来源。
  - 校验：仅长度校验，使用 `TokenLimit` 限长；不做 URI 语义校验。
  - 事件：`MainImageUpdated(id, true)`。

- clear_main_image(id)
  - 说明：清空逝者主图。
  - 权限：owner 或 Root。
  - 事件：`MainImageUpdated(id, false)`。

权限：
- 创建/迁移：`GraveProvider::can_attach(who, grave_id)`。
  - 判定规则（单一权威源：`pallet-memo-grave`）：
    - 若 `who` 为墓主 → 允许
    - 若 `who` 在 `pallet-memo-grave::GraveAdmins[grave_id]` 中 → 允许
    - 若 `who` 为墓位所在陵园的管理员（`ParkAdminOrigin::ensure(park_id, Signed(who))` 通过）→ 允许
- 修改：记录 `owner`；删除已禁用（参见上文）。

## 存储
- NextDeceasedId: DeceasedId
- DeceasedOf: DeceasedId -> Deceased
- DeceasedByGrave: GraveId -> BoundedVec<DeceasedId>
- VisibilityOf: DeceasedId -> bool（OptionQuery；None 视作 true）

### Deceased 结构体
- 增加字段：
  - name_badge: BoundedVec<u8>（仅 A-Z 大写）
  - gender: 枚举 M/F/B
  - birth_ts: Option<BoundedVec<u8>>（YYYYMMDD）
  - death_ts: Option<BoundedVec<u8>>（YYYYMMDD）
  - deceased_token: BoundedVec<u8>（自动生成：gender+birth+death+name_badge）
  - name_full_cid: Option<BoundedVec<u8>>（完整姓名链下指针，建议前端通过该 CID 展示全名）
  - main_image_cid: Option<BoundedVec<u8>>（主图 CID；用于头像/主图展示）

### 迁移
- StorageVersion = 2：
  - 从旧版 (v1) 迁移至新版：
    - 将旧记录填充为 gender=B、birth_ts/death_ts=None；
    - name_badge 由旧 name 上按规则提取（仅 A-Z 大写）；
    - 生成 deceased_token。
- StorageVersion = 3：
  - 从 v2 迁移至 v3：新增 `name_full_cid=None`，不改变既有字段含义。
- StorageVersion = 5：
  - 从 v4 迁移至 v5：为 `Deceased` 新增 `main_image_cid=None` 字段。

## 逝者↔逝者关系（族谱）
- 存储：
  - `Relations: (from, to) -> { kind: u8, note: BoundedVec<u8>, created_by, since }`
  - `RelationsByDeceased: deceased -> BoundedVec<(peer, kind)>`
  - `PendingRelationRequests: (from, to) -> (kind, requester, note, created)`
- Extrinsics：
  - `propose_relation(from, to, kind, note?)`（A方管理员）
  - `approve_relation(from, to)` / `reject_relation(from, to)`（B方管理员）
  - `revoke_relation(from, to)`（任一方管理员）
  - `update_relation_note(from, to, note?)`
- 事件：RelationProposed/Approved/Rejected/Revoked/Updated

### 关系规范与迁移
- 方向：0=ParentOf（有向），1=SpouseOf（无向），2=SiblingOf（无向），3=ChildOf（有向）。
- 无向 canonical：存储使用 `(min(id1), max(id2))` 单条记录，并在 `RelationsByDeceased` 为双方写索引；撤销时对称移除索引。
- 冲突矩阵：父母/子女 与 配偶/兄弟姐妹互斥；父母 与 子女互斥（方向相反视为同类）。
- 去重：主记录与 Pending 均做无向对称去重与冲突校验。
- 迁移：StorageVersion=1（`on_runtime_upgrade` 写入版本），为后续状态机与押金/TTL 迁移预留。

## 亲友团（Friends）

- 存储：
  - `FriendPolicyOf: DeceasedId -> { require_approval, is_private, max_members }`
  - `FriendsOf: (DeceasedId, AccountId) -> { role: Member|Core|Admin, since, note }`
  - `FriendCount: DeceasedId -> u32`
  - `FriendJoinRequests: DeceasedId -> BoundedVec<(AccountId, BlockNumber), MaxPending>`
- Extrinsics：
  - `set_friend_policy(deceased_id, require_approval, is_private, max_members)`（Admin/owner）
  - `request_join(deceased_id, note?)`（若无需审批则直接入团）
  - `approve_join(deceased_id, who)` / `reject_join(deceased_id, who)`（Admin）
  - `leave_friend_group(deceased_id)`（成员自愿退出）
  - `kick_friend(deceased_id, who)`（Admin）
  - `set_friend_role(deceased_id, who, role)`（Admin；owner 恒视为 Admin）
- 说明：
  - 亲友团以逝者为主体；墓位不再承载关注/亲友能力（见 `pallet-memo-grave` 方案B）。
  - `is_private=true` 时，成员明细仅 Admin 可见；对外仅暴露 `FriendCount`。

### 迁移
- StorageVersion = 4：引入亲友团存储，默认空；原有数据不受影响。

### 前端入口
- 在 DApp 的 “亲友团” 标签页提供最小操作入口（策略设置、申请/审批、退出/移出、设角色）。

## 安全与隐私
- 不在链上存储敏感个人信息；仅存少量文本与链下链接（IPFS/HTTPS 等）。
- 不进行任何 MEMO 代币相关操作，避免资金风险。
- 字段长度、数量受限，防止滥用与状态膨胀。

## 冗余与迁移
- 若墓位以 NFT/唯一资产表示，可复用官方 `pallet-nfts` 管理所有权，本模块仅做“关系与最小元数据”。
- 可在未来增加与 `pallet-nfts` 的映射字段，平滑迁移。


