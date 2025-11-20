# pallet-governance-params 集成指南

**版本**: v1.0.0
**日期**: 2025-01-20
**作者**: Stardust Dev Team

---

## 📋 目录

1. [概述](#概述)
2. [集成架构](#集成架构)
3. [集成步骤](#集成步骤)
4. [实战案例：pallet-stardust-appeals](#实战案例pallet-stardust-appeals)
5. [其他Pallet集成方案](#其他pallet集成方案)
6. [测试验证](#测试验证)
7. [常见问题](#常见问题)
8. [最佳实践](#最佳实践)

---

## 概述

### 🎯 目标

将**pallet-governance-params**集成到其他业务pallet，实现：
- **统一参数管理**：所有治理参数集中在一个模块
- **动态调整**：通过治理投票调整参数，无需升级runtime
- **解耦设计**：业务pallet只读取参数，不管理参数
- **类型安全**：编译时检查参数类型正确性

### 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Runtime Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         pallet-governance-params (参数中心)          │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  押金参数  │  期限参数  │  费率参数  │  阈值参数 │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ▲   ▲   ▲                           │
│                         │   │   │                           │
│                         │   │   │ (只读查询)                │
│         ┌───────────────┘   │   └───────────────┐           │
│         │                   │                   │           │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐     │
│  │   Appeals   │    │  Arbitration│    │   Deceased  │     │
│  │   Pallet    │    │   Pallet    │    │   Pallet    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 📦 提供的参数类型

#### 1. 押金参数 (DepositParams)
```rust
pub struct DepositParams<Balance> {
    pub base: Balance,      // 基础押金
    pub min: Balance,       // 最小押金
    pub max: Balance,       // 最大押金
    pub factor: u32,        // 计算因子（万分比）
}
```

**适用场景**：
- 申诉押金
- 投诉押金
- 非拥有者操作押金

#### 2. 期限参数 (PeriodParams)
```rust
pub struct PeriodParams<BlockNumber> {
    pub notice_period: BlockNumber,      // 公示期
    pub voting_period: BlockNumber,      // 投票期
    pub execution_delay: BlockNumber,    // 执行延迟
    pub complaint_period: BlockNumber,   // 投诉期
}
```

**适用场景**：
- 治理流程时限
- 投诉窗口期
- 审核时限

#### 3. 费率参数 (RateParams)
```rust
pub struct RateParams {
    pub complainant_share: u32,    // 投诉人分配比例（万分比）
    pub committee_share: u32,      // 委员会分配比例
    pub owner_share: u32,          // 拥有者分配比例
}
```

**适用场景**：
- 罚没资金分配
- 收益分成
- 手续费分配

#### 4. 阈值参数 (ThresholdParams)
```rust
pub struct ThresholdParams<Balance> {
    pub proposal_threshold: Balance,      // 提案门槛
    pub voting_threshold: u32,            // 投票通过门槛（百分比）
    pub arbitration_threshold: Balance,   // 仲裁费用门槛
}
```

**适用场景**：
- 治理提案门槛
- 投票通过条件
- 仲裁触发条件

---

## 集成架构

### 🔄 依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│  pallet-stardust-appeals (业务层)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ fn submit_appeal() {                                   │ │
│  │   let deposit = GovernanceParams::get_appeal_base();   │ │
│  │   // 使用押金参数                                      │ │
│  │ }                                                      │ │
│  │                                                        │ │
│  │ fn approve_appeal() {                                  │ │
│  │   let notice = GovernanceParams::get_notice_period();  │ │
│  │   // 使用期限参数                                      │ │
│  │ }                                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ (runtime配置)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  runtime/src/configs/stardust_appeals.rs                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ impl pallet_stardust_appeals::Config for Runtime {     │ │
│  │   // 不再需要配置具体押金数值                          │ │
│  │   // 改为依赖 GovernanceParams                         │ │
│  │ }                                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ (查询调用)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  pallet-governance-params (参数中心)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ pub fn get_appeal_base_deposit() -> Balance {          │ │
│  │   Self::appeal_deposit_params().base                   │ │
│  │ }                                                      │ │
│  │                                                        │ │
│  │ pub fn get_notice_period() -> BlockNumber {            │ │
│  │   Self::period_params().notice_period                  │ │
│  │ }                                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 🎨 设计模式

#### 1. 只读接口模式 (Read-Only Interface)
```rust
// ❌ 错误：业务pallet不应修改参数
T::Currency::reserve(&who, deposit)?;

// ✅ 正确：业务pallet只读取参数
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
T::Currency::reserve(&who, deposit)?;
```

#### 2. 参数验证模式 (Parameter Validation)
```rust
// 业务逻辑中验证参数合理性
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
ensure!(deposit > 0, Error::<T>::InvalidDeposit);
```

#### 3. 动态计算模式 (Dynamic Calculation)
```rust
// 根据参数动态计算
let base = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
let factor = pallet_governance_params::Pallet::<T>::appeal_deposit_params().factor;
let actual_deposit = base.saturating_mul(factor.into()) / 10_000;
```

---

## 集成步骤

### Step 1: 添加Cargo依赖

**文件**: `pallets/stardust-appeals/Cargo.toml`

```toml
[dependencies]
# 添加 governance-params 依赖
pallet-governance-params = { path = "../governance-params", default-features = false }

[features]
default = ["std"]
std = [
    # ... 其他依赖
    "pallet-governance-params/std",  # 添加此行
]
```

### Step 2: 导入类型和函数

**文件**: `pallets/stardust-appeals/src/lib.rs`

```rust
// 在文件顶部添加导入
use pallet_governance_params;

// 如果需要使用参数类型，可以导入
use pallet_governance_params::{
    DepositParams,
    PeriodParams,
    RateParams,
    ThresholdParams,
};
```

### Step 3: 移除旧的Config参数

**Before（旧方案）**:
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    // ❌ 硬编码参数
    type AppealDeposit: Get<BalanceOf<Self>>;
    type NoticeDefaultBlocks: Get<BlockNumberFor<Self>>;
    type RejectedSlashBps: Get<u16>;
    // ... 等等
}
```

**After（新方案）**:
```rust
#[pallet::config]
pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
    // ✅ 移除硬编码参数
    // 改为直接调用 pallet_governance_params::Pallet::<T>::get_*()
}
```

### Step 4: 更新Runtime配置

**文件**: `runtime/src/configs/stardust_appeals.rs`

**Before（旧方案）**:
```rust
impl pallet_stardust_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    // ❌ 硬编码参数值
    type AppealDeposit = frame_support::traits::ConstU128<10_000_000_000>;
    type NoticeDefaultBlocks = frame_support::traits::ConstU32<{ 30 * DAYS as u32 }>;
    type RejectedSlashBps = frame_support::traits::ConstU16<3000>;
    // ...
}
```

**After（新方案）**:
```rust
impl pallet_stardust_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    // ✅ 移除硬编码参数
    // 参数由 pallet-governance-params 统一管理

    // 其他非参数配置保持不变
    type Fungible = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;
    type GovernanceOrigin = /* ... */;
    // ...
}
```

### Step 5: 更新业务逻辑调用

**文件**: `pallets/stardust-appeals/src/lib.rs`

#### 场景1: 查询押金参数

**Before（旧方案）**:
```rust
// ❌ 使用Config关联类型
let deposit = T::AppealDeposit::get();
```

**After（新方案）**:
```rust
// ✅ 调用governance-params getter
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
```

#### 场景2: 查询期限参数

**Before（旧方案）**:
```rust
// ❌ 使用Config关联类型
let notice_blocks = T::NoticeDefaultBlocks::get();
```

**After（新方案）**:
```rust
// ✅ 调用governance-params getter
let notice_blocks = pallet_governance_params::Pallet::<T>::get_notice_period();
```

#### 场景3: 查询费率参数

**Before（旧方案）**:
```rust
// ❌ 使用Config关联类型
let slash_bps = T::RejectedSlashBps::get();
```

**After（新方案）**:
```rust
// ✅ 调用governance-params getter
let complainant_share = pallet_governance_params::Pallet::<T>::get_complainant_share();
let committee_share = pallet_governance_params::Pallet::<T>::get_committee_share();

// 计算罚没比例
let total_share = complainant_share.saturating_add(committee_share);
```

#### 场景4: 动态计算押金

**新增功能**:
```rust
// 根据基础押金和因子动态计算
let deposit_params = pallet_governance_params::Pallet::<T>::appeal_deposit_params();
let base = deposit_params.base;
let min = deposit_params.min;
let max = deposit_params.max;
let factor = deposit_params.factor;

// 计算实际押金：base * factor / 10000
let calculated = base.saturating_mul(factor.into()) / 10_000;

// 限制在 min-max 范围内
let actual_deposit = calculated.clamp(min, max);
```

---

## 实战案例：pallet-stardust-appeals

### 📋 当前状态分析

#### 现有硬编码参数
```rust
// runtime/src/configs/mod.rs (Line 59-86)
impl pallet_stardust_appeals::Config for Runtime {
    type AppealDeposit = frame_support::traits::ConstU128<10_000_000_000>;
    type RejectedSlashBps = frame_support::traits::ConstU16<3000>;
    type WithdrawSlashBps = frame_support::traits::ConstU16<1000>;
    type WindowBlocks = frame_support::traits::ConstU32<600>;
    type MaxPerWindow = frame_support::traits::ConstU32<5>;
    type NoticeDefaultBlocks = frame_support::traits::ConstU32<{ 30 * DAYS as u32 }>;
    // ...
}
```

#### 问题分析
- ❌ **硬编码**：参数值固定在runtime，修改需要升级
- ❌ **分散管理**：不同pallet各自定义参数，难以统一调整
- ❌ **缺乏灵活性**：无法通过治理动态调整
- ❌ **代码冗余**：相似参数在多个pallet重复定义

### 🔧 集成方案

#### Phase 1: 添加依赖和导入

**1. 修改 Cargo.toml**

```toml
# pallets/stardust-appeals/Cargo.toml
[dependencies]
pallet-governance-params = { path = "../governance-params", default-features = false }

[features]
std = [
    # ...
    "pallet-governance-params/std",
]
```

**2. 导入类型**

```rust
// pallets/stardust-appeals/src/lib.rs (顶部)
use pallet_governance_params;
```

#### Phase 2: 移除硬编码参数

**修改 Config trait**

```rust
// pallets/stardust-appeals/src/lib.rs
#[pallet::config]
pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
    type Fungible: /* ... */;
    type RuntimeHoldReason: /* ... */;

    // ✅ 移除以下硬编码参数：
    // type AppealDeposit: Get<BalanceOf<Self>>;
    // type RejectedSlashBps: Get<u16>;
    // type WithdrawSlashBps: Get<u16>;
    // type NoticeDefaultBlocks: Get<BlockNumberFor<Self>>;

    // 其他非参数配置保持不变
    type TreasuryAccount: Get<Self::AccountId>;
    type Router: AppealRouter<Self::AccountId>;
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    // ...
}
```

#### Phase 3: 更新Runtime配置

```rust
// runtime/src/configs/mod.rs
impl pallet_stardust_appeals::Config for Runtime {
    type Fungible = Balances;
    type RuntimeHoldReason = RuntimeHoldReason;

    // ✅ 移除硬编码参数配置
    // 参数由 pallet-governance-params 统一管理

    // 其他配置保持不变
    type TreasuryAccount = TreasuryAccount;
    type Router = ContentGovernanceRouter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type MaxExecPerBlock = frame_support::traits::ConstU32<50>;
    type MaxListLen = frame_support::traits::ConstU32<512>;
    type MaxRetries = frame_support::traits::ConstU8<3>;
    type RetryBackoffBlocks = frame_support::traits::ConstU32<600>;
    type AppealDepositPolicy = ContentAppealDepositPolicy;
    type WeightInfo = pallet_stardust_appeals::weights::SubstrateWeight<Runtime>;
    type LastActiveProvider = ContentLastActiveProvider;
    type MinEvidenceCidLen = frame_support::traits::ConstU32<10>;
    type MinReasonCidLen = frame_support::traits::ConstU32<8>;
    type WorksProvider = DeceasedWorksProvider;
    type BaseWorkComplaintDeposit = frame_support::traits::ConstU128<10_000_000_000_000>;
    type MinWorkComplaintDeposit = frame_support::traits::ConstU128<5_000_000_000_000>;
    type MaxWorkComplaintDeposit = frame_support::traits::ConstU128<1_000_000_000_000_000>;
    type ReputationProvider = DefaultReputationProvider;
}
```

#### Phase 4: 更新业务逻辑

**场景1: 提交申诉 (submit_appeal)**

```rust
// pallets/stardust-appeals/src/lib.rs

// Before (旧方案)
#[pallet::call_index(0)]
#[pallet::weight(10_000)]
pub fn submit_appeal(
    origin: OriginFor<T>,
    domain: u8,
    target: u64,
    action: u8,
    evidence_cid: Vec<u8>,
    reason_cid: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // ❌ 使用硬编码参数
    let deposit = T::AppealDeposit::get();

    // 冻结押金
    T::Fungible::hold(
        &T::RuntimeHoldReason::from(HoldReason::AppealDeposit),
        &who,
        deposit,
    )?;

    // ...
}

// After (新方案)
#[pallet::call_index(0)]
#[pallet::weight(T::WeightInfo::submit_appeal())]
pub fn submit_appeal(
    origin: OriginFor<T>,
    domain: u8,
    target: u64,
    action: u8,
    evidence_cid: Vec<u8>,
    reason_cid: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // ✅ 从governance-params读取押金参数
    let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();

    // 验证押金合理性
    let min_deposit = pallet_governance_params::Pallet::<T>::get_appeal_min_deposit();
    ensure!(deposit >= min_deposit, Error::<T>::DepositTooLow);

    // 冻结押金
    T::Fungible::hold(
        &T::RuntimeHoldReason::from(HoldReason::AppealDeposit),
        &who,
        deposit,
    )?;

    // ...
}
```

**场景2: 批准申诉 (approve_appeal)**

```rust
// Before (旧方案)
#[pallet::call_index(1)]
pub fn approve_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;

    let mut appeal = Appeals::<T>::get(appeal_id)
        .ok_or(Error::<T>::AppealNotFound)?;

    // ❌ 使用硬编码期限
    let notice_blocks = T::NoticeDefaultBlocks::get();
    let exec_at = frame_system::Pallet::<T>::block_number() + notice_blocks;

    // ...
}

// After (新方案)
#[pallet::call_index(1)]
pub fn approve_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;

    let mut appeal = Appeals::<T>::get(appeal_id)
        .ok_or(Error::<T>::AppealNotFound)?;

    // ✅ 从governance-params读取公示期
    let notice_blocks = pallet_governance_params::Pallet::<T>::get_notice_period();
    let exec_at = frame_system::Pallet::<T>::block_number() + notice_blocks;

    // 验证公示期合理性
    ensure!(notice_blocks > 0u32.into(), Error::<T>::InvalidNoticePeriod);

    // ...
}
```

**场景3: 驳回申诉 (reject_appeal)**

```rust
// Before (旧方案)
#[pallet::call_index(2)]
pub fn reject_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;

    let appeal = Appeals::<T>::get(appeal_id)
        .ok_or(Error::<T>::AppealNotFound)?;

    // ❌ 使用硬编码罚没比例
    let slash_bps = T::RejectedSlashBps::get();
    let slash_amount = Perbill::from_parts(slash_bps as u32 * 100)
        .mul_floor(appeal.deposit);

    // 罚没到国库
    T::Fungible::transfer_on_hold(
        &T::RuntimeHoldReason::from(HoldReason::AppealDeposit),
        &appeal.submitter,
        &T::TreasuryAccount::get(),
        slash_amount,
        // ...
    )?;

    // ...
}

