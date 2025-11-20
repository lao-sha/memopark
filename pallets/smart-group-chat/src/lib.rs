#![cfg_attr(not(feature = "std"), no_std)]

/// Stardust智能群聊系统
///
/// 支持：
/// - 四种加密模式 (军用级、商用级、选择性、透明公开)
/// - 乐观UI更新
/// - AI智能决策
/// - 分层存储系统
/// - 量子抗性加密

pub use pallet::*;

use codec::{Decode, Encode};
use frame_support::{
    dispatch::{DispatchError, DispatchResult},
    pallet_prelude::*,
    traits::{Get, Randomness, UnixTime},
    PalletId,
    Blake2_128Concat,
};
use frame_system::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::{
    traits::{AccountIdConversion, Saturating, Zero},
    BoundedVec, RuntimeDebug,
};
use sp_std::vec::Vec;

pub mod types;
pub mod crypto;
pub mod storage;
pub mod ai;
pub mod quantum_resistant; // 新增量子抗性模块
pub mod plugin; // 新增插件生态系统模块
pub use types::*;
pub use crypto::*;
pub use storage::*;
pub use ai::*;
pub use quantum_resistant::*; // 导出量子抗性模块
pub use plugin::*; // 导出插件模块

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    /// Pallet配置trait
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 运行时事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 随机数生成器（用于群组ID和密钥生成）
        type Randomness: Randomness<Self::Hash, BlockNumberFor<Self>>;

        /// 时间服务（用于消息时间戳）
        type TimeProvider: UnixTime;

        /// 群组名称最大长度
        #[pallet::constant]
        type MaxGroupNameLen: Get<u32>;

        /// 群组描述最大长度
        #[pallet::constant]
        type MaxGroupDescriptionLen: Get<u32>;

        /// 群组最大成员数
        #[pallet::constant]
        type MaxGroupMembers: Get<u32>;

        /// 单用户最大群组数
        #[pallet::constant]
        type MaxGroupsPerUser: Get<u32>;

        /// 消息内容最大长度
        #[pallet::constant]
        type MaxMessageLen: Get<u32>;

        /// 群组历史消息保留数量
        #[pallet::constant]
        type MaxGroupMessageHistory: Get<u32>;

        /// IPFS CID最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;

        /// 加密密钥最大长度
        #[pallet::constant]
        type MaxKeyLen: Get<u32>;

        /// Pallet ID（用于生成内部账户）
        #[pallet::constant]
        type PalletId: Get<PalletId>;

        /// 消息发送频率限制（每分钟）
        #[pallet::constant]
        type MessageRateLimit: Get<u32>;

        /// 群组创建冷却期（区块数）
        #[pallet::constant]
        type GroupCreationCooldown: Get<BlockNumberFor<Self>>;
    }

    /// Pallet存储实现
    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 群组信息存储
    /// 映射: 群组ID => 群组信息
    #[pallet::storage]
    #[pallet::getter(fn groups)]
    pub type Groups<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        GroupId,
        GroupInfo<T>,
        OptionQuery
    >;

    /// 群组成员存储
    /// 映射: (群组ID, 成员ID) => 成员信息
    #[pallet::storage]
    #[pallet::getter(fn group_members)]
    pub type GroupMembers<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        GroupId,
        Blake2_128Concat,
        T::AccountId,
        GroupMemberInfo<T>,
        OptionQuery
    >;

    /// 用户群组列表存储
    /// 映射: 用户ID => 用户加入的群组列表
    #[pallet::storage]
    #[pallet::getter(fn user_groups)]
    pub type UserGroups<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<GroupId, T::MaxGroupsPerUser>,
        ValueQuery
    >;

    /// 群组消息存储（支持乐观更新）
    /// 映射: (群组ID, 消息ID) => 消息信息
    #[pallet::storage]
    #[pallet::getter(fn group_messages)]
    pub type GroupMessages<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        GroupId,
        Blake2_128Concat,
        MessageId,
        GroupMessageMeta<T>,
        OptionQuery
    >;

    /// 乐观消息队列存储
    /// 映射: (发送者, 临时ID) => 乐观消息信息
    #[pallet::storage]
    #[pallet::getter(fn optimistic_messages)]
    pub type OptimisticMessages<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        TempMessageId,
        OptimisticMessageState<T>,
        OptionQuery
    >;

    /// 群组加密配置存储
    /// 映射: 群组ID => 加密配置
    #[pallet::storage]
    #[pallet::getter(fn group_encryption_configs)]
    pub type GroupEncryptionConfigs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        GroupId,
        EncryptionConfig<T>,
        OptionQuery
    >;

    /// AI决策缓存存储
    /// 映射: (内容哈希, 上下文哈希) => AI决策结果
    #[pallet::storage]
    #[pallet::getter(fn ai_decision_cache)]
    pub type AIDecisionCache<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        [u8; 32], // content_hash
        Blake2_128Concat,
        [u8; 32], // context_hash
        AIDecisionResult<T>,
        OptionQuery
    >;

    /// 群组存储统计
    /// 映射: 群组ID => 存储统计信息
    #[pallet::storage]
    #[pallet::getter(fn group_storage_stats)]
    pub type GroupStorageStats<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        GroupId,
        StorageStats<T>,
        ValueQuery
    >;

    /// 用户行为分析数据存储
    /// 映射: 用户ID => 行为分析数据
    #[pallet::storage]
    #[pallet::getter(fn user_behavior_analysis)]
    pub type UserBehaviorAnalysis<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        UserBehaviorData<T>,
        OptionQuery
    >;

    /// 量子密钥对存储
    /// 映射: 群组ID => 量子密钥对
    #[pallet::storage]
    #[pallet::getter(fn quantum_keys)]
    pub type QuantumKeys<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        GroupId,
        QuantumKeyPair,
        OptionQuery
    >;

    /// 量子加密配置存储
    /// 映射: 群组ID => 量子加密配置
    #[pallet::storage]
    #[pallet::getter(fn quantum_configs)]
    pub type QuantumConfigs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        GroupId,
        QuantumEncryptionConfig,
        ValueQuery
    >;

    /// 密钥轮换历史
    /// 映射: 群组ID => 轮换记录列表
    #[pallet::storage]
    #[pallet::getter(fn key_rotation_history)]
    pub type KeyRotationHistory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        GroupId,
        BoundedVec<KeyRotationRecord<T>, ConstU32<100>>,
        ValueQuery
    >;

    /// 量子安全事件日志
    /// 映射: 事件ID => 安全事件
    #[pallet::storage]
    #[pallet::getter(fn quantum_security_events)]
    pub type QuantumSecurityEvents<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        QuantumSecurityEvent<T>,
        OptionQuery
    >;

    /// 下一个安全事件ID
    #[pallet::storage]
    #[pallet::getter(fn next_security_event_id)]
    pub type NextSecurityEventId<T> = StorageValue<_, u64, ValueQuery>;

    /// 量子抗性全局状态
    #[pallet::storage]
    #[pallet::getter(fn quantum_resistance_status)]
    pub type QuantumResistanceStatus<T> = StorageValue<_, QuantumResistanceStatus, ValueQuery>;

    /// ========== 插件生态系统存储 ==========

    /// 已注册插件信息
    /// 映射: 插件ID => 插件信息
    #[pallet::storage]
    #[pallet::getter(fn registered_plugins)]
    pub type RegisteredPlugins<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PluginId,
        PluginInfo,
        OptionQuery
    >;

    /// 插件状态
    /// 映射: 插件ID => 插件状态
    #[pallet::storage]
    #[pallet::getter(fn plugin_states)]
    pub type PluginStates<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PluginId,
        PluginState,
        ValueQuery
    >;

    /// 插件配置
    /// 映射: 插件ID => 插件配置
    #[pallet::storage]
    #[pallet::getter(fn plugin_configs)]
    pub type PluginConfigs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PluginId,
        PluginConfig,
        OptionQuery
    >;

    /// 插件钩子注册
    /// 映射: (钩子类型, 插件ID) => 是否注册
    #[pallet::storage]
    #[pallet::getter(fn plugin_hooks)]
    pub type PluginHooks<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        PluginHookType,
        Blake2_128Concat,
        PluginId,
        bool,
        ValueQuery
    >;

    /// 插件性能指标
    /// 映射: 插件ID => 性能指标
    #[pallet::storage]
    #[pallet::getter(fn plugin_metrics)]
    pub type PluginMetricsStorage<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PluginId,
        PluginMetrics,
        ValueQuery
    >;

    /// 插件沙盒环境
    /// 映射: 插件ID => 沙盒配置
    #[pallet::storage]
    #[pallet::getter(fn plugin_sandboxes)]
    pub type PluginSandboxes<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PluginId,
        PluginSandbox,
        OptionQuery
    >;

    /// 插件执行历史
    /// 映射: 插件ID => 执行历史列表（最近100次）
    #[pallet::storage]
    #[pallet::getter(fn plugin_execution_history)]
    pub type PluginExecutionHistory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        PluginId,
        BoundedVec<PluginExecutionRecord<T>, ConstU32<100>>,
        ValueQuery
    >;

    /// 群组插件白名单
    /// 映射: (群组ID, 插件ID) => 是否允许
    #[pallet::storage]
    #[pallet::getter(fn group_plugin_whitelist)]
    pub type GroupPluginWhitelist<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        GroupId,
        Blake2_128Concat,
        PluginId,
        bool,
        ValueQuery
    >;

    /// 全局插件设置
    #[pallet::storage]
    #[pallet::getter(fn global_plugin_settings)]
    pub type GlobalPluginSettings<T> = StorageValue<_, GlobalPluginConfig, ValueQuery>;

    /// 下一个群组ID
    #[pallet::storage]
    #[pallet::getter(fn next_group_id)]
    pub type NextGroupId<T> = StorageValue<_, GroupId, ValueQuery>;

    /// 下一个消息ID
    #[pallet::storage]
    #[pallet::getter(fn next_message_id)]
    pub type NextMessageId<T> = StorageValue<_, MessageId, ValueQuery>;

    /// 群组创建冷却记录
    /// 映射: 用户ID => 最后创建群组的区块号
    #[pallet::storage]
    #[pallet::getter(fn group_creation_cooldowns)]
    pub type GroupCreationCooldowns<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BlockNumberFor<T>,
        OptionQuery
    >;

    /// 消息发送频率限制
    /// 映射: (用户ID, 时间窗口) => 发送计数
    #[pallet::storage]
    #[pallet::getter(fn message_rate_limits)]
    pub type MessageRateLimits<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        u64, // 时间窗口（分钟）
        u32, // 发送计数
        ValueQuery
    >;

    /// Genesis配置
    #[pallet::genesis_config]
    #[derive(frame_support::DefaultNoBound)]
    pub struct GenesisConfig<T: Config> {
        pub _phantom: sp_std::marker::PhantomData<T>,
    }

    #[pallet::genesis_build]
    impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
            // 初始化下一个群组ID和消息ID
            NextGroupId::<T>::put(1u64);
            NextMessageId::<T>::put(1u64);
        }
    }

    /// 事件定义
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 群组创建成功
        /// [创建者, 群组ID, 群组名称]
        GroupCreated {
            creator: T::AccountId,
            group_id: GroupId,
            name: BoundedVec<u8, T::MaxGroupNameLen>,
        },

        /// 成员加入群组
        /// [群组ID, 新成员, 邀请者]
        MemberJoined {
            group_id: GroupId,
            member: T::AccountId,
            inviter: T::AccountId,
        },

        /// 成员离开群组
        /// [群组ID, 成员]
        MemberLeft {
            group_id: GroupId,
            member: T::AccountId,
        },

        /// 群组消息发送（乐观确认）
        /// [群组ID, 发送者, 消息ID, 临时ID, 加密模式]
        GroupMessageSent {
            group_id: GroupId,
            sender: T::AccountId,
            message_id: MessageId,
            temp_id: Option<TempMessageId>,
            encryption_mode: EncryptionMode,
        },

        /// 乐观消息状态更新
        /// [发送者, 临时ID, 新状态]
        OptimisticMessageUpdated {
            sender: T::AccountId,
            temp_id: TempMessageId,
            status: OptimisticStatus,
        },

        /// 群组加密配置更新
        /// [群组ID, 新加密模式, 操作者]
        GroupEncryptionUpdated {
            group_id: GroupId,
            encryption_mode: EncryptionMode,
            updated_by: T::AccountId,
        },

        /// AI决策触发
        /// [群组ID, 决策类型, 结果]
        AIDecisionTriggered {
            group_id: GroupId,
            decision_type: AIDecisionType,
            result: AIDecisionResult<T>,
        },

        /// 存储层级自动迁移
        /// [群组ID, 消息ID, 源层级, 目标层级]
        StorageTierMigrated {
            group_id: GroupId,
            message_id: MessageId,
            from_tier: StorageTier,
            to_tier: StorageTier,
        },

        /// 群组解散
        /// [群组ID, 解散者]
        GroupDisbanded {
            group_id: GroupId,
            disbanded_by: T::AccountId,
        },

        /// 紧急状态激活（安全相关）
        /// [群组ID, 触发原因]
        EmergencyStateActivated {
            group_id: GroupId,
            reason: EmergencyReason,
        },

        /// 量子密钥对生成完成
        /// [群组ID, 密钥版本, 生成时间]
        QuantumKeysGenerated {
            group_id: GroupId,
            key_version: u32,
            generated_at: u64,
        },

        /// 量子密钥轮换完成
        /// [群组ID, 旧版本, 新版本, 轮换原因]
        QuantumKeyRotated {
            group_id: GroupId,
            old_version: u32,
            new_version: u32,
            reason: KeyRotationReason,
        },

        /// 量子安全事件检测
        /// [事件ID, 事件类型, 严重等级, 群组ID（可选）]
        QuantumSecurityEventDetected {
            event_id: u64,
            event_type: QuantumSecurityEventType,
            severity: SecuritySeverity,
            group_id: Option<GroupId>,
        },

        /// 量子加密配置更新
        /// [群组ID, 新配置, 更新者]
        QuantumConfigUpdated {
            group_id: GroupId,
            config: QuantumEncryptionConfig,
            updated_by: T::AccountId,
        },

        /// 侧信道攻击检测
        /// [群组ID, 攻击类型, 检测时间]
        SideChannelAttackDetected {
            group_id: GroupId,
            attack_type: BoundedVec<u8, ConstU32<128>>,
            detected_at: u64,
        },

        /// 量子抗性状态更新
        /// [启用状态, 当前版本, 更新时间]
        QuantumResistanceStatusUpdated {
            enabled: bool,
            current_version: u32,
            updated_at: u64,
        },

        /// ========== 插件生态系统事件 ==========

        /// 插件注册成功
        /// [插件ID, 插件名称, 作者]
        PluginRegistered {
            plugin_id: PluginId,
            name: BoundedVec<u8, ConstU32<64>>,
            author: BoundedVec<u8, ConstU32<128>>,
        },

        /// 插件卸载
        /// [插件ID, 卸载者]
        PluginUnregistered {
            plugin_id: PluginId,
            unregistered_by: T::AccountId,
        },

        /// 插件状态变更
        /// [插件ID, 旧状态, 新状态]
        PluginStateChanged {
            plugin_id: PluginId,
            old_state: PluginState,
            new_state: PluginState,
        },

        /// 插件钩子执行
        /// [插件ID, 钩子类型, 执行是否成功, 执行时间]
        PluginHookExecuted {
            plugin_id: PluginId,
            hook_type: PluginHookType,
            success: bool,
            execution_time: u32,
        },

        /// 插件配置更新
        /// [插件ID, 更新者]
        PluginConfigUpdated {
            plugin_id: PluginId,
            updated_by: T::AccountId,
        },

        /// 插件错误发生
        /// [插件ID, 错误类型, 错误消息]
        PluginError {
            plugin_id: PluginId,
            error_type: BoundedVec<u8, ConstU32<32>>,
            error_message: BoundedVec<u8, ConstU32<256>>,
        },

        /// 群组插件权限变更
        /// [群组ID, 插件ID, 是否允许, 操作者]
        GroupPluginPermissionChanged {
            group_id: GroupId,
            plugin_id: PluginId,
            allowed: bool,
            changed_by: T::AccountId,
        },

        /// 全局插件设置更新
        /// [更新者]
        GlobalPluginSettingsUpdated {
            updated_by: T::AccountId,
        },
    }

    /// 错误定义
    #[pallet::error]
    pub enum Error<T> {
        /// 群组不存在
        GroupNotFound,
        /// 用户不是群组成员
        NotGroupMember,
        /// 权限不足
        InsufficientPermission,
        /// 群组已满
        GroupFull,
        /// 用户加入的群组数量已达上限
        TooManyGroups,
        /// 群组名称太长
        GroupNameTooLong,
        /// 群组描述太长
        GroupDescriptionTooLong,
        /// 消息内容太长
        MessageTooLong,
        /// 消息发送频率过快
        MessageRateExceeded,
        /// 群组创建冷却期未过
        GroupCreationCooldown,
        /// 加密模式不支持
        UnsupportedEncryptionMode,
        /// 临时消息ID已存在
        TempMessageIdExists,
        /// 临时消息不存在
        TempMessageNotFound,
        /// AI决策失败
        AIDecisionFailed,
        /// 存储配额不足
        InsufficientStorageQuota,
        /// 量子随机数生成失败
        QuantumRandomnessFailed,
        /// 密钥生成失败
        KeyGenerationFailed,
        /// 加密操作失败
        EncryptionFailed,
        /// 解密操作失败
        DecryptionFailed,
        /// IPFS操作失败
        IPFSOperationFailed,
        /// 数据完整性校验失败
        DataIntegrityCheckFailed,
        /// 群组处于紧急状态
        GroupInEmergencyState,
        /// 无效的加密配置
        InvalidEncryptionConfig,
        /// 量子密钥对生成失败
        QuantumKeyPairGenerationFailed,
        /// 量子密钥轮换失败
        QuantumKeyRotationFailed,
        /// 量子安全事件处理失败
        QuantumSecurityEventFailed,
        /// 侧信道攻击检测失败
        SideChannelAttackDetectionFailed,
        /// 量子随机数质量不足
        QuantumRandomnessQualityInsufficient,
        /// 密钥轮换间隔未到
        KeyRotationIntervalNotReached,
        /// 量子加密配置无效
        InvalidQuantumConfig,
        /// 量子签名验证失败
        QuantumSignatureVerificationFailed,
        /// 多重校验和验证失败
        MultipleChecksumsVerificationFailed,

        /// ========== 插件生态系统错误 ==========

        /// 插件已存在
        PluginAlreadyExists,
        /// 插件不存在
        PluginNotFound,
        /// 插件名称无效
        InvalidPluginName,
        /// 插件版本无效
        InvalidPluginVersion,
        /// 插件作者信息无效
        InvalidPluginAuthor,
        /// 插件描述过长
        PluginDescriptionTooLong,
        /// 插件权限不一致
        InconsistentPluginPermissions,
        /// 插件沙盒创建失败
        PluginSandboxCreationFailed,
        /// 插件初始化失败
        PluginInitializationFailed,
        /// 插件执行失败
        PluginExecutionFailed,
        /// 插件权限不足
        InsufficientPluginPermissions,
        /// 插件资源超限
        PluginResourceLimitExceeded,
        /// 插件执行超时
        PluginExecutionTimeout,
        /// 插件配置项过多
        TooManyPluginConfigSettings,
        /// 插件配置值无效
        InvalidPluginConfigValue,
        /// 插件沙盒错误
        PluginSandboxError,
        /// 插件系统已禁用
        PluginSystemDisabled,
        /// 超出插件数量限制
        TooManyPlugins,
        /// 群组插件权限拒绝
        GroupPluginPermissionDenied,
    }

    /// 外部调用接口
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 创建智能群组
        ///
        /// # 参数
        /// - `origin`: 创建者
        /// - `name`: 群组名称
        /// - `description`: 群组描述
        /// - `encryption_mode`: 初始加密模式
        /// - `max_members`: 最大成员数（可选）
        /// - `is_public`: 是否公开可见
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_group(
            origin: OriginFor<T>,
            name: BoundedVec<u8, T::MaxGroupNameLen>,
            description: Option<BoundedVec<u8, T::MaxGroupDescriptionLen>>,
            encryption_mode: EncryptionMode,
            max_members: Option<u32>,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查群组创建冷却期
            Self::check_group_creation_cooldown(&who)?;

            // 检查用户群组数量限制
            ensure!(
                UserGroups::<T>::get(&who).len() < T::MaxGroupsPerUser::get() as usize,
                Error::<T>::TooManyGroups
            );

            // 生成群组ID
            let group_id = Self::generate_group_id()?;

            // 生成加密密钥（根据加密模式）
            let encryption_config = Self::generate_encryption_config(encryption_mode, &who)?;

            // 创建群组信息
            let group_info = GroupInfo {
                creator: who.clone(),
                name: name.clone(),
                description: description.clone(),
                encryption_mode,
                max_members: max_members.unwrap_or(T::MaxGroupMembers::get()),
                current_member_count: 1u32,
                created_at: T::TimeProvider::now().as_secs(),
                is_public,
                is_active: true,
                emergency_state: None,
                ai_settings: AISettings::default(),
            };

            // 创建创建者的成员信息
            let creator_member_info = GroupMemberInfo {
                account_id: who.clone(),
                role: GroupRole::Admin,
                joined_at: T::TimeProvider::now().as_secs(),
                permissions: GroupPermissions::all_permissions(),
                encryption_key_share: encryption_config.admin_key_share.clone(),
                last_activity: T::TimeProvider::now().as_secs(),
            };

            // 存储群组信息
            Groups::<T>::insert(group_id, &group_info);
            GroupMembers::<T>::insert(group_id, &who, &creator_member_info);
            GroupEncryptionConfigs::<T>::insert(group_id, &encryption_config);

            // 更新用户群组列表
            UserGroups::<T>::try_mutate(&who, |groups| {
                groups.try_push(group_id).map_err(|_| Error::<T>::TooManyGroups)
            })?;

            // 初始化存储统计
            let initial_stats = StorageStats {
                total_messages: 0,
                on_chain_storage: 0,
                ipfs_storage: 0,
                cached_storage: 0,
                temporary_storage: 0,
                last_cleanup: T::TimeProvider::now().as_secs(),
            };
            GroupStorageStats::<T>::insert(group_id, initial_stats);

            // 更新群组创建冷却
            GroupCreationCooldowns::<T>::insert(
                &who,
                frame_system::Pallet::<T>::block_number()
            );

            // 发送事件
            Self::deposit_event(Event::GroupCreated {
                creator: who,
                group_id,
                name,
            });

            Ok(())
        }

        /// 发送群组消息（支持乐观UI更新）
        ///
        /// # 参数
        /// - `origin`: 发送者
        /// - `group_id`: 目标群组ID
        /// - `content`: 消息内容或IPFS CID
        /// - `message_type`: 消息类型
        /// - `temp_id`: 临时消息ID（用于乐观更新）
        /// - `force_encryption_mode`: 强制指定加密模式（可选）
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn send_group_message(
            origin: OriginFor<T>,
            group_id: GroupId,
            content: BoundedVec<u8, T::MaxMessageLen>,
            message_type: MessageType,
            temp_id: Option<TempMessageId>,
            force_encryption_mode: Option<EncryptionMode>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证用户是否为群组成员
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;

            // 检查群组是否处于紧急状态
            let group_info = Self::groups(group_id).ok_or(Error::<T>::GroupNotFound)?;
            ensure!(
                group_info.emergency_state.is_none(),
                Error::<T>::GroupInEmergencyState
            );

            // 检查消息发送频率限制
            Self::check_message_rate_limit(&who)?;

            // 生成消息ID
            let message_id = Self::generate_message_id()?;

            // AI智能决策：选择加密模式
            let final_encryption_mode = if let Some(forced_mode) = force_encryption_mode {
                // 检查用户是否有权限强制指定加密模式
                ensure!(
                    member_info.role == GroupRole::Admin || member_info.role == GroupRole::Moderator,
                    Error::<T>::InsufficientPermission
                );
                forced_mode
            } else {
                // 使用AI智能决策
                Self::ai_decide_encryption_mode(
                    &content,
                    &group_info,
                    &member_info,
                    group_id,
                )?
            };

            // 根据加密模式处理消息内容
            let (processed_content, storage_strategy) = Self::process_message_content(
                &content,
                final_encryption_mode,
                &group_info,
                message_type,
            )?;

            // 创建消息元数据
            let message_meta = GroupMessageMeta {
                id: message_id,
                group_id,
                sender: who.clone(),
                content: processed_content.clone(),
                message_type,
                encryption_mode: final_encryption_mode,
                storage_tier: storage_strategy.initial_tier(),
                sent_at: T::TimeProvider::now().as_secs(),
                temp_id,
                confirmation_status: if temp_id.is_some() {
                    ConfirmationStatus::Optimistic
                } else {
                    ConfirmationStatus::Confirmed
                },
                ai_analysis: None, // 将在后台异步填充
                access_count: 0,
                last_accessed: T::TimeProvider::now().as_secs(),
            };

            // 如果是乐观消息，先创建乐观状态
            if let Some(temp_id) = temp_id {
                let optimistic_state = OptimisticMessageState {
                    temp_id,
                    real_message_id: Some(message_id),
                    status: OptimisticStatus::Processing,
                    progress: 10u8, // 开始处理
                    stage: ProcessingStage::Encrypting,
                    created_at: T::TimeProvider::now().as_secs(),
                    estimated_confirm_time: Self::estimate_confirmation_time(final_encryption_mode, &storage_strategy),
                    error_info: None,
                    retry_count: 0,
                };

                OptimisticMessages::<T>::insert(&who, temp_id, optimistic_state);

                Self::deposit_event(Event::OptimisticMessageUpdated {
                    sender: who.clone(),
                    temp_id,
                    status: OptimisticStatus::Processing,
                });
            }

            // 执行存储策略
            Self::execute_storage_strategy(&message_meta, &storage_strategy)?;

            // 存储消息元数据
            GroupMessages::<T>::insert(group_id, message_id, &message_meta);

            // 更新存储统计
            Self::update_storage_stats(group_id, &storage_strategy)?;

            // 更新消息发送频率计数
            Self::update_message_rate_count(&who)?;

            // 更新成员最后活动时间
            GroupMembers::<T>::try_mutate(group_id, &who, |member_opt| {
                if let Some(member) = member_opt {
                    member.last_activity = T::TimeProvider::now().as_secs();
                }
                Ok::<(), DispatchError>(())
            })?;

            // 如果是乐观消息，更新为确认状态
            if let Some(temp_id) = temp_id {
                OptimisticMessages::<T>::try_mutate(&who, temp_id, |state_opt| {
                    if let Some(state) = state_opt {
                        state.status = OptimisticStatus::Confirmed;
                        state.progress = 100;
                        state.stage = ProcessingStage::Completed;
                    }
                    Ok::<(), DispatchError>(())
                })?;

                Self::deposit_event(Event::OptimisticMessageUpdated {
                    sender: who.clone(),
                    temp_id,
                    status: OptimisticStatus::Confirmed,
                });
            }

            // 发送消息事件
            Self::deposit_event(Event::GroupMessageSent {
                group_id,
                sender: who,
                message_id,
                temp_id,
                encryption_mode: final_encryption_mode,
            });

            // 更新下一个消息ID
            NextMessageId::<T>::put(message_id + 1);

            Ok(())
        }

        /// 加入群组
        ///
        /// # 参数
        /// - `origin`: 加入者
        /// - `group_id`: 群组ID
        /// - `invite_code`: 邀请码（可选）
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn join_group(
            origin: OriginFor<T>,
            group_id: GroupId,
            invite_code: Option<BoundedVec<u8, ConstU32<32>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查群组是否存在
            let mut group_info = Self::groups(group_id).ok_or(Error::<T>::GroupNotFound)?;

            // 检查用户是否已经是成员
            ensure!(
                !GroupMembers::<T>::contains_key(group_id, &who),
                Error::<T>::NotGroupMember
            );

            // 检查群组是否已满
            ensure!(
                group_info.current_member_count < group_info.max_members,
                Error::<T>::GroupFull
            );

            // 检查用户群组数量限制
            ensure!(
                UserGroups::<T>::get(&who).len() < T::MaxGroupsPerUser::get() as usize,
                Error::<T>::TooManyGroups
            );

            // 如果群组不是公开的，需要验证邀请码
            if !group_info.is_public {
                // TODO: 实现邀请码验证逻辑
                // Self::verify_invite_code(group_id, invite_code)?;
            }

            // 获取加密配置，为新成员生成密钥份额
            let encryption_config = Self::group_encryption_configs(group_id)
                .ok_or(Error::<T>::GroupNotFound)?;

            let member_key_share = Self::generate_member_key_share(
                &encryption_config,
                &who,
            )?;

            // 创建成员信息
            let member_info = GroupMemberInfo {
                account_id: who.clone(),
                role: GroupRole::Member,
                joined_at: T::TimeProvider::now().as_secs(),
                permissions: GroupPermissions::default_member_permissions(),
                encryption_key_share: member_key_share,
                last_activity: T::TimeProvider::now().as_secs(),
            };

            // 存储成员信息
            GroupMembers::<T>::insert(group_id, &who, member_info);

            // 更新用户群组列表
            UserGroups::<T>::try_mutate(&who, |groups| {
                groups.try_push(group_id).map_err(|_| Error::<T>::TooManyGroups)
            })?;

            // 更新群组成员计数
            group_info.current_member_count = group_info.current_member_count.saturating_add(1);
            Groups::<T>::insert(group_id, group_info);

            // 发送事件
            Self::deposit_event(Event::MemberJoined {
                group_id,
                member: who,
                inviter: group_info.creator, // 简化处理，实际应该记录邀请者
            });

            Ok(())
        }

        /// 更新群组加密模式
        ///
        /// # 参数
        /// - `origin`: 操作者（需要管理员权限）
        /// - `group_id`: 群组ID
        /// - `new_encryption_mode`: 新的加密模式
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn update_group_encryption(
            origin: OriginFor<T>,
            group_id: GroupId,
            new_encryption_mode: EncryptionMode,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证用户是否为群组管理员
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;
            ensure!(
                member_info.role == GroupRole::Admin,
                Error::<T>::InsufficientPermission
            );

            // 检查群组是否存在
            let mut group_info = Self::groups(group_id).ok_or(Error::<T>::GroupNotFound)?;

            // 如果加密模式没有变化，直接返回
            if group_info.encryption_mode == new_encryption_mode {
                return Ok(());
            }

            // 生成新的加密配置
            let new_encryption_config = Self::generate_encryption_config(new_encryption_mode, &who)?;

            // 更新群组信息
            group_info.encryption_mode = new_encryption_mode;
            Groups::<T>::insert(group_id, group_info);

            // 更新加密配置
            GroupEncryptionConfigs::<T>::insert(group_id, new_encryption_config);

            // TODO: 为所有现有成员重新生成密钥份额
            // Self::regenerate_member_keys(group_id, new_encryption_mode)?;

            // 发送事件
            Self::deposit_event(Event::GroupEncryptionUpdated {
                group_id,
                encryption_mode: new_encryption_mode,
                updated_by: who,
            });

            Ok(())
        }

        /// 离开群组
        ///
        /// # 参数
        /// - `origin`: 离开者
        /// - `group_id`: 群组ID
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn leave_group(
            origin: OriginFor<T>,
            group_id: GroupId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证用户是否为群组成员
            ensure!(
                GroupMembers::<T>::contains_key(group_id, &who),
                Error::<T>::NotGroupMember
            );

            // 检查群组是否存在
            let mut group_info = Self::groups(group_id).ok_or(Error::<T>::GroupNotFound)?;

            // 移除成员信息
            GroupMembers::<T>::remove(group_id, &who);

            // 从用户群组列表中移除
            UserGroups::<T>::try_mutate(&who, |groups| {
                groups.retain(|&g| g != group_id);
                Ok::<(), DispatchError>(())
            })?;

            // 更新群组成员计数
            group_info.current_member_count = group_info.current_member_count.saturating_sub(1);

            // 如果没有成员了，解散群组
            if group_info.current_member_count == 0 {
                Self::disband_group_internal(group_id)?;
                Self::deposit_event(Event::GroupDisbanded {
                    group_id,
                    disbanded_by: who.clone(),
                });
            } else {
                Groups::<T>::insert(group_id, group_info);
            }

            // 发送事件
            Self::deposit_event(Event::MemberLeft {
                group_id,
                member: who,
            });

            Ok(())
        }

        /// 管理员解散群组
        ///
        /// # 参数
        /// - `origin`: 管理员
        /// - `group_id`: 群组ID
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn disband_group(
            origin: OriginFor<T>,
            group_id: GroupId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证用户是否为群组管理员
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;
            ensure!(
                member_info.role == GroupRole::Admin,
                Error::<T>::InsufficientPermission
            );

            // 解散群组
            Self::disband_group_internal(group_id)?;

            // 发送事件
            Self::deposit_event(Event::GroupDisbanded {
                group_id,
                disbanded_by: who,
            });

            Ok(())
        }

        /// 清理过期的乐观消息
        ///
        /// # 参数
        /// - `origin`: 任何用户都可以调用
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn cleanup_expired_optimistic_messages(origin: OriginFor<T>) -> DispatchResult {
            ensure_signed(origin)?;

            let current_time = T::TimeProvider::now().as_secs();
            let expiry_threshold = current_time - 3600; // 1小时过期

            // 批量清理过期的乐观消息
            let mut cleaned_count = 0u32;
            let max_cleanup_per_call = 50u32; // 限制单次清理数量，避免区块权重过大

            OptimisticMessages::<T>::translate::<OptimisticMessageState<T>, _>(
                |_sender, _temp_id, state| {
                    if cleaned_count >= max_cleanup_per_call {
                        return Some(state);
                    }

                    // 检查是否过期
                    if state.created_at < expiry_threshold &&
                       matches!(state.status, OptimisticStatus::Failed | OptimisticStatus::Expired) {
                        cleaned_count += 1;
                        None // 删除这个条目
                    } else {
                        Some(state) // 保留这个条目
                    }
                }
            );

            Ok(())
        }

        /// 触发存储层级迁移
        ///
        /// # 参数
        /// - `origin`: 任何用户都可以调用（公共服务）
        /// - `group_id`: 群组ID
        #[pallet::call_index(7)]
        #[pallet::weight(10_000)]
        pub fn trigger_storage_migration(
            origin: OriginFor<T>,
            group_id: GroupId,
        ) -> DispatchResult {
            ensure_signed(origin)?;

            // 检查群组是否存在
            ensure!(Groups::<T>::contains_key(group_id), Error::<T>::GroupNotFound);

            // 执行智能存储迁移
            Self::execute_intelligent_storage_migration(group_id)?;

            Ok(())
        }

        /// 激活紧急状态（安全相关）
        ///
        /// # 参数
        /// - `origin`: Root权限或群组管理员
        /// - `group_id`: 群组ID
        /// - `reason`: 紧急状态原因
        #[pallet::call_index(8)]
        #[pallet::weight(10_000)]
        pub fn activate_emergency_state(
            origin: OriginFor<T>,
            group_id: GroupId,
            reason: EmergencyReason,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证权限（管理员或Root）
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;
            ensure!(
                member_info.role == GroupRole::Admin,
                Error::<T>::InsufficientPermission
            );

            // 更新群组紧急状态
            Groups::<T>::try_mutate(group_id, |group_opt| {
                if let Some(group) = group_opt {
                    group.emergency_state = Some(EmergencyState {
                        reason: reason.clone(),
                        activated_at: T::TimeProvider::now().as_secs(),
                        activated_by: who.clone(),
                    });
                }
                Ok::<(), DispatchError>(())
            })?;

            // 发送事件
            Self::deposit_event(Event::EmergencyStateActivated {
                group_id,
                reason,
            });

            Ok(())
        }

        /// 生成群组量子密钥对
        ///
        /// # 参数
        /// - `origin`: 群组管理员
        /// - `group_id`: 群组ID
        #[pallet::call_index(9)]
        #[pallet::weight(50_000)]
        pub fn generate_quantum_keys(
            origin: OriginFor<T>,
            group_id: GroupId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证权限
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;
            ensure!(
                member_info.role == GroupRole::Admin,
                Error::<T>::InsufficientPermission
            );

            // 检查群组是否存在
            ensure!(Groups::<T>::contains_key(group_id), Error::<T>::GroupNotFound);

            // 生成量子密钥对
            let quantum_keypair = Self::generate_quantum_keypair()?;
            let key_version = Self::get_next_key_version(group_id);
            let current_time = T::TimeProvider::now().as_secs();

            // 存储量子密钥对
            QuantumKeys::<T>::insert(group_id, &quantum_keypair);

            // 更新量子加密配置
            let quantum_config = QuantumEncryptionConfig::default();
            QuantumConfigs::<T>::insert(group_id, &quantum_config);

            // 更新全局量子抗性状态
            QuantumResistanceStatus::<T>::mutate(|status| {
                status.current_key_version = key_version;
                status.last_key_rotation = current_time;
                status.total_rotations = status.total_rotations.saturating_add(1);
                status.last_security_check = current_time;
            });

            // 发送事件
            Self::deposit_event(Event::QuantumKeysGenerated {
                group_id,
                key_version,
                generated_at: current_time,
            });

            Ok(())
        }

        /// 量子密钥轮换
        ///
        /// # 参数
        /// - `origin`: 群组管理员
        /// - `group_id`: 群组ID
        /// - `reason`: 轮换原因
        #[pallet::call_index(10)]
        #[pallet::weight(50_000)]
        pub fn rotate_quantum_keys(
            origin: OriginFor<T>,
            group_id: GroupId,
            reason: KeyRotationReason,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证权限
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;
            ensure!(
                member_info.role == GroupRole::Admin,
                Error::<T>::InsufficientPermission
            );

            // 检查轮换间隔（如果是定期轮换）
            if matches!(reason, KeyRotationReason::Scheduled) {
                Self::check_key_rotation_interval(group_id)?;
            }

            // 获取当前密钥版本
            let old_version = Self::get_current_key_version(group_id);
            let new_version = old_version.saturating_add(1);

            // 生成新的量子密钥对
            let new_quantum_keypair = Self::generate_quantum_keypair()?;

            // 创建密钥轮换记录
            let rotation_record = KeyRotationRecord {
                rotation_time: T::TimeProvider::now().as_secs(),
                old_key_fingerprint: Self::calculate_key_fingerprint(&Self::quantum_keys(group_id))?,
                new_key_fingerprint: Self::calculate_key_fingerprint(&Some(new_quantum_keypair.clone()))?,
                reason: reason.clone(),
                rotated_by: who.clone(),
            };

            // 更新密钥轮换历史
            KeyRotationHistory::<T>::try_mutate(group_id, |history| {
                history.try_push(rotation_record).map_err(|_| Error::<T>::QuantumKeyRotationFailed)
            })?;

            // 存储新密钥对
            QuantumKeys::<T>::insert(group_id, &new_quantum_keypair);

            // 发送事件
            Self::deposit_event(Event::QuantumKeyRotated {
                group_id,
                old_version,
                new_version,
                reason,
            });

            Ok(())
        }

        /// 更新量子加密配置
        ///
        /// # 参数
        /// - `origin`: 群组管理员
        /// - `group_id`: 群组ID
        /// - `config`: 新的量子加密配置
        #[pallet::call_index(11)]
        #[pallet::weight(20_000)]
        pub fn update_quantum_config(
            origin: OriginFor<T>,
            group_id: GroupId,
            config: QuantumEncryptionConfig,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证权限
            let member_info = Self::group_members(group_id, &who)
                .ok_or(Error::<T>::NotGroupMember)?;
            ensure!(
                member_info.role == GroupRole::Admin,
                Error::<T>::InsufficientPermission
            );

            // 验证配置有效性
            Self::validate_quantum_config(&config)?;

            // 更新配置
            QuantumConfigs::<T>::insert(group_id, &config);

            // 发送事件
            Self::deposit_event(Event::QuantumConfigUpdated {
                group_id,
                config,
                updated_by: who,
            });

            Ok(())
        }

        /// 报告量子安全事件
        ///
        /// # 参数
        /// - `origin`: 任何用户或系统
        /// - `event_type`: 安全事件类型
        /// - `severity`: 严重等级
        /// - `group_id`: 相关群组（可选）
        /// - `description`: 事件描述
        #[pallet::call_index(12)]
        #[pallet::weight(15_000)]
        pub fn report_security_event(
            origin: OriginFor<T>,
            event_type: QuantumSecurityEventType,
            severity: SecuritySeverity,
            group_id: Option<GroupId>,
            description: BoundedVec<u8, ConstU32<512>>,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            // 生成事件ID
            let event_id = Self::next_security_event_id();
            NextSecurityEventId::<T>::put(event_id + 1);

            // 创建安全事件记录
            let security_event = QuantumSecurityEvent {
                event_type: event_type.clone(),
                severity: severity.clone(),
                detected_at: T::TimeProvider::now().as_secs(),
                group_id,
                account_id: Some(_who),
                description,
                handled: false,
            };

            // 存储安全事件
            QuantumSecurityEvents::<T>::insert(event_id, &security_event);

            // 更新全局状态
            QuantumResistanceStatus::<T>::mutate(|status| {
                status.security_events_count = status.security_events_count.saturating_add(1);
                status.last_security_check = T::TimeProvider::now().as_secs();
            });

            // 发送事件
            Self::deposit_event(Event::QuantumSecurityEventDetected {
                event_id,
                event_type,
                severity,
                group_id,
            });

            // 如果是严重事件，自动触发相应的安全措施
            if matches!(severity, SecuritySeverity::Critical) {
                Self::handle_critical_security_event(group_id, &security_event)?;
            }

            Ok(())
        }

        /// 启用或禁用群组量子抗性
        ///
        /// # 参数
        /// - `origin`: 群组管理员或Root
        /// - `group_id`: 群组ID（None表示全局设置）
        /// - `enabled`: 是否启用量子抗性
        #[pallet::call_index(13)]
        #[pallet::weight(30_000)]
        pub fn set_quantum_resistance(
            origin: OriginFor<T>,
            group_id: Option<GroupId>,
            enabled: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            if let Some(gid) = group_id {
                // 群组级别设置
                let member_info = Self::group_members(gid, &who)
                    .ok_or(Error::<T>::NotGroupMember)?;
                ensure!(
                    member_info.role == GroupRole::Admin,
                    Error::<T>::InsufficientPermission
                );

                QuantumConfigs::<T>::mutate(gid, |config| {
                    config.enabled = enabled;
                });
            } else {
                // 全局设置（需要Root权限）
                ensure_root(origin)?;

                QuantumResistanceStatus::<T>::mutate(|status| {
                    status.enabled = enabled;
                    status.last_security_check = T::TimeProvider::now().as_secs();
                });
            }

            // 发送事件
            Self::deposit_event(Event::QuantumResistanceStatusUpdated {
                enabled,
                current_version: Self::quantum_resistance_status().current_key_version,
                updated_at: T::TimeProvider::now().as_secs(),
            });

            Ok(())
        }

        /// ========== 插件生态系统外部调用 ==========

        /// 注册插件
        ///
        /// # 参数
        /// - `origin`: 插件作者或Root
        /// - `plugin_id`: 插件ID
        /// - `plugin_info`: 插件信息
        #[pallet::call_index(14)]
        #[pallet::weight(100_000)]
        pub fn register_plugin(
            origin: OriginFor<T>,
            plugin_id: PluginId,
            plugin_info: PluginInfo,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            // 检查插件系统是否启用
            ensure!(
                Self::global_plugin_settings().plugins_enabled,
                Error::<T>::PluginSystemDisabled
            );

            // 检查插件是否已存在
            ensure!(
                !RegisteredPlugins::<T>::contains_key(&plugin_id),
                Error::<T>::PluginAlreadyExists
            );

            // 验证插件信息
            Self::validate_plugin_registration(&plugin_info)?;

            // 创建插件沙盒
            let sandbox = Self::create_plugin_sandbox(&plugin_id, &plugin_info)?;

            // 存储插件信息
            RegisteredPlugins::<T>::insert(&plugin_id, &plugin_info);
            PluginStates::<T>::insert(&plugin_id, PluginState::Disabled);
            PluginSandboxes::<T>::insert(&plugin_id, &sandbox);

            // 注册插件钩子
            for hook_type in &plugin_info.supported_hooks {
                PluginHooks::<T>::insert(hook_type, &plugin_id, true);
            }

            // 发送事件
            Self::deposit_event(Event::PluginRegistered {
                plugin_id,
                name: plugin_info.name,
                author: plugin_info.author,
            });

            Ok(())
        }

        /// 设置插件状态
        ///
        /// # 参数
        /// - `origin`: Root或插件作者
        /// - `plugin_id`: 插件ID
        /// - `state`: 新状态
        #[pallet::call_index(15)]
        #[pallet::weight(20_000)]
        pub fn set_plugin_state(
            origin: OriginFor<T>,
            plugin_id: PluginId,
            state: PluginState,
        ) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            // 检查插件是否存在
            ensure!(
                RegisteredPlugins::<T>::contains_key(&plugin_id),
                Error::<T>::PluginNotFound
            );

            let old_state = Self::plugin_states(&plugin_id);

            // 更新插件状态
            PluginStates::<T>::insert(&plugin_id, &state);

            // 发送事件
            Self::deposit_event(Event::PluginStateChanged {
                plugin_id,
                old_state,
                new_state: state,
            });

            Ok(())
        }

        /// 更新全局插件设置
        ///
        /// # 参数
        /// - `origin`: Root权限
        /// - `settings`: 新的全局设置
        #[pallet::call_index(16)]
        #[pallet::weight(25_000)]
        pub fn update_global_plugin_settings(
            origin: OriginFor<T>,
            settings: GlobalPluginConfig,
        ) -> DispatchResult {
            ensure_root(origin.clone())?;
            let who = ensure_signed(origin)?;

            // 更新全局设置
            GlobalPluginSettings::<T>::put(&settings);

            // 发送事件
            Self::deposit_event(Event::GlobalPluginSettingsUpdated {
                updated_by: who,
            });

            Ok(())
        }
    }
}

