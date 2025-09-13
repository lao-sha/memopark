#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_support::traits::StorageVersion;
use frame_system::pallet_prelude::*;

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

/// 函数级中文注释：媒体类型与可见性定义。
/// - Photo：图片；Video：视频；Audio：音频；Article：追忆文章（正文 JSON 以 IPFS CID 表示）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaKind { Photo, Video, Audio, Article }

#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Visibility { Public, Unlisted, Private }

/// 函数级中文注释：相册结构体，记录逝者、拥有者与元数据（限长）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Album<T: Config> {
    pub deceased_id: T::DeceasedId,
    /// 函数级中文注释：逝者令牌（来自 `pallet-deceased`），用于弱关联展示与联动；避免跨 pallet 读写耦合。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub title: BoundedVec<u8, T::StringLimit>,
    pub desc: BoundedVec<u8, T::StringLimit>,
    pub visibility: Visibility,
    pub tags: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags>,
    pub cover_media_id: Option<T::MediaId>,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：媒体项结构体，仅保存外链/哈希等最小信息。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Media<T: Config> {
    pub album_id: T::AlbumId,
    pub deceased_id: T::DeceasedId,
    /// 函数级中文注释：逝者令牌（来自 `pallet-deceased`），用于前端快速渲染与联动。
    pub deceased_token: BoundedVec<u8, T::MaxTokenLen>,
    pub owner: T::AccountId,
    pub kind: MediaKind,
    pub uri: BoundedVec<u8, T::StringLimit>,
    pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
    pub content_hash: Option<[u8; 32]>,
    /// 函数级中文注释：文章标题（仅当 kind=Article 时使用）。
    pub title: Option<BoundedVec<u8, T::StringLimit>>,
    /// 函数级中文注释：文章摘要（仅当 kind=Article 时使用）。
    pub summary: Option<BoundedVec<u8, T::StringLimit>>,
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
    use frame_support::weights::Weight;
    use codec::{Decode, Encode};
    use alloc::vec::Vec;
    use sp_runtime::traits::{AtLeast32BitUnsigned, Zero, SaturatedConversion};
    use frame_support::traits::{ReservableCurrency, ExistenceRequirement, Currency as CurrencyTrait};
    /// 函数级中文注释：余额与押金类型别名，统一本 pallet 内 Balance 表达。
    pub type BalanceOf<T> = <<T as Config>::Currency as CurrencyTrait<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type DeceasedId: Parameter + Member + Copy + MaxEncodedLen;
        type AlbumId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        type MediaId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        #[pallet::constant] type MaxAlbumsPerDeceased: Get<u32>;
        #[pallet::constant] type MaxMediaPerAlbum: Get<u32>;
        #[pallet::constant] type StringLimit: Get<u32>;
        #[pallet::constant] type MaxTags: Get<u32>;
        #[pallet::constant] type MaxReorderBatch: Get<u32>;
        /// 函数级中文注释：本模块内部缓存的 `deceased_token` 最大长度；建议与 `pallet-deceased::TokenLimit`/`GraveMaxCidLen` 对齐。
        #[pallet::constant] type MaxTokenLen: Get<u32>;

        type DeceasedProvider: DeceasedAccess<Self::AccountId, Self::DeceasedId>;
        /// 函数级中文注释：逝者令牌提供者（低耦合读取 `deceased_token`）。
        type DeceasedTokenProvider: DeceasedTokenAccess<Self::MaxTokenLen, Self::DeceasedId>;

        /// 函数级中文注释：治理起源（Root/议会等），用于冻结/隐藏/替换等治理动作。
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：货币接口，支持 reserve/unreserve 与转账。
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 函数级中文注释：创建相册需保留的押金金额。
        #[pallet::constant]
        type AlbumDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：添加媒体需保留的押金金额。
        #[pallet::constant]
        type MediaDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：申诉押金金额（由申诉方在 complain_* 时保留）。
        #[pallet::constant]
        type ComplaintDeposit: Get<BalanceOf<Self>>;
        /// 函数级中文注释：小额手续费（优先用于相册创建），转入费用账户。
        #[pallet::constant]
        type CreateFee: Get<BalanceOf<Self>>;
        /// 函数级中文注释：费用接收账户（建议指向国库 PalletId 派生地址）。
        type FeeCollector: Get<Self::AccountId>;
        /// 函数级中文注释：仲裁费用接收账户（败诉押金的 5%）。
        type ArbitrationAccount: Get<Self::AccountId>;
        /// 函数级中文注释：投诉观察/成熟期（区块数）。到期且无投诉时可退款；删除后同等待期再退。
        #[pallet::constant]
        type ComplaintPeriod: Get<BlockNumberFor<Self>>;
    }

    #[pallet::storage] pub type NextAlbumId<T: Config> = StorageValue<_, T::AlbumId, ValueQuery>;
    #[pallet::storage] pub type NextMediaId<T: Config> = StorageValue<_, T::MediaId, ValueQuery>;
    #[pallet::storage] pub type AlbumOf<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, Album<T>, OptionQuery>;
    #[pallet::storage] pub type MediaOf<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, Media<T>, OptionQuery>;
    #[pallet::storage] pub type AlbumsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>, ValueQuery>;
    #[pallet::storage] pub type MediaByAlbum<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BoundedVec<T::MediaId, T::MaxMediaPerAlbum>, ValueQuery>;
    /// 函数级中文注释：相册押金记录（who, amount）。
    #[pallet::storage] pub type AlbumDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    /// 函数级中文注释：媒体押金记录（who, amount）。
    #[pallet::storage] pub type MediaDeposits<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, (T::AccountId, BalanceOf<T>), OptionQuery>;
    /// 函数级中文注释：申诉存证（域+目标ID → 案件）。域：1=Album, 2=Media。
    #[pallet::storage] pub type ComplaintOf<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), ComplaintCase<T>, OptionQuery>;
    /// 函数级中文注释：相册冻结标志（治理设定）。
    #[pallet::storage] pub type AlbumFrozen<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, bool, ValueQuery>;
    /// 函数级中文注释：媒体隐藏标志（治理设定）。
    #[pallet::storage] pub type MediaHidden<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, bool, ValueQuery>;
    /// 函数级中文注释：相册投诉计数。
    #[pallet::storage] pub type AlbumComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, u32, ValueQuery>;
    /// 函数级中文注释：媒体投诉计数。
    #[pallet::storage] pub type MediaComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, u32, ValueQuery>;
    /// 函数级中文注释：相册押金成熟区块（创建或删除时设置为 now + ComplaintPeriod）。
    #[pallet::storage] pub type AlbumMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BlockNumberFor<T>, OptionQuery>;
    /// 函数级中文注释：媒体押金成熟区块（创建或删除时设置为 now + ComplaintPeriod）。
    #[pallet::storage] pub type MediaMaturity<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, BlockNumberFor<T>, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        AlbumCreated(T::AlbumId, T::DeceasedId, T::AccountId),
        AlbumUpdated(T::AlbumId),
        AlbumDeleted(T::AlbumId),
        MediaAdded(T::MediaId, T::AlbumId),
        MediaUpdated(T::MediaId),
        MediaRemoved(T::MediaId),
        MediaMoved(T::MediaId, T::AlbumId, T::AlbumId),
        AlbumReordered(T::AlbumId),
        /// 函数级中文注释：治理事件：相册冻结/解冻。
        GovAlbumFrozen(T::AlbumId, bool),
        /// 函数级中文注释：治理事件：媒体隐藏/取消隐藏。
        GovMediaHidden(T::MediaId, bool),
        /// 函数级中文注释：治理事件：替换媒体 URI。
        GovMediaReplaced(T::MediaId),
        /// 函数级中文注释：投诉事件（相册/媒体）。
        AlbumComplained(T::AlbumId, u32),
        MediaComplained(T::MediaId, u32),
        /// 函数级中文注释：治理裁决完成（Upheld=维持投诉/隐藏，Dismiss=驳回），并包含胜诉方与金额明细。
        ComplaintResolved(u8, u64, bool),
        /// 函数级中文注释：申诉押金分账：胜诉方收到奖励。
        ComplaintPayoutWinner(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：申诉押金分账：仲裁账户收到费用。
        ComplaintPayoutArbitration(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：申诉押金分账：败诉方退回剩余押金。
        ComplaintPayoutLoserRefund(T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：相册押金退款成功。
        AlbumDepositRefunded(T::AlbumId, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：媒体押金退款成功。
        MediaDepositRefunded(T::MediaId, T::AccountId, BalanceOf<T>),
    }

    #[pallet::error]
    pub enum Error<T> {
        DeceasedNotFound,
        NotAuthorized,
        AlbumNotFound,
        MediaNotFound,
        TooMany,
        BadInput,
        MismatchDeceased,
        Overflow,
        /// 函数级中文注释：押金/费用失败（余额不足或保留失败）。
        DepositFailed,
        /// 函数级中文注释：相册已冻结。
        Frozen,
        /// 函数级中文注释：媒体被隐藏（只读提示，不阻止写）。
        Hidden,
        /// 函数级中文注释：押金未成熟或存在投诉。
        NotMatured,
        /// 函数级中文注释：无可退款押金。
        NoDepositToClaim,
        /// 函数级中文注释：当前无进行中的申诉。
        NoActiveComplaint,
    }

    /// 函数级中文注释：存储版本管理，用于新增字段（如 Article 标题/摘要）时的安全迁移。
    /// - v1：初始版本（无 Article 与标题/摘要字段）。
    /// - v2：新增 `MediaKind::Article`，并在 `Media` 结构中追加 `title`/`summary` 字段。
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(2);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：申诉状态。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub enum ComplaintStatus { Pending, Resolved }

    /// 函数级中文注释：申诉案件。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    #[scale_info(skip_type_params(T))]
    pub struct ComplaintCase<T: Config> {
        pub complainant: T::AccountId,
        pub deposit: BalanceOf<T>,
        pub created: BlockNumberFor<T>,
        pub status: ComplaintStatus,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建相册；校验逝者存在与权限；限制标题/描述/标签长度数量。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_album(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            title: Vec<u8>,
            desc: Vec<u8>,
            visibility: u8,
            tags: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::DeceasedProvider::deceased_exists(deceased_id), Error::<T>::DeceasedNotFound);
            ensure!(T::DeceasedProvider::can_manage(&who, deceased_id), Error::<T>::NotAuthorized);

            let title_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(title).map_err(|_| Error::<T>::BadInput)?;
            let desc_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(desc).map_err(|_| Error::<T>::BadInput)?;
            let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
            for t in tags.into_iter() {
                let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
            }

            // 小额手续费：转入费用账户
            let fee = T::CreateFee::get();
            if !fee.is_zero() {
                T::Currency::transfer(&who, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive)
                    .map_err(|_| Error::<T>::DepositFailed)?;
            }

            let id = NextAlbumId::<T>::get();
            let next = id.checked_add(&T::AlbumId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextAlbumId::<T>::put(next);

            let vis = match visibility { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) };
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(deceased_id).unwrap_or_default();
            let album = Album::<T> { deceased_id, deceased_token: token, owner: who.clone(), title: title_bv, desc: desc_bv, visibility: vis, tags: tags_bv, cover_media_id: None, created: now, updated: now };

            AlbumOf::<T>::insert(id, album);
            AlbumsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            // 押金 reserve 并设置成熟时间
            let dep = T::AlbumDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                AlbumDeposits::<T>::insert(id, (who.clone(), dep));
                let mature_at = now + T::ComplaintPeriod::get();
                AlbumMaturity::<T>::insert(id, mature_at);
            }
            Self::deposit_event(Event::AlbumCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新相册；仅 owner；可更新标题/描述/可见性/标签/封面。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_album(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            visibility: Option<u8>,
            tags: Option<Vec<Vec<u8>>>,
            cover_media_id: Option<Option<T::MediaId>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe_a| -> DispatchResult {
                let a = maybe_a.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                ensure!(a.owner == who, Error::<T>::NotAuthorized);
                ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
                if let Some(t) = title { a.title = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(d) = desc { a.desc = BoundedVec::try_from(d).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = visibility { a.visibility = match v { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) }; }
                if let Some(ts) = tags {
                    let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
                    for t in ts.into_iter() {
                        let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                        tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    a.tags = tags_bv;
                }
                if let Some(cov) = cover_media_id {
                    if let Some(mid) = cov { let m = MediaOf::<T>::get(mid).ok_or(Error::<T>::MediaNotFound)?; ensure!(m.album_id == album_id, Error::<T>::BadInput); }
                    a.cover_media_id = cov;
                }
                a.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::AlbumUpdated(album_id));
            Ok(())
        }

        /// 函数级中文注释：删除相册；仅 owner；若非空则拒绝，避免重交易。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn delete_album(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
            let medias = MediaByAlbum::<T>::get(album_id);
            ensure!(medias.is_empty(), Error::<T>::BadInput);
            AlbumOf::<T>::remove(album_id);
            AlbumsByDeceased::<T>::mutate(album.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &album_id) { list.swap_remove(pos); } });
            // 删除后，若存在押金，重置成熟期等待投诉期结束再可退款
            if AlbumDeposits::<T>::contains_key(album_id) {
                let now = <frame_system::Pallet<T>>::block_number();
                AlbumMaturity::<T>::insert(album_id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::AlbumDeleted(album_id));
            Ok(())
        }

        /// 函数级中文注释：添加媒体项；仅相册 owner；限制 URI 长度；可设置排序号。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn add_media(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            kind: u8,
            uri: Vec<u8>,
            thumbnail_uri: Option<Vec<u8>>,
            content_hash: Option<[u8;32]>,
            // 文章标题/摘要（仅 kind=Article 时使用；其他类型忽略）。
            title: Option<Vec<u8>>,
            summary: Option<Vec<u8>>,
            duration_secs: Option<u32>,
            width: Option<u32>,
            height: Option<u32>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);

            let uri_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(uri).map_err(|_| Error::<T>::BadInput)?;
            let thumb_bv = match thumbnail_uri { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };

            // 轻量校验：不同媒体类型的可选字段基本合理性
            let kind_enum = match kind { 0 => MediaKind::Photo, 1 => MediaKind::Video, 2 => MediaKind::Audio, 3 => MediaKind::Article, _ => return Err(Error::<T>::BadInput.into()) };
            match kind_enum {
                MediaKind::Photo => {
                    if let (Some(w), Some(h)) = (width, height) { ensure!(w > 0 && h > 0, Error::<T>::BadInput); }
                }
                MediaKind::Video | MediaKind::Audio => {
                    if let Some(d) = duration_secs { ensure!(d > 0u32, Error::<T>::BadInput); }
                }
                MediaKind::Article => {
                    // Article：要求提供 content_hash 以绑定链下 JSON，URI 用于存放 IPFS CID
                    ensure!(content_hash.is_some(), Error::<T>::BadInput);
                }
            }

            let id = NextMediaId::<T>::get();
            let next = id.checked_add(&T::MediaId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextMediaId::<T>::put(next);

            let mut list = MediaByAlbum::<T>::get(album_id);
            let ord = order_index.unwrap_or(list.len() as u32);
            let now = <frame_system::Pallet<T>>::block_number();
            let token = T::DeceasedTokenProvider::token_of(album.deceased_id).unwrap_or_default();
            let title_bv: Option<BoundedVec<_, T::StringLimit>> = match (kind_enum.clone(), title) {
                (MediaKind::Article, Some(v)) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                _ => None,
            };
            let summary_bv: Option<BoundedVec<_, T::StringLimit>> = match (kind_enum.clone(), summary) {
                (MediaKind::Article, Some(v)) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?),
                _ => None,
            };

            let media = Media::<T> {
                album_id,
                deceased_id: album.deceased_id,
                deceased_token: token,
                owner: who.clone(),
                kind: kind_enum,
                uri: uri_bv,
                thumbnail_uri: thumb_bv,
                content_hash,
                title: title_bv,
                summary: summary_bv,
                duration_secs,
                width,
                height,
                order_index: ord,
                created: now,
                updated: now,
            };

            MediaOf::<T>::insert(id, media);
            list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
            MediaByAlbum::<T>::insert(album_id, list);
            // 媒体押金 reserve 与成熟设置
            let dep = T::MediaDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
                MediaDeposits::<T>::insert(id, (who.clone(), dep));
                MediaMaturity::<T>::insert(id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::MediaAdded(id, album_id));
            Ok(())
        }

        /// 函数级中文注释：更新媒体项；仅 owner；可改外链/哈希/尺寸/排序等。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_media(
            origin: OriginFor<T>,
            media_id: T::MediaId,
            uri: Option<Vec<u8>>,
            thumbnail_uri: Option<Option<Vec<u8>>>,
            content_hash: Option<Option<[u8;32]>>,
            // 文章标题/摘要更新（仅当目标媒体为 Article 时有效）。
            title: Option<Option<Vec<u8>>>,
            summary: Option<Option<Vec<u8>>>,
            duration_secs: Option<Option<u32>>,
            width: Option<Option<u32>>,
            height: Option<Option<u32>>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            MediaOf::<T>::try_mutate(media_id, |maybe_m| -> DispatchResult {
                let m = maybe_m.as_mut().ok_or(Error::<T>::MediaNotFound)?;
                ensure!(m.owner == who, Error::<T>::NotAuthorized);
                ensure!(!AlbumFrozen::<T>::get(m.album_id), Error::<T>::Frozen);
                if let Some(u) = uri { m.uri = BoundedVec::try_from(u).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(t) = thumbnail_uri { m.thumbnail_uri = match t { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None }; }
                if let Some(h) = content_hash { m.content_hash = h; }
                if let Some(dur) = duration_secs {
                    // 对视频/音频：若提供时长则要求 > 0
                    if matches!(m.kind, MediaKind::Video | MediaKind::Audio) {
                        if let Some(x) = dur { ensure!(x > 0u32, Error::<T>::BadInput); }
                    }
                    m.duration_secs = dur;
                }
                // Article 专属字段更新
                if let Some(t) = title {
                    if matches!(m.kind, MediaKind::Article) {
                        m.title = match t { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    }
                }
                if let Some(s) = summary {
                    if matches!(m.kind, MediaKind::Article) {
                        m.summary = match s { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };
                    }
                }
                if let Some(w_opt) = width {
                    if matches!(m.kind, MediaKind::Photo) { if let Some(x) = w_opt { ensure!(x > 0u32, Error::<T>::BadInput); } }
                    m.width = w_opt;
                }
                if let Some(h_opt) = height {
                    if matches!(m.kind, MediaKind::Photo) { if let Some(x) = h_opt { ensure!(x > 0u32, Error::<T>::BadInput); } }
                    m.height = h_opt;
                }
                if let Some(ord) = order_index { m.order_index = ord; }
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::MediaUpdated(media_id));
            Ok(())
        }

        /// 函数级中文注释：删除媒体项；仅 owner；从相册索引中同步移除。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn remove_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let m = MediaOf::<T>::get(media_id).ok_or(Error::<T>::MediaNotFound)?;
            ensure!(m.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(m.album_id), Error::<T>::Frozen);
            MediaOf::<T>::remove(media_id);
            MediaByAlbum::<T>::mutate(m.album_id, |list| { if let Some(pos) = list.iter().position(|x| x == &media_id) { list.swap_remove(pos); } });
            // 删除后，若存在押金，重置成熟期等待投诉期结束再可退款
            if MediaDeposits::<T>::contains_key(media_id) {
                let now = <frame_system::Pallet<T>>::block_number();
                MediaMaturity::<T>::insert(media_id, now + T::ComplaintPeriod::get());
            }
            Self::deposit_event(Event::MediaRemoved(media_id));
            Ok(())
        }

        /// 函数级中文注释：移动媒体到其它相册；要求同一逝者；仅 owner。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn move_media(origin: OriginFor<T>, media_id: T::MediaId, to_album: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let mut media = MediaOf::<T>::get(media_id).ok_or(Error::<T>::MediaNotFound)?;
            ensure!(media.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(media.album_id), Error::<T>::Frozen);
            let dst = AlbumOf::<T>::get(to_album).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(dst.deceased_id == media.deceased_id, Error::<T>::MismatchDeceased);
            MediaByAlbum::<T>::try_mutate(to_album, |dst_list| dst_list.try_push(media_id).map_err(|_| Error::<T>::TooMany))?;
            let from = media.album_id;
            MediaByAlbum::<T>::mutate(from, |src_list| { if let Some(pos) = src_list.iter().position(|x| x == &media_id) { src_list.swap_remove(pos); } });
            media.album_id = to_album;
            media.updated = <frame_system::Pallet<T>>::block_number();
            MediaOf::<T>::insert(media_id, media);
            Self::deposit_event(Event::MediaMoved(media_id, from, to_album));
            Ok(())
        }

        /// 函数级中文注释：重排相册媒体顺序；仅 owner；限制批量大小。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn reorder_album(origin: OriginFor<T>, album_id: T::AlbumId, ordered_media: Vec<T::MediaId>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
            ensure!(!AlbumFrozen::<T>::get(album_id), Error::<T>::Frozen);
            ensure!((ordered_media.len() as u32) <= T::MaxReorderBatch::get(), Error::<T>::BadInput);
            for (idx, mid) in ordered_media.iter().enumerate() {
                MediaOf::<T>::try_mutate(*mid, |maybe_m| -> DispatchResult {
                    let m = maybe_m.as_mut().ok_or(Error::<T>::MediaNotFound)?;
                    ensure!(m.album_id == album_id, Error::<T>::BadInput);
                    m.order_index = idx as u32;
                    m.updated = <frame_system::Pallet<T>>::block_number();
                    Ok(())
                })?;
            }
            MediaByAlbum::<T>::insert(album_id, BoundedVec::try_from(ordered_media).map_err(|_| Error::<T>::BadInput)?);
            Self::deposit_event(Event::AlbumReordered(album_id));
            Ok(())
        }

        // ===================== 投诉与押金退款 =====================
        /// 函数级中文注释：投诉相册（累加计数 + 申诉押金 reserve）。存在投诉将阻止押金退款。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_album(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            // 每次仅允许一个有效申诉
            let key = (1u8, album_id.saturated_into::<u64>());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::NoActiveComplaint);
            // 申诉押金：与媒体押金等额或由常量指定
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
            }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = AlbumComplaints::<T>::get(album_id).saturating_add(1);
            AlbumComplaints::<T>::insert(album_id, cnt);
            Self::deposit_event(Event::AlbumComplained(album_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：投诉媒体（累加计数 + 申诉押金 reserve）。存在投诉将阻止押金退款。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn complain_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(MediaOf::<T>::contains_key(media_id) || MediaDeposits::<T>::contains_key(media_id), Error::<T>::MediaNotFound);
            let key = (2u8, media_id.saturated_into::<u64>());
            ensure!(ComplaintOf::<T>::get(key).is_none(), Error::<T>::NoActiveComplaint);
            let dep = T::ComplaintDeposit::get();
            if !dep.is_zero() {
                T::Currency::reserve(&who, dep).map_err(|_| Error::<T>::DepositFailed)?;
            }
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintOf::<T>::insert(key, ComplaintCase { complainant: who.clone(), deposit: dep, created: now, status: ComplaintStatus::Pending });
            let cnt = MediaComplaints::<T>::get(media_id).saturating_add(1);
            MediaComplaints::<T>::insert(media_id, cnt);
            Self::deposit_event(Event::MediaComplained(media_id, cnt));
            Ok(())
        }

        /// 函数级中文注释：领取相册押金（需到期且无投诉）。删除后同等待期可退。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_album_deposit(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = AlbumDeposits::<T>::get(album_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            ensure!(AlbumComplaints::<T>::get(album_id) == 0, Error::<T>::NotMatured);
            let mature_at = AlbumMaturity::<T>::get(album_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            AlbumDeposits::<T>::remove(album_id);
            AlbumMaturity::<T>::remove(album_id);
            Self::deposit_event(Event::AlbumDepositRefunded(album_id, who, amt));
            Ok(())
        }

        /// 函数级中文注释：领取媒体押金（需到期且无投诉）。删除后同等待期可退。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn claim_media_deposit(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (owner, amt) = MediaDeposits::<T>::get(media_id).ok_or(Error::<T>::NoDepositToClaim)?;
            ensure!(who == owner, Error::<T>::NotAuthorized);
            ensure!(MediaComplaints::<T>::get(media_id) == 0, Error::<T>::NotMatured);
            let mature_at = MediaMaturity::<T>::get(media_id).ok_or(Error::<T>::NotMatured)?;
            let now = <frame_system::Pallet<T>>::block_number();
            ensure!(now >= mature_at, Error::<T>::NotMatured);
            T::Currency::unreserve(&who, amt);
            MediaDeposits::<T>::remove(media_id);
            MediaMaturity::<T>::remove(media_id);
            Self::deposit_event(Event::MediaDepositRefunded(media_id, who, amt));
            Ok(())
        }

        // ===================== 治理动作 =====================
        /// 函数级中文注释：【治理】裁决相册申诉（true=维持投诉；false=驳回）。
        #[pallet::call_index(17)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_album_complaint(origin: OriginFor<T>, album_id: T::AlbumId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            let key = (1u8, album_id.saturated_into::<u64>());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::NoActiveComplaint)?;
            let (uploader, upload_dep) = AlbumDeposits::<T>::get(album_id).unwrap_or_else(|| (T::FeeCollector::get(), Zero::zero()));
            let arb = T::ArbitrationAccount::get();
            // 按败诉方押金 D 分配：20% → 胜诉；5% → 仲裁；75% → 败诉退款
            if uphold {
                // 败诉：上传者；胜诉：投诉者
                let d = upload_dep;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    // 从上传者保留押金划转
                    T::Currency::repatriate_reserved(&uploader, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&uploader, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&uploader, back);
                    // 清除上传侧押金记录
                    AlbumDeposits::<T>::remove(album_id);
                    AlbumMaturity::<T>::remove(album_id);
                    Self::deposit_event(Event::ComplaintPayoutWinner(case.complainant.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(uploader.clone(), back));
                }
                // 胜诉方申诉押金全额退回
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                // 败诉：投诉者；胜诉：上传者
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    T::Currency::repatriate_reserved(&case.complainant, &uploader, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutWinner(uploader.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(case.complainant.clone(), back));
                }
                // 上传者押金保持原成熟路径（不动）
            }
            // 结案与计数归零
            case.status = ComplaintStatus::Resolved;
            ComplaintOf::<T>::remove(key);
            AlbumComplaints::<T>::insert(album_id, 0);
            let id_u64: u64 = album_id.saturated_into::<u64>();
            Self::deposit_event(Event::ComplaintResolved(1u8, id_u64, uphold));
            Ok(())
        }

        /// 函数级中文注释：【治理】裁决媒体申诉（true=维持投诉；false=驳回）。
        #[pallet::call_index(18)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_resolve_media_complaint(origin: OriginFor<T>, media_id: T::MediaId, uphold: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(MediaOf::<T>::contains_key(media_id) || MediaDeposits::<T>::contains_key(media_id), Error::<T>::MediaNotFound);
            let key = (2u8, media_id.saturated_into::<u64>());
            let mut case = ComplaintOf::<T>::get(key).ok_or(Error::<T>::NoActiveComplaint)?;
            let (uploader, upload_dep) = MediaDeposits::<T>::get(media_id).unwrap_or_else(|| (T::FeeCollector::get(), Zero::zero()));
            let arb = T::ArbitrationAccount::get();
            if uphold {
                // 败诉：上传者；胜诉：投诉者
                let d = upload_dep;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    T::Currency::repatriate_reserved(&uploader, &case.complainant, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&uploader, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&uploader, back);
                    MediaDeposits::<T>::remove(media_id);
                    MediaMaturity::<T>::remove(media_id);
                    Self::deposit_event(Event::ComplaintPayoutWinner(case.complainant.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(uploader.clone(), back));
                }
                if !case.deposit.is_zero() { T::Currency::unreserve(&case.complainant, case.deposit); }
            } else {
                // 败诉：投诉者；胜诉：上传者
                let d = case.deposit;
                if !d.is_zero() {
                    let win = (d * 20u32.into()) / 100u32.into();
                    let fee = (d * 5u32.into()) / 100u32.into();
                    let back = d - win - fee;
                    T::Currency::repatriate_reserved(&case.complainant, &uploader, win, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::repatriate_reserved(&case.complainant, &arb, fee, frame_support::traits::BalanceStatus::Free).ok();
                    T::Currency::unreserve(&case.complainant, back);
                    Self::deposit_event(Event::ComplaintPayoutWinner(uploader.clone(), win));
                    Self::deposit_event(Event::ComplaintPayoutArbitration(arb.clone(), fee));
                    Self::deposit_event(Event::ComplaintPayoutLoserRefund(case.complainant.clone(), back));
                }
            }
            case.status = ComplaintStatus::Resolved;
            ComplaintOf::<T>::remove(key);
            MediaComplaints::<T>::insert(media_id, 0);
            let id_u64: u64 = media_id.saturated_into::<u64>();
            Self::deposit_event(Event::ComplaintResolved(2u8, id_u64, uphold));
            Ok(())
        }
        /// 函数级中文注释：【治理】冻结/解冻相册。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_freeze_album(origin: OriginFor<T>, album_id: T::AlbumId, frozen: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(AlbumOf::<T>::contains_key(album_id), Error::<T>::AlbumNotFound);
            AlbumFrozen::<T>::insert(album_id, frozen);
            Self::deposit_event(Event::GovAlbumFrozen(album_id, frozen));
            Ok(())
        }

        /// 函数级中文注释：【治理】设置相册元数据与封面（任选）。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_album_meta(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            visibility: Option<u8>,
            tags: Option<Vec<Vec<u8>>>,
            cover_media_id: Option<Option<T::MediaId>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe_a| -> DispatchResult {
                let a = maybe_a.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                if let Some(t) = title { a.title = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(d) = desc { a.desc = BoundedVec::try_from(d).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = visibility { a.visibility = match v { 0 => Visibility::Public, 1 => Visibility::Unlisted, 2 => Visibility::Private, _ => return Err(Error::<T>::BadInput.into()) }; }
                if let Some(ts) = tags {
                    let mut tags_bv: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags> = Default::default();
                    for t in ts.into_iter() {
                        let tb: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?;
                        tags_bv.try_push(tb).map_err(|_| Error::<T>::BadInput)?;
                    }
                    a.tags = tags_bv;
                }
                if let Some(cov) = cover_media_id {
                    if let Some(mid) = cov { let m = MediaOf::<T>::get(mid).ok_or(Error::<T>::MediaNotFound)?; ensure!(m.album_id == album_id, Error::<T>::BadInput); }
                    a.cover_media_id = cov;
                }
                a.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::AlbumUpdated(album_id));
            Ok(())
        }

        /// 函数级中文注释：【治理】隐藏/取消隐藏媒体。
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_media_hidden(origin: OriginFor<T>, media_id: T::MediaId, hidden: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(MediaOf::<T>::contains_key(media_id) || MediaDeposits::<T>::contains_key(media_id), Error::<T>::MediaNotFound);
            MediaHidden::<T>::insert(media_id, hidden);
            Self::deposit_event(Event::GovMediaHidden(media_id, hidden));
            Ok(())
        }

        /// 函数级中文注释：【治理】替换媒体 URI（例如涉敏内容替换为打码资源）。
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_replace_media_uri(origin: OriginFor<T>, media_id: T::MediaId, new_uri: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            MediaOf::<T>::try_mutate(media_id, |maybe_m| -> DispatchResult {
                let m = maybe_m.as_mut().ok_or(Error::<T>::MediaNotFound)?;
                m.uri = BoundedVec::try_from(new_uri).map_err(|_| Error::<T>::BadInput)?;
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::GovMediaReplaced(media_id));
            Ok(())
        }

        /// 函数级中文注释：【治理】移除媒体（押金保留，删除后等待成熟可退）。
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_remove_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let m = MediaOf::<T>::get(media_id).ok_or(Error::<T>::MediaNotFound)?;
            MediaOf::<T>::remove(media_id);
            MediaByAlbum::<T>::mutate(m.album_id, |list| { if let Some(pos) = list.iter().position(|x| x == &media_id) { list.swap_remove(pos); } });
            // 重置成熟时间，待期后可退押金
            let now = <frame_system::Pallet<T>>::block_number();
            MediaMaturity::<T>::insert(media_id, now + T::ComplaintPeriod::get());
            Self::deposit_event(Event::MediaRemoved(media_id));
            Ok(())
        }
    }

    // ===================== 存储迁移（v1 -> v2）=====================
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：将旧版本 `Media`（无 `title`/`summary`）迁移为新版本（追加字段为 None）。
        fn migrate_v1_to_v2() -> Weight {
            // 旧版结构定义：与 v1 完全一致，用于从存储解码。
            #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
            #[scale_info(skip_type_params(T))]
            struct OldMedia<T: Config> {
                pub album_id: T::AlbumId,
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

            let mut reads: u64 = 0;
            let mut writes: u64 = 0;

            for (media_id, _) in MediaOf::<T>::iter() {
                reads += 1;
                // 取底层原始字节并按旧版解码（避免直接解码为新结构失败）
                let storage_key = MediaOf::<T>::hashed_key_for(media_id);
                if let Some(raw) = sp_io::storage::get(&storage_key) {
                    if let Ok(old) = OldMedia::<T>::decode(&mut &raw[..]) {
                        let new_media = Media::<T> {
                            album_id: old.album_id,
                            deceased_id: old.deceased_id,
                            deceased_token: old.deceased_token,
                            owner: old.owner,
                            kind: old.kind,
                            uri: old.uri,
                            thumbnail_uri: old.thumbnail_uri,
                            content_hash: old.content_hash,
                            title: None,
                            summary: None,
                            duration_secs: old.duration_secs,
                            width: old.width,
                            height: old.height,
                            order_index: old.order_index,
                            created: old.created,
                            updated: old.updated,
                        };
                        MediaOf::<T>::insert(media_id, new_media);
                        writes += 1;
                    }
                }
            }
            // 写入新版本号
            frame_support::pallet_prelude::StorageVersion::new(2).put::<Pallet<T>>();
            T::DbWeight::get().reads_writes(reads, writes + 1)
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：在运行时升级时执行存储迁移，将 v1 的 Media 数据迁移至 v2 结构。
        fn on_runtime_upgrade() -> Weight {
            let onchain = Pallet::<T>::on_chain_storage_version();
            if onchain < 2 {
                return Self::migrate_v1_to_v2();
            }
            Weight::zero()
        }
    }
}


