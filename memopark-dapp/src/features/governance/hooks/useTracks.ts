import { useEffect, useState } from 'react';

/**
 * 函数级详细中文注释：查询治理轨道元数据的 Hook（占位版）
 * - 未来通过 @polkadot/api 查询 referenda/parameters 获取轨道配置
 * - 目前返回模拟数据，保证页面可渲染与类型稳定
 */
export interface TrackMeta { id: number; name: string; summary: string }

export function useTracks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackMeta[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // 占位：模拟异步加载
    const timer = setTimeout(() => {
      setTracks([
        { id: 0, name: 'Root 危险调用', summary: '高押金/长冷静期/长延迟' },
        { id: 1, name: '参数调整', summary: '中押金/标准周期' },
        { id: 2, name: '财库支出', summary: '按里程碑/延迟执行' },
      ]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return { loading, error, tracks };
}


