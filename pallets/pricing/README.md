# pallet-pricing（MEMO 市场价格聚合）

## 概述

`pallet-pricing` 是 MEMO 区块链的**链上价格聚合模块**，基于真实成交数据统计市场价格，为其他模块提供可靠的价格参考。

**版本**：v3.0.0 (2025-10-19)  
**状态**：✅ 生产就绪

### 核心功能

1. **价格聚合**：统计 OTC 和 Simple Bridge 的真实成交数据
2. **滑动窗口**：维护最近 1,000,000 MEMO 的交易记录
3. **加权平均**：根据交易量计算市场加权均价
4. **冷启动保护**：市场初期使用默认价格，达到阈值后切换到市场价格

### 设计原则

- ✅ **去中心化**：无需外部喂价，基于链上真实成交
- ✅ **自适应**：价格随市场供需动态调整
- ✅ **可靠性**：滑动窗口机制防止单笔交易影响过大
- ✅ **简单性**：纯数学计算，无复杂逻辑

---

## 存储项

### 价格聚合数据

#### OtcPriceAggregate
- **类型**：`StorageValue<PriceAggregateData>`
- **说明**：OTC 市场的价格聚合统计
- **字段**：
  - `total_memo`：累计 MEMO 数量（精度 10^12）
  - `total_usdt`：累计 USDT 金额（精度 10^6）
  - `order_count`：订单数量
  - `oldest_index`：最旧订单索引（0-9999）
  - `newest_index`：最新订单索引（0-9999）

#### BridgePriceAggregate
- **类型**：`StorageValue<PriceAggregateData>`
- **说明**：Simple Bridge 的价格聚合统计
- **字段**：同 OtcPriceAggregate

### 循环缓冲区

#### OtcOrderRingBuffer
- **类型**：`StorageMap<u32, OrderSnapshot>`
- **说明**：存储最多 10,000 笔 OTC 订单快照
- **索引范围**：0-9999
- **OrderSnapshot 字段**：
  - `timestamp`：订单时间戳（Unix 毫秒）
  - `price_usdt`：USDT 单价（精度 10^6）
  - `memo_qty`：MEMO 数量（精度 10^12）

#### BridgeOrderRingBuffer
- **类型**：`StorageMap<u32, OrderSnapshot>`
- **说明**：存储最多 10,000 笔 Bridge 兑换快照
- **索引范围**：0-9999

### 冷启动参数

#### ColdStartThreshold
- **类型**：`StorageValue<u128>`
- **默认值**：100,000,000 MEMO（1亿，精度 10^12）
- **说明**：冷启动阈值，当 OTC 和 Bridge 的交易量都低于此值时使用默认价格

#### DefaultPrice
- **类型**：`StorageValue<u64>`
- **默认值**：1（0.000001 USDT/MEMO，精度 10^6）
- **说明**：冷启动期间的默认价格

#### ColdStartExited
- **类型**：`StorageValue<bool>`
- **默认值**：false
- **说明**：冷启动退出标记（单向锁定，一旦退出不再回退）

---

## 可调用接口

### set_cold_start_params（治理调整冷启动参数）

```rust
pub fn set_cold_start_params(
    origin: OriginFor<T>,
    threshold: Option<u128>,
    default_price: Option<u64>,
) -> DispatchResult
```

#### 功能说明
- 治理调整冷启动阈值和默认价格
- 只能在冷启动期间调整（`ColdStartExited` = false）
- 一旦退出冷启动，无法再调整

#### 参数
- `origin`：必须是 Root 权限
- `threshold`：可选，新的冷启动阈值（MEMO 数量，精度 10^12）
- `default_price`：可选，新的默认价格（USDT/MEMO，精度 10^6）

#### 错误
- `ColdStartAlreadyExited`：已退出冷启动，无法调整参数

#### JavaScript 示例

