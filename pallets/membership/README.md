# Pallet Membership

**年费会员系统 - 完整文档**

## 模块概述

**pallet-membership** 是 Stardust 纪念公园生态系统的核心年费会员系统，实现了完整的四级会员体系、推荐关系管理、动态代数增长机制和会员折扣管理。该模块与 `pallet-affiliate`（联盟计酬系统）和 `pallet-pricing`（定价系统）紧密集成，提供稳定的 USDT 定价和灵活的推荐奖励机制。

### 核心特性

1. **四级会员制度**：Year1（1年）、Year3（3年）、Year5（5年）、Year10（10年）
2. **USDT 固定定价**：基于稳定币定价，DUST 数量动态计算（2025-11-10 新增）
3. **持币门槛验证**：有效会员需持有价值≥100美元的 DUST（2025-11-10 新增）
4. **动态代数增长**：推荐越多拿越多，最多15代
5. **会员折扣管理**：默认2折优惠，适用于供奉等消费场景
6. **补升级机制**：低等级会员可补差价升级到10年会员
7. **联盟计酬集成**：购买会员时触发100%推荐链分成

---

## 核心功能详解

### 1. 四级会员制度

#### 1.1 会员等级定义

| 等级 | USDT 价格 | 动态 DUST | 有效期 | 基础代数 | 推荐增长空间 |
|-----|----------|----------|-------|---------|------------|
| **Year1** | $50 USD | 动态计算 | 1年 | 6代 | 可增长至15代（+9代） |
| **Year3** | $100 USD | 动态计算 | 3年 | 9代 | 可增长至15代（+6代） |
| **Year5** | $200 USD | 动态计算 | 5年 | 12代 | 可增长至15代（+3代） |
| **Year10** | $300 USD | 动态计算 | 10年 | 15代 | 已满级，无增长空间 |

#### 1.2 会员权益对比

| 权益项 | Year1 | Year3 | Year5 | Year10 |
|-------|-------|-------|-------|--------|
| **供奉折扣** | ✅ 2折 | ✅ 2折 | ✅ 2折 | ✅ 2折 |
| **OTC交易费用折扣** | ✅ | ✅ | ✅ | ✅ |
| **推荐收益** | 最多15代 | 最多15代 | 最多15代 | 固定15代 |
| **有效期** | 1年 | 3年 | 5年 | 10年 |
| **初始代数** | 6代 | 9代 | 12代 | 15代（满级） |
| **推荐增长潜力** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐（已满级） |
| **性价比** | 入门首选 | 进阶首选 | 高级首选 | 终身首选 |

#### 1.3 适用场景建议

**Year1（入门级）**：
- 适合：初次体验用户、观望者
- 优点：价格低廉、门槛低
- 缺点：有效期短、初始代数少
- 推荐人群：新用户、小额投资者

**Year3（进阶级）**：
- 适合：长期规划用户、中等投入者
- 优点：性价比高、有效期适中、初始代数9代
- 缺点：需要推荐6人才能满级
- 推荐人群：有推广能力的用户、团队领导者

**Year5（高级）**：
- 适合：团队核心成员、大额投资者
- 优点：有效期长、初始代数高（12代）
- 缺点：价格较高
- 推荐人群：社区活跃用户、KOL

**Year10（终身级）**：
- 适合：项目深度参与者、顶级推广者
- 优点：有效期最长（10年）、初始满级（15代）、无需推荐增长
- 缺点：价格最高
- 推荐人群：项目方核心伙伴、超级节点、社区领袖

---

### 2. USDT 动态定价机制（2025-11-10 新增）

#### 2.1 定价模式变革

**旧模式（已废弃）**：
```
固定 DUST 数量 → 浮动 USD 价值
问题：DUST 价格波动导致实际支付价值不稳定
```

**新模式（已实施）**：
```
固定 USD 价值 → 浮动 DUST 数量
优势：用户始终支付相同的美元价值，公平性高
```

#### 2.2 定价计算公式

**核心公式**：
```rust
需要DUST = (USDT价格 × UNITS) / DUST市场价格
```

**详细说明**：
- **USDT价格**：固定价格（Year1=$50, Year3=$100, Year5=$200, Year10=$300）
- **UNITS**：DUST 代币精度（1 DUST = 10^12）
- **DUST市场价格**：从 `pallet-pricing` 获取的加权平均价格（精度 10^6）

#### 2.3 定价示例

假设 DUST 市场价格为 **0.0001 USDT/DUST**（即 100，精度 10^6）：

| 等级 | USDT价格 | DUST市场价格 | 计算公式 | 需要 DUST |
|-----|---------|------------|---------|----------|
| Year1 | $50 | 0.0001 | (50,000,000 × 10^12) / 100 | 500,000 DUST |
| Year3 | $100 | 0.0001 | (100,000,000 × 10^12) / 100 | 1,000,000 DUST |
| Year5 | $200 | 0.0001 | (200,000,000 × 10^12) / 100 | 2,000,000 DUST |
| Year10 | $300 | 0.0001 | (300,000,000 × 10^12) / 100 | 3,000,000 DUST |

**价格自适应示例**：

| DUST价格变化 | Year1 需要 DUST | Year3 需要 DUST | Year5 需要 DUST | Year10 需要 DUST |
|-------------|----------------|----------------|----------------|-----------------|
| 0.0001 USDT | 500,000 | 1,000,000 | 2,000,000 | 3,000,000 |
| 0.0002 USDT | 250,000 | 500,000 | 1,000,000 | 1,500,000 |
| 0.00005 USDT | 1,000,000 | 2,000,000 | 4,000,000 | 6,000,000 |

#### 2.4 定价策略（三级回退机制）

```rust
// 策略1：动态 USDT 定价（优先）
match Self::calculate_dust_amount_from_usdt(level) {
    Ok(dynamic_price) => return dynamic_price,
    Err(_) => {
        // 策略2：存储价格（治理设置）
        if let Some(stored_price) = MembershipPrices::<T>::get(level) {
            return stored_price;
        }

        // 策略3：默认价格（硬编码回退）
        return default_price;
    }
}
```

