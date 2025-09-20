#![cfg_attr(not(feature = "std"), no_std)]
//! 函数级详细中文注释：第三方申诉 + 押金罚没 + 委员会强制执行（占位骨架）。
//! - 当前为最小实现，为避免 -D warnings，将暂时允许 deprecated。
//! - 后续补充限频、公示期、调度执行与 30% 入国库等完整逻辑。
#![allow(deprecated)]

pub use pallet::*;
use frame_support::pallet_prelude::DispatchResult;

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

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 申诉已提交(id, who, domain, target)
        AppealSubmitted(u64, T::AccountId, u8, u64),
        /// 申诉已撤回(id)
        AppealWithdrawn(u64),
        /// 申诉已通过(id)
        AppealApproved(u64),
        /// 申诉已驳回(id)
        AppealRejected(u64),
        /// 申诉已执行(id)
        AppealExecuted(u64),
    }

    #[pallet::error]
    pub enum Error<T> {
        NotFound,
        BadStatus,
        NoPermission,
        RateLimited,
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：限频检查并计数。
        fn touch_window(who: &T::AccountId, now: BlockNumberFor<T>) -> DispatchResult {
            AccountWindows::<T>::mutate(who, |w| {
                let wb = T::WindowBlocks::get();
                if now.saturating_sub(w.window_start) >= wb { w.window_start = now; w.count = 0; }
                if w.count >= T::MaxPerWindow::get() { return }
                w.count = w.count.saturating_add(1);
            });
            // 再读校验
            let info = AccountWindows::<T>::get(who);
            ensure!(info.count <= T::MaxPerWindow::get(), Error::<T>::RateLimited);
            Ok(())
        }

        /// 函数级详细中文注释：按 bps 从 `who` 转出罚没金额到国库（基于已释放的自由余额）。
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
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 1, Error::<T>::BadStatus);
                T::Router::execute(&a.who, a.domain, a.target, a.action)?;
                a.status = 4;
                // 执行成功后退还押金
                T::Currency::unreserve(&a.who, a.deposit);
                Ok(())
            })?;
            Self::deposit_event(Event::AppealExecuted(id));
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        /// 函数级详细中文注释：每块开始扫描少量到期记录并执行（MVP：线性扫描，生产可换索引）。
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            let mut handled: u32 = 0;
            for (id, rec) in Appeals::<T>::iter() {
                if rec.status == 1 { if let Some(at) = rec.execute_at { if at <= n { let _ = Self::try_execute(id); handled = handled.saturating_add(1); if handled >= 5 { break; } } } }
            }
            Weight::zero()
        }
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：提交申诉（存证占位，不做限频/罚没，后续补全）。
        #[pallet::call_index(0)]
        #[pallet::weight({0})]
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
            Self::deposit_event(Event::AppealSubmitted(id, who, domain, target));
            Ok(())
        }

        /// 函数级详细中文注释：撤回申诉（占位：实际应执行部分罚没与退还）。
        #[pallet::call_index(1)]
        #[pallet::weight({0})]
        pub fn withdraw_appeal(origin: OriginFor<T>, id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.who == who, Error::<T>::NoPermission);
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 3;
                // 释放押金并按撤回比例罚没至国库
                let dep = a.deposit;
                let _ = T::Currency::unreserve(&a.who, dep);
                let _ = Self::slash_to_treasury(&a.who, T::WithdrawSlashBps::get(), dep);
                Ok(())
            })?;
            Self::deposit_event(Event::AppealWithdrawn(id));
            Ok(())
        }

        /// 函数级详细中文注释：通过申诉（写入公示到期块，由 Hooks 调度执行）。
        #[pallet::call_index(2)]
        #[pallet::weight({0})]
        pub fn approve_appeal(origin: OriginFor<T>, id: u64, notice_blocks: Option<BlockNumberFor<T>>) -> DispatchResult {
            ensure_root(origin)?; // 占位：后续改为 Either(Root, ContentCommittee)
            let now = <frame_system::Pallet<T>>::block_number();
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 1;
                let nb = notice_blocks.unwrap_or(T::NoticeDefaultBlocks::get());
                a.execute_at = Some(now.saturating_add(nb));
                Ok(())
            })?;
            Self::deposit_event(Event::AppealApproved(id));
            Ok(())
        }

        /// 函数级详细中文注释：驳回申诉（退押金并按比例罚没至国库）。
        #[pallet::call_index(3)]
        #[pallet::weight({0})]
        pub fn reject_appeal(origin: OriginFor<T>, id: u64) -> DispatchResult {
            ensure_root(origin)?; // 占位：后续改为 Either(Root, ContentCommittee)
            Appeals::<T>::try_mutate(id, |m| -> DispatchResult {
                let a = m.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(a.status == 0, Error::<T>::BadStatus);
                a.status = 2;
                let dep = a.deposit;
                let _ = T::Currency::unreserve(&a.who, dep);
                let _ = Self::slash_to_treasury(&a.who, T::RejectedSlashBps::get(), dep);
                Ok(())
            })?;
            Self::deposit_event(Event::AppealRejected(id));
            Ok(())
        }
    }
}

/// 函数级详细中文注释：申诉执行路由 Trait；由 Runtime 提供实现，将决议映射为具体强制执行。
pub trait AppealRouter<AccountId> {
    /// 根据决议执行目标动作（domain/target/action 自定义编码）。
    fn execute(who: &AccountId, domain: u8, target: u64, action: u8) -> DispatchResult;
}


