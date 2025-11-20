//! # 数据类型定义 - Pallet AI Chat
//!
//! 本文件定义AI对话系统所需的所有数据结构。

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{pallet_prelude::*, BoundedVec};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

// =================== 对话会话相关 ===================

/// 函数级详细中文注释：对话状态枚举
///
/// ## 状态说明
/// - **Active**: 活跃中（可以继续对话）
/// - **Paused**: 已暂停（用户暂时停止对话）
/// - **Archived**: 已归档（对话已结束并保存）
/// - **Expired**: 已过期（超过有效期，需要重新激活）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum ConversationStatus {
    /// 活跃中
    Active = 0,
    /// 已暂停
    Paused = 1,
    /// 已归档
    Archived = 2,
    /// 已过期
    Expired = 3,
}

impl Default for ConversationStatus {
    fn default() -> Self {
        Self::Active
    }
}

impl ConversationStatus {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            ConversationStatus::Active => 0,
            ConversationStatus::Paused => 1,
            ConversationStatus::Archived => 2,
            ConversationStatus::Expired => 3,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => ConversationStatus::Active,
            1 => ConversationStatus::Paused,
            2 => ConversationStatus::Archived,
            3 => ConversationStatus::Expired,
            _ => ConversationStatus::Active,
        }
    }
}

/// 函数级详细中文注释：对话会话记录
///
/// ## 字段说明
/// - `session_id`: 会话ID（全局唯一）
/// - `deceased_id`: 逝者ID（对话的目标智能体）
/// - `user_id`: 用户账户
/// - `agent_id`: 使用的AI智能体ID（可选，如果未指定则使用默认）
/// - `status`: 会话状态
/// - `created_at`: 创建时间（区块号）
/// - `last_active`: 最后活跃时间（区块号）
/// - `message_count`: 消息数量
/// - `quality_score`: 整体质量评分（0-100，可选）
/// - `user_rating`: 用户主观评分（0-5，可选）
///
/// ## 生命周期管理
/// - Active → Paused: 用户主动暂停
/// - Active → Archived: 对话正常结束
/// - Active → Expired: 超过有效期（如30天无活动）
/// - Paused → Active: 用户恢复对话
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(AccountId, DeceasedId, BlockNumber))]
pub struct Conversation<AccountId, DeceasedId, BlockNumber> {
    /// 会话ID
    pub session_id: u64,

    /// 逝者ID
    pub deceased_id: DeceasedId,

    /// 用户账户
    pub user_id: AccountId,

    /// AI智能体ID（可选）
    pub agent_id: Option<u64>,

    /// 会话状态
    pub status: ConversationStatus,

    /// 创建时间
    pub created_at: BlockNumber,

    /// 最后活跃时间
    pub last_active: BlockNumber,

    /// 消息数量
    pub message_count: u32,

    /// 整体质量评分（0-100）
    pub quality_score: Option<u8>,

    /// 用户评分（0-5）
    pub user_rating: Option<u8>,
}

// =================== 消息相关 ===================

/// 函数级详细中文注释：消息角色枚举
///
/// ## 角色说明
/// - **User**: 用户发送的消息
/// - **Assistant**: AI助手（逝者智能体）的响应
/// - **System**: 系统提示消息（如个性化提示）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum MessageRole {
    /// 用户
    User = 0,
    /// AI助手
    Assistant = 1,
    /// 系统
    System = 2,
}

impl MessageRole {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            MessageRole::User => 0,
            MessageRole::Assistant => 1,
            MessageRole::System => 2,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => MessageRole::User,
            1 => MessageRole::Assistant,
            2 => MessageRole::System,
            _ => MessageRole::User,
        }
    }
}

/// 函数级详细中文注释：聊天消息记录
///
/// ## 字段说明
/// - `message_id`: 消息ID（全局唯一）
/// - `session_id`: 所属会话ID
/// - `role`: 消息角色（User/Assistant/System）
/// - `content`: 消息内容（最多4000字符）
/// - `timestamp`: 时间戳（Unix时间，秒）
/// - `quality_rating`: 质量评分（0-100，仅Assistant消息）
/// - `user_feedback`: 用户反馈（1=点赞，-1=点踩，0=无反馈）
/// - `response_time`: 响应时间（毫秒，仅Assistant消息）
/// - `token_count`: Token消耗数量（可选）
///
/// ## 存储优化
/// - 消息内容最多4000字符，超长内容存储在IPFS
/// - 历史消息可以周期性归档到链下存储
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct ChatMessage {
    /// 消息ID
    pub message_id: u64,

    /// 会话ID
    pub session_id: u64,

    /// 消息角色
    pub role: MessageRole,

    /// 消息内容
    pub content: BoundedVec<u8, ConstU32<4000>>,

    /// 时间戳（Unix秒）
    pub timestamp: u64,

    /// 质量评分（0-100，可选）
    pub quality_rating: Option<u8>,

    /// 用户反馈（-1, 0, 1）
    pub user_feedback: i8,

    /// 响应时间（毫秒，可选）
    pub response_time: Option<u32>,

    /// Token消耗（可选）
    pub token_count: Option<u32>,
}

