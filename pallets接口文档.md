# Buddha 区块链前端 API 接口统一文档

基于您项目中的所有 pallet，以下是完整的前端外部可调用接口统一文档：

## 1. 订单管理 (pallet-order)

### 1.1 create_order - 创建订单
- 功能：用户创建服务订单
- 调用参数：
  - service_index: u32 - 服务索引
  - amount: BalanceOf<T> - 订单金额
  - extra_note: Option<BoundedVec<u8, T::MaxOrderNoteLen>> - 额外说明
- 权限：任何已签名用户
- 状态变更：创建订单，状态为 Created
- 返回事件：OrderCreated { order_id, buyer, agent, service_index, amount }

### 1.2 accept_order - 接受订单
- 功能：代办人接受订单
- 调用参数：order_id: u64 - 订单ID
- 权限：订单对应的代办人
- 状态变更：订单状态从 Created → Accepted
- 返回事件：OrderAccepted { order_id }

### 1.3 start_order - 开始订单
- 功能：代办人开始执行订单
- 调用参数：order_id: u64 - 订单ID
- 权限：订单对应的代办人
- 状态变更：订单状态从 Accepted → InProgress
- 返回事件：OrderStarted { order_id }

### 1.4 submit_order_proof - 提交订单证据
- 功能：代办人上传订单完成证据（图片/视频）
- 调用参数：
  - order_id: u64 - 订单ID
  - imgs: Vec<BoundedVec<u8, T::MaxCidLen>> - 图片IPFS CID列表（最多20个）
  - vids: Vec<BoundedVec<u8, T::MaxCidLen>> - 视频IPFS CID列表（最多5个）
  - note_hash: Option<sp_core::H256> - 说明哈希值
- 权限：订单对应的代办人
- 状态变更：订单状态从 InProgress → Submitted
- 返回事件：OrderProofSubmitted { order_id }

### 1.5 confirm_done_by_buyer - 买家确认完成
- 功能：买家确认订单完成
- 调用参数：order_id: u64 - 订单ID
- 权限：订单买家
- 状态变更：订单状态从 Submitted → Released → Closed
- 资金操作：释放托管资金给代办人（扣除2%平台费）
- 返回事件：OrderReleasedAndClosed { order_id }

### 1.6 finalize_expired - 处理超时订单
- 功能：处理超时未确认的订单（任何人可调用）
- 调用参数：order_id: u64 - 订单ID  
- 权限：任何已签名用户
- 条件：订单状态为 Submitted 且超过确认期限（2天）
- 状态变更：订单状态从 Submitted → Released → Closed
- 返回事件：OrderReleasedAndClosed { order_id }

## 2.（已移除）

### 2.1 register_temple - 注册寺庙
- 功能：注册新的寺庙
- 调用参数：
  - temple_name: BoundedVec<u8, T::MaxTempleNameLen> - 寺庙名称
  - location: BoundedVec<u8, T::MaxLocationLen> - 地理位置
  - description: Option<BoundedVec<u8, T::MaxDescLen>> - 描述信息
- 权限：任何已签名用户
- 返回事件：TempleRegistered { temple_id, admin }

### 2.2 add_service - 添加服务
- 功能：为寺庙添加新服务项目
- 调用参数：
  - temple_id: u64 - 寺庙ID
  - service_name: BoundedVec<u8, T::MaxServiceNameLen> - 服务名称
  - description: Option<BoundedVec<u8, T::MaxDescLen>> - 服务描述
  - base_price: BalanceOf<T> - 基础价格
- 权限：寺庙管理员
- 返回事件：ServiceAdded { temple_id, service_index }

## 3. 代办人管理 (pallet-agent)

### 3.1 register_agent - 注册代办人
- 功能：注册成为代办人
- 调用参数：
  - temple_id: u64 - 服务的寺庙ID
  - name: BoundedVec<u8, T::MaxAgentNameLen> - 代办人姓名
  - contact: Option<BoundedVec<u8, T::MaxContactLen>> - 联系方式
- 权限：任何已签名用户
- 返回事件：AgentRegistered { agent_id, account, temple_id }

### 3.2 toggle_offering - 切换服务状态
- 功能：启用/禁用代办服务
- 调用参数：agent_id: u64 - 代办人ID
- 权限：代办人本人
- 返回事件：AgentOfferingToggled { agent_id, now_offering }