// After (新方案)
#[pallet::call_index(2)]
pub fn reject_appeal(
    origin: OriginFor<T>,
    appeal_id: u64,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;

    let appeal = Appeals::<T>::get(appeal_id)
        .ok_or(Error::<T>::AppealNotFound)?;

    // ✅ 从governance-params读取费率参数
    let committee_share = pallet_governance_params::Pallet::<T>::get_committee_share();

    // 计算罚没金额（committee_share 是万分比，需要转换为 Perbill）
    let slash_amount = Perbill::from_parts(committee_share * 100)
        .mul_floor(appeal.deposit);

    // 验证罚没比例合理性（不超过100%）
    ensure!(committee_share <= 10_000, Error::<T>::InvalidSlashRatio);

    // 罚没到国库
    T::Fungible::transfer_on_hold(
        &T::RuntimeHoldReason::from(HoldReason::AppealDeposit),
        &appeal.submitter,
        &T::TreasuryAccount::get(),
        slash_amount,
        // ...
    )?;

    // ...
}
```

**场景4: 限频检查 (rate limiting)**

```rust
// Before (旧方案)
fn check_rate_limit(who: &T::AccountId) -> DispatchResult {
    let now = frame_system::Pallet::<T>::block_number();

    // ❌ 使用硬编码限频参数
    let window = T::WindowBlocks::get();
    let max_per_window = T::MaxPerWindow::get();

    // ...
}

