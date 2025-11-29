/**
 * 聊天权限场景服务
 *
 * 功能说明：
 * 1. 管理场景授权的创建和撤销
 * 2. 查询用户之间的场景授权列表
 * 3. 提供场景授权相关的交易构建方法
 * 4. 订阅场景授权相关事件
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

import { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import { getApi } from '../lib/polkadot-safe'
import {
  SceneType,
  SceneId,
  SceneIdType,
  SceneAuthorizationInfo,
  GrantSceneParams,
  RevokeSceneParams,
  createUserPair,
  createNoneSceneId,
  createNumericSceneId,
  ChatPermissionEventType,
  ChatPermissionEvent,
  SourcePalletIds,
} from '../types/chatPermission'

// ========== 类型定义 ==========

/**
 * 场景授权事件监听器
 */
export interface SceneEventListeners {
  /** 场景授权已授予 */
  onSceneAuthorizationGranted?: (event: {
    user1: string
    user2: string
    sceneType: SceneType
    sceneId: SceneId
  }) => void
  /** 场景授权已撤销 */
  onSceneAuthorizationRevoked?: (event: {
    user1: string
    user2: string
    sceneType: SceneType
    sceneId: SceneId
  }) => void
}

/**
 * 场景元数据创建参数
 */
export interface SceneMetadataParams {
  /** 订单金额（Order 场景） */
  orderAmount?: string
  /** 订单状态（Order 场景） */
  orderStatus?: string
  /** 纪念馆名称（Memorial 场景） */
  memorialName?: string
  /** 群聊名称（Group 场景） */
  groupName?: string
  /** 自定义标签（Custom 场景） */
  customLabel?: string
}

// ========== 服务类 ==========

/**
 * 场景服务类
 *
 * 负责管理聊天权限系统中的场景授权。
 */
export class SceneService {
  private api: ApiPromise

  constructor(api: ApiPromise) {
    this.api = api
  }

  // ========== 查询方法 ==========

  /**
   * 函数级详细中文注释：获取两用户之间的所有场景授权
   *
   * ### 功能
   * 调用 Runtime API 获取两个用户之间所有有效的场景授权列表。
   *
   * ### 参数
   * - user1: 第一个用户地址
   * - user2: 第二个用户地址
   *
   * ### 返回
   * 场景授权信息列表
   */
  async getActiveScenes(
    user1: string,
    user2: string
  ): Promise<SceneAuthorizationInfo[]> {
    // 调用 Runtime API
    const result = await (this.api.call as any).chatPermissionApi.getActiveScenes(
      user1,
      user2
    )

    if (!result) {
      return []
    }

    // 解析返回结果
    const scenes = result.toJSON() as any[]
    return scenes.map(this.parseSceneAuthorizationInfo)
  }

  /**
   * 函数级详细中文注释：按场景类型获取授权列表
   *
   * ### 功能
   * 筛选特定类型的场景授权。
   *
   * ### 参数
   * - user1: 第一个用户地址
   * - user2: 第二个用户地址
   * - sceneType: 要筛选的场景类型
   *
   * ### 返回
   * 符合指定类型的场景授权列表
   */
  async getScenesByType(
    user1: string,
    user2: string,
    sceneType: SceneType
  ): Promise<SceneAuthorizationInfo[]> {
    const allScenes = await this.getActiveScenes(user1, user2)
    return allScenes.filter((scene) => scene.sceneType === sceneType)
  }

  /**
   * 函数级详细中文注释：检查特定场景授权是否存在
   *
   * ### 功能
   * 检查两用户之间是否存在指定的场景授权。
   *
   * ### 参数
   * - user1: 第一个用户地址
   * - user2: 第二个用户地址
   * - sceneType: 场景类型
   * - sceneId: 场景标识
   *
   * ### 返回
   * 是否存在该场景授权
   */
  async hasSceneAuthorization(
    user1: string,
    user2: string,
    sceneType: SceneType,
    sceneId: SceneId
  ): Promise<boolean> {
    const scenes = await this.getActiveScenes(user1, user2)
    return scenes.some(
      (scene) =>
        scene.sceneType === sceneType && this.compareSceneId(scene.sceneId, sceneId)
    )
  }

