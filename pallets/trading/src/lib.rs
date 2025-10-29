#![cfg_attr(not(feature = "std"), no_std)]

//! # Trading Pallet (统一交易模块)
//! 
//! ## 📦 Phase 2 架构整合
//! 
//! ### 函数级详细中文注释：整合目标
//! 
//! 本 Pallet 整合了以下三个交易相关模块：
//! 1. **OTC Order** (场外交易订单)
//! 2. **Market Maker** (做市商管理)
//! 3. **Simple Bridge** (MEMO ↔ USDT 桥接)
//! 
//! ### 架构设计
//! 
//! ```text
//! pallet-trading/
//! ├── lib.rs           (主模块：Config、Event、Error)
//! ├── maker.rs         (做市商子模块：Application、审核、押金)
//! ├── otc.rs           (OTC子模块：Order、交易流程、争议)
//! ├── bridge.rs        (桥接子模块：Swap、兑换、OCW)
//! ├── common.rs        (公共逻辑：TRON哈希、信用集成)
//! ├── mock.rs          (测试模拟环境)
//! └── tests.rs         (单元测试)
//! ```
//! 
//! ### 优势
//! 
//! - ✅ 减少 2 个 Pallet
//! - ✅ 统一交易逻辑
//! - ✅ 共享存储和配置
//! - ✅ 降低维护成本
//! - ✅ 优化 Gas 成本
//! 
//! ### 兼容性
//! 
//! - ✅ 保留所有现有功能
//! - ✅ 前端 API 映射简单
//! - ✅ 链上状态迁移最小化

pub use pallet::*;

// 导出ArbitrationHook供runtime使用
pub use otc::ArbitrationHook;

// 子模块导出
pub mod maker;
pub mod otc;
pub mod bridge;
pub mod common;
pub mod weights;

// 🆕 清理模块（自动归档）
mod otc_cleanup;
mod bridge_cleanup;

