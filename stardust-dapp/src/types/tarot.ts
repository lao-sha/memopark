/**
 * 塔罗牌类型定义
 *
 * 本模块定义了塔罗牌占卜系统所需的所有类型，包括：
 * - 牌组类型（大阿卡纳/小阿卡纳）
 * - 花色（权杖/圣杯/宝剑/星币）
 * - 塔罗牌完整信息
 * - 牌阵类型
 * - 占卜记录
 */

// ==================== 牌组类型 ====================

/**
 * 牌组类型枚举
 *
 * - MajorArcana: 大阿卡纳（22张主牌，0-21号）
 * - MinorArcana: 小阿卡纳（56张副牌）
 */
export enum CardType {
  /** 大阿卡纳 - 22张主牌（0-21号） */
  MajorArcana = 0,
  /** 小阿卡纳 - 56张副牌（分四种花色） */
  MinorArcana = 1,
}

/** 牌组类型名称 */
export const CARD_TYPE_NAMES: Record<CardType, string> = {
  [CardType.MajorArcana]: '大阿卡纳',
  [CardType.MinorArcana]: '小阿卡纳',
};

// ==================== 花色定义 ====================

/**
 * 花色枚举
 *
 * 四种花色对应四大元素：
 * - Wands: 权杖 - 火元素，代表激情、创造力、行动
 * - Cups: 圣杯 - 水元素，代表情感、关系、直觉
 * - Swords: 宝剑 - 风元素，代表思想、沟通、冲突
 * - Pentacles: 星币 - 土元素，代表物质、金钱、工作
 */
export enum Suit {
  /** 无花色（大阿卡纳专用） */
  None = 0,
  /** 权杖 - 火元素 */
  Wands = 1,
  /** 圣杯 - 水元素 */
  Cups = 2,
  /** 宝剑 - 风元素 */
  Swords = 3,
  /** 星币 - 土元素 */
  Pentacles = 4,
}

/** 花色名称（中文） */
export const SUIT_NAMES_CN: Record<Suit, string> = {
  [Suit.None]: '',
  [Suit.Wands]: '权杖',
  [Suit.Cups]: '圣杯',
  [Suit.Swords]: '宝剑',
  [Suit.Pentacles]: '星币',
};

/** 花色名称（英文） */
export const SUIT_NAMES_EN: Record<Suit, string> = {
  [Suit.None]: '',
  [Suit.Wands]: 'Wands',
  [Suit.Cups]: 'Cups',
  [Suit.Swords]: 'Swords',
  [Suit.Pentacles]: 'Pentacles',
};

/** 花色对应元素 */
export const SUIT_ELEMENTS: Record<Suit, string> = {
  [Suit.None]: '',
  [Suit.Wands]: '火',
  [Suit.Cups]: '水',
  [Suit.Swords]: '风',
  [Suit.Pentacles]: '土',
};

/** 花色颜色 */
export const SUIT_COLORS: Record<Suit, string> = {
  [Suit.None]: '#888888',
  [Suit.Wands]: '#f5222d',   // 红色 - 火
  [Suit.Cups]: '#1890ff',    // 蓝色 - 水
  [Suit.Swords]: '#722ed1',  // 紫色 - 风
  [Suit.Pentacles]: '#faad14', // 黄色 - 土
};

// ==================== 宫廷牌等级 ====================

/**
 * 宫廷牌等级枚举
 */
export enum CourtRank {
  /** 非宫廷牌 */
  None = 0,
  /** 侍从 - 学习者、信使 */
  Page = 11,
  /** 骑士 - 行动者、追求者 */
  Knight = 12,
  /** 王后 - 滋养者、直觉 */
  Queen = 13,
  /** 国王 - 掌控者、权威 */
  King = 14,
}

/** 宫廷牌等级名称 */
export const COURT_RANK_NAMES: Record<CourtRank, string> = {
  [CourtRank.None]: '',
  [CourtRank.Page]: '侍从',
  [CourtRank.Knight]: '骑士',
  [CourtRank.Queen]: '王后',
  [CourtRank.King]: '国王',
};

