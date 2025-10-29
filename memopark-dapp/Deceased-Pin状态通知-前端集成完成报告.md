# Deceased Pin状态通知 - 前端集成完成报告

## 修改概述

**完成时间**：2025-10

**关联链端修复**：Deceased Pallet - P1 问题修复（方案A：职责分离）

**主要功能**：
1. ✅ 监听deceased相关的链上事件
2. ✅ 实时显示IPFS pin成功/失败状态
3. ✅ 提供友好的错误提示和建议操作
4. ✅ 优雅的UI反馈和动画效果

---

## 文件修改清单

### 新增文件

1. **`src/hooks/useDeceasedEvents.ts`** - 事件监听Hook
   - 监听链上deceased相关事件
   - 解析事件数据
   - 提供错误码转换工具

2. **`src/components/deceased/PinStatusIndicator.tsx`** - Pin状态指示器组件
   - 显示pin成功/失败状态
   - 错误码解释和建议
   - 支持重试功能（预留）

### 修改文件

3. **`src/features/deceased/CreateDeceasedForm.tsx`** - 创建逝者表单
   - 集成事件监听
   - 显示pin状态反馈
   - 优化用户体验流程

---

## 功能详情

### 1. useDeceasedEvents Hook

**位置**：`src/hooks/useDeceasedEvents.ts`

**功能**：
- 实时监听链上deceased模块的事件
- 支持的事件类型：
  - `DeceasedCreated` - 逝者创建
  - `DeceasedUpdated` - 逝者更新
  - `MainImageUpdated` - 主图更新（增强版，包含操作者）
  - `AutoPinSuccess` - IPFS自动pin成功
  - `AutoPinFailed` - IPFS自动pin失败

**核心API**：

```typescript
const { 
  events,                    // 事件列表
  listening,                 // 是否正在监听
  error,                     // 错误信息
  clearEvents,               // 清空事件
  getEventsByDeceasedId,     // 按ID获取事件
  getRecentPinFailures       // 获取最近的失败
} = useDeceasedEvents();
```

**事件数据结构**：

```typescript
// AutoPinSuccess
{
  deceasedId: 123,
  cid: "0x1234...",
  pinType: AutoPinType.NameFullCid, // 0=姓名, 1=主图
}

// AutoPinFailed
{
  deceasedId: 123,
  cid: "0x1234...",
  pinType: AutoPinType.NameFullCid,
  errorCode: PinErrorCode.InsufficientBalance, // 0=未知, 1=余额不足, 2=网络错误, 3=CID无效
}

// MainImageUpdated（增强版）
{
  deceasedId: 123,
  operator: "5GrwvaEF...", // 操作者账户
  isSet: true,              // true=设置, false=清空
}
```

**错误码映射**：

| 错误码 | 含义 | 用户提示 |
|--------|------|----------|
| 0 | 未知错误 | 未知错误 |
| 1 | 余额不足 | 余额不足，请充值后重试 |
| 2 | IPFS网络错误 | IPFS网络错误，请稍后重试 |
| 3 | CID格式无效 | CID格式无效，请检查 |

**工具函数**：

```typescript
// 获取错误消息
getPinErrorMessage(errorCode: PinErrorCode): string

// 获取建议操作
getPinErrorSuggestion(errorCode: PinErrorCode): string

// 获取pin类型名称
getPinTypeName(pinType: AutoPinType): string
```

---

### 2. PinStatusIndicator 组件

**位置**：`src/components/deceased/PinStatusIndicator.tsx`

**功能**：
- 显示pin成功/失败的可视化反馈
- 错误码解释和建议操作
- 优雅的动画和图标
- 可关闭的Alert样式

**使用示例**：

```tsx
// Pin成功
<PinStatusIndicator
  deceasedId={123}
  successData={{
    deceasedId: 123,
    cid: "0x1234...",
    pinType: AutoPinType.NameFullCid,
  }}
/>

// Pin失败
<PinStatusIndicator
  deceasedId={123}
  failedData={{
    deceasedId: 123,
    cid: "0x1234...",
    pinType: AutoPinType.NameFullCid,
    errorCode: PinErrorCode.InsufficientBalance,
  }}
  showRetry={true}
  onRetry={(id, type) => {
    // 处理重试逻辑
  }}
/>

// 正在pin
<PinStatusIndicator
  deceasedId={123}
  loading={true}
/>
```

