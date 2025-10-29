// 函数级中文注释：pallet-memo-grave的Mock Runtime，用于单元测试

use crate as pallet_memo_grave;
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64, ConstU128},
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
        MemoGrave: pallet_memo_grave,
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
    type AccountData = pallet_balances::AccountData<u128>;
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

impl pallet_balances::Config for Test {
    type MaxLocks = ConstU32<50>;
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
}

/// Mock OnIntermentCommitted - 简化实现，不记录任何内容
pub struct MockOnInterment;
impl pallet_memo_grave::OnIntermentCommitted for MockOnInterment {
    fn on_interment(_grave_id: u64, _deceased_id: u64) {
        // 空实现
    }
}

/// Mock ParkAdminOrigin - 账户99是全局园区管理员
pub struct MockParkAdmin;
impl pallet_memo_grave::ParkAdminOrigin<RuntimeOrigin> for MockParkAdmin {
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> sp_runtime::DispatchResult {
        let who = frame_system::ensure_signed(origin)?;
        if who == 99 {
            Ok(())
        } else {
            Err(sp_runtime::DispatchError::BadOrigin)
        }
    }
}

/// Mock DeceasedTokenAccess - 返回模拟的deceased token
pub struct MockDeceasedToken;
impl pallet_memo_grave::DeceasedTokenAccess<ConstU32<128>> for MockDeceasedToken {
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, ConstU32<128>>> {
        // 返回模拟token，格式为 "token_{id}"
        let token_str = alloc::format!("token_{}", id);
        token_str.as_bytes().to_vec().try_into().ok()
    }
}

/// Mock GovernanceOrigin - Root或账户100是治理账户
pub struct EnsureRootOr100;
impl frame_support::traits::EnsureOrigin<RuntimeOrigin> for EnsureRootOr100 {
    type Success = ();
    fn try_origin(o: RuntimeOrigin) -> Result<Self::Success, RuntimeOrigin> {
        match o.clone().into() {
            Ok(frame_system::RawOrigin::Root) => Ok(()),
            Ok(frame_system::RawOrigin::Signed(100)) => Ok(()),
            _ => Err(o),
        }
    }

    #[cfg(any())]
    fn try_successful_origin() -> Result<RuntimeOrigin, ()> {
        Ok(RuntimeOrigin::root())
    }
}

/// Mock IpfsPinner - 简化实现，总是成功
pub struct MockIpfsPinner;
impl pallet_memo_ipfs::IpfsPinner<u64, u128> for MockIpfsPinner {
    fn pin_add(
        _who: &u64,
        _cid: &[u8],
        _size: Option<u64>,
        _replicas: u8,
        _duration_months: u32,
    ) -> Result<u128, sp_runtime::DispatchError> {
        // 模拟成功，返回0费用
        Ok(0)
    }

    fn pin_remove(_who: &u64, _cid: &[u8]) -> sp_runtime::DispatchResult {
        Ok(())
    }

    fn is_pinned(_who: &u64, _cid: &[u8]) -> bool {
        true
    }
}

parameter_types! {
    pub const GravePalletId: PalletId = PalletId(*b"py/grave");
    pub const FeeCollector: u64 = 1000; // 费用接收账户
}

/// Mock WeightInfo
pub struct TestWeightInfo;
impl pallet_memo_grave::weights::WeightInfo for TestWeightInfo {
    fn create_grave() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_park() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_grave() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn transfer_grave() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn inter() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn exhume() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_meta() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn complain() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn restrict() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn remove() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn follow() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn unfollow() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn add_admin() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn remove_admin() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_audio() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn clear_audio() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_audio_via_governance() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn clear_audio_via_governance() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn add_audio_option() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn remove_audio_option() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_audio_from_option() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_audio_from_private_option() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn add_private_audio_option() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn remove_private_audio_option() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_audio_playlist(_: u32) -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn set_carousel(_: u32) -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
}

impl pallet_memo_grave::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = TestWeightInfo;
    type MaxCidLen = ConstU32<128>;
    type MaxPerPark = ConstU32<1000>;
    type MaxIntermentsPerGrave = ConstU32<100>;
    type OnInterment = MockOnInterment;
    type ParkAdmin = MockParkAdmin;
    type MaxIdsPerName = ConstU32<100>;
    type MaxComplaintsPerGrave = ConstU32<10>;
    type MaxAdminsPerGrave = ConstU32<5>;
    type SlugLen = ConstU32<10>;
    type MaxFollowers = ConstU32<1000>;
    type GovernanceOrigin = EnsureRootOr100;
    type DeceasedTokenProvider = MockDeceasedToken;
    type FollowCooldownBlocks = ConstU32<10>;
    type Currency = Balances;
    type FollowDeposit = ConstU128<100>;
    type CreateFee = ConstU128<0>; // 创建不收费
    type FeeCollector = FeeCollector;
    type MaxCoverOptions = ConstU32<100>;
    type MaxAudioOptions = ConstU32<100>;
    type MaxPrivateAudioOptions = ConstU32<50>;
    type MaxAudioPlaylistLen = ConstU32<20>;
    type MaxCarouselItems = ConstU32<10>;
    type MaxTitleLen = ConstU32<100>;
    type MaxLinkLen = ConstU32<200>;
    type IpfsPinner = MockIpfsPinner;
    type Balance = u128;
    type DefaultStoragePrice = ConstU128<1>;
}

/// 函数级中文注释：创建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();
    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 10000),
            (2, 10000),
            (3, 10000),
            (99, 10000), // 管理员
            (100, 10000), // 治理
        ],
    }
    .assimilate_storage(&mut t)
    .unwrap();
    t.into()
}

