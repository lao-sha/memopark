// 函数级中文注释：pallet-memo-park的Mock Runtime，用于单元测试

use crate as pallet_memo_park;
use frame_support::{
    parameter_types,
    traits::ConstU32,
};
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};

type Block = frame_system::mocking::MockBlock<Test>;

frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        MemoPark: pallet_memo_park,
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
    type Hash = sp_core::H256;
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

/// Mock ParkAdminOrigin - 简单实现：账户ID 99 被认为是所有园区的管理员
pub struct MockParkAdmin;
impl pallet_memo_park::ParkAdminOrigin<RuntimeOrigin> for MockParkAdmin {
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> sp_runtime::DispatchResult {
        let who = frame_system::ensure_signed(origin)?;
        // 简化：账户99是全局管理员
        if who == 99 {
            Ok(())
        } else {
            Err(sp_runtime::DispatchError::BadOrigin)
        }
    }
}

/// Mock GovernanceOrigin - Root或账户100被认为是治理账户
pub struct EnsureRootOr100;
impl frame_support::traits::EnsureOrigin<RuntimeOrigin> for EnsureRootOr100 {
    type Success = ();
    fn try_origin(
        o: RuntimeOrigin,
    ) -> Result<Self::Success, RuntimeOrigin> {
        match o.clone().into() {
            Ok(frame_system::RawOrigin::Root) => Ok(()),
            Ok(frame_system::RawOrigin::Signed(100)) => Ok(()),
            _ => Err(o),
        }
    }

    #[cfg(any())] // 禁用benchmarks特性相关代码
    fn try_successful_origin() -> Result<RuntimeOrigin, ()> {
        Ok(RuntimeOrigin::root())
    }
}

impl pallet_memo_park::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type MaxRegionLen = ConstU32<64>;
    type MaxCidLen = ConstU32<128>;
    type MaxParksPerCountry = ConstU32<100>;
    type ParkAdmin = MockParkAdmin;
    type GovernanceOrigin = EnsureRootOr100;
}

/// 函数级中文注释：创建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
    let t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    t.into()
}

