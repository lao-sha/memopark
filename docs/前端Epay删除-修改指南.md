# 前端Epay删除 - 修改指南

**文档版本**: v1.0  
**创建时间**: 2025-10-21  
**适用范围**: stardust-dapp 前端应用  
**目标**: 删除Epay支付集成，改为直接付款方式

---

## 📋 概述

本文档指导前端开发者删除Epay支付相关代码，并实现新的直接付款流程。主要涉及3个页面的修改。

---

## 🎯 修改目标

### 删除内容
- ❌ Epay配置表单（网关地址、端口、商户ID、商户密钥）
- ❌ 首购资金池输入框
- ❌ Epay相关验证逻辑
- ❌ 首购资金池余额检查

### 新增内容
- ✅ 收款方式列表输入组件（支持动态添加/删除，最多5个）
- ✅ 收款方式格式验证（每个不超过256字节）
- ✅ 收款方式类型选择（银行转账、支付宝、微信、USDT等）

---

## 📁 需要修改的文件

### 1. CreateMarketMakerPage.tsx
**路径**: `/home/xiaodong/文档/stardust/stardust-dapp/src/features/otc/CreateMarketMakerPage.tsx`

**涉及修改**: 
- ApplicationDetails 接口
- submit_info 调用参数
- update_info 调用参数
- 表单字段渲染

### 2. MarketMakerConfigPage.tsx
**路径**: `/home/xiaodong/文档/stardust/stardust-dapp/src/features/otc/MarketMakerConfigPage.tsx`

**涉及修改**:
- 删除 update_epay_config 调用
- 添加 update_payment_methods 调用

### 3. CreateOrderPage.tsx
**路径**: `/home/xiaodong/文档/stardust/stardust-dapp/src/features/otc/CreateOrderPage.tsx`

**涉及修改**:
- 显示做市商收款方式列表
- 买家选择收款方式
- 上传付款凭证界面

---

## 🔧 详细修改步骤

### 一、CreateMarketMakerPage.tsx

#### 1.1 修改 ApplicationDetails 接口

**位置**: 第22-42行

**删除字段**:
```typescript
// ❌ 删除这些字段
epayGateway?: string
epayPort?: number
epayPid?: string
epayKey?: string
firstPurchasePool?: string
```

**新增字段**:
```typescript
// ✅ 新增收款方式字段
paymentMethods?: string[]  // 收款方式列表，每个元素是一个字符串（最多5个）
```

**修改后的完整接口**:
```typescript
interface ApplicationDetails {
  mmId: number
  owner: string
  deposit: string
  status: string
  publicCid: string
  privateCid: string
  minAmount: string
  createdAt: number
  infoDeadline: number
  reviewDeadline: number
  // 🆕 2025-10-19: 扩展字段
  buyPremiumBps?: number
  sellPremiumBps?: number
  tronAddress?: string
  // 🆕 2025-10-21: 收款方式列表（替换epay配置）
  paymentMethods?: string[]
}
```

---

#### 1.2 修改链上数据解析逻辑

**位置**: ~第412-439行（loadApplicationDetails 函数内）

**删除代码**:
```typescript
// ❌ 删除 epay 配置解析
const epayGateway = decodeBytes(appData.epayGateway, 'epayGateway')
const epayPid = decodeBytes(appData.epayPid, 'epayPid')
const epayKey = decodeBytes(appData.epayKey, 'epayKey')

// 在 details 对象中删除这些字段
epayGateway: epayGateway || undefined,
epayPort: appData.epayPort > 0 ? appData.epayPort : undefined,
epayPid: epayPid || undefined,
epayKey: epayKey || undefined,
firstPurchasePool: appData.firstPurchasePool || '0',
```

**新增代码**:
```typescript
// ✅ 新增收款方式解析
const paymentMethods: string[] = []
if (appData.paymentMethods && Array.isArray(appData.paymentMethods)) {
  for (const methodBytes of appData.paymentMethods) {
    const methodStr = decodeBytes(methodBytes, 'paymentMethod')
    if (methodStr) {
      paymentMethods.push(methodStr)
    }
  }
}

// 在 details 对象中添加
paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
```

---

#### 1.3 修改自动填充逻辑

**位置**: ~第532-568行（handleAutoFill 函数内）

**删除代码**:
```typescript
// ❌ 删除 Epay 和首购资金池字段自动填充
// 删除 535-568 行的所有 epay_* 和 first_purchase_pool 相关代码
```

**新增代码**:
```typescript
// ✅ 新增收款方式自动填充
if (appDetails.paymentMethods && appDetails.paymentMethods.length > 0) {
  fieldsToFill.payment_methods = appDetails.paymentMethods
  fieldCount++
  console.log('✅ 填充 payment_methods:', appDetails.paymentMethods.length, '个收款方式')
}
```

