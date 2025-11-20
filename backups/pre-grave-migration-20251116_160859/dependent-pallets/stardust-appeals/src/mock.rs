//! 函数级中文注释：mock 运行时用于单元测试。

#![cfg(test)]

use crate as pallet_memo_appeals;
use frame_support::{parameter_types, traits::Everything};
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

#[allow(dead_code)]
type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test where
        Block = Block,
        NodeBlock = Block,
        UncheckedExtrinsic = UncheckedExtrinsic,
    {
        System: frame_system,
        Balances: pallet_balances,
        MCG: pallet_memo_appeals,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const WindowBlocks: u32 = 600;
    pub const MaxPerWindow: u32 = 2;
    pub const NoticeDefaultBlocks: u32 = 10;
    pub const MaxExecPerBlock: u32 = 10;
}

impl frame_system::Config for Test {
    type BaseCallFilter = Everything;
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
    type AccountData = pallet_balances::AccountData<u128>;
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    type ExtensionsWeightInfo = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type RuntimeTask = ();
}

parameter_types! {
    pub const AppealDeposit: u128 = 1;
}

pub struct NoopRouter;
impl crate::AppealRouter<u64> for NoopRouter {
    fn execute(
        _who: &u64,
        _domain: u8,
        _target: u64,
        _action: u8,
    ) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}

/// Mock deposit policy
pub struct MockDepositPolicy;
impl pallet_stardust_appeals::AppealDepositPolicy for MockDepositPolicy {
    type AccountId = u64;
    type Balance = u128;
    type BlockNumber = u64;
    fn calc_deposit(_who: &Self::AccountId, _domain: u8, _target: u64, _action: u8) -> Option<Self::Balance> {
        Some(1000)
    }
}

/// Mock last active provider
pub struct MockLastActiveProvider;
impl pallet_stardust_appeals::LastActiveProvider for MockLastActiveProvider {
    type BlockNumber = u64;
    fn last_active_of(_domain: u8, _target: u64) -> Option<Self::BlockNumber> {
        None
    }
}

/// Mock DepositManager
pub struct MockDepositManager;
impl pallet_deposits::DepositManager<u64, u128> for MockDepositManager {
    fn reserve(
        _who: &u64,
        _amount: u128,
        _purpose: pallet_deposits::DepositPurpose,
    ) -> Result<u64, sp_runtime::DispatchError> {
        // 返回一个模拟的deposit_id
        Ok(1)
    }
    
    fn release(_deposit_id: u64) -> Result<(), sp_runtime::DispatchError> {
        Ok(())
    }
    
    fn slash(
        _deposit_id: u64,
        _ratio: sp_runtime::Perbill,
        _beneficiary: &u64,
    ) -> Result<(), sp_runtime::DispatchError> {
        Ok(())
    }
}

impl pallet_stardust_appeals::pallet::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = pallet_balances::Pallet<Test>;
    type DepositManager = MockDepositManager;
    type AppealDeposit = frame_support::traits::ConstU128<1>;
    type RejectedSlashBps = frame_support::traits::ConstU16<0>;
    type WithdrawSlashBps = frame_support::traits::ConstU16<0>;
    type WindowBlocks = WindowBlocks;
    type MaxPerWindow = MaxPerWindow;
    type NoticeDefaultBlocks = NoticeDefaultBlocks;
    type TreasuryAccount = frame_support::traits::ConstU64<0>;
    type Router = NoopRouter;
    type GovernanceOrigin = frame_system::EnsureRoot<u64>;
    type MaxExecPerBlock = MaxExecPerBlock;
    type MaxRetries = frame_support::traits::ConstU8<3>;
    type MaxListLen = frame_support::traits::ConstU32<100>;
    type RetryBackoffBlocks = frame_support::traits::ConstU64<10>;
    type AppealDepositPolicy = MockDepositPolicy;
    type MinEvidenceCidLen = frame_support::traits::ConstU32<5>;
    type MinReasonCidLen = frame_support::traits::ConstU32<5>;
    type LastActiveProvider = MockLastActiveProvider;
    type WeightInfo = crate::weights::SubstrateWeight<Test>;
}

impl pallet_balances::Config for Test {
    type MaxLocks = frame_support::traits::ConstU32<0>;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    type Balance = u128;
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = frame_support::traits::ConstU128<1>;
    type AccountStore = System;
    type WeightInfo = ();
    type FreezeIdentifier = ();
    type MaxFreezes = frame_support::traits::ConstU32<0>;
    type RuntimeHoldReason = ();
    type RuntimeFreezeReason = ();
    type DoneSlashHandler = ();
}

/// UNIT常量：代表1个完整的token（12位小数）
pub const UNIT: u128 = 1_000_000_000_000;

/// 辅助函数：生成测试账户ID
pub fn account(id: u8) -> u64 {
    id as u64
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![(1, 1_000 * UNIT), (2, 1_000 * UNIT), (3, 1_000 * UNIT)],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| System::set_block_number(1));
    ext
}
