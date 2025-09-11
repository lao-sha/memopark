import React, { useEffect, useState } from 'react'
import { Card, List, Typography, Tag, Space, Input, Button, Pagination, Alert } from 'antd'
import { query } from '../../lib/graphql'

/**
 * 函数级详细中文注释：墓地列表页面（GraphQL）
 * - 优先从 Subsquid GraphQL 查询 halls（纪念馆/墓地）；若 schema 不一致，尝试 graves。
 * - 支持分页与按 owner 过滤；展示 id/owner/parkId/kind/slug/创建时间。
 */
const GraveListPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [owner, setOwner] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const load = async (p: number, ps: number, ownerFilter: string) => {
    setLoading(true); setError('')
    try {
      const offset = (p - 1) * ps
      const vars: any = { limit: ps, offset, owner: ownerFilter || undefined }
      // 方案 A：halls
      const qA = `query Q($limit:Int!,$offset:Int!,$owner:String){
        halls(orderBy: createdAt_DESC, limit:$limit, offset:$offset ${ownerFilter?`, where:{ owner_eq:$owner }`:''}){
          id owner parkId kind slug createdAt
        }
        hallsConnection${ownerFilter?`(where:{ owner_eq:$owner })`:'()'}{ totalCount }
      }`
      try {
        const resA: any = await query(qA, vars)
        if (resA?.halls) {
          setItems(resA.halls)
          setTotal(resA.hallsConnection?.totalCount ?? resA.halls.length)
          setLoading(false)
          return
        }
      } catch {}
      // 方案 B：graves（字段尽量兼容）
      const qB = `query Q($limit:Int!,$offset:Int!,$owner:String){
        graves(orderBy: createdAt_DESC, limit:$limit, offset:$offset ${ownerFilter?`, where:{ owner_eq:$owner }`:''}){
          id owner parkId kind slug createdAt
        }
        gravesConnection${ownerFilter?`(where:{ owner_eq:$owner })`:'()'}{ totalCount }
      }`
      const resB: any = await query(qB, vars)
      if (resB?.graves) {
        setItems(resB.graves)
        setTotal(resB.gravesConnection?.totalCount ?? resB.graves.length)
      } else {
        setItems([])
        setTotal(0)
        setError('GraphQL schema 中未找到 halls/graves。请检查索引服务。')
      }
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setItems([])
      setTotal(0)
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load(page, pageSize, owner) }, [])

  const onSearch = () => { setPage(1); load(1, pageSize, owner) }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: 12 }}>
      <Card title="墓地列表（Subsquid）" extra={
        <Space>
          <Input placeholder="按 owner 过滤 (可选)" value={owner} onChange={e=> setOwner(e.target.value)} allowClear />
          <Button onClick={onSearch} loading={loading}>查询</Button>
        </Space>
      }>
        {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}
        <List
          loading={loading}
          dataSource={items}
          renderItem={(it:any)=> (
            <List.Item>
              <Space direction="vertical" style={{ width:'100%' }}>
                <Space>
                  <Typography.Text strong>#{it.id}</Typography.Text>
                  {it.slug && <Tag>{Array.isArray(it.slug)? new TextDecoder().decode(new Uint8Array(it.slug)) : String(it.slug)}</Tag>}
                  {it.kind!=null && <Tag color="geekblue">kind {String(it.kind)}</Tag>}
                  {it.parkId!=null && <Tag color="purple">park {String(it.parkId)}</Tag>}
                </Space>
                <Typography.Text type="secondary">owner: {it.owner}</Typography.Text>
                {it.createdAt && <Typography.Text type="secondary">createdAt: {String(it.createdAt)}</Typography.Text>}
              </Space>
            </List.Item>
          )}
        />
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Pagination current={page} pageSize={pageSize} total={total} onChange={(p, ps)=>{ setPage(p); setPageSize(ps); load(p, ps, owner) }} showSizeChanger showTotal={t=>`共 ${t} 条`} />
        </div>
      </Card>
    </div>
  )
}

export default GraveListPage


