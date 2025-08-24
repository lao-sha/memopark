# pallet-grave-guestbook

- 用途：为每个 `grave` 提供留言板（Guestbook），可开关公共留言；支持亲人白名单；支持图片/视频/音频附件（链下 URI）。
- 隐私与安全：仅存最小文本与外链；不涉及 BUD 资金；有界长度/数量与反刷限制。
- 低耦合：通过 `GraveAccess` 适配到 `pallet-grave`；可接入 `pallet-membership/identity`。

## 数据模型
- `GuestbookConfig{ public_enabled, allow_anonymous, pinned_message_id, moderators[] }`
- `Message{ grave_id, author, content, attachments[], reply_to?, created, edited?, is_hidden }`
- `Attachment{ kind=Photo|Video|Audio, uri, thumbnail_uri?, content_hash?, duration_secs?, width?, height? }`

## 存储
- `GuestbookConfigOf: GraveId -> GuestbookConfig`
- `RelativesOf: GraveId -> BoundedVec<AccountId, MaxRelatives>`
- `NextMessageId: MessageId`
- `MessageOf: MessageId -> Message`
- `RecentByGrave: GraveId -> BoundedVec<MessageId, MaxRecentPerGrave>`
- `MessageCountByGrave: GraveId -> u64`
- `LastPostBy: (GraveId, AccountId) -> BlockNumber`

## Extrinsics（摘要）
- 配置：`set_public`、`add_relative/remove_relative`、`add_moderator/remove_moderator`、`pin_message`
- 留言：`post(grave_id, content, attachments[], reply_to?)`、`edit(message_id, new_content?, new_attachments?)`、`hide(message_id)`、`delete(message_id)`

## 运行时参数建议
- `StringLimit=512`、`MaxMessageLen=512`、`MaxAttachmentsPerMessage=4`、`MaxRecentPerGrave=200`、`MaxRelatives=64`、`MaxModerators=16`、`MinPostBlocksPerAccount=30`
