// 函数级详细中文注释：逝者媒体管理模块（整合自 pallet-deceased-media）
// 
// ### 功能概述
// - 管理逝者相关的媒体内容（Photo/Video/Audio）
// - 相册（Album）与视频集（VideoCollection）管理
// - 提供内容投诉与治理功能
// - 自动IPFS Pin集成
// 
// ### 设计理念
// - 与核心deceased模块解耦，通过trait接口交互
// - 统一的押金与成熟期机制
// - 治理起源统一校验

#![allow(unused_imports)]

use super::*;
use super::pallet::BalanceOf;  // 函数级中文注释：导入Balance类型别名
use alloc::vec::Vec;
use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use pallet_memo_ipfs::IpfsPinner;

/// 函数级中文注释：媒体类型（仅媒体域：Photo/Video/Audio）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaKind {
    Photo,
    Video,
    Audio,
}

/// 函数级中文注释：可见性枚举。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Visibility {
    Public,
    Unlisted,
    Private,
}

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
    /// 函数级中文注释：版本号（从 1 起），每次修改自增。
    pub version: u32,
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
    /// 函数级中文注释：版本号（从 1 起）。
    pub version: u32,
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
    /// 函数级中文注释：版本号（从 1 起）。
    pub version: u32,
}

/// 函数级中文注释：投诉状态（与text模块共享）。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum MediaComplaintStatus {
    Pending,
    Resolved,
}

/// 函数级中文注释：媒体投诉案件：记录投诉人、押金与创建块。
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
#[scale_info(skip_type_params(T))]
pub struct MediaComplaintCase<T: Config> {
    pub complainant: T::AccountId,
    pub deposit: BalanceOf<T>,
    pub created: BlockNumberFor<T>,
    pub status: MediaComplaintStatus,
}

