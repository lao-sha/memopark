# pallet-deceased-data（逝者数据：相册/视频集/数据项/留言/生平）

本模块在每位逝者（Deceased）名下维护多种内容容器与数据项，包含：
- 相册（Album）及图片排序/封面
- 视频集（VideoCollection）及主视频/排序
- 数据项（Data：Photo | Video | Audio | Article | Message）
- 留言（Message，未分类、按逝者聚合）
- 生平（Life，明文内容的 IPFS CID，自动随逝者创建，不可删除）

设计目标：
- 低耦合：通过 `DeceasedAccess` / `DeceasedTokenAccess` trait 与 `pallet-deceased` 交互，不直接依赖其内部存储结构。
- 隐私安全：链上仅存最小元数据、CID 与可选哈希，正文放链下（IPFS/HTTPS/Arweave）。
- 资金安全：通过押金（reserve）+ 成熟期 + 投诉/治理，减少恶意内容与争议风险。
- 边界清晰：相册仅承载图片；视频集仅承载音视频；文章可入相册；留言未分类按逝者聚合。

## 数据模型

### 类型
- `DeceasedId`：逝者 ID（来自 `pallet-deceased`）
- `AlbumId: u64`、`VideoCollectionId: u64`、`DataId: u64`
- `DataKind`：`Photo | Video | Audio | Article | Message`
- `Visibility`：`Public | Unlisted | Private`

### 结构
- `Album`：
  - `deceased_id`、`deceased_token`
  - `owner`、`title`、`desc`、`visibility`、`tags[]`
  - `primary_photo_id?`（主图）
  - `created/updated`
- `VideoCollection`：
  - `deceased_id`、`deceased_token`
  - `owner`、`title`、`desc`、`tags[]`
  - `primary_video_id?`（主视频）
  - `created/updated`
- `Data`（原 Media，最小元信息）：
  - 通用：`data_id`、`album_id?`、`video_collection_id?`、`deceased_id`、`deceased_token`、`owner`、`kind(DataKind)`
  - 资源：`uri`、`thumbnail_uri?`、`content_hash?([u8;32])`
  - 排序/时间：`order_index`、`created/updated`
  - 图片：`width?`、`height?`
  - 音视频：`duration_secs?`
  - 文章（Article）：`title?`、`summary?`（正文 JSON 以 IPFS CID 存 `uri`，其 blake2-256 存 `content_hash`）
  - 留言（Message）：未分类；`album_id=None`、`video_collection_id=None`；按 `deceased_id` 聚合；`uri` 可为文本或 IPFS CID（推荐 CID），`title/summary` 可选
- `Life`（生平，明文在 IPFS，链上存 CID；不可删除）：
  - `owner`：首个写入者（免押金修改）
  - `deceased_id`、`deceased_token`（life 唯一标识以 `deceased_id` 为准）
  - `cid`：生平正文 IPFS CID（可为空字符串）
  - `updated`、`version`、`last_editor?`（最近一次非 owner 修改者）

## 常量参数（由 runtime 提供，见 `runtime/src/configs/mod.rs`）
- 容量/长度：
  - `MaxAlbumsPerDeceased`
  - `MaxVideoCollectionsPerDeceased`
  - `MaxPhotoPerAlbum`
  - `StringLimit`（URI/标题/摘要/CID 等限长）
  - `MaxTags`
  - `MaxReorderBatch`
  - `MaxTokenLen`
  - `MaxMessagesPerDeceased`
- 押金/费用/周期：
  - `AlbumDeposit`、`VideoCollectionDeposit`、`DataDeposit`、`ComplaintDeposit`
  - `CreateFee`（创建小额费用）
  - `ComplaintPeriod`（成熟期：到期且无投诉可退款）
- 帐户/权限：
  - `GovernanceOrigin`（Root/内容治理账户）
  - `FeeCollector`（费用归集账户）
  - `ArbitrationAccount`（仲裁 5% 费用账户）

