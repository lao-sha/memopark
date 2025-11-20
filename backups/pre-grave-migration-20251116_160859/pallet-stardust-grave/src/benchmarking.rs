//! 主逝者功能基准测试
//!
//! 功能说明：
//! 1. 测试 set_primary_deceased 函数的执行时间
//! 2. 生成准确的权重值替换零权重
//! 3. 考虑不同参数下的性能差异
//! 4. 提供权重计算的数据依据
//!
//! 创建日期：2025-11-10

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use crate::pallet::{Pallet, Config, Grave, IntermentRecord, Graves, Interments, GraveAdmins, PrimaryDeceasedOf};
use frame_benchmarking::{
    account, benchmarks, impl_benchmark_test_suite,
};
use frame_support::{
    assert_ok,
    BoundedVec,
};
use frame_system::RawOrigin;
use alloc::vec::Vec;

// ================================
// 基准测试辅助函数
// ================================

/// 创建测试账户
fn create_funded_user<T: Config>(
    seed: &'static str,
    n: u32,
) -> T::AccountId {
    let user = account(seed, n, 0);
    // 在实际场景中，这里应该给账户添加足够的余额
    user
}

/// 创建测试墓位
fn create_test_grave<T: Config>(
    owner: &T::AccountId,
    grave_id: u64,
) -> Result<(), &'static str> {
    let name: BoundedVec<u8, T::MaxCidLen> =
        b"benchmark_grave".to_vec().try_into().map_err(|_| "name too long")?;

    let grave = Grave {
        park_id: None,
        owner: owner.clone(),
        admin_group: None,
        name,
        deceased_tokens: BoundedVec::default(),
        is_public: true,
        active: true,
    };

    Graves::<T>::insert(grave_id, grave);

    Ok(())
}

/// 添加测试安葬记录
fn add_test_interment<T: Config>(
    grave_id: u64,
    deceased_id: u64,
    slot: u16,
) {
    let record = IntermentRecord {
        deceased_id,
        slot,
        time: frame_system::Pallet::<T>::block_number(),
        note_cid: None,
    };

    let mut interments = Interments::<T>::get(grave_id);
    let _ = interments.try_push(record);
    Interments::<T>::insert(grave_id, interments);
}

/// 添加墓位管理员
fn add_grave_admin<T: Config>(
    grave_id: u64,
    admin: &T::AccountId,
) {
    let mut admins = GraveAdmins::<T>::get(grave_id);
    let _ = admins.try_push(admin.clone());
    GraveAdmins::<T>::insert(grave_id, admins);
}

// ================================
// 基准测试定义
// ================================

