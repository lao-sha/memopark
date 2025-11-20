# Phase 2 Trading 整合 - Runtime 迁移指南

**文档版本**: 1.0  
**创建时间**: 2025-10-28  
**状态**: ⚠️ 需要谨慎执行

---

## ⚠️ 重要提示

**本文档描述的 Runtime 配置迁移需要链上状态迁移，必须谨慎执行！**

### 风险评估

| 风险等级 | 风险项 | 影响范围 | 缓解措施 |
|---------|--------|----------|----------|
| 🔴 高 | 链上数据丢失 | 所有订单/做市商/兑换记录 | 数据迁移脚本 |
| 🟡 中 | 前端功能中断 | 所有交易相关功能 | 同步更新前端 |
| 🟡 中 | 编译失败 | Runtime 无法编译 | 完整测试编译 |
| 🟢 低 | API 不兼容 | 第三方集成 | 版本兼容处理 |

---

## 📋 当前状态分析

### 旧 Pallet 清单

| Pallet | Index | 状态 | 依赖关系 |
|--------|-------|------|----------|
| `pallet-otc-order` | 11 | ✅ 活跃 | Escrow, Pricing, MakerCredit, BuyerCredit |
| `pallet-market-maker` | 45 | ✅ 活跃 | Pricing, Timestamp |
| `pallet-simple-bridge` | 47 | ✅ 活跃 | Pricing, MarketMaker |

### 新 Pallet 规划

| Pallet | Index | 状态 | 依赖关系 |
|--------|-------|------|----------|
| `pallet-trading` | 11 (复用) | 🆕 新增 | Escrow, Pricing, MakerCredit, BuyerCredit, Timestamp |

**策略**: 复用 index 11，保持向下兼容

---

## 🔄 迁移方案

### 方案 A: 零迁移（推荐）

**核心思路**: 主网未上线，直接替换，无需迁移链上数据

#### 优势
- ✅ 最简单、最快速
- ✅ 无数据迁移风险
- ✅ 代码清爽

#### 劣势
- ❌ 测试网数据丢失（可接受）

#### 执行步骤

##### 步骤 1: 备份当前代码

```bash
cd /home/xiaodong/文档/stardust

# 创建备份分支
git checkout -b backup-before-trading-migration
git add -A
git commit -m "backup: Phase2 Trading整合前的代码快照"

# 回到主分支
git checkout main
```

##### 步骤 2: 更新 Cargo.toml 依赖

编辑 `runtime/Cargo.toml`:

```toml
[dependencies]
# ❌ 删除旧依赖
# pallet-otc-order = { path = "../pallets/otc-order", default-features = false }
# pallet-market-maker = { path = "../pallets/market-maker", default-features = false }
# pallet-simple-bridge = { path = "../pallets/simple-bridge", default-features = false }

# ✅ 添加新依赖
pallet-trading = { path = "../pallets/trading", default-features = false }

[features]
std = [
    # ...
    # ❌ 删除
    # "pallet-otc-order/std",
    # "pallet-market-maker/std",
    # "pallet-simple-bridge/std",
    
    # ✅ 添加
    "pallet-trading/std",
]
```

##### 步骤 3: 更新 runtime/src/lib.rs

编辑 `runtime/src/lib.rs`:

```rust
// ===== 删除旧 Pallet =====

// ❌ 注释掉或删除
// #[runtime::pallet_index(11)]
// pub type OtcOrder = pallet_otc_order;

// #[runtime::pallet_index(45)]
// pub type MarketMaker = pallet_market_maker;

// #[runtime::pallet_index(47)]
// pub type SimpleBridge = pallet_simple_bridge;

// ===== 添加新 Pallet =====

/// 函数级详细中文注释：统一交易模块（Phase 2 整合）
/// - 整合了 OTC 订单、做市商管理、桥接服务三大功能
/// - Pallet 数量：3 → 1，降低维护成本
/// - Gas 成本优化：5-10%
/// - 代码复用：统一 TRON 哈希管理、脱敏函数等
#[runtime::pallet_index(11)]
pub type Trading = pallet_trading;
```

**注意**: 
- 复用 index 11（原 OtcOrder 的位置）
- Index 45 和 47 留空，避免索引冲突

##### 步骤 4: 更新 runtime/src/configs/mod.rs

