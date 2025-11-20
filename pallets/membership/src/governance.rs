//! # 统一治理模块
//!
//! **🚀 2025-11-13 架构重构：从 pallet-affiliate 迁移到 pallet-membership**
//!
//! 本模块现在位于 membership 中，实现全民投票机制修改关键参数：
//! - **年费等级价格**（MembershipPrices）：4个等级的USDT价格 ← 核心功能
//! - **即时分成比例**（InstantLevelPercents）：15层联盟分成比例 ← 跨模块治理
//!
//! ## 架构优势
//!
//! - **职责明确**: membership 作为基础模块，承担治理职责
//! - **依赖合理**: affiliate 调用 membership 的治理服务
//! - **代码复用**: 统一的治理基础设施
//! - **语义正确**: 会员系统负责社区治理
//!
//! ## 核心功能
//!
//! - **提案创建**：持币大户、社区联署可发起提案
//! - **投票机制**：加权投票（持币70% + 参与20% + 贡献10%）+ 信念投票
//! - **自动执行**：通过后自动生效，无需人工干预
//! - **紧急机制**：技术委员会可紧急暂停治理（但无法否决提案）
//!
//! ## 安全保障
//!
//! - **唯一修改通道**：关键参数只能通过治理提案修改
//! - **严格验证**：参数合理性检查
//! - **防垃圾提案**：押金机制、频率限制、冷却期
//! - **审计追溯**：完整的提案和投票历史记录
//! - **🔥 技术委员会无否决权**：所有提案都必须通过全民投票

use super::*;
use frame_support::{pallet_prelude::*, traits::Currency};
use frame_system::pallet_prelude::BlockNumberFor;
use sp_runtime::{Perbill, SaturatedConversion, Saturating};

// 🔥 2025-11-13：从 affiliate 导入分成比例类型
/// 15层分成比例数组类型（从 affiliate 引入）
pub type LevelPercents = [u8; 15];

/// 提案状态
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ProposalStatus {
    /// 讨论期
    Discussion,
    /// 投票中
    Voting,
    /// 已通过，等待执行
    Approved,
    /// 已拒绝
    Rejected,
    /// 已取消
    Cancelled,
    /// 已执行
    Executed,
}

/// 投票选项
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum Vote {
    /// 支持
    Aye,
    /// 反对
    Nay,
    /// 弃权
    Abstain,
}

impl Vote {
    /// 转换为 u8 编码（用于事件）
    pub fn to_u8(&self) -> u8 {
        match self {
            Vote::Aye => 0,
            Vote::Nay => 1,
            Vote::Abstain => 2,
        }
    }
}

/// 信念投票（锁定时长换取权重倍数）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum Conviction {
    /// 不锁定，权重 x1
    None,
    /// 锁定1周，权重 x1.5
    Locked1x,
    /// 锁定2周，权重 x2
    Locked2x,
    /// 锁定4周，权重 x3
    Locked3x,
    /// 锁定8周，权重 x4
    Locked4x,
    /// 锁定16周，权重 x5
    Locked5x,
    /// 锁定32周，权重 x6
    Locked6x,
}

impl Conviction {
    /// 获取权重倍数
    pub fn multiplier(&self) -> u128 {
        match self {
            Conviction::None => 1,
            Conviction::Locked1x => 15, // 1.5x * 10
            Conviction::Locked2x => 20,
            Conviction::Locked3x => 30,
            Conviction::Locked4x => 40,
            Conviction::Locked5x => 50,
            Conviction::Locked6x => 60,
        }
    }

    /// 获取锁定周数
    pub fn lock_weeks(&self) -> u32 {
        match self {
            Conviction::None => 0,
            Conviction::Locked1x => 1,
            Conviction::Locked2x => 2,
            Conviction::Locked3x => 4,
            Conviction::Locked4x => 8,
            Conviction::Locked5x => 16,
            Conviction::Locked6x => 32,
        }
    }
}

/// 投票记录
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct VoteRecord<T: Config> {
    /// 投票人
    pub voter: T::AccountId,

    /// 投票选项
    pub vote: Vote,

    /// 信念投票
    pub conviction: Conviction,

    /// 投票权重
    pub weight: u128,

    /// 投票时间
    pub timestamp: BlockNumberFor<T>,
}

/// 投票统计
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen, Default)]
pub struct VoteTally {
    /// 支持票权重
    pub aye_votes: u128,

    /// 反对票权重
    pub nay_votes: u128,

    /// 弃权票权重
    pub abstain_votes: u128,

    /// 总投票权重
    pub total_turnout: u128,
}

impl VoteTally {
    /// 计算支持率（支持票 / (支持票 + 反对票)）
    pub fn approval_rate(&self) -> Perbill {
        let total = self.aye_votes.saturating_add(self.nay_votes);
        if total == 0 {
            return Perbill::zero();
        }
        Perbill::from_rational(self.aye_votes, total)
    }

