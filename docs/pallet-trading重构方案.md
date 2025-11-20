# pallet-trading 重构方案

**版本**: v1.0  
**制定日期**: 2025-11-03  
**目标**: 将 pallet-trading 从单体架构重构为模块化架构  
**预计周期**: 2-3 周

---

## 📋 目录

1. [重构目标](#重构目标)
2. [当前问题分析](#当前问题分析)
3. [目标架构设计](#目标架构设计)
4. [实施方案](#实施方案)
5. [迁移策略](#迁移策略)
6. [风险评估与对策](#风险评估与对策)
7. [时间规划](#时间规划)
8. [验收标准](#验收标准)

---

## 🎯 重构目标

### 核心目标

1. **解决架构问题**：消除子模块作用域冲突，实现编译通过
2. **符合最佳实践**：遵循 Substrate FRAME 标准架构模式
3. **提升可维护性**：模块独立、职责清晰、易于测试
4. **保持功能完整**：零功能丢失，兼容现有前端
5. **优化性能**：减少跨 pallet 调用开销，优化存储布局

### 非目标（本次不做）

- ❌ 重新设计业务逻辑
- ❌ 修改前端 UI/UX
- ❌ 大规模重写测试用例
- ❌ 改变链上数据结构（利用零迁移窗口期）

---

## 🔍 当前问题分析

### 问题 1：架构不符合 Substrate 最佳实践

**现状**：
```
pallet-trading/
├── lib.rs (pub mod pallet)
├── maker.rs (子模块)
├── otc.rs (子模块)
└── bridge.rs (子模块)
```

**问题**：
- 子模块无法访问 `pub mod pallet` 内部的宏生成类型
- 需要使用 `pub use pallet::*` 污染顶层命名空间
- 违背 Substrate "一个业务域 = 一个 pallet" 原则

**影响**：
- 40+ 个编译错误
- 代码可读性差
- 测试困难
- 后续扩展受限

### 问题 2：高耦合度

**现状**：
- Maker、OTC、Bridge 三个业务域强耦合在单一 pallet
- 存储混合在一起（NextMakerId, NextOrderId, NextSwapId）
- 事件、错误混合定义

**影响**：
- 修改一个模块可能影响其他模块
- 难以进行独立测试
- 权重计算复杂
- 难以进行功能开关

### 问题 3：可维护性问题

**现状**：
- `lib.rs` 文件超过 1200 行
- 混合了 Config、Storage、Event、Error、Extrinsics
- 子模块函数需要使用全限定路径 `crate::XXX::<T>::...`

**影响**：
- 代码审查困难
- 新人上手成本高
- 容易引入 bug
- 重构风险大

---

## 🏗️ 目标架构设计

### 方案对比

| 方案 | 架构 | 优势 | 劣势 | 推荐度 |
|------|------|------|------|--------|
| **方案 A** | 保持单体，使用全限定路径 | 改动最小，快速 | 技术债依旧，不符合最佳实践 | ⭐⭐ |
| **方案 B** | 移到 pallet 内部 | 编译通过，无需拆分 | lib.rs 膨胀到 4000+ 行，难维护 | ⭐⭐⭐ |
| **方案 C（推荐）** | 拆分为独立 pallet | 完全符合最佳实践，高可维护性 | 开发量最大 | ⭐⭐⭐⭐⭐ |

### 方案 C：模块化架构（推荐）

#### 目标结构

```
pallets/
├── pallet-maker/              # 做市商管理（独立 pallet）
│   ├── src/
│   │   ├── lib.rs             # Config, Storage, Event, Error, Extrinsics
│   │   ├── types.rs           # MakerApplication, ApplicationStatus, Direction
│   │   ├── weights.rs
│   │   ├── tests.rs
│   │   └── benchmarking.rs
│   ├── Cargo.toml
│   └── README.md
│
├── pallet-otc-order/          # OTC 订单管理（独立 pallet）
│   ├── src/
│   │   ├── lib.rs
│   │   ├── types.rs           # Order, OrderState
│   │   ├── first_purchase.rs  # 首购逻辑
│   │   ├── cleanup.rs         # 自动清理
│   │   ├── weights.rs
│   │   ├── tests.rs
│   │   └── benchmarking.rs
│   ├── Cargo.toml
│   └── README.md
│
├── pallet-bridge/             # DUST ↔ USDT 桥接（独立 pallet）
│   ├── src/
│   │   ├── lib.rs
│   │   ├── types.rs           # SwapRequest, MakerSwapRecord
│   │   ├── official.rs        # 官方桥接
│   │   ├── maker_swap.rs      # 做市商桥接
│   │   ├── ocw.rs             # Off-chain Worker
│   │   ├── cleanup.rs
│   │   ├── weights.rs
│   │   ├── tests.rs
│   │   └── benchmarking.rs
│   ├── Cargo.toml
│   └── README.md
│
├── pallet-trading-common/     # 公共工具库（非 pallet，纯 Rust crate）
│   ├── src/
│   │   ├── lib.rs
│   │   ├── mask.rs            # 脱敏函数
│   │   ├── tron.rs            # TRON 哈希防重放
│   │   └── validation.rs      # 验证函数
│   ├── Cargo.toml
│   └── README.md
│
└── pallet-trading/            # 统一接口层（可选，简化前端调用）
    ├── src/
    │   ├── lib.rs             # 仅包含接口转发
    │   └── README.md
    ├── Cargo.toml
    └── README.md
```

#### 模块职责划分

##### 1. pallet-maker (做市商管理)

**职责**：
- ✅ 做市商申请与审核
- ✅ 押金管理（锁定/解锁）
- ✅ 提现管理（冷却期）
- ✅ 溢价配置
- ✅ 服务暂停/恢复

**存储**：
```rust
#[pallet::storage]
pub type NextMakerId<T> = StorageValue<_, u64, ValueQuery>;

#[pallet::storage]
pub type MakerApplications<T: Config> = StorageMap<_, Blake2_128Concat, u64, MakerApplication<T>>;

#[pallet::storage]
pub type AccountToMaker<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u64>;

#[pallet::storage]
pub type WithdrawalRequests<T: Config> = StorageMap<_, Blake2_128Concat, u64, WithdrawalRequest<T>>;
```

**依赖**：
- `frame-system`
- `frame-support`
- `pallet-balances` (Currency)
- `pallet-credit` (信用记录)
- `pallet-trading-common` (脱敏、验证)

**接口**：
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn lock_deposit(origin: OriginFor<T>) -> DispatchResult;
    pub fn submit_info(...) -> DispatchResult;
    pub fn approve_maker(origin: OriginFor<T>, maker_id: u64) -> DispatchResult;
    pub fn reject_maker(...) -> DispatchResult;
    pub fn update_info(...) -> DispatchResult;
    pub fn request_withdrawal(...) -> DispatchResult;
    pub fn execute_withdrawal(...) -> DispatchResult;
    pub fn cancel_withdrawal(...) -> DispatchResult;
    pub fn pause_service(...) -> DispatchResult;
    pub fn resume_service(...) -> DispatchResult;
}
```

**查询接口**：
```rust
impl<T: Config> Pallet<T> {
    /// 查询做市商信息
    pub fn get_maker(maker_id: u64) -> Option<MakerApplication<T>>;
    
    /// 检查账户是否是做市商
    pub fn is_maker(who: &T::AccountId) -> bool;
    
    /// 检查做市商是否活跃
    pub fn is_maker_active(maker_id: u64) -> bool;
    
    /// 获取做市商的服务方向
    pub fn get_maker_direction(maker_id: u64) -> Option<Direction>;
}
```

##### 2. pallet-otc-order (OTC 订单管理)

**职责**：
- ✅ OTC 订单创建
- ✅ 首购订单特殊逻辑
- ✅ 付款标记
- ✅ DUST 释放
- ✅ 订单取消与争议
- ✅ 自动过期清理

**存储**：
```rust
#[pallet::storage]
pub type NextOrderId<T> = StorageValue<_, u64, ValueQuery>;

#[pallet::storage]
pub type Orders<T: Config> = StorageMap<_, Blake2_128Concat, u64, Order<T>>;

#[pallet::storage]
pub type BuyerOrders<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<100>>, ValueQuery>;

#[pallet::storage]
pub type MakerOrders<T> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u64, ConstU32<1000>>, ValueQuery>;

// 首购相关
#[pallet::storage]
pub type HasFirstPurchased<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, bool, ValueQuery>;

#[pallet::storage]
pub type MakerFirstPurchaseCount<T> = StorageMap<_, Blake2_128Concat, u64, u32, ValueQuery>;

#[pallet::storage]
pub type MakerFirstPurchaseOrders<T> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u64, ConstU32<5>>, ValueQuery>;
```

**依赖**：
- `frame-system`
- `frame-support`
- `pallet-balances` (Currency)
- `pallet-escrow` (资金托管)
- `pallet-maker` (查询做市商信息)
- `pallet-pricing` (DUST/USD 汇率)
- `pallet-credit` (信用记录)
- `pallet-trading-common` (TRON 防重放)

**接口**：
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn create_order(...) -> DispatchResult;
    pub fn create_first_purchase(...) -> DispatchResult;
    pub fn mark_paid(...) -> DispatchResult;
    pub fn release_dust(...) -> DispatchResult;
    pub fn cancel_order(...) -> DispatchResult;
    pub fn dispute_order(...) -> DispatchResult;
}
```

**Hooks**：
```rust
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_idle(_n: BlockNumberFor<T>, remaining_weight: Weight) -> Weight {
        // 自动取消过期订单
        Self::cancel_expired_orders(remaining_weight)
    }
}
```

##### 3. pallet-bridge (DUST ↔ USDT 桥接)

**职责**：
- ✅ 官方桥接（Root 管理）
- ✅ 做市商桥接
- ✅ OCW 自动验证 TRON 交易
- ✅ 超时退款
- ✅ 用户举报

**存储**：
```rust
#[pallet::storage]
pub type NextSwapId<T> = StorageValue<_, u64, ValueQuery>;

#[pallet::storage]
pub type SwapRequests<T: Config> = StorageMap<_, Blake2_128Concat, u64, SwapRequest<T>>;

#[pallet::storage]
pub type MakerSwaps<T: Config> = StorageMap<_, Blake2_128Concat, u64, MakerSwapRecord<T>>;

#[pallet::storage]
pub type UserSwaps<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<100>>, ValueQuery>;

#[pallet::storage]
pub type MakerSwapList<T> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u64, ConstU32<1000>>, ValueQuery>;

#[pallet::storage]
pub type BridgeAccount<T: Config> = StorageValue<_, T::AccountId>;

#[pallet::storage]
pub type MinSwapAmount<T: Config> = StorageValue<_, BalanceOf<T>>;
```

**依赖**：
- `frame-system`
- `frame-support`
- `pallet-balances` (Currency)
- `pallet-escrow` (资金托管)
- `pallet-maker` (查询做市商信息)
- `pallet-trading-common` (TRON 防重放)

**接口**：
```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    // 官方桥接
    pub fn swap(...) -> DispatchResult;
    pub fn complete_swap(...) -> DispatchResult;
    
    // 做市商桥接
    pub fn maker_swap(...) -> DispatchResult;
    pub fn mark_swap_complete(...) -> DispatchResult;
    pub fn report_swap(...) -> DispatchResult;
    
    // 治理
    pub fn set_bridge_account(...) -> DispatchResult;
    pub fn set_min_swap_amount(...) -> DispatchResult;
}
```

**OCW**：
```rust
#[pallet::validate_unsigned]
impl<T: Config> ValidateUnsigned for Pallet<T> {
    type Call = Call<T>;
    
    fn validate_unsigned(source: TransactionSource, call: &Self::Call) -> TransactionValidity {
        // 验证 OCW 提交的 TRON 交易验证结果
    }
}

impl<T: Config> Pallet<T> {
    fn offchain_worker(block_number: BlockNumberFor<T>) {
        // 自动验证待处理的 TRON 交易
    }
}
```

##### 4. pallet-trading-common (公共工具库)

**职责**：
- ✅ 脱敏函数（姓名、身份证、生日）
- ✅ TRON 哈希防重放（可选：提升为独立 pallet）
- ✅ 验证函数（TRON 地址、EPAY 配置）

**注意**：这是一个纯 Rust crate，不是 pallet，没有存储和链上逻辑。

```rust
// lib.rs
pub mod mask;
pub mod tron;
pub mod validation;

// mask.rs
pub fn mask_name(name: &[u8]) -> Vec<u8>;
pub fn mask_id_card(id_card: &[u8]) -> Vec<u8>;
pub fn mask_birthday(birthday: &[u8]) -> Vec<u8>;

// tron.rs (如果不作为独立 pallet)
pub struct TronHashTracker<T> {
    used_hashes: BTreeSet<H256>,
    queue: VecDeque<(H256, BlockNumber)>,
}

impl<T> TronHashTracker<T> {
    pub fn record(&mut self, hash: H256, block: BlockNumber) -> Result<(), &'static str>;
    pub fn cleanup(&mut self, current_block: BlockNumber, retention: BlockNumber);
    pub fn is_used(&self, hash: &H256) -> bool;
}

// validation.rs
pub fn is_valid_tron_address(address: &[u8]) -> bool;
pub fn is_valid_epay_config(epay_no: &[u8], epay_key: &[u8]) -> bool;
```

**如果 TRON 防重放需要链上存储**，可以提升为独立的 `pallet-tron-tracker`：
```rust
// pallet-tron-tracker
#[pallet::storage]
pub type TronTxUsed<T> = StorageMap<_, Blake2_128Concat, H256, BlockNumberFor<T>>;

#[pallet::storage]
pub type TronTxQueue<T> = StorageValue<_, BoundedVec<(H256, BlockNumberFor<T>), ConstU32<10000>>, ValueQuery>;

impl<T: Config> Pallet<T> {
    pub fn record_tron_tx(hash: H256) -> DispatchResult;
    pub fn is_tron_tx_used(hash: &H256) -> bool;
}
```

##### 5. pallet-trading (统一接口层，可选)

**目的**：简化前端调用，提供统一的 API 入口。

**实现方式**：仅做接口转发，不包含业务逻辑。

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    // 做市商接口（转发到 pallet-maker）
    pub fn lock_deposit(origin: OriginFor<T>) -> DispatchResult {
        pallet_maker::Pallet::<T>::lock_deposit(origin)
    }
    
    pub fn submit_info(origin: OriginFor<T>, ...) -> DispatchResult {
        pallet_maker::Pallet::<T>::submit_info(origin, ...)
    }
    
    // OTC 接口（转发到 pallet-otc-order）
    pub fn create_order(origin: OriginFor<T>, ...) -> DispatchResult {
        pallet_otc_order::Pallet::<T>::create_order(origin, ...)
    }
    
    // Bridge 接口（转发到 pallet-bridge）
    pub fn swap(origin: OriginFor<T>, ...) -> DispatchResult {
        pallet_bridge::Pallet::<T>::swap(origin, ...)
    }
}
```

**优点**：
- ✅ 前端 API 路径不变：`api.tx.trading.createOrder(...)`
- ✅ 平滑迁移，无需修改前端代码

**缺点**：
- ⚠️  增加了一层调用开销（每次调用多 ~1000 weight）
- ⚠️  维护成本（需要同步更新接口）

**决策**：
- **Phase 2**：保留 `pallet-trading` 作为统一接口层，简化前端迁移
- **Phase 3**：考虑移除，让前端直接调用独立 pallet

---

## 📝 实施方案

### 阶段 1：准备阶段（3 天）

#### 1.1 创建新的 pallet 骨架

```bash
# 创建独立 pallet 目录
cd pallets
mkdir pallet-maker pallet-otc-order pallet-bridge pallet-trading-common

# 使用 FRAME 模板创建基础结构
# （可以使用 `polkadot-sdk` 提供的 pallet 模板）
```

#### 1.2 设置 Cargo.toml 依赖

**pallet-maker/Cargo.toml**：
```toml
[package]
name = "pallet-maker"
version = "0.1.0"
edition = "2021"

[dependencies]
codec = { package = "parity-scale-codec", version = "3.6.12", default-features = false }
scale-info = { version = "2.11.3", default-features = false }

frame-support = { default-features = false }
frame-system = { default-features = false }
sp-runtime = { default-features = false }
sp-std = { default-features = false }

# 项目内部依赖
pallet-balances = { path = "../balances", default-features = false }
pallet-credit = { path = "../credit", default-features = false }
pallet-trading-common = { path = "../pallet-trading-common", default-features = false }

[dev-dependencies]
sp-core = { default-features = false }
sp-io = { default-features = false }

[features]
default = ["std"]
std = [
    "codec/std",
    "scale-info/std",
    "frame-support/std",
    "frame-system/std",
    # ...
]
runtime-benchmarks = [
    "frame-support/runtime-benchmarks",
    "frame-system/runtime-benchmarks",
]
try-runtime = [
    "frame-support/try-runtime",
    "frame-system/try-runtime",
]
```

**类似的配置用于 `pallet-otc-order`、`pallet-bridge`**。

**pallet-trading-common/Cargo.toml**（纯 Rust crate）：
```toml
[package]
name = "pallet-trading-common"
version = "0.1.0"
edition = "2021"

[dependencies]
codec = { package = "parity-scale-codec", version = "3.6.12", default-features = false }
sp-core = { default-features = false }
sp-std = { default-features = false }

[features]
default = ["std"]
std = [
    "codec/std",
    "sp-core/std",
    "sp-std/std",
]
```

#### 1.3 更新 workspace Cargo.toml

```toml
# 根目录 Cargo.toml
[workspace]
members = [
    "node",
    "runtime",
    "pallets/maker",           # 新增
    "pallets/otc-order",       # 新增
    "pallets/bridge",          # 新增
    "pallets/trading-common",  # 新增
    "pallets/trading",         # 保留（接口层）
    # ... 其他 pallets
]
```

### 阶段 2：迁移 Maker 模块（5 天）

#### 2.1 迁移数据结构

从 `pallets/trading/src/maker.rs` 迁移到 `pallets/maker/src/types.rs`：

```rust
// pallets/maker/src/types.rs

use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use frame_support::BoundedVec;
use sp_runtime::RuntimeDebug;

/// 做市商申请状态
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ApplicationStatus {
    DepositLocked,
    PendingReview,
    Active,
    Paused,
    Rejected,
    Withdrawing,
    Withdrawn,
    Canceled,
}

/// 服务方向
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum Direction {
    Buy,
    Sell,
    BuyAndSell,
}

/// 做市商申请记录
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MakerApplication<T: frame_system::Config> {
    pub owner: T::AccountId,
    pub deposit: u128,  // 简化类型，避免泛型复杂度
    pub status: ApplicationStatus,
    pub direction: Direction,
    pub tron_address: BoundedVec<u8, ConstU32<34>>,
    pub buy_premium_bps: i16,
    pub sell_premium_bps: i16,
    // ... 其他字段
}

/// 提现请求
#[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct WithdrawalRequest {
    pub amount: u128,
    pub request_time: u64,  // 使用固定类型
}
```

#### 2.2 迁移存储和配置

```rust
// pallets/maker/src/lib.rs

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    
    #[pallet::pallet]
    pub struct Pallet<T>(_);
    
    /// 配置 trait
    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;
        
        /// 信用记录接口
        type MakerCredit: pallet_credit::MakerCreditInterface<Self::AccountId>;
        
        /// 治理权限
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        
        /// 做市商押金金额
        #[pallet::constant]
        type MakerDepositAmount: Get<BalanceOf<Self>>;
        
        /// 申请超时时间
        #[pallet::constant]
        type MakerApplicationTimeout: Get<BlockNumberFor<Self>>;
        
        /// 提现冷却期
        #[pallet::constant]
        type WithdrawalCooldown: Get<BlockNumberFor<Self>>;
        
        type WeightInfo: WeightInfo;
    }
    
    /// 存储
    #[pallet::storage]
    #[pallet::getter(fn next_maker_id)]
    pub type NextMakerId<T> = StorageValue<_, u64, ValueQuery>;
    
    #[pallet::storage]
    #[pallet::getter(fn maker_applications)]
    pub type MakerApplications<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        MakerApplication<T>,
    >;
    
    #[pallet::storage]
    #[pallet::getter(fn account_to_maker)]
    pub type AccountToMaker<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u64,
    >;
    
    #[pallet::storage]
    pub type WithdrawalRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        WithdrawalRequest,
    >;
    
    /// 事件
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        DepositLocked { maker_id: u64, who: T::AccountId, amount: BalanceOf<T> },
        InfoSubmitted { maker_id: u64 },
        MakerApproved { maker_id: u64, approved_by: T::AccountId },
        MakerRejected { maker_id: u64, rejected_by: T::AccountId },
        // ... 其他事件
    }
    
    /// 错误
    #[pallet::error]
    pub enum Error<T> {
        AlreadyApplied,
        NotFound,
        NotPendingReview,
        InsufficientDeposit,
        // ... 其他错误
    }
    
    /// Extrinsics
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 锁定押金
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::lock_deposit())]
        pub fn lock_deposit(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查是否已申请
            ensure!(!AccountToMaker::<T>::contains_key(&who), Error::<T>::AlreadyApplied);
            
            // 锁定押金
            let deposit_amount = T::MakerDepositAmount::get();
            T::Currency::reserve(&who, deposit_amount)?;
            
            // 生成 maker_id
            let maker_id = NextMakerId::<T>::get();
            NextMakerId::<T>::put(maker_id + 1);
            
            // 创建申请记录
            let application = MakerApplication {
                owner: who.clone(),
                deposit: deposit_amount.saturated_into(),
                status: ApplicationStatus::DepositLocked,
                direction: Direction::BuyAndSell,  // 默认值
                // ... 其他默认值
            };
            
            MakerApplications::<T>::insert(maker_id, application);
            AccountToMaker::<T>::insert(&who, maker_id);
            
            Self::deposit_event(Event::DepositLocked { maker_id, who, amount: deposit_amount });
            
            Ok(())
        }
        
        /// 提交资料
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            real_name: Vec<u8>,
            id_card_number: Vec<u8>,
            birthday: Vec<u8>,
            tron_address: Vec<u8>,
            wechat_id: Option<Vec<u8>>,
            epay_no: Option<Vec<u8>>,
            epay_key: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            let maker_id = AccountToMaker::<T>::get(&who).ok_or(Error::<T>::NotFound)?;
            let mut application = MakerApplications::<T>::get(maker_id).ok_or(Error::<T>::NotFound)?;
            
            // 检查状态
            ensure!(application.status == ApplicationStatus::DepositLocked, Error::<T>::InvalidStatus);
            
            // 验证 TRON 地址
            use pallet_trading_common::validation::is_valid_tron_address;
            ensure!(is_valid_tron_address(&tron_address), Error::<T>::InvalidTronAddress);
            
            // 脱敏处理
            use pallet_trading_common::mask::{mask_name, mask_id_card, mask_birthday};
            application.masked_full_name = mask_name(&real_name).try_into().map_err(|_| Error::<T>::InvalidName)?;
            application.masked_id_card = mask_id_card(&id_card_number).try_into().map_err(|_| Error::<T>::InvalidIdCard)?;
            application.masked_birthday = mask_birthday(&birthday).try_into().map_err(|_| Error::<T>::InvalidBirthday)?;
            
            // 更新状态
            application.status = ApplicationStatus::PendingReview;
            application.tron_address = tron_address.try_into().map_err(|_| Error::<T>::InvalidTronAddress)?;
            
            MakerApplications::<T>::insert(maker_id, application);
            
            Self::deposit_event(Event::InfoSubmitted { maker_id });
            
            Ok(())
        }
        
        // ... 其他 extrinsics
    }
    
    /// 公共查询接口
    impl<T: Config> Pallet<T> {
        /// 查询做市商信息
        pub fn get_maker(maker_id: u64) -> Option<MakerApplication<T>> {
            MakerApplications::<T>::get(maker_id)
        }
        
        /// 检查账户是否是做市商
        pub fn is_maker(who: &T::AccountId) -> bool {
            AccountToMaker::<T>::contains_key(who)
        }
        
        /// 检查做市商是否活跃
        pub fn is_maker_active(maker_id: u64) -> bool {
            if let Some(app) = Self::get_maker(maker_id) {
                app.status == ApplicationStatus::Active
            } else {
                false
            }
        }
        
        /// 获取做市商的服务方向
        pub fn get_maker_direction(maker_id: u64) -> Option<Direction> {
            Self::get_maker(maker_id).map(|app| app.direction)
        }
    }
}
```

#### 2.3 编写测试

```rust
// pallets/maker/src/tests.rs

