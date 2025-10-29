#![cfg_attr(not(feature = "std"), no_std)]
#![recursion_limit = "256"]

#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

pub mod apis;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarks;
pub mod configs;

extern crate alloc;
use alloc::vec::Vec;
// 🆕 2025-10-28 已移除: OnRuntimeUpgrade 和 Weight 不再需要（RenameDeceasedMediaToData已注释）
// use frame_support::traits::OnRuntimeUpgrade;
// use frame_support::weights::Weight;
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
    spec_name: alloc::borrow::Cow::Borrowed("memopark-runtime"),
    impl_name: alloc::borrow::Cow::Borrowed("memopark-runtime"),
    authoring_version: 1,
    // The version of the runtime specification. A full node will not attempt to use its native
    //   runtime in substitute for the on-chain Wasm runtime unless all of `spec_name`,
    //   `spec_version`, and `authoring_version` are the same between Wasm and native.
    // This value is set to 100 to notify Polkadot-JS App (https://polkadot.js.org/apps) to use
    //   the compatible custom types.
    spec_version: 101,
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
pub type GraveId = u64;
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

/// The `TransactionExtension` to the basic transaction logic.
pub type TxExtension = (
    frame_system::CheckNonZeroSender<Runtime>,
    frame_system::CheckSpecVersion<Runtime>,
    frame_system::CheckTxVersion<Runtime>,
    frame_system::CheckGenesis<Runtime>,
    frame_system::CheckEra<Runtime>,
    frame_system::CheckNonce<Runtime>,
    frame_system::CheckWeight<Runtime>,
    pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
    frame_metadata_hash_extension::CheckMetadataHash<Runtime>,
    frame_system::WeightReclaim<Runtime>,
);

/// Unchecked extrinsic type as expected by this runtime.
pub type UncheckedExtrinsic =
    generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, TxExtension>;

/// The payload being signed in transactions.
pub type SignedPayload = generic::SignedPayload<RuntimeCall, TxExtension>;

// ===== Offchain Worker 签名支持（供 pallet-memo-ipfs 使用）=====
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

// 🆕 2025-10-28 已注释: DeceasedMedia 已整合到 Deceased pallet
/*
/// 函数级中文注释：运行时迁移——将旧 Pallet 名称 `DeceasedMedia` 的存储前缀整体迁移到新别名 `DeceasedData`。
/// - 仅移动存储前缀，不变更内部键结构；应在升级窗口内配合前端/SDK 兼容新的 section 名。
pub struct RenameDeceasedMediaToData;

impl OnRuntimeUpgrade for RenameDeceasedMediaToData {
    fn on_runtime_upgrade() -> Weight {
        use frame_support::storage::migration::move_pallet;
        // 旧/新 Pallet 名（以 construct_runtime 别名为准）
        let old = b"DeceasedMedia";
        let new = b"DeceasedData";
        move_pallet(new, old);
        // 近似权重：常数 + 读写开销（此处返回常数，实际可用 try-runtime 校验）
        Weight::from_parts(10_000, 0)
    }
}
*/

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

    #[runtime::pallet_index(15)]
    pub type Grave = pallet_stardust_grave;

    // 🆕 2025-10-28 已移除: MemorialOfferings 已整合到 Memorial pallet
    // #[runtime::pallet_index(16)]
    // pub type MemorialOfferings = pallet_memo_offerings;

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
    pub type GraveLedger = pallet_ledger;

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
    // pub type AffiliateWeekly = pallet_affiliate_weekly;

    // 🆕 2025-10-28 已移除: pallet-affiliate-config（已整合到统一 pallet-affiliate）
    // /// 函数级中文注释：联盟计酬动态切换配置层（职责：模式路由和治理）
    // #[runtime::pallet_index(56)]
    // pub type AffiliateConfig = pallet_affiliate_config;

    // 🆕 2025-10-28 已移除: pallet-affiliate-instant（已整合到统一 pallet-affiliate）
    // /// 函数级中文注释：联盟计酬即时分配工具（职责：即时转账分配）
    // #[runtime::pallet_index(57)]
    // pub type AffiliateInstant = pallet_affiliate_instant;

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
    // pub type MemoSacrifice = pallet_memo_sacrifice;

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
    // - 成本更高（50,000 MEMO vs 200 DUST，降低99.6%）
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
    #[runtime::pallet_index(52)]
    pub type Deposits = pallet_deposits;

    /// 函数级中文注释：统一纪念服务系统（Memorial Integration）
    /// 🆕 2025-10-28：整合 pallet-memo-offerings 和 pallet-memo-sacrifice
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

    /// 函数级详细中文注释：统一交易模块 v1.0.0 (Trading Pallet)
    /// 
    /// 🆕 2025-10-29：整合 pallet-otc-order, pallet-market-maker, pallet-simple-bridge
    /// 
    /// **做市商管理（Maker）**：
    /// - 押金锁定与解锁
    /// - 资料提交与审核（支持阈值加密）
    /// - 状态流转（DepositLocked → PendingReview → Active）
    /// - 提现申请与冷却期
    /// - 溢价配置（买入/卖出 -500~500 bps）
    /// - 服务暂停/恢复
    /// 
    /// **OTC订单（OTC）**：
    /// - 订单创建与匹配
    /// - 买家付款标记
    /// - 做市商释放DUST
    /// - 订单取消与争议
    /// - 首购订单支持（限额100-500 DUST）
    /// - 限频保护（防刷单攻击）
    /// 
    /// **MEMO桥接（Bridge）**：
    /// - DUST → USDT TRC20 兑换
    /// - 做市商兑换服务
    /// - OCW链下验证
    /// - 自动完成兑换
    /// 
    /// **Phase 5优化（2025-10-28）**：
    /// - ✅ 双映射索引：O(1)查询用户/做市商订单和兑换
    /// - ✅ 事件精简：状态码化，减少60%存储
    /// - ✅ 自动清理：过期订单/兑换自动归档
    /// - ✅ CID优化：64字节（-75%）
    /// - ✅ TRON地址优化：34字节（-47%）
    /// 
    /// **优势**：
    /// - Pallet数量：3 → 1 (-67%)
    /// - 代码复用：高
    /// - 维护成本：低（-50%）
    /// - Gas成本：优化（-5-10%）
    #[runtime::pallet_index(60)]
    pub type Trading = pallet_trading;
}
