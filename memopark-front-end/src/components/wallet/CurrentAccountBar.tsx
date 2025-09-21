import React, { useEffect, useState } from 'react'
import { Card, Typography, Space, Button } from 'antd'
import { getCurrentAddress } from '../../lib/keystore'
import { queryFreeBalance } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：当前账户信息栏
 * - 显示当前地址与余额
 * - 每 12 秒轮询刷新；收到 mp.refreshBalances 事件时立即刷新
 */
const CurrentAccountBar: React.FC = () => {
  const [address, setAddress] = useState<string | null>(getCurrentAddress())
  const [balance, setBalance] = useState<string>('')
  const [symbol, setSymbol] = useState<string>('')

  const refresh = async () => {
    try {
      const addr = getCurrentAddress()
      setAddress(addr)
      if (addr) {
        const b = await queryFreeBalance(addr)
        setBalance(b.formatted)
        setSymbol(b.symbol)
      } else { setBalance(''); setSymbol('') }
    } catch { setBalance('') }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 12000)
    const h = () => refresh()
    window.addEventListener('mp.refreshBalances', h)
    return () => { clearInterval(t); window.removeEventListener('mp.refreshBalances', h) }
  }, [])

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space>
        <Typography.Text type="secondary">当前账户：</Typography.Text>
        <Typography.Text code>{address || '-'}</Typography.Text>
        {address && <Typography.Text>余额：{balance} {symbol}</Typography.Text>}
        <Button size="small" onClick={refresh}>刷新</Button>
      </Space>
    </Card>
  )
}

export default CurrentAccountBar


