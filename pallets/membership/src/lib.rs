// Copyright (C) Memopark Team
// SPDX-License-Identifier: Apache-2.0

//! # 年费会员系统 Pallet (pallet-membership)
//!
//! ## 功能概述
//!
//! 本模块实现了完整的年费会员系统，包括：
//! - 多等级会员购买（1年/3年/5年/10年）
//! - 推荐码生成与验证
//! - 动态代数增长机制（推荐越多拿越多，最多15代）
//! - 会员折扣管理（默认2折优惠）
//! - 补升级到10年会员
//!
//! ## 核心特性
//!
//! 1. **分级会员制度**
//!    - 年费会员：400 MEMO，基础6代，有效期1年
//!    - 3年会员：800 MEMO，基础9代，有效期3年
//!    - 5年会员：1600 MEMO，基础12代，有效期5年
//!    - 10年会员：2000 MEMO，基础15代，有效期10年
//!
//! 2. **动态代数增长**
//!    - 每推荐一个会员，奖励代数+1
//!    - 总代数 = 基础代数 + 奖励代数（最多15代）
//!    - 10年会员初始即为15代，无增长空间
//!
//! 3. **推荐关系管理**
//!    - 基于 pallet-memo-referrals 的推荐关系
//!    - 自动生成唯一推荐码
//!    - 推荐人必须是有效会员
//!
//! 4. **会员折扣**
//!    - 默认享受2折优惠（20%）
//!    - 可通过治理调整折扣比例
//!    - 在供奉等消费场景立即生效
//!
//! ## 接口说明
//!
//! ### 用户接口
//! - `purchase_membership`: 购买会员（需提供推荐码）
//! - `upgrade_to_year10`: 补升级到10年会员
//!
//! ### 治理接口
//! - `set_member_discount`: 设置会员折扣比例（Root）
//!
//! ### 查询接口
//! - `is_member_valid`: 检查账户是否为有效会员
//! - `get_member_generations`: 获取会员可拿代数
//! - `get_discount`: 获取会员折扣比例

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

mod types;
pub use types::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;

