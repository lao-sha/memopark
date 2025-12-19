/**
 * 塔罗牌占卜结果页面
 *
 * 展示单次占卜的完整结果，包括：
 * - 抽到的牌面信息（正逆位）
 * - 核心解读（能量、元素、吉凶）
 * - 牌阵位置详情
 * - AI 深度解读（可选）
 */

import React, { useEffect, useState } from 'react';
import { Card, Typography, Space, Button, Spin, message, Tag, Divider, Progress, Collapse } from 'antd';
import {
  ArrowLeftOutlined,
  FireOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  CrownOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { getReadingWithInterpretation } from '../../services/tarotService';
import type {
  TarotReading,
  TarotCoreInterpretation,
  InterpretationTextType,
  SpreadEnergyAnalysis,
  TimelineAnalysis,
} from '../../types/tarot';
import {
  SPREAD_TYPE_NAMES,
  SPREAD_POSITION_NAMES,
  MAJOR_ARCANA_NAMES_CN,
  SUIT_NAMES_CN,
  SUIT_COLORS,
  CardType,
} from '../../types/tarot';
import { getCardMeaning, getCurrentMeaning, getKeywords } from '../../data/tarotMeanings';
import TarotCard, { TarotSpread } from '../../components/TarotCard';
import CardRelationshipAnalysis from '../../components/CardRelationshipAnalysis';
import AiTarotInterpretation from '../../components/AiTarotInterpretation';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * 获取牌的显示名称
 */
function getCardDisplayName(card: any): string {
  if (card.cardType === CardType.MajorArcana) {
    return MAJOR_ARCANA_NAMES_CN[card.id] || `大阿尔卡纳 ${card.id}`;
  } else {
    const suit = SUIT_NAMES_CN[card.suit] || '';
    const rank = card.rank || '';
    return `${suit}${rank}`;
  }
}

/**
 * 元素图标映射
 */
const ELEMENT_ICONS: Record<number, React.ReactNode> = {
  0: <FireOutlined style={{ color: '#f5222d' }} />,      // 火
  1: <HeartOutlined style={{ color: '#1890ff' }} />,     // 水
  2: <ThunderboltOutlined style={{ color: '#722ed1' }} />, // 风
  3: <CrownOutlined style={{ color: '#faad14' }} />,     // 土
  4: <FireOutlined style={{ color: '#13c2c2' }} />,      // 灵性
};

/**
 * 吉凶等级文本
 */
const FORTUNE_LEVEL_TEXT = ['凶', '小凶', '平', '吉', '大吉'];

/**
 * 吉凶等级颜色
 */
const FORTUNE_LEVEL_COLORS = ['#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#237804'];

/**
 * 塔罗牌占卜结果页面
 */
const TarotReadingPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [coreInterpretation, setCoreInterpretation] = useState<TarotCoreInterpretation | null>(null);
  const [interpretationTexts, setInterpretationTexts] = useState<InterpretationTextType[] | null>(null);
  const [spreadEnergy, setSpreadEnergy] = useState<SpreadEnergyAnalysis | null>(null);
  const [timeline, setTimeline] = useState<TimelineAnalysis | null>(null);

  useEffect(() => {
    loadReading();
  }, []);

  /**
   * 加载占卜数据
   */
  const loadReading = async () => {
    try {
      // 从 URL 中获取 readingId
      const hash = window.location.hash;
      const match = hash.match(/#\/tarot\/reading\/(\d+)/);
      if (!match) {
        message.error('无效的占卜记录 ID');
        return;
      }

      const readingId = parseInt(match[1], 10);
      console.log('[TarotReadingPage] 加载占卜 ID:', readingId);

      // 获取完整解读数据
      const data = await getReadingWithInterpretation(readingId);

      if (!data.reading) {
        message.error('占卜记录不存在');
        return;
      }

      console.log('[TarotReadingPage] 加载成功:', data);
      setReading(data.reading);
      setCoreInterpretation(data.core);
      setInterpretationTexts(data.texts);
      setSpreadEnergy(data.spreadEnergy);
      setTimeline(data.timeline);

    } catch (error: any) {
      console.error('[TarotReadingPage] 加载失败:', error);
      message.error(error.message || '加载占卜记录失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto', textAlign: 'center' }}>
        <Spin size="large" tip="正在加载占卜结果..." />
      </div>
    );
  }

  if (!reading) {
    return (
      <div style={{ padding: '12px', maxWidth: '414px', paddingBottom: '80px', minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
        <Card>
          <Text type="secondary">占卜记录不存在</Text>
          <br />
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => window.history.back()}
          >
            返回
          </Button>
        </Card>
      </div>
    );
  }

  const positionNames = SPREAD_POSITION_NAMES[reading.spreadType] || [];

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
            {SPREAD_TYPE_NAMES[reading.spreadType]}
          </Title>
          <Text type="secondary">
            占卜时间: {new Date(reading.timestamp * 1000).toLocaleString('zh-CN')}
          </Text>
        </Space>
      </Card>

      {/* 核心解读 */}
      {coreInterpretation && (
        <Card title="核心解读" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 总体能量 */}
            <div>
              <Text strong>总体能量</Text>
              <Progress
                percent={coreInterpretation.overallEnergy}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>

            {/* 主导元素 */}
            <div>
              <Text strong>主导元素: </Text>
              {ELEMENT_ICONS[coreInterpretation.dominantElement]}
              <Tag color={['red', 'blue', 'purple', 'gold', 'cyan'][coreInterpretation.dominantElement]}>
                {['火', '水', '风', '土', '灵性'][coreInterpretation.dominantElement]}
              </Tag>
            </div>

            {/* 吉凶倾向 */}
            <div>
              <Text strong>吉凶倾向: </Text>
              <Tag color={FORTUNE_LEVEL_COLORS[coreInterpretation.fortuneLevel]}>
                {FORTUNE_LEVEL_TEXT[coreInterpretation.fortuneLevel]}
              </Tag>
            </div>

            {/* 牌面统计 */}
            <div>
              <Text type="secondary">
                大阿尔卡纳: {coreInterpretation.majorArcanaCount}张 |{' '}
                逆位: {coreInterpretation.reversedCount}张
              </Text>
            </div>
          </Space>
        </Card>
      )}

      {/* 牌阵图片展示 */}
      <Card title="牌阵总览" style={{ marginBottom: '16px' }}>
        <TarotSpread
          cards={reading.cards.map((drawnCard) => ({
            cardId: drawnCard.card.id,
            isReversed: drawnCard.position === 1,
          }))}
          size="small"
        />
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: '12px' }}>
          点击下方卡片查看详细解读
        </Text>
      </Card>

      {/* 牌阵位置指南 */}
      <Card title="牌阵位置指南" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {positionNames.map((name, index) => (
            <div key={index}>
              <Tag color="blue">{index + 1}</Tag>
              <Text strong>{name}</Text>
            </div>
          ))}
        </Space>
      </Card>

      {/* 抽到的牌 */}
      <Card title={`您的牌阵 (${reading.cards.length}张)`} style={{ marginBottom: '16px' }}>
        <Collapse accordion>
          {reading.cards.map((drawnCard, index) => {
            const card = drawnCard.card;
            const isReversed = drawnCard.position === 1; // CardPosition::Reversed = 1
            const positionName = positionNames[drawnCard.spreadPosition] || `位置 ${drawnCard.spreadPosition + 1}`;
            const cardMeaning = getCardMeaning(card.id);
            const currentMeaning = getCurrentMeaning(card.id, isReversed);
            const keywords = getKeywords(card.id);

            return (
              <Panel
                key={index}
                header={
                  <Space style={{ width: '100%' }} align="center">
                    {/* 小图片预览 */}
                    <TarotCard
                      cardId={card.id}
                      isReversed={isReversed}
                      size="small"
                      showName={false}
                      showKeywords={false}
                      style={{ marginRight: 8 }}
                    />
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ color: '#1890ff' }}>
                        {positionName}
                      </Text>
                      <Space>
                        <Text style={{ fontSize: '16px' }}>
                          {getCardDisplayName(card)}
                        </Text>
                        {isReversed && (
                          <Tag color="orange">逆位</Tag>
                        )}
                      </Space>
                    </Space>
                  </Space>
                }
                style={{
                  marginBottom: '8px',
                  backgroundColor: isReversed ? '#fff7e6' : '#f0f5ff',
                  border: `1px solid ${isReversed ? '#ffd591' : '#adc6ff'}`,
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {/* 关键词 */}
                  {keywords.length > 0 && (
                    <div>
                      <Text strong>关键词：</Text>
                      <br />
                      <Space wrap style={{ marginTop: '4px' }}>
                        {keywords.map((keyword, i) => (
                          <Tag key={i} color={isReversed ? 'orange' : 'blue'}>
                            {keyword}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* 牌面描述 */}
                  {cardMeaning?.description && (
                    <div>
                      <Text strong>牌面描述：</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: '13px' }}>
                        {cardMeaning.description}
                      </Text>
                    </div>
                  )}

                  <Divider style={{ margin: '8px 0' }} />

                  {/* 当前解读 */}
                  <div>
                    <Text strong style={{ color: isReversed ? '#fa8c16' : '#1890ff' }}>
                      <BookOutlined /> {isReversed ? '逆位' : '正位'}含义：
                    </Text>
                    <br />
                    <Paragraph style={{ marginTop: '8px', marginBottom: 0 }}>
                      {currentMeaning}
                    </Paragraph>
                  </div>

                  {/* 花色（小阿尔卡纳） */}
                  {card.cardType === 1 && (
                    <div>
                      <Tag color={SUIT_COLORS[card.suit]}>
                        {SUIT_NAMES_CN[card.suit]} - {['', '火元素', '水元素', '风元素', '土元素'][card.suit]}
                      </Tag>
                    </div>
                  )}

                  {/* 元素能量 */}
                  {cardMeaning && (
                    <div style={{ textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        元素：{cardMeaning.element}
                      </Text>
                    </div>
                  )}
                </Space>
              </Panel>
            );
          })}
        </Collapse>
      </Card>

      {/* 牌间关系分析 */}
      {reading.cards.length >= 2 && (
        <CardRelationshipAnalysis
          cards={reading.cards.map((c) => ({
            cardId: c.card.id,
            isReversed: c.position === 1,
          }))}
          positionNames={positionNames}
        />
      )}

      {/* 能量分析 */}
      {spreadEnergy && (
        <Card title="能量分析" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {spreadEnergy.pastEnergy !== undefined && (
              <div>
                <Text>过去能量: </Text>
                <Progress
                  percent={spreadEnergy.pastEnergy}
                  size="small"
                  strokeColor="#faad14"
                />
              </div>
            )}
            {spreadEnergy.presentEnergy !== undefined && (
              <div>
                <Text>现在能量: </Text>
                <Progress
                  percent={spreadEnergy.presentEnergy}
                  size="small"
                  strokeColor="#1890ff"
                />
              </div>
            )}
            {spreadEnergy.futureEnergy !== undefined && (
              <div>
                <Text>未来能量: </Text>
                <Progress
                  percent={spreadEnergy.futureEnergy}
                  size="small"
                  strokeColor="#52c41a"
                />
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* 时间线分析 */}
      {timeline && (
        <Card title="时间线分析" style={{ marginBottom: '16px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Text type="secondary">{timeline.trend}</Text>
            {timeline.pastSummary && (
              <div>
                <Text strong>过去: </Text>
                <Text>{timeline.pastSummary}</Text>
              </div>
            )}
            {timeline.presentSummary && (
              <div>
                <Text strong>现在: </Text>
                <Text>{timeline.presentSummary}</Text>
              </div>
            )}
            {timeline.futureSummary && (
              <div>
                <Text strong>未来: </Text>
                <Text>{timeline.futureSummary}</Text>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* 综合解读指引 */}
      <Card title="综合解读指引" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Paragraph>
            {coreInterpretation ? (
              <>
                根据您抽到的牌阵，整体能量指数为 <Text strong>{coreInterpretation.overallEnergy}%</Text>，
                主导元素为 <Text strong>{['火', '水', '风', '土', '灵性'][coreInterpretation.dominantElement]}</Text>。
                {coreInterpretation.reversedCount > 0 && (
                  <>
                    出现了 <Text strong style={{ color: '#fa8c16' }}>{coreInterpretation.reversedCount} 张逆位牌</Text>，
                    提示您需要关注内在的阻碍或需要转变的部分。
                  </>
                )}
                {coreInterpretation.majorArcanaCount > 0 && (
                  <>
                    {' '}本次占卜包含 <Text strong style={{ color: '#722ed1' }}>{coreInterpretation.majorArcanaCount} 张大阿卡纳</Text>，
                    表明这些事件对您的人生有重要意义。
                  </>
                )}
              </>
            ) : (
              '仔细阅读每张牌的含义，结合您的问题和当前处境，从中获得洞见和指引。'
            )}
          </Paragraph>

          <Divider style={{ margin: '8px 0' }} />

          <div>
            <Text strong>💡 解读建议：</Text>
            <br />
            <ul style={{ paddingLeft: '20px', marginTop: '8px', marginBottom: 0 }}>
              <li><Text type="secondary">先整体浏览所有牌面，感受整体能量</Text></li>
              <li><Text type="secondary">按照牌阵位置顺序，深入理解每张牌的含义</Text></li>
              <li><Text type="secondary">将每张牌的含义与您的问题联系起来</Text></li>
              <li><Text type="secondary">注意牌与牌之间的关系和相互影响</Text></li>
              <li><Text type="secondary">相信直觉，牌面会与您的内心产生共鸣</Text></li>
            </ul>
          </div>
        </Space>
      </Card>

      {/* AI 深度解读 */}
      <AiTarotInterpretation
        reading={reading}
        coreInterpretation={coreInterpretation}
        spreadEnergy={spreadEnergy}
      />
    </div>
  );
};

export default TarotReadingPage;
