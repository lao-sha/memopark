//! # 数据类型定义 - Pallet Deceased AI
//!
//! 本文件定义所有用于AI训练准备层的数据结构。

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{pallet_prelude::*, BoundedVec};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;
use sp_std::vec::Vec;

// =================== AI服务提供商相关 ===================

/// 函数级详细中文注释：AI服务提供商注册信息
///
/// ## 字段说明
/// - `account`: 服务提供商账户
/// - `name`: 服务名称（最多100字符）
/// - `description`: 服务描述（最多500字符）
/// - `api_endpoint`: API端点（最多200字符）
/// - `verified`: 是否已验证（需要治理审核）
/// - `monthly_quota`: 月度数据访问配额
/// - `used_quota`: 本月已使用配额
/// - `registered_at`: 注册时间（区块号）
/// - `last_active`: 最后活跃时间（区块号）
///
/// ## 配额机制
/// - 每月重置 `used_quota` 为0
/// - 每次查询消耗相应配额
/// - 配额耗尽后无法查询数据
/// - 可通过治理调整 `monthly_quota`
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, BlockNumber))]
pub struct AIServiceProvider<AccountId, BlockNumber> {
    /// 服务提供商账户
    pub account: AccountId,

    /// 服务名称
    pub name: BoundedVec<u8, ConstU32<100>>,

    /// 服务描述
    pub description: BoundedVec<u8, ConstU32<500>>,

    /// API端点
    pub api_endpoint: BoundedVec<u8, ConstU32<200>>,

    /// 是否已验证
    pub verified: bool,

    /// 月度配额
    pub monthly_quota: u32,

    /// 已使用配额
    pub used_quota: u32,

    /// 注册时间
    pub registered_at: BlockNumber,

    /// 最后活跃时间
    pub last_active: BlockNumber,
}

// =================== 训练任务相关 ===================

/// 函数级详细中文注释：训练状态枚举
///
/// ## 状态流转
/// Pending → PreparingData → Training → Completed/Failed/Cancelled
///
/// ## 状态说明
/// - **Pending**: 待处理（刚创建）
/// - **PreparingData**: 数据准备中（下载和预处理）
/// - **Training**: 训练中（模型训练阶段）
/// - **Completed**: 已完成（训练成功）
/// - **Failed**: 失败（训练过程出错）
/// - **Cancelled**: 已取消（用户主动取消）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum TrainingStatus {
    /// 待处理
    Pending = 0,
    /// 数据准备中
    PreparingData = 1,
    /// 训练中
    Training = 2,
    /// 已完成
    Completed = 3,
    /// 失败
    Failed = 4,
    /// 已取消
    Cancelled = 5,
}

impl Default for TrainingStatus {
    fn default() -> Self {
        Self::Pending
    }
}

impl TrainingStatus {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            TrainingStatus::Pending => 0,
            TrainingStatus::PreparingData => 1,
            TrainingStatus::Training => 2,
            TrainingStatus::Completed => 3,
            TrainingStatus::Failed => 4,
            TrainingStatus::Cancelled => 5,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => TrainingStatus::Pending,
            1 => TrainingStatus::PreparingData,
            2 => TrainingStatus::Training,
            3 => TrainingStatus::Completed,
            4 => TrainingStatus::Failed,
            5 => TrainingStatus::Cancelled,
            _ => TrainingStatus::Pending,
        }
    }
}

/// 函数级详细中文注释：AI训练任务记录
///
/// ## 字段说明
/// - `task_id`: 任务ID（全局唯一）
/// - `deceased_id`: 逝者ID
/// - `provider_id`: AI服务提供商ID
/// - `dataset_hash`: 训练数据集快照哈希（Blake2-256）
/// - `work_ids`: 包含的作品ID列表（最多1000个）
/// - `status`: 训练状态
/// - `created_at`: 创建时间（区块号）
/// - `completed_at`: 完成时间（可选，区块号）
/// - `result_cid`: 训练结果CID（可选，IPFS存储）
///
/// ## 数据完整性
/// - `dataset_hash`: 使用Blake2-256计算数据集哈希，确保数据不可篡改
/// - `work_ids`: 记录所有用于训练的作品ID，用于溯源
/// - `result_cid`: 训练结果存储在IPFS，链上仅存储CID
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(DeceasedId, BlockNumber))]
pub struct TrainingTask<DeceasedId, BlockNumber> {
    /// 任务ID
    pub task_id: u64,

    /// 逝者ID
    pub deceased_id: DeceasedId,

    /// AI服务提供商ID
    pub provider_id: u64,

