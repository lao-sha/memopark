// 函数级中文注释：pallet-memo-grave单元测试
// Phase 3 Week 1 Day 2: 20个核心测试用例

use crate::{mock::*, Error, Event, Graves, NextGraveId};
use frame_support::{assert_noop, assert_ok, BoundedVec, traits::ConstU32};

/// 辅助函数：创建有效的name CID
fn name_cid() -> BoundedVec<u8, ConstU32<128>> {
    b"QmGraveName123".to_vec().try_into().unwrap()
}

// ==================== 创建墓地测试 ====================

/// 测试1：基本创建功能
#[test]
fn create_grave_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None, // 无园区
            name_cid()
        ));
        
        // 验证墓地ID为0
        let grave_id = 0u64;
        
        // 验证Storage
        assert!(Graves::<Test>::get(grave_id).is_some());
        let grave = Graves::<Test>::get(grave_id).unwrap();
        assert_eq!(grave.owner, owner);
        assert_eq!(grave.park_id, None);
        assert_eq!(grave.is_public, true);
        assert_eq!(grave.active, true);
        
        // 验证NextGraveId递增
        assert_eq!(NextGraveId::<Test>::get(), 1);
    });
}

/// 测试2：创建时指定园区
#[test]
fn create_grave_with_park() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let park_id = 1u64;
        
        // 创建墓地并指定园区
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            Some(park_id),
            name_cid()
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.park_id, Some(park_id));
    });
}

/// 测试3：多个墓地ID自增
#[test]
fn create_multiple_graves_increments_id() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        
        // 创建3个墓地
        for i in 0..3 {
            assert_ok!(MemoGrave::create_grave(
                RuntimeOrigin::signed(owner),
                None,
                name_cid()
            ));
            assert_eq!(NextGraveId::<Test>::get(), i + 1);
        }
        
        // 验证所有墓地存在
        assert!(Graves::<Test>::get(0).is_some());
        assert!(Graves::<Test>::get(1).is_some());
        assert!(Graves::<Test>::get(2).is_some());
    });
}

// ==================== 设置园区测试 ====================

/// 测试4：拥有者设置园区
#[test]
fn set_park_by_owner_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地（无园区）
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // 设置园区
        let park_id = 5u64;
        assert_ok!(MemoGrave::set_park(
            RuntimeOrigin::signed(owner),
            0,
            Some(park_id)
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.park_id, Some(park_id));
    });
}

/// 测试5：非拥有者设置园区失败
#[test]
fn set_park_requires_ownership() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 2u64;
        
        // owner创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // attacker尝试设置园区
        assert_noop!(
            MemoGrave::set_park(
                RuntimeOrigin::signed(attacker),
                0,
                Some(1)
            ),
            Error::<Test>::NotOwner
        );
    });
}

// ==================== 更新墓地测试 ====================

/// 测试6：拥有者更新墓地
#[test]
fn update_grave_by_owner_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // 更新墓地
        let new_name: BoundedVec<u8, ConstU32<128>> = b"QmNewName456".to_vec().try_into().unwrap();
        assert_ok!(MemoGrave::update_grave(
            RuntimeOrigin::signed(owner),
            0,
            Some(new_name.clone()),
            Some(false), // 改为私有
            None
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.name, new_name);
        assert_eq!(grave.is_public, false);
    });
}

/// 测试7：非拥有者更新失败
#[test]
fn update_grave_requires_ownership() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 2u64;
        
        // owner创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // attacker尝试更新
        assert_noop!(
            MemoGrave::update_grave(
                RuntimeOrigin::signed(attacker),
                0,
                Some(name_cid()),
                None,
                None
            ),
            Error::<Test>::NotOwner
        );
    });
}

// ==================== 转让所有权测试 ====================

/// 测试8：转让墓地所有权
#[test]
fn transfer_grave_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let new_owner = 2u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // 转让
        assert_ok!(MemoGrave::transfer_grave(
            RuntimeOrigin::signed(owner),
            0,
            new_owner
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.owner, new_owner);
        
        // 验证旧owner无法再更新
        assert_noop!(
            MemoGrave::update_grave(
                RuntimeOrigin::signed(owner),
                0,
                Some(name_cid()),
                None,
                None
            ),
            Error::<Test>::NotOwner
        );
    });
}

/// 测试9：非拥有者转让失败
#[test]
fn transfer_grave_requires_ownership() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 3u64;
        let new_owner = 2u64;
        
        // owner创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // attacker尝试转让
        assert_noop!(
            MemoGrave::transfer_grave(
                RuntimeOrigin::signed(attacker),
                0,
                new_owner
            ),
            Error::<Test>::NotOwner
        );
    });
}

// ==================== 安葬和迁出测试 ====================

/// 测试10：安葬逝者
#[test]
fn inter_deceased_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // 安葬逝者
        let deceased_id = 1u64;
        let note: Option<BoundedVec<u8, ConstU32<128>>> = Some(b"Rest in peace".to_vec().try_into().unwrap());
        
        assert_ok!(MemoGrave::inter(
            RuntimeOrigin::signed(owner),
            0,
            deceased_id,
            note
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.deceased_tokens.len(), 1);
    });
}

