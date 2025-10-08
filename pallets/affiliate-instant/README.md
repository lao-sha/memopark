# pallet-affiliate-instant

## 📋 功能概述

即时分成系统模块，实现供奉支付后的即时推荐奖励分配机制。每笔供奉支付完成后，立即根据推荐关系链进行多层级分成，资金实时到账，无需等待周期结算。

---

## 🎯 核心特性

### 1. 即时分配模式

**与周结算模式对比：**

| 特性 | 周结算模式 (pallet-memo-affiliate) | 即时分成模式 (pallet-affiliate-instant) |
|------|-----------------------------------|----------------------------------------|
| **结算时机** | 每周统一结算 | 每笔支付后立即分成 |
| **资金流** | 先托管 → 周末批量转账 | 直接转账到推荐人账户 |
| **用户体验** | 延迟，需等待结算周期 | 即时到账，体验更好 |
| **适用场景** | 其他消费场景 | 会员供奉场景 |
| **代数控制** | 固定15层 | 根据会员等级动态（6-15层） |
| **分成比例** | 不等比（20/10/4...） | 递减（30/25/15...） |

**优势：**
- ✅ 即时到账，用户体验更好
- ✅ 无需维护托管账户和结算状态
- ✅ 降低链上存储成本
- ✅ 配合会员系统，动态控制分成层数

### 2. 多层级分成（最多15层）

**层级控制：**
- 根据会员可拿代数决定分成层数
- 第1代推荐人分成比例最高（30%）
- 递减至第15代（1%）
- 超过会员可拿代数的层级不参与分成

**示例：**
```
购买者A（会员）
├─ 推荐人B（6代会员）→ 收到第1层奖励（30%）
│   └─ 推荐人C（9代会员）→ 收到第2层奖励（25%）
│       └─ 推荐人D（12代会员）→ 收到第3层奖励（15%）
│           └─ 推荐人E（15代会员）→ 收到第4层奖励（10%）
│               └─ 推荐人F（6代会员）→ 不收奖励（超过代数限制）
```

### 3. 递减分成比例（方案B）

| 层级 | 分成比例 | 说明 |
|------|---------|------|
| 第1代 | 30% | 直接推荐人，比例最高 |
| 第2代 | 25% | 二级推荐人 |
| 第3代 | 15% | 三级推荐人 |
| 第4代 | 10% | 四级推荐人 |
| 第5代 | 7% | 五级推荐人 |
| 第6代 | 3% | 六级推荐人 |
| 第7-9代 | 各2% | 中层推荐人 |
| 第10-15代 | 各1% | 顶层推荐人 |
| **总计** | **99%** | 剩余1%并入国库 |

**设计理念：**
- 激励直接推荐（第1代比例最高）
- 兼顾多层级（最多15代）
- 控制总和不超过100%

### 4. 分成基数计算

**公式：**
```
分成基数 = 原价 - 固定存储费 - 固定销毁费
销毁金额 = 分成基数 × 5%
国库金额 = 分成基数 × 2%
存储金额 = 分成基数 × 3%
可分配金额 = 分成基数 - 销毁 - 国库 - 存储 = 分成基数 × 90%
```

**示例：**
```
原价：100,000 MEMO
固定存储费：1,000 MEMO
固定销毁费：1,000 MEMO

分成基数 = 100,000 - 1,000 - 1,000 = 98,000 MEMO

销毁：98,000 × 5% = 4,900 MEMO
国库：98,000 × 2% = 1,960 MEMO
存储：98,000 × 3% = 2,940 MEMO
可分配：98,000 × 90% = 88,200 MEMO

第1代（30%）：88,200 × 30% = 26,460 MEMO
第2代（25%）：88,200 × 25% = 22,050 MEMO
第3代（15%）：88,200 × 15% = 13,230 MEMO
第4代（10%）：88,200 × 10% = 8,820 MEMO
第5代（7%）： 88,200 × 7% = 6,174 MEMO
第6代（3%）： 88,200 × 3% = 2,646 MEMO
...剩余并入国库
```

### 5. 会员验证机制

