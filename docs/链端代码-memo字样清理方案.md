# 链端代码 MEMO 字样清理方案

**生成时间**: 2025-10-29  
**任务**: 清理链端代码中所有 `memo` 相关字样，改为 `dust`

---

## 📊 统计概览

| 目录 | 匹配数 | 文件数 | 优先级 |
|------|--------|--------|--------|
| `pallets/` | 822 | 84 | **高** |
| `runtime/` | 161 | 7 | **高** |
| `node/` | 3 | 1 | **高** |
| **总计** | **986** | **92** | - |

---

## 🎯 修改分类

### 类别 1：链名称和代币符号（最高优先级）⭐️⭐️⭐️⭐️⭐️

这些是用户可见的关键标识，必须修改。

| 文件 | 当前值 | 新值 | 说明 |
|------|--------|------|------|
| `node/src/chain_spec.rs` | `"MEMOPARK"` | `"STARDUST"` | 链显示名称 |
| `node/src/chain_spec.rs` | `"memopark-dev"` | `"stardust-dev"` | 链ID |
| `node/src/chain_spec.rs` | `"MEMO"` | `"DUST"` | 代币符号 |
| `runtime/src/lib.rs` | `"memopark-runtime"` | `"stardust-runtime"` | Runtime名称 (2处) |

**影响**: 
- 前端显示的链名称和代币符号
- Polkadot.js Apps 显示
- 钱包集成

---

### 类别 2：关键函数和字段名（高优先级）⭐️⭐️⭐️⭐️

这些影响前端API调用和核心业务逻辑。

#### 2.1 Pricing Pallet

| 文件 | 当前名称 | 新名称 | 引用数 |
|------|----------|--------|--------|
| `pallets/pricing/src/lib.rs` | `memo_qty` | `dust_qty` | 37处 |
| `pallets/pricing/src/lib.rs` | `total_memo` | `total_dust` | 8处 |
| `pallets/pricing/src/lib.rs` | `get_memo_market_price_weighted()` | `get_dust_market_price_weighted()` | 1处定义 + runtime调用 |
| `pallets/pricing/README.md` | `memo_qty` | `dust_qty` | 6处 |

**关联调用**:
- `runtime/src/configs/mod.rs` 第129行: `pallet_pricing::Pallet::<Runtime>::get_memo_market_price_weighted()`

#### 2.2 Trading Pallet

| 文件 | 当前名称 | 新名称 | 引用数 |
|------|----------|--------|--------|
| `pallets/trading/src/lib.rs` | `release_memo()` | `release_dust()` | 函数签名 |
| `pallets/trading/src/lib.rs` | `memo_amount` | `dust_amount` | 10处 |
| `pallets/trading/src/otc.rs` | `do_release_memo()` | `do_release_dust()` | 函数签名 |
| `pallets/trading/src/otc.rs` | `memo_amount` | `dust_amount` | 6处 |
| `pallets/trading/src/bridge.rs` | `memo_amount` | `dust_amount` | 13处 |
| `pallets/trading/src/bridge.rs` | `do_swap()` 参数 | `dust_amount` | 参数名 |
| `pallets/trading/src/bridge.rs` | `do_maker_swap()` 参数 | `dust_amount` | 参数名 |
| `pallets/trading/src/benchmarking.rs` | `bridge_memo_to_tron` | `bridge_dust_to_tron` | 基准测试 |
| `pallets/trading/src/benchmarking.rs` | `bridge_usdt_to_memo` | `bridge_usdt_to_dust` | 基准测试 |
| `pallets/trading/src/weights.rs` | `release_memo()` | `release_dust()` | 权重函数 |
| `pallets/trading/src/weights.rs` | `bridge_memo_to_tron()` | `bridge_dust_to_tron()` | 权重函数 |
| `pallets/trading/src/weights.rs` | `bridge_usdt_to_memo()` | `bridge_usdt_to_dust()` | 权重函数 |