**回退优先级**：
1. **动态 USDT 定价**：基于 `pallet-pricing` 实时市场价格计算（推荐）
2. **存储价格**：治理通过 `set_membership_price` 设置的固定价格
3. **默认价格**：硬编码的回退价格（Year1=400 DUST, Year3=800 DUST, 等）

#### 2.5 价格查询事件

```rust
// 成功事件：动态价格计算完成
Event::DynamicPriceCalculated {
    level_id: 0,
    usdt_price: 50_000_000,          // $50 USD
    dust_market_price: 100,          // 0.0001 USDT/DUST
    dust_amount: 500_000_000_000_000_000, // 500,000 DUST
}

// 回退事件：使用回退价格
Event::PriceCalculationFallback {
    level_id: 0,
    fallback_price: 400_000_000_000_000_000, // 400 DUST（默认价格）
}
```

---

### 3. 持币门槛机制（2025-11-10 新增）

#### 3.1 核心变更

**原有机制**：
- 验证维度：会员存在性 + 时效性
- 门槛：无持币要求

**新机制（已实施）**：
- 验证维度：会员存在性 + 时效性 + **持币价值**
- 门槛：持币价值 ≥ **$100 USD**（动态计算）
- 价格来源：`pallet-pricing` 加权平均价格

#### 3.2 持币价值计算

**计算公式**：
```rust
持币价值(美分) = (余额 × DUST价格 × 100) / (10^12 × 10^6)
              = (余额 × DUST价格) / 10^16
```

**参数说明**：
- **余额**：账户 DUST 余额（精度 10^12）
- **DUST价格**：USDT/DUST 市场价格（精度 10^6）
- **10^16**：精度换算因子（10^12 × 10^6 / 100）

**示例计算**：
```
余额：1,000,000 DUST（= 1,000,000 × 10^12）
DUST价格：0.0001 USDT（= 100 × 10^6 精度）
持币价值：(1,000,000 × 10^12 × 100 × 100) / 10^18 = 100 美元 ✅
```

#### 3.3 持币门槛验证逻辑

```rust
pub fn is_member_valid(who: &T::AccountId) -> bool {
    if let Some(membership) = Memberships::<T>::get(who) {
        // 验证1：会员未过期
        let current_block = <frame_system::Pallet<T>>::block_number();
        if current_block > membership.valid_until {
            return false;
        }

        // 验证2：持币价值 ≥ $100 USD
        Self::check_holding_value(who)
    } else {
        false
    }
}

fn check_holding_value(who: &T::AccountId) -> bool {
    let balance = T::Currency::free_balance(who);
    let dust_price_usdt = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();
    let holding_value_cents = balance
        .saturating_mul(dust_price_usdt)
        .saturating_mul(100)
        .checked_div(10^18)
        .unwrap_or(0);

    holding_value_cents >= 10000 // $100 USD = 10000 美分
}
```

#### 3.4 持币价值查询

**查询函数**：
```rust
// 获取账户持币价值（美元，两位小数）
pub fn get_holding_value_usd(who: &T::AccountId) -> (u64, u32);
```

**返回值**：
- `(dollars, cents)`：例如 `(123, 45)` 表示 $123.45

**示例**：
```rust
let (dollars, cents) = Membership::get_holding_value_usd(&alice);
println!("持币价值：${}.{:02}", dollars, cents);
// 输出：持币价值：$123.45
```

#### 3.5 影响说明

| 用户类型 | 影响 | 应对措施 |
|---------|-----|---------|
| **现有会员** | 需保持余额使得持币价值≥$100 | 及时充值，保持余额 |
| **新会员** | 购买会员后需持有足够DUST | 购买时计算所需余额 |
| **余额不足用户** | 暂时失去权益（折扣、推荐收益） | 充值后自动恢复权益 |
| **高余额用户** | 无影响 | 无需操作 |

---

### 4. 动态代数增长机制

#### 4.1 增长规则

**核心公式**：
```
总代数 = 基础代数 + 奖励代数（最多15代）
奖励代数 = 推荐人数（每推荐1人+1代）
```

**约束条件**：
- 总代数上限：**15代**
- 10年会员：初始即15代，不再增长

#### 4.2 增长示例

**Year1 会员（基础6代）**：

| 推荐人数 | 奖励代数 | 总代数 | 说明 |
|---------|---------|--------|-----|
| 0 | 0 | 6 | 初始状态 |
| 1 | 1 | 7 | 推荐1人 |
| 5 | 5 | 11 | 推荐5人 |
| 9 | 9 | 15 | 推荐9人，达到上限 |
| 10+ | 9 | 15 | 超过9人不再增长 |

**Year3 会员（基础9代）**：

| 推荐人数 | 奖励代数 | 总代数 | 说明 |
|---------|---------|--------|-----|
| 0 | 0 | 9 | 初始状态 |
| 3 | 3 | 12 | 推荐3人 |
| 6 | 6 | 15 | 推荐6人，达到上限 |
| 7+ | 6 | 15 | 超过6人不再增长 |

**Year5 会员（基础12代）**：

| 推荐人数 | 奖励代数 | 总代数 | 说明 |
|---------|---------|--------|-----|
| 0 | 0 | 12 | 初始状态 |
| 1 | 1 | 13 | 推荐1人 |
| 3 | 3 | 15 | 推荐3人，达到上限 |
| 4+ | 3 | 15 | 超过3人不再增长 |

**Year10 会员（基础15代）**：

| 推荐人数 | 奖励代数 | 总代数 | 说明 |
|---------|---------|--------|-----|
| 任意 | 0 | 15 | 初始即满级，不再增长 |

#### 4.3 增长算法实现

