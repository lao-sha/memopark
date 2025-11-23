//! Tests for pallet-contacts

use crate::{mock::*, Error, Event, FriendStatus};
use frame_support::{assert_noop, assert_ok, BoundedVec};
use frame_system::pallet_prelude::BlockNumberFor;

/// 辅助函数：将字符串转换为 BoundedVec
fn bounded_string<const N: u32>(s: &str) -> BoundedVec<u8, ConstU32<N>> {
	BoundedVec::try_from(s.as_bytes().to_vec()).unwrap()
}

// ====== 联系人管理测试 ======

#[test]
fn add_contact_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;
		let alias = Some(bounded_string::<64>("Bob's alias"));
		let groups = BoundedVec::default();

		// 添加联系人
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			alias.clone(),
			groups.clone()
		));

		// 验证存储
		assert!(Contacts::contacts(alice, bob).is_some());
		assert_eq!(Contacts::contact_count(alice), 1);

		// 验证事件
		System::assert_last_event(
			Event::ContactAdded {
				who: alice,
				contact: bob,
				friend_status: FriendStatus::OneWay,
			}
			.into(),
		);
	});
}

#[test]
fn cannot_add_self_as_contact() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;

		// 尝试添加自己
		assert_noop!(
			Contacts::add_contact(
				RuntimeOrigin::signed(alice),
				alice,
				None,
				BoundedVec::default()
			),
			Error::<Test>::CannotAddSelf
		);
	});
}

#[test]
fn cannot_add_duplicate_contact() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let bob = 2u64;

		// 第一次添加成功
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			None,
			BoundedVec::default()
		));

		// 第二次添加失败
		assert_noop!(
			Contacts::add_contact(RuntimeOrigin::signed(alice), bob, None, BoundedVec::default()),
			Error::<Test>::ContactAlreadyExists
		);
	});
}

#[test]
fn mutual_friends_detection_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// Alice 添加 Bob
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			None,
			BoundedVec::default()
		));

		// 此时是单向好友
		let contact_info = Contacts::contacts(alice, bob).unwrap();
		assert_eq!(contact_info.friend_status, FriendStatus::OneWay);

		// Bob 也添加 Alice
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(bob),
			alice,
			None,
			BoundedVec::default()
		));

		// 现在应该是双向好友
		let alice_contact = Contacts::contacts(alice, bob).unwrap();
		let bob_contact = Contacts::contacts(bob, alice).unwrap();
		assert_eq!(alice_contact.friend_status, FriendStatus::Mutual);
		assert_eq!(bob_contact.friend_status, FriendStatus::Mutual);

		// 验证辅助函数
		assert!(Contacts::are_mutual_friends(&alice, &bob));
	});
}

#[test]
fn remove_contact_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// 先添加联系人
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			None,
			BoundedVec::default()
		));
		assert_eq!(Contacts::contact_count(alice), 1);

		// 删除联系人
		assert_ok!(Contacts::remove_contact(RuntimeOrigin::signed(alice), bob));

		// 验证已删除
		assert!(Contacts::contacts(alice, bob).is_none());
		assert_eq!(Contacts::contact_count(alice), 0);

		// 验证事件
		System::assert_last_event(Event::ContactRemoved { who: alice, contact: bob }.into());
	});
}

#[test]
fn remove_contact_updates_mutual_status() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// 建立双向好友关系
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			None,
			BoundedVec::default()
		));
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(bob),
			alice,
			None,
			BoundedVec::default()
		));
		assert_eq!(Contacts::contacts(bob, alice).unwrap().friend_status, FriendStatus::Mutual);

		// Alice 删除 Bob
		assert_ok!(Contacts::remove_contact(RuntimeOrigin::signed(alice), bob));

		// Bob 的好友状态应该变回单向
		let bob_contact = Contacts::contacts(bob, alice).unwrap();
		assert_eq!(bob_contact.friend_status, FriendStatus::OneWay);
	});
}

#[test]
fn update_contact_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;
		let old_alias = Some(bounded_string::<64>("Old Name"));
		let new_alias = Some(bounded_string::<64>("New Name"));

		// 添加联系人
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			old_alias.clone(),
			BoundedVec::default()
		));

		// 更新联系人
		assert_ok!(Contacts::update_contact(
			RuntimeOrigin::signed(alice),
			bob,
			new_alias.clone(),
			BoundedVec::default()
		));

		// 验证更新
		let contact_info = Contacts::contacts(alice, bob).unwrap();
		assert_eq!(contact_info.alias, new_alias);

		// 验证事件
		System::assert_last_event(Event::ContactUpdated { who: alice, contact: bob }.into());
	});
}

// ====== 分组管理测试 ======

#[test]
fn create_group_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let group_name = bounded_string::<32>("Friends");

		// 创建分组
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 验证存储
		assert!(Contacts::groups(alice, &group_name).is_some());

		// 验证事件
		System::assert_last_event(
			Event::GroupCreated { who: alice, name: group_name }.into(),
		);
	});
}