## 存储项
- 自增 ID：`NextAlbumId`、`NextVideoCollectionId`、`NextDataId`
- 主体：`AlbumOf`、`VideoCollectionOf`、`DataOf`
- 反向索引：`AlbumsByDeceased`、`VideoCollectionsByDeceased`
- 容器索引：`DataByAlbum`、`DataByVideoCollection`
- 留言索引：`MessagesByDeceased`（Message 未分类、按逝者聚合）
- 押金/成熟：`AlbumDeposits`、`VideoCollectionDeposits`、`DataDeposits`、`AlbumMaturity`、`VideoCollectionMaturity`、`DataMaturity`
- 治理辅助：`AlbumFrozen`、`VideoCollectionFrozen`、`DataHidden`
- 投诉计数：`AlbumComplaints`、`VideoCollectionComplaints`、`DataComplaints`
- 生平（Life）：`LifeOf`、`LifePrev`、`LifeDeposits`、`LifeMaturity`、`LifeComplaints`

## 事件（Events）
- Album：`AlbumCreated/Updated/Deleted`、`AlbumReordered`
- VideoCollection：`VideoCollectionCreated/Updated/Deleted/PrimaryChanged`、`VideoCollectionReordered`
- Data：`DataAdded`、`DataAddedToVideoCollection`、`DataUpdated`、`DataRemoved`、`DataMoved`
- 留言：`DataMessageAdded`
- 治理：`GovAlbumFrozen`、`GovDataHidden`、`GovDataReplaced`
- 投诉：`AlbumComplained`、`DataComplained`、`ComplaintResolved(domain,id,uphold)`、三类分账事件（Winner/Arbitration/LoserRefund）
- 押金退款：`AlbumDepositRefunded`、`DataDepositRefunded`
- 生平：`LifeCreated`、`LifeUpdated`、`LifeUpdatedByOthers`、`LifeComplained`、`LifeDepositRefunded`

## 错误码（Errors）
`DeceasedNotFound | NotAuthorized | AlbumNotFound | DataNotFound | TooMany | BadInput | MismatchDeceased | Overflow | DepositFailed | Frozen | Hidden | NotMatured | NoDepositToClaim | NoActiveComplaint`

## Extrinsics（外部可调用）

### 相册（Album）
- `create_album(deceased_id, title, desc, visibility, tags)`：校验逝者存在与管理权限；收取 `CreateFee` 与可退 `AlbumDeposit`；事件 `AlbumCreated`。
- `update_album(album_id, title?, desc?, visibility?, tags?, primary_photo_id??)`：仅 `owner`，可更新主图（需 kind=Photo 且属于本相册）。
- `delete_album(album_id)`：仅 `owner`；相册需为空；存在押金则设置 `AlbumMaturity = now + ComplaintPeriod`。
- `reorder_album(album_id, ordered_media)`：仅 `owner`；批量上限 `MaxReorderBatch`；同步写入 `order_index` 与容器索引。

### 视频集（VideoCollection）
- `create_video_collection(deceased_id, title, desc, tags)`：收取 `CreateFee` 与可退 `VideoCollectionDeposit`；事件 `VideoCollectionCreated`。
- `update_video_collection(video_collection_id, title?, desc?, tags?)`：仅 `owner`。
- `delete_video_collection(video_collection_id)`：需为空；存在押金则设置 `VideoCollectionMaturity`。
- `set_video_collection_primary(video_collection_id, media_id?)`：仅 `owner`；主视频需属于该视频集且为 Video/Audio。
- `reorder_video_collection(video_collection_id, ordered_media)`：仅 `owner`；批量上限 `MaxReorderBatch`。