// ==================== 正逆位 ====================

/**
 * 牌位置枚举
 */
export enum CardPosition {
  /** 正位 - 牌意的正面表达 */
  Upright = 0,
  /** 逆位 - 牌意的负面/内化表达 */
  Reversed = 1,
}

/** 牌位置名称 */
export const CARD_POSITION_NAMES: Record<CardPosition, string> = {
  [CardPosition.Upright]: '正位',
  [CardPosition.Reversed]: '逆位',
};

// ==================== 大阿卡纳牌名 ====================

/** 大阿卡纳牌名（中文） */
export const MAJOR_ARCANA_NAMES_CN: string[] = [
  '愚者',     // 0
  '魔术师',   // 1
  '女祭司',   // 2
  '女皇',     // 3
  '皇帝',     // 4
  '教皇',     // 5
  '恋人',     // 6
  '战车',     // 7
  '力量',     // 8
  '隐者',     // 9
  '命运之轮', // 10
  '正义',     // 11
  '倒吊人',   // 12
  '死神',     // 13
  '节制',     // 14
  '恶魔',     // 15
  '塔',       // 16
  '星星',     // 17
  '月亮',     // 18
  '太阳',     // 19
  '审判',     // 20
  '世界',     // 21
];

/** 大阿卡纳牌名（英文） */
export const MAJOR_ARCANA_NAMES_EN: string[] = [
  'The Fool',
  'The Magician',
  'The High Priestess',
  'The Empress',
  'The Emperor',
  'The Hierophant',
  'The Lovers',
  'The Chariot',
  'Strength',
  'The Hermit',
  'Wheel of Fortune',
  'Justice',
  'The Hanged Man',
  'Death',
  'Temperance',
  'The Devil',
  'The Tower',
  'The Star',
  'The Moon',
  'The Sun',
  'Judgement',
  'The World',
];

// ==================== 小阿卡纳数字牌名 ====================

/** 小阿卡纳数字牌名（中文） */
export const NUMBER_NAMES_CN: string[] = [
  'Ace', '二', '三', '四', '五', '六', '七', '八', '九', '十',
];

/** 宫廷牌名（中文） */
export const COURT_NAMES_CN: string[] = ['侍从', '骑士', '王后', '国王'];

// ==================== 牌阵类型 ====================

/**
 * 牌阵类型枚举
 */
export enum SpreadType {
  /** 单张牌 - 快速指引 */
  SingleCard = 1,
  /** 三张牌（时间线）- 过去/现在/未来 */
  ThreeCardTime = 3,
  /** 三张牌（情况）- 情况/行动/结果 */
  ThreeCardSituation = 4,
  /** 五张牌 - 爱情关系牌阵 */
  LoveRelationship = 5,
  /** 六张牌 - 事业指导牌阵 */
  CareerGuidance = 6,
  /** 七张牌 - 决策分析牌阵 */
  DecisionMaking = 7,
  /** 十张牌 - 凯尔特十字（最经典的牌阵） */
  CelticCross = 10,
  /** 十二张牌 - 年度运势 */
  YearForecast = 12,
}

/** 牌阵类型名称 */
export const SPREAD_TYPE_NAMES: Record<SpreadType, string> = {
  [SpreadType.SingleCard]: '单张牌指引',
  [SpreadType.ThreeCardTime]: '时间三张牌',
  [SpreadType.ThreeCardSituation]: '情况三张牌',
  [SpreadType.LoveRelationship]: '爱情关系牌阵',
  [SpreadType.CareerGuidance]: '事业指导牌阵',
  [SpreadType.DecisionMaking]: '决策分析牌阵',
  [SpreadType.CelticCross]: '凯尔特十字',
  [SpreadType.YearForecast]: '年度运势',
};

