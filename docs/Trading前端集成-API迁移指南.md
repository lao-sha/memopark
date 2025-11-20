# Trading前端集成 - API迁移指南

**文档版本**: v1.0  
**生成时间**: 2025-10-29  
**适用范围**: `pallet-trading` v1.0.0

---

## 🎯 快速开始

### 第一步：识别需要迁移的文件

```bash
# 在前端项目根目录执行
cd /home/xiaodong/文档/stardust/stardust-dapp
grep -r "api\.tx\.otcOrder\|api\.query\.otcOrder\|api\.tx\.marketMaker\|api\.query\.marketMaker\|api\.tx\.simpleBridge\|api\.query\.simpleBridge" src --include="*.ts" --include="*.tsx" -l
```

### 第二步：按优先级迁移

#### 🔴 高优先级（必须迁移）

1. **SellerReleasePage.tsx** - OTC卖家释放MEMO
2. **SimpleBridgePage.tsx** - 官方桥接

#### 🟡 中优先级（推荐迁移）

3. **MakerBridgeSwapPage.tsx** - 做市商兑换
4. **MakerBridgeListPage.tsx** - 做市商列表
5. **MakerBridgeDashboard.tsx** - 做市商仪表板
6. **MakerBridgeComplaintPage.tsx** - 投诉与仲裁

#### 🟢 低优先级（可选/重构）

7. **CreateMarketMakerPage.tsx** - 做市商申请（参数大变，需重构）
8. **MarketMakerPoolPage.tsx** - 资金池管理（保持现状或轻度修改）

---

## 📋 迁移示例

### 示例1: SellerReleasePage.tsx

#### 🔴 旧代码（使用 pallet-otc-order）

```typescript
// ❌ 旧API - 不再使用
const loadOrders = async () => {
  const api = await getApi();
  const ordersEntries = await api.query.otcOrder.orders.entries();
  // ...
}

const handleRelease = async (orderId: number) => {
  const api = await getApi();
  const tx = api.tx.otcOrder.release(orderId);
  await signAndSendLocalWithPassword(tx, currentAccount, password);
}
```

#### ✅ 新代码（使用 pallet-trading）

```typescript
// ✅ 新API - pallet-trading
const loadOrders = async () => {
  const api = await getApi();
  const ordersEntries = await api.query.trading.orders.entries();  // 🆕
  // ...
}

const handleRelease = async (orderId: number) => {
  const api = await getApi();
  const tx = api.tx.trading.releaseMemo(orderId);  // 🆕 名称变化：release → releaseMemo
  await signAndSendLocalWithPassword(tx, currentAccount, password);
}
```

---

### 示例2: SimpleBridgePage.tsx

#### 🔴 旧代码（使用 pallet-simple-bridge）

```typescript
// ❌ 旧API - 不再使用
const handleSwap = async () => {
  const api = await getApi();
  const tx = api.tx.simpleBridge.swap(
    BigInt(memoAmount * 1e12),
    tronAddress
  );
  await signAndSendTxWithPassword(tx, currentAccount.address);
}
```

#### ✅ 新代码（使用 pallet-trading）

```typescript
// ✅ 新API - pallet-trading
const handleSwap = async () => {
  const api = await getApi();
  const tx = api.tx.trading.swap(  // 🆕
    BigInt(memoAmount * 1e12),
    tronAddress
  );
  await signAndSendTxWithPassword(tx, currentAccount.address);
}
```

---

### 示例3: MakerBridgeSwapPage.tsx

#### 🔴 旧代码（使用 pallet-simple-bridge + pallet-market-maker）

```typescript
// ❌ 旧API - 不再使用
const loadMakerInfo = async () => {
  const api = await getApi();
  const mmId = parseInt(makerId);
  
  // 查询做市商基本信息
  const makerOpt = await api.query.marketMaker.activeMarketMakers(mmId);
  const maker = makerOpt.unwrap();
  
  // 查询桥接服务配置
  const serviceOpt = await api.query.marketMaker.bridgeServices(mmId);
  const service = serviceOpt.unwrap();
  // ...
}

const handleSwap = async () => {
  const api = await getApi();
  const tx = api.tx.simpleBridge.swapWithMaker(
    mmId,
    memoAmountRaw,
    tronAddr
  );
  await signAndSendTxWithPassword(tx, currentAccount.address);
}
```

