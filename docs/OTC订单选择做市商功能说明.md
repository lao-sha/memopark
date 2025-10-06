# OTC 订单选择做市商功能实现说明

## 功能概述

在 OTC 订单页面（`http://localhost:5173/#/otc/order`）实现了完整的做市商选择和订单创建功能。用户可以从链上活跃的做市商列表中选择一个，然后创建订单。

## 核心功能

### 1. 做市商出价列表

**位置**：页面顶部，"计价模式"表单之前

**功能特性**：
- ✅ 从链上 `pallet-market-maker` 实时查询所有 Active 状态的做市商
- ✅ 按费率降序排列（高费率做市商排在前面）
- ✅ 显示做市商关键信息：
  - ID（蓝色标签）
  - 做市商地址（可复制）
  - 费率（颜色编码：绿色≤0.5%，橙色0.5%-1%，红色>1%）
  - 最小金额（自动转换 12 位小数）
  - 质押金额（自动转换 12 位小数）

**表格特性**：
- 单选（Radio）选择模式
- 可点击行选择
- 支持按列排序
- 紧凑型显示（节省空间）

### 2. 做市商选择

**选择方式**：
1. **单选框选择**：点击表格左侧的单选按钮
2. **点击行选择**：点击表格任意行

**选中后**：
- 显示绿色成功提示框，包含选中做市商的详细信息
- 可点击关闭按钮取消选择
- "创建订单"按钮变为可用状态，并显示做市商 ID

**自动选择**：
- 如果链上只有一个活跃做市商，页面加载完成后自动选中
- 显示提示消息："已自动选择唯一的做市商"

### 3. 订单创建验证

**前置检查**：
1. **做市商选择检查**：
   - 未选择做市商时，显示警告提示
   - "创建订单"按钮禁用状态
   - 点击按钮时提示："请先从列表中选择一个做市商"

2. **最小金额验证**：
   - 当选择"按 MEMO 数量"计价时
   - 验证订单金额是否满足做市商的最小金额要求
   - 不满足时提示：`订单金额不能低于做市商最小金额：XXX MEMO`

**订单请求**：
创建订单时，自动附加以下做市商信息：
```typescript
{
  marketMakerId: selectedMaker.mmId,
  marketMakerOwner: selectedMaker.owner,
  marketMakerFeeBps: selectedMaker.feeBps,
  // ... 其他订单参数
}
```

### 4. 用户体验优化

**加载状态**：
- 显示 Spin 加载动画："加载做市商列表中..."
- 加载失败时显示错误信息
- 暂无做市商时显示友好提示

**提示信息**：
- 未选择做市商时，显示黄色警告框
- 选中做市商后，显示绿色成功框
- 创建订单成功时，提示包含做市商 ID

**按钮状态**：
- 未选择做市商：按钮禁用，显示"请先选择做市商"
- 已选择做市商：按钮可用，显示"创建订单（做市商 #X）"
- 创建中：按钮加载状态

## 页面布局

```
┌────────────────────────────────────────┐
│ 购买 MEMO              [申请做市商]   │
├────────────────────────────────────────┤
│ 做市商出价列表                          │
│ ┌──────────────────────────────────┐  │
│ │ ○ ID | 地址 | 费率 | 最小金额 | ...│  │
│ │ ● #0 | 5GrwV... | 0.25% | 100     │  │
│ │ ○ #1 | 5FHne... | 0.30% | 50      │  │
│ └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│ ✓ 已选择做市商                          │
│   做市商 ID: #0                         │
│   费率: 0.25%                           │
│   最小金额: 100 MEMO                    │
├────────────────────────────────────────┤
│ [计价模式] ○按法币金额 ○按MEMO数量    │
│ [法币金额/MEMO数量] [输入框]          │
│ [支付方式] [支付宝 ▼]                 │
│ ⚠ 请先从做市商列表中选择一个做市商     │
│ [创建订单（做市商 #0）]               │
└────────────────────────────────────────┘
```

## 技术实现

### 数据结构

```typescript
interface MarketMaker {
  mmId: number          // 做市商 ID
  owner: string         // 做市商地址
  feeBps: number        // 费率（bps）
  minAmount: string     // 最小金额（12位小数）
  publicCid: string     // 公开资料 CID
  deposit: string       // 质押金额（12位小数）
}
```

### 链上查询

