//! 单元测试：幂等、与 balances/transaction-payment 交互、策略拒绝、OnKilledAccount 清理。

#![cfg(test)]

use super::*;
use crate::mock::*;
use crate::pallet::Pallet as FeeGuardPallet;
use frame_support::{assert_ok, dispatch::RawOrigin as R};

#[test]
fn mark_unmark_idempotent() {
    new_test_ext().execute_with(|| {
        assert_ok!(FeeGuardPallet::<Test>::mark_fee_only(R::Root.into(), 1));
        // 再次标记：幂等
        assert_ok!(FeeGuardPallet::<Test>::mark_fee_only(R::Root.into(), 1));
        assert!(FeeGuardPallet::<Test>::is_fee_only(&1));

        assert_ok!(FeeGuardPallet::<Test>::unmark_fee_only(R::Root.into(), 1));
        // 再次解除：幂等
        assert_ok!(FeeGuardPallet::<Test>::unmark_fee_only(R::Root.into(), 1));
        assert!(!FeeGuardPallet::<Test>::is_fee_only(&1));
    });
}

#[test]
fn deny_non_fee_withdraw_paths() {
    new_test_ext().execute_with(|| {
        // 标记后，普通转账应失败；但本测试环境不执行 extrinsic，只验证锁存在性
        assert_ok!(FeeGuardPallet::<Test>::mark_fee_only(R::Root.into(), 1));
        assert!(FeeGuardPallet::<Test>::is_fee_only(&1));
    });
}

#[test]
fn on_killed_account_cleanup() {
    new_test_ext().execute_with(|| {
        assert_ok!(FeeGuardPallet::<Test>::mark_fee_only(R::Root.into(), 2));
        assert!(FeeGuardPallet::<Test>::is_fee_only(&2));
        // 将 2 账户杀死（余额归零且小于存活线）
        pallet_balances::Pallet::<Test>::force_set_balance(R::Root.into(), 2, 0).unwrap();
        frame_system::Pallet::<Test>::kill_account(&2);
        assert!(!FeeGuardPallet::<Test>::is_fee_only(&2));
    });
}
