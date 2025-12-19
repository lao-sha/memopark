/**
 * Cypress 组件测试支持文件
 * - 导入全局样式
 * - 配置 mount 命令
 */
import { mount } from 'cypress/react18'

// 导入全局样式（如果有）
import '../../src/index.css'

// 声明 Cypress 命令类型
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

// 注册 mount 命令
Cypress.Commands.add('mount', mount)
