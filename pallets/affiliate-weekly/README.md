# pallet-affiliate-weekly

## 📋 功能概述

联盟计酬周结算分配层模块，负责周期结算和奖励分配逻辑。职责单一：只负责分配算法、活跃度管理、预算控制，不涉及资金托管。

---

## 🎯 核心特性

### 1. 周期结算模式

**结算流程：**
```
1. 供奉发生 → 记录分配（record_distribution）
2. 周期末 → 结算转账（settle）
3. 从托管层读取资金进行分配
```

**与即时分成对比：**

| 特性 | pallet-affiliate-instant | pallet-memo-affiliate-weekly |
|------|--------------------------|------------------------------|
| **结算时机** | 即时（每笔消费后） | 周期（每周统一） |
| **资金流向** | 直接转账 | 先记账后结算 |
| **用户体验** | 即时到账 | 延迟到账 |
| **链上负载** | 高（每笔都转账） | 低（批量结算） |
| **适用场景** | 供奉场景 | 其他消费场景 |

---

### 2. 15层推荐分配

**分配比例（非压缩不等比）：**

| 层级 | 比例 | 说明 |
|------|------|------|
| L1 | 20% | 直接推荐人 |
| L2 | 10% | 二级推荐人 |
| L3-L15 | 各4% | 三级及以上（共52%） |
| **总计** | **82%** | 剩余18%由多路分账系统处理 |

**资格验证：**
- ✅ 活跃期：推荐人必须在活跃期内
- ✅ 直推有效数：需满足 `直推有效数 / 3 >= 层级`
- ✅ 持仓门槛：最小持仓要求（可配置）
- ✅ 未被封禁：通过 `pallet-memo-referrals` 检查

---

### 3. 活跃度管理

**活跃期延长：**
```rust
// 供奉发生时自动延长活跃期
mark_active(who, now, duration_weeks);
// 例如：购买12周供奉 → 活跃期延长12周
```

**直推有效数计算：**
```
用户首次变为活跃 → sponsor 的直推有效数 +1
用户活跃期到期 → sponsor 的直推有效数 -1
```

**到期自动清理：**
- 使用 `OnInitialize` hook
- 每周自动处理到期账户
- 自动回退直推有效数

---

### 4. 工具层设计

**架构：**
```
┌──────────────────────┐
│ pallet-affiliate     │ ← 托管层
└──────────────────────┘
         ↑
         │ 读取 EscrowAccount
         │
┌────────┴──────────────────────┐
│ pallet-affiliate-weekly       │ ← 分配层（本模块）
│ - 分配逻辑                     │
│ - 周期结算                     │
│ - 活跃度管理                   │
└───────────────────────────────┘
```

**设计理念：**
- ✅ 类似 `pallet-affiliate-instant` 的工具架构
- ✅ 从托管层 `pallet-affiliate` 读取资金账户（`EscrowAccount`）
- ✅ 只负责算法和记账，不托管资金

---

## 💻 接口说明

### 1. 消费上报接口

供 `pallet-memo-offerings` 调用：

```rust
// ConsumptionReporter trait
pallet_affiliate_weekly::ConsumptionReporter::report(
    who,           // 消费者账户
    amount,        // 消费金额
    meta,          // 业务元数据
    now,           // 当前区块
    duration_weeks // 活跃期周数
);
```

**TypeScript 示例：**
```typescript
// 通常由 offerings 自动调用，前端无需直接调用
```

---

### 2. 结算接口

任何人都可以触发结算：

```typescript
// 结算指定周期的奖励
await api.tx.affiliateWeekly.settle(
  cycle,    // 周期编号（周数）
  maxPay    // 本次最多支付账户数（分页）
).signAndSend(account);

// 示例：结算第10周，最多支付100个账户
await api.tx.affiliateWeekly.settle(10, 100).signAndSend(alice);
```

**分页结算：**
- 如果账户数过多，需要多次调用
- 每次处理 `maxPay` 个账户
- 自动记录进度光标
- 全部完成后发出 `SettleCompleted` 事件

---

### 3. 治理接口

#### 设置奖励参数（Root）

```typescript
// 更新预算上限、持仓门槛等参数
await api.tx.sudo.sudo(
  api.tx.affiliateWeekly.setRewardParams(
    budgetCapPerCycle,    // 每周奖励上限（0表示不限制）
    minStakeForReward,    // 最小持仓门槛
    minQualActions        // 最小有效行为次数
  )
).signAndSend(sudoKey);
```

