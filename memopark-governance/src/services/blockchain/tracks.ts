import type { ApiPromise } from '@polkadot/api'

/**
 * 轨道服务
 * 用于OpenGov轨道系统管理
 */

/**
 * 轨道信息接口
 */
export interface TrackInfo {
  id: number
  name: string
  maxDeciding: number
  decisionDeposit: string
  preparePeriod: number
  decisionPeriod: number
  confirmPeriod: number
  minEnactmentPeriod: number
  minApproval: any
  minSupport: any
}

/**
 * 轨道元数据（名称、描述、颜色等）
 */
export interface TrackMetadata {
  id: number
  name: string
  description: string
  riskLevel: number  // 1-5
  category: 'system' | 'treasury' | 'governance' | 'business'
}

/**
 * 默认轨道配置（如果链上未配置）
 */
export const DEFAULT_TRACKS: TrackMetadata[] = [
  {
    id: 0,
    name: 'Root',
    description: '系统升级、危险调用',
    riskLevel: 5,
    category: 'system'
  },
  {
    id: 1,
    name: 'Whitelisted Caller',
    description: '白名单调用',
    riskLevel: 4,
    category: 'system'
  },
  {
    id: 2,
    name: 'Treasurer',
    description: '财库支出、预算分配',
    riskLevel: 4,
    category: 'treasury'
  },
  {
    id: 3,
    name: 'Medium Spender',
    description: '中等金额支出（1K-10K MEMO）',
    riskLevel: 3,
    category: 'treasury'
  },
  {
    id: 4,
    name: 'Big Spender',
    description: '大额支出（>10K MEMO）',
    riskLevel: 4,
    category: 'treasury'
  },
  {
    id: 10,
    name: 'Market Maker',
    description: '做市商治理、审批',
    riskLevel: 3,
    category: 'business'
  },
  {
    id: 11,
    name: 'Arbitration',
    description: '仲裁裁决、争议解决',
    riskLevel: 3,
    category: 'business'
  },
  {
    id: 20,
    name: 'Content Governance',
    description: '内容治理、申诉处理',
    riskLevel: 2,
    category: 'governance'
  },
  {
    id: 21,
    name: 'Park Management',
    description: '陵园治理、配置管理',
    riskLevel: 2,
    category: 'business'
  }
]

/**
 * 获取所有轨道配置
 */
export async function getTracks(api: ApiPromise): Promise<TrackInfo[]> {
  try {
    // 检查referenda pallet是否存在
    if (!(api.consts as any).referenda) {
      console.warn('[Tracks] Referenda pallet未配置，返回空数组')
      return []
    }

    // 从链上常量获取轨道配置
    const tracksConst: any = await (api.consts as any).referenda.tracks
    const tracksData = tracksConst.toJSON() as any[]

    console.log('[Tracks] 查询到', tracksData.length, '个轨道')

    // 解析轨道数据
    const tracks: TrackInfo[] = tracksData.map(([id, config]: any) => ({
      id,
      name: getTrackName(id),
      maxDeciding: config.maxDeciding || 0,
      decisionDeposit: config.decisionDeposit || '0',
      preparePeriod: config.preparePeriod || 0,
      decisionPeriod: config.decisionPeriod || 0,
      confirmPeriod: config.confirmPeriod || 0,
      minEnactmentPeriod: config.minEnactmentPeriod || 0,
      minApproval: config.minApproval,
      minSupport: config.minSupport
    }))

    return tracks
  } catch (e) {
    console.error('[Tracks] 获取轨道失败:', e)
    // 返回空数组而不是抛出错误
    return []
  }
}

/**
 * 获取轨道名称
 */
export function getTrackName(trackId: number): string {
  const track = DEFAULT_TRACKS.find((t) => t.id === trackId)
  return track?.name || `Track ${trackId}`
}

/**
 * 获取轨道描述
 */
export function getTrackDescription(trackId: number): string {
  const track = DEFAULT_TRACKS.find((t) => t.id === trackId)
  return track?.description || ''
}

/**
 * 获取轨道颜色
 */
export function getTrackColor(trackId: number): string {
  const colors: Record<number, string> = {
    0: 'red',         // Root - 红色（危险）
    1: 'orange',      // Whitelisted - 橙色
    2: 'green',       // Treasury - 绿色（财务）
    3: 'cyan',        // Medium Spender - 青色
    4: 'blue',        // Big Spender - 蓝色
    10: 'purple',     // Market Maker - 紫色
    11: 'magenta',    // Arbitration - 品红
    20: 'gold',       // Content - 金色
    21: 'lime'        // Park - 青柠
  }
  return colors[trackId] || 'default'
}

/**
 * 获取轨道图标名称
 */
export function getTrackIconName(trackId: number): string {
  const icons: Record<number, string> = {
    0: 'ThunderboltOutlined',     // Root
    1: 'SafetyOutlined',          // Whitelisted
    2: 'DollarOutlined',          // Treasury
    3: 'DollarOutlined',          // Medium Spender
    4: 'DollarOutlined',          // Big Spender
    10: 'GlobalOutlined',         // Market Maker
    11: 'FileTextOutlined',       // Arbitration
    20: 'SafetyOutlined',         // Content
    21: 'GlobalOutlined'          // Park
  }
  return icons[trackId] || 'FileTextOutlined'
}

/**
 * 获取轨道风险等级
 */
export function getTrackRiskLevel(trackId: number): number {
  const track = DEFAULT_TRACKS.find((t) => t.id === trackId)
  return track?.riskLevel || 3
}

/**
 * 获取轨道风险等级标签
 */
export function getTrackRiskLabel(riskLevel: number): string {
  const labels: Record<number, string> = {
    1: '极低',
    2: '低',
    3: '中等',
    4: '高',
    5: '极高'
  }
  return labels[riskLevel] || '未知'
}

/**
 * 获取轨道风险等级颜色
 */
export function getTrackRiskColor(riskLevel: number): string {
  const colors: Record<number, string> = {
    1: '#52c41a',  // 绿色
    2: '#1890ff',  // 蓝色
    3: '#faad14',  // 橙色
    4: '#ff7a45',  // 橙红色
    5: '#ff4d4f'   // 红色
  }
  return colors[riskLevel] || '#d9d9d9'
}

/**
 * 获取轨道类别
 */
export function getTrackCategory(trackId: number): string {
  const track = DEFAULT_TRACKS.find((t) => t.id === trackId)
  const categories = {
    system: '系统',
    treasury: '财务',
    governance: '治理',
    business: '业务'
  }
  return track ? categories[track.category] : '其他'
}

/**
 * 格式化区块数为天/小时
 */
export function formatBlocks(blocks: number): string {
  const BLOCKS_PER_DAY = 14400 // 假设6秒一个区块
  const BLOCKS_PER_HOUR = 600

  if (blocks >= BLOCKS_PER_DAY) {
    const days = Math.floor(blocks / BLOCKS_PER_DAY)
    return `${days}天`
  } else if (blocks >= BLOCKS_PER_HOUR) {
    const hours = Math.floor(blocks / BLOCKS_PER_HOUR)
    return `${hours}小时`
  } else {
    return `${blocks}区块`
  }
}

