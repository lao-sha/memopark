# Pallet Affiliate Config（简化版 Phase 1）

## 概述

`pallet-affiliate-config` 是 Memopark 分成系统的配置管理模块（简化版 Phase 1），提供动态切换不同结算模式的功能。

## 核心功能

### 1. 三种结算模式

#### 即时分成模式（Instant）**【默认模式】**
- **特点**：实时转账分成
- **优势**：零延迟，用户体验好
- **成本**：Gas 成本较高
- **实现**：由 `pallet-affiliate-instant` 提供
- **默认**：系统启动时的默认结算模式

#### 周结算模式（Weekly）
- **特点**：托管式批量结算
- **优势**：Gas 成本低，适合高频交易
- **延迟**：约1周
- **实现**：由 `pallet-memo-affiliate` 提供

#### 混合模式（Hybrid）
- **特点**：分层处理，前N层即时，后续层周结算
- **配置**：`instant_levels + weekly_levels <= 15`
- **优势**：平衡成本与体验
- **适用**：大部分业务场景

### 2. 治理功能

- **委员会治理**：通过委员会 2/3 多数投票切换结算模式（也支持 Root 紧急通道）
- **参数验证**：自动验证混合模式参数合法性
- **切换历史**：记录所有模式切换，便于审计

### 3. 统计与监控

- **使用次数统计**：每种模式的使用次数
- **金额统计**：每种模式累计分配金额
- **切换历史**：最近100次模式切换记录

## 架构设计

### Provider Traits（解耦设计）

```rust
/// 周结算提供者
pub trait WeeklyAffiliateProvider<AccountId, Balance> {
    fn escrow_and_record(who: &AccountId, amount: Balance, referrer_code: &[u8]) -> DispatchResult;
}

/// 即时分成提供者
pub trait InstantAffiliateProvider<AccountId, Balance> {
    fn distribute_instant(buyer: &AccountId, amount: Balance, referrer: &AccountId, max_levels: u8) -> DispatchResult;
}

/// 会员信息提供者
pub trait MembershipProvider<AccountId> {
    fn get_referral_levels(who: &AccountId) -> u8;
    fn is_valid_member(who: &AccountId) -> bool;
}

/// 推荐关系提供者
pub trait ReferralProvider<AccountId> {
    fn get_referrer_by_code(code: &[u8]) -> Option<AccountId>;
}
```

### 数据结构

```rust
/// 结算模式枚举
pub enum SettlementMode {
    Weekly,
    Instant,
    Hybrid { instant_levels: u8, weekly_levels: u8 },
}

/// 模式切换历史记录
pub struct ModeSwitch<BlockNumber> {
    pub block: BlockNumber,
    pub from_mode: SettlementMode,
    pub to_mode: SettlementMode,
}
```

## 使用示例

### 1. 切换到周结算模式

```rust
// 方式一：Root 紧急通道
AffiliateConfig::set_settlement_mode(
    RuntimeOrigin::root(),
    0,  // Weekly
    0,
    0
)?;

// 方式二：通过委员会提案（需要 2/3 成员同意）
// 1. 提交提案
Council::propose(
    origin,
    threshold,  // 2/3
    Box::new(Call::AffiliateConfig(
        pallet_affiliate_config::Call::set_settlement_mode {
            mode_id: 0,
            instant_levels: 0,
            weekly_levels: 0,
        }
    )),
    length_bound,
)?;

// 2. 委员会成员投票
// 3. 达到阈值后自动执行
```

### 2. 切换到混合模式

```rust
// 前5层即时，后10层周结算
AffiliateConfig::set_settlement_mode(
    RuntimeOrigin::root(),
    2,  // Hybrid
    5,  // instant_levels
    10  // weekly_levels
)?;
```

### 3. 分配奖励（内部调用）

```rust
// 在 pallet-memo-offerings 中调用
AffiliateConfig::distribute_rewards(&buyer, amount, referrer_code)?;
```

### 4. 查询统计信息

```rust
// 获取模式使用统计
let (count, total) = AffiliateConfig::get_mode_statistics(&SettlementMode::Weekly);

// 获取切换历史
let history = AffiliateConfig::get_switch_history();
```

## Runtime 集成

### 1. 添加依赖

在 `runtime/Cargo.toml` 中添加：

```toml
[dependencies]
pallet-affiliate-config = { path = "../pallets/affiliate-config", default-features = false }

[features]
std = [
    # ... 其他依赖
    "pallet-affiliate-config/std",
]
```

