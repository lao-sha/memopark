# 前端迁移指南 - pallet-trading 重构

**日期**: 2025-11-03  
**目标**: 将前端 API 调用从旧的单体 `pallet-trading` 迁移到新的模块化架构

---

## 📋 迁移概述

### 变更影响范围

| 模块 | 影响程度 | 预计工作量 | 说明 |
|------|---------|-----------|------|
| **做市商管理** | 中等 | 2-3 小时 | API 路径变更 `trading.*` → `maker.*` |
| **OTC 订单** | 中等 | 3-4 小时 | API 路径变更 `trading.*` → `otcOrder.*` |
| **桥接功能** | 低 | 1-2 小时 | API 路径变更 `trading.*` → `bridge.*` |
| **类型定义** | 低 | 1 小时 | 导入路径更新 |
| **UI 组件** | 无 | 0 小时 | UI 逻辑不变 |

**总预计工作量**: 7-10 小时

---

## 🔄 API 映射表

### 做市商相关 API

#### Extrinsics (交易调用)

| 旧 API | 新 API | 参数 | 说明 |
|--------|--------|------|------|
| `api.tx.trading.lockDeposit()` | `api.tx.maker.lockDeposit()` | 无 | 锁定做市商押金 |
| `api.tx.trading.submitInfo(...)` | `api.tx.maker.submitInfo(...)` | name, id_card, birthday, tron_addr, epay_config | 提交做市商信息 |
| `api.tx.trading.updateInfo(...)` | `api.tx.maker.updateInfo(...)` | name, id_card, birthday, tron_addr, epay_config | 更新做市商信息 |
| `api.tx.trading.cancelMaker()` | `api.tx.maker.cancelMaker()` | 无 | 取消做市商申请 |
| `api.tx.trading.approveMaker(makerId)` | `api.tx.maker.approveMaker(makerId)` | maker_id | 审批通过（治理） |
| `api.tx.trading.rejectMaker(makerId, reason)` | `api.tx.maker.rejectMaker(makerId, reason)` | maker_id, reason | 审批拒绝（治理） |
| `api.tx.trading.requestWithdrawal()` | `api.tx.maker.requestWithdrawal()` | 无 | 申请提现 |
| `api.tx.trading.executeWithdrawal()` | `api.tx.maker.executeWithdrawal()` | 无 | 执行提现 |
| `api.tx.trading.emergencyWithdrawal(makerId)` | `api.tx.maker.emergencyWithdrawal(makerId)` | maker_id | 紧急提现（治理） |

#### Queries (存储查询)

| 旧 API | 新 API | 返回类型 | 说明 |
|--------|--------|---------|------|
| `api.query.trading.nextMakerId()` | `api.query.maker.nextMakerId()` | `u64` | 下一个做市商 ID |
| `api.query.trading.makerApplications(makerId)` | `api.query.maker.makerApplications(makerId)` | `Option<MakerApplication>` | 做市商申请信息 |
| `api.query.trading.accountToMaker(account)` | `api.query.maker.accountToMaker(account)` | `Option<u64>` | 账户 → 做市商 ID |
| `api.query.trading.withdrawalRequests(makerId)` | `api.query.maker.withdrawalRequests(makerId)` | `Option<WithdrawalRequest>` | 提现请求 |

---

### OTC 订单相关 API

#### Extrinsics (交易调用)

| 旧 API | 新 API | 参数 | 说明 |
|--------|--------|------|------|
| `api.tx.trading.createOrder(...)` | `api.tx.otcOrder.createOrder(...)` | maker_id, qty, amount, tron_addr | 创建普通订单 |
| `api.tx.trading.createFirstPurchase(...)` | `api.tx.otcOrder.createFirstPurchase(...)` | maker_id, tron_addr | 🆕 创建首购订单 |
| `api.tx.trading.markPaid(...)` | `api.tx.otcOrder.markPaid(...)` | order_id, epay_trade_no | 标记已付款 |
| `api.tx.trading.releaseDust(orderId)` | `api.tx.otcOrder.releaseDust(orderId)` | order_id | 释放 DUST |
| `api.tx.trading.cancelOrder(orderId)` | `api.tx.otcOrder.cancelOrder(orderId)` | order_id | 取消订单 |
| `api.tx.trading.disputeOrder(orderId)` | `api.tx.otcOrder.disputeOrder(orderId)` | order_id | 发起争议 |

#### Queries (存储查询)

| 旧 API | 新 API | 返回类型 | 说明 |
|--------|--------|---------|------|
| `api.query.trading.nextOrderId()` | `api.query.otcOrder.nextOrderId()` | `u64` | 下一个订单 ID |
| `api.query.trading.orders(orderId)` | `api.query.otcOrder.orders(orderId)` | `Option<Order>` | 订单信息 |
| `api.query.trading.buyerOrders(account)` | `api.query.otcOrder.buyerOrders(account)` | `BoundedVec<u64>` | 买家订单列表 |
| `api.query.trading.makerOrders(makerId)` | `api.query.otcOrder.makerOrders(makerId)` | `BoundedVec<u64>` | 做市商订单列表 |
| `api.query.trading.hasFirstPurchased(account)` | `api.query.otcOrder.hasFirstPurchased(account)` | `bool` | 🆕 是否已首购 |
| `api.query.trading.makerFirstPurchaseCount(makerId)` | `api.query.otcOrder.makerFirstPurchaseCount(makerId)` | `u32` | 🆕 做市商首购订单数 |

