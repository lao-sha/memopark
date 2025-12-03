# 悬赏问答模块实现指南

本文档提供悬赏问答模块的完整实现步骤和代码参考。

## 📦 任务1-2: 基础设施层（已完成✅）

已在 `pallet-divination-common` 中添加：
- `BountyStatus` 枚举
- `BountyAnswerStatus` 枚举
- `Specialty` 枚举
- `DivinationProvider` trait（已存在）

## 📦 任务3-5: Market Pallet 数据结构

### 在 `pallets/divination/market/src/types.rs` 中添加

```rust
use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::{BoundedVec, pallet_prelude::*};
use scale_info::TypeInfo;
use pallet_divination_common::{BountyAnswerStatus, BountyStatus, DivinationType, ProviderTier, Specialty};

/// 奖励分配方案
///
/// 所有比例使用基点表示（1 基点 = 0.01%）
/// 总和必须等于 10000（即 100%）
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, Debug, PartialEq)]
#[scale_info(skip_type_params(T))]
pub struct RewardDistribution {
    /// 第一名奖励比例（基点，6000 = 60%）
    pub first_place: u16,
    /// 第二名奖励比例（基点，1500 = 15%）
    pub second_place: u16,
    /// 第三名奖励比例（基点，500 = 5%）
    pub third_place: u16,
    /// 平台手续费比例（基点，1500 = 15%）
    pub platform_fee: u16,
    /// 参与奖总比例（基点，500 = 5%）
    pub participation_pool: u16,
}

impl Default for RewardDistribution {
    fn default() -> Self {
        Self {
            first_place: 6000,
            second_place: 1500,
            third_place: 500,
            platform_fee: 1500,
            participation_pool: 500,
        }
    }
}

impl RewardDistribution {
    /// 验证分配比例是否合法（总和必须为 10000）
    pub fn is_valid(&self) -> bool {
        let total = self.first_place as u32
            + self.second_place as u32
            + self.third_place as u32
            + self.platform_fee as u32
            + self.participation_pool as u32;
        total == 10000
    }
}

/// 悬赏解读请求
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, Debug)]
#[scale_info(skip_type_params(T))]
pub struct BountyInterpretation<AccountId, Balance, BlockNumber, MaxCidLen: Get<u32>> {
    /// 悬赏 ID
    pub id: u64,
    /// 提问者账户
    pub creator: AccountId,
    /// 占卜类型
    pub divination_type: DivinationType,
    /// 关联的占卜结果 ID（必填）
    pub result_id: u64,
    /// 问题描述 IPFS CID
    pub question_cid: BoundedVec<u8, MaxCidLen>,
    /// 悬赏金额
    pub bounty_amount: Balance,
    /// 截止区块
    pub deadline: BlockNumber,
    /// 最小回答数
    pub min_answers: u8,
    /// 最大回答数
    pub max_answers: u8,
    /// 状态
    pub status: BountyStatus,
    /// 被采纳的答案 ID（第一名）
    pub adopted_answer_id: Option<u64>,
    /// 第二名答案 ID
    pub second_place_id: Option<u64>,
    /// 第三名答案 ID
    pub third_place_id: Option<u64>,
    /// 当前回答数量
    pub answer_count: u32,
    /// 奖励分配方案
    pub reward_distribution: RewardDistribution,
    /// 擅长领域
    pub specialty: Option<Specialty>,
    /// 是否仅限认证提供者
    pub certified_only: bool,
    /// 是否允许社区投票
    pub allow_voting: bool,
    /// 总投票数
    pub total_votes: u32,
    /// 创建时间
    pub created_at: BlockNumber,
}

/// 悬赏解读回答
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, Debug)]
#[scale_info(skip_type_params(T))]
pub struct BountyAnswer<AccountId, Balance, BlockNumber, MaxCidLen: Get<u32>> {
    /// 回答 ID
    pub id: u64,
    /// 所属悬赏 ID
    pub bounty_id: u64,
    /// 回答者账户
    pub answerer: AccountId,
    /// 回答内容 IPFS CID
    pub answer_cid: BoundedVec<u8, MaxCidLen>,
    /// 状态
    pub status: BountyAnswerStatus,
    /// 获得票数
    pub votes: u32,
    /// 获得奖励金额
    pub reward_amount: Balance,
    /// 提交时间
    pub submitted_at: BlockNumber,
    /// 是否为认证提供者
    pub is_certified: bool,
    /// 回答者的提供者等级
    pub provider_tier: Option<ProviderTier>,
}

/// 投票记录
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, Debug)]
pub struct BountyVote<BlockNumber> {
    /// 投票者
    pub voter: (),  // 在 DoubleMap 中作为 key
    /// 投票的答案 ID
    pub answer_id: u64,
    /// 投票时间
    pub voted_at: BlockNumber,
}

/// 悬赏统计
#[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, Debug, Default)]
pub struct BountyStats<Balance> {
    /// 总悬赏数量
    pub total_bounties: u64,
    /// 总解读数量
    pub total_interpretations: u64,
    /// 总悬赏金额
    pub total_bounty_amount: Balance,
    /// 已结算金额
    pub total_settled_amount: Balance,
    /// 平台总手续费
    pub total_platform_fee: Balance,
}
```