**每层分成前验证：**
1. ✅ 推荐人是否为有效会员（未过期）
2. ✅ 推荐人的可拿代数是否覆盖该层
3. ✅ 如果验证失败，该层份额并入国库

**验证流程：**
```rust
for (level, ancestor) in referral_chain.iter().enumerate() {
    // 1. 检查是否为有效会员
    if !MembershipProvider::is_member_valid(ancestor) {
        treasury_extra += level_amount; // 并入国库
        continue;
    }
    
    // 2. 检查代数是否足够
    let generations = MembershipProvider::get_member_generations(ancestor)?;
    if level + 1 > generations {
        treasury_extra += level_amount; // 并入国库
        continue;
    }
    
    // 3. 执行转账
    transfer(escrow_account, ancestor, level_amount)?;
}
```

---

## 🔧 核心接口

### 公共接口

#### 即时分配推荐奖励

```rust
pub fn instant_distribute(
    buyer: &T::AccountId,
    original_price: BalanceOf<T>,
    actual_paid: BalanceOf<T>,
    escrow_account: &T::AccountId,
) -> DispatchResult
```

**参数说明：**
- `buyer`: 购买者账户
- `original_price`: 原价（作为分成基数）
- `actual_paid`: 实际支付金额（会员折扣后）
- `escrow_account`: 托管账户（资金来源）

**执行流程：**
1. 计算分成基数（原价 - 存储费 - 销毁费）
2. 扣除销毁/国库/存储费（共10%）
3. 剩余90%作为可分配金额
4. 获取推荐链（最多15层）
5. 逐层验证会员有效性和代数
6. 计算该层分成金额
7. 即时转账到推荐人账户
8. 未分配部分并入国库
9. 执行销毁和存储费转账
10. 更新统计数据
11. 发出完成事件

**调用示例（由 offerings pallet 调用）：**
```rust
// 在供奉支付后
AffiliateInstant::instant_distribute(
    &buyer,
    original_price,
    actual_paid,
    &Self::escrow_account(),
)?;
```

### 治理接口

#### 设置分成比例

```rust
#[pallet::call_index(0)]
pub fn set_level_percents(
    origin: OriginFor<T>,
    percents: Vec<u8>,
) -> DispatchResult
```

**参数说明：**
- `origin`: Root权限
- `percents`: 每层分成比例（1-15层，例如 `[30, 25, 15, ...]`）

**验证规则：**
- 最多15层
- 总和不超过100%

**调用示例：**
```rust
// Root 更新分成比例
api.tx.affiliateInstant.setLevelPercents([30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1])
```

---

## 📊 存储结构

### 1. 分成比例配置

```rust
pub type LevelPercents<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<15>>, ValueQuery>;
```

**说明：** 每层的分成比例（0-100），最多15层

**默认值：** `[30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1]`

### 2. 累计分成总额

```rust
pub type TotalDistributed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;
```

**说明：** 统计所有已分配的推荐奖励总额

### 3. 累计销毁总额

```rust
pub type TotalBurned<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;
```

**说明：** 统计所有已销毁的代币总额

---

## 🎯 事件

### 1. RewardDistributed

```rust
RewardDistributed {
    to: T::AccountId,         // 推荐人
    level: u8,                // 层级（1-15）
    amount: BalanceOf<T>,     // 奖励金额
    buyer: T::AccountId,      // 购买者
}
```

**触发时机：** 每次成功转账推荐奖励时

### 2. DistributionCompleted

```rust
DistributionCompleted {
    buyer: T::AccountId,           // 购买者
    original_price: BalanceOf<T>,  // 原价
    actual_paid: BalanceOf<T>,     // 实付
    total_distributed: BalanceOf<T>, // 总分配金额
}
```

**触发时机：** 分成流程完成时

### 3. TokensBurned

```rust
TokensBurned {
    amount: BalanceOf<T>,  // 销毁金额
}
```

**触发时机：** 执行代币销毁时

### 4. LevelPercentsUpdated

```rust
LevelPercentsUpdated {
    percents: Vec<u8>,  // 新比例列表
}
```

**触发时机：** 治理更新分成比例时

---

## ⚙️ Runtime 配置

### 1. 在 runtime/Cargo.toml 添加依赖

