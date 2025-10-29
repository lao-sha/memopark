//! 函数级中文注释：基准骨架；后续在 runtime 注册后可生成自动权重。

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use crate::Pallet as MCG;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;

benchmarks! {
    submit_appeal {
        let who: T::AccountId = whitelisted_caller();
    }: {
        let _ = MCG::<T>::submit_appeal(RawOrigin::Signed(who).into(), 2, 1, 10, BoundedVec::try_from(vec![1u8; 8]).unwrap(), BoundedVec::try_from(vec![2u8; 8]).unwrap());
    }

    withdraw_appeal {
        let who: T::AccountId = whitelisted_caller();
        let _ = MCG::<T>::submit_appeal(RawOrigin::Signed(who.clone()).into(), 2, 1, 10, BoundedVec::try_from(vec![1u8; 8]).unwrap(), BoundedVec::try_from(vec![2u8; 8]).unwrap());
    }: {
        let _ = MCG::<T>::withdraw_appeal(RawOrigin::Signed(who).into(), 0);
    }

    approve_appeal {
        let who: T::AccountId = whitelisted_caller();
        let _ = MCG::<T>::submit_appeal(RawOrigin::Signed(who).into(), 2, 1, 10, BoundedVec::try_from(vec![1u8; 8]).unwrap(), BoundedVec::try_from(vec![2u8; 8]).unwrap());
    }: {
        let _ = MCG::<T>::approve_appeal(frame_system::RawOrigin::Root.into(), 0, None);
    }

    reject_appeal {
        let who: T::AccountId = whitelisted_caller();
        let _ = MCG::<T>::submit_appeal(RawOrigin::Signed(who).into(), 2, 1, 10, BoundedVec::try_from(vec![1u8; 8]).unwrap(), BoundedVec::try_from(vec![2u8; 8]).unwrap());
    }: {
        let _ = MCG::<T>::reject_appeal(frame_system::RawOrigin::Root.into(), 0);
    }

    purge_appeals {
        let _n in 0 .. 10u32;
    }: {
        let _ = MCG::<T>::purge_appeals(frame_system::RawOrigin::Root.into(), 0, 100, 10);
    }
}
