# DAPP 治理页面 - 快速参考表

## 📋 治理页面总数：18个

---

## ✅ 已迁移到Web（3个）

| # | 页面 | DAPP路由 | Web路由 | 功能 |
|---|------|---------|---------|------|
| 1 | CouncilProposalPage | `#/gov/council-proposals` | `/proposals` | 委员会提案管理 |
| 2 | GovMarketMakerReviewPage | `#/gov/mm-review` | `/applications` | 做市商审批 |
| 3 | ContentGovernanceReviewPage | `#/gov/review` | `/content-governance` | 内容申诉审核 |

**状态**: ✅ 完成，Web版功能更强大

---

## 📱 保留在DAPP（6个）

| # | 页面 | 路由 | 功能 | 理由 |
|---|------|------|------|------|
| 1 | ReferendaListPage | `#/gov/list` | 公投列表 | 大众投票，移动为主 |
| 2 | ReferendumDetailPage | `#/gov/detail` | 公投详情 | 用户投票，移动便利 |
| 3 | NewProposalPage | `#/gov/new` | 发起提案 | 简单操作，移动可完成 |
| 4 | MyGovernancePage | `#/gov/me` | 我的治理 | 个人功能，随时查看 |
| 5 | SubmitAppealPage | `#/gov/appeal` | 提交申诉 | 即时举报，移动为主 |
| 6 | GovernanceHomePage | `#/gov/home` | 治理入口 | 移动端导航 |

**状态**: ✅ 保留，适合移动场景

---

## 🖥️ 建议迁移到Web（4个）

| # | 页面 | 路由 | 功能 | 优先级 | 预计工时 |
|---|------|------|------|--------|---------|
| 1 | AdminArbitrationPage | `#/admin/arbitration` | 仲裁管理 | ⭐⭐⭐⭐ | 2周 |
| 2 | CommitteeTemplatesPage | `#/gov/templates` | 提案模板 | ⭐⭐⭐ | 1周 |
| 3 | ContentCommitteePage | `#/gov/content` | 内容委员会 | ⭐⭐⭐ | 已有替代 |
| 4 | GraveGovernanceToolsPage | `#/grave/gov` | 墓地治理 | ⭐⭐ | 按需 |

**状态**: ⏳ 待迁移，专业功能适合Web

---

## 🔄 双端都需要（2个）

| 页面 | DAPP用途 | Web用途 |
|------|---------|---------|
| ReferendaListPage | 用户投票 | 审核监控 |
| ReferendumDetailPage | 查看投票 | 详细分析 |

**说明**: 功能侧重不同，都需要

---

## ⏳ 待评估（3个）

| 页面 | 路由 | 说明 |
|------|------|------|
| GovTicketPage | `#/gov/ticket` | 评估使用频率 |
| RestoreDeceasedBuilder | `#/gov/restore-deceased` | 技术工具 |
| SubmitCategoryReferendumPage | - | 评估实际需求 |

---

## 🎯 迁移策略

### 已完成（25%）

```
✅ 委员会提案（核心）
✅ 做市商审批（核心）
✅ 内容治理（核心）

= 核心专业治理100%完成
```

### 下一步（可选）

```
优先级1（如需仲裁）:
  ⏳ 仲裁管理

优先级2（提升效率）:
  ⏳ 委员会模板
  
优先级3（完善功能）:
  ⏳ 其他治理工具
```

---

## 📊 统计总结

### 按状态

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 已迁移到Web | 3 | 17% |
| 📱 保留在DAPP | 6 | 33% |
| 🖥️ 建议迁移 | 4 | 22% |
| 🔄 双端都需要 | 2 | 11% |
| ⏳ 待评估 | 3 | 17% |

### 按用户群体

| 用户群体 | 页面数 | 建议平台 |
|---------|--------|---------|
| 委员会/管理员 | 10 | 🖥️ Web |
| 普通用户 | 6 | 📱 DAPP |
| 双端用户 | 2 | 🔄 双端 |

---

## 💡 核心结论

**已迁移的核心功能**：
- ✅ 委员会提案管理
- ✅ 做市商审批
- ✅ 内容治理

**这3个是最核心、最高频的专业治理功能，已100%迁移完成。**

**保留在DAPP的功能**：
- ✅ 公投投票（大众参与）
- ✅ 我的治理（个人功能）
- ✅ 申诉提交（即时举报）

**这些适合移动端，保留在DAPP最合理。**

**其他功能**：
- 根据实际使用频率和需求决定
- 非必需，可按需迁移

---

**查看详细分析**: `DAPP治理页面完整清单.md`

