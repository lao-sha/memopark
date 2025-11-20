//! 函数级中文注释：Memorial 类型定义（增强版）
//!
//! 完整的祭祀品分类和定价系统
//!
//! 最后更新：2025-11-12
//! 变更：移除旧简单系统，全面采用增强系统

use codec::{Encode, Decode};
use frame_support::{pallet_prelude::*, BoundedVec};
use scale_info::TypeInfo;
use frame_system::pallet_prelude::BlockNumberFor;

// 函数级中文注释：导入 pallet::Config trait
use crate::pallet::Config;

// ========================================
// 分类系统
// ========================================

/// 函数级中文注释：主要分类（一级分类）- 覆盖更广泛的祭祀品类型
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum PrimaryCategory {
    /// 鲜花类
    Flowers,
    /// 香烛类
    Incense,
    /// 食品供品
    Foods,
    /// 纸钱冥币
    PaperMoney,
    /// 个人用品
    PersonalItems,
    /// 传统祭品
    TraditionalOfferings,
    /// 现代纪念品
    ModernMemorials,
    /// 数字纪念品（NFT等）
    DigitalMemorials,
    /// 服务类
    Services,
}

impl PrimaryCategory {
    /// 函数级中文注释：获取分类的显示名称
    pub fn display_name(&self) -> &'static str {
        match self {
            PrimaryCategory::Flowers => "鲜花类",
            PrimaryCategory::Incense => "香烛类",
            PrimaryCategory::Foods => "食品供品",
            PrimaryCategory::PaperMoney => "纸钱冥币",
            PrimaryCategory::PersonalItems => "个人用品",
            PrimaryCategory::TraditionalOfferings => "传统祭品",
            PrimaryCategory::ModernMemorials => "现代纪念品",
            PrimaryCategory::DigitalMemorials => "数字纪念品",
            PrimaryCategory::Services => "服务类",
        }
    }
}

/// 函数级中文注释：细分分类（二级分类）- 提供精细的分类颗粒度
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum SubCategory {
    // === 鲜花类 ===
    /// 白花（如白菊花、白玫瑰）
    WhiteFlowers,
    /// 黄花（如黄菊花、向日葵）
    YellowFlowers,
    /// 花束组合
    FlowerBouquets,
    /// 花圈
    Wreaths,

    // === 香烛类 ===
    /// 白蜡烛
    WhiteCandles,
    /// 红蜡烛
    RedCandles,
    /// 香（线香、盘香）
    Incense,
    /// 电子蜡烛
    ElectronicCandles,

    // === 食品供品 ===
    /// 水果
    Fruits,
    /// 糕点
    Pastries,
    /// 酒类
    Alcohol,
    /// 茶叶
    Tea,
    /// 生前喜爱的食物
    FavoriteFood,

    // === 纸钱冥币 ===
    /// 传统纸钱
    TraditionalPaperMoney,
    /// 冥币
    GhostMoney,
    /// 金银元宝
    GoldSilverIngots,

    // === 个人用品 ===
    /// 衣物
    Clothing,
    /// 日用品
    DailyItems,
    /// 玩具（给儿童）
    Toys,
    /// 书籍
    Books,

    // === 传统祭品 ===
    /// 三牲（鸡鸭鱼）
    ThreeOfferings,
    /// 五果
    FiveFruits,
    /// 素食祭品
    VegetarianOfferings,

    // === 现代纪念品 ===
    /// 照片
    Photos,
    /// 音乐盒
    MusicBox,
    /// 纪念品
    Keepsakes,

    // === 数字纪念品 ===
    /// 数字音频
    DigitalAudio,
    /// 数字视频
    DigitalVideo,
    /// NFT纪念品
    NFTMemorials,

    // === 服务类 ===
    /// 清洁服务
    CleaningService,
    /// 鲜花更换
    FlowerReplacement,
    /// 代理祭扫
    ProxyWorship,
    /// 法事服务
    ReligiousService,
}

