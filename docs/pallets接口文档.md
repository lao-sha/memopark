StarDust项目 区块链前端 API 接口统一文档

## pallet-deceased

- 模块说明：在单个墓位下维护多个逝者记录，提供增删改与迁移。
- 隐私：仅存有限文本与外链；不涉及 DUST 资金。

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

## pallet-deceased-data（原 pallet-deceased-media）

- 模块说明：每位逝者可有多个相册，每个相册含多媒体项（照片/视频/音频）。
- 隐私：链下资源 URI + 可选哈希；不涉及 DUST。

Extrinsics：
- create_album(deceased_id: u64, title: Bytes, desc: Bytes, visibility: Visibility, tags: Vec<Bytes>)
  - 权限：逝者 owner/授权者
  - 事件：AlbumCreated(album_id, deceased_id, owner)
- update_album(album_id: u64, title?: Bytes, desc?: Bytes, visibility?: Visibility, tags?: Vec<Bytes>, primary_photo_id??: Option<u64>)
  - 权限：album owner
  - 事件：AlbumUpdated(album_id)
- delete_album(album_id: u64)
  - 权限：album owner；相册需为空
  - 事件：AlbumDeleted(album_id)
- add_data(container_kind: u8(0=Album,1=VideoCollection,2=Uncategorized), container_id?: u64, kind: DataKind(=Photo|Video|Audio|Article|Message), uri: Bytes, thumbnail_uri?: Bytes, content_hash?: [u8;32], title?: Bytes, summary?: Bytes, duration_secs?: u32, width?: u32, height?: u32, order_index?: u32)
  - 权限：
    - container_kind=0 时：album owner
    - container_kind=1 时：video_collection owner
  - 事件：
    - Photo/Article：DataAdded(data_id, album_id)
    - Video/Audio：DataAddedToVideoCollection(data_id, video_collection_id)
    - Message：DataMessageAdded(data_id, deceased_id)
  - 轻量校验：
    - Photo 提供尺寸则需 >0；Video/Audio 提供时长则需 >0；Article 需提供 content_hash
    - Message：需提供 deceased_id（作为 container_id 且 container_kind=2）
- update_data(data_id: u64, uri?: Bytes, thumbnail_uri??: Option<Bytes>, content_hash??: Option<[u8;32]>, title??: Option<Bytes>, summary??: Option<Bytes>, duration_secs??: Option<u32>, width??: Option<u32>, height??: Option<u32>, order_index?: u32)
  - 权限：media owner
  - 冻结校验：Photo/Article → 校验相册未冻结；Video/Audio → 校验视频集未冻结；Message → 不做容器冻结校验
  - 事件：MediaUpdated(media_id)
  - 轻量校验：同 add_data
- remove_data(data_id: u64)
  - 权限：media owner
  - 事件：MediaRemoved(media_id)
  - 限制：仅 Photo 与 Message 可删除；Video/Audio/Article 用户删除暂不支持
- move_data(data_id: u64, to_album: u64)
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

## pallet-ledger

- 模块说明：按墓位记录最小统计（累计次数/累计金额/按周活跃标记）。明细/排行/分类统计等高变动查询交由 Subsquid 从事件与只读状态聚合。

Extrinsics：
- prune_grave(grave_id: u64, keep_last: u32)
  - 权限：Root/管理员
  - 作用：仅保留最近 keep_last 条明细

Hook：
- OnOfferingCommitted(target: (u8,u64), kind_code: u8, who: AccountId, amount?: Balance, duration_weeks?: u32)
  - 运行时将该 Hook 实现为写入 `pallet-ledger::{record_from_hook_with_amount, mark_weekly_active}`（仅当 target 域为 grave 时）

Storage：
- TotalsByGrave: u64 -> u64
- TotalMemoByGrave: u64 -> Balance
- WeeklyActive: (u64, AccountId, u64) -> ()

## （已移除）pallet-grave-guestbook

- 已移除：统一改由 `pallet-deceased-data` 的 Message/Eulogy/Life 体系承载留言/悼词/生平。

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

## pallet-stardust-park（陵园）

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

## pallet-stardust-grave（墓位/纪念堂）

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

## pallet-stardust-referrals（推荐关系）

- 作用：一次性绑定直属推荐人；为联盟计酬提供稳定、低耦合的推荐图来源。
- Extrinsics：
  - bind_sponsor(sponsor: AccountId) -> SponsorBound（仅首次绑定，防环、自荐禁止）
  - set_paused(value: bool) -> PausedSet（Root）

## pallet-memo-affiliate（联盟计酬/托管结算）

- 作用：周度记账 + 托管批量结算；非压缩 + 不等比例（L1=20%、L2=10%、L3..L15=各4%），未达标层份额并入国库。
- Extrinsics：
  - set_mode(mode: Escrow|Immediate) -> ModeChanged（Root）
  - settle(cycle: u32, max_pay: u32) -> Settled（任意人可触发分页结算；完成后支付当周 Burn/Treasury）

## pallet-ledger（供奉台账/周活跃）

- 作用：累计统计和“按周有效供奉”标记（供统计/计酬使用）。
- 只读：`TotalsByGrave` / `TotalMemoByGrave` / `WeeklyActive`
- 事件：WeeklyActiveMarked

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
  - ~~`OtcListingNsBytes = b"otc_lst_"`：允许 `pallet-otc-listing::create_listing`~~ （已废弃，2025-10-20删除）
  - `OtcOrderNsBytes   = b"otc_ord_"`：允许 `pallet-otc-order::open_order`（创建订单，直接选择做市商）。
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

## ~~pallet-otc-listing（挂单）~~ 【已删除 2025-10-20】

**删除原因**: 挂单机制已废弃，改为直接选择做市商创建订单  
**功能转移**: 
- 做市商管理 → `pallet-market-maker`
- 价格管理 → `pallet-pricing` 
- 订单管理 → `pallet-otc-order`

详见: `docs/pallet-otc-listing删除完成报告.md`

## pallet-otc-order（订单）

- 作用：直接选择做市商创建订单、标记已付、标记争议（本地状态）。
- Extrinsics：
  - open_order(maker_id: u64, price: u64, qty: Balance, amount: Balance, payment_commit: H256, contact_commit: H256) -> OrderOpened  
    注：`maker_id` 来自 `pallet-market-maker`，不再依赖挂单
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

## pallet-balance-tiers（多层级余额管理）

- **模块说明**: 提供多层级余额管理系统，支持 Gas、Points、VIP、Gift、Reward、Premium 等多种余额类型
- **特性**: 完全隔离、来源追踪、使用限制、渐进式解锁、自动回收、VIP 折扣（预留）、智能费率（预留）
- **未来扩展**: 支持积分系统、VIP 会员、红包赠送、智能费率等创新功能

### Extrinsics（可调用函数）

