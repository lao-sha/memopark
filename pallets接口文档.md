MemoPark项目 区块链前端 API 接口统一文档

## pallet-deceased

- 模块说明：在单个墓位下维护多个逝者记录，提供增删改与迁移。
- 隐私：仅存有限文本与外链；不涉及 MEMO 资金。

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
- 隐私：链下资源 URI + 可选哈希；不涉及 MEMO。

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

## 通用说明（前端调用返回语义）

- Extrinsic 返回类型为 DispatchResult(WithPostInfo)；业务层“返回值”通过事件 Event 暴露。
- 前端通常通过 Polkadot.js 调用：`api.tx.<pallet>.<call>(...)`，监听交易内事件解析业务结果。

## pallet-memo-park（陵园）

- 作用：登记陵园、更新管理与状态；与官方治理/多签低耦合（由 runtime 适配 `ParkAdmin`）。
- Extrinsics：
  - create_park(country_iso2: [u8;2], region_code: Bytes, metadata_cid: Bytes)
    - 权限：签名账户
    - 事件：ParkCreated { id, owner, country }
  - update_park(id: u64, region_code?: Bytes, metadata_cid?: Bytes, active?: bool)
    - 权限：owner 或园区管理员
    - 事件：ParkUpdated { id }
  - set_park_admin(id: u64, admin_group: Option<u64>)
    - 权限：owner 或园区管理员
    - 事件：AdminSet { id, admin_group }
  - transfer_park(id: u64, new_owner: AccountId)
    - 权限：owner
    - 事件：ParkTransferred { id, new_owner }

## pallet-memo-grave（墓位/纪念堂）

- 作用：创建/更新/转让墓位，安葬/起掘；分类/宗教；投诉与园区审核；名称哈希索引；墓位管理员。
- Extrinsics：
  - create_grave(park_id: u64, kind_code: u8, capacity?: u16, metadata_cid: Bytes) -> GraveCreated
  - update_grave(id: u64, kind_code?: u8, capacity?: u16, metadata_cid?: Bytes, active?: bool) -> GraveUpdated
  - transfer_grave(id: u64, new_owner: AccountId) -> GraveTransferred
  - inter(id: u64, deceased_id: u64, slot?: u16, note_cid?: Bytes) -> Interred
  - exhume(id: u64, deceased_id: u64) -> Exhumed
  - set_meta(id: u64, categories?: u32, religion?: u8) -> MetaUpdated
  - complain(id: u64, cid: Bytes) -> ComplainSubmitted
  - restrict(id: u64, on: bool, reason_code: u8) -> Restricted
  - remove(id: u64, reason_code: u8) -> Removed
  - set_name_hash(id: u64, name_hash: [u8;32]) -> NameHashSet / clear_name_hash(...) -> NameHashCleared
  - add_admin(id: u64, who: AccountId) -> AdminAdded / remove_admin(...) -> AdminRemoved

## pallet-memo-offerings（供奉规格与下单）

- 作用：上/下架供奉规格（Instant/Timed），用户下单供奉（可附媒体 CID），资金路由至托管账户；触发 Hook（台账、联盟记账）。
- Extrinsics：
  - create_offering(kind_code: u8, name: Bytes, media_schema_cid: Bytes, kind_flag: u8, min_duration?: u32, max_duration?: u32, can_renew: bool, expire_action: u8, enabled: bool) -> OfferingCreated
  - update_offering(kind_code: u8, name?: Bytes, media_schema_cid?: Bytes, min_duration?: Option<u32>, max_duration?: Option<u32>, can_renew?: bool, expire_action?: u8) -> OfferingUpdated
  - set_offering_enabled(kind_code: u8, enabled: bool) -> OfferingEnabled
  - offer(target: (u8,u64), kind_code: u8, amount?: u128, media: Vec<(cid, commit?)>, duration_weeks?: u32) -> OfferingCommitted
  - batch_offer(calls: Vec<...offer 参数...>) -> ()

## pallet-memo-referrals（推荐关系）

- 作用：一次性绑定直属推荐人；为联盟计酬提供稳定、低耦合的推荐图来源。
- Extrinsics：
  - bind_sponsor(sponsor: AccountId) -> SponsorBound（仅首次绑定，防环、自荐禁止）
  - set_paused(value: bool) -> PausedSet（Root）

