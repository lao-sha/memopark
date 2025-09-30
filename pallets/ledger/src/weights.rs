//! 函数级中文注释：pallet-ledger 权重信息定义与默认实现（基准占位）。
//! - 后续可通过 frame-benchmarking 自动生成替换本实现。

use frame_support::weights::{constants::RocksDbWeight, Weight};

pub trait WeightInfo {
    /// 清理接口：按 before_week 清理，参数为 limit（影响迭代次数）
    fn purge_weeks(limit: u32) -> Weight;
    /// 清理接口：按区间清理，参数为 limit（影响迭代次数）
    fn purge_weeks_by_range(limit: u32) -> Weight;
    /// Hook：记录聚合（可能含去重键）
    fn record_from_hook_with_amount(has_amount: bool, has_dedup: bool) -> Weight;
    /// Hook：为逝者累计金额
    fn add_to_deceased_total() -> Weight;
    /// 标记周活跃（按持续周数线性增长）
    fn mark_weekly_active(weeks: u32) -> Weight;
}

/// 默认实现：基于 RocksDb 权重常量的保守手写占位值。
pub struct SubstrateWeight<T>(core::marker::PhantomData<T>);
impl<T> WeightInfo for SubstrateWeight<T> {
    fn purge_weeks(limit: u32) -> Weight {
        // 基本常数 + 每条删除一次读写
        let w = RocksDbWeight::get();
        Weight::from_parts(15_000, 0)
            .saturating_add(w.reads(1))
            .saturating_add(w.writes(1))
            .saturating_add(Weight::from_parts(3_000, 0).saturating_mul(limit.into()))
    }

    fn purge_weeks_by_range(limit: u32) -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(16_000, 0)
            .saturating_add(w.reads(1))
            .saturating_add(w.writes(1))
            .saturating_add(Weight::from_parts(3_000, 0).saturating_mul(limit.into()))
    }

    fn record_from_hook_with_amount(has_amount: bool, has_dedup: bool) -> Weight {
        let w = RocksDbWeight::get();
        let mut base = Weight::from_parts(12_000, 0)
            .saturating_add(w.reads(1))
            .saturating_add(w.writes(1));
        if has_amount {
            base = base.saturating_add(w.reads_writes(1, 1));
        }
        if has_dedup {
            base = base.saturating_add(w.reads_writes(1, 1));
        }
        base
    }

    fn add_to_deceased_total() -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(8_000, 0).saturating_add(w.reads_writes(1, 1))
    }

    fn mark_weekly_active(weeks: u32) -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(10_000, 0)
            .saturating_add(w.reads(1))
            .saturating_add(w.writes(1))
            .saturating_add(Weight::from_parts(2_000, 0).saturating_mul(weeks.into()))
    }
}
