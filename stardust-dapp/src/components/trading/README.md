# Trading 交易组件库

## 📋 组件清单

### 1. OTCOrderCard - OTC订单卡片
**文件**：`OTCOrderCard.tsx`（520行）

**功能**：
- ✅ 展示订单完整信息（ID、状态、金额、数量）
- ✅ 显示买家/卖家信息
- ✅ 订单状态可视化（进度条 + 状态标签）
- ✅ 根据用户角色显示操作按钮
- ✅ 买家标记已付款（含付款弹窗）
- ✅ 做市商释放MEMO
- ✅ 取消订单功能
- ✅ 发起争议功能

**Props**：
```typescript
interface OTCOrderCardProps {
  order: Order                 // 订单数据
  currentAccount?: string      // 当前用户地址
  onRefresh?: () => void       // 刷新回调
  detailed?: boolean           // 是否显示详细信息（默认true）
}
```

**使用示例**：
```tsx
import { OTCOrderCard } from './components/trading'

<OTCOrderCard
  order={orderData}
  currentAccount={account}
  onRefresh={() => loadOrders()}
  detailed={true}
/>
```

---

### 2. CreateOTCOrderModal - 创建OTC订单弹窗
**文件**：`CreateOTCOrderModal.tsx`（440行）

**功能**：
- ✅ 选择做市商（含溢价信息）
- ✅ 输入购买数量
- ✅ 输入联系方式哈希
- ✅ 自动计算总金额和单价
- ✅ 实时显示溢价影响
- ✅ 一键创建订单

**Props**：
```typescript
interface CreateOTCOrderModalProps {
  open: boolean                 // 是否显示弹窗
  onClose: () => void           // 关闭回调
  account: string               // 当前账户地址
  onSuccess?: () => void        // 创建成功回调
}
```

**使用示例**：
```tsx
import { CreateOTCOrderModal } from './components/trading'

const [showCreate, setShowCreate] = useState(false)

<Button onClick={() => setShowCreate(true)}>创建订单</Button>

<CreateOTCOrderModal
  open={showCreate}
  onClose={() => setShowCreate(false)}
  account={currentAccount}
  onSuccess={() => {
    setShowCreate(false)
    loadOrders()
  }}
/>
```

---

### 3. MarketMakerList - 做市商列表
**文件**：`MarketMakerList.tsx`（280行）

**功能**：
- ✅ 展示做市商列表（卡片视图）
- ✅ 显示状态、方向、溢价
- ✅ 支持状态筛选
- ✅ 支持方向筛选
- ✅ 支持选择做市商

**Props**：
```typescript
interface MarketMakerListProps {
  onSelect?: (maker: MakerApplication) => void  // 选择回调
  showSelectButton?: boolean                    // 是否显示选择按钮
  filterStatus?: ApplicationStatus              // 初始状态筛选
  filterDirection?: Direction                   // 初始方向筛选
  limit?: number                                // 数量限制（默认50）
}
```

**使用示例**：
```tsx
import { MarketMakerList } from './components/trading'

// 纯展示模式
<MarketMakerList limit={20} />

// 选择模式
<MarketMakerList
  showSelectButton
  onSelect={(maker) => {
    console.log('选择了做市商:', maker)
    // 执行后续操作...
  }}
  filterStatus={ApplicationStatus.Active}
  filterDirection={Direction.Sell}
/>
```

---

### 4. BridgeTransactionForm - 跨链桥交易表单
**文件**：`BridgeTransactionForm.tsx`（630行）

**功能**：
- ✅ Tab切换交易方向（MEMO→TRON / USDT→MEMO）
- ✅ MEMO → TRON：兑换MEMO为USDT
- ✅ USDT → MEMO：购买MEMO（支持首购优惠）
- ✅ 实时价格计算（含溢价）
- ✅ 首购资格验证和优惠提示
- ✅ TRON地址验证
- ✅ 交易摘要预览
- ✅ 一键提交交易

**Props**：
```typescript
interface BridgeTransactionFormProps {
  account: string             // 当前账户地址
  onSuccess?: () => void      // 交易成功回调
}
```

**使用示例**：
```tsx
import { BridgeTransactionForm } from './components/trading'

<BridgeTransactionForm
  account={currentAccount}
  onSuccess={() => {
    message.success('交易成功！')
    loadBalance()
  }}
/>
```

**功能亮点**：
- **双向交易**：支持 MEMO→TRON 和 USDT→MEMO 两种方向
- **智能定价**：自动应用市场溢价或首购优惠
- **首购优惠**：符合资格的用户享受特惠价（如10%折扣）
- **实时计算**：输入金额后实时显示预计到账
- **地址验证**：自动验证TRON地址格式（T开头，34位）
- **安全提示**：每个交易都有温馨提示和确认流程

---

### 5. TradingDashboard - 交易总览仪表板
**文件**：`TradingDashboard.tsx`（430行）

**功能**：
- ✅ Tab切换（我的订单 / 做市商 / 跨链桥）
- ✅ 数据统计（总订单 / 进行中 / 已完成 / 累计交易额）
- ✅ 订单列表展示（整合OTCOrderCard）
- ✅ 订单筛选（状态 + 角色）
- ✅ 做市商列表（整合MarketMakerList）
- ✅ 跨链桥交易（整合BridgeTransactionForm）
- ✅ 快捷操作（创建订单 / 刷新）
- ✅ 进行中订单徽章提示

