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

    // === 作品相关权重 (Phase 1: AI训练数据基础) ===
    fn upload_work() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(50_000, 0)
    }
    fn batch_upload_works(_count: u32) -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(30_000, 0)
    }
    fn update_work() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(30_000, 0)
    }
    fn delete_work() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(40_000, 0)
    }
    fn verify_work() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(20_000, 0)
    }
}

/// 函数级中文注释：Mock的Currency实现，简化余额管理
pub struct MockCurrency;

impl frame_support::traits::Currency<u64> for MockCurrency {
    type Balance = u64;
    type PositiveImbalance = ();
    type NegativeImbalance = ();

    fn total_balance(_who: &u64) -> Self::Balance { 1000000 }
    fn can_slash(_who: &u64, _value: Self::Balance) -> bool { true }
    fn total_issuance() -> Self::Balance { 1000000000 }
    fn minimum_balance() -> Self::Balance { 1 }
    fn burn(_amount: Self::Balance) -> Self::PositiveImbalance { () }
    fn issue(_amount: Self::Balance) -> Self::NegativeImbalance { () }
    fn free_balance(_who: &u64) -> Self::Balance { 1000000 }
    fn ensure_can_withdraw(
        _who: &u64,
        _amount: Self::Balance,
        _reasons: frame_support::traits::WithdrawReasons,
        _new_balance: Self::Balance,
    ) -> sp_runtime::DispatchResult { Ok(()) }

    fn transfer(
        _source: &u64,
        _dest: &u64,
        _value: Self::Balance,
        _existence_requirement: frame_support::traits::ExistenceRequirement,
    ) -> sp_runtime::DispatchResult { Ok(()) }

    fn slash(_who: &u64, _value: Self::Balance) -> (Self::NegativeImbalance, Self::Balance) {
        ((), 0)
    }

    fn deposit_into_existing(
        _who: &u64,
        _value: Self::Balance,
    ) -> Result<Self::PositiveImbalance, sp_runtime::DispatchError> {
        Ok(())
    }

    fn deposit_creating(_who: &u64, _value: Self::Balance) -> Self::PositiveImbalance { () }

    fn withdraw(
        _who: &u64,
        _value: Self::Balance,
        _reasons: frame_support::traits::WithdrawReasons,
        _liveness: frame_support::traits::ExistenceRequirement,
    ) -> Result<Self::NegativeImbalance, sp_runtime::DispatchError> {
        Ok(())
    }

    fn make_free_balance_be(
        _who: &u64,
        _balance: Self::Balance,
    ) -> frame_support::traits::SignedImbalance<Self::Balance, Self::PositiveImbalance> {
        frame_support::traits::SignedImbalance::Positive(())
    }
}

impl frame_support::traits::ReservableCurrency<u64> for MockCurrency {
    fn can_reserve(_who: &u64, _value: Self::Balance) -> bool { true }
    fn slash_reserved(_who: &u64, _value: Self::Balance) -> (Self::NegativeImbalance, Self::Balance) {
        ((), 0)
    }
    fn reserved_balance(_who: &u64) -> Self::Balance { 0 }
    fn reserve(_who: &u64, _value: Self::Balance) -> sp_runtime::DispatchResult { Ok(()) }
    fn unreserve(_who: &u64, _value: Self::Balance) -> Self::Balance { 0 }
    fn repatriate_reserved(
        _slashed: &u64,
        _beneficiary: &u64,
        _value: Self::Balance,
        _status: frame_support::traits::BalanceStatus,
    ) -> Result<Self::Balance, sp_runtime::DispatchError> {
        Ok(0)
    }
}

parameter_types! {
    pub FeeCollectorAccount: u64 = 1000;
    pub ArbitrationFeeAccount: u64 = 1001;
}

impl pallet_deceased::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type GraveId = u64;
    type StringLimit = ConstU32<64>;
    type MaxLinks = ConstU32<10>;
    type MaxFollowers = ConstU32<1000>;
    type TokenLimit = ConstU32<128>;
    type GraveProvider = MockGraveProvider;
    type WeightInfo = TestWeightInfo;
    type GovernanceOrigin = EnsureRootOr100;
    type IpfsPinner = MockIpfsPinner;
    type Balance = u64;
    type DefaultStoragePrice = ConstU64<100>;

    // Text模块相关类型
    type TextId = u64;
    type MaxMessagesPerDeceased = ConstU32<1000>;
    type MaxEulogiesPerDeceased = ConstU32<100>;
    type TextDeposit = ConstU64<100>;
    type ComplaintDeposit = ConstU64<500>;
    type ComplaintPeriod = ConstU64<14400>; // 1天
    type ArbitrationAccount = ArbitrationFeeAccount;

    // Media模块相关类型
    type AlbumId = u64;
    type VideoCollectionId = u64;
    type MediaId = u64;
    type MaxAlbumsPerDeceased = ConstU32<100>;
    type MaxVideoCollectionsPerDeceased = ConstU32<50>;
    type MaxPhotoPerAlbum = ConstU32<500>;
    type MaxTags = ConstU32<20>;
    type MaxReorderBatch = ConstU32<100>;
    type AlbumDeposit = ConstU64<100>;
    type VideoCollectionDeposit = ConstU64<100>;
    type MediaDeposit = ConstU64<10>;
    type CreateFee = ConstU64<10>;
    type FeeCollector = FeeCollectorAccount;

    // 共享类型
    type Currency = MockCurrency;
    type MaxTokenLen = ConstU32<128>;
}

/// 函数级中文注释：Mock的IpfsPinner实现，简化pin逻辑
pub struct MockIpfsPinner;

impl pallet_stardust_ipfs::IpfsPinner<u64, u64> for MockIpfsPinner {
    fn pin_cid_for_deceased(
        _caller: u64,
        _deceased_id: u64,
        _cid: Vec<u8>,
        _tier: Option<pallet_stardust_ipfs::PinTier>,
    ) -> sp_runtime::DispatchResult {
        Ok(())
    }

    fn pin_cid_for_grave(
        _caller: u64,
        _grave_id: u64,
        _cid: Vec<u8>,
        _tier: Option<pallet_stardust_ipfs::PinTier>,
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

/// 函数级详细中文注释：ExtBuilder模式，提供链式配置测试环境
///
/// ### 功能说明
/// - 支持链式调用配置测试环境
/// - 兼容测试代码中的ExtBuilder::default().build()模式
///
/// ### 使用示例
/// ```rust
/// ExtBuilder::default().build().execute_with(|| {
///     // 测试代码
/// });
/// ```
#[derive(Default)]
pub struct ExtBuilder;

impl ExtBuilder {
    pub fn build(self) -> sp_io::TestExternalities {
        new_test_ext()
    }
}