#[test]
fn cannot_create_duplicate_group() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let group_name = bounded_string::<32>("Friends");

		// 第一次创建成功
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 第二次创建失败
		assert_noop!(
			Contacts::create_group(RuntimeOrigin::signed(alice), group_name),
			Error::<Test>::GroupAlreadyExists
		);
	});
}

#[test]
fn cannot_create_empty_group() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let empty_name = BoundedVec::default();

		// 尝试创建空名称分组
		assert_noop!(
			Contacts::create_group(RuntimeOrigin::signed(alice), empty_name),
			Error::<Test>::EmptyGroupName
		);
	});
}

#[test]
fn delete_group_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let group_name = bounded_string::<32>("Friends");

		// 先创建分组
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 删除分组
		assert_ok!(Contacts::delete_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 验证已删除
		assert!(Contacts::groups(alice, &group_name).is_none());

		// 验证事件
		System::assert_last_event(Event::GroupDeleted { who: alice, name: group_name }.into());
	});
}

#[test]
fn delete_group_removes_from_contacts() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;
		let group_name = bounded_string::<32>("Friends");

		// 创建分组
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 添加联系人到分组
		let mut groups = BoundedVec::default();
		groups.try_push(group_name.clone()).unwrap();
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			None,
			groups.clone()
		));

		// 验证联系人在分组中
		let contact_info = Contacts::contacts(alice, bob).unwrap();
		assert_eq!(contact_info.groups.len(), 1);

		// 删除分组
		assert_ok!(Contacts::delete_group(RuntimeOrigin::signed(alice), group_name));

		// 验证联系人的分组列表已清空
		let updated_contact = Contacts::contacts(alice, bob).unwrap();
		assert_eq!(updated_contact.groups.len(), 0);
	});
}

#[test]
fn rename_group_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let old_name = bounded_string::<32>("OldGroup");
		let new_name = bounded_string::<32>("NewGroup");

		// 创建分组
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), old_name.clone()));

		// 重命名分组
		assert_ok!(Contacts::rename_group(
			RuntimeOrigin::signed(alice),
			old_name.clone(),
			new_name.clone()
		));

		// 验证旧分组已删除，新分组已创建
		assert!(Contacts::groups(alice, &old_name).is_none());
		assert!(Contacts::groups(alice, &new_name).is_some());

		// 验证事件
		System::assert_last_event(
			Event::GroupRenamed { who: alice, old_name, new_name }.into(),
		);
	});
}

#[test]
fn add_contact_to_group_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;
		let group_name = bounded_string::<32>("Friends");

		// 创建分组
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 添加联系人到分组
		let mut groups = BoundedVec::default();
		groups.try_push(group_name.clone()).unwrap();
		assert_ok!(Contacts::add_contact(RuntimeOrigin::signed(alice), bob, None, groups));

		// 验证联系人在分组中
		let contact_info = Contacts::contacts(alice, bob).unwrap();
		assert_eq!(contact_info.groups.len(), 1);
		assert_eq!(contact_info.groups[0], group_name);

		// 验证分组成员列表
		let members = Contacts::group_members(alice, &group_name);
		assert_eq!(members.len(), 1);
		assert_eq!(members[0], bob);

		// 验证分组成员数量
		let group_info = Contacts::groups(alice, &group_name).unwrap();
		assert_eq!(group_info.member_count, 1);
	});
}

// ====== 黑名单测试 ======

#[test]
fn block_account_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;
		let reason = Some(bounded_string::<256>("Spam"));

		// 屏蔽账户
		assert_ok!(Contacts::block_account(RuntimeOrigin::signed(alice), bob, reason));

		// 验证黑名单
		assert!(Contacts::blacklist(alice, bob).is_some());
		assert!(Contacts::is_blocked(&alice, &bob));

		// 验证事件
		System::assert_last_event(Event::AccountBlocked { who: alice, blocked: bob }.into());
	});
}

#[test]
fn block_account_removes_contact() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// 先添加为联系人
		assert_ok!(Contacts::add_contact(
			RuntimeOrigin::signed(alice),
			bob,
			None,
			BoundedVec::default()
		));
		assert_eq!(Contacts::contact_count(alice), 1);

		// 屏蔽账户
		assert_ok!(Contacts::block_account(RuntimeOrigin::signed(alice), bob, None));

		// 验证联系人已被自动删除
		assert!(Contacts::contacts(alice, bob).is_none());
		assert_eq!(Contacts::contact_count(alice), 0);
	});
}

#[test]
fn cannot_add_blocked_contact() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let bob = 2u64;

		// Bob 屏蔽 Alice
		assert_ok!(Contacts::block_account(RuntimeOrigin::signed(bob), alice, None));

		// Alice 尝试添加 Bob（应该失败）
		assert_noop!(
			Contacts::add_contact(RuntimeOrigin::signed(alice), bob, None, BoundedVec::default()),
			Error::<Test>::BlockedByOther
		);
	});
}

