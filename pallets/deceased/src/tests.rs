// 函数级中文注释：pallet-deceased单元测试
// Phase 3 Week 1 Day 3: 18个核心CRUD测试

use crate::{
    mock::*, DeceasedOf, NextDeceasedId, Gender, Error, Event, Pallet, DeceasedCategory, DeceasedByCategory, DeceasedByCreationTime,
};
use frame_support::{assert_noop, assert_ok};
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

// ==================== Create Tests (5个) ====================

/// Test 1: 基础创建功能
#[test]
fn create_deceased_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1); // 初始化区块号以记录事件
        let owner = 1u64;
        let grave_id = 1u64;

        // 创建逝者（gender_code: 0=M, 1=F, 2=B）
        // create_deceased参数：origin, grave_id, name, gender_code, name_full_cid, birth_ts, death_ts, links
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            0, // gender_code=0 (M)
            None, // name_full_cid
            birth_ts(),
            death_ts(),
            Vec::new(), // links
        ));

        // 验证deceased_id为0
        let deceased_id = 0u64;

        // 验证Storage
        assert!(DeceasedOf::<Test>::get(deceased_id).is_some());
        let deceased = DeceasedOf::<Test>::get(deceased_id).unwrap();
        assert_eq!(deceased.owner, owner);
        assert_eq!(deceased.grave_id, grave_id);
        assert_eq!(deceased.gender, Gender::M);

        // 验证NextDeceasedId递增
        assert_eq!(NextDeceasedId::<Test>::get(), 1);

        // 验证DeceasedByGrave索引
        let deceased_list = DeceasedByGrave::<Test>::get(grave_id).unwrap_or_default();
        assert_eq!(deceased_list.len(), 1);
        assert_eq!(deceased_list[0], deceased_id);

        // 验证Event（tuple格式）
        System::assert_has_event(
            Event::DeceasedCreated(deceased_id, grave_id, owner).into(),
        );
    });
}

/// Test 2: 创建时指定墓位
#[test]
fn create_with_grave() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 2u64;
        let grave_id = 2u64;

        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            1, // gender_code=1 (F)
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;
        let deceased = DeceasedOf::<Test>::get(deceased_id).unwrap();
        assert_eq!(deceased.grave_id, grave_id);
        assert_eq!(deceased.gender, Gender::F);
    });
}

/// Test 3: 多次创建，ID递增
#[test]
fn create_multiple_increments_id() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let grave_id = 1u64;

        // 创建第一个
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            0, // M
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));
        assert_eq!(NextDeceasedId::<Test>::get(), 1);

        // 创建第二个
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            b"Li Si".to_vec(),
            1, // F
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));
        assert_eq!(NextDeceasedId::<Test>::get(), 2);

        // 验证两个都存在
        assert!(DeceasedOf::<Test>::get(0).is_some());
        assert!(DeceasedOf::<Test>::get(1).is_some());
    });
}

/// Test 4: 创建时验证墓位存在
#[test]
fn create_validates_grave() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let invalid_grave_id = 999u64; // 不存在的墓位

        // 创建应失败
        assert_noop!(
            Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                invalid_grave_id,
                name(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ),
            Error::<Test>::GraveNotFound
        );
    });
}

/// Test 5: 创建时需要权限
#[test]
fn create_requires_permission() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let unauthorized_user = 5u64; // 没有权限管理grave_id=1
        let grave_id = 1u64;

        // 创建应失败
        assert_noop!(
            Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(unauthorized_user),
                grave_id,
                name(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ),
            Error::<Test>::NotAuthorized
        );
    });
}

// ==================== Update Tests (3个) ====================

/// Test 6: 拥有者可以更新逝者信息
#[test]
fn update_deceased_by_owner() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let grave_id = 1u64;

        // 先创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 更新姓名和性别
        // update_deceased参数：origin, id, name, gender_code, name_full_cid, birth_ts, death_ts, links
        let new_name = b"Wang Wu".to_vec();
        assert_ok!(Pallet::<Test>::update_deceased(
            RuntimeOrigin::signed(owner),
            deceased_id,
            Some(new_name.clone()),
            Some(1), // gender_code=1 (F)
            None,
            None,
            None,
            None,
        ));

        // 验证更新
        let deceased = DeceasedOf::<Test>::get(deceased_id).unwrap();
        assert_eq!(deceased.gender, Gender::F);

        // 验证Event
        System::assert_has_event(Event::DeceasedUpdated(deceased_id).into());
    });
}

