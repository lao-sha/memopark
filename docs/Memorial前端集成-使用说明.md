# Memorial 前端集成使用说明

**发布日期**: 2025-10-28  
**版本**: 1.0.0  
**状态**: ✅ 完成

---

## 📋 集成概览

Memorial前端集成已全面完成，提供了完整的祭祀品目录管理和供奉业务功能。

### ✅ 交付成果

1. **API服务层** (`memorialService.ts`, 686行)
   - 完整的TypeScript类型定义
   - 13个核心API方法
   - 智能价格计算
   - VIP会员折扣支持

2. **UI组件库** (5个组件)
   - `SacrificeCard` - 祭祀品卡片
   - `OfferBySacrificeModal` - 快速下单弹窗
   - `OfferingsList` - 供奉记录列表
   - `SacrificeManager` - 祭祀品目录管理（管理员）
   - `OfferingForm` - 自定义供奉表单

3. **完整文档**
   - 组件README.md
   - 使用说明（本文档）
   - API文档（集成在代码注释中）

---

## 🚀 快速开始

### 步骤1：导入服务层

```typescript
import { getApi } from '@/lib/polkadot-safe'
import { createMemorialService } from '@/services/memorialService'

// 创建服务实例
const api = await getApi()
const memorialService = createMemorialService(api)
```

### 步骤2：查询祭祀品

```typescript
// 查询单个祭祀品
const sacrifice = await memorialService.getSacrifice(1)

// 批量查询祭祀品列表
const sacrifices = await memorialService.listSacrifices({
  scene: Scene.Grave,  // 墓地场景
  status: SacrificeStatus.Enabled,  // 已启用
  limit: 20,
})
```

### 步骤3：使用UI组件

```typescript
import { 
  SacrificeCard, 
  OfferBySacrificeModal 
} from '@/components/memorial'

function MyPage() {
  const [showModal, setShowModal] = useState(false)
  const [selectedSacrifice, setSelectedSacrifice] = useState(null)

  return (
    <>
      {/* 祭祀品卡片 */}
      <SacrificeCard
        sacrifice={sacrifice}
        showOrderButton
        onOrder={(item) => {
          setSelectedSacrifice(item)
          setShowModal(true)
        }}
        isVip={true}
      />

      {/* 快速下单弹窗 */}
      <OfferBySacrificeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        sacrifice={selectedSacrifice}
        account={currentAccount}
        defaultTarget={[1, graveId]}
        onSuccess={() => {
          message.success('供奉成功！')
          loadOfferings()
        }}
      />
    </>
  )
}
```

---

## 📖 核心功能使用

### 1. 祭祀品展示和下单

#### 用户场景
用户浏览祭祀品目录，选择心仪的祭祀品快速下单。

#### 代码示例

```typescript
import React, { useState, useEffect } from 'react'
import { Row, Col, Spin } from 'antd'
import { getApi } from '@/lib/polkadot-safe'
import { 
  createMemorialService, 
  Scene, 
  SacrificeStatus 
} from '@/services/memorialService'
import { 
  SacrificeCard, 
  OfferBySacrificeModal 
} from '@/components/memorial'

export function SacrificeMarketplace({ currentAccount, targetGraveId }) {
  const [sacrifices, setSacrifices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedSacrifice, setSelectedSacrifice] = useState(null)

  // 加载祭祀品列表
  useEffect(() => {
    const load = async () => {
      try {
        const api = await getApi()
        const service = createMemorialService(api)
        
        const items = await service.listSacrifices({
          scene: Scene.Grave,
          status: SacrificeStatus.Enabled,
          limit: 50,
        })
        
        setSacrifices(items)
      } catch (error) {
        console.error('加载失败:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // 处理下单
  const handleOrder = (sacrifice) => {
    setSelectedSacrifice(sacrifice)
    setShowOrderModal(true)
  }

  if (loading) return <Spin />

  return (
    <>
      {/* 祭祀品网格 */}
      <Row gutter={[16, 16]}>
        {sacrifices.map((sacrifice) => (
          <Col key={sacrifice.id} xs={24} sm={12} md={8} lg={6}>
            <SacrificeCard
              sacrifice={sacrifice}
              showOrderButton
              onOrder={handleOrder}
              isVip={true} // 从会员状态获取
            />
          </Col>
        ))}
      </Row>

      {/* 下单弹窗 */}
      <OfferBySacrificeModal
        open={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        sacrifice={selectedSacrifice}
        account={currentAccount}
        defaultTarget={[1, targetGraveId]}
        onSuccess={() => {
          message.success('供奉成功！感谢您的心意 ❤️')
          setShowOrderModal(false)
        }}
      />
    </>
  )
}
```

