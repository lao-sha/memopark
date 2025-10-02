# 做市商审核页面 - 双视图功能说明

## 功能概述

审核页面 (`#/gov/mm-review`) 现在支持两个视图模式：

1. **待审核** - 显示所有 `PendingReview` 状态的申请
2. **已审核** - 显示所有 `Active` 状态的做市商

---

## 界面设计

### 顶部切换器（Segmented）

```
┌─────────────────────────────────┐
│  【待审核 (2)】 【已审核 (5)】   │ ← 点击切换视图
└─────────────────────────────────┘
```

- **待审核**：橙色 Tag，显示数量
- **已审核**：绿色 Tag，显示数量
- 切换时自动清除选中项
- 切换时自动加载对应数据

### 刷新按钮

- 待审核模式：`刷新待审列表`
- 已审核模式：`刷新已批准列表`

---

## 视图 1：待审核

### 数据来源
```typescript
// 遍历链上 Applications 存储
// 筛选 status === PendingReview (或 1)
const isPendingReview = (status) => {
  return status === 'PendingReview' || 
         status === 'pendingReview' ||
         status?.pendingReview !== undefined ||
         status === 1
}
```

### 列表显示

```
┌──────────────────────────┐
│ #0 【待审核】             │
│ 申请人: 5GrwvaEF...Jd     │
│ 质押: 1000 MEMO           │
│ 费率: 25 bps (0.25%)      │
│ 提交时间: 2025-09-30 10:23│
└──────────────────────────┘
```

### 详情操作

点击列表项后显示：
- 完整申请信息
- 公开/私密 CID（可复制、可查看）
- 解密提示和审查步骤
- **批准** 按钮（绿色）
- **驳回** 按钮（红色）

---

## 视图 2：已审核

### 数据来源
```typescript
// 遍历链上 Applications 存储
// 筛选 status === Active (或 2)
const isActive = (status) => {
  return status === 'Active' || 
         status === 'active' ||
         status?.active !== undefined ||
         status === 2
}
```

### 列表显示

```
┌──────────────────────────┐
│ #1 【已批准】             │
│ 申请人: 5D5aBzXy...Yx     │
│ 质押: 5000 MEMO           │
│ 费率: 20 bps (0.20%)      │
│ 批准时间: 2025-09-30 14:15│
└──────────────────────────┘
```

### 详情信息

点击列表项后显示：
- 完整做市商信息
- 公开/私密 CID（可复制、可查看）
- **已批准做市商**提示（绿色）
- 说明：
  - 质押金额已转为长期保证金
  - 做市商状态：Active（激活）
  - 可在 OTC 订单系统中看到该做市商

**注意**：已审核视图不显示批准/驳回按钮（状态已终结）

---

## 状态标识

### Tag 颜色系统

| 状态 | Tag 颜色 | 显示文本 | 说明 |
|------|---------|---------|------|
| `DepositLocked` | blue | 已质押 | 已质押但未提交资料 |
| `PendingReview` | orange | 待审核 | 已提交资料，待委员会审核 |
| `Active` | green | 已批准 ✓ | 审核通过，做市商激活 |
| `Rejected` | red | 已驳回 | 审核未通过 |
| `Cancelled` | default | 已取消 | 申请人取消 |
| `Expired` | volcano | 已过期 | 超时未处理 |

---

## 使用场景

### 场景 1：委员会审核新申请

1. 访问 `#/gov/mm-review`
2. 默认显示"待审核"视图
3. 查看待审列表（橙色 Tag）
4. 点击申请查看详情
5. 批准或驳回

### 场景 2：查看已批准做市商

1. 点击"已审核" Tab
2. 自动加载所有 Active 状态的做市商
3. 查看做市商列表（绿色 Tag）
4. 点击查看详情
5. 复制 CID 或查看公开资料

### 场景 3：批准后验证

1. 在"待审核"视图批准申请
2. 等待 8 秒自动刷新
3. 该申请从"待审核"列表消失
4. 切换到"已审核"视图
5. 看到新批准的做市商出现在列表中 ✅

---

## 技术实现

### 状态管理

```typescript
const [viewMode, setViewMode] = React.useState<string>('pending')
const [pendingList, setPendingList] = React.useState<any[]>([])
const [approvedList, setApprovedList] = React.useState<any[]>([])
```

### 数据加载

