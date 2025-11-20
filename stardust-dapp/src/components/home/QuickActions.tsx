import React from 'react'
import { Card, Row, Col } from 'antd'
import {
  PlusOutlined,
  UnorderedListOutlined,
  FireOutlined,
  HistoryOutlined,
  GiftOutlined,
  TeamOutlined,
  HomeOutlined
} from '@ant-design/icons'

/**
 * 函数级详细中文注释：首页快捷操作卡片组件
 * - 提供常用功能的快速入口
 * - 卡片式布局，图标+文字
 * - 适配移动端触摸操作
 */

interface ActionItem {
  key: string
  icon: React.ReactNode
  label: string
  description: string
  color: string
  route: string
}

const actions: ActionItem[] = [
  {
    key: 'memorial',
    icon: <HomeOutlined style={{ fontSize: 24 }} />,
    label: '纪念馆首页',
    description: '浏览所有纪念馆',
    color: '#B8860B',
    route: '#/memorial'
  },
  {
    key: 'create',
    icon: <PlusOutlined style={{ fontSize: 24 }} />,
    label: '创建纪念馆',
    description: '为逝者建立纪念空间',
    color: 'var(--color-primary)',
    route: '#/deceased/create' // 旧墓位功能已删除，改为创建逝者
  },
  {
    key: 'my',
    icon: <UnorderedListOutlined style={{ fontSize: 24 }} />,
    label: '我的创建',
    description: '管理我的纪念馆',
    color: 'var(--color-secondary)',
    route: '#/deceased/list' // 旧墓位功能已删除，改为逝者列表
  },
  {
    key: 'offering',
    icon: <GiftOutlined style={{ fontSize: 24 }} />,
    label: '最近供奉',
    description: '查看供奉记录',
    color: 'var(--color-accent)',
    route: '#/offerings/timeline'
  }
]

export const QuickActions: React.FC = () => {
  return (
    <Card 
      title="⚡ 快捷操作" 
      size="small"
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        marginTop: 16
      }}
    >
      <Row gutter={[12, 12]}>
        {actions.map((action) => (
          <Col span={12} key={action.key}>
            <div
              onClick={() => {
                window.location.hash = action.route
              }}
              style={{
                padding: 16,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-elevated)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.borderColor = action.color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = 'var(--color-border-light)'
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-md)',
                  background: `linear-gradient(135deg, ${action.color}15, ${action.color}05)`,
                  border: `2px solid ${action.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                  color: action.color
                }}
              >
                {action.icon}
              </div>
              
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: 4
              }}>
                {action.label}
              </div>
              
              <div style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                lineHeight: 1.4
              }}>
                {action.description}
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  )
}

export default QuickActions

