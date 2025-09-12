import React from 'react'
import type { ReferendumBrief } from '../hooks/useReferenda'
import { useGovernanceStore } from '../store'
import { formatDurationMs } from '../lib/governance'

/**
 * 函数级详细中文注释：公投卡片组件（移动端优先）
 * - 展示公投标题、轨道、状态与倒计时
 * - 点击卡片可通过 mp.nav 事件跳转到详情页（使用占位路由 key）
 */
interface Props { item: ReferendumBrief }

const statusColor: Record<ReferendumBrief['status'], string> = {
  Deciding: '#1677ff',
  Approved: '#16a34a',
  Rejected: '#ef4444',
  Cancelled: '#6b7280',
  TimedOut: '#6b7280'
}

const ReferendumCard: React.FC<Props> = ({ item }) => {
  const remainMs = item.endAt ? Math.max(0, item.endAt - Date.now()) : 0
  const remainText = item.endAt ? (remainMs === 0 ? '已结束' : `约 ${formatDurationMs(remainMs)}`) : '—'
  const setId = useGovernanceStore(s => s.setReferendumId)
  return (
    <div
      onClick={() => {
        setId(item.id)
        // 将 ID 写入地址哈希，支持刷新后从哈希恢复
        try { window.location.hash = `#gov/${item.id}` } catch {}
        window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-detail' } }))
      }}
      style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600 }}>{item.title}</div>
        <span style={{ fontSize: 12, color: '#666' }}>#{item.id}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#666' }}>轨道: {item.track}</span>
        {item.track === 0 && <span style={{ fontSize: 11, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '0 6px' }}>Root</span>}
        <span style={{ fontSize: 12, color: statusColor[item.status] }}>{item.status}</span>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>剩余：{remainText}</span>
      </div>
    </div>
  )
}

export default ReferendumCard


