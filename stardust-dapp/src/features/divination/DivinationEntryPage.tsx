/**
 * 通用占卜入口页面
 *
 * 支持多种占卜类型：
 * - 梅花易数：时间/数字/随机起卦
 * - 八字命理：出生时间排盘
 * - 六爻占卜：铜钱摇卦
 * - 奇门遁甲：时空预测
 * - 紫微斗数：星盘推算
 *
 * 支持双主题：
 * - 经典主题（华易网风格）
 * - 星空主题（年轻人偏好）
 */

import React from 'react';
import { Card, Row, Col, Typography, Tag, Button, Tooltip } from 'antd';
import {
  ArrowRightOutlined,
  StarOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  CompassOutlined,
  RadarChartOutlined,
  HistoryOutlined,
  BgColorsOutlined,
} from '@ant-design/icons';
import {
  DivinationType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_DESCRIPTIONS,
  DIVINATION_TYPE_ICONS,
} from '../../types/divination';
import { useTheme } from '../../hooks/useTheme';
import './DivinationPage.css';
import './divination-common.css';

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
  listRoute?: string; // 历史记录路由
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
    listRoute: '#/meihua/list',
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
    listRoute: '#/bazi/list',
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
    listRoute: '#/ziwei/list',
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
  {
    type: DivinationType.Daliuren,
    name: DIVINATION_TYPE_NAMES[DivinationType.Daliuren],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Daliuren],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Daliuren],
    antIcon: <CompassOutlined />,
    route: '#/daliuren',
    color: '#13c2c2',
    enabled: true,
  },
  {
    type: DivinationType.Tarot,
    name: DIVINATION_TYPE_NAMES[DivinationType.Tarot],
    description: DIVINATION_TYPE_DESCRIPTIONS[DivinationType.Tarot],
    icon: DIVINATION_TYPE_ICONS[DivinationType.Tarot],
    antIcon: <StarOutlined />,
    route: '#/tarot',
    color: '#f5222d',
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
        {/* 历史记录快捷入口 */}
        {config.listRoute && (
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              window.location.hash = config.listRoute!;
            }}
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
          >
            查看历史
          </Button>
        )}
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
  const { theme, toggleTheme, isStarry } = useTheme();

  const handleSelectType = (config: DivinationTypeConfig) => {
    if (config.enabled) {
      window.location.hash = config.route;
    }
  };

  return (
    <div className="divination-entry-page divination-page-container">
      {/* 页面标题 */}
      <Card className="header-card divination-header-card">
        {/* 主题切换按钮（右上角） */}
        <Tooltip title={`切换到${isStarry ? '经典' : '星空'}主题`}>
          <Button
            type="text"
            icon={<BgColorsOutlined />}
            onClick={toggleTheme}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              color: 'rgba(255,255,255,0.9)',
              fontSize: 18,
              zIndex: 10,
            }}
          />
        </Tooltip>

        <Title level={3}>星尘玄鉴</Title>
        <Paragraph type="secondary">
          探索天机，洞察命理，启迪智慧
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
    </div>
  );
};

export default DivinationEntryPage;
