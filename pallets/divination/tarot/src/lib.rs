//! # 塔罗牌排盘 Pallet
//!
//! 本模块实现了区块链上的塔罗牌占卜系统，提供：
//! - 随机抽牌（使用链上随机数）
//! - 时间起卦（基于时间戳生成）
//! - 数字起卦（基于用户数字生成）
//! - 手动指定（直接指定牌面）
//! - 带切牌的随机抽牌（模拟真实塔罗仪式）
//! - 多种牌阵支持（单张、三牌、凯尔特十字等）
//! - 占卜记录存储与查询
//! - AI 解读请求（链下工作机触发）
//!
//! ## 核心概念
//!
//! - **大阿卡纳**: 22张主牌，代表人生重大主题
//! - **小阿卡纳**: 56张副牌，分四种花色（权杖、圣杯、宝剑、星币）
//! - **正逆位**: 牌的朝向影响解读
//! - **牌阵**: 不同的摆牌方式，适用于不同问题
//! - **切牌**: 模拟真实塔罗仪式的切牌过程

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

pub mod algorithm;
pub mod constants;
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

        /// 每次占卜最大牌数（对应最复杂的牌阵）
        #[pallet::constant]
        type MaxCardsPerReading: Get<u32>;

        /// 每个用户最多存储的占卜记录数量
        #[pallet::constant]
        type MaxUserReadings: Get<u32>;

        /// 公开占卜列表的最大长度
        #[pallet::constant]
        type MaxPublicReadings: Get<u32>;

        /// 每日免费占卜次数
        #[pallet::constant]
        type DailyFreeDivinations: Get<u32>;

        /// 每日最大占卜次数（防刷）
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

    // ==================== 存储项 ====================

    /// 下一个占卜记录 ID
    #[pallet::storage]
    #[pallet::getter(fn next_reading_id)]
    pub type NextReadingId<T> = StorageValue<_, u64, ValueQuery>;

    /// 占卜记录存储
    ///
    /// 键：占卜记录 ID
    /// 值：完整的塔罗牌占卜结果
    #[pallet::storage]
    #[pallet::getter(fn readings)]
    pub type Readings<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        TarotReading<T::AccountId, BlockNumberFor<T>, T::MaxCardsPerReading>,
    >;

    /// 用户占卜索引
    ///
    /// 键：用户账户
    /// 值：该用户的所有占卜记录 ID 列表
    #[pallet::storage]
    #[pallet::getter(fn user_readings)]
    pub type UserReadings<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u64, T::MaxUserReadings>,
        ValueQuery,
    >;

    /// 公开占卜列表
    ///
    /// 存储所有设置为公开的占卜记录 ID
    #[pallet::storage]
    #[pallet::getter(fn public_readings)]
    pub type PublicReadings<T: Config> =
        StorageValue<_, BoundedVec<u64, T::MaxPublicReadings>, ValueQuery>;

    /// 每日占卜计数
    ///
    /// 用于限制每日占卜次数，防止滥用
    /// 键1：用户账户
    /// 键2：天数（从创世块起算）
    /// 值：当日占卜次数
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

    /// 用户统计信息
    ///
    /// 记录用户的占卜统计数据
    #[pallet::storage]
    #[pallet::getter(fn user_stats)]
    pub type UserStats<T: Config> =
        StorageMap<_, Blake2_128Concat, T::AccountId, DivinationStats, ValueQuery>;

    /// 用户各牌出现频率
    ///
    /// 记录每个用户抽到每张牌的次数，用于统计最常出现的牌
    /// 键1：用户账户
    /// 键2：牌ID (0-77)
    /// 值：出现次数
    #[pallet::storage]
    #[pallet::getter(fn user_card_frequency)]
    pub type UserCardFrequency<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Twox64Concat,
        u8,  // card_id
        u32, // count
        ValueQuery,
    >;

    // ==================== 事件 ====================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 新占卜记录创建成功
        /// [占卜ID, 占卜者, 牌阵类型, 起卦方式]
        ReadingCreated {
            reading_id: u64,
            diviner: T::AccountId,
            spread_type: SpreadType,
            method: DivinationMethod,
        },

        /// AI 解读请求已提交
        /// [占卜ID, 请求者]
        AiInterpretationRequested {
            reading_id: u64,
            requester: T::AccountId,
        },

        /// AI 解读结果已提交
        /// [占卜ID, IPFS CID]
        AiInterpretationSubmitted {
            reading_id: u64,
            cid: BoundedVec<u8, ConstU32<64>>,
        },

        /// 占卜公开状态已更改
        /// [占卜ID, 是否公开]
        ReadingVisibilityChanged {
            reading_id: u64,
            is_public: bool,
        },
    }

    // ==================== 错误 ====================

    #[pallet::error]
    pub enum Error<T> {
        /// 占卜记录不存在
        ReadingNotFound,
        /// 非占卜记录所有者
        NotOwner,
        /// 每日占卜次数超限
        DailyLimitExceeded,
        /// 用户占卜列表已满
        UserReadingsFull,
        /// 公开占卜列表已满
        PublicReadingsFull,
        /// 无效的牌阵类型
        InvalidSpreadType,
        /// 抽牌数量与牌阵不匹配
        CardCountMismatch,
        /// 无效的牌ID（超出0-77范围）
        InvalidCardId,
        /// 存在重复的牌
        DuplicateCards,
        /// AI 解读费用不足
        InsufficientFee,
        /// AI 解读请求已存在
        AiRequestAlreadyExists,
        /// AI 解读请求不存在
        AiRequestNotFound,
        /// 数字参数缺失
        MissingNumberParams,
        /// 手动指定参数缺失
        MissingManualParams,
    }

    // ==================== 可调用函数 ====================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 随机抽牌占卜
        ///
        /// 使用链上随机数生成塔罗牌占卜结果。
        ///
        /// # 参数
        /// - `origin`: 调用者（签名账户）
        /// - `spread_type`: 牌阵类型
        /// - `question_hash`: 占卜问题的哈希值（隐私保护）
        /// - `is_public`: 是否公开此占卜
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_random(
            origin: OriginFor<T>,
            spread_type: SpreadType,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 使用链上随机源
            let random_seed = T::Randomness::random(&b"tarot"[..]).0;
            let random_bytes: [u8; 32] = random_seed
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            // 抽取牌
            let card_count = spread_type.card_count();
            let drawn = algorithm::draw_cards_random(&random_bytes, card_count);

            Self::create_reading(
                who,
                spread_type,
                DivinationMethod::Random,
                drawn,
                question_hash,
                is_public,
            )
        }

        /// 时间起卦占卜
        ///
        /// 使用当前区块时间戳生成占卜结果。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `spread_type`: 牌阵类型
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_time(
            origin: OriginFor<T>,
            spread_type: SpreadType,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 获取时间戳和区块哈希
            let timestamp = Self::get_timestamp_secs();
            let block_hash = <frame_system::Pallet<T>>::parent_hash();
            let block_hash_bytes: [u8; 32] = block_hash
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            // 获取区块号作为额外熵源
            let block_number: u64 = <frame_system::Pallet<T>>::block_number()
                .try_into()
                .unwrap_or(0);

            // 抽取牌（使用增强版时间起卦）
            let card_count = spread_type.card_count();
            let drawn =
                algorithm::draw_cards_by_time(timestamp, &block_hash_bytes, block_number, card_count);

            Self::create_reading(
                who,
                spread_type,
                DivinationMethod::ByTime,
                drawn,
                question_hash,
                is_public,
            )
        }

        /// 数字起卦占卜
        ///
        /// 使用用户提供的数字生成占卜结果。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `numbers`: 用户提供的数字列表
        /// - `spread_type`: 牌阵类型
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_by_numbers(
            origin: OriginFor<T>,
            numbers: BoundedVec<u16, ConstU32<16>>,
            spread_type: SpreadType,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            ensure!(!numbers.is_empty(), Error::<T>::MissingNumberParams);

            // 获取区块哈希
            let block_hash = <frame_system::Pallet<T>>::parent_hash();
            let block_hash_bytes: [u8; 32] = block_hash
                .as_ref()
                .try_into()
                .unwrap_or([0u8; 32]);

            // 抽取牌
            let card_count = spread_type.card_count();
            let drawn = algorithm::draw_cards_by_numbers(&numbers, &block_hash_bytes, card_count);

            Self::create_reading(
                who,
                spread_type,
                DivinationMethod::ByNumbers,
                drawn,
                question_hash,
                is_public,
            )
        }

        /// 手动指定牌面占卜
        ///
        /// 直接指定牌面和正逆位，用于记录已知的占卜结果。
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `cards`: 指定的牌列表 (牌ID, 是否逆位)
        /// - `spread_type`: 牌阵类型
        /// - `question_hash`: 问题哈希
        /// - `is_public`: 是否公开
        #[pallet::call_index(3)]
        #[pallet::weight(Weight::from_parts(50_000_000, 0))]
        pub fn divine_manual(
            origin: OriginFor<T>,
            cards: BoundedVec<(u8, bool), ConstU32<12>>,
            spread_type: SpreadType,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            ensure!(!cards.is_empty(), Error::<T>::MissingManualParams);

            // 验证牌数与牌阵匹配
            ensure!(
                cards.len() == spread_type.card_count() as usize,
                Error::<T>::CardCountMismatch
            );

            // 验证牌的有效性
            let card_ids: Vec<u8> = cards.iter().map(|(id, _)| *id).collect();
            ensure!(
                algorithm::validate_drawn_cards(&card_ids),
                Error::<T>::InvalidCardId
            );

            let drawn: Vec<(u8, bool)> = cards.into_iter().collect();

            Self::create_reading(
                who,
                spread_type,
                DivinationMethod::Manual,
                drawn,
                question_hash,
                is_public,
            )
        }

        /// 带切牌的随机占卜
        ///
        /// 模拟真实塔罗牌占卜仪式，包含洗牌-切牌-抽牌的完整流程。
        /// 用户可以指定切牌位置，增加占卜的仪式感和参与感。
        ///
        /// # 参数
        /// - `origin`: 调用者（签名账户）
        /// - `spread_type`: 牌阵类型
        /// - `cut_position`: 切牌位置（1-77），None 表示随机切牌
        /// - `question_hash`: 占卜问题的哈希值
        /// - `is_public`: 是否公开此占卜
        #[pallet::call_index(7)]
        #[pallet::weight(Weight::from_parts(55_000_000, 0))]
        pub fn divine_random_with_cut(
            origin: OriginFor<T>,
            spread_type: SpreadType,
            cut_position: Option<u8>,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::check_daily_limit(&who)?;

            // 使用链上随机源
            let random_seed = T::Randomness::random(&b"tarot_cut"[..]).0;
            let random_bytes: [u8; 32] = random_seed.as_ref().try_into().unwrap_or([0u8; 32]);

            // 使用带切牌的抽牌算法
            let card_count = spread_type.card_count();
            let drawn = algorithm::draw_cards_with_cut(&random_bytes, cut_position, card_count);

            Self::create_reading(
                who,
                spread_type,
                DivinationMethod::RandomWithCut,
                drawn,
                question_hash,
                is_public,
            )
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
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `reading_id`: 占卜记录 ID
        #[pallet::call_index(4)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        #[deprecated(
            since = "0.2.0",
            note = "请使用 pallet_divination_ai::request_interpretation"
        )]
        pub fn request_ai_interpretation(
            origin: OriginFor<T>,
            reading_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // 验证占卜记录存在且为调用者所有
            let reading = Readings::<T>::get(reading_id)
                .ok_or(Error::<T>::ReadingNotFound)?;
            ensure!(reading.diviner == who, Error::<T>::NotOwner);

            // 检查是否已有请求
            ensure!(
                !AiInterpretationRequests::<T>::contains_key(reading_id),
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
            AiInterpretationRequests::<T>::insert(reading_id, who.clone());

            // 发送事件触发链下工作机
            Self::deposit_event(Event::AiInterpretationRequested {
                reading_id,
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
        /// - `reading_id`: 占卜记录 ID
        /// - `interpretation_cid`: 解读内容的 IPFS CID
        #[pallet::call_index(5)]
        #[pallet::weight(Weight::from_parts(30_000_000, 0))]
        #[deprecated(
            since = "0.2.0",
            note = "请使用 pallet_divination_ai::submit_result"
        )]
        pub fn submit_ai_interpretation(
            origin: OriginFor<T>,
            reading_id: u64,
            interpretation_cid: BoundedVec<u8, ConstU32<64>>,
        ) -> DispatchResult {
            // 验证 AI 预言机权限
            T::AiOracleOrigin::ensure_origin(origin)?;

            // 验证请求存在
            ensure!(
                AiInterpretationRequests::<T>::contains_key(reading_id),
                Error::<T>::AiRequestNotFound
            );

            // 更新占卜记录的 AI 解读 CID
            Readings::<T>::try_mutate(reading_id, |maybe_reading| {
                let reading = maybe_reading
                    .as_mut()
                    .ok_or(Error::<T>::ReadingNotFound)?;
                reading.interpretation_cid = Some(interpretation_cid.clone());
                Ok::<_, DispatchError>(())
            })?;

            // 移除请求
            AiInterpretationRequests::<T>::remove(reading_id);

            Self::deposit_event(Event::AiInterpretationSubmitted {
                reading_id,
                cid: interpretation_cid,
            });

            Ok(())
        }

        /// 更改占卜公开状态
        ///
        /// # 参数
        /// - `origin`: 调用者
        /// - `reading_id`: 占卜记录 ID
        /// - `is_public`: 是否公开
        #[pallet::call_index(6)]
        #[pallet::weight(Weight::from_parts(20_000_000, 0))]
        pub fn set_reading_visibility(
            origin: OriginFor<T>,
            reading_id: u64,
            is_public: bool,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            Readings::<T>::try_mutate(reading_id, |maybe_reading| {
                let reading = maybe_reading
                    .as_mut()
                    .ok_or(Error::<T>::ReadingNotFound)?;
                ensure!(reading.diviner == who, Error::<T>::NotOwner);

                let was_public = reading.is_public;
                reading.is_public = is_public;

                // 更新公开占卜列表
                if is_public && !was_public {
                    // 添加到公开列表
                    PublicReadings::<T>::try_mutate(|list| {
                        list.try_push(reading_id)
                            .map_err(|_| Error::<T>::PublicReadingsFull)
                    })?;
                } else if !is_public && was_public {
                    // 从公开列表移除
                    PublicReadings::<T>::mutate(|list| {
                        list.retain(|&id| id != reading_id);
                    });
                }

                Ok::<_, DispatchError>(())
            })?;

            Self::deposit_event(Event::ReadingVisibilityChanged {
                reading_id,
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

        /// 检查每日占卜次数限制
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

        /// 创建占卜记录并存储
        fn create_reading(
            diviner: T::AccountId,
            spread_type: SpreadType,
            method: DivinationMethod,
            drawn: Vec<(u8, bool)>,
            question_hash: [u8; 32],
            is_public: bool,
        ) -> DispatchResult {
            // 获取新的占卜记录 ID
            let reading_id = NextReadingId::<T>::get();
            NextReadingId::<T>::put(reading_id.saturating_add(1));

            // 获取当前区块号和时间戳
            let block_number = <frame_system::Pallet<T>>::block_number();
            let timestamp = Self::get_timestamp_secs();

            // 转换抽牌结果为 DrawnCard
            let mut cards = BoundedVec::<DrawnCard, T::MaxCardsPerReading>::default();
            for (i, (card_id, reversed)) in drawn.iter().enumerate() {
                let drawn_card = DrawnCard::new(*card_id, *reversed, i as u8);
                cards.try_push(drawn_card).map_err(|_| Error::<T>::CardCountMismatch)?;
            }

            // 创建占卜记录
            let reading = TarotReading {
                id: reading_id,
                diviner: diviner.clone(),
                spread_type,
                method: method.clone(),
                cards,
                question_hash,
                block_number,
                timestamp,
                interpretation_cid: None,
                is_public,
            };

            // 存储占卜记录
            Readings::<T>::insert(reading_id, reading);

            // 更新用户占卜索引
            UserReadings::<T>::try_mutate(&diviner, |list| {
                list.try_push(reading_id)
                    .map_err(|_| Error::<T>::UserReadingsFull)
            })?;

            // 如果公开，添加到公开列表
            if is_public {
                PublicReadings::<T>::try_mutate(|list| {
                    list.try_push(reading_id)
                        .map_err(|_| Error::<T>::PublicReadingsFull)
                })?;
            }

            // 更新用户统计
            Self::update_user_stats(&diviner, &drawn);

            // 发送事件
            Self::deposit_event(Event::ReadingCreated {
                reading_id,
                diviner,
                spread_type,
                method,
            });

            Ok(())
        }

        /// 更新用户统计信息（完整实现）
        ///
        /// 统计包括：
        /// - 总占卜次数
        /// - 大阿卡纳出现次数
        /// - 逆位出现次数
        /// - 最常出现的牌及其次数
        fn update_user_stats(who: &T::AccountId, drawn: &[(u8, bool)]) {
            // 先更新每张牌的频率，同时跟踪最大频率
            let mut max_card_id: u8 = 0;
            let mut max_count: u32 = 0;

            for (card_id, _) in drawn {
                if *card_id < 78 {
                    // 更新该牌的频率
                    let new_count = UserCardFrequency::<T>::mutate(who, card_id, |count| {
                        *count = count.saturating_add(1);
                        *count
                    });

                    // 检查是否为新的最高频率
                    if new_count > max_count {
                        max_count = new_count;
                        max_card_id = *card_id;
                    }
                }
            }

            // 更新用户统计
            UserStats::<T>::mutate(who, |stats| {
                stats.total_readings = stats.total_readings.saturating_add(1);

                for (card_id, reversed) in drawn {
                    // 统计大阿卡纳
                    if *card_id < 22 {
                        stats.major_arcana_count = stats.major_arcana_count.saturating_add(1);
                    }

                    // 统计逆位
                    if *reversed {
                        stats.reversed_count = stats.reversed_count.saturating_add(1);
                    }
                }

                // 更新最常出现的牌
                // 如果本次更新后的最大频率超过了历史记录，则更新
                if max_count > stats.most_frequent_count {
                    stats.most_frequent_card = max_card_id;
                    stats.most_frequent_count = max_count;
                } else if max_count == stats.most_frequent_count && max_card_id != stats.most_frequent_card {
                    // 频率相同时，检查当前记录的牌的实际频率
                    let current_max_freq = UserCardFrequency::<T>::get(who, stats.most_frequent_card);
                    if max_count > current_max_freq {
                        stats.most_frequent_card = max_card_id;
                        stats.most_frequent_count = max_count;
                    }
                }
            });
        }
    }
}
