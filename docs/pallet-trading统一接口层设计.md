# pallet-trading 统一接口层设计

**日期**: 2025-11-03  
**阶段**: Phase 5 - 创建统一接口层  
**目标**: 将拆分的子模块聚合为统一的对外接口

---

## 📋 设计目标

### 1. 主要目标
- ✅ 重新导出所有子模块类型（Maker, OTC, Bridge）
- ✅ 提供统一的查询接口
- ✅ 简化 Runtime 集成
- ✅ 保持向后兼容性（可选）

### 2. 非目标
- ❌ 不重新实现业务逻辑（子模块已有）
- ❌ 不改变现有API（保持兼容）
- ❌ 不增加额外的存储

---

## 🏗️ 架构设计

### 方案选择

#### 方案A：重新导出层（推荐）✅
```rust
// pallets/trading/src/lib.rs
pub use pallet_maker;
pub use pallet_otc_order;
pub use pallet_bridge;
pub use pallet_trading_common;

// 聚合查询接口
impl<T: Config> Pallet<T> {
    pub fn get_maker_info(maker_id: u64) -> Option<MakerInfo> {
        pallet_maker::Pallet::<T>::get_maker_info(maker_id)
    }
    
    pub fn get_order_info(order_id: u64) -> Option<OrderInfo> {
        pallet_otc_order::Pallet::<T>::get_order_info(order_id)
    }
}
```

**优点**：
- 简单直接
- 保持子模块独立性
- Runtime 集成灵活

#### 方案B：完全聚合层
```rust
// 在 pallet-trading 中重新定义所有 extrinsics
impl<T: Config> Pallet<T> {
    pub fn lock_deposit(origin) -> DispatchResult {
        pallet_maker::Pallet::<T>::lock_deposit(origin)
    }
}
```

**缺点**：
- 代码冗余
- 维护成本高
- 不推荐

---

## 📦 模块结构

### 新的 pallet-trading 结构

```
pallets/trading/
├── Cargo.toml          (依赖所有子模块)
├── src/
│   ├── lib.rs          (重新导出 + 聚合接口)
│   └── weights.rs      (聚合权重)
└── README.md           (整体文档)
```

### Cargo.toml 依赖

```toml
[dependencies]
pallet-maker = { path = "../maker", default-features = false }
pallet-otc-order = { path = "../otc-order", default-features = false }
pallet-bridge = { path = "../bridge", default-features = false }
pallet-trading-common = { path = "../trading-common", default-features = false }
```

---

## 🔧 Config Trait 设计

### 选项1：独立 Config（推荐）✅

```rust
#[pallet::config]
pub trait Config: frame_system::Config 
    + pallet_maker::Config
    + pallet_otc_order::Config
    + pallet_bridge::Config
{
    type RuntimeEvent: From<Event<Self>>;
    type WeightInfo: WeightInfo;
}
```

**优点**：
- 类型安全
- 编译时检查
- 清晰的依赖关系

### 选项2：空 Pallet

```rust
// 不创建 pallet，仅重新导出
pub use pallet_maker;
pub use pallet_otc_order;
pub use pallet_bridge;
```

**缺点**：
- 缺少聚合查询接口
- 不利于统一管理

---

## 📡 对外接口设计

### 1. 类型重新导出

```rust
// Maker 相关
pub use pallet_maker::{
    MakerApplication,
    ApplicationStatus,
    Direction,
    WithdrawalRequest,
    WithdrawalStatus,
};

// OTC 相关
pub use pallet_otc_order::{
    Order,
    OrderState,
};

// Bridge 相关
pub use pallet_bridge::{
    SwapRequest,
    SwapStatus,
    MakerSwapRecord,
};

// 公共类型
pub use pallet_trading_common::{
    mask_name,
    mask_id_card,
    mask_birthday,
    is_valid_tron_address,
    is_valid_epay_config,
};
```

### 2. 聚合查询接口

```rust
impl<T: Config> Pallet<T> {
    /// 获取做市商完整信息
    pub fn get_maker_full_info(maker_id: u64) -> Option<MakerFullInfo<T>> {
        let maker_app = pallet_maker::MakerApplications::<T>::get(maker_id)?;
        let order_count = pallet_otc_order::MakerOrders::<T>::get(maker_id).len();
        let swap_count = pallet_bridge::MakerSwapList::<T>::get(maker_id).len();
        
        Some(MakerFullInfo {
            application: maker_app,
            order_count,
            swap_count,
        })
    }
    
    /// 获取用户完整信息
    pub fn get_user_full_info(who: &T::AccountId) -> UserFullInfo<T> {
        let buyer_orders = pallet_otc_order::BuyerOrders::<T>::get(who);
        let user_swaps = pallet_bridge::UserSwaps::<T>::get(who);
        let has_first_purchased = pallet_otc_order::HasFirstPurchased::<T>::get(who);
        
        UserFullInfo {
            buyer_orders,
            user_swaps,
            has_first_purchased,
        }
    }
}
```

