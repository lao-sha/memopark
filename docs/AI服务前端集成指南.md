# AI推理服务 - 前端集成指南

## 📚 概述

本指南介绍如何在前端项目中集成 AI 推理服务，实现智能交易信号生成和市场分析功能。

## 🎯 核心组件

### 1. AIInferenceService（服务层）
位置：`src/services/aiInferenceService.ts`

提供与 AI 推理服务的直接交互：
- 健康检查
- 获取交易信号
- 市场数据处理
- 模拟数据生成

### 2. useAIInference（Hook层）
位置：`src/hooks/useAIInference.ts`

React Hook，简化服务调用：
- 状态管理
- 错误处理
- 加载状态
- 便捷方法

### 3. AITradingPanel（组件层）
位置：`src/features/ai-strategy/AITradingPanel.tsx`

完整的 AI 交易面板组件：
- 交易信号展示
- 市场分析
- 特征重要性
- 一键执行交易

## 🚀 快速开始

### 方式 1: 使用组件（推荐）

最简单的方式是直接使用 `AITradingPanel` 组件：

```tsx
import { AITradingPanel } from './features/ai-strategy/AITradingPanel';

function TradingPage() {
  const handleExecuteTrade = (signal) => {
    console.log('执行交易:', signal);
    // 调用区块链交易接口
  };

  return (
    <AITradingPanel
      symbol="DUST-USDT"
      currentPrice={0.1}
      onExecuteTrade={handleExecuteTrade}
    />
  );
}
```

### 方式 2: 使用 Hook

如果需要自定义 UI，使用 `useAIInference` Hook：

```tsx
import { useAIInference } from './hooks/useAIInference';
import { Button, Spin, Alert } from 'antd';

function CustomTrading() {
  const {
    result,
    loading,
    error,
    getTradingSignalWithMockData,
  } = useAIInference();

  const handleGetSignal = async () => {
    try {
      await getTradingSignalWithMockData('DUST-USDT', 0.1);
    } catch (err) {
      console.error('获取信号失败:', err);
    }
  };

  return (
    <div>
      <Button onClick={handleGetSignal} loading={loading}>
        获取 AI 信号
      </Button>
      
      {error && <Alert type="error" message={error} />}
      
      {result && (
        <div>
          <h3>信号: {result.signal}</h3>
          <p>置信度: {result.confidence}%</p>
          <p>建议: {result.reasoning}</p>
        </div>
      )}
    </div>
  );
}
```

### 方式 3: 直接使用服务

最底层的API调用：

```tsx
import { getAIInferenceService } from './services/aiInferenceService';

async function getSignal() {
  const aiService = getAIInferenceService();
  
  // 检查服务健康状态
  const health = await aiService.checkHealth();
  console.log('服务状态:', health);
  
  // 生成模拟数据
  const marketData = aiService.generateMockMarketData('DUST-USDT', 0.1);
  
  // 获取交易信号
  const result = await aiService.getTradingSignal({
    strategy_id: 1,
    market_data: marketData,
    model_type: 'lstm',
    confidence_threshold: 60,
  });
  
  console.log('AI信号:', result);
  return result;
}
```

## 📊 集成到现有页面

### 集成到交易仪表板

```tsx
// src/components/trading/TradingDashboard.tsx
import { AITradingPanel } from '../../features/ai-strategy/AITradingPanel';
import { useApi } from '../../hooks/useApi';

function TradingDashboard() {
  const { api } = useApi();
  
  const handleExecuteTrade = async (signal) => {
    // 根据 AI 信号执行链上交易
    if (signal.signal === 'BUY') {
      const tx = api.tx.otcOrder.createOrder(
        signal.makerId,
        signal.position_size,
        signal.contactCommit
      );
      await tx.signAndSend(/* ... */);
    }
  };

  return (
    <div className="trading-dashboard">
      <h2>交易控制台</h2>
      
      {/* 其他交易组件 */}
      
      <AITradingPanel
        symbol="DUST-USDT"
        currentPrice={0.1}
        onExecuteTrade={handleExecuteTrade}
      />
    </div>
  );
}
```

### 集成到做市商管理

```tsx
// src/features/market-maker/MakerDashboard.tsx
import { useAIInference } from '../../hooks/useAIInference';

function MakerDashboard() {
  const { getTradingSignalWithMarketData } = useAIInference();
  
  // 定期获取 AI 建议
  useEffect(() => {
    const interval = setInterval(async () => {
      const marketData = await fetchRealMarketData();
      const signal = await getTradingSignalWithMarketData(marketData);
      
      // 根据 AI 信号调整做市策略
      if (signal.confidence > 80) {
        adjustMakerPricing(signal);
      }
    }, 60000); // 每分钟
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div>
      {/* 做市商面板内容 */}
    </div>
  );
}
```

## 🔧 高级用法

### 使用真实市场数据