**影响前端**:
- ✅ 前端已使用 `tradingService.ts` 封装，影响有限
- ⚠️ 但需要更新 `CreateMarketMakerPage.tsx` (2000+行未迁移)

#### 2.3 Simple Bridge Pallet (旧代码，仅文档)

| 文件 | 当前名称 | 新名称 | 说明 |
|------|----------|--------|------|
| `pallets/simple-bridge/src/lib.rs` | `memo_amount` | `dust_amount` | 65处（已整合，仅保留供参考） |
| `pallets/simple-bridge/README.md` | `memo_amount` | `dust_amount` | 12处 |

**状态**: 该pallet已整合到 `pallet-trading`，但代码仍保留以供参考。

#### 2.4 Runtime 配置

| 文件 | 当前名称 | 新名称 | 行号 |
|------|----------|--------|------|
| `runtime/src/configs/mod.rs` | `memo_price_usdt` | `dust_price_usdt` | 129 |
| `runtime/src/configs/mod.rs` | `safe_price` 注释 | `0.000001 USDT/DUST` | 133 |
| `runtime/src/configs/mod.rs` | `base_deposit_memo` | `base_deposit_dust` | 145 |
| `runtime/src/configs/mod.rs` | `MEMO_PRECISION` | `DUST_PRECISION` | 143 |
| `runtime/src/configs/mod.rs` | `MAX_DEPOSIT` 注释 | `100,000 DUST` | 166 |
| `runtime/src/configs/mod.rs` | `MIN_DEPOSIT` 注释 | `1 DUST` | 167 |
| `runtime/src/configs/mod.rs` | `CreditMinimumBalance` 注释 | `100 DUST`, `10000 DUST` | 431-432 |

---

### 类别 3：注释中的代币单位（中优先级）⭐️⭐️⭐️

所有注释中的 `MEMO` 改为 `DUST`（约 200+ 处）。

**示例**：
```rust
// 旧: /// - 100 MEMO 作为基准
// 新: /// - 100 DUST 作为基准

// 旧: pub const CreditMinimumBalance: Balance = 100 * UNIT; // 100 MEMO
// 新: pub const CreditMinimumBalance: Balance = 100 * UNIT; // 100 DUST
```

**批量修改命令**:
```bash
# 注释中的代币单位（格式：数字 + MEMO）
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\([0-9,_]\+\) MEMO/\1 DUST/g' {} +

# 注释中的 MEMO/USDT
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/MEMO\/USDT/DUST\/USDT/g' {} +
```

---

### 类别 4：注释中的旧 Pallet 名称（低优先级）⭐️⭐️

这些不影响功能，仅为代码整洁性。

| 旧名称 | 新名称 | 文件 |
|--------|--------|------|
| `pallet-memo-appeals` | `pallet-stardust-appeals` | `runtime/src/hold_reasons.rs` |
| `pallet-memo-offerings` | `pallet-memorial` | `runtime/src/hold_reasons.rs`, `runtime/src/lib.rs` |
| `pallet-memo-sacrifice` | `pallet-memorial` | `runtime/src/lib.rs` |
| `pallet-memo-ipfs` | `pallet-stardust-ipfs` | `runtime/src/lib.rs`, `runtime/src/configs/mod.rs` |
| `pallet-memo-grave` | `pallet-stardust-grave` | `runtime/src/configs/mod.rs` |
| `memo-pet` | `stardust-pet` | `runtime/src/configs/mod.rs` |
| `memorial-park/grave/deceased` | `stardust-park/grave/deceased` | `runtime/src/configs/mod.rs` |
| `MemoIpfs` | `StardustIpfs` | 已修改 ✅ |

**批量修改命令**:
```bash
# 注释中的旧pallet名称
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-appeals/pallet-stardust-appeals/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-offerings/pallet-memorial/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-sacrifice/pallet-memorial/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-ipfs/pallet-stardust-ipfs/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-grave/pallet-stardust-grave/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/memo-pet/stardust-pet/g' {} +
```

