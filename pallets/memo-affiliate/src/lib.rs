#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`（常量权重/RuntimeEvent），后续将迁移至 WeightInfo 并移除
#![allow(deprecated)]

pub use pallet::*;
extern crate alloc;

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
    use alloc::vec::Vec;
    use core::convert::TryInto;
    use frame_support::sp_runtime::traits::{AccountIdConversion, Saturating};
    use frame_support::{
        pallet_prelude::*,
        traits::{ConstU32, Currency, ExistenceRequirement::KeepAlive, Get, StorageVersion},
    };
    use frame_system::pallet_prelude::*;
    use pallet_memo_referrals::ReferralProvider;

    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
    pub type BlockNumberFor<T> = frame_system::pallet_prelude::BlockNumberFor<T>;

    const STORAGE_VERSION: StorageVersion = StorageVersion::new(1);

    /// 结算模式
    #[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
    pub enum SettlementMode {
        Escrow,
        Immediate,
    }
    impl Default for SettlementMode {
        fn default() -> Self {
            SettlementMode::Escrow
        }
    }

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

    /// 函数级中文注释：当前结算模式（默认 Escrow）。
    #[pallet::storage]
    pub type Mode<T: Config> = StorageValue<_, SettlementMode, ValueQuery>;

    // ====== 可治理参数（以存储为准；常量/默认由 runtime 注入） ======
    #[pallet::type_value]
    pub fn DefaultBudgetSourceAccount<T: Config>() -> T::AccountId {
        T::EscrowPalletId::get().into_account_truncating()
    }
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

    /// 支付预算来源账户（默认为 PalletId 派生的托管账户）。
    #[pallet::storage]
    pub type BudgetSourceAccount<T: Config> =
        StorageValue<_, T::AccountId, ValueQuery, DefaultBudgetSourceAccount<T>>;
    /// 每周期（周）奖励上限（仅对发放给上级的份额生效，基础销毁/国库不计入此上限）。0 表示不限制。
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
    /// 最小有效行为次数（占位，默认 0，联动外部行为统计后启用）。
    #[pallet::storage]
    pub type MinQualifyingAction<T: Config> =
        StorageValue<_, u32, ValueQuery, DefaultMinQualActions<T>>;

    /// 函数级中文注释：账户活跃截至周（含）。
    #[pallet::storage]
    pub type ActiveUntilWeek<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// 函数级中文注释：账户当前“直推有效”人数（随到期/续期动态变化）。
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

    /// 函数级中文注释：账户主推荐码（一次性领取，不可重复）。
    #[pallet::storage]
    pub type CodeOf<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u8, ConstU32<16>>, OptionQuery>;

    /// 函数级中文注释：推荐码归属索引（规范化码 → 账户）。
    #[pallet::storage]
    pub type OwnerOfCode<T: Config> =
        StorageMap<_, Blake2_128Concat, BoundedVec<u8, ConstU32<16>>, T::AccountId, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 消费已入托管并记账。
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
        /// 完成一批结算。
        Settled { cycle: u32, paid: u32 },
        /// 活跃期已标记。
        ActiveMarked { who: T::AccountId, until_week: u32 },
        /// 结算模式变更。
        ModeChanged { mode_code: u8 },
        /// 已支付给账户的奖励。
        RewardClaimed {
            cycle: u32,
            to: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 参数更新（预算来源/上限/门槛）。
        RewardParamsUpdated,
        /// 函数级中文注释：已为账户分配唯一推荐码（默认码）。
        /// - code 采用规范化（大写十六进制）编码，仅包含 [0-9A-F]，长度固定 8。
        ReferralCodeAssigned {
            who: T::AccountId,
            code: BoundedVec<u8, ConstU32<16>>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 参数非法或比例和不为 100%。
        BadParams,
        /// 目标周无应结数据。
        NothingToSettle,
        /// 函数级中文注释：尚未绑定推荐人（sponsor），不可领取默认码。
        NotEligible,
        /// 函数级中文注释：已存在推荐码，不可重复领取。
        AlreadyHasCode,
        /// 函数级中文注释：推荐码生成发生冲突（重试后仍冲突）。
        CodeCollision,
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
            if list.is_empty() {
                return Weight::from_parts(0, 0);
            }
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
            let mode = match mode_code {
                0 => SettlementMode::Escrow,
                1 => SettlementMode::Immediate,
                _ => SettlementMode::Escrow,
            };
            Mode::<T>::put(mode);
            Self::deposit_event(Event::ModeChanged { mode_code });
            Ok(())
        }

        /// 函数级中文注释：分页结算指定周的数据。
        /// - cycle: 周编号
        /// - max_pay: 本次最多支付的账户数量（不含 burn/treasury）
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        /// 函数级中文注释：分页结算指定周的推荐奖励
        /// 注意：销毁和国库已移至多路分账系统，此函数仅结算推荐奖励
        pub fn settle(origin: OriginFor<T>, cycle: u32, max_pay: u32) -> DispatchResult {
            let _ = ensure_signed(origin)?; // 允许任何人触发结算
            let list = EntitledAccounts::<T>::get(cycle).into_inner();
            ensure!(!list.is_empty(), Error::<T>::NothingToSettle);

            let mut cursor = SettleCursor::<T>::get(cycle);
            let src = BudgetSourceAccount::<T>::get();
            let mut paid: u32 = 0;
            
            // 分页支付账户奖励
            while (cursor as usize) < list.len() && paid < max_pay {
                let who = &list[cursor as usize];
                let amt = Entitlement::<T>::take(cycle, who);
                if !amt.is_zero() {
                    let _ = T::Currency::transfer(&src, who, amt, KeepAlive);
                    Self::deposit_event(Event::RewardClaimed {
                        cycle,
                        to: who.clone(),
                        amount: amt,
                    });
                    paid = paid.saturating_add(1);
                }
                cursor = cursor.saturating_add(1);
            }
            SettleCursor::<T>::insert(cycle, cursor);

            // 若账户清单已结完，清理索引
            if (cursor as usize) >= list.len() {
                EntitledAccounts::<T>::remove(cycle);
                SettleCursor::<T>::remove(cycle);
                CycleRewardUsed::<T>::remove(cycle);
            }

            Self::deposit_event(Event::Settled { cycle, paid });
            Ok(())
        }

        /// 函数级中文注释：治理更新奖励参数（预算来源/周期上限/门槛）。
        /// - 未提供的参数保持不变；
        /// - 预算来源为直接支付账户（默认为 EscrowPalletId 派生账户）。
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn set_reward_params(
            origin: OriginFor<T>,
            budget_source: Option<T::AccountId>,
            budget_cap_per_cycle: Option<BalanceOf<T>>,
            min_stake_for_reward: Option<BalanceOf<T>>,
            min_qual_actions: Option<u32>,
        ) -> DispatchResult {
            ensure_root(origin)?;
            if let Some(acc) = budget_source {
                BudgetSourceAccount::<T>::put(acc);
            }
            if let Some(cap) = budget_cap_per_cycle {
                BudgetCapPerCycle::<T>::put(cap);
            }
            if let Some(ms) = min_stake_for_reward {
                MinStakeForReward::<T>::put(ms);
            }
            if let Some(mq) = min_qual_actions {
                MinQualifyingAction::<T>::put(mq);
            }
            Self::deposit_event(Event::RewardParamsUpdated);
            Ok(())
        }

        /// 函数级详细中文注释：领取默认推荐码（一次性，不可重复）。
        /// - 条件：该账户必须已绑定推荐人（Referrals.sponsor_of(Some)）。
        /// - 生成：取 blake2_256(account_id ++ salt) 的前 4 字节，编码为大写十六进制（长度 8）。
        /// - 冲突：如已被占用，salt 自增重试（最多 8 次）。
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn claim_default_code(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                <Self as ReferralView<T>>::sponsor_of(&who).is_some(),
                Error::<T>::NotEligible
            );
            ensure!(!CodeOf::<T>::contains_key(&who), Error::<T>::AlreadyHasCode);

            let mut salt: u8 = 0;
            let mut assigned: Option<BoundedVec<u8, ConstU32<16>>> = None;
            while salt < 8 {
                let mut bytes: Vec<u8> = who.encode();
                bytes.push(salt);
                let hash = sp_core::hashing::blake2_256(&bytes);
                // 取前 4 字节，编码为 8 位大写十六进制
                let mut code_bytes: [u8; 8] = [0u8; 8];
                for i in 0..4 {
                    let b = hash[i];
                    code_bytes[i * 2] = Self::hex_upper(b >> 4);
                    code_bytes[i * 2 + 1] = Self::hex_upper(b & 0x0F);
                }
                let vec_code = code_bytes.to_vec();
                let bv_key: BoundedVec<u8, ConstU32<16>> =
                    BoundedVec::try_from(vec_code.clone())
                        .map_err(|_| Error::<T>::CodeCollision)?;
                if !OwnerOfCode::<T>::contains_key(&bv_key) {
                    let bv: BoundedVec<u8, ConstU32<16>> = bv_key.clone();
                    CodeOf::<T>::insert(&who, &bv);
                    OwnerOfCode::<T>::insert(&bv_key, who.clone());
                    assigned = Some(bv);
                    break;
                }
                salt = salt.saturating_add(1);
            }
            ensure!(assigned.is_some(), Error::<T>::CodeCollision);
            Self::deposit_event(Event::ReferralCodeAssigned {
                who,
                code: assigned.unwrap(),
            });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：计算当前区块所属的周编号。
        pub fn week_of(now: BlockNumberFor<T>) -> u32 {
            // 简单换算：floor(now / BlocksPerWeek)
            let bpw = T::BlocksPerWeek::get();
            let n: u32 = TryInto::<u32>::try_into(now).ok().unwrap_or(0);
            if bpw == 0 {
                return 0;
            }
            n / bpw
        }

        /// 函数级中文注释：标记账户活跃期（供 offering Hook 调用）。
        pub fn mark_active(
            who: &T::AccountId,
            now: BlockNumberFor<T>,
            duration_weeks: Option<u32>,
        ) {
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
                Self::deposit_event(Event::ActiveMarked {
                    who: who.clone(),
                    until_week: new_until,
                });
            }
        }

        /// 函数级中文注释：托管/即时模式统一入口：记录分配（即时模式也先记账，再直接划拨）。
        pub fn record_distribution(
            who: &T::AccountId,
            amount: BalanceOf<T>,
            now: BlockNumberFor<T>,
        ) {
            let cur_week = Self::week_of(now);
            let max_levels = T::MaxLevels::get();
            let per_need = T::PerLevelNeed::get();
            let rates = T::LevelRatesBps::get();

            // 函数级中文注释：基础金额（现在是 100% 用于推荐奖励分配）
            // 注意：销毁和国库已移至多路分账系统，此函数仅处理推荐奖励分配
            let base: BalanceOf<T> = amount;
            // 非压缩：固定距离逐层分配
            let mut up_opt = <Self as ReferralView<T>>::sponsor_of(who);
            for layer in 1..=max_levels {
                let rate_bps: u32 = rates.get((layer - 1) as usize).copied().unwrap_or(0) as u32;
                if rate_bps == 0 {
                    // 未配置的层视为 0
                    // 继续上溯一层以推进 up_opt，避免卡住
                    up_opt = up_opt.and_then(|u| <Self as ReferralView<T>>::sponsor_of(&u));
                    continue;
                }
                let share: BalanceOf<T> = base / 10_000u32.into() * (rate_bps as u32).into();
                match up_opt {
                    Some(ref up) => {
                        let active = ActiveUntilWeek::<T>::get(up) >= cur_week;
                        let can_take = (DirectActiveCount::<T>::get(up) / per_need) >= layer;
                        // 函数级中文注释：若该层推荐人被封禁/不满足门槛/预算已达上限，则该层份额被忽略
                        // （不再累计到国库，由多路分账系统统一处理剩余资金）
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
                                    // 函数级中文注释：超出预算的部分被忽略（不累计到国库）
                                }
                            }
                        }
                        // 函数级中文注释：不合格的份额被忽略（不累计到国库）
                        // 上溯到下一层祖先
                        up_opt = <Self as ReferralView<T>>::sponsor_of(up);
                    }
                    None => {
                        // 函数级中文注释：没有上级，份额被忽略
                    }
                }
            }

            // 函数级中文注释：发出托管记录事件
            // 注意：销毁和国库已移至多路分账系统，此处仅记录推荐奖励分配
            Self::deposit_event(Event::EscrowRecorded {
                cycle: cur_week,
                who: who.clone(),
                base,
            });
        }

        /// 函数级中文注释：包装静态 trait 方法，便于 runtime 通过 `Pallet::<Runtime>::report(...)` 直接调用。
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

        /// 函数级中文注释：十六进制编码辅助（大写）。输入低 4 比特，返回 ASCII 字节。
        #[inline]
        fn hex_upper(n: u8) -> u8 {
            match n {
                0..=9 => b'0' + n,
                10..=15 => b'A' + (n - 10),
                _ => b'0',
            }
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
    /// 函数级中文注释：供奉来源调用：标记活跃 + 记账式 15 层压缩分配；即时模式下仍优先记账，再由治理触发批量支付。
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
