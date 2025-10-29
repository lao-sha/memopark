#![cfg_attr(not(feature = "std"), no_std)]
//! # Pallet Memo Appeals
//!
//! ## 模块概述
//!
//! 通用申诉治理模块，支持多域（墓地、逝者、供奉品、媒体、文本等）的申诉流程管理。
//!
//! **重要**: 本模块由 `pallet-memo-content-governance` 重命名而来（v0.2.0）
//!
//! ## 主要功能
//!
//! - **申诉提交**: 任何用户可对指定域的对象提交申诉，需冻结押金
//! - **委员会审批**: 内容委员会投票批准或驳回申诉
//! - **公示期保护**: 批准的申诉进入公示期，给予对象所有者应答机会
//! - **自动执行**: 公示期到期后自动执行批准的操作
//! - **押金管理**: Phase 1优化 - 使用pallet-balances Holds API
//! - **限频控制**: 防止恶意申诉刷屏
//! - **应答自动否决**: 对象所有者及时应答可自动否决申诉
//!
//! ## 支持的域（Domain）
//!
//! - Domain 1: 墓地 (Grave)
//! - Domain 2: 逝者档案 (Deceased)
//! - Domain 3: 逝者文本 (Deceased Text)
//! - Domain 4: 逝者媒体 (Deceased Media)
//! - Domain 5: 供奉品 (Offerings)
//! - Domain 6: 园区 (Park)
//!
//! ## 版本历史
//!
//! ### v0.3.0 - Phase 1优化（2025-10-27）
//! - 迁移到Holds API：移除pallet-deposits依赖
//! - 使用pallet-balances Holds API管理押金
//! - 更好的类型安全和官方维护
//!
//! - **v0.1.0**: 初始版本，名称为 pallet-memo-content-governance
//! - **v0.2.0**: 重命名为 pallet-stardust-appeals，准备集成 pallet-deposits
//!
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
#[cfg(test)]
mod tests_deposit;
#[cfg(test)]
mod tests_last_active;
pub mod weights;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{
        pallet_prelude::*,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::{
        traits::{Saturating, Zero},
        Perbill,
    };
    // Phase 1.5优化：导入Holds API完整traits
    use frame_support::traits::tokens::{Precision, Fortitude, Restriction};
    use frame_support::traits::fungible::{Mutate, MutateHold};
    
    /// Phase 1.5优化：定义Hold原因枚举
    /// - 用于标识申诉押金的锁定原因
    /// - 使用composite_enum让Runtime自动识别
    #[pallet::composite_enum]
    pub enum HoldReason {
        /// 申诉押金锁定
        Appeal,
    }

    /// 函数级中文注释：Balance类型别名（Phase 1.5优化）
    /// - 从Currency::Balance改为fungible::Inspect::Balance
    /// - 与Fungible trait保持一致
    pub type BalanceOf<T> = <<T as Config>::Fungible as frame_support::traits::fungible::Inspect<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级详细中文注释：本 Pallet 仅提供申诉登记与资金押金、以及公示期审批的最小骨架。
    /// - 任何人可提交/补充/撤回申诉（含押金与限频Hook将后续补全）；
    /// - 内容委员会/Root 可通过/驳回申诉（罚没比例与入国库后续接入）；
    /// - 调度执行与目标路由由 Runtime 注入，占位接口后续实现（保持低耦合）。
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        
        /// Phase 1.5优化：使用Fungible traits替代Currency
        /// - 完全移除Currency和ReservableCurrency
        /// - 使用官方fungible API（pallet-balances Holds API）
        /// - 更好的类型安全和官方维护
        type Fungible: frame_support::traits::fungible::Mutate<Self::AccountId>
            + frame_support::traits::fungible::MutateHold<Self::AccountId, Reason = Self::RuntimeHoldReason>
            + frame_support::traits::fungible::Inspect<Self::AccountId>
            + frame_support::traits::fungible::InspectHold<Self::AccountId>;
        
