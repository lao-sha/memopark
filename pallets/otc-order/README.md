# Pallet OTC Order（场外交易订单模块）

## 📋 模块概述

`pallet-otc-order` 是 Stardust 区块链的 **OTC（场外交易）订单管理模块**，负责整个 OTC 交易订单的完整生命周期管理。本模块从原 `pallet-trading` 拆分而来（v0.1.0, 2025-11-03），提供了标准订单和首购订单的完整流程，支持托管集成、信用系统、定价服务和仲裁机制。

### 核心特性

- ✅ **完整订单生命周期管理**：创建、支付、释放、取消、争议、过期全流程
- ✅ **首购订单特殊逻辑**：固定 USD 价值、动态 DUST 数量计算、配额管理
- ✅ **托管集成**：与 `pallet-escrow` 深度集成，确保资金安全
- ✅ **信用系统集成**：自动记录买家和做市商的信用记录
- ✅ **定价服务集成**：实时获取 DUST/USD 市场汇率
- ✅ **仲裁支持**：支持争议发起和仲裁裁决执行
- ✅ **防重放攻击**：TRON 交易哈希去重机制
- ✅ **首购配额管理**：做市商首购订单上限控制
- ✅ **额度管理**：买家交易额度占用和释放（方案C+）

### 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1.0 | 2025-11-03 | 从 `pallet-trading` 拆分而来，独立模块 |
| v0.2.0 | 2025-11 | 新增订单金额验证、买家额度管理（方案C+） |

---

## 🔑 核心功能

### 1. 标准 OTC 订单流程

#### 1.1 订单创建（`create_order`）

买家创建 OTC 订单，向指定做市商购买 DUST。

**完整流程：**
1. 验证订单金额在限制范围内（20-200 USD）
2. 验证做市商存在且激活
3. 从定价服务获取当前 DUST/USD 汇率
4. 计算订单总金额（USDT）= DUST 数量 × 汇率
5. 占用买家交易额度（方案C+）
6. 锁定做市商的 DUST 到托管（使用 `order_id` 作为托管 ID）
7. 创建订单记录，设置超时时间（默认 1 小时）
8. 更新买家和做市商的订单列表
9. 发出订单创建事件

**权限：** 买家账户（签名交易）

**参数：**
- `maker_id`: 做市商 ID
- `dust_amount`: 购买的 DUST 数量
- `payment_commit`: 支付承诺哈希（买家提供）
- `contact_commit`: 联系方式承诺哈希（买家提供）

**调用示例：**

```rust
// 创建标准订单
let payment_commit = H256::from([1u8; 32]);
let contact_commit = H256::from([2u8; 32]);

Pallet::<T>::create_order(
    RuntimeOrigin::signed(buyer),
    maker_id,
    dust_amount,      // 例如：50_000_000_000_000 (50 DUST)
    payment_commit,
    contact_commit,
)?;
```

#### 1.2 买家标记已付款（`mark_paid`）

买家完成线下 USDT 支付后，标记订单已付款。

**完整流程：**
1. 验证订单存在且状态为 `Created`
2. 验证调用者是订单买家
3. （可选）验证并记录 TRON 交易哈希（防重放）
4. 更新订单状态为 `PaidOrCommitted`
5. 发出状态变更事件

**权限：** 买家

**参数：**
- `order_id`: 订单 ID
- `tron_tx_hash`: TRON 交易哈希（可选，32 字节）

**调用示例：**

```rust
// 标记已付款（不提供TRON交易哈希）
Pallet::<T>::mark_paid(
    RuntimeOrigin::signed(buyer),
    order_id,
    None,
)?;

// 标记已付款（提供TRON交易哈希）
let tron_tx_hash = vec![0x12, 0x34, /* ... 32 bytes ... */];
Pallet::<T>::mark_paid(
    RuntimeOrigin::signed(buyer),
    order_id,
    Some(tron_tx_hash),
)?;
```

#### 1.3 做市商释放 DUST（`release_dust`）

做市商确认收到 USDT 后，释放 DUST 给买家。

**完整流程：**
1. 验证订单存在且状态为 `PaidOrCommitted`
2. 验证调用者是订单做市商
3. 从托管释放 DUST 到买家
4. 更新订单状态为 `Released`
5. 记录做市商订单完成（提升信用分）
6. 释放买家占用的额度（方案C+）
7. 记录买家订单完成（提升信用分）
8. 如是首购订单，更新买家首购状态
9. 发出状态变更事件

**权限：** 做市商

**参数：**
- `order_id`: 订单 ID

**调用示例：**

```rust
// 做市商释放DUST
Pallet::<T>::release_dust(
    RuntimeOrigin::signed(maker),
    order_id,
)?;
```

#### 1.4 订单取消（`cancel_order`）

买家或做市商取消订单（仅限 `Created` 或 `Expired` 状态）。

**完整流程：**
1. 验证订单状态为 `Created` 或 `Expired`
2. 验证调用者是买家或做市商
3. 从托管退还 DUST 给做市商
4. 更新订单状态为 `Canceled`
5. 释放买家占用的额度（方案C+）
6. 记录买家订单取消（轻度降低信用）
7. 如是首购订单，减少做市商首购计数
8. 发出状态变更事件

**权限：** 买家或做市商

**参数：**
- `order_id`: 订单 ID

**调用示例：**

```rust
// 取消订单
Pallet::<T>::cancel_order(
    RuntimeOrigin::signed(buyer_or_maker),
    order_id,
)?;
```

#### 1.5 发起订单争议（`dispute_order`）

买家或做市商对订单发起争议（仅限 `PaidOrCommitted` 状态）。

**完整流程：**
1. 验证订单状态为 `PaidOrCommitted`
2. 验证调用者是买家或做市商
3. 更新订单状态为 `Disputed`
4. 发出状态变更事件
5. 后续由 `pallet-arbitration` 处理争议

**权限：** 买家或做市商

**参数：**
- `order_id`: 订单 ID

**调用示例：**

```rust
// 发起争议
Pallet::<T>::dispute_order(
    RuntimeOrigin::signed(buyer_or_maker),
    order_id,
)?;
```

---

### 2. 首购订单特殊逻辑

#### 2.1 创建首购订单（`create_first_purchase`）

买家创建首购订单，享受固定 USD 价值的优惠。

**特殊逻辑：**

1. **固定 USD 价值**：
   - 由 `FirstPurchaseUsdValue` 配置（默认 10 USD，精度 10^6）
   - 首购订单金额恒定为 10 USD，无需验证限额