### 在 `pallets/divination/market/src/lib.rs` 中添加存储和配置

```rust
use pallet_divination_common::{BountyAnswerStatus, BountyStatus, DivinationType, Specialty};

#[pallet::config]
pub trait Config: frame_system::Config + pallet_timestamp::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;
    type DivinationProvider: DivinationProvider<Self::AccountId>;

    // 悬赏相关配置
    #[pallet::constant]
    type MinBountyAmount: Get<BalanceOf<Self>>;

    #[pallet::constant]
    type MaxAnswersPerBounty: Get<u32>;

    #[pallet::constant]
    type MaxCidLength: Get<u32>;

    #[pallet::constant]
    type BountyPalletId: Get<PalletId>;

    // ... 其他配置
}

// ================================
// 悬赏解读相关存储
// ================================

/// 下一个悬赏ID
#[pallet::storage]
pub type NextBountyId<T> = StorageValue<_, u64, ValueQuery>;

/// 下一个解读ID
#[pallet::storage]
pub type NextInterpretationId<T> = StorageValue<_, u64, ValueQuery>;

/// 悬赏解读存储
#[pallet::storage]
pub type BountyInterpretations<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // bounty_id
    BountyInterpretationOf<T>,
>;

/// 悬赏解读回答存储
#[pallet::storage]
pub type Interpretations<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // interpretation_id
    BountyAnswerOf<T>,
>;

/// 悬赏的回答列表索引
#[pallet::storage]
pub type BountyInterpretationIds<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,  // bounty_id
    BoundedVec<u64, ConstU32<100>>,
    ValueQuery,
>;

/// 用户创建的悬赏索引
#[pallet::storage]
pub type UserBounties<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<u64, ConstU32<500>>,
    ValueQuery,
>;

/// 用户提交的解读索引
#[pallet::storage]
pub type UserInterpretations<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::AccountId,
    BoundedVec<u64, ConstU32<1000>>,
    ValueQuery,
>;

/// 悬赏投票记录
#[pallet::storage]
pub type BountyVotes<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, u64,  // bounty_id
    Blake2_128Concat, T::AccountId,  // voter
    BountyVoteOf<T>,
>;

/// 悬赏统计
#[pallet::storage]
pub type BountyStatistics<T: Config> = StorageValue<_, BountyStatsOf<T>, ValueQuery>;

/// 占卜结果关联的悬赏列表
#[pallet::storage]
pub type DivinationResultBounties<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat, DivinationType,
    Blake2_128Concat, u64,  // result_id
    BoundedVec<u64, ConstU32<50>>,  // bounty_ids
    ValueQuery,
>;

// Type aliases
pub type BalanceOf<T> =
    <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
pub type BlockNumberFor<T> = <T as frame_system::Config>::BlockNumber;
pub type BountyInterpretationOf<T> = BountyInterpretation<
    <T as frame_system::Config>::AccountId,
    BalanceOf<T>,
    BlockNumberFor<T>,
    <T as Config>::MaxCidLength,
>;
pub type BountyAnswerOf<T> = BountyAnswer<
    <T as frame_system::Config>::AccountId,
    BalanceOf<T>,
    BlockNumberFor<T>,
    <T as Config>::MaxCidLength,
>;
pub type BountyVoteOf<T> = BountyVote<BlockNumberFor<T>>;
pub type BountyStatsOf<T> = BountyStats<BalanceOf<T>>;
```

