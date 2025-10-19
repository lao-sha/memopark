# pallet-otc-listing（OTC 挂单管理）

## 概述

`pallet-otc-listing` 负责 OTC 做市商挂单的创建、取消、到期管理等功能。

**版本 v2.0.0 (2025-10-19) - 动态定价升级**

### 核心功能

1. **挂单管理**：做市商发布买/卖挂单，指定数量区间、有效期、是否允许部分成交、条款承诺
2. **价格机制**：做市商直接指定 USDT 单价，系统自动与市场均价进行 ±20% 偏离检查
3. **托管模式**：挂单创建时将库存锁入 `pallet-escrow`，防止超卖
4. **到期管理**：通过 `on_initialize` 自动处理到期挂单，退还剩余库存和保证金

### 定价机制（v2.0.0 新增）

#### 价格来源
1. **市场均价**：从 `pallet-pricing::get_memo_market_price_weighted()` 获取 OTC + Bridge 加权平均价
2. **价格校验**：做市商提交的 `price_usdt` 必须在市场均价 ±20% 范围内（治理可调）
3. **冷启动保护**：市场价格为 0 时（冷启动期），暂不进行价格偏离检查，允许做市商自由定价

#### 优势
- ✅ **防止极端价格**：避免做市商恶意定价或误操作
- ✅ **保护交易双方**：确保价格在合理范围内波动
- ✅ **追溯透明**：事件中同时记录 `price_usdt` 和 `base_price_usdt`（市场均价），便于审计
- ✅ **治理灵活**：通过 `set_max_price_deviation` 可动态调整允许偏离范围

## 存储项

### 挂单数据
- `Listings: u64 -> Listing`：挂单详情
  - `maker`：创建者账户
  - `side`：0=买单, 1=卖单
  - `base`, `quote`：交易对（保留用于未来多交易对扩展）
  - `price_usdt`：挂单执行价格（USDT 单价，精度 10^6）
  - `pricing_spread_bps`：保留字段，未来可用于基于均价的自动定价
  - `price_min`, `price_max`：可选的价带限制
  - `min_qty`, `max_qty`, `total`, `remaining`：数量范围
  - `partial`：是否允许部分成交
  - `expire_at`：过期区块高度
  - `terms_commit`：条款承诺 CID（可选）
  - `active`：是否激活
- `NextListingId: u64`：下一个挂单 ID
- `ExpiringAt: BlockNumber -> Vec<u64>`：到期索引（按区块高度）

### 风控参数（可治理）
- `CreateWindowParam`：创建限频窗口大小（块）
- `CreateMaxInWindowParam`：窗口内最多创建数
- `ListingFeeParam`：上架费（默认 0）
- `ListingBondParam`：上架保证金（默认 0）
- `MinListingTotal`：最小挂单总量
- `MinListingTtl`：最小挂单有效期
- `AllowBuyListings`：是否允许买单（默认 false，仅允许卖单）
- **`MaxPriceDeviation`**：✨ 最大价格偏离（万分比，默认 2000 = 20%）

### 限频追踪
- `CreateRate: AccountId -> (BlockNumber, u32)`：滑动窗口限频记录

## 可调用接口

### 1. create_listing（创建挂单）

```rust
pub fn create_listing(
    origin: OriginFor<T>,
    side: u8,                                    // 0=买单, 1=卖单
    base: u32,                                   // 基础币种（保留）
    quote: u32,                                  // 计价币种（保留）
    price_usdt: u64,                             // USDT 单价（精度 10^6）
    pricing_spread_bps: u16,                     // 保留字段
    min_qty: BalanceOf<T>,                       // 最小成交量
    max_qty: BalanceOf<T>,                       // 最大成交量
    total: BalanceOf<T>,                         // 挂单总量
    partial: bool,                               // 是否允许部分成交
    expire_at: BlockNumberFor<T>,                // 过期区块高度
    price_min: Option<BalanceOf<T>>,             // 可选：价带下限
    price_max: Option<BalanceOf<T>>,             // 可选：价带上限
    terms_commit: Option<BoundedVec<u8, T::MaxCidLen>>, // 可选：条款承诺 CID
) -> DispatchResult
```