```rust
fn increase_referrer_generation(referrer: &T::AccountId) -> DispatchResult {
    Memberships::<T>::try_mutate(referrer, |maybe_membership| -> DispatchResult {
        if let Some(ref mut membership) = maybe_membership {
            // 每推荐一个会员，增加1代
            membership.bonus_generations = membership.bonus_generations.saturating_add(1);

            // 重新计算总代数（最多15代）
            membership.total_generations = 15u8.min(
                membership.base_generations.saturating_add(membership.bonus_generations)
            );

            // 增加推荐计数
            membership.referral_count = membership.referral_count.saturating_add(1);

            // 发出事件
            Self::deposit_event(Event::GenerationIncreased {
                who: referrer.clone(),
                bonus: membership.bonus_generations,
                total: membership.total_generations,
            });
        }
        Ok(())
    })
}
```

#### 4.4 代数应用场景

**联盟计酬分配**：
```rust
// 获取会员可拿代数
let generations = Membership::get_member_generations(&alice);

// 分配时使用该代数
if let Some(gen) = generations {
    // 最多分配 gen 代推荐人
    for i in 0..gen {
        // 分配逻辑
    }
}
```

---

### 5. 会员折扣管理

#### 5.1 默认折扣

- **默认值**：20%（即2折）
- **配置范围**：0-100（0% 到 100%）
- **应用场景**：
  - 供奉系统（`pallet-memorial`）
  - OTC交易系统（`pallet-otc-order`）
  - 其他消费场景

#### 5.2 折扣计算示例

| 原价 | 折扣比例 | 折后价 |
|-----|---------|--------|
| 100 DUST | 20% | 20 DUST |
| 500 DUST | 20% | 100 DUST |
| 1000 DUST | 20% | 200 DUST |

#### 5.3 折扣查询

```rust
// 获取会员折扣比例
let discount = Membership::get_discount(); // 返回 20

// 计算折后价
let original_price = 100_000_000_000_000; // 100 DUST
let discounted_price = original_price
    .saturating_mul(discount as u128)
    .saturating_div(100);
// discounted_price = 20_000_000_000_000 (20 DUST)
```

#### 5.4 折扣更新（Root权限）

```rust
// 设置会员折扣为 30%（3折）
membership.set_member_discount(root_origin, 30)?;

// 事件：DiscountUpdated { discount: 30 }
```

---

### 6. 补升级机制

#### 6.1 升级规则

**适用对象**：Year1/Year3/Year5 会员

**升级价格计算（基于 USDT）**：
```rust
// 升级价格 = Year10价格 - 当前等级价格 + 服务费(20%)
let current_usdt = membership.level.price_in_usdt();
let year10_usdt = MembershipLevel::Year10.price_in_usdt();
let price_diff = year10_usdt.saturating_sub(current_usdt);
let service_fee = price_diff.saturating_mul(20).saturating_div(100);
let total_usdt_price = price_diff.saturating_add(service_fee);
```

#### 6.2 升级价格示例（假设 DUST = 0.0001 USDT）

| 当前等级 | 当前价格 | Year10价格 | 差价 | 服务费(20%) | 总USDT | 需要DUST |
|---------|---------|-----------|-----|-----------|--------|---------|
| Year1 | $50 | $300 | $250 | $50 | $300 | 3,000,000 |
| Year3 | $100 | $300 | $200 | $40 | $240 | 2,400,000 |
| Year5 | $200 | $300 | $100 | $20 | $120 | 1,200,000 |

#### 6.3 升级效果

| 效果项 | 变化 |
|-------|-----|
| **会员等级** | → Year10 |
| **有效期** | 从当前时间重新计算10年 |
| **基础代数** | → 15代 |
| **总代数** | → 15代（固定） |
| **推荐增长** | 不再享受代数增长奖励 |

#### 6.4 升级流程

```rust
// 用户调用升级接口
membership.upgrade_to_year10(origin)?;

// 内部流程：
// 1. 获取当前会员信息
// 2. 验证不是已经是10年会员
// 3. 计算升级费用（基于USDT动态计算DUST）
// 4. 扣费到国库账户
// 5. 更新会员信息（等级、代数、有效期）
// 6. 更新统计数据
// 7. 发出事件
```

---

## 数据结构

### 1. 存储项

| 存储 | 类型 | 描述 | 默认值 |
|-----|------|-----|-------|
| `Memberships` | `StorageMap<AccountId, MembershipInfo>` | 会员信息映射 | - |
| `TotalMembers` | `StorageMap<MembershipLevel, u32>` | 会员统计（按等级） | 0 |
| `MemberDiscount` | `u8` | 会员折扣比例（0-100） | 20 |
| `MembershipPrices` | `StorageMap<MembershipLevel, Balance>` | 会员价格存储（治理设置） | None |

### 2. MembershipInfo 结构

```rust
pub struct MembershipInfo<AccountId, BlockNumber> {
    /// 会员等级（Year1/Year3/Year5/Year10）
    pub level: MembershipLevel,

    /// 购买时间（区块高度）
    pub purchased_at: BlockNumber,

    /// 有效期至（区块高度）
    pub valid_until: BlockNumber,

    /// 基础代数（根据等级固定：6/9/12/15）
    pub base_generations: u8,

    /// 奖励代数（通过推荐获得：每推荐1人+1代）
    pub bonus_generations: u8,

    /// 总代数（base + bonus，最多15代）
    pub total_generations: u8,

    /// 推荐人账户（可选，创始会员/种子会员无推荐人）
    pub referrer: Option<AccountId>,

    /// 已推荐会员数量
    pub referral_count: u32,
}
```

### 3. MembershipLevel 枚举

```rust
pub enum MembershipLevel {
    /// 年费会员：$50 USDT，基础6代，有效期1年
    Year1,

    /// 3年会员：$100 USDT，基础9代，有效期3年
    Year3,

    /// 5年会员：$200 USDT，基础12代，有效期5年
    Year5,

    /// 10年会员：$300 USDT，基础15代，有效期10年
    Year10,
}
```

