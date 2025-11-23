// 函数级详细中文注释：公共媒体库Pallet
//
// 本Pallet实现了统一的公共媒体库（音频+视频）管理系统，核心功能包括：
// 1. 媒体管理：增删改查公共音频/视频
// 2. 分类管理：按媒体类型、情绪、场景、文化分类
// 3. 应用域管理：媒体分类与纪念场景的关联
// 4. 权限控制：Root/治理委员会管理
// 5. 状态控制：启用/禁用媒体
// 6. 智能推荐：根据应用域场景自动推荐合适媒体

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;
pub mod types;
mod helpers;

// Re-export non-Config types from types module
pub use types::{MediaDomain, AudioCategory, VideoCategory, VideoQuality, MediaStats};

use frame_support::pallet_prelude::Weight;

#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::pallet_prelude::*;
	use frame_system::pallet_prelude::*;
	use sp_runtime::traits::UniqueSaturatedInto;

	// Import types from types module
	use crate::types::{MediaDomain, AudioCategory, VideoCategory, VideoQuality, MediaStats};

	// Define Config-dependent types here inside pallet module
	/// 音频媒体条目
	#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	#[codec(mel_bound(T: Config))]
	pub struct AudioMediaEntry<T: Config> {
		/// 媒体ID
		pub id: u32,
		/// 音频名称
		pub name: BoundedVec<u8, T::StringLimit>,
		/// 音频CID（IPFS）
		pub audio_cid: BoundedVec<u8, T::CidLimit>,
		/// 封面图CID（可选）
		pub cover_cid: Option<BoundedVec<u8, T::CidLimit>>,
		/// 时长（秒）
		pub duration: u32,
		/// 音频分类
		pub category: AudioCategory,
		/// 是否启用
		pub enabled: bool,
		/// 创建者（Root/治理委员会）
		pub creator: T::AccountId,
		/// 创建时间
		pub created_at: u32,
		/// 更新时间
		pub updated_at: u32,
	}

	/// 视频媒体条目
	#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	#[codec(mel_bound(T: Config))]
	pub struct VideoMediaEntry<T: Config> {
		/// 媒体ID
		pub id: u32,
		/// 视频名称
		pub name: BoundedVec<u8, T::StringLimit>,
		/// 视频CID（IPFS）
		pub video_cid: BoundedVec<u8, T::CidLimit>,
		/// 封面图CID（可选）
		pub cover_cid: Option<BoundedVec<u8, T::CidLimit>>,
		/// 时长（秒）
		pub duration: u32,
		/// 视频分类
		pub category: VideoCategory,
		/// 视频分辨率
		pub quality: VideoQuality,
		/// 字幕CID（可选，多语言）
		pub subtitle_cid: Option<BoundedVec<u8, T::CidLimit>>,
		/// 是否启用
		pub enabled: bool,
		/// 创建者（Root/治理委员会）
		pub creator: T::AccountId,
		/// 创建时间
		pub created_at: u32,
		/// 更新时间
		pub updated_at: u32,
	}

	/// 分类配置（音频）
	#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	#[codec(mel_bound(T: Config))]
	pub struct AudioCategoryConfig<T: Config> {
		/// 分类类型
		pub category: AudioCategory,
		/// 适用的应用域列表（最多100个域）
		pub applicable_domains: BoundedVec<MediaDomain, ConstU32<100>>,
		/// 分类名称
		pub name: BoundedVec<u8, T::StringLimit>,
		/// 分类描述
		pub description: BoundedVec<u8, T::StringLimit>,
	}

	/// 分类配置（视频）
	#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	#[codec(mel_bound(T: Config))]
	pub struct VideoCategoryConfig<T: Config> {
		/// 分类类型
		pub category: VideoCategory,
		/// 适用的应用域列表（最多100个域）
		pub applicable_domains: BoundedVec<MediaDomain, ConstU32<100>>,
		/// 分类名称
		pub name: BoundedVec<u8, T::StringLimit>,
		/// 分类描述
		pub description: BoundedVec<u8, T::StringLimit>,
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// 函数级详细中文注释：Pallet配置trait
	///
	/// 定义Pallet的配置参数：
	/// - RuntimeEvent: 事件类型
	/// - StringLimit: 字符串长度限制
	/// - CidLimit: IPFS CID长度限制
	/// - AdminOrigin: 管理员权限（Root或治理委员会）
	/// - WeightInfo: 权重信息（性能计量）
	#[pallet::config]
	pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
		/// 字符串长度限制
		#[pallet::constant]
		type StringLimit: Get<u32>;

		/// CID长度限制
		#[pallet::constant]
		type CidLimit: Get<u32>;

		/// 管理员权限（Root或治理委员会）
		type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// 权重信息
		type WeightInfo: WeightInfo;
	}

	/// 函数级详细中文注释：音频媒体库主存储
	///
	/// 存储所有音频条目
	/// Key: 音频ID (u32)
	/// Value: 音频条目 (AudioMediaEntry)
	#[pallet::storage]
	#[pallet::getter(fn audio_library)]
	pub type AudioLibrary<T: Config> =
		StorageMap<_, Blake2_128Concat, u32, AudioMediaEntry<T>>;

	/// 函数级详细中文注释：视频媒体库主存储
	///
	/// 存储所有视频条目
	/// Key: 视频ID (u32)
	/// Value: 视频条目 (VideoMediaEntry)
	#[pallet::storage]
	#[pallet::getter(fn video_library)]
	pub type VideoLibrary<T: Config> =
		StorageMap<_, Blake2_128Concat, u32, VideoMediaEntry<T>>;

	/// 函数级详细中文注释：下一个音频ID
	///
	/// 自增ID生成器，确保每个音频有唯一ID
	#[pallet::storage]
	#[pallet::getter(fn next_audio_id)]
	pub type NextAudioId<T: Config> = StorageValue<_, u32, ValueQuery>;

	/// 函数级详细中文注释：下一个视频ID
	///
	/// 自增ID生成器，确保每个视频有唯一ID
	#[pallet::storage]
	#[pallet::getter(fn next_video_id)]
	pub type NextVideoId<T: Config> = StorageValue<_, u32, ValueQuery>;

	/// 函数级详细中文注释：按音频分类索引
	///
	/// 快速查询指定分类的所有音频
	/// Key: 音频分类 (AudioCategory)
	/// Value: 音频ID列表（最多200000个）
	#[pallet::storage]
	#[pallet::getter(fn audio_by_category)]
	pub type AudioByCategory<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		AudioCategory,
		BoundedVec<u32, ConstU32<200000>>,
		ValueQuery,
	>;

	/// 函数级详细中文注释：按视频分类索引
	///
	/// 快速查询指定分类的所有视频
	/// Key: 视频分类 (VideoCategory)
	/// Value: 视频ID列表（最多200000个）
	#[pallet::storage]
	#[pallet::getter(fn video_by_category)]
	pub type VideoByCategory<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		VideoCategory,
		BoundedVec<u32, ConstU32<200000>>,
		ValueQuery,
	>;

	/// 函数级详细中文注释：启用的音频索引
	///
	/// 快速查询所有已启用的音频
	/// Value: 音频ID列表（最多200000个）
	#[pallet::storage]
	pub type EnabledAudioIds<T: Config> = StorageValue<_, BoundedVec<u32, ConstU32<200000>>, ValueQuery>;

	/// 函数级详细中文注释：启用的视频索引
	///
	/// 快速查询所有已启用的视频
	/// Value: 视频ID列表（最多200000个）
	#[pallet::storage]
	pub type EnabledVideoIds<T: Config> = StorageValue<_, BoundedVec<u32, ConstU32<200000>>, ValueQuery>;

	/// 函数级详细中文注释：音频分类配置
	///
	/// 存储音频分类与应用域的映射关系
	/// Key: 音频分类
	/// Value: 分类配置（包含适用域、名称、描述）
	#[pallet::storage]
	#[pallet::getter(fn audio_category_config)]
	pub type AudioCategoryConfigs<T: Config> =
		StorageMap<_, Blake2_128Concat, AudioCategory, AudioCategoryConfig<T>>;

	/// 函数级详细中文注释：视频分类配置
	///
	/// 存储视频分类与应用域的映射关系
	/// Key: 视频分类
	/// Value: 分类配置（包含适用域、名称、描述）
	#[pallet::storage]
	#[pallet::getter(fn video_category_config)]
	pub type VideoCategoryConfigs<T: Config> =
		StorageMap<_, Blake2_128Concat, VideoCategory, VideoCategoryConfig<T>>;

	/// 函数级详细中文注释：应用域到音频分类的反向索引
	///
	/// 快速查询指定应用域可用的音频分类
	/// Key: 应用域
	/// Value: 音频分类列表（最多20个分类）
	#[pallet::storage]
	#[pallet::getter(fn audio_by_domain)]
	pub type AudioCategoriesByDomain<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		MediaDomain,
		BoundedVec<AudioCategory, ConstU32<20>>,
		ValueQuery,
	>;

	/// 函数级详细中文注释：应用域到视频分类的反向索引
	///
	/// 快速查询指定应用域可用的视频分类
	/// Key: 应用域
	/// Value: 视频分类列表（最多20个分类）
	#[pallet::storage]
	#[pallet::getter(fn video_by_domain)]
	pub type VideoCategoriesByDomain<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		MediaDomain,
		BoundedVec<VideoCategory, ConstU32<20>>,
		ValueQuery,
	>;

	/// 函数级详细中文注释：媒体统计（Phase 2可选）
	///
	/// 记录每个媒体的播放次数、点赞数等统计信息
	/// Key: 媒体ID
	/// Value: 统计数据
	#[pallet::storage]
	pub type MediaStatsOf<T: Config> =
		StorageMap<_, Blake2_128Concat, u32, MediaStats, ValueQuery>;

	/// 函数级详细中文注释：Genesis配置
	///
	/// 初始化时预设分类与应用域的映射关系
	#[pallet::genesis_config]
	#[derive(frame_support::DefaultNoBound)]
	pub struct GenesisConfig<T: Config> {
		/// 音频分类配置列表
		/// (分类, 应用域列表, 名称, 描述)
		pub audio_configs: Vec<(AudioCategory, Vec<MediaDomain>, Vec<u8>, Vec<u8>)>,
		/// 视频分类配置列表
		/// (分类, 应用域列表, 名称, 描述)
		pub video_configs: Vec<(VideoCategory, Vec<MediaDomain>, Vec<u8>, Vec<u8>)>,
		#[serde(skip)]
		pub _phantom: core::marker::PhantomData<T>,
	}

	#[pallet::genesis_build]
	impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
		fn build(&self) {
			// 初始化音频分类配置
			for (category, domains, name, desc) in &self.audio_configs {
				let config = AudioCategoryConfig {
					category: *category,
					applicable_domains: domains.clone().try_into().expect("域列表过长"),
					name: name.clone().try_into().expect("名称过长"),
					description: desc.clone().try_into().expect("描述过长"),
				};
				AudioCategoryConfigs::<T>::insert(category, config);

				// 建立反向索引
				for domain in domains {
					AudioCategoriesByDomain::<T>::mutate(domain, |cats| {
						cats.try_push(*category).ok();
					});
				}
			}

			// 初始化视频分类配置
			for (category, domains, name, desc) in &self.video_configs {
				let config = VideoCategoryConfig {
					category: *category,
					applicable_domains: domains.clone().try_into().expect("域列表过长"),
					name: name.clone().try_into().expect("名称过长"),
					description: desc.clone().try_into().expect("描述过长"),
				};
				VideoCategoryConfigs::<T>::insert(category, config);

				// 建立反向索引
				for domain in domains {
					VideoCategoriesByDomain::<T>::mutate(domain, |cats| {
						cats.try_push(*category).ok();
					});
				}
			}
		}
	}

	/// 函数级详细中文注释：事件定义
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 音频已添加 (audio_id, category)
		AudioAdded(u32, AudioCategory),
		/// 视频已添加 (video_id, category)
		VideoAdded(u32, VideoCategory),
		/// 音频已更新 (audio_id)
		AudioUpdated(u32),
		/// 视频已更新 (video_id)
		VideoUpdated(u32),
		/// 音频状态已变更 (audio_id, enabled)
		AudioStatusChanged(u32, bool),
		/// 视频状态已变更 (video_id, enabled)
		VideoStatusChanged(u32, bool),
		/// 音频已删除（软删除）(audio_id)
		AudioRemoved(u32),
		/// 视频已删除（软删除）(video_id)
		VideoRemoved(u32),
		/// 音频已播放（Phase 2）(audio_id)
		AudioPlayed(u32),
		/// 视频已播放（Phase 2）(video_id)
		VideoPlayed(u32),
		/// 音频分类配置已更新 (category)
		AudioCategoryConfigUpdated(AudioCategory),
		/// 视频分类配置已更新 (category)
		VideoCategoryConfigUpdated(VideoCategory),
	}

	/// 函数级详细中文注释：错误定义
	#[pallet::error]
	pub enum Error<T> {
		/// 音频不存在
		AudioNotFound,
		/// 视频不存在
		VideoNotFound,
		/// 媒体名称为空
		EmptyName,
		/// 媒体名称过长
		NameTooLong,
		/// CID过长
		CidTooLong,
		/// 时长无效（必须>0）
		InvalidDuration,
		/// 媒体库已满（音频或视频最多200000个）
		MediaLibraryFull,
		/// 分类配置不存在
		CategoryConfigNotFound,
		/// 描述过长
		DescriptionTooLong,
		/// 分类不适用于指定应用域
		CategoryNotApplicableForDomain,
	}

	/// Hooks
	#[pallet::hooks]
	impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {}

	/// 函数级详细中文注释：可调用函数（Extrinsics）
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 函数级详细中文注释：添加公共音频
		///
		/// 权限：仅管理员（Root或治理委员会）
		///
		/// 参数：
		/// - name: 音频名称
		/// - audio_cid: 音频IPFS CID
		/// - cover_cid: 封面图CID（可选）
		/// - duration: 时长（秒）
		/// - category: 音频分类
		///
		/// 流程：
		/// 1. 验证管理员权限
		/// 2. 验证参数有效性
		/// 3. 创建音频条目
		/// 4. 存储并更新索引
		/// 5. 触发事件
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::add_audio())]
		pub fn add_audio(
			origin: OriginFor<T>,
			name: Vec<u8>,
			audio_cid: Vec<u8>,
			cover_cid: Option<Vec<u8>>,
			duration: u32,
			category: AudioCategory,
		) -> DispatchResult {
			// 1. 验证管理员权限
			T::AdminOrigin::ensure_origin(origin.clone())?;
			let creator = ensure_signed(origin)?;

			// 2. 验证参数
			ensure!(duration > 0, Error::<T>::InvalidDuration);
			ensure!(!name.is_empty(), Error::<T>::EmptyName);

			// 3. 转换为 BoundedVec
			let name_bounded: BoundedVec<u8, T::StringLimit> =
				name.try_into().map_err(|_| Error::<T>::NameTooLong)?;
			let audio_cid_bounded: BoundedVec<u8, T::CidLimit> =
				audio_cid.try_into().map_err(|_| Error::<T>::CidTooLong)?;
			let cover_cid_bounded = cover_cid
				.map(|cid| cid.try_into())
				.transpose()
				.map_err(|_| Error::<T>::CidTooLong)?;

			// 4. 创建音频条目
			let audio_id = NextAudioId::<T>::get();
			let now = <frame_system::Pallet<T>>::block_number().unique_saturated_into();

			let entry = AudioMediaEntry {
				id: audio_id,
				name: name_bounded,
				audio_cid: audio_cid_bounded,
				cover_cid: cover_cid_bounded,
				duration,
				category,
				enabled: true,
				creator,
				created_at: now,
				updated_at: now,
			};

			// 5. 存储
			AudioLibrary::<T>::insert(audio_id, entry);
			NextAudioId::<T>::put(audio_id.saturating_add(1));

			// 6. 更新索引
			AudioByCategory::<T>::try_mutate(category, |ids| -> Result<(), Error<T>> {
				ids.try_push(audio_id).map_err(|_| Error::<T>::MediaLibraryFull)?;
				Ok(())
			})?;

			EnabledAudioIds::<T>::try_mutate(|ids| -> Result<(), Error<T>> {
				ids.try_push(audio_id).map_err(|_| Error::<T>::MediaLibraryFull)?;
				Ok(())
			})?;

			// 7. 触发事件
			Self::deposit_event(Event::AudioAdded(audio_id, category));

			Ok(())
		}

		/// 函数级详细中文注释：添加公共视频
		///
		/// 权限：仅管理员（Root或治理委员会）
		///
		/// 参数：
		/// - name: 视频名称
		/// - video_cid: 视频IPFS CID
		/// - cover_cid: 封面图CID（可选）
		/// - duration: 时长（秒）
		/// - category: 视频分类
		/// - quality: 视频分辨率
		/// - subtitle_cid: 字幕CID（可选）
		///
		/// 流程：
		/// 1. 验证管理员权限
		/// 2. 验证参数有效性
		/// 3. 创建视频条目
		/// 4. 存储并更新索引
		/// 5. 触发事件
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::add_video())]
		pub fn add_video(
			origin: OriginFor<T>,
			name: Vec<u8>,
			video_cid: Vec<u8>,
			cover_cid: Option<Vec<u8>>,
			duration: u32,
			category: VideoCategory,
			quality: VideoQuality,
			subtitle_cid: Option<Vec<u8>>,
		) -> DispatchResult {
			// 1. 验证管理员权限
			T::AdminOrigin::ensure_origin(origin.clone())?;
			let creator = ensure_signed(origin)?;

			// 2. 验证参数
			ensure!(duration > 0, Error::<T>::InvalidDuration);
			ensure!(!name.is_empty(), Error::<T>::EmptyName);

			// 3. 转换为 BoundedVec
			let name_bounded: BoundedVec<u8, T::StringLimit> =
				name.try_into().map_err(|_| Error::<T>::NameTooLong)?;
			let video_cid_bounded: BoundedVec<u8, T::CidLimit> =
				video_cid.try_into().map_err(|_| Error::<T>::CidTooLong)?;
			let cover_cid_bounded = cover_cid
				.map(|cid| cid.try_into())
				.transpose()
				.map_err(|_| Error::<T>::CidTooLong)?;
			let subtitle_cid_bounded = subtitle_cid
				.map(|cid| cid.try_into())
				.transpose()
				.map_err(|_| Error::<T>::CidTooLong)?;

			// 4. 创建视频条目
			let video_id = NextVideoId::<T>::get();
			let now = <frame_system::Pallet<T>>::block_number().unique_saturated_into();

			let entry = VideoMediaEntry {
				id: video_id,
				name: name_bounded,
				video_cid: video_cid_bounded,
				cover_cid: cover_cid_bounded,
				duration,
				category,
				quality,
				subtitle_cid: subtitle_cid_bounded,
				enabled: true,
				creator,
				created_at: now,
				updated_at: now,
			};

			// 5. 存储
			VideoLibrary::<T>::insert(video_id, entry);
			NextVideoId::<T>::put(video_id.saturating_add(1));

			// 6. 更新索引
			VideoByCategory::<T>::try_mutate(category, |ids| -> Result<(), Error<T>> {
				ids.try_push(video_id).map_err(|_| Error::<T>::MediaLibraryFull)?;
				Ok(())
			})?;

			EnabledVideoIds::<T>::try_mutate(|ids| -> Result<(), Error<T>> {
				ids.try_push(video_id).map_err(|_| Error::<T>::MediaLibraryFull)?;
				Ok(())
			})?;

			// 7. 触发事件
			Self::deposit_event(Event::VideoAdded(video_id, category));

			Ok(())
		}

		/// 函数级详细中文注释：更新音频信息
		///
		/// 权限：仅管理员
		///
		/// 参数：
		/// - audio_id: 音频ID
		/// - name: 新名称（可选）
		/// - cover_cid: 新封面图（可选）
		/// - duration: 新时长（可选）
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::update_audio())]
		pub fn update_audio(
			origin: OriginFor<T>,
			audio_id: u32,
			name: Option<Vec<u8>>,
			cover_cid: Option<Vec<u8>>,
			duration: Option<u32>,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			AudioLibrary::<T>::try_mutate(audio_id, |entry| {
				let e = entry.as_mut().ok_or(Error::<T>::AudioNotFound)?;

				if let Some(n) = name {
					e.name = n.try_into().map_err(|_| Error::<T>::NameTooLong)?;
				}
				if let Some(cid) = cover_cid {
					e.cover_cid = Some(cid.try_into().map_err(|_| Error::<T>::CidTooLong)?);
				}
				if let Some(d) = duration {
					ensure!(d > 0, Error::<T>::InvalidDuration);
					e.duration = d;
				}

				e.updated_at = <frame_system::Pallet<T>>::block_number().unique_saturated_into();

				Self::deposit_event(Event::AudioUpdated(audio_id));
				Ok(())
			})
		}

		/// 函数级详细中文注释：更新视频信息
		///
		/// 权限：仅管理员
		///
		/// 参数：
		/// - video_id: 视频ID
		/// - name: 新名称（可选）
		/// - cover_cid: 新封面图（可选）
		/// - duration: 新时长（可选）
		/// - subtitle_cid: 新字幕（可选）
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::update_video())]
		pub fn update_video(
			origin: OriginFor<T>,
			video_id: u32,
			name: Option<Vec<u8>>,
			cover_cid: Option<Vec<u8>>,
			duration: Option<u32>,
			subtitle_cid: Option<Vec<u8>>,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			VideoLibrary::<T>::try_mutate(video_id, |entry| {
				let e = entry.as_mut().ok_or(Error::<T>::VideoNotFound)?;

				if let Some(n) = name {
					e.name = n.try_into().map_err(|_| Error::<T>::NameTooLong)?;
				}
				if let Some(cid) = cover_cid {
					e.cover_cid = Some(cid.try_into().map_err(|_| Error::<T>::CidTooLong)?);
				}
				if let Some(d) = duration {
					ensure!(d > 0, Error::<T>::InvalidDuration);
					e.duration = d;
				}
				if let Some(sub_cid) = subtitle_cid {
					e.subtitle_cid = Some(sub_cid.try_into().map_err(|_| Error::<T>::CidTooLong)?);
				}

				e.updated_at = <frame_system::Pallet<T>>::block_number().unique_saturated_into();

				Self::deposit_event(Event::VideoUpdated(video_id));
				Ok(())
			})
		}

		/// 函数级详细中文注释：设置音频状态
		///
		/// 启用或禁用音频
		///
		/// 权限：仅管理员
		#[pallet::call_index(4)]
		#[pallet::weight(T::WeightInfo::set_audio_status())]
		pub fn set_audio_status(
			origin: OriginFor<T>,
			audio_id: u32,
			enabled: bool,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			AudioLibrary::<T>::try_mutate(audio_id, |entry| {
				let e = entry.as_mut().ok_or(Error::<T>::AudioNotFound)?;
				e.enabled = enabled;
				e.updated_at = <frame_system::Pallet<T>>::block_number().unique_saturated_into();

				// 更新启用索引
				if enabled {
					EnabledAudioIds::<T>::try_mutate(|ids| -> Result<(), Error<T>> {
						if !ids.contains(&audio_id) {
							ids.try_push(audio_id).map_err(|_| Error::<T>::MediaLibraryFull)?;
						}
						Ok(())
					})?;
				} else {
					EnabledAudioIds::<T>::mutate(|ids| {
						ids.retain(|&id| id != audio_id);
					});
				}

				Self::deposit_event(Event::AudioStatusChanged(audio_id, enabled));
				Ok(())
			})
		}

		/// 函数级详细中文注释：设置视频状态
		///
		/// 启用或禁用视频
		///
		/// 权限：仅管理员
		#[pallet::call_index(5)]
		#[pallet::weight(T::WeightInfo::set_video_status())]
		pub fn set_video_status(
			origin: OriginFor<T>,
			video_id: u32,
			enabled: bool,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			VideoLibrary::<T>::try_mutate(video_id, |entry| {
				let e = entry.as_mut().ok_or(Error::<T>::VideoNotFound)?;
				e.enabled = enabled;
				e.updated_at = <frame_system::Pallet<T>>::block_number().unique_saturated_into();

				// 更新启用索引
				if enabled {
					EnabledVideoIds::<T>::try_mutate(|ids| -> Result<(), Error<T>> {
						if !ids.contains(&video_id) {
							ids.try_push(video_id).map_err(|_| Error::<T>::MediaLibraryFull)?;
						}
						Ok(())
					})?;
				} else {
					EnabledVideoIds::<T>::mutate(|ids| {
						ids.retain(|&id| id != video_id);
					});
				}

				Self::deposit_event(Event::VideoStatusChanged(video_id, enabled));
				Ok(())
			})
		}

		/// 函数级详细中文注释：删除音频
		///
		/// 软删除：仅禁用，保留记录
		///
		/// 权限：仅管理员
		#[pallet::call_index(6)]
		#[pallet::weight(T::WeightInfo::remove_audio())]
		pub fn remove_audio(origin: OriginFor<T>, audio_id: u32) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin.clone())?;

			// 软删除：仅禁用
			Self::set_audio_status(origin, audio_id, false)?;

			Self::deposit_event(Event::AudioRemoved(audio_id));
			Ok(())
		}

		/// 函数级详细中文注释：删除视频
		///
		/// 软删除：仅禁用，保留记录
		///
		/// 权限：仅管理员
		#[pallet::call_index(7)]
		#[pallet::weight(T::WeightInfo::remove_video())]
		pub fn remove_video(origin: OriginFor<T>, video_id: u32) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin.clone())?;

			// 软删除：仅禁用
			Self::set_video_status(origin, video_id, false)?;

			Self::deposit_event(Event::VideoRemoved(video_id));
			Ok(())
		}

		/// 函数级详细中文注释：记录音频播放次数（Phase 2可选）
		///
		/// 任何人都可以调用，用于统计音频播放情况
		#[pallet::call_index(8)]
		#[pallet::weight(T::WeightInfo::record_audio_play())]
		pub fn record_audio_play(origin: OriginFor<T>, audio_id: u32) -> DispatchResult {
			ensure_signed(origin)?;

			ensure!(AudioLibrary::<T>::contains_key(audio_id), Error::<T>::AudioNotFound);

			MediaStatsOf::<T>::mutate(audio_id, |stats| {
				stats.play_count = stats.play_count.saturating_add(1);
				stats.last_played_at = Some(
					<frame_system::Pallet<T>>::block_number()
						.unique_saturated_into(),
				);
			});

			Self::deposit_event(Event::AudioPlayed(audio_id));
			Ok(())
		}

		/// 函数级详细中文注释：记录视频播放次数（Phase 2可选）
		///
		/// 任何人都可以调用，用于统计视频播放情况
		#[pallet::call_index(9)]
		#[pallet::weight(T::WeightInfo::record_video_play())]
		pub fn record_video_play(origin: OriginFor<T>, video_id: u32) -> DispatchResult {
			ensure_signed(origin)?;

			ensure!(VideoLibrary::<T>::contains_key(video_id), Error::<T>::VideoNotFound);

			MediaStatsOf::<T>::mutate(video_id, |stats| {
				stats.play_count = stats.play_count.saturating_add(1);
				stats.last_played_at = Some(
					<frame_system::Pallet<T>>::block_number()
						.unique_saturated_into(),
				);
			});

			Self::deposit_event(Event::VideoPlayed(video_id));
			Ok(())
		}

		/// 函数级详细中文注释：更新音频分类配置
		///
		/// 治理功能：更新分类的应用域映射
		///
		/// 权限：仅管理员
		#[pallet::call_index(10)]
		#[pallet::weight(T::WeightInfo::update_category_config())]
		pub fn update_audio_category_config(
			origin: OriginFor<T>,
			category: AudioCategory,
			applicable_domains: Vec<MediaDomain>,
			name: Vec<u8>,
			description: Vec<u8>,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;

			// 验证参数
			let name_bounded: BoundedVec<u8, T::StringLimit> =
				name.try_into().map_err(|_| Error::<T>::NameTooLong)?;
			let desc_bounded: BoundedVec<u8, T::StringLimit> =
				description.try_into().map_err(|_| Error::<T>::DescriptionTooLong)?;

			// 创建配置
			let config = AudioCategoryConfig {
				category,
				applicable_domains: applicable_domains.clone().try_into().expect("域列表过长"),
				name: name_bounded,
				description: desc_bounded,
			};

			// 更新存储
			AudioCategoryConfigs::<T>::insert(category, config);

			// 重建反向索引
			// 先清除旧索引
			for domain in MediaDomain::all().iter() {
				AudioCategoriesByDomain::<T>::mutate(domain, |cats| {
					cats.retain(|&c| c != category);
				});
			}
			// 添加新索引
			for domain in &applicable_domains {
				AudioCategoriesByDomain::<T>::mutate(domain, |cats| {
					if !cats.contains(&category) {
						cats.try_push(category).ok();
				}
			});
			}

			Self::deposit_event(Event::AudioCategoryConfigUpdated(category));
			Ok(())
		}

		/// 函数级详细中文注释：更新视频分类配置
		///
		/// 治理功能：更新分类的应用域映射
		///
		/// 权限：仅管理员
		#[pallet::call_index(11)]
		#[pallet::weight(T::WeightInfo::update_category_config())]
		pub fn update_video_category_config(
			origin: OriginFor<T>,
			category: VideoCategory,
			applicable_domains: Vec<MediaDomain>,
			name: Vec<u8>,
			description: Vec<u8>,
		) -> DispatchResult {
			T::AdminOrigin::ensure_origin(origin)?;
			let name_bounded: BoundedVec<u8, T::StringLimit> =
				name.try_into().map_err(|_| Error::<T>::NameTooLong)?;
			let desc_bounded: BoundedVec<u8, T::StringLimit> =
				description.try_into().map_err(|_| Error::<T>::DescriptionTooLong)?;
			let config = VideoCategoryConfig {
				category,
				applicable_domains: applicable_domains.clone().try_into().expect("域列表过长"),
				name: name_bounded,
				description: desc_bounded,
			};

			VideoCategoryConfigs::<T>::insert(category, config);

			// 重建反向索引
			for domain in MediaDomain::all().iter() {
				VideoCategoriesByDomain::<T>::mutate(domain, |cats| {
					cats.retain(|&c| c != category);
				});
			}
			for domain in &applicable_domains {
			VideoCategoriesByDomain::<T>::mutate(domain, |cats| {
				if !cats.contains(&category) {
					cats.try_push(category).ok();
				}
			});
		}
			Ok(())
		}
	}

	// 继续实现辅助函数...
}

