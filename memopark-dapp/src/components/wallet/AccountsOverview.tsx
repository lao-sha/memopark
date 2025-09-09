import React, { useEffect, useMemo, useState } from 'react'
import { Card, List, Typography, Button, Space, Tag, Tooltip, message } from 'antd'
import { ReloadOutlined, CheckCircleTwoTone, ExportOutlined, StarOutlined } from '@ant-design/icons'
import { loadAllKeystores, getCurrentAddress, setCurrentAddress, exportKeystoreJsonForAddress, migrateSingleToMulti } from '../../lib/keystore'
import { getApi } from '../../lib/polkadot'
import { queryFreeBalance } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：本地账户总览组件
 * - 读取浏览器本地保存的多个 keystore（地址列表）
 * - 查询并展示每个地址的余额（symbol/decimals 自动读取）
 * - 提供“设为当前账户”“导出JSON”“刷新余额”操作
 */
const AccountsOverview: React.FC = () => {
  const [items, setItems] = useState<Array<{ address: string; createdAt: number }>>([])
  const [balances, setBalances] = useState<Record<string, { formatted: string; symbol: string }>>({})
  const [current, setCurrent] = useState<string | null>(getCurrentAddress())
  const [loading, setLoading] = useState(false)
  const [symbol, setSymbol] = useState<string>('')

  useEffect(() => {
    migrateSingleToMulti()
    const list = loadAllKeystores().map(x => ({ address: x.address, createdAt: x.createdAt }))
    setItems(list)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const api = await getApi()
        setSymbol((api.registry.chainTokens?.[0] as string) || '')
      } catch {}
    })()
  }, [])

  const refresh = async () => {
    if (!items.length) return
    setLoading(true)
    try {
      const results = await Promise.all(items.map(async it => {
        try {
          const b = await queryFreeBalance(it.address)
          return [it.address, { formatted: b.formatted, symbol: b.symbol }] as const
        } catch {
          return [it.address, { formatted: '0', symbol: symbol || '' }] as const
        }
      }))
      setBalances(Object.fromEntries(results))
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [items.length])

  // 监听全局余额刷新事件（如转账成功后触发）
  useEffect(() => {
    const h = () => { refresh() }
    window.addEventListener('mp.refreshBalances', h)
    return () => window.removeEventListener('mp.refreshBalances', h)
  }, [items.length])

  const headerExtra = useMemo(() => (
    <Space>
      <Button icon={<ReloadOutlined />} size="small" onClick={refresh} loading={loading}>刷新</Button>
    </Space>
  ), [loading])

  return (
    <Card title="本地账户概览" extra={headerExtra} size="small">
      {items.length === 0 ? (
        <Typography.Text type="secondary">尚未导入或创建本地钱包。</Typography.Text>
      ) : (
        <List
          size="small"
          dataSource={items}
          renderItem={(it) => {
            const bal = balances[it.address]
            const isCurrent = current === it.address
            return (
              <List.Item
                actions={[
                  <Tooltip title="设为当前账户" key="set">
                    <Button size="small" icon={<StarOutlined />} type={isCurrent ? 'primary' : 'default'} onClick={() => { setCurrentAddress(it.address); setCurrent(it.address); message.success('已设为当前账户'); }} />
                  </Tooltip>,
                  <Tooltip title="导出JSON" key="exp">
                    <Button size="small" icon={<ExportOutlined />} onClick={() => { exportKeystoreJsonForAddress(it.address) || message.warning('导出失败'); }} />
                  </Tooltip>,
                ]}
              >
                <Space>
                  {isCurrent && <CheckCircleTwoTone twoToneColor="#52c41a" />}
                  <Typography.Text code>{it.address}</Typography.Text>
                  <Tag color="geekblue">{bal ? `${bal.formatted} ${bal.symbol}` : (symbol ? `- ${symbol}` : '-')}</Tag>
                </Space>
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}

export default AccountsOverview


