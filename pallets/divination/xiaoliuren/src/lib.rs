//! # 小六壬排盘 Pallet
//!
//! 本模块实现了区块链上的小六壬排盘系统，提供：
//! - 时间起课（使用农历月日时起课）
//! - 数字起课（活数起课法）
//! - 随机起课（使用链上随机数）
//! - 手动指定起课
//! - 课盘存储与查询
//! - AI 解读请求（链下工作机触发）
//!
//! ## 小六壬概述
//!
//! 小六壬，又称"诸葛亮马前课"或"掐指速算"，是中国古代流传的一种简易占卜术。
//! 通过六宫（大安、留连、速喜、赤口、小吉、空亡）来预测吉凶。
//!
//! ## 六宫含义
//!
//! - **大安**：属木，临青龙，吉祥安康
//! - **留连**：属水，临玄武，延迟纠缠
//! - **速喜**：属火，临朱雀，快速喜庆
//! - **赤口**：属金，临白虎，口舌是非
//! - **小吉**：属木，临六合，和合吉利
//! - **空亡**：属土，临勾陈，无果忧虑
//!
//! ## 起课方法
//!
//! ### 1. 时间起课（传统方法）
//! 按农历月日时起课：
//! - 月宫：从大安起正月，顺数至所求月份
//! - 日宫：从月宫起初一，顺数至所求日期
//! - 时宫：从日宫起子时，顺数至所求时辰
//!
//! ### 2. 数字起课（活数起课法）
//! 取三个数字 x、y、z：
//! - 月宫 = (x - 1) % 6
//! - 日宫 = (x + y - 2) % 6
//! - 时宫 = (x + y + z - 3) % 6
//!
//! ### 3. 随机起课
//! 使用链上随机数生成三个数字，然后按数字起课法计算。

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