**Props**：
```typescript
interface TradingDashboardProps {
  account: string             // 当前账户地址
}
```

**使用示例**：
```tsx
import { TradingDashboard } from './components/trading'

// 作为独立页面
<TradingDashboard account={currentAccount} />
```

**Tab结构**：
1. **我的订单**：
   - 统计卡片（4个指标）
   - 操作栏（创建/刷新/筛选）
   - 订单列表（OTCOrderCard）
   
2. **做市商**：
   - 做市商列表（MarketMakerList）
   - 支持选择做市商快速创建订单
   
3. **跨链桥**：
   - 跨链桥交易表单（BridgeTransactionForm）
   - MEMO ⇄ USDT 双向兑换

**亮点特性**：
- **一体化设计**：整合所有Trading功能于单一界面
- **实时统计**：自动计算订单数量和交易额
- **智能筛选**：按状态和角色筛选订单
- **快捷操作**：一键创建订单、刷新数据
- **徽章提示**：进行中订单数量实时显示

---

## 🎨 UI风格说明

### 颜色方案
- **主色调**：`#1890ff`（蓝色）- 与全局UI保持一致
- **成功**：`#52c41a`（绿色）
- **警告**：`#faad14`（橙色）
- **错误**：`#ff4d4f`（红色）
- **默认**：`#d9d9d9`（灰色）

### 订单状态颜色
| 状态 | 颜色 | 说明 |
|------|------|------|
| Created | blue | 已创建 |
| PaidOrCommitted | processing | 已付款 |
| Released | success | 已完成 |
| Disputed | warning | 争议中 |
| Arbitrating | warning | 仲裁中 |
| Canceled | default | 已取消 |
| Refunded | default | 已退款 |
| Closed | default | 已关闭 |

### 响应式设计
- 所有组件支持桌面端/网页端自适应
- 卡片圆角统一：`12px`
- 阴影统一：`0 2px 8px rgba(0,0,0,0.08)`
- 间距统一：使用 Ant Design Space组件

---

## 🔧 技术栈

- **React 18** + **TypeScript**
- **Ant Design 5**：UI组件库
- **@polkadot/extension-dapp**：钱包交互
- **tradingService**：统一API服务层

---

## 📦 依赖关系

```
trading/
├── OTCOrderCard.tsx         → tradingService (520行)
├── CreateOTCOrderModal.tsx  → tradingService (440行)
├── MarketMakerList.tsx      → tradingService (280行)
├── BridgeTransactionForm.tsx → tradingService (630行)
├── TradingDashboard.tsx     → All Components (430行)
├── index.ts                 (导出文件)
└── README.md                (本文件)

services/
└── tradingService.ts        (API服务层, 686行)
```

---

## 🚀 快速开始

### 1. 导入组件
```tsx
import { 
  TradingDashboard,      // 推荐：一体化仪表板
  OTCOrderCard, 
  CreateOTCOrderModal,
  MarketMakerList,
  BridgeTransactionForm 
} from './components/trading'
```

### 2. 推荐用法（使用TradingDashboard）
```tsx
function TradingPage() {
  const account = useCurrentAccount()

  // 最简单：直接使用一体化仪表板
  return <TradingDashboard account={account} />
}
```

### 3. 高级用法（自定义组合）
```tsx
function CustomTradingPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const account = useCurrentAccount()

  return (
    <div>
      {/* 创建订单按钮 */}
      <Button onClick={() => setShowCreate(true)}>
        创建OTC订单
      </Button>

      {/* 创建订单弹窗 */}
      <CreateOTCOrderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        account={account}
        onSuccess={() => loadOrders()}
      />

      {/* 订单列表 */}
      {orders.map(order => (
        <OTCOrderCard
          key={order.id}
          order={order}
          currentAccount={account}
          onRefresh={() => loadOrders()}
        />
      ))}

      {/* 做市商列表 */}
      <MarketMakerList limit={10} />

      {/* 跨链桥交易 */}
      <BridgeTransactionForm
        account={account}
        onSuccess={() => message.success('交易成功！')}
      />
    </div>
  )
}
```

---

## ⚠️ 注意事项

### 1. 钱包连接
- 所有组件都需要用户钱包已连接
- 使用 `@polkadot/extension-dapp` 进行签名

### 2. 错误处理
- 所有组件已内置错误处理和用户提示
- 使用 Ant Design Message组件显示反馈

### 3. 数据刷新
- 组件不会自动刷新数据
- 需要在回调中手动触发刷新

### 4. 性能优化
- 列表使用 Ant Design Pagination
- 默认每页显示10条记录

---

## 📝 TODO

- [x] BridgeTransactionForm 组件（跨链桥交易表单）✅
- [x] TradingDashboard 组件（交易总览仪表板）✅
- [ ] OTC聊天集成（与现有聊天系统对接）
- [ ] 订单通知系统
- [ ] 移动端优化
- [ ] 实时数据订阅（WebSocket/Polling）

---

## 📄 License

Apache-2.0

