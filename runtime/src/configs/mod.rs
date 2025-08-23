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
use frame_support::{
	derive_impl, parameter_types,
	traits::{ConstBool, ConstU128, ConstU32, ConstU64, ConstU8, VariantCountOf},
	weights::{
		constants::{RocksDbWeight, WEIGHT_REF_TIME_PER_SECOND},
		IdentityFee, Weight,
	},
};
use frame_system::limits::{BlockLength, BlockWeights};
use alloc::vec::Vec;
use pallet_transaction_payment::{ConstFeeMultiplier, FungibleAdapter, Multiplier};
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_runtime::{traits::One, Perbill};
use sp_version::RuntimeVersion;

// 引入以区块数表示的一天常量
use crate::DAYS;
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

/// Authorizer 适配器（Noop）：默认拒绝，避免依赖 `pallet-authorizer`。
pub struct AuthorizerAdapter;
impl ForwarderAuthorizer<AccountId, RuntimeCall> for AuthorizerAdapter {
	/// 校验赞助者是否在命名空间下被允许
	fn is_sponsor_allowed(_ns: [u8; 8], _sponsor: &AccountId) -> bool { false }

	/// 校验调用是否在允许范围（基于命名空间 + 具体 Call 变体匹配）
	fn is_call_allowed(ns: [u8; 8], _sponsor: &AccountId, call: &RuntimeCall) -> bool {
		match (ns, call) {
			// 设备/冥想相关调用已移除
			// 仲裁域：允许提交争议与裁决（可叠加白名单控制仲裁者）
			(n, RuntimeCall::Arbitration(inner)) if n == ArbitrationNsBytes::get() => matches!(
				inner,
				pallet_arbitration::Call::dispute { .. } | pallet_arbitration::Call::arbitrate { .. }
			),
			// OTC 吃单域：仅放行 open_order 代付
			(n, RuntimeCall::OtcOrder(inner)) if n == OtcOrderNsBytes::get() => matches!(
				inner,
				pallet_otc_order::Call::open_order { .. }
			),
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
}

// 设备/挖矿/冥想相关配置已移除

// （pallet-meditation 已移除）
// ===== 会话许可命名空间常量（用于 forwarder） =====
parameter_types! {
    pub const ArbitrationNsBytes: [u8; 8] = *b"arb___ _"; // 8字节
    pub const OtcOrderNsBytes: [u8; 8] = *b"otc_ord_";
}

// ===== temple 已移除；保留 agent/order 配置 =====

// 已移除：pallet-agent 配置与参数

// ===== memorial-park/grave/deceased 运行时参数占位（可按需调整） =====
parameter_types! {
    pub const ParkMaxRegionLen: u32 = 64;
    pub const ParkMaxCidLen: u32 = 64;
    pub const ParkMaxPerCountry: u32 = 100_000;
}
pub struct RootOnlyParkAdmin;
impl pallet_memorial_park::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxRegionLen = ParkMaxRegionLen;
    type MaxCidLen = ParkMaxCidLen;
    type MaxParksPerCountry = ParkMaxPerCountry;
    type ParkAdmin = RootOnlyParkAdmin; // 由本地适配器校验 Root
}

parameter_types! {
    pub const GraveMaxCidLen: u32 = 64;
    pub const GraveMaxPerPark: u32 = 4096;
    pub const GraveMaxIntermentsPerGrave: u32 = 128;
}
pub struct NoopIntermentHook;
impl pallet_grave::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = GraveMaxCidLen;
    type MaxPerPark = GraveMaxPerPark;
    type MaxIntermentsPerGrave = GraveMaxIntermentsPerGrave;
    type OnInterment = NoopIntermentHook;
    type ParkAdmin = RootOnlyParkAdmin; // 由本地适配器校验 Root
}

// 已移除：pallet-deceased 配置

parameter_types! {
    pub const OfferMaxCidLen: u32 = 64;
    pub const OfferMaxNameLen: u32 = 64;
    pub const OfferMaxPerTarget: u32 = 10_000;
}
pub struct AllowAllTargetControl;
pub struct NoopOfferingHook;
pub struct DummyEvidenceProvider;
impl pallet_memorial_offerings::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = OfferMaxCidLen;
    type MaxNameLen = OfferMaxNameLen;
    type MaxOfferingsPerTarget = OfferMaxPerTarget;
    type TargetCtl = AllowAllTargetControl;
    type OnOffering = NoopOfferingHook;
    type Evidence = DummyEvidenceProvider;
}

// ====== 适配器实现（临时占位：允许 Root/无操作）======
impl pallet_memorial_park::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：临时管理员校验适配；当前仅 Root 通过。后续可替换为 collective/multisig。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        Ok(frame_system::ensure_root(origin).map(|_| ())?)
    }
}

