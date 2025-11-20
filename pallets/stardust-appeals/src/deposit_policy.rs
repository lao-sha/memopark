//! # 作品投诉差异化押金计算模块
//!
//! ## 概述
//! 实现基于多因子的动态押金计算机制
//!
//! ## 押金计算公式
//! ```text
//! 最终押金 = 基础押金 × 类型系数 × 影响力系数 × 验证状态系数 × 用户信誉系数 × 全局乘数
//! ```
//!
//! ## 版本历史
//! - v1.0.0 (2025-01-15): 初始实现 - 阶段2差异化押金机制

use codec::{Decode, Encode, MaxEncodedLen};
use frame_support::pallet_prelude::*;
use scale_info::TypeInfo;

/// 函数级详细中文注释：作品投诉押金计算参数
///
/// ## 用途
/// 存储押金计算的所有必要参数，用于实现差异化押金标准
///
/// ## 字段说明
/// - `work_id`: 作品ID
/// - `work_type`: 作品类型分类
/// - `influence_score`: 作品影响力评分（0-100）
/// - `is_verified`: 是否已验证
/// - `action`: 投诉操作类型（1-8）
/// - `complainant_reputation`: 投诉人信誉评分（0-100）
/// - `global_multiplier`: 全局押金乘数（用于系统动态调整）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct WorkDepositParams {
    pub work_id: u64,
    pub work_type: crate::works_types::WorkTypeCategory,
    pub influence_score: u8,
    pub is_verified: bool,
    pub action: u8,
    pub complainant_reputation: u8,
    pub global_multiplier: u16, // 以千分之一为单位，1000 = 1.0
}

impl Default for WorkDepositParams {
    fn default() -> Self {
        Self {
            work_id: 0,
            work_type: crate::works_types::WorkTypeCategory::Other,
            influence_score: 0,
            is_verified: false,
            action: 1,
            complainant_reputation: 50, // 默认中等信誉
            global_multiplier: 1000, // 默认1.0倍
        }
    }
}

/// 函数级详细中文注释：押金计算系数配置
///
/// ## 用途
/// 定义各种系数的标准值，用于押金计算公式
///
/// ## 系数说明
/// - 类型系数：根据作品类型调整押金（0.5-2.0）
/// - 影响力系数：根据影响力评分调整押金（1.0-3.0）
/// - 验证状态系数：已验证作品押金更高（0.8-1.5）
/// - 信誉系数：高信誉用户押金减免（0.5-2.0）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, RuntimeDebug)]
pub struct DepositMultipliers {
    /// 类型系数（千分之一精度，500 = 0.5, 2000 = 2.0）
    pub type_multiplier: u16,
    /// 影响力系数（千分之一精度，1000 = 1.0, 3000 = 3.0）
    pub influence_multiplier: u16,
    /// 验证状态系数（千分之一精度）
    pub verification_multiplier: u16,
    /// 信誉系数（千分之一精度）
    pub reputation_multiplier: u16,
}

impl Default for DepositMultipliers {
    fn default() -> Self {
        Self {
            type_multiplier: 1000,       // 1.0
            influence_multiplier: 1000,  // 1.0
            verification_multiplier: 1000, // 1.0
            reputation_multiplier: 1000, // 1.0
        }
    }
}