```javascript
// 设置冷启动阈值为 5000 万 MEMO
await api.tx.sudo.sudo(
  api.tx.pricing.setColdStartParams(
    50_000_000n * 1_000_000_000_000n,  // 5000万 MEMO
    null  // 不修改默认价格
  )
).signAndSend(sudoKey);

// 设置默认价格为 0.000001 USDT
await api.tx.sudo.sudo(
  api.tx.pricing.setColdStartParams(
    null,  // 不修改阈值
    1      // 0.000001 USDT/MEMO
  )
).signAndSend(sudoKey);
```

---

## 公开方法（链上调用）

### add_otc_order（添加 OTC 订单）

```rust
pub fn add_otc_order(
    timestamp: u64,
    price_usdt: u64,
    memo_qty: u128,
) -> DispatchResult
```

#### 功能说明
- 由 `pallet-otc-order` 调用，添加 OTC 订单成交数据
- 自动维护滑动窗口（累计超过 1,000,000 MEMO 时删除最旧订单）
- 更新聚合统计并发出事件

#### 参数
- `timestamp`：订单时间戳（Unix 毫秒）
- `price_usdt`：USDT 单价（精度 10^6）
- `memo_qty`：MEMO 数量（精度 10^12）

#### 调用示例

```rust
// 在 pallet-otc-order::release 中调用
let _ = pallet_pricing::Pallet::<T>::add_otc_order(
    timestamp,
    price_usdt,
    memo_qty
);
```

### add_bridge_swap（添加 Bridge 兑换）

```rust
pub fn add_bridge_swap(
    timestamp: u64,
    price_usdt: u64,
    memo_qty: u128,
) -> DispatchResult
```

#### 功能说明
- 由 `pallet-simple-bridge` 调用，添加桥接兑换数据
- 逻辑与 `add_otc_order` 相同，但操作 Bridge 相关的存储

#### 调用示例

```rust
// 在 pallet-simple-bridge::complete_swap 中调用
let _ = pallet_pricing::Pallet::<T>::add_bridge_swap(
    timestamp,
    price_usdt,
    memo_amount
);
```

### get_memo_market_price_weighted（获取市场加权均价）

```rust
pub fn get_memo_market_price_weighted() -> u64
```

#### 功能说明
- 返回 MEMO 市场加权均价（USDT/MEMO，精度 10^6）
- 计算公式：`(OTC总USDT + Bridge总USDT) / (OTC总MEMO + Bridge总MEMO)`
- 包含冷启动保护

#### 返回值
- `u64`：市场加权均价（精度 10^6），0 表示无数据

#### 用途
- **pallet-otc-listing**：创建挂单时进行 ±20% 价格偏离检查
- **pallet-simple-bridge**：兑换时计算汇率
- **前端**：显示市场价格

#### 调用示例

```rust
// 在 pallet-otc-listing::create_listing 中调用
let market_price = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
if market_price > 0 {
    // 检查 price_usdt 是否在 market_price ±20% 范围内
}
```

### get_memo_reference_price（获取市场参考价格）

```rust
pub fn get_memo_reference_price() -> u64
```

#### 功能说明
- 返回 MEMO 市场参考价格（简单平均）
- 计算公式：`(OTC均价 + Bridge均价) / 2`
- 包含冷启动保护

#### 返回值
- `u64`：市场参考价格（精度 10^6），0 表示无数据

#### 用途
- 前端显示参考价格
- 价格偏离度计算
- 简单的市场概览

### get_otc_average_price（获取 OTC 均价）

```rust
pub fn get_otc_average_price() -> u64
```

#### 返回值
- `u64`：OTC 均价（精度 10^6），0 表示无数据

### get_bridge_average_price（获取 Bridge 均价）

```rust
pub fn get_bridge_average_price() -> u64
```

#### 返回值
- `u64`：Bridge 均价（精度 10^6），0 表示无数据

### get_otc_stats（获取 OTC 统计）

