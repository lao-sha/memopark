/**
 * useDeceasedEvents Hook
 * 
 * 功能：监听Deceased Pallet的链上事件
 * 
 * 支持的事件：
 * - DeceasedCreated: 逝者创建
 * - DeceasedUpdated: 逝者更新
 * - MainImageUpdated: 主图更新（增强版，包含操作者）
 * - AutoPinSuccess: IPFS自动pin成功
 * - AutoPinFailed: IPFS自动pin失败
 * 
 * 创建时间：2025-10
 */

import { useState, useEffect, useCallback } from 'react';
import { getApi } from '@/lib/polkadot-safe';

/**
 * Pin错误码枚举
 */
export enum PinErrorCode {
  Unknown = 0,           // 未知错误
  InsufficientBalance = 1, // 余额不足
  NetworkError = 2,      // IPFS网络错误
  InvalidCid = 3,        // CID格式无效
}

/**
 * Pin类型枚举
 */
export enum AutoPinType {
  NameFullCid = 0,  // 全名CID
  MainImage = 1,    // 主图CID
}

/**
 * Deceased事件类型
 */
export interface DeceasedEvent {
  /** 事件名称 */
  event: 'DeceasedCreated' | 'DeceasedUpdated' | 'MainImageUpdated' | 'AutoPinSuccess' | 'AutoPinFailed';
  /** 逝者ID */
  deceasedId: number;
  /** 区块号 */
  blockNumber: number;
  /** 事件索引 */
  eventIndex: number;
  /** 额外数据（根据事件类型不同） */
  data?: any;
}

/**
 * DeceasedCreated 事件数据
 */
export interface DeceasedCreatedData {
  deceasedId: number;
  graveId: number;
  owner: string;
}

/**
 * MainImageUpdated 事件数据
 */
export interface MainImageUpdatedData {
  deceasedId: number;
  operator: string;  // 操作者账户
  isSet: boolean;    // true=设置，false=清空
}

/**
 * AutoPinSuccess 事件数据
 */
export interface AutoPinSuccessData {
  deceasedId: number;
  cid: string;       // 十六进制CID
  pinType: AutoPinType;
}

/**
 * AutoPinFailed 事件数据
 */
export interface AutoPinFailedData {
  deceasedId: number;
  cid: string;       // 十六进制CID
  pinType: AutoPinType;
  errorCode: PinErrorCode;
}

/**
 * useDeceasedEvents Hook 返回值
 */
export interface UseDeceasedEventsResult {
  /** 最近的事件列表（最多保留100条） */
  events: DeceasedEvent[];
  /** 是否正在监听 */
  listening: boolean;
  /** 错误信息 */
  error: string | null;
  /** 清空事件列表 */
  clearEvents: () => void;
  /** 根据逝者ID获取相关事件 */
  getEventsByDeceasedId: (deceasedId: number) => DeceasedEvent[];
  /** 获取最近的AutoPinFailed事件 */
  getRecentPinFailures: () => AutoPinFailedData[];
}

/**
 * 监听Deceased Pallet的链上事件
 * 
 * @param enabled - 是否启用监听，默认true
 * @returns 事件列表和控制函数
 * 
 * @example
 * ```tsx
 * const { events, getEventsByDeceasedId, getRecentPinFailures } = useDeceasedEvents();
 * 
 * // 在创建逝者后监听结果
 * useEffect(() => {
 *   const deceasedEvents = getEventsByDeceasedId(123);
 *   const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed');
 *   if (pinFailed) {
 *     showWarning(`Pin失败: ${getPinErrorMessage(pinFailed.data.errorCode)}`);
 *   }
 * }, [events]);
 * ```
 */
