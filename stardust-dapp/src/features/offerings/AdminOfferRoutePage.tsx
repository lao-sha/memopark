import React from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Radio, Space, Table, Typography, message } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

type Row = { key: number, kind: 0|1, account?: string, bps: number }

const columns = (onChange: (key:number, patch: Partial<Row>) => void) => [
  { title: '类型', dataIndex: 'kind', render: (v: number, r: Row) => (
    <Radio.Group value={v} onChange={(e) => onChange(r.key, { kind: (e.target.value as 0|1) })}>
      <Radio value={0}>主题资金(Subject)</Radio>
      <Radio value={1}>固定账户(Account)</Radio>
    </Radio.Group>
  ) },
  { title: '账户(当类型为固定账户时必填)', dataIndex: 'account', render: (v: string|undefined, r: Row) => (
    <Input value={v} disabled={r.kind===0} onChange={(e)=>onChange(r.key, { account: e.target.value.trim() })} placeholder="5... 或 0x.." />
  ) },
  { title: '比例(bps, ≤1000000)', dataIndex: 'bps', width: 160, render: (v: number, r: Row) => (
    <InputNumber min={0} max={1_000_000} value={v} onChange={(val)=>onChange(r.key, { bps: Number(val||0) })} />
  ) },
]

const AdminOfferRoutePage: React.FC = () => {
  const [domain, setDomain] = React.useState<number>(1)
  const [rows, setRows] = React.useState<Row[]>([])
  const [sum, setSum] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  const recalc = React.useCallback((rs: Row[]) => setSum(rs.reduce((a,b)=>a + (b.bps||0), 0)), [])

  const loadTable = React.useCallback(async (useGlobal=false) => {
    try {
      setLoading(true)
      const api = await getApi()
      const qroot: any = api.query as any
      const sec = qroot.memoOfferings || qroot.memo_offerings
      let data: any = null
      if (useGlobal) data = await sec.routeTableGlobal()
      else data = await sec.routeTableByDomain(domain)
      const rs: Row[] = []
      if (data && data.isSome) {
        const arr = data.unwrap()
        for (let i=0;i<arr.length;i++) {
          const it = arr[i]
          rs.push({ key: i+1, kind: Number(it.kind) as 0|1, account: it.account.isSome? String(it.account.unwrap()) : undefined, bps: Number(it.share.toString()) })
        }
      }
      setRows(rs)
      recalc(rs)
      message.success('已加载')
    } catch (e:any) { message.error(e?.message || '加载失败') } finally { setLoading(false) }
  }, [domain, recalc])

  const onChangeRow = (key:number, patch: Partial<Row>) => {
    const next = rows.map(r => r.key===key ? { ...r, ...patch } : r)
    setRows(next); recalc(next)
  }

  const addRow = () => {
    if (rows.length >= 5) return message.warning('最多 5 条')
    const k = (rows[rows.length-1]?.key||0)+1
    const newRow: Row = { key: k, kind: 0, bps: 0 }
    const next: Row[] = [...rows, newRow]
    setRows(next); recalc(next)
  }
  const delLast = () => { const next = rows.slice(0, -1); setRows(next); recalc(next) }

  const save = async (toGlobal=false) => {
    try {
      if (sum > 1_000_000) return message.error('合计 bps 超过 1000000')
      if (rows.length > 5) return message.error('最多 5 条路由')
      for (const r of rows) {
        if (r.kind === 1 && (!r.account || r.account.trim() === '')) {
          return message.error('固定账户(Account) 行必须填写账户地址')
        }
      }
      const api = await getApi()
      const args = rows.map(r => [r.kind, r.kind===1 ? r.account : null, r.bps])
      // 动态解析 section 名称：memoOfferings/memo_offerings
      const txRoot: any = api.tx as any
      const sec = (txRoot.memoOfferings ? 'memoOfferings' : (txRoot.memo_offerings ? 'memo_offerings' : 'memoOfferings'))
      const hash = await signAndSendLocalFromKeystore(sec, toGlobal? 'setRouteTableGlobal' : 'setRouteTableByDomain', toGlobal? [args] : [domain, args])
      message.success(`已提交：${hash}`)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>供奉分账路由（治理）</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card size="small">
          <Space wrap>
            <span>域(domain)：</span>
            <InputNumber min={0} max={255} value={domain} onChange={(v)=>setDomain(Number(v||0))} />
            <Button onClick={()=>loadTable(false)} loading={loading}>读取域路由</Button>
            <Button onClick={()=>loadTable(true)} loading={loading}>读取全局路由</Button>
            <Alert type="info" showIcon message={`合计 bps：${sum}（≤ 1000000）`} />
          </Space>
        </Card>

        <Card size="small" title="路由配置">
          <Table pagination={false} dataSource={rows} columns={columns(onChangeRow)} rowKey="key" size="small" />
          <Space style={{ marginTop: 8 }}>
            <Button onClick={addRow} disabled={rows.length>=5}>新增行</Button>
            <Button onClick={delLast} disabled={rows.length===0}>删除最后一行</Button>
          </Space>
        </Card>

        <Space>
          <Button type="primary" onClick={()=>save(false)}>保存到域</Button>
          <Button onClick={()=>save(true)}>保存到全局</Button>
        </Space>
        <Alert type="warning" showIcon message="说明：Subject 类型仅在纪念馆域生效；剩余按策略回退至默认账户；最多 5 条，合计 ≤ 100%。"/>
      </Space>
    </div>
  )
}

export default AdminOfferRoutePage


