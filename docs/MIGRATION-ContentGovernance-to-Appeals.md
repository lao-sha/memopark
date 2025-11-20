# 迁移指南: ContentGovernance → Appeals

> **模块重命名**: `pallet-memo-content-governance` → `pallet-stardust-appeals`  
> **版本**: v0.1.0 → v0.2.0  
> **日期**: 2025-10-25

---

## 📋 背景

`pallet-memo-content-governance` 重命名为 `pallet-stardust-appeals`，原因：

1. **语义更准确**: 模块不仅处理"内容"治理，还支持多种域（墓地、逝者、供奉品等）的申诉
2. **功能范围清晰**: "appeals"更准确地描述模块的核心功能
3. **易于扩展**: 新名称不限制未来支持更多域类型
4. **符合Substrate命名惯例**: 功能性命名优于限定性命名

---

## ✅ 兼容性保证

### 链端兼容性

| 项目 | 兼容性 | 说明 |
|------|--------|------|
| **存储布局** | ✅ 完全兼容 | 存储键和数据结构未变，无需迁移 |
| **API接口** | ✅ 完全兼容 | Runtime别名保持不变 |
| **事件Event** | ✅ 完全兼容 | 事件定义完全相同 |
| **错误Error** | ✅ 完全兼容 | 错误定义完全相同 |
| **extrinsic** | ✅ 完全兼容 | 调用方式不变 |

### 前端兼容性

| 调用方式 | 兼容性 | 说明 |
|----------|--------|------|
| `api.tx.contentGovernance.*` | ✅ 完全兼容 | Runtime别名未变 |
| `api.query.contentGovernance.*` | ✅ 完全兼容 | Runtime别名未变 |
| `api.consts.contentGovernance.*` | ✅ 完全兼容 | Runtime别名未变 |

**结论**: ✅ **前端无需修改，可继续使用！**

---

## 🔄 链端变更详情

### 1. 目录结构

```bash
# 变更前
pallets/memo-content-governance/
  ├── Cargo.toml
  ├── src/
  │   ├── lib.rs
  │   ├── weights.rs
  │   └── ...
  └── README.md

# 变更后
pallets/stardust-appeals/
  ├── Cargo.toml
  ├── src/
  │   ├── lib.rs
  │   ├── weights.rs
  │   └── ...
  └── README.md
```

### 2. Cargo.toml

**pallets/stardust-appeals/Cargo.toml**:
```toml
[package]
name = "pallet-stardust-appeals"  # 修改
version = "0.2.0"              # 升级
```

**runtime/Cargo.toml**:
```toml
[dependencies]
pallet-stardust-appeals = { path = "../pallets/stardust-appeals", default-features = false }

[features]
std = [
    "pallet-stardust-appeals/std",
]
```

### 3. Runtime配置

**runtime/src/lib.rs**:
```rust
// 模块定义（保持别名，向后兼容）
#[runtime::pallet_index(41)]
pub type ContentGovernance = pallet_memo_appeals;
```

**runtime/src/configs/mod.rs**:
```rust
// Config实现
impl pallet_memo_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    // ... 其他配置
}

// Trait实现
impl pallet_memo_appeals::AppealDepositPolicy for ContentAppealDepositPolicy { ... }
impl pallet_memo_appeals::AppealRouter<AccountId> for ContentGovernanceRouter { ... }
impl pallet_memo_appeals::LastActiveProvider for ContentLastActiveProvider { ... }
```

---

## 📱 前端迁移（可选）

### 当前状态（无需修改）

前端可继续使用现有代码：

```typescript
// TypeScript类型
import type { PalletMemoContentGovernanceAppeal } from '@polkadot/types/lookup';

// API调用
await api.tx.contentGovernance.submitAppeal(
    domain,
    target,
    action,
    reasonCid,
    evidenceCid,
    newOwner
).signAndSend(account);

// 查询
const appeal = await api.query.contentGovernance.appeals(appealId);

// 事件监听
api.query.system.events((events) => {
    events.forEach(({ event }) => {
        if (api.events.contentGovernance.AppealSubmitted.is(event)) {
            // 处理事件
        }
    });
});
```

**以上代码继续有效！无需修改！** ✅

### 可选: 更新到新名称

如果Runtime在未来版本中改用`Appeals`别名，可以这样更新：

```typescript
// 新API调用（如果Runtime别名改为Appeals）
await api.tx.appeals.submitAppeal(...)
const appeal = await api.query.appeals.appeals(appealId)
api.events.appeals.AppealSubmitted.is(event)
```

**建议策略**:
1. ✅ 第一个版本（v0.2.0）：保持使用 `contentGovernance`
2. 🔄 第二个版本（v0.3.0）：逐步迁移到 `appeals`（可选）
3. ⚠️ 第三个版本（v0.4.0）：完全切换到 `appeals`（如需要）

---

## 🛠️ 开发者迁移

### Pallet开发者

如果你的Pallet依赖申诉模块：

**Cargo.toml**:
```toml
[dependencies]
# 旧
pallet-memo-content-governance = { path = "...", default-features = false }

# 新
pallet-stardust-appeals = { path = "...", default-features = false }

[features]
std = [
    # 旧
    "pallet-memo-content-governance/std",
    
    # 新
    "pallet-stardust-appeals/std",
]
```

**代码中的引用**:
```rust
// 旧
use pallet_memo_content_governance::AppealRouter;

// 新
use pallet_memo_appeals::AppealRouter;
```