    /// 训练数据集快照哈希
    pub dataset_hash: [u8; 32],

    /// 包含的作品ID列表（最多1000个）
    pub work_ids: BoundedVec<u64, ConstU32<1000>>,

    /// 训练状态
    pub status: TrainingStatus,

    /// 创建时间
    pub created_at: BlockNumber,

    /// 完成时间（可选）
    pub completed_at: Option<BlockNumber>,

    /// 结果CID（IPFS存储训练结果）
    pub result_cid: Option<BoundedVec<u8, ConstU32<64>>>,
}

// =================== AI智能体相关 ===================

/// 函数级详细中文注释：AI模型类型枚举
///
/// ## 类型说明
/// - **TextGeneration**: 文本生成（GPT类）
/// - **VoiceSynthesis**: 语音合成（TTS）
/// - **VideoGeneration**: 视频生成
/// - **Multimodal**: 多模态（文本+语音+视频）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum AIModelType {
    /// 文本生成（GPT类）
    TextGeneration = 0,
    /// 语音合成
    VoiceSynthesis = 1,
    /// 视频生成
    VideoGeneration = 2,
    /// 多模态
    Multimodal = 3,
}

impl AIModelType {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            AIModelType::TextGeneration => 0,
            AIModelType::VoiceSynthesis => 1,
            AIModelType::VideoGeneration => 2,
            AIModelType::Multimodal => 3,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => AIModelType::TextGeneration,
            1 => AIModelType::VoiceSynthesis,
            2 => AIModelType::VideoGeneration,
            3 => AIModelType::Multimodal,
            _ => AIModelType::TextGeneration,
        }
    }
}

/// 函数级详细中文注释：部署状态枚举
///
/// ## 状态说明
/// - **Testing**: 测试中（模型正在测试阶段）
/// - **Live**: 已上线（模型可供用户使用）
/// - **Offline**: 已下线（模型暂停服务）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum DeploymentStatus {
    /// 测试中
    Testing = 0,
    /// 已上线
    Live = 1,
    /// 已下线
    Offline = 2,
}

impl Default for DeploymentStatus {
    fn default() -> Self {
        Self::Testing
    }
}

impl DeploymentStatus {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            DeploymentStatus::Testing => 0,
            DeploymentStatus::Live => 1,
            DeploymentStatus::Offline => 2,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => DeploymentStatus::Testing,
            1 => DeploymentStatus::Live,
            2 => DeploymentStatus::Offline,
            _ => DeploymentStatus::Testing,
        }
    }
}

/// 函数级详细中文注释：AI智能体元数据
///
/// ## 字段说明
/// - `agent_id`: 智能体ID（全局唯一）
/// - `deceased_id`: 关联的逝者ID
/// - `task_id`: 训练任务ID
/// - `provider_id`: 训练提供商ID
/// - `version`: 模型版本号
/// - `model_cid`: 模型CID（IPFS存储）
/// - `model_type`: 模型类型
/// - `deployment_status`: 部署状态
/// - `created_at`: 创建时间（区块号）
/// - `updated_at`: 最后更新时间（区块号）
///
/// ## 版本管理
/// - 每个逝者可以有多个智能体（不同版本/类型）
/// - 通过 `version` 字段追踪迭代
/// - 通过 `model_type` 字段区分不同功能的智能体
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(DeceasedId, BlockNumber))]
pub struct AIAgent<DeceasedId, BlockNumber> {
    /// 智能体ID
    pub agent_id: u64,

    /// 关联的逝者ID
    pub deceased_id: DeceasedId,

    /// 训练任务ID
    pub task_id: u64,

    /// 训练提供商ID
    pub provider_id: u64,

    /// 模型版本
    pub version: u32,

    /// 模型CID（IPFS存储）
    pub model_cid: BoundedVec<u8, ConstU32<64>>,

    /// 模型类型
    pub model_type: AIModelType,

    /// 部署状态
    pub deployment_status: DeploymentStatus,

    /// 创建时间
    pub created_at: BlockNumber,

    /// 最后更新时间
    pub updated_at: BlockNumber,
}

// =================== 数据导出相关 ===================

