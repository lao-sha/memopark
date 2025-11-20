# Stardust 链端与钱包功能接口完全分析

**文档版本**: v1.0  
**生成日期**: 2025-11-19  
**目标**: 为前端钱包页面设计提供详细的链端接口说明

---

## 目录

1. [1. 余额查询接口](#1-余额查询接口)
2. [2. 身份管理接口](#2-身份管理接口)
3. [3. 推荐码接口](#3-推荐码接口)
4. [4. 转账接口](#4-转账接口)
5. [5. 区块链数据查询](#5-区块链数据查询)
6. [6. 前端集成实例](#6-前端集成实例)

---

## 1. 余额查询接口

### 1.1 基础余额查询 - `system.account`

**Pallet**: `frame_system`  
**存储项**: `Account`  
**查询方法**: `api.query.system.account(address)`

#### 参数

| 参数名 | 类型 | 说明 |
|-------|------|------|
| address | `AccountId` | 32字节账户地址 |

#### 返回值结构

```typescript
{
  nonce: u32,              // 账户 nonce（交易序列号）
  consumers: u32,          // 消费者计数
  providers: u32,          // 提供者计数
  sufficients: u32,        // 足够计数
  data: {
    free: u128,           // 自由余额（无锁定、无保留）
    reserved: u128,       // 保留余额（被某些功能锁定）
    frozen: u128,         // 冻结余额（最大不可用余额）
    flags: u128           // 账户标志
  }
}
```

#### 具体字段说明

| 字段 | 类型 | 说明 | 用途 |
|-----|------|------|------|
| `free` | u128 | 自由可用余额 | **钱包显示的主要余额** |
| `reserved` | u128 | 预留金额 | 质押、身份存款等 |
| `frozen` | u128 | 冻结金额 | 不可用的最大金额 |
| `nonce` | u32 | 交易序列号 | 用于防重放 |

#### 实际可用余额计算

```typescript
// 可用于转账的余额 = free - max(frozen, reserved)
const usableBalance = free - Math.max(frozen, reserved)

// 完整净余额 = free - reserved
const totalNetBalance = free - reserved
```

#### 调用示例（前端代码）

```typescript
import { getApi } from './polkadot-safe'

async function getAccountBalance(address: string) {
  const api = await getApi()
  const accountInfo: any = await api.query.system.account(address)
  
  const free = BigInt(accountInfo?.data?.free?.toString?.() || '0')
  const reserved = BigInt(accountInfo?.data?.reserved?.toString?.() || '0')
  const frozen = BigInt(accountInfo?.data?.frozen?.toString?.() || '0')
  
  // 可用于转账的金额
  const usable = free - (frozen > reserved ? frozen : reserved)
  
  return {
    free: free.toString(),
    reserved: reserved.toString(),
    frozen: frozen.toString(),
    usable: usable.toString(),
    nonce: accountInfo.nonce
  }
}
```

#### 发出的事件

| 事件 | 参数 | 说明 |
|-----|------|------|
| `Endowed` | `{ account: AccountId, free_balance: Balance }` | 账户创建时发出 |
| `Transfer` | `{ from: AccountId, to: AccountId, amount: Balance }` | 转账完成 |
| `Withdraw` | `{ who: AccountId, amount: Balance }` | 提取手续费 |
| `Deposit` | `{ who: AccountId, amount: Balance }` | 存入奖励 |

---

### 1.2 balances 相关存储项

**Pallet**: `pallet_balances`

#### 存储项一览

| 存储项 | 类型 | 查询方法 | 说明 |
|-------|------|---------|------|
| `TotalIssuance` | `Balance` | `api.query.balances.totalIssuance()` | **总发行量** |
| `Account` | `StorageMap` | `api.query.balances.account(address)` | 账户余额数据 |
| `Locks` | `StorageMap` | `api.query.balances.locks(address)` | 账户锁定列表（已废弃，用Freezes替代） |
| `Reserves` | `StorageMap` | `api.query.balances.reserves(address)` | 账户保留列表（已废弃，用Holds替代） |
| `Holds` | `StorageMap` | `api.query.balances.holds(address)` | 账户持有项（新机制） |
| `Freezes` | `StorageMap` | `api.query.balances.freezes(address)` | 账户冻结列表（新机制） |

#### Holds 结构（持有项）

```typescript
interface IdAmount {
  id: RuntimeHoldReason,  // 持有原因（如:Governance, Democracy等）
  amount: Balance         // 持有金额
}
```

#### Freezes 结构（冻结项）

```typescript
interface IdAmount {
  id: FreezeIdentifier,   // 冻结原因
  amount: Balance         // 冻结金额
}
```

#### 查询示例

```typescript
// 查询总发行量
const totalIssuance = await api.query.balances.totalIssuance()
console.log('总发行量:', totalIssuance.toString())

// 查询账户锁定（仅作参考，已废弃）
const locks = await api.query.balances.locks(address)
console.log('锁定列表:', locks)

// 查询账户持有项（新机制）
const holds = await api.query.balances.holds(address)
holds.forEach(hold => {
  console.log(`持有原因: ${hold.id}, 金额: ${hold.amount.toString()}`)
})

// 查询账户冻结
const freezes = await api.query.balances.freezes(address)
freezes.forEach(freeze => {
  console.log(`冻结原因: ${freeze.id}, 金额: ${freeze.amount.toString()}`)
})
```

---

## 2. 身份管理接口

### 2.1 身份查询接口

**Pallet**: `pallet_identity`

#### 2.1.1 获取身份信息 - `identity.identityOf`

```typescript
api.query.identity.identityOf(address) → Registration
```

**返回结构**:

```typescript
interface Registration {
  info: IdentityInformation,           // 身份信息
  judgements: BoundedVec<Judgement>,   // 注册员判决列表
  deposit: Balance                      // 押金金额
}

interface IdentityInformation {
  display?: Data,    // 显示名称 ⭐️ 钱包使用
  legal?: Data,      // 法律名称
  web?: Data,        // 网址
  riot?: Data,       // Riot 用户名
  email?: Data,      // 电子邮件
  pgpFingerprint?: [u8; 20],  // PGP 指纹
  image?: Data,      // 头像
  twitter?: Data     // Twitter 用户名
}

enum Data {
  None,
  Raw(BoundedVec<u8, 32>),    // 原始字节
  BlakeTwo256([u8; 32]),       // 哈希值
  ShaThree256([u8; 32]),
  Keccak256([u8; 32]),
  ShaTwo256([u8; 32])
}
```

#### 前端解析示例

```typescript
/**
 * 函数级中文注释：从链上解析身份信息中的 display 字段
 * - 处理多种 Data 编码格式
 * - 返回 UTF-8 字符串或空字符串
 */
async function loadIdentityDisplay(address: string): Promise<string> {
  try {
    const api = await getApi()
    const raw = await (api.query as any).identity?.identityOf?.(address)
    
    if (!raw || !raw.isSome) {
      return '亲友'  // 默认显示名称
    }
    
    const reg = raw.unwrap()
    const disp = reg.info?.display
    
    if (!disp) return '亲友'
    
    let value = ''
    if (disp.isRaw) {
      value = Buffer.from(disp.asRaw.toU8a()).toString('utf8')
    } else if (disp.asBytes) {
      value = Buffer.from(disp.asBytes.toU8a()).toString('utf8')
    } else {
      value = String(disp.toString?.() || '')
    }
    
    return value || '亲友'
  } catch (error) {
    console.warn('加载身份信息失败:', error)
    return '亲友'
  }
}
```

#### 2.1.2 获取用户名 - `identity.usernameOf`

```typescript
api.query.identity.usernameOf(address) → Username
```

**说明**: 获取账户的主用户名

#### 2.1.3 子账户查询 - `identity.superOf` 和 `identity.subsOf`

```typescript
// 获取子账户的父账户
api.query.identity.superOf(subAddress) → (parentAddress, Data)

// 获取父账户的所有子账户
api.query.identity.subsOf(parentAddress) → (deposit, BoundedVec<subAddresses>)
```

---

### 2.2 身份设置接口（可调用方法）

**Pallet**: `pallet_identity`  
**权限**: Signed（任何签名用户）

#### 2.2.1 设置身份 - `identity.setIdentity`

```typescript
api.tx.identity.setIdentity(info: IdentityInformation)
```

**参数**:
- `info`: 身份信息对象

**权限检查**: 无特殊权限要求，但需要支付押金

**押金计算**:
```
deposit = basicDeposit + byteDeposit × encodedLength
- basicDeposit: 常量（通常 2.05 DUST）
- byteDeposit: 每字节费用（通常 0.0205 DUST/字节）
```

**发出事件**: `IdentitySet { who: AccountId }`

#### 2.2.2 清除身份 - `identity.clearIdentity`

```typescript
api.tx.identity.clearIdentity()
```

**说明**: 移除身份信息并退还押金  
**发出事件**: `IdentityCleared { who: AccountId, deposit: Balance }`

#### 2.2.3 设置子账户 - `identity.setSubs`

```typescript
api.tx.identity.setSubs(subs: Vec<(AccountId, Data)>)
```

**参数**:
- `subs`: 子账户列表，每个包含地址和昵称

**示例**:
```typescript
const subs = [
  [address1, { isRaw: true, asRaw: encodeString('child1') }],
  [address2, { isRaw: true, asRaw: encodeString('child2') }]
]
await signAndSendLocalFromKeystore(api.tx.identity.setSubs(subs))
```

#### 2.2.4 添加子账户 - `identity.addSub`

```typescript
api.tx.identity.addSub(sub: AccountId, name: Data)
```

#### 2.2.5 移除子账户 - `identity.removeSub`

```typescript
api.tx.identity.removeSub(sub: AccountId)
```

---

## 3. 推荐码接口

### 3.1 推荐码查询接口

**Pallet**: `pallet_affiliate`（已整合联盟计酬系统）

#### 3.1.1 账户推荐码 - `affiliate.codeByAccount`

```typescript
api.query.affiliate.codeByAccount(address) → BoundedVec<u8>
```

**说明**: 查询账户拥有的推荐码  
**返回**: UTF-8 编码的推荐码字符串

**前端使用示例**:

```typescript
/**
 * 函数级中文注释：加载当前账户的推荐码
 * - 查询 affiliate.codeByAccount 存储项
 * - 转换为 UTF-8 字符串
 * - 如果不存在则返回空字符串
 */
async function loadReferralCode(address: string): Promise<string> {
  try {
    const api = await getApi()
    const qroot: any = api.query as any
    const sec = qroot.affiliate
    
    if (!sec || !sec.codeByAccount) {
      return ''
    }
    
    const raw = await sec.codeByAccount(address)
    
    if (raw && raw.isSome) {
      const v = raw.unwrap()
      const code = Buffer.from(v.toU8a()).toString('utf8')
      return code
    }
    
    return ''
  } catch (error) {
    console.warn('加载推荐码失败:', error)
    return ''
  }
}
```

#### 3.1.2 推荐码查询账户 - `affiliate.accountByCode`

```typescript
api.query.affiliate.accountByCode(code: Vec<u8>) → AccountId
```

**说明**: 根据推荐码反查账户  
**用途**: 验证推荐码是否有效，获取推荐人账户

#### 3.1.3 推荐人查询 - `affiliate.sponsors`

```typescript
api.query.affiliate.sponsors(address) → AccountId
```

**说明**: 查询账户的推荐人  
**返回**: 推荐人账户地址（若无则为 None）

#### 3.1.4 直推活跃数 - `affiliate.directActiveCount`

```typescript
api.query.affiliate.directActiveCount(address) → u32
```

**说明**: 查询账户的活跃直推数量  
**用途**: 确定账户在联盟链中的活跃度

---

### 3.2 推荐码操作接口（可调用方法）

**Pallet**: `pallet_affiliate`

#### 3.2.1 绑定推荐人 - `affiliate.bindSponsor`

```typescript
api.tx.affiliate.bindSponsor(sponsor_code: Vec<u8>) → DispatchResult
```

**参数**:
- `sponsor_code`: 推荐人的推荐码（字节数组）

**权限**: Signed（任何签名用户，但必须是有效会员）

**检查**:
1. 账户未被绑定过（AlreadyBound）
2. 推荐码存在（CodeNotFound）
3. 不能绑定自己（CannotBindSelf）
4. 不会形成循环推荐（WouldCreateCycle）
5. 账户必须是有效会员（NotMember）

**发出事件**: 
```
SponsorBound { who: AccountId, sponsor: AccountId }
```

**前端调用示例**:

```typescript
async function bindReferralCode(code: string, userPassword: string) {
  try {
    const api = await getApi()
    const codeBytes = new TextEncoder().encode(code)
    
    const tx = api.tx.affiliate.bindSponsor(codeBytes)
    const result = await signAndSendLocalFromKeystore(tx, userPassword)
    
    return {
      success: true,
      blockHash: result,
      message: '推荐人绑定成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '绑定失败'
    }
  }
}
```

#### 3.2.2 认领推荐码 - `affiliate.claimCode`

```typescript
api.tx.affiliate.claimCode(code: Vec<u8>) → DispatchResult
```

**参数**:
- `code`: 要认领的推荐码（字节数组）

**权限**: Signed（任何签名用户）

**检查**:
1. 推荐码长度 3-20 字节（CodeTooShort / CodeTooLong）
2. 推荐码未被占用（CodeAlreadyTaken）
3. 账户未拥有推荐码（AlreadyHasCode）

**发出事件**:
```
CodeClaimed { who: AccountId, code: BoundedVec<u8> }
```

**业务逻辑**:
- 一个账户只能拥有一个推荐码
- 一个推荐码只能被一个账户拥有
- 推荐码是账户进行联盟营销的凭证

---

## 4. 转账接口

### 4.1 转账方法一览

**Pallet**: `pallet_balances`

| 方法名 | 参数 | 说明 | 何时使用 |
|-------|------|------|---------|
| `transfer` | `(dest, amount)` | 标准转账 | ⭐️ **推荐** |
| `transfer_keep_alive` | `(dest, amount)` | 保持账户活跃转账 | 防止账户被清理 |
| `transfer_all` | `(dest, keep_alive)` | 转账全部余额 | 账户清空/迁移 |
| `force_transfer` | `(src, dest, amount)` | 强制转账（Root权限） | 管理员操作 |

---

### 4.2 标准转账 - `balances.transfer`

```typescript
api.tx.balances.transfer(dest: AccountId, amount: Balance)
```

**参数**:
| 参数 | 类型 | 说明 |
|-----|------|------|
| `dest` | `AccountId` | 接收方地址 |
| `amount` | `Balance` | 转账金额（带 12 位小数） |

**权限**: Signed（任何签名用户）

**前置条件**:
1. 账户有足够的自由余额（InsufficientBalance）
2. 转账不会导致账户低于存在值（ExistentialDeposit）
3. 账户未被冻结或受限制（LiquidityRestrictions）

**发出事件**:
```
Transfer { 
  from: AccountId, 
  to: AccountId, 
  amount: Balance 
}
```

**费用计算**:
```
交易费 = baseWeight × perByteWeight + 转账金额的 0.01%（取整后）
```

**前端实现示例**:

```typescript
/**
 * 函数级中文注释：执行转账交易
 * - 构造转账 extrinsic
 * - 使用密钥库签名
 * - 监听交易状态
 * - 返回交易哈希或错误信息
 */
async function executeTransfer(
  destinationAddress: string,
  amountInDust: string,
  userPassword: string
) {
  try {
    // 1. 验证地址格式
    if (!destinationAddress.match(/^(0x)?[0-9a-f]{64}$/i)) {
      throw new Error('目标地址格式无效')
    }
    
    // 2. 验证金额
    const amount = BigInt(amountInDust) * BigInt(10 ** 12)  // 转换为最小单位
    if (amount <= 0) {
      throw new Error('转账金额必须大于 0')
    }
    
    // 3. 获取 API 实例
    const api = await getApi()
    
    // 4. 查询发送者余额
    const balance = await queryFreeBalance(getCurrentAddress())
    const free = BigInt(balance.free)
    if (free < amount) {
      throw new Error(`余额不足。可用: ${balance.formatted} DUST`)
    }
    
    // 5. 构造转账交易
    const tx = api.tx.balances.transfer(destinationAddress, amount)
    
    // 6. 签名和发送
    const hash = await signAndSendLocalFromKeystore(tx, userPassword)
    
    return {
      success: true,
      hash,
      message: `转账成功，交易哈希: ${hash}`
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '转账失败'
    }
  }
}
```

---

### 4.3 保活转账 - `balances.transfer_keep_alive`

```typescript
api.tx.balances.transfer_keep_alive(dest: AccountId, amount: Balance)
```

**说明**: 确保发送者账户在转账后保持活跃状态（不低于 ED）

**区别于 `transfer`**:
- `transfer`: 可以将账户余额转至 0，账户可能被清理
- `transfer_keep_alive`: 保证发送者账户余额 > ExistentialDeposit

**错误**: `Expendability` - 转账会导致账户被清理

---

### 4.4 转账全部 - `balances.transfer_all`

```typescript
api.tx.balances.transfer_all(dest: AccountId, keep_alive: bool)
```

**参数**:
| 参数 | 类型 | 说明 |
|-----|------|------|
| `dest` | `AccountId` | 接收方地址 |
| `keep_alive` | `bool` | 是否保持发送者账户活跃 |

**用途**: 账户清空/迁移  
**区别**: 自动转账所有自由余额，无需手动计算

---

## 5. 区块链数据查询

### 5.1 系统信息查询

#### 5.1.1 当前块号 - `system.number`

```typescript
const blockNumber = await api.query.system.number()
console.log('当前块号:', blockNumber.toNumber())
```

#### 5.1.2 当前块哈希 - `system.blockHash`

```typescript
const blockHash = await api.query.system.blockHash(blockNumber)
console.log('块哈希:', blockHash.toHex())
```

#### 5.1.3 链信息 - 通过 RPC

```typescript
// 获取节点版本
const chainName = await api.rpc.system.chain()
const nodeName = await api.rpc.system.name()
const nodeVersion = await api.rpc.system.version()

console.log(`链名称: ${chainName}`)
console.log(`节点: ${nodeName} v${nodeVersion}`)
```

### 5.2 账户相关查询

#### 5.2.1 账户 nonce

```typescript
const account = await api.query.system.account(address)
const nonce = account.nonce
```

**说明**: 账户交易序列号，每次交易递增 1

#### 5.2.2 账户活跃度

```typescript
// 检查账户是否存在（providers > 0）
const account = await api.query.system.account(address)
const isActive = account.providers > 0
```

---

### 5.3 联盟计酬数据查询

**Pallet**: `pallet_affiliate`

#### 5.3.1 配置查询

```typescript
// 结算模式
const mode = await api.query.affiliate.settlementMode()

// 即时分成比例（15层）
const instantPercents = await api.query.affiliate.instantPercents()

// 周结算分成比例（15层）
const weeklyPercents = await api.query.affiliate.weeklyPercents()

// 每周区块数
const blocksPerWeek = await api.query.affiliate.blocksPerWeek()
```

#### 5.3.2 应得金额查询

```typescript
const cycle = 100  // 周期编号
const amount = await api.query.affiliate.entitlement(cycle, address)
console.log('应得金额:', amount.toString())
```

#### 5.3.3 活跃期查询

```typescript
const activeUntilWeek = await api.query.affiliate.activeUntilWeek(address)
console.log('活跃至第', activeUntilWeek, '周')
```

---

### 5.4 身份数据查询

#### 5.4.1 注册员信息

```typescript
const registrars = await api.query.identity.registrars()
registrars.forEach((registrar, index) => {
  if (registrar.isSome) {
    const info = registrar.unwrap()
    console.log(`注册员 #${index}:`, {
      account: info.account,
      fee: info.fee.toString(),
      fields: info.fields
    })
  }
})
```

#### 5.4.2 用户名权限

```typescript
const authority = await api.query.identity.authorityOf(suffix)
if (authority.isSome) {
  const props = authority.unwrap()
  console.log(`权限所有者: ${props.account}`)
}
```

---

## 6. 前端集成实例

### 6.1 完整的钱包页面初始化流程

```typescript
/**
 * 函数级中文注释：我的钱包页面完整初始化流程
 * 
 * 流程:
 * 1. 加载当前地址
 * 2. 并行查询：余额、身份、推荐码
 * 3. 更新 UI 状态
 */
export const MyWalletPageLogic = () => {
  const [walletData, setWalletData] = useState({
    address: '',
    balance: { free: '0', formatted: '0' },
    nickname: '亲友',
    refCode: '',
    nonce: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeWallet()
  }, [])

  const initializeWallet = async () => {
    try {
      setLoading(true)
      const address = getCurrentAddress()
      
      if (!address) {
        throw new Error('未找到钱包地址')
      }

      // 并行加载所有数据
      const [balanceData, nickname, refCode] = await Promise.all([
        getAccountBalance(address),
        loadIdentityDisplay(address),
        loadReferralCode(address)
      ])

      setWalletData({
        address,
        balance: balanceData,
        nickname,
        refCode,
        nonce: balanceData.nonce || 0
      })
    } catch (error) {
      console.error('钱包初始化失败:', error)
      // 显示错误提示
    } finally {
      setLoading(false)
    }
  }

  return { walletData, loading, refresh: initializeWallet }
}
```

### 6.2 钱包页面 UI 组件示例

```typescript
interface WalletDisplayProps {
  address: string
  balance: { free: string; formatted: string }
  nickname: string
  refCode: string
}

/**
 * 函数级中文注释：钱包信息展示组件
 * - 地址显示（可复制）
 * - 余额展示
 * - 昵称/推荐码展示
 * - 操作按钮（转账、编辑等）
 */
const WalletDisplay: React.FC<WalletDisplayProps> = ({
  address,
  balance,
  nickname,
  refCode
}) => {
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address)
    message.success('地址已复制')
  }

  const handleCopyRefCode = () => {
    if (refCode) {
      navigator.clipboard.writeText(refCode)
      message.success('推荐码已复制')
    }
  }

  return (
    <div className="wallet-card">
      {/* 钱包地址 */}
      <Card title="钱包地址">
        <Text copyable onCopy={handleCopyAddress}>
          {address.substring(0, 10)}...{address.substring(address.length - 10)}
        </Text>
      </Card>

      {/* 余额显示 */}
      <Card title="账户余额">
        <Statistic
          title="可用余额"
          value={balance.formatted}
          suffix="DUST"
          precision={2}
        />
      </Card>

      {/* 身份信息 */}
      <Card title="身份信息">
        <Descriptions>
          <Descriptions.Item label="昵称">
            {nickname}
          </Descriptions.Item>
          <Descriptions.Item label="推荐码">
            {refCode ? (
              <>
                <Text code>{refCode}</Text>
                <Button 
                  type="text" 
                  icon={<CopyOutlined />}
                  onClick={handleCopyRefCode}
                  size="small"
                />
              </>
            ) : (
              <span>未设置</span>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 操作按钮 */}
      <div className="action-buttons">
        <Button type="primary" icon={<SendOutlined />}>
          转账
        </Button>
        <Button icon={<EditOutlined />}>
          编辑信息
        </Button>
        <Button icon={<HistoryOutlined />}>
          交易历史
        </Button>
      </div>
    </div>
  )
}
```

---

## 7. 错误处理与常见问题

### 7.1 常见错误代码

| 错误 | Pallet | 说明 | 解决方案 |
|-----|-------|------|---------|
| `InsufficientBalance` | balances | 余额不足 | 确保有足够的自由余额 |
| `ExistentialDeposit` | balances | 低于存在值 | 转账前检查余额 > ED |
| `AlreadyBound` | affiliate | 已绑定推荐人 | 无法二次绑定 |
| `CodeNotFound` | affiliate | 推荐码不存在 | 验证推荐码的有效性 |
| `TooManySubAccounts` | identity | 子账户过多 | 超过 MaxSubAccounts 限制 |

### 7.2 常见调试技巧

```typescript
// 1. 检查链连接
const api = await getApi()
console.log('API 连接状态:', api.isConnected)
console.log('链名称:', api.runtimeChain.toString())