    /// 计算参与率（总投票 / 总投票权）
    pub fn participation_rate(&self, total_power: u128) -> Perbill {
        if total_power == 0 {
            return Perbill::zero();
        }
        Perbill::from_rational(self.total_turnout, total_power)
    }
}

// ========================================
// 年费价格治理模块 🔥 核心功能
// ========================================

/// 年费价格调整提案
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
#[scale_info(skip_type_params(T))]
pub struct MembershipPriceProposal<T: Config> {
    /// 提案ID
    pub proposal_id: u64,

    /// 提案发起人
    pub proposer: T::AccountId,

    /// 提案标题（IPFS CID）
    pub title_cid: BoundedVec<u8, ConstU32<64>>,

    /// 提案详情（IPFS CID）
    pub description_cid: BoundedVec<u8, ConstU32<64>>,

    /// 提案理由（IPFS CID）
    pub rationale_cid: BoundedVec<u8, ConstU32<64>>,

    /// 新的年费价格（USDT，精度 10^6）
    /// 按顺序：[Year1, Year3, Year5, Year10]
    pub new_prices_usdt: [u64; 4],

    /// 生效区块高度
    pub effective_block: BlockNumberFor<T>,

    /// 提案状态
    pub status: ProposalStatus,

    /// 是否为重大提案（价格变化 >20%）
    pub is_major: bool,

    /// 创建时间
    pub created_at: BlockNumberFor<T>,

    /// 投票开始时间
    pub voting_start: Option<BlockNumberFor<T>>,

    /// 投票结束时间
    pub voting_end: Option<BlockNumberFor<T>>,
}

impl<T: Config> MembershipPriceProposal<T> {
    /// 验证年费价格
    pub fn validate_prices(prices: &[u64; 4]) -> Result<(), &'static str> {
        // 1. 价格范围检查（10-1000 USDT）
        for price in prices {
            if *price < 10_000_000 || *price > 1_000_000_000 {
                return Err("Price out of range (10-1000 USDT)");
            }
        }

        // 2. 递增性检查
        if prices[0] > prices[1] || prices[1] > prices[2] || prices[2] > prices[3] {
            return Err("Prices must be in ascending order");
        }

        // 3. 合理性检查（相邻价格差距不超过10倍）
        for i in 0..3 {
            if prices[i + 1] > prices[i] * 10 {
                return Err("Price gap too large between adjacent levels");
            }
        }

        Ok(())
    }

    /// 计算押金金额
    pub fn calculate_deposit(&self) -> BalanceOf<T> {
        let units: BalanceOf<T> = T::Units::get();
        if self.is_major {
            units.saturating_mul(10000u128.saturated_into()) // 10,000 DUST
        } else {
            units.saturating_mul(1000u128.saturated_into())  // 1,000 DUST
        }
    }
}

/// 年费价格变更历史记录
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
#[scale_info(skip_type_params(T))]
pub struct MembershipPriceChangeRecord<T: Config> {
    /// 提案ID
    pub proposal_id: u64,

    /// 旧价格（USDT）
    pub old_prices_usdt: [u64; 4],

    /// 新价格（USDT）
    pub new_prices_usdt: [u64; 4],

    /// 执行区块
    pub executed_at: BlockNumberFor<T>,

    /// 执行者（通常是"Governance"）
    pub executed_by: BoundedVec<u8, ConstU32<32>>,
}

// ========================================
// 分成比例治理模块 🔥 跨模块服务
// ========================================

/// 分成比例调整提案
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
#[scale_info(skip_type_params(T))]
pub struct PercentageAdjustmentProposal<T: Config> {
    /// 提案ID
    pub proposal_id: u64,

    /// 提案发起人
    pub proposer: T::AccountId,

    /// 提案标题（IPFS CID）
    pub title_cid: BoundedVec<u8, ConstU32<64>>,

    /// 提案详情（IPFS CID）
    pub description_cid: BoundedVec<u8, ConstU32<64>>,

    /// 新的分成比例（15层）
    pub new_percentages: LevelPercents,

    /// 生效区块高度
    pub effective_block: BlockNumberFor<T>,

    /// 提案理由（IPFS CID）
    pub rationale_cid: BoundedVec<u8, ConstU32<64>>,

    /// 影响分析（IPFS CID，可选）
    pub impact_analysis_cid: Option<BoundedVec<u8, ConstU32<64>>>,

    /// 提案状态
    pub status: ProposalStatus,

    /// 是否重大提案（统一为false，全民投票）
    pub is_major: bool,

    /// 创建时间
    pub created_at: BlockNumberFor<T>,

