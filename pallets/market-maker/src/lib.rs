#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

/// 🆕 函数级详细中文注释：做市商信息结构（供其他pallet使用）
/// - 简化版，仅包含必要的字段
/// - 避免泛型依赖，使用具体类型
#[derive(Clone, Debug)]
pub struct MarketMakerInfo {
    pub epay_gateway: Vec<u8>,
    pub epay_pid: Vec<u8>,
    pub epay_key: Vec<u8>,
    pub first_purchase_pool: u128,
    pub first_purchase_used: u128,
    pub users_served: u32,
}

/// 🆕 函数级详细中文注释：做市商提供者Trait
/// - 供其他pallet查询做市商信息
/// - 低耦合设计，通过trait接口交互
pub trait MarketMakerProvider<AccountId, Balance> {
    /// 获取做市商信息
    fn get_market_maker_info(mm_id: u64) -> Option<MarketMakerInfo>;
    
    /// 选择可用的做市商（资金充足）
    fn select_available_market_maker() -> Option<u64>;
    
    /// 派生首购资金池账户地址
    fn first_purchase_pool_account(mm_id: u64) -> AccountId;
    
    /// 记录首购服务使用
    fn record_first_purchase_usage(mm_id: u64, buyer: &AccountId, amount: Balance) -> Result<(), &'static str>;
    
