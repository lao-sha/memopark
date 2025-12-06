/**
 * 梅花易数类型定义
 *
 * 本模块定义了梅花易数占卜系统的所有类型接口
 */

// ==================== 基础类型 ====================

/** 八卦枚举 */
export enum Trigram {
  Qian = 0,  // 乾 ☰ 天
  Dui = 1,   // 兑 ☱ 泽
  Li = 2,    // 离 ☲ 火
  Zhen = 3,  // 震 ☳ 雷
  Xun = 4,   // 巽 ☴ 风
  Kan = 5,   // 坎 ☵ 水
  Gen = 6,   // 艮 ☶ 山
  Kun = 7,   // 坤 ☷ 地
}

/** 八卦中文名称映射 */
export const TRIGRAM_NAMES: Record<Trigram, string> = {
  [Trigram.Qian]: '乾',
  [Trigram.Dui]: '兑',
  [Trigram.Li]: '离',
  [Trigram.Zhen]: '震',
  [Trigram.Xun]: '巽',
  [Trigram.Kan]: '坎',
  [Trigram.Gen]: '艮',
  [Trigram.Kun]: '坤',
};

/** 八卦符号映射 */
export const TRIGRAM_SYMBOLS: Record<Trigram, string> = {
  [Trigram.Qian]: '☰',
  [Trigram.Dui]: '☱',
  [Trigram.Li]: '☲',
  [Trigram.Zhen]: '☳',
  [Trigram.Xun]: '☴',
  [Trigram.Kan]: '☵',
  [Trigram.Gen]: '☶',
  [Trigram.Kun]: '☷',
};

/** 八卦象义映射 */
export const TRIGRAM_MEANINGS: Record<Trigram, string> = {
  [Trigram.Qian]: '天',
  [Trigram.Dui]: '泽',
  [Trigram.Li]: '火',
  [Trigram.Zhen]: '雷',
  [Trigram.Xun]: '风',
  [Trigram.Kan]: '水',
  [Trigram.Gen]: '山',
  [Trigram.Kun]: '地',
};

/** 五行枚举 */
export enum WuXing {
  Wood = 0,  // 木
  Fire = 1,  // 火
  Earth = 2, // 土
  Metal = 3, // 金
  Water = 4, // 水
}

/** 五行中文名称 */
export const WUXING_NAMES: Record<WuXing, string> = {
  [WuXing.Wood]: '木',
  [WuXing.Fire]: '火',
  [WuXing.Earth]: '土',
  [WuXing.Metal]: '金',
  [WuXing.Water]: '水',
};

/** 起卦方式 */
export enum DivinationMethod {
  Time = 0,    // 时间起卦
  Number = 1,  // 数字起卦
  Text = 2,    // 文字起卦
  Random = 3,  // 随机起卦
}

/** 卦象状态 */
export enum HexagramStatus {
  Active = 0,    // 有效
  Archived = 1,  // 已归档
  Deleted = 2,   // 已删除
}

// ==================== 卦象结构 ====================

/** 卦象数据 */
export interface Hexagram {
  /** 卦象 ID */
  id: number;
  /** 创建者 */
  creator: string;
  /** 起卦方式 */
  method: DivinationMethod;
  /** 上卦 */
  upperTrigram: Trigram;
  /** 下卦 */
  lowerTrigram: Trigram;
  /** 变卦上卦 */
  changedUpperTrigram: Trigram;
  /** 变卦下卦 */
  changedLowerTrigram: Trigram;
  /** 动爻位置 (1-6) */
  changingLine: number;
  /** 体卦 */
  bodyTrigram: Trigram;
  /** 用卦 */
  functionTrigram: Trigram;
  /** 体卦五行 */
  bodyWuxing: WuXing;
  /** 用卦五行 */
  functionWuxing: WuXing;
  /** 起卦时间戳 (毫秒) */
  divinationTime: number;
  /** 农历年 */
  lunarYear: number;
  /** 农历月 */
  lunarMonth: number;
  /** 农历日 */
  lunarDay: number;
  /** 农历时辰 (0-11) */
  lunarHour: number;
  /** 问题描述哈希 */
  questionHash?: string;
  /** 状态 */
  status: HexagramStatus;
  /** 创建区块 */
  createdAt: number;
}

