//! # 大六壬排盘测试
//!
//! 本模块包含大六壬排盘系统的所有单元测试。

use crate::{mock::*, *};
use frame_support::{assert_noop, assert_ok, BoundedVec};

/// 测试用的 CID 最大长度类型
type TestMaxCidLen = <Test as crate::pallet::Config>::MaxCidLen;

// ============================================================================
// 类型测试
// ============================================================================

mod type_tests {
    use super::*;

    #[test]
    fn test_tian_gan_basic() {
        // 测试天干基本功能
        let jia = TianGan::Jia;
        assert_eq!(jia.name(), "甲");
        assert_eq!(jia.index(), 0);
        assert!(jia.is_yang());
        assert_eq!(jia.wu_xing(), WuXing::Wood);

        let yi = TianGan::Yi;
        assert_eq!(yi.name(), "乙");
        assert!(!yi.is_yang());
        assert_eq!(yi.wu_xing(), WuXing::Wood);
    }

    #[test]
    fn test_tian_gan_add() {
        // 测试天干相加
        let jia = TianGan::Jia;
        assert_eq!(jia.add(1), TianGan::Yi);
        assert_eq!(jia.add(5), TianGan::Ji);
        assert_eq!(jia.add(10), TianGan::Jia);
        assert_eq!(jia.add(-1), TianGan::Gui);
    }

    #[test]
    fn test_di_zhi_basic() {
        // 测试地支基本功能
        let zi = DiZhi::Zi;
        assert_eq!(zi.name(), "子");
        assert_eq!(zi.index(), 0);
        assert_eq!(zi.wu_xing(), WuXing::Water);

        let yin = DiZhi::Yin;
        assert_eq!(yin.wu_xing(), WuXing::Wood);
        assert!(yin.is_meng());
    }

    #[test]
    fn test_di_zhi_liu_chong() {
        // 测试六冲
        assert_eq!(DiZhi::Zi.liu_chong(), DiZhi::Wu);
        assert_eq!(DiZhi::Chou.liu_chong(), DiZhi::Wei);
        assert!(DiZhi::Zi.is_chong(DiZhi::Wu));
        assert!(DiZhi::Mao.is_chong(DiZhi::You));
    }

    #[test]
    fn test_di_zhi_xing() {
        // 测试刑
        assert_eq!(DiZhi::Zi.xing(), DiZhi::Mao);
        assert_eq!(DiZhi::Mao.xing(), DiZhi::Zi);
        assert_eq!(DiZhi::Yin.xing(), DiZhi::Si);
        assert_eq!(DiZhi::Chen.xing(), DiZhi::Chen); // 自刑
    }

    #[test]
    fn test_di_zhi_yi_ma() {
        // 测试驿马
        assert_eq!(DiZhi::Zi.yi_ma(), DiZhi::Yin);
        assert_eq!(DiZhi::Wu.yi_ma(), DiZhi::Shen);
        assert_eq!(DiZhi::You.yi_ma(), DiZhi::Hai);
    }

    #[test]
    fn test_wu_xing_ke_sheng() {
        // 测试五行生克
        assert!(WuXing::Wood.ke(WuXing::Earth)); // 木克土
        assert!(WuXing::Fire.ke(WuXing::Metal)); // 火克金
        assert!(WuXing::Wood.sheng(WuXing::Fire)); // 木生火
        assert_eq!(WuXing::Water.generates(), WuXing::Wood);
        assert_eq!(WuXing::Metal.restrains(), WuXing::Wood);
    }

    #[test]
    fn test_tian_jiang_basic() {
        // 测试十二天将
        let gui_ren = TianJiang::GuiRen;
        assert_eq!(gui_ren.name(), "贵人");
        assert_eq!(gui_ren.short_name(), "贵");
        assert!(gui_ren.is_auspicious());

        let bai_hu = TianJiang::BaiHu;
        assert_eq!(bai_hu.name(), "白虎");
        assert!(!bai_hu.is_auspicious());
    }

