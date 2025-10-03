import React, { useEffect, useMemo, useState } from 'react'
import { Card, Form, InputNumber, Button, List, Space, Tag, Typography, message, Pagination, Alert } from 'antd'

/**
 * 函数级详细中文注释：目标供奉时间线（全局链上直连模式）
 * - 当前禁用 Subsquid 查询，改为显示提示信息
 * - 未来可从链上直接查询或接入 Subsquid
 */
const OfferingsTimeline: React.FC = () => {
  const [form] = Form.useForm()
  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [total, setTotal] = useState<number>(0)
  const [lastQuery, setLastQuery] = useState<{ d:number; id:number; from?:number|null; to?:number|null }|null>(null)
  // 全局链上直连模式，暂时不使用 Subsquid
  const endpoint = ''

  // 函数级中文注释：全局链上直连模式，暂时禁用查询
  const query = async (domain: number, targetId: number, from?: number|null, to?: number|null, p: number = page, ps: number = pageSize) => {
    // 暂时禁用 Subsquid 查询
    message.warning('当前采用全局链上直连模式，供奉时间线功能暂时禁用')
    setItems([])
    setTotal(0)
    
    /* 原 Subsquid 查询代码（暂时注释）
    try {
      const q = `query Q($d:Int!,$id:BigInt!,$from:Int,$to:Int,$limit:Int!,$offset:Int!){
        a: offeringBySacrifices(
          orderBy: block_DESC,
          where:{targetDomain_eq:$d,targetId_eq:$id, ${'${FROM}'} ${'${TO}'} }
          limit:$limit, offset:$offset
        ){
          id block who amount sacrificeId durationWeeks targetDomain targetId
        }
        c: offeringBySacrificesConnection(
          orderBy: block_DESC,
          where:{targetDomain_eq:$d,targetId_eq:$id, ${'${FROM}'} ${'${TO}'} }
        ){ totalCount }
      }`
      const whereFrom = from!=null ? `block_gte:$from,` : ''
      const whereTo = to!=null ? `block_lte:$to,` : ''
      const built = q.replace('${FROM}', whereFrom).replace('${TO}', whereTo)
      const variables:any = { d: domain, id: targetId, from: from ?? null, to: to ?? null, limit: ps, offset: (p-1)*ps }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: built, variables }) })
      const json = await res.json()
      const rows = json?.data?.a || []
      setItems(rows)
      setTotal(Number(json?.data?.c?.totalCount || 0))
    } catch (e:any) { message.error(e?.message||'查询失败') }
    */
  }

  const onFinish = (v:any) => {
    const d = Number(v.domain)
    const id = Number(v.targetId)
    const from = v.fromBlock===''? null : (v.fromBlock!=null? Number(v.fromBlock): null)
    const to = v.toBlock===''? null : (v.toBlock!=null? Number(v.toBlock): null)
    setPage(1)
    setLastQuery({ d, id, from, to })
    query(d, id, from, to, 1, pageSize)
  }

  useEffect(()=>{ /* 可选：默认查询 */ }, [])

  const summary = useMemo(()=>{
    try { return items.reduce((acc, r)=> acc + BigInt(r.amount||0), 0n) } catch { return 0n }
  }, [items])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12, textAlign: 'left' }}>
      <Typography.Title level={4}>目标供奉时间线</Typography.Title>
      <Alert type="warning" showIcon message="功能暂时禁用" description="当前采用全局链上直连模式，供奉时间线功能暂时禁用。需要部署 Subsquid 索引器后启用。" style={{ marginBottom: 12 }} />
      <Card size="small">
        <Form form={form} layout="inline" onFinish={onFinish} style={{ rowGap: 8 }} initialValues={{ domain: 1 }}>
          <Form.Item name="domain" rules={[{ required: true }]}>
            <InputNumber placeholder="domain(u8)" min={0} />
          </Form.Item>
          <Form.Item name="targetId" rules={[{ required: true }]}>
            <InputNumber placeholder="target_id(u64)" min={0} />
          </Form.Item>
          <Form.Item name="fromBlock">
            <InputNumber placeholder="from block(可选)" min={0} />
          </Form.Item>
          <Form.Item name="toBlock">
            <InputNumber placeholder="to block(可选)" min={0} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">查询</Button>
          </Form.Item>
        </Form>
      </Card>
      <Card size="small" style={{ marginTop: 12 }} title="时间线" extra={
        <Button onClick={() => {
          try {
            const header = ['id','block','who','amount','sacrificeId','durationWeeks','targetDomain','targetId']
            const rows = items.map((r:any)=> [r.id, r.block, r.who, r.amount, r.sacrificeId, r.durationWeeks??'', r.targetDomain??lastQuery?.d??'', r.targetId??lastQuery?.id??''])
            const csv = [header.join(','), ...rows.map((row)=> row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = 'offerings_timeline.csv'; a.click(); URL.revokeObjectURL(url)
          } catch (e:any) { message.error(e?.message||'导出失败') }
        }}>导出CSV</Button>
      }>
        <div style={{ marginBottom: 8 }}>本页合计金额：{summary.toString()}（条数：{items.length} / 总数：{total}）</div>
        <List
          dataSource={items}
          renderItem={(r:any)=> (
            <List.Item>
              <Space direction="vertical" size={2}>
                <Space>
                  <Tag color="blue">#{r.id}</Tag>
                  <span>block {r.block}</span>
                </Space>
                <div>who: {r.who}</div>
                <div>amount: {r.amount}</div>
                <div>sacrificeId: {r.sacrificeId} durationWeeks: {r.durationWeeks ?? '-'}</div>
                <Space>
                  <Button size="small" onClick={()=> { location.hash = '#/browse/category' }}>去购买/查看目录</Button>
                </Space>
              </Space>
            </List.Item>
          )}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div>
            <span>每页</span>
            <InputNumber value={pageSize} min={5} max={100} onChange={(v)=>{
              const ps = Number(v||20)
              setPageSize(ps)
              if (lastQuery) { query(lastQuery.d, lastQuery.id, lastQuery.from, lastQuery.to, 1, ps); setPage(1) }
            }} style={{ width: 90, marginLeft: 8 }} />
          </div>
          <Pagination current={page} pageSize={pageSize} total={total}
            onChange={(p)=>{ setPage(p); if (lastQuery) query(lastQuery.d, lastQuery.id, lastQuery.from, lastQuery.to, p, pageSize) }} showSizeChanger={false} />
        </div>
      </Card>
    </div>
  )
}

export default OfferingsTimeline


