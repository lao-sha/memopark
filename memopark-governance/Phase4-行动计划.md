# Phase 4 行动计划：轨道系统+多委员会

## 🎯 目标

在3周内完成：
1. ✅ 轨道系统（OpenGov基础）
2. ✅ 多委员会支持（3个委员会）
3. ✅ 公投管理（审核侧）
4. ✅ 统一权限系统

---

## 📅 时间表

### Week 1: 轨道系统（5个工作日）

| 时间 | 任务 | 文件 | 代码量 |
|------|------|------|--------|
| Day 1 | 轨道服务层 | tracks.ts, useTracks.ts | 280行 |
| Day 2 | 轨道组件 | TrackSelector/, TrackInfoCard/ | 230行 |
| Day 3 | 集成现有页面 | Dashboard, Proposals, Analytics | +150行 |

**Week 1 产出**: 轨道系统可用，现有页面显示轨道信息

---

### Week 2: 公投管理（5个工作日）

| 时间 | 任务 | 文件 | 代码量 |
|------|------|------|--------|
| Day 4 | 公投服务层 | referenda.ts, useReferenda.ts | 350行 |
| Day 5 | Preimage服务 | preimage.ts | 150行 |
| Day 6-7 | 公投列表 | Referenda/List/ | 350行 |
| Day 8 | 公投详情 | Referenda/Detail/ | 300行 |

**Week 2 产出**: 公投管理功能完整，可按轨道查看和管理

---

### Week 3: 多委员会（5个工作日）

| 时间 | 任务 | 文件 | 代码量 |
|------|------|------|--------|
| Day 9 | 委员会类型 | committee.ts | 80行 |
| Day 10-11 | 通用Hook | useCollective.ts, usePermission.ts | 330行 |
| Day 12 | 委员会页面 | CommitteeSwitch/, Committees/ | 310行 |
| Day 13 | 集成测试 | App.tsx, BasicLayout | +70行 |

**Week 3 产出**: 3个委员会统一管理，权限系统完善

---

## 📋 新增文件清单（17个）

### 服务层（3个）
- [ ] `src/services/blockchain/tracks.ts`
- [ ] `src/services/blockchain/referenda.ts`
- [ ] `src/services/blockchain/preimage.ts`

### 类型定义（1个）
- [ ] `src/types/committee.ts`

### Hooks（4个）
- [ ] `src/hooks/useTracks.ts`
- [ ] `src/hooks/useReferenda.ts`
- [ ] `src/hooks/useCollective.ts`
- [ ] `src/hooks/usePermission.ts`

### 组件（5个）
- [ ] `src/components/TrackSelector/index.tsx`
- [ ] `src/components/TrackInfoCard/index.tsx`
- [ ] `src/components/CommitteeSwitch/index.tsx`
- [ ] `src/components/ProposalListGeneric/index.tsx`
- [ ] `src/components/PermissionGuard/index.tsx`

### 页面（4个）
- [ ] `src/pages/Referenda/List/index.tsx`
- [ ] `src/pages/Referenda/Detail/index.tsx`
- [ ] `src/pages/Committees/index.tsx`
- [ ] `src/pages/Tracks/index.tsx`

---

## 🔧 快速开始（Week 1, Day 1）

### 立即可做

#### 1. 创建轨道服务层（今天就可以开始）

```bash
cd /home/xiaodong/文档/memopark/memopark-governance

# 创建目录
mkdir -p src/types

# 开始编码
# 创建 src/services/blockchain/tracks.ts
# 创建 src/hooks/useTracks.ts
# 创建 src/components/TrackSelector/
```

#### 2. 第一个功能：查询轨道

**目标**: 今天完成轨道查询功能

**步骤**:
1. 创建 `tracks.ts`（轨道服务）
2. 创建 `useTracks.ts`（轨道Hook）
3. 在Dashboard测试显示轨道数量

**验证**:
```typescript
// 在Dashboard添加测试代码
const { tracks } = useTracks()
console.log('轨道数量:', tracks.length)
console.log('轨道列表:', tracks)
```

#### 3. 第二个功能：轨道选择器

**目标**: 第2天完成选择器组件

**步骤**:
1. 创建 `TrackSelector`组件
2. 添加到测试页面
3. 验证选择功能

---

## 💡 开发建议

### 1. 渐进式开发

```
不要一次性开发所有功能

建议流程:
  Day 1: 轨道查询 → 测试
  Day 2: 轨道选择器 → 测试
  Day 3: 集成现有页面 → 测试
  ...

每天有可运行的成果
```

### 2. 复用现有代码

```
可以复用:
  - useProposals的模式 → useReferenda
  - ProposalList的布局 → ReferendaList
  - 批量操作的逻辑 → 通用批量组件

减少开发时间
```

### 3. 参考最佳实践

```
参考资料:
  - Polkadot.js Apps: packages/page-referenda/
  - Subsquare: 轨道展示和筛选
  - 现有代码: Proposals页面的模式
```