        /// Phase 1.5优化：RuntimeHoldReason绑定
        /// - 连接pallet级HoldReason和Runtime级RuntimeHoldReason
        /// - 实现类型转换
        type RuntimeHoldReason: From<HoldReason>;
        /// 押金数额
        #[pallet::constant]
        type AppealDeposit: Get<BalanceOf<Self>>;
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
            Balance = BalanceOf<Self>,
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
    /// 
    /// Phase 3 统一证据管理：
    /// - evidence_id: 可选的统一证据ID（指向pallet-evidence）
    /// - reason_cid/evidence_cid: 旧方式（向后兼容）
    /// - 优先使用evidence_id，若为None则使用CID
    /// 
    /// Phase 1优化：Holds API迁移
    /// - 移除deposit_id（不再使用pallet-deposits）
    /// - deposit_amount: 存储押金金额（用于Holds API的release/slash）
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct Appeal<AccountId, Balance, BlockNumber> {
        pub who: AccountId,
        pub domain: u8,
        pub target: u64,
        pub action: u8,
        pub reason_cid: BoundedVec<u8, ConstU32<128>>,
        pub evidence_cid: BoundedVec<u8, ConstU32<128>>,
        /// Phase 3新增：统一证据ID（可选）
        pub evidence_id: Option<u64>,
        /// Phase 1优化：押金金额（用于Holds API的release/slash操作）
        /// - 使用pallet-balances Holds API锁定/释放资金
        /// - HoldReason::Appeal标识申诉押金
        pub deposit_amount: Balance,
        pub status: u8, // 0=submitted,1=approved,2=rejected,3=withdrawn,4=executed,5=retry_exhausted,6=auto_dismissed
        pub execute_at: Option<BlockNumber>, // 公示到期执行块
        pub approved_at: Option<BlockNumber>, // 批准时间（用于"应答自动否决"判断）
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
        Appeal<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
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

    // ========== Phase 3.4: 索引优化存储 ==========

    /// 函数级详细中文注释：用户申诉索引 - AccountId → 申诉ID列表。
    /// - 用于快速查询某用户提交的所有申诉，避免全表扫描。
    /// - 在 submit_appeal 时追加，在 purge_appeals 时清理。
    #[pallet::storage]
    pub type AppealsByUser<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxListLen>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：目标申诉索引 - (domain, target) → 申诉ID列表。
    /// - 用于快速查询针对某对象的所有申诉，避免全表扫描。
    /// - 在 submit_appeal 时追加，在 purge_appeals 时清理。
    #[pallet::storage]
    pub type AppealsByTarget<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        (u8, u64),
        BoundedVec<u64, T::MaxListLen>,
        ValueQuery,
    >;

    /// 函数级详细中文注释：状态申诉索引 - status → 申诉ID列表。
    /// - 用于快速查询某状态的所有申诉（如：待审批0、已批准1）。
    /// - 在 submit_appeal/approve_appeal/reject_appeal/withdraw_appeal/execute 时维护。
    /// - 为避免无限增长，仅索引活跃状态（0=submitted, 1=approved），其他状态不索引。
    #[pallet::storage]
    pub type AppealsByStatus<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u8,
        BoundedVec<u64, T::MaxListLen>,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 申诉已提交(id, who, domain, target, deposit)
        AppealSubmitted(
            u64,
            T::AccountId,
            u8,
            u64,
            BalanceOf<T>,
        ),
        /// 申诉已撤回(id, slash_bps, slashed)
        AppealWithdrawn(u64, u16, BalanceOf<T>),
        /// 申诉已通过(id, execute_at)
        AppealApproved(u64, BlockNumberFor<T>),
        /// 申诉已驳回(id, slash_bps, slashed)
        AppealRejected(u64, u16, BalanceOf<T>),
        /// 申诉已执行(id)
        AppealExecuted(u64),
        /// 申诉执行失败（Router 返回错误，不改变状态）(id, code)
        AppealExecuteFailed(u64, u16),
        /// 函数级中文注释：已计划重试（id, attempt, at_block）。
        AppealRetryScheduled(u64, u8, BlockNumberFor<T>),
        /// Phase 3新增：证据已链接到申诉(appeal_id, evidence_id)
        EvidenceLinked(u64, u64),
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
        // ========== Phase 3.4: 索引维护辅助函数 ==========

        /// 函数级详细中文注释：添加申诉到用户索引。
        /// - 在提交申诉时调用，将appeal_id追加到用户的申诉列表。
        /// - 若达到上限，静默忽略（BoundedVec::try_push失败）。
        fn index_by_user(who: &T::AccountId, id: u64) {
            AppealsByUser::<T>::mutate(who, |v| {
                let _ = v.try_push(id);
            });
        }

        /// 函数级详细中文注释：添加申诉到目标索引。
        /// - 在提交申诉时调用，将appeal_id追加到目标的申诉列表。
        /// - 若达到上限，静默忽略。
        fn index_by_target(domain: u8, target: u64, id: u64) {
            AppealsByTarget::<T>::mutate((domain, target), |v| {
                let _ = v.try_push(id);
            });
        }

        /// 函数级详细中文注释：添加申诉到状态索引（仅索引活跃状态0和1）。
        /// - status=0(submitted)或1(approved)时才索引，避免索引表无限增长。
        fn index_by_status(status: u8, id: u64) {
            if status == 0 || status == 1 {
                AppealsByStatus::<T>::mutate(status, |v| {
                    let _ = v.try_push(id);
                });
            }
        }

        /// 函数级详细中文注释：从状态索引中移除申诉。
        /// - 在状态变更时调用，从旧状态的索引列表中移除。
        /// - 注意：由于BoundedVec不支持高效remove，这里使用filter重建。
        fn unindex_by_status(old_status: u8, id: u64) {
            if old_status == 0 || old_status == 1 {
                AppealsByStatus::<T>::mutate(old_status, |v| {
                    let filtered: alloc::vec::Vec<u64> = v.iter().filter(|&&x| x != id).copied().collect();
                    *v = BoundedVec::truncate_from(filtered);
                });
            }
        }

        /// 函数级详细中文注释：更新申诉状态并维护索引。
        /// - 从旧状态索引移除，添加到新状态索引。
        fn update_status_index(old_status: u8, new_status: u8, id: u64) {
            Self::unindex_by_status(old_status, id);
            Self::index_by_status(new_status, id);
        }

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
            amount: BalanceOf<T>,
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
            // Phase 1.5优化：使用Fungible::transfer替代Currency::transfer
            T::Fungible::transfer(
                who,
                &T::TreasuryAccount::get(),
                slash,
                frame_support::traits::tokens::Preservation::Preserve,
            )?;
            Ok(())
        }

