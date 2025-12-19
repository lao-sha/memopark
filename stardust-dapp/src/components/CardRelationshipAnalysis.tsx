/**
 * 塔罗牌牌间关系分析组件
 *
 * 分析相邻牌之间的能量关系，包括：
 * - 元素相生相克
 * - 同花色强化
 * - 大阿卡纳与小阿卡纳的互动
 * - 能量流动方向
 */

import React from 'react';
import { Card, Typography, Space, Tag, Progress, Divider, Tooltip } from 'antd';
import {
  ArrowRightOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  FireOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import {
  Suit,
  RelationshipType,
  RELATIONSHIP_TYPE_NAMES,
  SUIT_COLORS,
  SUIT_ELEMENTS,
  isMajorArcana,
  getCardSuit,
  getCardFullName,
} from '../types/tarot';

const { Text, Paragraph } = Typography;

/**
 * 元素相生关系（五行相生）
 * 火 -> 土 -> 风 -> 水 -> 火
 */
const ELEMENT_GENERATING: Record<Suit, Suit> = {
  [Suit.None]: Suit.None,
  [Suit.Wands]: Suit.Pentacles,   // 火生土
  [Suit.Pentacles]: Suit.Swords,  // 土生风
  [Suit.Swords]: Suit.Cups,       // 风生水
  [Suit.Cups]: Suit.Wands,        // 水生火
};

/**
 * 元素相克关系（五行相克）
 * 火 -> 风 -> 土 -> 水 -> 火
 */
const ELEMENT_CONTROLLING: Record<Suit, Suit> = {
  [Suit.None]: Suit.None,
  [Suit.Wands]: Suit.Swords,      // 火克风
  [Suit.Swords]: Suit.Pentacles,  // 风克土
  [Suit.Pentacles]: Suit.Cups,    // 土克水
  [Suit.Cups]: Suit.Wands,        // 水克火
};

/**
 * 关系类型颜色
 */
const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  [RelationshipType.None]: '#888888',
  [RelationshipType.Generating]: '#52c41a',         // 绿色 - 相生
  [RelationshipType.Controlling]: '#ff4d4f',        // 红色 - 相克
  [RelationshipType.SameElementReinforce]: '#1890ff', // 蓝色 - 同元素
  [RelationshipType.Opposing]: '#722ed1',           // 紫色 - 对立
  [RelationshipType.Complementary]: '#faad14',      // 黄色 - 互补
};

/**
 * 关系图标
 */
const RELATIONSHIP_ICONS: Record<RelationshipType, React.ReactNode> = {
  [RelationshipType.None]: null,
  [RelationshipType.Generating]: <HeartOutlined />,
  [RelationshipType.Controlling]: <ThunderboltOutlined />,
  [RelationshipType.SameElementReinforce]: <FireOutlined />,
  [RelationshipType.Opposing]: <CloudOutlined />,
  [RelationshipType.Complementary]: <ArrowRightOutlined />,
};

/**
 * 分析两张牌之间的关系
 *
 * @param card1Id 第一张牌ID
 * @param card2Id 第二张牌ID
 * @returns 关系类型和强度
 */
