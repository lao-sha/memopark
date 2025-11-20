#![cfg_attr(not(feature = "std"), no_std)]

//! # Pallet Memorial Space
//!
//! 虚拟纪念空间管理 pallet - 最小可行版本

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use frame_support::pallet_prelude::*;
	use frame_system::pallet_prelude::*;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::config]
	pub trait Config: frame_system::Config {
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
	}

	/// 下一个空间 ID
	#[pallet::storage]
	pub type NextSpaceId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// 空间所有者映射 (space_id => owner)
	#[pallet::storage]
	pub type SpaceOwners<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64,
		T::AccountId,
		OptionQuery,
	>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 纪念空间已创建 [space_id, deceased_id, owner]
		SpaceCreated {
			space_id: u64,
			deceased_id: u64,
			owner: T::AccountId,
		},
	}

	#[pallet::error]
	pub enum Error<T> {
		/// 空间不存在
		SpaceNotFound,
		/// 无权限
		NoPermission,
	}

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 创建纪念空间（占位实现）
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000, 0))]
		pub fn create_space(
			origin: OriginFor<T>,
			deceased_id: u64,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			let space_id = NextSpaceId::<T>::mutate(|id| {
				let current = *id;
				*id = id.saturating_add(1);
				current
			});

			SpaceOwners::<T>::insert(space_id, &who);

			Self::deposit_event(Event::SpaceCreated {
				space_id,
				deceased_id,
				owner: who,
			});

			Ok(())
		}
	}
}