// 实现 helper 方法
impl<T: Config> Pallet<T> {
    /// 检查群组创建冷却期
    fn check_group_creation_cooldown(who: &T::AccountId) -> DispatchResult {
        if let Some(last_creation) = Self::group_creation_cooldowns(who) {
            let current_block = frame_system::Pallet::<T>::block_number();
            let cooldown_period = T::GroupCreationCooldown::get();

            ensure!(
                current_block >= last_creation + cooldown_period,
                Error::<T>::GroupCreationCooldown
            );
        }
        Ok(())
    }

    /// 生成群组ID
    fn generate_group_id() -> Result<GroupId, Error<T>> {
        let current_id = Self::next_group_id();
        NextGroupId::<T>::put(current_id + 1);
        Ok(current_id)
    }

    /// 生成消息ID
    fn generate_message_id() -> Result<MessageId, Error<T>> {
        let current_id = Self::next_message_id();
        NextMessageId::<T>::put(current_id + 1);
        Ok(current_id)
    }

    /// 生成加密配置
    fn generate_encryption_config(
        mode: EncryptionMode,
        creator: &T::AccountId,
    ) -> Result<EncryptionConfig<T>, Error<T>> {
        // 根据不同的加密模式生成不同的密钥配置
        match mode {
            EncryptionMode::Military => {
                // 军用级：量子抗性 + 多层加密
                let master_key = Self::generate_quantum_resistant_key()?;
                let admin_key_share = Self::derive_admin_key_share(&master_key, creator)?;

                Ok(EncryptionConfig {
                    mode,
                    master_key,
                    admin_key_share,
                    key_rotation_interval: 86400, // 每天轮换
                    quantum_resistant: true,
                    perfect_forward_secrecy: true,
                    additional_layers: 3,
                    created_at: T::TimeProvider::now().as_secs(),
                })
            },
            EncryptionMode::Business => {
                // 商用级：标准端到端加密
                let master_key = Self::generate_standard_key()?;
                let admin_key_share = Self::derive_admin_key_share(&master_key, creator)?;

                Ok(EncryptionConfig {
                    mode,
                    master_key,
                    admin_key_share,
                    key_rotation_interval: 604800, // 每周轮换
                    quantum_resistant: false,
                    perfect_forward_secrecy: true,
                    additional_layers: 1,
                    created_at: T::TimeProvider::now().as_secs(),
                })
            },
            EncryptionMode::Selective => {
                // 选择性：基础加密，用户可选
                let master_key = Self::generate_basic_key()?;
                let admin_key_share = Self::derive_admin_key_share(&master_key, creator)?;

                Ok(EncryptionConfig {
                    mode,
                    master_key,
                    admin_key_share,
                    key_rotation_interval: 2592000, // 每月轮换
                    quantum_resistant: false,
                    perfect_forward_secrecy: false,
                    additional_layers: 0,
                    created_at: T::TimeProvider::now().as_secs(),
                })
            },
            EncryptionMode::Transparent => {
                // 透明模式：无加密，公开存储
                Ok(EncryptionConfig {
                    mode,
                    master_key: BoundedVec::default(),
                    admin_key_share: BoundedVec::default(),
                    key_rotation_interval: 0, // 无需轮换
                    quantum_resistant: false,
                    perfect_forward_secrecy: false,
                    additional_layers: 0,
                    created_at: T::TimeProvider::now().as_secs(),
                })
            },
        }
    }

