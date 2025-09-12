import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../../lib/polkadot-safe'
import { fetchReferendaRecent, fetchReferendumDetail } from '../lib/governance'

/**
 * 函数级详细中文注释：公投列表与详情的 Hooks（占位实现）
 * - useReferendaList：返回公投卡片基本信息的列表，后续接入链上与索引
 * - useReferendum：返回单个公投详情（状态、轨道、预映像哈希等占位字段）
 * - 设计目标：在无 Subsquid 的前提下可先行开发 UI，不阻塞编译
 */

export interface ReferendumBrief {
  id: number
  title: string
  track: number
  status: 'Deciding' | 'Approved' | 'Rejected' | 'Cancelled' | 'TimedOut'
  endAt?: number
  preimageHash?: string
}

export function useReferendaList() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ReferendumBrief[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchReferendaRecent(10)
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { loading, error, items, reload: load }
}

export interface ReferendumDetail extends ReferendumBrief {
  description?: string
  enactmentDelay?: number
  support?: number
  against?: number
}

export function useReferendum(id?: number) {
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReferendumDetail | null>(null)

  useEffect(() => {
    if (!id) return
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const detail = await fetchReferendumDetail(id)
        setData(detail)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  return { loading, error, data }
}


