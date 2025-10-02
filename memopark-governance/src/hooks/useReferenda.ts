import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/contexts/Api'
import {
  getAllReferenda,
  getReferendumsByTrack,
  getReferendumInfo,
  type ReferendumInfo
} from '@/services/blockchain/referenda'

/**
 * 公投数据Hook
 * 管理公投列表的加载
 */
export function useReferenda(trackId?: number) {
  const { api, isReady } = useApi()
  const [referenda, setReferenda] = useState<ReferendumInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * 加载公投列表
   */
  const loadReferenda = useCallback(async () => {
    if (!isReady || !api) {
      console.log('[useReferenda] API未就绪')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data =
        trackId !== undefined
          ? await getReferendumsByTrack(api, trackId)
          : await getAllReferenda(api)

      setReferenda(data)
      console.log('[useReferenda] 加载完成，共', data.length, '个公投')
    } catch (e) {
      const error = e as Error
      console.error('[useReferenda] 加载失败:', error)
      setError(error)
    } finally {
      setLoading(false)
    }
  }, [api, isReady, trackId])

  /**
   * 初始加载
   */
  useEffect(() => {
    loadReferenda()
  }, [loadReferenda])

  return {
    referenda,
    loading,
    error,
    reload: loadReferenda,
    count: referenda.length
  }
}

/**
 * 单个公投Hook
 */
export function useReferendum(refId: number) {
  const { api, isReady } = useApi()
  const [referendum, setReferendum] = useState<ReferendumInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!isReady || !api) return

    const loadReferendum = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await getReferendumInfo(api, refId)
        setReferendum(data)
      } catch (e) {
        setError(e as Error)
      } finally {
        setLoading(false)
      }
    }

    loadReferendum()
  }, [api, isReady, refId])

  return {
    referendum,
    loading,
    error
  }
}