    /// 生成量子抗性密钥
    fn generate_quantum_resistant_key() -> Result<BoundedVec<u8, T::MaxKeyLen>, Error<T>> {
        // 使用系统随机数生成器生成256位密钥
        let (random_seed, _) = T::Randomness::random(&b"quantum_key"[..]);
        let key_bytes = random_seed.as_ref();

        // 确保密钥长度符合要求
        if key_bytes.len() >= 32 {
            key_bytes[0..32].to_vec().try_into()
                .map_err(|_| Error::<T>::KeyGenerationFailed)
        } else {
            Err(Error::<T>::KeyGenerationFailed)
        }
    }

    /// 生成标准密钥
    fn generate_standard_key() -> Result<BoundedVec<u8, T::MaxKeyLen>, Error<T>> {
        let (random_seed, _) = T::Randomness::random(&b"standard_key"[..]);
        let key_bytes = random_seed.as_ref();

        if key_bytes.len() >= 32 {
            key_bytes[0..32].to_vec().try_into()
                .map_err(|_| Error::<T>::KeyGenerationFailed)
        } else {
            Err(Error::<T>::KeyGenerationFailed)
        }
    }

    /// 生成基础密钥
    fn generate_basic_key() -> Result<BoundedVec<u8, T::MaxKeyLen>, Error<T>> {
        let (random_seed, _) = T::Randomness::random(&b"basic_key"[..]);
        let key_bytes = random_seed.as_ref();

        if key_bytes.len() >= 16 {
            key_bytes[0..16].to_vec().try_into()
                .map_err(|_| Error::<T>::KeyGenerationFailed)
        } else {
            Err(Error::<T>::KeyGenerationFailed)
        }
    }

