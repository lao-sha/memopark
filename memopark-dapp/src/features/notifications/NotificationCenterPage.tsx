import React, { useEffect, useState } from 'react'
import { List, Tag, Typography } from 'antd'
import { query } from '../../lib/graphql'

/**
 * 函数级详细中文注释：通知中心（统一事件时间线）
 * - 数据源：Subsquid Notification 实体
 * - 展示：最近 50 条事件，含模块/类型/引用ID/区块高度
 */
const NotificationCenterPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    (async () => {
      try {
        const q = `query Q { notifications(orderBy: block_DESC, limit: 50) { id module kind refId actor block extrinsicHash meta } }`
        const res = await query(q)
        setItems(res.notifications || [])
      } catch {}
    })()
  }, [])
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={4} style={{ margin: '8px 8px 0' }}>通知中心</Typography.Title>
      <div style={{ padding: 8 }}>
        <List
          dataSource={items}
          renderItem={(it: any) => (
            <List.Item>
              <List.Item.Meta
                title={<span><Tag>{it.module}</Tag><Tag color="blue">{it.kind}</Tag> <span style={{ color: '#999' }}>#{it.block}</span></span>}
                description={<span>ref: {it.refId || '-'} | actor: {it.actor || '-'}</span>}
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  )
}

export default NotificationCenterPage