/// 测试11：迁出逝者
#[test]
fn exhume_deceased_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let deceased_id = 1u64;
        
        // 创建墓地并安葬
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        assert_ok!(MemoGrave::inter(
            RuntimeOrigin::signed(owner),
            0,
            deceased_id,
            None
        ));
        
        // 迁出
        assert_ok!(MemoGrave::exhume(
            RuntimeOrigin::signed(owner),
            0,
            deceased_id
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.deceased_tokens.len(), 0);
    });
}

/// 测试12：非拥有者迁出失败
#[test]
fn exhume_requires_ownership() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 2u64;
        let deceased_id = 1u64;
        
        // owner创建墓地并安葬
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        assert_ok!(MemoGrave::inter(
            RuntimeOrigin::signed(owner),
            0,
            deceased_id,
            None
        ));
        
        // attacker尝试迁出
        assert_noop!(
            MemoGrave::exhume(
                RuntimeOrigin::signed(attacker),
                0,
                deceased_id
            ),
            Error::<Test>::NotOwner
        );
    });
}

// ==================== 准入策略测试 ====================

/// 测试13：设置准入策略
#[test]
fn set_admission_policy_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid(),
            true
        ));
        
        // 设置为Public策略
        assert_ok!(MemoGrave::set_admission_policy(
            RuntimeOrigin::signed(owner),
            0,
            1 // Public
        ));
        
        // 设置为Whitelist策略
        assert_ok!(MemoGrave::set_admission_policy(
            RuntimeOrigin::signed(owner),
            0,
            2 // Whitelist
        ));
    });
}

/// 测试14：白名单添加和移除
#[test]
fn admission_whitelist_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let allowed = 2u64;
        
        // 创建墓地并设置白名单策略
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        assert_ok!(MemoGrave::set_admission_policy(
            RuntimeOrigin::signed(owner),
            0,
            2 // Whitelist
        ));
        
        // 添加到白名单
        assert_ok!(MemoGrave::add_to_admission_whitelist(
            RuntimeOrigin::signed(owner),
            0,
            allowed
        ));
        
        // 从白名单移除
        assert_ok!(MemoGrave::remove_from_admission_whitelist(
            RuntimeOrigin::signed(owner),
            0,
            allowed
        ));
    });
}

// ==================== 限制和移除测试 ====================

/// 测试15：限制墓地
#[test]
fn restrict_grave_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        
        // 限制（需要园区管理员或治理账户）
        // 使用治理账户
        assert_ok!(MemoGrave::restrict(
            RuntimeOrigin::signed(100), // 治理账户
            0,
            true, // 限制
            1 // reason_code
        ));
        
        // 验证墓地inactive
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.active, false);
    });
}

/// 测试16：移除墓地
#[test]
fn remove_grave_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        
        // 移除（需要园区管理员或治理账户）
        assert_ok!(MemoGrave::remove(
            RuntimeOrigin::signed(100), // 治理账户
            0,
            1 // reason_code
        ));
        
        // 验证墓地被移除
        assert!(Graves::<Test>::get(0).is_none());
    });
}

// ==================== 治理操作测试 ====================

/// 测试17：治理转让所有权
#[test]
fn gov_transfer_grave_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let new_owner = 2u64;
        let gov = 100u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        
        // 治理转让
        let evidence = b"QmEvidence789".to_vec();
        assert_ok!(MemoGrave::gov_transfer_grave(
            RuntimeOrigin::signed(gov),
            0,
            new_owner,
            evidence
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.owner, new_owner);
    });
}

/// 测试18：治理设置限制
#[test]
fn gov_set_restricted_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let gov = 100u64;
        
        // 创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        
        // 治理设置限制
        let evidence = b"QmEvidence".to_vec();
        assert_ok!(MemoGrave::gov_set_restricted(
            RuntimeOrigin::signed(gov),
            0,
            true, // 限制
            1, // reason_code
            evidence
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.active, false);
    });
}

/// 测试19：治理恢复墓地
#[test]
fn gov_restore_grave_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let gov = 100u64;
        
        // 创建墓地并限制
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        let evidence = b"QmEvidence".to_vec();
        assert_ok!(MemoGrave::gov_set_restricted(
            RuntimeOrigin::signed(gov),
            0,
            true,
            1, // reason_code
            evidence.clone()
        ));
        
        // 治理恢复
        assert_ok!(MemoGrave::gov_restore_grave(
            RuntimeOrigin::signed(gov),
            0,
            evidence
        ));
        
        // 验证
        let grave = Graves::<Test>::get(0).unwrap();
        assert_eq!(grave.active, true);
    });
}

/// 测试20：非治理账户不能执行治理操作
#[test]
fn gov_operations_require_governance() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 2u64;
        
        // owner创建墓地
        assert_ok!(MemoGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            name_cid()
        ));
        
        // attacker尝试治理转让
        let evidence = b"QmEvidence".to_vec();
        assert_noop!(
            MemoGrave::gov_transfer_grave(
                RuntimeOrigin::signed(attacker),
                0,
                3,
                evidence
            ),
            Error::<Test>::NotAdmin
        );
    });
}

