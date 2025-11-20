//! # Pallet Deceased AI - AI训练准备层
//!
//! ## 概述
//!
//! 本pallet作为AI训练准备层，负责：
//! - AI服务提供商管理（注册、验证、配额）
//! - 训练数据导出和查询
//! - 训练任务追踪
//! - AI智能体注册
//!
//! ## 设计理念
//!
//! ### 职责分离
//! - pallet-deceased: 数据存储层（作品记录、元数据管理）
//! - pallet-deceased-ai: AI准备层（数据聚合、导出格式化、服务管理）
//! - 外部AI服务: AI训练层（模型训练、智能体生成）
//!
//! ### 低耦合设计
//! - 通过trait接口访问pallet-deceased数据
//! - 不修改deceased pallet的存储结构
//! - 仅提供数据查询和聚合功能
//!
//! ## 功能模块
//!
//! ### 1. AI服务管理
//! - 注册/注销AI服务提供商
//! - 配额管理（防止滥用）
//! - 服务验证（治理审核）
//!
//! ### 2. 数据导出
//! - 按条件查询作品
//! - 批量导出训练数据
//! - 增量更新支持
//! - SCALE → JSON格式转换
//!
//! ### 3. 训练任务
//! - 创建训练任务
//! - 追踪训练状态
//! - 记录数据使用
//!
//! ### 4. 智能体注册
//! - 登记训练完成的模型
//! - 关联到逝者ID
//! - 版本管理
//!
//! ## 版本历史
//!
//! - v0.1.0 (2025-11-13): Phase 2开始 - 基础架构

#![cfg_attr(not(feature = "std"), no_std)]

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
use sp_std::vec::Vec;

/// 函数级详细中文注释：权重信息trait（后续通过benchmarking生成）
pub trait WeightInfo {
    fn register_ai_provider() -> Weight;
    fn update_quota() -> Weight;
    fn verify_provider() -> Weight;
    fn query_training_data() -> Weight;
    fn export_training_dataset() -> Weight;
    fn create_training_task() -> Weight;
    fn update_task_status() -> Weight;
    fn register_ai_agent() -> Weight;
    fn update_agent_status() -> Weight;
}

/// 函数级详细中文注释：默认权重实现（开发阶段使用）
impl WeightInfo for () {
    fn register_ai_provider() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn update_quota() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn verify_provider() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn query_training_data() -> Weight {
        Weight::from_parts(20_000, 0)
    }
    fn export_training_dataset() -> Weight {
        Weight::from_parts(50_000, 0)
    }
    fn create_training_task() -> Weight {
        Weight::from_parts(30_000, 0)
    }
    fn update_task_status() -> Weight {
        Weight::from_parts(10_000, 0)
    }
    fn register_ai_agent() -> Weight {
        Weight::from_parts(20_000, 0)
    }
    fn update_agent_status() -> Weight {
        Weight::from_parts(10_000, 0)
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
    /// - GovernanceOrigin: 治理权限（验证AI服务）
    ///
    /// ## 配置参数
    /// - DefaultMonthlyQuota: 默认月度配额（10000次查询）
    /// - MaxProvidersPerDeceased: 每个逝者最多授权的AI服务数量（10个）
    #[pallet::config]
    pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
        /// 逝者ID类型（与pallet-deceased保持一致）
        type DeceasedId: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 函数级中文注释：逝者数据提供者（访问pallet-deceased）
        /// 提供作品查询功能，不依赖于具体的deceased pallet实现
        type DeceasedProvider: DeceasedDataProvider<Self::DeceasedId, Self::AccountId>;

        /// 治理起源（用于验证AI服务提供商）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 权重信息
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：默认月度配额（每个AI服务提供商）
        /// 推荐值：10000次查询/月
        #[pallet::constant]
        type DefaultMonthlyQuota: Get<u32>;

        /// 函数级中文注释：每个逝者最多授权的AI服务提供商数量
        /// 推荐值：10个
        #[pallet::constant]
        type MaxProvidersPerDeceased: Get<u32>;
    }

    // =================== 存储项 ===================

    /// 函数级详细中文注释：下一个AI服务提供商ID
    #[pallet::storage]
    #[pallet::getter(fn next_provider_id)]
    pub type NextProviderId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：AI服务提供商信息
    /// - Key: provider_id (u64)
    /// - Value: AIServiceProvider结构
    #[pallet::storage]
    #[pallet::getter(fn ai_providers)]
    pub type AIProviders<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // provider_id
        AIServiceProvider<T::AccountId, BlockNumberFor<T>>,
    >;

