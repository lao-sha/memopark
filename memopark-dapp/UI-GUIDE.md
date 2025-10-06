# Memopark DApp UI 组件库使用指南

## 概述

基于 Talisman 钱包的设计理念，我们为 memopark-dapp 创建了一套现代化的 UI 组件库。该组件库采用玻璃态拟物化（Glassmorphism）设计风格，专为 Web3 纪念园区应用优化。

## 设计原则

### 1. 玻璃态美学
- 半透明背景与模糊效果
- 柔和的渐变和光影
- 现代化的毛玻璃质感

### 2. 情感化设计
- 温暖的纪念色彩系统
- 优雅的动画过渡
- 尊重和怀念的氛围营造

### 3. Web3 原生
- 钱包连接优先
- 区块链交互友好
- 去中心化应用体验

## 核心组件

### 按钮组件 (Button)
```tsx
import { Button, MemorialButton, ConnectWalletButton } from '@/components/ui';

// 基础用法
<Button variant="primary">主要按钮</Button>
<Button variant="memorial" glassmorphism>纪念按钮</Button>
<ConnectWalletButton>连接钱包</ConnectWalletButton>

// 状态和尺寸
<Button loading size="lg">加载中...</Button>
<Button disabled>禁用状态</Button>
```

**特点：**
- 5种样式变体：primary, secondary, memorial, ghost, danger
- 3种尺寸：sm, md, lg
- 支持加载状态和图标
- 内置玻璃态效果

### 卡片组件 (Card)
```tsx
import { Card, MemorialCard, StatCard, MemorialGalleryCard } from '@/components/ui';

// 基础卡片
<Card glassmorphism hoverable>
  <h3>卡片标题</h3>
  <p>卡片内容</p>
</Card>

// 纪念卡片
<MemorialCard>
  <h3>张三的纪念馆</h3>
  <p>永远怀念...</p>
</MemorialCard>

// 统计卡片
<StatCard
  title="总用户数"
  value="12,345"
  subtitle="较昨日 +5.2%"
/>

// 纪念馆展示卡片
<MemorialGalleryCard
  title="李四的纪念园"
  description="充满爱与思念的永恒空间..."
  date="2024-02-20"
  onClick={() => navigate('/memorial/123')}
/>
```

**特点：**
- 多种专用卡片类型
- 悬停效果和点击处理
- 响应式设计
- 玻璃态材质

### 表单组件 (Input, Textarea, Select)
```tsx
import { Input, Textarea, Select, FileInput } from '@/components/ui';

// 输入框
<Input
  label="纪念馆名称"
  placeholder="请输入纪念馆名称"
  leftIcon={<MemorialIcon />}
  hint="名称将公开显示"
  glassmorphism
/>

// 下拉选择
<Select
  label="纪念类型"
  options={[
    { value: 'person', label: '个人纪念' },
    { value: 'pet', label: '宠物纪念' },
    { value: 'event', label: '事件纪念' }
  ]}
  placeholder="请选择纪念类型"
/>

// 文件上传
<FileInput
  label="纪念照片"
  accept="image/*"
  multiple
  dragAndDrop
  hint="支持 JPG, PNG 格式，最大 10MB"
/>
```

**特点：**
- 统一的标签、错误和提示样式
- 支持图标和玻璃态效果
- 拖拽上传功能
- 表单验证集成

### 模态对话框 (Modal)
```tsx
import { Modal, WalletConnectionModal, TransactionModal } from '@/components/ui';

// 基础模态框
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="创建纪念馆"
  size="lg"
>
  <div className="p-6">
    <CreateMemorialForm />
  </div>
</Modal>

// 钱包连接模态框
<WalletConnectionModal
  isOpen={showWalletModal}
  onClose={() => setShowWalletModal(false)}
>
  {/* 自动处理钱包选择和账户连接 */}
</WalletConnectionModal>
```

**特点：**
- 响应式尺寸控制
- ESC键和遮罩关闭
- 自动聚焦管理
- 专用钱包连接模态框

