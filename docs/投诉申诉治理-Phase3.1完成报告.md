# 投诉申诉治理 - Phase 3.1 统一Evidence管理完成报告

> **实施日期**: 2025-10-27  
> **状态**: ✅ 已完成  
> **版本**: v1.0  

---

## 📊 执行摘要

Phase 3.1成功完成了pallet-stardust-appeals与pallet-evidence的集成，新增了统一证据管理功能。现在支持两种证据提交方式：旧的CID方式（向后兼容）和新的EvidenceId方式（统一证据管理）。

---

## ✅ 完成的功能

### 1. Appeal结构扩展 ✅

**文件**: `pallets/stardust-appeals/src/lib.rs`

**新增字段**:
```rust
pub struct Appeal<AccountId, Balance, BlockNumber> {
    // ... 原有字段 ...
    pub reason_cid: BoundedVec<u8, ConstU32<128>>,      // 旧方式
    pub evidence_cid: BoundedVec<u8, ConstU32<128>>,    // 旧方式
    /// Phase 3新增：统一证据ID（可选）
    pub evidence_id: Option<u64>,  // ✨ 新增
    // ... 其他字段 ...
}
```

**设计理念**:
- `evidence_id`为`Option<u64>`，None表示使用旧CID方式
- 向后兼容：旧代码无需修改
- 优先使用`evidence_id`，若为None则回退到CID

---

### 2. 新增调用函数 ✅

#### `submit_appeal_with_evidence` ✨

**函数签名**:
```rust
#[pallet::call_index(10)]
pub fn submit_appeal_with_evidence(
    origin: OriginFor<T>,
    domain: u8,
    target: u64,
    action: u8,
    evidence_id: u64,
    reason_cid: Option<BoundedVec<u8, ConstU32<128>>>,
) -> DispatchResult
```

**参数说明**:
- `evidence_id`: 指向pallet-evidence的统一证据ID
- `reason_cid`: 可选的理由CID（向后兼容）

**功能特点**:
1. ✅ 使用统一证据ID
2. ✅ 支持可选理由CID
3. ✅ 动态押金计算
4. ✅ 限频保护
5. ✅ 自动创建押金记录

**使用流程**:
```text
Step 1: 用户上传证据到pallet-evidence
  ↓
  api.tx.evidence.commit(
    domain,
    target_id,
    imgs: [cid1, cid2],
    vids: [cid3],
    docs: [],
    memo: "证据说明"
  )
  ↓
  获得 evidence_id = 123

Step 2: 使用evidence_id提交申诉
  ↓
  api.tx.memoAppeals.submitAppealWithEvidence(
    domain: 3,
    target: 456,
    action: 20,
    evidence_id: 123,
    reason_cid: Some("ipfs://Qm...")
  )
  ↓
  生成 appeal_id
  ↓
  触发事件：
  - AppealSubmitted(appeal_id, who, domain, target, deposit)
  - EvidenceLinked(appeal_id, evidence_id)
```

---

### 3. 新增事件 ✅

#### `EvidenceLinked` ✨

```rust
/// Phase 3新增：证据已链接到申诉(appeal_id, evidence_id)
EvidenceLinked(u64, u64),
```

**触发时机**:
- 调用`submit_appeal_with_evidence`时
- 表示申诉已关联到统一证据

**用途**:
- 前端可监听此事件建立索引
- 支持按证据ID查询相关申诉
- 便于审计和追溯

---

### 4. 依赖集成 ✅

**文件**: `pallets/stardust-appeals/Cargo.toml`

**新增依赖**:
```toml
[dependencies]
pallet-evidence = { path = "../evidence", default-features = false }

[features]
std = [
  # ... 其他std features ...
  "pallet-evidence/std",
]
```

---

### 5. README更新 ✅

**文件**: `pallets/stardust-appeals/README.md`

**更新内容**:
- ✅ 新增Phase 3变更说明
- ✅ 更新Appeal结构文档
- ✅ 添加`submit_appeal_with_evidence`使用说明
- ✅ 添加优势和使用场景说明

---

## 📁 修改的文件清单

### 核心代码

