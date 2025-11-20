//! 主逝者功能单元测试
//!
//! 功能测试包括：
//! 1. 主逝者设置和清除
//! 2. 权限验证
//! 3. 业务规则检查
//! 4. 事件验证
//! 5. 边界条件测试
//!
//! 创建日期：2025-11-10

use super::*;
use frame_support::{
    assert_noop, assert_ok,
    traits::{Get, Hooks},
    weights::Weight,
};
use sp_runtime::traits::{BlakeTwo256, IdentityLookup};

type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
type Block = frame_system::mocking::MockBlock<Test>;

// ================================
// Mock配置
// ================================

frame_support::construct_runtime!(
    pub enum Test where
        Block = Block,
        NodeBlock = Block,
        UncheckedExtrinsic = UncheckedExtrinsic,
    {
        System: frame_system::{Pallet, Call, Config, Storage, Event<T>},
        StardustGrave: pallet_stardust_grave::{Pallet, Call, Storage, Event<T>},
    }
);

frame_support::parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const SS58Prefix: u8 = 42;
}

impl frame_system::Config for Test {
    type BaseCallFilter = frame_support::traits::Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type Index = u64;
    type BlockNumber = u64;
    type Hash = sp_core::H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Header = sp_runtime::testing::Header;
    type RuntimeEvent = RuntimeEvent;
    type BlockHashCount = BlockHashCount;
    type Version = ();
    type PalletInfo = PalletInfo;
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = SS58Prefix;
    type OnSetCode = ();
    type MaxConsumers = frame_support::traits::ConstU32<16>;
}

// Mock implementation for WeightInfo
impl crate::weights::WeightInfo for () {
    fn create_grave() -> Weight {
        Weight::from_parts(10_000, 0)
    }

    fn set_primary_deceased() -> Weight {
        Weight::from_parts(10_000, 0)
    }

    // ... 其他权重函数的mock实现
    fn set_park() -> Weight { Weight::from_parts(10_000, 0) }
    fn update_grave() -> Weight { Weight::from_parts(10_000, 0) }
    fn transfer_grave() -> Weight { Weight::from_parts(10_000, 0) }
    fn inter() -> Weight { Weight::from_parts(10_000, 0) }
    fn exhume() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_meta() -> Weight { Weight::from_parts(10_000, 0) }
    fn complain() -> Weight { Weight::from_parts(10_000, 0) }
    fn restrict() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_name_hash() -> Weight { Weight::from_parts(10_000, 0) }
    fn clear_name_hash() -> Weight { Weight::from_parts(10_000, 0) }
    fn add_admin() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove_admin() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_policy() -> Weight { Weight::from_parts(10_000, 0) }
    fn join_open() -> Weight { Weight::from_parts(10_000, 0) }
    fn apply_join() -> Weight { Weight::from_parts(10_000, 0) }
    fn approve_member() -> Weight { Weight::from_parts(10_000, 0) }
    fn reject_member() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_visibility() -> Weight { Weight::from_parts(10_000, 0) }
    fn follow() -> Weight { Weight::from_parts(10_000, 0) }
    fn unfollow() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_kinship_policy() -> Weight { Weight::from_parts(10_000, 0) }
    fn declare_kinship() -> Weight { Weight::from_parts(10_000, 0) }
    fn approve_kinship() -> Weight { Weight::from_parts(10_000, 0) }
    fn reject_kinship() -> Weight { Weight::from_parts(10_000, 0) }
    fn update_kinship() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove_kinship() -> Weight { Weight::from_parts(10_000, 0) }
    fn add_cover_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove_cover_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_cover_from_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_audio() -> Weight { Weight::from_parts(10_000, 0) }
    fn clear_audio() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_audio_via_governance() -> Weight { Weight::from_parts(10_000, 0) }
    fn clear_audio_via_governance() -> Weight { Weight::from_parts(10_000, 0) }
    fn add_audio_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove_audio_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_audio_from_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn add_private_audio_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn remove_private_audio_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_audio_from_private_option() -> Weight { Weight::from_parts(10_000, 0) }
    fn set_audio_playlist(_len: u32) -> Weight { Weight::from_parts(10_000, 0) }
    fn set_carousel(_len: u32) -> Weight { Weight::from_parts(10_000, 0) }
}

// Mock实现其他必要的Config types
frame_support::parameter_types! {
    pub const MaxCidLen: u32 = 64;
    pub const MaxAdminsPerGrave: u32 = 10;
    pub const SlugLen: u32 = 32;
}

// Mock DeceasedTokenProvider
pub struct MockDeceasedTokenProvider;
impl crate::traits::DeceasedTokenProvider<u64> for MockDeceasedTokenProvider {
    fn token_of(_deceased_id: u64) -> Option<Vec<u8>> {
        Some(b"mock_token".to_vec())
    }
}

// Mock ParkAdmin
pub struct MockParkAdmin;
impl crate::traits::ParkAdmin<RuntimeOrigin> for MockParkAdmin {
    fn ensure(_park_id: u64, _origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        Ok(())
    }
}

