# pallet-membership

## 📋 功能概述

年费会员系统模块，实现多等级会员制度、动态代数增长、推荐奖励机制，配合供奉系统提供会员折扣和分成奖励。

---

## 🎯 核心特性

### 1. 多等级会员制度

| 等级 | 价格 | 基础代数 | 有效期 | 升级费用 |
|------|------|---------|--------|---------|
| 年费会员 (Year1) | 400 MEMO | 6代 | 1年 | 可补升至10年 |
| 3年会员 (Year3) | 800 MEMO | 9代 | 3年 | 可补升至10年 |
| 5年会员 (Year5) | 1600 MEMO | 12代 | 5年 | 可补升至10年 |
| 10年会员 (Year10) | 2000 MEMO | 15代 | 10年 | - |

### 2. 动态代数增长机制

- **基础代数**：根据购买的会员等级固定
- **奖励代数**：每推荐1个会员，额外获得1代
- **总代数计算**：`总代数 = MIN(基础代数 + 奖励代数, 15)`
- **增长上限**：最多15代（10年会员初始即为15代）

**示例：**
```
张三购买年费会员（基础6代）
├─ 推荐李四 → 奖励+1代 → 总共7代
├─ 推荐王五 → 奖励+1代 → 总共8代
├─ 推荐赵六 → 奖励+1代 → 总共9代
└─ ...最多增长到15代封顶
```

### 3. 推荐关系管理

- **推荐码统一管理**：推荐码由 `pallet-memo-referrals` 统一生成和管理（8位大写HEX）
- **推荐验证**：购买时必须提供有效推荐码（创始会员除外），通过 `pallet-memo-referrals` 验证
- **关系绑定**：购买会员时自动绑定到 `pallet-memo-referrals` 推荐关系图
- **推荐码自动分配**：购买会员成功后自动为用户分配推荐码（如已绑定推荐人）
- **推荐统计**：记录每个会员的推荐人数

### 4. 会员折扣

- **默认折扣**：2折（20%）
- **适用范围**：供奉消费等场景
- **治理调整**：Root权限可动态调整折扣比例
- **即时生效**：会员购买后立即享受折扣

### 5. 补升级机制

- **升级方向**：仅支持升级到10年会员
- **补差价格**：
  - Year1 → Year10: 1800 MEMO
  - Year3 → Year10: 1500 MEMO
  - Year5 → Year10: 1000 MEMO
- **权益提升**：
  - 基础代数立即提升至15代
  - 有效期从当前时间重新计算10年
  - 总代数直接为15（不再受bonus限制）

---

## 🔧 核心接口

### 用户接口

#### 1. 购买会员

```rust
#[pallet::call_index(0)]
pub fn purchase_membership(
    origin: OriginFor<T>,
    level: MembershipLevel,           // 会员等级
    referral_code: Option<Vec<u8>>,   // 推荐码（创始会员可不填）
) -> DispatchResult
```

**参数说明：**
- `level`: 会员等级枚举
  - `MembershipLevel::Year1`: 年费会员
  - `MembershipLevel::Year3`: 3年会员
  - `MembershipLevel::Year5`: 5年会员
  - `MembershipLevel::Year10`: 10年会员
- `referral_code`: 推荐人的推荐码（16位16进制字符串）

**执行流程：**
1. 验证账户未购买过会员
2. 验证推荐码有效性（如提供）
3. 验证推荐人是有效会员
4. 扣除会员费用到国库账户
5. 生成唯一推荐码
6. 计算有效期
7. 创建会员信息
8. 绑定推荐关系到 `pallet-memo-referrals`
9. 增加推荐人的奖励代数
10. 发出 `MembershipPurchased` 事件

**错误处理：**
- `AlreadyMember`: 已经是会员
- `InvalidReferralCode`: 推荐码不存在
- `ReferrerNotValid`: 推荐人不是有效会员或已过期
- `ReferralCodeTooLong`: 推荐码长度超限
- `ReferralCodeExists`: 生成的推荐码已存在（极小概率）

#### 2. 补升级到10年会员

```rust
#[pallet::call_index(1)]
pub fn upgrade_to_year10(
    origin: OriginFor<T>,
) -> DispatchResult
```

**执行流程：**
1. 验证账户是会员
2. 验证不是已经是10年会员
3. 计算补差价
4. 扣除升级费用
5. 更新会员等级为Year10
6. 更新基础代数为15
7. 更新总代数为15
8. 重新计算有效期（从当前时间+10年）
9. 更新统计数据
10. 发出 `MembershipUpgraded` 事件

