# Phase 2 任务清单 & 追踪表

> **项目**: 押金与申诉治理系统  
> **阶段**: Phase 2 - 核心治理层集成  
> **时间**: 3周（15个工作日）

---

## 📊 总体进度

```
[                              ] 0/45 任务完成 (0%)

Week 1: [          ] 0/15 (0%)
Week 2: [          ] 0/15 (0%)  
Week 3: [          ] 0/15 (0%)
```

---

## Week 1: 模块重命名（15任务）

### Day 1: 链端重命名 (6任务)

- [ ] **T1.1** 重命名pallet目录 `memo-content-governance` → `stardust-appeals`
- [ ] **T1.2** 修改 `pallets/stardust-appeals/Cargo.toml` 的package name
- [ ] **T1.3** 更新根目录 `Cargo.toml` 的workspace members
- [ ] **T1.4** 修改 `runtime/Cargo.toml` 的dependencies
- [ ] **T1.5** 更新 `runtime/src/lib.rs` 的pallet定义
- [ ] **T1.6** 更新 `runtime/src/configs/mod.rs` 的Config实现

### Day 2: 全局更新 (3任务)

- [ ] **T1.7** 全局搜索替换 `pallet_memo_content_governance` → `pallet_memo_appeals`
- [ ] **T1.8** 更新所有import语句
- [ ] **T1.9** 更新模块内部的中文注释

### Day 3: 编译验证 (3任务)

- [ ] **T1.10** 编译检查 `cargo check -p pallet-stardust-appeals`
- [ ] **T1.11** 编译检查 `cargo check -p stardust-runtime`
- [ ] **T1.12** 单元测试 `cargo test -p pallet-stardust-appeals`

### Day 4-5: 文档更新 (3任务)

- [ ] **T1.13** 更新 `pallets/stardust-appeals/README.md`
- [ ] **T1.14** 创建 `docs/MIGRATION-ContentGovernance-to-Appeals.md`
- [ ] **T1.15** 更新 `pallets接口文档.md`

**Week 1 检查点**: 
```bash
git commit -m "Phase 2 Week 1: 模块重命名完成 ✅"
```

---

## Week 2: 集成pallet-deposits（15任务）

### Day 6: 添加依赖 (3任务)

- [ ] **T2.1** 修改 `pallets/stardust-appeals/Cargo.toml` 添加pallet-deposits依赖
- [ ] **T2.2** 修改Config trait添加 `DepositManager` 类型
- [ ] **T2.3** 修改Config trait添加 `DepositBeneficiary` 类型

### Day 7: 修改数据结构 (3任务)

- [ ] **T2.4** 修改 `Appeal` 结构添加 `deposit_id: u64` 字段
- [ ] **T2.5** 移除 `Appeal` 结构的 `deposit: Balance` 字段
- [ ] **T2.6** 更新 `Appeal` 相关的类型定义

### Day 8: 迁移submit_appeal (3任务)

- [ ] **T2.7** 修改 `submit_appeal` 调用 `deposits.reserve()`
- [ ] **T2.8** 存储返回的 `deposit_id` 到Appeal记录
- [ ] **T2.9** 更新 `AppealSubmitted` 事件包含 `deposit_id`

### Day 9: 迁移审批逻辑 (4任务)

- [ ] **T2.10** 修改执行逻辑调用 `deposits.release()` （成功时）
- [ ] **T2.11** 修改 `reject_appeal` 调用 `deposits.slash(30%)`
- [ ] **T2.12** 修改 `withdraw_appeal` 调用 `deposits.slash(10%)`
- [ ] **T2.13** 更新相关事件定义

### Day 10: 清理和配置 (2任务)

- [ ] **T2.14** 删除所有 `T::Currency::reserve/unreserve` 调用
- [ ] **T2.15** 更新 `runtime/src/configs/mod.rs` 配置 `DepositManager`

**Week 2 检查点**:
```bash
git commit -m "Phase 2 Week 2: deposits集成完成 ✅"
```

---

## Week 3: 测试与优化（15任务）

### Day 11-12: 单元测试 (6任务)

- [ ] **T3.1** 测试 `submit_appeal` 正确调用deposits
- [ ] **T3.2** 测试 `approve + execute` 释放押金
- [ ] **T3.3** 测试 `reject_appeal` 罚没30%
- [ ] **T3.4** 测试 `withdraw_appeal` 罚没10%
- [ ] **T3.5** 测试动态定价正确性
- [ ] **T3.6** 测试余额不足场景

### Day 13: 集成测试 (4任务)

- [ ] **T3.7** 端到端测试：完整申诉流程
- [ ] **T3.8** 端到端测试：驳回流程
- [ ] **T3.9** 端到端测试：撤回流程
- [ ] **T3.10** 端到端测试：多用户并发

### Day 14: 性能优化 (2任务)

- [ ] **T3.11** Weight优化和测量
- [ ] **T3.12** 存储读取优化

### Day 15: 文档和总结 (3任务)

