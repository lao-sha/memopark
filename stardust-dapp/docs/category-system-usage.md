# 逝者分类系统使用文档

## 功能概述

逝者分类系统允许普通用户通过委员会审核修改逝者的分类，Root账户可以直接修改分类。

### 分类类型（7种）

1. **Ordinary (0)** - 普通民众（默认）
2. **HistoricalFigure (1)** - 历史人物
3. **Martyr (2)** - 革命烈士
4. **Hero (3)** - 英雄模范
5. **PublicFigure (4)** - 公众人物
6. **ReligiousFigure (5)** - 宗教人物
7. **EventHall (6)** - 事件馆

### 申请流程

1. **普通用户提交申请**
   - 冻结10 DUST押金
   - 选择目标分类
   - 提供申请理由和证据（IPFS）
   - 审核期限：7天

2. **委员会审核**
   - 批准：执行分类修改，退还全额押金
   - 拒绝：保持原分类，扣除50%押金
   - 过期：自动退还全额押金

3. **Root直接修改**
   - 绕过审核流程
   - 无需押金
   - 立即生效

## 🆕 权限检查系统

### useAccountPermissions Hook

用于检查账户是否拥有Root或Committee权限。

```tsx
import { useAccountPermissions } from '@/hooks/useAccountPermissions'

function MyComponent() {
  const account = useAccount()
  const { isRoot, isAdmin, isContentCommittee, loading } = useAccountPermissions(account)

  if (loading) {
    return <Spin tip="检查权限中..." />
  }

  return (
    <div>
      {isRoot && <Tag color="gold">Root账户</Tag>}
      {isContentCommittee && <Tag color="green">委员会成员</Tag>}
      {isAdmin && <Button type="primary">管理员操作</Button>}
    </div>
  )
}
```

### 权限检查工具函数

```tsx
import { checkIsRoot, checkIsAdmin, checkIsContentCommittee } from '@/hooks/useAccountPermissions'

// 检查是否为Root
const isRoot = await checkIsRoot(account)

// 检查是否为委员会成员
const isCommittee = await checkIsContentCommittee(account)

// 检查是否为任意管理员
const isAdmin = await checkIsAdmin(account)
```

## 组件使用示例

### 1. CategoryBadge - 显示分类标签

```tsx
import { CategoryBadge, DeceasedCategory } from '@/components/deceased'

// 基础使用
<CategoryBadge category={DeceasedCategory.Martyr} />

// 不显示图标
<CategoryBadge category={DeceasedCategory.Hero} showIcon={false} />

// 可点击
<CategoryBadge
  category={DeceasedCategory.PublicFigure}
  onClick={() => console.log('clicked')}
/>
```

### 2. CategoryChangeRequestForm - 普通用户提交申请

```tsx
import { CategoryChangeRequestForm, DeceasedCategory } from '@/components/deceased'
import { useAccount } from '@/hooks/useAccount'

function MyComponent() {
  const { account } = useAccount()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>申请修改分类</Button>

      <CategoryChangeRequestForm
        open={open}
        onClose={() => setOpen(false)}
        deceasedId={1}
        currentCategory={DeceasedCategory.Ordinary}
        account={account}
        onSuccess={() => {
          console.log('申请提交成功')
          setOpen(false)
        }}
      />
    </>
  )
}
```

### 3. CategoryManagementModal - Root/委员会管理

```tsx
import { CategoryManagementModal } from '@/components/deceased'
import { useAccount } from '@/hooks/useAccount'

function AdminComponent() {
  const { account } = useAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'force_set' | 'approve' | 'reject'>('approve')

  return (
    <>
      {/* Root直接修改 */}
      <Button onClick={() => {
        setMode('force_set')
        setOpen(true)
      }}>
        Root修改分类
      </Button>

      {/* 批准申请 */}
      <Button onClick={() => {
        setMode('approve')
        setOpen(true)
      }}>
        批准申请
      </Button>

      {/* 拒绝申请 */}
      <Button onClick={() => {
        setMode('reject')
        setOpen(true)
      }}>
        拒绝申请
      </Button>

      <CategoryManagementModal
        open={open}
        onClose={() => setOpen(false)}
        mode={mode}
        deceasedId={mode === 'force_set' ? 1 : undefined}
        currentCategory={mode === 'force_set' ? DeceasedCategory.Ordinary : undefined}
        requestId={mode !== 'force_set' ? 123 : undefined}
        account={account}
        onSuccess={() => {
          console.log('操作成功')
          setOpen(false)
        }}
      />
    </>
  )
}
```

