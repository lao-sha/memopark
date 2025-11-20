# Phase 3 Week 2 Day 2 - 快速开始

> **任务**: pallet-pricing测试  
> **预计测试数**: 12个  
> **预计时间**: 2.5小时  
> **日期**: 2025年10月26日

---

## 🎯 目标

完成pallet-pricing的**12个核心功能测试**：
- ✅ 基础价格管理（4个）
- ✅ 动态调整机制（4个）
- ✅ USD锚定功能（4个）

---

## 📋 测试清单

### A. 基础价格管理 (4个)
1. ⏳ `set_base_price_works` - 设置基础价格
2. ⏳ `get_base_price_works` - 获取基础价格
3. ⏳ `set_base_price_requires_admin` - 需要管理员权限
4. ⏳ `base_price_bounds_validation` - 价格边界验证

### B. 动态调整机制 (4个)
5. ⏳ `adjust_price_by_ratio_works` - 按比例调整价格
6. ⏳ `adjust_price_max_deviation` - 最大偏离验证
7. ⏳ `price_increases_on_demand` - 需求增加价格上升
8. ⏳ `price_decreases_on_supply` - 供应增加价格下降

### C. USD锚定功能 (4个)
9. ⏳ `memo_to_usd_conversion_works` - MEMO转USD
10. ⏳ `usd_to_memo_conversion_works` - USD转MEMO
11. ⏳ `price_oracle_updates` - 预言机更新价格
12. ⏳ `stale_price_protection` - 过期价格保护

---

## 🔧 技术要点

### 1. 基础价格核心逻辑
```rust
// set_base_price: 设置MEMO基础价格
pub fn set_base_price(
    origin: OriginFor<T>,
    price: u128, // MEMO价格（以最小单位计）
) -> DispatchResult

// get_base_price: 获取当前价格
pub fn get_base_price() -> u128
```

### 2. 动态调整逻辑
```rust
// adjust_price: 动态调整价格
pub fn adjust_price(
    origin: OriginFor<T>,
    ratio: Permill, // 调整比例
) -> DispatchResult

// 价格偏离保护
MaxPriceDeviation: 20% // 最大允许偏离20%
```

### 3. USD锚定
```rust
// DUST → USD转换
pub fn memo_to_usd(memo_amount: u128) -> u128

// USD → MEMO转换
pub fn usd_to_memo(usd_amount: u128) -> u128

// 预言机更新
pub fn update_oracle_price(
    origin: OriginFor<T>,
    usd_per_memo: u128,
) -> DispatchResult
```

### 4. 关键Storage
```rust
// 基础价格
BasePrice: StorageValue<u128>

// 预言机价格（USD/DUST）
OraclePrice: StorageValue<(u128, BlockNumber)>

// 价格历史
PriceHistory: StorageMap<BlockNumber, u128>
```

---

## 🚀 执行步骤

### Step 1: 检查pallet结构（5分钟）
```bash
cd /home/xiaodong/文档/stardust/pallets/pricing
ls -la src/
```

### Step 2: 创建Mock Runtime（30分钟）
- frame_system::Config
- pallet_balances::Config（可选）
- pallet_pricing::Config
- Mock AdminOrigin trait

### Step 3: 编写测试（90分钟）
- A组：基础价格（4个）
- B组：动态调整（4个）
- C组：USD锚定（4个）

### Step 4: 编译验证（15分钟）
- 修复类型错误
- 修复trait实现

### Step 5: 测试通过（10分钟）
- 验证12/12通过
- 创建完成报告

---

## ⚡ 快速参考

### Helper Functions
```rust
/// 设置初始价格
fn set_initial_price(price: u128) {
    assert_ok!(Pricing::set_base_price(
        RuntimeOrigin::root(),
        price
    ));
}

/// 验证价格范围
fn assert_price_in_range(price: u128, expected: u128, tolerance: u128) {
    assert!(price >= expected - tolerance);
    assert!(price <= expected + tolerance);
}
```

### 事件验证
```rust
System::assert_has_event(
    Event::BasePriceUpdated {
        old_price: 1000,
        new_price: 1200,
    }
    .into(),
);
```

---

## 📊 预期成果

**编译**: ✅ 0错误  
**测试**: ✅ 12/12通过  
**代码量**: Mock 150行 + 测试 500行  
**总计**: 650行  

---

## 💡 Week 2 Day 1经验应用

### 避免的坑
1. ✅ **提前检查**: 先检查是否有已有测试框架
2. ✅ **简单pallet**: pricing相对简单，无历史债务
3. ✅ **时间控制**: 严格控制在2.5小时内

### 成功策略
1. ✅ 快速Mock（参考deceased模板）
2. ✅ Helper函数复用
3. ✅ 分组编写（4+4+4）

---

**立即启动Week 2 Day 2！冲刺pallet-pricing！** 🚀💪🔥