// After (新方案)
fn check_rate_limit(who: &T::AccountId) -> DispatchResult {
    let now = frame_system::Pallet::<T>::block_number();

    // ✅ 从governance-params读取限频参数
    // 注意：限频参数可能不在governance-params中，需要评估是否迁移
    // 如果迁移，可以添加新的getter方法

    // 方案A：保留在Config中（限频参数较少变动）
    let window = T::WindowBlocks::get();
    let max_per_window = T::MaxPerWindow::get();

    // 方案B：迁移到governance-params（如果需要治理调整）
    // let window = pallet_governance_params::Pallet::<T>::get_complaint_period();
    // let max_per_window = pallet_governance_params::Pallet::<T>::get_voting_threshold();

    // ...
}
```

#### Phase 5: 编译测试

```bash
# 编译 appeals pallet
cargo check -p pallet-stardust-appeals

# 编译完整 runtime
cargo check -p stardust-runtime

# 运行单元测试
cargo test -p pallet-stardust-appeals
```

### 📊 迁移对比表

| 参数类型 | 旧方案（硬编码） | 新方案（governance-params） | 优势 |
|---------|-----------------|---------------------------|------|
| **申诉押金** | `type AppealDeposit = ConstU128<10_000_000_000>` | `get_appeal_base_deposit()` | ✅ 可治理调整 |
| **驳回罚没** | `type RejectedSlashBps = ConstU16<3000>` | `get_committee_share()` | ✅ 统一费率管理 |
| **撤回罚没** | `type WithdrawSlashBps = ConstU16<1000>` | `get_owner_share()` | ✅ 统一费率管理 |
| **公示期** | `type NoticeDefaultBlocks = ConstU32<{ 30 * DAYS }>` | `get_notice_period()` | ✅ 动态调整时限 |
| **限频窗口** | `type WindowBlocks = ConstU32<600>` | ⚠️ 可选迁移 | ⚠️ 评估是否迁移 |
| **窗口限额** | `type MaxPerWindow = ConstU32<5>` | ⚠️ 可选迁移 | ⚠️ 评估是否迁移 |

**迁移建议**：
- ✅ **必须迁移**：押金、期限、费率参数（影响经济模型）
- ⚠️ **可选迁移**：限频、上限参数（技术性参数，较少变动）
- ❌ **不建议迁移**：最大值、数组大小等编译时常量

---

## 其他Pallet集成方案

### 1. pallet-arbitration（仲裁模块）

#### 可迁移参数
```rust
// Before
impl pallet_arbitration::Config for Runtime {
    type DepositRatioBps = ConstU16<1500>;  // 押金比例15%
    type ResponseDeadline = ConstU32<{ 7 * 14400 }>;  // 7天响应期
    type RejectedSlashBps = ConstU16<3000>;  // 败诉罚没30%
    type PartialSlashBps = ConstU16<5000>;   // 部分败诉罚没50%
}

