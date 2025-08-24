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
			// 证据域：允许提交/链接/取消链接证据（V1/V2）
			(n, RuntimeCall::Evidence(inner)) if n == EvidenceNsBytes::get() => matches!(
				inner,
				pallet_evidence::Call::commit { .. }
				| pallet_evidence::Call::commit_hash { .. }
				| pallet_evidence::Call::link { .. }
				| pallet_evidence::Call::link_by_ns { .. }
				| pallet_evidence::Call::unlink { .. }
				| pallet_evidence::Call::unlink_by_ns { .. }
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

// ===== deceased 配置 =====
parameter_types! {
    pub const DeceasedMaxPerGrave: u32 = 128;
    pub const DeceasedStringLimit: u32 = 256;
    pub const DeceasedMaxLinks: u32 = 8;
}

/// 函数级中文注释：墓位适配器，实现 `GraveInspector`，用于校验墓位存在与权限。
pub struct GraveProviderAdapter;
impl pallet_deceased::GraveInspector<AccountId, u64> for GraveProviderAdapter {
    /// 检查墓位是否存在：读取 `pallet-grave` 的存储 `Graves`
    fn grave_exists(grave_id: u64) -> bool {
        pallet_grave::pallet::Graves::<Runtime>::contains_key(grave_id)
    }
    /// 校验 `who` 是否可在该墓位下管理逝者：当前仅墓主可管理（后续可扩展授权）
    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        if let Some(grave) = pallet_grave::pallet::Graves::<Runtime>::get(grave_id) {
            grave.owner == *who
        } else { false }
    }
}

impl pallet_deceased::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type GraveId = u64;
    type MaxDeceasedPerGrave = DeceasedMaxPerGrave;
    type StringLimit = DeceasedStringLimit;
    type MaxLinks = DeceasedMaxLinks;
    type GraveProvider = GraveProviderAdapter;
    type WeightInfo = ();
}

// ===== deceased-media 配置 =====
parameter_types! {
    pub const MediaMaxAlbumsPerDeceased: u32 = 64;
    pub const MediaMaxMediaPerAlbum: u32 = 256;
    pub const MediaStringLimit: u32 = 512;
    pub const MediaMaxTags: u32 = 16;
    pub const MediaMaxReorderBatch: u32 = 100;
}

/// 函数级中文注释：逝者访问适配器，实现 `DeceasedAccess`，以 `pallet-deceased` 为后端。
pub struct DeceasedProviderAdapter;
impl pallet_deceased_media::DeceasedAccess<AccountId, u64> for DeceasedProviderAdapter {
    /// 检查逝者是否存在
    fn deceased_exists(id: u64) -> bool { pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(id) }
    /// 检查操作者是否可管理该逝者（当前：记录 owner）
    fn can_manage(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) { d.owner == *who } else { false }
    }
}

impl pallet_deceased_media::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type AlbumId = u64;
    type MediaId = u64;
    type MaxAlbumsPerDeceased = MediaMaxAlbumsPerDeceased;
    type MaxMediaPerAlbum = MediaMaxMediaPerAlbum;
    type StringLimit = MediaStringLimit;
    type MaxTags = MediaMaxTags;
    type MaxReorderBatch = MediaMaxReorderBatch;
    type DeceasedProvider = DeceasedProviderAdapter;
}

// ===== grave-ledger 配置 =====
parameter_types! {
    pub const GraveLedgerMaxRecentPerGrave: u32 = 256;
    pub const GraveLedgerMaxMemoLen: u32 = 64;
}
impl pallet_grave_ledger::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type MaxRecentPerGrave = GraveLedgerMaxRecentPerGrave;
    type MaxMemoLen = GraveLedgerMaxMemoLen;
}

// ===== grave-guestbook 配置 =====
parameter_types! {
    pub const GuestbookStringLimit: u32 = 512;
    pub const GuestbookMaxMessageLen: u32 = 512;
    pub const GuestbookMaxAttachmentsPerMessage: u32 = 4;
    pub const GuestbookMaxRecentPerGrave: u32 = 200;
    pub const GuestbookMaxRelatives: u32 = 64;
    pub const GuestbookMaxModerators: u32 = 16;
    pub const GuestbookMinPostBlocksPerAccount: u32 = 30;
}