```tsx
import { useAIInference } from './hooks/useAIInference';

function RealMarketTrading() {
  const { prepareMarketData, getTradingSignalWithMarketData } = useAIInference();
  
  const handleAnalyze = async () => {
    // 从交易所API或链上获取真实数据
    const { prices, volumes } = await fetchRealTimeData();
    
    // 准备市场数据
    const marketData = prepareMarketData(
      'DUST-USDT',
      0.1,
      prices,
      volumes
    );
    
    // 获取 AI 信号
    const signal = await getTradingSignalWithMarketData(marketData);
    console.log('AI分析结果:', signal);
  };
  
  return <button onClick={handleAnalyze}>分析市场</button>;
}
```

### 自定义 AI 服务地址

```tsx
// 开发环境
const AI_SERVICE_URL = 'http://localhost:8000';

// 生产环境
// const AI_SERVICE_URL = 'https://ai.yourdomain.com';

function App() {
  return (
    <AITradingPanel
      symbol="DUST-USDT"
      currentPrice={0.1}
      serviceURL={AI_SERVICE_URL}
    />
  );
}
```

### 批量分析多个交易对

```tsx
async function analyzMultipleSymbols() {
  const aiService = getAIInferenceService();
  const symbols = ['DUST-USDT', 'BTC-USDT', 'ETH-USDT'];
  
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const marketData = aiService.generateMockMarketData(symbol, 100);
      return aiService.getTradingSignal({
        strategy_id: 1,
        market_data: marketData,
      });
    })
  );
  
  console.log('批量分析结果:', results);
  return results;
}
```

## 🎨 UI 自定义

### 自定义信号展示

```tsx
import { useAIInference } from './hooks/useAIInference';
import { Card, Badge } from 'antd';

function CustomSignalDisplay() {
  const { result } = useAIInference();
  
  if (!result) return null;
  
  return (
    <Card>
      <Badge 
        status={result.signal === 'BUY' ? 'success' : 'error'}
        text={`${result.signal} (${result.confidence}%)`}
      />
      <div style={{ marginTop: 16 }}>
        <strong>建议价格:</strong> ${result.entry_price}
      </div>
      <div>
        <strong>止损:</strong> ${result.stop_loss}
      </div>
      <div>
        <strong>止盈:</strong> ${result.take_profit}
      </div>
    </Card>
  );
}
```

## 🔌 与区块链集成

### 结合 pallet-trading

```tsx
import { useApi } from './hooks/useApi';
import { useAIInference } from './hooks/useAIInference';
import { createTradingService } from './services/tradingService';

function AIEnhancedTrading() {
  const { api } = useApi();
  const { getTradingSignalWithMockData } = useAIInference();
  
  const handleAITrade = async () => {
    // 1. 获取 AI 信号
    const signal = await getTradingSignalWithMockData('DUST-USDT', 0.1);
    
    // 2. 如果信号强度足够，执行链上交易
    if (signal.confidence >= 70 && signal.signal !== 'HOLD') {
      const tradingService = createTradingService(api);
      
      // 3. 创建订单
      const tx = tradingService.buildCreateOrderTx({
        makerId: 1,
        qty: signal.position_size.toString(),
        contactCommit: '0x...',
      });
      
      // 4. 签名并发送
      await tx.signAndSend(signer, (result) => {
        if (result.status.isInBlock) {
          console.log('交易已上链:', result.txHash);
        }
      });
    }
  };
  
  return <button onClick={handleAITrade}>AI 智能交易</button>;
}
```

### 监听链上事件并触发 AI 分析

```tsx
import { useEffect } from 'react';
import { useApi } from './hooks/useApi';
import { useAIInference } from './hooks/useAIInference';

function EventDrivenAI() {
  const { api } = useApi();
  const { getTradingSignalWithMockData } = useAIInference();
  
  useEffect(() => {
    if (!api) return;
    
    // 监听价格变化事件
    const unsub = api.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record;
        
        if (event.section === 'pricing' && event.method === 'PriceUpdated') {
          const [symbol, price] = event.data;
          
          // 价格更新时自动获取 AI 分析
          getTradingSignalWithMockData(
            symbol.toString(),
            parseFloat(price.toString())
          ).then((signal) => {
            console.log('AI 自动分析:', signal);
            
            // 根据信号执行操作
            if (signal.confidence > 85) {
              // 高置信度信号，可以考虑自动交易
              notifyUser(signal);
            }
          });
        }
      });
    });
    
    return () => {
      unsub.then((u) => u());
    };
  }, [api, getTradingSignalWithMockData]);
  
  return <div>AI 自动监控中...</div>;
}
```

## 📱 移动端适配

组件已支持移动端自适应，响应式布局会自动调整。

```tsx
import { AITradingPanel } from './features/ai-strategy/AITradingPanel';

// 在移动端也能完美展示
function MobileApp() {
  return (
    <div className="mobile-container">
      <AITradingPanel
        symbol="DUST-USDT"
        currentPrice={0.1}
      />
    </div>
  );
}
```

## ⚙️ 配置选项

### 环境变量配置

创建 `.env.local` 文件：