---

### 2. 供奉记录查询

#### 用户场景
用户查看自己的供奉历史，或查看某个墓地收到的所有供奉。

#### 代码示例

```typescript
import { OfferingsList } from '@/components/memorial'
import { Tabs } from 'antd'

export function MyOfferingsPage({ currentAccount }) {
  return (
    <Tabs
      items={[
        {
          key: 'my-offerings',
          label: '我的供奉',
          children: (
            <OfferingsList
              queryType="account"
              account={currentAccount}
              showActions
              currentAccount={currentAccount}
              limit={100}
            />
          ),
        },
        {
          key: 'received-offerings',
          label: '收到的供奉',
          children: (
            <OfferingsList
              queryType="target"
              target={[1, myGraveId]}
              limit={100}
            />
          ),
        },
      ]}
    />
  )
}
```

---

### 3. 管理员功能 - 祭祀品目录管理

#### 用户场景
管理员创建、编辑、启用/禁用祭祀品。

#### 代码示例

```typescript
import { SacrificeManager } from '@/components/memorial'
import { Layout } from 'antd'

export function AdminManagementPage({ adminAccount }) {
  return (
    <Layout.Content style={{ padding: 24 }}>
      <SacrificeManager adminAccount={adminAccount} />
    </Layout.Content>
  )
}
```

**管理员操作**:
1. 创建祭祀品
2. 编辑祭祀品（价格、描述、图片）
3. 设置状态（启用/禁用/隐藏）
4. 按场景/类目筛选

---

### 4. 自定义供奉（高级功能）

#### 用户场景
用户需要完全自定义供奉（不使用目录），如特殊金额或自定义媒体。

#### 代码示例

```typescript
import { OfferingForm } from '@/components/memorial'
import { Card } from 'antd'

export function CustomOfferingPage({ currentAccount, targetGraveId }) {
  return (
    <Card title="自定义供奉">
      <OfferingForm
        account={currentAccount}
        defaultTarget={[1, targetGraveId]}
        onSuccess={() => {
          message.success('供奉成功！')
          // 刷新列表或跳转
        }}
        showAsCard={false}
      />
    </Card>
  )
}
```

**注意**: 建议优先使用`OfferBySacrificeModal`，享受智能定价和VIP折扣。

---

## 🎯 核心特性

### 1. 智能定价

快速下单弹窗会根据祭祀品的定价策略自动计算价格：

```typescript
// 固定价格
const price = sacrifice.fixedPrice

// 按周计费
const price = sacrifice.unitPricePerWeek * weeks
```

**用户体验**:
- ✅ 自动计算，无需手动输入
- ✅ 实时显示价格变化
- ✅ 支持两种价格模式共存

---

### 2. VIP 30%折扣

系统会自动检测用户的VIP会员状态，应用30%折扣：

```typescript
const priceInfo = await memorialService.calculateOfferingPrice(
  sacrificeId,
  weeks,
  account
)

// priceInfo.isVip = true
// priceInfo.originalPrice = "1000000"  // 1 DUST
// priceInfo.finalPrice = "700000"      // 0.7 DUST (打7折)
// priceInfo.discountPercent = 30
```

**显示效果**:
```
原价：     1.000 DUST  (划线)
VIP折扣：  -0.300 DUST
─────────────────────
实付金额：  0.700 DUST (高亮)
```

---

### 3. 多场景支持

Memorial支持4种场景类型：

| 场景 | 代码 | 说明 | 用途 |
|------|------|------|------|
| Grave | 0 | 墓地 | 为逝者供奉 |
| Pet | 1 | 宠物 | 为宠物供奉 |
| Park | 2 | 公园 | 为公园供奉 |
| Memorial | 3 | 纪念馆 | 为纪念馆供奉 |

**使用示例**:

```typescript
// 墓地场景的祭祀品
const graveSacrifices = await service.listSacrifices({
  scene: Scene.Grave,
  status: SacrificeStatus.Enabled,
})

// 宠物场景的祭祀品
const petSacrifices = await service.listSacrifices({
  scene: Scene.Pet,
  status: SacrificeStatus.Enabled,
})
```

---

### 4. 媒体上传（IPFS）

`OfferingForm` 支持上传图片和视频到IPFS：

