/**
 * 治理相关React Hooks
 *
 * 功能说明：
 * 1. useGovernance - 使用统一治理服务
 * 2. useGovernanceEvents - 监听治理事件
 * 3. useGovernanceStatus - 查询治理状态
 *
 * 创建日期：2025-01-20
 */

import { useMemo, useEffect, useCallback, useState } from 'react'
import { useApi } from './useApi'
import { useWallet } from '../providers/WalletProvider'
import {
  GovernanceService,
  GovernanceEventService,
  type GovernanceRequestParams,
  type GovernanceRequestResponse,
  type GovernanceStatusResponse,
  type GovernanceRequestType,
  type StandardGovernanceEvent,
  type GovernanceEventType,
  type EventFilter,
  createEventFilter,
} from '../services/governanceService'

// ==================== useGovernance Hook ====================

/**
 * React Hook：使用治理服务
 *
 * @returns 治理服务方法
 *
 * @example
 * ```tsx
 * const { submitGovernanceRequest, getGovernanceStatus } = useGovernance()
 *
 * // 提交申诉
 * const result = await submitGovernanceRequest({
 *   type: GovernanceRequestType.ContentAppeal,
 *   domain: GovernanceDomain.Text,
 *   targetId: 123,
 *   action: GovernanceAction.Delete,
 *   reason: '包含不当内容',
 * })
 * ```
 */
export function useGovernance() {
  const api = useApi()
  const { currentAccount, keyring } = useWallet()

  const governanceService = useMemo(() => {
    if (!api) return null
    return new GovernanceService(api)
  }, [api])

  /**
   * 提交治理请求
   */
  const submitGovernanceRequest = useCallback(
    async (params: GovernanceRequestParams): Promise<GovernanceRequestResponse> => {
      if (!governanceService) {
        return { success: false, error: 'API未就绪' }
      }
      if (!currentAccount) {
        return { success: false, error: '未连接钱包' }
      }

      const signer = keyring?.getPair(currentAccount)
      if (!signer) {
        return { success: false, error: '无法获取签名者' }
      }

      return await governanceService.submitGovernanceRequest(params, signer)
    },
    [governanceService, currentAccount, keyring]
  )

  /**
   * 查询治理状态
   */
  const getGovernanceStatus = useCallback(
    async (
      requestType: GovernanceRequestType,
      requestId: number | string
    ): Promise<GovernanceStatusResponse | null> => {
      if (!governanceService) return null
      return await governanceService.getGovernanceStatus(requestType, requestId)
    },
    [governanceService]
  )

  /**
   * 获取用户所有治理请求
   */
  const getUserGovernanceRequests = useCallback(
    async (
      account?: string,
      filterType?: GovernanceRequestType
    ): Promise<GovernanceStatusResponse[]> => {
      if (!governanceService) return []
      const targetAccount = account || currentAccount
      if (!targetAccount) return []
      return await governanceService.getUserGovernanceRequests(targetAccount, filterType)
    },
    [governanceService, currentAccount]
  )

  return {
    submitGovernanceRequest,
    getGovernanceStatus,
    getUserGovernanceRequests,
    isReady: !!governanceService,
  }
}

// ==================== useGovernanceEvents Hook ====================

/**
 * React Hook：监听治理事件
 *
 * @param eventTypes 事件类型（单个、多个或'all'）
 * @param callback 事件回调函数
 * @param filter 可选的事件过滤器
 *
 * @example
 * ```tsx
 * // 监听单个事件
 * useGovernanceEvents(GovernanceEventType.AppealSubmitted, (event) => {
 *   console.log('申诉已提交:', event)
 * })
 *
 * // 监听多个事件
 * useGovernanceEvents(
 *   [GovernanceEventType.AppealSubmitted, GovernanceEventType.AppealApproved],
 *   (event) => {
 *     console.log('申诉状态变更:', event)
 *   }
 * )
 *
 * // 监听所有事件
 * useGovernanceEvents('all', (event) => {
 *   console.log('治理事件:', event)
 * })
 * ```
 */
