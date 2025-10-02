# 做市商审核批准功能修复报告

## 问题描述

**时间**：2025-09-30  
**模块**：pallet-market-maker + 前端审核页面  
**问题**：做市商审核批准后，前端没有显示批准审核结果

## 问题分析

### 1. 后端接口检查 ✅

经检查，后端接口正常工作：
- `pallet-market-maker` 已正确集成到 runtime（pallet_index = 45）
- `api.tx.marketMaker.approve(mmId)` 接口正确暴露
- `approve` 函数逻辑正确：
  - 检查状态为 `PendingReview`
  - 更新状态为 `Active`
  - 触发 `Event::Approved { mm_id }` 事件

### 2. 前端调用逻辑检查 ❌

**核心问题**：前端的 `signAndSendLocalFromKeystore` 函数在交易提交后立即返回交易哈希，**不等待交易被打包进区块**。

#### 问题代码（修复前）
```typescript:107:107:memopark-dapp/src/lib/polkadot-safe.ts
const hash = await tx.signAndSend(pair)
return hash.toString()
```

这段代码的问题：
1. `signAndSend(pair)` 只是提交交易到交易池，不等待打包
2. 返回的是交易提交时的哈希，而非区块哈希
3. 前端收到返回值时，交易可能还在交易池中，未被打包进区块
4. 此时链上状态尚未更新，导致后续的轮询检查失败

#### 前端轮询逻辑

审核页面在收到交易哈希后，通过轮询检查状态：
- 首次检查延迟 6 秒
- 最多轮询 5 次，每次间隔 3 秒
- 检查链上状态是否变为 `Active`

但由于交易可能在 6 秒后才被打包，轮询检查时状态仍为 `PendingReview`，导致：
- 用户看到"状态更新延迟"的警告
- 需要手动刷新才能看到批准结果

## 解决方案

### 修改 1：优化 `signAndSendLocalFromKeystore` 函数

**位置**：`memopark-dapp/src/lib/polkadot-safe.ts`

**核心改动**：等待交易被打包进区块（`isFinalized`）后再返回

```typescript
// 函数级中文注释：等待交易被打包进区块，返回区块哈希
const hash = await new Promise<string>((resolve, reject) => {
  tx.signAndSend(pair, ({ status, dispatchError }: any) => {
    console.log(`[交易状态] ${section}.${method}:`, status.type)
    
    if (status.isInBlock) {
      console.log(`✓ 交易已打包进区块: ${status.asInBlock.toString()}`)
    }
    
    if (status.isFinalized) {
      console.log(`✓ 交易已最终确认: ${status.asFinalized.toString()}`)
      
      // 检查是否有调度错误
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule)
          const { docs, name, section: errSection } = decoded
          reject(new Error(`${errSection}.${name}: ${docs.join(' ')}`))
        } else {
          reject(new Error(dispatchError.toString()))
        }
      } else {
        // 交易成功，返回区块哈希
        resolve(status.asFinalized.toString())
      }
    }
  }).catch(reject)
})
```

**改进效果**：
- 交易被打包进区块后才返回
- 返回的是区块哈希（而非交易哈希）
- 前端收到返回值时，链上状态已经更新
- 自动检测交易执行错误，抛出友好错误信息

### 修改 2：同步优化 `signAndSendLocalWithPassword` 函数

**位置**：`memopark-dapp/src/lib/polkadot-safe.ts`

应用相同的改动，确保所有本地签名函数都等待区块确认。

### 修改 3：简化审核页面的批准逻辑

**位置**：`memopark-dapp/src/features/otc/GovMarketMakerReviewPage.tsx`

**修改前**：
- 提交交易后立即乐观更新（从列表移除）
- 6 秒后开始轮询检查状态
- 最多轮询 5 次，每次间隔 3 秒
- 轮询失败则提示用户手动刷新

**修改后**：
```typescript
// 函数级中文注释：调用批准接口，等待交易确认
const hash = await signAndSendLocalFromKeystore('marketMaker', 'approve', [mmId])

message.loading({ content: '交易已确认，正在刷新列表...', key: 'approve', duration: 0 })

// 函数级中文注释：交易已确认，立即清除选中状态
setSelectedApp(null)

// 函数级中文注释：刷新两个列表（待审和已批准）
await loadPendingApplications()
await loadApprovedApplications()

message.success({ 
  content: `批准成功！区块哈希: ${hash.slice(0, 10)}...`, 
  key: 'approve', 
  duration: 3 
})
```

**改进效果**：
- 移除轮询逻辑，代码更简洁
- 交易确认后立即刷新列表
- 用户体验更流畅，无需手动刷新

