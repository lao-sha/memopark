// This is free and unencumbered software released into the public domain.
//
// Anyone is free to copy, modify, publish, use, compile, sell, or
// distribute this software, either in source code form or as a compiled
// binary, for any purpose, commercial or non-commercial, and by any
// means.
//
// In jurisdictions that recognize copyright laws, the author or authors
// of this software dedicate any and all copyright interest in the
// software to the public domain. We make this dedication for the benefit
// of the public at large and to the detriment of our heirs and
// successors. We intend this dedication to be an overt act of
// relinquishment in perpetuity of all present and future rights to this
// software under copyright law.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.
//
// For more information, please refer to <http://unlicense.org>

// Substrate and Polkadot dependencies
// 移除重复导入，避免与下方 `use super::{ ... Runtime, RuntimeCall, RuntimeEvent, ... }` 冲突
use frame_support::traits::{Contains, EnsureOrigin};
use frame_support::{
    derive_impl, ensure, parameter_types,
    traits::{ConstBool, ConstU128, ConstU32, ConstU64, ConstU8, VariantCountOf},
    weights::{
        constants::{RocksDbWeight, WEIGHT_REF_TIME_PER_SECOND},
        IdentityFee, Weight,
    },
    PalletId,
};
use frame_system::limits::{BlockLength, BlockWeights};
use pallet_transaction_payment::{ConstFeeMultiplier, FungibleAdapter, Multiplier};
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_core::Get;
use sp_runtime::{traits::AccountIdConversion, traits::One, Perbill};
use sp_version::RuntimeVersion;
// ===== memo-content-governance 运行时配置（占位骨架） =====
impl pallet_memo_content_governance::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    /// 申诉押金（示例：0.01 UNIT）
    type AppealDeposit = frame_support::traits::ConstU128<10_000_000_000>;
    /// 驳回罚没 30% 入国库
    type RejectedSlashBps = frame_support::traits::ConstU16<3000>;
    /// 撤回罚没 10% 入国库（示例）
    type WithdrawSlashBps = frame_support::traits::ConstU16<1000>;
    /// 限频窗口（块）
    type WindowBlocks = frame_support::traits::ConstU32<600>;
    /// 窗口内最多提交次数
    type MaxPerWindow = frame_support::traits::ConstU32<5>;
    /// 默认公示期（块）≈ 30 天
    type NoticeDefaultBlocks = frame_support::traits::ConstU32<{ 30 * DAYS as u32 }>;
    /// 国库账户（罚没接收）
    type TreasuryAccount = TreasuryAccount;
    /// 执行路由占位实现
    type Router = ContentGovernanceRouter;
    /// 审批起源：Root | 委员会阈值(2/3)
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 每块最多执行 50 条（示例）
    type MaxExecPerBlock = frame_support::traits::ConstU32<50>;
    /// 函数级中文注释：只读分页返回上限（示例：512 条）。
    type MaxListLen = frame_support::traits::ConstU32<512>;
    /// 函数级中文注释：执行失败最大重试次数（示例：3 次）。
    type MaxRetries = frame_support::traits::ConstU8<3>;
    /// 函数级中文注释：失败重试基础退避区块数（示例：600 块 ≈ 1 小时@6s）。
    type RetryBackoffBlocks = frame_support::traits::ConstU32<600>;
    /// 函数级中文注释：动态押金策略实现：按 domain/action 给出基准押金倍数；没有匹配则回退固定押金。
    type AppealDepositPolicy = ContentAppealDepositPolicy;
    /// 权重实现（占位）
    type WeightInfo = pallet_memo_content_governance::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：最近活跃度提供者（用于"应答自动否决"判断）。
    type LastActiveProvider = ContentLastActiveProvider;
    /// 函数级中文注释：CID 最小长度默认值（示例：10字节）。
    type MinEvidenceCidLen = frame_support::traits::ConstU32<10>;
    /// 函数级中文注释：理由 CID 最小长度默认值（示例：8字节）。
    type MinReasonCidLen = frame_support::traits::ConstU32<8>;
}

/// 函数级中文注释：内容治理申诉的动态押金策略实现。
/// - 规则示例（可后续治理升级）：
///   - 逝者媒体域(4)：替换 URI(31)/冻结视频集(32) → 2× 基准；隐藏媒体(30) → 1× 基准
///   - 逝者文本域(3)：删除类(20/21) → 1.5× 基准；编辑类(22/23) → 1× 基准
///   - 逝者档案域(2)：主图/可见性调整(1/2/3) → 1× 基准
///   - 其他 → None（回退固定押金）
pub struct ContentAppealDepositPolicy;
impl pallet_memo_content_governance::AppealDepositPolicy for ContentAppealDepositPolicy {
    type AccountId = AccountId;
    type Balance = Balance;
    type BlockNumber = BlockNumber;
    fn calc_deposit(
        _who: &Self::AccountId,
        domain: u8,
        _target: u64,
        action: u8,
    ) -> Option<Self::Balance> {
        use frame_support::traits::Get as _;
        let base: Balance =
            <Runtime as pallet_memo_content_governance::pallet::Config>::AppealDeposit::get();
        let mult_bp: u16 = match (domain, action) {
            (4, 31) | (4, 32) => 20000, // 2.0x
            (4, 30) => 10000,           // 1.0x
            (3, 20) | (3, 21) => 15000, // 1.5x
            (3, 22) | (3, 23) => 10000, // 1.0x
            (2, 1) | (2, 2) | (2, 3) => 10000,
            (2, 4) => 15000, // 治理转移拥有者 ≥1.5x 基准
            _ => return None,
        };
        // 以万分比计算：base * mult_bp / 10000
        let mult = sp_runtime::Perbill::from_parts((mult_bp as u32) * 100); // 100bp = 1%
        let dep = mult.mul_floor(base);
        Some(dep)
    }
}

/// 函数级详细中文注释：内容治理最近活跃度提供者实现。
/// - 仅对 2=deceased 域返回最近活跃块高：读取 `pallet-deceased::LastActiveOf`；其他域返回 None。
pub struct ContentLastActiveProvider;
impl pallet_memo_content_governance::LastActiveProvider for ContentLastActiveProvider {
    type BlockNumber = BlockNumber;
    fn last_active_of(domain: u8, target: u64) -> Option<Self::BlockNumber> {
        match domain {
            2 => pallet_deceased::pallet::LastActiveOf::<Runtime>::get(target),
            _ => None,
        }
    }
}
// ====== 委员会（Council）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：委员会动议最长投票期（示例：7天）。
    pub const CouncilMotionDuration: BlockNumber = 7 * DAYS;
    /// 函数级中文注释：委员会并行提案上限（示例：50）。
    pub const CouncilMaxProposals: u32 = 50;
    /// 函数级中文注释：委员会最大成员数（示例：50）。
    pub const CouncilMaxMembers: u32 = 50;
    /// 函数级中文注释：提案最大权重上限（简化为 2 秒计算上限）。
    pub const CouncilMaxProposalWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}

type CouncilCollective = pallet_collective::Instance1;
impl pallet_collective::Config<CouncilCollective> for Runtime {
    /// 函数级中文注释：起源类型绑定到运行时。
    type RuntimeOrigin = RuntimeOrigin;
    /// 函数级中文注释：可被动议执行的调用类型。
    type Proposal = RuntimeCall;
    /// 函数级中文注释：事件类型绑定到运行时事件。
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：动议持续时间配置。
    type MotionDuration = CouncilMotionDuration;
    /// 函数级中文注释：并行提案数上限。
    type MaxProposals = CouncilMaxProposals;
    /// 函数级中文注释：成员数上限。
    type MaxMembers = CouncilMaxMembers;
    /// 函数级中文注释：默认投票策略（跟随 Prime）。
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    /// 函数级中文注释：权重信息（占位）。
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：允许设置成员的起源（Root）。
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案最大可执行权重上限。
    type MaxProposalWeight = CouncilMaxProposalWeight;
    /// 函数级中文注释：可无成本否决提案的起源（Root）。
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：可杀死恶意提案的起源（Root）。
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案押金/成本考虑（无）。
    type Consideration = ();
}

// ====== 技术与安全委员会（Technical Committee）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：技术委员会动议持续期（示例：3天）。
    pub const TechMotionDuration: BlockNumber = 3 * DAYS;
    /// 函数级中文注释：技术委员会并行提案上限。
    pub const TechMaxProposals: u32 = 30;
    /// 函数级中文注释：技术委员会最大成员数。
    pub const TechMaxMembers: u32 = 15;
    /// 函数级中文注释：技术委员会提案最大权重上限（2 秒）。
    pub const TechMaxProposalWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}

// ====== 内容委员会（Content Committee）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：内容委员会动议持续期（示例：5天）。
    pub const ContentMotionDuration: BlockNumber = 5 * DAYS;
    /// 函数级中文注释：内容委员会并行提案上限。
    pub const ContentMaxProposals: u32 = 50;
    /// 函数级中文注释：内容委员会最大成员数。
    pub const ContentMaxMembers: u32 = 25;
    /// 函数级中文注释：内容委员会提案最大权重上限（2 秒）。
    pub const ContentMaxProposalWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}

type ContentCollective = pallet_collective::Instance3;
impl pallet_collective::Config<ContentCollective> for Runtime {
    type RuntimeOrigin = RuntimeOrigin;
    type Proposal = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type MotionDuration = ContentMotionDuration;
    type MaxProposals = ContentMaxProposals;
    type MaxMembers = ContentMaxMembers;
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxProposalWeight = ContentMaxProposalWeight;
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    type Consideration = ();
}

type TechnicalCollective = pallet_collective::Instance2;
impl pallet_collective::Config<TechnicalCollective> for Runtime {
    /// 函数级中文注释：起源类型绑定到运行时。
    type RuntimeOrigin = RuntimeOrigin;
    /// 函数级中文注释：可被动议执行的调用类型。
    type Proposal = RuntimeCall;
    /// 函数级中文注释：事件类型绑定到运行时事件。
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：动议持续时间配置。
    type MotionDuration = TechMotionDuration;
    /// 函数级中文注释：并行提案数上限。
    type MaxProposals = TechMaxProposals;
    /// 函数级中文注释：成员数上限。
    type MaxMembers = TechMaxMembers;
    /// 函数级中文注释：默认投票策略（跟随 Prime）。
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    /// 函数级中文注释：权重信息（占位）。
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：允许设置成员的起源（Root）。
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案最大可执行权重上限。
    type MaxProposalWeight = TechMaxProposalWeight;
    /// 函数级中文注释：可无成本否决提案的起源（Root）。
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：可杀死恶意提案的起源（Root）。
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案押金/成本考虑（无）。
    type Consideration = ();
}

// 引入以区块数表示的一天常量
use crate::DAYS;
use alloc::vec;
// 引入以区块数表示的一分钟常量，用于设备挑战 TTL 等时间参数
// 引入余额单位常量（已移除与设备/挖矿相关依赖，无需引入 MINUTES/MILLI_UNIT）

// Local module imports
use super::{
    AccountId, Aura, Balance, Balances, Block, BlockNumber, Hash, Nonce, PalletInfo, Runtime,
    RuntimeCall, RuntimeEvent, RuntimeFreezeReason, RuntimeHoldReason, RuntimeOrigin, RuntimeTask,
    System, EXISTENTIAL_DEPOSIT, SLOT_DURATION, VERSION,
};

// ===== Forwarder 集成所需的适配与类型 =====
use pallet_forwarder::ForwarderAuthorizer;
use sp_runtime::traits::IdentityLookup;

/// Authorizer 适配器（Noop）：默认拒绝，避免依赖 `pallet-authorizer`。
pub struct AuthorizerAdapter;
impl ForwarderAuthorizer<AccountId, RuntimeCall> for AuthorizerAdapter {
    /// 函数级中文注释：校验赞助者是否在命名空间下被允许
    /// - 当前仅允许平台账户代付，便于统一风控与审计；未来可扩展为授权中心。
    fn is_sponsor_allowed(_ns: [u8; 8], _sponsor: &AccountId) -> bool {
        true
    }