```toml
[dependencies]
pallet-affiliate-instant = { path = "../pallets/affiliate-instant", default-features = false }

[features]
std = [
    # ... 其他依赖
    "pallet-affiliate-instant/std",
]
```

### 2. 在 runtime/src/lib.rs 配置

```rust
use frame_support::PalletId;

parameter_types! {
    pub const AffiliateInstantPalletId: PalletId = PalletId(*b"py/affin");
    pub const BurnPercent: u8 = 5;         // 5% 销毁
    pub const TreasuryPercent: u8 = 2;     // 2% 国库
    pub const StoragePercent: u8 = 3;      // 3% 存储
    pub const StorageFee: Balance = 1_000 * UNITS;  // 固定存储费
    pub const BurnFee: Balance = 1_000 * UNITS;      // 固定销毁费
    pub const TreasuryAccount: AccountId = ...; // 国库账户
    pub const StorageAccount: AccountId = ...; // 存储账户
}

impl pallet_affiliate_instant::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type PalletId = AffiliateInstantPalletId;
    type ReferralProvider = MemoReferrals;
    type MembershipProvider = Membership;
    type BurnPercent = BurnPercent;
    type TreasuryPercent = TreasuryPercent;
    type StoragePercent = StoragePercent;
    type StorageFee = StorageFee;
    type BurnFee = BurnFee;
    type TreasuryAccount = TreasuryAccount;
    type StorageAccount = StorageAccount;
}

construct_runtime!(
    pub struct Runtime {
        // ... 其他 pallets
        AffiliateInstant: pallet_affiliate_instant,
        MemoReferrals: pallet_memo_referrals,
        Membership: pallet_membership,
    }
);
```

### 3. 实现 Provider Traits

#### ReferralProvider

```rust
impl pallet_affiliate_instant::ReferralProvider<AccountId> for MemoReferrals {
    fn get_sponsor_chain(who: &AccountId, max_depth: u8) -> Vec<AccountId> {
        // 调用 pallet-memo-referrals 的接口
        MemoReferrals::get_sponsor_chain_impl(who, max_depth)
    }
}
```

#### MembershipProvider

```rust
impl pallet_affiliate_instant::MembershipProvider<AccountId> for Membership {
    fn is_member_valid(who: &AccountId) -> bool {
        Membership::is_member_valid(who)
    }

    fn get_member_generations(who: &AccountId) -> Option<u8> {
        Membership::get_member_generations(who)
    }
}
```

---

## 🔗 与其他模块的交互

### 1. pallet-membership（会员系统）

**依赖关系：** 强依赖

**交互接口：**
- `is_member_valid`: 验证会员有效性
- `get_member_generations`: 获取可拿代数

**数据流：**
```
即时分成 → 逐层验证 → 检查会员状态 → 检查代数 → 决定是否分配
```

### 2. pallet-memo-referrals（推荐关系）

**依赖关系：** 强依赖

**交互接口：**
- `get_sponsor_chain`: 获取推荐链（祖先列表）

**数据流：**
```
即时分成 → 获取推荐链 → 逐层遍历 → 验证并分配
```

### 3. pallet-memo-offerings（供奉系统）

**依赖关系：** 被依赖

**集成方式：**
```rust
// 在 offerings pallet 的供奉支付函数中调用
impl<T: Config> Pallet<T> {
    pub fn make_offering(...) -> DispatchResult {
        // ... 验证和扣费逻辑
        
        // 触发即时分成
        T::AffiliateProvider::instant_distribute(
            &who,
            original_price,
            actual_price,
            &Self::escrow_account(),
        )?;
        
        // ... 其他逻辑
    }
}
```

---

## 🧪 测试

### 运行测试

```bash
cd pallets/affiliate-instant
cargo test
```

### 测试覆盖

- ✅ 即时分成基本功能
- ✅ 会员代数限制
- ✅ 设置分成比例
- ✅ 分成比例验证（总和、层数）
- ✅ 统计数据更新
- ✅ 无效会员处理
- ✅ 转账失败处理
- ✅ 销毁和国库转账

---

## 📈 经济模型

### 分成比例分析

**总分成池：90%**（扣除10%销毁/国库/存储费后）

