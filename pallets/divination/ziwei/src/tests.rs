//! # 紫微斗数 Pallet 测试用例

#![allow(deprecated)]

use crate::{mock::*, types::*, algorithm::*, Error, Event};
use frame_support::{assert_noop, assert_ok, BoundedVec};

// ============================================================================
// 基础功能测试
// ============================================================================

#[test]
fn test_divine_by_time_works() {
    new_test_ext().execute_with(|| {
        // 农历 1990年正月初一 子时 男
        assert_ok!(Ziwei::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            1990,
            1,
            1,
            DiZhi::Zi,
            Gender::Male,
            false,
        ));

        // 检查命盘创建
        assert!(Ziwei::charts(0).is_some());

        // 检查用户命盘列表
        let user_charts = Ziwei::user_charts(ALICE);
        assert_eq!(user_charts.len(), 1);
        assert_eq!(user_charts[0], 0);

        // 检查用户统计
        let stats = Ziwei::user_stats(ALICE);
        assert_eq!(stats.total_charts, 1);
    });
}

#[test]
fn test_divine_manual_works() {
    new_test_ext().execute_with(|| {
        // 手动指定四柱
        assert_ok!(Ziwei::divine_manual(
            RuntimeOrigin::signed(ALICE),
            1985,
            8,
            15,
            DiZhi::Wu,
            Gender::Female,
            TianGan::Yi,
            DiZhi::Chou,
        ));

        let chart = Ziwei::charts(0).unwrap();
        assert_eq!(chart.year_gan, TianGan::Yi);
        assert_eq!(chart.year_zhi, DiZhi::Chou);
        assert_eq!(chart.gender, Gender::Female);
    });
}

#[test]
fn test_divine_random_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(Ziwei::divine_random(RuntimeOrigin::signed(ALICE)));

        // 检查命盘创建
        assert!(Ziwei::charts(0).is_some());
    });
}

// ============================================================================
// 参数校验测试
// ============================================================================

#[test]
fn test_invalid_lunar_month_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1990,
                0, // 无效月份
                1,
                DiZhi::Zi,
                Gender::Male,
                false,
            ),
            Error::<Test>::InvalidLunarMonth
        );

        assert_noop!(
            Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1990,
                13, // 无效月份
                1,
                DiZhi::Zi,
                Gender::Male,
                false,
            ),
            Error::<Test>::InvalidLunarMonth
        );
    });
}

#[test]
fn test_invalid_lunar_day_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1990,
                1,
                0, // 无效日期
                DiZhi::Zi,
                Gender::Male,
                false,
            ),
            Error::<Test>::InvalidLunarDay
        );

        assert_noop!(
            Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1990,
                1,
                31, // 无效日期
                DiZhi::Zi,
                Gender::Male,
                false,
            ),
            Error::<Test>::InvalidLunarDay
        );
    });
}

#[test]
fn test_invalid_year_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1800, // 年份太小
                1,
                1,
                DiZhi::Zi,
                Gender::Male,
                false,
            ),
            Error::<Test>::InvalidYear
        );
    });
}

// ============================================================================
// 每日限制测试
// ============================================================================

#[test]
fn test_daily_limit_works() {
    new_test_ext().execute_with(|| {
        // 排盘 10 次（MaxDailyCharts = 10）
        for i in 0..10 {
            assert_ok!(Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1990,
                1,
                (i + 1) as u8,
                DiZhi::Zi,
                Gender::Male,
                false,
            ));
        }

        // 第 11 次应该失败
        assert_noop!(
            Ziwei::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                1990,
                1,
                11,
                DiZhi::Zi,
                Gender::Male,
                false,
            ),
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
        // 先创建命盘
        assert_ok!(Ziwei::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            1990,
            1,
            1,
            DiZhi::Zi,
            Gender::Male,
            false,
        ));

        // 请求 AI 解读
        assert_ok!(Ziwei::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 检查请求状态
        assert!(Ziwei::ai_interpretation_requests(0));

        // 检查用户统计
        let stats = Ziwei::user_stats(ALICE);
        assert_eq!(stats.ai_interpretations, 1);
    });
}

#[test]
fn test_request_ai_interpretation_not_owner_fails() {
    new_test_ext().execute_with(|| {
        // Alice 创建命盘
        assert_ok!(Ziwei::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            1990,
            1,
            1,
            DiZhi::Zi,
            Gender::Male,
            false,
        ));

        // Bob 不能请求 Alice 的命盘解读
        assert_noop!(
            Ziwei::request_ai_interpretation(RuntimeOrigin::signed(BOB), 0),
            Error::<Test>::NotChartOwner
        );
    });
}

