# AI交易系统前端设计方案

> 编写时间：2025-11-04  
> 版本：v1.0  
> 父文档：AI驱动的Substrate-Hyperliquid自动化交易系统综合方案

---

## 1️⃣ 技术栈

### 1.1 核心技术

```json
{
  "framework": "React 18",
  "language": "TypeScript 5.0",
  "ui_library": "Ant Design 5",
  "charts": "Apache ECharts 5",
  "blockchain": "Polkadot.js API",
  "state_management": "Zustand",
  "routing": "React Router v6",
  "build_tool": "Vite"
}
```

### 1.2 依赖包

```json
// package.json
{
  "name": "stardust-ai-trading",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "antd": "^5.11.0",
    "@ant-design/icons": "^5.2.6",
    "@polkadot/api": "^10.11.2",
    "@polkadot/extension-dapp": "^0.46.6",
    "echarts": "^5.4.3",
    "echarts-for-react": "^3.0.2",
    "zustand": "^4.4.7",
    "axios": "^1.6.2",
    "dayjs": "^1.11.10",
    "bignumber.js": "^9.1.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.7"
  }
}
```

---

## 2️⃣ 页面结构

### 2.1 路由设计

```tsx
// src/routes/index.tsx

import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';

// 页面组件
import Dashboard from '@/pages/Dashboard';
import StrategyList from '@/pages/Strategy/List';
import StrategyCreate from '@/pages/Strategy/Create';
import StrategyDetail from '@/pages/Strategy/Detail';
import AISignals from '@/pages/AISignals';
import Portfolio from '@/pages/Portfolio';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'strategies',
        children: [
          { index: true, element: <StrategyList /> },
          { path: 'create', element: <StrategyCreate /> },
          { path: ':id', element: <StrategyDetail /> },
        ],
      },
      {
        path: 'ai-signals',
        element: <AISignals />,
      },
      {
        path: 'portfolio',
        element: <Portfolio />,
      },
      {
        path: 'analytics',
        element: <Analytics />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
]);
```

### 2.2 页面架构

```
src/
├── pages/
│   ├── Dashboard/              # 仪表板
│   │   ├── index.tsx
│   │   ├── components/
│   │   │   ├── OverviewCards.tsx
│   │   │   ├── PerformanceChart.tsx
│   │   │   ├── ActiveStrategies.tsx
│   │   │   ├── RecentSignals.tsx
│   │   │   └── MarketOverview.tsx
│   │   └── styles.module.css
│   │
│   ├── Strategy/               # 策略管理
│   │   ├── List/
│   │   │   ├── index.tsx
│   │   │   ├── StrategyCard.tsx
│   │   │   └── FilterPanel.tsx
│   │   ├── Create/
│   │   │   ├── index.tsx
│   │   │   ├── StepBasicInfo.tsx
│   │   │   ├── StepAIConfig.tsx
│   │   │   ├── StepStrategyParams.tsx
│   │   │   ├── StepRiskControl.tsx
│   │   │   └── StepConfirm.tsx
│   │   └── Detail/
│   │       ├── index.tsx
│   │       ├── StrategyInfo.tsx
│   │       ├── PerformanceMetrics.tsx
│   │       ├── SignalHistory.tsx
│   │       └── TradeHistory.tsx
│   │
│   ├── AISignals/              # AI信号监控
│   │   ├── index.tsx
│   │   ├── SignalTimeline.tsx
│   │   ├── SignalDetail.tsx
│   │   └── ReasoningViewer.tsx
│   │
│   ├── Portfolio/              # 投资组合
│   │   ├── index.tsx
│   │   ├── PositionList.tsx
│   │   ├── PnLChart.tsx
│   │   └── AssetAllocation.tsx
│   │
│   ├── Analytics/              # 数据分析
│   │   ├── index.tsx
│   │   ├── BacktestPanel.tsx
│   │   ├── ModelComparison.tsx
│   │   └── FeatureImportance.tsx
│   │
│   └── Settings/               # 设置
│       ├── index.tsx
│       ├── AccountSettings.tsx
│       ├── APIKeys.tsx
│       └── NotificationSettings.tsx
│
├── components/                 # 通用组件
│   ├── AccountSelector/
│   ├── WalletConnect/
│   ├── SignalBadge/
│   ├── ConfidenceMeter/
│   ├── RiskIndicator/
│   └── ...
│
├── hooks/                      # 自定义Hooks
│   ├── useSubstrate.ts
│   ├── useStrategy.ts
│   ├── useAISignals.ts
│   ├── usePortfolio.ts
│   └── ...
│
├── services/                   # API服务
│   ├── substrate.ts
│   ├── hyperliquid.ts
│   ├── ipfs.ts
│   └── ...
│
├── stores/                     # 状态管理
│   ├── useWalletStore.ts
│   ├── useStrategyStore.ts
│   ├── useSignalStore.ts
│   └── ...
│
├── types/                      # 类型定义
│   ├── strategy.ts
│   ├── signal.ts
│   ├── portfolio.ts
│   └── ...
│
└── utils/                      # 工具函数
    ├── format.ts
    ├── calculate.ts
    └── ...
```

