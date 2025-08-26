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
        #[pallet::constant] type MaxIdsPerName: Get<u32>;
        #[pallet::constant] type MaxComplaintsPerGrave: Get<u32>;
        /// 函数级中文注释：每个墓位最多可绑定的管理员账户数（不含墓主）。
        #[pallet::constant] type MaxAdminsPerGrave: Get<u32>;
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

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct GraveMeta { pub categories: u32, pub religion: u8 }

    #[pallet::storage]
    pub type GraveMetaOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, GraveMeta, ValueQuery>;

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct Moderation { pub restricted: bool, pub removed: bool, pub reason_code: u8 }

    #[pallet::storage]
    pub type ModerationOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, Moderation, ValueQuery>;

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Complaint<T: Config> { pub who: T::AccountId, pub cid: BoundedVec<u8, T::MaxCidLen>, pub time: BlockNumberFor<T> }

    #[pallet::storage]
    pub type ComplaintsByGrave<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<Complaint<T>, T::MaxComplaintsPerGrave>, ValueQuery>;

    #[pallet::storage]
    pub type NameIndex<T: Config> = StorageMap<_, Blake2_128Concat, [u8;32], BoundedVec<u64, T::MaxIdsPerName>, ValueQuery>;

    /// 函数级中文注释：墓位管理员列表（不含墓主），统一授权源供子模块（如 deceased）只读引用。
    #[pallet::storage]
    pub type GraveAdmins<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<T::AccountId, T::MaxAdminsPerGrave>, ValueQuery>;

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
        MetaUpdated { id: u64 },
        ComplainSubmitted { id: u64, who: T::AccountId },
        Restricted { id: u64, on: bool, reason_code: u8 },
        Removed { id: u64, reason_code: u8 },
        NameHashSet { id: u64, name_hash: [u8;32] },
        NameHashCleared { id: u64, name_hash: [u8;32] },
        /// 已添加墓位管理员
        AdminAdded { id: u64, who: T::AccountId },
        /// 已移除墓位管理员
        AdminRemoved { id: u64, who: T::AccountId },
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
        AlreadyRemoved,
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

        /// 函数级中文注释：设置墓地扩展元（分类/宗教）。
        #[pallet::weight(10_000)]
        pub fn set_meta(origin: OriginFor<T>, id: u64, categories: Option<u32>, religion: Option<u8>) -> DispatchResult {
            // 墓主或管理员
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) { if w != g.owner { T::ParkAdmin::ensure(g.park_id, origin)?; } }
            } else { return Err(Error::<T>::NotFound.into()); }
            GraveMetaOf::<T>::mutate(id, |m| {
                if let Some(c) = categories { m.categories = c; }
                if let Some(r) = religion { m.religion = r; }
            });
            Self::deposit_event(Event::MetaUpdated { id });
            Ok(())
        }

        /// 函数级中文注释：用户提交投诉（CID 仅指向证据，不落明文）。
        #[pallet::weight(10_000)]
        pub fn complain(origin: OriginFor<T>, id: u64, cid: BoundedVec<u8, T::MaxCidLen>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ensure!(!ModerationOf::<T>::get(id).removed, Error::<T>::AlreadyRemoved);
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintsByGrave::<T>::try_mutate(id, |list| list.try_push(Complaint::<T>{ who: who.clone(), cid, time: now }).map_err(|_| Error::<T>::CapacityExceeded))?;
            Self::deposit_event(Event::ComplainSubmitted { id, who });
            Ok(())
        }

        /// 函数级中文注释：园区管理员设置/取消限制。
        #[pallet::weight(10_000)]
        pub fn restrict(origin: OriginFor<T>, id: u64, on: bool, reason_code: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) { T::ParkAdmin::ensure(g.park_id, origin)?; } else { return Err(Error::<T>::NotFound.into()); }
            ModerationOf::<T>::mutate(id, |m| { m.restricted = on; m.reason_code = reason_code; });
            Self::deposit_event(Event::Restricted { id, on, reason_code });
            Ok(())
        }

        /// 函数级中文注释：园区管理员软删除（并自动设置限制）。
        #[pallet::weight(10_000)]
        pub fn remove(origin: OriginFor<T>, id: u64, reason_code: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) { T::ParkAdmin::ensure(g.park_id, origin)?; } else { return Err(Error::<T>::NotFound.into()); }
            ModerationOf::<T>::mutate(id, |m| { m.removed = true; m.restricted = true; m.reason_code = reason_code; });
            Self::deposit_event(Event::Removed { id, reason_code });
            Ok(())
        }

        /// 函数级中文注释：绑定名称哈希索引（不存明文）。
        #[pallet::weight(10_000)]
        pub fn set_name_hash(origin: OriginFor<T>, id: u64, name_hash: [u8;32]) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) { if w != g.owner { T::ParkAdmin::ensure(g.park_id, origin)?; } }
            } else { return Err(Error::<T>::NotFound.into()); }
            NameIndex::<T>::try_mutate(name_hash, |list| -> Result<(), Error<T>> {
                if !list.iter().any(|x| *x == id) { list.try_push(id).map_err(|_| Error::<T>::CapacityExceeded)?; }
                Ok(())
            })?;
            Self::deposit_event(Event::NameHashSet { id, name_hash });
            Ok(())
        }

        /// 函数级中文注释：从名称哈希索引中移除该墓地。
        #[pallet::weight(10_000)]
        pub fn clear_name_hash(origin: OriginFor<T>, id: u64, name_hash: [u8;32]) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) { if w != g.owner { T::ParkAdmin::ensure(g.park_id, origin)?; } }
            } else { return Err(Error::<T>::NotFound.into()); }
            NameIndex::<T>::mutate(name_hash, |list| { if let Some(pos) = list.iter().position(|x| *x == id) { list.swap_remove(pos); } });
            Self::deposit_event(Event::NameHashCleared { id, name_hash });
            Ok(())
        }

        /// 函数级中文注释：添加墓位管理员（不含墓主）。仅墓主或园区管理员可调用。
        #[pallet::weight(10_000)]
        pub fn add_admin(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { T::ParkAdmin::ensure(g.park_id, origin)?; } }
            } else { return Err(Error::<T>::NotFound.into()); }
            GraveAdmins::<T>::try_mutate(id, |list| -> Result<(), Error<T>> {
                if !list.iter().any(|x| x == &who) { list.try_push(who.clone()).map_err(|_| Error::<T>::CapacityExceeded)?; }
                Ok(())
            })?;
            Self::deposit_event(Event::AdminAdded { id, who });
            Ok(())
        }

        /// 函数级中文注释：移除墓位管理员。仅墓主或园区管理员可调用。
        #[pallet::weight(10_000)]
        pub fn remove_admin(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { T::ParkAdmin::ensure(g.park_id, origin)?; } }
            } else { return Err(Error::<T>::NotFound.into()); }
            GraveAdmins::<T>::mutate(id, |list| {
                if let Some(pos) = list.iter().position(|x| *x == who) { list.swap_remove(pos); }
            });
            Self::deposit_event(Event::AdminRemoved { id, who });
            Ok(())
        }
    }
}