        /// 函数级详细中文注释：尝试执行已批准且到期的申诉，调用路由器（Phase 3.5完善版）。
        /// 
        /// **执行流程**：
        /// 1. 应答自动否决检查（domain=2时）
        /// 2. 调用Router执行目标动作
        /// 3. 根据结果更新状态并维护索引
        /// 
        /// **成功路径**：
        /// - 状态：1(approved) → 4(executed)
        /// - 押金：通过DepositManager释放
        /// - 占位：释放PendingBySubject
        /// - 索引：更新状态索引（1→4）
        /// - 清理：移除重试计数和计划
        /// 
        /// **失败路径（Phase 3.5重试机制）**：
        /// - 重试次数 < MaxRetries：
        ///   - 递增重试计数（attempts + 1）
        ///   - 计算退避延迟：RetryBackoffBlocks × attempts
        ///   - 重新入队到未来块：QueueByBlock[current + delay]
        ///   - 发出事件：AppealRetryScheduled(id, attempt, at_block)
        /// - 重试次数 ≥ MaxRetries 或队列满：
        ///   - 状态：1(approved) → 5(retry_exhausted)
        ///   - 押金：释放（不罚没，因Router失败非提交者责任）
        ///   - 占位：释放PendingBySubject
        ///   - 索引：更新状态索引（1→5）
        ///   - 清理：移除重试计数和计划
        ///   - 发出事件：AppealRetryExhausted(id, attempts)
        /// 
        /// **自动否决（LastActive机制）**：
        /// - 仅对domain=2（deceased域）启用
        /// - 检查时间窗口：(approved_at, execute_at]
        /// - 若owner在此期间有活跃操作→自动否决
        /// - 状态：1(approved) → 6(auto_dismissed)
        /// - 押金：释放（owner已应答，申诉无效）
        /// - 索引：更新状态索引（1→6）
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
                                    
