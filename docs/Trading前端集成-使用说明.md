# Trading前端集成 - 使用说明

**生成时间**: 2025-10-29  
**服务版本**: v1.0.0  
**状态**: ✅ 服务层完成，部分组件待更新

---

## 📦 概述

`tradingService.ts` 提供了完整的Trading功能接口，整合了：
- **OTC订单** (原 `pallet-otc-order`)
- **做市商管理** (原 `pallet-market-maker`)
- **跨链桥接** (原 `pallet-simple-bridge`)

---

## 🚀 快速开始

### 1. 创建服务实例

```typescript
import { createTradingService } from '@/services/tradingService';
import { ApiPromise } from '@polkadot/api';

// 在你的组件或页面中
const api: ApiPromise = ...; // 从ApiContext获取
const tradingService = createTradingService(api);
```

### 2. 查询示例

#### 2.1 查询做市商信息

```typescript
// 查询单个做市商
const maker = await tradingService.getMaker(1);
if (maker) {
  console.log('做市商ID:', maker.id);
  console.log('所有者:', maker.owner);
  console.log('状态:', maker.status);
  console.log('TRON地址:', maker.tronAddress);
}

// 查询账户的做市商ID
const makerId = await tradingService.getMakerIdByAccount(accountAddress);

// 批量查询活跃做市商
const activeMakers = await tradingService.listMakers({
  status: ApplicationStatus.Active,
  limit: 10
});
```

#### 2.2 查询OTC订单

```typescript
// 查询单个订单
const order = await tradingService.getOrder(123);
if (order) {
  console.log('订单ID:', order.id);
  console.log('状态:', order.state);
  console.log('数量:', order.qty);
  console.log('价格:', order.price, 'USDT');
}

// 查询用户的订单
const myOrders = await tradingService.listOrders({
  taker: currentAccount,
  limit: 20
});

// 查询做市商的订单
const makerOrders = await tradingService.listOrders({
  maker: makerAccount,
  state: OrderState.PaidOrCommitted,
  limit: 50
});
```

#### 2.3 查询桥接记录

```typescript
// 查询官方桥接请求
const swapRequest = await tradingService.getSwapRequest(1);

// 查询做市商桥接记录
const makerSwap = await tradingService.getMakerSwapRecord(1);
```

### 3. 交易构建示例

#### 3.1 做市商申请流程

```typescript
// 步骤1: 锁定押金
const lockTx = tradingService.buildLockDepositTx('1000000000000000000000'); // 1000 DUST
await lockTx.signAndSend(signer, callback);

// 步骤2: 提交资料
const submitTx = tradingService.buildSubmitInfoTx({
  direction: Direction.BuyAndSell,
  tronAddress: 'TXxx...',
  buyPremiumBps: 50,  // +0.5%
  sellPremiumBps: -30, // -0.3%
  fullName: '张三',
  idCard: '110101199001011234',
  birthday: '1990-01-01',
  epayAddress: 'https://epay.example.com',
  epayMerchantId: 'M12345',
  epayApiKey: 'key_xxx'
});
await submitTx.signAndSend(signer, callback);

// 步骤3: 等待管理员审批...
// 管理员调用: api.tx.trading.approveMaker(makerId)
```

#### 3.2 OTC订单流程

```typescript
// 买家：创建订单
const createTx = tradingService.buildCreateOrderTx({
  makerId: 1,
  qty: '100000000000000000000', // 100 DUST
  contactCommit: '0x...' // 联系方式哈希
});
await createTx.signAndSend(buyer, callback);

// 买家：标记已付款
const paidTx = tradingService.buildMarkPaidTx({
  orderId: 123,
  paymentCommit: '0x...' // 付款凭证哈希
});
await paidTx.signAndSend(buyer, callback);

// 卖家：释放MEMO
const releaseTx = tradingService.buildReleaseMemoTx(123);
await releaseTx.signAndSend(seller, callback);

// 买家：取消订单（5分钟内）
const cancelTx = tradingService.buildCancelOrderTx(123);
await cancelTx.signAndSend(buyer, callback);

// 任意方：发起争议
const disputeTx = tradingService.buildDisputeOrderTx(123);
await disputeTx.signAndSend(user, callback);
```

#### 3.3 桥接流程

```typescript
// 用户：官方桥接（DUST → USDT）
const swapTx = tradingService.buildSwapTx({
  memoAmount: '100000000000000000000', // 100 DUST
  tronAddress: 'TXxx...'
});
await swapTx.signAndSend(user, callback);

// 用户：做市商桥接
const makerSwapTx = tradingService.buildMakerSwapTx({
  makerId: 1,
  memoAmount: '100000000000000000000',
  tronAddress: 'TXxx...'
});
await makerSwapTx.signAndSend(user, callback);

// 做市商：标记完成
const completeTx = tradingService.buildMarkSwapCompleteTx({
  recordId: 1,
  trc20TxHash: '0x...'
});
await completeTx.signAndSend(maker, callback);
```