#[test]
fn test_submit_ai_interpretation_works() {
    new_test_ext().execute_with(|| {
        // 创建命盘
        assert_ok!(Ziwei::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            1990,
            1,
            1,
            DiZhi::Zi,
            Gender::Male,
            false,
        ));

        // 请求解读
        assert_ok!(Ziwei::request_ai_interpretation(
            RuntimeOrigin::signed(ALICE),
            0,
        ));

        // 提交解读结果
        let cid: BoundedVec<u8, _> = b"QmTest123".to_vec().try_into().unwrap();
        assert_ok!(Ziwei::submit_ai_interpretation(
            RuntimeOrigin::root(),
            0,
            cid.clone(),
        ));

        // 检查命盘更新
        let chart = Ziwei::charts(0).unwrap();
        assert_eq!(chart.ai_interpretation_cid, Some(cid));

        // 检查请求状态已清除
        assert!(!Ziwei::ai_interpretation_requests(0));
    });
}

// ============================================================================
// 可见性测试
// ============================================================================

#[test]
fn test_set_visibility_works() {
    new_test_ext().execute_with(|| {
        // 创建命盘
        assert_ok!(Ziwei::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            1990,
            1,
            1,
            DiZhi::Zi,
            Gender::Male,
            false,
        ));

        // 设为公开
        assert_ok!(Ziwei::set_chart_visibility(
            RuntimeOrigin::signed(ALICE),
            0,
            true,
        ));

        let chart = Ziwei::charts(0).unwrap();
        assert!(chart.is_public);

        // 检查公开列表
        let public_charts = Ziwei::public_charts();
        assert!(public_charts.contains(&0));

        // 设为私有
        assert_ok!(Ziwei::set_chart_visibility(
            RuntimeOrigin::signed(ALICE),
            0,
            false,
        ));

        let chart = Ziwei::charts(0).unwrap();
        assert!(!chart.is_public);

        let public_charts = Ziwei::public_charts();
        assert!(!public_charts.contains(&0));
    });
}

// ============================================================================
// 算法测试
// ============================================================================

#[test]
fn test_calculate_ming_gong() {
    // 正月子时，命宫在寅
    assert_eq!(calculate_ming_gong(1, DiZhi::Zi), 2);

    // 六月午时，命宫在未
    assert_eq!(calculate_ming_gong(6, DiZhi::Wu), 1);
}

#[test]
fn test_calculate_shen_gong() {
    // 正月子时
    let shen_gong = calculate_shen_gong(1, DiZhi::Zi);
    assert!(shen_gong < 12);
}

#[test]
fn test_place_ziwei_series() {
    let positions = place_ziwei_series(0); // 紫微在子宫

    // 验证紫微星系 6 颗星都有位置
    assert_eq!(positions.len(), 6);
    assert_eq!(positions[0].0, ZhuXing::ZiWei);
    assert_eq!(positions[1].0, ZhuXing::TianJi);
    assert_eq!(positions[2].0, ZhuXing::TaiYang);
    assert_eq!(positions[3].0, ZhuXing::WuQu);
    assert_eq!(positions[4].0, ZhuXing::TianTong);
    assert_eq!(positions[5].0, ZhuXing::LianZhen);
}

#[test]
fn test_place_tianfu_series() {
    let positions = place_tianfu_series(0); // 天府在子宫

    // 验证天府星系 8 颗星都有位置
    assert_eq!(positions.len(), 8);
    assert_eq!(positions[0].0, ZhuXing::TianFu);
    assert_eq!(positions[1].0, ZhuXing::TaiYin);
    assert_eq!(positions[2].0, ZhuXing::TanLang);
    assert_eq!(positions[3].0, ZhuXing::JuMen);
    assert_eq!(positions[4].0, ZhuXing::TianXiang);
    assert_eq!(positions[5].0, ZhuXing::TianLiang);
    assert_eq!(positions[6].0, ZhuXing::QiSha);
    assert_eq!(positions[7].0, ZhuXing::PoJun);
}

#[test]
fn test_get_gong_gan() {
    // 甲年寅宫天干应为丙
    let gan = get_gong_gan(TianGan::Jia, 2);
    assert_eq!(gan, TianGan::Bing);
}

