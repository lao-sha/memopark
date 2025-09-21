import { useCallback, useEffect, useState } from 'react'
import { getApi } from '../../../lib/polkadot-safe'
import { fetchReferendaRecent, fetchReferendumDetail } from '../lib/governance'

/**
 * 函数级详细中文注释：公投列表与详情 Hooks（Legacy 占位）
 * - 说明：主流程已迁移到“委员会阈值 + 申诉治理”；此处仅为兼容旧页面的占位实现
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