#### 设置结算模式（Root）

```typescript
// 切换结算模式
await api.tx.sudo.sudo(
  api.tx.affiliateWeekly.setMode(
    { Escrow: null }  // 或 { Immediate: null }
  )
).signAndSend(sudoKey);
```

---

## 📊 存储结构

### 活跃度相关

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `ActiveUntilWeek` | `Map<AccountId, u32>` | 账户活跃截至周 |
| `DirectActiveCount` | `Map<AccountId, u32>` | 直推有效人数 |
| `ExpiringAt` | `Map<u32, Vec<AccountId>>` | 到期账户清单 |

### 结算相关

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `Entitlement` | `DoubleMap<u32, AccountId, Balance>` | 应得奖励累计 |
| `EntitledAccounts` | `Map<u32, Vec<AccountId>>` | 有奖励的账户索引 |
| `SettleCursor` | `Map<u32, u32>` | 结算进度光标 |

### 预算控制

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `BudgetCapPerCycle` | `Balance` | 每周奖励上限 |
| `CycleRewardUsed` | `Map<u32, Balance>` | 本周已用额度 |
| `MinStakeForReward` | `Balance` | 最小持仓门槛 |

---

## 🔧 Runtime 配置

```rust
// runtime/src/configs/mod.rs

parameter_types! {
    /// 每周对应的区块数
    pub const BlocksPerWeek: u32 = 100_800; // 约7天
    /// 最大层数
    pub const MaxLevels: u32 = 15;
    /// 每层需要的直推有效数
    pub const PerLevelNeed: u32 = 3;
    /// 分层比例（bps）
    pub LevelRatesBps: &'static [u16] = &[
        2000, // L1: 20%
        1000, // L2: 10%
        400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, // L3-L15: 各4%
    ];
    /// 托管账户（从托管层读取）
    pub AffiliateEscrowAccount: AccountId = AffiliatePalletId::get().into_account_truncating();
}

impl pallet_affiliate_weekly::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Referrals = MemoReferrals;
    type BlocksPerWeek = BlocksPerWeek;
    /// 函数级中文注释：从托管层读取托管账户（类似 affiliate-instant）
    type EscrowAccount = AffiliateEscrowAccount;
    type MaxSearchHops = ConstU32<100>;
    type MaxLevels = MaxLevels;
    type PerLevelNeed = PerLevelNeed;
    type LevelRatesBps = LevelRatesBps;
}
```

---

## 📈 事件

### EscrowRecorded

**触发条件：** 消费上报完成，记账完成

**参数：**
- `cycle`: 周期编号
- `who`: 消费者账户
- `base`: 基础金额

---

### Entitled

**触发条件：** 推荐人获得奖励（记账阶段）

**参数：**
- `cycle`: 周期编号
- `to`: 推荐人账户
- `amount`: 奖励金额

---

### RewardClaimed

**触发条件：** 结算时实际转账给推荐人

**参数：**
- `cycle`: 周期编号
- `to`: 推荐人账户
- `amount`: 转账金额

---

### SettleCompleted

**触发条件：** 某周期的所有账户结算完成

**参数：**
- `cycle`: 周期编号

---

### BecameActive / ActiveRenewed

**触发条件：** 账户变为活跃或续期

**参数：**
- `who`: 账户
- `until_week`: 活跃截至周

---

## 🔍 查询接口

### 查询账户活跃期

```typescript
const activeUntil = await api.query.affiliateWeekly.activeUntilWeek(account);
console.log('活跃截至第', activeUntil.toString(), '周');
```

### 查询直推有效数

```typescript
const count = await api.query.affiliateWeekly.directActiveCount(account);
console.log('直推有效数:', count.toString());
```

### 查询应得奖励

```typescript
// 查询某周期某账户的应得奖励
const entitlement = await api.query.affiliateWeekly.entitlement(cycle, account);
console.log('应得奖励:', entitlement.toString());
```

### 查询结算进度

```typescript
// 查询某周期的结算进度
const cursor = await api.query.affiliateWeekly.settleCursor(cycle);
const accounts = await api.query.affiliateWeekly.entitledAccounts(cycle);
console.log(`结算进度: ${cursor}/${accounts.length}`);
```

