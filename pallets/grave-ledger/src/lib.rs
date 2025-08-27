#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;

use frame_support::{pallet_prelude::*, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::SaturatedConversion;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use sp_runtime::traits::AtLeast32BitUnsigned;
    use alloc::vec::Vec;
    use core::{fmt, cmp};
    use sp_runtime::Saturating;

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
        /// 链上余额类型（与 Runtime::Balance 对齐）
        type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen + fmt::Debug + cmp::Ord;
        /// 每个墓位保留的最近日志条数上限
        #[pallet::constant]
        type MaxRecentPerGrave: Get<u32>;
        /// 备注长度上限
        #[pallet::constant]
        type MaxMemoLen: Get<u32>;
        /// TopN 排行缓存大小
        #[pallet::constant]
        type MaxTopGraves: Get<u32>;
        /// 一周包含的区块数（用于“有效供奉周期”判定，按周粒度）
        #[pallet::constant]
        type BlocksPerWeek: Get<u32>;
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

    #[pallet::storage]
    #[pallet::getter(fn total_memo_by_grave)]
    /// 每墓位累计 MEMO 金额
    pub type TotalMemoByGrave<T: Config> = StorageMap<_, Blake2_128Concat, T::GraveId, T::Balance, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn total_memo_by_grave_user)]
    /// 每墓位按用户累计 MEMO 金额：(GraveId, AccountId) -> Balance
    pub type TotalMemoByGraveUser<T: Config> = StorageMap<_, Blake2_128Concat, (T::GraveId, T::AccountId), T::Balance, ValueQuery>;

    /// Top 排行条目
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct TopEntry<GraveId, Balance> { pub grave_id: GraveId, pub total: Balance }

    #[pallet::storage]
    #[pallet::getter(fn top_graves)]
    /// 全局 TopN：按累计 MEMO 降序
    pub type TopGraves<T: Config> = StorageValue<_, BoundedVec<TopEntry<T::GraveId, T::Balance>, T::MaxTopGraves>, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn weekly_active)]
    /// 函数级中文注释：按周维度的“有效供奉”标记。
    /// - 维度：(grave_id, who, week_index) → ()
    /// - week_index = floor(block_number / BlocksPerWeek)
    /// - 仅在存在有效供奉时写入键；无效时无键，节省存储。
    pub type WeeklyActive<T: Config> = StorageMap<_, Blake2_128Concat, (T::GraveId, T::AccountId, u64), (), OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 已记录一笔供奉 (grave_id, log_id, who, kind_code)
        OfferingLogged(T::GraveId, u64, T::AccountId, u8),
        /// 已清理历史 (grave_id, kept)
        Pruned(T::GraveId, u32),
        /// TopN 已更新（简要事件，便于索引器感知）
        TopUpdated,
        /// 已标记某账户在某墓位的连续周有效供奉（从 start_week 起连续 weeks 周）
        WeeklyActiveMarked(T::GraveId, T::AccountId, u64, u32),
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
        /// - amount 为本次落账的 MEMO 金额（若无转账则为 None）。
        pub fn record_from_hook_with_amount(grave_id: T::GraveId, who: T::AccountId, kind_code: u8, amount: Option<T::Balance>, memo: Option<Vec<u8>>) {
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

            // 如有金额，累计金额并维护 TopN
            if let Some(amt) = amount {
                TotalMemoByGrave::<T>::mutate(grave_id, |b| *b = b.saturating_add(amt));
                TotalMemoByGraveUser::<T>::mutate((grave_id, who.clone()), |b| *b = b.saturating_add(amt));
                let total = TotalMemoByGrave::<T>::get(grave_id);
                Self::upsert_top(grave_id, total);
                Self::deposit_event(Event::TopUpdated);
            }

            Self::deposit_event(Event::OfferingLogged(grave_id, log_id, who, kind_code));
        }

        /// 函数级中文注释：按“周”为粒度，标记有效供奉周期。
        /// - start_block：供奉发生时的区块号；
        /// - duration_weeks：若为 Timed 供奉则为 Some(w)，否则 None（Instant 仅标记当周）。
        /// - 该方法只做标记，不做资金变动；用于后续统计结算。
        pub fn mark_weekly_active(grave_id: T::GraveId, who: T::AccountId, start_block: BlockNumberFor<T>, duration_weeks: Option<u32>) {
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

        /// 兼容旧接口：无金额
        pub fn record_from_hook(grave_id: T::GraveId, who: T::AccountId, kind_code: u8, memo: Option<Vec<u8>>) {
            Self::record_from_hook_with_amount(grave_id, who, kind_code, None, memo)
        }

        /// 函数级中文注释：维护 TopN 列表（按累计金额降序，容量受限）。
        fn upsert_top(grave_id: T::GraveId, total: T::Balance) {
            let mut list = TopGraves::<T>::get();
            if let Some(pos) = list.iter().position(|e| e.grave_id == grave_id) {
                list[pos].total = total;
            } else {
                let _ = list.try_push(TopEntry { grave_id, total });
            }
            // 降序排序
            let mut v = list.into_inner();
            v.sort_by(|a, b| b.total.cmp(&a.total));
            // 重新装回受限向量（已排序）
            let mut out: BoundedVec<_, T::MaxTopGraves> = Default::default();
            for e in v.into_iter() { let _ = out.try_push(e); }
            list = out;
            // 截断到最大容量
            let max = T::MaxTopGraves::get() as usize;
            if list.len() > max { list.truncate(max); }
            TopGraves::<T>::put(list);
        }
    }
}


