# Phase 2 Trading 整合 - 前端适配指南

**文档版本**: 1.0  
**创建时间**: 2025-10-28  
**前端项目**: stardust-dapp

---

## 📦 概述

本文档描述如何将前端从旧的三个 Pallet API 迁移到新的统一 Trading Pallet API。

### API 变化总览

| 旧 API | 新 API | 变化 |
|--------|--------|------|
| `api.tx.marketMaker.*` | `api.tx.trading.*` | 统一命名空间 |
| `api.tx.otcOrder.*` | `api.tx.trading.*` | 统一命名空间 |
| `api.tx.simpleBridge.*` | `api.tx.trading.*` | 统一命名空间 |
| `api.query.marketMaker.*` | `api.query.trading.*` | 统一命名空间 |
| `api.query.otcOrder.*` | `api.query.trading.*` | 统一命名空间 |
| `api.query.simpleBridge.*` | `api.query.trading.*` | 统一命名空间 |

---

## 🔄 API 映射

### 1. Maker 模块 API

#### 1.1 可调用函数 (Extrinsics)

| 旧 API | 新 API | 参数变化 |
|--------|--------|----------|
| `api.tx.marketMaker.lockDeposit()` | `api.tx.trading.lockDeposit()` | 无变化 |
| `api.tx.marketMaker.submitInfo(...)` | `api.tx.trading.submitInfo(...)` | 无变化 |
| `api.tx.marketMaker.updateInfo(...)` | `api.tx.trading.updateInfo(...)` | 无变化 |
| `api.tx.marketMaker.cancel()` | `api.tx.trading.cancelMaker()` | ⚠️ 函数名变化 |
| `api.tx.marketMaker.requestWithdrawal(amount)` | `api.tx.trading.requestWithdrawal(amount)` | 无变化 |
| `api.tx.marketMaker.executeWithdrawal()` | `api.tx.trading.executeWithdrawal()` | 无变化 |
| `api.tx.marketMaker.cancelWithdrawal()` | `api.tx.trading.cancelWithdrawal()` | 无变化 |

**治理函数** (需要 Root 权限):

| 旧 API | 新 API |
|--------|--------|
| `api.tx.marketMaker.approve(makerId)` | `api.tx.trading.approveMaker(makerId)` |
| `api.tx.marketMaker.reject(makerId)` | `api.tx.trading.rejectMaker(makerId)` |
| `api.tx.marketMaker.emergencyWithdrawal(makerId, to)` | `api.tx.trading.emergencyWithdrawal(makerId, to)` |

#### 1.2 查询函数 (Queries)

| 旧 API | 新 API | 返回类型变化 |
|--------|--------|--------------|
| `api.query.marketMaker.applications(makerId)` | `api.query.trading.makerApplications(makerId)` | 无变化 |
| `api.query.marketMaker.ownerIndex(account)` | `api.query.trading.accountToMaker(account)` | ⚠️ 存储名变化 |
| `api.query.marketMaker.nextId()` | `api.query.trading.nextMakerId()` | 无变化 |
| `api.query.marketMaker.withdrawalRequests(makerId)` | `api.query.trading.withdrawalRequests(makerId)` | 无变化 |

#### 1.3 事件 (Events)

| 旧事件 | 新事件 | 数据变化 |
|--------|--------|----------|
| `MarketMaker.DepositLocked` | `Trading.MakerDepositLocked` | 无变化 |
| `MarketMaker.InfoSubmitted` | `Trading.MakerInfoSubmitted` | 无变化 |
| `MarketMaker.Approved` | `Trading.MakerApproved` | 无变化 |
| `MarketMaker.Rejected` | `Trading.MakerRejected` | 无变化 |
| `MarketMaker.Cancelled` | `Trading.MakerCancelled` | 无变化 |
| `MarketMaker.WithdrawalRequested` | `Trading.WithdrawalRequested` | 无变化 |
| `MarketMaker.WithdrawalExecuted` | `Trading.WithdrawalExecuted` | 无变化 |

### 2. OTC 模块 API

#### 2.1 可调用函数

