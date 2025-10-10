// Copyright (C) Memopark Team
// SPDX-License-Identifier: Apache-2.0

//! # 即时分成系统 Pallet (pallet-affiliate-instant)
//!
//! ## 功能概述
//!
//! 本模块实现供奉支付后的即时推荐奖励分配机制，区别于按周结算的模式。
//! 每笔供奉支付完成后，立即根据推荐关系链进行多层级分成，资金实时到账。
//!
//! ## 核心特性
//!
//! 1. **即时分配**
//!    - 供奉支付后立即触发分成
//!    - 无需等待周期结算
//!    - 资金实时转账到推荐人账户
//!
//! 2. **多层级分成（最多15层）**
//!    - 根据会员可拿代数决定分成层数
//!    - 不同层级享有不同分成比例
//!    - 第1代最高（30%），递减至第15代
//!
//! 3. **会员验证**
//!    - 每层分成前验证推荐人是否为有效会员
//!    - 验证推荐人的可拿代数是否覆盖该层
//!    - 无效层级的份额并入国库
//!
//! 4. **分成基数计算**
//!    ```
//!    分成基数 = 原价 - 固定存储费 - 固定销毁费
//!    可分配金额 = 分成基数 × 90%（剩余10%为销毁/国库/存储费）
//!    ```
//!
//! 5. **比例分配（方案B：递减分配）**
//!    - 第1代：30%
//!    - 第2代：25%
//!    - 第3代：15%
//!    - 第4代：10%
//!    - 第5代：7%
//!    - 第6代：3%
//!    - 第7-9代：各2%
//!    - 第10-15代：各1%
//!    - 总计：99%（剩余1%并入国库）
//!
//! ## 与pallet-memo-affiliate的区别
//!
//! | 特性 | pallet-memo-affiliate | pallet-affiliate-instant |
//! |------|----------------------|--------------------------|
//! | 结算模式 | 周结算（托管） | 即时分成 |
//! | 资金流向 | 托管账户 → 周末批量转账 | 直接转账到推荐人 |
//! | 适用场景 | 其他消费场景 | 会员供奉场景 |
//! | 代数控制 | 固定15层 | 根据会员等级动态（6-15层） |
//! | 分成比例 | 不等比（20/10/4...） | 递减（30/25/15...） |
//!
//! ## 接口说明
//!
//! ### 核心接口
//! - `instant_distribute`: 执行即时分成（由 offerings 调用）
//!
//! ### 治理接口
//! - `set_distribution_params`: 设置分成参数（比例、账户等）

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::{
		pallet_prelude::*,
		traits::{Currency, ExistenceRequirement, Get, WithdrawReasons},
		PalletId,
	};
	use sp_runtime::SaturatedConversion;
	use frame_system::pallet_prelude::*;
	use sp_runtime::{
		traits::{AccountIdConversion, Saturating, Zero},
	};
	use sp_std::vec::Vec;

	/// 余额类型
	pub type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	/// 推荐关系提供者 Trait
	pub trait ReferralProvider<AccountId> {
		/// 获取推荐链（祖先列表，从直接推荐人到最顶层）
		fn get_sponsor_chain(who: &AccountId, max_depth: u8) -> Vec<AccountId>;
	}

	/// 会员信息提供者 Trait
	pub trait MembershipProvider<AccountId> {
		/// 检查是否为有效会员
		fn is_member_valid(who: &AccountId) -> bool;
		/// 获取会员可拿代数
		fn get_member_generations(who: &AccountId) -> Option<u8>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// 事件类型
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// 货币系统
		type Currency: Currency<Self::AccountId>;

		/// Pallet ID（用于派生托管账户）
		#[pallet::constant]
		type PalletId: Get<PalletId>;

		/// 推荐关系提供者
		type ReferralProvider: ReferralProvider<Self::AccountId>;

		/// 会员信息提供者
		type MembershipProvider: MembershipProvider<Self::AccountId>;

		/// 销毁比例（5%）
		#[pallet::constant]
		type BurnPercent: Get<u8>;

		/// 国库基础比例（2%）
		#[pallet::constant]
		type TreasuryPercent: Get<u8>;

		/// 存储费比例（3%）
		#[pallet::constant]
		type StoragePercent: Get<u8>;

		/// 固定存储费（如果使用固定费用模式）
		#[pallet::constant]
		type StorageFee: Get<BalanceOf<Self>>;

		/// 固定销毁费（如果使用固定费用模式）
		#[pallet::constant]
		type BurnFee: Get<BalanceOf<Self>>;

		/// 国库账户
		type TreasuryAccount: Get<Self::AccountId>;

		/// 存储费账户
		type StorageAccount: Get<Self::AccountId>;
	}

	/// 分成比例配置（每层的百分比）
	/// 默认：30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1
	#[pallet::storage]
	#[pallet::getter(fn level_percents)]
	pub type LevelPercents<T: Config> = StorageValue<_, BoundedVec<u8, ConstU32<15>>, ValueQuery>;

	/// 累计分成总额（统计用）
	#[pallet::storage]
	#[pallet::getter(fn total_distributed)]
	pub type TotalDistributed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// 累计销毁总额（统计用）
	#[pallet::storage]
	#[pallet::getter(fn total_burned)]
	pub type TotalBurned<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// 创世配置
	/// 
	/// 函数级中文注释：暂时禁用创世配置，避免编译问题，待后续重构
	// TODO: 重构 GenesisConfig
	/*
	#[pallet::genesis_config]
	#[derive(frame_support::DefaultNoBound)]
	pub struct GenesisConfig<T: Config> {
		/// 初始分成比例（15层）
		/// 默认：[30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1]
		pub level_percents: Vec<u8>,
	}

	#[pallet::genesis_build]
	impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
		fn build(&self) {
			// 设置默认分成比例
			let percents = if self.level_percents.is_empty() {
				// 默认递减分配方案
				vec![30, 25, 15, 10, 7, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1]
			} else {
				self.level_percents.clone()
			};

			let bounded = BoundedVec::try_from(percents)
				.expect("Level percents must not exceed 15 levels");
			LevelPercents::<T>::put(bounded);
		}
	}
	*/

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 推荐奖励已分配
		/// [推荐人, 层级, 金额, 购买者]
		RewardDistributed {
			to: T::AccountId,
			level: u8,
			amount: BalanceOf<T>,
			buyer: T::AccountId,
		},
		/// 分成完成
		/// [购买者, 原价, 实付, 总分配金额]
		DistributionCompleted {
			buyer: T::AccountId,
			original_price: BalanceOf<T>,
			actual_paid: BalanceOf<T>,
			total_distributed: BalanceOf<T>,
		},
		/// 销毁代币
		/// [金额]
		TokensBurned { amount: BalanceOf<T> },
		/// 分成比例更新
		/// [新比例列表]
		LevelPercentsUpdated { percents: Vec<u8> },
		/// 函数级中文注释：推荐链奖励已分配（单层）
		ReferralRewardDistributed {
			sponsor: T::AccountId,
			amount: BalanceOf<T>,
			depth: u8,
		},
	/// 函数级中文注释：纯推荐链分配完成（100%推荐链）
	PureReferralDistributionCompleted {
		buyer: T::AccountId,
		total_amount: BalanceOf<T>,
		distributed: BalanceOf<T>,
	},
	/// 函数级中文注释：无效层级份额转入国库
	InvalidLevelToTreasury {
		amount: BalanceOf<T>,
	},
	/// 函数级中文注释：剩余金额保留在托管账户
	RemainingInEscrow {
		amount: BalanceOf<T>,
	},
}

	#[pallet::error]
	pub enum Error<T> {
		/// 分成比例总和超过100%
		InvalidPercents,
		/// 分成比例层级超过15
		TooManyLevels,
		/// 转账失败
		TransferFailed,
		/// 金额溢出
		AmountOverflow,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 设置分成比例（Root权限）
		///
		/// # 参数
		/// - `origin`: Root来源
		/// - `percents`: 每层分成比例（1-15层）
		///
		/// # 验证
		/// - 最多15层
		/// - 总和不超过100%
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000_000, 0))]
		pub fn set_level_percents(origin: OriginFor<T>, percents: Vec<u8>) -> DispatchResult {
			ensure_root(origin)?;

			// 验证层级数量
			ensure!(percents.len() <= 15, Error::<T>::TooManyLevels);

			// 验证总和不超过100
			let total: u32 = percents.iter().map(|&p| p as u32).sum();
			ensure!(total <= 100, Error::<T>::InvalidPercents);

			// 保存配置
			let bounded =
				BoundedVec::try_from(percents.clone()).map_err(|_| Error::<T>::TooManyLevels)?;
			LevelPercents::<T>::put(bounded);

			Self::deposit_event(Event::LevelPercentsUpdated { percents });
			Ok(())
		}
	}

	/// 内部函数和公共接口
	impl<T: Config> Pallet<T> {
		/// 即时分配推荐奖励（核心函数）
		///
		/// # 参数
		/// - `buyer`: 购买者账户
		/// - `original_price`: 原价（分成基数）
		/// - `actual_paid`: 实际支付金额（会员折扣后）
		/// - `escrow_account`: 托管账户（资金来源）
		///
		/// # 逻辑流程
		/// 1. 计算分成基数（原价 - 存储费 - 销毁费）
		/// 2. 扣除销毁/国库/存储费（共10%）
		/// 3. 剩余90%按推荐链逐层分配
		/// 4. 每层验证会员有效性和代数
		/// 5. 即时转账到推荐人账户
		/// 6. 未分配部分并入国库
		///
		/// # 返回
		/// - `Ok(())`: 分成成功
		/// - `Err`: 分成失败
		pub fn instant_distribute(
			buyer: &T::AccountId,
			original_price: BalanceOf<T>,
			actual_paid: BalanceOf<T>,
			escrow_account: &T::AccountId,
		) -> DispatchResult {
			// 1. 计算分成基数
			let storage_fee = T::StorageFee::get();
			let burn_fee = T::BurnFee::get();
			let base_amount =
				original_price.saturating_sub(storage_fee).saturating_sub(burn_fee);

			// 2. 计算各部分金额（基于分成基数）
			let burn_amount = Self::percent_of(base_amount, T::BurnPercent::get());
			let treasury_base = Self::percent_of(base_amount, T::TreasuryPercent::get());
			let storage_amount = Self::percent_of(base_amount, T::StoragePercent::get());

			// 剩余90%用于推荐分成
			let distributable = base_amount
				.saturating_sub(burn_amount)
				.saturating_sub(treasury_base)
				.saturating_sub(storage_amount);

			// 3. 获取推荐链（最多15层）
			let referral_chain = T::ReferralProvider::get_sponsor_chain(buyer, 15);

			// 4. 逐层分配
			let mut total_distributed_amount = BalanceOf::<T>::zero();
			let mut treasury_extra = BalanceOf::<T>::zero();

			let percents = LevelPercents::<T>::get();

			for (level_index, ancestor) in referral_chain.iter().enumerate() {
				let level_num = (level_index + 1) as u8;

				// 检查是否超出配置的层级
				if level_index >= percents.len() {
					break;
				}

				// 检查祖先是否是有效会员
				if !T::MembershipProvider::is_member_valid(ancestor) {
					// 无效会员，该层份额并入国库
					let level_percent = percents[level_index];
					let level_amount = Self::percent_of(distributable, level_percent);
					treasury_extra = treasury_extra.saturating_add(level_amount);
					continue;
				}

				// 获取会员可拿代数
				let member_generations =
					T::MembershipProvider::get_member_generations(ancestor).unwrap_or(0);

				// 如果该层超过会员可拿代数，跳过并将份额并入国库
				if level_num > member_generations {
					let level_percent = percents[level_index];
					let level_amount = Self::percent_of(distributable, level_percent);
					treasury_extra = treasury_extra.saturating_add(level_amount);
					continue;
				}

				// 计算该层分成金额
				let level_percent = percents[level_index];
				let level_amount = Self::percent_of(distributable, level_percent);

				// 即时转账
				match T::Currency::transfer(
					escrow_account,
					ancestor,
					level_amount,
					ExistenceRequirement::KeepAlive,
				) {
					Ok(_) => {
						total_distributed_amount =
							total_distributed_amount.saturating_add(level_amount);

						// 发出事件
						Self::deposit_event(Event::RewardDistributed {
							to: ancestor.clone(),
							level: level_num,
							amount: level_amount,
							buyer: buyer.clone(),
						});
					},
					Err(_) => {
						// 转账失败，该层份额并入国库
						treasury_extra = treasury_extra.saturating_add(level_amount);
					},
				}
			}

			// 5. 未分配的部分并入国库
			let undistributed = distributable.saturating_sub(total_distributed_amount);
			let total_treasury = treasury_base
				.saturating_add(treasury_extra)
				.saturating_add(undistributed);

			// 6. 转账到国库
			if !total_treasury.is_zero() {
				T::Currency::transfer(
					escrow_account,
					&T::TreasuryAccount::get(),
					total_treasury,
					ExistenceRequirement::KeepAlive,
				)?;
			}

			// 7. 销毁代币
			if !burn_amount.is_zero() {
				let _ = T::Currency::withdraw(
					escrow_account,
					burn_amount,
					WithdrawReasons::FEE,
					ExistenceRequirement::KeepAlive,
				);

				TotalBurned::<T>::mutate(|total| {
					*total = total.saturating_add(burn_amount);
				});

				Self::deposit_event(Event::TokensBurned { amount: burn_amount });
			}

			// 8. 转账存储费
			if !storage_amount.is_zero() {
				T::Currency::transfer(
					escrow_account,
					&T::StorageAccount::get(),
					storage_amount,
					ExistenceRequirement::KeepAlive,
				)?;
			}

			// 9. 更新统计
			TotalDistributed::<T>::mutate(|total| {
				*total = total.saturating_add(total_distributed_amount);
			});

			// 10. 发出完成事件
			Self::deposit_event(Event::DistributionCompleted {
				buyer: buyer.clone(),
				original_price,
				actual_paid,
				total_distributed: total_distributed_amount,
			});

		Ok(())
	}

	/// 函数级详细中文注释：纯推荐链分配（简化版，职责转移后使用）
	/// - 专用于职责转移后的场景（offerings 已经处理了固定费用）
	/// - amount 已经是扣除固定费用后的金额（如90,000）
	/// - 仅负责推荐链分配，100%基于 amount
	///
	/// # 参数
	/// - `buyer`: 购买者账户
	/// - `amount`: 可分配总额（已扣除固定费用）
	/// - `escrow_account`: 资金来源账户（托管账户）
	///
	/// # 返回
	/// - `Ok(())`: 分配成功
	/// - `Err`: 转账失败或其他错误
	pub fn instant_distribute_pure_referral(
		buyer: &T::AccountId,
		amount: BalanceOf<T>,
		escrow_account: &T::AccountId,
	) -> DispatchResult {
		// 函数级中文注释：1. 获取推荐链（最多15层）
		let referral_chain = T::ReferralProvider::get_sponsor_chain(buyer, 15);
		
		// 函数级中文注释：2. 准备分配变量
		let mut total_distributed_amount = BalanceOf::<T>::zero();
		let mut treasury_extra = BalanceOf::<T>::zero(); // 无效层级和失败转账金额
		let percents = LevelPercents::<T>::get();
		
		// 函数级中文注释：3. 逐层分配（100%基于 amount）
		for (level_index, ancestor) in referral_chain.iter().enumerate() {
			let level_num = (level_index + 1) as u8;
			
			// 检查是否超出配置的层级
			if level_index >= percents.len() {
				break;
			}
			
			// 函数级中文注释：验证推荐人是否为有效会员
			if !T::MembershipProvider::is_member_valid(ancestor) {
				// 无效会员，该层份额并入国库
				let level_percent = percents[level_index];
				let level_amount = Self::percent_of(amount, level_percent);
				treasury_extra = treasury_extra.saturating_add(level_amount);
				continue;
			}
			
			// 函数级中文注释：获取会员可拿代数
			let member_generations = T::MembershipProvider::get_member_generations(ancestor)
				.unwrap_or(0);
			
			// 函数级中文注释：如果该层超过会员可拿代数，跳过并将份额并入国库
			if level_num > member_generations {
				let level_percent = percents[level_index];
				let level_amount = Self::percent_of(amount, level_percent);
				treasury_extra = treasury_extra.saturating_add(level_amount);
				continue;
			}
			
			// 函数级中文注释：计算该层分成金额
			let level_percent = percents[level_index];
			let level_amount = Self::percent_of(amount, level_percent);
			
			// 函数级中文注释：即时转账
			match T::Currency::transfer(
				escrow_account,
				ancestor,
				level_amount,
				ExistenceRequirement::KeepAlive,
			) {
				Ok(_) => {
					total_distributed_amount = total_distributed_amount.saturating_add(level_amount);
					
					// 函数级中文注释：发出事件
					Self::deposit_event(Event::RewardDistributed {
						to: ancestor.clone(),
						level: level_num,
						amount: level_amount,
						buyer: buyer.clone(),
					});
				},
				Err(_) => {
					// 函数级中文注释：转账失败，该层份额并入国库
					treasury_extra = treasury_extra.saturating_add(level_amount);
				},
			}
		}
		
		// 函数级中文注释：4. 未分配的部分并入国库
		let undistributed = amount.saturating_sub(total_distributed_amount);
		let total_treasury = treasury_extra.saturating_add(undistributed);
		
		// 函数级中文注释：5. 转账到国库（如有）
		if !total_treasury.is_zero() {
			T::Currency::transfer(
				escrow_account,
				&T::TreasuryAccount::get(),
				total_treasury,
				ExistenceRequirement::KeepAlive,
			)?;
			
			// 函数级中文注释：发出无效层级转国库事件
			Self::deposit_event(Event::InvalidLevelToTreasury {
				amount: total_treasury,
			});
		}
		
		// 函数级中文注释：6. 更新统计
		TotalDistributed::<T>::mutate(|total| {
			*total = total.saturating_add(total_distributed_amount);
		});
		
		// 函数级中文注释：7. 发出完成事件
		Self::deposit_event(Event::DistributionCompleted {
			buyer: buyer.clone(),
			original_price: amount,
			actual_paid: amount,
			total_distributed: total_distributed_amount,
		});
		
		Ok(())
	}

	/// 函数级中文注释：纯推荐链分配（100%给推荐链，无 Burn/Treasury/Storage）
	/// - 专用于会员购买等特殊场景
	/// - amount 全部用于推荐链分配
	///
	/// # 参数
	/// - `buyer`: 购买者账户
	/// - `amount`: 全部金额（u128）
	/// - `escrow_account`: 托管账户（资金来源）
	///
	/// # 逻辑流程
	/// 1. 全部金额作为可分配金额（100%）
	/// 2. 获取推荐链（最多15代）
	/// 3. 按固定比例分配：30%, 25%, 15%, 10%, 7%, 3%, 2%×3, 1%×6
	/// 4. 每层验证会员有效性和代数
	/// 5. 无效层级的份额转入国库
	/// 6. 即时转账到推荐人账户
	///
	/// # 返回
	/// - `Ok(())`: 分配成功
	/// - `Err`: 分配失败
	pub fn distribute_to_referral_chain_only(
		buyer: &T::AccountId,
		amount: u128,
		escrow_account: &T::AccountId,
	) -> DispatchResult {
		let amount_balance: BalanceOf<T> = amount.saturated_into();
		
		// ✅ 全部金额用于推荐链分配
		let distributable = amount_balance;
		
		// 获取推荐链（最多15代）
		let chain = T::ReferralProvider::get_sponsor_chain(buyer, 15);
		
		// 定义分成比例（15代，总计102% → 归一化到100%）
		// 第1代：30%, 第2代：25%, 第3代：15%, 第4代：10%, 第5代：7%, 第6代：3%
		// 第7-9代：各2%, 第10-15代：各1%
		let ratios: [u32; 15] = [
			300, 250, 150, 100, 70, 30,  // 前6代：900/1020
			20, 20, 20,                   // 7-9代：60/1020
			10, 10, 10, 10, 10, 10,       // 10-15代：60/1020
		]; // 总计：1020/1020，需要归一化到 1000/1000
		
		// 归一化比例（1020 → 1000）
		let total_ratio: u32 = ratios.iter().sum();
		
		let mut distributed: BalanceOf<T> = Zero::zero();
		let mut remainder = distributable;
		let mut treasury_amount: BalanceOf<T> = Zero::zero(); // ✅ 无效层级累积到国库
		
		for (depth, sponsor) in chain.iter().enumerate() {
			if depth >= 15 {
				break;
			}
			
			// 计算该层份额（归一化）
			let ratio = ratios[depth];
			let share_u128 = (amount as u64)
				.saturating_mul(ratio as u64)
				.saturating_div(total_ratio as u64) as u128;
			let share: BalanceOf<T> = share_u128.saturated_into();
			
			if share.is_zero() {
				continue;
			}
			
			// 验证推荐人是否为有效会员
			let is_valid = T::MembershipProvider::is_member_valid(sponsor);
			
			if is_valid {
				// 验证推荐人的可拿代数是否覆盖该层
				let generations = T::MembershipProvider::get_member_generations(sponsor)
					.unwrap_or(0);
				
				if generations as usize > depth {
					// 有效，进行转账
					let actual_share = core::cmp::min(share, remainder);
					if !actual_share.is_zero() {
						T::Currency::transfer(
							escrow_account,
							sponsor,
							actual_share,
							ExistenceRequirement::KeepAlive,
						)?;
						
						distributed = distributed.saturating_add(actual_share);
						remainder = remainder.saturating_sub(actual_share);
						
						// 发出事件
						Self::deposit_event(Event::ReferralRewardDistributed {
							sponsor: sponsor.clone(),
							amount: actual_share,
							depth: depth as u8,
						});
					}
				} else {
					// ✅ 代数不足，累积到国库
					treasury_amount = treasury_amount.saturating_add(share);
				}
			} else {
				// ✅ 无效会员，累积到国库
				treasury_amount = treasury_amount.saturating_add(share);
			}
		}
		
		// ✅ 将无效层级的份额转入国库
		if !treasury_amount.is_zero() {
			let actual_treasury = core::cmp::min(treasury_amount, remainder);
			if !actual_treasury.is_zero() {
				T::Currency::transfer(
					escrow_account,
					&T::TreasuryAccount::get(),
					actual_treasury,
					ExistenceRequirement::KeepAlive,
				)?;
				
				remainder = remainder.saturating_sub(actual_treasury);
				
				Self::deposit_event(Event::InvalidLevelToTreasury {
					amount: actual_treasury,
				});
			}
		}
		
		// 如果还有剩余（由于精度问题），保留在托管账户
		if !remainder.is_zero() {
			Self::deposit_event(Event::RemainingInEscrow {
				amount: remainder,
			});
		}
		
		Self::deposit_event(Event::PureReferralDistributionCompleted {
			buyer: buyer.clone(),
			total_amount: amount_balance,
			distributed,
		});
		
		Ok(())
	}

	/// 计算百分比金额
	///
	/// # 参数
	/// - `amount`: 基础金额
	/// - `percent`: 百分比（0-100）
	///
	/// # 返回
	/// 计算结果（向下取整）
	fn percent_of(amount: BalanceOf<T>, percent: u8) -> BalanceOf<T> {
		let percent_u128: u128 = percent.into();
		let amount_u128: u128 = amount.saturated_into();
		let result = amount_u128.saturating_mul(percent_u128) / 100u128;
		result.saturated_into()
	}

		/// 托管账户（Pallet账户）
	pub fn escrow_account() -> T::AccountId {
		T::PalletId::get().into_account_truncating()
	}
	}
}