    /// 派生管理员密钥份额
    fn derive_admin_key_share(
        master_key: &BoundedVec<u8, T::MaxKeyLen>,
        admin: &T::AccountId,
    ) -> Result<BoundedVec<u8, T::MaxKeyLen>, Error<T>> {
        // 使用HKDF派生管理员密钥份额
        let admin_bytes = admin.encode();
        let (derived_seed, _) = T::Randomness::random(&admin_bytes);

        let mut key_share = master_key.clone();
        let derived_bytes = derived_seed.as_ref();

        // 简单的XOR操作用于演示（生产环境应使用HKDF）
        for (i, &byte) in derived_bytes.iter().enumerate() {
            if i < key_share.len() {
                key_share[i] ^= byte;
            }
        }

        Ok(key_share)
    }

    /// 为新成员生成密钥份额
    fn generate_member_key_share(
        config: &EncryptionConfig<T>,
        member: &T::AccountId,
    ) -> Result<BoundedVec<u8, T::MaxKeyLen>, Error<T>> {
        if config.mode == EncryptionMode::Transparent {
            return Ok(BoundedVec::default());
        }

        // 基于主密钥和成员ID派生成员密钥份额
        let member_bytes = member.encode();
        let (derived_seed, _) = T::Randomness::random(&member_bytes);

        let mut key_share = config.master_key.clone();
        let derived_bytes = derived_seed.as_ref();

        // 简单的XOR操作用于演示
        for (i, &byte) in derived_bytes.iter().enumerate() {
            if i < key_share.len() {
                key_share[i] ^= byte;
            }
        }

        Ok(key_share)
    }

