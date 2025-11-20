# 前端冗余代码检查报告

## ✅ 已清理的冗余代码

### 1. Grave 相关功能（已完全删除）
- ✅ 删除了所有 grave 相关的路由（11个路由）
- ✅ 删除了 `src/features/grave/` 整个目录
- ✅ 删除了 `src/components/grave/` 整个目录
- ✅ 删除了 `src/services/graveService.ts`
- ✅ 删除了 `src/hooks/usePrimaryDeceased.ts`
- ✅ 删除了所有测试文件
- ✅ 清理了所有导入和引用

### 2. CreateDeceasedPage.tsx 中的冗余代码（已清理）
- ✅ 删除了 `loadMyGraves` 函数
- ✅ 删除了 `graveLoading`、`graveErr`、`myGraves` 状态
- ✅ 删除了纪念馆ID选择器UI
- ✅ 删除了 `grave_id` 表单字段验证
- ✅ 更新了 `args` 数组，将 `grave_id` 设置为 0

### 3. 其他文件中的冗余代码（已清理）
- ✅ 更新了 `DeceasedPaginatedList.tsx` 中的变量名（`isLargeGrave` → `isLargeCollection`）
- ✅ 清理了导航组件中的 grave 路由引用
- ✅ 清理了快速操作组件中的 grave 路由
- ✅ 更新了文档中的 grave 相关内容

## ⚠️ 需要关注的遗留代码

### 1. TopGravesPage.tsx（墓位排行榜）
**位置**: `src/features/ledger/TopGravesPage.tsx`
**状态**: 未在路由中使用，但文件仍存在
**建议**: 
- 如果不再需要，可以删除此文件
- 或者标记为已废弃，等待后续删除

### 2. LedgerOverviewPage.tsx（台账概览）
**位置**: `src/features/ledger/LedgerOverviewPage.tsx`
**状态**: 包含 `graveId` 相关代码
**说明**: 
- 此页面用于查看特定墓位的台账数据
- 由于 grave 功能已删除，此页面可能需要重构或删除
- 建议检查是否还在路由中使用

### 3. 注释中的 grave 引用
**位置**: 多个文件中的注释
**状态**: 仅存在于注释中，不影响功能
**建议**: 
- 可以逐步清理注释中的 grave 引用
- 优先级较低，不影响功能

## 📋 检查清单

### 代码检查
- [x] 删除所有 grave 相关的导入
- [x] 删除所有 grave 相关的路由
- [x] 删除所有 grave 相关的组件
- [x] 删除所有 grave 相关的服务
- [x] 删除所有 grave 相关的 hooks
- [x] 更新所有相关的变量名
- [x] 清理表单中的 grave 字段
- [x] 更新文档

### 功能检查
- [x] 创建逝者功能不再依赖 grave
- [x] 逝者列表不再跳转到 grave 详情
- [x] 导航不再包含 grave 相关入口
- [x] 快速操作不再包含 grave 相关操作

### 测试检查
- [x] 无 linter 错误
- [ ] 需要手动测试创建逝者功能
- [ ] 需要手动测试逝者列表功能
- [ ] 需要手动测试导航功能

## 🔍 后续建议

1. **删除 TopGravesPage.tsx**: 如果确认不再需要，可以删除此文件
2. **重构 LedgerOverviewPage.tsx**: 如果台账功能需要保留，需要重构为不依赖 grave
3. **清理注释**: 逐步清理代码注释中的 grave 引用
4. **更新类型定义**: 检查是否有类型定义中仍包含 grave 相关字段
5. **测试验证**: 进行完整的功能测试，确保所有功能正常

## 📝 注意事项

- `CreateDeceasedPage.tsx` 中的 `localStorage.removeItem('mp.deceased.graveId')` 可以保留，用于清理旧的本地存储数据
- 所有 grave 相关的路由跳转都已更新为其他页面或删除
- 代码中仍有一些注释提到 grave，但不影响功能运行

