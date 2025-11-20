#![cfg_attr(not(feature = "std"), no_std)]

//! # Trading Pallet - 统一接口层 (Unified Interface Layer)
//! 
//! ## 📦 重构后的架构 (Phase 5)
//! 
//! ### 函数级详细中文注释：模块化设计
//! 
//! 本 Pallet 是**统一接口层**，聚合以下独立模块：
//! 
//! 1. **pallet-maker** - 做市商管理（Application、审核、押金、提现）
//! 2. **pallet-otc-order** - OTC 订单管理（创建、支付、释放、取消、争议）
//! 3. **pallet-bridge** - DUST ↔ USDT 桥接（Swap、兑换、OCW）
//! 4. **pallet-trading-common** - 公共工具（数据掩码、验证）
//! 
//! ### 架构优势
//! 
//! ```text
//! 新架构（模块化）
//! ========================
//! pallet-trading (统一接口层，本文件)
//!   ├── 重新导出子模块类型
//!   ├── 提供聚合查询接口
//!   └── 简化 Runtime 集成
//! 
//! pallet-maker (独立模块)
//!   ├── 做市商申请/审核
//!   ├── 押金管理
//!   └── 提现流程
//! 
//! pallet-otc-order (独立模块)
//!   ├── 订单创建/支付
//!   ├── DUST释放
//!   ├── 首购逻辑
//!   └── 自动过期
//! 
//! pallet-bridge (独立模块)
//!   ├── DUST ↔ USDT兑换
//!   ├── OCW处理
//!   └── 做市商兑换
//! 
//! pallet-trading-common (工具库)
//!   ├── 数据掩码（姓名、身份证、生日）
//!   └── 数据验证（TRON地址、EPAY配置）
//! ```
//! 
//! ### 重构优势
//! 
//! - ✅ **低耦合**: 子模块独立开发、测试、部署
//! - ✅ **高内聚**: 每个模块职责单一清晰
//! - ✅ **易维护**: 修改子模块不影响其他模块
//! - ✅ **易测试**: 独立模块独立测试
//! - ✅ **灵活集成**: Runtime 可选择性集成子模块或全部
//! 
//! ### 兼容性
//! 
//! - ✅ 保留所有现有功能
//! - ✅ 前端 API 可平滑迁移
//! - ✅ 零迁移策略（主网未上线）
//! 
//! ## 使用示例
//! 
//! ### Runtime 集成 - 方式1：直接集成子模块
//! 
//! ```rust,ignore
//! impl pallet_maker::Config for Runtime {
//!     type RuntimeEvent = RuntimeEvent;
//!     type Currency = Balances;
//!     type MakerCredit = Credit;
//!     type GovernanceOrigin = EnsureTreasury;
//!     type Timestamp = Timestamp;
//!     type MakerDepositAmount = MakerDeposit;
//!     type MakerApplicationTimeout = MakerTimeout;
//!     type WithdrawalCooldown = WithdrawalCooldown;
//!     type WeightInfo = ();
//! }
//! 
//! impl pallet_otc_order::Config for Runtime {
//!     type RuntimeEvent = RuntimeEvent;
//!     type Currency = Balances;
//!     type Timestamp = Timestamp;
//!     type Escrow = Escrow;
//!     type Credit = Credit;
//!     type Pricing = Pricing;
//!     type OrderTimeout = OrderTimeout;
//!     // ... 其他配置
//!     type WeightInfo = ();
//! }
//! 
//! impl pallet_bridge::Config for Runtime {
//!     type RuntimeEvent = RuntimeEvent;
//!     type Currency = Balances;
//!     type Timestamp = Timestamp;
//!     type Escrow = Escrow;
//!     type MakerCredit = Credit;
//!     type Pricing = pallet_otc_order::PricingProvider; // 复用 OTC 的 Pricing
//!     type GovernanceOrigin = EnsureTreasury;
//!     // ... 其他配置
//!     type WeightInfo = ();
//! }
//! 
//! construct_runtime! {
//!     pub struct Runtime {
//!         // ... 其他模块
//!         Maker: pallet_maker,
//!         OtcOrder: pallet_otc_order,
//!         Bridge: pallet_bridge,
//!     }
//! }
//! ```
//! 
//! ### Runtime 集成 - 方式2：通过统一接口层
//! 
//! ```rust,ignore
//! impl pallet_trading::Config for Runtime {
//!     // 统一配置（待实现）
//! }
//! 
//! construct_runtime! {
//!     pub struct Runtime {
//!         // ... 其他模块
//!         Trading: pallet_trading,
//!     }
//! }
//! ```
//! 
//! ### 前端调用
//! 
//! ```typescript
//! // 方式1：直接调用子模块
//! await api.tx.maker.lockDeposit().signAndSend(account);
//! const makerInfo = await api.query.maker.makerApplications(makerId);
//! 
//! await api.tx.otcOrder.createOrder(makerId, amount, tronAddr).signAndSend(account);
//! const orderInfo = await api.query.otcOrder.orders(orderId);
//! 
//! await api.tx.bridge.swap(amount, tronAddr).signAndSend(account);
//! const swapInfo = await api.query.bridge.swapRequests(swapId);
//! 
//! // 方式2：通过统一接口层（可选，如果 Runtime 采用方式2）
//! await api.tx.trading.maker.lockDeposit().signAndSend(account);
//! const makerInfo = await api.query.trading.maker.makerApplications(makerId);
//! ```

