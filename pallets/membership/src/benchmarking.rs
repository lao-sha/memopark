/// Benchmark 测试（占位实现）
#![cfg(feature = "runtime-benchmarks")]

use super::*;

#[allow(unused)]
use crate::Pallet as Membership;
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;

#[benchmarks]
mod benchmarks {
	use super::*;

	#[benchmark]
	fn purchase_membership() {
		let caller: T::AccountId = whitelisted_caller();

		#[extrinsic_call]
		purchase_membership(
			RawOrigin::Signed(caller),
			MembershipLevel::Year1,
			None
		);
	}

	#[benchmark]
	fn upgrade_to_year10() {
		let caller: T::AccountId = whitelisted_caller();

		#[extrinsic_call]
		upgrade_to_year10(RawOrigin::Signed(caller));
	}

	#[benchmark]
	fn set_member_discount() {
		#[extrinsic_call]
		set_member_discount(RawOrigin::Root, 30);
	}

	impl_benchmark_test_suite!(Membership, crate::mock::new_test_ext(), crate::mock::Test);
}