**核心方法**：
```rust
impl MembershipLevel {
    // 🆕 获取 USDT 价格（精度 10^6）
    pub fn price_in_usdt(&self) -> u64;

    // ⚠️ 已废弃：获取 DUST 价格（保留兼容性）
    #[deprecated]
    pub fn price_in_units(&self) -> u128;

    // 获取基础代数（6/9/12/15）
    pub fn base_generations(&self) -> u8;

    // 获取有效期（年）
    pub fn years(&self) -> u32;

    // 转换为 ID（0/1/2/3）
    pub fn to_id(&self) -> u8;
}
```

---

## 主要调用方法（API）

### 1. 用户接口

#### 1.1 购买会员

```rust
#[pallet::call_index(0)]
pub fn purchase_membership(
    origin: OriginFor<T>,
    level_id: u8,           // 0=Year1, 1=Year3, 2=Year5, 3=Year10
    referral_code: Vec<u8>, // 推荐码（必填）
) -> DispatchResult;
```

**参数说明**：
- `level_id`：会员等级（0=Year1, 1=Year3, 2=Year5, 3=Year10）
- `referral_code`：推荐码（必填，6-20字符）

**流程**：
1. 验证不能重复购买
2. 验证推荐码合法性（通过 `pallet-affiliate` 查询）
3. 验证推荐人是有效会员
4. 计算价格（基于 USDT 动态计算 DUST 数量）
5. 转账到联盟托管账户（`pallet-affiliate`）
6. 绑定推荐关系（`pallet-affiliate::bind_sponsor_internal`）
7. 创建会员信息
8. 增加推荐人的奖励代数
9. 触发联盟计酬分配（100%推荐链）
10. 发出 `MembershipPurchased` 事件

**错误**：
- `AlreadyMember`：已经是会员
- `InvalidReferralCode`：推荐码不存在或无效
- `ReferrerNotValid`：推荐人不是有效会员

#### 1.2 补升级到10年会员

```rust
#[pallet::call_index(1)]
pub fn upgrade_to_year10(origin: OriginFor<T>) -> DispatchResult;
```

**适用对象**：Year1/Year3/Year5 会员

**流程**：
1. 获取当前会员信息
2. 验证不是已经是10年会员
3. 计算升级费用（基于 USDT 动态计算 DUST）
4. 扣费到国库账户
5. 更新会员信息（等级、代数、有效期）
6. 更新统计数据
7. 发出 `MembershipUpgraded` 事件

**错误**：
- `NotMember`：不是会员
- `AlreadyYear10`：已经是10年会员
- `CannotUpgrade`：无法升级

---

### 2. 治理接口（Root/委员会权限）

#### 2.1 设置会员折扣

```rust
#[pallet::call_index(2)]
pub fn set_member_discount(
    origin: OriginFor<T>,
    discount: u8, // 折扣比例（0-100）
) -> DispatchResult;
```

**权限**：Root

**示例**：
```rust
// 设置会员折扣为 30%（3折）
membership.set_member_discount(root_origin, 30)?;
```

**错误**：
- `InvalidDiscount`：折扣比例超出范围（必须0-100）

#### 2.2 设置单个会员价格

```rust
#[pallet::call_index(3)]
pub fn set_membership_price(
    origin: OriginFor<T>,
    level_id: u8,       // 0=Year1, 1=Year3, 2=Year5, 3=Year10
    price_units: u128,  // 价格（DUST 单位数，非最小单位）
) -> DispatchResult;
```

**权限**：治理起源（Root 或委员会 2/3 多数）

**示例**：
```rust
// 设置 Year1 价格为 400 DUST
membership.set_membership_price(gov_origin, 0, 400)?;
```

**约束**：
- 价格必须在 `MinMembershipPrice` 和 `MaxMembershipPrice` 之间

**错误**：
- `PriceOutOfRange`：价格超出允许范围

#### 2.3 批量设置会员价格

```rust
#[pallet::call_index(4)]
pub fn set_all_membership_prices(
    origin: OriginFor<T>,
    year1_units: u128,
    year3_units: u128,
    year5_units: u128,
    year10_units: u128,
) -> DispatchResult;
```

**权限**：治理起源（Root 或委员会 2/3 多数）

**示例**：
```rust
// 批量设置：400, 800, 1600, 2000 DUST
membership.set_all_membership_prices(gov_origin, 400, 800, 1600, 2000)?;
```

#### 2.4 添加种子会员

```rust
#[pallet::call_index(5)]
pub fn add_seed_member(
    origin: OriginFor<T>,
    who: T::AccountId,
    level_id: u8,       // 0=Year1, 1=Year3, 2=Year5, 3=Year10
) -> DispatchResult;
```

**权限**：Root

**用途**：创建初始种子会员（如：项目方账户、KOL账户）

**特点**：
- 无需推荐人
- 无需支付费用
- 用于启动推荐网络

**示例**：
```rust
// 添加种子会员（Year10）
membership.add_seed_member(root_origin, alice_account, 3)?;
```

---

### 3. 查询接口

#### 3.1 检查会员有效性

```rust
pub fn is_member_valid(who: &T::AccountId) -> bool;
```

**🆕 2025-11-10 变更**：新增持币门槛验证

**验证逻辑**：
1. 会员存在性验证
2. 会员时效性验证（未过期）
3. **持币价值验证**（≥ $100 USD）

**返回值**：
- `true`：有效会员（已购买、未过期、持币价值≥$100）
- `false`：不是会员、已过期或持币价值不足

#### 3.2 获取会员可拿代数

```rust
pub fn get_member_generations(who: &T::AccountId) -> Option<u8>;
```

**返回值**：
- `Some(代数)`：有效会员的总代数（用于联盟计酬分配）
- `None`：不是会员或已过期

#### 3.3 获取会员折扣

```rust
pub fn get_discount() -> u8;
```

**返回值**：折扣比例（0-100，例如20表示20%）

#### 3.4 获取会员价格

```rust
pub fn get_membership_price(level: MembershipLevel) -> BalanceOf<T>;
```

