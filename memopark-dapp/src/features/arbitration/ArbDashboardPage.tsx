import React, { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, List, Tag, Typography, Alert } from 'antd'
import { query } from '../../lib/graphql'

/**
 * 函数级详细中文注释：仲裁运营仪表盘
 * - 数据源：Subsquid（ArbDailyStat/ArbitrationCase 实体）
 * - 展示：近 14 日争议/裁决统计与最近案件列表
 * - 设计：移动端单列优先，使用 AntD Statistic 与 List
 */
const ArbDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        const q = `
          query Q {
            arbDailyStats(orderBy: day_DESC, limit: 14) { day disputes arbitrated release refund partial }
            arbitrationCases(orderBy: openedAt_DESC, limit: 10) { id domain objectId state openedAt closedAt decision bps }
          }
        `
        const res = await query(q)
        setStats(res.arbDailyStats || [])
        setCases(res.arbitrationCases || [])
      } catch (e) {
        // ignore
      }
    })()
  }, [])

  const sum = (k: string) => stats.reduce((a, b) => a + (Number(b?.[k] || 0)), 0)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 24 }}>
      <Typography.Title level={4} style={{ margin: '8px 8px 0' }}>仲裁仪表盘</Typography.Title>
      <div style={{ padding: 8 }}>
        <Row gutter={8}>
          <Col span={12}><Card><Statistic title="近14日争议" value={sum('disputes')} /></Card></Col>
          <Col span={12}><Card><Statistic title="近14日裁决" value={sum('arbitrated')} /></Card></Col>
        </Row>
        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col span={8}><Card><Statistic title="放行" value={sum('release')} /></Card></Col>
          <Col span={8}><Card><Statistic title="退款" value={sum('refund')} /></Card></Col>
          <Col span={8}><Card><Statistic title="部分" value={sum('partial')} /></Card></Col>
        </Row>
      </div>

      <div style={{ padding: 8 }}>
        <Alert type="info" showIcon message="以下为最近 10 条仲裁案件" style={{ marginBottom: 8 }} />
        <List
          dataSource={cases}
          renderItem={(it: any) => (
            <List.Item>
              <List.Item.Meta
                title={<span>#{it.objectId} <Tag color={it.state==='Disputed'?'red':'green'}>{it.state}</Tag> <Tag>{it.decision || '-'}</Tag></span>}
                description={<span>域: {it.domain} 打开于区块 {it.openedAt}{it.closedAt?`，关闭于 ${it.closedAt}`:''}</span>}
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  )
}

export default ArbDashboardPage