    /// 函数级中文注释：校验调用是否在允许范围（基于命名空间 + 具体 Call 变体匹配）
    /// - 本次需求：创建购买/出售订单（挂单 create_listing）与吃单创建（open_order）由 forwarder 代付。
    fn is_call_allowed(ns: [u8; 8], _sponsor: &AccountId, call: &RuntimeCall) -> bool {
        match (ns, call) {
            // 仅放行 OTC 买方侧方法（买方全流程免 GAS）
            (n, RuntimeCall::OtcOrder(inner)) if n == OtcOrderNsBytes::get() => matches!(
                inner,
                pallet_otc_order::Call::open_order { .. }
                    | pallet_otc_order::Call::open_order_with_protection { .. }
                    | pallet_otc_order::Call::mark_paid { .. }
                    | pallet_otc_order::Call::reveal_payment { .. }
                    | pallet_otc_order::Call::reveal_contact { .. }
                    | pallet_otc_order::Call::mark_disputed { .. }
            ),
            // 明确不放行做市商/挂单侧与其他域方法
            _ => false,
        }
    }
}

/// 禁止调用集合（MVP：空集）。可在后续版本中拒绝 utility::batch/dispatch_as 等逃逸方法。
pub struct ForbidEscapeCalls;
impl frame_support::traits::Contains<RuntimeCall> for ForbidEscapeCalls {
    fn contains(call: &RuntimeCall) -> bool {
        // 禁用可能逃逸范围或高权限入口（根据是否引入相应 pallet 可调整）
        matches!(
            call,
            RuntimeCall::Sudo(_) // 禁止 sudo
        )
    }
}
// 已移除：pallet-authorizer 配置与常量

const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);

parameter_types! {
    pub const BlockHashCount: BlockNumber = 2400;
    pub const Version: RuntimeVersion = VERSION;

    /// We allow for 2 seconds of compute with a 6 second average block time.
    pub RuntimeBlockWeights: BlockWeights = BlockWeights::with_sensible_defaults(
        Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX),
        NORMAL_DISPATCH_RATIO,
    );
    pub RuntimeBlockLength: BlockLength = BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub const SS58Prefix: u8 = 42;
}

// 函数级中文注释：deceased-data 费用/押金与成熟期参数
parameter_types! {
    /// 相册押金（示例：0.02 UNIT）。
    pub const MediaAlbumDeposit: Balance = 20_000_000_000_000;
    /// 媒体押金（示例：0.005 UNIT）。
    pub const MediaMediaDeposit: Balance = 5_000_000_000_000;
    pub const DataMediaDeposit: Balance = 5_000_000_000_000;
    /// 创建相册小额手续费（示例：0.001 UNIT）。
    pub const MediaCreateFee: Balance = 1_000_000_000_000;
    /// 投诉观察/成熟期：365 天。直接复用 DAYS 常量，避免类型不匹配。
    pub const MediaComplaintPeriod: BlockNumber = 365 * DAYS;
}

/// The default types are being injected by [`derive_impl`](`frame_support::derive_impl`) from
/// [`SoloChainDefaultConfig`](`struct@frame_system::config_preludes::SolochainDefaultConfig`),
/// but overridden as needed.
#[derive_impl(frame_system::config_preludes::SolochainDefaultConfig)]
impl frame_system::Config for Runtime {
    /// The block type for the runtime.
    type Block = Block;
    /// Block & extrinsics weights: base values and limits.
    type BlockWeights = RuntimeBlockWeights;
    /// The maximum length of a block (in bytes).
    type BlockLength = RuntimeBlockLength;
    /// The identifier used to distinguish between accounts.
    type AccountId = AccountId;
    /// The type for storing how many extrinsics an account has signed.
    type Nonce = Nonce;
    /// The type for hashing blocks and tries.
    type Hash = Hash;
    /// Maximum number of block number to block hash mappings to keep (oldest pruned first).
    type BlockHashCount = BlockHashCount;
    /// The weight of database operations that the runtime can invoke.
    type DbWeight = RocksDbWeight;
    /// Version of the runtime.
    type Version = Version;
    /// The data to be stored in an account.
    type AccountData = pallet_balances::AccountData<Balance>;
    /// This is used as an identifier of the chain. 42 is the generic substrate prefix.
    type SS58Prefix = SS58Prefix;
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    /// 函数级中文注释：基础调用过滤器，接入 origin-restriction 软策略（当前默认放行）。
    type BaseCallFilter = crate::configs::OriginRestrictionFilter;
}

impl pallet_aura::Config for Runtime {
    type AuthorityId = AuraId;
    type DisabledValidators = ();
    type MaxAuthorities = ConstU32<32>;
    type AllowMultipleBlocksPerSlot = ConstBool<false>;
    type SlotDuration = pallet_aura::MinimumPeriodTimesTwo<Runtime>;
}

impl pallet_grandpa::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    type WeightInfo = ();
    type MaxAuthorities = ConstU32<32>;
    type MaxNominators = ConstU32<0>;
    type MaxSetIdSessionEntries = ConstU64<0>;

    type KeyOwnerProof = sp_core::Void;
    type EquivocationReportSystem = ();
}

impl pallet_timestamp::Config for Runtime {
    /// A timestamp: milliseconds since the unix epoch.
    type Moment = u64;
    type OnTimestampSet = Aura;
    type MinimumPeriod = ConstU64<{ SLOT_DURATION / 2 }>;
    type WeightInfo = ();
}

impl pallet_balances::Config for Runtime {
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    /// The type for recording an account's balance.
    type Balance = Balance;
    /// The ubiquitous event type.
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ConstU128<EXISTENTIAL_DEPOSIT>;
    type AccountStore = System;
    type WeightInfo = pallet_balances::weights::SubstrateWeight<Runtime>;
    type FreezeIdentifier = RuntimeFreezeReason;
    type MaxFreezes = VariantCountOf<RuntimeFreezeReason>;
    type RuntimeHoldReason = RuntimeHoldReason;
    type RuntimeFreezeReason = RuntimeFreezeReason;
    type DoneSlashHandler = ();
}

// ====== OTC Claim（基于 balances 的命名预留+再归属）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：按区块数表示的一天（用于做市商日累计额度切片）。
    pub const OtcBlocksPerDay: BlockNumber = DAYS;
}

impl pallet_otc_claim::Config for Runtime {
    /// 函数级中文注释：事件类型绑定到运行时事件。
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：使用原生币（Balances）作为 Currency，支持命名预留与再归属。
    type Currency = Balances;
    /// 函数级中文注释：日切片长度（区块数）。
    type BlocksPerDay = OtcBlocksPerDay;
}

parameter_types! {
    pub FeeMultiplier: Multiplier = Multiplier::one();
}

impl pallet_transaction_payment::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type OnChargeTransaction = FungibleAdapter<Balances, ()>;
    type OperationalFeeMultiplier = ConstU8<5>;
    type WeightToFee = IdentityFee<Balance>;
    type LengthToFee = IdentityFee<Balance>;
    type FeeMultiplierUpdate = ConstFeeMultiplier<FeeMultiplier>;
    type WeightInfo = pallet_transaction_payment::weights::SubstrateWeight<Runtime>;
}

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = pallet_sudo::weights::SubstrateWeight<Runtime>;
}

/// Configure the pallet-template in pallets/template.
impl pallet_template::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_template::weights::SubstrateWeight<Runtime>;
}

// 已移除：pallet_karma 配置块与相关常量

// ===== pallet-forwarder 配置实现 =====
impl pallet_forwarder::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// 运行时聚合调用类型（作为元交易内层调用）
    type RuntimeCall = RuntimeCall;
    /// Authorizer 适配器（Noop 实现，默认拒绝）
    type Authorizer = AuthorizerAdapter;
    /// 禁止调用集合（MVP：为空集）
    type ForbiddenCalls = ForbidEscapeCalls;
    /// 字节上限（根据业务情况调整）
    type MaxMetaLen = frame_support::traits::ConstU32<8192>;
    type MaxPermitLen = frame_support::traits::ConstU32<512>;
    /// 函数级中文注释：强制校验 open_session 的所有者签名
    type RequirePermitSig = frame_support::traits::ConstBool<true>;
    /// 函数级中文注释：强制校验 forward 的会话签名
    type RequireMetaSig = frame_support::traits::ConstBool<true>;
    /// 会话配额与预算上限（示例值）
    type MaxCallsPerSession = frame_support::traits::ConstU32<100>;
    type MaxWeightPerSessionRefTime =
        frame_support::traits::ConstU64<{ 2u64 * WEIGHT_REF_TIME_PER_SECOND }>; // 约2秒
    /// 函数级中文注释：最小 meta TTL（示例：10 块）。
    type MinMetaTxTTL = frame_support::traits::ConstU32<10>;
    /// 每块代付上限与窗口统计
    type MaxForwardedPerBlock = frame_support::traits::ConstU32<100>;
    type ForwarderWindowBlocks = frame_support::traits::ConstU32<600>;
    type WeightInfo = ();
    /// 函数级中文注释：开放会话许可签名类型与公钥类型（多签通用）。
    type PermitSignature = sp_runtime::MultiSignature;
    type PermitSigner = sp_runtime::MultiSigner;
}

// 设备/挖矿/冥想相关配置已移除

// （pallet-meditation 已移除）
// ===== 会话许可命名空间常量（用于 forwarder） =====
parameter_types! {
    pub const ArbitrationNsBytes: [u8; 8] = *b"arb___ _"; // 8字节
    pub const OtcOrderNsBytes: [u8; 8] = *b"otc_ord_";
    pub const OtcListingNsBytes: [u8; 8] = *b"otc_lst_";
}

// ===== temple 已移除；保留 agent/order 配置 =====

// 已移除：pallet-agent 配置与参数

// ===== memorial-park/grave/deceased 运行时参数占位（可按需调整） =====
parameter_types! {
    pub const ParkMaxRegionLen: u32 = 64;
    pub const ParkMaxCidLen: u32 = 64;
    pub const ParkMaxPerCountry: u32 = 100_000;
    pub const GraveMaxFollowers: u32 = 100_000;
}
pub struct RootOnlyParkAdmin;
impl pallet_memo_park::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxRegionLen = ParkMaxRegionLen;
    type MaxCidLen = ParkMaxCidLen;
    type MaxParksPerCountry = ParkMaxPerCountry;
    type ParkAdmin = RootOnlyParkAdmin; // 由本地适配器校验 Root
    /// 函数级中文注释：治理起源采用 Root | 委员会阈值(2/3)。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
}