## 📦 任务6: 实现 create_bounty_interpretation

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// 创建悬赏解读请求
    ///
    /// # 参数
    /// - `divination_type`: 占卜类型
    /// - `result_id`: 占卜结果ID（必须已存在）
    /// - `question_cid`: 问题描述的 IPFS CID
    /// - `bounty_amount`: 悬赏金额
    /// - `deadline`: 截止区块
    /// - `min_answers`: 最小回答数
    /// - `max_answers`: 最大回答数
    /// - `specialty`: 擅长领域（可选）
    /// - `certified_only`: 是否仅限认证者
    /// - `allow_voting`: 是否允许社区投票
    #[pallet::call_index(100)]
    #[pallet::weight(Weight::from_parts(10_000_000, 0))]
    pub fn create_bounty_interpretation(
        origin: OriginFor<T>,
        divination_type: DivinationType,
        result_id: u64,
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
        let current_block = <frame_system::Pallet<T>>::block_number();

        // 1. 验证占卜结果存在
        ensure!(
            T::DivinationProvider::result_exists(divination_type, result_id),
            Error::<T>::DivinationResultNotFound
        );

        // 2. 验证调用者是占卜结果的创建者
        let creator = T::DivinationProvider::result_creator(divination_type, result_id)
            .ok_or(Error::<T>::DivinationResultNotFound)?;
        ensure!(creator == who, Error::<T>::NotResultCreator);

        // 3. 验证悬赏金额
        ensure!(
            bounty_amount >= T::MinBountyAmount::get(),
            Error::<T>::BountyAmountTooLow
        );

        // 4. 验证截止时间
        ensure!(deadline > current_block, Error::<T>::InvalidBountyDeadline);

        // 5. 验证回答数设置
        ensure!(min_answers > 0, Error::<T>::InvalidAnswerCount);
        ensure!(
            max_answers <= T::MaxAnswersPerBounty::get() as u8,
            Error::<T>::InvalidAnswerCount
        );
        ensure!(min_answers <= max_answers, Error::<T>::InvalidAnswerCount);

        // 6. 验证 CID 长度
        let bounded_cid: BoundedVec<u8, T::MaxCidLength> = question_cid
            .try_into()
            .map_err(|_| Error::<T>::CidTooLong)?;

        // 7. 转账悬赏金到托管账户
        let escrow_account = Self::bounty_escrow_account();
        T::Currency::transfer(
            &who,
            &escrow_account,
            bounty_amount,
            ExistenceRequirement::KeepAlive,
        )?;

        // 8. 创建悬赏记录
        let bounty_id = NextBountyId::<T>::get();
        let bounty = BountyInterpretationOf::<T> {
            id: bounty_id,
            creator: who.clone(),
            divination_type,
            result_id,
            question_cid: bounded_cid,
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
            specialty,
            certified_only,
            allow_voting,
            total_votes: 0,
            created_at: current_block,
        };

        BountyInterpretations::<T>::insert(bounty_id, bounty);
        NextBountyId::<T>::put(bounty_id.saturating_add(1));

        // 9. 更新用户悬赏索引
        UserBounties::<T>::try_mutate(&who, |bounties| {
            bounties.try_push(bounty_id).map_err(|_| Error::<T>::TooManyBounties)
        })?;

        // 10. 更新占卜结果索引
        DivinationResultBounties::<T>::try_mutate(
            divination_type,
            result_id,
            |bounties| {
                bounties.try_push(bounty_id).map_err(|_| Error::<T>::TooManyBounties)
            },
        )?;

        // 11. 更新统计
        BountyStatistics::<T>::mutate(|stats| {
            stats.total_bounties = stats.total_bounties.saturating_add(1);
            stats.total_bounty_amount = stats.total_bounty_amount.saturating_add(bounty_amount);
        });

        // 12. 触发事件
        Self::deposit_event(Event::BountyCreated {
            bounty_id,
            creator: who,
            divination_type,
            result_id,
            bounty_amount,
            deadline,
        });

        Ok(())
    }
}

