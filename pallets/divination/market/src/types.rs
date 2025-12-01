//! # 占卜服务市场数据类型定义
//!
//! 本模块定义了通用占卜服务市场所需的所有核心数据结构，支持多种占卜类型：
//! - 梅花易数
//! - 八字命理
//! - 六爻占卜
//! - 奇门遁甲
//! - 紫微斗数
//!
//! ## 主要功能
//! - 服务提供者信息
//! - 服务套餐定义
//! - 订单状态管理
//! - 评价与评分系统

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use pallet_divination_common::DivinationType;
use scale_info::TypeInfo;

/// 服务提供者状态
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum ProviderStatus {
    /// 待审核 - 新注册等待验证
    #[default]
    Pending = 0,
    /// 已激活 - 正常运营
    Active = 1,
    /// 已暂停 - 暂时停止接单
    Paused = 2,
    /// 已封禁 - 违规被封
    Banned = 3,
    /// 已注销 - 主动退出
    Deactivated = 4,
}

/// 服务提供者认证等级
///
/// 根据经验、评分和认证情况分级
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum ProviderTier {
    /// 新手 - 刚入驻的提供者
    #[default]
    Novice = 0,
    /// 认证 - 通过基础认证
    Certified = 1,
    /// 资深 - 完成一定订单量
    Senior = 2,
    /// 专家 - 高评分高订单量
    Expert = 3,
    /// 大师 - 顶级认证
    Master = 4,
}

impl ProviderTier {
    /// 获取等级所需的最低订单数
    pub fn min_orders(&self) -> u32 {
        match self {
            ProviderTier::Novice => 0,
            ProviderTier::Certified => 10,
            ProviderTier::Senior => 50,
            ProviderTier::Expert => 200,
            ProviderTier::Master => 500,
        }
    }

    /// 获取等级所需的最低评分（* 100）
    pub fn min_rating(&self) -> u16 {
        match self {
            ProviderTier::Novice => 0,
            ProviderTier::Certified => 350, // 3.5 星
            ProviderTier::Senior => 400,    // 4.0 星
            ProviderTier::Expert => 450,    // 4.5 星
            ProviderTier::Master => 480,    // 4.8 星
        }
    }

    /// 获取平台抽成比例（基点，10000 = 100%）
    pub fn platform_fee_rate(&self) -> u16 {
        match self {
            ProviderTier::Novice => 2000,    // 20%
            ProviderTier::Certified => 1500, // 15%
            ProviderTier::Senior => 1200,    // 12%
            ProviderTier::Expert => 1000,    // 10%
            ProviderTier::Master => 800,     // 8%
        }
    }
}

/// 服务提供者信息
///
/// 支持多种占卜类型的服务提供者
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxNameLen, MaxBioLen))]
pub struct Provider<AccountId, Balance, BlockNumber, MaxNameLen: Get<u32>, MaxBioLen: Get<u32>> {
    /// 账户地址
    pub account: AccountId,
    /// 显示名称
    pub name: BoundedVec<u8, MaxNameLen>,
    /// 个人简介
    pub bio: BoundedVec<u8, MaxBioLen>,
    /// 头像 IPFS CID
    pub avatar_cid: Option<BoundedVec<u8, ConstU32<64>>>,
    /// 认证等级
    pub tier: ProviderTier,
    /// 状态
    pub status: ProviderStatus,
    /// 保证金
    pub deposit: Balance,
    /// 注册时间
    pub registered_at: BlockNumber,
    /// 总订单数
    pub total_orders: u32,
    /// 完成订单数
    pub completed_orders: u32,
    /// 取消订单数
    pub cancelled_orders: u32,
    /// 总评分次数
    pub total_ratings: u32,
    /// 评分总和（用于计算平均分）
    pub rating_sum: u64,
    /// 总收入
    pub total_earnings: Balance,
    /// 擅长领域（位图）
    pub specialties: u16,
    /// 支持的占卜类型（位图）
    pub supported_divination_types: u8,
    /// 是否接受紧急订单
    pub accepts_urgent: bool,
    /// 最后活跃时间
    pub last_active_at: BlockNumber,
}

