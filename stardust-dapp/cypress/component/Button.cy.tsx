/**
 * Button 组件测试
 * - 测试基本渲染、点击事件、不同变体和状态
 */
import { Button, PrimaryButton, DangerButton } from '../../src/components/ui/Button'

describe('Button 组件', () => {
  // 基本渲染测试
  it('正确渲染按钮文本', () => {
    cy.mount(<Button>测试按钮</Button>)
    cy.contains('测试按钮').should('be.visible')
  })

  // 点击事件测试
  it('点击触发回调函数', () => {
    const onClick = cy.stub().as('clickHandler')
    cy.mount(<Button onClick={onClick}>点击我</Button>)

    cy.get('button').click()
    cy.get('@clickHandler').should('have.been.calledOnce')
  })

  // 禁用状态测试
  it('禁用状态下无法点击', () => {
    const onClick = cy.stub().as('clickHandler')
    cy.mount(<Button disabled onClick={onClick}>禁用按钮</Button>)

    cy.get('button').should('be.disabled')
    cy.get('button').click({ force: true })
    cy.get('@clickHandler').should('not.have.been.called')
  })

  // 加载状态测试
  it('加载状态显示 spinner', () => {
    cy.mount(<Button loading>加载中</Button>)

    cy.get('button').should('be.disabled')
    cy.get('svg.animate-spin').should('exist')
  })

  // 不同尺寸测试
  describe('尺寸变体', () => {
    it('小尺寸按钮', () => {
      cy.mount(<Button size="sm">小按钮</Button>)
      cy.get('button').should('have.class', 'text-sm')
    })

    it('中等尺寸按钮（默认）', () => {
      cy.mount(<Button size="md">中按钮</Button>)
      cy.get('button').should('have.class', 'text-base')
    })

    it('大尺寸按钮', () => {
      cy.mount(<Button size="lg">大按钮</Button>)
      cy.get('button').should('have.class', 'text-lg')
    })
  })

  // 不同变体测试
  describe('样式变体', () => {
    it('主要按钮样式', () => {
      cy.mount(<PrimaryButton>主要按钮</PrimaryButton>)
      cy.get('button').should('have.class', 'bg-blue-600')
    })

    it('危险按钮样式', () => {
      cy.mount(<DangerButton>危险按钮</DangerButton>)
      cy.get('button').should('have.class', 'bg-red-600')
    })
  })

  // 全宽测试
  it('全宽按钮', () => {
    cy.mount(<Button fullWidth>全宽按钮</Button>)
    cy.get('button').should('have.class', 'w-full')
  })
})