/** 64 卦名称 */
export const HEXAGRAM_NAMES: string[] = [
  '乾为天', '坤为地', '水雷屯', '山水蒙', '水天需', '天水讼', '地水师', '水地比',
  '风天小畜', '天泽履', '地天泰', '天地否', '天火同人', '火天大有', '地山谦', '雷地豫',
  '泽雷随', '山风蛊', '地泽临', '风地观', '火雷噬嗑', '山火贲', '山地剥', '地雷复',
  '天雷无妄', '山天大畜', '山雷颐', '泽风大过', '坎为水', '离为火', '泽山咸', '雷风恒',
  '天山遁', '雷天大壮', '火地晋', '地火明夷', '风火家人', '火泽睽', '水山蹇', '雷水解',
  '山泽损', '风雷益', '泽天夬', '天风姤', '泽地萃', '地风升', '泽水困', '水风井',
  '泽火革', '火风鼎', '震为雷', '艮为山', '风山渐', '雷泽归妹', '雷火丰', '火山旅',
  '巽为风', '兑为泽', '风水涣', '水泽节', '风泽中孚', '雷山小过', '水火既济', '火水未济',
];

// ==================== AI 解卦类型 ====================

/** AI 解读类型 */
export enum InterpretationType {
  Basic = 0,         // 基础解读
  Detailed = 1,      // 详细解读
  Professional = 2,  // 专业解读
  Career = 3,        // 事业解读
  Relationship = 4,  // 感情解读
  Health = 5,        // 健康解读
  Wealth = 6,        // 财运解读
}

/** 解读类型中文名称 */
export const INTERPRETATION_TYPE_NAMES: Record<InterpretationType, string> = {
  [InterpretationType.Basic]: '基础解读',
  [InterpretationType.Detailed]: '详细解读',
  [InterpretationType.Professional]: '专业解读',
  [InterpretationType.Career]: '事业解读',
  [InterpretationType.Relationship]: '感情解读',
  [InterpretationType.Health]: '健康解读',
  [InterpretationType.Wealth]: '财运解读',
};

/** 解读类型费用倍数 */
export const INTERPRETATION_FEE_MULTIPLIER: Record<InterpretationType, number> = {
  [InterpretationType.Basic]: 1,
  [InterpretationType.Detailed]: 2,
  [InterpretationType.Professional]: 5,
  [InterpretationType.Career]: 1.5,
  [InterpretationType.Relationship]: 1.5,
  [InterpretationType.Health]: 1.5,
  [InterpretationType.Wealth]: 1.5,
};

/** AI 解读请求状态 */
export enum InterpretationStatus {
  Pending = 0,     // 等待处理
  Processing = 1,  // 处理中
  Completed = 2,   // 已完成
  Failed = 3,      // 已失败
  Expired = 4,     // 已过期
  Disputed = 5,    // 已争议
}

/** AI 解读请求 */
export interface InterpretationRequest {
  id: number;
  hexagramId: number;
  requester: string;
  interpretationType: InterpretationType;
  status: InterpretationStatus;
  feePaid: bigint;
  createdAt: number;
  oracleNode?: string;
  completedAt?: number;
}

/** AI 解读结果 */
export interface InterpretationResult {
  requestId: number;
  contentCid: string;
  summaryCid?: string;
  oracle: string;
  submittedAt: number;
  qualityScore?: number;
  userRating?: number;
  modelVersion: string;
  language: string;
}

// ==================== 服务市场类型 ====================

/** 服务提供者等级 */
export enum ProviderTier {
  Novice = 0,     // 新手
  Certified = 1,  // 认证
  Senior = 2,     // 资深
  Expert = 3,     // 专家
  Master = 4,     // 大师
}

/** 提供者等级名称 */
export const PROVIDER_TIER_NAMES: Record<ProviderTier, string> = {
  [ProviderTier.Novice]: '新手',
  [ProviderTier.Certified]: '认证',
  [ProviderTier.Senior]: '资深',
  [ProviderTier.Expert]: '专家',
  [ProviderTier.Master]: '大师',
};

/** 服务类型 */
export enum ServiceType {
  TextReading = 0,       // 文字解卦
  VoiceReading = 1,      // 语音解卦
  VideoReading = 2,      // 视频解卦
  LiveConsultation = 3,  // 实时咨询
}

/** 服务类型名称 */
export const SERVICE_TYPE_NAMES: Record<ServiceType, string> = {
  [ServiceType.TextReading]: '文字解卦',
  [ServiceType.VoiceReading]: '语音解卦',
  [ServiceType.VideoReading]: '视频解卦',
  [ServiceType.LiveConsultation]: '实时咨询',
};