// Helper functions
impl<T: Config> Pallet<T> {
    /// 获取托管账户ID
    pub fn bounty_escrow_account() -> T::AccountId {
        T::BountyPalletId::get().into_account_truncating()
    }
}
```

## 📦 任务7: 实现 submit_interpretation

```rust
/// 提交悬赏解读
#[pallet::call_index(101)]
#[pallet::weight(Weight::from_parts(10_000_000, 0))]
pub fn submit_interpretation(
    origin: OriginFor<T>,
    bounty_id: u64,
    answer_cid: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let current_block = <frame_system::Pallet<T>>::block_number();

    // 1. 验证悬赏存在
    let mut bounty = BountyInterpretations::<T>::get(bounty_id)
        .ok_or(Error::<T>::BountyNotFound)?;

    // 2. 验证悬赏状态为 Open
    ensure!(
        bounty.status == BountyStatus::Open,
        Error::<T>::BountyNotOpen
    );

    // 3. 验证未超过截止时间
    ensure!(
        current_block <= bounty.deadline,
        Error::<T>::BountyDeadlinePassed
    );

    // 4. 验证不是自己的悬赏
    ensure!(bounty.creator != who, Error::<T>::CannotAnswerOwnBounty);

    // 5. 验证回答数未达上限
    ensure!(
        bounty.answer_count < bounty.max_answers as u32,
        Error::<T>::BountyAnswerLimitReached
    );

    // 6. 验证未重复回答
    let user_interpretations = UserInterpretations::<T>::get(&who);
    let bounty_answers = BountyInterpretationIds::<T>::get(bounty_id);

    // 检查用户是否已经回答过这个悬赏
    for answer_id in bounty_answers.iter() {
        if let Some(answer) = Interpretations::<T>::get(answer_id) {
            ensure!(answer.answerer != who, Error::<T>::AlreadyAnswered);
        }
    }

    // 7. 验证认证要求
    if bounty.certified_only {
        // 这里需要检查提供者认证状态
        // 假设我们有一个 Providers 存储
        // let provider = Providers::<T>::get(&who).ok_or(Error::<T>::NotProvider)?;
        // ensure!(provider.is_certified, Error::<T>::CertifiedProviderOnly);

        // 临时实现：允许所有人
    }

    // 8. 验证 CID 长度
    let bounded_cid: BoundedVec<u8, T::MaxCidLength> = answer_cid
        .try_into()
        .map_err(|_| Error::<T>::CidTooLong)?;

    // 9. 创建回答记录
    let interpretation_id = NextInterpretationId::<T>::get();
    let interpretation = BountyAnswerOf::<T> {
        id: interpretation_id,
        bounty_id,
        answerer: who.clone(),
        answer_cid: bounded_cid,
        status: BountyAnswerStatus::Pending,
        votes: 0,
        reward_amount: BalanceOf::<T>::zero(),
        submitted_at: current_block,
        is_certified: false,  // TODO: 从 Provider 状态获取
        provider_tier: None,  // TODO: 从 Provider 状态获取
    };

    Interpretations::<T>::insert(interpretation_id, interpretation);
    NextInterpretationId::<T>::put(interpretation_id.saturating_add(1));

    // 10. 更新悬赏回答数
    bounty.answer_count = bounty.answer_count.saturating_add(1);
    BountyInterpretations::<T>::insert(bounty_id, bounty);

    // 11. 更新索引
    BountyInterpretationIds::<T>::try_mutate(bounty_id, |answers| {
        answers.try_push(interpretation_id).map_err(|_| Error::<T>::TooManyAnswers)
    })?;

    UserInterpretations::<T>::try_mutate(&who, |interpretations| {
        interpretations.try_push(interpretation_id).map_err(|_| Error::<T>::TooManyInterpretations)
    })?;

    // 12. 更新统计
    BountyStatistics::<T>::mutate(|stats| {
        stats.total_interpretations = stats.total_interpretations.saturating_add(1);
    });

    // 13. 触发事件
    Self::deposit_event(Event::InterpretationSubmitted {
        interpretation_id,
        bounty_id,
        answerer: who,
    });

    Ok(())
}
```

## 📦 任务8-10: 投票、采纳、结算功能

由于篇幅限制，这里提供核心逻辑的伪代码：

### 投票功能
```rust
pub fn vote_interpretation(origin, bounty_id, interpretation_id) {
    // 1. 验证悬赏允许投票
    // 2. 验证未重复投票
    // 3. 记录投票
    // 4. 更新答案票数
}
```

### 采纳功能
```rust
pub fn adopt_interpretations(
    origin,
    bounty_id,
    first_place,
    second_place,
    third_place
) {
    // 1. 验证是悬赏创建者
    // 2. 验证状态为 Open 或 Closed
    // 3. 验证答案存在
    // 4. 更新悬赏状态为 Adopted
    // 5. 更新答案状态
}
```

### 结算功能
```rust
pub fn settle_bounty(origin, bounty_id) {
    // 1. 验证状态为 Adopted
    // 2. 计算各名次奖励
    // 3. 从托管账户转账给各获奖者
    // 4. 更新状态为 Settled
}
```

## 📦 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    BountyCreated {
        bounty_id: u64,
        creator: T::AccountId,
        divination_type: DivinationType,
        result_id: u64,
        bounty_amount: BalanceOf<T>,
        deadline: BlockNumberFor<T>,
    },
    InterpretationSubmitted {
        interpretation_id: u64,
        bounty_id: u64,
        answerer: T::AccountId,
    },
    BountyClosed {
        bounty_id: u64,
    },
    InterpretationVoted {
        bounty_id: u64,
        interpretation_id: u64,
        voter: T::AccountId,
    },
    InterpretationsAdopted {
        bounty_id: u64,
        first_place: u64,
        second_place: Option<u64>,
        third_place: Option<u64>,
    },
    BountySettled {
        bounty_id: u64,
        total_distributed: BalanceOf<T>,
        platform_fee: BalanceOf<T>,
        participant_count: u32,
    },
    BountyRewardPaid {
        bounty_id: u64,
        recipient: T::AccountId,
        amount: BalanceOf<T>,
        rank: u8,
    },
    BountyCancelled {
        bounty_id: u64,
        refund_amount: BalanceOf<T>,
    },
    BountyExpired {
        bounty_id: u64,
        refund_amount: BalanceOf<T>,
    },
}
```

