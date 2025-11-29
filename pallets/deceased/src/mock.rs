// 函数级中文注释：pallet-deceased的Mock Runtime，用于单元测试

use crate as pallet_deceased;
use frame_support::{
    parameter_types,
    traits::{ConstU32, ConstU64, Get},
};
use sp_core::H256;
use sp_runtime::{
    traits::{BlakeTwo256, IdentityLookup},
    BuildStorage,
};
use sp_std::vec::Vec;
use codec::{Encode, Decode};
use scale_info::TypeInfo;

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
    type StringLimit = ConstU32<64>;
    type MaxLinks = ConstU32<10>;
    type TokenLimit = ConstU32<128>;
    type WeightInfo = TestWeightInfo;
    type GovernanceOrigin = EnsureRootOr100;
    type IpfsPinner = MockIpfsPinner;
    type Balance = u64;
    type DefaultStoragePrice = ConstU64<100>;

    // Text模块相关类型
    type TextId = u64;
    type MaxMessagesPerDeceased = ConstU32<1000>;
    type MaxEulogiesPerDeceased = ConstU32<100>;
    type TextDeposit = ConstU64<0>;  // 🆕 2025-11-26: 留言免押金
    type ComplaintDeposit = ConstU64<500>;
    type ComplaintPeriod = ConstU64<14400>; // 1天
    type ArbitrationAccount = ArbitrationFeeAccount;
    // 🆕 2025-11-26: 留言频率限制配置
    type MaxMessagesPerUserDaily = ConstU32<20>;      // 每日最多20条留言
    type MaxMessagesPerDeceasedDaily = ConstU32<5>;   // 每个逝者每日最多5条

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

    // ========== 🆕 新增配置项 ==========
    /// 函数级中文注释：特权Origin - 允许账户0（Root）和账户100进行特权操作
    type PrivilegedOrigin = EnsureRootOr100;

    /// 函数级中文注释：随机数生成器 - 测试用简单随机数实现
    type Randomness = TestRandomness;

    /// 函数级中文注释：Unix时间提供器 - 测试用固定时间
    type UnixTime = TestTime;

    // ========== 新增缺失的配置项 ==========
    type PricingProvider = MockPricingProvider;
    type CommitteeOrigin = frame_system::EnsureRoot<u64>;
    type ApprovalThreshold = ConstU32<3>;
    type Fungible = MockFungible;  // 使用Mock实现
    type RuntimeHoldReason = MockHoldReason;
    type TreasuryAccount = TreasuryAccountProvider;
    type Social = MockSocial;  // 使用Mock实现

    // ========== 🆕 2025-11-26: 逝者创建频率限制配置 ==========
    /// 函数级中文注释：每日最大逝者创建数（测试用：3）
    type MaxDeceasedCreationsPerUserDaily = ConstU32<3>;
    /// 函数级中文注释：用户最大逝者总数（测试用：20）
    type MaxDeceasedPerUser = ConstU32<20>;
    /// 函数级中文注释：创建最小间隔（测试用：100块）
    type MinCreationIntervalBlocks = ConstU64<100>;
    // ==========================================================

    // ========== 🆕 2025-11-26: 留言付费配置 ==========
    /// 函数级中文注释：留言费用金额（测试用：10,000 单位）
    /// - 在测试环境中使用 u64，所以是 10,000
    /// - 对应生产环境的 10,000 DUST
    type MessageFee = ConstU64<10000>;

    /// 函数级中文注释：留言费用分配器（测试用 Mock 实现）
    /// - 测试环境不执行实际资金转移
    /// - 仅验证调用流程正确性
    type MessageFeeDistributor = MockMessageFeeDistributor;
    // ==========================================================

    // ========== 🆕 2025-11-26: Article押金机制配置 ==========
    /// 函数级中文注释：非拥有者创建 Article 的押金（测试用：1 USDT）
    /// - 1_000_000 = 1 USDT（精度 10^6）
    type ArticleDepositUsdt = ConstU64<1_000_000>;

    /// 函数级中文注释：Article 押金锁定期（测试用：1000块，便于测试）
    /// - 生产环境是 5_256_000（365天）
    /// - 测试环境缩短到 1000 块便于测试
    type ArticleDepositLockPeriod = ConstU64<1000>;

    /// 函数级中文注释：每块最大处理到期文章数（测试用：50）
    type MaxExpiringArticlesPerBlock = ConstU32<50>;
    // ==========================================================
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
}

