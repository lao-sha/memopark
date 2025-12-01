//! 梅花易数 Pallet 单元测试
//!
//! 测试核心功能：
//! - 时间起卦
//! - 双数起卦
//! - 随机起卦
//! - 手动起卦
//! - AI 解卦请求
//! - 卦象公开状态管理

use crate::{mock::*, Error, pallet::Event};
use crate::types::{Bagua, DivinationMethod};
use frame_support::{assert_noop, assert_ok, BoundedVec};

/// 测试时间起卦基本功能
#[test]
fn divine_by_time_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 执行时间起卦
        assert_ok!(Meihua::divine_by_time(
            RuntimeOrigin::signed(1),
            question_hash,
            false
        ));

        // 验证卦象创建
        assert_eq!(Meihua::next_hexagram_id(), 1);

        // 验证卦象存储
        let hexagram = Meihua::hexagrams(0).expect("Hexagram should exist");
        assert_eq!(hexagram.ben_gua.id, 0);
        assert_eq!(hexagram.ben_gua.diviner, 1);
        assert!(!hexagram.ben_gua.is_public);

        // 验证用户索引
        let user_hexagrams = Meihua::user_hexagrams(1);
        assert_eq!(user_hexagrams.len(), 1);
        assert_eq!(user_hexagrams[0], 0);
    });
}

/// 测试双数起卦
#[test]
fn divine_by_numbers_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [1u8; 32];

        assert_ok!(Meihua::divine_by_numbers(
            RuntimeOrigin::signed(2),
            88,
            66,
            question_hash,
            true
        ));

        // 验证公开卦象
        let hexagram = Meihua::hexagrams(0).unwrap();
        assert!(hexagram.ben_gua.is_public);

        // 验证公开列表
        let public_list = Meihua::public_hexagrams();
        assert_eq!(public_list.len(), 1);
    });
}

/// 测试随机起卦
#[test]
fn divine_random_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [2u8; 32];

        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(3),
            question_hash,
            false
        ));

        let hexagram = Meihua::hexagrams(0).unwrap();
        assert_eq!(hexagram.ben_gua.diviner, 3);

        // 验证卦数有效（1-8）
        assert!(hexagram.ben_gua.shang_gua.number() >= 1 && hexagram.ben_gua.shang_gua.number() <= 8);
        assert!(hexagram.ben_gua.xia_gua.number() >= 1 && hexagram.ben_gua.xia_gua.number() <= 8);
        // 验证动爻有效（1-6）
        assert!(hexagram.ben_gua.dong_yao >= 1 && hexagram.ben_gua.dong_yao <= 6);
    });
}

/// 测试手动起卦
#[test]
fn divine_manual_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [3u8; 32];

        // 手动指定：乾上坤下，动爻 3
        assert_ok!(Meihua::divine_manual(
            RuntimeOrigin::signed(1),
            1, // 乾
            8, // 坤
            3, // 第三爻
            question_hash,
            false
        ));

        let hexagram = Meihua::hexagrams(0).unwrap();

        // 验证卦象
        assert_eq!(hexagram.ben_gua.shang_gua.bagua, Bagua::Qian);
        assert_eq!(hexagram.ben_gua.xia_gua.bagua, Bagua::Kun);
        assert_eq!(hexagram.ben_gua.dong_yao, 3);

        // 动爻 3 在下卦，下卦为用，上卦为体
        assert!(hexagram.ben_gua.ti_is_shang);
    });
}

/// 测试无效参数
#[test]
fn divine_manual_invalid_params() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 无效卦数
        assert_noop!(
            Meihua::divine_manual(
                RuntimeOrigin::signed(1),
                0, // 无效
                1,
                1,
                question_hash,
                false
            ),
            Error::<Test>::InvalidGuaNum
        );

        // 无效动爻
        assert_noop!(
            Meihua::divine_manual(
                RuntimeOrigin::signed(1),
                1,
                1,
                7, // 无效，应为 1-6
                question_hash,
                false
            ),
            Error::<Test>::InvalidDongYao
        );
    });
}

/// 测试每日限制
#[test]
fn daily_limit_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 连续起卦直到达到限制
        for _ in 0..50 {
            assert_ok!(Meihua::divine_random(
                RuntimeOrigin::signed(1),
                question_hash,
                false
            ));
        }

        // 第 51 次应该失败
        assert_noop!(
            Meihua::divine_random(RuntimeOrigin::signed(1), question_hash, false),
            Error::<Test>::DailyLimitExceeded
        );

        // 不同用户不受影响
        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(2),
            question_hash,
            false
        ));
    });
}

