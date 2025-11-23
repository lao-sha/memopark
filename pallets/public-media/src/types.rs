// 函数级详细中文注释：公共媒体库类型定义
//
// 本文件定义了公共媒体库（音频+视频）的核心数据结构：
// - MediaType: 媒体类型枚举（音频/视频）
// - MediaDomain: 应用域枚举（纪念场景）
// - AudioCategory: 音频分类枚举
// - VideoCategory: 视频分类枚举
// - MediaCategory: 统一媒体分类
// - VideoQuality: 视频分辨率枚举
// - MediaStats: 媒体统计
//
// Note: Config-dependent types (AudioMediaEntry, VideoMediaEntry, AudioCategoryConfig, VideoCategoryConfig)
// are now defined in lib.rs inside the pallet module where Config trait is available.

use codec::{Decode, Encode};
use frame_support::pallet_prelude::MaxEncodedLen;
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// 媒体应用域（纪念场景）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum MediaDomain {
	/// 逝者纪念馆
	DeceasedMemorial = 0,
	/// 墓地详情页
	GraveDetail = 1,
	/// 陵园主页
	CemeteryPark = 2,
	/// 纪念空间
	MemorialSpace = 3,
	/// 供奉仪式
	OfferingRitual = 4,
	/// 事件馆
	EventHall = 5,
	/// 宠物纪念
	PetMemorial = 6,
	/// 教育场景
	Education = 7,
	/// 直播追悼会
	LiveMemorial = 8,
	/// 虚拟祭祀
	VirtualRitual = 9,
	/// 通用场景（适用于所有场景）
	Universal = 255,
}

impl Default for MediaDomain {
	fn default() -> Self {
		Self::Universal
	}
}

impl MediaDomain {
	/// 获取所有 MediaDomain 变体的数组
	pub fn all() -> [MediaDomain; 11] {
		[
			MediaDomain::DeceasedMemorial,
			MediaDomain::GraveDetail,
			MediaDomain::CemeteryPark,
			MediaDomain::MemorialSpace,
			MediaDomain::OfferingRitual,
			MediaDomain::EventHall,
			MediaDomain::PetMemorial,
			MediaDomain::Education,
			MediaDomain::LiveMemorial,
			MediaDomain::VirtualRitual,
			MediaDomain::Universal,
		]
	}
}

/// 音频分类
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum AudioCategory {
	/// 哀乐（追思、悼念）
	Requiem = 0,
	/// 佛乐（佛教音乐、经文）
	Buddhist = 1,
	/// 轻音乐（抒情、平和）
	Light = 2,
	/// 古典音乐（庄重、肃穆）
	Classical = 3,
	/// 环境音乐（自然音、白噪音）
	Ambient = 4,
	/// 民族音乐（传统、地方特色）
	Ethnic = 5,
	/// 宗教音乐（多宗教通用）
	Religious = 6,
	/// 冥想音乐（禅修、静心）
	Meditation = 7,
}

impl Default for AudioCategory {
	fn default() -> Self {
		Self::Requiem
	}
}

/// 视频分类
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum VideoCategory {
	/// 生平纪录（个人生平、回忆录）
	Biography = 0,
	/// 历史影像（历史事件、档案）
	Historical = 1,
	/// 教育视频（生命教育、文化传承）
	Educational = 2,
	/// 仪式引导（祭祀流程、操作指南）
	Ritual = 3,
	/// 宣传片（陵园介绍、服务展示）
	Promotional = 4,
	/// 纪录片（深度记录、专题片）
	Documentary = 5,
	/// 全景视频（360°、VR/AR）
	Panoramic = 6,
	/// 追悼视频（追思会、悼念仪式）
	Memorial = 7,
}

impl Default for VideoCategory {
	fn default() -> Self {
		Self::Biography
	}
}

/// 视频质量/分辨率
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
pub enum VideoQuality {
	/// 标清 480p
	SD = 0,
	/// 高清 720p
	HD = 1,
	/// 全高清 1080p
	FullHD = 2,
	/// 2K
	TwoK = 3,
	/// 4K Ultra HD
	FourK = 4,
}

/// 媒体统计（Phase 2）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
pub struct MediaStats {
	/// 总播放次数
	pub play_count: u64,
	/// 总点赞数
	pub like_count: u32,
	/// 最后播放时间
	pub last_played_at: Option<u32>,
}
