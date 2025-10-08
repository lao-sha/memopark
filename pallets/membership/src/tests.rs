/// 单元测试
use crate::{mock::*, Error, Event, MembershipLevel};
use frame_support::{assert_noop, assert_ok};

/// 测试购买年费会员（无推荐人，创始会员）
#[test]
fn purchase_membership_works_without_referrer() {
	new_test_ext().execute_with(|| {
		// 账户1购买年费会员（无推荐码）
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));

		// 验证会员信息
		let membership = Membership::memberships(1).unwrap();
		assert_eq!(membership.level, MembershipLevel::Year1);
		assert_eq!(membership.base_generations, 6);
		assert_eq!(membership.total_generations, 6);
		assert_eq!(membership.referral_count, 0);
		assert!(membership.referrer.is_none());

		// 验证推荐码已生成
		assert!(membership.referral_code.len() > 0);

		// 验证统计
		assert_eq!(Membership::total_members(MembershipLevel::Year1), 1);

		// 验证事件
		System::assert_last_event(
			Event::MembershipPurchased {
				who: 1,
				level: MembershipLevel::Year1,
				valid_until: membership.valid_until,
				referrer: None,
			}
			.into(),
		);
	});
}

/// 测试购买会员（有推荐人）
#[test]
fn purchase_membership_with_referrer_works() {
	new_test_ext().execute_with(|| {
		// 账户1先购买会员（创始会员）
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));

		let referrer_code = Membership::memberships(1).unwrap().referral_code;

		// 账户2使用账户1的推荐码购买
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(2),
			MembershipLevel::Year3,
			Some(referrer_code.to_vec())
		));

		// 验证账户2的会员信息
		let membership2 = Membership::memberships(2).unwrap();
		assert_eq!(membership2.level, MembershipLevel::Year3);
		assert_eq!(membership2.referrer, Some(1));

		// 验证账户1的奖励代数增加
		let membership1 = Membership::memberships(1).unwrap();
		assert_eq!(membership1.bonus_generations, 1);
		assert_eq!(membership1.total_generations, 7); // 6 + 1
		assert_eq!(membership1.referral_count, 1);
	});
}

/// 测试重复购买会员（应该失败）
#[test]
fn cannot_purchase_twice() {
	new_test_ext().execute_with(|| {
		// 第一次购买
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));

		// 第二次购买应该失败
		assert_noop!(
			Membership::purchase_membership(RuntimeOrigin::signed(1), MembershipLevel::Year3, None),
			Error::<Test>::AlreadyMember
		);
	});
}

/// 测试使用无效推荐码购买会员
#[test]
fn purchase_with_invalid_referral_code_fails() {
	new_test_ext().execute_with(|| {
		// 使用不存在的推荐码
		assert_noop!(
			Membership::purchase_membership(
				RuntimeOrigin::signed(1),
				MembershipLevel::Year1,
				Some(b"INVALID_CODE".to_vec())
			),
			Error::<Test>::InvalidReferralCode
		);
	});
}

/// 测试升级到10年会员
#[test]
fn upgrade_to_year10_works() {
	new_test_ext().execute_with(|| {
		// 先购买年费会员
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));

		let old_valid_until = Membership::memberships(1).unwrap().valid_until;

		// 升级到10年会员
		assert_ok!(Membership::upgrade_to_year10(RuntimeOrigin::signed(1)));

		// 验证升级后信息
		let membership = Membership::memberships(1).unwrap();
		assert_eq!(membership.level, MembershipLevel::Year10);
		assert_eq!(membership.base_generations, 15);
		assert_eq!(membership.total_generations, 15);
		assert!(membership.valid_until > old_valid_until);

		// 验证统计
		assert_eq!(Membership::total_members(MembershipLevel::Year1), 0);
		assert_eq!(Membership::total_members(MembershipLevel::Year10), 1);
	});
}

/// 测试10年会员无法再升级
#[test]
fn cannot_upgrade_year10_again() {
	new_test_ext().execute_with(|| {
		// 先购买10年会员
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year10,
			None
		));

		// 尝试再次升级应该失败
		assert_noop!(
			Membership::upgrade_to_year10(RuntimeOrigin::signed(1)),
			Error::<Test>::AlreadyYear10
		);
	});
}

/// 测试设置会员折扣
#[test]
fn set_member_discount_works() {
	new_test_ext().execute_with(|| {
		// Root设置折扣为30%（3折）
		assert_ok!(Membership::set_member_discount(RuntimeOrigin::root(), 30));

		// 验证折扣已更新
		assert_eq!(Membership::member_discount(), 30);

		// 验证事件
		System::assert_last_event(Event::DiscountUpdated { discount: 30 }.into());
	});
}

/// 测试非Root无法设置折扣
#[test]
fn set_discount_requires_root() {
	new_test_ext().execute_with(|| {
		// 普通用户尝试设置折扣应该失败
		assert_noop!(
			Membership::set_member_discount(RuntimeOrigin::signed(1), 30),
			sp_runtime::DispatchError::BadOrigin
		);
	});
}

/// 测试折扣范围验证
#[test]
fn discount_must_be_valid() {
	new_test_ext().execute_with(|| {
		// 尝试设置超过100的折扣应该失败
		assert_noop!(
			Membership::set_member_discount(RuntimeOrigin::root(), 101),
			Error::<Test>::InvalidDiscount
		);
	});
}

