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
- 无私钥治理落地（代用户最终写入）：
  - `gov_create_album_for(owner, deceased_id, ...)`
  - `gov_add_media_for(owner, container_kind, container_id, kind, ...)`

## 存储
- `AlbumOf/VideoCollectionOf/MediaOf` 基础映射
- 关联索引：`AlbumsByDeceased/VideoCollectionsByDeceased/MediaByAlbum/MediaByVideoCollection`
- 押金与成熟：`AlbumDeposits/MediaDeposits` + `AlbumMaturity/MediaMaturity`
- 风控：`AlbumFrozen/VideoCollectionFrozen/MediaHidden`

## 押金与成熟规则
- 创建相册/视频集/媒体将保留押金（`AlbumDeposit/VideoCollectionDeposit/MediaDeposit`）。
- 删除或治理移除后设置成熟时间（`ComplaintPeriod`），到期且无治理阻断即可通过 `claim_*_deposit` 退还押金。
- 创建相册/视频集时收取小额创建费（`CreateFee`）进入费用账户（国库派生地址）。

## 权限
- 用户操作要求 `DeceasedProvider.can_manage(who, deceased_id)` 为真（通常为墓主/管理员）。
- 治理操作由 `GovernanceOrigin` 执行（Root/内容治理签名账户）。

## 与前端的使用建议
- 仅存 CID/URI 与尺寸/时长等元信息；原图/视频走 IPFS/外部对象存储。
- 图片需校验宽高>0；视频/音频需校验时长>0。

## 无私钥 + 有押金（代付治理）流程（与 forwarder + OpenGov 配合）
1. 前端上传媒体至 IPFS，取回 CID/URI。
2. 后端组装真实调用：
   - Photo: `DeceasedMedia.gov_add_media_for(owner, 0, album_id, 0, uri, ...)`
   - Video/Audio: `DeceasedMedia.gov_add_media_for(owner, 1, video_collection_id, 1|2, uri, ...)`
3. 生成预映像：`Preimage.note_preimage(call)`。
4. 提交公投：`Referenda.submit { proposal_origin=EnsureContentSigner, proposal_hash=..., track=Content }`。
5. 公投通过后由调度执行预映像，链上以 `owner` 账户完成押金保留与记录落账。
6. 到期后 `owner` 调用 `claim_*_deposit` 取回押金。

> 注意：本流程通过运行时的 forwarder 授权命名空间 `content_` 代付 `preimage/submit` 交易，无需用户链上私钥。

## 运行时参数（示例）
- `AlbumDeposit=0.02 UNIT`、`MediaDeposit=0.005 UNIT`、`CreateFee=0.001 UNIT`
- `ComplaintPeriod=365 天`
