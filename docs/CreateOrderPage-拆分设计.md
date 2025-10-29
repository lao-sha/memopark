# CreateOrderPage.tsx 拆分设计文档

**📅 创建时间**: 2025-10-29  
**🎯 目标**: 将1299行的CreateOrderPage拆分为多个可维护的小组件  
**⚡ 策略**: 简化版拆分（Phase 1）+ 完整版规划（Phase 2）

---

## 📊 现状分析

### 文件统计

| 指标 | 数值 |
|------|------|
| 总行数 | 1,299行 |
| 类型定义 | 2个 (MarketMaker, Listing) |
| State变量 | ~15个 |
| Effect Hooks | 5个 |
| 核心函数 | 2个 (calculatePriceDeviation, onCreate) |
| 辅助函数 | 5个 |
| UI层级 | 深度嵌套 |

### 复杂度分布

| 模块 | 行数 | 复杂度 |
|------|------|--------|
| **类型定义** | 17-61 (45行) | 🟢 低 |
| **State + Hooks** | 72-347 (276行) | 🟡 中 |
| **核心业务逻辑** | 349-693 (345行) | 🔴 高 |
| **UI渲染** | 705-1187 (483行) | 🟡 中 |
| **辅助函数** | 1189-1299 (111行) | 🟢 低 |

### 主要功能模块

1. **做市商加载与选择** (166-228, 786-952行)
   - 从链上加载活跃做市商
   - 做市商选择器UI
   - 价格信息展示
   - 信用徽章集成

2. **订单表单** (960-1079行)
   - 计价模式选择（法币/DUST）
   - 金额输入
   - 支付方式选择
   - 联系方式输入

3. **订单创建逻辑** (384-693行)
   - 参数验证
   - 价格偏离检查
   - 链上交易提交
   - 错误处理

4. **价格计算** (116-137, 354-374行)
   - 加载基准价格
   - 计算价格偏离
   - 风险提示

5. **订单状态轮询** (320-347行)
   - 定时查询链上状态
   - 状态更新

6. **EPAY支付辅助函数** (1189-1299行)
   - 字段解码
   - 订单号生成
   - 签名生成
   - IP/设备检测

---

## 🎯 Phase 1: 简化版拆分（今天执行）⭐

**时间**: 1.5-2小时  
**风险**: ✅ 极低  
**策略**: 仅提取，不修改主文件

### 任务清单

#### 1. 创建类型定义文件 ✅

**文件**: `stardust-dapp/src/features/otc/types/order.types.ts`

**内容**:
```typescript
/**
 * 函数级详细中文注释：做市商信息接口
 */
export interface MarketMaker {
  mmId: number
  owner: string
  sellPremiumBps: number
  minAmount: string
  publicCid: string
  deposit: string
  epayGateway: string
  epayPort: number
  epayPid: string
  epayKey: string
  tronAddress?: string
}

/**
 * 函数级详细中文注释：OTC 挂单接口
 * - 做市商创建的买卖挂单
 * - 包含价格、数量、有效期等信息
 * 
 * ⚠️ 注意：此类型已废弃，仅保留用于向后兼容
 */
export interface Listing {
  id: number
  maker: string
  side: number
  base: number
  quote: number
  priceUsdt: number
  pricingSpreadBps: number
  priceMin: string | null
  priceMax: string | null
  minQty: string
  maxQty: string
  total: string
  remaining: string
  partial: boolean
  expireAt: number
  active: boolean
  makerInfo?: MarketMaker
}

/**
 * 函数级详细中文注释：订单信息接口
 */
export interface Order {
  order_id: string
  maker_id: number
  maker_name: string
  qty: string
  amount: string
  created_at: number
  memo_amount?: string
  fiat_amount?: string
  expired_at?: number
  url?: string
  pay_qr?: string
}

/**
 * 函数级详细中文注释：价格偏离计算结果
 */
export interface PriceDeviationResult {
  finalPrice: number          // 最终价格（USDT，精度10^6）
  deviationPercent: number    // 偏离率（百分比）
  isWarning: boolean          // 是否警告级别（15-20%）
  isError: boolean            // 是否错误级别（>20%）
}

/**
 * 函数级详细中文注释：订单表单数据
 */
export interface OrderFormData {
  mode: 'fiat' | 'memo'       // 计价模式
  fiatAmount?: number         // 法币金额
  dustAmount?: number         // DUST数量
  payType: 'alipay' | 'wechat' // 支付方式
  contact: string             // 联系方式
}
```

**收益**:
- ✅ 统一类型管理
- ✅ 便于在多个组件间共享
- ✅ 提升类型安全性

