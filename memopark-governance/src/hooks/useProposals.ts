import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/contexts/Api'
import { getActiveProposals, type ProposalInfo } from '@/services/blockchain/council'

/**
 * 提案数据Hook
 * 管理提案列表的加载和刷新
 */
export function useProposals() {
  const { api, isReady } = useApi()
  const [proposals, setProposals] = useState<ProposalInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * 加载提案列表
   */
  const loadProposals = useCallback(async () => {
    if (!isReady || !api) {
      console.log('[useProposals] API未就绪')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getActiveProposals(api)
      setProposals(data)
    } catch (e) {
      const error = e as Error
      console.error('[useProposals] 加载失败:', error)
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [api, isReady])

  /**
   * 初始加载
   */
  useEffect(() => {
    loadProposals()
  }, [loadProposals])

  return {
    proposals,
    loading,
    error,
    reload: loadProposals
  }
}

