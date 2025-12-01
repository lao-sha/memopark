//! # 奇门遁甲排盘 Pallet
//!
//! 本模块实现了区块链上的奇门遁甲排盘系统，提供：
//! - 时间起局（根据四柱和节气）
//! - 数字起局（根据用户数字）
//! - 随机起局（使用链上随机数）
//! - 手动指定（直接指定局数）
//! - 排盘记录存储与查询
//! - AI 解读请求（链下工作机触发）
//!
//! ## 核心概念
//!
//! - **阴阳遁**: 冬至到夏至为阳遁（顺行），夏至到冬至为阴遁（逆行）
//! - **三元**: 每节气分上中下三元，各5天
//! - **局数**: 1-9局，由节气和三元决定
//! - **四盘**: 天盘（九星）、地盘（三奇六仪）、人盘（八门）、神盘（八神）
//! - **值符值使**: 当值的星和门，是奇门的核心

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

        /// 每个用户最多存储的排盘记录数量
        #[pallet::constant]
        type MaxUserCharts: Get<u32>;

        /// 公开排盘列表的最大长度
        #[pallet::constant]
        type MaxPublicCharts: Get<u32>;

        /// 每日免费排盘次数
        #[pallet::constant]
        type DailyFreeCharts: Get<u32>;

        /// 每日最大排盘次数（防刷）
        #[pallet::constant]
        type MaxDailyCharts: Get<u32>;

        /// AI 解读费用
        #[pallet::constant]
        type AiInterpretationFee: Get<BalanceOf<Self>>;

        /// 国库账户
        #[pallet::constant]
        type TreasuryAccount: Get<Self::AccountId>;

        /// AI 预言机权限来源
        type AiOracleOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// IPFS CID 最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
    }

    /// 货币余额类型别名
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    // ==================== 存储项 ====================

    /// 下一个排盘记录 ID
    #[pallet::storage]
    #[pallet::getter(fn next_chart_id)]
    pub type NextChartId<T> = StorageValue<_, u64, ValueQuery>;

    /// 排盘记录存储
    ///
    /// 键：排盘记录 ID
    /// 值：完整的奇门遁甲排盘结果
    #[pallet::storage]
    #[pallet::getter(fn charts)]
    pub type Charts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        QimenChart<T::AccountId, BlockNumberFor<T>, T::MaxCidLen>,
    >;

    /// 用户排盘索引
    ///
    /// 键：用户账户
    /// 值：该用户的所有排盘记录 ID 列表
    #[pallet::storage]
    #[pallet::getter(fn user_charts)]
    pub type UserCharts<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxUserCharts>,
        ValueQuery,
    >;

    /// 公开排盘列表
    ///
    /// 存储所有设置为公开的排盘记录 ID
    #[pallet::storage]
    #[pallet::getter(fn public_charts)]
    pub type PublicCharts<T: Config> =
        StorageValue<_, BoundedVec<u64, T::MaxPublicCharts>, ValueQuery>;

    /// 每日排盘计数
    ///
    /// 用于限制每日排盘次数，防止滥用
    /// 键1：用户账户
    /// 键2：天数（从创世块起算）
    /// 值：当日排盘次数
    #[pallet::storage]
    #[pallet::getter(fn daily_chart_count)]
    pub type DailyChartCount<T: Config> = StorageDoubleMap<
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

    /// 用户统计信息
    ///
    /// 记录用户的排盘统计数据
    #[pallet::storage]
    #[pallet::getter(fn user_stats)]
    pub type UserStatsStorage<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, UserStats, ValueQuery>;

    // ==================== 事件 ====================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新排盘记录创建成功
        /// [排盘ID, 排盘者, 阴阳遁, 局数]
        ChartCreated {
            chart_id: u64,
            diviner: T::AccountId,
            dun_type: DunType,
            ju_number: u8,
        },

        /// AI 解读请求已提交
        /// [排盘ID, 请求者]
        AiInterpretationRequested {
            chart_id: u64,
            requester: T::AccountId,
        },

        /// AI 解读结果已提交
        /// [排盘ID, IPFS CID]
        AiInterpretationSubmitted {
            chart_id: u64,
            cid: BoundedVec<u8, T::MaxCidLen>,
        },

        /// 排盘公开状态已更改
        /// [排盘ID, 是否公开]
        ChartVisibilityChanged {
            chart_id: u64,
            is_public: bool,
        },
    }

    // ==================== 错误 ====================

    #[pallet::error]
    pub enum Error<T> {
        /// 排盘记录不存在
        ChartNotFound,
        /// 非排盘记录所有者
        NotOwner,
        /// 每日排盘次数超限
        DailyLimitExceeded,
        /// 用户排盘列表已满
        UserChartsFull,
        /// 公开排盘列表已满
        PublicChartsFull,
        /// 无效的局数（必须为1-9）
        InvalidJuNumber,
        /// 无效的节气（必须为0-23）
        InvalidJieQi,
        /// AI 解读请求已存在
        AiRequestAlreadyExists,
        /// AI 解读请求不存在
        AiRequestNotFound,
        /// 数字参数缺失
        MissingNumberParams,
        /// 手动指定参数缺失
        MissingManualParams,
        /// 无效的干支组合
        InvalidGanZhi,
        /// 节气天数超范围
        InvalidDayInJieQi,
    }

    // ==================== 可调用函数 ====================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 时间起局排盘
        ///
        /// 根据四柱和节气信息生成奇门遁甲盘。
        ///
        /// # 参数
        /// - `origin`: 调用者（签名账户）
        /// - `year_ganzhi`: 年柱干支（干0-9，支0-11）
        /// - `month_ganzhi`: 月柱干支
        /// - `day_ganzhi`: 日柱干支
        /// - `hour_ganzhi`: 时柱干支
        /// - `jie_qi`: 节气（0-23）
        /// - `day_in_jieqi`: 节气内天数（1-15）
        /// - `question_hash`: 问题哈希（隐私保护）
        /// - `is_public`: 是否公开此排盘
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(80_000_000, 0))]
        pub fn divine_by_time(
            origin: OriginFor<T>,
            year_ganzhi: (u8, u8),
            month_ganzhi: (u8, u8),
            day_ganzhi: (u8, u8),
            hour_ganzhi: (u8, u8),
            jie_qi: u8,
            day_in_jieqi: u8,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数
            ensure!(jie_qi < 24, Error::<T>::InvalidJieQi);
            ensure!(day_in_jieqi >= 1 && day_in_jieqi <= 15, Error::<T>::InvalidDayInJieQi);

            // 转换干支
            let year_gz = Self::parse_ganzhi(year_ganzhi)?;
            let month_gz = Self::parse_ganzhi(month_ganzhi)?;
            let day_gz = Self::parse_ganzhi(day_ganzhi)?;
            let hour_gz = Self::parse_ganzhi(hour_ganzhi)?;

            let jieqi = JieQi::from_index(jie_qi).ok_or(Error::<T>::InvalidJieQi)?;

            // 调用排盘算法
            let (dun_type, san_yuan, ju_number, zhi_fu_xing, zhi_shi_men, palaces) =
                algorithm::generate_qimen_chart(year_gz, month_gz, day_gz, hour_gz, jieqi, day_in_jieqi);

            Self::create_chart(
                who,
                DivinationMethod::ByTime,
                year_gz,
                month_gz,
                day_gz,
                hour_gz,
                jieqi,
                dun_type,
                san_yuan,
                ju_number,
                zhi_fu_xing,
                zhi_shi_men,
                palaces,
                question_hash,
                is_public,
            )
        }

        /// 数字起局排盘
        ///
        /// 使用用户输入的数字生成局数。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `numbers`: 用户输入的数字列表
        /// - `dun_type`: 阴阳遁（true=阳遁，false=阴遁）
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(70_000_000, 0))]
        pub fn divine_by_numbers(
            origin: OriginFor<T>,
            numbers: BoundedVec<u16, ConstU32<16>>,
            yang_dun: bool,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            ensure!(!numbers.is_empty(), Error::<T>::MissingNumberParams);

            // 获取区块哈希作为额外随机源
            let block_hash = <frame_system::Pallet<T>>::parent_hash();
            let block_hash_bytes: [u8; 32] = block_hash
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            // 从数字生成局数
            let ju_number = algorithm::generate_from_numbers(&numbers, &block_hash_bytes);

            let dun_type = if yang_dun { DunType::Yang } else { DunType::Yin };

            // 使用默认干支（当前时间的近似值）
            let (year_gz, month_gz, day_gz, hour_gz, jieqi, san_yuan) =
                Self::get_default_ganzhi_and_jieqi();

            // 排布地盘
            let di_pan = algorithm::get_di_pan(ju_number, dun_type);

            // 计算值符值使
            let xun_shou_yi = algorithm::get_xun_shou(hour_gz.gan, hour_gz.zhi);
            let zhi_fu_xing = algorithm::calc_zhi_fu_xing(xun_shou_yi, &di_pan);
            let zhi_shi_men = algorithm::calc_zhi_shi_men(xun_shou_yi, &di_pan);

            // 完成排盘
            let (_, _, _, _, _, palaces) = algorithm::generate_qimen_chart(
                year_gz, month_gz, day_gz, hour_gz, jieqi, 1,
            );

            Self::create_chart(
                who,
                DivinationMethod::ByNumbers,
                year_gz,
                month_gz,
                day_gz,
                hour_gz,
                jieqi,
                dun_type,
                san_yuan,
                ju_number,
                zhi_fu_xing,
                zhi_shi_men,
                palaces,
                question_hash,
                is_public,
            )
        }

        /// 随机起局排盘
        ///
        /// 使用链上随机数生成排盘。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(70_000_000, 0))]
        pub fn divine_random(
            origin: OriginFor<T>,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 使用链上随机源
            let random_seed = T::Randomness::random(&b"qimen"[..]).0;
            let random_bytes: [u8; 32] = random_seed
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            // 从随机数生成阴阳遁和局数
            let (dun_type, ju_number) = algorithm::generate_from_random(&random_bytes);

            // 使用默认干支
            let (year_gz, month_gz, day_gz, hour_gz, jieqi, san_yuan) =
                Self::get_default_ganzhi_and_jieqi();

            // 排布地盘
            let di_pan = algorithm::get_di_pan(ju_number, dun_type);

            // 计算值符值使
            let xun_shou_yi = algorithm::get_xun_shou(hour_gz.gan, hour_gz.zhi);
            let zhi_fu_xing = algorithm::calc_zhi_fu_xing(xun_shou_yi, &di_pan);
            let zhi_shi_men = algorithm::calc_zhi_shi_men(xun_shou_yi, &di_pan);

            // 完成排盘
            let (_, _, _, _, _, palaces) = algorithm::generate_qimen_chart(
                year_gz, month_gz, day_gz, hour_gz, jieqi, 1,
            );

            Self::create_chart(
                who,
                DivinationMethod::Random,
                year_gz,
                month_gz,
                day_gz,
                hour_gz,
                jieqi,
                dun_type,
                san_yuan,
                ju_number,
                zhi_fu_xing,
                zhi_shi_men,
                palaces,
                question_hash,
                is_public,
            )
        }

        /// 手动指定排盘
        ///
        /// 直接指定阴阳遁和局数。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `yang_dun`: 是否阳遁
        /// - `ju_number`: 局数（1-9）
        /// - `hour_ganzhi`: 时柱干支
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(60_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            yang_dun: bool,
            ju_number: u8,
            hour_ganzhi: (u8, u8),
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            ensure!(algorithm::validate_ju_number(ju_number), Error::<T>::InvalidJuNumber);

            let hour_gz = Self::parse_ganzhi(hour_ganzhi)?;
            let dun_type = if yang_dun { DunType::Yang } else { DunType::Yin };

            // 使用默认干支
            let (year_gz, month_gz, day_gz, _, jieqi, san_yuan) =
                Self::get_default_ganzhi_and_jieqi();

            // 排布地盘
            let di_pan = algorithm::get_di_pan(ju_number, dun_type);

            // 计算值符值使
            let xun_shou_yi = algorithm::get_xun_shou(hour_gz.gan, hour_gz.zhi);
            let zhi_fu_xing = algorithm::calc_zhi_fu_xing(xun_shou_yi, &di_pan);
            let zhi_shi_men = algorithm::calc_zhi_shi_men(xun_shou_yi, &di_pan);

            // 排布天盘九星
            let tian_pan_xing = algorithm::distribute_jiu_xing(zhi_fu_xing, hour_gz.gan, &di_pan, dun_type);

            // 排布人盘八门
            let ren_pan_men = algorithm::distribute_ba_men(zhi_shi_men, hour_gz.gan, &di_pan, dun_type);

            // 找到值符落宫
            let zhi_fu_gong = algorithm::find_gan_in_di_pan(hour_gz.gan, &di_pan).unwrap_or(1);

            // 排布神盘八神
            let shen_pan_shen = algorithm::distribute_ba_shen(zhi_fu_gong, dun_type);

            // 组装九宫
            let mut palaces = [Palace::empty(JiuGong::Kan); 9];
            for i in 0..9 {
                let gong = JiuGong::from_num((i + 1) as u8).unwrap_or(JiuGong::Kan);
                let xing = tian_pan_xing[i];
                let tian_pan_gan = algorithm::get_tian_pan_gan(xing, &di_pan);

                palaces[i] = Palace {
                    gong,
                    tian_pan_gan,
                    di_pan_gan: di_pan[i],
                    xing,
                    men: ren_pan_men[i],
                    shen: shen_pan_shen[i],
                    is_xun_kong: false,
                    is_ma_xing: false,
                };
            }

            Self::create_chart(
                who,
                DivinationMethod::Manual,
                year_gz,
                month_gz,
                day_gz,
                hour_gz,
                jieqi,
                dun_type,
                san_yuan,
                ju_number,
                zhi_fu_xing,
                zhi_shi_men,
                palaces,
                question_hash,
                is_public,
            )
        }

        /// 请求 AI 解读
        ///
        /// 为指定排盘请求 AI 解读服务，需支付费用。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `chart_id`: 排盘记录 ID
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn request_ai_interpretation(
            origin: OriginFor<T>,
            chart_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证排盘记录存在且为调用者所有
            let chart = Charts::<T>::get(chart_id)
                .ok_or(Error::<T>::ChartNotFound)?;
            ensure!(chart.diviner == who, Error::<T>::NotOwner);

            // 检查是否已有请求
            ensure!(
                !AiInterpretationRequests::<T>::contains_key(chart_id),
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
            AiInterpretationRequests::<T>::insert(chart_id, who.clone());

            // 发送事件触发链下工作机
            Self::deposit_event(Event::AiInterpretationRequested {
                chart_id,
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
        /// - `chart_id`: 排盘记录 ID
        /// - `interpretation_cid`: 解读内容的 IPFS CID
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        pub fn submit_ai_interpretation(
            origin: OriginFor<T>,
            chart_id: u64,
            interpretation_cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            // 验证 AI 预言机权限
            T::AiOracleOrigin::ensure_origin(origin)?;

            // 验证请求存在
            ensure!(
                AiInterpretationRequests::<T>::contains_key(chart_id),
                Error::<T>::AiRequestNotFound
            );

            // 更新排盘记录的 AI 解读 CID
            Charts::<T>::try_mutate(chart_id, |maybe_chart| {
                let chart = maybe_chart
                    .as_mut()
                    .ok_or(Error::<T>::ChartNotFound)?;
                chart.interpretation_cid = Some(interpretation_cid.clone());
                Ok::<_, DispatchError>(())
            })?;

            // 移除请求
            AiInterpretationRequests::<T>::remove(chart_id);

            Self::deposit_event(Event::AiInterpretationSubmitted {
                chart_id,
                cid: interpretation_cid,
            });

            Ok(())
        }

        /// 更改排盘公开状态
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `chart_id`: 排盘记录 ID
        /// - `is_public`: 是否公开
        #[pallet::call_index(6)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn set_chart_visibility(
            origin: OriginFor<T>,
            chart_id: u64,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Charts::<T>::try_mutate(chart_id, |maybe_chart| {
                let chart = maybe_chart
                    .as_mut()
                    .ok_or(Error::<T>::ChartNotFound)?;
                ensure!(chart.diviner == who, Error::<T>::NotOwner);

                let was_public = chart.is_public;
                chart.is_public = is_public;

                // 更新公开排盘列表
                if is_public && !was_public {
                    // 添加到公开列表
                    PublicCharts::<T>::try_mutate(|list| {
                        list.try_push(chart_id)
                            .map_err(|_| Error::<T>::PublicChartsFull)
                    })?;
                } else if !is_public && was_public {
                    // 从公开列表移除
                    PublicCharts::<T>::mutate(|list| {
                        list.retain(|&id| id != chart_id);
                    });
                }

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::ChartVisibilityChanged {
                chart_id,
                is_public,
            });

            Ok(())
        }
    }

    // ==================== 内部辅助函数 ====================

    impl<T: Config> Pallet<T> {
        /// 获取当前时间戳（秒）
        fn get_timestamp_secs() -> u64 {
            let moment = pallet_timestamp::Pallet::<T>::get();
            let ms: u64 = moment.try_into().unwrap_or(0);
            ms / 1000
        }

        /// 检查每日排盘次数限制
        fn check_daily_limit(who: &T::AccountId) -> DispatchResult {
            let today = Self::current_day();
            let count = DailyChartCount::<T>::get(who, today);

            ensure!(
                count < T::MaxDailyCharts::get(),
                Error::<T>::DailyLimitExceeded
            );

            // 更新计数
            DailyChartCount::<T>::insert(who, today, count + 1);
            Ok(())
        }

        /// 获取当前天数（从创世块起算）
        fn current_day() -> u32 {
            let timestamp = Self::get_timestamp_secs();
            (timestamp / 86400) as u32
        }

        /// 解析干支参数
        fn parse_ganzhi(ganzhi: (u8, u8)) -> Result<GanZhi, DispatchError> {
            let gan = TianGan::from_index(ganzhi.0)
                .ok_or(Error::<T>::InvalidGanZhi)?;
            let zhi = DiZhi::from_index(ganzhi.1)
                .ok_or(Error::<T>::InvalidGanZhi)?;
            Ok(GanZhi::new(gan, zhi))
        }

        /// 获取默认干支和节气（基于当前时间戳的近似值）
        fn get_default_ganzhi_and_jieqi() -> (GanZhi, GanZhi, GanZhi, GanZhi, JieQi, SanYuan) {
            let timestamp = Self::get_timestamp_secs();

            // 简化计算：使用时间戳推算干支
            // 以1970-01-01为基准（庚戌年）
            let days_since_epoch = timestamp / 86400;

            // 日干支（简化，每60天一个周期）
            let day_ganzhi_index = (days_since_epoch % 60) as u8;
            let day_gz = GanZhi::from_sexagenary(day_ganzhi_index)
                .unwrap_or(GanZhi::new(TianGan::Jia, DiZhi::Zi));

            // 时干支（简化，每天12个时辰）
            let hour = ((timestamp % 86400) / 3600) as u8;
            let hour_zhi = DiZhi::from_hour(hour).unwrap_or(DiZhi::Zi);

            // 时干由日干决定
            let hour_gan_base = (day_gz.gan.index() % 5) * 2;
            let hour_gan_index = (hour_gan_base + hour_zhi.index()) % 10;
            let hour_gan = TianGan::from_index(hour_gan_index).unwrap_or(TianGan::Jia);
            let hour_gz = GanZhi::new(hour_gan, hour_zhi);

            // 年月干支使用简化值
            let year_gz = GanZhi::new(TianGan::Jia, DiZhi::Zi);
            let month_gz = GanZhi::new(TianGan::Bing, DiZhi::Yin);

            // 节气（简化，根据日期估算）
            let day_of_year = (days_since_epoch % 365) as u16;
            let jieqi_index = ((day_of_year / 15) % 24) as u8;
            let jieqi = JieQi::from_index(jieqi_index).unwrap_or(JieQi::DongZhi);

            // 三元
            let day_in_jieqi = ((day_of_year % 15) + 1) as u8;
            let san_yuan = algorithm::calc_san_yuan(day_in_jieqi);

            (year_gz, month_gz, day_gz, hour_gz, jieqi, san_yuan)
        }

        /// 创建排盘记录并存储
        #[allow(clippy::too_many_arguments)]
        fn create_chart(
            diviner: T::AccountId,
            method: DivinationMethod,
            year_ganzhi: GanZhi,
            month_ganzhi: GanZhi,
            day_ganzhi: GanZhi,
            hour_ganzhi: GanZhi,
            jie_qi: JieQi,
            dun_type: DunType,
            san_yuan: SanYuan,
            ju_number: u8,
            zhi_fu_xing: JiuXing,
            zhi_shi_men: BaMen,
            palaces: [Palace; 9],
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            // 获取新的排盘记录 ID
            let chart_id = NextChartId::<T>::get();
            NextChartId::<T>::put(chart_id.saturating_add(1));

            // 获取当前区块号和时间戳
            let block_number = <frame_system::Pallet<T>>::block_number();
            let timestamp = Self::get_timestamp_secs();

            // 创建排盘记录
            let chart = QimenChart {
                id: chart_id,
                diviner: diviner.clone(),
                method,
                year_ganzhi,
                month_ganzhi,
                day_ganzhi,
                hour_ganzhi,
                jie_qi,
                dun_type,
                san_yuan,
                ju_number,
                zhi_fu_xing,
                zhi_shi_men,
                palaces,
                timestamp,
                block_number,
                interpretation_cid: None,
                is_public,
                question_hash,
            };

            // 存储排盘记录
            Charts::<T>::insert(chart_id, chart);

            // 更新用户排盘索引
            UserCharts::<T>::try_mutate(&diviner, |list| {
                list.try_push(chart_id)
                    .map_err(|_| Error::<T>::UserChartsFull)
            })?;

            // 如果公开，添加到公开列表
            if is_public {
                PublicCharts::<T>::try_mutate(|list| {
                    list.try_push(chart_id)
                        .map_err(|_| Error::<T>::PublicChartsFull)
                })?;
            }

            // 更新用户统计
            UserStatsStorage::<T>::mutate(&diviner, |stats| {
                stats.update_from_chart(dun_type, zhi_fu_xing, zhi_shi_men);
            });

            // 发送事件
            Self::deposit_event(Event::ChartCreated {
                chart_id,
                diviner,
                dun_type,
                ju_number,
            });

            Ok(())
        }
    }
}
