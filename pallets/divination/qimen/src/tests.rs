//! # 奇门遁甲 Pallet 单元测试
//!
//! 本模块包含 pallet-qimen 的所有单元测试

#![allow(deprecated)]

use crate::{mock::*, types::*, Error, Event};
use frame_support::{assert_noop, assert_ok};

// ==================== 时间起局测试 ====================

#[test]
fn divine_by_time_works() {
    new_test_ext().execute_with(|| {
        // 使用冬至上元阳遁一局的参数
        // 年柱：甲子(0,0)，月柱：丙寅(2,2)，日柱：甲子(0,0)，时柱：甲子(0,0)
        // 节气：冬至(0)，节气内天数：1

        assert_ok!(Qimen::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            (0, 0), // 年柱：甲子
            (2, 2), // 月柱：丙寅
            (0, 0), // 日柱：甲子
            (0, 0), // 时柱：甲子
            0,      // 节气：冬至
            1,      // 节气内天数
            [0u8; 32], // 问题哈希
            false,  // 不公开
        ));

        // 验证排盘记录已创建
        assert!(Qimen::charts(0).is_some());

        // 验证事件已发出
        System::assert_has_event(RuntimeEvent::Qimen(Event::ChartCreated {
            chart_id: 0,
            diviner: ALICE,
            dun_type: DunType::Yang,
            ju_number: 1,
        }));

        // 验证用户排盘列表已更新
        let user_charts = Qimen::user_charts(ALICE);
        assert_eq!(user_charts.len(), 1);
        assert_eq!(user_charts[0], 0);

        // 验证用户统计已更新
        let stats = Qimen::user_stats(ALICE);
        assert_eq!(stats.total_charts, 1);
        assert_eq!(stats.yang_dun_count, 1);
    });
}

#[test]
fn divine_by_time_invalid_jieqi_fails() {
    new_test_ext().execute_with(|| {
        // 使用无效的节气（24及以上）
        assert_noop!(
            Qimen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (2, 2),
                (0, 0),
                (0, 0),
                24, // 无效节气
                1,
                [0u8; 32],
                false,
            ),
            Error::<Test>::InvalidJieQi
        );
    });
}

#[test]
fn divine_by_time_invalid_day_in_jieqi_fails() {
    new_test_ext().execute_with(|| {
        // 节气内天数必须为1-15
        assert_noop!(
            Qimen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (2, 2),
                (0, 0),
                (0, 0),
                0,
                0, // 无效天数
                [0u8; 32],
                false,
            ),
            Error::<Test>::InvalidDayInJieQi
        );

        assert_noop!(
            Qimen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (2, 2),
                (0, 0),
                (0, 0),
                0,
                16, // 超出范围
                [0u8; 32],
                false,
            ),
            Error::<Test>::InvalidDayInJieQi
        );
    });
}

// ==================== 数字起局测试 ====================

#[test]
fn divine_by_numbers_works() {
    new_test_ext().execute_with(|| {
        use frame_support::BoundedVec;

        let numbers: BoundedVec<u16, frame_support::traits::ConstU32<16>> =
            vec![3, 7, 9].try_into().unwrap();

        assert_ok!(Qimen::divine_by_numbers(
            RuntimeOrigin::signed(BOB),
            numbers,
            true, // 阳遁
            [1u8; 32],
            true, // 公开
        ));

        // 验证排盘记录已创建
        let chart = Qimen::charts(0).unwrap();
        assert_eq!(chart.diviner, BOB);
        assert_eq!(chart.method, DivinationMethod::ByNumbers);
        assert_eq!(chart.dun_type, DunType::Yang);
        assert!(chart.is_public);

        // 验证公开列表已更新
        let public_charts = Qimen::public_charts();
        assert_eq!(public_charts.len(), 1);
    });
}

#[test]
fn divine_by_numbers_empty_fails() {
    new_test_ext().execute_with(|| {
        use frame_support::BoundedVec;

        let numbers: BoundedVec<u16, frame_support::traits::ConstU32<16>> =
            vec![].try_into().unwrap();

        assert_noop!(
            Qimen::divine_by_numbers(
                RuntimeOrigin::signed(ALICE),
                numbers,
                true,
                [0u8; 32],
                false,
            ),
            Error::<Test>::MissingNumberParams
        );
    });
}

// ==================== 随机起局测试 ====================

#[test]
fn divine_random_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(CHARLIE),
            [2u8; 32],
            false,
        ));

        let chart = Qimen::charts(0).unwrap();
        assert_eq!(chart.diviner, CHARLIE);
        assert_eq!(chart.method, DivinationMethod::Random);

        // 局数应该在1-9范围内
        assert!(chart.ju_number >= 1 && chart.ju_number <= 9);
    });
}

