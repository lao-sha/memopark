# Stardust OTC交易系统与仲裁系统深度分析

## 目录
1. [系统架构概览](#系统架构概览)
2. [OTC订单系统](#otc订单系统)
3. [仲裁系统](#仲裁系统)
4. [证据系统](#证据系统)
5. [信用与惩罚机制](#信用与惩罚机制)
6. [跨Pallet交互](#跨pallet交互)
7. [完整的流程示例](#完整的流程示例)

---

## 系统架构概览

### 核心模块关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Stardust OTC生态系统                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  pallet-otc-     │  │   pallet-       │  │   pallet-    │  │
│  │  order           │  │   arbitration   │  │   evidence   │  │
│  │  订单管理         │◄─┤   仲裁系统      │◄─┤   证据管理   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│         │                      │                      │         │
│         │                      │                      │         │
│         v                      v                      v         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  pallet-escrow   │  │   pallet-       │  │   pallet-    │  │
│  │  托管/资金管理    │  │   credit        │  │   stardust-  │  │
│  └──────────────────┘  │   信用评分      │  │   ipfs       │  │
│                         └──────────────────┘  │   IPFS Pin   │  │
│                                              └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心流程时序图

```
买家                                 做市商                      仲裁/信用系统
 │                                   │                            │
 │─── create_order ──────────────────► 验证激活状态               │
 │                                    锁定DUST到托管              │
 │◄────── OrderCreated ───────────────                            │
 │        Event                                                   │
 │                                                                │
 │─── mark_paid (可选TRON哈希) ──────► 状态→PaidOrCommitted       │
 │                                                                │
 │◄────── OrderStateChanged ──────────                            │
 │        Event                        │                         │
 │                                     │                         │
 │                          ─── release_dust ─────────┐          │
 │                          │                         v          │
 │                          │          释放DUST到买家  │          │
 │                          │          记录订单完成    │          │
 │                          │          (信用+2)      │          │
 │◄────────────────────────release_all ────────────┘ │          │
 │        DUST到账                     │              │          │
 │                                     │   订单完成   │          │
 │                                     └─────────────►│          │
 │                                                    │          │
 │  或者发起争议（有异议时）                         │          │
 │─── dispute_order ─────────────────► 状态→Disputed │          │
 │                                                    v          │
 │                                          ┌──────────────────┐ │
 │                                          │ pallet-          │ │
 │                                          │ arbitration      │ │
 │                                          │ 登记争议         │ │
 │                                          │ 等待治理裁决    │ │
 │                                          └──────────────────┘ │
 │  ┌─提交证据到pallet-evidence────────────────────────────────┐ │
 │  │  commit(domain, target_id, images, videos, docs)         │ │
 │  └────────────────────────────────────────────────────────► │ │
 │                                          ┌──────────────────┐ │
 │                                          │ pallet-evidence  │ │
 │                                          │ 存储证据CID      │ │
 │                                          │ 自动Pin到IPFS   │ │
 │                                          └──────────────────┘ │
 │  ┌─引用Evidence ID发起仲裁──────────────────────────────────┐ │
 │  │  dispute_with_evidence_id(domain, id, evidence_id)       │ │
 │  └────────────────────────────────────────────────────────► │ │
 │                                                    v          │
 │                                    ┌─────────────────────┐   │
 │                                    │ 治理委员会          │   │
 │                                    │ arbitrate()         │   │
 │                                    │ ├─ Release(0)      │   │
 │                                    │ ├─ Refund(1)       │   │
 │                                    │ └─ Partial(2, bps) │   │
 │                                    └─────────────────────┘   │
 │                                            │                  │
 │ ┌──────────────────────────────────────────┴──────────────┐  │
 │ │ apply_arbitration_decision() 执行裁决                  │  │
 │ │ 释放/退款 → 记录信用变化 → 标记订单关闭              │  │
 │ └───────────────────────────────────────────────────────┘   │
```

---

## OTC订单系统

### 1. 核心数据结构

#### OrderState - 订单状态机

```rust
pub enum OrderState {
    Created,           // 0: 已创建，等待买家付款（1小时超时）
    PaidOrCommitted,   // 1: 买家已标记付款或做市商已确认
    Released,          // 2: DUST已释放到买家
    Refunded,          // 3: 已全额退款（争议败诉或超时取消）
    Canceled,          // 4: 已取消（买家或做市商主动取消）
    Disputed,          // 5: 争议中（等待仲裁裁决）
    Closed,            // 6: 已关闭（最终状态）
    Expired,           // 7: 已过期（1小时未支付，自动取消）
}
```

**状态转移图：**
```
Created 
  ├─→ mark_paid() → PaidOrCommitted
  │                    ├─→ release_dust() → Released (完成)
  │                    ├─→ dispute_order() → Disputed (争议)
  │                    └─→ [超时] → Expired
  ├─→ cancel_order() → Canceled (取消)
  └─→ [1小时未支付] → Expired → cancel_order() → Canceled
```

#### Order - 订单结构

```rust
pub struct Order<T: Config> {
    pub maker_id: u64,                      // 做市商ID
    pub maker: T::AccountId,                // 做市商账户
    pub taker: T::AccountId,                // 买家账户
    pub price: BalanceOf<T>,                // 单价 (USDT/DUST, 精度10^6)
    pub qty: BalanceOf<T>,                  // 数量 (DUST数量)
    pub amount: BalanceOf<T>,               // 总金额 (USDT金额)
    pub created_at: MomentOf,               // 创建时间 (毫秒)
    pub expire_at: MomentOf,                // 超时时间 (默认1小时)
    pub evidence_until: MomentOf,           // 证据提交截止时间 (24小时)
    pub maker_tron_address: TronAddress,    // 做市商TRON收款地址 (34字节)
    pub payment_commit: H256,               // 支付承诺哈希 (H(payment_proof))
    pub contact_commit: H256,               // 联系方式承诺哈希 (H(contact))
    pub state: OrderState,                  // 当前状态
    pub epay_trade_no: Option<Vec<u8>>,    // EPAY交易号 (可选)
    pub completed_at: Option<MomentOf>,    // 完成时间
    pub is_first_purchase: bool,            // 是否首购订单
}
```

### 2. 存储映射

| 存储项 | 类型 | 说明 | 限制 |
|--------|------|------|------|
| `NextOrderId` | `u64` | 下一个订单ID计数器 | - |
| `Orders` | `Map<u64, Order>` | 订单主记录 | - |
| `BuyerOrders` | `Map<AccountId, Vec<u64>>` | 买家订单列表 | 100个/买家 |
| `MakerOrders` | `Map<u64, Vec<u64>>` | 做市商订单列表 | 1000个/做市商 |
| `HasFirstPurchased` | `Map<AccountId, bool>` | 买家首购标记 | 永久标记 |
| `MakerFirstPurchaseCount` | `Map<u64, u32>` | 做市商首购计数 | 同时最多5个 |
| `MakerFirstPurchaseOrders` | `Map<u64, Vec<u64>>` | 做市商首购订单列表 | 10个/做市商 |
| `TronTxUsed` | `Map<H256, BlockNumber>` | TRON哈希去重 | 防重放 |
| `TronTxQueue` | `Vec<(H256, BlockNumber)>` | TRON哈希清理队列 | 10000个 |

### 3. 关键函数实现

#### do_create_order - 创建订单

```rust
pub fn do_create_order(
    buyer: &T::AccountId,
    maker_id: u64,
    dust_amount: BalanceOf<T>,
    payment_commit: H256,
    contact_commit: H256,
) -> Result<u64, DispatchError>
```

**执行步骤：**
1. ✅ 验证做市商存在且激活
2. ✅ 从定价服务获取DUST/USD汇率
3. ✅ 计算订单总金额 = dust_amount × price
4. ✅ **锁定做市商DUST到托管** (使用order_id作为托管ID)
5. ✅ 计算超时时间 = now + OrderTimeout (1小时)
6. ✅ 计算证据窗口 = now + EvidenceWindow (24小时)
7. ✅ 创建订单记录，初始状态 = Created
8. ✅ 保存到Orders存储
9. ✅ 更新BuyerOrders
10. ✅ 更新MakerOrders
11. ✅ **发出OrderCreated事件**

**权限：** 买家 (签名账户)

**限制：** 
- 做市商必须激活
- DUST数量必须与做市商余额相符
- 定价必须可用

---

#### do_release_dust - 做市商释放DUST

```rust
pub fn do_release_dust(
    maker: &T::AccountId,
    order_id: u64,
) -> DispatchResult
```

**执行步骤：**
1. ✅ 获取订单，验证状态 = PaidOrCommitted
2. ✅ 验证调用者是订单做市商
3. ✅ **从托管释放DUST到买家** (T::Escrow::release_all)
4. ✅ 更新订单状态 = Released
5. ✅ 记录完成时间
6. ✅ **调用信用系统：record_maker_order_completed()**
   - 传入做市商ID、订单ID、响应时间(秒)
   - 信用系统+2分
7. ✅ 如是首购订单：
   - HasFirstPurchased[buyer] = true (永久标记)
   - MakerFirstPurchaseCount[maker_id] -= 1
8. ✅ 发出OrderStateChanged事件

**权限：** 做市商

**关键：** 此函数是订单成功的主要路径

---

#### do_dispute_order - 发起订单争议

```rust
pub fn do_dispute_order(
    who: &T::AccountId,
    order_id: u64,
) -> DispatchResult
```

**执行步骤：**
1. ✅ 获取订单
2. ✅ 验证调用者是买家或做市商
3. ✅ 验证订单状态 = PaidOrCommitted (只有此状态可争议)
4. ✅ 更新订单状态 = Disputed
5. ✅ **将控制权转移到pallet-arbitration**
6. ✅ 发出OrderStateChanged事件

**权限：** 买家或做市商

**下一步：** 需调用pallet-arbitration::dispute_with_evidence_id()

---

#### do_cancel_order - 取消订单

```rust
pub fn do_cancel_order(
    who: &T::AccountId,
    order_id: u64,
) -> DispatchResult
```

**执行步骤：**
1. ✅ 获取订单
2. ✅ 验证调用者是买家或做市商
3. ✅ 验证订单状态 ∈ {Created, Expired}
4. ✅ **从托管退款到做市商** (T::Escrow::refund_all)
5. ✅ 更新订单状态 = Canceled
6. ✅ 如是首购订单：
   - MakerFirstPurchaseCount[maker_id] -= 1
7. ✅ 发出OrderStateChanged事件

**权限：** 买家或做市商

---

#### apply_arbitration_decision - 应用仲裁裁决

```rust
pub fn apply_arbitration_decision(
    order_id: u64,
    decision: pallet_arbitration::pallet::Decision,
) -> DispatchResult
```

**执行步骤：**

**Decision::Release (做市商胜诉)**
```
1. 从托管释放DUST给做市商
2. 订单状态 → Released
3. 信用系统：record_maker_dispute_result(maker_id, true)
   - 做市商胜诉，信用不变或+1
```

**Decision::Refund (做市商败诉)**
```
1. 从托管退款给买家
2. 订单状态 → Refunded
3. 信用系统：record_maker_dispute_result(maker_id, false)
   - 做市商败诉，信用-20分
```

**Decision::Partial(bps) (部分胜诉)**
```
1. TODO: 暂未实现，当前视为Refund处理
2. 未来应支持按比例分账
```

**权限：** 仅由pallet-arbitration通过Router调用

---

### 4. 首购订单特殊逻辑

#### do_create_first_purchase

```rust
pub fn do_create_first_purchase(
    buyer: &T::AccountId,
    maker_id: u64,
    payment_commit: H256,
    contact_commit: H256,
) -> Result<u64, DispatchError>
```

**特殊逻辑：**

1. **固定USD价值**
   - FirstPurchaseUsdValue = 10 USD (10_000_000 单位，精度10^6)
   
2. **动态DUST计算**
   ```
   dust_amount = usd_value × 10^12 / price
   ```
   - 根据实时汇率自动调整DUST数量
   
3. **数量范围保护**
   ```
   MinFirstPurchaseDustAmount ≤ dust_amount ≤ MaxFirstPurchaseDustAmount
   1 DUST ≤ dust_amount ≤ 1000 DUST
   ```
   - 防止异常汇率导致的滑点
   
4. **做市商配额**
   ```
   MakerFirstPurchaseCount[maker_id] < MaxFirstPurchaseOrdersPerMaker
   (5个并发上限)
   ```
   
5. **账户级一次性**
   ```
   HasFirstPurchased[buyer] == false
   ```
   - 永久记录，不可重复

**验证流程：**
1. ✅ 检查买家是否已首购
2. ✅ 验证做市商存在且激活
3. ✅ 检查做市商首购配额
4. ✅ 获取实时价格
5. ✅ 计算DUST数量，检查范围
6. ✅ 验证做市商余额充足
7. ✅ 锁定DUST到托管
8. ✅ 创建订单，标记is_first_purchase=true
9. ✅ 更新做市商首购计数和列表

---

### 5. 接口与权限

#### MakerInterface - Maker Pallet接口

```rust
pub trait MakerInterface<AccountId, Balance> {
    fn get_maker_application(maker_id: u64) -> Option<MakerApplicationInfo<AccountId, Balance>>;
    fn is_maker_active(maker_id: u64) -> bool;
}

pub struct MakerApplicationInfo<AccountId, Balance> {
    pub account: AccountId,
    pub tron_address: BoundedVec<u8, ConstU32<34>>,
    pub is_active: bool,
}
```

#### PricingProvider - 定价服务接口

```rust
pub trait PricingProvider<Balance> {
    fn get_dust_to_usd_rate() -> Option<Balance>;
}
```

#### MakerCreditInterface - 做市商信用接口

```rust
pub trait MakerCreditInterface {
    fn record_maker_order_completed(
        maker_id: u64,
        order_id: u64,
        response_time_seconds: u32,
    ) -> DispatchResult;
    
    fn record_maker_order_timeout(
        maker_id: u64,
        order_id: u64,
    ) -> DispatchResult;
    
    fn record_maker_dispute_result(
        maker_id: u64,
        order_id: u64,
        maker_win: bool,
    ) -> DispatchResult;
}
```

---

## 仲裁系统

### 1. 核心概念

#### Decision - 裁决类型

```rust
pub enum Decision {
    Release,       // 全额释放给做市商（买家败诉）
    Refund,        // 全额退款给买家（做市商败诉）
    Partial(u16),  // 按比例分账（双方都有责任）→ bps值
}
```

### 2. 核心存储

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `Disputed` | `DoubleMap<[u8;8], u64, ()>` | 争议登记索引 |
| `EvidenceIds` | `DoubleMap<[u8;8], u64, Vec<u64>>` | 每个案件的证据ID列表 |
| `TwoWayDeposits` | `DoubleMap<[u8;8], u64, TwoWayDepositRecord>` | 双向押金记录 |

#### TwoWayDepositRecord - 双向押金记录

```rust
pub struct TwoWayDepositRecord<AccountId, Balance, BlockNumber> {
    pub initiator: AccountId,                  // 发起方账户
    pub initiator_deposit: Balance,            // 发起方押金（订单金额×15%）
    pub respondent: AccountId,                 // 应诉方账户
    pub respondent_deposit: Option<Balance>,   // 应诉方押金（可选）
    pub response_deadline: BlockNumber,        // 应诉截止区块
    pub has_responded: bool,                   // 是否已应诉
}
```

### 3. ArbitrationRouter - 域路由接口

```rust
pub trait ArbitrationRouter<AccountId, Balance> {
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool;
    fn apply_decision(domain: [u8; 8], id: u64, decision: Decision) -> DispatchResult;
    fn get_counterparty(domain: [u8; 8], initiator: &AccountId, id: u64) 
        -> Result<AccountId, DispatchError>;
    fn get_order_amount(domain: [u8; 8], id: u64) -> Result<Balance, DispatchError>;
}
```

### 4. 关键函数

#### dispute - 发起争议

```rust
#[pallet::call_index(0)]
pub fn dispute(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence: Vec<BoundedVec<u8, T::MaxCidLen>>,
) -> DispatchResult
```

**执行步骤：**
1. ✅ 获取签名账户
2. ✅ **权限校验：Router.can_dispute()**
3. ✅ **防重：确保未被登记过**
4. ✅ 登记争议到Disputed
5. ✅ 发出Disputed事件

**域标识例子：**
- OTC订单: `b"otc_ordr"`
- SimpleBridge: `b"bridg_sw"`

---

#### dispute_with_evidence_id - 引用Evidence ID发起争议

```rust
#[pallet::call_index(2)]
pub fn dispute_with_evidence_id(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> DispatchResult
```

**执行步骤：**
1. ✅ 获取签名账户
2. ✅ **权限校验：Router.can_dispute()**
3. ✅ **防重：确保未被登记过**
4. ✅ 登记争议到Disputed
5. ✅ 将evidence_id追加到EvidenceIds列表
6. ✅ 发出Disputed事件

**优势：** 证据统一存储在pallet-evidence，支持复用

---

#### dispute_with_two_way_deposit - 双向押金发起争议

```rust
#[pallet::call_index(4)]
pub fn dispute_with_two_way_deposit(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    evidence_id: u64,
) -> DispatchResult
```

**执行步骤：**

1. **权限验证**
   - Router.can_dispute()检查

2. **获取订单金额**
   ```
   order_amount = Router.get_order_amount(domain, id)
   ```

3. **计算押金**
   ```
   deposit_amount = order_amount × DepositRatioBps / 10000
   (通常 15% = 1500 bps)
   ```

4. **从托管账户锁定押金**
   ```
   Fungible::hold(
       &HoldReason::DisputeInitiator,
       &escrow_account,
       deposit_amount
   )
   ```

5. **获取对方账户**
   ```
   respondent = Router.get_counterparty(domain, &initiator, id)
   ```

6. **计算应诉截止**
   ```
   deadline = current_block + ResponseDeadline (7天)
   ```

7. **创建TwoWayDepositRecord**
   ```
   TwoWayDeposits[(domain, id)] = {
       initiator,
       initiator_deposit,
       respondent,
       None,           // 应诉方还未应诉
       deadline,
       false
   }
   ```

8. **发出DisputeWithDepositInitiated事件**

---

#### respond_to_dispute - 应诉方应诉

```rust
#[pallet::call_index(5)]
pub fn respond_to_dispute(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    counter_evidence_id: u64,
) -> DispatchResult
```

**执行步骤：**

1. **获取押金记录**
   ```
   deposit_record = TwoWayDeposits[(domain, id)]
   ```

2. **验证应诉方身份**
   ```
   deposit_record.respondent == respondent
   ```

3. **检查是否已应诉**
   ```
   !deposit_record.has_responded
   ```

4. **检查应诉期限**
   ```
   current_block <= deposit_record.response_deadline
   ```

5. **从托管锁定应诉方押金**
   ```
   Fungible::hold(
       &HoldReason::DisputeRespondent,
       &escrow_account,
       deposit_amount
   )
   ```

6. **更新押金记录**
   ```
   deposit_record.respondent_deposit = Some(deposit_amount)
   deposit_record.has_responded = true
   ```

7. **追加反驳证据**
   ```
   EvidenceIds[(domain, id)].push(counter_evidence_id)
   ```

8. **发出RespondentDepositLocked事件**

---

#### arbitrate - 执行仲裁裁决

```rust
#[pallet::call_index(1)]
pub fn arbitrate(
    origin: OriginFor<T>,
    domain: [u8; 8],
    id: u64,
    decision_code: u8,
    bps: Option<u16>,
) -> DispatchResult
```

**执行步骤：**

1. **权限校验**
   ```
   T::DecisionOrigin::ensure_origin(origin)?
   (仅治理权限：Root或委员会≥2/3)
   ```

2. **确保争议已登记**
   ```
   Disputed[(domain, id)].is_some()
   ```

3. **转换裁决代码为Decision**
   ```
   decision_code = 0 → Decision::Release
   decision_code = 1 → Decision::Refund
   decision_code = 2 → Decision::Partial(bps)
   ```

4. **通过Router路由到业务pallet**
   ```
   Router.apply_decision(domain, id, decision)
   ```

5. **处理双向押金**
   ```
   handle_deposits_on_arbitration(domain, id, &decision)
   ```

6. **发出Arbitrated事件**

---

### 5. 押金处理逻辑

#### handle_deposits_on_arbitration

**Decision::Release (做市商胜诉)**
```
发起方（买家）押金：
  - 罚没30% (RejectedSlashBps = 3000)
  - 返还70%到托管账户

应诉方（做市商）押金：
  - 全额返还到托管账户（未罚没）
```

**Decision::Refund (做市商败诉)**
```
发起方（买家）押金：
  - 全额返还到托管账户（未罚没）

应诉方（做市商）押金：
  - 罚没30% (RejectedSlashBps = 3000)
  - 返还70%到托管账户
```

**Decision::Partial (双方都有责任)**
```
发起方押金：
  - 罚没50% (PartialSlashBps = 5000)
  - 返还50%到托管账户

应诉方押金：
  - 罚没50% (PartialSlashBps = 5000)
  - 返还50%到托管账户
```

**罚没资金流向：** 国库账户 (TreasuryAccount)

---

## 证据系统

### 1. 核心数据结构

#### Evidence - 证据记录

```rust
pub struct Evidence<AccountId, BlockNumber, MaxContentCidLen, MaxSchemeLen> {
    pub id: u64,                                         // 证据ID
    pub domain: u8,                                      // 域代码
    pub target_id: u64,                                  // 目标ID
    pub owner: AccountId,                                // 证据所有者
    pub content_cid: BoundedVec<u8, MaxContentCidLen>,  // IPFS内容CID
    pub content_type: ContentType,                       // 内容类型
    pub created_at: BlockNumber,                         // 创建时间
    pub is_encrypted: bool,                              // 是否加密
    pub encryption_scheme: Option<BoundedVec<u8, MaxSchemeLen>>, // 加密方案
    pub commit: Option<H256>,                            // 承诺哈希
    pub ns: Option<[u8; 8]>,                            // 命名空间
}
```

#### ContentType - 内容类型

```rust
pub enum ContentType {
    Image,      // 图片证据
    Video,      // 视频证据
    Document,   // 文档证据
    Mixed,      // 混合类型
    Text,       // 纯文本
}
```

### 2. 关键函数

#### commit - 提交公开证据

```rust
#[pallet::call_index(0)]
pub fn commit(
    origin: OriginFor<T>,
    domain: u8,
    target_id: u64,
    imgs: Vec<BoundedVec<u8, T::MaxCidLen>>,
    vids: Vec<BoundedVec<u8, T::MaxCidLen>>,
    docs: Vec<BoundedVec<u8, T::MaxCidLen>>,
    memo: Option<BoundedVec<u8, T::MaxMemoLen>>,
) -> DispatchResult
```

**流程：**
1. ✅ 权限校验（EvidenceAuthorizer）
2. ✅ 限频检查（账户级 + 目标级）
3. ✅ 配额检查（MaxPerSubjectTarget）
4. ✅ CID格式验证和去重
5. ✅ 生成EvidenceId
6. ✅ 打包到IPFS获取content_cid
7. ✅ 创建证据记录
8. ✅ **自动Pin到IPFS** (T::IpfsPinner::pin_cid_for_grave)
9. ✅ 发出EvidenceCommitted事件

**存储优化 (Phase 1.5)：**
- 旧版：链上存所有CID数组 → 840字节
- 新版：链上只存content_cid → 214字节
- **降低74.5%** ⭐

---

#### commit_hash - 提交承诺哈希

```rust
#[pallet::call_index(1)]
pub fn commit_hash(
    origin: OriginFor<T>,
    ns: [u8; 8],
    subject_id: u64,
    commit: H256,
    memo: Option<BoundedVec<u8, T::MaxMemoLen>>,
) -> DispatchResult
```

**特点：**
- 仅链上存承诺哈希，不存明文
- 用于隐私保护场景（KYC、OTC订单）
- 防重：commit必须唯一

**承诺计算示例：**
```
commit = blake2b256(ns || subject_id || cid_enc || salt || ver)
```

---

### 3. 私密内容管理

#### store_private_content - 存储私密内容

```rust
pub fn store_private_content(
    origin: OriginFor<T>,
    ns: [u8; 8],
    subject_id: u64,
    cid: BoundedVec<u8, T::MaxCidLen>,
    content_hash: H256,
    encryption_method: u8,
    access_policy: AccessPolicy<T>,
    encrypted_keys: EncryptedKeyBundles<T>,
) -> DispatchResult
```

**支持的加密方法：**
1. AES256-GCM
2. XChaCha20-Poly1305

**访问策略：**
```rust
pub enum AccessPolicy<T> {
    OwnerOnly,                              // 仅创建者
    SharedWith(Vec<T::AccountId>),          // 指定用户列表
    FamilyMembers(u64),                     // 家庭成员（deceased_id）
    TimeboxedAccess {                       // 限时访问
        users: Vec<T::AccountId>,
        expires_at: BlockNumber,
    },
    GovernanceControlled,                   // 治理控制
    RoleBased(u8),                          // 基于角色
}
```

---

## 信用与惩罚机制

### 1. 做市商信用等级

#### CreditLevel - 信用等级

```rust
pub enum CreditLevel {
    Diamond,    // 950-1000分 → 保证金折扣50%
    Platinum,   // 900-949分  → 保证金折扣30%
    Gold,       // 850-899分  → 保证金折扣20%
    Silver,     // 820-849分  → 保证金折扣10%
    Bronze,     // 800-819分  → 保证金无折扣
}
```

#### ServiceStatus - 服务状态

```rust
pub enum ServiceStatus {
    Active,     // 正常服务 (≥800分)
    Warning,    // 警告状态 (750-799分)
    Suspended,  // 暂停服务 (<750分)
}
```

### 2. CreditRecord - 信用记录

```rust
pub struct CreditRecord<BlockNumber> {
    pub credit_score: u16,              // 当前分数 (800-1000)
    pub level: CreditLevel,             // 等级
    pub status: ServiceStatus,          // 服务状态
    
    // === 履约数据 ===
    pub total_orders: u32,              // 总订单数
    pub completed_orders: u32,          // 完成订单数
    pub timeout_orders: u32,            // 超时订单数
    pub cancelled_orders: u32,          // 取消订单数
    pub timely_release_orders: u32,    // 及时释放(<24h)订单数
    
    // === 服务质量 ===
    pub rating_sum: u32,                // 买家评分总和
    pub rating_count: u32,              // 评分次数
    pub avg_response_time: u32,         // 平均响应时间(秒)
    
    // === 违约记录 ===
    pub default_count: u16,             // 违约次数
    pub dispute_loss_count: u16,        // 争议失败次数
    pub last_default_block: Option<BlockNumber>, // 最后违约区块
    
    // === 活跃度 ===
    pub last_order_block: BlockNumber,  // 最后订单区块
    pub consecutive_days: u16,          // 连续服务天数
}
```

### 3. 惩罚规则

#### 订单完成 (record_maker_order_completed)
```
信用分变化: +2分
条件: do_release_dust()成功完成
记录项: 
  - completed_orders += 1
  - 如果响应时间 < 24小时: timely_release_orders += 1
  - avg_response_time更新
```

#### 订单超时 (record_maker_order_timeout)
```
信用分变化: -10分
条件: 订单1小时内未支付
记录项:
  - timeout_orders += 1
  - default_count += 1
  - last_default_block = 当前区块
  - 若default_count >= 3: status → Suspended
```

#### 争议败诉 (record_maker_dispute_result)
```
做市商胜诉 (maker_win = true):
  - 信用分: +1分（或无变化）
  - 不记录违约

做市商败诉 (maker_win = false):
  - 信用分: -20分
  - dispute_loss_count += 1
  - default_count += 1
  - last_default_block = 当前区块
  - 若信用分<750: status → Suspended
```

#### 自动降级/禁用
```
750-799分: Warning状态
  - 仍可接收订单
  - 保证金折扣降低

<750分: Suspended状态
  - 禁止接收新订单
  - 需申请恢复
  - 保证金恢复100% (无折扣)
```

### 4. 配置参数

在Runtime中配置：
```rust
impl pallet_credit::Config for Runtime {
    type InitialMakerCreditScore = ConstU16<820>;      // 初始820分
    type MakerOrderCompletedBonus = ConstU16<2>;       // 完成+2分
    type MakerOrderTimeoutPenalty = ConstU16<10>;      // 超时-10分
    type MakerDisputeLossPenalty = ConstU16<20>;       // 败诉-20分
    type MakerSuspensionThreshold = ConstU16<750>;     // 暂停阈值
    type MakerWarningThreshold = ConstU16<800>;        // 警告阈值
}
```

---

## 跨Pallet交互

### 1. ArbitrationRouter实现 (Runtime)

```rust
pub struct ArbitrationRouter;

impl pallet_arbitration::pallet::ArbitrationRouter<AccountId, Balance> 
    for ArbitrationRouter {
    
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool {
        if domain == OtcOrderNsBytes::get() {
            // OTC订单：买家或卖家可发起
            pallet_otc_order::Pallet::<Runtime>::can_dispute_order(who, id)
        } else if domain == SimpleBridgeNsBytes::get() {
            // SimpleBridge：用户或做市商可发起
            pallet_bridge::Pallet::<Runtime>::can_dispute_swap(who, id)
        } else {
            false
        }
    }
    
    fn apply_decision(
        domain: [u8; 8],
        id: u64,
        decision: pallet_arbitration::pallet::Decision,
    ) -> DispatchResult {
        if domain == OtcOrderNsBytes::get() {
            pallet_otc_order::Pallet::<Runtime>::apply_arbitration_decision(id, decision)
        } else if domain == SimpleBridgeNsBytes::get() {
            pallet_bridge::Pallet::<Runtime>::apply_arbitration_decision(id, decision)
        } else {
            Err(DispatchError::Other("UnsupportedDomain"))
        }
    }
    
    fn get_counterparty(
        domain: [u8; 8],
        initiator: &AccountId,
        id: u64,
    ) -> Result<AccountId, DispatchError> {
        if domain == OtcOrderNsBytes::get() {
            let order = pallet_otc_order::Orders::<Runtime>::get(id)
                .ok_or(DispatchError::Other("OrderNotFound"))?;
            if initiator == &order.taker {
                Ok(order.maker)  // 对方是做市商
            } else if initiator == &order.maker {
                Ok(order.taker)  // 对方是买家
            } else {
                Err(DispatchError::Other("NotParticipant"))
            }
        } else {
            Err(DispatchError::Other("UnsupportedDomain"))
        }
    }
    
    fn get_order_amount(domain: [u8; 8], id: u64) -> Result<Balance, DispatchError> {
        if domain == OtcOrderNsBytes::get() {
            let order = pallet_otc_order::Orders::<Runtime>::get(id)
                .ok_or(DispatchError::Other("OrderNotFound"))?;
            Ok(order.qty)  // 返回DUST数量
        } else {
            Err(DispatchError::Other("UnsupportedDomain"))
        }
    }
}
```

### 2. 托管系统集成 (pallet-escrow)

**Pallet接口：**
```rust
pub trait Escrow<AccountId, Balance> {
    fn lock_from(from: &AccountId, id: u64, amount: Balance) -> DispatchResult;
    fn release_all(id: u64, to: &AccountId) -> DispatchResult;
    fn refund_all(id: u64, to: &AccountId) -> DispatchResult;
}
```

**使用场景：**

1. **订单创建时锁定**
   ```rust
   T::Escrow::lock_from(&maker, order_id, dust_amount)?;
   ```

2. **订单完成时释放**
   ```rust
   T::Escrow::release_all(order_id, &buyer)?;
   ```

3. **订单取消时退款**
   ```rust
   T::Escrow::refund_all(order_id, &maker)?;
   ```

4. **仲裁裁决时**
   ```rust
   // Release决议
   T::Escrow::release_all(order_id, &maker)?;
   // Refund决议
   T::Escrow::refund_all(order_id, &buyer)?;
   ```

### 3. 信用系统集成

**OTC Order → Credit**
```rust
// 订单完成时
T::MakerCredit::record_maker_order_completed(
    order.maker_id,
    order_id,
    response_time_seconds
)?;

// 仲裁结束时
T::MakerCredit::record_maker_dispute_result(
    order.maker_id,
    order_id,
    maker_win
)?;
```

### 4. 证据系统集成

**OTC Order ← Evidence**
```rust
// 发起争议时需要先提交证据
let evidence_id = api.tx.evidence.commit(...);

// 然后使用evidence_id发起仲裁
api.tx.arbitration.disputeWithEvidenceId(
    domain,
    order_id,
    evidence_id
);
```

### 5. 定价系统集成

**OTC Order → Pricing**
```rust
// 订单创建时获取价格
let price = T::Pricing::get_dust_to_usd_rate()?;

// 首购订单计算
let dust_amount = usd_value * 10^12 / price;
```

---

## 完整的流程示例

### 场景：买家购买DUST，后因支付纠纷发起仲裁

```
时间线                  买家                  做市商              系统
─────────────────────────────────────────────────────────────────────

T0: 订单创建
  └─ create_order()      
     ├─ 验证做市商激活 ✓
     ├─ 获取价格: 0.1 USD/DUST
     ├─ 计算: 100 DUST × 0.1 = 10 USD
     ├─ 锁定100 DUST到托管
     └─ 订单状态: Created
       订单ID: #123

T1: 买家支付
  └─ mark_paid()
     ├─ 记录TRON交易哈希 (可选)
     ├─ 防重放检查 ✓
     └─ 订单状态: PaidOrCommitted

T2: 做市商收到支付确认
  └─ release_dust()
     ├─ 验证订单状态 = PaidOrCommitted ✓
     ├─ 从托管释放100 DUST到买家
     ├─ 记录订单完成
     │  ├─ record_maker_order_completed(maker_id=1, order_id=123)
     │  ├─ 做市商信用: 820 + 2 = 822
     │  └─ 标记订单为已完成
     └─ 订单状态: Released

T3: 买家发起争议（例如收到假DUST）
  └─ 先提交证据
     ├─ commit(domain=1, target_id=123, imgs=[...])
     ├─ 验证权限✓
     ├─ 自动Pin到IPFS
     ├─ 生成Evidence ID: #456
     └─ 事件: EvidenceCommitted

  └─ 发起仲裁
     ├─ dispute_with_evidence_id(
     │    domain="otc_ordr",
     │    id=123,
     │    evidence_id=456
     │  )
     ├─ Router.can_dispute(): ✓ (买家可发起)
     ├─ 登记争议
     └─ 订单状态: Disputed
       事件: Disputed

T4: 做市商提交反驳证据
  └─ append_evidence_id(
       domain="otc_ordr",
       id=123,
       evidence_id=789
     )
     └─ 证据列表: [#456, #789]

T5: 委员会审议并裁决
  └─ arbitrate(
       domain="otc_ordr",
       id=123,
       decision_code=0,  // Release
       bps=None
     )
     ├─ 权限校验: Root/委员会 ✓
     ├─ 调用Router.apply_decision()
     └─ 执行 Decision::Release
        ├─ DUST已释放给买家（T2时刻）
        ├─ 订单状态维持: Released
        ├─ 信用更新:
        │  ├─ record_maker_dispute_result(maker_id=1, true)
        │  └─ 做市商信用: 822 + 1 = 823 (胜诉)
        └─ 事件: Arbitrated

【另一场景：做市商败诉】

T5': 委员会仲裁为Refund
  └─ arbitrate(
       domain="otc_ordr",
       id=123,
       decision_code=1,  // Refund
       bps=None
     )
     ├─ 执行 Decision::Refund
     ├─ 信用更新:
     │  ├─ record_maker_dispute_result(maker_id=1, false)
     │  └─ 做市商信用: 822 - 20 = 802 (败诉)
     └─ 订单标记为已关闭

【首购订单特例】

T*: 买家首次购买时
  └─ create_first_purchase()
     ├─ 检查: HasFirstPurchased[buyer] == false ✓
     ├─ 固定USD价值: 10 USD
     ├─ 计算DUST: 10 × 10^12 / 0.1 = 100 × 10^12 DUST
     ├─ 范围检查: ✓
     ├─ 做市商配额检查: MakerFirstPurchaseCount[1] < 5 ✓
     ├─ 锁定DUST
     └─ 订单ID: #124, is_first_purchase=true

T*+5分钟: 首购订单完成后
  └─ release_dust()完成
     ├─ HasFirstPurchased[buyer] = true (永久标记)
     ├─ MakerFirstPurchaseCount[1] -= 1
     └─ 买家永久失去首购资格
```

---

## 关键安全考虑

### 1. 资金安全

- ✅ **托管机制**：订单创建时立即锁定，原子性操作
- ✅ **状态验证**：每个操作严格验证状态机
- ✅ **重重检查**：多层权限和参数验证

### 2. 防重放

- ✅ **TRON哈希去重**：防止重复使用TRON交易
- ✅ **承诺哈希唯一**：Evidence commit去重

### 3. 争议防滥用

- ✅ **权限校验**：只有当事人可发起
- ✅ **状态限制**：PaidOrCommitted状态才可争议
- ✅ **证据窗口**：24小时内必须提交证据

### 4. 信用惩罚

- ✅ **自动降级**：<750分自动Suspended
- ✅ **永久首购**：防止重复利用首购优惠
- ✅ **违约记录**：完整可追溯

---

## Runtime配置示例

```rust
impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Timestamp = Timestamp;
    type Escrow = Escrow;
    type Credit = Credit;
    type MakerCredit = Credit;
    type Pricing = Pricing;
    type MakerPallet = Maker;
    
    type OrderTimeout = ConstU64<3_600_000>;              // 1小时
    type EvidenceWindow = ConstU64<86_400_000>;           // 24小时
    type FirstPurchaseUsdValue = ConstU128<10_000_000>;   // 10 USD
    type MinFirstPurchaseDustAmount = ConstU128<1_000_000_000_000>;      // 1 DUST
    type MaxFirstPurchaseDustAmount = ConstU128<1_000_000_000_000_000>;  // 1000 DUST
    type MaxFirstPurchaseOrdersPerMaker = ConstU32<5>;
    type WeightInfo = ();
}

impl pallet_arbitration::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxEvidence = ConstU32<20>;
    type MaxCidLen = ConstU32<64>;
    type Escrow = Escrow;
    type WeightInfo = ();
    type Router = ArbitrationRouter;
    type DecisionOrigin = EitherOfDiverse<
        EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, ContentCommittee, 2, 3>
    >;
    
    type Fungible = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;
    type DepositRatioBps = ConstU16<1500>;                // 15%
    type ResponseDeadline = ConstU32<{ 7 * DAYS }>;       // 7天
    type RejectedSlashBps = ConstU16<3000>;               // 30%
    type PartialSlashBps = ConstU16<5000>;                // 50%
    type TreasuryAccount = TreasuryAccount;
}

impl pallet_evidence::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxContentCidLen = ConstU32<64>;
    type MaxSchemeLen = ConstU32<32>;
    // ... 其他配置
    type IpfsPinner = StardustIpfs;
    type FamilyVerifier = Deceased;
}

impl pallet_credit::Config for Runtime {
    type InitialMakerCreditScore = ConstU16<820>;
    type MakerOrderCompletedBonus = ConstU16<2>;
    type MakerOrderTimeoutPenalty = ConstU16<10>;
    type MakerDisputeLossPenalty = ConstU16<20>;
    type MakerSuspensionThreshold = ConstU16<750>;
    type MakerWarningThreshold = ConstU16<800>;
    type CreditWeightInfo = ();
}
```

---

## 总结

### 核心流程
1. **订单创建** → **支付确认** → **DUST释放** → **订单完成**
2. 若有异议 → **提交证据** → **发起仲裁** → **治理裁决** → **资金分配**

### 关键特性
- ✅ 完整的订单生命周期管理
- ✅ 安全的托管机制
- ✅ 灵活的仲裁系统 (域路由)
- ✅ 详细的信用评分体系
- ✅ 自动化的惩罚机制
- ✅ 统一的证据存储

### 安全保障
- ✅ 多层权限控制
- ✅ 防重放机制
- ✅ 双向押金制度
- ✅ 自动降级/禁用
- ✅ 完全可追溯的审计日志