```rust
pub fn get_otc_stats() -> (u128, u128, u32, u64)
```

#### 返回值
- `(累计MEMO, 累计USDT, 订单数, 均价)`

### get_bridge_stats（获取 Bridge 统计）

```rust
pub fn get_bridge_stats() -> (u128, u128, u32, u64)
```

#### 返回值
- `(累计MEMO, 累计USDT, 订单数, 均价)`

### get_market_stats（获取市场统计）

```rust
pub fn get_market_stats() -> MarketStats
```

#### 返回值
- `MarketStats` 结构，包含：
  - `otc_price`：OTC 均价
  - `bridge_price`：Bridge 均价
  - `weighted_price`：加权平均价格
  - `simple_avg_price`：简单平均价格
  - `otc_volume`：OTC 交易量
  - `bridge_volume`：Bridge 交易量
  - `total_volume`：总交易量
  - `otc_order_count`：OTC 订单数
  - `bridge_swap_count`：Bridge 兑换数

---

## 事件

### OtcOrderAdded

```rust
OtcOrderAdded {
    timestamp: u64,
    price_usdt: u64,
    memo_qty: u128,
    new_avg_price: u64,
}
```

**说明**：OTC 订单添加到价格聚合

### BridgeSwapAdded

```rust
BridgeSwapAdded {
    timestamp: u64,
    price_usdt: u64,
    memo_qty: u128,
    new_avg_price: u64,
}
```

**说明**：Bridge 兑换添加到价格聚合

### ColdStartParamsUpdated

```rust
ColdStartParamsUpdated {
    threshold: Option<u128>,
    default_price: Option<u64>,
}
```

**说明**：冷启动参数更新

### ColdStartExited

```rust
ColdStartExited {
    final_threshold: u128,
    otc_volume: u128,
    bridge_volume: u128,
    market_price: u64,
}
```

**说明**：冷启动退出（标志性事件，市场进入正常定价阶段）

---

## 价格计算逻辑

### 滑动窗口机制

#### 原理
- 维护最近累计 1,000,000 MEMO 的交易记录
- 使用循环缓冲区（Ring Buffer）存储最多 10,000 笔订单
- 新订单加入时，如果超过限制，自动删除最旧的订单

#### 优点
- **防止操纵**：单笔大额交易影响有限
- **实时性**：价格随最近交易动态调整
- **存储效率**：固定大小缓冲区，不会无限增长

#### 示例

```
滑动窗口大小：1,000,000 MEMO
当前累计：900,000 MEMO

新订单：200,000 MEMO @ 0.5 USDT
累计变为：1,100,000 MEMO（超过限制）

自动删除最旧订单：100,000 MEMO @ 0.48 USDT
最终累计：1,000,000 MEMO
```

### 加权平均算法

#### 公式

```
加权平均价格 = (OTC总USDT + Bridge总USDT) / (OTC总MEMO + Bridge总MEMO)
```

#### 示例

```
OTC：
  - 累计：500,000 MEMO
  - 累计：250,000 USDT
  - 均价：0.5 USDT/MEMO

Bridge：
  - 累计：500,000 MEMO
  - 累计：260,000 USDT
  - 均价：0.52 USDT/MEMO

加权平均 = (250,000 + 260,000) / (500,000 + 500,000)
         = 510,000 / 1,000,000
         = 0.51 USDT/MEMO
```

### 简单平均算法

#### 公式

```
简单平均价格 = (OTC均价 + Bridge均价) / 2
```

#### 示例

```
OTC 均价：0.5 USDT/MEMO
Bridge 均价：0.52 USDT/MEMO

简单平均 = (0.5 + 0.52) / 2
         = 0.51 USDT/MEMO
```

### 冷启动保护

#### 触发条件
- `ColdStartExited` = false
- OTC 交易量 < `ColdStartThreshold`
- Bridge 交易量 < `ColdStartThreshold`