---

#### 2. 创建支付工具函数 ✅

**文件**: `stardust-dapp/src/utils/paymentUtils.ts`

**内容**:
```typescript
import CryptoJS from 'crypto-js'

/**
 * 函数级详细中文注释：解码EPAY字段（处理十六进制字符串）
 */
export const decodeEpayField = (field: any): string => {
  if (!field) return ''
  if (typeof field === 'string' && !field.startsWith('0x')) {
    return field
  }
  if (typeof field === 'string' && field.startsWith('0x')) {
    try {
      const hex = field.slice(2)
      const byteArray: number[] = []
      for (let i = 0; i < hex.length; i += 2) {
        byteArray.push(parseInt(hex.substr(i, 2), 16))
      }
      return new TextDecoder().decode(new Uint8Array(byteArray))
    } catch (e) {
      console.warn('解码EPAY字段失败:', field, e)
      return ''
    }
  }
  return ''
}

/**
 * 函数级详细中文注释：生成唯一的商户订单号
 * 格式：MM + 年月日时分秒 + 随机数
 */
export const generateMerchantOrderNo = (): string => {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
                   (now.getMonth() + 1).toString().padStart(2, '0') +
                   now.getDate().toString().padStart(2, '0') +
                   now.getHours().toString().padStart(2, '0') +
                   now.getMinutes().toString().padStart(2, '0') +
                   now.getSeconds().toString().padStart(2, '0')

  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `MM${timestamp}${random}`
}

/**
 * 函数级详细中文注释：生成EPAY支付签名（MD5）
 */
export const generatePaymentSignature = (params: any, secretKey: string): string => {
  // 1. 过滤掉不需要签名的字段
  const { sign, ...paramsToSign } = params

  // 2. 按键名升序排列
  const sortedKeys = Object.keys(paramsToSign).sort()

  // 3. 构造签名字符串
  let signString = ''
  sortedKeys.forEach(key => {
    if (paramsToSign[key] !== undefined && paramsToSign[key] !== null && paramsToSign[key] !== '') {
      signString += `${key}=${paramsToSign[key]}&`
    }
  })

  // 4. 添加商户密钥
  signString += `key=${secretKey}`

  // 5. 计算MD5哈希（小写）
  const hash = CryptoJS.MD5(signString).toString().toLowerCase()

  console.log('🔐 支付签名:', {
    signString: signString,
    hash: hash,
    secretKey: secretKey.substring(0, 4) + '***'
  })

  return hash
}

/**
 * 函数级详细中文注释：获取客户端IP地址
 */
export const getClientIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip || '127.0.0.1'
  } catch (error) {
    console.warn('获取IP地址失败，使用默认值:', error)
    return '127.0.0.1'
  }
}

/**
 * 函数级详细中文注释：检测设备类型
 */
export const detectDeviceType = (): string => {
  const userAgent = navigator.userAgent.toLowerCase()
  if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
    return 'mobile'
  }
  return 'pc'
}
```

**收益**:
- ✅ 辅助函数独立管理
- ✅ 便于单元测试
- ✅ 可在其他组件复用

---

#### 3. 创建拆分设计文档 ✅

**文件**: `docs/CreateOrderPage-拆分设计.md`（本文档）

**收益**:
- ✅ 详细的Phase 2规划
- ✅ 组件职责清晰
- ✅ 为未来拆分提供指导

---

### Phase 1 成果

| 文件 | 大小 | 类型 | 状态 |
|------|------|------|------|
| order.types.ts | ~2.5KB | 类型定义 | ✅ 待创建 |
| paymentUtils.ts | ~3.5KB | 工具函数 | ✅ 待创建 |
| CreateOrderPage-拆分设计.md | ~15KB | 设计文档 | ✅ 当前文档 |

**总计**: 新增~21KB代码和文档，零风险执行！

---

## 🚀 Phase 2: 完整版拆分（未来执行）

**时间**: 4-6小时  
**风险**: ⚠️ 中等  
**策略**: 渐进式重构

### 目标架构

```
CreateOrderPage.tsx (主容器, ~150行)
└── features/otc/
    ├── types/
    │   └── order.types.ts (✅ Phase 1已完成)
    ├── components/order-creation/
    │   ├── MarketMakerSelector.tsx       # 做市商选择器
    │   ├── PriceInfoCard.tsx             # 价格信息卡片
    │   ├── OrderForm.tsx                 # 订单表单
    │   └── OrderStatusCard.tsx           # 订单状态展示
    └── hooks/
        ├── useMarketMakers.ts            # 做市商数据加载
        ├── usePriceCalculation.ts        # 价格计算
        ├── useOrderCreation.ts           # 订单创建逻辑
        └── useOrderPolling.ts            # 订单状态轮询
```

