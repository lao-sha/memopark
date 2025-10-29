# Pallet OTC Order - OTC订单管理系统

## 📋 模块概述

`pallet-otc-order` 是Memopark生态的**核心OTC交易模块**，提供MEMO↔USDT场外交易的完整流程管理。集成做市商管理、买家信用、托管服务、仲裁系统和联盟计酬，实现安全高效的P2P加密货币交易。

### 设计理念

- **去中心化托管**：MEMO锁定在链上托管账户
- **信用保护**：买家/做市商双向信用评估
- **灵活定价**：基于pallet-pricing的市场价格+做市商溢价
- **争议保护**：集成仲裁系统处理纠纷
- **自动归档**：150天后自动清理终态订单

## 🏗️ 架构设计

```text
┌──────────────────────────────────────┐
│     买家下单（create_order）          │
│  - 选择做市商                         │
│  - MEMO锁定到托管                     │
│  - 计算价格（市场价+溢价）            │
└──────────────┬───────────────────────┘
               ↓ 订单创建成功
┌──────────────────────────────────────┐
│     买家付款（mark_order_paid）       │
│  - 提交TRON交易hash                   │
│  - 提交联系方式承诺                   │
│  - 5分钟内可撤回                      │
└──────────────┬───────────────────────┘
               ↓ 做市商验证
┌──────────────────────────────────────┐
│     做市商释放（release_order）       │
│  - 验证收款                           │
│  - 多路分账                           │
│    ├─ 买家: 88%（实际MEMO）           │
│    ├─ 联盟计酬: 10%                   │
│    └─ 平台: 2%                        │
└──────────────┬───────────────────────┘
               ↓ 订单完成
┌──────────────────────────────────────┐
│     更新信用记录                      │
│  - 买家信用+1                        │
│  - 做市商信用+1                      │
│  - 买家评分                          │
└──────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 订单创建

#### create_order - 创建订单
```rust
pub fn create_order(
    origin: OriginFor<T>,
    maker_id: u64,
    qty: BalanceOf<T>,
) -> DispatchResult
```

**参数说明**：
- `maker_id`: 做市商ID
- `qty`: MEMO数量

**工作流程**：
1. 检查买家信用限额（单笔/日限额）
2. 检查做市商服务状态（Active/Warning/Suspended）
3. 获取市场价格+做市商溢价
4. 计算USDT金额
5. MEMO锁定到托管账户
6. 创建订单记录
7. 更新日交易额度

**价格计算**：
```rust
// 1. 获取市场基准价
let base_price = T::PricingProvider::get_market_price();  // 例如0.01 USDT/MEMO

// 2. 应用做市商溢价
let maker_premium = maker.sell_premium_bps;  // 例如+200 bps (+2%)
let final_price = base_price * (10000 + maker_premium) / 10000;
// final_price = 0.01 × 1.02 = 0.0102 USDT/MEMO

// 3. 计算USDT金额
let usdt_amount = qty * final_price;  // 例如100 MEMO × 0.0102 = 1.02 USDT
```

### 2. 买家付款

#### mark_order_paid - 标记已付款
```rust
pub fn mark_order_paid(
    origin: OriginFor<T>,
    order_id: u64,
    tron_tx_hash: Vec<u8>,
    contact_commit: H256,
) -> DispatchResult
```

**参数说明**：
- `order_id`: 订单ID
- `tron_tx_hash`: TRON转账交易hash
- `contact_commit`: 联系方式承诺（H256哈希）

**功能**：
- 记录TRON交易hash（防重放）
- 记录联系方式承诺
- 状态变更：Created → PaidOrCommitted
- 设置超时时间（24小时）

**TRON交易hash验证**：
```rust
// 检查是否已被使用
ensure!(
    !TronTxHashUsed::<T>::contains_key(&tron_tx_hash),
    Error::<T>::TronTxHashAlreadyUsed
);

// 标记已使用
TronTxHashUsed::<T>::insert(&tron_tx_hash, block_number);
```

#### cancel_order_by_buyer - 买家撤回
```rust
pub fn cancel_order_by_buyer(
    origin: OriginFor<T>,
    order_id: u64,
) -> DispatchResult
```

**功能**：
- 仅在标记已付款后5分钟内可撤回
- 防止误操作
- 退还MEMO给买家

### 3. 做市商释放

#### release_order - 释放订单
```rust
pub fn release_order(
    origin: OriginFor<T>,
    order_id: u64,
) -> DispatchResult
```

**权限**：做市商

**功能**：
- 验证收款（链下确认）
- 多路分账
- 更新信用记录
- 触发联盟计酬

**多路分账**：
```rust
// 假设订单100 MEMO，价值1.02 USDT

