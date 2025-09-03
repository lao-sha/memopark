#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use sp_runtime::traits::{AtLeast32BitUnsigned, SaturatedConversion, Saturating};

#[frame_support::pallet]
pub mod pallet {
	use super::*;

	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// 事件类型
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		/// 墓位 ID 类型（与 pallet-memo-grave 对齐）
		type GraveId: Parameter + Member + Copy + MaxEncodedLen;
		/// 链上余额类型（与 Runtime::Balance 对齐）
		type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
		/// 一周包含的区块数（用于“有效供奉周期”判定，按周粒度）
		#[pallet::constant]
		type BlocksPerWeek: Get<u32>;
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	// ===== 最小必要存储：累计次数 / 累计金额 / 周活跃标记 =====

	#[pallet::storage]
	#[pallet::getter(fn totals_by_grave)]
	/// 函数级中文注释：每墓位累计供奉次数
	pub type TotalsByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, u64, ValueQuery>;

	#[pallet::storage]
	#[pallet::getter(fn total_memo_by_grave)]
	/// 函数级中文注释：每墓位累计 MEMO 金额
	pub type TotalMemoByGrave<T: Config> =
		StorageMap<_, Blake2_128Concat, T::GraveId, T::Balance, ValueQuery>;

	#[pallet::storage]
	#[pallet::getter(fn weekly_active)]
	/// 函数级中文注释：按周维度的“有效供奉”标记。
	/// - 维度：(grave_id, who, week_index) → ()
	/// - week_index = floor(block_number / BlocksPerWeek)
	/// - 仅在存在有效供奉时写入键；无效时无键，节省存储。
	pub type WeeklyActive<T: Config> =
		StorageMap<_, Blake2_128Concat, (T::GraveId, T::AccountId, u64), (), OptionQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 已标记某账户在某墓位的连续周有效供奉（从 start_week 起连续 weeks 周）
		WeeklyActiveMarked(T::GraveId, T::AccountId, u64, u32),
	}

	#[pallet::error]
	pub enum Error<T> {}

	impl<T: Config> Pallet<T> {
		/// 函数级中文注释：供 Hook 调用的内部记录方法（精简版）。
		/// - 仅维护累计计数与累计金额；不再存储明细、Top 排行与分类型统计；
		/// - amount 为本次落账的 MEMO 金额（若无转账则为 None）。
		/// - kind_code/memo 仅用于兼容旧 Hook 签名，不做链上存储。
		pub fn record_from_hook_with_amount(
			grave_id: T::GraveId,
			_who: T::AccountId,
			_kind_code: u8,
			amount: Option<T::Balance>,
			_memo: Option<alloc::vec::Vec<u8>>,
		) {
			TotalsByGrave::<T>::mutate(grave_id, |c| *c = c.saturating_add(1));
			if let Some(amt) = amount {
				TotalMemoByGrave::<T>::mutate(grave_id, |b| *b = b.saturating_add(amt));
			}
		}

		/// 兼容旧接口：无金额
		pub fn record_from_hook(
			grave_id: T::GraveId,
			who: T::AccountId,
			kind_code: u8,
			memo: Option<alloc::vec::Vec<u8>>,
		) {
			Self::record_from_hook_with_amount(grave_id, who, kind_code, None, memo)
		}

		/// 函数级中文注释：按“周”为粒度，标记有效供奉周期。
		/// - start_block：供奉发生时的区块号；
		/// - duration_weeks：若为 Timed 供奉则为 Some(w)，否则 None（Instant 仅标记当周）。
		/// - 该方法只做标记，不做资金变动；用于后续统计/计酬的只读判定。
		pub fn mark_weekly_active(
			grave_id: T::GraveId,
			who: T::AccountId,
			start_block: BlockNumberFor<T>,
			duration_weeks: Option<u32>,
		) {
			let bpw = T::BlocksPerWeek::get() as u128;
			let start_bn: u128 = start_block.saturated_into::<u128>();
			let start_week: u64 = (start_bn / bpw) as u64;
			let weeks: u32 = duration_weeks.unwrap_or(1);
			for i in 0..weeks {
				let week_idx = start_week.saturating_add(i as u64);
				WeeklyActive::<T>::insert((grave_id, who.clone(), week_idx), ());
			}
			Self::deposit_event(Event::WeeklyActiveMarked(grave_id, who, start_week, weeks));
		}

		/// 函数级中文注释：查询某账户在某墓位的指定周是否存在有效供奉。
		pub fn is_week_active(grave_id: T::GraveId, who: &T::AccountId, week_index: u64) -> bool {
			WeeklyActive::<T>::contains_key((grave_id, who.clone(), week_index))
		}

		/// 函数级中文注释：查询某账户在“当前周”是否存在有效供奉（便于跨 pallet 判定）。
		pub fn is_current_week_active(grave_id: T::GraveId, who: &T::AccountId) -> bool {
			let now = <frame_system::Pallet<T>>::block_number();
			let bpw = T::BlocksPerWeek::get() as u128;
			let week_idx = (now.saturated_into::<u128>() / bpw) as u64;
			Self::is_week_active(grave_id, who, week_idx)
		}
	}
}