**UI效果**：

**Pin成功**：
```
✅ 姓名已成功固定到IPFS  [3个副本]
CID: 0x1234567890abcdef...
副本数：3个（默认） · 分布式存储已生效
                              [×]
```

**Pin失败**：
```
⚠️ 姓名固定失败  [错误码: 1]

错误原因：余额不足，请充值后重试
ℹ️ 请充值后可在个人中心重试固定
CID: 0x1234567890abcdef...
             [重试固定]
                              [×]
```

**正在pin**：
```
ℹ️ 正在固定到IPFS...
使用triple-charge机制扣费，请稍候
```

**PinStatusBadge 组件（简洁版）**：

```tsx
<PinStatusBadge 
  successData={...} 
/>
// 显示：● 已Pin
```

---

### 3. CreateDeceasedForm 集成

**位置**：`src/features/deceased/CreateDeceasedForm.tsx`

**修改内容**：

1. **导入新依赖**：
```tsx
import { useDeceasedEvents, AutoPinType } from '../../hooks/useDeceasedEvents'
import { PinStatusIndicator } from '../../components/deceased/PinStatusIndicator'
```

2. **添加状态管理**：
```tsx
// 事件监听
const { events, getEventsByDeceasedId } = useDeceasedEvents(true)
const [latestDeceasedId, setLatestDeceasedId] = React.useState<number | null>(null)
const [pinStatusShown, setPinStatusShown] = React.useState(false)
```

3. **事件监听逻辑**：
```tsx
React.useEffect(() => {
  if (!latestDeceasedId || pinStatusShown) return

  const deceasedEvents = getEventsByDeceasedId(latestDeceasedId)
  
  // 检查是否有AutoPinSuccess或AutoPinFailed事件
  const hasAutoPin = deceasedEvents.some(e => 
    e.event === 'AutoPinSuccess' || e.event === 'AutoPinFailed'
  )

  if (hasAutoPin) {
    setPinStatusShown(true)
  }
}, [events, latestDeceasedId, getEventsByDeceasedId, pinStatusShown])
```

4. **UI渲染**：
```tsx
{/* Pin状态指示器 */}
{latestDeceasedId && (() => {
  const deceasedEvents = getEventsByDeceasedId(latestDeceasedId)
  const pinSuccess = deceasedEvents.find(e => e.event === 'AutoPinSuccess')
  const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed')
  
  if (pinSuccess || pinFailed) {
    return (
      <div style={{ marginTop: 12 }}>
        <PinStatusIndicator
          deceasedId={latestDeceasedId}
          successData={pinSuccess?.data}
          failedData={pinFailed?.data}
          showRetry={false}
        />
      </div>
    )
  }
  return null
})()}
```

5. **优化提交流程**：
```tsx
// 提交成功后
message.success({ key, content: `已提交创建逝者：${txHash}` })
setPwdOpen(false)

// 等待事件并显示pin状态
message.info({ key: 'waiting-events', content: '正在检测IPFS固定状态...' })

// 监听DeceasedCreated事件以获取新的deceased_id
const checkEvents = setInterval(() => {
  const createdEvent = events.find(e => e.event === 'DeceasedCreated')
  if (createdEvent) {
    setLatestDeceasedId(createdEvent.deceasedId)
    message.destroy('waiting-events')
    clearInterval(checkEvents)
  }
}, 500)

// 延迟跳转，让用户看到pin状态
setTimeout(() => {
  // 清理并跳转
  setTimeout(()=> { window.location.hash = '#/grave/my' }, 2000)
}, 3000)
```

---

## 用户体验流程

### 正常流程（Pin成功）

```
用户填写表单 → 点击"创建逝者"
    ↓
输入密码 → 点击"签名并提交"
    ↓
显示：正在提交交易...
    ↓
显示：已提交创建逝者：0xabc...
    ↓
显示：正在检测IPFS固定状态...
    ↓
显示：✅ 姓名已成功固定到IPFS [3个副本]
       CID: 0x1234... · 分布式存储已生效
    ↓
2秒后自动跳转到"我的墓地"
```

### 异常流程（Pin失败）