// 2. 检查存储项是否存在
const account = await api.query.system.account(address)
console.log('存储项类型:', account.constructor.name)

// 3. 打印完整的账户数据
const account: any = await api.query.system.account(address)
console.log('完整账户数据:', JSON.stringify({
  free: account.data.free.toString(),
  reserved: account.data.reserved.toString(),
  frozen: account.data.frozen.toString(),
  nonce: account.nonce.toNumber()
}, null, 2))

// 4. 查看错误详情
try {
  await tx.signAndSend(...)
} catch (error: any) {
  console.log('详细错误:', {
    message: error.message,
    method: error.method,
    section: error.section,
    docs: error.docs
  })
}
```

---

## 8. 性能优化建议

### 8.1 查询优化

```typescript
// ❌ 不推荐：逐个查询
for (let i = 0; i < addresses.length; i++) {
  const balance = await api.query.system.account(addresses[i])
  console.log(balance)
}

// ✅ 推荐：批量查询
const balances = await Promise.all(
  addresses.map(addr => api.query.system.account(addr))
)
```

### 8.2 缓存策略

```typescript
// 使用本地状态缓存减少链查询
const [balanceCache, setBalanceCache] = useState<Map<string, Balance>>(new Map())
const [lastUpdate, setLastUpdate] = useState<number>(0)

