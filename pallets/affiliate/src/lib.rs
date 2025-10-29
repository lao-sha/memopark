#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

//! # 统一联盟计酬系统 (pallet-affiliate)
//!
//! ## 功能概述
//!
//! 本模块整合了原有的5个联盟计酬相关pallet，提供统一的联盟计酬解决方案：
//! - **推荐关系管理**：推荐人绑定、推荐码管理、推荐链查询
//! - **资金托管**：独立托管账户、资金存取
//! - **即时分成**：实时转账、立即到账
//! - **周结算**：记账分配、周期结算
//! - **配置管理**：模式切换、分成比例配置
//!
//! ## 架构设计
//!
//! ```text
//! ┌──────────────────────────────────────────────────────────┐
//! │                   pallet-affiliate                       │
//! │                  （统一联盟计酬系统）                      │
//! ├──────────────────────────────────────────────────────────┤
//! │  📦 推荐关系管理  →  referral.rs                          │
//! │  ⚙️ 配置管理      →  types.rs (SettlementMode等)         │
//! │  💰 资金托管      →  escrow.rs                            │
//! │  ⚡ 即时分成      →  instant.rs                           │
//! │  📅 周结算        →  weekly.rs                            │
//! │  📊 统一分配入口  →  distribute.rs                        │
//! └──────────────────────────────────────────────────────────┘
//! ```
//!
//! ## 整合自
//!
//! - `pallet-affiliate`: 资金托管
//! - `pallet-affiliate-config`: 配置管理
//! - `pallet-affiliate-instant`: 即时分成
//! - `pallet-affiliate-weekly`: 周结算
//! - `pallet-memo-referrals`: 推荐关系
//!
//! **版本**: 1.0.0  
//! **整合日期**: 2025-10-28

pub use pallet::*;

pub mod types;
mod referral;
mod escrow;
mod instant;
mod weekly;
mod distribute;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

