# pallet-otc-order（OTC 订单管理）

## 概述

`pallet-otc-order` 负责 OTC 交易订单的创建、状态流转、资金托管与释放等核心功能。

**版本 v2.0.0 (2025-10-19) - 动态定价升级**

### 核心功能

1. **订单撮合**：基于 `pallet-otc-listing` 的挂单创建交易订单
2. **状态管理**：Created → PaidOrCommitted → Released/Refunded/Disputed/Canceled
3. **资金托管**：库存模式（库存已在挂单创建时锁定，订单完成时划转）
4. **价格上报**：订单完成时向 `pallet-pricing` 报告成交数据，用于市场均价统计
5. **超时保护**：自动处理到期订单，恢复库存
6. **争议处理**：支持仲裁介入，部分放行/全额放行/全额退款

### 定价机制（v2.0.0）

#### 价格来源
- **挂单价格**：直接使用 `pallet-otc-listing` 中挂单的 `price_usdt`
- **无需二次查询**：不再从 `pallet-pricing` 读取实时价格，避免价格波动风险
- **价格保护**：挂单价格已在创建时经过市场均价 ±20% 偏离检查（由 `pallet-otc-listing` 保证）

#### 价格反馈循环（✨ v2.0.0 核心功能）
```
pallet-pricing (市场均价) 
    ↓
pallet-otc-listing (±20% 检查) 
    ↓
pallet-otc-order (订单成交) 
    ↓
pallet-pricing (上报成交数据，更新均价)
```

- **成交上报**：订单放行时，调用 `pallet_pricing::add_otc_order(timestamp, price_usdt, memo_qty)`
- **统计更新**：成交数据进入 `pallet-pricing` 的 OTC 滑动窗口，影响后续市场均价
- **闭环反馈**：市场均价随真实成交动态调整，形成自适应定价机制

## 存储项

### 订单数据
- `Orders: u64 -> Order`：订单详情
  - `listing_id`：关联的挂单 ID
  - `maker`：卖家（做市商）
  - `taker`：买家
  - `price`：成交价格（USDT 单价，精度 10^6）
  - `qty`：成交数量（MEMO 最小单位）
  - `amount`：订单金额（price × qty）
  - `created_at`：创建时间（Unix时间戳毫秒）
  - `expire_at`：超时时间（Unix时间戳毫秒）
  - `evidence_until`：证据窗口截止时间（Unix时间戳毫秒）
  - `payment_commit`：支付凭证承诺哈希
  - `contact_commit`：联系方式承诺哈希
  - `state`：订单状态
- `NextOrderId: u64`：下一个订单 ID
- `ExpiringAt: BlockNumber -> Vec<u64>`：到期索引（按区块高度）

### 风控参数（可治理）
- `OpenWindowParam`：吃单限频窗口大小（块）
- `OpenMaxInWindowParam`：窗口内最多吃单数
- `PaidWindowParam`：标记支付限频窗口大小（块）
- `PaidMaxInWindowParam`：窗口内最多标记支付数
- `MinOrderAmount`：订单最小金额
- `ConfirmTTLParam`：订单确认 TTL（块）

### 限频追踪
- `OpenRate: AccountId -> (BlockNumber, u32)`：吃单限频记录
- `PaidRate: AccountId -> (BlockNumber, u32)`：标记支付限频记录

### 首购记录
- `FirstPurchaseRecords: AccountId -> FirstPurchaseInfo`：首购信息（限制每地址仅首购一次）

## 订单状态流转

```
Created (创建)
   ↓ mark_paid
PaidOrCommitted (已支付)
   ↓ release / arbitrate_release
Released (已完成)
```

或

```
Created / PaidOrCommitted
   ↓ mark_disputed
Disputed (争议中)
   ↓ arbitrate_release / arbitrate_refund / arbitrate_partial
Released / Refunded (已完成/已退款)
```

或

```
Created / PaidOrCommitted / Disputed
   ↓ refund_on_timeout (超时)
Refunded (已退款)
```