#### ✅ 新代码（使用 pallet-trading）

```typescript
// ✅ 新API - pallet-trading
const loadMakerInfo = async () => {
  const api = await getApi();
  const mmId = parseInt(makerId);
  
  // 🆕 做市商信息和桥接配置已合并到 makerApplications
  const makerOpt = await api.query.trading.makerApplications(mmId);
  if (makerOpt.isNone) {
    message.error('做市商不存在');
    return;
  }
  
  const maker = makerOpt.unwrap();
  const makerData = maker.toJSON();
  
  // 🆕 从maker数据中提取桥接配置
  setMakerInfo({
    mmId,
    owner: makerData.owner,
    name: makerData.publicCid || `做市商 #${mmId}`,
    deposit: makerData.deposit,
    status: makerData.status,
  });
  
  setServiceConfig({
    enabled: makerData.status === 'Active',  // 🆕 简化：Active状态即启用
    maxSwapAmount: calculateMaxSwap(makerData.deposit),  // 🆕 根据押金计算
    feeRate: calculateFeeRate(makerData.buyPremiumBps),  // 🆕 根据溢价计算
    buyPremiumBps: makerData.buyPremiumBps,
    sellPremiumBps: makerData.sellPremiumBps,
    minAmount: makerData.minAmount,
    // ...
  });
}

const handleSwap = async () => {
  const api = await getApi();
  const tx = api.tx.trading.makerSwap(  // 🆕 名称变化：swapWithMaker → makerSwap
    mmId,
    memoAmountRaw,
    tronAddr
  );
  await signAndSendTxWithPassword(tx, currentAccount.address);
}
```

---

### 示例4: MakerBridgeDashboard.tsx

#### 🔴 旧代码（使用 pallet-simple-bridge）

```typescript
// ❌ 旧API - 不再使用
const loadPendingSwaps = async (mmId: number) => {
  const api = await getApi();
  const allSwapsEntries = await api.query.simpleBridge.makerSwaps.entries();
  // ...
}

const handleCompleteSwap = async () => {
  const api = await getApi();
  const tx = api.tx.simpleBridge.completeSwapByMaker(
    selectedSwap.swapId,
    trc20TxHash
  );
  await signAndSendTxWithPrompt(tx, currentAccount.address);
}
```

#### ✅ 新代码（使用 pallet-trading）

```typescript
// ✅ 新API - pallet-trading
const loadPendingSwaps = async (mmId: number) => {
  const api = await getApi();
  const allSwapsEntries = await api.query.trading.makerSwaps.entries();  // 🆕
  // ...
}

const handleCompleteSwap = async () => {
  const api = await getApi();
  const tx = api.tx.trading.markSwapComplete(  // 🆕 名称变化
    selectedSwap.swapId,
    trc20TxHash
  );
  await signAndSendTxWithPrompt(tx, currentAccount.address);
}
```

---

### 示例5: MakerBridgeComplaintPage.tsx

#### 🔴 旧代码（使用 pallet-simple-bridge）

```typescript
// ❌ 旧API - 不再使用
const loadSwapRecord = async () => {
  const api = await getApi();
  const recordOpt = await api.query.simpleBridge.makerSwaps(id);
  // ...
}

const handleSubmitComplaint = async () => {
  const api = await getApi();
  const tx = api.tx.simpleBridge.reportMaker(id, evidenceCid);
  await signAndSendTxWithPrompt(tx, currentAccount.address);
}
```

#### ✅ 新代码（使用 pallet-trading）

```typescript
// ✅ 新API - pallet-trading
const loadSwapRecord = async () => {
  const api = await getApi();
  const recordOpt = await api.query.trading.makerSwaps(id);  // 🆕
  // ...
}

const handleSubmitComplaint = async () => {
  const api = await getApi();
  const tx = api.tx.trading.reportSwap(id, evidenceCid);  // 🆕 名称变化：reportMaker → reportSwap
  await signAndSendTxWithPrompt(tx, currentAccount.address);
}
```

---

## 🔧 常见问题

### Q1: `api.query.marketMaker.bridgeServices` 在新API中找不到？

**A**: 桥接服务配置已合并到 `makerApplications` 中。

```typescript
// ❌ 旧API（独立存储）
const serviceOpt = await api.query.marketMaker.bridgeServices(mmId);

