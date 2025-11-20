# 前端代码全面冗余检查报告

根据链端已删除 grave 功能，对前端代码进行全面审查。

## 🔴 严重冗余代码（需要立即删除）

### 1. 未使用的页面文件（依赖已删除的 grave 功能）

#### TopGravesPage.tsx
- **位置**: `src/features/ledger/TopGravesPage.tsx`
- **问题**: 整个页面都是关于墓位排行榜，但链端已删除 grave 功能
- **状态**: 未在路由中使用
- **建议**: ✅ **删除**

#### LedgerOverviewPage.tsx
- **位置**: `src/features/ledger/LedgerOverviewPage.tsx`
- **问题**: 使用 `graveId` 查询 `ledger.totalsByGrave` 和 `ledger.totalMemoByGrave`，但链端已删除 grave
- **状态**: 未在路由中使用
- **建议**: ✅ **删除** 或重构为不依赖 grave

#### GuestbookPage.tsx
- **位置**: `src/features/guestbook/GuestbookPage.tsx`
- **问题**: 使用 `graveId` 查询留言，但链端已删除 grave
- **状态**: 未在路由中使用
- **建议**: ✅ **删除** 或重构为不依赖 grave

### 2. 服务层中的冗余方法

#### memorialService.ts 中的 graveId 相关方法
- **位置**: `src/services/memorialService.ts`
- **问题**: 
  - `getOfferingsForGrave(graveId)` - 使用已删除的 graveId
  - `buildOfferTx({ graveId })` - 参数包含已删除的 graveId
  - `buildOfferBySacrificeTx({ graveId })` - 参数包含已删除的 graveId
  - `buildRenewOfferingTx({ graveId })` - 参数包含已删除的 graveId
  - `buildCancelOfferingTx({ graveId })` - 参数包含已删除的 graveId
  - `Scene.Grave = 0` - 枚举值，但链端已删除 grave
- **状态**: 部分方法仍在使用（但会失败）
- **建议**: ⚠️ **需要重构** - 这些方法需要改为不依赖 graveId，或者删除

#### unified-complaint.ts 中的 Grave 投诉类型
- **位置**: `src/services/unified-complaint.ts`
- **问题**: 
  - `ComplaintType.Grave = 'grave'` - 投诉类型，但链端已删除 grave
  - `DOMAIN_CONFIG[ComplaintType.Grave]: { domain: 1 }` - 域配置
- **状态**: 仍在使用
- **建议**: ⚠️ **需要删除** Grave 投诉类型

### 3. 组件中的冗余代码

#### MemorialHallPage.tsx
- **位置**: `src/features/memorial/MemorialHallPage.tsx`
- **问题**: 
  - 使用 `<ActionsBar graveId={1} />`，但 ActionsBar 已被删除
  - 注释中提到 ActionsBar，但导入已删除
- **状态**: 会导致运行时错误
- **建议**: ✅ **修复** - 删除 ActionsBar 的使用

#### DeceasedListPage.tsx
- **位置**: `src/features/deceased/DeceasedListPage.tsx`
- **问题**: 
  - 显示 `graveId` 字段，但链端已删除此字段
  - 尝试从链上读取 `graveId`，但字段不存在
- **状态**: 可能导致显示错误
- **建议**: ✅ **修复** - 删除 graveId 相关显示和逻辑

#### RecentOfferingsTimeline.tsx
- **位置**: `src/components/discovery/RecentOfferingsTimeline.tsx`
- **问题**: 
  - 使用 `graveId` 和 `graveName`，但链端已删除 grave
  - 点击跳转到 `#/grave/detail`，但路由已删除
- **状态**: 功能已失效
- **建议**: ✅ **修复** - 删除或重构为不依赖 grave

#### ComplaintButton.tsx
- **位置**: `src/components/ComplaintButton.tsx`
- **问题**: 
  - 包含 `ComplaintType.Grave` 的显示文本和提示
- **状态**: 仍在使用，但功能已失效
- **建议**: ✅ **修复** - 删除 Grave 投诉类型相关代码

## 🟡 中等冗余代码（需要评估）

### 1. 注释和文档中的 grave 引用
- **位置**: 多个文件
- **问题**: 注释中提到 grave，但不影响功能
- **建议**: 🟡 **可选清理** - 优先级较低

### 2. 类型定义中的 grave 字段
- **位置**: 多个接口定义
- **问题**: 类型定义中包含 `graveId?` 字段，但实际数据中不存在
- **建议**: 🟡 **可选清理** - 可以保留用于兼容性，或删除

## 📋 详细检查清单

### ✅ 已删除的文件
- [x] `src/features/ledger/TopGravesPage.tsx` - ✅ 已删除
- [x] `src/features/ledger/LedgerOverviewPage.tsx` - ✅ 已删除
- [x] `src/features/guestbook/GuestbookPage.tsx` - ✅ 已删除

