/**
 * 治理事件监听服务
 *
 * 功能说明：
 * 1. 标准化所有治理相关事件
 * 2. 提供统一的事件监听接口
 * 3. 支持事件过滤和订阅管理
 * 4. 自动转换为标准事件格式
 *
 * 创建日期：2025-01-20
 */

import type { ApiPromise } from '@polkadot/api'
import type { EventRecord } from '@polkadot/types/interfaces'

/**
 * 统一治理事件接口
 */
export interface StandardGovernanceEvent {
  /** 事件名称 */
  name: string
  /** 事件所属模块 */
  pallet: string
  /** 事件数据 */
  data: {
    /** 请求ID（如果适用） */
    requestId?: number | string
    /** 操作者账户 */
    actor: string
    /** 区块号 */
    blockNumber: number
    /** 区块哈希 */
    blockHash: string
    /** 时间戳（估算） */
    timestamp: number
    /** 事件特定数据 */
    metadata: Record<string, any>
  }
}

/**
 * 治理事件类型枚举
 */
export enum GovernanceEventType {
  // pallet-stardust-appeals 事件
  AppealSubmitted = 'StardustAppeals.AppealSubmitted',
  AppealApproved = 'StardustAppeals.AppealApproved',
  AppealRejected = 'StardustAppeals.AppealRejected',
  AppealWithdrawn = 'StardustAppeals.AppealWithdrawn',
  AppealExecuted = 'StardustAppeals.AppealExecuted',

  // pallet-deceased 事件
  TextComplaintSubmitted = 'Deceased.TextComplaintSubmitted',
  TextComplaintResolved = 'Deceased.TextComplaintResolved',
  MediaComplaintSubmitted = 'Deceased.MediaComplaintSubmitted',
  MediaComplaintResolved = 'Deceased.MediaComplaintResolved',

  // pallet-democracy 事件
  ProposalSubmitted = 'Democracy.Proposed',
  VoteCast = 'Democracy.Voted',
  ProposalPassed = 'Democracy.Passed',
  ProposalNotPassed = 'Democracy.NotPassed',

  // pallet-arbitration 事件
  DisputeSubmitted = 'Arbitration.DisputeSubmitted',
  DisputeResolved = 'Arbitration.DisputeResolved',
}

/**
 * 事件监听回调类型
 */
export type EventCallback = (event: StandardGovernanceEvent) => void

/**
 * 治理事件监听服务
 */
export class GovernanceEventService {
  private api: ApiPromise
  private listeners: Map<GovernanceEventType, Set<EventCallback>>
  private unsubscribe?: () => void
  private isListening = false

  constructor(api: ApiPromise) {
    this.api = api
    this.listeners = new Map()
  }

  /**
   * 订阅治理事件
   *
   * @param eventType 事件类型
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribe(eventType: GovernanceEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(callback)

    // 如果是第一次订阅，启动全局事件监听
    if (!this.isListening) {
      this._startListening()
    }

    // 返回取消订阅函数
    return () => {
      const callbacks = this.listeners.get(eventType)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.listeners.delete(eventType)
        }
      }

      // 如果没有任何订阅，停止全局监听
      if (this.listeners.size === 0) {
        this._stopListening()
      }
    }
  }

  /**
   * 订阅多个事件类型
   *
   * @param eventTypes 事件类型数组
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribeMultiple(eventTypes: GovernanceEventType[], callback: EventCallback): () => void {
    const unsubscribes = eventTypes.map((type) => this.subscribe(type, callback))
    return () => unsubscribes.forEach((unsub) => unsub())
  }

  /**
   * 订阅所有治理事件
   *
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribeAll(callback: EventCallback): () => void {
    const allEventTypes = Object.values(GovernanceEventType)
    return this.subscribeMultiple(allEventTypes, callback)
  }

  /**
   * 启动全局事件监听
   */
  private async _startListening(): Promise<void> {
    if (this.isListening) return

    this.isListening = true
    this.unsubscribe = await this.api.query.system.events((events: EventRecord[]) => {
      events.forEach((record) => {
        const { event } = record
        const eventName = `${event.section}.${event.method}`

        // 查找匹配的事件类型
        const matchedType = Object.values(GovernanceEventType).find((type) => type === eventName)

        if (matchedType && this.listeners.has(matchedType)) {
          const standardEvent = this._transformEvent(record)
          const callbacks = this.listeners.get(matchedType)!
          callbacks.forEach((callback) => {
            try {
              callback(standardEvent)
            } catch (error) {
              console.error('事件回调执行失败:', error)
            }
          })
        }
      })
    })
  }

