/**
 * 紫微斗数宫位解读组件
 *
 * 展示单个宫位的详细解读信息，包括：
 * - 宫位名称和地支
 * - 宫位评分和吉凶等级
 * - 主星强度
 * - 四化影响
 * - 六吉六煞统计
 * - 关键词标签
 */

import React from 'react';
import { Card, Progress, Tag, Space, Tooltip, Row, Col, Badge } from 'antd';
import {
  StarOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { PalaceInterpretation } from '../../../types/ziwei';
import {
  Gong,
  GONG_NAMES,
  FortuneLevel,
  FORTUNE_LEVEL_NAMES,
  FORTUNE_LEVEL_COLORS,
  MING_GONG_KEYWORDS,
  CAI_BO_KEYWORDS,
  GUAN_LU_KEYWORDS,
  DI_ZHI_NAMES,
} from '../../../types/ziwei';

/**
 * 组件属性
 */
interface PalaceInterpretationCardProps {
  /** 宫位解读数据 */
  interpretation: PalaceInterpretation;
  /** 宫位地支索引 */
  diZhiIndex?: number;
  /** 是否为命宫 */
  isMingGong?: boolean;
  /** 是否为身宫 */
  isShenGong?: boolean;
  /** 是否展开显示详情 */
  expanded?: boolean;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * 获取评分颜色
 */
function getScoreColor(score: number): string {
  if (score >= 85) return '#f5222d'; // 大吉 - 红色
  if (score >= 70) return '#fa541c'; // 吉 - 橙红
  if (score >= 55) return '#fa8c16'; // 小吉 - 橙色
  if (score >= 40) return '#1890ff'; // 平 - 蓝色
  if (score >= 25) return '#722ed1'; // 小凶 - 紫色
  return '#595959'; // 凶 - 灰色
}

/**
 * 获取宫位关键词表
 */
function getKeywordsTable(gongWei: Gong): string[] {
  switch (gongWei) {
    case Gong.Ming:
      return MING_GONG_KEYWORDS;
    case Gong.CaiBo:
      return CAI_BO_KEYWORDS;
    case Gong.GuanLu:
      return GUAN_LU_KEYWORDS;
    default:
      return MING_GONG_KEYWORDS; // 默认使用命宫关键词
  }
}

/**
 * 解析关键词索引
 */
function parseKeywords(keywords: [number, number, number], gongWei: Gong): string[] {
  const table = getKeywordsTable(gongWei);
  return keywords
    .map((idx) => table[idx] || '未知')
    .filter((kw) => kw !== '未知');
}

/**
 * 解析影响因素位标志
 */
function parseFactors(factors: number): string[] {
  const factorDescriptions = [
    '主星庙旺',
    '主星落陷',
    '有化禄',
    '有化权',
    '有化科',
    '有化忌',
    '六吉星会照',
    '六煞星会照',
  ];

  const result: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (factors & (1 << i)) {
      result.push(factorDescriptions[i]);
    }
  }
  return result;
}

/**
 * 四化影响指示器
 */
const SiHuaImpactIndicator: React.FC<{ impact: number }> = ({ impact }) => {
  const getImpactInfo = () => {
    if (impact >= 15) return { text: '大吉', color: '#f5222d', icon: <CheckCircleOutlined /> };
    if (impact >= 5) return { text: '吉', color: '#fa8c16', icon: <CheckCircleOutlined /> };
    if (impact >= -5) return { text: '平', color: '#1890ff', icon: <InfoCircleOutlined /> };
    if (impact >= -15) return { text: '凶', color: '#722ed1', icon: <ExclamationCircleOutlined /> };
    return { text: '大凶', color: '#120338', icon: <ExclamationCircleOutlined /> };
  };

  const info = getImpactInfo();

  return (
    <Tooltip title={`四化影响: ${impact > 0 ? '+' : ''}${impact}`}>
      <Tag color={info.color} icon={info.icon}>
        四化{info.text}
      </Tag>
    </Tooltip>
  );
};

/**
 * 星曜统计组件
 */
const StarStats: React.FC<{ liuJiCount: number; liuShaCount: number }> = ({
  liuJiCount,
  liuShaCount,
}) => (
  <Space size="small">
    <Tooltip title="六吉星数量">
      <Badge count={liuJiCount} showZero color="#52c41a" size="small">
        <Tag color="green" icon={<StarOutlined />}>
          吉星
        </Tag>
      </Badge>
    </Tooltip>
    <Tooltip title="六煞星数量">
      <Badge count={liuShaCount} showZero color="#ff4d4f" size="small">
        <Tag color="red" icon={<ThunderboltOutlined />}>
          煞星
        </Tag>
      </Badge>
    </Tooltip>
  </Space>
);

/**
 * 紫微斗数宫位解读组件
 */
const PalaceInterpretationCard: React.FC<PalaceInterpretationCardProps> = ({
  interpretation,
  diZhiIndex,
  isMingGong = false,
  isShenGong = false,
  expanded = true,
  onClick,
}) => {
  const { gongWei, score, fortuneLevel, starStrength, siHuaImpact, liuJiCount, liuShaCount, keywords, factors } =
    interpretation;

  const gongName = GONG_NAMES[gongWei];
  const fortuneLevelName = FORTUNE_LEVEL_NAMES[fortuneLevel as FortuneLevel];
  const fortuneLevelColor = FORTUNE_LEVEL_COLORS[fortuneLevel as FortuneLevel];
  const diZhiName = diZhiIndex !== undefined ? DI_ZHI_NAMES[diZhiIndex] : '';
  const keywordList = parseKeywords(keywords, gongWei);
  const factorList = parseFactors(factors);

  // 构建标题
  const title = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Space>
        <span style={{ fontWeight: 'bold' }}>{gongName}</span>
        {diZhiName && <Tag color="default">{diZhiName}</Tag>}
        {isMingGong && <Tag color="gold">命宫</Tag>}
        {isShenGong && <Tag color="purple">身宫</Tag>}
      </Space>
      <Tag color={fortuneLevelColor}>{fortuneLevelName}</Tag>
    </div>
  );

  return (
    <Card
      title={title}
      size="small"
      onClick={onClick}
      hoverable={!!onClick}
      style={{ marginBottom: 12 }}
      bodyStyle={{ padding: expanded ? 12 : 8 }}
    >
      {/* 评分进度条 */}
      <div style={{ marginBottom: expanded ? 12 : 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#666' }}>宫位评分</span>
          <span style={{ fontSize: 14, fontWeight: 'bold', color: getScoreColor(score) }}>
            {score}分
          </span>
        </div>
        <Progress
          percent={score}
          showInfo={false}
          strokeColor={getScoreColor(score)}
          size="small"
        />
      </div>

      {expanded && (
        <>
          {/* 详细指标 */}
          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>主星强度</div>
                <Progress
                  percent={starStrength}
                  size="small"
                  strokeColor="#1890ff"
                  format={(v) => `${v}`}
                />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>四化影响</div>
                <SiHuaImpactIndicator impact={siHuaImpact} />
              </div>
            </Col>
          </Row>

          {/* 星曜统计 */}
          <div style={{ marginBottom: 12 }}>
            <StarStats liuJiCount={liuJiCount} liuShaCount={liuShaCount} />
          </div>

          {/* 关键词 */}
          {keywordList.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>关键词</div>
              <Space size={[4, 4]} wrap>
                {keywordList.map((kw, idx) => (
                  <Tag key={idx} color="blue">
                    {kw}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          {/* 影响因素 */}
          {factorList.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>影响因素</div>
              <Space size={[4, 4]} wrap>
                {factorList.map((factor, idx) => (
                  <Tag
                    key={idx}
                    color={factor.includes('禄') || factor.includes('权') || factor.includes('科') || factor.includes('吉')
                      ? 'green'
                      : factor.includes('忌') || factor.includes('煞') || factor.includes('陷')
                      ? 'red'
                      : 'default'
                    }
                  >
                    {factor}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default PalaceInterpretationCard;
