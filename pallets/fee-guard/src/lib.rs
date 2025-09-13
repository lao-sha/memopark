#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

/// 函数级中文注释：pallet-fee-guard（仅手续费账户保护）
/// - 目标：将指定账户标记为“仅可用于扣除手续费（Transaction Payment）”，永远不可主动转出资金；
/// - 方法：基于 `pallet-balances` 的 Lock 机制，设置一个永久锁，仅拒绝 `Transfer/Reserve/Tip` 等原因的取出，保留 `TransactionPayment`；
/// - 解锁：默认仅治理（AdminOrigin）可解除，避免普通用户绕过；
/// - 安全：不触碰资金所有权，不改变账户结构；与官方机制完全兼容。

extern crate alloc;

pub use pallet::*;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency as CurrencyTrait, LockIdentifier, LockableCurrency, WithdrawReasons},
};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::Bounded;

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
    pub enum Error<T> {
        /// 账户未处于仅手续费状态。
        NotMarked,
        /// 账户已处于仅手续费状态。
        AlreadyMarked,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：将账户标记为“仅手续费”账户。
        /// - 权限：AdminOrigin（Root/内容治理等）；
        /// - 实现：对账户设置永久 Lock，拒绝 Transfer/Reserve/Tip 等支出，仅保留 TransactionPayment（手续费）可扣除；
        /// - 金额：使用 Balance::max_value() 作为锁定额度，确保任意非手续费取款均因不足而失败。
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn mark_fee_only(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(FeeOnlyAccounts::<T>::get(&who).is_none(), Error::<T>::AlreadyMarked);

            let max: BalanceOf<T> = Bounded::max_value();
            // 锁拒绝的原因：Transfer/Reserve/Tip（保留 TransactionPayment）。
            let reasons = WithdrawReasons::TRANSFER | WithdrawReasons::RESERVE | WithdrawReasons::TIP;
            <T as Config>::Currency::set_lock(FEE_GUARD_ID, &who, max, reasons);
            FeeOnlyAccounts::<T>::insert(&who, ());
            Self::deposit_event(Event::MarkedFeeOnly(who, max));
            Ok(())
        }

        /// 函数级中文注释：解除“仅手续费”标记（治理操作）。
        /// - 权限：AdminOrigin；
        /// - 行为：移除 Lock，并从存储中删除标记。
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn unmark_fee_only(origin: OriginFor<T>, who: T::AccountId) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            ensure!(FeeOnlyAccounts::<T>::get(&who).is_some(), Error::<T>::NotMarked);
            <T as Config>::Currency::remove_lock(FEE_GUARD_ID, &who);
            FeeOnlyAccounts::<T>::remove(&who);
            Self::deposit_event(Event::UnmarkedFeeOnly(who));
            Ok(())
        }
    }
}