// ✅ 新API（合并到maker）
const makerOpt = await api.query.trading.makerApplications(mmId);
const maker = makerOpt.unwrap();
// 从maker数据中提取桥接相关配置
const { buyPremiumBps, sellPremiumBps, minAmount, tronAddress } = maker.toJSON();
```

### Q2: 做市商状态如何判断是否提供桥接服务？

**A**: 检查做市商的 `status` 和 `direction` 字段。

```typescript
const maker = makerOpt.unwrap();
const makerData = maker.toJSON();

// 🆕 判断桥接服务是否可用
const isBridgeAvailable = 
  makerData.status === 'Active' &&  // 做市商已激活
  (makerData.direction === 'Buy' || makerData.direction === 'BuyAndSell');  // 支持买入方向
```

### Q3: 如何获取做市商的手续费率？

**A**: 根据 `buyPremiumBps` 或 `sellPremiumBps` 计算。

```typescript
const maker = makerOpt.unwrap();
const makerData = maker.toJSON();

// 🆕 计算手续费率（示例）
const feeRate = Math.abs(makerData.buyPremiumBps) / 100;  // bps → %
```

### Q4: `submitInfo` 的参数完全变了怎么办？

**A**: 这是做市商申请流程的重大变化，建议：
1. **短期方案**: CreateMarketMakerPage保持使用旧API（如果旧pallet还在runtime中）
2. **长期方案**: 重新设计做市商申请表单，匹配新的参数要求

```typescript
// 🆕 新的submitInfo参数（pallet-trading）
api.tx.trading.submitInfo(
  realName: Uint8Array,        // 真实姓名（新增）
  idCardNumber: Uint8Array,    // 身份证号（新增）
  birthday: Uint8Array,         // 生日（新增）
  tronAddress: Uint8Array,
  wechatId: Uint8Array,         // 微信号（新增）
  epayNo?: Uint8Array,
  epayKey?: Uint8Array
)
```

---

## ✅ 迁移检查清单

### 文件级检查

- [ ] 所有 `api.query.otcOrder` 替换为 `api.query.trading`
- [ ] 所有 `api.query.marketMaker` 替换为 `api.query.trading`（做市商相关）
- [ ] 所有 `api.query.simpleBridge` 替换为 `api.query.trading`
- [ ] 所有 `api.tx.otcOrder` 替换为 `api.tx.trading`
- [ ] 所有 `api.tx.marketMaker` 替换为 `api.tx.trading`（做市商相关）
- [ ] 所有 `api.tx.simpleBridge` 替换为 `api.tx.trading`
- [ ] 特别注意函数名变化（`release` → `releaseMemo` 等）
- [ ] 特别注意数据结构变化（`bridgeServices` 合并到 `makerApplications`）

### 功能测试

- [ ] OTC订单创建 → 标记已付款 → 释放MEMO
- [ ] 官方桥接（swap）正常
- [ ] 做市商桥接（makerSwap）正常
- [ ] 做市商申请流程正常
- [ ] 投诉举报功能正常
- [ ] 无控制台报错

---

## 📚 参考资源

1. **pallet-trading 源码**
   - `pallets/trading/src/lib.rs` - 完整的存储项和调用函数
   - `pallets/trading/src/otc.rs` - OTC订单逻辑
   - `pallets/trading/src/maker.rs` - 做市商管理逻辑
   - `pallets/trading/src/bridge.rs` - 桥接逻辑

2. **前端服务层**
   - `stardust-dapp/src/services/tradingService.ts` - 完整的API封装示例

3. **示例组件**
   - `stardust-dapp/src/components/trading/` - Trading组件实现

4. **文档**
   - `pallets/trading/README.md` - pallet-trading完整文档
   - `docs/Trading前端集成-最终完成报告.md` - 本次迁移总结

---

**提示**: 建议先完成1-2个文件的迁移并测试通过，再批量迁移其他文件。遇到问题可参考`tradingService.ts`中的实现。

