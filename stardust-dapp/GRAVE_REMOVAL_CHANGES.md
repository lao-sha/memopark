# Grave 功能删除清单

由于链端已删除 grave 相关代码和功能，前端需要进行以下功能改变：

## 📋 目录
1. [路由和页面](#路由和页面)
2. [服务层](#服务层)
3. [组件](#组件)
4. [Hooks](#hooks)
5. [工具函数和类型](#工具函数和类型)
6. [测试文件](#测试文件)
7. [文档和配置](#文档和配置)
8. [其他依赖](#其他依赖)

---

## 路由和页面

### 需要删除的路由

以下路由需要从 `src/routes.tsx` 中删除：

1. **`#/grave/create`** - 创建墓位页面
   - 组件：`CreateGravePage`
   - 文件：`src/features/grave/CreateGravePage.tsx`

2. **`#/grave/detail`** - 墓位详情页
   - 组件：`GraveDetailPage`
   - 文件：`src/features/grave/GraveDetailPage.tsx`

3. **`#/grave/list`** - 墓位列表页
   - 组件：`GraveListPage`
   - 文件：`src/features/grave/GraveListPage.tsx`

4. **`#/grave/my`** - 我的墓位页
   - 组件：`MyGravesPage`
   - 文件：`src/features/grave/MyGravesPage.tsx`

5. **`#/grave/hall/:graveId`** - 墓位纪念馆页面（中式风格）
   - 组件：`GraveHallPage`
   - 文件：`src/features/memorial/GraveHallPage.tsx`
   - 注意：此页面在 memorial 目录下，但路由使用 grave 前缀

6. **`#/grave/park/:graveId`** - 墓园页面（3D墓碑展示）
   - 组件：`GraveParkPage`
   - 文件：`src/features/memorial/GraveParkPage.tsx`
   - 注意：此页面在 memorial 目录下，但路由使用 grave 前缀

7. **`#/grave/offerings/:graveId`** - 祭祀品选择页面
   - 组件：`OfferingSelectionPage`
   - 文件：`src/features/memorial/OfferingSelectionPage.tsx`
   - 注意：此页面在 memorial 目录下，但路由使用 grave 前缀

8. **`#/grave/audio`** - 墓位音频选择器
   - 组件：`GraveAudioPicker`
   - 文件：`src/features/grave/GraveAudioPicker.tsx`

9. **`#/covers`** - 封面选项页
   - 组件：`CoverOptionsPage`
   - 文件：`src/features/grave/CoverOptionsPage.tsx`

10. **`#/covers/create`** - 创建封面选项页
    - 组件：`CreateCoverOptionPage`
    - 文件：`src/features/grave/CreateCoverOptionPage.tsx`

11. **`#/carousel/editor`** - 轮播图编辑器
    - 组件：`CarouselEditorPage`
    - 文件：`src/features/grave/CarouselEditorPage.tsx`

### 需要修改的 App.tsx

从 `src/App.tsx` 中删除以下导入：
- `GraveListPage`
- `MyGravesPage`
- `GraveDetailPage`
- `CoverOptionsPage`
- `CreateCoverOptionPage`
- `GraveAudioPicker`
- `CarouselEditorPage`

删除以下特殊路由处理：
- `if (hash === '#/graves') return <GraveListPage />;`

---

## 服务层

### 需要删除的服务文件

1. **`src/services/graveService.ts`** - 完整的墓位服务类
   - 包含所有 grave 相关的 API 调用
   - 包括：`GraveService` 类、`createGraveService` 函数、`validatePrimaryDeceasedSetting` 函数等

### 需要修改的服务文件

1. **`src/services/governanceService.ts`**
   - 删除 `GovernanceDomain.Grave = 1` 枚举值
   - 检查并删除所有与 Grave 相关的治理逻辑

---

## 组件

### 需要删除的组件目录

**`src/features/grave/`** - 整个目录需要删除，包括：

1. `ActionsBar.tsx` - 操作栏组件
2. `CarouselEditorPage.tsx` - 轮播图编辑页面
3. `components/OwnerChangeLogInline.tsx` - 拥有者变更日志内联组件
4. `CoverOptionsPage.tsx` - 封面选项页面
5. `CreateCoverOptionPage.tsx` - 创建封面选项页面
6. `CreateGravePage.css` - 创建墓位页面样式
7. `CreateGravePage.tsx` - 创建墓位页面
8. `GraveAudioPicker.tsx` - 墓位音频选择器
9. `GraveAudioPlayer.tsx` - 墓位音频播放器
10. `GraveDetailPage-PrimaryDeceased-Integration.tsx` - 主逝者集成文件
11. `GraveDetailPage.css` - 墓位详情页样式
12. `GraveDetailPage.tsx` - 墓位详情页
13. `GraveListPage.tsx` - 墓位列表页
14. `KinshipForm.tsx` - 亲属关系表单
15. `MyGravesPage.tsx` - 我的墓位页
16. `PolicyViewer.tsx` - 策略查看器
17. `RelationProposalForm.tsx` - 关系提案表单
18. `VisibilitySettings.tsx` - 可见性设置

### 需要删除的组件目录

**`src/components/grave/`** - 整个目录需要删除，包括：

1. `EnhancedDeceasedList.css` - 增强逝者列表样式
2. `EnhancedDeceasedList.tsx` - 增强逝者列表组件
3. `PrimaryDeceasedManager.css` - 主逝者管理器样式
4. `PrimaryDeceasedManager.tsx` - 主逝者管理器组件
5. `PrimaryDeceasedQuickSwitch.css` - 主逝者快速切换样式
6. `PrimaryDeceasedQuickSwitch.tsx` - 主逝者快速切换组件

### 需要修改的组件

1. **`src/features/memorial/GraveHallPage.tsx`**
   - 此页面依赖 grave 功能，需要评估是否删除或重构
   - 路由：`#/grave/hall/:graveId`

2. **`src/features/memorial/GraveParkPage.tsx`**
   - 此页面依赖 grave 功能，需要评估是否删除或重构
   - 路由：`#/grave/park/:graveId`

3. **`src/features/memorial/OfferingSelectionPage.tsx`**
   - 此页面依赖 grave 功能，需要评估是否删除或重构
   - 路由：`#/grave/offerings/:graveId`

4. **`src/features/memorial/CreateMemorialForm.tsx`**
   - 删除对 `memoGrave.createHall` 的调用

5. **`src/features/memorial/HallPage.tsx`**
   - 删除对 `memoGrave.attachDeceased` 的调用
   - 删除对 `memoGrave.setPark` 的调用

6. **`src/features/memorial/MemorialHallPage.tsx`**
   - 删除对 `ActionsBar` 的导入（来自 `../grave/ActionsBar`）

7. **`src/features/auth/AuthEntryPage.tsx`**
   - 删除对 `GraveListPage` 的导入

8. **`src/components/discovery/HotGravesList.tsx`**
   - 删除或重构此组件（如果存在）

---

## Hooks

### 需要删除的 Hooks 文件

1. **`src/hooks/usePrimaryDeceased.ts`** - 主逝者相关 Hook
   - 包含：`usePrimaryDeceased`、`useGravePermissions`、`useGraveManager` 等
   - 依赖 `graveService`

### 需要修改的 Hooks

1. **`src/hooks/useDeceasedPagination.ts`**
   - 删除 `isLargeGrave` 和 `isVeryLargeGrave` 相关逻辑
   - 删除 `isLargeGrave` 参数

2. **`src/hooks/useDeceasedEvents.ts`**
   - 检查并删除与 `graveId` 相关的逻辑

---

## 工具函数和类型

### 需要修改的文件

1. **`src/utils/deceasedErrorHandler.tsx`**
   - 删除 `GraveNotFound` 错误类型
   - 删除 `TooManyDeceasedInGrave` 错误类型（如果与 grave 相关）

---

## 测试文件

### 需要删除的测试文件

1. **`src/__tests__/primary-deceased.test.tsx`** - 主逝者相关测试
2. **`src/__tests__/integration/primary-deceased-integration.js`** - 主逝者集成测试

### 需要修改的测试文件

检查所有测试文件，删除与 grave 相关的测试用例。

---

## 文档和配置

### 需要修改的文档

1. **`README.md`**
   - 删除所有与 grave 相关的功能说明
   - 删除路由说明中的 grave 相关路由
   - 删除墓位背景音乐（Grave Audio）相关说明
   - 删除墓地治理相关说明

2. **`测试清单.md`**
   - 删除 `#/grave/detail?id=1` 相关测试项

3. **`开始测试.md`**
   - 删除 `#/grave/detail?id=1` 相关测试项

4. **`design/grave_detail_ui_spec.md`**
   - 此文件可以删除或标记为已废弃

5. **`快速修复-deceased-media问题.md`**
   - 如果与 grave 相关，需要更新或删除

---

## 其他依赖

### API 调用需要删除

所有对以下 API 的调用都需要删除：

1. **查询 API（Query）**：
   - `api.query.stardustGrave.*` 或 `api.query.memoGrave.*` 或 `api.query.memo_grave.*`
   - `api.query.stardustGrave.graves(graveId)`
   - `api.query.stardustGrave.primaryDeceasedOf(graveId)`
   - `api.query.stardustGrave.interments(graveId)`
   - `api.query.stardustGrave.graveAdmins(graveId)`
   - `api.query.memoGrave.audioCidOf(graveId)`
   - `api.query.memoGrave.audioPlaylistOf(graveId)`
   - `api.query.memoGrave.audioOptions()`
   - `api.query.memoGrave.coverCidOf(graveId)`
   - `api.query.memoGrave.coverOptions()`
   - `api.query.memoGrave.visibilityPolicyOf(graveId)`
   - `api.query.memoGrave.followersOf(graveId)`
   - `api.query.memoGrave.slugOf(graveId)`
   - `api.query.memoGrave.nextGraveId()`

2. **交易 API（Transaction）**：
   - `api.tx.stardustGrave.*` 或 `api.tx.memoGrave.*` 或 `api.tx.memo_grave.*`
   - `api.tx.stardustGrave.setPrimaryDeceased(graveId, deceasedId)`
   - `api.tx.memoGrave.createGrave(...)`
   - `api.tx.memoGrave.updateGrave(...)`
   - `api.tx.memoGrave.setPark(...)`
   - `api.tx.memoGrave.setVisibility(...)`
   - `api.tx.memoGrave.setAudio(...)`
   - `api.tx.memoGrave.setAudioFromOption(...)`
   - `api.tx.memoGrave.setAudioPlaylist(...)`
   - `api.tx.memoGrave.addPrivateAudioOption(...)`
   - `api.tx.memoGrave.removePrivateAudioOption(...)`
   - `api.tx.memoGrave.setCoverFromOption(...)`
   - `api.tx.memoGrave.addCoverOption(...)`
   - `api.tx.memoGrave.declareKinship(...)`
   - `api.tx.memoGrave.createHall(...)`
   - `api.tx.memoGrave.attachDeceased(...)`

3. **事件 API（Events）**：
   - `api.events.stardustGrave.PrimaryDeceasedSet`
   - `api.events.stardustGrave.PrimaryDeceasedCleared`
   - `api.events.stardustGrave.GraveCreated`

4. **常量 API（Constants）**：
   - `api.consts.memoGrave.createFee`
   - `api.consts.memoGrave.maxCidLen`

### 样式文件需要删除

1. **`src/features/memorial/GraveHallPage.css`**
2. **`src/features/memorial/GraveParkPage.css`**

---

## 总结

### 需要删除的目录

1. `src/features/grave/` - 整个目录
2. `src/components/grave/` - 整个目录

### 需要删除的文件

1. `src/services/graveService.ts`
2. `src/hooks/usePrimaryDeceased.ts`
3. `src/__tests__/primary-deceased.test.tsx`
4. `src/__tests__/integration/primary-deceased-integration.js`
5. `design/grave_detail_ui_spec.md`
6. `src/features/memorial/GraveHallPage.tsx`（如果不再需要）
7. `src/features/memorial/GraveHallPage.css`
8. `src/features/memorial/GraveParkPage.tsx`（如果不再需要）
9. `src/features/memorial/GraveParkPage.css`
10. `src/features/memorial/OfferingSelectionPage.tsx`（如果不再需要）

### 需要修改的文件

1. `src/routes.tsx` - 删除所有 grave 相关路由
2. `src/App.tsx` - 删除所有 grave 相关导入和路由处理
3. `src/services/governanceService.ts` - 删除 `Grave` 枚举值
4. `src/features/memorial/CreateMemorialForm.tsx` - 删除 `memoGrave` 调用
5. `src/features/memorial/HallPage.tsx` - 删除 `memoGrave` 调用
6. `src/features/memorial/MemorialHallPage.tsx` - 删除 `ActionsBar` 导入
7. `src/features/auth/AuthEntryPage.tsx` - 删除 `GraveListPage` 导入
8. `src/hooks/useDeceasedPagination.ts` - 删除 grave 相关逻辑
9. `src/hooks/useDeceasedEvents.ts` - 删除 grave 相关逻辑
10. `src/utils/deceasedErrorHandler.tsx` - 删除 grave 相关错误类型
11. `README.md` - 更新文档
12. `测试清单.md` - 更新测试清单
13. `开始测试.md` - 更新测试文档

### 注意事项

1. **memorial 目录下的页面**：`GraveHallPage`、`GraveParkPage`、`OfferingSelectionPage` 虽然位于 memorial 目录，但路由和功能都依赖 grave，需要评估是否删除或重构。

2. **向后兼容性**：如果这些功能有用户在使用，需要考虑迁移方案或替代功能。

3. **依赖检查**：删除前需要检查是否有其他模块依赖这些功能。

4. **清理未使用的导入**：删除文件后，需要检查并清理所有未使用的导入。

---

## 执行步骤建议

1. **第一步**：备份当前代码
2. **第二步**：删除测试文件，确保测试通过
3. **第三步**：删除服务层和 Hooks
4. **第四步**：删除组件和页面
5. **第五步**：修改路由和 App.tsx
6. **第六步**：清理其他依赖和引用
7. **第七步**：更新文档
8. **第八步**：全面测试，确保没有遗漏的引用