// 1. 买家实际获得（88%）
buyer_amount = 100 × 88% = 88 MEMO

// 2. 联盟计酬（10%）
affiliate_amount = 100 × 10% = 10 MEMO
// 分配给15层推荐链

// 3. 平台费用（2%）
platform_amount = 100 × 2% = 2 MEMO
// 销毁/国库/存储
```

### 4. 超时与争议

#### handle_timeout - 处理超时
```rust
// OnInitialize自动触发
pub fn handle_timeout(order_id: u64) -> DispatchResult
```

**功能**：
- 24小时未释放自动超时
- 退款给买家
- 做市商信用-20分

#### dispute_order - 发起争议
```rust
pub fn dispute_order(
    origin: OriginFor<T>,
    order_id: u64,
    evidence_id: u64,
) -> DispatchResult
```

**功能**：
- 买家/做市商可发起争议
- 关联证据ID
- 转交仲裁系统
- 状态变更：PaidOrCommitted → Disputed

### 5. 首购功能

#### first_purchase - 首购MEMO
```rust
pub fn first_purchase(
    origin: OriginFor<T>,
    buyer: T::AccountId,
    tron_tx_hash: Vec<u8>,
    amount: BalanceOf<T>,
) -> DispatchResult
```

**权限**：FiatGatewayAccount（法币网关）

**功能**：
- 新用户首次购买MEMO
- 无需做市商
- 从法币网关托管账户转账
- 自动分配联盟计酬（如有推荐人）

**使用场景**：
```text
用户注册 → 法币网关支付 → 网关调用first_purchase → 用户获得MEMO
```

### 6. 订单归档

#### auto_cleanup_archived_orders - 自动清理
```rust
// OnInitialize自动触发
pub fn auto_cleanup_archived_orders() -> Weight
```

**功能**：
- 清理150天前的终态订单（Released/Refunded/Closed）
- 每块最多清理50个订单
- 释放存储空间

**终态条件**：
```rust
match order.state {
    OrderState::Released | 
    OrderState::Refunded | 
    OrderState::Closed => {
        let age_days = (current_time - order.created_at) / 86400;
        if age_days > ArchiveThresholdDays {
            // 清理订单
            Orders::<T>::remove(order_id);
        }
    },
    _ => {}  // 非终态订单保留
}
```

## 📦 存储结构

### 订单记录
```rust
pub type Orders<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // order_id
    Order<T::AccountId, BalanceOf<T>, MomentOf<T>>,
    OptionQuery,
>;
```

**Order结构**：
```rust
pub struct Order<AccountId, Balance, Moment> {
    pub maker_id: u64,                          // 做市商ID
    pub maker: AccountId,                       // 做市商账户
    pub taker: AccountId,                       // 买家账户
    pub price: Balance,                         // 单价（USDT）
    pub qty: Balance,                           // MEMO数量
    pub amount: Balance,                        // USDT总额
    pub created_at: Moment,                     // 创建时间
    pub expire_at: Moment,                      // 超时时间
    pub maker_tron_address: BoundedVec<u8, ConstU32<64>>,  // TRON地址
    pub payment_commit: H256,                   // TRON交易hash
    pub contact_commit: H256,                   // 联系方式承诺
    pub state: OrderState,                      // 订单状态
    pub epay_trade_no: Option<BoundedVec<u8, ConstU32<64>>>,  // EPAY交易号
}
```

**OrderState枚举**：
```rust
pub enum OrderState {
    Created,            // 已创建（待付款）
    PaidOrCommitted,    // 已付款（待释放）
    Released,           // 已释放（已完成）
    Refunded,           // 已退款
    Canceled,           // 已取消
    Disputed,           // 争议中
    Closed,             // 已关闭
}
```

### TRON交易hash记录
```rust
pub type TronTxHashUsed<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    Vec<u8>,            // tron_tx_hash
    BlockNumberFor<T>,  // 使用时的区块号
    OptionQuery,
>;
```

**用途**：防止重放攻击（同一交易hash不能多次使用）

### 限频控制
```rust
pub type OpenRate<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    (BlockNumberFor<T>, u32),  // (window_start, count)
    ValueQuery,
