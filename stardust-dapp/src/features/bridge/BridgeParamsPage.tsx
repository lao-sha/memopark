import React from 'react'
import { Card, Descriptions, Typography, Space, Alert, Input, Button, InputNumber } from 'antd'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：Bridge 参数只读页
 * - 展示 Params（single_max/daily_max/fee_bps/paused/...）
 * - 支持按账户与“近似当天”查询 DailyUsed
 */
const BridgeParamsPage: React.FC = () => {
  const [addr, setAddr] = React.useState('')
  const [day, setDay] = React.useState<number>(0)
  const [params, setParams] = React.useState<any>(null)
  const [used, setUsed] = React.useState<string>('0')
  const [error, setError] = React.useState('')
  const [fresh, setFresh] = React.useState<string>('未知')

  const loadParams = async () => {
    setError('')
    try{
      const api = await getApi()
      const q: any = (api.query as any).memoBridge
      if(!q) throw new Error('运行时未启用 memo-bridge')
      const p = await q.params?.()
      setParams(p?.toHuman?.() || p?.toJSON?.() || null)
    }catch(e:any){ setError(e?.message||'查询失败') }
  }

  const loadUsed = async () => {
    setError('')
    try{
      const api = await getApi()
      const q: any = (api.query as any).memoBridge
      if(!q) throw new Error('运行时未启用 memo-bridge')
      const v = await q.dailyUsed?.(addr, day)
      setUsed(String(v?.toString?.() || '0'))
    }catch(e:any){ setError(e?.message||'查询失败') }
  }

  const loadFreshness = async () => {
    try{
      const api = await getApi()
      const c: any = (api.consts as any).memoBridge || {}
      // 无直读接口，这里仅做占位提示；实际应由索引层/自定义 RPC 提供
      setFresh('价格源新鲜度：请在后端/索引层展示（占位）')
    }catch{}
  }

  React.useEffect(()=> { loadParams(); loadFreshness() }, [])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>Bridge 参数</Typography.Title>
        <Card size="small" title="Params">
          <Button onClick={loadParams}>刷新</Button>
          <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(params, null, 2)}</pre>
        </Card>
        <Card size="small" title="价格源新鲜度">
          <Typography.Text>{fresh}</Typography.Text>
        </Card>
        <Card size="small" title="DailyUsed 查询">
          <Space>
            <Input placeholder="账户地址" value={addr} onChange={e=> setAddr(e.target.value)} />
            <InputNumber min={0} value={day} onChange={v=> setDay(Number(v||0))} />
            <Button onClick={loadUsed}>查询</Button>
          </Space>
          <Typography.Text>已用额度：{used}</Typography.Text>
        </Card>
      </Space>
    </div>
  )
}

export default BridgeParamsPage
