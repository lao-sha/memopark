#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{pallet_prelude::*, traits::{Currency, Get}};
    use frame_system::pallet_prelude::*;
    use sp_core::H256;

    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

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
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: Currency<Self::AccountId>;
        type ConfirmTTL: Get<BlockNumberFor<Self>>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type Orders<T: Config> = StorageMap<_, Blake2_128Concat, u64, Order<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>, OptionQuery>;
    #[pallet::storage]
    pub type NextOrderId<T: Config> = StorageValue<_, u64, ValueQuery>;

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
    }

    #[pallet::error]
    pub enum Error<T> { NotFound, BadState }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：吃单→创建订单
        /// - 输入：listing_id 与数量、支付/联系方式承诺哈希
        /// - 说明：最小骨架，仅落库与事件，资金/托管/库存交由后续补充
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
            let id = NextOrderId::<T>::mutate(|x| { let id=*x; *x = id.saturating_add(1); id });
            let now = <frame_system::Pallet<T>>::block_number();
            let order = Order::<_, _, _> {
                listing_id,
                maker: who.clone(),
                taker: who,
                price, qty, amount,
                created_at: now,
                expire_at: now + T::ConfirmTTL::get(),
                evidence_until: now + T::ConfirmTTL::get(),
                payment_commit, contact_commit,
                state: OrderState::Created,
            };
            Orders::<T>::insert(id, &order);
            Self::deposit_event(Event::OrderOpened { id, listing_id, maker: order.maker.clone(), taker: order.taker.clone(), price, qty, amount, created_at: now, expire_at: order.expire_at });
            Ok(())
        }

        /// 函数级详细中文注释：买家标记“已支付/已提交凭据”，进入待放行阶段。
        /// - 要求：调用者必须为订单 taker，状态为 Created。
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn mark_paid(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
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
                ord.state = OrderState::Released;
                Ok(())
            })
        }
        fn arbitrate_refund(id: u64) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(matches!(ord.state, OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                ord.state = OrderState::Refunded;
                Ok(())
            })
        }
        fn arbitrate_partial(id: u64, _bps: u16) -> DispatchResult {
            Orders::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let ord = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(matches!(ord.state, OrderState::PaidOrCommitted | OrderState::Disputed), Error::<T>::BadState);
                // 本最小实现仅更新状态为 Released；金额按 bps 分配由资金模块处理。
                ord.state = OrderState::Released;
                Ok(())
            })
        }
    }
}