/// 函数级详细中文注释：导出的作品数据（用于AI训练）
///
/// ## 字段说明（完整版）
/// - `work_id`: 作品ID
/// - `deceased_id`: 逝者ID
/// - `work_type_str`: 作品类型字符串
/// - `title`: 标题
/// - `description`: 描述
/// - `ipfs_cid`: IPFS CID
/// - `file_size`: 文件大小
/// - `created_at`: 创作时间（可选）
/// - `tags`: 标签列表
/// - `sentiment`: 情感倾向（可选）
/// - `style_tags`: 风格标签
/// - `expertise_fields`: 专业领域标签
/// - `ai_weight`: AI训练权重（0-100）
///
/// ## 隐私保护
/// - **已脱敏字段**: 不包含uploader账户信息
/// - **隐私级别遵守**: 仅导出授权AI训练的作品
/// - **敏感信息过滤**: 不包含私人账户相关数据
///
/// ## 数据格式
/// - 链上使用SCALE编码存储
/// - 通过RPC导出时转换为JSON格式
/// - 便于AI训练系统使用
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub struct ExportedWork {
    /// 作品ID
    pub work_id: u64,

    /// 逝者ID
    pub deceased_id: u64,

    /// 作品类型字符串
    pub work_type_str: BoundedVec<u8, ConstU32<50>>,

    /// 标题
    pub title: BoundedVec<u8, ConstU32<200>>,

    /// 描述
    pub description: BoundedVec<u8, ConstU32<1000>>,

    /// IPFS CID
    pub ipfs_cid: BoundedVec<u8, ConstU32<64>>,

    /// 文件大小
    pub file_size: u64,

    /// 创作时间（可选，Unix时间戳）
    pub created_at: Option<u64>,

    /// 标签
    pub tags: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<20>>,

    /// 情感倾向（-100到100，可选）
    pub sentiment: Option<i8>,

    /// 风格标签
    pub style_tags: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<10>>,

    /// 专业领域标签
    pub expertise_fields: BoundedVec<BoundedVec<u8, ConstU32<50>>, ConstU32<10>>,

    /// AI训练权重（0-100）
    pub ai_weight: u8,
}

/// 函数级详细中文注释：批量导出响应结构
///
/// ## 字段说明
/// - `works`: 作品列表
/// - `total_count`: 总数量（用于分页）
/// - `offset`: 当前批次偏移
/// - `has_more`: 是否还有更多数据
/// - `dataset_hash`: 数据集哈希（用于验证）
///
/// ## 分页机制
/// - 支持分批导出大量数据
/// - 通过 `offset` 和 `has_more` 控制分页
/// - 客户端可根据 `total_count` 计算总页数
///
/// ## 数据完整性
/// - `dataset_hash`: 整个数据集的Blake2-256哈希
/// - 用于验证导出数据的完整性
/// - 确保训练数据不被篡改
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub struct BatchExportResponse {
    /// 作品列表
    pub works: Vec<ExportedWork>,

    /// 总数量
    pub total_count: u32,

    /// 当前批次偏移
    pub offset: u32,

    /// 是否还有更多数据
    pub has_more: bool,

    /// 数据集哈希（用于验证）
    pub dataset_hash: [u8; 32],
}

// =================== Trait定义 ===================

/// 函数级详细中文注释：逝者数据提供者Trait
///
/// ## 目的
/// - 定义访问pallet-deceased数据的接口
/// - 保持低耦合，不直接依赖deceased pallet实现
/// - 便于测试和模拟
///
/// ## 方法
/// - `deceased_exists`: 检查逝者是否存在
/// - `is_deceased_owner`: 检查是否为逝者owner
/// - `get_deceased_works`: 获取逝者的作品列表
/// - `get_work_details`: 获取作品详细信息
/// - `get_ai_training_works`: 获取授权AI训练的作品
///
/// ## 实现
/// - 由pallet-deceased提供具体实现
/// - 通过runtime配置注入
pub trait DeceasedDataProvider<DeceasedId, AccountId = ()> {
    /// 函数级中文注释：检查逝者是否存在
    fn deceased_exists(deceased_id: DeceasedId) -> bool;

    /// 函数级中文注释：检查是否为逝者owner
    fn is_deceased_owner(who: &AccountId, deceased_id: DeceasedId) -> bool
    where
        AccountId: PartialEq;

    /// 函数级中文注释：获取逝者的作品ID列表
    /// - 返回：(work_ids, total_count)
    fn get_deceased_works(
        deceased_id: DeceasedId,
        offset: u32,
        limit: u32,
    ) -> Result<(Vec<u64>, u32), sp_runtime::DispatchError>;

    /// 函数级中文注释：获取作品详细信息（用于导出）
    fn get_work_details(work_id: u64) -> Result<ExportedWork, sp_runtime::DispatchError>;

    /// 函数级中文注释：获取授权AI训练的作品ID列表
    fn get_ai_training_works(
        deceased_id: DeceasedId,
    ) -> Result<Vec<u64>, sp_runtime::DispatchError>;
}
