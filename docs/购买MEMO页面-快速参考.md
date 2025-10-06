# 购买 MEMO 页面 - 快速参考

## 页面访问

```
http://localhost:5173/#/otc/order
```

## 快速总览

### ✅ 已完成功能

1. **UI 风格统一**
   - 与欢迎、创建钱包、恢复钱包页面风格一致
   - 紫色渐变主题色
   - 白色卡片 + 圆角 12px
   - 浅蓝色渐变背景

2. **返回按钮**
   - 位置：左上角
   - 图标：左箭头
   - 样式：文本按钮

3. **标题区域**
   - 紫色圆形图标（购物车）
   - 主标题："购买 MEMO"
   - 副标题："选择做市商并完成支付"
   - 申请做市商链接

4. **做市商列表**
   - 白色卡片容器
   - 单选模式（Radio）
   - 按费率降序排列
   - 显示：ID、地址、费率、最小金额、质押金额

5. **选中提示**
   - 绿色提示框
   - 显示选中的做市商信息
   - 可关闭

6. **订单表单**
   - 白色卡片容器
   - 计价模式（法币/MEMO）
   - 金额输入
   - 支付方式选择

7. **底部提示**
   - 蓝色提示框
   - 内容："支付完成后，请耐心等待做市商确认。确认后，MEMO 将自动到账，请稍等片刻。"
   - 显示时机：
     - 未创建订单时显示
     - 订单创建后在订单信息下方显示

8. **提交按钮**
   - 紫色渐变背景
   - 高度：56px
   - 圆角：12px
   - 状态：未选择/已选择/创建中

9. **订单确认**
   - 白色卡片容器
   - 订单详情
   - 支付二维码
   - 绿色渐变"前往领取"按钮

## 颜色方案

| 元素 | 颜色 |
|------|------|
| 背景渐变 | `#f0f5ff` → `#ffffff` |
| 主按钮（紫色） | `#667eea` → `#764ba2` |
| 成功按钮（绿色） | `#52c41a` → `#389e0d` |
| 信息提示（蓝色） | `#e6f7ff` (背景) |
| 成功提示（绿色） | `#f6ffed` (背景) |
| 警告提示（黄色） | `#fff7e6` (背景) |
| 白色卡片 | `#ffffff` |

## 按钮样式

### 主按钮（紫色）
```tsx
{
  height: '56px',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  border: 'none',
  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
}
```

### 成功按钮（绿色）
```tsx
{
  height: '56px',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
  border: 'none',
  boxShadow: '0 4px 12px rgba(82, 196, 26, 0.3)',
}
```

## 卡片样式

```tsx
{
  background: '#fff',
  padding: '20px',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
}
```

## 提示框样式

### 信息提示（蓝色）
```tsx
{
  background: '#e6f7ff',
  border: '1px solid #91d5ff',
  padding: '16px',
  borderRadius: '12px',
}
```

### 成功提示（绿色）
```tsx
{
  background: '#f6ffed',
  border: '1px solid #b7eb8f',
  padding: '16px',
  borderRadius: '12px',
}
```

### 警告提示（黄色）
```tsx
{
  background: '#fff7e6',
  border: '1px solid #ffd591',
  padding: '12px',
  borderRadius: '8px',
}
```

## 用户流程

```
1. 进入页面
   ↓
2. 加载做市商列表
   ↓
3. 选择做市商（单选）
   ↓ 显示绿色提示框
4. 填写订单信息
   - 选择计价模式
   - 输入金额
   - 选择支付方式
   ↓ 查看蓝色底部提示
5. 点击"创建订单"按钮
   ↓
6. 显示订单信息和支付二维码
   ↓ 显示蓝色等待提示
7. 扫码支付
   ↓
8. 等待做市商确认
   ↓
9. 点击"前往领取"按钮
```

## 状态提示

| 状态 | 颜色 | 图标 | 提示 |
|------|------|------|------|
| 未选择做市商 | 黄色 | ⚠️ | 请先从做市商列表中选择一个做市商 |
| 已选择做市商 | 绿色 | ✓ | 已选择做市商 #X |
| 温馨提示 | 蓝色 | 🕐 | 支付完成后，请耐心等待做市商确认... |
| 等待确认 | 蓝色 | 🕐 | 支付完成后，请耐心等待做市商确认... |

## 图标使用

- **返回按钮**: `ArrowLeftOutlined`
- **主图标**: `ShoppingCartOutlined`
- **成功提示**: `CheckCircleOutlined`
- **等待提示**: `ClockCircleOutlined`

## 响应式设计

- 最大宽度：640px
- 移动端优先
- 自适应各种屏幕尺寸
- 按钮全宽显示

## 组件使用

```tsx
import CreateOrderPage from './features/otc/CreateOrderPage'

// 基本使用
<CreateOrderPage />

// 带返回按钮
<CreateOrderPage onBack={() => history.back()} />
```

## 相关页面

- 申请做市商：`#/otc/mm-apply`
- 领取 MEMO：`#/otc/claim`
- 我的钱包：`#/profile/wallet`

## 相关文档

- 详细说明：`购买MEMO页面UI优化说明.md`
- 选择做市商功能：`OTC订单选择做市商功能说明.md`
- 做市商申请：`pallets/market-maker/README.md`

## 完成日期

2025-10-06

