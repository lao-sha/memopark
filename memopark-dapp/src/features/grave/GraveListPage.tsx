import React, { useEffect, useState } from 'react'
import { Card, List, Typography, Tag, Space, Input, Button, Pagination, Alert } from 'antd'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：墓地列表页面（链上直读）
 * - 不再依赖 Subsquid；直接读取 pallet-memo-grave 的存储：NextGraveId/Graves/SlugOf。
 * - 仅做前端分页（客户端切分）；支持按 owner 过滤；展示 id/owner/parkId/kind/slug。
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
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      // 兼容多种命名：memo_grave / memoGrave / grave；若均未命中则尝试模糊匹配
      let q: any = queryRoot.memo_grave || queryRoot.memoGrave || queryRoot.grave
      if (!q) {
        const foundKey = Object.keys(queryRoot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k))
        if (foundKey) q = queryRoot[foundKey]
      }
      if (!q?.nextGraveId || !q?.graves || !q?.slugOf) {
        const keys = Object.keys(queryRoot).filter(k=>/grave/i.test(k)).join(', ')
        throw new Error(keys ? `未找到 memo_grave（候选: ${keys}），或缺少必要存储项` : '运行时未启用 memo_grave 或元数据缺失')
      }
      // 读取逝者模块（可选）：用于显示姓名。若不存在，则跳过姓名显示。
      const dq: any = queryRoot.deceased || queryRoot.memo_deceased || queryRoot.memoDeceased
      const nextId = await q.nextGraveId().then((x:any)=>x?.toNumber? x.toNumber(): 0)
      const ids = Array.from({ length: nextId }).map((_,i)=>i)
      // 拉取所有存在的墓地（注意：空洞需要过滤）
      const all = await Promise.all(ids.map(async (id)=>{
        try {
          const gOpt = await q.graves(id)
          if (!gOpt || !gOpt.isSome) return null
          const g = gOpt.unwrap()
          // 读取 slug（可选）
          let slug: string | undefined = undefined
          try {
            const sOpt = await q.slugOf(id)
            if (sOpt && sOpt.isSome) {
              const u8 = (sOpt.unwrap() as any).toU8a ? (sOpt.unwrap() as any).toU8a() : new Uint8Array([])
              slug = new TextDecoder().decode(u8)
            }
          } catch {}
          // 读取姓名（可选）：从 deceasedByGrave -> deceasedOf[*] 提取 name，最多展示前两位
          let names: string[] = []
          try {
            if (dq?.deceasedByGrave && dq?.deceasedOf) {
              const lst: any = await dq.deceasedByGrave(id)
              // 将 Vec<DeceasedId> 转为 number[]
              const arr: number[] = Array.isArray(lst) ? lst as any : (lst?.toJSON?.() || [])
              const top = (arr as number[]).slice(0, 2)
              for (const did of top) {
                try {
                  const dOpt = await dq.deceasedOf(did)
                  if (dOpt && dOpt.isSome) {
                    const d = dOpt.unwrap()
                    const nameU8 = d.name?.toU8a ? d.name.toU8a() : (d.name?.toJSON ? new Uint8Array(d.name.toJSON()) : undefined)
                    if (nameU8) names.push(new TextDecoder().decode(nameU8))
                  }
                } catch {}
              }
            }
          } catch {}
          return {
            id,
            owner: g.owner?.toString?.() || String(g.owner),
            parkId: g.parkId?.isSome ? g.parkId.unwrap().toNumber() : null,
            kind: g.kindCode?.toNumber ? g.kindCode.toNumber() : Number(g.kind_code ?? g.kindCode ?? 0),
            slug,
            names,
          }
        } catch { return null }
      }))
      let list = all.filter(Boolean) as any[]
      if (ownerFilter) {
        list = list.filter(it => String(it.owner) === ownerFilter)
      }
      // 客户端分页
      const offset = (p - 1) * ps
      setTotal(list.length)
      setItems(list.slice(offset, offset + ps))
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
      <Card title="墓地列表（链上直读）" extra={
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
                {Array.isArray(it.names) && it.names.length > 0 && (
                  <Typography.Text type="secondary">
                    姓名：{it.names.join('、')}{it.names.length >= 2 ? ' 等' : ''}
                  </Typography.Text>
                )}
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


