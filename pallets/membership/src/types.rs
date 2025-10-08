/// 会员系统类型定义
use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

#[cfg(feature = "std")]
use serde::{Deserialize, Serialize};

/// 会员等级枚举
/// 
/// 函数级中文注释：会员等级定义，包括年费会员和多年期会员，支持不同的推荐代数和有效期
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum MembershipLevel {
	/// 年费会员：400 MEMO，基础6代，有效期1年
	Year1,
	/// 3年会员：800 MEMO，基础9代，有效期3年
	Year3,
	/// 5年会员：1600 MEMO，基础12代，有效期5年
	Year5,
	/// 10年会员：2000 MEMO，基础15代，有效期10年
	Year10,
}

impl MembershipLevel {
	/// 将会员等级转为 ID
	pub fn to_id(&self) -> u8 {
		match self {
			Self::Year1 => 0,
			Self::Year3 => 1,
			Self::Year5 => 2,
			Self::Year10 => 3,
		}
	}

	/// 获取会员价格（单位：MEMO，需乘以 UNITS）
	pub fn price_in_units(&self) -> u128 {
		match self {
			Self::Year1 => 400,
			Self::Year3 => 800,
			Self::Year5 => 1600,
			Self::Year10 => 2000,
		}
	}

	/// 获取基础推荐代数
	pub fn base_generations(&self) -> u8 {
		match self {
			Self::Year1 => 6,
			Self::Year3 => 9,
			Self::Year5 => 12,
			Self::Year10 => 15,
		}
	}

	/// 获取有效期（年）
	pub fn years(&self) -> u32 {
		match self {
			Self::Year1 => 1,
			Self::Year3 => 3,
			Self::Year5 => 5,
			Self::Year10 => 10,
		}
	}

	/// 补升级到10年会员所需费用（单位：MEMO，需乘以 UNITS）
	/// 如果已经是10年会员，返回 None
	pub fn upgrade_to_year10_price(&self) -> Option<u128> {
		match self {
			Self::Year1 => Some(1800),   // 400 + 1800 = 2200 > 2000 (含补差费)
			Self::Year3 => Some(1500),   // 800 + 1500 = 2300 > 2000
			Self::Year5 => Some(1000),   // 1600 + 1000 = 2600 > 2000
			Self::Year10 => None,        // 已经是10年会员
		}
	}
}

/// 会员信息结构体
/// 
/// 函数级中文注释：移除了 referral_code 字段，推荐码统一由 pallet-memo-referrals 管理。
/// - 推荐码查询：通过 pallet-memo-referrals::CodeOf 存储查询
/// - 推荐码分配：购买会员时自动调用 ReferralProvider::try_auto_claim_code
/// - 推荐码验证：通过 ReferralProvider::find_account_by_code 验证
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct MembershipInfo<AccountId, BlockNumber> {
	/// 会员等级
	pub level: MembershipLevel,
	/// 购买时间（区块高度）
	pub purchased_at: BlockNumber,
	/// 有效期至（区块高度）
	pub valid_until: BlockNumber,
	/// 基础代数（根据等级固定）
	pub base_generations: u8,
	/// 奖励代数（通过推荐获得）
	pub bonus_generations: u8,
	/// 总代数（base + bonus，最多15）
	pub total_generations: u8,
	/// 推荐人账户（可选，创始会员无推荐人）
	pub referrer: Option<AccountId>,
	/// 已推荐会员数量
	pub referral_count: u32,
}

/// 会员折扣百分比（0-100）
/// 例如：20 表示 20%，即2折
pub type DiscountPercent = u8;