use crate::{mock::*, Error, Event};
use frame_support::{assert_noop, assert_ok};

#[test]
fn lock_deposit_works() {
    new_test_ext().execute_with(|| {
        // 锁定押金
        assert_ok!(Maker::lock_deposit(RuntimeOrigin::signed(1)));
        
        // 验证事件
        System::assert_last_event(Event::DepositLocked { maker_id: 0, who: 1, amount: 1000 }.into());
        
        // 验证存储
        assert_eq!(Maker::next_maker_id(), 1);
        assert!(Maker::account_to_maker(1).is_some());
    });
}

#[test]
fn lock_deposit_fails_if_already_applied() {
    new_test_ext().execute_with(|| {
        assert_ok!(Maker::lock_deposit(RuntimeOrigin::signed(1)));
        
        // 重复申请应该失败
        assert_noop!(
            Maker::lock_deposit(RuntimeOrigin::signed(1)),
            Error::<Test>::AlreadyApplied
        );
    });
}

// ... 更多测试
```

### 阶段 3：迁移 OTC 模块（7 天）

类似阶段 2，迁移 `pallets/trading/src/otc.rs` 到 `pallets/otc-order/`。

**关键点**：
- 依赖 `pallet-maker` 查询做市商信息
- 依赖 `pallet-pricing` 获取汇率（首购）
- 依赖 `pallet-escrow` 托管资金
- 实现 `on_idle` 自动清理过期订单

```rust
// pallets/otc-order/src/lib.rs