// 临时WeightInfo trait（后续可用benchmark生成）
pub trait WeightInfo {
	fn add_audio() -> Weight;
	fn add_video() -> Weight;
	fn update_audio() -> Weight;
	fn update_video() -> Weight;
	fn set_audio_status() -> Weight;
	fn set_video_status() -> Weight;
	fn remove_audio() -> Weight;
	fn remove_video() -> Weight;
	fn record_audio_play() -> Weight;
	fn record_video_play() -> Weight;
	fn update_category_config() -> Weight;
}

impl WeightInfo for () {
	fn add_audio() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn add_video() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn update_audio() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn update_video() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn set_audio_status() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn set_video_status() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn remove_audio() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn remove_video() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn record_audio_play() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn record_video_play() -> Weight {
		Weight::from_parts(10_000, 0)
	}
	fn update_category_config() -> Weight {
		Weight::from_parts(10_000, 0)
	}
}

// 辅助trait：为枚举添加iterator
impl MediaDomain {
	fn iterator() -> impl Iterator<Item = Self> {
		[
			Self::DeceasedMemorial,
			Self::GraveDetail,
			Self::CemeteryPark,
			Self::MemorialSpace,
			Self::OfferingRitual,
			Self::EventHall,
			Self::PetMemorial,
			Self::Education,
			Self::LiveMemorial,
			Self::VirtualRitual,
			Self::Universal,
		]
		.iter()
		.copied()
	}
}