    /// 检查买家是否已使用过首购服务
    fn has_used_first_purchase(mm_id: u64, buyer: &AccountId) -> bool;
}

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
        fn update_info() -> Weight;
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
        fn update_info() -> Weight {
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
        /// 函数级中文注释：治理起源（用于批准/驳回做市商申请）
        /// - 推荐配置为 Root 或 委员会 2/3 多数
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        
        /// 🆕 函数级详细中文注释：首购资金池最小金额
        /// - 做市商必须质押至少这么多的首购资金
        /// - 用于防止做市商资金池过小导致首购服务中断
        #[pallet::constant]
        type MinFirstPurchasePool: Get<BalanceOf<Self>>;
        
        /// 🆕 函数级详细中文注释：每次首购转账金额
        /// - 新用户首次购买时，从做市商资金池转账的固定金额
        /// - 推荐设置为 100 MEMO
        #[pallet::constant]
        type FirstPurchaseAmount: Get<BalanceOf<Self>>;
        
        /// 🆕 函数级详细中文注释：Pallet ID
        /// - 用于派生首购资金池账户地址
        /// - 格式：b"mm/pool!" + 做市商账户地址
        #[pallet::constant]
        type PalletId: Get<frame_support::PalletId>;
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
        /// 🆕 epay支付网关地址
        pub epay_gateway: BoundedVec<u8, ConstU32<128>>,
        /// 🆕 epay商户ID (PID)
        pub epay_pid: BoundedVec<u8, ConstU32<64>>,
        /// 🆕 epay商户密钥
        pub epay_key: BoundedVec<u8, ConstU32<64>>,
        /// 🆕 首购资金池总额
        pub first_purchase_pool: Balance,
        /// 🆕 已使用的首购资金
        pub first_purchase_used: Balance,
        /// 🆕 已服务的用户数量
        pub users_served: u32,
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

    /// 🆕 函数级详细中文注释：活跃做市商列表
    /// - 存储已批准的做市商信息
    /// - mm_id -> Application
    /// - 批准后从Applications迁移到这里，保持Applications仅存储申请中的记录
    #[pallet::storage]
    #[pallet::getter(fn active_market_makers)]
    pub type ActiveMarketMakers<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, Application<T::AccountId, BalanceOf<T>>>;

    /// 🆕 函数级详细中文注释：首购使用记录
    /// - 记录每个做市商为哪些买家提供了首购服务
    /// - (mm_id, buyer_account) -> ()
    /// - 用于防止重复领取、统计服务数量
    #[pallet::storage]
    pub type FirstPurchaseRecords<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat, u64,        // mm_id
        Blake2_128Concat, T::AccountId, // buyer
        (),
        OptionQuery,
    >;

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
        InfoUpdated {
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
        /// 🆕 首购资金已转入资金池账户
        FirstPurchasePoolFunded {
            mm_id: u64,
            pool_account: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 首购服务已完成
        FirstPurchaseServed {
            mm_id: u64,
            buyer: T::AccountId,
            amount: BalanceOf<T>,
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
        NotInEditableStatus,
        /// 🆕 epay网关地址无效或为空
        InvalidEpayGateway,
        /// 🆕 epay商户ID无效或为空
        InvalidEpayPid,
        /// 🆕 epay商户密钥无效或为空
        InvalidEpayKey,
        /// 🆕 首购资金池金额不足
        InsufficientFirstPurchasePool,
        /// 🆕 epay配置字段过长
        EpayConfigTooLong,
        /// 🆕 做市商资金池余额不足
        InsufficientPoolBalance,
        /// 🆕 做市商未激活
        MarketMakerNotActive,
        /// 🆕 买家已经使用过首购服务
        AlreadyUsedFirstPurchase,
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
                    // 🆕 初始化epay配置字段
                    epay_gateway: BoundedVec::default(),
                    epay_pid: BoundedVec::default(),
                    epay_key: BoundedVec::default(),
                    // 🆕 初始化首购资金池字段
                    first_purchase_pool: BalanceOf::<T>::zero(),
                    first_purchase_used: BalanceOf::<T>::zero(),
                    users_served: 0,
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

        /// 函数级详细中文注释：提交做市商资料（扩展版）
        /// - 新增：epay配置和首购资金池参数
        /// - epay_gateway: 支付网关地址（如：https://epay.example.com）
        /// - epay_pid: 商户ID
        /// - epay_key: 商户密钥
        /// - first_purchase_pool: 首购资金池总额（必须 >= MinFirstPurchasePool）
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_root_cid: Cid,
            private_root_cid: Cid,
            fee_bps: u16,
            min_amount: BalanceOf<T>,
            // 🆕 新增参数
            epay_gateway: Vec<u8>,
            epay_pid: Vec<u8>,
            epay_key: Vec<u8>,
            first_purchase_pool: BalanceOf<T>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 🆕 验证epay配置
            ensure!(!epay_gateway.is_empty(), Error::<T>::InvalidEpayGateway);
            ensure!(!epay_pid.is_empty(), Error::<T>::InvalidEpayPid);
            ensure!(!epay_key.is_empty(), Error::<T>::InvalidEpayKey);
            
            // 🆕 验证首购资金池
            ensure!(
                first_purchase_pool >= T::MinFirstPurchasePool::get(),
                Error::<T>::InsufficientFirstPurchasePool
            );
            
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
                
                // 🆕 更新epay配置
                app.epay_gateway = epay_gateway.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                app.epay_pid = epay_pid.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                app.epay_key = epay_key.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                
                // 🆕 更新首购资金池
                app.first_purchase_pool = first_purchase_pool;
                app.first_purchase_used = BalanceOf::<T>::zero();
                app.users_served = 0;
                
                Ok(())
            })?;

            Self::deposit_event(Event::Submitted { mm_id });
            Ok(())
        }

        /// 函数级详细中文注释：更新申请资料（审核前可修改）
        /// - 允许在 DepositLocked 或 PendingReview 状态下修改资料
        /// - 必须在资料提交截止时间前（DepositLocked）或审核截止时间前（PendingReview）
        /// - 只能由申请的 owner 调用
        /// - 质押金额不可修改
        /// - 参数为 Option 类型，None 表示不修改该字段
        /// - 🆕 新增：支持修改epay配置和首购资金池
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::update_info())]
        pub fn update_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_root_cid: Option<Cid>,
            private_root_cid: Option<Cid>,
            fee_bps: Option<u16>,
            min_amount: Option<BalanceOf<T>>,
            // 🆕 新增参数
            epay_gateway: Option<Vec<u8>>,
            epay_pid: Option<Vec<u8>>,
            epay_key: Option<Vec<u8>>,
            first_purchase_pool: Option<BalanceOf<T>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                
                // 只允许在 DepositLocked 或 PendingReview 状态下修改
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked | ApplicationStatus::PendingReview),
                    Error::<T>::NotInEditableStatus
                );
                
                // 检查截止时间
                let now = frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
                match app.status {
                    ApplicationStatus::DepositLocked => {
                        // DepositLocked 状态：检查资料提交截止时间
                        ensure!(now <= app.info_deadline, Error::<T>::DeadlinePassed);
                    }
                    ApplicationStatus::PendingReview => {
                        // PendingReview 状态：检查审核截止时间
                        ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
                    }
                    _ => {}
                }
                
                // 更新字段（如果提供）
                if let Some(cid) = public_root_cid {
                    app.public_cid = cid;
                }
                if let Some(cid) = private_root_cid {
                    app.private_cid = cid;
                }
                if let Some(fee) = fee_bps {
                    ensure!(fee <= 10_000, Error::<T>::InvalidFee);
                    app.fee_bps = fee;
                }
                if let Some(amount) = min_amount {
                    ensure!(amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);
                    app.min_amount = amount;
                }
                
                // 🆕 更新epay配置（如果提供）
                if let Some(gateway) = epay_gateway {
                    ensure!(!gateway.is_empty(), Error::<T>::InvalidEpayGateway);
                    app.epay_gateway = gateway.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                if let Some(pid) = epay_pid {
                    ensure!(!pid.is_empty(), Error::<T>::InvalidEpayPid);
                    app.epay_pid = pid.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                if let Some(key) = epay_key {
                    ensure!(!key.is_empty(), Error::<T>::InvalidEpayKey);
                    app.epay_key = key.try_into().map_err(|_| Error::<T>::EpayConfigTooLong)?;
                }
                
                // 🆕 更新首购资金池（如果提供）
                if let Some(pool) = first_purchase_pool {
                    ensure!(
                        pool >= T::MinFirstPurchasePool::get(),
                        Error::<T>::InsufficientFirstPurchasePool
                    );
                    app.first_purchase_pool = pool;
                }
                
                // 如果之前是 DepositLocked 状态且现在提供了所有必需字段，更新为 PendingReview
                if matches!(app.status, ApplicationStatus::DepositLocked) {
                    // 检查是否所有必需字段都已填写（非空）
                    let has_public_cid = !app.public_cid.is_empty();
                    let has_private_cid = !app.private_cid.is_empty();
                    let has_fee = app.fee_bps > 0 || fee_bps.is_some();
                    let has_min_amount = app.min_amount > BalanceOf::<T>::zero() || min_amount.is_some();
                    // 🆕 检查epay配置和首购资金池
                    let has_epay_config = !app.epay_gateway.is_empty() && !app.epay_pid.is_empty() && !app.epay_key.is_empty();
                    let has_pool = app.first_purchase_pool >= T::MinFirstPurchasePool::get();
                    
                    if has_public_cid && has_private_cid && has_fee && has_min_amount && has_epay_config && has_pool {
                        app.status = ApplicationStatus::PendingReview;
                    }
                }
                
                Ok(())
            })?;

            Self::deposit_event(Event::InfoUpdated { mm_id });
            Ok(())
        }

        /// 撤销（仅 DepositLocked 阶段）
        #[pallet::call_index(3)]
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

        /// 函数级详细中文注释：批准做市商申请
        /// - 权限：Root 或 委员会 2/3 多数通过
        /// - 通过委员会提案流程：propose → vote → close 自动调用本函数
        /// - 🆕 新增：验证epay配置和首购资金池，并转移资金到资金池账户
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::approve())]
        pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            
            let app = Applications::<T>::get(mm_id).ok_or(Error::<T>::NotFound)?;
            ensure!(
                matches!(app.status, ApplicationStatus::PendingReview),
                Error::<T>::NotPendingReview
            );
            let now = frame_system::Pallet::<T>::block_number().saturated_into::<u32>();
            ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
            
            // 🆕 验证epay配置完整性
            ensure!(!app.epay_gateway.is_empty(), Error::<T>::InvalidEpayGateway);
            ensure!(!app.epay_pid.is_empty(), Error::<T>::InvalidEpayPid);
            ensure!(!app.epay_key.is_empty(), Error::<T>::InvalidEpayKey);
            
            // 🆕 验证首购资金池
            ensure!(
                app.first_purchase_pool >= T::MinFirstPurchasePool::get(),
                Error::<T>::InsufficientFirstPurchasePool
            );
            
            // 🆕 派生资金池账户并转移首购资金
            let pool_account = Self::first_purchase_pool_account(mm_id);
            T::Currency::transfer(
                &app.owner,
                &pool_account,
                app.first_purchase_pool,
                frame_support::traits::ExistenceRequirement::KeepAlive,
            )?;
            
            // 更新状态为Active并迁移到ActiveMarketMakers
            let mut approved_app = app.clone();
            approved_app.status = ApplicationStatus::Active;
            ActiveMarketMakers::<T>::insert(mm_id, approved_app);
            
            // 从Applications中移除
            Applications::<T>::remove(mm_id);
            
            Self::deposit_event(Event::Approved { mm_id });
            Self::deposit_event(Event::FirstPurchasePoolFunded {
                mm_id,
                pool_account,
                amount: app.first_purchase_pool,
            });
            Ok(())
        }

        /// 函数级中文注释：驳回做市商申请
        /// - 权限：Root 或 委员会 2/3 多数通过
        /// - 通过委员会提案流程：propose → vote → close 自动调用本函数
        /// - 扣罚比例由提案中指定，余额退还申请人
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::reject())]
        pub fn reject(origin: OriginFor<T>, mm_id: u64, slash_bps: u16) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
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
        #[pallet::call_index(6)]
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
    
    /// 🆕 函数级详细中文注释：辅助函数实现
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：派生首购资金池账户地址
        /// - 使用 PalletId + mm_id 派生子账户
        /// - 格式：PalletId("mm/pool!") + mm_id
        /// - 每个做市商有独立的资金池账户
        pub fn first_purchase_pool_account(mm_id: u64) -> T::AccountId {
            use frame_support::traits::AccountIdConversion;
            T::PalletId::get().into_sub_account_truncating(mm_id)
        }
        
        /// 函数级详细中文注释：记录首购服务使用
        /// - 更新做市商的已使用资金和服务用户数
        /// - 记录买家已使用首购服务，防止重复领取
        pub fn record_first_purchase_usage(
            mm_id: u64,
            buyer: &T::AccountId,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            // 检查做市商是否激活
            ensure!(
                ActiveMarketMakers::<T>::contains_key(mm_id),
                Error::<T>::MarketMakerNotActive
            );
            
            // 检查买家是否已使用过首购服务
            ensure!(
                !FirstPurchaseRecords::<T>::contains_key(mm_id, buyer),
                Error::<T>::AlreadyUsedFirstPurchase
            );
            
            // 更新做市商使用统计
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                
                app.first_purchase_used = app.first_purchase_used.saturating_add(amount);
                app.users_served = app.users_served.saturating_add(1);
                
                Ok(())
            })?;
            
            // 记录买家已使用
            FirstPurchaseRecords::<T>::insert(mm_id, buyer, ());
            
            // 发出事件
            Self::deposit_event(Event::FirstPurchaseServed {
                mm_id,
                buyer: buyer.clone(),
                amount,
            });
            
            Ok(())
        }
        
        /// 函数级详细中文注释：检查买家是否已使用过首购服务
        pub fn has_used_first_purchase(mm_id: u64, buyer: &T::AccountId) -> bool {
            FirstPurchaseRecords::<T>::contains_key(mm_id, buyer)
        }
    }
    
    /// 🆕 函数级详细中文注释：实现MarketMakerProvider Trait
    /// - 供其他pallet（如pallet-otc-order）使用
    /// - 低耦合设计
    impl<T: Config> crate::MarketMakerProvider<T::AccountId, BalanceOf<T>> for Pallet<T> {
        fn get_market_maker_info(mm_id: u64) -> Option<crate::MarketMakerInfo> {
            ActiveMarketMakers::<T>::get(mm_id).map(|app| {
                use sp_runtime::traits::SaturatedConversion;
                crate::MarketMakerInfo {
                    epay_gateway: app.epay_gateway.to_vec(),
                    epay_pid: app.epay_pid.to_vec(),
                    epay_key: app.epay_key.to_vec(),
                    first_purchase_pool: app.first_purchase_pool.saturated_into::<u128>(),
                    first_purchase_used: app.first_purchase_used.saturated_into::<u128>(),
                    users_served: app.users_served,
                }
            })
        }
        
        fn select_available_market_maker() -> Option<u64> {
            use sp_arithmetic::traits::Zero;
            
            // 遍历活跃做市商，选择资金充足且余额最高的
            ActiveMarketMakers::<T>::iter()
                .filter(|(_, app)| {
                    // 状态必须是Active
                    app.status == ApplicationStatus::Active &&
                    // 剩余资金必须足够一次首购
                    app.first_purchase_pool.saturating_sub(app.first_purchase_used) >= T::FirstPurchaseAmount::get()
                })
                .max_by_key(|(_, app)| {
                    // 按剩余资金排序，选择最多的
                    app.first_purchase_pool.saturating_sub(app.first_purchase_used)
                })
                .map(|(mm_id, _)| mm_id)
        }
        
        fn first_purchase_pool_account(mm_id: u64) -> T::AccountId {
            Self::first_purchase_pool_account(mm_id)
        }
        
        fn record_first_purchase_usage(
            mm_id: u64,
            buyer: &T::AccountId,
            amount: BalanceOf<T>,
        ) -> Result<(), &'static str> {
            Self::record_first_purchase_usage(mm_id, buyer, amount)
                .map_err(|_| "Failed to record first purchase usage")
        }
        
        fn has_used_first_purchase(mm_id: u64, buyer: &T::AccountId) -> bool {
            Self::has_used_first_purchase(mm_id, buyer)
        }
    }
}