#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    
    type Currency: Currency<Self::AccountId>;
    
    /// 托管接口
    type Escrow: pallet_escrow::Escrow<Self::AccountId, BalanceOf<Self>>;
    
    /// 做市商信息查询（依赖 pallet-maker）
    type MakerProvider: MakerProvider<Self::AccountId>;
    
    /// 价格提供者（依赖 pallet-pricing）
    type Pricing: PricingProvider;
    
    /// 信用记录
    type MakerCredit: pallet_credit::MakerCreditInterface<Self::AccountId>;
    
    // ... 其他配置
}

/// 做市商信息查询 trait
pub trait MakerProvider<AccountId> {
    fn is_maker_active(maker_id: u64) -> bool;
    fn get_maker_direction(maker_id: u64) -> Option<Direction>;
    fn get_maker_account(maker_id: u64) -> Option<AccountId>;
}

/// 价格提供者 trait
pub trait PricingProvider {
    fn get_dust_to_usd_rate() -> Option<u128>;
}
```

**Runtime 配置**：
```rust
// runtime/src/lib.rs

// 实现 MakerProvider
impl pallet_otc_order::MakerProvider<AccountId> for Runtime {
    fn is_maker_active(maker_id: u64) -> bool {
        pallet_maker::Pallet::<Runtime>::is_maker_active(maker_id)
    }
    
