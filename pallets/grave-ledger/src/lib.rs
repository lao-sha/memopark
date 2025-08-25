#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    /// 函数级中文注释：供奉日志实体，仅保留最小必要信息与可选 memo 指针（CID）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct LogEntry<T: Config> {
        /// 供奉目标墓位 ID
        pub grave_id: T::GraveId,
        /// 发起供奉的账户
        pub who: T::AccountId,
        /// 供奉品类型编码（由 memorial-offerings 定义）
        pub kind_code: u8,
        /// 供奉发生的区块号
        pub block: BlockNumberFor<T>,
        /// 可选备注/外链（建议为 CID/URL 指针而非明文敏感信息）
        pub memo: Option<BoundedVec<u8, T::MaxMemoLen>>,
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 墓位 ID 类型（与 pallet-grave 对齐）
        type GraveId: Parameter + Member + Copy + MaxEncodedLen;
        /// 每个墓位保留的最近日志条数上限
        #[pallet::constant]
        type MaxRecentPerGrave: Get<u32>;
        /// 备注长度上限
        #[pallet::constant]
        type MaxMemoLen: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    #[pallet::getter(fn next_log_id)]
    /// 下一条日志 ID（自增）
    pub type NextLogId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn log_of)]
    /// 日志详情：LogId -> LogEntry
    pub type LogOf<T: Config> = StorageMap<_, Blake2_128Concat, u64, LogEntry<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn recent_by_grave)]
    /// 每墓位最近日志：GraveId -> BoundedVec<LogId>
    pub type RecentByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, BoundedVec<u64, T::MaxRecentPerGrave>, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn totals_by_grave)]
    /// 每墓位累计供奉次数
    pub type TotalsByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, u64, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn totals_by_grave_kind)]
    /// 每墓位按类型累计供奉次数： (GraveId, kind_code) -> count
    pub type TotalsByGraveKind<T: Config> = StorageMap<_, Blake2_128Concat, (T::GraveId, u8), u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 已记录一笔供奉 (grave_id, log_id, who, kind_code)
        OfferingLogged(T::GraveId, u64, T::AccountId, u8),
        /// 已清理历史 (grave_id, kept)
        Pruned(T::GraveId, u32),
    }

    #[pallet::error]
    pub enum Error<T> { BadInput }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：清理某墓位最近日志，仅保留 keep_last 条；Root/管理员调用。
        #[pallet::weight(10_000)]
        pub fn prune_grave(origin: OriginFor<T>, grave_id: T::GraveId, keep_last: u32) -> DispatchResult {
            ensure_root(origin)?;
            let mut v = RecentByGrave::<T>::get(grave_id);
            if (v.len() as u32) > keep_last {
                let to_remove = (v.len() as u32) - keep_last;
                for _ in 0..to_remove { let _ = v.pop(); }
                RecentByGrave::<T>::insert(grave_id, v);
            }
            Self::deposit_event(Event::Pruned(grave_id, keep_last));
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：供 Hook 调用的内部记录方法。
        /// - 仅供 runtime 中的 OnOffering Hook 调用；
        /// - 记录最小必要信息，维护最近 N 条与分类累计计数；
        /// - 不做资金逻辑，保障 MEMO 安全。
        pub fn record_from_hook(grave_id: T::GraveId, who: T::AccountId, kind_code: u8, memo: Option<Vec<u8>>) {
            let now = <frame_system::Pallet<T>>::block_number();
            let log_id = NextLogId::<T>::mutate(|n| { let id = *n; *n = n.saturating_add(1); id });
            let memo_bv = memo.and_then(|m| BoundedVec::<u8, T::MaxMemoLen>::try_from(m).ok());
            let entry = LogEntry::<T> { grave_id, who: who.clone(), kind_code, block: now, memo: memo_bv };
            LogOf::<T>::insert(log_id, entry);

            RecentByGrave::<T>::mutate(grave_id, |list| {
                // 将最新事件放在列表前端；若超出上限，移除最旧（尾部）
                if list.try_insert(0, log_id).is_err() {
                    let _ = list.pop();
                    let _ = list.try_insert(0, log_id);
                }
            });

            TotalsByGrave::<T>::mutate(grave_id, |c| *c = c.saturating_add(1));
            TotalsByGraveKind::<T>::mutate((grave_id, kind_code), |c| *c = c.saturating_add(1));

            Self::deposit_event(Event::OfferingLogged(grave_id, log_id, who, kind_code));
        }
    }
}


