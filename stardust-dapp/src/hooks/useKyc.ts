import { useEffect, useState } from 'react'
import { getApi } from '../lib/polkadot-safe'

/**
 * 函数级详细中文注释：读取基于 pallet-identity 的 KYC 判定（KnownGood/Reasonable 即视为通过）
 * - 输入：account 地址（SS58 字符串）；
 * - 输出：{ loading, verified, error }
 */
export function useKyc(account?: string | null) {
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!account) { setVerified(false); return }
    let stopped = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const api = await getApi()
        const reg = await (api.query as any).identity.identityOf(account)
        const json = reg?.toJSON?.() as any
        const judgements: any[] = json?.judgements || []
        const ok = judgements.some(([, j]) => j === 'KnownGood' || j === 'Reasonable')
        if (!stopped) setVerified(ok)
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!stopped) setLoading(false)
      }
    })()
    return () => { stopped = true }
  }, [account])

  return { loading, verified, error }
}


