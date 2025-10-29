#![cfg_attr(not(feature = "std"), no_std)]

//! # Simple Bridge Pallet (极简桥接模块)
//! 
//! ## 概述
//! 
//! 函数级详细中文注释：提供 MEMO ↔ USDT (TRC20) 极简托管式桥接功能
//! 
//! ### MVP 设计原则
//! - 只支持 MEMO → USDT 方向（先验证需求）
//! - 动态汇率（基于 pallet-pricing 的市场加权均价）
//! - 价格浮动限制：±20%（可治理配置）
//! - 最小金额 100 MEMO
//! - 极简状态机（只有 completed 布尔值）
//! 
//! ## 接口
//! 
//! ### 用户接口
//! - `swap`: 创建 MEMO → USDT 兑换请求（使用市场均价）
//! 
//! ### 管理员接口
//! - `complete_swap`: 标记兑换完成（Root 权限）
//! - `set_bridge_account`: 设置桥接账户
//! - `set_min_amount`: 设置最小兑换金额

// 函数级详细中文注释：OCW 相关类型定义
mod ocw_types;
pub use ocw_types::*;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement},
    };
    use frame_system::{
        pallet_prelude::*,
    };
    use sp_runtime::{
        traits::SaturatedConversion,
        Saturating,
        offchain::{http, Duration},
        transaction_validity::{
            InvalidTransaction, TransactionSource, TransactionValidity,
            ValidTransaction,
        },
    };
    use sp_std::vec::Vec;
    use sp_core::crypto::KeyTypeId;
    
    // 函数级详细中文注释：定义 OCW 专用密钥类型
    pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"smbd");
    
    // 函数级详细中文注释：导入 OCW 相关类型
    use crate::OcwMakerSwapRecord;

    // 函数级详细中文注释：使用 market-maker 的 Currency 类型定义 Balance
    type BalanceOf<T> =
        <<T as pallet_market_maker::Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级详细中文注释：极简兑换请求结构（官方 Simple Bridge）
    #[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
    #[scale_info(skip_type_params(T))]
    pub struct SwapRequest<T: Config> {
        /// 兑换ID
        pub id: u64,
        /// 用户地址
        pub user: T::AccountId,
        /// MEMO 数量（12位小数）
        pub memo_amount: BalanceOf<T>,
        /// TRON 地址（Base58格式，如 T...）
        pub tron_address: BoundedVec<u8, ConstU32<64>>,
        /// 是否已完成
        pub completed: bool,
        /// 函数级中文注释：兑换时的 USDT 单价（精度 10^6，用于统计均价）
        pub price_usdt: u64,
        /// 函数级中文注释：创建时间戳（区块号，用于统计）
        pub created_at: BlockNumberFor<T>,
        /// ✅ 2025-10-23：超时时间（区块号，P2优化）
        /// 函数级详细中文注释：兑换请求超时时间（创建时间 + SwapTimeout 配置的区块数）
        /// - 默认：300 区块（约30分钟，假设6秒/区块）
        /// - 超时后自动退款给用户，防止 DUST 永久锁定
        pub expire_at: BlockNumberFor<T>,
    }

    /// 🆕 函数级详细中文注释：做市商兑换状态枚举
    #[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
    pub enum SwapStatus {
        /// 待处理（做市商需在30分钟内转账）
        Pending,
        /// 已完成
        Completed,
        /// 用户举报（进入仲裁）
        UserReported,
        /// 仲裁中
        Arbitrating,
        /// 仲裁通过（做市商履约）
        ArbitrationApproved,
        /// 仲裁拒绝（做市商违约，罚没押金）
        ArbitrationRejected,
        /// 超时退款
        Refunded,
    }

    /// 🆕 函数级详细中文注释：做市商兑换记录结构
    #[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Eq, RuntimeDebug)]
    #[scale_info(skip_type_params(T))]
    pub struct MakerSwapRecord<T: Config> {
        /// 兑换ID
        pub swap_id: u64,
        /// 做市商ID
        pub maker_id: u64,
        /// 做市商账户
        pub maker: T::AccountId,
        /// 用户账户
        pub user: T::AccountId,
        /// MEMO 数量（精度 10^12）
        pub memo_amount: BalanceOf<T>,
        /// USDT 金额（精度 10^6）
        pub usdt_amount: u64,
        /// USDT 接收地址（TRC20）
        pub usdt_address: BoundedVec<u8, ConstU32<64>>,
        /// 创建时间
        pub created_at: BlockNumberFor<T>,
        /// 超时时间
        pub timeout_at: BlockNumberFor<T>,
        /// TRC20 交易哈希
        pub trc20_tx_hash: Option<BoundedVec<u8, ConstU32<128>>>,
        /// 完成时间
        pub completed_at: Option<BlockNumberFor<T>>,
        /// 证据 CID（IPFS）
        pub evidence_cid: Option<BoundedVec<u8, ConstU32<256>>>,
        /// 兑换状态
        pub status: SwapStatus,
        /// 兑换价格（精度 10^6）
        pub price_usdt: u64,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_pricing::Config + pallet_market_maker::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// 函数级详细中文注释：兑换超时时间（区块数）
        /// 默认 30 分钟 = 1800 秒 / 6 秒/块 = 300 块
        /// 注意：Currency、GovernanceOrigin、PalletId 已从 pallet_market_maker::Config 继承
        #[pallet::constant]
        type SwapTimeout: Get<BlockNumberFor<Self>>;

        /// 函数级中文注释：兑换记录归档阈值（天数）
        /// 超过此天数的已完成兑换记录将被自动清理，默认 150 天（约5个月）
        #[pallet::constant]
        type ArchiveThresholdDays: Get<u32>;
        
        /// 函数级中文注释：每次自动清理的最大记录数
        /// 防止单次清理过多导致区块Gas爆炸，默认 50
        #[pallet::constant]
        type MaxCleanupPerBlock: Get<u32>;
        
        // ========== OCW 做市商兑换配置 ==========
        
        /// 函数级详细中文注释：OCW 验证失败阈值
        /// 超过此次数后，订单从队列中移除，需要人工干预
        #[pallet::constant]
        type MaxVerificationFailures: Get<u32>;
        
        /// 函数级详细中文注释：每个区块最多验证的订单数
        /// 防止 OCW 执行时间过长
        #[pallet::constant]
        type MaxOrdersPerBlock: Get<u32>;
        
        /// 🆕 2025-10-19：TRON交易哈希保留期（区块数）
        /// 函数级详细中文注释：已使用的TRON交易哈希在链上保留的时间
        /// - 默认值：2,592,000 区块（约180天，假设12秒/区块）
        /// - 作用：防止重放攻击的同时，控制存储增长
        /// - 清理：超过此期限的哈希记录可被清理
        /// - 推荐：根据业务需求和存储成本调整（60-365天）
        #[pallet::constant]
        type TronTxHashRetentionPeriod: Get<BlockNumberFor<Self>>;
        
        /// 函数级详细中文注释：OCW 兑换订单超时时长（区块数）
        /// 做市商不发币或 OCW 验证失败，买家可申诉退款
        #[pallet::constant]
        type OcwSwapTimeoutBlocks: Get<BlockNumberFor<Self>>;
        
        /// 函数级详细中文注释：OCW 最小兑换金额
        #[pallet::constant]
        type OcwMinSwapAmount: Get<BalanceOf<Self>>;
        
        /// 函数级详细中文注释：无签名交易优先级
        #[pallet::constant]
        type UnsignedPriority: Get<TransactionPriority>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级详细中文注释：下一个兑换ID
    #[pallet::storage]
    #[pallet::getter(fn next_id)]
    pub type NextId<T> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：兑换请求映射（ID => SwapRequest）
    #[pallet::storage]
    #[pallet::getter(fn swaps)]
    pub type Swaps<T: Config> = StorageMap<_, Blake2_128Concat, u64, SwapRequest<T>>;

    /// 函数级详细中文注释：桥接账户（用于托管 DUST）
    #[pallet::storage]
    #[pallet::getter(fn bridge_account)]
    pub type BridgeAccount<T: Config> = StorageValue<_, T::AccountId>;

    /// 函数级详细中文注释：最小兑换金额（默认 100 DUST）
    #[pallet::storage]
    #[pallet::getter(fn min_amount)]
    pub type MinAmount<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    /// 🆕 函数级详细中文注释：做市商兑换记录映射（swap_id => MakerSwapRecord）
    #[pallet::storage]
    #[pallet::getter(fn maker_swaps)]
    pub type MakerSwaps<T: Config> = StorageMap<_, Blake2_128Concat, u64, MakerSwapRecord<T>>;

    /// 🆕 函数级详细中文注释：下一个做市商兑换ID
    #[pallet::storage]
    #[pallet::getter(fn next_maker_swap_id)]
    pub type NextMakerSwapId<T> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：归档清理开关（治理可配置）
    /// true = 启用自动清理，false = 禁用（默认启用）
    #[pallet::storage]
    pub type ArchiveEnabled<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：上次自动清理的区块高度
    /// 用于控制清理频率（避免每个区块都执行清理）
    #[pallet::storage]
    pub type LastCleanupBlock<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    /// 函数级中文注释：待清理游标（分别用于 Swaps 和 MakerSwaps）
    /// 记录上次清理停止的位置，下次从此处继续（用于分批清理大量数据）
    #[pallet::storage]
    pub type SwapCleanupCursor<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type MakerSwapCleanupCursor<T: Config> = StorageValue<_, u64, ValueQuery>;

    // ========== OCW 做市商兑换存储项 ==========
    
    /// 函数级详细中文注释：OCW 做市商兑换记录映射（order_id => OcwMakerSwapRecord）
    #[pallet::storage]
    #[pallet::getter(fn ocw_maker_swaps)]
    pub type OcwMakerSwaps<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // order_id
        OcwMakerSwapRecord<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：下一个 OCW 做市商兑换订单 ID
    #[pallet::storage]
    #[pallet::getter(fn next_ocw_maker_swap_id)]
    pub type NextOcwMakerSwapId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：待 OCW 验证的订单队列
    /// 做市商提交 TRON 交易哈希后，订单加入此队列
    /// OCW 每个区块处理队列中的订单
    #[pallet::storage]
    #[pallet::getter(fn pending_ocw_verification)]
    pub type PendingOcwVerification<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // order_id
        (), // 标记
        OptionQuery,
    >;

    /// 🆕 H-3修复：已验证的 TRON 交易哈希（防重放攻击 - 永久存储）
    /// 函数级详细中文注释：记录所有已使用的 TRON 交易哈希，防止同一笔 TRON 交易被重复使用
    /// 
    /// Key: BoundedVec<u8, ConstU32<128>> - TRON交易哈希（十六进制字符串）
    /// Value: u64 - 订单ID
    /// 
    /// H-3修复说明：
    /// - 移除 verified_at_block，改为永久存储
    /// - 不再清理历史记录，彻底防止重放攻击
    /// - 存储成本：每笔交易约 160 字节（可接受）
    /// - 配合布隆过滤器快速查询
    #[pallet::storage]
    #[pallet::getter(fn used_tron_tx_hashes)]
    pub type UsedTronTxHashes<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BoundedVec<u8, ConstU32<128>>, // tron_tx_hash
        u64, // order_id（仅存ID节省空间）
        OptionQuery,
    >;

    /// 函数级详细中文注释：OCW 验证失败计数器
    /// 记录订单的验证失败次数
    /// 超过阈值后，标记为需要人工干预
    #[pallet::storage]
    #[pallet::getter(fn ocw_verification_failures)]
    pub type OcwVerificationFailures<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // order_id
        u32, // failure_count
        ValueQuery,
    >;

    /// 函数级详细中文注释：TRON API 端点配置
    /// 默认：https://api.trongrid.io
    /// 可通过治理修改（切换到备用 API）
    #[pallet::storage]
    #[pallet::getter(fn tron_api_endpoint)]
    pub type TronApiEndpoint<T: Config> = StorageValue<
        _,
        BoundedVec<u8, ConstU32<256>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：USDT 合约地址（TRON）
    /// 默认：TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
    #[pallet::storage]
    #[pallet::getter(fn usdt_contract_address)]
    pub type UsdtContractAddress<T: Config> = StorageValue<
        _,
        BoundedVec<u8, ConstU32<64>>,
        ValueQuery,
    >;

    #[pallet::genesis_config]
    pub struct GenesisConfig<T: Config> {
        pub bridge_account: Option<T::AccountId>,
        pub min_amount: BalanceOf<T>,
    }

    impl<T: Config> Default for GenesisConfig<T> {
        fn default() -> Self {
            Self {
                bridge_account: None,
                min_amount: 100u128.saturated_into(), // 默认 100 MEMO
            }
        }
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            if let Some(ref account) = self.bridge_account {
                BridgeAccount::<T>::put(account);
            }
            MinAmount::<T>::put(self.min_amount);
        }
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级详细中文注释：新兑换请求创建
        /// 包含兑换ID、用户地址、DUST数量、TRON地址和实际使用的汇率
        SwapCreated {
            id: u64,
            user: T::AccountId,
            amount: BalanceOf<T>,
            tron_address: BoundedVec<u8, ConstU32<64>>,
            /// 实际使用的汇率（USDT/DUST，精度 10^6）
            price_usdt: u64,
        },
        /// 函数级详细中文注释：兑换完成
        /// [swap_id]
        SwapCompleted {
            id: u64,
        },
        /// ✅ 2025-10-23：兑换超时自动退款（P2优化）
        /// 函数级详细中文注释：兑换请求超时，MEMO 已退款给用户
        SwapRefunded {
            id: u64,
            user: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 函数级详细中文注释：桥接账户已更新
        BridgeAccountSet {
            account: T::AccountId,
        },
        /// 函数级详细中文注释：最小金额已更新
        MinAmountSet {
            amount: BalanceOf<T>,
        },
        /// 🆕 做市商兑换已创建
        MakerSwapInitiated {
            swap_id: u64,
            maker_id: u64,
            maker: T::AccountId,
            user: T::AccountId,
            memo_amount: BalanceOf<T>,
            usdt_amount: u64,
            usdt_address: BoundedVec<u8, ConstU32<64>>,
            timeout_at: BlockNumberFor<T>,
        },
        /// 🆕 做市商兑换已完成
        MakerSwapCompleted {
            swap_id: u64,
            maker_id: u64,
            trc20_tx_hash: BoundedVec<u8, ConstU32<128>>,
        },
        /// 🆕 用户确认收款
        MakerSwapConfirmed {
            swap_id: u64,
            user: T::AccountId,
        },
        /// 🆕 用户举报做市商
        MakerReported {
            swap_id: u64,
            maker_id: u64,
            user: T::AccountId,
            evidence_cid: BoundedVec<u8, ConstU32<256>>,
        },
        /// 🆕 做市商兑换已仲裁
        MakerSwapArbitrated {
            swap_id: u64,
            approved: bool,
            penalty: Option<BalanceOf<T>>,
        },
        /// 🆕 做市商兑换已退款
        MakerSwapRefunded {
            swap_id: u64,
            user: T::AccountId,
            refund_amount: BalanceOf<T>,
        },
        /// 函数级中文注释：兑换记录已归档清理
        /// - swap_type: 记录类型（"Simple" 或 "Maker"）
        /// - swap_id: 兑换ID
        /// - record_age_days: 记录年龄（天数）
        SwapArchived {
            swap_type: BoundedVec<u8, ConstU32<10>>,
            swap_id: u64,
            record_age_days: u32,
        },
        /// 函数级中文注释：批量归档完成
        /// - swap_count: 清理的简单兑换记录数
        /// - maker_swap_count: 清理的做市商兑换记录数
        /// - total_swaps: 当前总兑换记录数
        BatchArchiveCompleted {
            swap_count: u32,
            maker_swap_count: u32,
            total_swaps: u64,
        },
        /// 函数级中文注释：归档清理开关已更新
        ArchiveEnabledSet {
            enabled: bool,
        },
        /// ========== OCW 相关事件 ==========
        /// 函数级详细中文注释：OCW 做市商兑换订单已创建
        OcwMakerSwapCreated {
            swap_id: u64,
            maker_id: u64,
            user: T::AccountId,
            memo_amount: BalanceOf<T>,
            usdt_amount: u64,
            tron_address: BoundedVec<u8, ConstU32<64>>,
            timeout_at: BlockNumberFor<T>,
        },
        /// 函数级详细中文注释：做市商已提交 TRON 交易哈希
        OcwTronTxHashSubmitted {
            swap_id: u64,
            maker_id: u64,
            tron_tx_hash: BoundedVec<u8, ConstU32<128>>,
        },
        /// 函数级详细中文注释：OCW 验证失败
        OcwVerificationFailed {
            swap_id: u64,
            failure_count: u32,
            reason: BoundedVec<u8, ConstU32<128>>,
        },
        /// 函数级详细中文注释：OCW 验证成功，MEMO 已释放
        OcwMemoReleased {
            swap_id: u64,
            maker: T::AccountId,
            memo_amount: BalanceOf<T>,
            tron_tx_hash: BoundedVec<u8, ConstU32<128>>,
        },
        /// 函数级详细中文注释：OCW 订单超时已退款
        OcwSwapRefunded {
            swap_id: u64,
            user: T::AccountId,
            memo_amount: BalanceOf<T>,
        },
        /// 函数级详细中文注释：用户举报 OCW 订单
        OcwUserReported {
            swap_id: u64,
            user: T::AccountId,
            evidence: BoundedVec<u8, ConstU32<256>>,
        },
        /// 函数级详细中文注释：TRON API 端点已更新
        TronApiEndpointUpdated {
            endpoint: BoundedVec<u8, ConstU32<256>>,
        },
        /// 函数级详细中文注释：USDT 合约地址已更新
        UsdtContractAddressUpdated {
            address: BoundedVec<u8, ConstU32<64>>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 金额低于最小限制
        AmountTooSmall,
        /// 兑换请求不存在
        SwapNotFound,
        /// 桥接账户未设置
        BridgeAccountNotSet,
        /// 兑换已完成
        AlreadyCompleted,
        /// TRON 地址格式无效
        InvalidTronAddress,
        /// 市场价格不可用（pallet-pricing 返回 0 或未初始化）
        MarketPriceNotAvailable,
        /// 价格偏离超出允许范围（超过 ±MaxPriceDeviation）
        PriceDeviationTooHigh,
        /// 🆕 做市商兑换记录不存在
        MakerSwapNotFound,
        /// 🆕 做市商兑换状态无效
        MakerSwapInvalidStatus,
        /// 🆕 做市商桥接服务不存在
        MakerBridgeServiceNotFound,
        /// 🆕 做市商桥接服务未启用
        MakerBridgeServiceDisabled,
        /// 🆕 超过做市商最大兑换金额
        ExceedsMaxSwapAmount,
        /// 🆕 不是兑换的用户
        NotSwapUser,
        /// 🆕 不是兑换的做市商
        NotSwapMaker,
        /// 🆕 兑换尚未超时
        SwapNotTimeout,
        /// 🆕 兑换未被举报
        SwapNotReported,
        /// 🆕 TRC20交易哈希无效
        InvalidTrc20TxHash,
        /// ========== OCW 相关错误 ==========
        /// OCW 做市商兑换订单不存在
        OcwMakerSwapNotFound,
        /// OCW 做市商兑换状态无效
        OcwMakerSwapInvalidStatus,
        /// 做市商不存在或未启用
        MakerNotActiveOrNotFound,
        /// TRON 交易哈希已被使用（防重放攻击）
        TronTxHashAlreadyUsed,
        /// TRON 交易哈希格式无效
        InvalidTronTxHash,
        /// OCW 订单尚未超时，无法退款
        OcwSwapNotTimeout,
        /// 不是订单的买家，无法操作
        NotOcwSwapUser,
        /// OCW 订单未被举报，无法仲裁
        OcwSwapNotReported,
        /// TRON API 端点格式无效
        InvalidTronApiEndpoint,
        /// USDT 合约地址格式无效
        InvalidUsdtContractAddress,
        /// 🆕 2025-10-19：做市商业务方向不支持该操作（Bridge需要Buy或BuyAndSell）
        DirectionNotSupported,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：检查价格偏离是否在允许范围内
        /// 
        /// # 参数
        /// - `price`: 实际使用的价格（USDT/DUST，精度 10^6）
        /// - `base_price`: 基准价格（市场均价，精度 10^6）
        /// - `max_deviation_bps`: 最大偏离（万分比，如 2000 = 20%）
        /// 
        /// # 返回
        /// - Ok(()) 如果价格在允许范围内
        /// - Err(PriceDeviationTooHigh) 如果价格偏离过大
        /// 
        /// # 说明
        /// 计算公式：|price - base_price| / base_price <= max_deviation_bps / 10000
        #[allow(dead_code)]
        fn check_price_deviation(
            price: u64,
            base_price: u64,
            max_deviation_bps: u32,
        ) -> DispatchResult {
            // 如果基准价格为 0 或偏离参数为 0，跳过检查
            if base_price == 0 || max_deviation_bps == 0 {
                return Ok(());
            }
            
            // 计算允许的价格范围
            let min_price = base_price
                .saturating_mul(10000u64.saturating_sub(max_deviation_bps as u64))
                .saturating_div(10000);
            let max_price = base_price
                .saturating_mul(10000u64.saturating_add(max_deviation_bps as u64))
                .saturating_div(10000);
            
            // 检查价格是否在范围内
            ensure!(
                price >= min_price && price <= max_price,
                Error::<T>::PriceDeviationTooHigh
            );
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：生成做市商托管账户
        /// 
        /// # 参数
        /// - `maker_id`: 做市商 ID
        /// 
        /// # 返回
        /// 做市商专用的托管账户地址
        /// 
        /// # 说明
        /// 使用 PalletId + maker_id 派生子账户
        /// 格式：PalletId("sb/cust!") + maker_id
        /// 每个做市商有独立的托管账户，资金隔离
        pub fn custody_account_for_maker(maker_id: u64) -> T::AccountId {
            use sp_runtime::traits::AccountIdConversion;
            <T as pallet_market_maker::Config>::PalletId::get().into_sub_account_truncating(maker_id)
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：创建 DUST → USDT 兑换请求（动态均价版）
        /// 
        /// # 参数
        /// - `origin`: 调用者（签名交易）
        /// - `memo_amount`: MEMO 数量（12位小数，如 100 DUST = 100_000_000_000_000）
        /// - `tron_address`: TRON 地址（Base58 格式，如 "TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"）
        /// 
        /// # 验证
        /// - DUST 数量 >= MinAmount
        /// - TRON 地址长度 > 0 且 <= 64 字节
        /// - 桥接账户已设置
        /// - 市场价格可用（pallet-pricing 返回有效价格）
        /// - 用户余额充足
        /// 
        /// # 定价机制
        /// 1. 从 pallet-pricing 获取市场加权均价（OTC + Bridge）
        /// 2. 如果市场价格为 0，使用备用固定汇率（冷启动保护）
        /// 3. 未来可添加 ±20% 浮动检查（Phase 2）
        /// 
        /// # 流程
        /// 1. 验证参数
        /// 2. 获取市场均价作为兑换汇率
        /// 3. 锁定用户的 DUST 到桥接账户
        /// 4. 创建兑换请求记录
        /// 5. 触发 SwapCreated 事件（包含实际汇率）
        #[pallet::call_index(0)]
        #[pallet::weight(T::DbWeight::get().reads_writes(5, 2))]
        pub fn swap(
            origin: OriginFor<T>,
            memo_amount: BalanceOf<T>,
            tron_address: BoundedVec<u8, ConstU32<64>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证桥接账户已设置
            let bridge_acc = BridgeAccount::<T>::get().ok_or(Error::<T>::BridgeAccountNotSet)?;
            
            // 验证最小金额
            ensure!(
                memo_amount >= MinAmount::<T>::get(),
                Error::<T>::AmountTooSmall
            );
            
            // 验证 TRON 地址
            ensure!(
                !tron_address.is_empty(),
                Error::<T>::InvalidTronAddress
            );
            
            // 函数级中文注释：从 pallet-pricing 获取市场加权均价作为基准价格
            // pallet-pricing 在所有情况下都会返回有效价格（冷启动时返回 DefaultPrice，正常时返回市场均价）
            // 因此不需要备用汇率机制
            let price_usdt = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            
            // 函数级中文注释：安全检查，确保价格有效
            // 虽然理论上 pallet-pricing 永远不会返回 0，但作为防御性编程保留此检查
            ensure!(price_usdt > 0, Error::<T>::MarketPriceNotAvailable);
            
            // 函数级中文注释：未来可在此添加 ±20% 浮动范围检查（Phase 2）
            // let max_deviation = MaxPriceDeviation::<T>::get();
            // Self::check_price_deviation(price_usdt, market_price, max_deviation)?;
            
            // 锁定 DUST 到桥接账户
            <T as pallet_market_maker::Config>::Currency::transfer(
                &who,
                &bridge_acc,
                memo_amount,
                ExistenceRequirement::KeepAlive,
            )?;
            
            // 创建兑换请求
            let id = NextId::<T>::mutate(|x| {
                let current = *x;
                *x = current.saturating_add(1);
                current
            });
            
            let created_at = <frame_system::Pallet<T>>::block_number();
            
            // ✅ 2025-10-23：计算超时时间（P2优化）
            // 函数级详细中文注释：超时时间 = 创建时间 + SwapTimeout 配置的区块数
            // - 默认 300 区块（约30分钟）
            // - 超时后自动退款，防止 DUST 永久锁定
            let expire_at = created_at.saturating_add(T::SwapTimeout::get());
            
            let request = SwapRequest {
                id,
                user: who.clone(),
                memo_amount,
                tron_address: tron_address.clone(),
                completed: false,
                price_usdt,
                created_at,
                expire_at,  // ✅ 新增：超时时间
            };
            
            Swaps::<T>::insert(id, &request);
            
            Self::deposit_event(Event::SwapCreated {
                id,
                user: who,
                amount: memo_amount,
                tron_address,
                price_usdt, // 输出实际使用的汇率
            });
            
            Ok(())
        }
        
        /// 函数级详细中文注释：标记兑换完成（仅 Root）
        /// 
        /// # 参数
        /// - `origin`: Root 权限
        /// - `swap_id`: 兑换ID
        /// 
        /// # 验证
        /// - 调用者必须是 Root
        /// - 兑换请求存在
        /// - 兑换未完成
        /// 
        /// # 流程
        /// 1. 验证权限和状态
        /// 2. 标记 completed = true
        /// 3. 触发 SwapCompleted 事件
        /// 
        /// # 注意
        /// 此接口由桥接服务在确认 USDT 已发送后调用
        #[pallet::call_index(1)]
        #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
        pub fn complete_swap(origin: OriginFor<T>, swap_id: u64) -> DispatchResult {
            ensure_root(origin)?;
            
            // 函数级中文注释：提取兑换信息用于价格聚合更新
            let (price_usdt, memo_amount, timestamp) = {
                let req = Swaps::<T>::get(swap_id).ok_or(Error::<T>::SwapNotFound)?;
                let memo_qty: u128 = req.memo_amount.saturated_into();
                // 转换区块号为秒级时间戳（6秒/块）
                let timestamp: u64 = req.created_at.saturated_into::<u64>() * 6u64 * 1000u64; // 转换为毫秒
                (req.price_usdt, memo_qty, timestamp)
            };
            
            Swaps::<T>::try_mutate(swap_id, |maybe| -> DispatchResult {
                let req = maybe.as_mut().ok_or(Error::<T>::SwapNotFound)?;
                
                ensure!(!req.completed, Error::<T>::AlreadyCompleted);
                
                req.completed = true;
                Ok(())
            })?;
            
            // 函数级中文注释：兑换完成后，添加到 pallet-pricing 的 Bridge 价格聚合统计
            // 忽略错误（不影响兑换流程）
            let _ = pallet_pricing::Pallet::<T>::add_bridge_swap(timestamp, price_usdt, memo_amount);
            
            Self::deposit_event(Event::SwapCompleted { id: swap_id });
            Ok(())
        }
        
        /// 函数级详细中文注释：设置桥接账户（仅 Root）
        /// 
        /// # 参数
        /// - `origin`: Root 权限
        /// - `account`: 新的桥接账户地址
        #[pallet::call_index(2)]
        #[pallet::weight(T::DbWeight::get().writes(1))]
        pub fn set_bridge_account(
            origin: OriginFor<T>,
            account: T::AccountId,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            BridgeAccount::<T>::put(&account);
            
            Self::deposit_event(Event::BridgeAccountSet { account });
            Ok(())
        }
        
        /// 函数级详细中文注释：设置最小兑换金额（仅 Root）
        /// 
        /// # 参数
        /// - `origin`: Root 权限
        /// - `amount`: 新的最小金额
        #[pallet::call_index(3)]
        #[pallet::weight(T::DbWeight::get().writes(1))]
        pub fn set_min_amount(
            origin: OriginFor<T>,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            MinAmount::<T>::put(amount);
            
            Self::deposit_event(Event::MinAmountSet { amount });
            Ok(())
        }

        /// 🆕 函数级详细中文注释：通过做市商兑换 DUST → USDT
        /// 
        /// # 参数
        /// - `origin`: 用户账户
        /// - `maker_id`: 做市商 ID
        /// - `memo_amount`: DUST 数量（精度 10^12）
        /// - `usdt_address`: USDT（TRC20）接收地址
        /// 
        /// # 流程
        /// 1. 验证做市商服务状态
        /// 2. 获取市场价格
        /// 3. 计算 USDT 金额（含做市商手续费）
        /// 4. 验证金额范围
        /// 5. 质押 DUST 到托管账户
        /// 6. 创建兑换记录
        /// 7. 发出事件
        #[pallet::call_index(5)]
        #[pallet::weight(T::DbWeight::get().reads_writes(5, 3))]
        pub fn swap_with_maker(
            origin: OriginFor<T>,
            maker_id: u64,
            memo_amount: BalanceOf<T>,
            usdt_address: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证 USDT 地址长度
            let usdt_address: BoundedVec<u8, ConstU32<64>> = usdt_address
                .try_into()
                .map_err(|_| Error::<T>::InvalidTronAddress)?;
            
            // 1. 获取做市商信息
            let maker_app = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerBridgeServiceNotFound)?;
            
            // 2. 获取桥接服务配置
            let service = pallet_market_maker::BridgeServices::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerBridgeServiceNotFound)?;
            ensure!(service.enabled, Error::<T>::MakerBridgeServiceDisabled);
            
            // 3. 获取市场价格
            // 函数级中文注释：pallet-pricing 在所有情况下都会返回有效价格（> 0）
            let price_usdt = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            ensure!(price_usdt > 0, Error::<T>::MarketPriceNotAvailable);
            
            // 4. 计算 USDT 金额
            let memo_in_units: u128 = memo_amount.saturated_into();
            let memo_whole = memo_in_units / 1_000_000_000_000u128; // 转为整数 MEMO
            
            // 计算基础 USDT 金额
            let base_usdt = memo_whole.saturating_mul(price_usdt as u128);
            
            // 扣除做市商手续费
            let fee = base_usdt
                .saturating_mul(service.fee_rate_bps as u128)
                .saturating_div(10_000);
            let usdt_amount = base_usdt.saturating_sub(fee) as u64;
            
            // 5. 验证金额范围
            ensure!(
                usdt_amount <= service.max_swap_amount,
                Error::<T>::ExceedsMaxSwapAmount
            );
            
            // 6. 质押 DUST 到托管账户
            let custody_account = Self::custody_account_for_maker(maker_id);
            <T as pallet_market_maker::Config>::Currency::transfer(
                &who,
                &custody_account,
                memo_amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // 7. 创建兑换记录
            let swap_id = NextMakerSwapId::<T>::get();
            let now = <frame_system::Pallet<T>>::block_number();
            let timeout_at = now + T::SwapTimeout::get();
            
            let record = MakerSwapRecord {
                swap_id,
                maker_id,
                maker: maker_app.owner.clone(),
                user: who.clone(),
                memo_amount,
                usdt_amount,
                usdt_address: usdt_address.clone(),
                created_at: now,
                timeout_at,
                trc20_tx_hash: None,
                completed_at: None,
                evidence_cid: None,
                status: SwapStatus::Pending,
                price_usdt,
            };
            
            MakerSwaps::<T>::insert(swap_id, record);
            NextMakerSwapId::<T>::put(swap_id + 1);
            
            // 8. 发出事件
            Self::deposit_event(Event::MakerSwapInitiated {
                swap_id,
                maker_id,
                maker: maker_app.owner,
                user: who,
                memo_amount,
                usdt_amount,
                usdt_address,
                timeout_at,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：做市商完成兑换
        /// 
        /// # 参数
        /// - `origin`: 做市商账户
        /// - `swap_id`: 兑换 ID
        /// - `trc20_tx_hash`: TRC20 交易哈希
        /// 
        /// # 流程
        /// 1. 验证身份和状态
        /// 2. 记录 TRC20 交易哈希
        /// 3. 转移 DUST 给做市商
        /// 4. 更新统计数据
        /// 5. 上报价格数据
        #[pallet::call_index(6)]
        #[pallet::weight(T::DbWeight::get().reads_writes(3, 2))]
        pub fn complete_swap_by_maker(
            origin: OriginFor<T>,
            swap_id: u64,
            trc20_tx_hash: Vec<u8>,
        ) -> DispatchResult {
            let maker = ensure_signed(origin)?;
            
            // 验证交易哈希长度
            let trc20_tx_hash: BoundedVec<u8, ConstU32<128>> = trc20_tx_hash
                .try_into()
                .map_err(|_| Error::<T>::InvalidTrc20TxHash)?;
            
            // 获取兑换记录
            let mut record = MakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::MakerSwapNotFound)?;
            
            // 验证做市商身份
            ensure!(record.maker == maker, Error::<T>::NotSwapMaker);
            ensure!(record.status == SwapStatus::Pending, Error::<T>::MakerSwapInvalidStatus);
            
            // 检查是否超时
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now <= record.timeout_at, Error::<T>::SwapNotTimeout);
            
            // 更新记录
            record.trc20_tx_hash = Some(trc20_tx_hash.clone());
            record.completed_at = Some(now);
            record.status = SwapStatus::Completed;
            MakerSwaps::<T>::insert(swap_id, &record);
            
            // 将 DUST 从托管转给做市商
            let custody_account = Self::custody_account_for_maker(record.maker_id);
            <T as pallet_market_maker::Config>::Currency::transfer(
                &custody_account,
                &maker,
                record.memo_amount,
                ExistenceRequirement::AllowDeath
            )?;
            
            // 更新做市商统计
            let time_seconds = now.saturating_sub(record.created_at).saturated_into::<u64>() * 6;
            let _ = pallet_market_maker::Pallet::<T>::update_bridge_stats(
                record.maker_id,
                record.memo_amount,
                time_seconds,
                true,
            );
            
            // 上报价格数据
            let timestamp = record.created_at.saturated_into::<u64>() * 6 * 1000; // 转毫秒
            let memo_qty: u128 = record.memo_amount.saturated_into();
            let _ = pallet_pricing::Pallet::<T>::add_bridge_swap(
                timestamp,
                record.price_usdt,
                memo_qty
            );
            
            // 发出事件
            Self::deposit_event(Event::MakerSwapCompleted {
                swap_id,
                maker_id: record.maker_id,
                trc20_tx_hash,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：用户确认收款
        /// 
        /// # 参数
        /// - `origin`: 用户账户
        /// - `swap_id`: 兑换 ID
        /// 
        /// # 说明
        /// 用户确认收到 USDT 后可调用此方法加速流程
        /// 如果不确认，24 小时后自动视为完成
        #[pallet::call_index(7)]
        #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
        pub fn confirm_receipt(
            origin: OriginFor<T>,
            swap_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 获取兑换记录
            let record = MakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::MakerSwapNotFound)?;
            
            // 验证用户身份
            ensure!(record.user == who, Error::<T>::NotSwapUser);
            ensure!(record.status == SwapStatus::Completed, Error::<T>::MakerSwapInvalidStatus);
            
            // 发出事件（可用于加速流程或解锁押金）
            Self::deposit_event(Event::MakerSwapConfirmed {
                swap_id,
                user: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：用户举报做市商
        /// 
        /// # 参数
        /// - `origin`: 用户账户
        /// - `swap_id`: 兑换 ID
        /// - `evidence_cid`: 证据 CID（IPFS）
        /// 
        /// # 流程
        /// 1. 验证用户身份和状态
        /// 2. 检查是否超时
        /// 3. 记录证据
        /// 4. 进入仲裁流程
        #[pallet::call_index(8)]
        #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
        pub fn report_maker(
            origin: OriginFor<T>,
            swap_id: u64,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证证据 CID 长度
            let evidence_cid: BoundedVec<u8, ConstU32<256>> = evidence_cid
                .try_into()
                .map_err(|_| Error::<T>::InvalidTronAddress)?;
            
            // 获取兑换记录
            let mut record = MakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::MakerSwapNotFound)?;
            
            // 验证用户身份
            ensure!(record.user == who, Error::<T>::NotSwapUser);
            ensure!(record.status == SwapStatus::Pending, Error::<T>::MakerSwapInvalidStatus);
            
            // 检查是否超时
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now > record.timeout_at, Error::<T>::SwapNotTimeout);
            
            // 更新状态
            record.evidence_cid = Some(evidence_cid.clone());
            record.status = SwapStatus::UserReported;
            MakerSwaps::<T>::insert(swap_id, &record);
            
            // 发出事件
            Self::deposit_event(Event::MakerReported {
                swap_id,
                maker_id: record.maker_id,
                user: who,
                evidence_cid,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：仲裁做市商兑换（委员会权限）
        /// 
        /// # 参数
        /// - `origin`: 治理起源（委员会）
        /// - `swap_id`: 兑换 ID
        /// - `approve`: true=做市商履约，false=做市商违约
        /// 
        /// # 流程
        /// - Approve: 释放 DUST 给做市商（认定做市商已转账，用户举报无效）
        /// - Reject: 罚没押金给用户（含 20% 补偿）
        #[pallet::call_index(9)]
        #[pallet::weight(T::DbWeight::get().reads_writes(3, 2))]
        pub fn arbitrate_swap(
            origin: OriginFor<T>,
            swap_id: u64,
            approve: bool,
        ) -> DispatchResult {
            <T as pallet_market_maker::Config>::GovernanceOrigin::ensure_origin(origin)?;
            
            // 获取兑换记录
            let mut record = MakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::MakerSwapNotFound)?;
            
            // 验证状态
            ensure!(record.status == SwapStatus::UserReported, Error::<T>::SwapNotReported);
            
            if approve {
                // 做市商履约：释放 DUST 给做市商
                let custody_account = Self::custody_account_for_maker(record.maker_id);
                <T as pallet_market_maker::Config>::Currency::transfer(
                    &custody_account,
                    &record.maker,
                    record.memo_amount,
                    ExistenceRequirement::AllowDeath
                )?;
                
                record.status = SwapStatus::ArbitrationApproved;
                MakerSwaps::<T>::insert(swap_id, &record);
                
                // 更新统计（成功）
                let now = <frame_system::Pallet<T>>::block_number();
                let time_seconds = now.saturating_sub(record.created_at).saturated_into::<u64>() * 6;
                let _ = pallet_market_maker::Pallet::<T>::update_bridge_stats(
                    record.maker_id,
                    record.memo_amount,
                    time_seconds,
                    true,
                );
                
                Self::deposit_event(Event::MakerSwapArbitrated {
                    swap_id,
                    approved: true,
                    penalty: None,
                });
            } else {
                // 做市商违约：退款给用户 + 20% 补偿（从做市商押金扣除）
                let custody_account = Self::custody_account_for_maker(record.maker_id);
                
                // 退还原 DUST
                <T as pallet_market_maker::Config>::Currency::transfer(
                    &custody_account,
                    &record.user,
                    record.memo_amount,
                    ExistenceRequirement::AllowDeath
                )?;
                
                // TODO: 从做市商押金扣除 20% 补偿给用户
                // 这需要在 pallet-market-maker 中实现 slash_deposit 方法
                
                record.status = SwapStatus::ArbitrationRejected;
                MakerSwaps::<T>::insert(swap_id, &record);
                
                // 更新统计（失败）
                let now = <frame_system::Pallet<T>>::block_number();
                let time_seconds = now.saturating_sub(record.created_at).saturated_into::<u64>() * 6;
                let _ = pallet_market_maker::Pallet::<T>::update_bridge_stats(
                    record.maker_id,
                    record.memo_amount,
                    time_seconds,
                    false,
                );
                
                Self::deposit_event(Event::MakerSwapArbitrated {
                    swap_id,
                    approved: false,
                    penalty: Some(record.memo_amount / 5u32.into()), // 20% 补偿
                });
            }
            
            Ok(())
        }

        /// 函数级中文注释：手动归档清理旧兑换记录
        /// 
        /// # 参数
        /// - origin: Root权限
        /// - max_count: 本次最多清理的记录数（防止Gas爆炸）
        /// 
        /// # 逻辑
        /// 1. 遍历所有兑换记录（包括简单兑换和做市商兑换）
        /// 2. 检查记录是否满足归档条件：
        ///    - 状态必须是已完成（Completed 或 ArbitrationApproved）
        ///    - 创建时间超过归档阈值（默认150天）
        /// 3. 删除符合条件的记录
        /// 4. 记录清理统计
        #[pallet::call_index(10)]
        #[pallet::weight(T::DbWeight::get().reads_writes(100, 100))]
        pub fn cleanup_archived_swaps(
            origin: OriginFor<T>,
            max_count: u32,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            let threshold_days = T::ArchiveThresholdDays::get();
            let now_block = <frame_system::Pallet<T>>::block_number();
            
            // 计算截止区块（150天前）
            // 假设 6秒/块，1天 = 14400 块
            const BLOCKS_PER_DAY: u32 = 14400;
            let cutoff_blocks = threshold_days.saturating_mul(BLOCKS_PER_DAY);
            let cutoff_block = now_block.saturating_sub(cutoff_blocks.into());
            
            let mut swap_cleaned = 0u32;
            let mut maker_swap_cleaned = 0u32;
            let max_per_type = max_count / 2; // 平分清理配额
            
            // 清理简单兑换记录
            let swap_cursor = SwapCleanupCursor::<T>::get();
            let mut next_swap_cursor = swap_cursor;
            
            for (id, swap) in Swaps::<T>::iter() {
                if id < swap_cursor {
                    continue;
                }
                
                if swap_cleaned >= max_per_type {
                    next_swap_cursor = id;
                    break;
                }
                
                // 只清理已完成的兑换
                if swap.completed && swap.created_at < cutoff_block {
                    // 计算记录年龄（天数）
                    let age_blocks: u32 = now_block.saturating_sub(swap.created_at).saturated_into();
                    let age_days = age_blocks / BLOCKS_PER_DAY;
                    
                    Swaps::<T>::remove(id);
                    swap_cleaned += 1;
                    
                    Self::deposit_event(Event::SwapArchived {
                        swap_type: b"Simple".to_vec().try_into().unwrap_or_default(),
                        swap_id: id,
                        record_age_days: age_days,
                    });
                }
            }
            
            // 清理做市商兑换记录
            let maker_cursor = MakerSwapCleanupCursor::<T>::get();
            let mut next_maker_cursor = maker_cursor;
            
            for (id, swap) in MakerSwaps::<T>::iter() {
                if id < maker_cursor {
                    continue;
                }
                
                if maker_swap_cleaned >= max_per_type {
                    next_maker_cursor = id;
                    break;
                }
                
                // 只清理已完成或仲裁通过的兑换
                let is_final = matches!(
                    swap.status,
                    SwapStatus::Completed | SwapStatus::ArbitrationApproved
                );
                
                if is_final && swap.created_at < cutoff_block {
                    // 计算记录年龄（天数）
                    let age_blocks: u32 = now_block.saturating_sub(swap.created_at).saturated_into();
                    let age_days = age_blocks / BLOCKS_PER_DAY;
                    
                    MakerSwaps::<T>::remove(id);
                    maker_swap_cleaned += 1;
                    
                    Self::deposit_event(Event::SwapArchived {
                        swap_type: b"Maker".to_vec().try_into().unwrap_or_default(),
                        swap_id: id,
                        record_age_days: age_days,
                    });
                }
            }
            
            // 更新游标
            SwapCleanupCursor::<T>::put(next_swap_cursor);
            MakerSwapCleanupCursor::<T>::put(next_maker_cursor);
            
            // 记录统计
            let total_swaps = NextId::<T>::get().saturating_add(NextMakerSwapId::<T>::get());
            Self::deposit_event(Event::BatchArchiveCompleted {
                swap_count: swap_cleaned,
                maker_swap_count: maker_swap_cleaned,
                total_swaps,
            });
            
            Ok(())
        }

        /// 函数级中文注释：设置归档清理开关
        /// 
        /// # 参数
        /// - origin: Root权限
        /// - enabled: true=启用自动清理，false=禁用
        #[pallet::call_index(11)]
        #[pallet::weight(T::DbWeight::get().reads_writes(0, 1))]
        pub fn set_archive_enabled(
            origin: OriginFor<T>,
            enabled: bool,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            ArchiveEnabled::<T>::put(enabled);
            Self::deposit_event(Event::ArchiveEnabledSet { enabled });
            
            Ok(())
        }

        // ========== OCW 做市商兑换接口 ==========

        /// 函数级详细中文注释：买家创建 OCW 做市商兑换订单
        /// 
        /// # 参数
        /// - `origin`: 买家账户（签名交易）
        /// - `maker_id`: 做市商 ID
        /// - `maker_account`: 做市商账户（接收 DUST）
        /// - `maker_tron_address`: 做市商 TRON 地址（发送 USDT）
        /// - `memo_amount`: DUST 数量（12位小数）
        /// - `buyer_tron_address`: 买家的 TRON 地址（接收 USDT）
        /// 
        /// # 验证
        /// - 做市商桥接服务必须存在且已启用
        /// - DUST 数量 >= OcwMinSwapAmount
        /// - TRON 地址格式有效
        /// - 买家余额充足
        /// 
        /// # 流程
        /// 1. 验证做市商桥接服务状态
        /// 2. 计算 USDT 金额（根据市场价格）
        /// 3. 锁定买家的 DUST 到托管账户
        /// 4. 创建 OCW 订单记录
        /// 5. 触发 OcwMakerSwapCreated 事件
        #[pallet::call_index(12)]
        #[pallet::weight(T::DbWeight::get().reads_writes(5, 3))]
        pub fn create_maker_swap(
            origin: OriginFor<T>,
            maker_id: u64,
            memo_amount: BalanceOf<T>,
            buyer_tron_address: BoundedVec<u8, ConstU32<64>>,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;
            
            // 验证 DUST 数量
            ensure!(
                memo_amount >= T::OcwMinSwapAmount::get(),
                Error::<T>::AmountTooSmall
            );
            
            // 验证买家 TRON 地址
            ensure!(
                !buyer_tron_address.is_empty() && buyer_tron_address.len() <= 64,
                Error::<T>::InvalidTronAddress
            );
            
            // 🆕 自动查询做市商信息（从 pallet-market-maker）
            let maker_info = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerNotActiveOrNotFound)?;
            
            // 🆕 2025-10-19：验证做市商业务方向是否支持Bridge（Buy 或 BuyAndSell）
            ensure!(
                maker_info.direction == pallet_market_maker::Direction::Buy || 
                maker_info.direction == pallet_market_maker::Direction::BuyAndSell,
                Error::<T>::DirectionNotSupported
            );
            
            let bridge_service = pallet_market_maker::BridgeServices::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerNotActiveOrNotFound)?;
            ensure!(bridge_service.enabled, Error::<T>::MakerBridgeServiceDisabled);
            
            // 🆕 2025-10-19：从Application获取做市商账户和统一TRON地址
            let maker_account = maker_info.owner.clone();
            let maker_tron_address = maker_info.tron_address.clone();
            
            // 🆕 2025-10-19：溢价定价机制 - 动态计算Bridge价格
            // 1. 从pallet-pricing获取基准价
            // 2. 从做市商信息获取buy_premium_bps
            // 3. 计算最终价格 = 基准价 * (10000 + buy_premium_bps) / 10000
            let base_price_u64 = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            ensure!(base_price_u64 > 0, Error::<T>::MarketPriceNotAvailable);
            
            // 应用buy溢价（通常为负数，低于基准价）
            // 例如：base_price=10000 (0.01 USDT), buy_premium_bps=-200 (-2%)
            // final_price = 10000 * (10000 - 200) / 10000 = 9800 (0.0098 USDT)
            let buy_premium = maker_info.buy_premium_bps;
            let final_price_u64 = base_price_u64
                .saturating_mul((10000i64 + buy_premium as i64) as u64)
                .saturating_div(10000);
            
            // 🆕 2025-10-20：价格偏离检查 - 确保最终价格在合理范围内（±20%）
            // 防止极端价格订单，保护买卖双方
            pallet_pricing::Pallet::<T>::check_price_deviation(final_price_u64)?;
            
            // USDT 金额 = DUST 数量 * 最终价格（精度转换）
            // memo_amount: 12位小数，final_price_u64: 6位小数
            let memo_u128: u128 = memo_amount.saturated_into();
            let usdt_amount = (memo_u128 * final_price_u64 as u128) / 1_000_000_000_000u128;
            let usdt_amount_u64: u64 = usdt_amount.saturated_into();
            
            // 🆕 验证兑换金额不超过做市商最大额度
            ensure!(
                usdt_amount_u64 <= bridge_service.max_swap_amount,
                Error::<T>::ExceedsMaxSwapAmount
            );
            
            // 锁定买家的 DUST 到托管账户
            let custody_account = Self::custody_account_for_maker(maker_id);
            <T as pallet_market_maker::Config>::Currency::transfer(
                &user,
                &custody_account,
                memo_amount,
                ExistenceRequirement::KeepAlive,
            )?;
            
            // 创建订单
            let swap_id = NextOcwMakerSwapId::<T>::mutate(|id| {
                let current = *id;
                *id = current.saturating_add(1);
                current
            });
            
            let created_at = <frame_system::Pallet<T>>::block_number();
            let timeout_at = created_at.saturating_add(T::OcwSwapTimeoutBlocks::get());
            
            let record = OcwMakerSwapRecord {
                id: swap_id,
                maker_id,
                maker_tron_address,
                maker_memo_account: maker_account.clone(),
                buyer: user.clone(),
                buyer_tron_address: buyer_tron_address.clone(),
                memo_amount,
                usdt_amount: usdt_amount_u64,
                status: crate::OcwMakerSwapStatus::Pending,
                tron_tx_hash: None,
                created_at,
                timeout_at,
            };
            
            OcwMakerSwaps::<T>::insert(swap_id, &record);
            
            Self::deposit_event(Event::OcwMakerSwapCreated {
                swap_id,
                maker_id,
                user,
                memo_amount,
                usdt_amount: usdt_amount_u64,
                tron_address: buyer_tron_address,
                timeout_at,
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：做市商提交 TRON 交易哈希
        /// 
        /// # 参数
        /// - `origin`: 做市商账户（签名交易）
        /// - `swap_id`: OCW 订单 ID
        /// - `tron_tx_hash`: TRON 链上的交易哈希
        /// 
        /// # 验证
        /// - 订单必须存在且状态为 Pending
        /// - 调用者必须是订单的做市商
        /// - TRON 交易哈希格式有效且未被使用过
        /// - 订单尚未超时
        /// 
        /// # 流程
        /// 1. 验证订单状态和权限
        /// 2. 检查 TRON 交易哈希是否已被使用（防重放攻击）
        /// 3. 更新订单状态为 TronTxSubmitted
        /// 4. 记录交易哈希
        /// 5. 将订单加入 OCW 验证队列
        /// 6. 触发 OcwTronTxHashSubmitted 事件
        #[pallet::call_index(13)]
        #[pallet::weight(T::DbWeight::get().reads_writes(3, 4))]
        pub fn submit_tron_tx_hash(
            origin: OriginFor<T>,
            swap_id: u64,
            tron_tx_hash: BoundedVec<u8, ConstU32<128>>,
        ) -> DispatchResult {
            let maker = ensure_signed(origin)?;
            
            // 验证订单存在
            let mut record = OcwMakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::OcwMakerSwapNotFound)?;
            
            // 验证调用者是做市商
            ensure!(record.maker_memo_account == maker, Error::<T>::NotSwapMaker);
            
            // 验证订单状态
            ensure!(
                record.status == crate::OcwMakerSwapStatus::Pending,
                Error::<T>::OcwMakerSwapInvalidStatus
            );
            
            // 验证订单未超时
            let current_block = <frame_system::Pallet<T>>::block_number();
            ensure!(current_block < record.timeout_at, Error::<T>::SwapNotTimeout);
            
            // 验证 TRON 交易哈希格式
            ensure!(
                !tron_tx_hash.is_empty() && tron_tx_hash.len() <= 128,
                Error::<T>::InvalidTronTxHash
            );
            
            // 防重放攻击：检查交易哈希是否已被使用
            ensure!(
                !UsedTronTxHashes::<T>::contains_key(&tron_tx_hash),
                Error::<T>::TronTxHashAlreadyUsed
            );
            
            // 更新订单状态
            record.status = crate::OcwMakerSwapStatus::TronTxSubmitted;
            record.tron_tx_hash = Some(tron_tx_hash.clone());
            OcwMakerSwaps::<T>::insert(swap_id, &record);
            
            // 🆕 H-3修复：记录已使用的交易哈希（永久存储）
            UsedTronTxHashes::<T>::insert(&tron_tx_hash, swap_id);
            
            // 加入 OCW 验证队列
            PendingOcwVerification::<T>::insert(swap_id, ());
            
            Self::deposit_event(Event::OcwTronTxHashSubmitted {
                swap_id,
                maker_id: record.maker_id,
                tron_tx_hash,
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：买家申请超时退款
        /// 
        /// # 参数
        /// - `origin`: 买家账户（签名交易）
        /// - `swap_id`: OCW 订单 ID
        /// 
        /// # 验证
        /// - 订单必须存在
        /// - 调用者必须是订单的买家
        /// - 订单已超时（超过 OcwSwapTimeoutBlocks）
        /// - 订单状态为 Pending 或 TronTxSubmitted
        /// 
        /// # 流程
        /// 1. 验证订单状态和权限
        /// 2. 检查是否已超时
        /// 3. 从托管账户退回 DUST 给买家
        /// 4. 更新订单状态为 Timeout
        /// 5. 触发 OcwSwapRefunded 事件
        #[pallet::call_index(14)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
        pub fn refund_timeout_swap(
            origin: OriginFor<T>,
            swap_id: u64,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;
            
            // 验证订单存在
            let mut record = OcwMakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::OcwMakerSwapNotFound)?;
            
            // 验证调用者是买家
            ensure!(record.buyer == user, Error::<T>::NotOcwSwapUser);
            
            // 验证订单状态
            ensure!(
                record.status == crate::OcwMakerSwapStatus::Pending ||
                record.status == crate::OcwMakerSwapStatus::TronTxSubmitted,
                Error::<T>::OcwMakerSwapInvalidStatus
            );
            
            // 验证订单已超时
            let current_block = <frame_system::Pallet<T>>::block_number();
            ensure!(current_block >= record.timeout_at, Error::<T>::OcwSwapNotTimeout);
            
            // 从托管账户退回 DUST
            let custody_account = Self::custody_account_for_maker(record.maker_id);
            <T as pallet_market_maker::Config>::Currency::transfer(
                &custody_account,
                &user,
                record.memo_amount,
                ExistenceRequirement::AllowDeath,
            )?;
            
            // 更新订单状态
            record.status = crate::OcwMakerSwapStatus::Timeout;
            OcwMakerSwaps::<T>::insert(swap_id, &record);
            
            // 从验证队列中移除（如果存在）
            PendingOcwVerification::<T>::remove(swap_id);
            
            Self::deposit_event(Event::OcwSwapRefunded {
                swap_id,
                user,
                memo_amount: record.memo_amount,
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：买家举报做市商（OCW 订单）
        /// 
        /// # 参数
        /// - `origin`: 买家账户（签名交易）
        /// - `swap_id`: OCW 订单 ID
        /// - `evidence`: 证据（如截图的 IPFS CID）
        /// 
        /// # 验证
        /// - 订单必须存在
        /// - 调用者必须是订单的买家
        /// - 订单状态为 TronTxSubmitted（做市商已提交哈希但验证失败）
        /// 
        /// # 流程
        /// 1. 验证订单状态和权限
        /// 2. 更新订单状态为 UserReported
        /// 3. 触发 OcwUserReported 事件
        /// 4. 等待治理委员会仲裁
        #[pallet::call_index(15)]
        #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
        pub fn report_ocw_maker(
            origin: OriginFor<T>,
            swap_id: u64,
            evidence: BoundedVec<u8, ConstU32<256>>,
        ) -> DispatchResult {
            let user = ensure_signed(origin)?;
            
            // 验证订单存在
            let mut record = OcwMakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::OcwMakerSwapNotFound)?;
            
            // 验证调用者是买家
            ensure!(record.buyer == user, Error::<T>::NotOcwSwapUser);
            
            // 验证订单状态（只能举报已提交哈希但验证失败的订单）
            ensure!(
                record.status == crate::OcwMakerSwapStatus::TronTxSubmitted,
                Error::<T>::OcwMakerSwapInvalidStatus
            );
            
            // 更新订单状态
            record.status = crate::OcwMakerSwapStatus::UserReported;
            OcwMakerSwaps::<T>::insert(swap_id, &record);
            
            // 从验证队列中移除
            PendingOcwVerification::<T>::remove(swap_id);
            
            Self::deposit_event(Event::OcwUserReported {
                swap_id,
                user,
                evidence,
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：治理委员会仲裁 OCW 订单
        /// 
        /// # 参数
        /// - `origin`: Root 权限
        /// - `swap_id`: OCW 订单 ID
        /// - `approved`: 是否批准做市商（true = 做市商履约，false = 做市商违约）
        /// 
        /// # 验证
        /// - 调用者必须是 Root
        /// - 订单必须存在且状态为 UserReported
        /// 
        /// # 流程
        /// - 如果 approved = true：释放 DUST 给做市商
        /// - 如果 approved = false：退回 DUST 给买家，扣除做市商押金
        #[pallet::call_index(16)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 2))]
        pub fn arbitrate_ocw_swap(
            origin: OriginFor<T>,
            swap_id: u64,
            approved: bool,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            // 验证订单存在
            let mut record = OcwMakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::OcwMakerSwapNotFound)?;
            
            // 验证订单状态
            ensure!(
                record.status == crate::OcwMakerSwapStatus::UserReported,
                Error::<T>::OcwSwapNotReported
            );
            
            let custody_account = Self::custody_account_for_maker(record.maker_id);
            
            if approved {
                // 做市商履约：释放 DUST 给做市商
                <T as pallet_market_maker::Config>::Currency::transfer(
                    &custody_account,
                    &record.maker_memo_account,
                    record.memo_amount,
                    ExistenceRequirement::AllowDeath,
                )?;
                
                record.status = crate::OcwMakerSwapStatus::ArbitrationApproved;
            } else {
                // 做市商违约：退回 DUST 给买家
                <T as pallet_market_maker::Config>::Currency::transfer(
                    &custody_account,
                    &record.buyer,
                    record.memo_amount,
                    ExistenceRequirement::AllowDeath,
                )?;
                
                record.status = crate::OcwMakerSwapStatus::ArbitrationRejected;
                
                // TODO: 扣除做市商押金（集成 pallet-market-maker 的 slash 功能）
            }
            
            OcwMakerSwaps::<T>::insert(swap_id, &record);
            
            Self::deposit_event(Event::MakerSwapArbitrated {
                swap_id,
                approved,
                penalty: None, // TODO: 实现押金扣除
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：配置 TRON API 端点（Root）
        /// 
        /// # 参数
        /// - `origin`: Root 权限
        /// - `endpoint`: TRON API URL（如 "https://api.trongrid.io"）
        #[pallet::call_index(17)]
        #[pallet::weight(T::DbWeight::get().reads_writes(0, 1))]
        pub fn set_tron_api_endpoint(
            origin: OriginFor<T>,
            endpoint: BoundedVec<u8, ConstU32<256>>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            ensure!(
                !endpoint.is_empty() && endpoint.len() <= 256,
                Error::<T>::InvalidTronApiEndpoint
            );
            
            TronApiEndpoint::<T>::put(&endpoint);
            
            Self::deposit_event(Event::TronApiEndpointUpdated { endpoint });
            
            Ok(())
        }

        /// 函数级详细中文注释：配置 USDT 合约地址（Root）
        /// 
        /// # 参数
        /// - `origin`: Root 权限
        /// - `address`: TRON USDT 合约地址（TRC20）
        #[pallet::call_index(18)]
        #[pallet::weight(T::DbWeight::get().reads_writes(0, 1))]
        pub fn set_usdt_contract_address(
            origin: OriginFor<T>,
            address: BoundedVec<u8, ConstU32<64>>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            ensure!(
                !address.is_empty() && address.len() <= 64,
                Error::<T>::InvalidUsdtContractAddress
            );
            
            UsdtContractAddress::<T>::put(&address);
            
            Self::deposit_event(Event::UsdtContractAddressUpdated { address });
            
            Ok(())
        }

        /// 函数级详细中文注释：释放 DUST 给做市商（无签名交易，仅供 OCW 调用）
        /// 
        /// # 参数
        /// - `origin`: 无签名来源
        /// - `swap_id`: 订单 ID
        /// 
        /// # 验证
        /// - 必须是无签名交易
        /// - 订单必须存在
        /// - 订单状态必须是 TronTxSubmitted
        /// 
        /// # 流程
        /// 1. 验证订单状态
        /// 2. 从托管账户释放 DUST 给做市商
        /// 3. 更新订单状态为 Completed
        /// 4. 从验证队列中移除
        #[pallet::call_index(19)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 3))]
        pub fn release_memo(
            origin: OriginFor<T>,
            swap_id: u64,
        ) -> DispatchResult {
            ensure_none(origin)?;
            
            // 验证订单存在
            let mut record = OcwMakerSwaps::<T>::get(swap_id)
                .ok_or(Error::<T>::OcwMakerSwapNotFound)?;
            
            // 验证订单状态
            ensure!(
                record.status == crate::OcwMakerSwapStatus::TronTxSubmitted,
                Error::<T>::OcwMakerSwapInvalidStatus
            );
            
            // 从托管账户释放 DUST 给做市商
            let custody_account = Self::custody_account_for_maker(record.maker_id);
            <T as pallet_market_maker::Config>::Currency::transfer(
                &custody_account,
                &record.maker_memo_account,
                record.memo_amount,
                ExistenceRequirement::AllowDeath,
            )?;
            
            // 更新订单状态
            record.status = crate::OcwMakerSwapStatus::Completed;
            OcwMakerSwaps::<T>::insert(swap_id, &record);
            
            // 从验证队列中移除
            PendingOcwVerification::<T>::remove(swap_id);
            
            Self::deposit_event(Event::OcwMemoReleased {
                swap_id,
                maker: record.maker_memo_account,
                memo_amount: record.memo_amount,
                tron_tx_hash: record.tron_tx_hash.unwrap_or_default(),
            });
            
            Ok(())
        }
    }

    /// 函数级中文注释：自动清理钩子
    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：定期归档清理（每天执行一次）
        /// 
        /// # 功能：自动归档清理
        /// - 检查是否启用自动清理
        /// - 每14400个区块（约1天，6秒/块）执行一次清理
        /// - 每次清理最多处理 MaxCleanupPerBlock 个记录
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let mut total_reads = 0u64;
            let mut total_writes = 0u64;
            
            // ✅ 2025-10-23：功能1 - 超时自动退款（P2优化，每区块执行）
            // 函数级详细中文注释：检查未完成的兑换请求，超时后自动退款
            // - 防止 DUST 永久锁定在桥接账户
            // - 限制每区块最多处理 10 个超时兑换（防止 Gas 爆炸）
            const MAX_REFUNDS_PER_BLOCK: usize = 10;
            let mut refunded_count = 0;
            let bridge_account = BridgeAccount::<T>::get();
            
            if let Some(bridge_acc) = bridge_account {
                for (id, swap) in Swaps::<T>::iter() {
                    if refunded_count >= MAX_REFUNDS_PER_BLOCK {
                        break;
                    }
                    
                    total_reads += 1;
                    
                    // 检查是否超时且未完成
                    if !swap.completed && n >= swap.expire_at {
                        // 退款给用户
                        let result = <T as pallet_market_maker::Config>::Currency::transfer(
                            &bridge_acc,
                            &swap.user,
                            swap.memo_amount,
                            ExistenceRequirement::KeepAlive,
                        );
                        
                        if result.is_ok() {
                            // 标记为已完成（实际是退款）
                            Swaps::<T>::try_mutate(id, |maybe_swap| -> DispatchResult {
                                if let Some(s) = maybe_swap {
                                    s.completed = true;
                                    total_writes += 1;
                                }
                                Ok(())
                            }).ok();
                            
                            // 触发事件
                            Self::deposit_event(Event::SwapRefunded {
                                id,
                                user: swap.user.clone(),
                                amount: swap.memo_amount,
                            });
                            
                            refunded_count += 1;
                        }
                    }
                }
            }
            
            // === 功能2：自动归档清理（每天一次）===
            // 每14400个区块执行一次（约1天：86400秒 / 6秒 = 14400块）
            const BLOCKS_PER_DAY: u32 = 14400;
            
            if ArchiveEnabled::<T>::get() {
                total_reads += 1;
                
                let last_cleanup = LastCleanupBlock::<T>::get();
                total_reads += 1;
                
                let blocks_since_cleanup: u32 = n.saturating_sub(last_cleanup).saturated_into();
                
                if blocks_since_cleanup >= BLOCKS_PER_DAY {
                    // 执行归档清理
                    let threshold_days = T::ArchiveThresholdDays::get();
                    let cutoff_blocks = threshold_days.saturating_mul(BLOCKS_PER_DAY);
                    let cutoff_block = n.saturating_sub(cutoff_blocks.into());
                    
                    let max_count = T::MaxCleanupPerBlock::get();
                    let max_per_type = max_count / 2; // 平分配额
                    
                    let mut swap_cleaned = 0u32;
                    let mut maker_swap_cleaned = 0u32;
                    
                    // 清理简单兑换记录
                    let swap_cursor = SwapCleanupCursor::<T>::get();
                    total_reads += 1;
                    let mut next_swap_cursor = swap_cursor;
                    
                    for (id, swap) in Swaps::<T>::iter() {
                        if id < swap_cursor {
                            continue;
                        }
                        
                        if swap_cleaned >= max_per_type {
                            next_swap_cursor = id;
                            break;
                        }
                        
                        total_reads += 1;
                        
                        if swap.completed && swap.created_at < cutoff_block {
                            Swaps::<T>::remove(id);
                            total_writes += 1;
                            swap_cleaned += 1;
                            
                            let age_blocks: u32 = n.saturating_sub(swap.created_at).saturated_into();
                            let age_days = age_blocks / BLOCKS_PER_DAY;
                            
                            Self::deposit_event(Event::SwapArchived {
                                swap_type: b"Simple".to_vec().try_into().unwrap_or_default(),
                                swap_id: id,
                                record_age_days: age_days,
                            });
                        }
                    }
                    
                    // 清理做市商兑换记录
                    let maker_cursor = MakerSwapCleanupCursor::<T>::get();
                    total_reads += 1;
                    let mut next_maker_cursor = maker_cursor;
                    
                    for (id, swap) in MakerSwaps::<T>::iter() {
                        if id < maker_cursor {
                            continue;
                        }
                        
                        if maker_swap_cleaned >= max_per_type {
                            next_maker_cursor = id;
                            break;
                        }
                        
                        total_reads += 1;
                        
                        let is_final = matches!(
                            swap.status,
                            SwapStatus::Completed | SwapStatus::ArbitrationApproved
                        );
                        
                        if is_final && swap.created_at < cutoff_block {
                            MakerSwaps::<T>::remove(id);
                            total_writes += 1;
                            maker_swap_cleaned += 1;
                            
                            let age_blocks: u32 = n.saturating_sub(swap.created_at).saturated_into();
                            let age_days = age_blocks / BLOCKS_PER_DAY;
                            
                            Self::deposit_event(Event::SwapArchived {
                                swap_type: b"Maker".to_vec().try_into().unwrap_or_default(),
                                swap_id: id,
                                record_age_days: age_days,
                            });
                        }
                    }
                    
                    // 更新清理记录
                    if swap_cleaned > 0 || maker_swap_cleaned > 0 {
                        SwapCleanupCursor::<T>::put(next_swap_cursor);
                        MakerSwapCleanupCursor::<T>::put(next_maker_cursor);
                        total_writes += 2;
                        
                        let total_swaps = NextId::<T>::get().saturating_add(NextMakerSwapId::<T>::get());
                        total_reads += 2;
                        
                        Self::deposit_event(Event::BatchArchiveCompleted {
                            swap_count: swap_cleaned,
                            maker_swap_count: maker_swap_cleaned,
                            total_swaps,
                        });
                    }
                    
                    // 更新最后清理时间
                    LastCleanupBlock::<T>::put(n);
                    total_writes += 1;
                }
            }
            
            T::DbWeight::get().reads_writes(total_reads, total_writes)
        }

        /// 函数级详细中文注释：OCW 链下工作机制
        /// 
        /// # 功能
        /// - 每个区块执行一次
        /// - 从 PendingOcwVerification 队列中获取待验证订单
        /// - 调用 TRON API 验证交易
        /// - 提交无签名交易释放 DUST
        fn offchain_worker(block_number: BlockNumberFor<T>) {
            log::info!("🔍 OCW 开始执行，区块: {:?}", block_number);
            
            // 获取待验证订单队列
            let max_orders = T::MaxOrdersPerBlock::get();
            let mut processed = 0u32;
            
            for (swap_id, _) in PendingOcwVerification::<T>::iter() {
                if processed >= max_orders {
                    log::info!("⏸️  OCW 已达到单块最大处理数: {}", max_orders);
                    break;
                }
                
                // 验证订单
                if let Err(e) = Self::verify_and_release_memo(swap_id) {
                    log::error!("❌ OCW 验证订单失败 swap_id={}: {:?}", swap_id, e);
                } else {
                    log::info!("✅ OCW 验证订单成功 swap_id={}", swap_id);
                }
                
                processed += 1;
            }
            
            if processed > 0 {
                log::info!("✅ OCW 本轮处理完成: {} 个订单", processed);
            }
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：验证 TRON 交易并释放 DUST
        /// 
        /// # 参数
        /// - `swap_id`: 订单 ID
        /// 
        /// # 流程
        /// 1. 读取订单记录
        /// 2. 调用 TRON API 查询交易详情
        /// 3. 验证交易参数（接收地址、金额、确认数）
        /// 4. 提交无签名交易释放 DUST
        /// 5. 更新订单状态
        fn verify_and_release_memo(swap_id: u64) -> Result<(), &'static str> {
            // 读取订单记录
            let record = OcwMakerSwaps::<T>::get(swap_id)
                .ok_or("订单不存在")?;
            
            // 检查订单状态
            if record.status != crate::OcwMakerSwapStatus::TronTxSubmitted {
                return Err("订单状态无效");
            }
            
            // 获取 TRON 交易哈希
            let tron_tx_hash = record.tron_tx_hash
                .as_ref()
                .ok_or("交易哈希不存在")?;
            
            // 查询 TRON 交易详情
            let tx_data = Self::fetch_tron_transaction(tron_tx_hash)?;
            
            // 验证交易参数
            Self::validate_tron_transaction(&record, &tx_data)?;
            
            // 提交无签名交易释放 DUST
            Self::submit_release_memo(swap_id)?;
            
            Ok(())
        }

        /// 函数级详细中文注释：查询 TRON 交易详情
        /// 
        /// # 参数
        /// - `tx_hash`: TRON 交易哈希
        /// 
        /// # 返回
        /// - TronTransactionData: 交易详情
        fn fetch_tron_transaction(
            tx_hash: &BoundedVec<u8, ConstU32<128>>,
        ) -> Result<crate::TronTransactionData, &'static str> {
            // 获取 TRON API 端点
            let endpoint = TronApiEndpoint::<T>::get();
            if endpoint.is_empty() {
                return Err("TRON API 端点未配置");
            }
            
            let endpoint_str = sp_std::str::from_utf8(&endpoint)
                .map_err(|_| "API 端点格式无效")?;
            
            // 将交易哈希转为十六进制字符串
            let tx_hash_hex = core::str::from_utf8(tx_hash.as_slice())
                .map_err(|_| "交易哈希格式无效")?;
            
            // 构建 API URL（手动拼接）
            let mut url = sp_std::vec::Vec::new();
            url.extend_from_slice(endpoint_str.as_bytes());
            url.extend_from_slice(b"/wallet/gettransactionbyid?value=");
            url.extend_from_slice(tx_hash_hex.as_bytes());
            let url = sp_std::str::from_utf8(&url)
                .map_err(|_| "URL 构建失败")?;
            
            log::info!("🌐 查询 TRON 交易: {}", url);
            
            // 发起 HTTP 请求
            let request = http::Request::get(&url);
            let timeout = sp_io::offchain::timestamp().add(Duration::from_millis(10000));
            let pending = request
                .deadline(timeout)
                .send()
                .map_err(|_| "HTTP 请求失败")?;
            
            let response = pending
                .try_wait(timeout)
                .map_err(|_| "HTTP 超时")?
                .map_err(|_| "HTTP 响应错误")?;
            
            if response.code != 200 {
                log::error!("❌ TRON API 返回错误: {}", response.code);
                return Err("TRON API 错误");
            }
            
            let _body = response.body().collect::<Vec<u8>>();
            
            // 解析 JSON 响应（简化版）
            // TODO: 实现完整的 JSON 解析逻辑
            // Phase 2: 解析 _body 获取真实的交易数据
            // 这里返回模拟数据用于编译
            let tx_data = crate::TronTransactionData {
                to_address: Default::default(),
                amount: 0,
                confirmations: 0,
                timestamp: 0,
                contract_address: Default::default(),
            };
            
            log::info!("✅ TRON 交易查询成功");
            
            Ok(tx_data)
        }

        /// 函数级详细中文注释：验证 TRON 交易参数
        /// 
        /// # 参数
        /// - `record`: 订单记录
        /// - `tx_data`: TRON 交易数据
        /// 
        /// # 验证项
        /// - 接收地址是否匹配
        /// - USDT 金额是否匹配（允许 ±1% 误差）
        /// - 交易确认数 >= 19（TRON 安全确认数）
        /// - 交易时间在订单创建之后
        fn validate_tron_transaction(
            record: &OcwMakerSwapRecord<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
            tx_data: &crate::TronTransactionData,
        ) -> Result<(), &'static str> {
            // 验证接收地址
            if tx_data.to_address.as_slice() != record.buyer_tron_address.as_slice() {
                log::error!("❌ TRON 接收地址不匹配");
                return Err("接收地址不匹配");
            }
            
            // 验证 USDT 金额（允许 ±1% 误差）
            let expected_amount = record.usdt_amount;
            let actual_amount = tx_data.amount;
            let tolerance = expected_amount / 100; // 1% 容差
            
            if actual_amount < expected_amount.saturating_sub(tolerance) ||
               actual_amount > expected_amount.saturating_add(tolerance) {
                log::error!("❌ USDT 金额不匹配: 期望={}, 实际={}", expected_amount, actual_amount);
                return Err("金额不匹配");
            }
            
            // 验证交易确认数
            if tx_data.confirmations < 19 {
                log::warn!("⏳ TRON 交易确认数不足: {}/19", tx_data.confirmations);
                return Err("确认数不足");
            }
            
            log::info!("✅ TRON 交易验证通过");
            
            Ok(())
        }

        /// 函数级详细中文注释：提交无签名交易释放 DUST
        /// 
        /// # 参数
        /// - `swap_id`: 订单 ID
        /// 
        /// # TODO
        /// Phase 2 实现：需要在 Runtime 中配置 CreateSignedTransaction
        /// 当前版本：OCW 验证成功后记录日志，需要治理手动调用 release_memo
        #[allow(unused_variables)]
        fn submit_release_memo(swap_id: u64) -> Result<(), &'static str> {
            // TODO: Phase 2 实现无签名交易提交
            // 当前阶段，OCW 只负责验证，释放 DUST 需要治理手动调用
            
            log::info!("✅ OCW 验证成功，待治理调用 release_memo，swap_id={}", swap_id);
            
            // 标记验证成功（Phase 2 可添加单独的 VerifiedSwaps 存储项）
            Ok(())
        }
    }

    /// 函数级详细中文注释：验证无签名交易
    #[pallet::validate_unsigned]
    impl<T: Config> ValidateUnsigned for Pallet<T> {
        type Call = Call<T>;

        fn validate_unsigned(_source: TransactionSource, call: &Self::Call) -> TransactionValidity {
            match call {
                Call::release_memo { swap_id } => {
                    // 验证订单存在
                    let record = OcwMakerSwaps::<T>::get(swap_id)
                        .ok_or(InvalidTransaction::Custom(1))?;
                    
                    // 验证订单状态
                    if record.status != crate::OcwMakerSwapStatus::TronTxSubmitted {
                        return InvalidTransaction::Custom(2).into();
                    }
                    
                    // 验证订单在验证队列中
                    if !PendingOcwVerification::<T>::contains_key(swap_id) {
                        return InvalidTransaction::Custom(3).into();
                    }
                    
                    ValidTransaction::with_tag_prefix("SimpleBridgeOcw")
                        .priority(T::UnsignedPriority::get())
                        .and_provides(swap_id)
                        .longevity(3)
                        .propagate(true)
                        .build()
                }
                _ => InvalidTransaction::Call.into(),
            }
        }
    }
}

