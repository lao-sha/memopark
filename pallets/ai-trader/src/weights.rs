//! AI策略Pallet的权重定义

use frame_support::weights::Weight;

/// 权重信息trait
pub trait WeightInfo {
	fn create_ai_strategy() -> Weight;
	fn toggle_strategy() -> Weight;
	fn update_ai_config() -> Weight;
	fn remove_strategy() -> Weight;
	fn record_ai_signal() -> Weight;
}

/// 默认权重实现
impl WeightInfo for () {
	fn create_ai_strategy() -> Weight {
		Weight::from_parts(10_000_000, 0)
	}

	fn toggle_strategy() -> Weight {
		Weight::from_parts(5_000_000, 0)
	}

	fn update_ai_config() -> Weight {
		Weight::from_parts(8_000_000, 0)
	}

	fn remove_strategy() -> Weight {
		Weight::from_parts(5_000_000, 0)
	}

	fn record_ai_signal() -> Weight {
		Weight::from_parts(7_000_000, 0)
	}
}

