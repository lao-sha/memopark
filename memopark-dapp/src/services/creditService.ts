/**
 * 统一信用服务
 * 
 * 函数级详细中文注释：
 * 提供统一的买家信用和做市商信用查询功能，对接 pallet-credit。
 * 
 * @module creditService
 * @created 2025-10-28
 */

import { ApiPromise } from '@polkadot/api';
import type { Option, u16, u32, u64, U8aFixed, Vec } from '@polkadot/types-codec';
import type { AccountId32 } from '@polkadot/types/interfaces';

// ==================== 买家信用接口定义 ====================

/**
 * 函数级详细中文注释：买家信用等级枚举
 */
export type BuyerCreditLevel = 'Newbie' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

/**
 * 函数级详细中文注释：新用户等级枚举
 */
export type NewUserTier = 'Premium' | 'Standard' | 'Basic' | 'Restricted';

/**
 * 函数级详细中文注释：行为模式枚举
 */
export type BehaviorPattern = 'HighQuality' | 'Good' | 'Normal' | 'Suspicious' | 'Insufficient';

/**
 * 函数级详细中文注释：买家信用记录接口
 */
export interface BuyerCreditRecord {
  /** 当前等级 */
  level: BuyerCreditLevel;
  /** 新用户等级（仅前20笔有效） */
  newUserTier: NewUserTier | null;
  /** 成功完成订单数 */
  completedOrders: number;
  /** 累计购买金额（MEMO） */
  totalVolume: string;
  /** 违约次数 */
  defaultCount: number;
  /** 争议次数 */
  disputeCount: number;
  /** 上次购买时间（区块号） */
  lastPurchaseAt: number;
  /** 风险分（0-1000，越低越可信） */
  riskScore: number;
  /** 账户创建时间（区块号） */
  accountCreatedAt: number;
}

/**
 * 函数级详细中文注释：订单记录接口
 */
export interface BuyerOrderRecord {
  /** 订单金额（USDT，精度6） */
  amountUsdt: number;
  /** 付款时间（秒） */
  paymentTimeSeconds: number;
  /** 订单创建时间（区块号） */
  createdAtBlock: number;
}

/**
 * 函数级详细中文注释：推荐记录接口
 */
export interface BuyerEndorsement {
  /** 推荐人地址 */
  endorser: string;
  /** 推荐时间（区块号） */
  endorsedAt: number;
  /** 是否仍然有效 */
  isActive: boolean;
}

/**
 * 函数级详细中文注释：买家信用详情接口（包含统计信息）
 */
export interface BuyerCreditDetail {
  /** 基础信用记录 */
  credit: BuyerCreditRecord;
  /** 单笔限额（USDT） */
  singleLimit: number;
  /** 每日限额（USDT） */
  dailyLimit: number;
  /** 冷却期（小时） */
  cooldownHours: number;
  /** 今日已用额度（USDT） */
  todayUsed: number;
  /** 订单历史（最近20笔） */
  orderHistory: BuyerOrderRecord[];
  /** 推荐人地址 */
  referrer: string | null;
  /** 背书记录 */
  endorsements: BuyerEndorsement[];
  /** 信任分组成 */
  trustBreakdown: {
    asset: number;
    age: number;
    activity: number;
    social: number;
    identity: number;
  };
}

// ==================== 做市商信用接口定义 ====================

/**
 * 函数级详细中文注释：做市商信用等级枚举
 */
export type MakerCreditLevel = 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze';

/**
 * 函数级详细中文注释：服务状态枚举
 */
export type ServiceStatus = 'Active' | 'Warning' | 'Suspended';

/**
 * 函数级详细中文注释：违约类型枚举
 */
export type DefaultType = 'Timeout' | 'Cancellation' | 'DisputeLoss' | 'InsufficientFund';

/**
 * 函数级详细中文注释：做市商信用记录接口
 */