1. **grant_balance**(to: AccountId, tier: BalanceTier, amount: Balance, source_type: SourceType, expires_in: Option<BlockNumber>)
   - **权限**: `GrantOrigin`（Root 或其他授权 pallet）
   - **功能**: 发放指定层级的余额给指定账户
   - **参数**:
     - `to`: 接收者账户
     - `tier`: 余额层级
       - `Gas`: Gas 专用余额（仅用于交易手续费）
       - `Points`: 积分余额（未来实现）
       - `Vip`: VIP 会员余额（未来实现）
       - `Gift`: 可赠送余额/红包（未来实现）
       - `Reward`: 奖励余额（未来实现）
       - `Premium`: 高级余额/智能费率（未来实现）
     - `amount`: 发放金额
     - `source_type`: 来源类型
       - `Airdrop`: 新手空投
       - `ReferralReward`: 邀请奖励
       - `EventReward`: 活动奖励
       - `AdminGrant`: 运营发放
       - `VipBenefit`: VIP 会员福利（未来）
       - `PointsExchange`: 积分兑换（未来）
       - `GiftReceived`: 红包接收（未来）
     - `expires_in`: 有效期（区块数，None 使用默认配置）
   - **事件**: `TierBalanceGranted { to, tier, amount, source_type, expires_at }`

2. **set_tier_config**(config: TierConfiguration)
   - **权限**: `GovernanceOrigin`（仅 Root）
   - **功能**: 更新全局配置参数
   - **参数**:
     - `default_airdrop_amount`: 默认空投金额
     - `default_daily_limit`: 默认每日限额
     - `max_gas_per_tx`: 单笔交易 Gas 上限
     - `default_expiry_blocks`: 默认过期区块数
     - `auto_recycle_enabled`: 自动回收开关
     - `unlock_ratio`: 解锁比例 (gas_used, unlocked)
   - **事件**: `GasConfigUpdated`

3. **recycle_expired_balance**(account: AccountId, tier: Option<BalanceTier>)
   - **权限**: 任何人都可以调用
   - **功能**: 回收指定账户的过期层级余额
   - **参数**:
     - `account`: 要回收的账户
     - `tier`: 要回收的层级（None 表示回收所有层级）
   - **事件**: `TierBalanceRecycled { from, tier, amount }`

### Storage（链上存储）

- **TieredAccounts**: `StorageMap<AccountId, TieredBalanceAccount>`
  - 存储所有账户的多层级余额信息
  - 包含：来源列表（最多 20 个）、Gas 每日限额、创建时间、最后使用时间、VIP 等级

- **UsageHistory**: `StorageDoubleMap<AccountId, BlockNumber, BalanceUsageRecord>`
  - 记录余额使用历史
  - 用于统计分析和反作弊
  - 包含层级、金额、交易类型

- **TierConfig**: `StorageValue<TierConfiguration>`
  - 全局配置参数
  - 包含各层级的配置（Gas、Points、VIP、Gift 等）

### Events（事件）

- **TierBalanceGranted** { to, tier, amount, source_type, expires_at }
  - 层级余额已发放

- **GasFeeCharged** { who, amount, remaining }
  - Gas 费用已从 Gas 层级余额扣除

- **BalanceUnlocked** { who, gas_used, unlocked }
  - 普通余额已解锁（使用 Gas 后的奖励）

- **TierBalanceRecycled** { from, tier, amount }
  - 过期层级余额已回收

- **TierConfigUpdated**
  - 全局配置已更新

### Errors（错误）

- **InvalidAmount**: 金额无效（为零或过大）
- **AccountNotFound**: Gas-only 账户不存在
- **TooManySources**: 来源列表已满（最多 10 个）
- **RecycleDisabled**: 回收功能未启用
- **InsufficientGasBalance**: Gas-only 余额不足
- **DailyLimitExceeded**: 超过每日限额
- **MaxGasPerTxExceeded**: 超过单笔 Gas 上限

### 前端 API 示例

```javascript
// 查询多层级余额
const account = await api.query.balanceTiers.tieredAccounts(address);
console.log('来源数量:', account.sources.length);
console.log('VIP 等级:', account.vipLevel.toString());

// 查询余额使用历史
const history = await api.query.balanceTiers.usageHistory.entries(address);

// 查询全局配置
const config = await api.query.balanceTiers.tierConfig();
console.log('Gas 默认空投:', config.gasDefaultAirdrop.toString());
console.log('Gas 解锁比例:', config.gasUnlockRatio);
console.log('积分兑换比例:', config.pointsExchangeRate);

// 发放 Gas 层级余额（需要 Root 权限）
await api.tx.balanceTiers.grantBalance(
  targetAddress,
  'Gas',  // 层级类型
  '10000000000000',  // 10 DUST
  'FirstPurchaseReward',
  null  // 使用默认过期时间
).signAndSend(admin);

// 发放积分余额（未来功能）
await api.tx.balanceTiers.grantBalance(
  targetAddress,
  'Points',
  '1000',  // 1000 积分
  'EventReward',
  null
).signAndSend(admin);

// 回收过期余额
await api.tx.balanceTiers.recycleExpiredBalance(
  targetAddress,
  'Gas'  // 仅回收 Gas 层级，null 则回收所有层级
).signAndSend(anyone);

// 更新全局配置（需要 Root 权限）
await api.tx.balanceTiers.setTierConfig({
  gasDefaultAirdrop: '10000000000000',
  gasDefaultDailyLimit: { Some: '100000000000000' },
  gasMaxPerTx: { Some: '10000000000000' },
  gasDefaultExpiryBlocks: { Some: 2592000 },
  gasUnlockRatio: [1, 2],  // 1:2 解锁比例
  autoRecycleEnabled: true,
  pointsExchangeRate: { Some: [1, 10] },  // 1 DUST = 10 积分
  vipMinBalance: { Some: '100000000000000' },  // VIP 最低余额
  giftMaxAmount: { Some: '10000000000000' }  // 红包最大金额
}).signAndSend(root);
```

### 使用场景

1. **新用户激励**: 运营向新用户发放 Gas 层级余额，用于支付初始交易费用，降低使用门槛
2. **活动空投**: 运营向活动参与用户发放 Gas 层级余额，提升用户活跃度
3. **邀请奖励**: 邀请好友注册成功后，邀请人获得 Gas 层级余额奖励
4. **渐进式解锁**: 用户使用 1 DUST Gas 后，自动解锁 2 DUST 普通余额，激励用户活跃
5. **积分系统（未来）**: 用户参与活动获得积分，可兑换服务或商品
6. **VIP 会员（未来）**: 持有一定余额自动升级 VIP，享受手续费折扣
7. **红包系统（未来）**: 用户可以向好友赠送 Gift 层级余额
8. **智能费率（未来）**: 根据网络拥堵情况动态调整手续费

### 注意事项

1. Gas 层级余额**仅用于支付交易手续费**，不能转账或交易
2. 每个账户最多支持 20 个不同来源的层级余额（跨层级）
3. 使用 FIFO（先进先出）原则，优先使用最早的同层级余额
4. 超过每日限额或单笔上限时，自动回退到普通余额支付
5. 过期余额不会自动扣除，需要调用 `recycle_expired_balance` 手动回收
6. 不同层级的余额完全隔离，互不影响

### 未来扩展功能

- **积分系统**: Points 层级，支持兑换、消费、转赠
- **VIP 会员**: Vip 层级，享受手续费折扣和专属权益
- **红包系统**: Gift 层级，支持用户间转账和赠送
- **智能费率**: Premium 层级，根据网络状态动态调整费用
- **批量折扣**: 高频用户自动享受手续费优惠
- **自动流转**: 余额在不同层级间自动转换

