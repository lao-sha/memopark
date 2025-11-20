#![cfg_attr(not(feature = "std"), no_std)]
// 函数级中文注释：允许未使用的导入（trait方法调用）
#![allow(unused_imports)]

extern crate alloc;

// 模块引入：权重接口定义
pub mod weights;

// 函数级中文注释：导入log用于记录自动pin失败的警告
extern crate log;
// 函数级中文注释：导入pallet_memo_ipfs用于IpfsPinner trait
extern crate pallet_stardust_ipfs;

// 函数级中文注释：将 pallet 模块内导出的类型（如 Pallet、Call、Event 等）在 crate 根进行再导出
// 作用：便于 runtime 以 `pallet_stardust_grave::Call` 等路径引用，同时满足集成宏的默认部件查找。
pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod tests_primary_deceased;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use crate::weights::WeightInfo;
    use alloc::collections::BTreeMap;
    use alloc::vec::Vec;
    use frame_support::traits::tokens::ExistenceRequirement;
    use frame_support::weights::Weight;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency, StorageVersion},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::{SaturatedConversion, Saturating};
    use sp_runtime::traits::AtLeast32BitUnsigned;
    use pallet_stardust_ipfs::IpfsPinner;
    // 取消 VisibilityPolicy 后不再需要 DecodeWithMemTracking

    /// 函数级中文注释：安葬回调接口，供外部统计/联动。
    pub trait OnIntermentCommitted {
        /// 当某个逝者被安葬到某墓位时触发
        fn on_interment(grave_id: u64, deceased_id: u64);
    }

    /// 函数级中文注释：陵园管理员权限校验接口，占位以便 grave 在需要时允许上级管理员操作。
    pub trait ParkAdminOrigin<Origin> {
        fn ensure(park_id: u64, origin: Origin) -> DispatchResult;
    }

    /// 函数级中文注释：逝者令牌访问抽象，降低与 `pallet-deceased` 的耦合。
    /// - 运行时通过适配器实现本 Trait，从 `pallet-deceased` 读取 `deceased_token`；
    /// - 返回值长度与本模块 `MaxCidLen` 对齐，便于直接存入 `Grave.deceased_tokens`。
    pub trait DeceasedTokenAccess<MaxCidLen: Get<u32>> {
        fn token_of(id: u64) -> Option<BoundedVec<u8, MaxCidLen>>;
    }

    // 函数级中文注释：移除未使用的 KycProvider trait
    // - 该 trait 从未在本 pallet 中实际使用
    // - 已清理冗余代码

    #[pallet::config]
    /// 函数级中文注释：StardustGrave Pallet 配置 trait
    /// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式声明
    pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
        /// 函数级中文注释：权重信息，由 runtime 提供实现（未基准前可在 runtime 设为 `TestWeights`）。
        type WeightInfo: WeightInfo;
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
        #[pallet::constant]
        type MaxPerPark: Get<u32>;
        #[pallet::constant]
        type MaxIntermentsPerGrave: Get<u32>;
        type OnInterment: OnIntermentCommitted;
        type ParkAdmin: ParkAdminOrigin<Self::RuntimeOrigin>;
        #[pallet::constant]
        type MaxIdsPerName: Get<u32>;
        #[pallet::constant]
        type MaxComplaintsPerGrave: Get<u32>;
        /// 函数级中文注释：每个墓位最多可绑定的管理员账户数（不含墓主）。
        #[pallet::constant]
        type MaxAdminsPerGrave: Get<u32>;
        /// 函数级中文注释：人类可读 ID（Slug）长度（固定 10 位数字）。
        #[pallet::constant]
        type SlugLen: Get<u32>;
        /// 函数级中文注释：关注者上限
        #[pallet::constant]
        type MaxFollowers: Get<u32>;

        /// 函数级中文注释：治理起源（允许非所有者通过治理修改部分只读元数据，如封面CID）。
        /// - 运行时可绑定 Root 或内容治理签名账户等多通道。
        type GovernanceOrigin: frame_support::traits::EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级中文注释：逝者令牌提供者适配器，由 runtime 连接 `pallet-deceased`。
        type DeceasedTokenProvider: DeceasedTokenAccess<Self::MaxCidLen>;

        /// 函数级中文注释：关注冷却时间（以块为单位）。同一 (grave, follower) 的连续关注/取关操作的最小间隔。
        #[pallet::constant]
        type FollowCooldownBlocks: Get<u32>;

        /// 函数级中文注释：押金货币接口与押金常量。
        /// - Currency 必须实现 ReservableCurrency（支持保留/释放押金）。
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 每次关注所需的保留押金（可为 0）。
        #[pallet::constant]
        type FollowDeposit: Get<BalanceOf<Self>>;

        /// 函数级中文注释：创建墓地的一次性协议费（无押金）。
        /// - 该费用在执行 `create_grave` 前即从发起账户转入费用接收账户；
        /// - 若费用为 0，则不收取；
        /// - 使用 KeepAlive 模式，确保扣费后账户不因低于 ED 被移除。
        #[pallet::constant]
        type CreateFee: Get<BalanceOf<Self>>;

        /// 函数级中文注释：创建费接收账户（例如：国库账户）。
        /// - 由运行时实现返回一个稳定账户（可由 PalletId 派生或直接指向 Treasury）。
        type FeeCollector: Get<Self::AccountId>;

        /// 函数级中文注释：公共封面目录容量上限（用于限制 `CoverOptions` 列表长度，防止状态膨胀）。
        /// - 目录仅存储 CID 字节，不存放图片本体；
        /// - 建议取值 128/256，具体由运行时常量注入；
        /// - 目录项的增删仅允许治理起源调用。
        #[pallet::constant]
        type MaxCoverOptions: Get<u32>;

        /// 函数级中文注释：公共音频目录容量上限（用于限制 `AudioOptions` 列表长度，防止状态膨胀）。
        /// - 目录仅存储明文 CID 字节，不存放音频本体；
        /// - 任意墓位可从目录中选择其一作为背景音乐；
        /// - 目录项的增删仅允许治理起源调用。
        #[pallet::constant]
        type MaxAudioOptions: Get<u32>;
        #[pallet::constant]
        /// 函数级中文注释：每墓位"私有音频候选"容量上限（仅墓主可维护）。
        type MaxPrivateAudioOptions: Get<u32>;
        #[pallet::constant]
        /// 函数级中文注释：每墓位"播放列表"容量上限（按顺序存放若干 CID）。
        type MaxAudioPlaylistLen: Get<u32>;

        /// 函数级中文注释：首页轮播图容量上限（全局）。
        #[pallet::constant]
        type MaxCarouselItems: Get<u32>;
        /// 轮播图标题最大长度。
        #[pallet::constant]
        type MaxTitleLen: Get<u32>;
        /// 轮播图链接最大长度。
        #[pallet::constant]
        type MaxLinkLen: Get<u32>;
        
        // ============= IPFS自动Pin相关配置 =============
        /// 函数级详细中文注释：IPFS自动pin提供者，供墓位音频CID自动固定
        /// 
        /// 集成目标：
        /// - AudioOf[grave_id]: 墓位背景音乐CID自动pin
        /// - AudioOptions: 公共音频目录CID自动pin（治理添加时）
        /// - PrivateAudioOptionsOf: 私有音频候选CID自动pin
        /// - AudioPlaylistOf: 播放列表CID批量pin
        /// 
        /// 使用场景：
        /// - set_audio: 设置墓位音频时自动pin
        /// - set_audio_via_governance: 治理设置音频时自动pin
        /// - add_audio_option: 添加公共音频时自动pin（治理）
        /// - add_private_audio_option: 添加私有音频时自动pin
        /// - set_audio_playlist: 设置播放列表时批量pin
        type IpfsPinner: pallet_stardust_ipfs::IpfsPinner<Self::AccountId, Self::Balance>;
        
        /// 函数级中文注释：余额类型（用于IPFS存储费用支付）
        type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        
        /// 函数级中文注释：默认IPFS存储单价（每副本每月）
        #[pallet::constant]
        type DefaultStoragePrice: Get<Self::Balance>;
    }

    /// 函数级中文注释：余额类型别名，便于在常量与函数中使用链上 Balance 类型。
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级中文注释：墓地信息结构。仅存储加密 CID，不落明文。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Grave<T: Config> {
        /// 函数级中文注释：墓位所属园区 ID；可选。None 表示尚未隶属于任何园区。
        pub park_id: Option<u64>,
        pub owner: T::AccountId,
        pub admin_group: Option<u64>,
        /// 函数级中文注释：墓地名称链下 CID（不落明文）。
        pub name: BoundedVec<u8, T::MaxCidLen>,
        /// 函数级中文注释：该墓地下已安葬的逝者令牌列表（最多 6 人）。
        pub deceased_tokens: BoundedVec<BoundedVec<u8, T::MaxCidLen>, ConstU32<6>>,
        /// 函数级中文注释：是否公开（用于简单的对外可见性控制，细粒度策略见 VisibilityPolicy）。
        pub is_public: bool,
        pub active: bool,
    }

    /// 函数级中文注释：安葬记录，记录逝者与墓位的绑定及备注。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[cfg_attr(feature = "std", derive(Debug))]
    #[scale_info(skip_type_params(T))]
    pub struct IntermentRecord<T: Config> {
        pub deceased_id: u64,
        pub slot: u16,
        pub time: BlockNumberFor<T>,
        pub note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
    }

    /// 函数级详细中文注释：墓位准入策略枚举（Phase 1.5新增 - 解决P0问题2）
    /// 
    /// ### 功能
    /// - 控制谁可以将逝者迁移到该墓位
    /// - 解决P0问题：逝者可以强行挤入私人墓位
    /// 
    /// ### 策略说明
    /// - **OwnerOnly（默认）**：仅墓主控制，其他人无法迁入
    /// - **Public**：公开墓位，任何人都可以迁入
    /// - **Whitelist**：白名单模式，仅允许特定账户迁入
    /// 
    /// ### 使用场景
    /// - OwnerOnly: 私人墓、VIP墓（默认）
    /// - Public: 公共墓位、社区墓
    /// - Whitelist: 家族墓、定向服务墓
    /// 
    /// ### 设计理念
    /// - 平衡需求3（逝者自由迁移）与墓主控制权
    /// - 墓主可以设置准入策略保护墓位
    /// - 逝者owner在策略允许范围内自由迁移
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[cfg_attr(feature = "std", derive(Debug))]
    pub enum GraveAdmissionPolicy {
        /// 仅墓主控制（默认策略）
        /// - 只有墓主自己创建的逝者可以进入
        /// - 其他人无法迁入
        OwnerOnly,
        
        /// 公开墓位
        /// - 任何人都可以将逝者迁入
        /// - 适合公共墓地、社区墓
        Public,
        
        /// 白名单模式
        /// - 仅白名单中的账户可以迁入
        /// - 适合家族墓、定向服务
        Whitelist,
    }
    
    impl Default for GraveAdmissionPolicy {
        fn default() -> Self {
            // 默认为OwnerOnly，保护墓主权利
            GraveAdmissionPolicy::OwnerOnly
        }
    }
    
    impl GraveAdmissionPolicy {
        /// 函数级中文注释：转换为u8代码（用于Event）
        /// - 0: OwnerOnly
        /// - 1: Public
        /// - 2: Whitelist
        pub fn to_code(&self) -> u8 {
            match self {
                GraveAdmissionPolicy::OwnerOnly => 0,
                GraveAdmissionPolicy::Public => 1,
                GraveAdmissionPolicy::Whitelist => 2,
            }
        }
        
        /// 函数级中文注释：从u8代码构建（用于前端解析）
        /// - 0: OwnerOnly
        /// - 1: Public
        /// - 2: Whitelist
        /// - 其他：默认OwnerOnly
        pub fn from_code(code: u8) -> Self {
            match code {
                0 => GraveAdmissionPolicy::OwnerOnly,
                1 => GraveAdmissionPolicy::Public,
                2 => GraveAdmissionPolicy::Whitelist,
                _ => GraveAdmissionPolicy::OwnerOnly,
            }
        }
    }

    // 存储版本常量（用于 FRAME v2 storage_version 宏传参）
    const STORAGE_VERSION: StorageVersion = StorageVersion::new(10);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type NextGraveId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type Graves<T: Config> = StorageMap<_, Blake2_128Concat, u64, Grave<T>, OptionQuery>;

    #[pallet::storage]
    pub type GravesByPark<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BoundedVec<u64, T::MaxPerPark>, ValueQuery>;

    #[pallet::storage]
    pub type Interments<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        BoundedVec<IntermentRecord<T>, T::MaxIntermentsPerGrave>,
        ValueQuery,
    >;

    /// 函数级中文注释：主逝者反向索引。记录每个墓位的"主逝者"ID，便于索引层或其他 Pallet 快速定位，避免线性扫描。
    /// 维护策略：
    /// - 在首次安葬(`inter`)时若尚未设置，则将该逝者设为主逝者；
    /// - 在起掘(`exhume`)移除当前主逝者时，从剩余安葬记录中挑选一个作为新的主逝者（优先选择 slot 最小的记录）；
    /// - 若墓位无安葬记录，则清除该索引。
    #[pallet::storage]
    pub type PrimaryDeceasedOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, u64, OptionQuery>;

    /// 函数级详细中文注释：墓位准入策略存储（Phase 1.5新增 - 解决P0问题2）
    /// 
    /// ### 功能
    /// - 存储每个墓位的准入策略
    /// - 控制谁可以将逝者迁入该墓位
    /// 
    /// ### 默认值
    /// - ValueQuery：返回默认值OwnerOnly（保护墓主权利）
    /// - 未设置策略的墓位默认为OwnerOnly
    /// 
    /// ### 使用场景
    /// - 墓主调用set_admission_policy设置策略
    /// - deceased::transfer_deceased检查策略
    /// 
    /// ### 注意事项
    /// - 墓主可随时修改策略
    /// - 策略变更立即生效
    #[pallet::storage]
    pub type AdmissionPolicyOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // grave_id
        GraveAdmissionPolicy,
        ValueQuery, // 默认返回OwnerOnly
    >;

    /// 函数级详细中文注释：墓位准入白名单存储（Phase 1.5新增）
    /// 
    /// ### 功能
    /// - 存储白名单模式下允许迁入的账户
    /// - 仅在AdmissionPolicy为Whitelist时生效
    /// 
    /// ### 键结构
    /// - 第一层key: grave_id（墓位ID）
    /// - 第二层key: AccountId（允许的账户）
    /// - value: ()（仅作标记，存在即允许）
    /// 
    /// ### 使用场景
    /// - 墓主调用add_to_admission_whitelist添加账户
    /// - 墓主调用remove_from_admission_whitelist移除账户
    /// - deceased::transfer_deceased检查是否在白名单中
    /// 
    /// ### 注意事项
    /// - 仅墓主可以管理白名单
    /// - 白名单不限制墓主自己
    #[pallet::storage]
    pub type AdmissionWhitelist<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        u64, // grave_id
        Blake2_128Concat,
        T::AccountId, // 允许的账户
        (),
        ValueQuery,
    >;

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct GraveMeta {
        pub categories: u32,
        pub religion: u8,
    }

    #[pallet::storage]
    pub type GraveMetaOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, GraveMeta, ValueQuery>;

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct Moderation {
        pub restricted: bool,
        pub removed: bool,
        pub reason_code: u8,
    }

    #[pallet::storage]
    pub type ModerationOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, Moderation, ValueQuery>;

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Complaint<T: Config> {
        pub who: T::AccountId,
        pub cid: BoundedVec<u8, T::MaxCidLen>,
        pub time: BlockNumberFor<T>,
    }

    #[pallet::storage]
    pub type ComplaintsByGrave<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        BoundedVec<Complaint<T>, T::MaxComplaintsPerGrave>,
        ValueQuery,
    >;

    #[pallet::storage]
    pub type NameIndex<T: Config> =
        StorageMap<_, Blake2_128Concat, [u8; 32], BoundedVec<u64, T::MaxIdsPerName>, ValueQuery>;

    /// 函数级中文注释：墓位管理员列表（不含墓主），统一授权源供子模块（如 deceased）只读引用。
    #[pallet::storage]
    pub type GraveAdmins<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        BoundedVec<T::AccountId, T::MaxAdminsPerGrave>,
        ValueQuery,
    >;

    /// 函数级中文注释：人类可读 ID（Slug），长度固定为 10 位数字。
    #[pallet::storage]
    pub type SlugOf<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BoundedVec<u8, T::SlugLen>, OptionQuery>;

    /// 函数级中文注释：Slug -> GraveId 映射，便于通过 Slug 解析 Grave。
    #[pallet::storage]
    pub type GraveBySlug<T: Config> =
        StorageMap<_, Blake2_128Concat, BoundedVec<u8, T::SlugLen>, u64, OptionQuery>;

    /// 函数级中文注释：加入策略：0=Open,1=Whitelist。
    #[pallet::storage]
    pub type JoinPolicyOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, u8, ValueQuery>;

    /// 函数级中文注释：成员集合（通过后可留言/供奉）。
    #[pallet::storage]
    pub type Members<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    /// 函数级中文注释：待审批的加入申请（私有模式）。
    #[pallet::storage]
    pub type PendingApplications<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        u64,
        Blake2_128Concat,
        T::AccountId,
        BlockNumberFor<T>,
        OptionQuery,
    >;

    // 已取消 VisibilityPolicy 策略，改由 `is_public` 简化控制。

    /// 关注者列表
    #[pallet::storage]
    pub type FollowersOf<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BoundedVec<T::AccountId, T::MaxFollowers>, ValueQuery>;

    /// 函数级中文注释：去重与快速授权映射，判定某账户是否关注了某墓地。
    #[pallet::storage]
    pub type IsFollower<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    /// 函数级中文注释：关注冷却计时：记录 (grave_id, who) 最近一次 follow/unfollow 操作的块号。
    #[pallet::storage]
    pub type LastFollowAction<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        u64,
        Blake2_128Concat,
        T::AccountId,
        BlockNumberFor<T>,
        OptionQuery,
    >;

    /// 函数级中文注释：黑名单：被列入者无法关注该墓地。
    #[pallet::storage]
    pub type BannedFollowers<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    /// 函数级中文注释：墓地封面图片 CID（仅存储 CID 字节，不落图片）。
    /// - 默认不存在；创建后可由所有者直接设置；非所有者需通过治理接口设置。
    #[pallet::storage]
    pub type CoverCidOf<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BoundedVec<u8, T::MaxCidLen>, OptionQuery>;

    /// 函数级中文注释：公共封面目录（全局可选封面 CID 列表）。
    /// - 仅存储明文 CID（不加密），供前端/索引层渲染；
    /// - 仅治理起源可增删目录项；
    /// - 任意墓地可通过 `set_cover_from_option` 选择其中一项作为封面；
    /// - 列表去重：相同 CID 不重复插入；删除按值匹配。
    #[pallet::storage]
    pub type CoverOptions<T: Config> =
        StorageValue<_, BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxCoverOptions>, ValueQuery>;

    /// 函数级中文注释：墓地背景音乐 CID（仅存储明文 CID 字节，不落音频内容）。
    /// - 默认不存在；创建后可由所有者直接设置；非所有者需通过治理接口设置。
    #[pallet::storage]
    pub type AudioCidOf<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BoundedVec<u8, T::MaxCidLen>, OptionQuery>;

    /// 函数级中文注释：公共音频目录（全局可选背景音乐 CID 列表）。
    /// - 仅治理起源可增删目录项；任意墓位可从目录中选择其一作为背景音乐；
    /// - 列表去重：相同 CID 不重复插入；删除按值匹配。
    #[pallet::storage]
    pub type AudioOptions<T: Config> =
        StorageValue<_, BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxAudioOptions>, ValueQuery>;

    /// 函数级中文注释：每墓位"私有音频候选"目录（仅墓主可维护）。
    #[pallet::storage]
    pub type PrivateAudioOptionsOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxPrivateAudioOptions>,
        ValueQuery,
    >;

    /// 函数级中文注释：每墓位播放列表（顺序存放 CID）。
    #[pallet::storage]
    pub type AudioPlaylistOf<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxAudioPlaylistLen>,
        ValueQuery,
    >;

    /// 函数级中文注释：旧关注押金退款余额（方案B迁移专用）。
    /// - 在 on_runtime_upgrade(v9->v10) 中，为每个账户累计 FollowDeposit×关注次数；用户可调用退款接口解除保留押金。
    #[pallet::storage]
    pub type LegacyFollowRefunds<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, OptionQuery>;

    /// 函数级中文注释：轮播图项结构体（全局首页）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct CarouselItem<T: Config> {
        pub img_cid: BoundedVec<u8, T::MaxCidLen>,
        pub title: BoundedVec<u8, T::MaxTitleLen>,
        pub link: Option<BoundedVec<u8, T::MaxLinkLen>>,
        pub target: Option<(u8, u64)>,
        pub start_block: Option<BlockNumberFor<T>>,
        pub end_block: Option<BlockNumberFor<T>>,
    }

    /// 函数级中文注释：全局首页轮播图数据（按顺序渲染）。
    #[pallet::storage]
    pub type Carousel<T: Config> =
        StorageValue<_, BoundedVec<CarouselItem<T>, T::MaxCarouselItems>, ValueQuery>;

    /// 函数级中文注释：成员↔逝者亲属关系记录
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct KinshipRecord<T: Config> {
        pub code: u8,
        pub note: BoundedVec<u8, T::MaxCidLen>,
        pub verified: bool,
        pub time: BlockNumberFor<T>,
    }

    /// 函数级中文注释：成员在某墓位下声明与某逝者的亲属关系。
    #[pallet::storage]
    pub type KinshipOf<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        u64,
        Blake2_128Concat,
        (u64, T::AccountId),
        KinshipRecord<T>,
        OptionQuery,
    >;

    /// 函数级中文注释：成员在某墓位下的关系索引，便于前端快速拉取。
    #[pallet::storage]
    pub type KinshipIndexByMember<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        u64,
        BoundedVec<(u64, u8), ConstU32<64>>,
        ValueQuery,
    >;

    /// 函数级中文注释：亲属关系声明策略：0=Auto（自动通过），1=Approve（需管理员审核）。
    #[pallet::storage]
    pub type KinshipPolicyOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, u8, ValueQuery>;

    // ===== Hall（纪念馆）增强：附加信息与风控 =====
    // Hall 相关：原计划拆分至 pallet-memo-hall，但该 pallet 从未启用，已归档。
    // 函数级中文注释：纪念馆功能实际由本 pallet 的墓位功能提供（create_grave/inter/update_grave）。

    // Hall 限频与 KYC 参数：未实际使用，已归档。

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        GraveCreated {
            id: u64,
            park_id: Option<u64>,
            owner: T::AccountId,
        },
        GraveUpdated {
            id: u64,
        },
        GraveTransferred {
            id: u64,
            new_owner: T::AccountId,
        },
        Interred {
            id: u64,
            deceased_id: u64,
        },
        Exhumed {
            id: u64,
            deceased_id: u64,
        },
        GraveActivated {
            id: u64,
        },
        GraveDeactivated {
            id: u64,
        },
        MetaUpdated {
            id: u64,
        },
        ComplainSubmitted {
            id: u64,
            who: T::AccountId,
        },
        Restricted {
            id: u64,
            on: bool,
            reason_code: u8,
        },
        Removed {
            id: u64,
            reason_code: u8,
        },
        NameHashSet {
            id: u64,
            name_hash: [u8; 32],
        },
        NameHashCleared {
            id: u64,
            name_hash: [u8; 32],
        },
        /// 已添加墓位管理员
        AdminAdded {
            id: u64,
            who: T::AccountId,
        },
        /// 已移除墓位管理员
        AdminRemoved {
            id: u64,
            who: T::AccountId,
        },
        /// 已分配人类可读 ID（Slug）
        SlugAssigned {
            id: u64,
            slug: BoundedVec<u8, T::SlugLen>,
        },
        /// 加入策略已变更（0=Open,1=Whitelist）
        PolicyChanged {
            id: u64,
            policy: u8,
        },
        /// 成员申请/批准/拒绝/加入
        MemberApplied {
            id: u64,
            who: T::AccountId,
        },
        MemberApproved {
            id: u64,
            who: T::AccountId,
        },
        MemberRejected {
            id: u64,
            who: T::AccountId,
        },
        MemberJoined {
            id: u64,
            who: T::AccountId,
        },
        /// 成员↔逝者亲属关系相关事件
        KinshipDeclared {
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
            code: u8,
        },
        KinshipApproved {
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
        },
        KinshipRejected {
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
        },
        KinshipUpdated {
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
            code: u8,
        },
        KinshipRemoved {
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
        },
        KinshipPolicyChanged {
            id: u64,
            policy: u8,
        },
        /// 可见性策略变更
        // 取消 VisibilityPolicy 后移除此事件
        /// 关注/取消关注
        Followed {
            id: u64,
            who: T::AccountId,
        },
        Unfollowed {
            id: u64,
            who: T::AccountId,
        },
        /// 设置墓位所属园区
        GraveSetPark {
            id: u64,
            park_id: Option<u64>,
        },
        /// 函数级中文注释：封面图片 CID 已设置/清除
        CoverSet {
            id: u64,
        },
        CoverCleared {
            id: u64,
        },
        /// 函数级中文注释：公共封面目录项增删（仅治理）
        CoverOptionAdded {},
        CoverOptionRemoved {},
        /// 函数级中文注释：背景音乐 CID 已设置/清除
        AudioSet {
            id: u64,
        },
        AudioCleared {
            id: u64,
        },
        /// 函数级中文注释：公共音频目录项增删（仅治理）
        AudioOptionAdded {},
        AudioOptionRemoved {},
        /// 函数级中文注释：私有音频候选变更
        PrivateAudioOptionAdded {
            id: u64,
        },
        PrivateAudioOptionRemoved {
            id: u64,
        },
        /// 函数级中文注释：播放列表变更
        AudioPlaylistSet {
            id: u64,
            len: u32,
        },
        /// 函数级中文注释：治理证据已记录（scope, key, cid）。scope：1=Grave元/封面/所有权等
        GovEvidenceNoted(u8, u64, BoundedVec<u8, T::MaxCidLen>),
        /// 函数级中文注释：轮播图刷新（覆盖式设置）
        CarouselSet {
            len: u32,
        },
        /// 函数级中文注释：墓位准入策略已设置（Phase 1.5新增）
        /// - policy_code: 0=OwnerOnly, 1=Public, 2=Whitelist
        AdmissionPolicySet {
            grave_id: u64,
            policy_code: u8,
        },
        /// 函数级中文注释：账户已添加到准入白名单（Phase 1.5新增）
        AddedToAdmissionWhitelist {
            grave_id: u64,
            who: T::AccountId,
        },
        /// 函数级中文注释：账户已从准入白名单移除（Phase 1.5新增）
        RemovedFromAdmissionWhitelist {
            grave_id: u64,
            who: T::AccountId,
        },
        /// 函数级中文注释：主逝者已设置
        /// - grave_id: 墓位ID
        /// - deceased_id: 设置为主逝者的逝者ID
        PrimaryDeceasedSet {
            grave_id: u64,
            deceased_id: u64,
        },
        /// 函数级中文注释：主逝者设置已清除
        /// - grave_id: 墓位ID
        PrimaryDeceasedCleared {
            grave_id: u64,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        NotOwner,
        NotAdmin,
        /// 函数级中文注释：墓位非空（需求1）
        /// - 场景：转让墓位前必须清空所有逝者
        /// - 解决：逝者owner需先调用deceased.transfer_deceased迁移逝者
        GraveNotEmpty,
        /// 函数级详细中文注释：准入被拒绝（Phase 1.5新增 - 解决P0问题2）
        /// 
        /// ### 触发场景
        /// - 逝者owner试图迁移逝者到目标墓位
        /// - 但不符合目标墓位的准入策略
        /// 
        /// ### 策略说明
        /// - OwnerOnly: 调用者不是墓主 → AdmissionDenied
        /// - Public: 总是允许 → 不会触发
        /// - Whitelist: 调用者不在白名单 → AdmissionDenied
        /// 
        /// ### 解决方法
        /// - 联系墓主请求准入
        /// - 墓主可以修改策略为Public
        /// - 墓主可以将你添加到白名单
        AdmissionDenied,
        ParkNotFound,
        CapacityExceeded,
        AlreadyOccupied,
        InvalidKind,
        AlreadyRemoved,
        /// Slug 已存在
        SlugExists,
        /// Slug 非法
        InvalidSlug,
        /// 已是成员
        AlreadyMember,
        /// 非成员
        NotMember,
        /// 已申请
        AlreadyApplied,
        /// 未申请
        NotApplied,
        /// 策略限制
        PolicyViolation,
        /// 亲属关系重复
        KinshipExists,
        /// 亲属关系不存在
        KinshipNotFound,
        /// 已关注
        AlreadyFollowing,
        /// 押金保留失败或余额不足
        DepositFailed,
        /// 创建费扣款失败（余额不足或 KeepAlive 保护触发）
        FeePaymentFailed,
        /// 目录项已存在
        CoverOptionExists,
        /// 目录项不存在
        CoverOptionNotFound,
        /// 目录索引非法
        InvalidCoverIndex,
        /// 音频目录项已存在
        AudioOptionExists,
        /// 音频目录项不存在
        AudioOptionNotFound,
        /// 音频目录索引非法
        InvalidAudioIndex,
        /// 超出私有候选/播放列表容量
        AudioListCapacityExceeded,
        /// 轮播越界或时间窗非法
        CarouselIndexOOB,
        BadTimingWindow,
        /// 函数级中文注释：逝者不在该墓位中（主逝者设置新增）
        /// - 场景：尝试将某逝者设置为主逝者，但该逝者未安葬在此墓位
        /// - 解决：只能设置已安葬在该墓位中的逝者为主逝者
        DeceasedNotInGrave,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建墓地（单/双/多人），隶属某陵园。
        /// - 先行收取一次性创建费：将 `T::CreateFee` 从发起者转入 `T::FeeCollector`；
        /// - 扣费使用 KeepAlive，确保不会导致账户余额低于 ED 被回收；
        /// - 费用收取成功后再写入状态，任一步骤失败则不产生任何状态变更。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::create_grave())]
        pub fn create_grave(
            origin: OriginFor<T>,
            park_id: Option<u64>,
            name: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 创建费：若常量 > 0，则从发起人转至费用接收账户
            let fee = T::CreateFee::get();
            if !fee.is_zero() {
                let collector = T::FeeCollector::get();
                T::Currency::transfer(&who, &collector, fee, ExistenceRequirement::KeepAlive)
                    .map_err(|_| Error::<T>::FeePaymentFailed)?;
            }
            let id = NextGraveId::<T>::mutate(|n| {
                let id = *n;
                *n = n.saturating_add(1);
                id
            });
            let grave = Grave::<T> {
                park_id,
                owner: who.clone(),
                admin_group: None,
                name,
                deceased_tokens: BoundedVec::default(),
                is_public: true,
                active: true,
            };
            Graves::<T>::insert(id, &grave);
            if let Some(pid) = grave.park_id {
                GravesByPark::<T>::try_mutate(pid, |v| {
                    v.try_push(id).map_err(|_| Error::<T>::CapacityExceeded)
                })?;
            }
            // 生成 10 位数字 Slug（基于 id 与创建者），确保唯一
            let slug = Self::gen_unique_slug(id, &who)?;
            GraveBySlug::<T>::insert(&slug, id);
            SlugOf::<T>::insert(id, &slug);
            // 默认策略：Open
            JoinPolicyOf::<T>::insert(id, 0u8);
            Self::deposit_event(Event::GraveCreated {
                id,
                park_id,
                owner: who,
            });
            Self::deposit_event(Event::SlugAssigned { id, slug });
            Ok(())
        }

        // 历史注释：原计划的 pallet-memo-hall 从未启用，已归档。
        // 纪念馆功能实际由本 pallet 的 create_grave() / inter() 等接口提供。

        /// 函数级中文注释：设置墓位所属园区（仅墓主或园区管理员）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_park())]
        pub fn set_park(origin: OriginFor<T>, id: u64, park_id: Option<u64>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id {
                        T::ParkAdmin::ensure(pid, origin.clone())?;
                    } else {
                        return Err(Error::<T>::NotAdmin.into());
                    }
                }
                if g.park_id != park_id {
                    // 从旧园区索引移除
                    if let Some(old) = g.park_id {
                        let mut lst = GravesByPark::<T>::get(old);
                        if let Some(pos) = lst.iter().position(|x| *x == id) {
                            lst.swap_remove(pos);
                        }
                        GravesByPark::<T>::insert(old, lst);
                    }
                    // 加入新园区索引（若有）
                    if let Some(new_pid) = park_id {
                        GravesByPark::<T>::mutate(new_pid, |v| {
                            let _ = v.try_push(id);
                        });
                    }
                    g.park_id = park_id;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::GraveSetPark { id, park_id });
            Ok(())
        }

        /// 函数级详细中文注释：设置墓地封面（仅所有者可直接调用）。
        /// - 输入：`cid` 为链下图片的 CID 字节（IPFS/HTTPS 等），长度受 `MaxCidLen` 约束。
        /// - 权限：仅墓主；非所有者需通过 `set_cover_via_governance`。
        /// - 事件：`CoverSet { id }`。
        #[pallet::call_index(41)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn set_cover(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            CoverCidOf::<T>::insert(id, cid);
            Self::deposit_event(Event::CoverSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：清除墓地封面（仅所有者）。
        /// - 事件：`CoverCleared { id }`。
        #[pallet::call_index(42)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn clear_cover(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            CoverCidOf::<T>::remove(id);
            Self::deposit_event(Event::CoverCleared { id });
            Ok(())
        }

        /// 函数级详细中文注释：通过治理设置封面（允许非所有者但需满足治理起源）。
        /// - 由 Referenda/Root 等治理流程触发。
        #[pallet::call_index(43)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn set_cover_via_governance(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            CoverCidOf::<T>::insert(id, cid);
            Self::deposit_event(Event::CoverSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：通过治理清除封面。
        #[pallet::call_index(44)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn clear_cover_via_governance(origin: OriginFor<T>, id: u64) -> DispatchResult {
            Self::ensure_gov(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            CoverCidOf::<T>::remove(id);
            Self::deposit_event(Event::CoverCleared { id });
            Ok(())
        }

        /// 函数级详细中文注释：新增公共封面目录项（仅治理）。
        /// - 输入：`cid` 明文 CID 字节，长度受 `MaxCidLen` 约束；
        /// - 行为：若已存在则返回 `CoverOptionExists`；否则追加到 `CoverOptions`（受 `MaxCoverOptions` 限制）。
        /// - 事件：`CoverOptionAdded {}`。
        #[pallet::call_index(45)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn add_cover_option(
            origin: OriginFor<T>,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            CoverOptions::<T>::try_mutate(|list| -> DispatchResult {
                if list.iter().any(|x| x == &cid) {
                    return Err(Error::<T>::CoverOptionExists.into());
                }
                list.try_push(cid)
                    .map_err(|_| Error::<T>::CapacityExceeded)?;
                Ok(())
            })?;
            Self::deposit_event(Event::CoverOptionAdded {});
            Ok(())
        }

        /// 函数级详细中文注释：移除公共封面目录项（仅治理）。
        /// - 按值匹配移除第一处出现；若不存在返回 `CoverOptionNotFound`。
        /// - 事件：`CoverOptionRemoved {}`。
        #[pallet::call_index(46)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn remove_cover_option(
            origin: OriginFor<T>,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            CoverOptions::<T>::try_mutate(|list| -> DispatchResult {
                if let Some(pos) = list.iter().position(|x| x == &cid) {
                    list.swap_remove(pos);
                    Ok(())
                } else {
                    Err(Error::<T>::CoverOptionNotFound.into())
                }
            })?;
            Self::deposit_event(Event::CoverOptionRemoved {});
            Ok(())
        }

        /// 函数级详细中文注释：从公共目录设置墓地封面（仅所有者直接设置；非所有者走治理接口）。
        /// - 输入：`id` 墓地编号，`index` 目录索引（0..len-1）。
        /// - 校验：存在性、所有权、索引边界。
        /// - 事件：`CoverSet { id }`。
        #[pallet::call_index(47)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn set_cover_from_option(origin: OriginFor<T>, id: u64, index: u32) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            // 所有权/园区管理员校验策略与 set_cover 对齐：此处仅允许墓主直接设置
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            let list = CoverOptions::<T>::get();
            let idx = index as usize;
            ensure!(idx < list.len(), Error::<T>::InvalidCoverIndex);
            let chosen = list[idx].clone();
            CoverCidOf::<T>::insert(id, chosen);
            Self::deposit_event(Event::CoverSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：设置墓地背景音乐（仅所有者可直接调用）。
        /// - 输入：`cid` 为链下音频的 CID 字节（IPFS/HTTPS 等），长度受 `MaxCidLen` 约束。
        /// - 权限：仅墓主；非所有者需通过 `set_audio_via_governance`。
        /// - 事件：`AudioSet { id }`。
        #[pallet::call_index(52)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_audio())]
        pub fn set_audio(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            
            // 函数级中文注释：提前克隆cid用于后续自动pin
            let cid_for_pin: Vec<u8> = cid.clone().into_inner();
            
            AudioCidOf::<T>::insert(id, cid);
            
            // 函数级详细中文注释：自动pin墓位音频CID到IPFS
            // - 使用grave的主逝者ID（如有），否则使用grave_id作为deceased_id
            // - 失败不阻塞音频设置（容错处理）
            let deceased_id_u64 = PrimaryDeceasedOf::<T>::get(id).unwrap_or(id);
            
            if let Err(e) = T::IpfsPinner::pin_cid_for_grave(
                who.clone(),
                deceased_id_u64,
                cid_for_pin,
                None, // 使用默认Standard层级（3副本）
            ) {
                log::warn!(
                    target: "memo_grave",
                    "Auto-pin audio cid failed for grave {:?}: {:?}",
                    id,
                    e
                );
            }
            
            Self::deposit_event(Event::AudioSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：清除墓地背景音乐（仅所有者）。
        /// - 事件：`AudioCleared { id }`。
        #[pallet::call_index(53)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::clear_audio())]
        pub fn clear_audio(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            AudioCidOf::<T>::remove(id);
            Self::deposit_event(Event::AudioCleared { id });
            Ok(())
        }

        /// 函数级详细中文注释：通过治理设置背景音乐（允许非所有者但需满足治理起源）。
        /// - 由 Referenda/Root 等治理流程触发。
        #[pallet::call_index(54)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_audio_via_governance())]
        pub fn set_audio_via_governance(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            AudioCidOf::<T>::insert(id, cid);
            Self::deposit_event(Event::AudioSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：通过治理清除背景音乐。
        #[pallet::call_index(55)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::clear_audio_via_governance())]
        pub fn clear_audio_via_governance(origin: OriginFor<T>, id: u64) -> DispatchResult {
            Self::ensure_gov(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            AudioCidOf::<T>::remove(id);
            Self::deposit_event(Event::AudioCleared { id });
            Ok(())
        }

        /// 函数级详细中文注释：新增公共音频目录项（仅治理）。
        /// - 输入：`cid` 明文 CID 字节，长度受 `MaxCidLen` 约束；
        /// - 行为：若已存在则返回 `AudioOptionExists`；否则追加到 `AudioOptions`（受 `MaxAudioOptions` 限制）。
        /// - 事件：`AudioOptionAdded {}`。
        #[pallet::call_index(56)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::add_audio_option())]
        pub fn add_audio_option(
            origin: OriginFor<T>,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            AudioOptions::<T>::try_mutate(|list| -> DispatchResult {
                if list.iter().any(|x| x == &cid) {
                    return Err(Error::<T>::AudioOptionExists.into());
                }
                list.try_push(cid)
                    .map_err(|_| Error::<T>::CapacityExceeded)?;
                Ok(())
            })?;
            Self::deposit_event(Event::AudioOptionAdded {});
            Ok(())
        }

        /// 函数级详细中文注释：移除公共音频目录项（仅治理）。
        /// - 按值匹配移除第一处出现；若不存在返回 `AudioOptionNotFound`。
        /// - 事件：`AudioOptionRemoved {}`。
        #[pallet::call_index(57)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove_audio_option())]
        pub fn remove_audio_option(
            origin: OriginFor<T>,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            AudioOptions::<T>::try_mutate(|list| -> DispatchResult {
                if let Some(pos) = list.iter().position(|x| x == &cid) {
                    list.swap_remove(pos);
                    Ok(())
                } else {
                    Err(Error::<T>::AudioOptionNotFound.into())
                }
            })?;
            Self::deposit_event(Event::AudioOptionRemoved {});
            Ok(())
        }

        /// 函数级详细中文注释：从公共目录设置背景音乐（仅所有者直接设置；非所有者走治理接口）。
        /// - 输入：`id` 墓地编号，`index` 目录索引（0..len-1）。
        /// - 校验：存在性、所有权、索引边界。
        /// - 事件：`AudioSet { id }`。
        #[pallet::call_index(58)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_audio_from_option())]
        pub fn set_audio_from_option(origin: OriginFor<T>, id: u64, index: u32) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            let list = AudioOptions::<T>::get();
            let idx = index as usize;
            ensure!(idx < list.len(), Error::<T>::InvalidAudioIndex);
            let chosen = list[idx].clone();
            AudioCidOf::<T>::insert(id, chosen);
            Self::deposit_event(Event::AudioSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：从"私有候选"设置背景音乐（仅墓主）。
        #[pallet::call_index(59)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_audio_from_private_option())]
        pub fn set_audio_from_private_option(
            origin: OriginFor<T>,
            id: u64,
            index: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            let list = PrivateAudioOptionsOf::<T>::get(id);
            let idx = index as usize;
            ensure!(idx < list.len(), Error::<T>::InvalidAudioIndex);
            let chosen = list[idx].clone();
            AudioCidOf::<T>::insert(id, chosen);
            Self::deposit_event(Event::AudioSet { id });
            Ok(())
        }

        /// 函数级详细中文注释：维护"私有音频候选"（仅墓主）：添加。
        #[pallet::call_index(60)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::add_private_audio_option())]
        pub fn add_private_audio_option(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            PrivateAudioOptionsOf::<T>::try_mutate(id, |list| -> DispatchResult {
                list.try_push(cid)
                    .map_err(|_| Error::<T>::AudioListCapacityExceeded)?;
                Ok(())
            })?;
            Self::deposit_event(Event::PrivateAudioOptionAdded { id });
            Ok(())
        }

        /// 函数级详细中文注释：维护"私有音频候选"（仅墓主）：移除（按值匹配）。
        #[pallet::call_index(61)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove_private_audio_option())]
        pub fn remove_private_audio_option(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            PrivateAudioOptionsOf::<T>::try_mutate(id, |list| -> DispatchResult {
                if let Some(pos) = list.iter().position(|x| x == &cid) {
                    list.swap_remove(pos);
                    Ok(())
                } else {
                    Err(Error::<T>::AudioOptionNotFound.into())
                }
            })?;
            Self::deposit_event(Event::PrivateAudioOptionRemoved { id });
            Ok(())
        }

        /// 函数级详细中文注释：设置播放列表（仅墓主）。
        /// - 行为：覆盖式写入；长度不得超过 MaxAudioPlaylistLen。
        #[pallet::call_index(62)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_audio_playlist(items.len() as u32))]
        pub fn set_audio_playlist(
            origin: OriginFor<T>,
            id: u64,
            items: Vec<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_ref().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                Ok(())
            })?;
            let mut out: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxAudioPlaylistLen> =
                BoundedVec::default();
            for v in items.into_iter() {
                let bv: BoundedVec<u8, T::MaxCidLen> =
                    BoundedVec::try_from(v).map_err(|_| Error::<T>::CapacityExceeded)?;
                out.try_push(bv)
                    .map_err(|_| Error::<T>::AudioListCapacityExceeded)?;
            }
            let len = out.len() as u32;
            AudioPlaylistOf::<T>::insert(id, out);
            Self::deposit_event(Event::AudioPlaylistSet { id, len });
            Ok(())
        }

        /// 函数级详细中文注释：【治理】覆盖设置首页轮播图数据。
        /// - 参数：items 为 (img_cid, title, link?, target?, start?, end?) 的字节向量原型；
        /// - 校验：长度 ≤ MaxCarouselItems，且若设置时间窗则需 start ≤ end；
        /// - 事件：CarouselSet { len }。
        #[pallet::call_index(63)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_carousel(items.len() as u32))]
        pub fn set_carousel(
            origin: OriginFor<T>,
            items: Vec<(
                Vec<u8>,
                Vec<u8>,
                Option<Vec<u8>>,
                Option<(u8, u64)>,
                Option<BlockNumberFor<T>>,
                Option<BlockNumberFor<T>>,
            )>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let mut out: BoundedVec<CarouselItem<T>, T::MaxCarouselItems> = BoundedVec::default();
            for (img, title, link, target, start, end) in items.into_iter() {
                // 互斥校验：目标与外链不可同时存在，且至少其一存在
                let has_target = target.is_some();
                let has_link = link.is_some();
                ensure!(!(has_target && has_link), Error::<T>::InvalidKind);
                ensure!(has_target || has_link, Error::<T>::InvalidKind);
                // 时间窗：若设置则要求 start <= end
                if let (Some(s), Some(e)) = (start, end) {
                    ensure!(s <= e, Error::<T>::BadTimingWindow);
                }
                let img_bv: BoundedVec<u8, T::MaxCidLen> =
                    BoundedVec::try_from(img).map_err(|_| Error::<T>::CapacityExceeded)?;
                let title_bv: BoundedVec<u8, T::MaxTitleLen> =
                    BoundedVec::try_from(title).map_err(|_| Error::<T>::CapacityExceeded)?;
                let link_bv: Option<BoundedVec<u8, T::MaxLinkLen>> = match link {
                    Some(v) => {
                        Some(BoundedVec::try_from(v).map_err(|_| Error::<T>::CapacityExceeded)?)
                    }
                    None => None,
                };
                let item = CarouselItem::<T> {
                    img_cid: img_bv,
                    title: title_bv,
                    link: link_bv,
                    target,
                    start_block: start,
                    end_block: end,
                };
                out.try_push(item)
                    .map_err(|_| Error::<T>::CarouselIndexOOB)?;
            }
            let len = out.len() as u32;
            Carousel::<T>::put(out);
            Self::deposit_event(Event::CarouselSet { len });
            Ok(())
        }

        /// 函数级详细中文注释：设置墓位准入策略（Phase 1.5新增 - 解决P0问题2）
        /// 
        /// ### 功能
        /// - 墓主设置墓位的准入策略
        /// - 控制谁可以将逝者迁入该墓位
        /// 
        /// ### 权限
        /// - 仅墓主可调用
        /// 
        /// ### 参数
        /// - `grave_id`: 墓位ID
        /// - `policy_code`: 准入策略代码（0=OwnerOnly, 1=Public, 2=Whitelist）
        /// 
        /// ### 策略说明
        /// - **0=OwnerOnly（默认）**：仅墓主自己创建的逝者可进入
        /// - **1=Public**：任何人都可以迁入逝者
        /// - **2=Whitelist**：仅白名单中的账户可迁入
        /// 
        /// ### 使用场景
        /// - 私人墓：保持OwnerOnly（默认）
        /// - 公共墓：设置为Public
        /// - 家族墓：设置为Whitelist，然后添加家族成员
        /// 
        /// ### 事件
        /// - AdmissionPolicySet { grave_id, policy_code }
        /// 
        /// ### 注意事项
        /// - 策略变更立即生效
        /// - 不影响已存在的逝者
        /// - 仅影响新的迁入请求
        #[pallet::call_index(64)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn set_admission_policy(
            origin: OriginFor<T>,
            grave_id: u64,
            policy_code: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查墓位存在
            let grave = Graves::<T>::get(grave_id).ok_or(Error::<T>::NotFound)?;
            
            // 检查权限：仅墓主
            ensure!(who == grave.owner, Error::<T>::NotOwner);
            
            // 转换为enum
            let policy = GraveAdmissionPolicy::from_code(policy_code);
            
            // 设置策略
            AdmissionPolicyOf::<T>::insert(grave_id, policy);
            
            // 发送事件
            Self::deposit_event(Event::AdmissionPolicySet { 
                grave_id, 
                policy_code 
            });
            Ok(())
        }

        /// 函数级详细中文注释：添加到准入白名单（Phase 1.5新增）
        /// 
        /// ### 功能
        /// - 墓主将账户添加到准入白名单
        /// - 白名单账户可以迁入逝者（当策略为Whitelist时）
        /// 
        /// ### 权限
        /// - 仅墓主可调用
        /// 
        /// ### 参数
        /// - `grave_id`: 墓位ID
        /// - `who`: 要添加的账户
        /// 
        /// ### 使用场景
        /// - 家族墓：添加家族成员
        /// - 定向服务：添加合作伙伴
        /// - VIP墓位：添加授权用户
        /// 
        /// ### 事件
        /// - AddedToAdmissionWhitelist { grave_id, who }
        /// 
        /// ### 注意事项
        /// - 仅在策略为Whitelist时生效
        /// - 墓主自己无需添加（始终有权限）
        /// - 重复添加不报错（幂等操作）
        #[pallet::call_index(65)]
        #[pallet::weight(T::WeightInfo::add_admin())]
        pub fn add_to_admission_whitelist(
            origin: OriginFor<T>,
            grave_id: u64,
            who: T::AccountId,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            
            // 检查墓位存在
            let grave = Graves::<T>::get(grave_id).ok_or(Error::<T>::NotFound)?;
            
            // 检查权限：仅墓主
            ensure!(caller == grave.owner, Error::<T>::NotOwner);
            
            // 添加到白名单（幂等操作）
            AdmissionWhitelist::<T>::insert(grave_id, who.clone(), ());
            
            // 发送事件
            Self::deposit_event(Event::AddedToAdmissionWhitelist { grave_id, who });
            Ok(())
        }

        /// 函数级详细中文注释：从准入白名单移除（Phase 1.5新增）
        /// 
        /// ### 功能
        /// - 墓主将账户从准入白名单移除
        /// - 移除后该账户无法再迁入逝者
        /// 
        /// ### 权限
        /// - 仅墓主可调用
        /// 
        /// ### 参数
        /// - `grave_id`: 墓位ID
        /// - `who`: 要移除的账户
        /// 
        /// ### 使用场景
        /// - 撤销家族成员权限
        /// - 取消合作伙伴授权
        /// - 移除不再信任的用户
        /// 
        /// ### 事件
        /// - RemovedFromAdmissionWhitelist { grave_id, who }
        /// 
        /// ### 注意事项
        /// - 移除后立即生效
        /// - 不影响已存在的逝者
        /// - 账户不存在时不报错（幂等操作）
        #[pallet::call_index(66)]
        #[pallet::weight(T::WeightInfo::remove_admin())]
        pub fn remove_from_admission_whitelist(
            origin: OriginFor<T>,
            grave_id: u64,
            who: T::AccountId,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            
            // 检查墓位存在
            let grave = Graves::<T>::get(grave_id).ok_or(Error::<T>::NotFound)?;
            
            // 检查权限：仅墓主
            ensure!(caller == grave.owner, Error::<T>::NotOwner);
            
            // 从白名单移除（幂等操作）
            AdmissionWhitelist::<T>::remove(grave_id, who.clone());
            
            // 发送事件
            Self::deposit_event(Event::RemovedFromAdmissionWhitelist { grave_id, who });
            Ok(())
        }

        /// 函数级详细中文注释：设置或清除墓位的主逝者
        ///
        /// ### 业务背景
        /// - 墓位可以有多个逝者，但只能有一个"主逝者"用于前端重点展示
        /// - 现有系统依赖安葬顺序自动设置主逝者，缺乏灵活性
        /// - 此功能允许墓主主动指定哪位逝者作为主要纪念对象
        ///
        /// ### 权限验证
        /// - **墓位owner**: 完全控制权，可设置任何已安葬的逝者为主逝者
        /// - **墓位管理员**: 需要通过 can_attach 权限检查
        /// - **园区管理员**: 可以覆盖设置（管理需要）
        /// - **逝者owner**: 无法直接设置，需要通过墓位权限体系
        ///
        /// ### 业务规则
        /// 1. **存在性验证**: 被设置的逝者必须已在该墓位中安葬（检查 Interments 存储）
        /// 2. **唯一性保证**: 每个墓位最多只有一个主逝者（覆盖写入）
        /// 3. **清空支持**: 传入 None 可清除主逝者设置
        /// 4. **保持自动机制**: 不影响现有的安葬/起掘自动维护逻辑
        ///
        /// ### 使用场景
        /// - 家族墓：指定家族长者为主逝者
        /// - 夫妻合葬：指定其中一方为主展示
        /// - 纪念墓：指定最重要的纪念对象
        /// - 墓位整理：重新调整主逝者优先级
        ///
        /// ### 技术实现
        /// - 直接操作 PrimaryDeceasedOf 存储映射
        /// - 通过 can_attach 复用现有权限检查逻辑
        /// - 发出明确事件供前端监听和同步
        ///
        /// ### 参数说明
        /// - `id`: 墓位ID
        /// - `deceased_id`: 要设置为主逝者的逝者ID，传入 None 表示清除主逝者设置
        ///
        /// ### 事件
        /// - `PrimaryDeceasedSet { grave_id, deceased_id }`: 主逝者设置成功
        /// - `PrimaryDeceasedCleared { grave_id }`: 主逝者清除成功
        ///
        /// ### 错误
        /// - `NotFound`: 墓位不存在
        /// - `PermissionDenied`: 权限不足
        /// - `DeceasedNotInGrave`: 逝者不在该墓位中
        ///
        /// ### 注意事项
        /// ⚠️ **重要**：此功能不会影响逝者的实际安葬状态，仅影响主逝者标记
        /// ⚠️ **权限**：确保只有有权限的人能操作，防止恶意设置
        /// ⚠️ **前端同步**：前端需监听 PrimaryDeceasedSet/Cleared 事件及时更新UI
        #[pallet::call_index(67)]
        #[pallet::weight(T::WeightInfo::set_primary_deceased())]
        pub fn set_primary_deceased(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: Option<u64>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 1. 验证墓位存在并检查权限
            let grave = Graves::<T>::get(id).ok_or(Error::<T>::NotFound)?;

            // 2. 权限检查：墓主或管理员
            let is_owner = who == grave.owner;
            let is_admin = GraveAdmins::<T>::get(id).contains(&who);
            let is_park_admin = if let Some(park_id) = grave.park_id {
                T::ParkAdmin::ensure(park_id, OriginFor::<T>::signed(who.clone())).is_ok()
            } else {
                false
            };

            ensure!(
                is_owner || is_admin || is_park_admin,
                Error::<T>::NotAdmin
            );

            match deceased_id {
                Some(target_deceased_id) => {
                    // 设置主逝者分支

                    // 3. 验证目标逝者存在且已安葬在此墓位
                    let interments = Interments::<T>::get(id);
                    ensure!(
                        interments.iter().any(|record| record.deceased_id == target_deceased_id),
                        Error::<T>::DeceasedNotInGrave
                    );

                    // 4. 设置主逝者（覆盖写入，保证唯一性）
                    PrimaryDeceasedOf::<T>::insert(id, target_deceased_id);

                    // 5. 发出设置事件
                    Self::deposit_event(Event::PrimaryDeceasedSet {
                        grave_id: id,
                        deceased_id: target_deceased_id
                    });
                },
                None => {
                    // 清除主逝者分支

                    // 6. 清除主逝者设置
                    PrimaryDeceasedOf::<T>::remove(id);

                    // 7. 发出清除事件
                    Self::deposit_event(Event::PrimaryDeceasedCleared {
                        grave_id: id
                    });
                }
            }

            Ok(())
        }

        /// 函数级中文注释：【治理】强制转让墓地所有权（用于丢钥匙救济/纠纷裁决）。
        /// - 起源：`T::GovernanceOrigin`（Root | 内容委员会阈值(2/3)）。
        /// - 行为：不检查当前 owner，直接将 `id` 的所有权指向 `new_owner`；记录证据 CID。
        #[pallet::call_index(48)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer_grave())]
        pub fn gov_transfer_grave(
            origin: OriginFor<T>,
            id: u64,
            new_owner: T::AccountId,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid);
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                g.owner = new_owner.clone();
                Ok(())
            })?;
            Self::deposit_event(Event::GraveTransferred { id, new_owner });
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/取消限制（Moderation.restricted）。
        /// - 仅治理起源；记录证据；常用于临时下线展示或等待整改。
        #[pallet::call_index(49)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::restrict())]
        pub fn gov_set_restricted(
            origin: OriginFor<T>,
            id: u64,
            on: bool,
            reason_code: u8,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid);
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ModerationOf::<T>::mutate(id, |m| {
                m.restricted = on;
                m.reason_code = reason_code;
            });
            Self::deposit_event(Event::Restricted {
                id,
                on,
                reason_code,
            });
            Ok(())
        }

        /// 函数级中文注释：【治理】软删除墓地（Moderation.removed=true，restricted=true）。
        /// - 仅治理起源；记录证据；用于严重违规或权利人要求下线。
        #[pallet::call_index(50)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove())]
        pub fn gov_remove_grave(
            origin: OriginFor<T>,
            id: u64,
            reason_code: u8,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid);
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ModerationOf::<T>::mutate(id, |m| {
                m.removed = true;
                m.restricted = true;
                m.reason_code = reason_code;
            });
            Self::deposit_event(Event::Removed { id, reason_code });
            Ok(())
        }

        /// 函数级中文注释：【治理】恢复墓地展示（撤销 removed/restricted）。
        /// - 仅治理起源；记录证据；reason_code 置 0。
        #[pallet::call_index(51)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::restrict())]
        pub fn gov_restore_grave(
            origin: OriginFor<T>,
            id: u64,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid);
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ModerationOf::<T>::mutate(id, |m| {
                m.removed = false;
                m.restricted = false;
                m.reason_code = 0;
            });
            Self::deposit_event(Event::Restricted {
                id,
                on: false,
                reason_code: 0,
            });
            Ok(())
        }

        // 历史注释：原计划的 set_hall_params 在 pallet-memo-hall 中，但该 pallet 从未启用，已归档。

        /// 函数级中文注释：更新墓地名称/元数据/状态，允许所有者或陵园管理员。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_grave())]
        pub fn update_grave(
            origin: OriginFor<T>,
            id: u64,
            name: Option<BoundedVec<u8, T::MaxCidLen>>,
            active: Option<bool>,
            is_public: Option<bool>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id {
                        T::ParkAdmin::ensure(pid, origin.clone())?;
                    } else {
                        return Err(Error::<T>::NotAdmin.into());
                    }
                }
                if let Some(n) = name {
                    g.name = n;
                }
                if let Some(a) = active {
                    g.active = a;
                }
                if let Some(p) = is_public {
                    g.is_public = p;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::GraveUpdated { id });
            Ok(())
        }

        /// 函数级详细中文注释：转让墓地所有权（需求1：转让前必须清空）
        /// 
        /// ### 权限
        /// - 仅墓位所有者可调用
        /// 
        /// ### 前置条件（需求1核心）
        /// - **墓位必须为空**：不能有任何逝者记录
        /// - 逝者owner必须先迁移所有逝者到其他墓位
        /// 
        /// ### 功能说明
        /// - 将墓位所有权转让给新的owner
        /// - 强制墓主与逝者owner协商
        /// - 保护逝者owner权利
        /// 
        /// ### 使用场景
        /// - 墓位出售/赠送
        /// - 墓位继承
        /// - 家族墓转交
        /// 
        /// ### 流程
        /// 1. 墓主联系所有逝者owner
        /// 2. 逝者owner迁移逝者到其他墓位（使用deceased.transfer_deceased）
        /// 3. 墓位为空后，墓主可以转让
        /// 
        /// ### 注意事项
        /// ⚠️ **重要**：需求1核心设计 - 防止墓主转让导致逝者owner失控
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::transfer_grave())]
        pub fn transfer_grave(
            origin: OriginFor<T>,
            id: u64,
            new_owner: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // ⭐ 需求1核心：检查墓位是否为空（通过Interments安葬记录）
            let interments = Interments::<T>::get(id);
            ensure!(
                interments.is_empty(),
                Error::<T>::GraveNotEmpty
            );
            
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(who == g.owner, Error::<T>::NotOwner);
                g.owner = new_owner.clone();
                Ok(())
            })?;
            Self::deposit_event(Event::GraveTransferred { id, new_owner });
            Ok(())
        }

        /// 函数级中文注释：安葬逝者到墓地指定槽位（可选）。
        /// - 校验容量与重复安葬；
        /// - 触发 `OnIntermentCommitted` 供外部统计或联动。
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::inter())]
        pub fn inter(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
            slot: Option<u16>,
            note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            let now = <frame_system::Pallet<T>>::block_number();
            Graves::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id {
                        T::ParkAdmin::ensure(pid, origin.clone())?;
                    } else {
                        return Err(Error::<T>::NotAdmin.into());
                    }
                }
                let mut records = Interments::<T>::get(id);
                let use_slot = slot.unwrap_or(records.len() as u16);
                // 简化：不做重复槽校验，记录层面由上层约束（可扩展）
                records
                    .try_push(IntermentRecord::<T> {
                        deceased_id,
                        slot: use_slot,
                        time: now,
                        note_cid,
                    })
                    .map_err(|_| Error::<T>::CapacityExceeded)?;
                Interments::<T>::insert(id, records);
                // 维护主逝者：若尚未设置，则将本次安葬设为主逝者
                if !PrimaryDeceasedOf::<T>::contains_key(id) {
                    PrimaryDeceasedOf::<T>::insert(id, deceased_id);
                }
                // 函数级详细中文注释：在同一事务内更新 deceased_tokens，确保数据一致性
                // - 直接修改 g.deceased_tokens，避免事务外重复读取和写入
                // - 最多保留 6 条，先进先出（FIFO）
                if let Some(tok) = <T as Config>::DeceasedTokenProvider::token_of(deceased_id) {
                    let mut lst = g.deceased_tokens.clone();
                    if lst.len() as u32 >= 6 {
                        let _ = lst.remove(0);
                    }
                    let _ = lst.try_push(tok);
                    g.deceased_tokens = lst;
                }
                Ok(())
            })?;
            T::OnInterment::on_interment(id, deceased_id);
            Self::deposit_event(Event::Interred { id, deceased_id });
            Ok(())
        }

        /// 函数级中文注释：从墓地记录中移除某逝者（起掘）。
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::exhume())]
        pub fn exhume(origin: OriginFor<T>, id: u64, deceased_id: u64) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Graves::<T>::try_mutate_exists(id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != g.owner {
                    if let Some(pid) = g.park_id {
                        T::ParkAdmin::ensure(pid, origin.clone())?;
                    } else {
                        return Err(Error::<T>::NotAdmin.into());
                    }
                }
                let mut records = Interments::<T>::get(id);
                if let Some(pos) = records.iter().position(|r| r.deceased_id == deceased_id) {
                    records.swap_remove(pos);
                    Interments::<T>::insert(id, records);
                    // 若移除的是当前主逝者，则重选主逝者
                    if PrimaryDeceasedOf::<T>::get(id) == Some(deceased_id) {
                        let recs = Interments::<T>::get(id);
                        if recs.is_empty() {
                            PrimaryDeceasedOf::<T>::remove(id);
                        } else {
                            // 选择 slot 最小者作为新的主逝者
                            let mut best = recs[0].deceased_id;
                            let mut best_slot = recs[0].slot;
                            for r in recs.iter() {
                                if r.slot < best_slot {
                                    best = r.deceased_id;
                                    best_slot = r.slot;
                                }
                            }
                            PrimaryDeceasedOf::<T>::insert(id, best);
                        }
                    }
                    // 函数级详细中文注释：在同一事务内更新 deceased_tokens，确保数据一致性
                    // - 直接修改 g.deceased_tokens，避免事务外重复读取和写入
                    // - 若无法获取 token，保持 deceased_tokens 不变（保证数据一致性，避免错误删除）
                    if let Some(tok) = <T as Config>::DeceasedTokenProvider::token_of(deceased_id) {
                        g.deceased_tokens.retain(|t| t != &tok);
                    }
                    Ok(())
                } else {
                    Err(Error::<T>::NotFound.into())
                }
            })?;
            Self::deposit_event(Event::Exhumed { id, deceased_id });
            Ok(())
        }

        /// 函数级中文注释：设置墓地扩展元（分类/宗教）。
        #[pallet::call_index(6)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_meta())]
        pub fn set_meta(
            origin: OriginFor<T>,
            id: u64,
            categories: Option<u32>,
            religion: Option<u8>,
        ) -> DispatchResult {
            // 墓主或管理员
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) {
                    if w != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            GraveMetaOf::<T>::mutate(id, |m| {
                if let Some(c) = categories {
                    m.categories = c;
                }
                if let Some(r) = religion {
                    m.religion = r;
                }
            });
            Self::deposit_event(Event::MetaUpdated { id });
            Ok(())
        }

        /// 函数级中文注释：用户提交投诉（CID 仅指向证据，不落明文）。
        #[pallet::call_index(7)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::complain())]
        pub fn complain(
            origin: OriginFor<T>,
            id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ensure!(
                !ModerationOf::<T>::get(id).removed,
                Error::<T>::AlreadyRemoved
            );
            let now = <frame_system::Pallet<T>>::block_number();
            ComplaintsByGrave::<T>::try_mutate(id, |list| {
                list.try_push(Complaint::<T> {
                    who: who.clone(),
                    cid,
                    time: now,
                })
                .map_err(|_| Error::<T>::CapacityExceeded)
            })?;
            Self::deposit_event(Event::ComplainSubmitted { id, who });
            Ok(())
        }

        /// 函数级中文注释：园区管理员设置/取消限制。
        #[pallet::call_index(8)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::restrict())]
        pub fn restrict(
            origin: OriginFor<T>,
            id: u64,
            on: bool,
            reason_code: u8,
        ) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                if let Some(pid) = g.park_id {
                    T::ParkAdmin::ensure(pid, origin)?;
                } else {
                    return Err(Error::<T>::NotAdmin.into());
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ModerationOf::<T>::mutate(id, |m| {
                m.restricted = on;
                m.reason_code = reason_code;
            });
            Self::deposit_event(Event::Restricted {
                id,
                on,
                reason_code,
            });
            Ok(())
        }

        /// 函数级中文注释：园区管理员软删除（并自动设置限制）。
        #[pallet::call_index(9)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove())]
        pub fn remove(origin: OriginFor<T>, id: u64, reason_code: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                if let Some(pid) = g.park_id {
                    T::ParkAdmin::ensure(pid, origin)?;
                } else {
                    return Err(Error::<T>::NotAdmin.into());
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ModerationOf::<T>::mutate(id, |m| {
                m.removed = true;
                m.restricted = true;
                m.reason_code = reason_code;
            });
            Self::deposit_event(Event::Removed { id, reason_code });
            Ok(())
        }

        /// 函数级中文注释：绑定名称哈希索引（不存明文）。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_name_hash())]
        pub fn set_name_hash(origin: OriginFor<T>, id: u64, name_hash: [u8; 32]) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) {
                    if w != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            NameIndex::<T>::try_mutate(name_hash, |list| -> Result<(), Error<T>> {
                if !list.iter().any(|x| *x == id) {
                    list.try_push(id)
                        .map_err(|_| Error::<T>::CapacityExceeded)?;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::NameHashSet { id, name_hash });
            Ok(())
        }

        /// 函数级中文注释：从名称哈希索引中移除该墓地。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::clear_name_hash())]
        pub fn clear_name_hash(
            origin: OriginFor<T>,
            id: u64,
            name_hash: [u8; 32],
        ) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(w) = ensure_signed(o.clone()) {
                    if w != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            NameIndex::<T>::mutate(name_hash, |list| {
                if let Some(pos) = list.iter().position(|x| *x == id) {
                    list.swap_remove(pos);
                }
            });
            Self::deposit_event(Event::NameHashCleared { id, name_hash });
            Ok(())
        }

        /// 函数级中文注释：添加墓位管理员（不含墓主）。仅墓主或园区管理员可调用。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::add_admin())]
        pub fn add_admin(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            GraveAdmins::<T>::try_mutate(id, |list| -> Result<(), Error<T>> {
                if !list.iter().any(|x| x == &who) {
                    list.try_push(who.clone())
                        .map_err(|_| Error::<T>::CapacityExceeded)?;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::AdminAdded { id, who });
            Ok(())
        }

        /// 函数级中文注释：移除墓位管理员。仅墓主或园区管理员可调用。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove_admin())]
        pub fn remove_admin(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            GraveAdmins::<T>::mutate(id, |list| {
                if let Some(pos) = list.iter().position(|x| *x == who) {
                    list.swap_remove(pos);
                }
            });
            Self::deposit_event(Event::AdminRemoved { id, who });
            Ok(())
        }

        /// 函数级中文注释：设置加入策略（0=Open,1=Whitelist）。仅墓主或园区管理员可调用。
        #[pallet::call_index(14)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_policy())]
        pub fn set_policy(origin: OriginFor<T>, id: u64, policy: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ensure!(policy == 0 || policy == 1, Error::<T>::PolicyViolation);
            JoinPolicyOf::<T>::insert(id, policy);
            Self::deposit_event(Event::PolicyChanged { id, policy });
            Ok(())
        }

        /// 函数级中文注释：共开模式下加入成为成员。若策略非 Open 则报错。
        #[pallet::call_index(15)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::join_open())]
        pub fn join_open(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ensure!(
                JoinPolicyOf::<T>::get(id) == 0u8,
                Error::<T>::PolicyViolation
            );
            ensure!(
                !Members::<T>::contains_key(id, &who),
                Error::<T>::AlreadyMember
            );
            Members::<T>::insert(id, &who, ());
            Self::deposit_event(Event::MemberJoined { id, who });
            Ok(())
        }

        /// 函数级中文注释：私有模式申请加入（进入待审列表）。
        #[pallet::call_index(16)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::apply_join())]
        pub fn apply_join(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            ensure!(
                JoinPolicyOf::<T>::get(id) == 1u8,
                Error::<T>::PolicyViolation
            );
            ensure!(
                !Members::<T>::contains_key(id, &who),
                Error::<T>::AlreadyMember
            );
            ensure!(
                !PendingApplications::<T>::contains_key(id, &who),
                Error::<T>::AlreadyApplied
            );
            let now = <frame_system::Pallet<T>>::block_number();
            PendingApplications::<T>::insert(id, &who, now);
            Self::deposit_event(Event::MemberApplied { id, who });
            Ok(())
        }

        /// 函数级中文注释：批准某申请为成员。仅墓主或园区管理员可调用。
        #[pallet::call_index(17)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::approve_member())]
        pub fn approve_member(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ensure!(
                PendingApplications::<T>::contains_key(id, &who),
                Error::<T>::NotApplied
            );
            PendingApplications::<T>::remove(id, &who);
            Members::<T>::insert(id, &who, ());
            // 函数级中文注释：仅发送 MemberJoined 事件，避免与 MemberApproved 重复
            // - MemberJoined 已隐含"申请被批准"的语义
            // - 前端监听此事件即可获知成员加入状态
            Self::deposit_event(Event::MemberJoined { id, who });
            Ok(())
        }

        /// 函数级中文注释：拒绝某申请。仅墓主或园区管理员可调用。
        #[pallet::call_index(18)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::reject_member())]
        pub fn reject_member(origin: OriginFor<T>, id: u64, who: T::AccountId) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ensure!(
                PendingApplications::<T>::contains_key(id, &who),
                Error::<T>::NotApplied
            );
            PendingApplications::<T>::remove(id, &who);
            Self::deposit_event(Event::MemberRejected { id, who });
            Ok(())
        }

        /// 函数级详细中文注释：设置可见性策略（是否公开供奉/留言/扫墓/关注）
        #[pallet::call_index(19)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_visibility())]
        pub fn set_visibility(
            _origin: OriginFor<T>,
            _id: u64,
            _public_offering: bool,
            _public_guestbook: bool,
            _public_sweep: bool,
            _public_follow: bool,
        ) -> DispatchResult {
            Err(Error::<T>::PolicyViolation.into())
        }

        /// 函数级详细中文注释：关注墓位（已停用）。
        /// - 方案B：亲友/关注统一回归逝者维度；墓位不再承载关注功能。
        /// 函数级详细中文注释：关注墓位（纪念馆）
        ///
        /// ### 功能说明
        /// - 重新启用关注功能
        /// - 支持押金配置（可设为0）
        /// - 检查墓位公开性
        ///
        /// ### 权限要求
        /// - 墓位必须是公开的（`is_public` 为 true）
        /// - 调用者不能已经关注过
        ///
        /// ### 使用场景
        /// 1. **社交关注**：关注感兴趣的墓位/纪念馆
        /// 2. **获取动态**：接收墓位相关活动通知
        ///
        /// ### 与逝者关注的区别
        /// - **墓位关注**：关注整个墓位/家族
        /// - **逝者关注**：关注特定逝者
        ///
        /// ### 参数
        /// - `id`: 墓位ID
        ///
        /// ### 错误
        /// - `NotFound`: 墓位不存在
        /// - `PolicyViolation`: 墓位不公开或已关注
        ///
        /// ### 事件
        /// - `Followed`: 关注成功
        #[pallet::call_index(20)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::follow())]
        pub fn follow(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查墓位存在
            let grave = Graves::<T>::get(id).ok_or(Error::<T>::NotFound)?;

            // 检查是否公开
            ensure!(grave.is_public, Error::<T>::PolicyViolation);

            // 检查是否已关注
            ensure!(
                !IsFollower::<T>::contains_key(id, &who),
                Error::<T>::PolicyViolation  // 已关注
            );

            // 检查冷却时间
            let now = <frame_system::Pallet<T>>::block_number();
            if let Some(last_action) = LastFollowAction::<T>::get(id, &who) {
                let cooldown = T::FollowCooldownBlocks::get().into();
                ensure!(
                    now >= last_action.saturating_add(cooldown),
                    Error::<T>::PolicyViolation
                );
            }

            // 处理押金(如果设置)
            let deposit = T::FollowDeposit::get();
            if !deposit.is_zero() {
                T::Currency::reserve(&who, deposit)
                    .map_err(|_| Error::<T>::DepositFailed)?;
            }

            // 添加到关注列表
            FollowersOf::<T>::try_mutate(id, |list| -> DispatchResult {
                list.try_push(who.clone())
                    .map_err(|_| Error::<T>::CapacityExceeded)?;
                Ok(())
            })?;

            IsFollower::<T>::insert(id, &who, ());
            LastFollowAction::<T>::insert(id, &who, now);

            Self::deposit_event(Event::Followed { id, who });
            Ok(())
        }

        /// 函数级详细中文注释：取消关注墓位
        ///
        /// ### 功能说明
        /// - 用户可以随时取消关注
        /// - 退还押金(如果有)
        ///
        /// ### 参数
        /// - `id`: 墓位ID
        ///
        /// ### 错误
        /// - `PolicyViolation`: 未关注该墓位
        ///
        /// ### 事件
        /// - `Unfollowed`: 取消关注成功
        #[pallet::call_index(21)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::unfollow())]
        pub fn unfollow(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查是否已关注
            ensure!(
                IsFollower::<T>::contains_key(id, &who),
                Error::<T>::PolicyViolation  // 未关注
            );

            // 检查冷却时间
            let now = <frame_system::Pallet<T>>::block_number();
            if let Some(last_action) = LastFollowAction::<T>::get(id, &who) {
                let cooldown = T::FollowCooldownBlocks::get().into();
                ensure!(
                    now >= last_action.saturating_add(cooldown),
                    Error::<T>::PolicyViolation
                );
            }

            // 退还押金(如果有)
            let deposit = T::FollowDeposit::get();
            if !deposit.is_zero() {
                T::Currency::unreserve(&who, deposit);
            }

            // 从关注列表移除
            FollowersOf::<T>::mutate(id, |list| {
                if let Some(pos) = list.iter().position(|x| x == &who) {
                    list.swap_remove(pos);
                }
            });

            IsFollower::<T>::remove(id, &who);
            LastFollowAction::<T>::insert(id, &who, now);

            Self::deposit_event(Event::Unfollowed { id, who });
            Ok(())
        }

        /// 函数级中文注释：领取旧关注押金（方案B迁移退款口）。
        /// - 若账户在迁移时被统计到了旧关注押金余额，则可在此一次性解除保留押金；领取后记录被删除。
        #[pallet::call_index(40)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::unfollow())]
        pub fn claim_legacy_follow_refund(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            if let Some(amt) = LegacyFollowRefunds::<T>::take(&who) {
                if !amt.is_zero() {
                    T::Currency::unreserve(&who, amt);
                }
                Ok(())
            } else {
                Err(Error::<T>::NotApplied.into())
            }
        }

        /// 函数级中文注释：设置亲属关系策略（0=Auto,1=Approve）。
        #[pallet::call_index(22)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::set_kinship_policy())]
        pub fn set_kinship_policy(origin: OriginFor<T>, id: u64, policy: u8) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ensure!(policy == 0 || policy == 1, Error::<T>::PolicyViolation);
            KinshipPolicyOf::<T>::insert(id, policy);
            Self::deposit_event(Event::KinshipPolicyChanged { id, policy });
            Ok(())
        }

        /// 函数级中文注释：成员声明与某逝者的亲属关系。
        /// - 若策略为 Auto：记录 verified=true；若为 Approve：verified=false 待审。
        #[pallet::call_index(23)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::declare_kinship())]
        pub fn declare_kinship(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
            code: u8,
            note: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 函数级详细中文注释：调整检查顺序，避免信息泄露
            // 1. 先检查墓地是否存在
            // 2. 再检查逝者是否在墓地中
            // 3. 最后检查成员身份
            // 这样可以防止攻击者通过错误类型判断某个逝者是否在某个墓地
            ensure!(Graves::<T>::contains_key(id), Error::<T>::NotFound);
            // 校验逝者属于该墓位（读取 Interments 记录）
            let in_this_grave = Interments::<T>::get(id)
                .iter()
                .any(|r| r.deceased_id == deceased_id);
            ensure!(in_this_grave, Error::<T>::NotFound);
            // 检查成员身份（放在最后，避免泄露墓地/逝者信息）
            ensure!(Members::<T>::contains_key(id, &who), Error::<T>::NotMember);
            ensure!(
                !KinshipOf::<T>::contains_key(id, (deceased_id, who.clone())),
                Error::<T>::KinshipExists
            );
            let nv: BoundedVec<_, T::MaxCidLen> = match note {
                Some(v) => BoundedVec::try_from(v).map_err(|_| Error::<T>::CapacityExceeded)?,
                None => Default::default(),
            };
            let now = <frame_system::Pallet<T>>::block_number();
            let policy = KinshipPolicyOf::<T>::get(id);
            let rec = KinshipRecord::<T> {
                code,
                note: nv,
                verified: policy == 0,
                time: now,
            };
            KinshipOf::<T>::insert(id, (deceased_id, who.clone()), rec);
            // 索引
            KinshipIndexByMember::<T>::try_mutate(who.clone(), id, |list| {
                list.try_push((deceased_id, code))
                    .map_err(|_| Error::<T>::CapacityExceeded)
            })?;
            Self::deposit_event(Event::KinshipDeclared {
                id,
                deceased_id,
                who,
                code,
            });
            Ok(())
        }

        /// 函数级中文注释：批准成员与逝者关系（仅墓主/园区管理员）。
        #[pallet::call_index(24)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::approve_kinship())]
        pub fn approve_kinship(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
        ) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            KinshipOf::<T>::try_mutate(
                id,
                (deceased_id, who.clone()),
                |maybe| -> DispatchResult {
                    let r = maybe.as_mut().ok_or(Error::<T>::KinshipNotFound)?;
                    r.verified = true;
                    Ok(())
                },
            )?;
            Self::deposit_event(Event::KinshipApproved {
                id,
                deceased_id,
                who,
            });
            Ok(())
        }

        /// 函数级中文注释：拒绝成员与逝者关系（仅墓主/园区管理员）。
        #[pallet::call_index(25)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::reject_kinship())]
        pub fn reject_kinship(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
        ) -> DispatchResult {
            if let Some(g) = Graves::<T>::get(id) {
                let o = origin.clone();
                if let Ok(sender) = ensure_signed(o) {
                    if sender != g.owner {
                        if let Some(pid) = g.park_id {
                            T::ParkAdmin::ensure(pid, origin)?;
                        } else {
                            return Err(Error::<T>::NotAdmin.into());
                        }
                    }
                }
            } else {
                return Err(Error::<T>::NotFound.into());
            }
            ensure!(
                KinshipOf::<T>::contains_key(id, (deceased_id, who.clone())),
                Error::<T>::KinshipNotFound
            );
            KinshipOf::<T>::remove(id, (deceased_id, who.clone()));
            // 索引同步删除
            KinshipIndexByMember::<T>::mutate(who.clone(), id, |list| {
                if let Some(p) = list.iter().position(|(d, _)| *d == deceased_id) {
                    list.swap_remove(p);
                }
            });
            Self::deposit_event(Event::KinshipRejected {
                id,
                deceased_id,
                who,
            });
            Ok(())
        }

        /// 函数级中文注释：成员更新自身与逝者关系（code/note）。Approve 策略下将重置 verified=false 待审。
        #[pallet::call_index(26)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::update_kinship())]
        pub fn update_kinship(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
            code: Option<u8>,
            note: Option<Vec<u8>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            KinshipOf::<T>::try_mutate(
                id,
                (deceased_id, who.clone()),
                |maybe| -> DispatchResult {
                    let r = maybe.as_mut().ok_or(Error::<T>::KinshipNotFound)?;
                    if let Some(c) = code {
                        r.code = c;
                    }
                    if let Some(nv) = note {
                        r.note =
                            BoundedVec::try_from(nv).map_err(|_| Error::<T>::CapacityExceeded)?;
                    }
                    // 重置审核
                    let policy = KinshipPolicyOf::<T>::get(id);
                    r.verified = policy == 0;
                    Ok(())
                },
            )?;
            // 更新成员索引中的 code
            KinshipIndexByMember::<T>::mutate(who.clone(), id, |list| {
                if let Some(p) = list.iter_mut().position(|(d, _)| *d == deceased_id) {
                    list[p].1 = code.unwrap_or(list[p].1);
                }
            });
            Self::deposit_event(Event::KinshipUpdated {
                id,
                deceased_id,
                who,
                code: code.unwrap_or_default(),
            });
            Ok(())
        }

        /// 函数级中文注释：成员自撤或管理员撤销亲属关系。
        #[pallet::call_index(27)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::remove_kinship())]
        pub fn remove_kinship(
            origin: OriginFor<T>,
            id: u64,
            deceased_id: u64,
            who: T::AccountId,
        ) -> DispatchResult {
            let sender = ensure_signed(origin.clone())?;
            let can_admin = if let Some(g) = Graves::<T>::get(id) {
                if sender == g.owner {
                    true
                } else {
                    if let Some(pid) = g.park_id {
                        T::ParkAdmin::ensure(pid, origin).is_ok()
                    } else {
                        false
                    }
                }
            } else {
                false
            };
            ensure!(sender == who || can_admin, Error::<T>::NotAdmin);
            ensure!(
                KinshipOf::<T>::contains_key(id, (deceased_id, who.clone())),
                Error::<T>::KinshipNotFound
            );
            KinshipOf::<T>::remove(id, (deceased_id, who.clone()));
            KinshipIndexByMember::<T>::mutate(who.clone(), id, |list| {
                if let Some(p) = list.iter().position(|(d, _)| *d == deceased_id) {
                    list.swap_remove(p);
                }
            });
            Self::deposit_event(Event::KinshipRemoved {
                id,
                deceased_id,
                who,
            });
            Ok(())
        }
    }

    // =================== Phase 1.5: 内部同步函数（供deceased pallet调用）===================
    
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：内部安葬记录函数（Phase 1.5新增）
        /// 
        /// ### 功能
        /// - 将逝者记录到Interments存储
        /// - 同步deceased pallet的create/transfer操作
        /// - 不检查权限（权限已在deceased pallet检查）
        /// - 不触发OnInterment钩子（避免重复触发）
        /// 
        /// ### 调用者
        /// - runtime::GraveProviderAdapter::record_interment
        /// - 由deceased::create_deceased间接调用
        /// - 由deceased::transfer_deceased间接调用
        /// 
        /// ### 参数
        /// - `grave_id`: 墓位ID
        /// - `deceased_id`: 逝者ID
        /// - `slot`: 槽位（可选，None时自动分配）
        /// - `note_cid`: 备注CID（可选）
        /// 
        /// ### 容量检查
        /// - 容量已在deceased pallet检查（通过BoundedVec）
        /// - 本函数不重复检查，直接记录
        /// 
        /// ### 错误处理
        /// - NotFound: 墓位不存在
        /// - CapacityExceeded: 容量已满（理论上不会发生）
        /// 
        /// ### 注意事项
        /// ⚠️ **重要**：本函数为内部函数，仅供GraveInspector trait调用
        /// ⚠️ 不要从外部直接调用，权限检查会被绕过
        pub fn do_inter_internal(
            grave_id: u64,
            deceased_id: u64,
            slot: Option<u16>,
            note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
        ) -> DispatchResult {
            let now = <frame_system::Pallet<T>>::block_number();
            
            Graves::<T>::try_mutate(grave_id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                
                let mut records = Interments::<T>::get(grave_id);
                let use_slot = slot.unwrap_or(records.len() as u16);
                
                // 记录安葬
                records
                    .try_push(IntermentRecord::<T> {
                        deceased_id,
                        slot: use_slot,
                        time: now,
                        note_cid,
                    })
                    .map_err(|_| Error::<T>::CapacityExceeded)?;
                
                Interments::<T>::insert(grave_id, records);
                
                // 维护主逝者：若尚未设置，则将本次安葬设为主逝者
                if !PrimaryDeceasedOf::<T>::contains_key(grave_id) {
                    PrimaryDeceasedOf::<T>::insert(grave_id, deceased_id);
                }
                
                // 更新 deceased_tokens（与原inter逻辑一致）
                if let Some(tok) = <T as Config>::DeceasedTokenProvider::token_of(deceased_id) {
                    let mut lst = g.deceased_tokens.clone();
                    if lst.len() as u32 >= 6 {
                        let _ = lst.remove(0);
                    }
                    let _ = lst.try_push(tok);
                    g.deceased_tokens = lst;
                }
                
                Ok(())
            })?;
            
            // ⚠️ 注意：不触发OnInterment钩子，避免重复触发
            // 原因：deceased pallet已经处理了业务逻辑
            
            // 发送事件（用于审计）
            Self::deposit_event(Event::Interred { id: grave_id, deceased_id });
            Ok(())
        }
        
        /// 函数级详细中文注释：内部起掘记录函数（Phase 1.5新增）
        /// 
        /// ### 功能
        /// - 从Interments存储中移除逝者记录
        /// - 同步deceased pallet的transfer操作
        /// - 不检查权限（权限已在deceased pallet检查）
        /// 
        /// ### 调用者
        /// - runtime::GraveProviderAdapter::record_exhumation
        /// - 由deceased::transfer_deceased间接调用
        /// 
        /// ### 参数
        /// - `grave_id`: 墓位ID
        /// - `deceased_id`: 逝者ID
        /// 
        /// ### 幂等性
        /// - 如果记录不存在，不报错（幂等操作）
        /// - 确保即使多次调用也不会出错
        /// 
        /// ### 主逝者处理
        /// - 如果移除的是主逝者，清空PrimaryDeceasedOf
        /// 
        /// ### 注意事项
        /// ⚠️ **重要**：本函数为内部函数，仅供GraveInspector trait调用
        /// ⚠️ 不要从外部直接调用，权限检查会被绕过
        pub fn do_exhume_internal(
            grave_id: u64,
            deceased_id: u64,
        ) -> DispatchResult {
            Graves::<T>::try_mutate_exists(grave_id, |maybe| -> DispatchResult {
                let g = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                
                // 从Interments移除记录
                let mut records = Interments::<T>::get(grave_id);
                if let Some(pos) = records.iter().position(|r| r.deceased_id == deceased_id) {
                    records.swap_remove(pos);
                    Interments::<T>::insert(grave_id, records);
                }
                // ⚠️ 如果记录不存在，不报错（幂等）
                
                // 更新 deceased_tokens（移除对应token）
                if let Some(tok) = <T as Config>::DeceasedTokenProvider::token_of(deceased_id) {
                    let mut lst = g.deceased_tokens.clone();
                    if let Some(p) = lst.iter().position(|t| t == &tok) {
                        lst.remove(p);
                    }
                    g.deceased_tokens = lst;
                }
                
                // 如果移除的是主逝者，清空主逝者标记
                if PrimaryDeceasedOf::<T>::get(grave_id) == Some(deceased_id) {
                    PrimaryDeceasedOf::<T>::remove(grave_id);
                }
                
                Ok(())
            })?;
            
            // 发送事件（用于审计）
            Self::deposit_event(Event::Exhumed { id: grave_id, deceased_id });
            Ok(())
        }

        /// 函数级中文注释：获取墓位的主逝者ID
        ///
        /// ### 功能说明
        /// - 查询指定墓位当前设置的主逝者
        /// - 不验证逝者是否仍存在于墓位中（起掘后可能不同步）
        ///
        /// ### 参数
        /// - `grave_id`: 墓位ID
        ///
        /// ### 返回值
        /// - `Some(deceased_id)`: 主逝者ID
        /// - `None`: 未设置主逝者
        ///
        /// ### 使用场景
        /// - 前端查询墓位主逝者进行展示
        /// - 后端业务逻辑判断主逝者状态
        /// - RPC 接口提供给 dApp 调用
        pub fn primary_deceased_of(grave_id: u64) -> Option<u64> {
            PrimaryDeceasedOf::<T>::get(grave_id)
        }

        /// 函数级中文注释：检查指定逝者是否为墓位的主逝者
        ///
        /// ### 功能说明
        /// - 快速判断某个逝者是否被设置为指定墓位的主逝者
        /// - 避免前端需要先查询主逝者ID再比较的两步操作
        ///
        /// ### 参数
        /// - `grave_id`: 墓位ID
        /// - `deceased_id`: 逝者ID
        ///
        /// ### 返回值
        /// - `true`: 该逝者是主逝者
        /// - `false`: 该逝者不是主逝者或未设置主逝者
        ///
        /// ### 使用场景
        /// - 前端UI中显示主逝者标识
        /// - 批量查询逝者列表时的优化
        /// - 业务逻辑中的条件判断
        pub fn is_primary_deceased(grave_id: u64, deceased_id: u64) -> bool {
            Self::primary_deceased_of(grave_id) == Some(deceased_id)
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：运行时升级钩子。
        /// - 旧版 `Grave` 的 `park_id` 为 `u64`，新版改为 `Option<u64>`；
        /// - 迁移时将旧值封装为 `Some(park_id)`；
        /// - `GravesByPark` 无需迁移（键仍为 `u64`），事件无需回溯。
        fn on_runtime_upgrade() -> Weight {
            let mut weight: Weight = Weight::zero();
            // 使用新版 API：in_code_storage_version 代替已弃用的 current_storage_version
            let current = Pallet::<T>::in_code_storage_version();
            if current < 3 {
                // 旧结构定义：仅用于迁移期 decode
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldGrave<TC: Config> {
                    /// 函数级中文注释：旧版园区 ID，必填（u64）。
                    park_id: u64,
                    owner: TC::AccountId,
                    admin_group: Option<u64>,
                    kind_code: u8,
                    capacity: u16,
                    metadata_cid: BoundedVec<u8, TC::MaxCidLen>,
                    active: bool,
                }

                let mut migrated: u64 = 0;
                // 将旧值转换为新值
                Graves::<T>::translate(|_key, old: OldGrave<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Grave::<T> {
                        park_id: Some(old.park_id),
                        owner: old.owner,
                        admin_group: old.admin_group,
                        name: BoundedVec::<u8, T::MaxCidLen>::default(),
                        deceased_tokens: BoundedVec::default(),
                        is_public: true,
                        active: old.active,
                    })
                });
                STORAGE_VERSION.put::<Pallet<T>>();
                // 简化：估算权重 = 常数 + 每条迁移成本（此处返回迁移项数）
                weight = weight.saturating_add(Weight::from_parts(1_000, 0));
                weight = weight.saturating_add(Weight::from_parts(
                    migrated.saturating_mul(10_000) as u64,
                    0,
                ));
            }
            // v4 -> v5：删除 kind_code/capacity，新增 name 字段，默认置空
            if current < 5 {
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldV4<TC: Config> {
                    park_id: Option<u64>,
                    owner: TC::AccountId,
                    admin_group: Option<u64>,
                    kind_code: u8,
                    capacity: u16,
                    metadata_cid: BoundedVec<u8, TC::MaxCidLen>,
                    active: bool,
                }
                let mut migrated: u64 = 0;
                Graves::<T>::translate(|_k, old: OldV4<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Grave::<T> {
                        park_id: old.park_id,
                        owner: old.owner,
                        admin_group: old.admin_group,
                        name: BoundedVec::<u8, T::MaxCidLen>::default(),
                        deceased_tokens: BoundedVec::default(),
                        is_public: true,
                        active: old.active,
                    })
                });
                STORAGE_VERSION.put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(1_000, 0));
                weight = weight.saturating_add(Weight::from_parts(
                    migrated.saturating_mul(10_000) as u64,
                    0,
                ));
            }
            if current < 6 {
                // v5 -> v6：移除 metadata_cid 字段
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldV5<TC: Config> {
                    park_id: Option<u64>,
                    owner: TC::AccountId,
                    admin_group: Option<u64>,
                    name: BoundedVec<u8, TC::MaxCidLen>,
                    metadata_cid: BoundedVec<u8, TC::MaxCidLen>,
                    active: bool,
                }
                let mut migrated: u64 = 0;
                Graves::<T>::translate(|_k, old: OldV5<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Grave::<T> {
                        park_id: old.park_id,
                        owner: old.owner,
                        admin_group: old.admin_group,
                        name: old.name,
                        deceased_tokens: BoundedVec::default(),
                        is_public: true,
                        active: old.active,
                    })
                });
                STORAGE_VERSION.put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(1_000, 0));
                weight = weight.saturating_add(Weight::from_parts(
                    migrated.saturating_mul(10_000) as u64,
                    0,
                ));
            }
            if current < 8 {
                // v7 -> v8：新增 is_public 字段，默认 true
                #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
                #[scale_info(skip_type_params(T))]
                struct OldV7<TC: Config> {
                    park_id: Option<u64>,
                    owner: TC::AccountId,
                    admin_group: Option<u64>,
                    name: BoundedVec<u8, TC::MaxCidLen>,
                    deceased_tokens: BoundedVec<BoundedVec<u8, TC::MaxCidLen>, ConstU32<6>>,
                    active: bool,
                }
                let mut migrated: u64 = 0;
                Graves::<T>::translate(|_k, old: OldV7<T>| {
                    migrated = migrated.saturating_add(1);
                    Some(Grave::<T> {
                        park_id: old.park_id,
                        owner: old.owner,
                        admin_group: old.admin_group,
                        name: old.name,
                        deceased_tokens: old.deceased_tokens,
                        is_public: true,
                        active: old.active,
                    })
                });
                STORAGE_VERSION.put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(1_000, 0));
                weight = weight.saturating_add(Weight::from_parts(
                    migrated.saturating_mul(10_000) as u64,
                    0,
                ));
            }
            // v9 -> v10：方案B迁移——统计旧关注押金余额
            if current < 10 {
                let mut sum: BalanceOf<T> = Zero::zero();
                // 估算总额：按账户统计每账户关注次数×FollowDeposit，写入 LegacyFollowRefunds
                let dep = T::FollowDeposit::get();
                if !dep.is_zero() {
                    let mut acc: BTreeMap<T::AccountId, u32> = BTreeMap::new();
                    IsFollower::<T>::iter().for_each(|(_gid, who, _)| {
                        *acc.entry(who).or_insert(0) += 1;
                    });
                    for (who, n) in acc.into_iter() {
                        let mut amt = dep;
                        for _ in 0..n {
                            amt = amt.saturating_add(dep);
                        }
                        if amt > Zero::zero() {
                            LegacyFollowRefunds::<T>::insert(&who, amt);
                            sum = sum.saturating_add(amt);
                        }
                    }
                }
                STORAGE_VERSION.put::<Pallet<T>>();
                weight = weight.saturating_add(Weight::from_parts(1_000, 0));
            }
            weight
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：生成唯一的 10 位数字 Slug。
        /// - 基于 (id, who, block_number) 的 blake2 哈希映射为 10 位数字；
        /// - 若冲突则尝试多次（最多 10 次），最终回退为 id 左填充 0 的 10 位。
        pub fn gen_unique_slug(
            id: u64,
            who: &T::AccountId,
        ) -> Result<BoundedVec<u8, T::SlugLen>, Error<T>> {
            let mut try_idx: u8 = 0;
            while try_idx < 10 {
                let now = <frame_system::Pallet<T>>::block_number().saturated_into::<u64>();
                let mut seed = [0u8; 32];
                let enc = (id, who, now, try_idx);
                seed.copy_from_slice(&sp_core::blake2_256(&enc.encode()));
                let mut digits: [u8; 10] = [0; 10];
                for i in 0..10 {
                    digits[i] = b'0' + (seed[i] % 10);
                }
                let v: Vec<u8> = digits.to_vec();
                if let Ok(bv) = BoundedVec::<u8, T::SlugLen>::try_from(v.clone()) {
                    if !GraveBySlug::<T>::contains_key(&bv) {
                        return Ok(bv);
                    }
                }
                try_idx = try_idx.saturating_add(1);
            }
            // 回退：id 左填充 0 至 10 位
            let s = alloc::format!("{:010}", id);
            let bv = BoundedVec::<u8, T::SlugLen>::try_from(s.into_bytes())
                .map_err(|_| Error::<T>::InvalidSlug)?;
            if GraveBySlug::<T>::contains_key(&bv) {
                return Err(Error::<T>::SlugExists);
            }
            Ok(bv)
        }

        /// 函数级详细中文注释：检查某账户是否为成员。
        pub fn is_member(id: u64, who: &T::AccountId) -> bool {
            Members::<T>::contains_key(id, who)
        }

        /// 函数级中文注释（内部工具）：记录治理证据 CID（明文），返回有界向量。
        pub(crate) fn note_evidence(
            scope: u8,
            key: u64,
            cid: Vec<u8>,
        ) -> Result<BoundedVec<u8, T::MaxCidLen>, DispatchError> {
            let bv: BoundedVec<u8, T::MaxCidLen> =
                BoundedVec::try_from(cid).map_err(|_| DispatchError::Other("BadInput"))?;
            Self::deposit_event(Event::GovEvidenceNoted(scope, key, bv.clone()));
            Ok(bv)
        }

        /// 函数级中文注释：统一治理起源校验辅助，确保 BadOrigin 映射为模块级 NotAdmin 错误。
        #[inline]
        pub(crate) fn ensure_gov(origin: OriginFor<T>) -> Result<(), Error<T>> {
            T::GovernanceOrigin::ensure_origin(origin)
                .map(|_| ())
                .map_err(|_| Error::<T>::NotAdmin)
        }

        /// 函数级详细中文注释：检查准入策略（Phase 1.5新增 - 解决P0问题2）
        /// 
        /// ### 功能
        /// - 检查调用者是否有权限将逝者迁入目标墓位
        /// - 根据墓位的准入策略进行判断
        /// 
        /// ### 参数
        /// - `who`: 调用者账户（逝者owner）
        /// - `grave_id`: 目标墓位ID
        /// 
        /// ### 策略逻辑
        /// - **OwnerOnly（默认）**：仅墓主可以迁入 → 检查who == grave.owner
        /// - **Public**：任何人都可以迁入 → 总是返回Ok
        /// - **Whitelist**：仅白名单可以迁入 → 检查墓主或白名单
        /// 
        /// ### 返回值
        /// - `Ok(())`: 允许迁入
        /// - `Err(Error::<T>::AdmissionDenied)`: 拒绝迁入
        /// - `Err(Error::<T>::NotFound)`: 墓位不存在
        /// 
        /// ### 调用者
        /// - runtime::GraveProviderAdapter::check_admission_policy
        /// - deceased::transfer_deceased调用trait方法
        /// 
        /// ### 注意事项
        /// - 墓主始终可以迁入（不受策略限制）
        /// - 策略仅影响新的迁入请求
        /// - 不检查墓位容量（容量在deceased pallet检查）
        pub fn check_admission_policy(
            who: &T::AccountId,
            grave_id: u64,
        ) -> Result<(), Error<T>> {
            // 检查墓位存在
            let grave = Graves::<T>::get(grave_id).ok_or(Error::<T>::NotFound)?;
            
            // 墓主始终可以迁入（绕过策略）
            if *who == grave.owner {
                return Ok(());
            }
            
            // 获取准入策略（默认OwnerOnly）
            let policy = AdmissionPolicyOf::<T>::get(grave_id);
            
            match policy {
                GraveAdmissionPolicy::OwnerOnly => {
                    // 仅墓主可以迁入
                    // 已经在上面检查过，走到这里说明不是墓主
                    Err(Error::<T>::AdmissionDenied)
                },
                GraveAdmissionPolicy::Public => {
                    // 公开墓位，任何人都可以迁入
                    Ok(())
                },
                GraveAdmissionPolicy::Whitelist => {
                    // 白名单模式
                    // 检查是否在白名单中
                    if AdmissionWhitelist::<T>::contains_key(grave_id, who) {
                        Ok(())
                    } else {
                        Err(Error::<T>::AdmissionDenied)
                    }
                },
            }
        }
    }
}
