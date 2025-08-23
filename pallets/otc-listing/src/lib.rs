#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{pallet_prelude::*, BoundedVec, traits::{Get, Currency}};
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::{Saturating, SaturatedConversion};

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
        pub price: Balance,
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
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: Currency<Self::AccountId>;
        type MaxCidLen: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type Listings<T: Config> = StorageMap<_, Blake2_128Concat, u64, Listing<T::MaxCidLen, T::AccountId, BalanceOf<T>, BlockNumberFor<T>>, OptionQuery>;
    #[pallet::storage]
    pub type NextListingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        ListingCreated { id: u64 },
        ListingUpdated { id: u64 },
        ListingCanceled { id: u64 },
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadState,
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
            price: BalanceOf<T>,
            min_qty: BalanceOf<T>,
            max_qty: BalanceOf<T>,
            total: BalanceOf<T>,
            partial: bool,
            expire_at: BlockNumberFor<T>,
            terms_commit: Option<BoundedVec<u8, T::MaxCidLen>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let id = NextListingId::<T>::mutate(|x| { let id=*x; *x=id.saturating_add(1); id });
            let listing = Listing::<T::MaxCidLen, _, _, _> {
                maker: who,
                side,
                base, quote, price,
                min_qty, max_qty,
                total, remaining: total,
                partial,
                expire_at,
                terms_commit,
                active: true,
            };
            Listings::<T>::insert(id, listing);
            Self::deposit_event(Event::ListingCreated { id });
            Ok(())
        }

        /// 函数级详细中文注释：取消挂单
        /// - 只有创建者可取消；状态置为 inactive
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn cancel_listing(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Listings::<T>::try_mutate(id, |maybe| -> Result<(), DispatchError> {
                let v = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(v.maker == who, Error::<T>::BadState);
                v.active = false;
                Ok(())
            })?;
            Self::deposit_event(Event::ListingCanceled { id });
            Ok(())
        }
    }
}


