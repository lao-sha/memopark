//! 小六壬 Pallet 单元测试
//!
//! 测试小六壬排盘系统的所有核心功能

use crate::{mock::*, types::*, Error, Event, Pans, UserPans, PublicPans};
use frame_support::{assert_noop, assert_ok, BoundedVec};

// ============================================================================
// 时间起课测试
// ============================================================================

#[test]
fn test_divine_by_time_works() {
    new_test_ext().execute_with(|| {
        // 六月初五辰时（7点）
        assert_ok!(XiaoLiuRen::divine_by_time(
            RuntimeOrigin::signed(1),
            6,  // 农历六月
            5,  // 初五
            7,  // 7点 = 辰时
            None,
            false,
        ));

        // 验证课盘创建
        let pan = Pans::<Test>::get(0).expect("Pan should exist");
        assert_eq!(pan.creator, 1);
        assert_eq!(pan.method, DivinationMethod::TimeMethod);
        assert_eq!(pan.lunar_month, Some(6));
        assert_eq!(pan.lunar_day, Some(5));
        assert_eq!(pan.shi_chen, Some(ShiChen::Chen));

        // 验证三宫计算结果
        // 月宫：从大安起正月，6月 = (6-1) % 6 = 5 → 空亡
        assert_eq!(pan.san_gong.yue_gong, LiuGong::KongWang);
        // 日宫：从空亡起初一，初五 = (5 + 5 - 1) % 6 = 3 → 赤口
        assert_eq!(pan.san_gong.ri_gong, LiuGong::ChiKou);
        // 时宫：从赤口起子时，辰时(5) = (3 + 5 - 1) % 6 = 1 → 留连
        assert_eq!(pan.san_gong.shi_gong, LiuGong::LiuLian);

        // 验证用户课盘索引
        let user_pans = UserPans::<Test>::get(1);
        assert_eq!(user_pans.len(), 1);
        assert_eq!(user_pans[0], 0);

        // 验证事件
        System::assert_has_event(RuntimeEvent::XiaoLiuRen(Event::PanCreated {
            pan_id: 0,
            creator: 1,
            method: DivinationMethod::TimeMethod,
        }));
    });
}

#[test]
fn test_divine_by_time_invalid_params() {
    new_test_ext().execute_with(|| {
        // 无效月份
        assert_noop!(
            XiaoLiuRen::divine_by_time(
                RuntimeOrigin::signed(1),
                0,  // 无效月份
                5,
                7,
                None,
                false,
            ),
            Error::<Test>::InvalidLunarMonth
        );

        assert_noop!(
            XiaoLiuRen::divine_by_time(
                RuntimeOrigin::signed(1),
                13,  // 无效月份
                5,
                7,
                None,
                false,
            ),
            Error::<Test>::InvalidLunarMonth
        );

        // 无效日期
        assert_noop!(
            XiaoLiuRen::divine_by_time(
                RuntimeOrigin::signed(1),
                6,
                0,  // 无效日期
                7,
                None,
                false,
            ),
            Error::<Test>::InvalidLunarDay
        );

        assert_noop!(
            XiaoLiuRen::divine_by_time(
                RuntimeOrigin::signed(1),
                6,
                31,  // 无效日期
                7,
                None,
                false,
            ),
            Error::<Test>::InvalidLunarDay
        );

        // 无效小时
        assert_noop!(
            XiaoLiuRen::divine_by_time(
                RuntimeOrigin::signed(1),
                6,
                5,
                24,  // 无效小时
                None,
                false,
            ),
            Error::<Test>::InvalidHour
        );
    });
}

// ============================================================================
// 数字起课测试
// ============================================================================

#[test]
fn test_divine_by_number_works() {
    new_test_ext().execute_with(|| {
        // 使用数字 1, 2, 3 起课
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1,
            2,
            3,
            None,
            false,
        ));

        let pan = Pans::<Test>::get(0).expect("Pan should exist");
        assert_eq!(pan.method, DivinationMethod::NumberMethod);
        assert_eq!(pan.param1, 1);
        assert_eq!(pan.param2, 2);
        assert_eq!(pan.param3, 3);

        // 验证三宫计算结果
        // 月宫 = (1-1) % 6 = 0 → 大安
        assert_eq!(pan.san_gong.yue_gong, LiuGong::DaAn);
        // 日宫 = (1+2-2) % 6 = 1 → 留连
        assert_eq!(pan.san_gong.ri_gong, LiuGong::LiuLian);
        // 时宫 = (1+2+3-3) % 6 = 3 → 赤口
        assert_eq!(pan.san_gong.shi_gong, LiuGong::ChiKou);
    });
}

