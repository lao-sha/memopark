//! # Chat Pallet 单元测试
//! 
//! 测试所有核心功能

use crate::{mock::*, Error, Event, MessageType};
use frame_support::{assert_noop, assert_ok};

/// 测试账户
const ALICE: u64 = 1;
const BOB: u64 = 2;
const CHARLIE: u64 = 3;

// ============================================================================
// 基础功能测试
// ============================================================================

#[test]
fn test_send_message_works() {
	new_test_ext().execute_with(|| {
		// 准备
		let cid = encrypted_cid(1);
		
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			cid.clone(),
			0, // Text
			None
		));

		// 验证：消息已创建
		let msg = Chat::get_message(0).unwrap();
		assert_eq!(msg.sender, ALICE);
		assert_eq!(msg.receiver, BOB);
		assert_eq!(msg.content_cid.to_vec(), cid);
		assert_eq!(msg.msg_type, MessageType::Text);
		assert_eq!(msg.is_read, false);
		assert_eq!(msg.is_deleted_by_sender, false);
		assert_eq!(msg.is_deleted_by_receiver, false);

		// 验证：会话已创建
		let sessions = Chat::list_sessions(ALICE);
		assert_eq!(sessions.len(), 1);

		// 验证：未读计数增加
		let unread = Chat::get_unread_count(BOB, None);
		assert_eq!(unread, 1);

		// 验证：事件已触发
		System::assert_last_event(
			Event::MessageSent {
				msg_id: 0,
				session_id: msg.session_id,
				sender: ALICE,
				receiver: BOB,
			}.into()
		);
	});
}

#[test]
fn test_send_message_rejects_unencrypted_cid() {
	new_test_ext().execute_with(|| {
		// 尝试发送未加密的CID
		let unencrypted = unencrypted_cid();
		
		assert_noop!(
			Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				unencrypted,
				0,
				None
			),
			Error::<Test>::CidNotEncrypted
		);
	});
}

#[test]
fn test_send_message_rejects_cid_too_long() {
	new_test_ext().execute_with(|| {
		// CID超过100字节
		let too_long_cid = vec![0u8; 101];
		
		assert_noop!(
			Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				too_long_cid,
				0,
				None
			),
			Error::<Test>::CidTooLong
		);
	});
}

#[test]
fn test_multiple_messages_same_session() {
	new_test_ext().execute_with(|| {
		// 发送第一条消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		let session_id = Chat::get_message(0).unwrap().session_id;

		// 发送第二条消息（使用相同会话）
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(2),
			0,
			Some(session_id)
		));

		// BOB回复
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(BOB),
			ALICE,
			encrypted_cid(3),
			0,
			Some(session_id)
		));

		// 验证：会话只有一个
		let alice_sessions = Chat::list_sessions(ALICE);
		assert_eq!(alice_sessions.len(), 1);

		// 验证：会话消息列表有3条
		let messages = Chat::list_messages_by_session(session_id, 0, 100);
		assert_eq!(messages.len(), 3);

		// 验证：未读计数正确（BOB有2条未读，ALICE有1条未读）
		assert_eq!(Chat::get_unread_count(BOB, Some(session_id)), 2);
		assert_eq!(Chat::get_unread_count(ALICE, Some(session_id)), 1);
	});
}

// ============================================================================
// 已读未读功能测试
// ============================================================================

#[test]
fn test_mark_as_read_works() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// BOB标记已读
		assert_ok!(Chat::mark_as_read(RuntimeOrigin::signed(BOB), 0));

		// 验证：消息已读
		let msg = Chat::get_message(0).unwrap();
		assert_eq!(msg.is_read, true);

		// 验证：未读计数减少
		let unread = Chat::get_unread_count(BOB, None);
		assert_eq!(unread, 0);

		// 验证：事件已触发
		System::assert_last_event(
			Event::MessageRead {
				msg_id: 0,
				reader: BOB,
			}.into()
		);
	});
}

#[test]
fn test_mark_as_read_rejects_non_receiver() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// CHARLIE尝试标记已读
		assert_noop!(
			Chat::mark_as_read(RuntimeOrigin::signed(CHARLIE), 0),
			Error::<Test>::NotReceiver
		);
	});
}