**错误处理：**
- `NotMember`: 不是会员
- `AlreadyYear10`: 已经是10年会员

### 治理接口

#### 1. 设置会员折扣

```rust
#[pallet::call_index(2)]
pub fn set_member_discount(
    origin: OriginFor<T>,
    discount: DiscountPercent,  // 折扣比例（0-100）
) -> DispatchResult
```

**权限要求：** Root

**参数说明：**
- `discount`: 折扣比例，例如 20 表示20%（2折）

**错误处理：**
- `BadOrigin`: 非Root权限
- `InvalidDiscount`: 折扣比例超出0-100范围

#### 2. 设置单个会员等级价格

```rust
#[pallet::call_index(3)]
pub fn set_membership_price(
    origin: OriginFor<T>,
    level: MembershipLevel,    // 会员等级
    price_units: u128,          // 价格（MEMO单位数）
) -> DispatchResult
```

**权限要求：** GovernanceOrigin（Root 或委员会 2/3 多数）

**参数说明：**
- `level`: 要设置价格的会员等级
- `price_units`: 价格（以 MEMO 为单位，非最小单位）

**价格范围限制：**
- 最低价格：`MinMembershipPrice`（默认 100 MEMO）
- 最高价格：`MaxMembershipPrice`（默认 10000 MEMO）

**错误处理：**
- `BadOrigin`: 非治理权限
- `PriceOutOfRange`: 价格超出允许范围

**示例：**
```rust
// 设置 Year1 价格为 500 MEMO
set_membership_price(origin, MembershipLevel::Year1, 500)?;
```

#### 3. 批量设置所有会员价格

```rust
#[pallet::call_index(4)]
pub fn set_all_membership_prices(
    origin: OriginFor<T>,
    year1_units: u128,      // Year1 价格（MEMO单位数）
    year3_units: u128,      // Year3 价格（MEMO单位数）
    year5_units: u128,      // Year5 价格（MEMO单位数）
    year10_units: u128,     // Year10 价格（MEMO单位数）
) -> DispatchResult
```

**权限要求：** GovernanceOrigin（Root 或委员会 2/3 多数）

**参数说明：**
- 所有价格必须在 `MinMembershipPrice` 和 `MaxMembershipPrice` 之间
- 建议保持递增：Year1 < Year3 < Year5 < Year10

**错误处理：**
- `BadOrigin`: 非治理权限
- `PriceOutOfRange`: 任一价格超出允许范围

**示例：**
```rust
// 批量设置：400, 800, 1600, 2000 MEMO
set_all_membership_prices(origin, 400, 800, 1600, 2000)?;
```

**价格治理说明：**
1. **向后兼容**：未设置价格时，自动使用 `MembershipLevel` 中的默认价格
2. **即时生效**：价格更新后，新购买的会员立即使用新价格
3. **不影响现有会员**：价格调整不影响已购买会员的权益
4. **安全保护**：
   - 价格范围限制，防止设置为 0 或过高
   - 治理权限验证，只有 Root 或委员会 2/3 多数可调整
5. **透明可追溯**：所有价格调整都触发链上事件

### 查询接口

#### 1. 检查账户是否为有效会员

```rust
pub fn is_member_valid(who: &T::AccountId) -> bool
```

**返回值：**
- `true`: 是有效会员（已购买且未过期）
- `false`: 不是会员或已过期

#### 2. 获取会员可拿代数

```rust
pub fn get_member_generations(who: &T::AccountId) -> Option<u8>
```

**返回值：**
- `Some(代数)`: 有效会员的总代数（基础+奖励）
- `None`: 不是会员或已过期

#### 3. 获取会员折扣比例

```rust
pub fn get_discount() -> DiscountPercent
```

**返回值：** 当前会员折扣比例（0-100）

---

## 📊 存储结构

### 1. 会员信息映射

```rust
pub type Memberships<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    MembershipInfo<T::AccountId, BlockNumberFor<T>, T::MaxCodeLength>,
    OptionQuery,
>;
```

**存储内容：**
```rust
pub struct MembershipInfo {
    pub level: MembershipLevel,          // 会员等级
    pub purchased_at: BlockNumber,       // 购买时间
    pub valid_until: BlockNumber,        // 有效期至
    pub base_generations: u8,            // 基础代数
    pub bonus_generations: u8,           // 奖励代数
    pub total_generations: u8,           // 总代数（最多15）
    pub referrer: Option<AccountId>,     // 推荐人
    pub referral_count: u32,             // 已推荐人数
    // 注意：referral_code 已移除，统一由 pallet-memo-referrals 管理
}
```

