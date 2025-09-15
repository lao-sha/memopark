import React, { useEffect, useMemo, useState } from 'react'
import { Card, List, Typography, Button, Space, Tag, Tooltip, message, Modal, Input } from 'antd'
import { ReloadOutlined, CheckCircleTwoTone, ExportOutlined, StarOutlined } from '@ant-design/icons'
import { loadAllKeystores, getCurrentAddress, setCurrentAddress, exportKeystoreJsonForAddress, migrateSingleToMulti, removeKeystore, getAlias, setAlias } from '../../lib/keystore'
import { sessionManager } from '../../lib/sessionManager'
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
  const [renameAddr, setRenameAddr] = useState<string>('')
  const [renameVal, setRenameVal] = useState<string>('')
  const [renameOpen, setRenameOpen] = useState<boolean>(false)

  useEffect(() => {
    migrateSingleToMulti()
    const sync = () => {
      const list = loadAllKeystores().map(x => ({ address: x.address, createdAt: x.createdAt }))
      setItems(list)
      setCurrent(getCurrentAddress())
    }
    sync()
    const onAcc = () => sync()
    window.addEventListener('mp.accountsUpdate', onAcc)
    window.addEventListener('storage', onAcc)
    return () => {
      window.removeEventListener('mp.accountsUpdate', onAcc)
      window.removeEventListener('storage', onAcc)
    }
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
      <Button icon={<ReloadOutlined />} size="small" onClick={refresh} loading={loading}>刷新余额</Button>
      <Button size="small" onClick={() => {
        const list = loadAllKeystores().map(x => ({ address: x.address, createdAt: x.createdAt }))
        setItems(list)
        setCurrent(getCurrentAddress())
        message.success('账户已刷新')
      }}>刷新账户</Button>
      <Button danger size="small" onClick={() => {
        Modal.confirm({
          title: '清空本地钱包与会话',
          content: '将移除本地所有钱包(keystores)、别名、当前账户与会话数据，仅清除本机存储，不可恢复。建议先导出备份。',
          okText: '清空',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => {
            try {
              localStorage.removeItem('mp.keystores')
              localStorage.removeItem('mp.keystore')
              localStorage.removeItem('mp.aliases')
              localStorage.removeItem('mp.current')
              localStorage.removeItem('mp.session')
              localStorage.removeItem('mp.allowances')
              setItems([])
              setCurrent(null)
              setBalances({})
              try { window.dispatchEvent(new Event('mp.accountsUpdate')) } catch {}
              message.success('已清空本地数据')
            } catch (e) { message.error('清空失败') }
          }
        })
      }}>清空本地数据</Button>
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
            const alias = getAlias(it.address)
            return (
              <List.Item
                actions={[
                  <Tooltip title="设为当前账户" key="set">
                    <Button size="small" icon={<StarOutlined />} type={isCurrent ? 'primary' : 'default'} onClick={() => { setCurrentAddress(it.address); setCurrent(it.address); message.success('已设为当前账户'); }} />
                  </Tooltip>,
                  <Tooltip title="导出JSON" key="exp">
                    <Button size="small" icon={<ExportOutlined />} onClick={() => { exportKeystoreJsonForAddress(it.address) || message.warning('导出失败'); }} />
                  </Tooltip>,
                  <Tooltip title="重命名" key="rename">
                    <Button size="small" onClick={() => { setRenameAddr(it.address); setRenameVal(alias || ''); setRenameOpen(true) }}>重命名</Button>
                  </Tooltip>,
                  <Tooltip title="删除" key="del">
                    <Button size="small" danger onClick={() => {
                      Modal.confirm({
                        title: '删除钱包',
                        content: '删除仅移除本地加密钱包(keystore)。建议先导出 JSON 备份。确认删除？',
                        okText: '删除',
                        okButtonProps: { danger: true },
                        cancelText: '取消',
                        onOk: () => {
                          try {
                            const curAddr = getCurrentAddress()
                            removeKeystore(it.address)
                            if (!curAddr || curAddr === it.address) {
                              try { sessionManager.clearSession() } catch {}
                            }
                            const list = loadAllKeystores().map(x => ({ address: x.address, createdAt: x.createdAt }))
                            setItems(list)
                            setCurrent(getCurrentAddress())
                            message.success('已删除')
                          } catch (e) { message.error('删除失败') }
                        }
                      })
                    }}>删除</Button>
                  </Tooltip>,
                ]}
              >
                <Space>
                  {isCurrent && <CheckCircleTwoTone twoToneColor="#52c41a" />}
                  <Typography.Text code>{alias ? `${alias} · ${it.address}` : it.address}</Typography.Text>
                  <Tag color="geekblue">{bal ? `${bal.formatted} ${bal.symbol}` : (symbol ? `- ${symbol}` : '-')}</Tag>
                </Space>
              </List.Item>
            )
          }}
        />
      )}
      <Modal
        open={renameOpen}
        title="重命名账户"
        onCancel={() => setRenameOpen(false)}
        onOk={() => { setAlias(renameAddr, renameVal.trim()); setRenameOpen(false); message.success('已更新别名') }}
      >
        <Input placeholder="输入别名（可留空清除）" value={renameVal} onChange={e => setRenameVal(e.target.value)} />
      </Modal>
    </Card>
  )
}

export default AccountsOverview