    fn get_maker_direction(maker_id: u64) -> Option<pallet_maker::Direction> {
        pallet_maker::Pallet::<Runtime>::get_maker_direction(maker_id)
    }
    
    fn get_maker_account(maker_id: u64) -> Option<AccountId> {
        pallet_maker::Pallet::<Runtime>::get_maker(maker_id).map(|app| app.owner)
    }
}

// 配置 pallet-otc-order
impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Escrow = Escrow;
    type MakerProvider = Self;  // Runtime 本身实现了 MakerProvider
    type Pricing = PricingProviderImpl;
    type MakerCredit = Credit;
    // ...
}
```

### 阶段 4：迁移 Bridge 模块（6 天）

类似阶段 2/3，迁移 `pallets/trading/src/bridge.rs` 到 `pallets/bridge/`。

**关键点**：
- 实现 OCW (Off-chain Worker)
- 实现 `validate_unsigned` 用于 OCW 提交
- 依赖 `pallet-maker` 查询做市商信息

### 阶段 5：创建统一接口层（2 天，可选）

```rust
// pallets/trading/src/lib.rs

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    
    #[pallet::pallet]
    pub struct Pallet<T>(_);
    
    #[pallet::config]
    pub trait Config: 
        frame_system::Config
        + pallet_maker::Config
        + pallet_otc_order::Config
        + pallet_bridge::Config
    {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }
    
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // ===== Maker 接口转发 =====
        
        #[pallet::call_index(0)]
        #[pallet::weight(<T as pallet_maker::Config>::WeightInfo::lock_deposit())]
        pub fn lock_deposit(origin: OriginFor<T>) -> DispatchResult {
            pallet_maker::Pallet::<T>::lock_deposit(origin)
        }
        
        #[pallet::call_index(1)]
        #[pallet::weight(<T as pallet_maker::Config>::WeightInfo::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            real_name: Vec<u8>,
            id_card_number: Vec<u8>,
            birthday: Vec<u8>,
            tron_address: Vec<u8>,
            wechat_id: Option<Vec<u8>>,
            epay_no: Option<Vec<u8>>,
            epay_key: Option<Vec<u8>>,
        ) -> DispatchResult {
            pallet_maker::Pallet::<T>::submit_info(
                origin,
                real_name,
                id_card_number,
                birthday,
                tron_address,
                wechat_id,
                epay_no,
                epay_key,
            )
        }
        
        // ===== OTC 接口转发 =====
        
        #[pallet::call_index(10)]
        #[pallet::weight(<T as pallet_otc_order::Config>::WeightInfo::create_order())]
        pub fn create_order(
            origin: OriginFor<T>,
            maker_id: u64,
            dust_amount: BalanceOf<T>,
            payment_commit: [u8; 32],
            contact_commit: [u8; 32],
        ) -> DispatchResult {
            pallet_otc_order::Pallet::<T>::create_order(
                origin,
                maker_id,
                dust_amount,
                payment_commit,
                contact_commit,
            )
        }
        
        // ===== Bridge 接口转发 =====
        
        #[pallet::call_index(20)]
        #[pallet::weight(<T as pallet_bridge::Config>::WeightInfo::swap())]
        pub fn swap(
            origin: OriginFor<T>,
            dust_amount: BalanceOf<T>,
            usdt_address: Vec<u8>,
        ) -> DispatchResult {
            pallet_bridge::Pallet::<T>::swap(origin, dust_amount, usdt_address)
        }
        
        // ... 其他接口转发
    }
}
```

### 阶段 6：Runtime 集成（3 天）

#### 6.1 更新 Runtime Cargo.toml

```toml
# runtime/Cargo.toml