### 4. CategoryRequestList - 申请列表

```tsx
import { CategoryRequestList } from '@/components/deceased'
import { useAccount } from '@/hooks/useAccount'

function RequestListPage() {
  const account = useAccount()

  return (
    <div>
      <h1>分类修改申请管理</h1>
      {/*
        🆕 不需要手动传入 isAdmin 参数
        组件内部会自动使用 useAccountPermissions hook 检查权限
      */}
      <CategoryRequestList account={account} />
    </div>
  )
}
```

### 5. CategoryManagementPage - 完整管理页面

```tsx
import { CategoryManagementPage } from '@/features/deceased/CategoryManagementPage'

// 路由配置
<Route path="/deceased/category-management" element={<CategoryManagementPage />} />
```

这是一个完整的分类管理页面，集成了：
- 自动权限检查和显示
- 权限说明
- Root/Committee专属操作区域
- 申请列表管理



## 服务层API

### 查询方法

```typescript
import { getApi } from '@/lib/polkadot-safe'
import { createDeceasedService } from '@/services/deceasedService'

const api = await getApi()
const service = createDeceasedService(api)

// 1. 查询逝者分类
const category = await service.getDeceasedCategory(deceasedId)

// 2. 查询申请详情
const request = await service.getCategoryChangeRequest(requestId)

// 3. 查询用户申请历史
const requestIds = await service.getUserCategoryRequests(account, deceasedId)

// 4. 查询下一个申请ID
const nextId = await service.getNextRequestId()
```

### 交易构建方法

```typescript
import { getApi } from '@/lib/polkadot-safe'
import { createDeceasedService, DeceasedCategory } from '@/services/deceasedService'
import { web3FromAddress } from '@polkadot/extension-dapp'

const api = await getApi()
const service = createDeceasedService(api)
const injector = await web3FromAddress(account)

// 1. 普通用户提交申请
const tx1 = service.buildRequestCategoryChangeTx({
  deceasedId: 1,
  targetCategory: DeceasedCategory.Hero,
  reasonCid: 'QmXxx...',
  evidenceCids: ['QmYyy...', 'QmZzz...'],
})

await tx1.signAndSend(account, { signer: injector.signer })

// 2. 委员会批准申请
const tx2 = service.buildApproveCategoryChangeTx(requestId)
await tx2.signAndSend(account, { signer: injector.signer })

// 3. 委员会拒绝申请
const tx3 = service.buildRejectCategoryChangeTx({
  requestId,
  reasonCid: 'QmReason...',
})
await tx3.signAndSend(account, { signer: injector.signer })

// 4. Root直接修改
const tx4 = service.buildForceSetCategoryTx({
  deceasedId: 1,
  category: DeceasedCategory.Martyr,
  noteCid: 'QmNote...',
})
await tx4.signAndSend(account, { signer: injector.signer })
```

## 集成到现有页面

### 在逝者详情页添加分类标签

```tsx
import { CategoryBadge } from '@/components/deceased'
import { useDeceasedInfo } from '@/hooks/useDeceasedInfo'

function DeceasedDetailPage({ deceasedId }) {
  const { deceased } = useDeceasedInfo(deceasedId)

  return (
    <div>
      <h1>{deceased.fullName}</h1>

      {/* 显示分类标签 */}
      <CategoryBadge category={deceased.category} />

      {/* 其他内容... */}
    </div>
  )
}
```

### 在逝者列表页添加分类筛选

```tsx
import { CategoryBadge, DeceasedCategory, getCategoryLabel } from '@/components/deceased'
import { Select } from 'antd'

function DeceasedListPage() {
  const [categoryFilter, setCategoryFilter] = useState<DeceasedCategory | null>(null)

  return (
    <div>
      <Select
        placeholder="筛选分类"
        onChange={setCategoryFilter}
        style={{ width: 200 }}
      >
        <Select.Option value={null}>全部</Select.Option>
        {Object.values(DeceasedCategory)
          .filter((v): v is DeceasedCategory => typeof v === 'number')
          .map(cat => (
            <Select.Option key={cat} value={cat}>
              {getCategoryLabel(cat)}
            </Select.Option>
          ))}
      </Select>

      {/* 列表内容... */}
    </div>
  )
}
```