benchmarks! {
    // ================================
    // 基准测试：设置主逝者（空墓位到首次设置）
    // ================================
    set_primary_deceased_first_time {
        let caller: T::AccountId = create_funded_user::<T>("caller", 0);
        let grave_id = 1u64;
        let deceased_id = 100u64;

        // 设置初始状态
        create_test_grave::<T>(&caller, grave_id)?;
        add_test_interment::<T>(grave_id, deceased_id, 1);

        // 确保没有设置主逝者
        assert!(PrimaryDeceasedOf::<T>::get(grave_id).is_none());

    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, Some(deceased_id))
    verify {
        assert_eq!(PrimaryDeceasedOf::<T>::get(grave_id), Some(deceased_id));
    }

    // ================================
    // 基准测试：切换主逝者（已有主逝者的情况下）
    // ================================
    set_primary_deceased_switch {
        let caller: T::AccountId = create_funded_user::<T>("caller", 0);
        let grave_id = 2u64;
        let old_deceased_id = 100u64;
        let new_deceased_id = 200u64;

        // 设置初始状态
        create_test_grave::<T>(&caller, grave_id)?;
        add_test_interment::<T>(grave_id, old_deceased_id, 1);
        add_test_interment::<T>(grave_id, new_deceased_id, 2);

        // 先设置一个主逝者
        PrimaryDeceasedOf::<T>::insert(grave_id, old_deceased_id);

    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, Some(new_deceased_id))
    verify {
        assert_eq!(PrimaryDeceasedOf::<T>::get(grave_id), Some(new_deceased_id));
    }

    // ================================
    // 基准测试：清除主逝者
    // ================================
    set_primary_deceased_clear {
        let caller: T::AccountId = create_funded_user::<T>("caller", 0);
        let grave_id = 3u64;
        let deceased_id = 100u64;

        // 设置初始状态
        create_test_grave::<T>(&caller, grave_id)?;
        add_test_interment::<T>(grave_id, deceased_id, 1);
        PrimaryDeceasedOf::<T>::insert(grave_id, deceased_id);

    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, None)
    verify {
        assert!(PrimaryDeceasedOf::<T>::get(grave_id).is_none());
    }

    // ================================
    // 基准测试：管理员操作（权限检查开销）
    // ================================
    set_primary_deceased_by_admin {
        let owner: T::AccountId = create_funded_user::<T>("owner", 0);
        let admin: T::AccountId = create_funded_user::<T>("admin", 1);
        let grave_id = 4u64;
        let deceased_id = 100u64;

        // 设置初始状态
        create_test_grave::<T>(&owner, grave_id)?;
        add_test_interment::<T>(grave_id, deceased_id, 1);
        add_grave_admin::<T>(grave_id, &admin);

    }: set_primary_deceased(RawOrigin::Signed(admin), grave_id, Some(deceased_id))
    verify {
        assert_eq!(PrimaryDeceasedOf::<T>::get(grave_id), Some(deceased_id));
    }

    // ================================
    // 基准测试：大量安葬记录场景下的性能
    // ================================
    set_primary_deceased_many_interments {
        // 测试安葬记录数量对性能的影响
        let i in 1 .. 100; // 安葬记录数量从1到100

        let caller: T::AccountId = create_funded_user::<T>("caller", 0);
        let grave_id = 5u64;
        let mut target_deceased_id = (i as u64) / 2; // 选择中间的逝者作为目标

        // 设置初始状态
        create_test_grave::<T>(&caller, grave_id)?;

        // 添加多个安葬记录
        for j in 0..i {
            add_test_interment::<T>(grave_id, j as u64, j as u16 + 1);
        }

        // 确保目标逝者存在
        if target_deceased_id == 0 {
            target_deceased_id = 1;
        }

    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, Some(target_deceased_id))
    verify {
        assert_eq!(PrimaryDeceasedOf::<T>::get(grave_id), Some(target_deceased_id));
    }

    // ================================
    // 基准测试：多个管理员场景下的权限检查
    // ================================
    set_primary_deceased_many_admins {
        // 测试管理员数量对权限检查性能的影响
        let a in 1 .. 10; // 管理员数量从1到10

        let owner: T::AccountId = create_funded_user::<T>("owner", 0);
        let caller: T::AccountId = create_funded_user::<T>("admin", (a - 1) as u32);
        let grave_id = 6u64;
        let deceased_id = 100u64;

        // 设置初始状态
        create_test_grave::<T>(&owner, grave_id)?;
        add_test_interment::<T>(grave_id, deceased_id, 1);

        // 添加多个管理员
        for j in 0..a {
            let admin: T::AccountId = create_funded_user::<T>("admin", j as u32);
            add_grave_admin::<T>(grave_id, &admin);
        }

    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, Some(deceased_id))
    verify {
        assert_eq!(PrimaryDeceasedOf::<T>::get(grave_id), Some(deceased_id));
    }

    // ================================
    // 基准测试：重复操作（幂等性测试）
    // ================================
    set_primary_deceased_idempotent {
        let caller: T::AccountId = create_funded_user::<T>("caller", 0);
        let grave_id = 7u64;
        let deceased_id = 100u64;

        // 设置初始状态
        create_test_grave::<T>(&caller, grave_id)?;
        add_test_interment::<T>(grave_id, deceased_id, 1);

        // 预先设置主逝者
        PrimaryDeceasedOf::<T>::insert(grave_id, deceased_id);

        // 测试重复设置相同主逝者的性能
    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, Some(deceased_id))
    verify {
        assert_eq!(PrimaryDeceasedOf::<T>::get(grave_id), Some(deceased_id));
    }

    // ================================
    // 基准测试：清除不存在的主逝者（幂等性）
    // ================================
    set_primary_deceased_clear_empty {
        let caller: T::AccountId = create_funded_user::<T>("caller", 0);
        let grave_id = 8u64;

        // 设置初始状态（没有主逝者）
        create_test_grave::<T>(&caller, grave_id)?;
        assert!(PrimaryDeceasedOf::<T>::get(grave_id).is_none());

    }: set_primary_deceased(RawOrigin::Signed(caller), grave_id, None)
    verify {
        assert!(PrimaryDeceasedOf::<T>::get(grave_id).is_none());
    }
}

