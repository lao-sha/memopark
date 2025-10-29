# 家族关系组件 - 使用说明

## 📦 组件列表

### 1. RelationshipList - 家族关系列表

**功能**：以列表形式展示某个逝者的所有家族关系。

**特性**：
- ✅ 支持按关系类型分组（父母、配偶、兄弟姐妹、子女）
- ✅ 显示关联逝者的详细信息（姓名、性别、生卒日期）
- ✅ 点击跳转到关联逝者详情页
- ✅ 移动端友好设计

---

### 2. RelationshipGraph - 家族关系图谱

**功能**：以可视化图谱形式展示家族关系网络。

**特性**：
- ✅ 递归查询多层关系（默认3层，最多5层）
- ✅ 网络图展示（圆形布局）
- ✅ 节点交互（点击、悬停）
- ✅ 关系统计（父母、配偶、兄弟姐妹、子女数量）
- ✅ 性别区分（男性蓝色、女性粉色）
- ✅ 关系类型区分（不同颜色和箭头）

---

### 3. Hook: useRelationships

**功能**：查询家族关系的React Hook。

**提供的Hook**：
- `useRelationships(deceasedId)` - 查询单个逝者的关系
- `useRelationshipGraph(rootDeceasedId, maxDepth)` - 查询家族图谱
- `useDeceasedDetail(deceasedId)` - 查询逝者详情

---

## 🎯 快速开始

### 示例1：在详情页显示关系列表

```tsx
import React from 'react'
import { Card, Tabs } from 'antd'
import RelationshipList from '../../components/deceased/RelationshipList'

const DeceasedDetailPage: React.FC = () => {
  const [deceasedId, setDeceasedId] = React.useState(100)
  
  return (
    <Card title="家族关系">
      <RelationshipList
        deceasedId={deceasedId}
        onDeceasedClick={(id) => {
          window.location.hash = `#/deceased/${id}`
        }}
        showDetails={true}
        groupByKind={true}
      />
    </Card>
  )
}
```

---

### 示例2：显示家族图谱

```tsx
import React from 'react'
import { Card } from 'antd'
import RelationshipGraph from '../../components/deceased/RelationshipGraph'

const FamilyTreePage: React.FC = () => {
  const [deceasedId, setDeceasedId] = React.useState(100)
  
  return (
    <Card title="家族图谱">
      <RelationshipGraph
        rootDeceasedId={deceasedId}
        maxDepth={3}
        onNodeClick={(id) => {
          console.log('点击节点：', id)
        }}
        height={600}
      />
    </Card>
  )
}
```

---

### 示例3：使用Hook查询关系

```tsx
import React from 'react'
import { useRelationships } from '../../hooks/useRelationships'

