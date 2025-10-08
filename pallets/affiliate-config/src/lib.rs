//! # Pallet Affiliate Config（简化版 Phase 1）
//!
//! ## 功能概述
//! 
//! 本 pallet 提供分成系统的配置管理功能，支持动态切换不同的结算模式：
//! - **周结算模式（Weekly）**：基于托管的批量结算，Gas成本低
//! - **即时分成模式（Instant）**：实时转账分成，延迟低
//! - **混合模式（Hybrid）**：前N层即时，后续层周结算
//!
//! ## 架构设计
//!
//! ### Provider Traits（提供者特征）
//! 通过 trait 解耦各个 pallet 之间的依赖：
//! - `WeeklyAffiliateProvider`: 周结算功能提供者
//! - `InstantAffiliateProvider`: 即时分成功能提供者
//! - `MembershipProvider`: 会员信息提供者
//! - `ReferralProvider`: 推荐关系提供者

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

pub mod weights;
pub use weights::WeightInfo;

/// 结算模式枚举
///
/// 定义了系统支持的三种核心结算模式
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[codec(mel_bound())]
pub enum SettlementMode {
    /// 周结算：所有层级使用托管式批量结算
    Weekly,
    /// 即时分成：所有层级实时转账
    Instant,
    /// 混合模式：前N层即时，后续层周结算
    /// 
    /// 参数：
    /// - `instant_levels`: 使用即时分成的层级数（1-15）
    /// - `weekly_levels`: 使用周结算的层级数（0-14）
    /// 
    /// 约束：instant_levels + weekly_levels <= 15
    Hybrid { instant_levels: u8, weekly_levels: u8 },
}

impl Default for SettlementMode {
    fn default() -> Self {
        Self::Instant  // 默认使用即时结算模式
    }
}

impl SettlementMode {
    /// 转换为 ID（用于事件）
    pub fn to_id(&self) -> u8 {
        match self {
            Self::Weekly => 0,
            Self::Instant => 1,
            Self::Hybrid { .. } => 2,
        }
    }

    /// 获取混合模式参数
    pub fn hybrid_params(&self) -> Option<(u8, u8)> {
        match self {
            Self::Hybrid { instant_levels, weekly_levels } => Some((*instant_levels, *weekly_levels)),
            _ => None,
        }
    }
}

/// 模式切换历史记录
///
/// 用于审计和统计分析
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[codec(mel_bound())]
pub struct ModeSwitch<BlockNumber: MaxEncodedLen> {
    /// 切换时的区块号
    pub block: BlockNumber,
    /// 切换前的模式
    pub from_mode: SettlementMode,
    /// 切换后的模式
    pub to_mode: SettlementMode,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use frame_support::{
        pallet_prelude::*,
        traits::Currency,
    };
    use frame_system::pallet_prelude::*;
    use sp_runtime::{
        traits::{Zero, SaturatedConversion},
        Saturating,
    };
    use sp_std::vec::Vec;

    pub type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

    /// 函数级中文注释：周结算功能提供者
    ///
    /// 由 `pallet-affiliate-weekly` 实现
    pub trait WeeklyAffiliateProvider<AccountId, Balance, BlockNumber> {
        /// 函数级中文注释：记账待分配奖励（资金已在托管账户）
        ///
        /// # 参数
        /// - `who`: 购买供奉的用户
        /// - `amount`: 供奉金额
        /// - `target`: 目标对象（domain, subject_id）
        /// - `block_number`: 当前区块号
        /// - `duration_weeks`: 持续周数
        fn escrow_and_record(
            who: &AccountId,
            amount: Balance,
            target: Option<(u8, u64)>,
            block_number: BlockNumber,
            duration_weeks: Option<u32>,
        ) -> DispatchResult;
    }

    /// 函数级中文注释：即时分成功能提供者
    ///
    /// 由 `pallet-affiliate-instant` 实现
    pub trait InstantAffiliateProvider<AccountId, Balance> {
        /// 函数级中文注释：立即分配推荐奖励（从托管账户转账）
        ///
        /// # 参数
        /// - `buyer`: 购买供奉的用户
        /// - `amount`: 供奉金额
        /// - `escrow_account`: 资金来源账户（托管账户）
        fn distribute_instant(
            buyer: &AccountId,
            amount: Balance,
            escrow_account: &AccountId,
        ) -> DispatchResult;
        