>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config + 
                  pallet_escrow::pallet::Config + 
                  pallet_timestamp::Config + 
                  pallet_pricing::Config + 
                  pallet_market_maker::Config + 
                  pallet_buyer_credit::Config {
    /// 货币接口
    type Currency: Currency<Self::AccountId>;

    /// 确认超时时间（区块数，默认24小时）
    type ConfirmTTL: Get<BlockNumberFor<Self>>;

    /// 托管接口
    type Escrow: EscrowTrait<Self::AccountId, BalanceOf<Self>>;

    /// 做市商信用接口
    type MakerCredit: MakerCreditInterface;

    /// 每块最多处理过期订单数
    type MaxExpiringPerBlock: Get<u32>;

    /// 下单限频窗口（区块数）
    type OpenWindow: Get<BlockNumberFor<Self>>;

    /// 窗口内最多下单次数
    type OpenMaxInWindow: Get<u32>;

    /// 买家撤回窗口（毫秒，默认5分钟）
    type CancelWindow: Get<MomentOf<Self>>;

    /// 法币网关服务账户
    type FiatGatewayAccount: Get<Self::AccountId>;

    /// 法币网关托管账户
    type FiatGatewayTreasuryAccount: Get<Self::AccountId>;

    /// 首购最低金额
    type MinFirstPurchaseAmount: Get<BalanceOf<Self>>;

    /// 首购最高金额
    type MaxFirstPurchaseAmount: Get<BalanceOf<Self>>;

    /// 会员信息提供者
    type MembershipProvider: MembershipProvider<Self::AccountId>;

    /// 推荐关系提供者
    type ReferralProvider: ReferralProvider<Self::AccountId>;

    /// 联盟计酬分配器
    type AffiliateDistributor: AffiliateDistributor<Self::AccountId, u128, BlockNumberFor<Self>>;

    /// 订单归档阈值（天数，默认150天）
    type ArchiveThresholdDays: Get<u32>;

    /// 每次自动清理的最大订单数（默认50）
    type MaxCleanupPerBlock: Get<u32>;

    /// TRON交易hash保留期（区块数，默认180天）
    type TronTxHashRetentionPeriod: Get<BlockNumberFor<Self>>;
}
```

## 📡 可调用接口

### 用户接口

#### 1. create_order - 创建订单
```rust
#[pallet::call_index(0)]
pub fn create_order(
    origin: OriginFor<T>,
    maker_id: u64,
    qty: BalanceOf<T>,
) -> DispatchResult
```

#### 2. mark_order_paid - 标记已付款
```rust
#[pallet::call_index(1)]
pub fn mark_order_paid(
    origin: OriginFor<T>,
    order_id: u64,
    tron_tx_hash: Vec<u8>,
    contact_commit: H256,
) -> DispatchResult
```

#### 3. cancel_order_by_buyer - 买家撤回
```rust
#[pallet::call_index(2)]
pub fn cancel_order_by_buyer(
    origin: OriginFor<T>,
    order_id: u64,
) -> DispatchResult
```

#### 4. dispute_order - 发起争议
```rust
#[pallet::call_index(3)]
pub fn dispute_order(
    origin: OriginFor<T>,
    order_id: u64,
    evidence_id: u64,
) -> DispatchResult
```

### 做市商接口

#### 5. release_order - 释放订单
```rust
#[pallet::call_index(4)]
pub fn release_order(
    origin: OriginFor<T>,
    order_id: u64,
) -> DispatchResult
```

### 法币网关接口

#### 6. first_purchase - 首购MEMO
```rust
#[pallet::call_index(5)]
pub fn first_purchase(
    origin: OriginFor<T>,
    buyer: T::AccountId,
    tron_tx_hash: Vec<u8>,
    amount: BalanceOf<T>,
) -> DispatchResult
```

## 🎉 事件

### OrderCreated - 订单创建事件
```rust
OrderCreated {
    order_id: u64,
    maker_id: u64,
    taker: T::AccountId,
    qty: BalanceOf<T>,
    amount: BalanceOf<T>,
}
```

### OrderPaid - 订单付款事件
```rust
OrderPaid {
    order_id: u64,
    taker: T::AccountId,
    tron_tx_hash: Vec<u8>,
}
```

### OrderReleased - 订单释放事件
```rust
OrderReleased {
    order_id: u64,
    maker: T::AccountId,
    taker: T::AccountId,
}
```

### OrderDisputed - 订单争议事件
```rust
OrderDisputed {
    order_id: u64,
    initiator: T::AccountId,
    evidence_id: u64,
}
```

### OrderArchived - 订单归档事件
```rust
OrderArchived {
    order_id: u64,
    archived_at: BlockNumberFor<T>,
}
```

## ❌ 错误处理

### MakerNotFound
- **说明**：做市商不存在
- **触发**：选择不存在的做市商

### MakerServiceSuspended
- **说明**：做市商服务已暂停
- **触发**：做市商信用分<750

### ExceedsCreditLimit
- **说明**：超过信用限额
- **触发**：超过买家单笔/日限额

### TronTxHashAlreadyUsed
- **说明**：TRON交易hash已使用
- **触发**：重复使用同一交易hash

### CancelWindowExpired
- **说明**：撤回窗口已过
- **触发**：标记已付款5分钟后尝试撤回

### RateLimited
- **说明**：限频限制
- **触发**：短时间内多次下单

## 🔌 使用示例

### 场景1：完整OTC交易流程

```rust
// 1. 买家查询做市商列表
let makers = get_active_makers();