    /// 投票开始时间
    pub voting_start: Option<BlockNumberFor<T>>,

    /// 投票结束时间
    pub voting_end: Option<BlockNumberFor<T>>,
}

impl<T: Config> PercentageAdjustmentProposal<T> {
    /// 计算分成比例调整提案的押金金额（统一）
    pub fn calculate_deposit(&self) -> BalanceOf<T> {
        let units: BalanceOf<T> = T::Units::get();
        units.saturating_mul(5000u128.saturated_into()) // 5,000 DUST（统一押金）
    }
}

/// 比例变更历史记录
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
#[scale_info(skip_type_params(T))]
pub struct PercentageChangeRecord<T: Config> {
    /// 提案ID
    pub proposal_id: u64,

    /// 旧比例
    pub old_percentages: LevelPercents,

    /// 新比例
    pub new_percentages: LevelPercents,

    /// 执行区块
    pub executed_at: BlockNumberFor<T>,

    /// 执行者（通常是"Governance"）
    pub executed_by: BoundedVec<u8, ConstU32<32>>,
}

// ========================================
// 通用治理功能
// ========================================

impl<T: Config> Pallet<T> {
    /// 验证新分成比例的有效性
    ///
    /// 🔥 2025-11-13 更新：第三层分成比例可以为0（全民投票决定）
    ///
    /// 验证规则：
    /// - 前2层（第1、2层）不能为0，确保基础激励
    /// - 第3层可以为0，允许社区通过投票调整
    /// - 第4-15层可以为0，提供灵活性
    /// - 总和必须在50-99%范围内
    /// - 前5层必须递减（包括0值）
    pub fn validate_percentages(percentages: &LevelPercents) -> DispatchResult {
        // 1. 检查长度
        ensure!(
            percentages.len() == 15,
            Error::<T>::InvalidPercentageLength
        );

        // 2. 检查单个比例范围
        for (index, &percentage) in percentages.iter().enumerate() {
            ensure!(
                percentage <= 100,
                Error::<T>::PercentageTooHigh
            );

            // 前2层不能为0，第3层可以为0（基于全民投票决定）
            if index < 2 {
                ensure!(
                    percentage > 0,
                    Error::<T>::CriticalLayerZero
                );
            }
        }

        // 3. 检查总和合理性
        let total: u32 = percentages.iter().map(|&x| x as u32).sum();
        ensure!(
            total >= 50,
            Error::<T>::TotalPercentageTooLow
        );
        ensure!(
            total <= 99,
            Error::<T>::TotalPercentageTooHigh
        );

        // 4. 检查递减合理性（前5层应该递减，但允许第3层为0的特殊情况）
        for i in 1..5 {
            // 🔥 2025-11-13：特殊处理第3层为0的情况
            // 如果第3层为0，允许第4、5层有合理的非零值
            if i == 2 && percentages[i] == 0 {
                // 第3层为0时，跳过这次递减检查
                continue;
            }
            if i == 3 && percentages[2] == 0 && percentages[i] > 0 {
                // 第3层为0，第4层不为0时，检查第4层是否合理（不超过第2层）
                ensure!(
                    percentages[i] <= percentages[1],
                    Error::<T>::NonDecreasingPercentage
                );
                continue;
            }
            if i == 4 && percentages[2] == 0 && percentages[i] > 0 {
                // 第3层为0，第5层不为0时，检查第5层是否合理（不超过第4层）
                if percentages[3] > 0 {
                    ensure!(
                        percentages[i] <= percentages[3],
                        Error::<T>::NonDecreasingPercentage
                    );
                } else {
                    // 如果第3、4层都为0，第5层不超过第2层
                    ensure!(
                        percentages[i] <= percentages[1],
                        Error::<T>::NonDecreasingPercentage
                    );
                }
                continue;
            }

            // 常规递减检查
            ensure!(
                percentages[i] <= percentages[i - 1],
                Error::<T>::NonDecreasingPercentage
            );
        }

        // 5. 检查极值（防止寡头垄断）
        ensure!(
            percentages[0] <= 50,
            Error::<T>::FirstLayerTooHigh
        );

        Ok(())
    }

    /// 计算变化幅度（百分点）
    pub fn calculate_change_magnitude(
        old: &LevelPercents,
        new: &LevelPercents,
    ) -> u32 {
        let mut total_change = 0u32;
        for i in 0..15 {
            let diff = if new[i] > old[i] {
                new[i] - old[i]
            } else {
                old[i] - new[i]
            };
            total_change = total_change.saturating_add(diff as u32);
        }
        total_change
    }

