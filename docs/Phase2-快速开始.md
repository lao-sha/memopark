# Phase 2 快速开始指南

> **Phase 2目标**: 集成pallet-deposits到申诉治理流程  
> **预计耗时**: 3周  
> **详细方案**: [Phase2-开发方案.md](./Phase2-开发方案.md)

---

## 🚀 快速概览

### Phase 2 三步走

```
Week 1: 模块重命名
  ├─ pallet-memo-content-governance → pallet-stardust-appeals
  ├─ 更新所有配置和导入
  └─ 编译测试通过

Week 2: 集成pallet-deposits
  ├─ 修改Config添加DepositManager
  ├─ Appeal结构添加deposit_id
  ├─ 所有押金操作改用deposits模块
  └─ 清理旧押金代码

Week 3: 测试与优化
  ├─ 单元测试（覆盖率>90%）
  ├─ 集成测试（端到端）
  ├─ 性能优化
  └─ 文档更新
```

---

## ✅ 准备工作检查

### 前置条件

- [x] Phase 1已完成（pallet-deposits + 动态定价）
- [x] pallet-deposits编译通过
- [x] stardust-runtime编译通过
- [ ] 备份当前代码（git commit）
- [ ] 创建Phase 2开发分支

### 环境验证

```bash
# 1. 验证pallet-deposits
cargo check -p pallet-deposits
# 预期: ✅ Finished `dev` profile

# 2. 验证runtime
cargo check -p stardust-runtime
# 预期: ✅ Finished `dev` profile

# 3. 验证当前content-governance
cargo test -p pallet-memo-content-governance
# 预期: ✅ 所有测试通过

# 4. 创建开发分支
git checkout -b phase2-appeals-integration
git commit -am "Phase 2: 开始前检查点"
```

---

## 📅 Week 1: 模块重命名（5天）

### Day 1: 重命名目录和文件

```bash
cd /home/xiaodong/文档/stardust

# 1. 重命名pallet目录
mv pallets/memo-content-governance pallets/stardust-appeals

# 2. 更新package name
sed -i 's/pallet-memo-content-governance/pallet-stardust-appeals/g' \
    pallets/stardust-appeals/Cargo.toml

# 3. 更新workspace
sed -i 's/"pallets\/memo-content-governance"/"pallets\/stardust-appeals"/g' \
    Cargo.toml
```

### Day 2: 更新Runtime配置

**修改 `runtime/Cargo.toml`**:
```toml
# 第1步: 修改dependencies
pallet-stardust-appeals = { path = "../pallets/stardust-appeals", default-features = false }

# 第2步: 修改features.std
std = [
    # ...
    "pallet-stardust-appeals/std",
    # ...
]
```

**修改 `runtime/src/lib.rs`**:
```rust
// 可选：保持ContentGovernance别名（向后兼容）
#[runtime::pallet_index(41)]
pub type ContentGovernance = pallet_memo_appeals;

// 或者：使用新名称
// pub type Appeals = pallet_memo_appeals;
```

**修改 `runtime/src/configs/mod.rs`**:
```rust
impl pallet_memo_appeals::Config for Runtime {
    // ... 配置保持不变 ...
}

// Router实现
impl pallet_memo_appeals::AppealRouter for ContentGovernanceRouter {
    // ... 实现保持不变 ...
}
```

### Day 3: 验证编译

```bash
# 编译检查
cargo check -p pallet-stardust-appeals
cargo check -p stardust-runtime

# 单元测试
cargo test -p pallet-stardust-appeals

# 预期: ✅ 全部通过
```

### Day 4-5: 更新文档

- [ ] `pallets/stardust-appeals/README.md`
- [ ] `docs/MIGRATION-ContentGovernance-to-Appeals.md`
- [ ] `pallets接口文档.md`
- [ ] 所有提及旧名称的文档

**Week 1 完成标志**: 
```bash
git add .
git commit -m "Phase 2 Week 1: 模块重命名完成"
git push origin phase2-appeals-integration
```

---

## 📅 Week 2: 集成pallet-deposits（5天）

### Day 1: 修改Config和数据结构

**Step 1: 添加Cargo依赖**

`pallets/stardust-appeals/Cargo.toml`:
```toml
[dependencies]
# 新增
pallet-deposits = { path = "../deposits", default-features = false }

[features]
std = [
    # ...
    "pallet-deposits/std",
]
```

**Step 2: 修改Config**