---

## 3️⃣ 核心页面设计

### 3.1 Dashboard (仪表板)

#### 功能概述
展示用户的整体交易情况、活跃策略和最新AI信号。

#### 组件结构

```tsx
// src/pages/Dashboard/index.tsx

import React from 'react';
import { Row, Col, Card, Statistic, Space } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import OverviewCards from './components/OverviewCards';
import PerformanceChart from './components/PerformanceChart';
import ActiveStrategies from './components/ActiveStrategies';
import RecentSignals from './components/RecentSignals';
import MarketOverview from './components/MarketOverview';
import { usePortfolio } from '@/hooks/usePortfolio';

const Dashboard: React.FC = () => {
  const { totalValue, totalPnL, totalPnLPercent, isLoading } = usePortfolio();

  return (
    <div className="dashboard-container">
      {/* 概览卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总资产价值"
              value={totalValue}
              precision={2}
              prefix="$"
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总盈亏"
              value={totalPnL}
              precision={2}
              prefix="$"
              valueStyle={{
                color: totalPnL >= 0 ? '#3f8600' : '#cf1322',
              }}
              prefix={totalPnL >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix={`(${totalPnLPercent}%)`}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃策略"
              value={5}
              prefix={<RobotOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日AI信号"
              value={12}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 表现图表 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="账户表现" extra={<Space>过滤选项</Space>}>
            <PerformanceChart />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="市场概览">
            <MarketOverview />
          </Card>
        </Col>
      </Row>

      {/* 活跃策略和最近信号 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="活跃策略">
            <ActiveStrategies />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最新AI信号">
            <RecentSignals />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
```

#### 性能图表组件

```tsx
// src/pages/Dashboard/components/PerformanceChart.tsx

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { usePortfolio } from '@/hooks/usePortfolio';
import dayjs from 'dayjs';

const PerformanceChart: React.FC = () => {
  const { performanceHistory } = usePortfolio();

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: ['账户价值', '盈亏'],
    },
    xAxis: {
      type: 'category',
      data: performanceHistory.map(item => 
        dayjs(item.timestamp).format('MM-DD HH:mm')
      ),
    },
    yAxis: [
      {
        type: 'value',
        name: '账户价值 ($)',
        position: 'left',
      },
      {
        type: 'value',
        name: '盈亏 ($)',
        position: 'right',
      },
    ],
    series: [
      {
        name: '账户价值',
        type: 'line',
        data: performanceHistory.map(item => item.totalValue),
        smooth: true,
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '盈亏',
        type: 'bar',
        yAxisIndex: 1,
        data: performanceHistory.map(item => item.pnl),
        itemStyle: {
          color: (params: any) => params.value >= 0 ? '#52c41a' : '#ff4d4f',
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};

export default PerformanceChart;
```

---

### 3.2 Strategy Create (创建策略)

#### 功能概述
分步骤引导用户创建AI增强的交易策略。

#### 步骤流程