  /**
   * 函数级详细中文注释：获取订单相关的场景授权
   *
   * ### 功能
   * 便捷方法，获取与指定订单相关的场景授权。
   *
   * ### 参数
   * - user1: 买家地址
   * - user2: 卖家地址
   * - orderId: 订单ID
   *
   * ### 返回
   * 订单场景授权信息（如果存在）
   */
  async getOrderSceneAuthorization(
    user1: string,
    user2: string,
    orderId: number | bigint
  ): Promise<SceneAuthorizationInfo | null> {
    const scenes = await this.getScenesByType(user1, user2, SceneType.Order)
    const sceneId = createNumericSceneId(orderId)
    return (
      scenes.find((scene) => this.compareSceneId(scene.sceneId, sceneId)) || null
    )
  }

  /**
   * 函数级详细中文注释：获取做市商场景授权
   *
   * ### 功能
   * 便捷方法，获取与做市商相关的场景授权。
   *
   * ### 参数
   * - user: 用户地址
   * - maker: 做市商地址
   *
   * ### 返回
   * 做市商场景授权信息（如果存在）
   */
  async getMakerSceneAuthorization(
    user: string,
    maker: string
  ): Promise<SceneAuthorizationInfo | null> {
    const scenes = await this.getScenesByType(user, maker, SceneType.MarketMaker)
    return scenes.length > 0 ? scenes[0] : null
  }

  // ========== 交易构建方法 ==========

  /**
   * 函数级详细中文注释：构建授予场景授权交易
   *
   * ### 注意
   * 通常情况下，场景授权由业务 pallet 自动授予。
   * 此方法仅供特殊场景（如手动授权）使用。
   *
   * ### 参数
   * - params: 授予场景授权的参数
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildGrantSceneTx(params: GrantSceneParams): SubmittableExtrinsic<'promise'> {
    // 排序用户对
    const userPair = createUserPair(params.user1, params.user2)

    // 编码场景ID
    const encodedSceneId = this.encodeSceneId(params.sceneId)

    // 编码场景类型
    const encodedSceneType = this.encodeSceneType(params.sceneType)

    // 计算过期区块号
    const expiresAt = params.expiresInBlocks
      ? params.expiresInBlocks
      : null

    // 编码元数据
    const metadata = params.metadata
      ? new TextEncoder().encode(params.metadata)
      : null

    return this.api.tx.chatPermission.grantSceneAuthorization(
      userPair.user1,
      userPair.user2,
      encodedSceneType,
      encodedSceneId,
      expiresAt,
      metadata
    )
  }

  /**
   * 函数级详细中文注释：构建撤销场景授权交易
   *
   * ### 注意
   * 场景授权通常由业务 pallet 在订单完成/取消时自动撤销。
   * 此方法仅供特殊场景使用。
   *
   * ### 参数
   * - params: 撤销场景授权的参数
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildRevokeSceneTx(params: RevokeSceneParams): SubmittableExtrinsic<'promise'> {
    const userPair = createUserPair(params.user1, params.user2)
    const encodedSceneId = this.encodeSceneId(params.sceneId)
    const encodedSceneType = this.encodeSceneType(params.sceneType)

    return this.api.tx.chatPermission.revokeSceneAuthorization(
      userPair.user1,
      userPair.user2,
      encodedSceneType,
      encodedSceneId
    )
  }

  // ========== 事件订阅 ==========

  /**
   * 函数级详细中文注释：订阅场景授权相关事件
   *
   * ### 功能
   * 订阅场景授权的创建和撤销事件。
   *
   * ### 参数
   * - listeners: 事件监听器对象
   *
   * ### 返回
   * 取消订阅函数
   */
  subscribeToSceneEvents(listeners: SceneEventListeners): () => void {
    const unsubscribes: (() => void)[] = []

    this.api.query.system.events((events: any[]) => {
      events.forEach((record) => {
        const { event } = record

        // SceneAuthorizationGranted 事件
        if (
          this.api.events.chatPermission?.SceneAuthorizationGranted?.is(event)
        ) {
          const data = event.data.toJSON() as any
          listeners.onSceneAuthorizationGranted?.({
            user1: data.user1,
            user2: data.user2,
            sceneType: this.parseSceneType(data.sceneType),
            sceneId: this.parseSceneId(data.sceneId),
          })
        }

        // SceneAuthorizationRevoked 事件
        if (
          this.api.events.chatPermission?.SceneAuthorizationRevoked?.is(event)
        ) {
          const data = event.data.toJSON() as any
          listeners.onSceneAuthorizationRevoked?.({
            user1: data.user1,
            user2: data.user2,
            sceneType: this.parseSceneType(data.sceneType),
            sceneId: this.parseSceneId(data.sceneId),
          })
        }
      })
    }).then((unsub) => {
      unsubscribes.push(unsub)
    })

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
  }