| 旧 API | 新 API | 参数变化 |
|--------|--------|----------|
| `api.tx.otcOrder.createOrder(makerId, memoAmount, paymentCommit, contactCommit)` | `api.tx.trading.createOrder(makerId, memoAmount, paymentCommit, contactCommit)` | 无变化 |
| `api.tx.otcOrder.markPaid(orderId, tronTxHash)` | `api.tx.trading.markPaid(orderId, tronTxHash)` | 无变化 |
| `api.tx.otcOrder.releaseMemo(orderId)` | `api.tx.trading.releaseMemo(orderId)` | 无变化 |
| `api.tx.otcOrder.cancelOrder(orderId)` | `api.tx.trading.cancelOrder(orderId)` | 无变化 |
| `api.tx.otcOrder.disputeOrder(orderId)` | `api.tx.trading.disputeOrder(orderId)` | 无变化 |

#### 2.2 查询函数

| 旧 API | 新 API |
|--------|--------|
| `api.query.otcOrder.orders(orderId)` | `api.query.trading.orders(orderId)` |
| `api.query.otcOrder.buyerOrders(account)` | `api.query.trading.buyerOrders(account)` |
| `api.query.otcOrder.makerOrders(makerId)` | `api.query.trading.makerOrders(makerId)` |
| `api.query.otcOrder.nextOrderId()` | `api.query.trading.nextOrderId()` |
| `api.query.otcOrder.firstPurchasePool()` | `api.query.trading.firstPurchasePool()` |

#### 2.3 事件

| 旧事件 | 新事件 |
|--------|--------|
| `OtcOrder.OrderCreated` | `Trading.OrderCreated` |
| `OtcOrder.OrderMarkedPaid` | `Trading.OrderMarkedPaid` |
| `OtcOrder.MemoReleased` | `Trading.MemoReleased` |
| `OtcOrder.OrderCancelled` | `Trading.OrderCancelled` |
| `OtcOrder.OrderDisputed` | `Trading.OrderDisputed` |

### 3. Bridge 模块 API

#### 3.1 可调用函数

| 旧 API | 新 API | 参数变化 |
|--------|--------|----------|
| `api.tx.simpleBridge.swap(memoAmount, tronAddress)` | `api.tx.trading.swap(memoAmount, tronAddress)` | 无变化 |
| `api.tx.simpleBridge.makerSwap(makerId, memoAmount, usdtAddress)` | `api.tx.trading.makerSwap(makerId, memoAmount, usdtAddress)` | 无变化 |
| `api.tx.simpleBridge.markSwapComplete(swapId, trc20TxHash)` | `api.tx.trading.markSwapComplete(swapId, trc20TxHash)` | 无变化 |
| `api.tx.simpleBridge.reportSwap(swapId)` | `api.tx.trading.reportSwap(swapId)` | 无变化 |

**治理函数**:

| 旧 API | 新 API |
|--------|--------|
| `api.tx.simpleBridge.completeSwap(swapId)` | `api.tx.trading.completeSwap(swapId)` |
| `api.tx.simpleBridge.setBridgeAccount(account)` | `api.tx.trading.setBridgeAccount(account)` |
| `api.tx.simpleBridge.setMinSwapAmount(amount)` | `api.tx.trading.setMinSwapAmount(amount)` |

#### 3.2 查询函数

| 旧 API | 新 API |
|--------|--------|
| `api.query.simpleBridge.swapRequests(swapId)` | `api.query.trading.swapRequests(swapId)` |
| `api.query.simpleBridge.makerSwaps(swapId)` | `api.query.trading.makerSwaps(swapId)` |
| `api.query.simpleBridge.nextSwapId()` | `api.query.trading.nextSwapId()` |
| `api.query.simpleBridge.bridgeAccount()` | `api.query.trading.bridgeAccount()` |
| `api.query.simpleBridge.minSwapAmount()` | `api.query.trading.minSwapAmount()` |

#### 3.3 事件

| 旧事件 | 新事件 |
|--------|--------|
| `SimpleBridge.SwapCreated` | `Trading.SwapCreated` |
| `SimpleBridge.SwapCompleted` | `Trading.SwapCompleted` |
| `SimpleBridge.MakerSwapCreated` | `Trading.MakerSwapCreated` |
| `SimpleBridge.MakerSwapMarkedComplete` | `Trading.MakerSwapMarkedComplete` |
| `SimpleBridge.MakerSwapReported` | `Trading.MakerSwapReported` |

