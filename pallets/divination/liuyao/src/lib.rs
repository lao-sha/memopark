//! # pallet-liuyao
//!
//! ## 六爻排盘系统 - 区块链纳甲六爻占卜模块
//!
//! 本模块实现完整的六爻排盘算法，支持链上卦象生成与存储。
//!
//! ### 核心功能
//!
//! - **铜钱起卦**：模拟三枚铜钱法
//! - **数字起卦**：报数法起卦
//! - **时间起卦**：根据时辰自动起卦
//! - **随机起卦**：使用链上随机数
//! - **手动指定**：直接输入六爻
//! - **纳甲装卦**：自动装配天干地支
//! - **六亲六神**：自动计算六亲和六神
//! - **世应伏神**：自动安世应、查伏神
//! - **AI 解读**：集成通用占卜 AI 解读系统
//!
//! ### 技术架构
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    pallet-liuyao                             │
//! ├─────────────────────────────────────────────────────────────┤
//! │  Extrinsics:                                                 │
//! │  - divine_by_coins: 铜钱起卦                                  │
//! │  - divine_by_numbers: 数字起卦                                │
//! │  - divine_by_time: 时间起卦                                   │
//! │  - divine_random: 随机起卦                                    │
//! │  - divine_manual: 手动指定                                    │
//! │  - request_ai_interpretation: 请求AI解读                      │
//! ├─────────────────────────────────────────────────────────────┤
//! │  Algorithm:                                                  │
//! │  - 纳甲算法（八卦配天干地支）                                   │
//! │  - 世应计算（寻世诀）                                          │
//! │  - 卦宫归属（认宫诀）                                          │
//! │  - 六亲配置                                                   │
//! │  - 六神排布                                                   │
//! │  - 旬空计算                                                   │
//! │  - 伏神查找                                                   │
//! └─────────────────────────────────────────────────────────────┘
//! ```

#![cfg_attr(not(feature = "std"), no_std)]

pub mod algorithm;
pub mod shensha;
pub mod types;

#[cfg(test)]
mod mock;
#[cfg(test)]
mod tests;