const MyComponent: React.FC = () => {
  const { relationships, loading, error } = useRelationships(100)
  
  if (loading) return <div>加载中...</div>
  if (error) return <div>错误：{error}</div>
  
  return (
    <div>
      <h3>家族关系（{relationships.length}）</h3>
      <ul>
        {relationships.map(rel => (
          <li key={`${rel.from}-${rel.to}`}>
            {rel.kindLabel}: 逝者 #{rel.to}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## 🔧 API 参数

### RelationshipList Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `deceasedId` | `number` | **必填** | 逝者ID |
| `onDeceasedClick` | `(deceasedId: number) => void` | - | 点击关联逝者时的回调 |
| `showDetails` | `boolean` | `true` | 是否显示详细信息 |
| `groupByKind` | `boolean` | `false` | 是否按关系类型分组 |

---

### RelationshipGraph Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `rootDeceasedId` | `number` | **必填** | 根节点逝者ID |
| `maxDepth` | `number` | `3` | 最大递归深度（1-5） |
| `onNodeClick` | `(deceasedId: number) => void` | - | 点击节点时的回调 |
| `height` | `number` | `600` | 图谱高度（px） |

---

### useRelationships Hook

**用法**：
```typescript
const { relationships, loading, error } = useRelationships(deceasedId)
```

**返回值**：
```typescript
{
  relationships: Relationship[]  // 关系列表
  loading: boolean               // 加载状态
  error: string                  // 错误信息
}
```

**Relationship 类型**：
```typescript
interface Relationship {
  from: number      // 关系发起方
  to: number        // 关系接收方
  kind: number      // 关系类型（0=父母，1=配偶，2=兄弟姐妹，3=子女）
  kindLabel: string // 关系类型标签
  note?: string     // 备注
  createdAt?: number // 创建时间
}
```

---

### useRelationshipGraph Hook

**用法**：
```typescript
const { graphData, loading, error, reload } = useRelationshipGraph(rootDeceasedId, maxDepth)
```

**返回值**：
```typescript
{
  graphData: RelationshipGraphData  // 图谱数据
  loading: boolean                  // 加载状态
  error: string                     // 错误信息
  reload: () => void                // 重新加载
}
```

**RelationshipGraphData 类型**：
```typescript
interface RelationshipGraphData {
  nodes: DeceasedNode[]     // 节点列表
  edges: Relationship[]     // 边列表
}

interface DeceasedNode {
  id: number
  name?: string
  gender?: string
  birth?: string
  death?: string
  mainImageCid?: string
  owner?: string
}
```

---

## 🎨 UI 效果

### 列表视图（按类型分组）

```
┌─────────────────────────────────────┐
│ 👨‍👩 父母（2）                         │
├─────────────────────────────────────┤
│ 👤 张三 | 父母 | 男                 │
│    1920-01-01 - 1990-12-31         │
│    [查看详情]                       │
├─────────────────────────────────────┤
│ 👤 李四 | 父母 | 女                 │
│    1925-05-10 - 1995-08-20         │
│    [查看详情]                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 💑 配偶（1）                         │
├─────────────────────────────────────┤
│ 👤 王五 | 配偶 | 女                 │
│    1955-03-15 - 2020-11-25         │
│    [查看详情]                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 👶 子女（3）                         │
├─────────────────────────────────────┤
│ 👤 赵六 | 子女 | 男                 │
│    1980-06-20 - (在世)             │
│    [查看详情]                       │
├─────────────────────────────────────┤
│ ...                                 │
└─────────────────────────────────────┘
```

---

### 图谱视图

```
┌─────────────────────────────────────┐
│ 递归深度：[3▼]  [刷新]             │
│ 节点：12  关系：15                   │
├─────────────────────────────────────┤
│          [父亲]                     │
│         /      \                    │
│    [本人] ─── [配偶]               │
│     /  \                            │
│ [子女1] [子女2]                    │
│                                     │
│ 图例：● 男性  ● 女性  ● 保密       │
└─────────────────────────────────────┘
```

---

## 📊 关系类型说明

| 代码 | 名称 | 方向性 | 颜色 | 说明 |
|------|------|--------|------|------|
| 0 | ParentOf | 有向 | 蓝色 | A是B的父母 |
| 1 | SpouseOf | 无向 | 粉色 | A和B是配偶 |
| 2 | SiblingOf | 无向 | 绿色 | A和B是兄弟姐妹 |
| 3 | ChildOf | 有向 | 橙色 | A是B的子女 |

**有向关系**：带箭头，表示方向性（父母→子女）  
**无向关系**：无箭头，双向等价（配偶、兄弟姐妹）

---

## 🚀 集成到现有页面

### 集成到 GraveDetailPage

**在墓位详情页添加"家族关系"标签页**：

```tsx
// GraveDetailPage.tsx
import RelationshipList from '../../components/deceased/RelationshipList'
import RelationshipGraph from '../../components/deceased/RelationshipGraph'

// 在 Tabs 中添加新标签页
<Tabs
  activeKey={activeTab}
  onChange={setActiveTab}
  items={[
    { key:'deceased', label:'逝者信息' },
    { key:'album', label:'相册' },
    { key:'video', label:'视频' },
    { key:'life', label:'生平' },
    { key:'article', label:'追忆文章' },
    // 新增：家族关系
    {
      key: 'relationships',
      label: '家族关系',
      children: (
        <Card size="small">
          <Tabs items={[
            {
              key: 'list',
              label: '列表',
              children: (
                <RelationshipList
                  deceasedId={selectedDeceasedId}
                  onDeceasedClick={(id) => {
                    // 跳转到逝者详情
                    window.location.hash = `#/deceased/${id}`
                  }}
                  groupByKind={true}
                />
              ),
            },
            {
              key: 'graph',
              label: '图谱',
              children: (
                <RelationshipGraph
                  rootDeceasedId={selectedDeceasedId}
                  maxDepth={3}
                  onNodeClick={(id) => {
                    window.location.hash = `#/deceased/${id}`
                  }}
                />
              ),
            },
          ]} />
        </Card>
      ),
    },
  ]}
/>
```

---

### 集成到路由

**在路由配置中添加独立页面**：

```tsx
// routes.tsx
import RelationshipPage from './features/deceased/RelationshipPage'

