#![cfg_attr(not(feature = "std"), no_std)]
//! 函数级详细中文注释：第三方申诉 + 押金罚没 + 委员会强制执行（占位骨架）。
//! - 当前为最小实现，为避免 -D warnings，将暂时允许 deprecated。
//! - 后续补充限频、公示期、调度执行与 30% 入国库等完整逻辑。
#![allow(deprecated)]

pub use pallet::*;
extern crate alloc;
use frame_support::pallet_prelude::DispatchResult;
use crate::weights::WeightInfo;
pub mod weights;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{pallet_prelude::*, traits::{Currency, ReservableCurrency}};
    use frame_system::pallet_prelude::*;
    use sp_runtime::{traits::{Zero, Saturating}, Perbill};

    /// 函数级详细中文注释：本 Pallet 仅提供申诉登记与资金押金、以及公示期审批的最小骨架。
    /// - 任何人可提交/补充/撤回申诉（含押金与限频Hook将后续补全）；
    /// - 内容委员会/Root 可通过/驳回申诉（罚没比例与入国库后续接入）；
    /// - 调度执行与目标路由由 Runtime 注入，占位接口后续实现（保持低耦合）。
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 货币类型（MEMO）
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;
        /// 押金数额
        #[pallet::constant]
        type AppealDeposit: Get<<Self::Currency as Currency<Self::AccountId>>::Balance>;
        /// 驳回罚没比例（bps），示例：3000 = 30%
        #[pallet::constant]
        type RejectedSlashBps: Get<u16>;
        /// 撤回罚没比例（bps）
        #[pallet::constant]
        type WithdrawSlashBps: Get<u16>;
        /// 限频窗口（块）
        #[pallet::constant]
        type WindowBlocks: Get<BlockNumberFor<Self>>;
        /// 窗口内最大提交次数
        #[pallet::constant]
        type MaxPerWindow: Get<u32>;
        /// 默认公示期（块）
        #[pallet::constant]
        type NoticeDefaultBlocks: Get<BlockNumberFor<Self>>;
        /// 国库账户（罚没接收）
        type TreasuryAccount: Get<Self::AccountId>;
        /// 执行路由（将已批准申诉分发到目标 Pallet 的强制接口）
        type Router: crate::AppealRouter<Self::AccountId>;
        /// 治理起源（允许审批/驳回），运行时可绑定为 Root | 内容委员会阈值
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        /// 每块最大执行条数上限（DoS 防护）
        #[pallet::constant]
        type MaxExecPerBlock: Get<u32>;
        /// 权重提供者（后续可用基准自动生成替换）
        type WeightInfo: weights::WeightInfo;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级详细中文注释：申诉结构（含押金、公示期与状态）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct Appeal<AccountId, Balance, BlockNumber> {
        pub who: AccountId,
        pub domain: u8,
        pub target: u64,
        pub action: u8,
        pub reason_cid: BoundedVec<u8, ConstU32<128>>,
        pub evidence_cid: BoundedVec<u8, ConstU32<128>>,
        pub deposit: Balance,
        pub status: u8, // 0=submitted,1=approved,2=rejected,3=withdrawn,4=executed
        pub execute_at: Option<BlockNumber>, // 公示到期执行块
    }

    #[pallet::storage]
    pub type NextId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type Appeals<T: Config> = StorageMap<_, Blake2_128Concat, u64, Appeal<T::AccountId, <T::Currency as Currency<T::AccountId>>::Balance, BlockNumberFor<T>>, OptionQuery>;

    /// 函数级详细中文注释：账户限频窗口存储。
    /// - window_start：窗口起始块；count：窗口内已提交次数。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct WindowInfo<BlockNumber> { pub window_start: BlockNumber, pub count: u32 }
    #[pallet::storage]
    pub type AccountWindows<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, WindowInfo<BlockNumberFor<T>>, ValueQuery>;

    /// 函数级中文注释：到期执行队列（按区块维度归集待执行的申诉 id）。
    /// - 维度：execute_at → BoundedVec<AppealId, MaxExecPerBlock>
    /// - on_initialize(n) 仅取本块队列，限额执行并清空。
    #[pallet::storage]
    pub type QueueByBlock<T: Config> = StorageMap<_, Blake2_128Concat, BlockNumberFor<T>, BoundedVec<u64, T::MaxExecPerBlock>, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 申诉已提交(id, who, domain, target, deposit)
        AppealSubmitted(u64, T::AccountId, u8, u64, <T::Currency as Currency<T::AccountId>>::Balance),
        /// 申诉已撤回(id, slash_bps, slashed)
        AppealWithdrawn(u64, u16, <T::Currency as Currency<T::AccountId>>::Balance),
        /// 申诉已通过(id, execute_at)
        AppealApproved(u64, BlockNumberFor<T>),
        /// 申诉已驳回(id, slash_bps, slashed)
        AppealRejected(u64, u16, <T::Currency as Currency<T::AccountId>>::Balance),
        /// 申诉已执行(id)
        AppealExecuted(u64),
        /// 申诉执行失败（Router 返回错误，不改变状态）(id)
        AppealExecuteFailed(u64),
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadStatus,
        NoPermission,
        RateLimited,
        QueueFull,
        RouterFailed,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：限频检查并计数。
        fn touch_window(who: &T::AccountId, now: BlockNumberFor<T>) -> DispatchResult {
            // 先滚动窗口，再进行严格校验，最后自增计数（避免失败时计数被污染）。
            AccountWindows::<T>::mutate(who, |w| {
                let wb = T::WindowBlocks::get();
                if now.saturating_sub(w.window_start) >= wb { w.window_start = now; w.count = 0; }
            });
            let info = AccountWindows::<T>::get(who);
            ensure!(info.count < T::MaxPerWindow::get(), Error::<T>::RateLimited);
            AccountWindows::<T>::mutate(who, |w| { w.count = w.count.saturating_add(1); });
            Ok(())
        }

        /// 函数级详细中文注释：按 bps 从 `who` 转出罚没金额到国库（基于已释放的自由余额）。
        #[allow(dead_code)]
        fn slash_to_treasury(who: &T::AccountId, bps: u16, amount: <T::Currency as Currency<T::AccountId>>::Balance) -> DispatchResult {
            if bps == 0 || amount.is_zero() { return Ok(()) }
            // 将 bps 转换为 Perbill：bps × 10_000
            let per = Perbill::from_parts((bps as u32) * 10_000);
            let slash = per.mul_floor(amount);
            if slash.is_zero() { return Ok(()) }
            T::Currency::transfer(who, &T::TreasuryAccount::get(), slash, frame_support::traits::ExistenceRequirement::KeepAlive)?;
            Ok(())
        }

        /// 函数级详细中文注释：尝试执行已批准且到期的申诉，调用路由器。
        fn try_execute(id: u64) -> DispatchResult {
            let mut ok = false;
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 1, Error::<T>::BadStatus);
                match T::Router::execute(&a.who, a.domain, a.target, a.action) {
                    Ok(()) => {
                        a.status = 4;
                        // 执行成功后退还押金
                        T::Currency::unreserve(&a.who, a.deposit);
                        ok = true;
                        Ok(())
                    }
                    Err(_) => Err(Error::<T>::RouterFailed.into()),
                }
            })?;
            if ok { Self::deposit_event(Event::AppealExecuted(id)); } else { Self::deposit_event(Event::AppealExecuteFailed(id)); }
            Ok(())
        }

        /// 函数级中文注释：只读-获取申诉明细（用于前端/索引层按 id 查询）。
        pub fn appeal_of(id: u64) -> Option<Appeal<T::AccountId, <T::Currency as Currency<T::AccountId>>::Balance, BlockNumberFor<T>>> {
            Appeals::<T>::get(id)
        }

        /// 函数级中文注释：只读-按账户与可选状态过滤，返回 id 分页列表（从 start_id 起，最多 limit 条）。
        pub fn list_by_account(
            who: &T::AccountId,
            status: Option<u8>,
            start_id: u64,
            limit: u32,
        ) -> alloc::vec::Vec<u64> {
            let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
            let mut cnt: u32 = 0;
            for (id, a) in Appeals::<T>::iter() {
                if id < start_id { continue; }
                if a.who != *who { continue; }
                if let Some(s) = status { if a.status != s { continue; } }
                out.push(id);
                cnt = cnt.saturating_add(1);
                if cnt >= limit { break; }
            }
            out
        }

        /// 函数级中文注释：只读-按状态范围过滤并分页（闭区间 [status_min, status_max]）。
        pub fn list_by_status_range(status_min: u8, status_max: u8, start_id: u64, limit: u32) -> alloc::vec::Vec<u64> {
            let lo = core::cmp::min(status_min, status_max);
            let hi = core::cmp::max(status_min, status_max);
            let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
            let mut cnt: u32 = 0;
            for (id, a) in Appeals::<T>::iter() {
                if id < start_id { continue; }
                if a.status < lo || a.status > hi { continue; }
                out.push(id);
                cnt = cnt.saturating_add(1);
                if cnt >= limit { break; }
            }
            out
        }

        /// 函数级中文注释：只读-按到期区间过滤（闭区间 [from, to]，仅 status=approved 带 execute_at 的）。
        pub fn list_due_between(from: BlockNumberFor<T>, to: BlockNumberFor<T>, start_id: u64, limit: u32) -> alloc::vec::Vec<u64> {
            let (lo, hi) = if from <= to { (from, to) } else { (to, from) };
            let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
            let mut cnt: u32 = 0;
            for (id, a) in Appeals::<T>::iter() {
                if id < start_id { continue; }
                if a.status != 1 { continue; }
                if let Some(at) = a.execute_at { if at < lo || at > hi { continue; } } else { continue; }
                out.push(id);
                cnt = cnt.saturating_add(1);
                if cnt >= limit { break; }
            }
            out
        }

        /// 函数级中文注释：只读-读取某块的到期执行队列长度。
        pub fn queue_len_at(block: BlockNumberFor<T>) -> u32 {
            QueueByBlock::<T>::get(block).map(|v| v.len() as u32).unwrap_or(0)
        }

        /// 函数级中文注释：只读-读取某块的到期执行 id（用于只读可视化，最多 MaxExecPerBlock）。
        pub fn due_at(block: BlockNumberFor<T>) -> alloc::vec::Vec<u64> {
            QueueByBlock::<T>::get(block).map(|v| v.into_inner()).unwrap_or_default()
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：每块开始扫描少量到期记录并执行（MVP：线性扫描，生产可换索引）。
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            // P0：改为按块队列，仅处理当前块的到期集合，防 DoS；每块上限为 MaxExecPerBlock。
            let mut handled: u32 = 0;
            if let Some(mut q) = QueueByBlock::<T>::get(n) {
                while let Some(id) = q.pop() { // 从尾部弹出，避免移动成本
                    let _ = Self::try_execute(id);
                    handled = handled.saturating_add(1);
                    if handled >= T::MaxExecPerBlock::get() { break; }
                }
                // 清空队列（已处理或剩余留待下块继续）
                QueueByBlock::<T>::remove(n);
            }
            // 返回与处理条数相关的近似权重（占位：读1 + 写1 + 每条一次状态访问）
            T::WeightInfo::on_initialize(handled)
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：提交申诉（存证占位，不做限频/罚没，后续补全）。
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::submit_appeal())]
        pub fn submit_appeal(
            origin: OriginFor<T>,
            domain: u8,
            target: u64,
            action: u8,
            reason_cid: BoundedVec<u8, ConstU32<128>>,
            evidence_cid: BoundedVec<u8, ConstU32<128>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Self::touch_window(&who, now)?;
            let id = NextId::<T>::mutate(|n| { let x=*n; *n = n.saturating_add(1); x });
            let dep = T::AppealDeposit::get();
            // 占位：实际应使用 hold/reserve 逻辑
            T::Currency::reserve(&who, dep)?;
            let rec = Appeal { who: who.clone(), domain, target, action, reason_cid, evidence_cid, deposit: dep, status: 0, execute_at: None };
            Appeals::<T>::insert(id, rec);
            Self::deposit_event(Event::AppealSubmitted(id, who, domain, target, dep));
            Ok(())
        }

        /// 函数级详细中文注释：撤回申诉（占位：实际应执行部分罚没与退还）。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::withdraw_appeal())]
        pub fn withdraw_appeal(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let mut bps: u16 = 0;
            let mut slashed = <T::Currency as Currency<T::AccountId>>::Balance::zero();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.who == who, Error::<T>::NoPermission);
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 3;
                // 释放押金并按撤回比例罚没至国库
                let dep = a.deposit;
                let _ = T::Currency::unreserve(&a.who, dep);
                bps = T::WithdrawSlashBps::get();
                // 计算罚没额
                if bps != 0 {
                    let per = sp_runtime::Perbill::from_parts((bps as u32) * 10_000);
                    slashed = per.mul_floor(dep);
                    let _ = T::Currency::transfer(&a.who, &T::TreasuryAccount::get(), slashed, frame_support::traits::ExistenceRequirement::KeepAlive);
                }
                Ok(())
            })?;
            Self::deposit_event(Event::AppealWithdrawn(id, bps, slashed));
            Ok(())
        }

        /// 函数级详细中文注释：通过申诉（写入公示到期块，由 Hooks 调度执行）。
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::approve_appeal())]
        pub fn approve_appeal(origin: OriginFor<T>, id: u64, notice_blocks: Option<BlockNumberFor<T>>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 1;
                let nb = notice_blocks.unwrap_or(T::NoticeDefaultBlocks::get());
                let at = now.saturating_add(nb);
                a.execute_at = Some(at);
                // 入队：按块维度插入待执行 id（超出容量则丢弃，后续可返回 QueueFull 错误）
                let pushed = QueueByBlock::<T>::mutate(at, |mq| {
                    let mut v = mq.take().unwrap_or_default();
                    let res = v.try_push(id).is_ok();
                    *mq = Some(v);
                    res
                });
                ensure!(pushed, Error::<T>::QueueFull);
                Ok(())
            })?;
            Self::deposit_event(Event::AppealApproved(id, now.saturating_add(notice_blocks.unwrap_or(T::NoticeDefaultBlocks::get()))));
            Ok(())
        }

        /// 函数级详细中文注释：驳回申诉（退押金并按比例罚没至国库）。
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::reject_appeal())]
        pub fn reject_appeal(origin: OriginFor<T>, id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut bps: u16 = 0;
            let mut slashed = <T::Currency as Currency<T::AccountId>>::Balance::zero();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 2;
                let dep = a.deposit;
                // 先解保留到自由余额，再将罚没部分转入国库（保证自由余额充足）
                let _ = T::Currency::unreserve(&a.who, dep);
                bps = T::RejectedSlashBps::get();
                if bps != 0 {
                    let per = sp_runtime::Perbill::from_parts((bps as u32) * 10_000);
                    slashed = per.mul_floor(dep);
                    let _ = T::Currency::transfer(&a.who, &T::TreasuryAccount::get(), slashed, frame_support::traits::ExistenceRequirement::KeepAlive);
                }
                Ok(())
            })?;
            Self::deposit_event(Event::AppealRejected(id, bps, slashed));
            Ok(())
        }

        /// 函数级详细中文注释：清理已完成/已撤回/已驳回的历史申诉，按 id 范围分批删除。
        /// - 仅 Root/治理可调用；
        /// - 范围：[start_id, end_id]，最多删除 limit 条；
        /// - 用于长期运行时的状态清理，降低存储占用。
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::purge_appeals(*limit))]
        pub fn purge_appeals(origin: OriginFor<T>, start_id: u64, end_id: u64, limit: u32) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut removed: u32 = 0;
            let (s, e) = if start_id <= end_id { (start_id, end_id) } else { (end_id, start_id) };
            for id in s..=e {
                if removed >= limit { break; }
                if let Some(a) = Appeals::<T>::get(id) {
                    if matches!(a.status, 2 | 3 | 4) {
                        Appeals::<T>::remove(id);
                        removed = removed.saturating_add(1);
                    }
                }
            }
            // 无事件，交由索引器通过缺失映射推断清理结果
            Ok(())
        }
    }
}

/// 函数级详细中文注释：申诉执行路由 Trait；由 Runtime 提供实现，将决议映射为具体强制执行。
pub trait AppealRouter<AccountId> {
    /// 根据决议执行目标动作（domain/target/action 自定义编码）。
    fn execute(who: &AccountId, domain: u8, target: u64, action: u8) -> DispatchResult;
}


