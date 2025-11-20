# Stardust 钱包接口快速参考

## 1. 余额查询（最常用）

### 查询可用余额
```typescript
const account = await api.query.system.account(address)
const { free, reserved, frozen } = account.data
const usable = free - Math.max(frozen, reserved)
```

**返回**: `{ free, reserved, frozen, nonce }`

---

## 2. 身份信息查询

### 获取昵称（显示名称）
```typescript
const identity = await api.query.identity.identityOf(address)
const displayName = identity?.info?.display?.asRaw 
  ? Buffer.from(identity.info.display.asRaw.toU8a()).toString('utf8')
  : '亲友'
```

**返回**: 字符串昵称或默认值 `'亲友'`

---

## 3. 推荐码查询

### 获取账户推荐码
```typescript
const code = await api.query.affiliate.codeByAccount(address)
const codeString = code?.isSome 
  ? Buffer.from(code.unwrap().toU8a()).toString('utf8')
  : ''
```

**返回**: 推荐码字符串或空字符串

### 查询推荐人
```typescript
const sponsor = await api.query.affiliate.sponsors(address)
```

**返回**: 推荐人账户地址或 None

### 查询活跃直推
```typescript
const count = await api.query.affiliate.directActiveCount(address)
```

**返回**: 活跃直推数量

---

## 4. 转账操作

### 标准转账（推荐）
```typescript
const tx = api.tx.balances.transfer(destAddress, amount)
const hash = await signAndSendLocalFromKeystore(tx, password)
```

**参数**:
- `destAddress`: 接收方地址
- `amount`: 转账金额（注意：12位小数）

**返回**: 交易哈希

### 保活转账（防止账户被清理）
```typescript
const tx = api.tx.balances.transfer_keep_alive(destAddress, amount)
```

### 转账全部余额
```typescript
const tx = api.tx.balances.transfer_all(destAddress, false)
```

---

## 5. 推荐码操作

### 绑定推荐人
```typescript
const codeBytes = new TextEncoder().encode(sponsorCode)
const tx = api.tx.affiliate.bindSponsor(codeBytes)
await signAndSendLocalFromKeystore(tx, password)
```

**检查**:
- 未被绑定过
- 推荐码存在且有效
- 账户是有效会员
- 不会形成循环

### 认领推荐码
```typescript
const codeBytes = new TextEncoder().encode(myCode)
const tx = api.tx.affiliate.claimCode(codeBytes)
await signAndSendLocalFromKeystore(tx, password)
```

**限制**:
- 长度: 3-20 字节
- 一个账户只能有一个推荐码
- 一个推荐码只能被一个账户拥有

---

## 6. 身份设置

### 设置昵称
```typescript
const info = {
  display: { isRaw: true, asRaw: encodeString('My Name') },
  legal: { isNone: true },
  web: { isNone: true },
  // ... 其他字段
}
const tx = api.tx.identity.setIdentity(info)
await signAndSendLocalFromKeystore(tx, password)
```

### 清除身份
```typescript
const tx = api.tx.identity.clearIdentity()
await signAndSendLocalFromKeystore(tx, password)
```

---

## 7. 系统信息查询

### 当前块号
```typescript
const blockNumber = await api.query.system.number()
const current = blockNumber.toNumber()
```

### 链信息
```typescript
const chainName = await api.rpc.system.chain()
const nodeName = await api.rpc.system.name()
const nodeVersion = await api.rpc.system.version()
```

### 账户 nonce（交易序列号）
```typescript
const account = await api.query.system.account(address)
const nonce = account.nonce.toNumber()
```

---

## 8. 前端最佳实践

### 并行查询多个数据
```typescript
const [balance, identity, refCode] = await Promise.all([
  queryFreeBalance(address),
  loadIdentityDisplay(address),
  loadReferralCode(address)
])
```

### 错误处理
```typescript
try {
  const result = await api.query.system.account(address)
  // 处理结果
} catch (error) {
  console.error('查询失败:', error)
  // 显示用户友好的错误信息
}
```

### 缓存策略（30秒过期）
```typescript
const cache = new Map()
const getBalance = async (address: string) => {
  const cached = cache.get(address)
  if (cached && Date.now() - cached.time < 30000) {
    return cached.data
  }
  const data = await queryFreeBalance(address)
  cache.set(address, { data, time: Date.now() })
  return data
}
```

---

## 常见错误及解决

| 错误 | 原因 | 解决 |
|-----|------|------|
| `InsufficientBalance` | 余额不足 | 检查 `free` 是否足够 |
| `ExistentialDeposit` | 余额过低 | 确保 > 最小值（通常 0.1 DUST） |
| `AlreadyBound` | 已绑定推荐人 | 一个账户只能绑定一次 |
| `CodeNotFound` | 推荐码无效 | 验证推荐码是否存在 |
| `ConnectionTimeout` | 节点无响应 | 检查 WebSocket 连接 |

---

## 关键数值

| 项目 | 值 | 说明 |
|-----|-----|------|
| **Token 小数位** | 12 | 1 DUST = 10^12 最小单位 |
| **Token 符号** | DUST | 主网标准代币 |
| **块时间** | 6 秒 | 平均出块间隔 |
| **周期块数** | 100,800 | 7 天的块数 |
| **身份押金** | 2.05 + 0.0205×字节 | 需要预留 |
| **子账户押金** | 0.205 | 每个子账户 |

---

## 完整工作流示例

```typescript
// 1. 初始化
const address = getCurrentAddress()
const api = await getApi()

// 2. 查询钱包信息
const account = await api.query.system.account(address)
const identity = await api.query.identity.identityOf(address)
const refCode = await api.query.affiliate.codeByAccount(address)

// 3. 验证转账可行性
const amount = BigInt(100) * BigInt(10 ** 12)  // 100 DUST
const usable = BigInt(account.data.free) - BigInt(account.data.frozen)
if (usable < amount) {
  throw new Error('余额不足')
}

// 4. 执行转账
const tx = api.tx.balances.transfer(destAddress, amount)
const hash = await signAndSendLocalFromKeystore(tx, password)

// 5. 返回结果
return {
  success: true,
  hash,
  blockNumber: (await api.query.system.number()).toNumber()
}
```

---

**维护者**: Stardust 开发团队  
**更新日期**: 2025-11-19
