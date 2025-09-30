//! 权重实现（临时手写版，支持基准自动生成替换）。

use frame_support::weights::{constants::RocksDbWeight, Weight};

/// 函数级中文注释：权重接口（与 Config::WeightInfo 对应）。
pub trait WeightInfo {
    fn mark_fee_only() -> Weight;
    fn unmark_fee_only() -> Weight;
}

/// 函数级中文注释：默认实现（占位）。
impl WeightInfo for () {
    fn mark_fee_only() -> Weight {
        // 读写：FeeOnlyAccounts(w) + set_lock
        Weight::from_parts(5_000_000, 0).saturating_add(RocksDbWeight::get().writes(1))
    }
    fn unmark_fee_only() -> Weight {
        // 读写：FeeOnlyAccounts(rw) + remove_lock
        Weight::from_parts(5_000_000, 0)
            .saturating_add(RocksDbWeight::get().reads(1))
            .saturating_add(RocksDbWeight::get().writes(1))
    }
}
