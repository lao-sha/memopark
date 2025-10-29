# Deceased 逝者管理组件库

## 📋 组件清单

### 1. DeceasedInfoCard - 逝者信息卡片
**文件**：`DeceasedInfoCard.tsx`（360行）

**功能**：
- ✅ 展示逝者基本信息（姓名、性别、生卒年月）
- ✅ 显示主图（支持IPFS加载）
- ✅ Pin状态指示器（姓名/主图/简介）
- ✅ 生命周期时间轴
- ✅ 所有权信息（所有者/创建者）
- ✅ 快捷操作（编辑/删除）

**Props**：
```typescript
interface DeceasedInfoCardProps {
  deceased: DeceasedInfo        // 逝者信息
  currentAccount?: string        // 当前用户
  onRefresh?: () => void         // 刷新回调
  onEdit?: (deceased) => void    // 编辑回调
  detailed?: boolean             // 详细模式（默认true）
}
```

**使用示例**：
```tsx
import { DeceasedInfoCard } from './components/deceased'

<DeceasedInfoCard
  deceased={deceasedData}
  currentAccount={account}
  onRefresh={() => loadData()}
  onEdit={(d) => setEditTarget(d)}
  detailed={true}
/>
```

---

### 2. CreateDeceasedModal - 创建逝者弹窗
**文件**：`CreateDeceasedModal.tsx`（180行）

**功能**：
- ✅ 表单输入（姓名/性别/生卒日期/简介）
- ✅ 上传主图到IPFS
- ✅ 自动生成CID
- ✅ 一键创建逝者记录

**Props**：
```typescript
interface CreateDeceasedModalProps {
  open: boolean                 // 是否显示
  onClose: () => void           // 关闭回调
  account: string               // 当前账户
  onSuccess?: () => void        // 成功回调
}
```

**使用示例**：
```tsx
import { CreateDeceasedModal } from './components/deceased'

const [showCreate, setShowCreate] = useState(false)

<Button onClick={() => setShowCreate(true)}>创建逝者</Button>

<CreateDeceasedModal
  open={showCreate}
  onClose={() => setShowCreate(false)}
  account={currentAccount}
  onSuccess={() => {
    setShowCreate(false)
    loadData()
  }}
/>
```

---

## 🎨 UI风格说明

### 颜色方案
- **主色调**：`#1890ff`（蓝色）- 与全局UI保持一致
- **性别颜色**：
  - 男性：`#1890ff`（蓝色）
  - 女性：`#eb2f96`（粉色）
  - 其他：`#999`（灰色）

### Pin状态颜色
| 状态 | 颜色 | 图标 | 说明 |
|------|------|------|------|
| Unpinned | default | ○ | 未固定 |
| Pinning | processing | ⟳ | 固定中 |
| Pinned | success | ✓ | 已固定 |
| PinFailed | error | ✗ | 固定失败 |

---

## 🚀 快速开始

### 1. 导入组件
```tsx
import { 
  DeceasedInfoCard, 
  CreateDeceasedModal 
} from './components/deceased'
```

### 2. 基础用法
```tsx
function DeceasedPage() {
  const [deceased, setDeceased] = useState<DeceasedInfo[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const account = useCurrentAccount()

  return (
    <div>
      {/* 创建按钮 */}
      <Button onClick={() => setShowCreate(true)}>
        创建逝者记录
      </Button>

      {/* 创建弹窗 */}
      <CreateDeceasedModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        account={account}
        onSuccess={() => loadData()}
      />

      {/* 逝者列表 */}
      {deceased.map(d => (
        <DeceasedInfoCard
          key={d.id}
          deceased={d}
          currentAccount={account}
          onRefresh={() => loadData()}
        />
      ))}
    </div>
  )
}
```

---

## 📝 TODO

- [ ] DeceasedTextManager 组件（消息/悼词管理）
- [ ] DeceasedMediaGallery 组件（相册/视频管理）
- [ ] DeceasedDashboard 组件（一体化仪表板）
- [ ] Pin状态实时监控
- [ ] 批量操作支持

---

## 📄 License

Apache-2.0