#[test]
fn test_divine_by_number_wrap_around() {
    new_test_ext().execute_with(|| {
        // 测试取模边界
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            6,
            6,
            6,
            None,
            false,
        ));

        let pan = Pans::<Test>::get(0).expect("Pan should exist");

        // 月宫 = (6-1) % 6 = 5 → 空亡
        assert_eq!(pan.san_gong.yue_gong, LiuGong::KongWang);
        // 日宫 = (6+6-2) % 6 = 10 % 6 = 4 → 小吉
        assert_eq!(pan.san_gong.ri_gong, LiuGong::XiaoJi);
        // 时宫 = (6+6+6-3) % 6 = 15 % 6 = 3 → 赤口
        assert_eq!(pan.san_gong.shi_gong, LiuGong::ChiKou);
    });
}

#[test]
fn test_divine_by_number_invalid_params() {
    new_test_ext().execute_with(|| {
        // 数字必须大于 0
        assert_noop!(
            XiaoLiuRen::divine_by_number(
                RuntimeOrigin::signed(1),
                0,  // 无效
                2,
                3,
                None,
                false,
            ),
            Error::<Test>::NumberMustBePositive
        );
    });
}

// ============================================================================
// 随机起课测试
// ============================================================================

#[test]
fn test_divine_random_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(XiaoLiuRen::divine_random(
            RuntimeOrigin::signed(1),
            None,
            false,
        ));

        let pan = Pans::<Test>::get(0).expect("Pan should exist");
        assert_eq!(pan.method, DivinationMethod::RandomMethod);

        // 验证三宫都有效（索引在 0-5 范围内）
        assert!(pan.san_gong.yue_gong.index() < 6);
        assert!(pan.san_gong.ri_gong.index() < 6);
        assert!(pan.san_gong.shi_gong.index() < 6);
    });
}

// ============================================================================
// 手动指定测试
// ============================================================================

#[test]
fn test_divine_manual_works() {
    new_test_ext().execute_with(|| {
        // 手动指定三宫：大安、速喜、小吉
        assert_ok!(XiaoLiuRen::divine_manual(
            RuntimeOrigin::signed(1),
            0,  // 大安
            2,  // 速喜
            4,  // 小吉
            None,
            false,
        ));

        let pan = Pans::<Test>::get(0).expect("Pan should exist");
        assert_eq!(pan.method, DivinationMethod::ManualMethod);
        assert_eq!(pan.san_gong.yue_gong, LiuGong::DaAn);
        assert_eq!(pan.san_gong.ri_gong, LiuGong::SuXi);
        assert_eq!(pan.san_gong.shi_gong, LiuGong::XiaoJi);
    });
}

#[test]
fn test_divine_manual_invalid_params() {
    new_test_ext().execute_with(|| {
        // 索引超出范围
        assert_noop!(
            XiaoLiuRen::divine_manual(
                RuntimeOrigin::signed(1),
                6,  // 无效索引
                0,
                0,
                None,
                false,
            ),
            Error::<Test>::InvalidParams
        );
    });
}

// ============================================================================
// 公开状态测试
// ============================================================================

#[test]
fn test_public_pan_works() {
    new_test_ext().execute_with(|| {
        // 创建公开课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            true,  // 公开
        ));

        // 验证公开列表
        let public_pans = PublicPans::<Test>::get();
        assert_eq!(public_pans.len(), 1);
        assert_eq!(public_pans[0], 0);

        // 验证课盘状态
        let pan = Pans::<Test>::get(0).unwrap();
        assert!(pan.is_public);
    });
}

#[test]
fn test_set_pan_visibility_works() {
    new_test_ext().execute_with(|| {
        // 创建私有课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        // 设为公开
        assert_ok!(XiaoLiuRen::set_pan_visibility(
            RuntimeOrigin::signed(1),
            0,
            true,
        ));

        let pan = Pans::<Test>::get(0).unwrap();
        assert!(pan.is_public);
        assert_eq!(PublicPans::<Test>::get().len(), 1);

        // 设为私有
        assert_ok!(XiaoLiuRen::set_pan_visibility(
            RuntimeOrigin::signed(1),
            0,
            false,
        ));

        let pan = Pans::<Test>::get(0).unwrap();
        assert!(!pan.is_public);
        assert_eq!(PublicPans::<Test>::get().len(), 0);
    });
}

