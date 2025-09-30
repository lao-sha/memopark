//! 函数级中文注释：mock 运行时用于单元测试。

#![cfg(test)]

use crate as pallet_memo_content_governance;
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
        MCG: pallet_memo_content_governance,
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

impl pallet_memo_content_governance::pallet::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = pallet_balances::Pallet<Test>;
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

pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![(1, 1_000), (2, 1_000)],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();
    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| System::set_block_number(1));
    ext
}