#[test]
fn unblock_account_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// 先屏蔽
		assert_ok!(Contacts::block_account(RuntimeOrigin::signed(alice), bob, None));
		assert!(Contacts::is_blocked(&alice, &bob));

		// 解除屏蔽
		assert_ok!(Contacts::unblock_account(RuntimeOrigin::signed(alice), bob));

		// 验证已解除
		assert!(!Contacts::is_blocked(&alice, &bob));

		// 验证事件
		System::assert_last_event(Event::AccountUnblocked { who: alice, unblocked: bob }.into());
	});
}

// ====== 好友申请测试 ======

#[test]
fn send_friend_request_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;
		let message = Some(bounded_string::<512>("Let's be friends!"));

		// 发送好友申请
		assert_ok!(Contacts::send_friend_request(
			RuntimeOrigin::signed(alice),
			bob,
			message
		));

		// 验证申请记录
		assert!(Contacts::friend_requests(bob, alice).is_some());

		// 验证事件
		System::assert_last_event(Event::FriendRequestSent { from: alice, to: bob }.into());
	});
}

#[test]
fn cannot_send_duplicate_friend_request() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let bob = 2u64;

		// 第一次发送成功
		assert_ok!(Contacts::send_friend_request(RuntimeOrigin::signed(alice), bob, None));

		// 第二次发送失败
		assert_noop!(
			Contacts::send_friend_request(RuntimeOrigin::signed(alice), bob, None),
			Error::<Test>::FriendRequestAlreadyExists
		);
	});
}

#[test]
fn accept_friend_request_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// Alice 发送好友申请给 Bob
		assert_ok!(Contacts::send_friend_request(RuntimeOrigin::signed(alice), bob, None));

		// Bob 接受申请
		assert_ok!(Contacts::accept_friend_request(RuntimeOrigin::signed(bob), alice));

		// 验证 Bob 已添加 Alice 为联系人
		assert!(Contacts::contacts(bob, alice).is_some());
		let contact_info = Contacts::contacts(bob, alice).unwrap();
		assert_eq!(contact_info.friend_status, FriendStatus::Mutual);

		// 验证申请记录已删除
		assert!(Contacts::friend_requests(bob, alice).is_none());

		// 验证事件
		System::assert_last_event(
			Event::FriendStatusChanged {
				account1: bob,
				account2: alice,
				new_status: FriendStatus::Mutual,
			}
			.into(),
		);
	});
}

#[test]
fn reject_friend_request_works() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let alice = 1u64;
		let bob = 2u64;

		// Alice 发送好友申请给 Bob
		assert_ok!(Contacts::send_friend_request(RuntimeOrigin::signed(alice), bob, None));

		// Bob 拒绝申请
		assert_ok!(Contacts::reject_friend_request(RuntimeOrigin::signed(bob), alice));

		// 验证申请记录已删除
		assert!(Contacts::friend_requests(bob, alice).is_none());

		// 验证 Bob 没有添加 Alice 为联系人
		assert!(Contacts::contacts(bob, alice).is_none());

		// 验证事件
		System::assert_last_event(
			Event::FriendRequestRejected { who: bob, requester: alice }.into(),
		);
	});
}

#[test]
fn friend_request_expiry_works() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let bob = 2u64;

		// 在第1个区块发送申请
		System::set_block_number(1);
		assert_ok!(Contacts::send_friend_request(RuntimeOrigin::signed(alice), bob, None));

		// 在过期后尝试接受
		System::set_block_number(100801 + 1); // 超过过期时间
		assert_noop!(
			Contacts::accept_friend_request(RuntimeOrigin::signed(bob), alice),
			Error::<Test>::FriendRequestExpired
		);
	});
}

// ====== 辅助函数测试 ======

#[test]
fn get_all_contacts_works() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;

		// 添加多个联系人
		for i in 2..6 {
			assert_ok!(Contacts::add_contact(
				RuntimeOrigin::signed(alice),
				i,
				None,
				BoundedVec::default()
			));
		}

		// 获取所有联系人
		let contacts = Contacts::get_all_contacts(&alice);
		assert_eq!(contacts.len(), 4);
		assert!(contacts.contains(&2));
		assert!(contacts.contains(&3));
		assert!(contacts.contains(&4));
		assert!(contacts.contains(&5));
	});
}

#[test]
fn get_group_members_works() {
	new_test_ext().execute_with(|| {
		let alice = 1u64;
		let group_name = bounded_string::<32>("Friends");

		// 创建分组
		assert_ok!(Contacts::create_group(RuntimeOrigin::signed(alice), group_name.clone()));

		// 添加多个联系人到分组
		let mut groups = BoundedVec::default();
		groups.try_push(group_name.clone()).unwrap();

		for i in 2..5 {
			assert_ok!(Contacts::add_contact(
				RuntimeOrigin::signed(alice),
				i,
				None,
				groups.clone()
			));
		}

		// 获取分组成员
		let members = Contacts::get_group_members(&alice, &group_name);
		assert_eq!(members.len(), 3);
		assert!(members.contains(&2));
		assert!(members.contains(&3));
		assert!(members.contains(&4));
	});
}