2. **动态 DUST 数量**：
   - 根据实时汇率计算 DUST 数量
   - 公式：`dust_amount = usd_value * 10^12 / price`（考虑 DUST 精度）
   - 自动适应市场价格变化

3. **数量保护**：
   - DUST 数量必须在 `[MinFirstPurchaseDustAmount, MaxFirstPurchaseDustAmount]` 范围内
   - 防止汇率异常导致的极端数量

4. **配额限制**：
   - 每个做市商同时接收的首购订单数量有上限（默认 5 个）
   - 防止做市商资金压力过大

5. **一次性限制**：
   - 每个买家账户只能创建一次首购订单
   - 通过 `HasFirstPurchased` 存储永久标记

**权限：** 买家账户（未首购过）

**参数：**
- `maker_id`: 做市商 ID
- `payment_commit`: 支付承诺哈希
- `contact_commit`: 联系方式承诺哈希

**调用示例：**

```rust
// 创建首购订单
let payment_commit = H256::from([1u8; 32]);
let contact_commit = H256::from([2u8; 32]);

// 检查是否已首购
ensure!(
    !Pallet::<T>::has_user_first_purchased(&buyer),
    Error::<T>::AlreadyFirstPurchased
);

Pallet::<T>::create_first_purchase(
    RuntimeOrigin::signed(buyer),
    maker_id,
    payment_commit,
    contact_commit,
)?;
```

**状态更新：**
- 订单完成后，`HasFirstPurchased[buyer] = true`（永久标记）
- 做市商首购计数器 `MakerFirstPurchaseCount[maker_id]` 减 1

**首购订单完整流程示例：**

```rust
// 1. 用户检查首购资格
let has_purchased = Pallet::<T>::has_user_first_purchased(&buyer);
if has_purchased {
    return Err(Error::<T>::AlreadyFirstPurchased.into());
}

// 2. 查询做市商首购配额
let maker_count = Pallet::<T>::get_maker_first_purchase_count(maker_id);
if maker_count >= T::MaxFirstPurchaseOrdersPerMaker::get() {
    return Err(Error::<T>::FirstPurchaseQuotaExhausted.into());
}

// 3. 创建首购订单
Pallet::<T>::create_first_purchase(
    RuntimeOrigin::signed(buyer),
    maker_id,
    payment_commit,
    contact_commit,
)?;

// 4. 买家标记已付款
Pallet::<T>::mark_paid(
    RuntimeOrigin::signed(buyer),
    order_id,
    Some(tron_tx_hash),
)?;

// 5. 做市商释放DUST
Pallet::<T>::release_dust(
    RuntimeOrigin::signed(maker),
    order_id,
)?;

// 此时买家永久标记为已首购
assert!(Pallet::<T>::has_user_first_purchased(&buyer));
```

---

### 3. 订单状态流转

#### 3.1 状态机设计

```rust
pub enum OrderState {
    Created,           // 已创建，等待买家付款
    PaidOrCommitted,   // 买家已标记付款或做市商已确认
    Released,          // DUST 已释放
    Refunded,          // 已退款
    Canceled,          // 已取消
    Disputed,          // 争议中
    Closed,            // 已关闭
    Expired,           // 已过期（1 小时未支付，自动取消）
}
```

#### 3.2 状态转换规则

```
Created
  ├─→ PaidOrCommitted (买家标记已付款)
  ├─→ Canceled (买家/做市商取消)
  └─→ Expired (超时未支付)

PaidOrCommitted
  ├─→ Released (做市商释放DUST)
  └─→ Disputed (买家/做市商发起争议)

Disputed
  ├─→ Released (仲裁：买家胜诉)
  └─→ Refunded (仲裁：做市商胜诉)

Expired
  └─→ Canceled (买家/做市商取消)

Released / Refunded / Canceled / Closed
  (终态，不再转换)
```

#### 3.3 状态机验证表

| 当前状态 | 允许操作 | 新状态 | 说明 |
|---------|---------|--------|------|
| Created | `mark_paid` | PaidOrCommitted | 买家标记已付款 |
| Created | `cancel_order` | Canceled | 买家/做市商取消 |
| Created | (超时) | Expired | 自动过期 |
| PaidOrCommitted | `release_dust` | Released | 做市商释放DUST |
| PaidOrCommitted | `dispute_order` | Disputed | 发起争议 |
| Disputed | 仲裁结果 | Released/Refunded | 仲裁裁决 |
| Expired | `cancel_order` | Canceled | 取消过期订单 |

---

### 4. 托管集成机制

#### 4.1 托管ID设计

- **托管ID = 订单ID**：每个订单对应一个唯一的托管记录
- **自动管理**：订单创建时自动锁定，订单完成/取消时自动释放
- **资金安全**：做市商的DUST在订单创建时立即锁定到托管账户

#### 4.2 托管操作映射

| 订单操作 | 托管操作 | 说明 |
|---------|---------|------|
| `create_order` | `lock_from(maker, order_id, dust_amount)` | 锁定做市商DUST |
| `release_dust` | `release_all(order_id, buyer)` | 释放DUST给买家 |
| `cancel_order` | `refund_all(order_id, maker)` | 退还DUST给做市商 |
| 仲裁：买家胜 | `release_all(order_id, buyer)` | 释放DUST给买家 |
| 仲裁：做市商胜 | `refund_all(order_id, maker)` | 退还DUST给做市商 |

#### 4.3 托管失败处理

```rust
// 订单创建时托管失败
T::Escrow::lock_from(&maker_account, order_id, dust_amount)
    .map_err(|_| Error::<T>::MakerInsufficientBalance)?;

// 托管失败时，整个订单创建失败，不会产生订单记录
// 买家占用的额度会自动回滚
```

---

### 5. 订单金额验证（v0.2.0新增）

#### 5.1 金额限制规则

| 订单类型 | 最小金额 | 最大金额 | 说明 |
|---------|---------|---------|------|
| 标准订单 | 20 USD | 200 USD | 由 `MinOrderUsdAmount` 和 `MaxOrderUsdAmount` 配置 |
| 首购订单 | 10 USD (固定) | 10 USD (固定) | 由 `FirstPurchaseUsdAmount` 配置 |

#### 5.2 金额计算公式

```rust
// DUST数量 → USD金额
usd_amount = (dust_amount * dust_to_usd_rate) / 10^12

// USD金额 → DUST数量
dust_amount = (usd_amount * 10^12) / dust_to_usd_rate
```

**精度说明：**
- DUST精度：10^12（12位小数）
- USD精度：10^6（6位小数）
- 汇率精度：10^6（6位小数）

#### 5.3 金额验证接口

