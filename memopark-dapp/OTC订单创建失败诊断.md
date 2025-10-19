# OTC 订单创建失败诊断报告

**日期**: 2025-10-18  
**问题**: 用户创建 OTC 订单后，交易显示成功但链上没有订单数据

---

## 🐛 问题描述

### 现象
1. 前端日志显示交易成功：
   ```
   [交易状态] otcOrder.openOrderWithProtection: InBlock
   [交易状态] otcOrder.openOrderWithProtection: Finalized
   ✅ 加载到 1 个活跃挂单
   ```

2. "我的订单"列表查询结果：
   ```
   📊 查询到订单条目数: 0
   ✅ 最终加载到 0 个我的订单
   ```

3. 链上验证：
   ```
   链上订单总数: 0
   ⚠️  链上没有任何订单
   ```

### 用户信息
- **助记词**: `gown lounge wolf cake hard sport napkin lock buddy interest session inside`
- **地址**: `5C7RjMrgfCJYyscR5Du1BLP99vFGgRDXjAt3ronftJZe39Qo`
- **余额**: 5,517,946,289 MEMO

---

## 🔍 根本原因

通过检查链上数据，发现**挂单 #0 的剩余数量为 0**：

```
挂单 #0:
  做市商: 5CRubhWmwNmJ3z2Ffqs3nf71XQGHBkfKSc1edNvuHZErqvdL
  最小数量: 1111 MEMO
  最大数量: 111111 MEMO
  剩余数量: 0 MEMO        ← ❌ 关键问题！
  价格差额: 100 bps
```

### 失败流程

1. **前端调用** `openOrderWithProtection(listingId: 0, ...)`
2. **链端检查**:
   - ✅ 挂单存在
   - ❌ 剩余数量 = 0 → 无法创建订单
3. **交易状态**:
   - `InBlock`: 交易已打包（前端显示✓）
   - `Finalized`: 交易已确认（前端显示✓）
   - 但执行失败，没有创建订单

### 为什么前端显示成功？

前端代码监听交易状态：

```typescript
tx.signAndSend(signer, ({ status, dispatchError, events }) => {
  if (status.isInBlock) {
    console.log('✓ 交易已打包')
  }
  if (status.isFinalized) {
    console.log('✓ 交易已最终确认')
  }
})
```

**问题**: 前端只检查了交易是否被打包和确认，**没有检查 `dispatchError`**！

即使交易执行失败（`dispatchError` 存在），只要交易被打包，前端就显示"成功"。

---

## ✅ 解决方案

### 方案 1: 修复前端错误处理（推荐）

修改 `CreateOrderPage.tsx` 的交易处理逻辑，正确检查 `dispatchError`：

```typescript
// 修改前
tx.signAndSend(signer, ({ status }) => {
  if (status.isFinalized) {
    message.success('订单创建成功')
  }
})

// 修改后
tx.signAndSend(signer, ({ status, dispatchError, events }) => {
  if (status.isInBlock) {
    // 检查是否有错误
    if (dispatchError) {
      if (dispatchError.isModule) {
        const decoded = api.registry.findMetaError(dispatchError.asModule)
        throw new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`)
      } else {
        throw new Error(dispatchError.toString())
      }
    }
  }
  
  if (status.isFinalized) {
    // 确认事件中有 OrderCreated
    const orderCreated = events.some(({ event }) => 
      event.section === 'otcOrder' && event.method === 'OrderCreated'
    )
    
    if (orderCreated) {
      message.success('订单创建成功')
    } else {
      throw new Error('订单创建失败：未检测到 OrderCreated 事件')
    }
  }
})
```

### 方案 2: 补充挂单剩余数量

为挂单 #0 补充剩余数量：

```javascript
// 使用做市商账户执行
const makerMnemonic = '做市商的助记词'
const account = keyring.addFromMnemonic(makerMnemonic)