**返回值**：价格（最小单位）

**定价策略（三级回退）**：
1. **动态 USDT 定价**：基于 `pallet-pricing` 实时市场价格计算（优先）
2. **存储价格**：治理设置的固定价格
3. **默认价格**：硬编码的回退价格

#### 3.5 获取持币价值（🆕 2025-11-10）

```rust
pub fn get_holding_value_usd(who: &T::AccountId) -> (u64, u32);
```

**返回值**：`(dollars, cents)`，例如 `(123, 45)` 表示 $123.45

**用途**：
- 前端显示用户持币价值
- 监控持币门槛状态
- 用户实时查看是否满足100美元门槛

---

## 事件定义

| 事件名 | 参数 | 描述 |
|-------|-----|-----|
| `MembershipPurchased` | `who`, `level_id`, `valid_until`, `referrer` | 购买会员成功 |
| `MembershipUpgraded` | `who`, `from_id`, `to_id`, `new_valid_until` | 会员升级成功 |
| `GenerationIncreased` | `who`, `bonus`, `total` | 推荐代数增加 |
| `DiscountUpdated` | `discount` | 会员折扣更新 |
| `MembershipPriceUpdated` | `level_id`, `price` | 会员价格更新 |
| `BatchPricesUpdated` | `count` | 批量价格更新 |
| `SeedMemberAdded` | `who`, `level_id` | 种子会员已添加 |
| 🆕 `DynamicPriceCalculated` | `level_id`, `usdt_price`, `dust_market_price`, `dust_amount` | 动态价格计算完成 |
| 🆕 `PriceCalculationFallback` | `level_id`, `fallback_price` | 价格计算失败，使用回退价格 |

---

## 错误定义

| 错误 | 描述 |
|-----|-----|
| `AlreadyMember` | 已经是会员（不允许重复购买） |
| `NotMember` | 不是会员 |
| `InvalidReferralCode` | 无效的推荐码 |
| `ReferralCodeTooLong` | 推荐码太长 |
| `ReferrerNotValid` | 推荐人无效（不是会员或已过期） |
| `AlreadyYear10` | 已经是10年会员，无法升级 |
| `CannotUpgrade` | 无法升级 |
| `MembershipExpired` | 会员已过期 |
| `InvalidDiscount` | 折扣比例无效（必须0-100） |
| `ReferralCodeExists` | 推荐码已存在 |
| `PriceOutOfRange` | 价格超出允许范围（过低或过高） |
| `PriceNotSet` | 价格未设置（治理需要初始化） |
| 🆕 `MarketPriceNotAvailable` | 市场价格不可用（pallet-pricing 未初始化或为0） |
| 🆕 `PriceCalculationFailed` | 价格计算失败（溢出或计算错误） |

---

## 配置参数

### Runtime 配置

```rust
impl pallet_membership::Config for Runtime {
    /// 货币系统（MEMO代币）
    type Currency = Balances;

    /// Pallet ID，用于派生国库账户
    type PalletId = MembershipPalletId;

    /// 每年的区块数（用于计算有效期）
    /// 假设6秒一个块：365 * 24 * 60 * 60 / 6 ≈ 5,256,000
    type BlocksPerYear = ConstU32<5_256_000>;

    /// DUST 代币单位（1 DUST = 10^12）
    type Units = ConstU128<1_000_000_000_000>;

    /// 联盟计酬系统关联类型
    type AffiliateConfig = Runtime;

    /// 治理起源（Root 或委员会 2/3 多数）
    type GovernanceOrigin = EnsureRootOrTwoThirdsCouncil;

    /// 最低会员价格（防止设置为0或过低）
    type MinMembershipPrice = ConstU128<100_000_000_000_000>; // 100 DUST

    /// 最高会员价格（防止恶意设置过高）
    type MaxMembershipPrice = ConstU128<10_000_000_000_000_000>; // 10,000 DUST

    /// 联盟计酬 PalletId
    type AffiliatePalletId = AffiliatePalletId;

    /// 🆕 2025-11-10：价格查询系统（指向 Runtime）
    type PricingConfig = Runtime;

    /// 🆕 2025-11-10：最低持币价值（美分，默认10000=100美元）
    type MinHoldingValueCents = ConstU64<10_000>; // $100 USD

    /// 权重信息
    type WeightInfo = pallet_membership::weights::SubstrateWeight<Runtime>;
}
```

---

## 使用示例

### 1. 购买会员

#### 示例1：购买 Year1 会员

```rust
use frame_support::assert_ok;

// Alice 使用 Bob 的推荐码购买 Year1 会员
let referral_code = b"BOB_CODE".to_vec();

assert_ok!(Membership::purchase_membership(
    RuntimeOrigin::signed(alice_account),
    0, // level_id: Year1
    referral_code,
));

// 验证会员信息
let membership = Membership::memberships(&alice_account).unwrap();
assert_eq!(membership.level, MembershipLevel::Year1);
assert_eq!(membership.base_generations, 6);
assert_eq!(membership.total_generations, 6);

// 验证推荐人的代数增长
let bob_membership = Membership::memberships(&bob_account).unwrap();
assert_eq!(bob_membership.bonus_generations, 1); // +1代
assert_eq!(bob_membership.referral_count, 1); // 推荐1人
```

#### 示例2：购买 Year10 会员（终身级）

```rust
assert_ok!(Membership::purchase_membership(
    RuntimeOrigin::signed(charlie_account),
    3, // level_id: Year10
    referral_code,
));

// 验证会员信息
let membership = Membership::memberships(&charlie_account).unwrap();
assert_eq!(membership.level, MembershipLevel::Year10);
assert_eq!(membership.base_generations, 15); // 满级
assert_eq!(membership.total_generations, 15); // 满级，不再增长
```

---

### 2. 补升级到10年会员