## 📦 错误定义

```rust
#[pallet::error]
pub enum Error<T> {
    // 占卜结果相关
    DivinationResultNotFound,
    NotResultCreator,

    // 悬赏相关
    BountyNotFound,
    BountyNotOpen,
    BountyAlreadyClosed,
    BountyAmountTooLow,
    BountyDeadlinePassed,
    InvalidBountyDeadline,
    InvalidAnswerCount,
    TooManyBounties,

    // 解读相关
    InterpretationNotFound,
    CannotAnswerOwnBounty,
    AlreadyAnswered,
    BountyAnswerLimitReached,
    TooManyAnswers,
    TooManyInterpretations,
    CertifiedProviderOnly,

    // 投票相关
    AlreadyVoted,

    // 其他
    CidTooLong,
}
```

## 📦 Runtime 配置示例

```rust
// runtime/src/configs/divination.rs

use pallet_divination_common::{DivinationProvider, DivinationType, RarityInput};

pub struct StardustDivinationProvider;

impl DivinationProvider<AccountId> for StardustDivinationProvider {
    fn result_exists(divination_type: DivinationType, result_id: u64) -> bool {
        match divination_type {
            DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::contains_key(result_id)
            },
            DivinationType::Bazi => {
                // TODO: 需要重构 bazi 存储结构
                false
            },
            _ => false,
        }
    }

    fn result_creator(divination_type: DivinationType, result_id: u64) -> Option<AccountId> {
        match divination_type {
            DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::get(result_id)
                    .map(|h| h.ben_gua.diviner)
            },
            _ => None,
        }
    }

    fn rarity_data(divination_type: DivinationType, result_id: u64) -> Option<RarityInput> {
        match divination_type {
            DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::get(result_id).map(|h| {
                    let is_pure = h.ben_gua.shang_gua == h.ben_gua.xia_gua;
                    RarityInput {
                        primary_score: if is_pure { 80 } else { 30 },
                        secondary_score: 10,
                        is_special_date: false,
                        is_special_combination: is_pure,
                        custom_factors: [0, 0, 0, 0],
                    }
                })
            },
            _ => None,
        }
    }

    fn result_summary(_: DivinationType, _: u64) -> Option<Vec<u8>> {
        None
    }

    fn is_nftable(_: DivinationType, _: u64) -> bool {
        true
    }

    fn mark_as_nfted(_: DivinationType, _: u64) {}
}

// Runtime Config
impl pallet_divination_market::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type DivinationProvider = StardustDivinationProvider;
    type MinBountyAmount = ConstU128<{ 100 * DUST }>;
    type MaxAnswersPerBounty = ConstU32<100>;
    type MaxCidLength = ConstU32<256>;
    type BountyPalletId = BountyPalletId;
    // ... 其他配置
}

parameter_types! {
    pub const BountyPalletId: PalletId = PalletId(*b"py/bount");
}
```

