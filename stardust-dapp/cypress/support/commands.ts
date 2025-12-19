/**
 * Cypress 自定义命令文件
 * - 定义全局可复用的测试命令
 */

// 示例：模拟钱包连接
Cypress.Commands.add('mockWalletConnect', () => {
  cy.window().then((win) => {
    // 模拟钱包连接状态
    win.localStorage.setItem('wallet_connected', 'true')
  })
})

// 示例：等待加载完成
Cypress.Commands.add('waitForLoad', () => {
  cy.get('.ant-spin').should('not.exist')
})

declare global {
  namespace Cypress {
    interface Chainable {
      mockWalletConnect(): Chainable<void>
      waitForLoad(): Chainable<void>
    }
  }
}
