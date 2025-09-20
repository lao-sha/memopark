import React, { useEffect, useMemo, useState } from 'react';
import { useReferendaList } from './hooks/useReferenda';
import ReferendumCard from './components/ReferendumCard';
import { useTracks } from './hooks/useTracks';
import TrackSelector from './components/TrackSelector';

/**
 * 函数级详细中文注释：公投列表页面（Legacy 占位）
 * - 主流程已迁移至“内容委员会 + 申诉治理”，本页仅保留开发/历史调试用途
 */
/**
 * 函数级详细中文注释：公投列表页面（移动端优先，带筛选）
 * - 支持按轨道、状态与关键字筛选
 * - 轨道列表来自 useTracks；状态支持 Deciding/Approved/Rejected/Cancelled/TimedOut
 */
const ReferendaListPage: React.FC = () => {
  const { loading, error, items, reload } = useReferendaList()
  const { tracks } = useTracks()
  const [trackId, setTrackId] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<'ALL' | 'Deciding' | 'Approved' | 'Rejected' | 'Cancelled' | 'TimedOut'>('ALL')
  const [keyword, setKeyword] = useState('')

  /**
   * 函数级详细中文注释：从 URL 哈希恢复筛选状态
   * - 约定格式：#gov/list?status=Deciding&track=1&q=xxx
   */
  function restoreFromHash() {
    try {
      const h = window.location.hash
      const m = h.match(/#gov\/list\?(.+)/)
      if (!m) return
      const sp = new URLSearchParams(m[1])
      const s = sp.get('status') as any
      const t = sp.get('track')
      const q = sp.get('q') || ''
      if (s && ['ALL','Deciding','Approved','Rejected','Cancelled','TimedOut'].includes(s)) setStatus(s)
      if (t && /^\d+$/.test(t)) setTrackId(parseInt(t))
      setKeyword(q)
    } catch {}
  }

  /**
   * 函数级详细中文注释：将筛选状态写入 URL 哈希（便于刷新还原与分享）
   */
  function writeToHash() {
    try {
      const sp = new URLSearchParams()
      sp.set('status', status)
      if (trackId !== undefined) sp.set('track', String(trackId))
      if (keyword) sp.set('q', keyword)
      window.location.hash = `#gov/list?${sp.toString()}`
    } catch {}
  }

  useEffect(() => {
    restoreFromHash()
    const onHash = () => restoreFromHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => { writeToHash() }, [trackId, status, keyword])

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (trackId !== undefined && i.track !== trackId) return false
      if (status !== 'ALL' && i.status !== status) return false
      if (keyword && !i.title.toLowerCase().includes(keyword.toLowerCase())) return false
      return true
    })
  }, [items, trackId, status, keyword])
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>公投列表</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>按关键字筛选</div>
          <input value={keyword} onChange={(e)=>setKeyword(e.target.value)} placeholder="输入标题关键字" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        </div>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>按状态筛选</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {(['ALL','Deciding','Approved','Rejected','Cancelled','TimedOut'] as const).map(s => (
              <button key={s} onClick={()=>setStatus(s)} style={{ padding: '8px 12px', borderRadius: 999, border: status===s? '2px solid #1677ff':'1px solid #e5e7eb', background: status===s? '#e6f4ff':'#fff', whiteSpace: 'nowrap' }}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>按轨道筛选</div>
          <TrackSelector options={tracks.map(t=>({ id: t.id, name: t.name, summary: t.summary }))} value={trackId} onChange={setTrackId} />
          {trackId !== undefined && (
            <div style={{ marginTop: 8 }}>
              <button onClick={()=>setTrackId(undefined)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb' }}>清除轨道筛选</button>
            </div>
          )}
        </div>
      </div>
      {loading && <div style={{ color: '#999' }}>加载中...</div>}
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>加载失败：{error}</div>}
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>共 {filtered.length} 项{(filtered.length!==items.length) ? `（全部 ${items.length} 项）` : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(i => <ReferendumCard key={i.id} item={i} />)}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={reload} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>刷新</button>
        <button onClick={()=> window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-new' } }))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginLeft: 8 }}>发起提案</button>
      </div>
    </div>
  );
};

export default ReferendaListPage;


