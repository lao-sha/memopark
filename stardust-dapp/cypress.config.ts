import { defineConfig } from 'cypress'

/**
 * Cypress 配置文件
 * - 配置组件测试使用 React + Vite
 * - 设置测试文件路径和超时时间
 */
export default defineConfig({
  // 组件测试配置
  component: {
    // 开发服务器配置：使用 Vite 构建 React 组件
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    // 测试文件匹配模式
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    // 视口配置（移动端优先）
    viewportWidth: 375,
    viewportHeight: 667,
  },

  // E2E 测试配置（可选）
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 375,
    viewportHeight: 667,
  },

  // 全局配置
  video: false,
  screenshotOnRunFailure: true,
  defaultCommandTimeout: 10000,
})
