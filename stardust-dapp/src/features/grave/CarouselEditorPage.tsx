import React from 'react'
import { Card, Space, Button, Typography, Alert, Input, InputNumber, List, Tag, Select, DatePicker, message } from 'antd'
import dayjs from 'dayjs'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：首页轮播“治理编辑器”页面
 * - 仅编辑内存里的列表，点击“提交治理提案/直发（Root环境）”时统一覆盖写入 setCarousel
 * - 字段：img_cid、title、link?、target?(domain,id)、start_block?、end_block?
 * - 排序：上移/下移；删除；预览
 */
const CarouselEditorPage: React.FC = () => {
  type Item = { img: string; title: string; link?: string; domain?: number|null; targetId?: number|null; start?: number|null; end?: number|null }
  const [items, setItems] = React.useState<Item[]>([])
  const [img, setImg] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [link, setLink] = React.useState('')
  const [domain, setDomain] = React.useState<number | null>(1)
  const [targetId, setTargetId] = React.useState<number | null>(null)
  const [start, setStart] = React.useState<number | null>(null)
  const [end, setEnd] = React.useState<number | null>(null)
  const [error, setError] = React.useState('')
  const gw = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()

  const MAX_TITLE = 64
  const MAX_ITEMS = 20

  const isCid = (s: string) => !!s && /^[a-z0-9]{46,}|^bafy/i.test(s.replace(/^ipfs:\/\//i,''))
  const isHttp = (s: string) => /^https?:\/\//i.test(s)

  const validateItem = (it: Item): string | null => {
    if (!isCid(String(it.img||''))) return '图片 CID 非法（需为 IPFS CID）'
    if (!it.title || it.title.length > MAX_TITLE) return '标题必填且不超过 64 字'
    const hasTarget = it.domain!=null && it.targetId!=null
    const hasLink = !!it.link
    if (hasTarget && hasLink) return '目标与外链二选一，不可同时填写'
    if (!hasTarget && !hasLink) return '需填写目标(domain,id) 或 外部链接(link)'
    if (hasLink && !isHttp(String(it.link))) return '外链需以 http/https 开头'
    if (it.start!=null && it.end!=null && Number(it.start) > Number(it.end)) return '开始块需小于等于结束块'
    return null
  }

  const load = React.useCallback(async ()=>{
    setError('')
    try {
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memo_grave || qroot.memoGrave || qroot.grave
      if (!q) { const fk = Object.keys(qroot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k)); if (fk) q = qroot[fk] }
      if (!q?.carousel) throw new Error('运行时未暴露 carousel')
      const v = await q.carousel()
      const out: Item[] = []
      const vec: any[] = (v.toJSON?.() as any[]) || []
      for (const it of vec) {
        try {
          const img = new TextDecoder().decode(new Uint8Array(it.img_cid || it.imgCid))
          const title = new TextDecoder().decode(new Uint8Array(it.title))
          const link = it.link ? new TextDecoder().decode(new Uint8Array(it.link)) : ''
          const d = it.target ? Number(it.target[0] || it.target.d || 0) : null
          const tid = it.target ? Number(it.target[1] || it.target.id || 0) : null
          const start = it.start_block!=null ? Number(it.start_block) : (it.startBlock!=null ? Number(it.startBlock) : null)
          const end = it.end_block!=null ? Number(it.end_block) : (it.endBlock!=null ? Number(it.endBlock) : null)
          out.push({ img, title, link: link || undefined, domain: d, targetId: tid, start, end })
        } catch {}
      }
      setItems(out)
    } catch (e:any) { setError(e?.message || '加载失败'); setItems([]) }
  }, [])

  React.useEffect(()=> { load() }, [load])

  const add = () => {
    const candidate: Item = { img, title, link: link || undefined, domain, targetId, start, end }
    const msg = validateItem(candidate)
    if (msg) { message.warning(msg); return }
    if (items.length >= MAX_ITEMS) { message.warning('已达最大条目数 20'); return }
    setItems(prev => prev.concat([candidate]))
    setImg(''); setTitle(''); setLink(''); setDomain(1); setTargetId(null); setStart(null); setEnd(null)
  }

  const submit = async () => {
    // 提交前整体校验
    for (const it of items) { const m = validateItem(it); if (m) { message.error(m); return } }
    if (items.length === 0) { message.warning('列表为空'); return }
    try {
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
      let section = 'memoGrave'
      for (const s of candidates) { const m = txRoot[s]; if (m && (m.setCarousel || m.set_carousel)) { section = s; break } }
      const method = txRoot[section].setCarousel ? 'setCarousel' : 'set_carousel'
      // 序列化为 Rust 端 (Vec<u8>, Vec<u8>, Option<Vec<u8>>, Option<(u8,u64)>, Option<BlockNumber>, Option<BlockNumber>)
      const enc = items.map(it => {
        const encImg = Array.from(new TextEncoder().encode(String(it.img||'')))
        const encTitle = Array.from(new TextEncoder().encode(String(it.title||'')))
        const encLink = it.link ? Array.from(new TextEncoder().encode(String(it.link))) : null
        const tgt = (it.domain!=null && it.targetId!=null) ? [Number(it.domain), Number(it.targetId)] : null
        const start = it.start==null? null : Number(it.start)
        const end = it.end==null? null : Number(it.end)
        return [encImg, encTitle, encLink, tgt, start, end]
      })
      const h = await signAndSendLocalFromKeystore(section, method, [enc])
      message.success('已提交轮播更新：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const now = dayjs()
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12 }}>
      <Card title="首页轮播编辑器" extra={<Space>
        <Button size="small" onClick={load}>刷新</Button>
        <Button size="small" type="primary" onClick={submit}>提交治理提案/直发</Button>
      </Space>}>
        <Space direction="vertical" style={{ width:'100%' }} size={8}>
          {error && <Alert type="error" showIcon message={error} />}
          <Typography.Paragraph type="secondary">说明：为降低链上复杂度，本页面采用覆盖式提交 setCarousel。时间窗为可选字段，前端会根据当前区块过滤展示。</Typography.Paragraph>
          <Space direction="vertical" style={{ width:'100%' }}>
            <Typography.Text>新增轮播项</Typography.Text>
            <Input placeholder="图片 CID（ipfs）" value={img} onChange={e=> setImg(e.target.value)} />
            <Input placeholder="标题" value={title} onChange={e=> setTitle(e.target.value)} />
            <Input placeholder="外部链接（可选）" value={link} onChange={e=> setLink(e.target.value)} />
            <Space>
              <Select style={{ width: 120 }} placeholder="域" value={domain as any} onChange={(v)=> setDomain(v)} options={[
                { value: 1, label: 'grave' },
                { value: 2, label: 'deceased' },
                { value: 3, label: 'offerings' },
                { value: null as any, label: '无' },
              ]} />
              <InputNumber placeholder="对象ID（可选）" value={targetId as any} onChange={(v)=> setTargetId((v as any) ?? null)} />
            </Space>
            <Space>
              <DatePicker showTime placeholder="开始块（可选）" value={start? dayjs.unix(start): null} onChange={(d)=> setStart(d? d.unix(): null)} />
              <DatePicker showTime placeholder="结束块（可选）" value={end? dayjs.unix(end): null} onChange={(d)=> setEnd(d? d.unix(): null)} />
            </Space>
            <Button type="dashed" onClick={add}>添加到列表</Button>
          </Space>
          <List
            bordered
            dataSource={items}
            locale={{ emptyText: '列表为空，请先添加条目' }}
            renderItem={(it, idx)=> (
              <List.Item actions={[
                <Button key="up" size="small" onClick={()=> setItems(prev => { const a=prev.slice(); if (idx>0) { const t=a[idx-1]; a[idx-1]=a[idx]; a[idx]=t } return a })}>上移</Button>,
                <Button key="down" size="small" onClick={()=> setItems(prev => { const a=prev.slice(); if (idx<a.length-1) { const t=a[idx+1]; a[idx+1]=a[idx]; a[idx]=t } return a })}>下移</Button>,
                <Button key="rm" size="small" danger onClick={()=> setItems(prev => prev.filter((_,i)=> i!==idx))}>删除</Button>
              ]}>
                <Space align="start">
                  <div style={{ width: 180, height: 96, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee', background:'#fafafa' }}>
                    <img src={`${gw}/ipfs/${String(it.img).replace(/^ipfs:\/\//i,'')}`} alt={it.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  <Space direction="vertical" size={4}>
                    <Typography.Text strong>{it.title}</Typography.Text>
                    <div style={{ fontSize: 12, color:'#666' }}>
                      {it.domain!=null && it.targetId!=null ? <Tag>target {it.domain}:{it.targetId}</Tag> : <Tag>link</Tag>}
                      {it.start!=null && <Tag color="blue">start≥{it.start}</Tag>}
                      {it.end!=null && <Tag color="orange">end≤{it.end}</Tag>}
                    </div>
                    {it.link && <Typography.Text code style={{ fontSize: 12 }}>{it.link}</Typography.Text>}
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        </Space>
      </Card>
    </div>
  )
}

export default CarouselEditorPage


