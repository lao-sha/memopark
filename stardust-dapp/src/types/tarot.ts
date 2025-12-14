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

// ============================================================================
// Runtime API 解卦数据结构（链上数据）
// ============================================================================

/**
 * 吉凶倾向枚举
 */
export enum FortuneTendency {
  /** 大吉 - 诸事顺遂，心想事成 */
  Excellent = 0,
  /** 吉 - 事可成，宜进取 */
  Good = 1,
  /** 中平 - 平稳发展，守成为上 */
  Neutral = 2,
  /** 小凶 - 小有阻碍，谨慎行事 */
  MinorBad = 3,
  /** 凶 - 困难重重，需要调整 */
  Bad = 4,
}

/** 吉凶倾向名称 */
export const FORTUNE_TENDENCY_NAMES: Record<FortuneTendency, string> = {
  [FortuneTendency.Excellent]: '大吉',
  [FortuneTendency.Good]: '吉',
  [FortuneTendency.Neutral]: '中平',
  [FortuneTendency.MinorBad]: '小凶',
  [FortuneTendency.Bad]: '凶',
};

/** 吉凶倾向颜色 */
export const FORTUNE_TENDENCY_COLORS: Record<FortuneTendency, string> = {
  [FortuneTendency.Excellent]: '#52c41a',  // 绿色
  [FortuneTendency.Good]: '#73d13d',       // 浅绿色
  [FortuneTendency.Neutral]: '#faad14',    // 黄色
  [FortuneTendency.MinorBad]: '#ff7a45',   // 橙色
  [FortuneTendency.Bad]: '#f5222d',        // 红色
};

/**
 * 主导元素枚举
 */
export enum DominantElement {
  /** 无明显主导元素 */
  None = 0,
  /** 火元素主导（权杖）- 行动力、激情、创造力 */
  Fire = 1,
  /** 水元素主导（圣杯）- 情感、直觉、人际关系 */
  Water = 2,
  /** 风元素主导（宝剑）- 思维、沟通、智力活动 */
  Air = 3,
  /** 土元素主导（星币）- 物质、工作、实际事务 */
  Earth = 4,
  /** 灵性主导（大阿卡纳）- 重大转折、命运指引 */
  Spirit = 5,
}

/** 主导元素名称 */
export const DOMINANT_ELEMENT_NAMES: Record<DominantElement, string> = {
  [DominantElement.None]: '无',
  [DominantElement.Fire]: '火（权杖）',
  [DominantElement.Water]: '水（圣杯）',
  [DominantElement.Air]: '风（宝剑）',
  [DominantElement.Earth]: '土（星币）',
  [DominantElement.Spirit]: '灵性（大阿卡纳）',
};

/**
 * 能量流动方向枚举
 */
export enum EnergyFlow {
  /** 上升 - 能量逐渐增强 */
  Rising = 0,
  /** 下降 - 能量逐渐减弱 */
  Declining = 1,
  /** 平稳 - 能量保持稳定 */
  Stable = 2,
  /** 波动 - 能量起伏不定 */
  Volatile = 3,
}

/** 能量流动名称 */
export const ENERGY_FLOW_NAMES: Record<EnergyFlow, string> = {
  [EnergyFlow.Rising]: '上升',
  [EnergyFlow.Declining]: '下降',
  [EnergyFlow.Stable]: '平稳',
  [EnergyFlow.Volatile]: '波动',
};

/**
 * 牌间关系类型枚举
 */
export enum RelationshipType {
  /** 无明显关系 */
  None = 0,
  /** 相生 - 能量互相增强 */
  Generating = 1,
  /** 相克 - 能量互相制约 */
  Controlling = 2,
  /** 同元素强化 - 同类能量叠加 */
  SameElementReinforce = 3,
  /** 对立冲突 - 能量相互对抗 */
  Opposing = 4,
  /** 互补 - 能量相互补充 */
  Complementary = 5,
}

/** 牌间关系名称 */
export const RELATIONSHIP_TYPE_NAMES: Record<RelationshipType, string> = {
  [RelationshipType.None]: '无',
  [RelationshipType.Generating]: '相生',
  [RelationshipType.Controlling]: '相克',
  [RelationshipType.SameElementReinforce]: '同元素强化',
  [RelationshipType.Opposing]: '对立冲突',
  [RelationshipType.Complementary]: '互补',
};

/**
 * 时间线趋势枚举
 */
export enum TimelineTrend {
  /** 下降趋势 */
  Declining = 0,
  /** 平稳趋势 */
  Stable = 1,
  /** 上升趋势 */
  Rising = 2,
}

