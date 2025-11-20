/**
 * 墓位(Grave) API服务层
 *
 * 功能说明：
 * 1. 墓位信息查询和管理
 * 2. 主逝者查询和设置
 * 3. 墓位权限管理
 * 4. 安葬记录管理
 *
 * 创建日期：2025-11-10
 */

import type { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import type { Option, u64 } from '@polkadot/types-codec'
import type { AccountId32 } from '@polkadot/types/interfaces'

// ========================================
// TypeScript 接口定义
// ========================================

/**
 * 函数级详细中文注释：墓位基本信息
 */
export interface GraveInfo {
  id: number
  owner: string
  parkId?: number | null
  name?: string
  active?: boolean
  isPublic?: boolean
  adminGroup?: number | null
  primaryDeceasedId?: number | null
}

/**
 * 函数级详细中文注释：安葬记录
 */
export interface IntermentRecord {
  deceasedId: number
  slot: number
  time: number
  noteCid?: string | null
}

/**
 * 函数级详细中文注释：主逝者设置请求参数
 */
export interface PrimaryDeceasedRequest {
  graveId: number
  deceasedId?: number | null // null 表示清除主逝者
}

/**
 * 函数级详细中文注释：主逝者设置结果
 */
export interface PrimaryDeceasedResult {
  success: boolean
  graveId: number
  deceasedId?: number | null
  error?: string
}

// ========================================
// 核心服务类
// ========================================

/**
 * 函数级详细中文注释：墓位服务类
 *
 * 提供墓位管理的完整功能，包括：
 * - 墓位查询和管理
 * - 主逝者设置和查询
 * - 安葬记录管理
 * - 权限验证
 */
export class GraveService {
  private api: ApiPromise

  constructor(api: ApiPromise) {
    this.api = api
  }

  // ========================================
  // 墓位基本信息查询
  // ========================================

  /**
   * 函数级详细中文注释：获取墓位详细信息
   *
   * @param graveId 墓位ID
   * @returns 墓位信息，如果不存在返回 null
   */
  async getGraveInfo(graveId: number): Promise<GraveInfo | null> {
    try {
      const graveOption = await this.api.query.stardustGrave.graves(graveId)

      if (graveOption.isNone) {
        return null
      }

      const grave = graveOption.unwrap()
      const primaryDeceasedOption = await this.api.query.stardustGrave.primaryDeceasedOf(graveId)

      return {
        id: graveId,
        owner: grave.owner.toString(),
        parkId: grave.parkId?.isSome ? grave.parkId.unwrap().toNumber() : null,
        name: grave.name?.toString(),
        active: grave.active.isTrue,
        isPublic: grave.isPublic.isTrue,
        adminGroup: grave.adminGroup?.isSome ? grave.adminGroup.unwrap().toNumber() : null,
        primaryDeceasedId: primaryDeceasedOption.isSome ? primaryDeceasedOption.unwrap().toNumber() : null
      }
    } catch (error) {
      console.error('获取墓位信息失败:', error)
      return null
    }
  }

  /**
   * 函数级详细中文注释：批量获取墓位信息
   *
   * @param graveIds 墓位ID数组
   * @returns 墓位信息数组（过滤掉不存在的）
   */
  async getGraveInfoBatch(graveIds: number[]): Promise<GraveInfo[]> {
    const promises = graveIds.map(id => this.getGraveInfo(id))
    const results = await Promise.all(promises)
    return results.filter(info => info !== null) as GraveInfo[]
  }

  // ========================================
  // 主逝者管理功能
  // ========================================

  /**
   * 函数级详细中文注释：查询墓位的主逝者ID
   *
   * @param graveId 墓位ID
   * @returns 主逝者ID，如果未设置返回 null
   */
  async getPrimaryDeceasedId(graveId: number): Promise<number | null> {
    try {
      const primaryDeceasedOption = await this.api.query.stardustGrave.primaryDeceasedOf(graveId)
      return primaryDeceasedOption.isSome ? primaryDeceasedOption.unwrap().toNumber() : null
    } catch (error) {
      console.error('查询主逝者ID失败:', error)
      return null
    }
  }

  /**
   * 函数级详细中文注释：检查指定逝者是否为主逝者
   *
   * @param graveId 墓位ID
   * @param deceasedId 逝者ID
   * @returns true 表示是主逝者，false 表示不是
   */
  async isPrimaryDeceased(graveId: number, deceasedId: number): Promise<boolean> {
    const primaryId = await this.getPrimaryDeceasedId(graveId)
    return primaryId === deceasedId
  }

  /**
   * 函数级详细中文注释：批量查询多个墓位的主逝者
   *
   * @param graveIds 墓位ID数组
   * @returns Map<墓位ID, 主逝者ID | null>
   */
  async getPrimaryDeceasedBatch(graveIds: number[]): Promise<Map<number, number | null>> {
    const promises = graveIds.map(async graveId => ({
      graveId,
      primaryDeceasedId: await this.getPrimaryDeceasedId(graveId)
    }))

    const results = await Promise.all(promises)
    const map = new Map<number, number | null>()

    results.forEach(({ graveId, primaryDeceasedId }) => {
      map.set(graveId, primaryDeceasedId)
    })

    return map
  }

  /**
   * 函数级详细中文注释：创建设置主逝者的交易
   *
   * @param request 设置请求参数
   * @returns 可提交的 extrinsic
   */
  createSetPrimaryDeceasedTx(request: PrimaryDeceasedRequest): SubmittableExtrinsic<'promise'> {
    const { graveId, deceasedId } = request

    // deceasedId 为 null 时表示清除主逝者设置
    const param = deceasedId !== undefined && deceasedId !== null ? deceasedId : null

    return this.api.tx.stardustGrave.setPrimaryDeceased(graveId, param)
  }

  // ========================================
  // 安葬记录查询
  // ========================================

  /**
   * 函数级详细中文注释：获取墓位的所有安葬记录
   *
   * @param graveId 墓位ID
   * @returns 安葬记录数组
   */
  async getInterments(graveId: number): Promise<IntermentRecord[]> {
    try {
      const interments = await this.api.query.stardustGrave.interments(graveId)

      return interments.map(record => ({
        deceasedId: record.deceased_id.toNumber(),
        slot: record.slot.toNumber(),
        time: record.time.toNumber(),
        noteCid: record.note_cid?.isSome ? record.note_cid.unwrap().toString() : null
      }))
    } catch (error) {
      console.error('获取安葬记录失败:', error)
      return []
    }
  }

  /**
   * 函数级详细中文注释：获取墓位中的所有逝者ID
   *
   * @param graveId 墓位ID
   * @returns 逝者ID数组
   */
  async getDeceasedIds(graveId: number): Promise<number[]> {
    const interments = await this.getInterments(graveId)
    return interments.map(record => record.deceasedId)
  }

  /**
   * 函数级详细中文注释：检查逝者是否在墓位中
   *
   * @param graveId 墓位ID
   * @param deceasedId 逝者ID
   * @returns true 表示已安葬，false 表示未安葬
   */
  async isDeceasedInGrave(graveId: number, deceasedId: number): Promise<boolean> {
    const deceasedIds = await this.getDeceasedIds(graveId)
    return deceasedIds.includes(deceasedId)
  }

  // ========================================
  // 权限验证辅助函数
  // ========================================

  /**
   * 函数级详细中文注释：检查用户是否有管理墓位的权限
   *
   * @param graveId 墓位ID
   * @param userAddress 用户地址
   * @returns true 表示有权限，false 表示无权限
   */
  async canManageGrave(graveId: number, userAddress: string): Promise<boolean> {
    try {
      const graveInfo = await this.getGraveInfo(graveId)
      if (!graveInfo) return false

      // 检查是否为墓位owner
      if (graveInfo.owner === userAddress) return true

      // 检查是否为墓位管理员
      const admins = await this.api.query.stardustGrave.graveAdmins(graveId)
      const adminList = admins.map(admin => admin.toString())
      if (adminList.includes(userAddress)) return true

      // 检查是否为园区管理员（这里简化处理，实际可能需要更复杂的检查）
      if (graveInfo.parkId) {
        // TODO: 检查园区管理员权限
        // const isParParkAdmin = await this.api.query.someModule.checkParkAdmin(graveInfo.parkId, userAddress)
        // return isParParkAdmin
      }

      return false
    } catch (error) {
      console.error('检查墓位管理权限失败:', error)
      return false
    }
  }

  // ========================================
  // 事件监听辅助函数
  // ========================================

  /**
   * 函数级详细中文注释：监听主逝者设置事件
   *
   * @param callback 事件回调函数
   * @returns 取消监听的函数
   */
  subscribeToePrimaryDeceasedEvents(
    callback: (event: { type: 'set' | 'cleared'; graveId: number; deceasedId?: number }) => void
  ): () => void {
    const unsubscribe = this.api.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record

        // 监听主逝者设置事件
        if (this.api.events.stardustGrave.PrimaryDeceasedSet.is(event)) {
          const [graveId, deceasedId] = event.data
          callback({
            type: 'set',
            graveId: graveId.toNumber(),
            deceasedId: deceasedId.toNumber()
          })
        }

        // 监听主逝者清除事件
        if (this.api.events.stardustGrave.PrimaryDeceasedCleared.is(event)) {
          const [graveId] = event.data
          callback({
            type: 'cleared',
            graveId: graveId.toNumber()
          })
        }
      })
    })

    return unsubscribe
  }
}

