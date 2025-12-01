//! # 通用玄学占卜服务市场 Pallet
//!
//! 本模块实现了去中心化的占卜服务交易市场，支持多种玄学系统：
//! - 梅花易数
//! - 八字命理
//! - 六爻占卜
//! - 奇门遁甲
//! - 紫微斗数
//!
//! ## 核心功能
//!
//! 1. **服务提供者**: 注册、认证、等级晋升
//! 2. **服务套餐**: 文字/语音/视频/实时多种形式
//! 3. **订单系统**: 下单、支付、解读、评价完整流程
//! 4. **信誉机制**: 多维度评分、等级制度
//! 5. **收益管理**: 平台抽成、提现申请
//!
//! ## 架构说明
//!
//! 本模块通过 `DivinationProvider` trait 与各玄学核心模块解耦：
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                pallet-divination-market                 │
//! │    (通用服务市场、订单管理、评价系统)                      │
//! └──────────────────────────┬──────────────────────────────┘
//!                            │ DivinationProvider trait
//!                            ▼
//! ┌─────────────────────────────────────────────────────────┐
//! │              Runtime: CombinedDivinationProvider        │
//! └───────┬─────────────────────────────────────┬───────────┘
//!         │                                     │
//!         ▼                                     ▼
//! ┌───────────────┐                     ┌───────────────┐
//! │ pallet-meihua │                     │ pallet-bazi   │
//! └───────────────┘                     └───────────────┘
//! ```

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