---

## 📊 进度追踪

### Week 1 检查点

```
Day 1 结束:
  ✓ 能查询轨道配置？
  ✓ console.log显示正确？

Day 2 结束:
  ✓ 轨道选择器显示？
  ✓ 可以选择轨道？

Day 3 结束:
  ✓ Dashboard显示轨道统计？
  ✓ Proposals显示轨道标签？
```

### Week 2 检查点

```
Day 5 结束:
  ✓ 能查询公投？
  ✓ 数据结构正确？

Day 7 结束:
  ✓ 公投列表显示？
  ✓ 轨道筛选正常？

Day 8 结束:
  ✓ 公投详情完整？
  ✓ Preimage可查看？
```

### Week 3 检查点

```
Day 10 结束:
  ✓ 能查询3个委员会？
  ✓ 权限检查正确？

Day 12 结束:
  ✓ 委员会切换正常？
  ✓ 通用页面可用？

Day 13 结束:
  ✓ 整体功能联通？
  ✓ 文档完整？
```

---

## ✅ 第一周详细任务

### Day 1 任务清单

**上午（4小时）**：
- [ ] 创建 `src/services/blockchain/tracks.ts`
  - [ ] 定义TrackInfo接口
  - [ ] 实现getTracks()
  - [ ] 实现getTrackName()
  - [ ] 实现getTrackColor()
  - [ ] 测试查询

**下午（4小时）**：
- [ ] 创建 `src/hooks/useTracks.ts`
  - [ ] 实现useTracks Hook
  - [ ] 实现useTrack Hook
  - [ ] 错误处理
  - [ ] 在Dashboard测试

**验证标准**：
```bash
# 在Dashboard添加测试
const { tracks, loading } = useTracks()

console.log('查询到的轨道:', tracks)
// 应该看到：[{id:0, name:'Root',...}, {id:2, name:'Treasury',...}, ...]
```

### Day 2 任务清单

**上午（4小时）**：
- [ ] 创建 `src/components/TrackSelector/index.tsx`
  - [ ] 实现TrackSelector组件
  - [ ] 轨道卡片设计
  - [ ] 选中状态
  - [ ] 参数展示

**下午（4小时）**：
- [ ] 创建 `src/components/TrackInfoCard/index.tsx`
  - [ ] 紧凑卡片设计
  - [ ] 关键参数展示
  - [ ] 在测试页面验证

**验证标准**：
```bash
# 创建测试页面显示TrackSelector
→ 应该看到所有轨道卡片
→ 点击可以选择
→ 显示押金、决策期等参数
```

### Day 3 任务清单

**全天（8小时）**：
- [ ] 修改 `src/pages/Dashboard/index.tsx`
  - [ ] 添加轨道统计卡片
  - [ ] 按轨道分组显示数据

- [ ] 修改 `src/pages/Proposals/List/index.tsx`
  - [ ] 添加轨道列
  - [ ] 显示轨道标签

- [ ] 修改 `src/pages/Analytics/index.tsx`
  - [ ] 添加轨道维度分析
  - [ ] 轨道分布饼图

- [ ] 测试整体功能

**验证标准**：
```bash
# Dashboard应该显示
"Root轨道: 2个提案"
"财库轨道: 5个提案"

# Proposals列表应该显示
提案#5 | [财库轨道] | ...

# Analytics应该显示
轨道分布饼图
```

---

## 🚀 立即开始

### 现在可以做的

1. **查看详细方案**
```bash
cat /home/xiaodong/文档/memopark/docs/Phase4实施方案-轨道系统和多委员会.md
```

2. **创建工作分支**（可选）
```bash
cd /home/xiaodong/文档/memopark/memopark-governance
git checkout -b feat/phase4-tracks-committees
```

3. **开始Day 1任务**
- 创建tracks.ts
- 实现基础功能
- 测试验证

---

## 📚 参考资料

### 必读

1. **Phase4实施方案-轨道系统和多委员会.md** ⭐⭐⭐⭐⭐
   - 完整技术方案
   - 详细代码示例
   - UI设计方案

2. **轨道系统实现方案.md** ⭐⭐⭐⭐
   - 轨道原理说明
   - 配置建议
   - 数据结构

3. **治理Web平台-完善建议.md** ⭐⭐⭐⭐
   - 13项完善功能
   - 优先级分析

### 参考代码

1. **Polkadot.js Apps**
   - packages/page-referenda/
   - packages/page-council/

2. **现有代码**
   - src/pages/Proposals/
   - src/hooks/useProposals.ts

---

## ✅ 准备检查

开始前确认：
- [ ] 详细方案已阅读
- [ ] 技术路线清楚
- [ ] 开发环境就绪
- [ ] 参考资料准备好

---

**一切就绪，可以开始Phase 4开发！** 🚀

**建议**: 从Week 1 Day 1开始，循序渐进，每天验证成果。

**预期**: 3周后拥有完整的轨道系统和多委员会支持！