/// 函数级详细中文注释：计算作品类型系数
///
/// ## 参数
/// - `work_type`: 作品类型分类
///
/// ## 返回
/// 类型系数（千分之一精度）
///
/// ## 系数表
/// - Academic（学术论文）: 2.0 (2000)
/// - Literature（文学作品）: 1.5 (1500)
/// - Audio（音频作品）: 1.5 (1500)
/// - Code（代码作品）: 1.3 (1300)
/// - Video（视频作品）: 1.2 (1200)
/// - Visual（图像作品）: 1.0 (1000)
/// - SocialMedia（社交媒体）: 0.8 (800)
/// - Other（其他）: 0.5 (500)
pub fn calculate_type_multiplier(work_type: &crate::works_types::WorkTypeCategory) -> u16 {
    match work_type {
        crate::works_types::WorkTypeCategory::Academic => 2000,      // 学术论文：最高风险
        crate::works_types::WorkTypeCategory::Literature => 1500,   // 文学作品：高风险
        crate::works_types::WorkTypeCategory::Audio => 1500,        // 音频作品：高风险
        crate::works_types::WorkTypeCategory::Code => 1300,         // 代码作品：中高风险
        crate::works_types::WorkTypeCategory::Video => 1200,        // 视频作品：中高风险
        crate::works_types::WorkTypeCategory::Visual => 1000,       // 图像作品：标准风险
        crate::works_types::WorkTypeCategory::SocialMedia => 800,   // 社交媒体：较低风险
        crate::works_types::WorkTypeCategory::Other => 500,         // 其他：最低风险
    }
}

/// 函数级详细中文注释：计算作品影响力系数
///
/// ## 参数
/// - `influence_score`: 作品影响力评分（0-100）
///
/// ## 返回
/// 影响力系数（千分之一精度）
///
/// ## 系数表
/// - 80-100分: 3.0 (3000) - 高影响力
/// - 60-79分: 2.0 (2000) - 中等影响力
/// - 40-59分: 1.5 (1500) - 一般影响力
/// - 20-39分: 1.2 (1200) - 较低影响力
/// - 0-19分: 1.0 (1000) - 极低影响力
pub fn calculate_influence_multiplier(influence_score: u8) -> u16 {
    if influence_score >= 80 {
        3000  // 300%：高影响力作品，投诉门槛更高
    } else if influence_score >= 60 {
        2000  // 200%：中等影响力
    } else if influence_score >= 40 {
        1500  // 150%：一般影响力
    } else if influence_score >= 20 {
        1200  // 120%：较低影响力
    } else {
        1000  // 100%：极低影响力，标准押金
    }
}

/// 函数级详细中文注释：计算验证状态系数
///
/// ## 参数
/// - `is_verified`: 是否已验证
///
/// ## 返回
/// 验证状态系数（千分之一精度）
///
/// ## 系数表
/// - 已验证: 1.5 (1500) - 投诉门槛提高50%
/// - 未验证: 0.8 (800) - 押金降低20%，鼓励监督
pub fn calculate_verification_multiplier(is_verified: bool) -> u16 {
    if is_verified {
        1500  // 已验证作品：押金提高50%（投诉门槛更高）
    } else {
        800   // 未验证作品：押金降低20%（鼓励监督）
    }
}

/// 函数级详细中文注释：计算用户信誉系数
///
/// ## 参数
/// - `reputation`: 用户信誉评分（0-100）
///
/// ## 返回
/// 信誉系数（千分之一精度）
///
/// ## 系数表
/// - 90-100分: 0.5 (500) - 高信誉用户，押金减半
/// - 70-89分: 0.7 (700) - 中等信誉，押金7折
/// - 50-69分: 1.0 (1000) - 一般信誉，标准押金
/// - 20-49分: 1.5 (1500) - 低信誉，押金上浮50%
/// - 0-19分: 2.0 (2000) - 极低信誉，押金翻倍
pub fn calculate_reputation_multiplier(reputation: u8) -> u16 {
    if reputation >= 90 {
        500   // 高信誉用户：押金减半
    } else if reputation >= 70 {
        700   // 中等信誉：押金7折
    } else if reputation >= 50 {
        1000  // 一般信誉：标准押金
    } else if reputation >= 20 {
        1500  // 低信誉：押金上浮50%
    } else {
        2000  // 极低信誉：押金翻倍
    }
}

