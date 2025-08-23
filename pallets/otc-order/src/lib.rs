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
        pub expire_at: BlockNumber,
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
        OrderOpened { id: u64 },
        OrderPaidCommitted { id: u64 },
        OrderReleased { id: u64 },
        OrderRefunded { id: u64 },
        OrderCanceled { id: u64 },
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
                payment_commit, contact_commit,
                state: OrderState::Created,
            };
            Orders::<T>::insert(id, order);
            Self::deposit_event(Event::OrderOpened { id });
            Ok(())
        }
    }
}