    /// AI智能决策：选择加密模式
    fn ai_decide_encryption_mode(
        content: &BoundedVec<u8, T::MaxMessageLen>,
        group_info: &GroupInfo<T>,
        member_info: &GroupMemberInfo<T>,
        group_id: GroupId,
    ) -> Result<EncryptionMode, Error<T>> {
        // 内容敏感性分析
        let sensitivity_score = Self::analyze_content_sensitivity(content)?;

        // 群组历史行为分析
        let group_behavior = Self::analyze_group_behavior(group_id)?;

        // 用户偏好分析
        let user_preference = Self::analyze_user_preference(&member_info.account_id)?;

        // AI决策逻辑
        let decision_score = (sensitivity_score * 0.5) +
                           (group_behavior.security_preference * 0.3) +
                           (user_preference.security_preference * 0.2);

        let recommended_mode = match decision_score {
            score if score >= 0.8 => EncryptionMode::Military,
            score if score >= 0.6 => EncryptionMode::Business,
            score if score >= 0.3 => EncryptionMode::Selective,
            _ => EncryptionMode::Transparent,
        };

        // 缓存AI决策结果
        let content_hash = sp_io::hashing::blake2_256(content);
        let context_hash = sp_io::hashing::blake2_256(&group_id.encode());

        let ai_result = AIDecisionResult {
            recommended_mode,
            confidence: decision_score,
            reasoning: BoundedVec::try_from(b"Content sensitivity analysis".to_vec())
                .unwrap_or_default(),
            alternative_options: vec![
                EncryptionMode::Business,
                EncryptionMode::Selective,
            ].try_into().unwrap_or_default(),
        };

        AIDecisionCache::<T>::insert(content_hash, context_hash, ai_result);

        // 发送AI决策事件
        Self::deposit_event(Event::AIDecisionTriggered {
            group_id,
            decision_type: AIDecisionType::EncryptionMode,
            result: AIDecisionResult {
                recommended_mode,
                confidence: decision_score,
                reasoning: BoundedVec::try_from(b"AI encryption mode selection".to_vec())
                    .unwrap_or_default(),
                alternative_options: BoundedVec::default(),
            },
        });

        Ok(recommended_mode)
    }

    /// 分析内容敏感性（简化实现）
    fn analyze_content_sensitivity(
        content: &BoundedVec<u8, T::MaxMessageLen>
    ) -> Result<f32, Error<T>> {
        let content_str = sp_std::str::from_utf8(content)
            .unwrap_or("");

        let mut sensitivity_score = 0.0f32;

        // 关键词检测
        let sensitive_keywords = [
            "password", "secret", "private", "confidential",
            "bank", "card", "money", "payment", "财务", "密码",
            "机密", "私人", "保密", "银行", "卡号", "支付"
        ];

        for keyword in &sensitive_keywords {
            if content_str.to_lowercase().contains(keyword) {
                sensitivity_score += 0.2;
            }
        }

        // 长度因子（长消息可能包含更多敏感信息）
        if content.len() > 500 {
            sensitivity_score += 0.1;
        }

        // 特殊字符检测（可能是编码的敏感数据）
        let special_char_ratio = content.iter()
            .filter(|&&b| !b.is_ascii_alphanumeric() && b != b' ')
            .count() as f32 / content.len() as f32;

        if special_char_ratio > 0.3 {
            sensitivity_score += 0.2;
        }

        // 限制在0.0-1.0范围内
        Ok(sensitivity_score.min(1.0))
    }

