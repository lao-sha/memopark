/// 测试环境模拟配置
use crate as pallet_affiliate_instant;
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

frame_support::construct_runtime!(
	pub enum Test
	{
		System: frame_system,
		Balances: pallet_balances,
		AffiliateInstant: pallet_affiliate_instant,
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
	pub const AffiliateInstantPalletId: PalletId = PalletId(*b"py/affin");
	pub const BurnPercent: u8 = 5;
	pub const TreasuryPercent: u8 = 2;
	pub const StoragePercent: u8 = 3;
	pub const StorageFee: u128 = 1000;
	pub const BurnFee: u128 = 1000;
	pub const TreasuryAccount: u64 = 100;
	pub const StorageAccount: u64 = 101;
}

/// 模拟推荐关系提供者
pub struct MockReferralProvider;
impl pallet_affiliate_instant::ReferralProvider<u64> for MockReferralProvider {
	fn get_sponsor_chain(_who: &u64, _max_depth: u8) -> sp_std::vec::Vec<u64> {
		// 模拟推荐链：1 <- 2 <- 3 <- 4 <- 5
		sp_std::vec![2, 3, 4, 5]
	}
}

/// 模拟会员信息提供者
pub struct MockMembershipProvider;
impl pallet_affiliate_instant::MembershipProvider<u64> for MockMembershipProvider {
	fn is_member_valid(who: &u64) -> bool {
		// 模拟：账户2-5是有效会员
		*who >= 2 && *who <= 5
	}

	fn get_member_generations(who: &u64) -> Option<u8> {
		// 模拟代数：账户2(6代), 3(9代), 4(12代), 5(15代)
		match who {
			2 => Some(6),
			3 => Some(9),
			4 => Some(12),
			5 => Some(15),
			_ => None,
		}
	}
}

impl pallet_affiliate_instant::Config for Test {
	type RuntimeEvent = RuntimeEvent;
	type Currency = Balances;
	type PalletId = AffiliateInstantPalletId;
	type ReferralProvider = MockReferralProvider;
	type MembershipProvider = MockMembershipProvider;
	type BurnPercent = BurnPercent;
	type TreasuryPercent = TreasuryPercent;
	type StoragePercent = StoragePercent;
	type StorageFee = StorageFee;
	type BurnFee = BurnFee;
	type TreasuryAccount = TreasuryAccount;
	type StorageAccount = StorageAccount;
}

/// 构建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
	let mut t = system::GenesisConfig::<Test>::default().build_storage().unwrap();

	pallet_balances::GenesisConfig::<Test> {
		balances: vec![
			(1, 10_000_000),      // 购买者
			(2, 1_000),           // 推荐人1
			(3, 1_000),           // 推荐人2
			(4, 1_000),           // 推荐人3
			(5, 1_000),           // 推荐人4
			(100, 1_000),         // 国库账户
			(101, 1_000),         // 存储账户
			(get_escrow_account(), 10_000_000), // 托管账户
		],
	}
	.assimilate_storage(&mut t)
	.unwrap();

	pallet_affiliate_instant::GenesisConfig::<Test> {
		level_percents: vec![30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1],
	}
	.assimilate_storage(&mut t)
	.unwrap();

	let mut ext = sp_io::TestExternalities::new(t);
	ext.execute_with(|| System::set_block_number(1));
	ext
}

/// 获取托管账户
pub fn get_escrow_account() -> u64 {
	use sp_runtime::traits::AccountIdConversion;
	AffiliateInstantPalletId::get().into_account_truncating()
}

