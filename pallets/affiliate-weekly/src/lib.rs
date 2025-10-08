#![cfg_attr(not(feature = "std"), no_std)]
//! # 联盟计酬周结算分配层 (pallet-memo-affiliate-weekly)
//!
//! ## 功能概述
//!
//! 本模块是联盟计酬系统的**分配层**，负责周期结算和奖励分配逻辑。
//! 职责单一：只负责分配算法、活跃度管理、预算控制，不涉及资金托管。
//!
//! ## 核心特性
//!
//! 1. **周期结算**
//!    - 按周统计推荐奖励
//!    - 分页结算，避免单块过重
//!    - 从托管层读取资金进行分配
//!
//! 2. **15层推荐分配**
//!    - 非压缩不等比：L1=20%、L2=10%、L3..L15=各4%
//!    - 资格验证：活跃期、直推有效数、持仓门槛
//!    - 预算控制：每周奖励上限
//!
//! 3. **活跃度管理**
//!    - 供奉延长活跃期
//!    - 活跃期内计入直推有效数
//!    - 到期自动回退直推计数
//!
//! 4. **工具层设计**
//!    - 类似 `pallet-affiliate-instant` 的架构
//!    - 从托管层读取资金账户
//!    - 无状态工具模式（存储仅用于记账）

//! 说明：临时全局允许 `deprecated`（常量权重/RuntimeEvent），后续将迁移至 WeightInfo 并移除
#![allow(deprecated)]

pub use pallet::*;
extern crate alloc;

/// 函数级中文注释：对外暴露的"消费上报"Trait，供供奉/消费来源调用。
pub trait ConsumptionReporter<AccountId, Balance, BlockNumber> {
    /// 上报一次消费（供奉）
    /// - who: 发生消费的账户
    /// - amount: 本次金额（单位：Balance）
    /// - meta: 业务域元组（可选）
    /// - now: 当前区块高度（用于换算周）
    /// - duration_weeks: 若有时长，标记活跃期
    fn report(
        who: &AccountId,
        amount: Balance,
        meta: Option<(u8, u64)>,
        now: BlockNumber,
        duration_weeks: Option<u32>,
    );
}

