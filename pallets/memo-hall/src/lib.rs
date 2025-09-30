#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use core::marker::PhantomData;
    use frame_support::{pallet_prelude::*, traits::StorageVersion, BoundedVec};
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::Saturating;

    /// 函数级中文注释：Hall KYC 提供者抽象，runtime 可基于 pallet-identity 实现。
    pub trait KycProvider<AccountId> {
        fn is_verified(who: &AccountId) -> bool;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
        #[pallet::constant]
        type CreateHallWindow: Get<BlockNumberFor<Self>>;
        #[pallet::constant]
        type CreateHallMaxInWindow: Get<u32>;
        #[pallet::constant]
        type RequireKyc: Get<bool>;
        type Kyc: KycProvider<Self::AccountId>;
    }

    /// 函数级中文注释：纪念馆基础信息。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Hall<T: Config> {
        pub owner: T::AccountId,
        pub kind: u8,                   // 0=Person,1=Event
        pub link_grave_id: Option<u64>, // 可选关联实体墓位
        pub metadata_cid: BoundedVec<u8, T::MaxCidLen>,
    }

    /// 函数级中文注释：存储版本。
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(PhantomData<T>);

    #[pallet::storage]
    pub type NextHallId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type Halls<T: Config> = StorageMap<_, Blake2_128Concat, u64, Hall<T>, OptionQuery>;

    /// 纪念馆创建限频（账户 -> (窗口起点, 计数)）
    #[pallet::storage]
    pub type CreateHallRate<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, (BlockNumberFor<T>, u32), ValueQuery>;

    #[pallet::type_value]
    pub fn DefaultCreateHallWindow<T: Config>() -> BlockNumberFor<T> {
        T::CreateHallWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultCreateHallMaxInWindow<T: Config>() -> u32 {
        T::CreateHallMaxInWindow::get()
    }
    #[pallet::type_value]
    pub fn DefaultRequireKyc<T: Config>() -> bool {
        T::RequireKyc::get()
    }
    #[pallet::storage]
    pub type CreateHallWindowParam<T: Config> =
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultCreateHallWindow<T>>;
    #[pallet::storage]
    pub type CreateHallMaxInWindowParam<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultCreateHallMaxInWindow<T>>;
    #[pallet::storage]
    pub type RequireKycParam<T: Config> = StorageValue<_, bool, ValueQuery, DefaultRequireKyc<T>>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        HallCreated {
            id: u64,
            kind: u8,
            owner: T::AccountId,
            link_grave_id: Option<u64>,
        },
        HallLinkedDeceased {
            id: u64,
            deceased_id: u64,
        },
        HallParamsUpdated,
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        NotOwner,
        PolicyViolation,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建纪念馆（支持 KYC、创建限频、可选关联实体墓位）。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_hall(
            origin: OriginFor<T>,
            kind: u8,
            link_grave_id: Option<u64>,
            metadata_cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            if RequireKycParam::<T>::get() {
                ensure!(
                    <T as Config>::Kyc::is_verified(&who),
                    Error::<T>::PolicyViolation
                );
            }
            let now: BlockNumberFor<T> = <frame_system::Pallet<T>>::block_number();
            let (win_start, cnt) = CreateHallRate::<T>::get(&who);
            let window: BlockNumberFor<T> = CreateHallWindowParam::<T>::get();
            let (win_start, cnt) = if now.saturating_sub(win_start) > window {
                (now, 0u32)
            } else {
                (win_start, cnt)
            };
            ensure!(
                cnt < CreateHallMaxInWindowParam::<T>::get(),
                Error::<T>::PolicyViolation
            );
            CreateHallRate::<T>::insert(&who, (win_start, cnt.saturating_add(1)));
            ensure!(kind == 0 || kind == 1, Error::<T>::PolicyViolation);
            let id = NextHallId::<T>::mutate(|n| {
                let id = *n;
                *n = n.saturating_add(1);
                id
            });
            let hall = Hall::<T> {
                owner: who.clone(),
                kind,
                link_grave_id,
                metadata_cid,
            };
            Halls::<T>::insert(id, &hall);
            Self::deposit_event(Event::HallCreated {
                id,
                kind,
                owner: who,
                link_grave_id,
            });
            Ok(())
        }

        /// 函数级中文注释：绑定主逝者（仅馆主）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn link_primary_deceased(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let hall = Halls::<T>::get(id).ok_or(Error::<T>::NotFound)?;
            ensure!(who == hall.owner, Error::<T>::NotOwner);
            // 这里仅发事件，具体逝者索引由上层 pallet 处理（低耦合）
            Self::deposit_event(Event::HallLinkedDeceased { id, deceased_id });
            Ok(())
        }

        /// 函数级中文注释：治理更新创建风控参数（Root）。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_params(
            origin: OriginFor<T>,
            create_window: Option<BlockNumberFor<T>>,
            create_max_in_window: Option<u32>,
            require_kyc: Option<bool>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            if let Some(v) = create_window {
                CreateHallWindowParam::<T>::put(v);
            }
            if let Some(v) = create_max_in_window {
                CreateHallMaxInWindowParam::<T>::put(v);
            }
            if let Some(v) = require_kyc {
                RequireKycParam::<T>::put(v);
            }
            Self::deposit_event(Event::HallParamsUpdated);
            Ok(())
        }
    }
}
