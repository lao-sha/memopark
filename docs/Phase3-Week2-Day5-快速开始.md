# Phase 3 Week 2 Day 5 - 快速开始 🚀

**日期**: 2025-10-25
**任务**: pallet-market-maker 测试
**目标**: 20个测试用例
**预计**: 2.5小时

---

## 📋 任务概览

### pallet-market-maker 特点
```
✅ 依赖适中（4个）: System, Balances, Timestamp, Pricing
✅ 逻辑清晰: 做市商注册、抵押管理、订单匹配、奖惩机制
✅ 是otc-order核心依赖
✅ 复杂度: ⭐⭐⭐（中高）
```

---

## 🎯 测试策略（20测试）

### Part 1: 做市商管理（7测试，45分钟）
1. ✅ `register_maker_works` - 做市商注册
2. ✅ `register_maker_insufficient_deposit` - 抵押不足
3. ✅ `update_maker_info_works` - 更新做市商信息
4. ✅ `update_maker_info_unauthorized` - 未授权更新
5. ✅ `lock_deposit_works` - 锁定抵押金
6. ✅ `withdraw_deposit_works` - 提取抵押金
7. ✅ `withdraw_deposit_cooldown` - 冷却期限制

### Part 2: 订单匹配（7测试，50分钟）
8. ✅ `create_listing_works` - 创建订单
9. ✅ `create_listing_invalid_premium` - 无效溢价
10. ✅ `update_listing_works` - 更新订单
11. ✅ `cancel_listing_works` - 取消订单
12. ✅ `match_order_works` - 订单匹配
13. ✅ `match_order_insufficient_pool` - 资金池不足
14. ✅ `max_pairs_limit` - 最大交易对限制

### Part 3: 奖惩机制（6测试，45分钟）
15. ✅ `slash_maker_works` - 惩罚做市商
16. ✅ `slash_maker_exceeds_deposit` - 惩罚超过抵押
17. ✅ `reward_maker_works` - 奖励做市商
18. ✅ `review_period_enforcement` - 审查期强制
19. ✅ `emergency_withdrawal_works` - 应急提款
20. ✅ `governance_pause_works` - 治理暂停

---

## 📁 文件结构

```
pallets/market-maker/
├── src/
│   ├── lib.rs          （已存在）
│   ├── mock.rs         （待创建）
│   └── tests.rs        （待创建）
└── Cargo.toml          （待更新dev-dependencies）
```

---

## 🔧 Mock Runtime（预计180行）

### 依赖配置
```toml
[dev-dependencies]
sp-core = { workspace = true, features = ["std"] }
sp-io = { workspace = true, features = ["std"] }
pallet-balances = { workspace = true, features = ["std"] }
pallet-timestamp = { workspace = true, features = ["std"] }
pallet-pricing = { workspace = true }  # 可能已在dependencies
```

### mock.rs结构
```rust
use frame_support::{parameter_types, traits::ConstU32};
use sp_runtime::{traits::{BlakeTwo256, IdentityLookup}, BuildStorage};

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        Pricing: pallet_pricing,
        MarketMaker: pallet_market_maker,
    }
);

// System, Balances, Timestamp配置（标准）
// ...

// Pricing配置
parameter_types! {
    pub const MaxPriceDeviation: u16 = 2000; // 20%
}

impl pallet_pricing::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type MaxPriceDeviation = MaxPriceDeviation;
}

// MarketMaker配置（重点）
parameter_types! {
    pub const MinDeposit: u64 = 10000;
    pub const InfoWindow: u32 = 100;        // 信息公示期
    pub const ReviewWindow: u32 = 200;      // 审查期
    pub const RejectSlashBpsMax: u16 = 1000;// 最大惩罚10%
    pub const MaxPairs: u32 = 10;           // 最大交易对
    pub const MaxPremiumBps: i16 = 500;     // 最大溢价5%
    pub const MinPremiumBps: i16 = -500;    // 最小折价-5%
    pub const MakerPalletId: PalletId = PalletId(*b"py/maker");
    pub const WithdrawalCooldown: u32 = 100;// 提款冷却期
    pub const MinPoolBalance: u64 = 1000;   // 最小资金池余额
}

// MockReviewers
pub struct MockReviewers;
impl Get<Vec<u64>> for MockReviewers {
    fn get() -> Vec<u64> { vec![100, 101, 102] }
}

impl pallet_market_maker::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = ();
    type MinDeposit = MinDeposit;
    type InfoWindow = InfoWindow;
    type ReviewWindow = ReviewWindow;
    type RejectSlashBpsMax = RejectSlashBpsMax;
    type MaxPairs = MaxPairs;
    type GovernanceOrigin = frame_system::EnsureRoot<u64>;
    type ReviewerAccounts = MockReviewers;
    type MaxPremiumBps = MaxPremiumBps;
    type MinPremiumBps = MinPremiumBps;
    type PalletId = MakerPalletId;
    type WithdrawalCooldown = WithdrawalCooldown;
    type MinPoolBalance = MinPoolBalance;
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    
    // 获取做市商pallet账户
    let maker_account: u64 = MakerPalletId::get().into_account_truncating();
    
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 100000),  // 做市商1
            (2, 100000),  // 做市商2
            (3, 100000),  // 买家
            (100, 50000), // 审查员1
            (101, 50000), // 审查员2
            (102, 50000), // 审查员3
            (maker_account, 10000), // 做市商pallet账户初始余额
        ],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}
```

