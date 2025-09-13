# pallet-deceased-media

本模块用于在每位逝者（Deceased）名下维护多个相册（Album）与媒体项（Media：照片/视频）。
- 低耦合：通过 `DeceasedAccess` Trait 与 `pallet-deceased` 交互，避免直接依赖其内部实现。
- 隐私安全：链上仅存最小元数据与链下外链（IPFS/HTTPS/Arweave），可选内容哈希；不涉及 MEMO 资金。
- 限制控制：使用 `BoundedVec` 对字符串长度与集合数量进行约束，防止状态膨胀与 DoS。
- 冗余检查：仅存最小必要信息，排序/标签等可按需裁剪；建议链下索引服务承载复杂查询。
- 兼容迁移：预留向官方 `pallet-nfts` 迁移路径。

## 数据模型
- 类型
  - `DeceasedId`：逝者 ID（来自 `pallet-deceased`，通过适配器抽象）。
  - `AlbumId: u64`、`MediaId: u64`。
  - `MediaKind`：`Photo | Video | Audio`。
  - `Visibility`：`Public | Unlisted | Private`。
- 结构
  - `Album`：`deceased_id`、`deceased_token`、`owner`、`title`、`desc`、`visibility`、`tags[]`、`cover_media_id?`、`created/updated`
  - `Media`：`album_id`、`deceased_id`、`deceased_token`、`owner`、`kind`、`uri`、`thumbnail_uri?`、`content_hash?([u8;32])`、`duration_secs?`、`width?`/`height?`、`order_index`、`created/updated`

## 存储项
- `NextAlbumId: AlbumId`
- `NextMediaId: MediaId`
- `AlbumOf: AlbumId -> Album`
- `MediaOf: MediaId -> Media`
- `AlbumsByDeceased: DeceasedId -> BoundedVec<AlbumId, MaxAlbumsPerDeceased>`
- `MediaByAlbum: AlbumId -> BoundedVec<MediaId, MaxMediaPerAlbum>`

### 押金/治理相关新增存储
- `AlbumDeposits: AlbumId -> (AccountId, Balance)`：相册押金
- `MediaDeposits: MediaId -> (AccountId, Balance)`：媒体押金
- `AlbumMaturity: AlbumId -> BlockNumber`：相册押金成熟区块（创建或删除时设置为 now+ComplaintPeriod）
- `MediaMaturity: MediaId -> BlockNumber`：媒体押金成熟区块
- `AlbumFrozen: AlbumId -> bool`：相册冻结（被治理后 owner 不可写）
- `MediaHidden: MediaId -> bool`：媒体隐藏（前端避免展示）
- `AlbumComplaints: AlbumId -> u32`、`MediaComplaints: MediaId -> u32`：投诉计数（>0 将阻止退款）

## Extrinsics（外部可调用）
- 相册
  - `create_album(deceased_id, title, desc, visibility, tags)` → 事件 `AlbumCreated(album_id, deceased_id, owner)`
  - `update_album(album_id, title?, desc?, visibility?, tags?, cover_media_id??)` → `AlbumUpdated(album_id)`
  - `delete_album(album_id)`（相册需为空）→ `AlbumDeleted(album_id)`
- 媒体
  - `add_media(album_id, kind, uri, thumbnail_uri?, content_hash?, duration_secs?, width?, height?, order_index?)` → `MediaAdded(media_id, album_id)`
    - 校验（轻量）：
      - Photo：若提供尺寸，则要求 `width>0 && height>0`
      - Video/Audio：若提供时长，则要求 `duration_secs>0`
  - `update_media(media_id, uri?, thumbnail_uri??, content_hash??, duration_secs??, width??, height??, order_index?)` → `MediaUpdated(media_id)`
    - 校验（轻量）：同上，仅在提供对应字段时检查
  - `remove_media(media_id)` → `MediaRemoved(media_id)`
  - `move_media(media_id, to_album)`（必须同一 `deceased_id`）→ `MediaMoved(media_id, from_album, to_album)`
  - `reorder_album(album_id, ordered_media)`（批量上限 `MaxReorderBatch`）→ `AlbumReordered(album_id)`

