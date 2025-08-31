import React from 'react'
import { Alert, Select, Typography, List, Skeleton, Tag } from 'antd'
import { query } from '../../lib/graphql'

/**
 * 函数级详细中文注释：墓位排行榜（Subsquid 查询）
 * 前端操作方法：
 * - 在设置或 .env 中配置 VITE_SQUID_URL
 * - 页面选择排序（次数/金额）与时间窗口，自动从 GraphQL 拉取数据
 */
const TopGravesPage: React.FC = () => {
  const [metric, setMetric] = React.useState<'count'|'amount'>('count')
  const [range, setRange] = React.useState<'all'|'7d'|'30d'>('all')
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<any[]>([])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      // 简化：演示从 GraveStat 实体获取累计榜；时间窗口可由后端处理器维护周期表或视图
      const isCount = metric === 'count'
      const gql = `query Q($limit:Int!){ graveStats(orderBy: ${isCount ? 'totalCount_DESC' : 'totalAmount_DESC'}, limit: $limit){ graveId totalCount totalAmount updatedAt } }`
      const data = await query<{ graveStats: any[] }>(gql, { limit: 50 })
      setItems(data.graveStats || [])
    } finally { setLoading(false) }
  }, [metric, range])

  React.useEffect(() => { load() }, [load])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>墓位排行榜</Typography.Title>
        <Alert type="info" showIcon message="数据来自 Subsquid（GraphQL）。可在右上角切换排序与时间窗。" />
      </div>
      <div style={{ padding: 8, display: 'flex', gap: 8 }}>
        <Select value={metric} onChange={v=>setMetric(v)} options={[{label:'按次数',value:'count'},{label:'按金额',value:'amount'}]} style={{ flex:1 }} />
        <Select value={range} onChange={v=>setRange(v)} options={[{label:'全部',value:'all'},{label:'近7天',value:'7d'},{label:'近30天',value:'30d'}]} style={{ flex:1 }} />
      </div>
      <div style={{ padding: 8 }}>
        {loading ? <Skeleton active /> : (
          <List
            dataSource={items}
            renderItem={(it, idx) => (
              <List.Item>
                <List.Item.Meta
                  title={<span>#{idx+1} 墓位 {String(it.graveId)}</span>}
                  description={<div>
                    <Tag color="blue">次数 {String(it.totalCount)}</Tag>
                    <Tag color="purple">金额 {String(it.totalAmount||0)}</Tag>
                    <Tag color="default">更新块 {String(it.updatedAt)}</Tag>
                  </div>}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  )
}

export default TopGravesPage