## 📦 测试示例

```rust
#[test]
fn test_create_bounty_with_valid_result() {
    new_test_ext().execute_with(|| {
        // 1. 创建梅花易数卦象
        assert_ok!(Meihua::create_hexagram(
            RuntimeOrigin::signed(ALICE),
            // ... 参数
        ));

        // 2. 基于卦象创建悬赏
        assert_ok!(DivinationMarket::create_bounty_interpretation(
            RuntimeOrigin::signed(ALICE),
            DivinationType::Meihua,
            1,  // hexagram_id
            b"Qm...".to_vec(),
            500 * DUST,
            100,  // deadline
            3, 20,  // min/max answers
            None, false, true,
        ));

        // 3. 验证悬赏创建成功
        let bounty = BountyInterpretations::<Test>::get(1).unwrap();
        assert_eq!(bounty.result_id, 1);
        assert_eq!(bounty.divination_type, DivinationType::Meihua);
    });
}
```

## 🎯 后续步骤

1. **复制此文档中的代码到对应文件**
2. **完成剩余的 extrinsics 实现**（vote, adopt, settle）
3. **编译修复错误**
4. **编写完整的测试用例**
5. **前端开发**
6. **Subsquid 索引层开发**

---

**完整代码仓库**: 建议创建功能分支进行开发
**预计工作量**: 3-4周全职开发