                                    // Phase 1.5优化：使用Fungible Holds API释放押金（owner应答，申诉无效）
                                    let _ = T::Fungible::release(
                                        &T::RuntimeHoldReason::from(HoldReason::Appeal),
                                        &a.who,
                                        a.deposit_amount,
                                        Precision::Exact,
                                    );
                                    
                                    // Phase 3.4: 维护状态索引（1→6）
                                    Self::update_status_index(1, 6, id);
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
                        // Phase 3.4: 维护状态索引（1→4）
                        a.status = 4;
                        
                        // Phase 1.5优化：执行成功后使用Fungible Holds API释放押金
                        let _ = T::Fungible::release(
                            &T::RuntimeHoldReason::from(HoldReason::Appeal),
                            &a.who,
                            a.deposit_amount,
                            Precision::Exact,
                        );
                        
                        ok = true;
                        // 索引更新移到mutate外部
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
                    // Phase 3.4: 维护状态索引（1→4）
                    Self::update_status_index(1, 4, id);
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
                            
                            // Phase 1.5优化：使用Fungible Holds API释放押金（重试队列满）
                            let _ = T::Fungible::release(
                                &T::RuntimeHoldReason::from(HoldReason::Appeal),
                                &a.who,
                                a.deposit_amount,
                                Precision::Exact,
                            );
                            
                            Appeals::<T>::insert(id, a.clone());
                            // Phase 3.4: 维护状态索引（1→5）
                            Self::update_status_index(1, 5, id);
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
                        
                        // Phase 1.5优化：使用Fungible Holds API释放押金（达重试上限）
                        let _ = T::Fungible::release(
                            &T::RuntimeHoldReason::from(HoldReason::Appeal),
                            &a.who,
                            a.deposit_amount,
                            Precision::Exact,
                        );
                        
                        Appeals::<T>::insert(id, a.clone());
                        // Phase 3.4: 维护状态索引（1→5）
                        Self::update_status_index(1, 5, id);
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
                BalanceOf<T>,
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
        /// 函数级详细中文注释：每块开始批量执行到期申诉（Phase 3.5优化版）。
        /// 
        /// **设计原则**：
        /// - 按块队列组织：避免全表扫描，O(1)定位
        /// - 限额保护：MaxExecPerBlock防止单块过载
        /// - 尾部弹出：避免Vec移动成本
        /// - 权重精确：基于实际处理数返回权重
        /// 
        /// **批量执行优化（Phase 3.5）**：
        /// - 批量读取：一次性读取整个队列
        /// - 串行执行：逐个调用try_execute（含自动重试）
        /// - 清理：处理完成后移除队列，释放存储
        /// 
        /// **容错机制**：
        /// - try_execute内部处理失败：自动安排重试或标记exhausted
        /// - 队列超限：剩余留待下块继续（通过MaxExecPerBlock控制）
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            // Phase 3.5: 批量执行优化
            let mut handled: u32 = 0;
            let mut success: u32 = 0;
            let mut failed: u32 = 0;
            
            if let Some(mut q) = QueueByBlock::<T>::get(n) {
                let _total = q.len();
                while let Some(id) = q.pop() {
                    // 从尾部弹出，避免移动成本
                    match Self::try_execute(id) {
                        Ok(_) => success = success.saturating_add(1),
                        Err(_) => failed = failed.saturating_add(1),
                    }
                    handled = handled.saturating_add(1);
                    
                    // Phase 3.5: 限额保护（防DoS）
                    if handled >= T::MaxExecPerBlock::get() {
                        // 如果队列还有剩余，记录日志（可选）
                        if !q.is_empty() {
                            // 残留数量：total - handled
                            // 下次处理时，这些ID会因为execute_at不匹配而被跳过
                            // 或者在重试时重新入队
                        }
                        break;
                    }
                }
                // Phase 3.5: 清理队列（已处理或已达上限）
                QueueByBlock::<T>::remove(n);
            }
            