---

### 组件详细设计

#### 1. MarketMakerSelector.tsx

**职责**: 做市商选择器

**Props**:
```typescript
interface MarketMakerSelectorProps {
  value?: number                          // 选中的做市商ID
  onChange: (maker: MarketMaker | null) => void
  basePrice: number                       // 基准价格
  loadingPrice: boolean                   // 价格加载状态
}
```

**包含内容**:
- 做市商下拉选择
- 信用徽章显示
- 价格信息展示（PriceInfoCard）
- 价格偏离警告

**大小**: ~250行

---

#### 2. PriceInfoCard.tsx

**职责**: 价格信息展示卡片

**Props**:
```typescript
interface PriceInfoCardProps {
  maker: MarketMaker                      // 选中的做市商
  basePrice: number                       // 基准价格
  priceDeviation: PriceDeviationResult   // 价格偏离计算结果
}
```

**包含内容**:
- 基准价格展示
- 做市商溢价展示
- 最终订单价格
- 最小金额/保证金
- 价格偏离警告

**大小**: ~150行

---

#### 3. OrderForm.tsx

**职责**: 订单创建表单

**Props**:
```typescript
interface OrderFormProps {
  selectedMaker: MarketMaker | null      // 选中的做市商
  basePrice: number                       // 基准价格
  creating: boolean                       // 创建中状态
  onSubmit: (values: OrderFormData) => void
}
```

**包含内容**:
- 计价模式选择
- 金额输入
- 支付方式选择
- 联系方式输入
- 提交按钮

**大小**: ~200行

---

#### 4. OrderStatusCard.tsx

**职责**: 订单状态展示

**Props**:
```typescript
interface OrderStatusCardProps {
  order: Order | null                    // 订单信息
  status: string                         // 订单状态
  nowSec: number                         // 当前时间戳
}
```

**包含内容**:
- 订单详情
- 支付二维码
- 状态标签
- 倒计时
- 操作按钮

**大小**: ~150行

---

### 自定义Hooks设计

#### 1. useMarketMakers.ts

**职责**: 加载和管理做市商数据

**返回值**:
```typescript
{
  marketMakers: MarketMaker[]
  loading: boolean
  error: string
  selectedMaker: MarketMaker | null
  setSelectedMaker: (maker: MarketMaker | null) => void
}
```

**包含逻辑**:
- 从链上加载做市商
- 解码EPAY字段
- 按溢价排序
- 做市商选择状态管理

**大小**: ~120行

---

#### 2. usePriceCalculation.ts

**职责**: 价格计算和偏离检查

**返回值**:
```typescript
{
  basePrice: number
  loadingPrice: boolean
  calculatePriceDeviation: (makerId: number) => PriceDeviationResult
}
```

**包含逻辑**:
- 加载基准价格
- 定时更新（30秒）
- 价格偏离计算
- 风险等级判断

**大小**: ~100行

---

#### 3. useOrderCreation.ts

**职责**: 订单创建核心逻辑

**返回值**:
```typescript
{
  creating: boolean
  order: Order | null
  createOrder: (values: OrderFormData, maker: MarketMaker) => Promise<void>
}
```

**包含逻辑**:
- 参数验证
- 价格偏离前端检查
- 生成承诺哈希
- 链上交易提交
- 错误处理
- 聊天窗口打开

**大小**: ~250行

---

#### 4. useOrderPolling.ts

**职责**: 订单状态轮询

**返回值**:
```typescript
{
  status: string
  pollOrder: (orderId: string) => void
  stopPolling: () => void
}
```

**包含逻辑**:
- 定时轮询链上状态
- 状态更新
- 自动停止条件

**大小**: ~80行

---

### Phase 2 执行步骤

#### 步骤1: 提取Hooks（2小时）

1. 创建 `useMarketMakers.ts`
2. 创建 `usePriceCalculation.ts`
3. 创建 `useOrderCreation.ts`
4. 创建 `useOrderPolling.ts`
5. 测试验证

#### 步骤2: 提取UI组件（2小时）

1. 创建 `PriceInfoCard.tsx`
2. 创建 `MarketMakerSelector.tsx`
3. 创建 `OrderForm.tsx`
4. 创建 `OrderStatusCard.tsx`
5. 测试验证

#### 步骤3: 重构主容器（1小时）

1. 修改 `CreateOrderPage.tsx` 使用新Hooks和组件
2. 删除旧代码
3. 测试验证