### 投诉与押金退款
- `complain_album(album_id)`：投诉相册（累加计数 + 保留 ComplaintDeposit）→ 事件 `AlbumComplained(album_id, count)`
- `complain_media(media_id)`：投诉媒体（累加计数 + 保留 ComplaintDeposit）→ 事件 `MediaComplained(media_id, count)`
- `claim_album_deposit(album_id)`：领取相册押金（需到期且无投诉）→ 事件 `AlbumDepositRefunded(album_id, who, amount)`
- `claim_media_deposit(media_id)`：领取媒体押金（需到期且无投诉）→ 事件 `MediaDepositRefunded(media_id, who, amount)`

> 申诉存证：模块为每个目标（域：1=Album，2=Media）维护一条进行中的 `ComplaintCase`（含申诉人、押金、时间、状态）。

### 治理动作（不变更所有权）
- `gov_freeze_album(album_id, frozen)`：冻结/解冻相册
- `gov_set_album_meta(album_id, title?, desc?, visibility?, tags?, cover_media_id??)`：治理修改相册元数据
- `gov_set_media_hidden(media_id, hidden)`：隐藏/取消隐藏媒体
- `gov_replace_media_uri(media_id, new_uri)`：替换媒体 URI（例如打码资源）
- `gov_remove_media(media_id)`：删除媒体（押金保留，删除后等待成熟可退）

#### 治理裁决与分账

- `gov_resolve_album_complaint(album_id, uphold: bool)`
- `gov_resolve_media_complaint(media_id, uphold: bool)`

分账规则（罚金治理）：

- 设上传侧押金为 D。
- uphold=true（维持投诉）：
  - 目标：20% D → 胜诉（投诉方）；5% D → ArbitrationAccount；75% D → 败诉（上传方）退回。
  - 当前实现：由于未记录投诉人账户，暂仅发放 5% 仲裁并将 75% 退回上传者，20% 保留（后续版本将补 ComplaintOf 以正确转至胜诉方）。
- uphold=false（驳回投诉）：
  - 目标：胜诉为上传者，获得 20% D；5% D → ArbitrationAccount；75% D → 败诉（投诉方）退回。
  - 当前实现：未记录投诉方，临时将 95%（20%+75%）释放给上传者，并发放 5% 至 ArbitrationAccount。

事件：
- `ComplaintResolved(domain, id, uphold)`
- `ComplaintPayoutWinner(AccountId, Balance)`
- `ComplaintPayoutArbitration(AccountId, Balance)`
- `ComplaintPayoutLoserRefund(AccountId, Balance)`

## 权限模型
- 访问控制通过 `DeceasedAccess<AccountId, DeceasedId>` 适配器实现：
  - `deceased_exists(id) -> bool`：校验逝者是否存在。
  - `can_manage(who, deceased_id) -> bool`：校验操作者是否可管理该逝者（通常为 `pallet-deceased` 记录的 `owner` 或授权者）。
- 相册与媒体的所有权（`owner`）继承自创建者；更新/删除/移动/重排仅限 `owner`。

## 常量参数（默认值见 runtime 配置）
- `MaxAlbumsPerDeceased: u32`：每位逝者最多相册数（默认 64）。
- `MaxMediaPerAlbum: u32`：每个相册最多媒体项数（默认 256）。
- `StringLimit: u32`：字符串长度上限（标题/描述/URI/标签，默认 512）。
- `MaxTags: u32`：相册标签最大数量（默认 16）。
- `MaxReorderBatch: u32`：单次重排最大媒体数量（默认 100）。
  
