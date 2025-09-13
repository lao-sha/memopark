import React, { useEffect, useState } from 'react';
import { useReferendum } from './hooks/useReferenda';
import VotePanel from './components/VotePanel';
import PreimageViewer from './components/PreimageViewer';
import { submitVote, getEstimatedBlockTimeMs, formatDurationMs, getTokenInfo, formatPlanck } from './lib/governance';
import { getApi } from '../../lib/polkadot-safe';
import { useGovernanceStore, syncReferendumIdFromHash, listenHashChange } from './store';
import PasswordModal from './components/PasswordModal';

/**
 * 函数级详细中文注释：公投详情页面（移动端优先）
 * - 展示单个公投的状态时间线、轨道参数、预映像与投票面板（后续接入）
 * - 当前提供骨架与占位内容
 */
const ReferendumDetailPage: React.FC = () => {
  const rid = useGovernanceStore(s => s.currentReferendumId) || 101
  const setId = useGovernanceStore(s => s.setReferendumId)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pending, setPending] = useState<{ aye: boolean; conviction: number; amount: string } | null>(null)
  useEffect(() => {
    // 保证刷新后能恢复 id；若哈希不存在则回退列表
    syncReferendumIdFromHash(setId)
    const off = listenHashChange(setId)
    const hasId = /#gov\/(\d+)/.test(window.location.hash)
    if (!hasId && !rid) {
      window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-list' } }))
    }
    return off
  }, [])
  const { loading, error, data } = useReferendum(rid)
  const [timeline, setTimeline] = useState<{ ts: number; text: string }[]>([])

  /**
   * 函数级详细中文注释：订阅链上 deceased-data 治理执行事件并构建时间线（兼容旧名）
   * - 监听 system.events，过滤 deceased-data 的 ComplaintResolved/ComplaintPayout* 事件
   * - 转换为人类可读文本，插入到页面时间线（仅保留最近 20 条）
   */
  useEffect(() => {
    let unsub: any
    ;(async () => {
      try {
        const api = await getApi()
        const { decimals, symbol } = await getTokenInfo()
        unsub = await (api.query as any).system.events((events: any[]) => {
          const items: { ts: number; text: string }[] = []
          for (const rec of events) {
            const e = rec.event
            const section = (e.section || '').toLowerCase()
            const method = (e.method || '')
            if (!['deceaseddata','deceased_data','deceased-data','deceasedmedia','deceased_media','deceased-media'].some(s=>section===s)) continue
            try {
              if (method === 'ComplaintResolved') {
                const domain = e.data?.[0]?.toNumber ? e.data[0].toNumber() : Number(e.data?.[0])
                const id = e.data?.[1]?.toNumber ? e.data[1].toNumber() : Number(e.data?.[1])
                const uphold = String(e.data?.[2]) === 'true'
                const target = domain === 1 ? '相册' : '媒体'
                items.push({ ts: Date.now(), text: `裁决完成：${target} #${id} · ${uphold ? '维持投诉' : '驳回投诉'}（20%胜诉/5%仲裁/75%退款）` })
              } else if (method === 'ComplaintPayoutWinner') {
                const who = String(e.data?.[0])
                const amt = String(e.data?.[1] ?? '0')
                const human = formatPlanck(amt, decimals)
                items.push({ ts: Date.now(), text: `胜诉奖励：${who} 获得 ${human} ${symbol}` })
              } else if (method === 'ComplaintPayoutArbitration') {
                const who = String(e.data?.[0])
                const amt = String(e.data?.[1] ?? '0')
                const human = formatPlanck(amt, decimals)
                items.push({ ts: Date.now(), text: `仲裁费用：${who} 获得 ${human} ${symbol}` })
              } else if (method === 'ComplaintPayoutLoserRefund') {
                const who = String(e.data?.[0])
                const amt = String(e.data?.[1] ?? '0')
                const human = formatPlanck(amt, decimals)
                items.push({ ts: Date.now(), text: `失败退款：退还 ${who} 数额 ${human} ${symbol}` })
              }
            } catch {}
          }
          if (items.length > 0) {
            setTimeline(prev => {
              const merged = [...items, ...prev]
              return merged.slice(0, 20)
            })
          }
        })
      } catch {}
    })()
    return () => { if (unsub) { try { unsub() } catch {} } }
  }, [])

  async function handleSubmit(p: { aye: boolean; conviction: number; amount: string }) {
    if (!data) return
    // 危险轨道二次确认（示例：track 0 视为 Root 轨道）
    if (data.track === 0) {
      const ok = window.confirm('该提案属于危险轨道（Root）。请确认已校验预映像哈希且理解风险后再继续。是否继续提交投票？')
      if (!ok) return
    }
    setPending(p)
    setPwdOpen(true)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>公投详情</h2>
      {loading && <div style={{ color: '#999' }}>加载中...</div>}
      {error && <div style={{ color: '#ef4444' }}>加载失败：{error}</div>}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.track === 0 && (
            <div style={{ padding: 12, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>危险轨道（Root）</div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                此提案属于高风险轨道，通常需要高保证金、较长冷静期与生效延迟。请务必校验预映像哈希与调用内容后再操作。
              </div>
            </div>
          )}
          <div style={{ fontWeight: 600 }}>{data.title}（#{data.id}）</div>
          <div style={{ fontSize: 12, color: '#666' }}>轨道：{data.track}，状态：{data.status}</div>
          {(typeof data.enactmentDelay === 'number') && (
            <EnactmentInfo blocks={data.enactmentDelay} />
          )}
          {(typeof data.support === 'number' || typeof data.against === 'number') && (
            <div style={{ fontSize: 12, color: '#666' }}>当前支持/反对：{data.support ?? '-'}% / {data.against ?? '-'}%</div>
          )}
          <PreimageViewer hash={data.preimageHash} />
          {timeline.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>最近治理执行（deceased-data）</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {timeline.map((it, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: '#444' }}>
                    <span style={{ color: '#888' }}>{new Date(it.ts).toLocaleString()} · </span>
                    {it.text}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 14, color: '#333' }}>{data.description}</div>
        </div>
      )}
      <div style={{ height: 12 }} />
      <VotePanel onSubmit={handleSubmit} />
      <PasswordModal
        open={pwdOpen}
        title="确认投票 - 输入钱包密码"
        message={data?.track === 0 ? '危险轨道（Root）：请再次确认预映像调用摘要是否符合预期，并确保理解押金、冷静期与延迟执行风险。' : undefined}
        onOk={async (password) => {
          if (!data || !pending) { setPwdOpen(false); return }
          const hash = await submitVote({ track: data.track, referendumIndex: data.id, aye: pending.aye, conviction: pending.conviction, amount: pending.amount, password })
          window.alert(`已提交投票：${hash}`)
          setPwdOpen(false)
          setPending(null)
        }}
        onCancel={() => { setPwdOpen(false); setPending(null) }}
      />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-list' } }))} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>返回列表</button>
      </div>
    </div>
  );
};

export default ReferendumDetailPage;



/**
 * 函数级详细中文注释：延迟执行信息展示
 * - 读取链出块时间并将块数换算为可读时长
 */
const EnactmentInfo: React.FC<{ blocks: number }> = ({ blocks }) => {
  const [text, setText] = React.useState<string>('')
  React.useEffect(() => {
    (async () => {
      const ms = await getEstimatedBlockTimeMs()
      setText(formatDurationMs(blocks * ms))
    })()
  }, [blocks])
  return (
    <div style={{ fontSize: 12, color: '#666' }}>预计延迟执行：{blocks} 区块（约 {text}）</div>
  )
}