# Memopark DAPP 治理页面完整清单

## 📋 治理页面总览

**位置**: `memopark-dapp/src/features/governance/`  
**总数**: 12个页面组件 + 8个子组件  

---

## 一、核心治理页面（12个）

### 1. GovernanceHomePage.tsx
**路由**: `#/gov/home` 或 Tab: `gov-home`  
**用途**: 治理模块入口页面  
**功能**:
- 治理总览
- 快捷入口
- 统计展示（占位）

**状态**: ✅ 基础实现  
**迁移建议**: 📱 保留在DAPP（移动端入口）

---

### 2. CouncilProposalPage.tsx ⭐
**路由**: `#/gov/council-proposals`  
**用途**: 委员会提案管理  
**功能**:
- 提案列表（Council）
- 创建提案
- 投票和执行
- 我的投票记录

**状态**: ✅ 完整实现  
**迁移状态**: ✅ **已迁移到Web平台**（/proposals）  
**建议**: 🖥️ Web平台为主，DAPP保留简化版查看

---

### 3. ReferendaListPage.tsx
**路由**: `#/gov/list` 或 Tab: `gov-list`  
**用途**: 公投列表页面  
**功能**:
- 公投列表展示
- 按轨道筛选
- 按状态筛选
- 关键字搜索

**状态**: ✅ 完整实现  
**迁移状态**: ⏳ 部分迁移（审核侧已迁移到Web）  
**建议**: 📱 保留在DAPP（大众投票），🖥️ Web添加审核监控

---

### 4. ReferendumDetailPage.tsx
**路由**: `#/gov/detail` 或 Tab: `gov-detail`  
**用途**: 公投详情页面  
**功能**:
- 公投详细信息
- 投票数据展示
- Preimage查看
- 投票操作（用户在DAPP投票）

**状态**: ✅ 完整实现  
**迁移状态**: ⏳ 部分迁移（详情查看已迁移到Web）  
**建议**: 📱 保留在DAPP（用户投票），🖥️ Web用于监控分析

---

### 5. NewProposalPage.tsx
**路由**: `#/gov/new` 或 Tab: `gov-new`  
**用途**: 发起新公投提案  
**功能**:
- Preimage创建
- 选择轨道
- 设置参数
- 提交提案

**状态**: ✅ 完整实现  
**迁移建议**: 📱 保留在DAPP（用户发起提案）

---

### 6. MyGovernancePage.tsx
**路由**: `#/gov/me` 或 Tab: `gov-me`  
**用途**: 我的治理页面  
**功能**:
- 我发起的提案
- 我投过的票
- 我的锁仓
- 可解锁项
- 批量解锁

**状态**: ✅ 完整实现  
**迁移建议**: 📱 保留在DAPP（个人功能，移动查看）

---

### 7. GovTicketPage.tsx
**路由**: `#/gov/ticket`  
**用途**: 治理工单页面  
**功能**:
- 治理工单管理
- 任务追踪

**状态**: ✅ 基础实现  
**迁移建议**: 📱 保留在DAPP

---

### 8. ContentCommitteePage.tsx
**路由**: `#/gov/content`  
**用途**: 内容委员会页面  
**功能**:
- 内容委员会说明
- 进入动议/投票入口
- 链接到申诉页面
- 链接到恢复页面

**状态**: ✅ 骨架实现  
**迁移状态**: ⏳ 功能已迁移到Web（/committees）  
**建议**: 🖥️ Web平台为主（委员会管理），📱 DAPP保留入口

---

### 9. ContentGovernanceReviewPage.tsx
**路由**: `#/gov/review`  
**用途**: 内容治理审核页面  
**功能**:
- 申诉审核
- 批准/驳回操作

**状态**: ✅ 基础实现  
**迁移状态**: ✅ **已迁移到Web平台**（/content-governance）  
**建议**: 🖥️ Web平台为主（专业审核）

---

### 10. SubmitAppealPage.tsx
**路由**: `#/gov/appeal`  
**用途**: 提交申诉页面  
**功能**:
- 提交内容申诉
- 填写申诉表单
- 上传证据
- 质押押金

**状态**: ✅ 完整实现  
**迁移建议**: 📱 **保留在DAPP**（用户举报，移动为主）

---

### 11. CommitteeTemplatesPage.tsx
**路由**: `#/gov/templates`  
**用途**: 委员会模板页面  
**功能**:
- 常用提案模板
- 快速创建提案

**状态**: ✅ 基础实现  
**迁移建议**: 🖥️ 可迁移到Web（委员会功能）

