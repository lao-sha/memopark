/**
 * 通用占卜入口页面
 *
 * 支持多种占卜类型：
 * - 梅花易数：时间/数字/随机起卦
 * - 八字命理：出生时间排盘
 * - 六爻占卜：铜钱摇卦
 * - 奇门遁甲：时空预测
 * - 紫微斗数：星盘推算
 */

import React from 'react';
import { Card, Row, Col, Typography, Space, Tag, Button } from 'antd';
import {
  ArrowRightOutlined,
  StarOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  CompassOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import {
  DivinationType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_DESCRIPTIONS,
  DIVINATION_TYPE_ICONS,
} from '../../types/divination';
import './DivinationPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 占卜类型卡片配置
 */
interface DivinationTypeConfig {
  type: DivinationType;
  name: string;
  description: string;
  icon: string;
  antIcon: React.ReactNode;
  route: string;
  color: string;
  enabled: boolean;
  comingSoon?: boolean;
}

/**
 * 各占卜类型的配置
 */
const DIVINATION_CONFIGS: DivinationTypeConfig[] = [
  {
    type: DivinationType.Meihua,
    name: DIVINATION_TYPE_NAMES[DivinationType.Meihua],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Meihua],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Meihua],
    antIcon: <AppstoreOutlined />,
    route: '#/meihua',
    color: '#1890ff',
    enabled: true,
  },
  {
    type: DivinationType.Bazi,
    name: DIVINATION_TYPE_NAMES[DivinationType.Bazi],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Bazi],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Bazi],
    antIcon: <ClockCircleOutlined />,
    route: '#/bazi',
    color: '#52c41a',
    enabled: true,
  },
  {
    type: DivinationType.Liuyao,
    name: DIVINATION_TYPE_NAMES[DivinationType.Liuyao],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Liuyao],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Liuyao],
    antIcon: <StarOutlined />,
    route: '#/liuyao',
    color: '#722ed1',
    enabled: true,
  },
  {
    type: DivinationType.Qimen,
    name: DIVINATION_TYPE_NAMES[DivinationType.Qimen],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Qimen],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Qimen],
    antIcon: <CompassOutlined />,
    route: '#/qimen',
    color: '#fa8c16',
    enabled: true,
  },
  {
    type: DivinationType.Ziwei,
    name: DIVINATION_TYPE_NAMES[DivinationType.Ziwei],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Ziwei],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Ziwei],
    antIcon: <RadarChartOutlined />,
    route: '#/ziwei',
    color: '#eb2f96',
    enabled: true,
  },
  {
    type: DivinationType.XiaoLiuRen,
    name: DIVINATION_TYPE_NAMES[DivinationType.XiaoLiuRen],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.XiaoLiuRen],
    icon: DIVINATION_TYPE_ICONS[DivinationType.XiaoLiuRen],
    antIcon: <ClockCircleOutlined />,
    route: '#/xiaoliuren',
    color: '#2f54eb',
    enabled: true,
  },
];

/**
 * 占卜类型选择卡片
 */
const DivinationTypeCard: React.FC<{
  config: DivinationTypeConfig;
  onClick: () => void;
}> = ({ config, onClick }) => (
  <Card
    className={`divination-type-card ${!config.enabled ? 'disabled' : ''}`}
    hoverable={config.enabled}
    onClick={() => config.enabled && onClick()}
    style={{ borderColor: config.color }}
  >
    <div className="type-card-content">
      <div className="type-icon" style={{ backgroundColor: `${config.color}15`, color: config.color }}>
        <span className="icon-text">{config.icon}</span>
      </div>
      <div className="type-info">
        <div className="type-header">
          <Text strong className="type-name">{config.name}</Text>
          {config.comingSoon && (
            <Tag color="orange">即将推出</Tag>
          )}
        </div>
        <Paragraph type="secondary" className="type-description" ellipsis={{ rows: 2 }}>
          {config.description}
        </Paragraph>
      </div>
      {config.enabled && (
        <ArrowRightOutlined className="arrow-icon" style={{ color: config.color }} />
      )}
    </div>
  </Card>
);

/**
 * 通用占卜入口页面
 */
const DivinationEntryPage: React.FC = () => {
  const handleSelectType = (config: DivinationTypeConfig) => {
    if (config.enabled) {
      window.location.hash = config.route;
    }
  };

  return (
    <div className="divination-entry-page">
      {/* 页面标题 */}
      <Card className="header-card">
        <Title level={3}>玄学占卜</Title>
        <Paragraph type="secondary">
          选择一种占卜方式，探索命运的奥秘
        </Paragraph>
      </Card>

      {/* 占卜类型列表 */}
      <div className="types-section">
        <Row gutter={[12, 12]}>
          {DIVINATION_CONFIGS.map((config) => (
            <Col key={config.type} span={24}>
              <DivinationTypeCard
                config={config}
                onClick={() => handleSelectType(config)}
              />
            </Col>
          ))}
        </Row>
      </div>

      {/* 服务入口 */}
      <Card className="services-card">
        <Title level={5}>占卜服务</Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            size="large"
            type="primary"
            onClick={() => window.location.hash = '#/market'}
          >
            🏪 玄学服务市场
          </Button>
          <Button
            block
            size="large"
            onClick={() => window.location.hash = '#/bounty'}
            style={{ borderColor: '#faad14', color: '#faad14' }}
          >
            🏆 悬赏问答
          </Button>
          <Button
            block
            size="large"
            onClick={() => window.location.hash = '#/divination/market'}
          >
            🔮 找大师解读
          </Button>
          <Button
            block
            size="large"
            onClick={() => window.location.hash = '#/divination/nft'}
          >
            🎨 占卜 NFT 市场
          </Button>
          <Button
            block
            size="large"
            onClick={() => window.location.hash = '#/divination/my-nft'}
          >
            📦 我的占卜 NFT
          </Button>
        </Space>
      </Card>

      {/* 功能说明 */}
      <Card className="info-card">
        <Title level={5}>功能说明</Title>
        <Space direction="vertical" size={8}>
          <div className="info-item">
            <Text strong>🔮 起卦占卜</Text>
            <Text type="secondary">根据不同玄学体系进行占卜，获得卦象或命盘</Text>
          </div>
          <div className="info-item">
            <Text strong>🏆 悬赏问答</Text>
            <Text type="secondary">设置悬赏金额，邀请多位大师解读，投票选出最佳答案</Text>
          </div>
          <div className="info-item">
            <Text strong>🤖 AI 解读</Text>
            <Text type="secondary">智能 AI 分析占卜结果，提供专业解读建议</Text>
          </div>
          <div className="info-item">
            <Text strong>👨‍🏫 大师服务</Text>
            <Text type="secondary">连接专业命理师，获取一对一深度解读</Text>
          </div>
          <div className="info-item">
            <Text strong>🖼️ NFT 收藏</Text>
            <Text type="secondary">将珍贵的占卜结果铸造为 NFT，永久保存</Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default DivinationEntryPage;