/// 函数级详细中文注释：计算操作基础押金
///
/// ## 参数
/// - `action`: 操作类型（1-8）
///
/// ## 返回
/// 基础押金金额（DUST单位，12 decimals）
///
/// ## 押金表（单位：DUST）
/// - HIDE_WORK（1）: 20 DUST - 隐藏作品
/// - DELETE_WORK（2）: 50 DUST - 删除作品（严重）
/// - REVOKE_AI_TRAINING（3）: 15 DUST - 撤销AI训练
/// - UNVERIFY_WORK（4）: 30 DUST - 取消验证
/// - CHANGE_PRIVACY（5）: 10 DUST - 修改隐私
/// - MARK_AS_VIOLATION（6）: 25 DUST - 标记违规
/// - TRANSFER_OWNERSHIP（7）: 100 DUST - 转移所有权（极严重）
/// - FREEZE_WORK（8）: 40 DUST - 冻结作品
pub fn calculate_base_deposit<Balance: From<u128>>(action: u8) -> Balance {
    let base_dust = match action {
        1 => 20,   // HIDE_WORK
        2 => 50,   // DELETE_WORK
        3 => 15,   // REVOKE_AI_TRAINING
        4 => 30,   // UNVERIFY_WORK
        5 => 10,   // CHANGE_PRIVACY
        6 => 25,   // MARK_AS_VIOLATION
        7 => 100,  // TRANSFER_OWNERSHIP
        8 => 40,   // FREEZE_WORK
        _ => 20,   // 默认
    };

    // 转换为Balance类型（12 decimals）
    Balance::from((base_dust as u128) * 1_000_000_000_000u128)
}