```rust
// 验证订单金额
pub fn validate_order_amount(
    dust_amount: BalanceOf<T>,
    is_first_purchase: bool,
) -> Result<u64, DispatchError>

// 查询最大可购买DUST数量
pub fn get_max_purchasable_dust() -> Result<BalanceOf<T>, DispatchError>

// 查询指定DUST对应的USD金额
pub fn get_usd_amount_for_dust(
    dust_amount: BalanceOf<T>
) -> Result<u64, DispatchError>

// 检查DUST数量是否有效
pub fn is_dust_amount_valid(dust_amount: BalanceOf<T>) -> bool
```

**使用示例：**

```rust
// 前端查询当前价格下最大可购买数量
let max_dust = Pallet::<T>::get_max_purchasable_dust()?;
println!("当前最多可购买 {} DUST", max_dust);

// 前端计算指定数量对应的USD金额
let usd_amount = Pallet::<T>::get_usd_amount_for_dust(50_000_000_000_000)?;
println!("50 DUST ≈ {} USD", usd_amount as f64 / 1_000_000.0);

// 验证用户输入的DUST数量
if !Pallet::<T>::is_dust_amount_valid(user_input_dust) {
    return Err("订单金额不在允许范围内");
}
```

---

### 6. 买家额度管理（方案C+）

#### 6.1 额度管理机制

**核心思想：** 订单创建时占用额度，订单完成/取消时释放额度。

**流程：**

```rust
// 1. 订单创建时
let usd_amount = calculate_usd_amount(dust_amount, price)?;
T::Credit::occupy_quota(&buyer, usd_amount)?;  // 占用额度

// 2. 订单释放时
T::Credit::release_quota(&buyer, usd_amount)?; // 释放额度
T::Credit::record_order_completed(&buyer, order_id)?; // 提升信用

// 3. 订单取消时
T::Credit::release_quota(&buyer, usd_amount)?; // 释放额度
T::Credit::record_order_cancelled(&buyer, order_id)?; // 轻度降低信用
```

#### 6.2 额度检查逻辑

```rust
pub trait BuyerQuotaInterface<AccountId> {
    /// 占用买家额度
    fn occupy_quota(buyer: &AccountId, usd_amount: u64) -> DispatchResult;

    /// 释放买家额度
    fn release_quota(buyer: &AccountId, usd_amount: u64) -> DispatchResult;

    /// 查询买家剩余额度
    fn get_available_quota(buyer: &AccountId) -> u64;
}
```

#### 6.3 额度不足处理

```rust
// 买家额度不足时，订单创建失败
T::Credit::occupy_quota(&buyer, usd_amount)
    .map_err(|_| Error::<T>::QuotaExhausted)?;
```

**前端提示示例：**

```typescript
try {
  await api.tx.otcOrder.createOrder(makerId, dustAmount, paymentCommit, contactCommit)
    .signAndSend(buyer);
} catch (error) {
  if (error.includes('QuotaExhausted')) {
    alert('您的交易额度不足，请完成现有订单或提升信用等级');
  }
}
```

---

### 7. 仲裁集成接口

#### 7.1 检查争议权限（`can_dispute_order`）

检查用户是否有权对订单发起争议。

**规则：**
- 买家（taker）：可以对自己的订单发起争议
- 做市商（maker）：可以对自己参与的订单发起争议

**调用示例：**

```rust
// 检查用户是否可以发起争议
let can_dispute = Pallet::<T>::can_dispute_order(&user, order_id);
if !can_dispute {
    return Err(Error::<T>::NotAuthorized.into());
}
```

#### 7.2 应用仲裁裁决（`apply_arbitration_decision`）

由 `pallet-arbitration` 调用，应用仲裁裁决到订单。

**裁决类型：**

| 裁决类型 | 说明 | 操作 | 信用记录 |
|---------|------|------|---------|
| `Release` | 买家胜诉 | 托管释放给买家 | 做市商胜诉（信用提升） |
| `Refund` | 做市商胜诉 | 托管退还给做市商 | 做市商败诉（信用降低） |
| `Partial(bps)` | 按比例分账 | 暂未实现，作为 `Refund` 处理 | 做市商败诉 |

**调用示例：**

```rust
// 仲裁委员会应用裁决
use pallet_arbitration::pallet::Decision;

Pallet::<T>::apply_arbitration_decision(
    order_id,
    Decision::Release,  // 买家胜诉
)?;
```

**信用记录：**
- 自动调用 `MakerCredit::record_maker_dispute_result`
- 记录做市商的胜诉/败诉结果
- 影响做市商信用评分和接单优先级

---

## 📊 核心数据结构

### OrderState（订单状态枚举）

```rust
#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum OrderState {
    /// 已创建，等待买家付款
    Created,
    /// 买家已标记付款或做市商已确认
    PaidOrCommitted,
    /// DUST 已释放
    Released,
    /// 已退款
    Refunded,
    /// 已取消
    Canceled,
    /// 争议中
    Disputed,
    /// 已关闭
    Closed,
    /// 已过期（1 小时未支付，自动取消）
    Expired,
}
```

### Order（OTC 订单结构）

```rust
#[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct Order<T: Config> {
    /// 做市商ID
    pub maker_id: u64,
    /// 做市商账户
    pub maker: T::AccountId,
    /// 买家账户
    pub taker: T::AccountId,
    /// 单价（USDT/DUST，精度10^6）
    pub price: BalanceOf<T>,
    /// 数量（DUST数量）
    pub qty: BalanceOf<T>,
    /// 总金额（USDT金额）
    pub amount: BalanceOf<T>,
    /// 创建时间（毫秒时间戳）
    pub created_at: MomentOf,
    /// 超时时间（毫秒时间戳）
    pub expire_at: MomentOf,
    /// 证据窗口截止时间（毫秒时间戳）
    pub evidence_until: MomentOf,
    /// 做市商 TRON 收款地址（固定34字节）
    pub maker_tron_address: TronAddress,
    /// 支付承诺哈希（买家提供）
    pub payment_commit: H256,
    /// 联系方式承诺哈希（买家提供）
    pub contact_commit: H256,
    /// 订单状态
    pub state: OrderState,
    /// EPAY 交易号（可选）
    pub epay_trade_no: Option<BoundedVec<u8, ConstU32<64>>>,
    /// 订单完成时间（毫秒时间戳）
    pub completed_at: Option<MomentOf>,
    /// 是否为首购订单
    pub is_first_purchase: bool,
}
```

### 类型别名