export function useGovernanceEvents(
  eventTypes: GovernanceEventType | GovernanceEventType[] | 'all',
  callback: (event: StandardGovernanceEvent) => void,
  filter?: EventFilter
) {
  const api = useApi()

  const eventService = useMemo(() => {
    if (!api) return null
    return new GovernanceEventService(api)
  }, [api])

  // 创建过滤函数
  const filterFn = useMemo(() => {
    return filter ? createEventFilter(filter) : null
  }, [filter])

  // 包装回调函数以支持过滤
  const wrappedCallback = useCallback(
    (event: StandardGovernanceEvent) => {
      if (filterFn && !filterFn(event)) {
        return
      }
      callback(event)
    },
    [callback, filterFn]
  )

  useEffect(() => {
    if (!eventService) return

    let unsubscribe: (() => void) | undefined

    if (eventTypes === 'all') {
      unsubscribe = eventService.subscribeAll(wrappedCallback)
    } else if (Array.isArray(eventTypes)) {
      unsubscribe = eventService.subscribeMultiple(eventTypes, wrappedCallback)
    } else {
      unsubscribe = eventService.subscribe(eventTypes, wrappedCallback)
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [eventService, eventTypes, wrappedCallback])
}

// ==================== useGovernanceStatus Hook ====================

/**
 * React Hook：查询和监控治理状态
 *
 * @param requestType 请求类型
 * @param requestId 请求ID
 * @param autoRefresh 是否自动刷新（监听相关事件）
 *
 * @returns 治理状态和刷新方法
 *
 * @example
 * ```tsx
 * const { status, loading, error, refresh } = useGovernanceStatus(
 *   GovernanceRequestType.ContentAppeal,
 *   appealId,
 *   true // 自动刷新
 * )
 *
 * if (loading) return <Spin />
 * if (error) return <Alert message={error} type="error" />
 * return <div>状态：{status?.status}</div>
 * ```
 */
export function useGovernanceStatus(
  requestType: GovernanceRequestType,
  requestId: number | string | null,
  autoRefresh = false
) {
  const { getGovernanceStatus } = useGovernance()
  const [status, setStatus] = useState<GovernanceStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!requestId) {
      setStatus(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await getGovernanceStatus(requestType, requestId)
      setStatus(result)
    } catch (err: any) {
      setError(err.message || '查询失败')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [getGovernanceStatus, requestType, requestId])

  // 初始加载
  useEffect(() => {
    refresh()
  }, [refresh])

  // 自动刷新（监听相关事件）
  useGovernanceEvents(
    'all',
    (event) => {
      // 当有相关事件时刷新状态
      if (autoRefresh) {
        refresh()
      }
    },
    autoRefresh ? undefined : { pallets: [] } // 如果不需要自动刷新，设置空过滤器
  )

  return {
    status,
    loading,
    error,
    refresh,
  }
}

// ==================== useUserGovernanceRequests Hook ====================

/**
 * React Hook：获取用户的所有治理请求
 *
 * @param account 可选的账户地址（默认使用当前账户）
 * @param filterType 可选的类型过滤
 * @param autoRefresh 是否自动刷新
 *
 * @returns 用户的治理请求列表
 *
 * @example
 * ```tsx
 * const { requests, loading, error, refresh } = useUserGovernanceRequests()
 *
 * return (
 *   <List
 *     loading={loading}
 *     dataSource={requests}
 *     renderItem={item => <List.Item>{item.requestType}</List.Item>}
 *   />
 * )
 * ```
 */
export function useUserGovernanceRequests(
  account?: string,
  filterType?: GovernanceRequestType,
  autoRefresh = false
) {
  const { getUserGovernanceRequests } = useGovernance()
  const { currentAccount } = useWallet()
  const [requests, setRequests] = useState<GovernanceStatusResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetAccount = account || currentAccount

  const refresh = useCallback(async () => {
    if (!targetAccount) {
      setRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await getUserGovernanceRequests(targetAccount, filterType)
      setRequests(result)
    } catch (err: any) {
      setError(err.message || '查询失败')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [getUserGovernanceRequests, targetAccount, filterType])

  // 初始加载
  useEffect(() => {
    refresh()
  }, [refresh])

  // 自动刷新
  useGovernanceEvents(
    'all',
    () => {
      if (autoRefresh) {
        refresh()
      }
    },
    autoRefresh ? { actors: targetAccount ? [targetAccount] : [] } : { pallets: [] }
  )

  return {
    requests,
    loading,
    error,
    refresh,
  }
}
