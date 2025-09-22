//! 函数级中文注释：pallet-ledger 的最小 Mock 运行时，用于单元测试。
//! 说明：为适配当前 SDK 版本，仅提供基本 System 配置骨架，
//! 具体字段以实际依赖为准，测试内构造最基础环境。

#![allow(deprecated)]

#![cfg(test)]

use crate as pallet_ledger;
use frame_support::{parameter_types, traits::Everything};
use sp_core::H256;
use sp_runtime::{traits::{BlakeTwo256, IdentityLookup}, BuildStorage};

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
        Ledger: pallet_ledger,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const BlocksPerWeek: u32 = 100_800; // 6s/块 × 7天
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
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    // 新版系统配置新增关联类型占位
    type ExtensionsWeightInfo = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
    type RuntimeTask = ();
}

impl pallet_ledger::pallet::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type Balance = u128;
    type BlocksPerWeek = BlocksPerWeek;
    type WeightInfo = crate::weights::SubstrateWeight<Test>;
}

pub fn new_test_ext() -> sp_io::TestExternalities {
    let t = frame_system::GenesisConfig::<Test>::default().build_storage().unwrap();
    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| System::set_block_number(1));
    ext
}