#### 步骤4: 验收和优化（1小时）

1. 完整功能测试
2. 性能优化
3. 代码审查
4. 文档更新

---

## 📊 预期收益

### Phase 1 (简化版)

- ✅ 类型定义统一管理
- ✅ 辅助函数独立复用
- ✅ 详细设计文档
- ✅ 零风险执行
- ✅ 为Phase 2打基础

### Phase 2 (完整版)

**代码行数**:
```
CreateOrderPage.tsx:   1299行 → 150行  (-1149行)

新增文件:
- order.types.ts:            ~80行
- paymentUtils.ts:          ~130行
- useMarketMakers.ts:       ~120行
- usePriceCalculation.ts:   ~100行
- useOrderCreation.ts:      ~250行
- useOrderPolling.ts:        ~80行
- MarketMakerSelector.tsx:  ~250行
- PriceInfoCard.tsx:        ~150行
- OrderForm.tsx:            ~200行
- OrderStatusCard.tsx:      ~150行

总计: 150 + 1510 = 1660行
净增加: 361行
```

**可维护性**:
- ✅ 单个文件 < 300行
- ✅ 职责清晰
- ✅ 便于测试
- ✅ 便于复用

**开发效率**:
- ✅ 并行开发
- ✅ 快速定位问题
- ✅ 易于扩展

---

## 🎯 成功标准

### Phase 1 验收标准

- [x] 创建 `order.types.ts` 文件
- [x] 创建 `paymentUtils.ts` 文件
- [x] 创建拆分设计文档
- [x] 所有新文件通过编译
- [x] Git提交并打标签

### Phase 2 验收标准

- [ ] CreateOrderPage.tsx < 200行
- [ ] 所有Hooks和组件功能正常
- [ ] 无功能退化
- [ ] 无新增TypeScript错误
- [ ] 通过完整功能测试
- [ ] 代码审查通过

---

## 🔙 回滚方案

### Phase 1 回滚

Phase 1仅添加文件，无需回滚。如果需要：

```bash
# 删除新增文件
rm stardust-dapp/src/features/otc/types/order.types.ts
rm stardust-dapp/src/utils/paymentUtils.ts
rm docs/CreateOrderPage-拆分设计.md

# 或者使用Git回滚到标签
git reset --hard frontend-optimization-day2-complete
```

### Phase 2 回滚

Phase 2会修改主文件，需要Git备份：

```bash
# 创建备份分支
git checkout -b backup-before-create-order-refactor

# 如果出问题，回滚到备份
git checkout backup-before-create-order-refactor
```

---

## 📚 相关资源

### 参考文档

- `CreateMarketMakerPage-拆分设计.md` - Day 2拆分设计
- `前端优化-快速行动指南.md` - 5天优化计划
- `前端冗余分析和优化方案.md` - 总体分析

### 相关组件

- `CreateMarketMakerPage.tsx` - 类似的大文件（2185行）
- `MyOrdersCard.tsx` - 订单列表组件
- `MakerCreditBadge.tsx` - 做市商信用徽章

### 依赖库

- `@polkadot/api` - 链交互
- `antd` - UI组件
- `crypto-js` - 加密工具
- `@polkadot/util-crypto` - 加密工具

---

## 💡 最佳实践

### 组件设计原则

1. **单一职责** - 每个组件只做一件事
2. **Props清晰** - 接口定义明确
3. **状态提升** - 共享状态放到父组件
4. **便于测试** - 逻辑与UI分离

### Hooks设计原则

1. **功能聚焦** - 每个Hook专注一个功能
2. **可复用** - 避免硬编码
3. **依赖明确** - useEffect依赖清晰
4. **错误处理** - 统一错误处理

### 代码组织原则

1. **目录清晰** - 按功能分组
2. **命名规范** - 见名知义
3. **注释充分** - 函数级中文注释
4. **类型安全** - 充分利用TypeScript

---

## 🎊 总结

### Phase 1 (今天执行)

- ⏱️ **时间**: 1.5-2小时
- 🎯 **目标**: 低风险、快速见效
- ✅ **策略**: 仅提取，不修改
- 📦 **成果**: 3个新文件，~21KB

### Phase 2 (未来执行)

- ⏱️ **时间**: 4-6小时
- 🎯 **目标**: 完整重构
- ⚠️ **风险**: 中等
- 📦 **成果**: 10个新文件，净减少938行

---

**📅 文档创建时间**: 2025-10-29  
**✍️ 作者**: AI Assistant  
**📊 版本**: v1.0  
**🎯 状态**: Phase 1 Ready to Execute

**🚀 让我们开始执行Phase 1吧！**

