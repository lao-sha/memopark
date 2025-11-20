# Phase 7.1 - 最终行动方案

**文档版本**: v1.0.0  
**制定时间**: 2025-10-29  
**状态**: ✅ 方案确定

---

## 📊 好消息！

经过全面扫描，发现：
- ✅ **5/6 核心 Pallet 已有测试框架**（83%）
- ✅ **仅 Affiliate 需要从零创建**
- ✅ **大幅降低工作量**

---

## 🎯 最终方案：快速补充测试

### Phase 7.1 任务拆分

| 阶段 | Pallet | mock.rs | tests.rs | 工作量 | 状态 |
|-----|--------|---------|----------|--------|------|
| **7.1.1** | **Affiliate** | 🔴 需创建 | 🔴 需创建 | 6h | ⏳ 最高优先级 |
| **7.1.2** | **Credit** | ✅ 已有 | 🟡 需补充 | 3h | ⏳ 待开始 |
| **7.1.3** | **Deceased** | ✅ 已有 | 🟡 需补充 | 2h | ⏳ 待开始 |
| **7.1.4** | **Memorial** | ✅ 已有 | 🟡 需补充 | 4h | ⏳ 待开始 |
| **7.1.5** | **Trading** | ✅ 已有 | 🟡 需补充 | 5h | ⏳ 待开始 |
| **总计** | - | - | - | **20h** | - |

---

## 🚀 Phase 7.1.1 - Affiliate 测试（最高优先级）

### 为什么优先？
1. ✅ **刚完成整合**，急需验证
2. ✅ **完全缺失测试**，风险最高
3. ✅ **核心功能**，影响面广

### 实施步骤

#### Step 1: 创建 Mock Runtime（3h）
```bash
# 创建文件
touch pallets/affiliate/src/mock.rs
touch pallets/affiliate/src/tests.rs
```

**mock.rs 需要配置**：
```rust
// 1. frame_system::Config ✅
// 2. pallet_balances::Config ✅
// 3. pallet_timestamp::Config ✅ (用于 BlockNumber)
// 4. pallet_affiliate::Config ✅
//    - MembershipProvider Mock 适配器
```

#### Step 2: 编写测试用例（3h）

**推荐关系测试（10个）**：
```rust
✅ test_bind_sponsor_success
✅ test_bind_sponsor_invalid_code
✅ test_bind_sponsor_cycle_detection
✅ test_bind_sponsor_already_registered
✅ test_claim_code_success
✅ test_claim_code_already_claimed
✅ test_claim_code_too_short
✅ test_claim_code_too_long
✅ test_get_referral_chain
✅ test_referral_chain_max_depth
```

**即时分成测试（5个）**：
```rust
✅ test_instant_distribution_success
✅ test_instant_distribution_empty_chain
✅ test_instant_distribution_invalid_member
✅ test_instant_distribution_system_fee
✅ test_instant_distribution_multi_level
```

**周结算测试（8个）**：
```rust
✅ test_weekly_accumulation
✅ test_weekly_cycle_start
✅ test_weekly_settlement_success
✅ test_weekly_settlement_cursor
✅ test_weekly_settlement_batch
✅ test_weekly_payout_list
✅ test_hybrid_mode
✅ test_settlement_mode_switch
```

**配置管理测试（5个）**：
```rust
✅ test_set_settlement_mode
✅ test_set_instant_percents
✅ test_set_weekly_percents
✅ test_set_blocks_per_week
✅ test_set_max_settlement_accounts
```

---

## 📝 测试模板

### Mock Runtime 模板
```rust
// pallets/affiliate/src/mock.rs

use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64, Everything},
    PalletId,
};
use frame_system as system;
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
        Timestamp: pallet_timestamp,
        Affiliate: crate,
    }
);

// ... 配置 impl

// Mock MembershipProvider
pub struct MockMembershipProvider;
impl crate::MembershipProvider<u64> for MockMembershipProvider {
    fn is_valid_member(who: &u64) -> bool {
        // 简化实现：账户ID > 0 即为有效会员
        *who > 0
    }
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 10_000_000_000_000_000), // Alice
            (2, 10_000_000_000_000_000), // Bob
            (3, 10_000_000_000_000_000), // Charlie
            (4, 10_000_000_000_000_000), // Dave
            (5, 10_000_000_000_000_000), // Eve
        ],
    }
    .assimilate_storage(&mut t)
    .unwrap();

    t.into()
}
```

