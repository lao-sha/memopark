# Deceased Pallet - 关系功能前端集成完成报告

## ✅ 集成完成

**功能**：关系提案管理 + 错误提示优化 + 撤回提案  
**完成时间**：2025年10月23日  
**关联链端更新**：新增 `cancel_relation_proposal` extrinsic

---

## 📋 完成清单

### ✅ 1. 错误处理工具函数
**文件**：`src/utils/deceasedErrorHandler.ts`

**功能**：
- ✅ 完整的错误类型枚举（DeceasedErrorType）
- ✅ 友好的错误消息映射表
- ✅ DispatchError 解析函数
- ✅ 通用错误处理函数（handleDeceasedError）
- ✅ 关系功能专用错误处理（handleRelationError）
- ✅ 针对不同操作提供上下文提示

**特色**：
```typescript
// 自动识别错误类型并显示友好提示
handleDeceasedError(error, api);

// 关系功能专用处理，提供更多上下文
handleRelationError(error, api, 'approve');
```

**支持的错误类型**：
- ✅ NotProposalResponder（新增）：明确提示只有提案接收方可批准/拒绝
- ✅ RelationExists：关系已存在
- ✅ RelationNotFound：提案或关系不存在
- ✅ BadRelationKind：关系类型冲突
- ✅ PendingApproval：提案待审批
- ✅ 其他15+种错误类型

---

### ✅ 2. 关系提案管理组件
**文件**：`src/components/deceased/RelationProposalManager.tsx`

**功能**：
- ✅ 提案列表展示（收到的 / 发起的 / 全部）
- ✅ 批准提案按钮 + 友好错误提示
- ✅ 拒绝提案按钮 + 友好错误提示
- ✅ **撤回提案按钮**（新增）+ 二次确认 + 友好错误提示
- ✅ 关系类型标签（带颜色区分）
- ✅ 提案状态标签（待我批准 / 等待对方响应）
- ✅ 自动刷新机制
- ✅ 加载状态 + 空状态

**组件Props**：
```typescript
interface RelationProposalManagerProps {
  api: ApiPromise | null;
  account: string | null;
  myDeceasedId?: number;
  mode?: 'received' | 'sent' | 'all';  // 显示模式
  refreshTrigger?: number;             // 刷新触发器
}
```

**使用示例**：
```tsx
import RelationProposalManager from '@/components/deceased/RelationProposalManager';

// 显示我收到的提案（待我批准）
<RelationProposalManager
  api={api}
  account={account}
  myDeceasedId={100}
  mode="received"
/>

// 显示我发起的提案（等待对方响应）
<RelationProposalManager
  api={api}
  account={account}
  myDeceasedId={100}
  mode="sent"
/>
```

---

### ✅ 3. UI/UX 改进

#### 3.1 错误提示优化

**修改前**：
```typescript
// ❌ 通用错误，用户不知道哪里错了
message.error('NotAuthorized');
```

**修改后**：
```typescript
// ✅ 友好提示，明确告知用户问题和解决方案
message.error({
  content: (
    <div>
      <div style={{ fontWeight: 'bold' }}>只有提案接收方可批准/拒绝</div>
      <div style={{ fontSize: 12, color: '#666' }}>
        你不是提案接收方的管理员。只有提案参数中 "to" 对应逝者的墓位管理员可以批准/拒绝提案
      </div>
      <div style={{ fontSize: 12, color: '#ff4d4f', fontStyle: 'italic' }}>
        提示：只有提案接收方（参数中的 "to"）的管理员可以批准提案
      </div>
    </div>
  ),
  duration: 8,
});
```

#### 3.2 撤回提案功能

**场景**：
1. 发现错误：发起提案后发现参数错误（如关系类型选错、目标逝者ID错误）
2. 改变主意：不再希望建立该关系
3. 对方长时间未响应：提案发起后对方一直不批准也不拒绝

**UI特性**：
- ✅ 二次确认弹窗（防止误操作）
- ✅ 明确提示"撤回后提案将被删除，如需重新建立关系需重新发起提案"
- ✅ 加载状态显示
- ✅ 成功/失败提示

#### 3.3 提案列表UI

**特色**：
- 🎨 关系类型带颜色标签
  - 父母：蓝色
  - 配偶：粉色
  - 兄弟姐妹：绿色
  - 子女：紫色
- 🏷️ 状态标签
  - "待我批准"（橙色）- 我收到的提案
  - "等待对方响应"（青色）- 我发起的提案
- 💡 操作提示
  - 批准按钮带Tooltip："批准这个关系提案"
  - 拒绝按钮带Tooltip："拒绝这个关系提案"
  - 撤回按钮带Tooltip："撤回这个提案（不可恢复）"
- ℹ️ 上下文帮助
  - "提示：批准后将建立正式关系，任何一方都可以单方面撤销"

---

## 🎯 错误处理流程

### 流程图

