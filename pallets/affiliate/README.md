# pallet-affiliate

## 📋 功能概述

联盟计酬托管层模块，专注于资金的安全托管与管理。职责单一：只负责资金的存入、提取和余额查询，不涉及分配逻辑。

---

## 🎯 核心特性

### 1. 独立托管账户

**托管账户：**
- PalletId: `AffiliatePalletId (*b"affiliat")`
- 与 OTC 托管账户（`EscrowPalletId (*b"otc/escw")`）完全隔离
- 资金安全独立，审计清晰

**架构优势：**
- ✅ 职责单一：只管钱的存放
- ✅ 资金隔离：不同业务资金互不干扰
- ✅ 审计清晰：托管与分配逻辑分离

---

### 2. 托管接口

| 接口 | 功能 | 权限 |
|------|------|------|
| `escrow_account()` | 获取托管账户地址 | 公开 |
| `escrow_balance()` | 查询托管账户余额 | 公开 |
| `deposit(from, amount)` | 归集资金到托管账户 | 任何账户 |
| `withdraw(to, amount)` | 从托管账户提取资金 | 授权 Origin |

---

### 3. 权限控制

**存款操作：**
- ✅ 任何账户都可以向托管账户转账
- ✅ 用于归集联盟计酬资金

**提款操作：**
- ⚠️ 只有授权的 Origin 可以提取资金
- ⚠️ 通常配置为 Root 或特定委员会
- ⚠️ 用于周结算模块（`pallet-memo-affiliate-weekly`）的资金提取

---

## 🏗️ 架构设计

### 模块关系图

```
┌──────────────────────┐
│ pallet-memo-affiliate│ ← 托管层（本模块）
│ - 托管资金            │
│ - 存取接口            │
│ - 权限控制            │
└──────────────────────┘
         ↑
         │ 读取托管账户
         │ 调用 withdraw
         │
┌────────┴──────────────────────┐
│ pallet-memo-affiliate-weekly  │ ← 分配层
│ - 分配逻辑                     │
│ - 周期结算                     │
│ - 活跃度管理                   │
└───────────────────────────────┘
```

---

### 与 pallet-affiliate-instant 的架构一致性

| 模块 | 托管 | 分配 | 模式 |
|------|------|------|------|
| **pallet-memo-affiliate** | ✅ | ❌ | **托管层** |
| **pallet-memo-affiliate-weekly** | ❌ | ✅ | **工具层** |
| **pallet-affiliate-instant** | ❌ | ✅ | **工具层** |

**设计理念：**
- ✅ 托管层专注于资金安全
- ✅ 工具层专注于分配算法
- ✅ 职责清晰，解耦合

---

## 💻 接口说明

### 1. 查询接口

#### 获取托管账户地址

```typescript
const escrowAccount = api.consts.affiliate.escrowPalletId;
// 或通过 RPC 查询
const account = api.query.affiliate.escrowAccount();
```

#### 查询托管账户余额

```typescript
const balance = await api.query.system.account(escrowAccount);
console.log('托管余额:', balance.data.free.toString());
```

#### 查询统计数据

```typescript
// 累计存入金额
const totalDeposited = await api.query.affiliate.totalDeposited();

// 累计提取金额
const totalWithdrawn = await api.query.affiliate.totalWithdrawn();

// 当前托管余额
const currentBalance = totalDeposited - totalWithdrawn;
```

---

### 2. 存款接口

任何账户都可以向托管账户转账：

```typescript
// 方式1: 通过 extrinsic
await api.tx.affiliate.deposit(amount).signAndSend(sender);

// 方式2: 直接转账到托管账户
const escrowAccount = /* 托管账户地址 */;
await api.tx.balances.transfer(escrowAccount, amount).signAndSend(sender);
```

---

### 3. 提款接口（授权）

只有授权的 Origin 可以调用：

```typescript
// Root 提款
await api.tx.sudo.sudo(
  api.tx.affiliate.withdraw(recipient, amount)
).signAndSend(sudoKey);

// 委员会提款（如果配置了委员会）
await api.tx.council.propose(
  threshold,
  api.tx.affiliate.withdraw(recipient, amount),
  lengthBound
).signAndSend(councilMember);
```

---

## 📊 存储结构

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `TotalDeposited` | `Balance` | 累计存入金额统计 |
| `TotalWithdrawn` | `Balance` | 累计提取金额统计 |

---

## 🔧 Runtime 配置

