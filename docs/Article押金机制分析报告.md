# Article 押金机制分析报告

**日期**：2025-11-26
**版本**：1.0
**需求**：非拥有者创建 Article 需 1 USDT 押金，到期自动退回

---

## 📋 目录

1. [需求概述](#1-需求概述)
2. [现状分析](#2-现状分析)
3. [可行性分析](#3-可行性分析)
4. [合理性分析](#4-合理性分析)
5. [技术方案](#5-技术方案)
6. [风险评估](#6-风险评估)
7. [结论与建议](#7-结论与建议)

---

## 1. 需求概述

### 1.1 需求描述

| 项目 | 说明 |
|------|------|
| **适用对象** | 非逝者拥有者创建的 Article |
| **押金金额** | 1 USDT（动态换算为 DUST） |
| **押金锁定** | 使用 Fungible Hold 机制 |
| **退还条件** | 到期自动退回 |
| **到期时间** | 需定义（建议 365 天） |

### 1.2 当前 Article 权限模型

```text
┌─────────────────────────────────────────────────────────────────┐
│                 当前 Article 创建权限                            │
│                                                                 │
│   创建者身份        权限                 押金                    │
│   ──────────────────────────────────────────────────────────    │
│   逝者拥有者       ✅ 可创建            ❌ 无押金                │
│   非拥有者         ❌ 不可创建           -                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 目标权限模型

```text
┌─────────────────────────────────────────────────────────────────┐
│                 目标 Article 创建权限                            │
│                                                                 │
│   创建者身份        权限                 押金                    │
│   ──────────────────────────────────────────────────────────    │
│   逝者拥有者       ✅ 可创建            ❌ 无押金                │
│   非拥有者         ✅ 可创建            ✅ 1 USDT 押金           │
│                    （到期自动退回）                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 现状分析

### 2.1 Article 当前实现

**代码位置**：`pallets/deceased/src/lib.rs` (create_text 函数)

```rust
// 当前逻辑：Article 只能由 owner 创建
let deceased = match kind_enum {
    text::TextKind::Article => {
        // 文章只能由 owner 创建
        Self::ensure_owner_and_get(deceased_id, &who)?
    },
    text::TextKind::Message => {
        // 留言：任何人都可以创建，检查频率限制
        // ...付费逻辑...
    },
};
```

### 2.2 现有押金机制对比

| 机制 | 押金类型 | 金额 | 锁定方式 | 退还条件 |
|------|----------|------|----------|----------|
| **TextDeposit** | 配置定义但未使用 | 0 DUST | - | - |
| **投诉押金** | 投诉人缴纳 | 10 DUST | Hold 冻结 | 投诉成立退还 |
| **逝者创建押金** | 已移除 | - | - | - |
| **供奉品续费** | 定期扣款 | 变动 | 预扣转账 | 到期自动续费 |

### 2.3 现有到期机制参考

`pallet-memorial` 中的供奉品到期机制：

```rust
// on_initialize 中检查到期
fn on_initialize(block_number: BlockNumberFor<T>) -> Weight {
    let expired_offerings = ExpiringOfferings::<T>::get(&block_number);
    for &offering_id in expired_offerings.iter() {
        // 处理到期逻辑
    }
}
```

**存储结构**：
- `ExpiringOfferings<T>`: `StorageMap<BlockNumber, Vec<OfferingId>>`
- 按到期区块索引，便于 `on_initialize` 高效查询

---

## 3. 可行性分析

### 3.1 技术可行性

| 功能点 | 可行性 | 复杂度 | 说明 |
|--------|--------|--------|------|
| **权限放开** | ✅ 完全可行 | 低 | 修改权限检查逻辑 |
| **USDT→DUST 换算** | ✅ 可行 | 低 | 复用 `pallet-pricing` |
| **押金锁定** | ✅ 可行 | 低 | 使用 `Fungible::hold()` |
| **到期检索** | ✅ 可行 | 中 | 新增 `ExpiringArticles` 存储 |
| **自动退还** | ✅ 可行 | 中 | `on_initialize` 钩子 |
| **押金记录** | ✅ 可行 | 低 | 新增存储结构 |

### 3.2 核心技术实现

#### 3.2.1 新增存储

```rust
/// 文章押金记录
#[pallet::storage]
pub type ArticleDepositRecords<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::TextId,
    ArticleDepositRecord<T>,
    OptionQuery,
>;

/// 到期文章索引（按区块号）
#[pallet::storage]
pub type ExpiringArticles<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    BlockNumberFor<T>,
    BoundedVec<T::TextId, T::MaxExpiringPerBlock>,
    ValueQuery,
>;

/// 押金记录结构
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct ArticleDepositRecord<T: Config> {
    /// 押金缴纳人
    pub depositor: T::AccountId,
    /// 押金金额（DUST）
    pub amount: BalanceOf<T>,
    /// 锁定区块
    pub locked_at: BlockNumberFor<T>,
    /// 到期区块
    pub expiry_block: BlockNumberFor<T>,
    /// 关联逝者
    pub deceased_id: T::DeceasedId,
}
```

#### 3.2.2 到期自动退还（on_initialize）

```rust
fn on_initialize(block_number: BlockNumberFor<T>) -> Weight {
    let mut weight = Weight::zero();

    // 获取当前区块到期的文章
    let expiring = ExpiringArticles::<T>::take(&block_number);

    for text_id in expiring.iter() {
        if let Some(record) = ArticleDepositRecords::<T>::take(text_id) {
            // 释放押金
            let _ = T::Fungible::release(
                &T::RuntimeHoldReason::from(HoldReason::ArticleDeposit),
                &record.depositor,
                record.amount,
                Precision::Exact,
            );

            // 发出事件
            Self::deposit_event(Event::ArticleDepositReleased {
                text_id: *text_id,
                depositor: record.depositor,
                amount: record.amount,
            });
        }
        weight = weight.saturating_add(T::DbWeight::get().reads_writes(2, 2));
    }

    weight
}
```

#### 3.2.3 USDT → DUST 动态换算

```rust
/// 计算 1 USDT 对应的 DUST 数量
fn calculate_article_deposit_dust() -> Result<BalanceOf<T>, DispatchError> {
    // 1 USDT = 1_000_000 (精度 10^6)
    const ONE_USDT: u128 = 1_000_000;

    // 获取 DUST/USDT 价格
    let dust_price = T::PricingProvider::get_current_exchange_rate()
        .map_err(|_| Error::<T>::PriceUnavailable)?;

    // 计算: 1 USDT / (DUST价格) = DUST数量
    // DUST精度 10^12，价格精度 10^6
    let dust_amount = ONE_USDT
        .saturating_mul(1_000_000_000_000u128)  // DUST 精度
        .checked_div(dust_price as u128)
        .ok_or(Error::<T>::CalculationOverflow)?;

    // 安全边界检查
    const MIN_DEPOSIT: u128 = 100_000_000_000_000;   // 100 DUST
    const MAX_DEPOSIT: u128 = 100_000_000_000_000_000; // 100,000 DUST

    let safe_amount = dust_amount.clamp(MIN_DEPOSIT, MAX_DEPOSIT);

    Ok(safe_amount.saturated_into())
}
```

### 3.3 开发工作量评估

| 任务 | 工时 | 优先级 |
|------|------|--------|
| 新增存储结构 | 2h | P0 |
| 修改 create_text 逻辑 | 3h | P0 |
| 实现 on_initialize 退还 | 2h | P0 |
| USDT→DUST 换算 | 1h | P0 |
| 新增 Config 配置 | 1h | P0 |
| Runtime 配置 | 1h | P0 |
| 测试用例 | 3h | P1 |
| **总计** | **13h** | - |

---

## 4. 合理性分析

### 4.1 业务合理性

#### 4.1.1 支持理由 ✅

| 理由 | 说明 |
|------|------|
| **丰富内容生态** | 允许非拥有者（如亲友、公众）贡献高质量文章 |
| **经济激励** | 押金机制防止低质量内容泛滥 |
| **用户体验** | 押金到期自动退还，无需用户操作 |
| **权限平衡** | owner 免押金，非 owner 有成本门槛 |
| **与 Message 区分** | Message 付费（消费型），Article 押金（保证金型） |

#### 4.1.2 潜在问题 ⚠️

| 问题 | 影响 | 缓解措施 |
|------|------|----------|
| **内容审核缺失** | 低质量文章可能泛滥 | 结合投诉治理机制 |
| **押金过低** | 1 USDT 可能不足以阻止滥用 | 可治理调整金额 |
| **到期后文章去留** | 押金退还后文章是否保留？ | 保留文章，押金仅为保证金 |
| **owner 删除权** | owner 能否删除他人文章？ | 需定义治理规则 |

### 4.2 经济合理性

#### 4.2.1 押金金额分析

| 场景 | 1 USDT 押金 | 评估 |
|------|-------------|------|
| **认真撰文者** | 可接受，到期退还 | ✅ 合理 |
| **垃圾内容制造者** | 需同时锁定多份押金 | ✅ 有一定门槛 |
| **大规模攻击** | 100篇 = 100 USDT 锁定 | ⚠️ 门槛偏低 |

#### 4.2.2 与 Message 费用对比

| 类型 | 费用/押金 | 性质 | 资金去向 |
|------|-----------|------|----------|
| **Message** | 10,000 DUST (~$10) | 消费 | Affiliate 分配 |
| **Article** | 1 USDT (~$1) | 押金 | 到期退还 |

**分析**：
- Message 费用 > Article 押金，符合"留言轻量、文章重量"的产品定位
- Article 押金退还，鼓励高质量长内容
- Message 费用消费，适合短评、祭奠留言

### 4.3 与现有机制的一致性

| 机制 | Article 押金方案 | 一致性 |
|------|------------------|--------|
| **投诉押金** | 使用相同的 Hold 机制 | ✅ 一致 |
| **供奉品到期** | 使用相同的 on_initialize 模式 | ✅ 一致 |
| **USDT 定价** | 复用 pallet-pricing | ✅ 一致 |
| **频率限制** | 可与押金结合使用 | ✅ 互补 |

---

## 5. 技术方案

### 5.1 方案概述

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Article 押金流程                              │
│                                                                 │
│  非拥有者调用 create_text(Article)                               │
│       │                                                        │
│       ▼                                                        │
│  ┌────────────────────────────────────────┐                    │
│  │  1. 检查逝者存在性                       │                    │
│  │  2. 检查调用者 != owner                  │                    │
│  │  3. 计算押金 (1 USDT → DUST)            │                    │
│  │  4. 检查余额 ≥ 押金                      │                    │
│  │  5. 锁定押金 (Fungible::hold)           │                    │
│  └────────────────────────────────────────┘                    │
│       │                                                        │
│       ▼                                                        │
│  ┌────────────────────────────────────────┐                    │
│  │  6. 创建 Article 记录                    │                    │
│  │  7. 创建 ArticleDepositRecord           │                    │
│  │  8. 添加到 ExpiringArticles[到期块]      │                    │
│  │  9. 发出事件                            │                    │
│  └────────────────────────────────────────┘                    │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  on_initialize(到期区块)                                        │
│       │                                                        │
│       ▼                                                        │
│  ┌────────────────────────────────────────┐                    │
│  │  1. 读取 ExpiringArticles[当前块]       │                    │
│  │  2. 遍历到期文章                        │                    │
│  │  3. 释放押金 (Fungible::release)        │                    │
│  │  4. 删除 ArticleDepositRecord          │                    │
│  │  5. 发出退还事件                        │                    │
│  └────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Config 新增配置

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置 ...

    /// 函数级中文注释：非拥有者创建 Article 的押金（USDT，精度 10^6）
    /// - 默认值：1_000_000 (1 USDT)
    /// - 可通过治理调整
    #[pallet::constant]
    type ArticleDepositUsdt: Get<u64>;

    /// 函数级中文注释：Article 押金锁定期（区块数）
    /// - 默认值：5_256_000 (约 365 天，6秒/块)
    /// - 到期后自动退还
    #[pallet::constant]
    type ArticleDepositLockPeriod: Get<BlockNumberFor<Self>>;

    /// 函数级中文注释：每块最大处理到期文章数
    /// - 防止 on_initialize 权重过大
    #[pallet::constant]
    type MaxExpiringArticlesPerBlock: Get<u32>;
}
```

### 5.3 Runtime 配置建议

```rust
parameter_types! {
    /// Article 押金（1 USDT，精度 10^6）
    pub const ArticleDepositUsdt: u64 = 1_000_000;

    /// Article 押金锁定期（365 天）
    /// 5,256,000 块 = 365 * 24 * 60 * 60 / 6
    pub const ArticleDepositLockPeriod: BlockNumber = 5_256_000;

    /// 每块最大处理到期文章数
    pub const MaxExpiringArticlesPerBlock: u32 = 50;
}

impl pallet_deceased::Config for Runtime {
    // ... 现有配置 ...

    type ArticleDepositUsdt = ArticleDepositUsdt;
    type ArticleDepositLockPeriod = ArticleDepositLockPeriod;
    type MaxExpiringArticlesPerBlock = MaxExpiringArticlesPerBlock;
}
```

### 5.4 事件设计

```rust
#[pallet::event]
pub enum Event<T: Config> {
    // ... 现有事件 ...

    /// 函数级中文注释：非拥有者创建文章，押金已锁定
    ArticleDepositLocked {
        text_id: T::TextId,
        depositor: T::AccountId,
        deceased_id: T::DeceasedId,
        amount: BalanceOf<T>,
        expiry_block: BlockNumberFor<T>,
    },

    /// 函数级中文注释：文章押金已退还（到期自动释放）
    ArticleDepositReleased {
        text_id: T::TextId,
        depositor: T::AccountId,
        amount: BalanceOf<T>,
    },
}
```

### 5.5 错误类型

```rust
#[pallet::error]
pub enum Error<T> {
    // ... 现有错误 ...

    /// 价格不可用（无法计算押金）
    PriceUnavailable,
    /// 押金计算溢出
    CalculationOverflow,
    /// 到期列表已满（本区块）
    ExpiringListFull,
}
```

---

## 6. 风险评估

### 6.1 技术风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| **on_initialize 权重过大** | 🟡 中 | 限制每块处理数量 |
| **存储膨胀** | 🟡 中 | 到期后自动清理记录 |
| **价格波动** | 🟢 低 | 使用安全边界 (100~100,000 DUST) |
| **时钟漂移** | 🟢 低 | 使用区块号而非时间戳 |

### 6.2 业务风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| **低质量内容** | 🟡 中 | 结合投诉治理机制 |
| **恶意刷文** | 🟡 中 | 可增加频率限制 |
| **押金过低** | 🟢 低 | 可通过治理调整 |

### 6.3 边界条件

| 条件 | 处理方式 |
|------|----------|
| **价格为 0** | 返回错误 PriceUnavailable |
| **余额不足** | 返回错误 InsufficientBalance |
| **到期列表满** | 返回错误 ExpiringListFull |
| **押金已退还再投诉** | 允许（文章仍存在） |

---

## 7. 结论与建议

### 7.1 可行性结论

| 维度 | 结论 | 说明 |
|------|------|------|
| **技术可行性** | ✅ 完全可行 | 复用现有机制，改动可控 |
| **业务合理性** | ✅ 合理 | 丰富生态，有门槛控制 |
| **经济合理性** | ⚠️ 基本合理 | 1 USDT 门槛偏低，建议可治理调整 |
| **实现复杂度** | 🟡 中等 | 约 13h 工作量 |

### 7.2 建议

#### 7.2.1 核心建议

1. **✅ 建议实施**：该功能可丰富内容生态，技术方案成熟

2. **建议调整**：
   - 押金默认 1 USDT，但支持治理调整范围 0.1~10 USDT
   - 锁定期默认 365 天，可治理调整

3. **配套机制**：
   - 保留投诉治理作为内容质量控制手段
   - 考虑增加非拥有者的创建频率限制（如每日 3 篇）

#### 7.2.2 实施顺序建议

```text
Phase 1：基础功能（必须）
├── 权限放开（非拥有者可创建）
├── 押金锁定逻辑
├── 到期自动退还
└── 事件和错误定义

Phase 2：增强功能（可选）
├── 频率限制
├── 治理参数调整接口
└── 提前退还（owner 审批后）
```

#### 7.2.3 测试重点

1. 正常流程：非拥有者创建 → 押金锁定 → 到期退还
2. 边界条件：余额不足、价格不可用、到期列表满
3. 权限校验：owner 免押金、非 owner 收押金
4. 与投诉的交互：押金退还后文章仍可被投诉

### 7.3 最终结论

**该方案技术可行、业务合理，建议实施。**

预计开发周期：**2 天**（含测试）

---

## 附录

### A. 相关代码位置

| 文件 | 说明 |
|------|------|
| `pallets/deceased/src/lib.rs` | 主模块，create_text 函数 |
| `pallets/deceased/src/text.rs` | TextKind 定义 |
| `runtime/src/configs/mod.rs` | Runtime 配置 |
| `pallets/memorial/src/lib.rs` | 供奉品到期机制参考 |

### B. 参考实现

- `pallet-memorial::on_initialize` - 到期检查模式
- `pallet-arbitration` - Hold 押金模式
- `pallet-pricing` - USDT/DUST 换算

### C. 配置参数建议值

| 参数 | 建议值 | 说明 |
|------|--------|------|
| `ArticleDepositUsdt` | 1_000_000 | 1 USDT |
| `ArticleDepositLockPeriod` | 5_256_000 | 365 天 |
| `MaxExpiringArticlesPerBlock` | 50 | 每块最多处理 50 篇 |
| `ArticleDepositMin` | 100 DUST | 最低押金 |
| `ArticleDepositMax` | 100,000 DUST | 最高押金 |

---

**文档日期**：2025-11-26
**版本**：1.0
**下次审查**：实施前