### 修改 4：同步优化驳回申请逻辑

应用相同的改动到 `handleReject` 函数。

## 修改文件清单

1. **前端核心库**
   - `/home/xiaodong/文档/memopark/memopark-dapp/src/lib/polkadot-safe.ts`
     - 修改 `signAndSendLocalFromKeystore` 函数
     - 修改 `signAndSendLocalWithPassword` 函数

2. **审核页面**
   - `/home/xiaodong/文档/memopark/memopark-dapp/src/features/otc/GovMarketMakerReviewPage.tsx`
     - 优化 `handleApprove` 函数
     - 优化 `handleReject` 函数

3. **文档更新**
   - `/home/xiaodong/文档/memopark/pallets/market-maker/README.md`
     - 添加优化记录章节

## 影响范围

### 正向影响 ✅

1. **批准/驳回功能正常工作**
   - 操作完成后立即显示结果
   - 无需手动刷新

2. **所有交易更可靠**
   - 所有使用本地钱包的交易都会等待确认
   - 自动检测交易错误，提供友好提示
   - 确保链上状态更新后才继续操作

3. **代码更简洁**
   - 移除复杂的轮询逻辑
   - 降低代码维护成本

### 潜在影响 ⚠️

1. **交易响应时间增加**
   - 等待区块确认需要 6-12 秒（1-2 个区块）
   - 用户需要等待更长时间才能看到"交易成功"提示
   - **建议**：在 UI 中明确显示"等待区块确认..."的提示

2. **影响所有交易**
   - 不仅是做市商审核，所有使用 `signAndSendLocalFromKeystore` 的交易都受影响
   - 包括：供奉、创建墓地、创建逝者、OTC 订单等
   - **建议**：在所有交易操作中统一使用 loading 状态提示

## 测试验证

### 1. 链端 API 测试 ✅

运行测试脚本验证：
```bash
cd /home/xiaodong/文档/memopark/memopark-dapp
node check-mm-api.mjs
```

结果：
```
✓ api.query.marketMaker 存在
✓ api.tx.marketMaker 存在
✓ api.tx.marketMaker.approve 存在
   方法签名: {"name":"approve","fields":[...],"index":3,"docs":["批准（委员会）"]}

可用的 extrinsic 方法:
  - lockDeposit
  - submitInfo
  - cancel
  - approve
  - reject
  - expire
```

### 2. Lint 检查 ✅

```bash
✓ No linter errors found
```

### 3. 功能测试建议

**测试场景 1：批准申请**
1. 创建做市商申请（lock_deposit → submit_info）
2. 使用委员会账户访问审核页面（#/gov/mm-review）
3. 点击"批准申请"按钮
4. 输入密码确认
5. **预期结果**：
   - 显示"正在签名并提交交易..."
   - 6-12 秒后显示"交易已确认，正在刷新列表..."
   - 列表自动刷新，申请从待审列表移除
   - 申请出现在已批准列表中，状态为 Active

**测试场景 2：驳回申请**
1. 创建做市商申请
2. 使用委员会账户访问审核页面
3. 点击"驳回申请"按钮
4. 输入扣罚比例（例如：1000 bps = 10%）
5. 输入密码确认
6. **预期结果**：
   - 显示"正在签名并提交交易..."
   - 6-12 秒后显示"交易已确认，正在刷新列表..."
   - 列表自动刷新，申请从待审列表移除
   - 扣罚金额按比例计算，余额退还

**测试场景 3：交易失败处理**
1. 使用非委员会账户尝试批准
2. **预期结果**：
   - 显示友好错误提示，例如："BadOrigin: ..."
   - 列表不变化

## 总结

本次修复通过优化前端交易签名函数，确保交易被打包进区块后再返回，从根本上解决了批准审核后前端不显示结果的问题。

**核心改进**：
- ✅ 后端接口正常，无需修改
- ✅ 前端交易函数优化，等待区块确认
- ✅ 审核页面逻辑简化，移除轮询
- ✅ 所有交易更可靠，自动错误检测
- ✅ 用户体验提升，无需手动刷新

**后续建议**：
1. 在所有交易操作中统一使用 loading 状态提示
2. 考虑在 UI 中显示交易状态（提交中 → 打包中 → 已确认）
3. 对于长时间运行的交易，可以提供"在后台运行"的选项
4. 添加交易历史记录，方便用户查看过往操作

## 开发者备注

- 修改时间：2025-09-30
- 修改人：AI Assistant
- 影响版本：runtime spec_version: 101
- 兼容性：向后兼容，无破坏性变更
- 测试状态：Lint 通过 ✅，需要功能测试