---

### 12. RestoreDeceasedBuilder.tsx
**路由**: `#/gov/restore-deceased`  
**用途**: 恢复逝者旧版本构建器  
**功能**:
- 输入DeceasedId和旧版本字段
- 生成batchAll预映像
- 由内容委员会发起执行

**状态**: ✅ 完整实现  
**迁移建议**: 🖥️ 可迁移到Web（技术操作）

---

## 二、治理相关的其他页面（6个）

### 13. GovMarketMakerReviewPage.tsx ⭐
**路由**: `#/gov/mm-review`  
**用途**: 做市商审核页面  
**功能**:
- 待审核申请列表
- 已批准做市商列表
- 申请详情查看

**状态**: ✅ 完整实现  
**迁移状态**: ✅ **已迁移到Web平台**（/applications）  
**建议**: 🖥️ Web平台为主（专业审核）

---

### 14. GraveGovernanceToolsPage.tsx
**路由**: `#/grave/gov`  
**用途**: 墓地治理工具  
**功能**:
- 墓地治理操作
- 强制修改

**状态**: ✅ 实现  
**迁移建议**: 🖥️ 可迁移到Web（管理员功能）

---

### 15. ParkGovernanceToolsPage.tsx
**路由**: `#/park/gov`  
**用途**: 陵园治理工具  
**功能**:
- 陵园治理操作
- 配置管理

**状态**: ✅ 实现  
**迁移建议**: 🖥️ 可迁移到Web（管理员功能）

---

### 16. SubmitCategoryReferendumPage.tsx
**路由**: （未找到具体路由）  
**用途**: 提交分类公投  
**功能**:
- 创建分类相关的公投

**状态**: ✅ 实现  
**迁移建议**: 📱 保留在DAPP

---

### 17. AdminArbitrationPage.tsx
**路由**: `#/admin/arbitration`  
**用途**: 仲裁管理页面  
**功能**:
- 仲裁案件管理
- 裁决操作

**状态**: ✅ 实现  
**迁移建议**: 🖥️ **应迁移到Web**（专业审核）

---

### 18. FeeGuardAdminPage.tsx
**路由**: `#/fee-guard`  
**用途**: 费用治理管理  
**功能**:
- 费用参数配置
- 治理设置

**状态**: ✅ 实现  
**迁移建议**: 🖥️ 可迁移到Web（管理员功能）

---

## 三、治理组件（8个）

### 位置: `memopark-dapp/src/features/governance/components/`

| 组件 | 功能 | 用途 |
|------|------|------|
| **CreateProposalForm.tsx** | 创建委员会提案表单 | Council提案创建 |
| **ProposalList.tsx** | 委员会提案列表 | 显示提案和投票 |
| **MyVotes.tsx** | 我的投票记录 | 个人投票历史 |
| **ReferendumCard.tsx** | 公投卡片组件 | 公投信息展示 |
| **TrackSelector.tsx** | 轨道选择器 | 选择治理轨道 |
| **VotePanel.tsx** | 投票面板 | 信念投票UI |
| **PreimageViewer.tsx** | Preimage查看器 | 查看提案内容 |
| **PasswordModal.tsx** | 密码输入弹窗 | 本地钱包签名 |

**迁移状态**:
- ✅ CreateProposalForm - 已迁移到Web
- ✅ ProposalList - 已迁移到Web
- ✅ MyVotes - 已迁移到Web
- ⏳ ReferendumCard - 保留DAPP（用户投票）
- ⏳ TrackSelector - Web已重新实现
- ⏳ VotePanel - 保留DAPP（用户投票）
- ⏳ PreimageViewer - Web已实现
- ⏳ PasswordModal - DAPP专用（本地钱包）

---

## 四、治理Hooks（4个）

### 位置: `memopark-dapp/src/features/governance/hooks/`

| Hook | 功能 | 状态 |
|------|------|------|
| **useTracks.ts** | 轨道数据查询 | ✅ Web已重新实现 |
| **useReferenda.ts** | 公投数据查询 | ✅ Web已重新实现 |
| **useMyVoting.ts** | 我的投票数据 | 📱 DAPP专用 |
| **usePreimage.ts** | Preimage查询 | ⏳ Web可参考 |

---

## 五、迁移状态总结

### ✅ 已迁移到Web平台（3个核心）