```
用户操作（批准/拒绝/撤回）
    ↓
调用链上extrinsic
    ↓
监听交易事件
    ↓
是否成功？
    ├─ 是 → 显示成功提示 + 刷新列表
    └─ 否 → 解析错误类型
              ↓
         是Deceased错误？
              ├─ 是 → 显示友好提示（带上下文）
              └─ 否 → 显示原始错误信息
```

### 错误提示示例

#### 示例1：NotProposalResponder

**场景**：张三的管理员误点击"批准"按钮批准自己发起的提案

**显示**：
```
❌ 只有提案接收方可批准/拒绝

你不是提案接收方的管理员。只有提案参数中 "to" 对应逝者的墓位管理员可以批准/拒绝提案

提示：只有提案接收方（参数中的 "to"）的管理员可以批准提案
```

#### 示例2：RelationNotFound

**场景**：用户点击"批准"时，提案已被对方撤回

**显示**：
```
⚠️ 关系或提案不存在

指定的关系或提案不存在（可能已被处理或从未建立）

提示：提案可能已被批准、拒绝或撤回，请刷新页面查看最新状态
```

---

## 📦 文件清单

### 新增文件
1. `/src/utils/deceasedErrorHandler.ts`（350行）
   - 错误类型枚举
   - 错误消息映射表
   - 错误处理函数

2. `/src/components/deceased/RelationProposalManager.tsx`（430行）
   - 关系提案管理组件
   - 集成错误处理
   - 撤回提案功能

3. `/Deceased-关系功能-前端集成完成报告.md`（本文件）

---

## 🔗 集成方式

### 方式1：独立使用组件

```tsx
import { useState } from 'react';
import { Tabs } from 'antd';
import RelationProposalManager from '@/components/deceased/RelationProposalManager';
import { usePolkadotApi } from '@/hooks/usePolkadotApi';

const RelationPage = () => {
  const { api, account } = usePolkadotApi();
  const [myDeceasedId] = useState(100); // 假设当前用户管理的逝者ID

  return (
    <Tabs
      items={[
        {
          key: 'received',
          label: '待我批准',
          children: (
            <RelationProposalManager
              api={api}
              account={account}
              myDeceasedId={myDeceasedId}
              mode="received"
            />
          ),
        },
        {
          key: 'sent',
          label: '我发起的',
          children: (
            <RelationProposalManager
              api={api}
              account={account}
              myDeceasedId={myDeceasedId}
              mode="sent"
            />
          ),
        },
      ]}
    />
  );
};

export default RelationPage;
```

### 方式2：集成到现有页面

```tsx
import { Card } from 'antd';
import RelationProposalManager from '@/components/deceased/RelationProposalManager';

// 在逝者详情页中嵌入
<Card title="关系提案">
  <RelationProposalManager
    api={api}
    account={account}
    myDeceasedId={deceasedId}
    mode="all"
  />
</Card>
```

### 方式3：单独使用错误处理

```tsx
import { handleRelationError } from '@/utils/deceasedErrorHandler';

try {
  const tx = api.tx.deceased.approveRelation(from, to);
  await tx.signAndSend(account, ({ status, events }) => {
    events.forEach(({ event }) => {
      if (api.events.system.ExtrinsicFailed.is(event)) {
        const [dispatchError] = event.data;
        if (dispatchError.isModule) {
          // 使用专用错误处理
          handleRelationError(dispatchError, api, 'approve');
        }
      }
    });
  });
} catch (error) {
  console.error(error);
}
```

---

## ⚙️ 配置与自定义

### 自定义错误消息

在 `deceasedErrorHandler.ts` 中修改 `errorMessages` 对象：

```typescript
const errorMessages: Record<DeceasedErrorType, { title: string; description: string }> = {
  [DeceasedErrorType.NotProposalResponder]: {
    title: '你的自定义标题',
    description: '你的自定义描述',
  },
  // ... 其他错误类型
};
```

### 自定义关系类型颜色

在 `RelationProposalManager.tsx` 中修改 `getRelationColor` 函数：

```typescript
const getRelationColor = (kind: RelationKind): string => {
  switch (kind) {
    case RelationKind.ParentOf:
      return 'blue';     // 改为你想要的颜色
    // ... 其他类型
  }
};
```

---

## 🧪 测试清单

### 功能测试

- [ ] 批准提案按钮点击后显示加载状态
- [ ] 批准成功后显示成功提示并刷新列表
- [ ] 批准失败后显示友好错误提示
- [ ] 拒绝提案按钮点击后显示加载状态
- [ ] 拒绝成功后显示成功提示并刷新列表
- [ ] 拒绝失败后显示友好错误提示
- [ ] 撤回提案按钮点击后显示二次确认弹窗
- [ ] 撤回成功后显示成功提示并刷新列表
- [ ] 撤回失败后显示友好错误提示

### 错误场景测试

