/**
 * 函数级详细中文注释：MemoPark 纪念主题配色系统
 * - 基于中华祭祀文化设计
 * - 主色：深金色（庄重、永恒）
 * - 辅色：墨绿色（生命、希望）
 * - 背景：米白色（温暖、怀念）
 */

import type { ThemeConfig } from 'antd'

/**
 * 主题色彩常量
 */
export const MemorialColors = {
  // 主色系 - 深金色（蜡烛、香炉、庄重）
  primary: '#B8860B',           // 深金色 - 主色
  primaryLight: '#DAA520',       // 金色 - 悬停态
  primaryDark: '#8B6508',        // 暗金 - 按下态
  primaryBg: '#FFF8DC',          // 淡金背景
  
  // 辅色系 - 墨绿色（松柏、长青、希望）
  secondary: '#2F4F4F',          // 墨绿 - 辅色
  secondaryLight: '#708090',     // 灰绿 - 悬停
  secondaryBg: '#F0FFF0',        // 淡绿背景
  
  // 背景色系 - 米白色（纸张、追思、温暖）
  bgPrimary: '#F5F5DC',          // 米白 - 主背景
  bgSecondary: '#FAFAF0',        // 浅黄 - 卡片背景
  bgElevated: '#FFFFFF',         // 纯白 - 浮层/Modal
  bgOverlay: 'rgba(0, 0, 0, 0.45)', // 遮罩
  
  // 强调色 - 朱红色（祭品、献花、庄重）
  accent: '#DC143C',             // 朱红 - 祭品
  accentLight: '#FF6B6B',        // 浅红 - 悬停
  
  // 语义色（保持Ant Design标准）
  success: '#52c41a',            // 绿色 - 成功
  warning: '#faad14',            // 橙色 - 警告
  error: '#ff4d4f',              // 红色 - 错误
  info: '#1890ff',               // 蓝色 - 信息
  
  // 文字色
  textPrimary: '#2C2C2C',        // 深灰 - 主文字
  textSecondary: '#666666',      // 中灰 - 次要文字
  textTertiary: '#999999',       // 浅灰 - 辅助文字
  textInverse: '#FFFFFF',        // 白色 - 反色文字
  textDisabled: '#BFBFBF',       // 禁用文字
  
  // 边框色
  border: '#E8E8E8',
  borderLight: '#F0F0F0',
  divider: '#F0F0F0',
  
  // 祭祀特色色（供品相关）
  candle: '#FFD700',             // 蜡烛金
  flower: '#FFB6C1',             // 鲜花粉
  incense: '#98D8C8',            // 清香青
  fruit: '#FF6347',              // 果品橙
}

/**
 * Ant Design 主题配置
 */
export const memorialTheme: ThemeConfig = {
  token: {
    // 主色
    colorPrimary: MemorialColors.primary,
    colorSuccess: MemorialColors.success,
    colorWarning: MemorialColors.warning,
    colorError: MemorialColors.error,
    colorInfo: MemorialColors.info,
    
    // 背景色
    colorBgContainer: MemorialColors.bgSecondary,
    colorBgElevated: MemorialColors.bgElevated,
    colorBgLayout: MemorialColors.bgPrimary,
    
    // 文字色
    colorText: MemorialColors.textPrimary,
    colorTextSecondary: MemorialColors.textSecondary,
    colorTextTertiary: MemorialColors.textTertiary,
    colorTextDisabled: MemorialColors.textDisabled,
    
    // 边框
    colorBorder: MemorialColors.border,
    colorBorderSecondary: MemorialColors.borderLight,
    
    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    
    // 字体
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 18,
    fontSizeHeading5: 16,
    
    // 间距
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    
    // 行高
    lineHeight: 1.5,
    lineHeightHeading1: 1.2,
    lineHeightHeading2: 1.3,
    
    // 字体族
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 
                'PingFang SC', 'Hiragino Sans GB', 
                'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
  },
  
  // 组件级定制
  components: {
    Button: {
      // 主按钮
      primaryShadow: '0 2px 8px rgba(184, 134, 11, 0.15)',
      controlHeight: 44,           // 更大的按钮高度（移动端友好）
      controlHeightLG: 52,
      controlHeightSM: 36,
      fontWeight: 500,
      
      // 危险按钮（使用朱红色）
      colorErrorHover: MemorialColors.accentLight,
      colorError: MemorialColors.accent,
    },
    
    Card: {
      boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.06)',
      paddingLG: 20,
    },
    
    Input: {
      controlHeight: 44,
      controlHeightLG: 52,
      paddingBlock: 10,
    },
    
    InputNumber: {
      controlHeight: 44,
      controlHeightLG: 52,
    },
    
    Select: {
      controlHeight: 44,
      controlHeightLG: 52,
    },
    
    Modal: {
      borderRadiusLG: 12,
    },
    
    Tabs: {
      cardBg: MemorialColors.bgElevated,
    },
    
    Tag: {
      borderRadiusSM: 4,
    },
  },
  
  // 算法（可选）
  algorithm: undefined, // 使用默认算法
}

/**
 * CSS变量（用于非Ant Design组件）
 */
export const memorialCSSVars = `
:root {
  /* 主色系 */
  --color-primary: ${MemorialColors.primary};
  --color-primary-light: ${MemorialColors.primaryLight};
  --color-primary-dark: ${MemorialColors.primaryDark};
  --color-primary-bg: ${MemorialColors.primaryBg};
  
  /* 辅色系 */
  --color-secondary: ${MemorialColors.secondary};
  --color-secondary-light: ${MemorialColors.secondaryLight};
  --color-secondary-bg: ${MemorialColors.secondaryBg};
  
  /* 背景色 */
  --color-bg-primary: ${MemorialColors.bgPrimary};
  --color-bg-secondary: ${MemorialColors.bgSecondary};
  --color-bg-elevated: ${MemorialColors.bgElevated};
  --color-bg-overlay: ${MemorialColors.bgOverlay};
  
  /* 强调色 */
  --color-accent: ${MemorialColors.accent};
  --color-accent-light: ${MemorialColors.accentLight};
  
  /* 语义色 */
  --color-success: ${MemorialColors.success};
  --color-warning: ${MemorialColors.warning};
  --color-error: ${MemorialColors.error};
  --color-info: ${MemorialColors.info};
  
  /* 文字色 */
  --color-text-primary: ${MemorialColors.textPrimary};
  --color-text-secondary: ${MemorialColors.textSecondary};
  --color-text-tertiary: ${MemorialColors.textTertiary};
  --color-text-inverse: ${MemorialColors.textInverse};
  --color-text-disabled: ${MemorialColors.textDisabled};
  
  /* 边框色 */
  --color-border: ${MemorialColors.border};
  --color-border-light: ${MemorialColors.borderLight};
  --color-divider: ${MemorialColors.divider};
  
  /* 祭祀特色色 */
  --color-candle: ${MemorialColors.candle};
  --color-flower: ${MemorialColors.flower};
  --color-incense: ${MemorialColors.incense};
  --color-fruit: ${MemorialColors.fruit};
  
  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(184, 134, 11, 0.08);
  --shadow-md: 0 4px 12px rgba(184, 134, 11, 0.12);
  --shadow-lg: 0 8px 24px rgba(184, 134, 11, 0.16);
  
  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
`

/**
 * 导出供组件使用
 */
export default memorialTheme