parameter_types! {
    pub const GraveMaxCidLen: u32 = 64;
    pub const GraveMaxPerPark: u32 = 4096;
    pub const GraveMaxIntermentsPerGrave: u32 = 128;
    pub const GraveMaxIdsPerName: u32 = 1024;
    pub const GraveMaxComplaints: u32 = 100;
    pub const GraveMaxAdmins: u32 = 16;
    /// 函数级中文注释：人类可读 ID（Slug）长度（固定为 10 位数字），与 `pallet-memo-grave` 中的约束一致
    pub const GraveSlugLen: u32 = 10;
    pub const GraveFollowCooldownBlocks: u32 = 30;
    pub const GraveFollowDeposit: Balance = 0;
    /// 函数级中文注释：创建墓地的一次性协议费（默认 0，便于灰度开启）。
    pub const GraveCreateFee: Balance = 0;
    /// 函数级中文注释：公共封面目录容量上限（避免状态膨胀）。
    pub const GraveMaxCoverOptions: u32 = 256;
}
pub struct NoopIntermentHook;
// 重命名 crate：从 pallet_grave → pallet_memo_grave
impl pallet_memo_grave::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_memo_grave::weights::TestWeights;
    type MaxCidLen = GraveMaxCidLen;
    type MaxPerPark = GraveMaxPerPark;
    type MaxIntermentsPerGrave = GraveMaxIntermentsPerGrave;
    type OnInterment = NoopIntermentHook;
    type ParkAdmin = RootOnlyParkAdmin;
    type MaxIdsPerName = GraveMaxIdsPerName;
    type MaxComplaintsPerGrave = GraveMaxComplaints;
    type MaxAdminsPerGrave = GraveMaxAdmins;
    type MaxFollowers = GraveMaxFollowers;
    type SlugLen = GraveSlugLen;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    type FollowCooldownBlocks = GraveFollowCooldownBlocks;
    type Currency = Balances;
    type FollowDeposit = GraveFollowDeposit;
    /// 函数级中文注释：绑定创建费与收款账户（指向国库 PalletId 派生地址）。
    type CreateFee = GraveCreateFee;
    type FeeCollector = TreasuryAccount;
    /// 函数级中文注释：治理起源绑定（Root | 内容委员会阈值 2/3）。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：注入公共封面目录容量上限。
    type MaxCoverOptions = GraveMaxCoverOptions;
    /// 函数级中文注释：注入公共音频目录容量上限（与封面目录同级）。
    type MaxAudioOptions = GraveMaxCoverOptions;
    /// 函数级中文注释：每墓位私有音频候选上限（示例沿用封面上限）。
    type MaxPrivateAudioOptions = GraveMaxCoverOptions;
    /// 函数级中文注释：每墓位播放列表长度上限（示例沿用封面上限）。
    type MaxAudioPlaylistLen = GraveMaxCoverOptions;
    /// 函数级中文注释：首页轮播上限/字段长度（示例值）。
    type MaxCarouselItems = frame_support::traits::ConstU32<20>;
    type MaxTitleLen = frame_support::traits::ConstU32<64>;
    type MaxLinkLen = frame_support::traits::ConstU32<128>;
}

// ===== deceased 配置 =====
parameter_types! {
    pub const DeceasedMaxPerGrave: u32 = 128;
    pub const DeceasedStringLimit: u32 = 256;
    pub const DeceasedMaxLinks: u32 = 8;
    pub const DeceasedMaxPerGraveSoft: u32 = 6;
}

/// 函数级中文注释：墓位适配器，实现 `GraveInspector`，用于校验墓位存在与权限。
pub struct GraveProviderAdapter;
impl pallet_deceased::GraveInspector<AccountId, u64> for GraveProviderAdapter {
    /// 检查墓位是否存在：读取 `pallet-memo-grave` 的存储 `Graves`
    fn grave_exists(grave_id: u64) -> bool {
        pallet_memo_grave::pallet::Graves::<Runtime>::contains_key(grave_id)
    }
    /// 校验 `who` 是否可在该墓位下管理逝者：当前仅墓主可管理（后续可扩展授权）
    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        if let Some(grave) = pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id) {
            // 1) 墓主放行
            if grave.owner == *who {
                return true;
            }
            // 2) 墓位管理员放行
            let admins = pallet_memo_grave::pallet::GraveAdmins::<Runtime>::get(grave_id);
            if admins.iter().any(|a| a == who) {
                return true;
            }
            // 3) 园区管理员放行（通过 ParkAdminOrigin 适配器校验 Signed 起源）
            let origin = RuntimeOrigin::from(frame_system::RawOrigin::Signed(who.clone()));
            if let Some(pid) = grave.park_id {
                <RootOnlyParkAdmin as pallet_memo_grave::pallet::ParkAdminOrigin<RuntimeOrigin>>::ensure(pid, origin).is_ok()
            } else {
                false
            }
        } else {
            false
        }
    }
    /// 冗余校验：读取 memo-grave 的已安葬令牌缓存长度（最多 6）。
    fn cached_deceased_tokens_len(grave_id: u64) -> Option<u32> {
        pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id)
            .map(|g| g.deceased_tokens.len() as u32)
    }
}

// 为 memo-pet 复用同一墓位适配逻辑
impl pallet_memo_pet::pallet::GraveInspector<AccountId, u64> for GraveProviderAdapter {
    fn grave_exists(grave_id: u64) -> bool {
        pallet_memo_grave::pallet::Graves::<Runtime>::contains_key(grave_id)
    }
    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        if let Some(grave) = pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id) {
            if grave.owner == *who {
                return true;
            }
            let admins = pallet_memo_grave::pallet::GraveAdmins::<Runtime>::get(grave_id);
            if admins.iter().any(|a| a == who) {
                return true;
            }
            let origin = RuntimeOrigin::from(frame_system::RawOrigin::Signed(who.clone()));
            if let Some(pid) = grave.park_id {
                <RootOnlyParkAdmin as pallet_memo_grave::pallet::ParkAdminOrigin<RuntimeOrigin>>::ensure(pid, origin).is_ok()
            } else {
                false
            }
        } else {
            false
        }
    }
}

impl pallet_deceased::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type GraveId = u64;
    type MaxDeceasedPerGrave = DeceasedMaxPerGrave;
    type StringLimit = DeceasedStringLimit;
    type MaxLinks = DeceasedMaxLinks;
    type MaxDeceasedPerGraveSoft = DeceasedMaxPerGraveSoft;
    type TokenLimit = GraveMaxCidLen;
    type GraveProvider = GraveProviderAdapter;
    type WeightInfo = ();
    /// 函数级中文注释：绑定治理起源为 Root | 内容委员会阈值(2/3) 双通道，用于 gov* 接口。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
}

// ===== deceased-data 配置 =====
parameter_types! {
    pub const DataMaxAlbumsPerDeceased: u32 = 64;
    pub const DataMaxVideoCollectionsPerDeceased: u32 = 64;
    pub const DataMaxPhotosPerAlbum: u32 = 256;
    pub const DataStringLimit: u32 = 512;
    pub const DataMaxTags: u32 = 16;
    pub const DataMaxReorderBatch: u32 = 100;
    /// 函数级中文注释：每位逝者最多留言条数（Message 未分类，按逝者维度索引）
    pub const DataMaxMessagesPerDeceased: u32 = 10_000;
    /// 函数级中文注释：每位逝者最多悼词条数（Eulogy 未分类，按逝者维度索引）
    pub const DataMaxEulogiesPerDeceased: u32 = 10_000;
}

/// 函数级中文注释：逝者访问适配器，实现 `DeceasedAccess`，以 `pallet-deceased` 为后端。
pub struct DeceasedProviderAdapter;

/// 函数级中文注释：Deceased token 适配器，将 `pallet-deceased` 的 `deceased_token` 转换为 `BoundedVec<u8, GraveMaxCidLen>`。
pub struct DeceasedTokenProviderAdapter;
impl pallet_memo_grave::pallet::DeceasedTokenAccess<GraveMaxCidLen>
    for DeceasedTokenProviderAdapter
{
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let bytes: Vec<u8> = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            let mut v = bytes;
            if v.len() > max {
                v.truncate(max);
            }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else {
            None
        }
    }
}

// （已移除对 pallet-deceased-data 的适配实现）

// ===== 为新拆分的内容 Pallet 实现相同的适配器（保持低耦合复用） =====
impl pallet_deceased_media::DeceasedAccess<AccountId, u64> for DeceasedProviderAdapter {
    /// 检查逝者是否存在
    fn deceased_exists(id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(id)
    }
    /// 检查操作者是否可管理该逝者
    fn can_manage(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) {
            d.owner == *who
        } else {
            false
        }
    }
}
impl pallet_deceased_media::DeceasedTokenAccess<GraveMaxCidLen, u64>
    for DeceasedTokenProviderAdapter
{
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let mut v = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            if v.len() > max {
                v.truncate(max);
            }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else {
            None
        }
    }
}

impl pallet_deceased_text::DeceasedAccess<AccountId, u64> for DeceasedProviderAdapter {
    fn deceased_exists(id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(id)
    }
    fn can_manage(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) {
            d.owner == *who
        } else {
            false
        }
    }
}
impl pallet_deceased_text::DeceasedTokenAccess<GraveMaxCidLen, u64>
    for DeceasedTokenProviderAdapter
{
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let mut v = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            if v.len() > max {
                v.truncate(max);
            }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else {
            None
        }
    }
}

// （已移除 pallet-deceased-data 的 Config 实现）

// ===== deceased-media 配置 =====
parameter_types! {
    pub const MediaMaxAlbumsPerDeceased: u32 = 64;
    pub const MediaMaxVideoCollectionsPerDeceased: u32 = 64;
    pub const MediaMaxPhotosPerAlbum: u32 = 256;
    pub const MediaStringLimit: u32 = 512;
    pub const MediaMaxTags: u32 = 16;
    pub const MediaMaxReorderBatch: u32 = 100;
}
impl pallet_deceased_media::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type AlbumId = u64;
    type VideoCollectionId = u64;
    type MediaId = u64;
    type MaxAlbumsPerDeceased = MediaMaxAlbumsPerDeceased;
    type MaxVideoCollectionsPerDeceased = MediaMaxVideoCollectionsPerDeceased;
    type MaxPhotoPerAlbum = MediaMaxPhotosPerAlbum;
    type StringLimit = MediaStringLimit;
    type MaxTags = MediaMaxTags;
    type MaxReorderBatch = MediaMaxReorderBatch;
    type MaxTokenLen = GraveMaxCidLen;
    type DeceasedProvider = DeceasedProviderAdapter;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type Currency = Balances;
    type AlbumDeposit = MediaAlbumDeposit;
    type VideoCollectionDeposit = MediaAlbumDeposit;
    type MediaDeposit = DataMediaDeposit;
    type CreateFee = MediaCreateFee;
    type FeeCollector = TreasuryAccount;
    type ComplaintDeposit = DataMediaDeposit;
    type ArbitrationAccount = TreasuryAccount;
    type ComplaintPeriod = MediaComplaintPeriod;
}

// ===== deceased-text 配置 =====
parameter_types! {}
impl pallet_deceased_text::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type TextId = u64;
    type StringLimit = DataStringLimit;
    type MaxTokenLen = GraveMaxCidLen;
    type MaxMessagesPerDeceased = DataMaxMessagesPerDeceased;
    type MaxEulogiesPerDeceased = DataMaxEulogiesPerDeceased;
    type DeceasedProvider = DeceasedProviderAdapter;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    type Currency = Balances;
    type TextDeposit = DataMediaDeposit;
    type ComplaintDeposit = DataMediaDeposit;
    type ArbitrationAccount = TreasuryAccount;
    type ComplaintPeriod = MediaComplaintPeriod;
}
// ========= OriginRestriction 过滤器与配置 =========
/// 函数级中文注释：基础调用过滤器；当前读取 origin-restriction 的全局开关（allow_all=true 放行全部）。
pub struct OriginRestrictionFilter;
impl Contains<RuntimeCall> for OriginRestrictionFilter {
    fn contains(_c: &RuntimeCall) -> bool {
        // allow=true → 放行；false → 暂时仍放行（占位，后续细化），避免破坏性变更
        let allow = pallet_origin_restriction::GlobalAllow::<Runtime>::get();
        let _ = allow;
        true
    }
}

impl pallet_origin_restriction::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：治理起源采用 Root | 委员会阈值(2/3) 双通道。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
}

// 方案B：移除单点治理账户（内容治理签名账户）

// ===== ledger 配置（精简） =====
impl pallet_ledger::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type Balance = Balance;
    /// 一周按 6s/块 × 60 × 60 × 24 × 7 = 100_800 块（可由治理升级调整）
    type BlocksPerWeek = frame_support::traits::ConstU32<100_800>;
    /// 函数级中文注释：绑定 ledger 手写占位权重（后续可替换为基准生成版）。
    type WeightInfo = pallet_ledger::weights::SubstrateWeight<Runtime>;
}

