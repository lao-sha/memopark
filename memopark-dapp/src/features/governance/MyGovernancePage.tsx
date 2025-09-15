import React, { useMemo, useState } from 'react';
import { useWallet } from '../../providers/WalletProvider';
import { useMyVoting, useMyProposals } from './hooks/useMyVoting';
import { unlockVotes } from './lib/governance';
import { appendTx } from '../../lib/txHistory';

/**
 * 函数级详细中文注释：我的治理页面（移动端优先）
 * - 展示我发起的提案、我投过的票、可解锁项
 * - 当前为最小占位，后续接入 hooks 与链上数据
 */
const MyGovernancePage: React.FC = () => {
  const { current } = useWallet()
  const { loading, error, votes, locks } = useMyVoting(current || undefined)
  const { loading: pLoading, error: pError, items: myProposals } = useMyProposals(current || undefined)
  const [keyword, setKeyword] = useState('')
  const [onlyAye, setOnlyAye] = useState<boolean | undefined>(undefined)
  const [minConv, setMinConv] = useState<number>(0)
  const [onlyUnlockable, setOnlyUnlockable] = useState<boolean>(false)
  const [lockSort, setLockSort] = useState<'asc'|'desc'>('asc')
  // 批量解锁相关状态：被选中的索引与执行中标志
  const [selectedIdx, setSelectedIdx] = useState<Record<number, boolean>>({})
  const [batching, setBatching] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ total: number; current: number } | null>(null)

  const fv = useMemo(()=>{
    return votes.filter(v => {
      if (keyword && !(`#${v.referendumId}`.includes(keyword))) return false
      if (onlyAye !== undefined && (v.aye !== onlyAye)) return false
      if (minConv > 0 && v.conviction < minConv) return false
      return true
    })
  }, [votes, keyword, onlyAye, minConv])

  function exportCSV() {
    const headers = ['referendumId','track','aye','conviction','amount']
    const lines = [headers.join(',')].concat(fv.map(v=>[v.referendumId,v.track,v.aye,v.conviction,v.amount].join(',')))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='my-votes.csv'; a.click(); URL.revokeObjectURL(url)
  }

  /**
   * 函数级详细中文注释：锁仓筛选与排序
   * - onlyUnlockable：仅显示已到期可解锁项
   * - lockSort：按 until 升/降序
   */
  const fl = useMemo(() => {
    const now = Date.now()
    const arr = locks.filter(l => !onlyUnlockable || l.until <= now)
    arr.sort((a,b) => lockSort === 'asc' ? a.until - b.until : b.until - a.until)
    return arr
  }, [locks, onlyUnlockable, lockSort])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '4px 0' }}>
        <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
      </div>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>我的治理</h2>
      {!current && <div style={{ color: '#999' }}>请先选择或创建钱包地址。</div>}
      {loading && <div style={{ color: '#999' }}>加载中...</div>}
      {error && <div style={{ color: '#ef4444' }}>加载失败：{error}</div>}
      {votes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>我投过的票</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <input value={keyword} onChange={(e)=>setKeyword(e.target.value)} placeholder="按 #公投ID 关键词筛选" style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={String(onlyAye)} onChange={(e)=>setOnlyAye(e.target.value==='undefined'? undefined : e.target.value==='true')} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <option value="undefined">全部立场</option>
                <option value="true">仅 Aye</option>
                <option value="false">仅 Nay</option>
              </select>
              <input type="number" value={minConv} onChange={(e)=>setMinConv(parseInt(e.target.value||'0'))} placeholder="最小锁仓倍数" style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', width: 140 }} />
              <button onClick={exportCSV} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>导出CSV</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fv.map(v => (
              <div key={`${v.referendumId}-${v.track}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                <div>公投：#{v.referendumId}（轨道 {v.track}）</div>
                <div>立场：{v.aye ? 'Aye' : 'Nay'}，锁仓：{v.conviction}x，金额：{v.amount}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 我的提案 */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>我发起的提案</div>
        {pLoading && <div style={{ color: '#999' }}>加载中...</div>}
        {pError && <div style={{ color: '#ef4444' }}>加载失败：{pError}</div>}
        {myProposals.length === 0 ? (
          <div style={{ color: '#999' }}>暂无记录。可前往“发起提案”创建新提案。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myProposals.map(p => (
              <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.title}（#{p.id}）</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    轨道：{p.track} · 状态：{p.status}
                    {p.submittedAt ? ` · 提交时间：${new Date(p.submittedAt).toLocaleString()}` : ''}
                    {typeof p.referendumId === 'number' ? ` · 公投ID：#${p.referendumId}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    if (typeof p.referendumId === 'number') {
                      // 携带公投ID跳转治理详情
                      window.location.hash = `#gov/${p.referendumId}`
                      window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-detail' } }))
                    } else {
                      window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-detail' } }))
                    }
                  }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>查看</button>
                  <button onClick={() => window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-new' } }))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>再发一个</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {locks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>我的锁仓</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={onlyUnlockable} onChange={(e)=>setOnlyUnlockable(e.target.checked)} />
              只看可解锁
            </label>
            <select value={lockSort} onChange={(e)=>setLockSort(e.target.value as any)} style={{ padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <option value="asc">按解锁时间↑</option>
              <option value="desc">按解锁时间↓</option>
            </select>
            <button onClick={() => {
              const headers = ['until','amount']
              const lines = [headers.join(',')].concat(fl.map(l=>[new Date(l.until).toISOString(), l.amount].join(',')))
              const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href=url; a.download='my-locks.csv'; a.click(); URL.revokeObjectURL(url)
            }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>导出CSV</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fl.map((l, idx) => (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={!!selectedIdx[idx]} onChange={(e)=> setSelectedIdx(s=>({ ...s, [idx]: e.target.checked }))} />
                <div>
                  <div>解锁时间：{new Date(l.until).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>金额：{l.amount}</div>
                </div>
                <div>
                  <button onClick={async () => {
                    if (!current) return
                    const hash = await unlockVotes(current)
                    try { appendTx({ hash, section: 'convictionVoting', method: 'unlock', args: [current], timestamp: Date.now(), from: current }) } catch {}
                    window.alert(`已提交解锁请求：${hash}`)
                  }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>解锁</button>
                </div>
              </div>
            ))}
          </div>
          {fl.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button disabled={batching} onClick={async ()=>{
                if (!current) return
                const targets = fl.filter((_,i)=>selectedIdx[i])
                if (targets.length === 0) { window.alert('请先选择需要解锁的条目'); return }
                setBatching(true)
                setBatchProgress({ total: targets.length, current: 0 })
                const RETRY = 2
                const SLEEP = 500
                let ok = 0, fail = 0
                for (let i=0; i<targets.length; i++) {
                  let tried = 0, success = false
                  while (tried <= RETRY && !success) {
                    try {
                      const hash = await unlockVotes(current)
                      try { appendTx({ hash, section: 'convictionVoting', method: 'unlock', args: [current], timestamp: Date.now(), from: current }) } catch {}
                      success = true
                      ok++
                    } catch {
                      tried++
                      if (tried > RETRY) { fail++ }
                      else { await new Promise(r => setTimeout(r, SLEEP)) }
                    }
                  }
                  setBatchProgress({ total: targets.length, current: i + 1 })
                  await new Promise(r => setTimeout(r, SLEEP))
                }
                setBatching(false)
                setBatchProgress(null)
                window.alert(`批量完成：成功 ${ok} 条，失败 ${fail} 条`)
              }} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                {batching ? '批量解锁中…' : '批量解锁（逐条发送）'}
              </button>
              {batching && batchProgress && (
                <span style={{ marginLeft: 12, fontSize: 12, color: '#666' }}>进度：{batchProgress.current}/{batchProgress.total}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyGovernancePage;


