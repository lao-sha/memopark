/**
 * 聊天权限检查服务
 *
 * 功能说明：
 * 1. 检查两用户之间的聊天权限
 * 2. 管理用户隐私设置（权限级别、黑白名单）
 * 3. 管理好友关系
 * 4. 订阅权限相关事件
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 *
 * 权限判断优先级：
 * 1. 黑名单检查（最高优先级拒绝）
 * 2. 好友关系检查
 * 3. 场景授权检查
 * 4. 隐私设置检查
 */

import { ApiPromise } from '@polkadot/api'
import type { SubmittableExtrinsic } from '@polkadot/api/types'
import type { ISubmittableResult } from '@polkadot/types/types'
import { getApi } from '../lib/polkadot-safe'
import {
  ChatPermissionLevel,
  PermissionResult,
  PermissionResultType,
  PrivacySettings,
  PrivacySettingsSummary,
  SceneType,
  UpdatePrivacySettingsParams,
  FriendshipStatus,
  FriendInfo,
  ChatPermissionEventType,
  ChatPermissionEvent,
  isPermissionAllowed,
  getPermissionDeniedReason,
  PermissionLevelCodec,
} from '../types/chatPermission'

// ========== 类型定义 ==========

/**
 * 隐私设置事件监听器
 */
export interface PrivacyEventListeners {
  /** 隐私设置更新 */
  onPrivacySettingsUpdated?: (event: { user: string }) => void
  /** 用户被拉黑 */
  onUserBlocked?: (event: { blocker: string; blocked: string }) => void
  /** 用户被解除拉黑 */
  onUserUnblocked?: (event: { blocker: string; unblocked: string }) => void
  /** 用户被添加到白名单 */
  onUserWhitelisted?: (event: { user: string; whitelisted: string }) => void
  /** 用户被移除出白名单 */
  onUserRemovedFromWhitelist?: (event: { user: string; removed: string }) => void
  /** 好友关系更新 */
  onFriendshipUpdated?: (event: { user1: string; user2: string; isFriend: boolean }) => void
}

/**
 * 权限检查详细结果
 */
export interface DetailedPermissionResult {
  /** 基础权限检查结果 */
  result: PermissionResult
  /** 是否允许聊天 */
  isAllowed: boolean
  /** 拒绝原因（如果拒绝） */
  deniedReason?: string
  /** 有效场景列表（如果通过场景授权） */
  activeScenes?: SceneType[]
  /** 对方隐私设置摘要 */
  receiverPrivacy?: PrivacySettingsSummary
}

// ========== 服务类 ==========

/**
 * 聊天权限服务类
 *
 * 负责管理聊天权限系统中的权限检查、隐私设置和好友关系。
 */
export class ChatPermissionService {
  private api: ApiPromise

  constructor(api: ApiPromise) {
    this.api = api
  }

  // ========== 权限检查方法 ==========

  /**
   * 函数级详细中文注释：检查聊天权限
   *
   * ### 功能
   * 调用 Runtime API 检查两个用户之间的聊天权限。
   *
   * ### 权限判断优先级
   * 1. 黑名单检查（最高优先级拒绝）
   * 2. 好友关系检查
   * 3. 场景授权检查
   * 4. 隐私设置检查
   *
   * ### 参数
   * - sender: 消息发送者地址
   * - receiver: 消息接收者地址
   *
   * ### 返回
   * 权限检查结果
   */
  async checkPermission(sender: string, receiver: string): Promise<PermissionResult> {
    const result = await (this.api.call as any).chatPermissionApi.checkChatPermission(
      sender,
      receiver
    )

    return this.parsePermissionResult(result.toJSON())
  }

  /**
   * 函数级详细中文注释：获取详细的权限检查结果
   *
   * ### 功能
   * 返回包含额外上下文信息的权限检查结果。
   *
   * ### 参数
   * - sender: 消息发送者地址
   * - receiver: 消息接收者地址
   *
   * ### 返回
   * 详细的权限检查结果
   */
  async checkPermissionDetailed(
    sender: string,
    receiver: string
  ): Promise<DetailedPermissionResult> {
    const result = await this.checkPermission(sender, receiver)
    const isAllowed = isPermissionAllowed(result)

    const detailed: DetailedPermissionResult = {
      result,
      isAllowed,
    }

    if (!isAllowed) {
      detailed.deniedReason = getPermissionDeniedReason(result)
    }

    if (result.type === PermissionResultType.AllowedByScene) {
      detailed.activeScenes = result.allowedScenes
    }

    // 获取接收者隐私设置摘要
    detailed.receiverPrivacy = await this.getPrivacySettingsSummary(receiver)

    return detailed
  }

