#![cfg_attr(not(feature = "std"), no_std)]

//! # 联盟计酬托管层 (pallet-memo-affiliate)
//!
//! ## 功能概述
//!
//! 本模块是联盟计酬系统的**托管层**，专注于资金的安全托管与管理。
//! 职责单一：只负责资金的存入、提取和余额查询，不涉及分配逻辑。
//!
//! ## 核心特性
//!
//! 1. **资金托管**
//!    - 使用独立的 `AffiliatePalletId (*b"affiliat")` 派生托管账户
//!    - 与 OTC 托管账户完全隔离，资金安全独立
//!
//! 2. **接口设计**
//!    - `escrow_account()`: 获取托管账户地址
//!    - `escrow_balance()`: 查询托管账户余额
//!    - `deposit()`: 归集资金到托管账户
//!    - `withdraw()`: 从托管账户提取资金（权限控制）
//!
//! 3. **权限控制**
//!    - 存款操作：任何账户都可以向托管账户转账
//!    - 提款操作：只有授权的分配模块可以提取资金
//!
//! ## 架构设计
//!
//! ```text
//! ┌──────────────────────┐
//! │ pallet-memo-affiliate│ ← 托管层（本模块）
//! │ - 托管资金            │
//! │ - 存取接口            │
//! └──────────────────────┘
//!          ↑
//!          │ 调用托管账户
//!          │
//! ┌────────┴──────────────────────┐
//! │ pallet-memo-affiliate-weekly  │ ← 分配层
//! │ - 分配逻辑                     │
//! │ - 周期结算                     │
//! └───────────────────────────────┘
//! ```
//!
//! ## 与 pallet-affiliate-instant 的架构一致性
//!
//! - `pallet-affiliate-instant`: 即时分成工具，资金由调用方传入
//! - `pallet-memo-affiliate-weekly`: 周结算工具，资金从本托管层读取
//! - `pallet-memo-affiliate`: 托管层，为 weekly 提供资金支持
//!
//! 两种工具层都遵循"无状态工具"设计理念，职责清晰。

pub use pallet::*;

/// 函数级中文注释：托管账户提供者 Trait，供其他模块使用
pub trait EscrowProvider<AccountId, Balance> {
	/// 获取托管账户地址
	fn escrow_account() -> AccountId;
	/// 查询托管账户余额
	fn escrow_balance() -> Balance;
	/// 归集资金到托管账户
	fn deposit(from: &AccountId, amount: Balance) -> Result<(), &'static str>;
	/// 从托管账户提取资金（仅供授权模块调用）
	fn withdraw(to: &AccountId, amount: Balance) -> Result<(), &'static str>;
}