/** 牌阵类型描述 */
export const SPREAD_TYPE_DESCRIPTIONS: Record<SpreadType, string> = {
  [SpreadType.SingleCard]: '快速获得当下指导，适合日常决策和简单问题',
  [SpreadType.ThreeCardTime]: '了解过去、现在、未来的发展趋势',
  [SpreadType.ThreeCardSituation]: '分析问题的情况、行动和结果',
  [SpreadType.LoveRelationship]: '深入了解感情状况和发展方向',
  [SpreadType.CareerGuidance]: '全面分析职业发展和工作状况',
  [SpreadType.DecisionMaking]: '帮助做出重要决定，分析多个选择',
  [SpreadType.CelticCross]: '最全面的牌阵，深度分析复杂问题',
  [SpreadType.YearForecast]: '预测一年中每个月的运势发展',
};

/** 获取牌阵所需的牌数 */
export function getSpreadCardCount(spreadType: SpreadType): number {
  switch (spreadType) {
    case SpreadType.SingleCard: return 1;
    case SpreadType.ThreeCardTime:
    case SpreadType.ThreeCardSituation: return 3;
    case SpreadType.LoveRelationship: return 5;
    case SpreadType.CareerGuidance: return 6;
    case SpreadType.DecisionMaking: return 7;
    case SpreadType.CelticCross: return 10;
    case SpreadType.YearForecast: return 12;
    default: return 1;
  }
}

// ==================== 牌阵位置信息 ====================

/**
 * 牌阵位置详情
 */
export interface SpreadPositionInfo {
  /** 位置名称 */
  name: string;
  /** 位置描述 */
  description: string;
  /** 解读指导 */
  interpretationGuide: string;
}

/** 牌阵位置名称 */
export const SPREAD_POSITION_NAMES: Record<SpreadType, string[]> = {
  [SpreadType.SingleCard]: ['当前指引'],
  [SpreadType.ThreeCardTime]: ['过去', '现在', '未来'],
  [SpreadType.ThreeCardSituation]: ['情况', '行动', '结果'],
  [SpreadType.LoveRelationship]: ['你的感受', '对方的感受', '关系现状', '挑战', '未来发展'],
  [SpreadType.CareerGuidance]: ['当前状况', '优势', '挑战', '机会', '建议行动', '未来前景'],
  [SpreadType.DecisionMaking]: ['当前情况', '选择A', '选择A结果', '选择B', '选择B结果', '外在影响', '最佳建议'],
  [SpreadType.CelticCross]: ['当前状况', '挑战', '远因', '近因', '可能结果', '近期发展', '你的态度', '外在影响', '内心期望', '最终结果'],
  [SpreadType.YearForecast]: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
};

// ==================== 占卜方式 ====================

/**
 * 占卜方式枚举
 */
export enum DivinationMethod {
  /** 随机抽牌 - 使用链上随机数 */
  Random = 0,
  /** 时间起卦 - 基于时间戳生成 */
  ByTime = 1,
  /** 数字起卦 - 基于用户提供的数字 */
  ByNumbers = 2,
  /** 手动指定 - 直接指定牌面 */
  Manual = 3,
  /** 带切牌的随机抽牌 - 模拟真实塔罗占卜仪式 */
  RandomWithCut = 4,
}

/** 占卜方式名称 */
export const DIVINATION_METHOD_NAMES: Record<DivinationMethod, string> = {
  [DivinationMethod.Random]: '随机抽牌',
  [DivinationMethod.ByTime]: '时间起卦',
  [DivinationMethod.ByNumbers]: '数字起卦',
  [DivinationMethod.Manual]: '手动指定',
  [DivinationMethod.RandomWithCut]: '带切牌随机抽牌',
};

/** 占卜方式描述 */
export const DIVINATION_METHOD_DESCRIPTIONS: Record<DivinationMethod, string> = {
  [DivinationMethod.Random]: '使用链上随机数自动抽取牌面',
  [DivinationMethod.ByTime]: '基于时间戳和区块信息生成牌序',
  [DivinationMethod.ByNumbers]: '输入个人有意义的数字进行抽牌',
  [DivinationMethod.Manual]: '直接选择特定牌面（用于练习或复盘）',
  [DivinationMethod.RandomWithCut]: '模拟真实塔罗仪式，包含洗牌和切牌',
};

