# 做市商批准后仍显示待审核 - 错误逻辑深度分析

## 🔍 问题现象

- ✅ 批准成功：交易哈希 `0x088fce8b...`
- ❌ 前端显示：仍在"待审核"列表中
- ❓ 错误根源：前端 or 链端？

---

## 🧪 诊断脚本（请立即执行）

### 脚本 1：检查链上真实状态

**在浏览器控制台（F12）执行**：

```javascript
(async () => {
  try {
    console.log('=== 开始诊断 ===')
    
    // 1. 获取 API
    const api = window.polkadotApi
    if (!api) {
      console.error('❌ API 未初始化')
      return
    }
    
    // 2. 查询申请状态
    const mmId = 0  // ← 请替换为实际的 mmId
    const appOption = await api.query.marketMaker.applications(mmId)
    
    if (!appOption.isSome) {
      console.error('❌ 申请不存在，mmId:', mmId)
      return
    }
    
    // 3. 解析状态
    const app = appOption.unwrap()
    const appData = app.toJSON()
    
    console.log('=== 链上状态 ===')
    console.log('mmId:', mmId)
    console.log('status (原始):', appData.status)
    console.log('status (类型):', typeof appData.status)
    console.log('status (JSON):', JSON.stringify(appData.status))
    
    // 4. 判断状态
    const statusStr = JSON.stringify(appData.status).toLowerCase()
    
    if (statusStr.includes('active')) {
      console.log('✅ 链端正常：状态已变更为 Active')
      console.log('🐛 问题出在前端：刷新逻辑或筛选逻辑有误')
    } else if (statusStr.includes('pendingreview')) {
      console.log('❌ 链端异常：状态仍为 PendingReview')
      console.log('🐛 问题出在链端：approve 交易可能失败')
    } else {
      console.log('⚠️ 未知状态:', appData.status)
    }
    
    console.log('=== 诊断完成 ===')
    
  } catch (e) {
    console.error('❌ 诊断失败:', e)
  }
})()
```

---

## 📊 诊断结果分析

### 结果 A：链上状态已变更为 Active

**输出示例**：
```
status (原始): Active
status (类型): string
✅ 链端正常：状态已变更为 Active
🐛 问题出在前端：刷新逻辑或筛选逻辑有误
```

**错误原因**：🐛 **前端 BUG**

可能的具体原因：

#### 原因 1：刷新未触发（最可能）

**问题代码**：
```typescript
// 批准成功后
setTimeout(() => {
  loadPendingApplications()
}, 8000)
```

**验证**：
- 等待批准后的 8 秒，查看控制台
- 是否看到 `[审核页] 开始查询，NextId: X`
- 如果没有，说明刷新未触发

**可能原因**：
1. setTimeout 被清除
2. 组件卸载导致回调失效
3. JavaScript 异步问题

#### 原因 2：状态筛选逻辑错误（已修复但未生效）

**检查**：查看控制台日志
```
[审核页] ID=0, status= Active 类型: string
[审核页] ✗ ID=0 非待审状态，跳过  ← 应该看到这个
```

**如果没有看到**：
- 说明新版本前端未部署
- 需要重新构建：`npm run build`
- 需要清除浏览器缓存（Ctrl+Shift+R）

#### 原因 3：selectedApp 缓存（已修复但未生效）

**问题**：
- 列表已刷新（不包含已批准的申请）
- 但右侧详情区域仍显示旧的 selectedApp
- 用户看到的是缓存的"待审核"状态

**修复验证**：
- 批准后，右侧详情区域应该立即清空
- 如果仍显示，说明 `setSelectedApp(null)` 未生效

---

### 结果 B：链上状态仍为 PendingReview

**输出示例**：
```
status (原始): PendingReview
status (类型): string
❌ 链端异常：状态仍为 PendingReview
🐛 问题出在链端：approve 交易可能失败
```

**错误原因**：🐛 **链端 BUG 或交易失败**

#### 原因 1：权限不足（最可能）