---

## 🔧 代码迁移示例

### 示例 1: 做市商申请流程

#### 旧代码

```typescript
// components/MakerApplication.tsx

import { useApi } from '@/hooks/useApi';

const MakerApplication = () => {
  const { api } = useApi();
  
  const lockDeposit = async () => {
    const tx = api.tx.marketMaker.lockDeposit();
    await tx.signAndSend(account);
  };
  
  const submitInfo = async (data: MakerInfo) => {
    const tx = api.tx.marketMaker.submitInfo(
      data.realName,
      data.idCard,
      data.birthday,
      data.tronAddress,
      data.wechatId,
      data.epayNo,
      data.epayKey
    );
    await tx.signAndSend(account);
  };
  
  // 查询做市商信息
  const fetchMakerInfo = async (makerId: number) => {
    const info = await api.query.marketMaker.applications(makerId);
    return info.toJSON();
  };
  
  // 监听事件
  useEffect(() => {
    const unsub = api.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record;
        if (event.section === 'marketMaker' && event.method === 'DepositLocked') {
          console.log('押金已锁定:', event.data);
        }
      });
    });
    return () => unsub.then(u => u());
  }, []);
};
```

#### 新代码

```typescript
// components/MakerApplication.tsx

import { useApi } from '@/hooks/useApi';

const MakerApplication = () => {
  const { api } = useApi();
  
  const lockDeposit = async () => {
    // ✅ 更改命名空间
    const tx = api.tx.trading.lockDeposit();
    await tx.signAndSend(account);
  };
  
  const submitInfo = async (data: MakerInfo) => {
    // ✅ 更改命名空间
    const tx = api.tx.trading.submitInfo(
      data.realName,
      data.idCard,
      data.birthday,
      data.tronAddress,
      data.wechatId,
      data.epayNo,
      data.epayKey
    );
    await tx.signAndSend(account);
  };
  
  // 查询做市商信息
  const fetchMakerInfo = async (makerId: number) => {
    // ✅ 更改命名空间
    const info = await api.query.trading.makerApplications(makerId);
    return info.toJSON();
  };
  
  // 监听事件
  useEffect(() => {
    const unsub = api.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record;
        // ✅ 更改 section 和事件名
        if (event.section === 'trading' && event.method === 'MakerDepositLocked') {
          console.log('押金已锁定:', event.data);
        }
      });
    });
    return () => unsub.then(u => u());
  }, []);
};
```

### 示例 2: OTC 订单创建

#### 旧代码

```typescript
// components/OtcOrder.tsx

const createOrder = async (makerId: number, memoAmount: string) => {
  const tx = api.tx.otcOrder.createOrder(
    makerId,
    memoAmount,
    paymentCommit,
    contactCommit
  );
  await tx.signAndSend(account);
};

// 查询订单
const fetchOrder = async (orderId: number) => {
  const order = await api.query.otcOrder.orders(orderId);
  return order.toJSON();
};

// 查询买家订单列表
const fetchBuyerOrders = async (buyer: string) => {
  const orders = await api.query.otcOrder.buyerOrders(buyer);
  return orders.toJSON();
};
```

#### 新代码

```typescript
// components/OtcOrder.tsx

const createOrder = async (makerId: number, memoAmount: string) => {
  // ✅ 更改命名空间
  const tx = api.tx.trading.createOrder(
    makerId,
    memoAmount,
    paymentCommit,
    contactCommit
  );
  await tx.signAndSend(account);
};

// 查询订单
const fetchOrder = async (orderId: number) => {
  // ✅ 更改命名空间
  const order = await api.query.trading.orders(orderId);
  return order.toJSON();
};

// 查询买家订单列表
const fetchBuyerOrders = async (buyer: string) => {
  // ✅ 更改命名空间
  const orders = await api.query.trading.buyerOrders(buyer);
  return orders.toJSON();
};
```

### 示例 3: Bridge 兑换

#### 旧代码