    /// 分析群组行为模式（简化实现）
    fn analyze_group_behavior(group_id: GroupId) -> Result<GroupBehaviorAnalysis, Error<T>> {
        // 获取群组历史消息分析
        let total_messages = GroupMessages::<T>::iter_prefix(group_id).count() as u32;

        // 默认行为分析
        Ok(GroupBehaviorAnalysis {
            security_preference: if total_messages > 100 { 0.7 } else { 0.5 },
            activity_level: if total_messages > 50 { ActivityLevel::High } else { ActivityLevel::Low },
            encryption_usage_ratio: 0.6, // 默认60%的消息使用加密
        })
    }

    /// 分析用户偏好（简化实现）
    fn analyze_user_preference(user: &T::AccountId) -> Result<UserPreferenceAnalysis, Error<T>> {
        // 获取用户历史行为数据
        if let Some(behavior_data) = Self::user_behavior_analysis(user) {
            Ok(UserPreferenceAnalysis {
                security_preference: behavior_data.security_preference,
                preferred_encryption_mode: behavior_data.preferred_encryption_mode,
                response_time_preference: behavior_data.response_time_preference,
            })
        } else {
            // 默认偏好
            Ok(UserPreferenceAnalysis {
                security_preference: 0.5,
                preferred_encryption_mode: EncryptionMode::Business,
                response_time_preference: ResponseTimePreference::Balanced,
            })
        }
    }

    /// 处理消息内容
    fn process_message_content(
        content: &BoundedVec<u8, T::MaxMessageLen>,
        encryption_mode: EncryptionMode,
        group_info: &GroupInfo<T>,
        message_type: MessageType,
    ) -> Result<(BoundedVec<u8, T::MaxMessageLen>, StorageStrategy<T>), Error<T>> {
        let processed_content = match encryption_mode {
            EncryptionMode::Transparent => {
                // 透明模式：直接存储原始内容
                content.clone()
            },
            _ => {
                // 其他模式：需要加密处理
                Self::encrypt_content(content, encryption_mode)?
            }
        };

        // 确定存储策略
        let storage_strategy = Self::determine_storage_strategy(
            &processed_content,
            encryption_mode,
            message_type,
            group_info.current_member_count,
        )?;

        Ok((processed_content, storage_strategy))
    }

    /// 加密消息内容
    fn encrypt_content(
        content: &BoundedVec<u8, T::MaxMessageLen>,
        encryption_mode: EncryptionMode,
    ) -> Result<BoundedVec<u8, T::MaxMessageLen>, Error<T>> {
        // 简化的加密实现（生产环境需要使用真正的加密算法）
        match encryption_mode {
            EncryptionMode::Military => {
                // 军用级加密：多层加密
                Self::military_grade_encrypt(content)
            },
            EncryptionMode::Business => {
                // 商用级加密：标准AES
                Self::business_grade_encrypt(content)
            },
            EncryptionMode::Selective => {
                // 选择性加密：基础加密
                Self::basic_encrypt(content)
            },
            EncryptionMode::Transparent => {
                // 透明模式：不加密
                Ok(content.clone())
            },
        }
    }

    /// 军用级加密（简化实现）
    fn military_grade_encrypt(
        content: &BoundedVec<u8, T::MaxMessageLen>,
    ) -> Result<BoundedVec<u8, T::MaxMessageLen>, Error<T>> {
        // 实际应该使用量子抗性算法，这里只是演示
        let mut encrypted = content.clone();

        // 第一层：XOR加密
        for byte in encrypted.iter_mut() {
            *byte ^= 0xAA;
        }

        // 第二层：字节移位
        for i in 0..encrypted.len() {
            encrypted[i] = encrypted[i].wrapping_add((i % 256) as u8);
        }

        // 第三层：反向
        encrypted.reverse();

        Ok(encrypted)
    }

    /// 商用级加密（简化实现）
    fn business_grade_encrypt(
        content: &BoundedVec<u8, T::MaxMessageLen>,
    ) -> Result<BoundedVec<u8, T::MaxMessageLen>, Error<T>> {
        let mut encrypted = content.clone();

        // 简单XOR加密
        for byte in encrypted.iter_mut() {
            *byte ^= 0x55;
        }

        Ok(encrypted)
    }

    /// 基础加密（简化实现）
    fn basic_encrypt(
        content: &BoundedVec<u8, T::MaxMessageLen>,
    ) -> Result<BoundedVec<u8, T::MaxMessageLen>, Error<T>> {
        let mut encrypted = content.clone();

        // 最简单的XOR
        for byte in encrypted.iter_mut() {
            *byte ^= 0x33;
        }

        Ok(encrypted)
    }

    /// 确定存储策略
    fn determine_storage_strategy(
        content: &BoundedVec<u8, T::MaxMessageLen>,
        encryption_mode: EncryptionMode,
        message_type: MessageType,
        group_size: u32,
    ) -> Result<StorageStrategy<T>, Error<T>> {
        let content_size = content.len();

        let storage_tier = match (content_size, encryption_mode, message_type) {
            // 小消息 + 透明模式 -> 链上存储
            (size, EncryptionMode::Transparent, _) if size <= 256 => StorageTier::OnChain,

            // 大文件 -> IPFS存储
            (size, _, MessageType::File) if size > 1024 => StorageTier::IPFS,

            // 媒体文件 -> IPFS存储
            (_, _, MessageType::Image | MessageType::Video | MessageType::Audio) => StorageTier::IPFS,

            // 中等大小加密消息 -> 混合存储
            (size, EncryptionMode::Business | EncryptionMode::Military, _) if size > 256 => StorageTier::Hybrid,

            // 默认：链上存储
            _ => StorageTier::OnChain,
        };

        Ok(StorageStrategy {
            primary_tier: storage_tier,
            backup_tier: Self::determine_backup_tier(storage_tier),
            replication_factor: Self::calculate_replication_factor(encryption_mode, group_size),
            ttl_seconds: Self::calculate_ttl(message_type, encryption_mode),
            compression_enabled: content_size > 512,
            auto_migration_enabled: true,
        })
    }

    /// 确定备份存储层
    fn determine_backup_tier(primary_tier: StorageTier) -> Option<StorageTier> {
        match primary_tier {
            StorageTier::OnChain => Some(StorageTier::IPFS),
            StorageTier::IPFS => Some(StorageTier::Hybrid),
            StorageTier::Hybrid => None,
            StorageTier::Temporary => None,
        }
    }

    /// 计算复制因子
    fn calculate_replication_factor(encryption_mode: EncryptionMode, group_size: u32) -> u32 {
        match encryption_mode {
            EncryptionMode::Military => 5, // 军用级：5份复制
            EncryptionMode::Business => 3, // 商用级：3份复制
            EncryptionMode::Selective => 2, // 选择性：2份复制
            EncryptionMode::Transparent => {
                if group_size > 100 { 3 } else { 2 } // 根据群组大小决定
            },
        }
    }

    /// 计算生存时间
    fn calculate_ttl(message_type: MessageType, encryption_mode: EncryptionMode) -> Option<u64> {
        match message_type {
            MessageType::Temporary => Some(3600), // 临时消息：1小时
            MessageType::Ephemeral => Some(86400), // 阅后即焚：1天
            _ => match encryption_mode {
                EncryptionMode::Military => Some(31536000), // 军用级：1年
                EncryptionMode::Business => Some(15768000), // 商用级：6个月
                _ => None, // 永久保存
            }
        }
    }

    /// 执行存储策略
    fn execute_storage_strategy(
        message_meta: &GroupMessageMeta<T>,
        strategy: &StorageStrategy<T>,
    ) -> DispatchResult {
        match strategy.primary_tier {
            StorageTier::OnChain => {
                // 链上存储：直接保存在链上存储中
                Self::store_on_chain(message_meta)?;
            },
            StorageTier::IPFS => {
                // IPFS存储：上传到IPFS网络
                Self::store_on_ipfs(message_meta)?;
            },
            StorageTier::Hybrid => {
                // 混合存储：元数据链上，内容IPFS
                Self::store_hybrid(message_meta)?;
            },
            StorageTier::Temporary => {
                // 临时存储：仅保存在内存缓存
                Self::store_temporary(message_meta)?;
            },
        }

        // 如果有备份层，也执行备份存储
        if let Some(backup_tier) = &strategy.backup_tier {
            Self::execute_backup_storage(message_meta, *backup_tier)?;
        }

        Ok(())
    }

    /// 链上存储实现
    fn store_on_chain(message_meta: &GroupMessageMeta<T>) -> DispatchResult {
        // 消息已经通过 GroupMessages 存储映射保存在链上
        // 这里可以添加额外的处理逻辑，如压缩等
        Ok(())
    }

    /// IPFS存储实现
    fn store_on_ipfs(message_meta: &GroupMessageMeta<T>) -> DispatchResult {
        // 调用 pallet-stardust-ipfs 进行IPFS存储
        // 这里需要与IPFS pallet集成
        // TODO: 实现IPFS存储逻辑
        Ok(())
    }

    /// 混合存储实现
    fn store_hybrid(message_meta: &GroupMessageMeta<T>) -> DispatchResult {
        // 元数据保存在链上，内容保存在IPFS
        // TODO: 实现混合存储逻辑
        Ok(())
    }

    /// 临时存储实现
    fn store_temporary(message_meta: &GroupMessageMeta<T>) -> DispatchResult {
        // 临时消息只在内存中保存，不持久化
        // TODO: 实现临时存储逻辑
        Ok(())
    }

    /// 执行备份存储
    fn execute_backup_storage(
        message_meta: &GroupMessageMeta<T>,
        backup_tier: StorageTier,
    ) -> DispatchResult {
        match backup_tier {
            StorageTier::OnChain => Self::store_on_chain(message_meta),
            StorageTier::IPFS => Self::store_on_ipfs(message_meta),
            StorageTier::Hybrid => Self::store_hybrid(message_meta),
            StorageTier::Temporary => Self::store_temporary(message_meta),
        }
    }

    /// 更新存储统计
    fn update_storage_stats(
        group_id: GroupId,
        strategy: &StorageStrategy<T>,
    ) -> DispatchResult {
        GroupStorageStats::<T>::try_mutate(group_id, |stats| {
            stats.total_messages += 1;

            match strategy.primary_tier {
                StorageTier::OnChain => stats.on_chain_storage += 1,
                StorageTier::IPFS => stats.ipfs_storage += 1,
                StorageTier::Hybrid => {
                    stats.on_chain_storage += 1;
                    stats.ipfs_storage += 1;
                },
                StorageTier::Temporary => stats.temporary_storage += 1,
            }

            Ok::<(), DispatchError>(())
        })?;

        Ok(())
    }

    /// 检查消息发送频率限制
    fn check_message_rate_limit(who: &T::AccountId) -> DispatchResult {
        let current_time = T::TimeProvider::now().as_secs();
        let time_window = current_time / 60; // 每分钟为一个时间窗口

        let current_count = Self::message_rate_limits(who, time_window);
        ensure!(
            current_count < T::MessageRateLimit::get(),
            Error::<T>::MessageRateExceeded
        );

        Ok(())
    }

    /// 更新消息发送频率计数
    fn update_message_rate_count(who: &T::AccountId) -> DispatchResult {
        let current_time = T::TimeProvider::now().as_secs();
        let time_window = current_time / 60;

        MessageRateLimits::<T>::mutate(who, time_window, |count| {
            *count = count.saturating_add(1);
        });

        Ok(())
    }

