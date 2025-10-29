# Memorial 组件库

**创建日期**: 2025-10-28  
**版本**: 1.0.0

## 📋 概述

Memorial组件库提供了完整的纪念服务系统UI组件，包括祭祀品目录管理（管理员）和供奉业务（用户）。

### 核心功能
- ✅ 祭祀品卡片展示
- ✅ 快速下单弹窗（智能定价 + VIP折扣）
- ✅ 供奉记录查询和管理
- ✅ 祭祀品目录管理（管理员）
- ✅ 自定义供奉表单

---

## 📦 组件清单

| 组件 | 文件 | 用途 | 权限 |
|------|------|------|------|
| `SacrificeCard` | SacrificeCard.tsx | 祭祀品卡片 | Public |
| `OfferBySacrificeModal` | OfferBySacrificeModal.tsx | 快速下单弹窗 | User |
| `OfferingsList` | OfferingsList.tsx | 供奉记录列表 | Public |
| `SacrificeManager` | SacrificeManager.tsx | 祭祀品目录管理 | Admin |
| `OfferingForm` | OfferingForm.tsx | 自定义供奉表单 | User |

---

## 🚀 快速开始

### 1. 安装依赖

组件已集成在stardust-dapp中，无需额外安装。

### 2. 导入组件

```typescript
import { 
  SacrificeCard, 
  OfferBySacrificeModal,
  OfferingsList,
  SacrificeManager,
  OfferingForm,
} from '@/components/memorial'
```

### 3. 使用组件

#### 示例1：祭祀品卡片

```typescript
import { SacrificeCard } from '@/components/memorial'
import { getApi } from '@/lib/polkadot-safe'
import { createMemorialService } from '@/services/memorialService'

function MyComponent() {
  const [sacrifice, setSacrifice] = useState(null)
  const [showOrderModal, setShowOrderModal] = useState(false)

  // 加载祭祀品
  useEffect(() => {
    const load = async () => {
      const api = await getApi()
      const service = createMemorialService(api)
      const item = await service.getSacrifice(1) // ID=1的祭祀品
      setSacrifice(item)
    }
    load()
  }, [])

  return (
    <>
      <SacrificeCard
        sacrifice={sacrifice}
        showOrderButton
        onOrder={(item) => setShowOrderModal(true)}
        isVip={true} // 显示VIP价格
      />
      
      <OfferBySacrificeModal
        open={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        sacrifice={sacrifice}
        account="your-account-address"
        defaultTarget={[1, 123]} // 墓地域，墓地ID=123
        onSuccess={() => message.success('供奉成功！')}
      />
    </>
  )
}
```

#### 示例2：供奉记录列表

```typescript
import { OfferingsList } from '@/components/memorial'

function MyOfferingsPage() {
  return (
    <OfferingsList
      queryType="account"
      account="your-account-address"
      showActions
      currentAccount="your-account-address"
      limit={50}
    />
  )
}
```

#### 示例3：祭祀品目录管理（管理员）

```typescript
import { SacrificeManager } from '@/components/memorial'

function AdminPage() {
  return (
    <SacrificeManager adminAccount="admin-account-address" />
  )
}
```

---

## 📖 组件详细文档

### SacrificeCard

**功能**: 展示祭祀品卡片

**Props**:

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `sacrifice` | `SacrificeItem` | ✅ | - | 祭祀品信息 |
| `showOrderButton` | `boolean` | ❌ | `false` | 是否显示下单按钮 |
| `onOrder` | `(sacrifice: SacrificeItem) => void` | ❌ | - | 下单回调 |
| `showManageButtons` | `boolean` | ❌ | `false` | 是否显示管理按钮 |
| `onEdit` | `(sacrifice: SacrificeItem) => void` | ❌ | - | 编辑回调 |
| `isVip` | `boolean` | ❌ | `false` | 是否为VIP用户 |

**示例**:

```typescript
<SacrificeCard
  sacrifice={sacrificeItem}
  showOrderButton
  onOrder={(item) => console.log('下单', item)}
  isVip={true}
/>
```

---

### OfferBySacrificeModal

**功能**: 快速下单弹窗（智能定价 + VIP折扣）

**Props**:

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `open` | `boolean` | ✅ | - | 是否显示弹窗 |
| `onClose` | `() => void` | ✅ | - | 关闭回调 |
| `sacrifice` | `SacrificeItem \| null` | ✅ | - | 祭祀品信息 |
| `account` | `string` | ✅ | - | 当前账户地址 |
| `defaultTarget` | `[number, number]` | ❌ | - | 默认目标 |
| `onSuccess` | `() => void` | ❌ | - | 成功回调 |

**核心功能**:
- ✅ 自动计算价格（固定价 OR 周单价×周数）
- ✅ 自动应用VIP 30%折扣
- ✅ 显示原价和折扣对比
- ✅ 支持添加供奉留言
- ✅ 一键发送交易

**示例**:

```typescript
<OfferBySacrificeModal
  open={showModal}
  onClose={() => setShowModal(false)}
  sacrifice={selectedSacrifice}
  account={currentAccount}
  defaultTarget={[1, 100]}
  onSuccess={() => {
    message.success('供奉成功！')
    loadOfferings()
  }}
/>
```