```rust
/// Balance 类型别名
pub type BalanceOf<T> = <<T as Config>::Currency as Currency<
    <T as frame_system::Config>::AccountId,
>>::Balance;

/// 时间戳类型别名（毫秒）
pub type MomentOf = u64;

/// TRON 地址类型（固定 34 字节）
pub type TronAddress = BoundedVec<u8, ConstU32<34>>;
```

---

## 🔐 存储结构

### 核心存储

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `NextOrderId` | `u64` | 下一个订单 ID，单调递增 |
| `Orders` | `Map<u64, Order>` | 订单记录，订单ID → 订单详情 |
| `BuyerOrders` | `Map<AccountId, Vec<u64>>` | 买家订单列表，最多 100 个 |
| `MakerOrders` | `Map<u64, Vec<u64>>` | 做市商订单列表，最多 1000 个 |

### 首购管理

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `HasFirstPurchased` | `Map<AccountId, bool>` | 买家是否已首购（永久标记） |
| `MakerFirstPurchaseCount` | `Map<u64, u32>` | 做市商当前首购订单计数 |
| `MakerFirstPurchaseOrders` | `Map<u64, Vec<u64>>` | 做市商首购订单列表，最多 10 个 |

### 防重放攻击

| 存储项 | 类型 | 说明 |
|--------|------|------|
| `TronTxUsed` | `Map<H256, BlockNumber>` | TRON 交易哈希使用记录（防重放） |
| `TronTxQueue` | `Vec<(H256, BlockNumber)>` | TRON 交易哈希队列（用于清理，最多 10000 个） |

---

## 🎯 事件（Events）

```rust
pub enum Event<T: Config> {
    /// 订单已创建
    OrderCreated {
        order_id: u64,
        maker_id: u64,
        buyer: T::AccountId,
        dust_amount: BalanceOf<T>,
        is_first_purchase: bool,
    },

    /// 订单状态已变更
    OrderStateChanged {
        order_id: u64,
        old_state: u8,
        new_state: u8,
        actor: Option<T::AccountId>,
    },

    /// 首购订单已创建
    FirstPurchaseOrderCreated {
        order_id: u64,
        buyer: T::AccountId,
        maker_id: u64,
        usd_value: u128,
        dust_amount: BalanceOf<T>,
    },

    /// TRON 交易哈希已记录
    TronTxHashRecorded {
        tx_hash: H256,
    },

    /// TRON 交易哈希已清理
    TronTxHashCleaned {
        count: u32,
    },
}
```

---

## ❌ 错误（Errors）

| 错误 | 说明 |
|------|------|
| `OrderNotFound` | 订单不存在 |
| `MakerNotFound` | 做市商不存在 |
| `MakerNotActive` | 做市商未激活 |
| `InvalidOrderStatus` | 订单状态不正确 |
| `NotAuthorized` | 未授权操作 |
| `EncodingError` | 数据编码错误 |
| `StorageLimitReached` | 存储容量限制已达到 |
| `TooManyOrders` | 订单数量超过限制 |
| `AlreadyFirstPurchased` | 账户已经首购过 |
| `FirstPurchaseQuotaExhausted` | 做市商首购配额已用完 |
| `MakerInsufficientBalance` | 做市商余额不足 |
| `PricingUnavailable` | 定价服务不可用 |
| `InvalidPrice` | 价格无效或异常 |
| `CalculationOverflow` | 数值计算溢出 |
| `TronTxHashAlreadyUsed` | TRON 交易哈希已被使用 |
| `OrderAmountExceedsLimit` | 订单金额超过最大限制（200 USD） |
| `OrderAmountTooSmall` | 订单金额低于最小限制（20 USD） |
| `AmountCalculationOverflow` | 金额计算溢出 |
| `PricingServiceUnavailable` | 定价服务不可用 |

---

## 🔧 配置参数（Config）

```rust
pub trait Config: frame_system::Config {
    /// 货币类型
    type Currency: Currency<Self::AccountId>;

    /// Timestamp（用于获取当前时间）
    type Timestamp: UnixTime;

    /// 托管服务接口（注意：Escrow 使用 order_id 作为托管 ID）
    type Escrow: pallet_escrow::Escrow<Self::AccountId, BalanceOf<Self>>;

    /// 买家信用记录接口（同时支持额度管理）
    type Credit: pallet_credit::BuyerCreditInterface<Self::AccountId>
        + pallet_credit::quota::BuyerQuotaInterface<Self::AccountId>;

    /// 做市商信用记录接口
    type MakerCredit: MakerCreditInterface;

    /// 定价服务接口
    type Pricing: PricingProvider<BalanceOf<Self>>;

    /// Maker Pallet 类型（用于跨 pallet 调用）
    type MakerPallet: MakerInterface<Self::AccountId, BalanceOf<Self>>;

    /// 订单超时时间（默认 1 小时 = 3,600,000 毫秒）
    #[pallet::constant]
    type OrderTimeout: Get<u64>;

    /// 证据窗口时间（默认 24 小时 = 86,400,000 毫秒）
    #[pallet::constant]
    type EvidenceWindow: Get<u64>;

    /// 首购订单USD固定价值（精度 10^6，10_000_000 = 10 USD）
    #[pallet::constant]
    type FirstPurchaseUsdValue: Get<u128>;

    /// 首购订单最小DUST数量（防止汇率异常，例如 1 DUST）
    #[pallet::constant]
    type MinFirstPurchaseDustAmount: Get<BalanceOf<Self>>;

    /// 首购订单最大DUST数量（防止汇率异常，例如 1000 DUST）
    #[pallet::constant]
    type MaxFirstPurchaseDustAmount: Get<BalanceOf<Self>>;

    /// OTC订单最大USD金额（200 USD，精度10^6）
    #[pallet::constant]
    type MaxOrderUsdAmount: Get<u64>;

    /// OTC订单最小USD金额（20 USD，精度10^6，首购除外）
    #[pallet::constant]
    type MinOrderUsdAmount: Get<u64>;

    /// 首购订单固定USD金额（10 USD，精度10^6）
    #[pallet::constant]
    type FirstPurchaseUsdAmount: Get<u64>;

    /// 金额验证容差（1%，用于处理价格微小波动）
    #[pallet::constant]
    type AmountValidationTolerance: Get<u16>;

    /// 每个做市商最多同时接收的首购订单数量（默认 5）
    #[pallet::constant]
    type MaxFirstPurchaseOrdersPerMaker: Get<u32>;

    /// 权重信息
    type WeightInfo: WeightInfo;
}
```

### Runtime 配置示例

