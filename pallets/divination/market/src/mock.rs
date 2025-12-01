//! 通用占卜服务市场 Pallet 测试模拟环境

use crate as pallet_divination_market;
use frame_support::{
    derive_impl,
    parameter_types,
    traits::{ConstU32, ConstU64},
};
use pallet_divination_common::{DivinationProvider, DivinationType, RarityInput};
use sp_runtime::BuildStorage;
use sp_std::vec::Vec;

type Block = frame_system::mocking::MockBlock<Test>;

// 构建模拟运行时
frame_support::construct_runtime!(
    pub enum Test {
        System: frame_system,
        Balances: pallet_balances,
        Timestamp: pallet_timestamp,
        DivinationMarket: pallet_divination_market,
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type Block = Block;
    type AccountData = pallet_balances::AccountData<u64>;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
    type AccountStore = System;
    type Balance = u64;
}

impl pallet_timestamp::Config for Test {
    type Moment = u64;
    type OnTimestampSet = ();
    type MinimumPeriod = ConstU64<1>;
    type WeightInfo = ();
}

/// 模拟 DivinationProvider 用于测试
pub struct MockDivinationProvider;

// 用于测试的模拟数据
thread_local! {
    static MOCK_RESULTS: std::cell::RefCell<std::collections::HashMap<(DivinationType, u64), MockResult>> =
        std::cell::RefCell::new(std::collections::HashMap::new());
}

#[derive(Clone)]
pub struct MockResult {
    pub creator: u64,
    pub rarity_input: RarityInput,
}

impl MockDivinationProvider {
    /// 添加模拟的占卜结果
    pub fn add_result(
        divination_type: DivinationType,
        result_id: u64,
        creator: u64,
        rarity_input: RarityInput,
    ) {
        MOCK_RESULTS.with(|r| {
            r.borrow_mut().insert(
                (divination_type, result_id),
                MockResult {
                    creator,
                    rarity_input,
                },
            );
        });
    }

    /// 清除所有模拟数据
    pub fn clear() {
        MOCK_RESULTS.with(|r| r.borrow_mut().clear());
    }
}

impl DivinationProvider<u64> for MockDivinationProvider {
    fn result_exists(divination_type: DivinationType, result_id: u64) -> bool {
        MOCK_RESULTS.with(|r| r.borrow().contains_key(&(divination_type, result_id)))
    }

    fn result_creator(divination_type: DivinationType, result_id: u64) -> Option<u64> {
        MOCK_RESULTS.with(|r| {
            r.borrow()
                .get(&(divination_type, result_id))
                .map(|m| m.creator)
        })
    }

    fn rarity_data(divination_type: DivinationType, result_id: u64) -> Option<RarityInput> {
        MOCK_RESULTS.with(|r| {
            r.borrow()
                .get(&(divination_type, result_id))
                .map(|m| m.rarity_input.clone())
        })
    }

    fn result_summary(_divination_type: DivinationType, _result_id: u64) -> Option<Vec<u8>> {
        Some(b"mock summary".to_vec())
    }

    fn is_nftable(_divination_type: DivinationType, _result_id: u64) -> bool {
        true
    }

    fn mark_as_nfted(_divination_type: DivinationType, _result_id: u64) {
        // no-op
    }
}

parameter_types! {
    pub PlatformAccount: u64 = 999;
}

/// 模拟治理权限
pub struct MockGovernanceOrigin;

impl<O: Into<Result<frame_system::RawOrigin<u64>, O>> + From<frame_system::RawOrigin<u64>>>
    frame_support::traits::EnsureOrigin<O> for MockGovernanceOrigin
{
    type Success = ();

    fn try_origin(o: O) -> Result<Self::Success, O> {
        o.into().and_then(|o| match o {
            frame_system::RawOrigin::Root => Ok(()),
            r => Err(O::from(r)),
        })
    }

    #[cfg(feature = "runtime-benchmarks")]
    fn try_successful_origin() -> Result<O, ()> {
        Ok(O::from(frame_system::RawOrigin::Root))
    }
}

impl pallet_divination_market::Config for Test {
    type Currency = Balances;
    type DivinationProvider = MockDivinationProvider;
    type MinDeposit = ConstU64<10_000>;
    type MinServicePrice = ConstU64<100>;
    type OrderTimeout = ConstU64<1000>;
    type AcceptTimeout = ConstU64<100>;
    type ReviewPeriod = ConstU64<500>;
    type WithdrawalCooldown = ConstU64<100>;
    type MaxNameLength = ConstU32<64>;
    type MaxBioLength = ConstU32<256>;
    type MaxDescriptionLength = ConstU32<512>;
    type MaxCidLength = ConstU32<64>;
    type MaxPackagesPerProvider = ConstU32<10>;
    type MaxFollowUpsPerOrder = ConstU32<5>;
    type PlatformAccount = PlatformAccount;
    type GovernanceOrigin = MockGovernanceOrigin;
}

/// 构建测试外部状态
pub fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    pallet_balances::GenesisConfig::<Test> {
        balances: vec![
            (1, 1_000_000),    // 客户1
            (2, 1_000_000),    // 客户2
            (10, 1_000_000),   // 提供者1
            (11, 1_000_000),   // 提供者2
            (999, 10_000_000), // 平台账户
        ],
        dev_accounts: None,
    }
    .assimilate_storage(&mut t)
    .unwrap();

    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| {
        System::set_block_number(1);
        MockDivinationProvider::clear();
    });
    ext
}

/// 推进区块
#[allow(dead_code)]
pub fn run_to_block(n: u64) {
    while System::block_number() < n {
        System::set_block_number(System::block_number() + 1);
    }
}