### 测试用例模板
```rust
// pallets/affiliate/src/tests.rs

use crate::{mock::*, Error, Event};
use frame_support::{assert_noop, assert_ok, BoundedVec};

#[test]
fn test_bind_sponsor_success() {
    new_test_ext().execute_with(|| {
        // Arrange
        let sponsor = 1u64;
        let user = 2u64;
        let sponsor_code = b"SPONSOR1".to_vec();
        
        // 先让推荐人认领推荐码
        assert_ok!(Affiliate::claim_code(
            RuntimeOrigin::signed(sponsor),
            BoundedVec::try_from(sponsor_code.clone()).unwrap(),
        ));
        
        // Act - 绑定推荐人
        assert_ok!(Affiliate::bind_sponsor(
            RuntimeOrigin::signed(user),
            BoundedVec::try_from(sponsor_code.clone()).unwrap(),
        ));
        
        // Assert
        // 1. 验证推荐关系建立
        let sponsor_from_storage = Affiliate::sponsors(user);
        assert_eq!(sponsor_from_storage, Some(sponsor));
        
        // 2. 验证事件发射
        System::assert_last_event(
            Event::SponsorBound {
                who: user,
                sponsor,
                code: BoundedVec::try_from(sponsor_code).unwrap(),
            }
            .into(),
        );
    });
}

#[test]
fn test_bind_sponsor_cycle_detection() {
    new_test_ext().execute_with(|| {
        // Arrange - 创建循环: 1 -> 2 -> 3 -> (尝试) -> 1
        let user1 = 1u64;
        let user2 = 2u64;
        let user3 = 3u64;
        
        // 建立推荐链: 1 -> 2 -> 3
        assert_ok!(Affiliate::claim_code(
            RuntimeOrigin::signed(user1),
            BoundedVec::try_from(b"CODE1".to_vec()).unwrap(),
        ));
        assert_ok!(Affiliate::bind_sponsor(
            RuntimeOrigin::signed(user2),
            BoundedVec::try_from(b"CODE1".to_vec()).unwrap(),
        ));
        assert_ok!(Affiliate::claim_code(
            RuntimeOrigin::signed(user2),
            BoundedVec::try_from(b"CODE2".to_vec()).unwrap(),
        ));
        assert_ok!(Affiliate::bind_sponsor(
            RuntimeOrigin::signed(user3),
            BoundedVec::try_from(b"CODE2".to_vec()).unwrap(),
        ));
        
        // Act & Assert - 尝试形成循环: 3 -> 1
        // 注意：当前实现可能没有循环检测，这个测试用于验证是否需要添加
        // 如果没有循环检测，应该考虑添加
    });
}
```

---

## ⏱️ 时间规划

### Day 1 (8h) - Affiliate 完整测试
- **上午（4h）**: 创建 mock.rs，配置完整 Mock Runtime
- **下午（4h）**: 编写 28 个测试用例（推荐关系10+即时5+周结算8+配置5）

### Day 2 (3h) - Credit 补充测试
- 检查现有测试
- 补充缺失的测试用例
- 运行测试并修复

### Day 3 (6h) - Memorial + Deceased 补充测试
- **上午（2h）**: Deceased 测试补充
- **下午（4h）**: Memorial 测试补充

### Day 4-5 (10h) - Trading 补充测试
- **Day 4（5h）**: 实现 8 个 TODO 测试
- **Day 5（5h）**: 补充 12+ 个新测试

---

## ✅ 验收标准

- [ ] Affiliate 测试覆盖率 ≥ 80%
- [ ] Credit 测试覆盖率 ≥ 80%
- [ ] Deceased 测试覆盖率 ≥ 80%
- [ ] Memorial 测试覆盖率 ≥ 75%
- [ ] Trading 测试覆盖率 ≥ 75%
- [ ] **总体覆盖率 ≥ 78%**

---

## 🚀 立即开始

**当前任务**: Phase 7.1.1 - 创建 Affiliate Mock Runtime

**立即行动**：
```bash
# 1. 创建文件
cd /home/xiaodong/文档/stardust/pallets/affiliate
mkdir -p src
touch src/mock.rs
touch src/tests.rs

# 2. 更新 lib.rs（添加模块声明）
echo "\n#[cfg(test)]\nmod mock;\n\n#[cfg(test)]\nmod tests;" >> src/lib.rs

# 3. 开始编写 mock.rs
vim src/mock.rs
```

---

## 📊 预期成果

**Phase 7.1 完成后**：
- ✅ 6 个核心 Pallet 测试完整
- ✅ 100+ 测试用例
- ✅ 测试覆盖率 78%+
- ✅ 测试报告和文档
- ✅ CI/CD 集成

---

**下一步**: 开始创建 Affiliate Mock Runtime！

**文档结束**

