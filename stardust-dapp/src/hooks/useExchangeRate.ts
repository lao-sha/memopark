/**
 * 汇率查询自定义Hook
 *
 * 功能说明：
 * 1. 从链上查询当前DUST/USDT汇率
 * 2. 自动处理1e6缩放因子
 * 3. 提供缓存和重试机制
 * 4. 支持手动刷新
 *
 * 创建日期：2025-11-22
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getApi } from '../../lib/polkadot-safe'

export interface ExchangeRateData {
  /** 原始汇率值（链上值，包含1e6缩放） */
  rawRate: number
  /** 实际汇率值（已除以1e6） */
  actualRate: number
  /** 最后更新时间 */
  lastUpdated: number
  /** 是否为缓存数据 */
  isCached: boolean
}

/**
 * 函数级详细中文注释：查询链上汇率数据
 */
const fetchExchangeRate = async (): Promise<ExchangeRateData> => {
  try {
    const api = await getApi()

    // 查询pricing pallet的当前汇率
    // 根据backend代码，汇率存储在pallet-pricing中，scaled by 1e6
    const rateOption = await api.query.pricing?.currentRate?.()

    if (!rateOption || rateOption.isEmpty) {
      // 如果没有汇率数据，使用默认值
      console.warn('链上未找到汇率数据，使用默认汇率')
      const defaultRawRate = 500000 // 默认 0.5 USDT per DUST
      return {
        rawRate: defaultRawRate,
        actualRate: defaultRawRate / 1e6,
        lastUpdated: Date.now(),
        isCached: false
      }
    }

    // 解析链上汇率数据
    const rateData = rateOption.unwrap()
    const rawRate = parseInt(rateData.toString())

    return {
      rawRate,
      actualRate: rawRate / 1e6,
      lastUpdated: Date.now(),
      isCached: false
    }
  } catch (error) {
    console.error('查询汇率失败:', error)

    // 出错时返回默认汇率
    const defaultRawRate = 500000 // 默认 0.5 USDT per DUST
    return {
      rawRate: defaultRawRate,
      actualRate: defaultRawRate / 1e6,
      lastUpdated: Date.now(),
      isCached: true
    }
  }
}

/**
 * 函数级详细中文注释：汇率查询Hook
 */
export const useExchangeRate = (options?: {
  /** 自动刷新间隔（毫秒），默认10分钟 */
  refetchInterval?: number
  /** 是否启用自动刷新 */
  enabled?: boolean
}) => {
  const {
    refetchInterval = 10 * 60 * 1000, // 10分钟
    enabled = true
  } = options || {}

  const {
    data,
    error,
    isLoading,
    isError,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['exchangeRate'],
    queryFn: fetchExchangeRate,
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    gcTime: 15 * 60 * 1000, // 15分钟缓存时间
    refetchInterval: enabled ? refetchInterval : false,
    enabled,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
  })

  const refreshRate = useCallback(() => {
    refetch()
  }, [refetch])

  return {
    /** 汇率数据 */
    exchangeRate: data,
    /** 原始汇率值（链上值） */
    rawRate: data?.rawRate,
    /** 实际汇率值（已处理缩放） */
    actualRate: data?.actualRate,
    /** 是否加载中 */
    isLoading: isLoading || isFetching,
    /** 是否有错误 */
    isError,
    /** 错误信息 */
    error: error as Error | null,
    /** 手动刷新 */
    refreshRate,
    /** 最后更新时间 */
    lastUpdated: data?.lastUpdated,
    /** 是否为缓存数据 */
    isCached: data?.isCached || false
  }
}

/**
 * 函数级详细中文注释：DUST转USDT计算Hook
 */
export const useDustToUsdt = (dustAmount: string | number) => {
  const { actualRate, isLoading, isError } = useExchangeRate()

  const [usdtAmount, setUsdtAmount] = useState<number | null>(null)

  useEffect(() => {
    if (!dustAmount || !actualRate || isLoading || isError) {
      setUsdtAmount(null)
      return
    }

    try {
      const numDust = typeof dustAmount === 'string' ? parseFloat(dustAmount) : dustAmount
      if (isNaN(numDust)) {
        setUsdtAmount(null)
        return
      }

      // 链上DUST需要除以1e12转换为实际值
      const actualDust = numDust / 1e12
      const calculatedUsdt = actualDust * actualRate

      setUsdtAmount(Math.round(calculatedUsdt * 100) / 100) // 保留2位小数
    } catch (error) {
      console.error('DUST转USDT计算失败:', error)
      setUsdtAmount(null)
    }
  }, [dustAmount, actualRate, isLoading, isError])

  return {
    usdtAmount,
    isCalculating: isLoading,
    calculationError: isError
  }
}

/**
 * 函数级详细中文注释：USDT转DUST计算Hook
 */
export const useUsdtToDust = (usdtAmount: number) => {
  const { actualRate, isLoading, isError } = useExchangeRate()

  const [dustAmount, setDustAmount] = useState<string | null>(null)

  useEffect(() => {
    if (!usdtAmount || !actualRate || isLoading || isError || actualRate === 0) {
      setDustAmount(null)
      return
    }

    try {
      // 计算实际DUST值
      const actualDust = usdtAmount / actualRate
      // 转换为链上值（乘以1e12）
      const chainDust = actualDust * 1e12

      setDustAmount(chainDust.toString())
    } catch (error) {
      console.error('USDT转DUST计算失败:', error)
      setDustAmount(null)
    }
  }, [usdtAmount, actualRate, isLoading, isError])

  return {
    dustAmount,
    isCalculating: isLoading,
    calculationError: isError
  }
}

export default useExchangeRate