    #[test]
    fn test_liu_qin() {
        // 测试六亲
        assert_eq!(
            LiuQin::from_wu_xing(WuXing::Wood, WuXing::Wood),
            LiuQin::XiongDi
        );
        assert_eq!(
            LiuQin::from_wu_xing(WuXing::Wood, WuXing::Fire),
            LiuQin::ZiSun
        );
        assert_eq!(
            LiuQin::from_wu_xing(WuXing::Wood, WuXing::Earth),
            LiuQin::QiCai
        );
        assert_eq!(
            LiuQin::from_wu_xing(WuXing::Wood, WuXing::Metal),
            LiuQin::GuanGui
        );
        assert_eq!(
            LiuQin::from_wu_xing(WuXing::Wood, WuXing::Water),
            LiuQin::FuMu
        );
    }
}

// ============================================================================
// 算法测试
// ============================================================================

mod algorithm_tests {
    use super::*;

    #[test]
    fn test_calculate_tian_pan() {
        // 测试天盘计算
        // 月将午，占时子，则午加子位
        let tian_pan = calculate_tian_pan(DiZhi::Wu, DiZhi::Zi);

        // 子位上应为午
        assert_eq!(tian_pan.get(DiZhi::Zi), DiZhi::Wu);
        // 丑位上应为未
        assert_eq!(tian_pan.get(DiZhi::Chou), DiZhi::Wei);
    }

    #[test]
    fn test_calculate_tian_pan_2() {
        // 月将申，占时酉
        let tian_pan = calculate_tian_pan(DiZhi::Shen, DiZhi::You);

        // 酉位上应为申
        assert_eq!(tian_pan.get(DiZhi::You), DiZhi::Shen);
    }

    #[test]
    fn test_tian_pan_lin() {
        // 测试天盘所临
        let tian_pan = calculate_tian_pan(DiZhi::Wu, DiZhi::Zi);

        // 午所临地盘支应为子
        assert_eq!(tian_pan.lin(DiZhi::Wu), DiZhi::Zi);
    }

    #[test]
    fn test_get_ji_gong() {
        // 测试天干寄宫
        assert_eq!(get_ji_gong(TianGan::Jia), DiZhi::Yin);
        assert_eq!(get_ji_gong(TianGan::Yi), DiZhi::Chen);
        assert_eq!(get_ji_gong(TianGan::Bing), DiZhi::Si);
        assert_eq!(get_ji_gong(TianGan::Ding), DiZhi::Wei);
        assert_eq!(get_ji_gong(TianGan::Wu), DiZhi::Si);
        assert_eq!(get_ji_gong(TianGan::Ji), DiZhi::Wei);
        assert_eq!(get_ji_gong(TianGan::Geng), DiZhi::Shen);
        assert_eq!(get_ji_gong(TianGan::Xin), DiZhi::Xu);
        assert_eq!(get_ji_gong(TianGan::Ren), DiZhi::Hai);
        assert_eq!(get_ji_gong(TianGan::Gui), DiZhi::Chou);
    }

    #[test]
    fn test_get_gui_ren() {
        // 测试贵人
        // 昼贵人
        assert_eq!(get_gui_ren(TianGan::Jia, true), DiZhi::Wei);
        assert_eq!(get_gui_ren(TianGan::Ji, true), DiZhi::Zi);

        // 夜贵人
        assert_eq!(get_gui_ren(TianGan::Jia, false), DiZhi::Chou);
        assert_eq!(get_gui_ren(TianGan::Ji, false), DiZhi::Shen);
    }

    #[test]
    fn test_calculate_si_ke() {
        // 测试四课计算
        let tian_pan = calculate_tian_pan(DiZhi::Wu, DiZhi::Zi);
        let tian_jiang_pan = calculate_tian_jiang_pan(&tian_pan, TianGan::Jia, true);
        let si_ke = calculate_si_ke(&tian_pan, &tian_jiang_pan, TianGan::Jia, DiZhi::Zi);

        // 甲日：甲寄寅
        // 第一课：寅上神
        assert_eq!(si_ke.ke1.xia, DiZhi::Yin);

        // 第三课：日支上神
        assert_eq!(si_ke.ke3.xia, DiZhi::Zi);
    }

