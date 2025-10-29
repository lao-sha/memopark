# Pallet Pricing - MEMO价格管理系统

## 📋 模块概述

`pallet-pricing` 是Stardust生态的**价格发现与聚合模块**，基于OTC和Bridge两个市场的真实交易数据，计算MEMO的市场加权均价。采用循环缓冲区+滑动窗口算法，维护最近100万MEMO的价格统计，为OTC订单和桥接兑换提供可靠的价格基准。

### 设计理念

- **真实数据驱动**：基于实际成交价格，非预言机喂价
- **双市场聚合**：OTC+Bridge价格加权平均
- **滑动窗口**：最近100万MEMO交易，动态更新
- **冷启动保护**：初期交易量不足时使用默认价格
- **循环缓冲区**：最多存储1万笔订单，内存高效

## 🏗️ 架构设计

```text
┌─────────────────────────────────────┐
│     OTC订单完成                      │
│  - 价格: 0.0102 USDT/MEMO           │
│  - 数量: 100 MEMO                   │
└──────────────┬──────────────────────┘
               ↓ 添加到聚合
┌─────────────────────────────────────┐
│     OTC价格聚合                      │
│  - 累计MEMO: 850,000                │
│  - 累计USDT: 8,670                  │
│  - 均价: 0.0102 USDT/MEMO           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│     Bridge兑换完成                   │
│  - 价格: 0.0098 USDT/MEMO           │
│  - 数量: 200 MEMO                   │
└──────────────┬──────────────────────┘
               ↓ 添加到聚合
┌─────────────────────────────────────┐
│     Bridge价格聚合                   │
│  - 累计MEMO: 780,000                │
│  - 累计USDT: 7,644                  │
│  - 均价: 0.0098 USDT/MEMO           │
└──────────────┬──────────────────────┘
               ↓ 加权平均
┌─────────────────────────────────────┐
│     市场加权均价                     │
│  weighted_price = (OTC_price × OTC_volume + Bridge_price × Bridge_volume) / (OTC_volume + Bridge_volume)
│  = (0.0102 × 850,000 + 0.0098 × 780,000) / (850,000 + 780,000)
│  = 0.0100 USDT/MEMO
└─────────────────────────────────────┘
```

## 🔑 核心功能

### 1. 价格聚合算法

#### 循环缓冲区
```rust
// 存储最多10,000笔订单快照
pub type OtcOrderRingBuffer<T> = StorageMap<
    _,
    Blake2_128Concat,
    u32,  // 索引 0-9999
    OrderSnapshot,
>;

pub struct OrderSnapshot {
    pub timestamp: u64,         // 时间戳
    pub price_usdt: u64,        // USDT单价（精度10^6）
    pub memo_qty: u128,         // MEMO数量（精度10^12）
}
```

#### 滑动窗口聚合
```rust
pub struct PriceAggregateData {
    pub total_memo: u128,       // 累计MEMO数量
    pub total_usdt: u128,       // 累计USDT金额
    pub order_count: u32,       // 订单数量
    pub oldest_index: u32,      // 最旧订单索引
    pub newest_index: u32,      // 最新订单索引
}
```

#### add_otc_order - 添加OTC订单
```rust
pub fn add_otc_order(
    origin: OriginFor<T>,
    price_usdt: u64,
    memo_qty: u128,
    timestamp: u64,
) -> DispatchResult
```

**算法**：
1. 添加新订单到缓冲区
2. 累计total_memo和total_usdt
3. 如果total_memo超过100万MEMO，从oldest_index开始删除旧订单
4. 更新聚合数据和均价

### 2. 市场价格计算

