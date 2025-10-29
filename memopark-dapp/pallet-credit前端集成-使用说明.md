# pallet-credit 前端集成 - 使用说明

**创建日期**: 2025-10-28  
**技术栈**: React 18 + TypeScript + Ant Design 5 + Polkadot.js  
**状态**: ✅ 已完成核心功能集成

---

## 📋 目录

1. [功能概述](#功能概述)
2. [文件结构](#文件结构)
3. [核心服务层](#核心服务层)
4. [UI组件](#ui组件)
5. [集成方式](#集成方式)
6. [使用示例](#使用示例)
7. [API参考](#api参考)
8. [常见问题](#常见问题)

---

## 功能概述

### 已集成功能 ✅

#### 买家信用系统
- ✅ 信用等级显示（Newbie/Bronze/Silver/Gold/Diamond）
- ✅ 风险分查询和可视化
- ✅ 交易限额显示（单笔/每日）
- ✅ 今日已用额度追踪
- ✅ 订单统计展示
- ✅ 信任度计算和显示
- ✅ 新用户等级展示

#### 做市商信用系统
- ✅ 信用等级显示（Diamond/Platinum/Gold/Silver/Bronze）
- ✅ 服务状态查询（Active/Warning/Suspended）
- ✅ 信用分查询和展示
- ✅ 订单统计（总订单/完成/超时/违约）
- ✅ 动态保证金计算
- ✅ 履约率和及时释放率
- ✅ 买家评价功能（1-5星 + 标签）

### 待扩展功能 ⏳

- ⏳ 买家信用完整仪表板页面
- ⏳ 做市商信用完整仪表板页面
- ⏳ 信用历史记录时间线
- ⏳ 推荐用户功能
- ⏳ 设置邀请人功能
- ⏳ 信用报告导出

---

## 文件结构

```
memopark-dapp/src/
├── services/
│   └── creditService.ts          # 统一信用服务（买家+做市商）
├── components/
│   ├── credit/
│   │   ├── BuyerCreditCard.tsx   # 买家信用卡片组件
│   │   └── RateMakerModal.tsx    # 评价做市商模态框
│   └── MakerCreditBadge.tsx      # 做市商信用徽章（已存在）
└── features/
    └── credit/                     # 预留：完整信用页面
        ├── BuyerCreditDashboard.tsx
        └── MakerCreditDashboard.tsx
```

---

## 核心服务层

### creditService.ts

**位置**: `src/services/creditService.ts`

#### 主要类型定义

```typescript
// 买家信用记录
export interface BuyerCreditRecord {
  level: BuyerCreditLevel;          // 信用等级
  newUserTier: NewUserTier | null;  // 新用户等级
  completedOrders: number;          // 完成订单数
  totalVolume: string;              // 累计购买金额
  defaultCount: number;             // 违约次数
  disputeCount: number;             // 争议次数
  lastPurchaseAt: number;           // 上次购买时间
  riskScore: number;                // 风险分（0-1000）
  accountCreatedAt: number;         // 账户创建时间
}

// 买家信用详情
export interface BuyerCreditDetail {
  credit: BuyerCreditRecord;        // 基础信用记录
  singleLimit: number;              // 单笔限额（USDT）
  dailyLimit: number;               // 每日限额（USDT）
  cooldownHours: number;            // 冷却期（小时）
  todayUsed: number;                // 今日已用额度
  orderHistory: BuyerOrderRecord[]; // 订单历史
  referrer: string | null;          // 推荐人
  endorsements: BuyerEndorsement[]; // 背书记录
  trustBreakdown: {                 // 信任分组成
    asset: number;
    age: number;
    activity: number;
    social: number;
    identity: number;
  };
}

// 做市商信用记录
export interface MakerCreditRecord {
  makerId: number;                  // 做市商ID
  creditScore: number;              // 信用分（800-1000）
  level: MakerCreditLevel;          // 信用等级
  status: ServiceStatus;            // 服务状态
  totalOrders: number;              // 总订单数
  completedOrders: number;          // 完成订单数
  timeoutOrders: number;            // 超时订单数
  cancelledOrders: number;          // 取消订单数
  timelyReleaseOrders: number;      // 及时释放订单数
  ratingSum: number;                // 评分总和
  ratingCount: number;              // 评分次数
  avgResponseTime: number;          // 平均响应时间
  defaultCount: number;             // 违约次数
  disputeLossCount: number;         // 争议失败次数
  lastDefaultBlock: number | null;  // 最后违约区块
  lastOrderBlock: number;           // 最后订单区块
  consecutiveDays: number;          // 连续服务天数
}

// 做市商信用详情
export interface MakerCreditDetail {
  credit: MakerCreditRecord;        // 基础信用记录
  requiredDeposit: string;          // 动态保证金（MEMO）
  depositDiscount: number;          // 保证金折扣（%）
  completionRate: number;           // 履约率（%）
  timelyReleaseRate: number;        // 及时释放率（%）
  avgRating: number;                // 平均评分（1-5）
  defaultRate: number;              // 违约率（%）
  canAcceptOrders: boolean;         // 是否可接单
}
```

#### 主要函数

##### 买家信用查询

```typescript
/**
 * 查询买家信用记录
 * @param api - Polkadot.js API 实例
 * @param account - 买家账户地址
 * @returns 买家信用记录（如果不存在返回 null）
 */
export async function getBuyerCredit(
  api: ApiPromise,
  account: string
): Promise<BuyerCreditRecord | null>

/**
 * 查询买家完整信用详情
 * @param api - Polkadot.js API 实例
 * @param account - 买家账户地址
 * @param currentBlockNumber - 当前区块号
 * @returns 买家信用详情
 */
export async function getBuyerCreditDetail(
  api: ApiPromise,
  account: string,
  currentBlockNumber: number
): Promise<BuyerCreditDetail | null>
```

##### 做市商信用查询

```typescript
/**
 * 查询做市商信用记录
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 做市商信用记录（如果不存在返回 null）
 */
export async function getMakerCredit(
  api: ApiPromise,
  makerId: number
): Promise<MakerCreditRecord | null>

/**
 * 查询做市商完整信用详情
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 做市商信用详情
 */
export async function getMakerCreditDetail(
  api: ApiPromise,
  makerId: number
): Promise<MakerCreditDetail | null>

/**
 * 查询做市商评价记录
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param orderId - 订单 ID
 * @returns 评价记录（如果不存在返回 null）
 */
export async function getMakerRating(
  api: ApiPromise,
  makerId: number,
  orderId: number
): Promise<MakerRating | null>
```

##### 显示信息辅助函数

```typescript
// 获取买家信用等级显示信息
export function getBuyerLevelInfo(level: BuyerCreditLevel)

// 获取做市商信用等级显示信息
export function getMakerLevelInfo(level: MakerCreditLevel)

// 获取服务状态显示信息
export function getServiceStatusInfo(status: ServiceStatus)

// 获取评价标签名称
export function getRatingTagName(tagCode: number): string

// 获取违约类型名称
export function getDefaultTypeName(type: DefaultType): string
```

---

## UI组件

### 1. BuyerCreditCard (买家信用卡片)

**位置**: `src/components/credit/BuyerCreditCard.tsx`

**功能**:
- 显示买家信用等级和风险分
- 显示交易限额（单笔/每日）
- 显示今日已用额度
- 显示订单统计
- 显示信任度评分

**Props**:
```typescript
interface BuyerCreditCardProps {
  account: string;      // 买家账户地址
  detailed?: boolean;   // 是否显示详细信息（默认 true）
  showLink?: boolean;   // 是否显示查看详情链接（默认 false）
}
```

**使用示例**:
```tsx
import { BuyerCreditCard } from '../components/credit/BuyerCreditCard'

// 在个人资料页面显示
<BuyerCreditCard 
  account={currentAccount.address} 
  detailed={true}
  showLink={true}
/>
```

**显示效果**:
- 顶部：等级徽章 + 信用分
- 风险评分条（颜色根据风险等级变化）
- 交易限额卡片
- 今日已用额度进度条
- 统计数据（完成订单/违约次数/信任度）

### 2. RateMakerModal (评价做市商模态框)

**位置**: `src/components/credit/RateMakerModal.tsx`

**功能**:
- 买家评价做市商服务质量
- 1-5星评分
- 选择评价标签（最多5个）
- 提交评价到链上
- 实时显示信用分影响

**Props**:
```typescript
interface RateMakerModalProps {
  visible: boolean;        // 是否显示
  makerId: number;        // 做市商ID
  orderId: number;        // 订单ID
  makerName?: string;     // 做市商名称
  onClose: () => void;    // 关闭回调
  onSuccess?: () => void; // 评价成功回调
}
```

**使用示例**:
```tsx
import { RateMakerModal } from '../components/credit/RateMakerModal'

const [showRateModal, setShowRateModal] = useState(false)

// 在订单详情页面，订单完成后显示评价按钮
{order.state === 'Released' && !hasRated && (
  <Button onClick={() => setShowRateModal(true)}>
    评价做市商
  </Button>
)}

<RateMakerModal
  visible={showRateModal}
  makerId={order.makerId}
  orderId={order.id}
  makerName="做市商A"
  onClose={() => setShowRateModal(false)}
  onSuccess={() => {
    message.success('评价提交成功')
    loadOrderDetail()
  }}
/>
```

**评价标签**:
- 正面标签：快速释放、沟通良好、价格合理
- 负面标签：释放慢、沟通差、不回应

**信用分影响**:
- 5星：+5分
- 4星：+2分
- 3星：0分
- 2星：-5分
- 1星：-5分

### 3. MakerCreditBadge (做市商信用徽章) ✅ 已存在

**位置**: `src/components/MakerCreditBadge.tsx`

**需要更新**: 将查询从 `makerCredit` 更改为 `credit` pallet

**更新方法**:
```typescript
// 旧代码
const creditData = await api.query.makerCredit.credits(makerId);

// 新代码
const creditData = await api.query.credit.makerCredits(makerId);
```

**功能**:
- 简洁显示做市商信用等级
- Tooltip 显示详细信息
- 支持链接到完整信用页面

**使用示例**:
```tsx
import { MakerCreditBadge } from '../components/MakerCreditBadge'

// 在做市商列表中显示
<MakerCreditBadge 
  makerId={maker.id} 
  detailed={false}
  showLink={true}
/>
```

---

## 集成方式

### 1. 在个人资料页面显示买家信用

**文件**: `src/features/profile/ProfilePage.tsx`

```tsx
import { BuyerCreditCard } from '../../components/credit/BuyerCreditCard'

export const ProfilePage = () => {
  const { currentAccount } = useWallet()

  return (
    <div>
      <Title level={2}>我的信用</Title>
      
      {currentAccount && (
        <BuyerCreditCard 
          account={currentAccount.address}
          detailed={true}
          showLink={true}
        />
      )}
    </div>
  )
}
```

### 2. 在OTC订单页面集成评价功能

**文件**: `src/features/otc/OrderDetailPage.tsx`

```tsx
import { RateMakerModal } from '../../components/credit/RateMakerModal'

export const OrderDetailPage = () => {
  const [showRateModal, setShowRateModal] = useState(false)
  const [hasRated, setHasRated] = useState(false)

  // 检查是否已评价
  useEffect(() => {
    const checkRating = async () => {
      const api = await getApi()
      const rating = await getMakerRating(api, order.makerId, order.id)
      setHasRated(!!rating)
    }
    checkRating()
  }, [order])

  return (
    <div>
      {/* 订单详情 */}
      
      {/* 评价按钮（订单完成且未评价） */}
      {order.state === 'Released' && !hasRated && (
        <Button 
          type="primary" 
          onClick={() => setShowRateModal(true)}
        >
          评价做市商
        </Button>
      )}

      {/* 评价模态框 */}
      <RateMakerModal
        visible={showRateModal}
        makerId={order.makerId}
        orderId={order.id}
        onClose={() => setShowRateModal(false)}
        onSuccess={() => {
          setHasRated(true)
          // 刷新订单详情
        }}
      />
    </div>
  )
}
```

### 3. 在做市商列表显示信用徽章

**文件**: `src/features/market-maker/MakerListPage.tsx`

```tsx
import { MakerCreditBadge } from '../../components/MakerCreditBadge'

export const MakerListPage = () => {
  return (
    <List
      dataSource={makers}
      renderItem={maker => (
        <List.Item>
          <Space>
            <span>{maker.name}</span>
            <MakerCreditBadge 
              makerId={maker.id}
              showLink={true}
            />
          </Space>
        </List.Item>
      )}
    />
  )
}
```

---

## 使用示例

### 示例 1: 查询买家信用并显示限额

```typescript
import { getBuyerCreditDetail } from '../services/creditService'
import { getApi } from '../lib/polkadot-safe'

async function checkBuyerLimit(account: string, orderAmount: number) {
  const api = await getApi()
  const header = await api.rpc.chain.getHeader()
  const currentBlock = header.number.toNumber()
  
  const detail = await getBuyerCreditDetail(api, account, currentBlock)
  
  if (!detail) {
    console.log('新用户，暂无信用记录')
    return false
  }
  
  // 检查单笔限额
  if (orderAmount > detail.singleLimit) {
    message.error(`订单金额超过单笔限额 $${detail.singleLimit}`)
    return false
  }
  
  // 检查每日限额
  if (detail.dailyLimit > 0 && (detail.todayUsed + orderAmount) > detail.dailyLimit) {
    message.error(`超过每日限额 $${detail.dailyLimit}`)
    return false
  }
  
  return true
}
```

### 示例 2: 查询做市商信用并判断是否可接单

```typescript
import { getMakerCreditDetail } from '../services/creditService'

async function canMakerAcceptOrders(makerId: number): Promise<boolean> {
  const api = await getApi()
  const detail = await getMakerCreditDetail(api, makerId)
  
  if (!detail) {
    console.log('做市商未初始化信用记录')
    return false
  }
  
  if (detail.credit.status === 'Suspended') {
    message.warning('该做市商服务已暂停（信用分 < 750）')
    return false
  }
  
  if (detail.credit.status === 'Warning') {
    message.warning('该做市商处于警告状态（信用分 750-799）')
  }
  
  return detail.canAcceptOrders
}
```

### 示例 3: 提交评价并更新UI

```typescript
import { message } from 'antd'

async function rateMaker(
  makerId: number, 
  orderId: number, 
  stars: number, 
  tags: number[]
) {
  try {
    const api = await getApi()
    const { currentAccount } = useWallet()
    
    const tx = api.tx.credit.rateMaker(makerId, orderId, stars, tags)
    
    await tx.signAndSend(currentAccount.address, ({ status, events }) => {
      if (status.isFinalized) {
        const success = events.some(({ event }) => 
          api.events.system.ExtrinsicSuccess.is(event)
        )
        
        if (success) {
          message.success('评价提交成功')
          // 刷新做市商信用信息
          refreshMakerCredit(makerId)
        } else {
          message.error('评价提交失败')
        }
      }
    })
  } catch (error) {
    message.error('评价失败: ' + error.message)
  }
}
```

---

## API参考

### 链上可调用函数 (Extrinsics)

#### 1. `credit.endorseUser` - 推荐用户

**参数**:
- `endorsee: AccountId` - 被推荐人账户

**权限**: 任何用户

**条件**:
- 推荐人信用分 ≥ 700（风险分 ≤ 300）
- 不能推荐自己
- 被推荐人不能已被该用户推荐

**效果**:
- 增加被推荐人的社交信任度
- 推荐人需承担连带责任

**示例**:
```typescript
const tx = api.tx.credit.endorseUser(endorseeAddress)
await tx.signAndSend(endorserAddress)
```

#### 2. `credit.setReferrer` - 设置邀请人

**参数**:
- `referrer: AccountId` - 邀请人账户

**权限**: 任何用户

**条件**:
- 只能设置一次
- 不能邀请自己

**效果**:
- 建立邀请关系
- 继承邀请人的部分信任度

**示例**:
```typescript
const tx = api.tx.credit.setReferrer(referrerAddress)
await tx.signAndSend(inviteeAddress)
```

#### 3. `credit.rateMaker` - 评价做市商

**参数**:
- `makerId: u64` - 做市商ID
- `orderId: u64` - 订单ID
- `stars: u8` - 评分（1-5星）
- `tagsCodes: Vec<u8>` - 评价标签代码（最多5个）

**权限**: 订单买家

**条件**:
- 订单已完成
- 该订单未被评价过
- 必须是订单买家

**效果**:
- 影响做市商信用分：
  - 5星：+5分
  - 4星：+2分
  - 3星：0分
  - 1-2星：-5分

**示例**:
```typescript
const tx = api.tx.credit.rateMaker(
  makerId,      // 1
  orderId,      // 12345
  5,            // 5星
  [0, 1, 2]     // 标签：快速释放、沟通良好、价格合理
)
await tx.signAndSend(buyerAddress)
```

### 链上查询 (Storage Queries)

#### 买家信用查询

```typescript
// 查询买家信用记录
api.query.credit.buyerCredits(account: AccountId)

// 查询买家每日交易量
api.query.credit.buyerDailyVolume(account: AccountId, dayKey: u32)

// 查询买家订单历史
api.query.credit.buyerOrderHistory(account: AccountId)

// 查询买家推荐人
api.query.credit.buyerReferrer(account: AccountId)

// 查询买家背书记录
api.query.credit.buyerEndorsements(account: AccountId)

// 查询转账计数
api.query.credit.transferCount(account: AccountId)

// 查询违约历史
api.query.credit.defaultHistory(account: AccountId)
```

#### 做市商信用查询

```typescript
// 查询做市商信用记录
api.query.credit.makerCredits(makerId: u64)

// 查询做市商评分记录
api.query.credit.makerRatings(makerId: u64, orderId: u64)

// 查询做市商违约历史
api.query.credit.makerDefaultHistory(makerId: u64, orderId: u64)

// 查询做市商动态保证金
api.query.credit.makerDynamicDeposit(makerId: u64)
```

### 事件 (Events)

#### 买家信用事件

```typescript
// 新用户初始化
credit.NewUserInitialized { account, tier_code, risk_score }

// 买家信用更新
credit.BuyerCreditUpdated { account, new_risk_score, new_level_code }

// 买家等级升级
credit.BuyerLevelUpgraded { account, old_level_code, new_level_code }

// 买家违约惩罚
credit.BuyerDefaultPenalty { account, penalty, consecutive_defaults, new_risk_score }

// 连续违约检测
credit.ConsecutiveDefaultDetected { account, consecutive_count, within_days }

// 用户封禁
credit.UserBanned { account, reason }

// 用户推荐
credit.UserEndorsed { endorser, endorsee }

// 设置邀请人
credit.ReferrerSet { invitee, referrer }

// 行为模式识别
credit.BehaviorPatternDetected { account, pattern_code, adjustment }

// 风险分衰减
credit.RiskScoreDecayed { account, decay_amount, new_risk_score }
```

#### 做市商信用事件

```typescript
// 初始化做市商信用
credit.MakerCreditInitialized { maker_id, initial_score }

// 订单完成
credit.MakerOrderCompleted { maker_id, order_id, new_score, bonus }

// 订单超时
credit.MakerOrderTimeout { maker_id, order_id, new_score, penalty }

// 争议解决
credit.MakerDisputeResolved { maker_id, order_id, maker_win, new_score }

// 做市商被评价
credit.MakerRated { maker_id, order_id, buyer, stars, new_score }

// 服务状态变更
credit.MakerStatusChanged { maker_id, old_status_code, new_status_code, credit_score }

// 信用等级变更
credit.MakerLevelChanged { maker_id, old_level_code, new_level_code, credit_score }
```

---

## 常见问题

### Q1: 如何更新现有的 MakerCreditBadge 组件？

**A**: 只需修改 `src/services/makerCreditService.ts` 中的查询：

```typescript
// 旧代码
const creditData = await api.query.makerCredit.credits(makerId);

// 新代码
const creditData = await api.query.credit.makerCredits(makerId);
```

同时更新字段名称以匹配新的存储结构。

### Q2: 如何处理新用户没有信用记录的情况？

**A**: 服务函数会返回 `null`，UI组件应该显示友好提示：

```typescript
if (!creditDetail) {
  return (
    <Card>
      <Empty 
        description="暂无信用记录，完成首次订单后将建立信用档案"
      />
    </Card>
  )
}
```

### Q3: 买家信用分和风险分的关系？

**A**: 风险分范围 0-1000，信用分 = 1000 - 风险分
- 风险分越低，信用越好
- 信用分越高，信用越好
- 前端通常显示信用分更直观

### Q4: 如何在订单创建前检查买家限额？

**A**: 使用 `getBuyerCreditDetail` 查询限额：

```typescript
const detail = await getBuyerCreditDetail(api, buyerAccount, currentBlock)
if (orderAmount > detail.singleLimit) {
  message.error(`超过单笔限额 $${detail.singleLimit}`)
  return
}
```

### Q5: 评价标签的代码对应关系？

**A**: 
```
0 = 快速释放
1 = 沟通良好
2 = 价格合理
3 = 释放慢
4 = 沟通差
5 = 不回应
```

使用 `getRatingTagName(tagCode)` 函数可以获取中文名称。

### Q6: 如何判断做市商是否可以接单？

**A**: 检查服务状态：

```typescript
const detail = await getMakerCreditDetail(api, makerId)
if (detail.credit.status === 'Suspended') {
  // 暂停服务，不可接单
  return false
}
return detail.canAcceptOrders
```

### Q7: 动态保证金如何计算？

**A**: 基于信用等级：
- Diamond (950-1000分): 50万 MEMO (50%折扣)
- Platinum (900-949分): 70万 MEMO (30%折扣)
- Gold (850-899分): 80万 MEMO (20%折扣)
- Silver (820-849分): 90万 MEMO (10%折扣)
- Bronze (800-819分): 100万 MEMO (无折扣)

### Q8: 如何监听信用变更事件？

**A**: 使用 Polkadot.js 事件监听：

```typescript
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record
    
    if (api.events.credit.BuyerCreditUpdated.is(event)) {
      const [account, newRiskScore, newLevelCode] = event.data
      console.log(`买家 ${account} 信用更新，新风险分: ${newRiskScore}`)
    }
    
    if (api.events.credit.MakerRated.is(event)) {
      const [makerId, orderId, buyer, stars, newScore] = event.data
      console.log(`做市商 ${makerId} 被评价 ${stars} 星`)
    }
  })
})
```

---

## 📝 后续工作

### 高优先级
1. ⏳ 创建买家信用完整仪表板页面
2. ⏳ 创建做市商信用完整仪表板页面
3. ⏳ 更新旧的 MakerCreditBadge 组件以使用新的 pallet

### 中优先级
4. ⏳ 添加推荐用户UI
5. ⏳ 添加设置邀请人UI
6. ⏳ 信用历史记录时间线组件

### 低优先级
7. ⏳ 信用报告导出功能
8. ⏳ 信用趋势图表
9. ⏳ 信用预警通知

---

## 📞 技术支持

如有问题或建议，请联系开发团队。

**文档版本**: v1.0.0  
**最后更新**: 2025-10-28  
**维护者**: Memopark 前端团队