const routes = [
  // ... 其他路由
  {
    path: '/deceased/relationships',
    element: <RelationshipPage />,
  },
]
```

**访问方式**：
```
http://localhost:5173/#/deceased/relationships?id=100
```

---

## 🔥 高级用法

### 1. 自定义节点渲染（图谱）

如需自定义节点样式，可以修改 `NetworkGraph` 组件中的节点渲染逻辑：

```tsx
// RelationshipGraph.tsx (L200-230)
<circle
  cx={pos.x}
  cy={pos.y}
  r={nodeRadius}
  fill={getNodeColor(node.gender)}
  stroke={isHovered ? '#1890ff' : '#fff'}
  strokeWidth={isHovered ? 3 : 2}
  opacity={0.8}
/>
```

---

### 2. 自定义关系类型

如果需要添加新的关系类型，修改 `getRelationLabel` 函数：

```typescript
// useRelationships.ts (L32-42)
export function getRelationLabel(kind: number): string {
  switch (kind) {
    case 0: return '父母'
    case 1: return '配偶'
    case 2: return '兄弟姐妹'
    case 3: return '子女'
    case 4: return '祖父母'  // 新增
    case 5: return '孙子女'  // 新增
    default: return '未知关系'
  }
}
```

---

### 3. 使用 React Flow 实现高级图谱

**安装依赖**：
```bash
npm install reactflow
```

**创建高级图谱组件**：
```tsx
import ReactFlow, { Node, Edge, Controls, Background } from 'reactflow'
import 'reactflow/dist/style.css'

const AdvancedRelationshipGraph: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const { graphData, loading } = useRelationshipGraph(deceasedId, 3)
  
  const nodes: Node[] = graphData.nodes.map(n => ({
    id: String(n.id),
    data: { label: n.name || `#${n.id}` },
    position: { x: 0, y: 0 },
    type: 'default',
  }))
  
  const edges: Edge[] = graphData.edges.map((e, i) => ({
    id: `edge-${i}`,
    source: String(e.from),
    target: String(e.to),
    label: e.kindLabel,
    animated: true,
  }))
  
  return (
    <div style={{ height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      >
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}
```

**特性**：
- ✅ 拖拽节点
- ✅ 缩放
- ✅ 自动布局
- ✅ 更多交互功能

---

## 🐛 常见问题

### Q1: 为什么图谱显示空白？

**原因**：逝者没有家族关系记录。

**解决**：
1. 检查逝者ID是否正确
2. 使用 `propose_relation` 接口添加关系
3. 确保关系已被 `approve_relation` 批准

---

### Q2: 如何查询多层关系（家族谱系）？

**方案**：使用 `useRelationshipGraph` Hook 并设置 `maxDepth`。

```tsx
const { graphData } = useRelationshipGraph(deceasedId, 5)  // 查询5层
```

**注意**：深度越大，查询时间越长，建议不超过5层。

---

### Q3: 如何优化性能（>50个节点）？

**建议**：
1. **使用 React Flow**：支持虚拟渲染，性能更好
2. **限制递归深度**：最多3-5层
3. **懒加载**：按需展开节点
4. **缓存查询结果**：避免重复请求

---

### Q4: 如何导出家族图谱为图片？

**方案**：使用 `html2canvas` 库。

```bash
npm install html2canvas
```

```tsx
import html2canvas from 'html2canvas'

const exportGraph = async () => {
  const element = document.getElementById('graph-container')
  if (!element) return
  
  const canvas = await html2canvas(element)
  const link = document.createElement('a')
  link.download = 'family-tree.png'
  link.href = canvas.toDataURL()
  link.click()
}
```

---

## 📚 相关文档

- [Deceased Pallet 关联逻辑分析](../../../docs/Deceased-Pallet-关联逻辑-完整分析.md)
- [Deceased Pallet README](../../../pallets/deceased/README.md)
- [React Flow 文档](https://reactflow.dev/)

---

## 🎯 路线图

### 已完成 ✅
- [x] 家族关系列表组件
- [x] 家族关系图谱组件（简化版）
- [x] Hook：查询关系
- [x] Hook：查询图谱
- [x] 独立页面：RelationshipPage

### 计划中 ⏳
- [ ] React Flow 高级图谱
- [ ] 家族图谱导出（PDF/PNG）
- [ ] 关系提案管理面板
- [ ] 时间轴视图（按年代展示）
- [ ] 家谱打印模板

---

**最后更新**：2025-10-24  
**版本**：v1.0  
**状态**：✅ 可用

