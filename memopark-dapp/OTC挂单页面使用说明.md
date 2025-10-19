# OTC 挂单页面使用说明

## 📋 概述

OTC 挂单页面（`#/otc/order`）允许用户浏览并选择做市商创建的挂单，完成 MEMO 购买。

## 🎯 功能特性

### ✅ 已实现功能

1. **挂单列表展示**
   - 显示所有活跃且未过期的挂单
   - 自动关联做市商信息
   - 支持分页浏览
   - 支持多列排序

2. **做市商查询**
   - ✅ 修复：从 `activeMarketMakers` 查询已批准的做市商
   - 自动关联挂单与做市商
   - 显示做市商费率、质押等信息

3. **挂单选择**
   - 单选模式，一次只能选择一个挂单
   - 点击表格行或单选框均可选中
   - 显示选中挂单的详细信息

4. **数量验证**
   - 验证订单数量是否满足挂单的最小/最大要求
   - 验证订单数量是否超过剩余库存
   - 实时提示验证错误

5. **订单创建**
   - 支持按法币金额或 MEMO 数量下单
   - 支持支付宝/微信支付
   - 生成支付二维码
   - 自动轮询订单状态

## 📊 挂单列表字段说明

| 字段 | 说明 | 示例 |
|-----|------|------|
| 挂单ID | 挂单的唯一标识 | #0, #1, #2 |
| 类型 | 买入/卖出 | 买入（绿色）、卖出（橙色） |
| 价差 | 基于链上价格的浮动范围 | 0.50%（绿色）、1.00%（橙色） |
| 最小数量 | 单笔交易最小MEMO数量 | 0.0011 MEMO |
| 最大数量 | 单笔交易最大MEMO数量 | 0.1111 MEMO |
| 剩余库存 | 挂单剩余可交易数量 | **1.1111 MEMO** |
| 部分成交 | 是否允许部分成交 | 允许（绿色）、不允许（灰色） |
| 做市商 | 创建此挂单的做市商 | #1 5C7RjM...39Qo |
| 过期区块 | 挂单过期的区块高度 | #22222, 剩余 1000 块 |

## 🚀 使用流程

### 1. 访问页面

```
http://127.0.0.1:5173/#/otc/order
```

或从"我的钱包"页面点击"智能购买 MEMO"按钮。

### 2. 浏览挂单列表

页面会自动加载所有可用的挂单：

- **加载中**: 显示 "加载挂单列表中..." 提示
- **无挂单**: 显示 "暂无可用挂单" 提示
- **有挂单**: 显示挂单表格

**挂单筛选条件**：
- ✅ 状态为 `active`
- ✅ 未过期（`expireAt > 当前区块高度`）
- ✅ 做市商在 `activeMarketMakers` 中

### 3. 选择挂单

**方式一：点击单选按钮**
- 点击表格左侧的单选框

**方式二：点击表格行**
- 点击表格任意位置（除操作按钮外）

**选中效果**：
- 表格行高亮显示
- 下方显示选中挂单的详细信息卡片
- 绿色背景，带关闭按钮（✕）

### 4. 查看挂单详情

选中挂单后，会显示详细信息：

```
✅ 已选择挂单

挂单 ID          #1
交易类型          卖出
价差              1.00%
部分成交          允许
最小数量          0.0011 MEMO
最大数量          0.1111 MEMO
剩余库存          1.1111 MEMO
做市商 ID        #1
做市商费率        0.50%
```

### 5. 选择计价模式

#### 按法币金额
```
计价模式: [按法币金额] 按 MEMO 数量
法币金额: 输入金额（元）
```
- 适合：知道想花多少钱的用户
- 示例：输入 "100" 表示花费 100 元购买 MEMO

#### 按 MEMO 数量
```
计价模式: 按法币金额 [按 MEMO 数量]
MEMO 数量: 输入数量
```
- 适合：知道想买多少 MEMO 的用户
- 示例：输入 "10" 表示购买 10 MEMO
- ⚠️ **注意**：数量必须在挂单的最小/最大范围内

### 6. 选择支付方式

```
支付方式: [支付宝] 或 [微信支付]
```

### 7. 创建订单

