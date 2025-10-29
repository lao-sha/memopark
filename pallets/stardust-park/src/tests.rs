// 函数级中文注释：pallet-memo-park单元测试
// Phase 3 Week 1 Day 1: 15个核心测试用例

use crate::{mock::*, Error, Event, Parks, ParksByCountry, NextParkId};
use frame_support::{assert_noop, assert_ok, BoundedVec, traits::ConstU32};

/// 辅助函数：创建有效的country_iso2
fn country() -> [u8; 2] {
    *b"CN"
}

/// 辅助函数：创建有效的region_code
fn region() -> BoundedVec<u8, ConstU32<64>> {
    b"Shanghai".to_vec().try_into().unwrap()
}

/// 辅助函数：创建有效的metadata_cid
fn metadata_cid() -> BoundedVec<u8, ConstU32<128>> {
    b"QmTest1234567890".to_vec().try_into().unwrap()
}

// ==================== 创建园区测试 ====================

/// 测试1：基本创建功能
#[test]
fn create_park_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1); // 初始化block number以记录events
        let owner = 1u64;
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 验证园区ID为0（第一个）
        let park_id = 0u64;
        
        // 验证Storage
        assert!(Parks::<Test>::get(park_id).is_some());
        let park = Parks::<Test>::get(park_id).unwrap();
        assert_eq!(park.owner, owner);
        assert_eq!(park.country_iso2, country());
        assert_eq!(park.active, true);
        assert_eq!(park.admin_group, None);
        
        // 验证NextParkId递增
        assert_eq!(NextParkId::<Test>::get(), 1);
        
        // 验证国家索引
        let parks_in_country = ParksByCountry::<Test>::get(country());
        assert_eq!(parks_in_country.len(), 1);
        assert_eq!(parks_in_country[0], park_id);
        
        // 验证Event
        System::assert_has_event(
            Event::ParkCreated {
                id: park_id,
                owner,
                country: country(),
            }.into()
        );
    });
}

/// 测试2：无效国家代码应失败
#[test]
fn create_park_bad_country_fails() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        
        // 使用无效国家代码 [0, 0]
        assert_noop!(
            MemoPark::create_park(
                RuntimeOrigin::signed(owner),
                [0, 0],
                region(),
                metadata_cid()
            ),
            Error::<Test>::BadCountry
        );
    });
}

/// 测试3：多个园区ID自增
#[test]
fn create_multiple_parks_increments_id() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        
        // 创建第1个园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        assert_eq!(NextParkId::<Test>::get(), 1);
        
        // 创建第2个园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            *b"US",
            region(),
            metadata_cid()
        ));
        assert_eq!(NextParkId::<Test>::get(), 2);
        
        // 创建第3个园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            *b"JP",
            region(),
            metadata_cid()
        ));
        assert_eq!(NextParkId::<Test>::get(), 3);
        
        // 验证所有园区存在
        assert!(Parks::<Test>::get(0).is_some());
        assert!(Parks::<Test>::get(1).is_some());
        assert!(Parks::<Test>::get(2).is_some());
    });
}

/// 测试4：同一国家多个园区
#[test]
fn multiple_parks_same_country() {
    new_test_ext().execute_with(|| {
        let owner1 = 1u64;
        let owner2 = 2u64;
        let cn = country();
        
        // 创建2个CN园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner1),
            cn,
            region(),
            metadata_cid()
        ));
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner2),
            cn,
            region(),
            metadata_cid()
        ));
        
        // 验证国家索引包含两个
        let parks_in_cn = ParksByCountry::<Test>::get(cn);
        assert_eq!(parks_in_cn.len(), 2);
        assert_eq!(parks_in_cn[0], 0);
        assert_eq!(parks_in_cn[1], 1);
    });
}

// ==================== 更新园区测试 ====================

/// 测试5：拥有者更新园区
#[test]
fn update_park_by_owner_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        
        // 先创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 更新园区
        let new_region: BoundedVec<u8, ConstU32<64>> = b"Beijing".to_vec().try_into().unwrap();
        let new_cid: BoundedVec<u8, ConstU32<128>> = b"QmUpdated123".to_vec().try_into().unwrap();
        
        assert_ok!(MemoPark::update_park(
            RuntimeOrigin::signed(owner),
            0,
            Some(new_region.clone()),
            Some(new_cid.clone()),
            None
        ));
        
        // 验证更新
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.region_code, new_region);
        assert_eq!(park.metadata_cid, new_cid);
        
        // 验证Event
        System::assert_has_event(Event::ParkUpdated { id: 0 }.into());
    });
}

/// 测试6：管理员更新园区
#[test]
fn update_park_by_admin_works() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let admin = 99u64; // Mock中99是管理员
        
        // owner创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // admin更新园区
        let new_region: BoundedVec<u8, ConstU32<64>> = b"Guangzhou".to_vec().try_into().unwrap();
        assert_ok!(MemoPark::update_park(
            RuntimeOrigin::signed(admin),
            0,
            Some(new_region.clone()),
            None,
            None
        ));
        
        // 验证更新
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.region_code, new_region);
    });
}