/**
 * 时间线状态枚举
 */
export enum TimelineState {
  /** 低谷期 */
  LowPoint = 0,
  /** 平稳期 */
  Stable = 1,
  /** 高峰期 */
  HighPoint = 2,
}

/**
 * 整体发展方向枚举
 */
export enum OverallDirection {
  /** 负面发展 */
  Negative = 0,
  /** 中性发展 */
  Neutral = 1,
  /** 正面发展 */
  Positive = 2,
}

// ============================================================================
// 核心解卦数据结构
// ============================================================================

/**
 * 塔罗牌核心解卦结果（链上存储格式）
 *
 * 总大小约 30 bytes，用于链上存储
 */
export interface TarotCoreInterpretation {
  /** 总体能量等级 (0-100) */
  overallEnergy: number;
  /** 主导元素 */
  dominantElement: DominantElement;
  /** 吉凶倾向 */
  fortuneTendency: FortuneTendency;
  /** 逆位比例 (0-100) */
  reversedRatio: number;

  /** 大阿卡纳数量 (0-12) */
  majorArcanaCount: number;
  /** 宫廷牌数量 (0-12) */
  courtCardsCount: number;
  /** 数字牌数量 (0-12) */
  numberCardsCount: number;
  /** 元素分布位图 */
  elementBitmap: number;
  /** 特殊组合标志位图 */
  specialCombination: number;

  /** 关键牌ID (0-77) */
  keyCardId: number;
  /** 关键牌正逆位 (0=正位, 1=逆位) */
  keyCardReversed: number;
  /** 牌阵类型 */
  spreadType: number;

  /** 行动力指数 (0-100) */
  actionIndex: number;
  /** 情感指数 (0-100) */
  emotionIndex: number;
  /** 思维指数 (0-100) */
  intellectIndex: number;
  /** 物质指数 (0-100) */
  materialIndex: number;
  /** 灵性指数 (0-100) */
  spiritualIndex: number;
  /** 稳定性指数 (0-100) */
  stabilityIndex: number;
  /** 变化性指数 (0-100) */
  changeIndex: number;
  /** 综合评分 (0-100) */
  overallScore: number;

  /** 解卦时区块号 */
  blockNumber: number;
  /** 算法版本 */
  algorithmVersion: number;
  /** 可信度 (0-100) */
  confidence: number;
}

/**
 * 牌阵能量分析
 */
export interface SpreadEnergyAnalysis {
  /** 过去能量 (0-100) */
  pastEnergy: number;
  /** 现在能量 (0-100) */
  presentEnergy: number;
  /** 未来能量 (0-100) */
  futureEnergy: number;
  /** 内在能量 (0-100) */
  innerEnergy: number;
  /** 外在能量 (0-100) */
  outerEnergy: number;
  /** 能量流动方向 */
  energyFlow: EnergyFlow;
  /** 能量平衡度 (0-100, 100最平衡) */
  energyBalance: number;
}

/**
 * 单张牌的解读分析
 */
export interface CardInterpretation {
  /** 牌ID (0-77) */
  cardId: number;
  /** 是否逆位 */
  isReversed: boolean;
  /** 在牌阵中的位置索引 (0-based) */
  spreadPosition: number;
  /** 位置权重 (1-10, 10最重要) */
  positionWeight: number;
  /** 牌的能量强度 (0-100) */
  energyStrength: number;
  /** 与前一张牌的关系类型 */
  relationToPrev: RelationshipType;
  /** 与后一张牌的关系类型 */
  relationToNext: RelationshipType;
}

/**
 * 牌间关系
 */
export interface CardRelationship {
  /** 第一张牌索引 */
  card1Index: number;
  /** 第二张牌索引 */
  card2Index: number;
  /** 关系类型 */
  relationshipType: RelationshipType;
  /** 关系强度 (0-100) */
  strength: number;
}

/**
 * 时间线分析
 */
export interface TimelineAnalysis {
  /** 过去趋势 */
  pastTrend: TimelineTrend;
  /** 现在状态 */
  presentState: TimelineState;
  /** 未来趋势 */
  futureTrend: TimelineTrend;
  /** 转折点位置 (牌阵索引, 255=无转折点) */
  turningPoint: number;
  /** 整体发展方向 */
  overallDirection: OverallDirection;
}

/**
 * 完整解卦结果（Runtime API 返回）
 */