#[test]
fn test_mark_batch_as_read_works() {
	new_test_ext().execute_with(|| {
		// 发送3条消息
		for i in 1..=3 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		// 验证：BOB有3条未读
		assert_eq!(Chat::get_unread_count(BOB, None), 3);

		// BOB批量标记已读
		assert_ok!(Chat::mark_batch_as_read(
			RuntimeOrigin::signed(BOB),
			vec![0, 1, 2]
		));

		// 验证：所有消息已读
		assert!(Chat::get_message(0).unwrap().is_read);
		assert!(Chat::get_message(1).unwrap().is_read);
		assert!(Chat::get_message(2).unwrap().is_read);

		// 验证：未读计数清零
		assert_eq!(Chat::get_unread_count(BOB, None), 0);
	});
}

#[test]
fn test_mark_batch_as_read_rejects_empty_list() {
	new_test_ext().execute_with(|| {
		assert_noop!(
			Chat::mark_batch_as_read(RuntimeOrigin::signed(BOB), vec![]),
			Error::<Test>::EmptyMessageList
		);
	});
}

#[test]
fn test_mark_session_as_read_works() {
	new_test_ext().execute_with(|| {
		// 发送3条消息
		for i in 1..=3 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		let session_id = Chat::get_message(0).unwrap().session_id;

		// BOB标记整个会话已读
		assert_ok!(Chat::mark_session_as_read(
			RuntimeOrigin::signed(BOB),
			session_id
		));

		// 验证：所有消息已读
		assert!(Chat::get_message(0).unwrap().is_read);
		assert!(Chat::get_message(1).unwrap().is_read);
		assert!(Chat::get_message(2).unwrap().is_read);

		// 验证：未读计数清零
		assert_eq!(Chat::get_unread_count(BOB, Some(session_id)), 0);
	});
}

// ============================================================================
// 删除功能测试
// ============================================================================

#[test]
fn test_delete_message_by_sender() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// ALICE删除消息
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), 0));

		// 验证：消息已软删除（仅对发送方）
		let msg = Chat::get_message(0).unwrap();
		assert_eq!(msg.is_deleted_by_sender, true);
		assert_eq!(msg.is_deleted_by_receiver, false);

		// 验证：事件已触发
		System::assert_last_event(
			Event::MessageDeleted {
				msg_id: 0,
				deleter: ALICE,
			}.into()
		);
	});
}

#[test]
fn test_delete_message_by_receiver() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// BOB删除消息
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), 0));

		// 验证：消息已软删除（仅对接收方）
		let msg = Chat::get_message(0).unwrap();
		assert_eq!(msg.is_deleted_by_sender, false);
		assert_eq!(msg.is_deleted_by_receiver, true);
	});
}

#[test]
fn test_delete_message_rejects_unauthorized() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// CHARLIE尝试删除消息
		assert_noop!(
			Chat::delete_message(RuntimeOrigin::signed(CHARLIE), 0),
			Error::<Test>::NotAuthorized
		);
	});
}

// ============================================================================
// 会话管理测试
// ============================================================================

#[test]
fn test_list_sessions_works() {
	new_test_ext().execute_with(|| {
		// ALICE与BOB聊天
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// ALICE与CHARLIE聊天
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			CHARLIE,
			encrypted_cid(2),
			0,
			None
		));

		// 验证：ALICE有2个会话
		let sessions = Chat::list_sessions(ALICE);
		assert_eq!(sessions.len(), 2);

		// 验证：BOB和CHARLIE各有1个会话
		assert_eq!(Chat::list_sessions(BOB).len(), 1);
		assert_eq!(Chat::list_sessions(CHARLIE).len(), 1);
	});
}

#[test]
fn test_archive_session_works() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		let session_id = Chat::get_message(0).unwrap().session_id;

		// ALICE归档会话
		assert_ok!(Chat::archive_session(
			RuntimeOrigin::signed(ALICE),
			session_id
		));

		// 验证：会话已归档
		let session = Chat::get_session(session_id).unwrap();
		assert_eq!(session.is_archived, true);

		// 验证：事件已触发
		System::assert_last_event(
			Event::SessionArchived {
				session_id,
				operator: ALICE,
			}.into()
		);
	});
}

#[test]
fn test_archive_session_rejects_non_participant() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		let session_id = Chat::get_message(0).unwrap().session_id;

		// CHARLIE尝试归档会话
		assert_noop!(
			Chat::archive_session(RuntimeOrigin::signed(CHARLIE), session_id),
			Error::<Test>::NotSessionParticipant
		);
	});
}