**问题代码**：
```rust
pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
    ensure_root(origin)?;  // ← 这里要求 sudo 权限
    ...
}
```

**验证**：检查交易事件

```javascript
// 在控制台执行
(async () => {
  const api = window.polkadotApi
  const hash = '0x088fce8b3ffcf7978fbfe742f3c7be7325f914bcbaa24e168fc8019d772fd4b3'
  
  // 获取区块
  const block = await api.rpc.chain.getBlock(hash)
  const blockHash = block.block.header.hash
  
  // 查询事件
  const events = await api.query.system.events.at(blockHash)
  
  console.log('=== 交易事件 ===')
  events.forEach((record) => {
    const { event } = record
    console.log(`${event.section}.${event.method}:`, event.data.toHuman())
  })
})()
```

**预期输出（成功）**：
```
marketMaker.Approved: { mmId: '0' }
system.ExtrinsicSuccess: {...}
```

**实际输出（失败）**：
```
system.ExtrinsicFailed: {
  dispatchError: {
    module: { index: '45', error: '0x...' }
  }
}
```

**如果是权限问题**：
```
system.ExtrinsicFailed: { dispatchError: 'BadOrigin' }
```

**解决方案**：使用 sudo 包装

```typescript
// 修改前
await signAndSendLocalFromKeystore('marketMaker', 'approve', [mmId])

// 修改后（需要 sudo key）
await signAndSendLocalFromKeystore('sudo', 'sudo', [
  api.tx.marketMaker.approve(mmId)
])
```

#### 原因 2：状态检查失败

**可能情况**：
- 申请已经是 `Active` 状态（重复批准）
- 申请已经是 `Rejected` 状态
- 申请还是 `DepositLocked` 状态（未提交资料）

**验证**：
```javascript
const app = await api.query.marketMaker.applications(0)
const data = app.unwrap().toJSON()
console.log('当前状态:', data.status)
```

#### 原因 3：时间窗口过期

**问题代码**：
```rust
ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
```

**验证**：
```javascript
const app = await api.query.marketMaker.applications(0)
const data = app.unwrap().toJSON()

const now = Math.floor(Date.now() / 1000)
console.log('当前时间:', now)
console.log('审核截止:', data.reviewDeadline)
console.log('是否过期:', now > data.reviewDeadline)
```

---

## 🛠️ 完整修复方案

### 修复 1：添加自动刷新机制（前端）

**问题**：8 秒延迟可能不够稳定

**解决方案**：使用多次尝试 + 状态轮询

```typescript
const handleApprove = async (mmId: number) => {
  Modal.confirm({
    onOk: async () => {
      try {
        message.loading({ content: '正在签名并提交...', key: 'approve', duration: 0 })
        const hash = await signAndSendLocalFromKeystore('marketMaker', 'approve', [mmId])
        
        console.log('[批准] 交易哈希:', hash)
        
        message.success({ 
          content: `批准成功！交易哈希: ${hash}。正在等待区块确认...`, 
          key: 'approve', 
          duration: 0  // 不自动消失
        })
        
        // 立即清除选中状态
        setSelectedApp(null)
        
        // 轮询检查状态变更（最多 5 次，间隔 3 秒）
        let attempts = 0
        const maxAttempts = 5
        
        const checkAndRefresh = async () => {
          attempts++
          console.log(`[批准] 第 ${attempts} 次检查状态...`)
          
          try {
            // 查询链上状态
            const appOption = await (api.query as any).marketMaker.applications(mmId)
            if (appOption.isSome) {
              const app = appOption.unwrap()
              const appData = app.toJSON()
              
              console.log(`[批准] 当前状态:`, appData.status)
              
              // 检查是否已变更为 Active
              if (isActive(appData.status)) {
                console.log('✅ 状态已变更为 Active，刷新列表')
                
                message.success({ 
                  content: '批准已生效！列表已刷新', 
                  key: 'approve', 
                  duration: 3 
                })
                
                // 刷新两个列表
                loadPendingApplications()
                loadApprovedApplications()
                return // 成功，停止轮询
              }
            }
            
            // 状态未变更，继续轮询
            if (attempts < maxAttempts) {
              setTimeout(checkAndRefresh, 3000)  // 3 秒后再试
            } else {
              console.warn('⚠️ 达到最大尝试次数，状态可能未更新')
              message.warning({ 
                content: '批准成功但状态更新延迟，请手动刷新页面', 
                key: 'approve', 
                duration: 5 
              })
              // 仍然刷新列表
              loadPendingApplications()
              loadApprovedApplications()
            }
            
          } catch (e) {
            console.error('[批准] 状态检查失败:', e)
            // 发生错误时仍然刷新
            loadPendingApplications()
            loadApprovedApplications()
          }
        }
        
        // 首次检查延迟 6 秒（一个区块）
        setTimeout(checkAndRefresh, 6000)
        
      } catch (e: any) {
        console.error('[批准] 失败:', e)
        message.error({ content: '批准失败：' + (e?.message || ''), key: 'approve', duration: 5 })
      }
    }
  })
}
```

