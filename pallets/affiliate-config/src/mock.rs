//! Mock 环境，用于单元测试

use super::*;
use crate as pallet_affiliate_config;

use frame_support::{
    derive_impl,
    parameter_types,
    PalletId,
};
use sp_runtime::{
    traits::IdentityLookup,
    BuildStorage, DispatchResult,
};

type Block = frame_system::mocking::MockBlock<Test>;
type Balance = u128;

// 配置测试运行时
frame_support::construct_runtime!(
    pub enum Test
    {
        System: frame_system,
        Balances: pallet_balances,
        AffiliateConfig: pallet_affiliate_config,
    }
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Block = Block;
    type AccountData = pallet_balances::AccountData<Balance>;
}

parameter_types! {
    pub const ExistentialDeposit: Balance = 1;
}

#[derive_impl(pallet_balances::config_preludes::TestDefaultConfig)]
impl pallet_balances::Config for Test {
    type Balance = Balance;
    type ExistentialDeposit = ExistentialDeposit;
    type AccountStore = System;
}

parameter_types! {
    pub const AffiliateConfigPalletId: PalletId = PalletId(*b"affcfg!!");
}

// Mock 周结算提供者
pub struct MockWeeklyProvider;
impl WeeklyAffiliateProvider<u64, Balance> for MockWeeklyProvider {
    fn escrow_and_record(_who: &u64, _amount: Balance, _referrer_code: &[u8]) -> DispatchResult {
        Ok(())
    }
}

// Mock 即时分成提供者
pub struct MockInstantProvider;
impl InstantAffiliateProvider<u64, Balance> for MockInstantProvider {
    fn distribute_instant(
        _buyer: &u64,
        _amount: Balance,
        _referrer: &u64,
        _max_levels: u8,
    ) -> DispatchResult {
        Ok(())
    }
}

// Mock 会员信息提供者
pub struct MockMembershipProvider;
impl MembershipProvider<u64> for MockMembershipProvider {
    fn get_referral_levels(who: &u64) -> u8 {
        match who {
            1 => 5,   // 1年会员：5层
            2 => 10,  // 3年会员：10层
            3 => 15,  // 5年会员：15层
            _ => 0,
        }
    }

    fn is_valid_member(who: &u64) -> bool {
        *who >= 1 && *who <= 3
    }
}

// Mock 推荐关系提供者
pub struct MockReferralProvider;
impl ReferralProvider<u64> for MockReferralProvider {
    fn get_referrer_by_code(code: &[u8]) -> Option<u64> {
        match code {
            b"CODE001" => Some(1),
            b"CODE002" => Some(2),
            b"CODE003" => Some(3),
            _ => None,
        }
    }
}

impl pallet_affiliate_config::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type WeeklyProvider = MockWeeklyProvider;
    type InstantProvider = MockInstantProvider;
    type MembershipProvider = MockMembershipProvider;
    type ReferralProvider = MockReferralProvider;
    type GovernanceOrigin = frame_system::EnsureRoot<u64>;
    type WeightInfo = ();
    type PalletId = AffiliateConfigPalletId;
}

/// 构建测试环境
pub fn new_test_ext() -> sp_io::TestExternalities {
    let t = frame_system::GenesisConfig::<Test>::default()
        .build_storage()
        .unwrap();

    let mut ext = sp_io::TestExternalities::new(t);
    ext.execute_with(|| {
        System::set_block_number(1);
        // 手动设置余额
        let _ = Balances::force_set_balance(RuntimeOrigin::root(), 1, 1000000);
        let _ = Balances::force_set_balance(RuntimeOrigin::root(), 2, 1000000);
        let _ = Balances::force_set_balance(RuntimeOrigin::root(), 3, 1000000);
        let _ = Balances::force_set_balance(RuntimeOrigin::root(), 100, 1000000);
    });
    ext
}
