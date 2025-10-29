/// 函数级详细中文注释：示例pallet - 新pallet域自动PIN机制使用演示
/// 
/// 本pallet展示如何使用memo-ipfs的ContentRegistry trait：
/// - 一行代码完成内容注册和PIN
/// - 无需了解IPFS内部实现细节
/// - 自动处理域注册、扣费、副本管理
/// 
/// 使用场景示例：
/// - 视频pallet：上传逝者视频，自动PIN到IPFS
/// - NFT pallet：铸造NFT，自动PIN元数据和图片
/// - 文档pallet：保存重要文档，自动PIN到IPFS

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use pallet_stardust_ipfs::{ContentRegistry, PinTier};

    /// 函数级详细中文注释：Pallet配置接口
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// 函数级详细中文注释：内容注册器接口（连接memo-ipfs）
        /// 
        /// 在runtime配置中，绑定到PalletMemoIpfs：
        /// ```rust
        /// type ContentRegistry = PalletMemoIpfs;
        /// ```
        type ContentRegistry: ContentRegistry;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级详细中文注释：视频信息结构体
    /// 
    /// 记录上传的视频基本信息
    #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct VideoInfo<AccountId, BlockNumber> {
        /// 视频所有者
        pub owner: AccountId,
        /// 视频标题
        pub title: BoundedVec<u8, ConstU32<128>>,
        /// IPFS CID
        pub cid: BoundedVec<u8, ConstU32<128>>,
        /// Pin等级
        pub tier: PinTier,
        /// 上传时间
        pub uploaded_at: BlockNumber,
    }

    /// 函数级详细中文注释：视频存储
    /// 
    /// 存储所有上传的视频信息
    #[pallet::storage]
    pub type Videos<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // video_id
        VideoInfo<T::AccountId, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：视频计数器
    #[pallet::storage]
    pub type VideoCounter<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：事件
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级详细中文注释：视频已上传并自动PIN
        /// 
        /// 参数：
        /// - video_id：视频ID
        /// - owner：上传者
        /// - cid：IPFS CID
        /// - tier：Pin等级
        VideoUploadedAndPinned {
            video_id: u64,
            owner: T::AccountId,
            cid: BoundedVec<u8, ConstU32<128>>,
            tier: PinTier,
        },
        
        /// 函数级详细中文注释：视频已删除
        VideoDeleted {
            video_id: u64,
        },
    }

    /// 函数级详细中文注释：错误类型
    #[pallet::error]
    pub enum Error<T> {
        /// 视频不存在
        VideoNotFound,
        /// 无权限（不是所有者）
        NotOwner,
        /// 标题太长
        TitleTooLong,
        /// CID无效
        InvalidCid,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：上传视频（自动PIN到IPFS）
        /// 
        /// 功能：
        /// 1. 保存视频信息
        /// 2. 自动调用ContentRegistry注册内容
        /// 3. 自动PIN到IPFS（三层扣费）
        /// 
        /// 参数：
        /// - title：视频标题
        /// - cid：IPFS CID（已上传到IPFS）
        /// - tier：Pin等级（Critical/Standard/Temporary）
        /// 
        /// 示例：
        /// ```javascript
        /// api.tx.exampleDomainPin.uploadVideo(
        ///   "逝者生前视频-2024春节",
        ///   "QmXxx...",
        ///   { Standard: null }
        /// );
        /// ```
        #[pallet::call_index(0)]
        #[pallet::weight(100_000)]
        pub fn upload_video(
            origin: OriginFor<T>,
            title: Vec<u8>,
            cid: Vec<u8>,
            tier: PinTier,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 1. 验证参数
            let bounded_title: BoundedVec<u8, ConstU32<128>> = title
                .try_into()
                .map_err(|_| Error::<T>::TitleTooLong)?;
            let bounded_cid: BoundedVec<u8, ConstU32<128>> = cid
                .clone()
                .try_into()
                .map_err(|_| Error::<T>::InvalidCid)?;
            
            // 2. 生成video_id
            let video_id = VideoCounter::<T>::get();
            let next_video_id = video_id.checked_add(1).ok_or(ArithmeticError::Overflow)?;
            
            // 3. ⭐ 关键：一行代码完成内容注册和PIN ⭐
            T::ContentRegistry::register_content(
                b"deceased-video".to_vec(),  // 域名：逝者视频
                video_id,                    // 主体ID
                cid,                         // IPFS CID
                tier.clone(),                // Pin等级
            )?;
            
            // 4. 保存视频信息
            let video_info = VideoInfo {
                owner: who.clone(),
                title: bounded_title,
                cid: bounded_cid.clone(),
                tier: tier.clone(),
                uploaded_at: frame_system::Pallet::<T>::block_number(),
            };
            Videos::<T>::insert(video_id, video_info);
            VideoCounter::<T>::put(next_video_id);
            
            // 5. 发送事件
            Self::deposit_event(Event::VideoUploadedAndPinned {
                video_id,
                owner: who,
                cid: bounded_cid,
                tier,
            });
            
            Ok(())
        }
        
        /// 函数级详细中文注释：删除视频
        /// 
        /// 功能：
        /// - 仅删除链上记录
        /// - IPFS内容保持PIN（需要手动unpin）
        /// 
        /// 权限：
        /// - 仅视频所有者
        #[pallet::call_index(1)]
        #[pallet::weight(50_000)]
        pub fn delete_video(
            origin: OriginFor<T>,
            video_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 1. 检查视频是否存在
            let video = Videos::<T>::get(video_id)
                .ok_or(Error::<T>::VideoNotFound)?;
            
            // 2. 检查权限
            ensure!(video.owner == who, Error::<T>::NotOwner);
            
            // 3. 删除视频
            Videos::<T>::remove(video_id);
            
            // 4. 发送事件
            Self::deposit_event(Event::VideoDeleted { video_id });
            
            Ok(())
        }
    }
}

