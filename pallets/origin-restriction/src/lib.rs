#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;

    /// 函数级中文注释：按起源限制调用的“软策略”最小实现。
    /// - 默认放行全部（allow_all=true），避免引入破坏性变更；
    /// - 提供治理开关 `set_global_allow`，为后续细粒度策略预留入口。
    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 函数级中文注释：治理起源（建议 Root/内容治理）。
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级中文注释：Storage 默认值设为 true（放行全部）。
    #[pallet::type_value]
    pub fn DefaultAllow<T: Config>() -> bool { true }

    /// 函数级中文注释：全局放行开关，true=放行全部；false=占位仍放行（后续细化）。
    #[pallet::storage]
    #[pallet::getter(fn global_allow)]
    pub type GlobalAllow<T: Config> = StorageValue<_, bool, ValueQuery, DefaultAllow<T>>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> { PolicyUpdated(bool) }

    #[pallet::error]
    pub enum Error<T> {}

    // 无创世配置：依赖存储默认值（allow_all=true）。

    #[allow(warnings)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：设置全局放行开关。
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn set_global_allow(origin: OriginFor<T>, allow: bool) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;
            GlobalAllow::<T>::put(allow);
            Self::deposit_event(Event::PolicyUpdated(allow));
            Ok(())
        }
    }
}