/// 函数级中文注释：场景适用性标签 - 支持多场景标记
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum SceneTag {
    /// 适用于传统墓园
    TraditionalGrave,
    /// 适用于现代墓园
    ModernGrave,
    /// 适用于宠物墓园
    PetGrave,
    /// 适用于纪念馆
    MemorialHall,
    /// 适用于网络纪念
    VirtualMemorial,
    /// 通用（所有场景）
    Universal,
}

/// 函数级中文注释：文化属性标签 - 支持多元文化背景
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum CulturalTag {
    /// 中式传统
    ChineseTraditional,
    /// 佛教
    Buddhist,
    /// 道教
    Taoist,
    /// 基督教
    Christian,
    /// 伊斯兰教
    Islamic,
    /// 西式现代
    WesternModern,
    /// 无宗教属性
    Secular,
}

/// 函数级中文注释：品质等级 - 支持差异化定价
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum QualityLevel {
    /// 经济型
    Basic,
    /// 标准型
    Standard,
    /// 高级型
    Premium,
    /// 豪华型
    Luxury,
    /// 定制型
    Custom,
}

/// 函数级中文注释：全新的定价模型 - 支持多种商业化场景
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum PricingModel<BlockNumber> {
    /// 一次性购买（如鲜花、香烛）
    OneTime {
        price: u128,
        /// 可选的有效期（天数），比如鲜花7天后自动移除
        valid_days: Option<u32>,
    },
    /// 订阅模式（如长期供奉服务）- 仅支持按周订阅
    Subscription {
        /// 按周订阅价格
        weekly_price: u128,
        /// 最少订阅周数
        min_weeks: u32,
        /// 最多订阅周数（None表示无限制）
        max_weeks: Option<u32>,
        /// 是否支持自动续费
        auto_renew: bool,
        /// 提前终止的退款比例（0-100）
        refund_rate: u8,
    },
    /// 分级定价（如VIP专属商品）
    Tiered {
        /// 普通用户价格
        standard_price: u128,
        /// 会员价格
        member_price: u128,
        /// VIP价格（可为None表示VIP专享）
        vip_price: Option<u128>,
        valid_days: Option<u32>,
    },
    /// 动态定价（如节日特价、拍卖模式）
    Dynamic {
        /// 基础价格
        base_price: u128,
        /// 价格调整系数（百分比，100=原价）
        adjustment_factor: u16,
        /// 动态定价生效时间段
        valid_from: BlockNumber,
        valid_to: BlockNumber,
    },
    /// 捆绑套餐（如组合祭祀包）
    Bundle {
        /// 套餐价格
        bundle_price: u128,
        /// 包含的单品列表及数量
        items: BoundedVec<(u64, u32), ConstU32<10>>, // (sacrifice_id, quantity)
        /// 套餐折扣率
        discount_rate: u8,
    }
}

impl<BlockNumber> PricingModel<BlockNumber>
where
    BlockNumber: Clone,
{
    // 移除 from_legacy 方法，不再需要兼容旧系统
}

/// 函数级中文注释：定价配置 - 完整的商品定价信息
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub struct PricingConfig<BlockNumber> {
    pub model: PricingModel<BlockNumber>,
    /// 库存数量（-1表示无限）
    pub stock: i32,
    /// 每用户购买限制
    pub per_user_limit: Option<u32>,
    /// 是否启用
    pub enabled: bool,
}

impl<BlockNumber> Default for PricingConfig<BlockNumber>
where
    BlockNumber: Clone,
{
    fn default() -> Self {
        Self {
            model: PricingModel::OneTime { price: 0, valid_days: None },
            stock: -1,
            per_user_limit: None,
            enabled: true,
        }
    }
}

// ========================================
// 数据结构定义
// ========================================

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

