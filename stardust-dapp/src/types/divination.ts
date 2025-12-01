/**
 * 通用占卜系统类型定义
 *
 * 本模块定义了支持多种玄学系统（梅花易数、八字命理、六爻等）的通用类型接口。
 * 与后端 pallet-divination-common 保持一致。
 */

// ==================== 占卜类型枚举 ====================

/**
 * 占卜类型枚举
 *
 * 与后端 DivinationType 保持一致
 */
export enum DivinationType {
  /** 梅花易数 - 先天占卜 */
  Meihua = 0,
  /** 八字命理 - 出生时间推算 */
  Bazi = 1,
  /** 六爻占卜 - 铜钱起卦 */
  Liuyao = 2,
  /** 奇门遁甲 - 时空预测 */
  Qimen = 3,
  /** 紫微斗数 - 星盘推算 */
  Ziwei = 4,
}

/** 占卜类型中文名称 */
export const DIVINATION_TYPE_NAMES: Record<DivinationType, string> = {
  [DivinationType.Meihua]: '梅花易数',
  [DivinationType.Bazi]: '八字命理',
  [DivinationType.Liuyao]: '六爻占卜',
  [DivinationType.Qimen]: '奇门遁甲',
  [DivinationType.Ziwei]: '紫微斗数',
};

/** 占卜类型描述 */
export const DIVINATION_TYPE_DESCRIPTIONS: Record<DivinationType, string> = {
  [DivinationType.Meihua]: '以时间、数字、文字等方式起卦，通过体用生克分析吉凶',
  [DivinationType.Bazi]: '根据出生年月日时推算四柱八字，分析命运格局',
  [DivinationType.Liuyao]: '通过铜钱摇卦获得六爻卦象，详细分析事物发展',
  [DivinationType.Qimen]: '结合天时、地利、人事，进行时空维度的全面预测',
  [DivinationType.Ziwei]: '根据出生时间排布星盘，分析一生命运走势',
};

/** 占卜类型图标 */
export const DIVINATION_TYPE_ICONS: Record<DivinationType, string> = {
  [DivinationType.Meihua]: '☰',
  [DivinationType.Bazi]: '甲',
  [DivinationType.Liuyao]: '⚊',
  [DivinationType.Qimen]: '奇',
  [DivinationType.Ziwei]: '★',
};

// ==================== 稀有度系统 ====================

/**
 * NFT 稀有度等级
 */
export enum Rarity {
  /** 普通 */
  Common = 0,
  /** 稀有 */
  Rare = 1,
  /** 史诗 */
  Epic = 2,
  /** 传说 */
  Legendary = 3,
}

/** 稀有度名称 */
export const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Common]: '普通',
  [Rarity.Rare]: '稀有',
  [Rarity.Epic]: '史诗',
  [Rarity.Legendary]: '传说',
};

/** 稀有度颜色 */
export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: '#8c8c8c',
  [Rarity.Rare]: '#1890ff',
  [Rarity.Epic]: '#722ed1',
  [Rarity.Legendary]: '#faad14',
};

/** 稀有度背景渐变 */
export const RARITY_GRADIENTS: Record<Rarity, string> = {
  [Rarity.Common]: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
  [Rarity.Rare]: 'linear-gradient(135deg, #e6f7ff, #91d5ff)',
  [Rarity.Epic]: 'linear-gradient(135deg, #f9f0ff, #d3adf7)',
  [Rarity.Legendary]: 'linear-gradient(135deg, #fffbe6, #ffe58f)',
};

// ==================== 解读类型 ====================

/**
 * AI 解读类型
 */
export enum InterpretationType {
  /** 基础解读 - 简单的吉凶判断 */
  Basic = 0,
  /** 详细解读 - 包含具体建议 */
  Detailed = 1,
  /** 专业解读 - 完整的专业分析 */
  Professional = 2,
  /** 事业解读 - 工作运势专题 */
  Career = 3,
  /** 感情解读 - 婚恋感情专题 */
  Relationship = 4,
  /** 健康解读 - 身体健康专题 */
  Health = 5,
  /** 财运解读 - 财富运势专题 */
  Wealth = 6,
  /** 学业解读 - 学习考试专题 */
  Education = 7,
  /** 年运解读 - 年度运势分析 */
  Annual = 8,
}

/** 解读类型名称 */
export const INTERPRETATION_TYPE_NAMES: Record<InterpretationType, string> = {
  [InterpretationType.Basic]: '基础解读',
  [InterpretationType.Detailed]: '详细解读',
  [InterpretationType.Professional]: '专业解读',
  [InterpretationType.Career]: '事业解读',
  [InterpretationType.Relationship]: '感情解读',
  [InterpretationType.Health]: '健康解读',
  [InterpretationType.Wealth]: '财运解读',
  [InterpretationType.Education]: '学业解读',
  [InterpretationType.Annual]: '年运解读',
};

