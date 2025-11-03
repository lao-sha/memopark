/**
 * 纪念馆数据Hooks
 * 
 * 功能说明：
 * 1. useDeceasedInfo - 获取逝者基本信息
 * 2. useOfferingsData - 获取供奉记录数据
 * 3. useMemorialStatistics - 计算统计数据
 * 
 * 创建日期：2025-11-02
 */

import { useState, useEffect } from 'react'
import { getApi } from '../lib/polkadot-safe'
import { createDeceasedService, type DeceasedInfo } from '../services/deceasedService'
import { createMemorialService, type OfferingRecord } from '../services/memorialService'

/**
 * 统计数据类型定义
 */
export interface MemorialStatistics {
  /** 总供奉次数 */
  totalOffers: number
  /** 累计供奉金额（DUST单位） */
  totalAmount: string
  /** 访问量（暂时模拟） */
  visitCount: number
  /** 留言数量 */
  messageCount: number
  /** 鲜花数量 */
  flowerCount: number
  /** 蜡烛数量 */
  candleCount: number
  /** 香数量 */
  incenseCount: number
  /** 祭品数量 */
  offeringCount: number
}

/**
 * 函数级详细中文注释：获取逝者基本信息Hook
 * 
 * @param deceasedId - 逝者ID
 * @returns 逝者信息和加载状态
 */
export const useDeceasedInfo = (deceasedId: number | undefined) => {
  const [deceased, setDeceased] = useState<DeceasedInfo>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!deceasedId) {
      setLoading(false)
      return
    }

    const loadDeceasedInfo = async () => {
      setLoading(true)
      setError(undefined)
      
      try {
        const api = await getApi()
        const service = createDeceasedService(api)
        const info = await service.getDeceased(deceasedId)
        
        if (info) {
          setDeceased(info)
        } else {
          setError('未找到逝者信息')
        }
      } catch (err: any) {
        console.error('加载逝者信息失败:', err)
        setError(err.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadDeceasedInfo()
  }, [deceasedId])

  return { deceased, loading, error }
}

/**
 * 函数级详细中文注释：获取供奉记录数据Hook
 * 
 * @param target - 目标（域代码, 对象ID）
 * @param limit - 数量限制
 * @returns 供奉记录列表和加载状态
 */
export const useOfferingsData = (
  target: [number, number] | undefined,
  limit: number = 50
) => {
  const [offerings, setOfferings] = useState<OfferingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!target) {
      setLoading(false)
      return
    }

    const loadOfferings = async () => {
      setLoading(true)
      setError(undefined)
      
      try {
        const api = await getApi()
        const service = createMemorialService(api)
        const records = await service.getOfferingsForTarget(target, limit)
        setOfferings(records)
      } catch (err: any) {
        console.error('加载供奉记录失败:', err)
        setError(err.message || '加载失败')
        setOfferings([])
      } finally {
        setLoading(false)
      }
    }

    loadOfferings()
  }, [target?.[0], target?.[1], limit])

  return { offerings, loading, error, refresh: () => setOfferings([]) }
}

/**
 * 函数级详细中文注释：计算纪念馆统计数据Hook
 * 
 * @param deceasedId - 逝者ID
 * @param offerings - 供奉记录列表
 * @returns 统计数据
 */
export const useMemorialStatistics = (
  deceasedId: number | undefined,
  offerings: OfferingRecord[]
): MemorialStatistics => {
  const [statistics, setStatistics] = useState<MemorialStatistics>({
    totalOffers: 0,
    totalAmount: '0',
    visitCount: 0,
    messageCount: 0,
    flowerCount: 0,
    candleCount: 0,
    incenseCount: 0,
    offeringCount: 0,
  })

  useEffect(() => {
    if (!deceasedId || offerings.length === 0) {
      return
    }

    // 计算总供奉次数
    const totalOffers = offerings.length

    // 计算累计金额
    const totalAmount = offerings.reduce(
      (sum, offering) => sum + BigInt(offering.amount),
      BigInt(0)
    )

    // 统计各类型数量（假设 kindCode: 1=鲜花, 2=蜡烛, 3=香, 4=祭品）
    const flowerCount = offerings.filter(o => o.kindCode === 1).length
    const candleCount = offerings.filter(o => o.kindCode === 2).length
    const incenseCount = offerings.filter(o => o.kindCode === 3).length
    const offeringCount = offerings.filter(o => o.kindCode >= 4).length

    // 访问量和留言数量（暂时模拟）
    const visitCount = Math.floor(Math.random() * 1000) + 500
    const messageCount = Math.floor(totalOffers * 0.6) // 假设60%的供奉会留言

    setStatistics({
      totalOffers,
      totalAmount: totalAmount.toString(),
      visitCount,
      messageCount,
      flowerCount,
      candleCount,
      incenseCount,
      offeringCount,
    })
  }, [deceasedId, offerings])

  return statistics
}

/**
 * 函数级详细中文注释：格式化DUST金额
 * 
 * @param amount - 金额字符串（最小单位）
 * @returns 格式化后的金额字符串
 */
export const formatDUST = (amount: string): string => {
  try {
    const dust = BigInt(amount) / BigInt(1_000_000)
    return dust.toLocaleString('zh-CN')
  } catch {
    return '0'
  }
}

/**
 * 函数级详细中文注释：格式化地址
 * 
 * @param address - 完整地址
 * @returns 格式化后的地址（前6后4）
 */
export const formatAddress = (address: string): string => {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 函数级详细中文注释：格式化区块时间为相对时间
 * 
 * @param blockNumber - 区块号
 * @param currentBlock - 当前区块号
 * @returns 相对时间字符串
 */
export const formatBlockTime = (blockNumber: number, currentBlock: number): string => {
  const blockDiff = currentBlock - blockNumber
  const minutes = Math.floor((blockDiff * 6) / 60) // 假设6秒/块

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} 天前`
  return `${Math.floor(minutes / 10080)} 周前`
}

/**
 * 函数级详细中文注释：计算享年
 * 
 * @param birthBlock - 出生区块号
 * @param deathBlock - 逝世区块号
 * @returns 享年
 */
export const calculateAge = (birthBlock: number, deathBlock: number): number => {
  // 假设每年约5,256,000个区块（6秒/块）
  const blocksPerYear = 5_256_000
  const years = Math.floor((deathBlock - birthBlock) / blocksPerYear)
  return years
}

