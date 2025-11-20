import React, { useEffect, useState } from 'react'
import { List, Tag, Typography, Alert } from 'antd'

/**
 * 函数级详细中文注释：通知中心（统一事件时间线）
 * - 数据源：全局链上直连模式，暂时禁用（移除 Subsquid 依赖）
 * - 展示：最近 50 条事件，含模块/类型/引用ID/区块高度
 */
const NotificationCenterPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  
  /**
   * 函数级中文注释：全局链上直连模式，暂时禁用 Subsquid 查询
   */
  useEffect(() => {
    // 暂时禁用，等待链上直连实现
    setItems([])
  }, [])
  
  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <Typography.Title level={4} style={{ margin: '8px 8px 0' }}>通知中心</Typography.Title>
      <div style={{ padding: 8 }}>
        <Alert 
          type="warning" 
          showIcon 
          message="功能暂时禁用" 
          description="当前采用全局链上直连模式，通知中心功能暂时禁用。需要部署 Subsquid 索引器后启用。" 
          style={{ marginBottom: 12 }}
        />
        <List
          dataSource={items}
          locale={{ emptyText: '暂无通知' }}
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


