//! # 六爻 Pallet 测试用例

use crate::{mock::*, types::*, algorithm::*, Error, Event};
use frame_support::{assert_noop, assert_ok, BoundedVec};

// ============================================================================
// 基础功能测试
// ============================================================================

#[test]
fn test_divine_by_coins_works() {
    new_test_ext().execute_with(|| {
        // 铜钱起卦：少阴少阳少阴少阳少阴少阳
        // 0个阳面=老阴, 1个阳面=少阳, 2个阳面=少阴, 3个阳面=老阳
        let coins = [2, 1, 2, 1, 2, 1]; // 少阴少阳交替

        assert_ok!(Liuyao::divine_by_coins(
            RuntimeOrigin::signed(ALICE),
            coins,
            (0, 0), // 甲子年
            (2, 2), // 丙寅月
            (4, 4), // 戊辰日
            (6, 6), // 庚午时
        ));

        // 检查卦象创建
        assert!(Liuyao::guas(0).is_some());

        // 检查用户卦象列表
        let user_guas = Liuyao::user_guas(ALICE);
        assert_eq!(user_guas.len(), 1);
        assert_eq!(user_guas[0], 0);

        // 检查用户统计
        let stats = Liuyao::user_stats(ALICE);
        assert_eq!(stats.total_guas, 1);
    });
}

#[test]
fn test_divine_by_numbers_works() {
    new_test_ext().execute_with(|| {
        // 数字起卦：上卦5，下卦3，动爻2
        assert_ok!(Liuyao::divine_by_numbers(
            RuntimeOrigin::signed(ALICE),
            5,  // 上卦数
            3,  // 下卦数
            2,  // 动爻位置
            (0, 0), (2, 2), (4, 4), (6, 6),
        ));

        let gua = Liuyao::guas(0).unwrap();
        assert_eq!(gua.method, DivinationMethod::NumberMethod);
    });
}

#[test]
fn test_divine_random_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));

        // 检查卦象创建
        assert!(Liuyao::guas(0).is_some());
    });
}

#[test]
fn test_divine_manual_works() {
    new_test_ext().execute_with(|| {
        // 手动指定：全阳爻，二爻动
        let yaos = [1, 3, 1, 1, 1, 1]; // 少阳、老阳、少阳...

        assert_ok!(Liuyao::divine_manual(
            RuntimeOrigin::signed(ALICE),
            yaos,
            (0, 0), (2, 2), (4, 4), (6, 6),
        ));

        let gua = Liuyao::guas(0).unwrap();
        assert_eq!(gua.method, DivinationMethod::ManualMethod);
        assert!(gua.has_bian_gua); // 有动爻，应该有变卦
    });
}

// ============================================================================
// 参数校验测试
// ============================================================================

#[test]
fn test_invalid_coin_count_fails() {
    new_test_ext().execute_with(|| {
        let invalid_coins = [4, 1, 2, 1, 2, 1]; // 4 超出范围

        assert_noop!(
            Liuyao::divine_by_coins(
                RuntimeOrigin::signed(ALICE),
                invalid_coins,
                (0, 0), (2, 2), (4, 4), (6, 6),
            ),
            Error::<Test>::InvalidCoinCount
        );
    });
}

#[test]
fn test_invalid_number_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Liuyao::divine_by_numbers(
                RuntimeOrigin::signed(ALICE),
                0, 3, 2, // num1 = 0 无效
                (0, 0), (2, 2), (4, 4), (6, 6),
            ),
            Error::<Test>::InvalidNumber
        );
    });
}

#[test]
fn test_invalid_dong_yao_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Liuyao::divine_by_numbers(
                RuntimeOrigin::signed(ALICE),
                5, 3, 7, // dong = 7 超出范围
                (0, 0), (2, 2), (4, 4), (6, 6),
            ),
            Error::<Test>::InvalidDongYao
        );

        assert_noop!(
            Liuyao::divine_by_numbers(
                RuntimeOrigin::signed(ALICE),
                5, 3, 0, // dong = 0 无效
                (0, 0), (2, 2), (4, 4), (6, 6),
            ),
            Error::<Test>::InvalidDongYao
        );
    });
}

