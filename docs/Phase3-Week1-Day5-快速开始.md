# Phase 3 Week 1 Day 5 - 快速开始

> **任务**: pallet-memo-offerings测试Part2（13个使用流程 + 5个集成测试）  
> **前置**: ✅ Part1已完成（14/14通过）  
> **预计时间**: 3-4小时  
> **日期**: 2025年10月25日

---

## 🎯 目标

完成pallet-memo-offerings的**完整测试覆盖**：
- ✅ Part1（已完成）: 12个管理测试
- 🆕 Part2（本次）: 13个使用流程 + 5个集成测试

---

## 📋 Part2测试清单

### A. 供奉品使用流程 (13个)

#### 供奉功能 (5个)
1. ⏳ `offer_instant_works` - 瞬时型供奉成功
2. ⏳ `offer_timed_works` - 时限型供奉成功
3. ⏳ `offer_requires_payment` - 供奉需要支付
4. ⏳ `offer_validates_duration` - 供奉验证时长
5. ⏳ `offer_validates_target` - 供奉验证目标

#### 手续费功能 (2个)
6. ⏳ `offer_deducts_alliance_fee` - 联盟手续费扣除
7. ⏳ `offer_deducts_affiliate_fee` - 关联方手续费扣除

#### 提现功能 (2个)
8. ⏳ `withdraw_works` - 提现成功
9. ⏳ `withdraw_requires_owner` - 提现需要所有者权限

#### 续期功能 (2个)
10. ⏳ `renew_works` - 续期成功
11. ⏳ `renew_requires_permission` - 续期需要权限

#### 速率限制 (2个)
12. ⏳ `rate_limiting_works` - 速率限制生效
13. ⏳ `vip_bypass_rate_limit` - VIP绕过速率限制

### B. 集成测试 (5个)

14. ⏳ `full_offering_lifecycle` - 完整生命周期
15. ⏳ `multi_target_offerings` - 多目标供奉
16. ⏳ `concurrent_offerings` - 并发供奉
17. ⏳ `fee_distribution` - 手续费分配验证
18. ⏳ `storage_consistency` - 存储一致性验证

---

## 🔧 技术要点

### 1. 供奉流程核心逻辑
```rust
// offer extrinsic: 用户向目标供奉
pub fn offer(
    origin: OriginFor<T>,
    target: (u8, u64),         // (domain, id)
    kind_code: u8,
    duration_weeks: Option<u32>,
    memo: BoundedVec<u8, T::MaxMemoLen>,
) -> DispatchResult
```

**关键验证点**:
- ✅ Offering必须启用（enabled = true）
- ✅ 目标有效性（TargetControl::check_offering）
- ✅ 时长验证（Timed类型需要duration_weeks）
- ✅ 余额充足（支付价格 + 手续费）
- ✅ 速率限制（非VIP用户）

### 2. 手续费计算
```rust
// 联盟费: 5% 到 AllianceEscrow
let alliance_fee = total_price * 5 / 100;

// 关联方费: 8% 到 AffiliateEscrowAccount
let affiliate_fee = total_price * 8 / 100;

// 目标接收: 87%
let target_amount = total_price - alliance_fee - affiliate_fee;
```

### 3. 速率限制机制
```rust
// 非VIP用户限制: OfferMaxInWindow次/OfferWindow区块
let window_start = current_block - OfferWindow;
let recent_count = count_offers_since(who, target, window_start);
if recent_count >= OfferMaxInWindow {
    return Err(Error::<T>::RateLimited);
}

// VIP用户绕过
if MembershipProvider::is_vip(who) {
    // 不检查速率限制
}
```

### 4. 关键Storage
```rust
// 供奉记录
Offerings: DoubleStorageMap<(u8, u64), u64, OfferingRecord>

// 目标累计收入
TargetAccumulated: StorageMap<(u8, u64), Balance>

// 可提现余额
Withdrawable: StorageMap<(u8, u64), Balance>

// 速率限制窗口
OfferHistory: StorageMap<AccountId, BoundedVec<(BlockNumber, (u8, u64))>>
```

---

## 📝 测试策略

### A. 使用流程测试（13个）
**策略**: 聚焦单一功能点，快速验证
- 每个测试10-30行
- 使用helper functions简化
- 重点验证Events和Storage

### B. 集成测试（5个）
**策略**: 端到端流程，验证交互
- 每个测试50-100行
- 模拟真实业务场景
- 验证多方协作正确性

---

## 🚀 执行步骤

### Step 1: 补充Helper Functions（10分钟）
```rust
// 创建已启用的offering
fn create_enabled_offering(kind_code: u8) -> DispatchResult;

// 获取账户余额
fn balance_of(who: u64) -> u64;

// 模拟时间推进
fn advance_blocks(n: u64);
```

### Step 2: A组测试（供奉功能5个，60分钟）
按顺序编写测试1-5

### Step 3: A组测试（手续费2个，30分钟）
按顺序编写测试6-7

### Step 4: A组测试（提现/续期4个，60分钟）
按顺序编写测试8-11

### Step 5: A组测试（速率限制2个，30分钟）
按顺序编写测试12-13

### Step 6: B组测试（集成测试5个，90分钟）
按顺序编写测试14-18

### Step 7: 编译验证（10分钟）
修复编译错误

### Step 8: 运行测试（10分钟）
修复测试失败

---

## ⚡ 快速参考

### offer extrinsic参数
```rust
Pallet::<Test>::offer(
    RuntimeOrigin::signed(user),
    target,           // (domain, id)
    kind_code,        // 供奉品类型
    duration_weeks,   // Timed类型必填
    memo,             // 留言
)
```

### 关键断言
```rust
// 验证余额变化
assert_eq!(balance_of(user), initial - total_cost);

// 验证Event
System::assert_has_event(Event::Offered { ... }.into());

// 验证Storage
assert!(Offerings::<Test>::contains_key(target, offering_id));
```

---

## 📊 预期成果

**编译**: ✅ 0错误  
**测试**: ✅ 32/32通过（14 Part1 + 18 Part2）  
**代码量**: +600行（18个测试 + helpers）  
**总计**: 1433行（Mock 300 + 测试 1133）  

---

## ⏱️ 时间规划

```
10:00-10:10  Helper functions (10min)
10:10-11:10  供奉功能5个 (60min)
11:10-11:40  手续费2个 (30min)
11:40-12:40  提现/续期4个 (60min)
12:40-13:10  速率限制2个 (30min)
13:10-14:40  集成测试5个 (90min)
14:40-14:50  编译验证 (10min)
14:50-15:00  运行测试 (10min)
```

**总计**: 4小时

---

**Day 5立即启动！冲刺最后一波！** 🚀💪🔥