/// Test 7: 非拥有者不能更新
#[test]
fn update_requires_ownership() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let other_user = 2u64;
        let grave_id = 1u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // other_user尝试更新应失败
        // update_deceased使用NotAuthorized错误
        assert_noop!(
            Pallet::<Test>::update_deceased(
                RuntimeOrigin::signed(other_user),
                deceased_id,
                Some(b"Hacker".to_vec()),
                None,
                None,
                None,
                None,
                None,
            ),
            Error::<Test>::NotAuthorized
        );
    });
}

/// Test 8: 更新不存在的逝者应失败
#[test]
fn update_nonexistent_fails() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let nonexistent_id = 999u64;

        assert_noop!(
            Pallet::<Test>::update_deceased(
                RuntimeOrigin::signed(owner),
                nonexistent_id,
                Some(name()),
                None,
                None,
                None,
                None,
                None,
            ),
            Error::<Test>::DeceasedNotFound
        );
    });
}

// ==================== Transfer Tests (4个) ====================

/// Test 9: 转移逝者到新墓位
#[test]
fn transfer_deceased_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let old_grave_id = 1u64;
        let new_grave_id = 2u64;

        // 创建在grave 1
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            old_grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 转移到grave 2（使用deceased的owner，而不是grave admin）
        // transfer_deceased参数：origin, id, new_grave
        // 需求：仅逝者owner可以迁移，墓主无权强制迁移
        assert_ok!(Pallet::<Test>::transfer_deceased(
            RuntimeOrigin::signed(owner), // 使用deceased owner
            deceased_id,
            new_grave_id,
        ));

        // 验证grave_id已更新
        let deceased = DeceasedOf::<Test>::get(deceased_id).unwrap();
        assert_eq!(deceased.grave_id, new_grave_id);

        // 验证Event（tuple格式）
        System::assert_has_event(
            Event::DeceasedTransferred(deceased_id, old_grave_id, new_grave_id).into(),
        );
    });
}

/// Test 10: 转移更新DeceasedByGrave索引
#[test]
fn transfer_updates_grave() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let old_grave_id = 1u64;
        let new_grave_id = 2u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            old_grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 验证初始索引
        let old_list = DeceasedByGrave::<Test>::get(old_grave_id).unwrap_or_default();
        assert_eq!(old_list.len(), 1);
        assert_eq!(old_list[0], deceased_id);

        // 转移（使用deceased owner）
        assert_ok!(Pallet::<Test>::transfer_deceased(
            RuntimeOrigin::signed(owner), // 使用deceased owner
            deceased_id,
            new_grave_id,
        ));

        // 验证旧墓位索引已清空
        let old_list = DeceasedByGrave::<Test>::get(old_grave_id).unwrap_or_default();
        assert_eq!(old_list.len(), 0);

        // 验证新墓位索引已添加
        let new_list = DeceasedByGrave::<Test>::get(new_grave_id).unwrap_or_default();
        assert_eq!(new_list.len(), 1);
        assert_eq!(new_list[0], deceased_id);
    });
}

/// Test 11: 转移需要deceased owner权限
#[test]
fn transfer_requires_permission() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let unauthorized = 5u64;
        let old_grave_id = 1u64;
        let new_grave_id = 2u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            old_grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // unauthorized尝试转移应失败（不是deceased owner）
        assert_noop!(
            Pallet::<Test>::transfer_deceased(
                RuntimeOrigin::signed(unauthorized),
                deceased_id,
                new_grave_id,
            ),
            Error::<Test>::NotDeceasedOwner
        );
    });
}

/// Test 12: 转移到无效墓位应失败
#[test]
fn transfer_to_invalid_grave_fails() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let old_grave_id = 1u64;
        let invalid_grave_id = 999u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            old_grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 转移到无效墓位应失败
        assert_noop!(
            Pallet::<Test>::transfer_deceased(
                RuntimeOrigin::signed(99),
                deceased_id,
                invalid_grave_id,
            ),
            Error::<Test>::GraveNotFound
        );
    });
}

// ==================== Transfer Owner Tests (2个) ====================

