//! 函数级中文注释：Memorial 类型定义（精简版）

use codec::{Encode, Decode};
use frame_support::{pallet_prelude::*, BoundedVec};
use scale_info::TypeInfo;
use frame_system::pallet_prelude::BlockNumberFor;

// 函数级中文注释：导入 pallet::Config trait
use crate::pallet::Config;

// ========================================
// 枚举定义（替代动态配置）
// ========================================

/// 函数级中文注释：场景枚举（固定，不占用存储）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Scene {
    /// 墓地场景
    Grave,
    /// 宠物场景
    Pet,
    /// 公园场景
    Park,
    /// 纪念馆场景
    Memorial,
}

/// 函数级中文注释：类目枚举（固定，不占用存储）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum Category {
    /// 鲜花
    Flower,
    /// 蜡烛
    Candle,
    /// 食品
    Food,
    /// 玩具
    Toy,
    /// 其他
    Other,
}

/// 函数级中文注释：祭祀品状态
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum SacrificeStatus {
    /// 已启用
    Enabled,
    /// 已禁用
    Disabled,
    /// 已隐藏
    Hidden,
}

/// 函数级中文注释：供奉品类型
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum OfferingKind {
    /// 无时长：一次性生效
    Instant,
    /// 有时长：要求携带时长
    Timed {
        min: u32,
        max: Option<u32>,
        can_renew: bool,
    },
}

// ========================================
// 数据结构定义
// ========================================

/// 函数级中文注释：祭祀品主数据（精简版）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct SacrificeItem<T: Config> {
    pub id: u64,
    pub name: BoundedVec<u8, T::StringLimit>,
    pub resource_url: BoundedVec<u8, T::UriLimit>,
    pub description: BoundedVec<u8, T::DescriptionLimit>,
    pub status: SacrificeStatus,
    pub is_vip_exclusive: bool,
    pub fixed_price: Option<u128>,
    pub unit_price_per_week: Option<u128>,
    pub scene: u8,  // 场景类型代码（0=Grave, 1=Pet, 2=Park, 3=Memorial）
    pub category: u8,  // 类目代码（0=Flower, 1=Candle, 2=Food, 3=Toy, 4=Other）
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

/// 函数级中文注释：供奉品规格（精简版）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OfferingSpec<T: Config> {
    pub kind_code: u8,
    pub name: BoundedVec<u8, T::MaxNameLen>,
    pub media_schema_cid: BoundedVec<u8, T::MaxCidLen>,
    pub enabled: bool,
    pub kind: OfferingKind,
}

/// 函数级中文注释：媒体条目（精简版，移除commit字段）
#[derive(Encode, Decode, frame_support::CloneNoBound, frame_support::PartialEqNoBound, frame_support::EqNoBound, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MediaItem<T: Config> {
    pub cid: BoundedVec<u8, T::MaxCidLen>,
}

/// 函数级中文注释：供奉记录（精简版）
#[derive(Encode, Decode, frame_support::CloneNoBound, frame_support::PartialEqNoBound, frame_support::EqNoBound, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OfferingRecord<T: Config> {
    pub who: T::AccountId,
    pub target: (u8, u64),
    pub kind_code: u8,
    pub amount: u128,
    pub media: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering>,
    pub duration: Option<u32>,
    pub time: BlockNumberFor<T>,
}

/// 函数级中文注释：简化的分账配置
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub struct SimpleRoute {
    /// 目标账户分成百分比（默认80%）
    pub subject_percent: u8,
    /// 平台分成百分比（默认20%）
    pub platform_percent: u8,
}

impl Default for SimpleRoute {
    fn default() -> Self {
        Self {
            subject_percent: 80,
            platform_percent: 20,
        }
    }
}

/// 函数级中文注释：批量供奉输入项
/// 🚧 2025-10-28 简化版：使用固定的常量限制（64字节CID，最多5个媒体）
#[derive(Encode, Decode, MaxEncodedLen, Clone, PartialEq, Eq, TypeInfo, Debug)]
pub struct BatchOfferingInput {
    /// 祭祀品类型代码（用于自定义供奉）
    pub kind_code: u8,
    /// 供奉金额（MEMO单位）
    pub amount: u128,
    /// 附带媒体CID列表（可选），最多5个，每个最多64字节
    pub media: BoundedVec<BoundedVec<u8, ConstU32<64>>, ConstU32<5>>,
    /// 持续时长（可选，按周计）
    pub duration: Option<u32>,
}

// ========================================
// Trait 定义（对外接口）
// ========================================

/// 函数级中文注释：目标控制接口
pub trait TargetControl<Origin, AccountId> {
    fn exists(target: (u8, u64)) -> bool;
    fn ensure_allowed(origin: Origin, target: (u8, u64)) -> DispatchResult;
}

/// 函数级中文注释：供奉提交后的回调接口
pub trait OnOfferingCommitted<AccountId> {
    fn on_offering(
        target: (u8, u64),
        kind_code: u8,
        who: &AccountId,
        amount: u128,
        duration_weeks: Option<u32>,
    );
}

/// 函数级中文注释：会员信息提供者接口
pub trait MembershipProvider<AccountId> {
    fn is_valid_member(who: &AccountId) -> bool;
    fn get_discount() -> u8;
}