export interface MakerCreditRecord {
  /** 做市商ID */
  makerId: number;
  /** 当前信用分（800-1000） */
  creditScore: number;
  /** 信用等级 */
  level: MakerCreditLevel;
  /** 服务状态 */
  status: ServiceStatus;
  /** 总订单数 */
  totalOrders: number;
  /** 完成订单数 */
  completedOrders: number;
  /** 超时订单数 */
  timeoutOrders: number;
  /** 取消订单数 */
  cancelledOrders: number;
  /** 及时释放订单数（< 24h） */
  timelyReleaseOrders: number;
  /** 买家评分总和 */
  ratingSum: number;
  /** 评分次数 */
  ratingCount: number;
  /** 平均响应时间（秒） */
  avgResponseTime: number;
  /** 违约次数 */
  defaultCount: number;
  /** 争议失败次数 */
  disputeLossCount: number;
  /** 最后一次违约区块 */
  lastDefaultBlock: number | null;
  /** 最后一次订单区块 */
  lastOrderBlock: number;
  /** 连续服务天数 */
  consecutiveDays: number;
}

/**
 * 函数级详细中文注释：评价记录接口
 */
export interface MakerRating {
  /** 买家地址 */
  buyer: string;
  /** 评分（1-5星） */
  stars: number;
  /** 评价标签代码 */
  tagsCodes: number[];
  /** 评价时间（区块号） */
  ratedAt: number;
}

/**
 * 函数级详细中文注释：违约记录接口
 */
export interface MakerDefaultRecord {
  /** 违约类型 */
  defaultType: DefaultType;
  /** 违约区块 */
  block: number;
  /** 惩罚分数 */
  penaltyScore: number;
  /** 是否已恢复 */
  recovered: boolean;
}

/**
 * 函数级详细中文注释：做市商信用详情接口（包含统计信息）
 */
export interface MakerCreditDetail {
  /** 基础信用记录 */
  credit: MakerCreditRecord;
  /** 动态保证金要求（MEMO） */
  requiredDeposit: string;
  /** 保证金折扣系数（百分比） */
  depositDiscount: number;
  /** 履约率（百分比） */
  completionRate: number;
  /** 及时释放率（百分比） */
  timelyReleaseRate: number;
  /** 平均评分（1-5） */
  avgRating: number;
  /** 违约率（百分比） */
  defaultRate: number;
  /** 是否可接单 */
  canAcceptOrders: boolean;
}

// ==================== 买家信用查询函数 ====================

/**
 * 函数级详细中文注释：查询买家信用记录
 * 
 * @param api - Polkadot.js API 实例
 * @param account - 买家账户地址
 * @returns 买家信用记录（如果不存在返回 null）
 */
export async function getBuyerCredit(
  api: ApiPromise,
  account: string
): Promise<BuyerCreditRecord | null> {
  try {
    const creditData = await api.query.credit.buyerCredits(account);
    
    if (!creditData || (creditData as any).isEmpty) {
      return null;
    }
    
    const creditJson: any = creditData.toJSON();
    
    // 解析信用等级
    const levelKey = Object.keys(creditJson.level || {})[0] || 'newbie';
    const level = levelKey.charAt(0).toUpperCase() + levelKey.slice(1);
    
    // 解析新用户等级
    let newUserTier: NewUserTier | null = null;
    if (creditJson.newUserTier) {
      const tierKey = Object.keys(creditJson.newUserTier)[0];
      newUserTier = tierKey.charAt(0).toUpperCase() + tierKey.slice(1) as NewUserTier;
    }
    
    return {
      level: level as BuyerCreditLevel,
      newUserTier,
      completedOrders: creditJson.completedOrders || 0,
      totalVolume: creditJson.totalVolume || '0',
      defaultCount: creditJson.defaultCount || 0,
      disputeCount: creditJson.disputeCount || 0,
      lastPurchaseAt: creditJson.lastPurchaseAt || 0,
      riskScore: creditJson.riskScore || 1000,
      accountCreatedAt: creditJson.accountCreatedAt || 0,
    };
  } catch (error) {
    console.error('查询买家信用记录失败:', error);
    return null;
  }
}

