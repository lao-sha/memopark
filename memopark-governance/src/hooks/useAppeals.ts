import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/contexts/Api'
import {
  getAllAppeals,
  getPendingAppeals,
  getApprovedAppeals,
  getRejectedAppeals,
  type AppealInfo
} from '@/services/blockchain/contentGovernance'

/**
 * 申诉数据Hook
 */
export function useAppeals(filter?: 'all' | 'pending' | 'approved' | 'rejected') {
  const { api, isReady } = useApi()
  const [appeals, setAppeals] = useState<AppealInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * 加载申诉列表
   */
  const loadAppeals = useCallback(async () => {
    if (!isReady || !api) {
      console.log('[useAppeals] API未就绪')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let data: AppealInfo[]

      switch (filter) {
        case 'pending':
          data = await getPendingAppeals(api)
          break
        case 'approved':
          data = await getApprovedAppeals(api)
          break
        case 'rejected':
          data = await getRejectedAppeals(api)
          break
        default:
          data = await getAllAppeals(api)
      }

      setAppeals(data)
    } catch (e) {
      const error = e as Error
      console.error('[useAppeals] 加载失败:', error)
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [api, isReady, filter])

  /**
   * 初始加载
   */
  useEffect(() => {
    loadAppeals()
  }, [loadAppeals])

  return {
    appeals,
    loading,
    error,
    reload: loadAppeals
  }
}