// ==================== 塔罗牌结构 ====================

/**
 * 塔罗牌接口
 */
export interface TarotCard {
  /** 牌的唯一编号 (0-77) */
  id: number;
  /** 牌的类型（大/小阿卡纳） */
  cardType: CardType;
  /** 花色（仅小阿卡纳有效） */
  suit: Suit;
  /** 牌面数值（大阿卡纳0-21，小阿卡纳1-14） */
  number: number;
}

/**
 * 抽取的牌（含位置信息）
 */
export interface DrawnCard {
  /** 塔罗牌 */
  card: TarotCard;
  /** 正逆位 */
  position: CardPosition;
  /** 在牌阵中的位置索引 (0-based) */
  spreadPosition: number;
}

/**
 * 完整的塔罗牌占卜记录
 */
export interface TarotReading {
  /** 占卜记录唯一ID */
  id: number;
  /** 占卜者账户 */
  diviner: string;
  /** 牌阵类型 */
  spreadType: SpreadType;
  /** 占卜方式 */
  method: DivinationMethod;
  /** 抽取的牌列表 */
  cards: DrawnCard[];
  /** 占卜问题的哈希值（隐私保护） */
  questionHash: string;
  /** 占卜时的区块号 */
  blockNumber: number;
  /** 占卜时间戳（Unix秒） */
  timestamp: number;
  /** AI 解读的 IPFS CID（可选） */
  interpretationCid?: string;
  /** 是否公开 */
  isPublic: boolean;
}

// ==================== 牌义信息 ====================

/**
 * 牌义详情结构
 */
export interface CardMeaning {
  /** 牌名 */
  name: string;
  /** 英文名 */
  nameEn: string;
  /** 关键词 */
  keywords: string;
  /** 正位含义 */
  upright: string;
  /** 逆位含义 */
  reversed: string;
  /** 元素 */
  element: string;
  /** 描述（仅大阿卡纳） */
  description?: string;
  /** 星座/行星（仅大阿卡纳） */
  astrology?: { body: string; element: string };
}

// ==================== 分析结果 ====================

/**
 * 占卜整体能量分析结果
 */
export interface ReadingEnergyAnalysis {
  /** 主导元素（火/水/风/土） */
  dominantElement?: string;
  /** 主导元素数量 */
  dominantElementCount: number;
  /** 大阿卡纳数量 */
  majorArcanaCount: number;
  /** 大阿卡纳比例（百分比） */
  majorArcanaRatio: number;
  /** 逆位数量 */
  reversedCount: number;
  /** 逆位比例（百分比） */
  reversedRatio: number;
  /** 宫廷牌数量 */
  courtCardsCount: number;
  /** 数字牌数量 */
  numberCardsCount: number;
  /** 是否有特殊组合 */
  hasSpecialCombination: boolean;
  /** 整体能量描述 */
  energyDescription: string;
  /** 整体建议 */
  advice: string;
}

/**
 * 单张牌的详细分析
 */
export interface CardAnalysis {
  /** 牌ID */
  cardId: number;
  /** 牌名 */
  name: string;
  /** 牌名（副名称，仅小阿卡纳） */
  subName?: string;
  /** 是否逆位 */
  isReversed: boolean;
  /** 当前含义（根据正逆位） */
  meaning: string;
  /** 关键词 */
  keywords: string;
  /** 元素（小阿卡纳） */
  element?: string;
  /** 星座/行星对应（大阿卡纳） */
  astrology?: { body: string; element: string };
  /** 牌面描述（大阿卡纳） */
  description?: string;
  /** 在牌阵中的位置索引 */
  spreadPosition: number;
  /** 位置含义 */
  positionName: string;
  /** 位置描述 */
  positionDescription: string;
  /** 位置解读指导 */
  positionGuide: string;
}