**15层完整分成：**
```
第1代：30% × 90% = 27.0%（原价）
第2代：25% × 90% = 22.5%
第3代：15% × 90% = 13.5%
第4代：10% × 90% = 9.0%
第5代：7% × 90% = 6.3%
第6代：3% × 90% = 2.7%
第7-9代：各 2% × 90% = 1.8%（共5.4%）
第10-15代：各 1% × 90% = 0.9%（共5.4%）

总计：27.0 + 22.5 + 13.5 + 9.0 + 6.3 + 2.7 + 5.4 + 5.4 = 91.8%（原价）
剩余：8.2%并入国库
```

**示例收益（假设原价100,000 MEMO）：**
```
第1代推荐人收益：27,000 MEMO
第2代推荐人收益：22,500 MEMO
第3代推荐人收益：13,500 MEMO
第4代推荐人收益：9,000 MEMO
第5代推荐人收益：6,300 MEMO
...
总分配：91,800 MEMO
国库：8,200 MEMO
```

---

## 🔒 安全考虑

### 1. 会员验证

- **有效期检查**：每层分成前验证会员是否过期
- **代数检查**：验证推荐人的可拿代数是否覆盖该层
- **自动降级**：无效会员不参与分成，份额并入国库

### 2. 资金安全

- **KeepAlive保护**：所有转账使用 `KeepAlive`，避免账户被销毁
- **转账失败处理**：转账失败的份额并入国库，不丢失
- **精度控制**：向下取整，确保不超发

### 3. 权限控制

- **Root权限**：只有Root可以设置分成比例
- **比例验证**：确保总和不超过100%，层数不超过15

### 4. 防止攻击

- **推荐环检测**：依赖 `pallet-memo-referrals` 的循环检测
- **防自推**：`pallet-memo-referrals` 保证不能推荐自己
- **代数封顶**：最多15层，防止无限递归

---

## 🛠️ 前端集成示例

### 查询分成比例配置

```typescript
// 查询当前分成比例
const percents = await api.query.affiliateInstant.levelPercents();
console.log('分成比例:', percents.toJSON());
```

### 查询统计数据

```typescript
// 查询累计分成总额
const totalDistributed = await api.query.affiliateInstant.totalDistributed();
console.log('累计分成:', totalDistributed.toString());

// 查询累计销毁总额
const totalBurned = await api.query.affiliateInstant.totalBurned();
console.log('累计销毁:', totalBurned.toString());
```

### 监听分成事件

```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    
    if (api.events.affiliateInstant.RewardDistributed.is(event)) {
      const [to, level, amount, buyer] = event.data;
      console.log(`第${level}层推荐人 ${to} 收到 ${amount} 奖励（来自 ${buyer}）`);
    }
    
    if (api.events.affiliateInstant.DistributionCompleted.is(event)) {
      const [buyer, originalPrice, actualPaid, totalDistributed] = event.data;
      console.log(`分成完成：原价 ${originalPrice}，实付 ${actualPaid}，总分配 ${totalDistributed}`);
    }
  });
});
```

---

## 📝 待优化事项

### 1. 动态分成比例

**当前状态：** 固定比例配置

**优化方向：**
- 根据会员等级调整分成比例
- 不同消费类型使用不同比例
- 基于时间或活跃度的动态调整

### 2. 分成池累积

**当前状态：** 立即分配

**优化方向：**
- 支持分成池累积模式
- 达到阈值后批量分配
- 节省gas费用

### 3. 分成记录查询

**当前状态：** 仅通过事件查询

**优化方向：**
- 链上存储分成历史
- 按账户/时间查询分成记录
- 生成分成报表

---

## 📚 相关文档

- [年费会员系统技术实施方案](/docs/年费会员系统技术实施方案.md)
- [pallet-membership](/pallets/membership/README.md)
- [pallet-memo-referrals](/pallets/memo-referrals/README.md)
- [pallet-memo-affiliate](/pallets/memo-affiliate/README.md)

---

**版本：** v0.1.0  
**创建日期：** 2025-10-06  
**最后更新：** 2025-10-06  
**维护者：** Memopark Team  
**许可证：** Apache-2.0