点击 **"创建订单（挂单 #1）"** 按钮：

**验证步骤**：
1. ✅ 检查是否选中挂单
2. ✅ 验证数量是否 >= 最小数量
3. ✅ 验证数量是否 <= 最大数量
4. ✅ 验证数量是否 <= 剩余库存

**验证失败示例**：
```
⚠️ 订单数量不能低于最小数量：0.0011 MEMO
⚠️ 订单数量不能超过最大数量：0.1111 MEMO
⚠️ 订单数量不能超过剩余库存：1.1111 MEMO
```

**验证成功**：
- 显示订单详情
- 生成支付二维码
- 开始轮询订单状态

### 8. 完成支付

#### 扫码支付
```
[二维码图片]
若无法扫码，点击打开支付链接 →
```

#### 订单信息
```
订单号:      otc-20251017-xxxx
购买MEMO:   10 MEMO
法币金额:    100.00 元
状态:       pending (蓝色)
有效期至:    2025-10-17 23:45:00
剩余时间:    300s
```

### 9. 等待确认

支付完成后，系统会自动轮询订单状态（每5秒）：

| 状态 | 说明 | 操作 |
|-----|------|------|
| `pending` | 待支付 | 扫码支付 |
| `paid_confirmed` | 已支付，待确认 | 等待做市商确认 |
| `authorized` | 已授权 | 可以领取 |
| `settled` | 已结算 | 可以领取 |
| `expired` | 已过期 | 重新创建订单 |
| `failed` | 失败 | 查看失败原因 |

### 10. 领取 MEMO

当订单状态变为 `paid_confirmed`、`authorized` 或 `settled` 时：

```
[支付已完成，前往领取] (绿色按钮)
```

点击按钮跳转到领取页面（`#/otc/claim`）。

## 🎨 UI 特性

### 颜色方案

页面采用与欢迎页、创建钱包、恢复钱包一致的UI风格：

- **主色调**: 紫色渐变 `#667eea → #764ba2`
- **成功色**: 绿色 `#52c41a`
- **警告色**: 橙色 `#fa8c16`
- **危险色**: 红色 `#ff4d4f`
- **背景色**: 浅蓝渐变 `#f0f5ff → #ffffff`

### 组件风格

- **卡片**: 圆角 12px，阴影 `0 2px 8px rgba(0,0,0,0.06)`
- **按钮**: 圆角 12px，渐变背景，阴影效果
- **图标**: 圆形背景，渐变色，阴影效果

### 响应式设计

- 最大宽度: 640px
- 自动居中
- 移动端适配
- 表格支持横向滚动

## 🔧 技术实现

### 查询做市商

```typescript
// ✅ 修复：从 activeMarketMakers 查询
const entries = await api.query.marketMaker.activeMarketMakers.entries()

for (const [key, value] of entries) {
  const mmId = key.args[0].toNumber()
  const app = value.unwrap()
  const appData = app.toJSON()
  // 处理做市商数据
}
```

### 查询挂单

```typescript
const entries = await api.query.otcListing.listings.entries()

for (const [key, value] of entries) {
  const listingId = key.args[0].toNumber()
  const listing = value.unwrap()
  const listingData = listing.toJSON()
  
  // 只显示激活且未过期的挂单
  if (listingData.active && listingData.expireAt > currentBlockNumber) {
    // 关联做市商信息
    const makerInfo = marketMakers.find(mm => mm.owner === listingData.maker)
    // 添加到列表
  }
}
```

### 数量验证

```typescript
// MEMO 使用 12 位小数
const orderAmount = BigInt(values.memoAmount) * BigInt(1e12)
const minQty = BigInt(selectedListing.minQty)
const maxQty = BigInt(selectedListing.maxQty)
const remaining = BigInt(selectedListing.remaining)

// 验证范围
if (orderAmount < minQty) {
  message.warning(`订单数量不能低于最小数量`)
}
if (orderAmount > maxQty) {
  message.warning(`订单数量不能超过最大数量`)
}
if (orderAmount > remaining) {
  message.warning(`订单数量不能超过剩余库存`)
}
```

### 订单创建

