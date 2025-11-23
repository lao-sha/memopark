// 函数级详细中文注释：辅助查询函数
//
// 本文件实现了公共媒体库的辅助查询功能：
// 1. 按分类查询音频/视频
// 2. 按应用域查询分类
// 3. 随机推荐音频/视频
// 4. 智能推荐（根据应用域）

use super::*;

impl<T: Config> Pallet<T> {
	/// 函数级详细中文注释：获取指定分类的所有启用音频
	///
	/// 参数：
	/// - category: 音频分类
	///
	/// 返回：音频ID列表
	pub fn get_audio_by_category(category: AudioCategory) -> Vec<u32> {
		let all_ids = AudioByCategory::<T>::get(category);
		all_ids
			.into_iter()
			.filter(|&id| {
				AudioLibrary::<T>::get(id)
					.map(|e| e.enabled)
					.unwrap_or(false)
			})
			.collect()
	}

	/// 函数级详细中文注释：获取指定分类的所有启用视频
	///
	/// 参数：
	/// - category: 视频分类
	///
	/// 返回：视频ID列表
	pub fn get_video_by_category(category: VideoCategory) -> Vec<u32> {
		let all_ids = VideoByCategory::<T>::get(category);
		all_ids
			.into_iter()
			.filter(|&id| {
				VideoLibrary::<T>::get(id)
					.map(|e| e.enabled)
					.unwrap_or(false)
			})
			.collect()
	}

	/// 函数级详细中文注释：随机获取指定分类的音频
	///
	/// 使用区块哈希作为随机数种子
	///
	/// 参数：
	/// - category: 音频分类
	///
	/// 返回：音频ID（如果存在）
	pub fn get_random_audio(category: AudioCategory) -> Option<u32> {
		let audio_ids = Self::get_audio_by_category(category);
		if audio_ids.is_empty() {
			return None;
		}

		// 使用区块哈希作为随机数种子
		let block_hash =
			<frame_system::Pallet<T>>::block_hash(<frame_system::Pallet<T>>::block_number());
		let seed = block_hash.as_ref()[0] as usize;
		let index = seed % audio_ids.len();

		audio_ids.get(index).copied()
	}

	/// 函数级详细中文注释：随机获取指定分类的视频
	///
	/// 使用区块哈希作为随机数种子
	///
	/// 参数：
	/// - category: 视频分类
	///
	/// 返回：视频ID（如果存在）
	pub fn get_random_video(category: VideoCategory) -> Option<u32> {
		let video_ids = Self::get_video_by_category(category);
		if video_ids.is_empty() {
			return None;
		}

		let block_hash =
			<frame_system::Pallet<T>>::block_hash(<frame_system::Pallet<T>>::block_number());
		let seed = block_hash.as_ref()[0] as usize;
		let index = seed % video_ids.len();

		video_ids.get(index).copied()
	}

	/// 函数级详细中文注释：获取所有启用的音频ID
	///
	/// 返回：音频ID列表
	pub fn get_all_enabled_audio() -> Vec<u32> {
		EnabledAudioIds::<T>::get().into_inner()
	}

	/// 函数级详细中文注释：获取所有启用的视频ID
	///
	/// 返回：视频ID列表
	pub fn get_all_enabled_video() -> Vec<u32> {
		EnabledVideoIds::<T>::get().into_inner()
	}

	/// 函数级详细中文注释：检查音频是否存在且启用
	///
	/// 参数：
	/// - audio_id: 音频ID
	///
	/// 返回：是否可用
	pub fn is_audio_available(audio_id: u32) -> bool {
		AudioLibrary::<T>::get(audio_id)
			.map(|e| e.enabled)
			.unwrap_or(false)
	}

	/// 函数级详细中文注释：检查视频是否存在且启用
	///
	/// 参数：
	/// - video_id: 视频ID
	///
	/// 返回：是否可用
	pub fn is_video_available(video_id: u32) -> bool {
		VideoLibrary::<T>::get(video_id)
			.map(|e| e.enabled)
			.unwrap_or(false)
	}

	/// 函数级详细中文注释：获取音频详细信息
	///
	/// 参数：
	/// - audio_id: 音频ID
	///
	/// 返回：音频条目（如果存在）
	pub fn get_audio_info(audio_id: u32) -> Option<AudioMediaEntry<T>> {
		AudioLibrary::<T>::get(audio_id)
	}

	/// 函数级详细中文注释：获取视频详细信息
	///
	/// 参数：
	/// - video_id: 视频ID
	///
	/// 返回：视频条目（如果存在）
	pub fn get_video_info(video_id: u32) -> Option<VideoMediaEntry<T>> {
		VideoLibrary::<T>::get(video_id)
	}

	// ========== 应用域相关查询 ==========

