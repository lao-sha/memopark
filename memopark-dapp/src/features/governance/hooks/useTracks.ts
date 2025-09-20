import { useEffect, useState } from 'react';

/**
 * 函数级详细中文注释：治理轨道元数据 Hook（Legacy 占位）
 * - 主流程：委员会阈值 + 申诉治理；轨道仅用于旧版公投页面
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
        { id: 2, name: '财库支出', summary: '按里程碑/延迟执行' },
        { id: 20, name: '内容治理', summary: '专用内容治理轨道（较温和曲线）' },
      ]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return { loading, error, tracks };
}


