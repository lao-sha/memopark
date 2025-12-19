/**
 * 主题切换组件
 *
 * 提供两种展示模式：
 * 1. 开关模式（Switch）- 适合设置面板
 * 2. 按钮模式（Button）- 适合页面顶部快捷切换
 *
 * 支持的主题：
 * - classic: 经典主题（华易网风格，朱砂红+米黄）
 * - starry: 星空主题（年轻人偏好，深色+紫色渐变）
 */

import React from 'react';
import { Switch, Button, Tooltip, Space, Typography } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { useTheme, ThemeType } from '../hooks/useTheme';

const { Text } = Typography;

/**
 * 主题切换组件属性
 */
interface ThemeToggleProps {
  /** 展示模式：switch（开关）或 button（按钮） */
  mode?: 'switch' | 'button';
  /** 是否显示文字标签 */
  showLabel?: boolean;
  /** 按钮尺寸（仅 button 模式有效） */
  size?: 'small' | 'middle' | 'large';
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 主题名称映射
 */
const THEME_LABELS: Record<ThemeType, string> = {
  classic: '经典',
  starry: '星空',
};

/**
 * 主题图标（SVG）
 */
const ThemeIcon: React.FC<{ theme: ThemeType }> = ({ theme }) => {
  if (theme === 'starry') {
    // 星空图标（星星+月亮）
    return (
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
        <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
        <circle cx="19" cy="5" r="1" />
        <circle cx="16" cy="3" r="0.5" />
        <circle cx="21" cy="8" r="0.5" />
      </svg>
    );
  }
  // 经典图标（太阳/书卷）
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

/**
 * 主题切换组件
 */
const ThemeToggle: React.FC<ThemeToggleProps> = ({
  mode = 'switch',
  showLabel = true,
  size = 'middle',
  style,
}) => {
  const { theme, toggleTheme, isStarry } = useTheme();

  /**
   * 开关模式渲染
   */
  if (mode === 'switch') {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...style }}>
        {showLabel && (
          <Space>
            <BgColorsOutlined style={{ color: isStarry ? '#7C3AED' : '#B2955D' }} />
            <Text>主题模式</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({THEME_LABELS[theme]})
            </Text>
          </Space>
        )}
        <Tooltip title={isStarry ? '切换到经典主题' : '切换到星空主题'}>
          <Switch
            checked={isStarry}
            onChange={toggleTheme}
            checkedChildren={<ThemeIcon theme="starry" />}
            unCheckedChildren={<ThemeIcon theme="classic" />}
            style={{
              backgroundColor: isStarry ? '#7C3AED' : '#B2955D',
            }}
          />
        </Tooltip>
      </div>
    );
  }

  /**
   * 按钮模式渲染
   */
  return (
    <Tooltip title={`切换到${THEME_LABELS[isStarry ? 'classic' : 'starry']}主题`}>
      <Button
        type="text"
        size={size}
        icon={<ThemeIcon theme={theme} />}
        onClick={toggleTheme}
        style={{
          color: isStarry ? '#A78BFA' : 'rgba(255,255,255,0.9)',
          ...style,
        }}
      >
        {showLabel && THEME_LABELS[theme]}
      </Button>
    </Tooltip>
  );
};

export default ThemeToggle;