// ==================== 手动起局测试 ====================

#[test]
fn divine_manual_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(Qimen::divine_manual(
            RuntimeOrigin::signed(ALICE),
            false, // 阴遁
            5,     // 五局
            (4, 6), // 时柱：戊午
            [3u8; 32],
            true,
        ));

        let chart = Qimen::charts(0).unwrap();
        assert_eq!(chart.dun_type, DunType::Yin);
        assert_eq!(chart.ju_number, 5);
        assert_eq!(chart.method, DivinationMethod::Manual);
    });
}

#[test]
fn divine_manual_invalid_ju_number_fails() {
    new_test_ext().execute_with(|| {
        // 局数必须为1-9
        assert_noop!(
            Qimen::divine_manual(
                RuntimeOrigin::signed(ALICE),
                true,
                0, // 无效局数
                (0, 0),
                [0u8; 32],
                false,
            ),
            Error::<Test>::InvalidJuNumber
        );

        assert_noop!(
            Qimen::divine_manual(
                RuntimeOrigin::signed(ALICE),
                true,
                10, // 超出范围
                (0, 0),
                [0u8; 32],
                false,
            ),
            Error::<Test>::InvalidJuNumber
        );
    });
}

// ==================== 每日限制测试 ====================

#[test]
fn daily_limit_works() {
    new_test_ext().execute_with(|| {
        // 每日最大排盘次数为10次
        for i in 0..10 {
            assert_ok!(Qimen::divine_random(
                RuntimeOrigin::signed(ALICE),
                [i as u8; 32],
                false,
            ));
        }

        // 第11次应该失败
        assert_noop!(
            Qimen::divine_random(
                RuntimeOrigin::signed(ALICE),
                [11u8; 32],
                false,
            ),
            Error::<Test>::DailyLimitExceeded
        );

        // 其他用户不受影响
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(BOB),
            [0u8; 32],
            false,
        ));
    });
}

// ==================== AI 解读测试 ====================

#[test]
fn request_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        // 先创建一个排盘
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(ALICE),
            [0u8; 32],
            false,
        ));

        let initial_balance = Balances::free_balance(ALICE);

        // 请求 AI 解读
        assert_ok!(Qimen::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 验证费用已扣除
        assert_eq!(
            Balances::free_balance(ALICE),
            initial_balance - 1000 // AiInterpretationFee
        );

        // 验证请求已记录
        assert!(Qimen::ai_interpretation_requests(0).is_some());

        // 验证事件
        System::assert_has_event(RuntimeEvent::Qimen(Event::AiInterpretationRequested {
            chart_id: 0,
            requester: ALICE,
        }));
    });
}

#[test]
fn request_ai_interpretation_not_owner_fails() {
    new_test_ext().execute_with(|| {
        // Alice 创建排盘
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(ALICE),
            [0u8; 32],
            false,
        ));

        // Bob 尝试请求 AI 解读（应该失败）
        assert_noop!(
            Qimen::request_ai_interpretation(RuntimeOrigin::signed(BOB), 0),
            Error::<Test>::NotOwner
        );
    });
}

#[test]
fn request_ai_interpretation_duplicate_fails() {
    new_test_ext().execute_with(|| {
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(ALICE),
            [0u8; 32],
            false,
        ));

        assert_ok!(Qimen::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 重复请求应该失败
        assert_noop!(
            Qimen::request_ai_interpretation(RuntimeOrigin::signed(ALICE), 0),
            Error::<Test>::AiRequestAlreadyExists
        );
    });
}

#[test]
fn submit_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        use frame_support::BoundedVec;

        // 创建排盘并请求解读
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(ALICE),
            [0u8; 32],
            false,
        ));

        assert_ok!(Qimen::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 提交解读结果（需要 Root 权限）
        let cid: BoundedVec<u8, frame_support::traits::ConstU32<64>> =
            b"QmTest123456789".to_vec().try_into().unwrap();

        assert_ok!(Qimen::submit_ai_interpretation(
            RuntimeOrigin::root(),
            0,
            cid.clone(),
        ));

        // 验证解读已保存
        let chart = Qimen::charts(0).unwrap();
        assert_eq!(chart.interpretation_cid, Some(cid.clone()));

        // 验证请求已移除
        assert!(Qimen::ai_interpretation_requests(0).is_none());

        // 验证事件
        System::assert_has_event(RuntimeEvent::Qimen(Event::AiInterpretationSubmitted {
            chart_id: 0,
            cid,
        }));
    });
}

// ==================== 公开状态测试 ====================