### 相关文档

- 详细设计文档: `docs/Gas-only-MEMO自定义实现方案.md`（已更新为多层级方案）
- Pallet README: `pallets/balance-tiers/README.md`
- 重命名报告: `docs/pallet-balance-tiers-重命名完成报告.md`

---

## pallet-buyer-credit（买家信用风控模块）

### 概述

买家信用风控管理模块，为 OTC 交易提供 **AI 驱动的智能风控系统**。

**核心功能**：
- ✅ 多维度信任评估（资产、年龄、活跃度、社交、身份）
- ✅ 新用户分层冷启动（Premium/Standard/Basic/Restricted）
- ✅ 信用等级体系（Newbie/Bronze/Silver/Gold/Diamond）
- ✅ 快速学习机制（前3笔权重5x）
- ✅ 社交信任网络（推荐人连带责任）
- ✅ 行为模式分析（每5笔自动分析）
- ✅ 防恶意购买（限额、冷却期、违约惩罚）

**适用场景**：
- OTC 订单风控检查
- 买家信用评估
- 新用户额度分配
- 老用户信用追踪

---

### 可调用接口（Extrinsics）

#### 1. `endorse_user`

**功能**：老用户为新用户担保推荐

**参数**：
```rust
pub fn endorse_user(
    origin: OriginFor<T>,
    endorsee: T::AccountId,  // 被推荐人账户
) -> DispatchResult
```

**权限**：
- 需要签名
- 推荐人风险分 ≤ 300（信用分 ≥ 700）

**效果**：
- 被推荐人社交信任 +40分
- 推荐人承担连带责任（被推荐人违约时 -50分）

**事件**：`UserEndorsed`

**错误**：
- `CannotEndorseSelf`: 不能推荐自己
- `InsufficientCreditToEndorse`: 推荐人信用不足
- `AlreadyEndorsed`: 已经被此推荐人推荐过

---

#### 2. `set_referrer`

**功能**：设置邀请人（仅能设置一次）

**参数**：
```rust
pub fn set_referrer(
    origin: OriginFor<T>,
    referrer: T::AccountId,  // 邀请人账户
) -> DispatchResult
```

**权限**：需要签名

**效果**：
- 建立邀请关系
- 被邀请人获得邀请人的信誉加成（+0~40分）

**事件**：`ReferrerSet`

**错误**：
- `CannotReferSelf`: 不能邀请自己
- `ReferrerAlreadySet`: 邀请人已设置

---

### 只读查询（Queries）

#### 1. `buyer_credit`

**功能**：查询买家信用记录

**参数**：
```rust
BuyerCredit<T>::get(account: T::AccountId) -> CreditScore<T>
```

**返回**：
```rust
pub struct CreditScore<T> {
    pub level: CreditLevel,                    // 信用等级
    pub new_user_tier: Option<NewUserTier>,    // 新用户等级（前20笔）
    pub completed_orders: u32,                 // 成功订单数
    pub total_volume: BalanceOf<T>,            // 累计购买量
    pub default_count: u32,                    // 违约次数
    pub dispute_count: u32,                    // 争议次数
    pub last_purchase_at: BlockNumber,         // 上次购买时间
    pub risk_score: u16,                       // 风险分（0-1000）
    pub account_created_at: BlockNumber,       // 账户创建时间
}
```

---

#### 2. `daily_volume`

**功能**：查询某天的购买量

**参数**：
```rust
DailyVolume<T>::get(account: T::AccountId, day_key: u32) -> u64
```

**返回**：当天购买总额（USDT，精度6）

---

#### 3. `order_history`

**功能**：查询最近20笔订单记录

**参数**：
```rust
OrderHistory<T>::get(account: T::AccountId) -> BoundedVec<OrderRecord, ConstU32<20>>
```

**返回**：
```rust
pub struct OrderRecord {
    pub amount_usdt: u64,              // 订单金额（USDT）
    pub payment_time_seconds: u64,     // 付款时间（秒）
    pub created_at_block: u32,         // 创建区块号
}
```

---

#### 4. `referrer`

**功能**：查询邀请人

**参数**：
```rust
Referrer<T>::get(account: T::AccountId) -> Option<T::AccountId>
```

---

#### 5. `endorsements`

**功能**：查询推荐列表

**参数**：
```rust
Endorsements<T>::get(account: T::AccountId) -> BoundedVec<Endorsement<T>, ConstU32<10>>
```

**返回**：
```rust
pub struct Endorsement<T> {
    pub endorser: T::AccountId,           // 推荐人
    pub endorsed_at: BlockNumber,         // 推荐时间
    pub is_active: bool,                  // 是否有效
}
```

---

### 公共函数（Public Functions）

#### 1. `check_buyer_limit`

**功能**：检查买家是否可以创建订单

**调用**：
```rust
pallet_buyer_credit::Pallet::<T>::check_buyer_limit(
    buyer: &T::AccountId,
    amount_usdt: u64,
) -> Result<(), Error<T>>
```

**检查项**：
- 信用分是否 > 800（过低禁止交易）
- 是否超过单笔限额
- 是否超过每日限额
- 是否在冷却期内

**返回**：
- `Ok(())`: 可以创建订单
- `Err(_)`: 不符合条件，返回错误

---

#### 2. `update_credit_on_success`

**功能**：订单完成后更新信用（快速学习）

**调用**：
```rust
pallet_buyer_credit::Pallet::<T>::update_credit_on_success(
    buyer: &T::AccountId,
    amount_usdt: u64,
    payment_time_seconds: u64,
)
```

**效果**：
- 完成订单数 +1
- 风险分降低（基础 +10分，快速付款 +5~10分，大额交易 +5分）
- 应用权重系数（前3笔 5x，第4-5笔 3x，第6-10笔 2x）
- 检查是否可以升级
- 每5笔分析一次行为模式

---

#### 3. `penalize_default`

**功能**：违约惩罚（买家超时未付款）

**调用**：
```rust
pallet_buyer_credit::Pallet::<T>::penalize_default(buyer: &T::AccountId)
```

**效果**：
- 违约次数 +1
- 风险分增加（Newbie +50，Bronze +30，Silver +20，Gold +10，Diamond +5）
- 所有推荐关系失效
- 推荐人承担连带责任（+50分）

---

### 事件（Events）

| 事件 | 说明 | 参数 |
|------|------|------|
| `NewUserInitialized` | 新用户初始化 | account, tier, risk_score |
| `CreditUpdated` | 信用更新 | account, new_risk_score, new_level |
| `LevelUpgraded` | 等级升级 | account, old_level, new_level |
| `DefaultPenalty` | 违约惩罚 | account, penalty, new_risk_score |
| `UserEndorsed` | 用户推荐 | endorser, endorsee |
| `ReferrerSet` | 设置邀请人 | invitee, referrer |
| `BehaviorPatternDetected` | 行为模式识别 | account, pattern, adjustment |

---

### 错误（Errors）

