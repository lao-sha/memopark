/**
 * 会员定价工具函数
 *
 * 🆕 2025-11-10：支持 USDT 固定定价 + DUST 动态计算
 *
 * 核心功能：
 * - USDT 固定价格定义
 * - DUST 市场价格查询
 * - 动态 DUST 数量计算
 * - 价格格式化工具
 */

import { getApi } from '../lib/polkadot-safe'

/**
 * 会员等级 USDT 固定价格（美元）
 */
export const MEMBERSHIP_USDT_PRICES = {
  0: 50,    // Year1: $50 USD
  1: 100,   // Year3: $100 USD
  2: 200,   // Year5: $200 USD
  3: 300,   // Year10: $300 USD
} as const

/**
 * 会员等级配置
 */
export const MEMBERSHIP_LEVELS = [
  {
    id: 0,
    name: 'Year1 年费会员',
    usdtPrice: 50,
    baseGenerations: 6,
    years: 1,
    color: '#faad14',
    bgColor: '#fffbe6',
    description: '适合体验用户，基础6代推荐奖励'
  },
  {
    id: 1,
    name: 'Year3 三年会员',
    usdtPrice: 100,
    baseGenerations: 9,
    years: 3,
    color: '#1890ff',
    bgColor: '#e6f7ff',
    description: '性价比之选，基础9代推荐奖励'
  },
  {
    id: 2,
    name: 'Year5 五年会员',
    usdtPrice: 200,
    baseGenerations: 12,
    years: 5,
    color: '#722ed1',
    bgColor: '#f9f0ff',
    description: '长期用户优选，基础12代推荐奖励'
  },
  {
    id: 3,
    name: 'Year10 十年会员',
    usdtPrice: 300,
    baseGenerations: 15,
    years: 10,
    color: '#f5222d',
    bgColor: '#fff1f0',
    description: '最高性价比，满级15代推荐奖励'
  }
] as const

/**
 * 精度常量
 */
const DUST_UNITS = 1_000_000_000_000 // 10^12
const USDT_PRECISION = 1_000_000 // 10^6

/**
 * 获取 DUST 市场价格（USDT/DUST）
 *
 * @returns {Promise<number>} DUST 价格（精度 10^6）
 *
 * 示例：
 * - 返回 100 表示 0.0001 USDT/DUST
 * - 返回 200 表示 0.0002 USDT/DUST
 */
export async function getDustMarketPrice(): Promise<number> {
  try {
    const api = await getApi()
    const qroot: any = api.query as any
    const pricingSec = qroot.pricing

    if (!pricingSec || !pricingSec.getDustMarketPriceWeighted) {
      console.warn('pallet-pricing 未找到，使用默认价格')
      return 100 // 默认 0.0001 USDT/DUST
    }

    // 调用链上价格查询
    const priceRaw = await pricingSec.getDustMarketPriceWeighted()
    const price = Number(priceRaw.toString())

    if (price === 0) {
      console.warn('DUST 市场价格为 0，使用默认价格')
      return 100 // 默认 0.0001 USDT/DUST
    }

    return price
  } catch (e) {
    console.error('获取 DUST 市场价格失败', e)
    return 100 // 默认 0.0001 USDT/DUST
  }
}

/**
 * 将 DUST 市场价格转换为可读的 USDT 价格
 *
 * @param {number} rawPrice - 原始价格（精度 10^6）
 * @returns {number} 可读价格（USDT）
 *
 * 示例：
 * - 输入 100 → 输出 0.0001
 * - 输入 200 → 输出 0.0002
 */
export function formatDustPriceToUsdt(rawPrice: number): number {
  return rawPrice / USDT_PRECISION
}

/**
 * 计算购买指定等级会员所需的 DUST 数量
 *
 * @param {number} levelId - 会员等级 ID (0-3)
 * @param {number} dustMarketPrice - DUST 市场价格（精度 10^6）
 * @returns {number} 所需 DUST 数量（含精度）
 *
 * 计算公式：
 * 需要DUST = (USDT价格 × USDT_PRECISION × DUST_UNITS) / DUST市场价格
 *
 * 示例：
 * - Year1 ($50) × 0.0001 USDT/DUST = 500,000 DUST
 * - Year3 ($100) × 0.0001 USDT/DUST = 1,000,000 DUST
 */