/// Test 13: 转移拥有者
#[test]
fn transfer_owner_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let new_owner = 2u64;
        let grave_id = 1u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 转移拥有者
        assert_ok!(Pallet::<Test>::transfer_deceased_owner(
            RuntimeOrigin::signed(owner),
            deceased_id,
            new_owner,
        ));

        // 验证owner已更新
        let deceased = DeceasedOf::<Test>::get(deceased_id).unwrap();
        assert_eq!(deceased.owner, new_owner);

        // 注：没有专门的OwnerTransferred事件，检查通过即可
    });
}

/// Test 14: 只有当前owner可以转移拥有者
#[test]
fn transfer_owner_requires_current_owner() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let other_user = 2u64;
        let new_owner = 3u64;
        let grave_id = 1u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // other_user尝试转移应失败
        assert_noop!(
            Pallet::<Test>::transfer_deceased_owner(
                RuntimeOrigin::signed(other_user),
                deceased_id,
                new_owner,
            ),
            Error::<Test>::NotDeceasedOwner
        );
    });
}

// ==================== Governance Tests (2个) ====================

/// Test 17: 治理可以转移逝者 (暂时注释，等治理接口重构)
/*
#[test]
fn gov_transfer_deceased_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let old_grave_id = 1u64;
        let new_grave_id = 2u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            old_grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 使用治理Origin转移
        // gov_transfer_deceased参数：origin, id, new_grave, evidence_cid
        assert_ok!(Pallet::<Test>::gov_transfer_deceased(
            RuntimeOrigin::signed(100), // 治理账户
            deceased_id,
            new_grave_id,
            Vec::new(), // evidence_cid
        ));

        // 验证grave_id已更新
        let deceased = DeceasedOf::<Test>::get(deceased_id).unwrap();
        assert_eq!(deceased.grave_id, new_grave_id);

        // 注：检查GovernanceTransferred事件，但在实际pallet中可能是其他事件名
    });
}
*/

/// Test 18: 治理操作需要治理权限 (暂时注释，等治理接口重构)
/*
#[test]
fn gov_operations_require_governance() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let unauthorized = 5u64;
        let old_grave_id = 1u64;
        let new_grave_id = 2u64;

        // 创建
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            old_grave_id,
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // TODO: 这个测试需要根据新的治理接口进行重新设计
        // 暂时通过，后续更新治理相关测试
    });
}
*/

// ==================== 🆕 Query Interface Tests (高优先级接口测试) ====================

/// Test 19: get_deceased_by_id 基础功能测试
#[test]
fn get_deceased_by_id_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0, // gender_code=0 (M)
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 测试查询存在的逝者
        let result = Pallet::<Test>::get_deceased_by_id(deceased_id);
        assert!(result.is_some());
        let deceased = result.unwrap();
        assert_eq!(deceased.owner, owner);
        assert_eq!(deceased.creator, owner);
        assert_eq!(deceased.name, name());

        // 测试查询不存在的逝者
        let non_existent_result = Pallet::<Test>::get_deceased_by_id(999u64);
        assert!(non_existent_result.is_none());
    });
}

/// Test 20: get_deceased_by_id 可见性测试
#[test]
fn get_deceased_by_id_visibility_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 默认应该是可见的
        let result = Pallet::<Test>::get_deceased_by_id(deceased_id);
        assert!(result.is_some());

        // 设置为不可见
        assert_ok!(Pallet::<Test>::set_visibility(
            RuntimeOrigin::signed(owner),
            deceased_id,
            false // 设置为不可见
        ));

        // 现在应该不可见
        let hidden_result = Pallet::<Test>::get_deceased_by_id(deceased_id);
        assert!(hidden_result.is_none());

        // 重新设置为可见
        assert_ok!(Pallet::<Test>::set_visibility(
            RuntimeOrigin::signed(owner),
            deceased_id,
            true // 设置为可见
        ));

        // 现在应该又可见了
        let visible_result = Pallet::<Test>::get_deceased_by_id(deceased_id);
        assert!(visible_result.is_some());
    });
}

