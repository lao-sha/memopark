//! # Pallet AI Chat - AI对话集成层
//!
//! ## 概述
//!
//! 本pallet实现AI对话服务，作为Phase 3的核心模块，提供：
//! - 实时对话管理
//! - AI API集成（通过OCW）
//! - 个性化对话引擎
//! - 质量评估体系
//!
//! ## 架构
//!
//! ### 三层架构
//! - Layer 1 (pallet-deceased): 数据存储 - 作品、元数据
//! - Layer 2 (pallet-deceased-ai): AI准备 - 服务管理、训练任务
//! - Layer 3 (pallet-ai-chat): AI集成 - 对话服务、实时交互
//!
//! ### 工作流程
//! ```text
//! 用户 → 发送消息 → pallet-ai-chat
//!  ↓
//! 创建OCW请求 → 链下工作机
//!  ↓
//! 调用AI API → 获取响应
//!  ↓
//! 质量评估 → 存储响应 → 返回用户
//! ```
//!
//! ## 功能模块
//!
//! ### 1. 对话管理
//! - 创建/结束会话
//! - 发送/接收消息
//! - 会话状态管理
//! - 历史记录查询
//!
//! ### 2. 个性化引擎
//! - 风格标签系统
//! - 提示词生成
//! - 参数动态调优
//! - 上下文记忆
//!
//! ### 3. OCW AI集成
//! - 外部API调用
//! - 多服务商支持
//! - 负载均衡
//! - 错误重试
//!
//! ### 4. 质量评估
//! - 多维度自动评估
//! - 用户反馈收集
//! - 性能监控
//! - 质量报告
//!
//! ## 版本历史
//!
//! - v0.1.0 (2025-11-13): Phase 3开始 - 基础架构

#![cfg_attr(not(feature = "std"), no_std)]

// 导入 alloc（用于 format! 等宏）
extern crate alloc;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod weights;
pub use weights::*;

// 导入类型定义
mod types;
pub use types::*;

use frame_support::{
    pallet_prelude::*,
    traits::Get,
    BoundedVec,
};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::AtLeast32BitUnsigned;

// 导入 DeceasedDataProvider trait
use pallet_deceased_ai::DeceasedDataProvider;

/// 函数级详细中文注释：权重信息trait（后续通过benchmarking生成）
pub trait WeightInfo {
    fn create_conversation() -> Weight;
    fn send_message() -> Weight;
    fn update_conversation_status() -> Weight;
    fn rate_message() -> Weight;
    fn update_personality_config() -> Weight;
    fn add_api_config() -> Weight;
    fn update_api_config() -> Weight;
    fn submit_ocw_response() -> Weight;
}

/// 函数级详细中文注释：默认权重实现（开发阶段使用）
impl WeightInfo for () {
    fn create_conversation() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn send_message() -> Weight {
        Weight::from_parts(20_000, 0)
    }
    fn update_conversation_status() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn rate_message() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn update_personality_config() -> Weight {
        Weight::from_parts(15_000, 0)
    }
    fn add_api_config() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn update_api_config() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn submit_ocw_response() -> Weight {
        Weight::from_parts(30_000, 0)
    }
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级详细中文注释：Pallet配置trait
    ///
    /// ## 依赖关系
    /// - DeceasedProvider: 访问pallet-deceased的数据
    /// - AIProvider: 访问pallet-deceased-ai的AI服务信息
    /// - GovernanceOrigin: 治理权限（API配置管理）
    ///
    /// ## 配置参数
    /// - MaxMessagesPerSession: 单个会话最大消息数（1000条）
    /// - MaxActiveConversations: 单用户最大活跃会话数（10个）
    /// - SessionExpiryBlocks: 会话过期区块数（30天）
    #[pallet::config]
    pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
        /// 逝者ID类型（与pallet-deceased保持一致）
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 函数级中文注释：逝者数据提供者（访问pallet-deceased）
        type DeceasedProvider: pallet_deceased_ai::DeceasedDataProvider<Self::DeceasedId, Self::AccountId>;

        /// 治理起源（用于API配置管理）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 权重信息
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：单个会话最大消息数
        /// 推荐值：1000条
        #[pallet::constant]
        type MaxMessagesPerSession: Get<u32>;

        /// 函数级中文注释：单用户最大活跃会话数
        /// 推荐值：10个
        #[pallet::constant]
        type MaxActiveConversations: Get<u32>;