pub mod weights;
pub use weights::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
	use frame_support::{
		pallet_prelude::*,
		traits::{Currency, ExistenceRequirement, Get},
		PalletId,
	};
    use frame_system::pallet_prelude::*;
	use sp_runtime::traits::{AccountIdConversion, Saturating, SaturatedConversion};
	use sp_std::vec::Vec;

	/// 余额类型
	pub type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	// 🆕 2025-10-28 已移除：旧的 trait 导入
	// 现在直接依赖 pallet-affiliate（统一联盟计酬系统）
	// - 推荐关系管理：pallet_affiliate::Pallet 提供
	// - 联盟计酬分配：pallet_affiliate::Pallet 提供

    #[pallet::pallet]
	pub struct Pallet<T>(_);

    #[pallet::config]
	pub trait Config: frame_system::Config {
		/// 事件类型
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// 货币系统（MEMO代币）
		type Currency: Currency<Self::AccountId>;

		/// Pallet ID，用于派生国库账户
		#[pallet::constant]
		type PalletId: Get<PalletId>;

		/// 每年的区块数（用于计算会员有效期）
		/// 假设6秒一个块：365 * 24 * 60 * 60 / 6 ≈ 5,256,000
		#[pallet::constant]
		type BlocksPerYear: Get<BlockNumberFor<Self>>;

		/// MEMO 代币单位（1 DUST = 10^12）
		#[pallet::constant]
		type Units: Get<BalanceOf<Self>>;

		// 🆕 2025-10-28 更新：使用关联类型连接 pallet-affiliate
		// 这样可以避免 Currency 类型冲突，同时支持跨 pallet 调用
		
		/// 联盟计酬系统类型（指向 Runtime，实现了 pallet_affiliate::Config）
		type AffiliateConfig: pallet_affiliate::Config<AccountId = Self::AccountId>;

		/// 治理起源（Root 或委员会 2/3 多数）
		/// 
		/// 用于价格调整等重要治理操作
		type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// 最低会员价格（防止设置为 0 或过低）
		#[pallet::constant]
		type MinMembershipPrice: Get<BalanceOf<Self>>;

	/// 最高会员价格（防止恶意设置过高）
	#[pallet::constant]
	type MaxMembershipPrice: Get<BalanceOf<Self>>;

	/// 函数级中文注释：联盟计酬 PalletId
	#[pallet::constant]
	type AffiliatePalletId: Get<PalletId>;

	/// 权重信息
    type WeightInfo: WeightInfo;
}

	/// 会员信息存储映射
	/// 键：账户ID
	/// 值：会员信息
	/// 
	/// 函数级中文注释：移除了推荐码存储，推荐码统一由 pallet-memo-referrals 管理。
	#[pallet::storage]
	#[pallet::getter(fn memberships)]
	pub type Memberships<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		MembershipInfo<T::AccountId, BlockNumberFor<T>>,
		OptionQuery,
	>;

	// 函数级中文注释：已移除 ReferralCodeToAccount 存储，推荐码查询统一使用 pallet-memo-referrals::OwnerOfCode

	/// 总会员数统计（按等级）
    #[pallet::storage]
	#[pallet::getter(fn total_members)]
	pub type TotalMembers<T: Config> =
		StorageMap<_, Blake2_128Concat, MembershipLevel, u32, ValueQuery>;

	/// 会员折扣比例（0-100）
	/// 默认值：20，表示20%，即2折
    #[pallet::storage]
	#[pallet::getter(fn member_discount)]
	pub type MemberDiscount<T: Config> = StorageValue<_, DiscountPercent, ValueQuery>;

	/// 会员等级价格存储（按 DUST 代币单位数）
	/// 如果未设置，使用 MembershipLevel 的默认值
	#[pallet::storage]
	#[pallet::getter(fn membership_price)]
	pub type MembershipPrices<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		MembershipLevel,
		BalanceOf<T>,
		OptionQuery,
	>;

	/// 创世配置
	/// 
	/// 函数级中文注释：暂时禁用创世配置，避免 serde 编译问题，待后续重构
	// TODO: 重构 GenesisConfig 以支持正确的 serde 序列化
	/*
    #[pallet::genesis_config]
    #[derive(frame_support::DefaultNoBound)]
	#[cfg_attr(feature = "std", derive(serde::Serialize, serde::Deserialize))]
	pub struct GenesisConfig<T: Config> {
		/// 初始会员折扣（默认20，即2折）
		pub initial_discount: DiscountPercent,
		/// 创始会员列表（无需推荐人）
		pub genesis_members: Vec<(T::AccountId, MembershipLevel)>,
    }

    #[pallet::genesis_build]
	impl<T: Config> BuildGenesisConfig for GenesisConfig<T> {
        fn build(&self) {
			// 设置初始折扣
			MemberDiscount::<T>::put(self.initial_discount);

			// 创建创始会员
			let current_block = frame_system::Pallet::<T>::block_number();
			for (account, level) in &self.genesis_members {
				let _ = Pallet::<T>::create_membership_internal(
					account.clone(),
					*level,
					None,
					current_block,
				);
			}
        }
    }
	*/

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 购买会员成功
		/// [购买者, 会员等级ID (0=Year1,1=Year3,2=Year5,3=Year10), 有效期至, 推荐人]
		MembershipPurchased {
			who: T::AccountId,
			level_id: u8,
			valid_until: BlockNumberFor<T>,
			referrer: Option<T::AccountId>,
		},
		/// 会员升级成功
		/// [升级者, 原等级ID, 新等级ID, 新有效期至]
		MembershipUpgraded {
			who: T::AccountId,
			from_id: u8,
			to_id: u8,
			new_valid_until: BlockNumberFor<T>,
		},
		/// 推荐代数增加
		/// [推荐人, 奖励代数, 总代数]
		GenerationIncreased { who: T::AccountId, bonus: u8, total: u8 },
		/// 会员折扣更新
		/// [新折扣比例]
		DiscountUpdated { discount: DiscountPercent },
		/// 会员价格更新
		/// [会员等级ID (0=Year1,1=Year3,2=Year5,3=Year10), 新价格(最小单位)]
		MembershipPriceUpdated { level_id: u8, price: BalanceOf<T> },
	/// 批量价格更新
	/// [更新数量]
	BatchPricesUpdated { count: u8 },
	/// 函数级中文注释：种子会员已添加
	/// [账户, 会员等级ID]
	SeedMemberAdded {
		who: T::AccountId,
		level_id: u8,
	},
}

    #[pallet::error]
	pub enum Error<T> {
		/// 已经是会员（不允许重复购买）
        AlreadyMember,
		/// 不是会员
        NotMember,
		/// 无效的推荐码
		InvalidReferralCode,
		/// 推荐码太长
		ReferralCodeTooLong,
		/// 推荐人无效（不是会员或已过期）
		ReferrerNotValid,
		/// 已经是10年会员，无法升级
		AlreadyYear10,
		/// 无法升级
		CannotUpgrade,
		/// 会员已过期
		MembershipExpired,
		/// 折扣比例无效（必须0-100）
		InvalidDiscount,
		/// 推荐码已存在
		ReferralCodeExists,
		/// 价格超出允许范围（过低或过高）
		PriceOutOfRange,
		/// 价格未设置（治理需要初始化）
		PriceNotSet,
    }

    #[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 购买会员
		///
		/// # 参数
		/// - `origin`: 购买者（签名来源）
		/// - `level`: 会员等级（Year1/Year3/Year5/Year10）
		/// - `referral_code`: 推荐码（可选，创始会员无需提供）
		///
		/// # 权重计算
		/// - 读取：推荐码映射、推荐人会员信息
		/// - 写入：会员信息、推荐码映射、统计数据
		/// - 货币转账：1次
		///
		/// # 错误
		/// - `AlreadyMember`: 已经是会员
		/// - `InvalidReferralCode`: 推荐码不存在或无效
		/// - `ReferrerNotValid`: 推荐人不是有效会员
		/// - `ReferralCodeExists`: 生成的推荐码已存在（极小概率）
	#[pallet::call_index(0)]
	#[pallet::weight(T::WeightInfo::purchase_membership())]
	pub fn purchase_membership(
        origin: OriginFor<T>,
		level_id: u8,
		referral_code: Vec<u8>,  // ✅ 改为必填
	) -> DispatchResult {
		let who = ensure_signed(origin)?;

		// 0. 解析会员等级
		let level = match level_id {
			0 => MembershipLevel::Year1,
			1 => MembershipLevel::Year3,
			2 => MembershipLevel::Year5,
			3 => MembershipLevel::Year10,
			_ => return Err(Error::<T>::CannotUpgrade.into()),
		};

	// 1. 验证不能重复购买
	ensure!(!Memberships::<T>::contains_key(&who), Error::<T>::AlreadyMember);

	// 2. 函数级中文注释：验证推荐码（必填）
	// 🆕 2025-10-28 更新：通过 AffiliateConfig 关联类型调用 pallet-affiliate
	let referrer_account = {
		use frame_support::BoundedVec;
		let code_bounded = BoundedVec::try_from(referral_code.clone())
			.map_err(|_| Error::<T>::InvalidReferralCode)?;
		pallet_affiliate::Pallet::<T::AffiliateConfig>::find_account_by_code(&code_bounded)
			.ok_or(Error::<T>::InvalidReferralCode)?
	};

	// 验证推荐人是有效会员
	ensure!(
		Self::is_member_valid(&referrer_account),
		Error::<T>::ReferrerNotValid
	);

	let referrer = Some(referrer_account);

	// 3. ✅ 计算价格并转账到联盟托管账户
	let price = Self::get_membership_price(level);
	let affiliate_account = T::AffiliatePalletId::get().into_account_truncating();
	
	T::Currency::transfer(
		&who,
		&affiliate_account,  // ✅ 改为联盟托管账户
		price,
		ExistenceRequirement::KeepAlive,
	)?;

	// 4. 函数级中文注释：绑定推荐关系（必须在自动分配推荐码之前）
	// 🆕 2025-10-28 更新：通过 AffiliateConfig 关联类型调用
	if let Some(ref referrer_account) = referrer {
		pallet_affiliate::Pallet::<T::AffiliateConfig>::bind_sponsor_internal(&who, referrer_account);
	}

	// 5. 创建会员信息（不再生成推荐码）
	let current_block = <frame_system::Pallet<T>>::block_number();
	let valid_until = Self::create_membership_internal(
		who.clone(),
		level,
		referrer.clone(),
		current_block,
	)?;

	// 6. 函数级中文注释：自动为新会员分配推荐码
	// 🆕 2025-10-28 更新：会员现在可以手动调用 pallet-affiliate::claim_code 认领推荐码
	// 不再在购买时自动分配（简化流程）
	// if referrer.is_some() {
	// 	// 用户需要手动调用 affiliate.claim_code() 认领推荐码
	// }

	// 7. 增加推荐人的奖励代数
	if let Some(ref referrer_account) = referrer {
		Self::increase_referrer_generation(referrer_account)?;
	}

	// 8. ✅ 触发联盟计酬分配（100%推荐链）
	// 🆕 2025-10-28 更新：调用 pallet-affiliate 的会员专用分配
	// TODO: pallet-affiliate 需要实现 distribute_membership_rewards 公开方法
	// 暂时跳过，后续补充实现
	let price_u128: u128 = price.saturated_into();
	let _ = price_u128; // 避免未使用警告
	// pallet_affiliate::Pallet::<T>::do_distribute_membership_rewards(&who, price.into())?;

	// 9. 发出事件
	Self::deposit_event(Event::MembershipPurchased {
		who,
		level_id: level.to_id(),
		valid_until,
		referrer,
	});

		Ok(())
	}

		/// 补升级到10年会员
		///
		/// # 参数
		/// - `origin`: 升级者（必须已是会员）
		///
		/// # 说明
		/// - 只能从Year1/Year3/Year5升级到Year10
		/// - 需要支付补差价（含升级费用）
		/// - 升级后有效期从当前时间重新计算10年
		/// - 推荐代数立即提升至15代
		///
		/// # 权重计算
		/// - 读取：会员信息
		/// - 写入：会员信息、统计数据
		/// - 货币转账：1次
		///
		/// # 错误
		/// - `NotMember`: 不是会员
		/// - `AlreadyYear10`: 已经是10年会员
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::upgrade_to_year10())]
		pub fn upgrade_to_year10(origin: OriginFor<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 1. 获取当前会员信息
			let mut membership =
				Memberships::<T>::get(&who).ok_or(Error::<T>::NotMember)?;

			// 2. 验证不是已经是10年会员
			ensure!(membership.level != MembershipLevel::Year10, Error::<T>::AlreadyYear10);

			// 3. 计算升级费用
			let units: u128 = T::Units::get().saturated_into();
			let upgrade_price_u128 = membership
				.level
				.upgrade_to_year10_price()
				.ok_or(Error::<T>::CannotUpgrade)?
				.saturating_mul(units);
			let upgrade_price: BalanceOf<T> = upgrade_price_u128.saturated_into();

			// 4. 扣费
			T::Currency::transfer(
				&who,
				&Self::treasury_account(),
				upgrade_price,
				ExistenceRequirement::KeepAlive,
			)?;

			// 5. 更新会员信息
			let old_level = membership.level;
			membership.level = MembershipLevel::Year10;
			membership.base_generations = 15;
			// 升级到10年会员后，总代数直接为15（不再受bonus影响）
			membership.total_generations = 15;

			// 重新计算有效期（从现在开始10年）
			let current_block = <frame_system::Pallet<T>>::block_number();
			let blocks_per_year = T::BlocksPerYear::get();
			membership.valid_until =
				current_block.saturating_add(blocks_per_year.saturating_mul(10u32.into()));

			// 记录新有效期用于事件
			let new_valid_until = membership.valid_until;

			// 6. 保存
			Memberships::<T>::insert(&who, membership);

			// 7. 更新统计
			TotalMembers::<T>::mutate(&old_level, |count| {
				*count = count.saturating_sub(1)
			});
			TotalMembers::<T>::mutate(&MembershipLevel::Year10, |count| {
				*count = count.saturating_add(1)
			});

			// 8. 发出事件
			Self::deposit_event(Event::MembershipUpgraded {
				who,
				from_id: old_level.to_id(),
				to_id: MembershipLevel::Year10.to_id(),
				new_valid_until,
			});

            Ok(())
        }

		/// 设置会员折扣（Root权限）
		///
		/// # 参数
		/// - `origin`: Root来源
		/// - `discount`: 折扣比例（0-100，例如20表示20%即2折）
		///
		/// # 权重计算
		/// - 写入：折扣配置
		///
		/// # 错误
		/// - `InvalidDiscount`: 折扣比例超出范围
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::set_member_discount())]
		pub fn set_member_discount(
            origin: OriginFor<T>,
			discount: DiscountPercent,
		) -> DispatchResult {
			ensure_root(origin)?;

			// 验证折扣范围（0-100）
			ensure!(discount <= 100, Error::<T>::InvalidDiscount);

			MemberDiscount::<T>::put(discount);
			Self::deposit_event(Event::DiscountUpdated { discount });
			Ok(())
		}

		/// 设置单个会员等级价格
		///
		/// # 参数
		/// - `origin`: 治理起源（Root 或委员会 2/3 多数）
		/// - `level`: 会员等级
		/// - `price_units`: 价格（以 DUST 单位数计算，非最小单位）
		///
		/// # 说明
		/// - 只有治理可调用
		/// - 价格必须在 MinMembershipPrice 和 MaxMembershipPrice 之间
		/// - 建议：Year3 > Year1, Year5 > Year3, Year10 > Year5
		///
		/// # 权重计算
		/// - 写入：价格存储 1 项
		///
		/// # 错误
		/// - `PriceOutOfRange`: 价格超出允许范围
		///
		/// # 示例
		/// ```ignore
		/// // 设置 Year1 价格为 400 DUST
		/// set_membership_price(origin, MembershipLevel::Year1, 400)?;
		/// ```
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::set_member_discount())]
		pub fn set_membership_price(
			origin: OriginFor<T>,
			level_id: u8,
			price_units: u128,
		) -> DispatchResult {
			// 治理权限验证
			T::GovernanceOrigin::ensure_origin(origin)?;

			// 解析会员等级
			let level = match level_id {
				0 => MembershipLevel::Year1,
				1 => MembershipLevel::Year3,
				2 => MembershipLevel::Year5,
				3 => MembershipLevel::Year10,
				_ => return Err(Error::<T>::CannotUpgrade.into()), // 复用错误类型
			};

			// 转换为最小单位
			let units: u128 = T::Units::get().saturated_into();
			let price_u128 = price_units.saturating_mul(units);
			let price: BalanceOf<T> = price_u128.saturated_into();

			// 验证价格范围
			ensure!(
				price >= T::MinMembershipPrice::get() && price <= T::MaxMembershipPrice::get(),
				Error::<T>::PriceOutOfRange
			);

			// 存储价格
			MembershipPrices::<T>::insert(level, price);

			// 触发事件
			Self::deposit_event(Event::MembershipPriceUpdated { level_id, price });

			Ok(())
		}

		/// 批量设置所有会员等级价格
		///
		/// # 参数
		/// - `origin`: 治理起源（Root 或委员会 2/3 多数）
		/// - `year1_units`: Year1 会员价格（MEMO 单位数）
		/// - `year3_units`: Year3 会员价格（MEMO 单位数）
		/// - `year5_units`: Year5 会员价格（MEMO 单位数）
		/// - `year10_units`: Year10 会员价格（MEMO 单位数）
		///
		/// # 说明
		/// - 只有治理可调用
		/// - 所有价格必须在允许范围内
		/// - 建议保持递增：Year1 < Year3 < Year5 < Year10
		///
		/// # 权重计算
		/// - 写入：价格存储 4 项
		///
		/// # 错误
		/// - `PriceOutOfRange`: 任一价格超出允许范围
		///
		/// # 示例
		/// ```ignore
		/// // 批量设置：400, 800, 1600, 2000 DUST
		/// set_all_membership_prices(origin, 400, 800, 1600, 2000)?;
		/// ```
		#[pallet::call_index(4)]
		#[pallet::weight(T::WeightInfo::set_member_discount().saturating_mul(4))]
		pub fn set_all_membership_prices(
			origin: OriginFor<T>,
			year1_units: u128,
			year3_units: u128,
			year5_units: u128,
			year10_units: u128,
		) -> DispatchResult {
			// 治理权限验证
			T::GovernanceOrigin::ensure_origin(origin)?;

			// 转换为最小单位并验证
			let prices = [
				(MembershipLevel::Year1, year1_units),
				(MembershipLevel::Year3, year3_units),
				(MembershipLevel::Year5, year5_units),
				(MembershipLevel::Year10, year10_units),
			];

			let unit_balance: u128 = T::Units::get().saturated_into();

			for (level, units) in &prices {
				let price_u128 = units.saturating_mul(unit_balance);
				let price: BalanceOf<T> = price_u128.saturated_into();
				ensure!(
					price >= T::MinMembershipPrice::get() && price <= T::MaxMembershipPrice::get(),
					Error::<T>::PriceOutOfRange
				);
				MembershipPrices::<T>::insert(level, price);
			}

		// 触发批量更新事件
		Self::deposit_event(Event::BatchPricesUpdated { count: 4 });

		Ok(())
	}

	/// 函数级中文注释：治理添加种子会员（仅 Root）
	/// 
	/// # 参数
	/// - `origin`: Root 起源
	/// - `who`: 种子会员账户
	/// - `level_id`: 会员等级 (0=Year1, 1=Year3, 2=Year5, 3=Year10)
	/// 
	/// # 说明
	/// - 仅 Root 可调用
	/// - 无需推荐人
	/// - 用于创建初始种子会员
	/// 
	/// # 权重计算
	/// - 写入：会员信息、统计数据
	#[pallet::call_index(5)]
	#[pallet::weight(T::WeightInfo::purchase_membership())]
	pub fn add_seed_member(
		origin: OriginFor<T>,
		who: T::AccountId,
		level_id: u8,
	) -> DispatchResult {
		ensure_root(origin)?;
		
		let level = match level_id {
			0 => MembershipLevel::Year1,
			1 => MembershipLevel::Year3,
			2 => MembershipLevel::Year5,
			3 => MembershipLevel::Year10,
			_ => return Err(Error::<T>::CannotUpgrade.into()),
		};
		
		ensure!(
			!Memberships::<T>::contains_key(&who),
			Error::<T>::AlreadyMember
		);
		
		let current_block = <frame_system::Pallet<T>>::block_number();
		
		// 直接创建会员，无需推荐人
		Self::create_membership_internal(
			who.clone(),
			level,
			None, // 无推荐人
			current_block,
		)?;
		
		Self::deposit_event(Event::SeedMemberAdded {
			who,
			level_id: level.to_id(),
		});
		
		Ok(())
	}
}