/** 擅长领域 */
export enum Specialty {
  Career = 0,       // 事业运势
  Relationship = 1, // 感情婚姻
  Wealth = 2,       // 财运投资
  Health = 3,       // 健康养生
  Education = 4,    // 学业考试
  Travel = 5,       // 出行旅游
  Legal = 6,        // 官司诉讼
  Finding = 7,      // 寻人寻物
  FengShui = 8,     // 风水堪舆
  DateSelection = 9,// 择日选时
}

/** 擅长领域名称 */
export const SPECIALTY_NAMES: Record<Specialty, string> = {
  [Specialty.Career]: '事业运势',
  [Specialty.Relationship]: '感情婚姻',
  [Specialty.Wealth]: '财运投资',
  [Specialty.Health]: '健康养生',
  [Specialty.Education]: '学业考试',
  [Specialty.Travel]: '出行旅游',
  [Specialty.Legal]: '官司诉讼',
  [Specialty.Finding]: '寻人寻物',
  [Specialty.FengShui]: '风水堪舆',
  [Specialty.DateSelection]: '择日选时',
};

/** 服务提供者 */
export interface ServiceProvider {
  account: string;
  name: string;
  bio: string;
  avatarCid?: string;
  tier: ProviderTier;
  isActive: boolean;
  deposit: bigint;
  totalOrders: number;
  completedOrders: number;
  totalRatings: number;
  ratingSum: number;
  totalEarnings: bigint;
  specialties: number; // 位图
  acceptsUrgent: boolean;
  lastActiveAt: number;
}

/** 服务套餐 */
export interface ServicePackage {
  id: number;
  serviceType: ServiceType;
  name: string;
  description: string;
  price: bigint;
  duration: number;
  followUpCount: number;
  urgentAvailable: boolean;
  urgentSurcharge: number;
  isActive: boolean;
  salesCount: number;
}

/** 订单状态 */
export enum OrderStatus {
  PendingPayment = 0,
  Paid = 1,
  Accepted = 2,
  Completed = 3,
  Reviewed = 4,
  Cancelled = 5,
  Refunded = 6,
  Disputed = 7,
}

/** 订单状态名称 */
export const ORDER_STATUS_NAMES: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: '待支付',
  [OrderStatus.Paid]: '已支付',
  [OrderStatus.Accepted]: '已接单',
  [OrderStatus.Completed]: '已完成',
  [OrderStatus.Reviewed]: '已评价',
  [OrderStatus.Cancelled]: '已取消',
  [OrderStatus.Refunded]: '已退款',
  [OrderStatus.Disputed]: '争议中',
};

/** 市场订单 */
export interface MarketOrder {
  id: number;
  customer: string;
  provider: string;
  hexagramId: number;
  packageId: number;
  amount: bigint;
  platformFee: bigint;
  isUrgent: boolean;
  status: OrderStatus;
  questionCid: string;
  answerCid?: string;
  createdAt: number;
  paidAt?: number;
  acceptedAt?: number;
  completedAt?: number;
  followUpsRemaining: number;
  rating?: number;
  reviewCid?: string;
}

/** 评价 */
export interface Review {
  orderId: number;
  reviewer: string;
  reviewee: string;
  overallRating: number;
  accuracyRating: number;
  attitudeRating: number;
  responseRating: number;
  contentCid?: string;
  createdAt: number;
  isAnonymous: boolean;
  providerReplyCid?: string;
}

// ==================== 辅助函数 ====================

/**
 * 计算卦象索引 (0-63)
 */
export function getHexagramIndex(upper: Trigram, lower: Trigram): number {
  return upper * 8 + lower;
}

/**
 * 获取卦象名称
 */
export function getHexagramName(upper: Trigram, lower: Trigram): string {
  const index = getHexagramIndex(upper, lower);
  return HEXAGRAM_NAMES[index] || '未知卦象';
}

/**
 * 检查提供者是否擅长指定领域
 */
export function hasSpecialty(specialties: number, specialty: Specialty): boolean {
  return (specialties & (1 << specialty)) !== 0;
}

/**
 * 获取提供者的擅长领域列表
 */
export function getSpecialties(specialties: number): Specialty[] {
  const result: Specialty[] = [];
  for (let i = 0; i < 10; i++) {
    if (specialties & (1 << i)) {
      result.push(i as Specialty);
    }
  }
  return result;
}