	/// 函数级详细中文注释：获取指定应用域可用的音频分类列表
	///
	/// 参数：
	/// - domain: 应用域（纪念场景）
	///
	/// 返回：音频分类列表
	pub fn get_audio_categories_for_domain(domain: MediaDomain) -> Vec<AudioCategory> {
		AudioCategoriesByDomain::<T>::get(domain).into_inner()
	}

	/// 函数级详细中文注释：获取指定应用域可用的视频分类列表
	///
	/// 参数：
	/// - domain: 应用域（纪念场景）
	///
	/// 返回：视频分类列表
	pub fn get_video_categories_for_domain(domain: MediaDomain) -> Vec<VideoCategory> {
		VideoCategoriesByDomain::<T>::get(domain).into_inner()
	}

	/// 函数级详细中文注释：检查音频分类是否适用于指定应用域
	///
	/// 参数：
	/// - category: 音频分类
	/// - domain: 应用域
	///
	/// 返回：是否适用
	pub fn is_audio_category_applicable(
		category: AudioCategory,
		domain: MediaDomain,
	) -> bool {
		if let Some(config) = AudioCategoryConfigs::<T>::get(category) {
			config.applicable_domains.contains(&domain) ||
				config.applicable_domains.contains(&MediaDomain::Universal)
		} else {
			false
		}
	}

	/// 函数级详细中文注释：检查视频分类是否适用于指定应用域
	///
	/// 参数：
	/// - category: 视频分类
	/// - domain: 应用域
	///
	/// 返回：是否适用
	pub fn is_video_category_applicable(
		category: VideoCategory,
		domain: MediaDomain,
	) -> bool {
		if let Some(config) = VideoCategoryConfigs::<T>::get(category) {
			config.applicable_domains.contains(&domain) ||
				config.applicable_domains.contains(&MediaDomain::Universal)
		} else {
			false
		}
	}

	/// 函数级详细中文注释：获取指定应用域的随机音频（智能推荐）
	///
	/// 智能推荐流程：
	/// 1. 获取该应用域可用的音频分类列表
	/// 2. 随机选择一个分类
	/// 3. 从该分类中随机选择一个音频
	///
	/// 参数：
	/// - domain: 应用域（纪念场景）
	///
	/// 返回：音频ID（如果存在）
	///
	/// 示例：
	/// - 纪念馆场景 → 自动推荐：哀乐/佛乐/轻音乐
	/// - 陵园场景 → 自动推荐：轻音乐/环境音乐
	pub fn get_random_audio_for_domain(domain: MediaDomain) -> Option<u32> {
		// 1. 获取该域可用的音频分类
		let categories = Self::get_audio_categories_for_domain(domain);
		if categories.is_empty() {
			return None;
		}

		// 2. 随机选择一个分类
		let block_hash =
			<frame_system::Pallet<T>>::block_hash(<frame_system::Pallet<T>>::block_number());
		let seed = block_hash.as_ref()[0] as usize;
		let category_index = seed % categories.len();
		let selected_category = categories[category_index];

		// 3. 从该分类中随机选择一个音频
		Self::get_random_audio(selected_category)
	}

	/// 函数级详细中文注释：获取指定应用域的随机视频（智能推荐）
	///
	/// 参数：
	/// - domain: 应用域（纪念场景）
	///
	/// 返回：视频ID（如果存在）
	///
	/// 示例：
	/// - 纪念馆场景 → 自动推荐：生平纪录视频
	/// - 陵园场景 → 自动推荐：宣传片/教育视频
	pub fn get_random_video_for_domain(domain: MediaDomain) -> Option<u32> {
		let categories = Self::get_video_categories_for_domain(domain);
		if categories.is_empty() {
			return None;
		}

		let block_hash =
			<frame_system::Pallet<T>>::block_hash(<frame_system::Pallet<T>>::block_number());
		let seed = block_hash.as_ref()[0] as usize;
		let category_index = seed % categories.len();
		let selected_category = categories[category_index];

		Self::get_random_video(selected_category)
	}

	/// 函数级详细中文注释：获取指定应用域的所有可用音频
	///
	/// 参数：
	/// - domain: 应用域
	///
	/// 返回：音频ID列表
	pub fn get_all_audio_for_domain(domain: MediaDomain) -> Vec<u32> {
		let categories = Self::get_audio_categories_for_domain(domain);
		let mut result = Vec::new();

		for category in categories {
			let audio_ids = Self::get_audio_by_category(category);
			result.extend(audio_ids);
		}

		result
	}

	/// 函数级详细中文注释：获取指定应用域的所有可用视频
	///
	/// 参数：
	/// - domain: 应用域
	///
	/// 返回：视频ID列表
	pub fn get_all_video_for_domain(domain: MediaDomain) -> Vec<u32> {
		let categories = Self::get_video_categories_for_domain(domain);
		let mut result = Vec::new();

		for category in categories {
			let video_ids = Self::get_video_by_category(category);
			result.extend(video_ids);
		}

		result
	}
}
