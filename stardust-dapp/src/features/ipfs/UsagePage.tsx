import React from 'react'
import { Card, Descriptions, Typography, Space, Alert, Input, InputNumber, Button, List, Tag } from 'antd'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：IPFS 用量/账单只读页
 * - 展示计费参数与暂停开关
 * - 支持按区块范围查看 DueQueue，及按 cid_hash 查询 PinBilling
 */
const UsagePage: React.FC = () => {
  const [from, setFrom] = React.useState<number>(0)
  const [to, setTo] = React.useState<number>(0)
  const [hashHex, setHashHex] = React.useState('')
  const [params, setParams] = React.useState<any>(null)
  const [due, setDue] = React.useState<any[]>([])
  const [one, setOne] = React.useState<any>(null)
  const [error, setError] = React.useState('')

  const loadParams = async () => {
    setError('')
    try{
      const api = await getApi()
      const q: any = (api.query as any).memoIpfs || (api.query as any).memo_ipfs || (api.query as any).ipfs
      if(!q) throw new Error('运行时未启用 memo-ipfs')
      const [price, period, grace, maxPerBlock, reserve, paused] = await Promise.all([
        q.pricePerGiBWeek?.(), q.billingPeriodBlocks?.(), q.graceBlocks?.(), q.maxChargePerBlock?.(), q.subjectMinReserve?.(), q.billingPaused?.()
      ])
      setParams({
        pricePerGiBWeek: price?.toString?.() || '0',
        periodBlocks: Number(period||0),
        graceBlocks: Number(grace||0),
        maxChargePerBlock: Number(maxPerBlock||0),
        subjectMinReserve: reserve?.toString?.() || '0',
        paused: Boolean(paused?.toJSON?.()),
      })
    }catch(e:any){ setError(e?.message||'查询失败') }
  }

  const loadDue = async () => {
    setError(''); setDue([])
    try{
      const api = await getApi()
      const q: any = (api.query as any).memoIpfs || (api.query as any).memo_ipfs || (api.query as any).ipfs
      if(!q) throw new Error('运行时未启用 memo-ipfs')
      const out: any[] = []
      for(let n=from; n<=to && out.length<200; n++){
        const v = await q.dueQueue?.(n)
        const arr = v?.toJSON?.() as any[]
        if(arr && arr.length){ out.push({ block: n, cids: arr }) }
      }
      setDue(out)
    }catch(e:any){ setError(e?.message||'查询失败') }
  }

  const loadOne = async () => {
    setError(''); setOne(null)
    try{
      const api = await getApi()
      const q: any = (api.query as any).memoIpfs || (api.query as any).memo_ipfs || (api.query as any).ipfs
      if(!q) throw new Error('运行时未启用 memo-ipfs')
      const h = hashHex
      const v = await q.pinBilling?.(h)
      setOne(v?.toHuman?.() || v?.toJSON?.() || null)
    }catch(e:any){ setError(e?.message||'查询失败') }
  }

  React.useEffect(()=> { loadParams() }, [])

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>IPFS 用量/账单</Typography.Title>
        <Card size="small" title="计费参数">
          <Button onClick={loadParams}>刷新</Button>
          <Descriptions column={1}>
            <Descriptions.Item label="price_per_gib_week">{params?.pricePerGiBWeek}</Descriptions.Item>
            <Descriptions.Item label="period_blocks">{params?.periodBlocks}</Descriptions.Item>
            <Descriptions.Item label="grace_blocks">{params?.graceBlocks}</Descriptions.Item>
            <Descriptions.Item label="max_charge_per_block">{params?.maxChargePerBlock}</Descriptions.Item>
            <Descriptions.Item label="subject_min_reserve">{params?.subjectMinReserve}</Descriptions.Item>
            <Descriptions.Item label="paused">{String(params?.paused)}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card size="small" title="到期队列 DueQueue(block → cid_hash[])" extra={<Space>
          <InputNumber min={0} value={from} onChange={v=> setFrom(Number(v||0))} />
          <InputNumber min={0} value={to} onChange={v=> setTo(Number(v||0))} />
          <Button onClick={loadDue}>查询</Button>
        </Space>}>
          <List bordered dataSource={due} renderItem={(it:any)=> (
            <List.Item>
              <Space direction="vertical" style={{ width:'100%' }}>
                <Space><Tag color="blue">block {it.block}</Tag><Tag>items {it.cids.length}</Tag></Space>
                <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(it.cids, null, 2)}</pre>
              </Space>
            </List.Item>
          )} />
        </Card>
        <Card size="small" title="按 cid_hash 查询 PinBilling">
          <Space>
            <Input placeholder="0x... blake2_256 哈希" value={hashHex} onChange={e=> setHashHex(e.target.value)} />
            <Button onClick={loadOne}>查询</Button>
          </Space>
          {one && <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(one, null, 2)}</pre>}
        </Card>
      </Space>
    </div>
  )
}

export default UsagePage
