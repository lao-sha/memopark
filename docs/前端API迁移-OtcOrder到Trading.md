# 📦 前端API迁移方案：OTC Order → Trading

**📅 创建日期**: 2025-10-29  
**🎯 目标**: 将前端从 `pallet-otc-order` 迁移到 `pallet-trading`  
**⏱️ 预计时间**: 2-4小时  
**📊 影响范围**: 22个文件，73处引用

---

## 🔍 迁移背景

### 链端架构变化（2025-10-29）

**Phase 2 架构整合**：将3个独立的 pallet 整合为1个统一的 `pallet-trading`：

| 旧 Pallet | 新位置 | 状态 |
|-----------|--------|------|
| `pallet-otc-order` | `pallet-trading::otc` | ✅ 已整合 |
| `pallet-market-maker` | `pallet-trading::maker` | ✅ 已整合 |
| `pallet-simple-bridge` | `pallet-trading::bridge` | ✅ 已整合 |

**链端变化**：
- ✅ Runtime 已移除 `OtcOrder` pallet (pallet_index 已删除)
- ✅ 新的 `Trading` pallet (pallet_index: 60)
- ✅ 所有 OTC 功能现在在 `trading::otc` 子模块中

**前端现状**：
- ⚠️ 仍在使用旧的 `api.query.otcOrder.*` 和 `api.tx.otcOrder.*`
- ⚠️ 需要迁移到 `api.query.trading.*` 和 `api.tx.trading.*`

---

## 📋 API 映射对照表

### Storage API (Query)

| 旧 API (otcOrder) | 新 API (trading) | 说明 |
|-------------------|------------------|------|
| `api.query.otcOrder.orders(id)` | `api.query.trading.orders(id)` | 查询订单详情 |
| `api.query.otcOrder.ordersByBuyer(account)` | `api.query.trading.ordersByBuyer(account)` | 买家订单列表 |
| `api.query.otcOrder.ordersBySeller(account)` | `api.query.trading.ordersBySeller(account)` | 卖家订单列表 |
| `api.query.otcOrder.nextOrderId()` | `api.query.trading.nextOrderId()` | 下一个订单ID |
| `api.query.otcOrder.buyerDailyVolume(account)` | `api.query.trading.buyerDailyVolume(account)` | 买家日交易额 |
| `api.query.otcOrder.paidOrdersWindow()` | `api.query.trading.paidOrdersWindow()` | 已付款订单窗口 |

### Extrinsic API (Transaction)

| 旧 API (otcOrder) | 新 API (trading) | 参数变化 |
|-------------------|------------------|----------|
| `api.tx.otcOrder.createOrder(maker_id, qty)` | `api.tx.trading.createOrder(maker_id, qty)` | ✅ 无变化 |
| `api.tx.otcOrder.markOrderPaid(order_id, tx_hash, contact)` | `api.tx.trading.markPaid(order_id, tx_hash, contact)` | ⚠️ 函数名变化 |
| `api.tx.otcOrder.releaseOrder(order_id)` | `api.tx.trading.releaseDust(order_id)` | ⚠️ 函数名变化 |
| `api.tx.otcOrder.cancelOrder(order_id)` | `api.tx.trading.cancelOrder(order_id)` | ✅ 无变化 |
| `api.tx.otcOrder.disputeOrder(order_id)` | `api.tx.trading.disputeOrder(order_id)` | ✅ 无变化 |
| `api.tx.otcOrder.createFirstPurchase(gateway_id)` | `api.tx.trading.createFirstPurchase(gateway_id)` | ✅ 无变化 |
| `api.tx.otcOrder.claimFreeMemo(order_id)` | `api.tx.trading.claimFreeDust(order_id)` | ⚠️ 函数名变化 |

### Event API

| 旧 Event | 新 Event | 说明 |
|----------|----------|------|
| `api.events.otcOrder.OrderCreated` | `api.events.trading.OrderCreated` | 订单创建事件 |
| `api.events.otcOrder.OrderPaid` | `api.events.trading.OrderPaid` | 订单已付款事件 |
| `api.events.otcOrder.OrderReleased` | `api.events.trading.OrderReleased` | 订单已释放事件 |
| `api.events.otcOrder.OrderCanceled` | `api.events.trading.OrderCanceled` | 订单取消事件 |
| `api.events.otcOrder.OrderDisputed` | `api.events.trading.OrderDisputed` | 订单争议事件 |

