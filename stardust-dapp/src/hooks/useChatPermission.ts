/**
 * 聊天权限系统 React Hooks
 *
 * 功能说明：
 * 1. useChatPermission - 检查聊天权限
 * 2. useSceneAuthorizations - 查询场景授权
 * 3. usePrivacySettings - 管理隐私设置
 * 4. useFriendship - 管理好友关系
 * 5. useChatPermissionEvents - 订阅权限变化事件
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { App } from 'antd'
import { usePolkadotApi } from './usePolkadotApi'
import { useWallet } from './useWallet'
import { signAndSendLocalFromKeystore } from '../lib/polkadot-safe'
import {
  ChatPermissionLevel,
  PermissionResult,
  PermissionResultType,
  PrivacySettingsSummary,
  SceneType,
  SceneAuthorizationInfo,
  SceneId,
  isPermissionAllowed,
  getPermissionDeniedReason,
  ChatPermissionEvent,
  ChatPermissionEventType,
} from '../types/chatPermission'
import {
  ChatPermissionService,
  DetailedPermissionResult,
} from '../services/chatPermissionService'
import { SceneService } from '../services/sceneService'

// ========== 查询Key常量 ==========

const QUERY_KEYS = {
  permission: (sender: string, receiver: string) => ['chatPermission', sender, receiver],
  scenes: (user1: string, user2: string) => ['chatScenes', user1, user2],
  privacySettings: (user: string) => ['privacySettings', user],
  isFriend: (user1: string, user2: string) => ['isFriend', user1, user2],
  isBlocked: (blocker: string, blocked: string) => ['isBlocked', blocker, blocked],
}

// ========== Hook实现 ==========

/**
 * 函数级详细中文注释：聊天权限检查 Hook
 *
 * ### 功能
 * 检查当前用户是否有权限向指定用户发送消息。
 *
 * ### 使用示例
 * ```tsx
 * const { data: permission, isLoading } = useChatPermission(targetAddress);
 * if (permission?.isAllowed) {
 *   // 允许发送消息
 * }
 * ```
 *
 * @param targetUser 目标用户地址
 * @param options 查询选项
 */
export const useChatPermission = (
  targetUser?: string,
  options?: { enabled?: boolean }
) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()

  return useQuery({
    queryKey: QUERY_KEYS.permission(account || '', targetUser || ''),
    queryFn: async (): Promise<DetailedPermissionResult | null> => {
      if (!api || !account || !targetUser || !isReady) return null

      const service = new ChatPermissionService(api)
      return service.checkPermissionDetailed(account, targetUser)
    },
    enabled: !!api && !!account && !!targetUser && isReady && (options?.enabled !== false),
    staleTime: 30000, // 30秒内认为数据有效
    refetchInterval: 60000, // 1分钟自动刷新
  })
}

/**
 * 函数级详细中文注释：批量权限检查 Hook
 *
 * ### 功能
 * 对多个目标用户批量检查聊天权限。
 * 适用于联系人列表等场景。
 *
 * @param targetUsers 目标用户地址列表
 */
export const useChatPermissionBatch = (targetUsers: string[]) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()

  return useQuery({
    queryKey: ['chatPermissionBatch', account, targetUsers],
    queryFn: async (): Promise<Map<string, PermissionResult>> => {
      if (!api || !account || !isReady || targetUsers.length === 0) {
        return new Map()
      }

      const service = new ChatPermissionService(api)
      return service.checkPermissionBatch(account, targetUsers)
    },
    enabled: !!api && !!account && isReady && targetUsers.length > 0,
    staleTime: 30000,
  })
}

/**
 * 函数级详细中文注释：场景授权查询 Hook
 *
 * ### 功能
 * 查询当前用户与指定用户之间的所有场景授权。
 *
 * @param otherUser 另一个用户地址
 */
export const useSceneAuthorizations = (otherUser?: string) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()

  return useQuery({
    queryKey: QUERY_KEYS.scenes(account || '', otherUser || ''),
    queryFn: async (): Promise<SceneAuthorizationInfo[]> => {
      if (!api || !account || !otherUser || !isReady) return []

      const service = new SceneService(api)
      return service.getActiveScenes(account, otherUser)
    },
    enabled: !!api && !!account && !!otherUser && isReady,
    staleTime: 30000,
    refetchInterval: 60000,
  })
}

