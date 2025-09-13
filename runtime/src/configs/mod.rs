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
    ensure,
};
use frame_system::limits::{BlockLength, BlockWeights};
use sp_runtime::traits::AccountIdConversion;
use sp_core::Get;
use pallet_transaction_payment::{ConstFeeMultiplier, FungibleAdapter, Multiplier};
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_runtime::{traits::One, Perbill};
use sp_version::RuntimeVersion;
use frame_support::traits::Contains;

// 引入以区块数表示的一天常量
use crate::{DAYS, OriginCaller};
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
	fn is_sponsor_allowed(_ns: [u8; 8], sponsor: &AccountId) -> bool { sponsor == &PlatformAccount::get() }

	/// 函数级中文注释：校验调用是否在允许范围（基于命名空间 + 具体 Call 变体匹配）
	/// - 本次需求：创建购买/出售订单（挂单 create_listing）与吃单创建（open_order）由 forwarder 代付。
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
			// OTC 挂单域：放行 create_listing 代付（side=Buy/Sell 由参数区分）
			(n, RuntimeCall::OtcListing(inner)) if n == OtcListingNsBytes::get() => matches!(
				inner,
				pallet_otc_listing::Call::create_listing { .. }
			),
			// 纪念馆已拆分至 pallet-memo-hall：不再匹配旧 create_hall
			(n, RuntimeCall::MemorialOfferings(inner)) if n == EvidenceNsBytes::get() => matches!(
				inner,
				pallet_memo_offerings::Call::offer { .. }
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

// 函数级中文注释：deceased-media 费用/押金与成熟期参数
parameter_types! {
    /// 相册押金（示例：0.02 UNIT）。
    pub const MediaAlbumDeposit: Balance = 20_000_000_000_000;
    /// 媒体押金（示例：0.005 UNIT）。
    pub const MediaMediaDeposit: Balance = 5_000_000_000_000;
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
}
pub struct NoopIntermentHook;
// 重命名 crate：从 pallet_grave → pallet_memo_grave
impl pallet_memo_grave::Config for Runtime {
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
            if grave.owner == *who { return true; }
            // 2) 墓位管理员放行
            let admins = pallet_memo_grave::pallet::GraveAdmins::<Runtime>::get(grave_id);
            if admins.iter().any(|a| a == who) { return true; }
            // 3) 园区管理员放行（通过 ParkAdminOrigin 适配器校验 Signed 起源）
            let origin = RuntimeOrigin::from(frame_system::RawOrigin::Signed(who.clone()));
            if let Some(pid) = grave.park_id {
                <RootOnlyParkAdmin as pallet_memo_grave::pallet::ParkAdminOrigin<RuntimeOrigin>>::ensure(pid, origin).is_ok()
            } else { false }
        } else { false }
    }
    /// 冗余校验：读取 memo-grave 的已安葬令牌缓存长度（最多 6）。
    fn cached_deceased_tokens_len(grave_id: u64) -> Option<u32> {
        pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id).map(|g| g.deceased_tokens.len() as u32)
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

/// 函数级中文注释：Deceased token 适配器，将 `pallet-deceased` 的 `deceased_token` 转换为 `BoundedVec<u8, GraveMaxCidLen>`。
pub struct DeceasedTokenProviderAdapter;
impl pallet_memo_grave::pallet::DeceasedTokenAccess<GraveMaxCidLen> for DeceasedTokenProviderAdapter {
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let bytes: Vec<u8> = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            let mut v = bytes;
            if v.len() > max { v.truncate(max); }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else { None }
    }
}

/// 函数级中文注释：为 `pallet-deceased-media` 提供逝者令牌访问实现，来源同 `pallet-deceased`。
impl pallet_deceased_media::DeceasedTokenAccess<GraveMaxCidLen, u64> for DeceasedTokenProviderAdapter {
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let bytes: Vec<u8> = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            let mut v = bytes;
            if v.len() > max { v.truncate(max); }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else { None }
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
    type MaxTokenLen = GraveMaxCidLen;
    type DeceasedProvider = DeceasedProviderAdapter;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    /// 函数级中文注释：治理起源绑定为 Root 或 内容治理签名账户（过渡期双通道）。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        EnsureContentSigner,
    >;
    /// 函数级中文注释：押金与费用使用原生余额。
    type Currency = Balances;
    /// 函数级中文注释：相册与媒体押金、小额创建费常量。
    type AlbumDeposit = MediaAlbumDeposit;
    type MediaDeposit = MediaMediaDeposit;
    /// 函数级中文注释：申诉押金常量（示例：与 MediaDeposit 一致）。
    type ComplaintDeposit = MediaMediaDeposit;
    type CreateFee = MediaCreateFee;
    /// 函数级中文注释：费用接收账户绑定为国库 PalletId 派生地址。
    type FeeCollector = TreasuryAccount;
    /// 函数级中文注释：仲裁费用接收账户（暂复用国库）。
    type ArbitrationAccount = TreasuryAccount;
    /// 函数级中文注释：投诉观察/成熟期（默认 1 年）。
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
    /// 函数级中文注释：治理起源采用 Root | 内容治理签名账户 双通道，便于灰度切换。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        EnsureContentSigner
    >;
}

