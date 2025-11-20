# Deceased Pallet - 关联逝者逻辑 - 完整分析

## 📋 概述

**分析时间**：2025-10-24  
**分析目标**：检查 Deceased Pallet 中是否存在关联逝者的逻辑，以及如何使用

---

## ✅ 存在的关联逝者逻辑

### 1. 家族关系系统 (Relations)

#### 存储结构

**主存储**：`Relations<T>`（双映射）
```rust
pub type Relations<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,      // 关系发起方
    Blake2_128Concat,
    T::DeceasedId,      // 关系接收方
    Relation<T>,        // 关系详情
    OptionQuery,
>;
```

**索引存储**：`RelationsByDeceased<T>`（单映射）
```rust
pub type RelationsByDeceased<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    BoundedVec<(T::DeceasedId, u8), ConstU32<128>>,  // 最多128个关系
    ValueQuery,
>;
```

**待批准提案**：`PendingRelationRequests<T>`（双映射）
```rust
pub type PendingRelationRequests<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,      // 发起方
    Blake2_128Concat,
    T::DeceasedId,      // 接收方
    (
        u8,                                    // 关系类型
        T::AccountId,                          // 创建者
        BoundedVec<u8, T::StringLimit>,        // 备注
        BlockNumberFor<T>,                     // 创建时间
    ),
    OptionQuery,
>;
```

#### 关系类型

| 类型代码 | 关系名称 | 方向性 | 说明 |
|---------|---------|-------|------|
| 0 | ParentOf | 有向 | A是B的父母 |
| 1 | SpouseOf | 无向 | A和B是配偶 |
| 2 | SiblingOf | 无向 | A和B是兄弟姐妹 |
| 3 | ChildOf | 有向 | A是B的子女 |

#### 核心接口

**1. propose_relation** - 发起关系提案
```rust
#[pallet::call_index(25)]
pub fn propose_relation(
    origin: OriginFor<T>,
    from: T::DeceasedId,
    to: T::DeceasedId,
    kind: u8,
    note: Vec<u8>,
) -> DispatchResult
```

**功能**：
- `from` 方管理员发起关系建立提案
- 写入 `PendingRelationRequests(from, to)`
- 等待 `to` 方管理员批准

**2. approve_relation** - 批准关系提案
```rust
#[pallet::call_index(26)]
pub fn approve_relation(
    origin: OriginFor<T>,
    from: T::DeceasedId,
    to: T::DeceasedId,
) -> DispatchResult
```

**功能**：
- `to` 方管理员批准提案
- 将关系写入 `Relations(from, to)`
- 更新 `RelationsByDeceased` 索引
- 对于无向关系（配偶、兄弟姐妹），双方都会记录

**3. reject_relation** - 拒绝关系提案
```rust
#[pallet::call_index(27)]
pub fn reject_relation(
    origin: OriginFor<T>,
    from: T::DeceasedId,
    to: T::DeceasedId,
) -> DispatchResult
```

**4. revoke_relation** - 撤销已建立的关系
```rust
#[pallet::call_index(28)]
pub fn revoke_relation(
    origin: OriginFor<T>,
    from: T::DeceasedId,
    to: T::DeceasedId,
) -> DispatchResult
```

**功能**：
- 任一方管理员可撤销
- 从 `Relations` 中删除
- 从 `RelationsByDeceased` 索引中移除

**5. cancel_relation_proposal** - 取消待批准提案
```rust
#[pallet::call_index(29)]
pub fn cancel_relation_proposal(
    origin: OriginFor<T>,
    from: T::DeceasedId,
    to: T::DeceasedId,
) -> DispatchResult
```

---

### 2. 亲友团系统 (FriendsOf)

#### 存储结构

**主存储**：`FriendsOf<T>`（双映射）
```rust
pub type FriendsOf<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,      // 逝者ID
    Blake2_128Concat,
    T::AccountId,       // 成员账户
    FriendRole,         // 角色（Member/Core）
    OptionQuery,
>;
```

**角色定义**：
```rust
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen, Debug)]
pub enum FriendRole {
    Member,  // 普通成员
    Core,    // 核心成员（有更高权限）
}
```

**统计存储**：`FriendCount<T>`
```rust
pub type FriendCount<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::DeceasedId,
    u32,
    ValueQuery,
>;
```

#### 核心接口

