import type { ApiPromise } from '@polkadot/api'

/**
 * 内容治理服务
 * 用于申诉管理和审核
 */

/**
 * 申诉信息接口
 */
export interface AppealInfo {
  id: number
  domain: number
  target: number
  submitter: string
  deposit: string
  status: string
  reason_cid: string
  evidence_cid: string
  submitted_at: number
  notice_blocks?: number
  execute_at?: number
}

/**
 * 申诉状态枚举
 */
export const AppealStatus = {
  Submitted: 0,
  Approved: 1,
  Rejected: 2,
  Withdrawn: 3,
  Executed: 4,
  RetryExhausted: 5,
  AutoDismissed: 6
}

/**
 * 申诉状态标签
 */
export const AppealStatusLabels: Record<number, string> = {
  0: '已提交',
  1: '已批准',
  2: '已驳回',
  3: '已撤回',
  4: '已执行',
  5: '重试失败',
  6: '自动驳回'
}

/**
 * 申诉状态颜色
 */
export const AppealStatusColors: Record<number, string> = {
  0: 'orange',
  1: 'green',
  2: 'red',
  3: 'default',
  4: 'blue',
  5: 'volcano',
  6: 'magenta'
}

/**
 * 获取所有申诉列表
 */
export async function getAllAppeals(api: ApiPromise): Promise<AppealInfo[]> {
  try {
    // 检查pallet是否存在
    if (!(api.query as any).memoContentGovernance) {
      console.warn('[ContentGovernance] Pallet未注册')
      return []
    }

    // 获取下一个ID
    const nextId: any = await (api.query as any).memoContentGovernance.nextAppealId()
    const maxId = Number(nextId.toString())

    const appeals: AppealInfo[] = []
    const startId = Math.max(0, maxId - 100) // 查询最近100个

    for (let id = maxId - 1; id >= startId; id--) {
      const appealOption: any = await (api.query as any).memoContentGovernance.appeals(id)

      if (appealOption.isSome) {
        const appeal = appealOption.unwrap()
        const appealData = appeal.toJSON() as any

        appeals.push({
          id,
          domain: appealData.domain || 0,
          target: appealData.target || 0,
          submitter: appealData.submitter || '',
          deposit: appealData.deposit || '0',
          status: appealData.status || 'Submitted',
          reason_cid: appealData.reasonCid || appealData.reason_cid || '',
          evidence_cid: appealData.evidenceCid || appealData.evidence_cid || '',
          submitted_at: appealData.submittedAt || appealData.submitted_at || 0,
          notice_blocks: appealData.noticeBlocks || appealData.notice_blocks,
          execute_at: appealData.executeAt || appealData.execute_at
        })
      }

      if (appeals.length >= 100) break
    }

    console.log('[ContentGovernance] 查询到', appeals.length, '个申诉')
    return appeals

  } catch (e) {
    console.error('[ContentGovernance] 获取申诉失败:', e)
    throw e
  }
}

/**
 * 获取待审核申诉（status=0）
 */
export async function getPendingAppeals(api: ApiPromise): Promise<AppealInfo[]> {
  const all = await getAllAppeals(api)
  return all.filter((a) => {
    const status = typeof a.status === 'number' ? a.status : AppealStatus.Submitted
    return status === AppealStatus.Submitted
  })
}

/**
 * 获取已批准申诉（status=1）
 */
export async function getApprovedAppeals(api: ApiPromise): Promise<AppealInfo[]> {
  const all = await getAllAppeals(api)
  return all.filter((a) => {
    const status = typeof a.status === 'number' ? a.status : AppealStatus.Approved
    return status === AppealStatus.Approved
  })
}

/**
 * 获取已驳回申诉（status=2）
 */
export async function getRejectedAppeals(api: ApiPromise): Promise<AppealInfo[]> {
  const all = await getAllAppeals(api)
  return all.filter((a) => {
    const status = typeof a.status === 'number' ? a.status : AppealStatus.Rejected
    return status === AppealStatus.Rejected
  })
}

/**
 * 创建批准申诉交易
 */
export function createApproveAppealTx(
  api: ApiPromise,
  appealId: number,
  noticeBlocks?: number
) {
  return (api.tx as any).memoContentGovernance.approveAppeal(appealId, noticeBlocks)
}

/**
 * 创建驳回申诉交易
 */
export function createRejectAppealTx(api: ApiPromise, appealId: number) {
  return (api.tx as any).memoContentGovernance.rejectAppeal(appealId)
}

/**
 * 域类型标签
 */
export const DomainLabels: Record<number, string> = {
  0: '未知',
  1: '逝者',
  2: '墓地',
  3: '陵园',
  4: '媒体',
  5: '文本',
  6: 'OTC',
  7: '其他'
}