## 权限说明

### 权限体系

系统通过 `useAccountPermissions` hook 自动识别三种权限级别：

1. **Root账户**
   - 判定方式：通过 `pallet_sudo::key()` 查询，匹配当前sudo账户
   - 权限标识：`isRoot = true`

2. **ContentCommittee成员**
   - 判定方式：通过 `contentCommittee::members()` 查询委员会成员列表（Instance3）
   - 权限标识：`isContentCommittee = true`

3. **普通用户**
   - 判定方式：不属于Root或Committee
   - 权限标识：`isAdmin = false`

### 普通用户权限

- ✅ 查看所有逝者的分类
- ✅ 提交分类修改申请（需要10 DUST押金）
- ✅ 查看自己的申请历史
- ❌ 直接修改分类
- ❌ 批准/拒绝申请

### 委员会权限

- ✅ 查看所有申请
- ✅ 批准分类修改申请
- ✅ 拒绝分类修改申请
- ❌ 直接修改分类（需要Root权限）

### Root权限

- ✅ 所有操作
- ✅ 直接修改分类（无需审核）
- ✅ 批准/拒绝申请

## 押金机制

### 申请押金：10 DUST

- **冻结时机**：提交申请时立即冻结
- **退还时机**：
  - 批准：全额退还（100%）
  - 拒绝：退还50%，扣除50%
  - 过期：全额退还（100%）

### 押金流向

- **扣除部分**：50%罚没至国库（FeeCollector）
- **退还部分**：50%退还给申请人

## 事件监听

```typescript
import { getApi } from '@/lib/polkadot-safe'

const api = await getApi()

// 监听分类修改申请事件
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record

    if (api.events.deceased.CategoryChangeRequested.is(event)) {
      const [requestId, deceasedId, applicant, from, to] = event.data
      console.log('新申请:', { requestId, deceasedId, applicant, from, to })
    }

    if (api.events.deceased.CategoryChangeApproved.is(event)) {
      const [requestId, deceasedId, from, to] = event.data
      console.log('申请已批准:', { requestId, deceasedId, from, to })
    }

    if (api.events.deceased.CategoryChangeRejected.is(event)) {
      const [requestId, deceasedId, reasonCid] = event.data
      console.log('申请已拒绝:', { requestId, deceasedId, reasonCid })
    }

    if (api.events.deceased.CategoryChangeExpired.is(event)) {
      const [requestId, deceasedId] = event.data
      console.log('申请已过期:', { requestId, deceasedId })
    }

    if (api.events.deceased.CategoryForcedChanged.is(event)) {
      const [deceasedId, from, to, noteCid] = event.data
      console.log('Root修改分类:', { deceasedId, from, to, noteCid })
    }
  })
})
```

## 注意事项

1. **IPFS集成**：当前使用模拟CID，需要集成实际的IPFS上传服务
2. **申请列表查询**：建议通过Subsquid索引查询，避免遍历链上存储
3. **权限检查**：前端需要检查用户是否有Root/委员会权限
4. **错误处理**：所有交易操作都需要添加适当的错误处理
5. **区块时间**：当前区块时间为6秒，7天约等于100800个区块

## 测试建议

### 单元测试

```typescript
// 测试分类枚举转换
expect(getCategoryLabel(DeceasedCategory.Martyr)).toBe('革命烈士')
expect(getCategoryColor(DeceasedCategory.Hero)).toBe('gold')

// 测试服务层方法
const category = await service.getDeceasedCategory(1)
expect(category).toBe(DeceasedCategory.Ordinary)
```

### 集成测试

1. 测试普通用户提交申请
2. 测试委员会批准申请
3. 测试委员会拒绝申请
4. 测试申请自动过期
5. 测试Root直接修改

## 后续优化

1. **Subsquid集成**：添加索引查询申请列表
2. **IPFS上传**：集成实际的IPFS上传服务
3. **通知系统**：申请状态变化时通知用户
4. **权限管理**：前端添加权限检查逻辑
5. **分页优化**：优化大量申请的展示性能