/**
 * 函数级详细中文注释：查询买家完整信用详情
 * 
 * @param api - Polkadot.js API 实例
 * @param account - 买家账户地址
 * @param currentBlockNumber - 当前区块号
 * @returns 买家信用详情
 */
export async function getBuyerCreditDetail(
  api: ApiPromise,
  account: string,
  currentBlockNumber: number
): Promise<BuyerCreditDetail | null> {
  try {
    const credit = await getBuyerCredit(api, account);
    if (!credit) {
      return null;
    }
    
    // 查询订单历史
    const orderHistoryData = await api.query.credit.buyerOrderHistory(account);
    const orderHistory: BuyerOrderRecord[] = [];
    if (orderHistoryData && !(orderHistoryData as any).isEmpty) {
      const historyJson: any = orderHistoryData.toJSON();
      for (const record of historyJson || []) {
        orderHistory.push({
          amountUsdt: record.amountUsdt || 0,
          paymentTimeSeconds: record.paymentTimeSeconds || 0,
          createdAtBlock: record.createdAtBlock || 0,
        });
      }
    }
    
    // 查询推荐人
    const referrerData = await api.query.credit.buyerReferrer(account);
    const referrer = referrerData && !(referrerData as any).isEmpty 
      ? (referrerData as any).toString() 
      : null;
    
    // 查询背书记录
    const endorsementsData = await api.query.credit.buyerEndorsements(account);
    const endorsements: BuyerEndorsement[] = [];
    if (endorsementsData && !(endorsementsData as any).isEmpty) {
      const endorsementsJson: any = endorsementsData.toJSON();
      for (const record of endorsementsJson || []) {
        endorsements.push({
          endorser: record.endorser || '',
          endorsedAt: record.endorsedAt || 0,
          isActive: record.isActive || false,
        });
      }
    }
    
    // 计算限额
    const { singleLimit, dailyLimit, cooldownHours } = getBuyerLimits(credit);
    
    // 计算今日已用额度
    const blocksPerDay = 14400; // 假设每天14400个区块
    const currentDayKey = Math.floor(currentBlockNumber / blocksPerDay);
    const todayVolumeData = await api.query.credit.buyerDailyVolume(account, currentDayKey);
    const todayUsed = todayVolumeData ? (todayVolumeData.toJSON() as number || 0) : 0;
    
    // 计算信任分组成（这里简化处理，实际应该调用链上函数）
    const trustBreakdown = {
      asset: 25,
      age: credit.accountCreatedAt > 0 ? 20 : 0,
      activity: Math.min(20, credit.completedOrders * 2),
      social: endorsements.length * 5,
      identity: 0,
    };
    
    return {
      credit,
      singleLimit,
      dailyLimit,
      cooldownHours,
      todayUsed,
      orderHistory,
      referrer,
      endorsements,
      trustBreakdown,
    };
  } catch (error) {
    console.error('查询买家信用详情失败:', error);
    return null;
  }
}

/**
 * 函数级详细中文注释：计算买家限额
 */
