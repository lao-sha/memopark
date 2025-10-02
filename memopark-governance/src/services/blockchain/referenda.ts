import type { ApiPromise } from '@polkadot/api'

/**
 * 公投（Referenda）服务
 * 用于OpenGov公投管理
 */

/**
 * 公投信息接口
 */
export interface ReferendumInfo {
  id: number
  trackId: number
  origin: any
  proposal: {
    hash: string
    inline?: any
    lookup?: any
  }
  enactment: any
  submitted: number
  submissionDeposit: {
    who: string
    amount: string
  }
  decisionDeposit: {
    who: string
    amount: string
  } | null
  deciding: {
    since: number
    confirming: number | null
  } | null
  tally: {
    ayes: string
    nays: string
    support: string
  }
  inQueue: boolean
  alarm: any
}

/**
 * 公投状态枚举
 */
export const ReferendumStatus = {
  Ongoing: 'Ongoing',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Cancelled: 'Cancelled',
  TimedOut: 'TimedOut',
  Killed: 'Killed'
}

/**
 * 获取所有公投
 */
export async function getAllReferenda(api: ApiPromise): Promise<ReferendumInfo[]> {
  try {
    // 检查referenda pallet是否存在
    if (!(api.query as any).referenda) {
      console.warn('[Referenda] Pallet未配置')
      return []
    }

    // 获取公投总数
    const count: any = await (api.query as any).referenda.referendumCount()
    const total = Number(count.toString())

    console.log('[Referenda] 公投总数:', total)

    const referenda: ReferendumInfo[] = []

    // 遍历查询公投（查询最近100个）
    const start = Math.max(0, total - 100)
    for (let id = total - 1; id >= start; id--) {
      const refOption: any = await (api.query as any).referenda.referendumInfoFor(id)

      if (refOption.isSome) {
        const refInfo = refOption.unwrap()
        const refData = refInfo.toJSON() as any

        // 只处理Ongoing状态的公投
        if (refData.ongoing) {
          const ongoing = refData.ongoing

          referenda.push({
            id,
            trackId: ongoing.track || 0,
            origin: ongoing.origin,
            proposal: ongoing.proposal || { hash: '' },
            enactment: ongoing.enactment,
            submitted: ongoing.submitted || 0,
            submissionDeposit: ongoing.submissionDeposit || { who: '', amount: '0' },
            decisionDeposit: ongoing.decisionDeposit,
            deciding: ongoing.deciding,
            tally: ongoing.tally || { ayes: '0', nays: '0', support: '0' },
            inQueue: ongoing.inQueue || false,
            alarm: ongoing.alarm
          })
        }
      }

      if (referenda.length >= 50) break // 最多返回50个
    }

    console.log('[Referenda] 查询到', referenda.length, '个进行中的公投')
    return referenda

  } catch (e) {
    console.error('[Referenda] 获取公投失败:', e)
    return []
  }
}

/**
 * 按轨道获取公投
 */
export async function getReferendumsByTrack(
  api: ApiPromise,
  trackId: number
): Promise<ReferendumInfo[]> {
  const all = await getAllReferenda(api)
  return all.filter((r) => r.trackId === trackId)
}

/**
 * 获取单个公投详情
 */
export async function getReferendumInfo(
  api: ApiPromise,
  refId: number
): Promise<ReferendumInfo | null> {
  try {
    if (!(api.query as any).referenda) {
      return null
    }

    const refOption: any = await (api.query as any).referenda.referendumInfoFor(refId)

    if (refOption.isNone) {
      return null
    }

    const refInfo = refOption.unwrap()
    const refData = refInfo.toJSON() as any

    if (!refData.ongoing) {
      return null
    }

    const ongoing = refData.ongoing

    return {
      id: refId,
      trackId: ongoing.track || 0,
      origin: ongoing.origin,
      proposal: ongoing.proposal || { hash: '' },
      enactment: ongoing.enactment,
      submitted: ongoing.submitted || 0,
      submissionDeposit: ongoing.submissionDeposit || { who: '', amount: '0' },
      decisionDeposit: ongoing.decisionDeposit,
      deciding: ongoing.deciding,
      tally: ongoing.tally || { ayes: '0', nays: '0', support: '0' },
      inQueue: ongoing.inQueue || false,
      alarm: ongoing.alarm
    }
  } catch (e) {
    console.error('[Referenda] 获取公投详情失败:', e)
    return null
  }
}

/**
 * 计算批准率
 */
export function calculateApproval(tally: {
  ayes: string
  nays: string
  support: string
}): number {
  const ayes = BigInt(tally.ayes)
  const nays = BigInt(tally.nays)
  const total = ayes + nays

  if (total === BigInt(0)) return 0

  return Number((ayes * BigInt(10000)) / total) / 100
}

/**
 * 计算支持率
 */
export function calculateSupport(tally: {
  ayes: string
  nays: string
  support: string
}): number {
  const support = BigInt(tally.support)
  // 这里需要总发行量，简化处理
  return Number(support) / 1000000 // 简化计算
}

/**
 * 获取公投状态文本
 */
export function getReferendumStatusText(referendum: ReferendumInfo): string {
  if (referendum.deciding) {
    if (referendum.deciding.confirming !== null) {
      return '确认期'
    }
    return '决策期'
  }

  if (referendum.inQueue) {
    return '队列中'
  }

  return '准备期'
}

/**
 * 获取公投状态颜色
 */
export function getReferendumStatusColor(referendum: ReferendumInfo): string {
  if (referendum.deciding) {
    if (referendum.deciding.confirming !== null) {
      return 'blue'
    }
    return 'green'
  }

  if (referendum.inQueue) {
    return 'orange'
  }

  return 'cyan'
}

/**
 * 格式化Origin
 */
export function formatOrigin(origin: any): string {
  if (!origin) return '未知'

  if (typeof origin === 'string') return origin

  // 处理系统Origin
  if (origin.system) {
    return 'Root'
  }

  // 处理Origins
  if (origin.origins) {
    return origin.origins
  }

  return JSON.stringify(origin)
}

/**
 * 获取Preimage哈希
 */
export function getPreimageHash(proposal: any): string {
  if (!proposal) return ''

  if (proposal.lookup && proposal.lookup.hash) {
    return proposal.lookup.hash
  }

  if (proposal.hash) {
    return proposal.hash
  }

  return ''
}

