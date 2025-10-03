import type { ApiPromise } from '@polkadot/api'

/**
 * 墓地治理服务
 * 用于墓地的强制治理操作
 */

/**
 * 墓地信息接口
 */
export interface GraveInfo {
  id: number
  owner: string
  name: string
  parkId: number | null
  active: boolean
  restricted: boolean
  removed: boolean
}

/**
 * 治理操作类型
 */
export const GraveGovernanceActions = {
  Transfer: 'transfer',      // 强制转让
  SetRestricted: 'restrict', // 设置受限
  Remove: 'remove',          // 软删除
  Restore: 'restore'         // 恢复
}

/**
 * 创建墓地强制转让交易
 */
export function createGraveTransferTx(
  api: ApiPromise,
  graveId: number,
  newOwner: string,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govTransferGrave || pallet.gov_transfer_grave
  return method(graveId, newOwner, evidenceCid)
}

/**
 * 创建设置受限交易
 */
export function createGraveSetRestrictedTx(
  api: ApiPromise,
  graveId: number,
  restricted: boolean,
  reasonCode: number,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govSetRestricted || pallet.gov_set_restricted
  return method(graveId, restricted, reasonCode, evidenceCid)
}

/**
 * 创建墓地移除交易
 */
export function createGraveRemoveTx(
  api: ApiPromise,
  graveId: number,
  reasonCode: number,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govRemoveGrave || pallet.gov_remove_grave
  return method(graveId, reasonCode, evidenceCid)
}

/**
 * 创建墓地恢复交易
 */
export function createGraveRestoreTx(
  api: ApiPromise,
  graveId: number,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govRestoreGrave || pallet.gov_restore_grave
  return method(graveId, evidenceCid)
}

/**
 * 获取墓地pallet（支持多种命名）
 */
function getPallet(api: ApiPromise): any {
  const candidates = ['memoGrave', 'memo_grave', 'grave']
  
  for (const name of candidates) {
    if ((api.tx as any)[name]) {
      return (api.tx as any)[name]
    }
  }
  
  throw new Error('Grave pallet未找到')
}

/**
 * 检查墓地pallet是否可用
 */
export function isGravePalletAvailable(api: ApiPromise): boolean {
  const candidates = ['memoGrave', 'memo_grave', 'grave']
  return candidates.some(name => !!(api.tx as any)[name])
}