function getBuyerLimits(credit: BuyerCreditRecord): { 
  singleLimit: number; 
  dailyLimit: number; 
  cooldownHours: number 
} {
  // 优先使用新用户限额（前20笔）
  if (credit.completedOrders < 20 && credit.newUserTier) {
    switch (credit.newUserTier) {
      case 'Premium':
        return { singleLimit: 5000, dailyLimit: 20000, cooldownHours: 0 };
      case 'Standard':
        return { singleLimit: 1000, dailyLimit: 5000, cooldownHours: 12 };
      case 'Basic':
        return { singleLimit: 500, dailyLimit: 2000, cooldownHours: 24 };
      case 'Restricted':
        return { singleLimit: 100, dailyLimit: 500, cooldownHours: 48 };
    }
  }
  
  // 使用等级限额
  switch (credit.level) {
    case 'Diamond':
      return { singleLimit: 50000, dailyLimit: 0, cooldownHours: 0 };
    case 'Gold':
      return { singleLimit: 10000, dailyLimit: 50000, cooldownHours: 0 };
    case 'Silver':
      return { singleLimit: 2000, dailyLimit: 10000, cooldownHours: 0 };
    case 'Bronze':
      return { singleLimit: 500, dailyLimit: 2000, cooldownHours: 0 };
    case 'Newbie':
    default:
      return { singleLimit: 100, dailyLimit: 500, cooldownHours: 0 };
  }
}

// ==================== 做市商信用查询函数 ====================

/**
 * 函数级详细中文注释：查询做市商信用记录
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 做市商信用记录（如果不存在返回 null）
 */
export async function getMakerCredit(
  api: ApiPromise,
  makerId: number
): Promise<MakerCreditRecord | null> {
  try {
    const creditData = await api.query.credit.makerCredits(makerId);
    
    if (!creditData || (creditData as any).isEmpty) {
      return null;
    }
    
    const creditJson: any = creditData.toJSON();
    
    // 解析信用等级
    const levelKey = Object.keys(creditJson.level || {})[0] || 'bronze';
    const level = levelKey.charAt(0).toUpperCase() + levelKey.slice(1);
    
    // 解析服务状态
    const statusKey = Object.keys(creditJson.status || {})[0] || 'active';
    const status = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
    
    return {
      makerId,
      creditScore: creditJson.creditScore || 820,
      level: level as MakerCreditLevel,
      status: status as ServiceStatus,
      totalOrders: creditJson.totalOrders || 0,
      completedOrders: creditJson.completedOrders || 0,
      timeoutOrders: creditJson.timeoutOrders || 0,
      cancelledOrders: creditJson.cancelledOrders || 0,
      timelyReleaseOrders: creditJson.timelyReleaseOrders || 0,
      ratingSum: creditJson.ratingSum || 0,
      ratingCount: creditJson.ratingCount || 0,
      avgResponseTime: creditJson.avgResponseTime || 0,
      defaultCount: creditJson.defaultCount || 0,
      disputeLossCount: creditJson.disputeLossCount || 0,
      lastDefaultBlock: creditJson.lastDefaultBlock || null,
      lastOrderBlock: creditJson.lastOrderBlock || 0,
      consecutiveDays: creditJson.consecutiveDays || 0,
    };
  } catch (error) {
    console.error('查询做市商信用记录失败:', error);
    return null;
  }
}

/**
 * 函数级详细中文注释：查询做市商完整信用详情
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 做市商信用详情
 */
export async function getMakerCreditDetail(
  api: ApiPromise,
  makerId: number
): Promise<MakerCreditDetail | null> {
  try {
    const credit = await getMakerCredit(api, makerId);
    if (!credit) {
      return null;
    }
    
    // 计算动态保证金折扣
    const depositDiscount = getMakerDepositDiscount(credit.level);
    
    // 计算统计数据
    const completionRate = credit.totalOrders > 0 
      ? Math.round((credit.completedOrders / credit.totalOrders) * 100) 
      : 100;
    
    const timelyReleaseRate = credit.completedOrders > 0 
      ? Math.round((credit.timelyReleaseOrders / credit.completedOrders) * 100) 
      : 0;
    
    const avgRating = credit.ratingCount > 0 
      ? credit.ratingSum / credit.ratingCount 
      : 0;
    
    const defaultRate = credit.totalOrders > 0 
      ? Math.round((credit.defaultCount / credit.totalOrders) * 100) 
      : 0;
    
    const canAcceptOrders = credit.status !== 'Suspended';
    
    // 基础保证金：1,000,000 DUST
    const baseDeposit = '1000000000000000000000000'; // 1,000,000 * 10^18
    const requiredDeposit = (BigInt(baseDeposit) * BigInt(depositDiscount) / BigInt(100)).toString();
    
    return {
      credit,
      requiredDeposit,
      depositDiscount,
      completionRate,
      timelyReleaseRate,
      avgRating,
      defaultRate,
      canAcceptOrders,
    };
  } catch (error) {
    console.error('查询做市商信用详情失败:', error);
    return null;
  }
}

