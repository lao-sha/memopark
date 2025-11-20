# Phase 3 Week 2 Day 4 - 快速开始 🚀

**日期**: 2025-10-25
**任务**: pallet-escrow 测试
**目标**: 18个测试用例
**预计**: 2小时

---

## 📋 任务概览

### pallet-escrow 特点
```
✅ 依赖少（3个）: System, Balances, Timestamp
✅ 逻辑清晰: 托管账户的锁定/解锁/转移
✅ 是otc-order核心依赖
✅ 复杂度: ⭐⭐（中等）
```

---

## 🎯 测试策略（18测试）

### Part 1: 基础功能（6测试，30分钟）
1. ✅ `lock_from_works` - 锁定资金
2. ✅ `lock_from_insufficient_balance` - 余额不足
3. ✅ `unlock_from_works` - 解锁资金
4. ✅ `unlock_from_not_locked` - 解锁失败
5. ✅ `transfer_from_escrow_works` - 托管转账
6. ✅ `transfer_from_escrow_insufficient` - 转账不足

### Part 2: 批量操作（6测试，40分钟）
7. ✅ `release_all_works` - 释放全部
8. ✅ `release_all_empty` - 空托管释放
9. ✅ `refund_all_works` - 退款全部
10. ✅ `refund_all_empty` - 空托管退款
11. ✅ `amount_of_works` - 查询金额
12. ✅ `amount_of_zero` - 零金额查询

### Part 3: 过期机制（6测试，50分钟）
13. ✅ `expiry_policy_works` - 过期策略触发
14. ✅ `expiry_release_all` - 过期自动释放
15. ✅ `expiry_refund_all` - 过期自动退款
16. ✅ `expiry_noop` - 过期无操作
17. ✅ `max_expiring_per_block` - 每块最大过期数
18. ✅ `expiry_multiple_escrows` - 多托管过期

---

## 📁 文件结构

```
pallets/escrow/
├── src/
│   ├── lib.rs          （已存在）
│   ├── mock.rs         （待创建）
│   └── tests.rs        （待创建）
└── Cargo.toml          （待更新dev-dependencies）
```

---

## 🔧 Mock Runtime（预计100行）

### 依赖配置
```toml
[dev-dependencies]
sp-core = { workspace = true }
sp-io = { workspace = true }
```

### mock.rs结构
```rust
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64},
};
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        Escrow: pallet_escrow,
    }
);

// System Config
impl frame_system::Config for Test { /* 标准配置 */ }

// Balances Config
impl pallet_balances::Config for Test { /* 标准配置 */ }

// Timestamp Config
impl pallet_timestamp::Config for Test { /* 标准配置 */ }

// Escrow Config（重点）
parameter_types! {
    pub const EscrowPalletId: frame_support::PalletId = 
        frame_support::PalletId(*b"py/escro");
    pub const MaxExpiringPerBlock: u32 = 100;
}

// MockExpiryPolicy
pub struct MockExpiryPolicy;
impl pallet_escrow::pallet::ExpiryPolicy<u64, u64> for MockExpiryPolicy {
    fn on_expire(
        _escrow_id: &u64,
        _at: u64,
    ) -> pallet_escrow::ExpiryAction {
        pallet_escrow::ExpiryAction::Noop
    }
    
    fn now() -> u64 {
        System::block_number()
    }
}

impl pallet_escrow::pallet::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EscrowPalletId = EscrowPalletId;
    type AuthorizedOrigin = frame_system::EnsureRoot<u64>;
    type AdminOrigin = frame_system::EnsureRoot<u64>;
    type MaxExpiringPerBlock = MaxExpiringPerBlock;
    type ExpiryPolicy = MockExpiryPolicy;
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![(1, 100000), (2, 100000), (3, 100000)],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}
```

---

## 📝 tests.rs结构（预计250行）