#### 功能说明
- 创建 OTC 挂单，将 `total` 数量的 MEMO 锁入 `pallet-escrow`
- **价格校验逻辑（v2.0.0 新增）**：
  1. 基础范围检查：`price_usdt` ∈ [10_000, 100_000_000]（0.01 - 100 USDT）
  2. 获取市场均价：`market_price = pallet_pricing::get_memo_market_price_weighted()`
  3. 如果 `market_price > 0` 且 `MaxPriceDeviation > 0`，检查价格偏离：
     - `min_allowed = market_price × (1 - MaxPriceDeviation / 10000)`
     - `max_allowed = market_price × (1 + MaxPriceDeviation / 10000)`
     - 确保 `price_usdt ∈ [min_allowed, max_allowed]`
  4. 如果 `market_price == 0`（冷启动），跳过偏离检查

#### 风控机制
- ✅ 创建限频：滑动窗口检查（`CreateWindow` 内最多 `CreateMaxInWindow` 个）
- ✅ 最小总量检查：`total >= MinListingTotal`
- ✅ 最小有效期检查：`expire_at >= now + MinListingTtl`
- ✅ Spread 上限检查：`pricing_spread_bps <= MaxSpreadBps`
- ✅ 价格偏离检查：`price_usdt` 在市场均价 ±MaxPriceDeviation 范围内
- ✅ 上架费扣除：如 `ListingFee > 0`，从 maker 转账至 `FeeReceiver`
- ✅ 保证金锁定：如 `ListingBond > 0`，锁入托管（bond_id = id | (1<<63)）
- ✅ 库存锁定：将 `total` 锁入托管（避免超卖）

#### 错误类型
- `BadState`：参数不合法（价格超出范围、数量不足、限频超限等）
- `MarketPriceNotAvailable`：（预留，当前冷启动时不报错）
- `PriceDeviationTooHigh`：价格偏离超出允许范围

#### 事件
```rust
ListingCreated {
    id: u64,
    maker: T::AccountId,
    side: u8,
    base: u32,
    quote: u32,
    price_usdt: u64,              // 挂单执行价格
    base_price_usdt: u64,         // ✨ 创建时的市场均价（便于追溯）
    pricing_spread_bps: u16,
    price_min: Option<BalanceOf<T>>,
    price_max: Option<BalanceOf<T>>,
    min_qty: BalanceOf<T>,
    max_qty: BalanceOf<T>,
    total: BalanceOf<T>,
    remaining: BalanceOf<T>,
    partial: bool,
    expire_at: BlockNumberFor<T>,
}
```

#### JavaScript 示例

```javascript
const api = await ApiPromise.create({ provider: wsProvider });

// 1. 查询市场均价和允许偏离范围
const marketPrice = await api.query.pricing.getMemoMarketPriceWeighted();
const maxDeviation = await api.query.otcListing.maxPriceDeviation();

console.log(`市场均价: ${marketPrice.toNumber() / 1_000_000} USDT`);
console.log(`允许偏离: ±${maxDeviation.toNumber() / 100}%`);

// 2. 计算允许的价格范围
const minPrice = marketPrice.toNumber() * (10000 - maxDeviation.toNumber()) / 10000;
const maxPrice = marketPrice.toNumber() * (10000 + maxDeviation.toNumber()) / 10000;

console.log(`允许范围: ${minPrice / 1_000_000} - ${maxPrice / 1_000_000} USDT`);

// 3. 创建挂单（例如：以市场价 +5% 出售 10,000 MEMO）
const myPrice = Math.floor(marketPrice.toNumber() * 1.05);

const tx = api.tx.otcListing.createListing(
  1,                              // side: 1=卖单
  0,                              // base: 0（保留）
  0,                              // quote: 0（保留）
  myPrice,                        // price_usdt: 市场价 +5%
  0,                              // pricing_spread_bps: 0（保留）
  1000 * 1e12,                    // min_qty: 1,000 MEMO
  5000 * 1e12,                    // max_qty: 5,000 MEMO
  10000 * 1e12,                   // total: 10,000 MEMO
  true,                           // partial: 允许部分成交
  currentBlock + 14400,           // expire_at: 24小时后（假设 6s/块）
  null,                           // price_min: 无
  null,                           // price_max: 无
  null                            // terms_commit: 无
);

const hash = await tx.signAndSend(keyring.getPair('//Alice'));
```

### 2. cancel_listing（取消挂单）

```rust
pub fn cancel_listing(origin: OriginFor<T>, id: u64) -> DispatchResult
```

