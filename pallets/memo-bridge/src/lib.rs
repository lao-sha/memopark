#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, Get},
        PalletId,
    };
    use frame_system::pallet_prelude::*;
    use pallet_pricing::PriceProvider;
    use sp_runtime::{traits::{Saturating, Zero, AccountIdConversion, SaturatedConversion}, Perbill};
    use sp_std::vec::Vec;

    type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 函数级中文注释：事件类型绑定到运行时事件
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 函数级中文注释：用于锁定/解锁 MEMO 的余额货币接口（通常为 pallet-balances）
        type Currency: Currency<Self::AccountId>;
        /// 函数级中文注释：费用收款账户（例如国库 PalletId 派生账户）
        type FeeCollector: Get<Self::AccountId>;
        /// 函数级中文注释：治理起源（Root 或 委员会 2/3），用于参数与暂停控制
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：最低锁定金额（过滤尘额与滥用）
        type MinLock: Get<BalanceOf<Self>>;
        /// 函数级中文注释：桥托管账户 PalletId（用于派生模块账户）
        type BridgePalletId: Get<PalletId>;
        /// 函数级中文注释：价格源接口（解耦到独立 pallet-pricing），仅用于风控与报价保护
        type PriceFeed: pallet_pricing::PriceProvider;
    }

    #[pallet::storage]
    #[pallet::getter(fn params)]
    pub type Params<T: Config> = StorageValue<_, BridgeParams<BalanceOf<T>>, ValueQuery, DefaultParams<T>>;

    #[pallet::storage]
    #[pallet::getter(fn daily_used)]
    pub type DailyUsed<T: Config> = StorageMap<_, Blake2_128Concat, (T::AccountId, u32), BalanceOf<T>, ValueQuery>;

    #[pallet::type_value]
    pub fn DefaultParams<T: Config>() -> BridgeParams<BalanceOf<T>> {
        BridgeParams { single_max: Zero::zero(), daily_max: Zero::zero(), fee_bps: 0, paused: false, single_value_max: 0, daily_value_max: 0 }
    }

    #[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, Default)]
    pub struct BridgeParams<Balance> {
        /// 函数级中文注释：单笔最大额度（0 表示不限制）
        pub single_max: Balance,
        /// 函数级中文注释：每日每账户最大额度（0 表示不限制）
        pub daily_max: Balance,
        /// 函数级中文注释：手续费（万分比），收取于锁定侧，入账 FeeCollector
        pub fee_bps: u16,
        /// 函数级中文注释：紧急暂停开关
        pub paused: bool,
        /// 函数级中文注释：单笔价值上限（估算 ETH 数量，0 表示不限制）
        pub single_value_max: u128,
        /// 函数级中文注释：每日价值上限（估算 ETH 数量，0 表示不限制）
        pub daily_value_max: u128,
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：锁定事件（链上 MEMO → 以太坊 ETH）
        MemoLocked { who: T::AccountId, net_amount: BalanceOf<T>, fee: BalanceOf<T>, eth: Vec<u8> },
        /// 函数级中文注释：解锁事件（以太坊 ETH → 链上 MEMO），仅记录审计
        MemoUnlocked { to: T::AccountId, amount: BalanceOf<T>, evidence: Vec<u8> },
        /// 函数级中文注释：参数更新事件
        ParamsUpdated { single_max: BalanceOf<T>, daily_max: BalanceOf<T>, fee_bps: u16 },
        /// 函数级中文注释：暂停/恢复事件
        Paused { on: bool },
        /// 函数级中文注释：带价格快照与估算 ETH 的锁定事件（保护型）
        MemoLockedWithQuote { who: T::AccountId, net_amount: BalanceOf<T>, fee: BalanceOf<T>, eth: Vec<u8>, price_num: u128, price_den: u128, quote_eth_out: u128 },
        /// 函数级中文注释：价值限额更新事件
        ValueLimitsUpdated { single_value_max: u128, daily_value_max: u128 },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 函数级中文注释：当前已暂停
        Paused,
        /// 函数级中文注释：金额过小（小于最小锁定额）
        TooSmall,
        /// 函数级中文注释：超过单笔上限
        ExceedSingleMax,
        /// 函数级中文注释：超过当日上限
        ExceedDailyMax,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // 追加方法应并入同一 #[pallet::call] 实现块
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：锁定 MEMO 并记录以太坊地址，供桥服务在 ETH 侧出金
        /// - 参数：`amount` 锁定金额；`eth_address` 以太坊地址字节（不校验内容，由桥服务二次校验）
        /// - 约束：未暂停；`amount ≥ MinLock`；不超过单笔与当日限额；按费率扣除 fee 收入 FeeCollector
        /// - 事件：`MemoLocked { who, net_amount, fee, eth }`
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight({0})]
        pub fn lock_memo(origin: OriginFor<T>, amount: BalanceOf<T>, eth_address: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let p = Params::<T>::get();
            ensure!(!p.paused, Error::<T>::Paused);
            ensure!(amount >= T::MinLock::get(), Error::<T>::TooSmall);
            if !p.single_max.is_zero() { ensure!(amount <= p.single_max, Error::<T>::ExceedSingleMax); }

            let day = <frame_system::Pallet<T>>::block_number().saturated_into::<u64>() / 14_400; // 粗略以天为单位（6s 区块→约 14400/天）
            let key = (who.clone(), day as u32);
            let used = DailyUsed::<T>::get(&key);
            if !p.daily_max.is_zero() { ensure!(used.saturating_add(amount) <= p.daily_max, Error::<T>::ExceedDailyMax); }

            // 计算手续费
            // 将 bps(万分比) 转为 perbill（十亿分比）：bps * 100_000
            let per = Perbill::from_parts((p.fee_bps as u32).saturating_mul(100_000));
            let fee: BalanceOf<T> = per.mul_floor(amount);
            let net = amount.saturating_sub(fee);

            // 转入托管（本 Pallet 账户）
            let pallet_acc = <Pallet<T>>::account_id();
            <T as Config>::Currency::transfer(&who, &pallet_acc, amount, ExistenceRequirement::KeepAlive)?;
            if !fee.is_zero() {
                <T as Config>::Currency::transfer(&pallet_acc, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive)?;
            }
            DailyUsed::<T>::insert(&key, used.saturating_add(amount));
            Self::deposit_event(Event::MemoLocked { who, net_amount: net, fee, eth: eth_address });
            Ok(())
        }

        /// 函数级中文注释：解锁 MEMO（ETH→MEMO 方向），由治理/多签调用
        /// - 参数：`to` 收款账户；`amount` 金额；`evidence_cid` 证据（ETH tx 哈希/CID）
        /// - 事件：`MemoUnlocked { to, amount, evidence }`
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight({0})]
        pub fn unlock_memo(origin: OriginFor<T>, to: T::AccountId, amount: BalanceOf<T>, evidence_cid: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let pallet_acc = <Pallet<T>>::account_id();
            <T as Config>::Currency::transfer(&pallet_acc, &to, amount, ExistenceRequirement::AllowDeath)?;
            Self::deposit_event(Event::MemoUnlocked { to, amount, evidence: evidence_cid });
            Ok(())
        }

        /// 函数级中文注释：更新风控参数（单笔/日限与费率）
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight({0})]
        pub fn set_params(origin: OriginFor<T>, single_max: BalanceOf<T>, daily_max: BalanceOf<T>, fee_bps: u16) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let old = Params::<T>::get();
            Params::<T>::put(BridgeParams { single_max, daily_max, fee_bps, paused: old.paused, single_value_max: old.single_value_max, daily_value_max: old.daily_value_max });
            Self::deposit_event(Event::ParamsUpdated { single_max, daily_max, fee_bps });
            Ok(())
        }

        /// 函数级中文注释：设置紧急暂停开关
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight({0})]
        pub fn set_pause(origin: OriginFor<T>, on: bool) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut p = Params::<T>::get();
            p.paused = on;
            Params::<T>::put(p);
            Self::deposit_event(Event::Paused { on });
            Ok(())
        }

        /// 函数级中文注释：设置按价值的单笔/日上限（单位：估算 ETH 数量）
        /// - 仅治理可调；0 表示不限制
        /// - 事件：ValueLimitsUpdated
        #[pallet::call_index(5)]
        #[allow(deprecated)]
        #[pallet::weight({0})]
        pub fn set_value_limits(origin: OriginFor<T>, single_value_max: u128, daily_value_max: u128) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut p = Params::<T>::get();
            p.single_value_max = single_value_max;
            p.daily_value_max = daily_value_max;
            Params::<T>::put(p);
            Self::deposit_event(Event::ValueLimitsUpdated { single_value_max, daily_value_max });
            Ok(())
        }

        /// 函数级中文注释：带最小可得 ETH 保护的锁定接口
        /// - 读取价格源并检查陈旧性；按净额估算 ETH 并校验 `min_eth_out`
        /// - 可选按“价值”做单笔/日上限
        #[pallet::call_index(4)]
        #[allow(deprecated)]
        #[pallet::weight({0})]
        pub fn lock_memo_with_protection(origin: OriginFor<T>, amount: BalanceOf<T>, eth_address: Vec<u8>, min_eth_out: u128) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let p = Params::<T>::get();
            ensure!(!p.paused, Error::<T>::Paused);
            ensure!(amount >= T::MinLock::get(), Error::<T>::TooSmall);
            if !p.single_max.is_zero() { ensure!(amount <= p.single_max, Error::<T>::ExceedSingleMax); }

            // 价格读取与陈旧性检查
            let (num, den, ts) = T::PriceFeed::current_price().ok_or(sp_runtime::DispatchError::Other("NoPrice"))?;
            let now_secs = <frame_system::Pallet<T>>::block_number().saturated_into::<u64>() * 6;
            ensure!(!T::PriceFeed::is_stale(now_secs), sp_runtime::DispatchError::Other("StalePrice"));

            // 数量与价值限额
            let day = <frame_system::Pallet<T>>::block_number().saturated_into::<u64>() / 14_400;
            let key = (who.clone(), day as u32);
            let used = DailyUsed::<T>::get(&key);
            if !p.daily_max.is_zero() { ensure!(used.saturating_add(amount) <= p.daily_max, Error::<T>::ExceedDailyMax); }

            // 手续费与净额
            let per = Perbill::from_parts((p.fee_bps as u32).saturating_mul(100_000));
            let fee: BalanceOf<T> = per.mul_floor(amount);
            let net = amount.saturating_sub(fee);

            // 估算 ETH（向下取整）
            let net_u128: u128 = net.saturated_into::<u128>();
            let quote_eth_out = net_u128.saturating_mul(num).checked_div(den).unwrap_or(0);
            ensure!(quote_eth_out >= min_eth_out, sp_runtime::DispatchError::Other("SlippageProtection"));

            // 价值风控（可选）
            if p.single_value_max > 0 { ensure!(quote_eth_out <= p.single_value_max, sp_runtime::DispatchError::Other("ExceedSingleValueMax")); }
            if p.daily_value_max > 0 {
                let used_value_u128: u128 = used.saturated_into::<u128>().saturating_mul(num).checked_div(den).unwrap_or(0);
                ensure!(used_value_u128.saturating_add(quote_eth_out) <= p.daily_value_max, sp_runtime::DispatchError::Other("ExceedDailyValueMax"));
            }

            // 资金转移
            let pallet_acc = <Pallet<T>>::account_id();
            <T as Config>::Currency::transfer(&who, &pallet_acc, amount, ExistenceRequirement::KeepAlive)?;
            if !fee.is_zero() {
                <T as Config>::Currency::transfer(&pallet_acc, &T::FeeCollector::get(), fee, ExistenceRequirement::KeepAlive)?;
            }
            DailyUsed::<T>::insert(&key, used.saturating_add(amount));
            let _ = ts;
            Self::deposit_event(Event::MemoLockedWithQuote { who, net_amount: net, fee, eth: eth_address, price_num: num, price_den: den, quote_eth_out });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：本 Pallet 托管账户（由 PalletId 派生），仅用于锁定/解锁资金
        pub fn account_id() -> T::AccountId {
            T::BridgePalletId::get().into_account_truncating()
        }
    }
}