pub mod algorithm;
pub mod types;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use crate::algorithm;
    use crate::types::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, Randomness},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_std::prelude::*;

    // ============================================================================
    // Pallet 配置
    // ============================================================================

    /// Pallet 配置 trait
    #[pallet::config]
    pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> + pallet_timestamp::Config {
        /// 货币类型
        type Currency: Currency<Self::AccountId>;

        /// 随机数生成器
        type Randomness: Randomness<Self::Hash, BlockNumberFor<Self>>;

        /// 每个用户最多存储的课盘数量
        #[pallet::constant]
        type MaxUserPans: Get<u32>;

        /// 公开课盘列表的最大长度
        #[pallet::constant]
        type MaxPublicPans: Get<u32>;

        /// 问题 CID 最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;

        /// 每日免费起课次数
        #[pallet::constant]
        type DailyFreeDivinations: Get<u32>;

        /// 每日最大起课次数（防刷）
        #[pallet::constant]
        type MaxDailyDivinations: Get<u32>;

        /// AI 解读费用
        #[pallet::constant]
        type AiInterpretationFee: Get<BalanceOf<Self>>;

        /// 国库账户
        #[pallet::constant]
        type TreasuryAccount: Get<Self::AccountId>;

        /// AI 预言机权限来源
        type AiOracleOrigin: EnsureOrigin<Self::RuntimeOrigin>;
    }

    /// 货币余额类型别名
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ============================================================================
    // 存储项
    // ============================================================================

    /// 下一个课盘 ID
    #[pallet::storage]
    #[pallet::getter(fn next_pan_id)]
    pub type NextPanId<T> = StorageValue<_, u64, ValueQuery>;

    /// 课盘存储
    ///
    /// 键：课盘 ID
    /// 值：完整课盘结构
    #[pallet::storage]
    #[pallet::getter(fn pans)]
    pub type Pans<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        XiaoLiuRenPan<T::AccountId, BlockNumberFor<T>, T::MaxCidLen>,
    >;

    /// 用户课盘索引
    ///
    /// 键：用户账户
    /// 值：该用户的所有课盘 ID 列表
    #[pallet::storage]
    #[pallet::getter(fn user_pans)]
    pub type UserPans<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxUserPans>,
        ValueQuery,
    >;

    /// 公开课盘列表
    ///
    /// 存储所有设置为公开的课盘 ID
    #[pallet::storage]
    #[pallet::getter(fn public_pans)]
    pub type PublicPans<T: Config> =
        StorageValue<_, BoundedVec<u64, T::MaxPublicPans>, ValueQuery>;

    /// 每日起课计数
    ///
    /// 用于限制每日起课次数，防止滥用
    /// 键1：用户账户
    /// 键2：天数（从创世块起算）
    /// 值：当日起课次数
    #[pallet::storage]
    #[pallet::getter(fn daily_divination_count)]
    pub type DailyDivinationCount<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Twox64Concat,
        u32, // day number
        u32, // count
        ValueQuery,
    >;

    /// AI 解读请求队列
    ///
    /// 存储待处理的 AI 解读请求
    #[pallet::storage]
    #[pallet::getter(fn ai_interpretation_requests)]
    pub type AiInterpretationRequests<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, T::AccountId>;

    /// 用户统计数据
    #[pallet::storage]
    #[pallet::getter(fn user_stats)]
    pub type UserStatsStorage<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, UserStats, ValueQuery>;

    // ============================================================================
    // 事件
    // ============================================================================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新课盘创建成功
        /// [课盘ID, 占卜者, 起课方式]
        PanCreated {
            pan_id: u64,
            creator: T::AccountId,
            method: DivinationMethod,
        },

        /// AI 解读请求已提交
        /// [课盘ID, 请求者]
        AiInterpretationRequested {
            pan_id: u64,
            requester: T::AccountId,
        },

        /// AI 解读结果已提交
        /// [课盘ID, IPFS CID]
        AiInterpretationSubmitted {
            pan_id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        },

        /// 课盘公开状态已更改
        /// [课盘ID, 是否公开]
        PanVisibilityChanged {
            pan_id: u64,
            is_public: bool,
        },
    }

    // ============================================================================
    // 错误
    // ============================================================================

    #[pallet::error]
    pub enum Error<T> {
        /// 课盘不存在
        PanNotFound,
        /// 非课盘所有者
        NotOwner,
        /// 每日起课次数超限
        DailyLimitExceeded,
        /// 无效的农历月份（应为 1-12）
        InvalidLunarMonth,
        /// 无效的农历日期（应为 1-30）
        InvalidLunarDay,
        /// 无效的时辰（应为 0-23 小时）
        InvalidHour,
        /// 用户课盘列表已满
        UserPansFull,
        /// 公开课盘列表已满
        PublicPansFull,
        /// AI 解读费用不足
        InsufficientFee,
        /// AI 解读请求已存在
        AiRequestAlreadyExists,
        /// AI 解读请求不存在
        AiRequestNotFound,
        /// 无效的起课参数
        InvalidParams,
        /// 数字起课参数必须大于 0
        NumberMustBePositive,
    }

    // ============================================================================
    // 可调用函数
    // ============================================================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 时间起课
        ///
        /// 使用农历月日时起课，这是最传统的小六壬起课方法。
        ///
        /// # 参数
        /// - `origin`: 调用者（签名账户）
        /// - `lunar_month`: 农历月份（1-12）
        /// - `lunar_day`: 农历日期（1-30）
        /// - `hour`: 当前小时（0-23，用于计算时辰）
        /// - `question_cid`: 占卜问题的 IPFS CID（可选，隐私保护）
        /// - `is_public`: 是否公开此课盘
        ///
        /// # 算法
        /// 1. 月宫：从大安起正月，顺数至所求月份
        /// 2. 日宫：从月宫起初一，顺数至所求日期
        /// 3. 时宫：从日宫起子时，顺数至所求时辰
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_time(
            origin: OriginFor<T>,
            lunar_month: u8,
            lunar_day: u8,
            hour: u8,
            question_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数
            ensure!(lunar_month >= 1 && lunar_month <= 12, Error::<T>::InvalidLunarMonth);
            ensure!(lunar_day >= 1 && lunar_day <= 30, Error::<T>::InvalidLunarDay);
            ensure!(hour <= 23, Error::<T>::InvalidHour);

            // 计算时辰
            let shi_chen = ShiChen::from_hour(hour);

            // 使用时间起课算法
            let san_gong = algorithm::divine_by_time(lunar_month, lunar_day, shi_chen);

            // 创建课盘
            Self::create_pan(
                who,
                DivinationMethod::TimeMethod,
                san_gong,
                lunar_month,
                lunar_day,
                hour,
                Some(shi_chen),
                question_cid,
                is_public,
            )
        }

        /// 数字起课（活数起课法）
        ///
        /// 使用三个数字进行起课，适合即兴占卜。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `x`: 第一个数字（≥1）
        /// - `y`: 第二个数字（≥1）
        /// - `z`: 第三个数字（≥1）
        /// - `question_cid`: 问题 CID（可选）
        /// - `is_public`: 是否公开
        ///
        /// # 算法
        /// - 月宫 = (x - 1) % 6
        /// - 日宫 = (x + y - 2) % 6
        /// - 时宫 = (x + y + z - 3) % 6
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_number(
            origin: OriginFor<T>,
            x: u8,
            y: u8,
            z: u8,
            question_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数必须大于 0
            ensure!(x >= 1 && y >= 1 && z >= 1, Error::<T>::NumberMustBePositive);

            // 使用数字起课算法
            let san_gong = algorithm::divine_by_number(x, y, z);

            // 创建课盘
            Self::create_pan(
                who,
                DivinationMethod::NumberMethod,
                san_gong,
                x,
                y,
                z,
                None,
                question_cid,
                is_public,
            )
        }

        /// 随机起课
        ///
        /// 使用链上随机数生成卦象，适合无特定数字时使用。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `question_cid`: 问题 CID（可选）
        /// - `is_public`: 是否公开
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_random(
            origin: OriginFor<T>,
            question_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 使用链上随机源
            let random_seed = T::Randomness::random(&b"xiaoliuren"[..]).0;
            let random_bytes: [u8; 32] = random_seed
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            // 获取起课参数
            let (x, y, z) = algorithm::random_to_params(&random_bytes);

            // 使用随机起课算法
            let san_gong = algorithm::divine_random(&random_bytes);

            // 创建课盘
            Self::create_pan(
                who,
                DivinationMethod::RandomMethod,
                san_gong,
                x,
                y,
                z,
                None,
                question_cid,
                is_public,
            )
        }

        /// 手动指定起课
        ///
        /// 直接指定三宫结果，用于已知课盘的记录。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `yue_index`: 月宫索引（0-5）
        /// - `ri_index`: 日宫索引（0-5）
        /// - `shi_index`: 时宫索引（0-5）
        /// - `question_cid`: 问题 CID（可选）
        /// - `is_public`: 是否公开
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            yue_index: u8,
            ri_index: u8,
            shi_index: u8,
            question_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数（索引 0-5）
            ensure!(yue_index <= 5 && ri_index <= 5 && shi_index <= 5, Error::<T>::InvalidParams);

            // 使用手动指定算法
            let san_gong = algorithm::divine_manual(yue_index, ri_index, shi_index);

            // 创建课盘
            Self::create_pan(
                who,
                DivinationMethod::ManualMethod,
                san_gong,
                yue_index,
                ri_index,
                shi_index,
                None,
                question_cid,
                is_public,
            )
        }

        /// 请求 AI 解读
        ///
        /// 为指定课盘请求 AI 解读服务，需支付费用。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `pan_id`: 课盘 ID
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn request_ai_interpretation(
            origin: OriginFor<T>,
            pan_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证课盘存在且为调用者所有
            let pan = Pans::<T>::get(pan_id)
                .ok_or(Error::<T>::PanNotFound)?;
            ensure!(pan.creator == who, Error::<T>::NotOwner);

            // 检查是否已有请求
            ensure!(
                !AiInterpretationRequests::<T>::contains_key(pan_id),
                Error::<T>::AiRequestAlreadyExists
            );

            // 扣除 AI 解读费用
            T::Currency::transfer(
                &who,
                &T::TreasuryAccount::get(),
                T::AiInterpretationFee::get(),
                ExistenceRequirement::KeepAlive,
            )?;

            // 记录请求
            AiInterpretationRequests::<T>::insert(pan_id, who.clone());

            // 更新用户统计
            UserStatsStorage::<T>::mutate(&who, |stats| {
                stats.ai_interpretations = stats.ai_interpretations.saturating_add(1);
            });

            // 发送事件触发链下工作机
            Self::deposit_event(Event::AiInterpretationRequested {
                pan_id,
                requester: who,
            });

            Ok(())
        }

        /// 提交 AI 解读结果（仅限授权节点）
        ///
        /// AI 预言机节点提交解读结果的 IPFS CID。
        ///
        /// # 参数
        /// - `origin`: AI 预言机授权来源
        /// - `pan_id`: 课盘 ID
        /// - `interpretation_cid`: 解读内容的 IPFS CID
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn submit_ai_interpretation(
            origin: OriginFor<T>,
            pan_id: u64,
            interpretation_cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            // 验证 AI 预言机权限
            T::AiOracleOrigin::ensure_origin(origin)?;

            // 验证请求存在
            ensure!(
                AiInterpretationRequests::<T>::contains_key(pan_id),
                Error::<T>::AiRequestNotFound
            );

            // 更新课盘的 AI 解读 CID
            Pans::<T>::try_mutate(pan_id, |maybe_pan| {
                let pan = maybe_pan
                    .as_mut()
                    .ok_or(Error::<T>::PanNotFound)?;
                pan.ai_interpretation_cid = Some(interpretation_cid.clone());
                Ok::<_, DispatchError>(())
            })?;

            // 移除请求
            AiInterpretationRequests::<T>::remove(pan_id);

            Self::deposit_event(Event::AiInterpretationSubmitted {
                pan_id,
                cid: interpretation_cid,
            });

            Ok(())
        }

        /// 更改课盘公开状态
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `pan_id`: 课盘 ID
        /// - `is_public`: 是否公开
        #[pallet::call_index(6)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn set_pan_visibility(
            origin: OriginFor<T>,
            pan_id: u64,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Pans::<T>::try_mutate(pan_id, |maybe_pan| {
                let pan = maybe_pan
                    .as_mut()
                    .ok_or(Error::<T>::PanNotFound)?;
                ensure!(pan.creator == who, Error::<T>::NotOwner);

                let was_public = pan.is_public;
                pan.is_public = is_public;

                // 更新公开课盘列表
                if is_public && !was_public {
                    // 添加到公开列表
                    PublicPans::<T>::try_mutate(|list| {
                        list.try_push(pan_id)
                            .map_err(|_| Error::<T>::PublicPansFull)
                    })?;
                } else if !is_public && was_public {
                    // 从公开列表移除
                    PublicPans::<T>::mutate(|list| {
                        list.retain(|&id| id != pan_id);
                    });
                }

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::PanVisibilityChanged {
                pan_id,
                is_public,
            });

            Ok(())
        }
    }

    // ============================================================================
    // 内部辅助函数
    // ============================================================================

    impl<T: Config> Pallet<T> {
        /// 获取当前时间戳（秒）
        fn get_timestamp_secs() -> u64 {
            let moment = pallet_timestamp::Pallet::<T>::get();
            let ms: u64 = moment.try_into().unwrap_or(0);
            ms / 1000
        }

        /// 检查每日起课次数限制
        fn check_daily_limit(who: &T::AccountId) -> DispatchResult {
            let today = Self::current_day();
            let count = DailyDivinationCount::<T>::get(who, today);

            ensure!(
                count < T::MaxDailyDivinations::get(),
                Error::<T>::DailyLimitExceeded
            );

            // 更新计数
            DailyDivinationCount::<T>::insert(who, today, count + 1);
            Ok(())
        }

        /// 获取当前天数（从创世块起算）
        fn current_day() -> u32 {
            let timestamp = Self::get_timestamp_secs();
            (timestamp / 86400) as u32
        }

        /// 创建课盘并存储
        #[allow(clippy::too_many_arguments)]
        fn create_pan(
            creator: T::AccountId,
            method: DivinationMethod,
            san_gong: SanGong,
            param1: u8,
            param2: u8,
            param3: u8,
            shi_chen: Option<ShiChen>,
            question_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            is_public: bool,
        ) -> DispatchResult {
            // 获取新的课盘 ID
            let pan_id = NextPanId::<T>::get();
            NextPanId::<T>::put(pan_id.saturating_add(1));

            // 获取当前区块号
            let block_number = <frame_system::Pallet<T>>::block_number();

            // 提取农历信息（如果是时间起课）
            let (lunar_month, lunar_day) = if method == DivinationMethod::TimeMethod {
                (Some(param1), Some(param2))
            } else {
                (None, None)
            };

            // 创建课盘结构
            let pan = XiaoLiuRenPan {
                id: pan_id,
                creator: creator.clone(),
                created_at: block_number,
                method: method.clone(),
                question_cid,
                param1,
                param2,
                param3,
                lunar_month,
                lunar_day,
                shi_chen,
                san_gong,
                is_public,
                ai_interpretation_cid: None,
            };

            // 存储课盘
            Pans::<T>::insert(pan_id, pan);

            // 更新用户课盘索引
            UserPans::<T>::try_mutate(&creator, |list| {
                list.try_push(pan_id)
                    .map_err(|_| Error::<T>::UserPansFull)
            })?;

            // 如果公开，添加到公开列表
            if is_public {
                PublicPans::<T>::try_mutate(|list| {
                    list.try_push(pan_id)
                        .map_err(|_| Error::<T>::PublicPansFull)
                })?;
            }

            // 更新用户统计
            UserStatsStorage::<T>::mutate(&creator, |stats| {
                if stats.total_pans == 0 {
                    // 首次起课
                    let block_num: u32 = block_number.try_into().unwrap_or(0);
                    stats.first_pan_block = block_num;
                }
                stats.total_pans = stats.total_pans.saturating_add(1);
            });

            // 发送事件
            Self::deposit_event(Event::PanCreated {
                pan_id,
                creator,
                method,
            });

            Ok(())
        }

        /// 获取课盘详细分析
        pub fn get_pan_analysis(pan_id: u64) -> Option<algorithm::SanGongAnalysis> {
            Pans::<T>::get(pan_id).map(|pan| algorithm::analyze_san_gong(&pan.san_gong))
        }
    }
}

