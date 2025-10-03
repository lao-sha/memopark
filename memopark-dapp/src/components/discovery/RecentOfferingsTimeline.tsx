import React from 'react'
import { Card, Timeline, Typography, Empty, Tag } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { getOfferingIcon, getOfferingName } from '../offering/OfferingCardSelector'

/**
 * 函数级详细中文注释：最近供奉时间线组件
 * - 展示最近的供奉活动
 * - 使用Timeline组件呈现
 * - 移动端友好
 */

interface OfferingActivity {
  id: number
  who: string
  graveId: number
  graveName?: string
  kind: number
  amount: string
  timestamp: number
}

export const RecentOfferingsTimeline: React.FC = () => {
  // 模拟数据（实际应从链上或Subsquid查询）
  const activities: OfferingActivity[] = [
    {
      id: 1,
      who: '5GrwvaEF...2Jd',
      graveId: 1,
      graveName: '张氏家族墓',
      kind: 12,
      amount: '10',
      timestamp: Date.now() - 2 * 60 * 1000
    },
    {
      id: 2,
      who: '5D5aBzXy...5Yx',
      graveId: 2,
      graveName: '李府纪念馆',
      kind: 11,
      amount: '5',
      timestamp: Date.now() - 5 * 60 * 1000
    },
    {
      id: 3,
      who: '5F3sa2TJ...9Qx',
      graveId: 3,
      kind: 13,
      amount: '8',
      timestamp: Date.now() - 15 * 60 * 1000
    }
  ]

  /**
   * 格式化时间差
   */
  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    return `${days}天前`
  }

  if (activities.length === 0) {
    return (
      <Card title="💐 最近供奉" size="small">
        <Empty 
          description="暂无供奉记录" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <Card 
      title={
        <span>
          <ClockCircleOutlined style={{ color: 'var(--color-primary)', marginRight: 6 }} />
          最近供奉
        </span>
      }
      size="small"
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <Timeline
        items={activities.map((activity) => ({
          color: 'var(--color-primary)',
          dot: <span style={{ fontSize: 16 }}>{getOfferingIcon(activity.kind)}</span>,
          children: (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                flexWrap: 'wrap'
              }}>
                <Typography.Text 
                  style={{ 
                    fontSize: 13,
                    color: 'var(--color-text-primary)'
                  }}
                >
                  {activity.who.slice(0, 8)}...{activity.who.slice(-4)}
                </Typography.Text>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                  为
                </span>
                <Typography.Text 
                  strong
                  style={{
                    color: 'var(--color-primary)',
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    window.location.hash = `#/grave/detail?gid=${activity.graveId}`
                  }}
                >
                  {activity.graveName || `墓地#${activity.graveId}`}
                </Typography.Text>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  供奉了
                </span>
                <Tag 
                  color="gold"
                  style={{
                    margin: 0,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 11,
                    fontWeight: 500
                  }}
                >
                  {getOfferingIcon(activity.kind)} {getOfferingName(activity.kind)}
                </Tag>
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                  {activity.amount} MEMO
                </span>
              </div>
              
              <div style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                marginTop: 4
              }}>
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          )
        }))}
      />
    </Card>
  )
}

export default RecentOfferingsTimeline