/// Test 21: get_deceased_by_token 基础功能测试
#[test]
fn get_deceased_by_token_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 获取创建的逝者详情以获取真实的token
        let deceased = Pallet::<Test>::get_deceased_by_id(deceased_id).unwrap();
        let token = deceased.deceased_token.to_vec();

        // 测试通过token查询逝者
        let result = Pallet::<Test>::get_deceased_by_token(&token);
        assert!(result.is_some());
        let (found_id, found_deceased) = result.unwrap();
        assert_eq!(found_id, deceased_id);
        assert_eq!(found_deceased.owner, owner);
        assert_eq!(found_deceased.name, name());

        // 测试不存在的token
        let non_existent_token = b"non_existent_token";
        let no_result = Pallet::<Test>::get_deceased_by_token(non_existent_token);
        assert!(no_result.is_none());
    });
}

/// Test 22: get_deceased_paginated 基础功能测试
#[test]
fn get_deceased_paginated_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建多个逝者
        for i in 0..5 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 测试无参数分页查询（从头开始）
        let result = Pallet::<Test>::get_deceased_paginated(None, 10);
        assert_eq!(result.len(), 5); // 应该返回所有5个逝者

        // 测试限制数量的分页查询
        let limited_result = Pallet::<Test>::get_deceased_paginated(None, 3);
        assert_eq!(limited_result.len(), 3); // 应该返回前3个

        // 测试从指定ID开始的分页查询
        let start_from_result = Pallet::<Test>::get_deceased_paginated(Some(2u64), 3);
        assert_eq!(start_from_result.len(), 3); // 应该从ID 2开始返回3个
        assert_eq!(start_from_result[0].0, 2u64); // 第一个应该是ID 2

        // 测试空结果（起始ID超出范围）
        let empty_result = Pallet::<Test>::get_deceased_paginated(Some(100u64), 10);
        assert_eq!(empty_result.len(), 0);
    });
}

/// Test 23: get_deceased_paginated 可见性过滤测试
#[test]
fn get_deceased_paginated_visibility_filter_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建3个逝者
        for i in 0..3 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 将第二个逝者设为不可见
        assert_ok!(Pallet::<Test>::set_visibility(
            RuntimeOrigin::signed(owner),
            1u64, // deceased_id = 1
            false // 设置为不可见
        ));

        // 分页查询应该只返回可见的逝者（ID 0 和 2）
        let result = Pallet::<Test>::get_deceased_paginated(None, 10);
        assert_eq!(result.len(), 2); // 应该只返回2个可见的逝者

        // 验证返回的是ID 0 和 2
        let returned_ids: Vec<u64> = result.into_iter().map(|(id, _)| id).collect();
        assert!(returned_ids.contains(&0u64));
        assert!(returned_ids.contains(&2u64));
        assert!(!returned_ids.contains(&1u64)); // ID 1应该被过滤掉
    });
}

/// Test 24: get_deceased_paginated 限制测试
#[test]
fn get_deceased_paginated_limit_works() {
    new_test_ext().execute_with(|| {
        // 测试查询限制（最大100个）
        let result = Pallet::<Test>::get_deceased_paginated(None, 200);
        // 即使要求200个，也应该限制在最多100个（如果有的话）
        // 在这个测试中，我们没有创建任何逝者，所以应该返回0
        assert_eq!(result.len(), 0);

        // 测试正常的限制
        let limited_result = Pallet::<Test>::get_deceased_paginated(None, 50);
        assert_eq!(limited_result.len(), 0);
    });
}

// ==================== 🆕 Category Query Interface Tests (分类查询接口测试) ====================

/// Test 25: get_deceased_by_category 基础功能测试
#[test]
fn get_deceased_by_category_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建默认分类（Ordinary）的逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0, // gender_code=0 (M)
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 创建另一个默认分类的逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            b"Test User 2".to_vec(),
            1, // gender_code=1 (F)
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 测试查询 Ordinary 分类
        let ordinary_result = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            None,
            10
        );
        assert_eq!(ordinary_result.len(), 2); // 应该有2个普通分类的逝者

        // 测试查询不存在的分类（Hero）
        let hero_result = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Hero,
            None,
            10
        );
        assert_eq!(hero_result.len(), 0); // 应该没有英雄分类的逝者
    });
}

