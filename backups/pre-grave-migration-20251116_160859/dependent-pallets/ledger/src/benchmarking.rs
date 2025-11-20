//! 函数级中文注释：pallet-ledger 基准测试（骨架）。
//! - 注意：需要在 runtime 中启用此 pallet 的 `runtime-benchmarks` 并在 benchmarks.rs 注册。

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use crate::Pallet as Ledger;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;

benchmarks! {
    purge_weeks {
        let caller: T::AccountId = whitelisted_caller();
        let grave_id: T::GraveId = codec::Decode::decode(&mut sp_core::blake2_256(b"g").as_slice()).ok().unwrap_or_else(|| unsafe { core::mem::zeroed() });
        let before_week: u64 = 100;
        let limit: u32 = 50;
    }: _(RawOrigin::Signed(caller.clone()), grave_id, caller.clone(), before_week, limit)

    purge_weeks_by_range {
        let caller: T::AccountId = whitelisted_caller();
        let grave_id: T::GraveId = codec::Decode::decode(&mut sp_core::blake2_256(b"g2").as_slice()).ok().unwrap_or_else(|| unsafe { core::mem::zeroed() });
        let start_week: u64 = 10;
        let end_week: u64 = 200;
        let limit: u32 = 50;
    }: _(RawOrigin::Signed(caller.clone()), grave_id, caller.clone(), start_week, end_week, limit)

    record_from_hook_with_amount {
        let grave_id: T::GraveId = codec::Decode::decode(&mut sp_core::blake2_256(b"g3").as_slice()).ok().unwrap_or_else(|| unsafe { core::mem::zeroed() });
        let who: T::AccountId = whitelisted_caller();
        let amount: Option<T::Balance> = None;
        let memo: Option<alloc::vec::Vec<u8>> = None;
        let tx_key: Option<sp_core::H256> = None;
    }: {
        Ledger::<T>::record_from_hook_with_amount(grave_id, who, 0, amount, memo, tx_key);
    }

    // 🗑️ 破坏式变更（方案A）：已移除 add_to_deceased_total 基准测试
    // 原因：不再支持 Deceased 作为供奉目标

    mark_weekly_active {
        let grave_id: T::GraveId = codec::Decode::decode(&mut sp_core::blake2_256(b"g4").as_slice()).ok().unwrap_or_else(|| unsafe { core::mem::zeroed() });
        let who: T::AccountId = whitelisted_caller();
        let start_block: frame_system::pallet_prelude::BlockNumberFor<T> = frame_system::Pallet::<T>::block_number();
        let duration_weeks: Option<u32> = Some(10);
    }: {
        Ledger::<T>::mark_weekly_active(grave_id, who, start_block, duration_weeks);
    }
}

#[cfg(feature = "runtime-benchmarks")]
mod tests {
    // 基准的轻量自检可选。
}