// ================================
// 测试套件实现
// ================================

impl_benchmark_test_suite!(
    Pallet,
    crate::mock::new_test_ext(),
    crate::mock::Test,
);

// ================================
// 权重生成指导
// ================================

/*
基于基准测试结果的权重计算指导：

1. **基础权重组成**：
   - 数据库读取：检查墓位存在、获取安葬记录、检查管理员权限
   - 数据库写入：设置或清除主逝者
   - 计算开销：权限验证、安葬记录遍历

2. **预期性能特征**：
   - **set_primary_deceased_first_time**: 基线性能，最简单场景
   - **set_primary_deceased_switch**: 应与首次设置性能相似
   - **set_primary_deceased_clear**: 略低于设置操作（少一次验证）
   - **set_primary_deceased_by_admin**: 额外的管理员检查开销
   - **set_primary_deceased_many_interments**: 线性增长（O(n)遍历）
   - **set_primary_deceased_many_admins**: 线性增长（O(n)管理员检查）

3. **权重计算公式**（基于基准测试结果）：
   ```rust
   fn set_primary_deceased() -> Weight {
       // 基础权重（最小场景）
       let base_weight = Weight::from_parts(15_000, 0);

       // 数据库操作权重
       let db_weight = T::DbWeight::get().reads(3).saturating_add(T::DbWeight::get().writes(1));

       // 返回总权重
       base_weight.saturating_add(db_weight)
   }
   ```

4. **动态权重考虑**（未来优化）：
   ```rust
   fn set_primary_deceased_dynamic(interment_count: u32, admin_count: u32) -> Weight {
       let base = Weight::from_parts(15_000, 0);
       let db_base = T::DbWeight::get().reads(3).saturating_add(T::DbWeight::get().writes(1));

       // 安葬记录线性扫描开销
       let interment_overhead = Weight::from_parts(500, 0).saturating_mul(interment_count as u64);

       // 管理员权限检查开销
       let admin_overhead = Weight::from_parts(200, 0).saturating_mul(admin_count as u64);

       base.saturating_add(db_base)
           .saturating_add(interment_overhead)
           .saturating_add(admin_overhead)
   }
   ```

5. **实际使用建议**：
   - 使用基础权重公式作为默认实现
   - 根据基准测试结果调整 base_weight 数值
   - 监控实际使用中的性能表现
   - 如有需要，考虑实现动态权重计算

6. **基准测试运行命令**：
   ```bash
   # 运行主逝者功能基准测试
   cargo run --release --features=runtime-benchmarks --bin node-template benchmark pallet \
       --chain=dev \
       --execution=wasm \
       --wasm-execution=compiled \
       --pallet=pallet_stardust_grave \
       --extrinsic=set_primary_deceased \
       --steps=50 \
       --repeat=20 \
       --output=./pallets/stardust-grave/src/weights.rs
   ```

7. **权重验证**：
   - 确保权重值合理（不过高也不过低）
   - 在测试网络中验证实际性能
   - 监控区块生成时间和资源使用
   - 根据实际使用调整权重参数
*/