---

#### 1.4 修改 submit_info 调用

**位置**: ~第817-950行（onSubmitInfo 函数）

**删除验证逻辑**:
```typescript
// ❌ 删除第862-873行的 epay 验证
// ❌ 删除第872行的首购资金池验证
```

**新增验证逻辑**:
```typescript
// ✅ 新增收款方式验证
const { payment_methods } = values

// 验证收款方式
if (!payment_methods || !Array.isArray(payment_methods) || payment_methods.length === 0) {
  throw new Error('请至少添加1种收款方式')
}
if (payment_methods.length > 5) {
  throw new Error('收款方式最多5种')
}

// 验证每个收款方式的格式和长度
for (let i = 0; i < payment_methods.length; i++) {
  const method = payment_methods[i]
  if (!method || method.trim() === '') {
    throw new Error(`收款方式 ${i + 1} 不能为空`)
  }
  if (method.trim().length > 256) {
    throw new Error(`收款方式 ${i + 1} 超过256字节限制`)
  }
}
```

**修改链上调用参数**:
```typescript
// ❌ 删除旧参数
const epayGatewayBytes = Array.from(new TextEncoder().encode(epay_gateway.trim()))
const epayPidBytes = Array.from(new TextEncoder().encode(epay_pid.trim()))
const epayKeyBytes = Array.from(new TextEncoder().encode(epay_key.trim()))
const poolFormatted = formatMemoAmount(pool)

// ❌ 删除余额检查
const balance = await queryFreeBalance(api, currentAddress)
// ... 删除首购资金池余额检查逻辑 ...

// ✅ 新增参数编码
const paymentMethodsBytes = payment_methods.map((method: string) => 
  Array.from(new TextEncoder().encode(method.trim()))
)

// ✅ 修改 submitInfo 调用（第941行附近）
const tx = (api.tx as any).marketMaker.submitInfo([
  mmId,
  publicCid,
  privateCid,
  buyPremium,
  sellPremium,
  minAmountFormatted,
  tronAddressBytes,
  paymentMethodsBytes,  // 🆕 替换 epay 参数和 poolFormatted
])
```

---

#### 1.5 修改 update_info 调用

**位置**: ~第1006-1157行（onUpdateInfo 函数）

**删除验证逻辑**:
```typescript
// ❌ 删除第1100-1140行的所有 epay 和首购资金池验证
```

**新增验证逻辑**:
```typescript
// ✅ 新增收款方式验证
let paymentMethodsParam = null

if (values.payment_methods && Array.isArray(values.payment_methods) && values.payment_methods.length > 0) {
  if (values.payment_methods.length > 5) {
    throw new Error('收款方式最多5种')
  }
  
  // 验证每个收款方式
  for (let i = 0; i < values.payment_methods.length; i++) {
    const method = values.payment_methods[i]
    if (!method || method.trim() === '') {
      throw new Error(`收款方式 ${i + 1} 不能为空`)
    }
    if (method.trim().length > 256) {
      throw new Error(`收款方式 ${i + 1} 超过256字节限制`)
    }
  }
  
  paymentMethodsParam = values.payment_methods.map((method: string) =>
    Array.from(new TextEncoder().encode(method.trim()))
  )
}
```

**修改链上调用参数**:
```typescript
// ✅ 修改 updateInfo 调用（第1148行附近）
const tx = (api.tx as any).marketMaker.updateInfo([
  mmId,
  publicCidParam,
  privateCidParam,
  buyPremiumBpsParam,
  sellPremiumBpsParam,
  minAmountParam,
  paymentMethodsParam,  // 🆕 替换所有 epay 参数
])
```

---

#### 1.6 修改表单UI

**位置**: ~第1700-1900行（Step 2 表单渲染）

**删除表单项**:
```tsx
{/* ❌ 删除所有 epay 相关表单项 */}
{/* 删除: epay_gateway, epay_port, epay_pid, epay_key */}
{/* 删除: first_purchase_pool */}
```

