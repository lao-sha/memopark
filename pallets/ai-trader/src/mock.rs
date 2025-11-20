//! 测试用的Mock运行时环境

use crate as pallet_ai_strategy;
use frame_support::{
	parameter_types,
	traits::{ConstU16, ConstU64},
};
use sp_core::H256;
use sp_runtime::{
	traits::{BlakeTwo256, IdentityLookup},
	BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

// 配置测试运行时
frame_support::construct_runtime!(
	pub enum Test {
		System: frame_system,
		Timestamp: pallet_timestamp,
		AIStrategy: pallet_ai_strategy,
	}
);

impl frame_system::Config for Test {
	type BaseCallFilter = frame_support::traits::Everything;
	type BlockWeights = ();
	type BlockLength = ();
	type DbWeight = ();
	type RuntimeOrigin = RuntimeOrigin;
	type RuntimeCall = RuntimeCall;
	type Nonce = u64;
	type Hash = H256;
	type Hashing = BlakeTwo256;
	type AccountId = u64;
	type Lookup = IdentityLookup<Self::AccountId>;
	type Block = Block;
	type RuntimeEvent = RuntimeEvent;
	type BlockHashCount = ConstU64<250>;
	type Version = ();
	type PalletInfo = PalletInfo;
	type AccountData = ();
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ConstU16<42>;
	type OnSetCode = ();
	type MaxConsumers = frame_support::traits::ConstU32<16>;
	// 新增必需的类型
	type RuntimeTask = ();
	type ExtensionsWeightInfo = ();
	type SingleBlockMigrations = ();
	type MultiBlockMigrator = ();
	type PreInherents = ();
	type PostInherents = ();
	type PostTransactions = ();
}

impl pallet_timestamp::Config for Test {
	type Moment = u64;
	type OnTimestampSet = ();
	type MinimumPeriod = ConstU64<5>;
	type WeightInfo = ();
}

parameter_types! {
	pub const MaxNameLength: u32 = 64;
	pub const MaxSymbolLength: u32 = 32;
	pub const MaxCIDLength: u32 = 64;
	pub const MaxFeatures: u32 = 20;
	pub const MaxEndpointLength: u32 = 256;
}

impl pallet_ai_strategy::Config for Test {
	type WeightInfo = ();
	type MaxNameLength = MaxNameLength;
	type MaxSymbolLength = MaxSymbolLength;
	type MaxCIDLength = MaxCIDLength;
	type MaxFeatures = MaxFeatures;
	type MaxEndpointLength = MaxEndpointLength;
	// OCW授权ID
	type AuthorityId = pallet_ai_strategy::ocw::crypto::TestAuthId;
}

// 构建测试用的genesis配置
pub fn new_test_ext() -> sp_io::TestExternalities {
	let t = frame_system::GenesisConfig::<Test>::default()
		.build_storage()
		.unwrap();
	t.into()
}