- [ ] **T3.13** 更新 `pallets/stardust-appeals/README.md`
- [ ] **T3.14** 创建 `docs/Phase2-实施完成报告.md`
- [ ] **T3.15** 代码审查和最终验证

**Week 3 检查点**:
```bash
git commit -m "Phase 2 Week 3: 测试与优化完成 ✅"
```

---

## 📋 详细任务说明

### 🔴 P0 - 必须完成

#### T1.1: 重命名pallet目录
```bash
cd /home/xiaodong/文档/stardust/pallets
mv memo-content-governance stardust-appeals
```
**验证**: `ls pallets/ | grep stardust-appeals`

#### T1.2: 修改Cargo.toml
```toml
[package]
name = "pallet-stardust-appeals"  # 修改这行
```
**验证**: `grep "name = " pallets/stardust-appeals/Cargo.toml`

#### T2.1: 添加deposits依赖
```toml
[dependencies]
pallet-deposits = { path = "../deposits", default-features = false }
```
**验证**: `cargo check -p pallet-stardust-appeals`

#### T2.7: 修改submit_appeal
```rust
let deposit_id = T::DepositManager::reserve(
    &who,
    deposit_amount,
    DepositPurpose::Appeal { ... },
)?;
```
**验证**: 编译通过 + 测试通过

---

## 🟡 P1 - 重要但非阻塞

#### T1.13: 更新README
- 说明重命名原因
- 列出主要变更
- 更新使用示例

#### T3.11: Weight优化
- 实际测量各函数Weight
- 更新#[pallet::weight]
- 对比优化前后

---

## ⚠️ 风险任务（需要特别注意）

### T2.7 - T2.12: 押金逻辑迁移
**风险**: 可能遗漏某些押金操作  
**缓解**: 使用 `rg "Currency::reserve"` 搜索确保全部替换

### T3.7 - T3.10: 集成测试
**风险**: 测试覆盖不全  
**缓解**: 参考测试方案文档，逐一验证

---

## ✅ 验收标准

### Week 1 验收

```bash
# 1. 编译通过
✅ cargo check --all

# 2. 测试通过  
✅ cargo test -p pallet-stardust-appeals

# 3. 文档完整
✅ README.md 已更新
✅ MIGRATION.md 已创建
```

### Week 2 验收

```bash
# 1. 无旧押金代码
✅ rg "Currency::reserve" pallets/stardust-appeals/ 无结果

# 2. 所有押金操作使用deposits
✅ 搜索 "DepositManager::" 有结果

# 3. 编译测试通过
✅ cargo test -p pallet-stardust-appeals
```

### Week 3 验收

```bash
# 1. 单元测试覆盖率 >90%
✅ cargo tarpaulin -p pallet-stardust-appeals

# 2. 集成测试通过
✅ cargo test --workspace

# 3. 性能达标
✅ 各函数Weight <50k
```

---

## 📈 进度追踪命令

### 自动统计完成度

```bash
#!/bin/bash
# progress.sh

TOTAL=45
DONE=$(grep -c "^- \[x\]" docs/Phase2-任务清单.md)
PERCENT=$((DONE * 100 / TOTAL))

echo "Phase 2 进度: $DONE/$TOTAL ($PERCENT%)"
echo ""
echo "Week 1: $(grep -c "^- \[x\] \*\*T1\." docs/Phase2-任务清单.md)/15"
echo "Week 2: $(grep -c "^- \[x\] \*\*T2\." docs/Phase2-任务清单.md)/15"
echo "Week 3: $(grep -c "^- \[x\] \*\*T3\." docs/Phase2-任务清单.md)/15"
```

### 每日更新

```bash
# 完成任务时，替换 [ ] 为 [x]
sed -i 's/\[ \] \*\*T1.1\*\*/[x] **T1.1**/' docs/Phase2-任务清单.md

# 查看今日任务
grep "^\- \[ \]" docs/Phase2-任务清单.md | head -5
```

---

## 🎯 里程碑事件

| 里程碑 | 日期 | 标志 |
|--------|------|------|
| Phase 2启动 | TBD | ⏳ 创建开发分支 |
| Week 1完成 | TBD | ⏳ 模块重命名完成 |
| Week 2完成 | TBD | ⏳ deposits集成完成 |
| Week 3完成 | TBD | ⏳ 测试优化完成 |
| Phase 2完成 | TBD | ⏳ PR合并到main |

---

## 📞 每日站会模板

### 今日完成
- [ ] T?.? - xxx

### 今日遇到的问题
- 无 / xxx

### 明日计划
- [ ] T?.? - xxx

### 需要帮助
- 无 / xxx

---

## 🔗 相关链接

- [Phase2-开发方案.md](./Phase2-开发方案.md) - 详细方案
- [Phase2-快速开始.md](./Phase2-快速开始.md) - 快速指南
- [押金与申诉治理系统-完整设计方案.md](./押金与申诉治理系统-完整设计方案.md) - 总体设计

---

**创建时间**: 2025-10-25  
**最后更新**: 2025-10-25  
**当前进度**: 0% (0/45)  
**状态**: 📋 待启动