## pallet-memo-affiliate（联盟计酬/托管结算）

- 作用：周度记账 + 托管批量结算；非压缩 + 不等比例（L1=20%、L2=10%、L3..L15=各4%），未达标层份额并入国库。
- Extrinsics：
  - set_mode(mode: Escrow|Immediate) -> ModeChanged（Root）
  - settle(cycle: u32, max_pay: u32) -> Settled（任意人可触发分页结算；完成后支付当周 Burn/Treasury）

## pallet-grave-ledger（供奉台账/排行/活跃周）

- 作用：供奉明细与累计、TopN 排行，以及“按周有效供奉”标记（供统计/计酬使用）。
- Extrinsics：
  - prune_grave(grave_id: u64, keep_last: u32) -> Pruned（Root）
- 只读：`LogOf`/`RecentByGrave`/`TotalsByGrave`/`TotalsByGraveKind`/`TotalMemoByGrave`/`TotalMemoByGraveUser`/`TopGraves`/`WeeklyActive`
- 事件：OfferingLogged / TopUpdated / WeeklyActiveMarked

## pallet-escrow（托管）

- 作用：按 id 锁定/释放/退款，余额由内部存储维护；托管账户为 PalletId 衍生账户。
- Extrinsics：
  - lock(id: u64, payer: AccountId, amount: Balance) -> Locked
  - release(id: u64, to: AccountId) -> Released
  - refund(id: u64, to: AccountId) -> Refunded

## pallet-evidence（证据登记/复用）

- 作用：登记证据（CID/承诺哈希），按目标或命名空间链接/取消，供仲裁/风控等跨域复用。
- Extrinsics：
  - commit(domain: u8, target_id: u64, imgs: Vec<CID>, vids: Vec<CID>, docs: Vec<CID>, memo?: Bytes) -> EvidenceCommitted
  - commit_hash(ns: [u8;8], subject_id: u64, commit: H256, memo?: Bytes) -> EvidenceCommittedV2（仅承诺，不落可逆 CID）
  - link(domain: u8, target_id: u64, id: u64) / unlink(...) -> EvidenceLinked / EvidenceUnlinked
  - link_by_ns(ns: [u8;8], subject_id: u64, id: u64) / unlink_by_ns(...) -> EvidenceLinkedV2 / EvidenceUnlinkedV2

## pallet-forwarder（赞助转发/会话）

- 作用：开/关会话、赞助者代付元交易，过滤禁用调用与范围校验（由 Authorizer 适配）。
- Extrinsics：
  - open_session(permit_bytes: Bytes) -> SessionOpened（赞助者提交离线会话许可）
  - close_session(ns: [u8;8], session_id: [u8;16]) -> SessionClosed（所有者）
  - forward(meta_bytes: Bytes, session_sig: Bytes, owner: LookupSource) -> PostDispatchInfo；成功触发 Forwarded

### forwarder 赞助代付（OTC 买/卖挂单与吃单）

- **代付范围（命名空间）**：
  - `OtcListingNsBytes = b"otc_lst_"`：允许 `pallet-otc-listing::create_listing`（side=Buy/Sell 由参数决定）。
  - `OtcOrderNsBytes   = b"otc_ord_"`：允许 `pallet-otc-order::open_order`（吃单创建订单）。
- **赞助者白名单**：仅允许平台账户 `PlatformAccount` 作为赞助者发起 `forward/open_session`（运行时适配器限制）。
- **禁用调用**：`Sudo` 等高权限/逃逸调用被拒绝。

- `SessionPermit`（离线签发，赞助者代付上链）：
  - 字段：`ns: [u8;8]`, `owner: AccountId`, `session_id: [u8;16]`, `session_pubkey: sr25519::Public`, `expires_at: BlockNumber`
  - Extrinsic：`forwarder.open_session(permit_bytes)`
- `MetaTx`（离线签 MetaTx，赞助者代付执行）：
  - 字段：`ns: [u8;8]`, `session_id: [u8;16]`, `call: RuntimeCall`, `nonce: u64`, `valid_till: BlockNumber`
  - Extrinsic：`forwarder.forward(meta_bytes, session_sig, owner)`

