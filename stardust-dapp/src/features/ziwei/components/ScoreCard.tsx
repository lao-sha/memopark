/**
 * 紫微斗数整体评分组件
 *
 * 展示命盘的整体评分信息，包括：
 * - 整体评分（圆形进度条）
 * - 命格等级
 * - 各项指数（财运、事业、感情、健康、福德）
 * - 五行分布图
 */

import React from 'react';
import { Card, Progress, Tag, Row, Col, Tooltip } from 'antd';
import {
  TrophyOutlined,
  DollarOutlined,
  TeamOutlined,
  HeartOutlined,
  SafetyOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import type { ChartOverallScore } from '../../../types/ziwei';
import {
  MING_GE_LEVEL_NAMES,
  MING_GE_LEVEL_COLORS,
  MingGeLevel,
} from '../../../types/ziwei';

/**
 * 组件属性
 */
interface ScoreCardProps {
  /** 整体评分数据 */
  score: ChartOverallScore;
  /** 五行分布 [金, 木, 水, 火, 土] */
  wuXingDistribution?: [number, number, number, number, number];
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 点击事件 */
  onClick?: () => void;
}

/**
 * 五行名称
 */
const WU_XING_NAMES = ['金', '木', '水', '火', '土'];

/**
 * 五行颜色
 */
const WU_XING_COLORS = ['#ffd700', '#52c41a', '#1890ff', '#f5222d', '#fa8c16'];

/**
 * 获取评分等级颜色
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
 * 指数项组件
 */
interface IndexItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}

const IndexItem: React.FC<IndexItemProps> = ({ icon, label, value, color }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    marginBottom: 8,
    padding: '4px 8px',
    borderRadius: 4,
    backgroundColor: '#fafafa',
  }}>
    <span style={{ marginRight: 8, color: color || '#666' }}>{icon}</span>
    <span style={{ flex: 1, fontSize: 12, color: '#666' }}>{label}</span>
    <Progress
      percent={value}
      size="small"
      strokeColor={getScoreColor(value)}
      format={(v) => `${v}`}
      style={{ width: 80, marginBottom: 0 }}
    />
  </div>
);

/**
 * 五行分布条
 */
interface WuXingBarProps {
  distribution: [number, number, number, number, number];
}

const WuXingBar: React.FC<WuXingBarProps> = ({ distribution }) => (
  <div style={{ marginTop: 16 }}>
    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>五行分布</div>
    <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
      {distribution.map((value, index) => (
        <Tooltip
          key={index}
          title={`${WU_XING_NAMES[index]}: ${value}%`}
        >
          <div
            style={{
              flex: value,
              backgroundColor: WU_XING_COLORS[index],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: index === 0 ? '#333' : '#fff',
              fontSize: 10,
              minWidth: value > 10 ? 'auto' : 0,
            }}
          >
            {value > 15 ? WU_XING_NAMES[index] : ''}
          </div>
        </Tooltip>
      ))}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
      {WU_XING_NAMES.map((name, index) => (
        <span key={index} style={{ fontSize: 10, color: WU_XING_COLORS[index] }}>
          {name} {distribution[index]}%
        </span>
      ))}
    </div>
  </div>
);

/**
 * 紫微斗数整体评分组件
 */
const ScoreCard: React.FC<ScoreCardProps> = ({
  score,
  wuXingDistribution,
  showDetails = true,
  onClick,
}) => {
  const mingGeLevelName = MING_GE_LEVEL_NAMES[score.mingGeLevel as MingGeLevel];
  const mingGeLevelColor = MING_GE_LEVEL_COLORS[score.mingGeLevel as MingGeLevel];

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><TrophyOutlined style={{ marginRight: 8 }} />命盘总评</span>
          <Tag color={mingGeLevelColor}>{mingGeLevelName}</Tag>
        </div>
      }
      onClick={onClick}
      hoverable={!!onClick}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={16}>
        {/* 左侧：整体评分圆环 */}
        <Col span={10} style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={score.overallScore}
            strokeColor={{
              '0%': '#108ee9',
              '100%': getScoreColor(score.overallScore),
            }}
            format={(percent) => (
              <div>
                <div style={{ fontSize: 28, fontWeight: 'bold', color: getScoreColor(score.overallScore) }}>
                  {percent}
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>总评分</div>
              </div>
            )}
            size={120}
          />
        </Col>

        {/* 右侧：各项指数 */}
        <Col span={14}>
          {showDetails && (
            <>
              <IndexItem
                icon={<DollarOutlined />}
                label="财运"
                value={score.wealthIndex}
                color="#ffd700"
              />
              <IndexItem
                icon={<TeamOutlined />}
                label="事业"
                value={score.careerIndex}
                color="#1890ff"
              />
              <IndexItem
                icon={<HeartOutlined />}
                label="感情"
                value={score.relationshipIndex}
                color="#eb2f96"
              />
              <IndexItem
                icon={<SafetyOutlined />}
                label="健康"
                value={score.healthIndex}
                color="#52c41a"
              />
              <IndexItem
                icon={<SmileOutlined />}
                label="福德"
                value={score.fortuneIndex}
                color="#722ed1"
              />
            </>
          )}
        </Col>
      </Row>

      {/* 五行分布 */}
      {wuXingDistribution && showDetails && (
        <WuXingBar distribution={wuXingDistribution} />
      )}
    </Card>
  );
};

export default ScoreCard;
