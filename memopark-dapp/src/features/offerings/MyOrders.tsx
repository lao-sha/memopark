import React, { useEffect, useState } from 'react'
import { List, Tag, Space, Typography, Button } from 'antd'

/**
 * 函数级详细中文注释：“我的购买”页面
 * - 读取 localStorage('offeringsOrders') 最近 50 条订单
 * - 展示 txHash、目标、确认状态；提供清空按钮
 */
const MyOrders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([])
  const load = () => {
    try {
      const arr = JSON.parse(localStorage.getItem('offeringsOrders') || '[]')
      setOrders(arr)
    } catch { setOrders([]) }
  }
  useEffect(() => { load() }, [])
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12, textAlign: 'left' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4}>我的购买</Typography.Title>
        <Space>
          <Button onClick={()=> load()}>刷新</Button>
          <Button danger onClick={()=>{ localStorage.removeItem('offeringsOrders'); load() }}>清空</Button>
        </Space>
      </Space>
      <List
        dataSource={orders}
        renderItem={(o)=> (
          <List.Item>
            <Space direction="vertical" size={2}>
              <Space>
                <Tag color={o.confirmed? 'green':'orange'}>{o.confirmed? 'confirmed':'pending'}</Tag>
                <span>tx: {o.txHash}</span>
              </Space>
              <div>target=({o.domain},{o.targetId}) sacrificeId={o.sacrificeId} duration={o.duration ?? '-'} vip={String(o.isVip)}</div>
              <div>who={o.who ?? '-'} time={new Date(o.ts).toLocaleString()}</div>
            </Space>
          </List.Item>
        )}
      />
    </div>
  )
}

export default MyOrders


