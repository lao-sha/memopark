/// 测试环境模拟配置
use crate as pallet_membership;
use frame_support::{
	parameter_types,
	traits::{ConstU128, ConstU32, ConstU64},
	PalletId,
};
use frame_system as system;
use sp_core::H256;
use sp_runtime::{
	traits::{BlakeTwo256, IdentityLookup},
	BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

// 配置测试runtime
frame_support::construct_runtime!(
	pub enum Test
	{
		System: frame_system,
		Balances: pallet_balances,
		Membership: pallet_membership,
	}
);

impl system::Config for Test {
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
	type AccountData = pallet_balances::AccountData<u128>;
	type OnNewAccount = ();
	type OnKilledAccount = ();
	type SystemWeightInfo = ();
	type SS58Prefix = ();
	type OnSetCode = ();
	type MaxConsumers = ConstU32<16>;
}

impl pallet_balances::Config for Test {
	type MaxLocks = ();
	type MaxReserves = ();
	type ReserveIdentifier = [u8; 8];
	type Balance = u128;
	type RuntimeEvent = RuntimeEvent;
	type DustRemoval = ();
	type ExistentialDeposit = ConstU128<1>;
	type AccountStore = System;
	type WeightInfo = ();
	type FreezeIdentifier = ();
	type MaxFreezes = ();
	type RuntimeHoldReason = ();
	type RuntimeFreezeReason = ();
	type MaxHolds = ();
}

parameter_types! {
	pub const MembershipPalletId: PalletId = PalletId(*b"py/membr");
	pub const BlocksPerYear: u64 = 5_256_000;
	pub const Units: u128 = 1_000_000_000_000; // 10^12
	pub const MaxCodeLength: u32 = 32;
	// 最低会员价格：100 DUST（防止设置为0）
	pub const MinMembershipPrice: u128 = 100_000_000_000_000;
	// 最高会员价格：10000 DUST（防止恶意设置过高）
	pub const MaxMembershipPrice: u128 = 10_000_000_000_000_000;
}

/// 模拟推荐关系提供者
pub struct MockReferralProvider;
impl pallet_membership::ReferralProvider<u64> for MockReferralProvider {
	fn bind_sponsor(_who: &u64, _sponsor: &u64) -> sp_runtime::DispatchResult {
		Ok(())
	}

	fn get_sponsor_chain(_who: &u64, _max_depth: u8) -> sp_std::vec::Vec<u64> {
		sp_std::vec![]
	}

	fn has_sponsor(_who: &u64) -> bool {
		false
	}
}

impl pallet_membership::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type Currency = Balances;
	type PalletId = MembershipPalletId;
	type BlocksPerYear = BlocksPerYear;
	type Units = Units;
	type ReferralProvider = MockReferralProvider;
	type MaxCodeLength = MaxCodeLength;
	type GovernanceOrigin = frame_system::EnsureRoot<u64>;
	type MinMembershipPrice = MinMembershipPrice;
	type MaxMembershipPrice = MaxMembershipPrice;
	type WeightInfo = ();
}

/// 构建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
	let mut t = system::GenesisConfig::<Test>::default().build_storage().unwrap();

	// 初始化余额
	pallet_balances::GenesisConfig::<Test> {
		balances: vec![
			(1, 10_000_000_000_000_000), // 账户1：10000 DUST
			(2, 10_000_000_000_000_000), // 账户2：10000 DUST
			(3, 10_000_000_000_000_000), // 账户3：10000 DUST
		],
	}
	.assimilate_storage(&mut t)
	.unwrap();

	// 初始化会员系统
	pallet_membership::GenesisConfig::<Test> {
		initial_discount: 20, // 2折
		genesis_members: vec![],
	}
	.assimilate_storage(&mut t)
	.unwrap();

	let mut ext = sp_io::TestExternalities::new(t);
	ext.execute_with(|| System::set_block_number(1));
	ext
}
