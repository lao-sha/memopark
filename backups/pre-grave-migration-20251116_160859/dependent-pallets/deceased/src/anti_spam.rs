// This file is part of Substrate.

// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

//! # Anti-Spam Module (防刷模块)
//!
//! ## 概述
//!
//! 该模块实现三层防刷机制，防止恶意用户刷数据污染作品影响力评分：
//!
//! ### 第1层：每日操作限额（Daily Limits）
//! - 每日浏览上限：1000个作品
//! - 每日分享上限：100次
//! - 每日收藏上限：50次
//!
//! ### 第2层：时间窗口防重复（Time Window Deduplication）
//! - 同一作品10分钟内不重复计数浏览
//! - 同一作品1分钟内不重复计数分享
//! - 收藏操作天然防重复（双向操作）
//!
//! ### 第3层：异常行为检测（Anomaly Detection）
//! - 1小时内浏览>100个作品 → 警告
//! - 单个作品每日被同一用户重复操作>10次 → 拒绝
//!
//! ## 使用示例
//!
//! ```rust
//! // 在 view_work() 中添加防刷检查
//! Self::check_anti_spam(&who, work_id, OperationType::View)?;
//! ```

use super::*;
// 函数级中文注释：从pallet模块导入Config trait（anti_spam不需要BalanceOf）
use crate::pallet::Config;
use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;
use sp_runtime::traits::{Zero, Saturating, SaturatedConversion};

/// 函数级详细中文注释：操作类型枚举
///
/// 定义需要防刷保护的操作类型
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub enum OperationType {
	/// 浏览作品（view_work）
	View,
	/// 分享作品（share_work）
	Share,
	/// 收藏作品（favorite_work）
	Favorite,
}

impl OperationType {
	/// 函数级详细中文注释：转换为u8代码（用于Event）
	///
	/// ## 编码规则
	/// - View (浏览) → 0
	/// - Share (分享) → 1
	/// - Favorite (收藏) → 2
	///
	/// ## 用途
	/// - 在Event中避免OperationType的复杂codec要求
	/// - 保持向后兼容性
	pub fn to_u8(&self) -> u8 {
		match self {
			OperationType::View => 0,
			OperationType::Share => 1,
			OperationType::Favorite => 2,
		}
	}
}

/// 函数级详细中文注释：每日计数信息
///
/// 用于跟踪用户每日操作次数，支持跨天自动重置
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Debug, Default)]
pub struct DailyCountInfo<BlockNumber> {
	/// 当日总计数
	pub count: u32,
	/// 上次重置的区块号（用于判断是否跨天）
	pub last_reset: BlockNumber,
}

/// 函数级详细中文注释：1小时计数信息
///
/// 用于异常行为检测的滑动窗口统计
#[derive(Encode, Decode, TypeInfo, MaxEncodedLen, Clone, PartialEq, Debug, Default)]
pub struct HourlyCountInfo<BlockNumber> {
	/// 1小时内计数
	pub count: u32,
	/// 窗口起始区块号
	pub window_start: BlockNumber,
}

impl<T: Config> Pallet<T> {
	/// 函数级详细中文注释：防刷综合检查（统一入口）
	///
	/// ## 参数
	/// - `who`: 操作用户
	/// - `work_id`: 作品ID
	/// - `operation_type`: 操作类型
	///
	/// ## 检查顺序
	/// 1. 每日操作限额检查
	/// 2. 时间窗口防重复检查
	/// 3. 异常行为检测
	/// 4. 单作品操作次数限制
	///
	/// ## 返回
	/// - `Ok(())`: 通过所有检查
	/// - `Err(...)`: 触发防刷规则
	pub fn check_anti_spam(
		who: &T::AccountId,
		work_id: u64,
		operation_type: OperationType,
	) -> DispatchResult {
		// 第1层：每日操作限额
		Self::check_daily_limit(who, operation_type)?;

		// 第2层：时间窗口防重复
		Self::check_time_window(who, work_id, operation_type)?;

		// 第3层：异常行为检测（仅警告，不阻止）
		Self::check_anomaly(who, operation_type)?;

		// 第4层：单作品操作次数限制
		Self::check_per_work_limit(who, work_id, operation_type)?;

		Ok(())
	}

	/// 函数级详细中文注释：检查每日操作限额
	///
	/// ## 功能
	/// - 检查用户是否超过每日操作限额
	/// - 自动检测跨天并重置计数
	/// - 触发接近限额警告事件
	///
	/// ## 限额配置
	/// - 浏览：1000次/天
	/// - 分享：100次/天
	/// - 收藏：50次/天
	fn check_daily_limit(who: &T::AccountId, operation_type: OperationType) -> DispatchResult {
		let limit = Self::get_daily_limit(operation_type);
		let current_block = <frame_system::Pallet<T>>::block_number();
		let mut info = DailyOperationCount::<T>::get(who, operation_type);

		// 跨天重置
		if Self::should_reset_daily(current_block, info.last_reset) {
			info.count = 0;
			info.last_reset = current_block;
		}

		// 检查限额
		ensure!(info.count < limit, Error::<T>::DailyLimitExceeded);

		// 递增计数
		info.count = info.count.saturating_add(1);

		// 触发事件（接近限额时，90%阈值）
		let should_warn = info.count >= limit.saturating_mul(90).saturating_div(100);

		DailyOperationCount::<T>::insert(who, operation_type, info);

		if should_warn {
			Self::deposit_event(Event::DailyLimitReached {
				who: who.clone(),
				operation_type: operation_type.to_u8(),
				limit,
			});
		}

		Ok(())
	}

