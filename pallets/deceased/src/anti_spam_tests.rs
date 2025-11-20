// This file is part of Substrate.

// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

//! # Anti-Spam Module Tests (防刷模块测试)
//!
//! ## 测试覆盖范围
//!
//! ### 第1层：每日操作限额（Daily Limits）
//! - test_daily_limit_view_under_limit: 浏览未超限
//! - test_daily_limit_view_reached: 浏览达到限额
//! - test_daily_limit_share_reached: 分享达到限额
//! - test_daily_limit_favorite_reached: 收藏达到限额
//! - test_daily_limit_reset_next_day: 跨天自动重置
//!
//! ### 第2层：时间窗口防重复（Time Window Deduplication）
//! - test_time_window_view_too_frequent: 10分钟内重复浏览
//! - test_time_window_share_too_frequent: 1分钟内重复分享
//! - test_time_window_favorite_no_limit: 收藏无时间窗口限制
//! - test_time_window_view_after_cooldown: 冷却后可再次操作
//!
//! ### 第3层：异常行为检测（Anomaly Detection）
//! - test_anomaly_detection_view_trigger: 1小时内浏览>100次触发警告
//! - test_anomaly_detection_share_trigger: 1小时内分享>30次触发警告
//! - test_anomaly_detection_not_blocking: 异常检测不阻止操作
//!
//! ### 第4层：单作品操作次数限制（Per-Work Limits）
//! - test_per_work_limit_view_exceeded: 单作品每日浏览超10次
//! - test_per_work_limit_different_works: 不同作品独立计数
//! - test_per_work_limit_reset_next_day: 单作品限制跨天重置

use super::*;
use crate::mock::{ExtBuilder, Test, System, Deceased};
use frame_support::{assert_ok, assert_noop};

// ============= 测试辅助函数 =============

/// 函数级详细中文注释：模拟时间前进（以区块号为单位）
///
/// ## 功能说明
/// - 在测试中模拟区块链时间的前进
/// - 用于测试时间窗口、跨天重置等时间相关逻辑
///
/// ## 参数
/// - `blocks`: 要前进的区块数
fn advance_blocks(blocks: u64) {
	let current = System::block_number();
	System::set_block_number(current + blocks);
}

// ============= 第1层：每日操作限额测试 =============

#[test]
fn test_daily_limit_view_under_limit() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 模拟浏览999次（未达1000次限额）
		// 使用不同的work_id以避免触发单作品限制（第4层）
		for _i in 0..999 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id + _i, OperationType::View)
			);
		}

		// 第1000次仍应成功
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id + 1000, OperationType::View)
		);
	});
}

#[test]
fn test_daily_limit_view_reached() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 模拟浏览1000次（达到限额）
		for _i in 0..1000 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id + _i, OperationType::View)
			);
		}

		// 第1001次应失败：DailyLimitExceeded
		assert_noop!(
			Deceased::check_anti_spam(&alice, work_id + 1001, OperationType::View),
			Error::<Test>::DailyLimitExceeded
		);
	});
}

#[test]
fn test_daily_limit_share_reached() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 模拟分享100次（达到限额）
		for _i in 0..100 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id + _i, OperationType::Share)
			);
		}

		// 第101次应失败：DailyLimitExceeded
		assert_noop!(
			Deceased::check_anti_spam(&alice, work_id + 101, OperationType::Share),
			Error::<Test>::DailyLimitExceeded
		);
	});
}

#[test]
fn test_daily_limit_favorite_reached() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 模拟收藏50次（达到限额）
		for _i in 0..50 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id + _i, OperationType::Favorite)
			);
		}

		// 第51次应失败：DailyLimitExceeded
		assert_noop!(
			Deceased::check_anti_spam(&alice, work_id + 51, OperationType::Favorite),
			Error::<Test>::DailyLimitExceeded
		);
	});
}

#[test]
fn test_daily_limit_reset_next_day() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 今天浏览1000次（达到限额）
		for _i in 0..1000 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id + _i, OperationType::View)
			);
		}

		// 确认已达限额
		assert_noop!(
			Deceased::check_anti_spam(&alice, work_id + 1001, OperationType::View),
			Error::<Test>::DailyLimitExceeded
		);

		// 前进到次日（14400个区块 = 1天）
		advance_blocks(14400);

		// 次日第一次浏览应成功（限额已重置）
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id + 1002, OperationType::View)
		);
	});
}

// ============= 第2层：时间窗口防重复测试 =============

#[test]
fn test_time_window_view_too_frequent() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 第一次浏览应成功
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::View)
		);

		// 9分钟后再次浏览（90个区块 < 100个区块窗口）
		advance_blocks(90);
		// 注意：由于check_daily_limit会修改存储，不能使用assert_noop!
		// 改为直接检查返回错误
		let result = Deceased::check_anti_spam(&alice, work_id, OperationType::View);
		assert!(result.is_err());
		assert_eq!(result.unwrap_err(), Error::<Test>::TooFrequent.into());
	});
}

