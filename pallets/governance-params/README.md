# pallet-governance-params

> **治理参数集中管理模块**
>
> 版本：v0.1.0
> 状态：✅ 已实现

## 📋 概述

`pallet-governance-params` 是Stardust区块链的治理参数集中管理模块，负责统一管理所有治理相关的参数配置，包括押金、期限、费率和阈值等。

### 核心功能

- ✅ **押金参数管理**：申诉押金、投诉押金、非拥有者操作押金
- ✅ **期限参数管理**：公示期、投票期、执行延迟、投诉期
- ✅ **费率参数管理**：投诉人分配比例、委员会分配比例、拥有者分配比例
- ✅ **阈值参数管理**：提案门槛、投票通过门槛、仲裁费用门槛
- ✅ **治理调整**：所有参数变更需要治理投票
- ✅ **事件通知**：参数变更时发出事件

### 设计理念

1. **单一参数源**：所有治理参数集中在一个模块管理，避免分散和不一致
2. **治理调整**：参数变更需要通过治理投票，确保去中心化
3. **类型安全**：强类型参数定义，编译时检查
4. **向后兼容**：接口稳定，便于其他模块集成

---

## 🏗️ 架构设计

### 参数类型

#### 1. DepositParams（押金参数）

```rust
pub struct DepositParams<Balance> {
    pub base: Balance,    // 基础押金
    pub min: Balance,     // 最小押金
    pub max: Balance,     // 最大押金
    pub factor: u32,      // 押金计算因子（用于动态计算）
}
```

**用途**：
- `AppealDepositParams` - 申诉押金参数
- `ComplaintDepositParams` - 投诉押金参数
- `NonOwnerOperationDepositParams` - 非拥有者操作押金参数

#### 2. PeriodParams（期限参数）

```rust
pub struct PeriodParams<BlockNumber> {
    pub notice_period: BlockNumber,      // 公示期（区块数）
    pub voting_period: BlockNumber,      // 投票期（区块数）
    pub execution_delay: BlockNumber,    // 执行延迟（区块数）
    pub complaint_period: BlockNumber,   // 投诉期（区块数）
}
```

**用途**：定义治理流程中各个阶段的时间限制

#### 3. RateParams（费率参数）

```rust
pub struct RateParams {
    pub complainant_share: u32,    // 投诉成功时投诉人分配比例（千分之）
    pub committee_share: u32,      // 投诉成功时委员会分配比例（千分之）
    pub owner_share: u32,          // 投诉失败时拥有者分配比例（千分之）
}
```

**用途**：定义投诉押金的分配比例

#### 4. ThresholdParams（阈值参数）

```rust
pub struct ThresholdParams<Balance> {
    pub proposal_threshold: Balance,      // 提案创建门槛（代币持有量）
    pub voting_threshold: u32,            // 投票通过门槛（百分比）
    pub arbitration_threshold: Balance,   // 仲裁费用门槛
}
```

**用途**：定义参与治理的准入门槛

---

## 📖 API参考

### Extrinsics（可调用函数）

#### 1. update_appeal_deposit_params

更新申诉押金参数

```rust
pub fn update_appeal_deposit_params(
    origin: OriginFor<T>,
    new_params: DepositParams<BalanceOf<T>>,
) -> DispatchResult
```

**权限**：`GovernanceOrigin`（Root或委员会）
**参数**：
- `origin` - 治理起源
- `new_params` - 新的押金参数

**约束**：
- `min <= base <= max`

**事件**：`AppealDepositParamsUpdated`

#### 2. update_complaint_deposit_params

更新投诉押金参数

```rust
pub fn update_complaint_deposit_params(
    origin: OriginFor<T>,
    new_params: DepositParams<BalanceOf<T>>,
) -> DispatchResult
```

**权限**：`GovernanceOrigin`
**事件**：`ComplaintDepositParamsUpdated`

#### 3. update_non_owner_operation_deposit_params

更新非拥有者操作押金参数

```rust
pub fn update_non_owner_operation_deposit_params(
    origin: OriginFor<T>,
    new_params: DepositParams<BalanceOf<T>>,
) -> DispatchResult
```

**权限**：`GovernanceOrigin`
**事件**：`NonOwnerOperationDepositParamsUpdated`

#### 4. update_period_params

更新期限参数

```rust
pub fn update_period_params(
    origin: OriginFor<T>,
    new_params: PeriodParams<BlockNumberFor<T>>,
) -> DispatchResult
```

**权限**：`GovernanceOrigin`
**事件**：`PeriodParamsUpdated`

#### 5. update_rate_params

更新费率参数

```rust
pub fn update_rate_params(
    origin: OriginFor<T>,
    new_params: RateParams,
) -> DispatchResult
```

