import type { ApiPromise } from '@polkadot/api'

/**
 * 陵园治理服务
 * 用于陵园的强制治理操作
 */

/**
 * 陵园信息接口
 */
export interface ParkInfo {
  id: number
  owner: string
  adminGroup: number | null
  countryIso2: string
  regionCode: string
  metadataCid: string
  active: boolean
}

/**
 * 治理操作类型
 */
export const ParkGovernanceActions = {
  Update: 'update',          // 强制更新
  SetAdmin: 'set_admin',     // 设置管理员
  Transfer: 'transfer',      // 强制转让
  SetCover: 'set_cover'      // 设置封面
}

/**
 * 创建陵园强制更新交易
 */
export function createParkUpdateTx(
  api: ApiPromise,
  parkId: number,
  regionCode: string | null,
  metadataCid: string | null,
  active: boolean | null,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govUpdatePark || pallet.gov_update_park
  return method(parkId, regionCode, metadataCid, active, evidenceCid)
}

/**
 * 创建设置管理员交易
 */
export function createParkSetAdminTx(
  api: ApiPromise,
  parkId: number,
  adminGroup: number | null,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govSetParkAdmin || pallet.gov_set_park_admin
  return method(parkId, adminGroup, evidenceCid)
}

/**
 * 创建陵园强制转让交易
 */
export function createParkTransferTx(
  api: ApiPromise,
  parkId: number,
  newOwner: string,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govTransferPark || pallet.gov_transfer_park
  return method(parkId, newOwner, evidenceCid)
}

/**
 * 创建设置封面交易
 */
export function createParkSetCoverTx(
  api: ApiPromise,
  parkId: number,
  coverCid: string | null,
  evidenceCid: string
) {
  const pallet = getPallet(api)
  const method = pallet.govSetParkCover || pallet.gov_set_park_cover
  return method(parkId, coverCid, evidenceCid)
}

/**
 * 获取陵园pallet（支持多种命名）
 */
function getPallet(api: ApiPromise): any {
  const candidates = ['memoPark', 'memo_park', 'park']
  
  for (const name of candidates) {
    if ((api.tx as any)[name]) {
      return (api.tx as any)[name]
    }
  }
  
  throw new Error('Park pallet未找到')
}

/**
 * 检查陵园pallet是否可用
 */
export function isParkPalletAvailable(api: ApiPromise): boolean {
  const candidates = ['memoPark', 'memo_park', 'park']
  return candidates.some(name => !!(api.tx as any)[name])
}

