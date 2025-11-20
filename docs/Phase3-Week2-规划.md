# Phase 3 Week 2 - 详细规划

> **目标**: 完成6-8个高优先级pallet测试  
> **预计测试数**: 60-80个  
> **预计用时**: 15-20小时  
> **开始日期**: 2025年10月26日

---

## 🎯 Week 2 目标

### 核心目标
1. ✅ 完成**6个核心基础设施pallet**
2. ✅ 测试数量达到**139+**（Week 1: 79 + Week 2: 60）
3. ✅ Phase 3进度达到**38%**（10/27 pallet）
4. ✅ 建立IPFS/定价/支付/交易测试基准

### 质量目标
- ✅ 测试通过率: 100%
- ✅ 编译: 0错误，0警告
- ✅ 文档: 每日报告
- ✅ 注释: 详细中文注释

---

## 📋 Week 2 Pallet列表

### 优先级排序（按依赖关系）

| Day | Pallet | 测试数 | 优先级 | 依赖 | 用时 |
|-----|--------|--------|--------|------|------|
| D1 | pallet-stardust-ipfs | 10 | 🔥高 | 无 | 2h |
| D2 | pallet-pricing | 12 | 🔥高 | 无 | 2.5h |
| D3 | pallet-epay | 10 | 🔥高 | pricing | 2.5h |
| D4 | pallet-otc | 15 | 🔥高 | pricing, epay | 3h |
| D5 | pallet-simple-bridge | 12 | 🔥高 | pricing | 3h |
| +1 | pallet-affiliate | 10 | 中 | offerings | 2h |

**总计**: 69个测试，15小时

---

## 📅 每日详细计划

### Day 1: pallet-stardust-ipfs (2小时)

**测试清单（10个）**:

**IPFS Pin管理 (4个)**:
1. ✅ pin_add_works - 添加pin成功
2. ✅ pin_remove_works - 移除pin成功
3. ✅ pin_requires_quota - pin需要配额
4. ✅ pin_duplicate_fails - 重复pin失败

**价格验证 (3个)**:
5. ✅ pin_validates_price - 价格验证
6. ✅ pin_below_minimum_fails - 低于最小价格
7. ✅ pin_deducts_fee - 扣除手续费

**权限控制 (3个)**:
8. ✅ pin_requires_owner - pin需要所有者
9. ✅ remove_requires_owner - 移除需要所有者
10. ✅ pin_inactive_cid_fails - 非活跃CID失败

**Mock需求**:
- QuotaConsumer trait
- DefaultStoragePrice常量
- IpfsPinner trait实现

**预期难点**:
- CID格式验证
- 配额检查逻辑
- 价格计算

---

### Day 2: pallet-pricing (2.5小时)

**测试清单（12个）**:

**基础价格 (4个)**:
1. ✅ set_base_price_works - 设置基础价格
2. ✅ get_base_price_works - 获取基础价格
3. ✅ set_base_price_requires_admin - 设置需要管理员
4. ✅ base_price_bounds - 价格边界验证

**动态调整 (4个)**:
5. ✅ adjust_price_by_ratio - 按比例调整
6. ✅ adjust_price_max_deviation - 最大偏离验证
7. ✅ price_increases_on_demand - 需求增加价格上升
8. ✅ price_decreases_on_supply - 供应增加价格下降

**USD锚定 (4个)**:
9. ✅ memo_to_usd_works - MEMO转USD
10. ✅ usd_to_memo_works - USD转MEMO
11. ✅ price_oracle_updates - 预言机更新
12. ✅ stale_price_protection - 过期价格保护

**Mock需求**:
- AdminOrigin trait
- PriceOracle trait
- 价格计算辅助函数

**预期难点**:
- 动态调整算法
- USD锚定逻辑
- 预言机模拟

---

### Day 3: pallet-epay (2.5小时)

**测试清单（10个）**:

**充值/提现 (4个)**:
1. ✅ deposit_works - 充值成功
2. ✅ withdraw_works - 提现成功
3. ✅ withdraw_validates_balance - 提现验证余额
4. ✅ withdraw_requires_owner - 提现需要所有者

**手续费 (3个)**:
5. ✅ deposit_fee_deducted - 充值手续费扣除
6. ✅ withdraw_fee_deducted - 提现手续费扣除
7. ✅ fee_to_treasury - 手续费到国库

**速率限制 (3个)**:
8. ✅ rate_limit_works - 速率限制生效
9. ✅ rate_limit_per_day - 每日限制
10. ✅ admin_bypass_rate_limit - 管理员绕过限制

**Mock需求**:
- Currency trait
- Treasury账户
- AdminOrigin trait

**预期难点**:
- 手续费计算
- 速率限制窗口
- 余额验证

---

### Day 4: pallet-otc (3小时)

**测试清单（15个）**:

**挂单 (5个)**:
1. ✅ create_order_works - 创建订单
2. ✅ create_order_locks_memo - 创建订单锁定MEMO
3. ✅ create_order_validates_amount - 验证金额
4. ✅ cancel_order_works - 取消订单
5. ✅ cancel_order_unlocks_memo - 取消订单解锁MEMO

**匹配/交易 (5个)**:
6. ✅ take_order_works - 接受订单
7. ✅ take_order_transfers_funds - 转移资金
8. ✅ take_order_validates_price - 验证价格
9. ✅ partial_fill_works - 部分成交
10. ✅ order_expiry_works - 订单过期

**动态定价 (3个)**:
11. ✅ dynamic_price_updates - 动态价格更新
12. ✅ price_deviation_protection - 价格偏离保护
13. ✅ market_price_reference - 市场价格参考

**信用体系 (2个)**:
14. ✅ credit_score_updates - 信用分更新
15. ✅ low_credit_restrictions - 低信用限制

