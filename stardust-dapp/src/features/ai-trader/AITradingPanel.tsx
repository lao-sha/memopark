/**
 * AI交易面板组件
 * 
 * 函数级详细中文注释：
 * 展示 AI 推理结果、市场分析和交易建议，支持一键执行交易。
 * 
 * @component AITradingPanel
 * @created 2025-11-04
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Alert,
  Spin,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Progress,
  Input,
  Select,
  Divider,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  FireOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAIInference } from '../../hooks/useAIInference';
import type { InferenceResult } from '../../services/aiInferenceService';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * 函数级详细中文注释：组件属性
 */
interface AITradingPanelProps {
  /** 交易对符号 */
  symbol?: string;
  /** 当前价格 */
  currentPrice?: number;
  /** AI服务URL（可选） */
  serviceURL?: string;
  /** 执行交易的回调 */
  onExecuteTrade?: (signal: InferenceResult) => void;
}

/**
 * 函数级详细中文注释：AI交易面板组件
 */
export const AITradingPanel: React.FC<AITradingPanelProps> = ({
  symbol = 'DUST-USDT',
  currentPrice = 0.1,
  serviceURL,
  onExecuteTrade,
}) => {
  const {
    result,
    loading,
    error,
    health,
    checkHealth,
    getTradingSignalWithMockData,
    clearError,
  } = useAIInference(serviceURL);

  const [localSymbol, setLocalSymbol] = useState(symbol);
  const [localPrice, setLocalPrice] = useState(currentPrice);
  const [modelType, setModelType] = useState<string>('lstm');
  const [strategyId, setStrategyId] = useState<number>(1);

  // 组件挂载时检查服务健康状态
  useEffect(() => {
    checkHealth().catch(console.error);
  }, [checkHealth]);

  /**
   * 函数级详细中文注释：获取AI推理信号
   */
  const handleGetSignal = async () => {
    clearError();
    try {
      await getTradingSignalWithMockData(localSymbol, localPrice, strategyId);
    } catch (err) {
      console.error('获取交易信号失败:', err);
    }
  };

  /**
   * 函数级详细中文注释：执行交易
   */
  const handleExecuteTrade = () => {
    if (result && onExecuteTrade) {
      onExecuteTrade(result);
    }
  };

  /**
   * 函数级详细中文注释：渲染信号图标
   */
  const renderSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return <RiseOutlined style={{ color: '#52c41a', fontSize: 32 }} />;
      case 'SELL':
        return <FallOutlined style={{ color: '#ff4d4f', fontSize: 32 }} />;
      case 'HOLD':
        return <MinusOutlined style={{ color: '#faad14', fontSize: 32 }} />;
      default:
        return <MinusOutlined style={{ fontSize: 32 }} />;
    }
  };

  /**
   * 函数级详细中文注释：渲染信号标签
   */
  const renderSignalTag = (signal: string) => {
    const config = {
      BUY: { color: 'success', text: '买入' },
      SELL: { color: 'error', text: '卖出' },
      HOLD: { color: 'warning', text: '持有' },
    };
    const { color, text } = config[signal as keyof typeof config] || { color: 'default', text: signal };
    return <Tag color={color} style={{ fontSize: 16 }}>{text}</Tag>;
  };

  /**
   * 函数级详细中文注释：渲染市场状况标签
   */
  const renderMarketCondition = (condition: string) => {
    const config = {
      Bullish: { color: 'success', text: '多头市场', icon: '📈' },
      Bearish: { color: 'error', text: '空头市场', icon: '📉' },
      Sideways: { color: 'warning', text: '震荡市场', icon: '➡️' },
      Volatile: { color: 'processing', text: '高波动', icon: '⚡' },
    };
    const cfg = config[condition as keyof typeof config] || { color: 'default', text: condition, icon: '❓' };
    return (
      <Tag color={cfg.color}>
        <span style={{ marginRight: 4 }}>{cfg.icon}</span>
        {cfg.text}
      </Tag>
    );
  };

  /**
   * 函数级详细中文注释：渲染风险等级
   */
  const getRiskLevel = (score: number) => {
    if (score < 20) return { text: '极低', color: '#52c41a' };
    if (score < 40) return { text: '低', color: '#73d13d' };
    if (score < 60) return { text: '中等', color: '#faad14' };
    if (score < 80) return { text: '高', color: '#ff7a45' };
    return { text: '极高', color: '#ff4d4f' };
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          <span>AI 交易助手</span>
          {health && (
            <Tag color={health.status === 'healthy' ? 'success' : 'warning'}>
              {health.status === 'healthy' ? '服务正常' : '降级运行'}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={checkHealth}
          size="small"
        >
          检查服务
        </Button>
      }
      style={{ marginBottom: 24 }}
    >
      {/* 服务状态提示 */}
      {error && (
        <Alert
          message="服务错误"
          description={error}
          type="error"
          closable
          onClose={clearError}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 输入区域 */}
      <Card size="small" title="交易参数" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Text>交易对:</Text>
            <Input
              value={localSymbol}
              onChange={(e) => setLocalSymbol(e.target.value)}
              placeholder="如: DUST-USDT"
              style={{ marginTop: 4 }}
            />
          </Col>
          <Col span={12}>
            <Text>当前价格:</Text>
            <Input
              type="number"
              value={localPrice}
              onChange={(e) => setLocalPrice(parseFloat(e.target.value) || 0)}
              step={0.01}
              style={{ marginTop: 4 }}
            />
          </Col>
          <Col span={12}>
            <Text>AI模型:</Text>
            <Select
              value={modelType}
              onChange={setModelType}
              style={{ width: '100%', marginTop: 4 }}
            >
              <Option value="lstm">LSTM (快速)</Option>
              <Option value="local">本地模型</Option>
              <Option value="ensemble">集成模型 (高精度)</Option>
            </Select>
          </Col>
          <Col span={12}>
            <Text>策略ID:</Text>
            <Input
              type="number"
              value={strategyId}
              onChange={(e) => setStrategyId(parseInt(e.target.value) || 1)}
              style={{ marginTop: 4 }}
            />
          </Col>
        </Row>

        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGetSignal}
          loading={loading}
          block
          size="large"
          style={{ marginTop: 16 }}
        >
          获取 AI 交易信号
        </Button>
      </Card>

      {/* AI推理结果 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="AI 正在分析市场数据..." />
        </div>
      )}

      {result && !loading && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 交易信号 */}
          <Card size="small" title="交易信号">
            <Row gutter={16} align="middle">
              <Col span={6} style={{ textAlign: 'center' }}>
                {renderSignalIcon(result.signal)}
              </Col>
              <Col span={18}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {renderSignalTag(result.signal)}
                  <Statistic
                    title="置信度"
                    value={result.confidence}
                    suffix="%"
                    valueStyle={{ color: result.confidence >= 70 ? '#52c41a' : '#faad14' }}
                  />
                  <Progress
                    percent={result.confidence}
                    strokeColor={{
                      '0%': '#ff4d4f',
                      '50%': '#faad14',
                      '100%': '#52c41a',
                    }}
                  />
                </Space>
              </Col>
            </Row>
          </Card>

          {/* 交易建议 */}
          <Card size="small" title="交易建议">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="建议仓位"
                  value={result.position_size}
                  prefix="$"
                  precision={2}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="入场价"
                  value={result.entry_price}
                  prefix="$"
                  precision={6}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="止损价"
                  value={result.stop_loss}
                  prefix="$"
                  precision={6}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="止盈价"
                  value={result.take_profit}
                  prefix="$"
                  precision={6}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>
          </Card>

          {/* 市场分析 */}
          <Card size="small" title="市场分析">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>市场状况: </Text>
                {renderMarketCondition(result.market_condition)}
              </div>
              <div>
                <Text strong>风险评分: </Text>
                <Tag color={getRiskLevel(result.risk_score).color}>
                  {result.risk_score} / 100 ({getRiskLevel(result.risk_score).text})
                </Tag>
              </div>
              <div>
                <Text strong>推理依据: </Text>
                <Paragraph>{result.reasoning}</Paragraph>
              </div>
              <div>
                <Text type="secondary">
                  <ClockCircleOutlined /> 推理耗时: {result.inference_time_ms}ms
                </Text>
                <Divider type="vertical" />
                <Text type="secondary">
                  使用模型: {result.models_used.join(', ')}
                </Text>
              </div>
            </Space>
          </Card>

          {/* 特征重要性 */}
          {result.feature_importance && Object.keys(result.feature_importance).length > 0 && (
            <Card size="small" title="特征重要性分析">
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(result.feature_importance)
                  .sort(([, a], [, b]) => b - a)
                  .map(([feature, importance]) => (
                    <div key={feature}>
                      <Text>{feature}</Text>
                      <Progress
                        percent={importance * 100}
                        size="small"
                        format={(percent) => `${percent?.toFixed(1)}%`}
                      />
                    </div>
                  ))}
              </Space>
            </Card>
          )}

          {/* 执行交易按钮 */}
          {onExecuteTrade && (
            <Button
              type="primary"
              danger={result.signal === 'SELL'}
              icon={result.signal === 'BUY' ? <RiseOutlined /> : <FallOutlined />}
              onClick={handleExecuteTrade}
              size="large"
              block
              disabled={result.signal === 'HOLD'}
            >
              {result.signal === 'BUY' && '执行买入'}
              {result.signal === 'SELL' && '执行卖出'}
              {result.signal === 'HOLD' && '暂不交易'}
            </Button>
          )}
        </Space>
      )}

      {!result && !loading && !error && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <FireOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>点击上方按钮获取 AI 交易信号</div>
        </div>
      )}
    </Card>
  );
};

export default AITradingPanel;