#### get_market_price - 获取市场价格
```rust
impl<T: Config> PricingProvider for Pallet<T> {
    fn get_market_price() -> u64 {
        // 1. 检查冷启动状态
        if !Self::cold_start_exited() {
            let otc_volume = Self::otc_aggregate().total_memo;
            let bridge_volume = Self::bridge_aggregate().total_memo;
            let threshold = Self::cold_start_threshold();
            
            if otc_volume + bridge_volume < threshold {
                // 返回默认价格（0.000001 USDT/MEMO）
                return Self::default_price();
            } else {
                // 达到阈值，退出冷启动
                ColdStartExited::<T>::put(true);
            }
        }
        
        // 2. 计算加权平均价
        let otc_agg = Self::otc_aggregate();
        let bridge_agg = Self::bridge_aggregate();
        
        let otc_price = if otc_agg.total_memo > 0 {
            (otc_agg.total_usdt / otc_agg.total_memo) as u64
        } else {
            0
        };
        
        let bridge_price = if bridge_agg.total_memo > 0 {
            (bridge_agg.total_usdt / bridge_agg.total_memo) as u64
        } else {
            0
        };
        
        let total_volume = otc_agg.total_memo + bridge_agg.total_memo;
        if total_volume == 0 {
            return Self::default_price();
        }
        
        // 加权平均
        let weighted_price = (
            (otc_price as u128 * otc_agg.total_memo) +
            (bridge_price as u128 * bridge_agg.total_memo)
        ) / total_volume;
        
        weighted_price as u64
    }
}
```

### 3. 冷启动机制

#### 冷启动阈值
```rust
pub type ColdStartThreshold<T> = StorageValue<_, u128, ValueQuery>;

// 默认值：100,000,000 MEMO（1亿）
fn DefaultColdStartThreshold() -> u128 {
    100_000_000u128 * 1_000_000_000_000u128
}
```

#### 默认价格
```rust
pub type DefaultPrice<T> = StorageValue<_, u64, ValueQuery>;

// 默认值：1（0.000001 USDT/MEMO，精度10^6）
fn DefaultPriceValue() -> u64 {
    1u64
}
```

#### 单向锁定退出
```rust
pub type ColdStartExited<T> = StorageValue<_, bool, ValueQuery>;
```

**说明**：一旦达到阈值并退出冷启动，此标记永久为true，不再回退到默认价格。避免在阈值附近价格剧烈波动。

### 4. 市场统计

#### get_market_stats - 获取市场统计
```rust
pub fn get_market_stats() -> MarketStats {
    MarketStats {
        otc_price,          // OTC均价
        bridge_price,       // Bridge均价
        weighted_price,     // 加权平均价
        simple_avg_price,   // 简单平均价
        otc_volume,         // OTC交易量
        bridge_volume,      // Bridge交易量
        total_volume,       // 总交易量
        otc_order_count,    // OTC订单数
        bridge_swap_count,  // Bridge兑换数
    }
}
```

## 📦 存储结构

### OTC价格聚合
```rust
pub type OtcPriceAggregate<T> = StorageValue<_, PriceAggregateData, ValueQuery>;
pub type OtcOrderRingBuffer<T> = StorageMap<_, Blake2_128Concat, u32, OrderSnapshot>;
```

### Bridge价格聚合
```rust
pub type BridgePriceAggregate<T> = StorageValue<_, PriceAggregateData, ValueQuery>;
pub type BridgeOrderRingBuffer<T> = StorageMap<_, Blake2_128Concat, u32, OrderSnapshot>;
```

### 冷启动配置
```rust
pub type ColdStartThreshold<T> = StorageValue<_, u128, ValueQuery>;
pub type DefaultPrice<T> = StorageValue<_, u64, ValueQuery>;
pub type ColdStartExited<T> = StorageValue<_, bool, ValueQuery>;
```

## 🔧 配置参数

```rust
pub trait Config: frame_system::Config {
    /// 事件类型
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 最大价格偏离（基点，默认2000 = 20%）
    type MaxPriceDeviation: Get<u16>;
}
```

## 📡 可调用接口

### 数据提交接口

#### 1. add_otc_order - 添加OTC订单
```rust
#[pallet::call_index(0)]
pub fn add_otc_order(
    origin: OriginFor<T>,
    price_usdt: u64,
    memo_qty: u128,
    timestamp: u64,
) -> DispatchResult
```