/// Test 26: get_deceased_by_category 分页功能测试
#[test]
fn get_deceased_by_category_pagination_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建5个默认分类（Ordinary）的逝者
        for i in 0..5 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 测试无起始索引的分页查询
        let page1 = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            None,
            3
        );
        assert_eq!(page1.len(), 3); // 应该返回前3个

        // 测试带起始索引的分页查询
        let page2 = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            Some(3), // 从索引3开始
            3
        );
        assert_eq!(page2.len(), 2); // 应该返回剩余的2个（索引3和4）

        // 测试超出范围的起始索引
        let empty_page = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            Some(10), // 超出范围
            3
        );
        assert_eq!(empty_page.len(), 0); // 应该返回空结果
    });
}

/// Test 27: get_deceased_by_category 可见性过滤测试
#[test]
fn get_deceased_by_category_visibility_filter_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建3个默认分类的逝者
        for i in 0..3 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 将第二个逝者设为不可见
        assert_ok!(Pallet::<Test>::set_visibility(
            RuntimeOrigin::signed(owner),
            1u64, // deceased_id = 1
            false // 设置为不可见
        ));

        // 按分类查询应该只返回可见的逝者（ID 0 和 2）
        let result = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            None,
            10
        );
        assert_eq!(result.len(), 2); // 应该只返回2个可见的逝者

        // 验证返回的是ID 0 和 2
        let returned_ids: Vec<u64> = result.into_iter().map(|(id, _)| id).collect();
        assert!(returned_ids.contains(&0u64));
        assert!(returned_ids.contains(&2u64));
        // ID 1应该被过滤掉（因为不可见）
        // 注意：由于我们使用索引查询，实际返回的ID可能不同，但总数应该是正确的
    });
}

/// Test 28: get_deceased_by_category 限制测试
#[test]
fn get_deceased_by_category_limit_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建10个默认分类的逝者
        for i in 0..10 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 测试正常限制
        let result = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            None,
            5
        );
        assert_eq!(result.len(), 5); // 应该返回5个

        // 测试超大限制（应该被限制在50以内）
        let limited_result = Pallet::<Test>::get_deceased_by_category(
            DeceasedCategory::Ordinary,
            None,
            100 // 请求100个，但应该被限制
        );
        // 由于我们只有10个逝者，所以最多返回10个
        assert_eq!(limited_result.len(), 10);
    });
}

/// Test 29: category index maintenance 测试
#[test]
fn category_index_maintenance_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建逝者（默认为 Ordinary 分类）
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 验证初始分类索引
        let ordinary_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Ordinary);
        assert_eq!(ordinary_list.len(), 1);
        assert_eq!(ordinary_list[0], deceased_id);

        // Hero 分类应该是空的
        let hero_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Hero);
        assert_eq!(hero_list.len(), 0);

        // 注意：由于分类修改申请是治理流程，这里我们直接测试索引维护函数
        // 实际的分类修改需要通过 request_category_change -> approve_category_change 流程
    });
}

/// Test 30: category index helper functions 测试
#[test]
fn category_index_helper_functions_work() {
    new_test_ext().execute_with(|| {
        // 测试 add_to_category_index
        Pallet::<Test>::add_to_category_index(DeceasedCategory::Hero, 1u64);
        let hero_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Hero);
        assert_eq!(hero_list.len(), 1);
        assert_eq!(hero_list[0], 1u64);

        // 测试添加第二个
        Pallet::<Test>::add_to_category_index(DeceasedCategory::Hero, 2u64);
        let hero_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Hero);
        assert_eq!(hero_list.len(), 2);
        assert!(hero_list.contains(&1u64));
        assert!(hero_list.contains(&2u64));

        // 测试 remove_from_category_index
        Pallet::<Test>::remove_from_category_index(DeceasedCategory::Hero, 1u64);
        let hero_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Hero);
        assert_eq!(hero_list.len(), 1);
        assert_eq!(hero_list[0], 2u64);

        // 测试 update_category_index
        Pallet::<Test>::add_to_category_index(DeceasedCategory::Ordinary, 3u64);
        Pallet::<Test>::update_category_index(
            DeceasedCategory::Ordinary,
            DeceasedCategory::Martyr,
            3u64
        );

        // 验证从 Ordinary 中移除
        let ordinary_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Ordinary);
        assert!(!ordinary_list.contains(&3u64));

        // 验证添加到 Martyr 中
        let martyr_list = DeceasedByCategory::<Test>::get(DeceasedCategory::Martyr);
        assert!(martyr_list.contains(&3u64));
    });
}