## 可调用接口

### 1. open_order（创建订单 - 兼容旧接口）

```rust
pub fn open_order(
    origin: OriginFor<T>,
    listing_id: u64,
    price: BalanceOf<T>,        // 保留参数（不校验）
    qty: BalanceOf<T>,
    amount: BalanceOf<T>,       // 保留参数（不校验）
    payment_commit: H256,
    contact_commit: H256,
) -> DispatchResult
```

#### 功能说明
- 基于挂单创建订单，数量 `qty` 必须在挂单的 `[min_qty, max_qty]` 范围内
- 直接使用挂单的 `price_usdt` 作为成交价格
- `price` 和 `amount` 参数保留但不使用（向后兼容）

### 2. open_order_with_protection（创建订单 - 推荐接口）✨

```rust
pub fn open_order_with_protection(
    origin: OriginFor<T>,
    listing_id: u64,
    qty: BalanceOf<T>,
    payment_commit: H256,
    contact_commit: H256,
    min_accept_price: Option<BalanceOf<T>>,  // 可选：买家最低接受价格（滑点保护）
    max_accept_price: Option<BalanceOf<T>>,  // 可选：买家最高接受价格（滑点保护）
) -> DispatchResult
```

#### 功能说明
- 推荐使用此接口，支持买家自定义滑点保护
- 自动从挂单读取价格并计算订单金额
- 校验逻辑：
  1. 读取挂单价格 `price_usdt`
  2. 计算订单金额 `amount = qty × price_usdt / 1_000_000`
  3. 校验做市商价带：`price_min ≤ amount ≤ price_max`（如设置）
  4. 校验买家滑点：`min_accept_price ≤ amount ≤ max_accept_price`（如设置）
  5. 校验数量范围和库存
  6. 扣减挂单库存

#### JavaScript 示例

```javascript
// 1. 查询挂单信息
const listing = await api.query.otcListing.listings(listingId);
const priceUsdt = listing.unwrap().price_usdt.toNumber();
const qty = 1000 * 1e12; // 购买 1,000 MEMO

// 2. 计算预期金额
const expectedAmount = (qty * priceUsdt) / 1_000_000;

// 3. 设置滑点保护（±1%）
const minAcceptPrice = Math.floor(expectedAmount * 0.99);
const maxAcceptPrice = Math.ceil(expectedAmount * 1.01);

// 4. 创建订单
const paymentCommit = '0x...'; // 支付凭证哈希
const contactCommit = '0x...'; // 联系方式哈希

const tx = api.tx.otcOrder.openOrderWithProtection(
  listingId,
  qty,
  paymentCommit,
  contactCommit,
  minAcceptPrice,
  maxAcceptPrice
);

const hash = await tx.signAndSend(keyring.getPair('//Bob'));
```

### 3. mark_paid（标记已支付）

```rust
pub fn mark_paid(origin: OriginFor<T>, id: u64) -> DispatchResult
```

#### 功能说明
- 买家标记已完成线下支付
- 状态从 `Created` → `PaidOrCommitted`
- 要求：调用者必须是 `taker`

### 4. mark_disputed（标记争议）

```rust
pub fn mark_disputed(origin: OriginFor<T>, id: u64) -> DispatchResult
```

#### 功能说明
- 买家或卖家标记订单为争议状态
- 状态 → `Disputed`
- 允许条件：
  1. 状态为 `PaidOrCommitted`（已支付未放行）
  2. 或超过 `expire_at`（超时）
  3. 且在 `evidence_until` 窗口内（证据追加期）

### 5. release（卖家放行）✨ 价格上报

```rust
pub fn release(origin: OriginFor<T>, id: u64) -> DispatchResult
```

#### 功能说明
- 卖家确认收款并放行 MEMO
- 从挂单托管（`pallet-escrow`）划转 `qty` 给买家
- **价格上报**：调用 `pallet_pricing::add_otc_order(timestamp, price_usdt, memo_qty)`
- 状态 → `Released`
- 要求：调用者必须是 `maker`，状态为 `PaidOrCommitted` 或 `Disputed`