```
用户填写表单 → 点击"创建逝者"
    ↓
输入密码 → 点击"签名并提交"
    ↓
显示：正在提交交易...
    ↓
显示：已提交创建逝者：0xabc...
    ↓
显示：正在检测IPFS固定状态...
    ↓
显示：⚠️ 姓名固定失败 [错误码: 1]
       错误原因：余额不足，请充值后重试
       💡 请充值后可在个人中心重试固定
       CID: 0x1234...
    ↓
用户可以：
1. 关闭提示，继续操作（逝者已创建成功）
2. 充值后在个人中心重试固定
    ↓
2秒后自动跳转到"我的墓地"
```

---

## 错误处理对照表

| 链端错误码 | 前端显示 | 建议操作 |
|-----------|---------|---------|
| 0 - 未知错误 | ⚠️ 姓名固定失败<br>错误原因：未知错误 | 请联系客服处理 |
| 1 - 余额不足 | ⚠️ 姓名固定失败<br>错误原因：余额不足，请充值后重试 | 请充值后可在个人中心重试固定 |
| 2 - 网络错误 | ⚠️ 姓名固定失败<br>错误原因：IPFS网络错误，请稍后重试 | IPFS网络暂时不可用，系统会自动重试 |
| 3 - CID无效 | ⚠️ 姓名固定失败<br>错误原因：CID格式无效，请检查 | 请检查CID是否正确，必要时重新上传 |

---

## 其他页面集成建议

### 1. 更新逝者页面

```tsx
// src/features/deceased/UpdateDeceasedForm.tsx
import { useDeceasedEvents } from '@/hooks/useDeceasedEvents';
import { PinStatusIndicator } from '@/components/deceased/PinStatusIndicator';

const UpdateDeceasedForm = () => {
  const { events, getEventsByDeceasedId } = useDeceasedEvents();
  
  // 在更新name_full_cid时显示pin状态
  return (
    <>
      <Form.Item label="完整姓名CID">
        <Input />
      </Form.Item>
      
      {/* 显示pin状态 */}
      {latestEvents && (
        <PinStatusIndicator
          deceasedId={deceasedId}
          successData={...}
          failedData={...}
        />
      )}
    </>
  );
};
```

### 2. 设置主图页面

```tsx
// src/features/deceased/SetMainImageForm.tsx
import { useDeceasedEvents, AutoPinType } from '@/hooks/useDeceasedEvents';
import { PinStatusIndicator } from '@/components/deceased/PinStatusIndicator';

const SetMainImageForm = () => {
  const { events, getEventsByDeceasedId } = useDeceasedEvents();
  
  return (
    <>
      <Upload>上传主图</Upload>
      
      {/* 显示主图pin状态 */}
      {latestEvents && (
        <PinStatusIndicator
          deceasedId={deceasedId}
          successData={mainImageSuccess}
          failedData={mainImageFailed}
        />
      )}
    </>
  );
};
```

### 3. 逝者详情页

```tsx
// src/features/deceased/DeceasedDetail.tsx
import { PinStatusBadge } from '@/components/deceased/PinStatusIndicator';

const DeceasedDetail = () => {
  return (
    <Descriptions>
      <Descriptions.Item label="姓名CID">
        {cid}
        <PinStatusBadge successData={...} />
      </Descriptions.Item>
      
      <Descriptions.Item label="主图CID">
        {imageCid}
        <PinStatusBadge successData={...} />
      </Descriptions.Item>
    </Descriptions>
  );
};
```

---

## MainImageUpdated 事件变化说明

### 旧版事件（已废弃）

```typescript
// 事件签名
MainImageUpdated(deceased_id, is_set)

// 数据结构
{
  deceasedId: 123,
  isSet: true
}

// 问题：无法知道是谁修改的
```

### 新版事件（增强版）

```typescript
// 事件签名
MainImageUpdated(deceased_id, operator, is_set)

// 数据结构
{
  deceasedId: 123,
  operator: "5GrwvaEF...", // 操作者账户
  isSet: true
}

// 优势：完整的审计追踪
```

### 前端适配

```tsx
// 监听MainImageUpdated事件
const { events } = useDeceasedEvents();

events.forEach(event => {
  if (event.event === 'MainImageUpdated') {
    const { deceasedId, operator, isSet } = event.data;
    console.log(`逝者 ${deceasedId} 的主图被 ${operator} ${isSet ? '设置' : '清空'}`);
  }
});
```