/**
 * 函数级详细中文注释：按场景类型筛选授权 Hook
 *
 * @param otherUser 另一个用户地址
 * @param sceneType 场景类型
 */
export const useScenesByType = (otherUser?: string, sceneType?: SceneType) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()

  return useQuery({
    queryKey: ['chatScenesByType', account, otherUser, sceneType],
    queryFn: async (): Promise<SceneAuthorizationInfo[]> => {
      if (!api || !account || !otherUser || !sceneType || !isReady) return []

      const service = new SceneService(api)
      return service.getScenesByType(account, otherUser, sceneType)
    },
    enabled: !!api && !!account && !!otherUser && !!sceneType && isReady,
    staleTime: 30000,
  })
}

/**
 * 函数级详细中文注释：隐私设置查询 Hook
 *
 * @param user 用户地址（默认当前用户）
 */
export const usePrivacySettings = (user?: string) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()
  const targetUser = user || account

  return useQuery({
    queryKey: QUERY_KEYS.privacySettings(targetUser || ''),
    queryFn: async (): Promise<PrivacySettingsSummary | null> => {
      if (!api || !targetUser || !isReady) return null

      const service = new ChatPermissionService(api)
      return service.getPrivacySettingsSummary(targetUser)
    },
    enabled: !!api && !!targetUser && isReady,
    staleTime: 30000,
  })
}

/**
 * 函数级详细中文注释：好友关系检查 Hook
 *
 * @param otherUser 另一个用户地址
 */
export const useIsFriend = (otherUser?: string) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()

  return useQuery({
    queryKey: QUERY_KEYS.isFriend(account || '', otherUser || ''),
    queryFn: async (): Promise<boolean> => {
      if (!api || !account || !otherUser || !isReady) return false

      const service = new ChatPermissionService(api)
      return service.isFriend(account, otherUser)
    },
    enabled: !!api && !!account && !!otherUser && isReady,
    staleTime: 30000,
  })
}

/**
 * 函数级详细中文注释：黑名单检查 Hook
 *
 * @param targetUser 目标用户地址
 */
export const useIsBlocked = (targetUser?: string) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()

  return useQuery({
    queryKey: QUERY_KEYS.isBlocked(account || '', targetUser || ''),
    queryFn: async (): Promise<boolean> => {
      if (!api || !account || !targetUser || !isReady) return false

      const service = new ChatPermissionService(api)
      return service.isBlocked(account, targetUser)
    },
    enabled: !!api && !!account && !!targetUser && isReady,
    staleTime: 30000,
  })
}

// ========== Mutation Hooks ==========

/**
 * 函数级详细中文注释：设置权限级别 Mutation
 */