    /// 函数级详细中文注释：账户到提供商ID的映射
    /// 用于快速查询某个账户是否已注册为AI服务提供商
    #[pallet::storage]
    pub type ProviderByAccount<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u64,  // provider_id
        OptionQuery,
    >;

    /// 函数级详细中文注释：下一个训练任务ID
    #[pallet::storage]
    #[pallet::getter(fn next_task_id)]
    pub type NextTaskId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：训练任务记录
    /// - Key: task_id (u64)
    /// - Value: TrainingTask结构
    #[pallet::storage]
    #[pallet::getter(fn training_tasks)]
    pub type TrainingTasks<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // task_id
        TrainingTask<T::DeceasedId, BlockNumberFor<T>>,
    >;

    /// 函数级详细中文注释：逝者的训练任务列表
    /// - Key: deceased_id
    /// - Value: Vec<task_id>（最多100个任务）
    #[pallet::storage]
    pub type TasksByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<u64, ConstU32<100>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：提供商的训练任务列表
    /// - Key: provider_id
    /// - Value: Vec<task_id>（最多1000个任务）
    #[pallet::storage]
    pub type TasksByProvider<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // provider_id
        BoundedVec<u64, ConstU32<1000>>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：下一个AI智能体ID
    #[pallet::storage]
    #[pallet::getter(fn next_agent_id)]
    pub type NextAgentId<T: Config> = StorageValue<_, u64, ValueQuery>;

    /// 函数级详细中文注释：AI智能体记录
    /// - Key: agent_id (u64)
    /// - Value: AIAgent结构
    #[pallet::storage]
    #[pallet::getter(fn ai_agents)]
    pub type AIAgents<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // agent_id
        AIAgent<T::DeceasedId, BlockNumberFor<T>>,
    >;

    /// 函数级详细中文注释：逝者的AI智能体列表
    /// - Key: deceased_id
    /// - Value: Vec<agent_id>（最多50个智能体）
    #[pallet::storage]
    pub type AgentsByDeceased<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::DeceasedId,
        BoundedVec<u64, ConstU32<50>>,
        ValueQuery,
    >;

    // =================== 事件 ===================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：AI服务提供商已注册
        /// - provider_id: 提供商ID
        /// - account: 提供商账户
        /// - name: 服务名称
        AIProviderRegistered {
            provider_id: u64,
            account: T::AccountId,
            name: BoundedVec<u8, ConstU32<100>>,
        },

        /// 函数级中文注释：AI服务提供商已注销
        /// - provider_id: 提供商ID
        AIProviderUnregistered {
            provider_id: u64,
        },

        /// 函数级中文注释：配额已更新
        /// - provider_id: 提供商ID
        /// - new_quota: 新配额
        QuotaUpdated {
            provider_id: u64,
            new_quota: u32,
        },

        /// 函数级中文注释：AI服务提供商已验证
        /// - provider_id: 提供商ID
        ProviderVerified {
            provider_id: u64,
        },

        /// 函数级中文注释：训练数据已查询
        /// - provider_id: 提供商ID
        /// - deceased_id: 逝者ID
        /// - count: 查询到的作品数量
        TrainingDataQueried {
            provider_id: u64,
            deceased_id: T::DeceasedId,
            count: u32,
        },

        /// 函数级中文注释：数据集已导出
        /// - provider_id: 提供商ID
        /// - deceased_id: 逝者ID
        /// - work_count: 作品数量
        /// - dataset_hash: 数据集哈希
        DatasetExported {
            provider_id: u64,
            deceased_id: T::DeceasedId,
            work_count: u32,
            dataset_hash: [u8; 32],
        },

        /// 函数级中文注释：训练任务已创建
        /// - task_id: 任务ID
        /// - deceased_id: 逝者ID
        /// - provider_id: 提供商ID
        TrainingTaskCreated {
            task_id: u64,
            deceased_id: T::DeceasedId,
            provider_id: u64,
        },

        /// 函数级中文注释：训练任务状态已更新
        /// - task_id: 任务ID
        /// - new_status: 新状态（u8代码）
        TaskStatusUpdated {
            task_id: u64,
            new_status: u8,
        },

