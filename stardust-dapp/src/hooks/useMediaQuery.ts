/**
 * 媒体查询 Hook
 * 
 * 功能：
 * - 响应式设计辅助工具
 * - 监听屏幕尺寸变化
 */

import { useState, useEffect } from 'react';

/**
 * 使用媒体查询
 * 
 * @param query - 媒体查询字符串，例如 '(max-width: 768px)'
 * @returns 是否匹配查询条件
 * 
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    // 初始值
    setMatches(mediaQuery.matches);

    // 监听变化
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange);

    // 清理监听器
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