/// 测试7：非拥有者非管理员更新失败
#[test]
fn update_park_requires_permission() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 2u64;
        
        // owner创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // attacker尝试更新
        assert_noop!(
            MemoPark::update_park(
                RuntimeOrigin::signed(attacker),
                0,
                Some(region()),
                None,
                None
            ),
            sp_runtime::DispatchError::BadOrigin
        );
    });
}

/// 测试8：更新不存在的园区失败
#[test]
fn update_nonexistent_park_fails() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        
        // 更新不存在的园区
        assert_noop!(
            MemoPark::update_park(
                RuntimeOrigin::signed(owner),
                999,
                Some(region()),
                None,
                None
            ),
            Error::<Test>::NotFound
        );
    });
}

// ==================== 设置管理员测试 ====================

/// 测试9：拥有者设置管理员
#[test]
fn set_admin_by_owner_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let admin_group = 1u64;
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 设置管理员
        assert_ok!(MemoPark::set_park_admin(
            RuntimeOrigin::signed(owner),
            0,
            Some(admin_group)
        ));
        
        // 验证
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.admin_group, Some(admin_group));
        
        // 验证Event
        System::assert_has_event(
            Event::AdminSet {
                id: 0,
                admin_group: Some(admin_group),
            }.into()
        );
    });
}

/// 测试10：清空管理员
#[test]
fn clear_admin_works() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        
        // 创建园区并设置管理员
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        assert_ok!(MemoPark::set_park_admin(
            RuntimeOrigin::signed(owner),
            0,
            Some(1)
        ));
        
        // 清空管理员
        assert_ok!(MemoPark::set_park_admin(
            RuntimeOrigin::signed(owner),
            0,
            None
        ));
        
        // 验证
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.admin_group, None);
    });
}

// ==================== 转让所有权测试 ====================

/// 测试11：拥有者转让所有权
#[test]
fn transfer_park_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        let owner = 1u64;
        let new_owner = 2u64;
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 转让所有权
        assert_ok!(MemoPark::transfer_park(
            RuntimeOrigin::signed(owner),
            0,
            new_owner
        ));
        
        // 验证拥有者变更
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.owner, new_owner);
        
        // 验证Event
        System::assert_has_event(
            Event::ParkTransferred {
                id: 0,
                new_owner,
            }.into()
        );
        
        // 验证旧owner无法再更新
        assert_noop!(
            MemoPark::update_park(
                RuntimeOrigin::signed(owner),
                0,
                Some(region()),
                None,
                None
            ),
            sp_runtime::DispatchError::BadOrigin
        );
        
        // 验证新owner可以更新
        assert_ok!(MemoPark::update_park(
            RuntimeOrigin::signed(new_owner),
            0,
            Some(region()),
            None,
            None
        ));
    });
}

/// 测试12：非拥有者转让失败
#[test]
fn transfer_park_requires_ownership() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 3u64;
        let new_owner = 2u64;
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 非拥有者尝试转让
        assert_noop!(
            MemoPark::transfer_park(
                RuntimeOrigin::signed(attacker),
                0,
                new_owner
            ),
            Error::<Test>::NotOwner
        );
    });
}

// ==================== 治理功能测试 ====================

/// 测试13：治理更新园区
#[test]
fn gov_update_park_works() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let gov = 100u64; // Mock中100是治理账户
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 治理更新
        let new_region: BoundedVec<u8, ConstU32<64>> = b"Shenzhen".to_vec().try_into().unwrap();
        let evidence: Vec<u8> = b"QmEvidence123".to_vec();
        
        assert_ok!(MemoPark::gov_update_park(
            RuntimeOrigin::signed(gov),
            0,
            Some(new_region.clone()),
            None,
            Some(false), // 停用
            evidence
        ));
        
        // 验证
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.region_code, new_region);
        assert_eq!(park.active, false);
    });
}

/// 测试14：非治理账户不能执行治理操作
#[test]
fn gov_operations_require_governance() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let attacker = 2u64;
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 非治理账户尝试治理操作
        assert_noop!(
            MemoPark::gov_update_park(
                RuntimeOrigin::signed(attacker),
                0,
                None,
                None,
                Some(false),
                vec![]
            ),
            Error::<Test>::NotAdmin
        );
    });
}

/// 测试15：治理转让所有权
#[test]
fn gov_transfer_park_works() {
    new_test_ext().execute_with(|| {
        let owner = 1u64;
        let new_owner = 2u64;
        let gov = 100u64;
        
        // 创建园区
        assert_ok!(MemoPark::create_park(
            RuntimeOrigin::signed(owner),
            country(),
            region(),
            metadata_cid()
        ));
        
        // 治理转让
        let evidence: Vec<u8> = b"QmTransferEvidence".to_vec();
        assert_ok!(MemoPark::gov_transfer_park(
            RuntimeOrigin::signed(gov),
            0,
            new_owner,
            evidence
        ));
        
        // 验证
        let park = Parks::<Test>::get(0).unwrap();
        assert_eq!(park.owner, new_owner);
    });
}