---

## 🔧 关键函数名变化

### ⚠️ 重点注意：3个函数名有变化

1. **markOrderPaid → markPaid**
   ```typescript
   // ❌ 旧代码
   api.tx.otcOrder.markOrderPaid(orderId, txHash, contact)
   
   // ✅ 新代码
   api.tx.trading.markPaid(orderId, txHash, contact)
   ```

2. **releaseOrder → releaseDust**
   ```typescript
   // ❌ 旧代码
   api.tx.otcOrder.releaseOrder(orderId)
   
   // ✅ 新代码
   api.tx.trading.releaseDust(orderId)
   ```

3. **claimFreeMemo → claimFreeDust**
   ```typescript
   // ❌ 旧代码
   api.tx.otcOrder.claimFreeMemo(orderId)
   
   // ✅ 新代码
   api.tx.trading.claimFreeDust(orderId)
   ```

**原因**：品牌统一（DUST → DUST）

---

## 📂 需要修改的文件清单

### 1. 核心服务层（优先级：🔴 高）

#### `src/services/tradingService.ts` (1处)
```typescript
// ❌ 旧代码
export const getOrderDetails = async (orderId: string) => {
  const order = await api.query.otcOrder.orders(orderId);
  return order;
};

// ✅ 新代码
export const getOrderDetails = async (orderId: string) => {
  const order = await api.query.trading.orders(orderId);
  return order;
};
```

#### `src/services/freeQuotaService.ts` (2处)
```typescript
// ❌ 旧代码
api.tx.otcOrder.claimFreeMemo(orderId)

// ✅ 新代码
api.tx.trading.claimFreeDust(orderId)
```

#### `src/services/unified-complaint.ts` (2处)
```typescript
// ❌ 旧代码
api.tx.otcOrder.disputeOrder(orderId)

// ✅ 新代码
api.tx.trading.disputeOrder(orderId)
```

---

### 2. OTC功能页面（优先级：🔴 高）

#### `src/features/otc/CreateOrderPage.tsx` (4处)
```typescript
// ❌ 旧代码
const tx = api.tx.otcOrder.createOrder(makerId, qty);

// ✅ 新代码
const tx = api.tx.trading.createOrder(makerId, qty);
```

#### `src/features/otc/MyOtcPage.tsx` (6处)
```typescript
// ❌ 旧代码
const myOrders = await api.query.otcOrder.ordersByBuyer(account);
const sellerOrders = await api.query.otcOrder.ordersBySeller(account);

// ✅ 新代码
const myOrders = await api.query.trading.ordersByBuyer(account);
const sellerOrders = await api.query.trading.ordersBySeller(account);
```

#### `src/features/otc/OrderDetailPage.tsx` (4处)
```typescript
// ❌ 旧代码
const order = await api.query.otcOrder.orders(orderId);
const cancelTx = api.tx.otcOrder.cancelOrder(orderId);
const disputeTx = api.tx.otcOrder.disputeOrder(orderId);

// ✅ 新代码
const order = await api.query.trading.orders(orderId);
const cancelTx = api.tx.trading.cancelOrder(orderId);
const disputeTx = api.tx.trading.disputeOrder(orderId);
```

#### `src/features/otc/SellerReleasePage.tsx` (2处)
```typescript
// ❌ 旧代码
const releaseTx = api.tx.otcOrder.releaseOrder(orderId);

// ✅ 新代码
const releaseTx = api.tx.trading.releaseDust(orderId);
```

#### `src/features/otc/OpenOrderForm.tsx` (8处)
```typescript
// ❌ 旧代码
const markPaidTx = api.tx.otcOrder.markOrderPaid(orderId, txHash, contactCommit);

// ✅ 新代码
const markPaidTx = api.tx.trading.markPaid(orderId, txHash, contactCommit);
```