---

## 📝 tests.rs结构（预计350行）

### 测试模板
```rust
use crate::mock::*;
use frame_support::{assert_noop, assert_ok};

// ==================== Part 1: 做市商管理 ====================

#[test]
fn register_maker_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let maker = 1u64;
        let deposit = 10000u64;
        
        // 注册做市商
        assert_ok!(MarketMaker::register_maker(
            RuntimeOrigin::signed(maker),
            deposit,
            b"Maker 1".to_vec(),
        ));
        
        // 验证做市商信息
        let maker_info = MarketMaker::makers(maker).unwrap();
        assert_eq!(maker_info.deposit, deposit);
        assert_eq!(maker_info.name, b"Maker 1".to_vec());
        
        // 验证余额变化
        assert_eq!(Balances::free_balance(maker), 90000);
    });
}

#[test]
fn match_order_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let maker = 1u64;
        let buyer = 3u64;
        
        // 1. 做市商注册
        assert_ok!(MarketMaker::register_maker(
            RuntimeOrigin::signed(maker),
            10000,
            b"Maker 1".to_vec(),
        ));
        
        // 2. 做市商创建订单
        assert_ok!(MarketMaker::create_listing(
            RuntimeOrigin::signed(maker),
            1000,  // amount
            100,   // premium_bps (1%)
        ));
        
        // 3. 买家匹配订单
        assert_ok!(MarketMaker::match_order(
            RuntimeOrigin::signed(buyer),
            0,  // listing_id
            500, // amount
        ));
        
        // 4. 验证订单状态
        // ...
    });
}
```

---

## ⚡ 执行步骤

### 步骤1: 查看lib.rs（10分钟）
```bash
cd /home/xiaodong/文档/stardust
cat pallets/market-maker/src/lib.rs | grep -A 10 "pub trait Config"
```
**目的**: 确认Config trait的所有关联类型

### 步骤2: 创建mock.rs（35分钟）
1. 实现frame_system::Config（标准）
2. 实现pallet_balances::Config（标准）
3. 实现pallet_timestamp::Config（标准）
4. 实现pallet_pricing::Config
5. 实现pallet_market_maker::Config（重点）
6. 实现MockReviewers

### 步骤3: 创建tests.rs（90分钟）
1. Part 1: 做市商管理（7测试，45分钟）
2. Part 2: 订单匹配（7测试，50分钟）
3. Part 3: 奖惩机制（6测试，45分钟）

### 步骤4: 更新Cargo.toml（5分钟）
```toml
[dev-dependencies]
sp-core = { workspace = true, features = ["std"] }
sp-io = { workspace = true, features = ["std"] }
pallet-balances = { workspace = true, features = ["std"] }
pallet-timestamp = { workspace = true, features = ["std"] }
```

### 步骤5: 编译验证（10分钟）
```bash
cargo test -p pallet-market-maker --lib
```

### 步骤6: 修复错误（20分钟）
- 根据编译错误调整mock
- 根据运行错误调整测试

---

## 🎯 验收标准

- ✅ 20/20 测试通过
- ✅ 零编译警告
- ✅ mock.rs < 200行
- ✅ tests.rs < 400行
- ✅ 覆盖所有核心接口

---

## 📊 关键检查点

### Checkpoint 1（45分钟）
- ✅ mock.rs编译通过
- ✅ MockReviewers实现正确

### Checkpoint 2（90分钟）
- ✅ Part 1 测试通过（7/20）

### Checkpoint 3（140分钟）
- ✅ Part 2 测试通过（14/20）

### Checkpoint 4（150分钟）
- ✅ Part 3 测试通过（20/20）
- ✅ 完成Day 5！
- ✅ **完成Week 2！**

---

## 💡 关键注意事项

### Config关联类型预览
```rust
pub trait Config: frame_system::Config {
    type RuntimeEvent;
    type Currency;
    type WeightInfo;
    type MinDeposit: Get<Balance>;
    type InfoWindow: Get<u32>;
    type ReviewWindow: Get<u32>;
    type RejectSlashBpsMax: Get<u16>;
    type MaxPairs: Get<u32>;
    type GovernanceOrigin: EnsureOrigin;
    type ReviewerAccounts: Get<Vec<AccountId>>;
    type MaxPremiumBps: Get<i16>;
    type MinPremiumBps: Get<i16>;
    type PalletId: Get<PalletId>;
    type WithdrawalCooldown: Get<u32>;
    type MinPoolBalance: Get<Balance>;
}
```

### 关键数据结构
```rust
pub struct MakerInfo {
    pub deposit: Balance,
    pub name: Vec<u8>,
    pub status: MakerStatus,  // Active/Suspended/Banned
    pub pool_balance: Balance,
    pub registered_at: BlockNumber,
}

pub struct Listing {
    pub maker: AccountId,
    pub amount: Balance,
    pub premium_bps: i16,  // 溢价（正）或折价（负），单位bps
    pub status: ListingStatus,  // Active/Matched/Cancelled
}
```

---

## 🚀 开始行动

**第一步**: 查看pallet-market-maker/src/lib.rs的Config定义
**时间**: 现在！
**预期完成**: 2.5小时后
**完成后**: Week 2收官！

---

**准备好了吗？让我们完成Week 2最后一战！** 🎯