**1. leave_friend_group** - 退出亲友团
```rust
#[pallet::call_index(20)]
pub fn leave_friend_group(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
) -> DispatchResult
```

**2. kick_friend** - 移除成员
```rust
#[pallet::call_index(21)]
pub fn kick_friend(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    friend: T::AccountId,
) -> DispatchResult
```

**3. set_friend_role** - 设置成员角色
```rust
#[pallet::call_index(22)]
pub fn set_friend_role(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    friend: T::AccountId,
    new_role: FriendRole,
) -> DispatchResult
```

---

### 3. 同墓逝者系统 (DeceasedByGrave)

#### 存储结构

**主存储**：`DeceasedByGrave<T>`（单映射）
```rust
pub type DeceasedByGrave<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,                    // GraveId
    Vec<T::DeceasedId>,     // 逝者ID列表（无限制）
    ValueQuery,
>;
```

**特点**：
- ✅ **无容量限制**：使用 `Vec` 而非 `BoundedVec`，支持家族墓/纪念墓
- ✅ **自动同步**：与 `pallet-stardust-grave::Interments` 保持同步
- ✅ **分页支持**：前端通过分页加载优化性能

#### 核心逻辑

**1. 创建逝者时自动添加**（L1230）
```rust
DeceasedByGrave::<T>::mutate(grave_id, |maybe_list| {
    if let Some(list) = maybe_list {
        list.push(id);
    } else {
        *maybe_list = Some(vec![id]);
    }
});
```

**2. 迁移逝者时自动维护**（L1519-1533）
```rust
// 添加到新墓位
DeceasedByGrave::<T>::mutate(new_grave, |maybe_list| {
    if let Some(list) = maybe_list {
        list.push(id);
    } else {
        *maybe_list = Some(vec![id]);
    }
});

// 从旧墓位移除
DeceasedByGrave::<T>::mutate(old_grave, |maybe_list| {
    if let Some(list) = maybe_list {
        if let Some(pos) = list.iter().position(|x| x == &id) {
            list.swap_remove(pos);
        }
    }
});
```

**3. 自动同步到 grave pallet**（L1258-1263）
```rust
// 创建时记录安葬
T::GraveProvider::record_interment(&who, grave_id, token_hash_u64)?;

// 迁移时记录起掘和安葬
T::GraveProvider::record_exhumation(&who, old_grave, token_hash_u64)?;
T::GraveProvider::record_interment(&who, new_grave, token_hash_u64)?;
```

---

## 🔍 查询方式

### 1. 查询某个逝者的所有家族关系

**方式A：通过索引查询（推荐）**
```typescript
// 前端代码
const api = await getApi()
const deceasedId = 100

// 查询 RelationsByDeceased 获取所有关系
const relations: any = await api.query.deceased.relationsByDeceased(deceasedId)
const relationList = relations.toJSON() // [(peer_id, kind), ...]

// 批量查询关系详情
for (const [peerId, kind] of relationList) {
  const detail = await api.query.deceased.relations(deceasedId, peerId)
  // 或反向查询（取决于存储顺序）
  // const detail = await api.query.deceased.relations(peerId, deceasedId)
  
  console.log(`关系类型：${kind}`, detail)
}
```

**方式B：通过主存储遍历（不推荐）**
```typescript
// 需要遍历所有 Relations 映射，效率低
const entries = await api.query.deceased.relations.entries()
// ...
```

### 2. 查询某个逝者的亲友团成员

```typescript
// 前端代码
const api = await getApi()
const deceasedId = 100

// 查询所有亲友团成员
const entries = await api.query.deceased.friendsOf.entries(deceasedId)

entries.forEach(([key, value]) => {
  const account = key.args[1].toString()
  const role = value.toJSON() // "Member" or "Core"
  console.log(`成员：${account}, 角色：${role}`)
})

// 查询亲友团人数
const count = await api.query.deceased.friendCount(deceasedId)
console.log(`亲友团人数：${count}`)
```

### 3. 查询同墓逝者（合葬）

