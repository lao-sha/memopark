/**
 * 塔罗牌占卜历史记录页面
 *
 * 展示用户的占卜历史，包括：
 * - 占卜记录列表
 * - 统计信息（总次数、常见牌等）
 * - 趋势分析
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Spin,
  message,
  List,
  Tag,
  Empty,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  HistoryOutlined,
  FireOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import {
  getUserReadingsWithDetails,
  getUserStats,
  batchGetCoreInterpretations,
} from '../../services/tarotService';
import type { TarotReading, TarotCoreInterpretation } from '../../types/tarot';
import {
  SPREAD_TYPE_NAMES,
  MAJOR_ARCANA_NAMES_CN,
  FORTUNE_TENDENCY_NAMES,
  FORTUNE_TENDENCY_COLORS,
  FortuneTendency,
} from '../../types/tarot';
import { TarotSpread } from '../../components/TarotCard';
import { useAccountStore } from '../../stores/accountStore';

const { Title, Text, Paragraph } = Typography;

/**
 * 历史记录项组件
 */
interface HistoryItemProps {
  reading: TarotReading;
  interpretation?: TarotCoreInterpretation | null;
  onClick: () => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ reading, interpretation, onClick }) => {
  const date = new Date(reading.timestamp * 1000);
  const fortuneTendency = interpretation?.fortuneTendency ?? FortuneTendency.Neutral;

  return (
    <Card
      hoverable
      size="small"
      onClick={onClick}
      style={{ marginBottom: 12 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* 头部信息 */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong>{SPREAD_TYPE_NAMES[reading.spreadType]}</Text>
          <Tag color={FORTUNE_TENDENCY_COLORS[fortuneTendency]}>
            {FORTUNE_TENDENCY_NAMES[fortuneTendency]}
          </Tag>
        </Space>

        {/* 牌阵缩略图 */}
        <TarotSpread
          cards={reading.cards.map((c) => ({
            cardId: c.card.id,
            isReversed: c.position === 1,
          }))}
          size="small"
        />

        {/* 底部信息 */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {date.toLocaleDateString('zh-CN')} {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {reading.cards.length}张牌
          </Text>
        </Space>
      </Space>
    </Card>
  );
};

/**
 * 塔罗牌占卜历史页面
 */
const TarotHistoryPage: React.FC = () => {
  const { selectedAccount } = useAccountStore();
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<TarotReading[]>([]);
  const [interpretations, setInterpretations] = useState<Map<number, TarotCoreInterpretation | null>>(new Map());
  const [stats, setStats] = useState<{
    totalReadings: number;
    majorArcanaCount: number;
    reversedCount: number;
    mostFrequentCard: number;
    mostFrequentCount: number;
  } | null>(null);

  useEffect(() => {
    loadHistory();
  }, [selectedAccount]);

  /**
   * 加载历史记录
   */
  const loadHistory = async () => {
    if (!selectedAccount) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 并行加载占卜记录和统计数据
      const [userReadings, userStats] = await Promise.all([
        getUserReadingsWithDetails(selectedAccount.address),
        getUserStats(selectedAccount.address),
      ]);

      // 按时间倒序排列
      const sortedReadings = userReadings.sort((a, b) => b.timestamp - a.timestamp);
      setReadings(sortedReadings);
      setStats(userStats);

      // 批量获取解卦数据
      if (sortedReadings.length > 0) {
        const readingIds = sortedReadings.map((r) => r.id);
        const interpResults = await batchGetCoreInterpretations(readingIds);
        const interpMap = new Map<number, TarotCoreInterpretation | null>();
        interpResults.forEach((result) => {
          interpMap.set(result.id, result.interpretation);
        });
        setInterpretations(interpMap);
      }

      console.log('[TarotHistoryPage] 加载成功，记录数:', sortedReadings.length);
    } catch (error: any) {
      console.error('[TarotHistoryPage] 加载失败:', error);
      message.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 跳转到占卜详情
   */
  const handleViewReading = (readingId: number) => {
    window.location.hash = `#/tarot/reading/${readingId}`;
  };

  /**
   * 开始新占卜
   */
  const handleNewReading = () => {
    window.location.hash = '#/tarot';
  };

  if (loading) {
    return (
      <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto', textAlign: 'center' }}>
        <Spin size="large" tip="正在加载历史记录..." />
      </div>
    );
  }

  if (!selectedAccount) {
    return (
      <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
        <Card>
          <Empty description="请先连接钱包" />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => window.history.back()}
          >
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            <HistoryOutlined style={{ marginRight: 8 }} />
            占卜历史
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            查看您的塔罗牌占卜记录和趋势分析
          </Paragraph>
        </Space>
      </Card>

      {/* 统计卡片 */}
      {stats && stats.totalReadings > 0 && (
        <Card title="占卜统计" style={{ marginBottom: '16px' }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="总次数"
                value={stats.totalReadings}
                prefix={<HistoryOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="大阿卡纳"
                value={stats.majorArcanaCount}
                prefix={<FireOutlined style={{ color: '#722ed1' }} />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="逆位牌"
                value={stats.reversedCount}
                prefix={<RiseOutlined style={{ color: '#fa8c16' }} />}
              />
            </Col>
          </Row>

          {/* 最常出现的牌 */}
          {stats.mostFrequentCount > 0 && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Text type="secondary">最常出现的牌：</Text>
              <Tag color="purple" style={{ marginLeft: 8 }}>
                {stats.mostFrequentCard < 22
                  ? MAJOR_ARCANA_NAMES_CN[stats.mostFrequentCard]
                  : `#${stats.mostFrequentCard}`}
                （{stats.mostFrequentCount}次）
              </Tag>
            </div>
          )}
        </Card>
      )}

      {/* 历史记录列表 */}
      <Card
        title={`占卜记录 (${readings.length})`}
        extra={
          <Button type="primary" size="small" onClick={handleNewReading}>
            新占卜
          </Button>
        }
      >
        {readings.length === 0 ? (
          <Empty
            description="暂无占卜记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleNewReading}>
              开始第一次占卜
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={readings}
            renderItem={(reading) => (
              <HistoryItem
                reading={reading}
                interpretation={interpretations.get(reading.id)}
                onClick={() => handleViewReading(reading.id)}
              />
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default TarotHistoryPage;