```rust
impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Timestamp = Timestamp;
    type Escrow = Escrow;
    type Credit = Credit;
    type MakerCredit = Credit;
    type Pricing = Pricing;
    type MakerPallet = Maker;

    // 订单超时时间（1 小时）
    type OrderTimeout = ConstU64<3_600_000>;

    // 证据窗口时间（24 小时）
    type EvidenceWindow = ConstU64<86_400_000>;

    // 首购订单 USD 固定价值（10 USD）
    type FirstPurchaseUsdValue = ConstU128<10_000_000>;

    // 首购订单最小 DUST 数量（1 DUST）
    type MinFirstPurchaseDustAmount = ConstU128<1_000_000_000_000>;

    // 首购订单最大 DUST 数量（1000 DUST）
    type MaxFirstPurchaseDustAmount = ConstU128<1_000_000_000_000_000>;

    // OTC订单最大USD金额（200 USD）
    type MaxOrderUsdAmount = ConstU64<200_000_000>;

    // OTC订单最小USD金额（20 USD，首购除外）
    type MinOrderUsdAmount = ConstU64<20_000_000>;

    // 首购订单固定USD金额（10 USD）
    type FirstPurchaseUsdAmount = ConstU64<10_000_000>;

    // 金额验证容差（1%）
    type AmountValidationTolerance = ConstU16<100>;

    // 每个做市商最多同时接收的首购订单数量
    type MaxFirstPurchaseOrdersPerMaker = ConstU32<5>;

    type WeightInfo = ();
}
```

---

## 📱 前端调用示例

### 1. 创建标准 OTC 订单

```typescript
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { Hash } from '@polkadot/types/interfaces';
import { blake2AsHex } from '@polkadot/util-crypto';

// 生成支付承诺哈希
function generatePaymentCommit(paymentInfo: string): Hash {
  return blake2AsHex(paymentInfo);
}

// 生成联系方式承诺哈希
function generateContactCommit(contact: string): Hash {
  return blake2AsHex(contact);
}

// 创建订单
async function createOrder(
  api: ApiPromise,
  account: KeyringPair,
  makerId: number,
  dustAmount: string,
  paymentInfo: string,
  contact: string
) {
  // 1. 检查订单金额是否有效
  const isValid = await api.query.otcOrder.is_dust_amount_valid(dustAmount);
  if (!isValid) {
    throw new Error('订单金额不在允许范围内');
  }

  // 2. 查询对应的USD金额
  const usdAmount = await api.query.otcOrder.get_usd_amount_for_dust(dustAmount);
  console.log(`购买 ${dustAmount} DUST ≈ ${usdAmount / 1_000_000} USD`);

  // 3. 生成承诺哈希
  const paymentCommit = generatePaymentCommit(paymentInfo);
  const contactCommit = generateContactCommit(contact);

  // 4. 创建订单交易
  const tx = api.tx.otcOrder.createOrder(
    makerId,
    dustAmount,
    paymentCommit,
    contactCommit
  );

  // 5. 签名并发送
  const hash = await tx.signAndSend(account, { nonce: -1 }, (result) => {
    if (result.status.isInBlock) {
      console.log(`订单已打包: ${result.status.asInBlock.toHex()}`);
    } else if (result.status.isFinalized) {
      console.log(`订单已确认: ${result.status.asFinalized.toHex()}`);

      // 监听事件获取 order_id
      result.events.forEach(({ event }) => {
        if (api.events.otcOrder.OrderCreated.is(event)) {
          const data = event.data as any;
          console.log('订单 ID:', data.orderId.toNumber());
          console.log('做市商 ID:', data.makerId.toNumber());
          console.log('买家:', data.buyer.toString());
          console.log('DUST 数量:', data.dustAmount.toString());
        }
      });
    }
  });

  console.log('订单创建交易哈希:', hash.toHex());
}
```

### 2. 创建首购订单

```typescript
// 创建首购订单
async function createFirstPurchase(
  api: ApiPromise,
  account: KeyringPair,
  makerId: number,
  paymentInfo: string,
  contact: string
) {
  // 1. 检查是否已首购
  const hasFirstPurchased = await api.query.otcOrder.hasFirstPurchased(account.address);
  if (hasFirstPurchased.isTrue) {
    throw new Error('您已经创建过首购订单');
  }

  // 2. 检查做市商首购配额
  const makerCount = await api.query.otcOrder.makerFirstPurchaseCount(makerId);
  const maxCount = api.consts.otcOrder.maxFirstPurchaseOrdersPerMaker;
  if (makerCount.toNumber() >= maxCount.toNumber()) {
    throw new Error('该做市商首购配额已用完');
  }

  // 3. 生成承诺哈希
  const paymentCommit = generatePaymentCommit(paymentInfo);
  const contactCommit = generateContactCommit(contact);

  // 4. 创建首购订单交易
  const tx = api.tx.otcOrder.createFirstPurchase(
    makerId,
    paymentCommit,
    contactCommit
  );

  // 5. 签名并发送
  await tx.signAndSend(account, { nonce: -1 }, (result) => {
    if (result.status.isFinalized) {
      result.events.forEach(({ event }) => {
        if (api.events.otcOrder.FirstPurchaseOrderCreated.is(event)) {
          const data = event.data as any;
          console.log('首购订单 ID:', data.orderId.toNumber());
          console.log('USD 价值:', data.usdValue.toString());
          console.log('DUST 数量:', data.dustAmount.toString());
        }
      });
    }
  });
}
```

### 3. 买家标记已付款

```typescript
// 买家标记已付款
async function markPaid(
  api: ApiPromise,
  account: KeyringPair,
  orderId: number,
  tronTxHash?: string // 可选，64位16进制字符串
) {
  // 1. 转换TRON交易哈希（如有）
  let tronTxHashBytes: Uint8Array | null = null;
  if (tronTxHash) {
    // 移除 '0x' 前缀（如有）
    const cleanHash = tronTxHash.replace(/^0x/, '');
    if (cleanHash.length !== 64) {
      throw new Error('TRON 交易哈希必须是 32 字节（64 位 16 进制）');
    }
    tronTxHashBytes = new Uint8Array(
      cleanHash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
  }

  // 2. 创建交易
  const tx = api.tx.otcOrder.markPaid(orderId, tronTxHashBytes);

  // 3. 签名并发送
  await tx.signAndSend(account);
}
```

### 4. 做市商释放 DUST

```typescript
// 做市商释放 DUST
async function releaseDust(
  api: ApiPromise,
  account: KeyringPair,
  orderId: number
) {
  const tx = api.tx.otcOrder.releaseDust(orderId);
  await tx.signAndSend(account);
}
```

### 5. 查询订单信息