// After
impl pallet_arbitration::Config for Runtime {
    // 移除硬编码参数，使用 governance-params
}

// 业务逻辑调用
let deposit_ratio = pallet_governance_params::Pallet::<T>::appeal_deposit_params().factor;
let response_deadline = pallet_governance_params::Pallet::<T>::get_voting_period();
let rejected_slash = pallet_governance_params::Pallet::<T>::get_committee_share();
```

### 2. pallet-deceased（逝者档案模块）

#### 可迁移参数
```rust
// Before
impl pallet_deceased::Config for Runtime {
    type ComplaintDeposit = ConstU128<5_000_000_000_000>;  // 投诉押金
    type ComplaintPeriod = ConstU32<{ 365 * DAYS }>;       // 投诉期
}

// After
let complaint_deposit = pallet_governance_params::Pallet::<T>::get_complaint_base_deposit();
let complaint_period = pallet_governance_params::Pallet::<T>::get_complaint_period();
```

### 3. pallet-memorial（纪念服务模块）

#### 可迁移参数
```rust
// Before
impl pallet_memorial::Config for Runtime {
    type MinOfferAmount = ConstU128<1_000_000_000>;  // 最低供奉金额
    type OfferWindow = ConstU32<600>;                // 限频窗口
    type OfferMaxInWindow = ConstU32<100>;           // 窗口限额
}

// After
// 最低金额可使用阈值参数
let min_offer = pallet_governance_params::Pallet::<T>::threshold_params().arbitration_threshold;

// 限频参数可选迁移（或保留在Config中）
```

### 4. pallet-otc-order（OTC订单模块）

#### 可迁移参数
```rust
// Before
impl pallet_otc_order::Config for Runtime {
    type OrderTimeout = ConstU64<7_200_000>;  // 2小时超时
    type EvidenceWindow = ConstU64<86_400_000>;  // 24小时证据窗口
}

