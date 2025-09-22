import React from 'react'
import { Card, List, Space, Button, InputNumber, message, Alert, Typography, Input } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'
import { buildCallPreimageHex, submitPreimage, submitProposal } from '../governance/lib/governance'

/**
 * 函数级详细中文注释：墓位背景音乐选择器组件。
 * - 加载链上 `memoGrave.audioOptions()`（AudioOptions）作为候选列表；
 * - 用户输入 Grave ID 后，可从候选中选择（setAudioFromOption），或直接输入 CID 设定（setAudio）。
 * - 仅墓主可直接设置；其他用户应通过治理面板发起治理设置。
 */
const GraveAudioPicker: React.FC = () => {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [options, setOptions] = React.useState<string[]>([])
  const [graveId, setGraveId] = React.useState<number | null>(null)
  const [customCid, setCustomCid] = React.useState('')
  const { current } = useWallet()
  const [owner, setOwner] = React.useState<string>('')
  const [isOwner, setIsOwner] = React.useState<boolean>(false)
  // 私有候选与播放列表
  const [privateOptions, setPrivateOptions] = React.useState<string[]>([])
  const [privateInput, setPrivateInput] = React.useState('')
  const [playlist, setPlaylist] = React.useState<string[]>([])

  const load = React.useCallback(async () => {
    setLoading(true); setError('')
    try {
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memo_grave || qroot.memoGrave || qroot.grave
      if (!q) { const fk = Object.keys(qroot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k)); if (fk) q = qroot[fk] }
      if (!q?.audioOptions) throw new Error('运行时未暴露 audioOptions')
      const v = await q.audioOptions()
      const arr: string[] = []
      try { const vec: any[] = (v.toJSON?.() as any[]) || []; for (const it of vec) { const u8 = new Uint8Array(it as any); const s = new TextDecoder().decode(u8); arr.push(s) } } catch { try { (v as any).forEach((u: any)=> { try { const s = new TextDecoder().decode(u.toU8a()); arr.push(s) } catch {} }) } catch {} }
      setOptions(arr)
    } catch (e:any) { setError(e?.message || '加载失败'); setOptions([]) } finally { setLoading(false) }
  }, [])

  React.useEffect(()=> { load() }, [load])

  // 加载墓主用于权限提示
  const loadOwner = React.useCallback(async (gid: number) => {
    try {
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memo_grave || qroot.memoGrave || qroot.grave
      if (!q) { const fk = Object.keys(qroot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k)); if (fk) q = qroot[fk] }
      if (!q?.graves) return
      const opt = await q.graves(gid)
      if (opt && opt.isSome) {
        const g = opt.unwrap()
        const o = g.owner?.toString?.() || String(g.owner)
        setOwner(o)
        setIsOwner(Boolean(current && o && String(current) === String(o)))
      } else { setOwner(''); setIsOwner(false) }
    } catch { setOwner(''); setIsOwner(false) }
  }, [current])

  React.useEffect(()=> { if (graveId!=null) loadOwner(Number(graveId)) }, [graveId, loadOwner])

  // 加载私有候选与播放列表
  const loadPrivateAndPlaylist = React.useCallback(async () => {
    try {
      if (graveId == null) return
      const api = await getApi()
      const qroot: any = (api.query as any)
      let q: any = qroot.memo_grave || qroot.memoGrave || qroot.grave
      if (!q) { const fk = Object.keys(qroot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k)); if (fk) q = qroot[fk] }
      // 私有候选
      if (q?.privateAudioOptionsOf) {
        const v = await q.privateAudioOptionsOf(graveId)
        const arr: string[] = []
        try { const vec: any[] = (v.toJSON?.() as any[]) || []; for (const it of vec) { const u8 = new Uint8Array(it as any); arr.push(new TextDecoder().decode(u8)) } } catch {}
        setPrivateOptions(arr)
      }
      // 播放列表
      if (q?.audioPlaylistOf) {
        const v2 = await q.audioPlaylistOf(graveId)
        const arr2: string[] = []
        try { const vec: any[] = (v2.toJSON?.() as any[]) || []; for (const it of vec) { const u8 = new Uint8Array(it as any); arr2.push(new TextDecoder().decode(u8)) } } catch {}
        setPlaylist(arr2)
      }
    } catch {}
  }, [graveId])

  React.useEffect(()=> { loadPrivateAndPlaylist() }, [loadPrivateAndPlaylist])

  const setFromOption = async (idx: number) => {
    try {
      if (graveId == null || !Number.isFinite(graveId) || graveId < 0) return message.warning('请输入有效的 Grave ID')
      if (!isOwner) {
        // 非墓主：引导治理提案
        const api = await getApi()
        const txRoot: any = (api.tx as any)
        const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
        let section = 'memoGrave'
        for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.setAudioFromOption === 'function') { section = s; break } }
        const pre = await buildCallPreimageHex(section, 'setAudioFromOption', [Number(graveId), idx])
        const prepared = await submitPreimage(pre.hex, undefined)
        const txh = await submitProposal(0, prepared, undefined, { origin: 'Content', enactmentAfter: 0 })
        message.success('已提交治理提案：'+txh)
        return
      }
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
      let section = 'memoGrave'
      for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.setAudioFromOption === 'function') { section = s; break } }
      const hash = await signAndSendLocalFromKeystore(section, 'setAudioFromOption', [Number(graveId), idx])
      message.success('已提交：'+hash)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const setDirect = async () => {
    try {
      if (graveId == null || !Number.isFinite(graveId) || graveId < 0) return message.warning('请输入有效的 Grave ID')
      const cid = customCid.trim()
      if (!cid) return message.warning('请输入 CID')
      if (!isOwner) {
        const api = await getApi()
        const txRoot: any = (api.tx as any)
        const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
        let section = 'memoGrave'
        for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.setAudioViaGovernance === 'function') { section = s; break } }
        const bytes = new TextEncoder().encode(cid)
        const pre = await buildCallPreimageHex(section, 'setAudioViaGovernance', [Number(graveId), bytes])
        const prepared = await submitPreimage(pre.hex, undefined)
        const txh = await submitProposal(0, prepared, undefined, { origin: 'Content', enactmentAfter: 0 })
        message.success('已提交治理提案：'+txh)
        setCustomCid('')
        return
      }
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
      let section = 'memoGrave'
      for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.setAudio === 'function') { section = s; break } }
      // 将字符串转为 Bytes（链上类型为 BoundedVec<u8>）
      const bytes = new TextEncoder().encode(cid)
      const hash = await signAndSendLocalFromKeystore(section, 'setAudio', [Number(graveId), bytes])
      message.success('已提交：'+hash)
      setCustomCid('')
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  const gw = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="背景音乐选择（公共目录）" extra={<Space>
        <Button size="small" onClick={load} loading={loading}>刷新公共目录</Button>
        <Button size="small" onClick={loadPrivateAndPlaylist}>刷新私有/播放列表</Button>
      </Space>}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {error && <Alert type="error" showIcon message={error} />}
          {graveId!=null && (
            <Alert
              type={isOwner? 'success':'info'}
              showIcon
              message={isOwner? '您是墓主，可直接设置背景音乐。' : '您不是墓主：将发起治理提案，由内容委员会执行设置。'}
              description={owner? (<Typography.Text type="secondary">墓主：<Typography.Text code>{owner}</Typography.Text></Typography.Text>) : undefined}
            />
          )}
          <Space>
            <Typography.Text>Grave ID：</Typography.Text>
            <InputNumber min={0} value={graveId as any} onChange={(v)=> setGraveId((v as any) ?? null)} />
          </Space>
          <Space>
            <Typography.Text>自定义 CID：</Typography.Text>
            <Input value={customCid} onChange={(e)=> setCustomCid(e.target.value)} placeholder="ipfs CID" style={{ width: 240 }} />
            <Button type="primary" onClick={setDirect}>设为背景音乐</Button>
          </Space>
          <List
            grid={{ gutter: 8, column: 2 }}
            dataSource={options}
            locale={{ emptyText: '暂无公共音频，请通过治理添加' }}
            renderItem={(cid, idx)=> (
              <List.Item>
                <Card size="small" actions={[<Button key="use" type="link" onClick={()=> setFromOption(idx)}>使用此音频</Button>]}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <audio src={`${gw}/ipfs/${cid}`} preload="none" controls style={{ width: '100%' }} />
                    <Typography.Text code style={{ fontSize: 12 }}>{cid.slice(0, 16)}…</Typography.Text>
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        </Space>
      </Card>
      {/* 私有候选管理 */}
      <Card title="私有候选（仅墓主可维护）" style={{ marginTop: 12 }}>
        <Space direction="vertical" style={{ width:'100%' }} size={8}>
          <Space style={{ width:'100%', justifyContent:'space-between' }}>
            <InputNumber min={0} value={graveId as any} onChange={(v)=> setGraveId((v as any) ?? null)} />
            <Input placeholder="新增 CID" value={privateInput} onChange={e=> setPrivateInput(e.target.value)} />
            <Button disabled={!isOwner} onClick={async ()=>{
              try {
                if (graveId==null) return message.warning('请输入墓位ID')
                if (!privateInput.trim()) return message.warning('请填写 CID')
                const api = await getApi(); const txRoot: any = (api.tx as any)
                const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
                let section = 'memoGrave'; for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.addPrivateAudioOption === 'function') { section = s; break } }
                const bytes = new TextEncoder().encode(privateInput.trim())
                const h = await signAndSendLocalFromKeystore(section, 'addPrivateAudioOption', [Number(graveId), bytes])
                message.success('已添加：'+h); setPrivateInput(''); loadPrivateAndPlaylist()
              } catch(e:any) { message.error(e?.message || '提交失败') }
            }}>添加</Button>
          </Space>
          <List
            bordered
            dataSource={privateOptions}
            locale={{ emptyText: '暂无私有候选' }}
            renderItem={(cid, idx)=> (
              <List.Item actions={[
                <Button key="use" type="link" onClick={()=> setFromOption(idx)} disabled={!isOwner}>设为背景音乐</Button>,
                <Button key="rm" type="link" danger onClick={async()=>{
                  try {
                    if (graveId==null) return
                    const api = await getApi(); const txRoot: any = (api.tx as any)
                    const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
                    let section = 'memoGrave'; for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.removePrivateAudioOption === 'function') { section = s; break } }
                    const bytes = new TextEncoder().encode(cid)
                    const h = await signAndSendLocalFromKeystore(section, 'removePrivateAudioOption', [Number(graveId), bytes])
                    message.success('已移除：'+h); loadPrivateAndPlaylist()
                  } catch(e:any) { message.error(e?.message || '提交失败') }
                }} disabled={!isOwner}>删除</Button>
              ]}>
                <Space direction="vertical" style={{ width:'100%' }}>
                  <audio src={`${gw}/ipfs/${cid}`} preload="none" controls style={{ width:'100%' }} />
                  <Typography.Text code style={{ fontSize: 12 }}>{cid}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        </Space>
      </Card>
      {/* 播放列表管理（用上/下移动按钮代替拖拽，避免引入 DnD 依赖） */}
      <Card title="播放列表（仅墓主，保存后覆盖写入）" style={{ marginTop: 12 }}>
        <Space direction="vertical" style={{ width:'100%' }} size={8}>
          <List
            bordered
            dataSource={playlist}
            locale={{ emptyText: '暂无播放列表' }}
            renderItem={(cid, idx)=> (
              <List.Item actions={[
                <Button key="up" size="small" onClick={()=>{
                  setPlaylist(prev => { const arr = prev.slice(); if (idx>0) { const t = arr[idx-1]; arr[idx-1]=arr[idx]; arr[idx]=t } return arr })
                }}>上移</Button>,
                <Button key="down" size="small" onClick={()=>{
                  setPlaylist(prev => { const arr = prev.slice(); if (idx<arr.length-1) { const t = arr[idx+1]; arr[idx+1]=arr[idx]; arr[idx]=t } return arr })
                }}>下移</Button>,
                <Button key="rm" size="small" danger onClick={()=>{
                  setPlaylist(prev => prev.filter((_,i)=> i!==idx))
                }}>移除</Button>
              ]}>
                <Space direction="vertical" style={{ width:'100%' }}>
                  <audio src={`${gw}/ipfs/${cid}`} preload="none" controls style={{ width:'100%' }} />
                  <Typography.Text code style={{ fontSize: 12 }}>{cid}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
          <Space>
            <Input placeholder="追加 CID" value={privateInput} onChange={e=> setPrivateInput(e.target.value)} />
            <Button onClick={()=> { if (privateInput.trim()) { setPlaylist(prev => prev.concat([privateInput.trim()])); setPrivateInput('') } }}>追加</Button>
            <Button type="primary" disabled={!isOwner} onClick={async ()=>{
              try {
                if (graveId==null) return message.warning('请输入墓位ID')
                const api = await getApi(); const txRoot: any = (api.tx as any)
                const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
                let section = 'memoGrave'; for (const s of candidates) { const m = txRoot[s]; if (m && typeof m.setAudioPlaylist === 'function') { section = s; break } }
                const items = playlist.map(s => Array.from(new TextEncoder().encode(s)))
                const h = await signAndSendLocalFromKeystore(section, 'setAudioPlaylist', [Number(graveId), items])
                message.success('已保存播放列表：'+h)
              } catch(e:any) { message.error(e?.message || '提交失败') }
            }}>保存播放列表</Button>
          </Space>
        </Space>
      </Card>
    </div>
  )
}

export default GraveAudioPicker