---

## 测试清单

### 单元测试

- [ ] useDeceasedEvents Hook
  - [ ] 正确监听链上事件
  - [ ] 正确解析事件数据
  - [ ] 错误码转换准确
  - [ ] getEventsByDeceasedId过滤正确

- [ ] PinStatusIndicator 组件
  - [ ] 成功状态显示正确
  - [ ] 失败状态显示正确
  - [ ] loading状态显示正确
  - [ ] 可关闭功能正常

### 集成测试

- [ ] CreateDeceasedForm
  - [ ] 创建成功后显示pin状态
  - [ ] Pin成功时显示成功提示
  - [ ] Pin失败时显示错误和建议
  - [ ] 延迟跳转机制正常

### 端到端测试

- [ ] 完整的创建流程
  - [ ] 填写表单 → 提交 → 显示pin状态 → 跳转
  - [ ] 余额不足时显示正确错误
  - [ ] 网络错误时显示正确提示
  - [ ] CID无效时显示正确提示

---

## 性能优化

### 1. 事件列表限制

```typescript
// 最多保留100条事件
setEvents(prev => [...deceasedEvents, ...prev].slice(0, 100));
```

### 2. 事件过滤

```typescript
// 只处理我们关心的事件
if (![
  'DeceasedCreated',
  'DeceasedUpdated',
  'MainImageUpdated',
  'AutoPinSuccess',
  'AutoPinFailed',
].includes(eventName)) {
  return;
}
```

### 3. 条件渲染

```typescript
// 只在有事件时渲染组件
{latestDeceasedId && pinSuccess && (
  <PinStatusIndicator ... />
)}
```

---

## 后续优化建议

### 短期（1-2周）

1. **添加重试功能**：
   - 实现 `retryPinCid` extrinsic调用
   - 在PinStatusIndicator中启用重试按钮
   - 记录重试次数和历史

2. **添加pin历史查询**：
   - 查询deceased的所有CID的pin状态
   - 显示pin时间线
   - 支持筛选和排序

3. **通知中心集成**：
   - Pin失败时发送通知
   - 支持通知设置（开启/关闭）
   - 批量查看所有pin失败记录

### 中期（1-2个月）

1. **统计Dashboard**：
   - Pin成功率统计
   - 错误类型分布图
   - IPFS服务可用性监控

2. **批量操作**：
   - 批量重试失败的pin
   - 批量查询pin状态
   - 导出pin记录

3. **智能提示**：
   - 余额不足时自动跳转充值
   - 网络错误时显示节点状态
   - CID无效时提供修复建议

---

## 总结

### 完成功能

✅ **事件监听**：
- 实时监听链上deceased模块的所有事件
- 支持5种事件类型
- 完整的事件数据解析

✅ **Pin状态反馈**：
- 成功/失败状态可视化
- 友好的错误提示
- 建议操作指引

✅ **用户体验优化**：
- 优雅的动画效果
- 自动跳转延迟
- 可关闭的提示

✅ **可扩展性**：
- 组件化设计
- Hook复用
- 预留重试接口

### 对比优势

**修复前**：
- ❌ 用户不知道pin是否成功
- ❌ 失败无任何通知
- ❌ 无法追溯操作者

**修复后**：
- ✅ 实时pin状态反馈
- ✅ 失败有详细错误说明
- ✅ 完整的操作审计
- ✅ 友好的用户体验

---

## 附录

### A. 文件清单

1. **Hook**：`src/hooks/useDeceasedEvents.ts`
2. **组件**：`src/components/deceased/PinStatusIndicator.tsx`
3. **页面**：`src/features/deceased/CreateDeceasedForm.tsx`
4. **文档**：`Deceased-Pin状态通知-前端集成完成报告.md`

### B. 相关文档

- [Deceased Pallet - P1 问题修复完成报告](../../docs/Deceased-Pallet-P1问题修复完成报告.md)
- [Deceased Pallet - P1 问题详细分析](../../docs/Deceased-Pallet-P1问题详细分析.md)

---

**报告生成时间**：2025-10

**集成状态**：✅ 完成

**下一步**：其他页面集成和测试验证