// ============================================================================
// 查询功能测试
// ============================================================================

#[test]
fn test_get_message_works() {
	new_test_ext().execute_with(|| {
		// 发送消息
		let cid = encrypted_cid(1);
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			cid.clone(),
			0,
			None
		));

		// 查询消息
		let msg = Chat::get_message(0);
		assert!(msg.is_some());
		assert_eq!(msg.unwrap().content_cid.to_vec(), cid);
	});
}

#[test]
fn test_get_message_returns_none() {
	new_test_ext().execute_with(|| {
		// 查询不存在的消息
		let msg = Chat::get_message(999);
		assert!(msg.is_none());
	});
}

#[test]
fn test_list_messages_by_session_works() {
	new_test_ext().execute_with(|| {
		// 发送5条消息
		for i in 1..=5 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		let session_id = Chat::get_message(0).unwrap().session_id;

		// 查询全部消息
		let messages = Chat::list_messages_by_session(session_id, 0, 100);
		assert_eq!(messages.len(), 5);

		// 验证：倒序返回（最新的在前）
		assert_eq!(messages[0], 4); // 最新消息
		assert_eq!(messages[4], 0); // 最早消息

		// 测试分页：跳过2条，取2条
		let page2 = Chat::list_messages_by_session(session_id, 2, 2);
		assert_eq!(page2.len(), 2);
		assert_eq!(page2[0], 2);
		assert_eq!(page2[1], 1);
	});
}

#[test]
fn test_list_messages_pagination() {
	new_test_ext().execute_with(|| {
		// 发送10条消息
		for i in 1..=10 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		let session_id = Chat::get_message(0).unwrap().session_id;

		// 第一页：0-2
		let page1 = Chat::list_messages_by_session(session_id, 0, 3);
		assert_eq!(page1.len(), 3);
		assert_eq!(page1, vec![9, 8, 7]); // 倒序

		// 第二页：3-5
		let page2 = Chat::list_messages_by_session(session_id, 3, 3);
		assert_eq!(page2.len(), 3);
		assert_eq!(page2, vec![6, 5, 4]);

		// 超出范围
		let page_empty = Chat::list_messages_by_session(session_id, 100, 10);
		assert_eq!(page_empty.len(), 0);
	});
}

#[test]
fn test_get_unread_count_works() {
	new_test_ext().execute_with(|| {
		// 初始未读数为0
		assert_eq!(Chat::get_unread_count(BOB, None), 0);

		// ALICE发送2条消息给BOB
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(2),
			0,
			None
		));

		// CHARLIE发送1条消息给BOB
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(CHARLIE),
			BOB,
			encrypted_cid(3),
			0,
			None
		));

		// 验证：BOB总未读数为3
		assert_eq!(Chat::get_unread_count(BOB, None), 3);

		// 验证：指定会话的未读数
		let session_id = Chat::get_message(0).unwrap().session_id;
		assert_eq!(Chat::get_unread_count(BOB, Some(session_id)), 2);
	});
}

#[test]
fn test_get_session_works() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		let session_id = Chat::get_message(0).unwrap().session_id;

		// 查询会话
		let session = Chat::get_session(session_id);
		assert!(session.is_some());

		let s = session.unwrap();
		assert_eq!(s.participants.len(), 2);
		assert!(s.participants.contains(&ALICE));
		assert!(s.participants.contains(&BOB));
		assert_eq!(s.last_message_id, 0);
		assert_eq!(s.is_archived, false);
	});
}

// ============================================================================
// 消息类型测试
// ============================================================================

#[test]
fn test_different_message_types() {
	new_test_ext().execute_with(|| {
		// 文本消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0, // Text
			None
		));
		assert_eq!(Chat::get_message(0).unwrap().msg_type, MessageType::Text);

		// 图片消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(2),
			1, // Image
			None
		));
		assert_eq!(Chat::get_message(1).unwrap().msg_type, MessageType::Image);

		// 文件消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(3),
			2, // File
			None
		));
		assert_eq!(Chat::get_message(2).unwrap().msg_type, MessageType::File);

		// 语音消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(4),
			3, // Voice
			None
		));
		assert_eq!(Chat::get_message(3).unwrap().msg_type, MessageType::Voice);

		// 系统消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(5),
			4, // System
			None
		));
		assert_eq!(Chat::get_message(4).unwrap().msg_type, MessageType::System);

		// 未知类型默认为Text
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(6),
			99, // Unknown
			None
		));
		assert_eq!(Chat::get_message(5).unwrap().msg_type, MessageType::Text);
	});
}