#### 价格上报逻辑（v2.0.0 核心）
```rust
// 提取订单信息
let (price_usdt, memo_qty, timestamp) = {
    let ord = Orders::<T>::get(id)?;
    (
        ord.price.saturated_into::<u64>(),      // USDT单价
        ord.qty.saturated_into::<u128>(),       // MEMO数量
        ord.created_at.saturated_into::<u64>()  // 创建时间戳
    )
};

// 上报到 pallet-pricing
pallet_pricing::Pallet::<T>::add_otc_order(timestamp, price_usdt, memo_qty);
```

### 6. refund_on_timeout（超时退款）

```rust
pub fn refund_on_timeout(origin: OriginFor<T>, id: u64) -> DispatchResult
```

#### 功能说明
- 任何人可触发
- 超过 `expire_at` 且状态为 `Created` / `PaidOrCommitted` / `Disputed` 时，恢复挂单库存
- 状态 → `Refunded`

### 7. reveal_payment / reveal_contact（揭示承诺）

```rust
pub fn reveal_payment(
    origin: OriginFor<T>,
    id: u64,
    payload: Vec<u8>,
    salt: Vec<u8>,
) -> DispatchResult

pub fn reveal_contact(
    origin: OriginFor<T>,
    id: u64,
    payload: Vec<u8>,
    salt: Vec<u8>,
) -> DispatchResult
```

#### 功能说明
- 揭示支付凭证或联系方式的原文
- 校验 `blake2_256(payload || salt) == commit`
- 用于争议处理时提供证据

### 8. set_order_params（治理更新风控参数）

```rust
pub fn set_order_params(
    origin: OriginFor<T>,
    open_window: Option<BlockNumberFor<T>>,
    open_max_in_window: Option<u32>,
    paid_window: Option<BlockNumberFor<T>>,
    paid_max_in_window: Option<u32>,
    min_order_amount: Option<BalanceOf<T>>,
    confirm_ttl: Option<BlockNumberFor<T>>,
) -> DispatchResult
```

#### 功能说明
- 仅允许 Root 调用
- 未提供的参数保持不变

### 9. first_purchase_by_fiat（法币首购接口）

```rust
pub fn first_purchase_by_fiat(
    origin: OriginFor<T>,
    buyer: T::AccountId,
    amount: BalanceOf<T>,
    referrer: Option<T::AccountId>,
    fiat_order_id: Vec<u8>,
) -> DispatchResult
```

#### 功能说明
- 仅授权的法币网关服务账户可调用
- 验证买家未曾首购
- 金额范围：50-100 MEMO（可治理）
- 如有推荐人，绑定推荐关系并触发联盟计酬
- 如无推荐人，不绑定推荐关系（资金由链下转入国库）

## 仲裁钩子（ArbitrationHook）

为 `pallet-arbitration` 提供的内部接口：

### can_dispute
```rust
fn can_dispute(who: &T::AccountId, id: u64) -> bool
```
校验发起人是否可对该订单发起争议。

### arbitrate_release ✨ 价格上报
```rust
fn arbitrate_release(id: u64) -> DispatchResult
```
仲裁放行，划转 `qty` 给买家，并**上报成交数据到 pallet-pricing**。

### arbitrate_refund
```rust
fn arbitrate_refund(id: u64) -> DispatchResult
```
仲裁退款，恢复挂单库存。

### arbitrate_partial
```rust
fn arbitrate_partial(id: u64, bps: u16) -> DispatchResult
```
仲裁部分放行（按 bps 比例分配 MEMO 给买家和卖家）。

## 事件

### OrderOpened
```rust
OrderOpened {
    id: u64,
    listing_id: u64,
    maker: T::AccountId,
    taker: T::AccountId,
    price: BalanceOf<T>,        // 成交价格（USDT单价）
    qty: BalanceOf<T>,          // 成交数量（MEMO）
    amount: BalanceOf<T>,       // 订单金额
    created_at: MomentOf<T>,    // 创建时间（Unix毫秒）
    expire_at: MomentOf<T>,     // 超时时间（Unix毫秒）
}
```