- 前端（Polkadot.js）示例：
```javascript
// 1) 平台账户 sponsor 开启会话（ns=otc_lst_，用于 create_listing）
const permit = { ns: Array.from(new TextEncoder().encode('otc_lst_\0')).slice(0,8), owner, sessionId, sessionPubkey, expiresAt };
const permitBytes = api.createType('Bytes', api.createType('(ForwarderSessionPermit)', permit).toU8a());
await api.tx.forwarder.openSession(permitBytes).signAndSend(platformAccount);

// 2) 用户侧构造 RuntimeCall：create_listing（Buy=0/Sell=1）
const call = api.tx.otcListing.createListing(side, base, quote, price, minQty, maxQty, total, partial, expireAt, termsCommitOpt);

// 3) 构造 MetaTx 并用会话私钥离线签名（示例省略验签）
const meta = { ns: permit.ns, sessionId, call, nonce, validTill };
const metaBytes = api.createType('Bytes', api.createType('(ForwarderMetaTx)', meta).toU8a());

// 4) 平台账户 sponsor 代付执行（owner 为被代付用户地址）
await api.tx.forwarder.forward(metaBytes, sessionSig, owner).signAndSend(platformAccount);

// 5) 吃单创建订单（ns=otc_ord_）流程同理，call 改为：
//    api.tx.otcOrder.openOrder(listingId, price, qty, amount, paymentCommit, contactCommit)
```

- 注意：
  - 生产环境需校验 `session_sig` 与 `session_pubkey`（MVP 版本省略验签）。
  - 平台账户需确保资金安全与风控策略（额度/频控/黑名单），建议后续接入治理可控的授权中心。

## pallet-otc-maker（做市商资料）

- 作用：KYC 通过后登记做市商资料（承诺哈希），自助上下线。
- Extrinsics：
  - upsert_maker(payment_cid_commit: H256) -> MakerUpserted（需 KYC 通过）
  - set_active(active: bool) -> MakerStatusChanged

## pallet-otc-listing（挂单）

- 作用：最小挂单骨架（价格/数量/条款承诺/到期等）。
- Extrinsics：
  - create_listing(side: u8, base: u32, quote: u32, price: Balance, min_qty: Balance, max_qty: Balance, total: Balance, partial: bool, expire_at: BlockNumber, terms_commit?: Bytes) -> ListingCreated
  - cancel_listing(id: u64) -> ListingCanceled（仅创建者）

## pallet-otc-order（订单）

- 作用：吃单生成订单、标记已付、标记争议（本地状态）。
- Extrinsics：
  - open_order(listing_id: u64, price: Balance, qty: Balance, amount: Balance, payment_commit: H256, contact_commit: H256) -> OrderOpened
  - mark_paid(id: u64) -> OrderPaidCommitted（仅 taker；需 Created 状态）
  - mark_disputed(id: u64) -> OrderDisputed（maker/taker，见状态/时窗约束）

## pallet-arbitration（仲裁登记/裁决路由）

- 作用：发起争议、引证证据、路由裁决到业务域（托管资金由 Escrow 接口完成释放/退款）。
- Extrinsics：
  - dispute(domain: [u8; 8], id: u64, evidence: Vec<Bytes(CID)>) -> Disputed
  - arbitrate(domain: [u8; 8], id: u64, decision_code: u8(0/1/2), bps?: u16) -> Arbitrated（0放行/1退款/2部分放行）
  - dispute_with_evidence_id(domain: [u8; 8], id: u64, evidence_id: u64) -> Disputed
  - append_evidence_id(domain: [u8; 8], id: u64, evidence_id: u64) -> ()

### Polkadot.js 调用示例

```javascript
// 创建纪念堂
await api.tx.memoGrave.createGrave(parkId, kindCode, null, metadataCid).signAndSend(account);

// 提交一次供奉（Instant，无时长；amount 会划转到托管账户）
await api.tx.memoOfferings.offer([domainCode, targetId], kindCode, amount, [[cidBytes, null]], null).signAndSend(account);

// 绑定直属推荐人
await api.tx.memoReferrals.bindSponsor(sponsor).signAndSend(user);

// 触发结算当周应得（分页）
await api.tx.memoAffiliate.settle(weekIndex, 100).signAndSend(anyone);
```
