/**
 * 紫微斗数格局列表组件
 *
 * 展示命盘识别到的所有格局，包括：
 * - 吉格（富贵格、权贵格）
 * - 凶格（煞星格局）
 * - 格局强度和评分
 * - 格局详细描述
 */

import React, { useState } from 'react';
import { Card, List, Tag, Progress, Collapse, Space, Typography, Badge, Empty } from 'antd';
import {
  CrownOutlined,
  ThunderboltOutlined,
  StarOutlined,
  InfoCircleOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { PatternInfo } from '../../../types/ziwei';
import {
  PatternType,
  PATTERN_NAMES,
  PATTERN_DESCRIPTIONS,
  isPatternAuspicious,
} from '../../../types/ziwei';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

/**
 * 组件属性
 */
interface PatternListProps {
  /** 格局列表 */
  patterns: PatternInfo[];
  /** 是否显示详情 */
  showDetails?: boolean;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 标题 */
  title?: string;
}

/**
 * 单个格局项属性
 */
interface PatternItemProps {
  pattern: PatternInfo;
  showDetails?: boolean;
}

/**
 * 获取格局图标
 */
function getPatternIcon(isAuspicious: boolean): React.ReactNode {
  return isAuspicious ? (
    <CrownOutlined style={{ color: '#faad14' }} />
  ) : (
    <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
  );
}

/**
 * 获取格局强度颜色
 */
function getStrengthColor(strength: number): string {
  if (strength >= 80) return '#f5222d';
  if (strength >= 60) return '#fa8c16';
  if (strength >= 40) return '#1890ff';
  return '#8c8c8c';
}

/**
 * 获取评分颜色
 */
function getScoreColor(score: number, isAuspicious: boolean): string {
  if (isAuspicious) {
    if (score >= 40) return '#f5222d';
    if (score >= 25) return '#fa8c16';
    return '#52c41a';
  } else {
    if (score <= -30) return '#120338';
    if (score <= -15) return '#722ed1';
    return '#ff4d4f';
  }
}

/**
 * 格局分类标签
 */
function getPatternCategory(patternType: PatternType): { name: string; color: string } {
  if (patternType <= PatternType.LingTanGeJu) {
    return { name: '富贵格', color: 'gold' };
  } else if (patternType <= PatternType.LuMaJiaoChiGeJu) {
    return { name: '权贵格', color: 'purple' };
  } else {
    return { name: '凶格', color: 'red' };
  }
}

/**
 * 单个格局项组件
 */
const PatternItem: React.FC<PatternItemProps> = ({ pattern, showDetails = true }) => {
  const { patternType, strength, isAuspicious, score, isValid } = pattern;

  const patternName = PATTERN_NAMES[patternType] || '未知格局';
  const patternDesc = PATTERN_DESCRIPTIONS[patternType] || '暂无描述';
  const category = getPatternCategory(patternType);

  return (
    <div
      style={{
        padding: 12,
        backgroundColor: isAuspicious ? '#fffbe6' : '#fff2f0',
        borderRadius: 8,
        marginBottom: 8,
        border: `1px solid ${isAuspicious ? '#ffe58f' : '#ffccc7'}`,
      }}
    >
      {/* 格局标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space>
          {getPatternIcon(isAuspicious)}
          <Text strong style={{ fontSize: 14 }}>
            {patternName}
          </Text>
          <Tag color={category.color} style={{ fontSize: 10 }}>
            {category.name}
          </Tag>
          {!isValid && (
            <Tag color="default" style={{ fontSize: 10 }}>
              待验证
            </Tag>
          )}
        </Space>
        <Tag
          color={getScoreColor(score, isAuspicious)}
          style={{ fontWeight: 'bold' }}
        >
          {score > 0 ? '+' : ''}{score}分
        </Tag>
      </div>

      {/* 格局强度 */}
      <div style={{ marginBottom: showDetails ? 8 : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>格局强度</Text>
          <Text style={{ fontSize: 11, color: getStrengthColor(strength) }}>
            {strength}%
          </Text>
        </div>
        <Progress
          percent={strength}
          showInfo={false}
          strokeColor={getStrengthColor(strength)}
          size="small"
          trailColor="#f0f0f0"
        />
      </div>

      {/* 格局描述 */}
      {showDetails && (
        <Paragraph
          type="secondary"
          style={{
            fontSize: 12,
            marginBottom: 0,
            lineHeight: 1.6,
          }}
        >
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          {patternDesc}
        </Paragraph>
      )}
    </div>
  );
};

/**
 * 格局统计组件
 */
const PatternStats: React.FC<{ patterns: PatternInfo[] }> = ({ patterns }) => {
  const auspiciousCount = patterns.filter((p) => p.isAuspicious).length;
  const inauspiciousCount = patterns.filter((p) => !p.isAuspicious).length;
  const totalScore = patterns.reduce((sum, p) => sum + p.score, 0);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 12,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Badge count={auspiciousCount} showZero color="#52c41a">
          <Tag color="green" icon={<CrownOutlined />}>
            吉格
          </Tag>
        </Badge>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Badge count={inauspiciousCount} showZero color="#ff4d4f">
          <Tag color="red" icon={<ThunderboltOutlined />}>
            凶格
          </Tag>
        </Badge>
      </div>
      <div style={{ textAlign: 'center' }}>
        <Tag
          color={totalScore >= 0 ? 'gold' : 'volcano'}
          icon={<StarOutlined />}
          style={{ fontWeight: 'bold' }}
        >
          总分 {totalScore > 0 ? '+' : ''}{totalScore}
        </Tag>
      </div>
    </div>
  );
};

/**
 * 紫微斗数格局列表组件
 */
const PatternList: React.FC<PatternListProps> = ({
  patterns,
  showDetails = true,
  collapsible = true,
  title = '命盘格局',
}) => {
  const [expanded, setExpanded] = useState(true);

  // 分离吉格和凶格
  const auspiciousPatterns = patterns.filter((p) => p.isAuspicious);
  const inauspiciousPatterns = patterns.filter((p) => !p.isAuspicious);

  if (patterns.length === 0) {
    return (
      <Card
        title={
          <Space>
            <StarOutlined />
            <span>{title}</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="未识别到特殊格局"
        />
      </Card>
    );
  }

  const content = (
    <>
      {/* 统计概览 */}
      <PatternStats patterns={patterns} />

      {/* 吉格列表 */}
      {auspiciousPatterns.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            <CrownOutlined style={{ marginRight: 4, color: '#faad14' }} />
            吉格 ({auspiciousPatterns.length})
          </Text>
          {auspiciousPatterns.map((pattern, index) => (
            <PatternItem key={index} pattern={pattern} showDetails={showDetails} />
          ))}
        </div>
      )}

      {/* 凶格列表 */}
      {inauspiciousPatterns.length > 0 && (
        <div>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            <ThunderboltOutlined style={{ marginRight: 4, color: '#ff4d4f' }} />
            凶格 ({inauspiciousPatterns.length})
          </Text>
          {inauspiciousPatterns.map((pattern, index) => (
            <PatternItem key={index} pattern={pattern} showDetails={showDetails} />
          ))}
        </div>
      )}
    </>
  );

  if (collapsible) {
    return (
      <Card
        title={
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setExpanded(!expanded)}
          >
            <Space>
              <StarOutlined />
              <span>{title}</span>
              <Tag color="blue">{patterns.length}个</Tag>
            </Space>
            {expanded ? <UpOutlined /> : <DownOutlined />}
          </div>
        }
        size="small"
        style={{ marginBottom: 16 }}
        bodyStyle={{ display: expanded ? 'block' : 'none' }}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <StarOutlined />
          <span>{title}</span>
          <Tag color="blue">{patterns.length}个</Tag>
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      {content}
    </Card>
  );
};

export default PatternList;
