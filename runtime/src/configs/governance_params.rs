// 函数级详细中文注释：pallet-governance-params 配置
//
// ## 功能说明
// - 集中管理所有治理参数
// - 提供统一的参数查询接口
// - 支持治理投票调整参数

use super::*;

// 函数级中文注释：pallet-governance-params Runtime配置
impl pallet_governance_params::Config for Runtime {
    type Currency = Balances;

    /// 函数级中文注释：治理起源 - 只有Root或委员会2/3多数可以修改参数
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;

    /// 函数级详细中文注释：权重信息
    /// - 使用()占位实现（固定权重10_000）
    /// - 生产环境应该通过benchmark生成实际权重
    type WeightInfo = ();
}
