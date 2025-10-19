#![cfg_attr(not(feature = "std"), no_std)]

// 函数级中文注释：将 pallet 模块内导出的类型（如 Pallet、Call、Event 等）在 crate 根进行再导出
// 作用：
// - 让 runtime 可以通过 `pallet_otc_order::Call` 与 `pallet_otc_order::ArbitrationHook` 进行类型引用；
// - 降低路径耦合，便于其他 pallet/rpc 使用。
pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, Get, ExistenceRequirement},
    };
    use frame_system::pallet_prelude::*;
    use pallet_escrow::pallet::Escrow as EscrowTrait;
    use pallet_otc_listing::pallet::Listings as ListingsMap;
    // 函数级中文注释：移除 pallet_pricing 依赖，改为使用挂单中的 USDT 价格直接计算
    use pallet_memo_referrals::{MembershipProvider, ReferralProvider};
    use pallet_affiliate_config::AffiliateDistributor;
    use sp_core::hashing::blake2_256;
    use sp_core::H256;
    use sp_runtime::traits::{SaturatedConversion, Saturating, Zero};
    use sp_std::vec::Vec;

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
        pub listing_id: u64,
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
    }

    #[pallet::config]
    // Plan B: 仅依赖 listing 与 escrow（listing 已经 transitively 依赖 maker/KYC），去掉直接对 maker pallet 的耦合。
    // 函数级中文注释：添加 pallet_timestamp::Config 依赖，用于获取系统时间戳
    pub trait Config:
        frame_system::Config + pallet_otc_listing::Config + pallet_escrow::pallet::Config + pallet_timestamp::Config + pallet_pricing::Config + pallet_market_maker::Config
    {
        type Currency: Currency<Self::AccountId>;
        type ConfirmTTL: Get<BlockNumberFor<Self>>;
        /// 托管接口（用于锁定/释放/退款）
        type Escrow: EscrowTrait<Self::AccountId, BalanceOf<Self>>;
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
        
        /// 函数级中文注释：推荐关系提供者
        type ReferralProvider: pallet_memo_referrals::ReferralProvider<Self::AccountId>;
        
        /// 函数级中文注释：联盟计酬分配器
        type AffiliateDistributor: pallet_affiliate_config::AffiliateDistributor<
            Self::AccountId,
            u128,
            BlockNumberFor<Self>,
        >;
        
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

    // 余额别名（在 Config 定义之后，复用 listing 的余额类型以避免类型不匹配）
    pub type BalanceOf<T> = <<T as pallet_otc_listing::Config>::Currency as Currency<
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
    pub type ExpiringAt<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        // Plan B: 复用 listing pallet 的容量上限，避免本 pallet 与 listing 重复定义同名关联类型引起歧义。
        BoundedVec<u64, <T as pallet_otc_listing::Config>::MaxExpiringPerBlock>,
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
        /// 参数：订单ID、挂单ID、做市商、买家、价格、数量、金额、创建时间（Unix时间戳毫秒）、超时时间（Unix时间戳毫秒）
        OrderOpened {
            id: u64,
            listing_id: u64,
            maker: T::AccountId,
            taker: T::AccountId,
            price: BalanceOf<T>,
            qty: BalanceOf<T>,
            amount: BalanceOf<T>,
            created_at: MomentOf<T>,
            expire_at: MomentOf<T>,
        },
        /// 函数级中文注释：买家已支付或提交支付承诺
        OrderPaidCommitted {
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
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：吃单→创建订单
        /// - 输入：listing_id 与数量、支付/联系方式承诺哈希
        /// - 校验：
        ///   1) 挂单必须处于激活状态，价格一致；
        ///   2) 数量必须满足挂单的每笔下单区间 [min_qty, max_qty]；
        ///   3) 若挂单不允许部分成交（partial=false），则本单数量必须等于当前剩余数量；
        ///   4) 剩余库存必须足够。
        /// - 资金：下单即按订单金额将买家资金锁入托管账户（Escrow）。
        #[pallet::call_index(0)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(3, 3))]
        pub fn open_order(
            origin: OriginFor<T>,
            listing_id: u64,
            // 价格由链上价 + spread 计算，前端可传入期望价用于链上比较（保留，但不信任）
            price: BalanceOf<T>,
            qty: BalanceOf<T>,
            amount: BalanceOf<T>,
            payment_commit: H256,
            contact_commit: H256,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 吃单限频：滑动窗口检查与更新
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
            let id = NextOrderId::<T>::mutate(|x| {
                let id = *x;
                *x = id.saturating_add(1);
                id
            });
            let now = <frame_system::Pallet<T>>::block_number();
            // 读取挂单，校验状态/价格/每单数量区间/是否允许部分成交/库存，并扣减 remaining
            let l = ListingsMap::<T>::get(listing_id).ok_or(Error::<T>::NotFound)?;
            let maker_acc = l.maker.clone();
            
            // 🆕 2025-10-19：验证做市商业务方向是否支持OTC（Sell 或 BuyAndSell）
            // 从做市商账户地址反查maker_id
            if let Some(maker_id) = pallet_market_maker::OwnerIndex::<T>::get(&maker_acc) {
                if let Some(maker_info) = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id) {
                    // 检查方向是否支持OTC（Sell 或 BuyAndSell）
                    ensure!(
                        maker_info.direction == pallet_market_maker::Direction::Sell || 
                        maker_info.direction == pallet_market_maker::Direction::BuyAndSell,
                        Error::<T>::DirectionNotSupported
                    );
                }
            }
            
            let _price_b: BalanceOf<T> = price; // 前端传入的期望价仅用于链上校验/对比（当前未使用）
            let qty_b: BalanceOf<T> = qty;
            let amount_b: BalanceOf<T> = amount;
            
            // 🆕 2025-10-19：溢价定价机制 - 动态计算OTC价格
            // 1. 从做市商信息获取sell_premium_bps
            // 2. 从pallet-pricing获取基准价
            // 3. 计算最终价格 = 基准价 * (10000 + sell_premium_bps) / 10000
            let maker_id = pallet_market_maker::OwnerIndex::<T>::get(&maker_acc)
                .ok_or(Error::<T>::InvalidMaker)?;
            let maker_info = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::InvalidMaker)?;
            
            // 获取基准价（pallet-pricing市场加权均价，单位：USDT，精度10^6）
            let base_price_u64 = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            
            // 应用sell溢价（可为正数或负数）
            // 例如：base_price=10000 (0.01 USDT), sell_premium_bps=200 (+2%)
            // final_price = 10000 * (10000 + 200) / 10000 = 10200 (0.0102 USDT)
            let sell_premium = maker_info.sell_premium_bps;
            let final_price_u64 = base_price_u64
                .saturating_mul((10000i64 + sell_premium as i64) as u64)
                .saturating_div(10000);
            
            // price_usdt 精度为 10^6（6位小数）
            let exec_price: BalanceOf<T> = final_price_u64.saturated_into();

            ListingsMap::<T>::try_mutate(listing_id, |maybe| -> Result<(), DispatchError> {
                let l = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(l.active, Error::<T>::BadState);
                let exec_p = exec_price;
                if let Some(pmin) = l.price_min {
                    ensure!(exec_p >= pmin, Error::<T>::BadState);
                }
                if let Some(pmax) = l.price_max {
                    ensure!(exec_p <= pmax, Error::<T>::BadState);
                }
                // 每笔下单最小/最大数量约束
                ensure!(
                    qty_b >= l.min_qty && qty_b <= l.max_qty,
                    Error::<T>::BadState
                );
                // 不允许部分成交则本单必须吃完剩余
                if !l.partial {
                    ensure!(qty_b == l.remaining, Error::<T>::BadState);
                }
                ensure!(l.remaining >= qty_b, Error::<T>::BadState);
                l.remaining = l.remaining.saturating_sub(qty_b);
                Ok(())
            })?;
            // 最小金额约束
            ensure!(amount_b >= MinOrderAmount::<T>::get(), Error::<T>::BadState);
            
            // 函数级中文注释：获取当前Unix时间戳（毫秒），用于订单时间记录
            let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
            
            // 函数级中文注释：计算超时时间戳（当前时间 + ConfirmTTL * 6秒 * 1000毫秒）
            let confirm_ttl_blocks = ConfirmTTLParam::<T>::get();
            let confirm_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 6u64 * 1000u64).saturated_into();
            let expire_timestamp = now_timestamp.saturating_add(confirm_ttl_ms);
            
            // 函数级中文注释：计算证据窗口时间戳（当前时间 + ConfirmTTL * 2 * 6秒 * 1000毫秒）
            let evidence_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 2u64 * 6u64 * 1000u64).saturated_into();
            let evidence_timestamp = now_timestamp.saturating_add(evidence_ttl_ms);
            
            // 函数级中文注释：计算过期区块号（用于ExpiringAt索引）
            let expire_block = now.saturating_add(confirm_ttl_blocks);
            
            let order = Order::<_, _, _> {
                listing_id,
                maker: maker_acc.clone(),
                taker: who.clone(),
                price: exec_price,
                qty: qty_b,
                amount: amount_b,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
                evidence_until: evidence_timestamp,
                maker_tron_address: maker_info.tron_address.clone(), // 🆕 2025-10-19：做市商TRON收款地址
                payment_commit,
                contact_commit,
                state: OrderState::Created,
            };
            Orders::<T>::insert(id, &order);
            // Plan B：库存托管模式——只锁定 Maker 库存（由 listing pallet 在创建挂单时完成），
            // 订单创建不再额外锁定买家资金，减少双向锁定复杂度；放行/退款仅操作 listing 托管或库存恢复。
            
            // 函数级中文注释：将订单ID加入到期区块索引，用于on_initialize自动触发
            ExpiringAt::<T>::mutate(expire_block, |v| {
                let _ = v.try_push(id);
            });
            
            Self::deposit_event(Event::OrderOpened {
                id,
                listing_id,
                maker: maker_acc,
                taker: who,
                price: exec_price,
                qty: qty_b,
                amount: amount_b,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
            });
            Ok(())
        }

        /// 函数级详细中文注释：买家标记“已支付/已提交凭据”，进入待放行阶段。
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
                // 库存托管模式：从挂单托管划转本单数量给买家
                // 函数级详细中文注释：转账的是 qty（MEMO数量），而不是 amount（订单金额）
                // - qty: 实际购买的MEMO数量（最小单位）
                // - amount: 订单金额（price * qty，用于记录和显示）
                <T as Config>::Escrow::transfer_from_escrow(
                    ord.listing_id,
                    &ord.taker,
                    ord.qty,  // 修复：应该转账数量，而不是金额
                )?;
                ord.state = OrderState::Released;
                Ok(())
            })?;
            
            // 函数级中文注释：订单完成后，添加到 pallet-pricing 的 OTC 价格聚合统计
            // 忽略错误（不影响订单放行流程）
            let _ = pallet_pricing::Pallet::<T>::add_otc_order(timestamp, price_usdt, memo_qty);
            
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
                // 归还库存：将预留的数量退回到 listing.remaining
                ListingsMap::<T>::mutate(ord.listing_id, |m| {
                    if let Some(l) = m.as_mut() {
                        l.remaining = l.remaining.saturating_add(ord.qty);
                    }
                });
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
            listing_id: u64,
            qty: BalanceOf<T>,
            payment_commit: H256,
            contact_commit: H256,
            min_accept_price: Option<BalanceOf<T>>,
            max_accept_price: Option<BalanceOf<T>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 吃单限频：滑动窗口检查与更新
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

            // 读取挂单与做市商
            let l = ListingsMap::<T>::get(listing_id).ok_or(Error::<T>::NotFound)?;
            let maker_acc = l.maker.clone();

            // 🆕 2025-10-19：溢价定价机制 - 动态计算OTC价格
            // 1. 从做市商信息获取sell_premium_bps
            // 2. 从pallet-pricing获取基准价
            // 3. 计算最终价格 = 基准价 * (10000 + sell_premium_bps) / 10000
            let maker_id = pallet_market_maker::OwnerIndex::<T>::get(&maker_acc)
                .ok_or(Error::<T>::InvalidMaker)?;
            let maker_info = pallet_market_maker::ActiveMarketMakers::<T>::get(maker_id)
                .ok_or(Error::<T>::InvalidMaker)?;
            
            // 获取基准价（pallet-pricing市场加权均价，单位：USDT，精度10^6）
            let base_price_u64 = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            
            // 应用sell溢价
            let sell_premium = maker_info.sell_premium_bps;
            let final_price_u64 = base_price_u64
                .saturating_mul((10000i64 + sell_premium as i64) as u64)
                .saturating_div(10000);
            
            // 计算订单金额
            // price_usdt 精度为 10^6（6位小数）
            // 例如：final_price_u64 = 10200 表示 1 MEMO = 0.0102 USDT
            // 计算公式：amount = qty * final_price_u64 / 10^6
            let price_usdt_u128 = final_price_u64 as u128;
            let qty_u128: u128 = qty.saturated_into();
            
            // 订单金额（以最小单位表示，这里用 USDT 的最小单位）
            // 注意：这里 amount 单位是链上 Balance，实际表示 USDT 金额 * 10^12
            let amount: BalanceOf<T> = (qty_u128 * price_usdt_u128 / 1_000_000u128)
                .saturated_into();

            // 价带保护：做市商设置的 min/max（可选，用于额外的金额限制）
            if let Some(pmin) = l.price_min {
                ensure!(amount >= pmin, Error::<T>::BadState);
            }
            if let Some(pmax) = l.price_max {
                ensure!(amount <= pmax, Error::<T>::BadState);
            }
            // taker 滑点保护（买家自己的价格保护）
            if let Some(min_price) = min_accept_price {
                ensure!(amount >= min_price, Error::<T>::BadState);
            }
            if let Some(max_price) = max_accept_price {
                ensure!(amount <= max_price, Error::<T>::BadState);
            }

            // 校验数量边界与库存，并扣减库存
            ListingsMap::<T>::try_mutate(listing_id, |maybe| -> Result<(), DispatchError> {
                let l = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(l.active, Error::<T>::BadState);
                ensure!(qty >= l.min_qty && qty <= l.max_qty, Error::<T>::BadState);
                if !l.partial {
                    ensure!(qty == l.remaining, Error::<T>::BadState);
                }
                ensure!(l.remaining >= qty, Error::<T>::BadState);
                l.remaining = l.remaining.saturating_sub(qty);
                Ok(())
            })?;

            // 订单最小金额校验（amount 已在上面计算）
            ensure!(amount >= MinOrderAmount::<T>::get(), Error::<T>::BadState);

            // 函数级中文注释：获取当前Unix时间戳（毫秒），用于订单时间记录
            let now_timestamp = <pallet_timestamp::Pallet<T>>::get();
            
            // 函数级中文注释：计算超时时间戳（当前时间 + ConfirmTTL * 6秒 * 1000毫秒）
            // ConfirmTTL是区块数，假设每块6秒，转换为毫秒
            let confirm_ttl_blocks = ConfirmTTLParam::<T>::get();
            let confirm_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 6u64 * 1000u64).saturated_into();
            let expire_timestamp = now_timestamp.saturating_add(confirm_ttl_ms);
            
            // 函数级中文注释：计算证据窗口时间戳（当前时间 + ConfirmTTL * 2 * 6秒 * 1000毫秒）
            // 证据窗口是确认窗口的2倍
            let evidence_ttl_ms: MomentOf<T> = (confirm_ttl_blocks.saturated_into::<u64>() * 2u64 * 6u64 * 1000u64).saturated_into();
            let evidence_timestamp = now_timestamp.saturating_add(evidence_ttl_ms);
            
            // 函数级中文注释：计算过期区块号（用于ExpiringAt索引）
            let expire_block = now.saturating_add(confirm_ttl_blocks);
            
            // 创建订单
            let id = NextOrderId::<T>::mutate(|x| {
                let id = *x;
                *x = id.saturating_add(1);
                id
            });
            let order = Order::<_, _, _> {
                listing_id,
                maker: maker_acc.clone(),
                taker: who.clone(),
                price: l.price_usdt.saturated_into(),  // 使用挂单的 USDT 价格（用于显示）
                qty,
                amount,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
                evidence_until: evidence_timestamp,
                maker_tron_address: maker_info.tron_address.clone(), // 🆕 2025-10-19：做市商TRON收款地址
                payment_commit,
                contact_commit,
                state: OrderState::Created,
            };
            Orders::<T>::insert(id, &order);
            
            // 函数级中文注释：将订单ID加入到期区块索引，用于on_initialize自动触发
            ExpiringAt::<T>::mutate(expire_block, |v| {
                let _ = v.try_push(id);
            });
            
            Self::deposit_event(Event::OrderOpened {
                id,
                listing_id,
                maker: maker_acc,
                taker: who,
                price: order.price,  // 使用订单对象中已保存的价格
                qty,
                amount,
                created_at: now_timestamp,
                expire_at: expire_timestamp,
            });
            Ok(())
        }

        /// 函数级详细中文注释：法币首购接口（推荐码可选，无推荐人资金进国库）
        /// 
        /// # 参数
        /// - `origin`: 调用者（必须是授权的法币网关服务账户）
        /// - `buyer`: 购买者地址
        /// - `amount`: 购买金额（MEMO最小单位）
        /// - `referrer`: 推荐人地址（可选，None表示无推荐人）
        /// - `fiat_order_id`: 法币订单号（用于审计，最多64字节）
        /// 
        /// # 验证逻辑
        /// 1. 验证调用者是授权的法币网关服务账户
        /// 2. 验证买家未曾首购
        /// 3. 验证购买金额在限制范围内（50-100 MEMO）
        /// 4. 如果提供了推荐人，验证推荐人是有效会员
        /// 
        /// # 执行流程
        /// 1. 从托管账户转账MEMO给买家
        /// 2. 如果有推荐人：绑定推荐关系 + 触发联盟计酬
        /// 3. 如果无推荐人：不绑定推荐关系，不触发联盟计酬（资金由链下转入国库）
        /// 4. 记录首购信息
        /// 5. 发出首购完成事件
        #[pallet::call_index(20)]
        #[pallet::weight(<T as frame_system::Config>::DbWeight::get().reads_writes(6, 6))]
        pub fn first_purchase_by_fiat(
            origin: OriginFor<T>,
            buyer: T::AccountId,
            amount: <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance,
            referrer: Option<T::AccountId>,
            fiat_order_id: Vec<u8>,
        ) -> DispatchResult {
            use frame_support::traits::ConstU32;
            
            // 1. ✅ 验证调用者是授权的法币网关服务账户
            let caller = ensure_signed(origin)?;
            ensure!(
                caller == T::FiatGatewayAccount::get(),
                Error::<T>::Unauthorized
            );
            
            // 2. ✅ 验证买家未曾首购
            ensure!(
                !FirstPurchaseRecords::<T>::contains_key(&buyer),
                Error::<T>::AlreadyPurchased
            );
            
            // 3. ✅ 验证购买金额范围
            let min_amount = T::MinFirstPurchaseAmount::get();
            let max_amount = T::MaxFirstPurchaseAmount::get();
            let amount_u128: u128 = amount.saturated_into();
            let min_u128: u128 = min_amount.saturated_into();
            let max_u128: u128 = max_amount.saturated_into();
            ensure!(
                amount_u128 >= min_u128 && amount_u128 <= max_u128,
                Error::<T>::AmountOutOfRange
            );
            
            // 4. ✅ 如果提供了推荐人，验证推荐人是有效会员
            if let Some(ref r) = referrer {
                ensure!(
                    T::MembershipProvider::is_valid_member(r),
                    Error::<T>::InvalidReferrer
                );
            }
            
            // 5. ✅ 从托管账户转账MEMO给买家
            let treasury_account = T::FiatGatewayTreasuryAccount::get();
            <T as Config>::Currency::transfer(
                &treasury_account,
                &buyer,
                amount,
                ExistenceRequirement::KeepAlive,
            )?;
            
            // 6. ✅ 处理推荐关系和联盟计酬
            if let Some(ref final_referrer) = referrer {
                // 有推荐人：绑定推荐关系 + 触发联盟计酬
                
                // 6.1 绑定推荐关系（如果买家还未绑定）
                if T::ReferralProvider::sponsor_of(&buyer).is_none() {
                    let _ = T::ReferralProvider::bind_sponsor_internal(&buyer, final_referrer);
                }
                
                // 6.2 触发联盟计酬分配
                let now = <frame_system::Pallet<T>>::block_number();
                
                let _ = T::AffiliateDistributor::distribute_membership_rewards(
                    &buyer,
                    amount_u128,
                    now,
                );
            }
            // 无推荐人：不绑定推荐关系，不触发联盟计酬
            // 资金由链下服务转入国库
            
            // 7. ✅ 记录首购信息
            let now = <frame_system::Pallet<T>>::block_number();
            let order_id_bounded: BoundedVec<u8, ConstU32<64>> = fiat_order_id
                .clone()
                .try_into()
                .map_err(|_| Error::<T>::BadState)?;
            
            let purchase_info = FirstPurchaseInfo {
                amount: amount_u128,
                purchased_at: now,
                referrer: referrer.clone(),
                fiat_order_id: order_id_bounded.clone(),
            };
            FirstPurchaseRecords::<T>::insert(&buyer, purchase_info);
            
            // 8. ✅ 发出事件（转换回 BalanceOf<T> 类型）
            let amount_balance: BalanceOf<T> = amount_u128.saturated_into();
            Self::deposit_event(Event::FirstPurchaseCompleted {
                buyer,
                amount: amount_balance,
                referrer,
                fiat_order_id: order_id_bounded,
                purchased_at: now,
            });
            
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
            let (price_usdt, memo_qty, timestamp) = {
                let ord = Orders::<T>::get(id).ok_or(Error::<T>::NotFound)?;
                (ord.price.saturated_into::<u64>(), ord.qty.saturated_into::<u128>(), ord.created_at.saturated_into::<u64>())
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
                // 函数级详细中文注释：仲裁释放时转账数量（qty）而不是金额（amount）
                <T as Config>::Escrow::transfer_from_escrow(
                    ord.listing_id,
                    &ord.taker,
                    ord.qty,  // 修复：应该转账数量
                )?;
                ord.state = OrderState::Released;
                Ok(())
            })?;
            
            // 函数级中文注释：仲裁完成后，同样添加到价格聚合统计
            let _ = pallet_pricing::Pallet::<T>::add_otc_order(timestamp, price_usdt, memo_qty);
            Ok(())
        }
        fn arbitrate_refund(id: u64) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                // 恢复库存
                ListingsMap::<T>::mutate(ord.listing_id, |m| {
                    if let Some(l) = m.as_mut() {
                        l.remaining = l.remaining.saturating_add(ord.qty);
                    }
                });
                ord.state = OrderState::Refunded;
                Ok(())
            })
        }
        fn arbitrate_partial(id: u64, bps: u16) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(
                        ord.state,
                        OrderState::PaidOrCommitted | OrderState::Disputed
                    ),
                    Error::<T>::BadState
                );
                // 函数级中文注释：按 bps 分账：bps 给买家，其余退回卖家（从 listing 托管资金划转）
                // 函数级详细中文注释：分账基于数量（qty）而不是金额（amount）
                let total = ord.qty;  // 修复：应该基于数量分账
                let buyer_share = (total / 10_000u32.into()) * (bps.into());
                let seller_share = total.saturating_sub(buyer_share);
                if !buyer_share.is_zero() {
                    <T as Config>::Escrow::transfer_from_escrow(
                        ord.listing_id,
                        &ord.taker,
                        buyer_share,
                    )?;
                }
                if !seller_share.is_zero() {
                    <T as Config>::Escrow::transfer_from_escrow(
                        ord.listing_id,
                        &ord.maker,
                        seller_share,
                    )?;
                }
                // 部分成交视为订单关闭，库存不回增（已占用份额按金额完成分配）
                ord.state = OrderState::Released;
                Ok(())
            })
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
                        // Plan B：自动超时退款仅恢复库存（买家资金未被锁定）。
                        ListingsMap::<T>::mutate(ord.listing_id, |m| {
                            if let Some(l) = m.as_mut() {
                                l.remaining = l.remaining.saturating_add(ord.qty);
                            }
                        });
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
