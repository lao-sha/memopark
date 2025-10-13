/**
 * usePinStatus Hook
 * 
 * 功能：查询指定CID的Pin状态
 * 
 * 使用场景：
 * - 在逝者页面显示姓名CID的pin状态
 * - 在媒体页面显示图片/视频CID的pin状态
 * - 在证据页面显示证据CID的pin状态
 * 
 * 创建时间：2025-10-12
 */

import { useState, useEffect, useCallback } from 'react';
import { PinRecord, PinStatus, PinStatusResponse } from '@/types';

/**
 * usePinStatus Hook 参数
 */
export interface UsePinStatusOptions {
  /** CID（十六进制字符串） */
  cid: string | null;
  /** 是否启用自动刷新 */
  enablePolling?: boolean;
  /** 轮询间隔（毫秒），默认10秒 */
  pollingInterval?: number;
  /** 是否在挂载时立即查询 */
  immediate?: boolean;
}

/**
 * usePinStatus Hook 返回值
 */
export interface UsePinStatusResult {
  /** Pin记录 */
  record: PinRecord | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动刷新函数 */
  refresh: () => Promise<void>;
  /** 是否正在轮询 */
  isPolling: boolean;
}

/**
 * 查询CID的Pin状态
 * 
 * @param options - Hook配置选项
 * @returns Pin状态和控制函数
 * 
 * @example
 * ```tsx
 * const { record, loading, error, refresh } = usePinStatus({
 *   cid: '0x1234...',
 *   enablePolling: true,
 * });
 * 
 * if (loading) return <Spin />;
 * if (error) return <Alert message={error} type="error" />;
 * if (!record) return <span>未Pin</span>;
 * 
 * return <Badge status="success" text={`${record.currentReplicas}/${record.targetReplicas} 副本`} />;
 * ```
 */
export function usePinStatus(options: UsePinStatusOptions): UsePinStatusResult {
  const { 
    cid, 
    enablePolling = false, 
    pollingInterval = 10000,
    immediate = true 
  } = options;

  const [record, setRecord] = useState<PinRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  /**
   * 查询Pin状态
   */
  const fetchPinStatus = useCallback(async () => {
    if (!cid) {
      setRecord(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // ⚠️ 当前使用模拟数据，等待pallet-memo-ipfs启用后替换为实际API调用
      const response = await fetchPinStatusFromChain(cid);

      if (response.success && response.data) {
        setRecord(response.data);
      } else {
        setError(response.error || '查询失败');
        setRecord(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [cid]);

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    await fetchPinStatus();
  }, [fetchPinStatus]);

  /**
   * 初始查询
   */
  useEffect(() => {
    if (immediate && cid) {
      fetchPinStatus();
    }
  }, [cid, immediate, fetchPinStatus]);

  /**
   * 轮询逻辑
   */
  useEffect(() => {
    if (!enablePolling || !cid) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const timer = setInterval(() => {
      fetchPinStatus();
    }, pollingInterval);

    return () => {
      clearInterval(timer);
      setIsPolling(false);
    };
  }, [enablePolling, cid, pollingInterval, fetchPinStatus]);

  return {
    record,
    loading,
    error,
    refresh,
    isPolling,
  };
}

/**
 * 从链上查询Pin状态（占位实现）
 * 
 * ⚠️ 当前返回模拟数据，需要在pallet-memo-ipfs启用后实现实际查询
 * 
 * 实际实现需要：
 * 1. 连接到Polkadot.js API
 * 2. 查询 memoIpfs.pendingPins(cid)
 * 3. 查询 memoIpfs.activePins(cid)
 * 4. 解析链上数据并转换为PinRecord格式
 */
async function fetchPinStatusFromChain(cid: string): Promise<PinStatusResponse> {
  // ⚠️ 模拟数据 - 实际实现参考示例如下：
  /*
  try {
    const api = await getPolkadotApi();
    
    // 查询PendingPins
    const pending = await api.query.memoIpfs.pendingPins(cid);
    if (pending.isSome) {
      const data = pending.unwrap();
      return {
        success: true,
        data: {
          cid,
          status: PinStatus.Pending,
          currentReplicas: 0,
          targetReplicas: data.replicas.toNumber(),
          deceasedId: data.deceased_id.toNumber(),
          createdAt: data.created_at.toNumber(),
        },
      };
    }

    // 查询ActivePins
    const active = await api.query.memoIpfs.activePins(cid);
    if (active.isSome) {
      const data = active.unwrap();
      return {
        success: true,
        data: {
          cid,
          status: PinStatus.Active,
          currentReplicas: data.current_replicas.toNumber(),
          targetReplicas: data.target_replicas.toNumber(),
          deceasedId: data.deceased_id.toNumber(),
          createdAt: data.created_at.toNumber(),
          updatedAt: data.updated_at.toNumber(),
        },
      };
    }

    return {
      success: false,
      error: 'Pin记录未找到',
    };
  } catch (error) {
    return {
      success: false,
      error: `查询失败: ${error}`,
    };
  }
  */

  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模拟返回数据（用于开发和测试）
  const mockRecord: PinRecord = {
    cid,
    status: PinStatus.Active,
    currentReplicas: 3,
    targetReplicas: 3,
    deceasedId: 100,
    createdAt: Date.now() - 24 * 60 * 60 * 1000, // 1天前
    updatedAt: Date.now() - 1 * 60 * 60 * 1000, // 1小时前
  };

  return {
    success: true,
    data: mockRecord,
  };
}

/**
 * 获取Polkadot.js API实例（占位）
 * 
 * ⚠️ 需要实际实现API连接逻辑
 */
async function getPolkadotApi(): Promise<any> {
  // TODO: 实现实际的API连接
  throw new Error('Polkadot API未实现，请等待pallet-memo-ipfs启用');
}