```typescript
// 前端代码
const api = await getApi()
const graveId = 10

// 查询墓位下所有逝者
const deceasedIds: any = await api.query.deceased.deceasedByGrave(graveId)
const ids = deceasedIds.toJSON() // [100, 101, 102, ...]

// 批量查询逝者详情
const details = await api.query.deceased.deceasedOf.multi(ids)

details.forEach((detail, index) => {
  if (detail.isSome) {
    const d = detail.unwrap()
    console.log(`逝者 #${ids[index]}:`, d.toJSON())
  }
})
```

---

## 🎨 前端展示方案

### 1. 家族关系图谱

#### 方案A：树状图（推荐）

```
         [祖父]
            |
      ┌─────┴─────┐
    [父亲]      [叔叔]
      |
  ┌───┴───┐
[本人]  [兄弟]
  |
[子女]
```

**技术栈**：
- `D3.js` - 专业数据可视化库
- `React Flow` - React 流程图组件
- `vis-network` - 网络图组件

**实现示例**：
```tsx
import ReactFlow, { Node, Edge } from 'reactflow'

const FamilyTree: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  
  useEffect(() => {
    loadFamilyTree(deceasedId).then(({ nodes, edges }) => {
      setNodes(nodes)
      setEdges(edges)
    })
  }, [deceasedId])
  
  return <ReactFlow nodes={nodes} edges={edges} />
}

async function loadFamilyTree(deceasedId: number) {
  const api = await getApi()
  
  // 查询所有关系
  const relations: any = await api.query.deceased.relationsByDeceased(deceasedId)
  const relationList = relations.toJSON()
  
  const nodes: Node[] = [{ id: String(deceasedId), data: { label: '本人' } }]
  const edges: Edge[] = []
  
  for (const [peerId, kind] of relationList) {
    nodes.push({ id: String(peerId), data: { label: `逝者#${peerId}` } })
    edges.push({
      id: `${deceasedId}-${peerId}`,
      source: String(deceasedId),
      target: String(peerId),
      label: getRelationLabel(kind),
    })
  }
  
  return { nodes, edges }
}

function getRelationLabel(kind: number): string {
  switch (kind) {
    case 0: return '父母'
    case 1: return '配偶'
    case 2: return '兄弟姐妹'
    case 3: return '子女'
    default: return '未知'
  }
}
```

#### 方案B：列表展示（简单）

```tsx
import { List, Tag } from 'antd'

const RelationList: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const [relations, setRelations] = useState<Array<{ peerId: number, kind: number }>>([])
  
  useEffect(() => {
    loadRelations(deceasedId).then(setRelations)
  }, [deceasedId])
  
  return (
    <List
      dataSource={relations}
      renderItem={({ peerId, kind }) => (
        <List.Item>
          <Tag color="blue">{getRelationLabel(kind)}</Tag>
          <a href={`#/deceased/${peerId}`}>逝者 #{peerId}</a>
        </List.Item>
      )}
    />
  )
}
```

---

### 2. 同墓逝者展示

#### 方案A：使用已实现的分页组件（推荐）

```tsx
import DeceasedPaginatedList from '../../components/deceased/DeceasedPaginatedList'

const GraveDetail: React.FC<{ graveId: number }> = ({ graveId }) => {
  const [deceased, setDeceased] = useState<DeceasedItem[]>([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    loadDeceasedByGrave(graveId).then(setDeceased)
  }, [graveId])
  
  return (
    <DeceasedPaginatedList
      allDeceased={deceased}
      loading={loading}
      onItemClick={(item) => {
        // 点击查看详情
        window.location.hash = `#/deceased/${item.id}`
      }}
      pageSize={20}
      showPerformanceStats={true}
    />
  )
}
```

**优势**：
- ✅ 自动分页（支持无限容量墓位）
- ✅ 性能优化（大墓位智能提示）
- ✅ 移动端友好

#### 方案B：网格展示

```tsx
import { Card, Row, Col } from 'antd'