#[test]
fn set_chart_visibility_works() {
    new_test_ext().execute_with(|| {
        // 创建私密排盘
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(ALICE),
            [0u8; 32],
            false, // 私密
        ));

        assert_eq!(Qimen::public_charts().len(), 0);

        // 设置为公开
        assert_ok!(Qimen::set_chart_visibility(
            RuntimeOrigin::signed(ALICE),
            0,
            true,
        ));

        assert_eq!(Qimen::public_charts().len(), 1);

        // 再设置为私密
        assert_ok!(Qimen::set_chart_visibility(
            RuntimeOrigin::signed(ALICE),
            0,
            false,
        ));

        assert_eq!(Qimen::public_charts().len(), 0);
    });
}

#[test]
fn set_chart_visibility_not_owner_fails() {
    new_test_ext().execute_with(|| {
        assert_ok!(Qimen::divine_random(
            RuntimeOrigin::signed(ALICE),
            [0u8; 32],
            false,
        ));

        // Bob 尝试更改公开状态（应该失败）
        assert_noop!(
            Qimen::set_chart_visibility(RuntimeOrigin::signed(BOB), 0, true),
            Error::<Test>::NotOwner
        );
    });
}

// ==================== 排盘数据验证测试 ====================

#[test]
fn chart_palaces_are_valid() {
    new_test_ext().execute_with(|| {
        assert_ok!(Qimen::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            (0, 0), // 甲子年
            (2, 2), // 丙寅月
            (0, 0), // 甲子日
            (0, 0), // 甲子时
            0,      // 冬至
            1,      // 上元
            [0u8; 32],
            false,
        ));

        let chart = Qimen::charts(0).unwrap();

        // 验证九宫都有有效数据
        for (i, palace) in chart.palaces.iter().enumerate() {
            let expected_gong = JiuGong::from_num((i + 1) as u8).unwrap();
            assert_eq!(palace.gong, expected_gong);

            // 中宫无门无神
            if palace.gong == JiuGong::Zhong {
                assert!(palace.men.is_none());
                assert!(palace.shen.is_none());
            } else {
                // 其他宫应该有门和神
                assert!(palace.men.is_some());
                assert!(palace.shen.is_some());
            }
        }
    });
}

// ==================== 类型测试 ====================

#[test]
fn test_tian_gan() {
    assert_eq!(TianGan::Jia.name(), "甲");
    assert_eq!(TianGan::Yi.wu_xing(), WuXing::Mu);
    assert!(TianGan::Yi.is_san_qi());
    assert!(TianGan::Wu.is_liu_yi());
    assert!(!TianGan::Jia.is_san_qi());
    assert!(!TianGan::Jia.is_liu_yi());
}

#[test]
fn test_jiu_gong() {
    assert_eq!(JiuGong::Kan.num(), 1);
    assert_eq!(JiuGong::Kan.direction(), "北");
    assert_eq!(JiuGong::Kan.wu_xing(), WuXing::Shui);

    // 测试阳遁顺序
    assert_eq!(JiuGong::Kan.next_yang(), JiuGong::Gen);
    assert_eq!(JiuGong::Gen.next_yang(), JiuGong::Zhen);

    // 测试阴遁顺序
    assert_eq!(JiuGong::Kan.next_yin(), JiuGong::Qian);
    assert_eq!(JiuGong::Qian.next_yin(), JiuGong::Dui);
}

#[test]
fn test_jiu_xing() {
    assert_eq!(JiuXing::TianPeng.name(), "天蓬");
    assert!(!JiuXing::TianPeng.is_auspicious()); // 凶星
    assert!(JiuXing::TianChong.is_auspicious()); // 吉星
    assert_eq!(JiuXing::TianPeng.original_palace(), JiuGong::Kan);
}

#[test]
fn test_ba_men() {
    assert_eq!(BaMen::Xiu.name(), "休门");
    assert!(BaMen::Xiu.is_auspicious()); // 吉门
    assert!(!BaMen::Si.is_auspicious()); // 凶门
    assert_eq!(BaMen::Kai.original_palace(), JiuGong::Qian);
}

#[test]
fn test_ba_shen() {
    assert_eq!(BaShen::ZhiFu.name(), "值符");
    assert!(BaShen::ZhiFu.is_auspicious()); // 吉神
    assert!(!BaShen::BaiHu.is_auspicious()); // 凶神
}

#[test]
fn test_wu_xing_relations() {
    // 测试相生
    assert!(WuXing::Jin.generates(&WuXing::Shui)); // 金生水
    assert!(WuXing::Shui.generates(&WuXing::Mu));  // 水生木
    assert!(!WuXing::Jin.generates(&WuXing::Mu));  // 金不生木

    // 测试相克
    assert!(WuXing::Jin.conquers(&WuXing::Mu));    // 金克木
    assert!(WuXing::Mu.conquers(&WuXing::Tu));     // 木克土
    assert!(!WuXing::Jin.conquers(&WuXing::Shui)); // 金不克水
}