**新增表单项**:
```tsx
{/* ✅ 新增收款方式列表输入 */}
<Form.List name="payment_methods">
  {(fields, { add, remove }) => (
    <>
      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
        💰 收款方式 <Tag color="red">必填</Tag>
      </Typography.Title>
      <Alert
        message="收款方式说明"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>至少添加1种收款方式，最多5种</li>
            <li>建议格式：银行转账:中国银行:6214xxxx:张三</li>
            <li>或：支付宝:13800138000</li>
            <li>或：USDT(TRC20):TYASr5UV6HEcXatwdFSwD...</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      {fields.map((field, index) => (
        <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
          <Form.Item
            {...field}
            label={`收款方式 ${index + 1}`}
            rules={[
              { required: true, message: '请输入收款方式' },
              { max: 256, message: '收款方式不能超过256字节' }
            ]}
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Input.TextArea
              placeholder="示例：银行转账:中国银行:6214xxxx:张三"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>
          {fields.length > 1 && (
            <Button
              type="link"
              danger
              onClick={() => remove(field.name)}
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          )}
        </Space>
      ))}
      
      {fields.length < 5 && (
        <Button
          type="dashed"
          onClick={() => add()}
          block
          icon={<PlusOutlined />}
          style={{ marginTop: 8 }}
        >
          添加收款方式 ({fields.length}/5)
        </Button>
      )}
    </>
  )}
</Form.List>
```

**需要导入的图标**:
```typescript
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
```

---

### 二、MarketMakerConfigPage.tsx

#### 2.1 删除 update_epay_config 相关代码

**搜索并删除**:
- `update_epay_config` 函数定义
- Epay 配置表单渲染
- Epay 相关状态变量

#### 2.2 新增 update_payment_methods 调用

**新增函数**:
```typescript
/**
 * 函数级详细中文注释：更新收款方式
 * - 调用 pallet-market-maker::update_payment_methods
 */
const onUpdatePaymentMethods = async (values: any) => {
  if (!api) {
    message.error('API未初始化')
    return
  }
  
  const currentAddress = localStorage.getItem('mp.current')
  if (!currentAddress) {
    message.error('未找到当前钱包地址')
    return
  }
  
  try {
    setLoading(true)
    const { payment_methods } = values
    
    // 验证收款方式
    if (!payment_methods || !Array.isArray(payment_methods) || payment_methods.length === 0) {
      throw new Error('请至少添加1种收款方式')
    }
    if (payment_methods.length > 5) {
      throw new Error('收款方式最多5种')
    }
    
    // 编码为字节数组
    const paymentMethodsBytes = payment_methods.map((method: string) =>
      Array.from(new TextEncoder().encode(method.trim()))
    )
    
    message.loading({ content: '正在更新收款方式...', key: 'update', duration: 0 })
    
    const tx = (api.tx as any).marketMaker.updatePaymentMethods([
      mmId,
      paymentMethodsBytes
    ])
    
    await signAndSendLocalFromKeystore(api, tx, currentAddress)
    
    message.success({ content: '✅ 收款方式已更新', key: 'update' })
    
    // 刷新数据
    await loadMarketMakerInfo()
    
  } catch (err: any) {
    console.error('❌ 更新收款方式失败:', err)
    message.error({ content: `更新失败: ${err.message || err}`, key: 'update' })
  } finally {
    setLoading(false)
  }
}
```

**新增UI组件**:
```tsx
<Card title="💰 收款方式管理" style={{ marginTop: 16 }}>
  <Form onFinish={onUpdatePaymentMethods}>
    <Form.List name="payment_methods">
      {(fields, { add, remove }) => (
        <>
          {fields.map((field, index) => (
            <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
              <Form.Item
                {...field}
                label={`收款方式 ${index + 1}`}
                rules={[
                  { required: true, message: '请输入收款方式' },
                  { max: 256, message: '不能超过256字节' }
                ]}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <Input.TextArea
                  placeholder="银行转账:中国银行:6214xxxx:张三"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
              </Form.Item>
              {fields.length > 1 && (
                <Button type="link" danger onClick={() => remove(field.name)}>
                  删除
                </Button>
              )}
            </Space>
          ))}
          
          {fields.length < 5 && (
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
              添加收款方式 ({fields.length}/5)
            </Button>
          )}
        </>
      )}
    </Form.List>
    
    <Form.Item style={{ marginTop: 16 }}>
      <Button type="primary" htmlType="submit" loading={loading}>
        更新收款方式
      </Button>
    </Form.Item>
  </Form>
</Card>
```

---

### 三、CreateOrderPage.tsx

#### 3.1 修改订单创建流程

**原流程**（Epay支付）:
```
买家下单 → 跳转Epay支付页面 → Relay服务监听 → 标记已付款
```

**新流程**（直接付款）:
```
买家下单 → 显示做市商收款方式 → 买家选择并付款 → 上传付款凭证 → 等待做市商确认
```

#### 3.2 显示做市商收款方式