#[test]
fn test_calculate_lu_cun() {
    assert_eq!(calculate_lu_cun(TianGan::Jia), 2); // 甲禄在寅
    assert_eq!(calculate_lu_cun(TianGan::Yi), 3);  // 乙禄在卯
    assert_eq!(calculate_lu_cun(TianGan::Bing), 5); // 丙禄在巳
}

#[test]
fn test_get_si_hua_stars() {
    let si_hua = get_si_hua_stars(TianGan::Jia);
    // 甲干四化：廉贞化禄、破军化权、武曲化科、太阳化忌
    assert_eq!(si_hua[0], ZhuXing::LianZhen); // 化禄
    assert_eq!(si_hua[1], ZhuXing::PoJun);    // 化权
    assert_eq!(si_hua[2], ZhuXing::WuQu);     // 化科
    assert_eq!(si_hua[3], ZhuXing::TaiYang);  // 化忌
}

/// 测试完整版四化飞星（支持辅星）
#[test]
fn test_get_si_hua_stars_full() {
    // 甲干四化：廉贞化禄、破军化权、武曲化科、太阳化忌（全主星）
    let jia = get_si_hua_stars_full(TianGan::Jia);
    assert_eq!(jia[0], SiHuaStar::LianZhen);
    assert_eq!(jia[1], SiHuaStar::PoJun);
    assert_eq!(jia[2], SiHuaStar::WuQu);
    assert_eq!(jia[3], SiHuaStar::TaiYang);

    // 丙干四化：天同化禄、天机化权、**文昌**化科、廉贞化忌
    let bing = get_si_hua_stars_full(TianGan::Bing);
    assert_eq!(bing[0], SiHuaStar::TianTong);
    assert_eq!(bing[1], SiHuaStar::TianJi);
    assert_eq!(bing[2], SiHuaStar::WenChang); // 文昌化科（辅星）
    assert_eq!(bing[3], SiHuaStar::LianZhen);

    // 戊干四化：贪狼化禄、太阴化权、**右弼**化科、天机化忌
    let wu = get_si_hua_stars_full(TianGan::Wu);
    assert_eq!(wu[0], SiHuaStar::TanLang);
    assert_eq!(wu[1], SiHuaStar::TaiYin);
    assert_eq!(wu[2], SiHuaStar::YouBi); // 右弼化科（辅星）
    assert_eq!(wu[3], SiHuaStar::TianJi);

    // 己干四化：武曲化禄、贪狼化权、天梁化科、**文曲**化忌
    let ji = get_si_hua_stars_full(TianGan::Ji);
    assert_eq!(ji[0], SiHuaStar::WuQu);
    assert_eq!(ji[1], SiHuaStar::TanLang);
    assert_eq!(ji[2], SiHuaStar::TianLiang);
    assert_eq!(ji[3], SiHuaStar::WenQu); // 文曲化忌（辅星）

    // 辛干四化：巨门化禄、太阳化权、**文曲**化科、**文昌**化忌
    let xin = get_si_hua_stars_full(TianGan::Xin);
    assert_eq!(xin[0], SiHuaStar::JuMen);
    assert_eq!(xin[1], SiHuaStar::TaiYang);
    assert_eq!(xin[2], SiHuaStar::WenQu);   // 文曲化科（辅星）
    assert_eq!(xin[3], SiHuaStar::WenChang); // 文昌化忌（辅星）

    // 壬干四化：天梁化禄、紫微化权、**左辅**化科、武曲化忌
    let ren = get_si_hua_stars_full(TianGan::Ren);
    assert_eq!(ren[0], SiHuaStar::TianLiang);
    assert_eq!(ren[1], SiHuaStar::ZiWei);
    assert_eq!(ren[2], SiHuaStar::ZuoFu); // 左辅化科（辅星）
    assert_eq!(ren[3], SiHuaStar::WuQu);
}