pub use pallet::*;
pub use shensha::*;
pub use types::*;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use crate::algorithm::*;
    use frame_support::{
        pallet_prelude::*,
        traits::Randomness,
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Pallet 配置 trait
    ///
    /// 注：RuntimeEvent 关联类型已从 Polkadot SDK 2506 版本开始自动附加
    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        /// 随机数生成器
        type Randomness: Randomness<Self::Hash, BlockNumberFor<Self>>;

        /// 每用户最大卦象数量
        #[pallet::constant]
        type MaxUserGuas: Get<u32>;

        /// 公开列表最大长度
        #[pallet::constant]
        type MaxPublicGuas: Get<u32>;

        /// 每日免费起卦次数
        #[pallet::constant]
        type DailyFreeGuas: Get<u32>;

        /// 每日最大起卦次数
        #[pallet::constant]
        type MaxDailyGuas: Get<u32>;

        /// IPFS CID 最大长度
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
    }

    // ========================================================================
    // 存储项
    // ========================================================================

    /// 下一个卦象 ID
    #[pallet::storage]
    #[pallet::getter(fn next_gua_id)]
    pub type NextGuaId<T> = StorageValue<_, u64, ValueQuery>;

    /// 所有卦象数据
    #[pallet::storage]
    #[pallet::getter(fn guas)]
    pub type Guas<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        LiuYaoGua<T::AccountId, BlockNumberFor<T>, T::MaxCidLen>,
    >;

    /// 用户的卦象列表
    #[pallet::storage]
    #[pallet::getter(fn user_guas)]
    pub type UserGuas<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxUserGuas>,
        ValueQuery,
    >;

    /// 公开的卦象列表
    #[pallet::storage]
    #[pallet::getter(fn public_guas)]
    pub type PublicGuas<T: Config> = StorageValue<_, BoundedVec<u64, T::MaxPublicGuas>, ValueQuery>;

    /// 用户每日起卦次数
    #[pallet::storage]
    #[pallet::getter(fn daily_gua_count)]
    pub type DailyGuaCount<T: Config> =
        StorageMap<_, Blake2_128Concat, (T::AccountId, u32), u32, ValueQuery>;

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
        /// 卦象创建成功
        GuaCreated {
            gua_id: u64,
            creator: T::AccountId,
            method: DivinationMethod,
            original_name_idx: u8,
        },
        /// 可见性变更
        VisibilityChanged {
            gua_id: u64,
            is_public: bool,
        },
    }

    // ========================================================================
    // 错误
    // ========================================================================

    #[pallet::error]
    pub enum Error<T> {
        /// 卦象不存在
        GuaNotFound,
        /// 无权操作
        NotGuaOwner,
        /// 无效的铜钱数（应为0-3）
        InvalidCoinCount,
        /// 无效的数字（应大于0）
        InvalidNumber,
        /// 无效的动爻位置（应为1-6）
        InvalidDongYao,
        /// 超过每日起卦上限
        DailyLimitExceeded,
        /// 超过用户存储上限
        UserGuaLimitExceeded,
        /// 超过公开列表上限
        PublicGuaLimitExceeded,
    }

    // ========================================================================
    // Extrinsics
    // ========================================================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 铜钱起卦 - 模拟三枚铜钱法
        ///
        /// # 参数
        /// - `coins`: 六次摇卦结果，每个值为阳面个数(0-3)
        /// - `year_gz`: 年干支
        /// - `month_gz`: 月干支
        /// - `day_gz`: 日干支
        /// - `hour_gz`: 时干支
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_by_coins(
            origin: OriginFor<T>,
            coins: [u8; 6],
            year_gz: (u8, u8),
            month_gz: (u8, u8),
            day_gz: (u8, u8),
            hour_gz: (u8, u8),
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            for &coin in coins.iter() {
                ensure!(coin <= 3, Error::<T>::InvalidCoinCount);
            }

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 从铜钱结果生成六爻
            let yaos = coins_to_yaos(&coins);

            // 执行排卦
            let gua_id = Self::do_divine(
                &who,
                yaos,
                DivinationMethod::CoinMethod,
                (TianGan::from_index(year_gz.0), DiZhi::from_index(year_gz.1)),
                (TianGan::from_index(month_gz.0), DiZhi::from_index(month_gz.1)),
                (TianGan::from_index(day_gz.0), DiZhi::from_index(day_gz.1)),
                (TianGan::from_index(hour_gz.0), DiZhi::from_index(hour_gz.1)),
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let gua = Guas::<T>::get(gua_id).ok_or(Error::<T>::GuaNotFound)?;
            Self::deposit_event(Event::GuaCreated {
                gua_id,
                creator: who,
                method: DivinationMethod::CoinMethod,
                original_name_idx: gua.original_name_idx,
            });

            Ok(())
        }

        /// 数字起卦 - 报数法
        ///
        /// # 参数
        /// - `upper_num`: 上卦数（对应外卦，用户报的第一个数）
        /// - `lower_num`: 下卦数（对应内卦，用户报的第二个数）
        /// - `dong`: 动爻位置（1-6，从初爻到上爻）
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_by_numbers(
            origin: OriginFor<T>,
            upper_num: u16,
            lower_num: u16,
            dong: u8,
            year_gz: (u8, u8),
            month_gz: (u8, u8),
            day_gz: (u8, u8),
            hour_gz: (u8, u8),
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            ensure!(upper_num > 0 && lower_num > 0, Error::<T>::InvalidNumber);
            ensure!(dong >= 1 && dong <= 6, Error::<T>::InvalidDongYao);

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 从数字生成六爻
            let yaos = numbers_to_yaos(upper_num, lower_num, dong);

            // 执行排卦
            let gua_id = Self::do_divine(
                &who,
                yaos,
                DivinationMethod::NumberMethod,
                (TianGan::from_index(year_gz.0), DiZhi::from_index(year_gz.1)),
                (TianGan::from_index(month_gz.0), DiZhi::from_index(month_gz.1)),
                (TianGan::from_index(day_gz.0), DiZhi::from_index(day_gz.1)),
                (TianGan::from_index(hour_gz.0), DiZhi::from_index(hour_gz.1)),
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let gua = Guas::<T>::get(gua_id).ok_or(Error::<T>::GuaNotFound)?;
            Self::deposit_event(Event::GuaCreated {
                gua_id,
                creator: who,
                method: DivinationMethod::NumberMethod,
                original_name_idx: gua.original_name_idx,
            });

            Ok(())
        }

        /// 随机起卦 - 使用链上随机数
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_random(origin: OriginFor<T>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 生成随机数据
            let (random_hash, _) = T::Randomness::random(&who.encode());
            let random_bytes: [u8; 32] = random_hash.as_ref().try_into().unwrap_or([0u8; 32]);

            // 从随机数生成六爻
            let yaos = random_to_yaos(&random_bytes);

            // 生成随机干支
            let year_gz = (
                TianGan::from_index(random_bytes[24] % 10),
                DiZhi::from_index(random_bytes[25] % 12),
            );
            let month_gz = (
                TianGan::from_index(random_bytes[26] % 10),
                DiZhi::from_index(random_bytes[27] % 12),
            );
            let day_gz = (
                TianGan::from_index(random_bytes[28] % 10),
                DiZhi::from_index(random_bytes[29] % 12),
            );
            let hour_gz = (
                TianGan::from_index(random_bytes[30] % 10),
                DiZhi::from_index(random_bytes[31] % 12),
            );

            // 执行排卦
            let gua_id = Self::do_divine(
                &who,
                yaos,
                DivinationMethod::RandomMethod,
                year_gz,
                month_gz,
                day_gz,
                hour_gz,
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let gua = Guas::<T>::get(gua_id).ok_or(Error::<T>::GuaNotFound)?;
            Self::deposit_event(Event::GuaCreated {
                gua_id,
                creator: who,
                method: DivinationMethod::RandomMethod,
                original_name_idx: gua.original_name_idx,
            });

            Ok(())
        }

        /// 手动起卦 - 直接输入六爻
        ///
        /// # 参数
        /// - `yaos`: 六爻类型（0=少阴, 1=少阳, 2=老阴, 3=老阳）
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            yaos: [u8; 6],
            year_gz: (u8, u8),
            month_gz: (u8, u8),
            day_gz: (u8, u8),
            hour_gz: (u8, u8),
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            for &yao in yaos.iter() {
                ensure!(yao <= 3, Error::<T>::InvalidCoinCount);
            }

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 转换为Yao类型
            let mut yao_array = [Yao::ShaoYin; 6];
            for i in 0..6 {
                yao_array[i] = match yaos[i] {
                    0 => Yao::ShaoYin,
                    1 => Yao::ShaoYang,
                    2 => Yao::LaoYin,
                    _ => Yao::LaoYang,
                };
            }

            // 执行排卦
            let gua_id = Self::do_divine(
                &who,
                yao_array,
                DivinationMethod::ManualMethod,
                (TianGan::from_index(year_gz.0), DiZhi::from_index(year_gz.1)),
                (TianGan::from_index(month_gz.0), DiZhi::from_index(month_gz.1)),
                (TianGan::from_index(day_gz.0), DiZhi::from_index(day_gz.1)),
                (TianGan::from_index(hour_gz.0), DiZhi::from_index(hour_gz.1)),
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let gua = Guas::<T>::get(gua_id).ok_or(Error::<T>::GuaNotFound)?;
            Self::deposit_event(Event::GuaCreated {
                gua_id,
                creator: who,
                method: DivinationMethod::ManualMethod,
                original_name_idx: gua.original_name_idx,
            });

            Ok(())
        }

        /// 时间起卦 - 根据年月日时起卦
        ///
        /// # 参数
        /// - `year_zhi`: 年地支索引 (0-11，子=0)
        /// - `month_num`: 月数 (1-12)
        /// - `day_num`: 日数 (1-31)
        /// - `hour_zhi`: 时辰地支索引 (0-11)
        /// - `year_gz`: 年干支（用于排盘）
        /// - `month_gz`: 月干支
        /// - `day_gz`: 日干支
        /// - `hour_gz`: 时干支
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(100_000_000, 0))]
        pub fn divine_by_time(
            origin: OriginFor<T>,
            year_zhi: u8,
            month_num: u8,
            day_num: u8,
            hour_zhi: u8,
            year_gz: (u8, u8),
            month_gz: (u8, u8),
            day_gz: (u8, u8),
            hour_gz: (u8, u8),
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 参数校验
            ensure!(year_zhi < 12, Error::<T>::InvalidNumber);
            ensure!(month_num >= 1 && month_num <= 12, Error::<T>::InvalidNumber);
            ensure!(day_num >= 1 && day_num <= 31, Error::<T>::InvalidNumber);
            ensure!(hour_zhi < 12, Error::<T>::InvalidNumber);

            // 检查每日限制
            Self::check_daily_limit(&who)?;

            // 调用时间起卦算法
            let yaos = time_to_yaos(year_zhi, month_num, day_num, hour_zhi);

            // 执行排卦
            let gua_id = Self::do_divine(
                &who,
                yaos,
                DivinationMethod::TimeMethod,
                (TianGan::from_index(year_gz.0), DiZhi::from_index(year_gz.1)),
                (TianGan::from_index(month_gz.0), DiZhi::from_index(month_gz.1)),
                (TianGan::from_index(day_gz.0), DiZhi::from_index(day_gz.1)),
                (TianGan::from_index(hour_gz.0), DiZhi::from_index(hour_gz.1)),
            )?;

            // 更新每日计数
            Self::increment_daily_count(&who);

            // 发出事件
            let gua = Guas::<T>::get(gua_id).ok_or(Error::<T>::GuaNotFound)?;
            Self::deposit_event(Event::GuaCreated {
                gua_id,
                creator: who,
                method: DivinationMethod::TimeMethod,
                original_name_idx: gua.original_name_idx,
            });

            Ok(())
        }

        /// 设置卦象可见性
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn set_gua_visibility(
            origin: OriginFor<T>,
            gua_id: u64,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 检查卦象存在且属于调用者
            let gua = Guas::<T>::get(gua_id).ok_or(Error::<T>::GuaNotFound)?;
            ensure!(gua.creator == who, Error::<T>::NotGuaOwner);

            // 更新可见性
            Guas::<T>::mutate(gua_id, |maybe_gua| {
                if let Some(gua) = maybe_gua {
                    gua.is_public = is_public;
                }
            });

            // 更新公开列表
            if is_public {
                PublicGuas::<T>::try_mutate(|list| {
                    if !list.contains(&gua_id) {
                        list.try_push(gua_id).map_err(|_| Error::<T>::PublicGuaLimitExceeded)
                    } else {
                        Ok(())
                    }
                })?;
            } else {
                PublicGuas::<T>::mutate(|list| {
                    list.retain(|&id| id != gua_id);
                });
            }

            Self::deposit_event(Event::VisibilityChanged { gua_id, is_public });

            Ok(())
        }
    }

    // ========================================================================
    // 内部方法
    // ========================================================================

    impl<T: Config> Pallet<T> {
        /// 检查每日起卦限制
        fn check_daily_limit(who: &T::AccountId) -> DispatchResult {
            let current_block = <frame_system::Pallet<T>>::block_number();
            let day = Self::block_to_day(current_block);
            let count = DailyGuaCount::<T>::get((who, day));

            ensure!(count < T::MaxDailyGuas::get(), Error::<T>::DailyLimitExceeded);

            Ok(())
        }

        /// 增加每日计数
        fn increment_daily_count(who: &T::AccountId) {
            let current_block = <frame_system::Pallet<T>>::block_number();
            let day = Self::block_to_day(current_block);
            DailyGuaCount::<T>::mutate((who, day), |count| {
                *count = count.saturating_add(1);
            });
        }

        /// 区块号转天数
        fn block_to_day(block: BlockNumberFor<T>) -> u32 {
            // 假设 6 秒一个区块，14400 块 = 1 天
            let block_u32: u32 = block.try_into().unwrap_or(0);
            block_u32 / 14400
        }

        /// 执行排卦核心逻辑
        fn do_divine(
            who: &T::AccountId,
            yaos: [Yao; 6],
            method: DivinationMethod,
            year_gz: (TianGan, DiZhi),
            month_gz: (TianGan, DiZhi),
            day_gz: (TianGan, DiZhi),
            hour_gz: (TianGan, DiZhi),
        ) -> Result<u64, DispatchError> {
            // 检查用户存储上限
            let user_guas = UserGuas::<T>::get(who);
            ensure!(
                user_guas.len() < T::MaxUserGuas::get() as usize,
                Error::<T>::UserGuaLimitExceeded
            );

            // 获取新 ID
            let gua_id = NextGuaId::<T>::get();
            NextGuaId::<T>::put(gua_id + 1);

            // 计算内外卦
            let (original_inner, original_outer) = yaos_to_trigrams(&yaos);

            // 计算卦宫和世应
            let (gua_xu, gong) = calculate_shi_ying_gong(original_inner, original_outer);

            // 计算六神
            let liu_shen_array = calculate_liu_shen(day_gz.0);

            // 计算旬空
            let xun_kong = calculate_xun_kong(day_gz.0, day_gz.1);

            // 计算六十四卦索引
            let original_name_idx = calculate_gua_index(original_inner, original_outer);

            // 构建本卦六爻信息
            let gong_wx = gong.wu_xing();
            let mut original_yaos = [YaoInfo::default(); 6];
            let mut liu_qin_array = [LiuQin::XiongDi; 6];

            for i in 0..6 {
                let (gan, zhi) = if i < 3 {
                    get_inner_najia(original_inner, i as u8)
                } else {
                    get_outer_najia(original_outer, (i - 3) as u8)
                };

                let yao_wx = zhi.wu_xing();
                let liu_qin = LiuQin::from_wu_xing(gong_wx, yao_wx);
                liu_qin_array[i] = liu_qin;

                let shi_pos = gua_xu.shi_yao_pos() as usize;
                let ying_pos = gua_xu.ying_yao_pos() as usize;

                original_yaos[i] = YaoInfo {
                    yao: yaos[i],
                    tian_gan: gan,
                    di_zhi: zhi,
                    wu_xing: yao_wx,
                    liu_qin,
                    liu_shen: liu_shen_array[i],
                    is_shi: i + 1 == shi_pos,
                    is_ying: i + 1 == ying_pos,
                };
            }

            // 计算变卦
            let (changed_inner, changed_outer, has_bian_gua) = calculate_bian_gua(&yaos);
            let changed_name_idx = calculate_gua_index(changed_inner, changed_outer);

            // 构建变卦六爻信息
            let mut changed_yaos = [YaoInfo::default(); 6];
            if has_bian_gua {
                for i in 0..6 {
                    let (gan, zhi) = if i < 3 {
                        get_inner_najia(changed_inner, i as u8)
                    } else {
                        get_outer_najia(changed_outer, (i - 3) as u8)
                    };

                    let yao_wx = zhi.wu_xing();
                    // 变卦六亲仍按本卦卦宫计算
                    let liu_qin = LiuQin::from_wu_xing(gong_wx, yao_wx);

                    changed_yaos[i] = YaoInfo {
                        yao: if yaos[i].is_moving() {
                            if yaos[i].is_yang() { Yao::ShaoYin } else { Yao::ShaoYang }
                        } else {
                            yaos[i]
                        },
                        tian_gan: gan,
                        di_zhi: zhi,
                        wu_xing: yao_wx,
                        liu_qin,
                        liu_shen: liu_shen_array[i],
                        is_shi: false,
                        is_ying: false,
                    };
                }
            }

            // 计算动爻位图
            let moving_yaos = calculate_moving_bitmap(&yaos);

            // 计算互卦
            let (hu_inner, hu_outer) = calculate_hu_gua(&yaos);
            let hu_name_idx = calculate_gua_index(hu_inner, hu_outer);

            // 计算卦身
            let shi_pos = gua_xu.shi_yao_pos();
            let shi_is_yang = yaos[(shi_pos - 1) as usize].is_yang();
            let gua_shen = calculate_gua_shen(shi_pos, shi_is_yang);

            // 查找伏神
            let fu_shen = find_fu_shen(gong, &liu_qin_array);

            // 创建卦象
            let gua = LiuYaoGua {
                id: gua_id,
                creator: who.clone(),
                created_at: <frame_system::Pallet<T>>::block_number(),
                method,
                question_cid: None,
                year_gz,
                month_gz,
                day_gz,
                hour_gz,
                original_yaos,
                original_inner,
                original_outer,
                original_name_idx,
                gong,
                gua_xu,
                has_bian_gua,
                changed_yaos,
                changed_inner,
                changed_outer,
                changed_name_idx,
                hu_inner,
                hu_outer,
                hu_name_idx,
                gua_shen,
                moving_yaos,
                xun_kong,
                fu_shen,
                is_public: false,
            };

            // 存储卦象
            Guas::<T>::insert(gua_id, gua);

            // 更新用户卦象列表
            UserGuas::<T>::try_mutate(who, |list| {
                list.try_push(gua_id).map_err(|_| Error::<T>::UserGuaLimitExceeded)
            })?;

            // 更新用户统计
            UserStatsStorage::<T>::mutate(who, |stats| {
                if stats.total_guas == 0 {
                    stats.first_gua_block = Self::block_to_day(<frame_system::Pallet<T>>::block_number());
                }
                stats.total_guas = stats.total_guas.saturating_add(1);
            });

            Ok(gua_id)
        }
    }
}