use frame_support::{pallet_prelude::*, PalletId, BoundedVec};
use frame_system::pallet_prelude::*;
use sp_runtime::traits::Zero;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::traits::{Currency, Get};

    /// 余额类型
    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 货币系统
        type Currency: Currency<Self::AccountId>;

        /// 托管 PalletId（派生独立的托管账户）
        #[pallet::constant]
        type EscrowPalletId: Get<PalletId>;

        /// 提款权限控制（可选）
        type WithdrawOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 管理员权限（配置管理）
        type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 会员信息提供者
        type MembershipProvider: MembershipProvider<Self::AccountId>;

        /// 推荐码最大长度
        #[pallet::constant]
        type MaxCodeLen: Get<u32>;

        /// 推荐链最大搜索深度（防止无限循环）
        #[pallet::constant]
        type MaxSearchHops: Get<u32>;

        /// 销毁账户
        type BurnAccount: Get<Self::AccountId>;

        /// 国库账户
        type TreasuryAccount: Get<Self::AccountId>;

        /// 存储费用账户
        type StorageAccount: Get<Self::AccountId>;
    }

    // ========================================
    // 存储项
    // ========================================

    // === 推荐关系存储（3个）===

    /// 推荐人映射：账户 → 推荐人
    #[pallet::storage]
    pub type Sponsors<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, T::AccountId>;

    /// 推荐码映射：推荐码 → 账户
    #[pallet::storage]
    pub type AccountByCode<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BoundedVec<u8, T::MaxCodeLen>,
        T::AccountId,
    >;

    /// 账户推荐码：账户 → 推荐码
    #[pallet::storage]
    pub type CodeByAccount<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<u8, T::MaxCodeLen>,
    >;

    // === 配置存储（4个）===

    /// 结算模式：Weekly / Instant / Hybrid
    #[pallet::storage]
    #[pallet::getter(fn settlement_mode)]
    pub type SettlementMode<T: Config> = 
        StorageValue<_, types::SettlementMode, ValueQuery>;

    /// 即时分成比例（15层）
    #[pallet::storage]
    #[pallet::getter(fn instant_percents)]
    pub type InstantLevelPercents<T: Config> = 
        StorageValue<_, types::LevelPercents, ValueQuery, DefaultInstantPercents>;

    /// 周结算分成比例（15层）
    #[pallet::storage]
    #[pallet::getter(fn weekly_percents)]
    pub type WeeklyLevelPercents<T: Config> = 
        StorageValue<_, types::LevelPercents, ValueQuery, DefaultWeeklyPercents>;

    /// 每周区块数
    #[pallet::storage]
    #[pallet::getter(fn blocks_per_week)]
    pub type BlocksPerWeek<T: Config> = 
        StorageValue<_, BlockNumberFor<T>, ValueQuery, DefaultBlocksPerWeek<T>>;

    // === 托管存储（2个）===

    /// 累计存入金额
    #[pallet::storage]
    pub type TotalDeposited<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    /// 累计提取金额
    #[pallet::storage]
    pub type TotalWithdrawn<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    // === 即时分成存储（1个）===

    /// 累计即时分配金额
    #[pallet::storage]
    pub type TotalInstantDistributed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    // === 周结算存储（6个）===

    /// 应得金额：(周编号, 账户) → 金额
    #[pallet::storage]
    pub type Entitlement<T: Config> = StorageDoubleMap<
        _,
        Twox64Concat,
        u32,  // cycle
        Blake2_128Concat,
        T::AccountId,
        BalanceOf<T>,
        ValueQuery,
    >;

    /// 活跃期：账户 → 活跃截止周
    #[pallet::storage]
    pub type ActiveUntilWeek<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u32,  // week_number
        ValueQuery,
    >;

    /// 直推活跃数：账户 → 活跃直推数量
    #[pallet::storage]
    pub type DirectActiveCount<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        u32,
        ValueQuery,
    >;

    /// 结算游标：周编号 → 当前结算账户索引
    #[pallet::storage]
    pub type SettleCursor<T: Config> = StorageMap<
        _,
        Twox64Concat,
        u32,  // cycle
        u32,  // account_index
        ValueQuery,
    >;

    /// 当前结算周期
    #[pallet::storage]
    pub type CurrentSettlingCycle<T: Config> = StorageValue<_, Option<u32>>;

    /// 累计周结算分配金额
    #[pallet::storage]
    pub type TotalWeeklyDistributed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    // ========================================
    // 默认值
    // ========================================

    /// 默认每周区块数（假设6秒出块，1周≈100800块）
    #[pallet::type_value]
    pub fn DefaultBlocksPerWeek<T: Config>() -> BlockNumberFor<T> {
        100800u32.into()
    }

    /// 默认即时分成比例
    #[pallet::type_value]
    pub fn DefaultInstantPercents() -> types::LevelPercents {
        types::default_instant_percents()
    }

    /// 默认周结算分成比例
    #[pallet::type_value]
    pub fn DefaultWeeklyPercents() -> types::LevelPercents {
        types::default_weekly_percents()
    }

    // ========================================
    // 事件
    // ========================================

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        // === 推荐关系事件 ===
        /// 推荐人已绑定
        SponsorBound {
            who: T::AccountId,
            sponsor: T::AccountId,
        },
        /// 推荐码已认领
        CodeClaimed {
            who: T::AccountId,
            code: BoundedVec<u8, T::MaxCodeLen>,
        },

        // === 配置管理事件 ===
        /// 结算模式已更新
        SettlementModeSet,
        /// 即时分成比例已更新
        InstantPercentsSet,
        /// 周结算分成比例已更新
        WeeklyPercentsSet,
        /// 每周区块数已更新
        BlocksPerWeekSet {
            blocks: BlockNumberFor<T>,
        },

        // === 托管事件 ===
        /// 资金已存入托管
        Deposited {
            from: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 资金已从托管提取
        Withdrawn {
            to: T::AccountId,
            amount: BalanceOf<T>,
        },

        // === 即时分成事件 ===
        /// 即时奖励已分配
        InstantRewardDistributed {
            referrer: T::AccountId,
            buyer: T::AccountId,
            level: u8,
            amount: BalanceOf<T>,
        },

        // === 周结算事件 ===
        /// 周期已结算
        CycleSettled {
            cycle: u32,
            settled_count: u32,
            total_amount: BalanceOf<T>,
        },
    }

    // ========================================
    // 错误
    // ========================================

    #[pallet::error]
    pub enum Error<T> {
        // === 推荐关系错误 ===
        /// 已绑定推荐人
        AlreadyBound,
        /// 推荐码不存在
        CodeNotFound,
        /// 不能绑定自己
        CannotBindSelf,
        /// 会形成循环
        WouldCreateCycle,
        /// 不是有效会员
        NotMember,
        /// 推荐码过长
        CodeTooLong,
        /// 推荐码过短
        CodeTooShort,
        /// 推荐码已被占用
        CodeAlreadyTaken,
        /// 已拥有推荐码
        AlreadyHasCode,

        // === 配置管理错误 ===
        /// 无效的分成比例
        InvalidPercents,
        /// 混合模式层数超限
        HybridLevelsTooMany,

        // === 托管错误 ===
        /// 提款失败
        WithdrawFailed,

        // === 配置错误 ===
        /// 无效的模式ID
        InvalidMode,
    }

    // ========================================
    // 可调用函数
    // ========================================

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        // === 推荐关系接口（2个）===

        /// 函数级中文注释：绑定推荐人
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn bind_sponsor(
            origin: OriginFor<T>,
            sponsor_code: sp_std::vec::Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::do_bind_sponsor(who, sponsor_code)
        }

        /// 函数级中文注释：认领推荐码
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn claim_code(
            origin: OriginFor<T>,
            code: sp_std::vec::Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Self::do_claim_code(who, code)
        }

        // === 配置管理接口（4个）===

        /// 函数级中文注释：设置结算模式
        #[pallet::call_index(10)]
        #[pallet::weight(10_000)]
        pub fn set_settlement_mode(
            origin: OriginFor<T>,
            mode_id: u8,
            instant_levels: u8,
            weekly_levels: u8,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;

            // 构建模式
            let mode = match mode_id {
                0 => types::SettlementMode::Weekly,
                1 => types::SettlementMode::Instant,
                2 => {
                    ensure!(
                        instant_levels.saturating_add(weekly_levels) <= 15,
                        Error::<T>::HybridLevelsTooMany
                    );
                    types::SettlementMode::Hybrid {
                        instant_levels,
                        weekly_levels,
                    }
                }
                _ => return Err(Error::<T>::InvalidMode.into()),
            };

            SettlementMode::<T>::put(mode);

            Self::deposit_event(Event::SettlementModeSet);

            Ok(())
        }

        /// 函数级中文注释：设置即时分成比例
        #[pallet::call_index(11)]
        #[pallet::weight(10_000)]
        pub fn set_instant_percents(
            origin: OriginFor<T>,
            percents: sp_std::vec::Vec<u8>,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;

            // 验证长度
            ensure!(percents.len() == 15, Error::<T>::InvalidPercents);

            let bounded: types::LevelPercents = percents
                .try_into()
                .map_err(|_| Error::<T>::InvalidPercents)?;

            InstantLevelPercents::<T>::put(bounded);

            Self::deposit_event(Event::InstantPercentsSet);

            Ok(())
        }

        /// 函数级中文注释：设置周结算分成比例
        #[pallet::call_index(12)]
        #[pallet::weight(10_000)]
        pub fn set_weekly_percents(
            origin: OriginFor<T>,
            percents: sp_std::vec::Vec<u8>,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;

            // 验证长度
            ensure!(percents.len() == 15, Error::<T>::InvalidPercents);

            let bounded: types::LevelPercents = percents
                .try_into()
                .map_err(|_| Error::<T>::InvalidPercents)?;

            WeeklyLevelPercents::<T>::put(bounded);

            Self::deposit_event(Event::WeeklyPercentsSet);

            Ok(())
        }

        /// 函数级中文注释：设置每周区块数
        #[pallet::call_index(13)]
        #[pallet::weight(10_000)]
        pub fn set_blocks_per_week(
            origin: OriginFor<T>,
            blocks: BlockNumberFor<T>,
        ) -> DispatchResult {
            T::AdminOrigin::ensure_origin(origin)?;

            BlocksPerWeek::<T>::put(blocks);

            Self::deposit_event(Event::BlocksPerWeekSet { blocks });

            Ok(())
        }

        // === 周结算接口（1个）===

        /// 函数级中文注释：结算指定周期
        #[pallet::call_index(30)]
        #[pallet::weight(10_000)]
        pub fn settle_cycle(
            origin: OriginFor<T>,
            cycle: u32,
            max_accounts: u32,
        ) -> DispatchResult {
            ensure_signed(origin)?;  // 任何人都可以调用

            Self::do_settle_cycle(cycle, max_accounts)?;

            Ok(())
        }
    }

    // ========================================
    // 公开方法（供其他 pallet 调用）
    // ========================================
    
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：绑定推荐人（内部方法，供其他 pallet 调用）
        ///
        /// 此方法不验证，不发射事件，仅用于其他 pallet 内部绑定推荐关系。
        pub fn bind_sponsor_internal(who: &T::AccountId, sponsor: &T::AccountId) {
            Sponsors::<T>::insert(who, sponsor);
        }
    }
}

// ===== 🆕 2025-10-29: Trading Pallet 集成 - AffiliateDistributor 实现 =====

/// 函数级详细中文注释：为Trading Pallet实现AffiliateDistributor
/// 
/// 这个实现提供了Trading Pallet所需的联盟奖励分配功能。
/// 根据当前的结算模式（即时/周结算/混合），自动选择分配方式。
impl<T: Config> types::AffiliateDistributor<T::AccountId, u128, BlockNumberFor<T>> 
    for Pallet<T> 
{
    fn distribute_rewards(
        _buyer: &T::AccountId,
        _amount: u128,
        _target: Option<(u8, u64)>,
    ) -> Result<u128, sp_runtime::DispatchError> {
        // TODO: 实现完整的分配逻辑
        // 1. 根据结算模式选择即时或周结算
        // 2. 调用对应的分配函数
        // 3. 返回实际分配的金额
        
        // 当前简化实现：直接返回Ok(0)
        // 后续需要实现完整的分配逻辑
        Ok(0)
    }
}

/// 函数级中文注释：会员信息提供者 Trait
pub trait MembershipProvider<AccountId> {
    /// 检查账户是否为有效会员
    fn is_valid_member(who: &AccountId) -> bool;
}