	/// 函数级详细中文注释：检查时间窗口防重复
	///
	/// ## 功能
	/// - 防止用户在短时间内对同一作品重复操作
	/// - 使用区块号作为时间戳
	///
	/// ## 窗口配置
	/// - 浏览：100块（约10分钟）
	/// - 分享：10块（约1分钟）
	/// - 收藏：0块（无限制）
	fn check_time_window(
		who: &T::AccountId,
		work_id: u64,
		operation_type: OperationType,
	) -> DispatchResult {
		let window = Self::get_time_window(operation_type);
		if window.is_zero() {
			// 无时间窗口限制
			return Ok(());
		}

		let current_block = <frame_system::Pallet<T>>::block_number();

		if let Some(last_block) = RecentOperations::<T>::get((who, work_id, operation_type)) {
			let elapsed = Self::block_diff(current_block, last_block);
			let window_u32: u32 = window.saturated_into();
			ensure!(elapsed >= window_u32, Error::<T>::TooFrequent);
		}

		// 更新最近操作时间
		RecentOperations::<T>::insert((who, work_id, operation_type), current_block);

		Ok(())
	}

	/// 函数级详细中文注释：检查异常行为（1小时滑动窗口）
	///
	/// ## 功能
	/// - 检测用户在1小时内是否操作过多
	/// - 仅触发警告事件，不阻止操作
	///
	/// ## 阈值配置
	/// - 浏览：100次/小时
	/// - 分享：30次/小时
	/// - 收藏：20次/小时
	fn check_anomaly(who: &T::AccountId, operation_type: OperationType) -> DispatchResult {
		let threshold = Self::get_hourly_threshold(operation_type);
		let current_block = <frame_system::Pallet<T>>::block_number();

		let mut hourly = HourlyOperationCount::<T>::get(who, operation_type);

		// 更新滑动窗口（1小时 = 600块）
		const HOURLY_WINDOW: u32 = 600;
		if Self::block_diff(current_block, hourly.window_start) >= HOURLY_WINDOW {
			hourly.count = 0;
			hourly.window_start = current_block;
		}

		hourly.count = hourly.count.saturating_add(1);

		// 检查异常（仅警告，不阻止）
		if hourly.count > threshold {
			Self::deposit_event(Event::AnomalyDetected {
				who: who.clone(),
				operation_type: operation_type.to_u8(),
				count_in_hour: hourly.count,
			});
		}

		HourlyOperationCount::<T>::insert(who, operation_type, hourly);

		Ok(())
	}

	/// 函数级详细中文注释：检查单作品操作次数限制
	///
	/// ## 功能
	/// - 防止用户对单个作品过度操作
	/// - 每日每个作品最多操作10次
	fn check_per_work_limit(
		who: &T::AccountId,
		work_id: u64,
		operation_type: OperationType,
	) -> DispatchResult {
		const PER_WORK_LIMIT: u32 = 10;
		let current_block = <frame_system::Pallet<T>>::block_number();

		let mut info = PerWorkDailyCount::<T>::get((who, work_id, operation_type));

		// 跨天重置
		if Self::should_reset_daily(current_block, info.last_reset) {
			info.count = 0;
			info.last_reset = current_block;
		}

		// 检查限制
		ensure!(info.count < PER_WORK_LIMIT, Error::<T>::TooManyOperationsOnSingleWork);

		info.count = info.count.saturating_add(1);
		PerWorkDailyCount::<T>::insert((who, work_id, operation_type), info);

		Ok(())
	}

	// ============= 辅助函数 =============

	/// 获取每日限额
	fn get_daily_limit(operation_type: OperationType) -> u32 {
		match operation_type {
			OperationType::View => 1000,
			OperationType::Share => 100,
			OperationType::Favorite => 50,
		}
	}

	/// 获取时间窗口（区块数）
	fn get_time_window(operation_type: OperationType) -> BlockNumberFor<T> {
		match operation_type {
			OperationType::View => 100u32.into(),   // 100块 ≈ 10分钟
			OperationType::Share => 10u32.into(),   // 10块 ≈ 1分钟
			OperationType::Favorite => Zero::zero(), // 收藏无窗口限制
		}
	}

	/// 获取1小时异常阈值
	fn get_hourly_threshold(operation_type: OperationType) -> u32 {
		match operation_type {
			OperationType::View => 100,
			OperationType::Share => 30,
			OperationType::Favorite => 20,
		}
	}

	/// 判断是否应该重置每日计数
	fn should_reset_daily(
		current_block: BlockNumberFor<T>,
		last_reset: BlockNumberFor<T>,
	) -> bool {
		let current_day = Self::block_to_day(current_block);
		let last_day = Self::block_to_day(last_reset);

		current_day != last_day
	}

	/// 将区块号转换为天数
	fn block_to_day(block: BlockNumberFor<T>) -> u32 {
		const BLOCKS_PER_DAY: u32 = 14400;
		Self::block_to_u32(block).saturating_div(BLOCKS_PER_DAY)
	}

	/// 计算区块号差值
	fn block_diff(a: BlockNumberFor<T>, b: BlockNumberFor<T>) -> u32 {
		let diff = if a > b { a.saturating_sub(b) } else { b.saturating_sub(a) };
		Self::block_to_u32(diff)
	}

	/// 将BlockNumber转换为u32（辅助函数）
	fn block_to_u32(block: BlockNumberFor<T>) -> u32 {
		TryInto::<u32>::try_into(block).unwrap_or(u32::MAX)
	}
}