```rust
// Alice（Year1会员）补升级到 Year10
assert_ok!(Membership::upgrade_to_year10(
    RuntimeOrigin::signed(alice_account),
));

// 验证升级结果
let membership = Membership::memberships(&alice_account).unwrap();
assert_eq!(membership.level, MembershipLevel::Year10);
assert_eq!(membership.base_generations, 15); // 升级后满级
assert_eq!(membership.total_generations, 15); // 升级后满级
```

---

### 3. 设置会员价格（治理）

#### 示例1：单个价格设置

```rust
// 治理设置 Year1 价格为 500 DUST
assert_ok!(Membership::set_membership_price(
    RuntimeOrigin::root(),
    0, // level_id: Year1
    500, // 500 DUST
));

// 验证价格
let price = Membership::membership_price(MembershipLevel::Year1).unwrap();
assert_eq!(price, 500 * UNITS); // 500 DUST（最小单位）
```

#### 示例2：批量价格设置

```rust
// 治理批量设置：400, 800, 1600, 2000 DUST
assert_ok!(Membership::set_all_membership_prices(
    RuntimeOrigin::root(),
    400,  // Year1
    800,  // Year3
    1600, // Year5
    2000, // Year10
));
```

---

### 4. 添加种子会员（Root）

```rust
// Root 添加 Alice 为种子会员（Year10）
assert_ok!(Membership::add_seed_member(
    RuntimeOrigin::root(),
    alice_account,
    3, // level_id: Year10
));

// 验证种子会员
let membership = Membership::memberships(&alice_account).unwrap();
assert_eq!(membership.level, MembershipLevel::Year10);
assert!(membership.referrer.is_none()); // 无推荐人
```

---

### 5. 查询会员信息

#### 示例1：检查会员有效性

```rust
// 检查 Alice 是否是有效会员
let is_valid = Membership::is_member_valid(&alice_account);
assert!(is_valid);

// 检查持币价值是否满足门槛
let (dollars, cents) = Membership::get_holding_value_usd(&alice_account);
println!("持币价值：${}.{:02}", dollars, cents);
// 示例输出：持币价值：$123.45
```

#### 示例2：获取会员可拿代数

```rust
// 获取 Alice 的可拿代数
let generations = Membership::get_member_generations(&alice_account);
assert_eq!(generations, Some(6)); // Year1 初始6代
```

#### 示例3：获取会员折扣

```rust
// 获取会员折扣比例
let discount = Membership::get_discount();
assert_eq!(discount, 20); // 默认20%（2折）
```

#### 示例4：获取会员价格

```rust
// 获取 Year1 价格（动态计算）
let price = Membership::get_membership_price(MembershipLevel::Year1);
println!("Year1 价格：{} DUST", price / UNITS);
// 示例输出：Year1 价格：500000 DUST（假设 DUST = 0.0001 USDT）
```

---

### 6. 前端集成示例

#### 示例1：显示会员信息

```typescript
import { api } from '@/lib/providers';

// 查询会员信息
const membership = await api.query.membership.memberships(alice_address);

if (membership.isSome) {
    const info = membership.unwrap();
    console.log('会员等级：', info.level.toString());
    console.log('有效期至：', info.validUntil.toString());
    console.log('总代数：', info.totalGenerations.toString());
    console.log('推荐人数：', info.referralCount.toString());
}
```

#### 示例2：购买会员（前端）

```typescript
// 购买 Year1 会员
const tx = api.tx.membership.purchaseMembership(
    0, // level_id: Year1
    'BOB_CODE', // 推荐码
);

await tx.signAndSend(alice_account, ({ status, events }) => {
    if (status.isInBlock) {
        console.log('交易已打包到区块');

        // 监听 MembershipPurchased 事件
        events.forEach(({ event }) => {
            if (api.events.membership.MembershipPurchased.is(event)) {
                const [who, level_id, valid_until, referrer] = event.data;
                console.log(`${who} 购买了 ${level_id} 级会员`);
            }
        });
    }
});
```

#### 示例3：显示持币价值（🆕 2025-11-10）

```typescript
// 查询持币价值
const [dollars, cents] = await api.query.membership.getHoldingValueUsd(alice_address);
const holdingValue = `$${dollars}.${cents.toString().padStart(2, '0')}`;

// UI 提示
if (dollars < 100) {
    return (
        <Alert type="warning">
            当前持币价值：{holdingValue}
            <br />
            距离门槛还需：${(100 - dollars).toFixed(2)}
            <Button onClick={handleDeposit}>立即充值</Button>
        </Alert>
    );
}
```

---

## 集成说明

### 1. 与 pallet-affiliate 集成

#### 1.1 推荐关系管理

```rust
// 购买会员时绑定推荐关系
pallet_affiliate::Pallet::<T::AffiliateConfig>::bind_sponsor_internal(&who, &referrer);
```

#### 1.2 推荐码查询

```rust
// 验证推荐码
let referrer_account = pallet_affiliate::Pallet::<T::AffiliateConfig>::find_account_by_code(&code_bounded)
    .ok_or(Error::<T>::InvalidReferralCode)?;
```

#### 1.3 联盟计酬分配

```rust
// 购买会员时触发100%推荐链分成
// TODO: pallet-affiliate 需要实现 distribute_membership_rewards 公开方法
// pallet_affiliate::Pallet::<T>::do_distribute_membership_rewards(&who, price.into())?;
```

---

### 2. 与 pallet-pricing 集成（🆕 2025-11-10）

#### 2.1 动态价格计算

```rust
// 获取 DUST 市场价格（USDT/DUST，精度 10^6）
let dust_market_price = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();

// 计算所需 DUST 数量
let usdt_price = level.price_in_usdt();
let dust_amount = (usdt_price as u128)
    .saturating_mul(units)
    .checked_div(dust_market_price as u128)
    .ok_or(Error::<T>::PriceCalculationFailed)?;
```

#### 2.2 持币价值计算

```rust
// 获取账户余额
let balance = T::Currency::free_balance(who);

// 获取 DUST 市场价格
let dust_price_usdt = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();

// 计算持币价值（美分）
let holding_value_cents = balance
    .saturating_mul(dust_price_usdt)
    .saturating_mul(100)
    .checked_div(10^18)
    .unwrap_or(0);
```

