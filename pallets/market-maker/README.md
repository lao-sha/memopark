# Pallet Market Maker - 做市商管理系统

## 📋 模块概述

`pallet-market-maker` 是Stardust OTC/Bridge生态的**做市商资质管理模块**，提供做市商申请、审核、保证金管理、首购资金池和业务配置功能。通过严格的审核流程和动态保证金机制，确保做市商服务质量，保护用户资金安全。

### 设计理念

- **分阶段审核**：锁定押金→提交资料→治理审核→激活服务
- **灵活定价**：支持买入/卖出独立溢价（±5%）
- **数据保护**：脱敏展示（姓名/身份证/生日）
- **首购资金池**：做市商专属资金池，支持提取管理
- **统一TRON地址**：OTC收款+Bridge发款使用同一地址

## 🏗️ 架构设计

```text
┌──────────────────────────────────────┐
│    做市商申请（Phase 1）              │
│  1. lock_deposit() - 锁定押金        │
└──────────────┬───────────────────────┘
               ↓ 押金锁定成功
┌──────────────────────────────────────┐
│    提交资料（Phase 2）                │
│  2. submit_info() - 提交公开/私密资料 │
│     - 姓名、身份证、TRON地址          │
│     - 溢价、最小金额                  │
│     - 自动脱敏处理                    │
└──────────────┬───────────────────────┘
               ↓ 资料提交完成
┌──────────────────────────────────────┐
│    治理审核（Phase 3）                │
│  3a. approve() - 批准申请（退还押金） │
│  3b. reject() - 拒绝申请（罚没5%）    │
└──────────────┬───────────────────────┘
               ↓ 审核通过
┌──────────────────────────────────────┐
│    激活服务（Active）                 │
│  - 接受OTC/Bridge订单                │
│  - 初始化做市商信用（800分）          │
│  - 提供流动性服务                     │
└──────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 申请流程管理

#### ApplicationStatus枚举
```rust
pub enum ApplicationStatus {
    DepositLocked,      // 押金已锁定（待提交资料）
    PendingReview,      // 待审核
    Active,             // 已激活
    Rejected,           // 已拒绝
    Cancelled,          // 已取消
    Expired,            // 已过期
}
```

#### lock_deposit - 锁定押金
```rust
pub fn lock_deposit(
    origin: OriginFor<T>,
    deposit: BalanceOf<T>,
) -> DispatchResult
```

**功能**：
- 冻结指定金额的MEMO作为押金
- 创建申请记录（状态：DepositLocked）
- 设置提交资料截止时间（默认7天）

**验证规则**：
- ✅ 押金 ≥ MinDeposit（默认10,000 DUST）
- ✅ 用户未有未完成申请
- ✅ 余额充足

#### submit_info - 提交资料
```rust
pub fn submit_info(
    origin: OriginFor<T>,
    maker_id: u64,
    direction: Direction,
    tron_address: Vec<u8>,
    buy_premium_bps: i16,
    sell_premium_bps: i16,
    min_amount: BalanceOf<T>,
    full_name: Vec<u8>,
    id_card: Vec<u8>,
    birthday: Vec<u8>,
    public_cid: Vec<u8>,
    private_cid: Vec<u8>,
) -> DispatchResult
```

**功能**：
- 提交做市商详细信息
- 自动脱敏处理（姓名/身份证/生日）
- 状态变更：DepositLocked → PendingReview
- 设置审核截止时间（默认14天）

**Direction枚举**：
```rust
pub enum Direction {
    Buy = 0,         // 仅买入（Bridge）
    Sell = 1,        // 仅卖出（OTC）
    BuyAndSell = 2,  // 双向（OTC+Bridge）
}
```

**脱敏处理**：
```rust
// 姓名脱敏
masked_name = mask_name("张三") → "×三"
masked_name = mask_name("李四五") → "李×五"
masked_name = mask_name("王二麻子") → "王×子"

// 身份证脱敏
masked_id = mask_id_card("110101199001011234") → "1101**********1234"