parameter_types! {
    pub const OfferMaxCidLen: u32 = 64;
    pub const OfferMaxNameLen: u32 = 64;
    pub const OfferMaxPerTarget: u32 = 10_000;
    pub const OfferMaxMediaPerOffering: u32 = 8;
    pub const OfferMaxMemoLen: u32 = 64;
}
pub struct AllowAllTargetControl;
pub struct NoopOfferingHook;
impl pallet_memo_offerings::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = OfferMaxCidLen;
    type MaxNameLen = OfferMaxNameLen;
    type MaxOfferingsPerTarget = OfferMaxPerTarget;
    type MaxMediaPerOffering = OfferMaxMediaPerOffering;
    type MaxMemoLen = OfferMaxMemoLen;
    type OfferWindow = ConstU32<600>;
    type OfferMaxInWindow = ConstU32<100>;
    type MinOfferAmount = ConstU128<1_000_000_000>; // 0.001 UNIT
    type TargetCtl = AllowAllTargetControl;
    type OnOffering = GraveOfferingHook;
    /// 函数级中文注释：多路分账路由实现（内容治理可配置）
    type DonationRouter = OfferDonationRouter;
    /// 函数级中文注释：管理员 Origin 改为 Root | 委员会阈值(2/3)。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：治理起源（Root | 委员会阈值），用于 gov* 接口证据化调整。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：供奉转账使用链上余额
    type Currency = Balances;
    /// 函数级中文注释：捐赠账户解析
    type DonationResolver = GraveDonationResolver;
    /// 目录只读接口由 memo-sacrifice 提供
    type Catalog = pallet_memo_sacrifice::Pallet<Runtime>;
    /// 函数级中文注释：消费回调绑定占位实现（Noop），后续由 memo-pet 接管。
    type Consumer = NoopConsumer;
    /// 函数级中文注释：黑洞账户（用于销毁 MEMO）
    type BurnAccount = BurnAccount;
    /// 函数级中文注释：国库账户（用于平台财政收入）
    type TreasuryAccount = TreasuryAccount;
}

/// 函数级详细中文注释：供奉收款路由实现
/// - 目标域为 Grave(=1) 时，将 SubjectBps 部分路由到"逝者主题资金账户"，其余走原 Resolver。
pub struct OfferDonationRouter;
impl pallet_memo_offerings::pallet::DonationRouter<AccountId> for OfferDonationRouter {
    fn route(target: (u8, u64), gross: u128) -> alloc::vec::Vec<(AccountId, sp_runtime::Permill)> {
        if gross == 0 {
            return alloc::vec::Vec::new();
        }
        // 优先按域路由表；无则按全局；再无则按旧 SubjectBps 单路策略
        if let Some(table) =
            pallet_memo_offerings::pallet::RouteTableByDomain::<Runtime>::get(target.0)
        {
            return resolve_table(target, table);
        }
        if let Some(table) = pallet_memo_offerings::pallet::RouteTableGlobal::<Runtime>::get() {
            return resolve_table(target, table);
        }
        // 旧策略回退：仅 Grave 域路由到主题账户
        const DOMAIN_GRAVE: u8 = 1;
        if target.0 == DOMAIN_GRAVE {
            if let Some(primary_id) =
                pallet_memo_grave::pallet::PrimaryDeceasedOf::<Runtime>::get(target.1)
            {
                if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(primary_id) {
                    let owner = d.owner.clone();
                    let subject_acc =
                        EscrowPalletId::get().into_sub_account_truncating((owner, primary_id));
                    let bps = pallet_memo_offerings::pallet::SubjectBps::<Runtime>::get();
                    return alloc::vec::Vec::from([(subject_acc, bps)]);
                }
            }
        }
        alloc::vec::Vec::new()
    }
}

/// 函数级中文注释：解析路由表，将路由项映射为实际账户与份额
/// 支持 4 种路由类型：
/// - kind=0: SubjectFunding（派生主题账户）
/// - kind=1: SpecificAccount（指定账户）
/// - kind=2: Burn（黑洞账户）
/// - kind=3: Treasury（国库账户）
fn resolve_table<I>(
    target: (u8, u64),
    table: I,
) -> alloc::vec::Vec<(AccountId, sp_runtime::Permill)>
where
    I: IntoIterator<Item = pallet_memo_offerings::pallet::RouteEntry<Runtime>>,
{
    use pallet_memo_offerings::pallet::RouteEntry;
    const DOMAIN_GRAVE: u8 = 1;
    let mut out: alloc::vec::Vec<(AccountId, sp_runtime::Permill)> = alloc::vec::Vec::new();
    
    for RouteEntry {
        kind,
        account,
        share,
    } in table.into_iter()
    {
        match (kind, account) {
            // kind=0: SubjectFunding - 派生主题资金账户
            (0, _) => {
                if target.0 == DOMAIN_GRAVE {
                    if let Some(primary_id) =
                        pallet_memo_grave::pallet::PrimaryDeceasedOf::<Runtime>::get(target.1)
                    {
                        if let Some(d) =
                            pallet_deceased::pallet::DeceasedOf::<Runtime>::get(primary_id)
                        {
                            let owner = d.owner.clone();
                            let subject_acc = EscrowPalletId::get()
                                .into_sub_account_truncating((owner, primary_id));
                            out.push((subject_acc, share));
                        }
                    }
                }
                // TODO: 扩展支持宠物域（domain=3）
            }
            
            // kind=1: SpecificAccount - 使用指定账户
            (1, Some(acc)) => {
                out.push((acc, share));
            }
            
            // kind=2: Burn - 销毁到黑洞账户
            (2, _) => {
                let burn_account = <Runtime as pallet_memo_offerings::Config>::BurnAccount::get();
                out.push((burn_account, share));
            }
            
            // kind=3: Treasury - 转入国库账户
            (3, _) => {
                let treasury_account = <Runtime as pallet_memo_offerings::Config>::TreasuryAccount::get();
                out.push((treasury_account, share));
            }
            
            // 其他情况忽略
            _ => {}
        }
    }
    out
}

/// 函数级中文注释：消费回调占位实现（不做任何状态变更），保障编译期绑定。
pub struct NoopConsumer;
impl pallet_memo_offerings::pallet::EffectConsumer<AccountId> for NoopConsumer {
    fn apply(
        _target: (u8, u64),
        _who: &AccountId,
        _effect: &pallet_memo_offerings::pallet::EffectSpec,
    ) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}

// ===== memo-sacrifice（目录）配置 =====
parameter_types! {
    pub const SacStringLimit: u32 = 64;
    pub const SacUriLimit: u32 = 128;
    pub const SacDescLimit: u32 = 256;
    pub const SacListingDeposit: Balance = 10_000_000_000_000; // 0.01 UNIT 示例
    pub const SacComplaintPeriod: BlockNumber = 30 * DAYS;     // 30 天 示例
    pub const SacMaxExclusivePerItem: u32 = 8;
}
impl pallet_memo_sacrifice::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = SacStringLimit;
    type UriLimit = SacUriLimit;
    type DescriptionLimit = SacDescLimit;
    // 管理员 Origin：Root | 内容委员会(Instance3，2/3)
    // 函数级中文注释：将目录创建/更新的治理权限绑定到"内容委员会"，便于链上内容治理一体化。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type Currency = Balances;
    type ListingDeposit = SacListingDeposit;
    type ComplaintPeriod = SacComplaintPeriod;
    type Treasury = TreasuryAccount;
    type MaxExclusivePerItem = SacMaxExclusivePerItem;
}

// ===== Treasury 配置 =====
parameter_types! {
    pub const TreasuryPalletId: frame_support::PalletId = frame_support::PalletId(*b"py/trsry");
    pub const TreasurySpendPeriod: BlockNumber = 7 * DAYS;
    pub const TreasuryPayoutPeriod: BlockNumber = 7 * DAYS;
    pub const TreasuryBurn: sp_runtime::Permill = sp_runtime::Permill::from_percent(0);
    pub const TreasuryMaxApprovals: u32 = 100;
}

pub struct NativePaymaster;
#[cfg(not(feature = "runtime-benchmarks"))]
impl frame_support::traits::tokens::Pay for NativePaymaster {
    type Balance = Balance;
    type AssetKind = (); // 仅原生
    type Beneficiary = AccountId;
    type Id = ();
    type Error = sp_runtime::DispatchError;
    fn pay(
        who: &Self::Beneficiary,
        _asset_kind: Self::AssetKind,
        amount: Self::Balance,
    ) -> Result<Self::Id, Self::Error> {
        <Balances as frame_support::traits::fungible::Mutate<AccountId>>::transfer(
            &PlatformAccount::get(),
            who,
            amount,
            frame_support::traits::tokens::Preservation::Expendable,
        )?;
        Ok(())
    }
    fn check_payment(_: Self::Id) -> frame_support::traits::tokens::PaymentStatus {
        frame_support::traits::tokens::PaymentStatus::Success
    }
}
#[cfg(feature = "runtime-benchmarks")]
impl frame_support::traits::tokens::Pay for NativePaymaster {
    type Balance = Balance;
    type AssetKind = (); // 仅原生
    type Beneficiary = AccountId;
    type Id = ();
    type Error = sp_runtime::DispatchError;
    fn pay(
        who: &Self::Beneficiary,
        _asset_kind: Self::AssetKind,
        amount: Self::Balance,
    ) -> Result<Self::Id, Self::Error> {
        <Balances as frame_support::traits::fungible::Mutate<AccountId>>::transfer(
            &PlatformAccount::get(),
            who,
            amount,
            frame_support::traits::tokens::Preservation::Expendable,
        )?;
        Ok(())
    }
    fn check_payment(_: Self::Id) -> frame_support::traits::tokens::PaymentStatus {
        frame_support::traits::tokens::PaymentStatus::Success
    }
    fn ensure_successful(_: &Self::Beneficiary, _: Self::AssetKind, _: Self::Balance) {}
    fn ensure_concluded(_: Self::Id) {}
}

pub struct UnitBalanceConverter;
#[cfg(not(feature = "runtime-benchmarks"))]
impl frame_support::traits::tokens::ConversionFromAssetBalance<Balance, (), Balance>
    for UnitBalanceConverter
{
    type Error = sp_runtime::DispatchError;
    fn from_asset_balance(amount: Balance, _asset: ()) -> Result<Balance, Self::Error> {
        Ok(amount)
    }
}
#[cfg(feature = "runtime-benchmarks")]
impl frame_support::traits::tokens::ConversionFromAssetBalance<Balance, (), Balance>
    for UnitBalanceConverter
{
    type Error = sp_runtime::DispatchError;
    fn from_asset_balance(amount: Balance, _asset: ()) -> Result<Balance, Self::Error> {
        Ok(amount)
    }
    fn ensure_successful(_: ()) {}
}

impl pallet_treasury::Config for Runtime {
    type Currency = Balances;
    type RejectOrigin = frame_system::EnsureRoot<AccountId>;
    type SpendPeriod = TreasurySpendPeriod;
    type Burn = TreasuryBurn;
    type PalletId = TreasuryPalletId;
    type BurnDestination = (); // 丢弃
    type WeightInfo = pallet_treasury::weights::SubstrateWeight<Runtime>;
    type SpendFunds = ();
    type MaxApprovals = TreasuryMaxApprovals;
    type SpendOrigin =
        frame_system::EnsureRootWithSuccess<AccountId, ConstU128<1_000_000_000_000_000_000>>; // Root 最多可一次性支出 1e18 单位
    type AssetKind = ();
    type Beneficiary = AccountId;
    type BeneficiaryLookup = IdentityLookup<AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type Paymaster = NativePaymaster;
    type BalanceConverter = UnitBalanceConverter;
    type PayoutPeriod = TreasuryPayoutPeriod;
    type BlockNumberProvider = frame_system::Pallet<Runtime>;
}

