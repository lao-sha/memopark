import React from 'react'
import { Card, Space, Button, Alert, Typography } from 'antd'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：墓位背景音乐播放器组件（移动端优先）。
 * - 读取链上 `memoGrave.audioCidOf(graveId)`（AudioCidOf）返回选中 CID；
 * - 使用 HTMLAudioElement 播放 `https://<gateway>/ipfs/<cid>`；
 * - 处理移动端自动播放限制：提供显式“播放/暂停”按钮；失败时降级为静音提示；
 * - 网关地址从环境变量 VITE_IPFS_GATEWAY 读取（默认 https://ipfs.io）。
 */
const GraveAudioPlayer: React.FC<{ graveId: number; sticky?: boolean }> = ({ graveId, sticky }) => {
  const [cid, setCid] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  // 播放列表（只读）与当前索引
  const [list, setList] = React.useState<string[]>([])
  const [idx, setIdx] = React.useState<number>(0)

  const gw = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()

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
      if (!q?.audioCidOf) throw new Error('运行时未暴露 audioCidOf')
      const v = await q.audioCidOf(graveId)
      let s = ''
      try {
        const u8 = new Uint8Array((v.toJSON?.() as any) || [])
        s = new TextDecoder().decode(u8)
      } catch {
        try { s = new TextDecoder().decode((v as any).toU8a()) } catch {}
      }
      s = s.replace(/^ipfs:\/\//i,'').replace(/^\/+ipfs\//i,'')
      setCid(s)
      // 读取播放列表（存在时使用播放列表优先）
      try {
        if (q?.audioPlaylistOf) {
          const pl = await q.audioPlaylistOf(graveId)
          const arr: string[] = []
          try { const vec: any[] = (pl.toJSON?.() as any[]) || []; for (const it of vec) { const u8 = new Uint8Array(it as any); arr.push(new TextDecoder().decode(u8)) } } catch {}
          if (arr.length) { setList(arr); setIdx(0); setCid(arr[0]) }
        }
      } catch {}
    } catch (e:any) {
      setError(e?.message || '加载失败')
      setCid('')
    } finally { setLoading(false) }
  }, [graveId])

  React.useEffect(()=> { load() }, [load])

  const src = cid ? `${gw}/ipfs/${cid}` : ''

  // 记忆音量：本地存储每个墓位的音量
  React.useEffect(() => {
    try {
      const key = `mp.grave.audio.vol.${graveId}`
      const el = audioRef.current
      if (!el) return
      const v = Number(localStorage.getItem(key) || '')
      if (!Number.isNaN(v) && v >= 0 && v <= 1) el.volume = v
      const onVol = () => {
        try { localStorage.setItem(key, String(el.volume)) } catch {}
      }
      el.addEventListener('volumechange', onVol)
      return () => el.removeEventListener('volumechange', onVol)
    } catch {}
  }, [graveId])

  const onToggle = async () => {
    try {
      const el = audioRef.current
      if (!el) return
      if (el.paused) { await el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
    } catch (e:any) {
      setError('无法自动播放，请手动点击播放按钮或检查音频资源。')
    }
  }

  const next = async () => {
    try {
      if (!list.length) return
      const i = (idx + 1) % list.length
      setIdx(i); setCid(list[i]); setPlaying(false)
      setTimeout(()=> onToggle(), 0)
    } catch {}
  }
  const prev = async () => {
    try {
      if (!list.length) return
      const i = (idx - 1 + list.length) % list.length
      setIdx(i); setCid(list[i]); setPlaying(false)
      setTimeout(()=> onToggle(), 0)
    } catch {}
  }

  if (sticky) {
    return (
      <>
        {/* 隐藏原生控件，仅保留音频标签供控制 */}
        <audio ref={audioRef} src={src} preload="none" style={{ display: 'none' }} />
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 999, padding: '8px 12px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Button size="small" onClick={prev} disabled={!cid || list.length<=1}>上一首</Button>
            <Button size="small" onClick={onToggle} disabled={!cid}>{playing ? '暂停' : '播放'}</Button>
            <Button size="small" onClick={next} disabled={!cid || list.length<=1}>下一首</Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{cid ? `CID: ${cid.slice(0, 12)}…` : '未设置音乐'}</Typography.Text>
          </Space>
          <Button size="small" onClick={load} loading={loading}>刷新</Button>
        </div>
        {error && <div style={{ position:'fixed', left:8, right:8, bottom:56 }}><Alert showIcon type="error" message={error} /></div>}
      </>
    )
  }

  return (
    <Card size="small" title="背景音乐" extra={<Button size="small" onClick={load} loading={loading}>刷新</Button>} style={{ maxWidth: 640, margin: '0 auto' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {error && <Alert showIcon type="error" message={error} />} 
        {!cid && <Alert showIcon type="info" message="尚未设置背景音乐" />}
        {cid && (
          <>
            <audio ref={audioRef} src={src} preload="none" controls style={{ width: '100%' }} />
            <Space align="center">
              <Button onClick={prev} disabled={!cid || list.length<=1}>上一首</Button>
              <Button onClick={onToggle}>{playing ? '暂停' : '播放'}</Button>
              <Button onClick={next} disabled={!cid || list.length<=1}>下一首</Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>CID: {cid.slice(0, 12)}…</Typography.Text>
            </Space>
          </>
        )}
      </Space>
    </Card>
  )
}

export default GraveAudioPlayer


