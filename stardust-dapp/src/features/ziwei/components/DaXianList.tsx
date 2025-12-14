/**
 * 紫微斗数大限解读组件
 *
 * 展示大限（十年运程）的详细解读，包括：
 * - 大限时间段
 * - 运势评分
 * - 四化飞入
 * - 关键词提示
 */

import React, { useState } from 'react';
import { Card, Timeline, Tag, Progress, Space, Typography, Row, Col, Segmented, Empty } from 'antd';
import {
  ClockCircleOutlined,
  RightCircleOutlined,
  StarOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { DaXianInterpretation } from '../../../types/ziwei';
import {
  FortuneLevel,
  FORTUNE_LEVEL_NAMES,
  FORTUNE_LEVEL_COLORS,
  GONG_NAMES,
  Gong,
} from '../../../types/ziwei';

const { Text } = Typography;

/**
 * 组件属性
 */
interface DaXianListProps {
  /** 大限解读列表（12个） */
  daXians: DaXianInterpretation[];
  /** 当前年龄（用于高亮当前大限） */
  currentAge?: number;
  /** 是否显示详情 */
  showDetails?: boolean;
}

/**
 * 大限关键词表
 */
const DA_XIAN_KEYWORDS = [
  // 时期关键词 (60-63)
  '起步期', '发展期', '稳定期', '收获期',
  // 运势关键词 (64-67)
  '顺遂', '平稳', '波折', '挑战',
  // 建议关键词 (68-71)
  '宜进取', '宜守成', '宜变通', '宜谨慎',
];

/**
 * 获取大限关键词
 */
function getDaXianKeyword(index: number): string {
  if (index >= 60 && index < 72) {
    return DA_XIAN_KEYWORDS[index - 60] || '未知';
  }
  return '未知';
}

/**
 * 获取评分颜色
 */
function getScoreColor(score: number): string {
  if (score >= 85) return '#f5222d';
  if (score >= 70) return '#fa541c';
  if (score >= 55) return '#fa8c16';
  if (score >= 40) return '#1890ff';
  if (score >= 25) return '#722ed1';
  return '#595959';
}

/**
 * 获取宫位名称
 */
function getGongName(index: number): string {
  if (index >= 0 && index < 12) {
    return GONG_NAMES[index as Gong];
  }
  return '未知';
}

/**
 * 四化配置
 */
const SI_HUA_SHORT = ['禄', '权', '科', '忌'];
const SI_HUA_COLORS = ['#52c41a', '#1890ff', '#722ed1', '#f5222d'];

/**
 * 单个大限项组件
 */
interface DaXianItemProps {
  daXian: DaXianInterpretation;
  isActive: boolean;
  showDetails: boolean;
}

const DaXianItem: React.FC<DaXianItemProps> = ({ daXian, isActive, showDetails }) => {
  const { index, startAge, endAge, gongIndex, score, fortuneLevel, siHuaFeiRu, keywords } = daXian;

  const fortuneLevelName = FORTUNE_LEVEL_NAMES[fortuneLevel as FortuneLevel];
  const fortuneLevelColor = FORTUNE_LEVEL_COLORS[fortuneLevel as FortuneLevel];
  const gongName = getGongName(gongIndex);
  const keywordList = keywords.map(getDaXianKeyword).filter((k) => k !== '未知');

  return (
    <div
      style={{
        padding: 12,
        backgroundColor: isActive ? '#e6f7ff' : '#fafafa',
        borderRadius: 8,
        border: isActive ? '2px solid #1890ff' : '1px solid #f0f0f0',
        marginBottom: 8,
      }}
    >
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space>
          <Tag color={isActive ? 'blue' : 'default'}>第{index}大限</Tag>
          <Text strong>
            {startAge}岁 - {endAge}岁
          </Text>
          {isActive && <Tag color="processing">当前</Tag>}
        </Space>
        <Tag color={fortuneLevelColor}>{fortuneLevelName}</Tag>
      </div>

      {/* 宫位和评分 */}
      <Row gutter={8} style={{ marginBottom: showDetails ? 8 : 0 }}>
        <Col span={8}>
          <div style={{ fontSize: 11, color: '#999' }}>大限宫位</div>
          <Tag color="purple">{gongName}宫</Tag>
        </Col>
        <Col span={16}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>运势评分</div>
          <Progress
            percent={score}
            size="small"
            strokeColor={getScoreColor(score)}
            format={(v) => `${v}`}
          />
        </Col>
      </Row>

      {showDetails && (
        <>
          {/* 四化飞入 */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>大限四化</div>
            <Space size={4}>
              {siHuaFeiRu.map((gongIdx, idx) => (
                <Tag
                  key={idx}
                  color={SI_HUA_COLORS[idx]}
                  icon={<RightCircleOutlined />}
                  style={{ fontSize: 10 }}
                >
                  {SI_HUA_SHORT[idx]}→{getGongName(gongIdx)}
                </Tag>
              ))}
            </Space>
          </div>

          {/* 关键词 */}
          {keywordList.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>运势提示</div>
              <Space size={4}>
                {keywordList.map((kw, idx) => (
                  <Tag key={idx} color="cyan">
                    {kw}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * 大限时间线视图
 */
const DaXianTimeline: React.FC<{
  daXians: DaXianInterpretation[];
  currentAge?: number;
  showDetails: boolean;
}> = ({ daXians, currentAge, showDetails }) => {
  const getCurrentDaXianIndex = () => {
    if (currentAge === undefined) return -1;
    return daXians.findIndex((d) => currentAge >= d.startAge && currentAge <= d.endAge);
  };

  const activeIndex = getCurrentDaXianIndex();

  return (
    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
      {daXians.map((daXian, idx) => (
        <DaXianItem
          key={idx}
          daXian={daXian}
          isActive={idx === activeIndex}
          showDetails={showDetails}
        />
      ))}
    </div>
  );
};

/**
 * 大限概览图
 */
const DaXianOverview: React.FC<{
  daXians: DaXianInterpretation[];
  currentAge?: number;
}> = ({ daXians, currentAge }) => {
  const getCurrentDaXianIndex = () => {
    if (currentAge === undefined) return -1;
    return daXians.findIndex((d) => currentAge >= d.startAge && currentAge <= d.endAge);
  };

  const activeIndex = getCurrentDaXianIndex();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {daXians.map((daXian, idx) => {
        const isActive = idx === activeIndex;
        const fortuneColor = FORTUNE_LEVEL_COLORS[daXian.fortuneLevel as FortuneLevel];

        return (
          <div
            key={idx}
            style={{
              flex: '1 1 calc(25% - 4px)',
              minWidth: 60,
              padding: 8,
              borderRadius: 4,
              backgroundColor: isActive ? '#e6f7ff' : '#fafafa',
              border: isActive ? '2px solid #1890ff' : `1px solid ${fortuneColor}40`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: '#999' }}>
              {daXian.startAge}-{daXian.endAge}岁
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: getScoreColor(daXian.score),
              }}
            >
              {daXian.score}
            </div>
            <Tag
              color={fortuneColor}
              style={{ fontSize: 10, margin: 0 }}
            >
              {FORTUNE_LEVEL_NAMES[daXian.fortuneLevel as FortuneLevel]}
            </Tag>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 紫微斗数大限解读组件
 */
const DaXianList: React.FC<DaXianListProps> = ({
  daXians,
  currentAge,
  showDetails = true,
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'overview'>('overview');

  if (daXians.length === 0) {
    return (
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>大限运程</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无大限数据"
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ClockCircleOutlined />
            <span>大限运程</span>
            {currentAge !== undefined && (
              <Tag color="blue" icon={<CalendarOutlined />}>
                当前{currentAge}岁
              </Tag>
            )}
          </Space>
          <Segmented
            size="small"
            options={[
              { value: 'overview', label: '概览' },
              { value: 'timeline', label: '详情' },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as 'timeline' | 'overview')}
          />
        </div>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      {viewMode === 'overview' ? (
        <DaXianOverview daXians={daXians} currentAge={currentAge} />
      ) : (
        <DaXianTimeline daXians={daXians} currentAge={currentAge} showDetails={showDetails} />
      )}
    </Card>
  );
};

export default DaXianList;