impl<AccountId, Balance: Default, BlockNumber, MaxNameLen: Get<u32>, MaxBioLen: Get<u32>>
    Provider<AccountId, Balance, BlockNumber, MaxNameLen, MaxBioLen>
{
    /// 计算平均评分（* 100，如 450 = 4.5 星）
    pub fn average_rating(&self) -> u16 {
        if self.total_ratings == 0 {
            return 0;
        }
        ((self.rating_sum * 100) / self.total_ratings as u64) as u16
    }

    /// 计算完成率（* 100）
    pub fn completion_rate(&self) -> u16 {
        if self.total_orders == 0 {
            return 10000; // 100%
        }
        ((self.completed_orders as u64 * 10000) / self.total_orders as u64) as u16
    }

    /// 检查是否擅长指定领域
    pub fn has_specialty(&self, specialty: Specialty) -> bool {
        let bit = 1u16 << (specialty as u16);
        self.specialties & bit != 0
    }

    /// 检查是否支持指定的占卜类型
    pub fn supports_divination_type(&self, divination_type: DivinationType) -> bool {
        let type_bit = 1u8 << (divination_type as u8);
        self.supported_divination_types & type_bit != 0
    }
}

/// 擅长领域
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
)]
pub enum Specialty {
    /// 事业运势
    Career = 0,
    /// 感情婚姻
    Relationship = 1,
    /// 财运投资
    Wealth = 2,
    /// 健康养生
    Health = 3,
    /// 学业考试
    Education = 4,
    /// 出行旅游
    Travel = 5,
    /// 官司诉讼
    Legal = 6,
    /// 寻人寻物
    Finding = 7,
    /// 风水堪舆
    FengShui = 8,
    /// 择日选时
    DateSelection = 9,
}

/// 服务套餐类型
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum ServiceType {
    /// 文字解卦 - 纯文字回复
    #[default]
    TextReading = 0,
    /// 语音解卦 - 语音回复
    VoiceReading = 1,
    /// 视频解卦 - 视频回复
    VideoReading = 2,
    /// 实时咨询 - 一对一实时
    LiveConsultation = 3,
}

impl ServiceType {
    /// 获取基础时长（分钟）
    pub fn base_duration(&self) -> u32 {
        match self {
            ServiceType::TextReading => 0,       // 无时长限制
            ServiceType::VoiceReading => 10,     // 10分钟
            ServiceType::VideoReading => 15,     // 15分钟
            ServiceType::LiveConsultation => 30, // 30分钟
        }
    }
}

/// 服务套餐
///
/// 支持多种占卜类型的服务套餐
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxDescLen))]
pub struct ServicePackage<Balance, MaxDescLen: Get<u32>> {
    /// 套餐 ID
    pub id: u32,
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 服务类型
    pub service_type: ServiceType,
    /// 套餐名称
    pub name: BoundedVec<u8, ConstU32<64>>,
    /// 套餐描述
    pub description: BoundedVec<u8, MaxDescLen>,
    /// 价格
    pub price: Balance,
    /// 服务时长（分钟，0 表示不限）
    pub duration: u32,
    /// 包含追问次数
    pub follow_up_count: u8,
    /// 是否支持加急
    pub urgent_available: bool,
    /// 加急加价比例（基点）
    pub urgent_surcharge: u16,
    /// 是否启用
    pub is_active: bool,
    /// 销量
    pub sales_count: u32,
}

/// 订单状态
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum OrderStatus {
    /// 待支付
    #[default]
    PendingPayment = 0,
    /// 已支付，等待接单
    Paid = 1,
    /// 已接单，处理中
    Accepted = 2,
    /// 已完成解读
    Completed = 3,
    /// 已评价
    Reviewed = 4,
    /// 已取消
    Cancelled = 5,
    /// 已退款
    Refunded = 6,
    /// 争议中
    Disputed = 7,
}