---

### 3. 与 pallet-memorial 集成

#### 3.1 会员折扣验证

```rust
// 在供奉系统中应用会员折扣
let is_member = pallet_membership::Pallet::<T>::is_member_valid(&who);

if is_member {
    let discount = pallet_membership::Pallet::<T>::get_discount();
    let discounted_price = original_price
        .saturating_mul(discount as u128)
        .saturating_div(100);
    // 使用折后价
} else {
    // 使用原价
}
```

---

### 4. 与 pallet-otc-order 集成

#### 4.1 OTC交易费用折扣

```rust
// 在OTC交易中应用会员折扣
let is_member = pallet_membership::Pallet::<T>::is_member_valid(&who);

if is_member {
    // 会员享受交易费用折扣
    let discount = pallet_membership::Pallet::<T>::get_discount();
    let discounted_fee = original_fee
        .saturating_mul(discount as u128)
        .saturating_div(100);
}
```

---

## 最佳实践

### 1. 会员购买建议

**入门用户**：
- 推荐购买 Year1（$50 USDT）
- 低成本体验会员权益
- 观察推荐收益情况

**长期用户**：
- 推荐购买 Year3（$100 USDT）
- 性价比最高
- 有效期3年，无需频繁续费

**推广者**：
- 推荐购买 Year5 或 Year10
- 初始代数高，推荐收益更多
- Year10 初始即满级（15代）

**项目方/KOL**：
- 推荐购买 Year10（$300 USDT）
- 终身级会员，有效期10年
- 满级15代，推荐收益最大化

---

### 2. 代数增长策略

**Year1 会员（基础6代）**：
- 目标：推荐9人达到15代
- 策略：积极推广，快速增长代数
- 建议：达到15代后考虑升级到 Year10

**Year3 会员（基础9代）**：
- 目标：推荐6人达到15代
- 策略：稳定推广，中期增长
- 建议：达到15代后保持活跃度

**Year5 会员（基础12代）**：
- 目标：推荐3人达到15代
- 策略：精准推广，快速满级
- 建议：达到15代后享受最大收益

**Year10 会员（基础15代）**：
- 目标：无需增长，初始即满级
- 策略：专注推广，享受满级收益
- 建议：持续推广，最大化收益

---

### 3. 升级时机选择

**何时升级到 Year10？**

| 当前等级 | 推荐升级时机 |
|---------|------------|
| Year1 | 推荐人数≥9人（已达15代），或需要长期有效期 |
| Year3 | 推荐人数≥6人（已达15代），或需要长期有效期 |
| Year5 | 推荐人数≥3人（已达15代），或需要长期有效期 |

**升级优势**：
- 有效期从当前时间重新计算10年
- 代数立即提升至15代（无需推荐增长）
- 享受终身级会员权益

---

### 4. 持币门槛管理（🆕 2025-11-10）

**如何保持有效会员？**

1. **实时监控**：定期查询持币价值 `get_holding_value_usd`
2. **余额预警**：持币价值低于 $100 时及时充值
3. **价格波动**：DUST 价格下跌时，需要持有更多 DUST
4. **自动充值**：设置自动充值机制，保持余额

**示例**：
```rust
// 查询持币价值
let (dollars, cents) = Membership::get_holding_value_usd(&alice);

// 预警逻辑
if dollars < 100 {
    // 发送通知，提醒用户充值
    send_notification(&alice, "持币价值不足，请及时充值");
}
```

---

### 5. 前端集成最佳实践

#### 5.1 会员信息展示

```typescript
// 显示会员等级徽章
const levelBadge = {
    0: { name: 'Year1', color: 'blue' },
    1: { name: 'Year3', color: 'green' },
    2: { name: 'Year5', color: 'orange' },
    3: { name: 'Year10', color: 'gold' },
};

<Badge color={levelBadge[membership.level].color}>
    {levelBadge[membership.level].name}
</Badge>
```

#### 5.2 有效期倒计时

```typescript
// 计算剩余天数
const currentBlock = await api.query.system.number();
const remainingBlocks = membership.validUntil - currentBlock;
const remainingDays = Math.floor(remainingBlocks * 6 / 86400); // 6秒/块

<Text>剩余有效期：{remainingDays} 天</Text>
```

#### 5.3 推荐代数可视化

```typescript
// 显示代数进度条
const progress = (membership.totalGenerations / 15) * 100;

<Progress
    percent={progress}
    format={() => `${membership.totalGenerations}/15 代`}
/>
```

#### 5.4 持币价值监控

```typescript
// 实时显示持币价值
const [dollars, cents] = await api.query.membership.getHoldingValueUsd(alice);
const holdingValue = `$${dollars}.${cents.toString().padStart(2, '0')}`;
const isValid = dollars >= 100;

<Card>
    <Statistic
        title="持币价值"
        value={holdingValue}
        valueStyle={{ color: isValid ? '#3f8600' : '#cf1322' }}
        prefix={isValid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
    />
</Card>
```

---

## 未来扩展

### 1. 会员续费机制

- **自动续费**：到期前自动提醒续费
- **续费折扣**：老会员续费享受特殊折扣
- **批量续费**：支持多年续费优惠

### 2. 会员特权扩展

- **VIP专属祭祀品**：会员专属供奉品
- **优先客服**：会员享受优先客服服务
- **专属活动**：会员专属线上/线下活动

### 3. 会员等级升级路径优化

- **渐进式升级**：支持 Year1→Year3→Year5→Year10 的渐进式升级
- **升级折扣**：多次升级享受折扣优惠
- **灵活升级**：支持延长有效期而不改变等级

### 4. 会员NFT徽章

- **铸造徽章**：铸造会员等级NFT徽章
- **展示系统**：在个人主页展示NFT徽章
- **交易市场**：支持NFT徽章交易

### 5. 推荐排行榜

