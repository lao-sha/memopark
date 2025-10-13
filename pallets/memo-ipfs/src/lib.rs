#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`（RuntimeEvent/常量权重），后续基准权重接入后移除
#![allow(deprecated)]

extern crate alloc;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, Get, ReservableCurrency},
    BoundedVec,
};
use frame_system::pallet_prelude::*;
// （已下线）移除对 memo-endowment 的接口依赖
use alloc::string::String;
use codec::Encode;
use serde_json::Value as JsonValue;
use sp_core::crypto::KeyTypeId;
use sp_runtime::{
    offchain::{http, StorageKind},
    traits::AtLeast32BitUnsigned,
};
use sp_std::{str, vec::Vec};

/// 函数级详细中文注释：逝者 owner 只读提供者（低耦合）。
/// - 由 runtime 注入实现，通常从 pallet-deceased 读取 owner 字段。
pub trait OwnerProvider<AccountId> {
    /// 返回 subject(owner)；None 表示 subject 不存在。
    fn owner_of(subject_id: u64) -> Option<AccountId>;
}

/// 专用 Offchain 签名 KeyType。注意：需要在节点端注册对应密钥。
pub const KEY_TYPE: KeyTypeId = KeyTypeId(*b"ipfs");

/// 函数级详细中文注释：OCW 专用签名算法类型
/// - 使用 sr25519 作为默认曲线；
/// - 节点 keystore 中通过 `--key` 或 RPC 注入该类型的密钥；
pub mod sr25519_app {
    use super::KEY_TYPE;
    use sp_application_crypto::{app_crypto, sr25519};
    app_crypto!(sr25519, KEY_TYPE);
}

pub type AuthorityId = sr25519_app::Public;

/// 函数级详细中文注释：IPFS自动pin接口，供其他pallet调用实现内容自动固定
/// 
/// 设计目标：
/// - 为各业务pallet（deceased/media/text/evidence/grave）提供统一的pin接口；
/// - 自动使用triple-charge机制扣费（IpfsPoolAccount → SubjectFunding → Caller）；
/// - 支持逝者维度和墓位维度的CID固定。
/// 
/// 使用方式：
/// ```rust
/// // 在业务pallet的Config中添加：
/// type IpfsPinner: IpfsPinner<Self::AccountId, Self::Balance>;
/// 
/// // 在extrinsic中调用：
/// T::IpfsPinner::pin_cid_for_deceased(
///     who.clone(),
///     deceased_id,
///     cid,
///     price,
///     3, // replicas
/// )?;
/// ```
pub trait IpfsPinner<AccountId, Balance> {
    /// 函数级详细中文注释：为逝者关联的CID发起pin请求
    /// 
    /// 参数：
    /// - `caller`: 发起调用的账户（用于fallback扣款，triple-charge的第3层）
    /// - `deceased_id`: 逝者ID（用于派生SubjectFunding账户）
    /// - `cid`: IPFS CID（Vec<u8>格式）
    /// - `price`: 存储单价（每副本每月，单位为Balance最小单位）
    /// - `replicas`: 副本数（建议3，范围1-5）
    /// 
    /// 返回：
    /// - `Ok(())`: pin请求成功提交，费用扣取成功
    /// - `Err(...)`: 失败原因（余额不足、CID格式错误、系统错误等）
    /// 
    /// 扣费机制（triple-charge）：
    /// 1. 优先从 `IpfsPoolAccount` 扣取（有月度quota限制）
    /// 2. 如失败，从 `SubjectFunding(deceased_id)` 扣取
    /// 3. 如仍失败，从 `caller` 账户扣取（兜底）
    /// 4. 所有费用流向 `OperatorEscrowAccount`（运营者托管）
    fn pin_cid_for_deceased(
        caller: AccountId,
        deceased_id: u64,
        cid: Vec<u8>,
        price: Balance,
        replicas: u32,
    ) -> DispatchResult;

    /// 函数级详细中文注释：为墓位关联的CID发起pin请求
    /// 
    /// 参数：
    /// - `caller`: 发起调用的账户
    /// - `grave_id`: 墓位ID（用于派生特定的SubjectFunding账户）
    /// - `cid`: IPFS CID
    /// - `price`: 存储单价
    /// - `replicas`: 副本数
    /// 
    /// 适用场景：
    /// - 墓位封面图（pallet-memo-grave::set_cover）
    /// - 墓位背景音乐（pallet-memo-grave::set_audio）
    /// - 墓位播放列表（pallet-memo-grave::set_audio_playlist）
    /// 
    /// 注意：墓位维度的SubjectFunding派生方式可能与逝者维度不同，
    /// 具体由实现方决定（建议使用 `b"grave"` 作为domain前缀）。
    fn pin_cid_for_grave(
        caller: AccountId,
        grave_id: u64,
        cid: Vec<u8>,
        price: Balance,
        replicas: u32,
    ) -> DispatchResult;
}

