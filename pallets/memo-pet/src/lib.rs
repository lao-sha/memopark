#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, BoundedVec};
    use alloc::vec::Vec;
    use frame_system::pallet_prelude::*;

    /// 函数级中文注释：最小“宠物主体”Pallet，占位结构与只读接口，便于 TargetControl 与前端整合展示。
    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant] type StringLimit: Get<u32>;
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Pet<T: Config> {
        /// 函数级中文注释：宠物名
        pub name: BoundedVec<u8, T::StringLimit>,
        /// 函数级中文注释：拥有者
        pub owner: T::AccountId,
        /// 函数级中文注释：物种（dog/cat/bird... 可由前端词表）
        pub species: BoundedVec<u8, T::StringLimit>,
        /// 函数级中文注释：token（人类/宠物合并展示用）
        pub token: BoundedVec<u8, T::StringLimit>,
        /// 函数级中文注释：创建时间
        pub created: BlockNumberFor<T>,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(PhantomData<T>);

    #[pallet::storage] pub type NextPetId<T: Config> = StorageValue<_, u64, ValueQuery>;
    #[pallet::storage] pub type PetOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, Pet<T>, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        PetCreated(u64, T::AccountId),
    }

    #[pallet::error]
    pub enum Error<T> { BadInput, NotFound }

    // 说明：仅保留创建，便于测试；后续可扩展为与 deceased 同结构的访问 Trait。
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建一只宠物主体（最小字段）。
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_pet(origin: OriginFor<T>, name: Vec<u8>, species: Vec<u8>, token: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let name_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let sp_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(species).map_err(|_| Error::<T>::BadInput)?;
            let tk_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(token).map_err(|_| Error::<T>::BadInput)?;
            let id = NextPetId::<T>::mutate(|n| { let x=*n; *n = x.saturating_add(1); x });
            let now = <frame_system::Pallet<T>>::block_number();
            let p = Pet { name: name_bv, owner: who.clone(), species: sp_bv, token: tk_bv, created: now };
            PetOf::<T>::insert(id, p);
            Self::deposit_event(Event::PetCreated(id, who));
            Ok(())
        }
    }
}