### 2. 推荐码索引

**已移除：** 推荐码索引 `ReferralCodeToAccount` 已移除，统一由 `pallet-memo-referrals::OwnerOfCode` 管理。

**查询推荐码：**
- 通过 `pallet-memo-referrals::CodeOf` 查询账户的推荐码
- 通过 `pallet-memo-referrals::OwnerOfCode` 查找推荐码对应的账户
- 或使用 `ReferralProvider::find_account_by_code()` trait 方法

### 3. 会员统计

```rust
pub type TotalMembers<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    MembershipLevel,
    u32,
    ValueQuery,
>;
```

**用途：** 按等级统计总会员数

### 4. 会员折扣配置

```rust
pub type MemberDiscount<T: Config> = StorageValue<_, DiscountPercent, ValueQuery>;
```

**默认值：** 20（2折）

---

## 🎯 事件

### 1. MembershipPurchased

```rust
MembershipPurchased {
    who: T::AccountId,            // 购买者
    level: MembershipLevel,       // 会员等级
    valid_until: BlockNumber,     // 有效期至
    referrer: Option<AccountId>,  // 推荐人
}
```

**触发时机：** 成功购买会员时

### 2. MembershipUpgraded

```rust
MembershipUpgraded {
    who: T::AccountId,            // 升级者
    from: MembershipLevel,        // 原等级
    to: MembershipLevel,          // 新等级
    new_valid_until: BlockNumber, // 新有效期至
}
```

**触发时机：** 成功升级会员时

### 3. GenerationIncreased

```rust
GenerationIncreased {
    who: T::AccountId,  // 推荐人
    bonus: u8,          // 奖励代数
    total: u8,          // 总代数
}
```

**触发时机：** 推荐新会员导致代数增加时

### 4. DiscountUpdated

```rust
DiscountUpdated {
    discount: DiscountPercent,  // 新折扣比例
}
```

**触发时机：** 治理更新折扣比例时

---

## ⚙️ Runtime 配置

### 1. 在 runtime/Cargo.toml 添加依赖

```toml
[dependencies]
pallet-membership = { path = "../pallets/membership", default-features = false }

[features]
std = [
    # ... 其他依赖
    "pallet-membership/std",
]
```

### 2. 在 runtime/src/lib.rs 配置

```rust
use frame_support::PalletId;

parameter_types! {
    pub const MembershipPalletId: PalletId = PalletId(*b"py/membr");
    pub const BlocksPerYear: BlockNumber = 5_256_000; // 365天 * 24小时 * 60分 * 10块/分
    pub const Units: Balance = 1_000_000_000_000;     // 1 MEMO = 10^12
    pub const MaxCodeLength: u32 = 32;
}

impl pallet_membership::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type PalletId = MembershipPalletId;
    type BlocksPerYear = BlocksPerYear;
    type Units = Units;
    type ReferralProvider = MemoReferrals;  // 使用 pallet-memo-referrals
    type MaxCodeLength = MaxCodeLength;
    type WeightInfo = pallet_membership::weights::SubstrateWeight<Runtime>;
}

// 添加到 construct_runtime!
construct_runtime!(
    pub struct Runtime {
        // ... 其他 pallets
        Membership: pallet_membership,
        MemoReferrals: pallet_memo_referrals,  // 依赖项
    }
);
```

### 3. 实现 ReferralProvider

需要在 runtime 中为 `pallet-memo-referrals` 实现 `ReferralProvider` trait：

```rust
impl pallet_membership::ReferralProvider<AccountId> for MemoReferrals {
    fn bind_sponsor(who: &AccountId, sponsor: &AccountId) -> DispatchResult {
        MemoReferrals::bind_sponsor_impl(who, sponsor)
    }

    fn get_sponsor_chain(who: &AccountId, max_depth: u8) -> Vec<AccountId> {
        MemoReferrals::get_sponsor_chain_impl(who, max_depth)
    }

    fn has_sponsor(who: &AccountId) -> bool {
        MemoReferrals::sponsor_of(who).is_some()
    }
}
```

---

## 🧪 测试

### 运行测试

```bash
cd pallets/membership
cargo test
```

### 测试覆盖