---

### 类别 5：测试和示例代码（低优先级）⭐️

测试文件中的变量名，不影响主逻辑。

| 文件类型 | 示例 | 修改策略 |
|---------|------|----------|
| `src/tests.rs` | `memo_amount`, `release_memo_works()` | 随主代码一起修改 |
| `src/mock.rs` | `MEMO` 单位 | 批量替换 |
| `src/benchmarking.rs` | `bridge_memo_to_tron` | 跟随主函数改名 |

---

## 🚀 执行计划

### 阶段 1：链标识和代币符号（10分钟）⭐️⭐️⭐️⭐️⭐️

**立即修改**（影响用户可见信息）：

1. **node/src/chain_spec.rs**
   ```rust
   // Line 25: .with_name("MEMOPARK")
   .with_name("STARDUST")
   
   // Line 26: .with_id("memopark-dev")
   .with_id("stardust-dev")
   
   // Line 39: p.insert("tokenSymbol".into(), "MEMO".into());
   p.insert("tokenSymbol".into(), "DUST".into());
   ```

2. **runtime/src/lib.rs**
   ```rust
   // Line 69-70
   spec_name: alloc::borrow::Cow::Borrowed("stardust-runtime"),
   impl_name: alloc::borrow::Cow::Borrowed("stardust-runtime"),
   ```

**验证**:
```bash
cargo check -p stardust-node
cargo check -p stardust-runtime
```

---

### 阶段 2：Pricing Pallet（15分钟）⭐️⭐️⭐️⭐️

**修改文件**:
1. `pallets/pricing/src/lib.rs`
2. `pallets/pricing/src/tests.rs`
3. `pallets/pricing/README.md`
4. `runtime/src/configs/mod.rs` (调用处)

**关键修改**:
```rust
// 1. pallets/pricing/src/lib.rs
// 字段名: memo_qty → dust_qty
pub struct PriceRecord {
    pub price_usdt: u64,
    pub dust_qty: u128,  // ← 修改
}

// 存储: total_memo → total_dust
pub struct PriceAggregate {
    pub total_dust: u128,  // ← 修改
    pub total_usdt: u128,
    pub order_count: u32,
    pub oldest_index: u32,
}

// 函数签名: memo_qty → dust_qty
pub fn add_otc_order(
    timestamp: u64,
    price_usdt: u64,
    dust_qty: u128,  // ← 修改
) -> DispatchResult

// 函数名: get_memo_market_price_weighted → get_dust_market_price_weighted
pub fn get_dust_market_price_weighted() -> u64  // ← 修改

// 2. runtime/src/configs/mod.rs (第129行)
let dust_price_usdt = pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted();
```

**验证**:
```bash
cargo check -p pallet-pricing
cargo check -p stardust-runtime
```

---

### 阶段 3：Trading Pallet（20分钟）⭐️⭐️⭐️⭐️

**修改文件**:
1. `pallets/trading/src/lib.rs`
2. `pallets/trading/src/otc.rs`
3. `pallets/trading/src/bridge.rs`
4. `pallets/trading/src/benchmarking.rs`
5. `pallets/trading/src/weights.rs`
6. `pallets/trading/README.md`

**关键修改**:
```rust
// 1. 函数名: release_memo → release_dust
#[pallet::weight(<T as Config>::WeightInfo::release_dust())]
pub fn release_dust(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
    let maker = ensure_signed(origin)?;
    crate::otc::do_release_dust::<T>(&maker, order_id)
}

// 2. 字段名: memo_amount → dust_amount
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct OtcOrder<AccountId, Balance, BlockNumber> {
    pub order_id: u64,
    pub maker_id: u64,
    pub buyer: AccountId,
    pub dust_amount: Balance,  // ← 修改
    // ...
}

// 3. 事件名: SwapCreated
SwapCreated { 
    swap_id: u64, 
    user: T::AccountId, 
    dust_amount: BalanceOf<T>,  // ← 修改
    tron_address: TronAddress 
},

// 4. 权重函数
impl WeightInfo for SubstrateWeight {
    fn release_dust() -> Weight { /* ... */ }
    fn bridge_dust_to_tron() -> Weight { /* ... */ }
    fn bridge_usdt_to_dust() -> Weight { /* ... */ }
}
```

