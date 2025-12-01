//! # AI 解读数据类型定义
//!
//! 本模块定义了通用 AI 解读系统所需的所有核心数据结构。
//! 支持多种玄学系统（梅花、八字、六爻等）的 AI 智能解读。

use codec::{Decode, DecodeWithMemTracking, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use pallet_divination_common::{DivinationType, InterpretationStatus, InterpretationType};
use scale_info::TypeInfo;

/// AI 解读请求结构
///
/// 存储完整的解读请求信息，支持多种占卜类型。
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct InterpretationRequest<AccountId, Balance, BlockNumber> {
    /// 请求 ID
    pub id: u64,
    /// 占卜类型（梅花、八字、六爻等）
    pub divination_type: DivinationType,
    /// 关联的占卜结果 ID（卦象 ID、命盘 ID 等）
    pub result_id: u64,
    /// 请求者账户
    pub requester: AccountId,
    /// 解读类型
    pub interpretation_type: InterpretationType,
    /// 当前状态
    pub status: InterpretationStatus,
    /// 支付的费用
    pub fee_paid: Balance,
    /// 创建时的区块号
    pub created_at: BlockNumber,
    /// 处理开始时的区块号（可选）
    pub processing_started_at: Option<BlockNumber>,
    /// 完成时的区块号（可选）
    pub completed_at: Option<BlockNumber>,
    /// 处理该请求的预言机节点（可选）
    pub oracle_node: Option<AccountId>,
    /// 用户提供的额外上下文（问题描述的哈希）
    pub context_hash: Option<[u8; 32]>,
}

/// AI 解读结果结构
///
/// 存储 AI 生成的解读结果
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
#[scale_info(skip_type_params(MaxCidLen))]
pub struct InterpretationResult<AccountId, BlockNumber, MaxCidLen: Get<u32>> {
    /// 关联的请求 ID
    pub request_id: u64,
    /// 解读内容的 IPFS CID
    pub content_cid: BoundedVec<u8, MaxCidLen>,
    /// 解读摘要的 IPFS CID（短版本，用于预览）
    pub summary_cid: Option<BoundedVec<u8, MaxCidLen>>,
    /// 提交解读的预言机节点
    pub oracle: AccountId,
    /// 提交时的区块号
    pub submitted_at: BlockNumber,
    /// 解读质量评分（0-100）
    pub quality_score: Option<u8>,
    /// 用户评分（1-5 星）
    pub user_rating: Option<u8>,
    /// AI 模型版本标识
    pub model_version: BoundedVec<u8, ConstU32<32>>,
    /// 解读语言（zh-CN, en-US 等）
    pub language: BoundedVec<u8, ConstU32<8>>,
}

/// 预言机节点信息
///
/// 存储已注册的 AI 解读预言机节点信息
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct OracleNode<AccountId, Balance, BlockNumber> {
    /// 节点账户
    pub account: AccountId,
    /// 节点名称（用于显示）
    pub name: BoundedVec<u8, ConstU32<64>>,
    /// 质押金额
    pub stake: Balance,
    /// 是否活跃
    pub is_active: bool,
    /// 注册时的区块号
    pub registered_at: BlockNumber,
    /// 已处理的请求数量
    pub requests_processed: u64,
    /// 成功完成的请求数量
    pub requests_succeeded: u64,
    /// 平均用户评分（0-500，对应 0.0-5.0 星）
    pub average_rating: u16,
    /// 最后活动时间（区块号）
    pub last_active_at: BlockNumber,
    /// 支持的占卜类型（位图）
    pub supported_divination_types: u8,
    /// 支持的解读类型（位图）
    pub supported_interpretation_types: u16,
}

impl<AccountId, Balance, BlockNumber> OracleNode<AccountId, Balance, BlockNumber> {
    /// 计算成功率（百分比 * 100）
    pub fn success_rate(&self) -> u32 {
        if self.requests_processed == 0 {
            return 10000; // 100%
        }
        ((self.requests_succeeded as u128 * 10000) / self.requests_processed as u128) as u32
    }

    /// 检查是否支持指定的占卜类型
    pub fn supports_divination_type(&self, divination_type: DivinationType) -> bool {
        let type_bit = 1u8 << (divination_type as u8);
        self.supported_divination_types & type_bit != 0
    }

    /// 检查是否支持指定的解读类型
    pub fn supports_interpretation_type(&self, interpretation_type: InterpretationType) -> bool {
        let type_bit = 1u16 << (interpretation_type as u16);
        self.supported_interpretation_types & type_bit != 0
    }
}

/// 解读争议结构
///
/// 当用户对解读结果不满意时可以提出争议
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct InterpretationDispute<AccountId, Balance, BlockNumber> {
    /// 争议 ID
    pub id: u64,
    /// 关联的请求 ID
    pub request_id: u64,
    /// 提出争议的用户
    pub disputer: AccountId,
    /// 争议原因（哈希）
    pub reason_hash: [u8; 32],
    /// 争议押金
    pub deposit: Balance,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 争议状态
    pub status: DisputeStatus,
    /// 仲裁结果（如果已处理）
    pub resolution: Option<DisputeResolution>,
}

/// 争议状态
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub enum DisputeStatus {
    /// 等待仲裁
    #[default]
    Pending = 0,
    /// 仲裁中
    UnderReview = 1,
    /// 已解决
    Resolved = 2,
    /// 已取消
    Cancelled = 3,
}

/// 争议解决结果
#[derive(Clone, Copy, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub enum DisputeResolution {
    /// 用户胜诉 - 退还费用
    UserWins = 0,
    /// 预言机胜诉 - 维持原判
    OracleWins = 1,
    /// 部分退款
    PartialRefund = 2,
    /// 重新解读
    Reinterpret = 3,
}

/// 费用分配配置
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug)]
pub struct FeeDistribution {
    /// 预言机获得的比例（万分比）
    pub oracle_share: u16,
    /// 国库获得的比例（万分比）
    pub treasury_share: u16,
    /// 销毁的比例（万分比）
    pub burn_share: u16,
    /// 质押池的比例（万分比）
    pub staking_pool_share: u16,
}

impl Default for FeeDistribution {
    fn default() -> Self {
        Self {
            oracle_share: 7000,      // 70%
            treasury_share: 2000,    // 20%
            burn_share: 500,         // 5%
            staking_pool_share: 500, // 5%
        }
    }
}

impl FeeDistribution {
    /// 验证费用分配配置是否有效（总和 = 100%）
    pub fn is_valid(&self) -> bool {
        self.oracle_share + self.treasury_share + self.burn_share + self.staking_pool_share == 10000
    }
}

/// 解读统计信息
///
/// 用于追踪整体系统状态
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub struct InterpretationStats {
    /// 总请求数
    pub total_requests: u64,
    /// 已完成请求数
    pub completed_requests: u64,
    /// 失败请求数
    pub failed_requests: u64,
    /// 总费用收入
    pub total_fees_collected: u128,
    /// 总争议数
    pub total_disputes: u64,
    /// 用户胜诉争议数
    pub disputes_user_wins: u64,
}

/// 按占卜类型的统计
#[derive(Clone, Encode, Decode, DecodeWithMemTracking, TypeInfo, MaxEncodedLen, PartialEq, Eq, Debug, Default)]
pub struct TypeInterpretationStats {
    /// 请求数量
    pub request_count: u64,
    /// 完成数量
    pub completed_count: u64,
    /// 失败数量
    pub failed_count: u64,
}
