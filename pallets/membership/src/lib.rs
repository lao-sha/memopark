// Copyright (C) Stardust Team
// SPDX-License-Identifier: Apache-2.0

//! # 年费会员系统 + 统一治理 Pallet (pallet-membership)
//!
//! **🔥 2025-11-13 架构重构：成为统一治理中心**
//!
//! ## 功能概述
//!
//! 本模块实现了完整的年费会员系统 + 统一治理机制：
//!
//! ### 会员管理
//! - 多等级会员购买（1年/3年/5年/10年）
//! - 推荐码生成与验证
//! - 动态代数增长机制（推荐越多拿越多，最多15代）
//! - 会员折扣管理（默认2折优惠）
//! - 补升级到10年会员
//!
//! ### 统一治理（新增）
//! - **年费价格治理**：全民投票调整4个等级的USDT价格
//! - **分成比例治理**：为 pallet-affiliate 提供跨模块治理服务
//! - **投票机制**：加权投票 + 信念投票
//! - **技术委员会无否决权**：所有提案都必须通过全民投票
//!
//! ## 核心特性
//!
//! 1. **分级会员制度**
//!    - 年费会员：400 DUST，基础6代，有效期1年
//!    - 3年会员：800 DUST，基础9代，有效期3年
//!    - 5年会员：1600 DUST，基础12代，有效期5年
//!    - 10年会员：2000 DUST，基础15代，有效期10年
//!
//! 2. **治理权限**
//!    - 持币权重（70%）+ 参与权重（20%）+ 贡献权重（10%）
//!    - 信念投票：锁定时间换取投票权重倍数
//!    - 自适应阈值：参与率越高，通过门槛越低
//!
//! ## 接口说明
//!
//! ### 会员接口
//! - `purchase_membership`: 购买会员（需提供推荐码）
//! - `upgrade_to_year10`: 补升级到10年会员
//!
//! ### 治理接口（新增）
//! - `propose_membership_price_adjustment`: 发起年费价格调整提案
//! - `vote_on_membership_price_proposal`: 对年费价格提案投票
//! - `propose_percentage_adjustment`: 发起分成比例调整提案（为affiliate服务）
//! - `vote_on_percentage_proposal`: 对分成比例提案投票
//!
//! ### 查询接口
//! - `is_member_valid`: 检查账户是否为有效会员
//! - `get_member_generations`: 获取会员可拿代数
//! - `get_discount`: 获取会员折扣比例

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

mod types;
pub use types::*;