impl pallet_grave::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：临时管理员校验适配；当前仅 Root 通过。后续可替换为 collective/multisig。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        Ok(frame_system::ensure_root(origin).map(|_| ())?)
    }
}

impl pallet_grave::pallet::OnIntermentCommitted for NoopIntermentHook {
    /// 函数级中文注释：安葬回调空实现，占位方便后续接入统计/KPI。
    fn on_interment(_grave_id: u64, _deceased_id: u64) {}
}

impl pallet_memorial_offerings::pallet::TargetControl<RuntimeOrigin> for AllowAllTargetControl {
    /// 函数级中文注释：目标存在性检查临时实现：放行（返回 true）。后续应检查对应存储是否存在。
    fn exists(_target: (u8, u64)) -> bool { true }
    /// 函数级中文注释：权限检查临时实现：仅 Root 放行，后续可扩展为更细粒度策略。
    fn ensure_allowed(origin: RuntimeOrigin, _target: (u8, u64)) -> frame_support::dispatch::DispatchResult {
        Ok(frame_system::ensure_root(origin).map(|_| ())?)
    }
}

impl pallet_memorial_offerings::pallet::OnOfferingCommitted<AccountId> for NoopOfferingHook {
    /// 函数级中文注释：供奉回调空实现；可在 runtime 将其桥接到 Karma 记分或统计模块。
    fn on_offering(_target: (u8, u64), _kind_code: u8, _who: &AccountId) {}
}

impl pallet_memorial_offerings::pallet::EvidenceProvider<AccountId> for DummyEvidenceProvider {
    /// 函数级中文注释：证据读取占位实现：总是返回 Some(())，仅为编译通过。后续请桥接到 pallet-evidence。
    fn get(_id: u64) -> Option<()> { Some(()) }
}

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
}
impl pallet_evidence::pallet::EvidenceAuthorizer<AccountId> for AllowAllEvidenceAuthorizer {
    fn is_authorized(_ns: [u8; 8], _who: &AccountId) -> bool { true }
}

// 已移除：pallet-order 参数与 Config

// 已移除：Karma 适配器实现

// 托管 PalletId 与平台账户占位（示例）
parameter_types! {
    // PalletId 仅支持 8 字节，固定使用前 8 字节常量
    pub const ConstPalletId: frame_support::PalletId = frame_support::PalletId(*b"otc/orde");
}
pub struct PlatformAccount;
impl sp_core::Get<AccountId> for PlatformAccount { fn get() -> AccountId { sp_core::crypto::AccountId32::new([0u8;32]).into() } }

// ===== escrow/arbitration 配置 =====

// ===== 新 OTC 三件套参数（占位，可按需调整） =====
parameter_types! {
    pub const OtcMaxCidLen: u32 = 64;
}
impl pallet_otc_maker::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = OtcMaxCidLen;
}
impl pallet_otc_listing::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type MaxCidLen = OtcMaxCidLen;
}
parameter_types! { pub const OtcOrderConfirmTTL: BlockNumber = 2 * DAYS; }
impl pallet_otc_order::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type ConfirmTTL = OtcOrderConfirmTTL;
}

parameter_types! { pub const EscrowPalletId: frame_support::PalletId = frame_support::PalletId(*b"otc/escw"); }
impl pallet_escrow::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EscrowPalletId = EscrowPalletId;
}

parameter_types! { pub const ArbMaxEvidence: u32 = 16; pub const ArbMaxCidLen: u32 = 64; }
impl pallet_arbitration::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxEvidence = ArbMaxEvidence;
    type MaxCidLen = ArbMaxCidLen;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type WeightInfo = pallet_arbitration::weights::SubstrateWeight<Runtime>;
    type Router = ArbitrationRouter;
}

// 已移除：Karma 授权命名空间常量

// ===== 仲裁域路由：把仲裁请求分发到对应业务 pallet（当前无业务接入） =====
pub struct ArbitrationRouter;
impl pallet_arbitration::pallet::ArbitrationRouter<AccountId> for ArbitrationRouter {
    fn can_dispute(_domain: [u8; 8], _who: &AccountId, _id: u64) -> bool { false }
    fn apply_decision(_domain: [u8; 8], _id: u64, _decision: pallet_arbitration::pallet::Decision) -> frame_support::dispatch::DispatchResult {
        Err(sp_runtime::DispatchError::Other("UnsupportedDomain"))
    }
}

// ===== exchange 配置 =====
use frame_support::PalletId;

// 已移除：pallet-exchange 参数与 Config

// 已移除：evidence 授权适配器（改为 () ）

// 已移除：Exchange 管理员适配器实现