**验证**:
```bash
cargo check -p pallet-trading
cargo test -p pallet-trading
```

---

### 阶段 4：Runtime 配置（10分钟）⭐️⭐️⭐️⭐️

**修改文件**: `runtime/src/configs/mod.rs`

```rust
// Line 129: 变量名
let dust_price_usdt = pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted();

// Line 132-136: 注释
let safe_price = if dust_price_usdt == 0 || dust_price_usdt < 1 {
    1u64 // 0.000001 USDT/DUST（最低保护价格）
} else {
    dust_price_usdt
};

// Line 143: 常量名
const DUST_PRECISION: u128 = 1_000_000_000_000u128; // 10^12

// Line 145-148: 变量名和注释
let base_deposit_dust = TEN_USD
    .saturating_mul(DUST_PRECISION)
    .checked_div(safe_price as u128)
    .unwrap_or(1 * DUST_PRECISION); // 默认1 DUST

// Line 163: 变量名
let final_deposit = mult.mul_floor(base_deposit_dust);

// Line 166-167: 注释
const MAX_DEPOSIT: Balance = 100_000 * DUST_PRECISION; // 最高 100,000 DUST
const MIN_DEPOSIT: Balance = 1 * DUST_PRECISION; // 最低 1 DUST

// Line 431-432: 注释
/// - 100 DUST 作为基准，持仓>=100倍（10000 DUST）视为高信任
pub const CreditMinimumBalance: Balance = 100 * UNIT;
```

**验证**:
```bash
cargo check -p stardust-runtime
```

---

### 阶段 5：批量清理注释（5分钟）⭐️⭐️

**执行脚本**:
```bash
cd /home/xiaodong/文档/memopark

# 1. 注释中的代币单位
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/\([0-9,_]\+\) MEMO\b/\1 DUST/g' {} +

# 2. 注释中的 MEMO/USDT
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/MEMO\/USDT/DUST\/USDT/g' {} +

# 3. 注释中的旧pallet名称
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-appeals/pallet-stardust-appeals/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-offerings/pallet-memorial/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-sacrifice/pallet-memorial/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-ipfs/pallet-stardust-ipfs/g' {} +
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/pallet-memo-grave/pallet-stardust-grave/g' {} +

# 4. 注释中的 memo-pet
find pallets runtime node -type f -name "*.rs" -exec sed -i 's/memo-pet/stardust-pet/g' {} +

# 5. README 文档
find pallets -type f -name "README.md" -exec sed -i 's/\bMEMO\b/DUST/g' {} +
```

**验证**:
```bash
git diff | grep -E "MEMO|memo" | head -50
```

---

### 阶段 6：编译验证（10分钟）⭐️⭐️⭐️⭐️⭐️

```bash
# 1. 全量编译
cargo build --release

# 2. 单元测试
cargo test -p pallet-pricing
cargo test -p pallet-trading
cargo test -p stardust-runtime

# 3. 基准测试（可选）
cargo build --release --features runtime-benchmarks
```

---

## ⚠️ 风险评估

| 风险项 | 影响范围 | 缓解措施 | 优先级 |
|--------|----------|----------|--------|
| 前端API调用失败 | 前端 DApp | 前端已使用 `tradingService.ts` 封装 | 中 |
| `CreateMarketMakerPage.tsx` 未迁移 | 做市商注册页面 | 独立修复（2000+行） | 中 |
| Polkadot.js Apps 显示 | 区块浏览器 | 重启节点后自动更新 | 低 |
| 历史数据兼容性 | 现有链上数据 | 零迁移阶段，无历史数据 | 无 |

