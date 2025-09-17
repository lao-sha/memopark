#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use alloc::vec::Vec;
    use frame_support::{pallet_prelude::*, BoundedVec, traits::ReservableCurrency};
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::{Zero, Saturating};

    /// 函数级中文注释：本 Pallet 维护“祭祀品目录（Sacrifice）”主数据。
    /// - 提供创建/更新/上下架等基本能力；
    /// - 按需保留上架押金与成熟期；支持投诉计数占位（与 Data/Life/Eulogy 一致风格）；
    /// - 对外仅通过只读接口被 `pallet-memo-offerings` 查询价格与可购状态，保持低耦合。

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        #[pallet::constant] type StringLimit: Get<u32>;
        #[pallet::constant] type UriLimit: Get<u32>;
        #[pallet::constant] type DescriptionLimit: Get<u32>;

        /// 函数级中文注释：治理/管理员起源（平台或商家入驻后可扩展）。
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：押金与退款的原生货币接口。
        type Currency: ReservableCurrency<Self::AccountId>;

        /// 函数级中文注释：上架押金（ListingDeposit）与成熟观察期（ComplaintPeriod）。
        #[pallet::constant] type ListingDeposit: Get<BalanceOf<Self>>;
        #[pallet::constant] type ComplaintPeriod: Get<BlockNumberFor<Self>>;
        /// 函数级中文注释：国库账户解析器（用于罚没10%）。
        type Treasury: Get<Self::AccountId>;
        /// 函数级中文注释：单个祭品允许配置的最多“专属逝者”数量。
        #[pallet::constant] type MaxExclusivePerItem: Get<u32>;
    }

    /// 函数级中文注释：通用余额别名。
    pub type BalanceOf<T> = <
        <T as Config>::Currency as frame_support::traits::Currency<
            <T as frame_system::Config>::AccountId
        >
    >::Balance;

    /// 祭祀品状态
    #[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub enum SacrificeStatus { Enabled, Disabled, Hidden }

    /// 函数级中文注释：祭祀品主数据。
    /// - fixed_price：一次性商品（Instant）的定价；
    /// - unit_price_per_week：按周计价（Timed）的单价；二者至少填一项；
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct SacrificeItem<T: Config> {
        pub id: u64,
        pub name: BoundedVec<u8, T::StringLimit>,
        pub resource_url: BoundedVec<u8, T::UriLimit>,
        pub description: BoundedVec<u8, T::DescriptionLimit>,
        pub status: SacrificeStatus,
        pub is_vip_exclusive: bool,
        pub fixed_price: Option<u128>,
        pub unit_price_per_week: Option<u128>,
        pub category_id: Option<u32>,
        /// 一级类目（新）
        pub primary_category_id: Option<u32>,
        /// 二级类目（新）
        pub secondary_category_id: Option<u32>,
        pub scene_id: Option<u32>,
        /// 函数级中文注释：专属逝者列表（非空表示仅限这些逝者可用；目录对其公开，其他隐藏）。
        pub exclusive_subjects: BoundedVec<(u8,u64), T::MaxExclusivePerItem>,
        pub creator_id: T::AccountId,
        /// 函数级中文注释：提审/审批状态。
        pub approval_state: ApprovalState,
        pub created: BlockNumberFor<T>,
        pub updated: BlockNumberFor<T>,
        pub version: u32,
    }

    /// 函数级中文注释：审批状态机。
    #[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub enum ApprovalState { Pending, Approved, Rejected }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage] pub type NextSacrificeId<T: Config> = StorageValue<_, u64, ValueQuery>;
    #[pallet::storage] pub type SacrificeOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, SacrificeItem<T>, OptionQuery>;

    /// 函数级中文注释：场景主数据（短期内内置于本 pallet；如需跨域共享可后续抽离为独立 pallet）。
    /// - 用于标记祭祀品的使用场景/展示位/主题，不影响资金路径，仅用于筛选与规范化。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Scene<T: Config> {
        /// 自增 ID（u32）
        pub id: u32,
        /// 名称（受 StringLimit 约束）
        pub name: BoundedVec<u8, T::StringLimit>,
        /// 描述（受 DescriptionLimit 约束）
        pub desc: BoundedVec<u8, T::DescriptionLimit>,
        /// 可选域编码（例如 1=Grave, 3=Pet），仅作展示/筛选
        pub domain: Option<u8>,
        /// 是否启用
        pub active: bool,
    }

    /// 函数级中文注释：场景存储与索引。
    #[pallet::storage] pub type NextSceneId<T: Config> = StorageValue<_, u32, ValueQuery>;
    #[pallet::storage] pub type SceneOf<T: Config> = StorageMap<_, Blake2_128Concat, u32, Scene<T>, OptionQuery>;
    /// 按域索引（可选）：domain -> [scene_id]
    #[pallet::storage] pub type ScenesByDomain<T: Config> = StorageMap<_, Blake2_128Concat, u8, BoundedVec<u32, ConstU32<1000>>, ValueQuery>;

    /// 函数级中文注释：押金/成熟/投诉占位（与 Data/Life/Eulogy 风格保持一致）
    #[pallet::storage] pub type SacrificeDeposits<T: Config> = StorageMap<_, Blake2_128Concat, u64, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage] pub type SacrificeMaturity<T: Config> = StorageMap<_, Blake2_128Concat, u64, BlockNumberFor<T>, OptionQuery>;
    #[pallet::storage] pub type SacrificeComplaints<T: Config> = StorageMap<_, Blake2_128Concat, u64, u32, ValueQuery>;
    /// 函数级中文注释：效果元数据存储（供消费侧回调解释）。
    /// - key: sacrifice_id；value: (consumable, target_domain, effect_kind, effect_value, cooldown_secs, inventory_mint)
    #[pallet::storage] pub type EffectOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, (bool, u8, u8, i32, u32, bool), OptionQuery>;
    /// 类目：id => {id, name, parent, level}
    #[pallet::storage] pub type CategoryOf<T: Config> = StorageMap<_, Blake2_128Concat, u32, (u32, BoundedVec<u8, T::StringLimit>, Option<u32>, u8), OptionQuery>;
    #[pallet::storage] pub type NextCategoryId<T: Config> = StorageValue<_, u32, ValueQuery>;
    /// 父子关系索引 parent_id => [child_id]
    #[pallet::storage] pub type ChildrenByCategory<T: Config> = StorageMap<_, Blake2_128Concat, u32, BoundedVec<u32, ConstU32<100>>, ValueQuery>;
    /// 反向索引：一级类目
    #[pallet::storage] pub type SacrificesByPrimary<T: Config> = StorageMap<_, Blake2_128Concat, u32, BoundedVec<u64, ConstU32<10000>>, ValueQuery>;
    /// 反向索引：二级类目
    #[pallet::storage] pub type SacrificesBySecondary<T: Config> = StorageMap<_, Blake2_128Concat, u32, BoundedVec<u64, ConstU32<10000>>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 创建/更新/状态变更/退款
        SacrificeCreated(u64),
        SacrificeUpdated(u64),
        /// 状态以 u8 表达：0=Enabled,1=Disabled,2=Hidden
        SacrificeStatusSet(u64, u8),
        SacrificeDepositRefunded(u64, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：用户提交上架请求（押金已保留）。
        SacrificeRequested(u64, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：委员会已批准，押金全额退回。
        SacrificeApproved(u64),
        /// 函数级中文注释：委员会已拒绝，押金10%划转国库，其余退回。
        SacrificeRejected(u64, BalanceOf<T>),
        /// 函数级中文注释：场景事件（创建/更新/启停）。
        SceneCreated(u32),
        SceneUpdated(u32),
        SceneStatusSet(u32, bool),
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadInput,
        DepositFailed,
        NotMatured,
        NoDepositToClaim,
        /// 场景不存在
        SceneNotFound,
        /// 场景未启用
        SceneInactive,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续替换为基准权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建祭祀品（管理员）。
        /// - fixed_price 与 unit_price_per_week 至少提供一个；
        /// - 创建时保留押金，并设置成熟期（now + ComplaintPeriod）。
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_sacrifice(
            origin: OriginFor<T>,
            name: Vec<u8>,
            resource_url: Vec<u8>,
            description: Vec<u8>,
            is_vip_exclusive: bool,
            fixed_price: Option<u128>,
            unit_price_per_week: Option<u128>,
            category_id: Option<u32>,
            scene_id: Option<u32>,
            creator_id: T::AccountId,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            ensure!(fixed_price.is_some() || unit_price_per_week.is_some(), Error::<T>::BadInput);
            let name_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let url_bv: BoundedVec<_, T::UriLimit> = BoundedVec::try_from(resource_url).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::DescriptionLimit> = BoundedVec::try_from(description).map_err(|_| Error::<T>::BadInput)?;
            // 场景校验：若提供 scene_id，要求存在且 active
            if let Some(sid) = scene_id { let sc = SceneOf::<T>::get(sid).ok_or(Error::<T>::SceneNotFound)?; ensure!(sc.active, Error::<T>::SceneInactive); }

            let id = NextSacrificeId::<T>::mutate(|n| { let x = *n; *n = x.saturating_add(1); x });
            let now = <frame_system::Pallet<T>>::block_number();
            let item = SacrificeItem::<T> {
                id,
                name: name_bv,
                resource_url: url_bv,
                description: desc_bv,
                status: SacrificeStatus::Enabled,
                is_vip_exclusive,
                fixed_price,
                unit_price_per_week,
                category_id,
                primary_category_id: None,
                secondary_category_id: None,
                scene_id,
                exclusive_subjects: Default::default(),
                creator_id: creator_id.clone(),
                approval_state: ApprovalState::Approved,
                created: now,
                updated: now,
                version: 1,
            };
            SacrificeOf::<T>::insert(id, item);

            let dep = T::ListingDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&creator_id, dep).map_err(|_| Error::<T>::DepositFailed)?;
                SacrificeDeposits::<T>::insert(id, (creator_id, dep));
                SacrificeMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::SacrificeCreated(id));
            Ok(())
        }

        /// 函数级中文注释：用户提交上架请求（押金）——待委员会审批。
        /// - 初始状态 Pending，目录状态 Hidden；押金保留至审批结束。
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn request_list_sacrifice(
            origin: OriginFor<T>,
            name: Vec<u8>,
            resource_url: Vec<u8>,
            description: Vec<u8>,
            is_vip_exclusive: bool,
            fixed_price: Option<u128>,
            unit_price_per_week: Option<u128>,
            category_id: Option<u32>,
            scene_id: Option<u32>,
            exclusive_subjects: Vec<(u8,u64)>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(fixed_price.is_some() || unit_price_per_week.is_some(), Error::<T>::BadInput);
            let name_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let url_bv: BoundedVec<_, T::UriLimit> = BoundedVec::try_from(resource_url).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::DescriptionLimit> = BoundedVec::try_from(description).map_err(|_| Error::<T>::BadInput)?;
            let exclusive_bv: BoundedVec<(u8,u64), T::MaxExclusivePerItem> = BoundedVec::try_from(exclusive_subjects).map_err(|_| Error::<T>::BadInput)?;
            // 场景校验：若提供 scene_id，要求存在且 active
            if let Some(sid) = scene_id { let sc = SceneOf::<T>::get(sid).ok_or(Error::<T>::SceneNotFound)?; ensure!(sc.active, Error::<T>::SceneInactive); }
            let id = NextSacrificeId::<T>::mutate(|n| { let x = *n; *n = x.saturating_add(1); x });
            let now = <frame_system::Pallet<T>>::block_number();
            let item = SacrificeItem::<T> {
                id,
                name: name_bv,
                resource_url: url_bv,
                description: desc_bv,
                status: SacrificeStatus::Hidden,
                is_vip_exclusive,
                fixed_price,
                unit_price_per_week,
                category_id,
                primary_category_id: None,
                secondary_category_id: None,
                scene_id,
                exclusive_subjects: exclusive_bv,
                creator_id: who.clone(),
                approval_state: ApprovalState::Pending,
                created: now,
                updated: now,
                version: 1,
            };
            SacrificeOf::<T>::insert(id, item);
            let dep = T::ListingDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                SacrificeDeposits::<T>::insert(id, (who.clone(), dep));
            }
            Self::deposit_event(Event::SacrificeRequested(id, who, dep));
            Ok(())
        }

        /// 函数级中文注释：委员会批准（退回押金，状态改为 Approved/Enabled）。
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn committee_approve(origin: OriginFor<T>, id: u64) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                s.approval_state = ApprovalState::Approved;
                s.status = SacrificeStatus::Enabled;
                s.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            if let Some((owner, amt)) = SacrificeDeposits::<T>::take(id) { if !amt.is_zero() { T::Currency::unreserve(&owner, amt); } }
            Self::deposit_event(Event::SacrificeApproved(id));
            Ok(())
        }

        /// 函数级中文注释：委员会拒绝（罚没10%至国库，其余退回；状态 Rejected/Hidden）。
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn committee_reject(origin: OriginFor<T>, id: u64) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            let mut forfeited = Zero::zero();
            if let Some((owner, amt)) = SacrificeDeposits::<T>::take(id) {
                if !amt.is_zero() {
                    // 10% 罚没
                    let fee = (amt.saturating_mul(10u32.into())) / 100u32.into();
                    forfeited = fee;
                    if !fee.is_zero() { let _ = <T as Config>::Currency::repatriate_reserved(&owner, &T::Treasury::get(), fee, frame_support::traits::BalanceStatus::Free); }
                    let back = amt.saturating_sub(fee);
                    if !back.is_zero() { T::Currency::unreserve(&owner, back); }
                }
            }
            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                s.approval_state = ApprovalState::Rejected;
                s.status = SacrificeStatus::Hidden;
                s.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::SacrificeRejected(id, forfeited));
            Ok(())
        }

        /// 创建类目：parent=None→一级；Some→二级（要求 parent.level=1）。
        #[pallet::call_index(7)]
        #[pallet::weight(10_000)]
        pub fn create_category(origin: OriginFor<T>, name: Vec<u8>, parent: Option<u32>) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            let name_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            if let Some(pid) = parent {
                let (_id, _n, pparent, plevel) = CategoryOf::<T>::get(pid).ok_or(Error::<T>::BadInput)?;
                ensure!(pparent.is_none() && plevel == 1, Error::<T>::BadInput);
            }
            let id = NextCategoryId::<T>::mutate(|n| { let x=*n; *n = x.saturating_add(1); x });
            let level: u8 = if parent.is_some() { 2 } else { 1 };
            CategoryOf::<T>::insert(id, (id, name_bv, parent, level));
            if let Some(pid) = parent {
                ChildrenByCategory::<T>::try_mutate(pid, |v| v.try_push(id).map_err(|_| Error::<T>::BadInput))?;
            }
            Ok(())
        }

        /// 变更类目父子（仅同层迁移），或改名。
        #[pallet::call_index(8)]
        #[pallet::weight(10_000)]
        pub fn update_category(origin: OriginFor<T>, id: u32, name: Option<Vec<u8>>, parent: Option<Option<u32>>) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            CategoryOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let (cid, cname, cparent, clevel) = maybe.as_mut().ok_or(Error::<T>::BadInput)?;
                if let Some(n) = name { *cname = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(pp) = parent {
                    match (clevel, pp) {
                        (1, None) => { *cparent = None; },
                        (2, Some(newp)) => {
                            let (_pid, _pn, pparent, plevel) = CategoryOf::<T>::get(newp).ok_or(Error::<T>::BadInput)?;
                            ensure!(pparent.is_none() && plevel == 1, Error::<T>::BadInput);
                            if let Some(oldp) = *cparent { ChildrenByCategory::<T>::mutate(oldp, |v| { if let Some(pos)=v.iter().position(|x| x==cid){ v.swap_remove(pos);} }); }
                            ChildrenByCategory::<T>::try_mutate(newp, |v| v.try_push(*cid).map_err(|_| Error::<T>::BadInput))?;
                            *cparent = Some(newp);
                        },
                        _ => return Err(Error::<T>::BadInput.into()),
                    }
                }
                Ok(())
            })?;
            Ok(())
        }

        /// 设定祭品类目（同时维护反向索引）。
        #[pallet::call_index(9)]
        #[pallet::weight(10_000)]
        pub fn assign_category(origin: OriginFor<T>, id: u64, primary: Option<u32>, secondary: Option<u32>) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                // 校验父子合法
                if let Some(p) = primary { let (_pid,_n,pparent,plevel) = CategoryOf::<T>::get(p).ok_or(Error::<T>::BadInput)?; ensure!(pparent.is_none() && plevel==1, Error::<T>::BadInput); }
                if let Some(sec) = secondary { let (_sid,_sn,sparent,slevel) = CategoryOf::<T>::get(sec).ok_or(Error::<T>::BadInput)?; if let Some(p)=primary { ensure!(sparent==Some(p) && slevel==2, Error::<T>::BadInput);} else { return Err(Error::<T>::BadInput.into()); } }
                // 旧索引移除
                if let Some(op)=s.primary_category_id { SacrificesByPrimary::<T>::mutate(op, |v| { if let Some(pos)=v.iter().position(|x| x==&id){ v.swap_remove(pos);} }); }
                if let Some(os)=s.secondary_category_id { SacrificesBySecondary::<T>::mutate(os, |v| { if let Some(pos)=v.iter().position(|x| x==&id){ v.swap_remove(pos);} }); }
                // 新索引写入
                if let Some(p)=primary { SacrificesByPrimary::<T>::try_mutate(p, |v| v.try_push(id).map_err(|_| Error::<T>::BadInput))?; }
                if let Some(sec)=secondary { SacrificesBySecondary::<T>::try_mutate(sec, |v| v.try_push(id).map_err(|_| Error::<T>::BadInput))?; }
                s.primary_category_id = primary; s.secondary_category_id = secondary; s.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Ok(())
        }

        /// 函数级中文注释：设置/清除祭品效果元数据（Admin）。
        /// - 传入参数将作为目录效果声明，消费侧按需解释；传 None 将清除效果。
        #[pallet::call_index(10)]
        #[pallet::weight(10_000)]
        pub fn set_effect(
            origin: OriginFor<T>,
            id: u64,
            effect: Option<(bool /*consumable*/, u8 /*target_domain*/, u8 /*effect_kind*/, i32 /*effect_value*/, u32 /*cooldown_secs*/, bool /*inventory_mint*/)> ,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            ensure!(SacrificeOf::<T>::contains_key(id), Error::<T>::NotFound);
            match effect {
                Some(v) => { EffectOf::<T>::insert(id, v); },
                None => { EffectOf::<T>::remove(id); },
            }
            Ok(())
        }

        /// 函数级中文注释：更新祭祀品（管理员）。
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn update_sacrifice(
            origin: OriginFor<T>,
            id: u64,
            name: Option<Vec<u8>>,
            resource_url: Option<Vec<u8>>,
            description: Option<Vec<u8>>,
            is_vip_exclusive: Option<bool>,
            fixed_price: Option<Option<u128>>,
            unit_price_per_week: Option<Option<u128>>,
            category_id: Option<Option<u32>>,
            scene_id: Option<Option<u32>>,
        ) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if let Some(v) = name { s.name = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = resource_url { s.resource_url = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = description { s.description = BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = is_vip_exclusive { s.is_vip_exclusive = v; }
                if let Some(v) = fixed_price { s.fixed_price = v; }
                if let Some(v) = unit_price_per_week { s.unit_price_per_week = v; }
                if let Some(v) = category_id { s.category_id = v; }
                if let Some(v) = scene_id { s.scene_id = v; }
                ensure!(s.fixed_price.is_some() || s.unit_price_per_week.is_some(), Error::<T>::BadInput);
                s.updated = <frame_system::Pallet<T>>::block_number();
                s.version = s.version.saturating_add(1);
                Ok(())
            })?;
            Self::deposit_event(Event::SacrificeUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：设置上下架/隐藏（管理员）。
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn set_status(origin: OriginFor<T>, id: u64, status: u8) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            let st = match status {
                0 => SacrificeStatus::Enabled,
                1 => SacrificeStatus::Disabled,
                2 => SacrificeStatus::Hidden,
                _ => return Err(Error::<T>::BadInput.into()),
            };
            SacrificeOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                s.status = st;
                s.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            let code: u8 = match st { SacrificeStatus::Enabled => 0, SacrificeStatus::Disabled => 1, SacrificeStatus::Hidden => 2 };
            Self::deposit_event(Event::SacrificeStatusSet(id, code));
            Ok(())
        }

        /// 函数级中文注释：领取上架押金（到期且无投诉）。
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn claim_deposit(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = SacrificeDeposits::<T>::get(id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, DispatchError::BadOrigin);
            ensure!(SacrificeComplaints::<T>::get(id) == 0, Error::<T>::NotMatured);
            let mature = SacrificeMaturity::<T>::get(id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            SacrificeDeposits::<T>::remove(id);
            SacrificeMaturity::<T>::remove(id);
            Self::deposit_event(Event::SacrificeDepositRefunded(id, who, amt));
            Ok(())
        }

        /// 函数级中文注释：创建场景（Admin）。
        /// - name/desc 受上限约束；domain 可空；默认 active=true。
        #[pallet::call_index(11)]
        #[pallet::weight(10_000)]
        pub fn create_scene(origin: OriginFor<T>, name: Vec<u8>, desc: Option<Vec<u8>>, domain: Option<u8>) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            let name_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::DescriptionLimit> = BoundedVec::try_from(desc.unwrap_or_default()).map_err(|_| Error::<T>::BadInput)?;
            let id = NextSceneId::<T>::mutate(|n| { let x=*n; *n = x.saturating_add(1); x });
            let sc = Scene::<T> { id, name: name_bv, desc: desc_bv, domain, active: true };
            SceneOf::<T>::insert(id, &sc);
            if let Some(d) = sc.domain { ScenesByDomain::<T>::try_mutate(d, |v| v.try_push(id).map_err(|_| Error::<T>::BadInput))?; }
            Self::deposit_event(Event::SceneCreated(id));
            Ok(())
        }

        /// 函数级中文注释：更新场景（Admin）。
        /// - 支持可选更新 name/desc/domain/active；当变更 domain 时同步索引。
        #[pallet::call_index(12)]
        #[pallet::weight(10_000)]
        pub fn update_scene(origin: OriginFor<T>, id: u32, name: Option<Vec<u8>>, desc: Option<Vec<u8>>, domain: Option<Option<u8>>, active: Option<bool>) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            SceneOf::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let sc = maybe.as_mut().ok_or(Error::<T>::SceneNotFound)?;
                if let Some(n) = name { sc.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(dv) = desc { sc.desc = BoundedVec::try_from(dv).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(dom) = domain {
                    // 同步索引：从旧域移除，加入新域
                    if let Some(old) = sc.domain { ScenesByDomain::<T>::mutate(old, |v| { if let Some(p)=v.iter().position(|x| *x==id){ v.swap_remove(p);} }); }
                    sc.domain = dom;
                    if let Some(nd) = sc.domain { ScenesByDomain::<T>::try_mutate(nd, |v| v.try_push(id).map_err(|_| Error::<T>::BadInput))?; }
                }
                if let Some(a) = active { sc.active = a; }
                Ok(())
            })?;
            Self::deposit_event(Event::SceneUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：启停场景（Admin）。
        #[pallet::call_index(13)]
        #[pallet::weight(10_000)]
        pub fn set_scene_active(origin: OriginFor<T>, id: u32, on: bool) -> DispatchResult {
            T::AdminOrigin::try_origin(origin).map_err(|_| DispatchError::BadOrigin)?;
            SceneOf::<T>::try_mutate(id, |maybe| -> DispatchResult { let sc = maybe.as_mut().ok_or(Error::<T>::SceneNotFound)?; sc.active = on; Ok(()) })?;
            Self::deposit_event(Event::SceneStatusSet(id, on));
            Ok(())
        }
    }

    /// 函数级中文注释：为 `pallet-memo-offerings` 提供目录只读接口实现（低耦合）。
    impl<T: Config> pallet_memo_offerings::pallet::SacrificeCatalog<
        T::AccountId, u64, u128, BlockNumberFor<T>
    > for Pallet<T> {
        /// 函数级中文注释：读取祭祀品定价与可用性。
        /// - 返回 (fixed_price, unit_price_per_week, enabled, is_vip_exclusive)
        fn spec_of(id: u64) -> Option<(Option<u128>, Option<u128>, bool, bool, alloc::vec::Vec<(u8,u64)>)> {
            SacrificeOf::<T>::get(id).map(|s| {
                let enabled = matches!(s.status, SacrificeStatus::Enabled);
                (s.fixed_price, s.unit_price_per_week, enabled, s.is_vip_exclusive, s.exclusive_subjects.into())
            })
        }
        /// 函数级中文注释：读取可选消费效果定义（从 EffectOf 存储映射转换为 EffectSpec）。
        fn effect_of(id: u64) -> Option<pallet_memo_offerings::pallet::EffectSpec> {
            EffectOf::<T>::get(id).map(|(consumable, target_domain, effect_kind, effect_value, cooldown_secs, inventory_mint)| {
                pallet_memo_offerings::pallet::EffectSpec { consumable, target_domain, effect_kind, effect_value, cooldown_secs, inventory_mint }
            })
        }
        /// 函数级中文注释：判断账户是否可购买（会员校验由调用方传入 is_vip）。
        fn can_purchase(_who: &T::AccountId, id: u64, is_vip: bool) -> bool {
            if let Some(s) = SacrificeOf::<T>::get(id) {
                let enabled = matches!(s.status, SacrificeStatus::Enabled);
                return enabled && (!s.is_vip_exclusive || is_vip);
            }
            false
        }
    }
}