```typescript
// 查询订单信息
async function getOrderInfo(api: ApiPromise, orderId: number) {
  const order = await api.query.otcOrder.orders(orderId);

  if (order.isSome) {
    const orderData = order.unwrap();
    return {
      makerId: orderData.makerId.toNumber(),
      maker: orderData.maker.toString(),
      taker: orderData.taker.toString(),
      price: orderData.price.toString(),
      qty: orderData.qty.toString(),
      amount: orderData.amount.toString(),
      createdAt: orderData.createdAt.toNumber(),
      expireAt: orderData.expireAt.toNumber(),
      state: orderData.state.toString(),
      isFirstPurchase: orderData.isFirstPurchase.isTrue,
      completedAt: orderData.completedAt.isSome
        ? orderData.completedAt.unwrap().toNumber()
        : null,
    };
  } else {
    throw new Error('订单不存在');
  }
}
```

### 6. 查询买家订单列表

```typescript
// 查询买家订单列表
async function getBuyerOrders(api: ApiPromise, buyer: string) {
  const orderIds = await api.query.otcOrder.buyerOrders(buyer);
  console.log('买家订单 ID 列表:', orderIds.map(id => id.toNumber()));

  // 批量查询订单详情
  const orders = await Promise.all(
    orderIds.map(async (id) => {
      const order = await api.query.otcOrder.orders(id.toNumber());
      return {
        orderId: id.toNumber(),
        data: order.isSome ? order.unwrap() : null,
      };
    })
  );

  return orders.filter(o => o.data !== null);
}
```

### 7. 查询做市商订单列表

```typescript
// 查询做市商订单列表
async function getMakerOrders(api: ApiPromise, makerId: number) {
  const orderIds = await api.query.otcOrder.makerOrders(makerId);
  console.log('做市商订单 ID 列表:', orderIds.map(id => id.toNumber()));

  // 批量查询订单详情
  const orders = await Promise.all(
    orderIds.map(async (id) => {
      const order = await api.query.otcOrder.orders(id.toNumber());
      return {
        orderId: id.toNumber(),
        data: order.isSome ? order.unwrap() : null,
      };
    })
  );

  return orders.filter(o => o.data !== null);
}
```

### 8. 查询定价信息

```typescript
// 查询当前最大可购买DUST数量
async function getMaxPurchasableDust(api: ApiPromise) {
  const maxDust = await api.query.otcOrder.getMaxPurchasableDust();
  console.log('当前最多可购买:', maxDust.toString(), 'DUST');
  return maxDust;
}

// 查询指定DUST数量对应的USD金额
async function getUsdAmountForDust(api: ApiPromise, dustAmount: string) {
  const usdAmount = await api.query.otcOrder.getUsdAmountForDust(dustAmount);
  console.log(`${dustAmount} DUST ≈ ${usdAmount / 1_000_000} USD`);
  return usdAmount;
}
```

---

## 🔗 依赖接口

### 1. Escrow（托管服务）

```rust
pub trait Escrow<AccountId, Balance> {
    /// 从账户锁定资金到托管
    fn lock_from(from: &AccountId, id: u64, amount: Balance) -> DispatchResult;

    /// 释放托管资金到目标账户
    fn release_all(id: u64, to: &AccountId) -> DispatchResult;

    /// 退还托管资金到原账户
    fn refund_all(id: u64, to: &AccountId) -> DispatchResult;
}
```

**集成说明：**
- 订单ID直接作为托管ID使用
- 确保一对一映射关系
- 托管失败时订单创建失败

### 2. BuyerCreditInterface（买家信用记录）

```rust
pub trait BuyerCreditInterface<AccountId> {
    /// 记录买家订单完成
    fn record_order_completed(buyer: &AccountId, order_id: u64) -> DispatchResult;

    /// 记录买家订单取消
    fn record_order_cancelled(buyer: &AccountId, order_id: u64) -> DispatchResult;
}
```

### 3. BuyerQuotaInterface（买家额度管理，方案C+）

```rust
pub trait BuyerQuotaInterface<AccountId> {
    /// 占用买家额度
    fn occupy_quota(buyer: &AccountId, usd_amount: u64) -> DispatchResult;

    /// 释放买家额度
    fn release_quota(buyer: &AccountId, usd_amount: u64) -> DispatchResult;

    /// 查询买家剩余额度
    fn get_available_quota(buyer: &AccountId) -> u64;
}
```

### 4. MakerCreditInterface（做市商信用记录）

```rust
pub trait MakerCreditInterface {
    /// 记录做市商订单完成
    fn record_maker_order_completed(
        maker_id: u64,
        order_id: u64,
        response_time_seconds: u32,
    ) -> DispatchResult;

    /// 记录做市商订单超时
    fn record_maker_order_timeout(
        maker_id: u64,
        order_id: u64,
    ) -> DispatchResult;

    /// 记录做市商争议结果
    fn record_maker_dispute_result(
        maker_id: u64,
        order_id: u64,
        maker_win: bool,
    ) -> DispatchResult;
}
```

### 5. PricingProvider（定价服务）

```rust
pub trait PricingProvider<Balance> {
    /// 获取 DUST/USD 汇率（精度 10^6）
    fn get_dust_to_usd_rate() -> Option<Balance>;
}
```

**集成说明：**
- 实时获取市场汇率
- 用于计算订单金额
- 首购订单根据汇率计算DUST数量

### 6. MakerInterface（Maker 模块接口）

```rust
pub trait MakerInterface<AccountId, Balance> {
    /// 查询做市商申请信息
    fn get_maker_application(maker_id: u64) -> Option<MakerApplicationInfo<AccountId, Balance>>;

    /// 检查做市商是否激活
    fn is_maker_active(maker_id: u64) -> bool;
}

pub struct MakerApplicationInfo<AccountId, Balance> {
    pub account: AccountId,
    pub tron_address: BoundedVec<u8, ConstU32<34>>,
    pub is_active: bool,
    pub _phantom: PhantomData<Balance>,
}
```

---

## 🛡️ 安全考虑

### 1. 资金安全

#### 托管机制
- ✅ **立即锁定**：订单创建时立即锁定做市商的 DUST 到托管
- ✅ **原子操作**：托管锁定失败时，整个订单创建失败
- ✅ **状态机保护**：严格的订单状态流转验证
- ✅ **仅托管操作**：只有托管模块可以操作资金

#### 错误处理
```rust
// 示例：托管失败时的回滚
T::Escrow::lock_from(&maker_account, order_id, dust_amount)
    .map_err(|_| Error::<T>::MakerInsufficientBalance)?;

// 如果托管失败，整个交易回滚：
// - 不会生成订单记录
// - 不会占用买家额度
// - 不会更新任何索引
```

