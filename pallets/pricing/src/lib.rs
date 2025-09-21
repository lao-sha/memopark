#![cfg_attr(not(feature = "std"), no_std)]

/// 函数级中文注释：价格提供者通用 trait
/// - 仅负责读价与状态判断；不触碰资金。
pub trait PriceProvider {
	/// 函数级中文注释：返回当前报价（分子/分母/时间戳）；None 表示暂不可用
	fn current_price() -> Option<(u128, u128, u64)>;
	/// 函数级中文注释：基于链上 now 与 staleness 配置判断是否陈旧
	fn is_stale(now_seconds: u64) -> bool;
}

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
	use frame_support::{
		pallet_prelude::*,
		traits::Get,
	};
	use frame_system::pallet_prelude::*;
    use sp_runtime::traits::SaturatedConversion;
    use sp_std::vec::Vec;

	#[pallet::config]
    pub trait Config: frame_system::Config {
		/// 函数级中文注释：事件类型绑定到运行时事件
		#[allow(deprecated)]
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
		/// 函数级中文注释：最大喂价账户数上限（用于 Feeders BoundedVec 容量）
		type MaxFeeders: Get<u32>;
	}

    /// 函数级中文注释：将当前区块号按 6 秒/块估算为秒数（无需依赖 timestamp）。
    fn now_seconds<T: Config>() -> u64 {
        <frame_system::Pallet<T>>::block_number().saturated_into::<u64>() * 6
    }

	#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
	pub struct SpotPrice {
		/// 函数级中文注释：价格分子（ETH/MEMO 的 ETH 数量分子，定点比率）
		pub price_num: u128,
		/// 函数级中文注释：价格分母（ETH/MEMO 的 MEMO 数量分母，定点比率）
		pub price_den: u128,
		/// 函数级中文注释：上次更新时间（秒）
		pub last_updated: u64,
	}

	#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
	pub struct Params {
		/// 函数级中文注释：价格过期阈值（秒）；超过视为陈旧
		pub stale_seconds: u32,
		/// 函数级中文注释：单次跳变上限（万分比）。0 表示不限制。
		pub max_jump_bps: u32,
		/// 函数级中文注释：暂停开关（暂停时拒绝 set_price）
		pub paused: bool,
	}

	#[pallet::storage]
	#[pallet::getter(fn price)]
	pub type Price<T> = StorageValue<_, SpotPrice, ValueQuery>;

	#[pallet::storage]
	#[pallet::getter(fn params)]
	pub type PricingParams<T> = StorageValue<_, Params, ValueQuery, DefaultParams>;

	#[pallet::type_value]
	pub fn DefaultParams() -> Params { Params { stale_seconds: 600, max_jump_bps: 5_000, paused: false } }

	#[pallet::storage]
	pub type Feeders<T: Config> = StorageValue<_, BoundedVec<T::AccountId, T::MaxFeeders>, ValueQuery>;

	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// 函数级中文注释：价格更新事件（包含新价格与时间戳）
		PriceUpdated { price_num: u128, price_den: u128, last_updated: u64 },
		/// 函数级中文注释：参数更新事件
		ParamsUpdated { stale_seconds: u32, max_jump_bps: u32 },
		/// 函数级中文注释：喂价账户更新
		FeedersUpdated,
		/// 函数级中文注释：暂停/恢复
		Paused { on: bool },
	}

	#[pallet::error]
	pub enum Error<T> {
		/// 函数级中文注释：当前已暂停
		Paused,
		/// 函数级中文注释：无权限喂价（非治理且非白名单）
		NotAuthorized,
		/// 函数级中文注释：价格跳变超过阈值
		ExcessiveJump,
		/// 函数级中文注释：价格分母为零非法
		ZeroDenominator,
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 函数级中文注释：治理/白名单喂价接口
		/// - 校验：未暂停；若存在旧价且设置了 max_jump_bps>0，则限制单次相对跳变幅度
		/// - 事件：PriceUpdated
		#[pallet::call_index(0)]
		#[allow(deprecated)]
		#[pallet::weight({0})]
        pub fn set_price(origin: OriginFor<T>, price_num: u128, price_den: u128) -> DispatchResult {
            ensure!(price_den != 0, Error::<T>::ZeroDenominator);
            let p = PricingParams::<T>::get();
            ensure!(!p.paused, Error::<T>::Paused);
            // 授权：Root 直接通过；否则要求 Signed 且在 feeders 白名单
            let mut authorized = false;
            if frame_system::EnsureRoot::<T::AccountId>::try_origin(origin.clone()).is_ok() {
                authorized = true;
            } else if let Ok(who) = ensure_signed(origin) {
                let feeders = Feeders::<T>::get();
                if feeders.iter().any(|a| a == &who) { authorized = true; }
            }
            ensure!(authorized, Error::<T>::NotAuthorized);
            // 跳变阈值校验
            let now = now_seconds::<T>();
            let old = Price::<T>::get();
            if p.max_jump_bps > 0 && old.price_den != 0 && old.price_num != 0 {
                // 计算 |new/old - 1| <= max_jump_bps/10000
                // 等价：|new_num*old_den - old_num*new_den| <= old_num*new_den * max_bps / 10000
                let left = if price_num.saturating_mul(old.price_den) >= old.price_num.saturating_mul(price_den) {
                    price_num.saturating_mul(old.price_den).saturating_sub(old.price_num.saturating_mul(price_den))
                } else {
                    old.price_num.saturating_mul(price_den).saturating_sub(price_num.saturating_mul(old.price_den))
                };
                let base = old.price_num.saturating_mul(price_den);
                let right = base.saturating_mul(p.max_jump_bps as u128) / 10_000u128;
                ensure!(left <= right, Error::<T>::ExcessiveJump);
            }
            Price::<T>::put(super::SpotPrice { price_num, price_den, last_updated: now });
            Self::deposit_event(Event::PriceUpdated { price_num, price_den, last_updated: now });
            Ok(())
        }

        /// 函数级中文注释：更新参数（仅 Root）
		#[pallet::call_index(1)]
		#[allow(deprecated)]
		#[pallet::weight({0})]
		pub fn set_params(origin: OriginFor<T>, stale_seconds: u32, max_jump_bps: u32) -> DispatchResult {
			frame_system::EnsureRoot::<T::AccountId>::ensure_origin(origin)?;
			let mut pp = PricingParams::<T>::get();
			pp.stale_seconds = stale_seconds; pp.max_jump_bps = max_jump_bps;
			PricingParams::<T>::put(pp.clone());
			Self::deposit_event(Event::ParamsUpdated { stale_seconds, max_jump_bps });
			Ok(())
		}

        /// 函数级中文注释：设置暂停开关（仅 Root）
		#[pallet::call_index(2)]
		#[allow(deprecated)]
		#[pallet::weight({0})]
		pub fn set_pause(origin: OriginFor<T>, on: bool) -> DispatchResult {
			frame_system::EnsureRoot::<T::AccountId>::ensure_origin(origin)?;
			let mut pp = PricingParams::<T>::get(); pp.paused = on; PricingParams::<T>::put(pp);
			Self::deposit_event(Event::Paused { on });
			Ok(())
		}

        /// 函数级中文注释：维护喂价白名单（仅 Root）
		#[pallet::call_index(3)]
		#[allow(deprecated)]
		#[pallet::weight({0})]
		pub fn set_feeders(origin: OriginFor<T>, feeders: Vec<T::AccountId>) -> DispatchResult {
			frame_system::EnsureRoot::<T::AccountId>::ensure_origin(origin)?;
			let mut bv: BoundedVec<T::AccountId, T::MaxFeeders> = BoundedVec::default();
			for a in feeders { let _ = bv.try_push(a); }
			Feeders::<T>::put(bv);
			Self::deposit_event(Event::FeedersUpdated);
			Ok(())
		}
	}

	impl<T: Config> super::PriceProvider for Pallet<T> {
		/// 函数级中文注释：返回当前报价（若尚未设置则返回 None）
		fn current_price() -> Option<(u128, u128, u64)> {
			let p = Price::<T>::get();
			if p.price_den == 0 || p.price_num == 0 { None } else { Some((p.price_num, p.price_den, p.last_updated)) }
		}
		/// 函数级中文注释：判断是否陈旧：`now - last_updated > stale_seconds`
		fn is_stale(now_seconds: u64) -> bool {
			let pp = PricingParams::<T>::get();
			let pr = Price::<T>::get();
			if pr.last_updated == 0 { return true; }
			let stale = pp.stale_seconds as u64;
			now_seconds.saturating_sub(pr.last_updated) > stale
		}
	}
}