---

## 📋 完整API参考

### Maker（做市商）API

| 方法 | 参数 | 返回值 | 说明 |
|-----|------|--------|------|
| `getMaker` | `makerId: number` | `MakerApplication \| null` | 查询单个做市商 |
| `getNextMakerId` | - | `number` | 获取下一个做市商ID |
| `listMakers` | `options?` | `MakerApplication[]` | 批量查询做市商 |
| `getMakerIdByAccount` | `account: string` | `number \| null` | 查询账户的做市商ID |
| `buildLockDepositTx` | `deposit: string` | `SubmittableExtrinsic` | 构建锁定押金交易 |
| `buildSubmitInfoTx` | `params` | `SubmittableExtrinsic` | 构建提交资料交易 |
| `buildApproveMakerTx` | `makerId: number` | `SubmittableExtrinsic` | 构建审批交易（管理员） |
| `buildRejectMakerTx` | `makerId: number` | `SubmittableExtrinsic` | 构建驳回交易（管理员） |
| `buildRequestWithdrawalTx` | - | `SubmittableExtrinsic` | 构建申请提现交易 |
| `buildExecuteWithdrawalTx` | - | `SubmittableExtrinsic` | 构建执行提现交易 |
| `buildPauseServiceTx` | - | `SubmittableExtrinsic` | 构建暂停服务交易 |
| `buildResumeServiceTx` | - | `SubmittableExtrinsic` | 构建恢复服务交易 |

### OTC订单API

| 方法 | 参数 | 返回值 | 说明 |
|-----|------|--------|------|
| `getOrder` | `orderId: number` | `Order \| null` | 查询单个订单 |
| `getNextOrderId` | - | `number` | 获取下一个订单ID |
| `listOrders` | `options?` | `Order[]` | 批量查询订单 |
| `buildCreateOrderTx` | `params` | `SubmittableExtrinsic` | 构建创建订单交易 |
| `buildMarkPaidTx` | `params` | `SubmittableExtrinsic` | 构建标记已付款交易 |
| `buildReleaseMemoTx` | `orderId: number` | `SubmittableExtrinsic` | 构建释放MEMO交易 |
| `buildCancelOrderTx` | `orderId: number` | `SubmittableExtrinsic` | 构建取消订单交易 |
| `buildDisputeOrderTx` | `orderId: number` | `SubmittableExtrinsic` | 构建发起争议交易 |

### Bridge（桥接）API

| 方法 | 参数 | 返回值 | 说明 |
|-----|------|--------|------|
| `getSwapRequest` | `requestId: number` | `SwapRequest \| null` | 查询官方桥接请求 |
| `getMakerSwapRecord` | `recordId: number` | `MakerSwapRecord \| null` | 查询做市商桥接记录 |
| `buildSwapTx` | `params` | `SubmittableExtrinsic` | 构建官方桥接交易 |
| `buildCompleteSwapTx` | `requestId: number` | `SubmittableExtrinsic` | 构建完成桥接交易（管理员） |
| `buildMakerSwapTx` | `params` | `SubmittableExtrinsic` | 构建做市商桥接交易 |
| `buildMarkSwapCompleteTx` | `params` | `SubmittableExtrinsic` | 构建标记完成交易 |
| `buildReportSwapTx` | `recordId: number` | `SubmittableExtrinsic` | 构建举报交易 |

---

## 🔄 迁移指南

### 旧API → 新API 映射表

#### 做市商相关

| 旧API | 新API | 说明 |
|------|------|------|
| `api.query.marketMaker.activeMarketMakers(id)` | `tradingService.getMaker(id)` | 查询做市商 |
| `api.query.marketMaker.ownerIndex(account)` | `tradingService.getMakerIdByAccount(account)` | 查询账户的ID |
| `api.tx.marketMaker.lockDeposit(amount)` | `tradingService.buildLockDepositTx(amount)` | 锁定押金 |
| `api.tx.marketMaker.submitInfo(...)` | `tradingService.buildSubmitInfoTx({...})` | 提交资料 |
| `api.tx.marketMaker.approveMaker(id)` | `tradingService.buildApproveMakerTx(id)` | 审批做市商 |
| `api.tx.marketMaker.pause()` | `tradingService.buildPauseServiceTx()` | 暂停服务 |
| `api.tx.marketMaker.resume()` | `tradingService.buildResumeServiceTx()` | 恢复服务 |

#### OTC订单相关