### 3.3 set_price - 设置服务价格
- 功能：设置特定服务的价格
- 调用参数：
  - agent_id: u64 - 代办人ID
  - service_index: u32 - 服务索引
  - price: BalanceOf<T> - 价格
- 权限：代办人本人
- 返回事件：AgentPriceSet { agent_id, service_index, price }

## 4. 仲裁管理 (pallet-arbitration)

### 4.1 dispute - 发起争议
- 功能：对订单发起仲裁
- 调用参数：
  - order_id: u64 - 订单ID
  - evidence_cids: Vec<BoundedVec<u8, T::MaxCidLen>> - 证据IPFS CID列表
  - note: Option<BoundedVec<u8, T::MaxNoteLen>> - 争议说明
- 权限：订单买家或代办人
- 状态变更：创建仲裁案例
- 返回事件：DisputeCreated { dispute_id, order_id, disputer }

### 4.2 arbitrate - 仲裁裁决
- 功能：仲裁者做出裁决
- 调用参数：
  - dispute_id: u64 - 争议ID
  - decision: ArbitrationDecision - 裁决结果（支持买家/代办人）
  - evidence_cids: Vec<BoundedVec<u8, T::MaxCidLen>> - 裁决证据
  - note: Option<BoundedVec<u8, T::MaxNoteLen>> - 裁决说明
- 权限：指定的仲裁者
- 返回事件：DisputeArbitrated { dispute_id, decision }

## 5. 托管管理 (pallet-escrow)

### 5.1 lock - 锁定资金
- 功能：将资金锁定到托管账户
- 调用参数：
  - dest: T::AccountId - 受益人账户
  - amount: BalanceOf<T> - 锁定金额
- 权限：任何已签名用户
- 返回事件：FundsLocked { escrow_id, payer, dest, amount }

### 5.2 release - 释放资金
- 功能：释放托管资金给受益人
- 调用参数：escrow_id: u64 - 托管ID
- 权限：资金支付者
- 返回事件：FundsReleased { escrow_id }

### 5.3 refund - 退还资金
- 功能：将托管资金退还给支付者
- 调用参数：escrow_id: u64 - 托管ID
- 权限：资金支付者
- 返回事件：FundsRefunded { escrow_id }

## 6. 供奉管理 (pallet-ritual)

### 6.1 register_spec - 注册供奉规格
- 功能：注册供奉规格模板
- 调用参数：
  - target_type: u8 - 目标类型
  - target_id: u64 - 目标ID
  - rules: BoundedVec<RitualRule, T::MaxRulesPerSpec> - 供奉规则
- 权限：任何已签名用户
- 返回事件：SpecRegistered { spec_id }

### 6.2 update_spec - 更新供奉规格
- 功能：更新已有的供奉规格
- 调用参数：
  - spec_id: u64 - 规格ID
  - new_rules: BoundedVec<RitualRule, T::MaxRulesPerSpec> - 新规则
- 权限：规格创建者
- 返回事件：SpecUpdated { spec_id }

### 6.3 offer_tribute - 提交供奉
- 功能：根据规格提交供奉行为
- 调用参数：
  - spec_id: u64 - 规格ID
  - evidence_cids: Vec<BoundedVec<u8, T::MaxCidLen>> - 证据IPFS CID
  - note: Option<BoundedVec<u8, T::MaxNoteLen>> - 说明
- 权限：任何已签名用户
- 返回事件：TributeOffered { spec_id, offerer, tribute_id }

## 7.（已移除）

### 7.1 register_headband - 注册设备
- 功能：注册冥想头带设备
- 调用参数：
  - device_id: BoundedVec<u8, T::MaxDeviceIdLen> - 设备ID
  - public_key: sp_core::sr25519::Public - 设备公钥
- 权限：设备制造商或授权方
- 返回事件：HeadbandRegistered { device_id }

### 7.2 open_bind_challenge - 开启绑定挑战
- 功能：开启设备绑定挑战期
- 调用参数：device_id: BoundedVec<u8, T::MaxDeviceIdLen> - 设备ID
- 权限：任何已签名用户
- 返回事件：BindChallengeOpened { device_id, challenger }

