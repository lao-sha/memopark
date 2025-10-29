import type { ApiPromise } from '@polkadot/api'

/**
 * 仲裁服务
 * 用于争议案件管理和裁决
 */

/**
 * 争议案件信息接口
 */
export interface DisputeInfo {
  id: number
  domain: number
  orderId: number
  buyer: string
  seller: string
  amount: string
  status: string
  reason: string
  createdAt: number
  decidedAt?: number
  decision?: string
}

/**
 * 案件状态枚举
 */
export const DisputeStatus = {
  Pending: 'Pending',      // 待裁决
  Resolved: 'Resolved',    // 已裁决
  Cancelled: 'Cancelled'   // 已取消
}

/**
 * 裁决决定枚举
 */
export const Decision = {
  RefundBuyer: 'RefundBuyer',           // 全额退款给买家
  PaySeller: 'PaySeller',               // 全额支付给卖家
  PartialRefund: 'PartialRefund'        // 部分退款
}

/**
 * 获取所有争议案件
 */
export async function getAllDisputes(api: ApiPromise): Promise<DisputeInfo[]> {
  try {
    // 检查arbitration pallet是否存在
    if (!(api.query as any).arbitration) {
      console.warn('[Arbitration] Pallet未配置')
      return []
    }

    // 获取下一个ID（简化查询）
    const disputes: DisputeInfo[] = []
    
    // 这里应该从链上查询实际数据
    // 当前返回示例数据（演示用）
    console.log('[Arbitration] Pallet已配置，但需要实际数据查询实现')
    
    return disputes
  } catch (e) {
    console.error('[Arbitration] 获取争议失败:', e)
    return []
  }
}

/**
 * 获取待裁决案件
 */
export async function getPendingDisputes(api: ApiPromise): Promise<DisputeInfo[]> {
  const all = await getAllDisputes(api)
  return all.filter(d => d.status === DisputeStatus.Pending)
}

/**
 * 获取已裁决案件
 */
export async function getResolvedDisputes(api: ApiPromise): Promise<DisputeInfo[]> {
  const all = await getAllDisputes(api)
  return all.filter(d => d.status === DisputeStatus.Resolved)
}

/**
 * 创建裁决交易
 */
export function createArbitrateTx(
  api: ApiPromise,
  domain: number,
  orderId: number,
  decision: string
) {
  return (api.tx as any).arbitration.arbitrate(domain, orderId, decision)
}

/**
 * 域类型标签
 */
export const DomainLabels: Record<number, string> = {
  0: '未知',
  1: '订单',
  2: 'OTC',
  3: '其他'
}

/**
 * 裁决标签
 */
export const DecisionLabels: Record<string, string> = {
  RefundBuyer: '全额退款给买家',
  PaySeller: '全额支付给卖家',
  PartialRefund: '部分退款'
}

/**
 * 裁决颜色
 */
export const DecisionColors: Record<string, string> = {
  RefundBuyer: 'green',
  PaySeller: 'blue',
  PartialRefund: 'orange'
}