#### 功能说明
- 只有挂单创建者可以取消
- 将挂单状态置为 `active = false`
- 退还剩余库存（`escrow.refund_all(id, maker)`）
- 退还保证金（如启用）

#### 事件
```rust
ListingCanceled {
    id: u64,
    escrow_amount: BalanceOf<T>,    // 取消时的库存托管余额快照
    bond_amount: BalanceOf<T>,      // 取消时的保证金托管余额快照
}
```

### 3. set_listing_params（治理更新风控参数）

```rust
pub fn set_listing_params(
    origin: OriginFor<T>,
    create_window: Option<BlockNumberFor<T>>,
    create_max_in_window: Option<u32>,
    listing_fee: Option<BalanceOf<T>>,
    listing_bond: Option<BalanceOf<T>>,
    min_listing_total: Option<BalanceOf<T>>,
    min_listing_ttl: Option<BlockNumberFor<T>>,
    allow_buy_listings: Option<bool>,
) -> DispatchResult
```

#### 功能说明
- 仅允许 Root 调用
- 未提供的参数保持不变

### 4. set_max_price_deviation（设置最大价格偏离）✨ v2.0.0 新增

```rust
pub fn set_max_price_deviation(
    origin: OriginFor<T>,
    deviation_bps: u32,  // 万分比，建议 500-5000 (5%-50%)
) -> DispatchResult
```

#### 功能说明
- 仅允许 Root 调用
- 设置挂单价格相对市场均价的最大偏离范围
- 建议范围：500-5000 (5%-50%)，默认 2000 (20%)
- 设置为 0 表示关闭价格偏离检查（冷启动期可用）

#### JavaScript 示例

```javascript
// 设置允许偏离为 ±15%
const tx = api.tx.sudo.sudo(
  api.tx.otcListing.setMaxPriceDeviation(1500)
);
await tx.signAndSend(sudoKey);

// 冷启动期关闭检查（设置为 0）
const tx2 = api.tx.sudo.sudo(
  api.tx.otcListing.setMaxPriceDeviation(0)
);
await tx2.signAndSend(sudoKey);
```

## 事件

### ListingCreated
挂单创建成功，包含完整快照信息（便于 Subsquid 索引）。

### ListingCanceled
挂单取消，附带托管余额快照（便于审计）。

### ListingExpired
挂单到期，附带托管余额快照。

### ListingParamsUpdated
风控参数已更新（治理）。

## 错误码

- `NotFound`：挂单不存在
- `BadState`：状态错误、参数不合法、权限不足等
- `MarketPriceNotAvailable`：市场价格不可用（预留）
- `PriceDeviationTooHigh`：价格偏离超出允许范围

## 安全考虑

### 已移除
- ❌ **KYC 检查**：做市商已通过审批流程，无需额外 identity 验证

### 风控机制
- ✅ **创建限频**：滑动窗口防刷单
- ✅ **上架费**：可配置的垃圾挂单成本
- ✅ **保证金**：可配置的做市商承诺机制
- ✅ **库存托管**：挂单创建即锁定，防止超卖
- ✅ **价格偏离检查（v2.0.0 新增）**：防止极端价格
- ✅ **价格范围限制**：0.01 - 100 USDT

### 价格安全（v2.0.0 新增）
- ✅ **动态基准**：锚定 `pallet-pricing` 市场均价
- ✅ **偏离限制**：默认 ±20%，治理可调
- ✅ **冷启动保护**：市场价格为 0 时不检查
- ✅ **透明追溯**：事件中记录市场均价和执行价格

## 监控建议

### 关键指标
- 挂单创建频率（每小时/每日）
- 挂单取消率
- 挂单过期率
- 平均挂单有效期

### 价格监控（v2.0.0 新增）
- 挂单价格与市场均价的平均偏离度
- 触发 `PriceDeviationTooHigh` 错误的频率（反映做市商定价行为）
- `base_price_usdt` 与 `price_usdt` 的分布（可视化价差）

## 使用流程

### 1. 初始化（治理）

