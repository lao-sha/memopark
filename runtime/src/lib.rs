#![cfg_attr(not(feature = "std"), no_std)]
#![recursion_limit = "512"]

#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

pub mod apis;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarks;
pub mod configs;

extern crate alloc;
use alloc::vec::Vec;
use sp_runtime::{
    generic, impl_opaque_keys,
    traits::{BlakeTwo256, IdentifyAccount, Verify},
    MultiAddress, MultiSignature,
};
#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;

pub use frame_system::Call as SystemCall;
pub use pallet_balances::Call as BalancesCall;
pub use pallet_timestamp::Call as TimestampCall;
// pub use pallet_ritual::Call as RitualCall;
#[cfg(any(feature = "std", test))]
pub use sp_runtime::BuildStorage;

pub mod genesis_config_presets;

/// Opaque types. These are used by the CLI to instantiate machinery that don't need to know
/// the specifics of the runtime. They can then be made to be agnostic over specific formats
/// of data like extrinsics, allowing for them to continue syncing the network through upgrades
/// to even the core data structures.
pub mod opaque {
    use super::*;
    use sp_runtime::{
        generic,
        traits::{BlakeTwo256, Hash as HashT},
    };

    pub use sp_runtime::OpaqueExtrinsic as UncheckedExtrinsic;

    /// Opaque block header type.
    pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
    /// Opaque block type.
    pub type Block = generic::Block<Header, UncheckedExtrinsic>;
    /// Opaque block identifier type.
    pub type BlockId = generic::BlockId<Block>;
    /// Opaque block hash type.
    pub type Hash = <BlakeTwo256 as HashT>::Output;
}

impl_opaque_keys! {
    pub struct SessionKeys {
        pub aura: Aura,
        pub grandpa: Grandpa,
    }
}

// To learn more about runtime versioning, see:
// https://docs.substrate.io/main-docs/build/upgrade#runtime-versioning
#[sp_version::runtime_version]
pub const VERSION: RuntimeVersion = RuntimeVersion {
    spec_name: alloc::borrow::Cow::Borrowed("stardust-runtime"),
    impl_name: alloc::borrow::Cow::Borrowed("stardust-runtime"),
    authoring_version: 1,
    // The version of the runtime specification. A full node will not attempt to use its native
    //   runtime in substitute for the on-chain Wasm runtime unless all of `spec_name`,
    //   `spec_version`, and `authoring_version` are the same between Wasm and native.
    // This value is set to 100 to notify Polkadot-JS App (https://polkadot.js.org/apps) to use
    //   the compatible custom types.
    // v102: Remove deprecated remove_deceased extrinsic from pallet-deceased
    spec_version: 102,
    impl_version: 1,
    apis: apis::RUNTIME_API_VERSIONS,
    transaction_version: 1,
    system_version: 1,
};

mod block_times {
    /// This determines the average expected block time that we are targeting. Blocks will be
    /// produced at a minimum duration defined by `SLOT_DURATION`. `SLOT_DURATION` is picked up by
    /// `pallet_timestamp` which is in turn picked up by `pallet_aura` to implement `fn
    /// slot_duration()`.
    ///
    /// Change this to adjust the block time.
    pub const MILLI_SECS_PER_BLOCK: u64 = 6000;

    // NOTE: Currently it is not possible to change the slot duration after the chain has started.
    // Attempting to do so will brick block production.
    pub const SLOT_DURATION: u64 = MILLI_SECS_PER_BLOCK;
}
pub use block_times::*;

// Time is measured by number of blocks.
pub const MINUTES: BlockNumber = 60_000 / (MILLI_SECS_PER_BLOCK as BlockNumber);
pub const HOURS: BlockNumber = MINUTES * 60;
pub const DAYS: BlockNumber = HOURS * 24;

pub const BLOCK_HASH_COUNT: BlockNumber = 2400;

// Unit = the base number of indivisible units for balances
pub const UNIT: Balance = 1_000_000_000_000;
pub const MILLI_UNIT: Balance = 1_000_000_000;
pub const MICRO_UNIT: Balance = 1_000_000;

/// Existential deposit.
pub const EXISTENTIAL_DEPOSIT: Balance = MILLI_UNIT;

/// The version information used to identify this runtime when compiled natively.
#[cfg(feature = "std")]
pub fn native_version() -> NativeVersion {
    NativeVersion {
        runtime_version: VERSION,
        can_author_with: Default::default(),
    }
}

/// Alias to 512-bit hash when used in the context of a transaction signature on the chain.
pub type Signature = MultiSignature;

/// Some way of identifying an account on the chain. We intentionally make it equivalent
/// to the public key of our transaction signing scheme.
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;

/// Balance of an account.
pub type Balance = u128;

/// Index of a transaction in the chain.
pub type Nonce = u32;

/// A hash of some data used by the chain.
pub type Hash = sp_core::H256;

/// An index to a block.
pub type BlockNumber = u32;

// 为新加入的 pallet 提供类型别名，便于统一使用
pub type DeceasedId = u64;
// pub type GraveId = u64;  // 🗑️ 2025-11-16: 已删除 - pallet-stardust-grave 已移除
// （已下线）基金会 pallet 类型别名移除

/// The address format for describing accounts.
pub type Address = MultiAddress<AccountId, ()>;

/// Block header type as expected by this runtime.
pub type Header = generic::Header<BlockNumber, BlakeTwo256>;

/// Block type as expected by this runtime.
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

/// A Block signed with a Justification
pub type SignedBlock = generic::SignedBlock<Block>;

/// BlockId type as expected by this runtime.
pub type BlockId = generic::BlockId<Block>;