### 押金/费用/成熟期
- `AlbumDeposit: Balance`：创建相册时需保留押金（示例 0.02 UNIT）。
- `MediaDeposit: Balance`：添加媒体时需保留押金（示例 0.005 UNIT）。
- `CreateFee: Balance`：小额创建费（示例 0.001 UNIT），转入 `FeeCollector`（国库）。
- `ComplaintPeriod: BlockNumber`：投诉观察/成熟期（默认约 1 年）。
 - `ComplaintDeposit: Balance`：发起申诉时保留的押金（complain_*）。
 - `ArbitrationAccount: AccountId`：治理裁决中收取 5% 仲裁费用的账户。
 - `MaxTokenLen: u32`：从 `pallet-deceased` 缓存 `deceased_token` 的最大长度。

## 运行时集成（Config 示例）
```rust
impl pallet_deceased_media::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type AlbumId = u64;
    type MediaId = u64;
    type MaxAlbumsPerDeceased = MediaMaxAlbumsPerDeceased;
    type MaxMediaPerAlbum = MediaMaxMediaPerAlbum;
    type StringLimit = MediaStringLimit;
    type MaxTags = MediaMaxTags;
    type MaxReorderBatch = MediaMaxReorderBatch;
    type DeceasedProvider = DeceasedProviderAdapter; // 由 runtime 提供
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
    type Currency = Balances;
    type AlbumDeposit = MediaAlbumDeposit;
    type MediaDeposit = MediaMediaDeposit;
    type CreateFee = MediaCreateFee;
    type FeeCollector = TreasuryAccount;
    type ComplaintPeriod = MediaComplaintPeriod;
}
```

### 适配器实现示例（与 pallet-deceased 低耦合）
```rust
pub struct DeceasedProviderAdapter;
impl pallet_deceased_media::DeceasedAccess<AccountId, u64> for DeceasedProviderAdapter {
    fn deceased_exists(id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(id)
    }
    fn can_manage(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) {
            d.owner == *who
        } else { false }
    }
}
```

## 查询与索引建议
- 链上：
  - 通过 `AlbumsByDeceased(deceased_id)` 获取相册列表。
  - `MediaByAlbum(album_id)` 获取相册内媒体列表。
  - `AlbumOf/MediaOf` 获取详情。
- 链下：
  - 建议用索引服务（SubQuery/The Graph 等）做分页、组合筛选、排序（含 `order_index`）。

## 隐私与安全
- 不上链原始多媒体；仅存 `uri` 与可选 `content_hash`（如 blake2/sha256）。
- 私密内容可采用“加密 URI + 链下密钥分发”模式（`visibility = Private`）。
- 使用可保留押金机制（reserve/unreserve），配合成熟期与投诉计数，避免刷量与不当内容；小额手续费转入国库地址。
- 严格的长度/数量上限防止状态膨胀与 DoS。

## 与 pallet-nfts 的迁移路径（可选升级）
- 目标映射：
  - 每位逝者 → 一个 Collection；每条媒体 → 一个 Item；相册作为 Item 属性或单独“相册集合”。
- 过渡方案：
  - 批量迁移：将现有相册/媒体铸造成 NFT，写回映射字段（如 `collection_id/item_id`），稳定后改读 NFT。
  - 双写方案：新数据同时写入本模块与 NFT，灰度期后切换只读 NFT。
- 押金策略建议由平台账户统一承担，避免用户 MEMO 误锁。

## 版本与迁移
- 当前未实现 `OnRuntimeUpgrade` 迁移逻辑；如未来调整存储结构，建议按 FRAME 迁移流程实现 `pre_upgrade`/`on_runtime_upgrade`/`post_upgrade` 并配合 try-runtime 进行验证。

---
- 本模块已按“低耦合、隐私安全、资金安全、冗余可控、可迁移”的原则实现；若需扩展共享相册编辑者、内容治理（屏蔽/举报）等，可在此基础上增加适配接口与状态字段。
