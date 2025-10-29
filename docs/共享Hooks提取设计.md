# 共享Hooks提取设计文档

**📅 创建时间**: 2025-10-29  
**🎯 目标**: 提取可复用的React Hooks，减少代码重复  
**⚡ 策略**: 简化版分析（Phase 1）+ 完整版规划（Phase 2）

---

## 📊 重复代码分析

### 发现的重复模式

| 模式 | 重复次数 | 涉及文件 | 估计行数 |
|------|----------|----------|----------|
| **做市商加载** | 3次 | CreateOrderPage, MarketMakerConfigPage, MakerBridgeConfigPage | ~150行×3 = 450行 |
| **EPAY字段解码** | 2次 | MarketMakerConfigPage (bytesToString), paymentUtils (decodeEpayField) | ~40行×2 = 80行 |
| **订单查询** | 3次 | CreateOrderPage, MyOrdersCard, SellerReleasePage | ~100行×3 = 300行 |
| **价格计算** | 4次 | CreateOrderPage, BridgeTransactionForm, CreateOTCOrderModal等 | ~60行×4 = 240行 |

**总重复代码量**: 约 **1,070行**

---

## 🎯 Phase 1: 简化版分析（今天执行）⭐

**时间**: 2小时  
**风险**: ✅ 极低  
**策略**: 仅分析和设计，不修改现有代码

### 任务清单

#### 1. 分析重复模式 ✅

**已完成**: 识别出4种主要重复模式

#### 2. 设计Hook接口 ✅

**详见下方设计方案**

#### 3. 统一工具函数 ✅

**发现问题**: `bytesToString` 和 `decodeEpayField` 是重复的

**解决方案**: 
- 保留 `paymentUtils.ts` 中的 `decodeEpayField`
- 删除 `MarketMakerConfigPage.tsx` 中的 `bytesToString`
- 更新导入引用

#### 4. 创建设计文档 ✅

**本文档**

---

## 🚀 Phase 2: 完整版提取（未来执行）

**时间**: 6-8小时  
**风险**: ⚠️ 中等  
**策略**: 渐进式重构

### 目标架构

```
stardust-dapp/src/
├── hooks/                          # 🆕 共享Hooks目录
│   ├── market-maker/
│   │   ├── useMarketMakers.ts      # 做市商列表加载
│   │   ├── useCurrentMakerInfo.ts  # 当前账户做市商信息
│   │   └── index.ts
│   ├── trading/
│   │   ├── useOrderQuery.ts        # 订单查询
│   │   ├── usePriceCalculation.ts  # 价格计算
│   │   └── index.ts
│   └── chain/
│       ├── useChainApi.ts          # API连接
│       └── index.ts
└── utils/
    └── paymentUtils.ts             # ✅ 已存在
```

---

## 📋 详细设计方案

### 1. useMarketMakers Hook

**用途**: 加载所有活跃做市商列表

**替代文件**:
- `CreateOrderPage.tsx` (166-228行)
- 部分 `MarketMakerConfigPage.tsx` 逻辑
- 部分 `MakerBridgeConfigPage.tsx` 逻辑

**接口设计**:

```typescript
/**
 * 函数级详细中文注释：加载和管理活跃做市商列表
 * 
 * @returns {Object} 做市商数据和状态
 */
export function useMarketMakers() {
  return {
    /** 做市商列表 */
    marketMakers: MarketMaker[],
    /** 加载状态 */
    loading: boolean,
    /** 错误信息 */
    error: string,
    /** 重新加载 */
    reload: () => void
  }
}
```

**内部实现**:

```typescript
export function useMarketMakers() {
  const [marketMakers, setMarketMakers] = useState<MarketMaker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMarketMakers = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      
      const api = await getApi()
      
      if (!(api.query as any).marketMaker) {
        throw new Error('做市商模块尚未在链上注册')
      }

      const entries = await (api.query as any).marketMaker.activeMarketMakers.entries()
      
      const makers: MarketMaker[] = []
      for (const [key, value] of entries) {
        if (value.isSome) {
          const app = value.unwrap()
          const appData = app.toJSON() as any
          const mmId = key.args[0].toNumber()
          
          makers.push({
            mmId,
            owner: appData.owner || '',
            sellPremiumBps: appData.sellPremiumBps !== undefined ? Number(appData.sellPremiumBps) : 0,
            minAmount: appData.minAmount || '0',
            publicCid: appData.publicCid ?
              (Array.isArray(appData.publicCid) ?
                new TextDecoder().decode(new Uint8Array(appData.publicCid)) :
                appData.publicCid) : '',
            deposit: appData.deposit || '0',
            epayGateway: decodeEpayField(appData.epayGateway),
            epayPort: appData.epayPort || 0,
            epayPid: decodeEpayField(appData.epayPid),
            epayKey: decodeEpayField(appData.epayKey),
            tronAddress: decodeEpayField(appData.tronAddress)
          })
        }
      }
      
      // 按溢价升序排序
      makers.sort((a, b) => a.sellPremiumBps - b.sellPremiumBps)
      
      setMarketMakers(makers)
    } catch (e: any) {
      setError(e?.message || '加载做市商列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMarketMakers()
  }, [loadMarketMakers])

  return {
    marketMakers,
    loading,
    error,
    reload: loadMarketMakers
  }
}
```