### 7.3 bind_headband - 绑定设备
- 功能：将设备绑定到用户账户
- 调用参数：
  - device_id: BoundedVec<u8, T::MaxDeviceIdLen> - 设备ID
  - signature: sp_core::sr25519::Signature - 设备签名
- 权限：任何已签名用户
- 返回事件：HeadbandBound { device_id, user }

### 7.4 unbind_headband - 解绑设备
- 功能：解除设备绑定
- 调用参数：device_id: BoundedVec<u8, T::MaxDeviceIdLen> - 设备ID
- 权限：设备当前绑定用户
- 返回事件：HeadbandUnbound { device_id }

## 8. 代币兑换 (pallet-exchange)

### 8.1 set_allocs - 批量设置分配
- 功能：批量替换所有分配项
- 调用参数：allocs: Vec<(T::AccountId, Perbill)> - 分配列表
- 权限：Root 或授权账户
- 返回事件：AllocsSet

### 8.2 update_alloc - 更新分配项
- 功能：更新单个分配项
- 调用参数：
  - account: T::AccountId - 账户
  - alloc: Perbill - 分配比例
- 权限：Root 或授权账户
- 返回事件：AllocUpdated { account, alloc }

### 8.3 remove_alloc - 移除分配项
- 功能：移除指定账户的分配
- 调用参数：account: T::AccountId - 账户
- 权限：Root 或授权账户
- 返回事件：AllocRemoved { account }

### 8.4 exchange - 代币兑换
- 功能：BUD 代币兑换为 Karma
- 调用参数：bud_amount: BalanceOf<T> - BUD 数量
- 权限：任何已签名用户
- 返回事件：Exchanged { user, bud_amount, karma_amount }

## 9. 授权管理 (pallet-authorizer)

### 9.1 submit_proposal - 提交提案
- 功能：提交授权变更提案
- 调用参数：
  - target: T::AccountId - 目标账户
  - action: AuthAction - 授权动作（授予/撤销）
- 权限：已授权的提案者
- 返回事件：ProposalSubmitted { proposal_id, proposer }

### 9.2 vote - 投票
- 功能：对提案进行投票
- 调用参数：
  - proposal_id: u64 - 提案ID
  - approve: bool - 是否赞成
- 权限：已授权的投票者
- 返回事件：Voted { proposal_id, voter, approve }

### 9.3 execute - 执行提案
- 功能：执行已通过的提案
- 调用参数：proposal_id: u64 - 提案ID
- 权限：任何已签名用户
- 条件：提案已获得足够赞成票
- 返回事件：ProposalExecuted { proposal_id }

## 10. 元交易 (pallet-forwarder)

### 10.1 open_session - 开启会话
- 功能：开启元交易会话
- 调用参数：target: T::AccountId - 目标账户
- 权限：任何已签名用户
- 返回事件：SessionOpened { session_id, forwarder, target }

### 10.2 close_session - 关闭会话
- 功能：关闭元交易会话
- 调用参数：session_id: u64 - 会话ID
- 权限：会话发起者或目标用户
- 返回事件：SessionClosed { session_id }

### 10.3 forward - 转发交易
- 功能：转发元交易
- 调用参数：
  - session_id: u64 - 会话ID
  - call: Box<<T as Config>::RuntimeCall> - 要转发的调用
  - signature: sp_runtime::MultiSignature - 目标用户签名
- 权限：会话发起者
- 返回事件：CallForwarded { session_id }

## 11.（已移除）

<!-- 11.x 条目已移除 -->

## 12.（已移除）

<!-- 12.x 条目已移除 -->

## 13. OTC 三件套（非官方）

### 13.1 做市商管理 (pallet-otc-maker)
- **功能**：做市商（经销商）准入、资料承诺、启用/停牌；前置 KYC（pallet-identity 正向裁决）
- **调用**：
  - `otcMaker.upsertMaker(paymentCidCommit: H256)`
    - 说明：注册或更新做市商资料，默认启用
    - 权限：签名账户，且通过 KYC
    - 事件：`MakerUpserted { who }`
  - `otcMaker.setActive(active: bool)`
    - 说明：切换启用/停牌
    - 权限：做市商本人；启用时需通过 KYC
    - 事件：`MakerStatusChanged { who, active }`

