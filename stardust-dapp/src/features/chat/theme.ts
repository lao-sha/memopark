/**
 * 聊天功能主题配置
 * 
 * 说明：
 * - 与项目整体UI风格保持一致
 * - 参考欢迎页、创建钱包等页面的颜色方案
 * - 支持亮色和暗色模式（未来扩展）
 */

export const chatTheme = {
  // 主色调
  primary: '#1890ff',
  primaryHover: '#40a9ff',
  primaryActive: '#096dd9',
  
  // 次要颜色
  secondary: '#52c41a',
  warning: '#faad14',
  error: '#f5222d',
  
  // 背景色
  background: {
    page: '#f0f2f5',
    card: '#ffffff',
    hover: '#f5f5f5',
    active: '#e6f7ff',
    message: {
      mine: '#1890ff',
      other: '#ffffff',
    },
  },
  
  // 文字颜色
  text: {
    primary: '#262626',
    secondary: '#8c8c8c',
    tertiary: '#bfbfbf',
    white: '#ffffff',
  },
  
  // 边框颜色
  border: {
    light: '#f0f0f0',
    normal: '#d9d9d9',
    dark: '#bfbfbf',
  },
  
  // 阴影
  shadow: {
    small: '0 2px 8px rgba(0, 0, 0, 0.08)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.12)',
    large: '0 8px 24px rgba(0, 0, 0, 0.16)',
  },
  
  // 圆角
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '24px',
  },
  
  // 间距
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  
  // 动画时长
  transition: {
    fast: '0.15s',
    normal: '0.3s',
    slow: '0.5s',
  },
};

export type ChatTheme = typeof chatTheme;