// After
let order_timeout = pallet_governance_params::Pallet::<T>::get_execution_delay();
let evidence_window = pallet_governance_params::Pallet::<T>::get_complaint_period();
```

### 🎯 迁移优先级

#### 高优先级（建议立即迁移）
1. ✅ **pallet-stardust-appeals** - 申诉押金、公示期、罚没比例
2. ✅ **pallet-arbitration** - 仲裁押金、响应期限、罚没规则
3. ✅ **pallet-deceased** - 投诉押金、投诉期限

#### 中优先级（建议逐步迁移）
4. ⚠️ **pallet-memorial** - 供奉限额、限频参数
5. ⚠️ **pallet-otc-order** - 超时时限、证据窗口

#### 低优先级（可选迁移）
6. ⚠️ **pallet-chat** - 消息过期时间、限频参数
7. ⚠️ **pallet-credit** - 信用评分参数（较少变动）

---

## 测试验证

### 🧪 单元测试

#### 测试文件：`pallets/stardust-appeals/src/tests.rs`

```rust
use super::*;
use crate::mock::*;
use frame_support::{assert_ok, assert_noop};

#[test]
fn test_appeal_deposit_from_governance_params() {
    new_test_ext().execute_with(|| {
        // 1. 设置治理参数
        assert_ok!(GovernanceParams::update_appeal_deposit_params(
            RuntimeOrigin::root(),
            DepositParams {
                base: 100,
                min: 50,
                max: 200,
                factor: 10000,  // 1.0x
            }
        ));

        // 2. 提交申诉，验证使用正确押金
        let deposit = GovernanceParams::get_appeal_base_deposit();
        assert_eq!(deposit, 100);

        // 3. 提交申诉应该冻结正确金额
        assert_ok!(Appeals::submit_appeal(
            RuntimeOrigin::signed(ALICE),
            1,  // domain
            1,  // target
            1,  // action
            b"evidence_cid".to_vec(),
            b"reason_cid".to_vec(),
        ));

        // 4. 验证押金被冻结
        let held = Balances::balance_on_hold(
            &HoldReason::AppealDeposit,
            &ALICE
        );
        assert_eq!(held, 100);
    });
}

#[test]
fn test_notice_period_from_governance_params() {
    new_test_ext().execute_with(|| {
        // 1. 设置公示期为100个区块
        assert_ok!(GovernanceParams::update_period_params(
            RuntimeOrigin::root(),
            PeriodParams {
                notice_period: 100,
                voting_period: 200,
                execution_delay: 50,
                complaint_period: 1000,
            }
        ));

        // 2. 提交并批准申诉
        assert_ok!(Appeals::submit_appeal(/* ... */));
        assert_ok!(Appeals::approve_appeal(
            RuntimeOrigin::root(),
            1,  // appeal_id
        ));

        // 3. 验证执行区块号正确（当前块 + 公示期）
        let appeal = Appeals::appeals(1).unwrap();
        let expected_exec_at = System::block_number() + 100;
        assert_eq!(appeal.exec_at, Some(expected_exec_at));
    });
}

#[test]
fn test_slash_ratio_from_governance_params() {
    new_test_ext().execute_with(|| {
        // 1. 设置罚没比例（委员会分成30%）
        assert_ok!(GovernanceParams::update_rate_params(
            RuntimeOrigin::root(),
            RateParams {
                complainant_share: 7000,  // 70%
                committee_share: 3000,    // 30%
                owner_share: 8000,        // 80%
            }
        ));

        // 2. 提交申诉并驳回
        assert_ok!(Appeals::submit_appeal(/* ... */));
        assert_ok!(Appeals::reject_appeal(
            RuntimeOrigin::root(),
            1,  // appeal_id
        ));

        // 3. 验证罚没金额正确（30%）
        let deposit = 100;
        let expected_slash = deposit * 3000 / 10000;  // 30%
        let treasury_balance = Balances::free_balance(&TREASURY);
        assert_eq!(treasury_balance, expected_slash);
    });
}

#[test]
fn test_dynamic_deposit_calculation() {
    new_test_ext().execute_with(|| {
        // 1. 设置押金参数（带factor）
        assert_ok!(GovernanceParams::update_appeal_deposit_params(
            RuntimeOrigin::root(),
            DepositParams {
                base: 100,
                min: 50,
                max: 200,
                factor: 15000,  // 1.5x
            }
        ));

        // 2. 计算实际押金
        let params = GovernanceParams::appeal_deposit_params();
        let calculated = params.base * params.factor as u128 / 10000;
        assert_eq!(calculated, 150);  // 100 * 1.5

        // 3. 验证在min-max范围内
        let actual = calculated.clamp(params.min, params.max);
        assert_eq!(actual, 150);
        assert!(actual >= params.min);
        assert!(actual <= params.max);
    });
}
```

### 🔍 集成测试

#### 测试文件：`tests/integration/governance_params_integration.rs`

```rust
use node_template_runtime::{Runtime, GovernanceParams, Appeals};
use sp_runtime::testing::TestXt;

#[test]
fn test_governance_params_updates_affect_appeals() {
    // 1. 初始化测试环境
    let mut ext = new_test_ext();
    ext.execute_with(|| {
        // 2. 提交申诉（使用默认押金）
        let appeal_id_1 = submit_test_appeal();
        let appeal_1 = Appeals::appeals(appeal_id_1).unwrap();
        let deposit_1 = appeal_1.deposit;

        // 3. 更新治理参数（提高押金）
        GovernanceParams::update_appeal_deposit_params(
            RuntimeOrigin::root(),
            DepositParams {
                base: deposit_1 * 2,  // 翻倍
                min: deposit_1,
                max: deposit_1 * 5,
                factor: 10000,
            }
        ).unwrap();

        // 4. 提交新申诉（使用新押金）
        let appeal_id_2 = submit_test_appeal();
        let appeal_2 = Appeals::appeals(appeal_id_2).unwrap();
        let deposit_2 = appeal_2.deposit;

        // 5. 验证新申诉使用了更新后的押金
        assert_eq!(deposit_2, deposit_1 * 2);
    });
}