```
Step 1: 基础信息
  - 策略名称
  - 交易对选择
  - Hyperliquid账户地址

Step 2: AI配置
  - 模型选择 (GPT-4/Transformer/LSTM/Ensemble)
  - 置信度阈值
  - 特征集选择
  - 推理服务配置

Step 3: 策略参数
  - 策略类型 (网格/做市/套利)
  - 具体参数配置

Step 4: 风控设置
  - 最大仓位
  - 最大杠杆
  - 止损止盈
  - 每日限制

Step 5: 确认提交
  - 预览所有配置
  - 预估Gas费用
  - 确认提交到链上
```

#### 代码实现

```tsx
// src/pages/Strategy/Create/index.tsx

import React, { useState } from 'react';
import { Steps, Card, Button, message, Form } from 'antd';
import { useNavigate } from 'react-router-dom';
import StepBasicInfo from './StepBasicInfo';
import StepAIConfig from './StepAIConfig';
import StepStrategyParams from './StepStrategyParams';
import StepRiskControl from './StepRiskControl';
import StepConfirm from './StepConfirm';
import { useSubstrate } from '@/hooks/useSubstrate';
import type { StrategyFormData } from '@/types/strategy';

const steps = [
  { title: '基础信息', content: StepBasicInfo },
  { title: 'AI配置', content: StepAIConfig },
  { title: '策略参数', content: StepStrategyParams },
  { title: '风控设置', content: StepRiskControl },
  { title: '确认提交', content: StepConfirm },
];

const StrategyCreate: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<Partial<StrategyFormData>>({});
  const navigate = useNavigate();
  const { api, currentAccount } = useSubstrate();

  const next = async () => {
    try {
      // 验证当前步骤
      const values = await form.validateFields();
      setFormData({ ...formData, ...values });
      setCurrent(current + 1);
    } catch (error) {
      message.error('请完成必填项');
    }
  };

  const prev = () => {
    setCurrent(current - 1);
  };

  const onFinish = async () => {
    try {
      message.loading({ content: '正在创建策略...', key: 'create' });

      // 调用链上接口
      const tx = api.tx.aiStrategy.createAiStrategy(
        formData.name,
        formData.hlAddress,
        formData.symbol,
        formData.aiConfig,
        formData.strategyType,
        formData.strategyParams,
        formData.riskLimits,
      );

      await tx.signAndSend(currentAccount, ({ status, events }) => {
        if (status.isInBlock) {
          message.success({
            content: '策略创建成功！',
            key: 'create',
          });
          navigate('/strategies');
        }
      });
    } catch (error) {
      message.error({ content: '创建失败：' + error.message, key: 'create' });
    }
  };

  const StepComponent = steps[current].content;

  return (
    <div className="strategy-create-container">
      <Card>
        <Steps current={current} items={steps} />
        
        <Form
          form={form}
          layout="vertical"
          initialValues={formData}
          style={{ marginTop: 32 }}
        >
          <StepComponent />
        </Form>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          {current > 0 && (
            <Button style={{ margin: '0 8px' }} onClick={prev}>
              上一步
            </Button>
          )}
          {current < steps.length - 1 && (
            <Button type="primary" onClick={next}>
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" onClick={onFinish}>
              提交创建
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StrategyCreate;
```

#### AI配置步骤