export interface TarotFullInterpretation {
  /** 核心指标 */
  core: TarotCoreInterpretation;
  /** 牌阵能量分析 */
  spreadEnergy: SpreadEnergyAnalysis;
  /** 各牌分析（可选） */
  cardAnalyses?: CardInterpretation[];
  /** 牌间关系分析（可选） */
  cardRelationships?: CardRelationship[];
  /** 时间线分析（可选） */
  timelineAnalysis?: TimelineAnalysis;
}

// ============================================================================
// 解读文本类型枚举
// ============================================================================

/**
 * 解读文本类型枚举
 *
 * 前端根据此索引显示对应的解读文本
 */
export enum InterpretationTextType {
  // 总体能量描述 (0-9)
  EnergyHigh = 0,
  EnergyMedium = 1,
  EnergyLow = 2,
  EnergyVolatile = 3,

  // 元素主导描述 (10-19)
  FireDominant = 10,
  WaterDominant = 11,
  AirDominant = 12,
  EarthDominant = 13,
  SpiritDominant = 14,
  ElementBalanced = 15,

  // 吉凶判断 (20-29)
  FortuneExcellent = 20,
  FortuneGood = 21,
  FortuneNeutral = 22,
  FortuneMinorBad = 23,
  FortuneBad = 24,

  // 特殊组合 (30-39)
  FoolWorldCombo = 30,
  ManyMajorArcana = 31,
  SameSuitSequence = 32,
  AllReversed = 33,
  AllUpright = 34,

  // 行动建议 (40-59)
  ActionTakeAction = 40,
  ActionWaitAndSee = 41,
  ActionReflect = 42,
  ActionSeekHelp = 43,
  ActionPersist = 44,
  ActionLetGo = 45,
  ActionCommunicate = 46,
  ActionLearn = 47,

  // 时间线描述 (60-69)
  PastSolid = 60,
  PastChallenging = 61,
  PresentTurning = 62,
  PresentStable = 63,
  FutureImproving = 64,
  FutureWarning = 65,
  TrendRising = 66,
  TrendDeclining = 67,
  TrendStable = 68,

  // 能量指数描述 (70-79)
  ActionIndexHigh = 70,
  EmotionIndexHigh = 71,
  IntellectIndexHigh = 72,
  MaterialIndexHigh = 73,
  SpiritualIndexHigh = 74,
  StabilityIndexHigh = 75,
  ChangeIndexHigh = 76,
}