// ============================================================================
// 每日限制测试
// ============================================================================

#[test]
fn test_daily_limit_works() {
    new_test_ext().execute_with(|| {
        // 起卦 10 次（MaxDailyGuas = 10）
        for _ in 0..10 {
            assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));
        }

        // 第 11 次应该失败
        assert_noop!(
            Liuyao::divine_random(RuntimeOrigin::signed(ALICE)),
            Error::<Test>::DailyLimitExceeded
        );
    });
}

// ============================================================================
// AI 解读测试
// ============================================================================

#[test]
fn test_request_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        // 先创建卦象
        assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));

        // 请求 AI 解读
        assert_ok!(Liuyao::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 检查请求状态
        assert!(Liuyao::ai_interpretation_requests(0));

        // 检查用户统计
        let stats = Liuyao::user_stats(ALICE);
        assert_eq!(stats.ai_interpretations, 1);
    });
}

#[test]
fn test_request_ai_interpretation_not_owner_fails() {
    new_test_ext().execute_with(|| {
        // Alice 创建卦象
        assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));

        // Bob 不能请求 Alice 的卦象解读
        assert_noop!(
            Liuyao::request_ai_interpretation(RuntimeOrigin::signed(BOB), 0),
            Error::<Test>::NotGuaOwner
        );
    });
}

#[test]
fn test_submit_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        // 创建卦象
        assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));

        // 请求解读
        assert_ok!(Liuyao::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 提交解读结果
        let cid: BoundedVec<u8, _> = b"QmTest123".to_vec().try_into().unwrap();
        assert_ok!(Liuyao::submit_ai_interpretation(
            RuntimeOrigin::root(),
            0,
            cid.clone(),
        ));

        // 检查卦象更新
        let gua = Liuyao::guas(0).unwrap();
        assert_eq!(gua.ai_interpretation_cid, Some(cid));

        // 检查请求状态已清除
        assert!(!Liuyao::ai_interpretation_requests(0));
    });
}

// ============================================================================
// 可见性测试
// ============================================================================

#[test]
fn test_set_visibility_works() {
    new_test_ext().execute_with(|| {
        // 创建卦象
        assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));

        // 设为公开
        assert_ok!(Liuyao::set_gua_visibility(
            RuntimeOrigin::signed(ALICE),
            0,
            true,
        ));

        let gua = Liuyao::guas(0).unwrap();
        assert!(gua.is_public);

        // 检查公开列表
        let public_guas = Liuyao::public_guas();
        assert!(public_guas.contains(&0));

        // 设为私有
        assert_ok!(Liuyao::set_gua_visibility(
            RuntimeOrigin::signed(ALICE),
            0,
            false,
        ));

        let gua = Liuyao::guas(0).unwrap();
        assert!(!gua.is_public);

        let public_guas = Liuyao::public_guas();
        assert!(!public_guas.contains(&0));
    });
}

// ============================================================================
// 算法测试
// ============================================================================

#[test]
fn test_trigram_properties() {
    assert_eq!(Trigram::Qian.binary(), 0b111);
    assert_eq!(Trigram::Kun.binary(), 0b000);
    assert_eq!(Trigram::Kan.binary(), 0b010);
    assert_eq!(Trigram::Li.binary(), 0b101);

    assert_eq!(Trigram::from_binary(0b111), Trigram::Qian);
    assert_eq!(Trigram::from_binary(0b000), Trigram::Kun);
}

#[test]
fn test_yao_properties() {
    assert!(Yao::ShaoYang.is_yang());
    assert!(Yao::LaoYang.is_yang());
    assert!(!Yao::ShaoYin.is_yang());
    assert!(!Yao::LaoYin.is_yang());

    assert!(Yao::LaoYin.is_moving());
    assert!(Yao::LaoYang.is_moving());
    assert!(!Yao::ShaoYin.is_moving());
    assert!(!Yao::ShaoYang.is_moving());

    // 老阴变阳，老阳变阴
    assert_eq!(Yao::LaoYin.changed_value(), 1);
    assert_eq!(Yao::LaoYang.changed_value(), 0);
}