| 旧API | 新API | 说明 |
|------|------|------|
| `api.query.otcOrder.orders(id)` | `tradingService.getOrder(id)` | 查询订单 |
| `api.tx.otcOrder.createOrder(...)` | `tradingService.buildCreateOrderTx({...})` | 创建订单 |
| `api.tx.otcOrder.markPaid(...)` | `tradingService.buildMarkPaidTx({...})` | 标记已付款 |
| `api.tx.otcOrder.release(id)` | `tradingService.buildReleaseMemoTx(id)` | 释放MEMO |
| `api.tx.otcOrder.cancelOrder(id)` | `tradingService.buildCancelOrderTx(id)` | 取消订单 |
| `api.tx.otcOrder.disputeOrder(id)` | `tradingService.buildDisputeOrderTx(id)` | 发起争议 |

#### Bridge相关

| 旧API | 新API | 说明 |
|------|------|------|
| `api.query.simpleBridge.swapRequests(id)` | `tradingService.getSwapRequest(id)` | 查询桥接请求 |
| `api.tx.simpleBridge.swap(...)` | `tradingService.buildSwapTx({...})` | 官方桥接 |
| `api.tx.simpleBridge.swapWithMaker(...)` | `tradingService.buildMakerSwapTx({...})` | 做市商桥接 |
| `api.tx.simpleBridge.markComplete(...)` | `tradingService.buildMarkSwapCompleteTx({...})` | 标记完成 |

---

## ⚠️ 需要更新的文件清单

### 高优先级（核心功能）

1. **src/features/otc/SellerReleasePage.tsx**
   - 替换: `api.query.otcOrder.orders` → `tradingService.getOrder`
   - 替换: `api.tx.otcOrder.release` → `tradingService.buildReleaseMemoTx`
   
2. **src/features/bridge/MakerBridgeSwapPage.tsx**
   - 替换: `api.query.marketMaker.activeMarketMakers` → `tradingService.getMaker`
   - 替换: `api.tx.simpleBridge.swapWithMaker` → `tradingService.buildMakerSwapTx`

### 中优先级（管理功能）

3. **src/features/otc/CreateMarketMakerPage.tsx**
   - 替换: `api.query.marketMaker.ownerIndex` → `tradingService.getMakerIdByAccount`

4. **src/features/first-purchase/MarketMakerPoolPage.tsx**
   - 替换: `api.query.marketMaker.activeMarketMakers.entries()` → `tradingService.listMakers()`
   - 替换: `api.query.marketMaker.withdrawalRequests` → 需要添加新方法

5. **src/features/bridge/MakerBridgeListPage.tsx**
   - 替换: `api.query.marketMaker.activeMarketMakers.entries()` → `tradingService.listMakers()`

---

## 📝 迁移示例

### 示例1: SellerReleasePage.tsx

#### 修改前
```typescript
// 查询订单
const ordersEntries = await api.query.otcOrder.orders.entries();

// 释放MEMO
const tx = api.tx.otcOrder.release(order.id);
await tx.signAndSend(signer, callback);
```

#### 修改后
```typescript
import { createTradingService } from '@/services/tradingService';

// 创建服务
const tradingService = createTradingService(api);

// 查询订单
const orders = await tradingService.listOrders({
  maker: currentAccount,
  state: OrderState.PaidOrCommitted,
  limit: 100
});

// 释放MEMO
const tx = tradingService.buildReleaseMemoTx(order.id);
await tx.signAndSend(signer, callback);
```

### 示例2: MakerBridgeSwapPage.tsx

#### 修改前
```typescript
// 查询做市商
const makerOpt = await api.query.marketMaker.activeMarketMakers(mmId);

// 做市商桥接
const tx = api.tx.simpleBridge.swapWithMaker(mmId, amount, tronAddress);
```

#### 修改后
```typescript
import { createTradingService } from '@/services/tradingService';

const tradingService = createTradingService(api);

// 查询做市商
const maker = await tradingService.getMaker(mmId);

// 做市商桥接
const tx = tradingService.buildMakerSwapTx({
  makerId: mmId,
  memoAmount: amount,
  tronAddress: tronAddress
});
```

---

## 🎯 枚举类型

### ApplicationStatus (做市商状态)

```typescript
enum ApplicationStatus {
  DepositLocked = 'DepositLocked',           // 押金已锁定
  PendingReview = 'PendingReview',           // 待审核
  Active = 'Active',                         // 活跃中
  Paused = 'Paused',                         // 已暂停
  WithdrawalRequested = 'WithdrawalRequested', // 申请提现中
  Withdrawn = 'Withdrawn',                   // 已提现
}
```

### Direction (交易方向)

```typescript
enum Direction {
  Buy = 'Buy',              // 仅买入
  Sell = 'Sell',            // 仅卖出
  BuyAndSell = 'BuyAndSell', // 双向
}
```

### OrderState (订单状态)

