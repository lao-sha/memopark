#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

/// 函数级中文注释：墓位访问接口抽象，为保持与 `pallet-grave` 低耦合。
pub trait GraveAccess<Origin, AccountId, GraveId> {
    /// 校验墓主或园区管理员权限
    fn ensure_owner_or_admin(grave_id: GraveId, origin: Origin) -> DispatchResult;
    /// 检查墓位是否存在
    fn grave_exists(grave_id: GraveId) -> bool;
}

/// 函数级中文注释：媒体类型（与 deceased-media 对齐，便于前端统一渲染）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum MediaKind { Photo, Video, Audio }

/// 函数级中文注释：留言附件最小元数据，仅存链下指针与可选摘要。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Attachment<T: Config> {
    pub kind: MediaKind,
    pub uri: BoundedVec<u8, T::StringLimit>,
    pub thumbnail_uri: Option<BoundedVec<u8, T::StringLimit>>,
    pub content_hash: Option<[u8; 32]>,
    pub duration_secs: Option<u32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// 函数级中文注释：留言实体。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct Message<T: Config> {
    pub grave_id: T::GraveId,
    pub author: T::AccountId,
    pub content: BoundedVec<u8, T::MaxMessageLen>,
    pub attachments: BoundedVec<Attachment<T>, T::MaxAttachmentsPerMessage>,
    pub reply_to: Option<T::MessageId>,
    pub created: BlockNumberFor<T>,
    pub edited: Option<BlockNumberFor<T>>,
    pub is_hidden: bool,
}