#### `src/features/otc/ClaimMemoForm.tsx` (1处)
```typescript
// ❌ 旧代码
const claimTx = api.tx.otcOrder.claimFreeMemo(orderId);

// ✅ 新代码
const claimTx = api.tx.trading.claimFreeDust(orderId);
```

#### `src/features/otc/CreateFreeOrderPage.tsx` (1处)
```typescript
// ❌ 旧代码
const createTx = api.tx.otcOrder.createFirstPurchase(gatewayId);

// ✅ 新代码
const createTx = api.tx.trading.createFirstPurchase(gatewayId);
```

---

### 3. UI组件（优先级：🟡 中）

#### `src/components/trading/OTCOrderCard.tsx` (2处)
```typescript
// ❌ 旧代码
const order = await api.query.otcOrder.orders(orderId);

// ✅ 新代码
const order = await api.query.trading.orders(orderId);
```

#### `src/components/trading/CreateOTCOrderModal.tsx` (2处)
```typescript
// ❌ 旧代码
const createTx = api.tx.otcOrder.createOrder(makerId, amount);

// ✅ 新代码
const createTx = api.tx.trading.createOrder(makerId, amount);
```

#### `src/components/trading/TradingDashboard.tsx` (4处)
```typescript
// ❌ 旧代码
const allOrders = await api.query.otcOrder.orders.entries();

// ✅ 新代码
const allOrders = await api.query.trading.orders.entries();
```

#### `src/components/ComplaintButton.tsx` (2处)
```typescript
// ❌ 旧代码
const disputeTx = api.tx.otcOrder.disputeOrder(orderId);

// ✅ 新代码
const disputeTx = api.tx.trading.disputeOrder(orderId);
```

---

### 4. 其他文件（优先级：🟢 低）

#### `src/lib/otc-adapter.ts` (3处)
工具适配器，需要更新API引用

#### `src/routes.tsx` (2处)
路由配置，可能有注释或类型引用

#### `src/features/market-maker/MarketMakerCenterPage.tsx` (1处)
做市商页面，可能查询订单

#### `src/features/profile/MyWalletPage.tsx` (1处)
钱包页面，可能显示订单状态

---

## 🚀 迁移执行步骤

### 第1步：创建Git备份（1分钟）

```bash
cd /home/xiaodong/文档/stardust

# 创建备份标签
git add .
git commit -m "保存当前状态 - OTC API 迁移前" || true
git tag -a before-otc-api-migration -m "OTC API 迁移前备份 - $(date)"
```

---

### 第2步：全局搜索替换（10分钟）

#### 2.1 替换 Query API

```bash
# 进入前端目录
cd stardust-dapp/src

# 替换所有 query API
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i 's/api\.query\.otcOrder\./api.query.trading./g' {} +

# 验证
grep -r "api\.query\.otcOrder\." . || echo "✅ Query API 全部替换完成"
```

#### 2.2 替换 Transaction API（通用函数）

```bash
# 替换没有名称变化的函数
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/api\.tx\.otcOrder\.createOrder/api.tx.trading.createOrder/g' \
  -e 's/api\.tx\.otcOrder\.cancelOrder/api.tx.trading.cancelOrder/g' \
  -e 's/api\.tx\.otcOrder\.disputeOrder/api.tx.trading.disputeOrder/g' \
  -e 's/api\.tx\.otcOrder\.createFirstPurchase/api.tx.trading.createFirstPurchase/g' \
  {} +
```

#### 2.3 替换有名称变化的函数（⚠️ 重点）

```bash
# markOrderPaid → markPaid
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.tx\.otcOrder\.markOrderPaid/api.tx.trading.markPaid/g' {} +

# releaseOrder → releaseDust
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.tx\.otcOrder\.releaseOrder/api.tx.trading.releaseDust/g' {} +

# claimFreeMemo → claimFreeDust
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.tx\.otcOrder\.claimFreeMemo/api.tx.trading.claimFreeDust/g' {} +
```

#### 2.4 替换 Event API

```bash
# 替换事件监听
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/api\.events\.otcOrder\./api.events.trading./g' {} +

# 验证
grep -r "api\.events\.otcOrder\." . || echo "✅ Event API 全部替换完成"
```