// =================== 质量评估相关 ===================

/// 函数级详细中文注释：质量评估指标
///
/// ## 评分维度（均为0-100）
/// - `relevance_score`: 相关性 - 回答是否贴近问题
/// - `personality_match`: 人格匹配度 - 是否符合逝者性格
/// - `emotional_authenticity`: 情感真实性 - 情感表达是否自然
/// - `factual_accuracy`: 事实准确性 - 信息是否准确
/// - `response_quality`: 响应质量 - 语言流畅度、逻辑性
/// - `user_satisfaction`: 用户满意度 - 用户主观评价
///
/// ## 计算方式
/// - 自动评估：通过算法计算前5项
/// - 用户评估：第6项由用户直接评分
/// - 综合评分 = 加权平均值
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct QualityMetrics {
    /// 相关性评分（0-100）
    pub relevance_score: u8,

    /// 人格匹配度（0-100）
    pub personality_match: u8,

    /// 情感真实性（0-100）
    pub emotional_authenticity: u8,

    /// 事实准确性（0-100）
    pub factual_accuracy: u8,

    /// 响应质量（0-100）
    pub response_quality: u8,

    /// 用户满意度（0-100，可选）
    pub user_satisfaction: Option<u8>,
}

impl QualityMetrics {
    /// 函数级中文注释：计算综合评分
    ///
    /// 权重分配：
    /// - relevance_score: 20%
    /// - personality_match: 25%
    /// - emotional_authenticity: 20%
    /// - factual_accuracy: 15%
    /// - response_quality: 20%
    /// - user_satisfaction: 额外加权（如果有）
    pub fn overall_score(&self) -> u8 {
        let weighted_sum = (self.relevance_score as u32 * 20
            + self.personality_match as u32 * 25
            + self.emotional_authenticity as u32 * 20
            + self.factual_accuracy as u32 * 15
            + self.response_quality as u32 * 20)
            / 100;

        // 如果有用户满意度，进行二次加权
        if let Some(user_score) = self.user_satisfaction {
            // 用户满意度占30%，算法评分占70%
            ((weighted_sum * 70 + user_score as u32 * 30) / 100) as u8
        } else {
            weighted_sum as u8
        }
    }
}

// =================== 个性化配置相关 ===================

/// 函数级详细中文注释：风格类型枚举
///
/// ## 风格说明
/// - **Formal**: 正式 - 规范的书面语
/// - **Casual**: 随意 - 口语化表达
/// - **Humorous**: 幽默 - 轻松诙谐的风格
/// - **Philosophical**: 哲学性 - 深刻思考的表达
/// - **Technical**: 技术性 - 专业术语丰富
/// - **Emotional**: 情感丰富 - 感情色彩浓厚
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum StyleType {
    /// 正式
    Formal = 0,
    /// 随意
    Casual = 1,
    /// 幽默
    Humorous = 2,
    /// 哲学性
    Philosophical = 3,
    /// 技术性
    Technical = 4,
    /// 情感丰富
    Emotional = 5,
}

impl StyleType {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            StyleType::Formal => 0,
            StyleType::Casual => 1,
            StyleType::Humorous => 2,
            StyleType::Philosophical => 3,
            StyleType::Technical => 4,
            StyleType::Emotional => 5,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => StyleType::Formal,
            1 => StyleType::Casual,
            2 => StyleType::Humorous,
            3 => StyleType::Philosophical,
            4 => StyleType::Technical,
            5 => StyleType::Emotional,
            _ => StyleType::Casual,
        }
    }
}

/// 函数级详细中文注释：风格标签
///
/// ## 字段说明
/// - `tag_type`: 风格类型
/// - `weight`: 权重（0-100）
/// - `description`: 描述（可选，最多200字符）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct StyleTag {
    /// 风格类型
    pub tag_type: StyleType,

    /// 权重（0-100）
    pub weight: u8,

    /// 描述（可选）
    pub description: Option<BoundedVec<u8, ConstU32<200>>>,
}

/// 函数级详细中文注释：个性化配置
///
/// ## 字段说明
/// - `deceased_id`: 逝者ID
/// - `agent_id`: 智能体ID
/// - `base_prompt`: 基础提示词（最多2000字符）
/// - `style_tags`: 风格标签列表（最多10个）
/// - `temperature`: 温度参数（0-100，对应0.0-2.0）
/// - `max_tokens`: 最大token数
/// - `top_p`: Top-p采样参数（0-100，对应0.0-1.0）
/// - `frequency_penalty`: 频率惩罚（0-100，对应0.0-2.0）
/// - `presence_penalty`: 存在惩罚（0-100，对应0.0-2.0）
///
/// ## 使用场景
/// - 用于生成个性化的AI提示
/// - 调整AI模型参数以匹配逝者风格
/// - 支持动态学习和优化
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
#[scale_info(skip_type_params(DeceasedId))]
pub struct PersonalityConfig<DeceasedId> {
    /// 逝者ID
    pub deceased_id: DeceasedId,

    /// 智能体ID
    pub agent_id: u64,

    /// 基础提示词
    pub base_prompt: BoundedVec<u8, ConstU32<2000>>,