/// 函数级中文注释：交易扩展（TransactionExtension）配置
/// 
/// **2025-11-07 修复**：临时移除 CheckMetadataHash 和 WeightReclaim
/// - 这两个扩展导致 TransactionPayment 在计算手续费时 panic
/// - 日志显示: "Unknown signed extensions CheckMetadataHash, WeightReclaim"
/// - 移除后可正常提交交易和预估手续费
/// 
/// **原因分析**：
/// - CheckMetadataHash 需要编译时启用 `metadata-hash` feature
/// - WeightReclaim 可能与当前的 pallet-transaction-payment 版本不兼容
/// 
/// **后续优化**：
/// - 研究这两个扩展的正确配置方式
/// - 考虑是否需要启用 metadata-hash feature
pub type TxExtension = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
    pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
    // 临时注释：修复 TransactionPayment panic
    // frame_metadata_hash_extension::CheckMetadataHash<Runtime>,
    // frame_system::WeightReclaim<Runtime>,
);

/// Unchecked extrinsic type as expected by this runtime.
pub type UncheckedExtrinsic =
    generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, TxExtension>;

/// The payload being signed in transactions.
pub type SignedPayload = generic::SignedPayload<RuntimeCall, TxExtension>;

// ===== Offchain Worker 签名支持（供 pallet-stardust-ipfs 使用）=====
impl frame_system::offchain::SigningTypes for Runtime {
    /// 函数级中文注释：OCW 使用与交易签名相同的签名类型
    type Public = <Signature as Verify>::Signer;
    type Signature = Signature;
}

/// All migrations of the runtime, aside from the ones declared in the pallets.
///
/// This can be a tuple of types, each implementing `OnRuntimeUpgrade`.
#[allow(unused_parens)]
type Migrations = (); // 🆕 2025-10-28: RenameDeceasedMediaToData 已移除 - deceased-media整合到deceased

/// Executive: handles dispatch to the various modules.
pub type Executive = frame_executive::Executive<
    Runtime,
    Block,
    frame_system::ChainContext<Runtime>,
    Runtime,
    AllPalletsWithSystem,
    Migrations,
>;