// ============================================================================
// 边界条件测试
// ============================================================================

#[test]
fn test_session_id_deterministic() {
	new_test_ext().execute_with(|| {
		// ALICE -> BOB
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));
		let session_id1 = Chat::get_message(0).unwrap().session_id;

		// BOB -> ALICE (应该是同一个会话)
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(BOB),
			ALICE,
			encrypted_cid(2),
			0,
			None
		));
		let session_id2 = Chat::get_message(1).unwrap().session_id;

		// 验证：会话ID相同
		assert_eq!(session_id1, session_id2);

		// 验证：ALICE和BOB都只有一个会话
		assert_eq!(Chat::list_sessions(ALICE).len(), 1);
		assert_eq!(Chat::list_sessions(BOB).len(), 1);
	});
}

#[test]
fn test_duplicate_mark_as_read() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// 第一次标记已读
		assert_ok!(Chat::mark_as_read(RuntimeOrigin::signed(BOB), 0));
		assert_eq!(Chat::get_unread_count(BOB, None), 0);

		// 第二次标记已读（应该成功但不影响计数）
		assert_ok!(Chat::mark_as_read(RuntimeOrigin::signed(BOB), 0));
		assert_eq!(Chat::get_unread_count(BOB, None), 0);
	});
}

#[test]
fn test_cid_encryption_check() {
	new_test_ext().execute_with(|| {
		// 测试加密CID（长度>50）
		let encrypted = encrypted_cid(1);
		assert!(Chat::is_cid_encrypted(&encrypted));

		// 测试未加密CID（标准CIDv0，46字节，以Qm开头）
		let unencrypted = unencrypted_cid();
		assert!(!Chat::is_cid_encrypted(&unencrypted));

		// 测试太短的CID
		let too_short = b"short".to_vec();
		assert!(!Chat::is_cid_encrypted(&too_short));
	});
}

// ============================================================================
// P1新功能测试：黑名单
// ============================================================================

#[test]
fn test_block_user_works() {
	new_test_ext().execute_with(|| {
		// ALICE拉黑BOB
		assert_ok!(Chat::block_user(RuntimeOrigin::signed(ALICE), BOB));

		// 验证：BOB已被ALICE拉黑
		assert!(Chat::is_blocked(ALICE, BOB));

		// 验证：事件已触发
		System::assert_last_event(
			Event::UserBlocked {
				blocker: ALICE,
				blocked: BOB,
			}.into()
		);
	});
}

#[test]
fn test_block_user_rejects_self() {
	new_test_ext().execute_with(|| {
		// 不能拉黑自己
		assert_noop!(
			Chat::block_user(RuntimeOrigin::signed(ALICE), ALICE),
			Error::<Test>::CannotBlockSelf
		);
	});
}

#[test]
fn test_unblock_user_works() {
	new_test_ext().execute_with(|| {
		// ALICE拉黑BOB
		assert_ok!(Chat::block_user(RuntimeOrigin::signed(ALICE), BOB));
		assert!(Chat::is_blocked(ALICE, BOB));

		// ALICE解除拉黑
		assert_ok!(Chat::unblock_user(RuntimeOrigin::signed(ALICE), BOB));
		assert!(!Chat::is_blocked(ALICE, BOB));

		// 验证：事件已触发
		System::assert_last_event(
			Event::UserUnblocked {
				unblocker: ALICE,
				unblocked: BOB,
			}.into()
		);
	});
}

#[test]
fn test_send_message_blocked_by_receiver() {
	new_test_ext().execute_with(|| {
		// BOB拉黑ALICE
		assert_ok!(Chat::block_user(RuntimeOrigin::signed(BOB), ALICE));

		// ALICE尝试给BOB发消息
		assert_noop!(
			Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(1),
				0,
				None
			),
			Error::<Test>::ReceiverBlockedSender
		);
	});
}