#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::{
		pallet_prelude::*,
		traits::{Currency, ExistenceRequirement::KeepAlive, Get},
		PalletId,
	};
	use frame_system::pallet_prelude::*;
	use sp_runtime::traits::{AccountIdConversion, Saturating, Zero};

	/// 余额类型
	pub type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// 事件类型
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// 货币系统
		type Currency: Currency<Self::AccountId>;

		/// 托管 PalletId（派生独立的托管账户）
		#[pallet::constant]
		type EscrowPalletId: Get<PalletId>;

		/// 提款权限控制（可选）
		/// 如果设置，则只有指定的 Origin 可以调用 withdraw
		/// 如果不设置，则任何人都可以调用（不推荐）
		type WithdrawOrigin: EnsureOrigin<Self::RuntimeOrigin>;
	}

	/// 函数级中文注释：累计存入金额统计
	#[pallet::storage]
	#[pallet::getter(fn total_deposited)]
	pub type TotalDeposited<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// 函数级中文注释：累计提取金额统计
	#[pallet::storage]
	#[pallet::getter(fn total_withdrawn)]
	pub type TotalWithdrawn<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

	/// 事件
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 函数级中文注释：资金存入托管账户
		/// 参数：[存款人, 存款金额]
		Deposited { from: T::AccountId, amount: BalanceOf<T> },
		/// 函数级中文注释：资金从托管账户提取
		/// 参数：[提取到, 提取金额]
		Withdrawn { to: T::AccountId, amount: BalanceOf<T> },
	}

	/// 错误
	#[pallet::error]
	pub enum Error<T> {
		/// 金额为零
		ZeroAmount,
		/// 托管账户余额不足
		InsufficientEscrowBalance,
		/// 未授权的提款操作
		Unauthorized,
	}

	/// Extrinsics
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 函数级中文注释：存入资金到托管账户
		/// 任何账户都可以向托管账户转账
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000_000, 0))]
		pub fn deposit(
			origin: OriginFor<T>,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			let from = ensure_signed(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);

			// 转账到托管账户
			let escrow = Self::escrow_account();
			T::Currency::transfer(&from, &escrow, amount, KeepAlive)?;

			// 更新统计
			TotalDeposited::<T>::mutate(|total| *total = total.saturating_add(amount));

			// 发出事件
			Self::deposit_event(Event::Deposited { from, amount });

			Ok(())
		}

		/// 函数级中文注释：从托管账户提取资金
		/// 只有授权的 Origin 可以调用（如 Root 或特定委员会）
		#[pallet::call_index(1)]
		#[pallet::weight(Weight::from_parts(10_000_000, 0))]
		pub fn withdraw(
			origin: OriginFor<T>,
			to: T::AccountId,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			// 权限验证
			T::WithdrawOrigin::ensure_origin(origin)?;
			ensure!(!amount.is_zero(), Error::<T>::ZeroAmount);

			// 检查托管账户余额
			let escrow = Self::escrow_account();
			let balance = T::Currency::free_balance(&escrow);
			ensure!(balance >= amount, Error::<T>::InsufficientEscrowBalance);

			// 从托管账户转账
			T::Currency::transfer(&escrow, &to, amount, KeepAlive)?;

			// 更新统计
			TotalWithdrawn::<T>::mutate(|total| *total = total.saturating_add(amount));

			// 发出事件
			Self::deposit_event(Event::Withdrawn { to, amount });

			Ok(())
		}
	}

	impl<T: Config> Pallet<T> {
		/// 函数级中文注释：获取托管账户地址
		pub fn escrow_account() -> T::AccountId {
			T::EscrowPalletId::get().into_account_truncating()
		}

		/// 函数级中文注释：查询托管账户余额
		pub fn escrow_balance() -> BalanceOf<T> {
			T::Currency::free_balance(&Self::escrow_account())
		}
	}

	/// 函数级中文注释：实现 EscrowProvider Trait，供其他模块使用
	impl<T: Config> EscrowProvider<T::AccountId, BalanceOf<T>> for Pallet<T> {
		fn escrow_account() -> T::AccountId {
			Self::escrow_account()
		}

		fn escrow_balance() -> BalanceOf<T> {
			Self::escrow_balance()
		}

		fn deposit(from: &T::AccountId, amount: BalanceOf<T>) -> Result<(), &'static str> {
			ensure!(!amount.is_zero(), "Zero amount");
			let escrow = Self::escrow_account();
			T::Currency::transfer(from, &escrow, amount, KeepAlive)
				.map_err(|_| "Transfer failed")?;
			TotalDeposited::<T>::mutate(|total| *total = total.saturating_add(amount));
			Self::deposit_event(Event::Deposited { from: from.clone(), amount });
			Ok(())
		}

		fn withdraw(to: &T::AccountId, amount: BalanceOf<T>) -> Result<(), &'static str> {
			ensure!(!amount.is_zero(), "Zero amount");
			let escrow = Self::escrow_account();
			let balance = T::Currency::free_balance(&escrow);
			ensure!(balance >= amount, "Insufficient escrow balance");
			T::Currency::transfer(&escrow, to, amount, KeepAlive)
				.map_err(|_| "Transfer failed")?;
			TotalWithdrawn::<T>::mutate(|total| *total = total.saturating_add(amount));
			Self::deposit_event(Event::Withdrawn { to: to.clone(), amount });
			Ok(())
		}
	}
}