/**
 * 完整占卜分析结果
 */
export interface FullReadingAnalysis {
  /** 牌阵类型名称 */
  spreadName: string;
  /** 牌阵描述 */
  spreadDescription: string;
  /** 每张牌的详细分析 */
  cards: CardAnalysis[];
  /** 整体能量分析 */
  energy: ReadingEnergyAnalysis;
}

// ==================== 辅助函数 ====================

/**
 * 从牌ID创建塔罗牌
 * @param id 牌ID (0-77)
 */
export function createTarotCard(id: number): TarotCard {
  const safeId = id % 78;

  if (safeId < 22) {
    // 大阿卡纳
    return {
      id: safeId,
      cardType: CardType.MajorArcana,
      suit: Suit.None,
      number: safeId,
    };
  } else {
    // 小阿卡纳
    const minorId = safeId - 22;
    const suitIndex = Math.floor(minorId / 14);
    const cardNumber = (minorId % 14) + 1;

    const suit = [Suit.Wands, Suit.Cups, Suit.Swords, Suit.Pentacles][suitIndex];

    return {
      id: safeId,
      cardType: CardType.MinorArcana,
      suit,
      number: cardNumber,
    };
  }
}

/**
 * 判断是否为大阿卡纳
 * @param cardId 牌ID
 */
export function isMajorArcana(cardId: number): boolean {
  return cardId < 22;
}

/**
 * 判断是否为宫廷牌
 * @param cardId 牌ID
 */
export function isCourtCard(cardId: number): boolean {
  if (cardId < 22 || cardId > 77) return false;
  const number = ((cardId - 22) % 14) + 1;
  return number >= 11;
}

/**
 * 判断是否为数字牌（Ace-10）
 * @param cardId 牌ID
 */
export function isNumberCard(cardId: number): boolean {
  if (cardId < 22 || cardId > 77) return false;
  const number = ((cardId - 22) % 14) + 1;
  return number <= 10;
}

/**
 * 获取牌的花色
 * @param cardId 牌ID
 */
export function getCardSuit(cardId: number): Suit {
  if (cardId < 22) return Suit.None;
  if (cardId > 77) return Suit.None;
  const suitIndex = Math.floor((cardId - 22) / 14);
  return [Suit.Wands, Suit.Cups, Suit.Swords, Suit.Pentacles][suitIndex];
}

/**
 * 获取牌的元素
 * @param cardId 牌ID
 */
export function getCardElement(cardId: number): string {
  const suit = getCardSuit(cardId);
  return SUIT_ELEMENTS[suit];
}

/**
 * 获取牌的中文名称
 * @param cardId 牌ID
 */
export function getCardDisplayName(cardId: number): { name: string; subName?: string } {
  if (cardId < 22) {
    return { name: MAJOR_ARCANA_NAMES_CN[cardId] };
  }

  const minorId = cardId - 22;
  const suitIndex = Math.floor(minorId / 14);
  const cardNumber = (minorId % 14) + 1;

  const suitName = SUIT_NAMES_CN[[Suit.Wands, Suit.Cups, Suit.Swords, Suit.Pentacles][suitIndex]];
  const cardName = cardNumber <= 10
    ? NUMBER_NAMES_CN[cardNumber - 1]
    : COURT_NAMES_CN[cardNumber - 11];

  return { name: suitName, subName: cardName };
}

/**
 * 获取牌的完整中文名称
 * @param cardId 牌ID
 */
export function getCardFullName(cardId: number): string {
  const { name, subName } = getCardDisplayName(cardId);
  return subName ? `${name}${subName}` : name;
}

/**
 * 获取牌的英文名称
 * @param cardId 牌ID
 */