const getCachedBalance = async (address: string) => {
  const now = Date.now()
  
  // 缓存有效期：30 秒
  if (balanceCache.has(address) && (now - lastUpdate) < 30_000) {
    return balanceCache.get(address)
  }
  
  const balance = await queryFreeBalance(address)
  setBalanceCache(new Map(balanceCache).set(address, balance))
  setLastUpdate(now)
  
  return balance
}
```

### 8.3 订阅优化

```typescript
// 使用订阅而非轮询
let unsubscribe: (() => void) | null = null

const subscribeToBalance = async (address: string, callback: (balance: any) => void) => {
  const api = await getApi()
  
  unsubscribe = await (api.query.system.account as any)(address, (account: any) => {
    callback(account.data)
  })
}

// 清理订阅
const cleanup = () => {
  if (unsubscribe) unsubscribe()
}
```

---

## 总结

本文档完整列举了 Stardust 链上与钱包功能相关的所有主要接口：

| 类别 | 主要接口 | 关键 Pallet |
|-----|---------|----------|
| **余额查询** | `system.account`, `balances.*` | frame_system, pallet_balances |
| **身份管理** | `identity.identityOf`, `identity.setSubs` | pallet_identity |
| **推荐码** | `affiliate.codeByAccount`, `affiliate.bindSponsor` | pallet_affiliate |
| **转账** | `balances.transfer*` | pallet_balances |
| **数据查询** | `system.*`, `affiliate.*`, `identity.*` | 多个 pallet |

所有接口都包含了参数说明、返回值格式、前端调用示例和错误处理方案。

---

**维护者**: Stardust 开发团队  
**上次更新**: 2025-11-19  
**规范版本**: v1.0