**Mock需求**:
- PricingProvider trait
- CreditScoreProvider trait
- Currency trait
- 订单匹配逻辑

**预期难点**:
- 订单锁定/解锁
- 动态定价算法
- 部分成交逻辑
- 信用体系集成

---

### Day 5: pallet-simple-bridge (3小时)

**测试清单（12个）**:

**桥接 (4个)**:
1. ✅ bridge_to_tron_works - 桥接到TRON
2. ✅ bridge_validates_amount - 验证金额
3. ✅ bridge_locks_memo - 锁定MEMO
4. ✅ bridge_emits_event - 发出事件

**赎回 (4个)**:
5. ✅ redeem_from_tron_works - 从TRON赎回
6. ✅ redeem_validates_proof - 验证证明
7. ✅ redeem_unlocks_memo - 解锁MEMO
8. ✅ redeem_once_only - 仅赎回一次

**价格/手续费 (4个)**:
9. ✅ bridge_fee_deducted - 桥接手续费
10. ✅ dynamic_bridge_price - 动态桥接价格
11. ✅ price_deviation_check - 价格偏离检查
12. ✅ minimum_bridge_amount - 最小桥接金额

**Mock需求**:
- PricingProvider trait
- TronProofVerifier trait
- Currency trait
- 桥接状态管理

**预期难点**:
- 证明验证逻辑
- 锁定/解锁机制
- 防重放攻击
- 动态定价集成

---

### +Day 6: pallet-affiliate (2小时，选做)

**测试清单（10个）**:

**关联方注册 (3个)**:
1. ✅ register_affiliate_works
2. ✅ update_affiliate_info
3. ✅ deregister_affiliate_works

**推荐关系 (3个)**:
4. ✅ bind_referrer_works
5. ✅ bind_once_only
6. ✅ referrer_validation

**收益分配 (4个)**:
7. ✅ referral_reward_calculated
8. ✅ multi_level_rewards
9. ✅ reward_distribution_works
10. ✅ accumulated_rewards_tracking

**Mock需求**:
- Currency trait
- OnOffering hook integration

---

## 🛠️ Week 2 技术准备

### Mock Templates（基于Week 1经验）

**基础Config Template**:
```rust
impl frame_system::Config for Test {
    // 标准配置（参考deceased）
}

impl pallet_balances::Config for Test {
    // 标准配置 + DoneSlashHandler
}
```

**常用Trait Mocks**:
```rust
// AdminOrigin
pub struct EnsureRootOr99;
impl frame_support::traits::EnsureOrigin<RuntimeOrigin> for EnsureRootOr99 {
    // 实现
}

// Currency operations
// 直接使用pallet_balances

// 价格查询
pub struct MockPricingProvider;
impl PricingProvider for MockPricingProvider {
    fn get_price() -> u128 { 1_000_000 }
}
```

### Helper Functions Template
```rust
/// 创建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities;

/// 获取余额
fn balance_of(who: u64) -> u64;

/// 推进区块
fn run_to_block(n: u64);

/// 创建有效CID
fn valid_cid() -> BoundedVec<u8, ConstU32<128>>;
```

---

## 📊 Week 2 成功指标

### 数量指标
- ✅ 完成Pallet: 6个
- ✅ 测试通过: 69个
- ✅ 累计测试: 148个（79 + 69）
- ✅ Phase 3进度: 38.5% (10.3/27)

### 质量指标
- ✅ 测试通过率: 100%
- ✅ 编译错误: 0
- ✅ 警告: 0
- ✅ 平均测试覆盖: 80%+

### 效率指标
- ✅ 平均开发时间: 2.5h/pallet
- ✅ 平均测试数: 11.5个/pallet
- ✅ 测试编写速度: 4.6个/小时

---

## 💡 Week 2 策略

### 成功策略（延续Week 1）
1. ✅ **快速Mock**: 简化trait，只返回Ok
2. ✅ **Helper复用**: 建立template库
3. ✅ **分步修复**: 逐个排查错误
4. ✅ **灵活调整**: 遇到复杂pallet及时调整

### Week 2 新策略
1. 🆕 **依赖顺序**: 按依赖关系测试（ipfs→pricing→epay→otc）
2. 🆕 **Mock复用**: 建立共享Mock库
3. 🆕 **快速迭代**: 每个pallet控制在2-3小时
4. 🆕 **提前评估**: Day 0快速扫描pallet复杂度

---

## ⚠️ Week 2 风险

### 已识别风险
1. ⚠️ **pallet-otc复杂度**: 订单匹配+动态定价+信用
   - **缓解**: 预留3小时，分阶段测试
2. ⚠️ **pallet-simple-bridge证明验证**: TRON证明复杂
   - **缓解**: Mock简化验证逻辑
3. ⚠️ **依赖链**: pricing→epay→otc强依赖
   - **缓解**: 严格按顺序开发

### 应急预案
- 如某pallet超时，移至Week 3
- 优先保证核心4个（ipfs, pricing, epay, otc）
- affiliate作为buffer任务

---

## 📝 Week 2 文档计划

### 每日文档
1. ✅ Phase3-Week2-DayX-快速开始.md
2. ✅ Phase3-Week2-DayX-完成报告.md

### Week总结
3. ✅ Phase3-Week2-完成报告.md
4. ✅ Phase3-Week2-经验总结.md

---

## 🎯 Week 2 里程碑

### 技术里程碑
- ✅ 完成所有基础设施pallet测试
- ✅ 建立定价/支付/交易测试基准
- ✅ Phase 3进度达到38%

### 团队里程碑
- ✅ Mock template库建立
- ✅ 测试效率提升20%
- ✅ 文档体系完善

---

**Week 2蓄势待发！冲刺Phase 3中期目标！** 🚀💪🔥