```javascript
// 设置基础风控参数
await api.tx.sudo.sudo(
  api.tx.otcListing.setListingParams(
    14400,        // create_window: 1天（假设 6s/块）
    10,           // create_max_in_window: 每天最多 10 个
    0,            // listing_fee: 0 MEMO（关闭）
    0,            // listing_bond: 0 MEMO（关闭）
    1000 * 1e12,  // min_listing_total: 1,000 MEMO
    1200,         // min_listing_ttl: 至少 2 小时
    false         // allow_buy_listings: 仅允许卖单
  )
).signAndSend(sudoKey);

// 设置价格偏离检查（v2.0.0）
await api.tx.sudo.sudo(
  api.tx.otcListing.setMaxPriceDeviation(2000)  // ±20%
).signAndSend(sudoKey);
```

### 2. 做市商创建挂单

```javascript
// 查询市场价格
const marketPrice = await api.query.pricing.getMemoMarketPriceWeighted();

// 以市场价 +8% 创建卖单
const myPrice = Math.floor(marketPrice.toNumber() * 1.08);

await api.tx.otcListing.createListing(
  1, 0, 0, myPrice, 0,
  1000 * 1e12, 5000 * 1e12, 10000 * 1e12,
  true, currentBlock + 14400,
  null, null, null
).signAndSend(makerKey);
```

### 3. 监听事件

```javascript
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (event.section === 'otcListing' && event.method === 'ListingCreated') {
      const { 
        id, maker, price_usdt, base_price_usdt, 
        total, remaining, expire_at 
      } = event.data;
      
      const deviation = ((price_usdt - base_price_usdt) / base_price_usdt * 100).toFixed(2);
      
      console.log(`✅ 挂单创建成功`);
      console.log(`  ID: ${id}`);
      console.log(`  做市商: ${maker.toHuman()}`);
      console.log(`  执行价格: ${price_usdt / 1_000_000} USDT`);
      console.log(`  市场均价: ${base_price_usdt / 1_000_000} USDT`);
      console.log(`  偏离度: ${deviation}%`);
      console.log(`  总量: ${total / 1e12} MEMO`);
    }
  });
});
```

## 升级路径

### v2.0.0 (2025-10-19) - 动态定价升级 ✅

#### 新增功能
1. ✅ 添加 `pallet_pricing::Config` 依赖
2. ✅ 新增存储项 `MaxPriceDeviation`
3. ✅ `create_listing` 中添加价格偏离检查逻辑
4. ✅ 事件 `ListingCreated` 新增 `base_price_usdt` 字段
5. ✅ 新增治理接口 `set_max_price_deviation`
6. ✅ 新增错误类型 `MarketPriceNotAvailable`、`PriceDeviationTooHigh`

#### 破坏性变更
- ⚠️ `ListingCreated` 事件结构变更（新增 `base_price_usdt` 字段）
- ⚠️ Subsquid 索引器需要更新以处理新事件字段

#### 向后兼容
- ✅ 存储结构 `Listing` 保持不变
- ✅ 挂单 ID 编号延续
- ✅ 托管余额无需迁移
- ✅ 冷启动期（市场价格=0）自动跳过价格检查，不影响早期运营

## 相关文档

- [定价基准价格±20%方案分析](/home/xiaodong/文档/memopark/docs/定价基准价格±20%方案分析.md)
- [OTC动态定价改造方案](/home/xiaodong/文档/memopark/docs/OTC动态定价改造方案.md)
- [pallet-pricing README](/home/xiaodong/文档/memopark/pallets/pricing/README.md)

## 版本变更

### v2.0.0 (2025-10-19) - 动态定价升级

**新增功能**
- ✅ 基于 `pallet-pricing` 市场均价的价格偏离检查（±20% 可治理调整）
- ✅ 冷启动保护（市场价格为 0 时允许自由定价）
- ✅ 事件追溯透明（同时记录执行价格和市场均价）
- ✅ 治理接口 `set_max_price_deviation`

**破坏性变更**
- ⚠️ `ListingCreated` 事件新增 `base_price_usdt` 字段

**优化**
- ♻️ 重构注释，提升代码可读性
- 📝 更新 README.md，补充完整使用指南

**安全**
- 🛡️ 防止做市商恶意定价或误操作
- 🛡️ 保护交易双方利益

**迁移指南**
1. Runtime 升级后，通过 `set_max_price_deviation(2000)` 启用 ±20% 检查
2. 冷启动期可设置为 0 以允许自由定价
3. Subsquid 索引器需要处理 `ListingCreated` 新字段
4. 前端 UI 建议显示市场均价和允许范围，提升用户体验

---

**✅ pallet-otc-listing v2.0.0 - 已完成动态定价升级**