// 函数级中文注释：实现 InstantAffiliateProvider trait，供 pallet-affiliate-config 调用
impl<T: pallet::Config> pallet_affiliate_config::InstantAffiliateProvider<T::AccountId, pallet::BalanceOf<T>> for pallet::Pallet<T> {
	/// 函数级详细中文注释：实现即时分配接口（职责转移后使用简化版本）
	/// - 职责转移后，offerings 已经处理了固定费用（销毁、国库、存储）
	/// - amount 是托管账户收到的金额（已扣除固定费用，如90,000）
	/// - 仅需分配推荐奖励
	fn distribute_instant(
		buyer: &T::AccountId,
		amount: pallet::BalanceOf<T>,
		escrow_account: &T::AccountId,
	) -> frame_support::dispatch::DispatchResult {
		// 函数级中文注释：调用简化版的纯推荐分配函数
		// 注意：amount 已经是扣除固定费用后的金额（如90,000）
		Self::instant_distribute_pure_referral(
			buyer,
			amount,
			escrow_account,
		)
	}
	
	/// 函数级中文注释：实现纯推荐链分配接口（100%推荐链，会员专用）
	fn distribute_to_referral_chain_only(
		buyer: &T::AccountId,
		amount: u128,
		escrow_account: &T::AccountId,
	) -> frame_support::dispatch::DispatchResult {
		Self::distribute_to_referral_chain_only(buyer, amount, escrow_account)
	}
}

