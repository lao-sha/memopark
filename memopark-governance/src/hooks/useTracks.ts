import { useState, useEffect, useCallback } from 'react'
import { useApi } from '@/contexts/Api'
import { getTracks, DEFAULT_TRACKS, type TrackInfo } from '@/services/blockchain/tracks'

/**
 * 轨道数据Hook
 * 管理轨道配置的加载和访问
 */
export function useTracks() {
  const { api, isReady } = useApi()
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * 加载轨道配置
   */
  const loadTracks = useCallback(async () => {
    if (!isReady || !api) {
      console.log('[useTracks] API未就绪')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await getTracks(api)
      
      // 如果链上没有配置，使用默认轨道元数据
      if (data.length === 0) {
        console.log('[useTracks] 使用默认轨道配置')
        // 转换为TrackInfo格式（简化版）
        const defaultTrackInfos: TrackInfo[] = DEFAULT_TRACKS.map(t => ({
          id: t.id,
          name: t.name,
          maxDeciding: 10,
          decisionDeposit: '0',
          preparePeriod: 0,
          decisionPeriod: 0,
          confirmPeriod: 0,
          minEnactmentPeriod: 0,
          minApproval: null,
          minSupport: null
        }))
        setTracks(defaultTrackInfos)
      } else {
        setTracks(data)
      }
      
      console.log('[useTracks] 加载完成，共', data.length, '个轨道')
    } catch (e) {
      const error = e as Error
      console.error('[useTracks] 加载失败:', error)
      setError(error)
      // 出错时也使用默认配置
      const defaultTrackInfos: TrackInfo[] = DEFAULT_TRACKS.map(t => ({
        id: t.id,
        name: t.name,
        maxDeciding: 10,
        decisionDeposit: '0',
        preparePeriod: 0,
        decisionPeriod: 0,
        confirmPeriod: 0,
        minEnactmentPeriod: 0,
        minApproval: null,
        minSupport: null
      }))
      setTracks(defaultTrackInfos)
    } finally {
      setLoading(false)
    }
  }, [api, isReady])

  /**
   * 初始加载
   */
  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  return {
    tracks,
    loading,
    error,
    reload: loadTracks,
    trackCount: tracks.length
  }
}

/**
 * 获取单个轨道Hook
 */
export function useTrack(trackId: number) {
  const { tracks, loading } = useTracks()
  const track = tracks.find((t) => t.id === trackId)
  
  return {
    track,
    loading,
    exists: !!track
  }
}

/**
 * 按类别获取轨道
 */
export function useTracksByCategory() {
  const { tracks, loading } = useTracks()
  
  const categorized = {
    system: tracks.filter(t => t.id <= 1),
    treasury: tracks.filter(t => t.id >= 2 && t.id <= 9),
    business: tracks.filter(t => t.id >= 10 && t.id <= 19),
    governance: tracks.filter(t => t.id >= 20)
  }
  
  return {
    ...categorized,
    loading
  }
}

