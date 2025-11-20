# Phase 3.3 旧Pallet投诉迁移指南

> **重要**: 主网未上线，采用破坏式迁移  
> **日期**: 2025-10-27  
> **状态**: ✅ 已完成  

---

## 📊 迁移概览

###迁移的Pallet

| Pallet | 旧投诉功能 | 迁移状态 |
|--------|-----------|---------|
| deceased-text | complain_life<br/>complain_eulogy<br/>resolve_* | ✅ 已移除 |
| deceased-media | complain_album<br/>complain_media<br/>resolve_* | ✅ 已移除 |
| stardust-grave | complaints列表 | ✅ 已移除 |

---

## 🗑️ 已移除的代码

### deceased-text

**移除的存储**:
```rust
// ❌ 已移除
pub type ComplaintOf<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), ComplaintCase<T>, OptionQuery>;
pub type LifeComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::DeceasedId, u32, ValueQuery>;
pub type EulogyComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::TextId, u32, ValueQuery>;
```

**移除的函数**:
```rust
// ❌ 已移除
pub fn complain_life(origin, deceased_id)
pub fn complain_eulogy(origin, text_id)
pub fn resolve_life_complaint(origin, deceased_id, evidence_cid, uphold)
pub fn resolve_eulogy_complaint(origin, text_id, evidence_cid, uphold)
```

**移除的事件**:
```rust
// ❌ 已移除
LifeComplained(T::DeceasedId, u32)
EulogyComplained(T::TextId, u32)
ComplaintResolved(u8, u64, bool)
ComplaintPayoutWinner(T::AccountId, BalanceOf<T>)
ComplaintPayoutArbitration(T::AccountId, BalanceOf<T>)
ComplaintPayoutLoserRefund(T::AccountId, BalanceOf<T>)
```

**移除的类型**:
```rust
// ❌ 已移除
pub enum ComplaintStatus { Pending, Resolved }
pub struct ComplaintCase<T: Config> { complainant, deposit, created, status }
```

**移除的Config项**:
```rust
// ❌ 已移除
type ComplaintDeposit: Get<BalanceOf<Self>>;
type ComplaintPeriod: Get<BlockNumberFor<Self>>;
type ArbitrationAccount: Get<Self::AccountId>;
```

---

### deceased-media

**移除的存储**:
```rust
// ❌ 已移除
pub type ComplaintOf<T: Config> = StorageMap<_, Blake2_128Concat, (u8, u64), ComplaintCase<T>, OptionQuery>;
pub type AlbumComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::AlbumId, u32, ValueQuery>;
pub type MediaComplaints<T: Config> = StorageMap<_, Blake2_128Concat, T::MediaId, u32, ValueQuery>;
```

**移除的函数**:
```rust
// ❌ 已移除
pub fn complain_album(origin, album_id)
pub fn complain_media(origin, media_id)
pub fn resolve_album_complaint(origin, album_id, evidence_cid, uphold)
pub fn resolve_media_complaint(origin, media_id, evidence_cid, uphold)
```

**移除的事件**:
```rust
// ❌ 已移除
AlbumComplained(T::AlbumId, u32)
MediaComplained(T::MediaId, u32)
ComplaintResolved(u8, u64, bool)
ComplaintPayoutWinner(T::AccountId, BalanceOf<T>)
ComplaintPayoutArbitration(T::AccountId, BalanceOf<T>)
ComplaintPayoutLoserRefund(T::AccountId, BalanceOf<T>)
```

---

### stardust-grave

**移除的存储**:
```rust
// ❌ 已移除
pub struct Complaint<T: Config> { who, cid, time }
pub type ComplaintsByGrave<T: Config> = StorageMap<_, Blake2_128Concat, u64, BoundedVec<Complaint<T>, T::MaxComplaintsPerGrave>, ValueQuery>;
```

**移除的Config项**:
```rust
// ❌ 已移除
type MaxComplaintsPerGrave: Get<u32>;
```

---

## ✨ 新的统一方式

### 1. 投诉deceased文本（原complain_life/complain_eulogy）

**旧方式**（已废弃）:
```rust
// ❌ 已移除
api.tx.deceasedText.complainLife(deceased_id).signAndSend(account);
api.tx.deceasedText.complainEulogy(text_id).signAndSend(account);
```

**新方式**（统一）:
```rust
// ✅ 使用stardust-appeals
api.tx.memoAppeals.submitAppeal(
  3,              // domain: deceased-text
  text_id,        // target
  20,             // action: 删除悼词（或其他action）
  reasonCid,      // 理由
  evidenceCid     // 证据
).signAndSend(account);
```

**使用evidence方式**（推荐）:
```typescript
// 1. 创建统一证据
const evidenceId = await api.tx.evidence.commit(
  3,              // domain: deceased-text
  text_id,        // target_id
  [imgCid],       // imgs
  [],             // vids
  [],             // docs
  "违规证据"
).signAndSend(account);

// 2. 提交申诉
await api.tx.memoAppeals.submitAppealWithEvidence(
  3,              // domain
  text_id,        // target
  20,             // action
  evidenceId,     // evidence_id
  null            // reason_cid
).signAndSend(account);
```