/// 测试 SiHuaStar 类型转换
#[test]
fn test_si_hua_star_conversions() {
    // 主星转换
    let zhu_xing = ZhuXing::ZiWei;
    let si_hua_star = SiHuaStar::from_zhu_xing(zhu_xing);
    assert_eq!(si_hua_star, SiHuaStar::ZiWei);
    assert!(si_hua_star.is_zhu_xing());
    assert!(!si_hua_star.is_fu_xing());
    assert_eq!(si_hua_star.to_zhu_xing(), Some(ZhuXing::ZiWei));

    // 辅星转换
    let liu_ji = LiuJiXing::WenChang;
    let si_hua_star = SiHuaStar::from_liu_ji_xing(liu_ji).unwrap();
    assert_eq!(si_hua_star, SiHuaStar::WenChang);
    assert!(!si_hua_star.is_zhu_xing());
    assert!(si_hua_star.is_fu_xing());
    assert_eq!(si_hua_star.to_liu_ji_xing(), Some(LiuJiXing::WenChang));

    // 不参与四化的辅星
    let tian_kui = LiuJiXing::TianKui;
    assert!(SiHuaStar::from_liu_ji_xing(tian_kui).is_none());
}

#[test]
fn test_calculate_da_yun_direction() {
    // 阳男顺行
    assert!(calculate_da_yun_direction(TianGan::Jia, Gender::Male));

    // 阳女逆行
    assert!(!calculate_da_yun_direction(TianGan::Jia, Gender::Female));

    // 阴男逆行
    assert!(!calculate_da_yun_direction(TianGan::Yi, Gender::Male));

    // 阴女顺行
    assert!(calculate_da_yun_direction(TianGan::Yi, Gender::Female));
}

// ============================================================================
// 类型测试
// ============================================================================

#[test]
fn test_tian_gan_properties() {
    assert_eq!(TianGan::Jia.name(), "甲");
    assert_eq!(TianGan::Jia.index(), 0);
    assert_eq!(TianGan::Jia.yin_yang(), YinYang::Yang);
    assert_eq!(TianGan::Jia.wu_xing(), WuXing::Wood);

    assert_eq!(TianGan::Yi.yin_yang(), YinYang::Yin);
    assert_eq!(TianGan::Yi.wu_xing(), WuXing::Wood);
}

#[test]
fn test_di_zhi_properties() {
    assert_eq!(DiZhi::Zi.name(), "子");
    assert_eq!(DiZhi::Zi.index(), 0);
    assert_eq!(DiZhi::Zi.sheng_xiao(), "鼠");

    assert_eq!(DiZhi::Chou.sheng_xiao(), "牛");
    assert_eq!(DiZhi::Yin.sheng_xiao(), "虎");
}

#[test]
fn test_wu_xing_ju_shu() {
    assert_eq!(WuXing::Water.ju_shu(), 2);
    assert_eq!(WuXing::Wood.ju_shu(), 3);
    assert_eq!(WuXing::Metal.ju_shu(), 4);
    assert_eq!(WuXing::Earth.ju_shu(), 5);
    assert_eq!(WuXing::Fire.ju_shu(), 6);
}

#[test]
fn test_zhu_xing_series() {
    assert!(ZhuXing::ZiWei.is_ziwei_series());
    assert!(ZhuXing::TianJi.is_ziwei_series());
    assert!(!ZhuXing::TianFu.is_ziwei_series());

    assert!(ZhuXing::TianFu.is_tianfu_series());
    assert!(ZhuXing::TaiYin.is_tianfu_series());
    assert!(!ZhuXing::ZiWei.is_tianfu_series());
}

#[test]
fn test_star_brightness_weight() {
    assert_eq!(StarBrightness::Miao.weight(), 100);
    assert_eq!(StarBrightness::Wang.weight(), 80);
    assert_eq!(StarBrightness::De.weight(), 60);
    assert_eq!(StarBrightness::Ping.weight(), 40);
    assert_eq!(StarBrightness::BuDe.weight(), 20);
    assert_eq!(StarBrightness::Xian.weight(), 10);
}

// ============================================================================
// 事件测试
// ============================================================================

#[test]
fn test_events_emitted() {
    new_test_ext().execute_with(|| {
        // 创建命盘
        assert_ok!(Ziwei::divine_by_time(
            RuntimeOrigin::signed(ALICE),
            1990,
            1,
            1,
            DiZhi::Zi,
            Gender::Male,
            false,
        ));

        // 检查事件
        System::assert_has_event(RuntimeEvent::Ziwei(Event::ChartCreated {
            chart_id: 0,
            creator: ALICE,
            wu_xing_ju: Ziwei::charts(0).unwrap().wu_xing_ju,
            ju_shu: Ziwei::charts(0).unwrap().ju_shu,
        }));
    });
}