/**
 * 函数级详细中文注释：获取做市商保证金折扣系数
 */
function getMakerDepositDiscount(level: MakerCreditLevel): number {
  switch (level) {
    case 'Diamond':
      return 50;  // 0.5x
    case 'Platinum':
      return 70;  // 0.7x
    case 'Gold':
      return 80;  // 0.8x
    case 'Silver':
      return 90;  // 0.9x
    case 'Bronze':
      return 100; // 1.0x
    default:
      return 100;
  }
}

/**
 * 函数级详细中文注释：查询做市商评价记录
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param orderId - 订单 ID
 * @returns 评价记录（如果不存在返回 null）
 */
export async function getMakerRating(
  api: ApiPromise,
  makerId: number,
  orderId: number
): Promise<MakerRating | null> {
  try {
    const ratingData = await api.query.credit.makerRatings(makerId, orderId);
    
    if (!ratingData || (ratingData as any).isEmpty) {
      return null;
    }
    
    const ratingJson: any = ratingData.toJSON();
    
    return {
      buyer: ratingJson.buyer || '',
      stars: ratingJson.stars || 0,
      tagsCodes: ratingJson.tagsCodes || [],
      ratedAt: ratingJson.ratedAt || 0,
    };
  } catch (error) {
    console.error('查询评价记录失败:', error);
    return null;
  }
}

/**
 * 函数级详细中文注释：查询做市商违约历史
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param orderId - 订单 ID
 * @returns 违约记录（如果不存在返回 null）
 */
export async function getMakerDefaultRecord(
  api: ApiPromise,
  makerId: number,
  orderId: number
): Promise<MakerDefaultRecord | null> {
  try {
    const defaultData = await api.query.credit.makerDefaultHistory(makerId, orderId);
    
    if (!defaultData || (defaultData as any).isEmpty) {
      return null;
    }
    
    const defaultJson: any = defaultData.toJSON();
    
    // 解析违约类型
    const typeKey = Object.keys(defaultJson.defaultType || {})[0] || 'timeout';
    let defaultType: DefaultType = 'Timeout';
    switch (typeKey.toLowerCase()) {
      case 'timeout':
        defaultType = 'Timeout';
        break;
      case 'cancellation':
        defaultType = 'Cancellation';
        break;
      case 'disputeloss':
        defaultType = 'DisputeLoss';
        break;
      case 'insufficientfund':
        defaultType = 'InsufficientFund';
        break;
    }
    
    return {
      defaultType,
      block: defaultJson.block || 0,
      penaltyScore: defaultJson.penaltyScore || 0,
      recovered: defaultJson.recovered || false,
    };
  } catch (error) {
    console.error('查询违约记录失败:', error);
    return null;
  }
}

// ==================== 显示信息辅助函数 ====================

/**
 * 函数级详细中文注释：获取买家信用等级显示信息
 */
