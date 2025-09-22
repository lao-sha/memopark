#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

/// 函数级中文注释：pallet-fee-guard（仅手续费账户保护）
/// - 目标：将指定账户标记为“仅可用于扣除手续费（Transaction Payment）”，永远不可主动转出资金；
/// - 方法：基于 `pallet-balances` 的 Lock 机制，设置一个永久锁，拒绝除手续费以外的所有取款原因；
/// - 幂等：重复 mark/unmark 将安全返回 Ok，不报错，便于批处理与运维；
/// - 安全：不触碰资金所有权，不改变账户结构；与官方机制完全兼容。

extern crate alloc;

pub use pallet::*;
/// 函数级中文注释：权重模块导入，提供 WeightInfo 接口用于基于输入规模计算交易权重。
pub mod weights;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency as CurrencyTrait, LockIdentifier, LockableCurrency, WithdrawReasons, OnKilledAccount},
};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::Bounded;
use crate::weights::WeightInfo;
use alloc::vec::Vec;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    /// 函数级中文注释：锁金额与 Currency 类型别名，统一表达。
    pub type BalanceOf<T> = <<T as Config>::Currency as CurrencyTrait<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级中文注释：锁标识符（8字节）。
    pub const FEE_GUARD_ID: LockIdentifier = *b"FEEGUARD";

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 函数级中文注释：使用 Balances 作为可加锁货币接口。
        type Currency: LockableCurrency<Self::AccountId>;
        /// 函数级中文注释：管理员起源（Root/内容治理账号等）。
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：系统关键账户白名单/黑名单策略（可选）。
        /// - 返回 true 表示允许标记；false 表示禁止标记（例如国库/平台账户）。
        type AllowMarking: AllowMarkingPolicy<Self::AccountId>;
        /// 函数级中文注释：权重信息接口（后续可用基准生成替换）。
        type WeightInfo: WeightInfo;
    }

    /// 函数级中文注释：被标记为“仅手续费”的账户集合（ValueQuery=false：仅作为存在性标记）。
    #[pallet::storage]
    pub type FeeOnlyAccounts<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, (), OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 已标记为仅手续费账户（who, locked_amount）。
        MarkedFeeOnly(T::AccountId, BalanceOf<T>),
        /// 已解除仅手续费标记（who）。
        UnmarkedFeeOnly(T::AccountId),
    }

    #[pallet::error]
    pub enum Error<T> { Forbidden }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：将账户标记为“仅手续费”账户（幂等）。
        /// - 权限：AdminOrigin（Root/内容治理等）；
        /// - 实现：对账户设置永久 Lock，拒绝除 `TRANSACTION_PAYMENT` 以外的所有 WithdrawReasons；
        /// - 金额：使用 Balance::max_value() 作为锁定额度，确保任意非手续费取款均因不足而失败；
        /// - 幂等：若账户已标记，则直接返回 Ok。
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::mark_fee_only())]
        pub fn mark_fee_only(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(T::AllowMarking::allow(&who), Error::<T>::Forbidden);
            if FeeOnlyAccounts::<T>::get(&who).is_some() {
                // 已标记：幂等返回
                return Ok(())
            }
            let max: BalanceOf<T> = Bounded::max_value();
            // 拒绝全部，仅放行 TRANSACTION_PAYMENT
            let deny_all_but_fee = WithdrawReasons::all().difference(WithdrawReasons::TRANSACTION_PAYMENT);
            <T as Config>::Currency::set_lock(FEE_GUARD_ID, &who, max, deny_all_but_fee);
            FeeOnlyAccounts::<T>::insert(&who, ());
            Self::deposit_event(Event::MarkedFeeOnly(who, max));
            Ok(())
        }

        /// 函数级中文注释：解除“仅手续费”标记（幂等）。
        /// - 权限：AdminOrigin；
        /// - 行为：移除 Lock，并从存储中删除标记；
        /// - 幂等：若账户未标记，则直接返回 Ok。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::unmark_fee_only())]
        pub fn unmark_fee_only(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            if FeeOnlyAccounts::<T>::get(&who).is_none() {
                // 未标记：幂等返回
                return Ok(())
            }
            <T as Config>::Currency::remove_lock(FEE_GUARD_ID, &who);
            FeeOnlyAccounts::<T>::remove(&who);
            Self::deposit_event(Event::UnmarkedFeeOnly(who));
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：只读判断账户是否处于“仅手续费”保护状态（不产生任何写入）。
        pub fn is_fee_only(who: &T::AccountId) -> bool {
            FeeOnlyAccounts::<T>::contains_key(who)
        }

        /// 函数级中文注释：列出最多 `limit` 个已被标记的仅手续费账户（实现相关顺序）。
        /// - 适用于运维导出/巡检；大规模导出请结合多次调用分页处理。
        pub fn list_fee_only(limit: u32) -> Vec<T::AccountId> {
            FeeOnlyAccounts::<T>::iter_keys().take(limit as usize).collect()
        }
    }

    /// 函数级中文注释：当账户被 reaped（杀死）时，清理 FeeOnly 标记，避免孤儿条目。
    impl<T: Config> OnKilledAccount<T::AccountId> for Pallet<T> {
        fn on_killed_account(who: &T::AccountId) {
            if FeeOnlyAccounts::<T>::get(who).is_some() {
                FeeOnlyAccounts::<T>::remove(who);
            }
        }
    }
    }

/// 函数级中文注释：标记允许策略接口。返回 true 表示可标记；false 表示禁止。
pub trait AllowMarkingPolicy<AccountId> { fn allow(who: &AccountId) -> bool; }

// 测试与基准模块声明
#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;


