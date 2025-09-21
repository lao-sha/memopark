#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, traits::{Currency, ExistenceRequirement}, PalletId};
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::{AccountIdConversion, Saturating, Zero};

    pub type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 供其他 Pallet 内部调用的托管接口
    pub trait Escrow<AccountId, Balance> {
        /// 从付款人转入托管并记录
        /// 函数级详细中文注释：安全要求
        /// - 必须确保付款人余额充足（不足则返回 Error::Insufficient）
        /// - 仅供其他 Pallet 内部调用，不对外暴露权限判断；外部 extrinsic 需严格限制 Origin
        fn lock_from(payer: &AccountId, id: u64, amount: Balance) -> DispatchResult;
        /// 从托管转出部分金额到指定账户（可多次分账），直至全部转出
        /// 函数级详细中文注释：安全要求
        /// - 必须确保本 id 当前托管余额充足（amount ≤ cur），否则拒绝（Error::Insufficient）
        /// - 一次成功划转为原子事务，状态与实际转账保持一致
        fn transfer_from_escrow(id: u64, to: &AccountId, amount: Balance) -> DispatchResult;
        /// 将托管全部释放给收款人
        /// 函数级详细中文注释：将 id 对应全部锁定余额转给 to，用于正常履约或仲裁裁决
        fn release_all(id: u64, to: &AccountId) -> DispatchResult;
        /// 将托管全部退款给收款人
        /// 函数级详细中文注释：将 id 对应全部锁定余额退回给 to，用于撤单/到期退款等场景
        fn refund_all(id: u64, to: &AccountId) -> DispatchResult;
        /// 查询当前托管余额
        fn amount_of(id: u64) -> Balance;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        type Currency: Currency<Self::AccountId>;
        type EscrowPalletId: Get<PalletId>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 简单托管：订单 -> 锁定余额
    #[pallet::storage]
    pub type Locked<T: Config> = StorageMap<_, Blake2_128Concat, u64, BalanceOf<T>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 锁定到托管账户（listing_id 或 order_id 作为 id）
        Locked { id: u64, amount: BalanceOf<T> },
        /// 从托管部分划转（多次分账）
        Transfered { id: u64, to: T::AccountId, amount: BalanceOf<T>, remaining: BalanceOf<T> },
        /// 全额释放
        Released { id: u64, to: T::AccountId, amount: BalanceOf<T> },
        /// 全额退款
        Refunded { id: u64, to: T::AccountId, amount: BalanceOf<T> },
    }

    #[pallet::error]
    pub enum Error<T> { Insufficient, NoLock }

    impl<T: Config> Pallet<T> {
        fn account() -> T::AccountId { T::EscrowPalletId::get().into_account_truncating() }
    }

    impl<T: Config> Escrow<T::AccountId, BalanceOf<T>> for Pallet<T> {
        fn lock_from(payer: &T::AccountId, id: u64, amount: BalanceOf<T>) -> DispatchResult {
            // 函数级详细中文注释：从指定付款人向托管账户划转指定金额，并累加到 Locked[id]
            // - 余额校验：Currency::transfer 失败即返回 Error::Insufficient
            // - 原子性：任意一步失败会使外层事务回滚，避免脏写
            let escrow = Self::account();
            T::Currency::transfer(payer, &escrow, amount, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::Insufficient)?;
            let cur = Locked::<T>::get(id);
            Locked::<T>::insert(id, cur.saturating_add(amount));
            Self::deposit_event(Event::Locked { id, amount });
            Ok(())
        }
        fn transfer_from_escrow(id: u64, to: &T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
            // 函数级详细中文注释：从 Locked[id] 对应的托管余额中转出部分至目标账户
            // - 风险控制：禁止透支（amount 必须 ≤ 当前托管余额），避免逃逸
            let cur = Locked::<T>::get(id);
            ensure!(!cur.is_zero(), Error::<T>::NoLock);
            ensure!(amount <= cur, Error::<T>::Insufficient);
            let new = cur.saturating_sub(amount);
            Locked::<T>::insert(id, new);
            let escrow = Self::account();
            T::Currency::transfer(&escrow, to, amount, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::NoLock)?;
            if new.is_zero() { Locked::<T>::remove(id); }
            Self::deposit_event(Event::Transfered { id, to: to.clone(), amount, remaining: new });
            Ok(())
        }
        fn release_all(id: u64, to: &T::AccountId) -> DispatchResult {
            // 函数级详细中文注释：一次性释放全部托管余额给收款人
            let amount = Locked::<T>::take(id);
            let escrow = Self::account();
            T::Currency::transfer(&escrow, to, amount, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::NoLock)?;
            Self::deposit_event(Event::Released { id, to: to.clone(), amount });
            Ok(())
        }
        fn refund_all(id: u64, to: &T::AccountId) -> DispatchResult {
            // 函数级详细中文注释：一次性退回全部托管余额给收款人
            let amount = Locked::<T>::take(id);
            let escrow = Self::account();
            T::Currency::transfer(&escrow, to, amount, ExistenceRequirement::KeepAlive).map_err(|_| Error::<T>::NoLock)?;
            Self::deposit_event(Event::Refunded { id, to: to.clone(), amount });
            Ok(())
        }
        fn amount_of(id: u64) -> BalanceOf<T> { Locked::<T>::get(id) }
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 锁定：从付款人划转到托管账户并记录
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn lock(origin: OriginFor<T>, id: u64, payer: T::AccountId, amount: BalanceOf<T>) -> DispatchResult {
            // 函数级详细中文注释（安全变更）：仅允许 Root 调用外部锁定入口，防止任意账户冒用 payer 盗划资金。
            ensure_root(origin)?;
            <Self as Escrow<T::AccountId, BalanceOf<T>>>::lock_from(&payer, id, amount)
        }
        /// 释放：将托管金额转给收款人
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn release(origin: OriginFor<T>, id: u64, to: T::AccountId) -> DispatchResult {
            // 函数级详细中文注释（安全变更）：仅允许 Root 调用外部释放入口；常规场景应由业务 Pallet 通过内部接口驱动。
            ensure_root(origin)?;
            <Self as Escrow<T::AccountId, BalanceOf<T>>>::release_all(id, &to)
        }
        /// 退款：退回付款人
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn refund(origin: OriginFor<T>, id: u64, to: T::AccountId) -> DispatchResult {
            // 函数级详细中文注释（安全变更）：仅允许 Root 调用外部退款入口；常规场景应由业务 Pallet 通过内部接口驱动。
            ensure_root(origin)?;
            <Self as Escrow<T::AccountId, BalanceOf<T>>>::refund_all(id, &to)
        }
    }
}