    #[test]
    fn test_calculate_san_chuan() {
        // 测试三传计算
        let tian_pan = calculate_tian_pan(DiZhi::Wu, DiZhi::Zi);
        let tian_jiang_pan = calculate_tian_jiang_pan(&tian_pan, TianGan::Jia, true);
        let si_ke = calculate_si_ke(&tian_pan, &tian_jiang_pan, TianGan::Jia, DiZhi::Zi);
        let (san_chuan, ke_shi, _ge_ju) =
            calculate_san_chuan(&tian_pan, &tian_jiang_pan, &si_ke, TianGan::Jia, DiZhi::Zi);

        // 验证三传不为空
        assert!(san_chuan.chu != DiZhi::default() || ke_shi != KeShiType::default());
    }

    #[test]
    fn test_calculate_xun_kong() {
        // 测试空亡计算
        // 甲子旬：戌亥空
        let (kong1, kong2) = calculate_xun_kong(TianGan::Jia, DiZhi::Zi);
        assert_eq!(kong1, DiZhi::Xu);
        assert_eq!(kong2, DiZhi::Hai);

        // 甲寅旬：子丑空
        let (kong1, kong2) = calculate_xun_kong(TianGan::Jia, DiZhi::Yin);
        assert_eq!(kong1, DiZhi::Zi);
        assert_eq!(kong2, DiZhi::Chou);

        // 乙丑日（甲子旬）
        let (kong1, kong2) = calculate_xun_kong(TianGan::Yi, DiZhi::Chou);
        assert_eq!(kong1, DiZhi::Xu);
        assert_eq!(kong2, DiZhi::Hai);
    }

    #[test]
    fn test_calculate_dun_gan() {
        // 测试遁干计算
        // 甲子日，子位遁甲
        let dun = calculate_dun_gan(DiZhi::Zi, TianGan::Jia, DiZhi::Zi);
        assert_eq!(dun, Some(TianGan::Jia));

        // 甲子日，丑位遁乙
        let dun = calculate_dun_gan(DiZhi::Chou, TianGan::Jia, DiZhi::Zi);
        assert_eq!(dun, Some(TianGan::Yi));

        // 甲子日，戌位空亡
        let dun = calculate_dun_gan(DiZhi::Xu, TianGan::Jia, DiZhi::Zi);
        assert_eq!(dun, None);
    }

    #[test]
    fn test_is_ba_zhuan_day() {
        // 测试八专日
        assert!(is_ba_zhuan_day(TianGan::Jia, DiZhi::Yin));
        assert!(is_ba_zhuan_day(TianGan::Geng, DiZhi::Shen));
        assert!(is_ba_zhuan_day(TianGan::Ding, DiZhi::Wei));
        assert!(is_ba_zhuan_day(TianGan::Ji, DiZhi::Wei));
        assert!(!is_ba_zhuan_day(TianGan::Jia, DiZhi::Zi));
    }

    #[test]
    fn test_fu_yin_condition() {
        // 测试伏吟条件：支阳神等于日支
        let tian_pan = calculate_tian_pan(DiZhi::Zi, DiZhi::Zi);
        // 子加子，子位上为子
        assert_eq!(tian_pan.get(DiZhi::Zi), DiZhi::Zi);
    }

    #[test]
    fn test_fan_yin_condition() {
        // 测试返吟条件：支阳神冲日支
        // 午加子，子位上为午，午冲子
        let tian_pan = calculate_tian_pan(DiZhi::Wu, DiZhi::Zi);
        let zhi_yang = tian_pan.get(DiZhi::Zi);
        assert_eq!(zhi_yang, DiZhi::Wu);
        assert!(zhi_yang.is_chong(DiZhi::Zi));
    }
}

// ============================================================================
// Pallet 测试
// ============================================================================

mod pallet_tests {
    use super::*;

    #[test]
    fn test_divine_by_time() {
        new_test_ext().execute_with(|| {
            // 甲子年甲子月甲子日甲子时，月将午，占时子，昼占
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0), // 甲子年
                (0, 0), // 甲子月
                (0, 0), // 甲子日
                (0, 0), // 甲子时
                6,      // 月将午
                0,      // 占时子
                true,   // 昼占
                None,   // 无问题
            ));

