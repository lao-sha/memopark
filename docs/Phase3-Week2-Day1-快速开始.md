# Phase 3 Week 2 Day 1 - 快速开始

> **任务**: pallet-stardust-ipfs测试  
> **预计测试数**: 10个  
> **预计时间**: 2小时  
> **日期**: 2025年10月26日

---

## 🎯 目标

完成pallet-stardust-ipfs的**10个核心功能测试**：
- ✅ IPFS Pin管理（4个）
- ✅ 价格验证（3个）
- ✅ 权限控制（3个）

---

## 📋 测试清单

### A. IPFS Pin管理 (4个)
1. ⏳ `pin_add_works` - 添加pin成功
2. ⏳ `pin_remove_works` - 移除pin成功
3. ⏳ `pin_requires_quota` - pin需要配额
4. ⏳ `pin_duplicate_fails` - 重复pin失败

### B. 价格验证 (3个)
5. ⏳ `pin_validates_price` - 价格验证
6. ⏳ `pin_below_minimum_fails` - 低于最小价格
7. ⏳ `pin_deducts_fee` - 扣除手续费

### C. 权限控制 (3个)
8. ⏳ `pin_requires_owner` - pin需要所有者
9. ⏳ `remove_requires_owner` - 移除需要所有者
10. ⏳ `is_pinned_works` - is_pinned查询功能

---

## 🔧 技术要点

### 1. Pin管理核心逻辑
```rust
// pin_add: 添加IPFS pin
pub fn pin_add(
    origin: OriginFor<T>,
    cid: Vec<u8>,
    size: u64,
    replicas: u32,
) -> DispatchResult

// pin_remove: 移除IPFS pin
pub fn pin_remove(
    origin: OriginFor<T>,
    cid: Vec<u8>,
) -> DispatchResult

// is_pinned: 查询是否已pin
pub fn is_pinned(cid: Vec<u8>) -> bool
```

### 2. 关键验证点
- ✅ CID格式验证（BoundedVec）
- ✅ 配额检查（QuotaConsumer）
- ✅ 价格计算（DefaultStoragePrice）
- ✅ 重复pin检查
- ✅ 所有者权限验证

### 3. 关键Storage
```rust
// Pin记录
Pins: StorageMap<CID, PinRecord>

// 用户Pin列表
PinsByOwner: StorageDoubleMap<AccountId, CID, ()>

// Pin计数
PinCount: StorageValue<u64>
```

---

## 🚀 执行步骤

### Step 1: 检查pallet结构（5分钟）
- 查看extrinsics签名
- 确认Storage定义
- 识别trait依赖

### Step 2: 创建Mock Runtime（30分钟）
- frame_system::Config
- pallet_balances::Config（可选）
- pallet_memo_ipfs::Config
- Mock QuotaConsumer trait

### Step 3: 编写测试（60分钟）
- A组：Pin管理（4个）
- B组：价格验证（3个）
- C组：权限控制（3个）

### Step 4: 编译修复（15分钟）
- 修复类型错误
- 修复trait实现

### Step 5: 测试调试（10分钟）
- 修复失败测试
- 验证事件断言

---

## ⚡ 快速参考

### CID Helper
```rust
fn valid_cid() -> BoundedVec<u8, ConstU32<128>> {
    b"QmTest1234567890".to_vec().try_into().unwrap()
}
```

### Pin记录验证
```rust
// 验证Pin存在
assert!(Pins::<Test>::contains_key(&cid));

// 验证Pin记录
let pin = Pins::<Test>::get(&cid).unwrap();
assert_eq!(pin.owner, user);
assert_eq!(pin.size, 1000);
```

### 事件验证
```rust
System::assert_has_event(
    Event::PinAdded {
        who: user,
        cid: cid.clone(),
        size: 1000,
        replicas: 1,
    }
    .into(),
);
```

---

## 📊 预期成果

**编译**: ✅ 0错误  
**测试**: ✅ 10/10通过  
**代码量**: Mock 200行 + 测试 400行  
**总计**: 600行  

---

**立即启动Week 2 Day 1！** 🚀💪

