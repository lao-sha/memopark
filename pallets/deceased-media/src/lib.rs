#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::AtLeast32BitUnsigned;

/// 函数级中文注释：访问 `pallet-deceased` 的抽象接口，保持低耦合。
/// - `deceased_exists`：校验逝者存在。
/// - `can_manage`：校验操作者是否被允许管理该逝者的相册与媒体（一般为 owner/授权者）。
pub trait DeceasedAccess<AccountId, DeceasedId> {
    fn deceased_exists(id: DeceasedId) -> bool;
    fn can_manage(who: &AccountId, deceased_id: DeceasedId) -> bool;
}

/// 函数级中文注释：媒体类型与可见性定义。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum MediaKind { Photo, Video, Audio }

#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum Visibility { Public, Unlisted, Private }

/// 函数级中文注释：相册结构体，记录逝者、拥有者与元数据（限长）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Album<T: Config> {
    pub deceased_id: T::DeceasedId,
    pub owner: T::AccountId,
    pub title: BoundedVec<u8, T::StringLimit>,
    pub desc: BoundedVec<u8, T::StringLimit>,
    pub visibility: Visibility,
    pub tags: BoundedVec<BoundedVec<u8, T::StringLimit>, T::MaxTags>,
    pub cover_media_id: Option<T::MediaId>,
    pub created: T::BlockNumber,
    pub updated: T::BlockNumber,
}