#[frame_support::pallet]
pub mod pallet {
    use core::convert::TryInto;
    use frame_support::{
        pallet_prelude::*,
        traits::{ConstU32, Currency, ExistenceRequirement::KeepAlive, Get, StorageVersion},
    };
    use frame_system::pallet_prelude::*;
    use pallet_memo_referrals::ReferralProvider;
    use sp_runtime::traits::Saturating;

    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
    pub type BlockNumberFor<T> = frame_system::pallet_prelude::BlockNumberFor<T>;

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

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
        /// 函数级中文注释：托管账户（从托管层读取，类似 affiliate-instant 的设计）
        type EscrowAccount: Get<Self::AccountId>;
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
    }

    #[pallet::pallet]
    #[pallet::storage_version(STORAGE_VERSION)]
    pub struct Pallet<T>(_);

    // ====== 可治理参数（以存储为准；常量/默认由 runtime 注入） ======
    #[pallet::type_value]
    pub fn DefaultBudgetCapPerCycle<T: Config>() -> BalanceOf<T> {
        0u32.into()
    }
    #[pallet::type_value]
    pub fn DefaultMinStakeForReward<T: Config>() -> BalanceOf<T> {
        0u32.into()
    }
    #[pallet::type_value]
    pub fn DefaultMinQualActions<T: Config>() -> u32 {
        0u32
    }

    /// 每周期（周）奖励上限（仅对发放给上级的份额生效）。0 表示不限制。
    #[pallet::storage]
    pub type BudgetCapPerCycle<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultBudgetCapPerCycle<T>>;
    /// 周期内已累计用于发放上级奖励的金额（记账），用于上限控制。
    #[pallet::storage]
    pub type CycleRewardUsed<T: Config> =
        StorageMap<_, Blake2_128Concat, u32, BalanceOf<T>, ValueQuery>;
    /// 最小参与门槛：上级需持有至少该余额方可获得奖励（0 表示不限制）。
    #[pallet::storage]
    pub type MinStakeForReward<T: Config> =
        StorageValue<_, BalanceOf<T>, ValueQuery, DefaultMinStakeForReward<T>>;
    /// 最小有效行为次数（占位，默认 0）。
    #[pallet::storage]
    pub type MinQualifyingAction<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultMinQualActions<T>>;

    /// 函数级中文注释：账户活跃截至周（含）。
    #[pallet::storage]
    pub type ActiveUntilWeek<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// 函数级中文注释：账户当前"直推有效"人数（随到期/续期动态变化）。
    #[pallet::storage]
    pub type DirectActiveCount<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// 函数级中文注释：在某一周到期的账户清单（供 OnInitialize 扫描回退直推计数）。
    #[pallet::storage]
    pub type ExpiringAt<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        BoundedVec<T::AccountId, ConstU32<100_000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：本周应得佣金累计（记账，待结算）。
    #[pallet::storage]
    pub type Entitlement<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        u32,
        Blake2_128Concat,
        T::AccountId,
        BalanceOf<T>,
        ValueQuery,
    >;

    /// 函数级中文注释：本周有应得的账户索引（用于分页结算）。
    #[pallet::storage]
    pub type EntitledAccounts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        BoundedVec<T::AccountId, ConstU32<200_000>>,
        ValueQuery,
    >;

    /// 函数级中文注释：结算进度光标（分页结算）。
    #[pallet::storage]
    pub type SettleCursor<T: Config> = StorageMap<_, Blake2_128Concat, u32, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 消费已记账。
        EscrowRecorded {
            cycle: u32,
            who: T::AccountId,
            base: BalanceOf<T>,
        },
        /// 已为账户累计应得金额（记账阶段）。
        Entitled {
            cycle: u32,
            to: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 已从托管账户转账给账户（结算阶段）。
        RewardClaimed {
            cycle: u32,
            to: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 本周结算完成（清理光标、索引）。
        SettleCompleted { cycle: u32 },
        /// 新账户变为活跃（直推的sponsor也 +1）。
        BecameActive {
            who: T::AccountId,
            until_week: u32,
        },
        /// 账户活跃期延长。
        ActiveRenewed {
            who: T::AccountId,
            until_week: u32,
        },
        /// 奖励参数已更新
        RewardParamsUpdated,
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 该周无账户待结算
        NothingToSettle,
        /// 其他可扩展错误
        OtherError,
    }

    /// 函数级中文注释：Hooks（周期到期清理）
    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let cur_week = Self::week_of(n);
            let expired = ExpiringAt::<T>::take(cur_week);
            for who in expired.iter() {
                if let Some(sp) = <Self as ReferralView<T>>::sponsor_of(who) {
                    DirectActiveCount::<T>::mutate(&sp, |c| {
                        if *c > 0 {
                            *c -= 1
                        }
                    });
                }
            }
            Weight::from_parts(10_000_000 + (expired.len() as u64 * 1_000_000), 0)
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000_000, 0))]
        /// 函数级中文注释：分页结算指定周的推荐奖励（从托管账户转账）
        pub fn settle(origin: OriginFor<T>, cycle: u32, max_pay: u32) -> DispatchResult {
            let _ = ensure_signed(origin)?; // 允许任何人触发结算
            let list = EntitledAccounts::<T>::get(cycle).into_inner();
            ensure!(!list.is_empty(), Error::<T>::NothingToSettle);

            let mut cursor = SettleCursor::<T>::get(cycle);
            // 函数级中文注释：从托管层读取托管账户（类似 affiliate-instant 的设计）
            let escrow_account = T::EscrowAccount::get();
            let mut paid: u32 = 0;

            // 分页支付账户奖励
            while (cursor as usize) < list.len() && paid < max_pay {
                let who = &list[cursor as usize];
                let amt = Entitlement::<T>::take(cycle, who);
                if !amt.is_zero() {
                    // 从托管账户转账给推荐人
                    let _ = T::Currency::transfer(&escrow_account, who, amt, KeepAlive);
                    Self::deposit_event(Event::RewardClaimed {
                        cycle,
                        to: who.clone(),
                        amount: amt,
                    });
                }
                cursor += 1;
                paid += 1;
            }

            // 更新游标或清理
            if (cursor as usize) >= list.len() {
                SettleCursor::<T>::remove(cycle);
                EntitledAccounts::<T>::remove(cycle);
                Self::deposit_event(Event::SettleCompleted { cycle });
            } else {
                SettleCursor::<T>::insert(cycle, cursor);
            }

            Ok(())
        }

        /// 函数级中文注释：治理更新奖励参数（预算上限/门槛）。
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(10_000_000, 0))]
        pub fn set_reward_params(
            origin: OriginFor<T>,
            budget_cap_per_cycle: Option<BalanceOf<T>>,
            min_stake_for_reward: Option<BalanceOf<T>>,
            min_qual_actions: Option<u32>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            if let Some(cap) = budget_cap_per_cycle {
                BudgetCapPerCycle::<T>::put(cap);
            }
            if let Some(min_stake) = min_stake_for_reward {
                MinStakeForReward::<T>::put(min_stake);
            }
            if let Some(min_qual) = min_qual_actions {
                MinQualifyingAction::<T>::put(min_qual);
            }
            Self::deposit_event(Event::RewardParamsUpdated);
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：计算区块对应的周编号。
        pub fn week_of(block_number: BlockNumberFor<T>) -> u32 {
            let blocks_per_week = T::BlocksPerWeek::get();
            if blocks_per_week == 0 {
                return 0;
            }
            let n64: u64 = TryInto::<u64>::try_into(block_number).unwrap_or(0);
            (n64 / (blocks_per_week as u64)) as u32
        }

        /// 函数级中文注释：标记账户活跃（首次/续期）。
        pub fn mark_active(
            who: &T::AccountId,
            now: BlockNumberFor<T>,
            duration_weeks: Option<u32>,
        ) {
            let cur_week = Self::week_of(now);
            let weeks = duration_weeks.unwrap_or(1);
            let new_until = cur_week.saturating_add(weeks);

            let old_until = ActiveUntilWeek::<T>::get(who);
            if old_until < cur_week {
                // 从非活跃 → 活跃
                if let Some(sp) = <Self as ReferralView<T>>::sponsor_of(who) {
                    DirectActiveCount::<T>::mutate(&sp, |c| *c += 1);
                }
                let mut expiring = ExpiringAt::<T>::get(new_until);
                let _ = expiring.try_push(who.clone());
                ExpiringAt::<T>::insert(new_until, expiring);
                ActiveUntilWeek::<T>::insert(who, new_until);

                Self::deposit_event(Event::BecameActive {
                    who: who.clone(),
                    until_week: new_until,
                });
            } else {
                // 续期
                if new_until > old_until {
                    // 从旧到期清单移除
                    ExpiringAt::<T>::mutate(old_until, |vec| {
                        vec.retain(|x| x != who);
                    });
                    // 加入新到期清单
                    let mut expiring = ExpiringAt::<T>::get(new_until);
                    if !expiring.iter().any(|x| x == who) {
                        let _ = expiring.try_push(who.clone());
                    }
                    ExpiringAt::<T>::insert(new_until, expiring);
                    ActiveUntilWeek::<T>::insert(who, new_until);
                }
                Self::deposit_event(Event::ActiveRenewed {
                    who: who.clone(),
                    until_week: new_until,
                });
            }
        }

        /// 函数级中文注释：记录分配（只记账，不实际转账）。
        pub fn record_distribution(
            who: &T::AccountId,
            amount: BalanceOf<T>,
            now: BlockNumberFor<T>,
        ) {
            let cur_week = Self::week_of(now);
            let max_levels = T::MaxLevels::get();
            let per_need = T::PerLevelNeed::get();
            let rates = T::LevelRatesBps::get();

            let base: BalanceOf<T> = amount;
            let mut up_opt = <Self as ReferralView<T>>::sponsor_of(who);
            for layer in 1..=max_levels {
                let rate_bps: u32 = rates.get((layer - 1) as usize).copied().unwrap_or(0) as u32;
                if rate_bps == 0 {
                    up_opt = up_opt.and_then(|u| <Self as ReferralView<T>>::sponsor_of(&u));
                    continue;
                }
                let share: BalanceOf<T> = base / 10_000u32.into() * (rate_bps as u32).into();
                match up_opt {
                    Some(ref up) => {
                        let active = ActiveUntilWeek::<T>::get(up) >= cur_week;
                        let can_take = (DirectActiveCount::<T>::get(up) / per_need) >= layer;
                        let banned = <T as Config>::Referrals::is_banned(up);
                        let stake_ok = {
                            let min_stake = MinStakeForReward::<T>::get();
                            if min_stake == 0u32.into() {
                                true
                            } else {
                                T::Currency::free_balance(up) >= min_stake
                            }
                        };
                        if active && can_take && stake_ok && !banned {
                            // 预算上限控制
                            let cap = BudgetCapPerCycle::<T>::get();
                            if cap.is_zero() {
                                Entitlement::<T>::mutate(cur_week, up, |v| *v += share);
                                let mut idx = EntitledAccounts::<T>::get(cur_week);
                                if !idx.iter().any(|x| x == up) {
                                    let _ = idx.try_push(up.clone());
                                    EntitledAccounts::<T>::insert(cur_week, idx);
                                }
                                Self::deposit_event(Event::Entitled {
                                    cycle: cur_week,
                                    to: up.clone(),
                                    amount: share,
                                });
                            } else {
                                let used = CycleRewardUsed::<T>::get(cur_week);
                                let allowed = cap.saturating_sub(used);
                                if !allowed.is_zero() {
                                    let alloc = if share > allowed { allowed } else { share };
                                    if !alloc.is_zero() {
                                        Entitlement::<T>::mutate(cur_week, up, |v| *v += alloc);
                                        let mut idx = EntitledAccounts::<T>::get(cur_week);
                                        if !idx.iter().any(|x| x == up) {
                                            let _ = idx.try_push(up.clone());
                                            EntitledAccounts::<T>::insert(cur_week, idx);
                                        }
                                        CycleRewardUsed::<T>::insert(
                                            cur_week,
                                            used.saturating_add(alloc),
                                        );
                                        Self::deposit_event(Event::Entitled {
                                            cycle: cur_week,
                                            to: up.clone(),
                                            amount: alloc,
                                        });
                                    }
                                }
                            }
                        }
                        up_opt = <Self as ReferralView<T>>::sponsor_of(up);
                    }
                    None => {}
                }
            }

            Self::deposit_event(Event::EscrowRecorded {
                cycle: cur_week,
                who: who.clone(),
                base,
            });
        }

        /// 函数级中文注释：包装静态 trait 方法。
        pub fn report(
            who: &T::AccountId,
            amount: BalanceOf<T>,
            meta: Option<(u8, u64)>,
            now: BlockNumberFor<T>,
            duration_weeks: Option<u32>,
        ) {
            <Self as crate::ConsumptionReporter<_, _, _>>::report(
                who,
                amount,
                meta,
                now,
                duration_weeks,
            )
        }
    }

    /// 函数级中文注释：只读推荐关系视图（复用 referrals Pallet）。
    pub trait ReferralView<T: Config> {
        fn sponsor_of(who: &T::AccountId) -> Option<T::AccountId>;
    }
    impl<T: Config> ReferralView<T> for Pallet<T> {
        fn sponsor_of(who: &T::AccountId) -> Option<T::AccountId> {
            <T as Config>::Referrals::sponsor_of(who)
        }
    }
}