### OrderPaidCommitted
买家已标记支付。

### OrderReleased
订单已完成（卖家放行或仲裁放行）。

### OrderRefunded
订单已退款（超时或仲裁退款）。

### OrderCanceled
订单已取消（预留，当前未实现）。

### OrderDisputed
订单进入争议状态。

### PaymentRevealed / ContactRevealed
承诺已揭示并校验通过。

### OrderParamsUpdated
风控参数已更新（治理）。

### FirstPurchaseCompleted
首购完成事件。

## 错误码

- `NotFound`：订单不存在
- `BadState`：状态错误、参数不合法、权限不足等
- `BadCommit`：承诺哈希校验失败
- `Unauthorized`：未授权的调用者（仅法币网关服务可调用）
- `AlreadyPurchased`：已经完成过首购
- `AmountOutOfRange`：金额超出首购限制
- `InvalidReferrer`：推荐人无效（不是有效会员）

## 风控机制

### 限频保护
- ✅ **吃单限频**：滑动窗口防刷单（`OpenWindow` / `OpenMaxInWindow`）
- ✅ **标记支付限频**：防止恶意标记（`PaidWindow` / `PaidMaxInWindow`）

### 金额保护
- ✅ **最小订单金额**：`MinOrderAmount`（防止垃圾订单）
- ✅ **数量范围**：挂单的 `[min_qty, max_qty]`
- ✅ **库存检查**：确保挂单剩余库存充足

### 时间保护
- ✅ **确认超时**：`ConfirmTTL`（买家支付后卖家必须在此时间内放行）
- ✅ **证据窗口**：`ConfirmTTL × 2`（争议期内可补充证据）
- ✅ **自动退款**：`on_initialize` 自动处理到期订单

### 价格安全（v2.0.0）
- ✅ **价格锁定**：订单创建时锁定挂单价格，避免价格波动风险
- ✅ **价格追溯**：订单事件中记录完整价格信息
- ✅ **价格反馈**：成交数据自动上报 `pallet-pricing`，形成闭环

## 监控建议

### 关键指标
- 订单创建频率（每小时/每日）
- 订单完成率（Released / Total）
- 订单超时率（Refunded / Total）
- 订单争议率（Disputed / Total）
- 平均确认时长（Created → Released）

### 价格监控（v2.0.0 新增）
- 成交价格分布（按时间段统计）
- 成交数量分布（按价格区间统计）
- OTC 成交对市场均价的影响（成交前后均价变化）

### 资金流监控
- 托管余额总量（各挂单托管余额之和）
- 未完成订单总金额（Created + PaidOrCommitted 状态的订单）
- 争议订单总金额（Disputed 状态的订单）

## 使用流程

### 1. 买家吃单创建订单

```javascript
// 查询挂单
const listing = await api.query.otcListing.listings(1);
const priceUsdt = listing.unwrap().price_usdt.toNumber();
const qty = 1000 * 1e12; // 1,000 MEMO

// 生成承诺哈希
const paymentData = "alipay:13800138000:20250119001"; // 支付方式:账号:订单号
const salt = crypto.randomBytes(32);
const paymentCommit = blake2_256(Buffer.concat([Buffer.from(paymentData), salt]));

const contactData = "telegram:@buyer123";
const contactSalt = crypto.randomBytes(32);
const contactCommit = blake2_256(Buffer.concat([Buffer.from(contactData), contactSalt]));

// 创建订单（推荐使用 with_protection）
const tx = api.tx.otcOrder.openOrderWithProtection(
  1,                  // listing_id
  qty,
  paymentCommit,
  contactCommit,
  null,               // min_accept_price: 不设置
  null                // max_accept_price: 不设置
);

await tx.signAndSend(buyerKey);
```

