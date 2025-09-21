import { useEffect, useMemo, useState } from 'react'
import { getApi } from '../lib/polkadot-safe'

/**
 * 函数级详细中文注释：读取链上报价与风控参数的 Hook（pallet-pricing + memo-bridge）
 * - 周期性轮询报价与参数，用于移动端展示“价格/陈旧/暂停/费率”等信息
 * - 返回：price({num,den,lastUpdated})、pricingParams、bridgeParams、stale/paused、loading 与刷新函数
 */
export function usePricing(pollMs: number = 10000) {
  const [price, setPrice] = useState<{ num: bigint; den: bigint; lastUpdated: bigint } | null>(null)
  const [pricingParams, setPricingParams] = useState<{ staleSeconds: number; maxJumpBps: number; paused: boolean } | null>(null)
  const [bridgeParams, setBridgeParams] = useState<{ feeBps: number } | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchAll() {
    try {
      setLoading(true)
      setError(null)
      const api = await getApi()
      const [pRaw, paramRaw, bRaw] = await Promise.all([
        (api.query as any).pricing.price(),
        (api.query as any).pricing.params(),
        (api.query as any).memoBridge.params(),
      ])
      const p = pRaw.toJSON() as any
      const pr = paramRaw.toJSON() as any
      const br = bRaw.toJSON() as any
      setPrice(p && p.priceNum && p.priceDen ? { num: BigInt(p.priceNum), den: BigInt(p.priceDen), lastUpdated: BigInt(p.lastUpdated || 0) } : null)
      setPricingParams(pr ? { staleSeconds: Number(pr.staleSeconds || 0), maxJumpBps: Number(pr.maxJumpBps || 0), paused: !!pr.paused } : null)
      setBridgeParams(br ? { feeBps: Number(br.fee_bps ?? br.feeBps ?? 0) } : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, pollMs)
    return () => clearInterval(t)
  }, [pollMs])

  const nowSec = Math.floor(Date.now() / 1000)
  const stale = useMemo(() => {
    if (!price || !pricingParams) return true
    return nowSec - Number(price.lastUpdated) > pricingParams.staleSeconds
  }, [nowSec, price, pricingParams])

  const paused = !!pricingParams?.paused

  return { price, pricingParams, bridgeParams, stale, paused, loading, error, refresh: fetchAll }
}