#[test]
fn test_liu_qin_calculation() {
    // 同我者为兄弟
    assert_eq!(LiuQin::from_wu_xing(WuXing::Wood, WuXing::Wood), LiuQin::XiongDi);
    // 我生者为子孙
    assert_eq!(LiuQin::from_wu_xing(WuXing::Wood, WuXing::Fire), LiuQin::ZiSun);
    // 我克者为妻财
    assert_eq!(LiuQin::from_wu_xing(WuXing::Wood, WuXing::Earth), LiuQin::QiCai);
    // 克我者为官鬼
    assert_eq!(LiuQin::from_wu_xing(WuXing::Wood, WuXing::Metal), LiuQin::GuanGui);
    // 生我者为父母
    assert_eq!(LiuQin::from_wu_xing(WuXing::Wood, WuXing::Water), LiuQin::FuMu);
}

#[test]
fn test_liu_shen_calculation() {
    // 甲乙日起青龙
    let liu_shen = calculate_liu_shen(TianGan::Jia);
    assert_eq!(liu_shen[0], LiuShen::QingLong);
    assert_eq!(liu_shen[1], LiuShen::ZhuQue);
    assert_eq!(liu_shen[2], LiuShen::GouChen);

    // 丙丁日起朱雀
    let liu_shen = calculate_liu_shen(TianGan::Bing);
    assert_eq!(liu_shen[0], LiuShen::ZhuQue);
}

#[test]
fn test_xun_kong_calculation() {
    // 甲子旬空戌亥
    let (kong1, kong2) = calculate_xun_kong(TianGan::Jia, DiZhi::Zi);
    assert_eq!(kong1, DiZhi::Xu);
    assert_eq!(kong2, DiZhi::Hai);

    // 甲戌旬空申酉
    let (kong1, kong2) = calculate_xun_kong(TianGan::Jia, DiZhi::Xu);
    assert_eq!(kong1, DiZhi::Shen);
    assert_eq!(kong2, DiZhi::You);
}

#[test]
fn test_shi_ying_gong_calculation() {
    // 乾为天：本宫六世，卦宫乾
    let (gua_xu, gong) = calculate_shi_ying_gong(Trigram::Qian, Trigram::Qian);
    assert_eq!(gua_xu, GuaXu::BenGong);
    assert_eq!(gong, Trigram::Qian);

    // 坤为地：本宫六世，卦宫坤
    let (gua_xu, gong) = calculate_shi_ying_gong(Trigram::Kun, Trigram::Kun);
    assert_eq!(gua_xu, GuaXu::BenGong);
    assert_eq!(gong, Trigram::Kun);
}

#[test]
fn test_najia_inner() {
    // 乾卦内卦纳甲：甲子、甲寅、甲辰
    let (gan, zhi) = get_inner_najia(Trigram::Qian, 0);
    assert_eq!(gan, TianGan::Jia);
    assert_eq!(zhi, DiZhi::Zi);

    let (gan, zhi) = get_inner_najia(Trigram::Qian, 1);
    assert_eq!(gan, TianGan::Jia);
    assert_eq!(zhi, DiZhi::Yin);

    let (gan, zhi) = get_inner_najia(Trigram::Qian, 2);
    assert_eq!(gan, TianGan::Jia);
    assert_eq!(zhi, DiZhi::Chen);
}

#[test]
fn test_najia_outer() {
    // 乾卦外卦纳甲：壬午、壬申、壬戌
    let (gan, zhi) = get_outer_najia(Trigram::Qian, 0);
    assert_eq!(gan, TianGan::Ren);
    assert_eq!(zhi, DiZhi::Wu);

    let (gan, zhi) = get_outer_najia(Trigram::Qian, 1);
    assert_eq!(gan, TianGan::Ren);
    assert_eq!(zhi, DiZhi::Shen);

    let (gan, zhi) = get_outer_najia(Trigram::Qian, 2);
    assert_eq!(gan, TianGan::Ren);
    assert_eq!(zhi, DiZhi::Xu);
}

