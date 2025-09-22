//! Forwarder 基准（v2）。

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use frame_benchmarking::v2::*;
use frame_system::RawOrigin;

#[benchmarks]
mod benches {
    use super::*;

    #[benchmark]
    fn open_session() {
        let sponsor: T::AccountId = whitelisted_caller();
        let owner: T::AccountId = whitelisted_caller();
        let permit = SessionPermit { ns: *b"fw______", owner: owner.clone(), session_id: [1u8;16], session_pubkey: sp_core::sr25519::Public::from_raw([2u8;32]), expires_at: frame_system::Pallet::<T>::block_number() };
        let bytes = permit.encode();
        let bounded: BoundedVec<u8, T::MaxPermitLen> = BoundedVec::try_from(bytes).unwrap();
        #[extrinsic_call]
        _(RawOrigin::Signed(sponsor), bounded);
    }

    #[benchmark]
    fn close_session() {
        let sponsor: T::AccountId = whitelisted_caller();
        let owner: T::AccountId = whitelisted_caller();
        let permit = SessionPermit { ns: *b"fw______", owner: owner.clone(), session_id: [1u8;16], session_pubkey: sp_core::sr25519::Public::from_raw([2u8;32]), expires_at: frame_system::Pallet::<T>::block_number() };
        let bytes = permit.encode();
        let bounded: BoundedVec<u8, T::MaxPermitLen> = BoundedVec::try_from(bytes).unwrap();
        Pallet::<T>::open_session(RawOrigin::Signed(sponsor).into(), bounded).unwrap();
        #[extrinsic_call]
        _(RawOrigin::Signed(owner), *b"fw______", [1u8;16]);
    }

    #[benchmark]
    fn forward() {
        let sponsor: T::AccountId = whitelisted_caller();
        let owner: T::AccountId = whitelisted_caller();
        let permit = SessionPermit { ns: *b"fw______", owner: owner.clone(), session_id: [1u8;16], session_pubkey: sp_core::sr25519::Public::from_raw([2u8;32]), expires_at: frame_system::Pallet::<T>::block_number() };
        let bytes = permit.encode();
        let bounded: BoundedVec<u8, T::MaxPermitLen> = BoundedVec::try_from(bytes).unwrap();
        Pallet::<T>::open_session(RawOrigin::Signed(sponsor.clone()).into(), bounded).unwrap();
        let meta = MetaTx { ns: *b"fw______", session_id: [1u8;16], call: frame_system::Call::<T>::remark { remark: vec![] }.into(), nonce: 0, valid_till: frame_system::Pallet::<T>::block_number() };
        let meta_bytes = meta.encode();
        let meta_bounded: BoundedVec<u8, T::MaxMetaLen> = BoundedVec::try_from(meta_bytes).unwrap();
        let sig = vec![0u8;64];
        let owner_src = <T::Lookup as StaticLookup>::unlookup(owner.clone());
        #[extrinsic_call]
        _(RawOrigin::Signed(sponsor), meta_bounded, sig, owner_src);
    }

    #[benchmark]
    fn purge_expired() {
        let sponsor: T::AccountId = whitelisted_caller();
        let owner: T::AccountId = whitelisted_caller();
        let permit = SessionPermit { ns: *b"fw______", owner: owner.clone(), session_id: [1u8;16], session_pubkey: sp_core::sr25519::Public::from_raw([2u8;32]), expires_at: frame_system::Pallet::<T>::block_number() - One::one() };
        let bytes = permit.encode();
        let bounded: BoundedVec<u8, T::MaxPermitLen> = BoundedVec::try_from(bytes).unwrap();
        Pallet::<T>::open_session(RawOrigin::Signed(sponsor).into(), bounded).ok();
        #[extrinsic_call]
        _(RawOrigin::Signed(owner), *b"fw______", 10u32);
    }

    impl_benchmark_test_suite!(Pallet, crate::mock::new_test_ext(), crate::mock::Test);
}


