/**
 * Card 组件测试
 * - 测试基本渲染、样式变体、交互行为
 */
import { Card, StatCard, ActivityCard } from '../../src/components/ui/Card'

describe('Card 组件', () => {
  // 基本渲染
  it('正确渲染子内容', () => {
    cy.mount(
      <Card>
        <p>卡片内容</p>
      </Card>
    )
    cy.contains('卡片内容').should('be.visible')
  })

  // 点击事件
  it('可点击时触发回调', () => {
    const onClick = cy.stub().as('clickHandler')
    cy.mount(
      <Card onClick={onClick}>
        可点击卡片
      </Card>
    )

    cy.get('button').click()
    cy.get('@clickHandler').should('have.been.calledOnce')
  })

  // 不同内边距
  describe('内边距变体', () => {
    it('无内边距', () => {
      cy.mount(<Card padding="none">内容</Card>)
      cy.get('div').first().should('have.class', 'p-0')
    })

    it('小内边距', () => {
      cy.mount(<Card padding="sm">内容</Card>)
      cy.get('div').first().should('have.class', 'p-3')
    })

    it('大内边距', () => {
      cy.mount(<Card padding="lg">内容</Card>)
      cy.get('div').first().should('have.class', 'p-8')
    })
  })

  // 玻璃拟态效果
  it('默认启用玻璃拟态', () => {
    cy.mount(<Card>玻璃卡片</Card>)
    cy.get('div').first().should('have.class', 'backdrop-blur-md')
  })

  it('可禁用玻璃拟态', () => {
    cy.mount(<Card glassmorphism={false}>实色卡片</Card>)
    cy.get('div').first().should('have.class', 'bg-gray-800')
  })
})

describe('StatCard 组件', () => {
  it('显示标题、数值和副标题', () => {
    cy.mount(
      <StatCard
        title="总交易"
        value={1234}
        subtitle="本月数据"
      />
    )

    cy.contains('总交易').should('be.visible')
    cy.contains('1234').should('be.visible')
    cy.contains('本月数据').should('be.visible')
  })

  it('副标题可选', () => {
    cy.mount(<StatCard title="余额" value="100 DUST" />)

    cy.contains('余额').should('be.visible')
    cy.contains('100 DUST').should('be.visible')
  })
})

describe('ActivityCard 组件', () => {
  it('显示成功状态', () => {
    cy.mount(
      <ActivityCard
        title="转账成功"
        description="转账到 Alice"
        status="success"
        timestamp="2025-01-01 12:00"
        amount="50 DUST"
      />
    )

    cy.contains('转账成功').should('be.visible')
    cy.contains('转账到 Alice').should('be.visible')
    cy.contains('50 DUST').should('be.visible')
    cy.contains('✓').should('be.visible')
  })

  it('显示失败状态', () => {
    cy.mount(
      <ActivityCard
        title="交易失败"
        description="余额不足"
        status="failed"
        timestamp="2025-01-01 12:00"
      />
    )

    cy.contains('✗').should('be.visible')
  })

  it('显示待处理状态', () => {
    cy.mount(
      <ActivityCard
        title="处理中"
        description="等待确认"
        status="pending"
        timestamp="2025-01-01 12:00"
      />
    )

    cy.contains('⏳').should('be.visible')
  })
})