---

### 第3步：手动检查特殊情况（30分钟）

#### 3.1 检查注释和文档字符串

```bash
# 查找注释中的 otcOrder 引用
grep -r "otcOrder" . --include="*.ts" --include="*.tsx"
```

**手动修改**：
- 代码注释中的 `otcOrder` → `trading`
- JSDoc 文档中的引用
- 类型定义中的引用

#### 3.2 检查类型导入

```typescript
// ❌ 可能存在的旧导入
import type { OtcOrder } from '@polkadot/types/interfaces';

// ✅ 检查是否需要更新类型
import type { TradingOrder } from '@polkadot/types/interfaces';
```

#### 3.3 检查常量和枚举

```typescript
// 检查是否有硬编码的 pallet 名称
const PALLET_NAME = 'otcOrder'; // ❌
const PALLET_NAME = 'trading';  // ✅
```

---

### 第4步：编译验证（10分钟）

```bash
cd /home/xiaodong/文档/stardust/stardust-dapp

# 清除缓存
rm -rf node_modules/.vite
rm -rf dist

# 编译
npm run build
```

**预期结果**：
- ✅ 无 TypeScript 编译错误
- ⚠️ 可能有项目原有的警告（与迁移无关）

**如果有错误**：
1. 查看错误信息
2. 定位到具体文件
3. 手动修复
4. 重新编译

---

### 第5步：功能测试（1-2小时）

#### 5.1 启动开发环境

```bash
# 终端1: 启动链节点
cd /home/xiaodong/文档/stardust
./启动所有服务.sh

# 终端2: 启动前端
cd stardust-dapp
npm run dev
```

#### 5.2 测试清单

**基础功能测试**：
- [ ] 查看 OTC 订单列表
- [ ] 创建新订单
- [ ] 标记订单已付款
- [ ] 做市商释放 DUST
- [ ] 取消订单
- [ ] 发起争议

**首购功能测试**：
- [ ] 创建首购订单
- [ ] 领取免费 DUST

**数据查询测试**：
- [ ] 查询我的订单（买家）
- [ ] 查询我的订单（卖家）
- [ ] 查询订单详情
- [ ] 查询日交易额度

**事件监听测试**：
- [ ] OrderCreated 事件
- [ ] OrderPaid 事件
- [ ] OrderReleased 事件
- [ ] OrderCanceled 事件

---

### 第6步：提交更改（5分钟）

```bash
cd /home/xiaodong/文档/stardust

# 查看修改
git status
git diff stardust-dapp/src

# 提交
git add stardust-dapp/
git commit -m "重构: 前端API迁移 otcOrder → trading

- 迁移所有 query API 到 trading pallet
- 迁移所有 tx API 到 trading pallet
- 更新函数名: markOrderPaid → markPaid
- 更新函数名: releaseOrder → releaseDust
- 更新函数名: claimFreeMemo → claimFreeDust
- 更新所有 event API 引用

影响文件: 22个
影响代码行: ~73处

Ref: Phase 2 架构整合 - pallet-otc-order 已整合到 pallet-trading"

# 创建标签
git tag -a after-otc-api-migration -m "OTC API 迁移完成 - $(date)"
```

---

## ✅ 验证检查清单

### 编译检查
- [ ] TypeScript 编译通过（无迁移相关错误）
- [ ] 无 API 不存在的警告
- [ ] 无类型错误

### 功能检查
- [ ] OTC 订单列表正常显示
- [ ] 创建订单功能正常
- [ ] 付款标记功能正常
- [ ] 释放 DUST 功能正常
- [ ] 取消订单功能正常
- [ ] 争议功能正常
- [ ] 首购功能正常

### 数据检查
- [ ] 查询现有订单数据正常
- [ ] 订单状态显示正确
- [ ] 金额计算正确

### 性能检查
- [ ] 页面加载速度正常
- [ ] API 响应时间正常
- [ ] 无异常错误日志

---

## 🚨 常见问题处理

### 问题1: 编译错误 "Property 'otcOrder' does not exist"

**原因**: API 已迁移，但代码中仍有残留引用