export function getBuyerLevelInfo(level: BuyerCreditLevel) {
  switch (level) {
    case 'Diamond':
      return {
        name: '💎 钻石',
        color: '#00d9ff',
        bgColor: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
        desc: '101+笔订单，无限额',
      };
    case 'Gold':
      return {
        name: '🥇 黄金',
        color: '#ffd700',
        bgColor: 'linear-gradient(135deg, #ffd700 0%, #ccac00 100%)',
        desc: '51-100笔订单，高额度',
      };
    case 'Silver':
      return {
        name: '🥈 白银',
        color: '#c0c0c0',
        bgColor: 'linear-gradient(135deg, #c0c0c0 0%, #999999 100%)',
        desc: '21-50笔订单，中等额度',
      };
    case 'Bronze':
      return {
        name: '🥉 铜牌',
        color: '#cd7f32',
        bgColor: 'linear-gradient(135deg, #cd7f32 0%, #a66328 100%)',
        desc: '6-20笔订单，基础额度',
      };
    case 'Newbie':
    default:
      return {
        name: '🆕 新手',
        color: '#666666',
        bgColor: 'linear-gradient(135deg, #666666 0%, #444444 100%)',
        desc: '0-5笔订单，新手额度',
      };
  }
}

/**
 * 函数级详细中文注释：获取做市商信用等级显示信息
 */
export function getMakerLevelInfo(level: MakerCreditLevel) {
  switch (level) {
    case 'Diamond':
      return {
        name: '💎 钻石',
        color: '#00d9ff',
        bgColor: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
        desc: '950-1000分，顶级服务质量',
        depositDiscount: '50%',
      };
    case 'Platinum':
      return {
        name: '💍 铂金',
        color: '#b4b4dc',
        bgColor: 'linear-gradient(135deg, #b4b4dc 0%, #8e8eb8 100%)',
        desc: '900-949分，优秀服务质量',
        depositDiscount: '30%',
      };
    case 'Gold':
      return {
        name: '🥇 黄金',
        color: '#ffd700',
        bgColor: 'linear-gradient(135deg, #ffd700 0%, #ccac00 100%)',
        desc: '850-899分，良好服务质量',
        depositDiscount: '20%',
      };
    case 'Silver':
      return {
        name: '🥈 白银',
        color: '#c0c0c0',
        bgColor: 'linear-gradient(135deg, #c0c0c0 0%, #999999 100%)',
        desc: '820-849分，标准服务质量',
        depositDiscount: '10%',
      };
    case 'Bronze':
    default:
      return {
        name: '🥉 青铜',
        color: '#cd7f32',
        bgColor: 'linear-gradient(135deg, #cd7f32 0%, #a66328 100%)',
        desc: '800-819分，基础服务质量',
        depositDiscount: '0%',
      };
  }
}

/**
 * 函数级详细中文注释：获取服务状态显示信息
 */
export function getServiceStatusInfo(status: ServiceStatus) {
  switch (status) {
    case 'Active':
      return {
        name: '✅ 正常服务',
        color: 'success',
        desc: '信用分 ≥ 800，可正常接单',
      };
    case 'Warning':
      return {
        name: '⚠️ 警告状态',
        color: 'warning',
        desc: '信用分 750-799，即将暂停接单',
      };
    case 'Suspended':
      return {
        name: '🚫 暂停服务',
        color: 'error',
        desc: '信用分 < 750，暂停接单',
      };
    default:
      return {
        name: '❓ 未知状态',
        color: 'default',
        desc: '无法获取服务状态',
      };
  }
}

/**
 * 函数级详细中文注释：获取评价标签名称
 */
export function getRatingTagName(tagCode: number): string {
  const tags = [
    '快速释放',      // 0
    '沟通良好',      // 1
    '价格合理',      // 2
    '释放慢',        // 3
    '沟通差',        // 4
    '不回应',        // 5
  ];
  return tags[tagCode] || '未知';
}

/**
 * 函数级详细中文注释：获取违约类型名称
 */
export function getDefaultTypeName(type: DefaultType): string {
  switch (type) {
    case 'Timeout':
      return '订单超时';
    case 'Cancellation':
      return '恶意取消';
    case 'DisputeLoss':
      return '争议败诉';
    case 'InsufficientFund':
      return '保证金不足';
    default:
      return '未知类型';
  }
}