    /// 风格标签（最多10个）
    pub style_tags: BoundedVec<StyleTag, ConstU32<10>>,

    /// 温度参数（0-100）
    pub temperature: u8,

    /// 最大token数
    pub max_tokens: u32,

    /// Top-p参数（0-100）
    pub top_p: u8,

    /// 频率惩罚（0-100）
    pub frequency_penalty: u8,

    /// 存在惩罚（0-100）
    pub presence_penalty: u8,
}

// =================== API配置相关 ===================

/// 函数级详细中文注释：AI服务提供商类型
///
/// ## 支持的服务商
/// - **OpenAI**: GPT-3.5/GPT-4
/// - **Anthropic**: Claude系列
/// - **Alibaba**: 通义千问
/// - **Baidu**: 文心一言
/// - **Custom**: 自定义模型（本地部署）
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub enum AIProvider {
    /// OpenAI
    OpenAI = 0,
    /// Anthropic
    Anthropic = 1,
    /// 阿里云
    Alibaba = 2,
    /// 百度
    Baidu = 3,
    /// 自定义
    Custom = 4,
}

impl AIProvider {
    /// 函数级中文注释：转换为u8代码
    pub fn to_u8(&self) -> u8 {
        match self {
            AIProvider::OpenAI => 0,
            AIProvider::Anthropic => 1,
            AIProvider::Alibaba => 2,
            AIProvider::Baidu => 3,
            AIProvider::Custom => 4,
        }
    }

    /// 函数级中文注释：从u8代码转换
    pub fn from_u8(code: u8) -> Self {
        match code {
            0 => AIProvider::OpenAI,
            1 => AIProvider::Anthropic,
            2 => AIProvider::Alibaba,
            3 => AIProvider::Baidu,
            4 => AIProvider::Custom,
            _ => AIProvider::OpenAI,
        }
    }
}

/// 函数级详细中文注释：API配置
///
/// ## 字段说明
/// - `provider`: AI服务提供商
/// - `api_endpoint`: API端点URL
/// - `model_name`: 模型名称（如gpt-4, claude-3）
/// - `api_key_hash`: API密钥哈希（安全存储）
/// - `enabled`: 是否启用
/// - `priority`: 优先级（0-100，数值越大优先级越高）
/// - `rate_limit`: 速率限制（每分钟请求数）
/// - `timeout`: 超时时间（秒）
///
/// ## 安全性
/// - API密钥不直接存储，仅存储哈希值
/// - 实际密钥通过链下安全存储管理
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct APIConfig {
    /// AI服务提供商
    pub provider: AIProvider,

    /// API端点
    pub api_endpoint: BoundedVec<u8, ConstU32<200>>,

    /// 模型名称
    pub model_name: BoundedVec<u8, ConstU32<50>>,

    /// API密钥哈希
    pub api_key_hash: [u8; 32],

    /// 是否启用
    pub enabled: bool,

    /// 优先级（0-100）
    pub priority: u8,

    /// 速率限制（每分钟）
    pub rate_limit: u32,

    /// 超时时间（秒）
    pub timeout: u32,
}

// =================== OCW请求/响应相关 ===================

/// 函数级详细中文注释：OCW AI请求
///
/// ## 字段说明
/// - `request_id`: 请求ID（全局唯一）
/// - `session_id`: 会话ID
/// - `message_id`: 消息ID
/// - `prompt`: 完整提示词（包含个性化配置）
/// - `config_id`: API配置ID
/// - `created_at`: 创建时间（区块号）
/// - `status`: 请求状态（0=pending, 1=processing, 2=completed, 3=failed）
///
/// ## 工作流程
/// 1. 用户发送消息 → 创建OCW请求
/// 2. OCW worker检测到请求 → 调用AI API
/// 3. 获取响应 → 更新请求状态 → 存储响应消息
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct OCWRequest<BlockNumber> {
    /// 请求ID
    pub request_id: u64,

    /// 会话ID
    pub session_id: u64,

    /// 消息ID
    pub message_id: u64,

    /// 完整提示词
    pub prompt: BoundedVec<u8, ConstU32<8000>>,

    /// API配置ID
    pub config_id: u64,

    /// 创建时间
    pub created_at: BlockNumber,

    /// 请求状态（0-3）
    pub status: u8,
}

/// 函数级详细中文注释：OCW AI响应
///
/// ## 字段说明
/// - `request_id`: 对应的请求ID
/// - `response_content`: AI响应内容
/// - `token_used`: 消耗的token数
/// - `response_time`: 响应时间（毫秒）
/// - `quality_metrics`: 质量评估指标
/// - `error_message`: 错误消息（如果失败）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, RuntimeDebug)]
pub struct OCWResponse {
    /// 请求ID
    pub request_id: u64,

    /// 响应内容
    pub response_content: BoundedVec<u8, ConstU32<4000>>,

    /// 消耗token数
    pub token_used: u32,

    /// 响应时间（毫秒）
    pub response_time: u32,

    /// 质量评估
    pub quality_metrics: QualityMetrics,

    /// 错误消息（可选）
    pub error_message: Option<BoundedVec<u8, ConstU32<500>>>,
}
