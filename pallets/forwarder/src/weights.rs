//! 权重实现（临时手写版）。后续可用 benchmark 自动生成替换。

use frame_support::weights::{constants::RocksDbWeight, Weight};

/// 函数级中文注释：权重接口，绑定到 Config::WeightInfo。
pub trait WeightInfo {
    fn open_session() -> Weight;
    fn close_session() -> Weight;
    fn forward() -> Weight;
    fn purge_expired() -> Weight;
}

impl WeightInfo for () {
    fn open_session() -> Weight {
        Weight::from_parts(8_000_000, 0).saturating_add(RocksDbWeight::get().writes(3))
    }
    fn close_session() -> Weight {
        Weight::from_parts(6_000_000, 0).saturating_add(RocksDbWeight::get().writes(3))
    }
    fn forward() -> Weight {
        Weight::from_parts(12_000_000, 0)
            .saturating_add(RocksDbWeight::get().reads(3))
            .saturating_add(RocksDbWeight::get().writes(2))
    }
    fn purge_expired() -> Weight {
        // 近似一条的清理成本；具体随 limit 与命中数量变化，后续基准替换
        Weight::from_parts(6_000_000, 0)
            .saturating_add(RocksDbWeight::get().reads(3))
            .saturating_add(RocksDbWeight::get().writes(3))
    }
}