export function getCardEnglishName(cardId: number): string {
  if (cardId < 22) {
    return MAJOR_ARCANA_NAMES_EN[cardId];
  }

  const minorId = cardId - 22;
  const suitIndex = Math.floor(minorId / 14);
  const cardNumber = (minorId % 14) + 1;

  const suitName = SUIT_NAMES_EN[[Suit.Wands, Suit.Cups, Suit.Swords, Suit.Pentacles][suitIndex]];
  let numberName: string;

  if (cardNumber === 1) numberName = 'Ace';
  else if (cardNumber <= 10) numberName = cardNumber.toString();
  else numberName = ['Page', 'Knight', 'Queen', 'King'][cardNumber - 11];

  return `${numberName} of ${suitName}`;
}

/**
 * 计算元素分布
 * @param cardIds 牌ID列表
 */
export function analyzeElementDistribution(cardIds: number[]): {
  major: number;
  wands: number;
  cups: number;
  swords: number;
  pentacles: number;
} {
  let major = 0, wands = 0, cups = 0, swords = 0, pentacles = 0;

  for (const id of cardIds) {
    if (id < 22) {
      major++;
    } else {
      const suit = getCardSuit(id);
      switch (suit) {
        case Suit.Wands: wands++; break;
        case Suit.Cups: cups++; break;
        case Suit.Swords: swords++; break;
        case Suit.Pentacles: pentacles++; break;
      }
    }
  }

  return { major, wands, cups, swords, pentacles };
}

/**
 * 计算逆位比例
 * @param positions 正逆位列表
 */
export function calculateReversedRatio(positions: boolean[]): number {
  if (positions.length === 0) return 0;
  const reversedCount = positions.filter(r => r).length;
  return Math.round((reversedCount * 100) / positions.length);
}

/**
 * 判断是否包含特殊牌组合
 * @param cardIds 牌ID列表
 */
export function hasSpecialCombination(cardIds: number[]): boolean {
  // 检查是否同时出现愚者(0)和世界(21)
  if (cardIds.includes(0) && cardIds.includes(21)) return true;

  // 检查是否有三张或以上的大阿卡纳
  const majorCount = cardIds.filter(id => id < 22).length;
  if (majorCount >= 3) return true;

  // 检查是否有同花色的三连号
  for (const suitStart of [22, 36, 50, 64]) {
    const suitCards = cardIds
      .filter(id => id >= suitStart && id < suitStart + 14)
      .map(id => id - suitStart)
      .sort((a, b) => a - b);

    if (suitCards.length >= 3) {
      for (let i = 0; i < suitCards.length - 2; i++) {
        if (suitCards[i] + 1 === suitCards[i + 1] && suitCards[i + 1] + 1 === suitCards[i + 2]) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 验证抽牌结果的有效性
 * @param cardIds 牌ID列表
 */
export function validateDrawnCards(cardIds: number[]): boolean {
  // 检查范围
  if (cardIds.some(id => id >= 78)) return false;

  // 检查重复
  const seen = new Set<number>();
  for (const id of cardIds) {
    if (seen.has(id)) return false;
    seen.add(id);
  }

  return true;
}

/**
 * 获取吉凶等级颜色
 * @param hasSpecial 是否有特殊组合
 * @param majorRatio 大阿卡纳比例
 * @param reversedRatio 逆位比例
 */
export function getReadingColor(hasSpecial: boolean, majorRatio: number, reversedRatio: number): string {
  if (hasSpecial) return '#722ed1'; // 紫色 - 特殊
  if (reversedRatio >= 60) return '#f5222d'; // 红色 - 阻碍较多
  if (majorRatio >= 50) return '#faad14'; // 黄色 - 重大主题
  return '#52c41a'; // 绿色 - 正常
}

/**
 * 获取主导元素描述
 * @param dominantElement 主导元素
 */
export function getElementDescription(dominantElement?: string): string {
  switch (dominantElement) {
    case '火':
      return '火元素主导，能量充满激情、创造力和行动力';
    case '水':
      return '水元素主导，能量偏向情感、直觉和人际关系';
    case '风':
      return '风元素主导，能量偏向思维、沟通和智力活动';
    case '土':
      return '土元素主导，能量偏向物质、工作和实际事务';
    default:
      return '能量分布较为均衡，各方面都需要关注';
  }
}