```tsx
// src/pages/Strategy/Create/StepAIConfig.tsx

import React from 'react';
import { Form, Select, Slider, Checkbox, Input, Row, Col, Card, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Text } = Typography;

const StepAIConfig: React.FC = () => {
  return (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="AI模型选择"
            name={['aiConfig', 'primaryModel']}
            rules={[{ required: true, message: '请选择AI模型' }]}
            tooltip={{
              title: '不同模型适用于不同场景',
              icon: <InfoCircleOutlined />,
            }}
          >
            <Select placeholder="选择AI模型">
              <Option value="ensemble">
                <div>
                  <div><strong>集成模型 (推荐)</strong></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    组合多个模型，准确率最高
                  </Text>
                </div>
              </Option>
              <Option value="gpt4">
                <div>
                  <div><strong>GPT-4</strong></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    综合分析能力强，可解释性好
                  </Text>
                </div>
              </Option>
              <Option value="transformer">
                <div>
                  <div><strong>Transformer</strong></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    技术分析专用，响应快
                  </Text>
                </div>
              </Option>
              <Option value="lstm">
                <div>
                  <div><strong>LSTM</strong></div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    短期预测，延迟低
                  </Text>
                </div>
              </Option>
            </Select>
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            label="备用模型"
            name={['aiConfig', 'fallbackModel']}
            tooltip="主模型失败时使用"
          >
            <Select placeholder="选择备用模型" allowClear>
              <Option value="transformer">Transformer</Option>
              <Option value="lstm">LSTM</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label={
          <span>
            置信度阈值: <Text type="secondary">(只执行高于此值的信号)</Text>
          </span>
        }
        name={['aiConfig', 'confidenceThreshold']}
        initialValue={60}
        rules={[{ required: true }]}
      >
        <Slider
          min={50}
          max={95}
          marks={{
            50: '50%',
            60: '60%',
            70: '70%',
            80: '80%',
            95: '95%',
          }}
          tooltip={{ formatter: (value) => `${value}%` }}
        />
      </Form.Item>

      <Form.Item
        label="特征集选择"
        name={['aiConfig', 'featuresEnabled']}
        initialValue={['technical', 'sentiment', 'onchain', 'macro']}
      >
        <Checkbox.Group style={{ width: '100%' }}>
          <Row>
            <Col span={12}>
              <Checkbox value="technical">
                技术指标 (RSI, MACD, 布林带等)
              </Checkbox>
            </Col>
            <Col span={12}>
              <Checkbox value="sentiment">
                情绪分析 (Twitter, Reddit, 恐慌指数)
              </Checkbox>
            </Col>
            <Col span={12}>
              <Checkbox value="onchain">
                链上数据 (大户转账, 资金流向)
              </Checkbox>
            </Col>
            <Col span={12}>
              <Checkbox value="macro">
                宏观指标 (BTC占比, 总市值)
              </Checkbox>
            </Col>
          </Row>
        </Checkbox.Group>
      </Form.Item>

      <Card
        title="推理服务配置"
        size="small"
        style={{ marginTop: 16, background: '#fafafa' }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="推理服务地址"
              name={['aiConfig', 'inferenceEndpoint']}
              initialValue="https://ai-inference.stardust.network/api/v1/inference"
              rules={[
                { required: true },
                { type: 'url', message: '请输入有效的URL' },
              ]}
            >
              <Input placeholder="https://..." />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="API密钥"
              name={['aiConfig', 'apiKey']}
              rules={[{ required: true, message: '请输入API密钥' }]}
              tooltip="密钥将加密存储在链上"
            >
              <Input.Password placeholder="输入API密钥" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="推理超时 (秒)"
              name={['aiConfig', 'inferenceTimeoutSecs']}
              initialValue={10}
            >
              <Slider min={5} max={30} marks={{ 5: '5s', 10: '10s', 20: '20s', 30: '30s' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="最大重试次数"
              name={['aiConfig', 'maxRetries']}
              initialValue={3}
            >
              <Slider min={1} max={5} marks={{ 1: '1', 3: '3', 5: '5' }} />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </>
  );
};

export default StepAIConfig;
```

---

### 3.3 AI Signals (AI信号监控)

#### 功能概述
实时展示AI生成的交易信号，包括详细的推理过程和特征重要性。

#### 组件实现