export function analyzeRelationship(
  card1Id: number,
  card2Id: number
): { type: RelationshipType; strength: number; description: string } {
  const isMajor1 = isMajorArcana(card1Id);
  const isMajor2 = isMajorArcana(card2Id);
  const suit1 = getCardSuit(card1Id);
  const suit2 = getCardSuit(card2Id);

  // 两张大阿卡纳：特殊组合
  if (isMajor1 && isMajor2) {
    // 愚者(0)与世界(21)：完整循环
    if ((card1Id === 0 && card2Id === 21) || (card1Id === 21 && card2Id === 0)) {
      return {
        type: RelationshipType.Complementary,
        strength: 100,
        description: '愚者与世界相遇，代表完整的人生旅程，一个循环的结束与新的开始。',
      };
    }
    // 相邻大阿卡纳
    if (Math.abs(card1Id - card2Id) === 1) {
      return {
        type: RelationshipType.Generating,
        strength: 80,
        description: '相邻的大阿卡纳代表灵魂旅程的连续阶段，能量自然流动。',
      };
    }
    // 对立大阿卡纳（如塔16与星星17）
    if (
      (card1Id === 15 && card2Id === 17) || // 恶魔与星星
      (card1Id === 16 && card2Id === 17) || // 塔与星星
      (card1Id === 13 && card2Id === 19)    // 死神与太阳
    ) {
      return {
        type: RelationshipType.Complementary,
        strength: 90,
        description: '黑暗与光明的对比，代表从困境到希望的转变。',
      };
    }
    return {
      type: RelationshipType.Generating,
      strength: 60,
      description: '两张大阿卡纳共同出现，强调这是重大的人生主题。',
    };
  }

  // 一张大阿卡纳，一张小阿卡纳
  if (isMajor1 !== isMajor2) {
    const majorId = isMajor1 ? card1Id : card2Id;
    const minorSuit = isMajor1 ? suit2 : suit1;

    // 大阿卡纳与对应元素的小阿卡纳
    const majorElementMap: Record<number, Suit> = {
      1: Suit.Wands,      // 魔术师 - 火
      3: Suit.Pentacles,  // 皇后 - 土
      5: Suit.Pentacles,  // 教皇 - 土
      7: Suit.Cups,       // 战车 - 水
      8: Suit.Wands,      // 力量 - 火
      11: Suit.Swords,    // 正义 - 风
      12: Suit.Cups,      // 倒吊人 - 水
      14: Suit.Wands,     // 节制 - 火
      17: Suit.Swords,    // 星星 - 风
      18: Suit.Cups,      // 月亮 - 水
      19: Suit.Wands,     // 太阳 - 火
    };

    if (majorElementMap[majorId] === minorSuit) {
      return {
        type: RelationshipType.SameElementReinforce,
        strength: 85,
        description: '大阿卡纳与同元素小阿卡纳共鸣，放大了该领域的能量。',
      };
    }

    return {
      type: RelationshipType.Generating,
      strength: 50,
      description: '大阿卡纳为小阿卡纳提供更宏观的指引和背景。',
    };
  }

  // 两张小阿卡纳
  // 同花色
  if (suit1 === suit2) {
    return {
      type: RelationshipType.SameElementReinforce,
      strength: 75,
      description: `同为${SUIT_ELEMENTS[suit1]}元素，能量在该领域叠加增强。`,
    };
  }

  // 相生关系
  if (ELEMENT_GENERATING[suit1] === suit2) {
    return {
      type: RelationshipType.Generating,
      strength: 70,
      description: `${SUIT_ELEMENTS[suit1]}生${SUIT_ELEMENTS[suit2]}，能量自然流动，相互促进。`,
    };
  }

  // 相克关系
  if (ELEMENT_CONTROLLING[suit1] === suit2) {
    return {
      type: RelationshipType.Controlling,
      strength: 65,
      description: `${SUIT_ELEMENTS[suit1]}克${SUIT_ELEMENTS[suit2]}，存在能量冲突，需要平衡。`,
    };
  }

  // 其他组合
  return {
    type: RelationshipType.Complementary,
    strength: 50,
    description: '不同元素的组合提供了多角度的视角和平衡。',
  };
}

/**
 * 牌间关系属性
 */
interface CardRelationshipAnalysisProps {
  /** 牌列表 [{cardId, isReversed}] */
  cards: Array<{ cardId: number; isReversed: boolean }>;
  /** 位置名称列表 */
  positionNames: string[];
}

/**
 * 牌间关系分析组件
 */
