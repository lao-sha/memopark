use crate::{mock::*, Error, Event, DepositPurpose, DepositStatus};
use frame_support::{assert_noop, assert_ok};
use sp_runtime::Perbill;

/// 辅助函数：获取最后一个事件
fn last_event() -> RuntimeEvent {
	System::events().pop().expect("Expected at least one event").event
}

#[test]
fn reserve_deposit_works() {
	new_test_ext().execute_with(|| {
		let alice = 1;
		let amount = 100;

		// 初始余额
		assert_eq!(Balances::free_balance(&alice), 10000);
		assert_eq!(Balances::reserved_balance(&alice), 0);

		// 创建押金用途
		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};

		// 冻结押金
		assert_ok!(Deposits::reserve_deposit(
			RuntimeOrigin::signed(alice),
			purpose.clone(),
			amount
		));

		// 验证余额变化
		assert_eq!(Balances::free_balance(&alice), 9900);
		assert_eq!(Balances::reserved_balance(&alice), 100);

		// 验证押金记录
		let deposit = Deposits::deposits(0).unwrap();
		assert_eq!(deposit.who, alice);
		assert_eq!(deposit.amount, amount);
		assert_eq!(deposit.purpose, purpose);
		assert_eq!(deposit.status, DepositStatus::Reserved);

		// 验证账户索引
		let ids = Deposits::deposits_by_account(alice);
		assert_eq!(ids.len(), 1);
		assert_eq!(ids[0], 0);

		// 验证事件
		assert_eq!(
			last_event(),
			RuntimeEvent::Deposits(Event::DepositReserved {
				deposit_id: 0,
				who: alice,
				amount,
				purpose
			})
		);
	});
}

#[test]
fn reserve_deposit_fails_insufficient_balance() {
	new_test_ext().execute_with(|| {
		let alice = 1;

		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};

		// 尝试冻结超过余额的押金
		assert_noop!(
			Deposits::reserve_deposit(RuntimeOrigin::signed(alice), purpose, 20000),
			Error::<Test>::InsufficientBalance
		);
	});
}

#[test]
fn reserve_deposit_creates_multiple_deposits() {
	new_test_ext().execute_with(|| {
		let alice = 1;

		// 创建3个押金
		for i in 1..=3 {
			let purpose = DepositPurpose::Appeal {
				appeal_id: i,
				domain: 1,
				target: 123,
				action: 10,
			};

			assert_ok!(Deposits::reserve_deposit(
				RuntimeOrigin::signed(alice),
				purpose,
				100
			));
		}

		// 验证余额
		assert_eq!(Balances::free_balance(&alice), 9700);
		assert_eq!(Balances::reserved_balance(&alice), 300);

		// 验证索引
		let ids = Deposits::deposits_by_account(alice);
		assert_eq!(ids.len(), 3);
		assert_eq!(ids.to_vec(), vec![0, 1, 2]);

		// 验证NextDepositId
		assert_eq!(Deposits::next_deposit_id(), 3);
	});
}

#[test]
fn release_deposit_works() {
	new_test_ext().execute_with(|| {
		let alice = 1;
		let amount = 100;

		// 先冻结押金
		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};
		assert_ok!(Deposits::reserve_deposit(
			RuntimeOrigin::signed(alice),
			purpose,
			amount
		));

		// 释放押金
		assert_ok!(Deposits::release_deposit(RuntimeOrigin::root(), 0));

		// 验证余额恢复
		assert_eq!(Balances::free_balance(&alice), 10000);
		assert_eq!(Balances::reserved_balance(&alice), 0);

		// 验证状态更新
		let deposit = Deposits::deposits(0).unwrap();
		assert_eq!(deposit.status, DepositStatus::Released);
		assert!(deposit.released_at.is_some());

		// 验证事件
		assert_eq!(
			last_event(),
			RuntimeEvent::Deposits(Event::DepositReleased {
				deposit_id: 0,
				who: alice,
				amount
			})
		);
	});
}

#[test]
fn release_deposit_fails_invalid_status() {
	new_test_ext().execute_with(|| {
		let alice = 1;

		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};
		assert_ok!(Deposits::reserve_deposit(
			RuntimeOrigin::signed(alice),
			purpose,
			100
		));

		// 第一次释放成功
		assert_ok!(Deposits::release_deposit(RuntimeOrigin::root(), 0));

		// 第二次释放失败（已经是Released状态）
		assert_noop!(
			Deposits::release_deposit(RuntimeOrigin::root(), 0),
			Error::<Test>::InvalidStatus
		);
	});
}

