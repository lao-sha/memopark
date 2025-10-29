# Deceased Pin状态通知 - 快速开始指南

## 5分钟快速集成

### 步骤1：监听事件（2分钟）

```tsx
import { useDeceasedEvents } from '@/hooks/useDeceasedEvents';

function MyComponent() {
  // 启动事件监听
  const { 
    events,                    // 所有事件列表
    getEventsByDeceasedId,     // 按ID获取
    listening,                 // 监听状态
  } = useDeceasedEvents();

  // 监听状态
  if (!listening) {
    return <Alert message="正在连接..." />;
  }

  return <div>监听中...</div>;
}
```

### 步骤2：显示Pin状态（3分钟）

```tsx
import { PinStatusIndicator } from '@/components/deceased/PinStatusIndicator';

function DeceasedForm() {
  const [deceasedId, setDeceasedId] = useState(null);
  const { events, getEventsByDeceasedId } = useDeceasedEvents();

  // 提交后设置deceasedId
  const handleSubmit = async () => {
    // ... 提交逻辑
    setDeceasedId(123); // 新创建的deceased ID
  };

  // 获取该deceased的事件
  const deceasedEvents = deceasedId 
    ? getEventsByDeceasedId(deceasedId) 
    : [];
  
  const pinSuccess = deceasedEvents.find(e => e.event === 'AutoPinSuccess');
  const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed');

  return (
    <div>
      {/* 表单内容 */}
      <Form onFinish={handleSubmit}>
        {/* ... */}
      </Form>

      {/* Pin状态指示器 */}
      {(pinSuccess || pinFailed) && (
        <PinStatusIndicator
          deceasedId={deceasedId}
          successData={pinSuccess?.data}
          failedData={pinFailed?.data}
        />
      )}
    </div>
  );
}
```

---

## 常用场景

### 场景1：创建逝者后显示pin状态

```tsx
function CreateDeceasedPage() {
  const [latestId, setLatestId] = useState(null);
  const { events, getEventsByDeceasedId } = useDeceasedEvents();

  const handleCreate = async (values) => {
    // 提交交易
    await api.tx.deceased.createDeceased(...).signAndSend(account);
    
    // 等待DeceasedCreated事件
    const checkEvents = setInterval(() => {
      const created = events.find(e => e.event === 'DeceasedCreated');
      if (created) {
        setLatestId(created.deceasedId);
        clearInterval(checkEvents);
      }
    }, 500);
  };

  // 显示pin状态
  const deceasedEvents = latestId ? getEventsByDeceasedId(latestId) : [];
  const pinSuccess = deceasedEvents.find(e => e.event === 'AutoPinSuccess');
  const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed');

  return (
    <>
      <Form onFinish={handleCreate}>{/* 表单 */}</Form>
      
      {(pinSuccess || pinFailed) && (
        <PinStatusIndicator
          deceasedId={latestId}
          successData={pinSuccess?.data}
          failedData={pinFailed?.data}
        />
      )}
    </>
  );
}
```

### 场景2：设置主图后显示pin状态

```tsx
function SetMainImagePage({ deceasedId }) {
  const { events, getEventsByDeceasedId } = useDeceasedEvents();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file) => {
    setUploading(true);
    
    // 上传到IPFS获取CID
    const cid = await uploadToIPFS(file);
    
    // 调用set_main_image
    await api.tx.deceased.setMainImage(deceasedId, cid).signAndSend(account);
    
    setUploading(false);
  };

  // 获取主图相关的pin事件
  const events = getEventsByDeceasedId(deceasedId);
  const mainImageSuccess = events.find(e => 
    e.event === 'AutoPinSuccess' && e.data.pinType === 1 // 1=MainImage
  );
  const mainImageFailed = events.find(e => 
    e.event === 'AutoPinFailed' && e.data.pinType === 1
  );

  return (
    <>
      <Upload onChange={handleUpload} />
      
      <PinStatusIndicator
        deceasedId={deceasedId}
        successData={mainImageSuccess?.data}
        failedData={mainImageFailed?.data}
        loading={uploading}
      />
    </>
  );
}
```

### 场景3：显示简洁的Pin状态徽章

