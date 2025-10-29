/**
 * 带缓存的申诉查询Hook
 * 
 * 功能：
 * - 自动缓存查询结果
 * - 减少重复的链上RPC调用
 * - 提升查询性能
 * 
 * 使用场景：
 * - 频繁访问的申诉详情
 * - 列表页面的批量查询
 * - Dashboard的实时监控
 */

import { useState, useEffect } from 'react';
import type { ApiPromise } from '@polkadot/api';
import { appealCache } from '@/utils/cache';
import type { AppealInfo } from '@/services/blockchain/contentGovernance';

/**
 * 从链上查询申诉详情（带缓存）
 */
async function fetchAppealWithCache(
  api: ApiPromise,
  appealId: number
): Promise<AppealInfo | null> {
  const cacheKey = `appeal-${appealId}`;
  
  // 尝试从缓存获取
  const cached = appealCache.get(cacheKey);
  if (cached) {
    return cached as AppealInfo;
  }
  
  // 从链上查询
  try {
    const appealOpt = await api.query.memoAppeals.appeals(appealId);
    const appealJson = appealOpt.toJSON() as any;
    
    if (!appealJson) {
      return null;
    }
    
    const appeal: AppealInfo = {
      id: appealId,
      status: appealJson.status || 0,
      domain: appealJson.domain || 0,
      target: appealJson.target || 0,
      submitter: appealJson.submitter || '',
      deposit: appealJson.deposit || '0',
      reason_cid: appealJson.reason_cid || '',
      evidence_cid: appealJson.evidence_cid || '',
      submitted_at: appealJson.submitted_at || 0,
      notice_blocks: appealJson.notice_blocks,
      execute_at: appealJson.execute_at,
    };
    
    // 存入缓存（30秒）
    appealCache.set(cacheKey, appeal, 30000);
    
    return appeal;
  } catch (e) {
    console.error(`查询申诉 ${appealId} 失败:`, e);
    return null;
  }
}

/**
 * 批量查询申诉（带缓存优化）
 */
async function fetchAppealsWithCache(
  api: ApiPromise,
  appealIds: number[]
): Promise<(AppealInfo | null)[]> {
  const results: (AppealInfo | null)[] = [];
  const missingIds: number[] = [];
  const missingIndices: number[] = [];
  
  // 尝试从缓存获取
  for (let i = 0; i < appealIds.length; i++) {
    const appealId = appealIds[i];
    const cacheKey = `appeal-${appealId}`;
    const cached = appealCache.get(cacheKey);
    
    if (cached) {
      results.push(cached as AppealInfo);
    } else {
      results.push(null);
      missingIds.push(appealId);
      missingIndices.push(i);
    }
  }
  
  // 并行查询缺失的数据
  if (missingIds.length > 0) {
    const fetched = await Promise.all(
      missingIds.map(id => fetchAppealWithCache(api, id))
    );
    
    // 填充结果
    for (let i = 0; i < fetched.length; i++) {
      const data = fetched[i];
      const index = missingIndices[i];
      results[index] = data;
    }
  }
  
  return results;
}

/**
 * 单个申诉查询Hook（带缓存）
 * 
 * @param api - Polkadot API实例
 * @param appealId - 申诉ID
 * @returns 申诉详情、加载状态、错误信息
 * 
 * @example
 * ```tsx
 * function AppealDetail({ appealId }: { appealId: number }) {
 *   const { api } = useApi();
 *   const { appeal, loading, error } = useAppealWithCache(api, appealId);
 * 
 *   if (loading) return <Spin />;
 *   if (error) return <Alert type="error" message={error.message} />;
 *   if (!appeal) return <Empty />;
 * 
 *   return <div>申诉 #{appeal.id}</div>;
 * }
 * ```
 */
export function useAppealWithCache(
  api: ApiPromise | null,
  appealId: number | null
): {
  appeal: AppealInfo | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [appeal, setAppeal] = useState<AppealInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetch = async () => {
    if (!api || appealId === null) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchAppealWithCache(api, appealId);
      setAppeal(data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('查询失败');
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetch();
  }, [api, appealId]);
  
  return {
    appeal,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 批量申诉查询Hook（带缓存）
 * 
 * @param api - Polkadot API实例
 * @param appealIds - 申诉ID数组
 * @returns 申诉列表、加载状态、错误信息
 * 
 * @example
 * ```tsx
 * function AppealList({ appealIds }: { appealIds: number[] }) {
 *   const { api } = useApi();
 *   const { appeals, loading, error } = useAppealsWithCache(api, appealIds);
 * 
 *   if (loading) return <Spin />;
 *   if (error) return <Alert type="error" message={error.message} />;
 * 
 *   return (
 *     <List
 *       dataSource={appeals}
 *       renderItem={appeal => <AppealItem appeal={appeal} />}
 *     />
 *   );
 * }
 * ```
 */
export function useAppealsWithCache(
  api: ApiPromise | null,
  appealIds: number[]
): {
  appeals: (AppealInfo | null)[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [appeals, setAppeals] = useState<(AppealInfo | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetch = async () => {
    if (!api || appealIds.length === 0) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchAppealsWithCache(api, appealIds);
      setAppeals(data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('批量查询失败');
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetch();
  }, [api, JSON.stringify(appealIds)]);
  
  return {
    appeals,
    loading,
    error,
    refetch: fetch,
  };
}

export default useAppealWithCache;