### 2. 配置 Runtime

```rust
// 实现配置
impl pallet_affiliate_config::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeeklyProvider = MemoAffiliate;  // pallet-memo-affiliate
    type InstantProvider = AffiliateInstant;  // pallet-affiliate-instant
    type MembershipProvider = Membership;  // pallet-membership
    type ReferralProvider = Membership;  // pallet-membership
    // 治理起源：Root 或 理事会 2/3 多数
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    type WeightInfo = ();
    type PalletId = AffiliateConfigPalletId;
}

// 添加到 construct_runtime!
construct_runtime!(
    pub enum Runtime {
        // ... 其他 pallet
        AffiliateConfig: pallet_affiliate_config,
    }
);

// 定义 PalletId
parameter_types! {
    pub const AffiliateConfigPalletId: PalletId = PalletId(*b"affcfg!!");
}
```

### 3. 修改 pallet-memo-offerings

在支付完成后调用分配逻辑：

```rust
// 在 create_offering 或 purchase_offering 中
if let Some(referrer_code) = referrer_code {
    // 调用统一的分配接口
    pallet_affiliate_config::Pallet::<T>::distribute_rewards(
        &buyer,
        amount,
        &referrer_code,
    )?;
}
```

## 测试

运行单元测试：

```bash
cargo test -p pallet-affiliate-config
```

## 验证规则

### 混合模式参数验证

1. `instant_levels` 必须 > 0
2. `instant_levels + weekly_levels` <= 15
3. 如果 `instant_levels` + `weekly_levels` < 会员层级数，剩余层级不分配

### 分配前置检查

1. 推荐码必须有效
2. 推荐人必须是有效会员
3. 推荐人层级数 > 0

## 事件

```rust
/// 模式已切换
ModeChanged { from_mode, to_mode, block }

/// 奖励已分配
RewardsDistributed { buyer, amount, mode, levels }

/// 混合模式分配完成
HybridDistributed { buyer, instant_amount, weekly_amount }
```

## 错误码

```rust
/// 混合模式参数无效
InvalidHybridParams

/// 推荐人未找到
ReferrerNotFound

/// 推荐人不是有效会员
ReferrerNotValidMember

/// 分配失败
DistributionFailed

/// 即时层级数不能为0
InstantLevelsMustBeNonZero

/// 总层级数超过15
TotalLevelsExceedsMaximum
```

## 扩展性设计

本简化版为 Phase 1，后续可扩展：

### Phase 2：按会员等级分配
```rust
SettlementMode::ByMemberLevel {
    year1_mode: Weekly,
    year3_mode: Hybrid { instant_levels: 5, weekly_levels: 5 },
    year5_mode: Instant,
    year10_mode: Instant,
}
```

### Phase 3：智能模式
```rust
SettlementMode::Smart {
    congestion_threshold: 1000,  // Gas价格阈值
    fallback_mode: Weekly,
}
```

### Phase 4：智能合约模式
```rust
SettlementMode::WasmContract {
    contract_address: H160,
}
```

## 安全考虑

1. **委员会治理**：
   - 需要委员会 2/3 多数同意才能切换模式
   - Root 保留紧急通道权限
   - 防止单点故障和恶意操作
2. **参数验证**：严格验证混合模式参数
3. **推荐人验证**：检查推荐人有效性
4. **统计审计**：记录所有操作，便于追溯
5. **资金安全**：所有转账通过 Currency trait，确保安全性
6. **透明治理**：
   - 所有提案公开可见
   - 投票过程可追溯
   - 切换历史完整记录

## 性能优化

1. **存储优化**：使用 `BoundedVec` 限制历史记录大小
2. **计算优化**：混合模式计算复杂度 O(1)
3. **事件精简**：只发出必要的事件，减少链上数据

## 维护指南

### 监控指标

1. **模式使用频率**：各模式的使用次数和占比
2. **分配金额**：各模式累计分配金额
3. **切换频率**：模式切换的频率和时间
4. **Gas 成本**：不同模式的 Gas 消耗对比

### 治理建议

1. **初期**：使用周结算模式，降低成本
2. **中期**：逐步引入混合模式，提升体验
3. **后期**：根据链上拥堵情况动态调整
4. **长期**：考虑引入智能模式自动化管理

## 许可证

Apache-2.0

## 作者

Memopark Team