### 2. 防重放攻击

#### TRON 交易哈希去重
- ✅ **全局记录**：`TronTxUsed` 存储记录所有使用过的 TRON 交易哈希
- ✅ **立即验证**：`mark_paid` 时立即检查哈希是否已使用
- ✅ **循环队列**：`TronTxQueue` 最多存储 10000 个哈希，避免状态膨胀
- ✅ **自动清理**：可定期清理过期的哈希记录

```rust
// 防重放检查
ensure!(
    !TronTxUsed::<T>::contains_key(tx_hash),
    Error::<T>::TronTxHashAlreadyUsed
);

// 记录使用
TronTxUsed::<T>::insert(tx_hash, current_block);
```

### 3. 首购防滥用

#### 账户级限制
- ✅ **永久标记**：每个账户只能首购一次（`HasFirstPurchased`）
- ✅ **不可撤销**：首购标记一旦设置，永久生效
- ✅ **跨做市商**：限制是账户级别的，不是做市商级别的

#### 做市商配额
- ✅ **配额上限**：每个做市商同时接收的首购订单数量有上限（默认 5 个）
- ✅ **动态调整**：订单完成/取消时自动调整计数
- ✅ **防止挤兑**：避免做市商资金压力过大

```rust
// 首购配额检查
let current_count = MakerFirstPurchaseCount::<T>::get(maker_id);
ensure!(
    current_count < T::MaxFirstPurchaseOrdersPerMaker::get(),
    Error::<T>::FirstPurchaseQuotaExhausted
);
```

#### 数量保护
- ✅ **最小限制**：防止汇率过高导致 DUST 数量过小
- ✅ **最大限制**：防止汇率过低导致 DUST 数量过大
- ✅ **合理范围**：确保首购订单在合理范围内

```rust
// 数量保护
ensure!(
    dust_amount >= T::MinFirstPurchaseDustAmount::get(),
    Error::<T>::InvalidPrice
);
ensure!(
    dust_amount <= T::MaxFirstPurchaseDustAmount::get(),
    Error::<T>::InvalidPrice
);
```

### 4. 权限控制

#### 操作权限验证

| 操作 | 允许角色 | 验证逻辑 |
|-----|---------|---------|
| `create_order` | 任何用户 | 签名账户 |
| `create_first_purchase` | 未首购用户 | 签名账户 + 首购检查 |
| `mark_paid` | 买家 | `order.taker == caller` |
| `release_dust` | 做市商 | `order.maker == caller` |
| `cancel_order` | 买家或做市商 | `order.taker == caller || order.maker == caller` |
| `dispute_order` | 买家或做市商 | `order.taker == caller || order.maker == caller` |

#### 状态验证
```rust
// 示例：标记已付款时的状态验证
ensure!(
    matches!(order.state, OrderState::Created),
    Error::<T>::InvalidOrderStatus
);
```

### 5. 金额限制（v0.2.0新增）

#### 限制规则
- ✅ **最小金额**：20 USD（首购除外）
- ✅ **最大金额**：200 USD
- ✅ **容差机制**：1% 容差处理价格微小波动

#### 验证时机
```rust
// 订单创建时立即验证
let usd_amount = Self::validate_order_amount(dust_amount, false)?;

// 验证失败时订单创建失败
ensure!(
    usd_amount >= T::MinOrderUsdAmount::get(),
    Error::<T>::OrderAmountTooSmall
);
ensure!(
    usd_amount <= T::MaxOrderUsdAmount::get(),
    Error::<T>::OrderAmountExceedsLimit
);
```

### 6. 买家额度管理（方案C+）

#### 额度占用机制
- ✅ **创建时占用**：订单创建时立即占用买家额度
- ✅ **完成时释放**：订单完成/取消时自动释放额度
- ✅ **失败时回滚**：托管失败时额度占用自动回滚

```rust
// 额度占用
T::Credit::occupy_quota(&buyer, usd_amount)?;

// 额度释放
T::Credit::release_quota(&buyer, usd_amount)?;
```

---

## 💡 最佳实践

### 1. 订单创建

#### 前端检查清单
```typescript
// 1. 检查做市商状态
const makerActive = await api.query.maker.isMakerActive(makerId);
if (!makerActive) {
  throw new Error('做市商未激活');
}

// 2. 检查金额范围
const isValid = await api.query.otcOrder.isDustAmountValid(dustAmount);
if (!isValid) {
  throw new Error('订单金额不在允许范围内');
}

// 3. 查询USD金额
const usdAmount = await api.query.otcOrder.getUsdAmountForDust(dustAmount);
console.log(`您将支付约 ${usdAmount / 1_000_000} USD`);

// 4. 检查买家额度
const availableQuota = await api.query.credit.getAvailableQuota(buyer);
if (availableQuota < usdAmount) {
  throw new Error('您的交易额度不足');
}

// 5. 创建订单
await api.tx.otcOrder.createOrder(...).signAndSend(buyer);
```

### 2. 首购订单

#### 前端检查清单
```typescript
// 1. 检查首购资格
const hasFirstPurchased = await api.query.otcOrder.hasFirstPurchased(buyer);
if (hasFirstPurchased) {
  throw new Error('您已经创建过首购订单');
}

// 2. 检查做市商首购配额
const makerCount = await api.query.otcOrder.makerFirstPurchaseCount(makerId);
const maxCount = api.consts.otcOrder.maxFirstPurchaseOrdersPerMaker;
if (makerCount >= maxCount) {
  throw new Error('该做市商首购配额已用完');
}

// 3. 查询首购数量
const firstPurchaseUsdValue = api.consts.otcOrder.firstPurchaseUsdValue;
const dustToUsdRate = await api.query.pricing.getDustToUsdRate();
const dustAmount = (firstPurchaseUsdValue * 10n**12n) / dustToUsdRate;
console.log(`您将获得约 ${dustAmount / 10n**12n} DUST`);

// 4. 创建首购订单
await api.tx.otcOrder.createFirstPurchase(...).signAndSend(buyer);
```

### 3. 订单状态监控

#### 前端轮询示例
```typescript
// 订单状态监控
async function monitorOrderState(
  api: ApiPromise,
  orderId: number,
  callback: (state: string) => void
) {
  const unsubscribe = await api.query.otcOrder.orders(orderId, (order) => {
    if (order.isSome) {
      const orderData = order.unwrap();
      const state = orderData.state.toString();
      callback(state);

      // 终态时停止监控
      if (['Released', 'Refunded', 'Canceled', 'Closed'].includes(state)) {
        unsubscribe();
      }
    }
  });
}

// 使用示例
monitorOrderState(api, orderId, (state) => {
  console.log('订单状态:', state);

  if (state === 'PaidOrCommitted') {
    alert('买家已标记付款，请做市商确认收款后释放DUST');
  } else if (state === 'Released') {
    alert('订单已完成，DUST已发放');
  } else if (state === 'Expired') {
    alert('订单已过期，请取消订单');
  }
});
```

