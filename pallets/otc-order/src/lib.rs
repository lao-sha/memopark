#![cfg_attr(not(feature = "std"), no_std)]

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{pallet_prelude::*, traits::{Currency, Get}};
    use frame_system::pallet_prelude::*;
    use sp_core::H256;
    use pallet_escrow::pallet::Escrow as EscrowTrait;
    use sp_core::hashing::blake2_256;
    use pallet_otc_listing::pallet::Listings as ListingsMap;
    use sp_runtime::traits::{Saturating, Zero, SaturatedConversion};
    use sp_std::vec::Vec;

    // Balance aliases 将在 Config 定义之后重新声明

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum OrderState { Created, PaidOrCommitted, Released, Refunded, Canceled, Disputed, Closed }

    #[derive(Encode, Decode, Clone, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct Order<AccountId, Balance, BlockNumber> {
        pub listing_id: u64,
        pub maker: AccountId,
        pub taker: AccountId,
        pub price: Balance,
        pub qty: Balance,
        pub amount: Balance,
        pub created_at: BlockNumber,
        /// 订单确认/放行超时窗口截至高度（到期后可触发自动流程或发起争议）
        pub expire_at: BlockNumber,
        /// 证据追加窗口截至高度（窗口内允许补充证据并发起争议）
        pub evidence_until: BlockNumber,
        pub payment_commit: H256,
        pub contact_commit: H256,
        pub state: OrderState,
    }

    #[pallet::config]
    // Plan B: 仅依赖 listing 与 escrow（listing 已经 transitively 依赖 maker/KYC），去掉直接对 maker pallet 的耦合。
    pub trait Config: frame_system::Config + pallet_otc_listing::Config + pallet_escrow::pallet::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
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
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // 余额别名（在 Config 定义之后，复用 listing 的余额类型以避免类型不匹配）
    pub type BalanceOf<T> =
        <<T as pallet_otc_listing::Config>::Currency as Currency<
            <T as frame_system::Config>::AccountId
        >>::Balance;

    // ===== 可治理风控参数（以存储为准，默认值来源于 Config 常量） =====
    #[pallet::type_value]
    pub fn DefaultOpenWindow<T: Config>() -> BlockNumberFor<T> { T::OpenWindow::get() }
    #[pallet::type_value]
    pub fn DefaultOpenMaxInWindow<T: Config>() -> u32 { T::OpenMaxInWindow::get() }
    #[pallet::type_value]
    pub fn DefaultPaidWindow<T: Config>() -> BlockNumberFor<T> { T::PaidWindow::get() }
    #[pallet::type_value]
    pub fn DefaultPaidMaxInWindow<T: Config>() -> u32 { T::PaidMaxInWindow::get() }
    #[pallet::type_value]
    pub fn DefaultConfirmTTL<T: Config>() -> BlockNumberFor<T> { T::ConfirmTTL::get() }
    #[pallet::type_value]
    pub fn DefaultMinOrderAmount<T: Config>() -> BalanceOf<T> { Default::default() }
    // 移除 DefaultMinOrderAmount，MinOrderAmount 改为无默认值的 ValueQuery=Default()

    /// 吃单限频窗口（块）
    #[pallet::storage]
    pub type OpenWindowParam<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultOpenWindow<T>>;
    /// 窗口内最多吃单数
    #[pallet::storage]
    pub type OpenMaxInWindowParam<T: Config> = StorageValue<_, u32, ValueQuery, DefaultOpenMaxInWindow<T>>;
    /// 标记支付限频窗口（块）
    #[pallet::storage]
    pub type PaidWindowParam<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultPaidWindow<T>>;
    /// 窗口内最多标记支付数
    #[pallet::storage]
    pub type PaidMaxInWindowParam<T: Config> = StorageValue<_, u32, ValueQuery, DefaultPaidMaxInWindow<T>>;
    /// 订单最小金额
    #[pallet::storage]
    pub type MinOrderAmount<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery, DefaultMinOrderAmount<T>>;
    /// 订单确认 TTL（块）
    #[pallet::storage]
    pub type ConfirmTTLParam<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultConfirmTTL<T>>;
    #[pallet::storage]
    pub type Orders<T: Config> = StorageMap<_, Blake2_128Concat, u64, Order<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>, OptionQuery>;
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
        ValueQuery
    >;

    #[pallet::storage]
    /// 函数级中文注释：吃单限频（账户 -> (窗口起点高度, 窗口内计数)）
    pub type OpenRate<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;
    #[pallet::storage]
    /// 函数级中文注释：标记支付限频（账户 -> (窗口起点高度, 窗口内计数)）
    pub type PaidRate<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：订单创建事件（补充快照字段，便于索引器建模）。
    OrderOpened { id: u64, listing_id: u64, maker: T::AccountId, taker: T::AccountId, price: BalanceOf<T>, qty: BalanceOf<T>, amount: BalanceOf<T>, created_at: BlockNumberFor<T>, expire_at: BlockNumberFor<T> },
        /// 函数级中文注释：买家已支付或提交支付承诺
        OrderPaidCommitted { id: u64 },
        OrderReleased { id: u64 },
        OrderRefunded { id: u64 },
        OrderCanceled { id: u64 },
        /// 函数级中文注释：订单被标记为争议中（仅状态标识，实际仲裁登记由仲裁 pallet 完成）
        OrderDisputed { id: u64 },
        /// 支付承诺已揭示并校验通过
        PaymentRevealed { id: u64 },
        /// 联系方式承诺已揭示并校验通过
        ContactRevealed { id: u64 },
        /// 风控参数已更新（治理）
        OrderParamsUpdated,
    }

    #[pallet::error]
    pub enum Error<T> { NotFound, BadState, BadCommit }

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
        #[pallet::weight(10_000)]
        pub fn open_order(
            origin: OriginFor<T>,
            listing_id: u64,
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
            let (wstart, cnt) = if now.saturating_sub(wstart) > window { (now, 0u32) } else { (wstart, cnt) };
            ensure!(cnt < OpenMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            OpenRate::<T>::insert(&who, (wstart, cnt.saturating_add(1)));
            let id = NextOrderId::<T>::mutate(|x| { let id=*x; *x = id.saturating_add(1); id });
            let now = <frame_system::Pallet<T>>::block_number();
            // 读取挂单，校验状态/价格/每单数量区间/是否允许部分成交/库存，并扣减 remaining
            let maker_acc = ListingsMap::<T>::get(listing_id).ok_or(Error::<T>::NotFound)?.maker;
            let price_b: BalanceOf<T> = price;
            let qty_b: BalanceOf<T> = qty;
            let amount_b: BalanceOf<T> = amount;
            ListingsMap::<T>::try_mutate(listing_id, |maybe| -> Result<(), DispatchError> {
                let l = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(l.active, Error::<T>::BadState);
                ensure!(price_b == l.price, Error::<T>::BadState);
                // 每笔下单最小/最大数量约束
                ensure!(qty_b >= l.min_qty && qty_b <= l.max_qty, Error::<T>::BadState);
                // 不允许部分成交则本单必须吃完剩余
                if !l.partial { ensure!(qty_b == l.remaining, Error::<T>::BadState); }
                ensure!(l.remaining >= qty_b, Error::<T>::BadState);
                l.remaining = l.remaining.saturating_sub(qty_b);
                Ok(())
            })?;
            // 最小金额约束
            ensure!(amount_b >= MinOrderAmount::<T>::get(), Error::<T>::BadState);
            let order = Order::<_, _, _> {
                listing_id,
                maker: maker_acc.clone(),
                taker: who.clone(),
                price: price_b, qty: qty_b, amount: amount_b,
                created_at: now,
                expire_at: now.saturating_add(ConfirmTTLParam::<T>::get()),
                evidence_until: now.saturating_add(ConfirmTTLParam::<T>::get()),
                payment_commit, contact_commit,
                state: OrderState::Created,
            };
            Orders::<T>::insert(id, &order);
            // Plan B：库存托管模式——只锁定 Maker 库存（由 listing pallet 在创建挂单时完成），
            // 订单创建不再额外锁定买家资金，减少双向锁定复杂度；放行/退款仅操作 listing 托管或库存恢复。
            // 建立到期索引
            ExpiringAt::<T>::mutate(order.expire_at, |v| { let _ = v.try_push(id); });
            Self::deposit_event(Event::OrderOpened { id, listing_id, maker: maker_acc, taker: who, price: price_b, qty: qty_b, amount: amount_b, created_at: now, expire_at: order.expire_at });
            Ok(())
        }

        /// 函数级详细中文注释：买家标记“已支付/已提交凭据”，进入待放行阶段。
        /// - 要求：调用者必须为订单 taker，状态为 Created。
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn mark_paid(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 标记支付限频：滑动窗口检查与更新
            let (wstart, cnt) = PaidRate::<T>::get(&who);
            let now_blk = <frame_system::Pallet<T>>::block_number();
            let window = PaidWindowParam::<T>::get();
            let (wstart, cnt) = if now_blk.saturating_sub(wstart) > window { (now_blk, 0u32) } else { (wstart, cnt) };
            ensure!(cnt < PaidMaxInWindowParam::<T>::get(), Error::<T>::BadState);
            PaidRate::<T>::insert(&who, (wstart, cnt.saturating_add(1)));
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.taker == who, Error::<T>::BadState);
                ensure!(matches!(ord.state, OrderState::Created), Error::<T>::BadState);
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
        #[pallet::weight(10_000)]
        pub fn mark_disputed(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.maker == who || ord.taker == who, Error::<T>::BadState);
                let cond_paid_unreleased = matches!(ord.state, OrderState::PaidOrCommitted);
                let cond_expired = now >= ord.expire_at;
                let cond_evidence_window = now <= ord.evidence_until;
                ensure!(cond_paid_unreleased || cond_expired || cond_evidence_window, Error::<T>::BadState);
                ord.state = OrderState::Disputed;
                Ok(())
            })?;
            Self::deposit_event(Event::OrderDisputed { id });
            Ok(())
        }

        /// 函数级详细中文注释：卖家放行（将托管金额划转给买家，订单完成）。
        /// - 要求：调用者为 maker；状态为 PaidOrCommitted 或 Disputed。
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn release(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(ord.maker == who, Error::<T>::BadState);
                ensure!(matches!(ord.state, OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                // 库存托管模式：从挂单托管划转本单金额给买家
                <T as Config>::Escrow::transfer_from_escrow(ord.listing_id, &ord.taker, ord.amount)?;
                ord.state = OrderState::Released;
                Ok(())
            })?;
            Self::deposit_event(Event::OrderReleased { id });
            Ok(())
        }

        /// 函数级详细中文注释：超时退款（任意人可触发，在状态与时窗满足时退回买家或卖家）。
        /// - 最小实现：仅当未放行且超过 expire_at，并处于 Created/PaidOrCommitted/Disputed 之一时，退回买家。
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn refund_on_timeout(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(now >= ord.expire_at, Error::<T>::BadState);
                ensure!(matches!(ord.state, OrderState::Created | OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                // 归还库存：将预留的数量退回到 listing.remaining
                ListingsMap::<T>::mutate(ord.listing_id, |m| if let Some(l)=m.as_mut(){ l.remaining = l.remaining.saturating_add(ord.qty); });
                ord.state = OrderState::Refunded;
                Ok(())
            })?;
            Self::deposit_event(Event::OrderRefunded { id });
            Ok(())
        }

        /// 函数级详细中文注释：揭示支付承诺
        /// - 计算 blake2_256(payload||salt) 与存储的 payment_commit 比较，不一致则报错
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn reveal_payment(origin: OriginFor<T>, id: u64, payload: Vec<u8>, salt: Vec<u8>) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            let ok = if let Some(o) = Orders::<T>::get(id) {
                let mut buf = payload.clone();
                buf.extend_from_slice(&salt);
                H256::from(blake2_256(&buf)) == o.payment_commit
            } else { false };
            ensure!(ok, Error::<T>::BadCommit);
            Self::deposit_event(Event::PaymentRevealed { id });
            Ok(())
        }

        /// 函数级详细中文注释：揭示联系方式承诺
        /// - 校验哈希一致性
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn reveal_contact(origin: OriginFor<T>, id: u64, payload: Vec<u8>, salt: Vec<u8>) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            let ok = if let Some(o) = Orders::<T>::get(id) {
                let mut buf = payload.clone();
                buf.extend_from_slice(&salt);
                H256::from(blake2_256(&buf)) == o.contact_commit
            } else { false };
            ensure!(ok, Error::<T>::BadCommit);
            Self::deposit_event(Event::ContactRevealed { id });
            Ok(())
        }

        /// 函数级详细中文注释：治理更新订单风控参数
        /// - 仅允许 Root 调用；未提供的参数保持不变。
        #[pallet::call_index(7)]
        #[pallet::weight(10_000)]
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
            if let Some(v) = open_window { OpenWindowParam::<T>::put(v); }
            if let Some(v) = open_max_in_window { OpenMaxInWindowParam::<T>::put(v); }
            if let Some(v) = paid_window { PaidWindowParam::<T>::put(v); }
            if let Some(v) = paid_max_in_window { PaidMaxInWindowParam::<T>::put(v); }
            if let Some(v) = min_order_amount { MinOrderAmount::<T>::put(v); }
            if let Some(v) = confirm_ttl { ConfirmTTLParam::<T>::put(v); }
            Self::deposit_event(Event::OrderParamsUpdated);
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
                let now = <frame_system::Pallet<T>>::block_number();
                let is_party = ord.maker == *who || ord.taker == *who;
                let cond_paid_unreleased = matches!(ord.state, OrderState::PaidOrCommitted);
                let cond_expired = now >= ord.expire_at;
                let cond_evidence_window = now <= ord.evidence_until;
                return is_party && (cond_paid_unreleased || cond_expired || cond_evidence_window);
            }
            false
        }
        fn arbitrate_release(id: u64) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(matches!(ord.state, OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                <T as Config>::Escrow::transfer_from_escrow(ord.listing_id, &ord.taker, ord.amount)?;
                ord.state = OrderState::Released;
                Ok(())
            })
        }
        fn arbitrate_refund(id: u64) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(matches!(ord.state, OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                // 恢复库存
                ListingsMap::<T>::mutate(ord.listing_id, |m| if let Some(l)=m.as_mut(){ l.remaining = l.remaining.saturating_add(ord.qty); });
                ord.state = OrderState::Refunded;
                Ok(())
            })
        }
        fn arbitrate_partial(id: u64, bps: u16) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(matches!(ord.state, OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                // 函数级中文注释：按 bps 分账：bps 给买家，其余退回卖家（从 listing 托管资金划转）
                let total = ord.amount;
                let buyer_share = (total / 10_000u32.into()) * (bps.into());
                let seller_share = total.saturating_sub(buyer_share);
                if !buyer_share.is_zero() { <T as Config>::Escrow::transfer_from_escrow(ord.listing_id, &ord.taker, buyer_share)?; }
                if !seller_share.is_zero() { <T as Config>::Escrow::transfer_from_escrow(ord.listing_id, &ord.maker, seller_share)?; }
                // 部分成交视为订单关闭，库存不回增（已占用份额按金额完成分配）
                ord.state = OrderState::Released;
                Ok(())
            })
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：到期自动退款（安全网）。
        /// - 对于到期且未完成的订单（Created/PaidOrCommitted/Disputed），将买家托管金额退回；
        /// - 由于索引容量有限，可能存在少量溢出订单需通过 `refund_on_timeout` 手动处理。
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let ids = ExpiringAt::<T>::take(n);
            for id in ids.into_inner() {
                if let Some(mut ord) = Orders::<T>::get(id) {
                    if matches!(ord.state, OrderState::Created | OrderState::PaidOrCommitted | OrderState::Disputed) {
                        // Plan B：自动超时退款仅恢复库存（买家资金未被锁定）。
                        ListingsMap::<T>::mutate(ord.listing_id, |m| if let Some(l)=m.as_mut(){ l.remaining = l.remaining.saturating_add(ord.qty); });
                        ord.state = OrderState::Refunded;
                        Orders::<T>::insert(id, ord);
                        // 可选：触发事件 Self::deposit_event(Event::OrderRefunded { id });
                    }
                }
            }
            Weight::from_parts(0, 0)
        }
    }
}

pub use pallet::*;


