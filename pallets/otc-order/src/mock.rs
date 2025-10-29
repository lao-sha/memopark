// 函数级中文注释：pallet-otc-order的Mock Runtime，用于单元测试
// Phase 3 Week 2 Day 3 - 完整Mock（解决依赖问题）

use crate as pallet_otc_order;
use frame_support::{
    parameter_types, PalletId,
    traits::{ConstU16, ConstU32},
};
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        Pricing: pallet_pricing,
        Escrow: pallet_escrow,
        MarketMaker: pallet_market_maker,
        BuyerCredit: pallet_buyer_credit,
        OtcOrder: pallet_otc_order,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const ExistentialDeposit: u64 = 1;
    pub const MaxLocks: u32 = 50;
    pub const MaxReserves: u32 = 50;
    pub const MinimumPeriod: u64 = 5;
    
    // OTC Order params
    pub const ConfirmTTL: u64 = 100;
    pub const MaxExpiringPerBlock: u32 = 10;
    
    // Escrow params
    pub const EscrowPalletId: PalletId = PalletId(*b"py/escro");
    
    // Market Maker params
    pub const MinDeposit: u64 = 10000;
    pub const InfoWindow: u32 = 86400; // 1 day
    pub const ReviewWindow: u32 = 259200; // 3 days
    pub const RejectSlashBpsMax: u16 = 1000; // 10%
    pub const MaxPairs: u32 = 10;
    pub const MaxPremiumBps: i16 = 500; // 5%
    pub const MinPremiumBps: i16 = 0;
    pub const MakerPalletId: PalletId = PalletId(*b"py/maker");
    pub const WithdrawalCooldown: u32 = 100;
    pub const MinPoolBalance: u64 = 1000;
    pub const ReviewerAccounts: Vec<u64> = vec![];
    
    // OTC Order additional params
    pub const OpenWindow: u64 = 100;
    pub const OpenMaxInWindow: u32 = 10;
    pub const PaidWindow: u64 = 100;
    pub const PaidMaxInWindow: u32 = 10;
    pub const CancelWindow: u64 = 86400000; // 1 day in ms
    pub const FiatGatewayAccount: u64 = 999;
    pub const FiatGatewayTreasuryAccount: u64 = 998;
    pub const MinFirstPurchaseAmount: u64 = 100;
    pub const MaxFirstPurchaseAmount: u64 = 10000;
    pub const ArchiveThresholdDays: u32 = 90;
    pub const MaxCleanupPerBlock: u32 = 50;
    pub const TronTxHashRetentionPeriod: u64 = 1000;
    
    // Buyer Credit params
    pub const BlocksPerDay: u32 = 14400; // Assuming 6s per block
    pub const MinimumBalance: u64 = 100;
    pub const EndorseMinCreditScore: u16 = 600;
}

impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Block = Block;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = pallet_balances::AccountData<u64>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ConstU16<42>;
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
    type RuntimeTask = ();
    type ExtensionsWeightInfo = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
}

impl pallet_balances::Config for Test {
    type MaxLocks = MaxLocks;
    type MaxReserves = MaxReserves;
    type ReserveIdentifier = [u8; 8];
    type Balance = u64;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ConstU32<0>;
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = MinimumPeriod;
    type WeightInfo = ();
}

// Mock Pricing (已测试pallet)
impl pallet_pricing::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type MaxPriceDeviation = ConstU16<2000>; // 20%
}