const DeceasedGrid: React.FC<{ graveId: number }> = ({ graveId }) => {
  const [deceased, setDeceased] = useState<DeceasedItem[]>([])
  
  return (
    <Row gutter={[16, 16]}>
      {deceased.map(d => (
        <Col xs={12} sm={8} md={6} lg={4} key={d.id}>
          <Card
            hoverable
            cover={
              d.mainImageCid ? (
                <img src={`https://ipfs.io/ipfs/${d.mainImageCid}`} />
              ) : null
            }
            onClick={() => window.location.hash = `#/deceased/${d.id}`}
          >
            <Card.Meta
              title={d.name}
              description={`${d.birth} - ${d.death}`}
            />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
```

---

### 3. 亲友团展示

```tsx
import { List, Avatar, Tag } from 'antd'

const FriendGroup: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const [friends, setFriends] = useState<Array<{ account: string, role: string }>>([])
  
  return (
    <List
      dataSource={friends}
      renderItem={({ account, role }) => (
        <List.Item>
          <List.Item.Meta
            avatar={<Avatar>{account.slice(0, 2)}</Avatar>}
            title={account}
            description={
              role === 'Core' ? (
                <Tag color="gold">核心成员</Tag>
              ) : (
                <Tag>普通成员</Tag>
              )
            }
          />
        </List.Item>
      )}
    />
  )
}
```

---

## 📊 数据统计

### 1. 关系统计

**查询某个逝者的关系数量**：
```typescript
const api = await getApi()
const relations: any = await api.query.deceased.relationsByDeceased(deceasedId)
const relationList = relations.toJSON()

const stats = {
  parents: relationList.filter(([_, kind]) => kind === 0).length,
  spouses: relationList.filter(([_, kind]) => kind === 1).length,
  siblings: relationList.filter(([_, kind]) => kind === 2).length,
  children: relationList.filter(([_, kind]) => kind === 3).length,
}

console.log('家族统计：', stats)
```

### 2. 墓位统计

**查询墓位容量**：
```typescript
const api = await getApi()
const deceasedIds: any = await api.query.deceased.deceasedByGrave(graveId)
const count = deceasedIds.toJSON().length

console.log(`墓位 #${graveId} 共有 ${count} 位逝者`)
```

---

## 🚀 功能扩展建议

### 优先级P1（核心功能）

#### 1. 家族图谱可视化

**需求**：
- 点击某个逝者，自动展示家族关系树
- 支持多层关系展开（父母、祖父母、子女、孙子女）
- 鼠标悬停显示详情

**技术方案**：
- 使用 `D3.js` 树状图
- 递归查询 `RelationsByDeceased`
- 缓存已查询的关系，避免重复请求

**前端实现**：
```tsx
import * as d3 from 'd3'

const FamilyTreeD3: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  
  useEffect(() => {
    if (!svgRef.current) return
    
    loadFamilyTreeRecursive(deceasedId, 3).then(data => {
      renderD3Tree(svgRef.current!, data)
    })
  }, [deceasedId])
  
  return <svg ref={svgRef} width={800} height={600} />
}

async function loadFamilyTreeRecursive(
  deceasedId: number,
  maxDepth: number,
  visited = new Set<number>()
): Promise<TreeNode> {
  if (visited.has(deceasedId) || maxDepth <= 0) {
    return { id: deceasedId, children: [] }
  }
  
  visited.add(deceasedId)
  const api = await getApi()
  const relations: any = await api.query.deceased.relationsByDeceased(deceasedId)
  const relationList = relations.toJSON()
  
  const children = await Promise.all(
    relationList.map(([peerId, kind]) =>
      loadFamilyTreeRecursive(peerId, maxDepth - 1, visited)
    )
  )
  
  return { id: deceasedId, children }
}
```

#### 2. 合葬墓位一键展示

**需求**：
- 点击某个逝者，自动显示同墓的所有逝者
- 支持墓位内搜索和筛选
- 显示墓位统计（总人数、性别比、年代分布）

**技术方案**：
- 查询 `DeceasedByGrave(grave_id)`
- 使用已实现的 `DeceasedPaginatedList` 组件
- 添加搜索和筛选功能

**前端实现**：
```tsx
const GraveDeceasedView: React.FC<{ graveId: number }> = ({ graveId }) => {
  const [deceased, setDeceased] = useState<DeceasedItem[]>([])
  const [searchText, setSearchText] = useState('')
  
  const filteredDeceased = useMemo(() => {
    if (!searchText) return deceased
    return deceased.filter(d =>
      d.name?.includes(searchText) ||
      d.token?.includes(searchText)
    )
  }, [deceased, searchText])
  
  return (
    <div>
      <Input.Search
        placeholder="搜索姓名或Token"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      
      <DeceasedPaginatedList
        allDeceased={filteredDeceased}
        loading={false}
        pageSize={20}
        showPerformanceStats={true}
      />
    </div>
  )
}
```

---

### 优先级P2（体验优化）

#### 1. 关系提案管理面板

**需求**：
- 查看所有待批准的关系提案
- 批量批准/拒绝
- 显示提案创建时间和备注

**技术方案**：
- 查询 `PendingRelationRequests` 所有条目
- 提供批量操作接口

#### 2. 亲友团活跃度统计

**需求**：
- 显示亲友团成员的活跃度（留言数、供奉金额）
- 排行榜展示
- 成员贡献统计

**技术方案**：
- 结合 `pallet-deceased-text::messagesByDeceased`
- 结合 `pallet-offerings` 供奉记录
- 前端聚合统计

---

### 优先级P3（高级功能）

#### 1. 家族族谱导出

**需求**：
- 导出完整家族谱系为PDF/PNG
- 支持多代家族关系
- 打印优化

**技术方案**：
- 使用 `html2canvas` + `jsPDF`
- 递归查询所有关系
- 生成树状图并导出

#### 2. 社交网络分析

**需求**：
- 分析逝者的社交网络（关系密度、中心度）
- 识别家族核心人物
- 生成社交关系报告

**技术方案**：
- 使用图算法（PageRank、Centrality）
- 分析 `Relations` 和 `FriendsOf` 数据
- 可视化展示

---

## 🎯 总结

### 现有功能 ✅

| 功能 | 存储 | 接口 | 前端支持 | 状态 |
|------|------|------|---------|------|
| **家族关系** | Relations | propose/approve/reject/revoke | ⏳ 待实现 | ✅ 链端完成 |
| **关系索引** | RelationsByDeceased | 查询接口 | ⏳ 待实现 | ✅ 链端完成 |
| **亲友团** | FriendsOf | leave/kick/set_role | ⏳ 待实现 | ✅ 链端完成 |
| **同墓逝者** | DeceasedByGrave | 自动维护 | ✅ 已实现 | ✅ 完成 |
| **分页加载** | - | - | ✅ 已实现 | ✅ 完成 |

### 待实现功能 ⏳

1. **家族图谱可视化**（P1）
   - 树状图展示
   - 递归查询
   - 交互式探索

2. **合葬墓位一键展示**（P1）
   - 点击逝者显示同墓者
   - 墓位统计
   - 搜索筛选

3. **关系提案管理**（P2）
   - 待批准提案列表
   - 批量操作
   - 提案详情

4. **亲友团管理面板**（P2）
   - 成员列表
   - 角色管理
   - 活跃度统计

### 技术建议

#### 1. 关系查询优化

**现状**：需要遍历 `RelationsByDeceased` 获取所有关系，再逐个查询详情。

**建议**：
- 使用 `api.query.deceased.relationsByDeceased.multi(ids)` 批量查询
- 前端缓存已查询的关系，避免重复请求
- 使用 `React Query` 管理查询缓存

#### 2. 家族图谱性能

**现状**：递归查询多层关系可能导致性能问题。

**建议**：
- 限制最大递归深度（3-5层）
- 使用 `Promise.all` 并发查询
- 添加加载状态和骨架屏
- 考虑使用 Subsquid 预聚合

#### 3. 前端组件化

**建议新建组件**：
- `RelationshipGraph` - 家族关系图谱
- `RelationshipList` - 家族关系列表
- `FriendGroupPanel` - 亲友团管理面板
- `SameTombstoneView` - 同墓逝者视图
- `RelationProposalManager` - 关系提案管理（已存在）

---

## 📝 下一步行动

### 立即可做（不需要链端修改）

1. ✅ **实现家族关系列表**：查询 `RelationsByDeceased` 显示列表
2. ✅ **实现合葬墓位展示**：已有 `DeceasedPaginatedList` 组件
3. ⏳ **实现亲友团面板**：查询 `FriendsOf` 显示成员

### 需要链端支持（可选）

1. ⏳ **添加关系聚合查询**：一次性获取多层关系（减少RPC调用）
2. ⏳ **添加关系统计接口**：返回关系数量（父母数、子女数等）
3. ⏳ **添加亲友团统计接口**：返回成员数、核心成员数

### 需要设计决策

1. ❓ **关系方向性**：ParentOf vs ChildOf 是否需要同时存储？
2. ❓ **关系上限**：128个关系是否足够？（当前 `BoundedVec<_, ConstU32<128>>`）
3. ❓ **亲友团上限**：是否需要限制亲友团人数？

---

**最后更新**：2025-10-24  
**状态**：✅ 分析完成  
**下一步**：前端实现家族关系可视化