### 13.2 挂单管理 (pallet-otc-listing)
- **功能**：创建/取消 OTC 挂单，保存条款承诺（加密条款 CID 承诺）
- **调用**：
  - `otcListing.createListing(side: u8, base: u32, quote: u32, price: Balance, minQty: Balance, maxQty: Balance, total: Balance, partial: bool, expireAt: BlockNumber, termsCommit?: BoundedVec<u8, MaxCidLen>)`
    - 说明：创建挂单，`side`=0 买单/1 卖单
    - 权限：签名账户（通常为做市商）
    - 事件：`ListingCreated { id }`
  - `otcListing.cancelListing(id: u64)`
    - 说明：取消挂单
    - 权限：挂单创建者
    - 事件：`ListingCanceled { id }`

### 13.3 订单管理 (pallet-otc-order)
- **功能**：吃单创建订单、标记支付/进入争议
- **调用**：
  - `otcOrder.openOrder(listingId: u64, price: Balance, qty: Balance, amount: Balance, paymentCommit: H256, contactCommit: H256)`
    - 说明：吃单创建订单；承诺仅存哈希
    - 权限：签名账户（taker）
    - 返回：事件 `OrderOpened { id }`
  - `otcOrder.markPaid(id: u64)`
    - 说明：买家标记已支付/已提交凭据
    - 权限：订单 `taker`
    - 返回：事件 `OrderPaidCommitted { id }`
  - `otcOrder.markDisputed(id: u64)`
    - 说明：标记争议中（Paid 未放行/过期/证据期内任一成立）
    - 权限：订单参与方（maker/taker）
    - 返回：事件 `OrderDisputed { id }`

---

## 14. 证据管理 (pallet-evidence)（非官方）
- **总体**：链下加密，链上承诺与引用。V1 存储 CID 列表（兼容），V2 仅登记承诺。

### 14.1 commit(domain: u8, targetId: u64, imgs: Vec<Cid>, vids: Vec<Cid>, docs: Vec<Cid>, memo?: BoundedVec)
- **功能**：提交证据（V1：保存加密 CID 列表）
- **权限**：Authorizer 通过的账户
- **事件**：`EvidenceCommitted { id, domain, target_id, owner }`

### 14.2 link(domain: u8, targetId: u64, id: u64)
- **功能**：为目标链接既有证据 id
- **事件**：`EvidenceLinked { domain, target_id, id }`

### 14.3 unlink(domain: u8, targetId: u64, id: u64)
- **功能**：取消链接
- **事件**：`EvidenceUnlinked { domain, target_id, id }`

### 14.4 commitHash(ns: [u8;8], subjectId: u64, commit: H256, memo?: BoundedVec)  // V2
- **功能**：仅登记承诺哈希（不存 CID 列表）
- **权限**：Authorizer 通过的账户
- **事件**：`EvidenceCommittedV2 { id, ns, subject_id, owner }`

### 14.5 linkByNs(ns: [u8;8], subjectId: u64, id: u64)  // V2
- **功能**：按命名空间与主体链接证据 id
- **事件**：`EvidenceLinkedV2 { ns, subject_id, id }`

### 14.6 unlinkByNs(ns: [u8;8], subjectId: u64, id: u64)  // V2
- **功能**：按命名空间与主体取消链接
- **事件**：`EvidenceUnlinkedV2 { ns, subject_id, id }`

调用参数别名：
- Cid = `BoundedVec<u8, MaxCidLen>`

---

## 15. 仲裁管理 (pallet-arbitration)（非官方）
- **总体**：路由到域的业务 Pallet；只保存争议登记与 `evidence_id` 引用。

### 15.1 dispute(domain: [u8;8], id: u64, evidence: Vec<Cid>)
- **功能**：登记争议（兼容旧式 CID 提交）
- **权限**：由 Router.can_dispute 校验（通常为订单参与方）
- **事件**：`Disputed { domain, id }`

### 15.2 arbitrate(domain: [u8;8], id: u64, decisionCode: u8, bps?: u16)
- **功能**：裁决（0=Release,1=Refund,2=Partial(bps)）
- **权限**：仲裁者白名单/治理授权
- **事件**：`Arbitrated { domain, id, decision, bps }`

### 15.3 disputeWithEvidenceId(domain: [u8;8], id: u64, evidenceId: u64)
- **功能**：以 `evidence_id` 登记争议（推荐 V2）
- **事件**：`Disputed { domain, id }`

