/**
 * 主题管理 Hook
 *
 * 支持两种主题：
 * 1. classic - 经典主题（华易网风格，朱砂红+米黄）
 * 2. starry - 星空主题（年轻人偏好，深色+紫色渐变）
 */

import { useState, useEffect, useCallback } from 'react';

export type ThemeType = 'classic' | 'starry';

const THEME_STORAGE_KEY = 'divination-theme';

/**
 * 获取存储的主题，默认返回 classic
 */
function getStoredTheme(): ThemeType {
  if (typeof window === 'undefined') return 'classic';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return (stored === 'starry' || stored === 'classic') ? stored : 'classic';
}

/**
 * 主题管理 Hook
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeType>(getStoredTheme);

  /**
   * 应用主题到 body
   */
  const applyTheme = useCallback((newTheme: ThemeType) => {
    const body = document.body;
    if (newTheme === 'starry') {
      body.classList.add('theme-starry');
    } else {
      body.classList.remove('theme-starry');
    }
  }, []);

  /**
   * 切换主题
   */
  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  /**
   * 切换主题（toggle）
   */
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'classic' ? 'starry' : 'classic';
    setTheme(newTheme);
  }, [theme, setTheme]);

  /**
   * 初始化时应用主题
   */
  useEffect(() => {
    applyTheme(theme);
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme,
    isStarry: theme === 'starry',
    isClassic: theme === 'classic',
  };
}

export default useTheme;