// ========================================
// 导出便捷函数
// ========================================

/**
 * 函数级详细中文注释：创建墓位服务实例
 *
 * @param api Polkadot API 实例
 * @returns 墓位服务实例
 */
export function createGraveService(api: ApiPromise): GraveService {
  return new GraveService(api)
}

/**
 * 函数级详细中文注释：便捷函数 - 检查是否有设置主逝者的权限
 *
 * @param api Polkadot API 实例
 * @param graveId 墓位ID
 * @param deceasedId 逝者ID
 * @param userAddress 用户地址
 * @returns 验证结果 { canSet: boolean, reason?: string }
 */
export async function validatePrimaryDeceasedSetting(
  api: ApiPromise,
  graveId: number,
  deceasedId: number,
  userAddress: string
): Promise<{ canSet: boolean; reason?: string }> {
  const graveService = createGraveService(api)

  // 检查墓位管理权限
  const canManage = await graveService.canManageGrave(graveId, userAddress)
  if (!canManage) {
    return { canSet: false, reason: '您没有管理此墓位的权限' }
  }

  // 检查逝者是否在墓位中
  const isInGrave = await graveService.isDeceasedInGrave(graveId, deceasedId)
  if (!isInGrave) {
    return { canSet: false, reason: '该逝者未安葬在此墓位中' }
  }

  return { canSet: true }
}