### 数据（Data/Media）
- `add_data(container_kind, container_id?, kind, uri, thumbnail_uri?, content_hash?, title?, summary?, duration_secs?, width?, height?, order_index?)`
  - 行为/归属：
    - Photo → 仅 `container_kind=0`（相册）；`DataByAlbum`；事件 `DataAdded`
    - Video/Audio → 仅 `container_kind=1`（视频集）；`DataByVideoCollection`；事件 `DataAddedToVideoCollection`
    - Article → 仅 `container_kind=0`（相册），且必须提供 `content_hash`；支持 `title/summary`
    - Message → 仅 `container_kind=2`（未分类），`container_id=deceased_id`；`MessagesByDeceased`；事件 `DataMessageAdded`
  - 轻量校验：Photo（宽高>0）；Video/Audio（duration>0）；Article（需 content_hash）；Message（需 valid deceased_id）
  - 押金/成熟：若 `DataDeposit>0` 则 reserve 并设置 `DataMaturity=now+ComplaintPeriod`

- 移动（Move）
  - 跨容器：`move_data(data_id, to_kind(u8), to_id: Option<u64>)`
    - Photo → to_kind=0，相册之间移动（同一 `deceased_id`）
    - Video/Audio → to_kind=1，视频集之间移动（同一 `deceased_id`）
    - Article/Message → 不支持
  - 相册内：`move_data(data_id, to_album)`（保持 `deceased_id` 一致）

- 更新/删除
  - `update_data(data_id, uri?, thumbnail_uri??, content_hash??, title??, summary??, duration_secs??, width??, height??, order_index?)`
    - 冻结校验规则：
      - Photo/Article → 若在相册内，校验 `AlbumFrozen[album_id] == false`
      - Video/Audio → 若在视频集内，校验 `VideoCollectionFrozen[vsid] == false`
      - Message → 不依赖容器，跳过相册/视频集冻结校验（避免误报 BadInput）
  - `remove_data(data_id)`：仅支持 Photo 与 Message；Photo 从相册索引删除；Message 从 `MessagesByDeceased` 删除；设置 `DataMaturity` 以便到期退款

- 押金退款
  - `claim_album_deposit(album_id)`、`claim_data_deposit(data_id)`：到期且无投诉时 `unreserve` 退款，并清理记录

### 投诉与治理（Complaint/Governance）
- 投诉：`complain_album(album_id)`、`complain_data(data_id)`、`complain_life(deceased_id)`：保留 `ComplaintDeposit` 并累加计数（>0 阻断押金领取）
- 裁决：
  - `gov_resolve_album_complaint(album_id, uphold)`
  - `gov_resolve_data_complaint(data_id, uphold)`
  - `gov_resolve_life_complaint(deceased_id, uphold)`（维持时可回滚 Life 到 `LifePrev`，并对非 owner 修改押金 20/5/75 分账；驳回时对投诉押金 20/5/75 分账）
- 其他治理：`gov_freeze_album`、`gov_set_album_meta`、`gov_set_media_hidden`、`gov_replace_media_uri`、`gov_remove_data`

## 生平（Life）工作流
- 初始化：在 `pallet-deceased::create_deceased` 成功后，自动调用本模块创建 `Life`（以 `deceased_id` 为唯一标识），`cid` 为空（幂等）。
- 更新：
  - `update_life(deceased_id, cid)`
    - owner：免押金直接覆盖
    - 非 owner：reserve `DataDeposit`，保存旧 `cid` 至 `LifePrev`，写入 `LifeMaturity=now+ComplaintPeriod`
- 投诉/裁决：支持 `complain_life` / `gov_resolve_life_complaint`（见上）
- 押金领取：`claim_life_deposit(deceased_id)` 到期无投诉可退
- 不可删除：不提供删除接口

## 资金/成熟/投诉/治理时序（统一规则）
- 创建时：按对象 reserve 押金（Album/VideoCollection/Data/非 owner 的 Life 修改）
- 删除或裁决时：
  - 删除：设置成熟期，待 `ComplaintPeriod` 到期且无投诉才可退
  - 裁决（维持投诉）：按 20%（胜诉）/5%（仲裁）/75%（退款）分配被维持一侧押金；投诉押金全退投诉者
  - 裁决（驳回投诉）：按 20%/5%/75% 分配投诉押金；被投诉方押金保持成熟路径

