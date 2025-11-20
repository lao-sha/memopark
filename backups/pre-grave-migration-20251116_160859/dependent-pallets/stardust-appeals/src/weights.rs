//! 函数级中文注释：memo-content-governance 权重接口与占位实现。
//! 后续可通过 frame-benchmarking 自动生成覆盖本实现。

use frame_support::weights::{constants::RocksDbWeight, Weight};

pub trait WeightInfo {
    fn on_initialize(processed: u32) -> Weight;
    fn submit_appeal() -> Weight;
    fn withdraw_appeal() -> Weight;
    fn approve_appeal() -> Weight;
    fn reject_appeal() -> Weight;
    fn purge_appeals(limit: u32) -> Weight;
}

pub struct SubstrateWeight<T>(core::marker::PhantomData<T>);
impl<T> WeightInfo for SubstrateWeight<T> {
    fn on_initialize(processed: u32) -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(10_000, 0)
            .saturating_add(w.reads(1))
            .saturating_add(Weight::from_parts(3_000, 0).saturating_mul(processed.into()))
    }
    fn submit_appeal() -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(20_000, 0).saturating_add(w.reads_writes(2, 2))
    }
    fn withdraw_appeal() -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(20_000, 0).saturating_add(w.reads_writes(2, 2))
    }
    fn approve_appeal() -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(20_000, 0).saturating_add(w.reads_writes(2, 2))
    }
    fn reject_appeal() -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(20_000, 0).saturating_add(w.reads_writes(2, 2))
    }
    fn purge_appeals(limit: u32) -> Weight {
        let w = RocksDbWeight::get();
        Weight::from_parts(10_000, 0)
            .saturating_add(w.reads(1))
            .saturating_add(Weight::from_parts(2_000, 0).saturating_mul(limit.into()))
    }
}
