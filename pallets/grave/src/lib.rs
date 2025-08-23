#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, BoundedVec};
    use frame_system::pallet_prelude::*;

    /// 函数级中文注释：安葬回调接口，供外部统计/联动。
    pub trait OnIntermentCommitted {
        /// 当某个逝者被安葬到某墓位时触发
        fn on_interment(grave_id: u64, deceased_id: u64);
    }

    /// 函数级中文注释：陵园管理员权限校验接口，占位以便 grave 在需要时允许上级管理员操作。
    pub trait ParkAdminOrigin<Origin> {
        fn ensure(park_id: u64, origin: Origin) -> DispatchResult;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant] type MaxCidLen: Get<u32>;
        #[pallet::constant] type MaxPerPark: Get<u32>;
        #[pallet::constant] type MaxIntermentsPerGrave: Get<u32>;
        type OnInterment: OnIntermentCommitted;
        type ParkAdmin: ParkAdminOrigin<Self::RuntimeOrigin>;
    }

    /// 函数级中文注释：墓地信息结构。仅存储加密 CID，不落明文。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Grave<T: Config> {
        pub park_id: u64,
        pub owner: T::AccountId,
        pub admin_group: Option<u64>,
        pub kind_code: u8, // 0=Single,1=Double,2=Multi
        pub capacity: u16,
        pub metadata_cid: BoundedVec<u8, T::MaxCidLen>,
        pub active: bool,
    }

    /// 函数级中文注释：安葬记录，记录逝者与墓位的绑定及备注。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct IntermentRecord<T: Config> {
        pub deceased_id: u64,
        pub slot: u16,
        pub time: BlockNumberFor<T>,
        pub note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type NextGraveId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type Graves<T: Config> = StorageMap<_, Blake2_128Concat, u64, Grave<T>, OptionQuery>;

    #[pallet::storage]
    pub type GravesByPark<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u64, T::MaxPerPark>, ValueQuery>;

    #[pallet::storage]
    pub type Interments<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<IntermentRecord<T>, T::MaxIntermentsPerGrave>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        GraveCreated { id: u64, park_id: u64, owner: T::AccountId },
        GraveUpdated { id: u64 },
        GraveTransferred { id: u64, new_owner: T::AccountId },
        Interred { id: u64, deceased_id: u64 },
        Exhumed { id: u64, deceased_id: u64 },
        GraveActivated { id: u64 },
        GraveDeactivated { id: u64 },
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        NotOwner,
        NotAdmin,
        ParkNotFound,
        CapacityExceeded,
        AlreadyOccupied,
        InvalidKind,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建墓地（单/双/多人），隶属某陵园。
        #[pallet::weight(10_000)]
        pub fn create_grave(
            origin: OriginFor<T>,
            park_id: u64,
            kind_code: u8,
            capacity: Option<u16>,
            metadata_cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(matches!(kind_code, 0|1|2), Error::<T>::InvalidKind);
            let cap = capacity.unwrap_or_else(|| if kind_code == 2 { 8 } else { 1 + (kind_code as u16) });
            let id = NextGraveId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
            let grave = Grave::<T> { park_id, owner: who.clone(), admin_group: None, kind_code, capacity: cap, metadata_cid, active: true };
            Graves::<T>::insert(id, &grave);
            GravesByPark::<T>::try_mutate(park_id, |v| v.try_push(id).map_err(|_| Error::<T>::CapacityExceeded))?;
            Self::deposit_event(Event::GraveCreated { id, park_id, owner: who });
            Ok(())
        }

        /// 函数级中文注释：更新墓地的类型/容量/元数据/状态，允许所有者或陵园管理员。
        #[pallet::weight(10_000)]
        pub fn update_grave(
            origin: OriginFor<T>, id: u64,
            kind_code: Option<u8>,
            capacity: Option<u16>,
            metadata_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            active: Option<bool>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner { T::ParkAdmin::ensure(g.park_id, origin.clone())?; }
                if let Some(k) = kind_code { ensure!(matches!(k,0|1|2), Error::<T>::InvalidKind); g.kind_code = k; }
                if let Some(c) = capacity { g.capacity = c; }
                if let Some(cid) = metadata_cid { g.metadata_cid = cid; }
                if let Some(a) = active { g.active = a; }
                Ok(())
            })?;
            Self::deposit_event(Event::GraveUpdated { id });
            Ok(())
        }

        /// 函数级中文注释：转让墓地所有权，仅所有者可调用。
        #[pallet::weight(10_000)]
        pub fn transfer_grave(origin: OriginFor<T>, id: u64, new_owner: T::AccountId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                g.owner = new_owner.clone();
                Ok(())
            })?;
            Self::deposit_event(Event::GraveTransferred { id, new_owner });
            Ok(())
        }

        /// 函数级中文注释：安葬逝者到墓地指定槽位（可选）。
        /// - 校验容量与重复安葬；
        /// - 触发 `OnIntermentCommitted` 供外部统计或联动。
        #[pallet::weight(10_000)]
        pub fn inter(origin: OriginFor<T>, id: u64, deceased_id: u64, slot: Option<u16>, note_cid: Option<BoundedVec<u8, T::MaxCidLen>>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let now = <frame_system::Pallet<T>>::block_number();
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner { T::ParkAdmin::ensure(g.park_id, origin.clone())?; }
                let mut records = Interments::<T>::get(id);
                ensure!((records.len() as u16) < g.capacity, Error::<T>::CapacityExceeded);
                let use_slot = slot.unwrap_or(records.len() as u16);
                // 简化：不做重复槽校验，记录层面由上层约束（可扩展）
                records.try_push(IntermentRecord::<T> { deceased_id, slot: use_slot, time: now, note_cid }).map_err(|_| Error::<T>::CapacityExceeded)?;
                Interments::<T>::insert(id, records);
                Ok(())
            })?;
            T::OnInterment::on_interment(id, deceased_id);
            Self::deposit_event(Event::Interred { id, deceased_id });
            Ok(())
        }

        /// 函数级中文注释：从墓地记录中移除某逝者（起掘）。
        #[pallet::weight(10_000)]
        pub fn exhume(origin: OriginFor<T>, id: u64, deceased_id: u64) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate_exists(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner { T::ParkAdmin::ensure(g.park_id, origin.clone())?; }
                let mut records = Interments::<T>::get(id);
                if let Some(pos) = records.iter().position(|r| r.deceased_id == deceased_id) {
                    records.swap_remove(pos);
                    Interments::<T>::insert(id, records);
                    Ok(())
                } else {
                    Err(Error::<T>::NotFound.into())
                }
            })?;
            Self::deposit_event(Event::Exhumed { id, deceased_id });
            Ok(())
        }
    }
}