// 生日脱敏
masked_birthday = mask_birthday("1990-01-01") → "1990-xx-xx"
```

### 2. 审核管理

#### approve - 批准申请
```rust
pub fn approve(
    origin: OriginFor<T>,
    maker_id: u64,
) -> DispatchResult
```

**权限**：GovernanceOrigin（Root或委员会）

**功能**：
- 全额退还押金
- 状态变更：PendingReview → Active
- 初始化做市商信用记录（800分）
- 触发Approved事件

#### reject - 拒绝申请
```rust
pub fn reject(
    origin: OriginFor<T>,
    maker_id: u64,
    reason_cid: Vec<u8>,
) -> DispatchResult
```

**权限**：GovernanceOrigin

**功能**：
- 罚没押金5%（默认）给委员会账户
- 退还95%给申请人
- 状态变更：PendingReview → Rejected
- 记录拒绝原因CID

### 3. 业务方向与定价

#### Direction - 业务方向
```rust
pub enum Direction {
    Buy,         // 仅买入（Bridge）- 做市商购买MEMO，支付USDT
    Sell,        // 仅卖出（OTC）- 做市商出售MEMO，收取USDT
    BuyAndSell,  // 双向（OTC + Bridge）
}
```

#### 溢价配置
```rust
pub struct Application<AccountId, Balance> {
    // Buy溢价（-500 ~ 500 bps = -5% ~ +5%）
    pub buy_premium_bps: i16,
    
    // Sell溢价（-500 ~ 500 bps = -5% ~ +5%）
    pub sell_premium_bps: i16,
}
```

**定价示例**：
```text
基准价：0.01 USDT/DUST

Buy方向（Bridge）：
- buy_premium_bps = -200 (-2%)
- 买价 = 0.01 × (1 - 0.02) = 0.0098 USDT/DUST
- 用户100 DUST → 0.98 USDT

Sell方向（OTC）：
- sell_premium_bps = +200 (+2%)
- 卖价 = 0.01 × (1 + 0.02) = 0.0102 USDT/DUST
- 用户100 USDT → 98.04 DUST
```

### 4. 统一TRON地址

```rust
pub struct Application<AccountId, Balance> {
    // 统一TRON地址（OTC收款 + Bridge发款）
    pub tron_address: BoundedVec<u8, ConstU32<64>>,
}
```

**用途**：
- **OTC订单**：买家向此地址转账USDT购买MEMO
- **Bridge订单**：做市商从此地址向用户转账USDT

**格式**：
- 34字符，'T'开头的Base58编码地址
- 示例：`TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS`

**优势**：
- 简化管理（一个地址即可）
- 降低错误（不会弄混收款/发款地址）
- 方便审计（统一地址追溯）

### 5. 首购资金池管理

#### 资金池账户派生
```rust
// PalletId: b"mm/pool!"
// 派生公式: pool_account = derive_account(PalletId, maker_account)
let pool_account = T::PalletId::get().into_sub_account_truncating(&maker_account);
```

#### deposit_to_pool - 存入资金池
```rust
pub fn deposit_to_pool(
    origin: OriginFor<T>,
    maker_id: u64,
    amount: BalanceOf<T>,
) -> DispatchResult
```

**功能**：做市商向自己的资金池存入MEMO

#### request_withdrawal - 申请提取
```rust
pub fn request_withdrawal(
    origin: OriginFor<T>,
    maker_id: u64,
    amount: BalanceOf<T>,
) -> DispatchResult
```

**功能**：
- 创建提取请求
- 进入冷却期（默认7天）
- 防止恶意快速提取

#### execute_withdrawal - 执行提取
```rust
pub fn execute_withdrawal(
    origin: OriginFor<T>,
    maker_id: u64,
) -> DispatchResult
```

**功能**：
- 冷却期结束后执行提取
- 检查最小保留余额（默认1000 DUST）
- 转账到做市商账户

**WithdrawalRequest结构**：
```rust
pub struct WithdrawalRequest<Balance> {
    pub amount: Balance,
    pub requested_at: u32,         // 申请时间
    pub executable_at: u32,        // 可执行时间 = requested_at + 冷却期
    pub status: WithdrawalStatus,  // Pending/Executed/Cancelled
}
```

### 6. 数据脱敏与隐私保护

#### 脱敏规则

**姓名脱敏**：
```rust
fn mask_name(full_name: &str) -> Vec<u8> {
    match len {
        0 => "",
        1 => "×",
        2 => "×三",           // "张三" → "×三"
        3 => "李×五",         // "李四五" → "李×五"
        _ => "王×子",         // "王二麻子" → "王×子"
    }
}
```

**身份证脱敏**：
```rust
fn mask_id_card(id_card: &str) -> Vec<u8> {
    // 前4后4，中间星号
    "1101**********1234"  // "110101199001011234"
}
```

**生日脱敏**：
```rust
fn mask_birthday(birthday: &str) -> Vec<u8> {
    // 保留年份，隐藏月日
    "1990-xx-xx"  // "1990-01-01"
}
```

**用途**：
- 买家可判断做市商年龄段（如30岁、40岁）
- 但无法获知具体生日，保护隐私
- 身份验证时可核对脱敏后的信息

### 7. 服务管理

#### update_maker_info - 更新做市商信息
```rust
pub fn update_maker_info(
    origin: OriginFor<T>,
    maker_id: u64,
    tron_address: Option<Vec<u8>>,
    buy_premium_bps: Option<i16>,
    sell_premium_bps: Option<i16>,
    min_amount: Option<BalanceOf<T>>,
) -> DispatchResult
```

**功能**：做市商可更新业务参数

#### pause_service - 暂停服务
```rust
pub fn pause_service(
    origin: OriginFor<T>,
    maker_id: u64,
    paused: bool,
) -> DispatchResult
```

**功能**：
- 做市商可主动暂停接单
- 用于维护、资金调整等场景
- 不影响已有订单

## 📦 存储结构

### 申请记录
```rust
pub type Applications<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // maker_id
    Application<T::AccountId, BalanceOf<T>>,
    OptionQuery,