**文件大小**: ~120行

**减少重复**: ~330行（3个文件×110行）

---

### 2. useCurrentMakerInfo Hook

**用途**: 加载当前登录账户的做市商信息

**替代文件**:
- `MarketMakerConfigPage.tsx` (106-229行)
- `MakerBridgeConfigPage.tsx` (79-172行)

**接口设计**:

```typescript
/**
 * 函数级详细中文注释：加载当前账户的做市商信息
 * 
 * @param currentAddress - 当前登录账户地址
 * @returns {Object} 做市商信息和状态
 */
export function useCurrentMakerInfo(currentAddress: string | undefined) {
  return {
    /** 做市商ID */
    mmId: number | null,
    /** 做市商详细信息 */
    makerInfo: MarketMakerInfo | null,
    /** 加载状态 */
    loading: boolean,
    /** 错误信息 */
    error: string,
    /** 重新加载 */
    reload: () => void
  }
}
```

**内部实现**:

```typescript
export function useCurrentMakerInfo(currentAddress: string | undefined) {
  const [mmId, setMmId] = useState<number | null>(null)
  const [makerInfo, setMakerInfo] = useState<MarketMakerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadCurrentMaker = useCallback(async () => {
    if (!currentAddress) {
      setError('未找到当前登录账户')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const api = await getApi()
      
      const entries = await (api.query as any).marketMaker.activeMarketMakers.entries()
      
      let foundMmId: number | null = null
      let foundApp: any = null
      
      for (const [key, value] of entries) {
        const id = key.args[0].toNumber()
        const app = value.toJSON() as any
        
        if (app.owner && app.owner.toLowerCase() === currentAddress.toLowerCase() && app.status === 'Active') {
          foundMmId = id
          foundApp = app
          break
        }
      }
      
      if (!foundMmId) {
        throw new Error('您还不是活跃做市商')
      }
      
      setMmId(foundMmId)
      setMakerInfo({
        mmId: foundMmId,
        owner: foundApp.owner || '',
        status: foundApp.status || '',
        epayGateway: decodeEpayField(foundApp.epayGateway),
        epayPort: foundApp.epayPort || 0,
        epayPid: decodeEpayField(foundApp.epayPid),
        epayKey: decodeEpayField(foundApp.epayKey),
        firstPurchasePool: foundApp.firstPurchasePool || '0',
        firstPurchaseUsed: foundApp.firstPurchaseUsed || '0',
        firstPurchaseFrozen: foundApp.firstPurchaseFrozen || '0',
        usersServed: foundApp.usersServed || 0
      })
    } catch (e: any) {
      setError(e?.message || '加载做市商信息失败')
    } finally {
      setLoading(false)
    }
  }, [currentAddress])

  useEffect(() => {
    loadCurrentMaker()
  }, [loadCurrentMaker])

  return {
    mmId,
    makerInfo,
    loading,
    error,
    reload: loadCurrentMaker
  }
}
```

**文件大小**: ~110行

**减少重复**: ~240行（2个文件×120行）

---

### 3. usePriceCalculation Hook

**用途**: 价格计算和偏离检查

**替代文件**:
- `CreateOrderPage.tsx` (116-137, 354-374行)
- `BridgeTransactionForm.tsx` 部分逻辑
- `CreateOTCOrderModal.tsx` 部分逻辑

**接口设计**:

```typescript
/**
 * 函数级详细中文注释：价格计算和偏离检查
 * 
 * @returns {Object} 价格数据和计算函数
 */
export function usePriceCalculation() {
  return {
    /** 基准价格（USDT，精度10^6） */
    basePrice: number,
    /** 加载状态 */
    loadingPrice: boolean,
    /** 计算价格偏离 */
    calculateDeviation: (sellPremiumBps: number) => PriceDeviationResult
  }
}
```

**内部实现**:

```typescript
export function usePriceCalculation() {
  const [basePrice, setBasePrice] = useState(0)
  const [loadingPrice, setLoadingPrice] = useState(true)

  useEffect(() => {
    const loadBasePrice = async () => {
      try {
        const api = await getApi()
        const price = await (api.query as any).pricing?.memoMarketPriceWeighted?.()
        if (price) {
          setBasePrice(Number(price.toString()))
        }
      } catch (e) {
        console.error('加载基准价格失败:', e)
      } finally {
        setLoadingPrice(false)
      }
    }
    
    loadBasePrice()
    const interval = setInterval(loadBasePrice, 30000)
    return () => clearInterval(interval)
  }, [])

  const calculateDeviation = useCallback((sellPremiumBps: number): PriceDeviationResult => {
    if (basePrice === 0) {
      return { finalPrice: 0, deviationPercent: 0, isWarning: false, isError: false }
    }
    
    const finalPrice = Math.floor(basePrice * (10000 + sellPremiumBps) / 10000)
    const deviationPercent = Math.abs((finalPrice - basePrice) / basePrice * 100)
    
    return {
      finalPrice,
      deviationPercent,
      isWarning: deviationPercent > 15 && deviationPercent <= 20,
      isError: deviationPercent > 20
    }
  }, [basePrice])

  return {
    basePrice,
    loadingPrice,
    calculateDeviation
  }
}
```

**文件大小**: ~70行

**减少重复**: ~170行（4个文件平均）

---

### 4. useOrderQuery Hook

**用途**: 订单查询和轮询

**替代文件**:
- `CreateOrderPage.tsx` (320-347行)
- `MyOrdersCard.tsx` 订单查询逻辑
- `SellerReleasePage.tsx` 订单查询逻辑

**接口设计**:

```typescript
/**
 * 函数级详细中文注释：订单查询和状态轮询
 * 
 * @param options - 查询选项
 * @returns {Object} 订单数据和状态
 */
export function useOrderQuery(options: {
  orderId?: string
  takerAddress?: string
  makerAddress?: string
  autoPolling?: boolean
}) {
  return {
    /** 订单列表或单个订单 */
    orders: Order[] | Order | null,
    /** 订单状态 */
    status: string,
    /** 加载状态 */
    loading: boolean,
    /** 错误信息 */
    error: string,
    /** 重新查询 */
    reload: () => void
  }
}
```

**内部实现**:

```typescript
export function useOrderQuery(options: {
  orderId?: string
  takerAddress?: string
  makerAddress?: string
  autoPolling?: boolean
}) {
  const [orders, setOrders] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const queryOrders = useCallback(async () => {
    try {
      setLoading(true)
      const api = await getApi()
      
      const entries = await (api.query as any).otcOrder.orders.entries()
      
      let results: any[] = []
      
      for (const [_, orderOpt] of entries) {
        if (!orderOpt.isSome) continue
        
        const order = orderOpt.unwrap()
        const orderData = order.toJSON() as any
        
        // 根据过滤条件筛选
        if (options.takerAddress && orderData.taker !== options.takerAddress) continue
        if (options.makerAddress && orderData.maker !== options.makerAddress) continue
        if (options.orderId && !orderData.id.toString().includes(options.orderId)) continue
        
        results.push(orderData)
      }
      
      if (options.orderId && results.length === 1) {
        setOrders(results[0])
        setStatus(results[0].state?.toString() || '')
      } else {
        setOrders(results)
      }
    } catch (e: any) {
      setError(e?.message || '查询订单失败')
    } finally {
      setLoading(false)
    }
  }, [options])

  useEffect(() => {
    queryOrders()
    
    if (options.autoPolling) {
      const interval = setInterval(queryOrders, 5000)
      return () => clearInterval(interval)
    }
  }, [queryOrders, options.autoPolling])

  return {
    orders,
    status,
    loading,
    error,
    reload: queryOrders
  }
}
```

**文件大小**: ~100行

**减少重复**: ~200行（3个文件平均）

---

## 📊 预期收益总结

### Phase 2 执行后

| Hook | 文件大小 | 替代文件数 | 减少行数 | 净增/减 |
|------|---------|-----------|---------|---------|
| useMarketMakers | ~120行 | 3个 | -330行 | **-210行** |
| useCurrentMakerInfo | ~110行 | 2个 | -240行 | **-130行** |
| usePriceCalculation | ~70行 | 4个 | -170行 | **-100行** |
| useOrderQuery | ~100行 | 3个 | -200行 | **-100行** |

**总计**: 
- 新增代码: ~400行
- 减少重复: ~940行
- **净减少**: ~540行 ✅

### 可维护性收益

- ✅ 逻辑复用：一次编写，多处使用
- ✅ 便于测试：Hooks可单独测试
- ✅ 便于升级：修改一处，全局生效
- ✅ 代码清晰：职责分离

---

## 🎯 Phase 1 vs Phase 2 对比

### Phase 1: 简化版分析 ✅ (今天执行)

**时间**: 2小时  
**风险**: ✅ 极低

**成果**:
- ✅ 识别4种重复模式
- ✅ 设计4个Hook接口
- ✅ 完整的Phase 2规划文档
- ✅ 工具函数统一建议