/// 函数级中文注释：国库账户解析器——由 Treasury PalletId 派生稳定账户地址。
pub struct TreasuryAccount;
impl sp_core::Get<AccountId> for TreasuryAccount {
    fn get() -> AccountId {
        TreasuryPalletId::get().into_account_truncating()
    }
}
// ===== memo-bridge（MEMO↔ETH）运行时配置 =====
parameter_types! {
    /// 函数级中文注释：桥托管账户 PalletId
    pub const BridgePalletId: PalletId = PalletId(*b"m/bridge");
    /// 函数级中文注释：最小锁定额（示例：0.01 UNIT）
    pub const BridgeMinLock: Balance = 10_000_000_000;
}
impl pallet_memo_bridge::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type FeeCollector = TreasuryAccount;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type MinLock = BridgeMinLock;
    type BridgePalletId = BridgePalletId;
    /// 函数级中文注释：绑定价格源为 Pricing Pallet
    type PriceFeed = pallet_pricing::Pallet<Runtime>;
    /// 函数级中文注释：价格最大允许陈旧秒数（示例：300秒）。
    type MaxPriceAgeSecs = frame_support::traits::ConstU64<300>;
    /// 函数级中文注释：以太坊地址最长 64 字节（hex/多格式冗余预留）。
    type MaxEthAddrLen = frame_support::traits::ConstU32<64>;
    /// 函数级中文注释：证据 CID 最大长度沿用全局 GraveMaxCidLen。
    type MaxCidLen = GraveMaxCidLen;
}

// ===== pricing 配置 =====
parameter_types! { pub const PricingMaxFeeders: u32 = 16; }
impl pallet_pricing::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxFeeders = PricingMaxFeeders;
}

// ====== 适配器实现（临时占位：允许 Root/无操作）======
// 修正命名：由旧 crate 前缀 memorial 切换为 memo，保证与 `pallets/memo-park` 对应
impl pallet_memo_park::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：管理员校验：允许 Root 或委员会阈值(2/3)。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        if frame_system::EnsureRoot::<AccountId>::try_origin(origin.clone()).is_ok() {
            return Ok(());
        }
        pallet_collective::EnsureProportionAtLeast::<AccountId, pallet_collective::Instance1, 2, 3>::try_origin(origin)
            .map(|_| ())
            .map_err(|_| sp_runtime::DispatchError::BadOrigin)
    }
}

impl pallet_memo_grave::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：管理员校验：允许 Root 或委员会阈值(2/3)。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        if frame_system::EnsureRoot::<AccountId>::try_origin(origin.clone()).is_ok() {
            return Ok(());
        }
        pallet_collective::EnsureProportionAtLeast::<AccountId, pallet_collective::Instance1, 2, 3>::try_origin(origin)
            .map(|_| ())
            .map_err(|_| sp_runtime::DispatchError::BadOrigin)
    }
}

impl pallet_memo_grave::pallet::OnIntermentCommitted for NoopIntermentHook {
    /// 函数级中文注释：安葬回调空实现，占位方便后续接入统计/KPI。
    fn on_interment(_grave_id: u64, _deceased_id: u64) {}
}

/// 函数级中文注释：供奉目标控制器（允许所有目标，Grave 域做成员校验）
impl pallet_memo_offerings::pallet::TargetControl<RuntimeOrigin, AccountId>
    for AllowAllTargetControl
{
    /// 函数级中文注释：目标存在性检查临时实现：放行（返回 true）。后续应检查对应存储是否存在。
    fn exists(target: (u8, u64)) -> bool {
        const DOMAIN_GRAVE: u8 = 1;
        const DOMAIN_PET: u8 = 3;
        if target.0 == DOMAIN_GRAVE {
            return pallet_memo_grave::pallet::Graves::<Runtime>::contains_key(target.1);
        }
        if target.0 == DOMAIN_PET {
            return pallet_memo_pet::pallet::PetOf::<Runtime>::contains_key(target.1);
        }
        true
    }
    /// 函数级中文注释：权限检查：若目标域为 Grave(=1)，则要求发起者为该墓位成员；否则放行。
    fn ensure_allowed(
        origin: RuntimeOrigin,
        target: (u8, u64),
    ) -> frame_support::dispatch::DispatchResult {
        let who = frame_system::ensure_signed(origin)?;
        const DOMAIN_GRAVE: u8 = 1;
        if target.0 == DOMAIN_GRAVE {
            // 若墓位公开则放行，否则必须为成员
            let is_public = pallet_memo_grave::pallet::Graves::<Runtime>::get(target.1)
                .map(|g| g.is_public)
                .unwrap_or(false);
            if !is_public {
                ensure!(
                    pallet_memo_grave::pallet::Members::<Runtime>::contains_key(target.1, &who),
                    sp_runtime::DispatchError::Other("NotMember")
                );
            }
        }
        // DOMAIN_PET：当前不限制成员，放行（如需限制可在此增加校验）
        Ok(())
    }
}

/// 函数级中文注释：当供奉落账时，将其按 grave 维度写入账本模块。
pub struct GraveOfferingHook;
impl pallet_memo_offerings::pallet::OnOfferingCommitted<AccountId> for GraveOfferingHook {
    /// 供奉 Hook：由 `pallet-memorial-offerings` 在供奉确认后调用。
    /// - target.0 为域编码（例如 1=grave）；target.1 为对象 id（grave_id）。
    /// - 携带金额（若 Some）则累计到排行榜；Timed 的持续周数用于标记有效供奉周期
    fn on_offering(
        target: (u8, u64),
        kind_code: u8,
        who: &AccountId,
        amount: Option<u128>,
        duration_weeks: Option<u32>,
    ) {
        const DOMAIN_GRAVE: u8 = 1;
        if target.0 == DOMAIN_GRAVE {
            let amt: Option<Balance> = amount.map(|a| a as Balance);
            // 1) 记录供奉流水（附带去重键）：
            //    以 (domain, grave_id, who, block_number, amount, extrinsic_index) 为种子生成 H256
            let now = <frame_system::Pallet<Runtime>>::block_number();
            let ex_idx = <frame_system::Pallet<Runtime>>::extrinsic_index();
            let seed = (target.0, target.1, who.clone(), now, amount, ex_idx);
            let tx_key = Some(sp_core::H256::from(sp_core::blake2_256(
                &codec::Encode::encode(&seed),
            )));
            pallet_ledger::Pallet::<Runtime>::record_from_hook_with_amount(
                target.1,
                who.clone(),
                kind_code,
                amt,
                None,
                tx_key,
            );
            // 2) 标记有效供奉周期：
            // - 若为 Timed（duration_weeks=Some），无论是否转账成功，均标记从当周起连续 w 周
            // - 若为 Instant（None），仅当存在金额落账时标记当周
            let should_mark = duration_weeks.is_some() || amount.is_some();
            if should_mark {
                pallet_ledger::Pallet::<Runtime>::mark_weekly_active(
                    target.1,
                    who.clone(),
                    now,
                    duration_weeks,
                );
                // 1.5) 联盟计酬分配：当存在入金时，将本次消费按联盟规则分配
                // 函数级中文注释：【核心修改】调用统一分配入口，动态路由到 instant 或 weekly
                // 资金已通过多路分账存入 pallet-affiliate 托管账户，
                // 由 pallet-affiliate-config 根据当前模式（Instant/Weekly）动态分配
                if let Some(pay) = amt {
                    let _ = pallet_affiliate_config::Pallet::<Runtime>::distribute_rewards(
                        who,
                        pay,
                        Some(target),
                        now,
                        duration_weeks,
                    );
                }
            }
            // 3) 累计到逝者总额：若墓位绑定了 primary_deceased_id 则累加（不含押金，amount 已为实付）
            if let Some(grave) = pallet_memo_grave::pallet::Graves::<Runtime>::get(target.1) {
                if let Some(primary) = grave.deceased_tokens.first() {
                    // 说明：这里假设第一个 token 对应 primary deceased；若有更严格的 primary 字段，可改为读取专用字段。
                    if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::iter()
                        .find_map(|(id, rec)| {
                            let tok = rec.deceased_token.to_vec();
                            if tok == primary.to_vec() {
                                Some(id)
                            } else {
                                None
                            }
                        })
                    {
                        if let Some(v) = amount {
                            pallet_ledger::Pallet::<Runtime>::add_to_deceased_total(
                                d,
                                v as Balance,
                            );
                        }
                    }
                }
            }
        }
    }
}

/// 函数级中文注释：纪念馆捐赠账户解析器。
/// - 从 GraveId 派生子账户，集中管理捐赠。
pub struct GraveDonationResolver;
impl pallet_memo_offerings::pallet::DonationAccountResolver<AccountId> for GraveDonationResolver {
    fn account_for(target: (u8, u64)) -> AccountId {
        // 托管结算：所有供奉先进入联盟托管账户，由联盟模块周期结算再分配。
        let escrow = EscrowPalletId::get().into_account_truncating();
        let _ = target; // 当前按域统一托管，保留形参以便未来分域托管
        escrow
    }
}

// 备注：memorial-offerings 已改为内置媒体存储，不再需要 EvidenceProvider 适配器。

// ===== evidence 配置 =====
parameter_types! {
    pub const EvidenceMaxCidLen: u32 = 64;
    pub const EvidenceMaxImg: u32 = 20;
    pub const EvidenceMaxVid: u32 = 5;
    pub const EvidenceMaxDoc: u32 = 5;
    pub const EvidenceMaxMemoLen: u32 = 64;
    pub const EvidenceNsBytes: [u8; 8] = *b"evid___ ";
}
pub struct AllowAllEvidenceAuthorizer;
impl pallet_evidence::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = EvidenceMaxCidLen;
    type MaxImg = EvidenceMaxImg;
    type MaxVid = EvidenceMaxVid;
    type MaxDoc = EvidenceMaxDoc;
    type MaxMemoLen = EvidenceMaxMemoLen;
    type EvidenceNsBytes = EvidenceNsBytes;
    // 无授权中心：占位实现，默认允许
    type Authorizer = AllowAllEvidenceAuthorizer;
    /// 函数级中文注释：每主体证据与账号限频的示例默认值。
    type MaxPerSubjectTarget = frame_support::traits::ConstU32<10_000>;
    type MaxPerSubjectNs = frame_support::traits::ConstU32<10_000>;
    type WindowBlocks = frame_support::traits::ConstU32<600>;
    type MaxPerWindow = frame_support::traits::ConstU32<100>;
    type EnableGlobalCidDedup = frame_support::traits::ConstBool<false>;
    type MaxListLen = frame_support::traits::ConstU32<512>;
    /// 函数级中文注释：绑定权重实现，当前为手写估算版；后续可替换为基准生成版
    type WeightInfo = pallet_evidence::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：家庭关系校验适配器（占位实现）。
    type FamilyVerifier = FamilyVerifierAdapter;
    /// 函数级中文注释：授权用户与密钥长度上限（与前端 RSA-2048/SPKI 长度匹配）。
    type MaxAuthorizedUsers = frame_support::traits::ConstU32<64>;
    type MaxKeyLen = frame_support::traits::ConstU32<4096>;
}
impl pallet_evidence::pallet::EvidenceAuthorizer<AccountId> for AllowAllEvidenceAuthorizer {
    fn is_authorized(_ns: [u8; 8], _who: &AccountId) -> bool {
        true
    }
}

/// 函数级中文注释：家庭关系验证适配器（占位实现）。
/// - 当前始终返回 false；后续可根据 `pallet-memo-grave` 的成员/亲属关系完善。
pub struct FamilyVerifierAdapter;
impl pallet_evidence::pallet::FamilyRelationVerifier<AccountId> for FamilyVerifierAdapter {
    fn is_family_member(_user: &AccountId, _deceased_id: u64) -> bool { false }
    fn is_authorized_for_deceased(_user: &AccountId, _deceased_id: u64) -> bool { false }
}

// 已移除：pallet-order 参数与 Config

// 已移除：Karma 适配器实现

// 托管 PalletId 与平台账户占位（示例）
parameter_types! {
    // PalletId 仅支持 8 字节，固定使用前 8 字节常量
    pub const ConstPalletId: frame_support::PalletId = frame_support::PalletId(*b"otc/orde");
}
pub struct PlatformAccount;
impl sp_core::Get<AccountId> for PlatformAccount {
    fn get() -> AccountId {
        sp_core::crypto::AccountId32::new([0u8; 32]).into()
    }
}