        /// 函数级中文注释：纯推荐链分配（100%推荐链，会员专用）
        ///
        /// # 参数
        /// - `buyer`: 购买者账户
        /// - `amount`: 全部金额（u128）
        /// - `escrow_account`: 托管账户（资金来源）
        ///
        /// # 说明
        /// - 不扣除 Burn、Treasury、Storage
        /// - 100% 分配给推荐链（15代）
        /// - 无效层级份额给第1级推荐人
        fn distribute_to_referral_chain_only(
            buyer: &AccountId,
            amount: u128,
            escrow_account: &AccountId,
        ) -> DispatchResult;
    }

    /// 会员信息提供者
    ///
    /// 由 `pallet-membership` 实现
    pub trait MembershipProvider<AccountId> {
        /// 获取会员的推荐层级数
        fn get_referral_levels(who: &AccountId) -> u8;
        
        /// 检查是否为有效会员
        fn is_valid_member(who: &AccountId) -> bool;
    }

    /// 推荐关系提供者
    ///
    /// 由 `pallet-membership` 实现
    pub trait ReferralProvider<AccountId> {
        /// 通过推荐码查找推荐人
        fn get_referrer_by_code(code: &[u8]) -> Option<AccountId>;
    }

    /// 函数级中文注释：联盟计酬分配器 trait
    /// - 供其他业务模块（如会员、祭祀品）调用，触发联盟计酬分配
    /// - 由 `pallet-affiliate-config` 实现
    pub trait AffiliateDistributor<AccountId, Balance, BlockNumber> {
        /// 通用分配（含 Burn/Treasury/Storage）
        /// 适用于祭祀品购买等场景
        fn distribute_rewards(
            buyer: &AccountId,
            amount: Balance,
            target: Option<(u8, u64)>,
            block_number: BlockNumber,
            duration_weeks: Option<u32>,
        ) -> DispatchResult;
        
        /// 函数级中文注释：会员专用分配（100%推荐链）
        /// - 不扣除 Burn、Treasury、Storage
        /// - 100% 分配给推荐链
        /// - 适用于会员购买场景
        fn distribute_membership_rewards(
            buyer: &AccountId,
            amount: Balance,
            block_number: BlockNumber,
        ) -> DispatchResult;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 函数级中文注释：事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 函数级中文注释：货币类型
        type Currency: Currency<Self::AccountId>;

        /// 函数级中文注释：托管账户地址（资金池）
        /// 指向 pallet-affiliate 的托管账户，所有模式的资金都来自这里
        type EscrowAccount: Get<Self::AccountId>;

        /// 函数级中文注释：周结算提供者（pallet-affiliate-weekly）
        type WeeklyProvider: WeeklyAffiliateProvider<Self::AccountId, BalanceOf<Self>, BlockNumberFor<Self>>;

        /// 函数级中文注释：即时分成提供者（pallet-affiliate-instant）
        type InstantProvider: InstantAffiliateProvider<Self::AccountId, BalanceOf<Self>>;

        /// 函数级中文注释：会员信息提供者（pallet-membership）
        type MembershipProvider: MembershipProvider<Self::AccountId>;

        /// 函数级中文注释：推荐关系提供者（pallet-memo-referrals）
        type ReferralProvider: ReferralProvider<Self::AccountId>;

        /// 函数级中文注释：财务治理起源（Root 或 财务委员会 2/3 多数）
        /// 
        /// 用于切换结算模式等重要财务治理操作
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级中文注释：权重信息
        type WeightInfo: WeightInfo;

        /// 函数级中文注释：Pallet ID，用于生成模块账户（暂时保留，未来可能移除）
        #[pallet::constant]
        type PalletId: Get<frame_support::PalletId>;
    }

    /// 当前结算模式
    ///
    /// 全局配置，影响所有新的供奉交易
    #[pallet::storage]
    #[pallet::getter(fn current_mode)]
    pub type CurrentMode<T: Config> = StorageValue<_, SettlementMode, ValueQuery>;