/// 函数级中文注释：祭祀品结构 - 支持复杂的分类和定价
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct SacrificeItem<T: Config> {
    pub id: u64,
    pub name: BoundedVec<u8, T::StringLimit>,
    pub description: BoundedVec<u8, T::DescriptionLimit>,
    pub resource_url: BoundedVec<u8, T::UriLimit>,

    // === 分类系统 ===
    pub primary_category: PrimaryCategory,
    pub sub_category: SubCategory,
    pub scene_tags: BoundedVec<SceneTag, ConstU32<6>>,
    pub cultural_tags: BoundedVec<CulturalTag, ConstU32<3>>,

    // === 定价系统 ===
    pub pricing: PricingConfig<BlockNumberFor<T>>,

    // === 其他属性 ===
    pub status: SacrificeStatus,
    pub quality_level: QualityLevel,
    pub seasonal: bool,
    pub created: BlockNumberFor<T>,
    pub updated: BlockNumberFor<T>,
}

impl<T: Config> SacrificeItem<T>
where
    BlockNumberFor<T>: PartialOrd + Copy,
{
    /// 函数级中文注释：检查是否适用于指定场景
    pub fn is_suitable_for_scene(&self, scene_tag: SceneTag) -> bool {
        self.scene_tags.contains(&SceneTag::Universal) || self.scene_tags.contains(&scene_tag)
    }

    /// 函数级中文注释：检查是否适合指定文化背景
    pub fn is_suitable_for_culture(&self, cultural_tag: CulturalTag) -> bool {
        self.cultural_tags.contains(&CulturalTag::Secular) || self.cultural_tags.contains(&cultural_tag)
    }

    /// 函数级中文注释：获取当前有效价格
    pub fn get_effective_price(&self, user_type: UserType, current_block: BlockNumberFor<T>) -> Option<u128> {
        if !self.pricing.enabled {
            return None;
        }

        match &self.pricing.model {
            PricingModel::OneTime { price, .. } => Some(*price),
            PricingModel::Subscription { weekly_price, .. } => Some(*weekly_price),
            PricingModel::Tiered { standard_price, member_price, vip_price, .. } => {
                match user_type {
                    UserType::Standard => Some(*standard_price),
                    UserType::Member => Some(*member_price),
                    UserType::VIP => vip_price.or(Some(*member_price)),
                }
            },
            PricingModel::Dynamic { base_price, adjustment_factor, valid_from, valid_to } => {
                if current_block >= *valid_from && current_block <= *valid_to {
                    Some(base_price.saturating_mul(*adjustment_factor as u128).saturating_div(100))
                } else {
                    Some(*base_price)
                }
            },
            PricingModel::Bundle { bundle_price, .. } => Some(*bundle_price),
        }
    }
}

/// 函数级中文注释：用户类型 - 支持分级定价
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum UserType {
    /// 普通用户
    Standard,
    /// 会员用户
    Member,
    /// VIP用户
    VIP,
}

/// 函数级中文注释：P3新增 - 续费失败原因枚举
/// - 用于结构化地表示续费失败的具体原因
/// - 方便前端解析和国际化
/// - 便于统计分析续费失败原因分布
#[derive(Encode, Decode, DecodeWithMemTracking, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum RenewFailReason {
    /// 余额不足
    InsufficientBalance,
    /// 商品已下架
    SacrificeNotAvailable,
    /// 价格不可用
    PricingNotAvailable,
    /// 转账失败
    TransferFailed,
    /// 未知错误
    Unknown,
}

/// 函数级中文注释：媒体条目
#[derive(Encode, Decode, frame_support::CloneNoBound, frame_support::PartialEqNoBound, frame_support::EqNoBound, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct MediaItem<T: Config> {
    pub cid: BoundedVec<u8, T::MaxCidLen>,
}

/// 函数级中文注释：P2新增 - 续费历史记录
///
/// ### 用途
/// - 记录每次订阅续费的详细信息
/// - 支持审计和数据分析
/// - 用于追溯订阅生命周期
#[derive(Encode, Decode, Clone, TypeInfo, MaxEncodedLen, PartialEq, Eq)]
#[scale_info(skip_type_params(T))]
pub struct RenewalRecord<T: Config> {
    /// 订单ID
    pub offering_id: u64,
    /// 续费用户
    pub who: T::AccountId,
    /// 续费时的区块号
    pub renewed_at: BlockNumberFor<T>,
    /// 续费金额
    pub amount: u128,
    /// 续费周期（周数）
    pub duration_weeks: u32,
    /// 新的到期区块号
    pub new_expiry: BlockNumberFor<T>,
    /// 是否是自动续费
    pub is_auto_renew: bool,
}