// ===== 重新导出子模块 =====

/// 做市商管理模块
pub use pallet_maker;

/// OTC 订单管理模块
pub use pallet_otc_order;

/// DUST ↔ USDT 桥接模块
pub use pallet_bridge;

/// 公共工具模块
pub use pallet_trading_common;

// ===== 聚合类型导出 =====

/// Maker 相关类型
pub mod maker_types {
    pub use pallet_maker::{
        MakerApplication,
        ApplicationStatus,
        Direction,
        WithdrawalRequest,
        WithdrawalStatus,
    };
}

/// OTC 相关类型
pub mod otc_types {
    pub use pallet_otc_order::{
        Order,
        OrderState,
        PricingProvider,
    };
}

/// Bridge 相关类型
pub mod bridge_types {
    pub use pallet_bridge::{
        SwapRequest,
        SwapStatus,
        MakerSwapRecord,
    };
}

/// 公共工具
pub mod common {
    pub use pallet_trading_common::{
        mask_name,
        mask_id_card,
        mask_birthday,
        is_valid_tron_address,
        is_valid_epay_config,
    };
}

// ===== 统一 Pallet 定义（可选）=====

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    /// 函数级详细中文注释：Trading Pallet 配置 Trait
    /// 
    /// 该配置 Trait 目前为空，仅作为统一接口层的占位符。
    /// 实际配置在各个子模块的 Config trait 中定义。
    #[pallet::config]
    pub trait Config: 
        frame_system::Config 
        + pallet_maker::Config
        + pallet_otc_order::Config
        + pallet_bridge::Config
    {
        /// 事件类型（统一接口层不产生独立事件）
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// 权重信息（统一接口层不产生独立权重）
        type WeightInfo: WeightInfo;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级详细中文注释：统一接口层事件
    /// 
    /// 统一接口层本身不产生事件，所有事件由子模块产生。
    /// 这里保留空的 Event 定义以满足 Substrate 框架要求。
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 占位事件（不使用）
        _Phantom(core::marker::PhantomData<T>),
    }

    /// 函数级详细中文注释：统一接口层错误
    /// 
    /// 统一接口层本身不产生错误，所有错误由子模块产生。
    /// 这里保留空的 Error 定义以满足 Substrate 框架要求。
    #[pallet::error]
    pub enum Error<T> {
        /// 占位错误（不使用）
        _Phantom,
    }

    // ===== 聚合查询接口 =====

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：获取做市商完整信息
        /// 
        /// 聚合查询做市商的申请信息、订单数量、兑换数量。
        /// 
        /// # 参数
        /// - `maker_id`: 做市商 ID
        /// 
        /// # 返回
        /// - `Some(MakerFullInfo)`: 做市商完整信息
        /// - `None`: 做市商不存在
        pub fn get_maker_full_info(maker_id: u64) -> Option<MakerFullInfo<T>> {
            let maker_app = pallet_maker::MakerApplications::<T>::get(maker_id)?;
            let order_count = pallet_otc_order::MakerOrders::<T>::get(maker_id)
                .map(|orders| orders.len())
                .unwrap_or(0);
            let swap_count = pallet_bridge::MakerSwapList::<T>::get(maker_id)
                .map(|swaps| swaps.len())
                .unwrap_or(0);
            
            Some(MakerFullInfo {
                application: maker_app,
                order_count: order_count as u32,
                swap_count: swap_count as u32,
            })
        }

        /// 函数级详细中文注释：获取用户完整信息
        /// 
        /// 聚合查询用户的订单列表、兑换列表、首购状态。
        /// 
        /// # 参数
        /// - `who`: 用户账户
        /// 
        /// # 返回
        /// - `UserFullInfo`: 用户完整信息
        pub fn get_user_full_info(who: &T::AccountId) -> UserFullInfo<T> {
            let buyer_orders = pallet_otc_order::BuyerOrders::<T>::get(who).unwrap_or_default();
            let user_swaps = pallet_bridge::UserSwaps::<T>::get(who).unwrap_or_default();
            let has_first_purchased = pallet_otc_order::HasFirstPurchased::<T>::get(who);
            
            UserFullInfo {
                buyer_orders,
                user_swaps,
                has_first_purchased,
            }
        }

        /// 函数级详细中文注释：获取平台统计信息
        /// 
        /// 聚合查询平台的总做市商数、总订单数、总兑换数。
        /// 
        /// # 返回
        /// - `PlatformStats`: 平台统计信息
        pub fn get_platform_stats() -> PlatformStats {
            PlatformStats {
                total_makers: pallet_maker::NextMakerId::<T>::get(),
                total_orders: pallet_otc_order::NextOrderId::<T>::get(),
                total_swaps: pallet_bridge::NextSwapId::<T>::get(),
            }
        }
    }

    // ===== 权重信息 Trait =====

    /// 函数级详细中文注释：统一接口层权重信息 Trait
    /// 
    /// 统一接口层本身不产生独立权重，这里保留空的 Trait 定义。
    pub trait WeightInfo {
        // 占位方法
    }

    impl WeightInfo for () {
        // 空实现
    }
}