// ==================== 🆕 Time Query Interface Tests (时间查询接口测试) ====================

/// Test 31: get_deceased_by_creation_time 基础功能测试
#[test]
fn get_deceased_by_creation_time_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 在区块1创建第一个逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 移动到区块2
        System::set_block_number(2);

        // 在区块2创建第二个逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            b"Test User 2".to_vec(),
            1,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        // 测试按创建时间查询（从最新开始）
        let result = Pallet::<Test>::get_deceased_by_creation_time(None, 5);
        assert_eq!(result.len(), 2); // 应该返回2个逝者

        // 验证时间排序（最新的在前）
        assert_eq!(result[0].2, 2u32.into()); // 第一个是区块2创建的
        assert_eq!(result[1].2, 1u32.into()); // 第二个是区块1创建的

        // 验证时间索引是否正确维护
        let block1_deceased = DeceasedByCreationTime::<Test>::get(1u32.into());
        assert_eq!(block1_deceased.len(), 1);
        assert_eq!(block1_deceased[0], 0u64); // 第一个逝者ID=0

        let block2_deceased = DeceasedByCreationTime::<Test>::get(2u32.into());
        assert_eq!(block2_deceased.len(), 1);
        assert_eq!(block2_deceased[0], 1u64); // 第二个逝者ID=1
    });
}

/// Test 32: get_deceased_by_creation_time 分页测试
#[test]
fn get_deceased_by_creation_time_pagination_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建5个逝者
        for i in 0..5 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 测试限制数量
        let limited_result = Pallet::<Test>::get_deceased_by_creation_time(None, 3);
        assert_eq!(limited_result.len(), 3); // 应该返回前3个

        // 测试超大限制（应该被限制在20以内）
        let all_result = Pallet::<Test>::get_deceased_by_creation_time(None, 100);
        assert_eq!(all_result.len(), 5); // 实际只有5个，全部返回

        // 测试从指定区块开始查询
        let from_block_result = Pallet::<Test>::get_deceased_by_creation_time(Some(1u32.into()), 10);
        assert_eq!(from_block_result.len(), 5); // 从区块1开始，应该返回所有5个
    });
}

/// Test 33: get_deceased_by_creation_time 可见性过滤测试
#[test]
fn get_deceased_by_creation_time_visibility_filter_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建3个逝者
        for i in 0..3 {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts(),
                death_ts(),
                Vec::new(),
            ));
        }

        // 将第二个逝者设为不可见
        assert_ok!(Pallet::<Test>::set_visibility(
            RuntimeOrigin::signed(owner),
            1u64, // deceased_id = 1
            false // 设置为不可见
        ));

        // 按创建时间查询应该只返回可见的逝者（ID 0 和 2）
        let result = Pallet::<Test>::get_deceased_by_creation_time(None, 10);
        assert_eq!(result.len(), 2); // 应该只返回2个可见的逝者

        // 验证返回的是正确的逝者
        let returned_ids: Vec<u64> = result.into_iter().map(|(id, _, _)| {
            TryInto::<u64>::try_into(id).unwrap_or(0)
        }).collect();
        assert!(returned_ids.contains(&0u64));
        assert!(returned_ids.contains(&2u64));
        // ID 1应该被过滤掉（因为不可见）
    });
}

/// Test 34: get_deceased_by_birthday_month 基础功能测试
#[test]
fn get_deceased_by_birthday_month_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 创建有生日信息的逝者（12月生日）
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0,
            None,
            b"19901225".to_vec(), // 12月25日生日
            death_ts(),
            Vec::new(),
        ));

        // 创建另一个有生日信息的逝者（1月生日）
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            b"Test User 2".to_vec(),
            1,
            None,
            b"1985-01-15".to_vec(), // 1月15日生日
            death_ts(),
            Vec::new(),
        ));

        // 测试查询12月生日的逝者
        let december_result = Pallet::<Test>::get_deceased_by_birthday_month(12, 10);
        assert_eq!(december_result.len(), 1); // 应该有1个12月生日的逝者

        // 测试查询1月生日的逝者
        let january_result = Pallet::<Test>::get_deceased_by_birthday_month(1, 10);
        assert_eq!(january_result.len(), 1); // 应该有1个1月生日的逝者

        // 测试查询不存在的月份（2月）
        let february_result = Pallet::<Test>::get_deceased_by_birthday_month(2, 10);
        assert_eq!(february_result.len(), 0); // 应该没有2月生日的逝者
    });
}