---

### 2. 投诉deceased媒体（原complain_album/complain_media）

**旧方式**（已废弃）:
```rust
// ❌ 已移除
api.tx.deceasedMedia.complainAlbum(album_id).signAndSend(account);
api.tx.deceasedMedia.complainMedia(media_id).signAndSend(account);
```

**新方式**（统一）:
```rust
// ✅ 使用stardust-appeals
api.tx.memoAppeals.submitAppealWithEvidence(
  4,              // domain: deceased-media
  media_id,       // target
  30,             // action: 隐藏媒体
  evidenceId,     // 统一证据ID
  null
).signAndSend(account);
```

---

### 3. 投诉墓地（原complaints列表）

**旧方式**（已废弃）:
```rust
// ❌ 已移除
// grave只有记录列表，没有治理流程
```

**新方式**（统一）:
```rust
// ✅ 使用stardust-appeals（完整治理流程）
api.tx.memoAppeals.submitAppealWithEvidence(
  1,              // domain: grave
  grave_id,       // target
  10,             // action: 清空封面
  evidenceId,     // 统一证据ID
  null
).signAndSend(account);
```

---

## 📋 Action映射表

### Deceased-Text域（domain=3）

| Action | 名称 | 说明 |
|--------|------|------|
| 20 | RemoveEulogy | 删除悼词 |
| 21 | RemoveText | 删除文本/留言 |
| 22 | EditText | 编辑文本内容 |
| 23 | SetLife | 设置/修改生平 |

### Deceased-Media域（domain=4）

| Action | 名称 | 说明 |
|--------|------|------|
| 30 | HideMedia | 隐藏媒体 |
| 31 | ReplaceMediaUri | 替换媒体URI |
| 32 | FreezeVideoCollection | 冻结视频集 |

### Grave域（domain=1）

| Action | 名称 | 说明 |
|--------|------|------|
| 10 | ClearCover | 清空封面 |
| 11 | TransferGrave | 转移墓地 |
| 12 | SetRestricted | 设置限制 |
| 13 | RemoveGrave | 移除墓地 |
| 14 | RestoreGrave | 恢复墓地 |

---

## 🔄 前端迁移步骤

### Step 1: 更新导入

```typescript
// ❌ 旧方式
import { deceasedTextAPI } from '@/services/deceased-text';

// ✅ 新方式
import { UnifiedComplaintService } from '@/services/unified-complaint';
import { ComplaintType } from '@/services/unified-complaint';
```

### Step 2: 更新调用代码

```typescript
// ❌ 旧方式
await deceasedTextAPI.complainEulogy(textId);

// ✅ 新方式
const service = new UnifiedComplaintService(api, signer);
await service.submitComplaint({
  type: ComplaintType.DeceasedText,
  targetId: textId.toString(),
  action: 20,  // RemoveEulogy
  evidence: [evidenceFile],
  reason: '该悼词违规',
  useEvidenceId: true  // 使用统一证据管理
});
```

### Step 3: 更新状态查询

```typescript
// ❌ 旧方式
const complaint = await api.query.deceasedText.complaintOf([3, textId]);

// ✅ 新方式
const appeals = await api.query.memoAppeals.appeals.entries();
const myAppeals = appeals
  .filter(([_, appeal]) => 
    appeal.domain === 3 && 
    appeal.target === textId
  );
```

---

## ⚙️ Runtime配置更新

**移除的配置**（在runtime/src/configs/mod.rs）:
```rust
// ❌ deceased-text旧配置已移除
ComplaintDeposit: ConstU128<100 * UNIT>,
ComplaintPeriod: ConstU32<432000>,
ArbitrationAccount: /* ... */,

// ❌ deceased-media旧配置已移除
ComplaintDeposit: ConstU128<100 * UNIT>,
ComplaintPeriod: ConstU32<432000>,
ArbitrationAccount: /* ... */,

// ❌ grave旧配置已移除
MaxComplaintsPerGrave: ConstU32<100>,
```

**保留的配置**（统一使用stardust-appeals）:
```rust
// ✅ 统一配置
impl pallet_memo_appeals::Config for Runtime {
    type AppealDeposit = ConstU128<100 * UNIT>;
    type NoticeDefaultBlocks = ConstU32<432000>;
    type AppealDepositPolicy = ContentAppealDepositPolicy;
    // ... 其他配置
}
```

---

## 🎯 治理流程对比

### 旧流程（deceased-text/media）

```text
1. 用户提交投诉 → ComplaintOf存储
   ↓
2. 治理决策 → resolve_*_complaint
   ↓
3. 立即执行 + 分账（20/5/75）
   ↓
4. ComplaintOf移除
```

