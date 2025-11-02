/**
 * 函数级详细中文注释：加载和管理活跃做市商列表
 * 
 * 本Hook从链上activeMarketMakers存储查询所有活跃的做市商信息，
 * 包含费率、EPAY配置、TRON地址等完整字段。
 * 
 * @returns {Object} 做市商数据和操作函数
 * 
 * @example
 * const { marketMakers, loading, error, reload } = useMarketMakers()
 * 
 * if (loading) return <Spin />
 * if (error) return <Alert message={error} />
 * 
 * return <Select>
 *   {marketMakers.map(maker => (
 *     <Option key={maker.mmId} value={maker.mmId}>
 *       {maker.owner}
 *     </Option>
 *   ))}
 * </Select>
 * 
 * @created 2025-10-29
 * @refactor Phase 2 - Day 1 - 从CreateOrderPage.tsx等文件提取
 */

import { useState, useEffect, useCallback } from 'react'
import { getApi } from '../../lib/polkadot'
import { decodeEpayField } from '../../utils/paymentUtils'
import type { MarketMaker } from '../../features/otc/types/order.types'

/**
 * 函数级详细中文注释：useMarketMakers Hook返回值类型
 */
export interface UseMarketMakersReturn {
  /** 做市商列表（按sell溢价升序排列） */
  marketMakers: MarketMaker[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string
  /** 重新加载函数 */
  reload: () => void
}

/**
 * 函数级详细中文注释：加载所有活跃做市商
 * 
 * 从链上activeMarketMakers存储查询所有Active状态的做市商。
 * 自动解码EPAY字段，并按sell溢价升序排序。
 * 
 * @returns {UseMarketMakersReturn} 做市商数据和操作函数
 */
export function useMarketMakers(): UseMarketMakersReturn {
  const [marketMakers, setMarketMakers] = useState<MarketMaker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /**
   * 函数级详细中文注释：从链上加载做市商列表
   * 
   * 执行步骤：
   * 1. 检查pallet是否存在
   * 2. 查询activeMarketMakers.entries()
   * 3. 解析每个做市商的详细信息
   * 4. 解码EPAY字段（十六进制→UTF-8）
   * 5. 按sell溢价升序排序
   */
  const loadMarketMakers = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      
      const api = await getApi()
      
      // 检查pallet是否存在
      if (!(api.query as any).trading) {
        throw new Error('做市商模块尚未在链上注册')
      }

      // 查询所有活跃做市商
      const entries = await (api.query as any).trading.activeMarketMakers.entries()
      
      // 解析做市商数据
      const makers: MarketMaker[] = []
      for (const [key, value] of entries) {
        if (value.isSome) {
          const app = value.unwrap()
          const appData = app.toJSON() as any
          const mmId = key.args[0].toNumber()
          
          makers.push({
            mmId,
            owner: appData.owner || '',
            sellPremiumBps: appData.sellPremiumBps !== undefined ? Number(appData.sellPremiumBps) : 0,
            minAmount: appData.minAmount || '0',
            publicCid: appData.publicCid ?
              (Array.isArray(appData.publicCid) ?
                new TextDecoder().decode(new Uint8Array(appData.publicCid)) :
                appData.publicCid) : '',
            deposit: appData.deposit || '0',
            // EPAY配置字段解码
            epayGateway: decodeEpayField(appData.epayGateway),
            epayPort: appData.epayPort || 0,
            epayPid: decodeEpayField(appData.epayPid),
            epayKey: decodeEpayField(appData.epayKey),
            // TRON地址解码
            tronAddress: decodeEpayField(appData.tronAddress)
          })
        }
      }
      
      // 按sell溢价升序排序（溢价低的做市商优先，用户支付更少）
      makers.sort((a, b) => a.sellPremiumBps - b.sellPremiumBps)
      
      setMarketMakers(makers)
      
      console.log(`✅ [useMarketMakers] 加载到 ${makers.length} 个活跃做市商`)
    } catch (e: any) {
      console.error('[useMarketMakers] 加载失败:', e)
      setError(e?.message || '加载做市商列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 组件挂载时自动加载
  useEffect(() => {
    loadMarketMakers()
  }, [loadMarketMakers])

  return {
    marketMakers,
    loading,
    error,
    reload: loadMarketMakers
  }
}