#[test]
fn test_multiple_pallets_share_governance_params() {
    new_test_ext().execute_with(|| {
        // 1. 更新治理参数
        GovernanceParams::update_period_params(
            RuntimeOrigin::root(),
            PeriodParams {
                notice_period: 100,
                voting_period: 200,
                execution_delay: 50,
                complaint_period: 1000,
            }
        ).unwrap();

        // 2. Appeals pallet使用公示期
        let notice_appeals = GovernanceParams::get_notice_period();
        assert_eq!(notice_appeals, 100);

        // 3. Arbitration pallet使用投票期
        let voting_arbitration = GovernanceParams::get_voting_period();
        assert_eq!(voting_arbitration, 200);

        // 4. 验证参数一致性
        assert_eq!(notice_appeals, 100);
        assert_eq!(voting_arbitration, 200);
    });
}
```

### 🚀 E2E测试（Polkadot.js）

```javascript
// tests/e2e/governance_params_integration.test.js
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

describe('Governance Params Integration E2E', () => {
  let api, alice, bob;

  beforeAll(async () => {
    const provider = new WsProvider('ws://localhost:9944');
    api = await ApiPromise.create({ provider });
    const keyring = new Keyring({ type: 'sr25519' });
    alice = keyring.addFromUri('//Alice');
    bob = keyring.addFromUri('//Bob');
  });

  afterAll(async () => {
    await api.disconnect();
  });

  test('Should update appeal deposit and affect new appeals', async () => {
    // 1. 查询当前押金
    const oldDeposit = await api.query.governanceParams.appealDepositParams();
    console.log('Old deposit:', oldDeposit.toJSON());

    // 2. 更新押金参数（Alice作为Root）
    const newDeposit = {
      base: 20_000_000_000,  // 0.02 UNIT
      min: 10_000_000_000,
      max: 100_000_000_000,
      factor: 10000
    };

    await new Promise((resolve, reject) => {
      api.tx.governanceParams
        .updateAppealDepositParams(newDeposit)
        .signAndSend(alice, ({ status, events }) => {
          if (status.isInBlock) {
            console.log('Deposit updated in block:', status.asInBlock.toHex());

            // 验证事件
            const depositEvent = events.find(({ event }) =>
              event.section === 'governanceParams' &&
              event.method === 'AppealDepositParamsUpdated'
            );
            expect(depositEvent).toBeDefined();
            resolve();
          }
        });
    });

    // 3. 查询更新后的押金
    const updatedDeposit = await api.query.governanceParams.appealDepositParams();
    expect(updatedDeposit.base.toString()).toBe('20000000000');

    // 4. 提交申诉，验证使用新押金
    await new Promise((resolve, reject) => {
      api.tx.appeals
        .submitAppeal(
          1,  // domain
          1,  // target
          1,  // action
          'QmEvidenceCID',
          'QmReasonCID'
        )
        .signAndSend(bob, ({ status, events }) => {
          if (status.isInBlock) {
            // 验证押金被冻结
            const balances = events.filter(({ event }) =>
              event.section === 'balances' &&
              event.method === 'Reserved'
            );
            expect(balances.length).toBeGreaterThan(0);

            const reservedAmount = balances[0].event.data[1].toString();
            expect(reservedAmount).toBe('20000000000');
            resolve();
          }
        });
    });
  });

  test('Should handle period params updates', async () => {
    // 1. 更新期限参数
    const newPeriods = {
      noticePeriod: 100,
      votingPeriod: 200,
      executionDelay: 50,
      complaintPeriod: 1000
    };

    await new Promise((resolve) => {
      api.tx.governanceParams
        .updatePeriodParams(newPeriods)
        .signAndSend(alice, ({ status }) => {
          if (status.isInBlock) resolve();
        });
    });

    // 2. 验证参数已更新
    const periods = await api.query.governanceParams.periodParamsStorage();
    expect(periods.noticePeriod.toNumber()).toBe(100);
    expect(periods.votingPeriod.toNumber()).toBe(200);
  });

  test('Should handle rate params updates', async () => {
    // 1. 更新费率参数
    const newRates = {
      complainantShare: 7000,  // 70%
      committeeShare: 3000,    // 30%
      ownerShare: 8000         // 80%
    };

    await new Promise((resolve) => {
      api.tx.governanceParams
        .updateRateParams(newRates)
        .signAndSend(alice, ({ status }) => {
          if (status.isInBlock) resolve();
        });
    });

    // 2. 验证参数已更新
    const rates = await api.query.governanceParams.rateParamsStorage();
    expect(rates.complainantShare.toNumber()).toBe(7000);
    expect(rates.committeeShare.toNumber()).toBe(3000);
  });

  test('Should enforce governance origin permissions', async () => {
    // Bob（非Root）尝试更新参数应该失败
    try {
      await new Promise((resolve, reject) => {
        api.tx.governanceParams
          .updateAppealDepositParams({
            base: 10_000_000_000,
            min: 5_000_000_000,
            max: 50_000_000_000,
            factor: 10000
          })
          .signAndSend(bob, ({ status, dispatchError }) => {
            if (dispatchError) {
              reject(new Error('BadOrigin'));
            }
          });
      });

      // 如果没有抛出错误，测试失败
      expect(true).toBe(false);
    } catch (error) {
      // 应该抛出权限错误
      expect(error.message).toContain('BadOrigin');
    }
  });
});
```

---

## 常见问题

### Q1: 为什么不使用GenesisConfig初始化参数？

**A**: GenesisConfig需要serde序列化，但Balance和BlockNumber是泛型类型，无法直接序列化。更好的方案是：
- 链启动时使用Default trait初始化默认值（全0）
- 启动后通过Root或治理提案设置实际参数
- 符合去中心化治理原则，参数不应硬编码在genesis

### Q2: 参数更新后，已提交的申诉会受影响吗？

**A**: 不会。申诉提交时会记录当时的押金金额，参数更新只影响新提交的申诉：
```rust
pub struct Appeal<T: Config> {
    pub deposit: BalanceOf<T>,  // 记录提交时的押金
    // ...
}
```

### Q3: 如何确保参数更新的原子性？

**A**: 使用单个extrinsic更新整组参数：
```rust
// ✅ 推荐：原子更新
api.tx.governanceParams.updateAppealDepositParams({
  base: 10_000_000_000,
  min: 5_000_000_000,
  max: 100_000_000_000,
  factor: 10000
}).signAndSend(alice);