/// 函数级中文注释：供奉订单状态（P3扩展 - 完整生命周期）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum OfferingStatus {
    /// 已完成（一次性祭品的最终状态）
    Completed,
    /// 进行中（订阅服务活跃状态）- P3新增
    Active,
    /// 已到期（订阅服务到期）- P3新增
    Expired,
    /// 已暂停（续费失败，进入宽限期）- P1新增
    Suspended,
    /// 已取消（用户主动取消订阅）
    Cancelled,
    /// 处理中（预留状态，用于异步处理场景）
    Processing,
}

impl Default for OfferingStatus {
    fn default() -> Self {
        OfferingStatus::Completed
    }
}

/// 函数级中文注释：供奉记录（P3扩展版 - 完整生命周期）
///
/// ### 不可退款政策
/// - 所有已完成支付的订单**不支持退款**
/// - Completed 状态的订单为最终状态
/// - 取消操作仅在支付前有效
///
/// ### P3新增：订阅生命周期管理
/// - Active状态：订阅服务进行中，可续费可取消
/// - Expired状态：订阅已到期，不再自动续费
/// - expiry_block：到期区块号，用于自动到期检查
/// - auto_renew：是否自动续费（需要用户有足够余额）
#[derive(Encode, Decode, frame_support::CloneNoBound, frame_support::PartialEqNoBound, frame_support::EqNoBound, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct OfferingRecord<T: Config> {
    pub who: T::AccountId,
    /// 供奉目标墓地ID
    pub grave_id: u64,
    /// 祭祀品ID
    pub sacrifice_id: u64,
    pub amount: u128,
    pub media: BoundedVec<MediaItem<T>, T::MaxMediaPerOffering>,
    pub duration_weeks: Option<u32>,
    pub time: BlockNumberFor<T>,
    /// P2新增：订单状态
    pub status: OfferingStatus,
    /// P2新增：商品数量
    pub quantity: u32,
    /// P3新增：到期区块号（仅订阅类商品有效）
    pub expiry_block: Option<BlockNumberFor<T>>,
    /// P3新增：是否自动续费（仅订阅类商品有效）
    pub auto_renew: bool,
    /// P1新增：锁定的单价（订阅创建时的价格，续费时使用）
    pub locked_unit_price: u128,
    /// P1新增：暂停时的区块号（续费失败时记录，用于计算宽限期）
    pub suspension_block: Option<BlockNumberFor<T>>,
    /// P2新增：续费失败重试次数（最多72次，约12小时）
    pub retry_count: u8,
    /// P2新增：最后一次重试的区块号（用于实现指数退避）
    pub last_retry_block: Option<BlockNumberFor<T>>,
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

// ========================================
// Trait 定义（对外接口）
// ========================================

/// 函数级中文注释：目标控制接口（墓地访问控制）
pub trait TargetControl<Origin, AccountId> {
    fn exists(grave_id: u64) -> bool;
    fn ensure_allowed(origin: Origin, grave_id: u64) -> DispatchResult;
}

/// 函数级中文注释：供奉提交后的回调接口
pub trait OnOfferingCommitted<AccountId> {
    fn on_offering(
        grave_id: u64,
        sacrifice_id: u64,
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

/// 函数级中文注释：墓地所有者查询接口（P0修复）
/// - 用于获取墓地所有者账户，实现供奉分账
pub trait GraveProvider<AccountId> {
    /// 函数级中文注释：查询墓地所有者
    /// - grave_id: 墓地ID
    /// - 返回: Some(owner) 如果墓地存在，None 如果不存在
    fn owner_of(grave_id: u64) -> Option<AccountId>;
}