**特点**:
- 仅分析，不修改代码
- 零风险执行
- 为Phase 2打基础

---

### Phase 2: 完整版提取 ⏳ (未来执行)

**时间**: 6-8小时（建议分2-3天执行）  
**风险**: ⚠️ 中等

**执行步骤**:

#### 步骤1: 统一工具函数（1小时）

1. 修改 `MarketMakerConfigPage.tsx`，删除 `bytesToString`
2. 导入 `decodeEpayField` from `paymentUtils.ts`
3. 修改 `MakerBridgeConfigPage.tsx`，同样替换
4. 测试验证

#### 步骤2: 创建Hooks目录结构（0.5小时）

```bash
mkdir -p stardust-dapp/src/hooks/market-maker
mkdir -p stardust-dapp/src/hooks/trading
mkdir -p stardust-dapp/src/hooks/chain
```

#### 步骤3: 提取useMarketMakers（2小时）

1. 创建 `hooks/market-maker/useMarketMakers.ts`
2. 提取通用逻辑
3. 在 `CreateOrderPage.tsx` 中使用
4. 测试验证
5. 如果成功，继续在其他文件中使用

#### 步骤4: 提取useCurrentMakerInfo（2小时）

1. 创建 `hooks/market-maker/useCurrentMakerInfo.ts`
2. 提取通用逻辑
3. 在 `MarketMakerConfigPage.tsx` 中使用
4. 在 `MakerBridgeConfigPage.tsx` 中使用
5. 测试验证

#### 步骤5: 提取usePriceCalculation（1.5小时）

1. 创建 `hooks/trading/usePriceCalculation.ts`
2. 提取通用逻辑
3. 在各文件中使用
4. 测试验证

#### 步骤6: 提取useOrderQuery（2小时）

1. 创建 `hooks/trading/useOrderQuery.ts`
2. 提取通用逻辑
3. 在各文件中使用
4. 测试验证

---

## 🔙 回滚方案

### Phase 1 回滚

Phase 1仅创建文档，无需回滚。

### Phase 2 回滚

Phase 2会修改多个文件，需要Git备份：

```bash
# 每个步骤执行前创建备份
git checkout -b backup-before-hooks-step1
git checkout -b backup-before-hooks-step2
# ...

# 如果出问题，回滚到备份
git checkout backup-before-hooks-step1
```

**建议**: 每完成一个Hook就提交一次Git，便于细粒度回滚。

---

## 🎯 成功标准

### Phase 1 验收标准

- [x] 识别重复代码模式
- [x] 设计Hook接口
- [x] 创建详细设计文档
- [x] 估算收益
- [x] Git提交

### Phase 2 验收标准

- [ ] 创建4个Hooks文件
- [ ] 修改7+个使用方文件
- [ ] 所有Hooks功能正常
- [ ] 无功能退化
- [ ] 无新增TypeScript错误
- [ ] 通过完整功能测试
- [ ] 代码审查通过
- [ ] 净减少~540行代码

---

## 💡 最佳实践

### Hook设计原则

1. **单一职责** - 每个Hook只做一件事
2. **可配置** - 通过参数控制行为
3. **返回一致** - 统一的返回值结构
4. **错误处理** - 统一的错误处理逻辑
5. **依赖明确** - useEffect依赖清晰

### 渐进式重构

1. **一次一个** - 每次只提取一个Hook
2. **充分测试** - 每个Hook提取后立即测试
3. **小步提交** - 每个成功步骤都Git提交
4. **可回滚** - 任何时候都可以安全回滚

---

## 📚 相关资源

### 参考文档

- `CreateOrderPage-拆分设计.md` - Day 3拆分设计
- `CreateMarketMakerPage-拆分设计.md` - Day 2拆分设计
- `前端优化-快速行动指南.md` - 5天计划

### 相关文件

- `stardust-dapp/src/utils/paymentUtils.ts` - 支付工具函数
- `stardust-dapp/src/features/otc/types/order.types.ts` - 订单类型定义
- `stardust-dapp/src/features/otc/types/marketMaker.types.ts` - 做市商类型定义

---

## 🎊 总结

### Phase 1 (今天执行)

- ⏱️ **时间**: 2小时
- 🎯 **目标**: 低风险分析
- ✅ **策略**: 仅设计，不修改
- 📦 **成果**: 详细设计文档

### Phase 2 (未来执行)

- ⏱️ **时间**: 6-8小时
- 🎯 **目标**: 完整提取
- ⚠️ **风险**: 中等
- 📦 **成果**: 4个Hooks，净减少~540行

---

**📅 文档创建时间**: 2025-10-29  
**✍️ 作者**: AI Assistant  
**📊 版本**: v1.0  
**🎯 状态**: Phase 1 Complete, Phase 2 Ready

**🚀 Phase 1分析完成，为Phase 2做好充分准备！**