    /// 估算确认时间
    fn estimate_confirmation_time(
        encryption_mode: EncryptionMode,
        storage_strategy: &StorageStrategy<T>,
    ) -> u64 {
        let base_time = match encryption_mode {
            EncryptionMode::Military => 3000, // 军用级加密需要更多时间
            EncryptionMode::Business => 1500,
            EncryptionMode::Selective => 1000,
            EncryptionMode::Transparent => 500,
        };

        let storage_time = match storage_strategy.primary_tier {
            StorageTier::OnChain => 1000,
            StorageTier::IPFS => 3000,
            StorageTier::Hybrid => 2000,
            StorageTier::Temporary => 100,
        };

        base_time + storage_time
    }

    /// 解散群组内部实现
    fn disband_group_internal(group_id: GroupId) -> DispatchResult {
        // 获取所有群组成员
        let members: Vec<T::AccountId> = GroupMembers::<T>::iter_prefix(group_id)
            .map(|(member_id, _)| member_id)
            .collect();

        // 从所有成员的群组列表中移除该群组
        for member in members {
            UserGroups::<T>::try_mutate(&member, |groups| {
                groups.retain(|&g| g != group_id);
                Ok::<(), DispatchError>(())
            })?;
        }

        // 清理存储
        Groups::<T>::remove(group_id);
        GroupEncryptionConfigs::<T>::remove(group_id);
        GroupStorageStats::<T>::remove(group_id);

        // 清理所有群组成员
        let _ = GroupMembers::<T>::remove_prefix(group_id, None);

        // 清理所有群组消息
        let _ = GroupMessages::<T>::remove_prefix(group_id, None);

        Ok(())
    }

    /// 执行智能存储迁移
    fn execute_intelligent_storage_migration(group_id: GroupId) -> DispatchResult {
        let current_time = T::TimeProvider::now().as_secs();

        // 分析访问模式，决定是否需要迁移存储层级
        GroupMessages::<T>::iter_prefix(group_id).for_each(|(message_id, mut message_meta)| {
            let age_seconds = current_time.saturating_sub(message_meta.sent_at);
            let access_frequency = if age_seconds > 0 {
                message_meta.access_count as f64 / age_seconds as f64
            } else {
                0.0
            };

            let new_tier = match (message_meta.storage_tier, age_seconds, access_frequency) {
                // 热数据迁移到冷存储
                (StorageTier::OnChain, age, freq) if age > 2592000 && freq < 0.001 => {
                    Some(StorageTier::IPFS)
                },
                // 冷数据迁移到临时存储
                (StorageTier::IPFS, age, freq) if age > 7776000 && freq < 0.0001 => {
                    Some(StorageTier::Temporary)
                },
                _ => None,
            };

            if let Some(new_tier) = new_tier {
                let old_tier = message_meta.storage_tier;
                message_meta.storage_tier = new_tier;

                // 更新消息元数据
                GroupMessages::<T>::insert(group_id, message_id, &message_meta);

                // 发送迁移事件
                Self::deposit_event(Event::StorageTierMigrated {
                    group_id,
                    message_id,
                    from_tier: old_tier,
                    to_tier: new_tier,
                });
            }
        });

        Ok(())
    }

    /// ========== 量子安全相关辅助方法 ==========

    /// 生成量子密钥对
    fn generate_quantum_keypair() -> Result<QuantumKeyPair, Error<T>> {
        // 使用量子抗性密码学模块生成密钥
        let quantum_crypto = crate::quantum_resistant::QuantumResistantCrypto::<T>::new();

        // 生成Kyber密钥对（用于密钥封装）
        let kyber_keypair = quantum_crypto.kyber_keygen()
            .map_err(|_| Error::<T>::QuantumKeyPairGenerationFailed)?;

        // 生成Dilithium密钥对（用于数字签名）
        let dilithium_keypair = quantum_crypto.dilithium_keygen()
            .map_err(|_| Error::<T>::QuantumKeyPairGenerationFailed)?;

        Ok(QuantumKeyPair {
            kyber_keypair: crate::types::KyberKeyPair {
                secret_key: kyber_keypair.secret_key,
                public_key: kyber_keypair.public_key,
            },
            dilithium_keypair: crate::types::DilithiumKeyPair {
                secret_key: dilithium_keypair.secret_key,
                public_key: dilithium_keypair.public_key,
            },
            created_at: T::TimeProvider::now().as_secs(),
            version: Self::get_next_key_version(0), // 传入0作为默认群组
        })
    }

    /// 获取下一个密钥版本号
    fn get_next_key_version(group_id: GroupId) -> u32 {
        if let Some(current_keypair) = Self::quantum_keys(group_id) {
            current_keypair.version.saturating_add(1)
        } else {
            1
        }
    }

    /// 获取当前密钥版本号
    fn get_current_key_version(group_id: GroupId) -> u32 {
        Self::quantum_keys(group_id)
            .map(|keypair| keypair.version)
            .unwrap_or(0)
    }

    /// 检查密钥轮换间隔
    fn check_key_rotation_interval(group_id: GroupId) -> DispatchResult {
        let config = Self::quantum_configs(group_id);

        if let Some(keypair) = Self::quantum_keys(group_id) {
            let current_time = T::TimeProvider::now().as_secs();
            let time_since_creation = current_time.saturating_sub(keypair.created_at);
            let rotation_interval = config.key_rotation_interval as u64 * 1000; // 转换为秒

            ensure!(
                time_since_creation >= rotation_interval,
                Error::<T>::KeyRotationIntervalNotReached
            );
        }

        Ok(())
    }

    /// 计算密钥指纹
    fn calculate_key_fingerprint(
        quantum_keypair: &Option<QuantumKeyPair>
    ) -> Result<[u8; 32], Error<T>> {
        if let Some(keypair) = quantum_keypair {
            // 计算公钥的哈希作为指纹
            let combined_public_keys = [
                keypair.kyber_keypair.public_key.as_ref(),
                keypair.dilithium_keypair.public_key.as_ref()
            ].concat();

            let hash = T::Hashing::hash(&combined_public_keys);
            let mut fingerprint = [0u8; 32];
            fingerprint.copy_from_slice(hash.as_ref());
            Ok(fingerprint)
        } else {
            Ok([0u8; 32]) // 空密钥的指纹
        }
    }

    /// 验证量子加密配置
    fn validate_quantum_config(config: &QuantumEncryptionConfig) -> DispatchResult {
        // 验证密钥轮换间隔（至少1000个块）
        ensure!(
            config.key_rotation_interval >= 1000,
            Error::<T>::InvalidQuantumConfig
        );

        // 验证熵源数量（至少2个）
        ensure!(
            config.quantum_rng_config.entropy_sources >= 2,
            Error::<T>::InvalidQuantumConfig
        );

        // 验证回退阈值（20-90之间）
        ensure!(
            config.quantum_rng_config.fallback_threshold >= 20 &&
            config.quantum_rng_config.fallback_threshold <= 90,
            Error::<T>::InvalidQuantumConfig
        );

        Ok(())
    }

    /// 处理严重安全事件
    fn handle_critical_security_event(
        group_id: Option<GroupId>,
        security_event: &QuantumSecurityEvent<T>,
    ) -> DispatchResult {
        match security_event.event_type {
            QuantumSecurityEventType::QuantumAttackDetected => {
                // 量子攻击检测 - 立即轮换所有相关密钥
                if let Some(gid) = group_id {
                    Self::emergency_key_rotation(gid)?;
                }
            },
            QuantumSecurityEventType::KeyLeakageDetected => {
                // 密钥泄露 - 立即轮换密钥并启用紧急状态
                if let Some(gid) = group_id {
                    Self::emergency_key_rotation(gid)?;
                    Self::activate_group_emergency_state(gid, EmergencyReason::SecurityThreat)?;
                }
            },
            QuantumSecurityEventType::SideChannelAttackDetected => {
                // 侧信道攻击 - 增强防护等级
                if let Some(gid) = group_id {
                    Self::enhance_side_channel_protection(gid)?;
                }
            },
            QuantumSecurityEventType::IntegrityViolation => {
                // 数据完整性违反 - 立即停止相关群组活动
                if let Some(gid) = group_id {
                    Self::activate_group_emergency_state(gid, EmergencyReason::DataLeakRisk)?;
                }
            },
            _ => {
                // 其他事件的默认处理
            }
        }

        Ok(())
    }

    /// 紧急密钥轮换
    fn emergency_key_rotation(group_id: GroupId) -> DispatchResult {
        // 生成新的量子密钥对
        let new_quantum_keypair = Self::generate_quantum_keypair()?;

        // 创建紧急轮换记录
        let rotation_record = KeyRotationRecord {
            rotation_time: T::TimeProvider::now().as_secs(),
            old_key_fingerprint: Self::calculate_key_fingerprint(&Self::quantum_keys(group_id))?,
            new_key_fingerprint: Self::calculate_key_fingerprint(&Some(new_quantum_keypair.clone()))?,
            reason: KeyRotationReason::SecurityEvent,
            rotated_by: Self::account_id(), // 系统自动轮换
        };

        // 更新密钥轮换历史
        KeyRotationHistory::<T>::try_mutate(group_id, |history| {
            history.try_push(rotation_record).map_err(|_| Error::<T>::QuantumKeyRotationFailed)
        })?;

        // 存储新密钥对
        QuantumKeys::<T>::insert(group_id, &new_quantum_keypair);

        Ok(())
    }

    /// 激活群组紧急状态（内部方法）
    fn activate_group_emergency_state(
        group_id: GroupId,
        reason: EmergencyReason,
    ) -> DispatchResult {
        Groups::<T>::try_mutate(group_id, |group_opt| {
            if let Some(group) = group_opt {
                group.emergency_state = Some(EmergencyState {
                    reason: reason.clone(),
                    activated_at: T::TimeProvider::now().as_secs(),
                    activated_by: Self::account_id(), // 系统自动激活
                });
            }
            Ok::<(), DispatchError>(())
        })?;

        Ok(())
    }

    /// 增强侧信道攻击防护
    fn enhance_side_channel_protection(group_id: GroupId) -> DispatchResult {
        QuantumConfigs::<T>::mutate(group_id, |config| {
            // 提升防护等级
            config.side_channel_protection = match config.side_channel_protection {
                SideChannelProtectionLevel::Low => SideChannelProtectionLevel::Medium,
                SideChannelProtectionLevel::Medium => SideChannelProtectionLevel::High,
                SideChannelProtectionLevel::High => SideChannelProtectionLevel::Military,
                SideChannelProtectionLevel::Military => SideChannelProtectionLevel::Military,
            };

            // 减少密钥轮换间隔（增强安全性）
            config.key_rotation_interval = (config.key_rotation_interval / 2).max(500);
        });

        Ok(())
    }

    /// 量子随机数质量检查
    fn check_quantum_randomness_quality(data: &[u8]) -> bool {
        // 简化的随机性质量检查
        let mut ones_count = 0;
        let mut zeros_count = 0;

        for &byte in data {
            for bit_pos in 0..8 {
                if (byte >> bit_pos) & 1 == 1 {
                    ones_count += 1;
                } else {
                    zeros_count += 1;
                }
            }
        }

        // 检查0和1的比例是否合理（45%-55%之间）
        let total_bits = ones_count + zeros_count;
        if total_bits == 0 {
            return false;
        }

        let ones_ratio = ones_count as f64 / total_bits as f64;
        ones_ratio >= 0.45 && ones_ratio <= 0.55
    }