---

### 桥接相关 API

#### Extrinsics (交易调用)

| 旧 API | 新 API | 参数 | 说明 |
|--------|--------|------|------|
| `api.tx.trading.swap(...)` | `api.tx.bridge.swap(...)` | dust_amount, tron_address | 官方桥接 |
| `api.tx.trading.completeSwap(...)` | `api.tx.bridge.completeSwap(...)` | swap_id, tx_hash | 完成桥接（OCW） |
| `api.tx.trading.makerSwap(...)` | `api.tx.bridge.makerSwap(...)` | maker_id, dust_amount, tron_address | 做市商桥接 |
| `api.tx.trading.markSwapComplete(...)` | `api.tx.bridge.markSwapComplete(...)` | swap_id, tx_hash | 标记完成（做市商） |
| `api.tx.trading.reportSwap(swapId)` | `api.tx.bridge.reportSwap(swapId)` | swap_id | 举报 |

#### Queries (存储查询)

| 旧 API | 新 API | 返回类型 | 说明 |
|--------|--------|---------|------|
| `api.query.trading.nextSwapId()` | `api.query.bridge.nextSwapId()` | `u64` | 下一个兑换 ID |
| `api.query.trading.swapRequests(swapId)` | `api.query.bridge.swapRequests(swapId)` | `Option<SwapRequest>` | 官方兑换请求 |
| `api.query.trading.makerSwaps(swapId)` | `api.query.bridge.makerSwaps(swapId)` | `Option<MakerSwapRecord>` | 做市商兑换记录 |
| `api.query.trading.bridgeAccount()` | `api.query.bridge.bridgeAccount()` | `Option<AccountId>` | 官方桥接账户 |
| `api.query.trading.minSwapAmount()` | `api.query.bridge.minSwapAmount()` | `Balance` | 最小兑换金额 |
| `api.query.trading.userSwaps(account)` | `api.query.bridge.userSwaps(account)` | `BoundedVec<u64>` | 用户兑换列表 |

---

## 🛠️ 迁移步骤

### 步骤1：更新 Polkadot.js API 类型

```bash
cd stardust-dapp
npm run generate:defs
```

确保生成的类型定义包含新的模块：
- `@polkadot/api-augment/maker`
- `@polkadot/api-augment/otcOrder`
- `@polkadot/api-augment/bridge`

### 步骤2：搜索并替换 API 调用

使用 VS Code 或 grep 查找所有旧 API 调用：

```bash
# 查找所有 trading. 的调用
cd stardust-dapp/src
grep -rn "api.tx.trading\." .
grep -rn "api.query.trading\." .
grep -rn "api.consts.trading\." .
```

### 步骤3：批量替换（使用脚本）

创建迁移脚本 `scripts/migrate-trading-api.sh`：

```bash
#!/bin/bash

# 做市商相关
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.tx\.trading\.lockDeposit/api.tx.maker.lockDeposit/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.tx\.trading\.submitInfo/api.tx.maker.submitInfo/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.query\.trading\.makerApplications/api.query.maker.makerApplications/g'

# OTC 订单相关
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.tx\.trading\.createOrder/api.tx.otcOrder.createOrder/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.tx\.trading\.markPaid/api.tx.otcOrder.markPaid/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.query\.trading\.orders/api.query.otcOrder.orders/g'

# 桥接相关
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.tx\.trading\.swap/api.tx.bridge.swap/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.tx\.trading\.makerSwap/api.tx.bridge.makerSwap/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/api\.query\.trading\.swapRequests/api.query.bridge.swapRequests/g'

echo "✅ API 迁移完成！请手动检查并测试。"
```

### 步骤4：更新类型导入

**旧方式**:
```typescript
import type { MakerApplication, Order, SwapRequest } from '@polkadot/types/interfaces';
```

**新方式**:
```typescript
import type { MakerApplication } from '@polkadot/api-augment/maker';
import type { Order, OrderState } from '@polkadot/api-augment/otcOrder';
import type { SwapRequest, SwapStatus } from '@polkadot/api-augment/bridge';
```

### 步骤5：更新常量引用

```typescript
// 旧方式
const makerDeposit = api.consts.trading.makerDepositAmount;
const orderTimeout = api.consts.trading.orderTimeout;

// 新方式
const makerDeposit = api.consts.maker.makerDepositAmount;
const orderTimeout = api.consts.otcOrder.orderTimeout;
const minSwapAmount = api.consts.bridge.minSwapAmount;
```

---

## 📝 代码示例

### 示例1：做市商申请流程

