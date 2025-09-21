import React from 'react'
import { Card, List, Space, Typography, Tag, Input, Button, Alert } from 'antd'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：逝者列表页面
 * - 直接读取 pallet-deceased：`NextDeceasedId` 与 `DeceasedOf(id)`
 * - 支持名称关键字过滤（基于链上 `name` 字节解码）
 * - 移动端列表样式，最大宽度 640px 居中
 */
const DeceasedListPage: React.FC = () => {
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [keyword, setKeyword] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true); setError('')
    try {
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      const dq: any = queryRoot.deceased || queryRoot.memoDeceased || queryRoot.memo_deceased || queryRoot.Decesased
      if (!dq?.nextDeceasedId || !dq?.deceasedOf) throw new Error('运行时未启用 deceased 模块')
      const next = await dq.nextDeceasedId().then((x:any)=> x?.toNumber? x.toNumber(): 0)
      const ids = Array.from({ length: next }).map((_,i)=>i)
      const arr = await Promise.all(ids.map(async (id) => {
        try {
          const opt = await dq.deceasedOf(id)
          if (!opt || !opt.isSome) return null
          const d = opt.unwrap()
          let name: string | undefined = undefined
          try { const u8 = d.name?.toU8a ? d.name.toU8a() : (d.name?.toJSON ? new Uint8Array(d.name.toJSON()) : undefined); if (u8) name = new TextDecoder().decode(u8) } catch {}
          const owner = d.owner?.toString?.() || String(d.owner)
          const graveId = (d.graveId?.toNumber?.() ?? d.graveId) as number | undefined
          let token: string | undefined = undefined
          try { const u8 = d.deceasedToken?.toU8a ? d.deceasedToken.toU8a() : (d.deceasedToken?.toJSON ? new Uint8Array(d.deceasedToken.toJSON()) : undefined); if (u8) token = new TextDecoder().decode(u8) } catch {}
          return { id, name, owner, graveId, token }
        } catch { return null }
      }))
      setItems(arr.filter(Boolean) as any[])
    } catch (e:any) {
      setError(e?.message || '加载失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(()=> { load() }, [load])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="逝者列表" extra={<Button size="small" onClick={load} loading={loading}>刷新</Button>}>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space style={{ marginBottom: 8 }}>
          <Input placeholder="按姓名关键字过滤" value={keyword} onChange={e=> setKeyword(e.target.value)} allowClear />
        </Space>
        <List
          loading={loading}
          dataSource={items.filter(it=> !keyword || (it.name||'').includes(keyword))}
          renderItem={(it:any)=> (
            <List.Item
              actions={[
                <Button key="pin" size="small" onClick={()=> { try { window.location.hash = `#/ipfs/pin?subjectId=${it.id}` } catch {} }}>去存储(Pin)</Button>
              ]}
              onClick={()=> { if (it.graveId!=null) { try { localStorage.setItem('mp.grave.detailId', String(it.graveId)) } catch {}; window.location.hash = `#/grave/detail?gid=${it.graveId}`; window.dispatchEvent(new HashChangeEvent('hashchange')) } }}
              style={{ cursor: it.graveId!=null ? 'pointer' : 'default' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Typography.Text strong>#{it.id}</Typography.Text>
                  {it.name && <Tag color="green">{it.name}</Tag>}
                  {it.graveId!=null && <Tag>grave {String(it.graveId)}</Tag>}
                </Space>
                <div style={{ fontSize: 12, color: '#666' }}>
                  <span>Owner：</span><Typography.Text code>{it.owner}</Typography.Text>
                </div>
                {it.token && <div><Typography.Text type="secondary">Token：</Typography.Text><Typography.Text code>{it.token}</Typography.Text></div>}
              </Space>
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

export default DeceasedListPage