// 函数级中文注释：将 pallet 模块内导出的类型（如 Pallet、Call、Event 等）在 crate 根进行再导出
// 作用：
// 1) 让 runtime 集成宏（#[frame_support::runtime]）能够找到 `tt_default_parts_v2` 等默认部件；
// 2) 便于上层以 `pallet_memo_ipfs::Call` 等简洁路径引用类型，降低路径耦合。
pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::ConstU32;
    use frame_support::traits::StorageVersion;
    use sp_runtime::traits::Saturating;
    use sp_runtime::SaturatedConversion;
    // 已移除签名交易上报，避免对 CreateSignedTransaction 约束
    use alloc::string::ToString;
    use frame_support::traits::tokens::Imbalance;
    use frame_support::PalletId;
    use sp_runtime::traits::AccountIdConversion;

    /// 余额别名
    pub type BalanceOf<T> = <T as Config>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 货币接口（用于预留押金或扣费）
        type Currency: Currency<Self::AccountId, Balance = Self::Balance>
            + ReservableCurrency<Self::AccountId>;
        /// 余额类型
        type Balance: Parameter + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

        /// 资金接收账户解析器（例如 Treasury 或平台账户），用于收取一次性费用与周期扣费。
        type FeeCollector: sp_core::Get<Self::AccountId>;

        /// 治理 Origin（用于参数/黑名单/配额）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        // 已移除：OCW 签名标识（当前版本不从 OCW 发送签名交易）

        /// 最大支持的 `cid_hash` 长度（字节）
        #[pallet::constant]
        type MaxCidHashLen: Get<u32>;

        /// 最大支持的 PeerId 字节长度（Base58 文本或多地址指纹摘要）
        #[pallet::constant]
        type MaxPeerIdLen: Get<u32>;

        /// 最小运营者保证金（MEMO 最小单位）
        #[pallet::constant]
        type MinOperatorBond: Get<Self::Balance>;

        /// 最小可宣告容量（GiB）
        #[pallet::constant]
        type MinCapacityGiB: Get<u32>;

        /// 权重信息占位
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：派生“主题资金账户”的 PalletId（creator+subject_id 派生稳定地址）
        #[pallet::constant]
        type SubjectPalletId: Get<PalletId>;

        /// 函数级中文注释：逝者域编码（用于 (domain, subject_id) 稳定派生）。
        #[pallet::constant]
        type DeceasedDomain: Get<u8>;

    /// 函数级中文注释：逝者所有者只读提供者（低耦合）。
    /// - 返回 `Some(owner)` 则视为 subject 存在；None 表示不存在。
    type OwnerProvider: OwnerProvider<Self::AccountId>;

    /// 函数级中文注释：IPFS 池账户（公共费用来源）
    /// 
    /// 说明：
    /// - 由 pallet-storage-treasury 定期补充（供奉路由 2% × 50%）
    /// - 用于为 deceased 提供免费配额
    type IpfsPoolAccount: Get<Self::AccountId>;
    
    /// 函数级中文注释：运营者托管账户（服务费接收方）
    /// 
    /// 说明：
    /// - 接收所有 pin 服务费用
    /// - 待运营者完成任务后基于 SLA 分配
    type OperatorEscrowAccount: Get<Self::AccountId>;
    
    /// 函数级中文注释：每月公共费用配额
    /// 
    /// 说明：
    /// - 每个 deceased 每月可使用的免费额度
    /// - 默认：100 MEMO（可治理调整）
    #[pallet::constant]
    type MonthlyPublicFeeQuota: Get<BalanceOf<Self>>;
    
    /// 函数级中文注释：配额重置周期（区块数）
    /// 
    /// 说明：
    /// - 默认：100,800 × 4 = 403,200 区块 ≈ 28 天
    #[pallet::constant]
    type QuotaResetPeriod: Get<BlockNumberFor<Self>>;
}

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(0);

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 定价参数原始字节（骨架）
    #[pallet::storage]
    /// 函数级中文注释：定价参数原始字节（使用 BoundedVec 以满足 MaxEncodedLen 要求）
    pub type PricingParams<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<8192>>, ValueQuery>;

    /// 函数级中文注释：Pin 订单存储
    /// 
    /// Key: cid_hash
    /// Value: (payer, replicas, deceased_id, size_bytes, deposit)
    #[pallet::storage]
    pub type PendingPins<T: Config> =
        StorageMap<_, Blake2_128Concat, T::Hash, (T::AccountId, u32, u64, u64, T::Balance), OptionQuery>;

    /// Pin 元信息（副本数、大小、创建时间、最后巡检）
    #[pallet::storage]
    pub type PinMeta<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::Hash,
        (u32, u64, BlockNumberFor<T>, BlockNumberFor<T>),
        OptionQuery,
    >;

    /// Pin 状态机：0=Requested,1=Pinning,2=Pinned,3=Degraded,4=Failed
    #[pallet::storage]
    pub type PinStateOf<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, u8, ValueQuery>;

    /// 副本分配：为每个 cid_hash 挑选的运营者账户
    #[pallet::storage]
    pub type PinAssignments<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::Hash,
        BoundedVec<T::AccountId, frame_support::traits::ConstU32<16>>,
        OptionQuery,
    >;

    /// 分配内的成功标记：(cid_hash, operator) -> 成功与否
    #[pallet::storage]
    pub type PinSuccess<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::Hash,
        Blake2_128Concat,
        T::AccountId,
        bool,
        ValueQuery,
    >;

    /// 运营者信息
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct OperatorInfo<T: Config> {
        pub peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
        pub capacity_gib: u32,
        pub endpoint_hash: T::Hash,
        pub cert_fingerprint: Option<T::Hash>,
        pub status: u8, // 0=Active,1=Suspended,2=Banned
    }

    /// 运营者注册表与保证金
    #[pallet::storage]
    pub type Operators<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, OperatorInfo<T>, OptionQuery>;

    #[pallet::storage]
    pub type OperatorBond<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

    /// 运营者 SLA 统计
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct SlaStats<T: Config> {
        pub pinned_bytes: u64,
        pub probe_ok: u32,
        pub probe_fail: u32,
        pub degraded: u32,
        pub last_update: BlockNumberFor<T>,
    }

    impl<T: Config> Default for SlaStats<T> {
        /// 函数级中文注释：为 SlaStats<T> 提供显式的 Default 实现，避免对 T 施加 Default 约束
        /// - 将计数置 0，last_update 使用 BlockNumber 的默认值
        fn default() -> Self {
            Self {
                pinned_bytes: 0,
                probe_ok: 0,
                probe_fail: 0,
                degraded: 0,
                last_update: Default::default(),
            }
        }
    }

    #[pallet::storage]
    pub type OperatorSla<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, SlaStats<T>, ValueQuery>;

    // ====== 双重扣款配额管理 ======
    
    /// 函数级中文注释：公共费用配额使用记录
    /// 
    /// 说明：
    /// - 记录每个 deceased 的月度配额使用情况
    /// - 超过配额自动切换到 SubjectFunding
    /// 
    /// Key: deceased_id
    /// Value: (已使用金额, 配额重置区块号)
    #[pallet::storage]
    pub type PublicFeeQuotaUsage<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // deceased_id
        (BalanceOf<T>, BlockNumberFor<T>), // (used_amount, reset_block)
        ValueQuery,
    >;

    /// 函数级中文注释：累计从 IPFS 池扣款统计
    #[pallet::storage]
    pub type TotalChargedFromPool<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    /// 函数级中文注释：累计从 SubjectFunding 扣款统计
    #[pallet::storage]
    pub type TotalChargedFromSubject<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    // ====== 计费与生命周期（最小增量）======
    /// 函数级中文注释：每 GiB·周 单价（治理可调）。单位使用链上最小余额单位的整数，建议采用按字节的定点基数以避免小数。
    #[pallet::type_value]
    pub fn DefaultPricePerGiBWeek<T: Config>() -> u128 {
        1_000_000_000
    }
    #[pallet::storage]
    pub type PricePerGiBWeek<T: Config> =
        StorageValue<_, u128, ValueQuery, DefaultPricePerGiBWeek<T>>;

    /// 函数级中文注释：计费周期（块），默认一周（6s/块 × 60 × 60 × 24 × 7 = 100_800）。
    #[pallet::type_value]
    pub fn DefaultBillingPeriodBlocks<T: Config>() -> u32 {
        100_800
    }
    #[pallet::storage]
    pub type BillingPeriodBlocks<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultBillingPeriodBlocks<T>>;

    /// 函数级中文注释：宽限期（块）。在余额不足时进入 Grace，超过宽限仍不足则过期。
    #[pallet::type_value]
    pub fn DefaultGraceBlocks<T: Config>() -> u32 {
        10_080
    }
    #[pallet::storage]
    pub type GraceBlocks<T: Config> = StorageValue<_, u32, ValueQuery, DefaultGraceBlocks<T>>;

    /// 函数级中文注释：每块处理的最大扣费数，用于限流保护。
    #[pallet::type_value]
    pub fn DefaultMaxChargePerBlock<T: Config>() -> u32 {
        50
    }
    #[pallet::storage]
    pub type MaxChargePerBlock<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultMaxChargePerBlock<T>>;

    /// 函数级中文注释：主体资金账户最低保留（KeepAlive 余量），扣费需确保余额-金额≥该值。
    #[pallet::type_value]
    pub fn DefaultSubjectMinReserve<T: Config>() -> BalanceOf<T> {
        BalanceOf::<T>::default()
    }
    #[pallet::storage]
    pub type SubjectMinReserve<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultSubjectMinReserve<T>>;

    /// 函数级中文注释：计费暂停总开关（治理控制）。
    #[pallet::type_value]
    pub fn DefaultBillingPaused<T: Config>() -> bool {
        false
    }
    #[pallet::storage]
    pub type BillingPaused<T: Config> = StorageValue<_, bool, ValueQuery, DefaultBillingPaused<T>>;

    /// 函数级中文注释：是否允许“直接从调用者账户扣费”的直扣费路径。
    /// - 默认建议关闭（false），统一走“主题资金账户聚合计费”的 request_pin_for_deceased 路径。
    /// - 可由治理通过 set_billing_params 动态调整。
    #[pallet::type_value]
    pub fn DefaultAllowDirectPin<T: Config>() -> bool {
        false
    }
    #[pallet::storage]
    pub type AllowDirectPin<T: Config> =
        StorageValue<_, bool, ValueQuery, DefaultAllowDirectPin<T>>;

    /// 函数级中文注释：到期队列容量上限（每个区块键对应的最大 CID 数）。
    #[pallet::type_value]
    pub fn DefaultDueListCap<T: Config>() -> u32 {
        1024
    }
    #[pallet::storage]
    pub type DueQueue<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<T::Hash, ConstU32<1024>>,
        ValueQuery,
    >;

    /// 函数级中文注释：入队扩散窗口（块）。将到期项在 `base..base+spread` 内寻找首个未满的队列入队，平滑负载。
    #[pallet::type_value]
    pub fn DefaultDueEnqueueSpread<T: Config>() -> u32 {
        10
    }
    #[pallet::storage]
    pub type DueEnqueueSpread<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultDueEnqueueSpread<T>>;

    /// 函数级中文注释：每个 CID 的计费状态：下一次扣费块高、单价快照、状态（0=Active,1=Grace,2=Expired）。
    #[pallet::storage]
    pub type PinBilling<T: Config> =
        StorageMap<_, Blake2_128Concat, T::Hash, (BlockNumberFor<T>, u128, u8), OptionQuery>;

    /// 函数级中文注释：仅对“逝者主题扣费”的 CID 记录 funding 来源（owner, subject_id），用于从派生账户自动扣款。
    #[pallet::storage]
    pub type PinSubjectOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::Hash, (T::AccountId, u64), OptionQuery>;

    /// 事件
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 请求已受理（cid_hash, payer, replicas, size, price）
        PinRequested(T::Hash, T::AccountId, u32, u64, T::Balance),
        /// 已提交到 ipfs-cluster（cid_hash）
        PinSubmitted(T::Hash),
        /// 标记已 Pin 成功（cid_hash, replicas）
        PinMarkedPinned(T::Hash, u32),
        /// 标记 Pin 失败（cid_hash, code）
        PinMarkedFailed(T::Hash, u16),
        /// 运营者相关事件
        OperatorJoined(T::AccountId),
        OperatorUpdated(T::AccountId),
        OperatorLeft(T::AccountId),
        OperatorStatusChanged(T::AccountId, u8),
        /// 运营者探测结果（ok=true 表示在线且集群识别到该 Peer）
        OperatorProbed(T::AccountId, bool),
        /// 创建了副本分配（cid_hash, count）
        AssignmentCreated(T::Hash, u32),
        /// 状态迁移（cid_hash, state）
        PinStateChanged(T::Hash, u8),
        /// 副本降级与修复（cid_hash, operator）
        ReplicaDegraded(T::Hash, T::AccountId),
        ReplicaRepaired(T::Hash, T::AccountId),
        /// 降级累计达到告警阈值（operator, degraded_count）
        OperatorDegradationAlert(T::AccountId, u32),
        /// 主题账户已充值（subject_id, from, to, amount）
        SubjectFunded(u64, T::AccountId, T::AccountId, BalanceOf<T>),
        /// 函数级中文注释：已完成一次周期扣费（cid_hash, amount, period_blocks, next_charge_at）。
        PinCharged(T::Hash, BalanceOf<T>, u32, BlockNumberFor<T>),
        /// 函数级中文注释：余额不足进入宽限期（cid_hash）。
        PinGrace(T::Hash),
        /// 函数级中文注释：超出宽限期仍欠费，标记过期（cid_hash）。
        PinExpired(T::Hash),
        /// 函数级中文注释：到期队列出入队统计（block, enqueued, dequeued, remaining）。
        DueQueueStats(BlockNumberFor<T>, u32, u32, u32),
        /// 函数级中文注释：OCW 巡检上报 Pin 状态汇总（样本数、pinning、pinned、missing）。
        PinProbe(u32, u32, u32, u32),
        /// 函数级中文注释：从 IPFS 池扣款成功（deceased_id, amount, remaining_quota）
        ChargedFromIpfsPool {
            deceased_id: u64,
            amount: BalanceOf<T>,
            remaining_quota: BalanceOf<T>,
        },
        /// 函数级中文注释：从 SubjectFunding 账户扣款成功（deceased_id, amount）
        ChargedFromSubjectFunding {
            deceased_id: u64,
            amount: BalanceOf<T>,
        },
        /// 函数级中文注释：配额已重置（deceased_id, new_reset_block）
        QuotaReset {
            deceased_id: u64,
            new_reset_block: BlockNumberFor<T>,
        },
        /// 函数级中文注释：IPFS 池余额不足警告（current_balance, threshold）
        IpfsPoolLowBalance {
            current_balance: BalanceOf<T>,
            threshold: BalanceOf<T>,
        },
        /// 函数级中文注释：从调用者账户扣款成功（fallback，自费模式）
        ChargedFromCaller {
            caller: T::AccountId,
            deceased_id: u64,
            amount: BalanceOf<T>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 参数非法
        BadParams,
        /// 订单不存在
        OrderNotFound,
        /// 运营者不存在
        OperatorNotFound,
        /// 运营者已存在
        OperatorExists,
        /// 运营者已被禁用
        OperatorBanned,
        /// 保证金不足
        InsufficientBond,
        /// 容量不足
        InsufficientCapacity,
        /// 无效状态
        BadStatus,
        /// 分配不存在
        AssignmentNotFound,
        /// 仍存在未完成的副本分配，禁止退出
        HasActiveAssignments,
        /// 调用方未被指派到该内容的副本分配中
        OperatorNotAssigned,
        /// 直扣费路径已禁用，请使用 request_pin_for_deceased。
        DirectPinDisabled,
        /// 函数级中文注释：两个账户余额都不足（IPFS池和SubjectFunding都无法支付）
        BothAccountsInsufficientBalance,
        /// 函数级中文注释：IPFS 池余额不足
        IpfsPoolInsufficientBalance,
        /// 函数级中文注释：SubjectFunding 账户余额不足
        SubjectFundingInsufficientBalance,
        /// 函数级中文注释：三个账户余额都不足（IpfsPool、SubjectFunding、Caller都无法支付）
        AllThreeAccountsInsufficientBalance,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：根据 (domain, subject_id) 计算派生子账户（稳定派生，与创建者/拥有者解耦）
        /// - 使用 `SubjectPalletId.into_sub_account_truncating((domain:u8, subject_id:u64))` 派生稳定地址
        /// - 该账户无私钥，不可外发，仅用于托管与扣费
        #[inline]
        pub fn subject_account_for(domain: u8, subject_id: u64) -> T::AccountId {
            T::SubjectPalletId::get().into_sub_account_truncating((domain, subject_id))
        }
        /// 函数级详细中文注释：逝者域便捷封装（domain=DeceasedDomain）
        #[inline]
        pub fn subject_account_for_deceased(subject_id: u64) -> T::AccountId {
            Self::subject_account_for(T::DeceasedDomain::get(), subject_id)
        }
        /// 函数级详细中文注释：CID 解密/映射内部工具函数（非外部可调用）
        /// - 从 offchain local storage 读取 `/memo/ipfs/cid/<hash_hex>` 对应的明文 CID；
        /// - 若不存在，返回占位 `"<redacted>"`，用于上层降级处理。
        #[inline]
        fn resolve_cid(cid_hash: &T::Hash) -> alloc::string::String {
            let mut key = b"/memo/ipfs/cid/".to_vec();
            let hex = hex::encode(cid_hash.as_ref());
            key.extend_from_slice(hex.as_bytes());
            if let Some(bytes) = sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, &key) {
                if let Ok(s) = core::str::from_utf8(&bytes) {
                    return s.into();
                }
            }
            "<redacted>".into()
        }

        /// 函数级中文注释：派生 SubjectFunding 账户地址
        /// 
        /// 算法：
        /// - PalletId + (DeceasedDomain, creator, deceased_id)
        /// - 从 pallet-deceased 读取 creator
        /// - 生成确定性的子账户地址
        /// 
        /// 参数：
        /// - deceased_id: 逝者 ID
        /// 
        /// 返回：
        /// - AccountId: 派生的账户地址
        pub fn derive_subject_funding_account(deceased_id: u64) -> T::AccountId {
            use codec::Encode;
            use sp_runtime::traits::AccountIdConversion;
            
            // 从 pallet-deceased 获取 creator
            let creator = match T::OwnerProvider::owner_of(deceased_id) {
                Some(owner) => owner,
                None => {
                    // deceased 不存在，返回默认账户（会导致扣款失败）
                    return T::SubjectPalletId::get().into_account_truncating();
                }
            };
            
            let domain = T::DeceasedDomain::get();
            let seed = (domain, creator, deceased_id).encode();
            
            T::SubjectPalletId::get().into_sub_account_truncating(seed)
        }

        /// 函数级中文注释：双重扣款逻辑（IPFS池 → SubjectFunding）
        /// 
        /// 参数：
        /// - deceased_id: 逝者 ID
        /// - amount: 需要扣除的费用金额
        /// 
        /// 扣款流程：
        /// 1. 检查并更新月度配额
        /// 2. 如配额充足，尝试从 IPFS 池扣款
        /// 3. 如失败，尝试从 SubjectFunding 扣款
        /// 4. 两者都失败则返回错误
        /// 
        /// 返回：
        /// - Ok(()) 扣款成功
        /// - Err(Error::BothAccountsInsufficientBalance) 两账户都余额不足
        pub fn dual_charge_storage_fee(
            deceased_id: u64,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            use sp_runtime::traits::{Zero, Saturating};
            
            let current_block = <frame_system::Pallet<T>>::block_number();
            let ipfs_pool = T::IpfsPoolAccount::get();
            let escrow_account = T::OperatorEscrowAccount::get();
            
            // ========================================
            // 步骤 1: 获取并检查月度配额
            // ========================================
            
            let (used_quota, reset_block) = PublicFeeQuotaUsage::<T>::get(deceased_id);
            
            // 如果超过重置周期，重置配额
            let (used_quota, reset_block) = if current_block >= reset_block {
                let new_reset_block = current_block.saturating_add(T::QuotaResetPeriod::get());
                
                Self::deposit_event(Event::QuotaReset {
                    deceased_id,
                    new_reset_block,
                });
                
                (BalanceOf::<T>::zero(), new_reset_block)
            } else {
                (used_quota, reset_block)
            };
            
            let monthly_quota = T::MonthlyPublicFeeQuota::get();
            let remaining_quota = monthly_quota.saturating_sub(used_quota);
            
            // ========================================
            // 步骤 2: 尝试从 IPFS 池扣款（配额内）
            // ========================================
            
            if remaining_quota >= amount {
                let pool_balance = <T as Config>::Currency::free_balance(&ipfs_pool);
                
                if pool_balance >= amount {
                    // 从 IPFS 池转账到运营者托管账户
                    <T as Config>::Currency::transfer(
                        &ipfs_pool,
                        &escrow_account,
                        amount,
                        frame_support::traits::ExistenceRequirement::AllowDeath,
                    )?;
                    
                    // 更新配额使用记录
                    PublicFeeQuotaUsage::<T>::insert(
                        deceased_id,
                        (used_quota.saturating_add(amount), reset_block),
                    );
                    
                    // 更新统计
                    TotalChargedFromPool::<T>::mutate(|total| {
                        *total = total.saturating_add(amount);
                    });
                    
                    // 触发事件
                    Self::deposit_event(Event::ChargedFromIpfsPool {
                        deceased_id,
                        amount,
                        remaining_quota: remaining_quota.saturating_sub(amount),
                    });
                    
                    // 检查池余额，如果过低发出警告
                    let new_balance = pool_balance.saturating_sub(amount);
                    let threshold = monthly_quota.saturating_mul(10u32.into()); // 10 个月配额
                    
                    if new_balance < threshold {
                        Self::deposit_event(Event::IpfsPoolLowBalance {
                            current_balance: new_balance,
                            threshold,
                        });
                    }
                    
                    return Ok(());
                }
            }
            
            // ========================================
            // 步骤 3: 从 SubjectFunding 扣款
            // ========================================
            
            let subject_account = Self::derive_subject_funding_account(deceased_id);
            let subject_balance = <T as Config>::Currency::free_balance(&subject_account);
            
            ensure!(
                subject_balance >= amount,
                Error::<T>::BothAccountsInsufficientBalance
            );
            
            // 从 SubjectFunding 转账到运营者托管账户
            <T as Config>::Currency::transfer(
                &subject_account,
                &escrow_account,
                amount,
                frame_support::traits::ExistenceRequirement::AllowDeath,
            )?;
            
            // 更新统计
            TotalChargedFromSubject::<T>::mutate(|total| {
                *total = total.saturating_add(amount);
            });
            
            // 触发事件
            Self::deposit_event(Event::ChargedFromSubjectFunding {
                deceased_id,
                amount,
            });
            
            Ok(())
        }

        /// 函数级详细中文注释：三重扣款逻辑（增强版，用于初次 pin 请求）
        /// 
        /// 扣款优先级：
        /// 1. IpfsPoolAccount（配额内优先，公共福利）
        /// 2. SubjectFunding（逝者专属资金，推荐）
        /// 3. 调用者账户（fallback，自费模式）
        /// 
        /// 参数：
        /// - caller: 调用者账户（用于 fallback 扣款）
        /// - deceased_id: 逝者 ID（用于配额检查和 SubjectFunding 派生）
        /// - amount: 扣款金额
        /// 
        /// 返回值：
        /// - Ok(source) - 成功，source=0:IpfsPool, 1:SubjectFunding, 2:Caller
        /// - Err(Error) - 所有账户都余额不足
        /// 
        /// 使用场景：
        /// - request_pin_for_deceased()：初次 pin 请求
        /// - 不用于周期扣款（周期扣款使用 dual_charge_storage_fee）
        pub fn triple_charge_storage_fee(
            caller: &T::AccountId,
            deceased_id: u64,
            amount: BalanceOf<T>,
        ) -> Result<u8, DispatchError> {
            use sp_runtime::traits::{Zero, Saturating};
            
            let current_block = <frame_system::Pallet<T>>::block_number();
            let ipfs_pool = T::IpfsPoolAccount::get();
            let escrow_account = T::OperatorEscrowAccount::get();
            
            // ========================================
            // 步骤 1: 获取并检查月度配额
            // ========================================
            
            let (used_quota, reset_block) = PublicFeeQuotaUsage::<T>::get(deceased_id);
            
            // 如果超过重置周期，重置配额
            let (used_quota, reset_block) = if current_block >= reset_block {
                let new_reset_block = current_block.saturating_add(T::QuotaResetPeriod::get());
                
                Self::deposit_event(Event::QuotaReset {
                    deceased_id,
                    new_reset_block,
                });
                
                (BalanceOf::<T>::zero(), new_reset_block)
            } else {
                (used_quota, reset_block)
            };
            
            let monthly_quota = T::MonthlyPublicFeeQuota::get();
            let remaining_quota = monthly_quota.saturating_sub(used_quota);
            
            // ========================================
            // 步骤 2: 尝试从 IPFS 池扣款（配额内优先）
            // ========================================
            
            if remaining_quota >= amount {
                let pool_balance = <T as Config>::Currency::free_balance(&ipfs_pool);
                
                if pool_balance >= amount {
                    // 从 IPFS 池转账到运营者托管账户
                    <T as Config>::Currency::transfer(
                        &ipfs_pool,
                        &escrow_account,
                        amount,
                        frame_support::traits::ExistenceRequirement::AllowDeath,
                    )?;
                    
                    // 更新配额使用记录
                    PublicFeeQuotaUsage::<T>::insert(
                        deceased_id,
                        (used_quota.saturating_add(amount), reset_block),
                    );
                    
                    // 更新统计
                    TotalChargedFromPool::<T>::mutate(|total| {
                        *total = total.saturating_add(amount);
                    });
                    
                    // 触发事件
                    Self::deposit_event(Event::ChargedFromIpfsPool {
                        deceased_id,
                        amount,
                        remaining_quota: remaining_quota.saturating_sub(amount),
                    });
                    
                    // 检查池余额，如果过低发出警告
                    let new_balance = pool_balance.saturating_sub(amount);
                    let threshold = monthly_quota.saturating_mul(10u32.into()); // 10 个月配额
                    
                    if new_balance < threshold {
                        Self::deposit_event(Event::IpfsPoolLowBalance {
                            current_balance: new_balance,
                            threshold,
                        });
                    }
                    
                    return Ok(0);  // ✅ 从 IpfsPool 扣款成功
                }
            }
            
            // ========================================
            // 步骤 3: 尝试从 SubjectFunding 扣款
            // ========================================
            
            let subject_account = Self::derive_subject_funding_account(deceased_id);
            let subject_balance = <T as Config>::Currency::free_balance(&subject_account);
            
            if subject_balance >= amount {
                // 从 SubjectFunding 转账到运营者托管账户
                <T as Config>::Currency::transfer(
                    &subject_account,
                    &escrow_account,
                    amount,
                    frame_support::traits::ExistenceRequirement::AllowDeath,
                )?;
                
                // 更新统计
                TotalChargedFromSubject::<T>::mutate(|total| {
                    *total = total.saturating_add(amount);
                });
                
                // 触发事件
                Self::deposit_event(Event::ChargedFromSubjectFunding {
                    deceased_id,
                    amount,
                });
                
                return Ok(1);  // ✅ 从 SubjectFunding 扣款成功
            }
            
            // ========================================
            // 步骤 4: 从调用者账户扣款（fallback）
            // ========================================
            
            let caller_balance = <T as Config>::Currency::free_balance(caller);
            
            ensure!(
                caller_balance >= amount,
                Error::<T>::AllThreeAccountsInsufficientBalance
            );
            
            // 从调用者转账到运营者托管账户
            <T as Config>::Currency::transfer(
                caller,
                &escrow_account,
                amount,
                frame_support::traits::ExistenceRequirement::KeepAlive,
            )?;
            
            // 触发事件
            Self::deposit_event(Event::ChargedFromCaller {
                caller: caller.clone(),
                deceased_id,
                amount,
            });
            
            Ok(2)  // ✅ 从调用者账户扣款成功
        }
    }

    // 说明：临时允许 warnings 以通过工作区 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：为“逝者主题资金账户”充值（留审计事件）
        /// - 限制：必须为该 subject 的 owner 调用；amount>0
        /// - 行为：从 caller → 派生账户 转账（KeepAlive）
        #[pallet::call_index(9)]
        #[pallet::weight(10_000)]
        pub fn fund_subject_account(
            origin: OriginFor<T>,
            subject_id: u64,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(amount != BalanceOf::<T>::default(), Error::<T>::BadParams);
            let owner = T::OwnerProvider::owner_of(subject_id).ok_or(Error::<T>::BadParams)?;
            ensure!(owner == who, Error::<T>::BadStatus);
            let to = Self::subject_account_for_deceased(subject_id);
            <T as Config>::Currency::transfer(
                &who,
                &to,
                amount,
                frame_support::traits::ExistenceRequirement::KeepAlive,
            )?;
            Self::deposit_event(Event::SubjectFunded(subject_id, who, to, amount));
            Ok(())
        }
        /// 函数级详细中文注释：用户请求 Pin（一次性付费进入基金会）
        /// - 输入为 `cid_hash`（避免泄露明文 CID）、大小与副本数；
        /// - 价格计算在链上依据 `PricingParams` 得出；当前骨架由外部直接给出 `price`；
        /// - 将 `price` 转入基金会（Endowment）并记录订单，等待 OCW 提交到 ipfs-cluster。
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::request_pin())]
        pub fn request_pin(
            origin: OriginFor<T>,
            cid_hash: T::Hash,
            size_bytes: u64,
            replicas: u32,
            price: T::Balance,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 若直扣费关闭，则拒绝调用
            ensure!(AllowDirectPin::<T>::get(), Error::<T>::DirectPinDisabled);
            ensure!(replicas >= 1 && size_bytes > 0, Error::<T>::BadParams);
            // 将一次性费用直接转入 FeeCollector（例如 Treasury）
            {
                let to = <T as Config>::FeeCollector::get();
                <T as Config>::Currency::transfer(
                    &who,
                    &to,
                    price,
                    frame_support::traits::ExistenceRequirement::KeepAlive,
                )?;
            }
            // 注意：此函数已禁用，deceased_id 使用占位值 0
            PendingPins::<T>::insert(&cid_hash, (who.clone(), replicas, 0u64, size_bytes, price));
            let now = <frame_system::Pallet<T>>::block_number();
            PinMeta::<T>::insert(&cid_hash, (replicas, size_bytes, now, now));
            PinStateOf::<T>::insert(&cid_hash, 0u8); // Requested
            Self::deposit_event(Event::PinRequested(
                cid_hash, who, replicas, size_bytes, price,
            ));
            Ok(())
        }

        /// 函数级详细中文注释：为"逝者主题"发起 Pin（三重扣款逻辑）
        /// 
        /// 授权：caller 必须为该 subject 的 owner
        /// 
        /// 扣款优先级（三重扣款）：
        /// 1. IpfsPoolAccount（配额内优先，公共福利）
        /// 2. SubjectFunding（逝者专属资金，推荐）
        /// 3. 调用者账户（fallback，自费模式）
        /// 
        /// 优点：
        /// - 用户体验最好：一次交易完成
        /// - 新用户友好：无需预充值
        /// - 向后兼容：保留双重扣款逻辑
        /// - 仍鼓励使用 SubjectFunding（第二优先级）
        #[pallet::call_index(10)]
        #[pallet::weight(T::WeightInfo::request_pin())]
        pub fn request_pin_for_deceased(
            origin: OriginFor<T>,
            subject_id: u64,
            cid_hash: T::Hash,
            size_bytes: u64,
            replicas: u32,
            price: T::Balance,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(replicas >= 1 && size_bytes > 0, Error::<T>::BadParams);
            let owner = T::OwnerProvider::owner_of(subject_id).ok_or(Error::<T>::BadParams)?;
            ensure!(owner == who, Error::<T>::BadStatus);
            
            // 使用三重扣款逻辑：IpfsPool → SubjectFunding → Caller
            let _charge_source = Self::triple_charge_storage_fee(&who, subject_id, price)?;
            
            PendingPins::<T>::insert(&cid_hash, (who.clone(), replicas, subject_id, size_bytes, price));
            let now = <frame_system::Pallet<T>>::block_number();
            PinMeta::<T>::insert(&cid_hash, (replicas, size_bytes, now, now));
            PinStateOf::<T>::insert(&cid_hash, 0u8);
            Self::deposit_event(Event::PinRequested(
                cid_hash, who, replicas, size_bytes, price,
            ));
            // 计费初始化：仅对“主题扣费”场景登记来源/周期
            PinSubjectOf::<T>::insert(&cid_hash, (owner.clone(), subject_id));
            let period = BillingPeriodBlocks::<T>::get();
            let unit = PricePerGiBWeek::<T>::get();
            let next = now.saturating_add(period.into());
            PinBilling::<T>::insert(&cid_hash, (next, unit, 0u8));
            // 加入到期队列（扩散入队，若全部满则静默丢弃；后续可由治理修复/补处理）
            Self::enqueue_due(cid_hash, next);
            Ok(())
        }

        /// 函数级详细中文注释：【治理/服务商】处理到期扣费项（limit 条）
        /// - Origin：GovernanceOrigin（可扩展加入白名单服务商 Origin）
        /// - 行为：从到期队列中取出 ≤limit 个，到期的 CID 进行扣费；成功则推进下一次扣费并重新入队；余额不足则进入宽限或过期。
        #[pallet::call_index(11)]
        #[pallet::weight(T::WeightInfo::charge_due(*limit))]
        pub fn charge_due(origin: OriginFor<T>, limit: u32) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(!BillingPaused::<T>::get(), Error::<T>::BadStatus);
            let now = <frame_system::Pallet<T>>::block_number();
            let mut left = core::cmp::min(limit, MaxChargePerBlock::<T>::get());
            if left == 0 {
                return Ok(());
            }
            // 取出本块到期列表
            let mut list = DueQueue::<T>::take(now);
            let original_len = list.len() as u32;
            while left > 0 {
                let Some(cid) = list.pop() else { break };
                left = left.saturating_sub(1);
                // 读取计费与来源
                if let Some((_, unit_price, state)) = PinBilling::<T>::get(&cid) {
                    if let Some((owner, subject_id)) = PinSubjectOf::<T>::get(&cid) {
                        // 仅处理 Active/Grace，已过期则跳过
                        if state <= 1u8 {
                            // 计算应收：ceil(size/GiB) * replicas * unit_price
                            if let Some((replicas, size_bytes, _c, _l)) = PinMeta::<T>::get(&cid) {
                                let gib: u128 = 1_073_741_824u128; // 1024^3
                                let sz = size_bytes as u128;
                                let units = (sz + gib - 1) / gib; // ceil
                                let due_u128 = units
                                    .saturating_mul(replicas as u128)
                                    .saturating_mul(unit_price);
                                let due_bal: BalanceOf<T> = due_u128.saturated_into();
                                
                                // 使用双重扣款逻辑：IPFS池（配额内）→ SubjectFunding
                                if Self::dual_charge_storage_fee(subject_id, due_bal).is_ok() {
                                    // 推进下一期并重新入队
                                    let period = BillingPeriodBlocks::<T>::get();
                                    let next = now.saturating_add(period.into());
                                    PinBilling::<T>::insert(&cid, (next, unit_price, 0u8));
                                    Self::enqueue_due(cid, next);
                                    Self::deposit_event(Event::PinCharged(
                                        cid, due_bal, period, next,
                                    ));
                                } else {
                                    // 余额不足：首次不足进入 Grace；已在 Grace 再次不足则过期
                                    if state == 0u8 {
                                        let g = GraceBlocks::<T>::get();
                                        let next = now.saturating_add(g.into());
                                        PinBilling::<T>::insert(&cid, (next, unit_price, 1u8));
                                        Self::enqueue_due(cid, next);
                                        Self::deposit_event(Event::PinGrace(cid));
                                    } else {
                                        PinBilling::<T>::insert(&cid, (now, unit_price, 2u8));
                                        Self::deposit_event(Event::PinExpired(cid));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // 剩余未处理的放回队列
            if !list.is_empty() {
                DueQueue::<T>::insert(now, list.clone());
            }
            let remaining = list.len() as u32;
            let dequeued = original_len.saturating_sub(remaining);
            Self::deposit_event(Event::DueQueueStats(now, original_len, dequeued, remaining));
            Ok(())
        }

        /// 函数级详细中文注释：治理设置/暂停计费参数。
        /// - 任何入参为 None 表示保持不变；部分更新。
        #[pallet::call_index(12)]
        #[pallet::weight(T::WeightInfo::set_billing_params())]
        pub fn set_billing_params(
            origin: OriginFor<T>,
            price_per_gib_week: Option<u128>,
            period_blocks: Option<u32>,
            grace_blocks: Option<u32>,
            max_charge_per_block: Option<u32>,
            subject_min_reserve: Option<BalanceOf<T>>,
            paused: Option<bool>,
            allow_direct_pin: Option<bool>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // 参数防呆校验：确保关键参数为正，避免导致停摆或无限宽限
            if let Some(v) = price_per_gib_week {
                ensure!(v > 0, Error::<T>::BadParams);
                PricePerGiBWeek::<T>::put(v);
            }
            if let Some(v) = period_blocks {
                ensure!(v > 0, Error::<T>::BadParams);
                BillingPeriodBlocks::<T>::put(v);
            }
            if let Some(v) = grace_blocks {
                ensure!(v > 0, Error::<T>::BadParams);
                GraceBlocks::<T>::put(v);
            }
            if let Some(v) = max_charge_per_block {
                ensure!(v > 0, Error::<T>::BadParams);
                MaxChargePerBlock::<T>::put(v);
            }
            if let Some(v) = subject_min_reserve {
                SubjectMinReserve::<T>::put(v);
            }
            if let Some(v) = paused {
                BillingPaused::<T>::put(v);
            }
            if let Some(v) = allow_direct_pin {
                AllowDirectPin::<T>::put(v);
            }
            Ok(())
        }

        /// 函数级详细中文注释：OCW 上报标记已 Pin 成功
        /// - 需要节点 keystore 的专用 key 签名；
        /// - 仅更新状态并发出事件（骨架）。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::mark_pinned())]
        pub fn mark_pinned(
            origin: OriginFor<T>,
            cid_hash: T::Hash,
            replicas: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // 仅允许活跃运营者上报
            let op = Operators::<T>::get(&who).ok_or(Error::<T>::OperatorNotFound)?;
            ensure!(op.status == 0, Error::<T>::OperatorBanned);
            ensure!(
                PendingPins::<T>::contains_key(&cid_hash),
                Error::<T>::OrderNotFound
            );
            // 必须是该 cid 的指派运营者之一
            if let Some(assign) = PinAssignments::<T>::get(&cid_hash) {
                ensure!(
                    assign.iter().any(|a| a == &who),
                    Error::<T>::OperatorNotAssigned
                );
            } else {
                return Err(Error::<T>::AssignmentNotFound.into());
            }
            // 标记该运营者完成
            PinSuccess::<T>::insert(&cid_hash, &who, true);
            // 达到副本数则完成
            if let Some((expect, _size, _created, _last)) = PinMeta::<T>::get(&cid_hash) {
                let mut ok_count: u32 = 0;
                if let Some(ops) = PinAssignments::<T>::get(&cid_hash) {
                    for o in ops.iter() {
                        if PinSuccess::<T>::get(&cid_hash, o) {
                            ok_count = ok_count.saturating_add(1);
                        }
                    }
                }
                if ok_count >= expect {
                    // 清理 pending，设置状态
                    PendingPins::<T>::remove(&cid_hash);
                    PinStateOf::<T>::insert(&cid_hash, 2u8); // Pinned
                    Self::deposit_event(Event::PinStateChanged(cid_hash, 2));
                } else {
                    PinStateOf::<T>::insert(&cid_hash, 1u8); // Pinning
                    Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
                }
            }
            Self::deposit_event(Event::PinMarkedPinned(cid_hash, replicas));
            Ok(())
        }

        /// 函数级详细中文注释：OCW 上报标记 Pin 失败
        /// - 记录错误码，便于外部审计。
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::mark_pin_failed())]
        pub fn mark_pin_failed(
            origin: OriginFor<T>,
            cid_hash: T::Hash,
            code: u16,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let op = Operators::<T>::get(&who).ok_or(Error::<T>::OperatorNotFound)?;
            ensure!(op.status == 0, Error::<T>::OperatorBanned);
            ensure!(
                PendingPins::<T>::contains_key(&cid_hash),
                Error::<T>::OrderNotFound
            );
            if let Some(assign) = PinAssignments::<T>::get(&cid_hash) {
                ensure!(
                    assign.iter().any(|a| a == &who),
                    Error::<T>::OperatorNotAssigned
                );
            } else {
                return Err(Error::<T>::AssignmentNotFound.into());
            }
            // 标记失败并置为 Pinning/Failed
            PinSuccess::<T>::insert(&cid_hash, &who, false);
            PinStateOf::<T>::insert(&cid_hash, 1u8);
            Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
            Self::deposit_event(Event::PinMarkedFailed(cid_hash, code));
            Ok(())
        }

        /// 函数级详细中文注释：申请成为运营者并存入保证金
        /// - 要求容量 >= MinCapacityGiB，保证金 >= MinOperatorBond；
        /// - 保证金使用可保留余额（reserve），离开时解保留。
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn join_operator(
            origin: OriginFor<T>,
            peer_id: BoundedVec<u8, T::MaxPeerIdLen>,
            capacity_gib: u32,
            endpoint_hash: T::Hash,
            cert_fingerprint: Option<T::Hash>,
            bond: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                !Operators::<T>::contains_key(&who),
                Error::<T>::OperatorExists
            );
            ensure!(
                capacity_gib >= T::MinCapacityGiB::get(),
                Error::<T>::InsufficientCapacity
            );
            ensure!(
                bond >= T::MinOperatorBond::get(),
                Error::<T>::InsufficientBond
            );
            // 保证金保留
            <T as Config>::Currency::reserve(&who, bond)?;
            OperatorBond::<T>::insert(&who, bond);
            let info = OperatorInfo::<T> {
                peer_id,
                capacity_gib,
                endpoint_hash,
                cert_fingerprint,
                status: 0,
            };
            Operators::<T>::insert(&who, info);
            Self::deposit_event(Event::OperatorJoined(who));
            Ok(())
        }

        /// 函数级详细中文注释：更新运营者元信息（不影响保证金）
        #[pallet::call_index(4)]
        #[pallet::weight(10_000)]
        pub fn update_operator(
            origin: OriginFor<T>,
            peer_id: Option<BoundedVec<u8, T::MaxPeerIdLen>>,
            capacity_gib: Option<u32>,
            endpoint_hash: Option<T::Hash>,
            cert_fingerprint: Option<Option<T::Hash>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Operators::<T>::try_mutate(&who, |maybe| -> DispatchResult {
                let op = maybe.as_mut().ok_or(Error::<T>::OperatorNotFound)?;
                if let Some(p) = peer_id {
                    op.peer_id = p;
                }
                if let Some(c) = capacity_gib {
                    ensure!(
                        c >= T::MinCapacityGiB::get(),
                        Error::<T>::InsufficientCapacity
                    );
                    op.capacity_gib = c;
                }
                if let Some(h) = endpoint_hash {
                    op.endpoint_hash = h;
                }
                if let Some(cf) = cert_fingerprint {
                    op.cert_fingerprint = cf;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::OperatorUpdated(who));
            Ok(())
        }

        /// 函数级详细中文注释：退出运营者并解保留保证金（需无未完成订单，MVP 略过校验）
        #[pallet::call_index(5)]
        #[pallet::weight(10_000)]
        pub fn leave_operator(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                Operators::<T>::contains_key(&who),
                Error::<T>::OperatorNotFound
            );
            // 退出校验：不得出现在任何分配中（MVP：线性扫描）
            for (_cid, ops) in PinAssignments::<T>::iter() {
                if ops.iter().any(|o| o == &who) {
                    return Err(Error::<T>::HasActiveAssignments.into());
                }
            }
            Operators::<T>::remove(&who);
            let bond = OperatorBond::<T>::take(&who);
            if !bond.is_zero() {
                let _ = <T as Config>::Currency::unreserve(&who, bond);
            }
            Self::deposit_event(Event::OperatorLeft(who));
            Ok(())
        }

        /// 函数级详细中文注释：治理设置运营者状态（0=Active,1=Suspended,2=Banned）
        #[pallet::call_index(6)]
        #[pallet::weight(10_000)]
        pub fn set_operator_status(
            origin: OriginFor<T>,
            who: T::AccountId,
            status: u8,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            Operators::<T>::try_mutate(&who, |maybe| -> DispatchResult {
                let op = maybe.as_mut().ok_or(Error::<T>::OperatorNotFound)?;
                op.status = status;
                Ok(())
            })?;
            Self::deposit_event(Event::OperatorStatusChanged(who, status));
            Ok(())
        }

        /// 函数级详细中文注释：运营者自证在线（由运行其节点的 OCW 定期上报）
        /// - 探测逻辑在 OCW：若 /peers 含有自身 peer_id → ok=true，否则 false。
        #[pallet::call_index(7)]
        #[pallet::weight(10_000)]
        pub fn report_probe(origin: OriginFor<T>, ok: bool) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let op = Operators::<T>::get(&who).ok_or(Error::<T>::OperatorNotFound)?;
            ensure!(op.status == 0, Error::<T>::BadStatus);
            OperatorSla::<T>::mutate(&who, |s| {
                if ok {
                    s.probe_ok = s.probe_ok.saturating_add(1);
                } else {
                    s.probe_fail = s.probe_fail.saturating_add(1);
                }
                s.last_update = <frame_system::Pallet<T>>::block_number();
            });
            Self::deposit_event(Event::OperatorProbed(who, ok));
            Ok(())
        }

        /// 函数级详细中文注释：治理扣罚运营者的保证金（阶梯惩罚使用）。
        #[pallet::call_index(8)]
        #[pallet::weight(10_000)]
        pub fn slash_operator(
            origin: OriginFor<T>,
            who: T::AccountId,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(
                Operators::<T>::contains_key(&who),
                Error::<T>::OperatorNotFound
            );
            let (slashed, _remaining) = <T as Config>::Currency::slash_reserved(&who, amount);
            // 记录剩余 bond（slash_reserved 返回负不平衡，使用 peek 获取相应余额值再进行安全减法）
            let old = OperatorBond::<T>::get(&who);
            let slashed_amount = slashed.peek();
            let new = old.saturating_sub(slashed_amount);
            OperatorBond::<T>::insert(&who, new);
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：Offchain Worker 入口
        /// - 周期性扫描 `PendingPins`，对每个 `cid_hash` 调用 ipfs-cluster API 进行 Pin；
        /// - 成功则提交 `mark_pinned`，失败则提交 `mark_pin_failed`；
        /// - HTTP 令牌与集群端点从本地 offchain storage 读取，避免上链泄露。
        fn offchain_worker(_n: BlockNumberFor<T>) {
            // 读取本地配置（示例键）："/memo/ipfs/cluster_endpoint" 与 "/memo/ipfs/token"
            let endpoint: alloc::string::String = sp_io::offchain::local_storage_get(
                StorageKind::PERSISTENT,
                b"/memo/ipfs/cluster_endpoint",
            )
            .and_then(|v| core::str::from_utf8(&v).ok().map(|s| s.to_string()))
            .unwrap_or_else(|| alloc::string::String::from("http://127.0.0.1:9094"));
            let token: Option<alloc::string::String> =
                sp_io::offchain::local_storage_get(StorageKind::PERSISTENT, b"/memo/ipfs/token")
                    .and_then(|v| core::str::from_utf8(&v).ok().map(|s| s.to_string()));

            // 分配与 Pin：遍历 PendingPins，若无分配则创建；否则尝试 POST /pins 携带 allocations
            if let Some((cid_hash, (_payer, replicas, _deceased_id, _size, _price))) =
                <PendingPins<T>>::iter().next()
            {
                // 若未分配，则挑选活跃运营者账户（简化：取前 N 个）
                if PinAssignments::<T>::get(&cid_hash).is_none() {
                    let mut selected: BoundedVec<
                        T::AccountId,
                        frame_support::traits::ConstU32<16>,
                    > = Default::default();
                    for (op_acc, info) in Operators::<T>::iter() {
                        if info.status == 0 {
                            let _ = selected.try_push(op_acc);
                        }
                        if (selected.len() as u32) >= replicas {
                            break;
                        }
                    }
                    if !selected.is_empty() {
                        PinAssignments::<T>::insert(&cid_hash, &selected);
                        Self::deposit_event(Event::AssignmentCreated(
                            cid_hash,
                            selected.len() as u32,
                        ));
                    }
                }
                // 发起 Pin 请求（MVP 不在 body 中传 allocations，真实集群应携带）
                let _ = Self::submit_pin_request(&endpoint, &token, cid_hash);
                PinStateOf::<T>::insert(&cid_hash, 1u8);
                Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
            }

            // 探测自身是否在线（运营者必须运行集群节点）：读取 /peers 并查找自身 peer_id
            // 探测自身是否在线：简化为本地统计，避免依赖 CreateSignedTransaction
            let _ = Self::http_get_bytes(&endpoint, &token, "/peers");

            // 巡检：针对已 Pinned/Pinning 的对象，GET /pins/{cid} 矫正副本；若缺少则再 Pin；并统计上报
            // 注意：演示中未持有明文 CID，这里仅示意调用；生产需有 CID 解密/映射。
            // 逻辑：遍历 PinStateOf in {1=Pinning,2=Pinned}，若 assignments 存在，检查成功标记数；不足副本则再次发起 submit_pin_request。
            let mut sample: u32 = 0;
            let mut pinning: u32 = 0;
            let mut pinned: u32 = 0;
            let mut missing: u32 = 0;
            for (cid_hash, state) in PinStateOf::<T>::iter() {
                if state == 1u8 || state == 2u8 {
                    sample = sample.saturating_add(1);
                    if let Some(assign) = PinAssignments::<T>::get(&cid_hash) {
                        let expect = PinMeta::<T>::get(&cid_hash)
                            .map(|m| m.0)
                            .unwrap_or(assign.len() as u32);
                        let mut ok_count: u32 = 0;
                        for o in assign.iter() {
                            if PinSuccess::<T>::get(&cid_hash, o) {
                                ok_count = ok_count.saturating_add(1);
                            }
                        }
                        if ok_count < expect {
                            // 解析 /pins/{cid}，对比分配并触发降级/修复事件
                            let cid_str = Self::resolve_cid(&cid_hash);
                            // 直接 GET /pins/{cid} 获取状态（Plan B 替换 submit_get_pin_status_collect）
                            if let Some(body) = Self::http_get_bytes(
                                &endpoint,
                                &token,
                                &alloc::format!("/pins/{}", cid_str),
                            ) {
                                let mut online_peers: Vec<Vec<u8>> = Vec::new();
                                if let Ok(json) = serde_json::from_slice::<JsonValue>(&body) {
                                    // 兼容两类结构：{peer_map:{"peerid":{status:"pinned"|...}}} 或 {allocations:["peerid",...]}
                                    if let Some(map) =
                                        json.get("peer_map").and_then(|v| v.as_object())
                                    {
                                        for (pid, st) in map.iter() {
                                            if st.get("status").and_then(|s| s.as_str())
                                                == Some("pinned")
                                            {
                                                online_peers.push(pid.as_bytes().to_vec());
                                            }
                                        }
                                    } else if let Some(arr) =
                                        json.get("allocations").and_then(|v| v.as_array())
                                    {
                                        for v in arr.iter() {
                                            if let Some(s) = v.as_str() {
                                                online_peers.push(s.as_bytes().to_vec());
                                            }
                                        }
                                    }
                                }
                                // 标记降级与修复：对比本地分配和在线列表
                                for op_acc in assign.iter() {
                                    if let Some(info) = Operators::<T>::get(op_acc) {
                                        let present = online_peers
                                            .iter()
                                            .any(|p| p.as_slice() == info.peer_id.as_slice());
                                        let success = PinSuccess::<T>::get(&cid_hash, op_acc);
                                        if present && !success {
                                            PinSuccess::<T>::insert(&cid_hash, op_acc, true);
                                            Self::deposit_event(Event::ReplicaRepaired(
                                                cid_hash,
                                                op_acc.clone(),
                                            ));
                                        }
                                        if !present && success {
                                            PinSuccess::<T>::insert(&cid_hash, op_acc, false);
                                            // 统计降级次数并触发告警建议
                                            OperatorSla::<T>::mutate(op_acc, |s| {
                                                s.degraded = s.degraded.saturating_add(1);
                                                if s.degraded % 10 == 0 {
                                                    // 简单阈值：每 10 次降级告警
                                                    Self::deposit_event(
                                                        Event::OperatorDegradationAlert(
                                                            op_acc.clone(),
                                                            s.degraded,
                                                        ),
                                                    );
                                                }
                                            });
                                            Self::deposit_event(Event::ReplicaDegraded(
                                                cid_hash,
                                                op_acc.clone(),
                                            ));
                                        }
                                    }
                                }
                            }
                            // 再 Pin（带退避）
                            let _ = Self::submit_pin_request(&endpoint, &token, cid_hash);
                            PinStateOf::<T>::insert(&cid_hash, 1u8);
                            Self::deposit_event(Event::PinStateChanged(cid_hash, 1));
                            pinning = pinning.saturating_add(1);
                        } else {
                            pinned = pinned.saturating_add(1);
                        }
                    } else {
                        // 无分配但状态为 pinning/pinned，视作缺失
                        missing = missing.saturating_add(1);
                    }
                }
            }
            // 事件上报（轻量只读）：不改变状态，仅供监控
            if sample > 0 {
                Self::deposit_event(Event::PinProbe(sample, pinning, pinned, missing));
            }
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：只读统计 - 读取某块到期列表的长度（便于前端/索引层分页）。
        pub fn due_at_count(block: BlockNumberFor<T>) -> u32 {
            DueQueue::<T>::get(block).len() as u32
        }
        /// 函数级中文注释：只读 - 在闭区间 [from, to] 返回非空到期列表的块号与长度元组（最多 512 条）。
        pub fn due_between(
            from: BlockNumberFor<T>,
            to: BlockNumberFor<T>,
        ) -> BoundedVec<(BlockNumberFor<T>, u32), ConstU32<512>> {
            let mut out: BoundedVec<(BlockNumberFor<T>, u32), ConstU32<512>> = Default::default();
            let (lo, hi) = if from <= to { (from, to) } else { (to, from) };
            let mut n = lo;
            while n <= hi {
                let c = DueQueue::<T>::get(n).len() as u32;
                if c > 0 {
                    let _ = out.try_push((n, c));
                }
                if out.len() as u32 >= 512 {
                    break;
                }
                n = n.saturating_add(1u32.into());
            }
            out
        }
        /// 函数级详细中文注释：扩散入队工具函数
        /// - 在 base..base+spread 范围内寻找首个未满的队列入队；全部满则放弃（避免单点拥塞）。
        #[inline]
        fn enqueue_due(cid: T::Hash, base_next: BlockNumberFor<T>) {
            let spread: u32 = DueEnqueueSpread::<T>::get();
            let mut inserted = false;
            for off in 0..=spread {
                let key = base_next.saturating_add(off.into());
                let mut v = DueQueue::<T>::get(key);
                if v.try_push(cid).is_ok() {
                    DueQueue::<T>::insert(key, v);
                    inserted = true;
                    break;
                }
            }
            if !inserted { /* 放弃，治理可通过扫描修复 */ }
        }
        /// 函数级详细中文注释：GET 请求帮助函数，返回主体字节（2xx 才返回）
        fn http_get_bytes(endpoint: &str, token: &Option<String>, path: &str) -> Option<Vec<u8>> {
            let url = alloc::format!("{}{}", endpoint, path);
            let mut req = http::Request::get(&url);
            if let Some(t) = token.as_ref() {
                req = req.add_header("Authorization", &alloc::format!("Bearer {}", t));
            }
            let timeout = sp_io::offchain::timestamp()
                .add(sp_runtime::offchain::Duration::from_millis(3_000));
            let pending = req.deadline(timeout).send().ok()?;
            // try_wait 返回 Result<Option<Response>, _> → ok()?.ok()? 解包为 Response
            let resp = pending.try_wait(timeout).ok()?.ok()?;
            let code: u16 = resp.code;
            if (200..300).contains(&code) {
                Some(resp.body().collect::<Vec<u8>>())
            } else {
                None
            }
        }

        /// 函数级详细中文注释：通过 OCW 发送 HTTP POST /pins 请求到 ipfs-cluster
        /// - 仅示例：构造最小 JSON 体，包含 `cid` 字段（此处我们只有 `cid_hash`，生产应由 OCW 从密文解出 CID）。
        /// - 返回：若 HTTP 状态为 2xx 则认为提交成功，随后发起 `mark_pinned` 外部交易。
        fn submit_pin_request(
            endpoint: &str,
            token: &Option<String>,
            cid_hash: T::Hash,
        ) -> Result<(), ()> {
            let cid_hex = hex::encode(cid_hash.as_ref());
            // 构造最小 JSON（根据你的 API 需要调整）
            let body_json = alloc::format!(r#"{{"cid":"{}"}}"#, cid_hex);
            let body_vec: Vec<u8> = body_json.into_bytes();
            let url = alloc::format!("{}/pins", endpoint);
            // 不用切片：使用 Vec<Vec<u8>> 作为 POST body，以满足 add_header/deadline 的 T: Default 约束
            let chunks: Vec<Vec<u8>> = alloc::vec![body_vec];
            let mut req = http::Request::post(&url, chunks);
            if let Some(t) = token.as_ref() {
                req = req
                    .add_header("Authorization", &alloc::format!("Bearer {}", t))
                    .add_header("Content-Type", "application/json");
            }
            let timeout = sp_io::offchain::timestamp()
                .add(sp_runtime::offchain::Duration::from_millis(5_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            let code: u16 = resp.code;
            if (200..300).contains(&code) {
                Ok(())
            } else {
                Err(())
            }
        }

        /// 函数级详细中文注释：通过 OCW 发送 HTTP DELETE /pins/{cid}（示例）
        /// - 某些环境下可用 `X-HTTP-Method-Override: DELETE` 搭配 POST 以规避代理限制。
        /// - 返回：2xx 视为成功；不触发上链，仅作为示例。
        #[allow(dead_code)]
        fn submit_delete_pin(
            endpoint: &str,
            token: &Option<String>,
            cid_str: &str,
        ) -> Result<(), ()> {
            let url = alloc::format!("{}/pins/{}", endpoint, cid_str);
            // 不用切片：空体使用 Vec<Vec<u8>>
            let chunks: Vec<Vec<u8>> = alloc::vec![Vec::new()];
            let mut req =
                http::Request::post(&url, chunks).add_header("X-HTTP-Method-Override", "DELETE");
            if let Some(t) = token.as_ref() {
                req = req.add_header("Authorization", &alloc::format!("Bearer {}", t));
            }
            let timeout = sp_io::offchain::timestamp()
                .add(sp_runtime::offchain::Duration::from_millis(5_000));
            let pending = req.deadline(timeout).send().map_err(|_| ())?;
            let resp = pending.try_wait(timeout).map_err(|_| ())?.map_err(|_| ())?;
            let code: u16 = resp.code;
            if (200..300).contains(&code) {
                Ok(())
            } else {
                Err(())
            }
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：只读接口——根据运营者账户派生对应的押金保留账户地址。
        pub fn operator_bond_account(operator: &T::AccountId) -> T::AccountId {
            T::SubjectPalletId::get()
                .try_into_sub_account((b"bond", operator))
                .expect("pallet sub-account derivation should not fail")
        }

        /// 函数级中文注释：只读接口——根据逝者 subject_id 派生其资金账户地址。
        pub fn subject_account(subject_id: u64) -> T::AccountId {
            T::SubjectPalletId::get()
                .try_into_sub_account((T::DeceasedDomain::get(), subject_id))
                .expect("pallet sub-account derivation should not fail")
        }
    }

    /// 权重占位：后续通过 benchmarking 填充
    pub trait WeightInfo {
        fn request_pin() -> Weight;
        fn mark_pinned() -> Weight;
        fn mark_pin_failed() -> Weight;
        /// 函数级中文注释：到期扣费，按 limit 线性增长（读写多项状态）。
        fn charge_due(limit: u32) -> Weight;
        /// 函数级中文注释：设置计费参数，常量级权重（少量读写）。
        fn set_billing_params() -> Weight;
    }
    impl WeightInfo for () {
        fn request_pin() -> Weight {
            Weight::from_parts(10_000, 0)
        }
        fn mark_pinned() -> Weight {
            Weight::from_parts(10_000, 0)
        }
        fn mark_pin_failed() -> Weight {
            Weight::from_parts(10_000, 0)
        }
        fn charge_due(limit: u32) -> Weight {
            // 简化：基准前权重估算（常数项 + 每件线性项）
            Weight::from_parts(20_000, 0)
                .saturating_add(Weight::from_parts(5_000, 0).saturating_mul(limit.into()))
        }
        fn set_billing_params() -> Weight {
            Weight::from_parts(20_000, 0)
        }
    }
}

/// 函数级详细中文注释：为 Pallet<T> 实现 IpfsPinner trait，供其他pallet调用
/// 
/// 实现说明：
/// - 直接调用现有的 `request_pin_for_deceased` 函数；
/// - 使用triple-charge机制自动扣费；
/// - 将请求添加到 PendingPins 队列，由OCW异步处理。
impl<T: Config> IpfsPinner<T::AccountId, T::Balance> for Pallet<T> {
    /// 函数级详细中文注释：为逝者关联的CID发起pin请求
    /// 
    /// 内部实现：
    /// 1. 将Vec<u8> CID转换为BoundedVec
    /// 2. 调用 `request_pin_for_deceased` extrinsic的内部逻辑
    /// 3. 使用 `triple_charge_storage_fee` 扣费
    /// 4. 将请求加入 PendingPins 队列
    fn pin_cid_for_deceased(
        caller: T::AccountId,
        deceased_id: u64,
        cid: Vec<u8>,
        price: T::Balance,
        replicas: u32,
    ) -> DispatchResult {
        use sp_runtime::traits::{Saturating, Hash};
        
        // 1. 验证参数
        ensure!(replicas >= 1 && replicas <= 5, Error::<T>::BadParams);
        ensure!(!cid.is_empty(), Error::<T>::BadParams);

        // 2. 计算CID hash（与现有代码保持一致）
        let cid_hash = T::Hashing::hash_of(&cid);
        
        // 3. 估算大小（简化：使用CID长度作为估算）
        let size_bytes = cid.len() as u64;

        // 4. 使用triple-charge扣费机制
        let _charge_source = Self::triple_charge_storage_fee(&caller, deceased_id, price)?;

        // 5. 插入PendingPins（与request_pin_for_deceased保持一致）
        PendingPins::<T>::insert(&cid_hash, (caller.clone(), replicas, deceased_id, size_bytes, price));
        
        // 6. 设置pin元数据
        let now = <frame_system::Pallet<T>>::block_number();
        PinMeta::<T>::insert(&cid_hash, (replicas, size_bytes, now, now));
        PinStateOf::<T>::insert(&cid_hash, 0u8); // 0 = Requested

        // 7. 登记计费信息
        let owner = T::OwnerProvider::owner_of(deceased_id).unwrap_or(caller.clone());
        PinSubjectOf::<T>::insert(&cid_hash, (owner.clone(), deceased_id));
        
        let period = BillingPeriodBlocks::<T>::get();
        let unit = PricePerGiBWeek::<T>::get();
        let next = now.saturating_add(period.into());
        PinBilling::<T>::insert(&cid_hash, (next, unit, 0u8));
        
        // 8. 加入到期队列（使用扩散入队策略）
        // 在 next..next+spread 范围内寻找首个未满的队列入队
        let spread: u32 = DueEnqueueSpread::<T>::get();
        for off in 0..=spread {
            let key = next.saturating_add(off.into());
            let mut v = DueQueue::<T>::get(key);
            if v.try_push(cid_hash).is_ok() {
                DueQueue::<T>::insert(key, v);
                break;
            }
        }
        // 如果全部满了，静默放弃（治理可通过扫描修复）

        // 9. 发出事件
        Self::deposit_event(Event::PinRequested(
            cid_hash, caller, replicas, size_bytes, price,
        ));

        Ok(())
    }

    /// 函数级详细中文注释：为墓位关联的CID发起pin请求
    /// 
    /// 注意：墓位维度使用特殊的deceased_id派生规则：
    /// - deceased_id = u64::MAX - grave_id（确保不与真实deceased_id冲突）
    /// - SubjectFunding账户派生时会使用该特殊ID
    /// 
    /// 这样可以：
    /// 1. 复用现有的SubjectFunding机制
    /// 2. 避免修改核心扣费逻辑
    /// 3. 保持语义清晰（通过特殊ID区分墓位与逝者）
    fn pin_cid_for_grave(
        caller: T::AccountId,
        grave_id: u64,
        cid: Vec<u8>,
        price: T::Balance,
        replicas: u32,
    ) -> DispatchResult {
        // 使用特殊映射规则：deceased_id = u64::MAX - grave_id
        // 确保不与真实deceased_id冲突（假设真实ID从0开始递增）
        let pseudo_deceased_id = u64::MAX.saturating_sub(grave_id);

        // 复用deceased的pin逻辑
        Self::pin_cid_for_deceased(caller, pseudo_deceased_id, cid, price, replicas)
    }
}

#[cfg(test)]
mod tests;