`pallets/stardust-appeals/src/lib.rs`:
```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    // ... 现有配置 ...
    
    /// 押金管理器
    type DepositManager: pallet_deposits::DepositManager<
        Self::AccountId,
        BalanceOf<Self>,
    >;
    
    /// 押金受益人（罚没接收账户）
    type DepositBeneficiary: Get<Self::AccountId>;
    
    // ❌ 删除旧配置
    // type AppealDeposit: Get<BalanceOf<Self>>;
}
```

**Step 3: 修改Appeal结构**

```rust
pub struct Appeal<AccountId, BlockNumber> {
    pub who: AccountId,
    pub domain: u8,
    pub target: u64,
    pub action: u8,
    pub reason_cid: BoundedVec<u8, ConstU32<128>>,
    pub evidence_cid: BoundedVec<u8, ConstU32<128>>,
    
    pub deposit_id: u64,  // ✅ 新增：替代deposit字段
    
    pub status: u8,
    pub execute_at: Option<BlockNumber>,
    pub approved_at: Option<BlockNumber>,
    pub new_owner: Option<AccountId>,
}
```

### Day 2-3: 迁移押金逻辑

**修改 `submit_appeal`**:
```rust
pub fn submit_appeal(...) -> DispatchResult {
    let who = ensure_signed(origin)?;
    
    // 计算押金
    let deposit_amount = T::AppealDepositPolicy::calc_deposit(&who, domain, target, action)
        .unwrap_or(100 * UNIT);  // 回退值
    
    // 冻结押金（使用deposits模块）
    let deposit_id = T::DepositManager::reserve(
        &who,
        deposit_amount,
        pallet_deposits::DepositPurpose::Appeal {
            appeal_id: 0,
            domain,
            target,
            action,
        },
    )?;
    
    // 创建申诉
    let appeal = Appeal {
        // ...
        deposit_id,  // ✅ 使用新字段
        // ...
    };
    
    Appeals::<T>::insert(appeal_id, appeal);
    Ok(())
}
```

**修改 `approve_appeal` 和执行逻辑**:
```rust
// 执行成功后释放押金
fn execute_appeal(appeal_id: u64) -> DispatchResult {
    // ... 执行逻辑 ...
    
    if execution_success {
        // 释放押金
        T::DepositManager::release(appeal.deposit_id)?;
    }
    
    Ok(())
}
```

**修改 `reject_appeal`**:
```rust
pub fn reject_appeal(origin: OriginFor<T>, appeal_id: u64) -> DispatchResult {
    // ... 验证逻辑 ...
    
    // 罚没30%
    T::DepositManager::slash(
        appeal.deposit_id,
        Perbill::from_percent(30),
        T::DepositBeneficiary::get(),
    )?;
    
    Ok(())
}
```

**修改 `withdraw_appeal`**:
```rust
pub fn withdraw_appeal(origin: OriginFor<T>, appeal_id: u64) -> DispatchResult {
    // ... 验证逻辑 ...
    
    // 罚没10%
    T::DepositManager::slash(
        appeal.deposit_id,
        Perbill::from_percent(10),
        T::DepositBeneficiary::get(),
    )?;
    
    Ok(())
}
```

### Day 4: 更新Runtime配置

`runtime/src/configs/mod.rs`:
```rust
impl pallet_memo_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    
    // ✅ 新增
    type DepositManager = pallet_deposits::Pallet<Runtime>;
    type DepositBeneficiary = TreasuryAccount;
    
    // 保留其他配置
    type AppealDepositPolicy = ContentAppealDepositPolicy;
    type Router = ContentGovernanceRouter;
    // ...
}
```

### Day 5: 清理和验证

```bash
# 1. 搜索旧押金代码
rg "T::Currency::reserve" pallets/stardust-appeals/
rg "T::Currency::unreserve" pallets/stardust-appeals/
# 预期: 无结果（已清理）

# 2. 编译检查
cargo check -p pallet-stardust-appeals
cargo check -p stardust-runtime

# 3. 单元测试
cargo test -p pallet-stardust-appeals

# 预期: ✅ 全部通过
```

**Week 2 完成标志**:
```bash
git add .
git commit -m "Phase 2 Week 2: deposits集成完成"
```

---

## 📅 Week 3: 测试与优化（5天）

### Day 1-2: 单元测试

```rust
// 关键测试用例
#[test]
fn test_submit_appeal_with_deposits() {
    // 验证：调用deposits.reserve
    // 验证：deposit_id正确存储
}

#[test]
fn test_approve_and_execute_releases_deposit() {
    // 验证：执行成功后调用deposits.release
}

#[test]
fn test_reject_slashes_30_percent() {
    // 验证：罚没30%，退回70%
}

#[test]
fn test_withdraw_slashes_10_percent() {
    // 验证：罚没10%，退回90%
}
```

