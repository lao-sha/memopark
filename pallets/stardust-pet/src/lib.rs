#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use alloc::vec::Vec;
    use frame_support::{pallet_prelude::*, BoundedVec};
    use frame_system::pallet_prelude::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant]
        type StringLimit: Get<u32>;
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

    #[pallet::storage]
    pub type NextPetId<T: Config> = StorageValue<_, u64, ValueQuery>;
    #[pallet::storage]
    pub type PetOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, Pet<T>, OptionQuery>;
    /// 函数级中文注释：宠物附着到的墓位（可选）。
    #[pallet::storage]
    pub type PetInGrave<T: Config> = StorageMap<_, Blake2_128Concat, u64, u64, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        PetCreated(u64, T::AccountId),
        /// 宠物附着到墓位
        PetAttached(u64, u64),
        /// 宠物从墓位解绑
        PetDetached(u64),
    }

    #[pallet::error]
    pub enum Error<T> {
        BadInput,
        NotFound,
        NotOwner,
        GraveNotFound,
        NotAllowed,
    }

    // 说明：仅保留创建，便于测试；后续可扩展为与 deceased 同结构的访问 Trait。
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建一只宠物主体（最小字段）。
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_pet(
            origin: OriginFor<T>,
            name: Vec<u8>,
            species: Vec<u8>,
            token: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let name_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let sp_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(species).map_err(|_| Error::<T>::BadInput)?;
            let tk_bv: BoundedVec<_, T::StringLimit> =
                BoundedVec::try_from(token).map_err(|_| Error::<T>::BadInput)?;
            let id = NextPetId::<T>::mutate(|n| {
                let x = *n;
                *n = x.saturating_add(1);
                x
            });
            let now = <frame_system::Pallet<T>>::block_number();
            let p = Pet {
                name: name_bv,
                owner: who.clone(),
                species: sp_bv,
                token: tk_bv,
                created: now,
            };
            PetOf::<T>::insert(id, p);
            Self::deposit_event(Event::PetCreated(id, who));
            Ok(())
        }

        /// 函数级中文注释：将宠物附着到墓位（仅宠物 owner）。
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn attach_to_grave(origin: OriginFor<T>, pet_id: u64, grave_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;
            ensure!(pet.owner == who, Error::<T>::NotOwner);

            PetInGrave::<T>::insert(pet_id, grave_id);
            Self::deposit_event(Event::PetAttached(pet_id, grave_id));
            Ok(())
        }

        /// 函数级中文注释：解绑宠物与墓位（仅宠物 owner）。
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn detach_from_grave(origin: OriginFor<T>, pet_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;
            ensure!(pet.owner == who, Error::<T>::NotOwner);
            PetInGrave::<T>::remove(pet_id);
            Self::deposit_event(Event::PetDetached(pet_id));
            Ok(())
        }
    }
}