  /**
   * 停止全局事件监听
   */
  private _stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = undefined
      this.isListening = false
    }
  }

  /**
   * 转换链上事件为标准事件格式
   */
  private _transformEvent(record: EventRecord): StandardGovernanceEvent {
    const { event, phase } = record
    const eventName = `${event.section}.${event.method}`

    // 获取区块号
    let blockNumber = 0
    if (phase.isApplyExtrinsic) {
      blockNumber = phase.asApplyExtrinsic.toNumber()
    }

    // 提取操作者（通常是第一个参数）
    const actor = event.data.length > 0 ? event.data[0]?.toString() || 'unknown' : 'unknown'

    return {
      name: eventName,
      pallet: event.section,
      data: {
        actor,
        blockNumber,
        blockHash: '', // 需要从header获取
        timestamp: Date.now(),
        metadata: this._extractEventMetadata(event),
      },
    }
  }

  /**
   * 提取事件元数据
   */
  private _extractEventMetadata(event: any): Record<string, any> {
    const metadata: Record<string, any> = {}

    // 提取所有事件参数
    event.data.forEach((data: any, index: number) => {
      try {
        // 尝试解析为JSON
        const parsed = data.toJSON()
        metadata[`arg${index}`] = parsed
      } catch {
        // 如果无法解析，使用toString
        metadata[`arg${index}`] = data.toString()
      }
    })

    return metadata
  }

  /**
   * 销毁服务，清理所有订阅
   */
  destroy(): void {
    this._stopListening()
    this.listeners.clear()
  }
}

// ==================== 事件类型映射辅助函数 ====================

/**
 * 根据事件名称获取治理事件类型
 */
export function getGovernanceEventType(eventName: string): GovernanceEventType | null {
  const found = Object.entries(GovernanceEventType).find(([_, value]) => value === eventName)
  return found ? (found[1] as GovernanceEventType) : null
}

/**
 * 检查事件是否为治理事件
 */
export function isGovernanceEvent(eventName: string): boolean {
  return getGovernanceEventType(eventName) !== null
}

/**
 * 按模块分组事件类型
 */
export function getEventTypesByPallet(pallet: string): GovernanceEventType[] {
  return Object.values(GovernanceEventType).filter((eventType) => eventType.startsWith(pallet))
}

// ==================== 事件过滤辅助函数 ====================

/**
 * 事件过滤器类型
 */
export interface EventFilter {
  /** 按pallet过滤 */
  pallets?: string[]
  /** 按操作者过滤 */
  actors?: string[]
  /** 按时间范围过滤（时间戳） */
  timeRange?: {
    start: number
    end: number
  }
  /** 按区块范围过滤 */
  blockRange?: {
    start: number
    end: number
  }
}

/**
 * 创建事件过滤器
 */
export function createEventFilter(filter: EventFilter): (event: StandardGovernanceEvent) => boolean {
  return (event: StandardGovernanceEvent) => {
    // 按pallet过滤
    if (filter.pallets && !filter.pallets.includes(event.pallet)) {
      return false
    }

    // 按操作者过滤
    if (filter.actors && !filter.actors.includes(event.data.actor)) {
      return false
    }

    // 按时间范围过滤
    if (filter.timeRange) {
      const { start, end } = filter.timeRange
      if (event.data.timestamp < start || event.data.timestamp > end) {
        return false
      }
    }

    // 按区块范围过滤
    if (filter.blockRange) {
      const { start, end } = filter.blockRange
      if (event.data.blockNumber < start || event.data.blockNumber > end) {
        return false
      }
    }

    return true
  }
}