| 错误 | 说明 |
|------|------|
| `CreditScoreTooLow` | 信用分过低（风险分 > 800） |
| `ExceedSingleLimit` | 超过单笔限额 |
| `ExceedDailyLimit` | 超过每日限额 |
| `InCooldownPeriod` | 冷却期内不能交易 |
| `InsufficientCreditToEndorse` | 推荐人信用不足 |
| `CannotEndorseSelf` | 不能推荐自己 |
| `AlreadyEndorsed` | 已经被推荐过 |
| `ReferrerAlreadySet` | 邀请人已设置 |
| `CannotReferSelf` | 不能邀请自己 |

---

### 前端调用示例

#### 查询信用信息

```typescript
import { usePolkadot } from '@/hooks/usePolkadot';

export function useBuyerCredit(address: string) {
  const { api } = usePolkadot();
  const [credit, setCredit] = useState(null);

  useEffect(() => {
    if (!api || !address) return;

    const fetchCredit = async () => {
      const result = await api.query.buyerCredit.buyerCredit(address);
      const creditData = result.toJSON();
      setCredit(creditData);
    };

    fetchCredit();
  }, [api, address]);

  return credit;
}
```

#### 推荐用户

```typescript
async function endorseUser(endorseeAddress: string) {
  const tx = api.tx.buyerCredit.endorseUser(endorseeAddress);
  
  await tx.signAndSend(currentAccount, ({ status, events }) => {
    if (status.isInBlock) {
      console.log('推荐成功！');
      // 查找 UserEndorsed 事件
      events.forEach(({ event }) => {
        if (event.section === 'buyerCredit' && event.method === 'UserEndorsed') {
          const [endorser, endorsee] = event.data;
          console.log(`${endorser} 推荐了 ${endorsee}`);
        }
      });
    }
  });
}
```

#### 设置邀请人

```typescript
async function setReferrer(referrerAddress: string) {
  const tx = api.tx.buyerCredit.setReferrer(referrerAddress);
  
  await tx.signAndSend(currentAccount, ({ status }) => {
    if (status.isInBlock) {
      console.log('邀请人设置成功！');
    }
  });
}
```

---

### OTC Order 集成示例

#### 开单前检查

```rust
// 在 otc-order 的 open_order 中
let amount_usdt = final_price_u64.saturating_mul(qty_b.saturated_into::<u64>()) / 1_000_000_000_000u64;
pallet_buyer_credit::Pallet::<T>::check_buyer_limit(&who, amount_usdt)
    .map_err(|_| Error::<T>::BadState)?;
```

#### 订单完成后更新

```rust
// 在 otc-order 的 release 中
let payment_time_seconds = (current_timestamp - ord.created_at).saturated_into::<u64>() / 1000u64;
pallet_buyer_credit::Pallet::<T>::update_credit_on_success(
    &ord.taker,
    amount_usdt,
    payment_time_seconds,
);
```

#### 超时违约惩罚

```rust
// 在 otc-order 的 refund_on_timeout 中
if matches!(ord.state, OrderState::Created | OrderState::PaidOrCommitted) {
    pallet_buyer_credit::Pallet::<T>::penalize_default(&ord.taker);
}
```

---

### 信用等级与限额对照表

#### 新用户等级（前20笔）

| 等级 | 风险分 | 单笔限额 | 每日限额 | 冷却期 | 升级条件 |
|------|--------|----------|----------|--------|----------|
| Premium | 0-300 | 5000U | 20000U | 无 | 完成3笔 → Gold |
| Standard | 301-500 | 1000U | 5000U | 12小时 | 完成5笔 → Bronze |
| Basic | 501-700 | 500U | 2000U | 24小时 | 完成10笔 → Bronze |
| Restricted | 701-1000 | 100U | 500U | 48小时 | 完成20笔 → Bronze |

#### 信用等级（21笔以上）

| 等级 | 订单数 | 单笔限额 | 每日限额 | 违约惩罚 |
|------|--------|----------|----------|----------|
| Newbie | 0-5 | 100U | 500U | -50分/次 |
| Bronze | 6-20 | 500U | 2000U | -30分/次 |
| Silver | 21-50 | 2000U | 10000U | -20分/次 |
| Gold | 51-100 | 10000U | 50000U | -10分/次 |
| Diamond | 101+ | 50000U | 无限制 | -5分/次 |

---

### 使用场景说明

#### 场景 1：持币大户首次购买

**用户画像**：
- 持有 10000 DUST
- 账户年龄 60 天
- 无邀请人

**系统处理**：
1. 资产信任：50分（持币100倍）
2. 年龄信任：50分（2个月）
3. 综合信任分：29分
4. 风险分：710 → **Basic**（500U/笔，24小时冷却）

**首笔快速付款后**：
- 权重5x，加分125
- 风险分降至 585
- 第3笔后 → 风险分210 → **Premium**（5000U/笔）

---

#### 场景 2：零钱包 + 高信用推荐

**用户画像**：
- 持有 10 DUST
- 账户年龄 1 天
- 高信用推荐人（风险分150）

**系统处理**：
1. 社交信任：40分（高信用邀请人）
2. 综合信任分：8分
3. 风险分：920 → **Restricted**（100U/笔，48小时冷却）

**提升路径**：
- 需完成20笔升级到 Bronze
- 但快速付款可加速降低风险分

---

### 注意事项

1. **风险分范围**：0-1000，越低越可信，>800 禁止交易
2. **新用户优化**：前20笔使用新用户等级，之后切换到信用等级
3. **快速学习**：前3笔权重5x，快速建立信用画像
4. **推荐连带责任**：推荐人需谨慎，被推荐人违约会影响自己信用
5. **行为分析**：每5笔自动分析，优质行为可快速降低风险分
6. **冷却期计算**：从上次购买时间开始计算，不是区块高度

---

### 相关文档

- 详细设计文档: `docs/AI风控模型-新用户冷启动优化方案.md`
- Pallet README: `pallets/buyer-credit/README.md`
- OTC信用制度设计: `docs/OTC信用制度与防恶意购买方案设计.md`

---

## 17. Maker Credit (做市商信用风控)

### 17.1 模块概述

**做市商信用 Pallet** 负责管理做市商的信用评分、履约追踪、违约惩罚和服务质量评价。

**核心目标**:
- 🎯 提升买家信任：透明的信用评分 + 履约数据展示
- 🛡️ 降低交易风险：自动筛选低信用做市商 + 违约惩罚
- 💰 激励优质服务：高信用→保证金折扣→接单成本降低
- 📊 辅助决策支持：数据化信用指标 + 历史记录追溯
- ⚖️ 争议解决依据：信用记录作为仲裁参考

**信用评分体系**:
- 分数范围：800-1000分
- 初始分数：850分（新做市商）
- 信用等级：钻石(950-1000)、白金(900-949)、黄金(850-899)、白银(820-849)、青铜(800-819)
- 服务状态：Active(正常)、Warning(警告,750-799)、Suspended(暂停,<750)

### 17.2 查询接口

