// 函数级详细中文注释：治理参数集中管理模块
//
// ### 功能概述
// - 集中管理所有治理相关参数（押金、期限、费率、阈值）
// - 提供治理投票机制调整参数
// - 统一参数查询接口
// - 支持参数变更事件通知
//
// ### 设计理念
// - 单一参数源：所有治理参数集中管理
// - 治理调整：参数变更需要治理投票
// - 版本管理：记录参数变更历史
// - 向后兼容：保持接口稳定

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

/// 函数级详细中文注释：权重信息trait
/// - 定义所有可调用函数的权重
/// - 可以使用()占位实现，或通过benchmark生成
pub trait WeightInfo {
    fn update_appeal_deposit_params() -> frame_support::weights::Weight;
    fn update_complaint_deposit_params() -> frame_support::weights::Weight;
    fn update_non_owner_operation_deposit_params() -> frame_support::weights::Weight;
    fn update_period_params() -> frame_support::weights::Weight;
    fn update_rate_params() -> frame_support::weights::Weight;
    fn update_threshold_params() -> frame_support::weights::Weight;
}

/// 函数级详细中文注释：占位实现（用于开发阶段）
/// - 所有操作使用固定权重10_000
impl WeightInfo for () {
    fn update_appeal_deposit_params() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_complaint_deposit_params() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_non_owner_operation_deposit_params() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_period_params() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_rate_params() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
    fn update_threshold_params() -> frame_support::weights::Weight {
        frame_support::weights::Weight::from_parts(10_000, 0)
    }
}

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency},
    };
    use frame_system::pallet_prelude::*;
    use crate::WeightInfo;

    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级详细中文注释：押金参数类型
    /// - base: 基础押金
    /// - min: 最小押金
    /// - max: 最大押金
    /// - factor: 押金计算因子（用于动态计算）
    #[derive(Encode, Decode, codec::DecodeWithMemTracking, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub struct DepositParams<Balance> {
        pub base: Balance,
        pub min: Balance,
        pub max: Balance,
        pub factor: u32,
    }

    impl<Balance: Default> Default for DepositParams<Balance> {
        fn default() -> Self {
            Self {
                base: Balance::default(),
                min: Balance::default(),
                max: Balance::default(),
                factor: 100,
            }
        }
    }

    /// 函数级详细中文注释：期限参数类型（以区块数计）
    /// - notice_period: 公示期（申诉批准后的公示期）
    /// - voting_period: 投票期（提案投票期）
    /// - execution_delay: 执行延迟（提案执行延迟期）
    /// - complaint_period: 投诉期（内容可被投诉的期限）
    #[derive(Encode, Decode, codec::DecodeWithMemTracking, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub struct PeriodParams<BlockNumber> {
        pub notice_period: BlockNumber,
        pub voting_period: BlockNumber,
        pub execution_delay: BlockNumber,
        pub complaint_period: BlockNumber,
    }

    impl<BlockNumber: Default> Default for PeriodParams<BlockNumber> {
        fn default() -> Self {
            Self {
                notice_period: BlockNumber::default(),
                voting_period: BlockNumber::default(),
                execution_delay: BlockNumber::default(),
                complaint_period: BlockNumber::default(),
            }
        }
    }

    /// 函数级详细中文注释：费率参数类型（以千分之为单位）
    /// - complainant_share: 投诉成功时投诉人分配比例
    /// - committee_share: 投诉成功时委员会分配比例
    /// - owner_share: 投诉失败时拥有者分配比例
    #[derive(Encode, Decode, codec::DecodeWithMemTracking, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub struct RateParams {
        #[codec(compact)]
        pub complainant_share: u32,
        #[codec(compact)]
        pub committee_share: u32,
        #[codec(compact)]
        pub owner_share: u32,
    }

    impl Default for RateParams {
        fn default() -> Self {
            Self {
                complainant_share: 800, // 80%
                committee_share: 200,   // 20%
                owner_share: 800,       // 80%
            }
        }
    }

    /// 函数级详细中文注释：阈值参数类型
    /// - proposal_threshold: 提案创建门槛（代币持有量）
    /// - voting_threshold: 投票通过门槛（百分比）
    /// - arbitration_threshold: 仲裁费用门槛
    #[derive(Encode, Decode, codec::DecodeWithMemTracking, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
    pub struct ThresholdParams<Balance> {
        pub proposal_threshold: Balance,
        pub voting_threshold: u32,
        pub arbitration_threshold: Balance,
    }

    impl<Balance: Default> Default for ThresholdParams<Balance> {
        fn default() -> Self {
            Self {
                proposal_threshold: Balance::default(),
                voting_threshold: 51, // 51%
                arbitration_threshold: Balance::default(),
            }
        }
    }

    #[pallet::config]
    pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        /// 函数级详细中文注释：治理起源（Root或委员会）
        /// 仅治理起源可以修改参数
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级详细中文注释：权重信息
        /// - 开发阶段可以使用()占位
        /// - 生产环境应该通过benchmark生成
        type WeightInfo: crate::WeightInfo;
    }

    /// 函数级详细中文注释：Pallet定义
    /// - 参数管理的核心结构
    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// 函数级详细中文注释：申诉押金参数
    #[pallet::storage]
    #[pallet::getter(fn appeal_deposit_params)]
    pub type AppealDepositParams<T: Config> =
        StorageValue<_, DepositParams<BalanceOf<T>>, ValueQuery>;

    /// 函数级详细中文注释：投诉押金参数
    #[pallet::storage]
    #[pallet::getter(fn complaint_deposit_params)]
    pub type ComplaintDepositParams<T: Config> =
        StorageValue<_, DepositParams<BalanceOf<T>>, ValueQuery>;

    /// 函数级详细中文注释：非拥有者操作押金参数
    #[pallet::storage]
    #[pallet::getter(fn non_owner_operation_deposit_params)]
    pub type NonOwnerOperationDepositParams<T: Config> =
        StorageValue<_, DepositParams<BalanceOf<T>>, ValueQuery>;

    /// 函数级详细中文注释：期限参数
    #[pallet::storage]
    #[pallet::getter(fn period_params)]
    pub type PeriodParamsStorage<T: Config> =
        StorageValue<_, PeriodParams<BlockNumberFor<T>>, ValueQuery>;

    /// 函数级详细中文注释：费率参数
    #[pallet::storage]
    #[pallet::getter(fn rate_params)]
    pub type RateParamsStorage<T: Config> = StorageValue<_, RateParams, ValueQuery>;

    /// 函数级详细中文注释：阈值参数
    #[pallet::storage]
    #[pallet::getter(fn threshold_params)]
    pub type ThresholdParamsStorage<T: Config> =
        StorageValue<_, ThresholdParams<BalanceOf<T>>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级详细中文注释：申诉押金参数已更新
        AppealDepositParamsUpdated {
            old: DepositParams<BalanceOf<T>>,
            new: DepositParams<BalanceOf<T>>,
        },
        /// 函数级详细中文注释：投诉押金参数已更新
        ComplaintDepositParamsUpdated {
            old: DepositParams<BalanceOf<T>>,
            new: DepositParams<BalanceOf<T>>,
        },
        /// 函数级详细中文注释：非拥有者操作押金参数已更新
        NonOwnerOperationDepositParamsUpdated {
            old: DepositParams<BalanceOf<T>>,
            new: DepositParams<BalanceOf<T>>,
        },
        /// 函数级详细中文注释：期限参数已更新
        PeriodParamsUpdated {
            old: PeriodParams<BlockNumberFor<T>>,
            new: PeriodParams<BlockNumberFor<T>>,
        },
        /// 函数级详细中文注释：费率参数已更新
        RateParamsUpdated { old: RateParams, new: RateParams },
        /// 函数级详细中文注释：阈值参数已更新
        ThresholdParamsUpdated {
            old: ThresholdParams<BalanceOf<T>>,
            new: ThresholdParams<BalanceOf<T>>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 函数级详细中文注释：无效的参数值
        InvalidParams,
        /// 函数级详细中文注释：无权限操作
        NoPermission,
    }

    // 函数级详细中文注释：GenesisConfig移除说明
    //
    // ## 设计决策
    // - 治理参数不使用GenesisConfig初始化
    // - 原因：GenesisConfig需要serde序列化，与泛型Balance/BlockNumber冲突
    //
    // ## 初始化方案
    // - 存储项使用ValueQuery + Default trait自动初始化为默认值
    // - 链启动后，通过Root或治理提案调用update_*函数设置实际参数
    // - 这是Substrate推荐的治理参数管理模式
    //
    // ## 优势
    // - 避免GenesisConfig序列化问题
    // - 参数可通过治理民主调整，而非硬编码在genesis
    // - 符合去中心化治理原则
    //
    // GenesisConfig移除 - 使用Default trait自动初始化

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：更新申诉押金参数
        ///
        /// 参数：
        /// - origin: 治理起源
        /// - new_params: 新的押金参数
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::update_appeal_deposit_params())]
        pub fn update_appeal_deposit_params(
            origin: OriginFor<T>,
            new_params: DepositParams<BalanceOf<T>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            ensure!(
                new_params.min <= new_params.base && new_params.base <= new_params.max,
                Error::<T>::InvalidParams
            );

            let old_params = AppealDepositParams::<T>::get();
            AppealDepositParams::<T>::put(&new_params);

            Self::deposit_event(Event::AppealDepositParamsUpdated {
                old: old_params,
                new: new_params,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新投诉押金参数
        #[pallet::call_index(1)]
        #[pallet::weight(T::WeightInfo::update_complaint_deposit_params())]
        pub fn update_complaint_deposit_params(
            origin: OriginFor<T>,
            new_params: DepositParams<BalanceOf<T>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            ensure!(
                new_params.min <= new_params.base && new_params.base <= new_params.max,
                Error::<T>::InvalidParams
            );

            let old_params = ComplaintDepositParams::<T>::get();
            ComplaintDepositParams::<T>::put(&new_params);

            Self::deposit_event(Event::ComplaintDepositParamsUpdated {
                old: old_params,
                new: new_params,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新非拥有者操作押金参数
        #[pallet::call_index(2)]
        #[pallet::weight(T::WeightInfo::update_non_owner_operation_deposit_params())]
        pub fn update_non_owner_operation_deposit_params(
            origin: OriginFor<T>,
            new_params: DepositParams<BalanceOf<T>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            ensure!(
                new_params.min <= new_params.base && new_params.base <= new_params.max,
                Error::<T>::InvalidParams
            );

            let old_params = NonOwnerOperationDepositParams::<T>::get();
            NonOwnerOperationDepositParams::<T>::put(&new_params);

            Self::deposit_event(Event::NonOwnerOperationDepositParamsUpdated {
                old: old_params,
                new: new_params,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新期限参数
        #[pallet::call_index(3)]
        #[pallet::weight(T::WeightInfo::update_period_params())]
        pub fn update_period_params(
            origin: OriginFor<T>,
            new_params: PeriodParams<BlockNumberFor<T>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            let old_params = PeriodParamsStorage::<T>::get();
            PeriodParamsStorage::<T>::put(&new_params);

            Self::deposit_event(Event::PeriodParamsUpdated {
                old: old_params,
                new: new_params,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新费率参数
        #[pallet::call_index(4)]
        #[pallet::weight(T::WeightInfo::update_rate_params())]
        pub fn update_rate_params(
            origin: OriginFor<T>,
            new_params: RateParams,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            ensure!(
                new_params.complainant_share + new_params.committee_share <= 1000,
                Error::<T>::InvalidParams
            );

            let old_params = RateParamsStorage::<T>::get();
            RateParamsStorage::<T>::put(&new_params);

            Self::deposit_event(Event::RateParamsUpdated {
                old: old_params,
                new: new_params,
            });

            Ok(())
        }

        /// 函数级详细中文注释：更新阈值参数
        #[pallet::call_index(5)]
        #[pallet::weight(T::WeightInfo::update_threshold_params())]
        pub fn update_threshold_params(
            origin: OriginFor<T>,
            new_params: ThresholdParams<BalanceOf<T>>,
        ) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;

            ensure!(
                new_params.voting_threshold > 0 && new_params.voting_threshold <= 100,
                Error::<T>::InvalidParams
            );

            let old_params = ThresholdParamsStorage::<T>::get();
            ThresholdParamsStorage::<T>::put(&new_params);

            Self::deposit_event(Event::ThresholdParamsUpdated {
                old: old_params,
                new: new_params,
            });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：获取申诉基础押金
        pub fn get_appeal_base_deposit() -> BalanceOf<T> {
            Self::appeal_deposit_params().base
        }

        /// 函数级详细中文注释：获取申诉最小押金
        pub fn get_appeal_min_deposit() -> BalanceOf<T> {
            Self::appeal_deposit_params().min
        }

        /// 函数级详细中文注释：获取申诉最大押金
        pub fn get_appeal_max_deposit() -> BalanceOf<T> {
            Self::appeal_deposit_params().max
        }

        /// 函数级详细中文注释：获取投诉基础押金
        pub fn get_complaint_base_deposit() -> BalanceOf<T> {
            Self::complaint_deposit_params().base
        }

        /// 函数级详细中文注释：获取投诉最小押金
        pub fn get_complaint_min_deposit() -> BalanceOf<T> {
            Self::complaint_deposit_params().min
        }

        /// 函数级详细中文注释：获取非拥有者操作基础押金
        pub fn get_non_owner_operation_base_deposit() -> BalanceOf<T> {
            Self::non_owner_operation_deposit_params().base
        }

        /// 函数级详细中文注释：获取公示期
        pub fn get_notice_period() -> BlockNumberFor<T> {
            Self::period_params().notice_period
        }

        /// 函数级详细中文注释：获取投票期
        pub fn get_voting_period() -> BlockNumberFor<T> {
            Self::period_params().voting_period
        }

        /// 函数级详细中文注释：获取执行延迟
        pub fn get_execution_delay() -> BlockNumberFor<T> {
            Self::period_params().execution_delay
        }

        /// 函数级详细中文注释：获取投诉期
        pub fn get_complaint_period() -> BlockNumberFor<T> {
            Self::period_params().complaint_period
        }

        /// 函数级详细中文注释：获取投诉人分配比例
        pub fn get_complainant_share() -> u32 {
            Self::rate_params().complainant_share
        }

        /// 函数级详细中文注释：获取委员会分配比例
        pub fn get_committee_share() -> u32 {
            Self::rate_params().committee_share
        }

        /// 函数级详细中文注释：获取拥有者分配比例
        pub fn get_owner_share() -> u32 {
            Self::rate_params().owner_share
        }

        /// 函数级详细中文注释：获取提案门槛
        pub fn get_proposal_threshold() -> BalanceOf<T> {
            Self::threshold_params().proposal_threshold
        }

        /// 函数级详细中文注释：获取投票通过门槛
        pub fn get_voting_threshold() -> u32 {
            Self::threshold_params().voting_threshold
        }

        /// 函数级详细中文注释：获取仲裁费用门槛
        pub fn get_arbitration_threshold() -> BalanceOf<T> {
            Self::threshold_params().arbitration_threshold
        }
    }
}