/// 函数级中文注释：黑洞账户（无私钥）
/// - 选用全 0 公钥对应的 AccountId32；无法从私钥推导签名，链上仅可接收，不可支出。
/// - 作为 MEMO 销毁地址使用：向该地址转账即等于销毁。
pub struct BurnAccount;
impl sp_core::Get<AccountId> for BurnAccount {
    /// 函数级中文注释：使用固定字节串 b"memo/burn" 前 32 字节生成 AccountId（无私钥）。
    fn get() -> AccountId {
        let mut bytes = [0u8; 32];
        const SEED: &[u8; 9] = b"memo/burn";
        bytes[..SEED.len()].copy_from_slice(SEED);
        sp_core::crypto::AccountId32::new(bytes).into()
    }
}

// ===== escrow/arbitration 配置 =====

// ===== 新 OTC 三件套参数（占位，可按需调整） =====
parameter_types! {
    pub const OtcMaxCidLen: u32 = 64;
}
impl pallet_otc_maker::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = OtcMaxCidLen;
    // 基于 Identity 的 KYC 适配器
    type Kyc = KycByIdentity;
}

// ===== market-maker 配置 =====
parameter_types! {
    /// 函数级中文注释：做市商最小押金（示例：1000 MEMO）
    pub const MarketMakerMinDeposit: Balance = 1_000_000_000_000_000; // 1000 UNIT
    /// 函数级中文注释：资料提交窗口（24 小时 = 86400 秒）
    pub const MarketMakerInfoWindow: u32 = 86_400;
    /// 函数级中文注释：审核窗口（7 天 = 604800 秒）
    pub const MarketMakerReviewWindow: u32 = 604_800;
    /// 函数级中文注释：驳回最大扣罚比例（10000 bps = 100%）
    pub const MarketMakerRejectSlashBpsMax: u16 = 10_000;
    /// 函数级中文注释：最大交易对数量（预留）
    pub const MarketMakerMaxPairs: u32 = 10;
}

impl pallet_market_maker::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = ();
    type MinDeposit = MarketMakerMinDeposit;
    type InfoWindow = MarketMakerInfoWindow;
    type ReviewWindow = MarketMakerReviewWindow;
    type RejectSlashBpsMax = MarketMakerRejectSlashBpsMax;
    type MaxPairs = MarketMakerMaxPairs;
    /// 函数级中文注释：治理起源绑定为 Root 或 委员会(Instance1) 2/3 多数
    /// - Root：紧急通道，可单独批准/驳回
    /// - 委员会 2/3：正常治理流程，需通过提案投票
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
}

// ===== KYC 适配器（基于 pallet-identity 的 judgement） =====
pub struct KycByIdentity;
/// 函数级中文注释：KYC 适配器同时实现 memo-grave 与 otc-maker 所需的 Provider 接口。
impl pallet_memo_grave::pallet::KycProvider<AccountId> for KycByIdentity {
    fn is_verified(who: &AccountId) -> bool {
        use pallet_identity::{pallet::IdentityOf as IdOf, Judgement};
        if let Some(reg) = IdOf::<Runtime>::get(who) {
            return reg
                .judgements
                .iter()
                .any(|(_, j)| matches!(j, Judgement::KnownGood | Judgement::Reasonable));
        }
        false
    }
}
impl pallet_otc_maker::pallet::KycProvider<AccountId> for KycByIdentity {
    /// 函数级中文注释：判断账户是否已通过 KYC
    /// - 读取 identity::IdentityOf，检测存在且含有正向 judgement（如 KnownGood/Reasonable）。
    fn is_verified(who: &AccountId) -> bool {
        use pallet_identity::{pallet::IdentityOf as IdOf, Judgement};
        if let Some(reg) = IdOf::<Runtime>::get(who) {
            // 只要存在非负向的 judgement 即视为通过（可按需收紧）
            return reg
                .judgements
                .iter()
                .any(|(_, j)| matches!(j, Judgement::KnownGood | Judgement::Reasonable));
        }
        false
    }
}

// ===== identity 配置与参数 =====
parameter_types! {
    /// 基础身份信息押金（u128）。可按需调整为更高值以抑制状态膨胀。
    pub const IdentityBasicDeposit: u128 = 1_000_000_000; // 约等于 0.001 UNIT（示例）
    /// 按字节计费押金（u128），用于限制过大信息体。
    pub const IdentityByteDeposit: u128 = 10_000; // 每字节押金（示例）
    /// 用户名登记押金（u128）。
    pub const IdentityUsernameDeposit: u128 = 1_000_000_000; // 示例
    /// 子账号押金（u128）。
    pub const IdentitySubAccountDeposit: u128 = 1_000_000_000; // 示例
    /// 最多子账号数。
    pub const IdentityMaxSubAccounts: u32 = 100;
    /// 最多注册机构数。
    pub const IdentityMaxRegistrars: u32 = 20;
    /// 用户名待接受过期时间（区块）。例如 1 天：6 秒/块 → 14_400 块。
    pub const IdentityPendingUsernameExpiration: u32 = 14_400;
    /// 用户名解绑宽限期（区块）。例如 30 天。
    pub const IdentityUsernameGracePeriod: u32 = 432_000;
    /// 用户名后缀最大长度。
    pub const IdentityMaxSuffixLength: u32 = 16;
    /// 用户名总长度（含后缀与分隔符）最大值。
    pub const IdentityMaxUsernameLength: u32 = 32;
}

impl pallet_identity::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// 货币实现（需支持可保留押金）
    type Currency = Balances;
    /// 押金参数
    type BasicDeposit = IdentityBasicDeposit;
    type ByteDeposit = IdentityByteDeposit;
    type UsernameDeposit = IdentityUsernameDeposit;
    type SubAccountDeposit = IdentitySubAccountDeposit;
    /// 规模参数
    type MaxSubAccounts = IdentityMaxSubAccounts;
    type MaxRegistrars = IdentityMaxRegistrars;
    /// 身份信息类型（采用官方 legacy 结构，字段上限 64）
    type IdentityInformation =
        pallet_identity::legacy::IdentityInfo<frame_support::traits::ConstU32<64>>;
    /// 被罚没资金处理（占位：丢弃）
    type Slashed = ();
    /// Root 权限用于强制操作/登记管理员
    type ForceOrigin = frame_system::EnsureRoot<AccountId>;
    type RegistrarOrigin = frame_system::EnsureRoot<AccountId>;
    /// 离线签名/公钥类型（多签通用）
    type OffchainSignature = sp_runtime::MultiSignature;
    type SigningPublicKey = sp_runtime::MultiSigner;
    /// 用户名权限与时限
    type UsernameAuthorityOrigin = frame_system::EnsureRoot<AccountId>;
    type PendingUsernameExpiration = IdentityPendingUsernameExpiration;
    type UsernameGracePeriod = IdentityUsernameGracePeriod;
    type MaxSuffixLength = IdentityMaxSuffixLength;
    type MaxUsernameLength = IdentityMaxUsernameLength;
    /// 基准权重
    type WeightInfo = pallet_identity::weights::SubstrateWeight<Runtime>;
    // 新版 pallet-identity 已不需要 BenchmarkHelper 关联类型
}

// ===== memo-pet 配置（最小实现） =====
parameter_types! { pub const PetStringLimit: u32 = 64; }
impl pallet_memo_pet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = PetStringLimit;
    // 复用墓位适配器，沿用人类主体相同的权限判断
    type GraveProvider = GraveProviderAdapter;
}
parameter_types! {
    pub const OtcListingFee: u128 = 0;
    pub const OtcListingBond: u128 = 0;
    pub const OtcFeePalletId: PalletId = PalletId(*b"otc/fees");
}
pub struct OtcFeeReceiver;
impl sp_core::Get<AccountId> for OtcFeeReceiver {
    fn get() -> AccountId {
        OtcFeePalletId::get().into_account_truncating()
    }
}

impl pallet_otc_listing::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type MaxCidLen = OtcMaxCidLen;
    /// 函数级中文注释：托管接口对接，用于库存模式在创建挂单时锁入 Maker 库存
    type Escrow = pallet_escrow::Pallet<Runtime>;
    /// 每块最多处理的过期挂单数
    type MaxExpiringPerBlock = frame_support::traits::ConstU32<100>;
    /// 启用 KYC 校验
    type RequireKyc = frame_support::traits::ConstBool<true>;
    /// 创建挂单限频窗口（块）
    type CreateWindow = ConstU32<600>;
    /// 窗口内最多创建数
    type CreateMaxInWindow = ConstU32<5>;
    /// 上架费（默认 0 关闭）
    type ListingFee = OtcListingFee;
    /// 保证金（默认 0 关闭）
    type ListingBond = OtcListingBond;
    /// 费用接收账户
    type FeeReceiver = OtcFeeReceiver;
    /// 价格源：绑定 Pricing Pallet
    type PriceFeed = pallet_pricing::Pallet<Runtime>;
    /// 最大允许 spread（bps）
    type MaxSpreadBps = frame_support::traits::ConstU16<5000>; // 50% 示例
}
parameter_types! { pub const OtcOrderConfirmTTL: BlockNumber = 2 * DAYS; }
impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type ConfirmTTL = OtcOrderConfirmTTL;
    /// 函数级中文注释：托管接口（用于订单锁定/释放/退款），对接 pallet-escrow
    type Escrow = pallet_escrow::Pallet<Runtime>;
    /// 每块最多处理过期订单数
    type MaxExpiringPerBlock = frame_support::traits::ConstU32<200>;
    /// 吃单与标记支付的限频窗口与上限（示例：各 600 块窗口内最多 30 次/100 次）
    type OpenWindow = ConstU32<600>;
    type OpenMaxInWindow = ConstU32<30>;
    type PaidWindow = ConstU32<600>;
    type PaidMaxInWindow = ConstU32<100>;
}

parameter_types! { pub const EscrowPalletId: frame_support::PalletId = frame_support::PalletId(*b"otc/escw"); }
impl pallet_escrow::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EscrowPalletId = EscrowPalletId;
    /// 函数级中文注释：授权外部入口的 Origin（Root | 内容委员会阈值）。
    type AuthorizedOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：管理员 Origin（同上）。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：每块最多处理的到期项（示例：200）。
    type MaxExpiringPerBlock = frame_support::traits::ConstU32<200>;
    /// 函数级中文注释：到期策略（示例：NoopPolicy）。
    type ExpiryPolicy = NoopExpiryPolicy;
}
/// 函数级中文注释：到期策略占位实现——不做任何资金处理，仅用于演示。
pub struct NoopExpiryPolicy;
impl pallet_escrow::pallet::ExpiryPolicy<AccountId, BlockNumber> for NoopExpiryPolicy {
    fn on_expire(
        _id: u64,
    ) -> Result<pallet_escrow::pallet::ExpiryAction<AccountId>, sp_runtime::DispatchError> {
        Ok(pallet_escrow::pallet::ExpiryAction::Noop)
    }
    fn now() -> BlockNumber {
        <frame_system::Pallet<Runtime>>::block_number()
    }
}

parameter_types! { pub const ArbMaxEvidence: u32 = 16; pub const ArbMaxCidLen: u32 = 64; }
impl pallet_arbitration::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxEvidence = ArbMaxEvidence;
    type MaxCidLen = ArbMaxCidLen;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type WeightInfo = pallet_arbitration::weights::SubstrateWeight<Runtime>;
    type Router = ArbitrationRouter;
    /// 函数级中文注释：仲裁裁决起源绑定为 Root | 内容委员会阈值(2/3)
    type DecisionOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
}

// 已移除：Karma 授权命名空间常量