/// 订单信息
///
/// 支持多种占卜类型的通用订单
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct Order<AccountId, Balance, BlockNumber, MaxCidLen: Get<u32>> {
    /// 订单 ID
    pub id: u64,
    /// 客户账户
    pub customer: AccountId,
    /// 服务提供者账户
    pub provider: AccountId,
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 关联的占卜结果 ID（卦象 ID、命盘 ID 等）
    pub result_id: u64,
    /// 服务套餐 ID
    pub package_id: u32,
    /// 订单金额
    pub amount: Balance,
    /// 平台手续费
    pub platform_fee: Balance,
    /// 是否加急
    pub is_urgent: bool,
    /// 状态
    pub status: OrderStatus,
    /// 客户问题描述 CID
    pub question_cid: BoundedVec<u8, MaxCidLen>,
    /// 解读结果 CID
    pub answer_cid: Option<BoundedVec<u8, MaxCidLen>>,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 支付时间
    pub paid_at: Option<BlockNumber>,
    /// 接单时间
    pub accepted_at: Option<BlockNumber>,
    /// 完成时间
    pub completed_at: Option<BlockNumber>,
    /// 剩余追问次数
    pub follow_ups_remaining: u8,
    /// 评分
    pub rating: Option<u8>,
    /// 评价内容 CID
    pub review_cid: Option<BoundedVec<u8, MaxCidLen>>,
}

/// 追问记录
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct FollowUp<BlockNumber, MaxCidLen: Get<u32>> {
    /// 追问内容 CID
    pub question_cid: BoundedVec<u8, MaxCidLen>,
    /// 回复内容 CID
    pub answer_cid: Option<BoundedVec<u8, MaxCidLen>>,
    /// 追问时间
    pub asked_at: BlockNumber,
    /// 回复时间
    pub answered_at: Option<BlockNumber>,
}

/// 评价详情
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct Review<AccountId, BlockNumber, MaxCidLen: Get<u32>> {
    /// 订单 ID
    pub order_id: u64,
    /// 评价者
    pub reviewer: AccountId,
    /// 被评价者
    pub reviewee: AccountId,
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 总体评分（1-5）
    pub overall_rating: u8,
    /// 准确度评分
    pub accuracy_rating: u8,
    /// 服务态度评分
    pub attitude_rating: u8,
    /// 响应速度评分
    pub response_rating: u8,
    /// 评价内容 CID
    pub content_cid: Option<BoundedVec<u8, MaxCidLen>>,
    /// 评价时间
    pub created_at: BlockNumber,
    /// 是否匿名
    pub is_anonymous: bool,
    /// 提供者回复 CID
    pub provider_reply_cid: Option<BoundedVec<u8, MaxCidLen>>,
}

/// 市场统计信息
#[derive(
    Clone,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub struct MarketStats<Balance: Default> {
    /// 活跃提供者数
    pub active_providers: u32,
    /// 总订单数
    pub total_orders: u64,
    /// 完成订单数
    pub completed_orders: u64,
    /// 总交易额
    pub total_volume: Balance,
    /// 平台总收入
    pub platform_earnings: Balance,
    /// 总评价数
    pub total_reviews: u64,
    /// 平均评分（* 100）
    pub average_rating: u16,
}

/// 按占卜类型的统计
#[derive(
    Clone,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub struct TypeMarketStats<Balance: Default> {
    /// 订单数量
    pub order_count: u64,
    /// 完成数量
    pub completed_count: u64,
    /// 交易额
    pub volume: Balance,
}

/// 提现请求状态
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum WithdrawalStatus {
    /// 待处理
    #[default]
    Pending = 0,
    /// 已完成
    Completed = 1,
    /// 已取消
    Cancelled = 2,
}

