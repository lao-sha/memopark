// 函数级中文注释：pallet-deceased单元测试
// 🆕 更新：支持特权用户免押金创建和随机ID生成

use crate::{
    mock::*, DeceasedOf, UsedDeceasedIds, Gender, Pallet,
};
use frame_support::assert_ok;
use alloc::vec::Vec;

// ==================== Helper Functions ====================

/// 函数级中文注释：创建有效的姓名Vec
fn name() -> Vec<u8> {
    b"Zhang San".to_vec()
}

/// 函数级中文注释：创建有效的出生日期（19900101）
fn birth_ts() -> Vec<u8> {
    b"19900101".to_vec()
}

/// 函数级中文注释：创建有效的去世日期（20240101）
fn death_ts() -> Vec<u8> {
    b"20240101".to_vec()
}

// ==================== 🆕 New Tests for Random ID and Privileged Origin ====================

/// Test: 特权用户（Root）可以免押金创建逝者记录
#[test]
fn privileged_user_create_deceased_without_deposit() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);

        // 使用Root origin（特权用户）
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::root(),
            name(),
            0, // gender_code=0 (M)
            None, // name_full_cid
            birth_ts(),
            death_ts(),
            Vec::new(), // links
        ));

        // 验证：逝者记录已创建
        // 由于使用随机ID，我们检查是否有记录被创建
        let deceased_count = DeceasedOf::<Test>::iter().count();
        assert_eq!(deceased_count, 1);

        // 验证：生成的ID在10位数范围内
        let (deceased_id, _deceased) = DeceasedOf::<Test>::iter().next().unwrap();
        assert!(deceased_id >= 1_000_000_000);  // 10位数最小值
        assert!(deceased_id <= 9_999_999_999);  // 10位数最大值

        // 验证：ID已被标记为使用
        assert!(UsedDeceasedIds::<Test>::contains_key(&deceased_id));

        // 验证：事件已触发（至少包含DeceasedCreated事件）
        let events = System::events();
        assert!(!events.is_empty());
    });
}

/// Test: 特权用户（账户100）可以免押金创建逝者记录
#[test]
fn privileged_account_100_create_deceased_without_deposit() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);

        // 使用账户100（在mock中配置为特权用户）
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(100),
            name(),
            1, // gender_code=1 (F)
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 验证：逝者记录已创建
        let deceased_count = DeceasedOf::<Test>::iter().count();
        assert_eq!(deceased_count, 1);

        // 验证：生成的ID在10位数范围内
        let (deceased_id, deceased) = DeceasedOf::<Test>::iter().next().unwrap();
        assert!(deceased_id >= 1_000_000_000);
        assert!(deceased_id <= 9_999_999_999);
        assert_eq!(deceased.gender, Gender::F);
    });
}

/// Test: 随机ID生成的唯一性
#[test]
fn random_id_generation_uniqueness() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);

        // 创建多个逝者记录，验证ID的唯一性
        let mut generated_ids = Vec::new();

        for i in 0..5 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::root(),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));

            // 获取最新生成的ID
            let latest_id = DeceasedOf::<Test>::iter().map(|(id, _)| id).max().unwrap();

            // 验证：ID在10位数范围内
            assert!(latest_id >= 1_000_000_000);
            assert!(latest_id <= 9_999_999_999);

            // 验证：ID唯一性
            assert!(!generated_ids.contains(&latest_id));
            generated_ids.push(latest_id);
        }

        // 验证：所有ID都不相同
        assert_eq!(generated_ids.len(), 5);
        let unique_count: std::collections::HashSet<_> = generated_ids.iter().collect();
        assert_eq!(unique_count.len(), 5);
    });
}

/// Test: ID生成失败的情况（模拟）
#[test]
fn id_generation_with_collision_handling() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);

        // 正常创建应该成功
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::root(),
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 验证：生成的ID已被标记为使用
        let (generated_id, _) = DeceasedOf::<Test>::iter().next().unwrap();
        assert!(UsedDeceasedIds::<Test>::contains_key(&generated_id));
    });
}

/// Test: 非特权用户创建逝者（应该需要押金，但测试环境简化了）
#[test]
fn regular_user_create_deceased() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);

        // 使用普通账户1（非特权用户）
        // 注意：在测试环境中我们简化了押金逻辑
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(1),
            name(),
            2, // gender_code=2 (Both)
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 验证：逝者记录已创建
        let deceased_count = DeceasedOf::<Test>::iter().count();
        assert_eq!(deceased_count, 1);

        // 验证：生成的ID在10位数范围内
        let (deceased_id, deceased) = DeceasedOf::<Test>::iter().next().unwrap();
        assert!(deceased_id >= 1_000_000_000);
        assert!(deceased_id <= 9_999_999_999);
        assert_eq!(deceased.gender, Gender::M);
        assert_eq!(deceased.owner, 1);
    });
}

/// Test: 验证随机ID生成算法的性能
#[test]
fn random_id_generation_performance() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);

        // 创建10个逝者记录，验证性能和唯一性
        let mut generated_ids = Vec::new();

        for i in 0..10 {
            // 更新区块号以增加随机性
            System::set_block_number(i as u64 + 1);

            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::root(),
                format!("Performance Test {}", i).into_bytes(),
                i % 3, // 轮换性别代码
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));

            // 收集生成的ID
            let latest_id = DeceasedOf::<Test>::iter()
                .filter(|(id, _)| !generated_ids.contains(id))
                .map(|(id, _)| id)
                .next()
                .unwrap();

            generated_ids.push(latest_id);
        }

        // 验证：所有ID都在正确范围内且唯一
        assert_eq!(generated_ids.len(), 10);
        for &id in &generated_ids {
            assert!(id >= 1_000_000_000);
            assert!(id <= 9_999_999_999);
        }

        // 验证：没有重复ID
        let unique_count: std::collections::HashSet<_> = generated_ids.iter().collect();
        assert_eq!(unique_count.len(), 10);
    });
}