运行测试：
```bash
cargo test -p pallet-stardust-appeals -- --nocapture
```

### Day 3-4: 集成测试

```bash
# 端到端测试脚本
./scripts/integration-test-phase2.sh
```

测试场景：
1. ✅ 完整申诉流程（提交→批准→执行→释放）
2. ✅ 驳回流程（提交→驳回→罚没30%）
3. ✅ 撤回流程（提交→撤回→罚没10%）
4. ✅ 动态定价（价格变化影响押金）
5. ✅ 多用户并发

### Day 5: 文档和总结

- [ ] 更新README
- [ ] 编写API文档
- [ ] 创建Phase2完成报告
- [ ] 代码审查

**Week 3 完成标志**:
```bash
git add .
git commit -m "Phase 2 Week 3: 测试与优化完成"
git push origin phase2-appeals-integration

# 创建PR
gh pr create --title "Phase 2: Appeals集成deposits" \
             --body "详见docs/Phase2-开发方案.md"
```

---

## ✅ Phase 2 验收清单

### 功能验收

- [ ] `pallet-memo-content-governance` → `pallet-stardust-appeals` 重命名完成
- [ ] `submit_appeal` 使用 `deposits.reserve()`
- [ ] `approve_appeal` + 执行使用 `deposits.release()`
- [ ] `reject_appeal` 使用 `deposits.slash(30%)`
- [ ] `withdraw_appeal` 使用 `deposits.slash(10%)`
- [ ] 旧押金代码全部清理
- [ ] Event包含 `deposit_id` 字段

### 质量验收

- [ ] 编译通过（0 errors, 0 warnings）
- [ ] 单元测试通过（覆盖率 >90%）
- [ ] 集成测试通过（100%）
- [ ] Clippy检查通过
- [ ] 文档完整性100%

### 性能验收

- [ ] `submit_appeal` Weight <50k
- [ ] `approve_appeal` Weight <30k
- [ ] 存储读取 <5次/操作

---

## 📊 进度追踪

### Week 1 (Day 1-5)
- [ ] Day 1: 目录重命名 ⏳
- [ ] Day 2: Runtime配置 ⏳
- [ ] Day 3: 编译验证 ⏳
- [ ] Day 4-5: 文档更新 ⏳

### Week 2 (Day 6-10)
- [ ] Day 6-7: Config + 数据结构 ⏳
- [ ] Day 8-9: 迁移押金逻辑 ⏳
- [ ] Day 10: 清理验证 ⏳

### Week 3 (Day 11-15)
- [ ] Day 11-12: 单元测试 ⏳
- [ ] Day 13-14: 集成测试 ⏳
- [ ] Day 15: 文档总结 ⏳

---

## 🆘 问题排查

### 常见错误

**错误1: `pallet-memo-content-governance not found`**
```bash
# 解决：确保所有导入都已更新
rg "memo-content-governance" --type rust
# 应该只在MIGRATION.md中出现
```

**错误2: `DepositManager trait not satisfied`**
```bash
# 解决：检查Runtime配置
# runtime/src/configs/mod.rs 中应有：
# type DepositManager = pallet_deposits::Pallet<Runtime>;
```

**错误3: `deposit_id field not found`**
```bash
# 解决：确保Appeal结构已更新
# 搜索并替换所有 appeal.deposit → appeal.deposit_id
```

### 回滚方案

如遇重大问题，可回滚到Week开始：
```bash
# 回滚到Week 1开始
git reset --hard $(git log --grep="Phase 2: 开始前检查点" --format="%H")

# 回滚到Week 2开始
git reset --hard $(git log --grep="Phase 2 Week 1: 模块重命名完成" --format="%H")
```

---

## 📚 参考资料

### 核心文档
- [Phase2-开发方案.md](./Phase2-开发方案.md) - 详细开发方案
- [押金与申诉治理系统-完整设计方案.md](./押金与申诉治理系统-完整设计方案.md) - 总体设计
- [Phase1-编译验证完成报告.md](./Phase1-编译验证完成报告.md) - Phase 1成果

### 代码参考
- `pallets/deposits/src/lib.rs` - DepositManager trait定义
- `runtime/src/configs/mod.rs` - 动态定价策略实现

---

## 🎯 下一步

Phase 2完成后，进入**Phase 3: 前端集成**

预览：
- 重命名前端路由（ContentGovernance → Appeals）
- 集成押金查询接口
- 显示实时押金金额
- 申诉流程UI优化

---

**创建时间**: 2025-10-25  
**状态**: 📋 待启动  
**预计完成**: Phase 1完成后3周