/** 解读类型描述 */
export const INTERPRETATION_TYPE_DESCRIPTIONS: Record<InterpretationType, string> = {
  [InterpretationType.Basic]: '快速获得吉凶判断和简单建议',
  [InterpretationType.Detailed]: '详细分析卦象含义和具体行动建议',
  [InterpretationType.Professional]: '专业级完整分析报告，深度解读',
  [InterpretationType.Career]: '工作、事业、职场相关的专题分析',
  [InterpretationType.Relationship]: '恋爱、婚姻、感情相关的专题分析',
  [InterpretationType.Health]: '身体健康、养生相关的专题分析',
  [InterpretationType.Wealth]: '财运、投资、理财相关的专题分析',
  [InterpretationType.Education]: '学习、考试、升学相关的专题分析',
  [InterpretationType.Annual]: '年度运势全面分析，把握全年趋势',
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
  [InterpretationType.Education]: 1.5,
  [InterpretationType.Annual]: 3,
};

// ==================== 解读状态 ====================

/**
 * AI 解读请求状态
 */
export enum InterpretationStatus {
  /** 等待处理 */
  Pending = 0,
  /** 处理中 */
  Processing = 1,
  /** 已完成 */
  Completed = 2,
  /** 已失败 */
  Failed = 3,
  /** 已过期 */
  Expired = 4,
  /** 已争议 */
  Disputed = 5,
}

/** 解读状态名称 */
export const INTERPRETATION_STATUS_NAMES: Record<InterpretationStatus, string> = {
  [InterpretationStatus.Pending]: '等待处理',
  [InterpretationStatus.Processing]: '处理中',
  [InterpretationStatus.Completed]: '已完成',
  [InterpretationStatus.Failed]: '已失败',
  [InterpretationStatus.Expired]: '已过期',
  [InterpretationStatus.Disputed]: '争议中',
};

// ==================== 服务市场类型 ====================

/**
 * 服务提供者等级
 */
export enum ProviderTier {
  /** 新手 - 刚入驻 */
  Novice = 0,
  /** 认证 - 通过基础认证 */
  Certified = 1,
  /** 资深 - 完成一定订单量 */
  Senior = 2,
  /** 专家 - 高评分高订单量 */
  Expert = 3,
  /** 大师 - 顶级认证 */
  Master = 4,
}

/** 提供者等级名称 */
export const PROVIDER_TIER_NAMES: Record<ProviderTier, string> = {
  [ProviderTier.Novice]: '新手',
  [ProviderTier.Certified]: '认证',
  [ProviderTier.Senior]: '资深',
  [ProviderTier.Expert]: '专家',
  [ProviderTier.Master]: '大师',
};

/** 提供者等级颜色 */
export const PROVIDER_TIER_COLORS: Record<ProviderTier, string> = {
  [ProviderTier.Novice]: '#8c8c8c',
  [ProviderTier.Certified]: '#52c41a',
  [ProviderTier.Senior]: '#1890ff',
  [ProviderTier.Expert]: '#722ed1',
  [ProviderTier.Master]: '#faad14',
};

/** 等级所需最低订单数 */
export const PROVIDER_TIER_MIN_ORDERS: Record<ProviderTier, number> = {
  [ProviderTier.Novice]: 0,
  [ProviderTier.Certified]: 10,
  [ProviderTier.Senior]: 50,
  [ProviderTier.Expert]: 200,
  [ProviderTier.Master]: 500,
};

/** 等级平台费率（万分比） */
export const PROVIDER_TIER_FEE_RATES: Record<ProviderTier, number> = {
  [ProviderTier.Novice]: 2000,    // 20%
  [ProviderTier.Certified]: 1500, // 15%
  [ProviderTier.Senior]: 1200,    // 12%
  [ProviderTier.Expert]: 1000,    // 10%
  [ProviderTier.Master]: 800,     // 8%
};

/**
 * 服务类型
 */
export enum ServiceType {
  /** 文字解读 */
  TextReading = 0,
  /** 语音解读 */
  VoiceReading = 1,
  /** 视频解读 */
  VideoReading = 2,
  /** 实时咨询 */
  LiveConsultation = 3,
}

/** 服务类型名称 */
export const SERVICE_TYPE_NAMES: Record<ServiceType, string> = {
  [ServiceType.TextReading]: '文字解读',
  [ServiceType.VoiceReading]: '语音解读',
  [ServiceType.VideoReading]: '视频解读',
  [ServiceType.LiveConsultation]: '实时咨询',
};