// Create the runtime by composing the FRAME pallets that were previously configured.
#[frame_support::runtime]
pub mod runtime {
    #[runtime::runtime]
    #[runtime::derive(
        RuntimeCall,
        RuntimeEvent,
        RuntimeError,
        RuntimeOrigin,
        RuntimeFreezeReason,
        RuntimeHoldReason,
        RuntimeSlashReason,
        RuntimeLockId,
        RuntimeTask,
        RuntimeViewFunction
    )]
    #[derive(Default)]
    pub struct Runtime;

    #[runtime::pallet_index(0)]
    pub type System = frame_system;

    #[runtime::pallet_index(1)]
    pub type Timestamp = pallet_timestamp;

    #[runtime::pallet_index(2)]
    pub type Aura = pallet_aura;

    #[runtime::pallet_index(3)]
    pub type Grandpa = pallet_grandpa;

    #[runtime::pallet_index(4)]
    pub type Balances = pallet_balances;

    #[runtime::pallet_index(5)]
    pub type TransactionPayment = pallet_transaction_payment;

    #[runtime::pallet_index(6)]
    pub type Sudo = pallet_sudo;

    // Include the custom logic from the pallet-template in the runtime.
    #[runtime::pallet_index(7)]
    pub type Template = pallet_template;

    // 函数级中文注释：已删除 pallet_forwarder (index 8)
    // - 元交易代付功能未完整实现，前后端均未真正使用
    // - 功能可由固定免费次数替代

    // 函数级中文注释：移除 pallet_otc_maker (index 9)
    // - 功能已被 pallet-market-maker 完全替代，避免冗余

    // 函数级中文注释：2025-10-20 移除 pallet_otc_listing (index 10)
    // - 功能已被 pallet-market-maker + pallet-otc-order 替代
    // - 挂单机制已废弃，改为直接选择做市商创建订单

    #[runtime::pallet_index(12)]
    pub type Escrow = pallet_escrow;

    #[runtime::pallet_index(13)]
    pub type Arbitration = pallet_arbitration;

    #[runtime::pallet_index(14)]
    pub type MemorialPark = pallet_stardust_park;

    // 🗑️ 2025-11-16: pallet_stardust_grave 已删除 - 功能迁移到 memorial-space + social
    // #[runtime::pallet_index(15)]
    // pub type Grave = pallet_stardust_grave;

    // 🆕 2025-10-28 已移除: MemorialOfferings 已整合到 Memorial pallet
    // #[runtime::pallet_index(16)]

    #[runtime::pallet_index(17)]
    pub type Evidence = pallet_evidence;

    #[runtime::pallet_index(18)]
    pub type Identity = pallet_identity;

    #[runtime::pallet_index(19)]
    pub type Deceased = pallet_deceased;

    // 🆕 2025-10-28 已移除: DeceasedMedia 和 DeceasedText 已整合到 Deceased pallet
    // #[runtime::pallet_index(36)]
    // pub type DeceasedMedia = pallet_deceased_media;

    // #[runtime::pallet_index(37)]
    // pub type DeceasedText = pallet_deceased_text;

    #[runtime::pallet_index(21)]
    pub type Ledger = pallet_ledger;  // 重命名：GraveLedger → Ledger（grave已删除）

    // 🆕 2025-10-28 已移除: pallet-stardust-referrals（已整合到统一 pallet-affiliate）
    // #[runtime::pallet_index(22)]
    // pub type Referrals = pallet_stardust_referrals;

    /// 函数级详细中文注释：统一联盟计酬系统 v1.0.0
    /// 
    /// **整合了5个模块**：
    /// - pallet-memo-referrals（推荐关系）
    /// - pallet-affiliate（托管）
    /// - pallet-affiliate-config（配置）
    /// - pallet-affiliate-instant（即时分成）
    /// - pallet-affiliate-weekly（周结算）
    /// 
    /// **核心功能**：
    /// - 推荐关系管理：bind_sponsor, claim_code
    /// - 资金托管：deposit, withdraw
    /// - 即时分成：实时转账
    /// - 周结算：累计应得 + 周期结算
    /// - 配置管理：set_settlement_mode, set_instant_percents, set_weekly_percents
    /// 
    /// **模式支持**：
    /// - Weekly: 全周结算
    /// - Instant: 全即时分成
    /// - Hybrid: 前N层即时 + 后M层周结算
    /// 
    /// 🆕 2025-10-28 整合完成
    #[runtime::pallet_index(24)]
    pub type Affiliate = pallet_affiliate;

    // 🆕 2025-10-28 已移除: pallet-affiliate-weekly（已整合到统一 pallet-affiliate）
    // /// 联盟计酬周结算分配层（职责：分配算法和周期结算）
    // #[runtime::pallet_index(55)]

    // 🆕 2025-10-28 已移除: pallet-affiliate-config（已整合到统一 pallet-affiliate）
    // /// 函数级中文注释：联盟计酬动态切换配置层（职责：模式路由和治理）
    // #[runtime::pallet_index(56)]

    // 🆕 2025-10-28 已移除: pallet-affiliate-instant（已整合到统一 pallet-affiliate）
    // /// 函数级中文注释：联盟计酬即时分配工具（职责：即时转账分配）
    // #[runtime::pallet_index(57)]

    #[runtime::pallet_index(58)]
    pub type Membership = pallet_membership;

    // #[runtime::pallet_index(25)] // memo-endowment 已下线
    // pub type MemoEndowment = pallet_memo_endowment;

    #[runtime::pallet_index(26)]
    pub type StardustIpfs = pallet_stardust_ipfs;

    #[runtime::pallet_index(29)]
    pub type Treasury = pallet_treasury;

    // OpenGov pallets
    #[runtime::pallet_index(32)]
    pub type OriginRestriction = pallet_origin_restriction;

    // #[runtime::pallet_index(33)]
    // pub type FeeGuard = pallet_fee_guard;
    // 已移除 FeeGuard - 使用官方 pallet-proxy 纯代理替代

    // 🆕 2025-10-28 已移除: MemoSacrifice 已整合到 Memorial pallet
    // #[runtime::pallet_index(34)]

    #[runtime::pallet_index(35)]
    pub type StardustPet = pallet_stardust_pet;

    // 委员会（Council）
    #[runtime::pallet_index(38)]
    pub type Council = pallet_collective<Instance1>;

    // 技术与安全委员会（Technical Committee）
    #[runtime::pallet_index(39)]
    pub type TechnicalCommittee = pallet_collective<Instance2>;

    // 内容委员会（Content Committee）
    #[runtime::pallet_index(40)]
    pub type ContentCommittee = pallet_collective<Instance3>;

    #[runtime::pallet_index(41)]
    pub type ContentGovernance = pallet_stardust_appeals;

    #[runtime::pallet_index(43)]
    pub type Pricing = pallet_pricing;

    /// 函数级中文注释：存储费用专用账户管理模块
    /// - 负责收集、管理和分配去中心化存储相关的资金
    /// - 与国库账户、推荐账户完全隔离，资金用途明确
    #[runtime::pallet_index(46)]
    pub type StorageTreasury = pallet_storage_treasury;

    /// 函数级中文注释：多层级余额管理模块
    /// - 支持多种余额层级：Gas（手续费）、Points（积分）、VIP（会员）、Gift（红包）等
    /// - 完全隔离：不同层级的余额独立存储和管理
    /// - 来源追踪：记录每笔余额的来源和使用情况
    // 函数级中文注释：2025-10-22 已删除 pallet-balance-tiers (index 48)
    // - 功能与固定免费次数重复，复杂度过高（2,000+行代码）
    // - 成本更高（50,000 DUST vs 200 DUST，降低99.6%）
    // - 新用户 Gas 已由固定免费次数覆盖（做市商代付）
    // - 活动空投、邀请奖励改用直接转账 DUST（更简单）

    /// 函数级中文注释：2025-10-28 移除旧的 pallet-buyer-credit 和 pallet-maker-credit
    /// 已整合为统一的 pallet-credit

    /// 函数级中文注释：统一信用风控管理模块（AI 智能风控系统）
    /// 
    /// **买家信用子系统**：
    /// - 多维度信任评估：资产信任（余额、Staking）+ 账户年龄 + 活跃度 + 社交信任
    /// - 新用户分层冷启动：Premium/Standard/Basic/Restricted 四级初始限额
    /// - 信用等级体系：Newbie/Bronze/Silver/Gold/Diamond 五级渐进式升级
    /// - 快速学习机制：前3笔交易权重5x，快速建立用户画像
    /// - 社交信任网络：邀请人信誉传递、用户互相推荐、推荐人连带责任
    /// - 行为模式分析：每5笔分析付款速度、金额稳定性、时间分布
    /// - 防恶意购买：限额控制、冷却期、违约惩罚、女巫攻击检测
    /// 
    /// **做市商信用子系统**：
    /// - 信用评分体系：800-1000分，五个等级（钻石/白金/黄金/白银/青铜）
    /// - 履约率追踪：订单完成率、及时释放率、超时率
    /// - 违约惩罚：超时未释放（-10分）、争议败诉（-20分）
    /// - 动态保证金：信用分高 → 保证金降低50%（钻石做市商）
    /// - 服务质量评价：买家1-5星评分影响信用分
    /// - 自动降级/禁用：信用分 < 750 → 自动暂停接单
    #[runtime::pallet_index(49)]
    pub type Credit = pallet_credit;

    /// 函数级中文注释：去中心化聊天功能模块（混合方案）
    /// - 链上存储：消息元数据（发送方、接收方、IPFS CID、时间戳等）
    /// - IPFS 存储：加密的消息内容
    /// - 端到端加密：前端实现消息加密，保护隐私
    /// - 核心特性：私聊、会话管理、已读/未读状态、消息软删除、未读计数
    /// - 适用场景：OTC 交易沟通、做市商客服、家族私密沟通
    #[runtime::pallet_index(51)]
    pub type Chat = pallet_chat;

    /// 函数级中文注释：通用押金管理模块
    /// - 统一管理：申诉押金、审核押金、投诉押金等
    /// - 资金安全：使用Currency trait确保押金安全冻结
    /// - 可追溯性：完整记录押金生命周期（冻结→释放/罚没）
    /// - 灵活策略：支持全额退回、部分罚没、全部罚没
    /// 函数级中文注释：通用押金管理模块
    /// - 统一管理：申诉押金、审核押金、投诉押金等
    /// - 资金安全：使用Currency trait确保押金安全冻结
    /// - 可追溯性：完整记录押金生命周期（冻结→释放/罚没）
    /// - 灵活策略：支持全额退回、部分罚没、全部罚没
    /// - 扩展性：通过DepositPurpose枚举支持多种业务场景
    /// - [已归档 2025-11-03] 迁移到 Holds API，参考 pallet-stardust-appeals
    // #[runtime::pallet_index(52)]
    // pub type Deposits = pallet_deposits;

    /// 函数级中文注释：统一纪念服务系统（Memorial Integration）
    /// 🆕 2025-10-28：整合 pallet-memorial 和 pallet-memorial
    /// 
    /// **祭祀品目录（Sacrifice Catalog）**：
    /// - 目录管理：创建/更新/启用/禁用祭祀品规格
    /// - 定价策略：固定价格 或 按周单价
    /// - VIP体系：支持VIP专属祭祀品 + 会员折扣
    /// 
    /// **供奉业务（Offerings）**：
    /// - 供奉方式：自定义供奉 或 通过目录下单（offer_by_sacrifice）
    /// - 定价管理：固定价格 或 按时长计费
    /// - 会员特权：VIP折扣（如30%）
    /// - 风控系统：限频控制（账户级 + 目标级）+ 最低金额
    /// - 多路分账：支持全局路由表 + 按域路由表
    /// - 暂停控制：全局暂停 或 按域暂停
    /// - 审核流程：用户提交 → 委员会审批 → 上架/拒绝
    /// 
    /// **精简优化**（vs. 原设计）：
    /// - 函数减少60%（13个 vs. 原32个）
    /// - 存储减少55%（31个 vs. 原69个）
    /// - 移除过度设计：场景分类、效果元数据、投诉机制等
    #[runtime::pallet_index(59)]
    pub type Memorial = pallet_memorial;

    /// 函数级详细中文注释：做市商管理模块 v2.0.0 (Maker Pallet)
    /// 
    /// 🆕 2025-11-03：从 pallet-trading 拆分为独立模块
    /// 
    /// **核心功能**：
    /// - ✅ 押金锁定与解锁（1000 DUST）
    /// - ✅ 资料提交与审核（姓名、身份证、生日、TRON地址、EPAY配置）
    /// - ✅ 状态流转（DepositLocked → PendingReview → Active）
    /// - ✅ 提现申请与冷却期（7天）
    /// - ✅ 治理权限审批（approve/reject/emergency_withdrawal）
    /// - ✅ 信用评分集成（MakerCreditInterface）
    /// 
    /// **安全特性**：
    /// - ✅ 押金托管（使用 Currency::reserve）
    /// - ✅ 提现冷却期（防止快速提现）
    /// - ✅ 治理权限控制（仅治理账户可审批）
    /// - ✅ 数据掩码（隐私保护）
    #[runtime::pallet_index(60)]
    pub type Maker = pallet_maker;

    /// 函数级详细中文注释：OTC 订单管理模块 v2.0.0 (OTC Order Pallet)
    /// 
    /// 🆕 2025-11-03：从 pallet-trading 拆分为独立模块
    /// 
    /// **核心功能**：
    /// - ✅ 普通订单创建/支付/释放（用户指定数量和金额）
    /// - ✅ 首购订单创建（固定 $10 USD，动态 DUST）
    /// - ✅ 订单自动过期（1小时未支付）
    /// - ✅ 做市商首购订单配额管理（最多5个）
    /// - ✅ 订单取消与争议
    /// - ✅ 托管集成（自动锁定/释放/退款）
    /// - ✅ 信用评分集成（BuyerCreditInterface）
    /// 
    /// **首购逻辑**：
    /// - 固定 $10 USD 价值
    /// - 动态计算 DUST 数量（基于 pallet-pricing 实时汇率）
    /// - 安全边界：100 DUST ≤ DUST 数量 ≤ 10,000 DUST
    /// - 不占用做市商押金配额（从自由余额扣除）
    /// - 每个做市商最多同时接收 5 个首购订单
    /// 
    /// **安全特性**：
    /// - ✅ 自动过期清理（on_idle hook）
    /// - ✅ 价格异常保护（安全边界）
    /// - ✅ 配额管理（防止滥用）
    #[runtime::pallet_index(61)]
    pub type OtcOrder = pallet_otc_order;

    /// 函数级详细中文注释：DUST ↔ USDT 桥接模块 v2.0.0 (Bridge Pallet)
    /// 
    /// 🆕 2025-11-03：从 pallet-trading 拆分为独立模块
    /// 
    /// **核心功能**：
    /// - ✅ 官方桥接（DUST → USDT TRC20）
    /// - ✅ 做市商桥接（更快速，点对点）
    /// - ✅ OCW 链下验证（自动处理 TRON 转账）
    /// - ✅ 超时退款机制（30分钟）
    /// - ✅ 举报/仲裁流程
    /// - ✅ 托管集成（自动锁定/释放/退款）
    /// 
    /// **安全特性**：
    /// - ✅ 最小兑换金额（10 DUST）
    /// - ✅ 超时保护（防止资金冻结）
    /// - ✅ OCW 去中心化处理
    /// - ✅ 仲裁机制（用户举报 + 治理裁决）
    #[runtime::pallet_index(62)]
    pub type Bridge = pallet_bridge;

    /// 函数级详细中文注释：AI驱动的交易策略管理模块 v1.0.0 (AI Strategy Pallet)
    /// 
    /// 🆕 2025-11-04：AI增强的自动化交易系统
    /// 
    /// **核心功能**：
    /// - ✅ AI策略配置管理（GPT-4/Transformer/LSTM/Ensemble）
    /// - ✅ AI模型参数配置（置信度阈值、特征集）
    /// - ✅ AI信号历史记录（推理理由、特征重要性）
    /// - ✅ 策略表现跟踪（盈亏、胜率、夏普比率）
    /// - ✅ 多策略类型支持（网格、做市、套利、AI纯策略）
    /// - ✅ 风控管理（最大仓位、杠杆、止损止盈）
    /// 
    /// **创新特性**：
    /// - ✅ AI + 区块链深度融合（完全透明可追溯）
    /// - ✅ 多层AI决策架构（集成多个模型）
    /// - ✅ 链上风控 + AI风险评估
    /// - ✅ OCW自动化执行（7×24运行）
    /// 
    /// **安全特性**：
    /// - ✅ API密钥加密存储
    /// - ✅ 置信度阈值过滤
    /// - ✅ 多层风控检查
    /// - ✅ 完整审计追踪
    #[runtime::pallet_index(65)]
    pub type AITrader = pallet_ai_trader;

    /// 函数级中文注释：DUST 跨链桥接模块（v0.1.0 2025-11-05）
    /// 
    /// ## 功能说明
    /// 实现 Stardust 链原生 DUST 与 Arbitrum ERC20 DUST 的跨链桥接
    /// 
    /// ## 桥接模型
    /// - **锁定-铸造（Lock & Mint）**：
    ///   - Stardust → Arbitrum: 锁定原生 DUST，铸造 ERC20 DUST
    ///   - Arbitrum → Stardust: 销毁 ERC20 DUST，解锁原生 DUST
    /// 
    /// ## 核心特性
    /// - ✅ OCW 自动中继服务
    /// - ✅ 多签桥接账户
    /// - ✅ 防重放攻击
    /// - ✅ 金额限制保护
    /// - ✅ 超时自动失败
    #[runtime::pallet_index(66)]
    pub type DustBridge = pallet_dust_bridge;

    /// 函数级详细中文注释：逝者AI准备层（Phase 3 - Layer 2）
    ///
    /// 🆕 2025-11-13：Phase 3 第二层 - AI训练准备层
    ///
    /// **核心功能**：
    /// - ✅ AI智能体管理（创建/配置/暂停）
    /// - ✅ 训练任务提交与状态跟踪
    /// - ✅ 作品数据导出（标准化格式）
    /// - ✅ 训练进度监控
    /// - ✅ 智能体版本管理
    ///
    /// **三层架构定位**：
    /// - Layer 1 (pallet-deceased): 数据存储层 - 作品、元数据
    /// - **Layer 2 (pallet-deceased-ai)**: AI准备层 - 服务管理、训练任务
    /// - Layer 3 (pallet-ai-chat): AI集成层 - 对话服务、实时交互
    ///
    /// **设计理念**：
    /// - ✅ 低耦合：通过 DeceasedDataProvider trait 解耦
    /// - ✅ 可扩展：支持多种AI服务商（OpenAI、Anthropic等）
    /// - ✅ 可审计：完整记录训练过程和结果
    #[runtime::pallet_index(67)]
    pub type DeceasedAI = pallet_deceased_ai;

    /// 函数级详细中文注释：AI对话集成层（Phase 3 - Layer 3）
    ///
    /// 🆕 2025-11-13：Phase 3 第三层 - AI对话集成层
    ///
    /// **核心功能**：
    /// - ✅ 对话会话管理（创建/暂停/归档）
    /// - ✅ 消息发送与接收
    /// - ✅ 个性化配置（风格、参数）
    /// - ✅ API配置管理（多服务商支持）
    /// - ✅ OCW AI请求处理
    /// - ✅ 质量评估体系（6维度评分）
    ///
    /// **三层架构定位**：
    /// - Layer 1 (pallet-deceased): 数据存储层 - 作品、元数据
    /// - Layer 2 (pallet-deceased-ai): AI准备层 - 服务管理、训练任务
    /// - **Layer 3 (pallet-ai-chat)**: AI集成层 - 对话服务、实时交互
    ///
    /// **设计理念**：
    /// - ✅ 实时交互：OCW worker自动处理AI请求
    /// - ✅ 多服务商：支持OpenAI、Anthropic、Alibaba、Baidu
    /// - ✅ 质量保证：多维度质量评估系统
    /// - ✅ 个性化：风格标签、温度参数、提示词定制
    #[runtime::pallet_index(68)]
    pub type AIChat = pallet_ai_chat;

    /// 函数级详细中文注释：治理参数集中管理模块 v0.1.0 (Governance Params Pallet)
    ///
    /// 🆕 2025-01-20：集中管理所有治理相关参数
    ///
    /// **核心功能**：
    /// - ✅ 押金参数管理：申诉押金、投诉押金、非拥有者操作押金
    /// - ✅ 期限参数管理：公示期、投票期、执行延迟、投诉期
    /// - ✅ 费率参数管理：投诉人分配比例、委员会分配比例、拥有者分配比例
    /// - ✅ 阈值参数管理：提案门槛、投票通过门槛、仲裁费用门槛
    /// - ✅ 治理调整：所有参数变更需要治理投票
    /// - ✅ 事件通知：参数变更时发出事件
    ///
    /// **设计理念**：
    /// - 单一参数源：所有治理参数集中在一个模块管理
    /// - 治理调整：参数变更需要通过治理投票（Root或委员会2/3多数）
    /// - 类型安全：强类型参数定义，编译时检查
    /// - 向后兼容：接口稳定，便于其他模块集成
    #[runtime::pallet_index(69)]
    pub type GovernanceParams = pallet_governance_params;

    /// 函数级详细中文注释：社交关系管理模块 v1.0.0
    ///
    /// 🆕 2025-11-17：多类型目标关注系统
    ///
    /// **核心功能**：
    /// - ✅ 多类型目标支持：Deceased（逝者）、User（用户）、Grave（墓地）、Pet（宠物）、Memorial（纪念馆）
    /// - ✅ 双向索引：FollowingMap（关注列表）+ FollowersList（关注者列表）
    /// - ✅ 关注管理：follow、unfollow、remove_follower
    /// - ✅ 批量操作：batch_follow、batch_unfollow
    /// - ✅ 通知设置：update_notification_setting
    /// - ✅ 兼容接口：为 deceased 迁移提供完整适配
    ///
    /// **设计理念**：
    /// - 统一管理：将分散的关注功能集中到单一模块
    /// - 类型扩展：支持未来添加新的目标类型
    /// - 高效查询：双向索引 + 计数缓存
    /// - 迁移友好：保留 deceased 兼容接口
    #[runtime::pallet_index(70)]
    pub type Social = pallet_social;

	/// 函数级详细中文注释：八字排盘系统 v1.0.0 (Bazi Chart Pallet)
	///
	/// 🆕 2025-11-25：中国传统命理计算系统
	///
	/// **核心功能**：
	/// - ✅ 四柱计算：日柱、年柱、月柱、时柱（精确算法）
	/// - ✅ 子时双模式：传统派（23:00属次日）+ 现代派（23:00属当日）⭐
	/// - ✅ 大运计算：起运年龄、大运序列（12步，120年）
	/// - ✅ 五行强度：月令权重法 + 藏干权重计算
	/// - ✅ 喜用神判断：日主强弱分析
	/// - ✅ 十神关系：完整的十神查表系统
	/// - ✅ 藏干计算：权威藏干表（辰=戊乙癸）
	/// - ✅ 纳音五行：30种纳音类型
	///
	/// **技术特性**：
	/// - 儒略日数算法（日柱计算）
	/// - 立春边界处理（年柱计算）
	/// - 五虎遁口诀（月柱计算）
	/// - 五鼠遁口诀（时柱计算）
	/// - 权重矩阵计算（五行强度）
	///
	/// **唯一特性**：
	/// - ⭐ 区块链中唯一支持子时双模式的八字系统
	/// - ⭐ 87.5%项目验证的权威藏干表
	/// - ⭐ 完整的命理计算功能（2985行代码）
	#[runtime::pallet_index(71)]
	pub type BaziChart = pallet_bazi_chart;

	// ========= 🆕 2025-11-29 梅花易数系统（区块链占卜）=========

	/// 函数级详细中文注释：梅花易数排盘系统 (Meihua Pallet)
	///
	/// 🆕 2025-11-29：区块链上的梅花易数排盘系统
	///
	/// **核心功能**：
	/// - ✅ 时间起卦（区块时间戳转农历）
	/// - ✅ 双数起卦
	/// - ✅ 随机起卦（链上随机数）
	/// - ✅ 手动指定起卦
	/// - ✅ 卦象存储与查询
	/// - ✅ AI 解卦请求
	///
	/// **梅花易数概念**：
	/// - 八卦：乾、兑、离、震、巽、坎、艮、坤
	/// - 五行：金、木、水、火、土
	/// - 体用关系：判断吉凶的核心依据
	#[runtime::pallet_index(73)]
	pub type Meihua = pallet_meihua;

	// 🗑️ 2025-12-01 已删除：meihua-ai/market/nft 功能已抽离到通用模块 divination-ai/market/nft
	// #[runtime::pallet_index(74)]
	// pub type MeihuaAi = pallet_meihua_ai;
	// #[runtime::pallet_index(75)]
	// pub type MeihuaMarket = pallet_meihua_market;
	// #[runtime::pallet_index(76)]
	// pub type MeihuaNft = pallet_meihua_nft;

	/// 函数级详细中文注释：统一隐私授权模块 (Divination Privacy Pallet)
	///
	/// 🆕 2025-12-24：为所有占卜系统提供统一的加密存储和多方授权功能
	///
	/// **核心功能**：
	/// - ✅ 密钥管理：用户注册和更新 X25519 加密公钥
	/// - ✅ 服务提供者管理：命理师、AI 服务、家族成员注册
	/// - ✅ 加密数据存储：AES-256-GCM 加密的敏感数据存储
	/// - ✅ 授权管理：多方授权、角色控制、范围控制
	/// - ✅ 悬赏集成：与悬赏系统的授权集成
	///
	/// **设计理念**：
	/// - 统一的隐私授权接口，供所有占卜 pallet 使用
	/// - 支持多种服务提供者类型和授权角色
	/// - 与悬赏市场深度集成
	#[runtime::pallet_index(76)]
	pub type DivinationPrivacy = pallet_divination_privacy;

	/// 函数级详细中文注释：聊天权限系统 v4.0 (Chat Permission Pallet)
	///
	/// 🆕 2025-11-28：基于场景的多场景共存聊天权限控制系统
	///
	/// **核心功能**：
	/// - ✅ 场景类型：做市商（MarketMaker）、订单（Order）、纪念馆（Memorial）、群聊（Group）、自定义
	/// - ✅ 场景授权管理：授予/撤销/延期场景授权
	/// - ✅ 双向授权：自动处理双向聊天权限
	/// - ✅ 隐私设置：Open/FriendsOnly/Whitelist/Closed 四种权限级别
	/// - ✅ 好友系统：互加好友关系管理
	/// - ✅ 黑白名单：屏蔽和白名单功能
	/// - ✅ Runtime API：前端权限查询接口
	///
	/// **四层权限判断**：
	/// 1. 黑名单检查（最高优先级）
	/// 2. 好友关系检查
	/// 3. 场景授权检查
	/// 4. 隐私设置检查
	///
	/// **设计理念**：
	/// - 业务 pallet 通过 SceneAuthorizationManager trait 自动授予聊天权限
	/// - 场景可自动过期，支持有效期设置
	/// - 低耦合设计，通过 trait 与业务模块解耦
	#[runtime::pallet_index(72)]
	pub type ChatPermission = pallet_chat_permission;

	// ========= 🆕 2025-11-29 通用占卜系统（支持多种玄学体系）=========

	/// 函数级详细中文注释：通用占卜 NFT 系统 (Divination NFT Pallet)
	///
	/// 🆕 2025-11-29：支持多种占卜类型的通用 NFT 铸造与交易系统
	///
	/// **核心功能**：
	/// - ✅ 多类型支持：梅花易数、八字命理、六爻、奇门遁甲、紫微斗数
	/// - ✅ NFT 铸造（基于占卜结果，自动判定稀有度）
	/// - ✅ NFT 交易市场（挂单、购买、出价、取消）
	/// - ✅ 收藏集管理（按占卜类型、创建者分类）
	/// - ✅ 版税分配（创作者转售版税）
	///
	/// **稀有度系统**：
	/// - Common: 普通占卜结果
	/// - Rare: 特殊组合
	/// - Epic: 完美配置
	/// - Legendary: 完美配置 + 特殊日期
	#[runtime::pallet_index(77)]
	pub type DivinationNft = pallet_divination_nft;

	/// 函数级详细中文注释：通用占卜 AI 解读系统 (Divination AI Pallet)
	///
	/// 🆕 2025-11-29：基于预言机网络的多类型 AI 智能解读
	///
	/// **核心功能**：
	/// - ✅ 多类型支持：梅花易数、八字命理、六爻、奇门遁甲、紫微斗数
	/// - ✅ AI 解读请求管理（支持不同类型的解读）
	/// - ✅ 预言机节点注册与管理（质押、惩罚机制）
	/// - ✅ 解读结果提交与存储（IPFS 内容寻址）
	/// - ✅ 用户评分与争议处理
	/// - ✅ 费用分配机制（平台费 + 预言机奖励）
	///
	/// **支持的解读类型**：
	/// - 通用解读、事业运势、感情婚姻、财运投资、健康养生、学业考试
	#[runtime::pallet_index(78)]
	pub type DivinationAi = pallet_divination_ai;

	/// 函数级详细中文注释：通用占卜服务市场 (Divination Market Pallet)
	///
	/// 🆕 2025-11-29：去中心化的多类型占卜服务交易市场
	///
	/// **核心功能**：
	/// - ✅ 多类型支持：梅花易数、八字命理、六爻、奇门遁甲、紫微斗数
	/// - ✅ 服务提供者注册与等级管理（新手→认证→资深→专家→大师）
	/// - ✅ 服务套餐定义（文字/语音/视频/实时咨询）
	/// - ✅ 订单创建与流转（支付→接单→解读→完成→评价）
	/// - ✅ 追问功能（套餐内包含追问次数）
	/// - ✅ 评价与信誉系统（多维度评分）
	/// - ✅ 收入结算与提现
	///
	/// **等级体系**：
	/// - 新手 → 认证（10单+3.5星） → 资深（50单+4.0星） → 专家（200单+4.5星） → 大师（500单+4.8星）
	/// - 平台费率随等级降低：20% → 15% → 12% → 10% → 8%
	#[runtime::pallet_index(79)]
	pub type DivinationMarket = pallet_divination_market;

	/// 函数级详细中文注释：塔罗牌排盘系统 (Tarot Pallet)
	///
	/// 🆕 2025-11-30：区块链塔罗牌占卜功能
	///
	/// **核心功能**：
	/// - ✅ 随机抽牌：使用链上随机数生成
	/// - ✅ 时间起卦：基于区块时间戳
	/// - ✅ 数字起卦：用户输入数字
	/// - ✅ 手动指定：直接指定牌面
	/// - ✅ 多种牌阵：单张、三牌、凯尔特十字等
	/// - ✅ AI 解读请求：链下预言机触发
	///
	/// **塔罗牌组成**：
	/// - 大阿卡纳：22张主牌（0-21）代表人生重大主题
	/// - 小阿卡纳：56张副牌（22-77）分四种花色
	/// - 正逆位：影响解读方向
	#[runtime::pallet_index(80)]
	pub type Tarot = pallet_tarot;

	/// 函数级详细中文注释：奇门遁甲排盘系统 (Qimen Pallet)
	///
	/// 🆕 2025-12-01：区块链奇门遁甲排盘功能
	///
	/// **核心功能**：
	/// - ✅ 时间起局：根据四柱和节气自动计算
	/// - ✅ 数字起局：用户输入数字配合区块哈希
	/// - ✅ 随机起局：链上随机数生成
	/// - ✅ 手动指定：直接指定阴阳遁和局数
	/// - ✅ AI 解读请求：链下预言机触发
	///
	/// **奇门遁甲核心概念**：
	/// - 阴阳遁：冬至到夏至为阳遁（顺行），夏至到冬至为阴遁（逆行）
	/// - 三元：上中下三元，各5天一个周期
	/// - 局数：1-9局，由节气和三元决定
	/// - 四盘：天盘（九星）、地盘（三奇六仪）、人盘（八门）、神盘（八神）
	/// - 值符值使：当值的星和门，是奇门的核心
	///
	/// **九宫分布**：
	/// - 坎一宫（北）、坤二宫（西南）、震三宫（东）、巽四宫（东南）
	/// - 中五宫（中央）、乾六宫（西北）、兑七宫（西）、艮八宫（东北）
	/// - 离九宫（南）
	#[runtime::pallet_index(81)]
	pub type Qimen = pallet_qimen;

	/// 函数级详细中文注释：紫微斗数排盘系统 (Ziwei Pallet)
	///
	/// 🆕 2025-12-01：区块链紫微斗数排盘功能
	///
	/// **核心功能**：
	/// - ✅ 时间起盘：根据农历出生时间计算命盘
	/// - ✅ 手动指定：直接输入年干支和时辰
	/// - ✅ 随机起盘：链上随机数生成
	/// - ✅ AI 解读请求：链下预言机触发
	/// - ✅ 命盘公开/私有设置
	///
	/// **紫微斗数核心概念**：
	/// - 十四主星：紫微星系6星（紫微、天机、太阳、武曲、天同、廉贞）
	///             天府星系8星（天府、太阴、贪狼、巨门、天相、天梁、七杀、破军）
	/// - 六吉六煞：文昌、文曲、左辅、右弼、天魁、天钺（吉）
	///             擎羊、陀罗、火星、铃星、地空、地劫（煞）
	/// - 四化飞星：化禄、化权、化科、化忌
	/// - 五行局：水二局、木三局、金四局、土五局、火六局
	/// - 十二宫：命宫、父母、福德、田宅、官禄、交友、迁移、疾厄、财帛、子女、夫妻、兄弟
	#[runtime::pallet_index(82)]
	pub type Ziwei = pallet_ziwei;

	/// 🆕 2025-12-01 六爻排盘系统
	///
	/// **功能说明**：
	/// - 📊 多种起卦方式（铜钱、数字、时间、随机、手动）
	/// - 🔮 完整纳甲算法（八卦配天干地支）
	/// - 📈 世应计算（寻世诀）
	/// - 🏛️ 卦宫归属（认宫诀）
	/// - 👨‍👩‍👧‍👦 六亲配置（兄弟、父母、官鬼、妻财、子孙）
	/// - 🐉 六神排布（青龙、朱雀、勾陈、螣蛇、白虎、玄武）
	/// - ⭕ 旬空计算（六十甲子旬空）
	/// - 👤 伏神查找（缺失六亲从本宫纯卦寻伏）
	/// - 🔄 变卦生成（动爻变化形成变卦）
	/// - 🤖 AI 智能解卦（IPFS 存储解读结果）
	/// - 👁️ 卦象公开/私有设置
	///
	/// **六爻核心概念**：
	/// - 八卦：乾、兑、离、震、巽、坎、艮、坤
	/// - 六十四卦：八卦两两组合形成的重卦
	/// - 爻类型：少阴、少阳（静爻）、老阴、老阳（动爻）
	/// - 纳甲口诀：乾纳甲壬，坤纳乙癸，震纳庚，巽纳辛，坎纳戊，离纳己，艮纳丙，兑纳丁
	/// - 世应口诀：天同二世天变五，地同四世地变初，本宫六世三世异，人同游魂人变归
	#[runtime::pallet_index(83)]
	pub type Liuyao = pallet_liuyao;

	/// 🆕 2025-12-01 大六壬排盘系统
	///
	/// **功能说明**：
	/// - 🔮 起课方式：时间起课、随机起课、手动指定
	/// - 📊 天盘计算：月将加占时，天盘顺时针旋转
	/// - 🎯 四课起法：干阳神、干阴神、支阳神、支阴神
	/// - 📈 九种课式：贼克、比用、涉害、遥克、昂星、别责、八专、伏吟、返吟
	/// - 🔄 三传推导：初传、中传、末传
	/// - ⭐ 天将排布：十二天将（贵人为首，顺逆排布）
	/// - 🤖 AI 智能解读（IPFS 存储解读结果）
	/// - 👁️ 式盘公开/私有设置
	///
	/// **大六壬核心概念**：
	/// - 天盘：十二地支顺时针旋转布局
	/// - 四课：日干日支所临神将
	/// - 三传：初传、中传、末传（九种取法）
	/// - 十二天将：贵人、螣蛇、朱雀、六合、勾陈、青龙、天空、白虎、太常、玄武、太阴、天后
	/// - 贵人表：根据日干和昼夜定贵人所临
	/// - 天干寄宫：甲寅、乙辰、丙戊巳、丁己未、庚申、辛戌、壬亥、癸丑
	#[runtime::pallet_index(84)]
	pub type Daliuren = pallet_daliuren;

	/// 函数级中文注释：小六壬排盘 Pallet (pallet-xiaoliuren)
	///
	/// **🆕 2025-12-01**: 小六壬区块链占卜系统
	///
	/// 小六壬又称"诸葛亮马前课"或"掐指速算"，是中国古代流传的一种简易占卜术。
	/// 通过六宫（大安、留连、速喜、赤口、小吉、空亡）来预测吉凶。
	///
	/// **功能特性**：
	/// - ⏰ 时间起课：按农历月日时起课（传统方法）
	/// - 🔢 数字起课：活数起课法，三个数字计算三宫
	/// - 🎲 随机起课：使用链上随机数生成
	/// - ✋ 手动指定：直接指定三宫结果
	/// - 🤖 AI 智能解读（IPFS 存储解读结果）
	/// - 👁️ 课盘公开/私有设置
	///
	/// **六宫含义**：
	/// - 大安：属木，临青龙，吉祥安康
	/// - 留连：属水，临玄武，延迟纠缠
	/// - 速喜：属火，临朱雀，快速喜庆
	/// - 赤口：属金，临白虎，口舌是非
	/// - 小吉：属木，临六合，和合吉利
	/// - 空亡：属土，临勾陈，无果忧虑
	#[runtime::pallet_index(85)]
	pub type XiaoLiuRen = pallet_xiaoliuren;

	/// 🆕 2025-12-15 黄历模块
	///
	/// 通过 Off-chain Worker 获取黄历数据并存储到链上，
	/// 为占卜系统提供日期相关的黄历信息查询服务。
	///
	/// **功能特性**：
	/// - 通过 OCW 定期从阿里云黄历 API 获取数据
	/// - 支持手动设置黄历数据 (需要权限)
	/// - 提供按日期查询黄历的接口
	/// - 支持查询节气、节日等信息
	///
	/// **启动方式**：
	/// ```bash
	/// ALMANAC_APPCODE=xxx ./target/release/solochain-template-node --dev
	/// ```
	#[runtime::pallet_index(86)]
	pub type Almanac = pallet_almanac;

	// 🆕 2025-11-03 Frontier: 以太坊兼容层（官方 Parity Pallet）
	// ⚠️ 临时禁用以排查 runtime 启动问题
	// /// 函数级中文注释：EVM 虚拟机（执行以太坊智能合约）
	// /// - 支持 Solidity/Vyper 编译的合约
	// /// - Gas 费用使用 DUST 代币
	// /// - Chain ID: 8888 (测试网)
	// #[runtime::pallet_index(100)]
	// pub type EVM = pallet_evm;
	//
	// /// 函数级中文注释：Ethereum 兼容层（处理以太坊交易格式）
	// /// - 支持 Legacy、EIP-1559、EIP-2930 交易
	// /// - 生成以太坊兼容的区块头和收据
	// #[runtime::pallet_index(101)]
	// pub type Ethereum = pallet_ethereum;
	//
	// /// 函数级中文注释：BaseFee 管理（EIP-1559 基础费用）
	// /// - 动态调整 Gas 价格
	// /// - 初始值: 1 Gwei
	// #[runtime::pallet_index(102)]
	// pub type BaseFee = pallet_base_fee;
	//
	// /// 函数级中文注释：DynamicFee（动态费用调整）
	// /// - 根据网络负载自动调整费用
	// #[runtime::pallet_index(103)]
	// pub type DynamicFee = pallet_dynamic_fee;
}