[dependencies]
# 新的独立 pallet
pallet-maker = { path = "../pallets/maker", default-features = false }
pallet-otc-order = { path = "../pallets/otc-order", default-features = false }
pallet-bridge = { path = "../pallets/bridge", default-features = false }
pallet-trading-common = { path = "../pallets/trading-common", default-features = false }

# 可选：统一接口层
pallet-trading = { path = "../pallets/trading", default-features = false }

[features]
std = [
    # ...
    "pallet-maker/std",
    "pallet-otc-order/std",
    "pallet-bridge/std",
    "pallet-trading-common/std",
    "pallet-trading/std",  # 如果使用
]
```

#### 6.2 配置 Runtime

```rust
// runtime/src/lib.rs

// ===== Maker 配置 =====
parameter_types! {
    pub const MakerDepositAmount: Balance = 1_000 * DUST;
    pub const MakerApplicationTimeout: BlockNumber = 14_400;
    pub const WithdrawalCooldown: BlockNumber = 100_800;
}

impl pallet_maker::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type MakerCredit = Credit;
    type GovernanceOrigin = EnsureRoot<AccountId>;
    type MakerDepositAmount = MakerDepositAmount;
    type MakerApplicationTimeout = MakerApplicationTimeout;
    type WithdrawalCooldown = WithdrawalCooldown;
    type WeightInfo = ();
}

