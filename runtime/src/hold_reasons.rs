// Phase 1优化：定义官方Holds API的HoldReason
// 
// 函数级详细中文注释：用于替代pallet-deposits的Hold原因枚举
// - 使用pallet-balances的Holds API进行资金锁定
// - 支持多种业务场景的押金管理
// - 与官方API完全兼容

use frame_support::traits::tokens::fungible::hold::Mutate;
use parity_scale_codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;
use sp_runtime::RuntimeDebug;

/// Phase 1优化：Holds API的Hold原因枚举
/// 
/// 函数级详细中文注释：定义所有可能的资金锁定原因
/// 
/// # 使用场景
/// 
/// ## Appeal - 申诉押金
/// ```ignore
/// // 用户提交申诉时锁定押金
/// T::Currency::hold(&HoldReason::Appeal, &who, amount)?;
/// 
/// // 申诉通过，释放押金
/// T::Currency::release(&HoldReason::Appeal, &who, amount, Precision::Exact)?;
/// 
/// // 申诉驳回，罚没押金
/// T::Currency::transfer_on_hold(
///     &HoldReason::Appeal, 
///     &who, 
///     &treasury, 
///     amount,
///     Precision::BestEffort,
///     Fortitude::Force
/// )?;
/// ```
/// 
/// ## OfferingReview - 供奉品审核押金
/// ```ignore
/// // 创建供奉品时锁定审核押金
/// T::Currency::hold(&HoldReason::OfferingReview, &who, amount)?;
/// ```
/// 
/// ## Complaint - 投诉押金
/// ```ignore
/// // 提交投诉时锁定押金
/// T::Currency::hold(&HoldReason::Complaint, &who, amount)?;
/// ```
#[derive(
    Encode,
    Decode,
    Clone,
    Copy,
    PartialEq,
    Eq,
    RuntimeDebug,
    TypeInfo,
    MaxEncodedLen,
)]
pub enum HoldReason {
    /// 申诉押金
    /// 
    /// 用于pallet-memo-appeals的申诉押金锁定
    /// - 提交申诉时锁定
    /// - 申诉通过后释放
    /// - 申诉驳回后罚没
    Appeal,

    /// 供奉品审核押金
    /// 
    /// 用于pallet-memo-offerings的审核押金
    /// - 创建供奉品时锁定
    /// - 审核通过后释放
    /// - 审核失败后罚没
    OfferingReview,

    /// 投诉押金
    /// 
    /// 用于各类投诉功能的押金
    /// - 提交投诉时锁定
    /// - 投诉成立后释放
    /// - 投诉不成立后罚没
    Complaint,

    /// 预留：未来扩展
    /// 
    /// 用于未来可能的其他押金场景
    Reserved,
}

impl HoldReason {
    /// 函数级详细中文注释：获取Hold原因的描述
    /// 
    /// # 返回
    /// - `&'static str`: 原因描述字符串
    pub fn description(&self) -> &'static str {
        match self {
            HoldReason::Appeal => "Appeal deposit",
            HoldReason::OfferingReview => "Offering review deposit",
            HoldReason::Complaint => "Complaint deposit",
            HoldReason::Reserved => "Reserved for future use",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hold_reason_description() {
        assert_eq!(HoldReason::Appeal.description(), "Appeal deposit");
        assert_eq!(HoldReason::OfferingReview.description(), "Offering review deposit");
        assert_eq!(HoldReason::Complaint.description(), "Complaint deposit");
    }
}

