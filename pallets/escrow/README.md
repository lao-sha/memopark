# Pallet Escrow - 通用托管服务

## 📋 模块概述

`pallet-escrow` 是Memopark生态的**基础设施模块**，提供通用的资金托管服务，支持锁定、释放、退款、部分分账、争议状态管理和到期自动处理等功能。作为底层托管层，为OTC交易、桥接服务、仲裁等业务提供安全可靠的资金锁定机制。

### 设计理念

- **通用工具**：不涉及业务逻辑，纯粹的资金托管
- **状态机管理**：Locked → Disputed → Resolved → Closed
- **幂等安全**：Nonce机制防止重复锁定
- **灵活到期策略**：可配置自动释放/退款/无操作

## 🏗️ 架构设计

```text
┌─────────────────────────────────────┐
│         业务层 (OTC/Bridge)          │
│  - 订单创建                          │
│  - 状态管理                          │
└──────────────┬──────────────────────┘
               ↓ 调用 Escrow Trait
┌─────────────────────────────────────┐
│     Escrow Pallet (托管层)          │
│  - lock_from()          锁定资金    │
│  - transfer_from_escrow() 部分转出  │
│  - release_all()        全额释放    │
│  - refund_all()         全额退款    │
│  - amount_of()          查询余额    │
└─────────────────────────────────────┘
               ↓ 资金存储
┌─────────────────────────────────────┐
│      Escrow Account (派生账户)       │
│  PalletId: "memopark/escrow___"     │
└─────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 资金锁定机制

#### lock_from - 从付款人锁定资金
```rust
fn lock_from(
    payer: &AccountId,
    id: u64,
    amount: Balance,
) -> DispatchResult
```

**功能**：
- 从付款人账户转账到托管账户
- 记录锁定金额到 `Locked[id]`
- 幂等性保护（通过Nonce）

**用途**：
- OTC买家下单锁定USDT
- 桥接用户锁定MEMO
- 任何需要托管的场景

### 2. 资金转出机制

#### transfer_from_escrow - 部分转出
```rust
fn transfer_from_escrow(
    id: u64,
    to: &AccountId,
    amount: Balance,
) -> DispatchResult
```

**功能**：
- 从托管账户转出部分金额
- 更新剩余托管余额
- 支持多次调用（多路分账）

**用途**：
- 多方分账（平台费、做市商、推荐奖励等）
- 部分履约
- 分批释放

#### release_all - 全额释放
```rust
fn release_all(
    id: u64,
    to: &AccountId,
) -> DispatchResult
```

**功能**：
- 将托管全部余额转给收款人
- 清空 `Locked[id]`
- 状态变更为 Closed

**用途**：
- OTC订单正常完成
- 仲裁裁决放款
- 正常履约场景

#### refund_all - 全额退款
```rust
fn refund_all(
    id: u64,
    to: &AccountId,
) -> DispatchResult
```

**功能**：
- 将托管全部余额退还给付款人
- 清空 `Locked[id]`
- 状态变更为 Closed

**用途**：
- OTC订单取消
- 桥接失败退款
- 到期自动退款

### 3. 状态管理

#### 托管状态 (LockStateOf)
```rust
pub enum LockState {
    Locked = 0,      // 正常锁定
    Disputed = 1,    // 争议中
    Resolved = 2,    // 已裁决
    Closed = 3,      // 已结清
}
```

**状态转换**：
```text
Locked ──dispute──> Disputed ──arbitrate──> Resolved ──settle──> Closed
  │                                                                 ↑
  └────────────────── release/refund ──────────────────────────────┘
```

**Disputed状态限制**：
- 仅允许仲裁系统操作
- 禁止业务层直接释放/退款
- 防止争议期间资金逃逸

### 4. 到期自动处理

#### 到期策略 (ExpiryPolicy Trait)
```rust
pub trait ExpiryPolicy<AccountId, BlockNumber> {
    /// 返回到期应执行的动作
    fn on_expire(id: u64) -> Result<ExpiryAction<AccountId>, DispatchError>;
    /// 返回当前块高
    fn now() -> BlockNumber;
}