```typescript
// components/Bridge.tsx

const createSwap = async (memoAmount: string, tronAddress: string) => {
  const tx = api.tx.simpleBridge.swap(memoAmount, tronAddress);
  await tx.signAndSend(account);
};

// 做市商兑换
const createMakerSwap = async (makerId: number, memoAmount: string, usdtAddress: string) => {
  const tx = api.tx.simpleBridge.makerSwap(makerId, memoAmount, usdtAddress);
  await tx.signAndSend(account);
};

// 查询兑换请求
const fetchSwap = async (swapId: number) => {
  const swap = await api.query.simpleBridge.swapRequests(swapId);
  return swap.toJSON();
};
```

#### 新代码

```typescript
// components/Bridge.tsx

const createSwap = async (memoAmount: string, tronAddress: string) => {
  // ✅ 更改命名空间
  const tx = api.tx.trading.swap(memoAmount, tronAddress);
  await tx.signAndSend(account);
};

// 做市商兑换
const createMakerSwap = async (makerId: number, memoAmount: string, usdtAddress: string) => {
  // ✅ 更改命名空间
  const tx = api.tx.trading.makerSwap(makerId, memoAmount, usdtAddress);
  await tx.signAndSend(account);
};

// 查询兑换请求
const fetchSwap = async (swapId: number) => {
  // ✅ 更改命名空间
  const swap = await api.query.trading.swapRequests(swapId);
  return swap.toJSON();
};
```

---

## 🔍 类型定义更新

### 1. 创建类型定义文件

创建 `src/types/trading.ts`:

```typescript
// src/types/trading.ts

export interface MakerApplication {
  owner: string;
  deposit: string;
  status: 'DepositLocked' | 'PendingReview' | 'Active' | 'Rejected' | 'Cancelled' | 'Expired';
  direction: 'Buy' | 'Sell' | 'BuyAndSell';
  tronAddress: string;
  buyPremiumBps: number;
  sellPremiumBps: number;
  maskedFullName: string;
  maskedIdCard: string;
  maskedBirthday: string;
  wechatId: string;
  // ... 其他字段
}

export interface Order {
  makerId: number;
  maker: string;
  taker: string;
  price: string;
  qty: string;
  amount: string;
  createdAt: number;
  expireAt: number;
  evidenceUntil: number;
  makerTronAddress: string;
  paymentCommit: string;
  contactCommit: string;
  state: 'Created' | 'PaidOrCommitted' | 'Released' | 'Refunded' | 'Canceled' | 'Disputed' | 'Closed';
  epayTradeNo: string | null;
  completedAt: number | null;
}

export interface SwapRequest {
  id: number;
  user: string;
  memoAmount: string;
  tronAddress: string;
  completed: boolean;
  priceUsdt: number;
  createdAt: number;
  expireAt: number;
}

export interface MakerSwapRecord {
  swapId: number;
  makerId: number;
  maker: string;
  user: string;
  memoAmount: string;
  usdtAmount: number;
  usdtAddress: string;
  createdAt: number;
  timeoutAt: number;
  trc20TxHash: string | null;
  completedAt: number | null;
  evidenceCid: string | null;
  status: 'Pending' | 'Completed' | 'UserReported' | 'Arbitrating' | 'ArbitrationApproved' | 'ArbitrationRejected' | 'Refunded';
  priceUsdt: number;
}
```

### 2. 更新 Hooks

创建统一的 Trading hooks:

```typescript
// src/hooks/useTrading.ts

import { useApi } from './useApi';
import { MakerApplication, Order, SwapRequest } from '@/types/trading';

export const useTrading = () => {
  const { api } = useApi();
  
  // Maker 相关
  const lockDeposit = async () => {
    return api.tx.trading.lockDeposit();
  };
  
  const submitInfo = async (data: any) => {
    return api.tx.trading.submitInfo(
      data.realName,
      data.idCard,
      data.birthday,
      data.tronAddress,
      data.wechatId,
      data.epayNo,
      data.epayKey
    );
  };
  
  const getMakerInfo = async (makerId: number): Promise<MakerApplication | null> => {
    const result = await api.query.trading.makerApplications(makerId);
    return result.isEmpty ? null : result.toJSON();
  };
  
  // OTC 相关
  const createOrder = async (makerId: number, memoAmount: string, paymentCommit: string, contactCommit: string) => {
    return api.tx.trading.createOrder(makerId, memoAmount, paymentCommit, contactCommit);
  };
  
  const getOrder = async (orderId: number): Promise<Order | null> => {
    const result = await api.query.trading.orders(orderId);
    return result.isEmpty ? null : result.toJSON();
  };
  
  const getBuyerOrders = async (buyer: string): Promise<number[]> => {
    const result = await api.query.trading.buyerOrders(buyer);
    return result.toJSON();
  };
  
  // Bridge 相关
  const swap = async (memoAmount: string, tronAddress: string) => {
    return api.tx.trading.swap(memoAmount, tronAddress);
  };
  
  const makerSwap = async (makerId: number, memoAmount: string, usdtAddress: string) => {
    return api.tx.trading.makerSwap(makerId, memoAmount, usdtAddress);
  };
  
  const getSwap = async (swapId: number): Promise<SwapRequest | null> => {
    const result = await api.query.trading.swapRequests(swapId);
    return result.isEmpty ? null : result.toJSON();
  };
  
  return {
    // Maker
    lockDeposit,
    submitInfo,
    getMakerInfo,
    // OTC
    createOrder,
    getOrder,
    getBuyerOrders,
    // Bridge
    swap,
    makerSwap,
    getSwap,
  };
};
```

---

## 📝 迁移检查清单

### 代码搜索与替换

使用以下命令批量查找需要修改的地方：

```bash
cd /home/xiaodong/文档/stardust/stardust-dapp

# 查找所有 marketMaker 引用
grep -r "marketMaker" src/

# 查找所有 otcOrder 引用
grep -r "otcOrder" src/

# 查找所有 simpleBridge 引用
grep -r "simpleBridge" src/
```

### 文件级检查

- [ ] `src/hooks/useApi.ts` - API 初始化
- [ ] `src/hooks/useTrading.ts` - 新增统一 Hook
- [ ] `src/types/trading.ts` - 新增类型定义
- [ ] `src/components/Maker/*.tsx` - 做市商相关组件
- [ ] `src/components/OTC/*.tsx` - OTC订单相关组件
- [ ] `src/components/Bridge/*.tsx` - 桥接相关组件
- [ ] `src/pages/maker/*.tsx` - 做市商页面
- [ ] `src/pages/otc/*.tsx` - OTC订单页面
- [ ] `src/pages/bridge/*.tsx` - 桥接页面
- [ ] `src/utils/api.ts` - API工具函数

### 功能级检查

- [ ] 做市商申请流程
- [ ] 做市商审批流程
- [ ] 做市商提现流程
- [ ] OTC订单创建
- [ ] OTC订单标记付款
- [ ] OTC订单释放MEMO
- [ ] OTC订单取消/争议
- [ ] 官方桥接兑换
- [ ] 做市商兑换
- [ ] 事件监听和通知

---

## 🧪 测试建议

### 单元测试

```typescript
// __tests__/trading.test.ts

import { renderHook } from '@testing-library/react';
import { useTrading } from '@/hooks/useTrading';

describe('useTrading', () => {
  it('should lock deposit', async () => {
    const { result } = renderHook(() => useTrading());
    const tx = await result.current.lockDeposit();
    expect(tx).toBeDefined();
  });
  
  it('should create order', async () => {
    const { result } = renderHook(() => useTrading());
    const tx = await result.current.createOrder(1, '1000000000000000', '0x...', '0x...');
    expect(tx).toBeDefined();
  });
  
  it('should create swap', async () => {
    const { result } = renderHook(() => useTrading());
    const tx = await result.current.swap('1000000000000000', 'TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS');
    expect(tx).toBeDefined();
  });
});
```

### 集成测试

1. **做市商申请流程**: 锁定押金 → 提交资料 → 等待审批 → 通过
2. **OTC订单流程**: 创建订单 → 标记付款 → 释放MEMO → 完成
3. **桥接兑换流程**: 创建兑换 → 做市商转账 → 标记完成

---

## 📚 相关文档

- [Phase 2 Trading整合 - 初步完成报告](./Phase2-Trading整合-初步完成报告.md)
- [Trading Pallet README](../pallets/trading/README.md)
- [Runtime 迁移指南](./Phase2-Trading整合-Runtime迁移指南.md)

---

**文档维护者**: Cursor AI  
**最后更新**: 2025-10-28  
**版本**: 1.0