/// 函数级中文注释：内容治理签名账户（固定 AccountId32，无私钥暴露）。
pub struct ContentGovernorAccount;
impl sp_core::Get<AccountId> for ContentGovernorAccount {
    fn get() -> AccountId {
        // 使用固定字节串 b"memo/cgov" 前 9 字节，余位补 0。
        let mut bytes = [0u8; 32];
        const SEED: &[u8; 9] = b"memo/cgov";
        bytes[..SEED.len()].copy_from_slice(SEED);
        sp_core::crypto::AccountId32::new(bytes).into()
    }
}

/// 函数级中文注释：Ensure 策略：仅允许由内容治理账户签名的起源。
pub type EnsureContentSigner = frame_system::EnsureSignedBy<ContentGovernorAccount, AccountId>;

/// 函数级中文注释：为 EnsureSignedBy 提供成员集合（单元素：内容治理账户）。
impl frame_support::traits::SortedMembers<AccountId> for ContentGovernorAccount {
    fn sorted_members() -> alloc::vec::Vec<AccountId> {
        alloc::vec![ContentGovernorAccount::get()]
    }
    fn contains(t: &AccountId) -> bool {
        *t == ContentGovernorAccount::get()
    }
}

// ===== ledger 配置（精简） =====
impl pallet_ledger::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type Balance = Balance;
    /// 一周按 6s/块 × 60 × 60 × 24 × 7 = 100_800 块（可由治理升级调整）
    type BlocksPerWeek = frame_support::traits::ConstU32<100_800>;
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
        if let Some(g) = pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id) {
            if let Ok(who) = frame_system::ensure_signed(origin.clone()) {
                if who == g.owner { return Ok(()); }
            }
            if let Some(pid) = g.park_id {
                <RootOnlyParkAdmin as pallet_memo_grave::pallet::ParkAdminOrigin<RuntimeOrigin>>::ensure(pid, origin)
            } else { Err(sp_runtime::DispatchError::Other("NoPark")) }
        } else {
            Err(sp_runtime::DispatchError::Other("GraveNotFound"))
        }
    }
    fn grave_exists(grave_id: u64) -> bool { pallet_memo_grave::pallet::Graves::<Runtime>::contains_key(grave_id) }
    /// 成员判定
    fn is_member(grave_id: u64, who: &AccountId) -> bool { pallet_memo_grave::pallet::Members::<Runtime>::contains_key(grave_id, who) }
    /// 公共留言：取 is_public
    fn is_public_guestbook(grave_id: u64) -> bool { pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id).map(|g| g.is_public).unwrap_or(false) }
    /// 公共扫墓：取 is_public
    fn is_public_sweep(grave_id: u64) -> bool { pallet_memo_grave::pallet::Graves::<Runtime>::get(grave_id).map(|g| g.is_public).unwrap_or(false) }
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
    /// 函数级中文注释：管理员 Origin 注入；当前使用 Root（后续可切换为 council/多签）。
    type AdminOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：供奉转账使用链上余额
    type Currency = Balances;
    /// 函数级中文注释：捐赠账户解析
    type DonationResolver = GraveDonationResolver;
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
impl frame_support::traits::tokens::Pay for NativePaymaster {
    type Balance = Balance;
    type AssetKind = (); // 仅原生
    type Beneficiary = AccountId;
    type Id = ();
    type Error = sp_runtime::DispatchError;
    fn pay(who: &Self::Beneficiary, _asset_kind: Self::AssetKind, amount: Self::Balance) -> Result<Self::Id, Self::Error> {
        <Balances as frame_support::traits::fungible::Mutate<AccountId>>::transfer(&PlatformAccount::get(), who, amount, frame_support::traits::tokens::Preservation::Expendable)?;
        Ok(())
    }
    fn check_payment(_: Self::Id) -> frame_support::traits::tokens::PaymentStatus { frame_support::traits::tokens::PaymentStatus::Success }
}