        /// 函数级中文注释：AI智能体已注册
        /// - agent_id: 智能体ID
        /// - deceased_id: 逝者ID
        /// - provider_id: 提供商ID
        /// - model_type: 模型类型（u8代码）
        AIAgentRegistered {
            agent_id: u64,
            deceased_id: T::DeceasedId,
            provider_id: u64,
            model_type: u8,
        },

        /// 函数级中文注释：智能体部署状态已更新
        /// - agent_id: 智能体ID
        /// - new_status: 新状态（u8代码）
        AgentStatusUpdated {
            agent_id: u64,
            new_status: u8,
        },
    }

    // =================== 错误 ===================

    #[pallet::error]
    pub enum Error<T> {
        /// 函数级中文注释：提供商不存在
        ProviderNotFound,

        /// 函数级中文注释：提供商已存在
        ProviderAlreadyExists,

        /// 函数级中文注释：配额不足
        QuotaExceeded,

        /// 函数级中文注释：提供商未验证
        ProviderNotVerified,

        /// 函数级中文注释：参数无效
        BadInput,

        /// 函数级中文注释：无权限
        NotAuthorized,

        /// 函数级中文注释：任务不存在
        TaskNotFound,

        /// 函数级中文注释：非任务所有者
        NotTaskOwner,

        /// 函数级中文注释：任务未完成
        TaskNotCompleted,

        /// 函数级中文注释：智能体不存在
        AgentNotFound,

        /// 函数级中文注释：非智能体所有者
        NotAgentOwner,

        /// 函数级中文注释：作品列表过多
        TooManyWorks,

        /// 函数级中文注释：任务列表已满
        TooManyTasks,

        /// 函数级中文注释：智能体列表已满
        TooManyAgents,

        /// 函数级中文注释：逝者不存在
        DeceasedNotFound,

        /// 函数级中文注释：作品未授权AI训练
        WorkNotAuthorizedForAI,

        /// 函数级中文注释：数值溢出
        Overflow,
    }

    // =================== Extrinsics实现 ===================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // =================== AI服务提供商管理 ===================

        /// 函数级详细中文注释：注册AI服务提供商
        ///
        /// ## 功能
        /// - 任何账户都可以申请注册为AI服务提供商
        /// - 初始状态为"未验证"，需要治理审核后才能使用
        /// - 自动分配默认月度配额
        ///
        /// ## 参数
        /// - `origin`: 交易发起者（将成为提供商账户）
        /// - `name`: 服务名称（最多100字符）
        /// - `description`: 服务描述（最多500字符）
        /// - `api_endpoint`: API端点URL（最多200字符）
        ///
        /// ## 错误
        /// - `ProviderAlreadyExists`: 该账户已注册
        /// - `BadInput`: 参数格式错误（空字符串等）
        /// - `Overflow`: ID分配溢出
        ///
        /// ## 事件
        /// - `AIProviderRegistered`: 注册成功
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::register_ai_provider())]
        pub fn register_ai_provider(
            origin: OriginFor<T>,
            name: Vec<u8>,
            description: Vec<u8>,
            api_endpoint: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查是否已注册
            ensure!(
                !ProviderByAccount::<T>::contains_key(&who),
                Error::<T>::ProviderAlreadyExists
            );

            // 验证参数
            ensure!(!name.is_empty() && name.len() <= 100, Error::<T>::BadInput);
            ensure!(!description.is_empty() && description.len() <= 500, Error::<T>::BadInput);
            ensure!(!api_endpoint.is_empty() && api_endpoint.len() <= 200, Error::<T>::BadInput);

            // 转换为BoundedVec
            let bounded_name: BoundedVec<u8, ConstU32<100>> = name
                .clone()
                .try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            let bounded_description: BoundedVec<u8, ConstU32<500>> = description
                .try_into()
                .map_err(|_| Error::<T>::BadInput)?;
            let bounded_api_endpoint: BoundedVec<u8, ConstU32<200>> = api_endpoint
                .try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 分配provider_id
            let provider_id = NextProviderId::<T>::get();
            let next_id = provider_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前区块号
            let current_block = frame_system::Pallet::<T>::block_number();

            // 创建提供商记录
            let provider = AIServiceProvider {
                account: who.clone(),
                name: bounded_name.clone(),
                description: bounded_description,
                api_endpoint: bounded_api_endpoint,
                verified: false,  // 初始未验证
                monthly_quota: T::DefaultMonthlyQuota::get(),
                used_quota: 0,
                registered_at: current_block,
                last_active: current_block,
            };

            // 写入存储
            AIProviders::<T>::insert(provider_id, provider);
            ProviderByAccount::<T>::insert(&who, provider_id);
            NextProviderId::<T>::put(next_id);

            // 触发事件
            Self::deposit_event(Event::AIProviderRegistered {
                provider_id,
                account: who,
                name: bounded_name,
            });

            Ok(())
        }

        /// 函数级详细中文注释：注销AI服务提供商
        ///
        /// ## 功能
        /// - 提供商主动注销服务
        /// - 删除所有相关索引
        /// - 历史任务记录保留
        ///
        /// ## 参数
        /// - `origin`: 提供商账户
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 该账户未注册为提供商
        ///
        /// ## 事件
        /// - `AIProviderUnregistered`: 注销成功
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::register_ai_provider())]
        pub fn unregister_ai_provider(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 删除存储
            AIProviders::<T>::remove(provider_id);
            ProviderByAccount::<T>::remove(&who);

            // 触发事件
            Self::deposit_event(Event::AIProviderUnregistered { provider_id });

            Ok(())
        }

        /// 函数级详细中文注释：更新提供商配额（治理操作）
        ///
        /// ## 功能
        /// - 调整AI服务提供商的月度配额
        /// - 仅治理可调用
        /// - 可用于奖励优质服务或限制滥用
        ///
        /// ## 参数
        /// - `origin`: 治理起源
        /// - `provider_id`: 提供商ID
        /// - `new_quota`: 新配额值
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 提供商不存在
        ///
        /// ## 事件
        /// - `QuotaUpdated`: 配额更新成功
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::update_quota())]
        pub fn update_quota(
            origin: OriginFor<T>,
            provider_id: u64,
            new_quota: u32,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 获取并更新提供商
            AIProviders::<T>::try_mutate(provider_id, |maybe_provider| -> DispatchResult {
                let provider = maybe_provider.as_mut().ok_or(Error::<T>::ProviderNotFound)?;
                provider.monthly_quota = new_quota;
                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::QuotaUpdated {
                provider_id,
                new_quota,
            });

            Ok(())
        }

        /// 函数级详细中文注释：验证AI服务提供商（治理操作）
        ///
        /// ## 功能
        /// - 治理审核通过后，将提供商标记为"已验证"
        /// - 只有已验证的提供商才能访问训练数据
        /// - 验证过程应包括：资质审查、隐私协议、技术能力评估
        ///
        /// ## 参数
        /// - `origin`: 治理起源
        /// - `provider_id`: 提供商ID
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 提供商不存在
        ///
        /// ## 事件
        /// - `ProviderVerified`: 验证成功
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::verify_provider())]
        pub fn verify_provider(origin: OriginFor<T>, provider_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 获取并更新提供商
            AIProviders::<T>::try_mutate(provider_id, |maybe_provider| -> DispatchResult {
                let provider = maybe_provider.as_mut().ok_or(Error::<T>::ProviderNotFound)?;
                provider.verified = true;

                // 更新最后活跃时间
                let current_block = frame_system::Pallet::<T>::block_number();
                provider.last_active = current_block;

                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::ProviderVerified { provider_id });

            Ok(())
        }

        // =================== 数据查询与导出 ===================

        /// 函数级详细中文注释：查询训练数据（仅返回作品ID列表）
        ///
        /// ## 功能
        /// - AI服务提供商查询可用于训练的作品ID列表
        /// - 消耗配额：1 quota per query
        /// - 不返回作品详细内容，仅返回ID
        /// - 需要先验证才能调用
        ///
        /// ## 参数
        /// - `origin`: 已验证的AI服务提供商账户
        /// - `deceased_id`: 逝者ID
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 提供商不存在
        /// - `ProviderNotVerified`: 提供商未验证
        /// - `QuotaExceeded`: 配额不足
        /// - `DeceasedNotFound`: 逝者不存在
        ///
        /// ## 事件
        /// - `TrainingDataQueried`: 查询成功
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::query_training_data())]
        pub fn query_training_data(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 检查逝者是否存在
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );

            // 检查并消耗配额 (1 quota per query)
            Self::check_and_consume_quota(provider_id, 1)?;

            // 获取授权AI训练的作品列表
            let work_ids = T::DeceasedProvider::get_ai_training_works(deceased_id)?;
            let count = work_ids.len() as u32;

            // 触发事件
            Self::deposit_event(Event::TrainingDataQueried {
                provider_id,
                deceased_id,
                count,
            });

            Ok(())
        }

        /// 函数级详细中文注释：导出训练数据集（返回详细作品信息）
        ///
        /// ## 功能
        /// - 批量导出指定作品的详细信息
        /// - 消耗配额：work_ids.len() quota
        /// - 返回包含所有元数据的ExportedWork结构
        /// - 用于实际的AI训练
        ///
        /// ## 参数
        /// - `origin`: 已验证的AI服务提供商账户
        /// - `deceased_id`: 逝者ID
        /// - `work_ids`: 要导出的作品ID列表
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 提供商不存在
        /// - `ProviderNotVerified`: 提供商未验证
        /// - `QuotaExceeded`: 配额不足
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `TooManyWorks`: 单次导出作品过多（超过1000个）
        ///
        /// ## 事件
        /// - `DatasetExported`: 导出成功
        ///
        /// ## 注意
        /// - 实际数据通过runtime API或RPC返回，不通过事件返回
        /// - 这个extrinsic主要用于配额消耗和审计追踪
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::export_training_dataset())]
        pub fn export_training_dataset(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            work_ids: Vec<u64>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 检查逝者是否存在
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );

            // 检查作品数量限制
            ensure!(work_ids.len() <= 1000, Error::<T>::TooManyWorks);

            // 检查并消耗配额（每个作品消耗1配额）
            let quota_cost = work_ids.len() as u32;
            Self::check_and_consume_quota(provider_id, quota_cost)?;

            // 计算数据集哈希（用于完整性验证）
            let mut hash_data = Vec::new();
            for work_id in &work_ids {
                hash_data.extend_from_slice(&work_id.to_le_bytes());
            }
            let dataset_hash = sp_core::blake2_256(&hash_data);

            let work_count = work_ids.len() as u32;

            // 触发事件（实际数据通过RPC API返回）
            Self::deposit_event(Event::DatasetExported {
                provider_id,
                deceased_id,
                work_count,
                dataset_hash,
            });

            Ok(())
        }

        // =================== 训练任务管理 ===================

        /// 函数级详细中文注释：创建训练任务
        ///
        /// ## 功能
        /// - AI服务提供商创建训练任务记录
        /// - 记录使用的数据集快照
        /// - 用于追溯和审计
        ///
        /// ## 参数
        /// - `origin`: AI服务提供商账户
        /// - `deceased_id`: 逝者ID
        /// - `work_ids`: 用于训练的作品ID列表
        /// - `dataset_hash`: 数据集哈希（由客户端计算）
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 提供商不存在
        /// - `DeceasedNotFound`: 逝者不存在
        /// - `TooManyWorks`: 作品列表过长
        /// - `TooManyTasks`: 任务列表已满
        /// - `Overflow`: ID溢出
        ///
        /// ## 事件
        /// - `TrainingTaskCreated`: 任务创建成功
        #[pallet::call_index(6)]
        #[pallet::weight(T::WeightInfo::create_training_task())]
        pub fn create_training_task(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            work_ids: Vec<u64>,
            dataset_hash: [u8; 32],
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 检查逝者是否存在
            ensure!(
                T::DeceasedProvider::deceased_exists(deceased_id),
                Error::<T>::DeceasedNotFound
            );

            // 转换为BoundedVec
            let bounded_work_ids: BoundedVec<u64, ConstU32<1000>> = work_ids
                .try_into()
                .map_err(|_| Error::<T>::TooManyWorks)?;

            // 分配task_id
            let task_id = NextTaskId::<T>::get();
            let next_id = task_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前区块号
            let current_block = frame_system::Pallet::<T>::block_number();

            // 创建任务记录
            let task = TrainingTask {
                task_id,
                deceased_id,
                provider_id,
                dataset_hash,
                work_ids: bounded_work_ids,
                status: TrainingStatus::Pending,
                created_at: current_block,
                completed_at: None,
                result_cid: None,
            };

            // 写入存储
            TrainingTasks::<T>::insert(task_id, task);
            NextTaskId::<T>::put(next_id);

            // 更新索引
            TasksByDeceased::<T>::try_mutate(deceased_id, |tasks| -> DispatchResult {
                tasks.try_push(task_id).map_err(|_| Error::<T>::TooManyTasks)?;
                Ok(())
            })?;

            TasksByProvider::<T>::try_mutate(provider_id, |tasks| -> DispatchResult {
                tasks.try_push(task_id).map_err(|_| Error::<T>::TooManyTasks)?;
                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::TrainingTaskCreated {
                task_id,
                deceased_id,
                provider_id,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新训练任务状态
        ///
        /// ## 功能
        /// - AI服务提供商更新任务进度
        /// - 记录完成时间和结果CID
        /// - 只有任务所属提供商可以更新
        ///
        /// ## 参数
        /// - `origin`: 任务所属的AI服务提供商账户
        /// - `task_id`: 任务ID
        /// - `new_status`: 新状态（0-5）
        /// - `result_cid`: 结果CID（可选，状态为Completed时提供）
        ///
        /// ## 错误
        /// - `TaskNotFound`: 任务不存在
        /// - `NotTaskOwner`: 非任务所有者
        /// - `BadInput`: result_cid格式错误
        ///
        /// ## 事件
        /// - `TaskStatusUpdated`: 状态更新成功
        #[pallet::call_index(7)]
        #[pallet::weight(T::WeightInfo::update_task_status())]
        pub fn update_task_status(
            origin: OriginFor<T>,
            task_id: u64,
            new_status: u8,
            result_cid: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 转换result_cid
            let bounded_result_cid = if let Some(cid) = result_cid {
                Some(
                    cid.try_into()
                        .map_err(|_| Error::<T>::BadInput)?,
                )
            } else {
                None
            };

            // 更新任务
            TrainingTasks::<T>::try_mutate(task_id, |maybe_task| -> DispatchResult {
                let task = maybe_task.as_mut().ok_or(Error::<T>::TaskNotFound)?;

                // 检查权限
                ensure!(task.provider_id == provider_id, Error::<T>::NotTaskOwner);

                // 更新状态
                task.status = TrainingStatus::from_u8(new_status);

                // 如果状态为Completed，记录完成时间
                if task.status == TrainingStatus::Completed {
                    let current_block = frame_system::Pallet::<T>::block_number();
                    task.completed_at = Some(current_block);
                    task.result_cid = bounded_result_cid;
                }

                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::TaskStatusUpdated {
                task_id,
                new_status,
            });

            Ok(())
        }

        // =================== AI智能体注册 ===================

        /// 函数级详细中文注释：注册AI智能体
        ///
        /// ## 功能
        /// - AI服务提供商注册训练完成的智能体
        /// - 关联到具体的训练任务
        /// - 记录模型CID和版本信息
        ///
        /// ## 参数
        /// - `origin`: AI服务提供商账户
        /// - `deceased_id`: 逝者ID
        /// - `task_id`: 训练任务ID
        /// - `model_cid`: 模型CID（IPFS）
        /// - `model_type`: 模型类型（0-3）
        /// - `version`: 模型版本号
        ///
        /// ## 错误
        /// - `ProviderNotFound`: 提供商不存在
        /// - `TaskNotFound`: 任务不存在
        /// - `TaskNotCompleted`: 任务未完成
        /// - `NotTaskOwner`: 非任务所有者
        /// - `TooManyAgents`: 智能体列表已满
        /// - `BadInput`: model_cid格式错误
        /// - `Overflow`: ID溢出
        ///
        /// ## 事件
        /// - `AIAgentRegistered`: 注册成功
        #[pallet::call_index(8)]
        #[pallet::weight(T::WeightInfo::register_ai_agent())]
        pub fn register_ai_agent(
            origin: OriginFor<T>,
            deceased_id: T::DeceasedId,
            task_id: u64,
            model_cid: Vec<u8>,
            model_type: u8,
            version: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 检查任务
            let task = TrainingTasks::<T>::get(task_id).ok_or(Error::<T>::TaskNotFound)?;
            ensure!(task.provider_id == provider_id, Error::<T>::NotTaskOwner);
            ensure!(
                task.status == TrainingStatus::Completed,
                Error::<T>::TaskNotCompleted
            );
            ensure!(task.deceased_id == deceased_id, Error::<T>::BadInput);

            // 转换为BoundedVec
            let bounded_model_cid: BoundedVec<u8, ConstU32<64>> = model_cid
                .try_into()
                .map_err(|_| Error::<T>::BadInput)?;

            // 分配agent_id
            let agent_id = NextAgentId::<T>::get();
            let next_id = agent_id.checked_add(1).ok_or(Error::<T>::Overflow)?;

            // 获取当前区块号
            let current_block = frame_system::Pallet::<T>::block_number();

            // 创建智能体记录
            let agent = AIAgent {
                agent_id,
                deceased_id,
                task_id,
                provider_id,
                version,
                model_cid: bounded_model_cid,
                model_type: AIModelType::from_u8(model_type),
                deployment_status: DeploymentStatus::Testing,
                created_at: current_block,
                updated_at: current_block,
            };

            // 写入存储
            AIAgents::<T>::insert(agent_id, agent);
            NextAgentId::<T>::put(next_id);

            // 更新索引
            AgentsByDeceased::<T>::try_mutate(deceased_id, |agents| -> DispatchResult {
                agents.try_push(agent_id).map_err(|_| Error::<T>::TooManyAgents)?;
                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::AIAgentRegistered {
                agent_id,
                deceased_id,
                provider_id,
                model_type,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新AI智能体部署状态
        ///
        /// ## 功能
        /// - 更新智能体的部署状态（Testing → Live → Offline）
        /// - 只有智能体所属提供商可以更新
        ///
        /// ## 参数
        /// - `origin`: 智能体所属的AI服务提供商账户
        /// - `agent_id`: 智能体ID
        /// - `new_status`: 新状态（0-2）
        ///
        /// ## 错误
        /// - `AgentNotFound`: 智能体不存在
        /// - `NotAgentOwner`: 非智能体所有者
        ///
        /// ## 事件
        /// - `AgentStatusUpdated`: 状态更新成功
        #[pallet::call_index(9)]
        #[pallet::weight(T::WeightInfo::update_agent_status())]
        pub fn update_agent_status(
            origin: OriginFor<T>,
            agent_id: u64,
            new_status: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 获取provider_id
            let provider_id = ProviderByAccount::<T>::get(&who)
                .ok_or(Error::<T>::ProviderNotFound)?;

            // 更新智能体
            AIAgents::<T>::try_mutate(agent_id, |maybe_agent| -> DispatchResult {
                let agent = maybe_agent.as_mut().ok_or(Error::<T>::AgentNotFound)?;

                // 检查权限
                ensure!(agent.provider_id == provider_id, Error::<T>::NotAgentOwner);

                // 更新状态和时间
                agent.deployment_status = DeploymentStatus::from_u8(new_status);
                let current_block = frame_system::Pallet::<T>::block_number();
                agent.updated_at = current_block;

                Ok(())
            })?;

            // 触发事件
            Self::deposit_event(Event::AgentStatusUpdated {
                agent_id,
                new_status,
            });

            Ok(())
        }
    }

    // =================== Helper Functions ===================

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：检查提供商配额并消耗
        ///
        /// ## 功能
        /// - 检查提供商是否已验证
        /// - 检查配额是否充足
        /// - 消耗指定数量的配额
        ///
        /// ## 参数
        /// - `provider_id`: 提供商ID
        /// - `quota_cost`: 需要消耗的配额量
        ///
        /// ## 返回
        /// - 成功时返回 Ok(())
        /// - 失败时返回相应的Error
        fn check_and_consume_quota(provider_id: u64, quota_cost: u32) -> DispatchResult {
            AIProviders::<T>::try_mutate(provider_id, |maybe_provider| -> DispatchResult {
                let provider = maybe_provider.as_mut().ok_or(Error::<T>::ProviderNotFound)?;

                // 检查是否已验证
                ensure!(provider.verified, Error::<T>::ProviderNotVerified);

                // 检查配额
                let remaining = provider
                    .monthly_quota
                    .checked_sub(provider.used_quota)
                    .ok_or(Error::<T>::QuotaExceeded)?;
                ensure!(remaining >= quota_cost, Error::<T>::QuotaExceeded);

                // 消耗配额
                provider.used_quota = provider
                    .used_quota
                    .checked_add(quota_cost)
                    .ok_or(Error::<T>::Overflow)?;

                // 更新最后活跃时间
                let current_block = frame_system::Pallet::<T>::block_number();
                provider.last_active = current_block;

                Ok(())
            })
        }
    }
}
