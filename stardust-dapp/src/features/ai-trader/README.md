# AI 策略模块

## 📦 模块说明

本模块提供基于深度学习的智能交易助手功能，包括交易信号生成、市场分析和自动化交易决策。

## 📁 文件结构

```
ai-strategy/
├── AITradingPanel.tsx       # AI 交易面板组件
├── AIStrategyDemo.tsx       # 演示页面
├── index.ts                 # 模块导出
└── README.md                # 本文件
```

## 🚀 快速开始

### 1. 导入组件

```tsx
import { AITradingPanel } from './features/ai-strategy';
```

### 2. 使用组件

```tsx
function TradingPage() {
  const handleExecuteTrade = (signal) => {
    console.log('执行交易:', signal);
    // 实现交易逻辑
  };

  return (
    <AITradingPanel
      symbol="MEMO-USDT"
      currentPrice={0.1}
      onExecuteTrade={handleExecuteTrade}
    />
  );
}
```

## 🎯 添加到路由

### 方式 1: 添加到主路由

编辑 `src/routes.tsx`:

```tsx
import { AIStrategyDemo } from './features/ai-strategy';

const routes = [
  // ... 其他路由
  {
    path: '/ai-strategy',
    element: <AIStrategyDemo />,
  },
];
```

### 方式 2: 添加到导航菜单

编辑导航配置文件:

```tsx
const menuItems = [
  // ... 其他菜单项
  {
    key: 'ai-strategy',
    label: 'AI 交易助手',
    icon: <ThunderboltOutlined />,
    path: '/ai-strategy',
  },
];
```

### 方式 3: 嵌入到现有页面

在任意页面中直接使用组件:

```tsx
import { AITradingPanel } from './features/ai-strategy';

function TradingDashboard() {
  return (
    <div>
      <h2>交易控制台</h2>
      
      {/* 其他交易组件 */}
      
      <AITradingPanel
        symbol="MEMO-USDT"
        currentPrice={0.1}
      />
    </div>
  );
}
```

## 📊 组件 Props

### AITradingPanel

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `symbol` | `string` | 否 | `"MEMO-USDT"` | 交易对符号 |
| `currentPrice` | `number` | 否 | `0.1` | 当前价格 |
| `serviceURL` | `string` | 否 | `undefined` | AI 服务地址 |
| `onExecuteTrade` | `function` | 否 | `undefined` | 执行交易回调 |

## 🔧 配置

### 环境变量

创建 `.env.local` 文件:

```bash
# AI 服务地址
VITE_AI_SERVICE_URL=http://localhost:8000

# 默认模型
VITE_AI_DEFAULT_MODEL=lstm

# 置信度阈值
VITE_AI_CONFIDENCE_THRESHOLD=60
```

### 使用环境变量

```tsx
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL;

<AITradingPanel serviceURL={AI_SERVICE_URL} />
```

## 💡 使用示例

### 示例 1: 基础使用

```tsx
<AITradingPanel
  symbol="MEMO-USDT"
  currentPrice={0.1}
/>
```

### 示例 2: 自定义服务地址

```tsx
<AITradingPanel
  symbol="BTC-USDT"
  currentPrice={45000}
  serviceURL="https://ai.yourdomain.com"
/>
```

### 示例 3: 集成交易功能

```tsx
import { useApi } from '../../hooks/useApi';
import { createTradingService } from '../../services/tradingService';

function AITrading() {
  const { api } = useApi();
  
  const handleExecuteTrade = async (signal) => {
    if (signal.confidence >= 70) {
      const tradingService = createTradingService(api);
      const tx = tradingService.buildCreateOrderTx({
        makerId: 1,
        qty: signal.position_size.toString(),
        contactCommit: '0x...',
      });
      await tx.signAndSend(signer);
    }
  };
  
  return (
    <AITradingPanel
      symbol="MEMO-USDT"
      currentPrice={0.1}
      onExecuteTrade={handleExecuteTrade}
    />
  );
}
```

## 🎨 自定义样式

组件使用 Ant Design，可以通过主题配置自定义样式:

```tsx
import { ConfigProvider } from 'antd';

<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff',
    },
  }}
>
  <AITradingPanel />
</ConfigProvider>
```

## 🧪 测试

### 单元测试

```typescript
import { render, screen } from '@testing-library/react';
import { AITradingPanel } from './AITradingPanel';

test('renders AI trading panel', () => {
  render(<AITradingPanel />);
  expect(screen.getByText('AI 交易助手')).toBeInTheDocument();
});
```

### 集成测试

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react';

test('gets trading signal', async () => {
  const { getByText } = render(<AITradingPanel />);
  
  fireEvent.click(getByText('获取 AI 交易信号'));
  
  await waitFor(() => {
    expect(getByText(/信号类型/i)).toBeInTheDocument();
  });
});
```

## 🐛 故障排除

### 问题 1: AI 服务连接失败

**原因**: AI 推理服务未启动

**解决方案**:
```bash
cd ~/文档/stardust/ai-inference-service
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 问题 2: 组件不显示

**原因**: 缺少必要的依赖

**解决方案**:
```bash
cd ~/文档/stardust/stardust-dapp
npm install
```

### 问题 3: TypeScript 错误

**原因**: 类型定义缺失

**解决方案**: 确保已导入所有必要的类型:
```tsx
import type { InferenceResult } from '../../services/aiInferenceService';
```

## 📚 相关文档

- [AI 服务快速开始](../../../docs/AI推理服务快速开始.md)
- [前端集成指南](../../../docs/AI服务前端集成指南.md)
- [API 文档](http://localhost:8000/docs)

## 🔗 依赖

- React 18+
- TypeScript 4.9+
- Ant Design 5+
- @polkadot/api (用于区块链集成)

## 📝 更新日志

### v1.0.0 (2025-11-04)
- ✨ 初始版本
- ✅ AI 交易面板组件
- ✅ 演示页面
- ✅ 完整文档

---

**维护者**: Stardust Team  
**最后更新**: 2025-11-04

