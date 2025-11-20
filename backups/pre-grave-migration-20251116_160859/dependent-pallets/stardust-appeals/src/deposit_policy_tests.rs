//! # 差异化押金计算集成测试
//!
//! 测试阶段2的差异化押金机制

#[cfg(test)]
mod deposit_integration_tests {
    use crate::deposit_policy::*;
    use crate::works_types::WorkTypeCategory;

    /// 测试基础类型系数计算
    #[test]
    fn test_type_multipliers_coverage() {
        // 验证所有8种作品类型都有正确的系数
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Academic), 2000); // 最高
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Literature), 1500);
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Audio), 1500);
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Code), 1300);
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Video), 1200);
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Visual), 1000); // 标准
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::SocialMedia), 800);
        assert_eq!(calculate_type_multiplier(&WorkTypeCategory::Other), 500); // 最低
    }

    /// 测试影响力评分边界
    #[test]
    fn test_influence_multiplier_boundaries() {
        // 测试边界值
        assert_eq!(calculate_influence_multiplier(100), 3000); // 最高
        assert_eq!(calculate_influence_multiplier(80), 3000);  // 高影响力下界
        assert_eq!(calculate_influence_multiplier(79), 2000);  // 跨越边界
        assert_eq!(calculate_influence_multiplier(60), 2000);  // 中等上界
        assert_eq!(calculate_influence_multiplier(59), 1500);
        assert_eq!(calculate_influence_multiplier(40), 1500);  // 一般上界
        assert_eq!(calculate_influence_multiplier(39), 1200);
        assert_eq!(calculate_influence_multiplier(20), 1200);  // 较低上界
        assert_eq!(calculate_influence_multiplier(19), 1000);
        assert_eq!(calculate_influence_multiplier(0), 1000);   // 最低
    }

    /// 测试信誉系数边界
    #[test]
    fn test_reputation_multiplier_boundaries() {
        // 测试边界值
        assert_eq!(calculate_reputation_multiplier(100), 500); // 最优折扣
        assert_eq!(calculate_reputation_multiplier(90), 500);  // 高信誉下界
        assert_eq!(calculate_reputation_multiplier(89), 700);  // 跨越边界
        assert_eq!(calculate_reputation_multiplier(70), 700);  // 中等上界
        assert_eq!(calculate_reputation_multiplier(69), 1000);
        assert_eq!(calculate_reputation_multiplier(50), 1000); // 标准
        assert_eq!(calculate_reputation_multiplier(49), 1500);
        assert_eq!(calculate_reputation_multiplier(20), 1500); // 低信誉上界
        assert_eq!(calculate_reputation_multiplier(19), 2000);
        assert_eq!(calculate_reputation_multiplier(0), 2000);  // 最严厉
    }

    /// 测试基础押金表
    #[test]
    fn test_base_deposit_actions() {
        // 操作1：隐藏作品 = 20 DUST
        let deposit: u128 = calculate_base_deposit(1);
        assert_eq!(deposit, 20_000_000_000_000u128);

        // 操作2：删除作品 = 50 DUST（较严重）
        let deposit: u128 = calculate_base_deposit(2);
        assert_eq!(deposit, 50_000_000_000_000u128);

        // 操作3：撤销AI训练 = 15 DUST
        let deposit: u128 = calculate_base_deposit(3);
        assert_eq!(deposit, 15_000_000_000_000u128);

        // 操作4：取消验证 = 30 DUST
        let deposit: u128 = calculate_base_deposit(4);
        assert_eq!(deposit, 30_000_000_000_000u128);

        // 操作5：修改隐私 = 10 DUST（最低）
        let deposit: u128 = calculate_base_deposit(5);
        assert_eq!(deposit, 10_000_000_000_000u128);

        // 操作6：标记违规 = 25 DUST
        let deposit: u128 = calculate_base_deposit(6);
        assert_eq!(deposit, 25_000_000_000_000u128);

        // 操作7：转移所有权 = 100 DUST（最严重）
        let deposit: u128 = calculate_base_deposit(7);
        assert_eq!(deposit, 100_000_000_000_000u128);

        // 操作8：冻结作品 = 40 DUST
        let deposit: u128 = calculate_base_deposit(8);
        assert_eq!(deposit, 40_000_000_000_000u128);

        // 未知操作 = 20 DUST（默认）
        let deposit: u128 = calculate_base_deposit(99);
        assert_eq!(deposit, 20_000_000_000_000u128);
    }

    /// 测试场景1：高信誉用户投诉低影响力社交媒体作品
    #[test]
    fn test_scenario_high_reputation_low_influence() {
        let params = WorkDepositParams {
            work_id: 1,
            work_type: WorkTypeCategory::SocialMedia,
            influence_score: 10,
            is_verified: false,
            action: 1, // HIDE_WORK = 20 DUST
            complainant_reputation: 95, // 高信誉 0.5x
            global_multiplier: 1000, // 标准
        };

        let min: u128 = 5_000_000_000_000u128; // 5 DUST
        let max: u128 = 1000_000_000_000_000u128; // 1000 DUST

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：20 × 0.8 × 1.0 × 0.8 × 0.5 × 1.0 = 6.4 DUST
        assert_eq!(result, 6_400_000_000_000u128);
    }

    /// 测试场景2：低信誉用户投诉高影响力学术论文
    #[test]
    fn test_scenario_low_reputation_high_influence() {
        let params = WorkDepositParams {
            work_id: 2,
            work_type: WorkTypeCategory::Academic,
            influence_score: 90,
            is_verified: true,
            action: 2, // DELETE_WORK = 50 DUST
            complainant_reputation: 15, // 低信誉 2.0x
            global_multiplier: 1000,
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：50 × 2.0 × 3.0 × 1.5 × 2.0 × 1.0 = 900 DUST
        assert_eq!(result, 900_000_000_000_000u128);
    }

    /// 测试场景3：触发上限保护
    #[test]
    fn test_scenario_max_cap() {
        let params = WorkDepositParams {
            work_id: 3,
            work_type: WorkTypeCategory::Academic,
            influence_score: 95,
            is_verified: true,
            action: 7, // TRANSFER_OWNERSHIP = 100 DUST
            complainant_reputation: 10, // 极低信誉 2.0x
            global_multiplier: 1500, // 治理提高门槛
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128; // 上限1000 DUST

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：100 × 2.0 × 3.0 × 1.5 × 2.0 × 1.5 = 2700 DUST
        // 但受限于max = 1000 DUST
        assert_eq!(result, max);
    }

    /// 测试场景4：触发下限保护
    #[test]
    fn test_scenario_min_cap() {
        let params = WorkDepositParams {
            work_id: 4,
            work_type: WorkTypeCategory::Other, // 0.5x
            influence_score: 5, // 1.0x
            is_verified: false, // 0.8x
            action: 5, // CHANGE_PRIVACY = 10 DUST
            complainant_reputation: 95, // 0.5x
            global_multiplier: 1000,
        };

        let min: u128 = 5_000_000_000_000u128; // 下限5 DUST
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：10 × 0.5 × 1.0 × 0.8 × 0.5 × 1.0 = 2 DUST
        // 但受限于min = 5 DUST
        assert_eq!(result, min);
    }

    /// 测试场景5：标准情况（所有系数1.0x）
    #[test]
    fn test_scenario_all_standard() {
        let params = WorkDepositParams {
            work_id: 5,
            work_type: WorkTypeCategory::Visual, // 1.0x
            influence_score: 50, // 1.5x
            is_verified: false, // 0.8x
            action: 1, // HIDE_WORK = 20 DUST
            complainant_reputation: 50, // 1.0x
            global_multiplier: 1000, // 1.0x
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：20 × 1.0 × 1.5 × 0.8 × 1.0 × 1.0 = 24 DUST
        assert_eq!(result, 24_000_000_000_000u128);
    }

    /// 测试场景6：全局乘数调整（DUST价格上涨）
    #[test]
    fn test_scenario_global_multiplier_low() {
        let params = WorkDepositParams {
            work_id: 6,
            work_type: WorkTypeCategory::Literature,
            influence_score: 60,
            is_verified: true,
            action: 2, // DELETE_WORK = 50 DUST
            complainant_reputation: 50,
            global_multiplier: 500, // 治理降低至0.5x（应对价格上涨）
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：50 × 1.5 × 2.0 × 1.5 × 1.0 × 0.5 = 112.5 DUST
        assert_eq!(result, 112_500_000_000_000u128);
    }

    /// 测试场景7：全局乘数调整（滥用投诉激增）
    #[test]
    fn test_scenario_global_multiplier_high() {
        let params = WorkDepositParams {
            work_id: 7,
            work_type: WorkTypeCategory::Code,
            influence_score: 40,
            is_verified: false,
            action: 1, // HIDE_WORK = 20 DUST
            complainant_reputation: 50,
            global_multiplier: 1500, // 治理提高至1.5x（应对滥用）
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：20 × 1.3 × 1.5 × 0.8 × 1.0 × 1.5 = 46.8 DUST
        assert_eq!(result, 46_800_000_000_000u128);
    }

    /// 测试场景8：已验证作品的投诉门槛
    #[test]
    fn test_scenario_verified_work() {
        let params_verified = WorkDepositParams {
            work_id: 8,
            work_type: WorkTypeCategory::Academic,
            influence_score: 70,
            is_verified: true, // 已验证 1.5x
            action: 4, // UNVERIFY_WORK = 30 DUST
            complainant_reputation: 50,
            global_multiplier: 1000,
        };

        let params_unverified = WorkDepositParams {
            is_verified: false, // 未验证 0.8x
            ..params_verified.clone()
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let verified_deposit: u128 = calculate_work_deposit_u128(&params_verified, min, max);
        let unverified_deposit: u128 = calculate_work_deposit_u128(&params_unverified, min, max);

        // 已验证：30 × 2.0 × 2.0 × 1.5 × 1.0 × 1.0 = 180 DUST
        assert_eq!(verified_deposit, 180_000_000_000_000u128);

        // 未验证：30 × 2.0 × 2.0 × 0.8 × 1.0 × 1.0 = 96 DUST
        assert_eq!(unverified_deposit, 96_000_000_000_000u128);

        // 验证倍率差异
        assert!(verified_deposit > unverified_deposit);
        assert_eq!(verified_deposit * 8 / 15, unverified_deposit); // 1.5 / 0.8 = 1.875x
    }

    /// 测试场景9：信誉梯度完整测试
    #[test]
    fn test_scenario_reputation_gradient() {
        let base_params = WorkDepositParams {
            work_id: 9,
            work_type: WorkTypeCategory::Visual,
            influence_score: 50,
            is_verified: true,
            action: 1, // HIDE_WORK = 20 DUST
            complainant_reputation: 50, // 将被覆盖
            global_multiplier: 1000,
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        // 测试5个信誉档位
        let reputations = vec![
            (95, 500),  // 高信誉 0.5x
            (80, 700),  // 中等 0.7x
            (60, 1000), // 一般 1.0x
            (30, 1500), // 低 1.5x
            (10, 2000), // 极低 2.0x
        ];

        let mut deposits = Vec::new();
        for (rep, expected_mult) in reputations {
            let params = WorkDepositParams {
                complainant_reputation: rep,
                ..base_params.clone()
            };
            let deposit: u128 = calculate_work_deposit_u128(&params, min, max);
            deposits.push(deposit);

            // 验证系数正确
            assert_eq!(calculate_reputation_multiplier(rep), expected_mult);
        }

        // 验证押金单调递增（信誉越低押金越高）
        for i in 0..deposits.len() - 1 {
            assert!(deposits[i] < deposits[i + 1], "押金应随信誉降低而增加");
        }
    }

    /// 测试场景10：极端组合（所有系数最大）
    #[test]
    fn test_scenario_all_max() {
        let params = WorkDepositParams {
            work_id: 10,
            work_type: WorkTypeCategory::Academic, // 2.0x
            influence_score: 100, // 3.0x
            is_verified: true, // 1.5x
            action: 7, // TRANSFER_OWNERSHIP = 100 DUST
            complainant_reputation: 0, // 2.0x
            global_multiplier: 10000, // 10.0x（理论最大）
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：100 × 2.0 × 3.0 × 1.5 × 2.0 × 10.0 = 18000 DUST
        // 但必须受限于max = 1000 DUST
        assert_eq!(result, max);
    }

    /// 测试场景11：极端组合（所有系数最小）
    #[test]
    fn test_scenario_all_min() {
        let params = WorkDepositParams {
            work_id: 11,
            work_type: WorkTypeCategory::Other, // 0.5x
            influence_score: 0, // 1.0x
            is_verified: false, // 0.8x
            action: 5, // CHANGE_PRIVACY = 10 DUST
            complainant_reputation: 100, // 0.5x
            global_multiplier: 100, // 0.1x（理论最小）
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = 1000_000_000_000_000u128;

        let result: u128 = calculate_work_deposit_u128(&params, min, max);

        // 计算：10 × 0.5 × 1.0 × 0.8 × 0.5 × 0.1 = 0.2 DUST
        // 但必须受限于min = 5 DUST
        assert_eq!(result, min);
    }

    /// 测试数值溢出保护
    #[test]
    fn test_no_overflow() {
        let params = WorkDepositParams {
            work_id: 12,
            work_type: WorkTypeCategory::Academic,
            influence_score: 100,
            is_verified: true,
            action: 7,
            complainant_reputation: 0,
            global_multiplier: 10000,
        };

        let min: u128 = 5_000_000_000_000u128;
        let max: u128 = u128::MAX; // 使用u128最大值测试溢出保护

        // 不应panic，应该返回max或合理值
        let result: u128 = calculate_work_deposit_u128(&params, min, max);
        assert!(result > 0);
        assert!(result <= max);
    }
}