#[test]
fn release_deposit_fails_not_found() {
	new_test_ext().execute_with(|| {
		// 尝试释放不存在的押金
		assert_noop!(
			Deposits::release_deposit(RuntimeOrigin::root(), 999),
			Error::<Test>::DepositNotFound
		);
	});
}

#[test]
fn slash_deposit_works_partial() {
	new_test_ext().execute_with(|| {
		let alice = 1;
		let treasury = 100;
		let amount = 100;

		// 冻结押金
		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};
		assert_ok!(Deposits::reserve_deposit(
			RuntimeOrigin::signed(alice),
			purpose,
			amount
		));

		// 罚没30%
		let slash_ratio = Perbill::from_percent(30);
		assert_ok!(Deposits::slash_deposit(RuntimeOrigin::root(), 0, slash_ratio, treasury));

		// 验证余额变化
		assert_eq!(Balances::free_balance(&alice), 9970); // 9900 + 70退回
		assert_eq!(Balances::free_balance(&treasury), 30); // 30罚没

		// 验证状态
		let deposit = Deposits::deposits(0).unwrap();
		match deposit.status {
			DepositStatus::PartiallySlashed { amount: slashed } => {
				assert_eq!(slashed, 30);
			},
			_ => panic!("Expected PartiallySlashed status"),
		}
	});
}

#[test]
fn slash_deposit_works_full() {
	new_test_ext().execute_with(|| {
		let alice = 1;
		let treasury = 100;
		let amount = 100;

		// 冻结押金
		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};
		assert_ok!(Deposits::reserve_deposit(
			RuntimeOrigin::signed(alice),
			purpose,
			amount
		));

		// 罚没100%
		let slash_ratio = Perbill::from_percent(100);
		assert_ok!(Deposits::slash_deposit(RuntimeOrigin::root(), 0, slash_ratio, treasury));

		// 验证余额变化
		assert_eq!(Balances::free_balance(&alice), 9900); // 无退回
		assert_eq!(Balances::free_balance(&treasury), 100); // 全部罚没

		// 验证状态
		let deposit = Deposits::deposits(0).unwrap();
		assert_eq!(deposit.status, DepositStatus::Slashed);
	});
}

#[test]
fn slash_deposit_fails_invalid_status() {
	new_test_ext().execute_with(|| {
		let alice = 1;
		let treasury = 100;

		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};
		assert_ok!(Deposits::reserve_deposit(
			RuntimeOrigin::signed(alice),
			purpose,
			100
		));

		// 先释放
		assert_ok!(Deposits::release_deposit(RuntimeOrigin::root(), 0));

		// 尝试罚没已释放的押金
		assert_noop!(
			Deposits::slash_deposit(
				RuntimeOrigin::root(),
				0,
				Perbill::from_percent(30),
				treasury
			),
			Error::<Test>::InvalidStatus
		);
	});
}

#[test]
fn deposit_manager_trait_works() {
	new_test_ext().execute_with(|| {
		use crate::DepositManager;

		let alice = 1;
		let treasury = 100;

		// 通过trait冻结押金
		let purpose = DepositPurpose::Appeal {
			appeal_id: 1,
			domain: 1,
			target: 123,
			action: 10,
		};
		let deposit_id = Deposits::reserve(&alice, 100, purpose).unwrap();
		assert_eq!(deposit_id, 0);

		// 验证押金已冻结
		assert_eq!(Balances::reserved_balance(&alice), 100);

		// 通过trait释放押金
		assert_ok!(Deposits::release(deposit_id));
		assert_eq!(Balances::reserved_balance(&alice), 0);

		// 再次冻结
		let purpose2 = DepositPurpose::Appeal {
			appeal_id: 2,
			domain: 1,
			target: 123,
			action: 10,
		};
		let deposit_id2 = Deposits::reserve(&alice, 100, purpose2).unwrap();

		// 通过trait罚没押金
		assert_ok!(Deposits::slash(deposit_id2, Perbill::from_percent(30), &treasury));
		assert_eq!(Balances::free_balance(&treasury), 30);
	});
}