pub struct GraveAccessAdapter;
impl pallet_grave_guestbook::GraveAccess<RuntimeOrigin, AccountId, u64> for GraveAccessAdapter {
    /// 检查墓主或园区管理员：若非墓主，则要求园区管理员权限（沿用你们 RootOnlyParkAdmin 并可扩展）
    fn ensure_owner_or_admin(grave_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        if let Some(g) = pallet_grave::pallet::Graves::<Runtime>::get(grave_id) {
            if let Ok(who) = frame_system::ensure_signed(origin.clone()) {
                if who == g.owner { return Ok(()); }
            }
            pallet_grave::pallet::RootOnlyParkAdmin::ensure(g.park_id, origin)
        } else {
            Err(sp_runtime::DispatchError::Other("GraveNotFound"))
        }
    }
    fn grave_exists(grave_id: u64) -> bool { pallet_grave::pallet::Graves::<Runtime>::contains_key(grave_id) }
}

impl pallet_grave_guestbook::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type MessageId = u64;
    type StringLimit = GuestbookStringLimit;
    type MaxMessageLen = GuestbookMaxMessageLen;
    type MaxAttachmentsPerMessage = GuestbookMaxAttachmentsPerMessage;
    type MaxRecentPerGrave = GuestbookMaxRecentPerGrave;
    type MaxRelatives = GuestbookMaxRelatives;
    type MaxModerators = GuestbookMaxModerators;
    type MinPostBlocksPerAccount = GuestbookMinPostBlocksPerAccount;
    type GraveProvider = GraveAccessAdapter;
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
impl pallet_memorial_offerings::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = OfferMaxCidLen;
    type MaxNameLen = OfferMaxNameLen;
    type MaxOfferingsPerTarget = OfferMaxPerTarget;
    type MaxMediaPerOffering = OfferMaxMediaPerOffering;
    type MaxMemoLen = OfferMaxMemoLen;
    type TargetCtl = AllowAllTargetControl;
    type OnOffering = GraveOfferingHook;
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

/// 函数级中文注释：当供奉落账时，将其按 grave 维度写入账本模块。
pub struct GraveOfferingHook;
impl pallet_memorial_offerings::pallet::OnOfferingCommitted<AccountId> for GraveOfferingHook {
    /// 供奉 Hook：由 `pallet-memorial-offerings` 在供奉确认后调用。
    /// - target.0 为域编码（例如 1=grave）；target.1 为对象 id（grave_id）。
    /// - 当前 Hook 未携带数量与金额，建议由索引器从 offerings 模块事件补全。
    fn on_offering(target: (u8, u64), kind_code: u8, who: &AccountId) {
        const DOMAIN_GRAVE: u8 = 1;
        if target.0 == DOMAIN_GRAVE {
            pallet_grave_ledger::Pallet::<Runtime>::record_from_hook(target.1, who.clone(), kind_code, None);
        }
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
    // 基于 Identity 的 KYC 适配器
    type Kyc = KycByIdentity;
}

// ===== KYC 适配器（基于 pallet-identity 的 judgement） =====
pub struct KycByIdentity;
impl pallet_otc_maker::pallet::KycProvider<AccountId> for KycByIdentity {
    /// 函数级中文注释：判断账户是否已通过 KYC
    /// - 读取 identity::IdentityOf，检测存在且含有正向 judgement（如 KnownGood/Reasonable）。
    fn is_verified(who: &AccountId) -> bool {
        use pallet_identity::{pallet::IdentityOf as IdOf, Judgement};
        if let Some(reg) = IdOf::<Runtime>::get(who) {
            // 只要存在非负向的 judgement 即视为通过（可按需收紧）
            return reg.judgements.iter().any(|(_, j)| matches!(j, Judgement::KnownGood | Judgement::Reasonable));
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
    type IdentityInformation = pallet_identity::legacy::IdentityInfo<frame_support::traits::ConstU32<64>>;
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
    /// 基准工具（仅基准编译时需要）
    #[cfg(feature = "runtime-benchmarks")]
    type BenchmarkHelper = ();
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