// Mock Escrow trait
pub struct MockEscrow;
impl pallet_escrow::pallet::Escrow<u64, u64> for MockEscrow {
    fn lock_from(_payer: &u64, _id: u64, _amount: u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn transfer_from_escrow(_id: u64, _to: &u64, _amount: u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn release_all(_id: u64, _to: &u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn refund_all(_id: u64, _to: &u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn amount_of(_id: u64) -> u64 {
        0
    }
}

// Mock ExpiryPolicy
pub struct MockExpiryPolicy;
impl pallet_escrow::pallet::ExpiryPolicy<u64, u64> for MockExpiryPolicy {
    fn on_expire(_id: u64) -> Result<pallet_escrow::pallet::ExpiryAction<u64>, sp_runtime::DispatchError> {
        Ok(pallet_escrow::pallet::ExpiryAction::Noop)
    }
    fn now() -> u64 {
        System::block_number()
    }
}

// Mock EnsureOrigin for Escrow/MarketMaker
pub struct EnsureRootOrHalf;
impl frame_support::traits::EnsureOrigin<RuntimeOrigin> for EnsureRootOrHalf {
    type Success = u64;
    fn try_origin(o: RuntimeOrigin) -> Result<Self::Success, RuntimeOrigin> {
        Into::<Result<frame_system::RawOrigin<u64>, RuntimeOrigin>>::into(o)
            .and_then(|raw_origin| match raw_origin {
                frame_system::RawOrigin::Root => Ok(0),
                frame_system::RawOrigin::Signed(50) => Ok(50),
                _ => Err(RuntimeOrigin::from(raw_origin)),
            })
    }
    #[cfg(any())]
    fn try_successful_origin() -> Result<RuntimeOrigin, ()> {
        Ok(RuntimeOrigin::root())
    }
}

// Escrow Config - 完整版（包含RuntimeEvent）
impl pallet_escrow::pallet::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EscrowPalletId = EscrowPalletId;
    type AuthorizedOrigin = EnsureRootOrHalf;
    type AdminOrigin = EnsureRootOrHalf;
    type MaxExpiringPerBlock = MaxExpiringPerBlock;
    type ExpiryPolicy = MockExpiryPolicy;
}

// Mock WeightInfo for Market Maker
pub struct TestWeightInfo;
impl pallet_market_maker::MarketMakerWeightInfo for TestWeightInfo {
    fn lock_deposit() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn submit_info() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn update_info() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn approve() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn reject() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn cancel() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn expire() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn request_withdrawal() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn execute_withdrawal() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn cancel_withdrawal() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
    fn emergency_withdrawal() -> frame_support::weights::Weight { frame_support::weights::Weight::from_parts(10_000, 0) }
}

// Market Maker Config - 完整版（包含RuntimeEvent）
impl pallet_market_maker::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = TestWeightInfo;
    type MinDeposit = MinDeposit;
    type InfoWindow = InfoWindow;
    type ReviewWindow = ReviewWindow;
    type RejectSlashBpsMax = RejectSlashBpsMax;
    type MaxPairs = MaxPairs;
    type GovernanceOrigin = EnsureRootOrHalf;
    type ReviewerAccounts = ReviewerAccounts;
    type MaxPremiumBps = MaxPremiumBps;
    type MinPremiumBps = MinPremiumBps;
    type PalletId = MakerPalletId;
    type WithdrawalCooldown = WithdrawalCooldown;
    type MinPoolBalance = MinPoolBalance;
}

// Buyer Credit Config - 完整版
impl pallet_buyer_credit::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type BlocksPerDay = BlocksPerDay;
    type MinimumBalance = MinimumBalance;
    type EndorseMinCreditScore = EndorseMinCreditScore;
    type WeightInfo = ();
}

// Mock Maker Credit
pub struct MockMakerCredit;
impl pallet_maker_credit::MakerCreditInterface for MockMakerCredit {
    fn initialize_credit(_maker_id: u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn check_service_status(_maker_id: u64) -> Result<pallet_maker_credit::ServiceStatus, sp_runtime::DispatchError> {
        Ok(pallet_maker_credit::ServiceStatus::Active)
    }
    fn record_order_completed(_maker_id: u64, _order_id: u64, _amount: u32) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn record_default_timeout(_maker_id: u64, _order_id: u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn record_default_dispute(_maker_id: u64, _order_id: u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}

// Mock Membership Provider
pub struct MockMembership;
impl pallet_stardust_referrals::MembershipProvider<u64> for MockMembership {
    fn is_valid_member(_who: &u64) -> bool { false }
}

// Mock Referral Provider
pub struct MockReferral;
impl pallet_stardust_referrals::ReferralProvider<u64> for MockReferral {
    fn get_referrer(_who: &u64) -> Option<u64> { None }
    fn sponsor_of(_who: &u64) -> Option<u64> { None }
    fn ancestors(_who: &u64, _levels: u32) -> sp_std::vec::Vec<u64> { sp_std::vec![] }
    fn is_banned(_who: &u64) -> bool { false }
    fn find_account_by_code(_code: &sp_std::vec::Vec<u8>) -> Option<u64> { None }
    fn get_referral_code(_who: &u64) -> Option<sp_std::vec::Vec<u8>> { None }
    fn try_auto_claim_code(_who: &u64) -> bool { false }
    fn bind_sponsor_internal(_who: &u64, _sponsor: &u64) -> Result<(), &'static str> { Ok(()) }
}

// Mock Affiliate Distributor
pub struct MockAffiliate;
impl pallet_affiliate_config::AffiliateDistributor<u64, u128, u64> for MockAffiliate {
    fn distribute(_who: &u64, _amount: u128, _at: u64) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn distribute_rewards(
        _payer: &u64,
        _amount: u128,
        _offering: Option<(u8, u64)>,
        _block: u64,
        _grace: Option<u32>,
    ) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
    fn distribute_membership_rewards(
        _payer: &u64,
        _amount: u128,
        _block: u64,
    ) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}

impl pallet_otc_order::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type ConfirmTTL = ConfirmTTL;
    type Escrow = MockEscrow;
    type MakerCredit = MockMakerCredit;
    type MaxExpiringPerBlock = MaxExpiringPerBlock;
    type OpenWindow = OpenWindow;
    type OpenMaxInWindow = OpenMaxInWindow;
    type PaidWindow = PaidWindow;
    type PaidMaxInWindow = PaidMaxInWindow;
    type CancelWindow = CancelWindow;
    type FiatGatewayAccount = FiatGatewayAccount;
    type FiatGatewayTreasuryAccount = FiatGatewayTreasuryAccount;
    type MinFirstPurchaseAmount = MinFirstPurchaseAmount;
    type MaxFirstPurchaseAmount = MaxFirstPurchaseAmount;
    type MembershipProvider = MockMembership;
    type ReferralProvider = MockReferral;
    type AffiliateDistributor = MockAffiliate;
    type ArchiveThresholdDays = ArchiveThresholdDays;
    type MaxCleanupPerBlock = MaxCleanupPerBlock;
    type TronTxHashRetentionPeriod = TronTxHashRetentionPeriod;
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![(1, 100000), (2, 100000), (3, 100000)],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}