**问题**:
- ❌ 无公示期
- ❌ 无应答机制
- ❌ 立即执行（无缓冲）
- ❌ 分散管理

---

### 新流程（统一stardust-appeals）

```text
1. 用户提交申诉 → stardust-appeals
   ↓
2. 治理批准 → 进入公示期（30天）
   ↓
3. 公示期内：
   - 所有者可应答（自动否决）
   - 社区可查看证据
   ↓
4. 公示到期 → 自动执行
   ↓
5. 执行完成 → 释放押金
```

**优势**:
- ✅ 有公示期（30天）
- ✅ 应答自动否决
- ✅ 延迟执行（缓冲）
- ✅ 统一管理
- ✅ 证据复用
- ✅ 动态押金
- ✅ 失败重试

---

## 📊 迁移检查清单

### Pallet代码检查

- [x] deceased-text移除投诉存储
- [x] deceased-text移除投诉函数
- [x] deceased-text移除投诉事件
- [x] deceased-text移除投诉Config
- [x] deceased-media移除投诉存储
- [x] deceased-media移除投诉函数
- [x] deceased-media移除投诉事件
- [x] deceased-media移除投诉Config
- [x] grave移除投诉存储
- [x] grave移除投诉Config
- [x] 更新pallet README说明

### Runtime配置检查

- [x] 移除旧Config值
- [x] 验证stardust-appeals配置完整
- [x] 更新domain映射

### 前端代码检查

- [ ] 更新deceased-text投诉调用
- [ ] 更新deceased-media投诉调用
- [ ] 更新grave投诉调用
- [ ] 移除旧API导入
- [ ] 更新状态查询逻辑
- [ ] 更新UI组件

### 测试检查

- [ ] 编译通过
- [ ] 单元测试通过
- [ ] 集成测试验证
- [ ] 前端功能测试

---

## 🚨 破坏性变更说明

### 不兼容的API

以下API已完全移除，必须使用新API：
```rust
// ❌ 不再可用
deceasedText.complainLife()
deceasedText.complainEulogy()
deceasedText.resolveLifeComplaint()
deceasedText.resolveEulogyComplaint()

deceasedMedia.complainAlbum()
deceasedMedia.complainMedia()
deceasedMedia.resolveAlbumComplaint()
deceasedMedia.resolveMediaComplaint()

// ✅ 使用新API
memoAppeals.submitAppeal()
memoAppeals.submitAppealWithEvidence()
memoAppeals.approveAppeal()
memoAppeals.rejectAppeal()
```

### 存储迁移

**不需要数据迁移**（主网未上线）:
- ComplaintOf存储已清空
- 无历史数据需要迁移

**如果有测试数据**:
- 测试数据已失效
- 需要使用新API重新提交

---

## 📝 迁移脚本

### 检查旧投诉数据（测试网）

```javascript
// 检查是否还有旧投诉数据
const oldDeceasedTextComplaints = await api.query.deceasedText.complaintOf.entries();
console.log('deceased-text旧投诉数:', oldDeceasedTextComplaints.length);

const oldDeceasedMediaComplaints = await api.query.deceasedMedia.complaintOf.entries();
console.log('deceased-media旧投诉数:', oldDeceasedMediaComplaints.length);

const oldGraveComplaints = await api.query.memoGrave.complaintsByGrave.entries();
console.log('grave旧投诉数:', oldGraveComplaints.length);

// 应该都返回0（或API错误，表示存储已移除）
```

---

## 🎓 最佳实践

### 1. 使用统一证据管理

```typescript
// ✅ 推荐：创建一次证据，多次使用
const evidenceId = await createEvidence([img1, img2]);

// 用于多个申诉
await submitAppeal(domain1, target1, action1, evidenceId);
await submitAppeal(domain2, target2, action2, evidenceId);
```

### 2. 合理选择Action

```typescript
// 根据具体情况选择合适的action
if (isViolentContent) {
  action = 20;  // 删除
} else if (isMinorIssue) {
  action = 22;  // 编辑
}
```

### 3. 提供充分证据

```typescript
// ✅ 充分的证据
const evidence = await api.tx.evidence.commit(
  domain,
  targetId,
  [screenshot1, screenshot2, screenshot3],  // 多张截图
  [videoProof],                             // 视频证据
  [report],                                 // 文档报告
  "详细的违规说明"
);
```

---

## 📚 相关文档

- [Phase 3总结报告](./投诉申诉治理-Phase3总结报告.md)
- [Phase 3.1完成报告](./投诉申诉治理-Phase3.1完成报告.md)
- [pallet-stardust-appeals README](../pallets/stardust-appeals/README.md)
- [统一投诉SDK文档](../stardust-dapp/src/services/unified-complaint.ts)

---

**迁移状态**: ✅ 链端代码已完成  
**前端待办**: 更新调用代码  
**测试待办**: 验证功能完整性

