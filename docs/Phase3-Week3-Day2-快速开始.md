# Phase 3 Week 3 Day 2 - 快速开始 🚀

**日期**: 2025-10-25
**任务**: pallet-stardust-referrals 测试
**目标**: 10-12个测试（推荐系统）
**预计**: 2小时

---

## 📋 任务概览

### pallet-stardust-referrals 特点
```
功能: 推荐关系管理 + 奖励分配
难度: ⭐（简单CRUD）
依赖: 最小（Currency + Storage）
模式: 类似stardust-park（快速恢复信心！）
```

### 测试策略
```
Part 1: 基础推荐关系（5测试，60分钟）
Part 2: 奖励管理（5测试，45分钟）
预留: 调试修复（15分钟）

总目标: 10-12测试，100%通过
```

---

## 🎯 12个测试规划

### Part 1: 基础推荐关系（5测试）
```rust
1. register_referral_works           - 注册推荐关系
   - 用户B通过用户A的推荐码注册
   - 验证referrer存储
   - 验证事件发出

2. get_referrer_works                - 查询推荐人
   - 查询用户的推荐人
   - 验证返回正确的referrer

3. register_duplicate_fails          - 重复注册失败
   - 已有推荐人的用户不能再注册
   - 验证AlreadyRegistered错误

4. self_referral_fails               - 自我推荐失败
   - 用户不能推荐自己
   - 验证SelfReferralNotAllowed错误

5. referral_chain_works              - 推荐链追踪
   - A→B→C推荐链
   - 验证多层推荐关系
```

### Part 2: 奖励管理（5-7测试）
```rust
6. record_reward_works               - 记录奖励
   - 记录推荐奖励到账户
   - 验证奖励存储

7. claim_reward_works                - 领取奖励
   - 用户领取累积奖励
   - 验证余额变化

8. insufficient_reward_fails         - 余额不足失败
   - 奖励池余额不足时失败
   - 验证InsufficientReward错误

9. reward_accumulation_works         - 奖励累积
   - 多次奖励累加
   - 验证总奖励正确

10. multiple_referrals_works         - 多层推荐奖励
    - A推荐B，B推荐C
    - A和B都获得奖励
    - 验证奖励分配比例

可选（时间充裕）:
11. referral_statistics              - 推荐统计
12. max_referral_depth               - 最大推荐深度
```

---

## 📁 文件结构

```
pallets/stardust-referrals/
├── src/
│   ├── lib.rs          ⏳ 需要查看接口
│   ├── mock.rs         ⏳ 需要创建
│   └── tests.rs        ⏳ 需要创建
└── Cargo.toml          ⏳ 需要更新（dev-dependencies）
```

---

## ⚡ 执行步骤

### 步骤1: 查看pallet接口（15分钟）
```bash
cd /home/xiaodong/文档/stardust
cat pallets/stardust-referrals/src/lib.rs | head -200
grep "pub fn " pallets/stardust-referrals/src/lib.rs | head -20
```

**目的**: 了解可用的extrinsic和存储结构

### 步骤2: 创建mock.rs（20分钟）
**参考模板**: `pallets/stardust-park/src/mock.rs`

**关键配置**:
```rust
impl pallet_memo_referrals::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = ();
    // 其他配置参数（根据lib.rs中的Config trait）
}
```

### 步骤3: 创建tests.rs Part 1（40分钟）
**测试1-5**: 基础推荐关系

**模板示例**:
```rust
#[test]
fn register_referral_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        let referrer = 1u64;
        let referee = 2u64;
        
        // 注册推荐关系
        assert_ok!(Referrals::register_referral(
            RuntimeOrigin::signed(referee),
            referrer,
        ));
        
        // 验证存储
        assert_eq!(
            crate::ReferrerOf::<Test>::get(referee),
            Some(referrer)
        );
        
        // 验证事件
        System::assert_has_event(
            crate::Event::ReferralRegistered {
                referrer,
                referee,
            }.into()
        );
    });
}
```

### 步骤4: 创建tests.rs Part 2（40分钟）
**测试6-10**: 奖励管理

### 步骤5: 编译验证（10分钟）
```bash
cargo test -p pallet-stardust-referrals --lib
```

### 步骤6: 修复错误（15分钟预留）

---

## 🎯 验收标准

- ✅ 10-12/12 测试通过
- ✅ 零编译警告
- ✅ 覆盖核心功能：注册/查询/奖励/边界
- ✅ tests.rs < 500行
- ✅ mock.rs完整可用

---

## 📊 关键检查点

### Checkpoint 1（35分钟）
- ✅ 查看lib.rs接口完成
- ✅ mock.rs创建完成
- ✅ 编译通过

### Checkpoint 2（75分钟）
- ✅ Part 1完成（5测试）
- ✅ 至少3/5测试通过

### Checkpoint 3（115分钟）
- ✅ Part 2完成（5测试）
- ✅ 至少8/10测试通过

### Checkpoint 4（120分钟）
- ✅ 全部测试通过（10-12/12）
- ✅ Week 3 Day 2完成！

---

## 💡 关键注意事项

### 可能的存储结构
```rust
ReferrerOf<T>: StorageMap<AccountId, AccountId>  // 推荐人映射
ReferralRewards<T>: StorageMap<AccountId, Balance>  // 奖励累积
ReferralCount<T>: StorageMap<AccountId, u32>  // 推荐计数
```

### 可能的Extrinsics
```rust
register_referral(referrer: AccountId)
claim_rewards()
record_reward(account: AccountId, amount: Balance)  // 可能是内部调用
```

### 可能的事件
```rust
ReferralRegistered { referrer, referee }
RewardRecorded { account, amount }
RewardClaimed { account, amount }
```

---

## 🚀 开始行动

**第一步**: 查看pallets/stardust-referrals/src/lib.rs
**时间**: 现在！
**预期完成**: 2小时后（10-12个测试通过）

---

**准备好恢复快速节奏了吗？Let's go！** 🎯