---

## 📋 验证清单

### 编译验证
- [ ] `cargo check -p stardust-node` 通过
- [ ] `cargo check -p stardust-runtime` 通过
- [ ] `cargo check -p pallet-pricing` 通过
- [ ] `cargo check -p pallet-trading` 通过
- [ ] `cargo build --release` 通过

### 功能验证
- [ ] 节点启动，链名称显示为 "STARDUST"
- [ ] Polkadot.js Apps 显示代币符号为 "DUST"
- [ ] 前端 DApp 编译通过
- [ ] Trading OTC 订单创建正常
- [ ] Bridge 兑换功能正常
- [ ] Pricing 实时价格查询正常

### 代码质量
- [ ] 无新增 linter 警告
- [ ] 所有测试用例通过
- [ ] Git diff 无意外修改
- [ ] 文档与代码同步

---

## 📊 预计工作量

| 阶段 | 工作量 | 风险 | 依赖 |
|------|--------|------|------|
| 阶段1 (链标识) | 10分钟 | 低 | 无 |
| 阶段2 (Pricing) | 15分钟 | 低 | 阶段1 |
| 阶段3 (Trading) | 20分钟 | 中 | 阶段1 |
| 阶段4 (Runtime) | 10分钟 | 低 | 阶段2,3 |
| 阶段5 (注释清理) | 5分钟 | 低 | 无 |
| 阶段6 (验证) | 10分钟 | - | 阶段1-5 |
| **总计** | **70分钟** | **中** | - |

---

## 🎯 推荐执行方案

### 方案 A：立即完整实施（推荐）⭐️⭐️⭐️⭐️⭐️

**时间**: 70分钟  
**优势**:
- ✅ 一次性彻底完成
- ✅ 与前端重命名保持同步
- ✅ 避免混乱（部分MEMO，部分DUST）

**步骤**:
1. 创建 Git 备份标签
2. 按阶段1→6顺序执行
3. 编译验证
4. 提交代码

---

### 方案 B：分阶段实施

**时间**: 分3天，每天30分钟  
**优势**:
- 风险更低（逐步验证）
- 便于问题定位

**Day 1**: 阶段1+2 (链标识+Pricing)  
**Day 2**: 阶段3 (Trading)  
**Day 3**: 阶段4+5+6 (Runtime+清理+验证)

---

### 方案 C：仅关键修改（最小化）

**时间**: 20分钟  
**修改**:
- 仅阶段1（链标识和代币符号）
- 保留所有内部变量名不变

**适用场景**: 快速验证前端兼容性

---

## 📝 后续任务

完成链端重命名后：
1. **前端集成验证** (1-2小时)
   - 测试所有API调用
   - 验证代币符号显示
   - 修复 `CreateMarketMakerPage.tsx`（如需要）

2. **文档同步** (30分钟)
   - 更新所有 README.md
   - 更新开发者文档
   - 更新API文档

3. **最终验证** (1小时)
   - 端到端功能测试
   - 性能基准测试
   - 生成测试报告

---

## ✅ 质量保证

### Git 备份策略
```bash
# 执行前创建标签
git tag -a before-chain-memo-cleanup -m "链端MEMO清理前备份"

# 执行后创建标签
git tag -a after-chain-memo-cleanup -m "链端MEMO清理完成"
```

### 回滚方案
```bash
# 如遇问题，立即回滚
git reset --hard before-chain-memo-cleanup
```

---

## 🎉 完成标准

- ✅ 所有代币符号 `MEMO` → `DUST`
- ✅ 所有链名称 `memopark` → `stardust`
- ✅ 所有关键变量/函数名已更新
- ✅ 编译通过（零警告）
- ✅ 测试通过
- ✅ Git 提交清晰
- ✅ 文档同步更新

---

**下一步**: 等待确认后立即执行 🚀