#### 行为
- 返回 `DefaultPrice`（默认 0.000001 USDT/MEMO）

#### 退出条件
- OTC 交易量 ≥ `ColdStartThreshold`，或
- Bridge 交易量 ≥ `ColdStartThreshold`

#### 退出效果
- 设置 `ColdStartExited` = true（单向锁定，不可逆）
- 发出 `ColdStartExited` 事件
- 后续永久使用市场价格

---

## 使用流程

### 1. 初始化（治理）

```javascript
const api = await ApiPromise.create({ provider: wsProvider });

// 设置冷启动阈值为 1 亿 MEMO
await api.tx.sudo.sudo(
  api.tx.pricing.setColdStartParams(
    100_000_000n * 1_000_000_000_000n,  // 1亿 MEMO
    1  // 默认价格 0.000001 USDT/MEMO
  )
).signAndSend(sudoKey);
```

### 2. OTC 订单成交（自动）

```rust
// 在 pallet-otc-order::release 中
let _ = pallet_pricing::Pallet::<T>::add_otc_order(
    order.created_at.saturated_into::<u64>(),  // 时间戳
    order.price.saturated_into::<u64>(),       // 价格
    order.qty.saturated_into::<u128>()         // 数量
);
```

### 3. Bridge 兑换（自动）

```rust
// 在 pallet-simple-bridge::complete_swap 中
let _ = pallet_pricing::Pallet::<T>::add_bridge_swap(
    timestamp,
    price_usdt,
    memo_amount
);
```

### 4. 查询市场价格（前端）

```javascript
// 查询市场加权均价
const marketPrice = await api.query.pricing.getMemoMarketPriceWeighted();
console.log(`市场加权均价: ${marketPrice.toNumber() / 1_000_000} USDT/MEMO`);

// 查询 OTC 均价
const otcPrice = await api.query.pricing.otcAvgPrice();
console.log(`OTC 均价: ${otcPrice.toNumber() / 1_000_000} USDT/MEMO`);

// 查询 Bridge 均价
const bridgePrice = await api.query.pricing.bridgeAvgPrice();
console.log(`Bridge 均价: ${bridgePrice.toNumber() / 1_000_000} USDT/MEMO`);

// 查询冷启动状态
const coldStartExited = await api.query.pricing.coldStartExited();
console.log(`冷启动已退出: ${coldStartExited.toHuman()}`);
```

### 5. 查询统计信息（前端）

```javascript
// 查询 OTC 聚合数据
const otcAgg = await api.query.pricing.otcPriceAggregate();
console.log(`OTC 累计成交: ${otcAgg.total_memo / 1e18} MEMO`);
console.log(`OTC 订单数: ${otcAgg.order_count}`);

// 查询 Bridge 聚合数据
const bridgeAgg = await api.query.pricing.bridgePriceAggregate();
console.log(`Bridge 累计成交: ${bridgeAgg.total_memo / 1e18} MEMO`);
console.log(`Bridge 兑换数: ${bridgeAgg.order_count}`);
```

---

## 集成说明

### pallet-otc-listing

**依赖**：`pallet_pricing::Config`

**使用场景**：创建挂单时进行价格偏离检查

```rust
// 获取市场均价
let market_price = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();

// 检查 price_usdt 是否在 market_price ±20% 范围内
if market_price > 0 && max_deviation > 0 {
    let min_price = market_price * (10000 - max_deviation) / 10000;
    let max_price = market_price * (10000 + max_deviation) / 10000;
    ensure!(
        price_usdt >= min_price && price_usdt <= max_price,
        Error::<T>::PriceDeviationTooHigh
    );
}
```

### pallet-otc-order

**依赖**：`pallet_pricing::Config`

**使用场景**：订单完成时上报成交数据

```rust
// 在 release 方法中
let _ = pallet_pricing::Pallet::<T>::add_otc_order(
    timestamp,
    price_usdt,
    memo_qty
);
```