impl<T: pallet::Config>
    ConsumptionReporter<
        <T as frame_system::Config>::AccountId,
        pallet::BalanceOf<T>,
        pallet::BlockNumberFor<T>,
    > for pallet::Pallet<T>
{
    /// 函数级中文注释：供奉来源调用：标记活跃 + 记账式分配。
    fn report(
        who: &T::AccountId,
        amount: BalanceOf<T>,
        _meta: Option<(u8, u64)>,
        now: BlockNumberFor<T>,
        duration_weeks: Option<u32>,
    ) {
        Pallet::<T>::mark_active(who, now, duration_weeks);
        Pallet::<T>::record_distribution(who, amount, now);
    }
}

// 函数级中文注释：实现 WeeklyAffiliateProvider trait，供 pallet-affiliate-config 调用
impl<T: pallet::Config> pallet_affiliate_config::WeeklyAffiliateProvider<
    T::AccountId, 
    BalanceOf<T>, 
    BlockNumberFor<T>
> for pallet::Pallet<T> 
{
    /// 函数级中文注释：实现周结算接口（记账，资金已在托管账户）
    fn escrow_and_record(
        who: &T::AccountId,
        amount: BalanceOf<T>,
        target: Option<(u8, u64)>,
        block_number: BlockNumberFor<T>,
        duration_weeks: Option<u32>,
    ) -> frame_support::dispatch::DispatchResult {
        // 函数级中文注释：调用现有的 report 函数
        // 标记活跃 + 记账式分配（资金已在托管账户，等待周期结算）
        Self::report(
            who,
            amount,
            target,
            block_number,
            duration_weeks,
        );
        Ok(())
    }
}

