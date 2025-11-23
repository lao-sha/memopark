/**
 * 押金计算自定义Hook
 *
 * 功能说明：
 * 1. 查询链上押金配置和计算逻辑
 * 2. 支持分类修改申请押金查询
 * 3. 支持创建逝者押金查询
 * 4. 提供动态押金金额计算
 *
 * 创建日期：2025-11-22
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getApi } from '../../lib/polkadot-safe'
import { useExchangeRate, useDustToUsdt } from './useExchangeRate'

export interface DepositInfo {
  /** 押金金额（USDT） */
  usdtAmount: number
  /** 押金金额（DUST链上值） */
  dustAmount: string
  /** 押金金额（DUST显示值） */
  dustDisplay: number
  /** 计算时使用的汇率 */
  exchangeRate: number
  /** 押金类型 */
  type: 'category_change' | 'create_deceased' | 'custom'
  /** 是否为估算值 */
  isEstimate: boolean
}

/**
 * 函数级详细中文注释：查询分类修改申请押金
 */
const fetchCategoryChangeDeposit = async (): Promise<DepositInfo> => {
  try {
    const api = await getApi()

    // 分类修改申请押金：固定10 USDT等值的DUST
    // 注意：当前后端代码存在bug，应该使用USDT计价而不是固定10 DUST
    const fixedUsdtAmount = 10

    // 获取当前汇率
    const rateOption = await api.query.pricing?.currentRate?.()
    const exchangeRate = rateOption && !rateOption.isEmpty
      ? parseInt(rateOption.unwrap().toString())
      : 500000 // 默认汇率 0.5 USDT per DUST

    const actualRate = exchangeRate / 1e6

    // 计算10 USDT等值的DUST数量
    const dustDisplay = fixedUsdtAmount / actualRate
    const chainDustAmount = (dustDisplay * 1e12).toString()

    return {
      usdtAmount: fixedUsdtAmount,
      dustAmount: chainDustAmount,
      dustDisplay: Math.round(dustDisplay * 10000) / 10000, // 保留4位小数
      exchangeRate,
      type: 'category_change',
      isEstimate: false
    }
  } catch (error) {
    console.error('查询分类修改押金失败:', error)

    // 返回默认值（按0.5汇率估算：10 USDT = 20 DUST）
    return {
      usdtAmount: 10,
      dustAmount: (20 * 1e12).toString(),
      dustDisplay: 20,
      exchangeRate: 500000,
      type: 'category_change',
      isEstimate: true
    }
  }
}

/**
 * 函数级详细中文注释：查询创建逝者押金
 */
const fetchCreateDeceasedDeposit = async (
  account?: string,
  contentScale: 'Small' | 'Medium' | 'Large' = 'Medium'
): Promise<DepositInfo> => {
  try {
    const api = await getApi()

    // 查询动态押金配置
    // 根据后端代码，押金计算在 governance::DepositCalculator 中
    // 这里模拟计算逻辑（实际应该调用链上接口）

    let baseUsdtAmount: number
    switch (contentScale) {
      case 'Small':
        baseUsdtAmount = 20
        break
      case 'Medium':
        baseUsdtAmount = 50
        break
      case 'Large':
        baseUsdtAmount = 100
        break
      default:
        baseUsdtAmount = 50
    }

    // TODO: 这里应该调用实际的链上押金计算接口
    // 当前使用模拟逻辑

    const rateOption = await api.query.pricing?.currentRate?.()
    const exchangeRate = rateOption && !rateOption.isEmpty
      ? parseInt(rateOption.unwrap().toString())
      : 500000

    const actualRate = exchangeRate / 1e6
    const dustDisplay = baseUsdtAmount / actualRate
    const chainDustAmount = (dustDisplay * 1e12).toString()

    return {
      usdtAmount: baseUsdtAmount,
      dustAmount: chainDustAmount,
      dustDisplay: Math.round(dustDisplay * 10000) / 10000, // 保留4位小数
      exchangeRate,
      type: 'create_deceased',
      isEstimate: true // 目前是估算值，等后端接口完善后改为false
    }
  } catch (error) {
    console.error('查询创建逝者押金失败:', error)

    return {
      usdtAmount: 50,
      dustAmount: (100 * 1e12).toString(),
      dustDisplay: 100,
      exchangeRate: 500000,
      type: 'create_deceased',
      isEstimate: true
    }
  }
}

/**
 * 函数级详细中文注释：分类修改申请押金查询Hook
 */
export const useCategoryChangeDeposit = (options?: {
  enabled?: boolean
  refetchInterval?: number
}) => {
  const { enabled = true, refetchInterval = 5 * 60 * 1000 } = options || {}

  const {
    data,
    error,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['categoryChangeDeposit'],
    queryFn: fetchCategoryChangeDeposit,
    staleTime: 3 * 60 * 1000, // 3分钟
    gcTime: 10 * 60 * 1000,
    refetchInterval: enabled ? refetchInterval : false,
    enabled,
    retry: 2
  })

  return {
    depositInfo: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}

/**
 * 函数级详细中文注释：创建逝者押金查询Hook
 */
export const useCreateDeceasedDeposit = (
  account?: string,
  contentScale: 'Small' | 'Medium' | 'Large' = 'Medium',
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) => {
  const { enabled = true, refetchInterval = 5 * 60 * 1000 } = options || {}

  const {
    data,
    error,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['createDeceasedDeposit', account, contentScale],
    queryFn: () => fetchCreateDeceasedDeposit(account, contentScale),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: enabled ? refetchInterval : false,
    enabled: enabled && !!account,
    retry: 2
  })

  return {
    depositInfo: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch
  }
}

/**
 * 函数级详细中文注释：通用押金信息Hook
 */
export const useDepositInfo = (
  type: 'category_change' | 'create_deceased',
  options?: {
    account?: string
    contentScale?: 'Small' | 'Medium' | 'Large'
    enabled?: boolean
  }
) => {
  const { account, contentScale = 'Medium', enabled = true } = options || {}

  const categoryResult = useCategoryChangeDeposit({
    enabled: enabled && type === 'category_change'
  })

  const createResult = useCreateDeceasedDeposit(
    account,
    contentScale,
    { enabled: enabled && type === 'create_deceased' }
  )

  const result = type === 'category_change' ? categoryResult : createResult

  return {
    ...result,
    /** 快速访问押金金额（USDT） */
    usdtAmount: result.depositInfo?.usdtAmount,
    /** 快速访问押金金额（DUST显示值） */
    dustAmount: result.depositInfo?.dustDisplay,
    /** 快速访问押金金额（DUST链上值） */
    chainDustAmount: result.depositInfo?.dustAmount,
    /** 是否为估算值 */
    isEstimate: result.depositInfo?.isEstimate || false
  }
}

export default useDepositInfo