| 页面 | 原路由 | 新路由 | 改进 |
|------|--------|--------|------|
| **CouncilProposalPage** | `#/gov/council-proposals` | `/proposals` | 批量投票+数据分析 |
| **GovMarketMakerReviewPage** | `#/gov/mm-review` | `/applications` | 表格展示+快捷操作 |
| **ContentGovernanceReviewPage** | `#/gov/review` | `/content-governance` | 批量审批+公示期 |

---

### 📱 应保留在DAPP（6个）

| 页面 | 路由 | 理由 |
|------|------|------|
| **ReferendaListPage** | `#/gov/list` | 大众投票，移动为主 |
| **ReferendumDetailPage** | `#/gov/detail` | 用户投票，移动便利 |
| **NewProposalPage** | `#/gov/new` | 用户发起，简单操作 |
| **MyGovernancePage** | `#/gov/me` | 个人功能，随时查看 |
| **SubmitAppealPage** | `#/gov/appeal` | 即时举报，移动为主 |
| **GovernanceHomePage** | `#/gov/home` | 移动端治理入口 |

---

### 🖥️ 建议迁移到Web（5个）

| 页面 | 路由 | 优先级 | 理由 |
|------|------|--------|------|
| **ContentCommitteePage** | `#/gov/content` | ⭐⭐⭐ | 已有/committees替代 |
| **CommitteeTemplatesPage** | `#/gov/templates` | ⭐⭐⭐ | 委员会功能，适合Web |
| **AdminArbitrationPage** | `#/admin/arbitration` | ⭐⭐⭐⭐ | 专业审核，需要Web |
| **GraveGovernanceToolsPage** | `#/grave/gov` | ⭐⭐ | 管理员功能 |
| **ParkGovernanceToolsPage** | `#/park/gov` | ⭐⭐ | 管理员功能 |

---

### 🔄 特殊处理（3个）

| 页面 | 路由 | 处理方式 |
|------|------|---------|
| **RestoreDeceasedBuilder** | `#/gov/restore-deceased` | 技术工具，可选迁移Web |
| **SubmitCategoryReferendumPage** | - | 评估使用频率后决定 |
| **GovTicketPage** | `#/gov/ticket` | 评估实际需求 |

---

## 六、详细分类分析

### 按用户群体分类

#### 👥 委员会/管理员专用（应在Web）

| 页面 | 功能 | 迁移状态 |
|------|------|---------|
| CouncilProposalPage | 委员会提案 | ✅ 已迁移 |
| GovMarketMakerReviewPage | 做市商审批 | ✅ 已迁移 |
| ContentGovernanceReviewPage | 内容审核 | ✅ 已迁移 |
| ContentCommitteePage | 内容委员会 | ⏳ 建议迁移 |
| CommitteeTemplatesPage | 提案模板 | ⏳ 建议迁移 |
| AdminArbitrationPage | 仲裁管理 | ⏳ 建议迁移 |
| GraveGovernanceToolsPage | 墓地治理 | ⏳ 可选迁移 |
| ParkGovernanceToolsPage | 陵园治理 | ⏳ 可选迁移 |

#### 👤 普通用户使用（保留DAPP）

| 页面 | 功能 | 理由 |
|------|------|------|
| ReferendaListPage | 公投列表 | 移动场景，大众参与 |
| ReferendumDetailPage | 公投详情 | 移动投票 |
| NewProposalPage | 发起提案 | 简单操作 |
| MyGovernancePage | 我的治理 | 个人功能 |
| SubmitAppealPage | 提交申诉 | 即时举报 |
| GovernanceHomePage | 治理入口 | 移动端导航 |

---

### 按操作复杂度分类

#### 复杂操作（应在Web）

```
✅ 已迁移:
  - 委员会提案管理（批量投票）
  - 做市商审批（详细审核）
  - 内容治理（批量审批）

⏳ 建议迁移:
  - 仲裁管理（复杂裁决）
  - 委员会模板（管理功能）
  - 治理工具（技术操作）
```

#### 简单操作（保留DAPP）

```
📱 保留:
  - 公投投票（一键投票）
  - 发起提案（表单填写）
  - 提交申诉（简单表单）
  - 我的治理（查看记录）
```

---

### 按操作频率分类

#### 高频操作

| 页面 | 频率 | 平台 |
|------|------|------|
| CouncilProposalPage | 高频 | 🖥️ Web（已迁移）|
| GovMarketMakerReviewPage | 高频 | 🖥️ Web（已迁移）|
| ContentGovernanceReviewPage | 高频 | 🖥️ Web（已迁移）|
| ReferendaListPage | 高频 | 📱 DAPP（保留）|
| MyGovernancePage | 高频 | 📱 DAPP（保留）|