// ===== OTC Order 配置 =====
parameter_types! {
    pub const ConfirmTTL: BlockNumber = 600;
    pub const CancelWindow: u64 = 300_000;
    pub const FirstPurchaseUsdValue: u128 = 10_000_000;
    pub const MinFirstPurchaseDustAmount: Balance = 100 * DUST;
    pub const MaxFirstPurchaseDustAmount: Balance = 10_000 * DUST;
    pub const MaxFirstPurchaseOrdersPerMaker: u32 = 5;
}

impl pallet_otc_order::MakerProvider<AccountId> for Runtime {
    fn is_maker_active(maker_id: u64) -> bool {
        pallet_maker::Pallet::<Runtime>::is_maker_active(maker_id)
    }
    
    fn get_maker_direction(maker_id: u64) -> Option<pallet_maker::Direction> {
        pallet_maker::Pallet::<Runtime>::get_maker_direction(maker_id)
    }
    
    fn get_maker_account(maker_id: u64) -> Option<AccountId> {
        pallet_maker::Pallet::<Runtime>::get_maker(maker_id).map(|app| app.owner)
    }
}

impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Escrow = Escrow;
    type MakerProvider = Self;
    type Pricing = PricingProviderImpl;
    type MakerCredit = Credit;
    type ConfirmTTL = ConfirmTTL;
    type CancelWindow = CancelWindow;
    type FirstPurchaseUsdValue = FirstPurchaseUsdValue;
    type MinFirstPurchaseDustAmount = MinFirstPurchaseDustAmount;
    type MaxFirstPurchaseDustAmount = MaxFirstPurchaseDustAmount;
    type MaxFirstPurchaseOrdersPerMaker = MaxFirstPurchaseOrdersPerMaker;
    type WeightInfo = ();
}