export function useDeceasedEvents(enabled: boolean = true): UseDeceasedEventsResult {
  const [events, setEvents] = useState<DeceasedEvent[]>([]);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 清空事件列表
   */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  /**
   * 根据逝者ID获取相关事件
   */
  const getEventsByDeceasedId = useCallback((deceasedId: number): DeceasedEvent[] => {
    return events.filter(e => e.deceasedId === deceasedId);
  }, [events]);

  /**
   * 获取最近的AutoPinFailed事件
   */
  const getRecentPinFailures = useCallback((): AutoPinFailedData[] => {
    return events
      .filter(e => e.event === 'AutoPinFailed')
      .map(e => e.data as AutoPinFailedData)
      .slice(0, 10); // 最多返回10条
  }, [events]);

  /**
   * 解析事件数据
   */
  const parseEventData = useCallback((eventName: string, eventData: any): any => {
    try {
      switch (eventName) {
        case 'DeceasedCreated': {
          const [deceasedId, graveId, owner] = eventData;
          return {
            deceasedId: deceasedId.toNumber(),
            graveId: graveId.toNumber(),
            owner: owner.toString(),
          } as DeceasedCreatedData;
        }

        case 'MainImageUpdated': {
          const [deceasedId, operator, isSet] = eventData;
          return {
            deceasedId: deceasedId.toNumber(),
            operator: operator.toString(),
            isSet: isSet.toJSON(),
          } as MainImageUpdatedData;
        }

        case 'AutoPinSuccess': {
          const [deceasedId, cid, pinType] = eventData;
          return {
            deceasedId: deceasedId.toNumber(),
            cid: cid.toHex(),
            pinType: pinType.toNumber(),
          } as AutoPinSuccessData;
        }

        case 'AutoPinFailed': {
          const [deceasedId, cid, pinType, errorCode] = eventData;
          return {
            deceasedId: deceasedId.toNumber(),
            cid: cid.toHex(),
            pinType: pinType.toNumber(),
            errorCode: errorCode.toNumber(),
          } as AutoPinFailedData;
        }

        default:
          return eventData;
      }
    } catch (err) {
      console.error(`解析事件 ${eventName} 失败:`, err);
      return eventData;
    }
  }, []);

  /**
   * 启动事件监听
   */
  useEffect(() => {
    if (!enabled) {
      setListening(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const startListening = async () => {
      try {
        setError(null);
        const api = await getApi();

        // 查找deceased模块（适配多种命名）
        const queryRoot: any = api.query;
        let deceasedModule: any = queryRoot.deceased || queryRoot.Deceased;
        
        if (!deceasedModule) {
          const foundKey = Object.keys(queryRoot).find(k => /^deceased$/i.test(k));
          if (foundKey) deceasedModule = queryRoot[foundKey];
        }

        if (!deceasedModule) {
          throw new Error('Deceased模块未找到');
        }

        // 订阅系统事件
        unsubscribe = await api.query.system.events((records: any[]) => {
          const deceasedEvents: DeceasedEvent[] = [];

          records.forEach((record) => {
            const { event, phase } = record;
            
            // 只处理deceased模块的事件
            if (event.section !== 'deceased') return;

            const eventName = event.method;
            
            // 只处理我们关心的事件
            if (![
              'DeceasedCreated',
              'DeceasedUpdated',
              'MainImageUpdated',
              'AutoPinSuccess',
              'AutoPinFailed',
            ].includes(eventName)) {
              return;
            }

            // 提取逝者ID（所有事件的第一个参数）
            const deceasedId = event.data[0]?.toNumber?.() || 0;

            // 解析事件数据
            const parsedData = parseEventData(eventName, event.data);

            deceasedEvents.push({
              event: eventName as any,
              deceasedId,
              blockNumber: phase.asApplyExtrinsic?.toNumber?.() || 0,
              eventIndex: record.eventIndex?.toNumber?.() || 0,
              data: parsedData,
            });
          });

          // 添加新事件（保留最多100条）
          if (deceasedEvents.length > 0) {
            setEvents(prev => [...deceasedEvents, ...prev].slice(0, 100));
          }
        });

        setListening(true);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '启动监听失败';
        setError(errMsg);
        console.error('启动Deceased事件监听失败:', err);
        setListening(false);
      }
    };

    startListening();

    return () => {
      if (unsubscribe) {
        unsubscribe();
        setListening(false);
      }
    };
  }, [enabled, parseEventData]);

  return {
    events,
    listening,
    error,
    clearEvents,
    getEventsByDeceasedId,
    getRecentPinFailures,
  };
}

/**
 * 获取Pin错误码的用户友好消息
 */
export function getPinErrorMessage(errorCode: PinErrorCode): string {
  switch (errorCode) {
    case PinErrorCode.InsufficientBalance:
      return '余额不足，请充值后重试';
    case PinErrorCode.NetworkError:
      return 'IPFS网络错误，请稍后重试';
    case PinErrorCode.InvalidCid:
      return 'CID格式无效，请检查';
    case PinErrorCode.Unknown:
    default:
      return '未知错误';
  }
}

/**
 * 获取Pin错误码的建议操作
 */
export function getPinErrorSuggestion(errorCode: PinErrorCode): string {
  switch (errorCode) {
    case PinErrorCode.InsufficientBalance:
      return '请充值后可在个人中心重试固定';
    case PinErrorCode.NetworkError:
      return 'IPFS网络暂时不可用，系统会自动重试';
    case PinErrorCode.InvalidCid:
      return '请检查CID是否正确，必要时重新上传';
    case PinErrorCode.Unknown:
    default:
      return '请联系客服处理';
  }
}

/**
 * 获取Pin类型的显示名称
 */
export function getPinTypeName(pinType: AutoPinType): string {
  switch (pinType) {
    case AutoPinType.NameFullCid:
      return '姓名';
    case AutoPinType.MainImage:
      return '主图';
    default:
      return '未知';
  }
}