## 权限模型与安全
- 访问控制：
  - 逝者存在性与管理权限通过 `DeceasedAccess` 适配器实现
  - 写操作（创建/更新/删除/移动/重排）均需 `owner` 且容器未冻结
- 治理：
  - `GovernanceOrigin` 可为 Root 或指定内容治理账户
  - 提供冻结/隐藏/替换/删除与裁决能力
- 防滥用：
  - 统一长度/容量限制（`BoundedVec` 等）
  - 押金 + 成熟期 + 投诉/治理 组合
  - Message 仅未分类、按逝者聚合，降低复杂索引成本

## 前端集成建议（Polkadot.js / Dedot / Subxt）
- 常量读取：`api.consts.deceasedData.maxMessagesPerDeceased`（示意）
- 存储读取：
  - 相册列表：`AlbumsByDeceased(deceasedId)` → 批量 `AlbumOf`
  - 视频集列表：`VideoCollectionsByDeceased(deceasedId)` → 批量 `VideoCollectionOf`
  - 相册内数据：`DataByAlbum(albumId)` → 批量 `DataOf`
  - 视频集内数据：`DataByVideoCollection(vsid)` → 批量 `DataOf`
  - 留言：`MessagesByDeceased(deceasedId)` → 批量 `DataOf`
  - 生平：`LifeOf(deceasedId)`
- 事件监听：新增/更新/治理/投诉与押金退款等事件可用于 UI 同步

## 版本与迁移
- 当前 `StorageVersion=2`（v1 → v2 增加 Article 的 title/summary）
- 历史重命名：Media → Data（接口与事件统一到 Data 语义）
- 如后续新增字段/结构，将通过 `on_runtime_upgrade` 进行安全迁移

## 兼容与边界
- Photo 仅相册；Video/Audio 仅视频集；Article 入相册；Message 未分类（按逝者）
- 用户删除仅限 Photo 与 Message；Video/Audio/Article 需治理删除（或后续扩展）
- Life 不可删除；owner 免押金修改，非 owner 修改需押金

---
以上为模块完整说明。若需更多示例（交易构造/前端交互）或对接 Dedot/Subxt 的具体用法，可参考 Polkadot 官方 SDK 文档并结合本文中的存储与事件名称进行调用。
# pallet-deceased-data

本模块用于在每位逝者（Deceased）名下维护多个相册（Album）与数据项（Data：照片/视频/文章）。
- 低耦合：通过 `DeceasedAccess` / `DeceasedTokenAccess` Trait 与 `pallet-deceased` 交互，避免直接依赖其内部实现。
- 隐私安全：链上仅存最小元数据与链下外链（IPFS/HTTPS/Arweave），可选内容哈希；不涉及 MEMO 资金。
- 限制控制：使用 `BoundedVec` 对字符串长度与集合数量进行约束，防止状态膨胀与 DoS。
- 冗余检查：仅存最小必要信息，排序/标签等可按需裁剪；建议链下索引服务承载复杂查询。
- 兼容迁移：预留向官方 `pallet-nfts` 迁移路径；并提供本模块存储版本迁移。

## 数据模型
- 类型
  - `DeceasedId`：逝者 ID（来自 `pallet-deceased`，通过适配器抽象）。
  - `AlbumId: u64`、`VideoCollectionId: u64`、`DataId: u64`。
  - `DataKind`：`Photo | Video | Audio | Article | Message`。
  - `Visibility`：`Public | Unlisted | Private`。
- 结构
  - `Album`：`deceased_id`、`deceased_token`、`owner`、`title`、`desc`、`visibility`、`tags[]`、`primary_photo_id?`（主图）、`created/updated`
  - `VideoCollection`：`deceased_id`、`deceased_token`、`owner`、`title`、`desc`、`tags[]`、`primary_video_id?`（主视频）、`created/updated`
  - `Data`：
    - 通用：`data_id`、`album_id?`、`video_collection_id?`（VideoCollectionId）、`deceased_id`、`deceased_token`、`owner`、`kind(DataKind)`、`uri`、`thumbnail_uri?`、`content_hash?([u8;32])`、`order_index`、`created/updated`
    - 图片：`width?`、`height?`
    - 音视频：`duration_secs?`
    - 文章（Article）：`title?`、`summary?`（正文 JSON 以 IPFS CID 存于 `uri`，其 blake2-256 存于 `content_hash`）
    - 留言（Message）：未分类，`album_id=None`、`video_collection_id=None`，按 `deceased_id` 索引；`uri` 可为文本或 IPFS CID，`title/summary` 可选