```tsx
import { PinStatusBadge } from '@/components/deceased/PinStatusIndicator';

function DeceasedListItem({ deceased }) {
  const { events, getEventsByDeceasedId } = useDeceasedEvents();
  const events = getEventsByDeceasedId(deceased.id);
  
  const pinSuccess = events.find(e => 
    e.event === 'AutoPinSuccess' && e.data.pinType === 0 // 0=NameFullCid
  );

  return (
    <List.Item>
      <div>
        {deceased.name}
        <PinStatusBadge successData={pinSuccess?.data} />
      </div>
    </List.Item>
  );
}
```

---

## 错误处理

### 错误码映射

```tsx
import { 
  PinErrorCode, 
  getPinErrorMessage, 
  getPinErrorSuggestion 
} from '@/hooks/useDeceasedEvents';

function ErrorHandler({ errorCode }) {
  const message = getPinErrorMessage(errorCode);
  const suggestion = getPinErrorSuggestion(errorCode);

  switch (errorCode) {
    case PinErrorCode.InsufficientBalance:
      return (
        <Alert type="warning">
          {message}
          <Button onClick={goToRecharge}>去充值</Button>
        </Alert>
      );
      
    case PinErrorCode.NetworkError:
      return (
        <Alert type="info">
          {message}
          <span>系统会自动重试</span>
        </Alert>
      );
      
    case PinErrorCode.InvalidCid:
      return (
        <Alert type="error">
          {message}
          <Button onClick={reupload}>重新上传</Button>
        </Alert>
      );
      
    default:
      return <Alert type="error">{message}</Alert>;
  }
}
```

### 自动重试（预留）

```tsx
function PinStatusWithRetry({ deceasedId, failedData }) {
  const handleRetry = async (id, pinType) => {
    // 调用retry_pin_cid extrinsic（待实现）
    await api.tx.deceased.retryPinCid(id, failedData.cid, pinType)
      .signAndSend(account);
    
    message.success('已重新提交Pin请求');
  };

  return (
    <PinStatusIndicator
      deceasedId={deceasedId}
      failedData={failedData}
      showRetry={true}
      onRetry={handleRetry}
    />
  );
}
```

---

## 事件数据结构

### AutoPinSuccess

```typescript
{
  event: 'AutoPinSuccess',
  deceasedId: 123,
  data: {
    deceasedId: 123,
    cid: "0x1234567890abcdef...",
    pinType: 0, // 0=NameFullCid, 1=MainImage
  }
}
```

### AutoPinFailed

```typescript
{
  event: 'AutoPinFailed',
  deceasedId: 123,
  data: {
    deceasedId: 123,
    cid: "0x1234567890abcdef...",
    pinType: 0,
    errorCode: 1, // 0=未知, 1=余额不足, 2=网络错误, 3=CID无效
  }
}
```

### MainImageUpdated（增强版）

```typescript
{
  event: 'MainImageUpdated',
  deceasedId: 123,
  data: {
    deceasedId: 123,
    operator: "5GrwvaEF5QNJqJF6ZtpEY5dQCdq...", // 操作者账户
    isSet: true, // true=设置, false=清空
  }
}
```

---

## API参考

### useDeceasedEvents

```typescript
const { 
  events,                    // DeceasedEvent[] - 事件列表
  listening,                 // boolean - 是否正在监听
  error,                     // string | null - 错误信息
  clearEvents,               // () => void - 清空事件
  getEventsByDeceasedId,     // (id: number) => DeceasedEvent[] - 按ID获取
  getRecentPinFailures       // () => AutoPinFailedData[] - 获取最近失败
} = useDeceasedEvents(enabled?: boolean);
```

### PinStatusIndicator

```typescript
<PinStatusIndicator
  deceasedId={number}           // 必需：逝者ID
  successData={AutoPinSuccessData}  // 可选：成功数据
  failedData={AutoPinFailedData}    // 可选：失败数据
  loading={boolean}                  // 可选：是否loading
  showRetry={boolean}                // 可选：显示重试按钮
  onRetry={(id, type) => void}      // 可选：重试回调
/>
```

### PinStatusBadge