            // 验证式盘已创建
            assert!(Pans::<Test>::contains_key(0));

            // 验证用户索引
            assert!(UserPans::<Test>::get(ALICE, 0));

            // 验证统计
            let stats = UserStatsStorage::<Test>::get(ALICE);
            assert_eq!(stats.total_pans, 1);
        });
    }

    #[test]
    fn test_divine_with_question() {
        new_test_ext().execute_with(|| {
            let question: BoundedVec<u8, TestMaxCidLen> =
                BoundedVec::try_from(b"QmTest123".to_vec()).unwrap();

            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                Some(question.clone()),
            ));

            let pan = Pans::<Test>::get(0).unwrap();
            assert_eq!(pan.question_cid, Some(question));
        });
    }

    #[test]
    fn test_divine_random() {
        new_test_ext().execute_with(|| {
            assert_ok!(DaLiuRen::divine_random(
                RuntimeOrigin::signed(ALICE),
                (0, 0), // 甲子日
                None,
            ));

            // 验证式盘已创建
            assert!(Pans::<Test>::contains_key(0));

            let pan = Pans::<Test>::get(0).unwrap();
            assert_eq!(pan.method, DivinationMethod::RandomMethod);
        });
    }

    #[test]
    fn test_divine_manual() {
        new_test_ext().execute_with(|| {
            assert_ok!(DaLiuRen::divine_manual(
                RuntimeOrigin::signed(ALICE),
                (2, 2), // 丙寅年
                (3, 3), // 丁卯月
                (4, 4), // 戊辰日
                (5, 5), // 己巳时
                8,      // 月将申
                5,      // 占时巳
                false,  // 夜占
                None,
            ));

            let pan = Pans::<Test>::get(0).unwrap();
            assert_eq!(pan.method, DivinationMethod::ManualMethod);
            assert_eq!(pan.day_gz.0, TianGan::Wu);
            assert_eq!(pan.day_gz.1, DiZhi::Chen);
            assert!(!pan.is_day);
        });
    }

    #[test]
    fn test_multiple_divinations() {
        new_test_ext().execute_with(|| {
            // 连续起课
            for i in 0..5 {
                assert_ok!(DaLiuRen::divine_by_time(
                    RuntimeOrigin::signed(ALICE),
                    (0, 0),
                    (0, 0),
                    ((i % 10) as u8, (i % 12) as u8),
                    (0, 0),
                    6,
                    0,
                    true,
                    None,
                ));
            }

            // 验证统计
            let stats = UserStatsStorage::<Test>::get(ALICE);
            assert_eq!(stats.total_pans, 5);

            // 验证 ID 递增
            assert_eq!(NextPanId::<Test>::get(), 5);
        });
    }

    #[test]
    fn test_set_pan_visibility() {
        new_test_ext().execute_with(|| {
            // 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // 默认不公开
            let pan = Pans::<Test>::get(0).unwrap();
            assert!(!pan.is_public);
            assert!(!PublicPans::<Test>::contains_key(0));

            // 设置为公开
            assert_ok!(DaLiuRen::set_pan_visibility(
                RuntimeOrigin::signed(ALICE),
                0,
                true
            ));

            let pan = Pans::<Test>::get(0).unwrap();
            assert!(pan.is_public);
            assert!(PublicPans::<Test>::contains_key(0));

            // 设置为私密
            assert_ok!(DaLiuRen::set_pan_visibility(
                RuntimeOrigin::signed(ALICE),
                0,
                false
            ));

            let pan = Pans::<Test>::get(0).unwrap();
            assert!(!pan.is_public);
            assert!(!PublicPans::<Test>::contains_key(0));
        });
    }

    #[test]
    fn test_set_visibility_not_authorized() {
        new_test_ext().execute_with(|| {
            // Alice 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // Bob 尝试修改，应失败
            assert_noop!(
                DaLiuRen::set_pan_visibility(RuntimeOrigin::signed(BOB), 0, true),
                Error::<Test>::NotAuthorized
            );
        });
    }

    #[test]
    fn test_request_ai_interpretation() {
        new_test_ext().execute_with(|| {
            // 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // 请求 AI 解读
            assert_ok!(DaLiuRen::request_ai_interpretation(
                RuntimeOrigin::signed(ALICE),
                0
            ));

            // 验证请求已记录
            assert!(AiInterpretationRequests::<Test>::contains_key(0));

            // 验证统计更新
            let stats = UserStatsStorage::<Test>::get(ALICE);
            assert_eq!(stats.ai_interpretations, 1);
        });
    }

    #[test]
    fn test_request_ai_interpretation_not_owner() {
        new_test_ext().execute_with(|| {
            // Alice 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // Bob 请求解读，应失败
            assert_noop!(
                DaLiuRen::request_ai_interpretation(RuntimeOrigin::signed(BOB), 0),
                Error::<Test>::NotAuthorized
            );
        });
    }

    #[test]
    fn test_submit_ai_interpretation() {
        new_test_ext().execute_with(|| {
            // 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // 请求 AI 解读
            assert_ok!(DaLiuRen::request_ai_interpretation(
                RuntimeOrigin::signed(ALICE),
                0
            ));

            // 提交解读结果（需要 signed 权限）
            let cid: BoundedVec<u8, TestMaxCidLen> =
                BoundedVec::try_from(b"QmInterpretation".to_vec()).unwrap();

            assert_ok!(DaLiuRen::submit_ai_interpretation(
                RuntimeOrigin::signed(AI_SERVICE),
                0,
                cid.clone()
            ));

            // 验证解读已存储
            let pan = Pans::<Test>::get(0).unwrap();
            assert_eq!(pan.ai_interpretation_cid, Some(cid));

            // 验证请求已移除
            assert!(!AiInterpretationRequests::<Test>::contains_key(0));
        });
    }

    #[test]
    fn test_submit_ai_without_request() {
        new_test_ext().execute_with(|| {
            // 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            let cid: BoundedVec<u8, TestMaxCidLen> =
                BoundedVec::try_from(b"QmInterpretation".to_vec()).unwrap();

            // 未请求直接提交，应失败
            assert_noop!(
                DaLiuRen::submit_ai_interpretation(RuntimeOrigin::signed(AI_SERVICE), 0, cid),
                Error::<Test>::AiInterpretationNotRequested
            );
        });
    }

    #[test]
    fn test_pan_not_found() {
        new_test_ext().execute_with(|| {
            // 设置不存在的式盘
            assert_noop!(
                DaLiuRen::set_pan_visibility(RuntimeOrigin::signed(ALICE), 999, true),
                Error::<Test>::PanNotFound
            );

            // 请求不存在的式盘解读
            assert_noop!(
                DaLiuRen::request_ai_interpretation(RuntimeOrigin::signed(ALICE), 999),
                Error::<Test>::PanNotFound
            );
        });
    }

    #[test]
    fn test_ke_shi_types() {
        new_test_ext().execute_with(|| {
            // 测试不同日干支组合产生不同课式
            let test_cases = vec![
                ((0, 0), 6, 0),  // 甲子日
                ((4, 4), 6, 0),  // 戊辰日
                ((0, 2), 6, 0),  // 甲寅日（八专日）
                ((6, 8), 6, 0),  // 庚申日（八专日）
            ];

            for (i, (day_gz, yue_jiang, zhan_shi)) in test_cases.iter().enumerate() {
                assert_ok!(DaLiuRen::divine_by_time(
                    RuntimeOrigin::signed(ALICE),
                    (0, 0),
                    (0, 0),
                    *day_gz,
                    (0, 0),
                    *yue_jiang,
                    *zhan_shi,
                    true,
                    None,
                ));

                let pan = Pans::<Test>::get(i as u64).unwrap();
                // 验证课式和格局不为默认值（至少有一个被设置）
                assert!(
                    pan.ke_shi != KeShiType::default() || pan.ge_ju != GeJuType::default(),
                    "Case {} should have valid ke_shi or ge_ju",
                    i
                );
            }
        });
    }

    #[test]
    fn test_query_functions() {
        new_test_ext().execute_with(|| {
            // 创建式盘
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // 测试查询函数
            assert!(DaLiuRen::get_pan(0).is_some());
            assert!(DaLiuRen::get_pan(999).is_none());

            assert!(DaLiuRen::is_user_pan(&ALICE, 0));
            assert!(!DaLiuRen::is_user_pan(&BOB, 0));

            assert!(!DaLiuRen::has_pending_ai_request(0));

            // 请求 AI 解读后
            assert_ok!(DaLiuRen::request_ai_interpretation(
                RuntimeOrigin::signed(ALICE),
                0
            ));
            assert!(DaLiuRen::has_pending_ai_request(0));
        });
    }
}