```tsx
// src/pages/AISignals/index.tsx

import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Modal, Card, Row, Col, Statistic } from 'antd';
import { EyeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAISignals } from '@/hooks/useAISignals';
import SignalDetail from './SignalDetail';
import type { AISignal } from '@/types/signal';
import dayjs from 'dayjs';

const AISignals: React.FC = () => {
  const { signals, loading, fetchSignals } = useAISignals();
  const [selectedSignal, setSelectedSignal] = useState<AISignal | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchSignals();
    // 每30秒刷新
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, []);

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: number) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'),
      width: 180,
    },
    {
      title: '策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
    },
    {
      title: '信号',
      dataIndex: 'signal',
      key: 'signal',
      render: (signal: string) => {
        const colorMap = {
          BUY: 'green',
          SELL: 'red',
          HOLD: 'blue',
          CLOSE: 'orange',
        };
        return <Tag color={colorMap[signal]}>{signal}</Tag>;
      },
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '60px',
              height: '8px',
              background: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden',
              marginRight: '8px',
            }}
          >
            <div
              style={{
                width: `${confidence}%`,
                height: '100%',
                background: confidence >= 70 ? '#52c41a' : confidence >= 50 ? '#faad14' : '#ff4d4f',
              }}
            />
          </div>
          <span>{confidence}%</span>
        </div>
      ),
    },
    {
      title: 'AI模型',
      dataIndex: 'modelsUsed',
      key: 'modelsUsed',
      render: (models: string[]) => models.join(', '),
    },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      key: 'riskScore',
      render: (score: number) => (
        <Tag color={score < 40 ? 'green' : score < 70 ? 'orange' : 'red'}>
          {score}
        </Tag>
      ),
    },
    {
      title: '执行状态',
      dataIndex: 'executed',
      key: 'executed',
      render: (executed: boolean) => (
        <Tag color={executed ? 'success' : 'default'}>
          {executed ? '已执行' : '未执行'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AISignal) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedSignal(record);
            setModalVisible(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="ai-signals-container">
      <Card title={<span><ThunderboltOutlined /> AI信号监控</span>}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic
              title="今日信号总数"
              value={signals.length}
              prefix={<ThunderboltOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已执行"
              value={signals.filter(s => s.executed).length}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均置信度"
              value={
                signals.length > 0
                  ? (signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length).toFixed(1)
                  : 0
              }
              suffix="%"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均风险评分"
              value={
                signals.length > 0
                  ? (signals.reduce((sum, s) => sum + s.riskScore, 0) / signals.length).toFixed(1)
                  : 0
              }
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={signals}
          loading={loading}
          rowKey="signalId"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="AI信号详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedSignal && <SignalDetail signal={selectedSignal} />}
      </Modal>
    </div>
  );
};

export default AISignals;
```

#### 信号详情组件

```tsx
// src/pages/AISignals/SignalDetail.tsx

import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Divider, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useIPFS } from '@/hooks/useIPFS';
import type { AISignal } from '@/types/signal';

const { Paragraph, Text } = Typography;

interface SignalDetailProps {
  signal: AISignal;
}

const SignalDetail: React.FC<SignalDetailProps> = ({ signal }) => {
  const { fetchFromIPFS } = useIPFS();
  const [reasoning, setReasoning] = useState<string>('');
  const [featureImportance, setFeatureImportance] = useState<any>({});

  useEffect(() => {
    // 从IPFS加载推理详情
    if (signal.reasoningCid) {
      fetchFromIPFS(signal.reasoningCid).then(setReasoning);
    }
    if (signal.featureImportanceCid) {
      fetchFromIPFS(signal.featureImportanceCid).then(data => {
        setFeatureImportance(JSON.parse(data));
      });
    }
  }, [signal]);

  // 特征重要性图表
  const featureImportanceChart = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { left: '20%', right: '10%', bottom: '10%', top: '5%' },
    xAxis: {
      type: 'value',
      max: 1,
    },
    yAxis: {
      type: 'category',
      data: Object.keys(featureImportance),
    },
    series: [
      {
        type: 'bar',
        data: Object.values(featureImportance),
        itemStyle: {
          color: '#1890ff',
        },
      },
    ],
  };

  return (
    <div>
      <Descriptions bordered column={2}>
        <Descriptions.Item label="信号类型">
          <Tag color={signal.signal === 'BUY' ? 'green' : 'red'}>
            {signal.signal}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="置信度">
          {signal.confidence}%
        </Descriptions.Item>
        <Descriptions.Item label="入场价格">
          ${signal.entryPrice.toFixed(2)}
        </Descriptions.Item>
        <Descriptions.Item label="推荐仓位">
          ${signal.positionSize.toFixed(2)}
        </Descriptions.Item>
        <Descriptions.Item label="止损价格">
          {signal.stopLoss ? `$${signal.stopLoss.toFixed(2)}` : '未设置'}
        </Descriptions.Item>
        <Descriptions.Item label="止盈价格">
          {signal.takeProfit ? `$${signal.takeProfit.toFixed(2)}` : '未设置'}
        </Descriptions.Item>
        <Descriptions.Item label="风险评分">
          <Tag color={signal.riskScore < 40 ? 'green' : signal.riskScore < 70 ? 'orange' : 'red'}>
            {signal.riskScore}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="市场状态">
          {signal.marketCondition}
        </Descriptions.Item>
      </Descriptions>

      <Divider>AI推理过程</Divider>
      
      <Card size="small" title="模型投票" style={{ marginBottom: 16 }}>
        {Object.entries(signal.modelVotes).map(([model, vote]) => (
          <div key={model} style={{ marginBottom: 8 }}>
            <Text strong>{model}:</Text>{' '}
            <Tag color={vote === 'BUY' ? 'green' : vote === 'SELL' ? 'red' : 'blue'}>
              {vote}
            </Tag>
          </div>
        ))}
      </Card>

      <Card size="small" title="推理理由" style={{ marginBottom: 16 }}>
        <Paragraph>{reasoning || '加载中...'}</Paragraph>
      </Card>

      <Card size="small" title="特征重要性">
        <ReactECharts
          option={featureImportanceChart}
          style={{ height: '300px' }}
        />
      </Card>
    </div>
  );
};

export default SignalDetail;
```

