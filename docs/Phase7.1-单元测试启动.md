# Phase 7.1 - 单元测试补充启动文档

**文档版本**: v1.0.0  
**启动时间**: 2025-10-29  
**预计完成**: 1.5 周  
**当前状态**: 🟢 进行中

---

## 📋 任务概述

为 5 个核心 Pallet 补充完整的单元测试，目标覆盖率 **≥ 80%**。

### 测试优先级

| Pallet | 优先级 | 测试用例 | 预计耗时 | 状态 |
|--------|--------|----------|----------|------|
| **Trading** | 🔴 P0 | 20+ | 1-2 天 | 🟡 进行中 |
| **Affiliate** | 🔴 P0 | 30+ | 2 天 | ⏳ 待开始 |
| **Credit** | 🟡 P1 | 15+ | 1 天 | ⏳ 待开始 |
| **Memorial** | 🟡 P1 | 25+ | 1.5 天 | ⏳ 待开始 |
| **Deceased** | 🟢 P2 | 10+ | 0.5 天 | ⏳ 待开始 |

---

## 🎯 Phase 7.1.1 - Trading 测试（当前任务）

### 测试范围

#### 1. OTC订单测试（10个用例）
```rust
✅ test_create_otc_order_success          // 正常创建订单
✅ test_create_order_amount_too_low        // 金额低于最小值
✅ test_create_order_amount_too_high       // 金额高于最大值
✅ test_create_order_unauthorized_buyer    // 未授权的买家
✅ test_create_order_insufficient_pool     // 首购资金池余额不足

✅ test_take_order_success                 // 正常吃单
✅ test_take_order_not_exist               // 订单不存在
✅ test_take_order_already_taken           // 订单已被占用
✅ test_take_order_rate_limit_exceeded     // 限频超限

✅ test_mark_paid_success                  // 正常标记支付
✅ test_mark_paid_unauthorized             // 未授权的调用者
✅ test_mark_paid_wrong_state              // 订单状态不正确

✅ test_release_memo_success               // 正常释放MEMO
✅ test_release_memo_unauthorized          // 未授权的做市商
✅ test_release_memo_wrong_state           // 订单状态不正确
```

#### 2. 桥接兑换测试（6个用例）
```rust
✅ test_swap_bridge_success                // 正常桥接兑换
✅ test_swap_bridge_amount_exceeded        // 金额超限
✅ test_swap_bridge_price_deviation        // 价格偏离过大
✅ test_swap_bridge_duplicate_hash         // TRON交易哈希重复

✅ test_maker_swap_success                 // 正常做市商兑换
✅ test_maker_swap_price_protection        // 价格偏离保护
```

#### 3. 数据清理测试（4个用例）
```rust
✅ test_cleanup_expired_orders             // 清理过期订单
✅ test_cleanup_dual_mapping_update        // 双映射索引更新
✅ test_cleanup_max_per_block              // 每块最多清理数量限制
✅ test_cleanup_swap_records               // 清理过期swap记录
```

---

## 📝 测试模板

### Mock Runtime 设置
```rust
// pallets/trading/src/mock.rs

use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64, Everything},
};
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        Trading: pallet_trading,
        Credit: pallet_credit,
        Escrow: pallet_escrow,
    }
);

impl frame_system::Config for Test {
    type BaseCallFilter = Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = ConstU64<250>;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<u128>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
}

impl pallet_balances::Config for Test {
    type MaxLocks = ();
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    type Balance = u128;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ConstU128<1>;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ();
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
}

parameter_types! {
    pub const MinOrderAmount: u128 = 100_000_000_000; // 100 DUST
    pub const MaxOrderAmount: u128 = 10_000_000_000_000; // 10,000 DUST
}

impl pallet_trading::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type MinOrderAmount = MinOrderAmount;
    type MaxOrderAmount = MaxOrderAmount;
    type Escrow = Escrow;
    type MakerCredit = Credit;
    // ... 其他配置
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 10_000_000_000_000_000), // Alice: 10,000,000 DUST
            (2, 10_000_000_000_000_000), // Bob: 10,000,000 DUST
            (3, 10_000_000_000_000_000), // Charlie: 10,000,000 DUST
        ],
    }
    .assimilate_storage(&mut t)
    .unwrap();

    t.into()
}
```

