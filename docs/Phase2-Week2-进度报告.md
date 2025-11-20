# Phase 2 Week 2 进度报告

> **开始日期**: 2025-10-25  
> **当前状态**: Day 1-2 完成 (40%)  
> **下一步**: Day 3-5 (迁移押金逻辑)

---

## ✅ 已完成任务 (2/5)

### Task 1: ✅ 添加pallet-deposits依赖

**文件**: `pallets/stardust-appeals/Cargo.toml`

**修改**:
```toml
[dependencies]
pallet-deposits = { path = "../deposits", default-features = false }

[features]
std = [
  "pallet-deposits/std",
]
```

**验证**: ✅ Cargo.toml更新完成

---

### Task 2: ✅ 修改Appeal结构

**文件**: `pallets/stardust-appeals/src/lib.rs`

**修改前**:
```rust
pub struct Appeal<AccountId, Balance, BlockNumber> {
    pub deposit: Balance,
    // ...
}
```

**修改后**:
```rust
pub struct Appeal<AccountId, Balance, BlockNumber> {
    /// 押金ID（Phase 2：使用pallet-deposits统一管理）
    pub deposit_id: Option<u64>,
    /// 旧押金字段（Phase 2清理阶段将移除）
    #[deprecated(note = "Use deposit_id instead")]
    pub deposit: Balance,
    // ...
}
```

**策略**:
- ✅ 新增 `deposit_id: Option<u64>`
- ✅ 保留 `deposit: Balance` 标记为deprecated
- ✅ 渐进式迁移，清理阶段移除旧字段

**验证**: ✅ 结构更新完成

---

### Task 3: ✅ 添加DepositManager到Config

**文件**: `pallets/stardust-appeals/src/lib.rs`

**修改**:
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    /// 货币类型（DUST）- 将在清理阶段移除
    type Currency: Currency<Self::AccountId> + ReservableCurrency<Self::AccountId>;
    /// 押金管理器（Phase 2新增）
    type DepositManager: pallet_deposits::DepositManager<
        Self::AccountId, 
        <Self::Currency as Currency<Self::AccountId>>::Balance
    >;
    // ...
}
```

**验证**: ✅ Config更新完成

---

## 📋 待完成任务 (3/5)

### Task 4: ⏳ 迁移submit_appeal使用deposits

**目标**:
- 修改 `submit_appeal` extrinsic
- 使用 `T::DepositManager::reserve_deposit()` 替代 `T::Currency::reserve()`
- 将返回的 `deposit_id` 存储到 `Appeal.deposit_id`
- 保留 `deposit` 字段填充（用于兼容）

**预计行数**: ~20行修改

---

### Task 5: ⏳ 迁移approve/execute使用deposits

**目标**:
- 修改 `execute_approved` 函数
- 执行成功时使用 `T::DepositManager::release_deposit()`
- 替代 `T::Currency::unreserve()`
- 处理Option<deposit_id>

**预计行数**: ~15行修改

---

### Task 6: ⏳ 迁移reject/withdraw使用deposits

**目标**:
- 修改 `reject_appeal` extrinsic
- 修改 `withdraw_appeal` extrinsic
- 使用 `T::DepositManager::slash_deposit()` 
- 替代手动罚没逻辑
- 处理罚没比例（30%/10%）

**预计行数**: ~30行修改

---

### Task 7: ⏳ 清理旧押金代码

**目标**:
- 移除 `type Currency` 依赖（可选，Week 3执行）
- 移除 `deposit: Balance` 字段（破坏式变更）
- 移除 `AppealDeposit` constant
- 更新所有测试
- 更新Runtime配置

**预计行数**: ~50行删除

---

## 📊 进度概览

```
Phase 2 Week 2 进度:
███████████░░░░░░░░░ 40% (2/5 任务完成)

✅ Day 1-2: 依赖 + 结构  (100%)
⏳ Day 3: submit_appeal   (0%)
⏳ Day 4: approve/reject  (0%)
⏳ Day 5: 清理旧代码      (0%)
```

### 时间估算

| 任务 | 预计时间 | 状态 |
|------|---------|------|
| ✅ 添加依赖 | 5分钟 | 完成 |
| ✅ 修改结构 | 10分钟 | 完成 |
| ✅ 添加Config | 5分钟 | 完成 |
| ⏳ 迁移submit | 30分钟 | 待开始 |
| ⏳ 迁移approve | 20分钟 | 待开始 |
| ⏳ 迁移reject/withdraw | 25分钟 | 待开始 |
| ⏳ 清理旧代码 | 40分钟 | 待开始 |
| **总计** | **~135分钟** | **20分钟完成** |

---

## 🎯 下一步行动

### 立即执行（建议）

继续完成Week 2剩余任务：

```bash
# 1. 迁移submit_appeal
修改: submit_appeal extrinsic
使用: DepositManager::reserve_deposit()

# 2. 迁移execute_approved
修改: execute_approved 函数
使用: DepositManager::release_deposit()

# 3. 迁移reject/withdraw
修改: reject_appeal, withdraw_appeal
使用: DepositManager::slash_deposit()

# 4. 清理旧代码
移除: Currency依赖, deposit字段
更新: Tests, Runtime配置

# 5. 编译验证
cargo check -p pallet-stardust-appeals
cargo check -p stardust-runtime
cargo test -p pallet-stardust-appeals
```

### 或者分阶段执行

1. **今天**: 完成Task 4-5（迁移submit + approve）
2. **明天**: 完成Task 6-7（迁移reject + 清理）
3. **后天**: Week 3测试和优化

---

## 📝 技术注意事项

### 1. DepositPurpose选择

```rust
// submit_appeal时
let deposit_id = T::DepositManager::reserve_deposit(
    &who,
    amount,
    DepositPurpose::Appeal,  // 使用Appeal类型
)?;
```

### 2. Option<deposit_id>处理

```rust
// 释放押金时需要检查
if let Some(deposit_id) = appeal.deposit_id {
    T::DepositManager::release_deposit(deposit_id)?;
} else {
    // 回退到旧逻辑（兼容期）
    T::Currency::unreserve(&appeal.who, appeal.deposit);
}
```

### 3. 罚没比例传递

```rust
// reject时30%罚没
let slash_percent = T::RejectedSlashBps::get();  // 3000 = 30%
let slash_amount = Perbill::from_parts(slash_percent as u32 * 100_000)
    .mul_floor(amount);

T::DepositManager::slash_deposit(deposit_id, slash_amount)?;
```

---

## 🔗 相关文档

- [Phase2-开发方案](./Phase2-开发方案.md) - Week 2详细计划
- [Phase2-快速开始](./Phase2-快速开始.md) - Week 2操作指南
- [pallet-deposits README](../pallets/deposits/README.md) - 押金模块文档
- [DepositManager Trait](../pallets/deposits/src/lib.rs) - Trait接口定义

---

**更新时间**: 2025-10-25  
**完成度**: 40% (2/5)  
**状态**: ✅ 进展顺利  
**建议**: 继续执行剩余任务

