/**
 * 标签导航栏组件
 *
 * 功能：
 * - 黑色背景，白色文字
 * - 支持多个标签切换
 * - 选中标签高亮显示（金色背景）
 * - 固定在页面顶部
 */

import React from 'react';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabNavigationProps {
  /** 标签列表 */
  tabs: TabItem[];
  /** 当前选中的标签 key */
  activeTab: string;
  /** 标签切换回调函数 */
  onTabChange: (key: string) => void;
  /** 距离顶部的距离（px），默认 50 */
  top?: number;
  /** 是否固定定位，默认 true */
  fixed?: boolean;
  /** z-index 层级，默认 100 */
  zIndex?: number;
}

/**
 * 标签导航栏组件
 */
export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  top = 50,
  fixed = true,
  zIndex = 100,
}) => {
  return (
    <div
      style={{
        position: fixed ? 'fixed' : 'relative',
        top: fixed ? `${top}px` : undefined,
        left: fixed ? '50%' : undefined,
        transform: fixed ? 'translateX(-50%)' : undefined,
        width: '100%',
        maxWidth: '414px',
        backgroundColor: '#1a1a1a',
        zIndex,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
      }}
    >
      <div style={{ display: 'flex', gap: 0, width: '100%' }}>
        {tabs.map((tab) => (
          <span
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={{
              padding: '6px',
              fontSize: '18px',
              backgroundColor: activeTab === tab.key ? '#B2955D' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              borderRadius: '4px',
              fontWeight: '400',
              transition: 'all 0.3s',
              userSelect: 'none',
              lineHeight: '1.2',
              flex: 1,
              textAlign: 'center',
            }}
          >
            {tab.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TabNavigation;