// 🔥 2025-11-13：新增统一治理模块
pub mod governance;
pub use governance::{
    Vote, Conviction, ProposalStatus, VoteRecord, VoteTally,
    MembershipPriceProposal, PercentageAdjustmentProposal,
    MembershipPriceChangeRecord, PercentageChangeRecord,
    LevelPercents, // 从这里导出给affiliate使用
};

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

	/// Affiliate pallet 的余额类型
	pub type AffiliateBalanceOf<T> =
		<<<T as Config>::AffiliateConfig as pallet_affiliate::Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	// 🆕 2025-10-28 已移除：旧的 trait 导入
	// 现在直接依赖 pallet-affiliate（统一联盟计酬系统）
	// - 推荐关系管理：pallet_affiliate::Pallet 提供
	// - 联盟计酬分配：pallet_affiliate::Pallet 提供

    #[pallet::pallet]
	pub struct Pallet<T>(_);

    #[pallet::config]
	/// 函数级中文注释：Membership Pallet 配置 trait
	/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式声明
	pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {

		/// 货币系统（MEMO代币）
		type Currency: Currency<Self::AccountId>;

		/// Pallet ID，用于派生国库账户
		#[pallet::constant]
		type PalletId: Get<PalletId>;

		/// 每年的区块数（用于计算会员有效期）
		/// 假设6秒一个块：365 * 24 * 60 * 60 / 6 ≈ 5,256,000
		#[pallet::constant]
		type BlocksPerYear: Get<BlockNumberFor<Self>>;

		/// DUST 代币单位（1 DUST = 10^12）
		#[pallet::constant]
		type Units: Get<BalanceOf<Self>>;

		// 🆕 2025-10-28 更新：使用关联类型连接 pallet-affiliate
		// 这样可以避免 Currency 类型冲突，同时支持跨 pallet 调用

		/// 联盟计酬系统类型（指向 Runtime，实现了 pallet_affiliate::Config）
		/// 约束：两者必须使用相同的 Currency Balance 类型
		type AffiliateConfig: pallet_affiliate::Config<
			AccountId = Self::AccountId,
			Currency = Self::Currency,
		>;

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

	/// 🆕 2025-11-10：价格查询系统（指向 Runtime，实现了 pallet_pricing::Config）
	/// 用于查询 DUST 市场价格，计算持币门槛
	type PricingConfig: pallet_pricing::Config;

	/// 🆕 2025-11-10：最低持币价值（美元，单位：美分）
	/// 默认值：10000（即 100.00 美元）
	/// 精度：100 = 1 美元
	#[pallet::constant]
	type MinHoldingValueCents: Get<u64>;

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
	/// 🆕 2025-11-10：动态价格计算完成
	/// [会员等级ID, USDT价格(精度10^6), DUST市场价格(精度10^6), 计算出的DUST数量]
	DynamicPriceCalculated {
		level_id: u8,
		usdt_price: u64,
		dust_market_price: u64,
		dust_amount: BalanceOf<T>,
	},
	/// 🆕 2025-11-10：价格计算失败，使用回退价格
	/// [会员等级ID, 回退价格]
	PriceCalculationFallback {
		level_id: u8,
		fallback_price: BalanceOf<T>,
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
		/// 🆕 2025-11-10：市场价格不可用（pallet-pricing 未初始化或为0）
		MarketPriceNotAvailable,
		/// 🆕 2025-11-10：价格计算失败（溢出或计算错误）
		PriceCalculationFailed,

		// 🔥 2025-11-13：统一治理模块错误
		/// 比例数组长度必须为15
		InvalidPercentageLength,
		/// 单层比例超过100%
		PercentageTooHigh,
		/// 🔥 2025-11-13 更新：前2层比例不能为0（第3层可以为0）
		CriticalLayerZero,
		/// 总比例低于50%
		TotalPercentageTooLow,
		/// 总比例超过99%
		TotalPercentageTooHigh,
		/// 比例不是递减的
		NonDecreasingPercentage,
		/// 第一层比例过高（超过50%）
		FirstLayerTooHigh,
		/// 提案不存在
		ProposalNotFound,
		/// 已经投票
		AlreadyVoted,
		/// 投票未激活
		VotingNotActive,
		/// 治理已暂停
		GovernancePausedError,
		/// 年费价格提案不存在
		MembershipPriceProposalNotFound,
		/// 已对年费价格提案投票
		MembershipPriceAlreadyVoted,
		/// 无效的百分比
		InvalidPercents,
		/// 活跃提案过多
		TooManyActiveProposals,
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

	// 8. ✅ 触发联盟计酬分配（100%推荐链，15层）
	// 🆕 2025-11-18 启用：会员费100%分配到推荐链，无系统扣费
	// - 使用即时分成模式（快速到账）
	// - 分配15层推荐链
	// - 激励推荐行为，促进会员增长
	let distributed = pallet_affiliate::Pallet::<T::AffiliateConfig>::distribute_membership_rewards(&who, price)?;
	
	// 发射分配事件（可选，用于追踪）
	log::info!(
		target: "membership",
		"Membership fee distributed: buyer={:?}, amount={:?}, distributed={:?}",
		who,
		price,
		distributed
	);

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

			// 3. 🆕 2025-11-10：基于 USDT 价格差计算升级费用
			// 升级价格 = Year10价格 - 当前等级价格 + 服务费(20%)
			let current_usdt = membership.level.price_in_usdt();
			let year10_usdt = MembershipLevel::Year10.price_in_usdt();
			let price_diff = year10_usdt.saturating_sub(current_usdt);

			// 添加 20% 服务费
			let service_fee = price_diff.saturating_mul(20).saturating_div(100);
			let total_usdt_price = price_diff.saturating_add(service_fee);

			// 动态计算所需 DUST
			let dust_market_price = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();
			let units: u128 = T::Units::get().saturated_into();

			let upgrade_price: BalanceOf<T> = if dust_market_price > 0 {
				// 使用市场价格计算
				let upgrade_dust_u128 = (total_usdt_price as u128)
					.saturating_mul(units)
					.checked_div(dust_market_price as u128)
					.unwrap_or_else(|| {
						// 回退到固定价格
						#[allow(deprecated)]
						membership.level.upgrade_to_year10_price()
							.unwrap_or(0)
							.saturating_mul(units)
					});
				upgrade_dust_u128.saturated_into()
			} else {
				// 市场价格不可用，使用默认固定价格
				#[allow(deprecated)]
				let upgrade_price_u128 = membership.level
					.upgrade_to_year10_price()
					.ok_or(Error::<T>::CannotUpgrade)?
					.saturating_mul(units);
				upgrade_price_u128.saturated_into()
			};

			// 4. ✅ 扣费到联盟托管账户（支持推荐链分配）
			let affiliate_account = T::AffiliatePalletId::get().into_account_truncating();
			T::Currency::transfer(
				&who,
				&affiliate_account,
				upgrade_price,
				ExistenceRequirement::KeepAlive,
			)?;

			// 4.1 ✅ 触发联盟计酬分配（100%推荐链，15层）
			// 🆕 2025-11-18 启用：升级费用100%分配到推荐链
			let distributed = pallet_affiliate::Pallet::<T::AffiliateConfig>::distribute_membership_rewards(&who, upgrade_price)?;
			log::info!(
				target: "membership",
				"Upgrade fee distributed: buyer={:?}, amount={:?}, distributed={:?}",
				who,
				upgrade_price,
				distributed
			);

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
			_origin: OriginFor<T>,
			_level_id: u8,
			_price_units: u128,
		) -> DispatchResult {
			// 🔒 此函数已被禁用：年费价格只能通过 pallet-affiliate 全民投票治理修改
			// 使用者应该通过 pallet-affiliate::propose_membership_price_adjustment 发起治理提案
			return Err(DispatchError::Other("Function disabled - use governance proposal in pallet-affiliate"));

			// 以下代码已被禁用
			/*
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
			*/
		}

		/// 批量设置所有会员等级价格
		///
		/// # 参数
		/// - `origin`: 治理起源（Root 或委员会 2/3 多数）
		/// - `year1_units`: Year1 会员价格（DUST 单位数）
		/// - `year3_units`: Year3 会员价格（DUST 单位数）
		/// - `year5_units`: Year5 会员价格（DUST 单位数）
		/// - `year10_units`: Year10 会员价格（DUST 单位数）
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
			_origin: OriginFor<T>,
			_year1_units: u128,
			_year3_units: u128,
			_year5_units: u128,
			_year10_units: u128,
		) -> DispatchResult {
			// 🔒 此函数已被禁用：年费价格只能通过 pallet-affiliate 全民投票治理修改
			// 使用者应该通过 pallet-affiliate::propose_membership_price_adjustment 发起治理提案
			return Err(DispatchError::Other("Function disabled - use governance proposal in pallet-affiliate"));

			// 以下代码已被禁用
			/*
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
		*/
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
		/// - `true`: 是有效会员（已购买且未过期且持币价值≥100美元）
		/// - `false`: 不是会员、已过期或持币价值不足
		///
		/// # 🆕 2025-11-10 变更：增加持币门槛验证
		/// - 验证1：会员存在性和时效性（原有逻辑）
		/// - 验证2：持币价值 ≥ 100美元（新增逻辑）
		/// - 价格来源：pallet-pricing 的加权平均价格
		/// - 计算公式：持币价值(美元) = 余额(DUST) × DUST价格(USDT/DUST)
		pub fn is_member_valid(who: &T::AccountId) -> bool {
			if let Some(membership) = Memberships::<T>::get(who) {
				// 验证1：会员未过期
				let current_block = <frame_system::Pallet<T>>::block_number();
				if current_block > membership.valid_until {
					return false;
				}

				// 验证2：持币价值 ≥ 100美元
				Self::check_holding_value(who)
			} else {
				false
			}
		}

		/// 🆕 2025-11-10：检查持币价值是否满足门槛
		///
		/// # 参数
		/// - `who`: 要检查的账户
		///
		/// # 返回
		/// - `true`: 持币价值 ≥ 100美元
		/// - `false`: 持币价值 < 100美元
		///
		/// # 计算逻辑
		/// 1. 获取账户 DUST 余额（精度 10^12）
		/// 2. 获取 DUST 市场价格（精度 10^6，即 USDT/DUST）
		/// 3. 计算持币价值（美元）= 余额 × 价格 / 10^12 / 10^6
		/// 4. 与门槛（100美元 = 10000美分）比较
		///
		/// # 示例
		/// - 余额：1,000,000 DUST（= 1,000,000 × 10^12）
		/// - DUST价格：0.0001 USDT（= 100 × 10^6 精度）
		/// - 持币价值：1,000,000 × 100 / 10^12 = 100 美元 ✅
		fn check_holding_value(who: &T::AccountId) -> bool {
			// 1. 获取账户余额（精度 10^12）
			let balance = T::Currency::free_balance(who);
			let balance_u128: u128 = balance.saturated_into();

			// 2. 获取 DUST 市场价格（USDT/DUST，精度 10^6）
			// 使用加权平均价格，更准确反映市场情况
			let dust_price_usdt = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();

			// 3. 计算持币价值（美分）
			// 持币价值 = (余额 × 价格) / (10^12 × 10^6) × 100
			//          = (余额 × 价格 × 100) / (10^12 × 10^6)
			//          = (余额 × 价格) / 10^16
			// 注意：USDT精度是10^6，1 USDT = 1,000,000，所以需要除以10^6
			//      DUST精度是10^12，1 DUST = 1,000,000,000,000，所以需要除以10^12
			//      美元转美分需要乘以100
			let holding_value_cents = balance_u128
				.saturating_mul(dust_price_usdt as u128)
				.saturating_mul(100) // 转换为美分
				.checked_div(1_000_000_000_000_000_000) // 除以 10^18 (10^12 × 10^6)
				.unwrap_or(0);

			// 4. 与门槛比较（100美元 = 10000美分）
			let min_value_cents = T::MinHoldingValueCents::get();
			holding_value_cents >= min_value_cents as u128
		}

		/// 🆕 2025-11-10：获取账户持币价值（美元）
		///
		/// # 参数
		/// - `who`: 要查询的账户
		///
		/// # 返回
		/// - 持币价值（美元，两位小数，例如：100.50 美元）
		///
		/// # 用途
		/// - 前端显示用户持币价值
		/// - 监控持币门槛状态
		pub fn get_holding_value_usd(who: &T::AccountId) -> (u64, u32) {
			let balance = T::Currency::free_balance(who);
			let balance_u128: u128 = balance.saturated_into();
			let dust_price_usdt = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();

			// 计算持币价值（美分）
			let holding_value_cents = balance_u128
				.saturating_mul(dust_price_usdt as u128)
				.saturating_mul(100)
				.checked_div(1_000_000_000_000_000_000)
				.unwrap_or(0);

			// 转换为美元和美分
			let dollars = (holding_value_cents / 100) as u64;
			let cents = (holding_value_cents % 100) as u32;

			(dollars, cents)
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

		/// 🆕 2025-11-10：根据当前市场价格动态计算所需 DUST 数量
		///
		/// 函数级中文注释：基于 USDT 固定定价 + pallet-pricing 市场价格动态计算
		///
		/// # 参数
		/// - `level`: 会员等级
		///
		/// # 返回
		/// - `Ok(DUST数量)`: 成功，返回当前市场价格下所需的 DUST 数量
		/// - `Err`: 市场价格不可用或计算失败
		///
		/// # 计算公式
		/// ```text
		/// 需要DUST = (USDT价格 × UNITS) / DUST市场价格
		/// ```
		///
		/// # 示例
		/// - Year1: 50 USDT
		/// - DUST市场价格: 0.0001 USDT/DUST (100, 精度10^6)
		/// - 所需DUST: (50 × 10^6 × UNITS) / 100 = 500,000 DUST
		pub fn calculate_dust_amount_from_usdt(level: MembershipLevel) -> Result<BalanceOf<T>, Error<T>> {
			// 1. 获取 USDT 价格（精度 10^6）
			let usdt_price = level.price_in_usdt();

			// 2. 获取 DUST 市场价格（精度 10^6）
			let dust_market_price = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();

			// 3. 验证市场价格有效性
			if dust_market_price == 0 {
				return Err(Error::<T>::MarketPriceNotAvailable);
			}

			// 4. 计算所需 DUST 数量
			// 需要DUST = (USDT价格 × UNITS) / DUST市场价格
			let units: u128 = T::Units::get().saturated_into();
			let dust_amount_u128 = (usdt_price as u128)
				.saturating_mul(units)
				.checked_div(dust_market_price as u128)
				.ok_or(Error::<T>::PriceCalculationFailed)?;

			Ok(dust_amount_u128.saturated_into())
		}

		/// 获取会员等级价格（最小单位）
		///
		/// 函数级中文注释：优先使用 USDT 动态定价，失败时回退到存储价格或默认价格
		///
		/// # 参数
		/// - `level`: 会员等级
		///
		/// # 返回
		/// 价格（最小单位）
		///
		/// # 定价策略（按优先级）
		/// 1. **动态 USDT 定价**：基于 pallet-pricing 市场价格实时计算
		/// 2. **存储价格**：治理设置的固定价格
		/// 3. **默认价格**：硬编码的回退价格
		pub fn get_membership_price(level: MembershipLevel) -> BalanceOf<T> {
			// 策略1：尝试使用动态 USDT 定价
			match Self::calculate_dust_amount_from_usdt(level) {
				Ok(dynamic_price) => {
					// 成功：记录动态价格计算事件
					let dust_market_price = pallet_pricing::Pallet::<T::PricingConfig>::get_dust_market_price_weighted();
					Self::deposit_event(Event::DynamicPriceCalculated {
						level_id: level.to_id(),
						usdt_price: level.price_in_usdt(),
						dust_market_price,
						dust_amount: dynamic_price,
					});
					return dynamic_price;
				},
				Err(_) => {
					// 失败：尝试回退策略
					// 策略2：使用存储价格
					if let Some(stored_price) = MembershipPrices::<T>::get(level) {
						Self::deposit_event(Event::PriceCalculationFallback {
							level_id: level.to_id(),
							fallback_price: stored_price,
						});
						return stored_price;
					}

					// 策略3：使用默认价格
					#[allow(deprecated)]
					let units: u128 = T::Units::get().saturated_into();
					#[allow(deprecated)]
					let default_price_u128 = level.price_in_units().saturating_mul(units);
					let default_price: BalanceOf<T> = default_price_u128.saturated_into();

					Self::deposit_event(Event::PriceCalculationFallback {
						level_id: level.to_id(),
						fallback_price: default_price,
					});
					return default_price;
				}
			}
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
