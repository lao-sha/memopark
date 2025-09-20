import React from 'react'
import { Card, List, Image, Space, Button, InputNumber, message, Alert, Typography } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：封面库页面
 * - 展示链上 `memoGrave.coverOptions()` 返回的公共封面 CID 列表
 * - 允许用户输入 Grave ID，并一键将所选目录项设置为该墓地封面（调用 setCoverFromOption）
 * - 只读环境下可作为公共封面素材浏览
 */
const CoverOptionsPage: React.FC = () => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [covers, setCovers] = React.useState<string[]>([])
  const [graveId, setGraveId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true); setError('')
    try {
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memo_grave || qroot.memoGrave || qroot.grave
      if (!q) {
        const fk = Object.keys(qroot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k))
        if (fk) q = qroot[fk]
      }
      if (!q?.coverOptions) throw new Error('运行时未暴露 coverOptions')
      const v = await q.coverOptions()
      // 解码为字符串数组
      const arr: string[] = []
      try {
        const vec: any[] = (v.toJSON?.() as any[]) || []
        for (const it of vec) {
          const u8 = new Uint8Array(it as any)
          const s = new TextDecoder().decode(u8).replace(/^ipfs:\/\//i,'').replace(/^\/+ipfs\//i,'')
          arr.push(s)
        }
      } catch {
        // 兜底：尝试迭代器
        try { (v as any).forEach((u: any)=> { try { const s = new TextDecoder().decode(u.toU8a()); arr.push(s) } catch {} }) } catch {}
      }
      setCovers(arr)
    } catch (e:any) {
      setError(e?.message || '加载失败')
      setCovers([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(()=> { load() }, [load])

  const setFromOption = async (idx: number) => {
    try {
      if (graveId == null || !Number.isFinite(graveId) || graveId < 0) {
        return message.warning('请输入有效的 Grave ID')
      }
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
      let section = 'memoGrave'
      for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.setCoverFromOption === 'function') { section = s; break } }
      const hash = await signAndSendLocalFromKeystore(section, 'setCoverFromOption', [Number(graveId), idx])
      message.success('已提交：'+hash)
    } catch (e:any) {
      message.error(e?.message || '提交失败')
    }
  }

  const gw = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="公共封面库" extra={<Button size="small" onClick={load} loading={loading}>刷新</Button>}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Alert type="info" showIcon message="本目录的新增/维护需内容委员会审批（ContentCommittee）。" />
          {error && <Alert type="error" showIcon message={error} />}
          <Space>
            <Typography.Text>Grave ID：</Typography.Text>
            <InputNumber min={0} value={graveId as any} onChange={(v)=> setGraveId((v as any) ?? null)} />
          </Space>
          <List
            grid={{ gutter: 8, column: 3 }}
            dataSource={covers}
            locale={{ emptyText: '暂无公共封面，请通过治理添加' }}
            renderItem={(cid, idx)=> (
              <List.Item>
                <Card
                  size="small"
                  cover={<Image src={`${gw}/ipfs/${cid}`} alt={`cover-${idx}`} width={200} height={120} style={{ objectFit: 'cover' }} />}
                  actions={[<Button key="use" type="link" onClick={()=> setFromOption(idx)}>设为封面</Button>]}
                >
                  <Typography.Text code style={{ fontSize: 12 }}>{cid.slice(0, 10)}…</Typography.Text>
                </Card>
              </List.Item>
            )}
          />
        </Space>
      </Card>
    </div>
  )
}

export default CoverOptionsPage