```typescript
React.useEffect(() => {
  if (api) {
    if (viewMode === 'pending') {
      loadPendingApplications()
    } else if (viewMode === 'approved') {
      loadApprovedApplications()
    }
  }
}, [api, viewMode])
```

### 视图切换

```typescript
const handleViewModeChange = (value: string) => {
  setViewMode(value)
  setSelectedApp(null)  // 清除选中项
}
```

### 列表数据源

```typescript
const currentList = viewMode === 'pending' ? pendingList : approvedList
```

---

## 查询性能

### 查询范围
- **待审核**：最近 100 个 ID，最多返回 20 个
- **已审核**：最近 100 个 ID，最多返回 50 个

### 优化建议
如果做市商数量很大（> 100），建议：
1. 集成 Subsquid 索引服务
2. 实现分页加载
3. 添加搜索和筛选功能

---

## 用户体验优化

### 1. 数量显示

```
【待审核 (2)】  ← 实时显示数量
【已审核 (5)】  ← 方便快速了解状态
```

### 2. 切换清除

切换视图时：
- ✅ 清除选中项（避免显示错误状态）
- ✅ 自动加载新数据
- ✅ 更新列表标题

### 3. 条件渲染

- 待审核：显示批准/驳回按钮
- 已审核：仅显示信息，不可操作

### 4. 加载提示

```
待审核：正在加载待审申请...
已审核：正在加载已批准做市商...
```

---

## 测试步骤

### 测试 1：查看待审核

```bash
1. 访问 #/gov/mm-review
2. 默认显示"待审核"视图
3. 点击"刷新待审列表"
4. 查看列表（橙色 Tag）
5. 点击列表项查看详情
```

**预期**：
- ✅ 显示所有 PendingReview 状态的申请
- ✅ 数量正确显示在 Tab 上
- ✅ 详情区域有批准/驳回按钮

### 测试 2：批准后切换查看

```bash
1. 在"待审核"视图批准一个申请
2. 等待 8 秒（自动刷新）
3. 该申请从列表消失
4. 点击"已审核" Tab
5. 查看列表（绿色 Tag）
```

**预期**：
- ✅ "待审核"列表数量减 1
- ✅ "已审核"列表数量加 1
- ✅ 可以在"已审核"中看到刚批准的申请
- ✅ 详情区域显示"已批准做市商"提示

### 测试 3：控制台日志

```bash
# 切换到"已审核"视图时
[审核页] 开始查询已批准做市商，NextId: 5
[审核页-已批准] ID=4, status= Active
[审核页-已批准] ✓ ID=4 是 Active 状态，加入列表
[审核页-已批准] ID=3, status= PendingReview
[审核页-已批准] ID=2, status= Active
[审核页-已批准] ✓ ID=2 是 Active 状态，加入列表
[审核页-已批准] 查询完成，找到 2 个已批准做市商
✅ 找到 2 个已批准做市商
```

---

## 后续优化建议

### 1. 添加更多状态视图

```typescript
<Segmented
  options={[
    { label: '待审核', value: 'pending' },
    { label: '已批准', value: 'approved' },
    { label: '已驳回', value: 'rejected' },  // 新增
    { label: '全部', value: 'all' },         // 新增
  ]}
/>
```

### 2. 添加搜索功能

```typescript
<Input.Search
  placeholder="搜索 mmId 或申请人地址"
  onSearch={handleSearch}
/>
```

### 3. 添加筛选器

```typescript
<Select
  placeholder="按费率筛选"
  options={[
    { label: '低费率 (0-0.5%)', value: '0-50' },
    { label: '中费率 (0.5-1%)', value: '50-100' },
    { label: '高费率 (>1%)', value: '100+' },
  ]}
/>
```

### 4. 添加排序

```typescript
<Select
  placeholder="排序方式"
  options={[
    { label: '按时间降序', value: 'time_desc' },
    { label: '按质押金额降序', value: 'deposit_desc' },
    { label: '按费率升序', value: 'fee_asc' },
  ]}
/>
```

---

## 构建结果

```bash
✓ 5128 modules transformed.
✓ built in 15.82s
✅ 无编译错误
✅ 无 linter 错误
```

---

## 功能清单

- ✅ 双视图切换（待审核/已审核）
- ✅ Tag 标识和数量显示
- ✅ 自动加载对应数据
- ✅ 切换时清除选中项
- ✅ 条件渲染操作按钮
- ✅ 已批准做市商信息提示
- ✅ 详细调试日志
- ✅ 移动端友好设计

**功能已完成并通过构建验证！** 🎉
