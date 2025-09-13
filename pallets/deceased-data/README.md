# pallet-deceased-media

本模块用于在每位逝者（Deceased）名下维护多个相册（Album）与媒体项（Media：照片/视频/文章）。
- 低耦合：通过 `DeceasedAccess` / `DeceasedTokenAccess` Trait 与 `pallet-deceased` 交互，避免直接依赖其内部实现。
- 隐私安全：链上仅存最小元数据与链下外链（IPFS/HTTPS/Arweave），可选内容哈希；不涉及 MEMO 资金。
- 限制控制：使用 `BoundedVec` 对字符串长度与集合数量进行约束，防止状态膨胀与 DoS。
- 冗余检查：仅存最小必要信息，排序/标签等可按需裁剪；建议链下索引服务承载复杂查询。
- 兼容迁移：预留向官方 `pallet-nfts` 迁移路径；并提供本模块存储版本迁移。

## 数据模型
- 类型
  - `DeceasedId`：逝者 ID（来自 `pallet-deceased`，通过适配器抽象）。
  - `AlbumId: u64`、`MediaId: u64`。
  - `MediaKind`：`Photo | Video | Audio | Article`。
  - `Visibility`：`Public | Unlisted | Private`。
- 结构
  - `Album`：`deceased_id`、`deceased_token`、`owner`、`title`、`desc`、`visibility`、`tags[]`、`cover_media_id?`、`created/updated`
  - `Media`：
    - 通用：`album_id`、`deceased_id`、`deceased_token`、`owner`、`kind`、`uri`、`thumbnail_uri?`、`content_hash?([u8;32])`、`order_index`、`created/updated`
    - 图片：`width?`、`height?`
    - 音视频：`duration_secs?`
    - 文章（Article）：`title?`、`summary?`（正文 JSON 以 IPFS CID 存于 `uri`，其 blake2-256 存于 `content_hash`）

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
  - `add_media(album_id, kind, uri, thumbnail_uri?, content_hash?, title?, summary?, duration_secs?, width?, height?, order_index?)` → `MediaAdded(media_id, album_id)`
    - 校验（轻量）：
      - Photo：若提供尺寸，则要求 `width>0 && height>0`
      - Video/Audio：若提供时长，则要求 `duration_secs>0`
      - Article：必须提供 `content_hash`
  - `update_media(media_id, uri?, thumbnail_uri??, content_hash??, title??, summary??, duration_secs??, width??, height??, order_index?)` → `MediaUpdated(media_id)`
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

分账规则（罚金治理）（Scheme B）：

- 设上传侧押金为 D，申诉侧押金为 C。
- uphold=true（维持投诉）：
  - 上传侧押金 D：20% → 投诉方；5% → ArbitrationAccount；75% → 上传方退回。
  - 申诉侧押金 C：100% → 投诉方退回。
- uphold=false（驳回投诉）：
  - 申诉侧押金 C：20% → 上传方；5% → ArbitrationAccount；75% → 投诉方退回。
  - 上传侧押金 D：按原成熟路径不动（成熟后可按押金退款路径领取）。

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
- `
```
## 版本与迁移
- 当前 StorageVersion=2：已从 v1 迁移至 v2，新增 `MediaKind::Article` 以及 `Media.title/summary` 字段；迁移逻辑将旧 `Media` 记录补齐为 `None` 默认值。
- 运行时升级会在 `on_runtime_upgrade` 调用迁移；建议上线前使用 try-runtime 进行验证与权重审计。