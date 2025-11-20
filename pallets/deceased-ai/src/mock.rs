//! # Mock Runtime for Pallet Deceased AI Tests

use super::*;
use crate as pallet_deceased_ai;
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64},
};
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
        DeceasedAI: pallet_deceased_ai,
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
    type Hash = sp_core::H256;
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
    type SS58Prefix = ();
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
    type RuntimeTask = ();
    type SingleBlockMigrations = ();
    type MultiBlockMigrator = ();
    type PreInherents = ();
    type PostInherents = ();
    type PostTransactions = ();
}

/// Mock implementation of DeceasedDataProvider
pub struct MockDeceasedProvider;

impl DeceasedDataProvider<u64> for MockDeceasedProvider {
    fn deceased_exists(_deceased_id: u64) -> bool {
        true
    }

    fn is_deceased_owner<AccountId>(_who: &AccountId, _deceased_id: u64) -> bool
    where
        AccountId: PartialEq,
    {
        true
    }

    fn get_deceased_works(
        _deceased_id: u64,
        _offset: u32,
        limit: u32,
    ) -> Result<(Vec<u64>, u32), sp_runtime::DispatchError> {
        Ok((vec![1, 2, 3], limit))
    }

    fn get_work_details(_work_id: u64) -> Result<ExportedWork, sp_runtime::DispatchError> {
        use frame_support::BoundedVec;
        Ok(ExportedWork {
            work_id: 1,
            deceased_id: 1,
            work_type_str: BoundedVec::try_from(b"Literature".to_vec()).unwrap(),
            title: BoundedVec::try_from(b"Test Work".to_vec()).unwrap(),
            description: BoundedVec::try_from(b"Test Description".to_vec()).unwrap(),
            ipfs_cid: BoundedVec::try_from(b"QmTest".to_vec()).unwrap(),
            file_size: 1024,
            created_at: Some(1234567890),
            tags: BoundedVec::default(),
            sentiment: None,
            style_tags: BoundedVec::default(),
            expertise_fields: BoundedVec::default(),
            ai_weight: 100,
        })
    }

    fn get_ai_training_works(_deceased_id: u64) -> Result<Vec<u64>, sp_runtime::DispatchError> {
        Ok(vec![1, 2, 3])
    }
}

parameter_types! {
    pub const DefaultMonthlyQuota: u32 = 10000;
    pub const MaxProvidersPerDeceased: u32 = 10;
}

impl pallet_deceased_ai::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type DeceasedProvider = MockDeceasedProvider;
    type GovernanceOrigin = frame_system::EnsureRoot<Self::AccountId>;
    type WeightInfo = ();
    type DefaultMonthlyQuota = DefaultMonthlyQuota;
    type MaxProvidersPerDeceased = MaxProvidersPerDeceased;
}

// Build genesis storage according to the mock runtime.
pub fn new_test_ext() -> sp_io::TestExternalities {
    frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap()
        .into()
}