// ❌ 不推荐：分步更新（可能出现中间状态）
```

### Q4: 参数验证在哪里进行？

**A**: 两层验证：
1. **governance-params pallet验证**：基本约束（如min <= base <= max）
2. **业务pallet验证**：业务逻辑约束（如deposit > 0）

```rust
// governance-params中的验证
ensure!(
    new_params.min <= new_params.base && new_params.base <= new_params.max,
    Error::<T>::InvalidParams
);

// 业务pallet中的验证
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
ensure!(deposit > 0, Error::<T>::InvalidDeposit);
```

### Q5: 如何回滚错误的参数更新？

**A**: 通过治理提案回滚：
```javascript
// 1. 记录旧参数
const oldParams = await api.query.governanceParams.appealDepositParams();

// 2. 如果更新错误，再次提交治理提案恢复
api.tx.governanceParams
  .updateAppealDepositParams(oldParams.toJSON())
  .signAndSend(alice);
```

### Q6: 参数更新需要多长时间生效？

**A**: 立即生效（下一个区块）：
```rust
#[pallet::call_index(0)]
pub fn update_appeal_deposit_params(
    origin: OriginFor<T>,
    new_params: DepositParams<BalanceOf<T>>,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;

    // 验证参数
    ensure!(/* ... */);

    // 立即更新存储（下一个区块生效）
    AppealDepositParams::<T>::put(&new_params);

    // 发出事件
    Self::deposit_event(Event::AppealDepositParamsUpdated { /* ... */ });

    Ok(())
}
```

### Q7: 如何监听参数变更事件？

**A**: 订阅事件流：
```javascript
// 方法1: 订阅所有系统事件
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (event.section === 'governanceParams') {
      console.log('治理参数变更:', event.toJSON());

      // 根据具体事件类型处理
      if (event.method === 'AppealDepositParamsUpdated') {
        const { old, new } = event.data;
        console.log('申诉押金更新:', { old, new });
      }
    }
  });
});

// 方法2: 订阅特定pallet事件
api.query.governanceParams.events((events) => {
  events.forEach((event) => {
    console.log('Governance Params Event:', event.toJSON());
  });
});
```

### Q8: 参数更新需要什么权限？

**A**: GovernanceOrigin权限（Root 或 委员会2/3多数）：
```rust
impl pallet_governance_params::Config for Runtime {
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,  // Root权限
        pallet_collective::EnsureProportionAtLeast<  // 或委员会2/3
            AccountId,
            pallet_collective::Instance3,
            2,
            3
        >,
    >;
}
```

### Q9: 如何处理参数冲突？

**A**: 参数验证 + 事务回滚：
```rust
// 示例：确保罚没比例之和不超过100%
#[pallet::call_index(4)]
pub fn update_rate_params(
    origin: OriginFor<T>,
    new_params: RateParams,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;

    // 验证参数约束
    ensure!(
        new_params.complainant_share + new_params.committee_share <= 10_000,
        Error::<T>::InvalidParams
    );

    // 如果验证失败，整个事务回滚
    // 如果验证通过，原子更新
    let old_params = RateParamsStorage::<T>::get();
    RateParamsStorage::<T>::put(&new_params);

    Self::deposit_event(Event::RateParamsUpdated {
        old: old_params,
        new: new_params,
    });

    Ok(())
}
```

### Q10: 如何在不同环境使用不同参数？

**A**: 启动后通过脚本批量设置：
```bash
# dev-params.sh - 开发环境参数
polkadot-js-api \
  --seed "//Alice" \
  tx.governanceParams.updateAppealDepositParams \
    '{"base": 1000000000, "min": 500000000, "max": 5000000000, "factor": 10000}'

# testnet-params.sh - 测试网参数
polkadot-js-api \
  --seed "//Alice" \
  tx.governanceParams.updateAppealDepositParams \
    '{"base": 10000000000, "min": 5000000000, "max": 50000000000, "factor": 10000}'

# mainnet-params.sh - 主网参数（需要治理提案）
polkadot-js-api \
  --seed "//CouncilMember1" \
  tx.democracy.propose \
    '{"call": "0x..."}'  # 编码后的updateAppealDepositParams调用