### pallet-simple-bridge

**依赖**：`pallet_pricing::Config`

**使用场景 1**：兑换时获取市场价格

```rust
// 获取市场均价作为兑换汇率
let market_price = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
let price_usdt = if market_price > 0 {
    market_price
} else {
    FallbackExchangeRate::<T>::get()
};
```

**使用场景 2**：兑换完成时上报数据

```rust
// 在 complete_swap 方法中
let _ = pallet_pricing::Pallet::<T>::add_bridge_swap(
    timestamp,
    price_usdt,
    memo_amount
);
```

---

## 监控建议

### 关键指标

1. **市场加权均价**：监控价格趋势
2. **OTC / Bridge 均价**：对比分析市场供需
3. **累计成交量**：监控滑动窗口填充度
4. **冷启动状态**：确认市场是否已启动

### 告警规则

- ⚠️ 市场均价 24 小时波动 > 30%
- ⚠️ OTC 和 Bridge 价格差距 > 20%
- ⚠️ 滑动窗口填充度 < 20%（市场价格可靠性低）
- ✅ 冷启动已退出

---

## 版本变更

### v3.0.0 (2025-10-19) - 删除传统价格预言机

**删除功能**
- ❌ 删除 `PriceProvider` trait
- ❌ 删除 `SpotPrice` 结构体
- ❌ 删除 `Params` 结构体
- ❌ 删除 `Price<T>` 存储项
- ❌ 删除 `PricingParams<T>` 存储项
- ❌ 删除 `Feeders<T>` 存储项
- ❌ 删除 `set_price` 方法
- ❌ 删除 `set_params` 方法
- ❌ 删除 `set_pause` 方法
- ❌ 删除 `set_feeders` 方法
- ❌ 删除相关事件（PriceUpdated, ParamsUpdated, FeedersUpdated, Paused）

**保留功能**
- ✅ 价格聚合（OTC + Bridge）
- ✅ 滑动窗口机制
- ✅ 加权平均算法
- ✅ 冷启动保护
- ✅ 所有公开方法

**影响**
- ⚠️ pallet-memo-bridge 已删除（不再依赖传统预言机）
- ✅ pallet-otc-listing、pallet-otc-order、pallet-simple-bridge 不受影响
- ✅ 代码简化约 300 行
- ✅ 运维成本降低（无需喂价服务）
- ✅ 安全风险降低（无喂价攻击面）

### v2.0.0 (2025-10-18) - 动态定价系统

**新增功能**
- ✅ 价格聚合（OTC + Bridge）
- ✅ 滑动窗口机制
- ✅ 加权平均算法
- ✅ 冷启动保护

### v1.0.0 (初始版本) - 传统价格预言机

**功能**
- 外部喂价接口
- 价格陈旧性检查
- 价格跳变限制
- 喂价白名单管理

---

## 相关文档

- [删除传统价格预言机功能分析](/home/xiaodong/文档/memopark/docs/删除传统价格预言机功能分析.md)
- [动态定价完整实施报告](/home/xiaodong/文档/memopark/docs/动态定价完整实施报告.md)
- [定价基准价格±20%方案分析](/home/xiaodong/文档/memopark/docs/定价基准价格±20%方案分析.md)
- [pallet-otc-listing README](/home/xiaodong/文档/memopark/pallets/otc-listing/README.md)
- [pallet-otc-order README](/home/xiaodong/文档/memopark/pallets/otc-order/README.md)
- [pallet-simple-bridge README](/home/xiaodong/文档/memopark/pallets/simple-bridge/README.md)

---

**✅ pallet-pricing v3.0.0 - 传统价格预言机已删除**

**核心特性**：
- 🎯 基于链上真实成交的价格聚合
- 📊 滑动窗口机制防止价格操纵
- 🛡️ 冷启动保护确保初期稳定
- 🔄 自适应定价随市场动态调整