### 15.4 appendEvidenceId(domain: [u8;8], id: u64, evidenceId: u64)
- **功能**：为已登记争议追加 `evidence_id`
- **返回**：成功无返回值（事件可选）

---

## 16. 纪念园区/陵墓/供奉（非官方）

### 16.1 纪念园区 (pallet-memorial-park)
- `memorialPark.createPark(country: BoundedVec<u8>, region: BoundedVec<u8>, metaCid?: BoundedVec<u8>)`
  - 事件：`ParkCreated { id }`
- `memorialPark.updatePark(id: u64, region?: BoundedVec<u8>, metaCid?: BoundedVec<u8>, active?: bool)`
  - 事件：`ParkUpdated { id }`
- `memorialPark.setParkAdmin(id: u64, newAdmin: AccountId)`
  - 事件：`ParkAdminSet { id }`
- `memorialPark.transferPark(id: u64, newOwner: AccountId)`
  - 事件：`ParkTransferred { id }`

### 16.2 陵墓 (pallet-grave)
- `grave.createGrave(parkId: u64, kindCode: u8, capacity: u16, metaCid?: BoundedVec<u8>)`
  - 事件：`GraveCreated { id }`
- `grave.updateGrave(id: u64, metaCid?: BoundedVec<u8>, active?: bool)`
  - 事件：`GraveUpdated { id }`
- `grave.transferGrave(id: u64, newOwner: AccountId)`
  - 事件：`GraveTransferred { id }`
- `grave.inter(graveId: u64, deceasedId: u64, memo?: BoundedVec<u8>)`
  - 事件：`IntermentCommitted { grave_id, deceased_id }`
- `grave.exhume(graveId: u64, deceasedId: u64)`
  - 事件：`ExhumationCommitted { grave_id, deceased_id }`

### 16.3 供奉 (pallet-memorial-offerings)
- `memorialOfferings.registerSpec(kindCode: u8, metaCid?: BoundedVec<u8>)`
  - 事件：`SpecRegistered { id }`
- `memorialOfferings.updateSpec(id: u64, active?: bool, metaCid?: BoundedVec<u8>)`
  - 事件：`SpecUpdated { id }`
- `memorialOfferings.offer(target: (u8,u64), specId: u64, memo?: BoundedVec<u8>)`
  - 事件：`OfferingCommitted { id, spec_id, target }`
- `memorialOfferings.batchOffer(vec<(target, specId, memo?)>)`
  - 事件：多次 `OfferingCommitted`

---

## 17. 元交易代付（非官方扩展说明）
- 允许命名空间：
  - 仲裁：`ArbitrationNsBytes` → `Arbitration::dispute/arbitrate`
  - 证据：`EvidenceNsBytes` → `Evidence::commit/commitHash/link/linkByNs/unlink/unlinkByNs`
  - OTC 吃单：`OtcOrderNsBytes` → `OtcOrder::openOrder`
- 返回参数：与各调用事件为准；代付不改变调用返回结构。

## 17. 模板示例 (pallet-template)

### 17.1 do_something - 示例功能
- 功能：示例存储操作
- 调用参数：something: u32 - 示例数值
- 权限：任何已签名用户
- 返回事件：SomethingStored { something, who }

### 17.2 cause_error - 错误示例
- 功能：演示错误处理
- 调用参数：无
- 权限：任何已签名用户
- 返回事件：可能抛出 NoneValue 或 StorageOverflow 错误

---

## 前端调用方法

### Polkadot-JS API 调用示例

```javascript
// 1. 创建订单
await api.tx.order.createOrder(serviceIndex, amount, extraNote)
  .signAndSend(account, callback);

// temple 已移除，无对应调用

// 3. 提交订单证据
await api.tx.order.submitOrderProof(orderId, imgCids, vidCids, noteHash)
  .signAndSend(account, callback);

// 4. 查询订单状态
const order = await api.query.order.orders(orderId);
const proof = await api.query.order.proofOf(orderId);
```

### 错误处理

所有接口均可能返回以下通用错误：
- BadOrigin - 权限不足
- InvalidParameter - 参数无效
- 各 pallet 特定的业务错误（如 NotFound、AlreadyExists 等）

### 权重与费用

- 每个接口都定义了执行权重，影响交易费用
- 复杂操作（如包含存储写入、事件发出）权重更高
- 建议根据实际 runtime 配置估算交易费用