// 重新导出WeightInfo
pub use weights::WeightInfo;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency, Get},
        BoundedVec,
        weights::Weight,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::Perbill;
    use sp_std::vec::Vec;
    use sp_core::{H256, crypto::KeyTypeId};
    
    // 导入子模块类型
    pub use crate::maker::*;
    pub use crate::otc::*;
    pub use crate::bridge::*;
    pub use crate::common::*;

    // ===== 类型别名 =====
    
    /// 函数级详细中文注释：余额类型别名（统一使用 Currency trait）
    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<
        <T as frame_system::Config>::AccountId,
    >>::Balance;
    
    /// 函数级详细中文注释：时间戳类型别名（Unix时间戳，毫秒）
    pub type MomentOf<T> = <T as pallet_timestamp::Config>::Moment;
    
    /// 函数级详细中文注释：CID 类型别名（IPFS内容标识符，最大64字节）
    /// 优化说明（2025-10-28）：IPFS CID v1实际最大59字节，从256缩小到64，节省75%存储空间
    pub type Cid = BoundedVec<u8, ConstU32<64>>;
    
    /// 函数级详细中文注释：TRON地址类型别名（Base58格式，固定34字节）
    /// 优化说明（2025-10-28）：TRON地址固定34字节，从64缩小到34，节省47%存储空间
    pub type TronAddress = BoundedVec<u8, ConstU32<34>>;
    
    /// 函数级详细中文注释：OCW 专用密钥类型
    pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"trad");

    // ===== 权重信息 Trait =====
    
    /// 函数级详细中文注释：Trading Pallet 权重信息 Trait
    /// 定义各个交易函数的权重计算方法
    pub trait TradingWeightInfo {
        // Maker 模块权重
        fn lock_deposit() -> Weight;
        fn submit_info() -> Weight;
        fn update_info() -> Weight;
        fn cancel_maker() -> Weight;
        fn approve_maker() -> Weight;
        fn reject_maker() -> Weight;
        fn expire_maker() -> Weight;
        fn request_withdrawal() -> Weight;
        fn execute_withdrawal() -> Weight;
        fn cancel_withdrawal() -> Weight;
        fn emergency_withdrawal() -> Weight;
        
        // OTC 模块权重
        fn create_order() -> Weight;
        fn mark_paid() -> Weight;
        fn release_dust() -> Weight;
        fn cancel_order() -> Weight;
        fn dispute_order() -> Weight;
        
        // Bridge 模块权重
        fn swap() -> Weight;
        fn complete_swap() -> Weight;
        fn maker_swap() -> Weight;
        fn report_maker_swap() -> Weight;
    }

    impl TradingWeightInfo for () {
        fn lock_deposit() -> Weight { Weight::zero() }
        fn submit_info() -> Weight { Weight::zero() }
        fn update_info() -> Weight { Weight::zero() }
        fn cancel_maker() -> Weight { Weight::zero() }
        fn approve_maker() -> Weight { Weight::zero() }
        fn reject_maker() -> Weight { Weight::zero() }
        fn expire_maker() -> Weight { Weight::zero() }
        fn request_withdrawal() -> Weight { Weight::zero() }
        fn execute_withdrawal() -> Weight { Weight::zero() }
        fn cancel_withdrawal() -> Weight { Weight::zero() }
        fn emergency_withdrawal() -> Weight { Weight::zero() }
        fn create_order() -> Weight { Weight::zero() }
        fn mark_paid() -> Weight { Weight::zero() }
        fn release_dust() -> Weight { Weight::zero() }
        fn cancel_order() -> Weight { Weight::zero() }
        fn dispute_order() -> Weight { Weight::zero() }
        fn swap() -> Weight { Weight::zero() }
        fn complete_swap() -> Weight { Weight::zero() }
        fn maker_swap() -> Weight { Weight::zero() }
        fn report_maker_swap() -> Weight { Weight::zero() }
    }

    // ===== Pallet 配置 =====

    #[pallet::config]
    pub trait Config: 
        frame_system::Config 
        + pallet_timestamp::Config 
        + pallet_pricing::Config 
        + pallet_escrow::pallet::Config
        + pallet_credit::Config  // 🆕 2025-10-29: 替代 pallet_buyer_credit
    {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// 货币类型
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;
        
        /// 托管接口（用于 OTC 订单的锁定/释放/退款）
        type Escrow: pallet_escrow::pallet::Escrow<Self::AccountId, BalanceOf<Self>>;
        
        /// 做市商信用接口（记录完成和违约）
        /// 🆕 2025-10-29: 使用新的 pallet-credit
        type MakerCredit: pallet_credit::MakerCreditInterface<Self::AccountId>;
        
        /// 权重信息
        type WeightInfo: TradingWeightInfo;
        
        // ===== 治理配置 =====
        
        /// 治理 Origin（用于审批、拒绝、紧急操作等）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        
        /// Pallet ID（用于生成内部账户）
        #[pallet::constant]
        type PalletId: Get<frame_support::PalletId>;
        
        // ===== Maker 模块配置 =====
        
        /// 做市商押金金额
        #[pallet::constant]
        type MakerDepositAmount: Get<BalanceOf<Self>>;
        
        /// 做市商申请超时时间（区块数）
        #[pallet::constant]
        type MakerApplicationTimeout: Get<BlockNumberFor<Self>>;
        
        /// 做市商提现冷却期（区块数）
        #[pallet::constant]
        type WithdrawalCooldown: Get<BlockNumberFor<Self>>;
        
        // ===== OTC 模块配置 =====
        
        /// 订单确认超时时间（区块数）
        #[pallet::constant]
        type ConfirmTTL: Get<BlockNumberFor<Self>>;
        
        /// 买家撤回窗口（毫秒）
        #[pallet::constant]
        type CancelWindow: Get<MomentOf<Self>>;
        
        /// 每块最多处理过期订单数
        #[pallet::constant]
        type MaxExpiringPerBlock: Get<u32>;
        
        /// 吃单限频窗口与上限
        #[pallet::constant]
        type OpenWindow: Get<BlockNumberFor<Self>>;
        #[pallet::constant]
        type OpenMaxInWindow: Get<u32>;
        
        /// 标记支付限频窗口与上限
        #[pallet::constant]
        type PaidWindow: Get<BlockNumberFor<Self>>;
        #[pallet::constant]
        type PaidMaxInWindow: Get<u32>;
        
        /// 法币网关服务账户
        type FiatGatewayAccount: Get<Self::AccountId>;
        
        /// 法币网关托管账户
        type FiatGatewayTreasuryAccount: Get<Self::AccountId>;
        
        /// 首购最低金额
        #[pallet::constant]
        type MinFirstPurchaseAmount: Get<BalanceOf<Self>>;
        
        /// 首购最高金额
        #[pallet::constant]
        type MaxFirstPurchaseAmount: Get<BalanceOf<Self>>;
        
        /// 会员信息提供者
        type MembershipProvider: pallet_stardust_referrals::MembershipProvider<Self::AccountId>;
        
        /// 推荐关系提供者
        type ReferralProvider: pallet_stardust_referrals::ReferralProvider<Self::AccountId>;
        
        /// 联盟计酬分配器
        /// 🆕 2025-10-29: 使用新的 pallet-affiliate
        type AffiliateDistributor: pallet_affiliate::types::AffiliateDistributor<
            Self::AccountId,
            u128,
            BlockNumberFor<Self>,
        >;
        
        /// 订单归档阈值（天数）
        #[pallet::constant]
        type OrderArchiveThresholdDays: Get<u32>;
        
        /// 每次自动清理的最大订单数
        #[pallet::constant]
        type MaxOrderCleanupPerBlock: Get<u32>;
        
        // ===== Bridge 模块配置 =====
        
        /// 兑换超时时间（区块数）
        #[pallet::constant]
        type SwapTimeout: Get<BlockNumberFor<Self>>;
        
        /// 兑换记录归档阈值（天数）
        #[pallet::constant]
        type SwapArchiveThresholdDays: Get<u32>;
        
        /// 每次自动清理的最大兑换记录数
        #[pallet::constant]
        type MaxSwapCleanupPerBlock: Get<u32>;
        
        /// OCW 验证失败阈值
        #[pallet::constant]
        type MaxVerificationFailures: Get<u32>;
        
        /// 每个区块最多验证的订单数
        #[pallet::constant]
        type MaxOrdersPerBlock: Get<u32>;
        
        /// OCW 兑换订单超时时长（区块数）
        #[pallet::constant]
        type OcwSwapTimeoutBlocks: Get<BlockNumberFor<Self>>;
        
        /// OCW 最小兑换金额
        #[pallet::constant]
        type OcwMinSwapAmount: Get<BalanceOf<Self>>;
        
        /// 无签名交易优先级
        #[pallet::constant]
        type UnsignedPriority: Get<TransactionPriority>;
        
        // ===== 公共配置 =====
        
        /// TRON交易哈希保留期（区块数）
        #[pallet::constant]
        type TronTxHashRetentionPeriod: Get<BlockNumberFor<Self>>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== 公共存储 =====
    
    /// 函数级详细中文注释：已使用的 TRON 交易哈希
    /// 用于防止重放攻击（统一管理 OTC 和 Bridge 的 TRON 交易）
    #[pallet::storage]
    #[pallet::getter(fn tron_tx_used)]
    pub type TronTxUsed<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        H256, // TRON tx hash
        BlockNumberFor<T>, // 记录时间
        OptionQuery,
    >;
    
    /// 函数级详细中文注释：TRON 交易哈希队列（用于按时间清理）
    #[pallet::storage]
    #[pallet::getter(fn tron_tx_queue)]
    pub type TronTxQueue<T: Config> = StorageValue<
        _,
        BoundedVec<(H256, BlockNumberFor<T>), ConstU32<10000>>,
        ValueQuery,
    >;

    // ===== Maker 模块存储 =====
    
    /// 函数级详细中文注释：下一个做市商ID
    #[pallet::storage]
    #[pallet::getter(fn next_maker_id)]
    pub type NextMakerId<T: Config> = StorageValue<_, u64, ValueQuery>;
    
    /// 函数级详细中文注释：做市商申请记录
    #[pallet::storage]
    #[pallet::getter(fn maker_applications)]
    pub type MakerApplications<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // maker_id
        MakerApplication<T>,
        OptionQuery,
    >;
    
    /// 函数级详细中文注释：账户到做市商ID的映射
    #[pallet::storage]
    #[pallet::getter(fn account_to_maker)]
    pub type AccountToMaker<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u64, // maker_id
        OptionQuery,
    >;
    
    /// 函数级详细中文注释：做市商溢价配置
    #[pallet::storage]
    #[pallet::getter(fn maker_premium)]
    pub type MakerPremium<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // maker_id
        Perbill, // 溢价率
        ValueQuery,
    >;
    
    /// 函数级详细中文注释：做市商提现请求
    #[pallet::storage]
    #[pallet::getter(fn withdrawal_requests)]
    pub type WithdrawalRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // maker_id
        WithdrawalRequest<BalanceOf<T>>,
        OptionQuery,
    >;

    // ===== OTC 模块存储 =====
    
    /// 函数级详细中文注释：下一个订单ID
    #[pallet::storage]
    #[pallet::getter(fn next_order_id)]
    pub type NextOrderId<T: Config> = StorageValue<_, u64, ValueQuery>;
    
    /// 函数级详细中文注释：订单记录
    #[pallet::storage]
    #[pallet::getter(fn orders)]
    pub type Orders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // order_id
        Order<T>,
        OptionQuery,
    >;
    
    /// 函数级详细中文注释：买家活跃订单列表
    #[pallet::storage]
    #[pallet::getter(fn buyer_orders)]
    pub type BuyerOrders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, ConstU32<100>>,
        ValueQuery,
    >;
    
    /// 函数级详细中文注释：做市商活跃订单列表
    #[pallet::storage]
    #[pallet::getter(fn maker_orders)]
    pub type MakerOrders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // maker_id
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;
    
    /// 函数级详细中文注释：可治理的 OTC 风控参数
    #[pallet::storage]
    pub type OpenWindowValue<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;
    
    #[pallet::storage]
    pub type OpenMaxInWindowValue<T: Config> = StorageValue<_, u32, ValueQuery>;
    
    #[pallet::storage]
    pub type PaidWindowValue<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;
    
    #[pallet::storage]
    pub type PaidMaxInWindowValue<T: Config> = StorageValue<_, u32, ValueQuery>;
    
    /// 函数级详细中文注释：首购资金池余额
    #[pallet::storage]
    pub type FirstPurchasePool<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    // ===== Bridge 模块存储 =====
    
    /// 函数级详细中文注释：下一个兑换ID
    #[pallet::storage]
    #[pallet::getter(fn next_swap_id)]
    pub type NextSwapId<T: Config> = StorageValue<_, u64, ValueQuery>;
    
    /// 函数级详细中文注释：官方桥接兑换请求
    #[pallet::storage]
    #[pallet::getter(fn swap_requests)]
    pub type SwapRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // swap_id
        SwapRequest<T>,
        OptionQuery,
    >;
    
    /// 函数级详细中文注释：做市商兑换记录
    #[pallet::storage]
    #[pallet::getter(fn maker_swaps)]
    pub type MakerSwaps<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // swap_id
        MakerSwapRecord<T>,
        OptionQuery,
    >;
    
    /// 🆕 函数级详细中文注释：用户兑换索引（用于O(1)查询用户的兑换记录）
    /// - Key: 用户账户
    /// - Value: 该用户的所有兑换ID列表（最多1000个）
    #[pallet::storage]
    #[pallet::getter(fn user_swaps)]
    pub type UserSwaps<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;
    
    /// 🆕 函数级详细中文注释：做市商兑换索引（用于O(1)查询做市商的兑换记录）
    /// - Key: 做市商ID
    /// - Value: 该做市商的所有兑换ID列表（最多10000个）
    #[pallet::storage]
    #[pallet::getter(fn maker_swap_list)]
    pub type MakerSwapList<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // maker_id
        BoundedVec<u64, ConstU32<10000>>,
        ValueQuery,
    >;
    
    /// 函数级详细中文注释：待验证的 OCW 做市商兑换队列
    #[pallet::storage]
    pub type PendingOcwSwaps<T: Config> = StorageValue<
        _,
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;
    
    /// 函数级详细中文注释：OCW 验证失败计数
    #[pallet::storage]
    pub type OcwVerificationFailures<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // swap_id
        u32, // failure count
        ValueQuery,
    >;
    
    /// 函数级详细中文注释：桥接账户（用于官方桥接）
    #[pallet::storage]
    pub type BridgeAccount<T: Config> = StorageValue<_, T::AccountId, OptionQuery>;
    
    /// 函数级详细中文注释：最小兑换金额（可治理）
    #[pallet::storage]
    pub type MinSwapAmount<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    // ===== 事件 =====

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        // ===== Maker 模块事件 =====
        
        /// 做市商押金已锁定 [maker_id, who, amount]
        MakerDepositLocked { maker_id: u64, who: T::AccountId, amount: BalanceOf<T> },
        
        /// 做市商信息已提交 [maker_id, who]
        MakerInfoSubmitted { maker_id: u64, who: T::AccountId },
        
        /// 🆕 做市商信息已更新 [maker_id, who]
        /// 优化：合并了原MakerInfoUpdated和MakerPremiumSet事件
        MakerUpdated { maker_id: u64, who: T::AccountId },
        
        /// 做市商申请已取消 [maker_id, who]
        MakerCancelled { maker_id: u64, who: T::AccountId },
        
        /// 做市商已审批通过 [maker_id, approved_by]
        MakerApproved { maker_id: u64, approved_by: T::AccountId },
        
        /// 做市商已被拒绝 [maker_id, rejected_by]
        MakerRejected { maker_id: u64, rejected_by: T::AccountId },
        
        /// 做市商申请已超时 [maker_id]
        MakerExpired { maker_id: u64 },
        
        /// 做市商请求提现 [maker_id, amount]
        WithdrawalRequested { maker_id: u64, amount: BalanceOf<T> },
        
        /// 做市商提现已执行 [maker_id, amount]
        WithdrawalExecuted { maker_id: u64, amount: BalanceOf<T> },
        
        /// 做市商提现已取消 [maker_id]
        WithdrawalCancelled { maker_id: u64 },
        
        /// 紧急提现已执行 [maker_id, to, amount]
        EmergencyWithdrawalExecuted { maker_id: u64, to: T::AccountId, amount: BalanceOf<T> },
        
        // ===== OTC 模块事件（已优化）⭐ =====
        
        /// 🆕 OTC订单已创建 [order_id, maker_id, buyer, dust_amount, is_first_purchase]
        /// 优化：合并了FirstPurchaseCreated事件，使用is_first_purchase标志区分
        OrderCreated { 
            order_id: u64, 
            maker_id: u64, 
            buyer: T::AccountId, 
            dust_amount: BalanceOf<T>,
            is_first_purchase: bool,
        },
        
        /// 🆕 订单状态已变更 [order_id, old_state, new_state, actor]
        /// 优化：合并了OrderMarkedPaid, MemoReleased, OrderCancelled, OrderDisputed四个事件
        /// 状态码：0=Created, 1=PaidOrCommitted, 2=Released, 3=Canceled, 4=Disputed
        OrderStateChanged {
            order_id: u64,
            old_state: u8,
            new_state: u8,
            actor: Option<T::AccountId>,
        },
        
        /// 首购资金池已充值 [amount, new_balance]
        FirstPurchasePoolFunded { amount: BalanceOf<T>, new_balance: BalanceOf<T> },
        
        /// 订单已自动清理 [order_id]
        OrderArchived { order_id: u64 },
        
        // ===== Bridge 模块事件（已优化）⭐ =====
        
        /// 官方桥接兑换已创建 [swap_id, user, dust_amount, tron_address]
        SwapCreated { swap_id: u64, user: T::AccountId, dust_amount: BalanceOf<T>, tron_address: TronAddress },
        
        /// 做市商兑换已创建 [swap_id, maker_id, user, dust_amount, usdt_amount]
        MakerSwapCreated { swap_id: u64, maker_id: u64, user: T::AccountId, dust_amount: BalanceOf<T>, usdt_amount: u64 },
        
        /// 做市商兑换已标记完成 [swap_id, maker_id, trc20_tx_hash]
        MakerSwapMarkedComplete { swap_id: u64, maker_id: u64, trc20_tx_hash: BoundedVec<u8, ConstU32<128>> },
        
        /// 🆕 Swap状态已变更 [swap_id, old_state, new_state]
        /// 优化：合并了SwapCompleted, MakerSwapReported, MakerSwapRefunded事件
        /// 状态码：0=Created, 1=Completed, 2=Reported, 3=Refunded
        SwapStateChanged {
            swap_id: u64,
            old_state: u8,
            new_state: u8,
        },
        
        /// 兑换记录已清理 [swap_id]
        SwapArchived { swap_id: u64 },
        
        /// 桥接账户已设置 [account]
        BridgeAccountSet { account: T::AccountId },
        
        /// 最小兑换金额已设置 [amount]
        MinSwapAmountSet { amount: BalanceOf<T> },
        
        // ===== 公共事件 =====
        
        /// TRON交易哈希已记录 [tx_hash]
        TronTxHashRecorded { tx_hash: H256 },
        
        /// TRON交易哈希已清理 [count]
        TronTxHashCleaned { count: u32 },
    }

    // ===== 错误 =====

    #[pallet::error]
    pub enum Error<T> {
        // ===== Maker 模块错误 =====
        
        /// 做市商不存在
        MakerNotFound,
        
        /// 做市商已存在
        MakerAlreadyExists,
        
        /// 做市商状态无效
        InvalidMakerStatus,
        
        /// 做市商押金不足
        InsufficientDeposit,
        
        /// 做市商未激活
        MakerNotActive,
        
        /// 提现请求不存在
        WithdrawalRequestNotFound,
        
        /// 提现冷却期未到
        WithdrawalCooldownNotMet,
        
        /// 无权操作
        NotAuthorized,
        
        /// 溢价率超出范围
        PremiumOutOfRange,
        
        /// TRON地址无效
        InvalidTronAddress,
        
        /// EPAY配置无效
        InvalidEpayConfig,
        
        // ===== OTC 模块错误 =====
        
        /// 订单不存在
        OrderNotFound,
        
        /// 订单状态无效
        InvalidOrderStatus,
        
        /// 订单金额无效
        InvalidAmount,
        
        /// 订单已超时
        OrderTimeout,
        
        /// 撤回窗口已过期
        CancelWindowExpired,
        
        /// 超出限频限制
        RateLimitExceeded,
        
        /// 买家信用不足
        InsufficientBuyerCredit,
        
        /// TRON交易哈希已使用
        TronTxHashAlreadyUsed,
        
        /// 支付承诺无效
        InvalidPaymentCommit,
        
        /// 联系方式承诺无效
        InvalidContactCommit,
        
        /// 首购资金池余额不足
        FirstPurchasePoolInsufficient,
        
        /// 首购金额超出范围
        FirstPurchaseAmountOutOfRange,
        
        /// 不是首购用户
        NotFirstPurchaseUser,
        
        // ===== Bridge 模块错误 =====
        
        /// 兑换不存在
        SwapNotFound,
        
        /// 兑换状态无效
        InvalidSwapStatus,
        
        /// 兑换金额低于最小值
        SwapAmountTooLow,
        
        /// 兑换已超时
        SwapTimeout,
        
        /// 桥接账户未设置
        BridgeAccountNotSet,
        
        /// OCW验证失败次数过多
        TooManyVerificationFailures,
        
        /// OCW队列已满
        OcwQueueFull,
        
        /// 价格获取失败
        PriceNotAvailable,
        
        // ===== 公共错误 =====
        
        /// 算术溢出
        ArithmeticOverflow,
        
        /// 余额不足
        InsufficientBalance,
        
        /// 数据编码错误
        EncodingError,
        
        /// 存储限制已达
        StorageLimitReached,
    }

    // ===== 可调用函数 =====

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        
        // ===== Maker 模块函数 =====
        
        /// 函数级详细中文注释：锁定做市商押金
        /// 
        /// # 参数
        /// - origin: 交易发起者
        /// 
        /// # 返回
        /// - DispatchResult
        #[pallet::call_index(0)]
        #[pallet::weight(<T as Config>::WeightInfo::lock_deposit())]
        pub fn lock_deposit(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::maker::do_lock_deposit::<T>(&who)
        }
        
        /// 函数级详细中文注释：提交做市商资料
        /// 
        /// # 参数
        /// - origin: 交易发起者
        /// - real_name: 真实姓名
        /// - id_card_number: 身份证号
        /// - birthday: 生日
        /// - tron_address: TRON收款地址
        /// - wechat_id: 微信号
        /// - epay_no: EPAY商户号（可选）
        /// - epay_key: EPAY密钥（可选）
        /// 
        /// # 返回
        /// - DispatchResult
        #[pallet::call_index(1)]
        #[pallet::weight(<T as Config>::WeightInfo::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            _real_name: Vec<u8>,
            _id_card_number: Vec<u8>,
            _birthday: Vec<u8>,
            _tron_address: Vec<u8>,
            _wechat_id: Vec<u8>,
            _epay_no: Option<Vec<u8>>,
            _epay_key: Option<Vec<u8>>,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            // TODO: 实现做市商资料提交逻辑
            todo!("实现做市商资料提交逻辑")
        }
        
        /// 函数级详细中文注释：更新做市商资料
        #[pallet::call_index(2)]
        #[pallet::weight(<T as Config>::WeightInfo::update_info())]
        pub fn update_info(
            origin: OriginFor<T>,
            _real_name: Vec<u8>,
            _id_card_number: Vec<u8>,
            _birthday: Vec<u8>,
            _tron_address: Vec<u8>,
            _wechat_id: Vec<u8>,
            _epay_no: Option<Vec<u8>>,
            _epay_key: Option<Vec<u8>>,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;
            // TODO: 实现更新逻辑
            todo!("实现做市商资料更新逻辑")
        }
        
        /// 函数级详细中文注释：取消做市商申请
        #[pallet::call_index(3)]
        #[pallet::weight(<T as Config>::WeightInfo::cancel_maker())]
        pub fn cancel_maker(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::maker::do_cancel_maker::<T>(&who)
        }
        
        /// 函数级详细中文注释：审批做市商申请（治理）
        #[pallet::call_index(4)]
        #[pallet::weight(<T as Config>::WeightInfo::approve_maker())]
        pub fn approve_maker(origin: OriginFor<T>, _maker_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // TODO: 实现做市商审批逻辑
            todo!("实现做市商审批逻辑")
        }
        
        /// 函数级详细中文注释：驳回做市商申请（治理）
        #[pallet::call_index(5)]
        #[pallet::weight(<T as Config>::WeightInfo::reject_maker())]
        pub fn reject_maker(origin: OriginFor<T>, _maker_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // TODO: 实现做市商驳回逻辑
            todo!("实现做市商驳回逻辑")
        }
        
        /// 函数级详细中文注释：申请提现押金
        #[pallet::call_index(6)]
        #[pallet::weight(<T as Config>::WeightInfo::request_withdrawal())]
        pub fn request_withdrawal(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::maker::do_request_withdrawal::<T>(&who, amount)
        }
        
        /// 函数级详细中文注释：执行提现
        #[pallet::call_index(7)]
        #[pallet::weight(<T as Config>::WeightInfo::execute_withdrawal())]
        pub fn execute_withdrawal(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::maker::do_execute_withdrawal::<T>(&who)
        }
        
        /// 函数级详细中文注释：取消提现请求
        #[pallet::call_index(8)]
        #[pallet::weight(<T as Config>::WeightInfo::cancel_withdrawal())]
        pub fn cancel_withdrawal(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::maker::do_cancel_withdrawal::<T>(&who)
        }
        
        /// 函数级详细中文注释：紧急提现（治理）
        #[pallet::call_index(9)]
        #[pallet::weight(<T as Config>::WeightInfo::emergency_withdrawal())]
        pub fn emergency_withdrawal(
            origin: OriginFor<T>, 
            maker_id: u64, 
            to: T::AccountId
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            crate::maker::do_emergency_withdrawal::<T>(maker_id, &to)
        }
        
        // ===== OTC 模块函数 =====
        
        /// 函数级详细中文注释：创建OTC订单
        #[pallet::call_index(10)]
        #[pallet::weight(<T as Config>::WeightInfo::create_order())]
        pub fn create_order(
            origin: OriginFor<T>,
            maker_id: u64,
            dust_amount: BalanceOf<T>,
            payment_commit: [u8; 32],
            contact_commit: [u8; 32],
        ) -> DispatchResult {
            let buyer = ensure_signed(origin)?;
            let payment_hash = H256::from(payment_commit);
            let contact_hash = H256::from(contact_commit);
            crate::otc::do_create_order::<T>(&buyer, maker_id, dust_amount, payment_hash, contact_hash)?;
            Ok(())
        }
        
        /// 函数级详细中文注释：买家标记已付款
        #[pallet::call_index(11)]
        #[pallet::weight(<T as Config>::WeightInfo::mark_paid())]
        pub fn mark_paid(
            origin: OriginFor<T>,
            order_id: u64,
            tron_tx_hash: Option<Vec<u8>>,
        ) -> DispatchResult {
            let buyer = ensure_signed(origin)?;
            crate::otc::do_mark_paid::<T>(&buyer, order_id, tron_tx_hash)
        }
        
        /// 函数级详细中文注释：做市商释放DUST
        #[pallet::call_index(12)]
        #[pallet::weight(<T as Config>::WeightInfo::release_dust())]
        pub fn release_dust(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
            let maker = ensure_signed(origin)?;
            crate::otc::do_release_dust::<T>(&maker, order_id)
        }
        
        /// 函数级详细中文注释：取消订单
        #[pallet::call_index(13)]
        #[pallet::weight(<T as Config>::WeightInfo::cancel_order())]
        pub fn cancel_order(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::otc::do_cancel_order::<T>(&who, order_id)
        }
        
        /// 函数级详细中文注释：发起订单争议
        #[pallet::call_index(14)]
        #[pallet::weight(<T as Config>::WeightInfo::dispute_order())]
        pub fn dispute_order(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            crate::otc::do_dispute_order::<T>(&who, order_id)
        }
        
        // ===== Bridge 模块函数 =====
        
        /// 函数级详细中文注释：创建官方桥接兑换
        #[pallet::call_index(15)]
        #[pallet::weight(<T as Config>::WeightInfo::swap())]
        pub fn swap(
            origin: OriginFor<T>,
            dust_amount: BalanceOf<T>,
            tron_address: Vec<u8>,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;
            crate::bridge::do_swap::<T>(&user, dust_amount, tron_address)?;
            Ok(())
        }
        
        /// 函数级详细中文注释：完成官方桥接兑换（治理）
        #[pallet::call_index(16)]
        #[pallet::weight(<T as Config>::WeightInfo::complete_swap())]
        pub fn complete_swap(origin: OriginFor<T>, swap_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            crate::bridge::do_complete_swap::<T>(swap_id)
        }
        
        /// 函数级详细中文注释：创建做市商兑换
        #[pallet::call_index(17)]
        #[pallet::weight(<T as Config>::WeightInfo::maker_swap())]
        pub fn maker_swap(
            origin: OriginFor<T>,
            maker_id: u64,
            dust_amount: BalanceOf<T>,
            usdt_address: Vec<u8>,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;
            crate::bridge::do_maker_swap::<T>(&user, maker_id, dust_amount, usdt_address)?;
            Ok(())
        }
        
        /// 函数级详细中文注释：做市商标记兑换完成
        #[pallet::call_index(18)]
        #[pallet::weight(<T as Config>::WeightInfo::maker_swap())]
        pub fn mark_swap_complete(
            origin: OriginFor<T>,
            swap_id: u64,
            trc20_tx_hash: Vec<u8>,
        ) -> DispatchResult {
            let maker = ensure_signed(origin)?;
            crate::bridge::do_mark_swap_complete::<T>(&maker, swap_id, trc20_tx_hash)
        }
        
        /// 函数级详细中文注释：用户举报做市商兑换
        #[pallet::call_index(19)]
        #[pallet::weight(<T as Config>::WeightInfo::report_maker_swap())]
        pub fn report_swap(origin: OriginFor<T>, swap_id: u64) -> DispatchResult {
            let user = ensure_signed(origin)?;
            crate::bridge::do_report_swap::<T>(&user, swap_id)
        }
        
        // ===== 治理函数 =====
        
        /// 函数级详细中文注释：设置桥接账户（治理）
        #[pallet::call_index(20)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn set_bridge_account(origin: OriginFor<T>, account: T::AccountId) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            BridgeAccount::<T>::put(account.clone());
            Self::deposit_event(Event::BridgeAccountSet { account });
            Ok(())
        }
        
        /// 函数级详细中文注释：设置最小兑换金额（治理）
        #[pallet::call_index(21)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn set_min_swap_amount(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            MinSwapAmount::<T>::put(amount);
            Self::deposit_event(Event::MinSwapAmountSet { amount });
            Ok(())
        }
    }

    // ===== Hooks =====

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：每个区块自动执行的清理任务
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let mut weight = Weight::zero();
            
            // 1. 清理过期的 TRON 交易哈希
            weight = weight.saturating_add(Self::clean_expired_tron_tx_hashes(n));
            
            // 2. 清理过期的订单
            weight = weight.saturating_add(Self::clean_expired_orders(n));
            
            // 3. 清理过期的兑换记录
            weight = weight.saturating_add(Self::clean_expired_swaps(n));
            
            weight
        }
        
        /// 函数级详细中文注释：OCW 入口（用于做市商兑换验证）
        fn offchain_worker(block_number: BlockNumberFor<T>) {
            // Bridge OCW 逻辑将在 bridge.rs 中实现
            log::info!("Trading OCW running at block {:?}", block_number);
        }
    }

    // ===== 内部辅助函数 =====

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：清理过期的 TRON 交易哈希
        fn clean_expired_tron_tx_hashes(current_block: BlockNumberFor<T>) -> Weight {
            crate::common::clean_tron_tx_hashes::<T>(current_block)
        }
        
        /// 函数级详细中文注释：清理过期的订单
        fn clean_expired_orders(current_block: BlockNumberFor<T>) -> Weight {
            crate::otc_cleanup::clean_expired_orders::<T>(current_block)
        }
        
        /// 函数级详细中文注释：清理过期的兑换记录
        fn clean_expired_swaps(current_block: BlockNumberFor<T>) -> Weight {
            crate::bridge_cleanup::clean_expired_swaps::<T>(current_block)
        }
        
        // ===== 🆕 查询辅助函数（利用双映射索引，O(1)查询）=====
        
        /// 函数级详细中文注释：获取用户的所有订单ID列表（O(1)查询）
        /// 
        /// **优势**：
        /// - 优化前：需要遍历所有订单，O(n)复杂度
        /// - 优化后：直接读取索引，O(1)复杂度
        /// 
        /// **用途**：
        /// - 前端"我的订单"页面
        /// - 用户订单历史查询
        pub fn get_user_orders(user: &T::AccountId) -> Vec<u64> {
            BuyerOrders::<T>::get(user).into_inner()
        }
        
        /// 函数级详细中文注释：获取做市商的所有订单ID列表（O(1)查询）
        pub fn get_maker_orders(maker_id: u64) -> Vec<u64> {
            MakerOrders::<T>::get(maker_id).into_inner()
        }
        
        /// 函数级详细中文注释：获取用户的所有兑换ID列表（O(1)查询）
        pub fn get_user_swaps(user: &T::AccountId) -> Vec<u64> {
            UserSwaps::<T>::get(user).into_inner()
        }
        
        /// 函数级详细中文注释：获取做市商的所有兑换ID列表（O(1)查询）
        pub fn get_maker_swaps(maker_id: u64) -> Vec<u64> {
            MakerSwapList::<T>::get(maker_id).into_inner()
        }
        
        /// 函数级详细中文注释：获取用户的活跃订单数量（O(1)查询）
        /// 
        /// **用途**：
        /// - 风控：限制用户同时持有的订单数量
        /// - 统计：用户活跃度分析
        pub fn get_user_order_count(user: &T::AccountId) -> u32 {
            BuyerOrders::<T>::get(user).len() as u32
        }
        
        /// 函数级详细中文注释：获取做市商的活跃订单数量（O(1)查询）
        pub fn get_maker_order_count(maker_id: u64) -> u32 {
            MakerOrders::<T>::get(maker_id).len() as u32
        }
        
        /// 函数级详细中文注释：获取用户的活跃兑换数量（O(1)查询）
        pub fn get_user_swap_count(user: &T::AccountId) -> u32 {
            UserSwaps::<T>::get(user).len() as u32
        }
        
        /// 函数级详细中文注释：获取做市商的活跃兑换数量（O(1)查询）
        pub fn get_maker_swap_count(maker_id: u64) -> u32 {
            MakerSwapList::<T>::get(maker_id).len() as u32
        }
    }
}

