#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, ExistenceRequirement, Get},
};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::AccountIdConversion;
use sp_std::vec::Vec;
use sp_arithmetic::Permill;

pub use pallet::*;

/// 函数级详细中文注释：基金会跨 pallet 调用接口
/// - 设计目的：
///   - 将“存储业务”与“基金会账务”解耦，避免直接依赖 extrinsic origin 判断；
///   - 允许其它 pallet（如存储 pallet）在链上业务流转中，将一次性费用按约定记入基金会；
/// - 泛型参数：
///   - `AccountId`：链上账户标识类型；
///   - `Balance`：货币数量类型；
///   - `Hash`：订单/对象的引用哈希（例如 `cid_hash`）。
pub trait EndowmentInterface<AccountId, Balance, Hash> {
    /// 记录一次性费用进入基金会（通常流入本金池，或按治理比例拆分）。
    /// - `payer`：付款账户（通常为下单用户）。
    /// - `amount`：一次性费用金额（MEMO）。
    /// - `order_ref`：业务引用哈希（如 `cid_hash`）。
    fn deposit_from_storage(payer: &AccountId, amount: Balance, order_ref: Hash) -> DispatchResult;
}

/// 函数级详细中文注释：SLA 提供者接口
/// - 由运行时适配器实现，读取外部模块（如 `pallet-memo-ipfs`）的运营者统计；
/// - 采用回调遍历，避免在本 pallet 中引入强依赖与复杂泛型。
pub trait SlaProvider<AccountId, BlockNumber> {
    /// 遍历当前周期的运营者统计数据
    /// - f 参数：(|operator, probe_ok, probe_fail, last_update_block|)
    fn visit<F: FnMut(&AccountId, u32, u32, BlockNumber)>(f: F);
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{tokens::Balance as BalanceT, Currency},
        PalletId,
    };

    /// 余额别名
    pub type BalanceOf<T> = <T as Config>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 货币接口（MEMO 主币）
        type Currency: Currency<Self::AccountId, Balance = Self::Balance>;

        /// 余额类型（与 `Currency::Balance` 对齐）
        type Balance: Parameter + BalanceT + MaxEncodedLen + Default + Copy;

        /// 本金账户 PalletId（用于派生基金会“本金池”账户）
        #[pallet::constant]
        type PrincipalPalletId: Get<PalletId>;

        /// 收益账户 PalletId（用于派生基金会“收益池”账户）
        #[pallet::constant]
        type YieldPalletId: Get<PalletId>;

        /// 治理来源（Root 或理事会/公投白名单）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 权重信息（后续基准测试填充）
        type WeightInfo: WeightInfo;

        /// 运营者 SLA 数据提供者（由 runtime 注入，读取 `pallet-memo-ipfs` 统计）
        type Sla: SlaProvider<Self::AccountId, BlockNumberFor<Self>>;
    }

    #[pallet::pallet]
    #[pallet::storage_version(StorageVersion::new(0))]
    pub struct Pallet<T>(_);

    /// 基金参数（示例：目标收益率、结算周期等；此处骨架暂存占位字段）
    #[pallet::storage]
    pub type EndowmentParams<T: Config> = StorageValue<_, Vec<u8>, OptionQuery>;

    /// 审计年报哈希留档
    #[pallet::storage]
    pub type AnnualReports<T: Config> = StorageMap<_, Blake2_128Concat, u32, T::Hash, OptionQuery>;

    /// 函数级中文注释：是否暂停结算（紧急制动开关）。
    #[pallet::storage]
    pub type Paused<T: Config> = StorageValue<_, bool, ValueQuery>;

    /// 函数级中文注释：黑名单（被禁止领取的运营者账户）。
    #[pallet::storage]
    pub type Blacklisted<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    /// 函数级中文注释：最低 SLA 门槛（Permill，默认 0 表示不限制）。
    #[pallet::storage]
    pub type MinSlaPermill<T: Config> = StorageValue<_, Permill, ValueQuery>;

    /// 函数级中文注释：SLA 最长“未上报”区块数，超过将跳过本期发放（0 表示不限制）。
    #[pallet::storage]
    pub type MaxSlaStaleBlocks<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    /// 函数级中文注释：年度预算上限（单位：余额）。
    #[pallet::storage]
    pub type MaxAnnualBudget<T: Config> = StorageMap<_, Blake2_128Concat, u32, BalanceOf<T>, OptionQuery>;

    /// 函数级中文注释：年度已支出累计。
    #[pallet::storage]
    pub type YearlySpent<T: Config> = StorageMap<_, Blake2_128Concat, u32, BalanceOf<T>, ValueQuery>;

    /// 函数级中文注释：当前财年（由治理设置，用于 YearlySpent 记账）。
    #[pallet::storage]
    pub type CurrentYear<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// 函数级中文注释：运营者的代理收款账户（若为空使用运营者自身账户）。
    #[pallet::storage]
    pub type PayoutRecipientOf<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, T::AccountId, OptionQuery>;

    /// 函数级中文注释：结算期索引（用于审计与溯源）。
    #[pallet::storage]
    pub type EpochIndex<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 一次性费用已入账（payer, amount, order_ref）
        OneOffFeeReceived(T::AccountId, BalanceOf<T>, T::Hash),
        /// 年报发布（year, hash）
        AnnualReportPublished(u32, T::Hash),
        /// 参数已更新
        ParamsUpdated,
        /// 按周期向运营者支付（operator, amount）
        OperatorPaid(T::AccountId, BalanceOf<T>),
        /// 因风控策略被跳过（operator, reason_code） reason_code:1=LowSla,2=Stale,3=Blacklisted,4=Paused,5=ZeroAmount,6=InsufficientBudget
        OperatorSkipped(T::AccountId, u8),
        /// 结算期已关闭（epoch, budget_in, paid_total, operators_processed, skipped_count）
        EpochClosed(u32, BalanceOf<T>, BalanceOf<T>, u32, u32),
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 金额为零
        ZeroAmount,
        /// 已暂停
        Paused,
        /// 收益池余额不足
        InsufficientYieldFunds,
        /// 超出年度预算
        OverAnnualBudget,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：发布年度审计报告指纹
        /// - 仅治理来源可调用；
        /// - 将 `year -> report_hash` 写入存储，并发出事件，便于前端审计看板检索；
        /// - 骨架实现仅做简单写入，实际可附加权限/频率限制。
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::publish_annual_report())]
        pub fn publish_annual_report(
            origin: OriginFor<T>,
            year: u32,
            report_hash: T::Hash,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            AnnualReports::<T>::insert(year, report_hash);
            Self::deposit_event(Event::AnnualReportPublished(year, report_hash));
            Ok(())
        }

        /// 函数级详细中文注释：更新基金参数（骨架）
        /// - 仅治理来源允许；
        /// - 以原始字节形式暂存，后续迁移为结构体并提供 StorageVersion 变更。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_params(origin: OriginFor<T>, raw: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            EndowmentParams::<T>::put(raw);
            Self::deposit_event(Event::ParamsUpdated);
            Ok(())
        }

        /// 函数级详细中文注释：设置/取消暂停状态（紧急制动）。
        /// - 仅治理来源可调用；暂停时所有结算拒绝执行。
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_paused(origin: OriginFor<T>, on: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            Paused::<T>::put(on);
            Ok(())
        }

        /// 函数级详细中文注释：设置最低 SLA 门槛（Permill）。
        /// - 仅治理来源可调用；0 表示不限制。
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_min_sla(origin: OriginFor<T>, permill_parts: u32) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let p = Permill::from_parts(permill_parts.min(1_000_000));
            MinSlaPermill::<T>::put(p);
            Ok(())
        }

        /// 函数级详细中文注释：设置 SLA 最长“未上报”区块数阈值。
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_max_sla_stale_blocks(origin: OriginFor<T>, blocks: BlockNumberFor<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            MaxSlaStaleBlocks::<T>::put(blocks);
            Ok(())
        }

        /// 函数级详细中文注释：设置当前财年与对应年度预算上限。
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_annual_budget(origin: OriginFor<T>, year: u32, max_budget: BalanceOf<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            CurrentYear::<T>::put(year);
            MaxAnnualBudget::<T>::insert(year, max_budget);
            Ok(())
        }

        /// 函数级详细中文注释：设置/取消黑名单。
        #[pallet::call_index(6)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_blacklist(origin: OriginFor<T>, who: T::AccountId, on: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            if on { Blacklisted::<T>::insert(&who, ()); } else { Blacklisted::<T>::remove(&who); }
            Ok(())
        }

        /// 函数级详细中文注释：设置运营者的代理收款账户（None 则删除使用默认运营者账户）。
        #[pallet::call_index(7)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_payout_recipient(origin: OriginFor<T>, operator: T::AccountId, recipient: Option<T::AccountId>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            match recipient { Some(r) => PayoutRecipientOf::<T>::insert(operator, r), None => PayoutRecipientOf::<T>::remove(operator) }
            Ok(())
        }

        /// 函数级详细中文注释：本金划转到收益池（用于当期结算预算补充）。
        #[pallet::call_index(8)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn transfer_principal_to_yield(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(amount != BalanceOf::<T>::default(), Error::<T>::ZeroAmount);
            let from = Self::principal_account_id();
            let to = Self::yield_account_id();
            <T as Config>::Currency::transfer(&from, &to, amount, ExistenceRequirement::KeepAlive)?;
            Ok(())
        }

        /// 函数级详细中文注释：关闭结算期并按 SLA 权重向运营者支付
        /// - 输入 `budget`：本期用于支付的预算（从收益账户划出）；
        /// - 规则（MVP）：score = probe_ok / max(1, probe_ok + probe_fail)；总分为 0 则直接返回。
        #[pallet::call_index(9)]
        #[pallet::weight(T::WeightInfo::close_epoch_and_pay())]
        pub fn close_epoch_and_pay(origin: OriginFor<T>, budget: BalanceOf<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            // 全局暂停保护
            ensure!(!Paused::<T>::get(), Error::<T>::Paused);

            // 年度预算与收益池余额约束
            let year = CurrentYear::<T>::get();
            let year_cap = MaxAnnualBudget::<T>::get(year).unwrap_or_default();
            let year_spent = YearlySpent::<T>::get(year);
            let year_remaining = if year_cap > year_spent { year_cap - year_spent } else { Default::default() };
            let yield_acc = Self::yield_account_id();
            let yield_free = <T as Config>::Currency::free_balance(&yield_acc);
            let mut effective_budget = budget;
            if effective_budget > yield_free { effective_budget = yield_free; }
            if year_cap != Default::default() && effective_budget > year_remaining { effective_budget = year_remaining; }
            ensure!(effective_budget != Default::default(), Error::<T>::InsufficientYieldFunds);

            let mut items: sp_std::vec::Vec<(T::AccountId, u128)> = sp_std::vec::Vec::new();
            // 聚合 SLA 分数（以 u128 比例表示，放大 1e9）
            let scale: u128 = 1_000_000_000;
            let mut total_score: u128 = 0;
            let now = <frame_system::Pallet<T>>::block_number();
            let min_sla = MinSlaPermill::<T>::get();
            let max_stale = MaxSlaStaleBlocks::<T>::get();
            T::Sla::visit(|op, ok, fail, last_update| {
                if Blacklisted::<T>::contains_key(&op) { return; }
                if max_stale != Default::default() && now.saturating_sub(last_update) > max_stale { return; }
                let ok_u = ok as u128; let fail_u = fail as u128;
                let denom = ok_u + fail_u;
                let score = if denom == 0 { 0 } else { ok_u * scale / denom };
                // SLA 下限
                if score > 0 {
                    let permill = Permill::from_parts(((score.saturating_mul(1_000_000u128) / scale) as u32).min(1_000_000));
                    if min_sla.deconstruct() > 0 && permill < min_sla { return; }
                    items.push((op.clone(), score));
                    total_score = total_score.saturating_add(score);
                }
            });
            if items.is_empty() || total_score == 0 { return Ok(()); }
            let payer = yield_acc;
            // 分配支付
            let mut paid_total: BalanceOf<T> = Default::default();
            let mut skipped: u32 = 0;
            for (op, score) in items.into_iter() {
                let share = sp_arithmetic::per_things::Permill::from_parts(((score.saturating_mul(1_000_000u128) / total_score) as u32).min(1_000_000));
                let amt: BalanceOf<T> = share * effective_budget;
                if amt == BalanceOf::<T>::default() { Self::deposit_event(Event::OperatorSkipped(op, 5)); skipped = skipped.saturating_add(1); continue; }
                let recipient = PayoutRecipientOf::<T>::get(&op).unwrap_or(op.clone());
                match <T as Config>::Currency::transfer(&payer, &recipient, amt, ExistenceRequirement::KeepAlive) {
                    Ok(_) => { paid_total = paid_total.saturating_add(amt); Self::deposit_event(Event::OperatorPaid(recipient, amt)); }
                    Err(_e) => { Self::deposit_event(Event::OperatorSkipped(op, 6)); skipped = skipped.saturating_add(1); }
                }
            }
            // 年度累计
            if year != 0 { YearlySpent::<T>::mutate(year, |v| { *v = v.saturating_add(paid_total); }); }
            let epoch = EpochIndex::<T>::mutate(|e| { let cur = *e; *e = e.saturating_add(1); cur });
            Self::deposit_event(Event::EpochClosed(epoch, effective_budget, paid_total, 0, skipped));
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：返回基金“本金池”账户
        /// - 通过 PalletId 派生确定且可审计的账户地址，避免手工配置风险。
        pub fn principal_account_id() -> T::AccountId {
            T::PrincipalPalletId::get().into_account_truncating()
        }

        /// 函数级详细中文注释：返回基金“收益池”账户
        /// - 与本金池分账，便于遵循“本金保值、收益支付”的财务约束。
        pub fn yield_account_id() -> T::AccountId {
            T::YieldPalletId::get().into_account_truncating()
        }
    }

    /// 对外接口实现：允许存储业务 pallet 将一次性费用汇入基金
    impl<T: Config> super::EndowmentInterface<T::AccountId, BalanceOf<T>, T::Hash> for Pallet<T> {
        /// 函数级详细中文注释：一次性费用入账
        /// - 当前骨架实现：全部转入“本金池”账户；
        /// - 未来可由治理参数拆分：部分进入收益池作为当期运营预算；
        /// - 资金安全：使用 `KeepAlive` 保证付款账户不会被意外清退。
        fn deposit_from_storage(
            payer: &T::AccountId,
            amount: BalanceOf<T>,
            order_ref: T::Hash,
        ) -> DispatchResult {
            ensure!(amount != BalanceOf::<T>::default(), Error::<T>::ZeroAmount);

            let principal = Self::principal_account_id();
            <T as Config>::Currency::transfer(
                payer,
                &principal,
                amount,
                ExistenceRequirement::KeepAlive,
            )?;
            Self::deposit_event(Event::OneOffFeeReceived(payer.clone(), amount, order_ref));
            Ok(())
        }
    }

    /// 权重占位：后续通过 benchmarking 填充
    pub trait WeightInfo {
        fn publish_annual_report() -> Weight;
        fn set_params() -> Weight;
        fn close_epoch_and_pay() -> Weight;
    }

    impl WeightInfo for () {
        fn publish_annual_report() -> Weight { 10_000 }
        fn set_params() -> Weight { 10_000 }
        fn close_epoch_and_pay() -> Weight { 50_000 }
    }
}