```typescript
const req = {
  providerId,
  payType: values.payType,
  // ✅ 挂单信息
  listingId: selectedListing.id,
  marketMakerId: selectedListing.makerInfo?.mmId,
  marketMakerOwner: selectedListing.maker,
  marketMakerFeeBps: selectedListing.makerInfo?.feeBps || 0,
  pricingSpreadBps: selectedListing.pricingSpreadBps,
  // 金额
  fiatAmount: values.fiatAmount,  // 或
  memoAmount: values.memoAmount,
  // 回跳URL
  returnUrl: `${location.origin}${location.pathname}#/otc/claim?provider=${providerId}`
}

const draft = await createOrder(req)
```

## 📝 注意事项

### ⚠️ 重要提示

1. **挂单选择**
   - 必须先选择挂单才能创建订单
   - 选择挂单会自动关联做市商

2. **数量限制**
   - 最小数量：挂单的 `minQty`
   - 最大数量：挂单的 `maxQty`
   - 剩余库存：挂单的 `remaining`

3. **过期时间**
   - 挂单有过期区块高度限制
   - 页面会自动过滤已过期的挂单
   - 订单也有有效期（通常15分钟）

4. **支付确认**
   - 支付完成后需等待做市商确认
   - 系统会自动轮询状态（每5秒）
   - 确认后可前往领取页面

5. **价格计算**
   - 价格由链上价格 + 价差计算
   - 价差单位为基点（bps）：100 bps = 1%
   - 最终价格由服务端返回

### 🐛 常见问题

#### 1. 为什么看不到挂单？

**可能原因**：
- 暂时没有做市商创建挂单
- 所有挂单都已过期
- 做市商未激活（不在 `activeMarketMakers` 中）
- 链端连接失败

**解决方法**：
- 等待做市商创建挂单
- 申请成为做市商并创建挂单
- 检查链端连接状态

#### 2. 为什么提示"订单数量不能低于最小数量"？

**原因**：选中的挂单有最小数量限制。

**解决方法**：
- 增加购买数量
- 选择最小数量更低的挂单

#### 3. 为什么提示"订单数量不能超过剩余库存"？

**原因**：挂单的剩余库存不足。

**解决方法**：
- 减少购买数量
- 选择库存充足的挂单

#### 4. 支付完成后多久可以领取？

**正常情况**：
- 做市商确认：通常几分钟内
- 自动轮询：每5秒检查一次状态
- 状态变为 `paid_confirmed` 后即可领取

**异常情况**：
- 超过15分钟未确认：订单可能过期
- 需要联系做市商或平台客服

## 🔗 相关页面

- **申请做市商**: `#/otc/mm-apply`
- **做市商配置**: `#/otc/market-maker-config`
- **创建挂单**: 使用 `memopark-governance` 平台
- **领取 MEMO**: `#/otc/claim`
- **我的钱包**: `#/profile` 或底部导航栏

## 📚 技术文档

- **前端源码**: `/home/xiaodong/文档/memopark/memopark-dapp/src/features/otc/CreateOrderPage.tsx`
- **挂单 pallet**: `/home/xiaodong/文档/memopark/pallets/otc-listing/`
- **做市商 pallet**: `/home/xiaodong/文档/memopark/pallets/market-maker/`
- **创建挂单脚本**: `/home/xiaodong/文档/memopark/memopark-gov-scripts/create-listing.js`

## 🎉 更新日志

### v1.0.0 (2025-10-17)

#### ✅ 修复
1. **做市商查询修复**
   - 从 `applications` 改为 `activeMarketMakers`
   - 只查询已批准的做市商
   - 避免显示待审核的申请

2. **挂单列表实现**
   - 新增挂单列表查询
   - 显示所有活跃且未过期的挂单
   - 自动关联做市商信息

3. **UI 改进**
   - 从做市商列表改为挂单列表
   - 添加挂单详情展示
   - 优化表格列显示
   - 添加区块高度实时更新

#### 🆕 新增功能
1. 挂单列表浏览
2. 挂单选择与详情展示
3. 数量范围验证
4. 基于挂单创建订单
5. 实时区块高度显示

---

**最后更新**: 2025-10-17  
**版本**: v1.0.0  
**维护者**: AI Assistant

