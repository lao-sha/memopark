#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, BoundedVec};
    use frame_system::pallet_prelude::*;
    use alloc::vec::Vec;

    /// 函数级中文注释：目标控制接口。
    /// - exists：目标是否存在；
    /// - ensure_allowed：是否允许对目标发起供奉（如墓地关闭、逝者隐私等）。
    pub trait TargetControl<Origin> {
        fn exists(target: (u8, u64)) -> bool;
        fn ensure_allowed(origin: Origin, target: (u8, u64)) -> DispatchResult;
    }

    /// 函数级中文注释：供奉提交后的回调接口，用于统计或联动积分。
    pub trait OnOfferingCommitted<AccountId> {
        fn on_offering(target: (u8, u64), kind_code: u8, who: &AccountId);
    }

    /// 函数级中文注释：证据提供者接口，占位以便校验 evidence_id 合法性。
    pub trait EvidenceProvider<AccountId> {
        fn get(_id: u64) -> Option<()>;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        #[pallet::constant] type MaxCidLen: Get<u32>;
        #[pallet::constant] type MaxNameLen: Get<u32>;
        #[pallet::constant] type MaxOfferingsPerTarget: Get<u32>;
        // 函数级中文注释：目标控制器，使用 runtime 的 Origin 类型以进行权限校验
        type TargetCtl: TargetControl<Self::RuntimeOrigin>;
        type OnOffering: OnOfferingCommitted<Self::AccountId>;
        type Evidence: EvidenceProvider<Self::AccountId>;
    }

    /// 函数级中文注释：祭祀品规格（目录）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct OfferingSpec<T: Config> {
        pub kind_code: u8,
        pub name: BoundedVec<u8, T::MaxNameLen>,
        pub media_schema_cid: BoundedVec<u8, T::MaxCidLen>,
    }

    /// 函数级中文注释：供奉记录（仅存目标编码与可选 evidence_id）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct OfferingRecord<T: Config> {
        pub who: T::AccountId,
        pub target: (u8, u64),
        pub kind_code: u8,
        pub amount: Option<u128>,
        pub evidence_id: Option<u64>,
        pub time: BlockNumberFor<T>,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type Specs<T: Config> = StorageMap<_, Blake2_128Concat, u8, OfferingSpec<T>, OptionQuery>;

    #[pallet::storage]
    pub type OfferingsByTarget<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), BoundedVec<u64, T::MaxOfferingsPerTarget>, ValueQuery>;

    #[pallet::storage]
    pub type OfferingRecords<T: Config> = StorageMap<_, Blake2_128Concat, u64, OfferingRecord<T>, OptionQuery>;

    #[pallet::storage]
    pub type NextOfferingId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        SpecRegistered { kind_code: u8 },
        SpecUpdated { kind_code: u8 },
        OfferingCommitted { id: u64, target: (u8, u64), kind_code: u8 },
    }

    #[pallet::error]
    pub enum Error<T> {
        BadKind,
        TargetNotFound,
        NotAllowed,
        TooMany,
        NotFound,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：登记一个祭祀品规格（目录项）。
        #[pallet::weight(10_000)]
        pub fn register_spec(origin: OriginFor<T>, kind_code: u8, name: BoundedVec<u8, T::MaxNameLen>, media_schema_cid: BoundedVec<u8, T::MaxCidLen>) -> DispatchResult {
            let _ = ensure_signed(origin)?; // 目录管理可在 runtime 用 EnsureOrigin 加强，这里简化
            let spec = OfferingSpec::<T> { kind_code, name, media_schema_cid };
            Specs::<T>::insert(kind_code, spec);
            Self::deposit_event(Event::SpecRegistered { kind_code });
            Ok(())
        }

        /// 函数级中文注释：更新祭祀品规格。
        #[pallet::weight(10_000)]
        pub fn update_spec(origin: OriginFor<T>, kind_code: u8, name: Option<BoundedVec<u8, T::MaxNameLen>>, media_schema_cid: Option<BoundedVec<u8, T::MaxCidLen>>) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            Specs::<T>::try_mutate(kind_code, |maybe| -> DispatchResult {
                let s = maybe.as_mut().ok_or(Error::<T>::BadKind)?;
                if let Some(n) = name { s.name = n; }
                if let Some(c) = media_schema_cid { s.media_schema_cid = c; }
                Ok(())
            })?;
            Self::deposit_event(Event::SpecUpdated { kind_code });
            Ok(())
        }

        /// 函数级中文注释：提交一次供奉记录。
        /// - 校验目标存在性与调用者是否被允许；
        /// - 可选 `amount` 仅作记录，真实支付建议走 `order+escrow`；
        /// - 可选 `evidence_id` 用于关联媒体。
        #[pallet::weight(10_000)]
        pub fn offer(origin: OriginFor<T>, target: (u8, u64), kind_code: u8, amount: Option<u128>, evidence_id: Option<u64>) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            ensure!(Specs::<T>::contains_key(kind_code), Error::<T>::BadKind);
            ensure!(T::TargetCtl::exists(target), Error::<T>::TargetNotFound);
            T::TargetCtl::ensure_allowed(origin, target).map_err(|_| Error::<T>::NotAllowed)?;
            if let Some(eid) = evidence_id { let _ = <T as Config>::Evidence::get(eid).ok_or(Error::<T>::NotFound)?; }
            let id = NextOfferingId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
            let now = <frame_system::Pallet<T>>::block_number();
            let rec = OfferingRecord::<T> { who: who.clone(), target, kind_code, amount, evidence_id, time: now };
            OfferingRecords::<T>::insert(id, &rec);
            OfferingsByTarget::<T>::try_mutate(target, |v| v.try_push(id).map_err(|_| Error::<T>::TooMany))?;
            T::OnOffering::on_offering(target, kind_code, &who);
            Self::deposit_event(Event::OfferingCommitted { id, target, kind_code });
            Ok(())
        }

        /// 函数级中文注释：批量提交供奉记录（减少链上交互次数）。
        #[pallet::weight(10_000)]
        pub fn batch_offer(origin: OriginFor<T>, calls: Vec<(u8, u64, u8, Option<u128>, Option<u64>)>) -> DispatchResult {
            for (d,id,k,a,e) in calls { Self::offer(origin.clone(), (d,id), k, a, e)?; }
            Ok(())
        }
    }
}