#[test]
fn test_list_blocked_users() {
	new_test_ext().execute_with(|| {
		// ALICE拉黑BOB和CHARLIE
		assert_ok!(Chat::block_user(RuntimeOrigin::signed(ALICE), BOB));
		assert_ok!(Chat::block_user(RuntimeOrigin::signed(ALICE), CHARLIE));

		// 查询黑名单
		let blocked_list = Chat::list_blocked_users(ALICE);
		assert_eq!(blocked_list.len(), 2);
		assert!(blocked_list.contains(&BOB));
		assert!(blocked_list.contains(&CHARLIE));
	});
}

// ============================================================================
// P1新功能测试：频率限制
// ============================================================================

#[test]
fn test_rate_limit_works() {
	new_test_ext().execute_with(|| {
		// 发送10条消息（达到上限）
		for i in 1..=10 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		// 尝试发送第11条消息（超过限制）
		assert_noop!(
			Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(11),
				0,
				None
			),
			Error::<Test>::RateLimitExceeded
		);
	});
}

#[test]
fn test_rate_limit_resets_after_window() {
	new_test_ext().execute_with(|| {
		// 发送10条消息（达到上限）
		for i in 1..=10 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		// 超过限制
		assert_noop!(
			Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(11),
				0,
				None
			),
			Error::<Test>::RateLimitExceeded
		);

		// 推进区块（超过窗口期）
		System::set_block_number(System::block_number() + 101);

		// 窗口期重置后，可以再次发送
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(11),
			0,
			None
		));
	});
}

// ============================================================================
// P1新功能测试：分别软删除
// ============================================================================

#[test]
fn test_delete_message_sender_and_receiver_separate() {
	new_test_ext().execute_with(|| {
		// 发送消息
		assert_ok!(Chat::send_message(
			RuntimeOrigin::signed(ALICE),
			BOB,
			encrypted_cid(1),
			0,
			None
		));

		// ALICE（发送方）删除
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), 0));

		let msg = Chat::get_message(0).unwrap();
		assert_eq!(msg.is_deleted_by_sender, true);
		assert_eq!(msg.is_deleted_by_receiver, false);

		// BOB（接收方）也删除
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), 0));

		let msg = Chat::get_message(0).unwrap();
		assert_eq!(msg.is_deleted_by_sender, true);
		assert_eq!(msg.is_deleted_by_receiver, true);
	});
}

// ============================================================================
// P1新功能测试：无限消息和会话
// ============================================================================

#[test]
fn test_unlimited_messages_in_session() {
	new_test_ext().execute_with(|| {
		// 发送超过1000条消息（旧的BoundedVec限制）
		// 使用频率限制窗口，每100个区块发送10条
		let mut total_sent = 0;
		for batch in 0..105 {
			// 推进区块（超过窗口期以重置频率限制）
			System::set_block_number(batch * 101 + 1);
			
			// 发送10条消息
			for _ in 0..10 {
				if total_sent >= 1050 {
					break; // 发送1050条即可证明突破限制
				}
				assert_ok!(Chat::send_message(
					RuntimeOrigin::signed(ALICE),
					BOB,
					encrypted_cid((total_sent % 256) as u8),
					0,
					None
				));
				total_sent += 1;
			}
			if total_sent >= 1050 {
				break;
			}
		}

		// 验证：消息数量超过1000
		let session_id = Chat::get_message(0).unwrap().session_id;
		
		// 验证：能查询到最新的100条消息
		let messages = Chat::list_messages_by_session(session_id, 0, 100);
		assert_eq!(messages.len(), 100); // 查询最新100条（limit被限制为100）

		// 验证：能查询到更多消息（分页）
		let messages_page2 = Chat::list_messages_by_session(session_id, 100, 100);
		assert_eq!(messages_page2.len(), 100);
		
		let messages_page3 = Chat::list_messages_by_session(session_id, 200, 100);
		assert_eq!(messages_page3.len(), 100);
		
		// 验证：总消息数已超过1000（证明突破了旧的BoundedVec限制）
		assert_eq!(total_sent, 1050);
		
		// 分页查询多次，验证至少有1000条消息
		let mut all_msg_count = 0;
		for page in 0..11 {
			let msgs = Chat::list_messages_by_session(session_id, page * 100, 100);
			all_msg_count += msgs.len();
			if msgs.len() < 100 {
				break;
			}
		}
		assert!(all_msg_count >= 1000);
	});
}

// ============================================================================
// P2 新功能测试
// ============================================================================

