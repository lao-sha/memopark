# 购买 MEMO 页面 UI 优化说明

## 优化概述

对购买 MEMO 页面（`http://localhost:5173/#/otc/order`）进行了全面 UI 重构，使其与欢迎、创建钱包、恢复钱包页面的风格保持一致，提升用户体验和视觉统一性。

## 主要改进

### 1. **整体布局与配色**

**背景渐变**：
```css
background: linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)
```
- 浅蓝色到白色的渐变背景
- 与钱包相关页面保持一致

**容器设置**：
- 最大宽度：640px（移动端优先）
- 内边距：20px
- 最小高度：100vh
- 居中对齐

### 2. **返回按钮**

**位置**：页面左上角
**样式**：
```tsx
<Button 
  type="text" 
  icon={<ArrowLeftOutlined />}
  onClick={onBack}
>
  返回
</Button>
```

**功能**：
- 点击返回上一页
- 文本按钮，不抢占视觉焦点
- 带有左箭头图标

### 3. **标题区域**

**设计元素**：
- **圆形图标**：
  - 尺寸：80x80px
  - 背景：紫色渐变 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
  - 图标：购物车图标（ShoppingCartOutlined）
  - 阴影：`0 8px 24px rgba(102, 126, 234, 0.3)`

- **主标题**：
  - 文字："购买 MEMO"
  - 颜色：`#667eea`（紫色）
  - 大小：h2

- **副标题**：
  - 文字："选择做市商并完成支付"
  - 样式：secondary
  - 大小：14px

- **申请做市商链接**：
  - 位置：标题下方
  - 样式：type="link"
  - 文字带箭头："申请成为做市商 →"

### 4. **做市商出价列表**

**卡片样式**：
```css
background: #fff
padding: 20px
borderRadius: 12px
boxShadow: 0 2px 8px rgba(0, 0, 0, 0.06)
```

**表格特性**：
- 白色背景卡片
- 圆角 12px
- 轻微阴影效果
- 紧凑型表格
- 单选（Radio）模式
- 可点击行选择

**列显示**：
- ID（蓝色标签）
- 做市商地址（可复制）
- 费率（颜色编码）
- 最小金额
- 质押金额

### 5. **选中做市商提示框**

**样式设计**：
```css
background: #f6ffed      /* 浅绿色背景 */
border: 1px solid #b7eb8f
padding: 16px
borderRadius: 12px
```

**内容元素**：
- ✓ 图标（CheckCircleOutlined，绿色）
- 标题："已选择做市商"（绿色粗体）
- 做市商详细信息：
  - 做市商 ID
  - 费率（带颜色标签）
  - 最小金额
- 关闭按钮（右上角）

### 6. **订单表单**

**卡片样式**：
```css
background: #fff
padding: 20px
borderRadius: 12px
boxShadow: 0 2px 8px rgba(0, 0, 0, 0.06)
```

**表单字段**：
1. **计价模式**：单选按钮组
   - 按法币金额
   - 按 MEMO 数量

2. **金额输入**：根据计价模式动态显示
   - 法币金额（支持小数）
   - MEMO 数量（整数）

3. **支付方式**：下拉选择
   - 支付宝
   - 微信支付

### 7. **提交按钮**

**渐变样式**：
```css
height: 56px
fontSize: 16px
fontWeight: bold
borderRadius: 12px
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
border: none
boxShadow: 0 4px 12px rgba(102, 126, 234, 0.3)
```

**状态变化**：
- **未选择做市商**：禁用状态，灰色
- **已选择做市商**：紫色渐变，带阴影
- **创建中**：加载状态

**按钮文字**：
- 未选择："请先选择做市商"
- 已选择："创建订单（做市商 #X）"
- 创建中："创建中..."

### 8. **未选择做市商警告**

**样式设计**：
```css
background: #fff7e6      /* 浅黄色背景 */
border: 1px solid #ffd591
padding: 12px
borderRadius: 8px
```