        /// 函数级中文注释：会话过期区块数
        /// 推荐值：30天 = 30 * 24 * 3600 / 6 = 432000区块（6秒出块）
        #[pallet::constant]
        type SessionExpiryBlocks: Get<BlockNumberFor<Self>>;
    }

    // =================== 存储项 ===================

    /// 函数级详细中文注释：下一个会话ID
    #[pallet::storage]
    #[pallet::getter(fn next_session_id)]
    pub type NextSessionId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：对话会话记录
    /// - Key: session_id (u64)
    /// - Value: Conversation结构
    #[pallet::storage]
    #[pallet::getter(fn conversations)]
    pub type Conversations<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // session_id
        Conversation<T::AccountId, T::DeceasedId, BlockNumberFor<T>>,
    >;

    /// 函数级详细中文注释：用户的会话列表
    /// - Key: AccountId
    /// - Value: Vec<session_id>（最多50个）
    #[pallet::storage]
    pub type ConversationsByUser<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, ConstU32<50>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：逝者的会话列表
    /// - Key: DeceasedId
    /// - Value: Vec<session_id>（最多200个）
    #[pallet::storage]
    pub type ConversationsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<u64, ConstU32<200>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：下一个消息ID
    #[pallet::storage]
    #[pallet::getter(fn next_message_id)]
    pub type NextMessageId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：聊天消息记录
    /// - Key: message_id (u64)
    /// - Value: ChatMessage结构
    #[pallet::storage]
    #[pallet::getter(fn messages)]
    pub type Messages<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // message_id
        ChatMessage,
    >;

    /// 函数级详细中文注释：会话的消息列表
    /// - Key: session_id
    /// - Value: Vec<message_id>（最多1000个）
    #[pallet::storage]
    pub type MessagesBySession<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // session_id
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：个性化配置
    /// - Key: (deceased_id, agent_id)
    /// - Value: PersonalityConfig结构
    #[pallet::storage]
    pub type PersonalityConfigs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (T::DeceasedId, u64),  // (deceased_id, agent_id)
        PersonalityConfig<T::DeceasedId>,
    >;

    /// 函数级详细中文注释：下一个API配置ID
    #[pallet::storage]
    #[pallet::getter(fn next_api_config_id)]
    pub type NextAPIConfigId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：API配置
    /// - Key: config_id (u64)
    /// - Value: APIConfig结构
    #[pallet::storage]
    #[pallet::getter(fn api_configs)]
    pub type APIConfigs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // config_id
        APIConfig,
    >;

    /// 函数级详细中文注释：下一个OCW请求ID
    #[pallet::storage]
    #[pallet::getter(fn next_ocw_request_id)]
    pub type NextOCWRequestId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：OCW请求队列
    /// - Key: request_id (u64)
    /// - Value: OCWRequest结构
    #[pallet::storage]
    pub type OCWRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // request_id
        OCWRequest<BlockNumberFor<T>>,
    >;

    /// 函数级详细中文注释：待处理的OCW请求列表
    /// 用于OCW worker快速查找
    #[pallet::storage]
    pub type PendingOCWRequests<T: Config> = StorageValue<
        _,
        BoundedVec<u64, ConstU32<100>>,
        ValueQuery,
    >;

    // =================== 事件 ===================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    #[allow(dead_code)]  // 暂时允许，等实现extrinsics后会使用
    pub enum Event<T: Config> {
        /// 函数级中文注释：对话会话已创建
        /// - session_id: 会话ID
        /// - user_id: 用户账户
        /// - deceased_id: 逝者ID
        ConversationCreated {
            session_id: u64,
            user_id: T::AccountId,
            deceased_id: T::DeceasedId,
        },

        /// 函数级中文注释：消息已发送
        /// - message_id: 消息ID
        /// - session_id: 会话ID
        /// - role: 消息角色（u8代码）
        MessageSent {
            message_id: u64,
            session_id: u64,
            role: u8,
        },

        /// 函数级中文注释：会话状态已更新
        /// - session_id: 会话ID
        /// - new_status: 新状态（u8代码）
        ConversationStatusUpdated {
            session_id: u64,
            new_status: u8,
        },

        /// 函数级中文注释：消息已评分
        /// - message_id: 消息ID
        /// - feedback: 反馈（-1/0/1）
        MessageRated {
            message_id: u64,
            feedback: i8,
        },

        /// 函数级中文注释：个性化配置已更新
        /// - deceased_id: 逝者ID
        /// - agent_id: 智能体ID
        PersonalityConfigUpdated {
            deceased_id: T::DeceasedId,
            agent_id: u64,
        },

        /// 函数级中文注释：API配置已添加
        /// - config_id: 配置ID
        /// - provider: 服务商（u8代码）
        APIConfigAdded {
            config_id: u64,
            provider: u8,
        },

        /// 函数级中文注释：API配置已更新
        /// - config_id: 配置ID
        APIConfigUpdated {
            config_id: u64,
        },

        /// 函数级中文注释：OCW请求已创建
        /// - request_id: 请求ID
        /// - session_id: 会话ID
        OCWRequestCreated {
            request_id: u64,
            session_id: u64,
        },

        /// 函数级中文注释：OCW响应已提交
        /// - request_id: 请求ID
        /// - message_id: 响应消息ID
        OCWResponseSubmitted {
            request_id: u64,
            message_id: u64,
        },
    }

    // =================== 错误 ===================

    #[pallet::error]
    pub enum Error<T> {
        /// 函数级中文注释：会话不存在
        ConversationNotFound,

        /// 函数级中文注释：消息不存在
        MessageNotFound,

        /// 函数级中文注释：无权限
        NotAuthorized,

        /// 函数级中文注释：会话已过期
        ConversationExpired,

        /// 函数级中文注释：会话已归档
        ConversationArchived,

        /// 函数级中文注释：活跃会话过多
        TooManyActiveConversations,

        /// 函数级中文注释：消息过多
        TooManyMessages,

        /// 函数级中文注释：消息内容过长
        MessageTooLong,

        /// 函数级中文注释：参数无效
        BadInput,

        /// 函数级中文注释：逝者不存在
        DeceasedNotFound,

        /// 函数级中文注释：智能体不存在
        AgentNotFound,

        /// 函数级中文注释：API配置不存在
        APIConfigNotFound,

        /// 函数级中文注释：OCW请求不存在
        OCWRequestNotFound,

        /// 函数级中文注释：OCW请求队列已满
        OCWRequestQueueFull,

        /// 函数级中文注释：数值溢出
        Overflow,
    }

    // =================== Hooks 实现 ===================

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：Off-chain Worker 主函数
        ///
        /// ## 功能
        /// - 每个区块执行一次
        /// - 检查待处理的 OCW 请求队列
        /// - 调用 AI API 获取响应
        /// - 提交 unsigned transaction 将响应存储到链上
        ///
        /// ## 工作流程
        /// 1. 检查 PendingOCWRequests 队列
        /// 2. 对每个待处理请求：
        ///    - 获取请求详情和 API 配置
        ///    - 调用外部 AI API
        ///    - 解析响应并计算质量评分
        ///    - 提交 unsigned transaction
        ///
        /// ## 注意
        /// - 使用 HTTP 请求，可能失败
        /// - 需要处理超时和错误重试
        /// - 避免阻塞过长时间
        fn offchain_worker(_block_number: BlockNumberFor<T>) {
            // 简化日志（暂时移除log依赖）
            // log::info!("🤖 AI Chat OCW: Starting at block {:?}", block_number);

            // 获取待处理请求列表
            let pending_requests = PendingOCWRequests::<T>::get();

            if pending_requests.is_empty() {
                // log::debug!("🤖 AI Chat OCW: No pending requests");
                return;
            }

            // log::info!("🤖 AI Chat OCW: Processing {} pending requests", pending_requests.len());

            // 处理每个待处理请求（最多处理5个，避免阻塞过长）
            for (_index, request_id) in pending_requests.iter().enumerate().take(5) {
                // log::info!("🤖 AI Chat OCW: Processing request #{} (id: {})", index + 1, request_id);

                // 处理单个请求
                if let Err(_e) = Self::process_ocw_request(*request_id) {
                    // log::error!("🤖 AI Chat OCW: Failed to process request {}: {:?}", request_id, e);
                }
            }

            // log::info!("🤖 AI Chat OCW: Finished processing");
        }
    }

    // =================== Extrinsics实现 ===================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // =================== 对话管理 ===================

        /// 函数级详细中文注释：创建对话会话
        ///
        /// ## 功能
        /// - 用户与指定逝者的AI智能体创建新的对话会话
        /// - 自动检查用户活跃会话数量限制
        /// - 验证逝者和智能体是否存在
        /// - 初始化会话状态为Active
        ///
        /// ## 参数
        /// - `origin`: 用户账户
        /// - `deceased_id`: 逝者ID
        /// - `agent_id`: AI智能体ID（可选，如不指定则使用默认智能体）
        ///
        /// ## 错误
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `AgentNotFound`: 智能体不存在
        /// - `TooManyActiveConversations`: 用户活跃会话过多
        /// - `Overflow`: ID溢出
        ///
        /// ## 事件
        /// - `ConversationCreated`: 会话创建成功
        ///
        /// ## 返回
        /// - 返回新创建的session_id
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::create_conversation())]
        pub fn create_conversation(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            agent_id: Option<u64>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查逝者是否存在
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );

            // 如果指定了agent_id，简单验证（暂时跳过存储检查，实际应通过trait或RPC）
            // TODO: 添加 AIAgentProvider trait 来验证智能体
            if agent_id.is_some() {
                // 暂时允许任何agent_id，实际应该验证存在性
            }

            // 检查用户活跃会话数量
            let user_conversations = ConversationsByUser::<T>::get(&who);
            let active_count = user_conversations
                .iter()
                .filter(|&&session_id| {
                    if let Some(conv) = Conversations::<T>::get(session_id) {
                        conv.status == ConversationStatus::Active
                    } else {
                        false
                    }
                })
                .count();

            ensure!(
                active_count < T::MaxActiveConversations::get() as usize,
                Error::<T>::TooManyActiveConversations
            );

            // 分配session_id
            let session_id = NextSessionId::<T>::get();
            let next_id = session_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前区块号
            let current_block = frame_system::Pallet::<T>::block_number();

            // 创建会话记录
            let conversation = Conversation {
                session_id,
                deceased_id,
                user_id: who.clone(),
                agent_id,
                status: ConversationStatus::Active,
                created_at: current_block,
                last_active: current_block,
                message_count: 0,
                quality_score: None,
                user_rating: None,
            };

            // 写入存储
            Conversations::<T>::insert(session_id, conversation);
            NextSessionId::<T>::put(next_id);

            // 更新索引
            ConversationsByUser::<T>::try_mutate(&who, |conversations| -> DispatchResult {
                conversations
                    .try_push(session_id)
                    .map_err(|_| Error::<T>::TooManyActiveConversations)?;
                Ok(())
            })?;

            ConversationsByDeceased::<T>::try_mutate(deceased_id, |conversations| -> DispatchResult {
                conversations
                    .try_push(session_id)
                    .map_err(|_| Error::<T>::TooManyActiveConversations)?;
                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::ConversationCreated {
                session_id,
                user_id: who,
                deceased_id,
            });

            Ok(())
        }

        /// 函数级详细中文注释：发送消息
        ///
        /// ## 功能
        /// - 用户在会话中发送新消息
        /// - 创建OCW请求以获取AI响应
        /// - 更新会话活跃时间和消息计数
        ///
        /// ## 参数
        /// - `origin`: 用户账户
        /// - `session_id`: 会话ID
        /// - `content`: 消息内容（最多4000字符）
        ///
        /// ## 错误
        /// - `ConversationNotFound`: 会话不存在
        /// - `NotAuthorized`: 非会话所有者
        /// - `ConversationExpired`: 会话已过期
        /// - `ConversationArchived`: 会话已归档
        /// - `TooManyMessages`: 消息数量超过限制
        /// - `MessageTooLong`: 消息内容过长
        ///
        /// ## 事件
        /// - `MessageSent`: 消息发送成功
        /// - `OCWRequestCreated`: OCW请求已创建
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::send_message())]
        pub fn send_message(
            origin: OriginFor<T>,
            session_id: u64,
            content: BoundedVec<u8, ConstU32<4000>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取会话
            let mut conversation = Conversations::<T>::get(session_id)
                .ok_or(Error::<T>::ConversationNotFound)?;

            // 检查权限
            ensure!(conversation.user_id == who, Error::<T>::NotAuthorized);

            // 检查会话状态
            ensure!(
                conversation.status == ConversationStatus::Active,
                Error::<T>::ConversationArchived
            );

            // 检查消息数量限制
            ensure!(
                conversation.message_count < T::MaxMessagesPerSession::get(),
                Error::<T>::TooManyMessages
            );

            // content 已经是 BoundedVec，无需转换
            // 分配message_id
            let message_id = NextMessageId::<T>::get();
            let next_msg_id = message_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前时间戳（使用区块号模拟Unix时间戳）
            let current_block = frame_system::Pallet::<T>::block_number();
            let timestamp = Self::block_number_to_timestamp(current_block);

            // 创建用户消息记录
            let message = ChatMessage {
                message_id,
                session_id,
                role: MessageRole::User,
                content: content.clone(),
                timestamp,
                quality_rating: None,
                user_feedback: 0,
                response_time: None,
                token_count: None,
            };

            // 写入存储
            Messages::<T>::insert(message_id, message);
            NextMessageId::<T>::put(next_msg_id);

            // 更新会话消息列表
            MessagesBySession::<T>::try_mutate(session_id, |messages| -> DispatchResult {
                messages
                    .try_push(message_id)
                    .map_err(|_| Error::<T>::TooManyMessages)?;
                Ok(())
            })?;

            // 更新会话信息
            conversation.message_count = conversation.message_count.saturating_add(1);
            conversation.last_active = current_block;
            Conversations::<T>::insert(session_id, conversation.clone());

            // 触发消息发送事件
            Self::deposit_event(Event::MessageSent {
                message_id,
                session_id,
                role: MessageRole::User.to_u8(),
            });

            // 创建OCW请求以获取AI响应
            Self::create_ocw_request(session_id, message_id, content)?;

            Ok(())
        }

        /// 函数级详细中文注释：更新会话状态
        ///
        /// ## 功能
        /// - 用户更新会话状态（暂停/归档/恢复）
        /// - 只有会话所有者可以更新
        ///
        /// ## 参数
        /// - `origin`: 用户账户
        /// - `session_id`: 会话ID
        /// - `new_status`: 新状态（0-3）
        ///
        /// ## 错误
        /// - `ConversationNotFound`: 会话不存在
        /// - `NotAuthorized`: 非会话所有者
        ///
        /// ## 事件
        /// - `ConversationStatusUpdated`: 状态更新成功
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::update_conversation_status())]
        pub fn update_conversation_status(
            origin: OriginFor<T>,
            session_id: u64,
            new_status: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 更新会话
            Conversations::<T>::try_mutate(session_id, |maybe_conv| -> DispatchResult {
                let conv = maybe_conv.as_mut().ok_or(Error::<T>::ConversationNotFound)?;

                // 检查权限
                ensure!(conv.user_id == who, Error::<T>::NotAuthorized);

                // 更新状态
                conv.status = ConversationStatus::from_u8(new_status);

                // 更新最后活跃时间
                let current_block = frame_system::Pallet::<T>::block_number();
                conv.last_active = current_block;

                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::ConversationStatusUpdated {
                session_id,
                new_status,
            });

            Ok(())
        }

        /// 函数级详细中文注释：评价消息
        ///
        /// ## 功能
        /// - 用户对AI响应进行评分（点赞/点踩）
        /// - 用于改进AI质量和收集用户反馈
        ///
        /// ## 参数
        /// - `origin`: 用户账户
        /// - `message_id`: 消息ID
        /// - `feedback`: 反馈（-1=点踩, 0=取消, 1=点赞）
        ///
        /// ## 错误
        /// - `MessageNotFound`: 消息不存在
        /// - `NotAuthorized`: 非会话所有者
        /// - `BadInput`: 无效的反馈值
        ///
        /// ## 事件
        /// - `MessageRated`: 评价成功
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::rate_message())]
        pub fn rate_message(
            origin: OriginFor<T>,
            message_id: u64,
            feedback: i8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证反馈值
            ensure!(feedback >= -1 && feedback <= 1, Error::<T>::BadInput);

            // 更新消息
            Messages::<T>::try_mutate(message_id, |maybe_msg| -> DispatchResult {
                let msg = maybe_msg.as_mut().ok_or(Error::<T>::MessageNotFound)?;

                // 获取会话并检查权限
                let conversation = Conversations::<T>::get(msg.session_id)
                    .ok_or(Error::<T>::ConversationNotFound)?;
                ensure!(conversation.user_id == who, Error::<T>::NotAuthorized);

                // 更新反馈
                msg.user_feedback = feedback;

                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::MessageRated {
                message_id,
                feedback,
            });

            Ok(())
        }

        // =================== API配置管理 ===================

        /// 函数级详细中文注释：添加API配置（治理操作）
        ///
        /// ## 功能
        /// - 治理添加新的AI服务商API配置
        /// - 支持多种AI服务商（OpenAI、Anthropic等）
        /// - 配置包含端点、模型、密钥哈希等信息
        ///
        /// ## 参数
        /// - `origin`: 治理起源
        /// - `provider`: AI服务商类型（0-4）
        /// - `api_endpoint`: API端点URL
        /// - `model_name`: 模型名称
        /// - `api_key_hash`: API密钥哈希（Blake2-256）
        /// - `priority`: 优先级（0-100）
        /// - `rate_limit`: 速率限制（每分钟请求数）
        /// - `timeout`: 超时时间（秒）
        ///
        /// ## 错误
        /// - `BadInput`: 参数格式错误
        /// - `Overflow`: ID溢出
        ///
        /// ## 事件
        /// - `APIConfigAdded`: 配置添加成功
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::add_api_config())]
        pub fn add_api_config(
            origin: OriginFor<T>,
            provider: u8,
            api_endpoint: BoundedVec<u8, ConstU32<200>>,
            model_name: BoundedVec<u8, ConstU32<50>>,
            api_key_hash: [u8; 32],
            priority: u8,
            rate_limit: u32,
            timeout: u32,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 验证参数
            ensure!(!api_endpoint.is_empty() && api_endpoint.len() <= 200, Error::<T>::BadInput);
            ensure!(!model_name.is_empty() && model_name.len() <= 50, Error::<T>::BadInput);
            ensure!(priority <= 100, Error::<T>::BadInput);

            // api_endpoint 和 model_name 已经是 BoundedVec，无需转换

            // 分配config_id
            let config_id = NextAPIConfigId::<T>::get();
            let next_id = config_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 创建API配置
            let config = APIConfig {
                provider: AIProvider::from_u8(provider),
                api_endpoint,
                model_name,
                api_key_hash,
                enabled: true,  // 默认启用
                priority,
                rate_limit,
                timeout,
            };

            // 写入存储
            APIConfigs::<T>::insert(config_id, config);
            NextAPIConfigId::<T>::put(next_id);

            // 触发事件
            Self::deposit_event(Event::APIConfigAdded {
                config_id,
                provider,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新API配置（治理操作）
        ///
        /// ## 功能
        /// - 治理更新现有API配置
        /// - 可以启用/禁用配置
        /// - 可以调整优先级、速率限制等参数
        ///
        /// ## 参数
        /// - `origin`: 治理起源
        /// - `config_id`: 配置ID
        /// - `enabled`: 是否启用（可选）
        /// - `priority`: 优先级（可选）
        /// - `rate_limit`: 速率限制（可选）
        /// - `timeout`: 超时时间（可选）
        ///
        /// ## 错误
        /// - `APIConfigNotFound`: 配置不存在
        /// - `BadInput`: 参数格式错误
        ///
        /// ## 事件
        /// - `APIConfigUpdated`: 配置更新成功
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::update_api_config())]
        pub fn update_api_config(
            origin: OriginFor<T>,
            config_id: u64,
            enabled: Option<bool>,
            priority: Option<u8>,
            rate_limit: Option<u32>,
            timeout: Option<u32>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 验证priority参数
            if let Some(p) = priority {
                ensure!(p <= 100, Error::<T>::BadInput);
            }

            // 更新配置
            APIConfigs::<T>::try_mutate(config_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::APIConfigNotFound)?;

                // 更新各个字段
                if let Some(e) = enabled {
                    config.enabled = e;
                }
                if let Some(p) = priority {
                    config.priority = p;
                }
                if let Some(r) = rate_limit {
                    config.rate_limit = r;
                }
                if let Some(t) = timeout {
                    config.timeout = t;
                }

                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::APIConfigUpdated { config_id });

            Ok(())
        }

        // =================== 个性化配置管理 ===================

        /// 函数级详细中文注释：更新个性化配置
        ///
        /// ## 功能
        /// - 逝者家属或授权用户更新AI智能体的个性化配置
        /// - 包括基础提示词、风格标签、AI模型参数等
        /// - 用于调整AI对话风格以匹配逝者人格
        ///
        /// ## 参数
        /// - `origin`: 用户账户（需要是逝者owner）
        /// - `deceased_id`: 逝者ID
        /// - `agent_id`: 智能体ID
        /// - `base_prompt`: 基础提示词（可选）
        /// - `style_tags`: 风格标签列表（可选）
        /// - `temperature`: 温度参数 0-100（可选）
        /// - `max_tokens`: 最大token数（可选）
        ///
        /// ## 错误
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `NotAuthorized`: 非逝者owner
        /// - `BadInput`: 参数格式错误
        ///
        /// ## 事件
        /// - `PersonalityConfigUpdated`: 配置更新成功
        #[pallet::call_index(6)]
        #[pallet::weight(T::WeightInfo::update_personality_config())]
        pub fn update_personality_config(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            agent_id: u64,
            base_prompt: Option<BoundedVec<u8, ConstU32<2000>>>,
            style_tags: Option<BoundedVec<(u8, u8, Option<BoundedVec<u8, ConstU32<200>>>), ConstU32<10>>>,  // (type, weight, description)
            temperature: Option<u8>,
            max_tokens: Option<u32>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查逝者是否存在
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );

            // 检查权限（是否为逝者owner）
            ensure!(
                T::DeceasedProvider::is_deceased_owner(&who, deceased_id),
                Error::<T>::NotAuthorized
            );

            // 验证temperature参数
            if let Some(t) = temperature {
                ensure!(t <= 100, Error::<T>::BadInput);
            }

            // 获取或创建配置
            let mut config = PersonalityConfigs::<T>::get((deceased_id, agent_id))
                .unwrap_or_else(|| {
                    // 创建默认配置
                    PersonalityConfig {
                        deceased_id,
                        agent_id,
                        base_prompt: BoundedVec::default(),
                        style_tags: BoundedVec::default(),
                        temperature: 70,  // 默认0.7
                        max_tokens: 1000,
                        top_p: 90,  // 默认0.9
                        frequency_penalty: 0,
                        presence_penalty: 0,
                    }
                });

            // 更新基础提示词
            if let Some(prompt) = base_prompt {
                ensure!(prompt.len() <= 2000, Error::<T>::BadInput);
                // prompt 已经是 BoundedVec，直接赋值
                config.base_prompt = prompt;
            }

            // 更新风格标签
            if let Some(tags) = style_tags {
                ensure!(tags.len() <= 10, Error::<T>::BadInput);

                let mut bounded_tags = BoundedVec::default();
                for (tag_type, weight, desc) in tags {
                    ensure!(weight <= 100, Error::<T>::BadInput);

                    let bounded_desc = if let Some(d) = desc {
                        ensure!(d.len() <= 200, Error::<T>::BadInput);
                        // d 已经是 BoundedVec，直接使用
                        Some(d)
                    } else {
                        None
                    };

                    let style_tag = StyleTag {
                        tag_type: StyleType::from_u8(tag_type),
                        weight,
                        description: bounded_desc,
                    };

                    bounded_tags
                        .try_push(style_tag)
                        .map_err(|_| Error::<T>::BadInput)?;
                }

                config.style_tags = bounded_tags;
            }

            // 更新AI参数
            if let Some(t) = temperature {
                config.temperature = t;
            }
            if let Some(m) = max_tokens {
                config.max_tokens = m;
            }

            // 写入存储
            PersonalityConfigs::<T>::insert((deceased_id, agent_id), config);

            // 触发事件
            Self::deposit_event(Event::PersonalityConfigUpdated {
                deceased_id,
                agent_id,
            });

            Ok(())
        }

        // =================== OCW响应处理 ===================

        /// 函数级详细中文注释：提交OCW响应（unsigned extrinsic）
        ///
        /// ## 功能
        /// - OCW worker调用此函数提交AI响应
        /// - 创建Assistant消息记录
        /// - 更新OCW请求状态
        /// - 更新会话信息
        ///
        /// ## 参数
        /// - `origin`: Root（unsigned）
        /// - `request_id`: OCW请求ID
        /// - `response_content`: AI响应内容
        /// - `token_used`: 消耗的token数
        /// - `response_time`: 响应时间（毫秒）
        /// - `quality_metrics`: 质量评估指标
        ///
        /// ## 错误
        /// - `OCWRequestNotFound`: 请求不存在
        /// - `ConversationNotFound`: 会话不存在
        /// - `MessageTooLong`: 响应内容过长
        /// - `Overflow`: ID溢出
        ///
        /// ## 事件
        /// - `OCWResponseSubmitted`: 响应提交成功
        /// - `MessageSent`: Assistant消息已创建
        ///
        /// ## 注意
        /// - 这是unsigned extrinsic，由OCW调用
        /// - 实际应该使用ValidateUnsigned实现
        #[pallet::call_index(7)]
        #[pallet::weight(T::WeightInfo::submit_ocw_response())]
        pub fn submit_ocw_response(
            origin: OriginFor<T>,
            request_id: u64,
            response_content: BoundedVec<u8, ConstU32<4000>>,
            token_used: u32,
            response_time: u32,
            // 质量评分的各个维度（0-100）
            relevance_score: u8,
            personality_match: u8,
            emotional_authenticity: u8,
            factual_accuracy: u8,
            response_quality: u8,
        ) -> DispatchResult {
            // TODO: 实际应该使用 ensure_none(origin)? 和 ValidateUnsigned
            // 暂时使用 Root 进行测试
            ensure_root(origin)?;

            // 从独立评分参数重构 QualityMetrics
            let quality_metrics = QualityMetrics {
                relevance_score,
                personality_match,
                emotional_authenticity,
                factual_accuracy,
                response_quality,
                user_satisfaction: None, // 用户满意度稍后手动评分
            };

            // 获取OCW请求
            let request = OCWRequests::<T>::get(request_id)
                .ok_or(Error::<T>::OCWRequestNotFound)?;

            // 获取会话（验证会话存在）
            let _conversation = Conversations::<T>::get(request.session_id)
                .ok_or(Error::<T>::ConversationNotFound)?;

            // 转换响应内容为BoundedVec
            let bounded_content: BoundedVec<u8, ConstU32<4000>> = response_content
                .try_into()
                .map_err(|_| Error::<T>::MessageTooLong)?;

            // 分配message_id
            let message_id = NextMessageId::<T>::get();
            let next_msg_id = message_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前时间戳
            let current_block = frame_system::Pallet::<T>::block_number();
            let timestamp = Self::block_number_to_timestamp(current_block);

            // 计算质量评分
            let quality_rating = quality_metrics.overall_score();

            // 创建Assistant消息记录
            let message = ChatMessage {
                message_id,
                session_id: request.session_id,
                role: MessageRole::Assistant,
                content: bounded_content,
                timestamp,
                quality_rating: Some(quality_rating),
                user_feedback: 0,
                response_time: Some(response_time),
                token_count: Some(token_used),
            };

            // 写入消息存储
            Messages::<T>::insert(message_id, message);
            NextMessageId::<T>::put(next_msg_id);

            // 更新会话消息列表
            MessagesBySession::<T>::try_mutate(request.session_id, |messages| -> DispatchResult {
                messages
                    .try_push(message_id)
                    .map_err(|_| Error::<T>::TooManyMessages)?;
                Ok(())
            })?;

            // 更新会话信息（消息计数、质量评分）
            Conversations::<T>::try_mutate(request.session_id, |maybe_conv| -> DispatchResult {
                let conv = maybe_conv.as_mut().ok_or(Error::<T>::ConversationNotFound)?;

                conv.message_count = conv.message_count.saturating_add(1);
                conv.last_active = current_block;

                // 更新平均质量评分（简单平均）
                if let Some(current_score) = conv.quality_score {
                    let new_score = (current_score as u16 + quality_rating as u16) / 2;
                    conv.quality_score = Some(new_score as u8);
                } else {
                    conv.quality_score = Some(quality_rating);
                }

                Ok(())
            })?;

            // 更新OCW请求状态
            OCWRequests::<T>::try_mutate(request_id, |maybe_req| -> DispatchResult {
                let req = maybe_req.as_mut().ok_or(Error::<T>::OCWRequestNotFound)?;
                req.status = 2; // Completed
                Ok(())
            })?;

            // 从待处理队列移除
            PendingOCWRequests::<T>::mutate(|queue| {
                queue.retain(|&id| id != request_id);
            });

            // 触发事件
            Self::deposit_event(Event::OCWResponseSubmitted {
                request_id,
                message_id,
            });

            Self::deposit_event(Event::MessageSent {
                message_id,
                session_id: request.session_id,
                role: MessageRole::Assistant.to_u8(),
            });

            Ok(())
        }
    }

    // =================== Helper Functions ===================

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：区块号转时间戳
        ///
        /// ## 功能
        /// - 将区块号转换为Unix时间戳（简化版）
        /// - 假设每个区块6秒，从创世区块开始计算
        ///
        /// ## 注意
        /// - 这是简化实现，生产环境应使用pallet-timestamp
        fn block_number_to_timestamp(block_number: BlockNumberFor<T>) -> u64 {
            // 简化实现：假设6秒出块，从Unix epoch开始
            // 实际应该使用pallet_timestamp::Pallet::<T>::now()
            let block_u64: u64 = block_number.try_into().unwrap_or(0u64);
            block_u64.saturating_mul(6)
        }

        /// 函数级详细中文注释：创建OCW请求
        ///
        /// ## 功能
        /// - 为用户消息创建OCW请求
        /// - 构建包含个性化配置的完整提示词
        /// - 添加到待处理队列
        ///
        /// ## 参数
        /// - `session_id`: 会话ID
        /// - `message_id`: 用户消息ID
        /// - `content`: 用户消息内容
        fn create_ocw_request(
            session_id: u64,
            message_id: u64,
            content: BoundedVec<u8, ConstU32<4000>>,
        ) -> DispatchResult {
            // 获取会话信息
            let conversation = Conversations::<T>::get(session_id)
                .ok_or(Error::<T>::ConversationNotFound)?;

            // 构建提示词（简化版，实际应包含个性化配置）
            let mut prompt_vec = alloc::vec::Vec::new();

            // 添加系统提示（如果有个性化配置）
            if let Some(agent_id) = conversation.agent_id {
                if let Some(config) = PersonalityConfigs::<T>::get((conversation.deceased_id, agent_id)) {
                    prompt_vec.extend_from_slice(&config.base_prompt);
                    prompt_vec.extend_from_slice(b"\n\n");
                }
            }

            // 添加用户消息
            prompt_vec.extend_from_slice(b"User: ");
            prompt_vec.extend_from_slice(&content);

            let bounded_prompt: BoundedVec<u8, ConstU32<8000>> = prompt_vec
                .try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 获取默认API配置（简化版，实际应该有选择逻辑）
            let config_id = 0u64; // 临时使用0作为默认配置

            // 分配request_id
            let request_id = NextOCWRequestId::<T>::get();
            let next_id = request_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前区块号
            let current_block = frame_system::Pallet::<T>::block_number();

            // 创建OCW请求
            let request = OCWRequest {
                request_id,
                session_id,
                message_id,
                prompt: bounded_prompt,
                config_id,
                created_at: current_block,
                status: 0, // Pending
            };

            // 写入存储
            OCWRequests::<T>::insert(request_id, request);
            NextOCWRequestId::<T>::put(next_id);

            // 添加到待处理队列
            PendingOCWRequests::<T>::try_mutate(|queue| -> DispatchResult {
                queue
                    .try_push(request_id)
                    .map_err(|_| Error::<T>::OCWRequestQueueFull)?;
                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::OCWRequestCreated {
                request_id,
                session_id,
            });

            Ok(())
        }

        /// 函数级详细中文注释：处理单个 OCW 请求
        ///
        /// ## 功能
        /// - 获取请求详情和 API 配置
        /// - 调用外部 AI API
        /// - 解析响应并计算质量评分
        /// - 提交 unsigned transaction
        ///
        /// ## 参数
        /// - `request_id`: OCW 请求 ID
        ///
        /// ## 返回
        /// - `Ok(())`: 处理成功
        /// - `Err(msg)`: 处理失败（错误消息）
        ///
        /// ## 注意
        /// - 这是 OCW 专用函数，在链下环境执行
        /// - 使用 HTTP 请求可能超时或失败
        fn process_ocw_request(request_id: u64) -> Result<(), &'static str> {
            // 获取请求详情
            let request = OCWRequests::<T>::get(request_id)
                .ok_or("OCW request not found")?;

            // 检查请求状态（只处理 pending 状态）
            if request.status != 0 {
                // log::warn!("🤖 AI Chat OCW: Request {} not in pending status", request_id);
                return Err("Request not in pending status");
            }

            // 获取 API 配置
            let api_config = APIConfigs::<T>::get(request.config_id)
                .ok_or("API config not found")?;

            // 检查 API 配置是否启用
            if !api_config.enabled {
                // log::warn!("🤖 AI Chat OCW: API config {} is disabled", request.config_id);
                return Err("API config is disabled");
            }

            // log::info!("🤖 AI Chat OCW: Calling AI API for request {} (provider: {:?})", request_id, api_config.provider);

            // 调用 AI API（当前为简化版，返回模拟响应）
            // TODO: 实现真实的 HTTP 请求和 JSON 解析
            let response = Self::call_ai_api(&api_config, &request)?;

            // log::info!("🤖 AI Chat OCW: Got response for request {}: {} bytes", request_id, response.len());

            // 计算质量评分（当前为简化版）
            let quality_metrics = Self::calculate_quality_metrics(&response, &request);

            // 提交 unsigned transaction
            Self::submit_response_transaction(
                request_id,
                response,
                1000, // token_used (模拟值)
                500,  // response_time (模拟值，毫秒)
                quality_metrics.relevance_score,
                quality_metrics.personality_match,
                quality_metrics.emotional_authenticity,
                quality_metrics.factual_accuracy,
                quality_metrics.response_quality,
            )?;

            Ok(())
        }

        /// 函数级详细中文注释：调用 AI API（简化版）
        ///
        /// ## 功能
        /// - 构建 HTTP 请求
        /// - 调用外部 AI API
        /// - 解析 JSON 响应
        ///
        /// ## 参数
        /// - `api_config`: API 配置
        /// - `request`: OCW 请求
        ///
        /// ## 返回
        /// - `Ok(Vec<u8>)`: AI 响应内容
        /// - `Err(msg)`: API 调用失败
        ///
        /// ## 当前实现
        /// - MVP 阶段返回模拟响应
        /// - 生产环境需要实现真实 HTTP 请求
        fn call_ai_api(
            _api_config: &APIConfig,
            request: &OCWRequest<BlockNumberFor<T>>,
        ) -> Result<alloc::vec::Vec<u8>, &'static str> {
            // TODO: 实现真实的 HTTP 请求
            // 1. 构建 HTTP POST 请求
            // 2. 设置 Headers (Authorization, Content-Type)
            // 3. 发送 JSON body (prompt, temperature, max_tokens, etc.)
            // 4. 解析 JSON 响应
            // 5. 提取 content 字段

            // MVP 阶段：返回模拟响应
            let prompt_str = core::str::from_utf8(&request.prompt)
                .unwrap_or("<invalid utf8>");

            let mock_response = alloc::format!(
                "这是一个模拟的 AI 响应。用户输入：{}",
                &prompt_str[..prompt_str.len().min(100)]
            );

            // log::info!("🤖 AI Chat OCW: Mock response generated: {}", &mock_response[..mock_response.len().min(50)]);

            Ok(mock_response.into_bytes())
        }

        /// 函数级详细中文注释：计算质量评分（简化版）
        ///
        /// ## 功能
        /// - 评估 AI 响应质量
        /// - 计算多维度评分
        ///
        /// ## 参数
        /// - `response`: AI 响应内容
        /// - `request`: OCW 请求
        ///
        /// ## 返回
        /// - `QualityMetrics`: 质量评估指标
        ///
        /// ## 当前实现
        /// - MVP 阶段返回固定评分
        /// - 生产环境需要实现真实评估算法
        fn calculate_quality_metrics(
            response: &[u8],
            _request: &OCWRequest<BlockNumberFor<T>>,
        ) -> QualityMetrics {
            // TODO: 实现真实的质量评估算法
            // 1. 相关性评估：NLP 模型分析响应与提示的相关度
            // 2. 人格匹配：对比响应风格与个性化配置
            // 3. 情感真实性：情感分析
            // 4. 事实准确性：知识库验证
            // 5. 响应质量：语法、流畅度、逻辑性

            // MVP 阶段：基于响应长度的简单评分
            let length_score = response.len().min(1000) as u8 / 10; // 0-100

            QualityMetrics {
                relevance_score: length_score.saturating_add(10).min(100),
                personality_match: 80,
                emotional_authenticity: 75,
                factual_accuracy: 70,
                response_quality: length_score.min(90),
                user_satisfaction: None, // 用户稍后手动评分
            }
        }

        /// 函数级详细中文注释：提交响应 transaction
        ///
        /// ## 功能
        /// - 构建 unsigned transaction
        /// - 调用 submit_ocw_response extrinsic
        /// - 将 AI 响应存储到链上
        ///
        /// ## 参数
        /// - `request_id`: 请求 ID
        /// - `response_content`: 响应内容
        /// - `token_used`: 消耗的 token 数
        /// - `response_time`: 响应时间（毫秒）
        /// - `relevance_score`: 相关性评分（0-100）
        /// - `personality_match`: 人格匹配度（0-100）
        /// - `emotional_authenticity`: 情感真实性（0-100）
        /// - `factual_accuracy`: 事实准确性（0-100）
        /// - `response_quality`: 响应质量（0-100）
        ///
        /// ## 返回
        /// - `Ok(())`: 提交成功
        /// - `Err(msg)`: 提交失败
        ///
        /// ## 注意
        /// - 当前使用 Root origin（临时实现）
        /// - 生产环境应使用 unsigned transaction
        fn submit_response_transaction(
            _request_id: u64,
            _response_content: alloc::vec::Vec<u8>,
            _token_used: u32,
            _response_time: u32,
            _relevance_score: u8,
            _personality_match: u8,
            _emotional_authenticity: u8,
            _factual_accuracy: u8,
            _response_quality: u8,
        ) -> Result<(), &'static str> {
            // TODO: 实现 unsigned transaction 提交
            // 1. 构建 Call (submit_ocw_response)
            // 2. 包装为 UncheckedExtrinsic
            // 3. 提交到 transaction pool

            // MVP 阶段：记录日志（实际提交需要 unsigned transaction 框架）
            // log::info!("🤖 AI Chat OCW: Would submit response for request {} ({} bytes)", request_id, response_content.len());

            // 注意：在真实环境中，这里应该提交 unsigned transaction
            // 当前由于缺少 unsigned transaction 框架，暂时跳过实际提交

            Ok(())
        }
    }
}
