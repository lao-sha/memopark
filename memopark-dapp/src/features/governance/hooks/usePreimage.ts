import { useEffect, useState } from 'react'
import { getApi } from '../../../lib/polkadot-safe'
import { fetchPreimageInfo } from '../lib/governance'

/**
 * 函数级详细中文注释：预映像查询 Hook（Legacy 占位）
 * - 主流程为“内容委员会 + 申诉治理”，预映像相关仅用于旧记录解析
 */
export interface PreimageInfo { hash: string; length?: number; provider?: string; available: boolean }

export function usePreimage(hash?: string) {
  const [loading, setLoading] = useState(!!hash)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PreimageInfo | null>(null)

  useEffect(() => {
    if (!hash) return
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const info = await fetchPreimageInfo(hash)
        setData(info)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [hash])

  return { loading, error, data }
}