// ============================================================================
// DivinationProvider trait 实现（供 pallet-divination-common 使用）
// ============================================================================

use pallet_divination_common::{
    DivinationProvider, DivinationType, RarityInput,
};

/// 小六壬占卜提供者实现
pub struct XiaoLiuRenDivinationProvider<T>(sp_std::marker::PhantomData<T>);

impl<T: pallet::Config> DivinationProvider<T::AccountId> for XiaoLiuRenDivinationProvider<T> {
    /// 检查结果是否存在
    fn result_exists(divination_type: DivinationType, result_id: u64) -> bool {
        if divination_type == DivinationType::XiaoLiuRen {
            pallet::Pans::<T>::contains_key(result_id)
        } else {
            false
        }
    }

    /// 获取结果创建者
    fn result_creator(divination_type: DivinationType, result_id: u64) -> Option<T::AccountId> {
        if divination_type == DivinationType::XiaoLiuRen {
            pallet::Pans::<T>::get(result_id).map(|pan| pan.creator)
        } else {
            None
        }
    }

    /// 获取稀有度数据
    fn rarity_data(divination_type: DivinationType, result_id: u64) -> Option<RarityInput> {
        if divination_type == DivinationType::XiaoLiuRen {
            pallet::Pans::<T>::get(result_id).map(|pan| {
                let san_gong = &pan.san_gong;

                // 计算稀有度分数
                let primary_score = if san_gong.is_pure() {
                    // 纯宫（三宫相同）非常稀有
                    90u8
                } else if san_gong.is_all_auspicious() {
                    // 全吉
                    70u8
                } else if san_gong.is_all_inauspicious() {
                    // 全凶
                    60u8
                } else {
                    // 普通
                    30u8
                };

                let secondary_score = san_gong.fortune_level() * 10;

                RarityInput {
                    primary_score,
                    secondary_score,
                    is_special_date: false, // 可以扩展检查特殊日期
                    is_special_combination: san_gong.is_pure(),
                    custom_factors: [0, 0, 0, 0],
                }
            })
        } else {
            None
        }
    }

