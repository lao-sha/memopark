#![cfg_attr(not(feature = "std"), no_std)]

#[frame_support::pallet]
pub mod pallet {
    use frame_support::traits::{tokens::Imbalance, ConstU32};
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency},
        weights::Weight,
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_arithmetic::traits::{Saturating, Zero};
    use sp_runtime::{traits::SaturatedConversion, Perbill};

    /// 简化别名
    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
    type Cid = BoundedVec<u8, ConstU32<256>>;

    pub trait WeightInfo {
        fn lock_deposit() -> Weight;
        fn submit_info() -> Weight;
        fn cancel() -> Weight;
        fn approve() -> Weight;
        fn reject() -> Weight;
        fn expire() -> Weight;
    }

    impl WeightInfo for () {
        fn lock_deposit() -> Weight {
            Weight::zero()
        }
        fn submit_info() -> Weight {
            Weight::zero()
        }
        fn cancel() -> Weight {
            Weight::zero()
        }
        fn approve() -> Weight {
            Weight::zero()
        }
        fn reject() -> Weight {
            Weight::zero()
        }
        fn expire() -> Weight {
            Weight::zero()
        }
    }

    /**
     * 函数级详细中文注释：做市商治理+押金 Pallet（最小可用版本）
     * - 实现核心流程：lock_deposit → submit_info → approve/reject → cancel/expire
     * - 仅使用 ReservableCurrency；后续可升级为 holds
     */
    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// MEMO 主币（需支持 reserve）
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 权重信息
        type WeightInfo: WeightInfo;
        /// 最小押金
        #[pallet::constant]
        type MinDeposit: Get<BalanceOf<Self>>;
        /// 提交资料窗口（秒）
        #[pallet::constant]
        type InfoWindow: Get<u32>;
        /// 审核窗口（秒）
        #[pallet::constant]
        type ReviewWindow: Get<u32>;
        /// 驳回最大扣罚比例（千分比）
        #[pallet::constant]
        type RejectSlashBpsMax: Get<u16>;
        /// 最大交易对数量（预留）
        #[pallet::constant]
        type MaxPairs: Get<u32>;
    }

    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum ApplicationStatus {
        DepositLocked,
        PendingReview,
        Active,
        Rejected,
        Cancelled,
        Expired,
    }

    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct Application<AccountId, Balance> {
        pub owner: AccountId,
        pub deposit: Balance,
        pub status: ApplicationStatus,
        pub public_cid: Cid,
        pub private_cid: Cid,
        pub fee_bps: u16,
        pub min_amount: Balance,
        pub created_at: u32,
        pub info_deadline: u32,
        pub review_deadline: u32,
    }

    #[pallet::storage]
    #[pallet::getter(fn applications)]
    pub type Applications<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, Application<T::AccountId, BalanceOf<T>>>;

    #[pallet::storage]
    #[pallet::getter(fn owner_index)]
    pub type OwnerIndex<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u64>;

    #[pallet::storage]
    #[pallet::getter(fn next_id)]
    pub type NextId<T> = StorageValue<_, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(fn deposit_event)]
    pub enum Event<T: Config> {
        Applied {
            mm_id: u64,
            owner: T::AccountId,
            deposit: BalanceOf<T>,
        },
        Submitted {
            mm_id: u64,
        },
        Approved {
            mm_id: u64,
        },
        Rejected {
            mm_id: u64,
            slash: BalanceOf<T>,
        },
        Cancelled {
            mm_id: u64,
        },
        Expired {
            mm_id: u64,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        AlreadyExists,
        NotFound,
        NotDepositLocked,
        NotPendingReview,
        AlreadyFinalized,
        DeadlinePassed,
        InvalidFee,
        BadSlashRatio,
        MinDepositNotMet,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T>
    where
        BalanceOf<T>: From<u128>,
    {
        /// 质押押金并生成 mm_id
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::lock_deposit())]
        pub fn lock_deposit(origin: OriginFor<T>, deposit: BalanceOf<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                deposit >= T::MinDeposit::get(),
                Error::<T>::MinDepositNotMet
            );
            ensure!(
                !OwnerIndex::<T>::contains_key(&who),
                Error::<T>::AlreadyExists
            );

            T::Currency::reserve(&who, deposit)?;

            let mm_id = NextId::<T>::mutate(|id| {
                let cur = *id;
                *id = id.saturating_add(1);
                cur
            });
            let now = frame_system::Pallet::<T>::block_number();
            let ts = now.saturated_into::<u32>();
            let info_deadline = ts.saturating_add(T::InfoWindow::get());
            let review_deadline = info_deadline.saturating_add(T::ReviewWindow::get());

            Applications::<T>::insert(
                mm_id,
                Application {
                    owner: who.clone(),
                    deposit,
                    status: ApplicationStatus::DepositLocked,
                    public_cid: Cid::default(),
                    private_cid: Cid::default(),
                    fee_bps: 0,
                    min_amount: BalanceOf::<T>::zero(),
                    created_at: ts,
                    info_deadline,
                    review_deadline,
                },
            );
            OwnerIndex::<T>::insert(&who, mm_id);

            Self::deposit_event(Event::Applied {
                mm_id,
                owner: who,
                deposit,
            });
            Ok(())
        }

        /// 提交资料
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_root_cid: Cid,
            private_root_cid: Cid,
            fee_bps: u16,
            min_amount: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked),
                    Error::<T>::NotDepositLocked
                );
                let now = frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
                ensure!(now <= app.info_deadline, Error::<T>::DeadlinePassed);
                ensure!(fee_bps <= 10_000, Error::<T>::InvalidFee);
                ensure!(min_amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);

                app.status = ApplicationStatus::PendingReview;
                app.public_cid = public_root_cid;
                app.private_cid = private_root_cid;
                app.fee_bps = fee_bps;
                app.min_amount = min_amount;
                Ok(())
            })?;

            Self::deposit_event(Event::Submitted { mm_id });
            Ok(())
        }

        /// 撤销（仅 DepositLocked 阶段）
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::cancel())]
        pub fn cancel(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked),
                    Error::<T>::AlreadyFinalized
                );

                T::Currency::unreserve(&who, app.deposit);
                *maybe_app = None;
                OwnerIndex::<T>::remove(&who);
                Ok(())
            })?;
            Self::deposit_event(Event::Cancelled { mm_id });
            Ok(())
        }

        /// 批准（委员会）
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::approve())]
        pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            ensure_root(origin)?; // 后续改为 EnsureMember<Collective>
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(app.status, ApplicationStatus::PendingReview),
                    Error::<T>::NotPendingReview
                );
                let now = frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
                ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
                app.status = ApplicationStatus::Active;
                Ok(())
            })?;
            Self::deposit_event(Event::Approved { mm_id });
            Ok(())
        }

        /// 驳回（扣罚/退余）
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::reject())]
        pub fn reject(origin: OriginFor<T>, mm_id: u64, slash_bps: u16) -> DispatchResult {
            ensure_root(origin)?;
            ensure!(
                slash_bps <= T::RejectSlashBpsMax::get(),
                Error::<T>::BadSlashRatio
            );
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(app.status, ApplicationStatus::PendingReview),
                    Error::<T>::NotPendingReview
                );
                let who = app.owner.clone();
                let deposit = app.deposit;
                let mult = Perbill::from_rational(slash_bps as u32, 10_000u32);
                let slash = mult.mul_floor(deposit);
                let slashed_balance: BalanceOf<T> = if !slash.is_zero() {
                    let (imbalance, _) = T::Currency::slash_reserved(&who, slash);
                    imbalance.peek()
                } else {
                    Zero::zero()
                };
                let refund = deposit.saturating_sub(slashed_balance);
                if !refund.is_zero() {
                    T::Currency::unreserve(&who, refund);
                }
                *maybe_app = None;
                OwnerIndex::<T>::remove(&who);
                Self::deposit_event(Event::Rejected {
                    mm_id,
                    slash: slashed_balance,
                });
                Ok(())
            })
        }

        /// 超时清理（info 未提交或 pending 超时）
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::expire())]
        pub fn expire(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                let now = frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
                match app.status {
                    ApplicationStatus::DepositLocked => {
                        if now <= app.info_deadline {
                            return Err(Error::<T>::DeadlinePassed.into());
                        }
                        let who = app.owner.clone();
                        T::Currency::unreserve(&who, app.deposit);
                        *maybe_app = None;
                        OwnerIndex::<T>::remove(&who);
                    }
                    ApplicationStatus::PendingReview => {
                        if now <= app.review_deadline {
                            return Err(Error::<T>::DeadlinePassed.into());
                        }
                        let who = app.owner.clone();
                        T::Currency::unreserve(&who, app.deposit);
                        *maybe_app = None;
                        OwnerIndex::<T>::remove(&who);
                    }
                    _ => return Err(Error::<T>::AlreadyFinalized.into()),
                }
                Ok(())
            })?;
            Self::deposit_event(Event::Expired { mm_id });
            Ok(())
        }
    }
}