>;
```

**Application结构**：
```rust
pub struct Application<AccountId, Balance> {
    pub owner: AccountId,
    pub deposit: Balance,
    pub status: ApplicationStatus,
    pub direction: Direction,
    pub tron_address: BoundedVec<u8, ConstU32<64>>,
    pub buy_premium_bps: i16,
    pub sell_premium_bps: i16,
    pub min_amount: Balance,
    pub public_cid: Vec<u8>,
    pub private_cid: Vec<u8>,
    pub created_at: u32,
    pub info_deadline: u32,
    pub review_deadline: u32,
    pub service_paused: bool,
    pub users_served: u32,
    
    // 脱敏信息
    pub masked_full_name: BoundedVec<u8, ConstU32<64>>,
    pub masked_id_card: BoundedVec<u8, ConstU32<32>>,
    pub masked_birthday: BoundedVec<u8, ConstU32<16>>,
}
```

### 账户索引
```rust
pub type OwnerIndex<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    u64,  // maker_id
    OptionQuery,
>;
```

### 提取请求
```rust
pub type WithdrawalRequests<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // maker_id
    WithdrawalRequest<BalanceOf<T>>,
    OptionQuery,
>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config + pallet_timestamp::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// MEMO主币（支持冻结）
    type Currency: ReservableCurrency<Self::AccountId>;

    /// 权重信息
    type WeightInfo: MarketMakerWeightInfo;

    /// 最小押金（默认10,000 DUST）
    type MinDeposit: Get<BalanceOf<Self>>;

    /// 提交资料窗口（秒，默认7天）
    type InfoWindow: Get<u32>;

    /// 审核窗口（秒，默认14天）
    type ReviewWindow: Get<u32>;

    /// 拒绝罚没比例（千分比，默认50 = 5%）
    type RejectSlashBpsMax: Get<u16>;

    /// 治理起源（批准/拒绝）
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

    /// 审核员账户列表
    type ReviewerAccounts: Get<Vec<Self::AccountId>>;

    /// 最大溢价（基点，默认500 = 5%）
    type MaxPremiumBps: Get<i16>;

    /// 最小溢价（基点，默认-500 = -5%）
    type MinPremiumBps: Get<i16>;

    /// Pallet ID（用于派生资金池账户）
    type PalletId: Get<PalletId>;

    /// 资金池提取冷却期（秒，默认7天）
    type WithdrawalCooldown: Get<u32>;

    /// 最小保留资金池余额（默认1000 DUST）
    type MinPoolBalance: Get<BalanceOf<Self>>;
}
```

## 📡 可调用接口

### 用户接口

#### 1. lock_deposit - 锁定押金
```rust
#[pallet::call_index(0)]
pub fn lock_deposit(
    origin: OriginFor<T>,
    deposit: BalanceOf<T>,
) -> DispatchResult
```

#### 2. submit_info - 提交资料
```rust
#[pallet::call_index(1)]
pub fn submit_info(...) -> DispatchResult
```

#### 3. cancel - 取消申请
```rust
#[pallet::call_index(2)]
pub fn cancel(
    origin: OriginFor<T>,
    maker_id: u64,
) -> DispatchResult
```

#### 4. update_maker_info - 更新信息
```rust
#[pallet::call_index(3)]
pub fn update_maker_info(...) -> DispatchResult
```

#### 5. pause_service - 暂停服务
```rust
#[pallet::call_index(4)]
pub fn pause_service(
    origin: OriginFor<T>,
    maker_id: u64,
    paused: bool,
) -> DispatchResult
```

#### 6. deposit_to_pool - 存入资金池
```rust
#[pallet::call_index(5)]
pub fn deposit_to_pool(
    origin: OriginFor<T>,
    maker_id: u64,
    amount: BalanceOf<T>,
) -> DispatchResult
```

#### 7. request_withdrawal - 申请提取
```rust
#[pallet::call_index(6)]
pub fn request_withdrawal(
    origin: OriginFor<T>,
    maker_id: u64,
    amount: BalanceOf<T>,
) -> DispatchResult
```

#### 8. execute_withdrawal - 执行提取
```rust
#[pallet::call_index(7)]
pub fn execute_withdrawal(
    origin: OriginFor<T>,
    maker_id: u64,
) -> DispatchResult
```

### 治理接口

#### 9. approve - 批准申请
```rust
#[pallet::call_index(8)]
pub fn approve(
    origin: OriginFor<T>,
    maker_id: u64,
) -> DispatchResult
```

#### 10. reject - 拒绝申请
```rust
#[pallet::call_index(9)]
pub fn reject(
    origin: OriginFor<T>,
    maker_id: u64,
    reason_cid: Vec<u8>,
) -> DispatchResult
```

## 🎉 事件

### DepositLocked - 押金锁定事件
```rust
DepositLocked {
    maker_id: u64,
    owner: T::AccountId,
    deposit: BalanceOf<T>,
}
```

### InfoSubmitted - 资料提交事件
```rust
InfoSubmitted {
    maker_id: u64,
    direction: Direction,
}
```

### Approved - 批准事件
```rust
Approved {
    maker_id: u64,
}
```

### Rejected - 拒绝事件
```rust
Rejected {
    maker_id: u64,
    slash_amount: BalanceOf<T>,
}
```

### WithdrawalRequested - 提取请求事件
```rust
WithdrawalRequested {
    maker_id: u64,
    amount: BalanceOf<T>,
    executable_at: u32,
}
```

### WithdrawalExecuted - 提取执行事件
```rust
WithdrawalExecuted {
    maker_id: u64,
    amount: BalanceOf<T>,
}
```

## ❌ 错误处理

### InsufficientDeposit
- **说明**：押金不足
- **触发**：押金 < MinDeposit

### AlreadyApplied
- **说明**：已有未完成申请
- **触发**：重复申请

### ApplicationNotFound
- **说明**：申请不存在
- **触发**：操作不存在的maker_id

### InvalidStatus
- **说明**：状态无效
- **触发**：当前状态不允许该操作

### DeadlineExpired
- **说明**：截止时间已过
- **触发**：超过提交/审核期限

### InvalidPremium
- **说明**：溢价无效
- **触发**：溢价超出范围（±5%）

### WithdrawalNotReady
- **说明**：提取未就绪
- **触发**：冷却期未结束

### InsufficientPoolBalance
- **说明**：资金池余额不足
- **触发**：提取后低于最小保留余额

## 🔌 使用示例

### 场景1：做市商完整申请流程

```rust
// 1. 锁定押金（10,000 DUST）
let deposit = 10_000_000_000_000_000u128; // 10,000 DUST
pallet_market_maker::Pallet::<T>::lock_deposit(
    maker_origin.clone(),
    deposit,
)?;