**内容**：
```
⚠️ 请先从做市商列表中选择一个做市商
```

### 9. **底部温馨提示**

**样式设计**：
```css
background: #e6f7ff      /* 浅蓝色背景 */
border: 1px solid #91d5ff
padding: 16px
borderRadius: 12px
```

**内容布局**：
- 图标：ClockCircleOutlined（蓝色）
- 标题："温馨提示"（蓝色粗体）
- 提示文字："支付完成后，请耐心等待做市商确认。确认后，MEMO 将自动到账，请稍等片刻。"

**显示时机**：
- 未创建订单时显示
- 创建订单后隐藏

### 10. **订单确认区域**

**卡片样式**：
```css
background: #fff
padding: 20px
borderRadius: 12px
boxShadow: 0 2px 8px rgba(0, 0, 0, 0.06)
```

**内容包含**：
- 订单详情（订单号、金额、状态等）
- 支付二维码
- 支付链接
- "前往领取"按钮（绿色渐变）

**领取按钮样式**：
```css
height: 56px
fontSize: 16px
fontWeight: bold
borderRadius: 12px
background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%)
boxShadow: 0 4px 12px rgba(82, 196, 26, 0.3)
```

### 11. **订单提交后提示**

**样式设计**：
```css
background: #e6f7ff      /* 浅蓝色背景 */
border: 1px solid #91d5ff
padding: 16px
borderRadius: 12px
```

**内容布局**：
- 图标：ClockCircleOutlined（蓝色）
- 标题："等待确认"（蓝色粗体）
- 提示文字："支付完成后，请耐心等待做市商确认。确认后，MEMO 将自动到账，请稍等片刻。"

**显示时机**：
- 订单创建成功后显示
- 在订单信息卡片下方

## 颜色方案

### 主色调

| 用途 | 颜色 | 渐变 |
|------|------|------|
| 主按钮（紫色） | #667eea | linear-gradient(135deg, #667eea 0%, #764ba2 100%) |
| 成功按钮（绿色） | #52c41a | linear-gradient(135deg, #52c41a 0%, #389e0d 100%) |
| 信息提示（蓝色） | #1890ff | #e6f7ff (背景) |
| 成功提示（绿色） | #52c41a | #f6ffed (背景) |
| 警告提示（黄色） | #faad14 | #fff7e6 (背景) |
| 背景渐变 | - | linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%) |

### 辅助颜色

| 用途 | 颜色 |
|------|------|
| 文字（主要） | #262626 |
| 文字（次要） | #595959 |
| 边框 | #d9d9d9 |
| 卡片背景 | #ffffff |
| 阴影 | rgba(0, 0, 0, 0.06) |

## 响应式设计

### 移动端优先
- 最大宽度：640px
- 自适应各种屏幕尺寸
- 按钮全宽（block）
- 适当的内边距和间距

### 桌面端
- 居中显示
- 两侧留白
- 保持最佳阅读宽度

## 用户体验优化

### 1. **视觉层次**
- 清晰的标题层次
- 重要信息突出显示
- 合理的空白空间

### 2. **操作反馈**
- 按钮状态清晰（禁用/启用/加载）
- 选中状态明确（绿色提示框）
- 错误和警告醒目（黄色警告框）

### 3. **引导提示**
- 底部温馨提示（蓝色框）
- 未选择做市商警告（黄色框）
- 订单确认提示（蓝色框）

### 4. **色彩语言**
- 蓝色：信息、等待
- 绿色：成功、确认
- 黄色：警告、注意
- 紫色：主要操作

### 5. **动效设计**
- 按钮渐变背景
- 柔和的阴影效果
- 平滑的状态转换

## 一致性保持

### 与其他页面的一致性

1. **欢迎页面**：
   - 相同的背景渐变
   - 相同的圆形图标设计
   - 相同的按钮样式

2. **创建钱包页面**：
   - 相同的卡片样式
   - 相同的表单布局
   - 相同的按钮尺寸