- ✅ 购买会员（无推荐人）
- ✅ 购买会员（有推荐人）
- ✅ 推荐代数动态增长
- ✅ 推荐代数封顶（15代）
- ✅ 重复购买检测
- ✅ 无效推荐码处理
- ✅ 升级到10年会员
- ✅ 10年会员无法再升级
- ✅ 会员折扣设置
- ✅ 权限验证（Root）
- ✅ 折扣范围验证
- ✅ 会员有效性检查

---

## 🔒 安全考虑

### 1. 推荐关系验证

- **防循环推荐**：依赖 `pallet-memo-referrals` 的循环检测
- **防自推**：`pallet-memo-referrals` 保证不能推荐自己
- **推荐码唯一性**：哈希+重试机制确保推荐码唯一

### 2. 会员验证

- **有效期检查**：每次分成前验证会员是否过期
- **推荐人验证**：购买时验证推荐人是有效会员
- **重复购买防护**：不允许同一账户重复购买

### 3. 资金安全

- **国库账户**：会员费用转入Pallet派生的国库账户
- **KeepAlive保护**：所有转账使用 `KeepAlive`，避免账户被销毁
- **权限控制**：折扣设置等敏感操作需Root权限

### 4. 代数增长控制

- **上限封顶**：总代数最多15代，防止无限增长
- **溢出保护**：使用 `saturating_add` 等安全算术运算
- **10年会员特殊处理**：直接设为15代，不受bonus影响

---

## 🔗 与其他模块的交互

### 1. pallet-memo-referrals（推荐关系）

**依赖关系：** 强依赖

**交互接口：**
- `bind_sponsor`: 绑定推荐关系
- `get_sponsor_chain`: 获取推荐链（用于分成）
- `has_sponsor`: 检查是否有推荐人

**数据流：**
```
购买会员 → 验证推荐码 → 绑定推荐关系 → 增加推荐人代数
```

### 2. pallet-memo-offerings（供奉系统）

**依赖关系：** 被依赖

**交互接口：**
- `is_member_valid`: 检查会员有效性
- `get_discount`: 获取会员折扣
- `get_member_generations`: 获取可拿代数

**数据流：**
```
供奉支付 → 检查会员 → 应用折扣 → 触发分成
```

### 3. pallet-affiliate-instant（即时分成）

**依赖关系：** 被依赖

**交互接口：**
- `is_member_valid`: 验证会员有效性
- `get_member_generations`: 获取可拿代数（决定分成层数）

**数据流：**
```
即时分成 → 逐层验证会员 → 根据代数分配奖励
```

---

## 📈 经济模型

### 会员定价策略

| 等级 | 价格 | 月均成本 | 基础代数 | 性价比 |
|------|------|---------|---------|--------|
| Year1 | 400 MEMO | 33.3 MEMO/月 | 6代 | 基准 |
| Year3 | 800 MEMO | 22.2 MEMO/月 | 9代 | 节省33% |
| Year5 | 1600 MEMO | 26.7 MEMO/月 | 12代 | 节省20% |
| Year10 | 2000 MEMO | 16.7 MEMO/月 | 15代 | 节省50% |

**设计考量：**
- 长期会员享受更低月均成本
- 激励用户购买长期会员
- 10年会员性价比最高，推荐代数上限

### 推荐激励机制

**奖励规则：**
- 每推荐1人 → 奖励1代
- 最多奖励至15代封顶

**示例收益：**
```
假设会员推荐10人（年费会员）
基础代数：6代
奖励代数：10代
总代数：15代（封顶）

收益层级：从6代提升到15代
收益增幅：150%（9层额外收益）
```

---

## 🛠️ 前端集成示例

### 1. 查询会员信息

```typescript
import { ApiPromise } from '@polkadot/api';

// 查询会员信息（含推荐码）
async function getMembershipInfo(api: ApiPromise, account: string) {
  const membership = await api.query.membership.memberships(account);
  
  if (membership.isSome) {
    const data = membership.unwrap();
    
    // 从 pallet-memo-referrals 查询推荐码
    const referralCode = await api.query.memoReferrals.codeOf(account);
    
    return {
      level: data.level.toString(),
      validUntil: data.validUntil.toNumber(),
      baseGenerations: data.baseGenerations.toNumber(),
      bonusGenerations: data.bonusGenerations.toNumber(),
      totalGenerations: data.totalGenerations.toNumber(),
      referralCode: referralCode.isSome ? referralCode.unwrap().toUtf8() : null,
      referralCount: data.referralCount.toNumber(),
      referrer: data.referrer.isSome ? data.referrer.unwrap().toString() : null,
    };
  }
  
  return null;
}
```