    /// 获取占卜结果摘要
    fn result_summary(divination_type: DivinationType, result_id: u64) -> Option<sp_std::vec::Vec<u8>> {
        if divination_type == DivinationType::XiaoLiuRen {
            pallet::Pans::<T>::get(result_id).map(|pan| {
                // 返回三宫结果的简要描述
                let summary = sp_std::vec![
                    pan.san_gong.yue_gong.index(),
                    pan.san_gong.ri_gong.index(),
                    pan.san_gong.shi_gong.index(),
                    pan.san_gong.fortune_level(),
                    if pan.san_gong.is_pure() { 1 } else { 0 },
                    if pan.san_gong.is_all_auspicious() { 1 } else { 0 },
                ];
                summary
            })
        } else {
            None
        }
    }

    /// 检查占卜结果是否可以铸造为 NFT
    fn is_nftable(divination_type: DivinationType, result_id: u64) -> bool {
        if divination_type == DivinationType::XiaoLiuRen {
            // 检查结果存在且公开
            pallet::Pans::<T>::get(result_id)
                .map(|pan| pan.is_public)
                .unwrap_or(false)
        } else {
            false
        }
    }

    /// 标记占卜结果已被铸造为 NFT
    fn mark_as_nfted(_divination_type: DivinationType, _result_id: u64) {
        // 小六壬暂不实现 NFT 标记，因为课盘结构中没有 is_nfted 字段
        // 如需此功能，可以添加额外存储项
    }
}