3. **恢复钱包页面**：
   - 相同的提示框样式
   - 相同的文字颜色
   - 相同的圆角和阴影

## 技术实现

### 组件结构

```tsx
<div style="主容器">
  {/* 返回按钮 */}
  
  {/* 标题区域 */}
  <div>
    <div>圆形图标</div>
    <Title>购买 MEMO</Title>
    <Text>选择做市商并完成支付</Text>
    <Button>申请成为做市商</Button>
  </div>
  
  {/* 做市商列表 */}
  <div style="白色卡片">
    <Table />
  </div>
  
  {/* 选中提示 */}
  {selectedMaker && <div style="绿色提示框" />}
  
  {/* 订单表单 */}
  <div style="白色卡片">
    <Form>
      {/* 表单字段 */}
      <Button>创建订单</Button>
    </Form>
  </div>
  
  {/* 底部提示 */}
  {!order && <div style="蓝色提示框" />}
  
  {/* 订单信息 */}
  {order && <div style="白色卡片" />}
  
  {/* 订单提交后提示 */}
  {order && <div style="蓝色提示框" />}
</div>
```

### 样式常量

可以提取为常量或主题变量：

```tsx
const THEME = {
  colors: {
    primary: '#667eea',
    success: '#52c41a',
    info: '#1890ff',
    warning: '#faad14',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    success: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
    background: 'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
  },
  spacing: {
    containerPadding: '20px',
    cardPadding: '20px',
    cardRadius: '12px',
    buttonRadius: '12px',
  },
  sizes: {
    maxWidth: '640px',
    iconSize: '80px',
    buttonHeight: '56px',
  },
}
```

## 使用示例

### 基本使用

```tsx
import CreateOrderPage from './features/otc/CreateOrderPage'

// 在路由中使用
<Route path="/otc/order" element={<CreateOrderPage />} />

// 带返回按钮
<CreateOrderPage onBack={() => history.back()} />
```

### 从其他页面跳转

```tsx
// 从钱包页面跳转
<Button onClick={() => window.location.hash = '#/otc/order'}>
  购买 MEMO
</Button>
```

## 测试要点

### 视觉测试
- ✅ 颜色与其他页面一致
- ✅ 布局在不同屏幕尺寸下正常
- ✅ 圆角和阴影效果正确
- ✅ 渐变背景显示正常

### 功能测试
- ✅ 返回按钮可用
- ✅ 选择做市商功能正常
- ✅ 表单验证正确
- ✅ 创建订单流程完整
- ✅ 提示信息准确

### 交互测试
- ✅ 按钮状态切换正常
- ✅ 选中状态显示清晰
- ✅ 加载状态反馈及时
- ✅ 错误提示明确

## 已完成项目

- ✅ 整体布局重构
- ✅ 返回按钮添加
- ✅ 标题区域设计
- ✅ 做市商列表卡片样式
- ✅ 选中提示框设计
- ✅ 订单表单卡片样式
- ✅ 提交按钮渐变效果
- ✅ 底部温馨提示
- ✅ 订单确认区域
- ✅ 订单提交后提示
- ✅ 颜色方案统一
- ✅ 圆角和阴影一致
- ✅ 移动端响应式

## 相关文件

- **页面组件**：`memopark-dapp/src/features/otc/CreateOrderPage.tsx`
- **参考页面**：
  - `memopark-dapp/src/features/auth/WalletWelcomePage.tsx`
  - `memopark-dapp/src/features/auth/CreateWalletPage.tsx`
  - `memopark-dapp/src/features/auth/RestoreWalletPage.tsx`
- **路由配置**：`memopark-dapp/src/routes.tsx`

## 完成日期

2025-10-06

## 遵循规则

- ✅ 函数级详细中文注释
- ✅ UI 颜色方案与欢迎、创建钱包、恢复钱包保持一致
- ✅ 返回按钮已添加
- ✅ 底部温馨提示已添加
- ✅ 组件化设计
- ✅ 移动端优先
- ✅ 自适应布局