#[test]
fn test_coins_to_yaos() {
    let coins = [0, 1, 2, 3, 1, 2];
    let yaos = coins_to_yaos(&coins);

    assert_eq!(yaos[0], Yao::LaoYin);   // 0个阳面
    assert_eq!(yaos[1], Yao::ShaoYang); // 1个阳面
    assert_eq!(yaos[2], Yao::ShaoYin);  // 2个阳面
    assert_eq!(yaos[3], Yao::LaoYang);  // 3个阳面
}

#[test]
fn test_calculate_bian_gua() {
    // 有动爻
    let yaos = [Yao::ShaoYin, Yao::LaoYang, Yao::ShaoYin, Yao::ShaoYin, Yao::ShaoYin, Yao::ShaoYin];
    let (_inner, _outer, has_bian) = calculate_bian_gua(&yaos);
    assert!(has_bian);

    // 无动爻
    let yaos = [Yao::ShaoYin, Yao::ShaoYang, Yao::ShaoYin, Yao::ShaoYin, Yao::ShaoYin, Yao::ShaoYin];
    let (_, _, has_bian) = calculate_bian_gua(&yaos);
    assert!(!has_bian);
}

#[test]
fn test_moving_bitmap() {
    let yaos = [Yao::LaoYin, Yao::ShaoYang, Yao::LaoYang, Yao::ShaoYin, Yao::ShaoYin, Yao::LaoYin];
    let bitmap = calculate_moving_bitmap(&yaos);

    // 初爻、三爻、上爻动
    assert_eq!(bitmap, 0b100101);
}

// ============================================================================
// 类型测试
// ============================================================================

#[test]
fn test_wu_xing_relations() {
    // 木生火
    assert_eq!(WuXing::Wood.generates(), WuXing::Fire);
    // 木克土
    assert_eq!(WuXing::Wood.restrains(), WuXing::Earth);
}

#[test]
fn test_dizhi_wuxing() {
    assert_eq!(DiZhi::Zi.wu_xing(), WuXing::Water);
    assert_eq!(DiZhi::Yin.wu_xing(), WuXing::Wood);
    assert_eq!(DiZhi::Wu.wu_xing(), WuXing::Fire);
    assert_eq!(DiZhi::Shen.wu_xing(), WuXing::Metal);
    assert_eq!(DiZhi::Chou.wu_xing(), WuXing::Earth);
}

#[test]
fn test_gua_xu_shi_ying() {
    // 本宫卦世在六爻
    assert_eq!(GuaXu::BenGong.shi_yao_pos(), 6);
    assert_eq!(GuaXu::BenGong.ying_yao_pos(), 3);

    // 一世卦世在初爻
    assert_eq!(GuaXu::YiShi.shi_yao_pos(), 1);
    assert_eq!(GuaXu::YiShi.ying_yao_pos(), 4);

    // 游魂卦世在四爻
    assert_eq!(GuaXu::YouHun.shi_yao_pos(), 4);
    assert_eq!(GuaXu::YouHun.ying_yao_pos(), 1);

    // 归魂卦世在三爻
    assert_eq!(GuaXu::GuiHun.shi_yao_pos(), 3);
    assert_eq!(GuaXu::GuiHun.ying_yao_pos(), 6);
}

// ============================================================================
// 事件测试
// ============================================================================

#[test]
fn test_events_emitted() {
    new_test_ext().execute_with(|| {
        // 创建卦象
        assert_ok!(Liuyao::divine_random(RuntimeOrigin::signed(ALICE)));

        // 检查事件
        let gua = Liuyao::guas(0).unwrap();
        System::assert_has_event(RuntimeEvent::Liuyao(Event::GuaCreated {
            gua_id: 0,
            creator: ALICE,
            method: DivinationMethod::RandomMethod,
            original_name_idx: gua.original_name_idx,
        }));
    });
}