**权限**：`GovernanceOrigin`
**约束**：
- `complainant_share + committee_share <= 1000`（不超过100%）

**事件**：`RateParamsUpdated`

#### 6. update_threshold_params

更新阈值参数

```rust
pub fn update_threshold_params(
    origin: OriginFor<T>,
    new_params: ThresholdParams<BalanceOf<T>>,
) -> DispatchResult
```

**权限**：`GovernanceOrigin`
**约束**：
- `0 < voting_threshold <= 100`

**事件**：`ThresholdParamsUpdated`

### Storage Getters（存储查询）

#### 参数查询

```rust
// 获取完整参数结构
pub fn appeal_deposit_params() -> DepositParams<BalanceOf<T>>
pub fn complaint_deposit_params() -> DepositParams<BalanceOf<T>>
pub fn non_owner_operation_deposit_params() -> DepositParams<BalanceOf<T>>
pub fn period_params() -> PeriodParams<BlockNumberFor<T>>
pub fn rate_params() -> RateParams
pub fn threshold_params() -> ThresholdParams<BalanceOf<T>>
```

#### 便捷查询方法

```rust
// 押金相关
pub fn get_appeal_base_deposit() -> BalanceOf<T>
pub fn get_appeal_min_deposit() -> BalanceOf<T>
pub fn get_appeal_max_deposit() -> BalanceOf<T>
pub fn get_complaint_base_deposit() -> BalanceOf<T>
pub fn get_complaint_min_deposit() -> BalanceOf<T>
pub fn get_non_owner_operation_base_deposit() -> BalanceOf<T>

// 期限相关
pub fn get_notice_period() -> BlockNumberFor<T>
pub fn get_voting_period() -> BlockNumberFor<T>
pub fn get_execution_delay() -> BlockNumberFor<T>
pub fn get_complaint_period() -> BlockNumberFor<T>

// 费率相关
pub fn get_complainant_share() -> u32
pub fn get_committee_share() -> u32
pub fn get_owner_share() -> u32

// 阈值相关
pub fn get_proposal_threshold() -> BalanceOf<T>
pub fn get_voting_threshold() -> u32
pub fn get_arbitration_threshold() -> BalanceOf<T>
```

### Events（事件）

```rust
pub enum Event<T: Config> {
    /// 申诉押金参数已更新
    AppealDepositParamsUpdated {
        old: DepositParams<BalanceOf<T>>,
        new: DepositParams<BalanceOf<T>>,
    },
    /// 投诉押金参数已更新
    ComplaintDepositParamsUpdated {
        old: DepositParams<BalanceOf<T>>,
        new: DepositParams<BalanceOf<T>>,
    },
    /// 非拥有者操作押金参数已更新
    NonOwnerOperationDepositParamsUpdated {
        old: DepositParams<BalanceOf<T>>,
        new: DepositParams<BalanceOf<T>>,
    },
    /// 期限参数已更新
    PeriodParamsUpdated {
        old: PeriodParams<BlockNumberFor<T>>,
        new: PeriodParams<BlockNumberFor<T>>,
    },
    /// 费率参数已更新
    RateParamsUpdated {
        old: RateParams,
        new: RateParams,
    },
    /// 阈值参数已更新
    ThresholdParamsUpdated {
        old: ThresholdParams<BalanceOf<T>>,
        new: ThresholdParams<BalanceOf<T>>,
    },
}
```

### Errors（错误）

```rust
pub enum Error<T> {
    /// 无效的参数值
    InvalidParams,
    /// 无权限操作
    NoPermission,
}
```

---

## 🔧 配置与集成

### Runtime配置

```rust
// runtime/src/lib.rs

impl pallet_governance_params::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type GovernanceOrigin = EnsureRoot<AccountId>;
}

construct_runtime!(
    pub struct Runtime {
        // ... 其他pallets
        GovernanceParams: pallet_governance_params,
    }
);
```

### Genesis配置

```rust
// node/src/chain_spec.rs

governance_params: GovernanceParamsConfig {
    appeal_deposit: DepositParams {
        base: 20 * UNIT,
        min: 10 * UNIT,
        max: 100 * UNIT,
        factor: 100,
    },
    complaint_deposit: DepositParams {
        base: 5 * UNIT,
        min: 5 * UNIT,
        max: 50 * UNIT,
        factor: 100,
    },
    non_owner_operation_deposit: DepositParams {
        base: 2 * UNIT,
        min: 2 * UNIT,
        max: 10 * UNIT,
        factor: 100,
    },
    periods: PeriodParams {
        notice_period: 7 * DAYS,
        voting_period: 6 * DAYS,
        execution_delay: 2 * DAYS,
        complaint_period: 30 * DAYS,
    },
    rates: RateParams {
        complainant_share: 800, // 80%
        committee_share: 200,   // 20%
        owner_share: 800,       // 80%
    },
    thresholds: ThresholdParams {
        proposal_threshold: 100 * UNIT,
        voting_threshold: 51, // 51%
        arbitration_threshold: 50 * UNIT,
    },
},
```