#### 2. add_bridge_swap - 添加Bridge兑换
```rust
#[pallet::call_index(1)]
pub fn add_bridge_swap(
    origin: OriginFor<T>,
    price_usdt: u64,
    memo_qty: u128,
    timestamp: u64,
) -> DispatchResult
```

### 治理接口

#### 3. set_cold_start_threshold - 设置冷启动阈值
```rust
#[pallet::call_index(2)]
pub fn set_cold_start_threshold(
    origin: OriginFor<T>,
    threshold: u128,
) -> DispatchResult
```

#### 4. set_default_price - 设置默认价格
```rust
#[pallet::call_index(3)]
pub fn set_default_price(
    origin: OriginFor<T>,
    price: u64,
) -> DispatchResult
```

## 🎉 事件

### OtcOrderAdded - OTC订单添加事件
```rust
OtcOrderAdded {
    price_usdt: u64,
    memo_qty: u128,
    new_avg_price: u64,
}
```

### BridgeSwapAdded - Bridge兑换添加事件
```rust
BridgeSwapAdded {
    price_usdt: u64,
    memo_qty: u128,
    new_avg_price: u64,
}
```

### ColdStartExited - 冷启动退出事件
```rust
ColdStartExited {
    final_volume: u128,
}
```

## 🔌 使用示例

### 场景1：OTC订单完成后提交价格

```rust
// pallet-otc-order调用
pallet_pricing::Pallet::<T>::add_otc_order(
    system_origin,
    10_200u64,  // 0.0102 USDT/MEMO（精度10^6）
    100_000_000_000_000u128,  // 100 MEMO
    current_timestamp,
)?;

// 查询最新市场价格
let market_price = <pallet_pricing::Pallet<T> as PricingProvider>::get_market_price();
// market_price = 10_000 (0.01 USDT/MEMO)
```

### 场景2：创建OTC订单时使用市场价格

```rust
// 1. 获取市场价格
let base_price = <T::PricingProvider as PricingProvider>::get_market_price();
// base_price = 10_000 (0.01 USDT/MEMO)

// 2. 应用做市商溢价
let maker_premium_bps = 200; // +2%
let final_price = base_price * (10000 + maker_premium_bps) / 10000;
// final_price = 10_200 (0.0102 USDT/MEMO)

// 3. 计算订单金额
let usdt_amount = (qty * final_price) / 1_000_000_000_000;
```

## 🛡️ 安全机制

### 1. 滑动窗口

- 最近100万MEMO交易
- 防止历史价格影响
- 动态反映市场变化

### 2. 冷启动保护

- 初期交易量不足时使用默认价格
- 避免极端价格
- 单向锁定退出

### 3. 循环缓冲区

- 最多存储1万笔订单
- 内存高效
- 自动清理旧数据

### 4. 双市场聚合

- OTC+Bridge价格加权
- 全面反映市场
- 防止单一市场操纵

## 📝 最佳实践

### 1. 价格使用

- 总是使用`get_market_price()`获取最新价格
- 应用做市商溢价前先获取基准价
- 检查冷启动状态

### 2. 数据提交

- OTC订单释放后立即提交
- Bridge兑换完成后立即提交
- 提交准确的价格和数量

### 3. 监控指标

- 冷启动状态
- OTC/Bridge交易量
- 价格偏离程度
- 缓冲区使用率

## 🔗 相关模块

- **pallet-otc-order**: OTC订单（使用市场价格）
- **pallet-simple-bridge**: 桥接兑换（使用市场价格）
- **pallet-market-maker**: 做市商管理（应用溢价）

## 📚 参考资源

- [价格聚合算法](../../docs/pricing-aggregation-algorithm.md)
- [滑动窗口设计](../../docs/sliding-window-design.md)
- [冷启动策略](../../docs/cold-start-strategy.md)

---

**版本**: 1.0.0  
**最后更新**: 2025-10-27  
**维护者**: Stardust 开发团队
