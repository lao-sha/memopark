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
  /** 大六壬 - 式占术数 */
  Daliuren = 5,
  /** 小六壬 - 马前课 */
  XiaoLiuRen = 6,
  /** 塔罗牌 - 西方占卜 */
  Tarot = 7,
  /** 太乙神数 - 三式之首 */
  Taiyi = 8,
}

/** 占卜类型中文名称 */
export const DIVINATION_TYPE_NAMES: Record<DivinationType, string> = {
  [DivinationType.Meihua]: '梅花易数',
  [DivinationType.Bazi]: '八字命理',
  [DivinationType.Liuyao]: '六爻占卜',
  [DivinationType.Qimen]: '奇门遁甲',
  [DivinationType.Ziwei]: '紫微斗数',
  [DivinationType.Daliuren]: '大六壬',
  [DivinationType.XiaoLiuRen]: '小六壬',
  [DivinationType.Tarot]: '塔罗牌',
  [DivinationType.Taiyi]: '太乙神数',
};

/** 占卜类型描述 */
export const DIVINATION_TYPE_DESCRIPTIONS: Record<DivinationType, string> = {
  [DivinationType.Meihua]: '以时间、数字、文字等方式起卦，通过体用生克分析吉凶',
  [DivinationType.Bazi]: '根据出生年月日时推算四柱八字，分析命运格局',
  [DivinationType.Liuyao]: '通过铜钱摇卦获得六爻卦象，详细分析事物发展',
  [DivinationType.Qimen]: '结合天时、地利、人事，进行时空维度的全面预测',
  [DivinationType.Ziwei]: '根据出生时间排布星盘，分析一生命运走势',
  [DivinationType.Daliuren]: '三式之一，以天人合一理论预测吉凶祸福',
  [DivinationType.XiaoLiuRen]: '掐指速算，快速判断事物吉凶的简易占卜术',
  [DivinationType.Tarot]: '西方神秘学占卜，通过牌面解读人生',
  [DivinationType.Taiyi]: '三式之首，主推测国运大事',
};