const CardRelationshipAnalysis: React.FC<CardRelationshipAnalysisProps> = ({
  cards,
  positionNames,
}) => {
  if (cards.length < 2) {
    return null;
  }

  // 分析相邻牌的关系
  const relationships = [];
  for (let i = 0; i < cards.length - 1; i++) {
    const relation = analyzeRelationship(cards[i].cardId, cards[i + 1].cardId);
    relationships.push({
      index1: i,
      index2: i + 1,
      card1Name: getCardFullName(cards[i].cardId),
      card2Name: getCardFullName(cards[i + 1].cardId),
      position1: positionNames[i] || `位置${i + 1}`,
      position2: positionNames[i + 1] || `位置${i + 2}`,
      ...relation,
    });
  }

  // 计算整体和谐度
  const totalStrength = relationships.reduce((sum, r) => sum + r.strength, 0);
  const avgHarmony = Math.round(totalStrength / relationships.length);

  // 统计关系类型
  const typeCount: Record<RelationshipType, number> = {
    [RelationshipType.None]: 0,
    [RelationshipType.Generating]: 0,
    [RelationshipType.Controlling]: 0,
    [RelationshipType.SameElementReinforce]: 0,
    [RelationshipType.Opposing]: 0,
    [RelationshipType.Complementary]: 0,
  };
  relationships.forEach((r) => {
    typeCount[r.type]++;
  });

  return (
    <Card title="牌间关系分析" style={{ marginBottom: '16px' }}>
      {/* 整体和谐度 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>整体和谐度</Text>
        <Progress
          percent={avgHarmony}
          strokeColor={{
            '0%': '#ff4d4f',
            '50%': '#faad14',
            '100%': '#52c41a',
          }}
          format={(percent) => `${percent}%`}
        />
      </div>

      {/* 关系统计 */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          {Object.entries(typeCount)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => (
              <Tooltip key={type} title={RELATIONSHIP_TYPE_NAMES[Number(type) as RelationshipType]}>
                <Tag color={RELATIONSHIP_COLORS[Number(type) as RelationshipType]}>
                  {RELATIONSHIP_ICONS[Number(type) as RelationshipType]}{' '}
                  {RELATIONSHIP_TYPE_NAMES[Number(type) as RelationshipType]} × {count}
                </Tag>
              </Tooltip>
            ))}
        </Space>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 详细关系列表 */}
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {relationships.map((rel, index) => (
          <Card
            key={index}
            size="small"
            style={{
              backgroundColor: '#fafafa',
              borderLeft: `3px solid ${RELATIONSHIP_COLORS[rel.type]}`,
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {/* 牌面信息 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{rel.position1}</Text>
                  <br />
                  <Text strong>{rel.card1Name}</Text>
                  {cards[rel.index1].isReversed && <Tag color="orange" style={{ marginLeft: 4 }}>逆</Tag>}
                </div>
                <div style={{ padding: '0 12px' }}>
                  <Tag color={RELATIONSHIP_COLORS[rel.type]}>
                    {RELATIONSHIP_ICONS[rel.type]} {RELATIONSHIP_TYPE_NAMES[rel.type]}
                  </Tag>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{rel.position2}</Text>
                  <br />
                  <Text strong>{rel.card2Name}</Text>
                  {cards[rel.index2].isReversed && <Tag color="orange" style={{ marginLeft: 4 }}>逆</Tag>}
                </div>
              </div>

              {/* 关系描述 */}
              <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                {rel.description}
              </Paragraph>

              {/* 能量强度 */}
              <Progress
                percent={rel.strength}
                size="small"
                strokeColor={RELATIONSHIP_COLORS[rel.type]}
                format={(percent) => `${percent}%`}
              />
            </Space>
          </Card>
        ))}
      </Space>

      {/* 综合解读 */}
      <Divider style={{ margin: '16px 0 12px' }} />
      <div>
        <Text strong>综合解读</Text>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          {typeCount[RelationshipType.Generating] > typeCount[RelationshipType.Controlling]
            ? '牌阵整体能量流动顺畅，各牌之间相互促进，显示出积极的发展趋势。'
            : typeCount[RelationshipType.Controlling] > typeCount[RelationshipType.Generating]
            ? '牌阵中存在一些能量冲突，暗示当前情况需要克服一些障碍和挑战。'
            : '牌阵能量较为平衡，各方面因素相互作用，需要综合考量各种可能性。'}
          {typeCount[RelationshipType.SameElementReinforce] >= 2 &&
            ' 多处同元素强化显示该领域是当前的重点关注方向。'}
          {avgHarmony >= 70
            ? ' 整体和谐度较高，各牌的指引方向一致性强。'
            : avgHarmony <= 40
            ? ' 和谐度较低，需要特别注意各方面的平衡与协调。'
            : ''}
        </Paragraph>
      </div>
    </Card>
  );
};

export default CardRelationshipAnalysis;