**旧代码**:
```typescript
// 1. 锁定押金
await api.tx.trading.lockDeposit().signAndSend(account);

// 2. 提交信息
await api.tx.trading.submitInfo(
  name, idCard, birthday, tronAddr, epayConfig
).signAndSend(account);

// 3. 查询状态
const maker = await api.query.trading.makerApplications(makerId);
```

**新代码** ✅:
```typescript
// 1. 锁定押金
await api.tx.maker.lockDeposit().signAndSend(account);

// 2. 提交信息
await api.tx.maker.submitInfo(
  name, idCard, birthday, tronAddr, epayConfig
).signAndSend(account);

// 3. 查询状态
const maker = await api.query.maker.makerApplications(makerId);
```

---

### 示例2：创建 OTC 订单

**旧代码**:
```typescript
// 创建订单
const result = await api.tx.trading.createOrder(
  makerId,
  qty,
  amount,
  tronAddress
).signAndSend(account);

// 查询订单
const order = await api.query.trading.orders(orderId);
```

**新代码** ✅:
```typescript
// 创建普通订单
const result = await api.tx.otcOrder.createOrder(
  makerId,
  qty,
  amount,
  tronAddress
).signAndSend(account);

// 🆕 创建首购订单（固定 $10 USD）
const firstPurchase = await api.tx.otcOrder.createFirstPurchase(
  makerId,
  tronAddress
).signAndSend(account);

// 查询订单
const order = await api.query.otcOrder.orders(orderId);

// 🆕 检查是否已首购
const hasFirstPurchased = await api.query.otcOrder.hasFirstPurchased(account);
```

---

### 示例3：桥接兑换

**旧代码**:
```typescript
// 官方桥接
await api.tx.trading.swap(dustAmount, tronAddress).signAndSend(account);

// 做市商桥接
await api.tx.trading.makerSwap(makerId, dustAmount, tronAddress).signAndSend(account);

// 查询兑换记录
const swap = await api.query.trading.swapRequests(swapId);
```

**新代码** ✅:
```typescript
// 官方桥接
await api.tx.bridge.swap(dustAmount, tronAddress).signAndSend(account);

// 做市商桥接
await api.tx.bridge.makerSwap(makerId, dustAmount, tronAddress).signAndSend(account);

// 查询兑换记录
const swap = await api.query.bridge.swapRequests(swapId);
```

---

## 🧪 测试清单

### 手动测试

- [ ] **做市商申请**
  - [ ] 锁定押金
  - [ ] 提交信息
  - [ ] 查询申请状态
  - [ ] 审批通过/拒绝（治理）
  
- [ ] **OTC 订单**
  - [ ] 创建普通订单
  - [ ] 创建首购订单（新功能）
  - [ ] 标记已付款
  - [ ] 释放 DUST
  - [ ] 取消订单
  
- [ ] **桥接功能**
  - [ ] 官方桥接
  - [ ] 做市商桥接
  - [ ] 查询兑换记录

### 自动化测试

```bash
cd stardust-dapp

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# E2E 测试
npm run test:e2e
```

---

## ⚠️ 注意事项

### 1. 首购订单新逻辑

重构后新增了**首购订单**功能，前端需要额外处理：

```typescript
// 检查用户是否已首购
const hasFirstPurchased = await api.query.otcOrder.hasFirstPurchased(account);

if (!hasFirstPurchased) {
  // 显示首购入口（固定 $10 USD）
  await api.tx.otcOrder.createFirstPurchase(makerId, tronAddress).signAndSend(account);
} else {
  // 显示普通订单入口
  await api.tx.otcOrder.createOrder(makerId, qty, amount, tronAddress).signAndSend(account);
}
```

### 2. 做市商首购订单配额

做市商最多同时接收 **5 个首购订单**，前端需要显示配额：

```typescript
const makerFirstPurchaseCount = await api.query.otcOrder.makerFirstPurchaseCount(makerId);
const maxFirstPurchaseOrders = api.consts.otcOrder.maxFirstPurchaseOrdersPerMaker;

if (makerFirstPurchaseCount >= maxFirstPurchaseOrders) {
  alert('该做市商首购订单已满，请选择其他做市商');
}
```

### 3. 订单自动过期

订单未支付 **1 小时自动过期**，前端需要显示倒计时：

```typescript
const order = await api.query.otcOrder.orders(orderId);
const createdAt = order.created_at;
const timeout = api.consts.otcOrder.orderTimeout;  // 3600000 毫秒
const expireAt = createdAt + timeout;

// 计算剩余时间
const remaining = expireAt - Date.now();
if (remaining <= 0) {
  alert('订单已过期');
}
```

---

## 🔗 相关资源

- [pallet-trading README](../pallets/trading/README.md)
- [pallet-maker README](../pallets/maker/README.md)
- [pallet-otc-order README](../pallets/otc-order/README.md)
- [pallet-bridge README](../pallets/bridge/README.md)
- [重构完成报告](./pallet-trading重构进度总结.md)

---

## 📞 支持

如有问题，请联系：
- **技术支持**: Stardust 开发团队
- **最后更新**: 2025-11-03