  /**
   * 函数级详细中文注释：监听特定用户的场景授权变化
   *
   * ### 功能
   * 监听与指定用户相关的所有场景授权变化。
   *
   * ### 参数
   * - userAddress: 要监听的用户地址
   * - callback: 授权变化回调函数
   *
   * ### 返回
   * 取消订阅函数
   */
  subscribeToUserSceneChanges(
    userAddress: string,
    callback: (event: ChatPermissionEvent) => void
  ): () => void {
    return this.subscribeToSceneEvents({
      onSceneAuthorizationGranted: (event) => {
        if (event.user1 === userAddress || event.user2 === userAddress) {
          callback({
            type: ChatPermissionEventType.SceneAuthorizationGranted,
            data: {
              user1: event.user1,
              user2: event.user2,
              sceneType: event.sceneType,
              sceneId: event.sceneId,
            },
          })
        }
      },
      onSceneAuthorizationRevoked: (event) => {
        if (event.user1 === userAddress || event.user2 === userAddress) {
          callback({
            type: ChatPermissionEventType.SceneAuthorizationRevoked,
            data: {
              user1: event.user1,
              user2: event.user2,
              sceneType: event.sceneType,
              sceneId: event.sceneId,
            },
          })
        }
      },
    })
  }

  // ========== 工具方法 ==========

  /**
   * 创建场景元数据字符串
   *
   * @param sceneType 场景类型
   * @param params 元数据参数
   * @returns JSON 格式的元数据字符串
   */
  createSceneMetadata(
    sceneType: SceneType,
    params: SceneMetadataParams
  ): string {
    switch (sceneType) {
      case SceneType.Order:
        return JSON.stringify({
          amount: params.orderAmount,
          status: params.orderStatus,
        })
      case SceneType.Memorial:
        return JSON.stringify({
          name: params.memorialName,
        })
      case SceneType.Group:
        return JSON.stringify({
          name: params.groupName,
        })
      case SceneType.Custom:
        return JSON.stringify({
          label: params.customLabel,
        })
      default:
        return ''
    }
  }

  /**
   * 获取场景类型的显示文本
   */
  getSceneTypeDisplayText(sceneType: SceneType): string {
    const displayMap: Record<SceneType, string> = {
      [SceneType.MarketMaker]: '做市商咨询',
      [SceneType.Order]: '订单沟通',
      [SceneType.Memorial]: '纪念馆访客',
      [SceneType.Group]: '群聊',
      [SceneType.Custom]: '自定义场景',
    }
    return displayMap[sceneType] || '未知场景'
  }