### 搜索替换

全局搜索替换以下内容：

```bash
# 1. Cargo依赖
查找: pallet-memo-content-governance
替换: pallet-stardust-appeals

# 2. 代码引用
查找: pallet_memo_content_governance
替换: pallet_memo_appeals

# 3. 注释文档
查找: memo-content-governance
替换: stardust-appeals
```

---

## 🧪 测试验证

### 链端验证

```bash
# 1. 编译pallet
cargo check -p pallet-stardust-appeals
# 预期: ✅ 编译通过

# 2. 编译runtime
cargo check -p stardust-runtime
# 预期: ✅ 编译通过

# 3. 运行单元测试
cargo test -p pallet-stardust-appeals
# 预期: ✅ 所有测试通过

# 4. 运行集成测试
cargo test --workspace
# 预期: ✅ 所有测试通过

# 5. 启动测试链
./target/release/node-template --dev
# 预期: ✅ 正常启动
```

### 前端验证

```bash
# 1. 连接测试链
# 2. 打开浏览器控制台
# 3. 检查API
console.log(api.tx.contentGovernance);
// 预期: ✅ 显示所有extrinsics

# 4. 测试提交申诉
await api.tx.contentGovernance.submitAppeal(...).signAndSend(account);
// 预期: ✅ 正常提交

# 5. 测试查询
await api.query.contentGovernance.appeals(0);
// 预期: ✅ 正常返回数据
```

---

## ❓ 常见问题

### Q1: 前端报错 "contentGovernance not found"

**A**: 检查Runtime配置，确保保留了 `ContentGovernance` 别名：

```rust
// runtime/src/lib.rs
pub type ContentGovernance = pallet_memo_appeals;
```

### Q2: 需要数据迁移吗？

**A**: ❌ **不需要！** 存储布局完全兼容，数据自动继承。

### Q3: 现有的申诉会受影响吗？

**A**: ❌ **不会！** 所有现有申诉继续有效，状态和数据完全保留。

### Q4: 何时必须更新前端？

**A**: 
- ✅ **当前（v0.2.0）**: 无需更新
- 🔄 **未来（v0.3.0+）**: 如果Runtime别名改为`Appeals`，需要更新

### Q5: 编译时找不到pallet-memo-content-governance

**A**: 正常现象，已重命名为 `pallet-stardust-appeals`。更新Cargo.toml依赖即可。

### Q6: 单元测试失败

**A**: 确保所有导入都已更新：
```rust
use pallet_memo_appeals::*;  // 不是 pallet_memo_content_governance
```

---

## 📅 迁移时间表

### Phase 1: 链端重命名 ✅ 完成（2025-10-25）

- [x] 重命名pallet目录
- [x] 更新Cargo.toml
- [x] 更新Runtime配置
- [x] 更新文档
- [x] 编译验证

**状态**: ✅ **100% 完成**

### Phase 2: 集成pallet-deposits 📋 Week 2

- [ ] 添加pallet-deposits依赖
- [ ] 修改Appeal结构（deposit_id）
- [ ] 迁移押金逻辑
- [ ] 清理旧代码
- [ ] 测试验证

**预计时间**: 2025-10-26 - 2025-11-01

### Phase 3: 前端可选迁移 ⏳ 未来

- [ ] 评估是否需要改用`Appeals`别名
- [ ] 更新前端TypeScript类型
- [ ] 更新API调用
- [ ] 用户通知和文档

**预计时间**: TBD（根据需求决定）

---

## 🔗 相关文档

### Phase 2文档
- [Phase2-规划总结](./Phase2-规划总结.md) - Phase 2总览
- [Phase2-开发方案](./Phase2-开发方案.md) - 详细开发计划
- [Phase2-快速开始](./Phase2-快速开始.md) - 快速上手指南
- [Phase2-任务清单](./Phase2-任务清单.md) - 任务追踪

### Pallet文档
- [pallet-stardust-appeals README](../pallets/stardust-appeals/README.md) - 模块文档
- [押金与申诉治理系统-完整设计方案](./押金与申诉治理系统-完整设计方案.md) - 系统设计

---

## 📞 支持与反馈

### 遇到问题？

1. **查阅文档**: 先检查本迁移指南
2. **搜索代码**: 使用 `rg` 搜索相关引用
3. **查看示例**: 参考Phase2-快速开始指南
4. **编译验证**: 运行 `cargo check` 检查错误

### 报告问题

如发现迁移问题，请提供：
- 错误信息
- 环境信息（Rust版本、操作系统）
- 重现步骤

---

## 🎊 总结

### ✅ 关键要点

1. **向后兼容**: 前端无需任何修改
2. **数据安全**: 无需数据迁移，现有数据完全保留
3. **API稳定**: 所有API调用保持不变
4. **渐进迁移**: 可选择性地逐步迁移到新名称

### 🎯 迁移收益

- ✅ 更准确的模块命名
- ✅ 更清晰的功能范围
- ✅ 更好的可扩展性
- ✅ 为Phase 2（集成pallet-deposits）做好准备

### ⏭️ 下一步

- 查看 [Phase2-开发方案](./Phase2-开发方案.md) 了解Week 2计划
- 准备集成 pallet-deposits
- 完善单元测试和集成测试

---

**创建日期**: 2025-10-25  
**最后更新**: 2025-10-25  
**版本**: v1.0  
**状态**: ✅ 完成

