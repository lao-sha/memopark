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

pub use pallet::*;

pub mod algorithm;
pub mod constants;
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
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

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
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_numbers(
            origin: OriginFor<T>,
            num1: u16,
            num2: u16,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

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
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_random(
            origin: OriginFor<T>,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

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
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            shang_gua_num: u8,
            xia_gua_num: u8,
            dong_yao: u8,
            question_hash: [u8; 32],
            is_public: bool,
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

            Self::create_hexagram(
                who,
                shang_gua_num,
                xia_gua_num,
                dong_yao,
                DivinationMethod::Manual,
                question_hash,
                is_public,
            )
        }

        /// 请求 AI 解卦
        ///
        /// 为指定卦象请求 AI 解读服务，需支付费用。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `hexagram_id`: 卦象 ID
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
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

        /// 提交 AI 解读结果（仅限授权节点）
        ///
        /// AI 预言机节点提交解读结果的 IPFS CID。
        ///
        /// # 参数
        /// - `origin`: AI 预言机授权来源
        /// - `hexagram_id`: 卦象 ID
        /// - `interpretation_cid`: 解读内容的 IPFS CID
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
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

        /// 创建完整卦象并存储
        fn create_hexagram(
            diviner: T::AccountId,
            shang_gua_num: u8,
            xia_gua_num: u8,
            dong_yao: u8,
            method: DivinationMethod,
            question_hash: [u8; 32],
            is_public: bool,
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
            Hexagrams::<T>::insert(hexagram_id, full_divination);

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
    }
}
