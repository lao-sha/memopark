//! 基准实现（v2 宏）。覆盖 mark/unmark 两个外部调用，便于自动生成权重。

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;

#[benchmarks]
mod benches {
    use super::*;

    #[benchmark]
    fn mark_fee_only() {
        let caller: T::AccountId = whitelisted_caller();
        // 允许策略默认放行；若接入更严格策略，需在 runtime 基准里准备白名单账户
        #[extrinsic_call]
        _(RawOrigin::Root, caller);
    }

    #[benchmark]
    fn unmark_fee_only() {
        let caller: T::AccountId = whitelisted_caller();
        // 先标记
        Pallet::<T>::mark_fee_only(RawOrigin::Root.into(), caller.clone()).unwrap();
        #[extrinsic_call]
        _(RawOrigin::Root, caller);
    }

    impl_benchmark_test_suite!(Pallet, crate::mock::new_test_ext(), crate::mock::Test);
}