---

### OfferingsList

**功能**: 供奉记录列表（支持续费和取消）

**Props**:

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `queryType` | `'target' \| 'account'` | ✅ | - | 查询类型 |
| `target` | `[number, number]` | ❌ | - | 目标（queryType=target时必填） |
| `account` | `string` | ❌ | - | 账户地址（queryType=account时必填） |
| `showActions` | `boolean` | ❌ | `false` | 是否显示操作按钮 |
| `currentAccount` | `string` | ❌ | - | 当前用户地址（权限判断） |
| `limit` | `number` | ❌ | `50` | 数量限制 |

**查询模式**:

1. **按目标查询**: 查看某个墓地/宠物的所有供奉记录
   ```typescript
   <OfferingsList
     queryType="target"
     target={[1, 123]} // 墓地域，ID=123
   />
   ```

2. **按账户查询**: 查看某个用户的所有供奉记录
   ```typescript
   <OfferingsList
     queryType="account"
     account="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
     showActions
     currentAccount="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
   />
   ```

---

### SacrificeManager

**功能**: 祭祀品目录管理（管理员）

**Props**:

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `adminAccount` | `string` | ✅ | - | 管理员账户地址 |

**核心功能**:
- ✅ 祭祀品CRUD操作
- ✅ 设置祭祀品状态（启用/禁用/隐藏）
- ✅ 按场景/类目/状态筛选
- ✅ 支持固定价格和按周计费

**示例**:

```typescript
<SacrificeManager adminAccount="admin-address" />
```

---

### OfferingForm

**功能**: 自定义供奉表单（不通过目录）

**Props**:

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `account` | `string` | ✅ | - | 当前账户地址 |
| `defaultTarget` | `[number, number]` | ❌ | - | 默认目标 |
| `onSuccess` | `() => void` | ❌ | - | 成功回调 |
| `showAsCard` | `boolean` | ❌ | `true` | 是否显示为卡片 |

**核心功能**:
- ✅ 完全自定义金额
- ✅ 自定义供奉类型代码
- ✅ 支持上传媒体（图片/视频）
- ✅ 可选持续时长

**注意**: 建议优先使用`OfferBySacrificeModal`享受智能定价和VIP折扣。

**示例**:

```typescript
<OfferingForm
  account={currentAccount}
  defaultTarget={[1, 100]}
  onSuccess={() => message.success('供奉成功！')}
/>
```

---

## 🎨 UI风格

所有组件遵循以下设计规范：

### 颜色方案
- **主色**: `#1890ff` (蓝色)
- **成功**: `#52c41a` (绿色)
- **警告**: `#faad14` (橙色)
- **错误**: `#ff4d4f` (红色)
- **VIP金**: `#fda085` → `#f6d365` (渐变)

### 布局
- **卡片圆角**: `12px`
- **按钮圆角**: `8px`
- **间距**: `8px / 16px / 24px`

### 自适应
- ✅ 移动端优先设计
- ✅ 响应式布局（Grid/Flex）
- ✅ 支持桌面端和平板端

---

## 🔧 开发指南

### 添加新组件

1. 在 `memorial/` 目录创建组件文件
2. 按现有风格编写组件代码
3. 在 `index.ts` 中导出组件
4. 更新本README

### 代码规范

- ✅ 函数级详细中文注释
- ✅ TypeScript严格模式
- ✅ Props接口完整定义
- ✅ 错误处理和用户提示
- ✅ 加载状态和禁用状态

### 测试建议

- 使用Polkadot.js本地节点测试
- 验证所有交易流程
- 测试VIP折扣计算
- 测试媒体上传流程

---

## 📊 数据流

```
┌─────────────┐
│   用户操作   │
│ (UI组件)     │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ memorialService  │
│ (API服务层)      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Polkadot.js API  │
│ (链上交互)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ pallet-memorial  │
│ (Substrate链)    │
└──────────────────┘
```

---

## 🐛 常见问题

### Q1: VIP折扣不生效？
**A**: 检查 `pallet-membership` 是否正确配置，确保用户为有效VIP会员。

### Q2: IPFS上传失败？
**A**: `OfferingForm` 当前使用占位实现，需集成实际IPFS服务（参考 `@/services/ipfs.ts`）。

### Q3: 交易失败"BadOrigin"？
**A**: 管理员功能（如`SacrificeManager`）需要管理员权限，确保使用正确的账户。

### Q4: 价格计算错误？
**A**: 确保MEMO单位转换正确：
- 前端显示: `MEMO`（1 MEMO = 1,000,000 最小单位）
- 链上存储: 最小单位（`u128`）

---

## 📝 更新日志

### v1.0.0 (2025-10-28)
- ✅ 初始版本发布
- ✅ 5个核心组件
- ✅ 完整的TypeScript类型定义
- ✅ 详细的中文注释和文档

---

## 📞 技术支持

如有问题或建议，请联系开发团队。

**文档更新**: 2025-10-28  
**维护者**: Stardust开发团队