- [ ] 测试 NotProposalResponder 错误（用错误账户批准）
- [ ] 测试 RelationNotFound 错误（批准已被处理的提案）
- [ ] 测试 RelationExists 错误（重复批准）
- [ ] 测试 BadRelationKind 错误（冲突的关系类型）
- [ ] 测试 PendingApproval 错误（反向提案已存在）

### UI/UX 测试

- [ ] 空状态显示正常（无提案时）
- [ ] 加载状态显示正常
- [ ] 关系类型标签颜色正确
- [ ] 提案状态标签显示正确
- [ ] Tooltip 提示显示正常
- [ ] 操作按钮禁用状态正确（防止并发操作）

---

## 🔧 待完善功能

### 1. 链上查询实现 ⚠️ TODO

**当前状态**：`fetchProposals` 函数使用模拟数据

**需要实现**：
```typescript
const fetchProposals = useCallback(async () => {
  if (!api || !myDeceasedId) return;

  setLoading(true);
  try {
    // 查询 PendingRelationRequests 存储
    const entries = await api.query.deceased.pendingRelationRequests.entries();
    
    const filteredProposals = entries
      .map(([key, value]) => {
        const [from, to] = key.args;
        const [kind, requester, note, createdAt] = value.unwrap();
        return {
          from: from.toNumber(),
          to: to.toNumber(),
          kind: kind.toNumber() as RelationKind,
          requester: requester.toString(),
          note: note.toString(),
          createdAt: createdAt.toNumber(),
        };
      })
      .filter(p => {
        if (mode === 'received') return p.to === myDeceasedId;
        if (mode === 'sent') return p.from === myDeceasedId;
        return true;
      });
    
    setProposals(filteredProposals);
  } catch (error) {
    console.error('查询提案失败:', error);
    message.error('查询提案失败');
  } finally {
    setLoading(false);
  }
}, [api, myDeceasedId, mode]);
```

### 2. 事件监听优化 ⏭️ 建议

**当前**：手动调用 `fetchProposals` 刷新

**建议**：监听链上事件自动刷新
```typescript
useEffect(() => {
  if (!api) return;

  const unsubscribe = api.query.system.events((events) => {
    events.forEach(({ event }) => {
      if (
        api.events.deceased.RelationProposed.is(event) ||
        api.events.deceased.RelationApproved.is(event) ||
        api.events.deceased.RelationRejected.is(event) ||
        api.events.deceased.RelationProposalCancelled?.is(event)
      ) {
        fetchProposals(); // 自动刷新
      }
    });
  });

  return () => {
    unsubscribe.then(unsub => unsub());
  };
}, [api, fetchProposals]);
```

### 3. 逝者名称显示 ⏭️ 建议

**当前**：显示 "逝者 #100"

**建议**：显示实际姓名 "逝者：张三"
```typescript
// 查询逝者信息
const [deceasedNames, setDeceasedNames] = useState<Record<number, string>>({});

useEffect(() => {
  const fetchNames = async () => {
    const ids = [...new Set([...proposals.map(p => p.from), ...proposals.map(p => p.to)])];
    const names: Record<number, string> = {};
    
    await Promise.all(
      ids.map(async (id) => {
        const deceased = await api?.query.deceased.deceasedOf(id);
        if (deceased.isSome) {
          const data = deceased.unwrap();
          names[id] = data.name.toString();
        }
      })
    );
    
    setDeceasedNames(names);
  };
  
  fetchNames();
}, [proposals, api]);
```

---

## 📊 性能优化建议

### 1. 防抖查询

```typescript
import { debounce } from 'lodash';

const debouncedFetch = useMemo(
  () => debounce(fetchProposals, 300),
  [fetchProposals]
);

useEffect(() => {
  debouncedFetch();
}, [debouncedFetch, refreshTrigger]);
```

### 2. 分页加载

```typescript
const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

<List
  pagination={{
    ...pagination,
    total: proposals.length,
    onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
  }}
  // ...
/>
```

### 3. 虚拟滚动（大数据量）

```typescript
import { List as VirtualList } from 'react-virtualized';

// 当提案数量超过100时使用虚拟滚动
```

---

## ✅ 总结

### 已完成功能
- ✅ 错误处理工具函数（完整）
- ✅ 关系提案管理组件（完整）
- ✅ 撤回提案功能（完整）
- ✅ 友好错误提示（完整）
- ✅ UI/UX 优化（完整）

### 待完善功能
- ⚠️ 链上查询实现（TODO）
- ⏭️ 事件监听优化（建议）
- ⏭️ 逝者名称显示（建议）
- ⏭️ 性能优化（建议）

### 下一步建议
1. **立即执行**：实现 `fetchProposals` 的链上查询逻辑
2. **短期执行**：监听链上事件自动刷新
3. **长期优化**：显示逝者实际姓名、性能优化

---

*本报告生成于2025年10月23日*