// 2. 提交资料
pallet_market_maker::Pallet::<T>::submit_info(
    maker_origin.clone(),
    maker_id,
    Direction::BuyAndSell,  // 双向做市
    b"TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS".to_vec(),  // TRON地址
    -200,  // Buy溢价-2%
    +200,  // Sell溢价+2%
    100_000_000_000_000u128,  // 最小金额100 DUST
    b"张三".to_vec(),
    b"110101199001011234".to_vec(),
    b"1990-01-01".to_vec(),
    public_cid,
    private_cid,
)?;

// 3. 委员会审核
let governance_origin = /* 委员会多签 */;
pallet_market_maker::Pallet::<T>::approve(
    governance_origin,
    maker_id,
)?;

// 4. 初始化信用记录（自动）
// pallet_maker_credit::Pallet::<T>::initialize_credit(maker_id)?;
```

### 场景2：首购资金池管理

```rust
// 1. 做市商存入资金池（5,000 DUST）
pallet_market_maker::Pallet::<T>::deposit_to_pool(
    maker_origin.clone(),
    maker_id,
    5_000_000_000_000_000u128,
)?;

// 2. 查询资金池余额
let pool_account = derive_pool_account(maker_account);
let pool_balance = T::Currency::free_balance(&pool_account);

// 3. 申请提取（2,000 DUST）
pallet_market_maker::Pallet::<T>::request_withdrawal(
    maker_origin.clone(),
    maker_id,
    2_000_000_000_000_000u128,
)?;