### 2. 购买会员

```typescript
// 购买会员
async function purchaseMembership(
  api: ApiPromise,
  signer: Signer,
  level: 'Year1' | 'Year3' | 'Year5' | 'Year10',
  referralCode?: string
) {
  const tx = api.tx.membership.purchaseMembership(
    level,
    referralCode || null
  );
  
  await tx.signAndSend(signer, ({ status, events }) => {
    if (status.isInBlock) {
      console.log('会员购买成功！');
      
      // 查找 MembershipPurchased 事件
      events.forEach(({ event }) => {
        if (api.events.membership.MembershipPurchased.is(event)) {
          const [who, level, validUntil, referrer] = event.data;
          console.log('购买者:', who.toString());
          console.log('等级:', level.toString());
          console.log('有效期至:', validUntil.toNumber());
        }
      });
    }
  });
}
```

### 3. 升级会员

```typescript
// 升级到10年会员
async function upgradeToYear10(api: ApiPromise, signer: Signer) {
  const tx = api.tx.membership.upgradeToYear10();
  
  await tx.signAndSend(signer, ({ status, events }) => {
    if (status.isInBlock) {
      console.log('会员升级成功！');
    }
  });
}
```

### 4. 检查会员状态

```typescript
// 检查是否为有效会员
async function checkMemberValid(api: ApiPromise, account: string): Promise<boolean> {
  const membership = await api.query.membership.memberships(account);
  
  if (membership.isNone) return false;
  
  const data = membership.unwrap();
  const currentBlock = await api.query.system.number();
  
  return currentBlock.toNumber() <= data.validUntil.toNumber();
}
```

---

## 📝 待优化事项

### 1. 会员续费功能

**当前状态：** 不支持续费，只能升级

**优化方向：**
- 支持同等级续费延长有效期
- 续费价格可享折扣
- 保留已有奖励代数

### 2. 会员降级处理

**当前状态：** 会员过期后直接失效

**优化方向：**
- 过期后保留推荐关系
- 支持宽限期（grace period）
- 过期会员重新购买可恢复部分权益

### 3. 推荐码自定义

**当前状态：** 自动生成16进制推荐码

**优化方向：**
- 支持用户自定义推荐码（需付费）
- 推荐码黑名单管理
- 推荐码交易市场

### 4. 会员NFT化

**当前状态：** 纯链上数据存储

**优化方向：**
- 会员身份NFT化
- 支持转让（需销毁原会员）
- NFT展示会员等级和权益

---

## 🎓 最佳实践

### 1. 创始会员策略

**建议：**
- 项目方预设若干个创始会员账户
- 创始会员设为10年会员（15代）
- 创始会员推荐码公开，供早期用户使用
- 监控创始会员树的发展情况

**实现：**
```rust
// Genesis配置
GenesisConfig {
    initial_discount: 20,
    genesis_members: vec![
        (founder_account_1, MembershipLevel::Year10),
        (founder_account_2, MembershipLevel::Year10),
        (founder_account_3, MembershipLevel::Year10),
    ],
}
```

### 2. 会员激励活动

**方案A：早鸟优惠**
- 前100名购买享8折优惠
- 通过治理临时调整价格

**方案B：团购优惠**
- 5人成团享9折
- 10人成团享8折

**方案C：推荐竞赛**
- 每月推荐数Top10奖励
- 额外代数奖励或MEMO奖励

### 3. 会员权益扩展

**当前权益：**
- 供奉2折优惠
- 推荐分成

**可扩展权益：**
- 治理投票权加成
- 专属NFT空投
- 线下活动优先参与权
- 平台广告费折扣
- 墓地管理费减免

---

## 📚 相关文档

- [年费会员和推荐系统需求](/docs/年费会员和推荐系统需求.md)
- [年费会员系统技术实施方案](/docs/年费会员系统技术实施方案.md)
- [年费会员系统-快速参考](/docs/年费会员系统-快速参考.md)
- [pallet-memo-referrals](/pallets/memo-referrals/README.md)
- [pallet-memo-affiliate](/pallets/memo-affiliate/README.md)

---

## 🤝 贡献

欢迎提交 Issue 和 PR 来改进本模块！

---

**版本：** v0.1.0  
**创建日期：** 2025-10-06  
**最后更新：** 2025-10-06  
**维护者：** Memopark Team  
**许可证：** Apache-2.0
