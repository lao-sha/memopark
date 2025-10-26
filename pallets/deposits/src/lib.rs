#![cfg_attr(not(feature = "std"), no_std)]

//! # Pallet Deposits - 通用押金管理模块
//!
//! ## 概述
//!
//! 本模块提供通用的押金管理服务，支持多种业务场景：
//! - 申诉押金（pallet-memo-appeals）
//! - 审核押金（pallet-memo-offerings）
//! - 投诉押金（pallet-deceased-text, pallet-deceased-media）
//! - 自定义用途押金
//!
//! ## 核心功能
//!
//! - **冻结押金**：`reserve_deposit` - 将用户资金冻结作为押金
//! - **释放押金**：`release_deposit` - 全额退回押金
//! - **罚没押金**：`slash_deposit` - 部分或全部罚没押金
//! - **查询押金**：查询押金记录和状态
//!
//! ## 设计理念
//!
//! 1. **通用化**：通过DepositPurpose枚举支持多种用途
//! 2. **安全性**：使用Currency trait确保资金安全
//! 3. **可追溯**：完整记录押金生命周期
//! 4. **可扩展**：支持未来新的押金场景

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
	use super::*;
	use frame_support::{
		pallet_prelude::*,
		traits::{Currency, ExistenceRequirement, ReservableCurrency},
	};
	use frame_system::pallet_prelude::*;
	use sp_runtime::{traits::{Zero, Saturating}, Perbill};

	/// 货币类型别名
	type BalanceOf<T> =
		<<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

	/// ## 押金用途枚举
	///
	/// 定义押金的具体用途，用于分类和追溯。
	#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[codec(mel_bound())]
	pub enum DepositPurpose {
		/// 申诉押金
		///
		/// 参数：
		/// - appeal_id: 申诉ID
		/// - domain: 申诉域（1=grave, 2=deceased等）
		/// - target: 目标对象ID
		/// - action: 操作类型
		Appeal { appeal_id: u64, domain: u8, target: u64, action: u8 },

		/// 供奉品审核押金
		///
		/// 参数：
		/// - offering_id: 供奉品ID
		/// - kind_code: 供奉品类型码
		OfferingReview { offering_id: u64, kind_code: u8 },

		/// 文本投诉押金
		///
		/// 参数：
		/// - text_id: 文本ID
		/// - complaint_type: 投诉类型（20=删除生平, 21=删除悼词等）
		TextComplaint { text_id: u64, complaint_type: u8 },

		/// 媒体投诉押金
		///
		/// 参数：
		/// - media_id: 媒体ID
		/// - complaint_type: 投诉类型（30=隐藏媒体, 31=替换URI等）
		MediaComplaint { media_id: u64, complaint_type: u8 },

		/// 自定义用途（预留扩展）
		///
		/// 参数：
		/// - pallet_name: 模块名称
		/// - purpose_id: 用途ID
		/// - metadata: 元数据
		Custom {
			pallet_name: BoundedVec<u8, ConstU32<32>>,
			purpose_id: u64,
			metadata: BoundedVec<u8, ConstU32<128>>,
		},
	}

	/// ## 押金状态枚举
	///
	/// 定义押金的当前状态。
	#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	pub enum DepositStatus<T: Config> {
		/// 已冻结（初始状态）
		Reserved,
		/// 已释放（全额退回）
		Released,
		/// 已全部罚没
		Slashed,
		/// 已部分罚没
		///
		/// 参数：
		/// - amount: 罚没金额
		PartiallySlashed { amount: BalanceOf<T> },
	}

	impl<T: Config> Default for DepositStatus<T> {
		fn default() -> Self {
			Self::Reserved
		}
	}

	/// ## 押金记录结构
	///
	/// 存储单个押金的完整信息。
	#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
	#[scale_info(skip_type_params(T))]
	pub struct DepositRecord<T: Config> {
		/// 押金提供者
		pub who: T::AccountId,
		/// 押金金额
		pub amount: BalanceOf<T>,
		/// 押金用途
		pub purpose: DepositPurpose,
		/// 冻结时间（块号）
		pub reserved_at: BlockNumberFor<T>,
		/// 当前状态
		pub status: DepositStatus<T>,
		/// 释放时间（可选）
		pub released_at: Option<BlockNumberFor<T>>,
		/// 罚没时间（可选）
		pub slashed_at: Option<BlockNumberFor<T>>,
	}

	/// ## Pallet配置Trait
	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// 事件类型
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

		/// 货币类型（MEMO）
		type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

		/// 释放押金的权限
		///
		/// 通常为Root或特定的治理模块
		type ReleaseOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// 罚没押金的权限
		///
		/// 通常为Root或特定的治理模块
		type SlashOrigin: EnsureOrigin<Self::RuntimeOrigin>;

		/// 每个账户最多可持有的押金数量
		#[pallet::constant]
		type MaxDepositsPerAccount: Get<u32>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// ## 存储：下一个押金ID
	///
	/// 用于生成唯一的押金ID。
	#[pallet::storage]
	#[pallet::getter(fn next_deposit_id)]
	pub type NextDepositId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// ## 存储：押金记录
	///
	/// 存储所有押金的详细信息。
	///
	/// Key: deposit_id
	/// Value: DepositRecord
	#[pallet::storage]
	#[pallet::getter(fn deposits)]
	pub type Deposits<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64, // deposit_id
		DepositRecord<T>,
		OptionQuery,
	>;

	/// ## 存储：账户押金索引
	///
	/// 存储每个账户的押金ID列表，用于快速查询。
	///
	/// Key: AccountId
	/// Value: BoundedVec<deposit_id>
	#[pallet::storage]
	#[pallet::getter(fn deposits_by_account)]
	pub type DepositsByAccount<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<u64, T::MaxDepositsPerAccount>,
		ValueQuery,
	>;

	/// ## 事件
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 押金已冻结
		///
		/// 参数：
		/// - deposit_id: 押金ID
		/// - who: 押金提供者
		/// - amount: 押金金额
		/// 
		/// 注：可通过deposit_id查询完整的押金详情（包括purpose）
		DepositReserved {
			deposit_id: u64,
			who: T::AccountId,
			amount: BalanceOf<T>,
		},

		/// 押金已释放（全额退回）
		///
		/// 参数：
		/// - deposit_id: 押金ID
		/// - who: 押金提供者
		/// - amount: 退回金额
		DepositReleased { deposit_id: u64, who: T::AccountId, amount: BalanceOf<T> },

		/// 押金已罚没
		///
		/// 参数：
		/// - deposit_id: 押金ID
		/// - who: 押金提供者
		/// - slashed: 罚没金额
		/// - refunded: 退回金额
		/// - beneficiary: 罚没接收者
		DepositSlashed {
			deposit_id: u64,
			who: T::AccountId,
			slashed: BalanceOf<T>,
			refunded: BalanceOf<T>,
			beneficiary: T::AccountId,
		},
	}

	/// ## 错误
	#[pallet::error]
	pub enum Error<T> {
		/// 押金记录不存在
		DepositNotFound,
		/// 押金状态无效（如已释放的押金无法再次释放）
		InvalidStatus,
		/// 账户押金数量已达上限
		TooManyDeposits,
		/// 余额不足
		InsufficientBalance,
	}

	/// ## 可调用函数（Extrinsics）
	/// 
	/// **注意**：pallet-deposits作为底层服务模块，主要通过DepositManager trait被其他pallet调用。
	/// 暂不直接暴露extrinsics，避免复杂类型的codec问题。
	/// 用户通过使用pallet-deposits的上层pallet（如pallet-memo-content-governance）间接使用押金功能。
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/* Extrinsics暂时注释，使用DepositManager trait替代
		
		// 原reserve_deposit, release_deposit, slash_deposit已移至DepositManager trait
		// 其他pallet通过trait调用，避免extrinsic参数的codec问题
		/// ### 冻结押金
		///
		/// 将指定金额的资金从用户账户冻结作为押金。
		///
		/// **权限**：任何签名账户
		///
		/// **参数**：
		/// - `origin`: 押金提供者
		/// - `purpose`: 押金用途
		/// - `amount`: 押金金额
		///
		/// **返回**：
		/// - `DispatchResult`
		///
		/// **事件**：
		/// - `DepositReserved`
		///
		/// **错误**：
		/// - `InsufficientBalance`: 余额不足
		/// - `TooManyDeposits`: 账户押金数量已达上限
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn reserve_deposit(
			origin: OriginFor<T>,
			purpose: DepositPurpose,
			amount: BalanceOf<T>,
		) -> DispatchResult {
			// 1. 验证签名
			let who = ensure_signed(origin)?;

			// 2. 检查余额
			ensure!(
				T::Currency::can_reserve(&who, amount),
				Error::<T>::InsufficientBalance
			);

			// 3. 冻结押金
			T::Currency::reserve(&who, amount)?;

			// 4. 生成押金ID
			let deposit_id = NextDepositId::<T>::get();
			NextDepositId::<T>::put(deposit_id.saturating_add(1));

			// 5. 创建押金记录
			let record = DepositRecord {
				who: who.clone(),
				amount,
				purpose: purpose.clone(),
				reserved_at: <frame_system::Pallet<T>>::block_number(),
				status: DepositStatus::Reserved,
				released_at: None,
				slashed_at: None,
			};

			Deposits::<T>::insert(deposit_id, record);

			// 6. 更新账户索引
			DepositsByAccount::<T>::try_mutate(&who, |ids| -> DispatchResult {
				ids.try_push(deposit_id).map_err(|_| Error::<T>::TooManyDeposits)?;
				Ok(())
			})?;

			// 7. 发送事件
			Self::deposit_event(Event::DepositReserved { deposit_id, who, amount });

			Ok(())
		}
		*/
		
		// TODO: 未来可添加管理性extrinsics（如批量操作、紧急暂停等）

		/// ### 占位函数（保持pallet::call有效）
		/// 
		/// 此函数仅用于保持#[pallet::call]块有效。
		/// 真正的押金操作通过DepositManager trait实现，被其他pallet调用。
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn placeholder(_origin: OriginFor<T>) -> DispatchResult {
			// This is a placeholder extrinsic to keep the #[pallet::call] block valid
			// Actual deposit operations are performed through the DepositManager trait
			Err(Error::<T>::DepositNotFound.into())
		}
	}

	/// ## DepositManager Trait
	///
	/// 提供给其他pallet调用的trait接口。
	pub trait DepositManager<AccountId, Balance> {
		/// 冻结押金
		///
		/// 返回押金ID
		fn reserve(
			who: &AccountId,
			amount: Balance,
			purpose: DepositPurpose,
		) -> Result<u64, DispatchError>;

		/// 释放押金
		fn release(deposit_id: u64) -> DispatchResult;

		/// 罚没押金
		fn slash(
			deposit_id: u64,
			ratio: Perbill,
			beneficiary: &AccountId,
		) -> DispatchResult;
	}

	/// DepositManager trait的实现
	impl<T: Config> DepositManager<T::AccountId, BalanceOf<T>> for Pallet<T> {
		fn reserve(
			who: &T::AccountId,
			amount: BalanceOf<T>,
			purpose: DepositPurpose,
		) -> Result<u64, DispatchError> {
			// 检查余额
			ensure!(
				T::Currency::can_reserve(who, amount),
				Error::<T>::InsufficientBalance
			);

			// 冻结押金
			T::Currency::reserve(who, amount)?;

			// 生成押金ID
			let deposit_id = NextDepositId::<T>::get();
			NextDepositId::<T>::put(deposit_id.saturating_add(1));

			// 创建押金记录
			let record = DepositRecord {
				who: who.clone(),
				amount,
				purpose: purpose.clone(),
				reserved_at: <frame_system::Pallet<T>>::block_number(),
				status: DepositStatus::Reserved,
				released_at: None,
				slashed_at: None,
			};

			Deposits::<T>::insert(deposit_id, record);

			// 更新账户索引
			DepositsByAccount::<T>::try_mutate(who, |ids| -> DispatchResult {
				ids.try_push(deposit_id).map_err(|_| Error::<T>::TooManyDeposits)?;
				Ok(())
			})?;

			// 发送事件
			Self::deposit_event(Event::DepositReserved {
				deposit_id,
				who: who.clone(),
				amount,
			});

			Ok(deposit_id)
		}

		fn release(deposit_id: u64) -> DispatchResult {
			Deposits::<T>::try_mutate(deposit_id, |maybe_record| -> DispatchResult {
				let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
				ensure!(record.status == DepositStatus::Reserved, Error::<T>::InvalidStatus);

				T::Currency::unreserve(&record.who, record.amount);
				record.status = DepositStatus::Released;
				record.released_at = Some(<frame_system::Pallet<T>>::block_number());

				Self::deposit_event(Event::DepositReleased {
					deposit_id,
					who: record.who.clone(),
					amount: record.amount,
				});

				Ok(())
			})
		}

		fn slash(
			deposit_id: u64,
			slash_ratio: Perbill,
			beneficiary: &T::AccountId,
		) -> DispatchResult {
			Deposits::<T>::try_mutate(deposit_id, |maybe_record| -> DispatchResult {
				let record = maybe_record.as_mut().ok_or(Error::<T>::DepositNotFound)?;
				ensure!(record.status == DepositStatus::Reserved, Error::<T>::InvalidStatus);

				let slash_amount = slash_ratio * record.amount;
				let refund_amount = record.amount.saturating_sub(slash_amount);

				T::Currency::unreserve(&record.who, record.amount);

				if !slash_amount.is_zero() {
					T::Currency::transfer(
						&record.who,
						beneficiary,
						slash_amount,
						ExistenceRequirement::KeepAlive,
					)?;
				}

				record.status = if refund_amount.is_zero() {
					DepositStatus::Slashed
				} else {
					DepositStatus::PartiallySlashed { amount: slash_amount }
				};
				record.slashed_at = Some(<frame_system::Pallet<T>>::block_number());

				Self::deposit_event(Event::DepositSlashed {
					deposit_id,
					who: record.who.clone(),
					slashed: slash_amount,
					refunded: refund_amount,
					beneficiary: beneficiary.clone(),
				});

				Ok(())
			})
		}
	}
}