### 导航组件 (Navigation)
```tsx
import { Navigation, SidebarNavigation } from '@/components/ui';

const navItems = [
  { id: 'home', label: '首页', icon: '🏠' },
  { id: 'memorial', label: '纪念馆', icon: '🏛️', badge: '3' },
  { id: 'offerings', label: '祭品', icon: '🕯️' },
  { id: 'governance', label: '治理', icon: '🗳️' },
];

// 顶部导航
<Navigation
  items={navItems}
  activeItem="home"
  onItemClick={(id) => navigate(`/${id}`)}
/>

// 侧边栏导航
<SidebarNavigation
  items={navItems}
  isOpen={sidebarOpen}
  onToggle={() => setSidebarOpen(!sidebarOpen)}
/>
```

**特点：**
- 响应式设计（桌面/移动端）
- 内置钱包连接组件
- 徽章和活动状态支持
- 可折叠侧边栏

### 钱包连接 (WalletConnection)
```tsx
import { WalletConnection } from '@/components/ui';

<WalletConnection
  onConnect={(account) => {
    console.log('已连接账户:', account);
    // 处理连接逻辑
  }}
  onDisconnect={() => {
    console.log('钱包已断开');
    // 处理断开逻辑
  }}
/>
```

**特点：**
- 支持多种钱包（Polkadot.js, Talisman, SubWallet）
- 自动检测已安装钱包
- 账户选择界面
- 连接状态显示

## 主题系统

### 颜色规范
```typescript
const theme = {
  colors: {
    primary: '#0ea5e9',      // 主品牌色
    memorial: '#a855f7',     // 纪念紫色
    dark: {
      primary: '#121212',    // 主背景
      secondary: '#1B1B1B',  // 次级背景
      tertiary: '#262626',   // 三级背景
    },
    text: {
      primary: '#fafafa',    // 主文本
      secondary: '#a5a5a5',  // 次要文本
      disabled: '#5a5a5a',   // 禁用文本
    }
  }
};
```

### 玻璃态效果
```css
.glass-light {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-heavy {
  background: rgba(27, 27, 27, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

## 使用建议

### 1. 页面布局
```tsx
function MemorialPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <Navigation items={navItems} />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 主内容 */}
          <div className="lg:col-span-2 space-y-6">
            <MemorialCard>
              <MemorialDetails />
            </MemorialCard>
          </div>
          
          {/* 侧边栏 */}
          <div className="space-y-6">
            <StatCard title="访问量" value="1,234" />
            <Card>
              <RecentActivities />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### 2. 表单处理
```tsx
function CreateMemorialForm() {
  return (
    <form className="space-y-6">
      <Input
        label="纪念馆名称"
        placeholder="请输入名称"
        glassmorphism
      />
      
      <Textarea
        label="纪念词"
        placeholder="写下您的思念..."
        glassmorphism
      />
      
      <FileInput
        label="纪念照片"
        accept="image/*"
        multiple
      />
      
      <div className="flex gap-4">
        <Button variant="memorial" type="submit" fullWidth>
          创建纪念馆
        </Button>
        <Button variant="ghost" type="button">
          保存草稿
        </Button>
      </div>
    </form>
  );
}
```

### 3. 响应式设计
- 所有组件都支持响应式设计
- 使用 Tailwind CSS 的响应式类名
- 移动端优先的设计理念

### 4. 无障碍支持
- 键盘导航支持
- ARIA 标签完整
- 高对比度模式兼容
- 屏幕阅读器友好

## 最佳实践

1. **组件组合**：优先使用专用组件（如 MemorialButton），而不是通用组件
2. **状态管理**：使用 React Hook 管理组件状态
3. **性能优化**：合理使用 React.memo 和 useMemo
4. **错误处理**：在组件级别处理错误状态
5. **类型安全**：充分利用 TypeScript 类型检查

## 未来规划

- [ ] 更多动画效果
- [ ] 暗黑/明亮主题切换
- [ ] 更多图标库集成
- [ ] 国际化支持
- [ ] 组件文档生成
- [ ] 单元测试覆盖

这套组件库为 memopark-dapp 提供了现代化、一致性的用户界面基础，能够创造出令人印象深刻的 Web3 纪念园区体验。
