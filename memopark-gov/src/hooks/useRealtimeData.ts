/**
 * 实时数据同步钩子
 * 函数级中文注释：提供实时数据更新功能，确保界面数据与链上数据同步
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';

/**
 * 函数级中文注释：实时数据配置接口
 */
interface RealtimeConfig<T> {
  queryFn: () => Promise<T>;
  interval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
  compareFn?: (oldData: T, newData: T) => boolean;
  pauseOnHidden?: boolean; // 页面隐藏时暂停轮询，默认为 true
}

/**
 * 函数级中文注释：实时数据状态接口
 */
interface RealtimeState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdate: number | null;
  isStale: boolean;
}

/**
 * 函数级中文注释：实时数据钩子返回值
 */
interface UseRealtimeDataReturn<T> extends RealtimeState<T> {
  refetch: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  forceUpdate: () => Promise<void>;
}

/**
 * 函数级中文注释：实时数据同步钩子
 */
export function useRealtimeData<T>({
  queryFn,
  interval = 10000, // 默认10秒
  enabled = true,
  onError,
  onSuccess,
  compareFn = (oldData, newData) => JSON.stringify(oldData) !== JSON.stringify(newData),
  pauseOnHidden = true
}: RealtimeConfig<T>): UseRealtimeDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const isFetchingRef = useRef(false);

  /**
   * 函数级中文注释：执行数据获取
   */
  const fetchData = useCallback(async (isRetry = false) => {
    if (!isEnabled) return;
    if (isFetchingRef.current) return; // 并发请求锁，避免重入

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      const newData = await queryFn();

      // 检查数据是否有变化
      if (lastDataRef.current && !compareFn(lastDataRef.current, newData)) {
        // 数据无变化
        setIsStale(false);
        // 降低日志噪声，避免控制台卡顿
        // console.log('📡 数据无变化，保持当前状态');
        return;
      }

      setData(newData);
      setLastUpdate(Date.now());
      setIsStale(false);
      lastDataRef.current = newData;
      retryCountRef.current = 0;

      onSuccess?.(newData);
      // console.log('📡 数据更新成功');

    } catch (err: any) {
      const errorMessage = err.message || '数据获取失败';
      setError(errorMessage);

      // 重试机制
      if (!isRetry && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`🔄 第 ${retryCountRef.current} 次重试...`);

        setTimeout(() => {
          fetchData(true);
        }, 2000 * retryCountRef.current); // 递增延迟
        return;
      }

      console.error('❌ 数据获取失败:', err);
      onError?.(err);

      // 显示用户友好的错误提示
      if (retryCountRef.current >= maxRetries) {
        message.error(`数据获取失败: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isEnabled, queryFn, onSuccess, onError, compareFn]);

  /**
   * 函数级中文注释：手动刷新数据
   */
  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  /**
   * 函数级中文注释：强制更新数据（忽略缓存）
   */
  const forceUpdate = useCallback(async () => {
    setIsStale(true);
    await fetchData();
  }, [fetchData]);

  /**
   * 函数级中文注释：设置启用状态
   */
  const handleSetEnabled = useCallback((newEnabled: boolean) => {
    setIsEnabled(newEnabled);

    if (newEnabled && !intervalRef.current) {
      // 启动定时器
      intervalRef.current = setInterval(() => {
        fetchData();
      }, interval);
    } else if (!newEnabled && intervalRef.current) {
      // 停止定时器
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [interval, fetchData]);

  // 初始化和清理定时器
  useEffect(() => {
    if (isEnabled) {
      fetchData(); // 立即获取一次数据

      intervalRef.current = setInterval(() => {
        fetchData();
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, interval, fetchData]);

  // 页面可见性：隐藏时暂停轮询，显示时恢复
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (document.visibilityState === 'visible') {
        if (!intervalRef.current && isEnabled) {
          // 立刻触发一次，然后恢复轮询
          fetchData();
          intervalRef.current = setInterval(() => {
            fetchData();
          }, interval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pauseOnHidden, isEnabled, interval, fetchData]);

  // 数据过期检测
  useEffect(() => {
    if (lastUpdate && Date.now() - lastUpdate > interval * 2) {
      setIsStale(true);
    }
  }, [lastUpdate, interval]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    isStale,
    refetch,
    setEnabled: handleSetEnabled,
    forceUpdate
  };
}

/**
 * 函数级中文注释：用于 Council 成员数据的实时钩子
 */
export function useRealtimeCouncilMembers() {
  return useRealtimeData({
    queryFn: async () => {
      // 这里需要实际的 API 调用
      // const membersOpt = await api.query.council.members();
      // return membersOpt.toJSON() as string[];

      // 模拟数据
      return [
        '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y'
      ];
    },
    interval: 15000, // 15秒
    onError: (error) => {
      console.error('Council 成员数据获取失败:', error);
    }
  });
}

/**
 * 函数级中文注释：用于提案数据的实时钩子
 */
export function useRealtimeProposals() {
  return useRealtimeData({
    queryFn: async () => {
      // 这里需要实际的 API 调用
      // const proposalsOpt = await api.query.council.proposals();
      // return proposalsOpt.toJSON() as string[];

      // 模拟数据
      return [
        '0xef84447df8d3daeeba96c757ec5fa9739835068fa7c4d348c8f735e659d359e9'
      ];
    },
    interval: 8000, // 8秒
    onError: (error) => {
      console.error('提案数据获取失败:', error);
    }
  });
}

/**
 * 函数级中文注释：用于投票数据的实时钩子
 */
export function useRealtimeVoting(proposalHash: string) {
  return useRealtimeData({
    queryFn: async () => {
      // 这里需要实际的 API 调用
      // const votingOpt = await api.query.council.voting(proposalHash);
      // return votingOpt.isSome ? votingOpt.unwrap().toJSON() : null;

      // 模拟数据
      return {
        index: 0,
        threshold: 2,
        ayes: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'],
        nays: []
      };
    },
    interval: 5000, // 5秒
    enabled: !!proposalHash,
    onError: (error) => {
      console.error('投票数据获取失败:', error);
    }
  });
}

/**
 * 函数级中文注释：实时数据组合钩子
 */
export function useRealtimeDashboard() {
  const councilMembers = useRealtimeCouncilMembers();
  const proposals = useRealtimeProposals();

  return {
    councilMembers,
    proposals,
    isAnyLoading: councilMembers.loading || proposals.loading,
    hasAnyError: !!councilMembers.error || !!proposals.error,
    lastUpdate: Math.max(
      councilMembers.lastUpdate || 0,
      proposals.lastUpdate || 0
    )
  };
}