// ===== Bridge 配置 =====
impl pallet_bridge::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Escrow = Escrow;
    type MakerProvider = Self;
    type GovernanceOrigin = EnsureRoot<AccountId>;
    type WeightInfo = ();
}

// ===== Trading 统一接口层（可选）=====
impl pallet_trading::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
}

// ===== construct_runtime! =====
construct_runtime! {
    pub enum Runtime {
        System: frame_system,
        Timestamp: pallet_timestamp,
        Balances: pallet_balances,
        
        // 新的独立 pallet
        Maker: pallet_maker,
        OtcOrder: pallet_otc_order,
        Bridge: pallet_bridge,
        
        // 可选：统一接口层
        Trading: pallet_trading,
        
        // ... 其他 pallets
    }
}
```

### 阶段 7：前端适配（4 天）

#### 7.1 前端 API 路径变化

**选项 A：保留统一接口层**
```typescript
// 前端代码无需修改
api.tx.trading.lockDeposit();
api.tx.trading.createOrder(...);
api.tx.trading.swap(...);
```

**选项 B：直接调用独立 pallet**
```typescript
// 需要更新前端代码
api.tx.maker.lockDeposit();
api.tx.otcOrder.createOrder(...);
api.tx.bridge.swap(...);
```

#### 7.2 更新前端服务层

```typescript
// src/services/makerService.ts
export const makerService = {
  async lockDeposit() {
    const api = await getApi();
    const tx = api.tx.maker.lockDeposit();  // 或 api.tx.trading.lockDeposit()
    return await tx;
  },
  
  async submitInfo(info: MakerInfo) {
    const api = await getApi();
    const tx = api.tx.maker.submitInfo(
      info.realName,
      info.idCard,
      info.birthday,
      info.tronAddress,
      info.wechatId,
      info.epayNo,
      info.epayKey,
    );
    return await tx;
  },
};

// src/services/otcService.ts
export const otcService = {
  async createOrder(params: CreateOrderParams) {
    const api = await getApi();
    const tx = api.tx.otcOrder.createOrder(  // 或 api.tx.trading.createOrder()
      params.makerId,
      params.dustAmount,
      params.paymentCommit,
      params.contactCommit,
    );
    return await tx;
  },
};