/// 提现请求
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct WithdrawalRequest<AccountId, Balance, BlockNumber> {
    /// 请求 ID
    pub id: u64,
    /// 申请者
    pub provider: AccountId,
    /// 提现金额
    pub amount: Balance,
    /// 状态
    pub status: WithdrawalStatus,
    /// 申请时间
    pub requested_at: BlockNumber,
    /// 处理时间
    pub processed_at: Option<BlockNumber>,
}

// ============================================================================
// 悬赏问答类型定义（混合模式 - 方案B 多人奖励）
// ============================================================================

/// 悬赏问答状态
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum BountyStatus {
    /// 开放中 - 接受回答
    #[default]
    Open = 0,
    /// 已关闭 - 停止接受回答，等待采纳
    Closed = 1,
    /// 已采纳 - 已选择答案，等待结算
    Adopted = 2,
    /// 已结算 - 奖励已分配
    Settled = 3,
    /// 已取消 - 提问者取消（无回答时）
    Cancelled = 4,
    /// 已过期 - 超时无人回答，退款
    Expired = 5,
}

/// 悬赏回答状态
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub enum BountyAnswerStatus {
    /// 待审核 - 等待提问者或社区审核
    #[default]
    Pending = 0,
    /// 已采纳 - 被选为最佳答案（第一名）
    Adopted = 1,
    /// 入选 - 入选优秀答案（第二、三名）
    Selected = 2,
    /// 参与奖 - 获得参与奖励
    Participated = 3,
    /// 未入选 - 未获得奖励
    Rejected = 4,
}

/// 奖励分配方案（方案B - 多人奖励）
///
/// 奖励分配比例（基点，10000 = 100%）：
/// - 第一名（被采纳）：60%
/// - 第二名：15%
/// - 第三名：5%
/// - 平台手续费：15%
/// - 其他参与者平分：5%
#[derive(
    Clone,
    Copy,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
)]
pub struct RewardDistribution {
    /// 第一名奖励比例（基点）
    pub first_place: u16,
    /// 第二名奖励比例（基点）
    pub second_place: u16,
    /// 第三名奖励比例（基点）
    pub third_place: u16,
    /// 平台手续费比例（基点）
    pub platform_fee: u16,
    /// 参与奖总比例（基点）
    pub participation_pool: u16,
}

impl Default for RewardDistribution {
    /// 默认方案B分配比例
    fn default() -> Self {
        Self {
            first_place: 6000,       // 60%
            second_place: 1500,      // 15%
            third_place: 500,        // 5%
            platform_fee: 1500,      // 15%
            participation_pool: 500, // 5%
        }
    }
}

impl RewardDistribution {
    /// 验证分配比例是否合法（总和必须等于10000）
    pub fn is_valid(&self) -> bool {
        self.first_place
            .saturating_add(self.second_place)
            .saturating_add(self.third_place)
            .saturating_add(self.platform_fee)
            .saturating_add(self.participation_pool)
            == 10000
    }
}

/// 悬赏问题
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct BountyQuestion<AccountId, Balance, BlockNumber, MaxCidLen: Get<u32>> {
    /// 悬赏问题 ID
    pub id: u64,
    /// 提问者账户
    pub creator: AccountId,
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 关联的占卜结果 ID（可选，如卦象 ID）
    pub result_id: Option<u64>,
    /// 问题描述 IPFS CID
    pub question_cid: BoundedVec<u8, MaxCidLen>,
    /// 悬赏金额
    pub bounty_amount: Balance,
    /// 截止区块
    pub deadline: BlockNumber,
    /// 最小回答数（达到后可关闭）
    pub min_answers: u8,
    /// 最大回答数
    pub max_answers: u8,
    /// 状态
    pub status: BountyStatus,
    /// 被采纳的答案 ID（第一名）
    pub adopted_answer_id: Option<u64>,
    /// 第二名答案 ID
    pub second_place_id: Option<u64>,
    /// 第三名答案 ID
    pub third_place_id: Option<u64>,
    /// 当前回答数量
    pub answer_count: u32,
    /// 奖励分配方案
    pub reward_distribution: RewardDistribution,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 关闭时间
    pub closed_at: Option<BlockNumber>,
    /// 结算时间
    pub settled_at: Option<BlockNumber>,
    /// 擅长领域（用于匹配回答者）
    pub specialty: Option<Specialty>,
    /// 是否仅限认证提供者回答
    pub certified_only: bool,
    /// 是否允许社区投票辅助选择
    pub allow_voting: bool,
    /// 总投票数
    pub total_votes: u32,
}

