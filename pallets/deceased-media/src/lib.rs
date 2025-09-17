#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::{AtLeast32BitUnsigned, Saturating};
use alloc::vec::Vec;

/// 函数级中文注释：访问 `pallet-deceased` 的抽象接口，保持低耦合。
/// - `deceased_exists`：校验逝者存在。
/// - `can_manage`：校验操作者是否被允许管理该逝者的相册与媒体（一般为 owner/授权者）。
pub trait DeceasedAccess<AccountId, DeceasedId> {
    fn deceased_exists(id: DeceasedId) -> bool;
    fn can_manage(who: &AccountId, deceased_id: DeceasedId) -> bool;
}

/// 函数级中文注释：逝者令牌访问接口（低耦合）。
/// - 由 runtime 适配器从 `pallet-deceased::DeceasedOf` 读取 `deceased_token` 并按本 Pallet 的 `MaxTokenLen` 截断。
pub trait DeceasedTokenAccess<MaxTokenLen: Get<u32>, DeceasedId> {
    fn token_of(id: DeceasedId) -> Option<BoundedVec<u8, MaxTokenLen>>;
}

/// 函数级中文注释：媒体类型（仅媒体域：Photo/Video/Audio）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaKind { Photo, Video, Audio }

/// 函数级中文注释：可见性枚举。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Visibility { Public, Unlisted, Private }

