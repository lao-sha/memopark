#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

pub use pallet::*;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;
pub mod weights;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use sp_core::H256;
use sp_runtime::traits::{AtLeast32BitUnsigned, SaturatedConversion, Saturating};
// 无需在此引入 Weight；权重接口通过 T::WeightInfo 使用

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use crate::weights::WeightInfo;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 墓位 ID 类型（与 pallet-stardust-grave 对齐）
        type GraveId: Parameter + Member + Copy + MaxEncodedLen;
        /// 链上余额类型（与 Runtime::Balance 对齐）
        type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;
        /// 一周包含的区块数（用于“有效供奉周期”判定，按周粒度）
        #[pallet::constant]
        type BlocksPerWeek: Get<u32>;
        /// 权重信息提供者
        type WeightInfo: weights::WeightInfo;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ===== 最小必要存储：累计次数 / 累计金额 / 周活跃标记 =====

    #[pallet::storage]
    #[pallet::getter(fn totals_by_grave)]
    /// 函数级中文注释：每墓位累计供奉次数
    pub type TotalsByGrave<T: Config> =
        StorageMap<_, Blake2_128Concat, T::GraveId, u64, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn total_memo_by_grave)]
    /// 函数级中文注释：每墓位累计 DUST 金额
    pub type TotalMemoByGrave<T: Config> =
        StorageMap<_, Blake2_128Concat, T::GraveId, T::Balance, ValueQuery>;

    /// 函数级中文注释：去重键集合，避免同一供奉被重复累计。
    /// - 维度：(grave_id, tx_key) → ()；仅当传入去重键时写入。
    #[pallet::storage]
    pub type DedupKeys<T: Config> =
        StorageMap<_, Blake2_128Concat, (T::GraveId, H256), (), OptionQuery>;

    // ========================================
    // 🗑️ 破坏式变更（方案A）：已移除 TotalMemoByDeceased 存储
    // ========================================
    // 原因：不再支持 Deceased 作为供奉目标
    // 如需逝者级统计，可通过 Grave 关联查询

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
        // 🗑️ 破坏式变更（方案A）：已移除 DeceasedOfferingAccumulated 事件
        /// 函数级中文注释：某墓位累计供奉金额已更新（delta 与新累计值）
        GraveOfferingAccumulated(T::GraveId, T::Balance, T::Balance),
        /// 函数级中文注释：已清理某账户在某墓位的历史周活跃标记（before_week 之前，最多 limit 条）
        WeeksPurged(T::GraveId, T::AccountId, u64, u32),
    }

    #[pallet::error]
    pub enum Error<T> {}

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：供 Hook 调用的内部记录方法（精简版）。
        /// - 仅维护累计计数与累计金额；不再存储明细、Top 排行与分类型统计；
        /// - amount 为本次落账的 DUST 金额（若无转账则为 None）。
        /// - kind_code/memo 仅用于兼容旧 Hook 签名，不做链上存储。
        pub fn record_from_hook_with_amount(
            grave_id: T::GraveId,
            _who: T::AccountId,
            _kind_code: u8,
            amount: Option<T::Balance>,
            _memo: Option<alloc::vec::Vec<u8>>,
            // 新增：可选去重键（如事件哈希/外部 tx id 的 blake2）
            tx_key: Option<H256>,
        ) {
            // 若提供了去重键，判断是否已处理
            if let Some(k) = tx_key {
                if DedupKeys::<T>::contains_key((grave_id, k)) {
                    return;
                }
                DedupKeys::<T>::insert((grave_id, k), ());
            }
            TotalsByGrave::<T>::mutate(grave_id, |c| *c = c.saturating_add(1));
            if let Some(amt) = amount {
                let new_total = TotalMemoByGrave::<T>::mutate(grave_id, |b| {
                    *b = b.saturating_add(amt);
                    *b
                });
                Self::deposit_event(Event::GraveOfferingAccumulated(grave_id, amt, new_total));
            }
        }

        /// 兼容旧接口：无金额
        pub fn record_from_hook(
            grave_id: T::GraveId,
            who: T::AccountId,
            kind_code: u8,
            memo: Option<alloc::vec::Vec<u8>>,
        ) {
            Self::record_from_hook_with_amount(grave_id, who, kind_code, None, memo, None)
        }

        // ========================================
        // 🗑️ 破坏式变更（方案A）：已移除 add_to_deceased_total 方法
        // ========================================
        // 原因：不再支持 Deceased 作为供奉目标
        // 如需逝者级统计，可通过 Grave 关联查询

        /// 函数级中文注释：按"周"为粒度，标记有效供奉周期。
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

        /// 函数级中文注释：计算某区块号对应的周索引（floor(block_number / BlocksPerWeek)）。
        pub fn week_index_of_block(block: BlockNumberFor<T>) -> u64 {
            let bpw = T::BlocksPerWeek::get() as u128;
            (block.saturated_into::<u128>() / bpw) as u64
        }

        /// 函数级中文注释：返回当前周索引（便于前端/索引层只读调用）。
        pub fn current_week_index() -> u64 {
            let now = <frame_system::Pallet<T>>::block_number();
            Self::week_index_of_block(now)
        }

        /// 函数级中文注释：按位图返回从 `start_week` 起连续 `len` 周的活跃情况（bit=1 表示活跃）。
        /// - 返回 Vec<u8>，低位在前；位序为 [start_week + 0, start_week + 1, ...]；
        /// - len 最大 256 建议，避免链上过大内存；调用方应合理控制参数。
        pub fn weeks_active_bitmap(
            grave_id: T::GraveId,
            who: &T::AccountId,
            start_week: u64,
            len: u32,
        ) -> alloc::vec::Vec<u8> {
            let mut out: alloc::vec::Vec<u8> = alloc::vec::Vec::new();
            // 防御性裁剪：最多返回 256 位（32 字节）
            let cap: u32 = core::cmp::min(len, 256);
            let mut byte: u8 = 0;
            let mut bit_idx: u32 = 0;
            for i in 0..cap {
                let week = start_week.saturating_add(i as u64);
                let active = WeeklyActive::<T>::contains_key((grave_id, who.clone(), week));
                if active {
                    byte |= 1 << (bit_idx % 8);
                }
                bit_idx += 1;
                if bit_idx % 8 == 0 {
                    out.push(byte);
                    byte = 0;
                }
            }
            if bit_idx % 8 != 0 {
                out.push(byte);
            }
            out
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：清理某账户在某墓位的历史周活跃标记
        /// - 仅允许该账户本人调用；
        /// - 将移除 `(grave_id, who, week)` 中 `week < before_week` 的键，最多 `limit` 条；
        /// - 目的：控制 `WeeklyActive` 存储规模，便于长期运行；
        /// - 注意：清理仅影响只读统计，不影响任何资金或权益。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::purge_weeks(*limit))]
        pub fn purge_weeks(
            origin: OriginFor<T>,
            grave_id: T::GraveId,
            who: T::AccountId,
            before_week: u64,
            limit: u32,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            ensure!(caller == who, sp_runtime::DispatchError::BadOrigin);
            let mut removed: u32 = 0;
            for (gid, acc, week) in WeeklyActive::<T>::iter_keys() {
                if removed >= limit {
                    break;
                }
                if gid == grave_id && acc == who && week < before_week {
                    WeeklyActive::<T>::remove((gid, acc.clone(), week));
                    removed = removed.saturating_add(1);
                }
            }
            Self::deposit_event(Event::WeeksPurged(grave_id, who, before_week, removed));
            Ok(())
        }

        /// 函数级中文注释：按区间批量清理周活跃标记（含起，含止前）
        /// - 仅允许该账户本人调用；
        /// - 将移除 `(grave_id, who, week)` 中 `start_week <= week < end_week` 的键，最多 `limit` 条；
        /// - 用于 TTL 压缩或周期性清理历史周数据。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(T::WeightInfo::purge_weeks_by_range(*limit))]
        pub fn purge_weeks_by_range(
            origin: OriginFor<T>,
            grave_id: T::GraveId,
            who: T::AccountId,
            start_week: u64,
            end_week: u64,
            limit: u32,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            ensure!(caller == who, sp_runtime::DispatchError::BadOrigin);
            let mut removed: u32 = 0;
            for (gid, acc, week) in WeeklyActive::<T>::iter_keys() {
                if removed >= limit {
                    break;
                }
                if gid == grave_id && acc == who && week >= start_week && week < end_week {
                    WeeklyActive::<T>::remove((gid, acc.clone(), week));
                    removed = removed.saturating_add(1);
                }
            }
            Self::deposit_event(Event::WeeksPurged(grave_id, who, end_week, removed));
            Ok(())
        }
    }
}