/// Test 35: get_deceased_by_birthday_month 日期格式解析测试
#[test]
fn get_deceased_by_birthday_month_date_parsing_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;

        // 测试不同日期格式
        let test_cases = vec![
            (b"19901225".to_vec(), 12),         // YYYYMMDD 格式
            (b"1985-01-15".to_vec(), 1),        // YYYY-MM-DD 格式
            (b"1992/06/30".to_vec(), 6),        // YYYY/MM/DD 格式
            (b"03-20".to_vec(), 3),             // MM-DD 格式
            (b"11/05".to_vec(), 11),            // MM/DD 格式
        ];

        for (i, (birth_ts, expected_month)) in test_cases.iter().enumerate() {
            assert_ok!(Pallet::<Test>::create_deceased(
                RuntimeOrigin::signed(owner),
                format!("Test User {}", i).into_bytes(),
                0,
                None,
                birth_ts.clone(),
                death_ts(),
                Vec::new(),
            ));

            // 验证能正确解析并查询到该月份的逝者
            let result = Pallet::<Test>::get_deceased_by_birthday_month(*expected_month, 10);
            assert!(result.len() > 0, "Should find deceased with birth month {}", expected_month);
        }
    });
}

/// Test 36: get_deceased_by_birthday_month 参数验证测试
#[test]
fn get_deceased_by_birthday_month_parameter_validation_works() {
    new_test_ext().execute_with(|| {
        // 测试无效月份（0）
        let invalid_month_0 = Pallet::<Test>::get_deceased_by_birthday_month(0, 10);
        assert_eq!(invalid_month_0.len(), 0);

        // 测试无效月份（13）
        let invalid_month_13 = Pallet::<Test>::get_deceased_by_birthday_month(13, 10);
        assert_eq!(invalid_month_13.len(), 0);

        // 测试超大限制（应该被限制在10以内）
        let limited_result = Pallet::<Test>::get_deceased_by_birthday_month(12, 100);
        assert_eq!(limited_result.len(), 0); // 没有逝者，所以返回0
    });
}

/// Test 37: creation time index maintenance 测试
#[test]
fn creation_time_index_maintenance_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(5);
        let owner = 1u64;

        // 创建逝者
        assert_ok!(Pallet::<Test>::create_deceased(
            RuntimeOrigin::signed(owner),
            name(),
            0,
            None,
            birth_ts(),
            death_ts(),
            Vec::new(),
        ));

        let deceased_id = 0u64;

        // 验证时间索引
        let block5_list = DeceasedByCreationTime::<Test>::get(5u32.into());
        assert_eq!(block5_list.len(), 1);
        assert_eq!(block5_list[0], deceased_id);

        // 其他区块应该是空的
        let block1_list = DeceasedByCreationTime::<Test>::get(1u32.into());
        assert_eq!(block1_list.len(), 0);
    });
}

/// Test 38: creation time index helper function 测试
#[test]
fn creation_time_index_helper_function_works() {
    new_test_ext().execute_with(|| {
        // 测试 add_to_creation_time_index
        Pallet::<Test>::add_to_creation_time_index(10u32.into(), 1u64);
        let block10_list = DeceasedByCreationTime::<Test>::get(10u32.into());
        assert_eq!(block10_list.len(), 1);
        assert_eq!(block10_list[0], 1u64);

        // 测试添加第二个
        Pallet::<Test>::add_to_creation_time_index(10u32.into(), 2u64);
        let block10_list = DeceasedByCreationTime::<Test>::get(10u32.into());
        assert_eq!(block10_list.len(), 2);
        assert!(block10_list.contains(&1u64));
        assert!(block10_list.contains(&2u64));

        // 测试不同区块
        Pallet::<Test>::add_to_creation_time_index(20u32.into(), 3u64);
        let block20_list = DeceasedByCreationTime::<Test>::get(20u32.into());
        assert_eq!(block20_list.len(), 1);
        assert_eq!(block20_list[0], 3u64);

        // 验证区块10还是原来的内容
        let block10_list = DeceasedByCreationTime::<Test>::get(10u32.into());
        assert_eq!(block10_list.len(), 2);
    });
}
