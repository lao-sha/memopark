// 函数级中文注释：pallet-deceased单元测试
// Phase 3 Week 1 Day 3: 18个核心CRUD测试

use crate::{
    mock::*, DeceasedOf, DeceasedByGrave, NextDeceasedId, Gender, Error, Event, Pallet,
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

// ==================== Remove Tests (2个) ====================

/// Test 15: 移除逝者 - 永久禁止删除
#[test]
fn remove_deceased_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
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

        // 移除应失败 - pallet永久禁止删除
        assert_noop!(
            Pallet::<Test>::remove_deceased(
                RuntimeOrigin::signed(owner),
                deceased_id,
            ),
            Error::<Test>::DeletionForbidden
        );

        // 验证Storage仍然存在
        assert!(DeceasedOf::<Test>::get(deceased_id).is_some());
    });
}

/// Test 16: 任何人尝试移除都应失败（永久禁止删除）
#[test]
fn remove_requires_ownership() {
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

        // other_user尝试移除应失败 - 永久禁止删除
        assert_noop!(
            Pallet::<Test>::remove_deceased(
                RuntimeOrigin::signed(other_user),
                deceased_id,
            ),
            Error::<Test>::DeletionForbidden
        );
    });
}

// ==================== Governance Tests (2个) ====================

/// Test 17: 治理可以转移逝者
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

/// Test 18: 治理操作需要治理权限
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

        // unauthorized尝试治理操作应失败
        // ensure_gov返回NotAuthorized错误
        assert_noop!(
            Pallet::<Test>::gov_transfer_deceased(
                RuntimeOrigin::signed(unauthorized),
                deceased_id,
                new_grave_id,
                Vec::new(),
            ),
            Error::<Test>::NotAuthorized
        );
    });
}