**新增代码**:
```typescript
// 从链上查询做市商的收款方式
const [paymentMethods, setPaymentMethods] = React.useState<string[]>([])

React.useEffect(() => {
  const loadPaymentMethods = async () => {
    if (!api || !mmId) return
    
    try {
      const mmInfo = await (api.query as any).marketMaker.activeMarketMakers(mmId)
      if (mmInfo.isSome) {
        const mmData = mmInfo.unwrap()
        const methods: string[] = []
        
        if (mmData.paymentMethods && Array.isArray(mmData.paymentMethods)) {
          for (const methodBytes of mmData.paymentMethods) {
            const methodStr = new TextDecoder().decode(new Uint8Array(methodBytes))
            if (methodStr) {
              methods.push(methodStr)
            }
          }
        }
        
        setPaymentMethods(methods)
      }
    } catch (err) {
      console.error('❌ 加载收款方式失败:', err)
    }
  }
  
  loadPaymentMethods()
}, [api, mmId])
```

#### 3.3 UI渲染收款方式选择

**新增UI**:
```tsx
<Card title="📝 选择付款方式" style={{ marginTop: 16 }}>
  <Form.Item
    label="收款方式"
    name="payment_method"
    rules={[{ required: true, message: '请选择收款方式' }]}
  >
    <Radio.Group style={{ width: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {paymentMethods.map((method, index) => (
          <Radio key={index} value={method}>
            <Card
              size="small"
              style={{
                width: '100%',
                marginTop: 8,
                borderColor: '#1890ff'
              }}
            >
              <Typography.Text code>{method}</Typography.Text>
            </Card>
          </Radio>
        ))}
      </Space>
    </Radio.Group>
  </Form.Item>
  
  <Alert
    message="付款说明"
    description={
      <>
        <p>1. 请复制上方收款信息进行付款</p>
        <p>2. 付款后请上传付款凭证（截图）</p>
        <p>3. 等待做市商确认后，MEMO将自动释放到您的账户</p>
      </>
    }
    type="info"
    showIcon
    style={{ marginTop: 16 }}
  />
</Card>

<Card title="📷 上传付款凭证" style={{ marginTop: 16 }}>
  <Form.Item
    label="付款截图"
    name="payment_proof"
    rules={[{ required: true, message: '请上传付款凭证' }]}
  >
    <Upload
      listType="picture-card"
      maxCount={1}
      beforeUpload={(file) => {
        // 限制图片大小和格式
        const isImage = file.type.startsWith('image/')
        if (!isImage) {
          message.error('只能上传图片文件')
          return false
        }
        const isLt5M = file.size / 1024 / 1024 < 5
        if (!isLt5M) {
          message.error('图片大小不能超过5MB')
          return false
        }
        return false  // 阻止自动上传，由表单提交时处理
      }}
    >
      <div>
        <PlusOutlined />
        <div style={{ marginTop: 8 }}>上传凭证</div>
      </div>
    </Upload>
  </Form.Item>
  
  <Typography.Text type="secondary">
    支持 JPG、PNG 格式，文件大小不超过 5MB
  </Typography.Text>
</Card>
```

---

## 🧪 测试验证

### 测试点清单

#### CreateMarketMakerPage
- [ ] 收款方式添加/删除功能正常
- [ ] 最多只能添加5个收款方式
- [ ] 收款方式字段验证（非空、长度限制）
- [ ] submit_info 调用参数正确
- [ ] update_info 调用参数正确
- [ ] 链上数据解析正确
- [ ] 自动填充功能正常

#### MarketMakerConfigPage
- [ ] update_payment_methods 调用正常
- [ ] 收款方式更新成功
- [ ] UI显示当前收款方式列表

#### CreateOrderPage
- [ ] 正确显示做市商收款方式
- [ ] 收款方式选择功能正常
- [ ] 付款凭证上传功能正常
- [ ] 订单创建成功

---

## 📝 注意事项

### 数据格式

**PaymentMethod** 格式示例：
```
银行转账:中国银行:6214xxxx:张三
支付宝:13800138000
微信:wxid_xxxxx
USDT(TRC20):TYASr5UV6HEcXatwdFSwD...
```

### 字节长度限制
- 单个收款方式: 最大 **256字节**
- 收款方式数量: 最多 **5个**

### UTF-8编码
所有字符串使用 `TextEncoder` / `TextDecoder` 进行 UTF-8 编码/解码：
```typescript
// 编码
const bytes = Array.from(new TextEncoder().encode(str))

// 解码
const str = new TextDecoder().decode(new Uint8Array(bytes))
```

---

## 🔗 相关文档

- [删除首购Epay功能-完成报告.md](./删除首购Epay功能-完成报告.md)
- [删除Epay改为直接付款-可行性分析报告.md](./删除Epay改为直接付款-可行性分析报告.md)
- [pallet-market-maker README](../pallets/market-maker/README.md)

---

**文档结束**

如有疑问，请联系后端开发团队。