/// 测试动态代数增长上限
#[test]
fn generation_cap_at_15() {
	new_test_ext().execute_with(|| {
		// 账户1购买年费会员（基础6代）
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));

		let referrer_code = Membership::memberships(1).unwrap().referral_code;

		// 推荐10个会员（应该增加到15代封顶）
		for i in 2..12 {
			assert_ok!(Membership::purchase_membership(
				RuntimeOrigin::signed(i),
				MembershipLevel::Year1,
				Some(referrer_code.to_vec())
			));
		}

		// 验证代数封顶在15
		let membership1 = Membership::memberships(1).unwrap();
		assert_eq!(membership1.bonus_generations, 10);
		assert_eq!(membership1.total_generations, 15); // 6 + 10 = 16，但封顶15
		assert_eq!(membership1.referral_count, 10);
	});
}

/// 测试会员有效性检查
#[test]
fn is_member_valid_works() {
	new_test_ext().execute_with(|| {
		// 未购买会员前无效
		assert!(!Membership::is_member_valid(&1));

		// 购买会员后有效
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));
		assert!(Membership::is_member_valid(&1));

		// 获取代数
		assert_eq!(Membership::get_member_generations(&1), Some(6));
	});
}

/// 测试设置单个会员价格
#[test]
fn set_membership_price_works() {
	new_test_ext().execute_with(|| {
		// 设置 Year1 价格为 500 MEMO (level_id=0)
		assert_ok!(Membership::set_membership_price(
			RuntimeOrigin::root(),
			0, // Year1
			500
		));

		// 验证价格已更新
		let new_price = Membership::get_membership_price(MembershipLevel::Year1);
		assert_eq!(new_price, 500 * 1_000_000_000_000);

		// 验证事件
		System::assert_last_event(
			Event::MembershipPriceUpdated {
				level_id: 0, // Year1
				price: new_price,
			}
			.into(),
		);
	});
}

/// 测试批量设置价格
#[test]
fn set_all_membership_prices_works() {
	new_test_ext().execute_with(|| {
		// 批量设置价格
		assert_ok!(Membership::set_all_membership_prices(
			RuntimeOrigin::root(),
			500, // Year1
			1000, // Year3
			2000, // Year5
			2500  // Year10
		));

		// 验证所有价格
		assert_eq!(Membership::get_membership_price(MembershipLevel::Year1), 500 * 1_000_000_000_000);
		assert_eq!(Membership::get_membership_price(MembershipLevel::Year3), 1000 * 1_000_000_000_000);
		assert_eq!(Membership::get_membership_price(MembershipLevel::Year5), 2000 * 1_000_000_000_000);
		assert_eq!(Membership::get_membership_price(MembershipLevel::Year10), 2500 * 1_000_000_000_000);

		// 验证批量事件
		System::assert_last_event(
			Event::BatchPricesUpdated { count: 4 }.into(),
		);
	});
}

/// 测试价格范围验证
#[test]
fn set_price_out_of_range_fails() {
	new_test_ext().execute_with(|| {
		// 价格过低（低于 MinMembershipPrice = 100 MEMO）
		assert_noop!(
			Membership::set_membership_price(
				RuntimeOrigin::root(),
				0, // Year1
				50 // 小于100
			),
			Error::<Test>::PriceOutOfRange
		);

		// 价格过高（高于 MaxMembershipPrice = 10000 MEMO）
		assert_noop!(
			Membership::set_membership_price(
				RuntimeOrigin::root(),
				0, // Year1
				15000 // 大于10000
			),
			Error::<Test>::PriceOutOfRange
		);
	});
}

/// 测试购买使用治理设置的价格
#[test]
fn purchase_with_governance_price_works() {
	new_test_ext().execute_with(|| {
		// 先设置新价格 Year1 = 500 MEMO (level_id=0)
		assert_ok!(Membership::set_membership_price(
			RuntimeOrigin::root(),
			0, // Year1
			500
		));

		let initial_balance = Balances::free_balance(1);

		// 购买会员
		assert_ok!(Membership::purchase_membership(
			RuntimeOrigin::signed(1),
			MembershipLevel::Year1,
			None
		));

		// 验证扣费金额为新价格 500 MEMO
		let final_balance = Balances::free_balance(1);
		assert_eq!(initial_balance - final_balance, 500 * 1_000_000_000_000);
	});
}

/// 测试未设置价格时使用默认价格
#[test]
fn default_price_used_when_not_set() {
	new_test_ext().execute_with(|| {
		// Year1 默认价格是 400 MEMO（types.rs 中定义）
		let price = Membership::get_membership_price(MembershipLevel::Year1);
		assert_eq!(price, 400 * 1_000_000_000_000);
	});
}

/// 测试只有 Root 可以设置价格
#[test]
fn set_price_requires_root() {
	new_test_ext().execute_with(|| {
		// 普通用户无法设置价格
		assert_noop!(
			Membership::set_membership_price(
				RuntimeOrigin::signed(1),
				0, // Year1
				500
			),
			sp_runtime::DispatchError::BadOrigin
		);
	});
}