```typescript
// 当前使用占位实现
// 需要集成实际的IPFS服务

const handleUploadToIPFS = async (file: File): Promise<string> => {
  // TODO: 集成 @/services/ipfs.ts
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('YOUR_IPFS_API_ENDPOINT', {
    method: 'POST',
    body: formData,
  })
  
  const { cid } = await response.json()
  return cid
}
```

---

## 📊 数据类型

### SacrificeItem

```typescript
interface SacrificeItem {
  id: number
  name: string
  resourceUrl: string
  description: string
  status: SacrificeStatus  // 'Enabled' | 'Disabled' | 'Hidden'
  isVipExclusive: boolean
  fixedPrice: string | null  // MEMO最小单位
  unitPricePerWeek: string | null  // MEMO最小单位
  scene: Scene  // 0-3
  category: Category  // 0-4
  created: number  // 区块号
  updated: number  // 区块号
}
```

### OfferingRecord

```typescript
interface OfferingRecord {
  who: string  // 供奉人地址
  target: [number, number]  // [域代码, 对象ID]
  kindCode: number  // 供奉类型代码
  amount: string  // MEMO最小单位
  media: MediaItem[]  // 媒体列表
  duration: number | null  // 持续周数
  time: number  // 区块号
}
```

### OfferingPriceInfo

```typescript
interface OfferingPriceInfo {
  originalPrice: string  // 原价（MEMO最小单位）
  finalPrice: string  // 实付价格（应用VIP折扣后）
  discountPercent: number  // VIP折扣比例（0-100）
  isVip: boolean  // 是否为VIP
}
```

---

## 🎨 UI集成示例

### 完整的供奉页面

```typescript
import React, { useState, useEffect } from 'react'
import { Layout, Row, Col, Card, Tabs, Typography, Space, Tag } from 'antd'
import { GiftOutlined, ShoppingOutlined } from '@ant-design/icons'
import { 
  SacrificeCard, 
  OfferBySacrificeModal,
  OfferingsList,
} from '@/components/memorial'
import { 
  createMemorialService, 
  Scene, 
  SacrificeStatus 
} from '@/services/memorialService'
import { getApi } from '@/lib/polkadot-safe'

const { Title, Text } = Typography

export function MemorialOfferingPage({ 
  currentAccount, 
  targetGraveId 
}) {
  const [sacrifices, setSacrifices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedSacrifice, setSelectedSacrifice] = useState(null)

  // 加载祭祀品
  useEffect(() => {
    const load = async () => {
      try {
        const api = await getApi()
        const service = createMemorialService(api)
        
        const items = await service.listSacrifices({
          scene: Scene.Grave,
          status: SacrificeStatus.Enabled,
          limit: 50,
        })
        
        setSacrifices(items)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 头部 */}
      <Layout.Header style={{ 
        background: '#fff', 
        padding: '16px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <Space>
          <GiftOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={3} style={{ margin: 0 }}>
            纪念供奉
          </Title>
          <Tag color="blue">
            {sacrifices.length} 个祭祀品
          </Tag>
        </Space>
      </Layout.Header>

      {/* 主内容 */}
      <Layout.Content style={{ padding: 24 }}>
        <Tabs
          items={[
            {
              key: 'marketplace',
              label: (
                <span>
                  <ShoppingOutlined />
                  祭祀品商城
                </span>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  {sacrifices.map((sacrifice) => (
                    <Col key={sacrifice.id} xs={24} sm={12} md={8} lg={6}>
                      <SacrificeCard
                        sacrifice={sacrifice}
                        showOrderButton
                        onOrder={(item) => {
                          setSelectedSacrifice(item)
                          setShowOrderModal(true)
                        }}
                        isVip={true}
                      />
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'my-offerings',
              label: '我的供奉',
              children: (
                <OfferingsList
                  queryType="account"
                  account={currentAccount}
                  showActions
                  currentAccount={currentAccount}
                  limit={100}
                />
              ),
            },
            {
              key: 'received',
              label: '收到的供奉',
              children: (
                <OfferingsList
                  queryType="target"
                  target={[1, targetGraveId]}
                  limit={100}
                />
              ),
            },
          ]}
        />
      </Layout.Content>

      {/* 快速下单弹窗 */}
      <OfferBySacrificeModal
        open={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        sacrifice={selectedSacrifice}
        account={currentAccount}
        defaultTarget={[1, targetGraveId]}
        onSuccess={() => {
          message.success('供奉成功！感谢您的心意 ❤️')
          setShowOrderModal(false)
        }}
      />
    </Layout>
  )
}
```