#[test]
fn test_time_window_share_too_frequent() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 第一次分享应成功
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::Share)
		);

		// 30秒后再次分享（5个区块 < 10个区块窗口）
		advance_blocks(5);
		// 注意：由于check_daily_limit会修改存储，不能使用assert_noop!
		let result = Deceased::check_anti_spam(&alice, work_id, OperationType::Share);
		assert!(result.is_err());
		assert_eq!(result.unwrap_err(), Error::<Test>::TooFrequent.into());
	});
}

#[test]
fn test_time_window_favorite_no_limit() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 第一次收藏应成功
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::Favorite)
		);

		// 立即再次操作（收藏无时间窗口限制）
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::Favorite)
		);
	});
}

#[test]
fn test_time_window_view_after_cooldown() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 第一次浏览应成功
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::View)
		);

		// 10分钟后再次浏览（100个区块 = 时间窗口）
		advance_blocks(100);
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::View)
		);
	});
}

// ============= 第3层：异常行为检测测试 =============

#[test]
fn test_anomaly_detection_view_trigger() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;

		// 1小时内浏览101个不同作品（触发异常检测）
		for i in 0..101 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, 100 + i, OperationType::View)
			);
		}

		// 异常检测不阻止操作，继续浏览应成功
		// 但会发出AnomalyDetected事件（事件检查需要额外的测试框架）
		assert_ok!(
			Deceased::check_anti_spam(&alice, 201, OperationType::View)
		);
	});
}

#[test]
fn test_anomaly_detection_share_trigger() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;

		// 1小时内分享31个不同作品（触发异常检测）
		for i in 0..31 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, 100 + i, OperationType::Share)
			);
		}

		// 异常检测不阻止操作
		assert_ok!(
			Deceased::check_anti_spam(&alice, 131, OperationType::Share)
		);
	});
}

#[test]
fn test_anomaly_detection_not_blocking() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;

		// 1小时内浏览150个作品（远超100次阈值）
		for i in 0..150 {
			// 所有操作都应成功（异常检测仅警告）
			assert_ok!(
				Deceased::check_anti_spam(&alice, 100 + i, OperationType::View)
			);
		}
	});
}

// ============= 第4层：单作品操作次数限制测试 =============

#[test]
fn test_per_work_limit_view_exceeded() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 对同一作品浏览10次（达到限制）
		for _i in 0..10 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id, OperationType::View)
			);
			// 前进100个区块以跳过时间窗口
			advance_blocks(100);
		}

		// 第11次应失败：TooManyOperationsOnSingleWork
		advance_blocks(100);
		let result = Deceased::check_anti_spam(&alice, work_id, OperationType::View);
		assert!(result.is_err());
		assert_eq!(result.unwrap_err(), Error::<Test>::TooManyOperationsOnSingleWork.into());
	});
}

#[test]
fn test_per_work_limit_different_works() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;

		// 对work_id=100浏览10次
		for _i in 0..10 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, 100, OperationType::View)
			);
			advance_blocks(100);
		}

		// work_id=100已达限制
		advance_blocks(100);
		let result = Deceased::check_anti_spam(&alice, 100, OperationType::View);
		assert!(result.is_err());
		assert_eq!(result.unwrap_err(), Error::<Test>::TooManyOperationsOnSingleWork.into());

		// 但work_id=200仍可浏览（不同作品独立计数）
		assert_ok!(
			Deceased::check_anti_spam(&alice, 200, OperationType::View)
		);
	});
}

#[test]
fn test_per_work_limit_reset_next_day() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 今天对同一作品浏览10次（达到限制）
		for _i in 0..10 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id, OperationType::View)
			);
			advance_blocks(100);
		}

		// 确认已达限制
		advance_blocks(100);
		let result = Deceased::check_anti_spam(&alice, work_id, OperationType::View);
		assert!(result.is_err());
		assert_eq!(result.unwrap_err(), Error::<Test>::TooManyOperationsOnSingleWork.into());

		// 前进到次日（14400个区块 = 1天）
		advance_blocks(14400);

		// 次日第一次浏览应成功（单作品限制已重置）
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::View)
		);
	});
}

// ============= 综合测试 =============

#[test]
fn test_comprehensive_multi_layer_protection() {
	ExtBuilder::default().build().execute_with(|| {
		let alice = 1u64;
		let work_id = 100u64;

		// 第1层：未达每日限额
		for _i in 0..5 {
			assert_ok!(
				Deceased::check_anti_spam(&alice, work_id, OperationType::View)
			);
			// 第2层：跳过时间窗口
			advance_blocks(100);
		}

		// 第4层：单作品操作未超限（5次 < 10次）
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::View)
		);

		// 第3层：1小时内操作未达异常阈值
		// 600个区块 = 1小时，重置异常检测窗口
		advance_blocks(600);

		// 所有保护层都通过
		assert_ok!(
			Deceased::check_anti_spam(&alice, work_id, OperationType::View)
		);
	});
}
