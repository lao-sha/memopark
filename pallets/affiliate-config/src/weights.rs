//! 权重计算（占位符）
//! 
//! 生产环境应使用 benchmarking 生成实际权重

use frame_support::weights::Weight;

pub trait WeightInfo {
    fn set_settlement_mode() -> Weight;
}

impl WeightInfo for () {
    fn set_settlement_mode() -> Weight {
        Weight::from_parts(10_000_000, 0)
            .saturating_add(Weight::from_parts(0, 3500))
    }
}