    /// 计算账户的总投票权重
    /// 持币权重（70%） + 参与权重（20%） + 贡献权重（10%）
    pub fn calculate_total_voting_power(account: &T::AccountId) -> u128 {
        let stake_weight = Self::calculate_stake_weight(account)
            .saturating_mul(70)
            .saturating_div(100);

        let participation_weight = Self::calculate_participation_weight(account)
            .saturating_mul(20)
            .saturating_div(100);

        let contribution_weight = Self::calculate_contribution_weight(account)
            .saturating_mul(10)
            .saturating_div(100);

        stake_weight
            .saturating_add(participation_weight)
            .saturating_add(contribution_weight)
    }

    /// 计算持币权重（平方根，避免巨鲸垄断）
    fn calculate_stake_weight(account: &T::AccountId) -> u128 {
        let balance = T::Currency::free_balance(account);
        let balance_u128: u128 = balance.saturated_into();

        // 平方根权重
        let sqrt_balance = Self::integer_sqrt(balance_u128);

        // 权重上限：相当于100万 DUST 的权重
        let max_weight = 1000u128; // sqrt(1,000,000) = 1000

        sqrt_balance.min(max_weight)
    }

    /// 计算参与权重（历史投票次数）
    fn calculate_participation_weight(_account: &T::AccountId) -> u128 {
        // TODO: 从存储中获取投票历史
        // let vote_count = VoteHistory::<T>::get(account).len() as u128;

        // 临时实现，返回基础权重
        let vote_count = 0u128;

        match vote_count {
            0..=2 => 10,      // 新手
            3..=5 => 25,      // 活跃
            6..=10 => 50,     // 资深
            _ => 100,         // 元老
        }
    }

    /// 计算贡献权重（推荐贡献 + 委员会成员）
    fn calculate_contribution_weight(account: &T::AccountId) -> u128 {
        let mut weight = 0u128;

        // 推荐贡献（每个成功推荐 +2 分，最多50人 = 100分）
        let referral_count = Self::count_successful_referrals(account);
        weight = weight.saturating_add(referral_count.min(50).saturating_mul(2));

        // TODO: 技术委员会成员额外投票权重 +200
        // 注意：虽然技术委员会有额外权重，但无法否决任何治理提案
        // 所有提案都必须达到全民投票的参与率和支持率门槛
        // if Self::is_council_member(account) {
        //     weight = weight.saturating_add(200);
        // }

        weight.min(300)
    }

    /// 计算整数平方根（牛顿迭代法）
    fn integer_sqrt(n: u128) -> u128 {
        if n == 0 {
            return 0;
        }

        let mut x = n;
        let mut y = (x + 1) / 2;

        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }

        x
    }

    /// 统计成功推荐数量
    fn count_successful_referrals(_account: &T::AccountId) -> u128 {
        // TODO: 实现推荐统计逻辑
        0
    }

    /// 检查年费价格提案是否通过（技术委员会无法否决）
    pub fn check_membership_price_proposal_passed(
        _proposal: &MembershipPriceProposal<T>,
        tally: &VoteTally,
    ) -> bool {
        // 全民投票机制：最低参与率要求
        let total_power = 100000u128; // TODO: 实现真实的投票权计算
        let participation = tally.participation_rate(total_power);

        // 最低参与率门槛：15%
        if participation < Perbill::from_percent(15) {
            return false;
        }

        // 自适应阈值：参与率越高，通过门槛越低
        let required_approval = if participation >= Perbill::from_percent(50) {
            Perbill::from_percent(50) // 50%参与 → 50%支持
        } else if participation >= Perbill::from_percent(30) {
            Perbill::from_percent(55) // 30%参与 → 55%支持
        } else {
            Perbill::from_percent(60) // 15%参与 → 60%支持
        };

        tally.approval_rate() >= required_approval
    }

    /// 检查分成比例提案是否通过（技术委员会无法否决，所有提案都使用全民投票）
    pub fn check_percentage_proposal_passed(
        _proposal: &PercentageAdjustmentProposal<T>,
        tally: &VoteTally,
    ) -> bool {
        // 🔥 2025-11-13 重要修改：删除微调提案的技术委员会否决权
        // 所有分成比例提案现在都必须通过全民投票，技术委员会无法否决

        // 全民投票机制：最低参与率要求
        let total_power = 100000u128; // TODO: 实现真实的投票权计算
        let participation = tally.participation_rate(total_power);

        // 最低参与率门槛：15%
        if participation < Perbill::from_percent(15) {
            return false;
        }

        // 自适应阈值：参与率越高，通过门槛越低
        let required_approval = if participation >= Perbill::from_percent(50) {
            Perbill::from_percent(50) // 50%参与 → 50%支持
        } else if participation >= Perbill::from_percent(30) {
            Perbill::from_percent(55) // 30%参与 → 55%支持
        } else {
            Perbill::from_percent(60) // 15%参与 → 60%支持
        };

        tally.approval_rate() >= required_approval
    }
}