- **推荐统计**：统计推荐人数排行
- **激励机制**：Top推广者额外奖励
- **社区展示**：排行榜公开展示

### 6. 会员积分系统

- **积分累积**：根据会员活跃度累积积分
- **权益兑换**：积分兑换会员权益
- **等级加成**：高等级会员积分加成

---

## 技术细节

### 1. 区块高度计算

```rust
// 假设6秒一个块
// 1年 = 365 * 24 * 60 * 60 / 6 ≈ 5,256,000 块

// 计算有效期
let blocks_per_year = T::BlocksPerYear::get(); // 5,256,000
let valid_until = current_block.saturating_add(blocks_per_year.saturating_mul(level.years().into()));
```

### 2. 货币转账

```rust
// 转账到联盟托管账户
T::Currency::transfer(
    &who,
    &affiliate_account,
    price,
    ExistenceRequirement::KeepAlive,
)?;
```

### 3. 代数增长算法

```rust
// 总代数 = min(基础代数 + 奖励代数, 15)
membership.total_generations = 15u8.min(
    membership.base_generations.saturating_add(membership.bonus_generations)
);
```

### 4. USDT 动态定价算法

```rust
// 需要DUST = (USDT价格 × UNITS) / DUST市场价格
let usdt_price = level.price_in_usdt(); // 精度 10^6
let dust_market_price = pallet_pricing::get_dust_market_price_weighted(); // 精度 10^6
let units: u128 = T::Units::get().saturated_into(); // 10^12

let dust_amount_u128 = (usdt_price as u128)
    .saturating_mul(units)
    .checked_div(dust_market_price as u128)
    .ok_or(Error::<T>::PriceCalculationFailed)?;
```

### 5. 持币价值计算算法

```rust
// 持币价值(美分) = (余额 × DUST价格 × 100) / 10^18
let balance_u128: u128 = balance.saturated_into(); // 精度 10^12
let dust_price_usdt = pallet_pricing::get_dust_market_price_weighted(); // 精度 10^6

let holding_value_cents = balance_u128
    .saturating_mul(dust_price_usdt as u128)
    .saturating_mul(100) // 转换为美分
    .checked_div(1_000_000_000_000_000_000) // 除以 10^18
    .unwrap_or(0);
```

---

## 故障排查

### 1. 购买会员失败

**问题**：调用 `purchase_membership` 失败

**可能原因**：
- 推荐码无效（`InvalidReferralCode`）
- 推荐人不是有效会员（`ReferrerNotValid`）
- 已经是会员（`AlreadyMember`）
- 余额不足

**解决方案**：
1. 检查推荐码是否正确
2. 确认推荐人是有效会员（未过期、持币价值≥$100）
3. 检查账户余额是否足够

---

### 2. 会员验证失败

**问题**：`is_member_valid` 返回 `false`

**可能原因**：
- 会员已过期
- 持币价值不足（< $100 USD）
- 不是会员

**解决方案**：
1. 检查会员有效期
2. 查询持币价值 `get_holding_value_usd`
3. 如果持币价值不足，及时充值

---

### 3. 价格计算失败

**问题**：购买会员时价格异常

**可能原因**：
- `pallet-pricing` 未初始化
- DUST 市场价格为0
- 价格计算溢出

**解决方案**：
1. 确认 `pallet-pricing` 已正确初始化
2. 检查 DUST 市场价格是否有效
3. 查看 `PriceCalculationFallback` 事件，确认使用的回退价格

---

### 4. 升级失败

**问题**：调用 `upgrade_to_year10` 失败

**可能原因**：
- 已经是10年会员（`AlreadyYear10`）
- 不是会员（`NotMember`）
- 余额不足

**解决方案**：
1. 检查当前会员等级
2. 确认账户余额是否足够支付升级费用

---

## 相关资源

- **代码仓库**：`/home/xiaodong/文档/stardust/pallets/membership`
- **联盟计酬系统**：`/home/xiaodong/文档/stardust/pallets/affiliate`
- **定价系统**：`/home/xiaodong/文档/stardust/pallets/pricing`
- **供奉系统**：`/home/xiaodong/文档/stardust/pallets/memorial`
- **前端应用**：`/home/xiaodong/文档/stardust/stardust-dapp`

---

**维护者**：Stardust Team
**最后更新**：2025-11-10
**版本**：v4.0.0（支持 USDT 动态定价 + 持币门槛）

---

## 变更日志

### v4.0.0（2025-11-10）
- 🆕 新增 USDT 固定定价机制（基于 `pallet-pricing` 动态计算 DUST 数量）
- 🆕 新增持币门槛验证（持币价值≥$100 USD）
- 🆕 新增 `get_holding_value_usd` 查询接口
- 🆕 新增 `DynamicPriceCalculated` 和 `PriceCalculationFallback` 事件
- 🆕 新增 `MarketPriceNotAvailable` 和 `PriceCalculationFailed` 错误
- 🔧 重构价格计算逻辑（三级回退机制）
- 🔧 更新 `is_member_valid` 函数（增加持币价值验证）
- 🔧 更新升级价格计算（基于 USDT 价格差）

### v3.0.0（2025-10-28）
- 🔧 重构推荐关系管理（与 `pallet-affiliate` 集成）
- 🗑️ 移除 `ReferralCodeToAccount` 存储
- 🗑️ 移除推荐码生成逻辑（统一由 `pallet-affiliate` 管理）
- 🆕 新增 `add_seed_member` 接口（Root权限）

### v2.0.0（2025-10-01）
- 🆕 新增治理价格设置接口（`set_membership_price`, `set_all_membership_prices`）
- 🆕 新增价格范围验证（`MinMembershipPrice`, `MaxMembershipPrice`）
- 🔧 优化价格存储机制

### v1.0.0（2025-09-01）
- 🎉 初始版本发布
- ✅ 实现四级会员制度
- ✅ 实现动态代数增长机制
- ✅ 实现会员折扣管理
- ✅ 实现补升级机制
