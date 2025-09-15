import React, { useEffect, useMemo, useState } from 'react'
import { Card, Form, Input, Button, List, Space, Tag, Typography, message, InputNumber, Pagination } from 'antd'

/**
 * 函数级详细中文注释：按地址查询供奉历史（Subsquid）
 * - 查询 OfferingBySacrifice 表的 who 字段
 */
const OfferingsByWho: React.FC = () => {
  const [form] = Form.useForm()
  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [total, setTotal] = useState<number>(0)
  const [lastWho, setLastWho] = useState<string>('')
  const endpoint = (import.meta as any).env?.VITE_SQUID_HTTP || (window as any).__SQUID_HTTP__ || 'http://localhost:4350/graphql'

  const query = async (who: string, from?: number|null, to?: number|null, p: number = page, ps: number = pageSize) => {
    try {
      const q = `query Q($who:String!,$from:Int,$to:Int,$limit:Int!,$offset:Int!){
        a: offeringBySacrifices(orderBy: block_DESC, where:{who_eq:$who, ${'${FROM}'} ${'${TO}'} }, limit:$limit, offset:$offset){ id block who amount sacrificeId targetDomain targetId durationWeeks }
        c: offeringBySacrificesConnection(orderBy: block_DESC, where:{who_eq:$who, ${'${FROM}'} ${'${TO}'} }){ totalCount }
      }`
      const whereFrom = from!=null ? `block_gte:$from,` : ''
      const whereTo = to!=null ? `block_lte:$to,` : ''
      const built = q.replace('${FROM}', whereFrom).replace('${TO}', whereTo)
      const variables:any = { who, from: from ?? null, to: to ?? null, limit: ps, offset: (p-1)*ps }
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: built, variables }) })
      const json = await res.json()
      setItems(json?.data?.a || [])
      setTotal(Number(json?.data?.c?.totalCount || 0))
    } catch (e:any) { message.error(e?.message||'查询失败') }
  }

  const onFinish = (v:any) => {
    const who = String(v.who||'').trim()
    const from = v.fromBlock===''? null : (v.fromBlock!=null? Number(v.fromBlock): null)
    const to = v.toBlock===''? null : (v.toBlock!=null? Number(v.toBlock): null)
    setLastWho(who)
    setPage(1)
    query(who, from, to, 1, pageSize)
  }

  useEffect(()=>{}, [])

  const summary = useMemo(()=>{
    try { return items.reduce((acc, r)=> acc + BigInt(r.amount||0), 0n) } catch { return 0n }
  }, [items])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12, textAlign: 'left' }}>
      <Typography.Title level={4}>按地址查询供奉</Typography.Title>
      <Card size="small">
        <Form form={form} layout="inline" onFinish={onFinish} style={{ rowGap: 8 }}>
          <Form.Item name="who" rules={[{ required: true, message: '请输入地址' }]}>
            <Input placeholder="5F..." style={{ width: 300 }} />
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
      <Card size="small" style={{ marginTop: 12 }} title="结果">
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
                <div>target=({r.targetDomain},{r.targetId}) amount={r.amount} sacrificeId={r.sacrificeId} duration={r.durationWeeks??'-'}</div>
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
              if (lastWho) {
                const fv = form.getFieldValue('fromBlock'); const tv = form.getFieldValue('toBlock')
                const from = fv===''? null : (fv!=null? Number(fv): null)
                const to = tv===''? null : (tv!=null? Number(tv): null)
                query(lastWho, from, to, 1, ps); setPage(1)
              }
            }} style={{ width: 90, marginLeft: 8 }} />
          </div>
          <Pagination current={page} pageSize={pageSize} total={total}
            onChange={(p)=>{
              setPage(p)
              if (lastWho) {
                const fv = form.getFieldValue('fromBlock'); const tv = form.getFieldValue('toBlock')
                const from = fv===''? null : (fv!=null? Number(fv): null)
                const to = tv===''? null : (tv!=null? Number(tv): null)
                query(lastWho, from, to, p, pageSize)
              }
            }} showSizeChanger={false} />
        </div>
      </Card>
    </div>
  )
}

export default OfferingsByWho