### 测试模板
```rust
use crate::mock::*;
use frame_support::{assert_noop, assert_ok};

#[test]
fn lock_from_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let caller = 1u64;
        let escrow_id = 100u64;
        let amount = 1000u64;
        
        // 锁定资金
        assert_ok!(Escrow::lock_from(&caller, &escrow_id, amount));
        
        // 验证余额
        assert_eq!(Balances::free_balance(caller), 99000);
        assert_eq!(Escrow::amount_of(&escrow_id), amount);
    });
}

#[test]
fn expiry_policy_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let caller = 1u64;
        let escrow_id = 100u64;
        let amount = 1000u64;
        
        // 锁定资金
        assert_ok!(Escrow::lock_from(&caller, &escrow_id, amount));
        
        // 设置过期时间
        let expiry_block = 10u64;
        // ... 调用设置过期的函数
        
        // 推进到过期块
        System::set_block_number(expiry_block);
        
        // 触发过期检查
        Escrow::on_initialize(expiry_block);
        
        // 验证过期后的状态
        // ...
    });
}
```

---

## ⚡ 执行步骤

### 步骤1: 查看lib.rs（5分钟）
```bash
cd /home/xiaodong/文档/stardust
cat pallets/escrow/src/lib.rs | grep -A 5 "pub trait Config"
```
**目的**: 确认Config trait的所有关联类型

### 步骤2: 创建mock.rs（25分钟）
1. 复制模板
2. 实现frame_system::Config
3. 实现pallet_balances::Config
4. 实现pallet_timestamp::Config
5. 实现pallet_escrow::Config（重点）
6. 实现MockExpiryPolicy

### 步骤3: 创建tests.rs（60分钟）
1. Part 1: 基础功能（6测试）
2. Part 2: 批量操作（6测试）
3. Part 3: 过期机制（6测试）

### 步骤4: 更新Cargo.toml（5分钟）
```toml
[dev-dependencies]
sp-core = { workspace = true }
sp-io = { workspace = true }
```

### 步骤5: 编译验证（10分钟）
```bash
cargo test -p pallet-escrow --lib
```

### 步骤6: 修复错误（15分钟）
- 根据编译错误调整mock
- 根据运行错误调整测试

---

## 🎯 验收标准

- ✅ 18/18 测试通过
- ✅ 零编译警告
- ✅ mock.rs < 150行
- ✅ tests.rs < 300行
- ✅ 覆盖所有核心接口

---

## 📊 关键检查点

### Checkpoint 1（30分钟）
- ✅ mock.rs编译通过
- ✅ ExpiryPolicy实现正确

### Checkpoint 2（60分钟）
- ✅ Part 1 测试通过（6/18）

### Checkpoint 3（90分钟）
- ✅ Part 2 测试通过（12/18）

### Checkpoint 4（120分钟）
- ✅ Part 3 测试通过（18/18）
- ✅ 完成Day 4！

---

## 💡 关键注意事项

### ExpiryPolicy Trait
```rust
pub trait ExpiryPolicy<EscrowId, BlockNumber> {
    fn on_expire(escrow_id: &EscrowId, at: BlockNumber) -> ExpiryAction;
    fn now() -> BlockNumber;
}

pub enum ExpiryAction {
    ReleaseAll,
    RefundAll,
    Noop,
}
```

### Escrow Trait
```rust
pub trait Escrow<AccountId, Balance, EscrowId> {
    fn lock_from(from: &AccountId, escrow_id: &EscrowId, amount: Balance) 
        -> DispatchResult;
    fn unlock_from(escrow_id: &EscrowId, to: &AccountId, amount: Balance) 
        -> DispatchResult;
    fn transfer_from_escrow(escrow_id: &EscrowId, to: &AccountId, amount: Balance) 
        -> DispatchResult;
    fn release_all(escrow_id: &EscrowId) -> DispatchResult;
    fn refund_all(escrow_id: &EscrowId) -> DispatchResult;
    fn amount_of(escrow_id: &EscrowId) -> Balance;
}
```

---

## 🚀 开始行动

**第一步**: 查看pallet-escrow/src/lib.rs的Config定义
**时间**: 现在！
**预期完成**: 2小时后

---

**准备好了吗？让我们开始Day 4！** 🎯