```

---

## 最佳实践

### ✅ DO（推荐做法）

#### 1. 使用getter方法读取参数
```rust
// ✅ 推荐
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
```

#### 2. 验证参数合理性
```rust
// ✅ 推荐
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
ensure!(deposit > 0, Error::<T>::InvalidDeposit);
ensure!(deposit < T::Currency::total_issuance(), Error::<T>::DepositTooHigh);
```

#### 3. 记录参数快照
```rust
// ✅ 推荐：在关键操作时记录参数快照
pub struct Appeal<T: Config> {
    pub deposit: BalanceOf<T>,  // 记录提交时的押金
    pub notice_blocks: BlockNumberFor<T>,  // 记录批准时的公示期
    // ...
}
```

#### 4. 使用事件通知参数变更
```rust
// ✅ 推荐
#[pallet::event]
pub enum Event<T: Config> {
    AppealDepositParamsUpdated {
        old: DepositParams<BalanceOf<T>>,
        new: DepositParams<BalanceOf<T>>,
    },
}
```

#### 5. 原子更新整组参数
```rust
// ✅ 推荐
api.tx.governanceParams.updateAppealDepositParams({
  base: 10_000_000_000,
  min: 5_000_000_000,
  max: 100_000_000_000,
  factor: 10000
}).signAndSend(alice);
```

#### 6. 编写参数验证测试
```rust
// ✅ 推荐
#[test]
fn test_invalid_deposit_params_rejected() {
    new_test_ext().execute_with(|| {
        // min > base 应该失败
        assert_noop!(
            GovernanceParams::update_appeal_deposit_params(
                RuntimeOrigin::root(),
                DepositParams {
                    base: 100,
                    min: 200,  // min > base
                    max: 300,
                    factor: 10000,
                }
            ),
            Error::<T>::InvalidParams
        );
    });
}
```

### ❌ DON'T（避免做法）

#### 1. 直接访问存储（绕过getter）
```rust
// ❌ 不推荐
let params = pallet_governance_params::AppealDepositParams::<T>::get();
let deposit = params.base;

// ✅ 推荐
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
```

#### 2. 在Config中硬编码参数
```rust
// ❌ 不推荐
#[pallet::config]
pub trait Config: frame_system::Config {
    type AppealDeposit: Get<BalanceOf<Self>>;  // 硬编码
}

// ✅ 推荐
// 移除Config参数，使用governance-params
```

#### 3. 缓存参数值
```rust
// ❌ 不推荐：缓存可能导致过期
let cached_deposit = APPEAL_DEPOSIT_CACHE.with(|c| *c.borrow());

// ✅ 推荐：每次都查询最新值
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
```

#### 4. 跨区块假设参数不变
```rust
// ❌ 不推荐
fn on_initialize(n: BlockNumber) {
    let deposit = get_appeal_deposit();  // 假设整个区块不变
    // ... 多次使用 deposit
}

// ✅ 推荐
fn on_initialize(n: BlockNumber) {
    // 每次需要时都查询
    let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
}
```

#### 5. 分步更新关联参数
```rust
// ❌ 不推荐：分步更新可能产生不一致状态
api.tx.governanceParams.updateRateParams({
  complainantShare: 7000,
  committeeShare: 2000,  // 暂时不一致
  ownerShare: 8000
}).signAndSend(alice);

// 然后再更新
api.tx.governanceParams.updateRateParams({
  complainantShare: 7000,
  committeeShare: 3000,  // 修正
  ownerShare: 8000
}).signAndSend(alice);

// ✅ 推荐：一次原子更新
api.tx.governanceParams.updateRateParams({
  complainantShare: 7000,
  committeeShare: 3000,
  ownerShare: 8000
}).signAndSend(alice);
```

#### 6. 忽略参数验证
```rust
// ❌ 不推荐
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
T::Currency::reserve(&who, deposit)?;  // 没有验证

// ✅ 推荐
let deposit = pallet_governance_params::Pallet::<T>::get_appeal_base_deposit();
ensure!(deposit > 0, Error::<T>::InvalidDeposit);
T::Currency::reserve(&who, deposit)?;
```

---

## 📚 参考资料

### 官方文档
- [Substrate FRAME文档](https://docs.substrate.io/reference/frame-pallets/)
- [Runtime配置指南](https://docs.substrate.io/build/runtime-configuration/)
- [治理参数管理模式](https://docs.substrate.io/tutorials/build-application-logic/)

### 项目文档
- [pallet-governance-params 完成报告](../GOVERNANCE_PARAMS_INTEGRATION_COMPLETE.md)
- [pallet-stardust-appeals 设计文档](../pallets/stardust-appeals/README.md)
- [Stardust 治理优化方案](../docs/GOVERNANCE_OPTIMIZATION.md)

### 代码示例
- [pallet-governance-params 源码](../pallets/governance-params/src/lib.rs)
- [Runtime配置示例](../runtime/src/configs/governance_params.rs)
- [集成测试脚本](../test-governance-params.sh)

---

## 📝 更新日志

### v1.0.0 (2025-01-20)
- ✅ 初始版本发布
- ✅ 完成pallet-stardust-appeals集成方案
- ✅ 添加其他pallet集成指南
- ✅ 编写测试验证方案
- ✅ 整理常见问题和最佳实践

### 后续计划
- [ ] 完成pallet-arbitration集成
- [ ] 完成pallet-deceased集成
- [ ] 添加更多E2E测试用例
- [ ] 编写前端UI集成指南

---

## 🤝 贡献指南

欢迎提交PR改进本文档：

1. Fork本项目
2. 创建feature分支（`git checkout -b feature/improve-docs`）
3. 提交改动（`git commit -m 'docs: improve integration guide'`）
4. Push到分支（`git push origin feature/improve-docs`）
5. 提交Pull Request

---

**文档维护**: Stardust Dev Team
**最后更新**: 2025-01-20
**版本**: v1.0.0