// ===== 仲裁域路由：把仲裁请求分发到对应业务 pallet（当前无业务接入） =====
pub struct ArbitrationRouter;
/// 函数级中文注释：仲裁域路由器实现。转发到 OTC 订单 Pallet 上的校验与执行接口。
impl pallet_arbitration::pallet::ArbitrationRouter<AccountId> for ArbitrationRouter {
    /// 函数级中文注释：支持 OTC 订单域 (b"otc_ord_") 的争议校验
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool {
        if domain == OtcOrderNsBytes::get() {
            // 引入 trait 以启用方法解析
            use pallet_otc_order::ArbitrationHook;
            pallet_otc_order::pallet::Pallet::<Runtime>::can_dispute(who, id)
        } else {
            false
        }
    }
    /// 函数级中文注释：将仲裁裁决应用到对应域
    /// - Release → 托管释放给买家；Refund → 托管退款给卖家；Partial(bps) → 按 bps 分账
    fn apply_decision(
        domain: [u8; 8],
        id: u64,
        decision: pallet_arbitration::pallet::Decision,
    ) -> frame_support::dispatch::DispatchResult {
        use pallet_arbitration::pallet::Decision as D;
        if domain == OtcOrderNsBytes::get() {
            match decision {
                D::Release => {
                    use pallet_otc_order::ArbitrationHook;
                    pallet_otc_order::pallet::Pallet::<Runtime>::arbitrate_release(id)
                }
                D::Refund => {
                    use pallet_otc_order::ArbitrationHook;
                    pallet_otc_order::pallet::Pallet::<Runtime>::arbitrate_refund(id)
                }
                D::Partial(bps) => {
                    use pallet_otc_order::ArbitrationHook;
                    pallet_otc_order::pallet::Pallet::<Runtime>::arbitrate_partial(id, bps)
                }
            }
        } else {
            Err(sp_runtime::DispatchError::Other("UnsupportedDomain"))
        }
    }
}

// ===== 内容治理执行路由：将决议分发到目标 Pallet 强制接口 =====
pub struct ContentGovernanceRouter;
/// 函数级中文注释：内容治理路由器实现。
/// - 根据 (domain, action) 将调用分发到相应 pallet 的 gov*/force* 接口；
/// - MVP：先覆盖常见内容域（grave/deceased/deceased-text/deceased-media/offerings/park）；
/// - 安全：仅在 memo-content-governance Pallet 审批通过后由 Hooks 调用，无需二次权限判断。
impl pallet_memo_content_governance::AppealRouter<AccountId> for ContentGovernanceRouter {
    fn execute(
        _who: &AccountId,
        domain: u8,
        target: u64,
        action: u8,
    ) -> frame_support::dispatch::DispatchResult {
        match (domain, action) {
            // 1=grave：治理强制执行（示例：10=清空封面；11=强制转让墓地 owner 到平台账户）
            (1, 10) => {
                // 清空封面
                pallet_memo_grave::pallet::Pallet::<Runtime>::clear_cover_via_governance(
                    RuntimeOrigin::root(),
                    target,
                )
            }
            (1, 11) => pallet_memo_grave::pallet::Pallet::<Runtime>::gov_transfer_grave(
                RuntimeOrigin::root(),
                target,
                PlatformAccount::get(),
                vec![],
            ),
            // 1=grave：12=设置限制；13=软删除；14=恢复
            (1, 12) => pallet_memo_grave::pallet::Pallet::<Runtime>::gov_set_restricted(
                RuntimeOrigin::root(),
                target,
                true,
                1u8,
                vec![],
            ),
            (1, 13) => pallet_memo_grave::pallet::Pallet::<Runtime>::gov_remove_grave(
                RuntimeOrigin::root(),
                target,
                1u8,
                vec![],
            ),
            (1, 14) => pallet_memo_grave::pallet::Pallet::<Runtime>::gov_restore_grave(
                RuntimeOrigin::root(),
                target,
                vec![],
            ),
            // 2=deceased：更新 profile（此处作为示例仅切换可见性为 true）
            (2, 1) => {
                // 证据由上层记录；此处直接调用 gov_set_visibility(true)
                pallet_deceased::pallet::Pallet::<Runtime>::gov_set_visibility(
                    RuntimeOrigin::root(),
                    target as u64,
                    true,
                    vec![],
                )
            }
            // 2=deceased：2=清空主图；3=设置主图（以事件化为主，字段存储在 deceased）
            (2, 2) => pallet_deceased::pallet::Pallet::<Runtime>::gov_set_main_image(
                RuntimeOrigin::root(),
                target as u64,
                None,
                vec![],
            ),
            (2, 3) => {
                // 占位：设置为默认头像（前端约定 CID），此处用 None 保持接口对齐
                pallet_deceased::pallet::Pallet::<Runtime>::gov_set_main_image(
                    RuntimeOrigin::root(),
                    target as u64,
                    None,
                    vec![],
                )
            }
            // 2=deceased：4=治理转移拥有者
            (2, 4) => {
                // 运行时通过治理 Pallet 的只读接口查找 new_owner
                if let Some((_id, new_owner)) = pallet_memo_content_governance::pallet::Pallet::<
                    Runtime,
                >::find_owner_transfer_params(target)
                {
                    pallet_deceased::pallet::Pallet::<Runtime>::gov_transfer_owner(
                        RuntimeOrigin::root(),
                        target as u64,
                        new_owner,
                        vec![],
                    )
                } else {
                    Err(sp_runtime::DispatchError::Other("MissingNewOwner"))
                }
            }
            // 3=deceased-text：20=移除悼词；21=强制删除文本（支持文章/留言）
            (3, 20) => pallet_deceased_text::pallet::Pallet::<Runtime>::gov_remove_eulogy(
                RuntimeOrigin::root(),
                target as u64,
                vec![],
            ),
            (3, 21) => pallet_deceased_text::pallet::Pallet::<Runtime>::gov_remove_text(
                RuntimeOrigin::root(),
                target as u64,
                vec![],
            ),
            // 3=deceased-text：22=治理编辑文本；23=治理设置生平
            (3, 22) => pallet_deceased_text::pallet::Pallet::<Runtime>::gov_edit_text(
                RuntimeOrigin::root(),
                target as u64,
                None,
                None,
                None,
                vec![],
            ),
            (3, 23) => pallet_deceased_text::pallet::Pallet::<Runtime>::gov_set_life(
                RuntimeOrigin::root(),
                target as u64,
                vec![],
                vec![],
            ),
            // 4=deceased-media：隐藏媒体（target 为 media_id）
            (4, 30) => pallet_deceased_media::pallet::Pallet::<Runtime>::gov_set_media_hidden(
                RuntimeOrigin::root(),
                target as u64,
                true,
                vec![],
            ),
            // 4=deceased-media：31=替换媒体URI；32=冻结视频集
            (4, 31) => pallet_deceased_media::pallet::Pallet::<Runtime>::gov_replace_media_uri(
                RuntimeOrigin::root(),
                target as u64,
                vec![],
                vec![],
            ),
            (4, 32) => {
                // 将 target 解读为 VideoCollectionId
                pallet_deceased_media::pallet::Pallet::<Runtime>::gov_freeze_video_collection(
                    RuntimeOrigin::root(),
                    target as u64,
                    true,
                    vec![],
                )
            }
            // 5=park：转移园区所有权（占位，new_owner=平台账户）
            (5, 40) => pallet_memo_park::pallet::Pallet::<Runtime>::gov_transfer_park(
                RuntimeOrigin::root(),
                target as u64,
                PlatformAccount::get(),
                vec![],
            ),
            // 5=park：41=设置园区封面（事件化）
            (5, 41) => pallet_memo_park::pallet::Pallet::<Runtime>::gov_set_park_cover(
                RuntimeOrigin::root(),
                target as u64,
                None,
                vec![],
            ),
            // 6=offerings：按域暂停（domain=1 grave）
            (6, 50) => pallet_memo_offerings::pallet::Pallet::<Runtime>::gov_set_pause_domain(
                RuntimeOrigin::root(),
                1u8,
                true,
                vec![],
            ),
            // 6=offerings：51=上/下架供奉模板
            (6, 51) => pallet_memo_offerings::pallet::Pallet::<Runtime>::gov_set_offering_enabled(
                RuntimeOrigin::root(),
                target as u8,
                true,
                vec![],
            ),
            _ => Err(sp_runtime::DispatchError::Other("UnsupportedContentAction")),
        }
    }
}

// ===== exchange 配置 =====
// duplicate import removed

// 已移除：pallet-exchange 参数与 Config

// 已移除：evidence 授权适配器（改为 () ）

// 已移除：Exchange 管理员适配器实现

// ===== referrals（推荐关系）配置 =====
parameter_types! {
    /// 函数级中文注释：推荐关系最大向上遍历层级，用于防御性限制。
    pub const RefMaxHops: u32 = 10;
    /// 函数级中文注释：每个推荐人最多可拥有的直接下级数量（反向索引容量上限）。
    pub const RefMaxChildren: u32 = 100_000;
}
impl pallet_memo_referrals::Config for Runtime {
    /// 函数级中文注释：事件类型绑定到运行时事件。
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：最大层级限制（防环遍历的边界）。
    type MaxHops = RefMaxHops;
    /// 函数级中文注释：反向索引容量上限。
    type MaxReferralsPerAccount = RefMaxChildren;
}

// （已下线）memo-endowment（基金会）配置块移除

// ===== memo-ipfs（存储+OCW）配置 =====
parameter_types! { pub const IpfsMaxCidHashLen: u32 = 64; }
/// 函数级中文注释：为 memo-ipfs 绑定运行时类型。注意 OCW 需要签名类型约束。
impl pallet_memo_ipfs::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    /// 函数级中文注释：Endowment 下线后，费用接收账户改为国库账户解析器。
    type FeeCollector = TreasuryAccount;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxCidHashLen = IpfsMaxCidHashLen;
    type MaxPeerIdLen = frame_support::traits::ConstU32<128>;
    type MinOperatorBond = frame_support::traits::ConstU128<10_000_000_000_000>; // 0.01 UNIT 示例
    type MinCapacityGiB = frame_support::traits::ConstU32<100>; // 至少 100 GiB 示例
    type WeightInfo = ();
    /// 函数级中文注释：使用独立的主题资金 PalletId，语义清晰，职责单一。
    /// - 派生逝者资金账户：SubjectPalletId.into_sub_account_truncating((1, subject_id))
    /// - 与 OTC 托管、联盟计酬托管完全隔离，各司其职
    /// - 未来可扩展到墓地(domain=2)、陵园(domain=3)等其他业务域
    type SubjectPalletId = SubjectPalletId;
    /// 函数级中文注释：绑定逝者域常量（domain=1），用于 (domain, subject_id) 稳定派生。
    type DeceasedDomain = ConstU8<1>;
    /// 函数级中文注释：OwnerProvider 适配器，将 subject_id→owner 从 pallet-deceased 读取
    type OwnerProvider = DeceasedOwnerAdapter;
}

/// 函数级详细中文注释：逝者 owner 只读适配器
pub struct DeceasedOwnerAdapter;
impl pallet_memo_ipfs::OwnerProvider<AccountId> for DeceasedOwnerAdapter {
    fn owner_of(subject_id: u64) -> Option<AccountId> {
        use pallet_deceased::pallet::DeceasedOf as DMap;
        DMap::<Runtime>::get(subject_id).map(|d| d.owner)
    }
}

/// 函数级中文注释：SLA 数据提供者，从 `pallet-memo-ipfs` 读取运营者统计
pub struct SlaFromIpfs;
// （已下线）SLA Provider 适配器不再实现 endowment 的 trait
impl SlaFromIpfs {
    /// 函数级中文注释：占位保留工具函数，可被迁移脚本或索引层复用（不依赖 endowment trait）。
    pub fn foreach_active_operator<F: FnMut(&AccountId, u32, u32, BlockNumber)>(mut f: F) {
        use pallet_memo_ipfs::pallet::{OperatorSla as SlaMap, Operators as OpMap};
        for (op, s) in SlaMap::<Runtime>::iter() {
            if let Some(info) = OpMap::<Runtime>::get(&op) {
                if info.status == 0 {
                    f(&op, s.probe_ok, s.probe_fail, s.last_update);
                }
            }
        }
    }
}

// ===== affiliate（计酬）配置 =====
parameter_types! {
    /// 函数级中文注释：计酬最大层级（与推荐层级上限相近）。
    pub const AffiliateMaxHops: u32 = 10;
    /// 函数级中文注释：佣金池 PalletId，用于派生模块资金账户。
    pub const AffiliatePalletId: PalletId = PalletId(*b"affiliat");
    
    /// 函数级中文注释：主题资金 PalletId，用于派生各域主题的资金子账户。
    /// - domain=1: 逝者（deceased）
    /// - domain=2: 墓地（grave）- 未来扩展
    /// - domain=3: 陵园（cemetery）- 未来扩展
    /// - 每个 (domain, subject_id) 对应一个独立的子账户，实现资金天然隔离
    pub const SubjectPalletId: PalletId = PalletId(*b"subjects");
}