/// 函数级中文注释：创建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
    frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap()
        .into()
}

// ========== 🆕 新增 Mock 实现 ==========

/// 函数级中文注释：Mock 定价服务提供者
pub struct MockPricingProvider;
impl pallet_deceased::governance::PricingProvider for MockPricingProvider {
    fn get_current_exchange_rate() -> Result<u64, &'static str> {
        Ok(1_000_000) // 1 USDT = 1_000_000 (精度 10^6)
    }
}

/// 函数级中文注释：Mock 国库账户提供者
pub struct TreasuryAccountProvider;
impl Get<u64> for TreasuryAccountProvider {
    fn get() -> u64 {
        999 // Mock 国库账户
    }
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

// ========== 🆕 Test Mock实现 ==========

/// 函数级中文注释：测试用随机数生成器
/// - 提供简单的伪随机数，基于传入的subject生成确定性随机数
/// - 用于测试环境，确保测试结果的可重现性
pub struct TestRandomness;

impl frame_support::traits::Randomness<sp_core::H256, u64> for TestRandomness {
    fn random(subject: &[u8]) -> (sp_core::H256, u64) {
        // 基于subject生成简单的伪随机数
        let mut seed = [0u8; 32];
        for (i, byte) in subject.iter().enumerate() {
            if i < 32 {
                seed[i] = *byte;
            }
        }

        // 添加一些变换以增加随机性
        for i in 0..32 {
            seed[i] = seed[i].wrapping_add(i as u8).wrapping_add(1);
        }

        // 添加当前区块号作为额外的熵源
        let block_number = System::block_number();
        let block_bytes = block_number.to_le_bytes();
        for i in 0..8 {
            seed[i] ^= block_bytes[i % 8];
        }

        (sp_core::H256::from(seed), block_number)
    }
}

/// 函数级中文注释：测试用时间提供器
/// - 返回基于区块号的模拟时间戳
/// - 每个区块间隔6秒（模拟真实链的出块时间）
pub struct TestTime;

impl frame_support::traits::UnixTime for TestTime {
    fn now() -> core::time::Duration {
        // 基于区块号计算模拟时间戳
        // 假设创世块时间为2024-01-01 00:00:00 UTC (1704067200)
        const GENESIS_TIMESTAMP: u64 = 1704067200;
        const BLOCK_INTERVAL_SECS: u64 = 6;

        let block_number = System::block_number();
        let elapsed_secs = block_number * BLOCK_INTERVAL_SECS;
        let current_timestamp = GENESIS_TIMESTAMP + elapsed_secs;

        core::time::Duration::from_secs(current_timestamp)
    }
}

// ========== 🆕 Mock trait implementations ==========

/// Mock Fungible implementation for testing
pub struct MockFungible;

impl frame_support::traits::fungible::Inspect<u64> for MockFungible {
    type Balance = u64;

    fn total_issuance() -> Self::Balance { 1000000000 }
    fn minimum_balance() -> Self::Balance { 1 }
    fn balance(who: &u64) -> Self::Balance { 1000000 }
    fn total_balance(who: &u64) -> Self::Balance { 1000000 }
    fn reducible_balance(who: &u64, _preservation: frame_support::traits::Preservation, _force: frame_support::traits::Fortitude) -> Self::Balance { 1000000 }
    fn can_deposit(who: &u64, amount: Self::Balance, _provenance: frame_support::traits::Provenance) -> frame_support::traits::tokens::DepositConsequence {
        frame_support::traits::tokens::DepositConsequence::Success
    }
    fn can_withdraw(who: &u64, amount: Self::Balance) -> frame_support::traits::tokens::WithdrawConsequence<Self::Balance> {
        frame_support::traits::tokens::WithdrawConsequence::Success
    }
}

impl frame_support::traits::fungible::Mutate<u64> for MockFungible {
    fn mint_into(_who: &u64, amount: Self::Balance) -> Result<Self::Balance, sp_runtime::DispatchError> { Ok(amount) }
    fn burn_from(_who: &u64, amount: Self::Balance, _preservation: frame_support::traits::Preservation, _precision: frame_support::traits::Precision, _force: frame_support::traits::Fortitude) -> Result<Self::Balance, sp_runtime::DispatchError> { Ok(amount) }
}

impl frame_support::traits::fungible::hold::Inspect<u64> for MockFungible {
    type Reason = MockHoldReason;