/**
 * 计算提供者平均评分
 */
export function calculateAverageRating(provider: ServiceProvider): number {
  if (provider.totalRatings === 0) return 0;
  return provider.ratingSum / provider.totalRatings;
}

/**
 * 计算提供者完成率
 */
export function calculateCompletionRate(provider: ServiceProvider): number {
  if (provider.totalOrders === 0) return 100;
  return (provider.completedOrders / provider.totalOrders) * 100;
}

/**
 * 格式化农历时辰
 */
export function formatLunarHour(hour: number): string {
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return hours[hour % 12] + '时';
}

/**
 * 格式化卦象显示
 */
export function formatHexagramDisplay(hexagram: Hexagram): string {
  const upperSymbol = TRIGRAM_SYMBOLS[hexagram.upperTrigram];
  const lowerSymbol = TRIGRAM_SYMBOLS[hexagram.lowerTrigram];
  const name = getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram);
  return `${upperSymbol}${lowerSymbol} ${name}`;
}

// ==================== NFT 类型 ====================

/** NFT 稀有度等级 */
export enum NftRarity {
  Common = 0,     // 普通
  Rare = 1,       // 稀有
  Epic = 2,       // 史诗
  Legendary = 3,  // 传说
}

/** 稀有度名称 */
export const NFT_RARITY_NAMES: Record<NftRarity, string> = {
  [NftRarity.Common]: '普通',
  [NftRarity.Rare]: '稀有',
  [NftRarity.Epic]: '史诗',
  [NftRarity.Legendary]: '传说',
};

/** 稀有度颜色 */
export const NFT_RARITY_COLORS: Record<NftRarity, string> = {
  [NftRarity.Common]: '#8c8c8c',
  [NftRarity.Rare]: '#1890ff',
  [NftRarity.Epic]: '#722ed1',
  [NftRarity.Legendary]: '#faad14',
};

/** 卦象 NFT 元数据 */
export interface HexagramNft {
  /** NFT ID */
  id: number;
  /** 卦象 ID */
  hexagramId: number;
  /** 所有者 */
  owner: string;
  /** 创作者（首次铸造者） */
  creator: string;
  /** 名称 */
  name: string;
  /** 元数据 IPFS CID */
  metadataCid: string;
  /** 图片 IPFS CID */
  imageCid?: string;
  /** 稀有度 */
  rarity: NftRarity;
  /** 版税比例（basis points，万分比） */
  royaltyRate: number;
  /** 铸造时间（区块号） */
  mintedAt: number;
  /** 是否挂单 */
  isListed: boolean;
  /** 挂单价格 */
  listPrice?: bigint;
  /** 转让次数 */
  transferCount: number;
}

/** NFT 收藏集 */
export interface NftCollection {
  /** 收藏集 ID */
  id: number;
  /** 所有者 */
  owner: string;
  /** 名称 */
  name: string;
  /** 描述 IPFS CID */
  descriptionCid?: string;
  /** 封面图片 IPFS CID */
  coverCid?: string;
  /** NFT 数量 */
  nftCount: number;
  /** 创建时间（区块号） */
  createdAt: number;
}

/** NFT 出价 */
export interface NftOffer {
  /** 出价 ID */
  id: number;
  /** NFT ID */
  nftId: number;
  /** 出价人 */
  bidder: string;
  /** 出价金额 */
  amount: bigint;
  /** 过期区块 */
  expiresAt: number;
  /** 创建时间（区块号） */
  createdAt: number;
}

/** NFT 交易历史 */
export interface NftTradeHistory {
  /** NFT ID */
  nftId: number;
  /** 卖家 */
  seller: string;
  /** 买家 */
  buyer: string;
  /** 成交价格 */
  price: bigint;
  /** 交易时间（区块号） */
  tradedAt: number;
}

/**
 * 获取稀有度铸造费用倍数
 */
export function getRarityFeeMultiplier(rarity: NftRarity): number {
  switch (rarity) {
    case NftRarity.Common:
      return 1;
    case NftRarity.Rare:
      return 1.5;
    case NftRarity.Epic:
      return 3;
    case NftRarity.Legendary:
      return 10;
    default:
      return 1;
  }
}

// ==================== 完整排盘详情类型（对应 Pallet FullDivinationDetail） ====================