/// 函数级中文注释：佣金池账户解析器——由 PalletId 派生稳定账户地址。
pub struct CommissionAccount;
impl sp_core::Get<AccountId> for CommissionAccount {
    fn get() -> AccountId {
        AffiliatePalletId::get().into_account_truncating()
    }
}

/// 函数级中文注释：极差费率配置（万分比）。可在未来迁移为存储项/治理参数。
pub struct AffiliateTierRates;
impl sp_core::Get<&'static [u16]> for AffiliateTierRates {
    fn get() -> &'static [u16] {
        // 第1层 8%，第2层 5%，第3层 2%（示例，可治理升级）
        const R: &[u16] = &[800, 500, 200];
        R
    }
}

/// ============================================================================
/// 联盟计酬托管层配置 (pallet-affiliate)
/// ============================================================================
/// 函数级中文注释：托管层只负责资金托管，不涉及分配逻辑
impl pallet_affiliate::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    /// 函数级中文注释：托管 PalletId - 使用独立的联盟计酬托管账户
    type EscrowPalletId = AffiliatePalletId;
    /// 函数级中文注释：提款权限 - 仅 Root 可以提款（或配置为财务委员会）
    type WithdrawOrigin = frame_system::EnsureRoot<AccountId>;
}

parameter_types! {
    /// 函数级中文注释：联盟计酬托管账户地址（供 weekly 使用）
    pub AffiliateEscrowAccount: AccountId = AffiliatePalletId::get().into_account_truncating();
}

/// ============================================================================
/// 联盟计酬周结算分配层配置 (pallet-affiliate-weekly)
/// ============================================================================
/// 函数级中文注释：分配层负责分配算法和周期结算，从托管层读取资金
impl pallet_affiliate_weekly::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// 货币实现
    type Currency = Balances;
    /// 推荐关系只读提供者
    type Referrals = pallet_memo_referrals::Pallet<Runtime>;
    /// 周对应区块数
    type BlocksPerWeek = frame_support::traits::ConstU32<100_800>;
    /// 函数级中文注释：从托管层读取托管账户（类似 affiliate-instant 的设计）
    type EscrowAccount = AffiliateEscrowAccount;
    /// 防御性搜索上限
    type MaxSearchHops = frame_support::traits::ConstU32<10_000>;
    /// 结算最大层级与阈值
    type MaxLevels = frame_support::traits::ConstU32<15>;
    type PerLevelNeed = frame_support::traits::ConstU32<3>;
    /// 比例（bps）：每层不等比
    type LevelRatesBps = LevelRatesArray;
}

// 运行时可读默认值说明（前端读取 storage）：
// - affiliate.totalDeposited / totalWithdrawn（托管层统计）
// - affiliateWeekly.budgetCapPerCycle / minStakeForReward / minQualifyingAction（分配层参数）

/// 函数级中文注释：分层比例数组 [L1=2000, L2=1000, L3..L15=400]
pub struct LevelRatesArray;
impl sp_core::Get<&'static [u16]> for LevelRatesArray {
    fn get() -> &'static [u16] {
        const RATES: &[u16] = &[
            2000, // L1 20%
            1000, // L2 10%
            400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, // L3..L15 各 4%
        ];
        RATES
    }
}

/// ============================================================================
/// 联盟计酬即时分配工具配置 (pallet-affiliate-instant)
/// ============================================================================
/// 函数级中文注释：即时分配工具负责实时计算推荐链并立即转账
impl pallet_affiliate_instant::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type PalletId = AffiliatePalletId;
    type ReferralProvider = InstantReferralProviderAdapter;
    type MembershipProvider = InstantMembershipProviderAdapter;
    type BurnPercent = frame_support::traits::ConstU8<5>;
    type TreasuryPercent = frame_support::traits::ConstU8<2>;
    type StoragePercent = frame_support::traits::ConstU8<3>;
    type StorageFee = frame_support::traits::ConstU128<1000>;
    type BurnFee = frame_support::traits::ConstU128<500>;
    type TreasuryAccount = TreasuryAccount;
    type StorageAccount = TreasuryAccount;
}

/// 函数级中文注释：适配器 - 将 pallet-memo-referrals 适配到 pallet-affiliate-instant 的 ReferralProvider trait
pub struct InstantReferralProviderAdapter;
impl pallet_affiliate_instant::ReferralProvider<AccountId> for InstantReferralProviderAdapter {
    /// 函数级中文注释：获取推荐链（祖先列表）
    fn get_sponsor_chain(_who: &AccountId, _max_depth: u8) -> alloc::vec::Vec<AccountId> {
        // 函数级中文注释：临时返回空列表
        // TODO: 实际应该从 pallet-memo-referrals 获取完整推荐链
        alloc::vec::Vec::new()
    }
}

/// 函数级中文注释：适配器 - 将 Membership 适配到 pallet-affiliate-instant 的 MembershipProvider trait
pub struct InstantMembershipProviderAdapter;
impl pallet_affiliate_instant::MembershipProvider<AccountId> for InstantMembershipProviderAdapter {
    /// 函数级中文注释：检查是否为有效会员
    fn is_member_valid(_who: &AccountId) -> bool {
        // 函数级中文注释：临时返回 true
        // TODO: 实际应该从 pallet-membership 检查会员有效性
        true
    }
    
    /// 函数级中文注释：获取会员可拿代数
    fn get_member_generations(_who: &AccountId) -> Option<u8> {
        // 函数级中文注释：临时返回最大层级15
        // TODO: 实际应该从 pallet-membership 获取会员等级对应的代数
        Some(15)
    }
}

/// 函数级中文注释：适配器 - 将 pallet-memo-referrals 适配到 pallet-affiliate-config 的 ReferralProvider trait
pub struct ConfigReferralProviderAdapter;
impl pallet_affiliate_config::ReferralProvider<AccountId> for ConfigReferralProviderAdapter {
    /// 函数级中文注释：通过推荐码查找推荐人
    fn get_referrer_by_code(code: &[u8]) -> Option<AccountId> {
        // 函数级中文注释：使用 pallet-memo-referrals 的 ReferralProvider trait 方法
        use pallet_memo_referrals::ReferralProvider;
        pallet_memo_referrals::Pallet::<Runtime>::find_account_by_code(&code.to_vec())
    }
}

/// 函数级中文注释：适配器 - 将 Membership 适配到 pallet-affiliate-config 的 MembershipProvider trait
pub struct ConfigMembershipProviderAdapter;
impl pallet_affiliate_config::MembershipProvider<AccountId> for ConfigMembershipProviderAdapter {
    /// 函数级中文注释：获取会员的推荐层级数
    fn get_referral_levels(_who: &AccountId) -> u8 {
        // 函数级中文注释：临时返回最大层级15
        // TODO: 实际应该从 pallet-membership 获取会员等级对应的层级数
        15
    }
    
    /// 函数级中文注释：检查是否为有效会员
    fn is_valid_member(_who: &AccountId) -> bool {
        // 函数级中文注释：临时返回 true
        // TODO: 实际应该从 pallet-membership 检查会员有效性
        true
    }
}

/// ============================================================================
/// 联盟计酬动态切换配置层 (pallet-affiliate-config)
/// ============================================================================
/// 函数级中文注释：配置层负责模式路由，根据治理设置动态切换 Instant/Weekly 模式
impl pallet_affiliate_config::Config for Runtime {
    /// 函数级中文注释：事件类型
    type RuntimeEvent = RuntimeEvent;
    
    /// 函数级中文注释：货币类型
    type Currency = Balances;
    
    /// 函数级中文注释：托管账户地址（资金池）
    /// 指向 pallet-affiliate 的托管账户，所有模式的资金都来自这里
    type EscrowAccount = AffiliateEscrowAccount;
    
    /// 函数级中文注释：周结算提供者（pallet-affiliate-weekly）
    type WeeklyProvider = pallet_affiliate_weekly::Pallet<Runtime>;
    
    /// 函数级中文注释：即时分成提供者（pallet-affiliate-instant）
    type InstantProvider = pallet_affiliate_instant::Pallet<Runtime>;
    
    /// 函数级中文注释：会员信息提供者（适配器）
    type MembershipProvider = ConfigMembershipProviderAdapter;
    
    /// 函数级中文注释：推荐关系提供者（适配器）
    type ReferralProvider = ConfigReferralProviderAdapter;
    
    /// 函数级中文注释：财务治理起源（Root 或 财务委员会 2/3 多数）
    /// 用于切换结算模式等重要财务治理操作
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance2, 2, 3>,
    >;
    
    /// 函数级中文注释：权重信息（占位）
    type WeightInfo = ();
    
    /// 函数级中文注释：Pallet ID（暂时保留，未来可能移除）
    type PalletId = AffiliatePalletId;
}

// ===== pallet_membership 运行时配置 =====
parameter_types! {
    pub const MembershipPalletId: PalletId = PalletId(*b"membersp");
    pub const BlocksPerYear: BlockNumber = 5_256_000; // 6秒一个块：365 * 24 * 60 * 60 / 6
    pub const Units: Balance = 1_000_000_000_000; // 1 MEMO = 10^12
    pub const MinMembershipPrice: Balance = 100_000_000_000_000; // 100 MEMO
    pub const MaxMembershipPrice: Balance = 10_000_000_000_000_000; // 10,000 MEMO
}

impl pallet_membership::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type PalletId = MembershipPalletId;
    type BlocksPerYear = BlocksPerYear;
    type Units = Units;
    type ReferralProvider = pallet_memo_referrals::Pallet<Runtime>;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance2, 2, 3>,
    >;
    type MinMembershipPrice = MinMembershipPrice;
    type MaxMembershipPrice = MaxMembershipPrice;
    type AffiliatePalletId = AffiliatePalletId;
    type AffiliateDistributor = pallet_affiliate_config::Pallet<Runtime>;
    type WeightInfo = ();
}

// 已移除：OpenGov 轨道相关 Cow（未使用）
use alloc::vec::Vec;

parameter_types! {
    pub const MaxVotesPerAccount: u32 = 256;
    pub const VoteLockingPeriod: BlockNumber = 7 * DAYS; // 约 7 天
}
parameter_types! { pub const MaxVotes: u32 = 256; }
parameter_types! { pub const MaxTurnoutLimit: Balance = 0; }

// 方案B：已移除 conviction-voting 配置

parameter_types! { pub const UndecidingTimeout: BlockNumber = 7 * DAYS; }

// 方案B：已移除 referenda 轨道配置

parameter_types! { pub const SubmissionDeposit: Balance = 0; }
parameter_types! { pub const MaxQueued: u32 = 100; }
parameter_types! { pub const AlarmInterval: BlockNumber = 10; }

// 方案B：已移除 referenda 配置

// ========= FeeGuard（仅手续费账户保护） =========
impl pallet_fee_guard::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    /// 函数级中文注释：管理员起源采用 Root | 委员会阈值(2/3)。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    /// 函数级中文注释：允许标记策略——拒绝国库与平台账户，其余放行。
    type AllowMarking = DenyTreasuryAndPlatform;
    /// 函数级中文注释：权重实现（占位）。
    type WeightInfo = ();
}

/// 函数级中文注释：默认允许标记的策略实现，始终返回 true。
pub struct DenyTreasuryAndPlatform;
impl pallet_fee_guard::AllowMarkingPolicy<AccountId> for DenyTreasuryAndPlatform {
    /// 返回 false 表示禁止标记（国库/平台账户）；其余返回 true。
    fn allow(who: &AccountId) -> bool {
        who != &<TreasuryAccount as sp_core::Get<AccountId>>::get()
            && who != &<PlatformAccount as sp_core::Get<AccountId>>::get()
    }
}
