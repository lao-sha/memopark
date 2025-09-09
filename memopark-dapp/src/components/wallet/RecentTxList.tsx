import React, { useEffect, useState } from 'react'
import { Card, List, Typography, Tag, Button, Space, Tooltip, message, Switch } from 'antd'
import { loadTxHistory } from '../../lib/txHistory'
import type { TxRecord } from '../../lib/txHistory'
import { getCurrentAddress } from '../../lib/keystore'

/**
 * 函数级详细中文注释：最近交易列表（本地）
 * - 显示最近提交的交易 hash 与简单元信息
 * - 监听 mp.txUpdate 事件自动刷新
 */
const RecentTxList: React.FC = () => {
  const [items, setItems] = useState<TxRecord[]>([])
  const [onlyCurrent, setOnlyCurrent] = useState<boolean>(true)
  const [current, setCurrent] = useState<string | null>(getCurrentAddress())

  const refresh = () => { setItems(loadTxHistory()); setCurrent(getCurrentAddress()) }

  useEffect(() => {
    refresh()
    const h = () => refresh()
    window.addEventListener('mp.txUpdate', h)
    return () => window.removeEventListener('mp.txUpdate', h)
  }, [])

  const filtered = onlyCurrent && current ? items.filter(it => it.from === current) : items

  return (
    <Card size="small" title="最近交易" style={{ marginTop: 12 }} extra={
      <Space>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>仅当前</Typography.Text>
        <Switch size="small" checked={onlyCurrent} onChange={setOnlyCurrent} />
      </Space>
    }>
      {items.length === 0 ? (
        <Typography.Text type="secondary">暂无本地交易记录</Typography.Text>
      ) : (
        <List
          size="small"
          dataSource={filtered}
          renderItem={(it) => (
            <List.Item
              actions={[
                <Tooltip title="复制 hash" key="cpy">
                  <Button size="small" onClick={()=>{ navigator.clipboard.writeText(it.hash).then(()=> message.success('已复制')); }}>复制</Button>
                </Tooltip>,
              ]}
            >
              <Space wrap>
                <Tag color="blue">{new Date(it.timestamp).toLocaleTimeString()}</Tag>
                {it.from && <Tag color="geekblue">from {it.from.slice(0,6)}…{it.from.slice(-4)}</Tag>}
                {it.section && it.method && <Tag>{it.section}.{it.method}</Tag>}
                <Typography.Text code style={{ wordBreak:'break-all' }}>{it.hash}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}

export default RecentTxList