```rust
// runtime/src/configs/mod.rs

parameter_types! {
    /// 联盟计酬托管 PalletId
    pub const AffiliatePalletId: PalletId = PalletId(*b"affiliat");
}

impl pallet_affiliate::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EscrowPalletId = AffiliatePalletId;
    /// 提款权限：仅 Root 或财务委员会
    type WithdrawOrigin = EnsureRoot<AccountId>;
    // 或使用委员会：
    // type WithdrawOrigin = pallet_collective::EnsureProportionAtLeast<AccountId, TechCommitteeInstance, 2, 3>;
}
```

---

## 📈 事件

### Deposited

**触发条件：** 资金存入托管账户

**参数：**
- `from`: 存款人账户
- `amount`: 存款金额

**示例：**
```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'affiliate' && event.method === 'Deposited') {
      const [from, amount] = event.data;
      console.log('存入:', from.toString(), amount.toString());
    }
  });
});
```

---

### Withdrawn

**触发条件：** 资金从托管账户提取

**参数：**
- `to`: 提取到的账户
- `amount`: 提取金额

**示例：**
```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'affiliate' && event.method === 'Withdrawn') {
      const [to, amount] = event.data;
      console.log('提取:', to.toString(), amount.toString());
    }
  });
});
```

---

## ⚠️ 错误码

| 错误 | 说明 | 解决方案 |
|------|------|---------|
| `ZeroAmount` | 金额为零 | 确保转账金额 > 0 |
| `InsufficientEscrowBalance` | 托管账户余额不足 | 等待更多资金存入或减少提取金额 |
| `Unauthorized` | 未授权的提款操作 | 使用授权的 Origin（Root 或委员会） |

---

## 🔒 安全性

### 1. 权限控制

- ✅ 提款操作需要授权 Origin
- ✅ 防止未授权的资金提取
- ✅ 建议配置为 Root 或财务委员会

### 2. 余额检查

- ✅ 提款前自动检查托管账户余额
- ✅ 防止超额提取

### 3. 账户隔离

- ✅ 使用独立的 `AffiliatePalletId`
- ✅ 与 OTC 托管账户完全隔离
- ✅ 资金安全独立管理

---

## 📦 与其他模块的集成

### 1. pallet-memo-affiliate-weekly

周结算模块从本托管层读取资金：

```rust
// weekly 模块配置
impl pallet_affiliate_weekly::Config for Runtime {
    // ...
    type EscrowAccount = AffiliateEscrowAccount;
}

parameter_types! {
    pub AffiliateEscrowAccount: AccountId = AffiliatePalletId::get().into_account_truncating();
}
```

---

### 2. pallet-memo-offerings

供奉模块通过多路分账系统归集资金到托管账户：

```rust
// offerings 调用多路分账
// 多路分账系统路由资金到托管账户
```

---

## 🎓 设计理念

### 职责分离（Separation of Concerns）

- **托管层（本模块）**：只负责资金的安全存放
- **分配层（weekly）**：只负责分配算法和结算逻辑

**优势：**
- ✅ 职责单一，易于理解
- ✅ 独立测试，降低复杂度
- ✅ 灵活扩展，可新增其他分配策略

---

### 工具化设计（Tool-oriented Design）

- **托管层**：提供资金托管服务
- **分配层**：作为工具调用托管层

**类比：**
- 托管层 = 银行账户（存钱、取钱）
- 分配层 = 自动支付工具（调用银行账户转账）

---

## 📚 相关文档

- **分配层模块**：`pallets/memo-affiliate-weekly/README.md`
- **即时分成模块**：`pallets/affiliate-instant/README.md`
- **拆分方案分析**：`docs/pallet-memo-affiliate拆分方案分析.md`

---

## 🔄 版本历史

### v0.2.0 - 拆分重构 + 命名优化
- ✅ 从原 `pallet-memo-affiliate` 拆分出托管层
- ✅ 职责单一：只负责资金托管
- ✅ 移除分配逻辑（已迁移到 `pallet-affiliate-weekly`）
- ✅ 命名优化：去掉 `memo-` 前缀，统一 affiliate 系列命名风格

### v0.1.0 - 原始版本（已废弃）
- 混合职责：托管 + 分配
- 已备份到 `pallets/memo-affiliate-legacy`（已删除）

---

**总结：** 本模块是联盟计酬系统的托管层，专注于资金安全，与分配层解耦，架构清晰！ ✅