### 其他模块集成

#### 示例：pallet-stardust-appeals使用

```rust
// pallets/stardust-appeals/src/lib.rs

use pallet_governance_params::Pallet as GovernanceParams;

// 原来的硬编码参数
// const BASE_DEPOSIT: Balance = 20 * UNIT;

// 迁移后从 pallet-governance-params 获取
let base_deposit = GovernanceParams::<T>::get_appeal_base_deposit();
let min_deposit = GovernanceParams::<T>::get_appeal_min_deposit();
let notice_period = GovernanceParams::<T>::get_notice_period();
```

---

## 📊 使用示例

### 示例1：通过治理投票调整押金参数

```rust
// 创建提案调整申诉押金
let call = Call::GovernanceParams(
    pallet_governance_params::Call::update_appeal_deposit_params {
        new_params: DepositParams {
            base: 30 * UNIT,  // 从20提高到30
            min: 15 * UNIT,   // 从10提高到15
            max: 150 * UNIT,  // 从100提高到150
            factor: 100,
        },
    }
);

// 提交到democracy模块
let proposal_hash = T::Hashing::hash_of(&call);
pallet_democracy::Pallet::<T>::propose(origin, proposal_hash, value)?;
```

### 示例2：查询当前参数

```rust
// 查询申诉押金
let appeal_deposit = GovernanceParams::<T>::get_appeal_base_deposit();

// 查询公示期
let notice_period = GovernanceParams::<T>::get_notice_period();

// 查询投诉人分配比例
let complainant_share = GovernanceParams::<T>::get_complainant_share();
```

### 示例3：监听参数变更事件

```rust
// 在前端监听参数变更
api.query.system.events((events) => {
    events.forEach((record) => {
        const { event } = record;
        if (event.section === 'governanceParams') {
            console.log('参数已更新:', event.method, event.data);

            if (event.method === 'AppealDepositParamsUpdated') {
                const [old, new] = event.data;
                console.log('申诉押金变更:', {
                    old: old.toJSON(),
                    new: new.toJSON(),
                });
            }
        }
    });
});
```

---

## 🧪 测试

### 单元测试

```bash
cargo test -p pallet-governance-params
```

### 集成测试

```bash
# 在runtime中测试
cargo test -p solochain-template-runtime --features runtime-benchmarks
```

---

## 📈 性能考虑

### 存储读取

- ✅ **常量时间查询**：所有参数查询都是 O(1) 的存储读取
- ✅ **无复杂计算**：getter方法直接返回存储值，无需计算
- ✅ **低Gas消耗**：参数查询消耗极少的Gas

### 更新权重

当前使用简化权重（10_000），生产环境建议：

```bash
# 运行基准测试生成精确权重
cargo run --release --features runtime-benchmarks -- benchmark pallet \
    --pallet pallet_governance_params \
    --extrinsic "*" \
    --output pallets/governance-params/src/weights.rs
```

---

## 🔒 安全考虑

### 权限控制

- ✅ **治理起源保护**：所有参数更新需要治理起源（Root或委员会）
- ✅ **参数验证**：更新时验证参数合法性（如：min <= base <= max）
- ✅ **事件记录**：所有变更都发出事件，便于审计

### 参数约束

- ✅ **押金参数**：最小 <= 基础 <= 最大
- ✅ **费率参数**：总和不超过100%
- ✅ **阈值参数**：投票门槛在0-100%范围内

---

## 🚀 迁移指南

### 从硬编码参数迁移

#### 步骤1：识别硬编码参数

```rust
// 原代码
const APPEAL_DEPOSIT: Balance = 20 * UNIT;
const NOTICE_PERIOD: BlockNumber = 7 * DAYS;
```

#### 步骤2：使用GovernanceParams

```rust
// 迁移后
use pallet_governance_params::Pallet as GovernanceParams;

let appeal_deposit = GovernanceParams::<T>::get_appeal_base_deposit();
let notice_period = GovernanceParams::<T>::get_notice_period();
```

#### 步骤3：更新Genesis配置

确保在genesis配置中设置合适的初始值。

---

## 📝 相关文档

- [Stardust治理优化实施方案](../../docs/Stardust治理优化实施方案-推荐版.md)
- [统一治理服务使用文档](../../docs/统一治理服务使用文档.md)
- [Stardust治理核心化设计](../../docs/Stardust治理核心化设计.md)

---

## 📄 许可证

Unlicense

---

## 👥 贡献者

- Stardust 开发团队

---

**版本**：v0.1.0
**最后更新**：2025-01-20
**状态**：✅ 生产就绪
