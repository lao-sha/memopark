/**
 * 做市商信用服务
 * 
 * 功能级详细中文注释：
 * 提供做市商信用查询功能，包括信用记录、违约历史、服务状态、评分详情等。
 * 
 * @module makerCreditService
 * @created 2025-10-22
 */

import { ApiPromise } from '@polkadot/api';

/**
 * 函数级详细中文注释：信用记录接口定义
 */
export interface CreditRecord {
  /** 做市商ID */
  makerId: number;
  /** 信用分（800-1000） */
  creditScore: number;
  /** 风险分（0-1000） */
  riskScore: number;
  /** 信用等级 */
  level: 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  /** 服务状态 */
  serviceStatus: 'Active' | 'Warning' | 'Suspended';
  /** 累计完成订单数 */
  totalOrders: number;
  /** 平均响应时间（秒） */
  avgResponseTime: number;
  /** 超时违约次数 */
  timeoutDefaults: number;
  /** 争议败诉次数 */
  disputeLosses: number;
  /** 最后更新时间戳 */
  lastUpdated: number;
  /** 上次衰减时间 */
  lastDecay: number;
}

/**
 * 函数级详细中文注释：违约历史接口定义
 */
export interface DefaultRecord {
  /** 违约类型 */
  defaultType: 'Timeout' | 'DisputeLoss';
  /** 订单ID */
  orderId: number;
  /** 违约时间戳 */
  timestamp: number;
  /** 信用分扣除 */
  creditDeducted: number;
  /** 风险分增加 */
  riskAdded: number;
  /** 是否在冷却期内 */
  inCooldown: boolean;
}

/**
 * 函数级详细中文注释：信用分组成明细接口
 */
export interface CreditBreakdown {
  /** 基础分 */
  baseScore: number;
  /** 履约表现（0-250） */
  fulfillmentScore: number;
  /** 服务质量（0-200） */
  serviceScore: number;
  /** 资金充足（0-150） */
  capitalScore: number;
  /** 活跃度（0-100） */
  activityScore: number;
  /** 买家评价（0-100） */
  ratingScore: number;
  /** 风险扣分 */
  riskDeduction: number;
  /** 总分 */
  totalScore: number;
}

/**
 * 函数级详细中文注释：查询做市商信用记录
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 信用记录
 * 
 * @example
 * ```typescript
 * const credit = await getCreditRecord(api, 1);
 * console.log('信用分:', credit.creditScore);
 * console.log('信用等级:', credit.level);
 * ```
 */
export async function getCreditRecord(
  api: ApiPromise,
  makerId: number
): Promise<CreditRecord | null> {
  try {
    const creditData = await api.query.makerCredit.credits(makerId);
    
    if (!creditData || creditData.isEmpty) {
      console.log('该做市商没有信用记录');
      return null;
    }
    
    const creditJson: any = creditData.toJSON();
    
    // 解析信用等级（enum）
    const levelKey = Object.keys(creditJson.level || {})[0] || 'Silver';
    const level = levelKey.charAt(0).toUpperCase() + levelKey.slice(1);
    
    // 解析服务状态（enum）
    const statusKey = Object.keys(creditJson.serviceStatus || {})[0] || 'Active';
    const serviceStatus = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
    
    return {
      makerId,
      creditScore: creditJson.creditScore || 800,
      riskScore: creditJson.riskScore || 0,
      level: level as any,
      serviceStatus: serviceStatus as any,
      totalOrders: creditJson.totalOrders || 0,
      avgResponseTime: creditJson.avgResponseTime || 0,
      timeoutDefaults: creditJson.timeoutDefaults || 0,
      disputeLosses: creditJson.disputeLosses || 0,
      lastUpdated: creditJson.lastUpdated || 0,
      lastDecay: creditJson.lastDecay || 0,
    };
  } catch (error) {
    console.error('查询信用记录失败:', error);
    throw new Error('查询信用记录失败');
  }
}

/**
 * 函数级详细中文注释：查询做市商违约历史
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 违约历史列表（最近30条）
 * 
 * @example
 * ```typescript
 * const history = await getDefaultHistory(api, 1);
 * console.log('违约次数:', history.length);
 * ```
 */
export async function getDefaultHistory(
  api: ApiPromise,
  makerId: number
): Promise<DefaultRecord[]> {
  try {
    const historyData = await api.query.makerCredit.defaultHistory(makerId);
    
    if (!historyData || historyData.isEmpty) {
      return [];
    }
    
    const historyJson: any = historyData.toJSON();
    
    // BoundedVec 解析
    const records = Array.isArray(historyJson) ? historyJson : [];
    
    return records.map((record: any) => {
      const typeKey = Object.keys(record.defaultType || {})[0] || 'Timeout';
      const defaultType = typeKey === 'timeout' ? 'Timeout' : 'DisputeLoss';
      
      return {
        defaultType,
        orderId: record.orderId || 0,
        timestamp: record.timestamp || 0,
        creditDeducted: defaultType === 'Timeout' ? 5 : 15,
        riskAdded: defaultType === 'Timeout' ? 10 : 30,
        inCooldown: false, // 需要额外计算
      };
    });
  } catch (error) {
    console.error('查询违约历史失败:', error);
    return [];
  }
}