/** 占卜类型图标 */
export const DIVINATION_TYPE_ICONS: Record<DivinationType, string> = {
  [DivinationType.Meihua]: '☰',
  [DivinationType.Bazi]: '甲',
  [DivinationType.Liuyao]: '⚊',
  [DivinationType.Qimen]: '奇',
  [DivinationType.Ziwei]: '★',
  [DivinationType.Daliuren]: '壬',
  [DivinationType.XiaoLiuRen]: '六',
  [DivinationType.Tarot]: '🃏',
  [DivinationType.Taiyi]: '乙',
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
  /** 解读结果 CID（服务提供者提交的专业解读内容） */
  interpretationCid?: string;
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
  for (let i = 0; i < 9; i++) {  // 更新为 9 种占卜类型
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

// ==================== 悬赏问答系统 ====================

/**
 * 悬赏状态枚举
 */
export enum BountyStatus {
  /** 开放中 - 接受回答 */
  Open = 0,
  /** 已关闭 - 停止接受新回答，等待采纳 */
  Closed = 1,
  /** 已采纳 - 选择了获奖答案 */
  Adopted = 2,
  /** 已结算 - 奖励已分发 */
  Settled = 3,
  /** 已取消 - 创建者取消悬赏 */
  Cancelled = 4,
  /** 已过期 - 超时无人回答 */
  Expired = 5,
}

/** 悬赏状态名称 */
export const BOUNTY_STATUS_NAMES: Record<BountyStatus, string> = {
  [BountyStatus.Open]: '开放中',
  [BountyStatus.Closed]: '已关闭',
  [BountyStatus.Adopted]: '已采纳',
  [BountyStatus.Settled]: '已结算',
  [BountyStatus.Cancelled]: '已取消',
  [BountyStatus.Expired]: '已过期',
};

/** 悬赏状态颜色 */
export const BOUNTY_STATUS_COLORS: Record<BountyStatus, string> = {
  [BountyStatus.Open]: '#52c41a',
  [BountyStatus.Closed]: '#faad14',
  [BountyStatus.Adopted]: '#1890ff',
  [BountyStatus.Settled]: '#722ed1',
  [BountyStatus.Cancelled]: '#8c8c8c',
  [BountyStatus.Expired]: '#ff4d4f',
};

/**
 * 悬赏回答状态枚举
 */
export enum BountyAnswerStatus {
  /** 等待中 - 等待创建者采纳 */
  Pending = 0,
  /** 已采纳 - 第一名获奖答案 */
  Adopted = 1,
  /** 已选中 - 第二、三名获奖答案 */
  Selected = 2,
  /** 参与奖 - 获得参与奖的答案 */
  Participated = 3,
  /** 已拒绝 - 被拒绝的答案 */
  Rejected = 4,
}

/** 悬赏回答状态名称 */
export const BOUNTY_ANSWER_STATUS_NAMES: Record<BountyAnswerStatus, string> = {
  [BountyAnswerStatus.Pending]: '等待中',
  [BountyAnswerStatus.Adopted]: '第一名',
  [BountyAnswerStatus.Selected]: '获奖',
  [BountyAnswerStatus.Participated]: '参与奖',
  [BountyAnswerStatus.Rejected]: '已拒绝',
};

/** 悬赏回答状态颜色 */
export const BOUNTY_ANSWER_STATUS_COLORS: Record<BountyAnswerStatus, string> = {
  [BountyAnswerStatus.Pending]: '#faad14',
  [BountyAnswerStatus.Adopted]: '#faad14',
  [BountyAnswerStatus.Selected]: '#1890ff',
  [BountyAnswerStatus.Participated]: '#52c41a',
  [BountyAnswerStatus.Rejected]: '#ff4d4f',
};

/**
 * 奖励分配方案
 */
export interface RewardDistribution {
  /** 第一名比例（万分比） */
  firstPlace: number;
  /** 第二名比例（万分比） */
  secondPlace: number;
  /** 第三名比例（万分比） */
  thirdPlace: number;
  /** 平台费比例（万分比） */
  platformFee: number;
  /** 参与奖池比例（万分比） */
  participationPool: number;
}

/** 默认奖励分配方案（60/15/5/15/5） */
export const DEFAULT_REWARD_DISTRIBUTION: RewardDistribution = {
  firstPlace: 6000,       // 60%
  secondPlace: 1500,      // 15%
  thirdPlace: 500,        // 5%
  platformFee: 1500,      // 15%
  participationPool: 500, // 5%
};

/**
 * 悬赏问题接口
 */
export interface BountyQuestion {
  /** 悬赏 ID */
  id: number;
  /** 创建者 */
  creator: string;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 关联的占卜结果 ID */
  resultId: number;
  /** 问题描述 IPFS CID */
  questionCid: string;
  /** 悬赏金额 */
  bountyAmount: bigint;
  /** 截止时间（区块号） */
  deadline: number;
  /** 最少回答数 */
  minAnswers: number;
  /** 最多回答数 */
  maxAnswers: number;
  /** 指定擅长领域（可选） */
  specialty?: Specialty;
  /** 是否仅限认证提供者 */
  certifiedOnly: boolean;
  /** 是否允许投票 */
  allowVoting: boolean;
  /** 当前状态 */
  status: BountyStatus;
  /** 回答数量 */
  answerCount: number;
  /** 总投票数 */
  totalVotes: number;
  /** 创建时间（区块号） */
  createdAt: number;
  /** 关闭时间（区块号） */
  closedAt?: number;
  /** 采纳的第一名回答 ID */
  adoptedAnswerId?: number;
  /** 第二名回答 ID */
  secondPlaceId?: number;
  /** 第三名回答 ID */
  thirdPlaceId?: number;
  /** 结算时间（区块号） */
  settledAt?: number;
  /** 奖励分配方案 */
  rewardDistribution: RewardDistribution;
}

/**
 * 悬赏回答接口
 */
export interface BountyAnswer {
  /** 回答 ID */
  id: number;
  /** 悬赏 ID */
  bountyId: number;
  /** 回答者 */
  answerer: string;
  /** 回答内容 IPFS CID */
  contentCid: string;
  /** 回答状态 */
  status: BountyAnswerStatus;
  /** 获得票数 */
  votes: number;
  /** 获得奖励金额 */
  rewardAmount: bigint;
  /** 提交时间（区块号） */
  submittedAt: number;
  /** 是否认证提供者 */
  isCertified: boolean;
  /** 提供者等级 */
  providerTier?: ProviderTier;
}

/**
 * 悬赏投票记录接口
 */
export interface BountyVote {
  /** 悬赏 ID */
  bountyId: number;
  /** 投票者 */
  voter: string;
  /** 回答 ID */
  answerId: number;
  /** 投票时间（区块号） */
  votedAt: number;
}

/**
 * 悬赏统计接口
 */
export interface BountyStatistics {
  /** 总悬赏数 */
  totalBounties: number;
  /** 活跃悬赏数 */
  activeBounties: number;
  /** 已结算悬赏数 */
  settledBounties: number;
  /** 总回答数 */
  totalAnswers: number;
  /** 总悬赏金额 */
  totalBountyAmount: bigint;
  /** 总分发奖励 */
  totalRewardsDistributed: bigint;
  /** 总平台手续费 */
  totalPlatformFees: bigint;
}

// ==================== 悬赏辅助函数 ====================

/**
 * 计算奖励分配
 */
export function calculateRewards(
  bountyAmount: bigint,
  distribution: RewardDistribution
): {
  firstPlace: bigint;
  secondPlace: bigint;
  thirdPlace: bigint;
  platformFee: bigint;
  participationPool: bigint;
} {
  const amount = Number(bountyAmount);
  return {
    firstPlace: BigInt(Math.floor((amount * distribution.firstPlace) / 10000)),
    secondPlace: BigInt(Math.floor((amount * distribution.secondPlace) / 10000)),
    thirdPlace: BigInt(Math.floor((amount * distribution.thirdPlace) / 10000)),
    platformFee: BigInt(Math.floor((amount * distribution.platformFee) / 10000)),
    participationPool: BigInt(Math.floor((amount * distribution.participationPool) / 10000)),
  };
}

/**
 * 检查悬赏是否可以创建回答
 */
export function canSubmitAnswer(bounty: BountyQuestion, currentBlock: number): boolean {
  return (
    bounty.status === BountyStatus.Open &&
    currentBlock <= bounty.deadline &&
    bounty.answerCount < bounty.maxAnswers
  );
}

/**
 * 检查悬赏是否可以关闭
 */
export function canCloseBounty(bounty: BountyQuestion): boolean {
  return (
    bounty.status === BountyStatus.Open &&
    bounty.answerCount >= bounty.minAnswers
  );
}

/**
 * 检查悬赏是否可以采纳答案
 */
export function canAdoptAnswers(bounty: BountyQuestion): boolean {
  return (
    bounty.status === BountyStatus.Closed &&
    bounty.answerCount > 0
  );
}

/**
 * 格式化悬赏状态标签
 */
export function formatBountyStatusTag(status: BountyStatus): {
  name: string;
  color: string;
  icon: string;
} {
  const icons: Record<BountyStatus, string> = {
    [BountyStatus.Open]: '🟢',
    [BountyStatus.Closed]: '🔒',
    [BountyStatus.Adopted]: '✅',
    [BountyStatus.Settled]: '💰',
    [BountyStatus.Cancelled]: '❌',
    [BountyStatus.Expired]: '⏰',
  };

  return {
    name: BOUNTY_STATUS_NAMES[status],
    color: BOUNTY_STATUS_COLORS[status],
    icon: icons[status],
  };
}

/**
 * 格式化悬赏金额
 */
export function formatBountyAmount(amount: bigint): string {
  const dust = Number(amount) / 1e12;
  if (dust >= 1000000) {
    return `${(dust / 1000000).toFixed(1)}M`;
  } else if (dust >= 1000) {
    return `${(dust / 1000).toFixed(1)}K`;
  } else {
    return dust.toFixed(2);
  }
}

/**
 * 计算悬赏剩余时间
 */
export function getBountyTimeRemaining(deadline: number, currentBlock: number): {
  blocks: number;
  hours: number;
  isExpired: boolean;
} {
  const remainingBlocks = deadline - currentBlock;
  const isExpired = remainingBlocks <= 0;
  const hours = Math.max(0, (remainingBlocks * 6) / 3600); // 6秒一个区块

  return {
    blocks: Math.max(0, remainingBlocks),
    hours,
    isExpired,
  };
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
    [DivinationType.Daliuren]: '#13c2c2',
    [DivinationType.XiaoLiuRen]: '#2f54eb',
    [DivinationType.Tarot]: '#f5222d',
    [DivinationType.Taiyi]: '#fadb14',
  };

  return {
    name: DIVINATION_TYPE_NAMES[divinationType],
    icon: DIVINATION_TYPE_ICONS[divinationType],
    color: colors[divinationType],
  };
}

// ==================== AI 模型配置系统（新增） ====================

/**
 * AI 模型配置接口
 *
 * 每种占卜类型可以配置不同的 AI 模型和费用
 */
export interface ModelConfig {
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 推荐的 AI 模型 ID */
  recommendedModelId: string;
  /** 最低模型版本要求 */
  minModelVersion: number;
  /** 费用倍率（万分比，10000 = 1.0x） */
  feeMultiplier: number;
  /** 最大响应长度 */
  maxResponseLength: number;
  /** 是否启用 */
  enabled: boolean;
  /** 最低 Oracle 评分要求 (0-100) */
  minOracleRating: number;
  /** 超时区块数 */
  timeoutBlocks?: number;
}

/** 占卜类型默认费用倍率（万分比） */
export const DIVINATION_FEE_MULTIPLIER: Record<DivinationType, number> = {
  [DivinationType.Meihua]: 10000,      // 1.0x - 基础
  [DivinationType.Bazi]: 15000,        // 1.5x - 八字较复杂
  [DivinationType.Liuyao]: 12000,      // 1.2x - 六爻中等
  [DivinationType.Qimen]: 20000,       // 2.0x - 奇门最复杂
  [DivinationType.Ziwei]: 18000,       // 1.8x - 紫微复杂
  [DivinationType.Daliuren]: 15000,    // 1.5x - 大六壬
  [DivinationType.XiaoLiuRen]: 8000,   // 0.8x - 小六壬简单
  [DivinationType.Tarot]: 10000,       // 1.0x - 塔罗基础
  [DivinationType.Taiyi]: 15000,       // 1.5x - 太乙
};

/** 占卜类型推荐最大响应长度 */
export const DIVINATION_MAX_RESPONSE_LENGTH: Record<DivinationType, number> = {
  [DivinationType.Meihua]: 8000,
  [DivinationType.Bazi]: 15000,
  [DivinationType.Liuyao]: 12000,
  [DivinationType.Qimen]: 20000,
  [DivinationType.Ziwei]: 18000,
  [DivinationType.Daliuren]: 12000,
  [DivinationType.XiaoLiuRen]: 5000,
  [DivinationType.Tarot]: 8000,
  [DivinationType.Taiyi]: 12000,
};

/**
 * Oracle 节点状态枚举
 */
export enum OracleStatus {
  /** 活跃 */
  Active = 0,
  /** 暂停 */
  Paused = 1,
  /** 注销中 */
  Unregistering = 2,
}

/** Oracle 状态名称 */
export const ORACLE_STATUS_NAMES: Record<OracleStatus, string> = {
  [OracleStatus.Active]: '活跃',
  [OracleStatus.Paused]: '暂停',
  [OracleStatus.Unregistering]: '注销中',
};

/** Oracle 状态颜色 */
export const ORACLE_STATUS_COLORS: Record<OracleStatus, string> = {
  [OracleStatus.Active]: '#52c41a',
  [OracleStatus.Paused]: '#faad14',
  [OracleStatus.Unregistering]: '#ff4d4f',
};

/**
 * Oracle 节点支持的单个模型信息
 */
export interface OracleModelInfo {
  /** 模型 ID */
  modelId: string;
  /** 模型版本 */
  version: number;
  /** 支持的占卜类型列表 */
  supportedTypes: DivinationType[];
  /** 是否为主要模型 */
  isPrimary: boolean;
}

/**
 * Oracle 节点接口
 *
 * 对应后端 OracleNode 结构
 */
export interface OracleNode {
  /** 账户地址 */
  account: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 状态 */
  status: OracleStatus;
  /** 质押金额 */
  stakeAmount: bigint;
  /** 评分（0-100） */
  rating: number;
  /** 总完成请求数 */
  totalCompleted: number;
  /** 总失败请求数 */
  totalFailed: number;
  /** 注册时间（区块号） */
  registeredAt: number;
  /** 最后活跃时间（区块号） */
  lastActiveAt: number;
  /** 支持的模型列表 */
  supportedModels: OracleModelInfo[];
  /** 当前活跃请求数 */
  activeRequests: number;
  /** 最大并发请求数 */
  maxConcurrent: number;
}

/**
 * Oracle 模型支持信息
 */
export interface OracleModelSupport {
  /** Oracle 账户 */
  account: string;
  /** 支持的模型列表 */
  models: OracleModelInfo[];
}

/**
 * 计算 Oracle 完成率
 */
export function calculateOracleCompletionRate(oracle: OracleNode): number {
  const total = oracle.totalCompleted + oracle.totalFailed;
  if (total === 0) return 100;
  return (oracle.totalCompleted / total) * 100;
}

/**
 * 检查 Oracle 是否支持指定占卜类型
 */
export function oracleSupportsDivinationType(
  oracle: OracleNode,
  divinationType: DivinationType
): boolean {
  return oracle.supportedModels.some(model =>
    model.supportedTypes.includes(divinationType)
  );
}

/**
 * 获取 Oracle 支持的占卜类型列表
 */
export function getOracleSupportedDivinationTypes(oracle: OracleNode): DivinationType[] {
  const types = new Set<DivinationType>();
  for (const model of oracle.supportedModels) {
    for (const t of model.supportedTypes) {
      types.add(t);
    }
  }
  return Array.from(types).sort((a, b) => a - b);
}

/**
 * 计算带有占卜类型倍率的解读费用
 *
 * @param baseFee 基础费用
 * @param interpretationType 解读类型
 * @param divinationType 占卜类型
 * @returns 最终费用
 */
export function calculateDivinationInterpretationFee(
  baseFee: bigint,
  interpretationType: InterpretationType,
  divinationType: DivinationType
): bigint {
  const interpretationMultiplier = INTERPRETATION_FEE_MULTIPLIER[interpretationType];
  const divinationMultiplier = DIVINATION_FEE_MULTIPLIER[divinationType] / 10000;
  return BigInt(Math.floor(Number(baseFee) * interpretationMultiplier * divinationMultiplier));
}

// ==================== 个人主页系统 ====================

/**
 * 资质证书类型
 */
export enum CertificateType {
  /** 学历证书 */
  Education = 0,
  /** 专业资格证书 */
  Professional = 1,
  /** 行业协会认证 */
  Association = 2,
  /** 师承证明 */
  Apprenticeship = 3,
  /** 获奖证书 */
  Award = 4,
  /** 其他 */
  Other = 5,
}

/** 资质证书类型名称 */
export const CERTIFICATE_TYPE_NAMES: Record<CertificateType, string> = {
  [CertificateType.Education]: '学历证书',
  [CertificateType.Professional]: '专业资格',
  [CertificateType.Association]: '协会认证',
  [CertificateType.Apprenticeship]: '师承证明',
  [CertificateType.Award]: '获奖证书',
  [CertificateType.Other]: '其他',
};

/**
 * 案例类型
 */
export enum PortfolioCaseType {
  /** 经典解读案例 */
  ClassicCase = 0,
  /** 教学文章 */
  Tutorial = 1,
  /** 理论研究 */
  Research = 2,
  /** 心得分享 */
  Sharing = 3,
}

/** 案例类型名称 */
export const PORTFOLIO_CASE_TYPE_NAMES: Record<PortfolioCaseType, string> = {
  [PortfolioCaseType.ClassicCase]: '经典案例',
  [PortfolioCaseType.Tutorial]: '教学文章',
  [PortfolioCaseType.Research]: '理论研究',
  [PortfolioCaseType.Sharing]: '心得分享',
};

/**
 * 技能标签类型
 */
export enum SkillTagType {
  /** 占卜类型相关 */
  DivinationType = 0,
  /** 擅长领域 */
  Specialty = 1,
  /** 服务特色 */
  ServiceFeature = 2,
  /** 自定义标签 */
  Custom = 3,
}

/** 技能标签类型名称 */
export const SKILL_TAG_TYPE_NAMES: Record<SkillTagType, string> = {
  [SkillTagType.DivinationType]: '占卜类型',
  [SkillTagType.Specialty]: '擅长领域',
  [SkillTagType.ServiceFeature]: '服务特色',
  [SkillTagType.Custom]: '自定义',
};

/**
 * 提供者详细资料接口
 *
 * 用于个人主页展示的扩展信息
 */
export interface ProviderProfile {
  /** 详细自我介绍 IPFS CID（支持富文本/Markdown） */
  introductionCid?: string;
  /** 从业年限 */
  experienceYears: number;
  /** 师承/学习背景 */
  background?: string;
  /** 服务理念/座右铭 */
  motto?: string;
  /** 擅长问题类型描述 */
  expertiseDescription?: string;
  /** 工作时间说明（如：每日 9:00-21:00） */
  workingHours?: string;
  /** 平均响应时间（分钟） */
  avgResponseTime?: number;
  /** 是否接受预约 */
  acceptsAppointment: boolean;
  /** 个人主页背景图 IPFS CID */
  bannerCid?: string;
  /** 资料最后更新时间（区块号） */
  updatedAt: number;
}

/**
 * 资质证书接口
 */
export interface Certificate {
  /** 证书 ID */
  id: number;
  /** 证书名称 */
  name: string;
  /** 证书类型 */
  certType: CertificateType;
  /** 颁发机构 */
  issuer?: string;
  /** 证书图片 IPFS CID */
  imageCid: string;
  /** 颁发时间（区块号） */
  issuedAt?: number;
  /** 是否已验证（管理员验证） */
  isVerified: boolean;
  /** 上传时间（区块号） */
  uploadedAt: number;
}

/**
 * 作品集/案例展示接口
 */
export interface PortfolioItem {
  /** 作品 ID */
  id: number;
  /** 作品标题 */
  title: string;
  /** 占卜类型 */
  divinationType: DivinationType;
  /** 案例类型 */
  caseType: PortfolioCaseType;
  /** 案例内容 IPFS CID（脱敏后的解读案例） */
  contentCid: string;
  /** 封面图片 IPFS CID */
  coverCid?: string;
  /** 是否精选（置顶展示） */
  isFeatured: boolean;
  /** 浏览次数 */
  viewCount: number;
  /** 点赞次数 */
  likeCount: number;
  /** 发布时间（区块号） */
  publishedAt: number;
}

/**
 * 技能标签接口
 */
export interface SkillTag {
  /** 标签名称 */
  label: string;
  /** 标签类型 */
  tagType: SkillTagType;
  /** 熟练程度（1-5） */
  proficiency: number;
}

/**
 * 评价标签统计接口
 */
export interface ReviewTagStats {
  /** "解读准确" 次数 */
  accurateCount: number;
  /** "态度友好" 次数 */
  friendlyCount: number;
  /** "回复及时" 次数 */
  quickResponseCount: number;
  /** "专业深入" 次数 */
  professionalCount: number;
  /** "耐心解答" 次数 */
  patientCount: number;
  /** "物超所值" 次数 */
  valueForMoneyCount: number;
}

// ==================== 信用体系系统 ====================

/**
 * 信用等级枚举
 *
 * 根据信用分划分的等级，影响用户权益
 */
export enum CreditLevel {
  /** 失信 (0-199) */
  Bad = 0,
  /** 不良 (200-399) */
  Poor = 1,
  /** 警示 (400-599) */
  Warning = 2,
  /** 一般 (600-749) */
  Fair = 3,
  /** 优秀 (750-899) */
  Good = 4,
  /** 卓越 (900-1000) */
  Excellent = 5,
}

/** 信用等级名称 */
export const CREDIT_LEVEL_NAMES: Record<CreditLevel, string> = {
  [CreditLevel.Bad]: '失信',
  [CreditLevel.Poor]: '不良',
  [CreditLevel.Warning]: '警示',
  [CreditLevel.Fair]: '一般',
  [CreditLevel.Good]: '优秀',
  [CreditLevel.Excellent]: '卓越',
};

/** 信用等级颜色 */
export const CREDIT_LEVEL_COLORS: Record<CreditLevel, string> = {
  [CreditLevel.Bad]: '#ff4d4f',
  [CreditLevel.Poor]: '#ff7a45',
  [CreditLevel.Warning]: '#faad14',
  [CreditLevel.Fair]: '#8c8c8c',
  [CreditLevel.Good]: '#52c41a',
  [CreditLevel.Excellent]: '#1890ff',
};

/** 信用等级分数范围 */
export const CREDIT_LEVEL_RANGES: Record<CreditLevel, { min: number; max: number }> = {
  [CreditLevel.Bad]: { min: 0, max: 199 },
  [CreditLevel.Poor]: { min: 200, max: 399 },
  [CreditLevel.Warning]: { min: 400, max: 599 },
  [CreditLevel.Fair]: { min: 600, max: 749 },
  [CreditLevel.Good]: { min: 750, max: 899 },
  [CreditLevel.Excellent]: { min: 900, max: 1000 },
};

/**
 * 根据分数获取信用等级
 */
export function getCreditLevelFromScore(score: number): CreditLevel {
  if (score < 200) return CreditLevel.Bad;
  if (score < 400) return CreditLevel.Poor;
  if (score < 600) return CreditLevel.Warning;
  if (score < 750) return CreditLevel.Fair;
  if (score < 900) return CreditLevel.Good;
  return CreditLevel.Excellent;
}

/**
 * 扣分原因枚举
 */
export enum DeductionReason {
  /** 差评扣分 */
  NegativeReview = 0,
  /** 订单取消 */
  OrderCancellation = 1,
  /** 订单超时 */
  OrderTimeout = 2,
  /** 客户投诉成立 */
  ComplaintUpheld = 3,
  /** 违规行为 */
  Violation = 4,
  /** 虚假宣传 */
  FalseAdvertising = 5,
  /** 服务欺诈 */
  Fraud = 6,
  /** 辱骂客户 */
  Abuse = 7,
  /** 泄露隐私 */
  PrivacyBreach = 8,
  /** 其他 */
  Other = 9,
}

/** 扣分原因名称 */
export const DEDUCTION_REASON_NAMES: Record<DeductionReason, string> = {
  [DeductionReason.NegativeReview]: '差评扣分',
  [DeductionReason.OrderCancellation]: '订单取消',
  [DeductionReason.OrderTimeout]: '订单超时',
  [DeductionReason.ComplaintUpheld]: '投诉成立',
  [DeductionReason.Violation]: '违规行为',
  [DeductionReason.FalseAdvertising]: '虚假宣传',
  [DeductionReason.Fraud]: '服务欺诈',
  [DeductionReason.Abuse]: '辱骂客户',
  [DeductionReason.PrivacyBreach]: '泄露隐私',
  [DeductionReason.Other]: '其他',
};

/** 扣分原因默认扣分值 */
export const DEDUCTION_REASON_DEFAULT_POINTS: Record<DeductionReason, number> = {
  [DeductionReason.NegativeReview]: 5,
  [DeductionReason.OrderCancellation]: 10,
  [DeductionReason.OrderTimeout]: 15,
  [DeductionReason.ComplaintUpheld]: 30,
  [DeductionReason.Violation]: 50,
  [DeductionReason.FalseAdvertising]: 80,
  [DeductionReason.Fraud]: 200,
  [DeductionReason.Abuse]: 100,
  [DeductionReason.PrivacyBreach]: 150,
  [DeductionReason.Other]: 20,
};

/**
 * 违规类型枚举
 */
export enum ViolationType {
  /** 轻微违规 */
  Minor = 0,
  /** 一般违规 */
  Moderate = 1,
  /** 严重违规 */
  Severe = 2,
  /** 特别严重违规 */
  Critical = 3,
}

/** 违规类型名称 */
export const VIOLATION_TYPE_NAMES: Record<ViolationType, string> = {
  [ViolationType.Minor]: '轻微违规',
  [ViolationType.Moderate]: '一般违规',
  [ViolationType.Severe]: '严重违规',
  [ViolationType.Critical]: '特别严重',
};

/** 违规类型颜色 */
export const VIOLATION_TYPE_COLORS: Record<ViolationType, string> = {
  [ViolationType.Minor]: '#faad14',
  [ViolationType.Moderate]: '#fa8c16',
  [ViolationType.Severe]: '#ff4d4f',
  [ViolationType.Critical]: '#cf1322',
};

/** 违规类型惩罚系数（万分比） */
export const VIOLATION_TYPE_MULTIPLIERS: Record<ViolationType, number> = {
  [ViolationType.Minor]: 100,      // 1x
  [ViolationType.Moderate]: 200,   // 2x
  [ViolationType.Severe]: 500,     // 5x
  [ViolationType.Critical]: 1000,  // 10x
};

/**
 * 处罚类型枚举
 */
export enum PenaltyType {
  /** 仅扣分 */
  DeductionOnly = 0,
  /** 警告 */
  Warning = 1,
  /** 限制接单 */
  OrderRestriction = 2,
  /** 暂停服务 */
  ServiceSuspension = 3,
  /** 永久封禁 */
  PermanentBan = 4,
}

/** 处罚类型名称 */
export const PENALTY_TYPE_NAMES: Record<PenaltyType, string> = {
  [PenaltyType.DeductionOnly]: '仅扣分',
  [PenaltyType.Warning]: '警告',
  [PenaltyType.OrderRestriction]: '限制接单',
  [PenaltyType.ServiceSuspension]: '暂停服务',
  [PenaltyType.PermanentBan]: '永久封禁',
};

/** 处罚类型颜色 */
export const PENALTY_TYPE_COLORS: Record<PenaltyType, string> = {
  [PenaltyType.DeductionOnly]: '#8c8c8c',
  [PenaltyType.Warning]: '#faad14',
  [PenaltyType.OrderRestriction]: '#fa8c16',
  [PenaltyType.ServiceSuspension]: '#ff4d4f',
  [PenaltyType.PermanentBan]: '#cf1322',
};

/**
 * 申诉结果枚举
 */
export enum AppealResult {
  /** 申诉成功，撤销处罚 */
  Upheld = 0,
  /** 申诉部分成功，减轻处罚 */
  PartiallyUpheld = 1,
  /** 申诉失败 */
  Rejected = 2,
}

/** 申诉结果名称 */
export const APPEAL_RESULT_NAMES: Record<AppealResult, string> = {
  [AppealResult.Upheld]: '申诉成功',
  [AppealResult.PartiallyUpheld]: '部分成功',
  [AppealResult.Rejected]: '申诉失败',
};

/** 申诉结果颜色 */
export const APPEAL_RESULT_COLORS: Record<AppealResult, string> = {
  [AppealResult.Upheld]: '#52c41a',
  [AppealResult.PartiallyUpheld]: '#faad14',
  [AppealResult.Rejected]: '#ff4d4f',
};

/**
 * 信用修复任务类型枚举
 */
export enum RepairTaskType {
  /** 完成 N 个订单 */
  CompleteOrders = 0,
  /** 获得 N 个好评 */
  GetPositiveReviews = 1,
  /** 连续 N 天无投诉 */
  NoComplaintDays = 2,
  /** 缴纳额外保证金 */
  ExtraDeposit = 3,
  /** 完成培训课程 */
  CompleteTraining = 4,
  /** 通过认证考试 */
  PassCertification = 5,
}

/** 信用修复任务类型名称 */
export const REPAIR_TASK_TYPE_NAMES: Record<RepairTaskType, string> = {
  [RepairTaskType.CompleteOrders]: '完成订单',
  [RepairTaskType.GetPositiveReviews]: '获得好评',
  [RepairTaskType.NoComplaintDays]: '无投诉',
  [RepairTaskType.ExtraDeposit]: '额外保证金',
  [RepairTaskType.CompleteTraining]: '培训课程',
  [RepairTaskType.PassCertification]: '认证考试',
};

/** 信用修复任务默认奖励分数 */
export const REPAIR_TASK_DEFAULT_REWARDS: Record<RepairTaskType, number> = {
  [RepairTaskType.CompleteOrders]: 20,
  [RepairTaskType.GetPositiveReviews]: 30,
  [RepairTaskType.NoComplaintDays]: 25,
  [RepairTaskType.ExtraDeposit]: 50,
  [RepairTaskType.CompleteTraining]: 40,
  [RepairTaskType.PassCertification]: 60,
};

/** 信用修复任务默认目标值 */
export const REPAIR_TASK_DEFAULT_TARGETS: Record<RepairTaskType, number> = {
  [RepairTaskType.CompleteOrders]: 5,
  [RepairTaskType.GetPositiveReviews]: 3,
  [RepairTaskType.NoComplaintDays]: 14,
  [RepairTaskType.ExtraDeposit]: 1,
  [RepairTaskType.CompleteTraining]: 1,
  [RepairTaskType.PassCertification]: 1,
};

/**
 * 信用变更原因枚举
 */
export enum CreditChangeReason {
  /** 好评加分 */
  PositiveReview = 0,
  /** 差评扣分 */
  NegativeReview = 1,
  /** 完成订单 */
  OrderCompleted = 2,
  /** 取消订单 */
  OrderCancelled = 3,
  /** 超时未响应 */
  ResponseTimeout = 4,
  /** 悬赏被采纳 */
  BountyAdopted = 5,
  /** 获得认证 */
  CertificationGained = 6,
  /** 违规处罚 */
  ViolationPenalty = 7,
  /** 申诉成功恢复 */
  AppealRestored = 8,
  /** 信用修复 */
  CreditRepair = 9,
  /** 定期评估调整 */
  PeriodicAdjustment = 10,
  /** 系统奖励 */
  SystemBonus = 11,
  /** 连续好评奖励 */
  ConsecutiveBonus = 12,
}

/** 信用变更原因名称 */
export const CREDIT_CHANGE_REASON_NAMES: Record<CreditChangeReason, string> = {
  [CreditChangeReason.PositiveReview]: '好评加分',
  [CreditChangeReason.NegativeReview]: '差评扣分',
  [CreditChangeReason.OrderCompleted]: '完成订单',
  [CreditChangeReason.OrderCancelled]: '取消订单',
  [CreditChangeReason.ResponseTimeout]: '响应超时',
  [CreditChangeReason.BountyAdopted]: '悬赏被采纳',
  [CreditChangeReason.CertificationGained]: '获得认证',
  [CreditChangeReason.ViolationPenalty]: '违规处罚',
  [CreditChangeReason.AppealRestored]: '申诉恢复',
  [CreditChangeReason.CreditRepair]: '信用修复',
  [CreditChangeReason.PeriodicAdjustment]: '定期评估',
  [CreditChangeReason.SystemBonus]: '系统奖励',
  [CreditChangeReason.ConsecutiveBonus]: '连续好评',
};

/**
 * 信用档案接口
 *
 * 记录提供者的信用评估数据和历史
 */
export interface CreditProfile {
  /** 当前信用分（0-1000） */
  score: number;
  /** 当前信用等级 */
  level: CreditLevel;
  /** 历史最高分 */
  highestScore: number;
  /** 历史最低分 */
  lowestScore: number;

  // ========== 服务质量维度 ==========
  /** 服务质量分（0-350） */
  serviceQualityScore: number;
  /** 平均综合评分（*100，如 450 = 4.5星） */
  avgOverallRating: number;
  /** 平均准确度评分 */
  avgAccuracyRating: number;
  /** 平均服务态度评分 */
  avgAttitudeRating: number;
  /** 平均响应速度评分 */
  avgResponseRating: number;
  /** 5星好评数 */
  fiveStarCount: number;
  /** 1星差评数 */
  oneStarCount: number;

  // ========== 行为规范维度 ==========
  /** 行为规范分（0-250） */
  behaviorScore: number;
  /** 累计违规次数 */
  violationCount: number;
  /** 累计警告次数 */
  warningCount: number;
  /** 累计投诉次数 */
  complaintCount: number;
  /** 投诉成立次数 */
  complaintUpheldCount: number;
  /** 当前活跃违规数（未过期） */
  activeViolations: number;

  // ========== 履约能力维度 ==========
  /** 履约能力分（0-300） */
  fulfillmentScore: number;
  /** 订单完成率（万分比，10000 = 100%） */
  completionRate: number;
  /** 按时完成率（万分比） */
  onTimeRate: number;
  /** 取消率（万分比） */
  cancellationRate: number;
  /** 超时次数 */
  timeoutCount: number;
  /** 主动取消次数 */
  activeCancelCount: number;
  /** 平均响应时间（区块数） */
  avgResponseBlocks: number;

  // ========== 加分项 ==========
  /** 加分项总分（0-100） */
  bonusScore: number;
  /** 悬赏被采纳次数 */
  bountyAdoptionCount: number;
  /** 获得认证数 */
  certificationCount: number;
  /** 连续好评天数 */
  consecutivePositiveDays: number;
  /** 是否通过实名认证 */
  isVerified: boolean;
  /** 是否缴纳保证金 */
  hasDeposit: boolean;

  // ========== 扣分记录 ==========
  /** 累计扣分 */
  totalDeductions: number;
  /** 最近一次扣分原因 */
  lastDeductionReason?: DeductionReason;
  /** 最近一次扣分时间（区块号） */
  lastDeductionAt?: number;

  // ========== 统计数据 ==========
  /** 总订单数 */
  totalOrders: number;
  /** 完成订单数 */
  completedOrders: number;
  /** 总评价数 */
  totalReviews: number;

  // ========== 时间戳 ==========
  /** 信用档案创建时间（区块号） */
  createdAt: number;
  /** 最近更新时间（区块号） */
  updatedAt: number;
  /** 最近评估时间（区块号） */
  lastEvaluatedAt: number;
}

/**
 * 违规记录接口
 */
export interface ViolationRecord {
  /** 记录 ID */
  id: number;
  /** 提供者账户 */
  provider: string;
  /** 违规类型 */
  violationType: ViolationType;
  /** 违规原因描述 */
  reason: string;
  /** 关联订单 ID（如有） */
  relatedOrderId?: number;
  /** 扣分数值 */
  deductionPoints: number;
  /** 处罚措施 */
  penalty: PenaltyType;
  /** 处罚期限（区块数，0表示永久） */
  penaltyDuration: number;
  /** 是否已申诉 */
  isAppealed: boolean;
  /** 申诉结果 */
  appealResult?: AppealResult;
  /** 记录时间（区块号） */
  recordedAt: number;
  /** 过期时间（区块号，信用恢复点） */
  expiresAt?: number;
  /** 是否活跃（未过期） */
  isActive: boolean;
}

/**
 * 信用变更记录接口
 */
export interface CreditChangeRecord {
  /** 变更前分数 */
  previousScore: number;
  /** 变更后分数 */
  newScore: number;
  /** 变更值（正数加分，负数扣分） */
  changeAmount: number;
  /** 变更原因 */
  reason: CreditChangeReason;
  /** 详细说明 */
  description?: string;
  /** 关联 ID（订单/违规记录等） */
  relatedId?: number;
  /** 变更时间（区块号） */
  changedAt: number;
}

/**
 * 信用修复任务接口
 */
export interface CreditRepairTask {
  /** 任务 ID */
  id: number;
  /** 任务类型 */
  taskType: RepairTaskType;
  /** 完成后恢复的分数 */
  rewardPoints: number;
  /** 任务目标值 */
  targetValue: number;
  /** 当前进度 */
  currentProgress: number;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 任务开始时间（区块号） */
  startedAt: number;
  /** 任务截止时间（区块号） */
  deadline: number;
  /** 完成时间（区块号） */
  completedAt?: number;
}

/**
 * 全局信用统计接口
 */
export interface GlobalCreditStats {
  /** 总提供者数 */
  totalProviders: number;
  /** 卓越等级数量 */
  excellentCount: number;
  /** 优秀等级数量 */
  goodCount: number;
  /** 一般等级数量 */
  fairCount: number;
  /** 警示等级数量 */
  warningCount: number;
  /** 不良等级数量 */
  poorCount: number;
  /** 失信等级数量 */
  badCount: number;
  /** 黑名单数量 */
  blacklistedCount: number;
  /** 平均信用分 */
  averageScore: number;
  /** 本周新增违规数 */
  weeklyViolations: number;
}

// ==================== 信用体系辅助函数 ====================

/**
 * 检查信用等级是否允许接单
 */
export function canAcceptOrders(level: CreditLevel): boolean {
  return level !== CreditLevel.Bad;
}

/**
 * 检查信用等级是否允许创建套餐
 */
export function canCreatePackages(level: CreditLevel): boolean {
  return level !== CreditLevel.Bad && level !== CreditLevel.Poor;
}

/**
 * 检查信用等级是否允许回答悬赏
 */
export function canAnswerBounties(level: CreditLevel): boolean {
  return level === CreditLevel.Fair || level === CreditLevel.Good || level === CreditLevel.Excellent;
}

/**
 * 获取信用等级允许的最大同时进行订单数
 */
export function getMaxActiveOrders(level: CreditLevel): number {
  switch (level) {
    case CreditLevel.Bad: return 0;
    case CreditLevel.Poor: return 1;
    case CreditLevel.Warning: return 3;
    case CreditLevel.Fair: return 5;
    case CreditLevel.Good: return 10;
    case CreditLevel.Excellent: return 20;
    default: return 0;
  }
}

/**
 * 获取信用等级的提现延迟（小时）
 */
export function getWithdrawalDelayHours(level: CreditLevel): number {
  switch (level) {
    case CreditLevel.Bad: return -1; // 禁止提现
    case CreditLevel.Poor: return 168; // 7天
    case CreditLevel.Warning: return 72; // 3天
    case CreditLevel.Fair: return 24; // 1天
    case CreditLevel.Good: return 0; // 即时
    case CreditLevel.Excellent: return 0; // 即时
    default: return 24;
  }
}

/**
 * 获取信用等级的平台费用调整（万分比，正数增加，负数减少）
 */
export function getPlatformFeeModifier(level: CreditLevel): number {
  switch (level) {
    case CreditLevel.Bad: return 0; // 不适用
    case CreditLevel.Poor: return 3000; // +30%
    case CreditLevel.Warning: return 1500; // +15%
    case CreditLevel.Fair: return 0; // 无调整
    case CreditLevel.Good: return -500; // -5%
    case CreditLevel.Excellent: return -1000; // -10%
    default: return 0;
  }
}

/**
 * 计算信用修复任务进度百分比
 */
export function calculateRepairProgress(task: CreditRepairTask): number {
  if (task.targetValue === 0) return 100;
  return Math.min(100, (task.currentProgress / task.targetValue) * 100);
}

/**
 * 格式化信用分数显示
 */
export function formatCreditScore(score: number): string {
  return score.toFixed(0);
}

/**
 * 获取信用等级进度（到下一等级的百分比）
 */
export function getCreditLevelProgress(score: number): {
  currentLevel: CreditLevel;
  progress: number;
  nextLevel?: CreditLevel;
  pointsToNext?: number;
} {
  const currentLevel = getCreditLevelFromScore(score);
  const range = CREDIT_LEVEL_RANGES[currentLevel];

  if (currentLevel === CreditLevel.Excellent) {
    return {
      currentLevel,
      progress: 100
    };
  }

  const nextLevel = (currentLevel + 1) as CreditLevel;
  const nextRange = CREDIT_LEVEL_RANGES[nextLevel];
  const progress = ((score - range.min) / (range.max - range.min + 1)) * 100;
  const pointsToNext = nextRange.min - score;

  return {
    currentLevel,
    progress,
    nextLevel,
    pointsToNext,
  };
}