pub enum ExpiryAction<AccountId> {
    ReleaseAll(AccountId),  // 自动释放给收款人
    RefundAll(AccountId),   // 自动退款给付款人
    Noop,                   // 无操作（等待手动处理）
}
```

**用途**：
- OTC订单超时自动退款
- 桥接超时自动退款
- 按业务规则灵活配置

#### OnInitialize - 每块自动检查
```rust
fn on_initialize(n: BlockNumberFor<T>) -> Weight {
    // 查找到期的托管订单
    // 按 ExpiryPolicy 执行相应动作
    // 最多处理 MaxExpiringPerBlock 个
}
```

## 📦 存储结构

### 锁定金额
```rust
pub type Locked<T: Config> = StorageMap<_, Blake2_128Concat, u64, BalanceOf<T>, ValueQuery>;
```
- **Key**：订单ID（listing_id 或 order_id）
- **Value**：锁定金额

### 托管状态
```rust
pub type LockStateOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, u8, ValueQuery>;
```
- **Key**：订单ID
- **Value**：状态码（0=Locked, 1=Disputed, 2=Resolved, 3=Closed）

### 幂等Nonce
```rust
pub type LockNonces<T: Config> = StorageMap<_, Blake2_128Concat, u64, u64, ValueQuery>;
```
- **Key**：订单ID
- **Value**：最新Nonce（防止重复锁定）

### 到期时间
```rust
pub type ExpiryOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, BlockNumberFor<T>, OptionQuery>;
```
- **Key**：订单ID
- **Value**：到期块高（可选）

### 全局暂停
```rust
pub type Paused<T: Config> = StorageValue<_, bool, ValueQuery>;
```
- **用途**：应急止血开关
- **效果**：暂停除AdminOrigin外的所有变更操作

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 货币接口
    type Currency: Currency<Self::AccountId>;

    /// Pallet ID（用于派生托管账户）
    type EscrowPalletId: Get<PalletId>;

    /// 授权Origin（允许调用外部extrinsic的白名单）
    type AuthorizedOrigin: EnsureOrigin<Self::RuntimeOrigin>;

    /// 管理员Origin（设置暂停等应急操作）
    type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

    /// 每块最多处理的到期项（防御性限制）
    type MaxExpiringPerBlock: Get<u32>;

    /// 到期处理策略（由runtime实现）
    type ExpiryPolicy: ExpiryPolicy<Self::AccountId, BlockNumberFor<Self>>;
}
```

## 📡 可调用接口

### 内部Trait接口（推荐）

业务pallet通过 `Escrow` Trait调用（无需extrinsic权限）：

```rust
// 锁定资金
T::Escrow::lock_from(&payer, order_id, amount)?;

// 部分转出（多路分账）
T::Escrow::transfer_from_escrow(order_id, &platform_account, platform_fee)?;
T::Escrow::transfer_from_escrow(order_id, &maker_account, maker_amount)?;

// 全额释放
T::Escrow::release_all(order_id, &seller)?;

// 全额退款
T::Escrow::refund_all(order_id, &buyer)?;

// 查询余额
let remaining = T::Escrow::amount_of(order_id);
```

### 外部Extrinsic接口（受限）

#### 1. set_paused - 设置暂停状态
```rust
#[pallet::call_index(0)]
pub fn set_paused(
    origin: OriginFor<T>,
    paused: bool,
) -> DispatchResult
```

**权限**：AdminOrigin  
**用途**：应急止血

#### 2. set_state - 设置托管状态
```rust
#[pallet::call_index(1)]
pub fn set_state(
    origin: OriginFor<T>,
    id: u64,
    state: u8,
) -> DispatchResult
```

**权限**：AuthorizedOrigin  
**用途**：设置争议状态（供仲裁系统调用）