#[test]
fn test_cleanup_old_messages_works() {
	new_test_ext().execute_with(|| {
		// 发送3条消息
		for i in 0..3 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		// 双方都删除消息
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), 0));
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), 0));
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), 1));
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), 1));

		// 推进区块，使消息过期（超过1000个区块）
		System::set_block_number(1002);

		// 验证：消息存在
		assert!(Chat::get_message(0).is_some());
		assert!(Chat::get_message(1).is_some());
		assert!(Chat::get_message(2).is_some());

		// 执行清理（只清理双方都删除的消息）
		assert_ok!(Chat::cleanup_old_messages(RuntimeOrigin::signed(CHARLIE), 100));

		// 验证：双方都删除的消息被清理
		assert!(Chat::get_message(0).is_none());
		assert!(Chat::get_message(1).is_none());
		// 验证：未被双方都删除的消息仍存在
		assert!(Chat::get_message(2).is_some());

		// 验证：事件已触发
		System::assert_has_event(
			Event::OldMessagesCleanedUp {
				operator: CHARLIE,
				count: 2,
			}
			.into(),
		);
	});
}

#[test]
fn test_cleanup_old_messages_with_limit() {
	new_test_ext().execute_with(|| {
		// 发送5条消息并双方都删除
		for i in 0..5 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
			assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), i as u64));
			assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), i as u64));
		}

		// 推进区块，使消息过期
		System::set_block_number(1002);

		// 执行清理，限制只清理3条
		assert_ok!(Chat::cleanup_old_messages(RuntimeOrigin::signed(CHARLIE), 3));

		// 验证：只清理了3条消息
		let mut cleaned = 0;
		for i in 0..5 {
			if Chat::get_message(i).is_none() {
				cleaned += 1;
			}
		}
		assert_eq!(cleaned, 3);
	});
}

#[test]
fn test_cleanup_old_messages_rejects_invalid_limit() {
	new_test_ext().execute_with(|| {
		// 验证：limit = 0 被拒绝
		assert_noop!(
			Chat::cleanup_old_messages(RuntimeOrigin::signed(ALICE), 0),
			Error::<Test>::InvalidCleanupLimit
		);

		// 验证：limit > 1000 被拒绝
		assert_noop!(
			Chat::cleanup_old_messages(RuntimeOrigin::signed(ALICE), 1001),
			Error::<Test>::InvalidCleanupLimit
		);
	});
}

#[test]
fn test_cleanup_only_removes_fully_deleted_messages() {
	new_test_ext().execute_with(|| {
		// 发送3条消息
		for i in 0..3 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
		}

		// 只有发送方删除消息0
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), 0));
		// 只有接收方删除消息1
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), 1));
		// 双方都删除消息2
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), 2));
		assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), 2));

		// 推进区块，使消息过期
		System::set_block_number(1002);

		// 执行清理
		assert_ok!(Chat::cleanup_old_messages(RuntimeOrigin::signed(CHARLIE), 100));

		// 验证：只有消息2被清理（双方都删除）
		assert!(Chat::get_message(0).is_some()); // 只有发送方删除
		assert!(Chat::get_message(1).is_some()); // 只有接收方删除
		assert!(Chat::get_message(2).is_none()); // 双方都删除
	});
}

#[test]
fn test_cleanup_respects_expiration_time() {
	new_test_ext().execute_with(|| {
		// 发送2条消息并双方都删除
		for i in 0..2 {
			assert_ok!(Chat::send_message(
				RuntimeOrigin::signed(ALICE),
				BOB,
				encrypted_cid(i),
				0,
				None
			));
			assert_ok!(Chat::delete_message(RuntimeOrigin::signed(ALICE), i as u64));
			assert_ok!(Chat::delete_message(RuntimeOrigin::signed(BOB), i as u64));
		}

		// 推进区块，但未超过过期时间（<1000）
		System::set_block_number(500);

		// 执行清理
		assert_ok!(Chat::cleanup_old_messages(RuntimeOrigin::signed(CHARLIE), 100));

		// 验证：消息未被清理（因为未过期）
		assert!(Chat::get_message(0).is_some());
		assert!(Chat::get_message(1).is_some());

		// 推进区块，超过过期时间
		System::set_block_number(1002);

		// 再次执行清理
		assert_ok!(Chat::cleanup_old_messages(RuntimeOrigin::signed(CHARLIE), 100));

		// 验证：消息被清理
		assert!(Chat::get_message(0).is_none());
		assert!(Chat::get_message(1).is_none());
	});
}