/// 内部辅助函数
impl<T: Config> Pallet<T> {
		/// 检查账户是否是有效会员
		///
		/// # 参数
		/// - `who`: 要检查的账户
		///
		/// # 返回
		/// - `true`: 是有效会员（已购买且未过期）
		/// - `false`: 不是会员或已过期
		pub fn is_member_valid(who: &T::AccountId) -> bool {
			if let Some(membership) = Memberships::<T>::get(who) {
				let current_block = <frame_system::Pallet<T>>::block_number();
				current_block <= membership.valid_until
			} else {
				false
			}
		}

		/// 获取会员可拿代数
		///
		/// # 参数
		/// - `who`: 要查询的账户
		///
		/// # 返回
		/// - `Some(代数)`: 有效会员的可拿代数
		/// - `None`: 不是会员或已过期
		pub fn get_member_generations(who: &T::AccountId) -> Option<u8> {
			if let Some(membership) = Memberships::<T>::get(who) {
				if Self::is_member_valid(who) {
					return Some(membership.total_generations)
				}
			}
			None
		}

		/// 获取会员折扣比例
		///
		/// # 返回
		/// 折扣比例（0-100）
		pub fn get_discount() -> DiscountPercent {
			MemberDiscount::<T>::get()
		}

		/// 获取会员等级价格（最小单位）
		///
		/// # 参数
		/// - `level`: 会员等级
		///
		/// # 返回
		/// 价格（最小单位），如果存储中有设置则返回存储价格，否则返回默认价格
		pub fn get_membership_price(level: MembershipLevel) -> BalanceOf<T> {
			MembershipPrices::<T>::get(level).unwrap_or_else(|| {
				// 如果存储中没有设置，使用默认价格
				let units: u128 = T::Units::get().saturated_into();
				let price_u128 = level.price_in_units().saturating_mul(units);
				price_u128.saturated_into()
			})
		}