/// 测试卦象公开状态切换
#[test]
fn set_visibility_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 创建私密卦象
        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(1),
            question_hash,
            false
        ));

        // 设置为公开
        assert_ok!(Meihua::set_hexagram_visibility(
            RuntimeOrigin::signed(1),
            0,
            true
        ));

        // 验证
        let hexagram = Meihua::hexagrams(0).unwrap();
        assert!(hexagram.ben_gua.is_public);
        assert_eq!(Meihua::public_hexagrams().len(), 1);

        // 设置为私密
        assert_ok!(Meihua::set_hexagram_visibility(
            RuntimeOrigin::signed(1),
            0,
            false
        ));

        let hexagram = Meihua::hexagrams(0).unwrap();
        assert!(!hexagram.ben_gua.is_public);
        assert_eq!(Meihua::public_hexagrams().len(), 0);
    });
}

/// 测试非所有者无法修改
#[test]
fn not_owner_cannot_modify() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 用户 1 创建卦象
        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(1),
            question_hash,
            false
        ));

        // 用户 2 尝试修改
        assert_noop!(
            Meihua::set_hexagram_visibility(RuntimeOrigin::signed(2), 0, true),
            Error::<Test>::NotOwner
        );
    });
}

/// 测试 AI 解卦请求
#[test]
fn ai_interpretation_request_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 创建卦象
        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(1),
            question_hash,
            false
        ));

        // 请求 AI 解卦
        assert_ok!(Meihua::request_ai_interpretation(
            RuntimeOrigin::signed(1),
            0
        ));

        // 验证请求已记录
        assert!(Meihua::ai_interpretation_requests(0).is_some());

        // 不能重复请求
        assert_noop!(
            Meihua::request_ai_interpretation(RuntimeOrigin::signed(1), 0),
            Error::<Test>::AiRequestAlreadyExists
        );
    });
}

/// 测试 AI 解卦结果提交
#[test]
fn ai_interpretation_submit_works() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 创建卦象并请求 AI 解卦
        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(1),
            question_hash,
            false
        ));
        assert_ok!(Meihua::request_ai_interpretation(
            RuntimeOrigin::signed(1),
            0
        ));

        // AI 预言机提交结果（使用账户 1 模拟预言机）
        let cid: BoundedVec<u8, frame_support::traits::ConstU32<64>> =
            BoundedVec::try_from(b"QmTestCid123456789".to_vec()).unwrap();

        assert_ok!(Meihua::submit_ai_interpretation(
            RuntimeOrigin::signed(1), // 模拟预言机账户
            0,
            cid.clone()
        ));

        // 验证结果已存储
        let hexagram = Meihua::hexagrams(0).unwrap();
        assert_eq!(hexagram.ben_gua.interpretation_cid, Some(cid));

        // 请求已被移除
        assert!(Meihua::ai_interpretation_requests(0).is_none());
    });
}

/// 测试完整卦象计算
#[test]
fn full_divination_calculation() {
    new_test_ext().execute_with(|| {
        let question_hash = [0u8; 32];

        // 手动指定一个已知卦象进行验证
        // 火雷噬嗑：离上(3)震下(4)，动爻 6
        assert_ok!(Meihua::divine_manual(
            RuntimeOrigin::signed(1),
            3, // 离
            4, // 震
            6, // 第六爻
            question_hash,
            false
        ));

        let hexagram = Meihua::hexagrams(0).unwrap();

        // 验证本卦
        assert_eq!(hexagram.ben_gua.shang_gua.bagua, Bagua::Li);
        assert_eq!(hexagram.ben_gua.xia_gua.bagua, Bagua::Zhen);

        // 动爻 6 在上卦，上卦为用，下卦为体
        assert!(!hexagram.ben_gua.ti_is_shang);

        // 验证变卦（离 101 翻转第6位 -> 001 震）
        assert_eq!(hexagram.bian_gua.0.bagua, Bagua::Zhen); // 变卦上卦
        assert_eq!(hexagram.bian_gua.1.bagua, Bagua::Zhen); // 变卦下卦不变

        // 验证互卦
        // 本卦二进制：上卦 101，下卦 001 -> 101001
        // 互卦上卦取 5,4,3 爻 -> 010 -> 坎
        // 互卦下卦取 4,3,2 爻 -> 100 -> 艮
        assert_eq!(hexagram.hu_gua.0.bagua, Bagua::Kan);
        assert_eq!(hexagram.hu_gua.1.bagua, Bagua::Gen);
    });
}

/// 测试事件发送
#[test]
fn events_are_emitted() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let question_hash = [0u8; 32];

        assert_ok!(Meihua::divine_random(
            RuntimeOrigin::signed(1),
            question_hash,
            false
        ));

        // 检查事件
        System::assert_has_event(
            Event::<Test>::HexagramCreated {
                hexagram_id: 0,
                diviner: 1,
                method: DivinationMethod::Random,
            }
            .into(),
        );
    });
}
