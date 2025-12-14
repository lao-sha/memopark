/**
 * 紫微斗数四化分析组件
 *
 * 展示四化飞星的详细分析，包括：
 * - 生年四化星
 * - 各宫四化飞入
 * - 自化检测
 * - 化忌冲破分析
 */

import React from 'react';
import { Card, Row, Col, Tag, Space, Tooltip, Typography, Divider } from 'antd';
import {
  SwapOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  RightCircleOutlined,
} from '@ant-design/icons';
import type { SiHuaAnalysis } from '../../../types/ziwei';
import {
  SI_HUA_STAR_NAMES,
  GONG_NAMES,
  Gong,
  SiHuaStar,
} from '../../../types/ziwei';

const { Text } = Typography;

/**
 * 组件属性
 */
interface SiHuaAnalysisCardProps {
  /** 四化分析数据 */
  analysis: SiHuaAnalysis;
  /** 命宫位置 */
  mingGongPos?: number;
}

/**
 * 四化类型配置
 */
const SI_HUA_CONFIG = [
  { name: '化禄', short: '禄', color: '#52c41a', bgColor: '#f6ffed' },
  { name: '化权', short: '权', color: '#1890ff', bgColor: '#e6f7ff' },
  { name: '化科', short: '科', color: '#722ed1', bgColor: '#f9f0ff' },
  { name: '化忌', short: '忌', color: '#f5222d', bgColor: '#fff1f0' },
];

/**
 * 获取宫位名称（带索引保护）
 */
function getGongName(index: number): string {
  if (index >= 0 && index < 12) {
    return GONG_NAMES[index as Gong];
  }
  return '未知';
}

/**
 * 获取四化星名称
 */
function getSiHuaStarName(star: SiHuaStar | number): string {
  return SI_HUA_STAR_NAMES[star as SiHuaStar] || '未知';
}

/**
 * 生年四化展示
 */
const ShengNianSiHua: React.FC<{ siHua: [SiHuaStar, SiHuaStar, SiHuaStar, SiHuaStar] }> = ({ siHua }) => (
  <div style={{ marginBottom: 16 }}>
    <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
      生年四化
    </Text>
    <Row gutter={[8, 8]}>
      {siHua.map((star, idx) => (
        <Col span={6} key={idx}>
          <div
            style={{
              padding: 8,
              borderRadius: 4,
              backgroundColor: SI_HUA_CONFIG[idx].bgColor,
              border: `1px solid ${SI_HUA_CONFIG[idx].color}20`,
              textAlign: 'center',
            }}
          >
            <Tag color={SI_HUA_CONFIG[idx].color} style={{ marginBottom: 4 }}>
              {SI_HUA_CONFIG[idx].name}
            </Tag>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: SI_HUA_CONFIG[idx].color }}>
              {getSiHuaStarName(star)}
            </div>
          </div>
        </Col>
      ))}
    </Row>
  </div>
);

/**
 * 宫干四化飞入展示
 */
const GongGanFeiRu: React.FC<{
  title: string;
  feiRu: [number, number, number, number];
}> = ({ title, feiRu }) => (
  <div style={{ marginBottom: 12 }}>
    <Text strong style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>
      {title}
    </Text>
    <Space size={4} wrap>
      {feiRu.map((gongIdx, idx) => (
        <Tooltip key={idx} title={`${SI_HUA_CONFIG[idx].name}飞入${getGongName(gongIdx)}`}>
          <Tag
            color={SI_HUA_CONFIG[idx].color}
            icon={<RightCircleOutlined />}
            style={{ fontSize: 11 }}
          >
            {SI_HUA_CONFIG[idx].short}→{getGongName(gongIdx)}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  </div>
);

/**
 * 自化宫位展示
 */
const ZiHuaPalaces: React.FC<{ flags: number }> = ({ flags }) => {
  const ziHuaGongs: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (flags & (1 << i)) {
      ziHuaGongs.push(i);
    }
  }

  if (ziHuaGongs.length === 0) {
    return (
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
          自化宫位
        </Text>
        <Tag icon={<CheckCircleOutlined />} color="success">
          无自化
        </Tag>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
        自化宫位
      </Text>
      <Space size={4} wrap>
        {ziHuaGongs.map((gongIdx) => (
          <Tooltip key={gongIdx} title="该宫有自化现象">
            <Tag color="orange" icon={<SwapOutlined />}>
              {getGongName(gongIdx)}
            </Tag>
          </Tooltip>
        ))}
      </Space>
    </div>
  );
};

/**
 * 化忌冲破展示
 */
const HuaJiChongPo: React.FC<{ flags: number }> = ({ flags }) => {
  const chongPoGongs: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (flags & (1 << i)) {
      chongPoGongs.push(i);
    }
  }

  if (chongPoGongs.length === 0) {
    return (
      <div>
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
          化忌冲破
        </Text>
        <Tag icon={<CheckCircleOutlined />} color="success">
          无冲破
        </Tag>
      </div>
    );
  }

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
        化忌冲破
      </Text>
      <Space size={4} wrap>
        {chongPoGongs.map((gongIdx) => (
          <Tooltip key={gongIdx} title="该宫被化忌冲破，需特别注意">
            <Tag color="error" icon={<WarningOutlined />}>
              {getGongName(gongIdx)}被冲
            </Tag>
          </Tooltip>
        ))}
      </Space>
    </div>
  );
};

/**
 * 紫微斗数四化分析组件
 */
const SiHuaAnalysisCard: React.FC<SiHuaAnalysisCardProps> = ({ analysis }) => {
  const {
    shengNianSiHua,
    mingGongFeiRu,
    caiBoFeiRu,
    guanLuFeiRu,
    fuQiFeiRu,
    ziHuaPalaces,
    huaJiChongPo,
  } = analysis;

  return (
    <Card
      title={
        <Space>
          <SwapOutlined />
          <span>四化分析</span>
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      {/* 生年四化 */}
      <ShengNianSiHua siHua={shengNianSiHua as [SiHuaStar, SiHuaStar, SiHuaStar, SiHuaStar]} />

      <Divider style={{ margin: '12px 0' }} />

      {/* 各宫四化飞入 */}
      <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
        宫干四化飞入
      </Text>
      <GongGanFeiRu title="命宫" feiRu={mingGongFeiRu} />
      <GongGanFeiRu title="财帛" feiRu={caiBoFeiRu} />
      <GongGanFeiRu title="官禄" feiRu={guanLuFeiRu} />
      <GongGanFeiRu title="夫妻" feiRu={fuQiFeiRu} />

      <Divider style={{ margin: '12px 0' }} />

      {/* 特殊情况 */}
      <Row gutter={16}>
        <Col span={12}>
          <ZiHuaPalaces flags={ziHuaPalaces} />
        </Col>
        <Col span={12}>
          <HuaJiChongPo flags={huaJiChongPo} />
        </Col>
      </Row>
    </Card>
  );
};

export default SiHuaAnalysisCard;
