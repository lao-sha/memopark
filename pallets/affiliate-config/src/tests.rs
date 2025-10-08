//! 单元测试

use super::*;
use crate::mock::*;
use frame_support::{assert_noop, assert_ok};

#[test]
fn default_mode_is_instant() {
    new_test_ext().execute_with(|| {
        // 默认模式应该是即时结算
        assert_eq!(AffiliateConfig::current_mode(), SettlementMode::Instant);
    });
}

#[test]
fn set_settlement_mode_works() {
    new_test_ext().execute_with(|| {
        // 从默认的即时模式切换到周结算模式 (mode_id=0)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            0, // Weekly
            0,
            0
        ));
        assert_eq!(AffiliateConfig::current_mode(), SettlementMode::Weekly);

        // 检查事件
        System::assert_last_event(
            Event::ModeChanged {
                from_mode_id: 1, // Instant (默认)
                to_mode_id: 0,   // Weekly
                block: 1,
            }
            .into(),
        );
    });
}

#[test]
fn set_settlement_mode_requires_governance() {
    new_test_ext().execute_with(|| {
        // 普通用户无法切换，需要治理权限（Root 或委员会）
        assert_noop!(
            AffiliateConfig::set_settlement_mode(
                RuntimeOrigin::signed(1),
                1, // Instant
                0,
                0
            ),
            sp_runtime::DispatchError::BadOrigin
        );
    });
}

#[test]
fn hybrid_mode_validation_works() {
    new_test_ext().execute_with(|| {
        // 有效的混合模式 (mode_id=2)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            2,  // Hybrid
            5,  // instant_levels
            10  // weekly_levels
        ));

        // instant_levels 为 0 应该失败
        assert_noop!(
            AffiliateConfig::set_settlement_mode(
                RuntimeOrigin::root(),
                2,  // Hybrid
                0,  // instant_levels = 0
                10
            ),
            Error::<Test>::InstantLevelsMustBeNonZero
        );

        // 层级总和超过 15 应该失败
        assert_noop!(
            AffiliateConfig::set_settlement_mode(
                RuntimeOrigin::root(),
                2,  // Hybrid
                10, // instant_levels
                6   // weekly_levels (total = 16)
            ),
            Error::<Test>::InvalidHybridParams
        );
    });
}

#[test]
fn distribute_rewards_with_weekly_mode() {
    new_test_ext().execute_with(|| {
        // 设置为周结算模式 (mode_id=0)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            0, // Weekly
            0,
            0
        ));

        // 分配奖励
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 10000, b"CODE001"));

        // 检查统计
        let (count, total) = AffiliateConfig::get_mode_statistics(&SettlementMode::Weekly);
        assert_eq!(count, 1);
        assert_eq!(total, 10000);
    });
}

#[test]
fn distribute_rewards_with_instant_mode() {
    new_test_ext().execute_with(|| {
        // 设置为即时模式 (mode_id=1)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            1, // Instant
            0,
            0
        ));

        // 分配奖励
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 10000, b"CODE002"));

        // 检查统计
        let (count, total) = AffiliateConfig::get_mode_statistics(&SettlementMode::Instant);
        assert_eq!(count, 1);
        assert_eq!(total, 10000);
    });
}

#[test]
fn distribute_rewards_with_hybrid_mode() {
    new_test_ext().execute_with(|| {
        // 设置为混合模式：前3层即时，后12层周结算 (mode_id=2)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            2,  // Hybrid
            3,  // instant_levels
            12  // weekly_levels
        ));
        let hybrid_mode = SettlementMode::Hybrid {
            instant_levels: 3,
            weekly_levels: 12,
        };

        // 分配奖励
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 10000, b"CODE003"));

        // 检查统计
        let (count, total) = AffiliateConfig::get_mode_statistics(&hybrid_mode);
        assert_eq!(count, 1);
        assert_eq!(total, 10000);
    });
}

#[test]
fn distribute_rewards_fails_with_invalid_referrer() {
    new_test_ext().execute_with(|| {
        // 无效的推荐码
        assert_noop!(
            AffiliateConfig::distribute_rewards(&100, 10000, b"INVALID"),
            Error::<Test>::ReferrerNotFound
        );
    });
}

#[test]
fn switch_history_is_recorded() {
    new_test_ext().execute_with(|| {
        // 从默认的即时模式切换到周结算模式 (mode_id=0)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            0, // Weekly
            0,
            0
        ));

        // 再切换到混合模式 (mode_id=2)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            2,  // Hybrid
            5,  // instant_levels
            10  // weekly_levels
        ));

        // 检查历史记录
        let history = AffiliateConfig::get_switch_history();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].from_mode, SettlementMode::Instant);  // 默认是 Instant
        assert_eq!(history[0].to_mode, SettlementMode::Weekly);
        assert_eq!(history[1].from_mode, SettlementMode::Weekly);
    });
}

#[test]
fn mode_usage_statistics_accumulate() {
    new_test_ext().execute_with(|| {
        // 先切换到周结算模式
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            0, // Weekly
            0,
            0
        ));
        
        // 使用周结算模式分配3次
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 1000, b"CODE001"));
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 2000, b"CODE001"));
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 3000, b"CODE001"));

        let (count, total) = AffiliateConfig::get_mode_statistics(&SettlementMode::Weekly);
        assert_eq!(count, 3);
        assert_eq!(total, 6000);

        // 切换到即时模式并分配2次 (mode_id=1)
        assert_ok!(AffiliateConfig::set_settlement_mode(
            RuntimeOrigin::root(),
            1, // Instant
            0,
            0
        ));
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 5000, b"CODE002"));
        assert_ok!(AffiliateConfig::distribute_rewards(&100, 7000, b"CODE002"));

        let (count, total) = AffiliateConfig::get_mode_statistics(&SettlementMode::Instant);
        assert_eq!(count, 2);
        assert_eq!(total, 12000);

        // 周结算的统计应该保持不变
        let (count, total) = AffiliateConfig::get_mode_statistics(&SettlementMode::Weekly);
        assert_eq!(count, 3);
        assert_eq!(total, 6000);
    });
}