## 存储项
- `NextAlbumId: AlbumId`
- `NextVideoCollectionId: VideoCollectionId`
- `NextDataId: DataId`
- `AlbumOf: AlbumId -> Album`
- `VideoCollectionOf: VideoCollectionId -> VideoCollection`
- `DataOf: DataId -> Data`
- `AlbumsByDeceased: DeceasedId -> BoundedVec<AlbumId, MaxAlbumsPerDeceased>`
- `VideoCollectionsByDeceased: DeceasedId -> BoundedVec<VideoCollectionId, MaxVideoCollectionsPerDeceased>`
- `DataByAlbum: AlbumId -> BoundedVec<DataId, MaxMediaPerAlbum>`
- `DataByVideoCollection: VideoCollectionId -> BoundedVec<DataId, MaxMediaPerAlbum>`
 - `MessagesByDeceased: DeceasedId -> BoundedVec<DataId, MaxMessagesPerDeceased>`

### 押金/治理相关新增存储
- `AlbumDeposits: AlbumId -> (AccountId, Balance)`：相册押金
- `VideoCollectionDeposits: VideoCollectionId -> (AccountId, Balance)`：视频集押金
- `DataDeposits: DataId -> (AccountId, Balance)`：媒体押金
- `AlbumMaturity: AlbumId -> BlockNumber`：相册押金成熟区块（创建或删除时设置为 now+ComplaintPeriod）
- `VideoCollectionMaturity: VideoCollectionId -> BlockNumber`：视频集押金成熟区块
- `DataMaturity: DataId -> BlockNumber`：媒体押金成熟区块
- `AlbumFrozen: AlbumId -> bool`：相册冻结（被治理后 owner 不可写）
- `VideoCollectionFrozen: VideoCollectionId -> bool`：视频集冻结
- `DataHidden: DataId -> bool`：媒体隐藏（前端避免展示）
- `AlbumComplaints: AlbumId -> u32`、`VideoCollectionComplaints: VideoCollectionId -> u32`、`DataComplaints: DataId -> u32`：投诉计数（>0 将阻止退款）

## Extrinsics（外部可调用）
- 相册（Album）
  - `create_album(deceased_id, title, desc, visibility, tags)` → 事件 `AlbumCreated(album_id, deceased_id, owner)`
  - `update_album(album_id, title?, desc?, visibility?, tags?, primary_photo_id??)` → `AlbumUpdated(album_id)`
  - `delete_album(album_id)`（相册需为空）→ `AlbumDeleted(album_id)`
- 视频集（VideoCollection）
  - `create_video_collection(deceased_id, title, desc, tags)` → `VideoCollectionCreated(video_collection_id, deceased_id, owner)`
  - `update_video_collection(video_collection_id, title?, desc?, tags?)` → `VideoCollectionUpdated(video_collection_id)`
  - `delete_video_collection(video_collection_id)`（需为空）→ `VideoCollectionDeleted(video_collection_id)`
  - `set_video_collection_primary(video_collection_id, media_id?)` → `VideoCollectionPrimaryChanged(video_collection_id, media_id?)`
  - `reorder_video_collection(video_collection_id, ordered_media)`（批量上限 `MaxReorderBatch`）→ `VideoCollectionReordered(video_collection_id)`
