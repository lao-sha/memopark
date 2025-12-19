import React from 'react'
import { Card, List, Typography, Space, Alert, Button, Input } from 'antd'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：一级类目列表页面（移动端优先）
 * - 仅展示所有一级类目（level==1）
 * - 链上拉取兼容多种 section 命名与 entries 不可用场景
 */
const CategoryListPage: React.FC = () => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [primaries, setPrimaries] = React.useState<Array<{ id:number; name:string }>>([])
  const [keyword, setKeyword] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true); setError('')
    try {
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memoSacrifice || qroot.memo_sacrifice || qroot.sacrifice
      if (!q?.categoryOf?.entries) {
        const fk = Object.keys(qroot).find(k => /memo[_-]?sacrifice|^sacrifice$/i.test(k))
        if (fk) q = qroot[fk]
      }
      let list: Array<{ id:number; name:string; parent?:number; level:number }> = []
      const hexToBytes = (hex: string): Uint8Array => {
        const h = hex.startsWith('0x') ? hex.slice(2) : hex
        if (h.length % 2 !== 0) return new Uint8Array()
        const out = new Uint8Array(h.length / 2)
        for (let i=0;i<out.length;i++) out[i] = parseInt(h.slice(i*2, i*2+2), 16)
        return out
      }
      try {
        const entries = await q?.categoryOf?.entries?.()
        for (const [key, val] of (entries || [])) {
          const id = Number(key.args[0])
          let name='', parent: number|undefined=undefined, level=1
          try {
            const opt = val as any
            const inner = opt && typeof opt.unwrap === 'function' ? opt.unwrap() : opt
            const v = inner?.toJSON?.() || inner
            if (Array.isArray(v)) {
              const raw = v[1]
              if (Array.isArray(raw)) name = new TextDecoder().decode(new Uint8Array(raw))
              else if (typeof raw==='string') name = new TextDecoder().decode(hexToBytes(raw))
              parent = v[2]!=null?Number(v[2]):undefined
              level = Number(v[3])
            }
          } catch {}
          list.push({ id, name, parent, level })
        }
      } catch {}
      if (list.length === 0 && q?.nextCategoryId && q?.categoryOf) {
        const next = await q.nextCategoryId().then((x:any)=> x?.toNumber? x.toNumber(): Number(x))
        for (let i=0;i<next;i++) {
          const opt = await q.categoryOf(i)
          if (!opt || !opt.isSome) continue
          let name='', parent: number|undefined=undefined, level=1
          try { const v = (opt.unwrap() as any).toJSON?.() || (opt.unwrap() as any); if (Array.isArray(v)) {
            const raw = v[1]
            if (Array.isArray(raw)) name = new TextDecoder().decode(new Uint8Array(raw))
            else if (typeof raw==='string') name = new TextDecoder().decode(hexToBytes(raw))
            parent = v[2]!=null?Number(v[2]):undefined
            level = Number(v[3])
          } } catch {}
          list.push({ id:i, name, parent, level })
        }
      }
      const p = list.filter(x=> x.level===1).map(x=> ({ id:x.id, name:x.name }))
      setPrimaries(p)
    } catch (e:any) { setError(e?.message||'加载失败') } finally { setLoading(false) }
  }, [])

  React.useEffect(()=> { load() }, [load])

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Card title="一级类目列表" extra={<Button size="small" onClick={load} loading={loading}>刷新</Button>}>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <div style={{ marginBottom: 8 }}>
          <Input placeholder="按名称过滤" value={keyword} onChange={e=> setKeyword(e.target.value)} allowClear />
        </div>
        <List
          dataSource={primaries.filter(p=> !keyword || (p.name||'').includes(keyword))}
          renderItem={(p)=> (
            <List.Item>
              <Space direction="vertical" style={{ width:'100%' }}>
                <Typography.Text strong>#{p.id} {p.name}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

export default CategoryListPage


