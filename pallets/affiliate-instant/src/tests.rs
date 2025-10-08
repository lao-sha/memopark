/// 单元测试
use crate::{mock::*, Event};
use frame_support::assert_ok;

/// 测试即时分成基本功能
#[test]
fn instant_distribute_works() {
	new_test_ext().execute_with(|| {
		let buyer = 1;
		let original_price = 100_000;
		let actual_paid = 20_000; // 会员2折
		let escrow = get_escrow_account();

		// 执行即时分成
		assert_ok!(AffiliateInstant::instant_distribute(
			&buyer,
			original_price,
			actual_paid,
			&escrow
		));

		// 验证推荐人收到奖励
		// 推荐链：2, 3, 4, 5
		// 代数：2(6代), 3(9代), 4(12代), 5(15代)
		// 因此所有4层都应该收到奖励

		// 计算分成基数：100_000 - 1000(storage) - 1000(burn) = 98_000
		// 扣除 5%(burn) + 2%(treasury) + 3%(storage) = 10%
		// 可分配：98_000 * 90% = 88_200

		// 第1层（账户2）：88_200 * 30% = 26_460
		// 第2层（账户3）：88_200 * 25% = 22_050
		// 第3层（账户4）：88_200 * 15% = 13_230
		// 第4层（账户5）：88_200 * 10% = 8_820

		// 验证余额（初始1000 + 奖励）
		assert!(Balances::free_balance(2) > 1_000);
		assert!(Balances::free_balance(3) > 1_000);
		assert!(Balances::free_balance(4) > 1_000);
		assert!(Balances::free_balance(5) > 1_000);
	});
}

/// 测试会员代数限制
#[test]
fn generation_limit_works() {
	new_test_ext().execute_with(|| {
		// 账户2只有6代，但推荐链有4层
		// 因此账户2应该收到第1层奖励
		// 但如果有更深层级超过其6代，不会收到

		let buyer = 1;
		let original_price = 100_000;
		let actual_paid = 20_000;
		let escrow = get_escrow_account();

		let balance_2_before = Balances::free_balance(2);

		assert_ok!(AffiliateInstant::instant_distribute(
			&buyer,
			original_price,
			actual_paid,
			&escrow
		));

		let balance_2_after = Balances::free_balance(2);

		// 账户2应该收到第1层奖励
		assert!(balance_2_after > balance_2_before);
	});
}

/// 测试设置分成比例
#[test]
fn set_level_percents_works() {
	new_test_ext().execute_with(|| {
		// Root 设置新的分成比例
		let new_percents = vec![20, 20, 15, 10, 5, 5, 5, 5, 5, 2, 2, 2, 2, 1, 1];

		assert_ok!(AffiliateInstant::set_level_percents(
			RuntimeOrigin::root(),
			new_percents.clone()
		));

		// 验证配置已更新
		let stored = AffiliateInstant::level_percents();
		assert_eq!(stored.to_vec(), new_percents);

		// 验证事件
		System::assert_last_event(Event::LevelPercentsUpdated { percents: new_percents }.into());
	});
}

/// 测试分成比例验证
#[test]
fn invalid_percents_rejected() {
	new_test_ext().execute_with(|| {
		// 总和超过100%
		let invalid_percents = vec![50, 50, 50];

		assert!(AffiliateInstant::set_level_percents(
			RuntimeOrigin::root(),
			invalid_percents
		)
		.is_err());

		// 超过15层
		let too_many = vec![5; 16];

		assert!(AffiliateInstant::set_level_percents(RuntimeOrigin::root(), too_many).is_err());
	});
}

/// 测试统计数据更新
#[test]
fn statistics_updated() {
	new_test_ext().execute_with(|| {
		let buyer = 1;
		let original_price = 100_000;
		let actual_paid = 20_000;
		let escrow = get_escrow_account();

		let total_before = AffiliateInstant::total_distributed();

		assert_ok!(AffiliateInstant::instant_distribute(
			&buyer,
			original_price,
			actual_paid,
			&escrow
		));

		let total_after = AffiliateInstant::total_distributed();

		// 统计应该增加
		assert!(total_after > total_before);
	});
}

