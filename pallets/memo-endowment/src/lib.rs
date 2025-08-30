#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, ExistenceRequirement, Get},
};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::AccountIdConversion;
use sp_std::vec::Vec;

pub use pallet::*;

/// 函数级详细中文注释：基金会跨 pallet 调用接口
/// - 设计目的：
///   - 将“存储业务”与“基金会账务”解耦，避免直接依赖 extrinsic origin 判断；
///   - 允许其它 pallet（如存储 pallet）在链上业务流转中，将一次性费用按约定记入基金会；
/// - 泛型参数：
///   - `AccountId`：链上账户标识类型；
///   - `Balance`：货币数量类型；
///   - `Hash`：订单/对象的引用哈希（例如 `cid_hash`）。
pub trait EndowmentInterface<AccountId, Balance, Hash> {
    /// 记录一次性费用进入基金会（通常流入本金池，或按治理比例拆分）。
    /// - `payer`：付款账户（通常为下单用户）。
    /// - `amount`：一次性费用金额（MEMO）。
    /// - `order_ref`：业务引用哈希（如 `cid_hash`）。
    fn deposit_from_storage(payer: &AccountId, amount: Balance, order_ref: Hash) -> DispatchResult;
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{tokens::Balance as BalanceT, Currency},
        PalletId,
    };

    /// 余额别名
    pub type BalanceOf<T> = <T as Config>::Balance;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 货币接口（MEMO 主币）
        type Currency: Currency<Self::AccountId, Balance = Self::Balance>;

        /// 余额类型（与 `Currency::Balance` 对齐）
        type Balance: Parameter + BalanceT + MaxEncodedLen + Default + Copy;

        /// 本金账户 PalletId（用于派生基金会“本金池”账户）
        #[pallet::constant]
        type PrincipalPalletId: Get<PalletId>;

        /// 收益账户 PalletId（用于派生基金会“收益池”账户）
        #[pallet::constant]
        type YieldPalletId: Get<PalletId>;

        /// 治理来源（Root 或理事会/公投白名单）
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 权重信息（后续基准测试填充）
        type WeightInfo: WeightInfo;
    }

    #[pallet::pallet]
    #[pallet::storage_version(StorageVersion::new(0))]
    pub struct Pallet<T>(_);

    /// 基金参数（示例：目标收益率、结算周期等；此处骨架暂存占位字段）
    #[pallet::storage]
    pub type EndowmentParams<T: Config> = StorageValue<_, Vec<u8>, OptionQuery>;

    /// 审计年报哈希留档
    #[pallet::storage]
    pub type AnnualReports<T: Config> = StorageMap<_, Blake2_128Concat, u32, T::Hash, OptionQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 一次性费用已入账（payer, amount, order_ref）
        OneOffFeeReceived(T::AccountId, BalanceOf<T>, T::Hash),
        /// 年报发布（year, hash）
        AnnualReportPublished(u32, T::Hash),
        /// 参数已更新
        ParamsUpdated,
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 金额为零
        ZeroAmount,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：发布年度审计报告指纹
        /// - 仅治理来源可调用；
        /// - 将 `year -> report_hash` 写入存储，并发出事件，便于前端审计看板检索；
        /// - 骨架实现仅做简单写入，实际可附加权限/频率限制。
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::publish_annual_report())]
        pub fn publish_annual_report(
            origin: OriginFor<T>,
            year: u32,
            report_hash: T::Hash,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            AnnualReports::<T>::insert(year, report_hash);
            Self::deposit_event(Event::AnnualReportPublished(year, report_hash));
            Ok(())
        }

        /// 函数级详细中文注释：更新基金参数（骨架）
        /// - 仅治理来源允许；
        /// - 以原始字节形式暂存，后续迁移为结构体并提供 StorageVersion 变更。
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::set_params())]
        pub fn set_params(origin: OriginFor<T>, raw: Vec<u8>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            EndowmentParams::<T>::put(raw);
            Self::deposit_event(Event::ParamsUpdated);
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：返回基金“本金池”账户
        /// - 通过 PalletId 派生确定且可审计的账户地址，避免手工配置风险。
        pub fn principal_account_id() -> T::AccountId {
            T::PrincipalPalletId::get().into_account_truncating()
        }

        /// 函数级详细中文注释：返回基金“收益池”账户
        /// - 与本金池分账，便于遵循“本金保值、收益支付”的财务约束。
        pub fn yield_account_id() -> T::AccountId {
            T::YieldPalletId::get().into_account_truncating()
        }
    }

    /// 对外接口实现：允许存储业务 pallet 将一次性费用汇入基金
    impl<T: Config> super::EndowmentInterface<T::AccountId, BalanceOf<T>, T::Hash> for Pallet<T> {
        /// 函数级详细中文注释：一次性费用入账
        /// - 当前骨架实现：全部转入“本金池”账户；
        /// - 未来可由治理参数拆分：部分进入收益池作为当期运营预算；
        /// - 资金安全：使用 `KeepAlive` 保证付款账户不会被意外清退。
        fn deposit_from_storage(
            payer: &T::AccountId,
            amount: BalanceOf<T>,
            order_ref: T::Hash,
        ) -> DispatchResult {
            ensure!(amount != BalanceOf::<T>::default(), Error::<T>::ZeroAmount);

            let principal = Self::principal_account_id();
            <T as Config>::Currency::transfer(
                payer,
                &principal,
                amount,
                ExistenceRequirement::KeepAlive,
            )?;
            Self::deposit_event(Event::OneOffFeeReceived(payer.clone(), amount, order_ref));
            Ok(())
        }
    }

    /// 权重占位：后续通过 benchmarking 填充
    pub trait WeightInfo {
        fn publish_annual_report() -> Weight;
        fn set_params() -> Weight;
    }

    impl WeightInfo for () {
        fn publish_annual_report() -> Weight { 10_000 }
        fn set_params() -> Weight { 10_000 }
    }
}