/// 函数级中文注释：相册结构体（仅用于图片聚合容器）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Album<T: Config> {
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub title: BoundedVec<u8, T::StringLimit>,
    pub desc: BoundedVec<u8, T::StringLimit>,
    pub visibility: Visibility,
    pub tags: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags>,
    pub primary_photo_id: Option<T::MediaId>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：视频集结构体（用于视频/音频聚合容器）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct VideoCollection<T: Config> {
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub title: BoundedVec<u8, T::StringLimit>,
    pub desc: BoundedVec<u8, T::StringLimit>,
    pub tags: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags>,
    pub primary_video_id: Option<T::MediaId>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：媒体数据结构体（Photo/Video/Audio）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Media<T: Config> {
    pub id: T::MediaId,
    pub album_id: Option<T::AlbumId>,
    pub video_collection_id: Option<T::VideoCollectionId>,
    pub deceased_id: T::DeceasedId,
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub kind: MediaKind,
    pub uri: BoundedVec<u8, T::StringLimit>,
    pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
    pub content_hash: Option<[u8; 32]>,
    pub duration_secs: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub order_index: u32,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use sp_runtime::traits::SaturatedConversion;
    use frame_support::traits::{ReservableCurrency, ExistenceRequirement, Currency as CurrencyTrait};

    /// 函数级中文注释：余额与押金类型别名，统一本 pallet 内 Balance 表达。
    pub type BalanceOf<T> = <<T as Config>::Currency as CurrencyTrait<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + From<u64> + Into<u64>;
        type AlbumId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + From<u64> + Into<u64>;
        type VideoCollectionId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + From<u64> + Into<u64>;
        type MediaId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + From<u64> + Into<u64>;

        #[pallet::constant] type MaxAlbumsPerDeceased: Get<u32>;
        #[pallet::constant] type MaxVideoCollectionsPerDeceased: Get<u32>;
        #[pallet::constant] type MaxPhotoPerAlbum: Get<u32>;
        #[pallet::constant] type StringLimit: Get<u32>;
        #[pallet::constant] type MaxTags: Get<u32>;
        #[pallet::constant] type MaxReorderBatch: Get<u32>;
        #[pallet::constant] type MaxTokenLen: Get<u32>;

        type DeceasedProvider: DeceasedAccess<Self::AccountId, Self::DeceasedId>;
        type DeceasedTokenProvider: DeceasedTokenAccess<Self::MaxTokenLen, Self::DeceasedId>;

        /// 函数级中文注释：治理起源（Root/内容治理签名账户）。
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：货币接口，支持 reserve/unreserve 与转账。
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 函数级中文注释：押金/费用参数。
        #[pallet::constant] type AlbumDeposit: Get<BalanceOf<Self>>;
        #[pallet::constant] type VideoCollectionDeposit: Get<BalanceOf<Self>>;
        #[pallet::constant] type MediaDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：投诉押金（由投诉人保留，裁决时 20/5/75 分账或退回）。
        #[pallet::constant] type ComplaintDeposit: Get<BalanceOf<Self>>;
        #[pallet::constant] type CreateFee: Get<BalanceOf<Self>>;
        type FeeCollector: Get<Self::AccountId>;
        /// 函数级中文注释：仲裁费用接收账户（分账 5%）。
        type ArbitrationAccount: Get<Self::AccountId>;
        /// 函数级中文注释：观察/成熟期（区块数）。
        #[pallet::constant] type ComplaintPeriod: Get<BlockNumberFor<Self>>;
    }

    #[pallet::storage] pub type NextAlbumId<T: Config> = StorageValue<_, T::AlbumId, ValueQuery>;
    #[pallet::storage] pub type NextVideoCollectionId<T: Config> = StorageValue<_, T::VideoCollectionId, ValueQuery>;
    #[pallet::storage] pub type NextMediaId<T: Config> = StorageValue<_, T::MediaId, ValueQuery>;
    #[pallet::storage] pub type AlbumOf<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, Album<T>, OptionQuery>;
    #[pallet::storage] pub type VideoCollectionOf<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, VideoCollection<T>, OptionQuery>;
    #[pallet::storage] pub type MediaOf<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, Media<T>, OptionQuery>;
    #[pallet::storage] pub type AlbumsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>, ValueQuery>;
    #[pallet::storage] pub type VideoCollectionsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::VideoCollectionId, T::MaxVideoCollectionsPerDeceased>, ValueQuery>;
    #[pallet::storage] pub type MediaByAlbum<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BoundedVec<T::MediaId, T::MaxPhotoPerAlbum>, ValueQuery>;
    #[pallet::storage] pub type MediaByVideoCollection<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, BoundedVec<T::MediaId, T::MaxPhotoPerAlbum>, ValueQuery>;

    #[pallet::storage] pub type AlbumDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage] pub type VideoCollectionDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage] pub type MediaDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    #[pallet::storage] pub type AlbumMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BlockNumberFor<T>, OptionQuery>;
    #[pallet::storage] pub type VideoCollectionMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, BlockNumberFor<T>, OptionQuery>;
    #[pallet::storage] pub type MediaMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, BlockNumberFor<T>, OptionQuery>;
    #[pallet::storage] pub type AlbumFrozen<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, bool, ValueQuery>;
    /// 函数级中文注释：视频集冻结标记（治理设定）。冻结时禁止写操作。
    #[pallet::storage] pub type VideoCollectionFrozen<T: Config> = StorageMap<_, Blake2_128Concat, T::VideoCollectionId, bool, ValueQuery>;
    #[pallet::storage] pub type MediaHidden<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, bool, ValueQuery>;
    /// 函数级中文注释：逝者主图（仅 Photo 类型媒体）。使用媒体域统一管理，避免侵入主体档案。
    #[pallet::storage] pub type PrimaryImageOfDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, T::MediaId, OptionQuery>;
    /// 函数级中文注释：投诉状态映射（域编码, 对象ID）→ 案件。
    #[pallet::storage] pub type ComplaintOf<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), ComplaintCase<T>, OptionQuery>;
    /// 函数级中文注释：相册与媒体的投诉计数。
    #[pallet::storage] pub type AlbumComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, u32, ValueQuery>;
    #[pallet::storage] pub type MediaComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        AlbumCreated(T::AlbumId, T::DeceasedId, T::AccountId),
        AlbumUpdated(T::AlbumId),
        AlbumDeleted(T::AlbumId),
        /// 函数级中文注释：相册主图已变更（Some=设置；None=清空）
        AlbumPrimaryChanged(T::AlbumId, Option<T::MediaId>),
        VideoCollectionCreated(T::VideoCollectionId, T::DeceasedId, T::AccountId),
        VideoCollectionUpdated(T::VideoCollectionId),
        VideoCollectionDeleted(T::VideoCollectionId),
        VideoCollectionPrimaryChanged(T::VideoCollectionId, Option<T::MediaId>),
        MediaAdded(T::MediaId),
        MediaAddedToVideoCollection(T::MediaId, T::VideoCollectionId),
        MediaUpdated(T::MediaId),
        MediaRemoved(T::MediaId),
        AlbumDepositRefunded(T::AlbumId, T::AccountId, BalanceOf<T>),
        MediaDepositRefunded(T::MediaId, T::AccountId, BalanceOf<T>),
        GovAlbumFrozen(T::AlbumId, bool),
        GovMediaHidden(T::MediaId, bool),
        GovMediaReplaced(T::MediaId),
        /// 函数级中文注释：逝者主图已更新（Some 设置主图；None 清空）。
        PrimaryImageChanged(T::DeceasedId, Option<T::MediaId>),
        /// 函数级中文注释：投诉相关事件与分账。
        AlbumComplained(T::AlbumId, u32),
        MediaComplained(T::MediaId, u32),
        ComplaintResolved(u8, u64, bool),
        ComplaintPayoutWinner(T::AccountId, BalanceOf<T>),
        ComplaintPayoutArbitration(T::AccountId, BalanceOf<T>),
        ComplaintPayoutLoserRefund(T::AccountId, BalanceOf<T>),
    }

    #[pallet::error]
    pub enum Error<T> {
        DeceasedNotFound,
        NotAuthorized,
        AlbumNotFound,
        VideoCollectionNotFound,
        MediaNotFound,
        TooMany,
        BadInput,
        MismatchDeceased,
        Overflow,
        DepositFailed,
        Frozen,
        NotMatured,
        NoDepositToClaim,
    }

    #[pallet::pallet]
    pub struct Pallet<T>( _ );

    /// 函数级中文注释：投诉状态。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub enum ComplaintStatus { Pending, Resolved }

    /// 函数级中文注释：投诉案件：记录投诉人、押金与创建块。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    #[scale_info(skip_type_params(T))]
    pub struct ComplaintCase<T: Config> {
        pub complainant: T::AccountId,
        pub deposit: BalanceOf<T>,
        pub created: BlockNumberFor<T>,
        pub status: ComplaintStatus,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建相册；校验逝者存在与权限；收取创建费与可退押金。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_album(origin: OriginFor<T>, deceased_id: T::DeceasedId, title: Vec<u8>, desc: Vec<u8>, visibility: u8, tags: Vec<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);

            let title_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(title).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(desc).map_err(|_| Error::<T>::BadInput)?;
            let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
            for t in tags.into_iter() { let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?; }

            let fee = T::CreateFee::get();
            if !fee.is_zero() {
                T::Currency::transfer(&who, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::DepositFailed)?;
            }

            let id = NextAlbumId::<T>::get();
            let next = id.saturating_add(T::AlbumId::from(1u64));
            NextAlbumId::<T>::put(next);

            let vis = match visibility { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) };
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let album = Album::<T> { deceased_id, deceased_token: token, owner: who.clone(), title: title_bv, desc: desc_bv, visibility: vis, tags: tags_bv, primary_photo_id: None, created: now, updated: now };
            AlbumOf::<T>::insert(id, album);
            AlbumsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;

            let dep = T::AlbumDeposit::get();
            if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; AlbumDeposits::<T>::insert(id, (who.clone(), dep)); AlbumMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
            Self::deposit_event(Event::AlbumCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：设置逝者主图（仅 Photo 类型）。仅允许拥有该媒体的相册/视频集所属逝者一致。
        /// - 权限：需 `can_manage(who, deceased_id)` 为真，且媒体 kind=Photo。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_primary_image_for(origin: OriginFor<T>, deceased_id: T::DeceasedId, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);
            let m = MediaOf::<T>::get(media_id).ok_or(Error::<T>::MediaNotFound)?;
            ensure!(matches!(m.kind, MediaKind::Photo), Error::<T>::BadInput);
            ensure!(m.deceased_id == deceased_id, Error::<T>::MismatchDeceased);
            PrimaryImageOfDeceased::<T>::insert(deceased_id, media_id);
            Self::deposit_event(Event::PrimaryImageChanged(deceased_id, Some(media_id)));
            Ok(())
        }

        /// 函数级中文注释：清空逝者主图。
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn clear_primary_image_for(origin: OriginFor<T>, deceased_id: T::DeceasedId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);
            if PrimaryImageOfDeceased::<T>::take(deceased_id).is_some() {
                Self::deposit_event(Event::PrimaryImageChanged(deceased_id, None));
            }
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/清空逝者主图。
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_primary_image_for(origin: OriginFor<T>, deceased_id: T::DeceasedId, media_id: Option<T::MediaId>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            if let Some(mid) = media_id {
                let m = MediaOf::<T>::get(mid).ok_or(Error::<T>::MediaNotFound)?;
                ensure!(matches!(m.kind, MediaKind::Photo), Error::<T>::BadInput);
                ensure!(m.deceased_id == deceased_id, Error::<T>::MismatchDeceased);
                PrimaryImageOfDeceased::<T>::insert(deceased_id, mid);
                Self::deposit_event(Event::PrimaryImageChanged(deceased_id, Some(mid)));
            } else {
                if PrimaryImageOfDeceased::<T>::take(deceased_id).is_some() {
                    Self::deposit_event(Event::PrimaryImageChanged(deceased_id, None));
                }
            }
            Ok(())
        }

        /// 函数级中文注释：设置相册主图（仅 Photo）。传 None 表示清空主图。
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_album_primary_photo(origin: OriginFor<T>, album_id: T::AlbumId, media: Option<T::MediaId>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe| -> DispatchResult {
                let a = maybe.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                ensure!(a.owner == who, Error::<T>::NotAuthorized);
                ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
                if let Some(mid) = media {
                    let m = MediaOf::<T>::get(mid).ok_or(Error::<T>::MediaNotFound)?;
                    ensure!(matches!(m.kind, MediaKind::Photo), Error::<T>::BadInput);
                    ensure!(m.album_id == Some(album_id), Error::<T>::BadInput);
                    a.primary_photo_id = Some(mid);
                } else {
                    a.primary_photo_id = None;
                }
                a.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::AlbumPrimaryChanged(album_id, media));
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/清空相册主图。
        #[pallet::call_index(17)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_album_primary_photo(origin: OriginFor<T>, album_id: T::AlbumId, media: Option<T::MediaId>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe| -> DispatchResult {
                let a = maybe.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                if let Some(mid) = media {
                    let m = MediaOf::<T>::get(mid).ok_or(Error::<T>::MediaNotFound)?;
                    ensure!(matches!(m.kind, MediaKind::Photo), Error::<T>::BadInput);
                    ensure!(m.album_id == Some(album_id), Error::<T>::BadInput);
                    a.primary_photo_id = Some(mid);
                } else {
                    a.primary_photo_id = None;
                }
                a.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::AlbumPrimaryChanged(album_id, media));
            Ok(())
        }

        // ================== 投诉与裁决（相册/媒体）==================
        /// 函数级中文注释：投诉相册（保留投诉押金；记数+1）。存在进行中的案件时拒绝重复投诉。
        #[pallet::call_index(18)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_album(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            let key = (1u8, album_id.into());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::BadInput);
            let dep = T::ComplaintDeposit::get(); if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = AlbumComplaints::<T>::get(album_id).saturating_add(1); AlbumComplaints::<T>::insert(album_id, cnt);
            Self::deposit_event(Event::AlbumComplained(album_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：投诉媒体（保留投诉押金；记数+1）。
        #[pallet::call_index(19)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(MediaOf::<T>::contains_key(media_id) || MediaDeposits::<T>::contains_key(media_id), Error::<T>::MediaNotFound);
            let key = (2u8, media_id.into());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::BadInput);
            let dep = T::ComplaintDeposit::get(); if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = MediaComplaints::<T>::get(media_id).saturating_add(1); MediaComplaints::<T>::insert(media_id, cnt);
            Self::deposit_event(Event::MediaComplained(media_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：【治理】裁决相册投诉（true=维持投诉；false=驳回），按 20/5/75 分账或退款。
        #[pallet::call_index(20)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_album_complaint(origin: OriginFor<T>, album_id: T::AlbumId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            let key = (1u8, album_id.into());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::BadInput)?;
            let (uploader, upload_dep) = AlbumDeposits::<T>::get(album_id).unwrap_or_else(|| (T::FeeCollector::get(), Zero::zero()));
            let arb = T::ArbitrationAccount::get();
            if uphold {
                // 败诉：上传者（相册创建者押金）
                let d = upload_dep; if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into(); let fee = (d * 5u32.into()) / 100u32.into(); let back = d - win - fee;
                    T::Currency::repatriate_reserved(&uploader, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&uploader, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&uploader, back);
                    AlbumDeposits::<T>::remove(album_id); AlbumMaturity::<T>::remove(album_id);
                    Self::deposit_event(Event::ComplaintPayoutWinner(case.complainant.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(uploader.clone(), back));
                }
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                // 败诉：投诉者（退押金 75%，20% 奖励上传者，5% 仲裁费）
                let d = case.deposit; if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into(); let fee = (d * 5u32.into()) / 100u32.into(); let back = d - win - fee;
                    T::Currency::repatriate_reserved(&case.complainant, &uploader, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutWinner(uploader.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(case.complainant.clone(), back));
                }
            }
            case.status = ComplaintStatus::Resolved; ComplaintOf::<T>::remove(key); AlbumComplaints::<T>::insert(album_id, 0);
            Self::deposit_event(Event::ComplaintResolved(1u8, album_id.into(), uphold));
            Ok(())
        }

        /// 函数级中文注释：【治理】裁决媒体投诉（true=维持；false=驳回）。
        #[pallet::call_index(21)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_media_complaint(origin: OriginFor<T>, media_id: T::MediaId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(MediaOf::<T>::contains_key(media_id) || MediaDeposits::<T>::contains_key(media_id), Error::<T>::MediaNotFound);
            let key = (2u8, media_id.into());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::BadInput)?;
            let (uploader, upload_dep) = MediaDeposits::<T>::get(media_id).unwrap_or_else(|| (T::FeeCollector::get(), Zero::zero()));
            let arb = T::ArbitrationAccount::get();
            if uphold {
                let d = upload_dep; if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into(); let fee = (d * 5u32.into()) / 100u32.into(); let back = d - win - fee;
                    T::Currency::repatriate_reserved(&uploader, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&uploader, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&uploader, back);
                    MediaDeposits::<T>::remove(media_id); MediaMaturity::<T>::remove(media_id);
                    Self::deposit_event(Event::ComplaintPayoutWinner(case.complainant.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(uploader.clone(), back));
                }
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                let d = case.deposit; if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into(); let fee = (d * 5u32.into()) / 100u32.into(); let back = d - win - fee;
                    T::Currency::repatriate_reserved(&case.complainant, &uploader, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutWinner(uploader.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(case.complainant.clone(), back));
                }
            }
            case.status = ComplaintStatus::Resolved; ComplaintOf::<T>::remove(key); MediaComplaints::<T>::insert(media_id, 0);
            Self::deposit_event(Event::ComplaintResolved(2u8, media_id.into(), uphold));
            Ok(())
        }

        /// 函数级中文注释：创建视频集；收取创建费与可退押金。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_video_collection(origin: OriginFor<T>, deceased_id: T::DeceasedId, title: Vec<u8>, desc: Vec<u8>, tags: Vec<Vec<u8>>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);

            let title_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(title).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(desc).map_err(|_| Error::<T>::BadInput)?;
            let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
            for t in tags.into_iter() { let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?; }

            let fee = T::CreateFee::get();
            if !fee.is_zero() { T::Currency::transfer(&who, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::DepositFailed)?; }

            let id = NextVideoCollectionId::<T>::get();
            let next = id.saturating_add(T::VideoCollectionId::from(1u64));
            NextVideoCollectionId::<T>::put(next);

            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let vs = VideoCollection::<T> { deceased_id, deceased_token: token, owner: who.clone(), title: title_bv, desc: desc_bv, tags: tags_bv, primary_video_id: None, created: now, updated: now };
            VideoCollectionOf::<T>::insert(id, vs);
            VideoCollectionsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;

            let dep = T::VideoCollectionDeposit::get();
            if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; VideoCollectionDeposits::<T>::insert(id, (who.clone(), dep)); VideoCollectionMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
            Self::deposit_event(Event::VideoCollectionCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：添加媒体（Photo/Video/Audio），强制容器-类型一致。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn add_media(origin: OriginFor<T>, container_kind: u8, container_id: u64, kind: u8, uri: Vec<u8>, thumbnail_uri: Option<Vec<u8>>, content_hash: Option<[u8;32]>, duration_secs: Option<u32>, width: Option<u32>, height: Option<u32>, order_index: Option<u32>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let kind_enum = match kind { 0 => MediaKind::Photo, 1 => MediaKind::Video, 2 => MediaKind::Audio, _ => return Err(Error::<T>::BadInput.into()) };
            let uri_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(uri).map_err(|_| Error::<T>::BadInput)?;
            let thumb_bv = match thumbnail_uri { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };

            match kind_enum {
                MediaKind::Photo => {
                    ensure!(container_kind == 0, Error::<T>::BadInput);
                    let aid: T::AlbumId = container_id.saturated_into::<u64>().saturated_into();
                    let album = AlbumOf::<T>::get(aid).ok_or(Error::<T>::AlbumNotFound)?;
                    ensure!(album.owner == who, Error::<T>::NotAuthorized);
                    ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen);
                    if let (Some(w), Some(h)) = (width, height) { ensure!(w > 0 && h > 0, Error::<T>::BadInput); }
                    let id = NextMediaId::<T>::get();
                    let next = id.saturating_add(T::MediaId::from(1u64));
                    NextMediaId::<T>::put(next);
                    let mut list = MediaByAlbum::<T>::get(aid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(album.deceased_id).unwrap_or_default();
                    let media = Media::<T> { id, album_id: Some(aid), video_collection_id: None, deceased_id: album.deceased_id, deceased_token: token, owner: who.clone(), kind: MediaKind::Photo, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, duration_secs: None, width, height, order_index: ord, created: now, updated: now };
                    MediaOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
                    MediaByAlbum::<T>::insert(aid, list);
                    let dep = T::MediaDeposit::get();
                    if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; MediaDeposits::<T>::insert(id, (who.clone(), dep)); MediaMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::MediaAdded(id));
                    Ok(())
                }
                MediaKind::Video | MediaKind::Audio => {
                    ensure!(container_kind == 1, Error::<T>::BadInput);
                    let vsid: T::VideoCollectionId = container_id.saturated_into::<u64>().saturated_into();
                    let vs = VideoCollectionOf::<T>::get(vsid).ok_or(Error::<T>::VideoCollectionNotFound)?;
                    ensure!(vs.owner == who, Error::<T>::NotAuthorized);
                    ensure!(!VideoCollectionFrozen::<T>::get(vsid), Error::<T>::Frozen);
                    if let Some(d) = duration_secs { ensure!(d > 0u32, Error::<T>::BadInput); }
                    let id = NextMediaId::<T>::get();
                    let next = id.saturating_add(T::MediaId::from(1u64));
                    NextMediaId::<T>::put(next);
                    let mut list = MediaByVideoCollection::<T>::get(vsid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(vs.deceased_id).unwrap_or_default();
                    let media = Media::<T> { id, album_id: None, video_collection_id: Some(vsid), deceased_id: vs.deceased_id, deceased_token: token, owner: who.clone(), kind: kind_enum, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, duration_secs, width: None, height: None, order_index: ord, created: now, updated: now };
                    MediaOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
                    MediaByVideoCollection::<T>::insert(vsid, list);
                    let dep = T::MediaDeposit::get();
                    if !dep.is_zero() { T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?; MediaDeposits::<T>::insert(id, (who.clone(), dep)); MediaMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::MediaAddedToVideoCollection(id, vsid));
                    Ok(())
                }
            }
        }

        /// 函数级中文注释：更新媒体项；仅 owner；校验容器冻结状态。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_media(origin: OriginFor<T>, media_id: T::MediaId, uri: Option<Vec<u8>>, thumbnail_uri: Option<Option<Vec<u8>>>, content_hash: Option<Option<[u8;32]>>, duration_secs: Option<Option<u32>>, width: Option<Option<u32>>, height: Option<Option<u32>>, order_index: Option<u32>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            MediaOf::<T>::try_mutate(media_id, |maybe| -> DispatchResult {
                let m = maybe.as_mut().ok_or(Error::<T>::MediaNotFound)?;
                ensure!(m.owner == who, Error::<T>::NotAuthorized);
                if let Some(aid) = m.album_id { ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen); }
                if let Some(vsid) = m.video_collection_id { ensure!(!VideoCollectionFrozen::<T>::get(vsid), Error::<T>::Frozen); }
                if let Some(u) = uri { m.uri = BoundedVec::try_from(u).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(t) = thumbnail_uri { m.thumbnail_uri = match t { Some(v)=>Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None=>None }; }
                if let Some(h) = content_hash { m.content_hash = h; }
                if let Some(dur) = duration_secs { if matches!(m.kind, MediaKind::Video | MediaKind::Audio) { if let Some(x) = dur { ensure!(x > 0u32, Error::<T>::BadInput); } } m.duration_secs = dur; }
                if let Some(w) = width { if matches!(m.kind, MediaKind::Photo) { if let Some(x) = w { ensure!(x > 0u32, Error::<T>::BadInput); } } m.width = w; }
                if let Some(h) = height { if matches!(m.kind, MediaKind::Photo) { if let Some(x) = h { ensure!(x > 0u32, Error::<T>::BadInput); } } m.height = h; }
                if let Some(ord) = order_index { m.order_index = ord; }
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::MediaUpdated(media_id));
            Ok(())
        }

        /// 函数级中文注释：删除媒体项；仅 owner；从容器索引中移除；押金成熟后可退。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn remove_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let m = MediaOf::<T>::take(media_id).ok_or(Error::<T>::MediaNotFound)?;
            ensure!(m.owner == who, Error::<T>::NotAuthorized);
            if let Some(aid) = m.album_id { ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen); MediaByAlbum::<T>::mutate(aid, |list| { if let Some(pos) = list.iter().position(|x| *x == media_id) { list.swap_remove(pos); } }); }
            if let Some(vsid) = m.video_collection_id { ensure!(!VideoCollectionFrozen::<T>::get(vsid), Error::<T>::Frozen); MediaByVideoCollection::<T>::mutate(vsid, |list| { if let Some(pos) = list.iter().position(|x| *x == media_id) { list.swap_remove(pos); } }); }
            // 若该媒体是逝者当前主图，则清空主图
            if matches!(m.kind, MediaKind::Photo) {
                if let Some(current) = PrimaryImageOfDeceased::<T>::get(m.deceased_id) {
                    if current == media_id {
                        PrimaryImageOfDeceased::<T>::remove(m.deceased_id);
                        Self::deposit_event(Event::PrimaryImageChanged(m.deceased_id, None));
                    }
                }
                // 若为相册封面则清空
                if let Some(aid) = m.album_id { if let Some(mut a) = AlbumOf::<T>::get(aid) { if a.primary_photo_id == Some(media_id) { a.primary_photo_id = None; a.updated = <frame_system::Pallet<T>>::block_number(); AlbumOf::<T>::insert(aid, a); Self::deposit_event(Event::AlbumPrimaryChanged(aid, None)); } } }
            }
            // 若为主视频则清空
            if matches!(m.kind, MediaKind::Video | MediaKind::Audio) {
                if let Some(vsid) = m.video_collection_id { if let Some(mut v) = VideoCollectionOf::<T>::get(vsid) { if v.primary_video_id == Some(media_id) { v.primary_video_id = None; v.updated = <frame_system::Pallet<T>>::block_number(); VideoCollectionOf::<T>::insert(vsid, v); Self::deposit_event(Event::VideoCollectionPrimaryChanged(vsid, None)); } } }
            }
            let now = <frame_system::Pallet<T>>::block_number();
            MediaMaturity::<T>::insert(media_id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::MediaRemoved(media_id));
            Ok(())
        }

        /// 函数级中文注释：领取相册押金（需到期且无投诉—媒体域当前不计投诉，直接按到期判定）。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_album_deposit(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = AlbumDeposits::<T>::get(album_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            let mature_at = AlbumMaturity::<T>::get(album_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            AlbumDeposits::<T>::remove(album_id);
            AlbumMaturity::<T>::remove(album_id);
            Self::deposit_event(Event::AlbumDepositRefunded(album_id, who, amt));
            Ok(())
        }

        /// 函数级中文注释：领取媒体押金（需到期）。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_media_deposit(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = MediaDeposits::<T>::get(media_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            let mature_at = MediaMaturity::<T>::get(media_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            MediaDeposits::<T>::remove(media_id);
            MediaMaturity::<T>::remove(media_id);
            Self::deposit_event(Event::MediaDepositRefunded(media_id, who, amt));
            Ok(())
        }

        /// 函数级中文注释：【治理】冻结/解冻相册。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_freeze_album(origin: OriginFor<T>, album_id: T::AlbumId, frozen: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            AlbumFrozen::<T>::insert(album_id, frozen);
            Self::deposit_event(Event::GovAlbumFrozen(album_id, frozen));
            Ok(())
        }

        /// 函数级中文注释：【治理】设置媒体隐藏。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_media_hidden(origin: OriginFor<T>, media_id: T::MediaId, hidden: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(MediaOf::<T>::contains_key(media_id) || MediaDeposits::<T>::contains_key(media_id), Error::<T>::MediaNotFound);
            MediaHidden::<T>::insert(media_id, hidden);
            // 若隐藏的是逝者主图，则联动清空
            if hidden {
                if let Some(m) = MediaOf::<T>::get(media_id) {
                    // 逝者主图联动
                    if matches!(m.kind, MediaKind::Photo) {
                        if let Some(current) = PrimaryImageOfDeceased::<T>::get(m.deceased_id) { if current == media_id { PrimaryImageOfDeceased::<T>::remove(m.deceased_id); Self::deposit_event(Event::PrimaryImageChanged(m.deceased_id, None)); } }
                        // 相册封面联动
                        if let Some(aid) = m.album_id { if let Some(mut a) = AlbumOf::<T>::get(aid) { if a.primary_photo_id == Some(media_id) { a.primary_photo_id = None; a.updated = <frame_system::Pallet<T>>::block_number(); AlbumOf::<T>::insert(aid, a); Self::deposit_event(Event::AlbumPrimaryChanged(aid, None)); } } }
                    }
                    // 视频集主视频联动
                    if matches!(m.kind, MediaKind::Video | MediaKind::Audio) {
                        if let Some(vsid) = m.video_collection_id { if let Some(mut v) = VideoCollectionOf::<T>::get(vsid) { if v.primary_video_id == Some(media_id) { v.primary_video_id = None; v.updated = <frame_system::Pallet<T>>::block_number(); VideoCollectionOf::<T>::insert(vsid, v); Self::deposit_event(Event::VideoCollectionPrimaryChanged(vsid, None)); } } }
                    }
                }
            }
            Self::deposit_event(Event::GovMediaHidden(media_id, hidden));
            Ok(())
        }

        /// 函数级中文注释：【治理】替换媒体 URI（如涉敏打码）。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_replace_media_uri(origin: OriginFor<T>, media_id: T::MediaId, new_uri: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            MediaOf::<T>::try_mutate(media_id, |maybe| -> DispatchResult {
                let m = maybe.as_mut().ok_or(Error::<T>::MediaNotFound)?;
                m.uri = BoundedVec::try_from(new_uri).map_err(|_| Error::<T>::BadInput)?;
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::GovMediaReplaced(media_id));
            Ok(())
        }

        /// 函数级中文注释：【治理】移除媒体（押金成熟后可退）。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_remove_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let existed = MediaOf::<T>::take(media_id).ok_or(Error::<T>::MediaNotFound)?;
            if let Some(aid) = existed.album_id { MediaByAlbum::<T>::mutate(aid, |list| { if let Some(pos) = list.iter().position(|x| *x == media_id) { list.swap_remove(pos); } }); }
            if let Some(vsid) = existed.video_collection_id { MediaByVideoCollection::<T>::mutate(vsid, |list| { if let Some(pos) = list.iter().position(|x| *x == media_id) { list.swap_remove(pos); } }); }
            let now = <frame_system::Pallet<T>>::block_number();
            MediaMaturity::<T>::insert(media_id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::MediaRemoved(media_id));
            Ok(())
        }

        // ============== 治理专用最终落地接口（无私钥路径） ==============
        /// 函数级中文注释：【治理】代表 owner 创建相册（押金/费用从 owner 账户处理）。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_create_album_for(origin: OriginFor<T>, owner: T::AccountId, deceased_id: T::DeceasedId, title: Vec<u8>, desc: Vec<u8>, visibility: u8, tags: Vec<Vec<u8>>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // 重用 create_album 逻辑（以 owner 身份扣费/押金）
            // 简化：直接内联实现，避免 cross-dispatch
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&owner, deceased_id), Error::<T>::NotAuthorized);
            let title_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(title).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(desc).map_err(|_| Error::<T>::BadInput)?;
            let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
            for t in tags.into_iter() { let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?; }
            let fee = T::CreateFee::get(); if !fee.is_zero() { T::Currency::transfer(&owner, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::DepositFailed)?; }
            let id = NextAlbumId::<T>::get(); NextAlbumId::<T>::put(id.saturating_add(T::AlbumId::from(1u64)));
            let vis = match visibility { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) };
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let album = Album::<T> { deceased_id, deceased_token: token, owner: owner.clone(), title: title_bv, desc: desc_bv, visibility: vis, tags: tags_bv, primary_photo_id: None, created: now, updated: now };
            AlbumOf::<T>::insert(id, album);
            AlbumsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            let dep = T::AlbumDeposit::get(); if !dep.is_zero() { T::Currency::reserve(&owner, dep).map_err(|_| Error::<T>::DepositFailed)?; AlbumDeposits::<T>::insert(id, (owner.clone(), dep)); AlbumMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
            Self::deposit_event(Event::AlbumCreated(id, deceased_id, owner)); Ok(())
        }

        /// 函数级中文注释：【治理】代表 owner 添加媒体。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_add_media_for(origin: OriginFor<T>, owner: T::AccountId, container_kind: u8, container_id: u64, kind: u8, uri: Vec<u8>, thumbnail_uri: Option<Vec<u8>>, content_hash: Option<[u8;32]>, duration_secs: Option<u32>, width: Option<u32>, height: Option<u32>, order_index: Option<u32>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // 直接重用 add_media 的核心逻辑，但以 owner 账户处理押金
            let kind_enum = match kind { 0 => MediaKind::Photo, 1 => MediaKind::Video, 2 => MediaKind::Audio, _ => return Err(Error::<T>::BadInput.into()) };
            let uri_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(uri).map_err(|_| Error::<T>::BadInput)?;
            let thumb_bv = match thumbnail_uri { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
            match kind_enum {
                MediaKind::Photo => {
                    ensure!(container_kind == 0, Error::<T>::BadInput);
                    let aid: T::AlbumId = container_id.saturated_into::<u64>().saturated_into();
                    let album = AlbumOf::<T>::get(aid).ok_or(Error::<T>::AlbumNotFound)?;
                    ensure!(album.owner == owner, Error::<T>::NotAuthorized);
                    ensure!(!AlbumFrozen::<T>::get(aid), Error::<T>::Frozen);
                    if let (Some(w), Some(h)) = (width, height) { ensure!(w > 0 && h > 0, Error::<T>::BadInput); }
                    let id = NextMediaId::<T>::get(); NextMediaId::<T>::put(id.saturating_add(T::MediaId::from(1u64)));
                    let mut list = MediaByAlbum::<T>::get(aid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(album.deceased_id).unwrap_or_default();
                    let media = Media::<T> { id, album_id: Some(aid), video_collection_id: None, deceased_id: album.deceased_id, deceased_token: token, owner: owner.clone(), kind: MediaKind::Photo, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, duration_secs: None, width, height, order_index: ord, created: now, updated: now };
                    MediaOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?; MediaByAlbum::<T>::insert(aid, list);
                    let dep = T::MediaDeposit::get(); if !dep.is_zero() { T::Currency::reserve(&owner, dep).map_err(|_| Error::<T>::DepositFailed)?; MediaDeposits::<T>::insert(id, (owner.clone(), dep)); MediaMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::MediaAdded(id)); Ok(())
                }
                MediaKind::Video | MediaKind::Audio => {
                    ensure!(container_kind == 1, Error::<T>::BadInput);
                    let vsid: T::VideoCollectionId = container_id.saturated_into::<u64>().saturated_into();
                    let vs = VideoCollectionOf::<T>::get(vsid).ok_or(Error::<T>::VideoCollectionNotFound)?;
                    ensure!(vs.owner == owner, Error::<T>::NotAuthorized);
                    ensure!(!VideoCollectionFrozen::<T>::get(vsid), Error::<T>::Frozen);
                    if let Some(d) = duration_secs { ensure!(d > 0u32, Error::<T>::BadInput); }
                    let id = NextMediaId::<T>::get(); NextMediaId::<T>::put(id.saturating_add(T::MediaId::from(1u64)));
                    let mut list = MediaByVideoCollection::<T>::get(vsid);
                    let ord = order_index.unwrap_or(list.len() as u32);
                    let now = <frame_system::Pallet<T>>::block_number();
                    let token = T::DeceasedTokenProvider::token_of(vs.deceased_id).unwrap_or_default();
                    let media = Media::<T> { id, album_id: None, video_collection_id: Some(vsid), deceased_id: vs.deceased_id, deceased_token: token, owner: owner.clone(), kind: kind_enum, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, duration_secs, width: None, height: None, order_index: ord, created: now, updated: now };
                    MediaOf::<T>::insert(id, media);
                    list.try_push(id).map_err(|_| Error::<T>::TooMany)?; MediaByVideoCollection::<T>::insert(vsid, list);
                    let dep = T::MediaDeposit::get(); if !dep.is_zero() { T::Currency::reserve(&owner, dep).map_err(|_| Error::<T>::DepositFailed)?; MediaDeposits::<T>::insert(id, (owner.clone(), dep)); MediaMaturity::<T>::insert(id, now + T::ComplaintPeriod::get()); }
                    Self::deposit_event(Event::MediaAddedToVideoCollection(id, vsid)); Ok(())
                }
            }
        }
    }
}