### 测试用例模板
```rust
// pallets/trading/src/tests.rs

use crate::{mock::*, Error, Event};
use frame_support::{assert_noop, assert_ok};

#[test]
fn test_create_otc_order_success() {
    new_test_ext().execute_with(|| {
        // Arrange（准备）
        let maker = 1u64;
        let amount = 1_000_000_000_000u128; // 1000 DUST
        let usdt_amount = 1000u128; // 1000 USDT
        let tron_address = b"TXXXxxxXXXxxxXXXxxxXXX".to_vec();

        // Act（执行）
        assert_ok!(Trading::create_order(
            RuntimeOrigin::signed(maker),
            amount,
            usdt_amount,
            tron_address.clone(),
        ));

        // Assert（断言）
        // 1. 验证订单创建成功
        let order_id = 0;
        let order = Trading::orders(order_id).unwrap();
        assert_eq!(order.maker, maker);
        assert_eq!(order.amount, amount);
        assert_eq!(order.usdt_amount, usdt_amount);
        
        // 2. 验证事件发射
        System::assert_last_event(
            Event::OrderCreated {
                order_id,
                maker,
                amount,
                usdt_amount,
            }
            .into(),
        );
        
        // 3. 验证MEMO托管到Escrow
        assert_eq!(Balances::free_balance(maker), 10_000_000_000_000_000 - amount);
    });
}

#[test]
fn test_create_order_amount_too_low() {
    new_test_ext().execute_with(|| {
        // Arrange
        let maker = 1u64;
        let amount = 50_000_000_000u128; // 50 DUST（低于最小值100）
        let usdt_amount = 50u128;
        let tron_address = b"TXXXxxxXXXxxxXXXxxxXXX".to_vec();

        // Act & Assert
        assert_noop!(
            Trading::create_order(
                RuntimeOrigin::signed(maker),
                amount,
                usdt_amount,
                tron_address,
            ),
            Error::<Test>::AmountTooLow
        );
    });
}
```

---

## 🔧 实施步骤

### Step 1: 检查现有 mock.rs（✅ 完成）
```bash
# 检查 Trading pallet 的 mock.rs 是否存在
ls -lh pallets/trading/src/mock.rs

# 检查 tests.rs 是否存在
ls -lh pallets/trading/src/tests.rs
```

### Step 2: 创建/更新 Mock Runtime（⏳ 进行中）
- [ ] 配置 frame_system
- [ ] 配置 pallet_balances
- [ ] 配置 pallet_trading
- [ ] 配置依赖的 pallet（Credit, Escrow）
- [ ] 设置 Genesis 初始余额

### Step 3: 编写测试用例（⏳ 待开始）
- [ ] OTC订单测试（10个）
- [ ] 桥接兑换测试（6个）
- [ ] 数据清理测试（4个）

### Step 4: 运行测试（⏳ 待开始）
```bash
# 运行 Trading pallet 测试
cargo test -p pallet-trading

# 查看测试覆盖率
cargo tarpaulin -p pallet-trading --out Html
```

### Step 5: 生成测试报告（⏳ 待开始）
- [ ] 测试通过率统计
- [ ] 覆盖率报告
- [ ] 失败用例分析

---

## 📊 进度追踪

### 当前进度：5%

```
Trading Tests: ▓░░░░░░░░░ 5% (1/20)
├─ OTC订单: ▓░░░░░░░░░ 10% (1/10)
├─ 桥接兑换: ░░░░░░░░░░ 0% (0/6)
└─ 数据清理: ░░░░░░░░░░ 0% (0/4)
```

---

## 🎯 验收标准

- [ ] 所有测试用例通过（`cargo test`）
- [ ] 代码覆盖率 ≥ 80%
- [ ] 关键路径覆盖率 100%
- [ ] 边界条件测试完整
- [ ] 错误处理测试完整

---

## 📚 参考资料

- [Substrate Testing Guide](https://docs.substrate.io/test/)
- [Frame Support Test Utilities](https://docs.rs/frame-support/latest/frame_support/traits/index.html)
- [Polkadot SDK Tests Examples](https://github.com/paritytech/polkadot-sdk/tree/master/substrate/frame)

---

**下一步**: 开始实施 Trading OTC 订单测试

**文档结束**