/**
 * 函数级详细中文注释：计算信用分组成明细
 * 
 * @param credit - 信用记录
 * @returns 信用分组成明细
 * 
 * @example
 * ```typescript
 * const breakdown = getCreditBreakdown(credit);
 * console.log('履约表现:', breakdown.fulfillmentScore);
 * console.log('服务质量:', breakdown.serviceScore);
 * ```
 */
export function getCreditBreakdown(credit: CreditRecord): CreditBreakdown {
  // 函数级详细中文注释：基于信用记录计算各维度得分
  
  // 基础分
  const baseScore = 800;
  
  // 履约表现（0-250）
  const fulfillmentScore = Math.max(0, 250 - credit.timeoutDefaults * 5 - credit.disputeLosses * 15);
  
  // 服务质量（0-200）
  const serviceScore = credit.avgResponseTime > 0 
    ? Math.max(0, 200 - Math.floor(credit.avgResponseTime / 60) * 2)
    : 200;
  
  // 资金充足（0-150）- 假设所有做市商都有足够资金
  const capitalScore = 150;
  
  // 活跃度（0-100）
  const activityScore = Math.min(100, credit.totalOrders * 2);
  
  // 买家评价（0-100）- 暂时按完成订单数估算
  const ratingScore = Math.min(100, credit.totalOrders);
  
  // 风险扣分
  const riskDeduction = Math.floor(credit.riskScore / 10);
  
  // 总分
  const totalScore = Math.max(0, baseScore + fulfillmentScore + serviceScore + capitalScore + activityScore + ratingScore - riskDeduction);
  
  return {
    baseScore,
    fulfillmentScore,
    serviceScore,
    capitalScore,
    activityScore,
    ratingScore,
    riskDeduction,
    totalScore,
  };
}

/**
 * 函数级详细中文注释：获取信用等级显示信息
 * 
 * @param level - 信用等级
 * @returns 显示信息（名称、颜色、图标、描述）
 */
export function getLevelInfo(level: string) {
  switch (level) {
    case 'Diamond':
      return {
        name: '💎 钻石',
        color: '#00d9ff',
        bgColor: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
        desc: '950-1000分，顶级服务质量',
        minScore: 950,
      };
    case 'Platinum':
      return {
        name: '💍 铂金',
        color: '#b4b4dc',
        bgColor: 'linear-gradient(135deg, #b4b4dc 0%, #8e8eb8 100%)',
        desc: '900-949分，优秀服务质量',
        minScore: 900,
      };
    case 'Gold':
      return {
        name: '🥇 黄金',
        color: '#ffd700',
        bgColor: 'linear-gradient(135deg, #ffd700 0%, #ccac00 100%)',
        desc: '850-899分，良好服务质量',
        minScore: 850,
      };
    case 'Silver':
      return {
        name: '🥈 白银',
        color: '#c0c0c0',
        bgColor: 'linear-gradient(135deg, #c0c0c0 0%, #999999 100%)',
        desc: '800-849分，标准服务质量',
        minScore: 800,
      };
    case 'Bronze':
      return {
        name: '🥉 青铜',
        color: '#cd7f32',
        bgColor: 'linear-gradient(135deg, #cd7f32 0%, #a66328 100%)',
        desc: '750-799分，基础服务质量',
        minScore: 750,
      };
    default:
      return {
        name: '🥈 白银',
        color: '#c0c0c0',
        bgColor: 'linear-gradient(135deg, #c0c0c0 0%, #999999 100%)',
        desc: '800-849分，标准服务质量',
        minScore: 800,
      };
  }
}

/**
 * 函数级详细中文注释：获取服务状态显示信息
 * 
 * @param status - 服务状态
 * @returns 显示信息（名称、颜色、图标、描述）
 */
export function getStatusInfo(status: string) {
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
 * 函数级详细中文注释：计算风险分衰减进度
 * 
 * @param lastDecay - 上次衰减时间戳
 * @param currentTime - 当前时间戳
 * @returns 衰减进度（0-100%）
 */
export function getDecayProgress(lastDecay: number, currentTime: number): number {
  const DECAY_PERIOD = 30 * 24 * 60 * 60; // 30天（秒）
  const elapsed = currentTime - lastDecay;
  const progress = Math.min(100, (elapsed / DECAY_PERIOD) * 100);
  return Math.floor(progress);
}

/**
 * 函数级详细中文注释：格式化时间戳
 * 
 * @param timestamp - Unix 时间戳（秒）
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

