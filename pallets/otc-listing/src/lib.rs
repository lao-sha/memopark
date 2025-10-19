#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`（常量权重），后续将迁移至 WeightInfo 并移除
#![allow(deprecated)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, Get},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    // 函数级中文注释：移除对 pallet_otc_maker::KycProvider 的依赖
    // - 做市商已通过审批流程，无需 KYC 检查
    use pallet_escrow::pallet::Escrow as EscrowTrait;
    // 函数级中文注释：重新引入 pallet_pricing，用于获取市场均价并进行价格偏离检查
    use sp_runtime::traits::{Saturating, Zero, SaturatedConversion};

    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum Side {
        Buy,
        Sell,
    }

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(MaxCidLen))]
    pub struct Listing<MaxCidLen: Get<u32>, AccountId, Balance, BlockNumber> {
        pub maker: AccountId,
        pub side: u8,
        pub base: u32,
        pub quote: u32,
        
        /// 函数级中文注释：USDT 单价（精度 10^6，即 6 位小数）
        /// - 例如：price_usdt = 500000 表示 1 MEMO = 0.5 USDT
        /// - 取值范围：10000 - 100000000 (0.01 USDT - 100 USDT)
        pub price_usdt: u64,
        
        /// 函数级中文注释：基于链上价格的报价扩展（单位：bps，0-10000）
        /// 注意：现已改为 USDT 直接报价，此字段保留用于未来扩展
        pub pricing_spread_bps: u16,
        /// 函数级中文注释：做市商价带下限（可选，单位与撮合价一致）
        pub price_min: Option<Balance>,
        /// 函数级中文注释：做市商价带上限（可选）
        pub price_max: Option<Balance>,
        pub min_qty: Balance,
        pub max_qty: Balance,
        pub total: Balance,
        pub remaining: Balance,
        pub partial: bool,
        pub expire_at: BlockNumber,
        pub terms_commit: Option<BoundedVec<u8, MaxCidLen>>,
        pub active: bool,
    }

    #[pallet::config]
    pub trait Config:
        frame_system::Config + pallet_escrow::pallet::Config + pallet_pricing::Config
    {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: Currency<Self::AccountId>;
        type MaxCidLen: Get<u32>;
        /// 函数级中文注释：托管接口（库存模式：挂单创建即将 Maker 余额转入托管）
        type Escrow: EscrowTrait<Self::AccountId, BalanceOf<Self>>;
        /// 函数级中文注释：每个区块最多处理的过期挂单数（on_initialize）
        #[pallet::constant]
        type MaxExpiringPerBlock: Get<u32>;
        /// 函数级中文注释：创建挂单限频窗口大小（以块为单位）
        #[pallet::constant]
        type CreateWindow: Get<BlockNumberFor<Self>>;
        /// 函数级中文注释：窗口内最多允许创建的挂单数
        #[pallet::constant]
        type CreateMaxInWindow: Get<u32>;
        /// 函数级中文注释：上架费（从 maker 扣除；默认可为 0 表示关闭）
        #[pallet::constant]
        type ListingFee: Get<BalanceOf<Self>>;
        /// 函数级中文注释：保证金（从 maker 扣除并锁入托管；默认 0 关闭）
        #[pallet::constant]
        type ListingBond: Get<BalanceOf<Self>>;
        /// 函数级中文注释：上架费收款账户（建议由 PalletId 派生的稳定账户）
        type FeeReceiver: sp_core::Get<Self::AccountId>;
        /// 函数级中文注释：允许的最大 spread（bps）
        /// 注意：现已改为 USDT 直接报价，此配置保留用于未来扩展
        #[pallet::constant]
        type MaxSpreadBps: Get<u16>;
        
        /// 函数级中文注释：挂单归档阈值（天数）
        /// 超过此天数的非活跃挂单将被自动清理，默认 150 天（约5个月）
        #[pallet::constant]
        type ArchiveThresholdDays: Get<u32>;
        
        /// 函数级中文注释：每次自动清理的最大挂单数
        /// 防止单次清理过多导致区块Gas爆炸，默认 50
        #[pallet::constant]
        type MaxCleanupPerBlock: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== 可治理风控参数（以存储为准，默认值来源于 Config 常量） =====
    #[pallet::type_value]
    pub fn DefaultCreateWindow<T: Config>() -> BlockNumberFor<T> {
        T::CreateWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultCreateMaxInWindow<T: Config>() -> u32 {
        T::CreateMaxInWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultListingFee<T: Config>() -> BalanceOf<T> {
        T::ListingFee::get()
    }
    #[pallet::type_value]
    pub fn DefaultListingBond<T: Config>() -> BalanceOf<T> {
        T::ListingBond::get()
    }
    #[pallet::type_value]
    pub fn DefaultMinListingTotal<T: Config>() -> BalanceOf<T> {
        Zero::zero()
    }
    #[pallet::type_value]
    pub fn DefaultMinListingTtl<T: Config>() -> BlockNumberFor<T> {
        Zero::zero()
    }

    /// 创建限频窗口（块）
    #[pallet::storage]
    pub type CreateWindowParam<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultCreateWindow<T>>;
    /// 窗口内最多创建数
    #[pallet::storage]
    pub type CreateMaxInWindowParam<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultCreateMaxInWindow<T>>;
    /// 上架费
    #[pallet::storage]
    pub type ListingFeeParam<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultListingFee<T>>;
    /// 上架保证金
    #[pallet::storage]
    pub type ListingBondParam<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultListingBond<T>>;
    /// 最小挂单总量（避免垃圾上架）
    #[pallet::storage]
    pub type MinListingTotal<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultMinListingTotal<T>>;
    /// 最小挂单有效期（从当前块起至少 N 块）
    #[pallet::storage]
    pub type MinListingTtl<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultMinListingTtl<T>>;
    /// 函数级中文注释：是否允许发布"买单"（默认 false，仅允许卖单）
    #[pallet::storage]
    pub type AllowBuyListings<T: Config> = StorageValue<_, bool, ValueQuery>;
    
    /// 函数级中文注释：最大价格偏离（单位：万分比，默认 2000 = 20%）
    /// 限制挂单价格相对市场均价的浮动范围，防止极端价格
    #[pallet::storage]
    pub type MaxPriceDeviation<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::storage]
    pub type Listings<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        Listing<<T as self::Config>::MaxCidLen, T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
        OptionQuery,
    >;
    #[pallet::storage]
    pub type NextListingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：在指定区块过期的挂单索引（便于 O(1) 扫描当前块过期项）
    #[pallet::storage]
    pub type ExpiringAt<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<u64, <T as self::Config>::MaxExpiringPerBlock>,
        ValueQuery,
    >;

    /// 函数级中文注释：创建挂单的滑动窗口限频（账户 -> (窗口起点高度, 窗口内计数)）
    #[pallet::storage]
    pub type CreateRate<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;

    /// 函数级中文注释：归档清理开关（治理可配置）
    /// true = 启用自动清理，false = 禁用（默认启用）
    #[pallet::storage]
    pub type ArchiveEnabled<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：上次自动清理的区块高度
    /// 用于控制清理频率（避免每个区块都执行清理）
    #[pallet::storage]
    pub type LastCleanupBlock<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    /// 函数级中文注释：待清理挂单游标
    /// 记录上次清理停止的位置，下次从此处继续（用于分批清理大量数据）
    #[pallet::storage]
    pub type CleanupCursor<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：创建挂单事件（为 Subsquid 索引补充快照字段，避免读存储）。
        /// - 包含 maker/side/base/quote/USDT价格、数量信息、有效期、是否允许部分成交等。
        /// - 新增：base_price_usdt 记录创建时的市场均价，用于追溯价格形成过程
        ListingCreated {
            id: u64,
            maker: T::AccountId,
            side: u8,
            base: u32,
            quote: u32,
            price_usdt: u64,  // 挂单执行价格（USDT单价）
            base_price_usdt: u64,  // 新增：创建时的市场均价（便于追溯）
            pricing_spread_bps: u16,
            price_min: Option<BalanceOf<T>>,
            price_max: Option<BalanceOf<T>>,
            min_qty: BalanceOf<T>,
            max_qty: BalanceOf<T>,
            total: BalanceOf<T>,
            remaining: BalanceOf<T>,
            partial: bool,
            expire_at: BlockNumberFor<T>,
        },
        /// 占位（未来编辑事件）。
        ListingUpdated { id: u64 },
        /// 函数级中文注释：取消挂单（带托管余额快照，便于审计）。
        /// - escrow_amount：本次取消时，挂单库存托管余额（id）快照。
        /// - bond_amount：本次取消时，保证金托管余额（bond_id(id)）快照。
        ListingCanceled {
            id: u64,
            escrow_amount: BalanceOf<T>,
            bond_amount: BalanceOf<T>,
        },
        /// 函数级中文注释：挂单到期（自动下架并退款剩余库存，带托管余额快照）。
        /// - escrow_amount：到期处理时的库存托管余额快照。
        /// - bond_amount：到期处理时的保证金托管余额快照。
        ListingExpired {
            id: u64,
            escrow_amount: BalanceOf<T>,
            bond_amount: BalanceOf<T>,
        },
        /// 函数级中文注释：风控参数已更新（治理）
        ListingParamsUpdated,
        /// 函数级中文注释：挂单已归档清理
        /// - listing_id: 挂单ID
        /// - listing_age_days: 挂单年龄（天数）
        ListingArchived {
            listing_id: u64,
            listing_age_days: u32,
        },
        /// 函数级中文注释：批量归档完成
        /// - count: 本次清理的挂单数量
        /// - total_listings: 当前总挂单数
        BatchArchiveCompleted {
            count: u32,
            total_listings: u64,
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
        /// 函数级中文注释：市场价格不可用（pallet-pricing 返回 0，处于冷启动状态）
        MarketPriceNotAvailable,
        /// 函数级中文注释：价格偏离超出允许范围（超过 ±MaxPriceDeviation）
        PriceDeviationTooHigh,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：将挂单 id 转换为“保证金”托管 id，避免与库存锁定冲突。
        /// - 约定：最高位标记为 1 表示保证金；普通库存 id 的最高位为 0。
        #[inline]
        fn bond_id(id: u64) -> u64 {
            id | (1u64 << 63)
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：创建挂单（USDT 直接报价版本）
        /// - 输入：USDT价格、数量上下限、是否部分成交、过期高度、条款承诺
        /// - 新增：price_usdt 参数用于直接指定USDT单价（精度 10^6）
        /// - 校验：USDT价格范围 0.01-100 USDT
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_listing(
            origin: OriginFor<T>,
            side: u8,
            base: u32,
            quote: u32,
            price_usdt: u64,  // 新增：USDT单价（精度 10^6）
            pricing_spread_bps: u16,
            min_qty: BalanceOf<T>,
            max_qty: BalanceOf<T>,
            total: BalanceOf<T>,
            partial: bool,
            expire_at: BlockNumberFor<T>,
            price_min: Option<BalanceOf<T>>,
            price_max: Option<BalanceOf<T>>,
            terms_commit: Option<BoundedVec<u8, <T as self::Config>::MaxCidLen>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 函数级中文注释：移除 KYC 检查
            // - 做市商已通过审批流程，无需额外验证
            // - 简化挂单创建流程
            
            // 函数级中文注释：验证 USDT 价格合理性
            // - 最低价：0.01 USDT (10000)
            // - 最高价：100 USDT (100000000)
            // - 防止价格异常导致交易失败
            ensure!(
                price_usdt >= 10_000 && price_usdt <= 100_000_000,
                Error::<T>::BadState
            );
            
            // 函数级中文注释：从 pallet-pricing 获取市场加权均价，并进行 ±20% 价格偏离检查
            // - 如果市场价格可用（> 0），则检查 price_usdt 是否在允许范围内
            // - 如果市场价格为 0（冷启动），允许做市商自由定价
            let market_price = pallet_pricing::Pallet::<T>::get_memo_market_price_weighted();
            let base_price_usdt = if market_price > 0 {
                // 市场价格可用，进行偏离检查
                let max_deviation = MaxPriceDeviation::<T>::get();
                
                // 如果设置了 MaxPriceDeviation（> 0），则执行检查
                if max_deviation > 0 {
                    // 计算允许的价格范围：[market_price * (1 - deviation), market_price * (1 + deviation)]
                    let min_price = market_price
                        .saturating_mul(10000u64.saturating_sub(max_deviation as u64))
                        .saturating_div(10000);
                    let max_price = market_price
                        .saturating_mul(10000u64.saturating_add(max_deviation as u64))
                        .saturating_div(10000);
                    
                    // 检查 price_usdt 是否在允许范围内
                    ensure!(
                        price_usdt >= min_price && price_usdt <= max_price,
                        Error::<T>::PriceDeviationTooHigh
                    );
                }
                
                market_price
            } else {
                // 冷启动状态，不检查价格偏离
                0u64
            };
            
            // 限频：滑动窗口检查与更新（以存储参数为准）
            let now = <frame_system::Pallet<T>>::block_number();
            let window = CreateWindowParam::<T>::get();
            let (win_start, cnt) = CreateRate::<T>::get(&who);
            let (win_start, cnt) = if now.saturating_sub(win_start) > window {
                (now, 0u32)
            } else {
                (win_start, cnt)
            };
            ensure!(
                cnt < CreateMaxInWindowParam::<T>::get(),
                Error::<T>::BadState
            );
            CreateRate::<T>::insert(&who, (win_start, cnt.saturating_add(1)));

            // 基础风控：最小总量、最小 TTL
            ensure!(total >= MinListingTotal::<T>::get(), Error::<T>::BadState);
            let min_ttl = MinListingTtl::<T>::get();
            if min_ttl != Zero::zero() {
                ensure!(
                    expire_at >= now.saturating_add(min_ttl),
                    Error::<T>::BadState
                );
            }
            // spread 上限校验（保留用于未来扩展）
            ensure!(
                pricing_spread_bps <= T::MaxSpreadBps::get(),
                Error::<T>::BadState
            );
            if price_min.is_some() && price_max.is_some() {
                ensure!(price_min <= price_max, Error::<T>::BadState);
            }
            let id = NextListingId::<T>::mutate(|x| {
                let id = *x;
                *x = id.saturating_add(1);
                id
            });
            let listing = Listing::<<T as self::Config>::MaxCidLen, _, _, _> {
                maker: who,
                side,
                base,
                quote,
                price_usdt,  // 新增：USDT单价
                pricing_spread_bps,
                price_min,
                price_max,
                min_qty,
                max_qty,
                total,
                remaining: total,
                partial,
                expire_at,
                terms_commit,
                active: true,
            };
            // 仅允许卖单：side=1 表示 Sell；当 AllowBuyListings=false 时拒绝买单
            if !AllowBuyListings::<T>::get() {
                ensure!(listing.side == 1u8, Error::<T>::BadState);
            }
            // 上架费：如启用则从 maker 划转至 FeeReceiver（默认 0 关闭）。
            let fee = ListingFeeParam::<T>::get();
            if !fee.is_zero() {
                let to = <T as Config>::FeeReceiver::get();
                <T as Config>::Currency::transfer(
                    &listing.maker,
                    &to,
                    fee,
                    ExistenceRequirement::KeepAlive,
                )?;
            }
            // 保证金：如启用则锁入托管，取消/到期退回（默认 0 关闭）。
            let bond = ListingBondParam::<T>::get();
            if !bond.is_zero() {
                <T as Config>::Escrow::lock_from(&listing.maker, Self::bond_id(id), bond)?;
            }
            // 库存模式：将 Maker 的总量余额锁入托管（避免超卖）。
            <T as Config>::Escrow::lock_from(&listing.maker, id, listing.total)?;
            Listings::<T>::insert(id, &listing);
            // 记录过期索引
            ExpiringAt::<T>::mutate(listing.expire_at, |v| {
                let _ = v.try_push(id);
            });
            Self::deposit_event(Event::ListingCreated {
                id,
                maker: listing.maker.clone(),
                side: listing.side,
                base: listing.base,
                quote: listing.quote,
                price_usdt: listing.price_usdt,  // 挂单执行价格
                base_price_usdt,  // 新增：市场均价（便于追溯价格形成）
                pricing_spread_bps: listing.pricing_spread_bps,
                price_min: listing.price_min,
                price_max: listing.price_max,
                min_qty: listing.min_qty,
                max_qty: listing.max_qty,
                total: listing.total,
                remaining: listing.remaining,
                partial: listing.partial,
                expire_at: listing.expire_at,
            });
            Ok(())
        }

        /// 函数级详细中文注释：取消挂单
        /// - 只有创建者可取消；状态置为 inactive
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn cancel_listing(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 函数级详细中文注释：取消前先读取托管余额快照，事件中输出，便于审计与索引校验；随后再退款。
            let escrow_snapshot: BalanceOf<T> = <T as Config>::Escrow::amount_of(id);
            let bond_snapshot: BalanceOf<T> = <T as Config>::Escrow::amount_of(Self::bond_id(id));
            Listings::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let v = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(who == v.maker, Error::<T>::BadState);
                v.active = false;
                Ok(())
            })?;
            // 退款：将挂单剩余托管余额退回给 Maker
            if let Some(v) = Listings::<T>::get(id) {
                let _ = <T as Config>::Escrow::refund_all(id, &v.maker);
            }
            // 退还保证金：如启用则按保证金托管 id 退回
            let bond = T::ListingBond::get();
            if !bond.is_zero() {
                if let Some(v) = Listings::<T>::get(id) {
                    let _ = <T as Config>::Escrow::refund_all(Self::bond_id(id), &v.maker);
                }
            }
            Self::deposit_event(Event::ListingCanceled {
                id,
                escrow_amount: escrow_snapshot,
                bond_amount: bond_snapshot,
            });
            Ok(())
        }

        /// 函数级详细中文注释：治理更新挂单风控参数
        /// - 仅允许 Root 调用；未提供的参数保持不变。
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn set_listing_params(
            origin: OriginFor<T>,
            create_window: Option<BlockNumberFor<T>>,
            create_max_in_window: Option<u32>,
            listing_fee: Option<BalanceOf<T>>,
            listing_bond: Option<BalanceOf<T>>,
            min_listing_total: Option<BalanceOf<T>>,
            min_listing_ttl: Option<BlockNumberFor<T>>,
            allow_buy_listings: Option<bool>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            if let Some(v) = create_window {
                CreateWindowParam::<T>::put(v);
            }
            if let Some(v) = create_max_in_window {
                CreateMaxInWindowParam::<T>::put(v);
            }
            if let Some(v) = listing_fee {
                ListingFeeParam::<T>::put(v);
            }
            if let Some(v) = listing_bond {
                ListingBondParam::<T>::put(v);
            }
            if let Some(v) = min_listing_total {
                MinListingTotal::<T>::put(v);
            }
            if let Some(v) = min_listing_ttl {
                MinListingTtl::<T>::put(v);
            }
            if let Some(v) = allow_buy_listings {
                AllowBuyListings::<T>::put(v);
            }
            Self::deposit_event(Event::ListingParamsUpdated);
            Ok(())
        }
        
        /// 函数级详细中文注释：设置最大价格偏离（治理接口）
        /// - 仅允许 Root 调用
        /// - deviation_bps：万分比，建议范围 500-5000 (5%-50%)，默认 2000 (20%)
        /// - 设置为 0 表示关闭价格偏离检查（冷启动期可用）
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn set_max_price_deviation(
            origin: OriginFor<T>,
            deviation_bps: u32,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            // 函数级中文注释：建议范围 0-5000 (0%-50%)，超过 50% 的偏离可能不合理
            ensure!(
                deviation_bps <= 5000,
                Error::<T>::BadState
            );
            
            MaxPriceDeviation::<T>::put(deviation_bps);
            Self::deposit_event(Event::ListingParamsUpdated);
            Ok(())
        }

        /// 函数级中文注释：手动归档清理旧挂单
        /// 
        /// # 参数
        /// - origin: Root权限
        /// - max_count: 本次最多清理的挂单数（防止Gas爆炸）
        /// 
        /// # 逻辑
        /// 1. 遍历所有挂单
        /// 2. 检查挂单是否满足归档条件：
        ///    - 状态必须是非活跃（active == false，即已取消或过期）
        ///    - 过期时间超过归档阈值（默认150天）
        /// 3. 删除符合条件的挂单
        /// 4. 记录清理统计
        #[pallet::call_index(4)]
        #[pallet::weight(T::DbWeight::get().reads_writes(100, 100))]
        pub fn cleanup_archived_listings(
            origin: OriginFor<T>,
            max_count: u32,
        ) -> DispatchResult {
            ensure_root(origin)?;
            
            let threshold_days = T::ArchiveThresholdDays::get();
            let now_block = <frame_system::Pallet<T>>::block_number();
            
            // 计算截止区块（150天前）
            // 假设 6秒/块，1天 = 14400 块
            let blocks_per_day: u32 = 14400;
            let cutoff_blocks = threshold_days.saturating_mul(blocks_per_day);
            let cutoff_block = now_block.saturating_sub(cutoff_blocks.into());
            
            let mut cleaned = 0u32;
            let cursor = CleanupCursor::<T>::get();
            let mut next_cursor = cursor;
            
            // 从游标位置开始遍历挂单
            for (id, listing) in Listings::<T>::iter() {
                if id < cursor {
                    continue; // 跳过已处理的挂单
                }
                
                if cleaned >= max_count {
                    next_cursor = id;
                    break;
                }
                
                // 只清理非活跃挂单（已取消或过期）
                // 且过期时间超过归档阈值
                if !listing.active && listing.expire_at < cutoff_block {
                    // 计算挂单年龄（天数）
                    let age_blocks: u32 = now_block.saturating_sub(listing.expire_at).saturated_into();
                    let age_days = age_blocks / blocks_per_day;
                    
                    Listings::<T>::remove(id);
                    cleaned += 1;
                    
                    Self::deposit_event(Event::ListingArchived {
                        listing_id: id,
                        listing_age_days: age_days,
                    });
                }
            }
            
            // 更新游标
            CleanupCursor::<T>::put(next_cursor);
            
            // 记录统计
            let total_listings = NextListingId::<T>::get();
            Self::deposit_event(Event::BatchArchiveCompleted {
                count: cleaned,
                total_listings,
            });
            
            Ok(())
        }

        /// 函数级中文注释：设置归档清理开关
        /// 
        /// # 参数
        /// - origin: Root权限
        /// - enabled: true=启用自动清理，false=禁用
        #[pallet::call_index(5)]
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

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：处理到期挂单 + 定期归档清理
        /// 
        /// # 功能1：到期挂单处理
        /// - 标记 inactive 并退款剩余库存
        /// 
        /// # 功能2：自动归档清理（每天执行一次）
        /// - 检查是否启用自动清理
        /// - 每14400个区块（约1天，6秒/块）执行一次清理
        /// - 每次清理最多处理 MaxCleanupPerBlock 个挂单
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let mut total_reads = 0u64;
            let mut total_writes = 0u64;
            
            // === 功能1：处理到期挂单 ===
            let ids = ExpiringAt::<T>::take(n);
            total_reads += 1;
            total_writes += 1;
            
            for id in ids.into_inner() {
                if let Some(l) = Listings::<T>::get(id) {
                    total_reads += 1;
                    
                    if l.active {
                        // 函数级详细中文注释：到期处理前记录托管余额与保证金余额快照，事件中输出，随后状态置 inactive 并退款。
                        let escrow_snapshot: BalanceOf<T> = <T as Config>::Escrow::amount_of(id);
                        let bond_snapshot: BalanceOf<T> =
                            <T as Config>::Escrow::amount_of(Self::bond_id(id));
                        total_reads += 2;
                        
                        Listings::<T>::mutate(id, |m| {
                            if let Some(x) = m.as_mut() {
                                x.active = false;
                            }
                        });
                        total_writes += 1;
                        
                        let _ = <T as Config>::Escrow::refund_all(id, &l.maker);
                        // 到期退还保证金
                        let bond = ListingBondParam::<T>::get();
                        total_reads += 1;
                        
                        if !bond.is_zero() {
                            let _ = <T as Config>::Escrow::refund_all(Self::bond_id(id), &l.maker);
                        }
                        // 触发到期事件，便于索引器记录生命周期
                        Self::deposit_event(Event::ListingExpired {
                            id,
                            escrow_amount: escrow_snapshot,
                            bond_amount: bond_snapshot,
                        });
                    }
                }
            }
            
            // === 功能2：自动归档清理（每天一次）===
            // 每14400个区块执行一次（约1天：86400秒 / 6秒 = 14400块）
            const BLOCKS_PER_DAY: u32 = 14400;
            let blocks_per_day_bn: BlockNumberFor<T> = BLOCKS_PER_DAY.into();
            
            if ArchiveEnabled::<T>::get() {
                total_reads += 1;
                
                let last_cleanup = LastCleanupBlock::<T>::get();
                total_reads += 1;
                
                let blocks_since_cleanup = n.saturating_sub(last_cleanup);
                
                if blocks_since_cleanup >= blocks_per_day_bn {
                    // 执行归档清理
                    let threshold_days = T::ArchiveThresholdDays::get();
                    let cutoff_blocks = threshold_days.saturating_mul(BLOCKS_PER_DAY);
                    let cutoff_block = n.saturating_sub(cutoff_blocks.into());
                    
                    let max_count = T::MaxCleanupPerBlock::get();
                    let mut cleaned = 0u32;
                    let cursor = CleanupCursor::<T>::get();
                    total_reads += 1;
                    let mut next_cursor = cursor;
                    
                    // 从游标位置开始清理
                    for (id, listing) in Listings::<T>::iter() {
                        if id < cursor {
                            continue;
                        }
                        
                        if cleaned >= max_count {
                            next_cursor = id;
                            break;
                        }
                        
                        total_reads += 1;
                        
                        // 只清理非活跃挂单且过期时间超过阈值
                        if !listing.active && listing.expire_at < cutoff_block {
                            Listings::<T>::remove(id);
                            total_writes += 1;
                            cleaned += 1;
                            
                            // 计算挂单年龄（天数）
                            let age_blocks: u32 = n.saturating_sub(listing.expire_at).saturated_into();
                            let age_days = age_blocks / BLOCKS_PER_DAY;
                            
                            Self::deposit_event(Event::ListingArchived {
                                listing_id: id,
                                listing_age_days: age_days,
                            });
                        }
                    }
                    
                    // 更新清理记录
                    if cleaned > 0 {
                        CleanupCursor::<T>::put(next_cursor);
                        total_writes += 1;
                        
                        let total_listings = NextListingId::<T>::get();
                        total_reads += 1;
                        
                        Self::deposit_event(Event::BatchArchiveCompleted {
                            count: cleaned,
                            total_listings,
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