/** 服务类型基础时长（分钟） */
export const SERVICE_TYPE_DURATIONS: Record<ServiceType, number> = {
  [ServiceType.TextReading]: 0,        // 无时长限制
  [ServiceType.VoiceReading]: 10,      // 10分钟
  [ServiceType.VideoReading]: 15,      // 15分钟
  [ServiceType.LiveConsultation]: 30,  // 30分钟
};

/**
 * 擅长领域
 */
export enum Specialty {
  /** 事业运势 */
  Career = 0,
  /** 感情婚姻 */
  Relationship = 1,
  /** 财运投资 */
  Wealth = 2,
  /** 健康养生 */
  Health = 3,
  /** 学业考试 */
  Education = 4,
  /** 出行旅游 */
  Travel = 5,
  /** 官司诉讼 */
  Legal = 6,
  /** 寻人寻物 */
  Finding = 7,
  /** 风水堪舆 */
  FengShui = 8,
  /** 择日选时 */
  DateSelection = 9,
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

// ==================== 订单状态 ====================

/**
 * 订单状态
 */
export enum OrderStatus {
  /** 待支付 */
  PendingPayment = 0,
  /** 已支付，等待接单 */
  Paid = 1,
  /** 已接单，处理中 */
  Accepted = 2,
  /** 已完成解读 */
  Completed = 3,
  /** 已评价 */
  Reviewed = 4,
  /** 已取消 */
  Cancelled = 5,
  /** 已退款 */
  Refunded = 6,
  /** 争议中 */
  Disputed = 7,
}

/** 订单状态名称 */
export const ORDER_STATUS_NAMES: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: '待支付',
  [OrderStatus.Paid]: '待接单',
  [OrderStatus.Accepted]: '处理中',
  [OrderStatus.Completed]: '已完成',
  [OrderStatus.Reviewed]: '已评价',
  [OrderStatus.Cancelled]: '已取消',
  [OrderStatus.Refunded]: '已退款',
  [OrderStatus.Disputed]: '争议中',
};

/** 订单状态颜色 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PendingPayment]: '#faad14',
  [OrderStatus.Paid]: '#1890ff',
  [OrderStatus.Accepted]: '#13c2c2',
  [OrderStatus.Completed]: '#52c41a',
  [OrderStatus.Reviewed]: '#52c41a',
  [OrderStatus.Cancelled]: '#8c8c8c',
  [OrderStatus.Refunded]: '#ff4d4f',
  [OrderStatus.Disputed]: '#ff7875',
};

// ==================== 通用接口定义 ====================

/**
 * 通用占卜结果基础接口
 */
export interface DivinationResultBase {
  /** 结果 ID */
  id: number;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 创建者 */
  creator: string;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 创建时间戳（毫秒） */
  timestamp: number;
}

/**
 * 服务提供者接口
 */
export interface ServiceProvider {
  /** 账户地址 */
  account: string;
  /** 显示名称 */
  name: string;
  /** 个人简介 */
  bio: string;
  /** 头像 IPFS CID */
  avatarCid?: string;
  /** 认证等级 */
  tier: ProviderTier;
  /** 是否激活 */
  isActive: boolean;
  /** 保证金 */
  deposit: bigint;
  /** 注册时间（区块号） */
  registeredAt: number;
  /** 总订单数 */
  totalOrders: number;
  /** 完成订单数 */
  completedOrders: number;
  /** 取消订单数 */
  cancelledOrders: number;
  /** 总评分次数 */
  totalRatings: number;
  /** 评分总和 */
  ratingSum: number;
  /** 总收入 */
  totalEarnings: bigint;
  /** 擅长领域（位图） */
  specialties: number;
  /** 支持的占卜类型（位图） */
  supportedDivinationTypes: number;
  /** 是否接受加急订单 */
  acceptsUrgent: boolean;
  /** 最后活跃时间（区块号） */
  lastActiveAt: number;
}

/**
 * 服务套餐接口
 */
export interface ServicePackage {
  /** 套餐 ID */
  id: number;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 服务类型 */
  serviceType: ServiceType;
  /** 套餐名称 */
  name: string;
  /** 套餐描述 */
  description: string;
  /** 价格 */
  price: bigint;
  /** 服务时长（分钟，0 表示不限） */
  duration: number;
  /** 包含追问次数 */
  followUpCount: number;
  /** 是否支持加急 */
  urgentAvailable: boolean;
  /** 加急加价比例（万分比） */
  urgentSurcharge: number;
  /** 是否启用 */
  isActive: boolean;
  /** 销量 */
  salesCount: number;
}

/**
 * 市场订单接口
 */