/** 解读文本映射 */
export const INTERPRETATION_TEXT_MAP: Record<InterpretationTextType, string> = {
  // 能量描述
  [InterpretationTextType.EnergyHigh]: '能量充沛，积极向上',
  [InterpretationTextType.EnergyMedium]: '能量平稳，稳中求进',
  [InterpretationTextType.EnergyLow]: '能量低迷，需要休息',
  [InterpretationTextType.EnergyVolatile]: '能量波动，变化较大',

  // 元素主导
  [InterpretationTextType.FireDominant]: '火元素主导：行动力强，充满激情',
  [InterpretationTextType.WaterDominant]: '水元素主导：情感丰富，直觉敏锐',
  [InterpretationTextType.AirDominant]: '风元素主导：思维活跃，沟通顺畅',
  [InterpretationTextType.EarthDominant]: '土元素主导：务实稳重，注重物质',
  [InterpretationTextType.SpiritDominant]: '灵性主导：重大转折，命运指引',
  [InterpretationTextType.ElementBalanced]: '元素平衡：各方面均衡发展',

  // 吉凶判断
  [InterpretationTextType.FortuneExcellent]: '大吉：诸事顺遂，心想事成',
  [InterpretationTextType.FortuneGood]: '吉：事可成，宜进取',
  [InterpretationTextType.FortuneNeutral]: '中平：平稳发展，守成为上',
  [InterpretationTextType.FortuneMinorBad]: '小凶：小有阻碍，谨慎行事',
  [InterpretationTextType.FortuneBad]: '凶：困难重重，需要调整',

  // 特殊组合
  [InterpretationTextType.FoolWorldCombo]: '愚者与世界相遇：完整的旅程，新的循环开始',
  [InterpretationTextType.ManyMajorArcana]: '多张大阿卡纳出现：重大人生课题，命运转折',
  [InterpretationTextType.SameSuitSequence]: '同花色连号：该领域有重要发展和突破',
  [InterpretationTextType.AllReversed]: '全逆位：内省时期，需要调整心态和方向',
  [InterpretationTextType.AllUpright]: '全正位：外向发展期，积极行动会有收获',

  // 行动建议
  [InterpretationTextType.ActionTakeAction]: '建议：积极行动，把握当前机会',
  [InterpretationTextType.ActionWaitAndSee]: '建议：谨慎观察，等待更好时机',
  [InterpretationTextType.ActionReflect]: '建议：内省调整，修正前进方向',
  [InterpretationTextType.ActionSeekHelp]: '建议：寻求帮助，借助外力突破',
  [InterpretationTextType.ActionPersist]: '建议：坚持信念，持续努力终有回报',
  [InterpretationTextType.ActionLetGo]: '建议：放下执念，顺其自然会更好',
  [InterpretationTextType.ActionCommunicate]: '建议：加强沟通交流，化解可能的误会',
  [InterpretationTextType.ActionLearn]: '建议：学习成长，提升自我能力',

  // 时间线
  [InterpretationTextType.PastSolid]: '过去：打下了稳固的基础',
  [InterpretationTextType.PastChallenging]: '过去：经历了一些挑战和考验',
  [InterpretationTextType.PresentTurning]: '现在：处于重要的转折点',
  [InterpretationTextType.PresentStable]: '现在：处于相对稳定的时期',
  [InterpretationTextType.FutureImproving]: '未来：形势将向好发展',
  [InterpretationTextType.FutureWarning]: '未来：需要警惕潜在风险',
  [InterpretationTextType.TrendRising]: '整体趋势：能量上升，形势向好',
  [InterpretationTextType.TrendDeclining]: '整体趋势：能量下降，需要调整',
  [InterpretationTextType.TrendStable]: '整体趋势：平稳发展，稳中求进',

  // 能量指数
  [InterpretationTextType.ActionIndexHigh]: '行动力充沛，适合积极推进计划',
  [InterpretationTextType.EmotionIndexHigh]: '情感丰富，人际关系是重点',
  [InterpretationTextType.IntellectIndexHigh]: '思维清晰，适合做重要决策',
  [InterpretationTextType.MaterialIndexHigh]: '物质运势好，财务方面有利',
  [InterpretationTextType.SpiritualIndexHigh]: '灵性成长期，适合内在修炼',
  [InterpretationTextType.StabilityIndexHigh]: '稳定性强，适合长期规划',
  [InterpretationTextType.ChangeIndexHigh]: '变化性强，需要灵活应对',
};

// ============================================================================
// 解卦辅助函数
// ============================================================================

/**
 * 解析元素分布位图
 * @param bitmap 元素分布位图
 */
export function parseElementBitmap(bitmap: number): {
  fire: number;
  water: number;
  air: number;
  earth: number;
} {
  return {
    fire: bitmap & 0b00000011,
    water: (bitmap >> 2) & 0b00000011,
    air: (bitmap >> 4) & 0b00000011,
    earth: (bitmap >> 6) & 0b00000011,
  };
}

/**
 * 解析特殊组合位图
 * @param bitmap 特殊组合位图
 */
export function parseSpecialCombination(bitmap: number): {
  hasFoolWorldCombo: boolean;
  hasManyMajorArcana: boolean;
  hasSameSuitSequence: boolean;
  isAllReversed: boolean;
  isAllUpright: boolean;
} {
  return {
    hasFoolWorldCombo: (bitmap & 0b00000001) !== 0,
    hasManyMajorArcana: (bitmap & 0b00000010) !== 0,
    hasSameSuitSequence: (bitmap & 0b00000100) !== 0,
    isAllReversed: (bitmap & 0b00001000) !== 0,
    isAllUpright: (bitmap & 0b00010000) !== 0,
  };
}

/**
 * 获取能量等级描述
 * @param energy 能量值 (0-100)
 */
export function getEnergyLevelDescription(energy: number): string {
  if (energy >= 75) return '能量充沛';
  if (energy >= 50) return '能量平稳';
  if (energy >= 25) return '能量较低';
  return '能量不足';
}

/**
 * 获取综合评分描述
 * @param score 综合评分 (0-100)
 */
export function getOverallScoreDescription(score: number): string {
  if (score >= 80) return '非常好的牌面';
  if (score >= 60) return '较好的牌面';
  if (score >= 40) return '一般的牌面';
  if (score >= 20) return '需要注意';
  return '需要特别警惕';
}

/**
 * 获取可信度描述
 * @param confidence 可信度 (0-100)
 */
export function getConfidenceDescription(confidence: number): string {
  if (confidence >= 80) return '高可信度';
  if (confidence >= 60) return '较高可信度';
  if (confidence >= 40) return '一般可信度';
  return '较低可信度';
}