#### 17.2.1 查询信用记录
\`\`\`typescript
const creditRecord = await api.query.makerCredit.creditRecords(makerId);
// 返回: Option<CreditRecord>
// 包含：信用分、等级、状态、履约数据、服务质量、违约记录、活跃度
\`\`\`

#### 17.2.2 查询当前信用分
\`\`\`typescript
const score = await api.query.makerCredit.getCreditScore(makerId);
// 返回: u16 (800-1000)
// 自动应用风险分衰减
\`\`\`

#### 17.2.3 查询信用等级
\`\`\`typescript
const tier = await api.query.makerCredit.getCreditTier(makerId);
// 返回: CreditTier (Diamond/Platinum/Gold/Silver/Bronze)
\`\`\`

#### 17.2.4 查询服务状态
\`\`\`typescript
const status = await api.query.makerCredit.checkServiceStatus(makerId);
// 返回: ServiceStatus (Active/Warning/Suspended)
\`\`\`

#### 17.2.5 查询履约率
\`\`\`typescript
const rates = await api.query.makerCredit.getFulfillmentRate(makerId);
// 返回: FulfillmentRate
// 包含：总订单数、完成订单数、及时释放订单数、完成率、及时率、超时率
\`\`\`

#### 17.2.6 查询保证金折扣
\`\`\`typescript
const discount = await api.query.makerCredit.calculateMarginDiscount(makerId);
// 返回: u8 (0-50)
// 钻石:50%, 白金:30%, 黄金:10%, 白银:0%, 青铜:0%
\`\`\`

#### 17.2.7 查询评价记录
\`\`\`typescript
const rating = await api.query.makerCredit.makerRatings(makerId, orderId);
// 返回: Option<Rating>
// 包含：买家、评分(1-5星)、标签代码、评价时间
\`\`\`

#### 17.2.8 查询违约历史
\`\`\`typescript
const defaults = await api.query.makerCredit.defaultHistory(makerId);
// 返回: Vec<(OrderId, DefaultRecord)>
// DefaultRecord包含：违约类型(Timeout/Dispute)、区块号、惩罚分数、是否恢复
\`\`\`

### 17.3 交易接口

#### 17.3.1 初始化信用记录
\`\`\`typescript
// 仅由 pallet-market-maker 调用（做市商审核通过时）
// 自动创建初始信用记录（850分，白银等级）
\`\`\`

#### 17.3.2 买家评价做市商
\`\`\`typescript
await api.tx.makerCredit
    .rateMaker(
        makerId,      // 做市商ID
        orderId,      // 订单ID
        5,            // 评分(1-5星)
        [0, 1, 2]     // 标签代码数组(最多5个)
        // 0=FastRelease, 1=GoodCommunication, 2=FairPrice,
        // 3=SlowRelease, 4=PoorCommunication, 5=Unresponsive
    )
    .signAndSend(buyerAccount);

// 信用分影响:
// 5星: +5分, 4星: +2分, 3星: 0分, 2星: -3分, 1星: -5分

// 验证规则:
// - 评分必须1-5星
// - 订单必须已完成(Released)
// - 调用者必须是订单买家
// - 每个订单只能评价一次
\`\`\`

#### 17.3.3 记录订单完成
\`\`\`typescript
// 仅由 pallet-otc-order 调用（订单释放时）
// 自动更新信用分：基础奖励+2分，及时释放(<24h)额外+1分
\`\`\`

#### 17.3.4 记录超时违约
\`\`\`typescript
// 仅由 pallet-otc-order 调用（订单超时时）
// 惩罚：信用分-10分，风险分+20分
\`\`\`

#### 17.3.5 记录争议败诉
\`\`\`typescript
// 仅由 pallet-arbitration 调用（争议裁决做市商败诉时）
// 惩罚：信用分-15分，风险分+30分
\`\`\`

#### 17.3.6 Root 手动调整信用分
\`\`\`typescript
await api.tx.sudo
    .sudo(
        api.tx.makerCredit.adminAdjustCredit(
            makerId,
            -50,  // 调整幅度（可为负数）
            '严重违规：虚假宣传'  // 调整原因
        )
    )
    .signAndSend(sudoAccount);
\`\`\`

### 17.4 事件

#### 17.4.1 CreditInitialized
\`\`\`rust
CreditInitialized {
    maker_id: u64,
    initial_score: u16,  // 850
}
\`\`\`

#### 17.4.2 MakerRated
\`\`\`rust
MakerRated {
    maker_id: u64,
    order_id: u64,
    buyer: AccountId,
    stars: u8,
    tags_codes: Vec<u8>,
    score_change: i16,
    new_score: u16,
}
\`\`\`

#### 17.4.3 OrderCompleted
\`\`\`rust
OrderCompleted {
    maker_id: u64,
    order_id: u64,
    response_time: u32,
    score_change: i16,
    new_score: u16,
}
\`\`\`

#### 17.4.4 DefaultRecorded
\`\`\`rust
DefaultRecorded {
    maker_id: u64,
    order_id: u64,
    default_type: u8,  // 0=Timeout, 1=Dispute
    penalty: i16,
    new_score: u16,
}
\`\`\`

#### 17.4.5 CreditAdjusted
\`\`\`rust
CreditAdjusted {
    maker_id: u64,
    amount: i16,
    reason: Vec<u8>,
    new_score: u16,
}
\`\`\`

#### 17.4.6 LevelChanged
\`\`\`rust
LevelChanged {
    maker_id: u64,
    old_level_code: u8,  // 0=Diamond, 1=Platinum, 2=Gold, 3=Silver, 4=Bronze
    new_level_code: u8,
    credit_score: u16,
}
\`\`\`

#### 17.4.7 StatusChanged
\`\`\`rust
StatusChanged {
    maker_id: u64,
    old_status_code: u8,  // 0=Active, 1=Warning, 2=Suspended
    new_status_code: u8,
    credit_score: u16,
}
\`\`\`

### 17.5 错误码

- `CreditRecordNotFound`: 信用记录未找到
- `CreditAlreadyExists`: 信用记录已存在（不能重复初始化）
- `InvalidRating`: 无效的评分（必须1-5星）
- `OrderNotFound`: 订单未找到
- `OrderNotCompleted`: 订单未完成（无法评价）
- `NotBuyer`: 不是订单买家（无权评价）
- `AlreadyRated`: 已评价过（不能重复评价）
- `CreditOverflow`: 信用分计算溢出

### 17.6 使用场景

#### 场景1：创建订单前检查做市商信用
\`\`\`typescript
const status = await api.query.makerCredit.checkServiceStatus(makerId);
if (status.isSuspended) {
    throw new Error('该做市商信用分过低，暂停接单');
}

const tier = await api.query.makerCredit.getCreditTier(makerId);
const rates = await api.query.makerCredit.getFulfillmentRate(makerId);
console.log(\`信用等级: \${tierNames[tier]}\`);
console.log(\`完成率: \${rates.completionRateX100 / 100}%\`);
\`\`\`

#### 场景2：订单完成后买家提交评价
\`\`\`typescript
await api.tx.makerCredit
    .rateMaker(makerId, orderId, 5, [0, 1, 2])  // 5星+快速释放+沟通好+价格公道
    .signAndSend(buyerAccount);
\`\`\`

#### 场景3：查看做市商保证金折扣
\`\`\`typescript
const discount = await api.query.makerCredit.calculateMarginDiscount(makerId);
const baseDeposit = 100000; // 100,000 DUST
const actualDeposit = baseDeposit * (100 - discount) / 100;
console.log(\`保证金折扣: \${discount}%, 实际保证金: \${actualDeposit} DUST\`);
\`\`\`

### 17.7 集成要点

1. **market-maker 集成**: 做市商审核通过时自动初始化信用记录
2. **otc-order 集成**: 
   - 创建订单前检查做市商服务状态
   - 订单释放后自动记录完成+更新信用分
   - 订单超时自动记录违约
3. **arbitration 集成**: 争议裁决做市商败诉时记录违约
4. **前端集成**: 
   - 做市商信用仪表板
   - 买家评价表单
   - 信用徽章组件

### 17.8 配置参数

\`\`\`rust
// runtime/src/configs/mod.rs
impl pallet_maker_credit::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = ();
    
    // 配置常量
    type BaseCredit = ConstU16<850>;        // 初始信用分
    type ReviewTimeout = ConstU32<172800>;  // 争议审核超时(48h)
    type DecayInterval = ConstU32<7200>;    // 衰减周期(7200区块 ≈ 12h)
    type DecayPerInterval = ConstU16<5>;    // 每周期衰减5分
}
\`\`\`

---

## 18. Affiliate Governance (即时分成比例治理)

### 18.1 模块概述

**即时分成比例治理模块** 允许社区通过民主投票机制修改联盟计酬的即时分成比例（InstantLevelPercents），确保分配比例的调整透明、民主、安全。

**核心目标**:
- 🗳️ 民主透明：全民参与，权重公平
- 🛡️ 安全可靠：多层防护，紧急机制
- ⚡ 高效便民：自动执行，激励参与
- 📊 持续优化：监控审计，迭代改进

**当前分成比例**（默认，总计99%）:
```
L1:  30% → 27.0 DUST  (90 * 30%)
L2:  25% → 22.5 DUST  (90 * 25%)
L3:  15% → 13.5 DUST  (90 * 15%)
L4:  10% → 9.0  DUST  (90 * 10%)
L5:   7% → 6.3  DUST  (90 * 7%)
L6:   3% → 2.7  DUST  (90 * 3%)
L7:   2% → 1.8  DUST  (90 * 2%)
L8:   2% → 1.8  DUST  (90 * 2%)
L9:   2% → 1.8  DUST  (90 * 2%)
L10:  1% → 0.9  DUST  (90 * 1%)
L11:  1% → 0.9  DUST  (90 * 1%)
L12:  1% → 0.9  DUST  (90 * 1%)
L13:  1% → 0.9  DUST  (90 * 1%)
L14:  1% → 0.9  DUST  (90 * 1%)
L15:  1% → 0.9  DUST  (90 * 1%)
────────────────────────
总计: 99% → 89.1 DUST
```

**系统费用分配**:
```
总金额: 100 DUST
├─ 销毁 (Burn): 5%     → 5 DUST
├─ 国库 (Treasury): 2% → 2 DUST
├─ 存储 (Storage): 3%  → 3 DUST
└─ 可分配金额: 90%     → 90 DUST → 进入推荐链分配
```

**治理层级结构**:
```
全民公投层（最高决策权威）
    ↓
