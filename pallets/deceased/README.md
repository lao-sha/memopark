# Deceased Pallet

- 设计说明：
  - 新增只读字段 `creator`（不可变）：记录首次创建该逝者的签名账户，用于审计/治理/统计，不参与权限与派生。
  - 资金派生与计费：依赖 `(domain, subject_id)` 稳定派生（与 `creator/owner` 解耦）。

- 迁移策略（开发阶段）：
  - 当前主网未上线，采用“零迁移”策略：`on_runtime_upgrade` 仅写入 `STORAGE_VERSION`，不进行 translate。
  - 如需结构调整，请清链/重启以应用最新结构；主网前再补充精确迁移逻辑。

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
    /// 治理起源（Root | 内容委员会阈值），用于 gov* 接口
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        ContentAtLeast2of3
    >;
}
```

## Extrinsics

- create_deceased(grave_id, name, gender_code, birth_ts, death_ts, links, name_full_cid?)
  - 说明：
    - gender_code：0=M，1=F，2=B；
    - birth_ts/death_ts：字符串，格式 YYYYMMDD（如 19811224），必填；
    - deceased_token：链上自动生成，不需作为参数传入；格式（原始字节）为
      `gender(1字节大写) + birth(8字节) + death(8字节) + blake2_256(name_norm)`，总长 49 字节。
      - name_norm：去首尾空格、压缩连续空格为单个 0x20，a-z→A-Z，非 ASCII 字节原样保留。
      - birth/death 缺省用 "00000000"。
    - 可见性：创建时默认将 `VisibilityOf(id)` 设为 `true`（公开）。
    - 去重规则：创建前将按 `deceased_token` 做唯一性校验，若已存在相同 token，则拒绝创建并返回错误 `DeceasedTokenExists`。
- update_deceased(id, name?, gender_code?, name_full_cid??, birth_ts??, death_ts??, links?)
  - 新增：name_full_cid??（外层 Option 表示是否修改，内层 Option 表示设置/清空）
  - 说明：
    - birth_ts??/death_ts??：外层 Option 表示是否更新；内层 Option 表示设置为 Some(YYYYMMDD) 或 None（清空）。
    - 令牌约束：上述字段变更会导致 `deceased_token` 重新生成（规则同上）；若新 token 与他人记录冲突，将拒绝更新并返回 `DeceasedTokenExists`，不会移除旧 token 或写入新 token。
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
- DeceasedHistory: DeceasedId -> Vec<VersionEntry{version, editor, at}>, 最多 512 条

### Deceased 结构体
- 字段：
  - gender: 枚举 M/F/B
  - birth_ts: Option<BoundedVec<u8>>（YYYYMMDD）
  - death_ts: Option<BoundedVec<u8>>（YYYYMMDD）
  - deceased_token: BoundedVec<u8>（自动生成：gender+birth(8)+death(8)+blake2_256(name_norm)）
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

### 版本与事件（新增）
- 结构 `Deceased` 新增字段 `version: u32`（从 1 起）。
- 每次资料修改（`update_deceased`、`gov_update_profile`）将自增 `version`，并将 {version, editor, at} 追加到 `DeceasedHistory`。
- 相关事件：沿用 `DeceasedUpdated(id)`；前端/索引可据此读取最新版本并查询历史。

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

## 治理专用接口（gov*）与“失钥救济”

- 设计目标：当 `owner` 私钥丢失或出现内容合规问题时，通过治理通道执行必要的 C/U/D 行为，且保证可审计与可回溯。
- 起源：`Config::GovernanceOrigin`（Root 或 内容委员会 2/3）。
- 证据：所有 gov* 接口都要求携带 `evidence_cid`（IPFS/HTTPS 明文），模块会发出 `GovEvidenceNoted(id, cid)` 事件。

### 接口与事件

- `gov_update_profile(id, name?, name_badge?, gender_code?, name_full_cid??, birth_ts??, death_ts??, links?, evidence_cid)`
  - 功能：治理更新资料（不改 owner）。
  - 流程：记录证据事件 → 按传入字段更新 → 重建 `deceased_token` 并维护唯一索引 → 事件 `DeceasedUpdated(id)`。
  - 失败：若新 token 冲突，返回 `DeceasedTokenExists`。

- `gov_transfer_deceased(id, new_grave, evidence_cid)`
  - 功能：治理迁移逝者到新墓位（不改 owner）。
  - 校验：新墓位存在与软上限；写入/移除 grave 下索引；事件 `DeceasedTransferred(id, from, to)`。

- `gov_set_visibility(id, public, evidence_cid)`
  - 功能：治理设置可见性（不要求 owner/Admin）。
  - 事件：`VisibilityChanged(id, public)`。

- `gov_set_main_image(id, cid?, evidence_cid)`
  - 功能：治理设置/清空主图（CID）。
  - 事件：`GovMainImageSet(id, set)`。

- 统一事件：`GovEvidenceNoted(id, cid)`（每次治理动作都记录最近证据）。

### 委员会阈值 + 申诉治理流程
- 申诉：前端 `#/gov/appeal` 提交 `domain/action/target/reason_cid/evidence_cid`；链上冻结押金。
- 审批：内容委员会 2/3 通过后进入公示期；若驳回/撤回，按比例罚没至国库。
- 执行：公示期满路由至本模块 `gov_*` 执行并记录证据；CID 明文保存（不加密）。
- 模板：前端 `#/gov/templates` 提供常用动作快捷说明。