---

## ⚠️ 错误码

| 错误 | 说明 | 解决方案 |
|------|------|---------|
| `NothingToSettle` | 该周无账户待结算 | 确认周期编号正确，或等待下一周期 |

---

## 🔒 安全性

### 1. 分页结算

- ✅ 避免单块处理过多账户
- ✅ 自动记录进度，支持分批处理
- ✅ 防止链上拥堵

### 2. 预算控制

- ✅ 每周奖励上限控制
- ✅ 超额部分自动忽略
- ✅ 防止超支

### 3. 资格验证

- ✅ 活跃期验证
- ✅ 直推有效数验证
- ✅ 持仓门槛验证
- ✅ 封禁状态验证

### 4. 到期自动清理

- ✅ `OnInitialize` hook 自动处理
- ✅ 防止状态膨胀
- ✅ 保持数据一致性

---

## 📦 与其他模块的集成

### 1. pallet-affiliate（托管层）

从托管层读取资金账户：

```rust
type EscrowAccount = AffiliateEscrowAccount;
// 结算时从托管账户转账
T::Currency::transfer(&escrow_account, recipient, amount, KeepAlive)?;
```

---

### 2. pallet-memo-offerings（供奉模块）

供奉模块通过 `ConsumptionReporter` trait 上报消费：

```rust
// offerings 调用 weekly 记录分配
pallet_affiliate_weekly::Pallet::<Runtime>::report(
    buyer,
    amount,
    Some((1, subject_id)),
    block_number,
    Some(duration_weeks),
);
```

---

### 3. pallet-memo-referrals（推荐关系）

只读推荐关系：

```rust
type Referrals = MemoReferrals;
// 查询推荐人
let sponsor = T::Referrals::sponsor_of(who);
// 检查封禁状态
let banned = T::Referrals::is_banned(who);
```

---

## 🎓 设计理念

### 职责分离

- **托管层（affiliate）**：只管钱的存放
- **分配层（weekly）**：只管分配算法

**优势：**
- ✅ 职责单一，易于理解
- ✅ 独立测试，降低复杂度
- ✅ 灵活扩展，可新增其他策略

---

### 工具化设计

**类比：**
- `pallet-affiliate` = 银行账户
- `pallet-affiliate-weekly` = 自动支付工具
- `pallet-affiliate-instant` = 即时支付工具

**一致性：**
- ✅ `weekly` 和 `instant` 都是工具层
- ✅ 都从托管层或调用方读取资金账户
- ✅ 架构统一，易于理解

---

## 🚀 使用流程

### 完整流程示例

```typescript
// 1. 用户购买供奉服务
await api.tx.offerings.commit(...).signAndSend(buyer);

// 2. offerings 自动调用 weekly 记录分配
// （内部调用，前端无需操作）

// 3. 周期末任何人触发结算
await api.tx.affiliateWeekly.settle(10, 100).signAndSend(alice);

// 4. 如果账户数过多，继续结算
await api.tx.affiliateWeekly.settle(10, 100).signAndSend(alice);

// 5. 监听 SettleCompleted 事件
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'affiliateWeekly' && event.method === 'SettleCompleted') {
      console.log('第', event.data[0], '周结算完成');
    }
  });
});
```

---

## 📚 相关文档

- **托管层模块**：`pallets/memo-affiliate/README.md`
- **即时分成模块**：`pallets/affiliate-instant/README.md`
- **拆分方案分析**：`docs/pallet-memo-affiliate拆分方案分析.md`

---

## 🔄 版本历史

### v0.2.0 - 拆分重构 + 命名优化
- ✅ 从原 `pallet-memo-affiliate` 拆分出分配层
- ✅ 职责单一：只负责分配逻辑
- ✅ 从托管层读取资金账户（工具层设计）
- ✅ 移除托管逻辑（已迁移到 `pallet-affiliate`）
- ✅ 命名优化：去掉 `memo-` 前缀，统一 affiliate 系列命名风格

### v0.1.0 - 原始版本（已废弃）
- 混合职责：托管 + 分配
- 已备份到 `pallets/memo-affiliate-legacy`（已删除）

---

**总结：** 本模块是联盟计酬系统的分配层，专注于周期结算算法，与托管层解耦，架构清晰！ ✅

