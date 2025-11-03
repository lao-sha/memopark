# pallet-deposits - 已归档

## ⚠️ 归档状态

**归档日期**：2025-11-03  
**归档原因**：已被官方 Holds API 替代，无实际使用  
**迁移路径**：Holds API（推荐）或 pallet-escrow（托管场景）

---

## 📋 归档原因

### 1. 唯一使用者已迁移

`pallet-stardust-appeals` 在 **v0.3.0 Phase 1优化（2025-10-27）** 中已完全迁移到 **Holds API**：

```rust
//! ### v0.3.0 - Phase 1优化（2025-10-27）
//! - 迁移到Holds API：移除pallet-deposits依赖
//! - 使用pallet-balances Holds API管理押金
//! - 更好的类型安全和官方维护
```

### 2. 官方方案更优

**Holds API 的优势**：
- ✅ **官方维护**：Substrate 官方推荐的押金管理方案
- ✅ **类型安全**：编译期保证押金类型正确
- ✅ **无缝集成**：与 pallet-balances 原生集成
- ✅ **社区支持**：完整文档和最佳实践

### 3. 无其他依赖

代码审查显示，除了 appeals 模块，**没有任何其他业务代码使用 pallet-deposits**。

---

## 🔄 迁移指南

### 选项 A：迁移到 Holds API（推荐）

**适用场景**：申诉、审核、投诉等押金场景

#### 第一步：定义 HoldReason

```rust
#[pallet::composite_enum]
pub enum HoldReason {
    /// 申诉押金
    Appeal,
    /// 审核押金
    Review,
    /// 投诉押金
    Complaint,
}
```

#### 第二步：更新 Config

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    
    /// 使用 Fungible traits 替代 Currency
    type Fungible: frame_support::traits::fungible::Mutate<Self::AccountId>
        + frame_support::traits::fungible::MutateHold<Self::AccountId, 
            Reason = Self::RuntimeHoldReason>;
}
```

#### 第三步：使用 Hold API

```rust
use frame_support::traits::fungible::{Mutate, MutateHold};

// 冻结押金
T::Fungible::hold(
    &HoldReason::Appeal.into(),
    who,
    amount,
)?;

// 释放押金
T::Fungible::release(
    &HoldReason::Appeal.into(),
    who,
    amount,
    Precision::Exact,
)?;

// 罚没押金（转移到国库）
let slashed = T::Fungible::transfer_on_hold(
    &HoldReason::Appeal.into(),
    who,
    &treasury_account,
    amount,
    Precision::Exact,
    Restriction::Free,
    Fortitude::Force,
)?;
```

#### Runtime 配置

```rust
impl your_pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Fungible = Balances;
}
```

### 选项 B：迁移到 pallet-escrow

**适用场景**：需要托管功能，或需要罚没逻辑

参见：[押金托管统一化分析报告](../../docs/押金托管统一化分析报告.md)

---

## 📦 原始功能清单

pallet-deposits 提供的功能（已废弃）：

| 功能 | API | 替代方案 |
|------|-----|---------|
| **冻结押金** | `reserve_deposit()` | `Fungible::hold()` |
| **释放押金** | `release_deposit()` | `Fungible::release()` |
| **罚没押金** | `slash_deposit()` | `Fungible::transfer_on_hold()` |
| **查询押金** | `deposits()` | `Fungible::balance_on_hold()` |
| **用途标记** | `DepositPurpose` 枚举 | `HoldReason` 枚举 |
| **状态管理** | `DepositStatus` 枚举 | 通过 Hold 状态管理 |

---

## 🔗 参考资料

### Substrate 官方文档

- [Holds API 指南](https://docs.substrate.io/reference/how-to-guides/pallet-design/implement-lockable-currency/)
- [pallet-balances Hold 机制](https://paritytech.github.io/substrate/master/pallet_balances/)
- [Fungible Traits 文档](https://paritytech.github.io/substrate/master/frame_support/traits/fungible/index.html)

### Stardust 项目文档

- [押金托管统一化分析报告](../../docs/押金托管统一化分析报告.md)
- [pallet-stardust-appeals README](../../pallets/stardust-appeals/README.md)（已使用 Holds API）
- [pallet-escrow README](../../pallets/escrow/README.md)

---

## 📝 版本历史

### v0.1.0（已废弃）

- 初始实现，提供通用押金管理
- 支持 reserve、release、slash 功能
- 支持多种用途标记（Appeal, Review, Complaint）

### v0.2.0（已废弃）

- 优化存储结构
- 添加账户索引
- 完善事件机制

### 归档（2025-11-03）

- ✅ pallet-stardust-appeals 迁移到 Holds API
- ✅ 无其他模块使用
- ✅ 官方方案更优
- ✅ 归档到 `archived-pallets/deposits/`

---

## ⚠️ 重要提示

**请勿在新项目中使用此模块！**

推荐使用：
1. **Holds API**（官方推荐）：用于申诉、审核、投诉等押金场景
2. **pallet-escrow**（自研托管）：用于订单托管、桥接服务等场景

如有疑问，请参考 [押金托管统一化分析报告](../../docs/押金托管统一化分析报告.md)。

---

**归档人**：Stardust 开发团队  
**联系方式**：查看项目 README  
**最后更新**：2025-11-03