```bash
# AI 推理服务地址
VITE_AI_SERVICE_URL=http://localhost:8000

# 默认模型类型
VITE_AI_DEFAULT_MODEL=lstm

# 默认置信度阈值
VITE_AI_CONFIDENCE_THRESHOLD=60

# 请求超时时间（毫秒）
VITE_AI_TIMEOUT=30000
```

在代码中使用：

```tsx
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

<AITradingPanel serviceURL={AI_SERVICE_URL} />
```

## 🐛 错误处理

### 处理服务不可用

```tsx
function RobustAIPanel() {
  const { error, checkHealth } = useAIInference();
  
  if (error?.includes('连接失败')) {
    return (
      <Alert
        type="warning"
        message="AI 服务暂时不可用"
        description="请确保 AI 推理服务已启动（http://localhost:8000）"
        action={
          <Button onClick={checkHealth}>重试连接</Button>
        }
      />
    );
  }
  
  return <AITradingPanel />;
}
```

### 降级策略

```tsx
function AIWithFallback() {
  const { result, error, getTradingSignalWithMockData } = useAIInference();
  const [fallbackSignal, setFallbackSignal] = useState(null);
  
  useEffect(() => {
    if (error) {
      // AI 服务失败，使用简单策略
      const simpleSignal = calculateSimpleSignal();
      setFallbackSignal(simpleSignal);
    }
  }, [error]);
  
  return (
    <div>
      {result && <div>AI 信号: {result.signal}</div>}
      {fallbackSignal && <div>备用信号: {fallbackSignal}</div>}
    </div>
  );
}
```

## 📊 性能优化

### 结果缓存

```tsx
import { useMemo } from 'react';

function CachedAIPanel() {
  const { result } = useAIInference();
  
  // 缓存特征重要性排序
  const sortedFeatures = useMemo(() => {
    if (!result?.feature_importance) return [];
    return Object.entries(result.feature_importance)
      .sort(([, a], [, b]) => b - a);
  }, [result]);
  
  return <div>{/* 使用 sortedFeatures */}</div>;
}
```

### 防抖请求

```tsx
import { useCallback, useRef } from 'react';

function DebouncedAI() {
  const { getTradingSignalWithMockData } = useAIInference();
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const debouncedGetSignal = useCallback((symbol, price) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      getTradingSignalWithMockData(symbol, price);
    }, 1000); // 1秒防抖
  }, [getTradingSignalWithMockData]);
  
  return <input onChange={(e) => debouncedGetSignal('DUST-USDT', e.target.value)} />;
}
```

## 🧪 测试

### 单元测试示例

```typescript
// AIInferenceService.test.ts
import { describe, it, expect } from 'vitest';
import { AIInferenceService } from './aiInferenceService';

describe('AIInferenceService', () => {
  it('should generate mock market data', () => {
    const service = new AIInferenceService();
    const data = service.generateMockMarketData('DUST-USDT', 0.1);
    
    expect(data.symbol).toBe('DUST-USDT');
    expect(data.current_price).toBe(0.1);
    expect(data.prices_1h).toHaveLength(12);
    expect(data.prices_24h).toHaveLength(288);
  });
});
```

## 📚 API 参考

### AIInferenceService

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `checkHealth()` | - | `Promise<HealthStatus>` | 检查服务健康状态 |
| `getTradingSignal()` | `InferenceRequest` | `Promise<InferenceResult>` | 获取交易信号 |
| `generateMockMarketData()` | `symbol, basePrice` | `MarketData` | 生成模拟数据 |
| `prepareMarketData()` | `symbol, price, prices, volumes` | `MarketData` | 准备真实数据 |

### useAIInference Hook

| 属性/方法 | 类型 | 说明 |
|----------|------|------|
| `result` | `InferenceResult \| null` | 推理结果 |
| `loading` | `boolean` | 加载状态 |
| `error` | `string \| null` | 错误信息 |
| `health` | `HealthStatus \| null` | 服务健康状态 |
| `getTradingSignal()` | `function` | 获取交易信号 |
| `getTradingSignalWithMockData()` | `function` | 使用模拟数据获取信号 |
| `checkHealth()` | `function` | 检查服务健康 |

## 🎯 最佳实践

1. **服务检查**: 应用启动时检查 AI 服务健康状态
2. **错误处理**: 始终处理服务不可用的情况
3. **用户反馈**: 提供清晰的加载和错误提示
4. **数据验证**: 验证市场数据格式和完整性
5. **性能优化**: 使用防抖和缓存减少不必要的请求
6. **安全性**: 不要在前端暴露敏感的 API 密钥

## 🔗 相关文档

- [AI推理服务快速开始](/docs/AI推理服务快速开始.md)
- [DeepSeek混合架构使用指南](/docs/DeepSeek混合架构使用指南.md)
- [Trading Service API](/src/services/tradingService.ts)

## 💡 示例项目

完整的集成示例参考：
- 组件: `/src/features/ai-strategy/AITradingPanel.tsx`
- Hook: `/src/hooks/useAIInference.ts`
- 服务: `/src/services/aiInferenceService.ts`

---

**最后更新**: 2025-11-04  
**版本**: 1.0.0