  /**
   * 获取场景的简短描述
   */
  getSceneDescription(scene: SceneAuthorizationInfo): string {
    const typeText = this.getSceneTypeDisplayText(scene.sceneType)

    // 根据场景ID添加额外信息
    if (scene.sceneId.type === SceneIdType.Numeric && scene.sceneId.numericValue) {
      switch (scene.sceneType) {
        case SceneType.Order:
          return `${typeText} #${scene.sceneId.numericValue}`
        case SceneType.Memorial:
          return `${typeText} ID:${scene.sceneId.numericValue}`
        case SceneType.Group:
          return `${typeText} ID:${scene.sceneId.numericValue}`
        default:
          return typeText
      }
    }

    return typeText
  }

  // ========== 私有方法 ==========

  /**
   * 解析链上返回的场景授权信息
   */
  private parseSceneAuthorizationInfo = (data: any): SceneAuthorizationInfo => {
    return {
      sceneType: this.parseSceneType(data.sceneType),
      sceneId: this.parseSceneId(data.sceneId),
      isExpired: data.isExpired || false,
      expiresAt: data.expiresAt ? Number(data.expiresAt) : undefined,
      metadata: data.metadata || '',
    }
  }

  /**
   * 解析场景类型
   */
  private parseSceneType(data: any): SceneType {
    if (typeof data === 'string') {
      return data as SceneType
    }
    if (typeof data === 'object') {
      if ('MarketMaker' in data || data.marketMaker !== undefined) {
        return SceneType.MarketMaker
      }
      if ('Order' in data || data.order !== undefined) {
        return SceneType.Order
      }
      if ('Memorial' in data || data.memorial !== undefined) {
        return SceneType.Memorial
      }
      if ('Group' in data || data.group !== undefined) {
        return SceneType.Group
      }
      if ('Custom' in data || data.custom !== undefined) {
        return SceneType.Custom
      }
    }
    return SceneType.Order // 默认
  }

  /**
   * 解析场景标识
   */
  private parseSceneId(data: any): SceneId {
    if (!data || data === 'None' || data.none !== undefined) {
      return createNoneSceneId()
    }
    if (typeof data === 'object') {
      if ('Numeric' in data || data.numeric !== undefined) {
        const value = data.Numeric ?? data.numeric
        return createNumericSceneId(BigInt(value))
      }
      if ('Hash' in data || data.hash !== undefined) {
        const hash = data.Hash ?? data.hash
        return { type: SceneIdType.Hash, hashValue: hash }
      }
    }
    return createNoneSceneId()
  }

  /**
   * 编码场景类型为链上格式
   */
  private encodeSceneType(sceneType: SceneType): any {
    switch (sceneType) {
      case SceneType.MarketMaker:
        return { MarketMaker: null }
      case SceneType.Order:
        return { Order: null }
      case SceneType.Memorial:
        return { Memorial: null }
      case SceneType.Group:
        return { Group: null }
      case SceneType.Custom:
        return { Custom: [] }
      default:
        return { Order: null }
    }
  }

  /**
   * 编码场景ID为链上格式
   */
  private encodeSceneId(sceneId: SceneId): any {
    switch (sceneId.type) {
      case SceneIdType.None:
        return { None: null }
      case SceneIdType.Numeric:
        return { Numeric: sceneId.numericValue }
      case SceneIdType.Hash:
        return { Hash: sceneId.hashValue }
      default:
        return { None: null }
    }
  }

  /**
   * 比较两个场景ID是否相等
   */
  private compareSceneId(a: SceneId, b: SceneId): boolean {
    if (a.type !== b.type) {
      return false
    }
    switch (a.type) {
      case SceneIdType.None:
        return true
      case SceneIdType.Numeric:
        return BigInt(a.numericValue || 0) === BigInt(b.numericValue || 0)
      case SceneIdType.Hash:
        return a.hashValue === b.hashValue
      default:
        return false
    }
  }
}

// ========== 工厂函数 ==========

/**
 * 函数级详细中文注释：创建场景服务实例
 */
export async function createSceneService(): Promise<SceneService> {
  const api = await getApi()
  return new SceneService(api)
}

export default SceneService