#### 中频操作

| 页面 | 频率 | 平台 |
|------|------|------|
| NewProposalPage | 中频 | 📱 DAPP |
| SubmitAppealPage | 中频 | 📱 DAPP |
| AdminArbitrationPage | 中频 | 🖥️ Web（建议）|

#### 低频操作

| 页面 | 频率 | 平台 |
|------|------|------|
| CommitteeTemplatesPage | 低频 | 🖥️ Web（建议）|
| GraveGovernanceToolsPage | 低频 | 🖥️ Web（可选）|
| ParkGovernanceToolsPage | 低频 | 🖥️ Web（可选）|
| RestoreDeceasedBuilder | 低频 | 🖥️ Web（可选）|

---

## 七、迁移优先级建议

### 第一优先级（已完成）✅

1. ✅ CouncilProposalPage → Web `/proposals`
2. ✅ GovMarketMakerReviewPage → Web `/applications`
3. ✅ ContentGovernanceReviewPage → Web `/content-governance`

**理由**: 高频+专业+批量操作

---

### 第二优先级（强烈建议）⭐⭐⭐⭐

4. ⏳ AdminArbitrationPage → Web `/arbitration`
   - 仲裁管理
   - 专业裁决
   - 详细审核

**预计工时**: 2周

---

### 第三优先级（建议迁移）⭐⭐⭐

5. ⏳ CommitteeTemplatesPage → Web `/templates`
   - 委员会模板
   - 快速创建

6. ⏳ ContentCommitteePage → 整合到Web `/committees`
   - 内容委员会管理
   - 已有替代方案

**预计工时**: 1周

---

### 第四优先级（可选迁移）⭐⭐

7. ⏳ GraveGovernanceToolsPage → Web `/governance/grave`
8. ⏳ ParkGovernanceToolsPage → Web `/governance/park`
9. ⏳ RestoreDeceasedBuilder → Web `/tools/restore`
10. ⏳ GovTicketPage → Web `/tickets`

**预计工时**: 按需

---

## 八、迁移对照表

### 完整迁移映射

| # | DAPP页面 | DAPP路由 | Web路由 | 状态 | 用户群体 |
|---|---------|---------|---------|------|---------|
| 1 | GovernanceHomePage | `#/gov/home` | - | 📱 保留 | 普通用户 |
| 2 | CouncilProposalPage | `#/gov/council-proposals` | `/proposals` | ✅ 已迁移 | 委员会 |
| 3 | ReferendaListPage | `#/gov/list` | `/referenda` | 🔄 双端 | 双端 |
| 4 | ReferendumDetailPage | `#/gov/detail` | `/referenda/:id` | 🔄 双端 | 双端 |
| 5 | NewProposalPage | `#/gov/new` | - | 📱 保留 | 普通用户 |
| 6 | MyGovernancePage | `#/gov/me` | - | 📱 保留 | 普通用户 |
| 7 | GovTicketPage | `#/gov/ticket` | - | 📱 保留 | 普通用户 |
| 8 | ContentCommitteePage | `#/gov/content` | `/committees` | ⏳ 建议迁移 | 委员会 |
| 9 | ContentGovernanceReviewPage | `#/gov/review` | `/content-governance` | ✅ 已迁移 | 委员会 |
| 10 | SubmitAppealPage | `#/gov/appeal` | - | 📱 保留 | 普通用户 |
| 11 | CommitteeTemplatesPage | `#/gov/templates` | - | ⏳ 建议迁移 | 委员会 |
| 12 | RestoreDeceasedBuilder | `#/gov/restore-deceased` | - | ⏳ 可选迁移 | 管理员 |
| 13 | GovMarketMakerReviewPage | `#/gov/mm-review` | `/applications` | ✅ 已迁移 | 委员会 |
| 14 | AdminArbitrationPage | `#/admin/arbitration` | - | ⏳ 建议迁移 | 仲裁员 |
| 15 | GraveGovernanceToolsPage | `#/grave/gov` | - | ⏳ 可选迁移 | 管理员 |
| 16 | ParkGovernanceToolsPage | `#/park/gov` | - | ⏳ 可选迁移 | 管理员 |
| 17 | FeeGuardAdminPage | `#/fee-guard` | - | ⏳ 可选迁移 | 管理员 |

**图例**：
- ✅ 已迁移：功能已在Web实现
- 📱 保留：适合移动端，保留在DAPP
- 🔄 双端：Web和DAPP都需要（不同侧重）
- ⏳ 建议迁移：应该迁移到Web
- ⏳ 可选迁移：根据需求决定