    /// 执行量子安全消息加密
    fn quantum_encrypt_message(
        content: &[u8],
        group_id: GroupId,
    ) -> Result<Vec<u8>, Error<T>> {
        if let Some(quantum_keypair) = Self::quantum_keys(group_id) {
            let quantum_crypto = crate::quantum_resistant::QuantumResistantCrypto::<T>::new();

            // 创建量子数字信封
            quantum_crypto.create_quantum_envelope(
                content,
                &quantum_keypair.kyber_keypair.public_key,
                &quantum_keypair.dilithium_keypair.secret_key,
            ).map(|envelope| envelope.encode())
            .map_err(|_| Error::<T>::EncryptionFailed)
        } else {
            Err(Error::<T>::QuantumKeyPairGenerationFailed)
        }
    }

    /// 执行量子安全消息解密
    fn quantum_decrypt_message(
        ciphertext: &[u8],
        group_id: GroupId,
    ) -> Result<Vec<u8>, Error<T>> {
        if let Some(quantum_keypair) = Self::quantum_keys(group_id) {
            let quantum_crypto = crate::quantum_resistant::QuantumResistantCrypto::<T>::new();

            // 解码量子数字信封
            let envelope: crate::quantum_resistant::QuantumEnvelope = Decode::decode(&mut &ciphertext[..])
                .map_err(|_| Error::<T>::DecryptionFailed)?;

            // 验证并解密
            quantum_crypto.verify_quantum_envelope(
                &envelope,
                &quantum_keypair.kyber_keypair.secret_key,
            ).map_err(|_| Error::<T>::QuantumSignatureVerificationFailed)
        } else {
            Err(Error::<T>::QuantumKeyPairGenerationFailed)
        }
    }

    /// ========== 插件生态系统辅助方法 ==========

    /// 验证插件注册信息
    fn validate_plugin_registration(plugin_info: &PluginInfo) -> DispatchResult {
        // 检查插件名称
        ensure!(
            plugin_info.name.len() > 0 && plugin_info.name.len() <= 64,
            Error::<T>::InvalidPluginName
        );

        // 检查插件作者
        ensure!(
            plugin_info.author.len() > 0 && plugin_info.author.len() <= 128,
            Error::<T>::InvalidPluginAuthor
        );

        // 检查插件版本
        ensure!(
            plugin_info.version.len() > 0 && plugin_info.version.len() <= 16,
            Error::<T>::InvalidPluginVersion
        );

        // 检查插件描述
        ensure!(
            plugin_info.description.len() <= 512,
            Error::<T>::PluginDescriptionTooLong
        );

        // 验证支持的钩子数量
        ensure!(
            plugin_info.supported_hooks.len() <= 32,
            Error::<T>::TooManyPlugins
        );

        Ok(())
    }

    /// 创建插件沙盒
    fn create_plugin_sandbox(
        plugin_id: &PluginId,
        plugin_info: &PluginInfo,
    ) -> Result<PluginSandbox, Error<T>> {
        let global_settings = Self::global_plugin_settings();

        // 根据信任等级计算资源限制
        let memory_limit = match plugin_info.trust_level {
            PluginTrustLevel::System => global_settings.max_plugin_memory,
            PluginTrustLevel::Verified => global_settings.max_plugin_memory / 2,
            PluginTrustLevel::Community => global_settings.max_plugin_memory / 4,
            PluginTrustLevel::Untrusted => global_settings.max_plugin_memory / 10,
        };

        let execution_timeout = match plugin_info.trust_level {
            PluginTrustLevel::System => global_settings.max_execution_time as u64,
            PluginTrustLevel::Verified => (global_settings.max_execution_time / 2) as u64,
            PluginTrustLevel::Community => (global_settings.max_execution_time / 5) as u64,
            PluginTrustLevel::Untrusted => (global_settings.max_execution_time / 10) as u64,
        };

        Ok(PluginSandbox {
            plugin_id: plugin_id.clone(),
            memory_limit,
            execution_timeout,
            network_access: plugin_info.permissions.can_network_access,
            file_access: plugin_info.permissions.can_file_access,
            allowed_apis: Self::determine_allowed_apis(&plugin_info.permissions),
            resource_limits: PluginResourceLimits {
                max_cpu_time: global_settings.max_execution_time,
                max_memory: memory_limit,
                max_storage: global_settings.max_plugin_storage / 100, // 1%的存储限制
                max_network_calls: if plugin_info.permissions.can_network_access { 100 } else { 0 },
            },
        })
    }

    /// 确定插件允许的API列表
    fn determine_allowed_apis(permissions: &PluginPermissions) -> Vec<String> {
        let mut apis = Vec::new();

        if permissions.can_read_messages {
            apis.push("message.read".to_string());
        }
        if permissions.can_send_messages {
            apis.push("message.send".to_string());
        }
        if permissions.can_access_storage {
            apis.push("storage.access".to_string());
        }
        if permissions.can_network_access {
            apis.push("network.access".to_string());
        }
        if permissions.can_access_ai {
            apis.push("ai.access".to_string());
        }

        apis
    }

    /// 验证插件配置
    fn validate_plugin_config(config: &PluginConfig) -> DispatchResult {
        // 验证配置项数量
        ensure!(
            config.settings.len() <= 100,
            Error::<T>::TooManyPluginConfigSettings
        );

        // 验证配置项键值长度
        for (key, value) in &config.settings {
            ensure!(
                key.len() <= 64 && value.len() <= 256,
                Error::<T>::InvalidPluginConfigValue
            );
        }

        Ok(())
    }

    /// 更新插件指标
    fn update_plugin_metrics(
        plugin_id: &PluginId,
        hook_result: &PluginHookResult,
    ) -> DispatchResult {
        PluginMetricsStorage::<T>::try_mutate(plugin_id, |metrics| {
            metrics.total_executions = metrics.total_executions.saturating_add(1);

            if hook_result.result.success {
                metrics.successful_executions = metrics.successful_executions.saturating_add(1);
            } else {
                metrics.failed_executions = metrics.failed_executions.saturating_add(1);
            }

            // 计算平均执行时间
            let total_time = metrics.average_execution_time * (metrics.total_executions - 1) + hook_result.execution_time;
            metrics.average_execution_time = total_time / metrics.total_executions;

            metrics.last_execution = hook_result.execution_time;

            Ok::<(), DispatchError>(())
        })?;

        Ok(())
    }

    /// 记录插件执行历史
    fn record_plugin_execution(
        plugin_id: &PluginId,
        hook_type: &PluginHookType,
        hook_result: &PluginHookResult,
    ) -> DispatchResult {
        let execution_record = PluginExecutionRecord {
            timestamp: T::TimeProvider::now().as_secs(),
            hook_type: hook_type.clone(),
            success: hook_result.result.success,
            execution_time: hook_result.execution_time as u32,
            error_message: if hook_result.result.success {
                None
            } else {
                Some(
                    hook_result.result.message.as_bytes()
                        .to_vec()
                        .try_into()
                        .unwrap_or_default()
                )
            },
        };

        PluginExecutionHistory::<T>::try_mutate(plugin_id, |history| {
            // 保留最新的100条记录
            if history.len() >= 100 {
                history.remove(0);
            }
            history.try_push(execution_record).map_err(|_| Error::<T>::PluginExecutionFailed)
        })?;

        Ok(())
    }

    /// 检查群组插件权限
    fn check_group_plugin_permission(
        group_id: &GroupId,
        plugin_id: &PluginId,
    ) -> DispatchResult {
        // 检查群组是否明确允许该插件
        if Self::group_plugin_whitelist(group_id, plugin_id) {
            return Ok(());
        }

        // 检查插件信任等级
        if let Some(plugin_info) = Self::registered_plugins(plugin_id) {
            match plugin_info.trust_level {
                PluginTrustLevel::System => Ok(()), // 系统插件总是允许
                _ => Err(Error::<T>::GroupPluginPermissionDenied),
            }
        } else {
            Err(Error::<T>::PluginNotFound)
        }
    }

    /// 执行插件钩子（内部方法）
    fn execute_plugin_hooks_internal(
        hook_type: PluginHookType,
        group_id: Option<GroupId>,
        data: &[u8],
    ) -> DispatchResult {
        // 检查插件系统是否启用
        if !Self::global_plugin_settings().plugins_enabled {
            return Ok(()); // 静默跳过
        }

        // 获取支持该钩子的所有插件
        let plugin_ids: Vec<_> = PluginHooks::<T>::iter_prefix(&hook_type)
            .filter_map(|(plugin_id, enabled)| if enabled { Some(plugin_id) } else { None })
            .collect();

        for plugin_id in plugin_ids {
            // 检查插件状态
            if Self::plugin_states(&plugin_id) != PluginState::Enabled {
                continue;
            }

            // 如果是群组相关的钩子，检查群组权限
            if let Some(gid) = group_id {
                if Self::check_group_plugin_permission(&gid, &plugin_id).is_err() {
                    continue;
                }
            }

            // 模拟插件执行（在实际实现中会调用真实的插件代码）
            let execution_result = Self::simulate_plugin_execution(&plugin_id, &hook_type, data)?;

            // 更新插件指标
            let _ = Self::update_plugin_metrics(&plugin_id, &execution_result);

            // 记录执行历史
            let _ = Self::record_plugin_execution(&plugin_id, &hook_type, &execution_result);

            // 发送执行事件
            Self::deposit_event(Event::PluginHookExecuted {
                plugin_id,
                hook_type: hook_type.clone(),
                success: execution_result.result.success,
                execution_time: execution_result.execution_time as u32,
            });
        }

        Ok(())
    }

    /// 模拟插件执行（在实际实现中会替换为真实的插件执行机制）
    fn simulate_plugin_execution(
        _plugin_id: &PluginId,
        _hook_type: &PluginHookType,
        _data: &[u8],
    ) -> Result<PluginHookResult, Error<T>> {
        // 模拟插件执行
        Ok(PluginHookResult {
            plugin_id: _plugin_id.clone(),
            result: PluginResult {
                success: true,
                data: Vec::new(),
                message: "Plugin executed successfully".to_string(),
                modified_data: None,
            },
            execution_time: 50, // 模拟50ms执行时间
        })
    }

    /// 获取Pallet账户ID
    pub fn account_id() -> T::AccountId {
        T::PalletId::get().into_account_truncating()
    }
}

/// 群组行为分析结果
#[derive(Clone, PartialEq, Eq, RuntimeDebug)]
struct GroupBehaviorAnalysis {
    pub security_preference: f32,
    pub activity_level: ActivityLevel,
    pub encryption_usage_ratio: f32,
}

/// 用户偏好分析结果
#[derive(Clone, PartialEq, Eq, RuntimeDebug)]
struct UserPreferenceAnalysis {
    pub security_preference: f32,
    pub preferred_encryption_mode: EncryptionMode,
    pub response_time_preference: ResponseTimePreference,
}

/// 活动级别
#[derive(Clone, PartialEq, Eq, RuntimeDebug)]
enum ActivityLevel {
    Low,
    Medium,
    High,
}

/// 响应时间偏好
#[derive(Clone, PartialEq, Eq, RuntimeDebug)]
enum ResponseTimePreference {
    Fast,
    Balanced,
    Secure,
}