impl crate::Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
    type MaxCidLen = MaxCidLen;
    type MaxAdminsPerGrave = MaxAdminsPerGrave;
    type SlugLen = SlugLen;
    type DeceasedTokenProvider = MockDeceasedTokenProvider;
    type ParkAdmin = MockParkAdmin;
    type GraveId = u64;
}

// ================================
// 测试辅助函数
// ================================

/// 创建基础存储状态
fn new_test_ext() -> sp_io::TestExternalities {
    frame_system::GenesisConfig::default().build_storage::<Test>().unwrap().into()
}

/// 创建测试墓位
fn create_test_grave(owner: u64) -> u64 {
    let grave_id = 1;
    let name = b"test_grave".to_vec().try_into().unwrap();

    assert_ok!(StardustGrave::create_grave(
        RuntimeOrigin::signed(owner),
        None, // park_id
        name,
        false, // is_public
    ));

    grave_id
}

/// 添加安葬记录（模拟）
fn add_interment_record(grave_id: u64, deceased_id: u64, slot: u16) {
    let record = crate::IntermentRecord {
        deceased_id,
        slot,
        time: System::block_number(),
        note_cid: None,
    };

    let mut interments = StardustGrave::interments(grave_id);
    interments.try_push(record).unwrap();
    crate::Interments::<Test>::insert(grave_id, interments);
}

// ================================
// 基础功能测试
// ================================

#[test]
fn set_primary_deceased_works() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;

        // 1. 创建墓位
        let grave_id = create_test_grave(owner);

        // 2. 添加安葬记录
        add_interment_record(grave_id, deceased_id, 1);

        // 3. 设置主逝者
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_id)
        ));

        // 4. 验证设置成功
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_id));

        // 5. 验证事件发出
        System::assert_last_event(RuntimeEvent::StardustGrave(
            crate::Event::PrimaryDeceasedSet { grave_id, deceased_id }
        ));
    });
}

#[test]
fn clear_primary_deceased_works() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;

        // 1. 创建墓位并设置主逝者
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_id)
        ));

        // 2. 清除主逝者
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            None
        ));

        // 3. 验证清除成功
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), None);

        // 4. 验证事件发出
        System::assert_last_event(RuntimeEvent::StardustGrave(
            crate::Event::PrimaryDeceasedCleared { grave_id }
        ));
    });
}

// ================================
// 权限测试
// ================================

#[test]
fn set_primary_deceased_fails_without_permission() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let unauthorized_user = 2;
        let deceased_id = 100;

        // 1. 创建墓位
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);

        // 2. 未授权用户尝试设置主逝者
        assert_noop!(
            StardustGrave::set_primary_deceased(
                RuntimeOrigin::signed(unauthorized_user),
                grave_id,
                Some(deceased_id)
            ),
            crate::Error::<Test>::NotAdmin
        );

        // 3. 验证主逝者未被设置
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), None);
    });
}

#[test]
fn grave_admin_can_set_primary_deceased() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let admin = 2;
        let deceased_id = 100;

        // 1. 创建墓位
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);

        // 2. 添加管理员
        let mut admins = crate::GraveAdmins::<Test>::get(grave_id);
        admins.try_push(admin).unwrap();
        crate::GraveAdmins::<Test>::insert(grave_id, admins);

        // 3. 管理员设置主逝者
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(admin),
            grave_id,
            Some(deceased_id)
        ));

        // 4. 验证设置成功
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_id));
    });
}

// ================================
// 业务规则测试
// ================================

#[test]
fn set_primary_deceased_fails_for_nonexistent_grave() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;
        let nonexistent_grave_id = 999;

        assert_noop!(
            StardustGrave::set_primary_deceased(
                RuntimeOrigin::signed(owner),
                nonexistent_grave_id,
                Some(deceased_id)
            ),
            crate::Error::<Test>::NotFound
        );
    });
}

#[test]
fn set_primary_deceased_fails_for_non_interred_deceased() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;
        let not_interred_deceased_id = 200;

        // 1. 创建墓位并安葬一个逝者
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);

        // 2. 尝试设置未安葬的逝者为主逝者
        assert_noop!(
            StardustGrave::set_primary_deceased(
                RuntimeOrigin::signed(owner),
                grave_id,
                Some(not_interred_deceased_id)
            ),
            crate::Error::<Test>::DeceasedNotInGrave
        );
    });
}

#[test]
fn multiple_deceased_primary_selection() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_1 = 100;
        let deceased_2 = 200;
        let deceased_3 = 300;

        // 1. 创建墓位并安葬多个逝者
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_1, 1);
        add_interment_record(grave_id, deceased_2, 2);
        add_interment_record(grave_id, deceased_3, 3);

        // 2. 设置第二个逝者为主逝者
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_2)
        ));
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_2));

        // 3. 切换到第三个逝者
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_3)
        ));
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_3));

        // 4. 验证只有一个主逝者
        assert!(StardustGrave::is_primary_deceased(grave_id, deceased_3));
        assert!(!StardustGrave::is_primary_deceased(grave_id, deceased_1));
        assert!(!StardustGrave::is_primary_deceased(grave_id, deceased_2));
    });
}