### 3. 统计接口

```rust
impl<T: Config> Pallet<T> {
    /// 获取平台统计信息
    pub fn get_platform_stats() -> PlatformStats {
        PlatformStats {
            total_makers: pallet_maker::NextMakerId::<T>::get(),
            total_orders: pallet_otc_order::NextOrderId::<T>::get(),
            total_swaps: pallet_bridge::NextSwapId::<T>::get(),
        }
    }
}
```

---

## 🎯 Runtime 集成方案

### 旧方式（单一模块）

```rust
impl pallet_trading::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    // ... 30多个配置项
}

construct_runtime! {
    Trading: pallet_trading,
}
```

### 新方式（模块化）

```rust
// 方式1：分别集成子模块
impl pallet_maker::Config for Runtime { ... }
impl pallet_otc_order::Config for Runtime { ... }
impl pallet_bridge::Config for Runtime { ... }

construct_runtime! {
    Maker: pallet_maker,
    OtcOrder: pallet_otc_order,
    Bridge: pallet_bridge,
}

// 方式2：通过统一接口层
impl pallet_trading::Config for Runtime {
    // 聚合配置
}

construct_runtime! {
    Trading: pallet_trading,
}
```

---

## 📊 前端适配方案

### 旧 API 路径

```typescript
api.tx.trading.lockDeposit()
api.query.trading.makerApplications(makerId)
```

### 新 API 路径

#### 选项1：直接调用子模块
```typescript
api.tx.maker.lockDeposit()
api.query.maker.makerApplications(makerId)
api.tx.otcOrder.createOrder(...)
api.query.otcOrder.orders(orderId)
```

#### 选项2：通过统一接口层
```typescript
api.tx.trading.maker.lockDeposit()
api.query.trading.maker.makerApplications(makerId)
api.tx.trading.otcOrder.createOrder(...)
```

---

## 🔄 迁移策略

### 阶段性迁移

#### 第一步：保留旧模块
```rust
// Runtime中同时保留新旧模块
construct_runtime! {
    // 旧的（标记为 deprecated）
    TradingOld: pallet_trading_old,
    
    // 新的
    Maker: pallet_maker,
    OtcOrder: pallet_otc_order,
    Bridge: pallet_bridge,
}
```

#### 第二步：前端适配
- 前端逐步切换到新API
- 保持旧API可用（兼容期）

#### 第三步：移除旧模块
- 确认所有前端已切换
- 移除旧的 `pallet_trading_old`

---

## ⚡ 性能考虑

### 1. 跨模块调用
```rust
// 避免频繁跨模块查询
// BAD
for order_id in orders {
    let maker_id = Orders::<T>::get(order_id).maker_id;
    let maker = MakerApplications::<T>::get(maker_id);
    // 多次存储读取
}

// GOOD
// 在子模块内部完成聚合
impl pallet_otc_order {
    pub fn get_orders_with_maker_info(...) -> Vec<(Order, MakerInfo)> {
        // 一次性批量查询
    }
}
```

### 2. 存储优化
- ✅ 保持子模块存储独立
- ✅ 避免重复存储
- ✅ 使用索引优化查询

---

## 📝 实现清单

### 阶段5任务列表

- [ ] 更新 `pallets/trading/Cargo.toml`（添加子模块依赖）
- [ ] 重写 `pallets/trading/src/lib.rs`（重新导出层）
- [ ] 创建聚合查询接口
- [ ] 创建 `weights.rs`（聚合权重）
- [ ] 更新 `pallets/trading/README.md`
- [ ] 验证编译通过
- [ ] 编写示例 Runtime 配置
- [ ] 创建前端迁移指南

---

## 🎯 验收标准

### 编译验证
```bash
cargo check -p pallet-trading
```

### 功能验证
- [ ] 所有类型可从 `pallet_trading` 导入
- [ ] 聚合查询接口可用
- [ ] Runtime 配置正确

---

## 📚 参考文档

- [Substrate Pallet 最佳实践](https://docs.substrate.io/reference/how-to-guides/)
- [模块化设计模式](https://rust-unofficial.github.io/patterns/)

---

**设计完成时间**: 2025-11-03  
**下一步**: 开始实现统一接口层