/// 悬赏回答
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct BountyAnswer<AccountId, Balance, BlockNumber, MaxCidLen: Get<u32>> {
    /// 回答 ID
    pub id: u64,
    /// 所属悬赏问题 ID
    pub bounty_id: u64,
    /// 回答者账户
    pub answerer: AccountId,
    /// 回答内容 IPFS CID
    pub answer_cid: BoundedVec<u8, MaxCidLen>,
    /// 状态
    pub status: BountyAnswerStatus,
    /// 获得票数
    pub votes: u32,
    /// 获得奖励金额
    pub reward_amount: Balance,
    /// 提交时间
    pub submitted_at: BlockNumber,
    /// 是否为认证提供者
    pub is_certified: bool,
    /// 回答者的提供者等级（如果是提供者）
    pub provider_tier: Option<ProviderTier>,
}

/// 投票记录
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct BountyVote<AccountId, BlockNumber> {
    /// 投票者
    pub voter: AccountId,
    /// 投票的答案 ID
    pub answer_id: u64,
    /// 投票时间
    pub voted_at: BlockNumber,
}

/// 悬赏问答统计
#[derive(
    Clone,
    Encode,
    Decode,
    DecodeWithMemTracking,
    TypeInfo,
    MaxEncodedLen,
    PartialEq,
    Eq,
    Debug,
    Default,
)]
pub struct BountyStats<Balance: Default> {
    /// 总悬赏问题数
    pub total_bounties: u64,
    /// 活跃悬赏数（Open状态）
    pub active_bounties: u64,
    /// 已结算悬赏数
    pub settled_bounties: u64,
    /// 总悬赏金额
    pub total_bounty_amount: Balance,
    /// 已发放奖励金额
    pub total_rewards_paid: Balance,
    /// 总回答数
    pub total_answers: u64,
    /// 平均每个悬赏的回答数（* 100）
    pub avg_answers_per_bounty: u16,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_tier_requirements() {
        assert_eq!(ProviderTier::Novice.min_orders(), 0);
        assert_eq!(ProviderTier::Expert.min_orders(), 200);
        assert_eq!(ProviderTier::Master.min_rating(), 480);
    }

    #[test]
    fn test_provider_tier_fees() {
        assert_eq!(ProviderTier::Novice.platform_fee_rate(), 2000);
        assert_eq!(ProviderTier::Master.platform_fee_rate(), 800);
    }

    #[test]
    fn test_service_type_duration() {
        assert_eq!(ServiceType::TextReading.base_duration(), 0);
        assert_eq!(ServiceType::LiveConsultation.base_duration(), 30);
    }

    #[test]
    fn test_reward_distribution_default() {
        let dist = RewardDistribution::default();
        assert!(dist.is_valid());
        assert_eq!(dist.first_place, 6000);
        assert_eq!(dist.second_place, 1500);
        assert_eq!(dist.third_place, 500);
        assert_eq!(dist.platform_fee, 1500);
        assert_eq!(dist.participation_pool, 500);
    }

    #[test]
    fn test_reward_distribution_invalid() {
        let dist = RewardDistribution {
            first_place: 7000,
            second_place: 1500,
            third_place: 500,
            platform_fee: 1500,
            participation_pool: 500,
        };
        assert!(!dist.is_valid()); // 总和 11000 != 10000
    }
}