**解决**:
```bash
# 查找所有残留引用
grep -r "\.otcOrder\." stardust-dapp/src

# 手动修改每个文件
```

---

### 问题2: 运行时错误 "Cannot read property of undefined"

**原因**: 旧的链端已移除 otcOrder pallet

**解决**:
```typescript
// 检查代码中是否有条件检查
if (api.query.otcOrder) {  // ❌ 这会失败
  // ...
}

// 应该改为
if (api.query.trading) {  // ✅
  // ...
}
```

---

### 问题3: 函数参数错误

**原因**: 函数名变化导致参数不匹配

**检查**:
```typescript
// markOrderPaid 参数
api.tx.otcOrder.markOrderPaid(orderId, txHash, contact)
api.tx.trading.markPaid(orderId, txHash, contact)  // ✅ 参数相同

// releaseOrder 参数
api.tx.otcOrder.releaseOrder(orderId)
api.tx.trading.releaseDust(orderId)  // ✅ 参数相同
```

---

### 问题4: Event 监听失败

**原因**: Event 路径变化

**解决**:
```typescript
// ❌ 旧代码
api.events.otcOrder.OrderCreated.is(event)

// ✅ 新代码
api.events.trading.OrderCreated.is(event)
```

---

## 📊 迁移进度追踪

### 文件修改进度

| 文件 | 修改处数 | 状态 | 备注 |
|------|---------|------|------|
| `services/tradingService.ts` | 1 | ⬜ 待处理 | |
| `services/freeQuotaService.ts` | 2 | ⬜ 待处理 | 函数名变化 |
| `services/unified-complaint.ts` | 2 | ⬜ 待处理 | |
| `features/otc/CreateOrderPage.tsx` | 4 | ⬜ 待处理 | |
| `features/otc/MyOtcPage.tsx` | 6 | ⬜ 待处理 | |
| `features/otc/OrderDetailPage.tsx` | 4 | ⬜ 待处理 | |
| `features/otc/SellerReleasePage.tsx` | 2 | ⬜ 待处理 | 函数名变化 |
| `features/otc/OpenOrderForm.tsx` | 8 | ⬜ 待处理 | 函数名变化 |
| `features/otc/ClaimMemoForm.tsx` | 1 | ⬜ 待处理 | 函数名变化 |
| `features/otc/CreateFreeOrderPage.tsx` | 1 | ⬜ 待处理 | |
| `components/trading/OTCOrderCard.tsx` | 2 | ⬜ 待处理 | |
| `components/trading/CreateOTCOrderModal.tsx` | 2 | ⬜ 待处理 | |
| `components/trading/TradingDashboard.tsx` | 4 | ⬜ 待处理 | |
| `components/ComplaintButton.tsx` | 2 | ⬜ 待处理 | |
| 其他8个文件 | ~28 | ⬜ 待处理 | |

**进度**: 0 / 22 (0%)

---

## 🎯 成功标准

迁移成功的判断标准：

1. ✅ **编译通过**: 无 TypeScript 错误
2. ✅ **功能正常**: 所有 OTC 功能可用
3. ✅ **无残留引用**: grep 找不到 `api.query.otcOrder` 或 `api.tx.otcOrder`
4. ✅ **测试通过**: 核心功能测试清单全部通过
5. ✅ **性能正常**: 无明显性能下降

---

## 📞 支持资源

### 参考文档

1. **Pallet Trading README**: `pallets/trading/README.md`
2. **OTC 模块源码**: `pallets/trading/src/otc.rs`
3. **Runtime 配置**: `runtime/src/configs/mod.rs`

### 回滚方案

如果迁移失败，可以快速回滚：

```bash
# 查看备份标签
git tag -l "before-otc-api*"

# 回滚
git reset --hard before-otc-api-migration

# 重新启动前端
cd stardust-dapp
npm run dev
```

---

**📅 文档创建时间**: 2025-10-29  
**✍️ 创建者**: AI Assistant  
**🔄 版本**: v1.0  
**📦 状态**: ✅ 就绪，可立即执行

**🚀 开始迁移：执行第1步创建Git备份！**