export const useSetPermissionLevel = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (level: ChatPermissionLevel) => {
      if (!account) throw new Error('未连接钱包')

      // 编码权限级别
      const encodedLevel = encodePermissionLevel(level)

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'setPermissionLevel',
        [encodedLevel]
      )

      return hash
    },
    onSuccess: () => {
      message.success('权限级别设置成功')
      queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
    },
    onError: (error: any) => {
      message.error(`设置权限级别失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：拉黑用户 Mutation
 */
export const useBlockUser = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (targetUser: string) => {
      if (!account) throw new Error('未连接钱包')

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'blockUser',
        [targetUser]
      )

      return hash
    },
    onSuccess: (_data, targetUser) => {
      message.success('用户已拉黑')
      queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
      queryClient.invalidateQueries({ queryKey: ['isBlocked', account, targetUser] })
    },
    onError: (error: any) => {
      message.error(`拉黑用户失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：解除拉黑 Mutation
 */
export const useUnblockUser = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (targetUser: string) => {
      if (!account) throw new Error('未连接钱包')

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'unblockUser',
        [targetUser]
      )

      return hash
    },
    onSuccess: (_data, targetUser) => {
      message.success('已解除拉黑')
      queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
      queryClient.invalidateQueries({ queryKey: ['isBlocked', account, targetUser] })
    },
    onError: (error: any) => {
      message.error(`解除拉黑失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：添加白名单 Mutation
 */
export const useAddToWhitelist = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (targetUser: string) => {
      if (!account) throw new Error('未连接钱包')

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'addToWhitelist',
        [targetUser]
      )

      return hash
    },
    onSuccess: () => {
      message.success('已添加到白名单')
      queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
    },
    onError: (error: any) => {
      message.error(`添加白名单失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：移出白名单 Mutation
 */
export const useRemoveFromWhitelist = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (targetUser: string) => {
      if (!account) throw new Error('未连接钱包')

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'removeFromWhitelist',
        [targetUser]
      )

      return hash
    },
    onSuccess: () => {
      message.success('已移出白名单')
      queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
    },
    onError: (error: any) => {
      message.error(`移出白名单失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：添加好友 Mutation
 */
export const useAddFriend = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (targetUser: string) => {
      if (!account) throw new Error('未连接钱包')

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'addFriend',
        [targetUser]
      )

      return hash
    },
    onSuccess: (_data, targetUser) => {
      message.success('好友添加成功')
      queryClient.invalidateQueries({ queryKey: ['isFriend'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
    },
    onError: (error: any) => {
      message.error(`添加好友失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：删除好友 Mutation
 */
export const useRemoveFriend = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (targetUser: string) => {
      if (!account) throw new Error('未连接钱包')

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'removeFriend',
        [targetUser]
      )

      return hash
    },
    onSuccess: (_data, targetUser) => {
      message.success('好友已删除')
      queryClient.invalidateQueries({ queryKey: ['isFriend'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
    },
    onError: (error: any) => {
      message.error(`删除好友失败: ${error.message}`)
    },
  })
}

/**
 * 函数级详细中文注释：设置拒绝场景类型 Mutation
 */
export const useSetRejectedSceneTypes = () => {
  const { account } = useWallet()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  return useMutation({
    mutationFn: async (sceneTypes: SceneType[]) => {
      if (!account) throw new Error('未连接钱包')

      // 编码场景类型列表
      const encodedTypes = sceneTypes.map((t) => encodeSceneType(t))

      const hash = await signAndSendLocalFromKeystore(
        'chatPermission',
        'setRejectedSceneTypes',
        [encodedTypes]
      )

      return hash
    },
    onSuccess: () => {
      message.success('场景设置已更新')
      queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
      queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
    },
    onError: (error: any) => {
      message.error(`设置拒绝场景失败: ${error.message}`)
    },
  })
}

// ========== 事件订阅 Hook ==========

/**
 * 函数级详细中文注释：聊天权限事件订阅 Hook
 *
 * ### 功能
 * 订阅当前用户相关的权限变化事件。
 *
 * @param onEvent 事件回调函数
 */
export const useChatPermissionEvents = (
  onEvent?: (event: ChatPermissionEvent) => void
) => {
  const { api, isReady } = usePolkadotApi()
  const { account } = useWallet()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!api || !account || !isReady) return

    const service = new ChatPermissionService(api)

    const unsubscribe = service.subscribeToUserPermissionChanges(
      account,
      (event) => {
        // 自动刷新相关查询
        switch (event.type) {
          case ChatPermissionEventType.SceneAuthorizationGranted:
          case ChatPermissionEventType.SceneAuthorizationRevoked:
            queryClient.invalidateQueries({ queryKey: ['chatScenes'] })
            queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
            break
          case ChatPermissionEventType.FriendshipUpdated:
            queryClient.invalidateQueries({ queryKey: ['isFriend'] })
            queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
            break
          case ChatPermissionEventType.PrivacySettingsUpdated:
          case ChatPermissionEventType.UserBlocked:
          case ChatPermissionEventType.UserUnblocked:
            queryClient.invalidateQueries({ queryKey: ['privacySettings'] })
            queryClient.invalidateQueries({ queryKey: ['chatPermission'] })
            queryClient.invalidateQueries({ queryKey: ['isBlocked'] })
            break
        }

        // 调用用户回调
        onEvent?.(event)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [api, account, isReady, queryClient, onEvent])
}

// ========== 工具函数 ==========

/**
 * 编码权限级别为链上格式
 */
function encodePermissionLevel(level: ChatPermissionLevel): any {
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
function encodeSceneType(sceneType: SceneType): any {
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

// ========== 导出 ==========

export {
  QUERY_KEYS as CHAT_PERMISSION_QUERY_KEYS,
}