### 2. 买家线下支付并标记

```javascript
// 买家转账后标记已支付
await api.tx.otcOrder.markPaid(orderId).signAndSend(buyerKey);
```

### 3. 卖家确认并放行 ✨

```javascript
// 卖家确认收款，放行MEMO（同时触发价格上报）
await api.tx.otcOrder.release(orderId).signAndSend(makerKey);

// 监听事件
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (event.section === 'otcOrder' && event.method === 'OrderReleased') {
      console.log(`✅ 订单 ${event.data.id} 已完成`);
      // 此时 pallet-pricing 已收到成交数据并更新市场均价
    }
  });
});
```

### 4. 监听市场价格变化

```javascript
// 订单放行后，市场均价会更新
const oldPrice = await api.query.pricing.getMemoMarketPriceWeighted();
console.log(`放行前市场均价: ${oldPrice.toNumber() / 1_000_000} USDT`);

// 等待订单放行...

const newPrice = await api.query.pricing.getMemoMarketPriceWeighted();
console.log(`放行后市场均价: ${newPrice.toNumber() / 1_000_000} USDT`);

const change = ((newPrice - oldPrice) / oldPrice * 100).toFixed(4);
console.log(`市场均价变化: ${change}%`);
```

## 升级路径

### v2.0.0 (2025-10-19) - 动态定价升级 ✅

#### 核心改进
1. ✅ 订单放行时自动上报成交数据到 `pallet-pricing`
2. ✅ 仲裁放行时同样上报成交数据
3. ✅ 形成完整的价格反馈闭环

#### 价格反馈机制
```
市场成交 → pallet-pricing (滑动窗口统计) → 市场均价 
    ↑                                           ↓
    └─────────── pallet-otc-listing (±20% 检查) ←┘
```

#### 向后兼容
- ✅ 存储结构保持不变
- ✅ 订单 ID 编号延续
- ✅ 事件结构保持不变
- ✅ 价格上报为非关键路径（失败不影响订单放行）

## 安全考虑

### 资金安全
- ✅ **库存托管**：挂单创建时锁定，防止超卖
- ✅ **原子操作**：状态变更和资金划转在同一事务中完成
- ✅ **超时保护**：自动恢复库存

### 承诺-揭示机制
- ✅ **隐私保护**：支付凭证和联系方式链上仅存储哈希
- ✅ **按需揭示**：争议时才需要揭示原文
- ✅ **哈希校验**：防止篡改

### 争议处理
- ✅ **双向发起**：买家和卖家都可发起争议
- ✅ **时间窗口**：证据追加期内可发起
- ✅ **仲裁介入**：支持部分放行，灵活处理争议

### 价格安全（v2.0.0）
- ✅ **价格锁定**：订单创建时锁定价格，避免成交时价格变化
- ✅ **追溯透明**：完整记录价格形成过程
- ✅ **闭环反馈**：真实成交推动市场均价，防止价格操纵

## 相关文档

- [pallet-otc-listing README](/home/xiaodong/文档/memopark/pallets/otc-listing/README.md)
- [pallet-pricing README](/home/xiaodong/文档/memopark/pallets/pricing/README.md)
- [定价基准价格±20%方案分析](/home/xiaodong/文档/memopark/docs/定价基准价格±20%方案分析.md)

## 版本变更

### v2.0.0 (2025-10-19) - 动态定价升级

**核心改进**
- ✅ 订单放行时自动上报成交数据到 `pallet-pricing`
- ✅ 仲裁放行时同样上报成交数据
- ✅ 完整的价格反馈闭环（成交 → 统计 → 均价 → 检查 → 成交）

**优化**
- ♻️ 重构注释，提升代码可读性
- 📝 更新 README.md，补充价格上报机制说明

**向后兼容**
- ✅ 无破坏性变更
- ✅ 价格上报为非关键路径（失败不影响订单放行）

---

**✅ pallet-otc-order v2.0.0 - 已完成动态定价升级**
