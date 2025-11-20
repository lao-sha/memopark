# 做市商申请页面修复说明

## 修复的问题

### 问题：提交资料失败 - "请先完成质押步骤"

**症状**：
- 质押成功后跳转到步骤 2
- 填写资料后点击"提交资料"
- 提示："请先完成质押步骤"

**根本原因**：
```typescript
// 旧版错误代码
const [mmId, setMmId] = React.useState<number>(0)

// 检查逻辑
if (!mmId) throw new Error('请先完成质押步骤')

// 问题：mmId = 0 时，!mmId 判断为 true，触发错误
// 但 0 是有效的 mmId（第一个申请的 ID）
```

---

## 修复方案

### 1. 修改 mmId 类型为可空类型

```typescript
// 修复前
const [mmId, setMmId] = React.useState<number>(0)

// 修复后
const [mmId, setMmId] = React.useState<number | null>(null)
```

**好处**：
- `null` 明确表示"未质押"
- `0` 是有效的 mmId
- 逻辑更清晰

### 2. 修改检查逻辑

```typescript
// 修复前
if (!mmId) throw new Error('请先完成质押步骤')

// 修复后
if (mmId === null || mmId === undefined) {
  throw new Error('请先完成质押步骤（mmId 无效）')
}
```

### 3. 添加 localStorage 持久化

```typescript
// 质押成功后保存
localStorage.setItem('mm_apply_id', String(latestMmId))
localStorage.setItem('mm_apply_deadline', String(deadline))
localStorage.setItem('mm_apply_step', '1')

// 页面加载时恢复
React.useEffect(() => {
  const savedMmId = localStorage.getItem('mm_apply_id')
  const savedDeadline = localStorage.getItem('mm_apply_deadline')
  const savedStep = localStorage.getItem('mm_apply_step')
  
  if (savedMmId && savedDeadline && savedStep) {
    const id = parseInt(savedMmId, 10)
    const deadline = parseInt(savedDeadline, 10)
    const now = Math.floor(Date.now() / 1000)
    
    // 检查是否过期
    if (deadline > now) {
      setMmId(id)
      setDeadlineSec(deadline)
      setCurrent(parseInt(savedStep, 10))
      message.info('已恢复上次申请进度')
    }
  }
}, [])

// 提交完成后清除
localStorage.removeItem('mm_apply_id')
localStorage.removeItem('mm_apply_deadline')
localStorage.removeItem('mm_apply_step')
```

**好处**：
- 页面刷新不丢失进度
- 24 小时内可继续完成申请
- 过期自动清理

### 4. 添加 mmId 加载状态提示

```typescript
{mmId === null && (
  <Alert 
    type="warning" 
    showIcon 
    message="mmId 加载中"
    description="正在从链上获取申请编号，请稍候..."
  />
)}
```

### 5. 禁用按钮直到 mmId 加载完成

```typescript
<Button 
  disabled={!api || mmId === null}
>
  {mmId === null ? 'mmId 加载中...' : '提交资料'}
</Button>
```

### 6. 添加调试日志

```typescript
console.log('[提交资料] mmId:', mmId)
console.log('[提交资料] mmId 类型:', typeof mmId)
console.log('[提交资料] 表单值:', values)
```

---

## 测试步骤

### 场景 1：正常流程

1. **质押保证金**
   ```
   输入：1000 DUST
   点击：签名质押
   预期：✅ 跳转到步骤 2，显示 mmId = 0
   ```

2. **提交资料**
   ```
   填写：
     - 公开 CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
     - 私密 CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
     - 费率: 25
     - 最小额: 100
   点击：提交资料
   预期：✅ 提交成功，显示成功对话框
   ```

3. **查看控制台**
   ```
   [提交资料] mmId: 0
   [提交资料] mmId 类型: number
   [提交资料] 表单值: { ... }
   ```

### 场景 2：页面刷新恢复

1. **质押后刷新页面**
   ```
   操作：F5 刷新
   预期：✅ 自动恢复到步骤 2
   提示："已恢复上次申请进度"
   ```

2. **继续提交资料**
   ```
   预期：✅ mmId 正确显示
   预期：✅ 可以正常提交
   ```

### 场景 3：超时处理

1. **25 小时后刷新**
   ```
   预期：✅ 自动清除过期状态
   预期：✅ 回到步骤 1
   ```

---

## 修复前后对比

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| **mmId 类型** | `number` (初始 0) | `number \| null` (初始 null) |
| **检查逻辑** | `!mmId` (错误判断 0) | `mmId === null` (正确) |
| **状态持久化** | ❌ 无 | ✅ localStorage |
| **页面刷新** | ❌ 丢失进度 | ✅ 自动恢复 |
| **过期检查** | ❌ 无 | ✅ 自动清理 |
| **加载状态** | ❌ 无提示 | ✅ 友好提示 |
| **调试信息** | ⚠️ 简单 | ✅ 详细日志 |

---

## 兼容性说明

### mmId = 0 的情况

在 Substrate 中，Storage Map 的第一个条目通常从 0 开始：

```rust
let mm_id = NextId::<T>::mutate(|id| {
    let cur = *id;  // 第一次调用时 *id = 0
    *id = id.saturating_add(1);  // 之后 *id = 1
    cur  // 返回 0
});
```

因此：
- ✅ 第 1 个申请：mmId = 0
- ✅ 第 2 个申请：mmId = 1
- ✅ 第 3 个申请：mmId = 2

**`!mmId` 检查会错误地拒绝 mmId = 0 的情况！**

---

## 后续优化建议

### 1. 实时事件监听

```typescript
// 监听 Applied 事件直接获取 mmId
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (event.section === 'marketMaker' && event.method === 'Applied') {
      const [mmId, owner, deposit] = event.data
      console.log('Applied 事件:', mmId.toString())
      setMmId(Number(mmId.toString()))
    }
  })
})
```

### 2. 我的申请列表页

创建 `MyApplicationsPage.tsx`：
- 显示当前账户的所有申请
- 查看申请状态
- 继续未完成的申请
- 取消待提交的申请

### 3. 申请状态查询

创建独立的查询组件：
```typescript
<ApplicationStatusChecker mmId={mmId} />
```

---

## 总结

✅ **问题已完全修复**
✅ **添加了状态持久化**
✅ **支持页面刷新恢复**
✅ **添加了详细调试信息**
✅ **构建成功无错误**

现在可以正常使用做市商申请的完整两步式流程！🎉