/**
 * 体用关系枚举
 *
 * 梅花易数核心概念：体卦代表自身，用卦代表所占之事
 */
export enum TiYongRelation {
  BiHe = 0,        // 比和 - 体用五行相同，次吉
  YongShengTi = 1, // 用生体 - 大吉
  TiShengYong = 2, // 体生用 - 小凶（泄气）
  YongKeTi = 3,    // 用克体 - 大凶
  TiKeYong = 4,    // 体克用 - 中平（需耗力）
}

/** 体用关系名称 */
export const TIYONG_RELATION_NAMES: Record<TiYongRelation, string> = {
  [TiYongRelation.BiHe]: '比和',
  [TiYongRelation.YongShengTi]: '用生体',
  [TiYongRelation.TiShengYong]: '体生用',
  [TiYongRelation.YongKeTi]: '用克体',
  [TiYongRelation.TiKeYong]: '体克用',
};

/**
 * 吉凶判断结果
 */
export enum Fortune {
  DaXiong = 0,   // 大凶
  XiaoXiong = 1, // 小凶
  Ping = 2,      // 平
  XiaoJi = 3,    // 小吉
  DaJi = 4,      // 大吉
}

/** 吉凶名称 */
export const FORTUNE_NAMES: Record<Fortune, string> = {
  [Fortune.DaXiong]: '大凶',
  [Fortune.XiaoXiong]: '小凶',
  [Fortune.Ping]: '平',
  [Fortune.XiaoJi]: '小吉',
  [Fortune.DaJi]: '大吉',
};

/**
 * 单卦详细信息
 *
 * 对应 Pallet 的 HexagramDetail 结构
 */
export interface HexagramDetail {
  /** 六十四卦名称（如"乾为天"） */
  name: string;
  /** 上卦名称（如"乾"） */
  shangGuaName: string;
  /** 下卦名称（如"乾"） */
  xiaGuaName: string;
  /** 上卦符号（如"☰"） */
  shangGuaSymbol: string;
  /** 下卦符号（如"☰"） */
  xiaGuaSymbol: string;
  /** 上卦五行（如"金"） */
  shangGuaWuxing: string;
  /** 下卦五行（如"金"） */
  xiaGuaWuxing: string;
  /** 卦辞 */
  guaci: string;
  /** 动爻名称（如"初爻"） */
  dongYaoName: string;
  /** 动爻爻名（如"初九"、"六二"） */
  dongYaoMing: string;
  /** 动爻爻辞 */
  dongYaoCi: string;
  /** 体用关系名称（如"用生体"） */
  tiyongName: string;
  /** 吉凶名称（如"大吉"） */
  fortuneName: string;
}

/**
 * 完整排盘详细信息
 *
 * 对应 Pallet 的 FullDivinationDetail 结构
 * 包含本卦、变卦、互卦、错卦、综卦、伏卦的详细信息
 */
export interface FullDivinationDetail {
  /** 本卦详细信息 */
  benGua: HexagramDetail;
  /** 变卦详细信息 */
  bianGua: HexagramDetail;
  /** 互卦详细信息 */
  huGua: HexagramDetail;
  /** 错卦详细信息 */
  cuoGua: HexagramDetail;
  /** 综卦详细信息 */
  zongGua: HexagramDetail;
  /** 伏卦详细信息（飞伏神卦）*/
  fuGua: HexagramDetail;
  /** 体用关系详细解读 */
  tiyongInterpretation: string;
}

/**
 * 解析 BoundedVec<u8> 为字符串
 *
 * @param data - 原始数据（字节数组或已解码的字符串）
 * @returns 解码后的字符串
 */
export function parseBoundedVecToString(data: unknown): string {
  if (!data) return '';

  // 如果已经是字符串，直接返回
  if (typeof data === 'string') return data;

  // 如果是数组，尝试转换为字符串
  if (Array.isArray(data)) {
    try {
      const bytes = data.map((b: number | { toNumber?: () => number }) =>
        typeof b === 'number' ? b : b.toNumber?.() ?? 0
      );
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch {
      return '';
    }
  }

  // 如果有 toHuman 方法
  if (typeof (data as { toHuman?: () => string }).toHuman === 'function') {
    return (data as { toHuman: () => string }).toHuman();
  }

  // 如果有 toString 方法
  if (typeof (data as { toString?: () => string }).toString === 'function') {
    return (data as { toString: () => string }).toString();
  }

  return '';
}
