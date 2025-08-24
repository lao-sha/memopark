#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::AtLeast32BitUnsigned;
use frame_support::weights::Weight;

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
    fn create() -> Weight { 10_000 }
    fn update() -> Weight { 10_000 }
    fn remove() -> Weight { 10_000 }
    fn transfer() -> Weight { 10_000 }
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
    pub created: T::BlockNumber,
    pub updated: T::BlockNumber,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
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
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建逝者记录并挂接到墓位。
        /// - 权限：`GraveProvider::can_attach(origin, grave_id)` 必须为真；
        /// - 安全：限制文本与链接长度；敏感信息仅存链下链接；
        /// - 事件：`DeceasedCreated`。
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

            let now = <frame_system::Pallet<T>>::block_number();
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
    }
}