```typescript
<PinStatusBadge
  successData={AutoPinSuccessData}  // 可选：成功数据
  failedData={AutoPinFailedData}    // 可选：失败数据
  loading={boolean}                  // 可选：是否loading
/>
```

---

## 最佳实践

### 1. 事件监听最佳时机

```tsx
// ✅ 好 - 在根组件或Layout中全局监听
function AppLayout() {
  useDeceasedEvents(true); // 全局监听
  return <Outlet />;
}

// ❌ 坏 - 在每个组件中重复监听
function ComponentA() {
  useDeceasedEvents(true); // 重复订阅
}
function ComponentB() {
  useDeceasedEvents(true); // 重复订阅
}
```

### 2. 条件渲染

```tsx
// ✅ 好 - 只在有数据时渲染
{pinSuccess && (
  <PinStatusIndicator successData={pinSuccess.data} />
)}

// ❌ 坏 - 总是渲染
<PinStatusIndicator successData={pinSuccess?.data} />
```

### 3. 事件清理

```tsx
// ✅ 好 - 在适当的时候清理事件
const { clearEvents } = useDeceasedEvents();

useEffect(() => {
  return () => {
    clearEvents(); // 组件卸载时清理
  };
}, []);

// 或在用户操作后清理
const handleReset = () => {
  clearEvents();
  form.reset();
};
```

---

## 故障排查

### 问题1：事件监听不工作

**检查清单**：
- [ ] API连接是否正常？
- [ ] deceased模块是否存在？
- [ ] 是否启用了监听？`useDeceasedEvents(true)`

**调试代码**：
```tsx
const { listening, error } = useDeceasedEvents();

if (error) {
  console.error('监听错误:', error);
}

console.log('监听状态:', listening);
```

### 问题2：事件数据为undefined

**检查清单**：
- [ ] 事件是否已触发？
- [ ] 事件数据格式是否正确？
- [ ] 是否使用了正确的事件名称？

**调试代码**：
```tsx
const { events } = useDeceasedEvents();

console.log('所有事件:', events);
console.log('AutoPin事件:', events.filter(e => 
  e.event === 'AutoPinSuccess' || e.event === 'AutoPinFailed'
));
```

### 问题3：Pin状态不显示

**检查清单**：
- [ ] deceasedId是否正确？
- [ ] 是否等待了足够的时间？
- [ ] 组件是否正确渲染？

**调试代码**：
```tsx
const deceasedEvents = getEventsByDeceasedId(deceasedId);

console.log(`逝者 ${deceasedId} 的事件:`, deceasedEvents);

const pinSuccess = deceasedEvents.find(e => e.event === 'AutoPinSuccess');
const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed');

console.log('Pin成功:', pinSuccess);
console.log('Pin失败:', pinFailed);
```

---

## 示例项目

完整示例请参考：
- `src/features/deceased/CreateDeceasedForm.tsx` - 创建逝者表单
- `src/hooks/useDeceasedEvents.ts` - 事件监听Hook
- `src/components/deceased/PinStatusIndicator.tsx` - Pin状态组件

---

## 下一步

1. **集成到其他页面**：
   - 更新逝者页面
   - 设置主图页面
   - 逝者详情页面

2. **扩展功能**：
   - 添加重试接口
   - 实现批量查询
   - 添加通知中心

3. **优化体验**：
   - 添加加载动画
   - 优化错误提示
   - 实现智能重试

---

## 常见问题

**Q: 事件会重复触发吗？**

A: 不会。每个事件只会被处理一次，Hook内部会去重。

**Q: 事件列表会无限增长吗？**

A: 不会。列表最多保留100条事件，超出会自动删除最旧的。

**Q: 如何重置事件列表？**

A: 使用 `clearEvents()` 函数。

**Q: 可以在多个组件中使用吗？**

A: 可以。推荐在根组件启动监听，在子组件中使用 `getEventsByDeceasedId` 获取数据。

**Q: 如何处理网络断开？**

A: Hook会自动处理，连接恢复后会继续监听。

---

## 技术支持

如有问题，请查看：
- [完整文档](./Deceased-Pin状态通知-前端集成完成报告.md)
- [链端文档](../../docs/Deceased-Pallet-P1问题修复完成报告.md)
- 或联系开发团队

---

**最后更新**：2025-10