**好处**：
- ✅ 主动轮询状态，确保更新
- ✅ 最多尝试 5 次（15 秒）
- ✅ 状态确认后才提示成功
- ✅ 失败时有明确提示

### 修复 2：强制刷新机制（前端）

**添加"强制刷新"按钮**：

```typescript
<Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
  <Segmented ... />
  
  <Space style={{ width: '100%' }}>
    <Button 
      type="primary" 
      icon={<ReloadOutlined />}
      onClick={handleRefresh} 
      loading={loading}
      style={{ flex: 1 }}
    >
      {viewMode === 'pending' ? '刷新待审列表' : '刷新已批准列表'}
    </Button>
    
    <Button 
      icon={<ReloadOutlined />}
      onClick={() => {
        // 强制重新查询，清除所有缓存
        setSelectedApp(null)
        setPendingList([])
        setApprovedList([])
        if (viewMode === 'pending') {
          loadPendingApplications()
        } else {
          loadApprovedApplications()
        }
      }}
      loading={loading}
    >
      强制
    </Button>
  </Space>
</Space>
```

### 修复 3：检查是否使用了旧版前端

**问题**：
- 新版前端已修复
- 但用户仍在使用旧版（缓存或未重新部署）

**验证方法**：
1. **查看控制台日志**
   - 新版会输出：`[审核页] ID=0, status= Active`
   - 旧版不会有这些日志

2. **检查文件时间戳**
   ```bash
   ls -lh memopark-dapp/dist/assets/index-*.js
   # 查看文件修改时间是否是最新的
   ```

3. **清除浏览器缓存**
   - Chrome: Ctrl+Shift+R（硬刷新）
   - 或：开发者工具 > Network > Disable cache

---

## 🔧 最可能的错误逻辑

### 错误逻辑 1：刷新时机问题

**当前逻辑**：
```typescript
setTimeout(() => loadPendingApplications(), 8000)
```

**问题**：
- 固定延迟可能不够
- 区块生产时间可能波动
- 网络延迟可能影响查询

**正确逻辑**：
```typescript
// 方案 A：等待区块确认
await api.rpc.chain.subscribeNewHeads(async (header) => {
  // 等待 2 个新区块
  if (++blockCount >= 2) {
    unsubscribe()
    loadPendingApplications()
  }
})

// 方案 B：轮询状态（推荐）
const checkStatus = async () => {
  const app = await api.query.marketMaker.applications(mmId)
  const status = app.unwrap().toJSON().status
  
  if (isActive(status)) {
    // 状态已更新，刷新列表
    loadPendingApplications()
  } else {
    // 状态未更新，继续等待
    setTimeout(checkStatus, 3000)
  }
}
setTimeout(checkStatus, 6000)
```

### 错误逻辑 2：selectedApp 缓存

**当前逻辑**：
```typescript
// 批准后清除
setSelectedApp(null)

// 但用户仍能看到待审核状态
```