- 数据（Data/Media）
  - `add_data(container_kind: u8(0=Album,1=VideoCollection,2=Uncategorized), container_id?: u64, kind(DataKind), uri, thumbnail_uri?, content_hash?, title?, summary?, duration_secs?, width?, height?, order_index?)`
    - 行为：
      - Photo → 仅允许 `container_kind=0`（相册）；写入 `DataByAlbum`，事件 `DataAdded(data_id, album_id)`
      - Video/Audio → 仅允许 `container_kind=1`（视频集）；写入 `DataByVideoCollection`，事件 `DataAddedToVideoCollection(data_id, video_collection_id)`
      - Article → 仅允许 `container_kind=0`（相册，与旧 `add_media` 一致）；需 `content_hash`，支持 `title/summary`
      - Message → 仅允许 `container_kind=2`（未分类），要求 `container_id=deceased_id`；写入 `MessagesByDeceased`，事件 `DataMessageAdded(data_id, deceased_id)`
    - 校验（轻量）：
      - Photo：若提供尺寸，则要求 `width>0 && height>0`
      - Video/Audio：若提供时长，则要求 `duration_secs>0`
      - Article：必须提供 `content_hash`
      - Message：需存在 `deceased_id`
  - `update_data(media_id, uri?, thumbnail_uri??, content_hash??, title??, summary??, duration_secs??, width??, height??, order_index?)` → `MediaUpdated(media_id)`
    - 校验（轻量）：同上，仅在提供对应字段时检查
  - `remove_data(data_id)` → `MediaRemoved(media_id)`（仅支持 Photo 与 Message；Message 为未分类留言，按逝者索引移除；Video/Audio/Article 用户删除暂不支持）
  - `move_data(data_id, to_album)`（必须同一 `deceased_id`）→ `MediaMoved(media_id, from_album, to_album)`
  - `reorder_album(album_id, ordered_media)`（批量上限 `MaxReorderBatch`）→ `AlbumReordered(album_id)`

### 投诉与押金退款
- `complain_album(album_id)`：投诉相册（累加计数 + 保留 ComplaintDeposit）→ 事件 `AlbumComplained(album_id, count)`
- `complain_data(media_id)`：投诉媒体（累加计数 + 保留 ComplaintDeposit）→ 事件 `MediaComplained(media_id, count)`
- `claim_album_deposit(album_id)`：领取相册押金（需到期且无投诉）→ 事件 `AlbumDepositRefunded(album_id, who, amount)`
- `claim_data_deposit(media_id)`：领取媒体押金（需到期且无投诉）→ 事件 `MediaDepositRefunded(media_id, who, amount)`

> 申诉存证：模块为每个目标（域：1=Album，2=Media）维护一条进行中的 `ComplaintCase`（含申诉人、押金、时间、状态）。

### 治理动作（不变更所有权）
- `gov_freeze_album(album_id, frozen)`：冻结/解冻相册
- `gov_set_album_meta(album_id, title?, desc?, visibility?, tags?, primary_photo_id??)`：治理修改相册元数据
- `gov_set_media_hidden(data_id, hidden)`：隐藏/取消隐藏媒体
- `gov_replace_media_uri(data_id, new_uri)`：替换媒体 URI（例如打码资源）
- `gov_remove_data(data_id)`：删除媒体（押金保留，删除后等待成熟可退）

#### 治理裁决与分账

- `gov_resolve_album_complaint(album_id, uphold: bool)`
- `gov_resolve_data_complaint(data_id, uphold: bool)`

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
- 当前 StorageVersion=2：已从 v1 迁移至 v2，新增 `DataKind::Article` 以及 `Data.title/summary` 字段；迁移逻辑将旧 `Media` 记录补齐为 `None` 默认值。
- Pallet 更名迁移：运行时在 `Migrations` 中追加了 `RenameDeceasedMediaToData`，会在升级时将存储前缀从 `DeceasedMedia` 迁移到 `DeceasedData`，不改变存储键结构与内容。
- 前端/客户端：原 `deceasedMedia` section 名已兼容解析，但建议尽快切换为 `deceasedData`。
- 运行时升级会在 `on_runtime_upgrade` 调用迁移；建议上线前使用 try-runtime 进行验证与权重审计。