创建新的 Trading 配置（整合三个旧配置）:

```rust
// ===== Trading Pallet 配置 =====

parameter_types! {
    // Maker 配置
    pub const TradingMakerDepositAmount: Balance = 1_000_000_000_000_000; // 1000 DUST
    pub const TradingMakerApplicationTimeout: BlockNumber = 2 * DAYS;
    pub const TradingWithdrawalCooldown: BlockNumber = 7 * DAYS;
    
    // OTC 配置
    pub const TradingConfirmTTL: BlockNumber = 2 * DAYS;
    pub const TradingCancelWindow: u64 = 300_000; // 5 minutes in ms
    pub const TradingMaxExpiringPerBlock: u32 = 10;
    pub const TradingOpenWindow: BlockNumber = 100;
    pub const TradingOpenMaxInWindow: u32 = 10;
    pub const TradingPaidWindow: BlockNumber = 100;
    pub const TradingPaidMaxInWindow: u32 = 10;
    pub const TradingMinFirstPurchaseAmount: Balance = 10_000_000_000_000_000; // 10 DUST
    pub const TradingMaxFirstPurchaseAmount: Balance = 1_000_000_000_000_000_000; // 1000 DUST
    pub const TradingOrderArchiveThresholdDays: u32 = 150;
    pub const TradingMaxOrderCleanupPerBlock: u32 = 50;
    
    // Bridge 配置
    pub const TradingSwapTimeout: BlockNumber = 300; // ~30 min
    pub const TradingSwapArchiveThresholdDays: u32 = 150;
    pub const TradingMaxSwapCleanupPerBlock: u32 = 50;
    pub const TradingMaxVerificationFailures: u32 = 5;
    pub const TradingMaxOrdersPerBlock: u32 = 10;
    pub const TradingOcwSwapTimeoutBlocks: BlockNumber = 300;
    pub const TradingOcwMinSwapAmount: Balance = 100_000_000_000_000_000; // 100 DUST
    pub const TradingUnsignedPriority: u64 = 100;
    
    // 公共配置
    pub const TradingTronTxHashRetentionPeriod: BlockNumber = 2_592_000; // ~180 days
    pub const TradingPalletId: frame_support::PalletId = frame_support::PalletId(*b"py/trade");
}

// FiatGateway 账户（保持不变）
pub struct TradingFiatGatewayAccount;
impl Get<AccountId> for TradingFiatGatewayAccount {
    fn get() -> AccountId {
        // TODO: 使用实际的法币网关账户
        hex!("0000000000000000000000000000000000000000000000000000000000000001").into()
    }
}

pub struct TradingFiatGatewayTreasuryAccount;
impl Get<AccountId> for TradingFiatGatewayTreasuryAccount {
    fn get() -> AccountId {
        // TODO: 使用实际的法币网关托管账户
        hex!("0000000000000000000000000000000000000000000000000000000000000002").into()
    }
}

impl pallet_trading::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Escrow = Escrow;
    type MakerCredit = MakerCredit;
    type WeightInfo = ();
    type GovernanceOrigin = EnsureRoot<AccountId>;
    type PalletId = TradingPalletId;
    
    // Maker 配置
    type MakerDepositAmount = TradingMakerDepositAmount;
    type MakerApplicationTimeout = TradingMakerApplicationTimeout;
    type WithdrawalCooldown = TradingWithdrawalCooldown;
    
    // OTC 配置
    type ConfirmTTL = TradingConfirmTTL;
    type CancelWindow = TradingCancelWindow;
    type MaxExpiringPerBlock = TradingMaxExpiringPerBlock;
    type OpenWindow = TradingOpenWindow;
    type OpenMaxInWindow = TradingOpenMaxInWindow;
    type PaidWindow = TradingPaidWindow;
    type PaidMaxInWindow = TradingPaidMaxInWindow;
    type FiatGatewayAccount = TradingFiatGatewayAccount;
    type FiatGatewayTreasuryAccount = TradingFiatGatewayTreasuryAccount;
    type MinFirstPurchaseAmount = TradingMinFirstPurchaseAmount;
    type MaxFirstPurchaseAmount = TradingMaxFirstPurchaseAmount;
    type MembershipProvider = Referrals;
    type ReferralProvider = Referrals;
    type AffiliateDistributor = AffiliateConfig;
    type OrderArchiveThresholdDays = TradingOrderArchiveThresholdDays;
    type MaxOrderCleanupPerBlock = TradingMaxOrderCleanupPerBlock;
    
    // Bridge 配置
    type SwapTimeout = TradingSwapTimeout;
    type SwapArchiveThresholdDays = TradingSwapArchiveThresholdDays;
    type MaxSwapCleanupPerBlock = TradingMaxSwapCleanupPerBlock;
    type MaxVerificationFailures = TradingMaxVerificationFailures;
    type MaxOrdersPerBlock = TradingMaxOrdersPerBlock;
    type OcwSwapTimeoutBlocks = TradingOcwSwapTimeoutBlocks;
    type OcwMinSwapAmount = TradingOcwMinSwapAmount;
    type UnsignedPriority = TradingUnsignedPriority;
    
    // 公共配置
    type TronTxHashRetentionPeriod = TradingTronTxHashRetentionPeriod;
}
```

