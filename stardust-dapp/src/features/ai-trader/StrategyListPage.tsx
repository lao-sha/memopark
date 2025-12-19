/**
 * AI策略列表页面
 * 展示用户的所有AI交易策略
 */

import React, { useState } from 'react';
import {
  Card,
  List,
  Button,
  Tag,
  Space,
  Typography,
  Spin,
  Empty,
  Row,
  Col,
  Statistic,
  Switch,
  message,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  SettingOutlined,
  PoweroffOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAIStrategy } from '../../hooks/ai-strategy/useAIStrategy';
import type { AIStrategy } from '../../hooks/ai-strategy/useAIStrategy';

const { Title, Text, Paragraph } = Typography;

export const StrategyListPage: React.FC = () => {
  const navigate = useNavigate();
  const { strategies, loading, enableStrategy, disableStrategy } = useAIStrategy();
  const [actionLoading, setActionLoading] = useState<{ [key: number]: boolean }>({});

  /**
   * 切换策略启用状态
   */
  const handleToggleStrategy = async (strategyId: number, enabled: boolean) => {
    setActionLoading({ ...actionLoading, [strategyId]: true });

    try {
      if (enabled) {
        await disableStrategy(strategyId);
        message.success('策略已禁用');
      } else {
        await enableStrategy(strategyId);
        message.success('策略已启用');
      }
    } catch (err: any) {
      message.error(err.message || '操作失败');
    } finally {
      setActionLoading({ ...actionLoading, [strategyId]: false });
    }
  };

  /**
   * 获取AI模型标签颜色
   */
  const getModelTagColor = (model: string) => {
    const colors: Record<string, string> = {
      GPT4: 'purple',
      Claude: 'cyan',
      Transformer: 'blue',
      LSTM: 'green',
      Ensemble: 'gold',
    };
    return colors[model] || 'default';
  };

  /**
   * 获取策略类型标签颜色
   */
  const getTypeTagColor = (type: string) => {
    const colors: Record<string, string> = {
      Grid: 'orange',
      MarketMaking: 'green',
      Arbitrage: 'blue',
      AI: 'purple',
      DCA: 'cyan',
    };
    return colors[type] || 'default';
  };

  /**
   * 渲染策略卡片
   */
  const renderStrategyCard = (strategy: AIStrategy) => {
    return (
      <Card
        key={strategy.strategy_id}
        hoverable
        style={{ marginBottom: 16 }}
        actions={[
          <Button
            key="detail"
            type="link"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/ai-strategy/${strategy.strategy_id}`)}
          >
            详情
          </Button>,
          <Button
            key="settings"
            type="link"
            icon={<SettingOutlined />}
            onClick={() => navigate(`/ai-strategy/${strategy.strategy_id}/settings`)}
          >
            配置
          </Button>,
          <Switch
            key="enabled"
            checked={strategy.enabled}
            loading={actionLoading[strategy.strategy_id]}
            onChange={() => handleToggleStrategy(strategy.strategy_id, strategy.enabled)}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />,
        ]}
      >
        <Card.Meta
          title={
            <Space>
              <RobotOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Text strong>{strategy.name}</Text>
              {strategy.enabled && (
                <Tag color="success" icon={<ThunderboltOutlined />}>
                  运行中
                </Tag>
              )}
              {!strategy.enabled && (
                <Tag color="default" icon={<PoweroffOutlined />}>
                  已停止
                </Tag>
              )}
            </Space>
          }
          description={
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space wrap>
                <Tag color={getModelTagColor(strategy.ai_model)}>
                  {strategy.ai_model}
                </Tag>
                <Tag color={getTypeTagColor(strategy.strategy_type)}>
                  {strategy.strategy_type}
                </Tag>
                <Tag>{strategy.symbol}</Tag>
              </Space>
              
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={8}>
                  <Statistic
                    title="置信度阈值"
                    value={strategy.model_config.confidence_threshold}
                    suffix="%"
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="最大杠杆"
                    value={strategy.risk_control.max_leverage}
                    suffix="x"
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="止损"
                    value={strategy.risk_control.stop_loss_pct}
                    suffix="%"
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
              </Row>
            </Space>
          }
        />
      </Card>
    );
  };

  return (
    <div style={{ padding: '16px', maxWidth: 414, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <RobotOutlined /> AI交易策略
        </Title>
        <Paragraph type="secondary">
          使用AI模型自动生成交易信号，实现7×24小时智能交易
        </Paragraph>
      </div>

      {/* 操作按钮 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => navigate('/ai-strategy/create')}
        >
          创建新策略
        </Button>
      </div>

      {/* 策略列表 */}
      <Spin spinning={loading}>
        {strategies.length === 0 && !loading && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无AI策略"
          >
            <Button type="primary" onClick={() => navigate('/ai-strategy/create')}>
              创建第一个策略
            </Button>
          </Empty>
        )}

        {strategies.length > 0 && (
          <div>
            {strategies.map(strategy => renderStrategyCard(strategy))}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default StrategyListPage;