pub struct UnitBalanceConverter;
impl frame_support::traits::tokens::ConversionFromAssetBalance<Balance, (), Balance> for UnitBalanceConverter {
    type Error = sp_runtime::DispatchError;
    fn from_asset_balance(amount: Balance, _asset: ()) -> Result<Balance, Self::Error> { Ok(amount) }
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
    type SpendOrigin = frame_system::EnsureRootWithSuccess<AccountId, ConstU128<1_000_000_000_000_000_000>>; // Root 最多可一次性支出 1e18 单位
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
    fn get() -> AccountId { TreasuryPalletId::get().into_account_truncating() }
}

// ====== 适配器实现（临时占位：允许 Root/无操作）======
// 修正命名：由旧 crate 前缀 memorial 切换为 memo，保证与 `pallets/memo-park` 对应
impl pallet_memo_park::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：临时管理员校验适配；当前仅 Root 通过。后续可替换为 collective/multisig。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        Ok(frame_system::ensure_root(origin).map(|_| ())?)
    }
}

impl pallet_memo_grave::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：临时管理员校验适配；当前仅 Root 通过。后续可替换为 collective/multisig。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        Ok(frame_system::ensure_root(origin).map(|_| ())?)
    }
}

impl pallet_memo_grave::pallet::OnIntermentCommitted for NoopIntermentHook {
    /// 函数级中文注释：安葬回调空实现，占位方便后续接入统计/KPI。
    fn on_interment(_grave_id: u64, _deceased_id: u64) {}
}

/// 函数级中文注释：供奉目标控制器（允许所有目标，Grave 域做成员校验）
impl pallet_memo_offerings::pallet::TargetControl<RuntimeOrigin, AccountId> for AllowAllTargetControl {
    /// 函数级中文注释：目标存在性检查临时实现：放行（返回 true）。后续应检查对应存储是否存在。
    fn exists(_target: (u8, u64)) -> bool { true }
    /// 函数级中文注释：权限检查：若目标域为 Grave(=1)，则要求发起者为该墓位成员；否则放行。
    fn ensure_allowed(origin: RuntimeOrigin, target: (u8, u64)) -> frame_support::dispatch::DispatchResult {
        let who = frame_system::ensure_signed(origin)?;
        const DOMAIN_GRAVE: u8 = 1;
        if target.0 == DOMAIN_GRAVE {
            // 若墓位公开则放行，否则必须为成员
            let is_public = pallet_memo_grave::pallet::Graves::<Runtime>::get(target.1).map(|g| g.is_public).unwrap_or(false);
            if !is_public {
                ensure!(pallet_memo_grave::pallet::Members::<Runtime>::contains_key(target.1, &who), sp_runtime::DispatchError::Other("NotMember"));
            }
        }
        Ok(())
    }
}