1. ✅ `pallets/stardust-appeals/src/lib.rs`
   - 修改Appeal结构（添加evidence_id字段）
   - 修改submit_appeal（设置evidence_id=None）
   - 修改submit_owner_transfer_appeal（设置evidence_id=None）
   - 新增submit_appeal_with_evidence函数
   - 新增EvidenceLinked事件

2. ✅ `pallets/stardust-appeals/Cargo.toml`
   - 添加pallet-evidence依赖

### 文档

3. ✅ `pallets/stardust-appeals/README.md`
   - 更新主要变更章节
   - 更新Appeal结构文档
   - 添加新函数说明

4. ✨ `docs/投诉申诉治理-Phase3.1完成报告.md`
   - 本文档

---

## 🎯 向后兼容性

### 旧代码无需修改 ✅

**场景1**: 使用旧的submit_appeal
```typescript
// ✅ 仍然正常工作
await api.tx.memoAppeals.submitAppeal(
  domain,
  target,
  action,
  reasonCid,
  evidenceCid
).signAndSend(account);
```

**场景2**: 使用新的submit_appeal_with_evidence
```typescript
// ✨ 新方式（可选）
const evidenceId = await createEvidence();
await api.tx.memoAppeals.submitAppealWithEvidence(
  domain,
  target,
  action,
  evidenceId,
  null  // reason_cid可选
).signAndSend(account);
```

**存储兼容性**:
- `evidence_id: Option<u64>` 对旧数据自动设为None
- 旧申诉记录无需迁移
- 新旧方式可共存

---

## 🚀 使用示例

### 示例1：旧方式（向后兼容）

```typescript
// 1. 上传证据到IPFS
const evidenceCid = await uploadToIPFS(file);

// 2. 提交申诉（旧方式）
await api.tx.memoAppeals.submitAppeal(
  3,          // domain: deceased-text
  123,        // target: text_id
  20,         // action: 删除悼词
  "",         // reason_cid
  evidenceCid // evidence_cid
).signAndSend(account);
```

### 示例2：新方式（统一证据管理）

```typescript
// 1. 创建统一证据
const imgCids = await Promise.all(
  images.map(img => uploadToIPFS(img))
);

const tx1 = api.tx.evidence.commit(
  3,          // domain: deceased-text
  123,        // target_id
  imgCids,    // imgs
  [],         // vids
  [],         // docs
  "证明该悼词违规" // memo
);

const result = await tx1.signAndSend(account);
const evidenceId = extractEvidenceId(result.events);

// 2. 使用evidence_id提交申诉
await api.tx.memoAppeals.submitAppealWithEvidence(
  3,          // domain
  123,        // target
  20,         // action
  evidenceId, // evidence_id
  null        // reason_cid（可选）
).signAndSend(account);
```

### 示例3：证据复用

```typescript
// 同一证据可用于多个申诉

// 创建一次证据
const evidenceId = await createEvidence("举报材料");

// 用于多个申诉
await api.tx.memoAppeals.submitAppealWithEvidence(
  3, 100, 20, evidenceId, null
).signAndSend(account);

await api.tx.memoAppeals.submitAppealWithEvidence(
  3, 101, 20, evidenceId, null
).signAndSend(account);

await api.tx.memoAppeals.submitAppealWithEvidence(
  3, 102, 20, evidenceId, null
).signAndSend(account);

// ✅ 节省存储，避免重复上传
```

---

## 🎨 架构改进

### 改进前（Phase 2）

```text
┌─────────────┐
│ 用户提交申诉 │
└──────┬──────┘
       ↓
  上传IPFS CID
       ↓
┌─────────────────┐
│ pallet-memo-     │
│ appeals          │
│ - reason_cid     │
│ - evidence_cid   │
└─────────────────┘
```

**问题**:
- 证据分散在各申诉中
- 无法复用证据
- 无统一访问控制
- 无法加密证据

---

### 改进后（Phase 3.1）

