#![cfg_attr(not(feature = "std"), no_std)]

// 函数级中文注释：将 pallet 模块内导出的类型（如 Pallet、Call、Event 等）在 crate 根进行再导出
// 作用：
// - 让 runtime 可以通过 `pallet_otc_order::Call` 与 `pallet_otc_order::ArbitrationHook` 进行类型引用；
// - 降低路径耦合，便于其他 pallet/rpc 使用。
pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, Get},
    };
    use frame_system::pallet_prelude::*;
    use pallet_escrow::pallet::Escrow as EscrowTrait;
    // 🆕 2025-10-20：移除 pallet_otc_listing 依赖
    use sp_core::hashing::blake2_256;
    use sp_core::H256;
    use sp_runtime::traits::{SaturatedConversion, Saturating, Zero};
    use sp_std::vec::Vec;
    /// 🆕 2025-10-28：导入统一信用管理接口 trait（已整合买家和做市商信用）
    use pallet_credit::MakerCreditInterface;

    // Balance aliases 将在 Config 定义之后重新声明

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum OrderState {
        Created,
        PaidOrCommitted,
        Released,
        Refunded,
        Canceled,
        Disputed,
        Closed,
    }

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct Order<AccountId, Balance, Moment> {
        /// 🆕 2025-10-20：做市商ID（替代listing_id）
        /// 函数级详细中文注释：直接引用pallet-market-maker中的做市商
        /// - 无需中间挂单层
        /// - 价格从pallet-pricing获取并应用做市商溢价
        pub maker_id: u64,
        pub maker: AccountId,
        pub taker: AccountId,
        pub price: Balance,
        pub qty: Balance,
        pub amount: Balance,
        
        /// 函数级中文注释：订单创建时间（Unix时间戳，毫秒）
        pub created_at: Moment,
        
        /// 函数级中文注释：订单确认/放行超时时间（Unix时间戳，毫秒）
        /// 到期后可触发自动流程或发起争议
        pub expire_at: Moment,
        
        /// 函数级中文注释：证据追加窗口截至时间（Unix时间戳，毫秒）
        /// 窗口内允许补充证据并发起争议
        pub evidence_until: Moment,
        
        /// 🆕 2025-10-19：做市商TRON收款地址
        /// 函数级详细中文注释：买家需要向此地址转账USDT购买MEMO
        /// - 从做市商Application.tron_address获取
        /// - 格式：34字符，'T'开头的Base58编码地址
        /// - 示例：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
        /// - 用途：前端显示给买家，便于转账和验证
        pub maker_tron_address: BoundedVec<u8, ConstU32<64>>,
        
        pub payment_commit: H256,
        pub contact_commit: H256,
        pub state: OrderState,
        
        /// 🆕 2025-10-21：EPAY 交易号（可选）
        /// 函数级详细中文注释：做市商EPAY支付系统的交易号
        /// - 用于关联EPAY支付记录和链上订单
        /// - 做市商中继服务收到支付通知后，调用mark_order_paid_by_maker时填充此字段
        /// - 格式：最多64字节的UTF-8字符串
        /// - 示例："2025012100001"
        /// - None表示未通过EPAY支付或尚未标记
        pub epay_trade_no: Option<BoundedVec<u8, ConstU32<64>>>,
        
        /// 🆕 H-2修复：订单完成时间（Unix时间戳，毫秒）
        /// 函数级详细中文注释：记录订单进入终态的时间
        /// - 终态包括：Released, Refunded, Canceled, Closed
        /// - 用于自动清理：基于 completed_at 而非 created_at
        /// - None 表示订单尚未完成
        pub completed_at: Option<Moment>,
    }

    #[pallet::config]
    // Plan B: 仅依赖 listing 与 escrow（listing 已经 transitively 依赖 maker/KYC），去掉直接对 maker pallet 的耦合。
    // 函数级中文注释：添加 pallet_timestamp::Config 依赖，用于获取系统时间戳
    // 🆕 2025-10-20：移除 pallet_otc_listing::Config 继承（不再依赖挂单pallet）
    // 🆕 2025-10-21：添加 pallet_buyer_credit::Config 继承（买家信用风控系统）
    pub trait Config:
        frame_system::Config + pallet_escrow::pallet::Config + pallet_timestamp::Config + pallet_pricing::Config + pallet_market_maker::Config + pallet_credit::Config
    {
        type Currency: Currency<Self::AccountId>;
        type ConfirmTTL: Get<BlockNumberFor<Self>>;
        /// 托管接口（用于锁定/释放/退款）
        type Escrow: EscrowTrait<Self::AccountId, BalanceOf<Self>>;
        /// 🆕 2025-10-28：统一信用接口（用于订单完成和违约记录）
        type MakerCredit: pallet_credit::MakerCreditInterface;
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
        /// ✅ 2025-10-23：买家撤回窗口（毫秒）（P2优化）
        /// 函数级详细中文注释：买家标记已付款后，可撤回的时间窗口
        /// - 默认：5分钟（300,000 毫秒）
        /// - 保护买家误操作，提供短暂撤回机会
        #[pallet::constant]
        type CancelWindow: Get<MomentOf<Self>>;
        /// 函数级中文注释：事件类型，确保 Pallet 事件能映射到 RuntimeEvent。
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// 函数级中文注释：法币网关服务账户（授权调用首购接口）
        type FiatGatewayAccount: Get<Self::AccountId>;
        
        /// 函数级中文注释：法币网关托管账户（存放待分发的MEMO）
        type FiatGatewayTreasuryAccount: Get<Self::AccountId>;
        
        /// 函数级中文注释：首购最低金额
        #[pallet::constant]
        type MinFirstPurchaseAmount: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：首购最高金额
        #[pallet::constant]
        type MaxFirstPurchaseAmount: Get<BalanceOf<Self>>;
        
        /// 函数级中文注释：会员信息提供者
        type MembershipProvider: pallet_memo_referrals::MembershipProvider<Self::AccountId>;
        
        // 🆕 2025-10-28 已移除：ReferralProvider 和 AffiliateDistributor 关联类型
        // 这两个类型已定义但从未使用，可以安全移除
        // 如需使用推荐关系或联盟计酬功能，请直接调用 pallet-affiliate
        // - 推荐关系：通过 pallet_affiliate::Pallet 调用
        // - 联盟计酬：通过 pallet_affiliate::Pallet 调用
        
        /// 函数级中文注释：订单归档阈值（天数）
        /// 超过此天数的终态订单将被自动清理，默认 150 天（约5个月）
        #[pallet::constant]
        type ArchiveThresholdDays: Get<u32>;
        
        /// 函数级中文注释：每次自动清理的最大订单数
        /// 防止单次清理过多导致区块Gas爆炸，默认 50
        #[pallet::constant]
        type MaxCleanupPerBlock: Get<u32>;
        
        /// 🆕 2025-10-19：TRON交易哈希保留期（区块数）
        /// 函数级详细中文注释：已使用的TRON交易哈希在链上保留的时间
        /// - 默认值：2,592,000 区块（约180天，假设12秒/区块）
        /// - 作用：防止重放攻击的同时，控制存储增长
        /// - 清理：超过此期限的哈希记录可被清理
        /// - 推荐：根据业务需求和存储成本调整（60-365天）
        #[pallet::constant]
        type TronTxHashRetentionPeriod: Get<BlockNumberFor<Self>>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // 🆕 2025-10-20：余额别名（使用本pallet的Currency，不再依赖pallet_otc_listing）
    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<
        <T as frame_system::Config>::AccountId,
    >>::Balance;

    // 函数级中文注释：时间戳类型别名，用于记录订单的创建时间、超时时间等
    // 类型：u64，表示Unix时间戳（毫秒）
    pub type MomentOf<T> = <T as pallet_timestamp::Config>::Moment;

    // ===== 可治理风控参数（以存储为准，默认值来源于 Config 常量） =====
    #[pallet::type_value]
    pub fn DefaultOpenWindow<T: Config>() -> BlockNumberFor<T> {
        T::OpenWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultOpenMaxInWindow<T: Config>() -> u32 {
        T::OpenMaxInWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultPaidWindow<T: Config>() -> BlockNumberFor<T> {
        T::PaidWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultPaidMaxInWindow<T: Config>() -> u32 {
        T::PaidMaxInWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultConfirmTTL<T: Config>() -> BlockNumberFor<T> {
        T::ConfirmTTL::get()
    }
    #[pallet::type_value]
    pub fn DefaultMinOrderAmount<T: Config>() -> BalanceOf<T> {
        Default::default()
    }
    // 移除 DefaultMinOrderAmount，MinOrderAmount 改为无默认值的 ValueQuery=Default()

    /// 吃单限频窗口（块）
    #[pallet::storage]
    pub type OpenWindowParam<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultOpenWindow<T>>;
    /// 窗口内最多吃单数
    #[pallet::storage]
    pub type OpenMaxInWindowParam<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultOpenMaxInWindow<T>>;
    /// 标记支付限频窗口（块）
    #[pallet::storage]
    pub type PaidWindowParam<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultPaidWindow<T>>;
    /// 窗口内最多标记支付数
    #[pallet::storage]
    pub type PaidMaxInWindowParam<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultPaidMaxInWindow<T>>;
    /// 订单最小金额
    #[pallet::storage]
    pub type MinOrderAmount<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultMinOrderAmount<T>>;
    /// 订单确认 TTL（块）
    #[pallet::storage]
    pub type ConfirmTTLParam<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultConfirmTTL<T>>;
    #[pallet::storage]
    pub type Orders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        Order<T::AccountId, BalanceOf<T>, MomentOf<T>>,
        OptionQuery,
    >;
    #[pallet::storage]
    pub type NextOrderId<T: Config> = StorageValue<_, u64, ValueQuery>;
    /// 到期订单索引：在指定区块高度到期的订单集合
    #[pallet::storage]
    /// 到期订单索引：在指定区块高度到期的订单集合
    // 🆕 2025-10-20：移除对 pallet_otc_listing::Config 的依赖，使用本pallet的 MaxExpiringPerBlock
    pub type ExpiringAt<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<u64, <T as Config>::MaxExpiringPerBlock>,
        ValueQuery,
    >;

    #[pallet::storage]
    /// 函数级中文注释：吃单限频（账户 -> (窗口起点高度, 窗口内计数)）
    pub type OpenRate<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;
    #[pallet::storage]
    /// 函数级中文注释：标记支付限频（账户 -> (窗口起点高度, 窗口内计数)）
    pub type PaidRate<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;

    /// 函数级中文注释：首购信息结构
    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct FirstPurchaseInfo<AccountId, BlockNumber> {
        /// 购买金额（MEMO最小单位）
        pub amount: u128,
        /// 购买时间（区块高度）
        pub purchased_at: BlockNumber,
        /// 推荐人（可选）
        pub referrer: Option<AccountId>,
        /// 法币订单号（用于审计追溯，最多64字节）
        pub fiat_order_id: BoundedVec<u8, ConstU32<64>>,
    }

    /// 函数级中文注释：首购记录（用于限制每地址仅首购一次）
    #[pallet::storage]
    pub type FirstPurchaseRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        FirstPurchaseInfo<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 函数级中文注释：归档清理开关（治理可配置）
    /// true = 启用自动清理，false = 禁用（默认启用）
    #[pallet::storage]
    pub type ArchiveEnabled<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：上次自动清理的区块高度
    /// 用于控制清理频率（避免每个区块都执行清理）
    #[pallet::storage]
    pub type LastCleanupBlock<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    /// 函数级中文注释：待清理订单游标
    /// 记录上次清理停止的位置，下次从此处继续（用于分批清理大量数据）
    #[pallet::storage]
    pub type CleanupCursor<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 🆕 2025-10-19：已使用的TRON交易哈希（防止重放攻击）
    /// 函数级详细中文注释：存储已验证的TRON交易哈希，确保每笔USDT转账只能用于一个订单
    /// 
    /// Key: BoundedVec<u8, ConstU32<64>> - TRON交易哈希（十六进制字符串）
    /// Value: (u64, BlockNumberFor<T>) - (订单ID, 验证区块号)
    /// 
    /// 作用：
    /// - 防止恶意用户用同一笔USDT转账创建多个订单（重放攻击）
    /// - 提供审计追踪：查询TRON交易哈希对应的订单
    /// - 争议解决：快速定位交易对应的订单
    /// 
    /// 清理策略：
    /// - 保留期：180天（TronTxHashRetentionPeriod配置）
    /// - 清理方式：定期清理过期记录（by governance或on_initialize）
    /// - 性能：使用Blake2_128Concat索引，查询效率高
    #[pallet::storage]
    pub type UsedTronTxHashes<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BoundedVec<u8, ConstU32<64>>,
        (u64, BlockNumberFor<T>),
        OptionQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：订单创建事件（补充快照字段，便于索引器建模）
        /// 参数：订单ID、做市商ID、做市商账户、买家、价格（u64，USDT精度10^6）、数量、金额、做市商TRON地址、创建时间（Unix时间戳毫秒）、超时时间（Unix时间戳毫秒）
        /// 🆕 2025-10-20：移除listing_id，改为maker_id和maker_tron_address
        OrderOpened {
            id: u64,
            maker_id: u64,
            maker: T::AccountId,
            taker: T::AccountId,
            price: u64,
            qty: BalanceOf<T>,
            amount: BalanceOf<T>,
            maker_tron_address: BoundedVec<u8, sp_core::ConstU32<64>>,
            created_at: MomentOf<T>,
            expire_at: MomentOf<T>,
        },
        /// 函数级中文注释：买家已支付或提交支付承诺
        OrderPaidCommitted {
            id: u64,
        },
        /// ✅ 2025-10-23：买家撤回"已标记付款"（P1优化）
        /// 函数级详细中文注释：买家在 5 分钟撤回窗口内撤回已标记付款
        MarkPaidCancelled {
            id: u64,
        },
        OrderReleased {
            id: u64,
        },
        OrderRefunded {
            id: u64,
        },
        OrderCanceled {
            id: u64,
        },
        /// 函数级中文注释：订单被标记为争议中（仅状态标识，实际仲裁登记由仲裁 pallet 完成）
        OrderDisputed {
            id: u64,
        },
        /// 支付承诺已揭示并校验通过
        PaymentRevealed {
            id: u64,
        },
        /// 联系方式承诺已揭示并校验通过
        ContactRevealed {
            id: u64,
        },
        /// 风控参数已更新（治理）
        OrderParamsUpdated,
        /// 函数级中文注释：首购完成事件
        /// - buyer: 购买者地址
        /// - amount: 购买金额（MEMO最小单位）
        /// - referrer: 推荐人地址（Some=真实推荐人，None=无推荐人）
        /// - fiat_order_id: 法币订单号
        /// - purchased_at: 购买时间（区块高度）
        FirstPurchaseCompleted {
            buyer: T::AccountId,
            amount: BalanceOf<T>,
            referrer: Option<T::AccountId>,
            fiat_order_id: BoundedVec<u8, ConstU32<64>>,
            purchased_at: BlockNumberFor<T>,
        },
        /// 函数级中文注释：订单已归档清理
        /// - order_id: 订单ID
        /// - order_age_days: 订单年龄（天数）
        OrderArchived {
            order_id: u64,
            order_age_days: u32,
        },
        /// 函数级中文注释：批量归档完成
        /// - count: 本次清理的订单数量
        /// - total_orders: 当前总订单数
        BatchArchiveCompleted {
            count: u32,
            total_orders: u64,
        },
        /// 函数级中文注释：归档清理开关已更新
        ArchiveEnabledSet {
            enabled: bool,
        },
        /// 🆕 2025-10-21：做市商确认支付事件（通过EPAY中继服务自动标记）
        /// 函数级详细中文注释：做市商的中继服务收到EPAY支付通知后，调用链上接口标记订单已支付
        /// - order_id: 订单ID
        /// - maker_id: 做市商ID
        /// - maker: 做市商账户地址
        /// - taker: 买家账户地址
        /// - amount: 订单金额
        /// - epay_trade_no: EPAY交易号（用于关联支付记录）
        PaymentConfirmedByMaker {
            order_id: u64,
            maker_id: u64,
            maker: T::AccountId,
            taker: T::AccountId,
            amount: BalanceOf<T>,
            epay_trade_no: BoundedVec<u8, ConstU32<64>>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadState,
        BadCommit,
        /// 函数级中文注释：未授权的调用者（仅法币网关服务可调用）
        Unauthorized,
        /// 函数级中文注释：已经完成过首购
        AlreadyPurchased,
        /// 函数级中文注释：金额超出首购限制
        AmountOutOfRange,
        /// 函数级中文注释：推荐人无效（不是有效会员）
        InvalidReferrer,
        /// 🆕 2025-10-19：做市商业务方向不支持该操作（OTC需要Sell或BuyAndSell）
        DirectionNotSupported,
        /// 🆕 2025-10-19：做市商无效或未激活
        InvalidMaker,
        /// 🆕 2025-10-19：TRON交易哈希已被使用（防止重放攻击）
        TronTxHashAlreadyUsed,
        /// 🆕 2025-10-20：做市商未找到
        MakerNotFound,
        /// 🆕 2025-10-20：做市商未批准
        MakerNotApproved,
        /// 🆕 2025-10-20：价格不可用
        PriceNotAvailable,
        /// 🆕 2025-10-20：买家余额不足
        InsufficientBalance,
        /// 🆕 2025-10-20：做市商TRON地址未设置
        MakerTronAddressNotSet,
        /// 🆕 2025-10-20：价格太低（低于最小接受价格）
        PriceTooLow,
        /// 🆕 2025-10-20：价格太高（高于最大接受价格）
        PriceTooHigh,
        /// 🆕 2025-10-22：做市商信用分过低，已暂停接单
        MakerSuspended,
        /// ✅ 2025-10-23：做市商流动性不足（P1优化）
        /// 函数级详细中文注释：做市商可用余额不足，无法锁定足够的 MEMO
        /// - 前端提示："该做市商当前流动性不足，请选择其他做市商或减少购买数量"
        MakerInsufficientLiquidity,
        /// ✅ 2025-10-23：撤回窗口已过期（P1优化）
        /// 函数级详细中文注释：买家标记已付款后，撤回窗口（5分钟）已过期
        /// - 前端提示："撤回窗口已过期，如有问题请发起争议"
        CancelWindowExpired,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 🆕 2025-10-20：重构后的创建订单接口
        /// 函数级详细中文注释：直接从做市商创建OTC订单（无需挂单）
        /// 
        /// # 参数
        /// - `origin`: 买家账户
        /// - `maker_id`: 做市商ID
        /// - `qty`: MEMO数量（精度10^12）
        /// - `payment_commit`: 支付凭证承诺哈希
        /// - `contact_commit`: 联系方式承诺哈希
        /// 
        /// # 价格计算
        /// 1. 从 pallet-pricing 获取基准价 base_price
        /// 2. 从 pallet-market-maker 获取做市商溢价 sell_premium_bps
        /// 3. 计算最终价格：final_price = base_price * (10000 + sell_premium_bps) / 10000
        /// 4. 调用 pallet-pricing::check_price_deviation() 验证偏离（±20%）
        /// 
        /// # 验证
        /// - 做市商必须存在且状态为 Approved
        /// - 做市商 direction 必须是 Sell 或 BuyAndSell
        /// - 价格偏离必须在 ±20% 范围内
        /// - 买家余额必须足够
        /// - 资金锁入托管账户（Escrow）
        #[pallet::call_index(0)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(4, 3))]
        pub fn open_order(
            origin: OriginFor<T>,
            maker_id: u64,
            qty: BalanceOf<T>,
            payment_commit: H256,
            contact_commit: H256,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 🆕 2025-10-20：步骤1 - 读取做市商信息
            let maker_info = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerNotFound)?;
            
            // 🆕 2025-10-20：步骤2 - 验证做市商状态
            ensure!(
                maker_info.status == pallet_market_maker::ApplicationStatus::Active,
                Error::<T>::MakerNotApproved
            );
            
            // 🆕 2025-10-22：步骤2.5 - 检查做市商信用状态
            // 函数级详细中文注释：确保做市商信用分 >= 750，未被暂停接单
            // - Active: 可接单
            // - Warning (750-799): 可接单，但有警告
            // - Suspended (< 750): 不可接单
            let maker_credit_status = <T as Config>::MakerCredit::check_service_status(maker_id)?;
            ensure!(
                !matches!(maker_credit_status, pallet_credit::maker::ServiceStatus::Suspended),
                Error::<T>::MakerSuspended
            );
            
            // 🆕 2025-10-20：步骤3 - 验证做市商方向（OTC = Sell 或 BuyAndSell）
            ensure!(
                matches!(maker_info.direction, pallet_market_maker::Direction::Sell | pallet_market_maker::Direction::BuyAndSell),
                Error::<T>::DirectionNotSupported
            );
            
            // 🆕 2025-10-20：步骤4 - 获取基准价格（pallet-pricing市场加权均价）
            let base_price_u64 = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            ensure!(base_price_u64 > 0, Error::<T>::PriceNotAvailable);
            
            // 🆕 2025-10-20：步骤5 - 应用做市商溢价（OTC使用sell_premium_bps）
            // 例如：base_price=10000 (0.01 USDT), sell_premium_bps=200 (+2%)
            // final_price = 10000 * (10000 + 200) / 10000 = 10200 (0.0102 USDT)
            let sell_premium = maker_info.sell_premium_bps;
            let final_price_u64 = base_price_u64
                .saturating_mul((10000i32 + sell_premium as i32) as u64)
                .saturating_div(10000);
            
            // 🆕 2025-10-20：步骤6 - 价格偏离检查（±20%）
            pallet_pricing::Pallet::<T>::check_price_deviation(final_price_u64)?;
            
            // 🆕 2025-10-20：步骤7 - 转换价格类型
            let final_price_b: BalanceOf<T> = (final_price_u64 as u128).saturated_into();
            
            // 🆕 2025-10-20：步骤8 - 计算订单总金额
            let qty_b: BalanceOf<T> = qty;
            let divisor: BalanceOf<T> = 1_000_000u128.saturated_into();
            let amount_b: BalanceOf<T> = final_price_b
                .saturating_mul(qty_b) / divisor;
            
            // 🆕 2025-10-21：步骤8.1 - 买家信用限额检查（AI风控）
            // 函数级详细中文注释：调用 pallet-buyer-credit 检查买家的单笔/每日限额、冷却期等
            // - amount_usdt: 订单金额（USDT，精度6）
            // - 失败时返回错误：CreditScoreTooLow, ExceedSingleLimit, ExceedDailyLimit, InCooldownPeriod
            let amount_usdt = final_price_u64.saturating_mul(qty_b.saturated_into::<u64>()) / 1_000_000_000_000u64;
            pallet_credit::Pallet::<T>::check_buyer_limit(&who, amount_usdt)
                .map_err(|_| Error::<T>::BadState)?;  // 暂时映射到 BadState，后续可以添加专门的错误类型
            
            // 🆕 2025-10-20：步骤9 - 验证买家余额
            let buyer_balance = <T as Config>::Currency::free_balance(&who);
            ensure!(buyer_balance >= amount_b, Error::<T>::InsufficientBalance);
            
            // 🆕 2025-10-20：步骤10 - 最小金额检查
            ensure!(amount_b >= MinOrderAmount::<T>::get(), Error::<T>::BadState);
            
            // 🆕 2025-10-20：步骤11 - 吃单限频检查
            let (wstart, cnt) = OpenRate::<T>::get(&who);
            let now = <frame_system::Pallet<T>>::block_number();
            let window = OpenWindowParam::<T>::get();
            let (wstart, cnt) = if now.saturating_sub(wstart) > window {
                (now, 0u32)
            } else {
                (wstart, cnt)
            };
            ensure!(cnt < OpenMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            OpenRate::<T>::insert(&who, (wstart, cnt.saturating_add(1)));
            
            // 🆕 2025-10-20：步骤12 - 生成订单ID
            let order_id = NextOrderId::<T>::mutate(|x| {
                let id = *x;
                *x = id.saturating_add(1);
                id
            });
            
            // 🆕 2025-10-20：步骤13 - 获取时间戳
            let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
            let confirm_ttl_blocks = ConfirmTTLParam::<T>::get();
            let confirm_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 6u64 * 1000u64).saturated_into();
            let expire_timestamp = now_timestamp.saturating_add(confirm_ttl_ms);
            let evidence_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 2u64 * 6u64 * 1000u64).saturated_into();
            let evidence_timestamp = now_timestamp.saturating_add(evidence_ttl_ms);
            let expire_block = now.saturating_add(confirm_ttl_blocks);
            
            // 🆕 2025-10-20：步骤14 - 获取做市商账户和TRON地址
            let maker_acc = maker_info.owner.clone();
            ensure!(!maker_info.tron_address.is_empty(), Error::<T>::MakerTronAddressNotSet);
            let maker_tron_address = maker_info.tron_address.clone();
            
            // ✅ 2025-10-23：步骤15 - 锁定做市商的MEMO到托管（统一托管流程+流动性检查）
            // 函数级详细中文注释：采用做市商托管模式，适用于法币交易
            // - 做市商锁定 MEMO 到托管账户
            // - 买家链下支付法币
            // - 做市商确认收款后释放 MEMO 给买家
            // - 如果做市商余额不足，返回友好的错误提示
            <T as Config>::Escrow::lock_from(&maker_info.owner, order_id, qty)
                .map_err(|_| Error::<T>::MakerInsufficientLiquidity)?;
            
            // 🆕 2025-10-20：步骤16 - 创建订单记录
            let order = Order::<_, _, _> {
                maker_id,                          // 🆕 使用maker_id（替代listing_id）
                maker: maker_acc.clone(),
                taker: who.clone(),
                price: final_price_b,
                qty: qty_b,
                amount: amount_b,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
                evidence_until: evidence_timestamp,
                maker_tron_address: maker_tron_address.clone(),
                payment_commit,
                contact_commit,
                state: OrderState::Created,
                epay_trade_no: None,              // 🆕 2025-10-21：初始化为None，等待做市商中继服务标记
                completed_at: None,               // H-2修复：记录完成时间
            };
            
            Orders::<T>::insert(order_id, &order);
            
            // 🆕 2025-10-20：步骤17 - 将订单ID加入到期区块索引
            ExpiringAt::<T>::mutate(expire_block, |v| {
                let _ = v.try_push(order_id);
            });
            
            // 🆕 2025-10-20：步骤18 - 发送事件
            Self::deposit_event(Event::OrderOpened {
                id: order_id,
                maker_id,                          // 🆕 使用maker_id（替代listing_id）
                maker: maker_acc,
                taker: who,
                price: final_price_u64,            // 使用u64存储USDT单价
                qty: qty_b,
                amount: amount_b,
                maker_tron_address,                // 🆕 添加TRON地址
                created_at: now_timestamp,
                expire_at: expire_timestamp,
            });
            
            // 🆕 2025-10-20：步骤19 - 上报价格给pallet-pricing
            // TODO: 实现价格上报逻辑（当前暂不实现）
            
            Ok(())
        }

        /// 函数级详细中文注释：买家标记"已支付/已提交凭据"，进入待放行阶段。
        /// - 要求：调用者必须为订单 taker，状态为 Created。
        #[pallet::call_index(1)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(2, 2))]
        pub fn mark_paid(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 标记支付限频：滑动窗口检查与更新
            let (wstart, cnt) = PaidRate::<T>::get(&who);
            let now_blk = <frame_system::Pallet<T>>::block_number();
            let window = PaidWindowParam::<T>::get();
            let (wstart, cnt) = if now_blk.saturating_sub(wstart) > window {
                (now_blk, 0u32)
            } else {
                (wstart, cnt)
            };
            ensure!(cnt < PaidMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            PaidRate::<T>::insert(&who, (wstart, cnt.saturating_add(1)));
            
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.taker == who, Error::<T>::BadState);
                ensure!(
                    matches!(ord.state, OrderState::Created),
                    Error::<T>::BadState
                );
                ord.state = OrderState::PaidOrCommitted;
                Ok(())
            })?;
            
            Self::deposit_event(Event::OrderPaidCommitted { id });
            Ok(())
        }

        /// ✅ 2025-10-23：函数级详细中文注释：买家撤回"已标记付款"（5分钟撤回窗口）
        /// 
        /// # 功能说明（P1优化）
        /// - 买家误点"标记已付款"后，可在 5 分钟内撤回
        /// - 超过 5 分钟后无法撤回，只能通过仲裁解决
        /// - 撤回后订单状态回到 Created，买家可重新标记或取消订单
        /// 
        /// # 参数
        /// - `origin`: 调用者（必须是订单的买家）
        /// - `id`: 订单ID
        /// 
        /// # 验证
        /// - 订单必须存在
        /// - 调用者必须是订单的买家（taker）
        /// - 订单状态必须是 PaidOrCommitted
        /// - 订单创建时间到现在必须小于 5 分钟
        /// 
        /// # 错误
        /// - `NotFound`: 订单不存在
        /// - `BadState`: 调用者不是买家或订单状态不是 PaidOrCommitted
        /// - `CancelWindowExpired`: 撤回窗口（5分钟）已过期
        #[pallet::call_index(13)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(2, 1))]
        pub fn cancel_mark_paid(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.taker == who, Error::<T>::BadState);
                ensure!(
                    matches!(ord.state, OrderState::PaidOrCommitted),
                    Error::<T>::BadState
                );
                
                // ✅ 2025-10-23：检查撤回时间窗口（可配置，P2优化）
                let now = <pallet_timestamp::Pallet<T>>::get();
                let elapsed = now.saturating_sub(ord.created_at);
                let cancel_window_ms: MomentOf<T> = T::CancelWindow::get();
                
                ensure!(
                    elapsed < cancel_window_ms,
                    Error::<T>::CancelWindowExpired
                );
                
                // 撤回：状态回到 Created
                ord.state = OrderState::Created;
                Ok(())
            })?;
            
            Self::deposit_event(Event::MarkPaidCancelled { id });
            Ok(())
        }

        /// 🆕 2025-10-21：函数级详细中文注释：做市商标记订单已支付（通过EPAY中继服务调用）
        /// 
        /// # 功能说明
        /// - 做市商的中继服务收到EPAY支付通知后，验证签名后调用此接口标记订单已支付
        /// - 记录EPAY交易号，用于关联支付记录和链上订单
        /// - 将订单状态从Created更新为PaidOrCommitted
        /// - 触发PaymentConfirmedByMaker事件，供做市商监听程序自动释放MEMO
        /// 
        /// # 参数
        /// - `origin`: 调用者（必须是订单对应的做市商）
        /// - `order_id`: 订单ID
        /// - `epay_trade_no`: EPAY交易号（最多64字节）
        /// 
        /// # 验证逻辑
        /// 1. 验证订单存在
        /// 2. 验证调用者是订单的做市商
        /// 3. 验证订单状态为Created（未支付）
        /// 4. 验证epay_trade_no不为空
        /// 
        /// # 执行流程
        /// 1. 更新订单状态为PaidOrCommitted
        /// 2. 记录EPAY交易号
        /// 3. 触发PaymentConfirmedByMaker事件
        /// 
        /// # 安全性
        /// - 只有订单对应的做市商可以调用（防止其他人恶意标记）
        /// - 只能标记Created状态的订单（防止重复标记）
        /// - EPAY交易号不可为空（确保可追溯）
        #[pallet::call_index(12)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(1, 1))]
        pub fn mark_order_paid_by_maker(
            origin: OriginFor<T>,
            order_id: u64,
            epay_trade_no: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证epay_trade_no不为空
            ensure!(!epay_trade_no.is_empty(), Error::<T>::BadState);
            ensure!(epay_trade_no.len() <= 64, Error::<T>::BadState);
            
            // 转换为BoundedVec
            let epay_trade_no_bounded: BoundedVec<u8, ConstU32<64>> = epay_trade_no
                .try_into()
                .map_err(|_| Error::<T>::BadState)?;
            
            // 更新订单状态
            Orders::<T>::try_mutate(order_id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                
                // 验证调用者是订单的做市商
                ensure!(ord.maker == who, Error::<T>::BadState);
                
                // 验证订单状态为Created
                ensure!(
                    matches!(ord.state, OrderState::Created),
                    Error::<T>::BadState
                );
                
                // 更新状态和EPAY交易号
                ord.state = OrderState::PaidOrCommitted;
                ord.epay_trade_no = Some(epay_trade_no_bounded.clone());
                
                Ok(())
            })?;
            
            // 获取订单信息用于事件
            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::NotFound)?;
            
            // 触发事件
            Self::deposit_event(Event::PaymentConfirmedByMaker {
                order_id,
                maker_id: order.maker_id,
                maker: order.maker,
                taker: order.taker,
                amount: order.amount,
                epay_trade_no: epay_trade_no_bounded,
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：标记订单为争议中（本地状态），实际仲裁登记由仲裁 pallet 的 extrinsic 完成。
        /// - 允许 maker/taker 在以下场景调用：
        ///   1) 已支付未放行（state=PaidOrCommitted）。
        ///   2) 超过 expire_at 且任一方不同意自动流程。
        ///   3) 仍在 evidence_until 窗口内（证据追加期）。
        #[pallet::call_index(2)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(1, 1))]
        pub fn mark_disputed(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 函数级中文注释：获取当前时间戳（毫秒），用于超时判断
            let now = <pallet_timestamp::Pallet<T>>::get();
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.maker == who || ord.taker == who, Error::<T>::BadState);
                let cond_paid_unreleased = matches!(ord.state, OrderState::PaidOrCommitted);
                let cond_expired = now >= ord.expire_at;
                let cond_evidence_window = now <= ord.evidence_until;
                ensure!(
                    cond_paid_unreleased || cond_expired || cond_evidence_window,
                    Error::<T>::BadState
                );
                ord.state = OrderState::Disputed;
                Ok(())
            })?;
            Self::deposit_event(Event::OrderDisputed { id });
            Ok(())
        }

        /// 函数级详细中文注释：卖家放行（将托管金额划转给买家，订单完成）。
        /// - 要求：调用者为 maker；状态为 PaidOrCommitted 或 Disputed。
        #[pallet::call_index(3)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(2, 2))]
        pub fn release(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 函数级中文注释：提取订单信息用于价格聚合更新
            let (price_usdt, memo_qty, timestamp) = {
                let ord = Orders::<T>::get(id).ok_or(Error::<T>::NotFound)?;
                (ord.price.saturated_into::<u64>(), ord.qty.saturated_into::<u128>(), ord.created_at.saturated_into::<u64>())
            };
            
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.maker == who, Error::<T>::BadState);
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                
                // 统一托管流程：从托管账户转账
                // 函数级详细中文注释：转账的是 qty（MEMO数量），而不是 amount（订单金额）
                // - qty: 实际购买的MEMO数量（最小单位）
                // - amount: 订单金额（price * qty，用于记录和显示）
                <T as Config>::Escrow::transfer_from_escrow(
                    ord.maker_id,
                    &ord.taker,
                    ord.qty,
                )?;
                
                ord.state = OrderState::Released;
                Ok(())
            })?;
            
            // 函数级中文注释：订单完成后，添加到 pallet-pricing 的 OTC 价格聚合统计
            // 忽略错误（不影响订单放行流程）
            let _ = pallet_pricing::Pallet::<T>::add_otc_order(timestamp, price_usdt, memo_qty);
            
            // 🆕 2025-10-21：订单完成后更新买家信用（快速学习）
            // 函数级详细中文注释：计算付款时间，更新信用分和等级
            // - payment_time: 从订单创建到确认的时间（秒）
            // - 前3笔订单权重5x，快速建立信用画像
            let ord = Orders::<T>::get(id).ok_or(Error::<T>::NotFound)?;
            let current_timestamp = <pallet_timestamp::Pallet<T>>::get();
            let payment_time_ms = current_timestamp.saturating_sub(ord.created_at);
            let payment_time_seconds = payment_time_ms.saturated_into::<u64>() / 1000u64;
            let amount_usdt = price_usdt.saturating_mul(memo_qty as u64) / 1_000_000_000_000u64;
            pallet_credit::Pallet::<T>::update_credit_on_success(
                &ord.taker,
                amount_usdt,
                payment_time_seconds,
            );
            
            // 🆕 2025-10-22：订单完成后更新做市商信用
            // 函数级详细中文注释：计算响应时间（从创建到释放），更新做市商信用分
            // - response_time: 从订单创建到释放的时间（秒）
            // - 基础奖励：+2分
            // - 及时释放（< 24h）：额外 +1分
            let response_time_seconds = payment_time_seconds;
            let _ = <T as Config>::MakerCredit::record_order_completed(
                ord.maker_id,
                id,
                response_time_seconds as u32,
            );
            
            Self::deposit_event(Event::OrderReleased { id });
            Ok(())
        }

        /// 函数级详细中文注释：超时退款（任意人可触发，在状态与时窗满足时退回买家或卖家）。
        /// - 最小实现：仅当未放行且超过 expire_at，并处于 Created/PaidOrCommitted/Disputed 之一时，退回买家。
        #[pallet::call_index(4)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(2, 2))]
        pub fn refund_on_timeout(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            // 函数级中文注释：获取当前时间戳（毫秒），用于超时判断
            let now = <pallet_timestamp::Pallet<T>>::get();
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(now >= ord.expire_at, Error::<T>::BadState);
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::Created | OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                // 🆕 2025-10-20：移除库存恢复逻辑（不再管理挂单库存）
                
                // 🆕 2025-10-21：超时违约惩罚（买家未按时付款）
                // 函数级详细中文注释：如果订单在 Created 状态超时，说明买家下单后未付款，记录违约
                // - 违约次数+1，风险分增加（新手+50分，老用户+5分）
                // - 推荐关系失效，推荐人也会受连带责任
                let taker = ord.taker.clone();
                if matches!(ord.state, OrderState::Created | OrderState::PaidOrCommitted) {
                    pallet_credit::Pallet::<T>::penalize_default(&taker);
                }
                
                ord.state = OrderState::Refunded;
                Ok(())
            })?;
            Self::deposit_event(Event::OrderRefunded { id });
            Ok(())
        }

        /// 函数级详细中文注释：揭示支付承诺
        /// - 计算 blake2_256(payload||salt) 与存储的 payment_commit 比较，不一致则报错
        #[pallet::call_index(5)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(1, 1))]
        pub fn reveal_payment(
            origin: OriginFor<T>,
            id: u64,
            payload: Vec<u8>,
            salt: Vec<u8>,
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            let ok = if let Some(o) = Orders::<T>::get(id) {
                let mut buf = payload.clone();
                buf.extend_from_slice(&salt);
                H256::from(blake2_256(&buf)) == o.payment_commit
            } else {
                false
            };
            ensure!(ok, Error::<T>::BadCommit);
            Self::deposit_event(Event::PaymentRevealed { id });
            Ok(())
        }

        /// 函数级详细中文注释：揭示联系方式承诺
        /// - 校验哈希一致性
        #[pallet::call_index(6)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(1, 1))]
        pub fn reveal_contact(
            origin: OriginFor<T>,
            id: u64,
            payload: Vec<u8>,
            salt: Vec<u8>,
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            let ok = if let Some(o) = Orders::<T>::get(id) {
                let mut buf = payload.clone();
                buf.extend_from_slice(&salt);
                H256::from(blake2_256(&buf)) == o.contact_commit
            } else {
                false
            };
            ensure!(ok, Error::<T>::BadCommit);
            Self::deposit_event(Event::ContactRevealed { id });
            Ok(())
        }

        /// 函数级详细中文注释：治理更新订单风控参数
        /// - 仅允许 Root 调用；未提供的参数保持不变。
        #[pallet::call_index(7)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(1, 1))]
        pub fn set_order_params(
            origin: OriginFor<T>,
            open_window: Option<BlockNumberFor<T>>,
            open_max_in_window: Option<u32>,
            paid_window: Option<BlockNumberFor<T>>,
            paid_max_in_window: Option<u32>,
            min_order_amount: Option<BalanceOf<T>>,
            confirm_ttl: Option<BlockNumberFor<T>>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            if let Some(v) = open_window {
                OpenWindowParam::<T>::put(v);
            }
            if let Some(v) = open_max_in_window {
                OpenMaxInWindowParam::<T>::put(v);
            }
            if let Some(v) = paid_window {
                PaidWindowParam::<T>::put(v);
            }
            if let Some(v) = paid_max_in_window {
                PaidMaxInWindowParam::<T>::put(v);
            }
            if let Some(v) = min_order_amount {
                MinOrderAmount::<T>::put(v);
            }
            if let Some(v) = confirm_ttl {
                ConfirmTTLParam::<T>::put(v);
            }
            Self::deposit_event(Event::OrderParamsUpdated);
            Ok(())
        }

        /// 函数级详细中文注释：吃单→创建订单（带滑点保护，去除前端价格与金额参数）
        /// - 输入：`listing_id`、`qty`、`payment_commit`、`contact_commit`、可选 `min_accept_price`/`max_accept_price`
        /// - 定价：读取 `pallet-pricing` 当前价并校验不陈旧；`exec_price = floor(num/den) * (1 + spread_bps/10000)`
        /// - 保护：若提供 `min/max` 则确保 `min ≤ exec_price ≤ max`；并校验做市商价带 `price_min/max`
        /// - 资金：库存托管模式仅扣减剩余库存；放行时从 listing 托管划转
        #[pallet::call_index(8)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(4, 4))]
        pub fn open_order_with_protection(
            origin: OriginFor<T>,
            maker_id: u64,
            qty: BalanceOf<T>,
            payment_commit: H256,
            contact_commit: H256,
            min_accept_price: Option<BalanceOf<T>>,
            max_accept_price: Option<BalanceOf<T>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 🆕 2025-10-20：步骤1 - 读取做市商信息（与open_order相同）
            let maker_info = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerNotFound)?;
            
            // 🆕 2025-10-20：步骤2-6 - 状态验证、方向检查、价格计算（与open_order相同）
            ensure!(
                maker_info.status == pallet_market_maker::ApplicationStatus::Active,
                Error::<T>::MakerNotApproved
            );
            ensure!(
                matches!(maker_info.direction, pallet_market_maker::Direction::Sell | pallet_market_maker::Direction::BuyAndSell),
                Error::<T>::DirectionNotSupported
            );
            
            let base_price_u64 = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            ensure!(base_price_u64 > 0, Error::<T>::PriceNotAvailable);
            
            let sell_premium = maker_info.sell_premium_bps;
            let final_price_u64 = base_price_u64
                .saturating_mul((10000i32 + sell_premium as i32) as u64)
                .saturating_div(10000);
            
            pallet_pricing::Pallet::<T>::check_price_deviation(final_price_u64)?;
            
            // 🆕 2025-10-20：步骤7-8 - 价格转换和金额计算
            let final_price_b: BalanceOf<T> = (final_price_u64 as u128).saturated_into();
            let qty_b: BalanceOf<T> = qty;
            let divisor: BalanceOf<T> = 1_000_000u128.saturated_into();
            let amount_b: BalanceOf<T> = final_price_b
                .saturating_mul(qty_b) / divisor;
            
            // 🆕 2025-10-21：步骤8.1 - 买家信用限额检查（AI风控）
            let amount_usdt = final_price_u64.saturating_mul(qty_b.saturated_into::<u64>()) / 1_000_000_000_000u64;
            pallet_credit::Pallet::<T>::check_buyer_limit(&who, amount_usdt)
                .map_err(|_| Error::<T>::BadState)?;
            
            // 🆕 2025-10-20：额外的价格保护检查（min/max_accept_price）
            if let Some(min_price) = min_accept_price {
                ensure!(final_price_b >= min_price, Error::<T>::PriceTooLow);
            }
            if let Some(max_price) = max_accept_price {
                ensure!(final_price_b <= max_price, Error::<T>::PriceTooHigh);
            }
            
            // 🆕 2025-10-20：步骤9-11 - 余额、最小金额、限频检查（与open_order相同）
            let buyer_balance = <T as Config>::Currency::free_balance(&who);
            ensure!(buyer_balance >= amount_b, Error::<T>::InsufficientBalance);
            ensure!(amount_b >= MinOrderAmount::<T>::get(), Error::<T>::BadState);
            
            let (wstart, cnt) = OpenRate::<T>::get(&who);
            let now = <frame_system::Pallet<T>>::block_number();
            let window = OpenWindowParam::<T>::get();
            let (wstart, cnt) = if now.saturating_sub(wstart) > window {
                (now, 0u32)
            } else {
                (wstart, cnt)
            };
            ensure!(cnt < OpenMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            OpenRate::<T>::insert(&who, (wstart, cnt.saturating_add(1)));
            
            // 🆕 2025-10-20：步骤12-14 - 订单ID、时间戳、地址获取（与open_order相同）
            let order_id = NextOrderId::<T>::mutate(|x| {
                let id = *x;
                *x = id.saturating_add(1);
                id
            });
            
            let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
            let confirm_ttl_blocks = ConfirmTTLParam::<T>::get();
            let confirm_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 6u64 * 1000u64).saturated_into();
            let expire_timestamp = now_timestamp.saturating_add(confirm_ttl_ms);
            let evidence_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 2u64 * 6u64 * 1000u64).saturated_into();
            let evidence_timestamp = now_timestamp.saturating_add(evidence_ttl_ms);
            let expire_block = now.saturating_add(confirm_ttl_blocks);
            
            let maker_acc = maker_info.owner.clone();
            ensure!(!maker_info.tron_address.is_empty(), Error::<T>::MakerTronAddressNotSet);
            let maker_tron_address = maker_info.tron_address.clone();
            
            // ✅ 2025-10-23：步骤15 - 锁定做市商的MEMO到托管（统一托管流程+流动性检查）
            // 函数级详细中文注释：采用做市商托管模式，与 open_order 保持一致
            // - 如果做市商余额不足，返回友好的错误提示
            <T as Config>::Escrow::lock_from(&maker_info.owner, order_id, qty)
                .map_err(|_| Error::<T>::MakerInsufficientLiquidity)?;
            
            // 🆕 2025-10-20：步骤16-19 - 创建订单、索引、事件、上报价格
            let order = Order::<_, _, _> {
                maker_id,
                maker: maker_acc.clone(),
                taker: who.clone(),
                price: final_price_b,
                qty: qty_b,
                amount: amount_b,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
                evidence_until: evidence_timestamp,
                maker_tron_address: maker_tron_address.clone(),
                payment_commit,
                contact_commit,
                state: OrderState::Created,
                epay_trade_no: None,              // 🆕 2025-10-21：初始化为None，等待做市商中继服务标记
                completed_at: None,               // H-2修复：记录完成时间
            };
            
            Orders::<T>::insert(order_id, &order);
            
            ExpiringAt::<T>::mutate(expire_block, |v| {
                let _ = v.try_push(order_id);
            });
            
            Self::deposit_event(Event::OrderOpened {
                id: order_id,
                maker_id,
                maker: maker_acc,
                taker: who,
                price: final_price_u64,
                qty: qty_b,
                amount: amount_b,
                maker_tron_address,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
            });
            
            // TODO: 实现价格上报逻辑（当前暂不实现）
            
            Ok(())
        }


        /// 函数级中文注释：手动归档清理旧订单
        /// 
        /// # 参数
        /// - origin: Root权限
        /// - max_count: 本次最多清理的订单数（防止Gas爆炸）
        /// 
        /// # 逻辑
        /// 1. 遍历所有订单
        /// 2. 检查订单是否满足归档条件：
        ///    - 状态必须是终态（Released/Refunded/Closed/Canceled）
        ///    - 创建时间超过归档阈值（默认150天）
        /// 3. 删除符合条件的订单
        /// 4. 记录清理统计
        #[pallet::call_index(21)]
        #[pallet::weight(T::DbWeight::get().reads_writes(100, 100))]
        pub fn cleanup_archived_orders(
            origin: OriginFor<T>,
            max_count: u32,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            let threshold_days = <T as Config>::ArchiveThresholdDays::get();
            let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
            
            // 计算截止时间戳（150天前）
            // 1天 = 24小时 * 60分钟 * 60秒 * 1000毫秒 = 86,400,000毫秒
            let cutoff_ms: u64 = (threshold_days as u64)
                .saturating_mul(24)
                .saturating_mul(3600)
                .saturating_mul(1000);
            let cutoff_timestamp = now_timestamp.saturating_sub(cutoff_ms.saturated_into());
            
            let mut cleaned = 0u32;
            let cursor = CleanupCursor::<T>::get();
            let mut next_cursor = cursor;
            
            // 从游标位置开始遍历订单
            for (id, order) in Orders::<T>::iter() {
                if id < cursor {
                    continue; // 跳过已处理的订单
                }
                
                if cleaned >= max_count {
                    next_cursor = id;
                    break;
                }
                
                // 只清理终态订单
                let is_final_state = matches!(
                    order.state,
                    OrderState::Released | OrderState::Refunded | OrderState::Closed | OrderState::Canceled
                );
                
                if is_final_state && order.created_at < cutoff_timestamp {
                    // 计算订单年龄（天数）
                    let age_ms: u64 = now_timestamp.saturating_sub(order.created_at).saturated_into();
                    let age_days = (age_ms / 86_400_000) as u32;
                    
                    Orders::<T>::remove(id);
                    cleaned += 1;
                    
                    Self::deposit_event(Event::OrderArchived {
                        order_id: id,
                        order_age_days: age_days,
                    });
                }
            }
            
            // 更新游标
            CleanupCursor::<T>::put(next_cursor);
            
            // 记录统计
            let total_orders = NextOrderId::<T>::get();
            Self::deposit_event(Event::BatchArchiveCompleted {
                count: cleaned,
                total_orders,
            });
            
            Ok(())
        }

        /// 函数级中文注释：设置归档清理开关
        /// 
        /// # 参数
        /// - origin: Root权限
        /// - enabled: true=启用自动清理，false=禁用
        #[pallet::call_index(22)]
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
        
        /// 🆕 2025-10-22：买家创建订单（使用免费配额）
        /// 
        /// # 函数级详细中文注释
        /// 买家创建订单，如果有免费配额，无需支付 Gas；否则返回错误。
        /// 
        /// # 参数
        /// - `origin`: 买家签名
        /// - `maker_id`: 做市商 ID
        /// - `qty`: 购买数量（MEMO，精度 10^18）
        /// - `payment_commit`: 支付凭证承诺（Hash）
        /// - `contact_commit`: 联系方式承诺（Hash）
        /// 
        /// # 免费配额机制
        /// 1. 检查买家是否有免费配额（每个做市商独立配额）
        /// 2. 如果有配额，递减配额并创建订单
        /// 3. 如果无配额，返回错误 `FreeQuotaExhausted`
        /// 4. 做市商可通过 `set_free_quota_config` 设置每个新买家的默认免费次数
        /// 5. 做市商可通过 `grant_free_quota` 为特定买家增加额外配额
        /// 
        /// # 业务流程
        /// 与 `open_order` 相同，但使用免费配额：
        /// 1. 检查免费配额 ✅
        /// 2. 验证做市商状态
        /// 3. 获取价格并应用溢价
        /// 4. 买家信用检查
        /// 5. 锁定做市商MEMO到托管
        /// 6. 创建订单
        /// 
        /// # 权重
        /// - 读取：5（做市商 + 买家配额 + 买家信用 + 价格 + 托管）
        /// - 写入：3（订单 + 买家配额 + 托管）
        /// 
        /// # 错误
        /// - `FreeQuotaExhausted`: 免费配额已用完
        /// - `MakerNotFound`: 做市商不存在
        /// - `MakerNotApproved`: 做市商未激活
        /// - `DirectionNotSupported`: 做市商不支持OTC业务
        /// - `PriceNotAvailable`: 价格不可用
        /// - `InsufficientBalance`: 买家余额不足
        /// - `BadState`: 其他状态错误
        /// 
        /// # 事件
        /// - `OrderCreated`: 订单已创建
        /// - `FreeQuotaConsumed`: 免费配额已消费（由 market-maker pallet 触发）
        #[pallet::call_index(23)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(5, 3))]
        pub fn open_order_free(
            origin: OriginFor<T>,
            maker_id: u64,
            qty: BalanceOf<T>,
            payment_commit: H256,
            contact_commit: H256,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 步骤1 - 读取做市商信息
            let maker_info = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::MakerNotFound)?;
            
            // 步骤2 - 验证做市商状态
            ensure!(
                maker_info.status == pallet_market_maker::ApplicationStatus::Active,
                Error::<T>::MakerNotApproved
            );
            
            // 步骤3 - 验证做市商方向（OTC = Sell 或 BuyAndSell）
            ensure!(
                matches!(maker_info.direction, pallet_market_maker::Direction::Sell | pallet_market_maker::Direction::BuyAndSell),
                Error::<T>::DirectionNotSupported
            );
            
            // 步骤4 - 获取基准价格
            let base_price_u64 = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            ensure!(base_price_u64 > 0, Error::<T>::PriceNotAvailable);
            
            // 步骤5 - 应用做市商溢价
            let sell_premium = maker_info.sell_premium_bps;
            let final_price_u64 = base_price_u64
                .saturating_mul((10000i32 + sell_premium as i32) as u64)
                .saturating_div(10000);
            
            // 步骤6 - 价格偏离检查
            pallet_pricing::Pallet::<T>::check_price_deviation(final_price_u64)?;
            
            // 步骤7 - 转换价格类型
            let final_price_b: BalanceOf<T> = (final_price_u64 as u128).saturated_into();
            
            // 步骤8 - 计算订单总金额
            let qty_b: BalanceOf<T> = qty;
            let divisor: BalanceOf<T> = 1_000_000u128.saturated_into();
            let amount_b: BalanceOf<T> = final_price_b
                .saturating_mul(qty_b) / divisor;
            
            // 步骤8.1 - 买家信用限额检查
            let amount_usdt = final_price_u64.saturating_mul(qty_b.saturated_into::<u64>()) / 1_000_000_000_000u64;
            pallet_credit::Pallet::<T>::check_buyer_limit(&who, amount_usdt)
                .map_err(|_| Error::<T>::BadState)?;
            
            // 步骤9 - 验证买家余额
            let buyer_balance = <T as Config>::Currency::free_balance(&who);
            ensure!(buyer_balance >= amount_b, Error::<T>::InsufficientBalance);
            
            // 步骤10 - 最小金额检查
            ensure!(amount_b >= MinOrderAmount::<T>::get(), Error::<T>::BadState);
            
            // 步骤11 - 吃单限频检查
            let (wstart, cnt) = OpenRate::<T>::get(&who);
            let now = <frame_system::Pallet<T>>::block_number();
            let window = OpenWindowParam::<T>::get();
            let (wstart, cnt) = if now.saturating_sub(wstart) > window {
                (now, 0u32)
            } else {
                (wstart, cnt)
            };
            ensure!(cnt < OpenMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            OpenRate::<T>::insert(&who, (wstart, cnt.saturating_add(1)));
            
            // 步骤12 - 生成订单ID
            let order_id = NextOrderId::<T>::mutate(|x| {
                let id = *x;
                *x = id.saturating_add(1);
                id
            });
            
            // 步骤13 - 获取时间戳
            let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
            let confirm_ttl_blocks = ConfirmTTLParam::<T>::get();
            let confirm_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 6u64 * 1000u64).saturated_into();
            let expire_timestamp = now_timestamp.saturating_add(confirm_ttl_ms);
            let evidence_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 2u64 * 6u64 * 1000u64).saturated_into();
            let evidence_timestamp = now_timestamp.saturating_add(evidence_ttl_ms);
            
            // 步骤14 - 锁定做市商的MEMO到托管（统一托管流程+流动性检查）
            // 函数级详细中文注释：如果做市商余额不足，返回友好的错误提示
            <T as Config>::Escrow::lock_from(&maker_info.owner, order_id, qty)
                .map_err(|_| Error::<T>::MakerInsufficientLiquidity)?;
            
            // 步骤15 - 创建订单
            let order = Order {
                maker_id,
                maker: maker_info.owner.clone(),
                taker: who.clone(),
                price: final_price_b,
                qty,
                amount: amount_b,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
                evidence_until: evidence_timestamp,
                maker_tron_address: maker_info.tron_address.clone(),
                payment_commit,
                contact_commit,
                state: OrderState::Created,
                epay_trade_no: None,
                completed_at: None,               // H-2修复：记录完成时间
            };
            
            Orders::<T>::insert(order_id, order);
            
            // 步骤16 - 触发事件
            Self::deposit_event(Event::OrderOpened {
                id: order_id,
                maker_id,
                maker: maker_info.owner,
                taker: who.clone(),
                price: final_price_u64,
                qty,
                amount: amount_b,
                maker_tron_address: maker_info.tron_address,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
            });
            
            Ok(())
        }
    }

    // 仲裁路由钩子：由 runtime 调用，用于放行/退款/部分放行（本 Pallet 内仅更新状态，不涉及资金划转）
    pub trait ArbitrationHook<T: Config> {
        /// 函数级中文注释：校验发起人是否可对该订单发起争议（maker/taker + 状态/时窗判断）
        fn can_dispute(who: &T::AccountId, id: u64) -> bool;
        fn arbitrate_release(id: u64) -> DispatchResult;
        fn arbitrate_refund(id: u64) -> DispatchResult;
        fn arbitrate_partial(id: u64, _bps: u16) -> DispatchResult;
    }

    impl<T: Config> ArbitrationHook<T> for Pallet<T> {
        fn can_dispute(who: &T::AccountId, id: u64) -> bool {
            if let Some(ord) = Orders::<T>::get(id) {
                // 函数级中文注释：获取当前时间戳（毫秒），用于超时判断
                let now = <pallet_timestamp::Pallet<T>>::get();
                let is_party = ord.maker == *who || ord.taker == *who;
                let cond_paid_unreleased = matches!(ord.state, OrderState::PaidOrCommitted);
                let cond_expired = now >= ord.expire_at;
                let cond_evidence_window = now <= ord.evidence_until;
                return is_party && (cond_paid_unreleased || cond_expired || cond_evidence_window);
            }
            false
        }
        fn arbitrate_release(id: u64) -> DispatchResult {
            // 函数级中文注释：提取订单信息用于价格聚合更新
            let (price_usdt, memo_qty, timestamp, maker_id) = {
                let ord = Orders::<T>::get(id).ok_or(Error::<T>::NotFound)?;
                (ord.price.saturated_into::<u64>(), ord.qty.saturated_into::<u128>(), ord.created_at.saturated_into::<u64>(), ord.maker_id)
            };
            
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                
                // 统一托管流程：从托管账户转账
                // 函数级详细中文注释：仲裁释放时转账数量（qty）而不是金额（amount）
                <T as Config>::Escrow::transfer_from_escrow(
                    ord.maker_id,
                    &ord.taker,
                    ord.qty,
                )?;
                
                ord.state = OrderState::Released;
                Ok(())
            })?;
            
            // 函数级中文注释：仲裁完成后，同样添加到价格聚合统计
            let _ = pallet_pricing::Pallet::<T>::add_otc_order(timestamp, price_usdt, memo_qty);
            
            // 🆕 2025-10-22：仲裁释放（做市商胜诉） → 不记录违约，信用分保持不变
            // 函数级详细中文注释：Release 表示做市商胜诉，买家败诉
            // 做市商信用分不变，无需调用任何接口
            // 未使用的变量 maker_id 用于提醒：这里可以扩展胜诉奖励逻辑
            let _ = maker_id;
            
            Ok(())
        }
        fn arbitrate_refund(id: u64) -> DispatchResult {
            // 🆕 2025-10-22：提取 maker_id 用于信用更新
            let maker_id = {
                let ord = Orders::<T>::get(id).ok_or(Error::<T>::NotFound)?;
                ord.maker_id
            };
            
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                // 🆕 2025-10-20：移除库存恢复逻辑（不再管理挂单库存）
                ord.state = OrderState::Refunded;
                Ok(())
            })?;
            
            // 🆕 2025-10-22：仲裁退款（做市商败诉） → 记录争议违约，扣信用分
            // 函数级详细中文注释：完全退款意味着做市商完全败诉，记录争议违约
            // 惩罚：信用分 -20分（根据 MakerDisputeLossPenalty 配置）
            let _ = <T as Config>::MakerCredit::record_default_dispute(maker_id, id);
            
            Ok(())
        }
        fn arbitrate_partial(id: u64, bps: u16) -> DispatchResult {
            // 🆕 2025-10-22：提取 maker_id 用于信用更新
            let maker_id = {
                let ord = Orders::<T>::get(id).ok_or(Error::<T>::NotFound)?;
                ord.maker_id
            };
            
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                
                // 函数级中文注释：按 bps 分账：bps 给买家，其余退回卖家
                // 函数级详细中文注释：分账基于数量（qty）而不是金额（amount）
                let total = ord.qty;
                let buyer_share = (total / 10_000u32.into()) * (bps.into());
                let seller_share = total.saturating_sub(buyer_share);
                
                // 统一托管流程：从托管账户转账
                if !buyer_share.is_zero() {
                    <T as Config>::Escrow::transfer_from_escrow(
                        ord.maker_id,
                        &ord.taker,
                        buyer_share,
                    )?;
                }
                if !seller_share.is_zero() {
                    <T as Config>::Escrow::transfer_from_escrow(
                        ord.maker_id,
                        &ord.maker,
                        seller_share,
                    )?;
                }
                
                // 部分成交视为订单关闭，库存不回增（已占用份额按金额完成分配）
                ord.state = OrderState::Released;
                Ok(())
            })?;
            
            // 🆕 2025-10-22：仲裁部分放行（做市商部分败诉） → 记录争议违约，扣信用分
            // 函数级详细中文注释：部分退款意味着做市商有部分责任，也记录为争议违约
            // 惩罚：信用分 -20分（根据 MakerDisputeLossPenalty 配置，与完全败诉相同，简化处理）
            let _ = <T as Config>::MakerCredit::record_default_dispute(maker_id, id);
            
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：到期自动退款（安全网）+ 定期归档清理
        /// 
        /// # 功能1：到期订单处理
        /// - 对于到期且未完成的订单（Created/PaidOrCommitted/Disputed），将买家托管金额退回；
        /// - 由于索引容量有限，可能存在少量溢出订单需通过 `refund_on_timeout` 手动处理。
        /// 
        /// # 功能2：自动归档清理（每天执行一次）
        /// - 检查是否启用自动清理
        /// - 每14400个区块（约1天，6秒/块）执行一次清理
        /// - 每次清理最多处理 MaxCleanupPerBlock 个订单
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let mut total_reads = 0u64;
            let mut total_writes = 0u64;
            
            // === 功能1：处理过期订单 ===
            let ids = ExpiringAt::<T>::take(n);
            total_reads += 1;
            total_writes += 1;
            
            for id in ids.into_inner() {
                if let Some(mut ord) = Orders::<T>::get(id) {
                    total_reads += 1;
                    
                    if matches!(
                        ord.state,
                        OrderState::Created | OrderState::PaidOrCommitted | OrderState::Disputed
                    ) {
                        // ✅ 2025-10-23：超时自动退款（释放托管资金）
                        // 函数级详细中文注释：根据订单状态释放托管资金
                        // - Created: 订单未付款，释放做市商的 MEMO
                        // - PaidOrCommitted/Disputed: 订单已付款或争议中，退款给做市商
                        
                        let _ = <T as Config>::Escrow::transfer_from_escrow(
                            ord.maker_id,
                            &ord.maker,
                            ord.qty,
                        );
                        total_reads += 1;
                        total_writes += 1;
                        
                        ord.state = OrderState::Refunded;
                        Orders::<T>::insert(id, ord);
                        total_writes += 1;
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
                    let threshold_days = <T as Config>::ArchiveThresholdDays::get();
                    let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
                    total_reads += 1;
                    
                    // 计算截止时间戳
                    let cutoff_ms: u64 = (threshold_days as u64)
                        .saturating_mul(86_400_000); // 1天 = 86,400,000 毫秒
                    let cutoff_timestamp = now_timestamp.saturating_sub(cutoff_ms.saturated_into());
                    
                    let max_count = <T as Config>::MaxCleanupPerBlock::get();
                    let mut cleaned = 0u32;
                    let cursor = CleanupCursor::<T>::get();
                    total_reads += 1;
                    let mut next_cursor = cursor;
                    
                    // 从游标位置开始清理
                    for (id, order) in Orders::<T>::iter() {
                        if id < cursor {
                            continue;
                        }
                        
                        if cleaned >= max_count {
                            next_cursor = id;
                            break;
                        }
                        
                        total_reads += 1;
                        
                        // 只清理终态订单
                        let is_final_state = matches!(
                            order.state,
                            OrderState::Released | OrderState::Refunded | OrderState::Closed | OrderState::Canceled
                        );
                        
                        if is_final_state && order.created_at < cutoff_timestamp {
                            Orders::<T>::remove(id);
                            total_writes += 1;
                            cleaned += 1;
                            
                            // 计算订单年龄（天数）
                            let age_ms: u64 = now_timestamp.saturating_sub(order.created_at).saturated_into();
                            let age_days = (age_ms / 86_400_000) as u32;
                            
                            Self::deposit_event(Event::OrderArchived {
                                order_id: id,
                                order_age_days: age_days,
                            });
                        }
                    }
                    
                    // 更新清理记录
                    if cleaned > 0 {
                        CleanupCursor::<T>::put(next_cursor);
                        total_writes += 1;
                        
                        let total_orders = NextOrderId::<T>::get();
                        total_reads += 1;
                        
                        Self::deposit_event(Event::BatchArchiveCompleted {
                            count: cleaned,
                            total_orders,
                        });
                    }
                    
                    // 更新最后清理时间
                    LastCleanupBlock::<T>::put(n);
                    total_writes += 1;
                }
            }
            
            T::DbWeight::get().reads_writes(total_reads, total_writes)
        }
    }
}
