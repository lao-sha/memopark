//! # pallet-ziwei
//!
//! ## 紫微斗数排盘系统 - 区块链星命学模块
//!
//! 本模块实现完整的紫微斗数排盘算法，支持链上命盘生成与存储。
//!
//! ### 核心功能
//!
//! - **命盘排布**：根据出生时间计算完整命盘
//! - **十四主星**：紫微星系6星 + 天府星系8星
//! - **辅星系统**：六吉星、六煞星、四化飞星
//! - **大运推算**：起运年龄和大运顺逆
//! - **AI 解读**：集成通用占卜 AI 解读系统
//!
//! ### 技术架构
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    pallet-ziwei                              │
//! ├─────────────────────────────────────────────────────────────┤
//! │  Extrinsics:                                                 │
//! │  - divine_by_time: 时间起盘                                   │
//! │  - divine_manual: 手动指定                                    │
//! │  - divine_random: 随机起盘                                    │
//! │  - request_ai_interpretation: 请求AI解读                      │
//! ├─────────────────────────────────────────────────────────────┤
//! │  Algorithm:                                                  │
//! │  - 命宫定位算法                                               │
//! │  - 五行局计算                                                 │
//! │  - 紫微/天府星系安星                                          │
//! │  - 六吉六煞定位                                               │
//! │  - 四化飞星                                                   │
//! ├─────────────────────────────────────────────────────────────┤
//! │  Integration:                                                │
//! │  - pallet-divination-common                                  │
//! │  - pallet-divination-ai                                      │
//! │  - pallet-divination-nft                                     │
//! │  - pallet-divination-market                                  │
//! └─────────────────────────────────────────────────────────────┘
//! ```

#![cfg_attr(not(feature = "std"), no_std)]

pub mod algorithm;
pub mod interpretation;
pub mod runtime_api;
pub mod types;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