```text
┌─────────────┐
│ 用户准备证据 │
└──────┬──────┘
       ↓
┌──────────────────┐
│ pallet-evidence  │◄─── 统一证据管理
│ - evidence_id    │     - 跨域复用
│ - imgs/vids/docs │     - 访问控制
│ - 加密支持       │     - 自动Pin
└──────┬───────────┘
       ↓ evidence_id
┌─────────────────┐
│ pallet-memo-     │
│ appeals          │
│ - evidence_id ✨ │◄─── 引用统一证据
│ - reason_cid     │     保留CID向后兼容
│ - evidence_cid   │
└─────────────────┘
```

**优势**:
- ✅ 证据集中管理
- ✅ 跨域复用
- ✅ 统一访问控制
- ✅ 支持加密证据
- ✅ 自动IPFS Pin
- ✅ 向后兼容

---

## 📊 对比表

| 特性 | 旧方式（CID） | 新方式（EvidenceId） |
|-----|-------------|-------------------|
| 证据复用 | ❌ 不支持 | ✅ 支持 |
| 访问控制 | ❌ 无 | ✅ 细粒度控制 |
| 加密支持 | ❌ 无 | ✅ 端到端加密 |
| IPFS Pin | ❌ 手动 | ✅ 自动 |
| 跨域使用 | ❌ 不支持 | ✅ 支持 |
| 向后兼容 | ✅ 是 | ✅ 是 |
| 存储效率 | 低（重复存储） | 高（引用） |
| 审计追溯 | 困难 | 容易 |

---

## 🔄 迁移建议

### 对于现有代码

**无需修改** ✅：旧的`submit_appeal`仍然工作

### 对于新开发

**推荐使用新方式**:
```typescript
// ✨ 推荐：使用统一证据管理
const evidenceId = await createEvidence();
await api.tx.memoAppeals.submitAppealWithEvidence(
  domain, target, action, evidenceId, null
);

// ⚠️ 不推荐：使用旧CID方式（除非特殊需要）
await api.tx.memoAppeals.submitAppeal(
  domain, target, action, reasonCid, evidenceCid
);
```

### 对于前端

**建议逐步迁移**:
1. **Week 1**: 保持旧方式，确保稳定
2. **Week 2**: 添加新方式选项，用户可选
3. **Week 3**: 默认使用新方式，保留旧方式
4. **Week 4**: 全面切换到新方式

---

## 🎯 下一步（Phase 3.2）

### 计划内容

1. **旧pallet投诉迁移**:
   - deceased-text投诉迁移到evidence
   - deceased-media投诉迁移到evidence
   - grave投诉迁移到evidence

2. **Runtime配置更新**:
   - 配置stardust-appeals使用evidence
   - 添加域映射

3. **前端SDK更新**:
   - 更新unified-complaint.ts
   - 添加evidence创建辅助函数

---

## 📝 技术债务

### 待优化项

- [ ] 添加evidence_id存在性验证（可选）
- [ ] 添加evidence域一致性校验
- [ ] 性能基准测试
- [ ] 批量操作优化

### 已知限制

1. **证据验证**: 当前未验证evidence_id是否存在
   - **影响**: 可能引用不存在的证据
   - **缓解**: 前端保证有效性
   - **计划**: Phase 3.3添加验证

2. **域一致性**: 未强制evidence域与appeal域匹配
   - **影响**: 理论上可引用其他域的证据
   - **缓解**: 前端逻辑保证
   - **计划**: Phase 3.3添加校验

---

## 📚 相关文档

- [整体方案设计](./投诉申诉治理-整体方案设计.md)
- [Phase 1完成报告](./投诉申诉治理-Phase1实施完成报告.md)
- [Phase 1.5单元测试报告](./投诉申诉治理-Phase1.5单元测试完成报告.md)
- [pallet-evidence README](../pallets/evidence/README.md)
- [pallet-stardust-appeals README](../pallets/stardust-appeals/README.md)

---

## 📝 变更日志

| 日期 | 版本 | 变更内容 |
|-----|------|---------|
| 2025-10-27 | v1.0 | Phase 3.1统一evidence管理完成 |

---

**状态**: ✅ 已完成  
**下一步**: Phase 3.2 - 旧pallet投诉迁移