/// 函数级中文注释：当供奉落账时，将其按 grave 维度写入账本模块。
pub struct GraveOfferingHook;
impl pallet_memo_offerings::pallet::OnOfferingCommitted<AccountId> for GraveOfferingHook {
    /// 供奉 Hook：由 `pallet-memorial-offerings` 在供奉确认后调用。
    /// - target.0 为域编码（例如 1=grave）；target.1 为对象 id（grave_id）。
    /// - 携带金额（若 Some）则累计到排行榜；Timed 的持续周数用于标记有效供奉周期
    fn on_offering(target: (u8, u64), kind_code: u8, who: &AccountId, amount: Option<u128>, duration_weeks: Option<u32>) {
        const DOMAIN_GRAVE: u8 = 1;
        if target.0 == DOMAIN_GRAVE {
            let amt: Option<Balance> = amount.map(|a| a as Balance);
            // 1) 记录供奉流水
            pallet_ledger::Pallet::<Runtime>::record_from_hook_with_amount(target.1, who.clone(), kind_code, amt, None);
            // 2) 标记有效供奉周期：
            // - 若为 Timed（duration_weeks=Some），无论是否转账成功，均标记从当周起连续 w 周
            // - 若为 Instant（None），仅当存在金额落账时标记当周
            let should_mark = duration_weeks.is_some() || amount.is_some();
            if should_mark {
                let now = <frame_system::Pallet<Runtime>>::block_number();
                pallet_ledger::Pallet::<Runtime>::mark_weekly_active(target.1, who.clone(), now, duration_weeks);
                // 1.5) 分销托管记账：当存在入金时，将本次消费按联盟规则记账
                if let Some(pay) = amt {
                    pallet_memo_affiliate::Pallet::<Runtime>::report(who, pay, Some(target), now, duration_weeks);
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

// ===== KYC 适配器（基于 pallet-identity 的 judgement） =====
pub struct KycByIdentity;
/// 函数级中文注释：KYC 适配器同时实现 memo-grave 与 otc-maker 所需的 Provider 接口。
impl pallet_memo_grave::pallet::KycProvider<AccountId> for KycByIdentity {
    fn is_verified(who: &AccountId) -> bool {
        use pallet_identity::{pallet::IdentityOf as IdOf, Judgement};
        if let Some(reg) = IdOf::<Runtime>::get(who) {
            return reg.judgements.iter().any(|(_, j)| matches!(j, Judgement::KnownGood | Judgement::Reasonable));
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
parameter_types! {
    pub const OtcListingFee: u128 = 0;
    pub const OtcListingBond: u128 = 0;
    pub const OtcFeePalletId: PalletId = PalletId(*b"otc/fees");
}
pub struct OtcFeeReceiver;
impl sp_core::Get<AccountId> for OtcFeeReceiver {
    fn get() -> AccountId { OtcFeePalletId::get().into_account_truncating() }
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
}
parameter_types! { pub const OtcOrderConfirmTTL: BlockNumber = 2 * DAYS; }
impl pallet_otc_order::Config for Runtime {
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
/// 函数级中文注释：仲裁域路由器实现。转发到 OTC 订单 Pallet 上的校验与执行接口。
impl pallet_arbitration::pallet::ArbitrationRouter<AccountId> for ArbitrationRouter {
    /// 函数级中文注释：支持 OTC 订单域 (b"otc_ord_") 的争议校验
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool {
        if domain == OtcOrderNsBytes::get() {
            // 引入 trait 以启用方法解析
            use pallet_otc_order::ArbitrationHook;
            pallet_otc_order::pallet::Pallet::<Runtime>::can_dispute(who, id)
        } else { false }
    }
    /// 函数级中文注释：将仲裁裁决应用到对应域
    /// - Release → 托管释放给买家；Refund → 托管退款给卖家；Partial(bps) → 按 bps 分账
    fn apply_decision(domain: [u8; 8], id: u64, decision: pallet_arbitration::pallet::Decision) -> frame_support::dispatch::DispatchResult {
        use pallet_arbitration::pallet::Decision as D;
        if domain == OtcOrderNsBytes::get() {
            match decision {
                D::Release => { use pallet_otc_order::ArbitrationHook; pallet_otc_order::pallet::Pallet::<Runtime>::arbitrate_release(id) },
                D::Refund => { use pallet_otc_order::ArbitrationHook; pallet_otc_order::pallet::Pallet::<Runtime>::arbitrate_refund(id) },
                D::Partial(bps) => { use pallet_otc_order::ArbitrationHook; pallet_otc_order::pallet::Pallet::<Runtime>::arbitrate_partial(id, bps) },
            }
        } else {
            Err(sp_runtime::DispatchError::Other("UnsupportedDomain"))
        }
    }
}

// ===== exchange 配置 =====
use frame_support::PalletId;

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

// ===== memo-endowment（基金会）配置 =====
parameter_types! {
    pub const EndowmentPrincipalId: PalletId = PalletId(*b"endowpri");
    pub const EndowmentYieldId: PalletId = PalletId(*b"endowyld");
}
impl pallet_memo_endowment::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    type PrincipalPalletId = EndowmentPrincipalId;
    type YieldPalletId = EndowmentYieldId;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
    type WeightInfo = ();
    type Sla = SlaFromIpfs;
}

// ===== memo-ipfs（存储+OCW）配置 =====
parameter_types! { pub const IpfsMaxCidHashLen: u32 = 64; }
/// 函数级中文注释：为 memo-ipfs 绑定运行时类型。注意 OCW 需要签名类型约束。
impl pallet_memo_ipfs::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    type Endowment = pallet_memo_endowment::Pallet<Runtime>;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxCidHashLen = IpfsMaxCidHashLen;
    type MaxPeerIdLen = frame_support::traits::ConstU32<128>;
    type MinOperatorBond = frame_support::traits::ConstU128<10_000_000_000_000>; // 0.01 UNIT 示例
    type MinCapacityGiB = frame_support::traits::ConstU32<100>; // 至少 100 GiB 示例
    type WeightInfo = ();
}

/// 函数级中文注释：SLA 数据提供者，从 `pallet-memo-ipfs` 读取运营者统计
pub struct SlaFromIpfs;
impl pallet_memo_endowment::SlaProvider<AccountId, BlockNumber> for SlaFromIpfs {
    fn visit<F: FnMut(&AccountId, u32, u32, BlockNumber)>(mut f: F) {
        use pallet_memo_ipfs::pallet::{OperatorSla as SlaMap, Operators as OpMap};
        for (op, s) in SlaMap::<Runtime>::iter() {
            if let Some(info) = OpMap::<Runtime>::get(&op) {
                if info.status == 0 { f(&op, s.probe_ok, s.probe_fail, s.last_update); }
            }
        }
    }
}

// ===== scheduler & preimage 运行时配置 =====
impl pallet_preimage::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// 费用货币
    type Currency = Balances;
    /// 管理者 Origin（允许清理/强制操作）
    type ManagerOrigin = frame_system::EnsureRoot<AccountId>;
    /// 费用考虑（占位）：无成本（`()`) 实现 Consideration，便于先行集成
    type Consideration = ();
    /// 权重信息（占位）
    type WeightInfo = ();
}

parameter_types! {
    pub const MaxScheduledPerBlock: u32 = 64;
    /// 调度允许的最大权重（2 秒计算上限；以参考权重为单位）。
    pub const SchedulerMaximumWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}
impl pallet_scheduler::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// Origin 类型
    type RuntimeOrigin = RuntimeOrigin;
    /// 可调度权限
    type ScheduleOrigin = frame_system::EnsureRoot<AccountId>;
    /// 每块最多调度任务数
    type MaxScheduledPerBlock = MaxScheduledPerBlock;
    /// Preimage Pallet
    type Preimages = pallet_preimage::Pallet<Runtime>;
    /// PalletsOrigin（使用 runtime 宏导出的 OriginCaller）
    type PalletsOrigin = OriginCaller;
    /// RuntimeCall（由 runtime 宏导出）
    type RuntimeCall = RuntimeCall;
    /// 最大权重（占位：2 秒计算上限）
    type MaximumWeight = SchedulerMaximumWeight;
    /// Origin 权限比较器（默认允许 Root 更高）
    type OriginPrivilegeCmp = frame_support::traits::EqualPrivilegeOnly;
    /// BlockNumber 提供者
    type BlockNumberProvider = frame_system::Pallet<Runtime>;
    /// 权重信息
    type WeightInfo = ();
}

// ===== affiliate（计酬）配置 =====
parameter_types! {
    /// 函数级中文注释：计酬最大层级（与推荐层级上限相近）。
    pub const AffiliateMaxHops: u32 = 10;
    /// 函数级中文注释：佣金池 PalletId，用于派生模块资金账户。
    pub const AffiliatePalletId: PalletId = PalletId(*b"affiliat");
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

impl pallet_memo_affiliate::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// 货币实现
    type Currency = Balances;
    /// 推荐关系只读提供者
    type Referrals = pallet_memo_referrals::Pallet<Runtime>;
    /// 周对应区块数
    type BlocksPerWeek = frame_support::traits::ConstU32<100_800>;
    /// 托管 PalletId
    type EscrowPalletId = EscrowPalletId;
    /// 黑洞与国库
    type BurnAccount = BurnAccount;
    type TreasuryAccount = PlatformAccount;
    /// 防御性搜索上限
    type MaxSearchHops = frame_support::traits::ConstU32<10_000>;
    /// 结算最大层级与阈值
    type MaxLevels = frame_support::traits::ConstU32<15>;
    type PerLevelNeed = frame_support::traits::ConstU32<3>;
    /// 比例（bps）：每层不等比
    type LevelRatesBps = LevelRatesArray;
    type BurnBps = frame_support::traits::ConstU16<1000>; // 10%
    type TreasuryBps = frame_support::traits::ConstU16<800>; // 8%
}

// 运行时可读默认值说明（前端读取 storage）：
// - memoAffiliate.budgetCapPerCycle / minStakeForReward / budgetSourceAccount / minQualifyingAction

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

use pallet_conviction_voting as cv;
use alloc::borrow::Cow;
use alloc::vec::Vec;

parameter_types! {
    pub const MaxVotesPerAccount: u32 = 256;
    pub const VoteLockingPeriod: BlockNumber = 7 * DAYS; // 约 7 天
}
parameter_types! { pub const MaxVotes: u32 = 256; }
parameter_types! { pub const MaxTurnoutLimit: Balance = 0; }

impl cv::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Polls = pallet_referenda::Pallet<Runtime>;
    type MaxTurnout = MaxTurnoutLimit;
    type MaxVotes = MaxVotes;
    type VoteLockingPeriod = VoteLockingPeriod;
    type BlockNumberProvider = frame_system::Pallet<Runtime>;
    type VotingHooks = ();
    type WeightInfo = ();
}

parameter_types! { pub const UndecidingTimeout: BlockNumber = 7 * DAYS; }

pub struct TracksInfo;
impl pallet_referenda::TracksInfo<Balance, BlockNumber> for TracksInfo {
    type Id = u16;
    type RuntimeOrigin = <RuntimeOrigin as frame_support::traits::OriginTrait>::PalletsOrigin;

    fn tracks() -> impl Iterator<Item = Cow<'static, pallet_referenda::Track<Self::Id, Balance, BlockNumber>>> {
        const ROOT_NAME: [u8; 25] = *b"Root_____________________";
        const CONTENT_NAME: [u8; 25] = *b"Content__________________";
        let root = pallet_referenda::Track {
            id: 0u16,
            info: pallet_referenda::TrackInfo {
                name: ROOT_NAME,
                max_deciding: 1,
                decision_deposit: 0,
                prepare_period: 0,
                decision_period: 14 * DAYS,
                confirm_period: 2 * DAYS,
                min_enactment_period: 1 * DAYS,
                min_approval: pallet_referenda::Curve::LinearDecreasing { length: sp_runtime::Perbill::from_percent(100), floor: sp_runtime::Perbill::from_percent(50), ceil: sp_runtime::Perbill::from_percent(100) },
                min_support: pallet_referenda::Curve::LinearDecreasing { length: sp_runtime::Perbill::from_percent(100), floor: sp_runtime::Perbill::from_percent(50), ceil: sp_runtime::Perbill::from_percent(100) },
            }
        };
        let content = pallet_referenda::Track {
            id: 20u16,
            info: pallet_referenda::TrackInfo {
                name: CONTENT_NAME,
                max_deciding: 2,
                decision_deposit: 0,
                prepare_period: 0,
                decision_period: 7 * DAYS,
                confirm_period: 1 * DAYS,
                min_enactment_period: 1 * DAYS,
                // 采用较温和曲线（示例）
                min_approval: pallet_referenda::Curve::LinearDecreasing { length: sp_runtime::Perbill::from_percent(100), floor: sp_runtime::Perbill::from_percent(50), ceil: sp_runtime::Perbill::from_percent(100) },
                min_support: pallet_referenda::Curve::LinearDecreasing { length: sp_runtime::Perbill::from_percent(100), floor: sp_runtime::Perbill::from_percent(10), ceil: sp_runtime::Perbill::from_percent(100) },
            }
        };
        [root, content].into_iter().map(Cow::Owned)
    }

    fn track_for(_origin: &Self::RuntimeOrigin) -> Result<Self::Id, ()> { Ok(0u16) }
}

parameter_types! { pub const SubmissionDeposit: Balance = 0; }
parameter_types! { pub const MaxQueued: u32 = 100; }
parameter_types! { pub const AlarmInterval: BlockNumber = 10; }

impl pallet_referenda::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = ();
    type Scheduler = pallet_scheduler::Pallet<Runtime>;
    type Currency = Balances;
    type SubmitOrigin = frame_support::traits::AsEnsureOriginWithArg<frame_system::EnsureSigned<AccountId>>;
    type CancelOrigin = frame_system::EnsureRoot<AccountId>;
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    type Slash = ();
    type Votes = pallet_conviction_voting::VotesOf<Runtime>;
    type Tally = pallet_conviction_voting::TallyOf<Runtime>;
    type SubmissionDeposit = SubmissionDeposit;
    type MaxQueued = MaxQueued;
    type UndecidingTimeout = UndecidingTimeout;
    type AlarmInterval = AlarmInterval;
    type Tracks = TracksInfo;
    type Preimages = pallet_preimage::Pallet<Runtime>;
    type BlockNumberProvider = frame_system::Pallet<Runtime>;
}

// ========= FeeGuard（仅手续费账户保护） =========
impl pallet_fee_guard::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    /// 函数级中文注释：管理员起源采用 Root | 内容治理签名账户 双通道，便于灰度控制。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        EnsureContentSigner,
    >;
}