	/// 内部函数：创建会员信息
	///
	/// # 参数
	/// - `who`: 会员账户
	/// - `level`: 会员等级
	/// - `referrer`: 推荐人（可选）
	/// - `current_block`: 当前区块高度
	///
	/// # 返回
	/// - `Ok(有效期至)`: 成功，返回有效期区块高度
	/// - `Err`: 创建失败
	/// 
	/// 函数级中文注释：移除了推荐码生成逻辑，推荐码由 pallet-memo-referrals 统一管理。
	fn create_membership_internal(
		who: T::AccountId,
		level: MembershipLevel,
		referrer: Option<T::AccountId>,
		current_block: BlockNumberFor<T>,
	) -> Result<BlockNumberFor<T>, DispatchError> {
		// 1. 计算有效期
		let blocks_per_year = T::BlocksPerYear::get();
		let valid_until = current_block
			.saturating_add(blocks_per_year.saturating_mul(level.years().into()));

		// 2. 创建会员信息（不包含推荐码）
		let base_generations = level.base_generations();
		let membership = MembershipInfo {
			level,
			purchased_at: current_block,
			valid_until,
			base_generations,
			bonus_generations: 0,
			total_generations: base_generations,
			referrer,
			referral_count: 0,
		};

		// 3. 保存会员信息
		Memberships::<T>::insert(&who, membership);
		TotalMembers::<T>::mutate(&level, |count| *count = count.saturating_add(1));

		Ok(valid_until)
	}