// ===== 聚合数据结构 =====

use frame_support::pallet_prelude::*;

/// 函数级详细中文注释：做市商完整信息
/// 
/// 聚合做市商的申请信息、订单数量、兑换数量。
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MakerFullInfo<T: pallet::Config> {
    /// 做市商申请信息
    pub application: pallet_maker::MakerApplication<T::AccountId>,
    /// 订单总数
    pub order_count: u32,
    /// 兑换总数
    pub swap_count: u32,
}

/// 函数级详细中文注释：用户完整信息
/// 
/// 聚合用户的订单列表、兑换列表、首购状态。
#[derive(Clone, Encode, Decode, TypeInfo)]
#[scale_info(skip_type_params(T))]
pub struct UserFullInfo<T: pallet::Config> {
    /// 买家订单列表
    pub buyer_orders: frame_support::BoundedVec<u64, <T as pallet_otc_order::Config>::MaxOrdersPerUser>,
    /// 用户兑换列表
    pub user_swaps: frame_support::BoundedVec<u64, <T as pallet_bridge::Config>::MaxUserSwaps>,
    /// 是否已首购
    pub has_first_purchased: bool,
}

/// 函数级详细中文注释：平台统计信息
/// 
/// 聚合平台的总做市商数、总订单数、总兑换数。
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct PlatformStats {
    /// 总做市商数
    pub total_makers: u64,
    /// 总订单数
    pub total_orders: u64,
    /// 总兑换数
    pub total_swaps: u64,
}

