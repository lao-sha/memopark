use crate as pallet_market_maker;
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64},
    PalletId,
};
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
        MarketMaker: pallet_market_maker,
    }
);

// System配置
parameter_types! {
    pub const SS58Prefix: u16 = 42;
}

impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Nonce = u64;
    type Hash = sp_core::H256;
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
    type SS58Prefix = SS58Prefix;
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

// Balances配置
parameter_types! {
    pub const ExistentialDeposit: u128 = 1;
}

impl pallet_balances::Config for Test {
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ConstU32<50>;
    type ReserveIdentifier = [u8; 8];
    type Balance = u128;  // 修改为u128以满足pallet要求
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ();
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

// Timestamp配置
parameter_types! {
    pub const MinimumPeriod: u64 = 3;
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = MinimumPeriod;
    type WeightInfo = ();
}

// MarketMaker参数配置
parameter_types! {
    pub const MinDeposit: u128 = 10000;
    pub const InfoWindow: u32 = 100;        // 信息公示期（秒）
    pub const ReviewWindow: u32 = 200;      // 审查期（秒）
    pub const RejectSlashBpsMax: u16 = 1000;// 最大惩罚10%
    pub const MaxPairs: u32 = 10;           // 最大交易对
    pub const MaxPremiumBps: i16 = 500;     // 最大溢价5%
    pub const MinPremiumBps: i16 = -500;    // 最小折价-5%
    pub const MakerPalletId: PalletId = PalletId(*b"mm/pool!");
    pub const WithdrawalCooldown: u32 = 100;// 提款冷却期（秒）
    pub const MinPoolBalance: u128 = 1000;   // 最小资金池余额
}

// Mock WeightInfo - 匹配实际trait定义
pub struct TestWeightInfo;
impl pallet_market_maker::MarketMakerWeightInfo for TestWeightInfo {
    fn lock_deposit() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn submit_info() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_info() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn cancel() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn approve() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn reject() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn expire() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn request_withdrawal() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn execute_withdrawal() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn cancel_withdrawal() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn emergency_withdrawal() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
}

// Mock ReviewerAccounts - 实现Get trait
pub struct MockReviewerAccounts;
impl frame_support::traits::Get<Vec<u64>> for MockReviewerAccounts {
    fn get() -> Vec<u64> {
        sp_std::vec![100, 101, 102]
    }
}

// MarketMaker配置
impl pallet_market_maker::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeightInfo = TestWeightInfo;
    type MinDeposit = MinDeposit;
    type InfoWindow = InfoWindow;
    type ReviewWindow = ReviewWindow;
    type RejectSlashBpsMax = RejectSlashBpsMax;
    type MaxPairs = MaxPairs;
    type GovernanceOrigin = frame_system::EnsureRoot<u64>;
    type ReviewerAccounts = MockReviewerAccounts;
    type MaxPremiumBps = MaxPremiumBps;
    type MinPremiumBps = MinPremiumBps;
    type PalletId = MakerPalletId;
    type WithdrawalCooldown = WithdrawalCooldown;
    type MinPoolBalance = MinPoolBalance;
}

/// 函数级详细中文注释：构建测试环境
/// 初始化做市商、买家、审查员账户
/// 给做市商pallet账户初始余额
pub fn new_test_ext() -> sp_io::TestExternalities {
    use sp_runtime::traits::AccountIdConversion;
    
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    
    // 获取做市商pallet账户
    let maker_account: u64 = MakerPalletId::get().into_account_truncating();
    
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 100000),  // 做市商1
            (2, 100000),  // 做市商2
            (3, 100000),  // 买家
            (100, 50000), // 审查员1
            (101, 50000), // 审查员2
            (102, 50000), // 审查员3
            (maker_account, 10000), // 做市商pallet账户初始余额
        ],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}