技术委员会层（7人专家委员会）
    ↓
提案发起层（持币≥10000 DUST 或 1000人联署）
```

### 18.2 查询接口

#### 18.2.1 查询当前分成比例
\`\`\`typescript
const currentPercentages = await api.query.affiliate.instantLevelPercents();
// 返回: [30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1]
\`\`\`

#### 18.2.2 查询活跃提案
\`\`\`typescript
const activeProposals = await api.query.affiliate.activeProposals.entries();
// 返回: Vec<(ProposalId, PercentageAdjustmentProposal)>
// 包含：提案ID、新比例、生效时间、提案理由等
\`\`\`

#### 18.2.3 查询提案详情
\`\`\`typescript
const proposal = await api.query.affiliate.proposalDetails(proposalId);
// 返回: Option<PercentageAdjustmentProposal>
// 结构:
// {
//   proposal_id: u64,
//   title_cid: BoundedVec<u8>,
//   description_cid: BoundedVec<u8>,
//   new_percentages: [u8; 15],
//   effective_block: BlockNumber,
//   rationale_cid: BoundedVec<u8>,
//   impact_analysis_cid: BoundedVec<u8>,
// }
\`\`\`

#### 18.2.4 查询投票记录
\`\`\`typescript
const voteRecord = await api.query.affiliate.proposalVotes(proposalId, accountId);
// 返回: Option<VoteRecord>
// {
//   voter: AccountId,
//   vote: Vote,  // Aye/Nay/Abstain
//   conviction: Conviction,  // None/Locked1x ~ Locked6x
//   weight: u128,
//   timestamp: BlockNumber,
// }
\`\`\`

#### 18.2.5 查询投票统计
\`\`\`typescript
const tally = await api.query.affiliate.voteTally(proposalId);
// 返回: Option<VoteTally>
// {
//   aye_votes: u128,
//   nay_votes: u128,
//   abstain_votes: u128,
//   total_turnout: u128,
//   approval_rate: Perbill,
//   participation_rate: Perbill,
// }
\`\`\`

#### 18.2.6 查询用户投票权重
\`\`\`typescript
const votingPower = await api.query.affiliate.calculateVotingPower(accountId);
// 返回: u128
// 计算规则:
// - 持币权重（70%）：平方根(持币量)，上限1000
// - 参与权重（20%）：历史投票次数，最高100
// - 贡献权重（10%）：推荐贡献+委员会成员，最高300
\`\`\`

#### 18.2.7 查询提案历史
\`\`\`typescript
const history = await api.query.affiliate.percentageHistory.entries();
// 返回: Vec<(ProposalId, PercentageChangeRecord)>
// 记录所有生效的比例调整历史
\`\`\`

#### 18.2.8 查询治理暂停状态
\`\`\`typescript
const isPaused = await api.query.affiliate.governancePaused();
// 返回: bool
// true: 治理暂停（紧急情况）
// false: 正常运行
\`\`\`

### 18.3 交易接口

#### 18.3.1 发起比例调整提案
\`\`\`typescript
await api.tx.affiliate
    .proposePercentageAdjustment(
        newPercentages,      // [u8; 15] - 新的15层比例
        titleCid,            // BoundedVec<u8> - IPFS CID
        descriptionCid,      // BoundedVec<u8> - IPFS CID
        rationaleCid         // BoundedVec<u8> - IPFS CID
    )
    .signAndSend(proposerAccount);

// 提案权限要求（满足其一）:
// 1. 持币量 ≥ 10,000 DUST（大户提案）
// 2. ≥ 1000 人联署（联署提案）
// 3. 技术委员会成员提议（委员会提案）

// 提案类型自动判断:
// - 微调提案（单层≤3%，总变化≤10%）→ 技术委员会投票
// - 重大提案（单层>3%，或总变化>10%）→ 全民公投

// 押金要求:
// - 微调提案: 1,000 DUST
// - 重大提案: 10,000 DUST
// - 通过后押金退还

// 事件: PercentageAdjustmentProposed {
//   proposal_id, proposer, change_magnitude, is_major
// }
\`\`\`

**验证规则**:
```rust
// 1. 长度必须为15
ensure!(percentages.len() == 15, Error::<T>::InvalidPercentageLength);

// 2. 单个比例范围 0-100
ensure!(percentage <= 100, Error::<T>::PercentageTooHigh);