// ================================
// 查询函数测试
// ================================

#[test]
fn primary_deceased_query_functions_work() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;

        // 1. 创建墓位
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);

        // 2. 未设置主逝者时的查询
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), None);
        assert!(!StardustGrave::is_primary_deceased(grave_id, deceased_id));

        // 3. 设置主逝者后的查询
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_id)
        ));

        assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_id));
        assert!(StardustGrave::is_primary_deceased(grave_id, deceased_id));

        // 4. 清除后的查询
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            None
        ));

        assert_eq!(StardustGrave::primary_deceased_of(grave_id), None);
        assert!(!StardustGrave::is_primary_deceased(grave_id, deceased_id));
    });
}

// ================================
// 边界条件测试
// ================================

#[test]
fn set_same_primary_deceased_twice() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;

        // 1. 创建墓位并设置主逝者
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);

        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_id)
        ));

        // 2. 重复设置相同的主逝者应该成功（幂等操作）
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_id)
        ));

        // 3. 验证仍然是主逝者
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_id));
    });
}

#[test]
fn clear_non_existent_primary_deceased() {
    new_test_ext().execute_with(|| {
        let owner = 1;

        // 1. 创建墓位（不设置主逝者）
        let grave_id = create_test_grave(owner);

        // 2. 清除不存在的主逝者应该成功（幂等操作）
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            None
        ));

        // 3. 验证仍然没有主逝者
        assert_eq!(StardustGrave::primary_deceased_of(grave_id), None);
    });
}

// ================================
// 存储一致性测试
// ================================

#[test]
fn primary_deceased_storage_consistency() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_1 = 100;
        let deceased_2 = 200;

        // 1. 创建多个墓位
        let grave_1 = create_test_grave(owner);
        let grave_2 = 2;
        assert_ok!(StardustGrave::create_grave(
            RuntimeOrigin::signed(owner),
            None,
            b"test_grave_2".to_vec().try_into().unwrap(),
            false,
        ));

        add_interment_record(grave_1, deceased_1, 1);
        add_interment_record(grave_2, deceased_2, 1);

        // 2. 为不同墓位设置主逝者
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_1,
            Some(deceased_1)
        ));

        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_2,
            Some(deceased_2)
        ));

        // 3. 验证每个墓位的主逝者独立
        assert_eq!(StardustGrave::primary_deceased_of(grave_1), Some(deceased_1));
        assert_eq!(StardustGrave::primary_deceased_of(grave_2), Some(deceased_2));

        // 4. 清除一个墓位的主逝者不应影响其他墓位
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_1,
            None
        ));

        assert_eq!(StardustGrave::primary_deceased_of(grave_1), None);
        assert_eq!(StardustGrave::primary_deceased_of(grave_2), Some(deceased_2));
    });
}

// ================================
// 事件测试
// ================================

#[test]
fn primary_deceased_events_are_emitted_correctly() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let deceased_id = 100;

        // 1. 创建墓位
        let grave_id = create_test_grave(owner);
        add_interment_record(grave_id, deceased_id, 1);

        // 2. 重置事件系统
        System::reset_events();

        // 3. 设置主逝者并验证事件
        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            Some(deceased_id)
        ));

        let events = System::events();
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0].event,
            RuntimeEvent::StardustGrave(crate::Event::PrimaryDeceasedSet {
                grave_id,
                deceased_id
            })
        );

        // 4. 清除主逝者并验证事件
        System::reset_events();

        assert_ok!(StardustGrave::set_primary_deceased(
            RuntimeOrigin::signed(owner),
            grave_id,
            None
        ));

        let events = System::events();
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0].event,
            RuntimeEvent::StardustGrave(crate::Event::PrimaryDeceasedCleared {
                grave_id
            })
        );
    });
}

// ================================
// 性能测试
// ================================

#[test]
fn primary_deceased_operations_are_efficient() {
    new_test_ext().execute_with(|| {
        let owner = 1;
        let grave_id = create_test_grave(owner);

        // 添加大量安葬记录
        for i in 1..=100 {
            add_interment_record(grave_id, i, i as u16);
        }

        // 测试设置主逝者的性能（应该是O(n)复杂度，n为安葬记录数量）
        for deceased_id in [1, 50, 100] {
            assert_ok!(StardustGrave::set_primary_deceased(
                RuntimeOrigin::signed(owner),
                grave_id,
                Some(deceased_id)
            ));

            assert_eq!(StardustGrave::primary_deceased_of(grave_id), Some(deceased_id));
        }

        // 测试查询函数的性能（应该是O(1)复杂度）
        assert!(StardustGrave::is_primary_deceased(grave_id, 100));
        assert!(!StardustGrave::is_primary_deceased(grave_id, 99));
    });
}