// 2. 创建订单（100 MEMO）
let order_id = pallet_otc_order::Pallet::<T>::create_order(
    buyer_origin.clone(),
    maker_id,
    100_000_000_000_000u128,  // 100 MEMO
)?;

// 3. 链下：买家向做市商TRON地址转账USDT
let order = pallet_otc_order::Orders::<T>::get(order_id)?;
// 前端显示：请向 {order.maker_tron_address} 转账 {order.amount} USDT

// 4. 买家标记已付款
pallet_otc_order::Pallet::<T>::mark_order_paid(
    buyer_origin.clone(),
    order_id,
    tron_tx_hash,
    contact_commit,
)?;

// 5. 做市商验证收款（链下）
// 查询TRON链确认收款...

// 6. 做市商释放MEMO
pallet_otc_order::Pallet::<T>::release_order(
    maker_origin,
    order_id,
)?;

// 7. 系统自动多路分账
// - 买家获得88 MEMO
// - 联盟计酬10 MEMO
// - 平台费用2 MEMO

// 8. 更新信用记录（自动）
// - 买家信用+1
// - 做市商信用+1
```

### 场景2：买家撤回订单

```rust
// 买家误操作标记已付款
pallet_otc_order::Pallet::<T>::mark_order_paid(
    buyer_origin.clone(),
    order_id,
    wrong_tx_hash,
    contact_commit,
)?;

// 5分钟内可撤回
pallet_otc_order::Pallet::<T>::cancel_order_by_buyer(
    buyer_origin,
    order_id,
)?;

// MEMO退还给买家
// 订单状态：PaidOrCommitted → Canceled
```

### 场景3：争议处理

```rust
// 做市商24小时未释放，买家发起争议

// 1. 提交证据
let evidence_id = pallet_evidence::Pallet::<T>::commit(
    buyer_origin.clone(),
    *b"otc_order",
    order_id,
    vec![tron_tx_screenshot],  // 转账截图
    vec![],
    vec![],
    b"I already transferred but maker didn't release".to_vec(),
)?;

// 2. 发起争议
pallet_otc_order::Pallet::<T>::dispute_order(
    buyer_origin,
    order_id,
    evidence_id,
)?;

// 3. 转交仲裁系统
pallet_arbitration::Pallet::<T>::dispute_with_evidence_id(
    buyer_origin,
    *b"memopark/otc_order",
    order_id,
    evidence_id,
)?;

// 4. 委员会裁决...
```

## 🛡️ 安全机制

### 1. 信用保护

- 买家信用限额
- 做市商信用门槛
- 双向信用评估

### 2. 资金安全

- MEMO链上托管
- 多路分账原子性
- 超时自动退款

### 3. 防重放

- TRON交易hash去重
- 保留期180天
- 定期清理

### 4. 限频保护

- 下单限频
- 标记已付款限频
- 防止恶意刷单

### 5. 争议保护

- 证据链上化
- 仲裁系统介入
- 信用分惩罚

## 📝 最佳实践

### 1. 做市商选择

- 选择高信用分做市商（Gold+）
- 查看历史成交记录
- 注意溢价和限额

### 2. 付款操作

- 仔细核对TRON地址
- 确认金额准确
- 保存转账凭证

### 3. 争议处理

- 及时提交证据
- 保持沟通记录
- 配合仲裁调查

### 4. 监控指标

- 订单完成率
- 平均完成时间
- 争议率
- 归档订单数

## 🔗 相关模块

- **pallet-market-maker**: 做市商管理（获取做市商信息）
- **pallet-buyer-credit**: 买家信用（检查限额）
- **pallet-maker-credit**: 做市商信用（更新记录）
- **pallet-escrow**: 托管服务（锁定/释放MEMO）
- **pallet-arbitration**: 仲裁系统（处理争议）
- **pallet-pricing**: 价格管理（获取市场价格）
- **pallet-affiliate-config**: 联盟计酬（分配奖励）

## 📚 参考资源

- [OTC交易流程详解](../../docs/otc-trading-process.md)
- [多路分账机制](../../docs/multi-route-distribution.md)
- [订单归档策略](../../docs/order-archival-strategy.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Memopark 开发团队
