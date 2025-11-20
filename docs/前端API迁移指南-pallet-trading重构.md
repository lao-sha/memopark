# 前端API迁移指南 - pallet-trading重构

## 概述

本文档说明了 `pallet-trading` 重构为模块化架构后，前端应用需要进行的 API 调整。

### 重构背景

原 `pallet-trading` 是一个大型单体 pallet，集成了做市商管理、OTC订单、跨链桥接等多种功能。为了提高代码可维护性和模块化程度，已将其拆分为：

- **pallet-maker**: 做市商生命周期管理
- **pallet-otc-order**: OTC订单管理（含首购）
- **pallet-bridge**: DUST ↔ USDT 桥接
- **pallet-trading-common**: 共享工具库（数据脱敏、校验等）
- **pallet-trading**: 统一接口层（可选，提供向后兼容）

## API 迁移对照表

### 1. Maker（做市商）相关

#### 存储查询

| 旧API | 新API | 说明 |
|-------|-------|------|
| `api.query.trading.makers(id)` | `api.query.maker.makerApplications(id)` | 查询做市商申请信息 |
| `api.query.trading.nextMakerId()` | `api.query.maker.nextMakerId()` | 获取下一个做市商ID |
| `api.query.trading.makerIdOf(account)` | `api.query.maker.accountToMaker(account)` | 查询账户的做市商ID |

#### 交易调用

| 旧API | 新API | 说明 |
|-------|-------|------|
| `api.tx.trading.lockDeposit(amount)` | `api.tx.maker.lockDeposit(amount)` | 锁定做市商押金 |
| `api.tx.trading.submitInfo(...)` | `api.tx.maker.submitInfo(...)` | 提交做市商资料 |
| `api.tx.trading.approveMaker(id)` | `api.tx.maker.approveMaker(id)` | 审批做市商（管理员） |
| `api.tx.trading.rejectMaker(id)` | `api.tx.maker.rejectMaker(id)` | 驳回做市商（管理员） |
| `api.tx.trading.requestWithdrawal()` | `api.tx.maker.requestWithdrawal()` | 申请提现 |
| `api.tx.trading.executeWithdrawal()` | `api.tx.maker.executeWithdrawal()` | 执行提现 |

#### 事件

| 旧事件 | 新事件 | 说明 |
|-------|-------|------|
| `Trading.MakerApproved` | `Maker.MakerApproved` | 做市商审批通过 |
| `Trading.MakerRejected` | `Maker.MakerRejected` | 做市商被驳回 |
| `Trading.DepositLocked` | `Maker.DepositLocked` | 押金已锁定 |

### 2. OTC订单相关

#### 存储查询

| 旧API | 新API | 说明 |
|-------|-------|------|
| `api.query.trading.orders(id)` | `api.query.otcOrder.orders(id)` | 查询订单信息 |
| `api.query.trading.nextOrderId()` | `api.query.otcOrder.nextOrderId()` | 获取下一个订单ID |
| `api.query.trading.buyerOrders(account)` | `api.query.otcOrder.buyerOrders(account)` | 查询买家订单列表 |
| `api.query.trading.makerOrders(makerId)` | `api.query.otcOrder.makerOrders(makerId)` | 查询做市商订单列表 |

#### 交易调用

| 旧API | 新API | 说明 |
|-------|-------|------|
| `api.tx.trading.createOrder(...)` | `api.tx.otcOrder.createOrder(...)` | 创建普通订单 |
| `api.tx.trading.createFirstPurchase(...)` | `api.tx.otcOrder.createFirstPurchase(...)` | 创建首购订单 |
| `api.tx.trading.markPaid(...)` | `api.tx.otcOrder.markPaid(...)` | 标记已付款 |
| `api.tx.trading.releaseMemo(id)` | `api.tx.otcOrder.releaseDust(id)` | 释放DUST |
| `api.tx.trading.cancelOrder(id)` | `api.tx.otcOrder.cancelOrder(id)` | 取消订单 |
| `api.tx.trading.disputeOrder(id)` | `api.tx.otcOrder.disputeOrder(id)` | 发起争议 |

#### 事件

| 旧事件 | 新事件 | 说明 |
|-------|-------|------|
| `Trading.OrderCreated` | `OtcOrder.OrderCreated` | 订单已创建 |
| `Trading.OrderPaid` | `OtcOrder.OrderPaid` | 订单已付款 |
| `Trading.OrderReleased` | `OtcOrder.OrderReleased` | DUST已释放 |

### 3. Bridge（桥接）相关

#### 存储查询

| 旧API | 新API | 说明 |
|-------|-------|------|
| `api.query.trading.swapRequests(id)` | `api.query.bridge.swapRequests(id)` | 查询桥接请求 |
| `api.query.trading.makerSwapRecords(id)` | `api.query.bridge.makerSwaps(id)` | 查询做市商桥接记录 |

#### 交易调用

| 旧API | 新API | 说明 |
|-------|-------|------|
| `api.tx.trading.swap(amount, addr)` | `api.tx.bridge.swap(amount, addr)` | 发起官方桥接 |
| `api.tx.trading.completeSwap(id)` | `api.tx.bridge.completeSwap(id)` | 完成桥接（管理员） |
| `api.tx.trading.makerSwap(...)` | `api.tx.bridge.makerSwap(...)` | 做市商桥接 |
| `api.tx.trading.markSwapComplete(...)` | `api.tx.bridge.markSwapComplete(...)` | 标记桥接完成 |
| `api.tx.trading.reportSwap(id)` | `api.tx.bridge.reportSwap(id)` | 举报桥接 |