```typescript
// 1. 查询 nextId
const nextIdRaw = await api.query.marketMaker.nextId()
const nextId = Number(nextIdRaw.toString())

// 2. 遍历查询所有做市商
for (let i = 0; i < nextId; i++) {
  const appOption = await api.query.marketMaker.applications(i)
  if (appOption.isSome) {
    const app = appOption.unwrap()
    const appData = app.toJSON()
    // 只显示 Active 状态的做市商
    if (appData.status === 'Active') {
      // 添加到列表
    }
  }
}

// 3. 按费率降序排序
makers.sort((a, b) => b.feeBps - a.feeBps)
```

### 订单创建流程

```typescript
const onCreate = async (values) => {
  // 1. 检查是否选择了做市商
  if (!selectedMaker) {
    message.warning('请先从列表中选择一个做市商')
    return
  }

  // 2. 验证最小金额
  if (values.mode === 'memo') {
    const orderAmount = Number(values.memoAmount)
    const minAmount = Number(BigInt(selectedMaker.minAmount) / BigInt(1e12))
    if (orderAmount < minAmount) {
      message.warning(`订单金额不能低于做市商最小金额：${minAmount} MEMO`)
      return
    }
  }

  // 3. 构造订单请求
  const req = {
    providerId,
    payType: values.payType,
    marketMakerId: selectedMaker.mmId,
    marketMakerOwner: selectedMaker.owner,
    marketMakerFeeBps: selectedMaker.feeBps,
    ...
  }

  // 4. 创建订单
  const draft = await createOrder(req)
  message.success(`订单已创建，请扫码支付（做市商 #${selectedMaker.mmId}）`)
}
```

## 使用流程

### 用户操作流程

1. **进入页面**
   - 访问 `http://localhost:5173/#/otc/order`
   - 系统自动加载链上做市商列表

2. **选择做市商**
   - 查看做市商列表（费率、最小金额等信息）
   - 点击表格任意行或单选框选择做市商
   - 查看选中提示框确认信息

3. **填写订单信息**
   - 选择计价模式（法币金额或 MEMO 数量）
   - 输入购买金额
   - 选择支付方式

4. **创建订单**
   - 点击"创建订单（做市商 #X）"按钮
   - 系统验证金额是否满足最小要求
   - 创建成功后显示支付二维码

5. **支付并领取**
   - 扫码支付
   - 等待支付确认
   - 点击"前往领取"按钮领取 MEMO

### 错误处理

**加载失败**：
- 显示错误提示："做市商模块尚未在链上注册" 或其他错误信息

**暂无做市商**：
- 显示提示："暂无活跃做市商"
- 引导用户申请成为做市商

**未选择做市商**：
- 显示警告："请先从做市商列表中选择一个做市商"
- 按钮禁用状态

**金额不足**：
- 显示警告："订单金额不能低于做市商最小金额：XXX MEMO"

## 安全性考虑

1. **链上数据验证**：
   - 仅显示 Active 状态的做市商
   - 所有数据从链上实时查询，确保准确性

2. **最小金额验证**：
   - 前端验证订单金额是否满足做市商要求
   - 避免创建无效订单

3. **做市商信息传递**：
   - 将选中的做市商信息完整传递给后端
   - 后端可进行二次验证

4. **用户友好提示**：
   - 每步操作都有明确提示
   - 错误信息具体明确

## 后续优化建议

1. **性能优化**：
   - 集成 Subsquid 索引，避免遍历查询
   - 实现分页加载和虚拟滚动

2. **功能增强**：
   - 显示做市商评分和历史成交记录
   - 添加做市商详情页面
   - 支持多做市商比价

3. **用户体验**：
   - 保存用户上次选择的做市商
   - 智能推荐最优做市商
   - 显示预估到账时间

## 相关文件

- **前端页面**：`memopark-dapp/src/features/otc/CreateOrderPage.tsx`
- **链端 Pallet**：`pallets/market-maker/src/lib.rs`
- **Pallet 文档**：`pallets/market-maker/README.md`
- **申请页面**：`memopark-dapp/src/features/otc/CreateMarketMakerPage.tsx`

## 完成日期

2025-10-06

## 遵循规则

- ✅ 函数级详细中文注释
- ✅ 全局链上直连（不依赖 Subsquid）
- ✅ 组件化设计
- ✅ 前后端同步
- ✅ CID 不加密（如适用）
- ✅ 资金安全检查

