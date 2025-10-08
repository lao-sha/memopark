/// 权重计算（占位实现，生产环境需要通过benchmark生成）
use frame_support::weights::Weight;

/// 权重信息 Trait
pub trait WeightInfo {
	fn purchase_membership() -> Weight;
	fn upgrade_to_year10() -> Weight;
	fn set_member_discount() -> Weight;
}

/// 默认权重实现
impl WeightInfo for () {
	/// 购买会员权重
	/// - 读取：推荐码映射、推荐人会员信息
	/// - 写入：会员信息、推荐码映射、统计数据
	/// - 货币转账：1次
	fn purchase_membership() -> Weight {
		Weight::from_parts(50_000_000, 0)
			.saturating_add(Weight::from_parts(0, 5_000))
	}

	/// 升级到10年会员权重
	/// - 读取：会员信息
	/// - 写入：会员信息、统计数据
	/// - 货币转账：1次
	fn upgrade_to_year10() -> Weight {
		Weight::from_parts(40_000_000, 0)
			.saturating_add(Weight::from_parts(0, 3_000))
	}

	/// 设置会员折扣权重
	/// - 写入：折扣配置
	fn set_member_discount() -> Weight {
		Weight::from_parts(10_000_000, 0)
			.saturating_add(Weight::from_parts(0, 1_000))
	}
}