**可能问题**：
1. **列表项仍然存在**
   - 列表未刷新
   - 用户再次点击该项
   - selectedApp 被重新设置为旧数据

2. **React 状态更新延迟**
   - setSelectedApp(null) 还未生效
   - 用户立即看到详情

**正确逻辑**：
```typescript
// 批准后立即从列表中移除（乐观更新）
setPendingList(prev => prev.filter(item => item.mm_id !== mmId))
setSelectedApp(null)

// 然后延迟刷新确认
setTimeout(() => {
  loadPendingApplications()
  loadApprovedApplications()
}, 8000)
```

### 错误逻辑 3：状态判断不全（已修复但验证）

**当前逻辑**：
```typescript
const isPendingReview = (status: any): boolean => {
  if (status === 'PendingReview') return true
  if (status === 'pendingReview') return true
  if (status?.pendingReview !== undefined) return true
  if (status === 1) return true
  return false
}
```

**可能遗漏的格式**：
```typescript
// 可能的序列化格式：
// 1. { PendingReview: null }  ← 大写键
// 2. { pendingReview: null }  ← 小写键
// 3. { pendingReview: {} }    ← 空对象
// 4. "pending_review"         ← 蛇形命名
```

**完整逻辑**：
```typescript
const isPendingReview = (status: any): boolean => {
  // 字符串形式
  const statusStr = String(status).toLowerCase()
  if (statusStr.includes('pendingreview') || statusStr.includes('pending_review')) {
    return true
  }
  
  // 对象形式
  if (typeof status === 'object' && status !== null) {
    const keys = Object.keys(status).map(k => k.toLowerCase())
    if (keys.some(k => k.includes('pendingreview') || k.includes('pending'))) {
      return true
    }
  }
  
  // 数字形式
  if (status === 1) return true
  
  return false
}
```

---

## 🎯 立即执行的修复步骤

### 步骤 1：确认新版前端已部署

```bash
cd /home/xiaodong/文档/memopark/memopark-dapp

# 查看构建时间
ls -lh dist/assets/index-*.js

# 应该看到最新时间（今天）
```

### 步骤 2：清除浏览器缓存

```
方法 1：硬刷新
- Chrome: Ctrl+Shift+R
- Firefox: Ctrl+F5

方法 2：清除缓存
- F12 > Network 标签
- 勾选 "Disable cache"
- 刷新页面

方法 3：隐私模式
- 打开隐私窗口测试
```

### 步骤 3：执行诊断脚本

**在浏览器控制台执行**上面的"脚本 1"

### 步骤 4：根据诊断结果修复

- **链端正常** → 我为您提供前端修复代码
- **链端异常** → 我为您提供链端修复代码

---

## 📝 调试检查清单

请按顺序检查以下项目：

- [ ] 1. 执行诊断脚本，确认链上状态
- [ ] 2. 查看浏览器控制台是否有 `[审核页]` 开头的日志
- [ ] 3. 确认前端是最新版本（查看 dist 目录时间戳）
- [ ] 4. 清除浏览器缓存（Ctrl+Shift+R）
- [ ] 5. 批准后等待至少 10 秒
- [ ] 6. 手动点击"刷新待审列表"按钮
- [ ] 7. 切换到"已审核" Tab 查看

---

## 💡 临时解决方案（立即可用）

如果诊断后确认链端正常，最快的解决方案：

**手动刷新**：
1. 批准后等待 10 秒
2. 点击"刷新待审列表"按钮
3. 该申请应该消失
4. 切换到"已审核"查看

**如果仍然存在**：
1. 刷新浏览器页面（F5）
2. 重新访问 `#/gov/mm-review`
3. 查看是否更新

---

## 📞 请执行诊断并告诉我

请立即执行上面的**诊断脚本 1**，并将输出结果告诉我：

1. `status (原始):` 的值是什么？
2. 是 `Active` 还是 `PendingReview`？
3. 控制台是否有 `[审核页]` 开头的日志？

根据您的反馈，我将提供针对性的修复代码。