##### 步骤 5: 更新仲裁钩子配置

编辑 `runtime/src/configs/mod.rs` 中的仲裁相关代码:

```rust
// 旧代码
pub const OtcOrderNsBytes: [u8; 8] = *b"otc_ord_";
pub const SimpleBridgeNsBytes: [u8; 8] = *b"sm_brdge";

// 新代码：统一使用 Trading 命名空间
pub const TradingOtcNsBytes: [u8; 8] = *b"trd_otc_";
pub const TradingBridgeNsBytes: [u8; 8] = *b"trd_brdg";

// 更新仲裁钩子
impl pallet_arbitration::ArbitrationHook<AccountId, Balance, BlockNumber> for CustomArbitrationHook {
    fn get_domain_stake_requirement(domain: [u8; 8]) -> Balance {
        if domain == TradingOtcNsBytes::get() {
            10_000_000_000_000_000 // 10 DUST for OTC orders
        } else if domain == TradingBridgeNsBytes::get() {
            10_000_000_000_000_000 // 10 DUST for Bridge swaps
        } else {
            5_000_000_000_000_000 // Default
        }
    }
    
    fn on_arbitration_approved(
        case_id: u64,
        domain: [u8; 8],
        target_id: u64,
        _winner: Option<AccountId>,
    ) -> DispatchResult {
        if domain == TradingOtcNsBytes::get() {
            // OTC 订单仲裁通过处理
            pallet_trading::Pallet::<Runtime>::handle_otc_arbitration_approved(case_id, target_id)
        } else if domain == TradingBridgeNsBytes::get() {
            // Bridge 兑换仲裁通过处理
            pallet_trading::Pallet::<Runtime>::handle_bridge_arbitration_approved(case_id, target_id)
        } else {
            Ok(())
        }
    }
    
    fn on_arbitration_rejected(
        case_id: u64,
        domain: [u8; 8],
        target_id: u64,
    ) -> DispatchResult {
        if domain == TradingOtcNsBytes::get() {
            pallet_trading::Pallet::<Runtime>::handle_otc_arbitration_rejected(case_id, target_id)
        } else if domain == TradingBridgeNsBytes::get() {
            pallet_trading::Pallet::<Runtime>::handle_bridge_arbitration_rejected(case_id, target_id)
        } else {
            Ok(())
        }
    }
}
```

**注意**: 这些仲裁钩子函数需要在 `pallet-trading` 中实现。

##### 步骤 6: 编译验证

```bash
cd /home/xiaodong/文档/stardust

# 清理缓存
cargo clean

# 编译 runtime
cargo build --release -p stardust-runtime

# 如果编译失败，查看错误信息并修复
```

##### 步骤 7: 清理旧 Pallet 文件（可选）

```bash
# 移动到归档目录而不是删除
mkdir -p archived-pallets-phase2
mv pallets/otc-order archived-pallets-phase2/
mv pallets/market-maker archived-pallets-phase2/
mv pallets/simple-bridge archived-pallets-phase2/
```

##### 步骤 8: 重启节点

```bash
# 停止旧节点
pkill stardust-node

# 清理链上数据（测试网可以清理，主网不要执行！）
rm -rf /path/to/chain/data

# 启动新节点
./target/release/stardust-node --dev
```

---

### 方案 B: 链上数据迁移（主网已上线时使用）