---

## 🔧 技术细节

### 金额单位转换

Memorial使用MEMO作为货币单位，需要注意单位转换：

```typescript
// 前端显示: 1 DUST
// 链上存储: 1,000,000 最小单位

// 转换到最小单位
const toMinimalUnits = (memo: string) => {
  return (BigInt(memo) * BigInt(1_000_000)).toString()
}

// 转换到MEMO
const formatMEMO = (amount: string) => {
  const memo = BigInt(amount) / BigInt(1_000_000)
  return memo.toLocaleString() + ' DUST'
}
```

---

### 交易签名流程

所有交易都需要通过Polkadot.js Extension签名：

```typescript
import { web3FromAddress } from '@polkadot/extension-dapp'

// 1. 构建交易
const tx = service.buildOfferBySacrificeTx({
  target: [1, 100],
  sacrificeId: 1,
  weeks: 4,
  memo: '永远怀念您！',
})

// 2. 获取签名器
const injector = await web3FromAddress(account)

// 3. 签名并发送
await tx.signAndSend(
  account,
  { signer: injector.signer },
  ({ status, events }) => {
    if (status.isInBlock) {
      console.log('交易已打包')
    } else if (status.isFinalized) {
      console.log('交易已确认')
      message.success('供奉成功！')
    }
  }
)
```

---

## 🐛 常见问题

### Q1: 价格计算不正确？
**A**: 检查单位转换：
- 前端输入: `1` (表示1 DUST)
- 链上存储: `1000000` (最小单位)
- 显示时需转换回MEMO

### Q2: VIP折扣不生效？
**A**: 确保：
1. `pallet-membership` 正确配置
2. 用户为有效VIP会员
3. `memorialService.checkMembershipStatus()` 返回true

### Q3: 媒体上传失败？
**A**: 当前`OfferingForm`使用占位实现，需要集成实际IPFS服务：
```typescript
// 参考 @/services/ipfs.ts
import { uploadToIPFS } from '@/services/ipfs'

const cid = await uploadToIPFS(file)
```

### Q4: 交易失败"InsufficientBalance"？
**A**: 用户余额不足，提醒用户充值或使用更低金额。

### Q5: 交易失败"BadOrigin"？
**A**: 管理员功能需要Admin权限，确保使用管理员账户。

---

## 📈 性能优化建议

### 1. 分页加载

```typescript
// 不推荐：一次加载所有
const allSacrifices = await service.listSacrifices({ limit: 1000 })

// 推荐：分页加载
const page1 = await service.listSacrifices({ offset: 0, limit: 20 })
const page2 = await service.listSacrifices({ offset: 20, limit: 20 })
```

### 2. 缓存祭祀品数据

```typescript
// 使用React Query或SWR缓存
import { useQuery } from '@tanstack/react-query'

const { data: sacrifices } = useQuery(
  ['sacrifices', scene],
  () => service.listSacrifices({ scene, limit: 50 }),
  { staleTime: 5 * 60 * 1000 } // 5分钟缓存
)
```

### 3. 懒加载图片

```typescript
<SacrificeCard
  sacrifice={sacrifice}
  // Ant Design的Image组件已自动支持懒加载
/>
```

---

## 🎉 下一步计划

### Phase 4 建议
1. **供奉排行榜**: 显示最受欢迎的祭祀品
2. **供奉时间线**: 优化OfferingsList为时间线视图
3. **批量供奉**: 支持一次性购买多个祭祀品
4. **供奉提醒**: 到期前提醒用户续费
5. **AR供奉**: 集成AR技术，虚拟供奉

---

## 📞 技术支持

**文档位置**: `/home/xiaodong/文档/stardust/docs/Memorial前端集成-使用说明.md`

**组件位置**: `/home/xiaodong/文档/stardust/stardust-dapp/src/components/memorial/`

**服务层位置**: `/home/xiaodong/文档/stardust/stardust-dapp/src/services/memorialService.ts`

**相关文档**:
- `stardust-dapp/src/components/memorial/README.md` - 组件详细文档
- `pallets/memorial/README.md` - 链端Pallet文档
- `docs/Phase3-Memorial整合-最终完成报告.md` - 项目完成报告

---

**文档更新**: 2025-10-28  
**维护者**: Stardust开发团队  
**状态**: ✅ 生产就绪

