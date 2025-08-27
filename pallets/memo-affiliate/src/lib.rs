#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

/// 函数级中文注释：对外暴露的“消费上报”Trait，供供奉/消费来源调用。
/// - 托管模式：只记账与托管归集，不即时发放；
/// - 即时模式：直接按规则发放（默认仍建议托管）。
pub trait ConsumptionReporter<AccountId, Balance, BlockNumber> {
    /// 上报一次消费（供奉）
    /// - who: 发生消费的账户
    /// - amount: 本次金额（单位：Balance）
    /// - meta: 业务域元组（可选）
    /// - now: 当前区块高度（用于换算周）
    /// - duration_weeks: 若有时长，标记活跃期
    fn report(who: &AccountId, amount: Balance, meta: Option<(u8, u64)>, now: BlockNumber, duration_weeks: Option<u32>);
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement::KeepAlive, StorageVersion, Get, ConstU32},
    };
    use frame_system::pallet_prelude::*;
    use core::convert::TryInto;
    use frame_support::sp_runtime::traits::{AccountIdConversion};
    use pallet_memo_referrals::ReferralProvider;

    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
    pub type BlockNumberFor<T> = frame_system::pallet_prelude::BlockNumberFor<T>;

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    /// 结算模式
    #[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
    pub enum SettlementMode { Escrow, Immediate }
    impl Default for SettlementMode { fn default() -> Self { SettlementMode::Escrow } }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 货币实现（用于划拨）
        type Currency: Currency<Self::AccountId>;
        /// 推荐关系提供者（只读）
        type Referrals: ReferralProvider<Self::AccountId>;
        /// 每周对应的区块数（用于计算周编号）
        #[pallet::constant]
        type BlocksPerWeek: Get<u32>;
        /// 托管 PalletId（统一托管账户，不分周期）
        type EscrowPalletId: Get<frame_support::PalletId>;
        /// 黑洞账户
        type BurnAccount: Get<Self::AccountId>;
        /// 国库账户
        type TreasuryAccount: Get<Self::AccountId>;
        /// 搜索上限（防御性）
        #[pallet::constant]
        type MaxSearchHops: Get<u32>;
        /// 最大层数（默认 15）
        #[pallet::constant]
        type MaxLevels: Get<u32>;
        /// 每层需要的直推有效数（默认 3）
        #[pallet::constant]
        type PerLevelNeed: Get<u32>;
        /// 分层比例（bps 数组），长度建议为 MaxLevels（例如 [2000,1000,400×13] = 82%）
        type LevelRatesBps: Get<&'static [u16]>;
        /// 销毁比例（bps，默认 1000=10%）
        #[pallet::constant]
        type BurnBps: Get<u16>;
        /// 国库基础比例（bps，默认 1500=15%）
        #[pallet::constant]
        type TreasuryBps: Get<u16>;
    }

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：当前结算模式（默认 Escrow）。
    #[pallet::storage]
    pub type Mode<T: Config> = StorageValue<_, SettlementMode, ValueQuery>;

    /// 函数级中文注释：账户活跃截至周（含）。
    #[pallet::storage]
    pub type ActiveUntilWeek<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// 函数级中文注释：账户当前“直推有效”人数（随到期/续期动态变化）。
    #[pallet::storage]
    pub type DirectActiveCount<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// 函数级中文注释：在某一周到期的账户清单（供 OnInitialize 扫描回退直推计数）。
    #[pallet::storage]
    pub type ExpiringAt<T: Config> = StorageMap<_, Blake2_128Concat, u32, BoundedVec<T::AccountId, ConstU32<100_000>>, ValueQuery>;

    /// 函数级中文注释：本周应得佣金累计（记账，待结算）。
    #[pallet::storage]
    pub type Entitlement<T: Config> = StorageDoubleMap<_, Blake2_128Concat, u32, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

    /// 函数级中文注释：本周有应得的账户索引（用于分页结算）。
    #[pallet::storage]
    pub type EntitledAccounts<T: Config> = StorageMap<_, Blake2_128Concat, u32, BoundedVec<T::AccountId, ConstU32<200_000>>, ValueQuery>;

    /// 函数级中文注释：本周累计销毁金额（记账）。
    #[pallet::storage]
    pub type BurnAccrued<T: Config> = StorageValue<_, (u32, BalanceOf<T>), ValueQuery>;

    /// 函数级中文注释：本周累计国库金额（记账，含未匹配层数）。
    #[pallet::storage]
    pub type TreasuryAccrued<T: Config> = StorageValue<_, (u32, BalanceOf<T>), ValueQuery>;

    /// 函数级中文注释：结算进度光标（分页结算）。
    #[pallet::storage]
    pub type SettleCursor<T: Config> = StorageMap<_, Blake2_128Concat, u32, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 消费已入托管并记账。
        EscrowRecorded { cycle: u32, who: T::AccountId, base: BalanceOf<T> },
        /// 已为账户累计应得金额（记账阶段）。
        Entitled { cycle: u32, to: T::AccountId, amount: BalanceOf<T> },
        /// 完成一批结算。
        Settled { cycle: u32, paid: u32 },
        /// 活跃期已标记。
        ActiveMarked { who: T::AccountId, until_week: u32 },
        /// 结算模式变更。
        ModeChanged { mode_code: u8 },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 参数非法或比例和不为 100%。
        BadParams,
        /// 目标周无应结数据。
        NothingToSettle,
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级中文注释：按周处理到期账户，回退其上级的直推有效计数。
        fn on_initialize(_n: BlockNumberFor<T>) -> Weight {
            // 轻量实现：仅在每个区块检查当前周的 ExpiringAt 列表是否需要处理。
            // 计算当前周编号
            let now = <frame_system::Pallet<T>>::block_number();
            let week = Self::week_of(now);
            let list = ExpiringAt::<T>::get(week);
            if list.is_empty() { return Weight::from_parts(0, 0); }
            for acc in list.into_inner() {
                let until = ActiveUntilWeek::<T>::get(&acc);
                if until < week {
                    if let Some(up) = <Self as ReferralView<T>>::sponsor_of(&acc) {
                        DirectActiveCount::<T>::mutate(up, |c| *c = c.saturating_sub(1));
                    }
                }
            }
            ExpiringAt::<T>::remove(week);
            Weight::from_parts(0, 0)
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：治理设置结算模式（Escrow/Immediate）。
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn set_mode(origin: OriginFor<T>, mode_code: u8) -> DispatchResult {
            ensure_root(origin)?;
            let mode = match mode_code { 0 => SettlementMode::Escrow, 1 => SettlementMode::Immediate, _ => SettlementMode::Escrow };
            Mode::<T>::put(mode);
            Self::deposit_event(Event::ModeChanged { mode_code });
            Ok(())
        }

        /// 函数级中文注释：分页结算指定周的数据。
        /// - cycle: 周编号
        /// - max_pay: 本次最多支付的账户数量（不含 burn/treasury）
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn settle(origin: OriginFor<T>, cycle: u32, max_pay: u32) -> DispatchResult {
            let _ = ensure_signed(origin)?; // 允许任何人触发结算
            let mut list = EntitledAccounts::<T>::get(cycle).into_inner();
            ensure!(!list.is_empty() || BurnAccrued::<T>::get().0 == cycle || TreasuryAccrued::<T>::get().0 == cycle, Error::<T>::NothingToSettle);

            let mut cursor = SettleCursor::<T>::get(cycle);
            let escrow = T::EscrowPalletId::get().into_account_truncating();
            let mut paid: u32 = 0;
            while (cursor as usize) < list.len() && paid < max_pay {
                let who = &list[cursor as usize];
                let amt = Entitlement::<T>::take(cycle, who);
                if !amt.is_zero() {
                    let _ = T::Currency::transfer(&escrow, who, amt, KeepAlive);
                    paid = paid.saturating_add(1);
                }
                cursor = cursor.saturating_add(1);
            }
            SettleCursor::<T>::insert(cycle, cursor);

            // 若账户清单已结完，则支付 burn/treasury 并清理索引
            if (cursor as usize) >= list.len() {
                let (_, burn_amt) = BurnAccrued::<T>::take();
                if !burn_amt.is_zero() {
                    let _ = T::Currency::transfer(&escrow, &T::BurnAccount::get(), burn_amt, KeepAlive);
                }
                let (_, trea_amt) = TreasuryAccrued::<T>::take();
                if !trea_amt.is_zero() {
                    let _ = T::Currency::transfer(&escrow, &T::TreasuryAccount::get(), trea_amt, KeepAlive);
                }
                EntitledAccounts::<T>::remove(cycle);
                SettleCursor::<T>::remove(cycle);
            }

            Self::deposit_event(Event::Settled { cycle, paid });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：计算当前区块所属的周编号。
        pub fn week_of(now: BlockNumberFor<T>) -> u32 {
            // 简单换算：floor(now / BlocksPerWeek)
            let bpw = T::BlocksPerWeek::get();
            let n: u32 = TryInto::<u32>::try_into(now).ok().unwrap_or(0);
            if bpw == 0 { return 0; }
            n / bpw
        }

        /// 函数级中文注释：标记账户活跃期（供 offering Hook 调用）。
        pub fn mark_active(who: &T::AccountId, now: BlockNumberFor<T>, duration_weeks: Option<u32>) {
            let cur_week = Self::week_of(now);
            let extend = duration_weeks.unwrap_or(1).max(1);
            let new_until = cur_week.saturating_add(extend);
            let old_until = ActiveUntilWeek::<T>::get(who);

            // 是否从非活跃变为活跃
            let was_inactive = old_until < cur_week;
            if new_until > old_until {
                ActiveUntilWeek::<T>::insert(who, new_until);
                // 记录到期周的清单（new_until 之后的第一个周起始触发回退）
                let expire_slot = new_until.saturating_add(1);
                let mut v = ExpiringAt::<T>::get(expire_slot);
                let _ = v.try_push(who.clone());
                ExpiringAt::<T>::insert(expire_slot, v);
                // 如从非活跃→活跃，给直属上级直推有效+1
                if was_inactive {
                    if let Some(up) = <Self as ReferralView<T>>::sponsor_of(who) {
                        DirectActiveCount::<T>::mutate(up, |c| *c = c.saturating_add(1));
                    }
                }
                Self::deposit_event(Event::ActiveMarked { who: who.clone(), until_week: new_until });
            }
        }

        /// 函数级中文注释：托管/即时模式统一入口：记录分配（即时模式也先记账，再直接划拨）。
        pub fn record_distribution(who: &T::AccountId, amount: BalanceOf<T>, now: BlockNumberFor<T>) {
            let cur_week = Self::week_of(now);
            let max_levels = T::MaxLevels::get();
            let per_need = T::PerLevelNeed::get();
            let rates = T::LevelRatesBps::get();
            let burn_bps = T::BurnBps::get() as u32;
            let tres_bps = T::TreasuryBps::get() as u32;

            // 基础比例预算
            let base: BalanceOf<T> = amount;
            let mut treasury_extra: BalanceOf<T> = 0u32.into();
            // 非压缩：固定距离逐层分配
            let mut up_opt = <Self as ReferralView<T>>::sponsor_of(who);
            for layer in 1..=max_levels {
                let rate_bps: u32 = rates.get((layer - 1) as usize).copied().unwrap_or(0) as u32;
                if rate_bps == 0 { // 未配置的层视为 0
                    // 继续上溯一层以推进 up_opt，避免卡住
                    up_opt = up_opt.and_then(|u| <Self as ReferralView<T>>::sponsor_of(&u));
                    continue;
                }
                let share: BalanceOf<T> = base / 10_000u32.into() * (rate_bps as u32).into();
                match up_opt {
                    Some(ref up) => {
                        let active = ActiveUntilWeek::<T>::get(up) >= cur_week;
                        let can_take = (DirectActiveCount::<T>::get(up) / per_need) >= layer;
                        if active && can_take {
                            Entitlement::<T>::mutate(cur_week, up, |v| *v += share);
                            let mut idx = EntitledAccounts::<T>::get(cur_week);
                            if !idx.iter().any(|x| x == up) {
                                let _ = idx.try_push(up.clone());
                                EntitledAccounts::<T>::insert(cur_week, idx);
                            }
                            Self::deposit_event(Event::Entitled { cycle: cur_week, to: up.clone(), amount: share });
                        } else {
                            treasury_extra += share;
                        }
                        // 上溯到下一层祖先
                        up_opt = <Self as ReferralView<T>>::sponsor_of(up);
                    }
                    None => {
                        treasury_extra += share;
                    }
                }
            }

            // 其他两部分：burn 与 treasury 基础 + 未匹配层数
            let mut burn = base / 10_000u32.into() * (burn_bps as u32).into();
            let mut trea = base / 10_000u32.into() * (tres_bps as u32).into();
            trea += treasury_extra;
            BurnAccrued::<T>::mutate(|x| { x.0 = cur_week; x.1 += burn; });
            TreasuryAccrued::<T>::mutate(|x| { x.0 = cur_week; x.1 += trea; });

            // 托管：上游应已将金额转入统一托管账户；此处仅记录事件
            Self::deposit_event(Event::EscrowRecorded { cycle: cur_week, who: who.clone(), base });
        }

        /// 函数级中文注释：包装静态 trait 方法，便于 runtime 通过 `Pallet::<Runtime>::report(...)` 直接调用。
        pub fn report(who: &T::AccountId, amount: BalanceOf<T>, meta: Option<(u8, u64)>, now: BlockNumberFor<T>, duration_weeks: Option<u32>) {
            <Self as crate::ConsumptionReporter<_, _, _>>::report(who, amount, meta, now, duration_weeks)
        }
    }

    /// 函数级中文注释：只读推荐关系视图（复用 referrals Pallet）。
    pub trait ReferralView<T: Config> {
        fn sponsor_of(who: &T::AccountId) -> Option<T::AccountId>;
    }
    impl<T: Config> ReferralView<T> for Pallet<T> {
        fn sponsor_of(who: &T::AccountId) -> Option<T::AccountId> { <T as Config>::Referrals::sponsor_of(who) }
    }
}

impl<T: pallet::Config> ConsumptionReporter<T::AccountId, BalanceOf<T>, BlockNumberFor<T>> for Pallet<T> {
    /// 函数级中文注释：供奉来源调用：标记活跃 + 记账式 15 层压缩分配；即时模式下仍优先记账，再由治理触发批量支付。
    fn report(who: &T::AccountId, amount: BalanceOf<T>, _meta: Option<(u8, u64)>, now: BlockNumberFor<T>, duration_weeks: Option<u32>) {
        Pallet::<T>::mark_active(who, now, duration_weeks);
        Pallet::<T>::record_distribution(who, amount, now);
    }
}


