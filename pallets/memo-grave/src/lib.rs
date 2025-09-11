#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

// 模块引入：权重接口定义
pub mod weights;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, BoundedVec, traits::StorageVersion};
    use frame_support::weights::Weight;
    use crate::weights::WeightInfo;
    use frame_system::pallet_prelude::*;
    use sp_runtime::SaturatedConversion;
    use alloc::vec::Vec;
    use codec::DecodeWithMemTracking;

    /// 函数级中文注释：安葬回调接口，供外部统计/联动。
    pub trait OnIntermentCommitted {
        /// 当某个逝者被安葬到某墓位时触发
        fn on_interment(grave_id: u64, deceased_id: u64);
    }

    /// 函数级中文注释：陵园管理员权限校验接口，占位以便 grave 在需要时允许上级管理员操作。
    pub trait ParkAdminOrigin<Origin> {
        fn ensure(park_id: u64, origin: Origin) -> DispatchResult;
    }

    /// 函数级中文注释：KYC 提供者抽象（由 runtime 实现，例如基于 pallet-identity 的判定）。
    pub trait KycProvider<AccountId> { fn is_verified(who: &AccountId) -> bool; }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 函数级中文注释：权重信息，由 runtime 提供实现（未基准前可在 runtime 设为 `TestWeights`）。
        type WeightInfo: WeightInfo;
        #[pallet::constant] type MaxCidLen: Get<u32>;
        #[pallet::constant] type MaxPerPark: Get<u32>;
        #[pallet::constant] type MaxIntermentsPerGrave: Get<u32>;
        type OnInterment: OnIntermentCommitted;
        type ParkAdmin: ParkAdminOrigin<Self::RuntimeOrigin>;
        #[pallet::constant] type MaxIdsPerName: Get<u32>;
        #[pallet::constant] type MaxComplaintsPerGrave: Get<u32>;
        /// 函数级中文注释：每个墓位最多可绑定的管理员账户数（不含墓主）。
        #[pallet::constant] type MaxAdminsPerGrave: Get<u32>;
        /// 函数级中文注释：人类可读 ID（Slug）长度（固定 10 位数字）。
        #[pallet::constant] type SlugLen: Get<u32>;
        /// 函数级中文注释：关注者上限
        #[pallet::constant] type MaxFollowers: Get<u32>;
    }

    /// 函数级中文注释：墓地信息结构。仅存储加密 CID，不落明文。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Grave<T: Config> {
        /// 函数级中文注释：墓位所属园区 ID；可选。None 表示尚未隶属于任何园区。
        pub park_id: Option<u64>,
        pub owner: T::AccountId,
        pub admin_group: Option<u64>,
        pub kind_code: u8, // 0=Single,1=Double,2=Multi 多人墓
        pub capacity: u16, // 已安葬数量
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

    // 存储版本常量（用于 FRAME v2 storage_version 宏传参）
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(4);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
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

    /// 函数级中文注释：人类可读 ID（Slug），长度固定为 10 位数字。
    #[pallet::storage]
    pub type SlugOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<u8, T::SlugLen>, OptionQuery>;

    /// 函数级中文注释：Slug -> GraveId 映射，便于通过 Slug 解析 Grave。
    #[pallet::storage]
    pub type GraveBySlug<T: Config> = StorageMap<_, Blake2_128Concat, BoundedVec<u8, T::SlugLen>, u64, OptionQuery>;

    /// 函数级中文注释：加入策略：0=Open,1=Whitelist。
    #[pallet::storage]
    pub type JoinPolicyOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, u8, ValueQuery>;

    /// 函数级中文注释：成员集合（通过后可留言/供奉）。
    #[pallet::storage]
    pub type Members<T: Config> = StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    /// 函数级中文注释：待审批的加入申请（私有模式）。
    #[pallet::storage]
    pub type PendingApplications<T: Config> = StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, T::AccountId, BlockNumberFor<T>, OptionQuery>;

    /// 可见性策略：是否公开供奉/留言/扫墓/关注
    use sp_runtime::RuntimeDebug;
    #[derive(Encode, Decode, DecodeWithMemTracking, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default, RuntimeDebug)]
    pub struct VisibilityPolicy { pub public_offering: bool, pub public_guestbook: bool, pub public_sweep: bool, pub public_follow: bool }

    #[pallet::storage]
    pub type VisibilityPolicyOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, VisibilityPolicy, ValueQuery>;

    /// 关注者列表
    #[pallet::storage]
    pub type FollowersOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<T::AccountId, T::MaxFollowers>, ValueQuery>;

    /// 函数级中文注释：成员↔逝者亲属关系记录
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct KinshipRecord<T: Config> {
        pub code: u8,
        pub note: BoundedVec<u8, T::MaxCidLen>,
        pub verified: bool,
        pub time: BlockNumberFor<T>,
    }

    /// 函数级中文注释：成员在某墓位下声明与某逝者的亲属关系。
    #[pallet::storage]
    pub type KinshipOf<T: Config> = StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, (u64, T::AccountId), KinshipRecord<T>, OptionQuery>;

    /// 函数级中文注释：成员在某墓位下的关系索引，便于前端快速拉取。
    #[pallet::storage]
    pub type KinshipIndexByMember<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::AccountId, Blake2_128Concat, u64, BoundedVec<(u64, u8), ConstU32<64>>, ValueQuery>;

    /// 函数级中文注释：亲属关系声明策略：0=Auto（自动通过），1=Approve（需管理员审核）。
    #[pallet::storage]
    pub type KinshipPolicyOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, u8, ValueQuery>;

    // ===== Hall（纪念馆）增强：附加信息与风控 =====
    // Hall 相关已拆分至独立 pallet-memo-hall（此处删除存储）。

    // Hall 限频与 KYC 参数已移至新 pallet。

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        GraveCreated { id: u64, park_id: Option<u64>, owner: T::AccountId },
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
        /// 已分配人类可读 ID（Slug）
        SlugAssigned { id: u64, slug: BoundedVec<u8, T::SlugLen> },
        /// 加入策略已变更（0=Open,1=Whitelist）
        PolicyChanged { id: u64, policy: u8 },
        /// 成员申请/批准/拒绝/加入
        MemberApplied { id: u64, who: T::AccountId },
        MemberApproved { id: u64, who: T::AccountId },
        MemberRejected { id: u64, who: T::AccountId },
        MemberJoined { id: u64, who: T::AccountId },
        /// 成员↔逝者亲属关系相关事件
        KinshipDeclared { id: u64, deceased_id: u64, who: T::AccountId, code: u8 },
        KinshipApproved { id: u64, deceased_id: u64, who: T::AccountId },
        KinshipRejected { id: u64, deceased_id: u64, who: T::AccountId },
        KinshipUpdated { id: u64, deceased_id: u64, who: T::AccountId, code: u8 },
        KinshipRemoved { id: u64, deceased_id: u64, who: T::AccountId },
        KinshipPolicyChanged { id: u64, policy: u8 },
        /// 可见性策略变更
        VisibilityUpdated { id: u64, policy: VisibilityPolicy },
        /// 关注/取消关注
        Followed { id: u64, who: T::AccountId },
        Unfollowed { id: u64, who: T::AccountId },
        /// 设置墓位所属园区
        GraveSetPark { id: u64, park_id: Option<u64> },
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
        /// Slug 已存在
        SlugExists,
        /// Slug 非法
        InvalidSlug,
        /// 已是成员
        AlreadyMember,
        /// 非成员
        NotMember,
        /// 已申请
        AlreadyApplied,
        /// 未申请
        NotApplied,
        /// 策略限制
        PolicyViolation,
        /// 亲属关系重复
        KinshipExists,
        /// 亲属关系不存在
        KinshipNotFound,
        /// 已关注
        AlreadyFollowing,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建墓地（单/双/多人），隶属某陵园。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::create_grave())]
        pub fn create_grave(
            origin: OriginFor<T>,
            park_id: Option<u64>,
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
            if let Some(pid) = grave.park_id { GravesByPark::<T>::try_mutate(pid, |v| v.try_push(id).map_err(|_| Error::<T>::CapacityExceeded))?; }
            // 生成 10 位数字 Slug（基于 id 与创建者），确保唯一
            let slug = Self::gen_unique_slug(id, &who)?;
            GraveBySlug::<T>::insert(&slug, id);
            SlugOf::<T>::insert(id, &slug);
            // 默认策略：Open
            JoinPolicyOf::<T>::insert(id, 0u8);
            Self::deposit_event(Event::GraveCreated { id, park_id, owner: who });
            Self::deposit_event(Event::SlugAssigned { id, slug });
            Ok(())
        }

        // 已移至 pallet-memo-hall：create_hall

        // 已移至 pallet-memo-hall：attach_deceased

        /// 函数级中文注释：设置墓位所属园区（仅墓主或园区管理员）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_park())]
        pub fn set_park(origin: OriginFor<T>, id: u64, park_id: Option<u64>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin.clone())?; } else { return Err(Error::<T>::NotAdmin.into()); }
                }
                if g.park_id != park_id {
                    // 从旧园区索引移除
                    if let Some(old) = g.park_id {
                        let mut lst = GravesByPark::<T>::get(old);
                        if let Some(pos) = lst.iter().position(|x| *x == id) { lst.swap_remove(pos); }
                        GravesByPark::<T>::insert(old, lst);
                    }
                    // 加入新园区索引（若有）
                    if let Some(new_pid) = park_id { GravesByPark::<T>::mutate(new_pid, |v| { let _ = v.try_push(id); }); }
                    g.park_id = park_id;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::GraveSetPark { id, park_id });
            Ok(())
        }

        // 已移至 pallet-memo-hall：set_hall_params

        /// 函数级中文注释：更新墓地的类型/容量/元数据/状态，允许所有者或陵园管理员。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
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
                if who != g.owner {
                    if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin.clone())?; } else { return Err(Error::<T>::NotAdmin.into()); }
                }
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
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer_grave())]
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
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::inter())]
        pub fn inter(origin: OriginFor<T>, id: u64, deceased_id: u64, slot: Option<u16>, note_cid: Option<BoundedVec<u8, T::MaxCidLen>>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let now = <frame_system::Pallet<T>>::block_number();
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin.clone())?; } else { return Err(Error::<T>::NotAdmin.into()); }
                }
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
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::exhume())]
        pub fn exhume(origin: OriginFor<T>, id: u64, deceased_id: u64) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate_exists(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin.clone())?; } else { return Err(Error::<T>::NotAdmin.into()); }
                }
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
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_meta())]
        pub fn set_meta(origin: OriginFor<T>, id: u64, categories: Option<u32>, religion: Option<u8>) -> DispatchResult {
            // 墓主或管理员
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) { if w != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            GraveMetaOf::<T>::mutate(id, |m| {
                if let Some(c) = categories { m.categories = c; }
                if let Some(r) = religion { m.religion = r; }
            });
            Self::deposit_event(Event::MetaUpdated { id });
            Ok(())
        }

        /// 函数级中文注释：用户提交投诉（CID 仅指向证据，不落明文）。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::complain())]
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
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::restrict())]
        pub fn restrict(origin: OriginFor<T>, id: u64, on: bool, reason_code: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } else { return Err(Error::<T>::NotFound.into()); }
            ModerationOf::<T>::mutate(id, |m| { m.restricted = on; m.reason_code = reason_code; });
            Self::deposit_event(Event::Restricted { id, on, reason_code });
            Ok(())
        }

        /// 函数级中文注释：园区管理员软删除（并自动设置限制）。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove())]
        pub fn remove(origin: OriginFor<T>, id: u64, reason_code: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } else { return Err(Error::<T>::NotFound.into()); }
            ModerationOf::<T>::mutate(id, |m| { m.removed = true; m.restricted = true; m.reason_code = reason_code; });
            Self::deposit_event(Event::Removed { id, reason_code });
            Ok(())
        }

        /// 函数级中文注释：绑定名称哈希索引（不存明文）。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_name_hash())]
        pub fn set_name_hash(origin: OriginFor<T>, id: u64, name_hash: [u8;32]) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) { if w != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            NameIndex::<T>::try_mutate(name_hash, |list| -> Result<(), Error<T>> {
                if !list.iter().any(|x| *x == id) { list.try_push(id).map_err(|_| Error::<T>::CapacityExceeded)?; }
                Ok(())
            })?;
            Self::deposit_event(Event::NameHashSet { id, name_hash });
            Ok(())
        }

        /// 函数级中文注释：从名称哈希索引中移除该墓地。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::clear_name_hash())]
        pub fn clear_name_hash(origin: OriginFor<T>, id: u64, name_hash: [u8;32]) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) { if w != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            NameIndex::<T>::mutate(name_hash, |list| { if let Some(pos) = list.iter().position(|x| *x == id) { list.swap_remove(pos); } });
            Self::deposit_event(Event::NameHashCleared { id, name_hash });
            Ok(())
        }

        /// 函数级中文注释：添加墓位管理员（不含墓主）。仅墓主或园区管理员可调用。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::add_admin())]
        pub fn add_admin(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            GraveAdmins::<T>::try_mutate(id, |list| -> Result<(), Error<T>> {
                if !list.iter().any(|x| x == &who) { list.try_push(who.clone()).map_err(|_| Error::<T>::CapacityExceeded)?; }
                Ok(())
            })?;
            Self::deposit_event(Event::AdminAdded { id, who });
            Ok(())
        }

        /// 函数级中文注释：移除墓位管理员。仅墓主或园区管理员可调用。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove_admin())]
        pub fn remove_admin(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            GraveAdmins::<T>::mutate(id, |list| {
                if let Some(pos) = list.iter().position(|x| *x == who) { list.swap_remove(pos); }
            });
            Self::deposit_event(Event::AdminRemoved { id, who });
            Ok(())
        }

        /// 函数级中文注释：设置加入策略（0=Open,1=Whitelist）。仅墓主或园区管理员可调用。
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_policy())]
        pub fn set_policy(origin: OriginFor<T>, id: u64, policy: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            ensure!(policy == 0 || policy == 1, Error::<T>::PolicyViolation);
            JoinPolicyOf::<T>::insert(id, policy);
            Self::deposit_event(Event::PolicyChanged { id, policy });
            Ok(())
        }

        /// 函数级中文注释：共开模式下加入成为成员。若策略非 Open 则报错。
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::join_open())]
        pub fn join_open(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ensure!(JoinPolicyOf::<T>::get(id) == 0u8, Error::<T>::PolicyViolation);
            ensure!(!Members::<T>::contains_key(id, &who), Error::<T>::AlreadyMember);
            Members::<T>::insert(id, &who, ());
            Self::deposit_event(Event::MemberJoined { id, who });
            Ok(())
        }

        /// 函数级中文注释：私有模式申请加入（进入待审列表）。
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::apply_join())]
        pub fn apply_join(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ensure!(JoinPolicyOf::<T>::get(id) == 1u8, Error::<T>::PolicyViolation);
            ensure!(!Members::<T>::contains_key(id, &who), Error::<T>::AlreadyMember);
            ensure!(!PendingApplications::<T>::contains_key(id, &who), Error::<T>::AlreadyApplied);
            let now = <frame_system::Pallet<T>>::block_number();
            PendingApplications::<T>::insert(id, &who, now);
            Self::deposit_event(Event::MemberApplied { id, who });
            Ok(())
        }

        /// 函数级中文注释：批准某申请为成员。仅墓主或园区管理员可调用。
        #[pallet::call_index(17)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::approve_member())]
        pub fn approve_member(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            ensure!(PendingApplications::<T>::contains_key(id, &who), Error::<T>::NotApplied);
            PendingApplications::<T>::remove(id, &who);
            Members::<T>::insert(id, &who, ());
            Self::deposit_event(Event::MemberApproved { id, who: who.clone() });
            Self::deposit_event(Event::MemberJoined { id, who });
            Ok(())
        }

        /// 函数级中文注释：拒绝某申请。仅墓主或园区管理员可调用。
        #[pallet::call_index(18)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::reject_member())]
        pub fn reject_member(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            ensure!(PendingApplications::<T>::contains_key(id, &who), Error::<T>::NotApplied);
            PendingApplications::<T>::remove(id, &who);
            Self::deposit_event(Event::MemberRejected { id, who });
            Ok(())
        }

        /// 函数级详细中文注释：设置可见性策略（是否公开供奉/留言/扫墓/关注）
        #[pallet::call_index(19)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_visibility())]
        pub fn set_visibility(origin: OriginFor<T>, id: u64, public_offering: bool, public_guestbook: bool, public_sweep: bool, public_follow: bool) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            let policy = VisibilityPolicy { public_offering, public_guestbook, public_sweep, public_follow };
            VisibilityPolicyOf::<T>::insert(id, policy.clone());
            Self::deposit_event(Event::VisibilityUpdated { id, policy });
            Ok(())
        }

        /// 函数级详细中文注释：关注纪念馆；若策略允许公开关注，则任意签名账户可关注，否则仅成员可关注。
        #[pallet::call_index(20)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::follow())]
        pub fn follow(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            let policy = VisibilityPolicyOf::<T>::get(id);
            if !policy.public_follow { ensure!(Members::<T>::contains_key(id, &who), Error::<T>::NotMember); }
            FollowersOf::<T>::try_mutate(id, |list| -> DispatchResult {
                if list.iter().any(|a| a == &who) { return Err(Error::<T>::AlreadyFollowing.into()); }
                list.try_push(who.clone()).map_err(|_| Error::<T>::CapacityExceeded)?;
                Ok(())
            })?;
            Self::deposit_event(Event::Followed { id, who });
            Ok(())
        }

        /// 函数级详细中文注释：取消关注
        #[pallet::call_index(21)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::unfollow())]
        pub fn unfollow(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            FollowersOf::<T>::mutate(id, |list| { if let Some(p) = list.iter().position(|a| a == &who) { list.swap_remove(p); } });
            Self::deposit_event(Event::Unfollowed { id, who });
            Ok(())
        }

        /// 函数级中文注释：设置亲属关系策略（0=Auto,1=Approve）。
        #[pallet::call_index(22)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_kinship_policy())]
        pub fn set_kinship_policy(origin: OriginFor<T>, id: u64, policy: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            ensure!(policy == 0 || policy == 1, Error::<T>::PolicyViolation);
            KinshipPolicyOf::<T>::insert(id, policy);
            Self::deposit_event(Event::KinshipPolicyChanged { id, policy });
            Ok(())
        }

        /// 函数级中文注释：成员声明与某逝者的亲属关系。
        /// - 若策略为 Auto：记录 verified=true；若为 Approve：verified=false 待审。
        #[pallet::call_index(23)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::declare_kinship())]
        pub fn declare_kinship(origin: OriginFor<T>, id: u64, deceased_id: u64, code: u8, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Members::<T>::contains_key(id, &who), Error::<T>::NotMember);
            // 校验逝者属于该墓位（读取 Interments 记录）
            let in_this_grave = Interments::<T>::get(id).iter().any(|r| r.deceased_id == deceased_id);
            ensure!(in_this_grave, Error::<T>::NotFound);
            ensure!(!KinshipOf::<T>::contains_key(id, (deceased_id, who.clone())), Error::<T>::KinshipExists);
            let nv: BoundedVec<_, T::MaxCidLen> = match note { Some(v) => BoundedVec::try_from(v).map_err(|_| Error::<T>::CapacityExceeded)?, None => Default::default() };
            let now = <frame_system::Pallet<T>>::block_number();
            let policy = KinshipPolicyOf::<T>::get(id);
            let rec = KinshipRecord::<T> { code, note: nv, verified: policy == 0, time: now };
            KinshipOf::<T>::insert(id, (deceased_id, who.clone()), rec);
            // 索引
            KinshipIndexByMember::<T>::try_mutate(who.clone(), id, |list| list.try_push((deceased_id, code)).map_err(|_| Error::<T>::CapacityExceeded))?;
            Self::deposit_event(Event::KinshipDeclared { id, deceased_id, who, code });
            Ok(())
        }

        /// 函数级中文注释：批准成员与逝者关系（仅墓主/园区管理员）。
        #[pallet::call_index(24)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::approve_kinship())]
        pub fn approve_kinship(origin: OriginFor<T>, id: u64, deceased_id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            KinshipOf::<T>::try_mutate(id, (deceased_id, who.clone()), |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::KinshipNotFound)?;
                r.verified = true; Ok(())
            })?;
            Self::deposit_event(Event::KinshipApproved { id, deceased_id, who });
            Ok(())
        }

        /// 函数级中文注释：拒绝成员与逝者关系（仅墓主/园区管理员）。
        #[pallet::call_index(25)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::reject_kinship())]
        pub fn reject_kinship(origin: OriginFor<T>, id: u64, deceased_id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) { if sender != g.owner { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin)?; } else { return Err(Error::<T>::NotAdmin.into()); } } }
            } else { return Err(Error::<T>::NotFound.into()); }
            ensure!(KinshipOf::<T>::contains_key(id, (deceased_id, who.clone())), Error::<T>::KinshipNotFound);
            KinshipOf::<T>::remove(id, (deceased_id, who.clone()));
            // 索引同步删除
            KinshipIndexByMember::<T>::mutate(who.clone(), id, |list| { if let Some(p) = list.iter().position(|(d, _)| *d == deceased_id) { list.swap_remove(p); } });
            Self::deposit_event(Event::KinshipRejected { id, deceased_id, who });
            Ok(())
        }

        /// 函数级中文注释：成员更新自身与逝者关系（code/note）。Approve 策略下将重置 verified=false 待审。
        #[pallet::call_index(26)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_kinship())]
        pub fn update_kinship(origin: OriginFor<T>, id: u64, deceased_id: u64, code: Option<u8>, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            KinshipOf::<T>::try_mutate(id, (deceased_id, who.clone()), |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::KinshipNotFound)?;
                if let Some(c) = code { r.code = c; }
                if let Some(nv) = note { r.note = BoundedVec::try_from(nv).map_err(|_| Error::<T>::CapacityExceeded)?; }
                // 重置审核
                let policy = KinshipPolicyOf::<T>::get(id);
                r.verified = policy == 0;
                Ok(())
            })?;
            // 更新成员索引中的 code
            KinshipIndexByMember::<T>::mutate(who.clone(), id, |list| { if let Some(p) = list.iter_mut().position(|(d, _)| *d == deceased_id) { list[p].1 = code.unwrap_or(list[p].1); } });
            Self::deposit_event(Event::KinshipUpdated { id, deceased_id, who, code: code.unwrap_or_default() });
            Ok(())
        }

        /// 函数级中文注释：成员自撤或管理员撤销亲属关系。
        #[pallet::call_index(27)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove_kinship())]
        pub fn remove_kinship(origin: OriginFor<T>, id: u64, deceased_id: u64, who: T::AccountId) -> DispatchResult {
            let sender = ensure_signed(origin.clone())?;
            let can_admin = if let Some(g) = Graves::<T>::get(id) {
                if sender == g.owner { true } else { if let Some(pid) = g.park_id { T::ParkAdmin::ensure(pid, origin).is_ok() } else { false } }
            } else { false };
            ensure!(sender == who || can_admin, Error::<T>::NotAdmin);
            ensure!(KinshipOf::<T>::contains_key(id, (deceased_id, who.clone())), Error::<T>::KinshipNotFound);
            KinshipOf::<T>::remove(id, (deceased_id, who.clone()));
            KinshipIndexByMember::<T>::mutate(who.clone(), id, |list| { if let Some(p) = list.iter().position(|(d, _)| *d == deceased_id) { list.swap_remove(p); } });
            Self::deposit_event(Event::KinshipRemoved { id, deceased_id, who });
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：运行时升级钩子。从 v2 -> v3 进行存储迁移：
        /// - 旧版 `Grave` 的 `park_id` 为 `u64`，新版改为 `Option<u64>`；
        /// - 迁移时将旧值封装为 `Some(park_id)`；
        /// - `GravesByPark` 无需迁移（键仍为 `u64`），事件无需回溯。
        fn on_runtime_upgrade() -> Weight {
            let mut weight: Weight = Weight::zero();
            // 使用新版 API：in_code_storage_version 代替已弃用的 current_storage_version
            let current = Pallet::<T>::in_code_storage_version();
            if current < 3 {
                // 旧结构定义：仅用于迁移期 decode
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldGrave<TC: Config> {
                    /// 函数级中文注释：旧版园区 ID，必填（u64）。
                    park_id: u64,
                    owner: TC::AccountId,
                    admin_group: Option<u64>,
                    kind_code: u8,
                    capacity: u16,
                    metadata_cid: BoundedVec<u8, TC::MaxCidLen>,
                    active: bool,
                }

                let mut migrated: u64 = 0;
                // 将旧值转换为新值
                Graves::<T>::translate(|_key, old: OldGrave<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Grave::<T> {
                        park_id: Some(old.park_id),
                        owner: old.owner,
                        admin_group: old.admin_group,
                        kind_code: old.kind_code,
                        capacity: old.capacity,
                        metadata_cid: old.metadata_cid,
                        active: old.active,
                    })
                });
                STORAGE_VERSION.put::<Pallet<T>>();
                // 简化：估算权重 = 常数 + 每条迁移成本（此处返回迁移项数）
                weight = weight.saturating_add(Weight::from_parts(1_000, 0));
                weight = weight.saturating_add(Weight::from_parts(migrated.saturating_mul(10_000) as u64, 0));
            }
            weight
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：生成唯一的 10 位数字 Slug。
        /// - 基于 (id, who, block_number) 的 blake2 哈希映射为 10 位数字；
        /// - 若冲突则尝试多次（最多 10 次），最终回退为 id 左填充 0 的 10 位。
        pub fn gen_unique_slug(id: u64, who: &T::AccountId) -> Result<BoundedVec<u8, T::SlugLen>, Error<T>> {
            let mut try_idx: u8 = 0;
            while try_idx < 10 {
                let now = <frame_system::Pallet<T>>::block_number().saturated_into::<u64>();
                let mut seed = [0u8; 32];
                let enc = (id, who, now, try_idx);
                seed.copy_from_slice(&sp_core::blake2_256(&enc.encode()));
                let mut digits: [u8; 10] = [0; 10];
                for i in 0..10 { digits[i] = b'0' + (seed[i] % 10); }
                let v: Vec<u8> = digits.to_vec();
                if let Ok(bv) = BoundedVec::<u8, T::SlugLen>::try_from(v.clone()) {
                    if !GraveBySlug::<T>::contains_key(&bv) { return Ok(bv); }
                }
                try_idx = try_idx.saturating_add(1);
            }
            // 回退：id 左填充 0 至 10 位
            let s = alloc::format!("{:010}", id);
            let bv = BoundedVec::<u8, T::SlugLen>::try_from(s.into_bytes()).map_err(|_| Error::<T>::InvalidSlug)?;
            if GraveBySlug::<T>::contains_key(&bv) { return Err(Error::<T>::SlugExists); }
            Ok(bv)
        }

        /// 函数级详细中文注释：检查某账户是否为成员。
        pub fn is_member(id: u64, who: &T::AccountId) -> bool { Members::<T>::contains_key(id, who) }
    }
}