export function calculateRequiredDust(
  levelId: number,
  dustMarketPrice: number
): number {
  const usdtPrice = MEMBERSHIP_USDT_PRICES[levelId as keyof typeof MEMBERSHIP_USDT_PRICES]

  if (!usdtPrice) {
    throw new Error(`Invalid level ID: ${levelId}`)
  }

  if (dustMarketPrice === 0) {
    throw new Error('DUST market price is zero')
  }

  // 需要DUST = (USDT价格 × USDT_PRECISION × DUST_UNITS) / DUST市场价格
  const requiredDust = (usdtPrice * USDT_PRECISION * DUST_UNITS) / dustMarketPrice

  return requiredDust
}

/**
 * 格式化 DUST 数量为可读格式（带千分位分隔符）
 *
 * @param {number} dustAmount - DUST 数量（含精度）
 * @param {number} [decimals=0] - 小数位数
 * @returns {string} 格式化后的字符串
 *
 * 示例：
 * - 输入 500000000000000000 → 输出 "500,000"
 * - 输入 1000000000000000000 → 输出 "1,000,000"
 */
export function formatDustAmount(dustAmount: number, decimals: number = 0): string {
  const dustUnits = dustAmount / DUST_UNITS
  return dustUnits.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * 格式化 USDT 价格为货币格式
 *
 * @param {number} usdtPrice - USDT 价格（美元）
 * @returns {string} 格式化后的字符串（例如："$50"）
 */
export function formatUsdtPrice(usdtPrice: number): string {
  return `$${usdtPrice.toLocaleString('en-US')}`
}

/**
 * 计算价格变化百分比
 *
 * @param {number} oldPrice - 旧价格
 * @param {number} newPrice - 新价格
 * @returns {number} 变化百分比（正数表示上涨，负数表示下跌）
 *
 * 示例：
 * - (100, 120) → 20 (上涨20%)
 * - (100, 80) → -20 (下跌20%)
 */
export function calculatePriceChange(oldPrice: number, newPrice: number): number {
  if (oldPrice === 0) return 0
  return ((newPrice - oldPrice) / oldPrice) * 100
}

/**
 * 验证市场价格合理性
 *
 * @param {number} price - 市场价格（精度 10^6）
 * @returns {boolean} 是否合理
 *
 * 合理范围：0.00001 - 0.01 USDT/DUST (10 - 10,000)
 */
export function isValidMarketPrice(price: number): boolean {
  return price >= 10 && price <= 10_000
}

/**
 * 获取会员等级配置
 *
 * @param {number} levelId - 会员等级 ID (0-3)
 * @returns {typeof MEMBERSHIP_LEVELS[number] | null} 会员等级配置
 */
export function getMembershipLevel(levelId: number) {
  return MEMBERSHIP_LEVELS.find(level => level.id === levelId) || null
}

/**
 * 完整的会员价格信息类型
 */
export interface MembershipPriceInfo {
  levelId: number
  levelName: string
  usdtPrice: number
  usdtPriceFormatted: string
  dustMarketPrice: number
  dustMarketPriceUsdt: number
  requiredDust: number
  requiredDustFormatted: string
  isMarketPriceValid: boolean
}

/**
 * 获取完整的会员价格信息
 *
 * @param {number} levelId - 会员等级 ID (0-3)
 * @param {number} dustMarketPrice - DUST 市场价格（精度 10^6）
 * @returns {MembershipPriceInfo} 完整价格信息
 */
export function getMembershipPriceInfo(
  levelId: number,
  dustMarketPrice: number
): MembershipPriceInfo {
  const level = getMembershipLevel(levelId)

  if (!level) {
    throw new Error(`Invalid level ID: ${levelId}`)
  }

  const requiredDust = calculateRequiredDust(levelId, dustMarketPrice)

  return {
    levelId,
    levelName: level.name,
    usdtPrice: level.usdtPrice,
    usdtPriceFormatted: formatUsdtPrice(level.usdtPrice),
    dustMarketPrice,
    dustMarketPriceUsdt: formatDustPriceToUsdt(dustMarketPrice),
    requiredDust,
    requiredDustFormatted: formatDustAmount(requiredDust),
    isMarketPriceValid: isValidMarketPrice(dustMarketPrice)
  }
}