#[test]
fn test_set_visibility_not_owner() {
    new_test_ext().execute_with(|| {
        // 账户 1 创建课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        // 账户 2 尝试修改
        assert_noop!(
            XiaoLiuRen::set_pan_visibility(
                RuntimeOrigin::signed(2),
                0,
                true,
            ),
            Error::<Test>::NotOwner
        );
    });
}

// ============================================================================
// AI 解读测试
// ============================================================================

#[test]
fn test_request_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        // 创建课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        // 请求 AI 解读
        assert_ok!(XiaoLiuRen::request_ai_interpretation(
            RuntimeOrigin::signed(1),
            0,
        ));

        // 验证请求已记录
        assert!(crate::AiInterpretationRequests::<Test>::contains_key(0));

        // 验证事件
        System::assert_has_event(RuntimeEvent::XiaoLiuRen(Event::AiInterpretationRequested {
            pan_id: 0,
            requester: 1,
        }));
    });
}

#[test]
fn test_submit_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        // 创建课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        // 请求 AI 解读
        assert_ok!(XiaoLiuRen::request_ai_interpretation(
            RuntimeOrigin::signed(1),
            0,
        ));

        // 模拟 AI 预言机提交结果（账户 1 有预言机权限）
        let cid: BoundedVec<u8, MaxCidLen> =
            BoundedVec::try_from(b"QmTest123".to_vec()).unwrap();

        assert_ok!(XiaoLiuRen::submit_ai_interpretation(
            RuntimeOrigin::signed(1),
            0,
            cid.clone(),
        ));

        // 验证结果已存储
        let pan = Pans::<Test>::get(0).unwrap();
        assert_eq!(pan.ai_interpretation_cid, Some(cid.clone()));

        // 验证请求已移除
        assert!(!crate::AiInterpretationRequests::<Test>::contains_key(0));

        // 验证事件
        System::assert_has_event(RuntimeEvent::XiaoLiuRen(Event::AiInterpretationSubmitted {
            pan_id: 0,
            cid,
        }));
    });
}

#[test]
fn test_ai_interpretation_not_owner() {
    new_test_ext().execute_with(|| {
        // 账户 1 创建课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        // 账户 2 尝试请求解读
        assert_noop!(
            XiaoLiuRen::request_ai_interpretation(
                RuntimeOrigin::signed(2),
                0,
            ),
            Error::<Test>::NotOwner
        );
    });
}

#[test]
fn test_ai_interpretation_duplicate_request() {
    new_test_ext().execute_with(|| {
        // 创建课盘并请求解读
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        assert_ok!(XiaoLiuRen::request_ai_interpretation(
            RuntimeOrigin::signed(1),
            0,
        ));

        // 重复请求
        assert_noop!(
            XiaoLiuRen::request_ai_interpretation(
                RuntimeOrigin::signed(1),
                0,
            ),
            Error::<Test>::AiRequestAlreadyExists
        );
    });
}

// ============================================================================
// 每日限制测试
// ============================================================================

#[test]
fn test_daily_limit_enforced() {
    new_test_ext().execute_with(|| {
        // 连续起课直到达到限制
        for _ in 0..50 {
            assert_ok!(XiaoLiuRen::divine_by_number(
                RuntimeOrigin::signed(1),
                1, 2, 3,
                None,
                false,
            ));
        }

        // 超过限制
        assert_noop!(
            XiaoLiuRen::divine_by_number(
                RuntimeOrigin::signed(1),
                1, 2, 3,
                None,
                false,
            ),
            Error::<Test>::DailyLimitExceeded
        );
    });
}

// ============================================================================
// 用户统计测试
// ============================================================================

#[test]
fn test_user_stats_updated() {
    new_test_ext().execute_with(|| {
        // 创建多个课盘
        assert_ok!(XiaoLiuRen::divine_by_number(
            RuntimeOrigin::signed(1),
            1, 2, 3,
            None,
            false,
        ));

        assert_ok!(XiaoLiuRen::divine_by_time(
            RuntimeOrigin::signed(1),
            6, 5, 7,
            None,
            false,
        ));

        // 验证统计
        let stats = crate::UserStatsStorage::<Test>::get(1);
        assert_eq!(stats.total_pans, 2);
        assert_eq!(stats.first_pan_block, 1);
    });
}

// ============================================================================
// 六宫属性测试
// ============================================================================

