// 函数级中文注释：pallet-deceased的Mock Runtime，用于单元测试

use crate as pallet_deceased;
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64},
};
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};
use sp_std::vec::Vec;
use sp_io;

#[allow(dead_code)]
type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Deceased: pallet_deceased,
    }
);

parameter_types! {
    pub const BlockHashCount: u64 = 250;
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
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ();
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

/// 函数级中文注释：Mock墓位检查器，简化墓位验证逻辑
/// 规则：
/// - grave_id 1, 2, 3 存在，其他不存在
/// - 账户99可以管理所有墓位（超级管理员）
/// - 账户1可以管理grave_id 1
/// - 账户2可以管理grave_id 2
pub struct MockGraveProvider;

impl pallet_deceased::GraveInspector<u64, u64> for MockGraveProvider {
    fn grave_exists(grave_id: u64) -> bool {
        grave_id <= 3
    }

    fn can_attach(who: &u64, grave_id: u64) -> bool {
        if *who == 99 {
            return true; // 超级管理员
        }
        if grave_id == 1 && *who == 1 {
            return true;
        }
        if grave_id == 2 && *who == 2 {
            return true;
        }
        if grave_id == 3 && *who == 3 {
            return true;
        }
        false
    }

    fn record_interment(
        _grave_id: u64,
        _deceased_id: u64,
        _slot: Option<u16>,
        _note_cid: Option<sp_std::vec::Vec<u8>>,
    ) -> Result<(), sp_runtime::DispatchError> {
        Ok(()) // Mock实现，总是成功
    }

    fn record_exhumation(
        _grave_id: u64,
        _deceased_id: u64,
    ) -> Result<(), sp_runtime::DispatchError> {
        Ok(()) // Mock实现，总是成功
    }

    fn check_admission_policy(
        _who: &u64,
        grave_id: u64,
    ) -> Result<(), sp_runtime::DispatchError> {
        // 简化策略：测试环境下，允许deceased owner转移到任何存在的墓位
        // 只要墓位存在，就允许准入（模拟Public准入策略）
        if Self::grave_exists(grave_id) {
            Ok(())
        } else {
            Err(sp_runtime::DispatchError::Other("AdmissionDenied"))
        }
    }
}

/// 函数级中文注释：治理Origin，Root或账户100
pub struct EnsureRootOr100;

impl frame_support::traits::EnsureOrigin<RuntimeOrigin> for EnsureRootOr100 {
    type Success = u64;

    fn try_origin(o: RuntimeOrigin) -> Result<Self::Success, RuntimeOrigin> {
        Into::<Result<frame_system::RawOrigin<u64>, RuntimeOrigin>>::into(o)
            .and_then(|raw_origin| match raw_origin {
                frame_system::RawOrigin::Root => Ok(0),
                frame_system::RawOrigin::Signed(100) => Ok(100),
                _ => Err(RuntimeOrigin::from(raw_origin)),
            })
    }

    #[cfg(any())]
    fn try_successful_origin() -> Result<RuntimeOrigin, ()> {
        Ok(RuntimeOrigin::root())
    }
}

/// 函数级中文注释：测试用WeightInfo，所有权重返回固定值
pub struct TestWeightInfo;

impl pallet_deceased::WeightInfo for TestWeightInfo {
    fn create() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn remove() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn transfer() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
}

impl pallet_deceased::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type GraveId = u64;
    type StringLimit = ConstU32<64>;
    type MaxLinks = ConstU32<10>;
    type TokenLimit = ConstU32<128>;
    type GraveProvider = MockGraveProvider;
    type WeightInfo = TestWeightInfo;
    type GovernanceOrigin = EnsureRootOr100;
    type IpfsPinner = MockIpfsPinner;
    type Balance = u64;
    type DefaultStoragePrice = ConstU64<100>;
}

/// 函数级中文注释：Mock的IpfsPinner实现，简化pin逻辑
pub struct MockIpfsPinner;

impl pallet_memo_ipfs::IpfsPinner<u64, u64> for MockIpfsPinner {
    fn pin_cid_for_deceased(
        _caller: u64,
        _deceased_id: u64,
        _cid: Vec<u8>,
        _price: u64,
        _replicas: u32,
    ) -> sp_runtime::DispatchResult {
        Ok(())
    }

    fn pin_cid_for_grave(
        _caller: u64,
        _grave_id: u64,
        _cid: Vec<u8>,
        _price: u64,
        _replicas: u32,
    ) -> sp_runtime::DispatchResult {
        Ok(())
    }
}

/// 函数级中文注释：创建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
    frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap()
        .into()
}