### 4. 错误处理

#### 常见错误处理
```typescript
try {
  await api.tx.otcOrder.createOrder(...).signAndSend(buyer);
} catch (error) {
  const errorMessage = error.toString();

  if (errorMessage.includes('OrderAmountTooSmall')) {
    alert('订单金额太小，最低 20 USD');
  } else if (errorMessage.includes('OrderAmountExceedsLimit')) {
    alert('订单金额超过限制，最高 200 USD');
  } else if (errorMessage.includes('MakerNotActive')) {
    alert('做市商未激活，请选择其他做市商');
  } else if (errorMessage.includes('QuotaExhausted')) {
    alert('您的交易额度不足，请完成现有订单或提升信用等级');
  } else if (errorMessage.includes('AlreadyFirstPurchased')) {
    alert('您已经创建过首购订单');
  } else if (errorMessage.includes('FirstPurchaseQuotaExhausted')) {
    alert('该做市商首购配额已用完，请选择其他做市商');
  } else {
    alert('订单创建失败: ' + errorMessage);
  }
}
```

---

## ⚠️ 注意事项

### 1. 订单超时管理

- **超时时间**：默认 1 小时（`OrderTimeout`）
- **自动过期**：超时后订单状态变为 `Expired`
- **清理机制**：需要调用 `cancel_order` 清理过期订单
- **前端提醒**：应在订单创建后显示倒计时

### 2. TRON 交易哈希

- **可选性**：`mark_paid` 时提供 TRON 交易哈希是可选的
- **格式要求**：必须是 32 字节（64 位 16 进制字符串）
- **防重放**：每个哈希只能使用一次
- **清理策略**：考虑定期清理过期的哈希记录

### 3. 首购订单限制

- **一次性**：每个账户只能创建一次首购订单
- **不可撤销**：首购标记一旦设置，永久生效
- **配额有限**：做市商首购配额有限，需要提前查询

### 4. 金额计算精度

- **DUST 精度**：10^12（12 位小数）
- **USD 精度**：10^6（6 位小数）
- **汇率精度**：10^6（6 位小数）
- **溢出处理**：注意大额订单的数值溢出问题

### 5. 托管集成注意

- **托管ID = 订单ID**：确保一对一映射关系
- **托管失败回滚**：托管失败时整个订单创建失败
- **状态同步**：确保订单状态与托管状态同步

### 6. 信用系统集成

- **自动记录**：订单完成/取消时自动记录信用
- **双向记录**：同时记录买家和做市商的信用
- **影响权重**：信用分影响后续交易的额度和优先级

---

## 🚀 集成说明

### 1. 与 pallet-escrow 集成

**托管ID设计：**
- 订单ID直接作为托管ID使用
- 确保一对一映射关系

**集成流程：**
```rust
// 订单创建：锁定做市商DUST
T::Escrow::lock_from(&maker_account, order_id, dust_amount)?;

// 订单完成：释放DUST给买家
T::Escrow::release_all(order_id, &buyer_account)?;

// 订单取消：退还DUST给做市商
T::Escrow::refund_all(order_id, &maker_account)?;
```

### 2. 与 pallet-credit 集成

**信用记录时机：**
- 订单完成：提升买家和做市商信用分
- 订单取消：轻度降低买家信用分
- 订单超时：降低做市商信用分
- 争议结果：根据裁决调整做市商信用分

**额度管理（方案C+）：**
```rust
// 订单创建时占用额度
T::Credit::occupy_quota(&buyer, usd_amount)?;

// 订单完成时释放额度
T::Credit::release_quota(&buyer, usd_amount)?;
T::Credit::record_order_completed(&buyer, order_id)?;

// 订单取消时释放额度
T::Credit::release_quota(&buyer, usd_amount)?;
T::Credit::record_order_cancelled(&buyer, order_id)?;
```

### 3. 与 pallet-pricing 集成

**实时定价：**
```rust
// 获取当前DUST/USD汇率
let price = T::Pricing::get_dust_to_usd_rate()
    .ok_or(Error::<T>::PricingUnavailable)?;

// 计算订单总金额
let amount = dust_amount
    .checked_mul(&price)
    .ok_or(Error::<T>::CalculationOverflow)?;
```

### 4. 与 pallet-maker 集成

**做市商验证：**
```rust
// 查询做市商信息
let maker_app = T::MakerPallet::get_maker_application(maker_id)
    .ok_or(Error::<T>::MakerNotFound)?;

// 验证做市商状态
ensure!(maker_app.is_active, Error::<T>::MakerNotActive);

// 获取TRON收款地址
let maker_tron_address = maker_app.tron_address;
```

### 5. 与 pallet-arbitration 集成

**争议处理：**
```rust
// 检查争议权限
pub fn can_dispute_order(who: &T::AccountId, order_id: u64) -> bool {
    if let Some(order) = Orders::<T>::get(order_id) {
        &order.taker == who || &order.maker == who
    } else {
        false
    }
}

// 应用仲裁裁决
pub fn apply_arbitration_decision(
    order_id: u64,
    decision: pallet_arbitration::pallet::Decision,
) -> DispatchResult {
    // 根据裁决类型执行相应操作
    // ...
}
```

---

## 📚 相关模块

- **pallet-maker**: 做市商管理
- **pallet-escrow**: 托管服务
- **pallet-credit**: 信用管理（包含额度管理）
- **pallet-pricing**: 定价服务
- **pallet-arbitration**: 仲裁系统
- **pallet-trading**: 统一接口层
- **pallet-trading-common**: 公共工具库

---

## 📖 参考资料

### 技术文档
- [Substrate FRAME 文档](https://docs.substrate.io/reference/frame-pallets/)
- [Polkadot SDK 文档](https://paritytech.github.io/polkadot-sdk/)

### 项目文档
- [Stardust 项目总览](../../CLAUDE.md)
- [Pallet Maker 文档](../maker/README.md)
- [Pallet Escrow 文档](../escrow/README.md)
- [Pallet Credit 文档](../credit/README.md)

---

**注意：** 本文档描述的是 `pallet-otc-order` v0.2.0 版本的功能和接口。如有变更，请及时更新文档。