/// 函数级中文注释：媒体项结构体，仅保存外链/哈希等最小信息。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Media<T: Config> {
    pub album_id: T::AlbumId,
    pub deceased_id: T::DeceasedId,
    pub owner: T::AccountId,
    pub kind: MediaKind,
    pub uri: BoundedVec<u8, T::StringLimit>,
    pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
    pub content_hash: Option<[u8; 32]>,
    pub duration_secs: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub order_index: u32,
    pub created: T::BlockNumber,
    pub updated: T::BlockNumber,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type DeceasedId: Parameter + Member + Copy + MaxEncodedLen;
        type AlbumId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        type MediaId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        #[pallet::constant] type MaxAlbumsPerDeceased: Get<u32>;
        #[pallet::constant] type MaxMediaPerAlbum: Get<u32>;
        #[pallet::constant] type StringLimit: Get<u32>;
        #[pallet::constant] type MaxTags: Get<u32>;
        #[pallet::constant] type MaxReorderBatch: Get<u32>;

        type DeceasedProvider: DeceasedAccess<Self::AccountId, Self::DeceasedId>;
    }

    #[pallet::storage] pub type NextAlbumId<T: Config> = StorageValue<_, T::AlbumId, ValueQuery>;
    #[pallet::storage] pub type NextMediaId<T: Config> = StorageValue<_, T::MediaId, ValueQuery>;
    #[pallet::storage] pub type AlbumOf<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, Album<T>, OptionQuery>;
    #[pallet::storage] pub type MediaOf<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, Media<T>, OptionQuery>;
    #[pallet::storage] pub type AlbumsByDeceased<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, BoundedVec<T::AlbumId, T::MaxAlbumsPerDeceased>, ValueQuery>;
    #[pallet::storage] pub type MediaByAlbum<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, BoundedVec<T::MediaId, T::MaxMediaPerAlbum>, ValueQuery>;

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
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建相册；校验逝者存在与权限；限制标题/描述/标签长度数量。
        #[pallet::weight(10_000)]
        pub fn create_album(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            title: Vec<u8>,
            desc: Vec<u8>,
            visibility: Visibility,
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

            let id = NextAlbumId::<T>::get();
            let next = id.checked_add(&T::AlbumId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextAlbumId::<T>::put(next);

            let now = <frame_system::Pallet<T>>::block_number();
            let album = Album::<T> { deceased_id, owner: who.clone(), title: title_bv, desc: desc_bv, visibility, tags: tags_bv, cover_media_id: None, created: now, updated: now };

            AlbumOf::<T>::insert(id, album);
            AlbumsByDeceased::<T>::try_mutate(deceased_id, |list| list.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            Self::deposit_event(Event::AlbumCreated(id, deceased_id, who));
            Ok(())
        }

        /// 函数级中文注释：更新相册；仅 owner；可更新标题/描述/可见性/标签/封面。
        #[pallet::weight(10_000)]
        pub fn update_album(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            title: Option<Vec<u8>>,
            desc: Option<Vec<u8>>,
            visibility: Option<Visibility>,
            tags: Option<Vec<Vec<u8>>>,
            cover_media_id: Option<Option<T::MediaId>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            AlbumOf::<T>::try_mutate(album_id, |maybe_a| -> DispatchResult {
                let a = maybe_a.as_mut().ok_or(Error::<T>::AlbumNotFound)?;
                ensure!(a.owner == who, Error::<T>::NotAuthorized);
                if let Some(t) = title { a.title = BoundedVec::try_from(t).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(d) = desc { a.desc = BoundedVec::try_from(d).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(v) = visibility { a.visibility = v; }
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
        #[pallet::weight(10_000)]
        pub fn delete_album(origin: OriginFor<T>, album_id: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
            let medias = MediaByAlbum::<T>::get(album_id);
            ensure!(medias.is_empty(), Error::<T>::BadInput);
            AlbumOf::<T>::remove(album_id);
            AlbumsByDeceased::<T>::mutate(album.deceased_id, |list| { if let Some(pos) = list.iter().position(|x| x == &album_id) { list.swap_remove(pos); } });
            Self::deposit_event(Event::AlbumDeleted(album_id));
            Ok(())
        }

        /// 函数级中文注释：添加媒体项；仅相册 owner；限制 URI 长度；可设置排序号。
        #[pallet::weight(10_000)]
        pub fn add_media(
            origin: OriginFor<T>,
            album_id: T::AlbumId,
            kind: MediaKind,
            uri: Vec<u8>,
            thumbnail_uri: Option<Vec<u8>>,
            content_hash: Option<[u8;32]>,
            duration_secs: Option<u32>,
            width: Option<u32>,
            height: Option<u32>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);

            let uri_bv: BoundedVec<_, T::StringLimit> = BoundedVec::try_from(uri).map_err(|_| Error::<T>::BadInput)?;
            let thumb_bv = match thumbnail_uri { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None };

            // 轻量校验：不同媒体类型的可选字段基本合理性
            match kind {
                MediaKind::Photo => {
                    if let (Some(w), Some(h)) = (width, height) { ensure!(w > 0 && h > 0, Error::<T>::BadInput); }
                }
                MediaKind::Video | MediaKind::Audio => {
                    if let Some(d) = duration_secs { ensure!(d > 0, Error::<T>::BadInput); }
                }
            }

            let id = NextMediaId::<T>::get();
            let next = id.checked_add(&T::MediaId::from(1u32)).ok_or(Error::<T>::Overflow)?;
            NextMediaId::<T>::put(next);

            let mut list = MediaByAlbum::<T>::get(album_id);
            let ord = order_index.unwrap_or(list.len() as u32);
            let now = <frame_system::Pallet<T>>::block_number();
            let media = Media::<T> { album_id, deceased_id: album.deceased_id, owner: who.clone(), kind, uri: uri_bv, thumbnail_uri: thumb_bv, content_hash, duration_secs, width, height, order_index: ord, created: now, updated: now };

            MediaOf::<T>::insert(id, media);
            list.try_push(id).map_err(|_| Error::<T>::TooMany)?;
            MediaByAlbum::<T>::insert(album_id, list);
            Self::deposit_event(Event::MediaAdded(id, album_id));
            Ok(())
        }

        /// 函数级中文注释：更新媒体项；仅 owner；可改外链/哈希/尺寸/排序等。
        #[pallet::weight(10_000)]
        pub fn update_media(
            origin: OriginFor<T>,
            media_id: T::MediaId,
            uri: Option<Vec<u8>>,
            thumbnail_uri: Option<Option<Vec<u8>>>,
            content_hash: Option<Option<[u8;32]>>,
            duration_secs: Option<Option<u32>>,
            width: Option<Option<u32>>,
            height: Option<Option<u32>>,
            order_index: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            MediaOf::<T>::try_mutate(media_id, |maybe_m| -> DispatchResult {
                let m = maybe_m.as_mut().ok_or(Error::<T>::MediaNotFound)?;
                ensure!(m.owner == who, Error::<T>::NotAuthorized);
                if let Some(u) = uri { m.uri = BoundedVec::try_from(u).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(t) = thumbnail_uri { m.thumbnail_uri = match t { Some(v) => Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::BadInput)?), None => None }; }
                if let Some(h) = content_hash { m.content_hash = h; }
                if let Some(d) = duration_secs { 
                    // 对视频/音频：若提供时长则要求 > 0
                    if matches!(m.kind, MediaKind::Video | MediaKind::Audio) {
                        if let Some(val) = d { if let Some(x) = val { ensure!(x > 0, Error::<T>::BadInput); } }
                    }
                    m.duration_secs = d; 
                }
                if let Some(w) = width { 
                    if matches!(m.kind, MediaKind::Photo) { if let Some(x) = w { if let Some(xx) = x { ensure!(xx > 0, Error::<T>::BadInput); } } }
                    m.width = w; 
                }
                if let Some(hg) = height { 
                    if matches!(m.kind, MediaKind::Photo) { if let Some(x) = hg { if let Some(xx) = x { ensure!(xx > 0, Error::<T>::BadInput); } } }
                    m.height = hg; 
                }
                if let Some(ord) = order_index { m.order_index = ord; }
                m.updated = <frame_system::Pallet<T>>::block_number();
                Ok(())
            })?;
            Self::deposit_event(Event::MediaUpdated(media_id));
            Ok(())
        }

        /// 函数级中文注释：删除媒体项；仅 owner；从相册索引中同步移除。
        #[pallet::weight(10_000)]
        pub fn remove_media(origin: OriginFor<T>, media_id: T::MediaId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let m = MediaOf::<T>::get(media_id).ok_or(Error::<T>::MediaNotFound)?;
            ensure!(m.owner == who, Error::<T>::NotAuthorized);
            MediaOf::<T>::remove(media_id);
            MediaByAlbum::<T>::mutate(m.album_id, |list| { if let Some(pos) = list.iter().position(|x| x == &media_id) { list.swap_remove(pos); } });
            Self::deposit_event(Event::MediaRemoved(media_id));
            Ok(())
        }

        /// 函数级中文注释：移动媒体到其它相册；要求同一逝者；仅 owner。
        #[pallet::weight(10_000)]
        pub fn move_media(origin: OriginFor<T>, media_id: T::MediaId, to_album: T::AlbumId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let mut media = MediaOf::<T>::get(media_id).ok_or(Error::<T>::MediaNotFound)?;
            ensure!(media.owner == who, Error::<T>::NotAuthorized);
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
        #[pallet::weight(10_000)]
        pub fn reorder_album(origin: OriginFor<T>, album_id: T::AlbumId, ordered_media: Vec<T::MediaId>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let album = AlbumOf::<T>::get(album_id).ok_or(Error::<T>::AlbumNotFound)?;
            ensure!(album.owner == who, Error::<T>::NotAuthorized);
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
    }
}


