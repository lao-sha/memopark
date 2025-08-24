Memorial项目 区块链前端 API 接口统一文档

## pallet-deceased

- 模块说明：在单个墓位下维护多个逝者记录，提供增删改与迁移。
- 隐私：仅存有限文本与外链；不涉及 BUD 资金。

Extrinsics：
- create_deceased(grave_id: u64, name: Bytes, bio: Bytes, birth_ts: Option<u64>, death_ts: Option<u64>, links: Vec<Bytes>)
  - 权限：墓位 `owner` 或被授权者
  - 事件：DeceasedCreated(id, grave_id, owner)
- update_deceased(id: u64, name?: Bytes, bio?: Bytes, birth_ts??: Option<Option<u64>>, death_ts??: Option<Option<u64>>, links?: Vec<Bytes>)
  - 权限：记录 owner
  - 事件：DeceasedUpdated(id)
- remove_deceased(id: u64)
  - 权限：记录 owner
  - 事件：DeceasedRemoved(id)
- transfer_deceased(id: u64, new_grave: u64)
  - 权限：记录 owner 且可挂至新墓位
  - 事件：DeceasedTransferred(id, from, to)

Storage：
- NextDeceasedId: u64
- DeceasedOf: u64 -> Deceased { grave_id, owner, name, bio, birth_ts, death_ts, links, created, updated }
- DeceasedByGrave: u64 -> BoundedVec<u64>

常量参数：
- MaxDeceasedPerGrave, StringLimit, MaxLinks

## pallet-deceased-media

- 模块说明：每位逝者可有多个相册，每个相册含多媒体项（照片/视频/音频）。
- 隐私：链下资源 URI + 可选哈希；不涉及 BUD。

Extrinsics：
- create_album(deceased_id: u64, title: Bytes, desc: Bytes, visibility: Visibility, tags: Vec<Bytes>)
  - 权限：逝者 owner/授权者
  - 事件：AlbumCreated(album_id, deceased_id, owner)
- update_album(album_id: u64, title?: Bytes, desc?: Bytes, visibility?: Visibility, tags?: Vec<Bytes>, cover_media_id??: Option<u64>)
  - 权限：album owner
  - 事件：AlbumUpdated(album_id)
- delete_album(album_id: u64)
  - 权限：album owner；相册需为空
  - 事件：AlbumDeleted(album_id)
- add_media(album_id: u64, kind: MediaKind(=Photo|Video|Audio), uri: Bytes, thumbnail_uri?: Bytes, content_hash?: [u8;32], duration_secs?: u32, width?: u32, height?: u32, order_index?: u32)
  - 权限：album owner
  - 事件：MediaAdded(media_id, album_id)
  - 轻量校验：Photo 提供尺寸则需 >0；Video/Audio 提供时长则需 >0
- update_media(media_id: u64, uri?: Bytes, thumbnail_uri??: Option<Bytes>, content_hash??: Option<[u8;32]>, duration_secs??: Option<u32>, width??: Option<u32>, height??: Option<u32>, order_index?: u32)
  - 权限：media owner
  - 事件：MediaUpdated(media_id)
  - 轻量校验：同 add_media
- remove_media(media_id: u64)
  - 权限：media owner
  - 事件：MediaRemoved(media_id)
- move_media(media_id: u64, to_album: u64)
  - 权限：media owner；同一 deceased_id
  - 事件：MediaMoved(media_id, from_album, to_album)
- reorder_album(album_id: u64, ordered_media: Vec<u64>)
  - 权限：album owner；批量上限 MaxReorderBatch
  - 事件：AlbumReordered(album_id)

Storage：
- NextAlbumId/NextMediaId: u64
- AlbumOf/MediaOf
- AlbumsByDeceased / MediaByAlbum

常量参数：
- MaxAlbumsPerDeceased, MaxMediaPerAlbum, StringLimit, MaxTags, MaxReorderBatch

## pallet-grave-ledger

- 模块说明：按墓位记录供奉历史，链上保留“最近 N 条明细”和累计计数，避免状态膨胀；详细数量/金额建议由索引器从 `pallet-memorial-offerings` 事件补全。

Extrinsics：
- prune_grave(grave_id: u64, keep_last: u32)
  - 权限：Root/管理员
  - 作用：仅保留最近 keep_last 条明细

Hook：
- OnOfferingCommitted(target: (u8,u64), kind_code: u8, who: AccountId)
  - 运行时将该 Hook 实现为写入 `pallet-grave-ledger::record_from_hook`（仅当 target 域为 grave 时）

Storage：
- NextLogId: u64
- LogOf: u64 -> { grave_id, who, kind_code, block, memo? }
- RecentByGrave: u64 -> BoundedVec<u64>
- TotalsByGrave: u64 -> u64
- TotalsByGraveKind: (u64, u8) -> u64

## pallet-grave-guestbook

- 模块说明：每个 grave 的留言板；可关闭公共留言（仅墓主/管理员/亲人可发言）；支持图片/视频/音频附件（链下 URI）。

Extrinsics：
- set_public(grave_id: u64, enabled: bool)
  - 权限：墓主/园区管理员
- add_relative(grave_id: u64, who: AccountId) / remove_relative(...)
  - 权限：墓主/园区管理员
- add_moderator(grave_id: u64, who) / remove_moderator(...)
  - 权限：墓主/园区管理员
- pin_message(grave_id: u64, message_id??: Option<u64>)
  - 权限：墓主/园区管理员
- post(grave_id: u64, content: Bytes, attachments: Vec<Attachment>, reply_to?: u64)
  - 权限：公共关闭时仅版主/亲人（以及墓主/园区管理员）
- edit(message_id: u64, new_content?: Bytes, new_attachments?: Vec<Attachment>)
  - 权限：作者或版主
- hide(message_id: u64)
  - 权限：版主或墓主/园区管理员
- delete(message_id: u64)
  - 权限：作者或版主

结构：
- Attachment { kind: MediaKind(=Photo|Video|Audio), uri: Bytes, thumbnail_uri?: Bytes, content_hash?: [u8;32], duration_secs?: u32, width?: u32, height?: u32 }

Storage：
- GuestbookConfigOf, RelativesOf, NextMessageId, MessageOf, RecentByGrave, MessageCountByGrave, LastPostBy
