import React, { useEffect, useState } from 'react'
import { Card, List, Typography, Tag, Space, Input, Button, Pagination, Alert, Modal, Select } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

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
  const [nameKeyword, setNameKeyword] = useState<string>('')
  const [sortKey, setSortKey] = useState<'id'|'park'|'active'|'public'>('id')
  const [sortAsc, setSortAsc] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [maxNameLen, setMaxNameLen] = useState<number>(0)
  const [renameOpen, setRenameOpen] = useState<boolean>(false)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameVal, setRenameVal] = useState<string>('')

  const load = async (p: number, ps: number, ownerFilter: string) => {
    setLoading(true); setError('')
    try {
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      // 读取常量：MaxCidLen 作为名称最大字节数
      try { const c: any = (api.consts as any)?.memoGrave?.maxCidLen; if (c) setMaxNameLen(Number(c.toString())) } catch {}
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
          // 读取名称（明文，直接解码 UTF-8）
          let name: string | undefined = undefined
          try {
            const nmU8 = (g.name?.toU8a ? g.name.toU8a() : (g.name?.toJSON ? new Uint8Array(g.name.toJSON()) : undefined)) as Uint8Array | undefined
            if (nmU8) name = new TextDecoder().decode(nmU8)
          } catch {}
          // 读取封面 CID（可选）
          let coverCid: string | undefined = undefined
          try {
            const cOpt = await (q.coverCidOf ? q.coverCidOf(id) : null)
            if (cOpt && cOpt.isSome) {
              const u8 = (cOpt.unwrap() as any).toU8a ? (cOpt.unwrap() as any).toU8a() : new Uint8Array([])
              coverCid = new TextDecoder().decode(u8)
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
            name,
            names,
            coverCid,
          }
        } catch { return null }
      }))
      let list = all.filter(Boolean) as any[]
      if (ownerFilter) list = list.filter(it => String(it.owner) === ownerFilter)
      if (nameKeyword) list = list.filter(it => (it.name || '').includes(nameKeyword))
      // 排序
      list.sort((a,b)=>{
        const sgn = sortAsc ? 1 : -1
        if (sortKey === 'id') return sgn*(a.id - b.id)
        if (sortKey === 'park') return sgn*(((a.parkId??-1) - (b.parkId??-1)))
        if (sortKey === 'active') return sgn*(((a.active?1:0) - (b.active?1:0)))
        if (sortKey === 'public') return sgn*(((a.isPublic?1:0) - (b.isPublic?1:0)))
        return 0
      })
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
        <Space wrap>
          <Input placeholder="按 owner 过滤 (可选)" value={owner} onChange={e=> setOwner(e.target.value)} allowClear />
          <Input placeholder="按名称关键词过滤" value={nameKeyword} onChange={e=> setNameKeyword(e.target.value)} allowClear />
          <Select size="middle" value={sortKey} onChange={(v)=> setSortKey(v)} style={{ width: 140 }}
            options={[{value:'id',label:'按ID'},{value:'park',label:'按ParkId'},{value:'active',label:'按Active'},{value:'public',label:'按Public'}]} />
          <Button onClick={()=> setSortAsc(v=>!v)}>{sortAsc? '升序':'降序'}</Button>
          <Button type="primary" onClick={onSearch} loading={loading}>查询</Button>
        </Space>
      }>
        {error && <Alert type="error" showIcon style={{ marginBottom: 12 }} message={error} />}
        <List
          loading={loading}
          dataSource={items}
          renderItem={(it:any)=> (
            <List.Item>
              <Space direction="vertical" style={{ width:'100%' }}>
                <Space align="start">
                  {/* 函数级中文注释：封面缩略图展示 */}
                  {it.coverCid ? (
                    <img alt="cover" src={`https://ipfs.io/ipfs/${it.coverCid}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 8, border: '1px solid #eee', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>封面</div>
                  )}
                  <Space direction="vertical" style={{ minWidth: 0 }}>
                  <Typography.Text strong>#{it.id}</Typography.Text>
                  {it.name && <Tag color="green">{it.name}</Tag>}
                  {it.slug && <Tag>{Array.isArray(it.slug)? new TextDecoder().decode(new Uint8Array(it.slug)) : String(it.slug)}</Tag>}
                  {it.kind!=null && <Tag color="geekblue">kind {String(it.kind)}</Tag>}
                  {it.parkId!=null && <Tag color="purple">park {String(it.parkId)}</Tag>}
                  </Space>
                </Space>
                <Typography.Text type="secondary">owner: {it.owner}</Typography.Text>
                {Array.isArray(it.names) && it.names.length > 0 && (
                  <Typography.Text type="secondary">
                    姓名：{it.names.join('、')}{it.names.length >= 2 ? ' 等' : ''}
                  </Typography.Text>
                )}
                <Space>
                  <Button size="small" type="primary" onClick={()=>{ try { localStorage.setItem('mp.grave.detailId', String(it.id)) } catch {}; window.location.hash = '#/grave/detail' }}>查看详情</Button>
                  <Button size="small" onClick={()=>{ setRenameId(it.id); setRenameVal(it.name || ''); setRenameOpen(true) }}>编辑名称</Button>
                </Space>
              </Space>
            </List.Item>
          )}
        />
        <Modal
          open={renameOpen}
          onCancel={()=> setRenameOpen(false)}
          onOk={async ()=>{
            try{
              if (renameId==null) return
              const val = (renameVal || '').trim()
              const u8 = new TextEncoder().encode(val)
              if (maxNameLen && u8.length > maxNameLen) { Modal.error({ title:'名称过长', content:`UTF-8 字节 ${u8.length}/${maxNameLen}` }); return }
              const hash = await signAndSendLocalFromKeystore('memoGrave','updateGrave',[renameId, u8, null, null])
              Modal.success({ title:'已提交', content: hash })
              setRenameOpen(false)
              // 自动刷新当前页
              load(page, pageSize, owner)
            }catch(e:any){ Modal.error({ title:'提交失败', content: String(e?.message||e) }) }
          }}
          title={`编辑名称（#${renameId ?? ''}）`}
        >
          <Input value={renameVal} onChange={e=> setRenameVal(e.target.value)} placeholder={`UTF-8 ≤ ${maxNameLen || '未知'} 字节`} />
        </Modal>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Pagination current={page} pageSize={pageSize} total={total} onChange={(p, ps)=>{ setPage(p); setPageSize(ps); load(p, ps, owner) }} showSizeChanger showTotal={t=>`共 ${t} 条`} />
        </div>
      </Card>
    </div>
  )
}

export default GraveListPage