```typescript
enum OrderState {
  Created = 'Created',                  // 已创建
  PaidOrCommitted = 'PaidOrCommitted',  // 已付款/已承诺
  Released = 'Released',                // 已释放
  Disputed = 'Disputed',                // 争议中
  Arbitrating = 'Arbitrating',          // 仲裁中
  Canceled = 'Canceled',                // 已取消
  Refunded = 'Refunded',                // 已退款
  Closed = 'Closed',                    // 已关闭
}
```

### SwapStatus (桥接状态)

```typescript
enum SwapStatus {
  Pending = 'Pending',      // 待处理
  Completed = 'Completed',  // 已完成
  Reported = 'Reported',    // 已举报
  Refunded = 'Refunded',    // 已退款
}
```

---

## 💡 最佳实践

### 1. 错误处理

```typescript
try {
  const maker = await tradingService.getMaker(makerId);
  if (!maker) {
    console.error('做市商不存在');
    return;
  }
  
  if (maker.status !== ApplicationStatus.Active) {
    console.warn('做市商未激活');
    return;
  }
  
  // 继续业务逻辑...
} catch (error) {
  console.error('查询做市商失败:', error);
}
```

### 2. 交易状态监听

```typescript
const tx = tradingService.buildCreateOrderTx(params);

await tx.signAndSend(signer, ({ status, events }) => {
  if (status.isInBlock) {
    console.log('交易已打包:', status.asInBlock.toHex());
    
    // 查找事件
    events.forEach(({ event }) => {
      if (api.events.trading.OrderCreated.is(event)) {
        const [orderId] = event.data;
        console.log('订单已创建，ID:', orderId.toString());
      }
    });
  }
  
  if (status.isFinalized) {
    console.log('交易已确认');
  }
});
```

### 3. 批量查询优化

```typescript
// 不推荐：逐个查询
for (const id of [1, 2, 3, 4, 5]) {
  const maker = await tradingService.getMaker(id);
}

// 推荐：使用listMakers批量查询
const makers = await tradingService.listMakers({
  offset: 0,
  limit: 5
});
```

---

## 🔧 常见问题

### Q1: 如何获取用户的所有订单？

```typescript
const myOrders = await tradingService.listOrders({
  taker: currentAccount,
  limit: 100
});
```

### Q2: 如何判断用户是否已是做市商？

```typescript
const makerId = await tradingService.getMakerIdByAccount(currentAccount);
if (makerId !== null) {
  console.log('用户是做市商，ID:', makerId);
  const maker = await tradingService.getMaker(makerId);
  console.log('状态:', maker?.status);
} else {
  console.log('用户不是做市商');
}
```

### Q3: 如何过滤活跃的做市商？

```typescript
const activeMakers = await tradingService.listMakers({
  status: ApplicationStatus.Active,
  direction: Direction.BuyAndSell,
  limit: 20
});
```

### Q4: MEMO金额如何转换？

```typescript
// MEMO使用18位小数
const memo = '1000000000000000000'; // 1 DUST
const memoHuman = parseFloat(memo) / 1e18; // 1.0

// USDT使用6位小数（链上存储）
const usdt = 1000000; // 1 USDT
const usdtHuman = usdt / 1e6; // 1.0
```

---

## 📞 技术支持

- **文档位置**: `/docs/Trading前端集成-使用说明.md`
- **服务文件**: `/src/services/tradingService.ts`
- **完成报告**: `/docs/Trading整合修复-最终完成报告.md`

---

## 📊 迁移进度

| 功能模块 | 服务层 | 组件更新 | 状态 |
|---------|--------|---------|------|
| Maker管理 | ✅ 完成 | ⏸️ 待更新 (3个文件) | 70% |
| OTC订单 | ✅ 完成 | ⏸️ 待更新 (1个文件) | 80% |
| Bridge桥接 | ✅ 完成 | ⏸️ 待更新 (2个文件) | 70% |

**总体进度**: 约75%

---

## ⏭️ 下一步行动

### 选项A: 立即更新组件（推荐）⭐

**预计时间**: 1-2小时  
**需要更新**: 5个文件

1. `SellerReleasePage.tsx` - OTC订单释放
2. `MakerBridgeSwapPage.tsx` - 做市商桥接
3. `CreateMarketMakerPage.tsx` - 做市商申请
4. `MarketMakerPoolPage.tsx` - 做市商池管理
5. `MakerBridgeListPage.tsx` - 桥接列表

### 选项B: 分批更新

1. **第一批**: 核心功能（SellerReleasePage, MakerBridgeSwapPage）
2. **第二批**: 管理功能（其他3个文件）

### 选项C: 保留旧API兼容层

创建适配器，让旧代码暂时继续工作，逐步迁移。

---

**文档完成** ✅  
**Trading服务层已就绪** ✅  
**等待组件迁移** ⏸️