/// 函数级详细中文注释：执行完整的押金计算（简化版）
///
/// ## 参数
/// - `params`: 押金计算参数
/// - `min_deposit_u128`: 最小押金（u128格式）
/// - `max_deposit_u128`: 最大押金（u128格式）
///
/// ## 返回
/// 最终押金金额（u128格式）
///
/// ## 计算流程
/// 1. 获取操作基础押金
/// 2. 计算各种系数
/// 3. 应用公式：基础 × 类型 × 影响力 × 验证 × 信誉 × 全局
/// 4. 应用最小/最大限制
///
/// ## 限制
/// - 最小押金：5 DUST（可配置）
/// - 最大押金：1000 DUST（可配置）
///
/// ## 使用示例
/// ```ignore
/// let deposit_u128 = calculate_work_deposit_u128(
///     &params,
///     5_000_000_000_000u128,   // 5 DUST
///     1000_000_000_000_000u128 // 1000 DUST
/// );
/// let deposit_balance = BalanceOf::<T>::from(deposit_u128);
/// ```
pub fn calculate_work_deposit_u128(
    params: &WorkDepositParams,
    min_deposit_u128: u128,
    max_deposit_u128: u128,
) -> u128 {
    // 1. 获取基础押金（u128格式）
    let base_u128: u128 = calculate_base_deposit(params.action);

    // 2. 计算各种系数
    let type_mult = calculate_type_multiplier(&params.work_type);
    let influence_mult = calculate_influence_multiplier(params.influence_score);
    let verification_mult = calculate_verification_multiplier(params.is_verified);
    let reputation_mult = calculate_reputation_multiplier(params.complainant_reputation);
    let global_mult = params.global_multiplier;

    // 3. 执行乘法计算（使用千分之一精度）
    // 公式：base × (type/1000) × (influence/1000) × (verification/1000) × (reputation/1000) × (global/1000)
    let result = base_u128
        .saturating_mul(type_mult as u128)
        .saturating_mul(influence_mult as u128)
        .saturating_mul(verification_mult as u128)
        .saturating_mul(reputation_mult as u128)
        .saturating_mul(global_mult as u128)
        / 1_000_000_000_000_000u128; // 除以 1000^5 = 10^15

    // 4. 应用最小/最大限制
    if result < min_deposit_u128 {
        min_deposit_u128
    } else if result > max_deposit_u128 {
        max_deposit_u128
    } else {
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_type_multiplier() {
        assert_eq!(calculate_type_multiplier(&crate::works_types::WorkTypeCategory::Academic), 2000);
        assert_eq!(calculate_type_multiplier(&crate::works_types::WorkTypeCategory::Literature), 1500);
        assert_eq!(calculate_type_multiplier(&crate::works_types::WorkTypeCategory::Other), 500);
    }

    #[test]
    fn test_influence_multiplier() {
        assert_eq!(calculate_influence_multiplier(90), 3000);
        assert_eq!(calculate_influence_multiplier(70), 2000);
        assert_eq!(calculate_influence_multiplier(50), 1500);
        assert_eq!(calculate_influence_multiplier(30), 1200);
        assert_eq!(calculate_influence_multiplier(10), 1000);
    }

    #[test]
    fn test_verification_multiplier() {
        assert_eq!(calculate_verification_multiplier(true), 1500);
        assert_eq!(calculate_verification_multiplier(false), 800);
    }

    #[test]
    fn test_reputation_multiplier() {
        assert_eq!(calculate_reputation_multiplier(95), 500);
        assert_eq!(calculate_reputation_multiplier(80), 700);
        assert_eq!(calculate_reputation_multiplier(60), 1000);
        assert_eq!(calculate_reputation_multiplier(30), 1500);
        assert_eq!(calculate_reputation_multiplier(10), 2000);
    }

    #[test]
    fn test_base_deposit() {
        let deposit: u128 = calculate_base_deposit(1); // HIDE_WORK = 20 DUST
        assert_eq!(deposit, 20_000_000_000_000u128);

        let deposit: u128 = calculate_base_deposit(2); // DELETE_WORK = 50 DUST
        assert_eq!(deposit, 50_000_000_000_000u128);

        let deposit: u128 = calculate_base_deposit(7); // TRANSFER_OWNERSHIP = 100 DUST
        assert_eq!(deposit, 100_000_000_000_000u128);
    }

    #[test]
    fn test_calculate_work_deposit_high_influence_academic() {
        // 场景：高影响力学术论文删除
        let params = WorkDepositParams {
            work_id: 1,
            work_type: crate::works_types::WorkTypeCategory::Academic,
            influence_score: 90,
            is_verified: true,
            action: 2, // DELETE_WORK
            complainant_reputation: 50,
            global_multiplier: 1000,
        };

        let min_deposit: u128 = 5_000_000_000_000u128; // 5 DUST
        let max_deposit: u128 = 1000_000_000_000_000u128; // 1000 DUST

        let result: u128 = calculate_work_deposit_u128(&params, min_deposit, max_deposit);

        // 基础50 × 2.0(类型) × 3.0(影响力) × 1.5(验证) × 1.0(信誉) × 1.0(全局) = 450 DUST
        assert_eq!(result, 450_000_000_000_000u128);
    }

    #[test]
    fn test_calculate_work_deposit_low_influence_other() {
        // 场景：低影响力其他作品隐藏
        let params = WorkDepositParams {
            work_id: 2,
            work_type: crate::works_types::WorkTypeCategory::Other,
            influence_score: 10,
            is_verified: false,
            action: 1, // HIDE_WORK
            complainant_reputation: 50,
            global_multiplier: 1000,
        };

        let min_deposit: u128 = 5_000_000_000_000u128;
        let max_deposit: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min_deposit, max_deposit);

        // 基础20 × 0.5(类型) × 1.0(影响力) × 0.8(未验证) × 1.0(信誉) × 1.0(全局) = 8 DUST
        assert_eq!(result, 8_000_000_000_000u128);
    }

    #[test]
    fn test_calculate_work_deposit_with_min_cap() {
        // 场景：计算结果低于最小押金
        let params = WorkDepositParams {
            work_id: 3,
            work_type: crate::works_types::WorkTypeCategory::SocialMedia,
            influence_score: 5,
            is_verified: false,
            action: 5, // CHANGE_PRIVACY = 10 DUST base
            complainant_reputation: 95, // 高信誉，0.5倍
            global_multiplier: 1000,
        };

        let min_deposit: u128 = 5_000_000_000_000u128;
        let max_deposit: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min_deposit, max_deposit);

        // 基础10 × 0.8 × 1.0 × 0.8 × 0.5 × 1.0 = 3.2 DUST
        // 但应用最小押金限制，结果为5 DUST
        assert_eq!(result, min_deposit);
    }
}