// src/services/bridgeService.ts
export const bridgeService = {
  async swap(params: SwapParams) {
    const api = await getApi();
    const tx = api.tx.bridge.swap(  // 或 api.tx.trading.swap()
      params.dustAmount,
      params.usdtAddress,
    );
    return await tx;
  },
};
```

#### 7.3 更新文档

- 更新 `stardust-dapp/docs/` 中的 API 文档
- 更新 `pallets/*/README.md` 使用说明
- 创建迁移指南：`docs/前端适配指南-Pallet重构.md`

### 阶段 8：测试与验证（5 天）

#### 8.1 单元测试

```bash
# 测试每个独立 pallet
cargo test -p pallet-maker
cargo test -p pallet-otc-order
cargo test -p pallet-bridge

# 测试统一接口层
cargo test -p pallet-trading
```

#### 8.2 集成测试

```rust
// tests/integration/test_maker_otc_integration.rs

#[test]
fn maker_can_accept_otc_order() {
    new_test_ext().execute_with(|| {
        // 1. 创建做市商
        assert_ok!(Maker::lock_deposit(RuntimeOrigin::signed(MAKER)));
        assert_ok!(Maker::submit_info(RuntimeOrigin::signed(MAKER), ...));
        assert_ok!(Maker::approve_maker(RuntimeOrigin::root(), 0));
        
        // 2. 创建 OTC 订单
        assert_ok!(OtcOrder::create_order(
            RuntimeOrigin::signed(BUYER),
            0,  // maker_id
            100 * DUST,
            payment_commit,
            contact_commit,
        ));
        
        // 3. 验证订单状态
        let order = OtcOrder::get_order(0).unwrap();
        assert_eq!(order.state, OrderState::Created);
    });
}
```

#### 8.3 前端集成测试

```bash
cd stardust-dapp
npm run test:integration
```

---

## 🔄 迁移策略

### 零迁移方案（推荐）

**前提条件**：
- ✅ 主网尚未上线
- ✅ 规则 9：零迁移，允许破坏式调整

**策略**：
1. **不保留旧数据**：直接部署新的独立 pallet
2. **清空测试网**：重新初始化 genesis
3. **前端同步更新**：确保前端与新 pallet 同步上线

**优势**：
- ✅ 无需编写迁移脚本
- ✅ 无数据兼容性问题
- ✅ 开发速度最快

### 数据迁移方案（如果需要）

**如果需要保留测试网数据**，可以编写迁移脚本：

```rust
// runtime/src/migrations/trading_v2.rs

pub mod v2 {
    use super::*;
    
    pub fn migrate_maker_data<T: pallet_maker::Config>() -> Weight {
        let mut weight = Weight::zero();
        
        // 从旧的 pallet-trading 迁移到新的 pallet-maker
        // 读取旧存储
        for (maker_id, old_app) in OldMakerApplications::<T>::iter() {
            // 转换数据结构
            let new_app = MakerApplication {
                owner: old_app.owner,
                deposit: old_app.deposit,
                status: old_app.status,
                // ... 其他字段
            };
            
            // 写入新存储
            pallet_maker::MakerApplications::<T>::insert(maker_id, new_app);
            
            weight = weight.saturating_add(T::DbWeight::get().reads_writes(1, 1));
        }
        
        weight
    }
}
```

---

## ⚠️ 风险评估与对策

### 风险 1：开发周期延长

**风险等级**：中  
**描述**：拆分为独立 pallet 需要 2-3 周，可能影响其他功能开发进度。

**对策**：
- ✅ 分阶段实施，优先完成 Maker 模块
- ✅ 并行开发：前端团队可以提前适配新 API
- ✅ 保留 `pallet-trading` 统一接口层，减少前端改动

### 风险 2：编译依赖循环

**风险等级**：低  
**描述**：`pallet-otc-order` 依赖 `pallet-maker`，可能出现循环依赖。

**对策**：
- ✅ 使用 trait 抽象：`MakerProvider` trait
- ✅ 在 Runtime 层实现 trait，避免直接依赖
- ✅ 参考 Substrate 官方 pallet 之间的依赖模式

### 风险 3：性能下降

**风险等级**：低  
**描述**：跨 pallet 调用可能增加 weight。

**对策**：
- ✅ Benchmarking 验证性能
- ✅ 如果统一接口层开销过大，Phase 3 可以移除
- ✅ 使用内联函数减少调用开销

### 风险 4：前端 Breaking Change

**风险等级**：中  
**描述**：前端需要更新 API 路径。

**对策**：
- ✅ 保留 `pallet-trading` 统一接口层，API 路径不变
- ✅ 提供详细的迁移文档
- ✅ 前后端同步上线

---

## 📅 时间规划

### 总体时间线：15 工作日（3 周）

| 阶段 | 任务 | 天数 | 负责人 | 产出 |
|------|------|------|--------|------|
| 1 | 准备阶段 | 3 | 链端 | 新 pallet 骨架、Cargo 配置 |
| 2 | Maker 模块迁移 | 5 | 链端 | `pallet-maker` 完成 |
| 3 | OTC 模块迁移 | 7 | 链端 | `pallet-otc-order` 完成 |
| 4 | Bridge 模块迁移 | 6 | 链端 | `pallet-bridge` 完成 |
| 5 | 统一接口层 | 2 | 链端 | `pallet-trading` 完成（可选）|
| 6 | Runtime 集成 | 3 | 链端 | Runtime 编译通过 |
| 7 | 前端适配 | 4 | 前端 | 前端 API 更新 |
| 8 | 测试与验证 | 5 | 全员 | 所有测试通过 |

**并行优化**：
- 阶段 2-4 可以部分并行（不同模块由不同开发者负责）
- 阶段 7 可以在阶段 6 完成后立即开始（无需等待阶段 8）

**实际周期**：考虑并行，可以压缩到 **2 周**。

---

## ✅ 验收标准

### 功能验收

- [ ] Maker 模块所有功能正常（申请、审核、提现）
- [ ] OTC 模块所有功能正常（创建、付款、释放、首购）
- [ ] Bridge 模块所有功能正常（官方、做市商、OCW）
- [ ] 前端所有页面正常（做市商、OTC、Bridge）

### 技术验收

- [ ] 所有 pallet 编译通过（无 warning）
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] Benchmarking 完成（权重计算正确）
- [ ] 前端集成测试通过

### 文档验收

- [ ] 每个 pallet 的 README.md 完整
- [ ] 前端 API 迁移指南完整
- [ ] 架构设计文档完整
- [ ] 测试报告完整

### 性能验收

- [ ] 跨 pallet 调用开销 < 5% (与单体 pallet 对比)
- [ ] 无性能回退
- [ ] Gas 成本优化（或至少不增加）

---

## 📚 相关文档

- [pallet-trading 重构合理性分析](./pallet-trading重构合理性分析.md)
- [pallet-trading 编译错误修复记录](./pallet-trading编译错误修复记录.md)
- [pallet-trading 重构终止报告](./pallet-trading重构终止报告.md)
- [Substrate FRAME 最佳实践](https://docs.substrate.io/reference/frame-pallets/)
- [Polkadot SDK Pallet 架构](https://paritytech.github.io/polkadot-sdk/master/frame_support/pallet/index.html)

---

## 🎯 下一步行动

### 立即执行（Week 1）

1. **召开团队会议**：确认重构方案，分配任务
2. **创建新分支**：`git checkout -b feature/pallet-refactor`
3. **阶段 1：准备**：创建新 pallet 骨架
4. **阶段 2：Maker**：开始迁移 Maker 模块

### 短期规划（Week 2）

1. 完成 Maker、OTC 模块迁移
2. 开始 Bridge 模块迁移
3. 前端团队提前适配新 API

### 中期规划（Week 3）

1. 完成 Bridge 模块、统一接口层
2. Runtime 集成与测试
3. 前端全面适配
4. 集成测试与验收

---

**方案制定人**: AI Assistant  
**审核人**: 待定  
**批准人**: 待定  
**版本**: v1.0  
**最后更新**: 2025-11-03