// ============================================================================
// 边界情况测试
// ============================================================================

mod edge_case_tests {
    use super::*;

    #[test]
    fn test_all_tian_gan_combinations() {
        new_test_ext().execute_with(|| {
            // 测试所有十天干
            for gan_idx in 0..10u8 {
                assert_ok!(DaLiuRen::divine_by_time(
                    RuntimeOrigin::signed(ALICE),
                    (gan_idx, 0),
                    (gan_idx, 0),
                    (gan_idx, 0),
                    (gan_idx, 0),
                    6,
                    0,
                    true,
                    None,
                ));
            }

            assert_eq!(NextPanId::<Test>::get(), 10);
        });
    }

    #[test]
    fn test_all_di_zhi_combinations() {
        new_test_ext().execute_with(|| {
            // 测试所有十二地支
            for zhi_idx in 0..12u8 {
                assert_ok!(DaLiuRen::divine_by_time(
                    RuntimeOrigin::signed(ALICE),
                    (0, zhi_idx),
                    (0, zhi_idx),
                    (0, zhi_idx),
                    (0, zhi_idx),
                    zhi_idx,
                    zhi_idx,
                    true,
                    None,
                ));
            }

            assert_eq!(NextPanId::<Test>::get(), 12);
        });
    }

    #[test]
    fn test_day_night_difference() {
        new_test_ext().execute_with(|| {
            // 昼占
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                true, // 昼占
                None,
            ));

            // 夜占
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0),
                (0, 0),
                6,
                0,
                false, // 夜占
                None,
            ));

            let pan_day = Pans::<Test>::get(0).unwrap();
            let pan_night = Pans::<Test>::get(1).unwrap();

            // 昼夜贵人不同，天将盘应不同
            assert!(pan_day.is_day);
            assert!(!pan_night.is_day);
            // 天将盘的逆顺可能不同
        });
    }

    #[test]
    fn test_special_days() {
        new_test_ext().execute_with(|| {
            // 测试八专日：甲寅、庚申、丁未、己未

            // 甲寅日
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 2), // 甲寅
                (0, 0),
                6,
                0,
                true,
                None,
            ));

            // 庚申日
            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (6, 8), // 庚申
                (0, 0),
                6,
                0,
                true,
                None,
            ));
        });
    }

    #[test]
    fn test_fu_yin_course() {
        new_test_ext().execute_with(|| {
            // 伏吟课条件：支阳神等于日支
            // 需要月将加占时后，日支上神为日支本身
            // 例如：子加子，子位上为子

            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0), // 甲子日
                (0, 0),
                0,      // 月将子
                0,      // 占时子
                true,
                None,
            ));

            let pan = Pans::<Test>::get(0).unwrap();
            // 子加子，所有位置天盘与地盘相同
            assert_eq!(pan.ke_shi, KeShiType::FuYin);
        });
    }

    #[test]
    fn test_fan_yin_course() {
        new_test_ext().execute_with(|| {
            // 返吟课条件：支阳神冲日支
            // 午加子，子位上为午，午冲子

            assert_ok!(DaLiuRen::divine_by_time(
                RuntimeOrigin::signed(ALICE),
                (0, 0),
                (0, 0),
                (0, 0), // 甲子日
                (0, 0),
                6,      // 月将午
                0,      // 占时子
                true,
                None,
            ));

            let pan = Pans::<Test>::get(0).unwrap();
            // 午加子，子位上为午，午冲子，为返吟
            assert_eq!(pan.ke_shi, KeShiType::FanYin);
        });
    }
}