// 4. 7天后执行提取
// 等待冷却期...
pallet_market_maker::Pallet::<T>::execute_withdrawal(
    maker_origin,
    maker_id,
)?;
```

## 🛡️ 安全机制

### 1. 分阶段审核

- 锁定押金防止恶意申请
- 提交资料设置截止时间
- 治理审核双重把关

### 2. 押金罚没

- 拒绝申请罚没5%
- 激励认真准备资料
- 防止垃圾申请

### 3. 数据脱敏

- 链上仅存脱敏信息
- 完整信息加密存储IPFS
- 保护做市商隐私

### 4. 资金池保护

- 提取冷却期7天
- 最小保留余额1000 DUST
- 防止恶意快速提取

### 5. 溢价限制

- 买入/卖出溢价±5%
- 防止恶意定价
- 保护用户利益

## 📝 最佳实践

### 1. 申请准备

- 准备好KYC资料
- 选择合理的溢价
- 充足的押金和流动性

### 2. 资金池管理

- 保持充足余额
- 定期补充资金
- 合理规划提取

### 3. 定价策略

- Buy溢价略低（-2% ~ -1%）
- Sell溢价略高（+1% ~ +2%）
- 根据市场调整

### 4. 服务质量

- 快速响应（<1小时）
- 及时释放（<12小时）
- 维护高信用分

## 🔗 相关模块

- **pallet-maker-credit**: 做市商信用（初始化800分）
- **pallet-otc-order**: OTC订单（使用做市商服务）
- **pallet-simple-bridge**: 桥接服务（使用做市商）
- **pallet-evidence**: 证据管理（提交KYC资料）

## 📚 参考资源

- [做市商申请流程](../../docs/maker-application-process.md)
- [数据脱敏规范](../../docs/data-masking-rules.md)
- [首购资金池管理](../../docs/first-purchase-pool-management.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队