  /**
   * 函数级详细中文注释：批量检查权限
   *
   * ### 功能
   * 对多个接收者批量检查聊天权限。
   *
   * ### 参数
   * - sender: 发送者地址
   * - receivers: 接收者地址列表
   *
   * ### 返回
   * 权限检查结果映射表
   */
  async checkPermissionBatch(
    sender: string,
    receivers: string[]
  ): Promise<Map<string, PermissionResult>> {
    const results = new Map<string, PermissionResult>()

    await Promise.all(
      receivers.map(async (receiver) => {
        const result = await this.checkPermission(sender, receiver)
        results.set(receiver, result)
      })
    )

    return results
  }

  // ========== 好友关系方法 ==========

  /**
   * 函数级详细中文注释：检查是否是好友
   *
   * ### 功能
   * 调用 Runtime API 检查两个用户是否是好友关系。
   *
   * ### 参数
   * - user1: 第一个用户地址
   * - user2: 第二个用户地址
   *
   * ### 返回
   * 是否是好友
   */
  async isFriend(user1: string, user2: string): Promise<boolean> {
    const result = await (this.api.call as any).chatPermissionApi.isFriend(user1, user2)
    return result.isTrue
  }

  /**
   * 函数级详细中文注释：构建添加好友交易
   *
   * ### 功能
   * 构建添加好友的链上交易。
   * 好友关系是双向的，需要双方都添加对方。
   *
   * ### 参数
   * - targetUser: 要添加为好友的用户地址
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildAddFriendTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chatPermission.addFriend(targetUser)
  }

  /**
   * 函数级详细中文注释：构建删除好友交易
   *
   * ### 参数
   * - targetUser: 要删除的好友地址
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildRemoveFriendTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chatPermission.removeFriend(targetUser)
  }

  /**
   * 函数级详细中文注释：添加好友
   *
   * ### 功能
   * 发送添加好友的链上交易并等待确认。
   *
   * ### 参数
   * - senderAddress: 发送者地址
   * - targetUser: 目标用户地址
   *
   * ### 返回
   * 是否成功
   */
  async addFriend(senderAddress: string, targetUser: string): Promise<boolean> {
    const tx = this.buildAddFriendTx(targetUser)

    return new Promise(async (resolve, reject) => {
      try {
        const { web3FromAddress } = await import('@polkadot/extension-dapp')
        const injector = await web3FromAddress(senderAddress)

        tx.signAndSend(
          senderAddress,
          { signer: injector.signer },
          (result: ISubmittableResult) => {
            if (result.status.isInBlock) {
              // 检查是否有错误事件
              const failed = result.events.find(
                ({ event }) =>
                  this.api.events.system.ExtrinsicFailed.is(event)
              )

              if (failed) {
                reject(new Error('添加好友失败'))
              } else {
                resolve(true)
              }
            } else if (result.isError) {
              reject(new Error('交易失败'))
            }
          }
        ).catch(reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  // ========== 隐私设置方法 ==========

  /**
   * 函数级详细中文注释：获取用户隐私设置摘要
   *
   * ### 功能
   * 调用 Runtime API 获取用户的隐私设置概要。
   *
   * ### 参数
   * - user: 用户地址
   *
   * ### 返回
   * 隐私设置摘要
   */
  async getPrivacySettingsSummary(user: string): Promise<PrivacySettingsSummary> {
    const result = await (this.api.call as any).chatPermissionApi.getPrivacySettingsSummary(
      user
    )

    const data = result.toJSON() as any
    return {
      permissionLevel: this.parsePermissionLevel(data.permissionLevel),
      blockListCount: data.blockListCount || 0,
      whitelistCount: data.whitelistCount || 0,
      rejectedSceneTypes: (data.rejectedSceneTypes || []).map(
        (t: any) => this.parseSceneType(t)
      ),
    }
  }

  /**
   * 函数级详细中文注释：构建设置权限级别交易
   *
   * ### 参数
   * - level: 新的权限级别
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildSetPermissionLevelTx(
    level: ChatPermissionLevel
  ): SubmittableExtrinsic<'promise'> {
    const encodedLevel = this.encodePermissionLevel(level)
    return this.api.tx.chatPermission.setPermissionLevel(encodedLevel)
  }

  /**
   * 函数级详细中文注释：构建拉黑用户交易
   *
   * ### 参数
   * - targetUser: 要拉黑的用户地址
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildBlockUserTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chatPermission.blockUser(targetUser)
  }

  /**
   * 函数级详细中文注释：构建解除拉黑交易
   *
   * ### 参数
   * - targetUser: 要解除拉黑的用户地址
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildUnblockUserTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chatPermission.unblockUser(targetUser)
  }

  /**
   * 函数级详细中文注释：构建添加白名单交易
   *
   * ### 参数
   * - targetUser: 要添加到白名单的用户地址
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildAddToWhitelistTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chatPermission.addToWhitelist(targetUser)
  }

  /**
   * 函数级详细中文注释：构建移出白名单交易
   *
   * ### 参数
   * - targetUser: 要从白名单移除的用户地址
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildRemoveFromWhitelistTx(targetUser: string): SubmittableExtrinsic<'promise'> {
    return this.api.tx.chatPermission.removeFromWhitelist(targetUser)
  }

  /**
   * 函数级详细中文注释：构建设置拒绝场景类型交易
   *
   * ### 功能
   * 设置用户拒绝接受的场景类型。
   * 即使有场景授权，如果场景类型在拒绝列表中，也会被拒绝。
   *
   * ### 参数
   * - sceneTypes: 要拒绝的场景类型列表
   *
   * ### 返回
   * 可提交的交易对象
   */
  buildSetRejectedSceneTypesTx(
    sceneTypes: SceneType[]
  ): SubmittableExtrinsic<'promise'> {
    const encodedTypes = sceneTypes.map((t) => this.encodeSceneType(t))
    return this.api.tx.chatPermission.setRejectedSceneTypes(encodedTypes)
  }

  /**
   * 函数级详细中文注释：检查用户是否被拉黑
   *
   * ### 参数
   * - blocker: 可能拉黑对方的用户
   * - blocked: 可能被拉黑的用户
   *
   * ### 返回
   * 是否被拉黑
   */
  async isBlocked(blocker: string, blocked: string): Promise<boolean> {
    // 直接查询存储
    const result = await this.api.query.chatPermission?.userPrivacySettings?.(blocker)

    if (!result || result.isEmpty) {
      return false
    }

    const data = result.toJSON() as any
    const blockList = data.blockList || []
    return blockList.includes(blocked)
  }

  /**
   * 函数级详细中文注释：检查用户是否在白名单
   *
   * ### 参数
   * - owner: 白名单所有者
   * - user: 要检查的用户
   *
   * ### 返回
   * 是否在白名单
   */
  async isWhitelisted(owner: string, user: string): Promise<boolean> {
    const result = await this.api.query.chatPermission?.userPrivacySettings?.(owner)

    if (!result || result.isEmpty) {
      return false
    }

    const data = result.toJSON() as any
    const whitelist = data.whitelist || []
    return whitelist.includes(user)
  }

  // ========== 事件订阅 ==========

  /**
   * 函数级详细中文注释：订阅隐私设置相关事件
   *
   * ### 功能
   * 订阅隐私设置更新、黑白名单变化等事件。
   *
   * ### 参数
   * - listeners: 事件监听器对象
   *
   * ### 返回
   * 取消订阅函数
   */
  subscribeToPrivacyEvents(listeners: PrivacyEventListeners): () => void {
    const unsubscribes: (() => void)[] = []

    this.api.query.system.events((events: any[]) => {
      events.forEach((record) => {
        const { event } = record

        // PrivacySettingsUpdated 事件
        if (
          this.api.events.chatPermission?.PrivacySettingsUpdated?.is(event)
        ) {
          const data = event.data.toJSON() as any
          listeners.onPrivacySettingsUpdated?.({
            user: data.user,
          })
        }

        // UserBlocked 事件
        if (this.api.events.chatPermission?.UserBlocked?.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onUserBlocked?.({
            blocker: data.blocker,
            blocked: data.blocked,
          })
        }

        // UserUnblocked 事件
        if (this.api.events.chatPermission?.UserUnblocked?.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onUserUnblocked?.({
            blocker: data.blocker,
            unblocked: data.unblocked,
          })
        }

        // FriendshipUpdated 事件
        if (this.api.events.chatPermission?.FriendshipUpdated?.is(event)) {
          const data = event.data.toJSON() as any
          listeners.onFriendshipUpdated?.({
            user1: data.user1,
            user2: data.user2,
            isFriend: data.isFriend,
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
   * 函数级详细中文注释：监听特定用户的权限变化
   *
   * ### 功能
   * 监听与指定用户相关的所有权限变化事件。
   *
   * ### 参数
   * - userAddress: 要监听的用户地址
   * - callback: 权限变化回调函数
   *
   * ### 返回
   * 取消订阅函数
   */
  subscribeToUserPermissionChanges(
    userAddress: string,
    callback: (event: ChatPermissionEvent) => void
  ): () => void {
    return this.subscribeToPrivacyEvents({
      onPrivacySettingsUpdated: (event) => {
        if (event.user === userAddress) {
          callback({
            type: ChatPermissionEventType.PrivacySettingsUpdated,
            data: { targetUser: event.user },
          })
        }
      },
      onUserBlocked: (event) => {
        if (event.blocker === userAddress || event.blocked === userAddress) {
          callback({
            type: ChatPermissionEventType.UserBlocked,
            data: { user1: event.blocker, targetUser: event.blocked },
          })
        }
      },
      onUserUnblocked: (event) => {
        if (event.blocker === userAddress || event.unblocked === userAddress) {
          callback({
            type: ChatPermissionEventType.UserUnblocked,
            data: { user1: event.blocker, targetUser: event.unblocked },
          })
        }
      },
      onFriendshipUpdated: (event) => {
        if (event.user1 === userAddress || event.user2 === userAddress) {
          callback({
            type: ChatPermissionEventType.FriendshipUpdated,
            data: { user1: event.user1, user2: event.user2 },
          })
        }
      },
    })
  }

  // ========== 工具方法 ==========

  /**
   * 获取权限级别的显示文本
   */
  getPermissionLevelDisplayText(level: ChatPermissionLevel): string {
    const displayMap: Record<ChatPermissionLevel, string> = {
      [ChatPermissionLevel.Open]: '公开',
      [ChatPermissionLevel.FriendsOnly]: '仅好友',
      [ChatPermissionLevel.Whitelist]: '白名单',
      [ChatPermissionLevel.Closed]: '关闭',
    }
    return displayMap[level] || '未知'
  }

  /**
   * 获取权限级别的描述文本
   */
  getPermissionLevelDescription(level: ChatPermissionLevel): string {
    const descMap: Record<ChatPermissionLevel, string> = {
      [ChatPermissionLevel.Open]: '任何人都可以给您发消息',
      [ChatPermissionLevel.FriendsOnly]: '只有互相加为好友的用户才能聊天',
      [ChatPermissionLevel.Whitelist]: '只有白名单中的用户可以发消息',
      [ChatPermissionLevel.Closed]: '不接受任何新消息',
    }
    return descMap[level] || ''
  }

  // ========== 私有方法 ==========

  /**
   * 解析权限检查结果
   */
  private parsePermissionResult(data: any): PermissionResult {
    if (typeof data === 'string') {
      return { type: data as PermissionResultType }
    }

    if (typeof data === 'object') {
      if ('Allowed' in data || data.allowed !== undefined) {
        return { type: PermissionResultType.Allowed }
      }
      if ('AllowedByFriendship' in data || data.allowedByFriendship !== undefined) {
        return { type: PermissionResultType.AllowedByFriendship }
      }
      if ('AllowedByScene' in data || data.allowedByScene !== undefined) {
        const scenes = data.AllowedByScene ?? data.allowedByScene ?? []
        return {
          type: PermissionResultType.AllowedByScene,
          allowedScenes: scenes.map((s: any) => this.parseSceneType(s)),
        }
      }
      if ('DeniedBlocked' in data || data.deniedBlocked !== undefined) {
        return { type: PermissionResultType.DeniedBlocked }
      }
      if ('DeniedRequiresFriend' in data || data.deniedRequiresFriend !== undefined) {
        return { type: PermissionResultType.DeniedRequiresFriend }
      }
      if ('DeniedNotInWhitelist' in data || data.deniedNotInWhitelist !== undefined) {
        return { type: PermissionResultType.DeniedNotInWhitelist }
      }
      if ('DeniedClosed' in data || data.deniedClosed !== undefined) {
        return { type: PermissionResultType.DeniedClosed }
      }
    }

    // 默认拒绝
    return { type: PermissionResultType.DeniedClosed }
  }

  /**
   * 解析权限级别
   */
  private parsePermissionLevel(data: any): ChatPermissionLevel {
    if (typeof data === 'string') {
      return data as ChatPermissionLevel
    }
    if (typeof data === 'object') {
      if ('Open' in data || data.open !== undefined) {
        return ChatPermissionLevel.Open
      }
      if ('FriendsOnly' in data || data.friendsOnly !== undefined) {
        return ChatPermissionLevel.FriendsOnly
      }
      if ('Whitelist' in data || data.whitelist !== undefined) {
        return ChatPermissionLevel.Whitelist
      }
      if ('Closed' in data || data.closed !== undefined) {
        return ChatPermissionLevel.Closed
      }
    }
    return ChatPermissionLevel.FriendsOnly // 默认
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
   * 编码权限级别为链上格式
   */
  private encodePermissionLevel(level: ChatPermissionLevel): any {
    switch (level) {
      case ChatPermissionLevel.Open:
        return { Open: null }
      case ChatPermissionLevel.FriendsOnly:
        return { FriendsOnly: null }
      case ChatPermissionLevel.Whitelist:
        return { Whitelist: null }
      case ChatPermissionLevel.Closed:
        return { Closed: null }
      default:
        return { FriendsOnly: null }
    }
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
}

// ========== 工厂函数 ==========

/**
 * 函数级详细中文注释：创建聊天权限服务实例
 */
export async function createChatPermissionService(): Promise<ChatPermissionService> {
  const api = await getApi()
  return new ChatPermissionService(api)
}

export default ChatPermissionService