#[test]
fn test_liu_gong_properties() {
    // 大安
    let da_an = LiuGong::DaAn;
    assert_eq!(da_an.name(), "大安");
    assert_eq!(da_an.wu_xing(), WuXing::Wood);
    assert_eq!(da_an.tian_jiang(), "青龙");
    assert!(da_an.is_auspicious());
    assert_eq!(da_an.fortune_level(), 5);

    // 留连
    let liu_lian = LiuGong::LiuLian;
    assert_eq!(liu_lian.name(), "留连");
    assert_eq!(liu_lian.wu_xing(), WuXing::Water);
    assert!(!liu_lian.is_auspicious());

    // 速喜
    let su_xi = LiuGong::SuXi;
    assert_eq!(su_xi.name(), "速喜");
    assert_eq!(su_xi.wu_xing(), WuXing::Fire);
    assert!(su_xi.is_auspicious());

    // 赤口
    let chi_kou = LiuGong::ChiKou;
    assert_eq!(chi_kou.name(), "赤口");
    assert_eq!(chi_kou.wu_xing(), WuXing::Metal);
    assert!(!chi_kou.is_auspicious());

    // 小吉
    let xiao_ji = LiuGong::XiaoJi;
    assert_eq!(xiao_ji.name(), "小吉");
    assert_eq!(xiao_ji.wu_xing(), WuXing::Wood);
    assert!(xiao_ji.is_auspicious());

    // 空亡
    let kong_wang = LiuGong::KongWang;
    assert_eq!(kong_wang.name(), "空亡");
    assert_eq!(kong_wang.wu_xing(), WuXing::Earth);
    assert!(!kong_wang.is_auspicious());
}

// ============================================================================
// 三宫分析测试
// ============================================================================

#[test]
fn test_san_gong_all_auspicious() {
    let all_good = SanGong::new(LiuGong::DaAn, LiuGong::SuXi, LiuGong::XiaoJi);
    assert!(all_good.is_all_auspicious());
    assert!(!all_good.is_all_inauspicious());
    assert!(!all_good.is_pure());
}

#[test]
fn test_san_gong_all_inauspicious() {
    let all_bad = SanGong::new(LiuGong::LiuLian, LiuGong::ChiKou, LiuGong::KongWang);
    assert!(!all_bad.is_all_auspicious());
    assert!(all_bad.is_all_inauspicious());
    assert!(!all_bad.is_pure());
}

#[test]
fn test_san_gong_pure() {
    let pure = SanGong::new(LiuGong::DaAn, LiuGong::DaAn, LiuGong::DaAn);
    assert!(pure.is_pure());
    assert!(pure.is_all_auspicious());
}

// ============================================================================
// 时辰计算测试
// ============================================================================

#[test]
fn test_shi_chen_from_hour() {
    assert_eq!(ShiChen::from_hour(0), ShiChen::Zi);
    assert_eq!(ShiChen::from_hour(1), ShiChen::Chou);
    assert_eq!(ShiChen::from_hour(3), ShiChen::Yin);
    assert_eq!(ShiChen::from_hour(7), ShiChen::Chen);
    assert_eq!(ShiChen::from_hour(11), ShiChen::Wu);
    assert_eq!(ShiChen::from_hour(23), ShiChen::Zi);
}

#[test]
fn test_shi_chen_index() {
    // 时辰索引从 1 开始（用于计算）
    assert_eq!(ShiChen::Zi.index(), 1);
    assert_eq!(ShiChen::Chou.index(), 2);
    assert_eq!(ShiChen::Chen.index(), 5);
    assert_eq!(ShiChen::Hai.index(), 12);
}

// ============================================================================
// 五行关系测试
// ============================================================================

#[test]
fn test_wu_xing_relations() {
    // 木生火
    assert_eq!(WuXing::Wood.generates(), WuXing::Fire);
    // 火生土
    assert_eq!(WuXing::Fire.generates(), WuXing::Earth);
    // 土生金
    assert_eq!(WuXing::Earth.generates(), WuXing::Metal);
    // 金生水
    assert_eq!(WuXing::Metal.generates(), WuXing::Water);
    // 水生木
    assert_eq!(WuXing::Water.generates(), WuXing::Wood);

    // 木克土
    assert_eq!(WuXing::Wood.restrains(), WuXing::Earth);
    // 火克金
    assert_eq!(WuXing::Fire.restrains(), WuXing::Metal);
    // 土克水
    assert_eq!(WuXing::Earth.restrains(), WuXing::Water);
    // 金克木
    assert_eq!(WuXing::Metal.restrains(), WuXing::Wood);
    // 水克火
    assert_eq!(WuXing::Water.restrains(), WuXing::Fire);
}