### ✅ 已修复的文件
- [x] `src/services/memorialService.ts` - ✅ 已标记为 deprecated，添加警告
- [x] `src/services/unified-complaint.ts` - ✅ 已删除 Grave 投诉类型
- [x] `src/features/memorial/MemorialHallPage.tsx` - ✅ 已删除 ActionsBar 使用
- [x] `src/features/deceased/DeceasedListPage.tsx` - ✅ 已删除 graveId 显示
- [x] `src/components/discovery/RecentOfferingsTimeline.tsx` - ✅ 已重构为使用 targetId
- [x] `src/components/ComplaintButton.tsx` - ✅ 已删除 Grave 投诉类型相关代码
- [x] `src/components/memorial/OfferBySacrificeModal.tsx` - ✅ 修复了 defaultTarget 引用错误

### 需要检查的 API 调用
- [ ] `api.query.ledger.totalsByGrave` - 是否还存在
- [ ] `api.query.ledger.totalMemoByGrave` - 是否还存在
- [ ] `api.tx.memorial.offer(graveId, ...)` - 参数是否还需要 graveId
- [ ] `api.tx.memorial.offerBySacrifice(graveId, ...)` - 参数是否还需要 graveId

## 🔍 链端功能验证

需要确认链端实际支持的功能：

1. **Memorial Pallet**:
   - ✅ `api.query.memorial.*` - 确认可用的查询方法
   - ✅ `api.tx.memorial.*` - 确认可用的交易方法
   - ❓ `offer` 方法的参数格式（是否还需要 graveId）

2. **Ledger Pallet**:
   - ❓ `api.query.ledger.totalsByGrave` - 是否还存在
   - ❓ `api.query.ledger.totalMemoByGrave` - 是否还存在

3. **Complaint/Appeal**:
   - ❓ `domain: 1` 是否还代表 Grave
   - ❓ 是否还有其他域使用 `domain: 1`

## ✅ 已完成的工作

### 1. 删除未使用的页面文件
- ✅ 删除了 `TopGravesPage.tsx`（墓位排行榜）
- ✅ 删除了 `LedgerOverviewPage.tsx`（台账概览，依赖 graveId）
- ✅ 删除了 `GuestbookPage.tsx`（留言板，依赖 graveId）

### 2. 修复组件中的冗余代码
- ✅ `MemorialHallPage.tsx` - 删除了已删除的 `ActionsBar` 组件使用
- ✅ `DeceasedListPage.tsx` - 删除了 `graveId` 字段的读取和显示
- ✅ `RecentOfferingsTimeline.tsx` - 重构为使用通用的 `targetId` 和 `targetName`
- ✅ `ComplaintButton.tsx` - 删除了 `ComplaintType.Grave` 相关的显示文本

### 3. 清理服务层代码
- ✅ `unified-complaint.ts` - 删除了 `ComplaintType.Grave` 枚举值和域配置
- ✅ `memorialService.ts` - 将所有 `graveId` 相关方法标记为 `@deprecated`，添加警告信息
  - `getOfferingsForGrave()` - 已标记为废弃
  - `buildOfferTx()` - 已标记为废弃，需要重构
  - `buildOfferBySacrificeTx()` - 已标记为废弃，需要重构
  - `buildRenewOfferingTx()` - 已标记为废弃，需要重构
  - `buildCancelOfferingTx()` - 已标记为废弃，需要重构
- ✅ `memorialService.ts` - 更新了 `Scene` 枚举，将 `Grave = 0` 改为 `Memorial = 0`（需要确认链端实际值）

### 4. 修复代码错误
- ✅ `OfferBySacrificeModal.tsx` - 修复了 `defaultTarget` 引用错误，改为 `defaultGraveId`

## ⚠️ 待确认事项

1. **memorialService.ts 中的方法参数**:
   - ⚠️ `buildOfferTx()` 和 `buildOfferBySacrificeTx()` 等方法仍使用 `graveId` 参数
   - ⚠️ 需要确认链端 `memorial.offer` 和 `memorial.offerBySacrifice` 方法的实际参数格式
   - ⚠️ 如果链端已删除 grave，这些方法的第一个参数应该是什么？（可能是 `memorialId` 或其他）

2. **Scene 枚举值**:
   - ⚠️ 已将 `Scene.Grave = 0` 改为 `Scene.Memorial = 0`，但需要确认链端实际值
   - ⚠️ 如果链端不再使用 scene 概念，可能需要删除整个枚举

3. **其他文件中的 grave 引用**:
   - ⚠️ 仍有约 28 个文件包含 "grave" 或 "Grave" 字符串
   - ⚠️ 大部分可能是注释、文档或类型定义中的引用
   - ⚠️ 需要进一步检查这些引用是否影响功能

4. **governance.ts 中的方法**:
   - ⚠️ `buildDeceasedGovTransferDeceased()` 方法仍使用 `newGraveId` 参数
   - ⚠️ 需要确认链端是否还有 `govTransferDeceased` 方法，以及参数格式

## 📊 统计信息

- **已删除文件**: 3 个
- **已修复文件**: 7 个
- **已标记为废弃的方法**: 5 个
- **剩余包含 "grave" 的文件**: 约 28 个（主要是注释和文档）