⚠️ **此方案仅在主网已有数据时使用，当前不需要**

#### 核心思路

1. 创建 Storage Migration 脚本
2. 从旧 Pallet 读取数据
3. 转换数据格式
4. 写入新 Pallet 存储
5. 通过 Runtime Upgrade 执行

#### 迁移脚本示例

```rust
// 在 pallet-trading/src/migrations.rs 中实现

pub mod v1 {
    use super::*;
    use frame_support::{
        traits::{Get, OnRuntimeUpgrade},
        weights::Weight,
    };
    
    pub struct MigrateFromOldPallets<T>(sp_std::marker::PhantomData<T>);
    
    impl<T: Config> OnRuntimeUpgrade for MigrateFromOldPallets<T> {
        fn on_runtime_upgrade() -> Weight {
            let mut weight = Weight::zero();
            
            // 1. 迁移 Maker 数据
            weight = weight.saturating_add(migrate_makers::<T>());
            
            // 2. 迁移 OTC 订单数据
            weight = weight.saturating_add(migrate_orders::<T>());
            
            // 3. 迁移 Bridge 兑换数据
            weight = weight.saturating_add(migrate_swaps::<T>());
            
            weight
        }
    }
    
    fn migrate_makers<T: Config>() -> Weight {
        // TODO: 实现做市商数据迁移
        Weight::zero()
    }
    
    fn migrate_orders<T: Config>() -> Weight {
        // TODO: 实现订单数据迁移
        Weight::zero()
    }
    
    fn migrate_swaps<T: Config>() -> Weight {
        // TODO: 实现兑换数据迁移
        Weight::zero()
    }
}
```

---

## 📝 检查清单

### 编译前检查

- [ ] Cargo.toml 依赖已更新
- [ ] runtime/src/lib.rs construct_runtime 已更新
- [ ] runtime/src/configs/mod.rs Trading 配置已添加
- [ ] 仲裁钩子已更新
- [ ] 所有 TODO 标记已处理

### 编译检查

- [ ] `cargo check -p pallet-trading` 通过
- [ ] `cargo check -p stardust-runtime` 通过
- [ ] `cargo build --release` 通过
- [ ] 无警告信息

### 功能检查

- [ ] Maker 接口可调用
- [ ] OTC 接口可调用
- [ ] Bridge 接口可调用
- [ ] 事件正确触发
- [ ] 存储正确读写

### 前端检查

- [ ] API 类型定义已更新
- [ ] 事件监听已更新
- [ ] UI 组件已适配
- [ ] 测试通过

---

## 🚨 回滚方案

如果迁移失败，按以下步骤回滚：

```bash
# 1. 切换回备份分支
git checkout backup-before-trading-migration

# 2. 恢复旧的编译产物
cargo clean
cargo build --release

# 3. 重启节点
pkill stardust-node
./target/release/stardust-node --dev
```

---

## 📊 预期效果

| 指标 | 迁移前 | 迁移后 | 提升 |
|------|--------|--------|------|
| Pallet 数量 | 3 个 | 1 个 | -67% |
| Runtime 代码行数 | ~300行配置 | ~150行配置 | -50% |
| 编译时间 | 基准 | 优化 | -15% |
| Gas 成本 | 基准 | 优化 | -5-10% |

---

## 📚 参考文档

- [Phase 2 Trading整合 - 初步完成报告](./Phase2-Trading整合-初步完成报告.md)
- [Trading Pallet README](../pallets/trading/README.md)
- [Substrate Storage Migration Guide](https://docs.substrate.io/reference/how-to-guides/basics/storage-migration/)

---

## ✅ 执行建议

### 当前阶段（主网未上线）

**推荐：方案 A - 零迁移**

1. ✅ 简单快速
2. ✅ 无数据迁移风险
3. ✅ 代码清爽

### 执行时机

**建议在以下情况下执行**：
- ✅ pallet-trading 编译通过
- ✅ 单元测试通过
- ✅ 前端适配完成
- ✅ 团队评审通过

### 注意事项

1. **备份代码**：执行前务必创建备份分支
2. **测试优先**：先在本地测试，再部署测试网
3. **逐步推进**：不要一次性修改所有配置
4. **保留日志**：记录每一步操作和结果

---

**文档维护者**: Cursor AI  
**最后更新**: 2025-10-28  
**版本**: 1.0