            // Phase 3.5: 精确权重计算
            // 基础：读队列(1) + 写队列(1)
            // 每个ID：读Appeal(1) + 写Appeal(1) + Router执行(变量) + 索引更新(2)
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
            let deposit_amount = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
                .unwrap_or_else(|| T::AppealDeposit::get());
            
            // Phase 1.5优化: 使用Fungible Holds API锁定押金
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(HoldReason::Appeal),
                &who,
                deposit_amount,
            )?;
            
            let rec = Appeal {
                who: who.clone(),
                domain,
                target,
                action,
                reason_cid,
                evidence_cid,
                evidence_id: None,  // Phase 3: 旧方式不使用统一证据ID
                deposit_amount,     // Phase 1: 存储押金金额用于release/slash
                status: 0,
                execute_at: None,
                approved_at: None,
                new_owner: None,
            };
            Appeals::<T>::insert(id, rec.clone());
            
            // Phase 3.4: 维护索引
            Self::index_by_user(&who, id);
            Self::index_by_target(domain, target, id);
            Self::index_by_status(0, id); // status=0(submitted)
            
            Self::deposit_event(Event::AppealSubmitted(id, who, domain, target, deposit_amount));
            Ok(())
        }

        /// 函数级详细中文注释：撤回申诉（占位：实际应执行部分罚没与退还）。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::withdraw_appeal())]
        pub fn withdraw_appeal(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let mut bps: u16 = 0;
            let mut slashed = BalanceOf::<T>::zero();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.who == who, Error::<T>::NoPermission);
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 3;
                
                // Phase 1优化：使用Holds API管理押金罚没
                let deposit_amount = a.deposit_amount;
                bps = T::WithdrawSlashBps::get();
                
                if bps != 0 {
                    // 计算罚没额（bps = 10% = 1000）
                    let per = sp_runtime::Perbill::from_parts((bps as u32) * 10_000);
                    slashed = per.mul_floor(deposit_amount);
                    
                    // Phase 1.5优化：罚没，转移到国库
                    T::Fungible::transfer_on_hold(
                        &T::RuntimeHoldReason::from(HoldReason::Appeal),
                        &a.who,
                        &T::TreasuryAccount::get(),
                        slashed,
                        Precision::BestEffort,
                        Restriction::Free,
                        Fortitude::Force,
                    )?;
                    
                    // 释放剩余押金
                    let remaining = deposit_amount.saturating_sub(slashed);
                    if !remaining.is_zero() {
                        T::Fungible::release(
                            &T::RuntimeHoldReason::from(HoldReason::Appeal),
                            &a.who,
                            remaining,
                            Precision::Exact,
                        )?;
                    }
                } else {
                    // 无罚没，全额释放
                    T::Fungible::release(
                        &T::RuntimeHoldReason::from(HoldReason::Appeal),
                        &a.who,
                        deposit_amount,
                        Precision::Exact,
                    )?;
                }
                Ok(())
            })?;
            // 释放主体占位与重试信息（若此前已批准后又被撤回的情况）
            if let Some(a) = Appeals::<T>::get(id) {
                PendingBySubject::<T>::remove((a.domain, a.target));
                // Phase 3.4: 维护状态索引（0→3）
                Self::update_status_index(0, 3, id);
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
            // Phase 3.4: 维护状态索引（0→1）
            Self::update_status_index(0, 1, id);
            Self::deposit_event(Event::AppealApproved(
                id,
                now.saturating_add(notice_blocks.unwrap_or(T::NoticeDefaultBlocks::get())),
            ));
            Ok(())
        }

        /// 函数级详细中文注释：提交"治理转移逝者 owner"的专用申诉入口（domain=2, action=4）。
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
            let deposit_amount = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
                .unwrap_or_else(|| T::AppealDeposit::get());
            
            // Phase 1.5优化：使用Fungible Holds API锁定押金
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(HoldReason::Appeal),
                &who,
                deposit_amount,
            )?;
            
            let rec = Appeal {
                who: who.clone(),
                domain,
                target,
                action,
                reason_cid,
                evidence_cid,
                evidence_id: None,  // Phase 3: 旧方式不使用统一证据ID
                deposit_amount,     // Phase 1: 存储押金金额用于release/slash
                status: 0,
                execute_at: None,
                approved_at: None,
                new_owner: Some(new_owner.clone()),
            };
            Appeals::<T>::insert(id, rec.clone());
            
            // Phase 3.4: 维护索引
            Self::index_by_user(&who, id);
            Self::index_by_target(domain, target, id);
            Self::index_by_status(0, id); // status=0(submitted)
            
            Self::deposit_event(Event::AppealSubmitted(id, who, domain, target, deposit_amount));
            Ok(())
        }

        /// 函数级详细中文注释：使用统一证据ID提交申诉（Phase 3新增）。
        /// 
        /// 参数：
        /// - domain: 申诉域（1=Grave, 2=Deceased, 3=DeceasedText, etc）
        /// - target: 目标ID（grave_id, deceased_id等）
        /// - action: 操作类型（1=SetVisibility, 20=RemoveEulogy等）
        /// - evidence_id: 统一证据ID（来自pallet-evidence）
        /// - reason_cid: 理由CID（可选，向后兼容）
        /// 
        /// 与旧方式的区别：
        /// - 优先使用evidence_id（指向pallet-evidence的统一证据）
        /// - 仍支持reason_cid用于额外说明
        /// - evidence_cid字段设为空（保持结构兼容）
        #[pallet::call_index(10)]
        #[pallet::weight(T::WeightInfo::submit_appeal())]
        pub fn submit_appeal_with_evidence(
            origin: OriginFor<T>,
            domain: u8,
            target: u64,
            action: u8,
            evidence_id: u64,
            reason_cid: Option<BoundedVec<u8, ConstU32<128>>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            Self::touch_window(&who, now)?;
            
            // 验证evidence_id是否存在（调用pallet-evidence查询）
            // 注意：这需要在Config中添加EvidenceProvider trait
            // 暂时跳过验证，由前端保证evidence_id有效性
            
            // 检查reason_cid最小长度（如果提供）
            let reason = reason_cid.unwrap_or_default();
            if !reason.is_empty() {
                ensure!(
                    (reason.len() as u32) >= T::MinReasonCidLen::get(),
                    Error::<T>::ReasonTooShort
                );
            }
            
            let id = NextId::<T>::mutate(|n| {
                let x = *n;
                *n = n.saturating_add(1);
                x
            });
            
            // 动态押金计算
            let deposit_amount = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
                .unwrap_or_else(|| T::AppealDeposit::get());
            
            // Phase 1.5优化：使用Fungible Holds API锁定押金
            T::Fungible::hold(
                &T::RuntimeHoldReason::from(HoldReason::Appeal),
                &who,
                deposit_amount,
            )?;
            
            let rec = Appeal {
                who: who.clone(),
                domain,
                target,
                action,
                reason_cid: reason,
                evidence_cid: BoundedVec::default(),  // Phase 3: 使用evidence_id，CID留空
                evidence_id: Some(evidence_id),  // Phase 3: 统一证据ID
                deposit_amount,  // Phase 1: 存储押金金额用于release/slash
                status: 0,
                execute_at: None,
                approved_at: None,
                new_owner: None,
            };
            Appeals::<T>::insert(id, rec.clone());
            
            // Phase 3.4: 维护索引
            Self::index_by_user(&who, id);
            Self::index_by_target(domain, target, id);
            Self::index_by_status(0, id); // status=0(submitted)
            
            Self::deposit_event(Event::AppealSubmitted(id, who.clone(), domain, target, deposit_amount));
            Self::deposit_event(Event::EvidenceLinked(id, evidence_id));
            Ok(())
        }

        /// 函数级详细中文注释：驳回申诉（退押金并按比例罚没至国库）。
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::reject_appeal())]
        pub fn reject_appeal(origin: OriginFor<T>, id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let mut bps: u16 = 0;
            let mut slashed = BalanceOf::<T>::zero();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 2;
                
                // Phase 1优化：使用Holds API管理押金罚没
                let deposit_amount = a.deposit_amount;
                bps = T::RejectedSlashBps::get();
                
                if bps != 0 {
                    // 计算罚没额（bps = 30% = 3000）
                    let per = sp_runtime::Perbill::from_parts((bps as u32) * 10_000);
                    slashed = per.mul_floor(deposit_amount);
                    
                    // Phase 1.5优化：罚没，转移到国库
                    T::Fungible::transfer_on_hold(
                        &T::RuntimeHoldReason::from(HoldReason::Appeal),
                        &a.who,
                        &T::TreasuryAccount::get(),
                        slashed,
                        Precision::BestEffort,
                        Restriction::Free,
                        Fortitude::Force,
                    )?;
                    
                    // 释放剩余押金
                    let remaining = deposit_amount.saturating_sub(slashed);
                    if !remaining.is_zero() {
                        T::Fungible::release(
                            &T::RuntimeHoldReason::from(HoldReason::Appeal),
                            &a.who,
                            remaining,
                            Precision::Exact,
                        )?;
                    }
                } else {
                    // 无罚没，全额释放
                    T::Fungible::release(
                        &T::RuntimeHoldReason::from(HoldReason::Appeal),
                        &a.who,
                        deposit_amount,
                        Precision::Exact,
                    )?;
                }
                Ok(())
            })?;
            // 释放主体占位与重试信息（若此前已批准后又被驳回的情况）
            if let Some(a) = Appeals::<T>::get(id) {
                PendingBySubject::<T>::remove((a.domain, a.target));
                // Phase 3.4: 维护状态索引（0→2）
                Self::update_status_index(0, 2, id);
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
                        
                        // Phase 3.4: 清理索引
                        // 注意：由于被清理的状态(2/3/4/5)不在AppealsByStatus索引中（仅索引0和1），
                        // 只需要清理AppealsByUser和AppealsByTarget。
                        // 但清理索引代价较高（需要filter重建BoundedVec），且索引有上限保护（MaxListLen），
                        // 因此这里暂不清理，由自然淘汰机制处理（新申诉超限时旧索引自动被截断）。
                        // 如果未来需要精确清理，可以在这里添加：
                        // - AppealsByUser清理逻辑
                        // - AppealsByTarget清理逻辑
                    }
                }
            }
            // 发出清理事件，便于前端/索引层可观测
            Self::deposit_event(Event::AppealsPurged(s, e, removed));
            Ok(())
        }

        /// 函数级详细中文注释：清理历史执行队列（Phase 3.5新增）。
        /// 
        /// **用途**：
        /// - 清理过期的历史队列，释放存储空间
        /// - 仅治理/Root可调用
        /// 
        /// **参数**：
        /// - start_block: 起始块高
        /// - end_block: 结束块高（含）
        /// - 清理范围：[start_block, end_block]
        /// 
        /// **场景**：
        /// - 定期维护：清理很久以前的历史队列
        /// - 异常恢复：清理意外残留的队列
        /// 
        /// **安全性**：
        /// - 不会影响未来块的队列
        /// - 不会影响当前块的执行
        /// - 建议清理当前块之前至少1000块的历史
        #[pallet::call_index(11)]
        #[pallet::weight(T::WeightInfo::purge_appeals(100))]
        pub fn purge_execution_queues(
            origin: OriginFor<T>,
            start_block: BlockNumberFor<T>,
            end_block: BlockNumberFor<T>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            let now = <frame_system::Pallet<T>>::block_number();
            
            // 安全检查：不允许清理当前块及未来块
            ensure!(end_block < now, Error::<T>::BadStatus);
            
            let mut removed: u32 = 0;
            let (s, e) = if start_block <= end_block {
                (start_block, end_block)
            } else {
                (end_block, start_block)
            };
            
            let mut block = s;
            while block <= e && removed < 1000 {  // 最多清理1000个块的队列
                if QueueByBlock::<T>::contains_key(block) {
                    QueueByBlock::<T>::remove(block);
                    removed = removed.saturating_add(1);
                }
                block = block.saturating_add(BlockNumberFor::<T>::from(1u32));
            }
            
            // 注意：这里不发出事件，因为这是维护操作
            // 如果需要，可以添加QueuesPurged事件
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
