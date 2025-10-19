#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::traits::{tokens::Imbalance, ConstU32};
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency},
        weights::Weight,
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_arithmetic::traits::{Saturating, Zero};
    use sp_runtime::{traits::SaturatedConversion, Perbill};
    use sp_std::vec::Vec;

    /// 简化别名
    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
    type Cid = BoundedVec<u8, ConstU32<256>>;

    /// 函数级中文注释：做市商 Pallet 权重信息 Trait
    /// - 定义各个交易函数的权重计算方法
    pub trait MarketMakerWeightInfo {
        fn lock_deposit() -> Weight;
        fn submit_info() -> Weight;
        fn update_info() -> Weight;
        fn cancel() -> Weight;
        fn approve() -> Weight;
        fn reject() -> Weight;
        fn expire() -> Weight;
        fn request_withdrawal() -> Weight;
        fn execute_withdrawal() -> Weight;
        fn cancel_withdrawal() -> Weight;
        fn emergency_withdrawal() -> Weight;
    }

    impl MarketMakerWeightInfo for () {
        fn lock_deposit() -> Weight {
            Weight::zero()
        }
        fn submit_info() -> Weight {
            Weight::zero()
        }
        fn update_info() -> Weight {
            Weight::zero()
        }
        fn cancel() -> Weight {
            Weight::zero()
        }
        fn approve() -> Weight {
            Weight::zero()
        }
        fn reject() -> Weight {
            Weight::zero()
        }
        fn expire() -> Weight {
            Weight::zero()
        }
        fn request_withdrawal() -> Weight {
            Weight::zero()
        }
        fn execute_withdrawal() -> Weight {
            Weight::zero()
        }
        fn cancel_withdrawal() -> Weight {
            Weight::zero()
        }
        fn emergency_withdrawal() -> Weight {
            Weight::zero()
        }
    }

    /**
     * 函数级详细中文注释：做市商治理+押金 Pallet（最小可用版本）
     * - 实现核心流程：lock_deposit → submit_info → approve/reject → cancel/expire
     * - 仅使用 ReservableCurrency；后续可升级为 holds
     */
    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// MEMO 主币（需支持 reserve）
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 权重信息
        type WeightInfo: MarketMakerWeightInfo;
        /// 最小押金
        #[pallet::constant]
        type MinDeposit: Get<BalanceOf<Self>>;
        /// 提交资料窗口（秒）
        #[pallet::constant]
        type InfoWindow: Get<u32>;
        /// 审核窗口（秒）
        #[pallet::constant]
        type ReviewWindow: Get<u32>;
        /// 驳回最大扣罚比例（千分比）
        #[pallet::constant]
        type RejectSlashBpsMax: Get<u16>;
        /// 最大交易对数量（预留）
        #[pallet::constant]
        type MaxPairs: Get<u32>;
        /// 函数级中文注释：治理起源（用于批准/驳回做市商申请）
        /// - 推荐配置为 Root 或 委员会 2/3 多数
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        
        /// 🆕 函数级详细中文注释：首购资金池最小金额
        /// - 做市商必须质押至少这么多的首购资金
        /// - 用于防止做市商资金池过小导致首购服务中断
        #[pallet::constant]
        type MinFirstPurchasePool: Get<BalanceOf<Self>>;
        
        /// 🆕 2025-10-19：最大溢价（基点）
        /// - 限制溢价范围：-MaxPremiumBps ~ +MaxPremiumBps
        /// - 推荐值：500 bps (5%)
        #[pallet::constant]
        type MaxPremiumBps: Get<i16>;
        
        /// 🆕 2025-10-19：最小溢价（基点）
        /// - 限制溢价范围：MinPremiumBps ~ +MaxPremiumBps
        /// - 推荐值：-500 bps (-5%)
        #[pallet::constant]
        type MinPremiumBps: Get<i16>;
        
        /// 🆕 函数级详细中文注释：每次首购转账金额
        /// - 新用户首次购买时，从做市商资金池转账的固定金额
        /// - 推荐设置为 100 MEMO
        #[pallet::constant]
        type FirstPurchaseAmount: Get<BalanceOf<Self>>;
        
        /// 🆕 函数级详细中文注释：Pallet ID
        /// - 用于派生首购资金池账户地址
        /// - 格式：b"mm/pool!" + 做市商账户地址
        #[pallet::constant]
        type PalletId: Get<frame_support::PalletId>;
        
        /// 🆕 函数级详细中文注释：资金池提取冷却期（秒）
        /// - 做市商申请提取后，需要等待的时间
        /// - 推荐设置为 7 天 = 604800 秒
        /// - 用于防止恶意快速提取，给治理和用户反应时间
        #[pallet::constant]
        type WithdrawalCooldown: Get<u32>;
        
        /// 🆕 函数级详细中文注释：最小保留资金池余额
        /// - 提取后资金池必须保留的最小余额
        /// - 确保有足够资金继续提供首购服务
        /// - 推荐设置为 1000 MEMO
        #[pallet::constant]
        type MinPoolBalance: Get<BalanceOf<Self>>;
    }

    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum ApplicationStatus {
        DepositLocked,
        PendingReview,
        Active,
        Rejected,
        Cancelled,
        Expired,
    }

    /// 🆕 函数级详细中文注释：做市商业务方向枚举
    /// - Buy: 仅买入（仅Bridge）- 做市商购买MEMO，支付USDT
    /// - Sell: 仅卖出（仅OTC）- 做市商出售MEMO，收取USDT  
    /// - BuyAndSell: 双向（OTC + Bridge）- 既可以买入也可以卖出
    #[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum Direction {
        /// 仅买入（仅Bridge）- 做市商购买MEMO，支付USDT
        Buy = 0,
        /// 仅卖出（仅OTC）- 做市商出售MEMO，收取USDT
        Sell = 1,
        /// 双向（OTC + Bridge）- 既可以买入也可以卖出
        BuyAndSell = 2,
    }

    impl Direction {
        /// 从 u8 转换为 Direction
        pub fn from_u8(value: u8) -> Option<Self> {
            match value {
                0 => Some(Direction::Buy),
                1 => Some(Direction::Sell),
                2 => Some(Direction::BuyAndSell),
                _ => None,
            }
        }
    }

    impl Default for Direction {
        fn default() -> Self {
            Self::BuyAndSell
        }
    }

    /// 🆕 函数级详细中文注释：提取请求状态
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum WithdrawalStatus {
        /// 待执行（冷却期中）
        Pending,
        /// 已执行
        Executed,
        /// 已取消
        Cancelled,
    }

    /// 🆕 函数级详细中文注释：桥接服务配置
    /// - 做市商可选择提供 Simple Bridge 兑换服务
    /// - 需要额外押金，用于保障用户资金安全
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(AccountId, Balance))]
    pub struct BridgeServiceConfig<AccountId, Balance> {
        /// 🆕 函数级详细中文注释：做市商账户（接收 MEMO）
        pub maker_account: AccountId,
        /// 🆕 函数级详细中文注释：做市商 TRON 地址（发送 USDT）
        pub tron_address: BoundedVec<u8, ConstU32<64>>,
        /// 单笔最大兑换额（USDT，精度 10^6）
        pub max_swap_amount: u64,
        /// 手续费率（万分比，例如 10 = 0.1%）
        pub fee_rate_bps: u32,
        /// 服务是否启用
        pub enabled: bool,
        /// 累计兑换笔数
        pub total_swaps: u64,
        /// 累计兑换量（MEMO，精度 10^12）
        pub total_volume: Balance,
        /// 成功兑换数
        pub success_count: u64,
        /// 平均完成时间（秒）
        pub avg_time_seconds: u64,
        /// 押金额度（MEMO，精度 10^12）
        pub deposit: Balance,
    }

    /// 🆕 函数级详细中文注释：资金池提取请求
    /// - 记录提取申请的时间、金额、状态
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct WithdrawalRequest<Balance> {
        /// 申请提取的金额
        pub amount: Balance,
        /// 申请时间（秒）
        pub requested_at: u32,
        /// 可执行时间（秒）= requested_at + WithdrawalCooldown
        pub executable_at: u32,
        /// 请求状态
        pub status: WithdrawalStatus,
    }

    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct Application<AccountId, Balance> {
        pub owner: AccountId,
        pub deposit: Balance,
        pub status: ApplicationStatus,
        /// 🆕 2025-10-19：做市商业务方向（Buy/Sell/BuyAndSell）
        pub direction: Direction,
        /// 🆕 2025-10-19：统一TRON地址（OTC收款 + Bridge发款）
        /// 函数级详细中文注释：做市商的TRON地址，用于所有USDT业务
        /// - OTC订单：买家向此地址转账USDT购买MEMO
        /// - Bridge订单：做市商从此地址向买家转账USDT
        /// - 格式：以'T'开头的34字符Base58编码地址
        /// - 示例：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
        /// - 可通过update_maker_info更新（热钱包升级、安全原因等）
        pub tron_address: BoundedVec<u8, ConstU32<64>>,
        pub public_cid: Cid,
        pub private_cid: Cid,
        pub fee_bps: u16,
        /// 🆕 2025-10-19：Buy溢价（基点，-500 ~ 500 = -5% ~ +5%）
        /// - Buy方向（Bridge）：做市商购买MEMO，溢价为负（低于基准价）
        /// - 示例：-200 bps = -2%，基准价0.01 → 买价0.0098
        pub buy_premium_bps: i16,
        /// 🆕 2025-10-19：Sell溢价（基点，-500 ~ 500 = -5% ~ +5%）
        /// - Sell方向（OTC）：做市商出售MEMO，溢价为正（高于基准价）
        /// - 示例：+200 bps = +2%，基准价0.01 → 卖价0.0102
        pub sell_premium_bps: i16,
        pub min_amount: Balance,
        pub created_at: u32,
        pub info_deadline: u32,
        pub review_deadline: u32,
        /// 🆕 epay支付网关地址
        pub epay_gateway: BoundedVec<u8, ConstU32<128>>,
        /// 🆕 epay支付网关端口
        pub epay_port: u16,
        /// 🆕 epay商户ID (PID)
        pub epay_pid: BoundedVec<u8, ConstU32<64>>,
        /// 🆕 epay商户密钥
        pub epay_key: BoundedVec<u8, ConstU32<64>>,
        /// 🆕 首购资金池总额
        pub first_purchase_pool: Balance,
        /// 🆕 已使用的首购资金
        pub first_purchase_used: Balance,
        /// 🆕 冻结的首购资金（提取申请中）
        pub first_purchase_frozen: Balance,
        /// 🆕 服务暂停状态
        pub service_paused: bool,
        /// 🆕 已服务的用户数量
        pub users_served: u32,
    }

    #[pallet::storage]
    #[pallet::getter(fn applications)]
    pub type Applications<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, Application<T::AccountId, BalanceOf<T>>>;

    #[pallet::storage]
    #[pallet::getter(fn owner_index)]
    pub type OwnerIndex<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u64>;

    #[pallet::storage]
    #[pallet::getter(fn next_id)]
    pub type NextId<T> = StorageValue<_, u64, ValueQuery>;

    /// 🆕 函数级详细中文注释：活跃做市商列表
    /// - 存储已批准的做市商信息
    /// - mm_id -> Application
    /// - 批准后从Applications迁移到这里，保持Applications仅存储申请中的记录
    #[pallet::storage]
    #[pallet::getter(fn active_market_makers)]
    pub type ActiveMarketMakers<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, Application<T::AccountId, BalanceOf<T>>>;

    /// 🆕 函数级详细中文注释：首购使用记录
    /// - 记录每个做市商为哪些买家提供了首购服务
    /// - (mm_id, buyer_account) -> ()
    /// - 用于防止重复领取、统计服务数量
    #[pallet::storage]
    pub type FirstPurchaseRecords<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat, u64,        // mm_id
        Blake2_128Concat, T::AccountId, // buyer
        (),
        OptionQuery,
    >;

    /// 🆕 函数级详细中文注释：资金池提取请求记录
    /// - mm_id -> WithdrawalRequest
    /// - 每个做市商同时只能有一个待处理的提取请求
    /// - 执行或取消后删除记录
    #[pallet::storage]
    pub type WithdrawalRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // mm_id
        WithdrawalRequest<BalanceOf<T>>,
        OptionQuery,
    >;

    /// 🆕 函数级详细中文注释：桥接服务配置记录
    /// - mm_id -> BridgeServiceConfig
    /// - 做市商可选择启用桥接服务，需要额外押金
    /// - 存储做市商的桥接服务配置和统计数据
    #[pallet::storage]
    #[pallet::getter(fn bridge_services)]
    pub type BridgeServices<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // mm_id
        BridgeServiceConfig<T::AccountId, BalanceOf<T>>,
        OptionQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(fn deposit_event)]
    pub enum Event<T: Config> {
        Applied {
            mm_id: u64,
            owner: T::AccountId,
            deposit: BalanceOf<T>,
        },
        Submitted {
            mm_id: u64,
        },
        InfoUpdated {
            mm_id: u64,
        },
        Approved {
            mm_id: u64,
        },
        Rejected {
            mm_id: u64,
            slash: BalanceOf<T>,
        },
        Cancelled {
            mm_id: u64,
        },
        Expired {
            mm_id: u64,
        },
        /// ✅ 首购资金池已锁定（reserve）
        FirstPurchasePoolReserved {
            mm_id: u64,
            owner: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 首购资金已转入资金池账户
        FirstPurchasePoolFunded {
            mm_id: u64,
            pool_account: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 首购服务已完成
        FirstPurchaseServed {
            mm_id: u64,
            buyer: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 提取请求已提交
        WithdrawalRequested {
            mm_id: u64,
            owner: T::AccountId,
            amount: BalanceOf<T>,
            executable_at: u32,
            pause_service: bool,
        },
        /// 🆕 提取已执行
        WithdrawalExecuted {
            mm_id: u64,
            owner: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 提取请求已取消
        WithdrawalCancelled {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 紧急提取（治理）
        EmergencyWithdrawal {
            mm_id: u64,
            recipient: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 做市商epay配置已更新
        EpayConfigUpdated {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 桥接服务已启用
        BridgeServiceEnabled {
            mm_id: u64,
            owner: T::AccountId,
            tron_address: BoundedVec<u8, ConstU32<64>>,  // 🆕 TRON 地址
            max_swap_amount: u64,
            fee_rate_bps: u32,
            deposit: BalanceOf<T>,
        },
        /// 🆕 桥接服务已禁用
        BridgeServiceDisabled {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 桥接服务已重新启用
        BridgeServiceReEnabled {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 桥接服务 TRON 地址已更新
        BridgeServiceTronAddressUpdated {
            mm_id: u64,
            owner: T::AccountId,
            tron_address: BoundedVec<u8, ConstU32<64>>,
        },
        /// 🆕 桥接服务最大兑换额已更新
        BridgeServiceMaxSwapAmountUpdated {
            mm_id: u64,
            owner: T::AccountId,
            max_swap_amount: u64,
            deposit: BalanceOf<T>,
        },
        /// 🆕 桥接服务手续费率已更新
        BridgeServiceFeeRateUpdated {
            mm_id: u64,
            owner: T::AccountId,
            fee_rate_bps: u32,
        },
        /// 🆕 桥接统计数据已更新
        BridgeStatsUpdated {
            mm_id: u64,
            total_swaps: u64,
            total_volume: BalanceOf<T>,
            success_count: u64,
            avg_time_seconds: u64,
        },
        /// 🆕 做市商信息已更新
        MakerInfoUpdated {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 2025-10-19：做市商业务方向已更新
        /// - old_direction_u8: 0=Buy, 1=Sell, 2=BuyAndSell
        /// - new_direction_u8: 0=Buy, 1=Sell, 2=BuyAndSell
        DirectionUpdated {
            mm_id: u64,
            owner: T::AccountId,
            old_direction_u8: u8,
            new_direction_u8: u8,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        AlreadyExists,
        NotFound,
        NotDepositLocked,
        NotPendingReview,
        AlreadyFinalized,
        DeadlinePassed,
        InvalidFee,
        BadSlashRatio,
        MinDepositNotMet,
        NotInEditableStatus,
        /// 🆕 epay网关地址无效或为空
        InvalidEpayGateway,
        /// 🆕 epay网关端口无效（必须大于0）
        InvalidEpayPort,
        /// 🆕 epay商户ID无效或为空
        InvalidEpayPid,
        /// 🆕 epay商户密钥无效或为空
        InvalidEpayKey,
        /// 🆕 首购资金池金额不足
        InsufficientFirstPurchasePool,
        /// 🆕 epay配置字段过长
        EpayConfigTooLong,
        /// 🆕 做市商资金池余额不足
        InsufficientPoolBalance,
        /// 🆕 做市商未激活
        MarketMakerNotActive,
        /// 🆕 买家已经使用过首购服务
        AlreadyUsedFirstPurchase,
        /// 🆕 提取请求已存在
        WithdrawalRequestExists,
        /// 🆕 提取请求不存在
        WithdrawalRequestNotFound,
        /// 🆕 冷却期未结束
        WithdrawalCooldownNotExpired,
        /// 🆕 可提取余额不足
        InsufficientWithdrawableBalance,
        /// 🆕 提取后余额低于最小值
        BelowMinPoolBalance,
        /// 🆕 提取请求状态无效
        InvalidWithdrawalStatus,
        /// 🆕 不是做市商所有者
        NotOwner,
        /// 🆕 做市商未激活
        NotActive,
        /// 🆕 桥接服务已存在
        BridgeServiceAlreadyExists,
        /// 🆕 桥接服务不存在
        BridgeServiceNotFound,
        /// 🆕 桥接服务手续费率无效（范围：5-500 bps）
        InvalidBridgeFeeRate,
        /// 🆕 桥接服务押金不足
        InsufficientBridgeDeposit,
        /// 🆕 桥接服务未启用
        BridgeServiceNotEnabled,
        /// 🆕 TRON 地址格式无效（为空或过长）
        InvalidTronAddress,
        /// 🆕 桥接服务已启用（无需重新启用）
        BridgeServiceAlreadyEnabled,
        /// 🆕 最小下单额过低（必须 >= Currency::minimum_balance）
        MinAmountTooLow,
        /// 🆕 2025-10-19：做市商业务方向不支持该操作
        DirectionNotSupported,
        /// 🆕 2025-10-19：没有检测到变化
        NoChange,
        /// 🆕 2025-10-19：状态无效或参数无效
        BadState,
        /// 🆕 2025-10-19：Buy溢价超出范围（MinPremiumBps ~ MaxPremiumBps）
        InvalidBuyPremium,
        /// 🆕 2025-10-19：Sell溢价超出范围（MinPremiumBps ~ MaxPremiumBps）
        InvalidSellPremium,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T>
    where
        BalanceOf<T>: From<u128>,
    {
        /// 质押押金并生成 mm_id
        /// 函数级详细中文注释：锁定押金并申请成为做市商
        /// - 🆕 2025-10-19：新增direction参数，指定做市商业务方向
        /// - direction: 0=Buy（仅Bridge）/ 1=Sell（仅OTC）/ 2=BuyAndSell（双向）
        #[pallet::call_index(0)]
        #[pallet::weight(<<T as Config>::WeightInfo>::lock_deposit())]
        pub fn lock_deposit(
            origin: OriginFor<T>, 
            deposit: BalanceOf<T>,
            direction_u8: u8, // 🆕 新增参数：0=Buy, 1=Sell, 2=BuyAndSell
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                deposit >= T::MinDeposit::get(),
                Error::<T>::MinDepositNotMet
            );
            ensure!(
                !OwnerIndex::<T>::contains_key(&who),
                Error::<T>::AlreadyExists
            );
            
            // 🆕 将 u8 转换为 Direction 枚举
            let direction = Direction::from_u8(direction_u8).ok_or(Error::<T>::BadState)?;

            T::Currency::reserve(&who, deposit)?;

            let mm_id = NextId::<T>::mutate(|id| {
                let cur = *id;
                *id = id.saturating_add(1);
                cur
            });
            // 🔧 函数级中文注释：修复时间戳问题 - 使用 pallet_timestamp 而非 block_number
            // - pallet_timestamp::Pallet::<T>::get() 返回毫秒时间戳
            // - 转换为秒并存储为 u32
            let now_ms = pallet_timestamp::Pallet::<T>::get();
            let ts = (now_ms / 1000u32.into()).saturated_into::<u32>();
            let info_deadline = ts.saturating_add(T::InfoWindow::get());
            let review_deadline = info_deadline.saturating_add(T::ReviewWindow::get());

            Applications::<T>::insert(
                mm_id,
                Application {
                    owner: who.clone(),
                    deposit,
                    status: ApplicationStatus::DepositLocked,
                    direction: direction.clone(), // 🆕 设置业务方向
                    tron_address: BoundedVec::default(), // 🆕 2025-10-19：初始为空，submit_info时设置
                    public_cid: Cid::default(),
                    private_cid: Cid::default(),
                    fee_bps: 0,
                    buy_premium_bps: 0,  // 🆕 2025-10-19：初始化Buy溢价为0
                    sell_premium_bps: 0, // 🆕 2025-10-19：初始化Sell溢价为0
                    min_amount: BalanceOf::<T>::zero(),
                    created_at: ts,
                    info_deadline,
                    review_deadline,
                    // 🆕 初始化epay配置字段
                    epay_gateway: BoundedVec::default(),
                    epay_port: 0,
                    epay_pid: BoundedVec::default(),
                    epay_key: BoundedVec::default(),
                    // 🆕 初始化首购资金池字段
                    first_purchase_pool: BalanceOf::<T>::zero(),
                    first_purchase_used: BalanceOf::<T>::zero(),
                    first_purchase_frozen: BalanceOf::<T>::zero(),
                    service_paused: false,
                    users_served: 0,
                },
            );
            OwnerIndex::<T>::insert(&who, mm_id);

            Self::deposit_event(Event::Applied {
                mm_id,
                owner: who,
                deposit,
            });
            Ok(())
        }

        /// 函数级详细中文注释：提交做市商资料（扩展版）
        /// - 新增：epay配置和首购资金池参数
        /// - epay_gateway: 支付网关地址（如：https://epay.example.com 或 http://111.170.145.41）
        /// - epay_port: 支付网关端口（如：80, 443, 8080等）
        /// - epay_pid: 商户ID
        /// - epay_key: 商户密钥
        /// - first_purchase_pool: 首购资金池总额（必须 >= MinFirstPurchasePool）
        /// - 🆕 2025-10-19：buy_premium_bps: Buy溢价（-500 ~ 500 bps）
        /// - 🆕 2025-10-19：sell_premium_bps: Sell溢价（-500 ~ 500 bps）
        /// - 🆕 2025-10-19：tron_address: TRON地址（OTC收款 + Bridge发款）
        #[pallet::call_index(1)]
        #[pallet::weight(<<T as Config>::WeightInfo>::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_root_cid: Cid,
            private_root_cid: Cid,
            fee_bps: u16,
            buy_premium_bps: i16,  // 🆕 2025-10-19：Buy溢价
            sell_premium_bps: i16, // 🆕 2025-10-19：Sell溢价
            min_amount: BalanceOf<T>,
            tron_address: Vec<u8>,  // 🆕 2025-10-19：TRON地址
            // 🆕 新增参数
            epay_gateway: Vec<u8>,
            epay_port: u16,
            epay_pid: Vec<u8>,
            epay_key: Vec<u8>,
            first_purchase_pool: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 🆕 2025-10-19：验证TRON地址格式
            ensure!(
                Self::is_valid_tron_address(&tron_address),
                Error::<T>::InvalidTronAddress
            );
            
            // 🆕 验证epay配置
            ensure!(!epay_gateway.is_empty(), Error::<T>::InvalidEpayGateway);
            ensure!(epay_port > 0, Error::<T>::InvalidEpayPort);
            ensure!(!epay_pid.is_empty(), Error::<T>::InvalidEpayPid);
            ensure!(!epay_key.is_empty(), Error::<T>::InvalidEpayKey);
            
            // 🆕 2025-10-19：验证溢价范围
            ensure!(
                buy_premium_bps >= T::MinPremiumBps::get() && buy_premium_bps <= T::MaxPremiumBps::get(),
                Error::<T>::InvalidBuyPremium
            );
            ensure!(
                sell_premium_bps >= T::MinPremiumBps::get() && sell_premium_bps <= T::MaxPremiumBps::get(),
                Error::<T>::InvalidSellPremium
            );
            
            // 🆕 验证首购资金池
            ensure!(
                first_purchase_pool >= T::MinFirstPurchasePool::get(),
                Error::<T>::InsufficientFirstPurchasePool
            );
            
            // ✅ 立即质押（reserve）首购资金池
            // 这确保了资金在审核期间被锁定，防止申请人转出资金
            T::Currency::reserve(&who, first_purchase_pool)?;
            
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked),
                    Error::<T>::NotDepositLocked
                );
                // 🔧 使用 pallet_timestamp 获取当前时间（秒）
                let now_ms = pallet_timestamp::Pallet::<T>::get();
                let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
                ensure!(now <= app.info_deadline, Error::<T>::DeadlinePassed);
                ensure!(fee_bps <= 10_000, Error::<T>::InvalidFee);
                ensure!(min_amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);

                app.status = ApplicationStatus::PendingReview;
                app.public_cid = public_root_cid;
                app.private_cid = private_root_cid;
                app.fee_bps = fee_bps;
                app.buy_premium_bps = buy_premium_bps;   // 🆕 2025-10-19：设置Buy溢价
                app.sell_premium_bps = sell_premium_bps; // 🆕 2025-10-19：设置Sell溢价
                app.min_amount = min_amount;
                
                // 🆕 2025-10-19：设置TRON地址
                app.tron_address = tron_address.try_into().map_err(|_| Error::<T>::InvalidTronAddress)?;
                
                // 🆕 更新epay配置
                app.epay_gateway = epay_gateway.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                app.epay_port = epay_port;
                app.epay_pid = epay_pid.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                app.epay_key = epay_key.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                
                // 🆕 更新首购资金池（已通过 reserve 锁定）
                app.first_purchase_pool = first_purchase_pool;
                app.first_purchase_used = BalanceOf::<T>::zero();
                app.users_served = 0;
                
                Ok(())
            })?;

            Self::deposit_event(Event::Submitted { mm_id });
            Self::deposit_event(Event::FirstPurchasePoolReserved {
                mm_id,
                owner: who,
                amount: first_purchase_pool,
            });
            Ok(())
        }

        /// 函数级详细中文注释：更新申请资料（审核前可修改）
        /// - 允许在 DepositLocked 或 PendingReview 状态下修改资料
        /// - 必须在资料提交截止时间前（DepositLocked）或审核截止时间前（PendingReview）
        /// - 只能由申请的 owner 调用
        /// - 质押金额不可修改
        /// - 参数为 Option 类型，None 表示不修改该字段
        /// - 🆕 新增：支持修改epay配置和首购资金池
        #[pallet::call_index(2)]
        #[pallet::weight(<<T as Config>::WeightInfo>::update_info())]
        pub fn update_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_root_cid: Option<Cid>,
            private_root_cid: Option<Cid>,
            fee_bps: Option<u16>,
            min_amount: Option<BalanceOf<T>>,
            // 🆕 新增参数
            epay_gateway: Option<Vec<u8>>,
            epay_port: Option<u16>,
            epay_pid: Option<Vec<u8>>,
            epay_key: Option<Vec<u8>>,
            first_purchase_pool: Option<BalanceOf<T>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                
                // 只允许在 DepositLocked 或 PendingReview 状态下修改
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked | ApplicationStatus::PendingReview),
                    Error::<T>::NotInEditableStatus
                );
                
                // 🔧 检查截止时间 - 使用 pallet_timestamp
                let now_ms = pallet_timestamp::Pallet::<T>::get();
                let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
                match app.status {
                    ApplicationStatus::DepositLocked => {
                        // DepositLocked 状态：检查资料提交截止时间
                        ensure!(now <= app.info_deadline, Error::<T>::DeadlinePassed);
                    }
                    ApplicationStatus::PendingReview => {
                        // PendingReview 状态：检查审核截止时间
                        ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
                    }
                    _ => {}
                }
                
                // 更新字段（如果提供）
                if let Some(cid) = public_root_cid {
                    app.public_cid = cid;
                }
                if let Some(cid) = private_root_cid {
                    app.private_cid = cid;
                }
                if let Some(fee) = fee_bps {
                    ensure!(fee <= 10_000, Error::<T>::InvalidFee);
                    app.fee_bps = fee;
                }
                if let Some(amount) = min_amount {
                    ensure!(amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);
                    app.min_amount = amount;
                }
                
                // 🆕 更新epay配置（如果提供）
                if let Some(gateway) = epay_gateway {
                    ensure!(!gateway.is_empty(), Error::<T>::InvalidEpayGateway);
                    app.epay_gateway = gateway.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                if let Some(port) = epay_port {
                    ensure!(port > 0, Error::<T>::InvalidEpayPort);
                    app.epay_port = port;
                }
                if let Some(pid) = epay_pid {
                    ensure!(!pid.is_empty(), Error::<T>::InvalidEpayPid);
                    app.epay_pid = pid.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                if let Some(key) = epay_key {
                    ensure!(!key.is_empty(), Error::<T>::InvalidEpayKey);
                    app.epay_key = key.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                
                // 🆕 更新首购资金池（如果提供）
                if let Some(pool) = first_purchase_pool {
                    ensure!(
                        pool >= T::MinFirstPurchasePool::get(),
                        Error::<T>::InsufficientFirstPurchasePool
                    );
                    app.first_purchase_pool = pool;
                }
                
                // 如果之前是 DepositLocked 状态且现在提供了所有必需字段，更新为 PendingReview
                if matches!(app.status, ApplicationStatus::DepositLocked) {
                    // 检查是否所有必需字段都已填写（非空）
                    let has_public_cid = !app.public_cid.is_empty();
                    let has_private_cid = !app.private_cid.is_empty();
                    let has_fee = app.fee_bps > 0 || fee_bps.is_some();
                    let has_min_amount = app.min_amount > BalanceOf::<T>::zero() || min_amount.is_some();
                    // 🆕 检查epay配置和首购资金池
                    let has_epay_config = !app.epay_gateway.is_empty() && app.epay_port > 0 && !app.epay_pid.is_empty() && !app.epay_key.is_empty();
                    let has_pool = app.first_purchase_pool >= T::MinFirstPurchasePool::get();
                    
                    if has_public_cid && has_private_cid && has_fee && has_min_amount && has_epay_config && has_pool {
                        app.status = ApplicationStatus::PendingReview;
                    }
                }
                
                Ok(())
            })?;

            Self::deposit_event(Event::InfoUpdated { mm_id });
            Ok(())
        }

        /// 撤销（仅 DepositLocked 阶段）
        #[pallet::call_index(3)]
        #[pallet::weight(<<T as Config>::WeightInfo>::cancel())]
        pub fn cancel(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked),
                    Error::<T>::AlreadyFinalized
                );

                // unreserve 保证金
                T::Currency::unreserve(&who, app.deposit);
                
                // ✅ unreserve 首购资金池（如果已 reserve）
                // 注意：cancel 只能在 DepositLocked 状态调用，
                // 此时可能还未调用 submit_info，因此 first_purchase_pool 可能为 0
                if app.first_purchase_pool > Zero::zero() {
                    T::Currency::unreserve(&who, app.first_purchase_pool);
                }
                
                *maybe_app = None;
                OwnerIndex::<T>::remove(&who);
                Ok(())
            })?;
            Self::deposit_event(Event::Cancelled { mm_id });
            Ok(())
        }

        /// 函数级详细中文注释：批准做市商申请
        /// - 权限：Root 或 委员会 2/3 多数通过
        /// - 通过委员会提案流程：propose → vote → close 自动调用本函数
        /// - 🆕 新增：验证epay配置和首购资金池，并转移资金到资金池账户
        #[pallet::call_index(4)]
        #[pallet::weight(<<T as Config>::WeightInfo>::approve())]
        pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            
            let app = Applications::<T>::get(mm_id).ok_or(Error::<T>::NotFound)?;
            ensure!(
                matches!(app.status, ApplicationStatus::PendingReview),
                Error::<T>::NotPendingReview
            );
            // 🔧 使用 pallet_timestamp 获取当前时间（秒）
            let now_ms = pallet_timestamp::Pallet::<T>::get();
            let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
            ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
            
            // 🆕 验证epay配置完整性
            ensure!(!app.epay_gateway.is_empty(), Error::<T>::InvalidEpayGateway);
            ensure!(app.epay_port > 0, Error::<T>::InvalidEpayPort);
            ensure!(!app.epay_pid.is_empty(), Error::<T>::InvalidEpayPid);
            ensure!(!app.epay_key.is_empty(), Error::<T>::InvalidEpayKey);
            
            // 🆕 验证首购资金池
            ensure!(
                app.first_purchase_pool >= T::MinFirstPurchasePool::get(),
                Error::<T>::InsufficientFirstPurchasePool
            );
            
            // ✅ 先 unreserve 首购资金池（释放锁定）
            // 在 submit_info 时已经 reserve，现在需要 unreserve 后才能转账
            T::Currency::unreserve(&app.owner, app.first_purchase_pool);
            
            // 🆕 派生资金池账户并转移首购资金
            let pool_account = Self::first_purchase_pool_account(mm_id);
            T::Currency::transfer(
                &app.owner,
                &pool_account,
                app.first_purchase_pool,
                frame_support::traits::ExistenceRequirement::KeepAlive,
            )?;
            
            // 更新状态为Active并迁移到ActiveMarketMakers
            let mut approved_app = app.clone();
            approved_app.status = ApplicationStatus::Active;
            ActiveMarketMakers::<T>::insert(mm_id, approved_app);
            
            // 从Applications中移除
            Applications::<T>::remove(mm_id);
            
            Self::deposit_event(Event::Approved { mm_id });
            Self::deposit_event(Event::FirstPurchasePoolFunded {
                mm_id,
                pool_account,
                amount: app.first_purchase_pool,
            });
            Ok(())
        }

        /// 函数级中文注释：驳回做市商申请
        /// - 权限：Root 或 委员会 2/3 多数通过
        /// - 通过委员会提案流程：propose → vote → close 自动调用本函数
        /// - 扣罚比例由提案中指定，余额退还申请人
        #[pallet::call_index(5)]
        #[pallet::weight(<<T as Config>::WeightInfo>::reject())]
        pub fn reject(origin: OriginFor<T>, mm_id: u64, slash_bps: u16) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(
                slash_bps <= T::RejectSlashBpsMax::get(),
                Error::<T>::BadSlashRatio
            );
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(app.status, ApplicationStatus::PendingReview),
                    Error::<T>::NotPendingReview
                );
                let who = app.owner.clone();
                let deposit = app.deposit;
                let first_purchase_pool = app.first_purchase_pool;
                
                // 处理保证金扣罚
                let mult = Perbill::from_rational(slash_bps as u32, 10_000u32);
                let slash = mult.mul_floor(deposit);
                let slashed_balance: BalanceOf<T> = if !slash.is_zero() {
                    let (imbalance, _) = T::Currency::slash_reserved(&who, slash);
                    imbalance.peek()
                } else {
                    Zero::zero()
                };
                let refund = deposit.saturating_sub(slashed_balance);
                if !refund.is_zero() {
                    T::Currency::unreserve(&who, refund);
                }
                
                // ✅ unreserve 首购资金池（全额退还，不扣罚）
                // 首购资金池只是质押，驳回时全额退还
                if first_purchase_pool > Zero::zero() {
                    T::Currency::unreserve(&who, first_purchase_pool);
                }
                
                *maybe_app = None;
                OwnerIndex::<T>::remove(&who);
                Self::deposit_event(Event::Rejected {
                    mm_id,
                    slash: slashed_balance,
                });
                Ok(())
            })
        }

        /// 超时清理（info 未提交或 pending 超时）
        #[pallet::call_index(6)]
        #[pallet::weight(<<T as Config>::WeightInfo>::expire())]
        pub fn expire(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                // 🔧 使用 pallet_timestamp 获取当前时间（秒）
                let now_ms = pallet_timestamp::Pallet::<T>::get();
                let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
                match app.status {
                    ApplicationStatus::DepositLocked => {
                        if now <= app.info_deadline {
                            return Err(Error::<T>::DeadlinePassed.into());
                        }
                        let who = app.owner.clone();
                        T::Currency::unreserve(&who, app.deposit);
                        *maybe_app = None;
                        OwnerIndex::<T>::remove(&who);
                    }
                    ApplicationStatus::PendingReview => {
                        if now <= app.review_deadline {
                            return Err(Error::<T>::DeadlinePassed.into());
                        }
                        let who = app.owner.clone();
                        T::Currency::unreserve(&who, app.deposit);
                        *maybe_app = None;
                        OwnerIndex::<T>::remove(&who);
                    }
                    _ => return Err(Error::<T>::AlreadyFinalized.into()),
                }
                Ok(())
            })?;
            Self::deposit_event(Event::Expired { mm_id });
            Ok(())
        }

        /// 🆕 函数级详细中文注释：申请提取资金池余额
        /// - 只有做市商本人可以调用
        /// - 提交后进入冷却期（默认7天）
        /// - 同一时间只能有一个待处理的提取请求
        /// - pause_service: 是否暂停首购服务（可选）
        #[pallet::call_index(7)]
        #[pallet::weight(<<T as Config>::WeightInfo>::request_withdrawal())]
        pub fn request_withdrawal(
            origin: OriginFor<T>,
            mm_id: u64,
            amount: BalanceOf<T>,
            pause_service: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查做市商是否存在且为Active状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            ensure!(
                app.status == ApplicationStatus::Active,
                Error::<T>::NotActive
            );
            
            // 检查是否已有待处理的提取请求
            ensure!(
                !WithdrawalRequests::<T>::contains_key(mm_id),
                Error::<T>::WithdrawalRequestExists
            );
            
            // 计算可提取余额 = 总额 - 已用 - 已冻结
            let available = app.first_purchase_pool
                .saturating_sub(app.first_purchase_used)
                .saturating_sub(app.first_purchase_frozen);
            ensure!(amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);
            ensure!(amount <= available, Error::<T>::InsufficientWithdrawableBalance);
            
            // 检查提取后余额是否满足最小要求
            let remaining = available.saturating_sub(amount);
            ensure!(
                remaining >= T::MinPoolBalance::get(),
                Error::<T>::BelowMinPoolBalance
            );
            
            // 🔧 计算可执行时间 - 使用 pallet_timestamp
            let now_ms = pallet_timestamp::Pallet::<T>::get();
            let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
            let executable_at = now.saturating_add(T::WithdrawalCooldown::get());
            
            // 冻结申请的金额并设置服务状态
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                app.first_purchase_frozen = app.first_purchase_frozen
                    .saturating_add(amount);
                if pause_service {
                    app.service_paused = true;
                }
                Ok::<(), DispatchError>(())
            })?;
            
            // 创建提取请求
            let request = WithdrawalRequest {
                amount,
                requested_at: now,
                executable_at,
                status: WithdrawalStatus::Pending,
            };
            
            WithdrawalRequests::<T>::insert(mm_id, request);
            
            Self::deposit_event(Event::WithdrawalRequested {
                mm_id,
                owner: who,
                amount,
                executable_at,
                pause_service,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：执行提取资金池余额
        /// - 只有做市商本人可以调用
        /// - 必须在冷却期结束后才能执行
        /// - 从派生账户转账到做市商账户
        #[pallet::call_index(8)]
        #[pallet::weight(<<T as Config>::WeightInfo>::execute_withdrawal())]
        pub fn execute_withdrawal(
            origin: OriginFor<T>,
            mm_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查做市商身份
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            
            // 获取提取请求
            let request = WithdrawalRequests::<T>::get(mm_id)
                .ok_or(Error::<T>::WithdrawalRequestNotFound)?;
            ensure!(
                request.status == WithdrawalStatus::Pending,
                Error::<T>::InvalidWithdrawalStatus
            );
            
            // 🔧 检查冷却期是否已结束 - 使用 pallet_timestamp
            let now_ms = pallet_timestamp::Pallet::<T>::get();
            let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
            ensure!(
                now >= request.executable_at,
                Error::<T>::WithdrawalCooldownNotExpired
            );
            
            // 从派生账户转账到做市商账户
            let pool_account = Self::first_purchase_pool_account(mm_id);
            T::Currency::transfer(
                &pool_account,
                &who,
                request.amount,
                frame_support::traits::ExistenceRequirement::AllowDeath,
            )?;
            
            // 更新资金池：减少总额和冻结金额
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                app.first_purchase_pool = app.first_purchase_pool
                    .saturating_sub(request.amount);
                app.first_purchase_frozen = app.first_purchase_frozen
                    .saturating_sub(request.amount);
                Ok::<(), DispatchError>(())
            })?;
            
            // 删除提取请求记录
            WithdrawalRequests::<T>::remove(mm_id);
            
            Self::deposit_event(Event::WithdrawalExecuted {
                mm_id,
                owner: who,
                amount: request.amount,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：取消提取请求
        /// - 只有做市商本人可以调用
        /// - 可以在冷却期内随时取消
        /// - 解冻资金并恢复服务状态
        #[pallet::call_index(9)]
        #[pallet::weight(<<T as Config>::WeightInfo>::cancel_withdrawal())]
        pub fn cancel_withdrawal(
            origin: OriginFor<T>,
            mm_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查做市商身份
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            
            // 检查提取请求是否存在
            let request = WithdrawalRequests::<T>::get(mm_id)
                .ok_or(Error::<T>::WithdrawalRequestNotFound)?;
            ensure!(
                request.status == WithdrawalStatus::Pending,
                Error::<T>::InvalidWithdrawalStatus
            );
            
            // 解冻金额并恢复服务
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                app.first_purchase_frozen = app.first_purchase_frozen
                    .saturating_sub(request.amount);
                app.service_paused = false; // 恢复服务
                Ok::<(), DispatchError>(())
            })?;
            
            // 删除提取请求
            WithdrawalRequests::<T>::remove(mm_id);
            
            Self::deposit_event(Event::WithdrawalCancelled {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：紧急提取资金池（治理权限）
        /// - 只能由治理委员会调用
        /// - 绕过冷却期，立即执行
        /// - 用于异常情况处理（如做市商账户丢失、系统升级等）
        #[pallet::call_index(10)]
        #[pallet::weight(<<T as Config>::WeightInfo>::emergency_withdrawal())]
        pub fn emergency_withdrawal(
            origin: OriginFor<T>,
            mm_id: u64,
            recipient: T::AccountId,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            
            // 检查做市商是否存在
            ensure!(
                ActiveMarketMakers::<T>::contains_key(mm_id),
                Error::<T>::NotFound
            );
            
            // 从派生账户转账
            let pool_account = Self::first_purchase_pool_account(mm_id);
            let pool_balance = T::Currency::free_balance(&pool_account);
            
            // 确保请求的金额不超过余额
            let actual_amount = if amount > pool_balance {
                pool_balance
            } else {
                amount
            };
            
            T::Currency::transfer(
                &pool_account,
                &recipient,
                actual_amount,
                frame_support::traits::ExistenceRequirement::AllowDeath,
            )?;
            
            // 更新资金池总额（如果还有记录）
            let _ = ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| {
                if let Some(app) = maybe_app.as_mut() {
                    app.first_purchase_pool = app.first_purchase_pool
                        .saturating_sub(actual_amount);
                    // 如果有冻结金额也要相应减少
                    if app.first_purchase_frozen > BalanceOf::<T>::zero() {
                        app.first_purchase_frozen = app.first_purchase_frozen
                            .saturating_sub(actual_amount);
                    }
                }
                Ok::<(), DispatchError>(())
            });
            
            // 清除待处理的提取请求（如果有）
            WithdrawalRequests::<T>::remove(mm_id);
            
            Self::deposit_event(Event::EmergencyWithdrawal {
                mm_id,
                recipient,
                amount: actual_amount,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新 epay 配置（做市商自主修改）
        /// - 只有做市商本人可以调用
        /// - 只能在 Active 状态下修改
        /// - 参数为 Option 类型，None 表示不修改该字段
        /// - 允许做市商随时更新支付网关配置
        #[pallet::call_index(11)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_epay_config(
            origin: OriginFor<T>,
            mm_id: u64,
            epay_gateway: Option<Vec<u8>>,
            epay_port: Option<u16>,
            epay_pid: Option<Vec<u8>>,
            epay_key: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查做市商是否存在且为Active状态
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                
                // 确保是做市商本人
                ensure!(app.owner == who, Error::<T>::NotOwner);
                
                // 确保状态为Active
                ensure!(
                    app.status == ApplicationStatus::Active,
                    Error::<T>::NotActive
                );
                
                // 更新epay配置（如果提供）
                if let Some(gateway) = epay_gateway {
                    ensure!(!gateway.is_empty(), Error::<T>::InvalidEpayGateway);
                    app.epay_gateway = gateway.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                
                if let Some(port) = epay_port {
                    ensure!(port > 0, Error::<T>::InvalidEpayPort);
                    app.epay_port = port;
                }
                
                if let Some(pid) = epay_pid {
                    ensure!(!pid.is_empty(), Error::<T>::InvalidEpayPid);
                    app.epay_pid = pid.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                
                if let Some(key) = epay_key {
                    ensure!(!key.is_empty(), Error::<T>::InvalidEpayKey);
                    app.epay_key = key.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                
                Ok(())
            })?;
            
            Self::deposit_event(Event::EpayConfigUpdated {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：启用桥接服务
        /// - 做市商可选择提供 Simple Bridge 兑换服务
        /// - 需要额外押金，押金 = max_swap_amount × 100（MEMO）
        /// - 例如：最大 1,000 USDT → 需押金 100,000 MEMO
        #[pallet::call_index(12)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn enable_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
            tron_address: BoundedVec<u8, ConstU32<64>>,  // 🆕 新增参数：做市商 TRON 地址
            max_swap_amount: u64,    // USDT，精度 10^6
            fee_rate_bps: u32,       // 万分比，例如 10 = 0.1%
        ) -> DispatchResult {
            let maker_account = ensure_signed(origin)?;
            
            // 验证做市商身份和状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == maker_account, Error::<T>::NotOwner);
            ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
            
            // 🆕 验证 TRON 地址格式
            ensure!(
                !tron_address.is_empty() && tron_address.len() <= 64,
                Error::<T>::InvalidTronAddress
            );
            
            // 验证费率范围（0.05% - 5%）
            ensure!(
                fee_rate_bps >= 5 && fee_rate_bps <= 500,
                Error::<T>::InvalidBridgeFeeRate
            );
            
            // 检查是否已存在
            ensure!(
                !BridgeServices::<T>::contains_key(mm_id),
                Error::<T>::BridgeServiceAlreadyExists
            );
            
            // 计算所需押金（押金 = max_swap_amount × 100 × MEMO_UNITS）
            // 例如：max_swap_amount = 1000 USDT = 1,000,000,000（精度10^6）
            // 押金 = 1,000,000,000 × 100 / 1,000,000 = 100,000 MEMO
            let required_deposit = BalanceOf::<T>::from(max_swap_amount.into())
                .saturating_mul(100u32.into())
                .saturating_mul(1_000_000u32.into()); // MEMO精度10^12 / USDT精度10^6
            
            // 检查押金是否足够
            ensure!(
                app.deposit >= required_deposit,
                Error::<T>::InsufficientBridgeDeposit
            );
            
            // 创建桥接服务配置
            BridgeServices::<T>::insert(mm_id, BridgeServiceConfig {
                maker_account: maker_account.clone(),  // 🆕 存储做市商账户
                tron_address: tron_address.clone(),    // 🆕 存储做市商 TRON 地址
                max_swap_amount,
                fee_rate_bps,
                enabled: true,
                total_swaps: 0,
                total_volume: BalanceOf::<T>::zero(),
                success_count: 0,
                avg_time_seconds: 0,
                deposit: required_deposit,
            });
            
            // 发出事件
            Self::deposit_event(Event::BridgeServiceEnabled {
                mm_id,
                owner: maker_account,
                tron_address,
                max_swap_amount,
                fee_rate_bps,
                deposit: required_deposit,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：禁用桥接服务
        /// - 做市商可随时禁用桥接服务
        /// - 禁用后，新用户无法选择该做市商进行兑换
        /// - 已有的兑换订单不受影响
        #[pallet::call_index(13)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn disable_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证做市商身份
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            
            // 更新桥接服务状态
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                config.enabled = false;
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::BridgeServiceDisabled {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：重新启用桥接服务
        /// - 允许做市商重新启用之前禁用的桥接服务
        /// - 不重新计算押金（押金保持不变）
        /// - 用于临时维护后恢复或误操作后快速恢复
        #[pallet::call_index(14)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 1))]
        pub fn re_enable_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证做市商身份和状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
            
            // 更新桥接服务状态
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                ensure!(!config.enabled, Error::<T>::BridgeServiceAlreadyEnabled);
                
                config.enabled = true;
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::BridgeServiceReEnabled {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新桥接服务配置
        /// - 允许 Active 做市商更新桥接服务的关键配置
        /// - 可更新：TRON 地址、最大兑换额、手续费率
        /// - 注意：增加最大兑换额可能需要追加押金
        #[pallet::call_index(15)]
        #[pallet::weight(T::DbWeight::get().reads_writes(3, 2))]
        pub fn update_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
            tron_address: Option<BoundedVec<u8, ConstU32<64>>>,  // 可选更新 TRON地址
            max_swap_amount: Option<u64>,                        // 可选更新最大兑换额
            fee_rate_bps: Option<u32>,                           // 可选更新手续费率
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证做市商身份和状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
            
            // 获取桥接服务配置
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                
                // 更新 TRON 地址
                if let Some(new_tron_address) = tron_address {
                    ensure!(
                        !new_tron_address.is_empty() && new_tron_address.len() <= 64,
                        Error::<T>::InvalidTronAddress
                    );
                    config.tron_address = new_tron_address.clone();
                    
                    Self::deposit_event(Event::BridgeServiceTronAddressUpdated {
                        mm_id,
                        owner: who.clone(),
                        tron_address: new_tron_address,
                    });
                }
                
                // 更新最大兑换额（可能需要追加押金）
                if let Some(new_max_swap_amount) = max_swap_amount {
                    let old_max = config.max_swap_amount;
                    
                    if new_max_swap_amount > old_max {
                        // 增加额度，需要追加押金
                        let old_deposit = config.deposit;
                        let new_deposit = BalanceOf::<T>::from(new_max_swap_amount.into())
                            .saturating_mul(100u32.into())
                            .saturating_mul(1_000_000u32.into());
                        
                        let additional_deposit = new_deposit.saturating_sub(old_deposit);
                        
                        // 检查做市商押金是否足够
                        ensure!(
                            app.deposit >= app.deposit.saturating_add(additional_deposit),
                            Error::<T>::InsufficientBridgeDeposit
                        );
                        
                        // 更新押金
                        config.deposit = new_deposit;
                    }
                    // 如果减少额度，押金保持不变（不退还）
                    
                    config.max_swap_amount = new_max_swap_amount;
                    
                    Self::deposit_event(Event::BridgeServiceMaxSwapAmountUpdated {
                        mm_id,
                        owner: who.clone(),
                        max_swap_amount: new_max_swap_amount,
                        deposit: config.deposit,
                    });
                }
                
                // 更新手续费率
                if let Some(new_fee_rate) = fee_rate_bps {
                    ensure!(
                        new_fee_rate >= 5 && new_fee_rate <= 500,
                        Error::<T>::InvalidBridgeFeeRate
                    );
                    config.fee_rate_bps = new_fee_rate;
                    
                    Self::deposit_event(Event::BridgeServiceFeeRateUpdated {
                        mm_id,
                        owner: who.clone(),
                        fee_rate_bps: new_fee_rate,
                    });
                }
                
                Ok(())
            })?;
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新做市商业务配置
        /// - 允许 Active 做市商更新 OTC 业务配置
        /// - 可更新：资料 CID、费率、最小下单额
        /// - 用于调整业务策略、更新服务条款等
        #[pallet::call_index(16)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 1))]
        pub fn update_maker_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_cid: Option<Cid>,           // 可选更新公开资料
            private_cid: Option<Cid>,          // 可选更新私密资料
            fee_bps: Option<u16>,              // 可选更新费率
            buy_premium_bps: Option<i16>,      // 🆕 2025-10-19：可选更新Buy溢价
            sell_premium_bps: Option<i16>,     // 🆕 2025-10-19：可选更新Sell溢价
            min_amount: Option<BalanceOf<T>>,  // 可选更新最小下单额
            tron_address: Option<Vec<u8>>,     // 🆕 2025-10-19：可选更新TRON地址
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查做市商是否存在且为Active状态
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotOwner);
                ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
                
                // 更新公开资料
                if let Some(new_public_cid) = public_cid {
                    app.public_cid = new_public_cid;
                }
                
                // 更新私密资料
                if let Some(new_private_cid) = private_cid {
                    app.private_cid = new_private_cid;
                }
                
                // 更新费率
                if let Some(new_fee_bps) = fee_bps {
                    ensure!(
                        new_fee_bps >= 10 && new_fee_bps <= 1000,  // 0.1% - 10%
                        Error::<T>::InvalidFee
                    );
                    app.fee_bps = new_fee_bps;
                }
                
                // 更新最小下单额
                if let Some(new_min_amount) = min_amount {
                    ensure!(
                        new_min_amount >= T::Currency::minimum_balance(),
                        Error::<T>::MinAmountTooLow
                    );
                    app.min_amount = new_min_amount;
                }
                
                // 🆕 2025-10-19：更新Buy溢价
                if let Some(new_buy_premium) = buy_premium_bps {
                    ensure!(
                        new_buy_premium >= T::MinPremiumBps::get() && new_buy_premium <= T::MaxPremiumBps::get(),
                        Error::<T>::InvalidBuyPremium
                    );
                    app.buy_premium_bps = new_buy_premium;
                }
                
                // 🆕 2025-10-19：更新Sell溢价
                if let Some(new_sell_premium) = sell_premium_bps {
                    ensure!(
                        new_sell_premium >= T::MinPremiumBps::get() && new_sell_premium <= T::MaxPremiumBps::get(),
                        Error::<T>::InvalidSellPremium
                    );
                    app.sell_premium_bps = new_sell_premium;
                }
                
                // 🆕 2025-10-19：更新TRON地址
                if let Some(new_tron_address) = tron_address {
                    // 验证TRON地址格式
                    ensure!(
                        Self::is_valid_tron_address(&new_tron_address),
                        Error::<T>::InvalidTronAddress
                    );
                    // 更新TRON地址
                    app.tron_address = new_tron_address.try_into().map_err(|_| Error::<T>::InvalidTronAddress)?;
                }
                
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::MakerInfoUpdated {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新做市商业务方向
        /// - 2025-10-19 新增接口
        /// - 允许做市商在Active状态下修改业务方向
        /// - 暂时不需要追加保证金（未来可扩展）
        /// 
        /// # 参数
        /// - `mm_id`: 做市商 ID
        /// - `new_direction_u8`: 新的业务方向（0=Buy/1=Sell/2=BuyAndSell）
        /// 
        /// # 权限
        /// - 仅做市商本人可调用
        /// - 必须为Active状态
        #[pallet::call_index(17)]
        #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
        pub fn update_direction(
            origin: OriginFor<T>,
            mm_id: u64,
            new_direction_u8: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 🆕 将 u8 转换为 Direction 枚举
            let new_direction = Direction::from_u8(new_direction_u8).ok_or(Error::<T>::BadState)?;
            
            // 检查做市商是否存在且为Active状态
            let old_direction = ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> Result<Direction, DispatchError> {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotOwner);
                ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
                
                // 检查是否有实际变化
                ensure!(app.direction != new_direction, Error::<T>::NoChange);
                
                // 保存旧方向用于事件
                let old = app.direction;
                
                // 更新方向
                app.direction = new_direction;
                
                Ok(old)
            })?;
            
            // 发出事件（将Direction转换为u8）
            Self::deposit_event(Event::DirectionUpdated {
                mm_id,
                owner: who,
                old_direction_u8: old_direction as u8,
                new_direction_u8: new_direction as u8,
            });
            
            Ok(())
        }
    }
    
    /// 🆕 函数级详细中文注释：辅助函数实现
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：派生首购资金池账户地址
        /// - 使用 PalletId + mm_id 派生子账户
        /// - 格式：PalletId("mm/pool!") + mm_id
        /// - 每个做市商有独立的资金池账户
        pub fn first_purchase_pool_account(mm_id: u64) -> T::AccountId {
            use sp_runtime::traits::AccountIdConversion;
            T::PalletId::get().into_sub_account_truncating(mm_id)
        }
        
        /// 函数级详细中文注释：记录首购服务使用
        /// - 更新做市商的已使用资金和服务用户数
        /// - 记录买家已使用首购服务，防止重复领取
        pub fn record_first_purchase_usage(
            mm_id: u64,
            buyer: &T::AccountId,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            // 检查做市商是否激活
            ensure!(
                ActiveMarketMakers::<T>::contains_key(mm_id),
                Error::<T>::MarketMakerNotActive
            );
            
            // 检查买家是否已使用过首购服务
            ensure!(
                !FirstPurchaseRecords::<T>::contains_key(mm_id, buyer),
                Error::<T>::AlreadyUsedFirstPurchase
            );
            
            // 更新做市商使用统计
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                
                app.first_purchase_used = app.first_purchase_used.saturating_add(amount);
                app.users_served = app.users_served.saturating_add(1);
                
                Ok(())
            })?;
            
            // 记录买家已使用
            FirstPurchaseRecords::<T>::insert(mm_id, buyer, ());
            
            // 发出事件
            Self::deposit_event(Event::FirstPurchaseServed {
                mm_id,
                buyer: buyer.clone(),
                amount,
            });
            
            Ok(())
        }
        
        /// 函数级详细中文注释：检查买家是否已使用过首购服务
        pub fn has_used_first_purchase(mm_id: u64, buyer: &T::AccountId) -> bool {
            FirstPurchaseRecords::<T>::contains_key(mm_id, buyer)
        }

        /// 🆕 函数级详细中文注释：更新桥接服务统计数据
        /// - 由 pallet-simple-bridge 调用，在兑换完成后更新统计
        /// - 更新累计兑换笔数、交易量、成功数、平均完成时间
        /// 
        /// # 参数
        /// - `mm_id`: 做市商 ID
        /// - `volume`: 本次兑换量（MEMO，精度 10^12）
        /// - `time_seconds`: 本次兑换耗时（秒）
        /// - `success`: 是否成功完成
        pub fn update_bridge_stats(
            mm_id: u64,
            volume: BalanceOf<T>,
            time_seconds: u64,
            success: bool,
        ) -> DispatchResult {
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                
                // 更新累计数据
                config.total_swaps = config.total_swaps.saturating_add(1);
                config.total_volume = config.total_volume.saturating_add(volume);
                
                if success {
                    config.success_count = config.success_count.saturating_add(1);
                }
                
                // 更新平均完成时间（滚动平均）
                if config.total_swaps > 0 {
                    let total_time = config.avg_time_seconds
                        .saturating_mul(config.total_swaps.saturating_sub(1))
                        .saturating_add(time_seconds);
                    config.avg_time_seconds = total_time / config.total_swaps;
                }
                
                // 发出事件
                Self::deposit_event(Event::BridgeStatsUpdated {
                    mm_id,
                    total_swaps: config.total_swaps,
                    total_volume: config.total_volume,
                    success_count: config.success_count,
                    avg_time_seconds: config.avg_time_seconds,
                });
                
                Ok(())
            })
        }
        
        /// 🆕 2025-10-19：函数级详细中文注释：验证TRON地址格式
        /// 
        /// TRON地址规则：
        /// - 长度必须为34字符
        /// - 以字符'T'开头（主网地址）
        /// - 使用Base58编码（字符范围：1-9, A-Z, a-z，排除0OIl）
        /// 
        /// 示例有效地址：
        /// - TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
        /// - TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (USDT合约地址)
        /// 
        /// 参数：
        /// - address: TRON地址的字节数组（UTF-8编码）
        /// 
        /// 返回：
        /// - true: 地址格式有效
        /// - false: 地址格式无效
        pub fn is_valid_tron_address(address: &[u8]) -> bool {
            // 1. 检查长度（TRON地址固定34字符）
            if address.len() != 34 {
                return false;
            }
            
            // 2. 检查首字符（主网地址必须以'T'开头）
            if address[0] != b'T' {
                return false;
            }
            
            // 3. 检查Base58字符集（简化验证，生产环境可增强）
            // Base58字符：1-9, A-Z, a-z，排除0, O, I, l
            for &byte in address.iter() {
                let is_valid_base58 = match byte {
                    b'1'..=b'9' => true,  // 数字1-9
                    b'A'..=b'H' => true,  // A-H（排除I）
                    b'J'..=b'N' => true,  // J-N（排除O）
                    b'P'..=b'Z' => true,  // P-Z
                    b'a'..=b'k' => true,  // a-k（排除l）
                    b'm'..=b'z' => true,  // m-z
                    _ => false,
                };
                if !is_valid_base58 {
                    return false;
                }
            }
            
            // 4. 所有验证通过
            true
        }
    }
}