pub use pallet::*;
pub use types::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use crate::algorithm::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, Randomness},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::traits::Zero;

    /// 余额类型别名
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Pallet 配置 trait
    ///
    /// 注：RuntimeEvent 关联类型已从 Polkadot SDK 2506 版本开始自动附加，
    /// 无需在此显式声明。系统会自动添加：
    /// `frame_system::Config<RuntimeEvent: From<Event<Self>>>`
    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        /// 货币类型
        type Currency: Currency<Self::AccountId>;

        /// 随机数生成器
        type Randomness: Randomness<Self::Hash, BlockNumberFor<Self>>;

        /// 每用户最大命盘数量
        #[pallet::constant]
        type MaxUserCharts: Get<u32>;

        /// 公开列表最大长度
        #[pallet::constant]
        type MaxPublicCharts: Get<u32>;

        /// 每日免费排盘次数
        #[pallet::constant]
        type DailyFreeCharts: Get<u32>;

        /// 每日最大排盘次数
        #[pallet::constant]
        type MaxDailyCharts: Get<u32>;

        /// AI 解读费用
        #[pallet::constant]
        type AiInterpretationFee: Get<BalanceOf<Self>>;

        /// 国库账户
        type TreasuryAccount: Get<Self::AccountId>;

        /// AI 预言机权限
        type AiOracleOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// IPFS CID 最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
    }

    // ========================================================================
    // 存储项
    // ========================================================================

    /// 下一个命盘 ID
    #[pallet::storage]
    #[pallet::getter(fn next_chart_id)]
    pub type NextChartId<T> = StorageValue<_, u64, ValueQuery>;

    /// 所有命盘数据
    #[pallet::storage]
    #[pallet::getter(fn charts)]
    pub type Charts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        ZiweiChart<T::AccountId, BlockNumberFor<T>, T::Moment, T::MaxCidLen>,
    >;

    /// 用户的命盘列表
    #[pallet::storage]
    #[pallet::getter(fn user_charts)]
    pub type UserCharts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxUserCharts>,
        ValueQuery,
    >;

    /// 公开的命盘列表
    #[pallet::storage]
    #[pallet::getter(fn public_charts)]
    pub type PublicCharts<T: Config> = StorageValue<_, BoundedVec<u64, T::MaxPublicCharts>, ValueQuery>;

    /// 用户每日排盘次数
    #[pallet::storage]
    #[pallet::getter(fn daily_chart_count)]
    pub type DailyChartCount<T: Config> =
        StorageMap<_, Blake2_128Concat, (T::AccountId, u32), u32, ValueQuery>;

    /// AI 解读请求状态
    #[pallet::storage]
    #[pallet::getter(fn ai_interpretation_requests)]
    pub type AiInterpretationRequests<T: Config> = StorageMap<_, Blake2_128Concat, u64, bool, ValueQuery>;

    /// 用户统计数据
    #[pallet::storage]
    #[pallet::getter(fn user_stats)]
    pub type UserStatsStorage<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, UserStats, ValueQuery>;

    // ========================================================================
    // 事件
    // ========================================================================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 命盘创建成功
        ChartCreated {
            chart_id: u64,
            creator: T::AccountId,
            wu_xing_ju: WuXing,
            ju_shu: u8,
        },
        /// 请求 AI 解读
        AiInterpretationRequested {
            chart_id: u64,
            requester: T::AccountId,
        },
        /// AI 解读完成
        AiInterpretationSubmitted {
            chart_id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        },
        /// 可见性变更
        VisibilityChanged {
            chart_id: u64,
            is_public: bool,
        },
    }

    // ========================================================================
    // 错误
    // ========================================================================

    #[pallet::error]
    pub enum Error<T> {
        /// 命盘不存在
        ChartNotFound,
        /// 无权操作
        NotChartOwner,
        /// 无效的农历月份
        InvalidLunarMonth,
        /// 无效的农历日期
        InvalidLunarDay,
        /// 超过每日排盘上限
        DailyLimitExceeded,
        /// 超过用户存储上限
        UserChartLimitExceeded,
        /// 超过公开列表上限
        PublicChartLimitExceeded,
        /// AI 解读已请求
        AiInterpretationAlreadyRequested,
        /// AI 解读未请求
        AiInterpretationNotRequested,
        /// 余额不足
        InsufficientBalance,
        /// 无效的年份
        InvalidYear,
    }

    // ========================================================================
    // Extrinsics
    // ========================================================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 时间起盘 - 根据出生时间计算命盘
        ///
        /// # 参数
        /// - `lunar_year`: 农历年份
        /// - `lunar_month`: 农历月份 (1-12)
        /// - `lunar_day`: 农历日期 (1-30)
        /// - `birth_hour`: 出生时辰
        /// - `gender`: 性别
        /// - `is_leap_month`: 是否闰月
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_by_time(
            origin: OriginFor<T>,
            lunar_year: u16,
            lunar_month: u8,
            lunar_day: u8,
            birth_hour: DiZhi,
            gender: Gender,
            is_leap_month: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            ensure!(lunar_year >= 1900 && lunar_year <= 2100, Error::<T>::InvalidYear);
            ensure!(lunar_month >= 1 && lunar_month <= 12, Error::<T>::InvalidLunarMonth);
            ensure!(lunar_day >= 1 && lunar_day <= 30, Error::<T>::InvalidLunarDay);

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 计算年干支
            let year_gan = TianGan::from_index(((lunar_year - 4) % 10) as u8);
            let year_zhi = DiZhi::from_index(((lunar_year - 4) % 12) as u8);

            // 执行排盘
            let chart_id = Self::do_divine(
                &who,
                lunar_year,
                lunar_month,
                lunar_day,
                birth_hour,
                gender,
                is_leap_month,
                year_gan,
                year_zhi,
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let chart = Charts::<T>::get(chart_id).ok_or(Error::<T>::ChartNotFound)?;
            Self::deposit_event(Event::ChartCreated {
                chart_id,
                creator: who,
                wu_xing_ju: chart.wu_xing_ju,
                ju_shu: chart.ju_shu,
            });

            Ok(())
        }

        /// 手动指定 - 直接输入四柱信息
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            lunar_year: u16,
            lunar_month: u8,
            lunar_day: u8,
            birth_hour: DiZhi,
            gender: Gender,
            year_gan: TianGan,
            year_zhi: DiZhi,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            ensure!(lunar_month >= 1 && lunar_month <= 12, Error::<T>::InvalidLunarMonth);
            ensure!(lunar_day >= 1 && lunar_day <= 30, Error::<T>::InvalidLunarDay);

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 执行排盘
            let chart_id = Self::do_divine(
                &who,
                lunar_year,
                lunar_month,
                lunar_day,
                birth_hour,
                gender,
                false,
                year_gan,
                year_zhi,
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let chart = Charts::<T>::get(chart_id).ok_or(Error::<T>::ChartNotFound)?;
            Self::deposit_event(Event::ChartCreated {
                chart_id,
                creator: who,
                wu_xing_ju: chart.wu_xing_ju,
                ju_shu: chart.ju_shu,
            });

            Ok(())
        }

        /// 随机起盘 - 使用链上随机数
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_random(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 生成随机数据
            let (random_hash, _) = T::Randomness::random(&who.encode());
            let random_bytes: [u8; 32] = random_hash.as_ref().try_into().unwrap_or([0u8; 32]);

            let lunar_year = 1950 + (random_bytes[0] % 100) as u16;
            let lunar_month = 1 + (random_bytes[1] % 12);
            let lunar_day = 1 + (random_bytes[2] % 30);
            let birth_hour = DiZhi::from_index(random_bytes[3] % 12);
            let gender = if random_bytes[4] % 2 == 0 { Gender::Male } else { Gender::Female };
            let year_gan = TianGan::from_index(random_bytes[5] % 10);
            let year_zhi = DiZhi::from_index(random_bytes[6] % 12);

            // 执行排盘
            let chart_id = Self::do_divine(
                &who,
                lunar_year,
                lunar_month,
                lunar_day,
                birth_hour,
                gender,
                false,
                year_gan,
                year_zhi,
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let chart = Charts::<T>::get(chart_id).ok_or(Error::<T>::ChartNotFound)?;
            Self::deposit_event(Event::ChartCreated {
                chart_id,
                creator: who,
                wu_xing_ju: chart.wu_xing_ju,
                ju_shu: chart.ju_shu,
            });

            Ok(())
        }

        /// 公历时间起盘 - 根据公历出生时间计算命盘
        ///
        /// 此方法自动将公历日期转换为农历，然后进行排盘。
        /// 使用 pallet-almanac 进行统一的公历农历转换。
        ///
        /// # 参数
        /// - `solar_year`: 公历年份 (1901-2100)
        /// - `solar_month`: 公历月份 (1-12)
        /// - `solar_day`: 公历日期 (1-31)
        /// - `birth_hour`: 出生时辰
        /// - `gender`: 性别
        #[pallet::call_index(6)]
        #[pallet::weight(Weight::from_parts(120_000_000, 0))]
        pub fn divine_by_solar_time(
            origin: OriginFor<T>,
            solar_year: u16,
            solar_month: u8,
            solar_day: u8,
            birth_hour: DiZhi,
            gender: Gender,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            ensure!(solar_year >= 1901 && solar_year <= 2100, Error::<T>::InvalidYear);
            ensure!(solar_month >= 1 && solar_month <= 12, Error::<T>::InvalidLunarMonth);
            ensure!(solar_day >= 1 && solar_day <= 31, Error::<T>::InvalidLunarDay);

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 调用 almanac 进行公历转农历
            let lunar = pallet_almanac::solar_to_lunar(solar_year, solar_month, solar_day)
                .ok_or(Error::<T>::InvalidYear)?;

            // 计算年干支（使用农历年）
            let year_gan = TianGan::from_index(((lunar.year - 4) % 10) as u8);
            let year_zhi = DiZhi::from_index(((lunar.year - 4) % 12) as u8);

            // 执行排盘
            let chart_id = Self::do_divine(
                &who,
                lunar.year,
                lunar.month,
                lunar.day,
                birth_hour,
                gender,
                lunar.is_leap,
                year_gan,
                year_zhi,
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let chart = Charts::<T>::get(chart_id).ok_or(Error::<T>::ChartNotFound)?;
            Self::deposit_event(Event::ChartCreated {
                chart_id,
                creator: who,
                wu_xing_ju: chart.wu_xing_ju,
                ju_shu: chart.ju_shu,
            });

            Ok(())
        }

        /// 请求 AI 解读（已废弃）
        ///
        /// **注意**：此函数已废弃，请使用 `pallet_divination_ai::request_interpretation`
        /// 新的统一 AI 解读系统支持：
        /// - 多种 AI 模型选择（针对不同占卜类型的专用模型）
        /// - Oracle 质押和评分机制
        /// - 争议和退款处理
        ///
        /// # 废弃原因
        /// 为统一 AI 解读逻辑、减少代码重复，所有 AI 解读请求已移至
        /// `pallet-divination-ai` 模块统一处理。
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        #[deprecated(
            since = "0.2.0",
            note = "请使用 pallet_divination_ai::request_interpretation"
        )]
        pub fn request_ai_interpretation(
            origin: OriginFor<T>,
            chart_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查命盘存在且属于调用者
            let chart = Charts::<T>::get(chart_id).ok_or(Error::<T>::ChartNotFound)?;
            ensure!(chart.creator == who, Error::<T>::NotChartOwner);

            // 检查是否已请求
            ensure!(
                !AiInterpretationRequests::<T>::get(chart_id),
                Error::<T>::AiInterpretationAlreadyRequested
            );

            // 收取费用
            let fee = T::AiInterpretationFee::get();
            if !fee.is_zero() {
                T::Currency::transfer(
                    &who,
                    &T::TreasuryAccount::get(),
                    fee,
                    ExistenceRequirement::KeepAlive,
                )?;
            }

            // 记录请求
            AiInterpretationRequests::<T>::insert(chart_id, true);

            // 更新用户统计
            UserStatsStorage::<T>::mutate(&who, |stats| {
                stats.ai_interpretations = stats.ai_interpretations.saturating_add(1);
            });

            Self::deposit_event(Event::AiInterpretationRequested {
                chart_id,
                requester: who,
            });

            Ok(())
        }

        /// 提交 AI 解读结果（预言机调用）（已废弃）
        ///
        /// **注意**：此函数已废弃，请使用 `pallet_divination_ai::submit_result`
        /// 新的统一 AI 解读系统支持更完善的结果提交和验证机制。
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        #[deprecated(
            since = "0.2.0",
            note = "请使用 pallet_divination_ai::submit_result"
        )]
        pub fn submit_ai_interpretation(
            origin: OriginFor<T>,
            chart_id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            T::AiOracleOrigin::ensure_origin(origin)?;

            // 检查命盘存在
            ensure!(Charts::<T>::contains_key(chart_id), Error::<T>::ChartNotFound);

            // 检查是否已请求
            ensure!(
                AiInterpretationRequests::<T>::get(chart_id),
                Error::<T>::AiInterpretationNotRequested
            );

            // 更新命盘
            Charts::<T>::mutate(chart_id, |maybe_chart| {
                if let Some(chart) = maybe_chart {
                    chart.ai_interpretation_cid = Some(cid.clone());
                }
            });

            // 清除请求状态
            AiInterpretationRequests::<T>::remove(chart_id);

            Self::deposit_event(Event::AiInterpretationSubmitted { chart_id, cid });

            Ok(())
        }

        /// 设置命盘可见性
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn set_chart_visibility(
            origin: OriginFor<T>,
            chart_id: u64,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查命盘存在且属于调用者
            let chart = Charts::<T>::get(chart_id).ok_or(Error::<T>::ChartNotFound)?;
            ensure!(chart.creator == who, Error::<T>::NotChartOwner);

            // 更新可见性
            Charts::<T>::mutate(chart_id, |maybe_chart| {
                if let Some(chart) = maybe_chart {
                    chart.is_public = is_public;
                }
            });

            // 更新公开列表
            if is_public {
                PublicCharts::<T>::try_mutate(|list| {
                    if !list.contains(&chart_id) {
                        list.try_push(chart_id).map_err(|_| Error::<T>::PublicChartLimitExceeded)
                    } else {
                        Ok(())
                    }
                })?;
            } else {
                PublicCharts::<T>::mutate(|list| {
                    list.retain(|&id| id != chart_id);
                });
            }

            Self::deposit_event(Event::VisibilityChanged { chart_id, is_public });

            Ok(())
        }
    }

    // ========================================================================
    // 内部方法
    // ========================================================================

    impl<T: Config> Pallet<T> {
        /// 检查每日排盘限制
        fn check_daily_limit(who: &T::AccountId) -> DispatchResult {
            let current_block = <frame_system::Pallet<T>>::block_number();
            let day = Self::block_to_day(current_block);
            let count = DailyChartCount::<T>::get((who, day));

            ensure!(count < T::MaxDailyCharts::get(), Error::<T>::DailyLimitExceeded);

            Ok(())
        }

        /// 增加每日计数
        fn increment_daily_count(who: &T::AccountId) {
            let current_block = <frame_system::Pallet<T>>::block_number();
            let day = Self::block_to_day(current_block);
            DailyChartCount::<T>::mutate((who, day), |count| {
                *count = count.saturating_add(1);
            });
        }

        /// 区块号转天数
        fn block_to_day(block: BlockNumberFor<T>) -> u32 {
            // 假设 6 秒一个区块，14400 块 = 1 天
            let block_u32: u32 = block.try_into().unwrap_or(0);
            block_u32 / 14400
        }

        /// 执行排盘核心逻辑
        fn do_divine(
            who: &T::AccountId,
            lunar_year: u16,
            lunar_month: u8,
            lunar_day: u8,
            birth_hour: DiZhi,
            gender: Gender,
            is_leap_month: bool,
            year_gan: TianGan,
            year_zhi: DiZhi,
        ) -> Result<u64, DispatchError> {
            // 检查用户存储上限
            let user_charts = UserCharts::<T>::get(who);
            ensure!(
                user_charts.len() < T::MaxUserCharts::get() as usize,
                Error::<T>::UserChartLimitExceeded
            );

            // 获取新 ID
            let chart_id = NextChartId::<T>::get();
            NextChartId::<T>::put(chart_id + 1);

            // 计算命宫位置
            let ming_gong_pos = calculate_ming_gong(lunar_month, birth_hour);

            // 计算身宫位置
            let shen_gong_pos = calculate_shen_gong(lunar_month, birth_hour);

            // 计算五行局
            let (wu_xing_ju, ju_shu) = calculate_wu_xing_ju(year_gan, ming_gong_pos);

            // 计算紫微星位置
            let ziwei_pos = calculate_ziwei_position(lunar_day, ju_shu);

            // 计算天府星位置
            let tianfu_pos = calculate_tianfu_position(ziwei_pos);

            // 初始化十二宫
            let mut palaces = init_palaces(year_gan, ming_gong_pos);

            // 安紫微星系
            let ziwei_series = place_ziwei_series(ziwei_pos);
            for (star, pos) in ziwei_series.iter() {
                let palace = &mut palaces[*pos as usize];
                for slot in palace.zhu_xing.iter_mut() {
                    if slot.is_none() {
                        *slot = Some(*star);
                        break;
                    }
                }
            }

            // 安天府星系
            let tianfu_series = place_tianfu_series(tianfu_pos);
            for (star, pos) in tianfu_series.iter() {
                let palace = &mut palaces[*pos as usize];
                for slot in palace.zhu_xing.iter_mut() {
                    if slot.is_none() {
                        *slot = Some(*star);
                        break;
                    }
                }
            }

            // 安六吉星
            let (wen_chang, wen_qu) = calculate_wen_chang_qu(birth_hour);
            let (zuo_fu, you_bi) = calculate_zuo_fu_you_bi(lunar_month);
            let (tian_kui, tian_yue) = calculate_tian_kui_yue(year_gan);

            palaces[wen_chang as usize].liu_ji[0] = true;
            palaces[wen_qu as usize].liu_ji[1] = true;
            palaces[zuo_fu as usize].liu_ji[2] = true;
            palaces[you_bi as usize].liu_ji[3] = true;
            palaces[tian_kui as usize].liu_ji[4] = true;
            palaces[tian_yue as usize].liu_ji[5] = true;

            // 安六煞星
            let (qing_yang, tuo_luo) = calculate_qing_yang_tuo_luo(year_gan);
            let (huo_xing, ling_xing) = calculate_huo_ling(year_zhi, birth_hour);
            let (di_kong, di_jie) = calculate_di_kong_jie(birth_hour);

            palaces[qing_yang as usize].liu_sha[0] = true;
            palaces[tuo_luo as usize].liu_sha[1] = true;
            palaces[huo_xing as usize].liu_sha[2] = true;
            palaces[ling_xing as usize].liu_sha[3] = true;
            palaces[di_kong as usize].liu_sha[4] = true;
            palaces[di_jie as usize].liu_sha[5] = true;

            // 安禄存天马
            let lu_cun = calculate_lu_cun(year_gan);
            palaces[lu_cun as usize].lu_cun = true;

            // 安天马（使用新增的天马计算函数）
            let tian_ma_pos = calculate_tian_ma(year_zhi);
            palaces[tian_ma_pos as usize].tian_ma = true;

            // 获取四化星（使用完整版支持辅星）
            let si_hua_stars = get_si_hua_stars_full(year_gan);

            // 计算起运
            let qi_yun_age = calculate_qi_yun_age(ju_shu);
            let da_yun_shun = calculate_da_yun_direction(year_gan, gender);

            // 创建命盘
            let chart = ZiweiChart {
                id: chart_id,
                creator: who.clone(),
                created_at: <frame_system::Pallet<T>>::block_number(),
                timestamp: <pallet_timestamp::Pallet<T>>::get(),
                lunar_year,
                lunar_month,
                lunar_day,
                birth_hour,
                gender,
                is_leap_month,
                year_gan,
                year_zhi,
                wu_xing_ju,
                ju_shu,
                ming_gong_pos,
                shen_gong_pos,
                ziwei_pos,
                tianfu_pos,
                palaces,
                si_hua_stars,
                qi_yun_age,
                da_yun_shun,
                is_public: false,
                ai_interpretation_cid: None,
            };

            // 存储命盘
            Charts::<T>::insert(chart_id, chart);

            // 更新用户命盘列表
            UserCharts::<T>::try_mutate(who, |list| {
                list.try_push(chart_id).map_err(|_| Error::<T>::UserChartLimitExceeded)
            })?;

            // 更新用户统计
            UserStatsStorage::<T>::mutate(who, |stats| {
                if stats.total_charts == 0 {
                    stats.first_chart_block = Self::block_to_day(<frame_system::Pallet<T>>::block_number());
                }
                stats.total_charts = stats.total_charts.saturating_add(1);
            });

            Ok(chart_id)
        }
    }
}