    fn balance_on_hold(_reason: &Self::Reason, _who: &u64) -> Self::Balance { 0 }
    fn can_hold(_reason: &Self::Reason, _who: &u64, _amount: Self::Balance) -> bool { true }
}

impl frame_support::traits::fungible::hold::Mutate<u64> for MockFungible {
    fn hold(_reason: &Self::Reason, _who: &u64, _amount: Self::Balance) -> sp_runtime::DispatchResult { Ok(()) }
    fn release(_reason: &Self::Reason, _who: &u64, amount: Self::Balance, _precision: frame_support::traits::Precision) -> Result<Self::Balance, sp_runtime::DispatchError> { Ok(amount) }
    fn burn_held(_reason: &Self::Reason, _who: &u64, amount: Self::Balance, _precision: frame_support::traits::Precision, _force: frame_support::traits::Fortitude) -> Result<Self::Balance, sp_runtime::DispatchError> { Ok(amount) }
    fn transfer_on_hold(_reason: &Self::Reason, _source: &u64, _dest: &u64, amount: Self::Balance, _precision: frame_support::traits::Precision, _restriction: frame_support::traits::Restriction, _force: frame_support::traits::Fortitude) -> Result<Self::Balance, sp_runtime::DispatchError> { Ok(amount) }
    fn transfer_and_hold(_reason: &Self::Reason, _source: &u64, _dest: &u64, amount: Self::Balance, _precision: frame_support::traits::Precision, _preservation: frame_support::traits::Preservation, _force: frame_support::traits::Fortitude) -> Result<Self::Balance, sp_runtime::DispatchError> { Ok(amount) }
}

/// Mock HoldReason for testing
#[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub enum MockHoldReason {
    DeceasedDeposit,
    /// 🆕 2025-11-26: Article押金hold原因
    ArticleDeposit,
}

impl From<pallet_deceased::HoldReason> for MockHoldReason {
    fn from(reason: pallet_deceased::HoldReason) -> Self {
        match reason {
            pallet_deceased::HoldReason::DeceasedDeposit => MockHoldReason::DeceasedDeposit,
            pallet_deceased::HoldReason::ArticleDeposit => MockHoldReason::ArticleDeposit,
        }
    }
}

/// Mock Social implementation for testing
pub struct MockSocial;

impl pallet_social::SocialInterface<u64> for MockSocial {
    fn is_following(_follower: &u64, _followee: &u64) -> bool { false }
    fn follow(_follower: &u64, _followee: &u64) -> sp_runtime::DispatchResult { Ok(()) }
    fn unfollow(_follower: &u64, _followee: &u64) -> sp_runtime::DispatchResult { Ok(()) }
    fn get_followers_count(_account: &u64) -> u32 { 0 }
    fn get_following_count(_account: &u64) -> u32 { 0 }
}

// ========== 🆕 2025-11-26: 留言付费 Mock 实现 ==========

/// 函数级详细中文注释：Mock 留言费用分配器
///
/// ### 功能说明
/// - 测试环境下的留言费用分配实现
/// - 简单返回成功，不实际执行资金转移
/// - 用于验证付费逻辑的调用流程
///
/// ### 测试场景
/// - 验证 create_text(Message) 时是否调用分配器
/// - 验证余额检查逻辑
/// - 验证 MessageFeePaid 事件触发
pub struct MockMessageFeeDistributor;

impl pallet_deceased::MessageFeeDistributor<u64, u64> for MockMessageFeeDistributor {
    fn distribute_message_fee(
        _payer: &u64,
        amount: u64,
    ) -> Result<u64, sp_runtime::DispatchError> {
        // 测试环境：直接返回成功，金额原样返回
        Ok(amount)
    }
}