	/// 增加推荐人的奖励代数
	///
	/// # 参数
	/// - `referrer`: 推荐人账户
	///
	/// # 逻辑
	/// - 每推荐一个会员，奖励代数+1
	/// - 总代数 = 基础代数 + 奖励代数
	/// - 总代数上限为15
	/// - 10年会员初始即15代，不再增长
	fn increase_referrer_generation(referrer: &T::AccountId) -> DispatchResult {
		Memberships::<T>::try_mutate(referrer, |maybe_membership| -> DispatchResult {
			if let Some(ref mut membership) = maybe_membership {
				// 每推荐一个会员，增加1代
				membership.bonus_generations =
					membership.bonus_generations.saturating_add(1);

				// 重新计算总代数（最多15代）
				membership.total_generations = 15u8.min(
					membership.base_generations.saturating_add(membership.bonus_generations),
				);

				// 增加推荐计数
				membership.referral_count = membership.referral_count.saturating_add(1);

				// 发出事件
				Self::deposit_event(Event::GenerationIncreased {
					who: referrer.clone(),
					bonus: membership.bonus_generations,
					total: membership.total_generations,
				});
			}
			Ok(())
		})
	}

	// 函数级中文注释：已移除 generate_referral_code() 和 hex_char() 函数
	// 推荐码生成统一由 pallet-memo-referrals 管理

	/// 国库账户（Pallet账户）
	pub fn treasury_account() -> T::AccountId {
		T::PalletId::get().into_account_truncating()
    }
    }
}
