#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`（常量权重），后续将迁移至 WeightInfo 并移除
#![allow(deprecated)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{pallet_prelude::*, BoundedVec, traits::{Get, Currency, ExistenceRequirement}};
    use frame_system::pallet_prelude::*;
    // 移除未使用的 SaturatedConversion 以消除警告
    use sp_runtime::traits::{Saturating, Zero};
    use pallet_escrow::pallet::Escrow as EscrowTrait;
    use pallet_otc_maker::KycProvider;
    use pallet_pricing::PriceProvider;

    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum Side { Buy, Sell }

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(MaxCidLen))]
    pub struct Listing<MaxCidLen: Get<u32>, AccountId, Balance, BlockNumber> {
        pub maker: AccountId,
        pub side: u8,
        pub base: u32,
        pub quote: u32,
        /// 函数级中文注释：基于链上价格的报价扩展（单位：bps，0-10000）
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
    pub trait Config: frame_system::Config + pallet_escrow::pallet::Config + pallet_otc_maker::pallet::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: Currency<Self::AccountId>;
        type MaxCidLen: Get<u32>;
        /// 函数级中文注释：托管接口（库存模式：挂单创建即将 Maker 余额转入托管）
        type Escrow: EscrowTrait<Self::AccountId, BalanceOf<Self>>;
        /// 函数级中文注释：每个区块最多处理的过期挂单数（on_initialize）
        #[pallet::constant]
        type MaxExpiringPerBlock: Get<u32>;
        /// 函数级中文注释：是否要求做市商必须为 KYC 通过
        #[pallet::constant]
        type RequireKyc: Get<bool>;
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
        /// 函数级中文注释：价格源（仅读取 current_price/is_stale）
        type PriceFeed: PriceProvider;
        /// 函数级中文注释：允许的最大 spread（bps）
        #[pallet::constant]
        type MaxSpreadBps: Get<u16>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== 可治理风控参数（以存储为准，默认值来源于 Config 常量） =====
    #[pallet::type_value]
    pub fn DefaultCreateWindow<T: Config>() -> BlockNumberFor<T> { T::CreateWindow::get() }
    #[pallet::type_value]
    pub fn DefaultCreateMaxInWindow<T: Config>() -> u32 { T::CreateMaxInWindow::get() }
    #[pallet::type_value]
    pub fn DefaultListingFee<T: Config>() -> BalanceOf<T> { T::ListingFee::get() }
    #[pallet::type_value]
    pub fn DefaultListingBond<T: Config>() -> BalanceOf<T> { T::ListingBond::get() }
    #[pallet::type_value]
    pub fn DefaultMinListingTotal<T: Config>() -> BalanceOf<T> { Zero::zero() }
    #[pallet::type_value]
    pub fn DefaultMinListingTtl<T: Config>() -> BlockNumberFor<T> { Zero::zero() }

    /// 创建限频窗口（块）
    #[pallet::storage]
    pub type CreateWindowParam<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultCreateWindow<T>>;
    /// 窗口内最多创建数
    #[pallet::storage]
    pub type CreateMaxInWindowParam<T: Config> = StorageValue<_, u32, ValueQuery, DefaultCreateMaxInWindow<T>>;
    /// 上架费
    #[pallet::storage]
    pub type ListingFeeParam<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery, DefaultListingFee<T>>;
    /// 上架保证金
    #[pallet::storage]
    pub type ListingBondParam<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery, DefaultListingBond<T>>;
    /// 最小挂单总量（避免垃圾上架）
    #[pallet::storage]
    pub type MinListingTotal<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery, DefaultMinListingTotal<T>>;
    /// 最小挂单有效期（从当前块起至少 N 块）
    #[pallet::storage]
    pub type MinListingTtl<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultMinListingTtl<T>>;
    /// 函数级中文注释：是否允许发布“买单”（默认 false，仅允许卖单）
    #[pallet::storage]
    pub type AllowBuyListings<T: Config> = StorageValue<_, bool, ValueQuery>;

    #[pallet::storage]
    pub type Listings<T: Config> = StorageMap<_, Blake2_128Concat, u64, Listing<<T as self::Config>::MaxCidLen, T::AccountId, BalanceOf<T>, BlockNumberFor<T>>, OptionQuery>;
    #[pallet::storage]
    pub type NextListingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级中文注释：在指定区块过期的挂单索引（便于 O(1) 扫描当前块过期项）
    #[pallet::storage]
    pub type ExpiringAt<T: Config> = StorageMap<_, Blake2_128Concat, BlockNumberFor<T>, BoundedVec<u64, <T as self::Config>::MaxExpiringPerBlock>, ValueQuery>;

    /// 函数级中文注释：创建挂单的滑动窗口限频（账户 -> (窗口起点高度, 窗口内计数)）
    #[pallet::storage]
    pub type CreateRate<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：创建挂单事件（为 Subsquid 索引补充快照字段，避免读存储）。
        /// - 包含 maker/side/base/quote/价格与数量信息、有效期、是否允许部分成交等。
        ListingCreated {
            id: u64,
            maker: T::AccountId,
            side: u8,
            base: u32,
            quote: u32,
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
        ListingCanceled { id: u64, escrow_amount: BalanceOf<T>, bond_amount: BalanceOf<T> },
        /// 函数级中文注释：挂单到期（自动下架并退款剩余库存，带托管余额快照）。
        /// - escrow_amount：到期处理时的库存托管余额快照。
        /// - bond_amount：到期处理时的保证金托管余额快照。
        ListingExpired { id: u64, escrow_amount: BalanceOf<T>, bond_amount: BalanceOf<T> },
        /// 函数级中文注释：风控参数已更新（治理）
        ListingParamsUpdated,
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadState,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：将挂单 id 转换为“保证金”托管 id，避免与库存锁定冲突。
        /// - 约定：最高位标记为 1 表示保证金；普通库存 id 的最高位为 0。
        #[inline]
        fn bond_id(id: u64) -> u64 { id | (1u64 << 63) }
    }
    
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：创建挂单（最小骨架）
        /// - 输入：价格、数量上下限、是否部分成交、过期高度、条款承诺
        /// - 校验：略（后续接入做市商校验、库存占用等）
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_listing(
            origin: OriginFor<T>,
            side: u8,
            base: u32,
            quote: u32,
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
            // 若启用，要求 KYC 通过（依赖上层 runtime 注入 is_verified）
            if T::RequireKyc::get() {
                // 由 runtime 注入的做市商 KYC 适配器进行校验
                ensure!(<T as pallet_otc_maker::pallet::Config>::Kyc::is_verified(&who), Error::<T>::BadState);
            }
            // 限频：滑动窗口检查与更新（以存储参数为准）
            let now = <frame_system::Pallet<T>>::block_number();
            let window = CreateWindowParam::<T>::get();
            let (win_start, cnt) = CreateRate::<T>::get(&who);
            let (win_start, cnt) = if now.saturating_sub(win_start) > window { (now, 0u32) } else { (win_start, cnt) };
            ensure!(cnt < CreateMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            CreateRate::<T>::insert(&who, (win_start, cnt.saturating_add(1)));

            // 基础风控：最小总量、最小 TTL
            ensure!(total >= MinListingTotal::<T>::get(), Error::<T>::BadState);
            let min_ttl = MinListingTtl::<T>::get();
            if min_ttl != Zero::zero() { ensure!(expire_at >= now.saturating_add(min_ttl), Error::<T>::BadState); }
            // spread 上限校验
            ensure!(pricing_spread_bps <= T::MaxSpreadBps::get(), Error::<T>::BadState);
            if price_min.is_some() && price_max.is_some() { ensure!(price_min <= price_max, Error::<T>::BadState); }
            let id = NextListingId::<T>::mutate(|x| { let id=*x; *x=id.saturating_add(1); id });
            let listing = Listing::<
                <T as self::Config>::MaxCidLen,
                _,
                _,
                _
            > {
                maker: who,
                side,
                base, quote,
                pricing_spread_bps,
                price_min,
                price_max,
                min_qty, max_qty,
                total, remaining: total,
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
                <T as Config>::Currency::transfer(&listing.maker, &to, fee, ExistenceRequirement::KeepAlive)?;
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
            ExpiringAt::<T>::mutate(listing.expire_at, |v| { let _ = v.try_push(id); });
            Self::deposit_event(Event::ListingCreated {
                id,
                maker: listing.maker.clone(),
                side: listing.side,
                base: listing.base,
                quote: listing.quote,
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
            if let Some(v) = Listings::<T>::get(id) { let _ = <T as Config>::Escrow::refund_all(id, &v.maker); }
            // 退还保证金：如启用则按保证金托管 id 退回
            let bond = T::ListingBond::get();
            if !bond.is_zero() {
                if let Some(v) = Listings::<T>::get(id) { let _ = <T as Config>::Escrow::refund_all(Self::bond_id(id), &v.maker); }
            }
            Self::deposit_event(Event::ListingCanceled { id, escrow_amount: escrow_snapshot, bond_amount: bond_snapshot });
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
            if let Some(v) = create_window { CreateWindowParam::<T>::put(v); }
            if let Some(v) = create_max_in_window { CreateMaxInWindowParam::<T>::put(v); }
            if let Some(v) = listing_fee { ListingFeeParam::<T>::put(v); }
            if let Some(v) = listing_bond { ListingBondParam::<T>::put(v); }
            if let Some(v) = min_listing_total { MinListingTotal::<T>::put(v); }
            if let Some(v) = min_listing_ttl { MinListingTtl::<T>::put(v); }
            if let Some(v) = allow_buy_listings { AllowBuyListings::<T>::put(v); }
            Self::deposit_event(Event::ListingParamsUpdated);
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：每个区块处理到期挂单（标记 inactive 并退款剩余库存）
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let weight = Weight::from_parts(0, 0);
            let ids = ExpiringAt::<T>::take(n);
            for id in ids.into_inner() {
                if let Some(l) = Listings::<T>::get(id) {
                    if l.active {
                        // 函数级详细中文注释：到期处理前记录托管余额与保证金余额快照，事件中输出，随后状态置 inactive 并退款。
                        let escrow_snapshot: BalanceOf<T> = <T as Config>::Escrow::amount_of(id);
                        let bond_snapshot: BalanceOf<T> = <T as Config>::Escrow::amount_of(Self::bond_id(id));
                        Listings::<T>::mutate(id, |m| if let Some(x)=m.as_mut(){ x.active=false; });
                        let _ = <T as Config>::Escrow::refund_all(id, &l.maker);
                        // 到期退还保证金
                        let bond = ListingBondParam::<T>::get();
                        if !bond.is_zero() { let _ = <T as Config>::Escrow::refund_all(Self::bond_id(id), &l.maker); }
                        // 触发到期事件，便于索引器记录生命周期
                        Self::deposit_event(Event::ListingExpired { id, escrow_amount: escrow_snapshot, bond_amount: bond_snapshot });
                    }
                }
            }
            weight
        }
    }

    
}


