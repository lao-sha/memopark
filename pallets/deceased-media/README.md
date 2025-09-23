# pallet-deceased-media（媒体域：相册/视频集/媒体）

## 目标
- 管理逝者关联的媒体内容（Photo/Video/Audio）。
- 上链仅存指纹/URI 等最小必要元数据，原文存储用 IPFS/对象存储。
- 支持押金、成熟期与治理操作，防垃圾与合规可控。

## 接口概览（Extrinsics）
- 用户入口（签名账户）：
  - `create_album(deceased_id, title, desc, visibility, tags)`：创建相册（创建费+相册押金）。
  - `create_video_collection(deceased_id, title, desc, tags)`：创建视频集（创建费+押金）。
  - `add_media(container_kind, container_id, kind, uri, thumbnail_uri?, content_hash?, duration_secs?, width?, height?, order_index?)`：添加媒体。
  - `update_media(media_id, ...)`：更新媒体。
  - `remove_media(media_id)`：删除媒体（押金成熟后可退）。
  - `claim_album_deposit(album_id)`/`claim_media_deposit(media_id)`：领取押金（到期）。
- 治理入口（仅 `GovernanceOrigin`）：
  - `gov_freeze_album(album_id, frozen)`：冻结/解冻相册。
  - `gov_set_media_hidden(media_id, hidden)`：隐藏/取消隐藏媒体。
  - `gov_replace_media_uri(media_id, new_uri)`：替换媒体 URI（涉敏打码等）。
  - `gov_remove_media(media_id)`：治理移除，押金成熟后可退。
  - `gov_freeze_video_collection(video_id, frozen)`：冻结/解冻视频集。
- 无私钥治理落地（代用户最终写入）：
  - `gov_create_album_for(owner, deceased_id, ...)`
  - `gov_add_media_for(owner, container_kind, container_id, kind, ...)`

## 存储
- `AlbumOf/VideoCollectionOf/MediaOf` 基础映射
- 关联索引：`AlbumsByDeceased/VideoCollectionsByDeceased/MediaByAlbum/MediaByVideoCollection`
- 押金与成熟：`AlbumDeposits/MediaDeposits` + `AlbumMaturity/MediaMaturity`
- 风控：`AlbumFrozen/VideoCollectionFrozen/MediaHidden`
- 版本：`Album/VideoCollection/Media` 结构新增 `version: u32` 字段

## 押金与成熟规则
- 创建相册/视频集/媒体将保留押金（`AlbumDeposit/VideoCollectionDeposit/MediaDeposit`）。
- 删除或治理移除后设置成熟时间（`ComplaintPeriod`），到期且无治理阻断即可通过 `claim_*_deposit` 退还押金。
- 创建相册/视频集时收取小额创建费（`CreateFee`）进入费用账户（国库派生地址）。

## 权限
- 用户操作要求 `DeceasedProvider.can_manage(who, deceased_id)` 为真（通常为墓主/管理员）。
- 治理操作由 `GovernanceOrigin` 执行（Root/内容委员会阈值）。
- 统一治理校验：自本次更新起，所有 `gov_*` 接口使用内部辅助 `ensure_gov(origin)` 校验治理起源；
   未授权将统一返回模块内错误 `NotAuthorized`，便于前端与索引统一处理。

## 强制接口与路由码表（示例）
- 内容治理路由 `domain/action`：
  - 媒体域：`(4,30)` 隐藏媒体、`(4,31)` 替换 URI、`(4,32)` 冻结视频集。
  - 文本域：`(3,20)` 移除悼词、`(3,21)` 强制删除文本、`(3,22)` 治理编辑文本、`(3,23)` 设置生平。
  - 逝者域：`(2,1)` 设为可见、`(2,2)` 清空主图、`(2,3)` 设置主图。

## 与前端的使用建议
- 仅存 CID/URI 与尺寸/时长等元信息；原图/视频走 IPFS/外部对象存储。
- 图片需校验宽高>0；视频/音频需校验时长>0。
- 读取版本：更新后会触发事件 `VersionRecorded(kind, id, version, editor)` 用于审计与 UI 展示。
- 主图联动：当删除/隐藏某媒体且该媒体为逝者主图/相册封面/视频集主视频时，模块会自动清空对应主图并自增容器版本。

## 委员会阈值 + 申诉治理流程（ContentCommittee 2/3）
1. 申诉提交：任何账户在 `#/gov/appeal` 提交包含 `domain/action/target/reason_cid/evidence_cid` 的申诉；链上冻结 `AppealDeposit`。
2. 审批与公示：内容委员会（2/3）通过 `approve_appeal` 进入 `NoticeDefaultBlocks` 公示；若 `reject/withdraw` 则按 `RejectedSlashBps/WithdrawSlashBps` 罚没至国库。
3. 到期执行：`execute_approved` 路由到本模块 `gov_*` 执行（记录证据事件，CID 明文不加密）：
   - `(4,30)` → `gov_set_media_hidden(media_id, true, evidence_cid)`
   - `(4,31)` → `gov_replace_media_uri(media_id, new_uri, evidence_cid)`
   - `(4,32)` → `gov_freeze_video_collection(video_id, true, evidence_cid)`
4. 限频控制与模板：按 `WindowBlocks/MaxPerWindow` 控制频率；前端 `#/gov/templates` 提供常用动作模板与 target 填写提示。

## 运行时参数（示例）
- `AlbumDeposit=0.02 UNIT`、`MediaDeposit=0.005 UNIT`、`CreateFee=0.001 UNIT`
- `ComplaintPeriod=365 天`