#### 3. lock_external - 外部锁定入口
```rust
#[pallet::call_index(2)]
pub fn lock_external(
    origin: OriginFor<T>,
    id: u64,
    amount: BalanceOf<T>,
    nonce: u64,
) -> DispatchResult
```

**权限**：AuthorizedOrigin  
**功能**：白名单pallet可调用的锁定接口

#### 4. release_external - 外部释放入口
```rust
#[pallet::call_index(3)]
pub fn release_external(
    origin: OriginFor<T>,
    id: u64,
    to: T::AccountId,
) -> DispatchResult
```

**权限**：AuthorizedOrigin  
**功能**：白名单pallet可调用的释放接口

#### 5. refund_external - 外部退款入口
```rust
#[pallet::call_index(4)]
pub fn refund_external(
    origin: OriginFor<T>,
    id: u64,
    to: T::AccountId,
) -> DispatchResult
```

**权限**：AuthorizedOrigin  
**功能**：白名单pallet可调用的退款接口

#### 6. schedule_expiry - 设置到期时间
```rust
#[pallet::call_index(5)]
pub fn schedule_expiry(
    origin: OriginFor<T>,
    id: u64,
    at: BlockNumberFor<T>,
) -> DispatchResult
```

**权限**：AuthorizedOrigin  
**功能**：为托管订单设置到期块高

## 🎉 事件

### Locked - 资金锁定事件
```rust
Locked {
    id: u64,
    amount: BalanceOf<T>,
}
```

### Transfered - 部分转出事件
```rust
Transfered {
    id: u64,
    to: T::AccountId,
    amount: BalanceOf<T>,
    remaining: BalanceOf<T>,
}
```

### Released - 全额释放事件
```rust
Released {
    id: u64,
    to: T::AccountId,
    amount: BalanceOf<T>,
}
```

### Refunded - 全额退款事件
```rust
Refunded {
    id: u64,
    to: T::AccountId,
    amount: BalanceOf<T>,
}
```

### Disputed - 进入争议事件
```rust
Disputed {
    id: u64,
    reason: u16,
}
```

### DecisionApplied - 仲裁决议应用事件
```rust
DecisionApplied {
    id: u64,
    decision: u8,  // 0=ReleaseAll, 1=RefundAll, 2=PartialBps
}
```

### ExpiryScheduled - 到期已安排事件
```rust
ExpiryScheduled {
    id: u64,
    at: BlockNumberFor<T>,
}
```

### Expired - 到期已处理事件
```rust
Expired {
    id: u64,
    action: u8,  // 0=Release, 1=Refund, 2=Noop
}
```

## ❌ 错误处理

### Insufficient
- **说明**：余额不足
- **触发**：
  - 付款人账户余额不足
  - 托管账户余额不足以转出

### NoLock
- **说明**：托管记录不存在
- **触发**：操作不存在的订单ID

## 🔌 使用示例

### 场景1：OTC订单托管流程

```rust
// 1. 买家下单时锁定资金
let order_id = 12345u64;
let buyer = ensure_signed(origin)?;
let amount = 100_000_000u128; // 100 USDT

T::Escrow::lock_from(&buyer, order_id, amount)?;

// 2. 设置到期时间（1小时后）
let expiry = <frame_system::Pallet<T>>::block_number() + 360u32.into();
T::Escrow::schedule_expiry(order_id, expiry)?;

// 3. 卖家确认后多路分账
// 平台费 2%
let platform_fee = amount * 2 / 100;
T::Escrow::transfer_from_escrow(order_id, &platform_account, platform_fee)?;

// 剩余给卖家
T::Escrow::release_all(order_id, &seller)?;
```

### 场景2：争议处理流程

```rust
// 1. 买家发起争议
T::Escrow::set_state(order_id, 1)?; // Disputed

// 2. 仲裁系统裁决（假设卖家胜诉）
T::Escrow::release_all(order_id, &seller)?;

// 或者裁决退款（买家胜诉）
T::Escrow::refund_all(order_id, &buyer)?;
```