// 3. 前3层不能为0
ensure!(percentage > 0, Error::<T>::CriticalLayerZero);

// 4. 总和合理性 50-99
let total: u32 = percentages.iter().sum();
ensure!(total >= 50 && total <= 99, Error::<T>::InvalidTotal);

// 5. 前5层应递减
ensure!(percentages[i] <= percentages[i-1], Error::<T>::NonDecreasing);

// 6. L1最多50%（防止寡头垄断）
ensure!(percentages[0] <= 50, Error::<T>::FirstLayerTooHigh);
```

#### 18.3.2 对提案投票
\`\`\`typescript
await api.tx.affiliate
    .voteOnPercentageProposal(
        proposalId,      // u64 - 提案ID
        vote,            // Vote - Aye/Nay/Abstain
        conviction       // Conviction - 信念投票
    )
    .signAndSend(voterAccount);

// 投票选项:
// - Aye: 支持提案
// - Nay: 反对提案
// - Abstain: 弃权

// 信念投票（锁定时长 → 权重倍数）:
// - None: 不锁定 → 1x
// - Locked1x: 1周 → 1.5x
// - Locked2x: 2周 → 2x
// - Locked3x: 4周 → 3x
// - Locked4x: 8周 → 4x
// - Locked5x: 16周 → 5x
// - Locked6x: 32周 → 6x

// 最终投票权重:
// final_weight = base_voting_power * conviction_multiplier

// 事件: VoteCast {
//   proposal_id, voter, vote, weight
// }
\`\`\`

#### 18.3.3 取消提案
\`\`\`typescript
await api.tx.affiliate
    .cancelProposal(proposalId)
    .signAndSend(proposerAccount);

// 权限: 提案发起人
// 限制: 仅投票前可取消
// 效果: 退还押金
// 事件: ProposalCancelled { proposal_id, proposer }
\`\`\`

#### 18.3.4 执行已通过的提案
\`\`\`typescript
// 自动执行（无需手动调用）
// 每个区块的 on_finalize 钩子会检查是否有需要执行的提案
// 当 block_number >= proposal.effective_block 时自动执行

// 手动触发（可选，用于测试）:
await api.tx.affiliate
    .executeProposal(proposalId)
    .signAndSend(anyAccount);

// 效果:
// 1. 更新 InstantLevelPercents 存储
// 2. 记录到 PercentageHistory
// 3. 退还提案押金
// 4. 发射事件

// 事件: PercentageAdjustmentExecuted {
//   proposal_id, new_percentages, effective_block
// }
\`\`\`

#### 18.3.5 紧急暂停治理
\`\`\`typescript
await api.tx.affiliate
    .emergencyPauseGovernance(reasonCid)
    .signAndSend(councilMultisig);

// 权限: 技术委员会超级多数（5/7）
// 效果: 暂停所有进行中的投票和提案
// 场景: 发现重大安全漏洞
// 事件: GovernanceEmergencyPaused { reason_cid }
\`\`\`

#### 18.3.6 恢复治理机制
\`\`\`typescript
await api.tx.affiliate
    .resumeGovernance()
    .signAndSend(rootOrCouncil);

// 权限: Root 或 技术委员会全票（7/7）
// 效果: 恢复治理功能
// 事件: GovernanceResumed { by }
\`\`\`

#### 18.3.7 管理员手动调整比例
\`\`\`typescript
await api.tx.sudo
    .sudo(
        api.tx.affiliate.setPercentagesAdmin(
            newPercentages,     // [u8; 15]
            reasonCid           // BoundedVec<u8>
        )
    )
    .signAndSend(sudoAccount);

// 权限: Root（sudo）
// 场景: 紧急修复配置错误
// 不需要投票流程，立即生效
// 事件: PercentagesAdminSet { new_percentages, reason_cid }
\`\`\`

### 18.4 事件

#### 18.4.1 PercentageAdjustmentProposed
\`\`\`rust
PercentageAdjustmentProposed {
    proposal_id: u64,
    proposer: AccountId,
    change_magnitude: u32,      // 变化幅度（百分点）
    is_major: bool,             // 是否重大提案
}
\`\`\`

#### 18.4.2 VoteCast
\`\`\`rust
VoteCast {
    proposal_id: u64,
    voter: AccountId,
    vote: Vote,                 // Aye/Nay/Abstain
    weight: u128,               // 最终投票权重
}
\`\`\`

#### 18.4.3 ProposalPassed
\`\`\`rust
ProposalPassed {
    proposal_id: u64,
    approval_rate: Perbill,     // 支持率
    participation_rate: Perbill,// 参与率
    effective_block: BlockNumber,// 生效区块
}
\`\`\`

#### 18.4.4 ProposalRejected
\`\`\`rust
ProposalRejected {
    proposal_id: u64,
    approval_rate: Perbill,
    participation_rate: Perbill,
}
\`\`\`

#### 18.4.5 PercentageAdjustmentExecuted
\`\`\`rust
PercentageAdjustmentExecuted {
    proposal_id: u64,
    new_percentages: [u8; 15],
    effective_block: BlockNumber,
}
\`\`\`

#### 18.4.6 GovernanceEmergencyPaused
\`\`\`rust
GovernanceEmergencyPaused {
    reason_cid: BoundedVec<u8>,
}
\`\`\`

#### 18.4.7 GovernanceResumed
\`\`\`rust
GovernanceResumed {
    by: OriginType,  // Root/Council
}
\`\`\`

### 18.5 错误码

- `InvalidPercentageLength`: 比例数组长度必须为15
- `PercentageTooHigh`: 单层比例超过100%
- `CriticalLayerZero`: 前3层比例不能为0
- `TotalPercentageTooLow`: 总比例低于50%
- `TotalPercentageTooHigh`: 总比例超过99%
- `NonDecreasingPercentage`: 前5层比例应递减
- `FirstLayerTooHigh`: L1比例超过50%
- `InsufficientBalance`: 提案押金不足
- `ProposalNotFound`: 提案不存在
- `VotingNotActive`: 投票期已结束
- `AlreadyVoted`: 已经投过票
- `NotProposer`: 不是提案发起人
- `CannotCancelAfterVoting`: 投票开始后不能取消
- `TooManyActiveProposals`: 活跃提案过多（限制3个/账户）
- `ProposalTooFrequent`: 提案间隔过短（需≥7天）
- `InCooldownPeriod`: 冷却期内不能提案（失败后30天）
- `GovernancePaused`: 治理功能已暂停

### 18.6 使用场景

#### 场景1：持币大户发起微调提案

\`\`\`typescript
// 1. 准备新的比例配置
const newPercentages = [
  32,  // L1: 30% → 32% (+2%)
  23,  // L2: 25% → 23% (-2%)
  15, 15, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1  // 其他不变
];

// 2. 上传提案详情到IPFS
const titleCid = await ipfs.add('调整L1/L2比例以激励顶层推荐人');
const descCid = await ipfs.add('详细说明...');
const rationaleCid = await ipfs.add('数据分析...');

// 3. 提交提案
const tx = api.tx.affiliate.proposePercentageAdjustment(
  newPercentages,
  titleCid,
  descCid,
  rationaleCid
);

await tx.signAndSend(whaleAccount, ({ status, events }) => {
  if (status.isInBlock) {
    // 查找 PercentageAdjustmentProposed 事件
    const proposedEvent = events.find(e =>
      e.event.section === 'affiliate' &&
      e.event.method === 'PercentageAdjustmentProposed'
    );
    const proposalId = proposedEvent.event.data[0];
    console.log('提案ID:', proposalId.toString());
    console.log('类型: 微调提案（技术委员会审核）');
  }
});
\`\`\`

#### 场景2：社区联署发起重大提案

\`\`\`typescript
// 1. 收集1000+人联署
const signatories = []; // 1000+ accounts

// 2. 准备重大调整方案
const newPercentages = [
  20, 15, 10, 10, 10, 5, 5, 5, 5, 3, 3, 3, 3, 1, 1
  // 更平均的分配策略
];

// 3. 提交提案
const tx = api.tx.affiliate.proposePercentageAdjustment(
  newPercentages,
  titleCid,
  descCid,
  rationaleCid
);

await tx.signAndSend(initiatorAccount);
// 系统判断: is_major = true → 全民公投流程
\`\`\`

#### 场景3：用户投票

\`\`\`typescript
// 1. 查询提案详情
const proposal = await api.query.affiliate.proposalDetails(proposalId);
const proposalData = proposal.unwrap();

// 2. 下载IPFS内容
const description = await ipfs.cat(proposalData.description_cid);

// 3. 查看自己的投票权重
const votingPower = await api.query.affiliate.calculateVotingPower(myAccount);
console.log('基础投票权重:', votingPower.toString());

// 4. 选择信念投票（锁定4周，权重x3）
const tx = api.tx.affiliate.voteOnPercentageProposal(
  proposalId,
  'Aye',        // 支持
  'Locked3x'    // 锁定4周
);

await tx.signAndSend(myAccount, ({ events }) => {
  // 最终权重 = votingPower * 3
  console.log('投票成功，权重翻倍！');
});
\`\`\`

#### 场景4：提案自动执行

\`\`\`typescript
// 用户无需手动操作，链会自动执行

// 监听执行事件:
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (
      event.section === 'affiliate' &&
      event.method === 'PercentageAdjustmentExecuted'
    ) {
      const [proposalId, newPercentages, effectiveBlock] = event.data;
      console.log('提案已生效:', {
        proposalId: proposalId.toString(),
        newPercentages: newPercentages.toHuman(),
        block: effectiveBlock.toString(),
      });

      // 刷新UI显示新的分成比例
      refreshPercentages();
    }
  });
});
\`\`\`

#### 场景5：紧急情况暂停治理

\`\`\`typescript
// 技术委员会发现安全漏洞

// 1. 上传暂停原因到IPFS
const reasonCid = await ipfs.add('发现提案验证逻辑漏洞，紧急暂停');

// 2. 提交暂停交易（需5/7委员会成员签名）
const tx = api.tx.affiliate.emergencyPauseGovernance(reasonCid);

// 3. 通过委员会多签执行
await api.tx.council.execute(tx, threshold).signAndSend(...);

// 4. 修复漏洞后恢复
await api.tx.affiliate.resumeGovernance().signAndSend(root);
\`\`\`

### 18.7 前端集成示例

#### 治理仪表板组件

\`\`\`typescript
import React, { useState, useEffect } from 'react';
import { Card, Progress, Tag, Button } from 'antd';
import { useApi } from '@/hooks/useApi';

export const GovernanceDashboard: React.FC = () => {
  const { api } = useApi();
  const [activeProposals, setActiveProposals] = useState([]);
  const [myVotingPower, setMyVotingPower] = useState(0);

  useEffect(() => {
    loadData();
  }, [api]);

  const loadData = async () => {
    // 加载活跃提案
    const proposals = await api.query.affiliate.activeProposals.entries();
    const formatted = await Promise.all(
      proposals.map(async ([key, proposal]) => {
        const id = key.args[0].toNumber();
        const tally = await api.query.affiliate.voteTally(id);
        return {
          id,
          ...proposal.toJSON(),
          tally: tally.unwrap().toJSON(),
        };
      })
    );
    setActiveProposals(formatted);

    // 查询我的投票权重
    const power = await api.query.affiliate.calculateVotingPower(myAccount);
    setMyVotingPower(power.toNumber());
  };

  return (
    <div className="governance-dashboard">
      <Card title="我的投票权重" extra={<Tag color="blue">{myVotingPower}</Tag>}>
        <div>持币权重: {myVotingPower * 0.7}</div>
        <div>参与权重: {myVotingPower * 0.2}</div>
        <div>贡献权重: {myVotingPower * 0.1}</div>
      </Card>

      <Card title="活跃提案" extra={<Button type="primary">发起提案</Button>}>
        {activeProposals.map((proposal) => (
          <Card.Grid key={proposal.id} style={{ width: '100%' }}>
            <h3>提案 #{proposal.id}</h3>
            <p>新比例: {proposal.new_percentages.join(', ')}</p>
            <Progress
              percent={
                (proposal.tally.aye_votes /
                  (proposal.tally.aye_votes + proposal.tally.nay_votes)) *
                100
              }
              status={
                proposal.tally.approval_rate >= 0.6 ? 'success' : 'normal'
              }
            />
            <div>
              <Tag color="green">支持: {proposal.tally.aye_votes}</Tag>
              <Tag color="red">反对: {proposal.tally.nay_votes}</Tag>
              <Tag>弃权: {proposal.tally.abstain_votes}</Tag>
            </div>
            <Button onClick={() => voteOnProposal(proposal.id)}>
              投票
            </Button>
          </Card.Grid>
        ))}
      </Card>
    </div>
  );
};
\`\`\`

### 18.8 配置参数

\`\`\`rust
// runtime/src/configs/mod.rs

impl pallet_affiliate::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = ();

    // 治理配置
    type GovernanceOrigin = pallet_collective::EnsureProportionAtLeast<
        AccountId, CouncilCollective, 2, 3
    >;
    type DemocracyOrigin = pallet_democracy::EnsureProposal<AccountId>;

    // 时间参数
    type DiscussionPeriod = ConstU32<100800>;   // 7天讨论期
    type VotingPeriod = ConstU32<201600>;       // 14天投票期
    type EnactmentDelay = ConstU32<43200>;      // 3天执行延迟
    type EmergencyPeriod = ConstU32<14400>;     // 24小时紧急投票

    // 押金参数
    type MinorProposalDeposit = ConstU128<1000>;   // 1000 DUST
    type MajorProposalDeposit = ConstU128<10000>;  // 10000 DUST

    // 阈值参数
    type MinorChangeThreshold = ConstU32<10>;   // 10%变化阈值
    type MinTurnout = Perbill::from_percent(15);  // 最低15%参与率

    // 反垃圾参数
    type MaxConcurrentProposals = ConstU32<3>;
    type MinProposalInterval = ConstU32<100800>;  // 7天间隔
    type FailureCooldown = ConstU32<432000>;      // 30天冷却
}
\`\`\`

### 18.9 相关文档

- 详细设计文档: `docs/即时分成比例全民投票治理方案.md`
- Pallet README: `pallets/affiliate/README.md`
- Runtime配置: `runtime/src/configs/mod.rs`

---

