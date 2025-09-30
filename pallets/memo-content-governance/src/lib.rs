#![cfg_attr(not(feature = "std"), no_std)]
//! 函数级详细中文注释：第三方申诉 + 押金罚没 + 委员会强制执行（占位骨架）。
//! - 当前为最小实现，为避免 -D warnings，将暂时允许 deprecated。
//! - 后续补充限频、公示期、调度执行与 30% 入国库等完整逻辑。
#![allow(deprecated)]

pub use pallet::*;
extern crate alloc;
use crate::weights::WeightInfo;
use frame_support::pallet_prelude::DispatchResult;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarking;
#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;
pub mod weights;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency},
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::{
        traits::{Saturating, Zero},
        Perbill,
    };

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
        /// 函数级中文注释：只读分页最大返回条数上限（防御性限制，避免返回过大向量）。
        #[pallet::constant]
        type MaxListLen: Get<u32>;
        /// 函数级中文注释：执行失败最大重试次数（达到上限后不再自动重试）。
        #[pallet::constant]
        type MaxRetries: Get<u8>;
        /// 函数级中文注释：失败重试的基础退避区块数（第 k 次重试延迟为 base * k）。
        #[pallet::constant]
        type RetryBackoffBlocks: Get<BlockNumberFor<Self>>;
        /// 函数级中文注释：动态押金策略（根据 domain/action/目标规模/历史等返回押金）。
        type AppealDepositPolicy: AppealDepositPolicy<
            AccountId = Self::AccountId,
            Balance = <Self::Currency as Currency<Self::AccountId>>::Balance,
            BlockNumber = BlockNumberFor<Self>,
        >;
        /// 函数级中文注释：证据 CID 最小长度（字节数，下限防空串/异常值）。
        #[pallet::constant]
        type MinEvidenceCidLen: Get<u32>;
        /// 函数级中文注释：理由 CID 最小长度（可选字段；若不为空则需达到该下限）。
        #[pallet::constant]
        type MinReasonCidLen: Get<u32>;
        /// 权重提供者（后续可用基准自动生成替换）
        type WeightInfo: weights::WeightInfo;
        /// 函数级中文注释：最近活跃度提供者（跨模块只读接口）。
        /// - 用于“应答自动否决”：若在 [approved_at, execute_at] 内目标主体 owner 出现成功签名写操作，则视为应答，自动否决执行。
        /// - 返回最近一次活跃的块高；None 表示未知或不适用该 domain。
        type LastActiveProvider: crate::LastActiveProvider<BlockNumber = BlockNumberFor<Self>>;
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
        pub status: u8, // 0=submitted,1=approved,2=rejected,3=withdrawn,4=executed,5=retry_exhausted,6=auto_dismissed
        pub execute_at: Option<BlockNumber>, // 公示到期执行块
        pub approved_at: Option<BlockNumber>, // 批准时间（用于“应答自动否决”判断）
        /// 函数级中文注释：额外字段（当前用于 domain=2/action=4 的新 owner 透传）。
        /// - 其他域/动作保持为 None。
        pub new_owner: Option<AccountId>,
    }

    #[pallet::storage]
    pub type NextId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type Appeals<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        Appeal<T::AccountId, <T::Currency as Currency<T::AccountId>>::Balance, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 函数级详细中文注释：账户限频窗口存储。
    /// - window_start：窗口起始块；count：窗口内已提交次数。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Default)]
    pub struct WindowInfo<BlockNumber> {
        pub window_start: BlockNumber,
        pub count: u32,
    }
    #[pallet::storage]
    pub type AccountWindows<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, WindowInfo<BlockNumberFor<T>>, ValueQuery>;

    /// 函数级中文注释：到期执行队列（按区块维度归集待执行的申诉 id）。
    /// - 维度：execute_at → BoundedVec<AppealId, MaxExecPerBlock>
    /// - on_initialize(n) 仅取本块队列，限额执行并清空。
    #[pallet::storage]
    pub type QueueByBlock<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        BoundedVec<u64, T::MaxExecPerBlock>,
        OptionQuery,
    >;

    /// 函数级中文注释：同主体并发串行化占位：(domain, target) -> approved appeal id。
    /// - 保障同一主体同一时刻仅存在一个处于已批准待执行的申诉，避免竞态。
    #[pallet::storage]
    pub type PendingBySubject<T: Config> =
        StorageMap<_, Blake2_128Concat, (u8, u64), u64, OptionQuery>;

    /// 函数级中文注释：失败重试计数：id -> 已重试次数。
    #[pallet::storage]
    pub type RetryCount<T: Config> = StorageMap<_, Blake2_128Concat, u64, u8, ValueQuery>;

    /// 函数级中文注释：下次计划重试块高：id -> BlockNumber（仅用于只读观测）。
    #[pallet::storage]
    pub type NextRetryAt<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BlockNumberFor<T>, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 申诉已提交(id, who, domain, target, deposit)
        AppealSubmitted(
            u64,
            T::AccountId,
            u8,
            u64,
            <T::Currency as Currency<T::AccountId>>::Balance,
        ),
        /// 申诉已撤回(id, slash_bps, slashed)
        AppealWithdrawn(u64, u16, <T::Currency as Currency<T::AccountId>>::Balance),
        /// 申诉已通过(id, execute_at)
        AppealApproved(u64, BlockNumberFor<T>),
        /// 申诉已驳回(id, slash_bps, slashed)
        AppealRejected(u64, u16, <T::Currency as Currency<T::AccountId>>::Balance),
        /// 申诉已执行(id)
        AppealExecuted(u64),
        /// 申诉执行失败（Router 返回错误，不改变状态）(id, code)
        AppealExecuteFailed(u64, u16),
        /// 函数级中文注释：已计划重试（id, attempt, at_block）。
        AppealRetryScheduled(u64, u8, BlockNumberFor<T>),
        /// 函数级中文注释：重试已达上限，放弃自动执行（id, attempts）。
        AppealRetryExhausted(u64, u8),
        /// 函数级中文注释：已清理历史申诉（start_id,end_id,removed_count）
        AppealsPurged(u64, u64, u32),
        /// 函数级中文注释：在公示期内目标主体 owner 已应答，自动否决执行（id）。
        AppealAutoDismissed(u64),
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadStatus,
        NoPermission,
        RateLimited,
        QueueFull,
        RouterFailed,
        /// 同一主体已存在一个批准中的申诉
        AlreadyPending,
        /// 证据必填：evidence_cid 不允许为空
        EvidenceRequired,
        /// 证据过短：evidence_cid 长度不足
        EvidenceTooShort,
        /// 理由过短：reason_cid（若填写）长度不足
        ReasonTooShort,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：限频检查并计数。
        fn touch_window(who: &T::AccountId, now: BlockNumberFor<T>) -> DispatchResult {
            // 先滚动窗口，再进行严格校验，最后自增计数（避免失败时计数被污染）。
            AccountWindows::<T>::mutate(who, |w| {
                let wb = T::WindowBlocks::get();
                if now.saturating_sub(w.window_start) >= wb {
                    w.window_start = now;
                    w.count = 0;
                }
            });
            let info = AccountWindows::<T>::get(who);
            ensure!(info.count < T::MaxPerWindow::get(), Error::<T>::RateLimited);
            AccountWindows::<T>::mutate(who, |w| {
                w.count = w.count.saturating_add(1);
            });
            Ok(())
        }

        /// 函数级详细中文注释：按 bps 从 `who` 转出罚没金额到国库（基于已释放的自由余额）。
        #[allow(dead_code)]
        fn slash_to_treasury(
            who: &T::AccountId,
            bps: u16,
            amount: <T::Currency as Currency<T::AccountId>>::Balance,
        ) -> DispatchResult {
            if bps == 0 || amount.is_zero() {
                return Ok(());
            }
            // 将 bps 转换为 Perbill：bps × 10_000
            let per = Perbill::from_parts((bps as u32) * 10_000);
            let slash = per.mul_floor(amount);
            if slash.is_zero() {
                return Ok(());
            }
            T::Currency::transfer(
                who,
                &T::TreasuryAccount::get(),
                slash,
                frame_support::traits::ExistenceRequirement::KeepAlive,
            )?;
            Ok(())
        }

        /// 函数级详细中文注释：尝试执行已批准且到期的申诉，调用路由器。
        /// - 成功：状态→executed(4)，退还押金，释放 PendingBySubject；清理重试计数。
        /// - 失败：若未达上限，按退避调度下一次重试；否则状态→retry_exhausted(5)，退还押金并释放占位。
        fn try_execute(id: u64) -> DispatchResult {
            let mut ok = false;
            let mut err_code: u16 = 0;
            // 执行前置：应答自动否决
            if let Some(a) = Appeals::<T>::get(id) {
                if a.status == 1 {
                    if let (Some(ex_at), Some(ap_at)) = (a.execute_at, a.approved_at) {
                        // 仅在治理转移等需要应答判定的域/动作开启（示例：2=deceased 域）
                        if a.domain == 2u8 {
                            if let Some(last) =
                                T::LastActiveProvider::last_active_of(a.domain, a.target)
                            {
                                // 若在 (approved_at, execute_at] 内存在 owner 应答，则自动否决
                                if last > ap_at && last <= ex_at {
                                    Appeals::<T>::mutate(id, |m| {
                                        if let Some(rec) = m.as_mut() {
                                            rec.status = 6; // auto_dismissed
                                        }
                                    });
                                    PendingBySubject::<T>::remove((a.domain, a.target));
                                    RetryCount::<T>::remove(id);
                                    NextRetryAt::<T>::remove(id);
                                    let _ = T::Currency::unreserve(&a.who, a.deposit);
                                    Self::deposit_event(Event::AppealAutoDismissed(id));
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
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
                    Err(e) => {
                        // 将 DispatchError 映射为 u16 错误码（Module/EVM/Token 等可统一折叠）
                        err_code = match e {
                            sp_runtime::DispatchError::Module(m) => {
                                ((m.index as u16) << 8)
                                    | (m.error.get(0).copied().unwrap_or(0) as u16)
                            }
                            sp_runtime::DispatchError::Token(_) => 0xEE01,
                            sp_runtime::DispatchError::Arithmetic(_) => 0xEE02,
                            sp_runtime::DispatchError::ConsumerRemaining => 0xEE03,
                            sp_runtime::DispatchError::NoProviders => 0xEE04,
                            sp_runtime::DispatchError::TooManyConsumers => 0xEE05,
                            sp_runtime::DispatchError::Corruption => 0xEE06,
                            sp_runtime::DispatchError::Unavailable => 0xEE07,
                            _ => 0xEE00,
                        };
                        Err(Error::<T>::RouterFailed.into())
                    }
                }
            })?;
            if ok {
                // 成功：释放并清理
                if let Some(a) = Appeals::<T>::get(id) {
                    PendingBySubject::<T>::remove((a.domain, a.target));
                }
                RetryCount::<T>::remove(id);
                NextRetryAt::<T>::remove(id);
                Self::deposit_event(Event::AppealExecuted(id));
            } else {
                // 失败：根据重试策略安排重试或放弃
                Self::deposit_event(Event::AppealExecuteFailed(id, err_code));
                let now = <frame_system::Pallet<T>>::block_number();
                let attempts = RetryCount::<T>::get(id);
                if attempts < T::MaxRetries::get() {
                    let next_attempt = attempts.saturating_add(1);
                    let delay = T::RetryBackoffBlocks::get();
                    let at = now.saturating_add(delay.saturating_mul(next_attempt.into()));
                    let pushed = QueueByBlock::<T>::mutate(at, |mq| {
                        let mut v = mq.take().unwrap_or_default();
                        let res = v.try_push(id).is_ok();
                        *mq = Some(v);
                        res
                    });
                    if pushed {
                        RetryCount::<T>::insert(id, next_attempt);
                        NextRetryAt::<T>::insert(id, at);
                        Self::deposit_event(Event::AppealRetryScheduled(id, next_attempt, at));
                    } else {
                        // 队列满：视为达上限处理，释放占位并退押金
                        if let Some(mut a) = Appeals::<T>::get(id) {
                            PendingBySubject::<T>::remove((a.domain, a.target));
                            a.status = 5;
                            Appeals::<T>::insert(id, a.clone());
                            let _ = T::Currency::unreserve(&a.who, a.deposit);
                        }
                        RetryCount::<T>::remove(id);
                        NextRetryAt::<T>::remove(id);
                        Self::deposit_event(Event::AppealRetryExhausted(id, attempts));
                    }
                } else {
                    // 达到重试上限：放弃并退押金，标记为 retry_exhausted(5)
                    if let Some(mut a) = Appeals::<T>::get(id) {
                        PendingBySubject::<T>::remove((a.domain, a.target));
                        a.status = 5;
                        Appeals::<T>::insert(id, a.clone());
                        let _ = T::Currency::unreserve(&a.who, a.deposit);
                    }
                    RetryCount::<T>::remove(id);
                    NextRetryAt::<T>::remove(id);
                    Self::deposit_event(Event::AppealRetryExhausted(id, attempts));
                }
            }
            Ok(())
        }

        /// 函数级中文注释：只读-获取申诉明细（用于前端/索引层按 id 查询）。
        pub fn appeal_of(
            id: u64,
        ) -> Option<
            Appeal<
                T::AccountId,
                <T::Currency as Currency<T::AccountId>>::Balance,
                BlockNumberFor<T>,
            >,
        > {
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
            let cap = core::cmp::min(limit, T::MaxListLen::get());
            for (id, a) in Appeals::<T>::iter() {
                if id < start_id {
                    continue;
                }
                if a.who != *who {
                    continue;
                }
                if let Some(s) = status {
                    if a.status != s {
                        continue;
                    }
                }
                out.push(id);
                cnt = cnt.saturating_add(1);
                if cnt >= cap {
                    break;
                }
            }
            out
        }

        /// 函数级中文注释：只读-按状态范围过滤并分页（闭区间 [status_min, status_max]）。
        pub fn list_by_status_range(
            status_min: u8,
            status_max: u8,
            start_id: u64,
            limit: u32,
        ) -> alloc::vec::Vec<u64> {
            let lo = core::cmp::min(status_min, status_max);
            let hi = core::cmp::max(status_min, status_max);
            let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
            let mut cnt: u32 = 0;
            let cap = core::cmp::min(limit, T::MaxListLen::get());
            for (id, a) in Appeals::<T>::iter() {
                if id < start_id {
                    continue;
                }
                if a.status < lo || a.status > hi {
                    continue;
                }
                out.push(id);
                cnt = cnt.saturating_add(1);
                if cnt >= cap {
                    break;
                }
            }
            out
        }

        /// 函数级中文注释：只读-按到期区间过滤（闭区间 [from, to]，仅 status=approved 带 execute_at 的）。
        pub fn list_due_between(
            from: BlockNumberFor<T>,
            to: BlockNumberFor<T>,
            start_id: u64,
            limit: u32,
        ) -> alloc::vec::Vec<u64> {
            let (lo, hi) = if from <= to { (from, to) } else { (to, from) };
            let mut out: alloc::vec::Vec<u64> = alloc::vec::Vec::new();
            let mut cnt: u32 = 0;
            let cap = core::cmp::min(limit, T::MaxListLen::get());
            for (id, a) in Appeals::<T>::iter() {
                if id < start_id {
                    continue;
                }
                if a.status != 1 {
                    continue;
                }
                if let Some(at) = a.execute_at {
                    if at < lo || at > hi {
                        continue;
                    }
                } else {
                    continue;
                }
                out.push(id);
                cnt = cnt.saturating_add(1);
                if cnt >= cap {
                    break;
                }
            }
            out
        }

        /// 函数级中文注释：只读-读取某块的到期执行队列长度。
        pub fn queue_len_at(block: BlockNumberFor<T>) -> u32 {
            QueueByBlock::<T>::get(block)
                .map(|v| v.len() as u32)
                .unwrap_or(0)
        }

        /// 函数级中文注释：只读-读取某块的到期执行 id（用于只读可视化，最多 MaxExecPerBlock）。
        pub fn due_at(block: BlockNumberFor<T>) -> alloc::vec::Vec<u64> {
            QueueByBlock::<T>::get(block)
                .map(|v| v.into_inner())
                .unwrap_or_default()
        }

        /// 函数级详细中文注释：只读-查找“治理转移逝者 owner”所需参数（根据 target 定位占位中的申诉）。
        /// - 输入：target=deceased_id（仅支持 domain=2）
        /// - 行为：读取 PendingBySubject(2,target) → Appeal → 取 new_owner；要求状态=approved(1)、action=4。
        /// - 返回：Some((appeal_id, new_owner)) 或 None。
        pub fn find_owner_transfer_params(target: u64) -> Option<(u64, T::AccountId)> {
            let id = PendingBySubject::<T>::get((2u8, target))?;
            let a = Appeals::<T>::get(id)?;
            if a.status == 1 && a.domain == 2u8 && a.action == 4 {
                if let Some(no) = a.new_owner {
                    return Some((id, no));
                }
            }
            None
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：每块开始扫描少量到期记录并执行（MVP：线性扫描，生产可换索引）。
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            // P0：改为按块队列，仅处理当前块的到期集合，防 DoS；每块上限为 MaxExecPerBlock。
            let mut handled: u32 = 0;
            if let Some(mut q) = QueueByBlock::<T>::get(n) {
                while let Some(id) = q.pop() {
                    // 从尾部弹出，避免移动成本
                    let _ = Self::try_execute(id);
                    handled = handled.saturating_add(1);
                    if handled >= T::MaxExecPerBlock::get() {
                        break;
                    }
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
            // 证据必填：避免空证据被滥用提交
            ensure!(!evidence_cid.is_empty(), Error::<T>::EvidenceRequired);
            // 最小长度约束
            ensure!(
                (evidence_cid.len() as u32) >= T::MinEvidenceCidLen::get(),
                Error::<T>::EvidenceTooShort
            );
            if !reason_cid.is_empty() {
                ensure!(
                    (reason_cid.len() as u32) >= T::MinReasonCidLen::get(),
                    Error::<T>::ReasonTooShort
                );
            }
            let id = NextId::<T>::mutate(|n| {
                let x = *n;
                *n = n.saturating_add(1);
                x
            });
            // 动态押金：优先按策略计算；若策略返回 None 则退化为固定押金
            let dep = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
                .unwrap_or_else(|| T::AppealDeposit::get());
            // 占位：实际应使用 hold/reserve 逻辑
            T::Currency::reserve(&who, dep)?;
            let rec = Appeal {
                who: who.clone(),
                domain,
                target,
                action,
                reason_cid,
                evidence_cid,
                deposit: dep,
                status: 0,
                execute_at: None,
                approved_at: None,
                new_owner: None,
            };
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
                    let _ = T::Currency::transfer(
                        &a.who,
                        &T::TreasuryAccount::get(),
                        slashed,
                        frame_support::traits::ExistenceRequirement::KeepAlive,
                    );
                }
                Ok(())
            })?;
            // 释放主体占位与重试信息（若此前已批准后又被撤回的情况）
            if let Some(a) = Appeals::<T>::get(id) {
                PendingBySubject::<T>::remove((a.domain, a.target));
            }
            RetryCount::<T>::remove(id);
            NextRetryAt::<T>::remove(id);
            Self::deposit_event(Event::AppealWithdrawn(id, bps, slashed));
            Ok(())
        }

        /// 函数级详细中文注释：通过申诉（写入公示到期块，由 Hooks 调度执行）。
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::approve_appeal())]
        pub fn approve_appeal(
            origin: OriginFor<T>,
            id: u64,
            notice_blocks: Option<BlockNumberFor<T>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 0, Error::<T>::BadStatus);
                // 并发串行化：同一主体只能存在一个处于批准状态的申诉
                ensure!(
                    PendingBySubject::<T>::get((a.domain, a.target)).is_none(),
                    Error::<T>::AlreadyPending
                );
                a.status = 1;
                let nb = notice_blocks.unwrap_or(T::NoticeDefaultBlocks::get());
                let at = now.saturating_add(nb);
                a.execute_at = Some(at);
                a.approved_at = Some(now);
                // 入队：按块维度插入待执行 id（超出容量则丢弃，后续可返回 QueueFull 错误）
                let pushed = QueueByBlock::<T>::mutate(at, |mq| {
                    let mut v = mq.take().unwrap_or_default();
                    let res = v.try_push(id).is_ok();
                    *mq = Some(v);
                    res
                });
                ensure!(pushed, Error::<T>::QueueFull);
                // 标记主体占位，初始化重试计数
                PendingBySubject::<T>::insert((a.domain, a.target), id);
                RetryCount::<T>::insert(id, 0u8);
                Ok(())
            })?;
            Self::deposit_event(Event::AppealApproved(
                id,
                now.saturating_add(notice_blocks.unwrap_or(T::NoticeDefaultBlocks::get())),
            ));
            Ok(())
        }

        /// 函数级详细中文注释：提交“治理转移逝者 owner”的专用申诉入口（domain=2, action=4）。
        /// - 最小侵入：与通用入口并存；强制 evidence 非空；透传 new_owner 存入申诉记录。
        /// - 动态押金：沿用策略（若 None 则回退固定押金）。
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::submit_appeal())]
        pub fn submit_owner_transfer_appeal(
            origin: OriginFor<T>,
            deceased_id: u64,
            new_owner: T::AccountId,
            evidence_cid: BoundedVec<u8, ConstU32<128>>,
            reason_cid: BoundedVec<u8, ConstU32<128>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Self::touch_window(&who, now)?;
            ensure!(!evidence_cid.is_empty(), Error::<T>::EvidenceRequired);
            ensure!(
                (evidence_cid.len() as u32) >= T::MinEvidenceCidLen::get(),
                Error::<T>::EvidenceTooShort
            );
            if !reason_cid.is_empty() {
                ensure!(
                    (reason_cid.len() as u32) >= T::MinReasonCidLen::get(),
                    Error::<T>::ReasonTooShort
                );
            }
            let id = NextId::<T>::mutate(|n| {
                let x = *n;
                *n = n.saturating_add(1);
                x
            });
            let domain: u8 = 2;
            let action: u8 = 4;
            let target = deceased_id;
            let dep = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
                .unwrap_or_else(|| T::AppealDeposit::get());
            T::Currency::reserve(&who, dep)?;
            let rec = Appeal {
                who: who.clone(),
                domain,
                target,
                action,
                reason_cid,
                evidence_cid,
                deposit: dep,
                status: 0,
                execute_at: None,
                approved_at: None,
                new_owner: Some(new_owner),
            };
            Appeals::<T>::insert(id, rec);
            Self::deposit_event(Event::AppealSubmitted(id, who, domain, target, dep));
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
                    let _ = T::Currency::transfer(
                        &a.who,
                        &T::TreasuryAccount::get(),
                        slashed,
                        frame_support::traits::ExistenceRequirement::KeepAlive,
                    );
                }
                Ok(())
            })?;
            // 释放主体占位与重试信息（若此前已批准后又被驳回的情况）
            if let Some(a) = Appeals::<T>::get(id) {
                PendingBySubject::<T>::remove((a.domain, a.target));
            }
            RetryCount::<T>::remove(id);
            NextRetryAt::<T>::remove(id);
            Self::deposit_event(Event::AppealRejected(id, bps, slashed));
            Ok(())
        }

        /// 函数级详细中文注释：清理已完成/已撤回/已驳回的历史申诉，按 id 范围分批删除。
        /// - 仅 Root/治理可调用；
        /// - 范围：[start_id, end_id]，最多删除 limit 条；
        /// - 用于长期运行时的状态清理，降低存储占用。
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::purge_appeals(*limit))]
        pub fn purge_appeals(
            origin: OriginFor<T>,
            start_id: u64,
            end_id: u64,
            limit: u32,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut removed: u32 = 0;
            let (s, e) = if start_id <= end_id {
                (start_id, end_id)
            } else {
                (end_id, start_id)
            };
            for id in s..=e {
                if removed >= limit {
                    break;
                }
                if let Some(a) = Appeals::<T>::get(id) {
                    if matches!(a.status, 2 | 3 | 4 | 5) {
                        Appeals::<T>::remove(id);
                        removed = removed.saturating_add(1);
                    }
                }
            }
            // 发出清理事件，便于前端/索引层可观测
            Self::deposit_event(Event::AppealsPurged(s, e, removed));
            Ok(())
        }
    }
}

/// 函数级详细中文注释：申诉执行路由 Trait；由 Runtime 提供实现，将决议映射为具体强制执行。
pub trait AppealRouter<AccountId> {
    /// 根据决议执行目标动作（domain/target/action 自定义编码）。
    fn execute(who: &AccountId, domain: u8, target: u64, action: u8) -> DispatchResult;
}

/// 函数级详细中文注释：动态押金策略抽象。
/// - 允许按主体、动作与历史为申诉设定押金，返回 None 表示使用固定押金回退。
pub trait AppealDepositPolicy {
    type AccountId;
    type Balance;
    type BlockNumber;
    fn calc_deposit(
        who: &Self::AccountId,
        domain: u8,
        target: u64,
        action: u8,
    ) -> Option<Self::Balance>;
}

/// 函数级详细中文注释：最近活跃度提供者抽象。
/// - 供治理在执行前判断“应答自动否决”：若在批准到执行之间，主体 owner 有成功签名写操作即视为应答。
pub trait LastActiveProvider {
    type BlockNumber;
    /// 返回该 (domain, target) 的最近活跃块高；None 表示未知或不支持该 domain。
    fn last_active_of(domain: u8, target: u64) -> Option<Self::BlockNumber>;
}