### 场景3：到期自动退款

```rust
// Runtime实现ExpiryPolicy
impl ExpiryPolicy<AccountId, BlockNumber> for OtcOrderExpiry {
    fn on_expire(id: u64) -> Result<ExpiryAction<AccountId>, DispatchError> {
        let order = OtcOrders::<T>::get(id).ok_or(Error::<T>::OrderNotFound)?;
        if order.status == OrderStatus::Pending {
            // 未成交订单自动退款给买家
            Ok(ExpiryAction::RefundAll(order.buyer))
        } else {
            Ok(ExpiryAction::Noop)
        }
    }
    
    fn now() -> BlockNumber {
        <frame_system::Pallet<T>>::block_number()
    }
}
```

## 🛡️ 安全机制

### 1. 权限分离

- **内部Trait调用**：业务pallet直接调用，无需额外权限
- **外部Extrinsic**：需要AuthorizedOrigin白名单
- **管理操作**：需要AdminOrigin（Root或委员会）

### 2. 状态保护

- **Disputed状态**：仅允许仲裁系统操作
- **Closed状态**：禁止再次出金
- **原子性**：所有转账操作在事务中执行

### 3. 余额校验

- 锁定前检查付款人余额
- 转出前检查托管余额
- 使用 `saturating_add/sub` 防止溢出

### 4. 幂等保护

- Nonce机制防止重复锁定
- 状态检查防止重复释放/退款

### 5. 应急机制

- 全局暂停开关（Paused）
- 仅AdminOrigin可解除暂停
- 暂停期间仅允许查询操作

## 📊 工作流程图

### 正常履约流程

```text
买家下单
   ↓
lock_from(buyer, order_id, amount)
   ↓ 资金进入托管账户
等待卖家确认
   ↓
卖家提交证明
   ↓
多路分账
   ├─ transfer_from_escrow → 平台账户 (2%)
   └─ release_all → 卖家账户 (98%)
```

### 争议处理流程

```text
买家/卖家发起争议
   ↓
set_state(order_id, Disputed)
   ↓ 状态锁定
仲裁系统介入
   ↓
委员会裁决
   ├─ 卖家胜诉 → release_all(seller)
   └─ 买家胜诉 → refund_all(buyer)
```

### 到期自动处理流程

```text
OnInitialize 每块检查
   ↓
发现到期订单
   ↓
调用 ExpiryPolicy::on_expire(id)
   ↓
根据返回值执行
   ├─ ReleaseAll(to) → 自动释放
   ├─ RefundAll(to) → 自动退款
   └─ Noop → 等待手动处理
```

## 📝 最佳实践

### 1. ID设计

- 使用业务订单ID作为托管ID
- 确保ID全局唯一
- 建议使用递增计数器

### 2. 到期策略

- OTC订单：超时自动退款
- 桥接服务：超时自动退款
- 长期托管：使用Noop等待手动处理

### 3. 多路分账

- 优先转出固定费用（平台费、gas费等）
- 最后一笔使用 `release_all` 清空余额
- 避免精度损失导致资金残留

### 4. 错误处理

- 捕获 `Insufficient` 错误，给用户友好提示
- 捕获 `NoLock` 错误，检查订单状态
- 所有托管操作包裹在事务中

### 5. 状态同步

- 业务pallet维护订单状态
- Escrow仅维护资金状态
- 通过事件同步状态变化

## 🔗 相关模块

- **pallet-otc-order**: OTC订单管理（使用托管服务）
- **pallet-simple-bridge**: 桥接服务（使用托管服务）
- **pallet-arbitration**: 仲裁系统（操作托管状态）
- **pallet-market-maker**: 做市商管理（资金锁定）

## 📚 参考资源

- [托管服务设计文档](../../docs/escrow-design.md)
- [到期策略实现指南](../../docs/expiry-policy-guide.md)
- [安全审计报告](../../docs/escrow-security-audit.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Memopark 开发团队