---

## 九、迁移建议总结

### ✅ 已完成迁移（3个）

```
1. CouncilProposalPage → Web /proposals
   改进: 批量投票、数据分析、成员管理

2. GovMarketMakerReviewPage → Web /applications
   改进: 表格展示、详细对比、快捷操作

3. ContentGovernanceReviewPage → Web /content-governance
   改进: 批量审批、公示期设置、证据管理
```

### 📱 保留在DAPP（6个）

```
理由: 大众参与、移动场景、简单操作

1. ReferendaListPage - 公投列表（投票）
2. ReferendumDetailPage - 公投详情（投票）
3. NewProposalPage - 发起提案
4. MyGovernancePage - 我的治理
5. SubmitAppealPage - 提交申诉
6. GovernanceHomePage - 治理入口
```

### 🖥️ 建议迁移（4个）

```
优先级排序:

⭐⭐⭐⭐ 高优先级:
  1. AdminArbitrationPage（仲裁管理）
     - 专业审核
     - 详细信息
     - 批量操作

⭐⭐⭐ 中优先级:
  2. CommitteeTemplatesPage（提案模板）
     - 委员会功能
     - 提升效率
  
  3. ContentCommitteePage（内容委员会）
     - 已有/committees替代
     - 可整合

⭐⭐ 低优先级:
  4. 其他治理工具页面
     - 按使用频率决定
```

---

## 十、双端功能对比

### 公投功能（双端都需要）

| 功能 | DAPP | Web | 说明 |
|------|------|-----|------|
| **查看公投列表** | ✅ 简化版 | ✅ 详细版 | 都需要 |
| **查看公投详情** | ✅ 投票侧重 | ✅ 监控侧重 | 都需要 |
| **投票操作** | ✅ 主要 | ⏳ 可选 | DAPP为主 |
| **监控进度** | ⏳ 基础 | ✅ 详细 | Web为主 |
| **数据分析** | ❌ | ✅ | Web独有 |
| **取消公投** | ❌ | ✅ | Web独有（Root） |

**结论**: 
- DAPP侧重投票参与
- Web侧重审核监控

---

## 十一、组件复用分析

### 可以从DAPP复用的组件

| 组件 | 用途 | 复用价值 |
|------|------|---------|
| TrackSelector | 轨道选择 | ✅ 已参考实现 |
| PreimageViewer | Preimage查看 | ✅ 可参考逻辑 |
| VotePanel | 投票面板 | ⏳ 如需投票功能可参考 |
| ReferendumCard | 公投卡片 | ✅ 已参考设计 |

### 可以从DAPP复用的逻辑

| Hook/Service | 功能 | 复用状态 |
|-------------|------|---------|
| useTracks | 轨道查询 | ✅ 已重新实现 |
| useReferenda | 公投查询 | ✅ 已重新实现 |
| useMyVoting | 投票记录 | ⏳ DAPP专用（信念投票） |
| governance.ts | 治理逻辑 | ✅ 已参考核心逻辑 |

---

## 十二、总结

### DAPP治理页面统计

```
总页面数: 18个
  - 核心治理: 12个
  - 相关治理: 6个

组件数: 8个
Hooks数: 4个

已迁移到Web: 3个（25%）
保留在DAPP: 6个（50%）
建议迁移: 4个（33%）
待评估: 5个（42%）
```

### 迁移完成度

```
✅ 核心委员会治理: 100%已迁移
✅ 做市商审批: 100%已迁移
✅ 内容治理: 100%已迁移

⏳ 仲裁管理: 待迁移（优先级高）
⏳ 其他治理: 按需迁移

📱 大众参与治理: 保留DAPP
📱 个人功能: 保留DAPP
```

### 建议

**立即行动**：
1. 保持现状（核心已迁移）
2. 根据实际使用需求决定是否迁移其他页面
3. 优先迁移AdminArbitrationPage（如果仲裁功能启用）

**长期规划**：
- Web平台：专业管理（委员会/管理员）
- DAPP：大众参与（普通用户）
- 双端协同：各取所长

---

## 📚 相关文档

- **专业治理功能迁移-最终总结.md** - 迁移策略
- **治理功能全面分析与分配方案.md** - 分配原则
- **治理架构最终方案.md** - 双端架构

---

**创建时间**: 2025-10-02  
**统计范围**: memopark-dapp/src/features/governance/  
**页面总数**: 18个治理相关页面  
**迁移状态**: 核心功能已完成，其他按需迁移