export interface MarketOrder {
  /** 订单 ID */
  id: number;
  /** 客户 */
  customer: string;
  /** 服务提供者 */
  provider: string;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 占卜结果 ID */
  resultId: number;
  /** 套餐 ID */
  packageId: number;
  /** 订单金额 */
  amount: bigint;
  /** 平台手续费 */
  platformFee: bigint;
  /** 是否加急 */
  isUrgent: boolean;
  /** 订单状态 */
  status: OrderStatus;
  /** 问题描述 CID */
  questionCid: string;
  /** 解读结果 CID */
  answerCid?: string;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 支付时间（区块号） */
  paidAt?: number;
  /** 接单时间（区块号） */
  acceptedAt?: number;
  /** 完成时间（区块号） */
  completedAt?: number;
  /** 剩余追问次数 */
  followUpsRemaining: number;
  /** 评分 */
  rating?: number;
  /** 评价内容 CID */
  reviewCid?: string;
}

/**
 * 评价接口
 */
export interface Review {
  /** 订单 ID */
  orderId: number;
  /** 评价者 */
  reviewer: string;
  /** 被评价者 */
  reviewee: string;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 总体评分（1-5） */
  overallRating: number;
  /** 准确度评分 */
  accuracyRating: number;
  /** 服务态度评分 */
  attitudeRating: number;
  /** 响应速度评分 */
  responseRating: number;
  /** 评价内容 CID */
  contentCid?: string;
  /** 评价时间（区块号） */
  createdAt: number;
  /** 是否匿名 */
  isAnonymous: boolean;
  /** 提供者回复 CID */
  providerReplyCid?: string;
}

/**
 * AI 解读请求接口
 */
export interface InterpretationRequest {
  /** 请求 ID */
  id: number;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 占卜结果 ID */
  resultId: number;
  /** 请求者 */
  requester: string;
  /** 解读类型 */
  interpretationType: InterpretationType;
  /** 状态 */
  status: InterpretationStatus;
  /** 已支付费用 */
  feePaid: bigint;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 分配的预言机 */
  oracleNode?: string;
  /** 完成时间（区块号） */
  completedAt?: number;
}

/**
 * AI 解读结果接口
 */
export interface InterpretationResult {
  /** 请求 ID */
  requestId: number;
  /** 内容 IPFS CID */
  contentCid: string;
  /** 摘要 IPFS CID */
  summaryCid?: string;
  /** 预言机 */
  oracle: string;
  /** 提交时间（区块号） */
  submittedAt: number;
  /** 质量评分 */
  qualityScore?: number;
  /** 用户评分 */
  userRating?: number;
  /** AI 模型版本 */
  modelVersion: string;
  /** 解读语言 */
  language: string;
}

/**
 * 通用占卜 NFT 接口
 */
export interface DivinationNft {
  /** NFT ID */
  id: number;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 占卜结果 ID */
  resultId: number;
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
  rarity: Rarity;
  /** 版税比例（万分比） */
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

/**
 * NFT 收藏集接口
 */
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

/**
 * NFT 出价接口
 */
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

// ==================== 辅助函数 ====================

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
 * 检查提供者是否支持指定占卜类型
 */
export function supportsDivinationType(
  supportedTypes: number,
  divinationType: DivinationType
): boolean {
  return (supportedTypes & (1 << divinationType)) !== 0;
}

/**
 * 获取提供者支持的占卜类型列表
 */
export function getSupportedDivinationTypes(supportedTypes: number): DivinationType[] {
  const result: DivinationType[] = [];
  for (let i = 0; i < 5; i++) {
    if (supportedTypes & (1 << i)) {
      result.push(i as DivinationType);
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
 * 获取稀有度铸造费用倍数
 */
export function getRarityFeeMultiplier(rarity: Rarity): number {
  switch (rarity) {
    case Rarity.Common:
      return 1;
    case Rarity.Rare:
      return 1.5;
    case Rarity.Epic:
      return 3;
    case Rarity.Legendary:
      return 10;
    default:
      return 1;
  }
}

/**
 * 格式化占卜类型标签
 */
export function formatDivinationTypeTag(divinationType: DivinationType): {
  name: string;
  icon: string;
  color: string;
} {
  const colors: Record<DivinationType, string> = {
    [DivinationType.Meihua]: '#1890ff',
    [DivinationType.Bazi]: '#52c41a',
    [DivinationType.Liuyao]: '#722ed1',
    [DivinationType.Qimen]: '#fa8c16',
    [DivinationType.Ziwei]: '#eb2f96',
  };

  return {
    name: DIVINATION_TYPE_NAMES[divinationType],
    icon: DIVINATION_TYPE_ICONS[divinationType],
    color: colors[divinationType],
  };
}
