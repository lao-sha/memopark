/**
 * Memopark Design System Theme Configuration
 * Inspired by Talisman's design patterns with memopark-specific customizations
 */

export const theme = {
  colors: {
    // Core brand colors
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9', // Main brand color
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    
    // Memorial/remembrance theme
    memorial: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7', // Memorial purple
      600: '#9333ea',
      700: '#7c3aed',
      800: '#6b21a8',
      900: '#581c87',
    },
    
    // Dark theme (inspired by Talisman)
    dark: {
      primary: '#121212',
      secondary: '#1B1B1B',
      tertiary: '#262626',
      quaternary: '#333333',
    },
    
    // Text colors
    text: {
      primary: '#fafafa',
      secondary: '#a5a5a5',
      disabled: '#5a5a5a',
      inactive: '#717171',
    },
    
    // Status colors
    status: {
      success: '#6CFC69',
      warning: '#f48f45',
      error: '#fd4848',
      info: '#38bdf8',
    },
    
    // Transparent overlays
    overlay: {
      light: 'rgba(255, 255, 255, 0.1)',
      medium: 'rgba(255, 255, 255, 0.2)',
      heavy: 'rgba(0, 0, 0, 0.8)',
    },
  },
  
  // Glassmorphism effects
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.15)',
      border: 'rgba(255, 255, 255, 0.3)',
      backdropFilter: 'blur(15px)',
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)',
    },
    heavy: {
      background: 'rgba(27, 27, 27, 0.8)',
      border: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.6)',
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
  },
  
  // Spacing system
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  
  // Border radius
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  
  // Animation durations
  animation: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  
  // Z-index levels
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  },
} as const;

export type Theme = typeof theme;