#### 事件

| 旧事件 | 新事件 | 说明 |
|-------|-------|------|
| `Trading.SwapCreated` | `Bridge.SwapCreated` | 桥接请求已创建 |
| `Trading.SwapCompleted` | `Bridge.SwapCompleted` | 桥接已完成 |

## 已适配文件清单

以下文件已完成API迁移：

### 核心服务层

1. **`src/services/tradingService.ts`**
   - ✅ 所有 Maker 查询/交易已迁移到 `api.query.maker` / `api.tx.maker`
   - ✅ 所有 OTC 查询/交易已迁移到 `api.query.otcOrder` / `api.tx.otcOrder`
   - ✅ 所有 Bridge 查询/交易已迁移到 `api.query.bridge` / `api.tx.bridge`

2. **`src/services/freeQuotaService.ts`**
   - ✅ 首购查询迁移到 `api.query.otcOrder.hasFirstPurchased`
   - ✅ 首购计数迁移到 `api.query.otcOrder.makerFirstPurchaseCount`
   - ⚠️ 部分免费配额设置功能已移除（新架构中首购固定为1次）

3. **`src/utils/committeeEncryption.ts`**
   - ⚠️ 委员会密钥分片功能标记为待实现（需确定正确的存储位置）

### 页面组件

4. **`src/features/otc/CreateMarketMakerPage.tsx`**
   - ✅ `api.query.trading.nextId` → `api.query.maker.nextMakerId`
   - ✅ `api.query.trading.applications` → `api.query.maker.makerApplications`
   - ✅ `api.query.trading.ownerIndex` → `api.query.maker.accountToMaker`

5. **`src/features/bridge/SimpleBridgePage.tsx`**
   - ✅ `api.tx.trading.swap` → `api.tx.bridge.swap`
   - ✅ 事件监听从 `Trading.SwapCreated` 改为 `Bridge.SwapCreated`

### 其他待适配文件

以下文件需要进一步检查和适配（未在此次迁移中完整处理）：

- `src/features/bridge/MakerBridgeComplaintPage.tsx`
- `src/features/bridge/MakerBridgeDashboard.tsx`
- `src/features/bridge/MakerBridgeSwapPage.tsx`
- `src/features/bridge/MakerBridgeListPage.tsx`
- `src/features/otc/SellerReleasePage.tsx`
- `src/features/first-purchase/MarketMakerPoolPage.tsx`

## 迁移注意事项

### 1. 类型变更

部分数据结构可能有细微调整，请注意：

- **OrderState**: 枚举值保持一致，但来源从 `pallet-trading` 改为 `pallet-otc-order`
- **MakerApplication**: 字段名称可能略有调整（如 `ownerIndex` → `accountToMaker`）

### 2. 事件监听

所有事件监听需要更新 `section` 名称：

```typescript
// ❌ 旧代码
events.forEach(({ event }) => {
  if (event.section === 'trading' && event.method === 'OrderCreated') {
    // ...
  }
});

// ✅ 新代码
events.forEach(({ event }) => {
  if (event.section === 'otcOrder' && event.method === 'OrderCreated') {
    // ...
  }
});
```

### 3. 首购功能变更

**重要变更**：新架构中首购配额是固定的（每人1次），不再支持做市商自定义配额。

- ❌ 已移除：`setFreeQuotaConfig`、`grantFreeQuota`、`batchGrantFreeQuota`
- ✅ 新查询：`api.query.otcOrder.hasFirstPurchased(account)`
- ✅ 新查询：`api.query.otcOrder.makerFirstPurchaseCount(makerId)`

### 4. 统一接口层（可选）

如果不想立即迁移所有前端代码，可以使用 `pallet-trading` 统一接口层作为过渡：

```typescript
// 通过统一接口层查询（向后兼容）
const stats = await api.query.trading.getPlatformStats();
const userInfo = await api.query.trading.getUserFullInfo(account);
```

但建议尽快迁移到新的独立 pallet API，以获得更好的性能和类型安全。

## 测试建议

完成迁移后，建议进行以下测试：

### 功能测试

1. **做市商流程**
   - [ ] 质押押金
   - [ ] 提交资料
   - [ ] 管理员审批/驳回
   - [ ] 申请提现

2. **OTC订单流程**
   - [ ] 创建普通订单
   - [ ] 创建首购订单
   - [ ] 标记已付款
   - [ ] 释放DUST
   - [ ] 取消订单
   - [ ] 发起争议

3. **桥接流程**
   - [ ] 发起官方桥接
   - [ ] 做市商桥接
   - [ ] 标记完成
   - [ ] 举报异常

### 性能测试

- 查询响应时间（应与旧版本相当或更快）
- 交易Gas消耗（应保持不变）
- 并发处理能力

## 回退方案

如果迁移后发现严重问题，可以临时回退到旧版本：

1. 在 `runtime/src/lib.rs` 中注释新pallet，恢复旧的 `pallet-trading`
2. 回滚前端代码到迁移前的版本
3. 重新编译并部署

**注意**：回退前务必备份链上数据和状态。

## 技术支持

如有疑问或遇到问题，请联系：

- 技术负责人：Memopark Team
- 文档位置：`/home/xiaodong/文档/stardust/docs/`
- 相关文档：
  - `pallet-trading重构方案.md`
  - `pallet-trading编译现状与建议.md`

---

**文档版本**: 1.0  
**最后更新**: 2025-11-03  
**适用范围**: stardust-dapp 前端应用