// 调用 increaseListingQuantity 或重新创建挂单
await api.tx.otcListing.increaseListingQuantity(0, qty).signAndSend(account)
```

---

## 🔧 立即修复步骤

### 步骤 1: 检查前端错误处理

检查 `memopark-dapp/src/features/otc/CreateOrderPage.tsx` 中的交易处理代码：

```bash
grep -A 20 "signAndSend" memopark-dapp/src/features/otc/CreateOrderPage.tsx
```

### 步骤 2: 修改交易监听逻辑

在 `signAndSend` 回调中添加 `dispatchError` 检查：

```typescript
.signAndSend(account, ({ status, dispatchError, events }) => {
  // 检查错误
  if (dispatchError) {
    handleError(dispatchError)
    return
  }
  
  // 检查成功事件
  if (status.isFinalized) {
    const success = events.some(({ event }) => {
      return event.section === 'otcOrder' && 
             event.method === 'OrderCreated'
    })
    
    if (success) {
      handleSuccess()
    } else {
      handleError('未检测到订单创建事件')
    }
  }
})
```

### 步骤 3: 补充挂单数量（临时解决）

```javascript
// 运行此脚本补充挂单数量
node -e "
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

async function increaseQty() {
  const api = await ApiPromise.create({ 
    provider: new WsProvider('ws://127.0.0.1:9944') 
  });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const maker = keyring.addFromUri('//做市商账户');
  
  // 增加 100000 MEMO
  const qty = BigInt(100000) * BigInt(1e12);
  
  await new Promise((resolve, reject) => {
    api.tx.otcListing.increaseListingQuantity(0, qty.toString())
      .signAndSend(maker, ({ status, dispatchError }) => {
        if (status.isFinalized) {
          if (dispatchError) {
            reject(dispatchError);
          } else {
            console.log('✅ 挂单数量已增加');
            resolve();
          }
        }
      });
  });
  
  await api.disconnect();
}

increaseQty().catch(console.error);
"
```

---

## 📋 验证清单

- [ ] 修复前端错误处理逻辑
- [ ] 添加 OrderCreated 事件检查
- [ ] 补充挂单剩余数量
- [ ] 测试创建订单流程
- [ ] 验证"我的订单"显示

---

## 🎯 预防措施

### 1. 前端显示改进

在创建订单前，显示挂单剩余数量：

```typescript
<Form.Item label="挂单剩余数量">
  <Text strong>{restQty} MEMO</Text>
  {restQty < qty && (
    <Alert type="warning" message="剩余数量不足！" />
  )}
</Form.Item>
```

### 2. 链端验证

在 `openOrderWithProtection` 中添加更详细的错误信息：

```rust
ensure!(l.rest_qty >= qty, Error::<T>::InsufficientListingQuantity);
```

### 3. 事件监控

前端监听所有相关事件：

```typescript
events.forEach(({ event }) => {
  console.log(`事件: ${event.section}.${event.method}`)
  console.log('数据:', event.data.toJSON())
})
```

---

## 📊 数据分析

### 挂单状态

| 挂单ID | 做市商 | 最大数量 | 剩余数量 | 状态 |
|--------|--------|---------|---------|------|
| 0 | 5CRub...qvdL | 111,111 | **0** | ❌ 已售罄 |

### 订单状态

| 订单总数 | 我的订单 | 状态 |
|---------|---------|------|
| 0 | 0 | ❌ 无数据 |

---

## 🔗 相关文件

- 前端组件: `memopark-dapp/src/features/otc/CreateOrderPage.tsx`
- 订单列表: `memopark-dapp/src/features/otc/MyOrdersCard.tsx`
- 链端 Pallet: `pallets/otc-order/src/lib.rs`
- 挂单 Pallet: `pallets/otc-listing/src/lib.rs`

---

## 💡 总结

**问题**: 挂单剩余数量为 0，无法创建订单

**影响**: 用户误以为订单创建成功，实际失败

**解决**: 
1. 修复前端错误处理（检查 dispatchError 和事件）
2. 补充挂单剩余数量
3. 改进前端 UI，显示挂单状态

---

**报告生成时间**: 2025-10-18 14:35:00  
**诊断人**: AI Assistant