    /// 各模式使用次数统计
    ///
    /// 用于监控和分析模式使用情况
    #[pallet::storage]
    #[pallet::getter(fn mode_usage_count)]
    pub type ModeUsageCount<T: Config> = StorageMap<_, Twox64Concat, SettlementMode, u64, ValueQuery>;

    /// 各模式累计分配金额
    ///
    /// 用于财务审计和统计分析
    #[pallet::storage]
    #[pallet::getter(fn mode_total_distributed)]
    pub type ModeTotalDistributed<T: Config> =
        StorageMap<_, Twox64Concat, SettlementMode, BalanceOf<T>, ValueQuery>;

    /// 模式切换历史记录
    ///
    /// 最多保存最近100条记录
    #[pallet::storage]
    #[pallet::getter(fn switch_history)]
    pub type SwitchHistory<T: Config> = StorageValue<_, BoundedVec<ModeSwitch<BlockNumberFor<T>>, ConstU32<100>>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 结算模式已切换
        ///
        /// 参数: [from_mode_id, to_mode_id, block_number]
        /// mode_id: 0=Weekly, 1=Instant, 2=Hybrid
        ModeChanged {
            from_mode_id: u8,
            to_mode_id: u8,
            block: BlockNumberFor<T>,
        },
        /// 奖励已分配
        ///
        /// 参数: [buyer, amount, mode_id, levels]
        /// mode_id: 0=Weekly, 1=Instant, 2=Hybrid
        RewardsDistributed {
            buyer: T::AccountId,
            amount: BalanceOf<T>,
            mode_id: u8,
            levels: u8,
        },
        /// 混合模式分配完成
        ///
        /// 参数: [buyer, instant_amount, weekly_amount]
        HybridDistributed {
            buyer: T::AccountId,
            instant_amount: BalanceOf<T>,
            weekly_amount: BalanceOf<T>,
        },
    /// 函数级中文注释：会员奖励已分配（100%推荐链）
    ///
    /// 参数: [buyer, amount, mode_id] (0=Weekly, 1=Instant, 2=Hybrid)
    MembershipRewardsDistributed {
        buyer: T::AccountId,
        amount: u128,
        mode_id: u8,
    },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 混合模式参数无效（层级总和超过15）
        InvalidHybridParams,
        /// 没有找到推荐人
        ReferrerNotFound,
        /// 推荐人不是有效会员
        ReferrerNotValidMember,
        /// 分配失败
        DistributionFailed,
        /// 即时层级数不能为0
        InstantLevelsMustBeNonZero,
        /// 总层级数超过15
        TotalLevelsExceedsMaximum,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 设置结算模式（治理权限）
        ///
        /// # 参数
        /// - `origin`: 治理来源（Root 或委员会 2/3 多数）
        /// - `mode_id`: 模式 ID（0=Weekly, 1=Instant, 2=Hybrid）
        /// - `instant_levels`: 即时层级数（仅 Hybrid 模式需要，其他模式传0）
        /// - `weekly_levels`: 周结算层级数（仅 Hybrid 模式需要，其他模式传0）
        ///
        /// # 权限
        /// - Root 账户
        /// - 或委员会 2/3 成员通过的提案
        ///
        /// # 验证
        /// - 混合模式的层级总和不能超过 15
        /// - 即时层级数必须大于 0
        ///
        /// # 事件
        /// - `ModeChanged`: 模式切换成功
        #[pallet::call_index(0)]
        #[pallet::weight(T::WeightInfo::set_settlement_mode())]
        pub fn set_settlement_mode(
            origin: OriginFor<T>,
            mode_id: u8,
            instant_levels: u8,
            weekly_levels: u8,
        ) -> DispatchResult {
            // 治理权限验证：Root 或委员会 2/3 多数
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 构建 SettlementMode
            let new_mode = match mode_id {
                0 => SettlementMode::Weekly,
                1 => SettlementMode::Instant,
                2 => {
                    // 验证混合模式参数
                    ensure!(instant_levels > 0, Error::<T>::InstantLevelsMustBeNonZero);
                    ensure!(
                        instant_levels + weekly_levels <= 15,
                        Error::<T>::InvalidHybridParams
                    );
                    SettlementMode::Hybrid { instant_levels, weekly_levels }
                },
                _ => return Err(Error::<T>::InvalidHybridParams.into()), // 无效的 mode_id
            };

            let old_mode = <CurrentMode<T>>::get();
            let current_block = <frame_system::Pallet<T>>::block_number();

            // 更新当前模式
            <CurrentMode<T>>::put(new_mode.clone());

            // 记录切换历史
            <SwitchHistory<T>>::mutate(|history| {
                let switch = ModeSwitch {
                    block: current_block,
                    from_mode: old_mode.clone(),
                    to_mode: new_mode.clone(),
                };
                
                // 如果历史记录已满，移除最旧的记录
                if history.len() == 100 {
                    history.remove(0);
                }
                let _ = history.try_push(switch);
            });

            // 发出事件
            Self::deposit_event(Event::ModeChanged {
                from_mode_id: old_mode.to_id(),
                to_mode_id: new_mode.to_id(),
                block: current_block,
            });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：统一分配入口，根据结算模式动态路由到不同的分配工具
        ///
        /// 根据当前配置的结算模式，调用相应的分配逻辑。
        /// 资金已通过多路分账系统存入 pallet-affiliate 托管账户，
        /// 本函数只负责分配逻辑的路由，不处理资金转移。
        ///
        /// # 参数
        /// - `who`: 购买者账户
        /// - `amount`: 消费金额
        /// - `target`: 目标对象（domain, subject_id）
        /// - `block_number`: 当前区块号
        /// - `duration_weeks`: 持续周数（用于周结算）
        ///
        /// # 返回
        /// - `Ok(())`: 分配成功
        /// - `Err(...)`: 分配失败
        pub fn distribute_rewards(
            who: &T::AccountId,
            amount: BalanceOf<T>,
            target: Option<(u8, u64)>,
            block_number: BlockNumberFor<T>,
            duration_weeks: Option<u32>,
        ) -> DispatchResult {
            // 函数级中文注释：读取当前结算模式
            let mode = <CurrentMode<T>>::get();

            // 函数级中文注释：获取托管账户地址（资金来源）
            let escrow_account = T::EscrowAccount::get();

            // 函数级中文注释：根据模式路由到不同的分配逻辑
            match mode {
                SettlementMode::Instant => {
                    // 函数级中文注释：即时分配 - 从托管账户立即转账给推荐人
                    T::InstantProvider::distribute_instant(
                        who,
                        amount,
                        &escrow_account,
                    ).map_err(|_| Error::<T>::DistributionFailed)?;
                    
                    Self::deposit_event(Event::RewardsDistributed {
                        buyer: who.clone(),
                        amount,
                        mode_id: 1, // Instant
                        levels: 15, // 默认最大层级
                    });
                }
                SettlementMode::Weekly => {
                    // 函数级中文注释：周结算 - 记账到待分配列表，等待周期结算
                    T::WeeklyProvider::escrow_and_record(
                        who,
                        amount,
                        target,
                        block_number,
                        duration_weeks,
                    )?;
                    
                    Self::deposit_event(Event::RewardsDistributed {
                        buyer: who.clone(),
                        amount,
                        mode_id: 0, // Weekly
                        levels: 15,
                    });
                }
                SettlementMode::Hybrid { instant_levels: _, weekly_levels: _ } => {
                    // 函数级中文注释：混合模式 - 前N层即时，后续层周结算
                    // Phase 2 实现（暂时退化为 Instant 模式）
                    T::InstantProvider::distribute_instant(
                        who,
                        amount,
                        &escrow_account,
                    ).map_err(|_| Error::<T>::DistributionFailed)?;
                    
                    Self::deposit_event(Event::HybridDistributed {
                        buyer: who.clone(),
                        instant_amount: amount,
                        weekly_amount: BalanceOf::<T>::zero(),
                    });
                }
            }

        // 函数级中文注释：更新统计
        <ModeUsageCount<T>>::mutate(&mode, |count| *count = count.saturating_add(1));
        <ModeTotalDistributed<T>>::mutate(&mode, |total| *total = total.saturating_add(amount));

        Ok(())
    }

    /// 函数级中文注释：会员专用分配（100%推荐链）
    /// - 不扣除 Burn、Treasury、Storage
    /// - 100% 分配给推荐链
    ///
    /// # 参数
    /// - `buyer`: 购买者账户
    /// - `amount`: 会员费用（u128）
    /// - `block_number`: 当前区块高度
    ///
    /// # 返回
    /// - `Ok(())`: 分配成功
    /// - `Err`: 分配失败
    pub fn distribute_membership_rewards(
        buyer: &T::AccountId,
        amount: u128,
        block_number: BlockNumberFor<T>,
    ) -> DispatchResult {
        // 读取当前结算模式
        let mode = <CurrentMode<T>>::get();
        
        // 获取托管账户地址（资金来源）
        let escrow_account = T::EscrowAccount::get();
        
        // 根据模式路由到不同的分配逻辑
        match mode {
            SettlementMode::Instant => {
                // ✅ 调用纯推荐链分配（100%）
                T::InstantProvider::distribute_to_referral_chain_only(
                    buyer,
                    amount,
                    &escrow_account,
                )?;
                
                // 统计
                <ModeUsageCount<T>>::mutate(SettlementMode::Instant, |c| {
                    *c = c.saturating_add(1)
                });
                <ModeTotalDistributed<T>>::mutate(SettlementMode::Instant, |t| {
                    *t = t.saturating_add(amount.saturated_into())
                });
            }
            
            SettlementMode::Weekly => {
                // ✅ Weekly 模式本身就是100%推荐链（周结算时不扣除）
                T::WeeklyProvider::escrow_and_record(
                    buyer,
                    amount.saturated_into(),
                    None,          // 会员购买无 target
                    block_number,
                    None,          // 会员购买无时长
                )?;
                
                // 统计
                <ModeUsageCount<T>>::mutate(SettlementMode::Weekly, |c| {
                    *c = c.saturating_add(1)
                });
                <ModeTotalDistributed<T>>::mutate(SettlementMode::Weekly, |t| {
                    *t = t.saturating_add(amount.saturated_into())
                });
            }
            
            SettlementMode::Hybrid { .. } => {
                // 暂时回退到 Instant（100%推荐链）
                T::InstantProvider::distribute_to_referral_chain_only(
                    buyer,
                    amount,
                    &escrow_account,
                )?;
            }
        }
        
        // 发出事件
        Self::deposit_event(Event::MembershipRewardsDistributed {
            buyer: buyer.clone(),
            amount,
            mode_id: mode.to_id(),
        });
        
        Ok(())
    }


    /// 获取模式使用统计
    pub fn get_mode_statistics(mode: &SettlementMode) -> (u64, BalanceOf<T>) {
        let count = <ModeUsageCount<T>>::get(mode);
        let total = <ModeTotalDistributed<T>>::get(mode);
        (count, total)
    }

        /// 获取切换历史
        pub fn get_switch_history() -> Vec<ModeSwitch<BlockNumberFor<T>>> {
            <SwitchHistory<T>>::get().into_inner()
        }
    }

    // 函数级中文注释：实现 AffiliateDistributor trait，供其他业务模块调用
    impl<T: Config> AffiliateDistributor<T::AccountId, u128, BlockNumberFor<T>> for Pallet<T> {
        fn distribute_rewards(
            buyer: &T::AccountId,
            amount: u128,
            target: Option<(u8, u64)>,
            block_number: BlockNumberFor<T>,
            duration_weeks: Option<u32>,
        ) -> DispatchResult {
            // 转换金额类型
            let amount_balance: BalanceOf<T> = amount.saturated_into();
            
            // 调用现有的 distribute_rewards 函数
            Self::distribute_rewards(buyer, amount_balance, target, block_number, duration_weeks)
        }
        
        fn distribute_membership_rewards(
            buyer: &T::AccountId,
            amount: u128,
            block_number: BlockNumberFor<T>,
        ) -> DispatchResult {
            // 直接调用内部实现
            Self::distribute_membership_rewards(buyer, amount, block_number)
        }
    }
}