---

## 4️⃣ 状态管理

### 4.1 Wallet Store

```typescript
// src/stores/useWalletStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WalletState {
  currentAccount: string | null;
  accounts: string[];
  isConnected: boolean;
  
  setCurrentAccount: (account: string) => void;
  setAccounts: (accounts: string[]) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      currentAccount: null,
      accounts: [],
      isConnected: false,

      setCurrentAccount: (account) => set({ currentAccount: account }),
      
      setAccounts: (accounts) => set({ accounts }),

      connect: async () => {
        // 连接Polkadot.js钱包
        const { web3Accounts, web3Enable } = await import('@polkadot/extension-dapp');
        
        await web3Enable('Stardust AI Trading');
        const accounts = await web3Accounts();
        
        set({
          accounts: accounts.map(acc => acc.address),
          currentAccount: accounts[0]?.address || null,
          isConnected: true,
        });
      },

      disconnect: () => set({
        currentAccount: null,
        accounts: [],
        isConnected: false,
      }),
    }),
    {
      name: 'wallet-storage',
    }
  )
);
```

---

## 5️⃣ 样式设计

### 5.1 颜色方案

保持与现有stardust-dapp一致的风格：

```css
/* src/styles/theme.css */

:root {
  /* 主色 */
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  
  /* 信号颜色 */
  --signal-buy: #52c41a;
  --signal-sell: #ff4d4f;
  --signal-hold: #1890ff;
  --signal-close: #faad14;
  
  /* 背景色 */
  --bg-primary: #ffffff;
  --bg-secondary: #fafafa;
  --bg-tertiary: #f0f0f0;
  
  /* 文字颜色 */
  --text-primary: rgba(0, 0, 0, 0.85);
  --text-secondary: rgba(0, 0, 0, 0.65);
  --text-tertiary: rgba(0, 0, 0, 0.45);
  
  /* 边框 */
  --border-color: #d9d9d9;
  --border-radius: 8px;
}
```

### 5.2 响应式设计

```css
/* 移动端优先 */
.dashboard-container {
  padding: 16px;
}

@media (min-width: 768px) {
  .dashboard-container {
    padding: 24px;
  }
}

@media (min-width: 1200px) {
  .dashboard-container {
    padding: 32px;
  }
}
```

---

## 6️⃣ 使用说明

### 6.1 开发环境搭建

```bash
# 1. 克隆项目
cd stardust-dapp

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env

# 4. 启动开发服务器
npm run dev

# 5. 访问
# http://localhost:5173
```

### 6.2 构建部署

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 部署到服务器
npm run deploy
```

---

*文档编写: AI助手*  
*日期: 2025-11-04*

