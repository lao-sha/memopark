#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::AtLeast32BitUnsigned;
use frame_support::weights::Weight;
// use sp_runtime::Saturating;

/// 函数级中文注释：墓位接口抽象，保持与 `pallet-grave` 低耦合。
/// - `grave_exists`：校验墓位是否存在，避免挂接到无效墓位。
/// - `can_attach`：校验操作者是否有权在该墓位下管理逝者（通常是墓主或被授权者）。
pub trait GraveInspector<AccountId, GraveId> {
    fn grave_exists(grave_id: GraveId) -> bool;
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
}

/// 函数级中文注释：权重信息占位接口，后续可通过 benchmarking 生成并替换。
pub trait WeightInfo {
    fn create() -> Weight;
    fn update() -> Weight;
    fn remove() -> Weight;
    fn transfer() -> Weight;
}

impl WeightInfo for () {
    /// 函数级中文注释：Weight 新结构不再支持从整数直接转换，使用 from_parts(ref_time, proof_size)。
    fn create() -> Weight { Weight::from_parts(10_000, 0) }
    fn update() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove() -> Weight { Weight::from_parts(10_000, 0) }
    fn transfer() -> Weight { Weight::from_parts(10_000, 0) }
}

/// 函数级中文注释：逝者实体，链上仅存最小必要信息与链下指针。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Deceased<T: Config> {
    /// 所属墓位 ID
    pub grave_id: T::GraveId,
    /// 记录拥有者（通常等于墓位所有者或其授权人）
    pub owner: T::AccountId,
    /// 姓名（限长，避免敏感信息超量上链）
    pub name: BoundedVec<u8, T::StringLimit>,
    /// 简介/悼词（限长，敏感详情放链下）
    pub bio: BoundedVec<u8, T::StringLimit>,
    /// 出生与离世时间戳（可选）
    pub birth_ts: Option<u64>,
    pub death_ts: Option<u64>,
    /// 外部资源链接（IPFS/HTTPS），每条与数量均受限
    pub links: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks>,
    /// 创建与更新区块号
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::StorageVersion;
    use sp_runtime::traits::SaturatedConversion;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 逝者 ID 类型
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 墓位 ID 类型（由外部 pallet 定义）
        type GraveId: Parameter + Member + Copy + MaxEncodedLen;

        /// 每墓位最大逝者数量
        #[pallet::constant]
        type MaxDeceasedPerGrave: Get<u32>;

        /// 单字段字符串长度上限
        #[pallet::constant]
        type StringLimit: Get<u32>;

        /// 最大外部链接条数
        #[pallet::constant]
        type MaxLinks: Get<u32>;

        /// 墓位校验与权限提供者（低耦合关键）
        type GraveProvider: GraveInspector<Self::AccountId, Self::GraveId>;

        /// 权重信息
        type WeightInfo: WeightInfo;
    }

    #[pallet::storage]
    #[pallet::getter(fn next_deceased_id)]
    /// 下一可用的逝者 ID
    pub type NextDeceasedId<T: Config> = StorageValue<_, T::DeceasedId, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn deceased_of)]
    /// 逝者详情：DeceasedId -> Deceased
    pub type DeceasedOf<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, Deceased<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn deceased_by_grave)]
    /// 墓位下的逝者列表：GraveId -> BoundedVec<DeceasedId>
    pub type DeceasedByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, BoundedVec<T::DeceasedId, T::MaxDeceasedPerGrave>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新建逝者 (id, grave_id, owner)
        DeceasedCreated(T::DeceasedId, T::GraveId, T::AccountId),
        /// 更新逝者 (id)
        DeceasedUpdated(T::DeceasedId),
        /// 删除逝者 (id)
        DeceasedRemoved(T::DeceasedId),
        /// 迁移逝者到新墓位 (id, from_grave, to_grave)
        DeceasedTransferred(T::DeceasedId, T::GraveId, T::GraveId),
        /// 逝者关系：已提交绑定请求(from -> to)
        RelationProposed(T::DeceasedId, T::DeceasedId, u8),
        /// 逝者关系：已批准绑定
        RelationApproved(T::DeceasedId, T::DeceasedId, u8),
        /// 逝者关系：已拒绝
        RelationRejected(T::DeceasedId, T::DeceasedId),
        /// 逝者关系：已撤销
        RelationRevoked(T::DeceasedId, T::DeceasedId),
        /// 逝者关系：备注更新
        RelationUpdated(T::DeceasedId, T::DeceasedId),
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 墓位不存在
        GraveNotFound,
        /// 无权限操作
        NotAuthorized,
        /// 该墓位下逝者数量已达上限
        TooManyDeceasedInGrave,
        /// 逝者不存在
        DeceasedNotFound,
        /// ID 溢出
        Overflow,
        /// 输入不合法（长度/数量越界等）
        BadInput,
        /// 关系已存在
        RelationExists,
        /// 关系不存在
        RelationNotFound,
        /// 非法关系类型
        BadRelationKind,
        /// 对方管理员未批准
        PendingApproval,
    }

    // 存储版本常量（用于 FRAME v2 storage_version 宏传参）
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：逝者关系记录。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Relation<T: Config> {
        pub kind: u8,
        pub note: BoundedVec<u8, T::StringLimit>,
        pub created_by: T::AccountId,
        pub since: BlockNumberFor<T>,
    }

    #[pallet::storage]
    pub type Relations<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::DeceasedId, Blake2_128Concat, T::DeceasedId, Relation<T>, OptionQuery>;

    #[pallet::storage]
    pub type RelationsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<(T::DeceasedId, u8), ConstU32<128>>, ValueQuery>;

    #[pallet::storage]
    pub type PendingRelationRequests<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::DeceasedId, Blake2_128Concat, T::DeceasedId, (u8, T::AccountId, BoundedVec<u8, T::StringLimit>, BlockNumberFor<T>), OptionQuery>;

    /// 函数级详细中文注释：关系工具函数与规范
    /// - 0=ParentOf(有向) 1=SpouseOf(无向) 2=SiblingOf(无向) 3=ChildOf(有向)
    fn is_undirected_kind(kind: u8) -> bool { matches!(kind, 1 | 2) }

    /// 函数级详细中文注释：关系冲突矩阵（最小实现）
    /// - 父母/子女 与 配偶/兄弟姐妹 互斥；父母 与 子女 互斥（方向相反视为同类）
    fn is_conflicting_kind(a: u8, b: u8) -> bool {
        let dir_a = matches!(a, 0 | 3);
        let dir_b = matches!(b, 0 | 3);
        if dir_a && dir_b { return true; }
        if (dir_a && is_undirected_kind(b)) || (dir_b && is_undirected_kind(a)) { return true; }
        false
    }

    /// 函数级详细中文注释：对无向关系使用 canonical(min,max) 键；有向关系保持 (from,to) 原样
    fn canonical_ids<TC: Config>(from: TC::DeceasedId, to: TC::DeceasedId, kind: u8) -> (TC::DeceasedId, TC::DeceasedId) {
        if is_undirected_kind(kind) {
            let af: u128 = from.saturated_into::<u128>();
            let bf: u128 = to.saturated_into::<u128>();
            if af <= bf { (from, to) } else { (to, from) }
        } else { (from, to) }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建逝者记录并挂接到墓位。
        /// - 权限：`GraveProvider::can_attach(origin, grave_id)` 必须为真；
        /// - 安全：限制文本与链接长度；敏感信息仅存链下链接；
        /// - 事件：`DeceasedCreated`。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::create())]
        pub fn create_deceased(
            origin: OriginFor<T>,
            grave_id: T::GraveId,
            name: Vec<u8>,
            bio: Vec<u8>,
            birth_ts: Option<u64>,
            death_ts: Option<u64>,
            links: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::GraveProvider::grave_exists(grave_id), Error::<T>::GraveNotFound);
            ensure!(T::GraveProvider::can_attach(&who, grave_id), Error::<T>::NotAuthorized);

            let name_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(name).map_err(|_| Error::<T>::BadInput)?;
            let bio_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(bio).map_err(|_| Error::<T>::BadInput)?;

            let mut links_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks> = Default::default();
            for l in links.into_iter() {
                let lb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
            }

            let id = NextDeceasedId::<T>::get();
            let next = id.checked_add(&T::DeceasedId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextDeceasedId::<T>::put(next);

            let now: BlockNumberFor<T> = <frame_system::Pallet<T>>::block_number();
            let deceased = Deceased::<T> {
                grave_id,
                owner: who.clone(),
                name: name_bv,
                bio: bio_bv,
                birth_ts,
                death_ts,
                links: links_bv,
                created: now,
                updated: now,
            };

            DeceasedOf::<T>::insert(id, deceased);
            DeceasedByGrave::<T>::try_mutate(grave_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooManyDeceasedInGrave))?;

            Self::deposit_event(Event::DeceasedCreated(id, grave_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新逝者信息（不变更所属墓位）。
        /// - 权限：仅记录 `owner`；
        /// - 可选字段逐项更新；
        /// - 事件：`DeceasedUpdated`。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn update_deceased(
            origin: OriginFor<T>,
            id: T::DeceasedId,
            name: Option<Vec<u8>>,
            bio: Option<Vec<u8>>,
            birth_ts: Option<Option<u64>>,
            death_ts: Option<Option<u64>>,
            links: Option<Vec<Vec<u8>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                ensure!(d.owner == who, Error::<T>::NotAuthorized);

                if let Some(n) = name { d.name = BoundedVec::try_from(n).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(b) = bio { d.bio = BoundedVec::try_from(b).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(bi) = birth_ts { d.birth_ts = bi; }
                if let Some(de) = death_ts { d.death_ts = de; }
                if let Some(ls) = links {
                    let mut links_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxLinks> = Default::default();
                    for l in ls.into_iter() {
                        let lb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(l).map_err(|_| Error::<T>::BadInput)?;
                        links_bv.try_push(lb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    d.links = links_bv;
                }
                d.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;

            Self::deposit_event(Event::DeceasedUpdated(id));
            Ok(())
        }

        /// 函数级中文注释：删除逝者记录，并从墓位索引中移除。
        /// - 权限：仅 `owner`；
        /// - 事件：`DeceasedRemoved`。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove())]
        pub fn remove_deceased(origin: OriginFor<T>, id: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let d = DeceasedOf::<T>::get(id).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(d.owner == who, Error::<T>::NotAuthorized);

            DeceasedOf::<T>::remove(id);
            DeceasedByGrave::<T>::mutate(d.grave_id, |list| {
                if let Some(pos) = list.iter().position(|x| x == &id) { list.swap_remove(pos); }
            });
            Self::deposit_event(Event::DeceasedRemoved(id));
            Ok(())
        }

        /// 函数级中文注释：迁移逝者到新的墓位。
        /// - 权限：仅 `owner` 且新墓位需通过 `GraveProvider::can_attach`；
        /// - 事件：`DeceasedTransferred`。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer())]
        pub fn transfer_deceased(origin: OriginFor<T>, id: T::DeceasedId, new_grave: T::GraveId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::GraveProvider::grave_exists(new_grave), Error::<T>::GraveNotFound);
            ensure!(T::GraveProvider::can_attach(&who, new_grave), Error::<T>::NotAuthorized);

            DeceasedOf::<T>::try_mutate(id, |maybe_d| -> DispatchResult {
                let d = maybe_d.as_mut().ok_or(Error::<T>::DeceasedNotFound)?;
                ensure!(d.owner == who, Error::<T>::NotAuthorized);

                // 先检查新墓位容量
                DeceasedByGrave::<T>::try_mutate(new_grave, |list| list.try_push(id).map_err(|_| Error::<T>::TooManyDeceasedInGrave))?;

                // 从旧墓位移除
                DeceasedByGrave::<T>::mutate(d.grave_id, |list| {
                    if let Some(pos) = list.iter().position(|x| x == &id) { list.swap_remove(pos); }
                });

                let old = d.grave_id;
                d.grave_id = new_grave;
                d.updated = <frame_system::Pallet<T>>::block_number();
                Self::deposit_event(Event::DeceasedTransferred(id, old, new_grave));
                Ok(())
            })
        }

        /// 函数级中文注释：从 A(发起方) → B(对方) 发起关系绑定请求。
        /// - 权限：A 所属墓位的管理员（通过 GraveProvider::can_attach(sender, A.grave_id) 判定）。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn propose_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId, kind: u8, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let _b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, a.grave_id), Error::<T>::NotAuthorized);
            ensure!(from != to, Error::<T>::BadInput);
            ensure!(matches!(kind, 0..=3), Error::<T>::BadRelationKind);
            // 去重：主记录存在则拒绝；无向需同时检查反向
            if Relations::<T>::contains_key(from, to) { return Err(Error::<T>::RelationExists.into()); }
            if is_undirected_kind(kind) && Relations::<T>::contains_key(to, from) { return Err(Error::<T>::RelationExists.into()); }
            // Pending 去重：无向需阻止反向重复提案
            if is_undirected_kind(kind) && PendingRelationRequests::<T>::contains_key(to, from) { return Err(Error::<T>::PendingApproval.into()); }
            // 冲突：若另一方向已存在且冲突
            if let Some(r) = Relations::<T>::get(to, from) { if is_conflicting_kind(r.kind, kind) { return Err(Error::<T>::BadRelationKind.into()); } }
            let now = <frame_system::Pallet<T>>::block_number();
            let note_bv: BoundedVec<_, T::StringLimit> = match note { Some(v) => BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?, None => Default::default() };
            PendingRelationRequests::<T>::insert(from, to, (kind, who, note_bv, now));
            Self::deposit_event(Event::RelationProposed(from, to, kind));
            Ok(())
        }

        /// 函数级中文注释：B 方管理员批准关系绑定。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn approve_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            let (kind, created_by, note, _created_at) = PendingRelationRequests::<T>::get(from, to).ok_or(Error::<T>::RelationNotFound)?;
            // 二次防冲突：避免并发与方向不一致
            if Relations::<T>::contains_key(from, to) { return Err(Error::<T>::RelationExists.into()); }
            if is_undirected_kind(kind) && Relations::<T>::contains_key(to, from) { return Err(Error::<T>::RelationExists.into()); }
            if let Some(r) = Relations::<T>::get(to, from) { if is_conflicting_kind(r.kind, kind) { return Err(Error::<T>::BadRelationKind.into()); } }
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = Relation::<T> { kind, note: note.clone(), created_by, since: now };
            let (ff, tt) = canonical_ids::<T>(from, to, kind);
            Relations::<T>::insert(ff, tt, &rec);
            RelationsByDeceased::<T>::try_mutate(ff, |list| list.try_push((tt, kind)).map_err(|_| Error::<T>::BadInput))?;
            if is_undirected_kind(kind) && ff != tt {
                RelationsByDeceased::<T>::try_mutate(tt, |list| list.try_push((ff, kind)).map_err(|_| Error::<T>::BadInput))?;
            }
            PendingRelationRequests::<T>::remove(from, to);
            Self::deposit_event(Event::RelationApproved(from, to, kind));
            Ok(())
        }

        /// 函数级中文注释：B 方管理员拒绝关系绑定。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn reject_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            ensure!(PendingRelationRequests::<T>::contains_key(from, to), Error::<T>::RelationNotFound);
            PendingRelationRequests::<T>::remove(from, to);
            Self::deposit_event(Event::RelationRejected(from, to));
            Ok(())
        }

        /// 函数级中文注释：任一方管理员撤销已建立的关系。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn revoke_relation(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, a.grave_id) || T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            let (ff, tt, kind) = if let Some(r) = Relations::<T>::get(from, to) { (from, to, r.kind) } else if let Some(r) = Relations::<T>::get(to, from) { (to, from, r.kind) } else { return Err(Error::<T>::RelationNotFound.into()) };
            Relations::<T>::remove(ff, tt);
            RelationsByDeceased::<T>::mutate(ff, |list| { if let Some(i) = list.iter().position(|(peer, _)| *peer == tt) { list.swap_remove(i); } });
            if is_undirected_kind(kind) && ff != tt {
                RelationsByDeceased::<T>::mutate(tt, |list| { if let Some(i) = list.iter().position(|(peer, _)| *peer == ff) { list.swap_remove(i); } });
            }
            Self::deposit_event(Event::RelationRevoked(from, to));
            Ok(())
        }

        /// 函数级中文注释：更新关系备注。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update())]
        pub fn update_relation_note(origin: OriginFor<T>, from: T::DeceasedId, to: T::DeceasedId, note: Option<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let a = DeceasedOf::<T>::get(from).ok_or(Error::<T>::DeceasedNotFound)?;
            let b = DeceasedOf::<T>::get(to).ok_or(Error::<T>::DeceasedNotFound)?;
            ensure!(T::GraveProvider::can_attach(&who, a.grave_id) || T::GraveProvider::can_attach(&who, b.grave_id), Error::<T>::NotAuthorized);
            // 同时尝试两个方向，支持无向 canonical
            if Relations::<T>::try_mutate(from, to, |maybe| -> DispatchResult {
                let r = maybe.as_mut().ok_or(Error::<T>::RelationNotFound)?;
                r.note = match note.as_ref() { Some(v) => BoundedVec::try_from(v.clone()).map_err(|_| Error::<T>::BadInput)?, None => Default::default() };
                Ok(())
            }).is_err() {
                Relations::<T>::try_mutate(to, from, |maybe| -> DispatchResult {
                    let r = maybe.as_mut().ok_or(Error::<T>::RelationNotFound)?;
                    r.note = match note.as_ref() { Some(v) => BoundedVec::try_from(v.clone()).map_err(|_| Error::<T>::BadInput)?, None => Default::default() };
                    Ok(())
                })?;
            }
            Self::deposit_event(Event::RelationUpdated(from, to));
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：运行时升级钩子（迁移到 StorageVersion=1）。
        /// - 当前仅写入版本号；为后续关系矩阵与状态机升级做准备。
        fn on_runtime_upgrade() -> Weight {
            if <Pallet<T>>::on_chain_storage_version() < 1 {
                StorageVersion::new(1).put::<Pallet<T>>();
            }
            Weight::zero()
        }
    }
}


