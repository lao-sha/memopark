//! # Mock Runtime (测试环境模拟)
//! 
//! ## 函数级详细中文注释：提供 Trading Pallet 的测试运行时环境

use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64, Everything},
    PalletId,
};
use frame_system as system;
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

// Configure a mock runtime to test the pallet.
frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        Trading: crate,
    }
);

impl system::Config for Test {
    type BaseCallFilter = Everything;
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
    type ExistentialDeposit = ConstU64<1>;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = ();
    type RuntimeHoldReason = ();
    type MaxHolds = ();
    type RuntimeFreezeReason = ();
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = ConstU64<3>;
    type WeightInfo = ();
}

parameter_types! {
    pub const TradingPalletId: PalletId = PalletId(*b"py/trade");
    pub const MakerDepositAmount: u128 = 1_000_000_000_000; // 1000 MEMO
    pub const MakerApplicationTimeout: u64 = 100;
    pub const WithdrawalCooldown: u64 = 100;
    pub const ConfirmTTL: u64 = 100;
    pub const CancelWindow: u64 = 300_000; // 5 minutes in milliseconds
    pub const MaxExpiringPerBlock: u32 = 10;
    pub const OpenWindow: u64 = 100;
    pub const OpenMaxInWindow: u32 = 10;
    pub const PaidWindow: u64 = 100;
    pub const PaidMaxInWindow: u32 = 10;
    pub const MinFirstPurchaseAmount: u128 = 10_000_000_000; // 10 MEMO
    pub const MaxFirstPurchaseAmount: u128 = 100_000_000_000; // 100 MEMO
    pub const OrderArchiveThresholdDays: u32 = 150;
    pub const MaxOrderCleanupPerBlock: u32 = 50;
    pub const SwapTimeout: u64 = 300;
    pub const SwapArchiveThresholdDays: u32 = 150;
    pub const MaxSwapCleanupPerBlock: u32 = 50;
    pub const MaxVerificationFailures: u32 = 5;
    pub const MaxOrdersPerBlock: u32 = 10;
    pub const OcwSwapTimeoutBlocks: u64 = 300;
    pub const OcwMinSwapAmount: u128 = 100_000_000_000; // 100 MEMO
    pub const UnsignedPriority: u64 = 100;
    pub const TronTxHashRetentionPeriod: u64 = 2_592_000; // ~180 days
    pub const FiatGatewayAccount: u64 = 999;
    pub const FiatGatewayTreasuryAccount: u64 = 998;
}

// TODO: 实现完整的 Config
// 这里只是占位符，实际需要实现所有必需的 trait

