/**
 * 塔罗牌卡片展示组件
 *
 * 提供塔罗牌的视觉展示，包括：
 * - 牌面图片（支持正逆位旋转）
 * - 牌名和关键词
 * - 加载占位符
 * - 牌背展示（未翻开状态）
 */

import React, { useState } from 'react';
import { Card, Typography, Tag, Space, Skeleton } from 'antd';
import {
  CardType,
  Suit,
  SUIT_NAMES_CN,
  SUIT_COLORS,
  MAJOR_ARCANA_NAMES_CN,
} from '../types/tarot';
import { getCardMeaning } from '../data/tarotMeanings';

const { Text } = Typography;

/**
 * 塔罗牌卡片属性
 */
interface TarotCardProps {
  /** 牌ID (0-77) */
  cardId: number;
  /** 是否逆位 */
  isReversed?: boolean;
  /** 是否显示牌面（false显示牌背） */
  showFace?: boolean;
  /** 卡片尺寸 */
  size?: 'small' | 'medium' | 'large';
  /** 是否显示关键词 */
  showKeywords?: boolean;
  /** 是否显示牌名 */
  showName?: boolean;
  /** 点击事件 */
  onClick?: () => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 获取牌面图片路径
 *
 * @param cardId 牌ID
 * @returns 图片路径
 */
function getCardImagePath(cardId: number): string {
  if (cardId < 22) {
    // 大阿卡纳：/tarot/major/00.webp - /tarot/major/21.webp
    return `/tarot/major/${cardId.toString().padStart(2, '0')}.webp`;
  }

  // 小阿卡纳
  const minorId = cardId - 22;
  const suitIndex = Math.floor(minorId / 14);
  const cardNumber = (minorId % 14) + 1;

  const suitFolders = ['wands', 'cups', 'swords', 'pentacles'];
  const suitFolder = suitFolders[suitIndex];

  // 格式：/tarot/wands/01.webp - /tarot/wands/14.webp
  return `/tarot/${suitFolder}/${cardNumber.toString().padStart(2, '0')}.webp`;
}

/**
 * 获取牌的显示信息
 *
 * @param cardId 牌ID
 * @returns 牌名和花色信息
 */
function getCardInfo(cardId: number): { name: string; suit?: string; suitColor?: string } {
  if (cardId < 22) {
    return { name: MAJOR_ARCANA_NAMES_CN[cardId] };
  }

  const minorId = cardId - 22;
  const suitIndex = Math.floor(minorId / 14);
  const cardNumber = (minorId % 14) + 1;

  const suits = [Suit.Wands, Suit.Cups, Suit.Swords, Suit.Pentacles];
  const suit = suits[suitIndex];
  const suitName = SUIT_NAMES_CN[suit];

  // 牌面名称
  let cardName: string;
  if (cardNumber === 1) {
    cardName = 'Ace';
  } else if (cardNumber <= 10) {
    cardName = ['', '', '二', '三', '四', '五', '六', '七', '八', '九', '十'][cardNumber];
  } else {
    cardName = ['侍从', '骑士', '王后', '国王'][cardNumber - 11];
  }

  return {
    name: `${suitName}${cardName}`,
    suit: suitName,
    suitColor: SUIT_COLORS[suit],
  };
}

/**
 * 尺寸配置
 */
const SIZE_CONFIG = {
  small: { width: 80, height: 140, fontSize: 12 },
  medium: { width: 120, height: 210, fontSize: 14 },
  large: { width: 180, height: 315, fontSize: 16 },
};

/**
 * 塔罗牌卡片组件
 */
const TarotCard: React.FC<TarotCardProps> = ({
  cardId,
  isReversed = false,
  showFace = true,
  size = 'medium',
  showKeywords = false,
  showName = true,
  onClick,
  style,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const sizeConfig = SIZE_CONFIG[size];
  const cardInfo = getCardInfo(cardId);
  const cardMeaning = getCardMeaning(cardId);
  const imagePath = showFace ? getCardImagePath(cardId) : '/tarot/back.webp';

  /**
   * 处理图片加载完成
   */
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  /**
   * 处理图片加载错误
   */
  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <div
      style={{
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
    >
      <Card
        hoverable={!!onClick}
        bodyStyle={{ padding: size === 'small' ? 4 : 8 }}
        style={{
          width: sizeConfig.width,
          borderRadius: 8,
          overflow: 'hidden',
          border: isReversed ? '2px solid #fa8c16' : '1px solid #d9d9d9',
        }}
      >
        {/* 图片区域 */}
        <div
          style={{
            width: '100%',
            height: sizeConfig.height - 40,
            position: 'relative',
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* 加载骨架屏 */}
          {!imageLoaded && (
            <Skeleton.Image
              active
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
          )}

          {/* 牌面图片 */}
          {!imageError ? (
            <img
              src={imagePath}
              alt={cardInfo.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: isReversed && showFace ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.3s ease',
                opacity: imageLoaded ? 1 : 0,
              }}
            />
          ) : (
            /* 图片加载失败的占位符 */
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: cardInfo.suitColor || '#722ed1',
                color: '#fff',
                fontSize: sizeConfig.fontSize * 1.5,
                fontWeight: 'bold',
                transform: isReversed && showFace ? 'rotate(180deg)' : 'none',
              }}
            >
              {cardId < 22 ? cardId : cardInfo.name.charAt(0)}
            </div>
          )}

          {/* 逆位标记 */}
          {isReversed && showFace && (
            <Tag
              color="orange"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                margin: 0,
                fontSize: 10,
              }}
            >
              逆
            </Tag>
          )}
        </div>

        {/* 牌名区域 */}
        {showName && (
          <div style={{ marginTop: 4, textAlign: 'center' }}>
            <Text
              strong
              style={{
                fontSize: sizeConfig.fontSize,
                display: 'block',
                color: isReversed ? '#fa8c16' : undefined,
              }}
            >
              {cardInfo.name}
            </Text>
            {cardInfo.suit && size !== 'small' && (
              <Tag
                color={cardInfo.suitColor}
                style={{ marginTop: 2, fontSize: 10 }}
              >
                {cardInfo.suit}
              </Tag>
            )}
          </div>
        )}

        {/* 关键词区域 */}
        {showKeywords && cardMeaning && size !== 'small' && (
          <div style={{ marginTop: 4 }}>
            <Space wrap size={2}>
              {cardMeaning.keywords.slice(0, 3).map((keyword, index) => (
                <Tag key={index} style={{ fontSize: 10, margin: 0 }}>
                  {keyword}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TarotCard;

/**
 * 塔罗牌组展示组件
 *
 * 用于展示多张牌的牌阵
 */
export interface TarotSpreadProps {
  /** 牌列表 [牌ID, 是否逆位][] */
  cards: Array<{ cardId: number; isReversed: boolean }>;
  /** 卡片尺寸 */
  size?: 'small' | 'medium' | 'large';
  /** 点击牌的回调 */
  onCardClick?: (index: number, cardId: number) => void;
}

/**
 * 塔罗牌组展示组件
 */
export const TarotSpread: React.FC<TarotSpreadProps> = ({
  cards,
  size = 'small',
  onCardClick,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
      }}
    >
      {cards.map((card, index) => (
        <TarotCard
          key={index}
          cardId={card.cardId}
          isReversed={card.isReversed}
          size={size}
          showKeywords={false}
          onClick={onCardClick ? () => onCardClick(index, card.cardId) : undefined}
        />
      ))}
    </div>
  );
};