pub mod types;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use crate::types::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, ReservableCurrency},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use pallet_divination_common::{DivinationProvider, DivinationType};
    use sp_runtime::traits::{Saturating, Zero};
    use sp_std::prelude::*;

    /// Pallet 配置 trait
    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        /// 货币类型
        type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;

        /// 占卜结果查询接口
        type DivinationProvider: DivinationProvider<Self::AccountId>;

        /// 最小保证金
        #[pallet::constant]
        type MinDeposit: Get<BalanceOf<Self>>;

        /// 最小服务价格
        #[pallet::constant]
        type MinServicePrice: Get<BalanceOf<Self>>;

        /// 订单超时时间（区块数）
        #[pallet::constant]
        type OrderTimeout: Get<BlockNumberFor<Self>>;

        /// 接单超时时间（区块数）
        #[pallet::constant]
        type AcceptTimeout: Get<BlockNumberFor<Self>>;

        /// 评价期限（区块数）
        #[pallet::constant]
        type ReviewPeriod: Get<BlockNumberFor<Self>>;

        /// 提现冷却期（区块数）
        #[pallet::constant]
        type WithdrawalCooldown: Get<BlockNumberFor<Self>>;

        /// 最大名称长度
        #[pallet::constant]
        type MaxNameLength: Get<u32>;

        /// 最大简介长度
        #[pallet::constant]
        type MaxBioLength: Get<u32>;

        /// 最大描述长度
        #[pallet::constant]
        type MaxDescriptionLength: Get<u32>;

        /// 最大 CID 长度
        #[pallet::constant]
        type MaxCidLength: Get<u32>;

        /// 每个提供者最大套餐数
        #[pallet::constant]
        type MaxPackagesPerProvider: Get<u32>;

        /// 每个订单最大追问数
        #[pallet::constant]
        type MaxFollowUpsPerOrder: Get<u32>;

        /// 平台收款账户
        #[pallet::constant]
        type PlatformAccount: Get<Self::AccountId>;

        /// 治理权限来源
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    /// 货币余额类型别名
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 提供者类型别名
    pub type ProviderOf<T> = Provider<
        <T as frame_system::Config>::AccountId,
        BalanceOf<T>,
        BlockNumberFor<T>,
        <T as Config>::MaxNameLength,
        <T as Config>::MaxBioLength,
    >;

    /// 服务套餐类型别名
    pub type ServicePackageOf<T> = ServicePackage<BalanceOf<T>, <T as Config>::MaxDescriptionLength>;

    /// 订单类型别名
    pub type OrderOf<T> = Order<
        <T as frame_system::Config>::AccountId,
        BalanceOf<T>,
        BlockNumberFor<T>,
        <T as Config>::MaxCidLength,
    >;

    /// 追问类型别名
    pub type FollowUpOf<T> = FollowUp<BlockNumberFor<T>, <T as Config>::MaxCidLength>;

    /// 评价类型别名
    pub type ReviewOf<T> = Review<
        <T as frame_system::Config>::AccountId,
        BlockNumberFor<T>,
        <T as Config>::MaxCidLength,
    >;

    /// 悬赏问题类型别名
    pub type BountyQuestionOf<T> = BountyQuestion<
        <T as frame_system::Config>::AccountId,
        BalanceOf<T>,
        BlockNumberFor<T>,
        <T as Config>::MaxCidLength,
    >;

    /// 悬赏回答类型别名
    pub type BountyAnswerOf<T> = BountyAnswer<
        <T as frame_system::Config>::AccountId,
        BalanceOf<T>,
        BlockNumberFor<T>,
        <T as Config>::MaxCidLength,
    >;

    /// 投票记录类型别名
    pub type BountyVoteOf<T> = BountyVote<
        <T as frame_system::Config>::AccountId,
        BlockNumberFor<T>,
    >;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ==================== 存储项 ====================

    /// 下一个订单 ID
    #[pallet::storage]
    #[pallet::getter(fn next_order_id)]
    pub type NextOrderId<T> = StorageValue<_, u64, ValueQuery>;

    /// 下一个提现请求 ID
    #[pallet::storage]
    #[pallet::getter(fn next_withdrawal_id)]
    pub type NextWithdrawalId<T> = StorageValue<_, u64, ValueQuery>;

    /// 提供者下一个套餐 ID
    #[pallet::storage]
    #[pallet::getter(fn next_package_id)]
    pub type NextPackageId<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

    /// 服务提供者存储
    #[pallet::storage]
    #[pallet::getter(fn providers)]
    pub type Providers<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, ProviderOf<T>>;

    /// 服务套餐存储（提供者 -> 套餐ID -> 套餐）
    #[pallet::storage]
    #[pallet::getter(fn packages)]
    pub type Packages<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        u32,
        ServicePackageOf<T>,
    >;

    /// 订单存储
    #[pallet::storage]
    #[pallet::getter(fn orders)]
    pub type Orders<T: Config> = StorageMap<_, Blake2_128Concat, u64, OrderOf<T>>;

    /// 订单追问存储
    #[pallet::storage]
    #[pallet::getter(fn follow_ups)]
    pub type FollowUps<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        BoundedVec<FollowUpOf<T>, T::MaxFollowUpsPerOrder>,
        ValueQuery,
    >;

    /// 评价存储
    #[pallet::storage]
    #[pallet::getter(fn reviews)]
    pub type Reviews<T: Config> = StorageMap<_, Blake2_128Concat, u64, ReviewOf<T>>;

    /// 提供者收入余额
    #[pallet::storage]
    #[pallet::getter(fn provider_balances)]
    pub type ProviderBalances<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BalanceOf<T>, ValueQuery>;

    /// 提现请求存储
    #[pallet::storage]
    #[pallet::getter(fn withdrawals)]
    pub type Withdrawals<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        WithdrawalRequest<T::AccountId, BalanceOf<T>, BlockNumberFor<T>>,
    >;

    /// 客户订单索引
    #[pallet::storage]
    #[pallet::getter(fn customer_orders)]
    pub type CustomerOrders<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<1000>>, ValueQuery>;

    /// 提供者订单索引
    #[pallet::storage]
    #[pallet::getter(fn provider_orders)]
    pub type ProviderOrders<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<1000>>, ValueQuery>;

    /// 市场统计
    #[pallet::storage]
    #[pallet::getter(fn market_stats)]
    pub type MarketStatistics<T: Config> = StorageValue<_, MarketStats<BalanceOf<T>>, ValueQuery>;

    /// 按占卜类型的市场统计
    #[pallet::storage]
    #[pallet::getter(fn type_stats)]
    pub type TypeStatistics<T: Config> =
        StorageMap<_, Blake2_128Concat, DivinationType, TypeMarketStats<BalanceOf<T>>, ValueQuery>;

    // ==================== 悬赏问答存储项 ====================

    /// 下一个悬赏问题 ID
    #[pallet::storage]
    #[pallet::getter(fn next_bounty_id)]
    pub type NextBountyId<T> = StorageValue<_, u64, ValueQuery>;

    /// 下一个悬赏回答 ID
    #[pallet::storage]
    #[pallet::getter(fn next_bounty_answer_id)]
    pub type NextBountyAnswerId<T> = StorageValue<_, u64, ValueQuery>;

    /// 悬赏问题存储
    #[pallet::storage]
    #[pallet::getter(fn bounty_questions)]
    pub type BountyQuestions<T: Config> = StorageMap<_, Blake2_128Concat, u64, BountyQuestionOf<T>>;

    /// 悬赏回答存储
    #[pallet::storage]
    #[pallet::getter(fn bounty_answers)]
    pub type BountyAnswers<T: Config> = StorageMap<_, Blake2_128Concat, u64, BountyAnswerOf<T>>;

    /// 悬赏问题的回答列表索引（bounty_id -> answer_ids）
    #[pallet::storage]
    #[pallet::getter(fn bounty_answer_ids)]
    pub type BountyAnswerIds<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, BoundedVec<u64, ConstU32<100>>, ValueQuery>;

    /// 用户创建的悬赏问题索引
    #[pallet::storage]
    #[pallet::getter(fn user_bounties)]
    pub type UserBounties<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<500>>, ValueQuery>;

    /// 用户提交的悬赏回答索引
    #[pallet::storage]
    #[pallet::getter(fn user_bounty_answers)]
    pub type UserBountyAnswers<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, BoundedVec<u64, ConstU32<1000>>, ValueQuery>;

    /// 悬赏投票记录（bounty_id -> voter -> vote）
    #[pallet::storage]
    #[pallet::getter(fn bounty_votes)]
    pub type BountyVotes<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        u64,
        Blake2_128Concat,
        T::AccountId,
        BountyVoteOf<T>,
    >;

    /// 悬赏问答统计
    #[pallet::storage]
    #[pallet::getter(fn bounty_stats)]
    pub type BountyStatistics<T: Config> = StorageValue<_, BountyStats<BalanceOf<T>>, ValueQuery>;

    // ==================== 事件 ====================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 提供者已注册
        ProviderRegistered {
            provider: T::AccountId,
            deposit: BalanceOf<T>,
            supported_types: u8,
        },

        /// 提供者信息已更新
        ProviderUpdated { provider: T::AccountId },

        /// 提供者已暂停
        ProviderPaused { provider: T::AccountId },

        /// 提供者已恢复
        ProviderResumed { provider: T::AccountId },

        /// 提供者已注销
        ProviderDeactivated { provider: T::AccountId },

        /// 提供者等级已提升
        ProviderTierUpgraded {
            provider: T::AccountId,
            new_tier: ProviderTier,
        },

        /// 服务套餐已创建
        PackageCreated {
            provider: T::AccountId,
            package_id: u32,
            divination_type: DivinationType,
            price: BalanceOf<T>,
        },

        /// 服务套餐已更新
        PackageUpdated {
            provider: T::AccountId,
            package_id: u32,
        },

        /// 服务套餐已删除
        PackageRemoved {
            provider: T::AccountId,
            package_id: u32,
        },

        /// 订单已创建
        OrderCreated {
            order_id: u64,
            customer: T::AccountId,
            provider: T::AccountId,
            divination_type: DivinationType,
            result_id: u64,
            amount: BalanceOf<T>,
        },

        /// 订单已支付
        OrderPaid { order_id: u64 },

        /// 订单已接受
        OrderAccepted {
            order_id: u64,
            provider: T::AccountId,
        },

        /// 订单已拒绝
        OrderRejected {
            order_id: u64,
            provider: T::AccountId,
        },

        /// 解读已提交
        AnswerSubmitted {
            order_id: u64,
            answer_cid: BoundedVec<u8, T::MaxCidLength>,
        },

        /// 订单已完成
        OrderCompleted {
            order_id: u64,
            provider_earnings: BalanceOf<T>,
            platform_fee: BalanceOf<T>,
        },

        /// 订单已取消
        OrderCancelled { order_id: u64 },

        /// 订单已退款
        OrderRefunded {
            order_id: u64,
            amount: BalanceOf<T>,
        },

        /// 追问已提交
        FollowUpSubmitted { order_id: u64, index: u32 },

        /// 追问已回复
        FollowUpAnswered { order_id: u64, index: u32 },

        /// 评价已提交
        ReviewSubmitted {
            order_id: u64,
            divination_type: DivinationType,
            rating: u8,
        },

        /// 提供者已回复评价
        ReviewReplied { order_id: u64 },

        /// 提现已申请
        WithdrawalRequested {
            withdrawal_id: u64,
            provider: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// 提现已完成
        WithdrawalCompleted { withdrawal_id: u64 },

        /// 提现已取消
        WithdrawalCancelled { withdrawal_id: u64 },

        // ==================== 悬赏问答事件 ====================

        /// 悬赏问题已创建
        BountyCreated {
            bounty_id: u64,
            creator: T::AccountId,
            divination_type: DivinationType,
            bounty_amount: BalanceOf<T>,
            deadline: BlockNumberFor<T>,
        },

        /// 悬赏回答已提交
        BountyAnswerSubmitted {
            answer_id: u64,
            bounty_id: u64,
            answerer: T::AccountId,
        },

        /// 悬赏问题已关闭（停止接受回答）
        BountyClosed { bounty_id: u64 },

        /// 悬赏答案已被投票
        BountyAnswerVoted {
            bounty_id: u64,
            answer_id: u64,
            voter: T::AccountId,
        },

        /// 悬赏答案已采纳（选择前三名）
        BountyAnswersAdopted {
            bounty_id: u64,
            first_place: u64,
            second_place: Option<u64>,
            third_place: Option<u64>,
        },

        /// 悬赏已结算（奖励已分配）
        BountySettled {
            bounty_id: u64,
            total_distributed: BalanceOf<T>,
            platform_fee: BalanceOf<T>,
            participant_count: u32,
        },

        /// 悬赏已取消
        BountyCancelled {
            bounty_id: u64,
            refund_amount: BalanceOf<T>,
        },

        /// 悬赏已过期
        BountyExpired {
            bounty_id: u64,
            refund_amount: BalanceOf<T>,
        },

        /// 悬赏奖励已发放
        BountyRewardPaid {
            bounty_id: u64,
            recipient: T::AccountId,
            amount: BalanceOf<T>,
            rank: u8, // 1=第一名, 2=第二名, 3=第三名, 0=参与奖
        },
    }

    // ==================== 错误 ====================

    #[pallet::error]
    pub enum Error<T> {
        /// 提供者已存在
        ProviderAlreadyExists,
        /// 提供者不存在
        ProviderNotFound,
        /// 提供者未激活
        ProviderNotActive,
        /// 保证金不足
        InsufficientDeposit,
        /// 套餐不存在
        PackageNotFound,
        /// 套餐已达上限
        TooManyPackages,
        /// 价格低于最低限制
        PriceTooLow,
        /// 订单不存在
        OrderNotFound,
        /// 订单状态无效
        InvalidOrderStatus,
        /// 非订单所有者
        NotOrderOwner,
        /// 非服务提供者
        NotProvider,
        /// 余额不足
        InsufficientBalance,
        /// 无追问次数
        NoFollowUpsRemaining,
        /// 追问不存在
        FollowUpNotFound,
        /// 已评价
        AlreadyReviewed,
        /// 评分无效
        InvalidRating,
        /// 评价期已过
        ReviewPeriodExpired,
        /// 提现金额无效
        InvalidWithdrawalAmount,
        /// 提现请求不存在
        WithdrawalNotFound,
        /// 名称过长
        NameTooLong,
        /// 简介过长
        BioTooLong,
        /// 描述过长
        DescriptionTooLong,
        /// CID 过长
        CidTooLong,
        /// 订单列表已满
        OrderListFull,
        /// 追问列表已满
        FollowUpListFull,
        /// 不能给自己下单
        CannotOrderSelf,
        /// 提供者已被封禁
        ProviderBanned,
        /// 占卜结果不存在
        DivinationResultNotFound,
        /// 提供者不支持该占卜类型
        DivinationTypeNotSupported,

        // ==================== 悬赏问答错误 ====================

        /// 悬赏问题不存在
        BountyNotFound,
        /// 悬赏问题不是开放状态
        BountyNotOpen,
        /// 悬赏问题已关闭
        BountyAlreadyClosed,
        /// 悬赏回答不存在
        BountyAnswerNotFound,
        /// 不能回答自己的悬赏
        CannotAnswerOwnBounty,
        /// 已经回答过该悬赏
        AlreadyAnswered,
        /// 悬赏回答数已达上限
        BountyAnswerLimitReached,
        /// 不是悬赏创建者
        NotBountyCreator,
        /// 悬赏金额过低
        BountyAmountTooLow,
        /// 悬赏已过截止时间
        BountyDeadlinePassed,
        /// 悬赏截止时间无效
        InvalidBountyDeadline,
        /// 回答数不足以采纳
        NotEnoughAnswers,
        /// 已投票
        AlreadyVoted,
        /// 悬赏已被采纳
        BountyAlreadyAdopted,
        /// 悬赏已结算
        BountyAlreadySettled,
        /// 悬赏不能取消（已有回答）
        BountyCannotCancel,
        /// 悬赏未过期
        BountyNotExpired,
        /// 仅限认证提供者
        CertifiedProviderOnly,
        /// 悬赏列表已满
        BountyListFull,
        /// 奖励分配比例无效
        InvalidRewardDistribution,
    }

    // ==================== 可调用函数 ====================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 注册成为服务提供者
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `name`: 显示名称
        /// - `bio`: 个人简介
        /// - `specialties`: 擅长领域位图
        /// - `supported_divination_types`: 支持的占卜类型位图
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn register_provider(
            origin: OriginFor<T>,
            name: Vec<u8>,
            bio: Vec<u8>,
            specialties: u16,
            supported_divination_types: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 确保未注册
            ensure!(
                !Providers::<T>::contains_key(&who),
                Error::<T>::ProviderAlreadyExists
            );

            let name_bounded: BoundedVec<u8, T::MaxNameLength> =
                BoundedVec::try_from(name).map_err(|_| Error::<T>::NameTooLong)?;
            let bio_bounded: BoundedVec<u8, T::MaxBioLength> =
                BoundedVec::try_from(bio).map_err(|_| Error::<T>::BioTooLong)?;

            // 锁定保证金
            let deposit = T::MinDeposit::get();
            T::Currency::reserve(&who, deposit)?;

            let block_number = <frame_system::Pallet<T>>::block_number();

            let provider = Provider {
                account: who.clone(),
                name: name_bounded,
                bio: bio_bounded,
                avatar_cid: None,
                tier: ProviderTier::Novice,
                status: ProviderStatus::Active,
                deposit,
                registered_at: block_number,
                total_orders: 0,
                completed_orders: 0,
                cancelled_orders: 0,
                total_ratings: 0,
                rating_sum: 0,
                total_earnings: Zero::zero(),
                specialties,
                supported_divination_types,
                accepts_urgent: false,
                last_active_at: block_number,
            };

            Providers::<T>::insert(&who, provider);

            // 更新统计
            MarketStatistics::<T>::mutate(|s| s.active_providers += 1);

            Self::deposit_event(Event::ProviderRegistered {
                provider: who,
                deposit,
                supported_types: supported_divination_types,
            });

            Ok(())
        }

        /// 更新提供者信息
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn update_provider(
            origin: OriginFor<T>,
            name: Option<Vec<u8>>,
            bio: Option<Vec<u8>>,
            avatar_cid: Option<Vec<u8>>,
            specialties: Option<u16>,
            supported_divination_types: Option<u8>,
            accepts_urgent: Option<bool>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Providers::<T>::try_mutate(&who, |maybe_provider| {
                let provider = maybe_provider.as_mut().ok_or(Error::<T>::ProviderNotFound)?;

                if let Some(n) = name {
                    provider.name =
                        BoundedVec::try_from(n).map_err(|_| Error::<T>::NameTooLong)?;
                }
                if let Some(b) = bio {
                    provider.bio = BoundedVec::try_from(b).map_err(|_| Error::<T>::BioTooLong)?;
                }
                if let Some(cid) = avatar_cid {
                    provider.avatar_cid =
                        Some(BoundedVec::try_from(cid).map_err(|_| Error::<T>::CidTooLong)?);
                }
                if let Some(s) = specialties {
                    provider.specialties = s;
                }
                if let Some(types) = supported_divination_types {
                    provider.supported_divination_types = types;
                }
                if let Some(u) = accepts_urgent {
                    provider.accepts_urgent = u;
                }

                provider.last_active_at = <frame_system::Pallet<T>>::block_number();

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::ProviderUpdated { provider: who });

            Ok(())
        }

        /// 暂停接单
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn pause_provider(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Providers::<T>::try_mutate(&who, |maybe_provider| {
                let provider = maybe_provider.as_mut().ok_or(Error::<T>::ProviderNotFound)?;
                ensure!(
                    provider.status == ProviderStatus::Active,
                    Error::<T>::ProviderNotActive
                );
                provider.status = ProviderStatus::Paused;
                Ok::<_, DispatchError>(())
            })?;

            MarketStatistics::<T>::mutate(|s| {
                s.active_providers = s.active_providers.saturating_sub(1)
            });

            Self::deposit_event(Event::ProviderPaused { provider: who });

            Ok(())
        }

        /// 恢复接单
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn resume_provider(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Providers::<T>::try_mutate(&who, |maybe_provider| {
                let provider = maybe_provider.as_mut().ok_or(Error::<T>::ProviderNotFound)?;
                ensure!(
                    provider.status == ProviderStatus::Paused,
                    Error::<T>::InvalidOrderStatus
                );
                provider.status = ProviderStatus::Active;
                provider.last_active_at = <frame_system::Pallet<T>>::block_number();
                Ok::<_, DispatchError>(())
            })?;

            MarketStatistics::<T>::mutate(|s| s.active_providers += 1);

            Self::deposit_event(Event::ProviderResumed { provider: who });

            Ok(())
        }

        /// 注销提供者（需要无进行中订单）
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn deactivate_provider(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let provider = Providers::<T>::get(&who).ok_or(Error::<T>::ProviderNotFound)?;

            // 退还保证金
            T::Currency::unreserve(&who, provider.deposit);

            // 退还余额
            let balance = ProviderBalances::<T>::take(&who);
            if !balance.is_zero() {
                T::Currency::transfer(
                    &T::PlatformAccount::get(),
                    &who,
                    balance,
                    ExistenceRequirement::KeepAlive,
                )?;
            }

            Providers::<T>::remove(&who);

            MarketStatistics::<T>::mutate(|s| {
                if provider.status == ProviderStatus::Active {
                    s.active_providers = s.active_providers.saturating_sub(1);
                }
            });

            Self::deposit_event(Event::ProviderDeactivated { provider: who });

            Ok(())
        }

        /// 创建服务套餐
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn create_package(
            origin: OriginFor<T>,
            divination_type: DivinationType,
            service_type: ServiceType,
            name: Vec<u8>,
            description: Vec<u8>,
            price: BalanceOf<T>,
            duration: u32,
            follow_up_count: u8,
            urgent_available: bool,
            urgent_surcharge: u16,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证提供者
            let provider = Providers::<T>::get(&who).ok_or(Error::<T>::ProviderNotFound)?;
            ensure!(
                provider.supports_divination_type(divination_type),
                Error::<T>::DivinationTypeNotSupported
            );
            ensure!(price >= T::MinServicePrice::get(), Error::<T>::PriceTooLow);

            let name_bounded: BoundedVec<u8, ConstU32<64>> =
                BoundedVec::try_from(name).map_err(|_| Error::<T>::NameTooLong)?;
            let desc_bounded: BoundedVec<u8, T::MaxDescriptionLength> =
                BoundedVec::try_from(description).map_err(|_| Error::<T>::DescriptionTooLong)?;

            let package_id = NextPackageId::<T>::get(&who);
            ensure!(
                package_id < T::MaxPackagesPerProvider::get(),
                Error::<T>::TooManyPackages
            );

            let package = ServicePackage {
                id: package_id,
                divination_type,
                service_type,
                name: name_bounded,
                description: desc_bounded,
                price,
                duration,
                follow_up_count,
                urgent_available,
                urgent_surcharge,
                is_active: true,
                sales_count: 0,
            };

            Packages::<T>::insert(&who, package_id, package);
            NextPackageId::<T>::insert(&who, package_id.saturating_add(1));

            Self::deposit_event(Event::PackageCreated {
                provider: who,
                package_id,
                divination_type,
                price,
            });

            Ok(())
        }

        /// 更新服务套餐
        #[pallet::call_index(6)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn update_package(
            origin: OriginFor<T>,
            package_id: u32,
            price: Option<BalanceOf<T>>,
            description: Option<Vec<u8>>,
            is_active: Option<bool>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Packages::<T>::try_mutate(&who, package_id, |maybe_package| {
                let package = maybe_package.as_mut().ok_or(Error::<T>::PackageNotFound)?;

                if let Some(p) = price {
                    ensure!(p >= T::MinServicePrice::get(), Error::<T>::PriceTooLow);
                    package.price = p;
                }
                if let Some(d) = description {
                    package.description =
                        BoundedVec::try_from(d).map_err(|_| Error::<T>::DescriptionTooLong)?;
                }
                if let Some(a) = is_active {
                    package.is_active = a;
                }

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::PackageUpdated {
                provider: who,
                package_id,
            });

            Ok(())
        }

        /// 删除服务套餐
        #[pallet::call_index(7)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn remove_package(origin: OriginFor<T>, package_id: u32) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(
                Packages::<T>::contains_key(&who, package_id),
                Error::<T>::PackageNotFound
            );
            Packages::<T>::remove(&who, package_id);

            Self::deposit_event(Event::PackageRemoved {
                provider: who,
                package_id,
            });

            Ok(())
        }

        /// 创建订单
        #[pallet::call_index(8)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn create_order(
            origin: OriginFor<T>,
            provider_account: T::AccountId,
            divination_type: DivinationType,
            result_id: u64,
            package_id: u32,
            question_cid: Vec<u8>,
            is_urgent: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 不能给自己下单
            ensure!(who != provider_account, Error::<T>::CannotOrderSelf);

            // 验证占卜结果存在
            ensure!(
                T::DivinationProvider::result_exists(divination_type, result_id),
                Error::<T>::DivinationResultNotFound
            );

            // 验证提供者
            let provider =
                Providers::<T>::get(&provider_account).ok_or(Error::<T>::ProviderNotFound)?;
            ensure!(
                provider.status == ProviderStatus::Active,
                Error::<T>::ProviderNotActive
            );
            ensure!(
                provider.status != ProviderStatus::Banned,
                Error::<T>::ProviderBanned
            );
            ensure!(
                provider.supports_divination_type(divination_type),
                Error::<T>::DivinationTypeNotSupported
            );

            // 验证套餐
            let package = Packages::<T>::get(&provider_account, package_id)
                .ok_or(Error::<T>::PackageNotFound)?;
            ensure!(package.is_active, Error::<T>::PackageNotFound);
            ensure!(
                package.divination_type == divination_type,
                Error::<T>::DivinationTypeNotSupported
            );

            // 验证加急
            if is_urgent {
                ensure!(
                    package.urgent_available && provider.accepts_urgent,
                    Error::<T>::InvalidOrderStatus
                );
            }

            let question_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(question_cid).map_err(|_| Error::<T>::CidTooLong)?;

            // 计算价格
            let mut amount = package.price;
            if is_urgent {
                let surcharge =
                    amount.saturating_mul(package.urgent_surcharge.into()) / 10000u32.into();
                amount = amount.saturating_add(surcharge);
            }

            // 计算平台手续费
            let platform_fee_rate = provider.tier.platform_fee_rate();
            let platform_fee =
                amount.saturating_mul(platform_fee_rate.into()) / 10000u32.into();

            // 扣款到平台账户（托管）
            T::Currency::transfer(
                &who,
                &T::PlatformAccount::get(),
                amount,
                ExistenceRequirement::KeepAlive,
            )?;

            let order_id = NextOrderId::<T>::get();
            NextOrderId::<T>::put(order_id.saturating_add(1));

            let block_number = <frame_system::Pallet<T>>::block_number();

            let order = Order {
                id: order_id,
                customer: who.clone(),
                provider: provider_account.clone(),
                divination_type,
                result_id,
                package_id,
                amount,
                platform_fee,
                is_urgent,
                status: OrderStatus::Paid,
                question_cid: question_cid_bounded,
                answer_cid: None,
                created_at: block_number,
                paid_at: Some(block_number),
                accepted_at: None,
                completed_at: None,
                follow_ups_remaining: package.follow_up_count,
                rating: None,
                review_cid: None,
            };

            Orders::<T>::insert(order_id, order);

            // 更新索引
            CustomerOrders::<T>::try_mutate(&who, |list| {
                list.try_push(order_id)
                    .map_err(|_| Error::<T>::OrderListFull)
            })?;
            ProviderOrders::<T>::try_mutate(&provider_account, |list| {
                list.try_push(order_id)
                    .map_err(|_| Error::<T>::OrderListFull)
            })?;

            // 更新套餐销量
            Packages::<T>::mutate(&provider_account, package_id, |maybe_package| {
                if let Some(p) = maybe_package {
                    p.sales_count += 1;
                }
            });

            // 更新统计
            MarketStatistics::<T>::mutate(|s| {
                s.total_orders += 1;
                s.total_volume = s.total_volume.saturating_add(amount);
            });
            TypeStatistics::<T>::mutate(divination_type, |s| {
                s.order_count += 1;
                s.volume = s.volume.saturating_add(amount);
            });

            Self::deposit_event(Event::OrderCreated {
                order_id,
                customer: who,
                provider: provider_account,
                divination_type,
                result_id,
                amount,
            });

            Self::deposit_event(Event::OrderPaid { order_id });

            Ok(())
        }

        /// 接受订单
        #[pallet::call_index(9)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn accept_order(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Orders::<T>::try_mutate(order_id, |maybe_order| {
                let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
                ensure!(order.provider == who, Error::<T>::NotProvider);
                ensure!(
                    order.status == OrderStatus::Paid,
                    Error::<T>::InvalidOrderStatus
                );

                order.status = OrderStatus::Accepted;
                order.accepted_at = Some(<frame_system::Pallet<T>>::block_number());

                Ok::<_, DispatchError>(())
            })?;

            // 更新提供者活跃时间
            Providers::<T>::mutate(&who, |maybe_provider| {
                if let Some(p) = maybe_provider {
                    p.last_active_at = <frame_system::Pallet<T>>::block_number();
                }
            });

            Self::deposit_event(Event::OrderAccepted {
                order_id,
                provider: who,
            });

            Ok(())
        }

        /// 拒绝订单（退款给客户）
        #[pallet::call_index(10)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn reject_order(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::OrderNotFound)?;
            ensure!(order.provider == who, Error::<T>::NotProvider);
            ensure!(
                order.status == OrderStatus::Paid,
                Error::<T>::InvalidOrderStatus
            );

            // 退款给客户
            T::Currency::transfer(
                &T::PlatformAccount::get(),
                &order.customer,
                order.amount,
                ExistenceRequirement::KeepAlive,
            )?;

            Orders::<T>::mutate(order_id, |maybe_order| {
                if let Some(o) = maybe_order {
                    o.status = OrderStatus::Cancelled;
                }
            });

            Self::deposit_event(Event::OrderRejected {
                order_id,
                provider: who,
            });

            Ok(())
        }

        /// 提交解读结果
        #[pallet::call_index(11)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn submit_answer(
            origin: OriginFor<T>,
            order_id: u64,
            answer_cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let answer_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(answer_cid.clone()).map_err(|_| Error::<T>::CidTooLong)?;

            let divination_type = Orders::<T>::try_mutate(order_id, |maybe_order| {
                let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
                ensure!(order.provider == who, Error::<T>::NotProvider);
                ensure!(
                    order.status == OrderStatus::Accepted,
                    Error::<T>::InvalidOrderStatus
                );

                order.answer_cid = Some(answer_cid_bounded.clone());
                order.status = OrderStatus::Completed;
                order.completed_at = Some(<frame_system::Pallet<T>>::block_number());

                Ok::<_, DispatchError>(order.divination_type)
            })?;

            // 结算费用
            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::OrderNotFound)?;
            let provider_earnings = order.amount.saturating_sub(order.platform_fee);

            // 转给提供者余额
            ProviderBalances::<T>::mutate(&who, |balance| {
                *balance = balance.saturating_add(provider_earnings);
            });

            // 更新提供者统计
            Providers::<T>::mutate(&who, |maybe_provider| {
                if let Some(p) = maybe_provider {
                    p.total_orders += 1;
                    p.completed_orders += 1;
                    p.total_earnings = p.total_earnings.saturating_add(provider_earnings);
                    p.last_active_at = <frame_system::Pallet<T>>::block_number();
                }
            });

            // 更新市场统计
            MarketStatistics::<T>::mutate(|s| {
                s.completed_orders += 1;
                s.platform_earnings = s.platform_earnings.saturating_add(order.platform_fee);
            });
            TypeStatistics::<T>::mutate(divination_type, |s| {
                s.completed_count += 1;
            });

            Self::deposit_event(Event::AnswerSubmitted {
                order_id,
                answer_cid: answer_cid_bounded,
            });

            Self::deposit_event(Event::OrderCompleted {
                order_id,
                provider_earnings,
                platform_fee: order.platform_fee,
            });

            Ok(())
        }

        /// 提交追问
        #[pallet::call_index(12)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn submit_follow_up(
            origin: OriginFor<T>,
            order_id: u64,
            question_cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let question_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(question_cid).map_err(|_| Error::<T>::CidTooLong)?;

            // 验证订单
            Orders::<T>::try_mutate(order_id, |maybe_order| {
                let order = maybe_order.as_mut().ok_or(Error::<T>::OrderNotFound)?;
                ensure!(order.customer == who, Error::<T>::NotOrderOwner);
                ensure!(
                    order.status == OrderStatus::Completed,
                    Error::<T>::InvalidOrderStatus
                );
                ensure!(
                    order.follow_ups_remaining > 0,
                    Error::<T>::NoFollowUpsRemaining
                );

                order.follow_ups_remaining -= 1;

                Ok::<_, DispatchError>(())
            })?;

            let follow_up = FollowUp {
                question_cid: question_cid_bounded,
                answer_cid: None,
                asked_at: <frame_system::Pallet<T>>::block_number(),
                answered_at: None,
            };

            let index = FollowUps::<T>::try_mutate(order_id, |list| {
                let idx = list.len() as u32;
                list.try_push(follow_up)
                    .map_err(|_| Error::<T>::FollowUpListFull)?;
                Ok::<u32, DispatchError>(idx)
            })?;

            Self::deposit_event(Event::FollowUpSubmitted { order_id, index });

            Ok(())
        }

        /// 回复追问
        #[pallet::call_index(13)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn answer_follow_up(
            origin: OriginFor<T>,
            order_id: u64,
            follow_up_index: u32,
            answer_cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let answer_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(answer_cid).map_err(|_| Error::<T>::CidTooLong)?;

            // 验证订单
            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::OrderNotFound)?;
            ensure!(order.provider == who, Error::<T>::NotProvider);

            FollowUps::<T>::try_mutate(order_id, |list| {
                let follow_up = list
                    .get_mut(follow_up_index as usize)
                    .ok_or(Error::<T>::FollowUpNotFound)?;
                follow_up.answer_cid = Some(answer_cid_bounded);
                follow_up.answered_at = Some(<frame_system::Pallet<T>>::block_number());
                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::FollowUpAnswered {
                order_id,
                index: follow_up_index,
            });

            Ok(())
        }

        /// 提交评价
        #[pallet::call_index(14)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn submit_review(
            origin: OriginFor<T>,
            order_id: u64,
            overall_rating: u8,
            accuracy_rating: u8,
            attitude_rating: u8,
            response_rating: u8,
            content_cid: Option<Vec<u8>>,
            is_anonymous: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证评分
            ensure!(
                overall_rating >= 1
                    && overall_rating <= 5
                    && accuracy_rating >= 1
                    && accuracy_rating <= 5
                    && attitude_rating >= 1
                    && attitude_rating <= 5
                    && response_rating >= 1
                    && response_rating <= 5,
                Error::<T>::InvalidRating
            );

            // 验证订单
            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::OrderNotFound)?;
            ensure!(order.customer == who, Error::<T>::NotOrderOwner);
            ensure!(
                order.status == OrderStatus::Completed,
                Error::<T>::InvalidOrderStatus
            );

            // 检查是否已评价
            ensure!(
                !Reviews::<T>::contains_key(order_id),
                Error::<T>::AlreadyReviewed
            );

            // 检查评价期限
            let current_block = <frame_system::Pallet<T>>::block_number();
            if let Some(completed_at) = order.completed_at {
                ensure!(
                    current_block <= completed_at + T::ReviewPeriod::get(),
                    Error::<T>::ReviewPeriodExpired
                );
            }

            let content_cid_bounded = content_cid
                .map(|cid| BoundedVec::try_from(cid).map_err(|_| Error::<T>::CidTooLong))
                .transpose()?;

            let review = Review {
                order_id,
                reviewer: who.clone(),
                reviewee: order.provider.clone(),
                divination_type: order.divination_type,
                overall_rating,
                accuracy_rating,
                attitude_rating,
                response_rating,
                content_cid: content_cid_bounded,
                created_at: current_block,
                is_anonymous,
                provider_reply_cid: None,
            };

            Reviews::<T>::insert(order_id, review);

            // 更新订单状态
            Orders::<T>::mutate(order_id, |maybe_order| {
                if let Some(o) = maybe_order {
                    o.status = OrderStatus::Reviewed;
                    o.rating = Some(overall_rating);
                }
            });

            // 更新提供者评分
            Providers::<T>::mutate(&order.provider, |maybe_provider| {
                if let Some(p) = maybe_provider {
                    p.total_ratings += 1;
                    p.rating_sum += overall_rating as u64;

                    // 检查是否可以升级
                    Self::try_upgrade_tier(p);
                }
            });

            // 更新市场统计
            MarketStatistics::<T>::mutate(|s| {
                s.total_reviews += 1;
                // 简单计算平均评分
                let total =
                    s.average_rating as u64 * (s.total_reviews - 1) + overall_rating as u64 * 100;
                s.average_rating = (total / s.total_reviews) as u16;
            });

            Self::deposit_event(Event::ReviewSubmitted {
                order_id,
                divination_type: order.divination_type,
                rating: overall_rating,
            });

            Ok(())
        }

        /// 提供者回复评价
        #[pallet::call_index(15)]
        #[pallet::weight(Weight::from_parts(25_000_000, 0))]
        pub fn reply_review(
            origin: OriginFor<T>,
            order_id: u64,
            reply_cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let reply_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(reply_cid).map_err(|_| Error::<T>::CidTooLong)?;

            Reviews::<T>::try_mutate(order_id, |maybe_review| {
                let review = maybe_review.as_mut().ok_or(Error::<T>::OrderNotFound)?;
                ensure!(review.reviewee == who, Error::<T>::NotProvider);

                review.provider_reply_cid = Some(reply_cid_bounded);

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::ReviewReplied { order_id });

            Ok(())
        }

        /// 申请提现
        #[pallet::call_index(16)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn request_withdrawal(origin: OriginFor<T>, amount: BalanceOf<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(
                Providers::<T>::contains_key(&who),
                Error::<T>::ProviderNotFound
            );

            let balance = ProviderBalances::<T>::get(&who);
            ensure!(balance >= amount, Error::<T>::InsufficientBalance);
            ensure!(!amount.is_zero(), Error::<T>::InvalidWithdrawalAmount);

            // 扣除余额
            ProviderBalances::<T>::mutate(&who, |b| {
                *b = b.saturating_sub(amount);
            });

            // 转账给提供者
            T::Currency::transfer(
                &T::PlatformAccount::get(),
                &who,
                amount,
                ExistenceRequirement::KeepAlive,
            )?;

            let withdrawal_id = NextWithdrawalId::<T>::get();
            NextWithdrawalId::<T>::put(withdrawal_id.saturating_add(1));

            let withdrawal = WithdrawalRequest {
                id: withdrawal_id,
                provider: who.clone(),
                amount,
                status: WithdrawalStatus::Completed,
                requested_at: <frame_system::Pallet<T>>::block_number(),
                processed_at: Some(<frame_system::Pallet<T>>::block_number()),
            };

            Withdrawals::<T>::insert(withdrawal_id, withdrawal);

            Self::deposit_event(Event::WithdrawalRequested {
                withdrawal_id,
                provider: who,
                amount,
            });

            Self::deposit_event(Event::WithdrawalCompleted { withdrawal_id });

            Ok(())
        }

        /// 取消订单（仅限未接单状态）
        #[pallet::call_index(17)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn cancel_order(origin: OriginFor<T>, order_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let order = Orders::<T>::get(order_id).ok_or(Error::<T>::OrderNotFound)?;
            ensure!(order.customer == who, Error::<T>::NotOrderOwner);
            ensure!(
                order.status == OrderStatus::Paid,
                Error::<T>::InvalidOrderStatus
            );

            // 退款
            T::Currency::transfer(
                &T::PlatformAccount::get(),
                &who,
                order.amount,
                ExistenceRequirement::KeepAlive,
            )?;

            Orders::<T>::mutate(order_id, |maybe_order| {
                if let Some(o) = maybe_order {
                    o.status = OrderStatus::Cancelled;
                }
            });

            Self::deposit_event(Event::OrderCancelled { order_id });

            Ok(())
        }

        // ==================== 悬赏问答可调用函数 ====================

        /// 创建悬赏问题
        ///
        /// # 参数
        /// - `divination_type`: 占卜类型
        /// - `result_id`: 关联的占卜结果 ID（可选）
        /// - `question_cid`: 问题描述 IPFS CID
        /// - `bounty_amount`: 悬赏金额
        /// - `deadline`: 截止区块
        /// - `min_answers`: 最小回答数
        /// - `max_answers`: 最大回答数
        /// - `specialty`: 擅长领域（可选）
        /// - `certified_only`: 是否仅限认证提供者回答
        /// - `allow_voting`: 是否允许社区投票
        #[pallet::call_index(18)]
        #[pallet::weight(Weight::from_parts(60_000_000, 0))]
        pub fn create_bounty(
            origin: OriginFor<T>,
            divination_type: DivinationType,
            result_id: Option<u64>,
            question_cid: Vec<u8>,
            bounty_amount: BalanceOf<T>,
            deadline: BlockNumberFor<T>,
            min_answers: u8,
            max_answers: u8,
            specialty: Option<Specialty>,
            certified_only: bool,
            allow_voting: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证悬赏金额
            ensure!(
                bounty_amount >= T::MinServicePrice::get(),
                Error::<T>::BountyAmountTooLow
            );

            // 验证截止时间
            let current_block = <frame_system::Pallet<T>>::block_number();
            ensure!(deadline > current_block, Error::<T>::InvalidBountyDeadline);

            // 验证关联占卜结果（如果提供）
            if let Some(rid) = result_id {
                ensure!(
                    T::DivinationProvider::result_exists(divination_type, rid),
                    Error::<T>::DivinationResultNotFound
                );
            }

            let question_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(question_cid).map_err(|_| Error::<T>::CidTooLong)?;

            // 转账悬赏金到平台账户托管
            T::Currency::transfer(
                &who,
                &T::PlatformAccount::get(),
                bounty_amount,
                ExistenceRequirement::KeepAlive,
            )?;

            let bounty_id = NextBountyId::<T>::get();
            NextBountyId::<T>::put(bounty_id.saturating_add(1));

            let bounty = BountyQuestion {
                id: bounty_id,
                creator: who.clone(),
                divination_type,
                result_id,
                question_cid: question_cid_bounded,
                bounty_amount,
                deadline,
                min_answers,
                max_answers,
                status: BountyStatus::Open,
                adopted_answer_id: None,
                second_place_id: None,
                third_place_id: None,
                answer_count: 0,
                reward_distribution: RewardDistribution::default(),
                created_at: current_block,
                closed_at: None,
                settled_at: None,
                specialty,
                certified_only,
                allow_voting,
                total_votes: 0,
            };

            BountyQuestions::<T>::insert(bounty_id, bounty);

            // 更新用户悬赏索引
            UserBounties::<T>::try_mutate(&who, |list| {
                list.try_push(bounty_id)
                    .map_err(|_| Error::<T>::BountyListFull)
            })?;

            // 更新统计
            BountyStatistics::<T>::mutate(|s| {
                s.total_bounties += 1;
                s.active_bounties += 1;
                s.total_bounty_amount = s.total_bounty_amount.saturating_add(bounty_amount);
            });

            Self::deposit_event(Event::BountyCreated {
                bounty_id,
                creator: who,
                divination_type,
                bounty_amount,
                deadline,
            });

            Ok(())
        }

        /// 提交悬赏回答
        ///
        /// # 参数
        /// - `bounty_id`: 悬赏问题 ID
        /// - `answer_cid`: 回答内容 IPFS CID
        #[pallet::call_index(19)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn submit_bounty_answer(
            origin: OriginFor<T>,
            bounty_id: u64,
            answer_cid: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let bounty = BountyQuestions::<T>::get(bounty_id).ok_or(Error::<T>::BountyNotFound)?;

            // 验证状态
            ensure!(bounty.status == BountyStatus::Open, Error::<T>::BountyNotOpen);

            // 验证截止时间
            let current_block = <frame_system::Pallet<T>>::block_number();
            ensure!(
                current_block <= bounty.deadline,
                Error::<T>::BountyDeadlinePassed
            );

            // 不能回答自己的悬赏
            ensure!(who != bounty.creator, Error::<T>::CannotAnswerOwnBounty);

            // 验证回答数量限制
            ensure!(
                bounty.answer_count < bounty.max_answers as u32,
                Error::<T>::BountyAnswerLimitReached
            );

            // 检查是否已回答
            let answer_ids = BountyAnswerIds::<T>::get(bounty_id);
            for answer_id in answer_ids.iter() {
                if let Some(ans) = BountyAnswers::<T>::get(answer_id) {
                    ensure!(ans.answerer != who, Error::<T>::AlreadyAnswered);
                }
            }

            // 检查认证要求
            let (is_certified, provider_tier) = if bounty.certified_only {
                let provider =
                    Providers::<T>::get(&who).ok_or(Error::<T>::CertifiedProviderOnly)?;
                ensure!(
                    provider.tier as u8 >= ProviderTier::Certified as u8,
                    Error::<T>::CertifiedProviderOnly
                );
                (true, Some(provider.tier))
            } else {
                // 非强制认证时，检查是否为提供者
                if let Some(provider) = Providers::<T>::get(&who) {
                    (provider.tier as u8 >= ProviderTier::Certified as u8, Some(provider.tier))
                } else {
                    (false, None)
                }
            };

            let answer_cid_bounded: BoundedVec<u8, T::MaxCidLength> =
                BoundedVec::try_from(answer_cid).map_err(|_| Error::<T>::CidTooLong)?;

            let answer_id = NextBountyAnswerId::<T>::get();
            NextBountyAnswerId::<T>::put(answer_id.saturating_add(1));

            let answer = BountyAnswer {
                id: answer_id,
                bounty_id,
                answerer: who.clone(),
                answer_cid: answer_cid_bounded,
                status: BountyAnswerStatus::Pending,
                votes: 0,
                reward_amount: Zero::zero(),
                submitted_at: current_block,
                is_certified,
                provider_tier,
            };

            BountyAnswers::<T>::insert(answer_id, answer);

            // 更新悬赏回答索引
            BountyAnswerIds::<T>::try_mutate(bounty_id, |list| {
                list.try_push(answer_id)
                    .map_err(|_| Error::<T>::BountyAnswerLimitReached)
            })?;

            // 更新用户回答索引
            UserBountyAnswers::<T>::try_mutate(&who, |list| {
                list.try_push(answer_id)
                    .map_err(|_| Error::<T>::BountyListFull)
            })?;

            // 更新悬赏回答数
            BountyQuestions::<T>::mutate(bounty_id, |maybe_bounty| {
                if let Some(b) = maybe_bounty {
                    b.answer_count += 1;
                }
            });

            // 更新统计
            BountyStatistics::<T>::mutate(|s| {
                s.total_answers += 1;
            });

            Self::deposit_event(Event::BountyAnswerSubmitted {
                answer_id,
                bounty_id,
                answerer: who,
            });

            Ok(())
        }

        /// 关闭悬赏（停止接受回答）
        ///
        /// 仅悬赏创建者可调用，需要达到最小回答数
        #[pallet::call_index(20)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn close_bounty(origin: OriginFor<T>, bounty_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            BountyQuestions::<T>::try_mutate(bounty_id, |maybe_bounty| {
                let bounty = maybe_bounty.as_mut().ok_or(Error::<T>::BountyNotFound)?;

                ensure!(bounty.creator == who, Error::<T>::NotBountyCreator);
                ensure!(bounty.status == BountyStatus::Open, Error::<T>::BountyAlreadyClosed);
                ensure!(
                    bounty.answer_count >= bounty.min_answers as u32,
                    Error::<T>::NotEnoughAnswers
                );

                bounty.status = BountyStatus::Closed;
                bounty.closed_at = Some(<frame_system::Pallet<T>>::block_number());

                Ok::<_, DispatchError>(())
            })?;

            // 更新统计
            BountyStatistics::<T>::mutate(|s| {
                s.active_bounties = s.active_bounties.saturating_sub(1);
            });

            Self::deposit_event(Event::BountyClosed { bounty_id });

            Ok(())
        }

        /// 投票支持回答
        ///
        /// 任何人都可以投票（如果悬赏允许投票）
        #[pallet::call_index(21)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn vote_bounty_answer(
            origin: OriginFor<T>,
            bounty_id: u64,
            answer_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let bounty = BountyQuestions::<T>::get(bounty_id).ok_or(Error::<T>::BountyNotFound)?;

            // 验证投票功能已开启
            ensure!(bounty.allow_voting, Error::<T>::InvalidOrderStatus);

            // 验证状态：Open 或 Closed 时可投票
            ensure!(
                bounty.status == BountyStatus::Open || bounty.status == BountyStatus::Closed,
                Error::<T>::BountyAlreadyAdopted
            );

            // 验证答案存在且属于该悬赏
            let answer = BountyAnswers::<T>::get(answer_id).ok_or(Error::<T>::BountyAnswerNotFound)?;
            ensure!(answer.bounty_id == bounty_id, Error::<T>::BountyAnswerNotFound);

            // 检查是否已投票
            ensure!(
                !BountyVotes::<T>::contains_key(bounty_id, &who),
                Error::<T>::AlreadyVoted
            );

            let current_block = <frame_system::Pallet<T>>::block_number();

            // 记录投票
            let vote = BountyVote {
                voter: who.clone(),
                answer_id,
                voted_at: current_block,
            };
            BountyVotes::<T>::insert(bounty_id, &who, vote);

            // 更新答案票数
            BountyAnswers::<T>::mutate(answer_id, |maybe_answer| {
                if let Some(a) = maybe_answer {
                    a.votes += 1;
                }
            });

            // 更新悬赏总票数
            BountyQuestions::<T>::mutate(bounty_id, |maybe_bounty| {
                if let Some(b) = maybe_bounty {
                    b.total_votes += 1;
                }
            });

            Self::deposit_event(Event::BountyAnswerVoted {
                bounty_id,
                answer_id,
                voter: who,
            });

            Ok(())
        }

        /// 采纳答案（选择前三名）
        ///
        /// 仅悬赏创建者可调用
        #[pallet::call_index(22)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn adopt_bounty_answers(
            origin: OriginFor<T>,
            bounty_id: u64,
            first_place: u64,
            second_place: Option<u64>,
            third_place: Option<u64>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            BountyQuestions::<T>::try_mutate(bounty_id, |maybe_bounty| {
                let bounty = maybe_bounty.as_mut().ok_or(Error::<T>::BountyNotFound)?;

                ensure!(bounty.creator == who, Error::<T>::NotBountyCreator);
                ensure!(
                    bounty.status == BountyStatus::Open || bounty.status == BountyStatus::Closed,
                    Error::<T>::BountyAlreadyAdopted
                );
                ensure!(bounty.answer_count >= 1, Error::<T>::NotEnoughAnswers);

                // 验证第一名答案
                let first_ans = BountyAnswers::<T>::get(first_place)
                    .ok_or(Error::<T>::BountyAnswerNotFound)?;
                ensure!(first_ans.bounty_id == bounty_id, Error::<T>::BountyAnswerNotFound);

                // 验证第二名答案（如果提供）
                if let Some(second_id) = second_place {
                    let second_ans = BountyAnswers::<T>::get(second_id)
                        .ok_or(Error::<T>::BountyAnswerNotFound)?;
                    ensure!(second_ans.bounty_id == bounty_id, Error::<T>::BountyAnswerNotFound);
                }

                // 验证第三名答案（如果提供）
                if let Some(third_id) = third_place {
                    let third_ans = BountyAnswers::<T>::get(third_id)
                        .ok_or(Error::<T>::BountyAnswerNotFound)?;
                    ensure!(third_ans.bounty_id == bounty_id, Error::<T>::BountyAnswerNotFound);
                }

                bounty.status = BountyStatus::Adopted;
                bounty.adopted_answer_id = Some(first_place);
                bounty.second_place_id = second_place;
                bounty.third_place_id = third_place;

                Ok::<_, DispatchError>(())
            })?;

            // 更新答案状态
            BountyAnswers::<T>::mutate(first_place, |maybe_answer| {
                if let Some(a) = maybe_answer {
                    a.status = BountyAnswerStatus::Adopted;
                }
            });

            if let Some(second_id) = second_place {
                BountyAnswers::<T>::mutate(second_id, |maybe_answer| {
                    if let Some(a) = maybe_answer {
                        a.status = BountyAnswerStatus::Selected;
                    }
                });
            }

            if let Some(third_id) = third_place {
                BountyAnswers::<T>::mutate(third_id, |maybe_answer| {
                    if let Some(a) = maybe_answer {
                        a.status = BountyAnswerStatus::Selected;
                    }
                });
            }

            Self::deposit_event(Event::BountyAnswersAdopted {
                bounty_id,
                first_place,
                second_place,
                third_place,
            });

            Ok(())
        }

        /// 结算悬赏奖励（方案B - 多人奖励）
        ///
        /// 采纳后由任何人调用执行奖励分配
        #[pallet::call_index(23)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn settle_bounty(origin: OriginFor<T>, bounty_id: u64) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            let bounty = BountyQuestions::<T>::get(bounty_id).ok_or(Error::<T>::BountyNotFound)?;

            ensure!(
                bounty.status == BountyStatus::Adopted,
                Error::<T>::InvalidOrderStatus
            );

            let first_place_id = bounty.adopted_answer_id.ok_or(Error::<T>::NotEnoughAnswers)?;

            // 计算奖励金额
            let dist = bounty.reward_distribution;
            let total = bounty.bounty_amount;
            let answer_count = bounty.answer_count;

            // 计算各名次奖励
            let first_reward = total.saturating_mul(dist.first_place.into()) / 10000u32.into();
            let second_reward = total.saturating_mul(dist.second_place.into()) / 10000u32.into();
            let third_reward = total.saturating_mul(dist.third_place.into()) / 10000u32.into();
            let platform_fee = total.saturating_mul(dist.platform_fee.into()) / 10000u32.into();
            let participation_pool =
                total.saturating_mul(dist.participation_pool.into()) / 10000u32.into();

            // 发放第一名奖励
            let first_ans =
                BountyAnswers::<T>::get(first_place_id).ok_or(Error::<T>::BountyAnswerNotFound)?;
            T::Currency::transfer(
                &T::PlatformAccount::get(),
                &first_ans.answerer,
                first_reward,
                ExistenceRequirement::KeepAlive,
            )?;
            BountyAnswers::<T>::mutate(first_place_id, |maybe_answer| {
                if let Some(a) = maybe_answer {
                    a.reward_amount = first_reward;
                }
            });
            Self::deposit_event(Event::BountyRewardPaid {
                bounty_id,
                recipient: first_ans.answerer.clone(),
                amount: first_reward,
                rank: 1,
            });

            let mut distributed = first_reward;

            // 发放第二名奖励
            if let Some(second_id) = bounty.second_place_id {
                if let Some(second_ans) = BountyAnswers::<T>::get(second_id) {
                    T::Currency::transfer(
                        &T::PlatformAccount::get(),
                        &second_ans.answerer,
                        second_reward,
                        ExistenceRequirement::KeepAlive,
                    )?;
                    BountyAnswers::<T>::mutate(second_id, |maybe_answer| {
                        if let Some(a) = maybe_answer {
                            a.reward_amount = second_reward;
                        }
                    });
                    Self::deposit_event(Event::BountyRewardPaid {
                        bounty_id,
                        recipient: second_ans.answerer,
                        amount: second_reward,
                        rank: 2,
                    });
                    distributed = distributed.saturating_add(second_reward);
                }
            }

            // 发放第三名奖励
            if let Some(third_id) = bounty.third_place_id {
                if let Some(third_ans) = BountyAnswers::<T>::get(third_id) {
                    T::Currency::transfer(
                        &T::PlatformAccount::get(),
                        &third_ans.answerer,
                        third_reward,
                        ExistenceRequirement::KeepAlive,
                    )?;
                    BountyAnswers::<T>::mutate(third_id, |maybe_answer| {
                        if let Some(a) = maybe_answer {
                            a.reward_amount = third_reward;
                        }
                    });
                    Self::deposit_event(Event::BountyRewardPaid {
                        bounty_id,
                        recipient: third_ans.answerer,
                        amount: third_reward,
                        rank: 3,
                    });
                    distributed = distributed.saturating_add(third_reward);
                }
            }

            // 计算并发放参与奖
            let top_three = [
                bounty.adopted_answer_id,
                bounty.second_place_id,
                bounty.third_place_id,
            ];
            let answer_ids = BountyAnswerIds::<T>::get(bounty_id);
            let other_participants: Vec<_> = answer_ids
                .iter()
                .filter(|id| !top_three.contains(&Some(**id)))
                .collect();

            let other_count = other_participants.len() as u32;
            if other_count > 0 {
                let per_participant = participation_pool / other_count.into();
                for answer_id in other_participants {
                    if let Some(ans) = BountyAnswers::<T>::get(answer_id) {
                        T::Currency::transfer(
                            &T::PlatformAccount::get(),
                            &ans.answerer,
                            per_participant,
                            ExistenceRequirement::KeepAlive,
                        )?;
                        BountyAnswers::<T>::mutate(answer_id, |maybe_answer| {
                            if let Some(a) = maybe_answer {
                                a.status = BountyAnswerStatus::Participated;
                                a.reward_amount = per_participant;
                            }
                        });
                        Self::deposit_event(Event::BountyRewardPaid {
                            bounty_id,
                            recipient: ans.answerer,
                            amount: per_participant,
                            rank: 0,
                        });
                        distributed = distributed.saturating_add(per_participant);
                    }
                }
            }

            // 平台手续费保留在平台账户（无需转账）
            distributed = distributed.saturating_add(platform_fee);

            // 更新悬赏状态
            BountyQuestions::<T>::mutate(bounty_id, |maybe_bounty| {
                if let Some(b) = maybe_bounty {
                    b.status = BountyStatus::Settled;
                    b.settled_at = Some(<frame_system::Pallet<T>>::block_number());
                }
            });

            // 更新统计
            BountyStatistics::<T>::mutate(|s| {
                s.settled_bounties += 1;
                s.total_rewards_paid = s.total_rewards_paid.saturating_add(distributed);
                // 更新平均回答数
                if s.settled_bounties > 0 {
                    s.avg_answers_per_bounty =
                        ((s.total_answers as u64 * 100) / s.settled_bounties) as u16;
                }
            });

            Self::deposit_event(Event::BountySettled {
                bounty_id,
                total_distributed: distributed,
                platform_fee,
                participant_count: answer_count,
            });

            Ok(())
        }

        /// 取消悬赏（仅限无回答时）
        #[pallet::call_index(24)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn cancel_bounty(origin: OriginFor<T>, bounty_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let bounty = BountyQuestions::<T>::get(bounty_id).ok_or(Error::<T>::BountyNotFound)?;

            ensure!(bounty.creator == who, Error::<T>::NotBountyCreator);
            ensure!(bounty.status == BountyStatus::Open, Error::<T>::BountyAlreadyClosed);
            ensure!(bounty.answer_count == 0, Error::<T>::BountyCannotCancel);

            // 退款
            T::Currency::transfer(
                &T::PlatformAccount::get(),
                &who,
                bounty.bounty_amount,
                ExistenceRequirement::KeepAlive,
            )?;

            // 更新状态
            BountyQuestions::<T>::mutate(bounty_id, |maybe_bounty| {
                if let Some(b) = maybe_bounty {
                    b.status = BountyStatus::Cancelled;
                }
            });

            // 更新统计
            BountyStatistics::<T>::mutate(|s| {
                s.active_bounties = s.active_bounties.saturating_sub(1);
            });

            Self::deposit_event(Event::BountyCancelled {
                bounty_id,
                refund_amount: bounty.bounty_amount,
            });

            Ok(())
        }

        /// 处理过期悬赏（任何人可调用）
        ///
        /// 超过截止时间且无人回答的悬赏可退款
        #[pallet::call_index(25)]
        #[pallet::weight(Weight::from_parts(40_000_000, 0))]
        pub fn expire_bounty(origin: OriginFor<T>, bounty_id: u64) -> DispatchResult {
            let _who = ensure_signed(origin)?;

            let bounty = BountyQuestions::<T>::get(bounty_id).ok_or(Error::<T>::BountyNotFound)?;

            ensure!(bounty.status == BountyStatus::Open, Error::<T>::BountyAlreadyClosed);

            // 验证已过期
            let current_block = <frame_system::Pallet<T>>::block_number();
            ensure!(current_block > bounty.deadline, Error::<T>::BountyNotExpired);

            // 如果有回答，不能简单过期处理，需要创建者采纳
            if bounty.answer_count > 0 {
                // 仅关闭，等待创建者采纳
                BountyQuestions::<T>::mutate(bounty_id, |maybe_bounty| {
                    if let Some(b) = maybe_bounty {
                        b.status = BountyStatus::Closed;
                        b.closed_at = Some(current_block);
                    }
                });

                BountyStatistics::<T>::mutate(|s| {
                    s.active_bounties = s.active_bounties.saturating_sub(1);
                });

                Self::deposit_event(Event::BountyClosed { bounty_id });
            } else {
                // 无回答，退款并标记过期
                T::Currency::transfer(
                    &T::PlatformAccount::get(),
                    &bounty.creator,
                    bounty.bounty_amount,
                    ExistenceRequirement::KeepAlive,
                )?;

                BountyQuestions::<T>::mutate(bounty_id, |maybe_bounty| {
                    if let Some(b) = maybe_bounty {
                        b.status = BountyStatus::Expired;
                    }
                });

                BountyStatistics::<T>::mutate(|s| {
                    s.active_bounties = s.active_bounties.saturating_sub(1);
                });

                Self::deposit_event(Event::BountyExpired {
                    bounty_id,
                    refund_amount: bounty.bounty_amount,
                });
            }

            Ok(())
        }
    }

    // ==================== 内部辅助函数 ====================

    impl<T: Config> Pallet<T> {
        /// 尝试提升提供者等级
        fn try_upgrade_tier(provider: &mut ProviderOf<T>) {
            let current_tier = provider.tier;
            let avg_rating = provider.average_rating();
            let completed = provider.completed_orders;

            let new_tier = if completed >= ProviderTier::Master.min_orders()
                && avg_rating >= ProviderTier::Master.min_rating()
            {
                ProviderTier::Master
            } else if completed >= ProviderTier::Expert.min_orders()
                && avg_rating >= ProviderTier::Expert.min_rating()
            {
                ProviderTier::Expert
            } else if completed >= ProviderTier::Senior.min_orders()
                && avg_rating >= ProviderTier::Senior.min_rating()
            {
                ProviderTier::Senior
            } else if completed >= ProviderTier::Certified.min_orders()
                && avg_rating >= ProviderTier::Certified.min_rating()
            {
                ProviderTier::Certified
            } else {
                ProviderTier::Novice
            };

            if new_tier as u8 > current_tier as u8 {
                provider.tier = new_tier;
            }
        }
    }
}
