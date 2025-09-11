//! 权重接口占位：后续通过 `frame-benchmarking` 生成
// 注意：该文件为模块文件，不能在此使用 crate 级属性。

use frame_support::weights::Weight;

/// 函数级中文注释：权重信息接口，供 pallet 外部类型提供具体实现。
pub trait WeightInfo {
    /// 创建墓地
    fn create_grave() -> Weight;
    /// 设置园区
    fn set_park() -> Weight;
    /// 更新墓地
    fn update_grave() -> Weight;
    /// 转让
    fn transfer_grave() -> Weight;
    /// 安葬
    fn inter() -> Weight;
    /// 起掘
    fn exhume() -> Weight;
    /// 设置扩展元
    fn set_meta() -> Weight;
    /// 投诉
    fn complain() -> Weight;
    /// 限制
    fn restrict() -> Weight;
    /// 移除
    fn remove() -> Weight;
    /// 名称哈希设置/清除
    fn set_name_hash() -> Weight;
    fn clear_name_hash() -> Weight;
    /// 管理员增删
    fn add_admin() -> Weight;
    fn remove_admin() -> Weight;
    /// 策略
    fn set_policy() -> Weight;
    /// 成员加入/申请/审核
    fn join_open() -> Weight;
    fn apply_join() -> Weight;
    fn approve_member() -> Weight;
    fn reject_member() -> Weight;
    /// 可见性/关注
    fn set_visibility() -> Weight;
    fn follow() -> Weight;
    fn unfollow() -> Weight;
    /// 亲属关系策略与操作
    fn set_kinship_policy() -> Weight;
    fn declare_kinship() -> Weight;
    fn approve_kinship() -> Weight;
    fn reject_kinship() -> Weight;
    fn update_kinship() -> Weight;
    fn remove_kinship() -> Weight;
}

/// 函数级中文注释：未基准化前的兜底实现，全部返回零权重。
pub struct TestWeights;
impl WeightInfo for TestWeights {
    fn create_grave() -> Weight { Weight::zero() }
    fn set_park() -> Weight { Weight::zero() }
    fn update_grave() -> Weight { Weight::zero() }
    fn transfer_grave() -> Weight { Weight::zero() }
    fn inter() -> Weight { Weight::zero() }
    fn exhume() -> Weight { Weight::zero() }
    fn set_meta() -> Weight { Weight::zero() }
    fn complain() -> Weight { Weight::zero() }
    fn restrict() -> Weight { Weight::zero() }
    fn remove() -> Weight { Weight::zero() }
    fn set_name_hash() -> Weight { Weight::zero() }
    fn clear_name_hash() -> Weight { Weight::zero() }
    fn add_admin() -> Weight { Weight::zero() }
    fn remove_admin() -> Weight { Weight::zero() }
    fn set_policy() -> Weight { Weight::zero() }
    fn join_open() -> Weight { Weight::zero() }
    fn apply_join() -> Weight { Weight::zero() }
    fn approve_member() -> Weight { Weight::zero() }
    fn reject_member() -> Weight { Weight::zero() }
    fn set_visibility() -> Weight { Weight::zero() }
    fn follow() -> Weight { Weight::zero() }
    fn unfollow() -> Weight { Weight::zero() }
    fn set_kinship_policy() -> Weight { Weight::zero() }
    fn declare_kinship() -> Weight { Weight::zero() }
    fn approve_kinship() -> Weight { Weight::zero() }
    fn reject_kinship() -> Weight { Weight::zero() }
    fn update_kinship() -> Weight { Weight::zero() }
    fn remove_kinship() -> Weight { Weight::zero() }
}