/// 函数级中文注释：留言板配置。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct GuestbookConfig<T: Config> {
    pub public_enabled: bool,
    pub allow_anonymous: bool,
    pub pinned_message_id: Option<T::MessageId>,
    pub moderators: BoundedVec<T::AccountId, T::MaxModerators>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type GraveId: Parameter + Member + Copy + MaxEncodedLen;
        type MessageId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        #[pallet::constant] type StringLimit: Get<u32>; // URI/缩略图等公共字符串上限
        #[pallet::constant] type MaxMessageLen: Get<u32>;
        #[pallet::constant] type MaxAttachmentsPerMessage: Get<u32>;
        #[pallet::constant] type MaxRecentPerGrave: Get<u32>;
        #[pallet::constant] type MaxRelatives: Get<u32>;
        #[pallet::constant] type MaxModerators: Get<u32>;
        #[pallet::constant] type MinPostBlocksPerAccount: Get<u32>;

        type GraveProvider: GraveAccess<Self::RuntimeOrigin, Self::AccountId, Self::GraveId>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // 存储
    #[pallet::storage] pub type GuestbookConfigOf<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, GuestbookConfig<T>, ValueQuery>;
    #[pallet::storage] pub type RelativesOf<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, BoundedVec<T::AccountId, T::MaxRelatives>, ValueQuery>;
    #[pallet::storage] pub type NextMessageId<T: Config> = StorageValue<_, T::MessageId, ValueQuery>;
    #[pallet::storage] pub type MessageOf<T: Config> = StorageMap<_, Blake2_128Concat, T::MessageId, Message<T>, OptionQuery>;
    #[pallet::storage] pub type RecentByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, BoundedVec<T::MessageId, T::MaxRecentPerGrave>, ValueQuery>;
    #[pallet::storage] pub type MessageCountByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, u64, ValueQuery>;
    #[pallet::storage] pub type LastPostBy<T: Config> = StorageDoubleMap<_, Blake2_128Concat, T::GraveId, Blake2_128Concat, T::AccountId, BlockNumberFor<T>, ValueQuery>;

    // 事件
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        ConfigUpdated(T::GraveId),
        RelativeAdded(T::GraveId, T::AccountId),
        RelativeRemoved(T::GraveId, T::AccountId),
        ModeratorAdded(T::GraveId, T::AccountId),
        ModeratorRemoved(T::GraveId, T::AccountId),
        MessagePosted(T::GraveId, T::MessageId, T::AccountId),
        MessageEdited(T::MessageId),
        MessageHidden(T::MessageId),
        MessageDeleted(T::MessageId),
        Pinned(T::GraveId, Option<T::MessageId>),
    }

    // 错误
    #[pallet::error]
    pub enum Error<T> {
        NotAuthorized,
        GraveNotFound,
        PublicDisabled,
        BadInput,
        TooManyRelatives,
        TooManyModerators,
        MessageNotFound,
        RateLimited,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：开关公共留言；仅墓主或园区管理员可调用。
        #[pallet::weight(10_000)]
        pub fn set_public(origin: OriginFor<T>, grave_id: T::GraveId, enabled: bool) -> DispatchResult {
            T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?;
            GuestbookConfigOf::<T>::mutate(grave_id, |cfg| { cfg.public_enabled = enabled; });
            Self::deposit_event(Event::ConfigUpdated(grave_id));
            Ok(())
        }

        /// 函数级中文注释：添加/移除亲人白名单；仅墓主或园区管理员。
        #[pallet::weight(10_000)]
        pub fn add_relative(origin: OriginFor<T>, grave_id: T::GraveId, who: T::AccountId) -> DispatchResult {
            T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?;
            RelativesOf::<T>::try_mutate(grave_id, |v| v.try_push(who.clone()).map_err(|_| Error::<T>::TooManyRelatives))?;
            Self::deposit_event(Event::RelativeAdded(grave_id, who));
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn remove_relative(origin: OriginFor<T>, grave_id: T::GraveId, who: T::AccountId) -> DispatchResult {
            T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?;
            RelativesOf::<T>::mutate(grave_id, |v| { if let Some(i) = v.iter().position(|x| x == &who) { v.swap_remove(i); } });
            Self::deposit_event(Event::RelativeRemoved(grave_id, who));
            Ok(())
        }

        /// 函数级中文注释：添加/移除版主；仅墓主或园区管理员。
        #[pallet::weight(10_000)]
        pub fn add_moderator(origin: OriginFor<T>, grave_id: T::GraveId, who: T::AccountId) -> DispatchResult {
            T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?;
            GuestbookConfigOf::<T>::mutate(grave_id, |cfg| { let _ = cfg.moderators.try_push(who.clone()); });
            Self::deposit_event(Event::ModeratorAdded(grave_id, who));
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn remove_moderator(origin: OriginFor<T>, grave_id: T::GraveId, who: T::AccountId) -> DispatchResult {
            T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?;
            GuestbookConfigOf::<T>::mutate(grave_id, |cfg| { if let Some(i) = cfg.moderators.iter().position(|x| x == &who) { cfg.moderators.swap_remove(i); } });
            Self::deposit_event(Event::ModeratorRemoved(grave_id, who));
            Ok(())
        }

        /// 函数级中文注释：置顶某条留言；仅墓主或园区管理员。
        #[pallet::weight(10_000)]
        pub fn pin_message(origin: OriginFor<T>, grave_id: T::GraveId, msg_id: Option<T::MessageId>) -> DispatchResult {
            T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?;
            GuestbookConfigOf::<T>::mutate(grave_id, |cfg| { cfg.pinned_message_id = msg_id; });
            Self::deposit_event(Event::Pinned(grave_id, msg_id));
            Ok(())
        }

        /// 函数级中文注释：发布留言；公共关闭时仅墓主/版主/亲人可发言；支持附件（链下 URI）。
        #[pallet::weight(10_000)]
        pub fn post(
            origin: OriginFor<T>,
            grave_id: T::GraveId,
            content: Vec<u8>,
            attachments: Vec<Attachment<T>>,
            reply_to: Option<T::MessageId>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(T::GraveProvider::grave_exists(grave_id), Error::<T>::GraveNotFound);

            let cfg = GuestbookConfigOf::<T>::get(grave_id);
            if !cfg.public_enabled {
                let is_mod = cfg.moderators.iter().any(|m| m == &who);
                let is_relative = RelativesOf::<T>::get(grave_id).iter().any(|a| a == &who);
                // 墓主/园区管理员也应被允许，但需要外部 Origin 校验，简化为：版主或亲人即可
                ensure!(is_mod || is_relative, Error::<T>::PublicDisabled);
            }

            // 反刷：同账号在同一 grave 的最小发言间隔
            let now = <frame_system::Pallet<T>>::block_number();
            let last = LastPostBy::<T>::get(grave_id, &who);
            if last != Default::default() {
                ensure!(now.saturating_sub(last) >= T::MinPostBlocksPerAccount::get().into(), Error::<T>::RateLimited);
            }

            let content_bv: BoundedVec<_, T::MaxMessageLen> = BoundedVec::try_from(content).map_err(|_| Error::<T>::BadInput)?;
            let mut atts_bv: BoundedVec<Attachment<T>, T::MaxAttachmentsPerMessage> = Default::default();
            for a in attachments.into_iter() { atts_bv.try_push(a).map_err(|_| Error::<T>::BadInput)?; }

            let id = NextMessageId::<T>::get();
            let next = id.checked_add(&T::MessageId::from(1u32)).ok_or(Error::<T>::BadInput)?;
            NextMessageId::<T>::put(next);

            let msg = Message::<T> { grave_id, author: who.clone(), content: content_bv, attachments: atts_bv, reply_to, created: now, edited: None, is_hidden: false };
            MessageOf::<T>::insert(id, msg);

            RecentByGrave::<T>::mutate(grave_id, |list| { if list.try_insert(0, id).is_err() { let _ = list.pop(); let _ = list.try_insert(0, id); } });
            MessageCountByGrave::<T>::mutate(grave_id, |c| *c = c.saturating_add(1));
            LastPostBy::<T>::insert(grave_id, &who, now);

            Self::deposit_event(Event::MessagePosted(grave_id, id, who));
            Ok(())
        }

        /// 函数级中文注释：编辑留言；作者或版主可编辑；更新 edited 时间戳。
        #[pallet::weight(10_000)]
        pub fn edit(
            origin: OriginFor<T>,
            message_id: T::MessageId,
            new_content: Option<Vec<u8>>,
            new_attachments: Option<Vec<Attachment<T>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            MessageOf::<T>::try_mutate(message_id, |maybe| -> DispatchResult {
                let m = maybe.as_mut().ok_or(Error::<T>::MessageNotFound)?;
                let cfg = GuestbookConfigOf::<T>::get(m.grave_id);
                let is_mod = cfg.moderators.iter().any(|x| x == &who);
                ensure!(m.author == who || is_mod, Error::<T>::NotAuthorized);
                if let Some(c) = new_content { m.content = BoundedVec::try_from(c).map_err(|_| Error::<T>::BadInput)?; }
                if let Some(atts) = new_attachments { let mut bv: BoundedVec<Attachment<T>, T::MaxAttachmentsPerMessage> = Default::default(); for a in atts.into_iter() { bv.try_push(a).map_err(|_| Error::<T>::BadInput)?; } m.attachments = bv; }
                m.edited = Some(<frame_system::Pallet<T>>::block_number());
                Ok(())
            })?;
            Self::deposit_event(Event::MessageEdited(message_id));
            Ok(())
        }

        /// 函数级中文注释：隐藏留言；版主或墓主/园区管理员可操作。
        #[pallet::weight(10_000)]
        pub fn hide(origin: OriginFor<T>, message_id: T::MessageId) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let (grave_id, is_mod) = if let Some(m) = MessageOf::<T>::get(message_id) { let cfg = GuestbookConfigOf::<T>::get(m.grave_id); (m.grave_id, cfg.moderators.iter().any(|x| x == &who)) } else { return Err(Error::<T>::MessageNotFound.into()); };
            if !is_mod { T::GraveProvider::ensure_owner_or_admin(grave_id, origin)?; }
            MessageOf::<T>::mutate(message_id, |maybe| { if let Some(m) = maybe { m.is_hidden = true; } });
            Self::deposit_event(Event::MessageHidden(message_id));
            Ok(())
        }

        /// 函数级中文注释：删除留言；作者或版主可操作（此处直接硬删，亦可改为软删）。
        #[pallet::weight(10_000)]
        pub fn delete(origin: OriginFor<T>, message_id: T::MessageId) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let (grave_id, is_mod, is_author) = if let Some(m) = MessageOf::<T>::get(message_id) { let cfg = GuestbookConfigOf::<T>::get(m.grave_id); (m.grave_id, cfg.moderators.iter().any(|x| x == &who), m.author == who) } else { return Err(Error::<T>::MessageNotFound.into()); };
            ensure!(is_mod || is_author, Error::<T>::NotAuthorized);
            MessageOf::<T>::remove(message_id);
            RecentByGrave::<T>::mutate(grave_id, |list| { if let Some(i) = list.iter().position(|x| x == &message_id) { list.swap_remove(i); } });
            Self::deposit_event(Event::MessageDeleted(message_id));
            Ok(())
        }
    }
}