/**
 * 函数级详细中文注释：便捷函数 - 获取墓位的主逝者详细信息
 *
 * @param api Polkadot API 实例
 * @param graveId 墓位ID
 * @returns 主逝者信息 { deceasedId: number; isPrimary: true } 或 null
 */
export async function getPrimaryDeceasedInfo(
  api: ApiPromise,
  graveId: number
): Promise<{ deceasedId: number; isPrimary: true } | null> {
  const graveService = createGraveService(api)
  const primaryDeceasedId = await graveService.getPrimaryDeceasedId(graveId)

  if (primaryDeceasedId === null) {
    return null
  }

  return {
    deceasedId: primaryDeceasedId,
    isPrimary: true
  }
}

// ========================================
// React Hook 支持
// ========================================

/**
 * 函数级详细中文注释：React Hook 使用示例类型
 *
 * 注意：实际的 React Hook 应该在组件文件中定义
 * 这里仅提供类型定义作为参考
 */
export interface UsePrimaryDeceasedResult {
  primaryDeceasedId: number | null
  isPrimary: (deceasedId: number) => boolean
  setPrimaryDeceased: (deceasedId: number | null) => Promise<PrimaryDeceasedResult>
  loading: boolean
  error: string | null
}

/**
 * 函数级详细中文注释：墓位服务导出
 *
 * 使用示例：
 * ```typescript
 * import { createGraveService, validatePrimaryDeceasedSetting } from './services/graveService'
 *
 * const api = await getApi()
 * const graveService = createGraveService(api)
 *
 * // 查询主逝者
 * const primaryId = await graveService.getPrimaryDeceasedId(graveId)
 *
 * // 设置主逝者
 * const tx = graveService.createSetPrimaryDeceasedTx({ graveId, deceasedId })
 * await signAndSend(tx)
 *
 * // 权限验证
 * const { canSet, reason } = await validatePrimaryDeceasedSetting(api, graveId, deceasedId, userAddress)
 * ```
 */
export default GraveService