//! # 梅花易数排盘 Pallet
//!
//! 本模块实现了区块链上的梅花易数排盘系统，提供：
//! - 时间起卦（使用区块时间戳转农历）
//! - 双数起卦
//! - 随机起卦（使用链上随机数）
//! - 手动指定起卦
//! - 卦象存储与查询
//! - AI 解卦请求（链下工作机触发）
//!
//! ## 核心概念
//!
//! - **八卦**: 乾、兑、离、震、巽、坎、艮、坤
//! - **五行**: 金、木、水、火、土
//! - **体用关系**: 判断吉凶的核心依据
//! - **本卦、变卦、互卦**: 完整的梅花易数排盘结果

#![cfg_attr(not(feature = "std"), no_std)]

#[cfg(not(feature = "std"))]
extern crate alloc;

pub use pallet::*;

pub mod algorithm;
pub mod constants;
pub mod interpretation;
pub mod lunar;
pub mod types;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use crate::algorithm;
    use crate::lunar::{timestamp_to_lunar, LunarError};
    use crate::types::*;
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ExistenceRequirement, Randomness},
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_std::prelude::*;

    /// Pallet 配置 trait
    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        /// 货币类型
        type Currency: Currency<Self::AccountId>;

        /// 随机数生成器
        type Randomness: Randomness<Self::Hash, BlockNumberFor<Self>>;

        /// 每个用户最多存储的卦象数量
        #[pallet::constant]
        type MaxUserHexagrams: Get<u32>;

        /// 公开卦象列表的最大长度
        #[pallet::constant]
        type MaxPublicHexagrams: Get<u32>;

        /// 每日免费起卦次数
        #[pallet::constant]
        type DailyFreeDivinations: Get<u32>;

        /// 每日最大起卦次数（防刷）
        #[pallet::constant]
        type MaxDailyDivinations: Get<u32>;

        /// AI 解卦费用
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

    // ==================== 存储项 ====================

    /// 下一个卦象 ID
    #[pallet::storage]
    #[pallet::getter(fn next_hexagram_id)]
    pub type NextHexagramId<T> = StorageValue<_, u64, ValueQuery>;

    /// 卦象存储（完整卦象信息）
    ///
    /// 键：卦象 ID
    /// 值：完整卦象结构（含本卦、变卦、互卦、体用关系）
    #[pallet::storage]
    #[pallet::getter(fn hexagrams)]
    pub type Hexagrams<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        FullDivination<T::AccountId, BlockNumberFor<T>>,
    >;

    /// 用户卦象索引
    ///
    /// 键：用户账户
    /// 值：该用户的所有卦象 ID 列表
    #[pallet::storage]
    #[pallet::getter(fn user_hexagrams)]
    pub type UserHexagrams<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxUserHexagrams>,
        ValueQuery,
    >;

    /// 公开卦象列表
    ///
    /// 存储所有设置为公开的卦象 ID
    #[pallet::storage]
    #[pallet::getter(fn public_hexagrams)]
    pub type PublicHexagrams<T: Config> =
        StorageValue<_, BoundedVec<u64, T::MaxPublicHexagrams>, ValueQuery>;

    /// 每日起卦计数
    ///
    /// 用于限制每日起卦次数，防止滥用
    /// 键1：用户账户
    /// 键2：天数（从创世块起算）
    /// 值：当日起卦次数
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

    /// AI 解卦请求队列
    ///
    /// 存储待处理的 AI 解卦请求
    #[pallet::storage]
    #[pallet::getter(fn ai_interpretation_requests)]
    pub type AiInterpretationRequests<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, T::AccountId>;

    /// 解卦数据存储
    ///
    /// 键：卦象 ID
    /// 值：完整解卦数据
    #[pallet::storage]
    #[pallet::getter(fn interpretations)]
    pub type Interpretations<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        crate::interpretation::InterpretationData,
    >;

    /// AI解读结果存储
    ///
    /// 键：卦象 ID
    /// 值：AI解读结果
    #[pallet::storage]
    #[pallet::getter(fn ai_interpretations)]
    pub type AiInterpretations<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        crate::interpretation::AiInterpretationResult,
    >;

    // ==================== 事件 ====================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新卦象创建成功
        /// [卦象ID, 占卜者, 起卦方式]
        HexagramCreated {
            hexagram_id: u64,
            diviner: T::AccountId,
            method: DivinationMethod,
        },

        /// AI 解卦请求已提交
        /// [卦象ID, 请求者]
        AiInterpretationRequested {
            hexagram_id: u64,
            requester: T::AccountId,
        },

        /// AI 解卦结果已提交
        /// [卦象ID, IPFS CID]
        AiInterpretationSubmitted {
            hexagram_id: u64,
            cid: BoundedVec<u8, ConstU32<64>>,
        },

        /// 卦象公开状态已更改
        /// [卦象ID, 是否公开]
        HexagramVisibilityChanged { hexagram_id: u64, is_public: bool },

        /// 解卦数据已创建
        /// [卦象ID, 吉凶等级]
        InterpretationCreated {
            hexagram_id: u64,
            fortune_level: u8,
        },

        /// 解卦数据已更新
        /// [卦象ID]
        InterpretationUpdated {
            hexagram_id: u64,
        },
    }

    // ==================== 错误 ====================

    #[pallet::error]
    pub enum Error<T> {
        /// 卦象不存在
        HexagramNotFound,
        /// 非卦象所有者
        NotOwner,
        /// 每日起卦次数超限
        DailyLimitExceeded,
        /// 年份超出支持范围（1900-2100）
        InvalidYear,
        /// 日期早于支持的最早日期
        DateTooEarly,
        /// 无效的月份
        InvalidMonth,
        /// 无效的日期
        InvalidDay,
        /// 用户卦象列表已满
        UserHexagramsFull,
        /// 公开卦象列表已满
        PublicHexagramsFull,
        /// 无效的动爻（应为 1-6）
        InvalidDongYao,
        /// 无效的卦数（应为 1-8）
        InvalidGuaNum,
        /// 双数起卦参数缺失
        MissingNumberParams,
        /// 手动起卦参数缺失
        MissingManualParams,
        /// AI 解卦费用不足
        InsufficientFee,
        /// AI 解卦请求已存在
        AiRequestAlreadyExists,
        /// AI 解卦请求不存在
        AiRequestNotFound,
        /// 解卦数据不存在
        InterpretationNotFound,
        /// 解卦数据已存在
        InterpretationAlreadyExists,
        /// 无效的占卜类别
        InvalidCategory,
        /// 无效的性别
        InvalidGender,
    }

    // ==================== 可调用函数 ====================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 时间起卦
        ///
        /// 使用当前区块时间戳转换为农历，按照梅花易数传统公式计算卦象。
        ///
        /// # 参数
        /// - `origin`: 调用者（签名账户）
        /// - `question_hash`: 占卜问题的哈希值（隐私保护）
        /// - `is_public`: 是否公开此卦象
        /// - `gender`: 性别（0: 未指定, 1: 男, 2: 女）
        /// - `category`: 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他）
        ///
        /// # 费用
        /// - 每日前 N 次免费（由 DailyFreeDivinations 配置）
        /// - 超出后需支付费用
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_time(
            origin: OriginFor<T>,
            question_hash: [u8; 32],
            is_public: bool,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数
            ensure!(gender <= 2, Error::<T>::InvalidGender);
            ensure!(category <= 6, Error::<T>::InvalidCategory);

            // 获取当前时间戳并转换为农历
            let timestamp = Self::get_timestamp_secs();
            let lunar_date = Self::convert_timestamp_to_lunar(timestamp)?;

            // 使用农历日期计算卦数
            let (shang_gua_num, xia_gua_num, dong_yao) = algorithm::divine_by_datetime(&lunar_date);

            // 创建卦象
            Self::create_hexagram(
                who,
                shang_gua_num,
                xia_gua_num,
                dong_yao,
                DivinationMethod::DateTime,
                question_hash,
                is_public,
                gender,
                category,
            )
        }

        /// 双数起卦
        ///
        /// 使用两个数字进行起卦，配合当前时辰计算动爻。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `num1`: 第一个数字（用于上卦）
        /// - `num2`: 第二个数字（用于下卦）
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        /// - `gender`: 性别（0: 未指定, 1: 男, 2: 女）
        /// - `category`: 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他）
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_numbers(
            origin: OriginFor<T>,
            num1: u16,
            num2: u16,
            question_hash: [u8; 32],
            is_public: bool,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数
            ensure!(gender <= 2, Error::<T>::InvalidGender);
            ensure!(category <= 6, Error::<T>::InvalidCategory);

            // 获取当前时辰
            let timestamp = Self::get_timestamp_secs();
            let lunar_date = Self::convert_timestamp_to_lunar(timestamp)?;
            let hour_zhi_num = lunar_date.hour_zhi_num;

            // 计算卦数
            let (shang_gua_num, xia_gua_num, dong_yao) =
                algorithm::divine_by_numbers(num1, num2, hour_zhi_num);

            Self::create_hexagram(
                who,
                shang_gua_num,
                xia_gua_num,
                dong_yao,
                DivinationMethod::TwoNumbers,
                question_hash,
                is_public,
                gender,
                category,
            )
        }

        /// 随机起卦
        ///
        /// 使用链上随机数生成卦象，适合无特定数字时使用。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        /// - `gender`: 性别（0: 未指定, 1: 男, 2: 女）
        /// - `category`: 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他）
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_random(
            origin: OriginFor<T>,
            question_hash: [u8; 32],
            is_public: bool,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数
            ensure!(gender <= 2, Error::<T>::InvalidGender);
            ensure!(category <= 6, Error::<T>::InvalidCategory);

            // 使用链上随机源
            let random_seed = T::Randomness::random(&b"meihua"[..]).0;
            let random_bytes: [u8; 32] = random_seed
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            let (shang_gua_num, xia_gua_num, dong_yao) =
                algorithm::divine_by_random(&random_bytes);

            Self::create_hexagram(
                who,
                shang_gua_num,
                xia_gua_num,
                dong_yao,
                DivinationMethod::Random,
                question_hash,
                is_public,
                gender,
                category,
            )
        }

        /// 手动指定起卦
        ///
        /// 直接指定上卦、下卦、动爻，用于已知卦象的记录。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `shang_gua_num`: 上卦数（1-8）
        /// - `xia_gua_num`: 下卦数（1-8）
        /// - `dong_yao`: 动爻（1-6）
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        /// - `gender`: 性别（0: 未指定, 1: 男, 2: 女）
        /// - `category`: 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他）
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            shang_gua_num: u8,
            xia_gua_num: u8,
            dong_yao: u8,
            question_hash: [u8; 32],
            is_public: bool,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数有效性
            ensure!(
                shang_gua_num >= 1 && shang_gua_num <= 8,
                Error::<T>::InvalidGuaNum
            );
            ensure!(
                xia_gua_num >= 1 && xia_gua_num <= 8,
                Error::<T>::InvalidGuaNum
            );
            ensure!(dong_yao >= 1 && dong_yao <= 6, Error::<T>::InvalidDongYao);
            ensure!(gender <= 2, Error::<T>::InvalidGender);
            ensure!(category <= 6, Error::<T>::InvalidCategory);

            Self::create_hexagram(
                who,
                shang_gua_num,
                xia_gua_num,
                dong_yao,
                DivinationMethod::Manual,
                question_hash,
                is_public,
                gender,
                category,
            )
        }

        /// 单数起卦
        ///
        /// 使用一个多位数字进行起卦，将数字拆分为前后两半分别计算上下卦。
        ///
        /// # 算法
        /// - 将数字拆分为前半段和后半段
        /// - 上卦数 = 前半段各位数字之和 % 8
        /// - 下卦数 = 后半段各位数字之和 % 8
        /// - 动爻数 = (前半 + 后半 + 时辰数) % 6
        ///
        /// # 示例
        /// 输入 38271：前半 3+8=11，后半 2+7+1=10
        /// - 上卦 = 11 % 8 = 3（离）
        /// - 下卦 = 10 % 8 = 2（兑）
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `number`: 多位数字（建议至少2位）
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        /// - `gender`: 性别（0: 未指定, 1: 男, 2: 女）
        /// - `category`: 占卜类别（0: 未指定, 1: 事业, 2: 财运, 3: 感情, 4: 健康, 5: 学业, 6: 其他）
        #[pallet::call_index(7)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_single_number(
            origin: OriginFor<T>,
            number: u32,
            question_hash: [u8; 32],
            is_public: bool,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 验证参数
            ensure!(gender <= 2, Error::<T>::InvalidGender);
            ensure!(category <= 6, Error::<T>::InvalidCategory);

            // 获取当前时辰
            let timestamp = Self::get_timestamp_secs();
            let lunar_date = Self::convert_timestamp_to_lunar(timestamp)?;
            let hour_zhi_num = lunar_date.hour_zhi_num;

            // 计算卦数
            let (shang_gua_num, xia_gua_num, dong_yao) =
                algorithm::divine_by_single_number(number, hour_zhi_num);

            Self::create_hexagram(
                who,
                shang_gua_num,
                xia_gua_num,
                dong_yao,
                DivinationMethod::SingleNumber,
                question_hash,
                is_public,
                gender,
                category,
            )
        }

        /// 请求 AI 解卦（已废弃）
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
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `hexagram_id`: 卦象 ID
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        #[deprecated(
            since = "0.2.0",
            note = "请使用 pallet_divination_ai::request_interpretation"
        )]
        pub fn request_ai_interpretation(
            origin: OriginFor<T>,
            hexagram_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证卦象存在且为调用者所有
            let hexagram = Hexagrams::<T>::get(hexagram_id)
                .ok_or(Error::<T>::HexagramNotFound)?;
            ensure!(hexagram.ben_gua.diviner == who, Error::<T>::NotOwner);

            // 检查是否已有请求
            ensure!(
                !AiInterpretationRequests::<T>::contains_key(hexagram_id),
                Error::<T>::AiRequestAlreadyExists
            );

            // 扣除 AI 解卦费用
            T::Currency::transfer(
                &who,
                &T::TreasuryAccount::get(),
                T::AiInterpretationFee::get(),
                ExistenceRequirement::KeepAlive,
            )?;

            // 记录请求
            AiInterpretationRequests::<T>::insert(hexagram_id, who.clone());

            // 发送事件触发链下工作机
            Self::deposit_event(Event::AiInterpretationRequested {
                hexagram_id,
                requester: who,
            });

            Ok(())
        }

        /// 提交 AI 解读结果（仅限授权节点）（已废弃）
        ///
        /// **注意**：此函数已废弃，请使用 `pallet_divination_ai::submit_result`
        /// 新的统一 AI 解读系统支持更完善的结果提交和验证机制。
        ///
        /// # 参数
        /// - `origin`: AI 预言机授权来源
        /// - `hexagram_id`: 卦象 ID
        /// - `interpretation_cid`: 解读内容的 IPFS CID
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        #[deprecated(
            since = "0.2.0",
            note = "请使用 pallet_divination_ai::submit_result"
        )]
        pub fn submit_ai_interpretation(
            origin: OriginFor<T>,
            hexagram_id: u64,
            interpretation_cid: BoundedVec<u8, ConstU32<64>>,
        ) -> DispatchResult {
            // 验证 AI 预言机权限
            T::AiOracleOrigin::ensure_origin(origin)?;

            // 验证请求存在
            ensure!(
                AiInterpretationRequests::<T>::contains_key(hexagram_id),
                Error::<T>::AiRequestNotFound
            );

            // 更新卦象的 AI 解读 CID
            Hexagrams::<T>::try_mutate(hexagram_id, |maybe_hexagram| {
                let hexagram = maybe_hexagram
                    .as_mut()
                    .ok_or(Error::<T>::HexagramNotFound)?;
                hexagram.ben_gua.interpretation_cid = Some(interpretation_cid.clone());
                Ok::<_, DispatchError>(())
            })?;

            // 移除请求
            AiInterpretationRequests::<T>::remove(hexagram_id);

            Self::deposit_event(Event::AiInterpretationSubmitted {
                hexagram_id,
                cid: interpretation_cid,
            });

            Ok(())
        }

        /// 更改卦象公开状态
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `hexagram_id`: 卦象 ID
        /// - `is_public`: 是否公开
        #[pallet::call_index(6)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn set_hexagram_visibility(
            origin: OriginFor<T>,
            hexagram_id: u64,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Hexagrams::<T>::try_mutate(hexagram_id, |maybe_hexagram| {
                let hexagram = maybe_hexagram
                    .as_mut()
                    .ok_or(Error::<T>::HexagramNotFound)?;
                ensure!(hexagram.ben_gua.diviner == who, Error::<T>::NotOwner);

                let was_public = hexagram.ben_gua.is_public;
                hexagram.ben_gua.is_public = is_public;

                // 更新公开卦象列表
                if is_public && !was_public {
                    // 添加到公开列表
                    PublicHexagrams::<T>::try_mutate(|list| {
                        list.try_push(hexagram_id)
                            .map_err(|_| Error::<T>::PublicHexagramsFull)
                    })?;
                } else if !is_public && was_public {
                    // 从公开列表移除
                    PublicHexagrams::<T>::mutate(|list| {
                        list.retain(|&id| id != hexagram_id);
                    });
                }

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::HexagramVisibilityChanged {
                hexagram_id,
                is_public,
            });

            Ok(())
        }
    }

    // ==================== 内部辅助函数 ====================

    impl<T: Config> Pallet<T> {
        /// 获取当前时间戳（秒）
        ///
        /// 从 pallet-timestamp 获取时间戳并转换为秒
        fn get_timestamp_secs() -> u64 {
            let moment = pallet_timestamp::Pallet::<T>::get();
            // pallet-timestamp 的 Moment 通常是 u64 毫秒
            // 转换为 u64 并除以 1000 得到秒
            let ms: u64 = moment.try_into().unwrap_or(0);
            ms / 1000
        }

        /// 检查每日起卦次数限制
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
            // 每天 86400 秒
            (timestamp / 86400) as u32
        }

        /// 时间戳转农历日期
        fn convert_timestamp_to_lunar(timestamp: u64) -> Result<crate::lunar::LunarDate, DispatchError> {
            timestamp_to_lunar(timestamp).map_err(|e| match e {
                LunarError::InvalidYear => Error::<T>::InvalidYear.into(),
                LunarError::DateTooEarly => Error::<T>::DateTooEarly.into(),
                LunarError::InvalidMonth => Error::<T>::InvalidMonth.into(),
                LunarError::InvalidDay => Error::<T>::InvalidDay.into(),
            })
        }

        /// 创建解卦数据
        ///
        /// 根据完整卦象创建解卦数据并存储
        ///
        /// # 参数
        /// - `hexagram_id`: 卦象 ID
        /// - `full_divination`: 完整卦象信息
        /// - `timestamp`: 起卦时间戳
        /// - `method`: 起卦方式
        /// - `gender`: 性别
        /// - `category`: 占卜类别
        fn create_interpretation_data(
            hexagram_id: u64,
            full_divination: &FullDivination<T::AccountId, BlockNumberFor<T>>,
            timestamp: u64,
            method: DivinationMethod,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            use crate::interpretation::{InterpretationData, LunarDateInfo};

            // 转换时间戳为农历
            let lunar_date_data = Self::convert_timestamp_to_lunar(timestamp)?;

            // 创建农历信息结构
            let lunar_date = LunarDateInfo {
                year: lunar_date_data.year,
                month: lunar_date_data.month,
                day: lunar_date_data.day,
                hour_zhi_num: lunar_date_data.hour_zhi_num,
                is_leap_month: lunar_date_data.is_leap_month,
            };

            // 使用 InterpretationData::from_full_divination 创建解卦数据
            let interpretation_data = InterpretationData::from_full_divination(
                full_divination,
                timestamp,
                lunar_date,
                method,
                gender,
                category,
            );

            // 存储解卦数据
            Interpretations::<T>::insert(hexagram_id, interpretation_data.clone());

            // 发送解卦数据创建事件
            Self::deposit_event(Event::InterpretationCreated {
                hexagram_id,
                fortune_level: interpretation_data.tiyong_analysis.fortune_level,
            });

            Ok(())
        }

        /// 创建完整卦象并存储
        fn create_hexagram(
            diviner: T::AccountId,
            shang_gua_num: u8,
            xia_gua_num: u8,
            dong_yao: u8,
            method: DivinationMethod,
            question_hash: [u8; 32],
            is_public: bool,
            gender: u8,
            category: u8,
        ) -> DispatchResult {
            // 获取新的卦象 ID
            let hexagram_id = NextHexagramId::<T>::get();
            NextHexagramId::<T>::put(hexagram_id.saturating_add(1));

            // 获取当前区块号和时间戳
            let block_number = <frame_system::Pallet<T>>::block_number();
            let timestamp = Self::get_timestamp_secs();

            // 创建本卦
            let shang_gua = SingleGua::from_num(shang_gua_num);
            let xia_gua = SingleGua::from_num(xia_gua_num);

            // 判断体用
            let ti_is_shang = algorithm::determine_ti_is_shang(dong_yao);

            // 创建 Hexagram 结构
            let ben_gua = Hexagram {
                id: hexagram_id,
                diviner: diviner.clone(),
                shang_gua,
                xia_gua,
                dong_yao,
                ti_is_shang,
                question_hash,
                method: method.clone(),
                block_number,
                timestamp,
                interpretation_cid: None,
                is_public,
            };

            // 创建完整卦象（自动计算变卦、互卦、体用关系、吉凶）
            let full_divination = FullDivination::from_hexagram(ben_gua);

            // 存储卦象
            Hexagrams::<T>::insert(hexagram_id, full_divination.clone());

            // 创建解卦数据
            Self::create_interpretation_data(
                hexagram_id,
                &full_divination,
                timestamp,
                method.clone(),
                gender,
                category,
            )?;

            // 更新用户卦象索引
            UserHexagrams::<T>::try_mutate(&diviner, |list| {
                list.try_push(hexagram_id)
                    .map_err(|_| Error::<T>::UserHexagramsFull)
            })?;

            // 如果公开，添加到公开列表
            if is_public {
                PublicHexagrams::<T>::try_mutate(|list| {
                    list.try_push(hexagram_id)
                        .map_err(|_| Error::<T>::PublicHexagramsFull)
                })?;
            }

            // 发送事件
            Self::deposit_event(Event::HexagramCreated {
                hexagram_id,
                diviner,
                method,
            });

            Ok(())
        }

        /// 获取卦象详细信息（公共查询 API）
        ///
        /// 根据卦象 ID 获取完整的详细信息，包括文本名称、符号等
        /// 适合前端展示使用
        ///
        /// # 参数
        /// - `hexagram_id`: 卦象 ID
        ///
        /// # 返回
        /// - 完整排盘详细信息（包含本卦、变卦、互卦、错卦、综卦、伏卦）
        pub fn get_hexagram_detail(hexagram_id: u64) -> Option<FullDivinationDetail> {
            use crate::constants::get_tiyong_interpretation;

            let full_div = Hexagrams::<T>::get(hexagram_id)?;

            // 计算错卦和综卦
            let (cuo_shang, cuo_xia) = algorithm::calc_cuo_gua(
                &full_div.ben_gua.shang_gua,
                &full_div.ben_gua.xia_gua,
            );
            let (zong_shang, zong_xia) = algorithm::calc_zong_gua(
                &full_div.ben_gua.shang_gua,
                &full_div.ben_gua.xia_gua,
            );

            // 计算伏卦（新增）
            let (fu_shang, fu_xia) = algorithm::calc_fu_gua(
                &full_div.ben_gua.shang_gua,
                &full_div.ben_gua.xia_gua,
            );

            // 错卦体用关系（使用本卦的体用位置）
            let cuo_relation = if full_div.ben_gua.ti_is_shang {
                TiYongRelation::calculate(&cuo_shang.wuxing(), &cuo_xia.wuxing())
            } else {
                TiYongRelation::calculate(&cuo_xia.wuxing(), &cuo_shang.wuxing())
            };

            // 综卦体用关系
            let zong_relation = if full_div.ben_gua.ti_is_shang {
                TiYongRelation::calculate(&zong_shang.wuxing(), &zong_xia.wuxing())
            } else {
                TiYongRelation::calculate(&zong_xia.wuxing(), &zong_shang.wuxing())
            };

            // 互卦体用关系
            let hu_relation = if full_div.ben_gua.ti_is_shang {
                TiYongRelation::calculate(&full_div.hu_gua.0.wuxing(), &full_div.hu_gua.1.wuxing())
            } else {
                TiYongRelation::calculate(&full_div.hu_gua.1.wuxing(), &full_div.hu_gua.0.wuxing())
            };

            // 伏卦体用关系（新增）
            let fu_relation = if full_div.ben_gua.ti_is_shang {
                TiYongRelation::calculate(&fu_shang.wuxing(), &fu_xia.wuxing())
            } else {
                TiYongRelation::calculate(&fu_xia.wuxing(), &fu_shang.wuxing())
            };

            // 获取体用关系详细解读（新增）
            let tiyong_interp = get_tiyong_interpretation(full_div.ben_gua_relation as u8);

            Some(FullDivinationDetail {
                ben_gua: HexagramDetail::from_hexagram(
                    &full_div.ben_gua.shang_gua,
                    &full_div.ben_gua.xia_gua,
                    full_div.ben_gua.dong_yao,
                    &full_div.ben_gua_relation,
                    &full_div.fortune,
                ),
                bian_gua: HexagramDetail::from_hexagram(
                    &full_div.bian_gua.0,
                    &full_div.bian_gua.1,
                    full_div.ben_gua.dong_yao,
                    &full_div.bian_gua_relation,
                    &Fortune::from_relations(&full_div.bian_gua_relation, None),
                ),
                hu_gua: HexagramDetail::from_hexagram(
                    &full_div.hu_gua.0,
                    &full_div.hu_gua.1,
                    full_div.ben_gua.dong_yao,
                    &hu_relation,
                    &Fortune::from_relations(&hu_relation, None),
                ),
                cuo_gua: HexagramDetail::from_hexagram(
                    &cuo_shang,
                    &cuo_xia,
                    full_div.ben_gua.dong_yao,
                    &cuo_relation,
                    &Fortune::from_relations(&cuo_relation, None),
                ),
                zong_gua: HexagramDetail::from_hexagram(
                    &zong_shang,
                    &zong_xia,
                    full_div.ben_gua.dong_yao,
                    &zong_relation,
                    &Fortune::from_relations(&zong_relation, None),
                ),
                fu_gua: HexagramDetail::from_hexagram(
                    &fu_shang,
                    &fu_xia,
                    full_div.ben_gua.dong_yao,
                    &fu_relation,
                    &Fortune::from_relations(&fu_relation, None),
                ),
                tiyong_interpretation: BoundedVec::try_from(tiyong_interp.as_bytes().to_vec())
                    .unwrap_or_default(),
            })
        }

        /// 获取单个卦象详细信息（不需要存储ID）
        ///
        /// 根据上卦数、下卦数、动爻直接计算详细信息
        /// 适合快速查询使用
        ///
        /// # 参数
        /// - `shang_gua_num`: 上卦数（1-8）
        /// - `xia_gua_num`: 下卦数（1-8）
        /// - `dong_yao`: 动爻（1-6）
        ///
        /// # 返回
        /// - 完整排盘详细信息
        pub fn calculate_hexagram_detail(
            shang_gua_num: u8,
            xia_gua_num: u8,
            dong_yao: u8,
        ) -> FullDivinationDetail {
            use crate::constants::get_tiyong_interpretation;

            // 验证参数
            let shang_num = if shang_gua_num == 0 || shang_gua_num > 8 { 1 } else { shang_gua_num };
            let xia_num = if xia_gua_num == 0 || xia_gua_num > 8 { 1 } else { xia_gua_num };
            let dong = if dong_yao == 0 || dong_yao > 6 { 1 } else { dong_yao };

            // 创建本卦
            let shang_gua = SingleGua::from_num(shang_num);
            let xia_gua = SingleGua::from_num(xia_num);

            // 判断体用
            let ti_is_shang = algorithm::determine_ti_is_shang(dong);

            // 计算各卦
            let (bian_shang, bian_xia) = algorithm::calc_bian_gua(&shang_gua, &xia_gua, dong);
            let (hu_shang, hu_xia) = algorithm::calc_hu_gua(&shang_gua, &xia_gua);
            let (cuo_shang, cuo_xia) = algorithm::calc_cuo_gua(&shang_gua, &xia_gua);
            let (zong_shang, zong_xia) = algorithm::calc_zong_gua(&shang_gua, &xia_gua);
            let (fu_shang, fu_xia) = algorithm::calc_fu_gua(&shang_gua, &xia_gua);

            // 计算体用关系
            let ben_relation = if ti_is_shang {
                TiYongRelation::calculate(&shang_gua.wuxing(), &xia_gua.wuxing())
            } else {
                TiYongRelation::calculate(&xia_gua.wuxing(), &shang_gua.wuxing())
            };

            let bian_relation = if ti_is_shang {
                TiYongRelation::calculate(&bian_shang.wuxing(), &bian_xia.wuxing())
            } else {
                TiYongRelation::calculate(&bian_xia.wuxing(), &bian_shang.wuxing())
            };

            let hu_relation = if ti_is_shang {
                TiYongRelation::calculate(&hu_shang.wuxing(), &hu_xia.wuxing())
            } else {
                TiYongRelation::calculate(&hu_xia.wuxing(), &hu_shang.wuxing())
            };

            let cuo_relation = if ti_is_shang {
                TiYongRelation::calculate(&cuo_shang.wuxing(), &cuo_xia.wuxing())
            } else {
                TiYongRelation::calculate(&cuo_xia.wuxing(), &cuo_shang.wuxing())
            };

            let zong_relation = if ti_is_shang {
                TiYongRelation::calculate(&zong_shang.wuxing(), &zong_xia.wuxing())
            } else {
                TiYongRelation::calculate(&zong_xia.wuxing(), &zong_shang.wuxing())
            };

            let fu_relation = if ti_is_shang {
                TiYongRelation::calculate(&fu_shang.wuxing(), &fu_xia.wuxing())
            } else {
                TiYongRelation::calculate(&fu_xia.wuxing(), &fu_shang.wuxing())
            };

            // 综合吉凶
            let fortune = Fortune::from_relations(&ben_relation, Some(&bian_relation));

            // 获取体用关系详细解读
            let tiyong_interp = get_tiyong_interpretation(ben_relation as u8);

            FullDivinationDetail {
                ben_gua: HexagramDetail::from_hexagram(
                    &shang_gua,
                    &xia_gua,
                    dong,
                    &ben_relation,
                    &fortune,
                ),
                bian_gua: HexagramDetail::from_hexagram(
                    &bian_shang,
                    &bian_xia,
                    dong,
                    &bian_relation,
                    &Fortune::from_relations(&bian_relation, None),
                ),
                hu_gua: HexagramDetail::from_hexagram(
                    &hu_shang,
                    &hu_xia,
                    dong,
                    &hu_relation,
                    &Fortune::from_relations(&hu_relation, None),
                ),
                cuo_gua: HexagramDetail::from_hexagram(
                    &cuo_shang,
                    &cuo_xia,
                    dong,
                    &cuo_relation,
                    &Fortune::from_relations(&cuo_relation, None),
                ),
                zong_gua: HexagramDetail::from_hexagram(
                    &zong_shang,
                    &zong_xia,
                    dong,
                    &zong_relation,
                    &Fortune::from_relations(&zong_relation, None),
                ),
                fu_gua: HexagramDetail::from_hexagram(
                    &fu_shang,
                    &fu_xia,
                    dong,
                    &fu_relation,
                    &Fortune::from_relations(&fu_relation, None),
                ),
                tiyong_interpretation: BoundedVec::try_from(tiyong_interp.as_bytes().to_vec())
                    .unwrap_or_default(),
            }
        }

        /// 获取解卦数据（公共查询 API）
        ///
        /// 根据卦象 ID 获取核心解卦数据
        ///
        /// # 参数
        /// - `hexagram_id`: 卦象 ID
        ///
        /// # 返回
        /// - 解卦核心数据（包含体用分析、应期推算等）
        pub fn get_interpretation_data(hexagram_id: u64) -> Option<crate::interpretation::InterpretationData> {
            Interpretations::<T>::get(hexagram_id)
        }

        /// 获取 AI 解读结果（公共查询 API）
        ///
        /// 根据卦象 ID 获取 AI 解读结果
        ///
        /// # 参数
        /// - `hexagram_id`: 卦象 ID
        ///
        /// # 返回
        /// - AI 解读结果（包含摘要、评分等）
        pub fn get_ai_interpretation(hexagram_id: u64) -> Option<crate::interpretation::AiInterpretationResult> {
            AiInterpretations::<T>::get(hexagram_id)
        }
    }
}
