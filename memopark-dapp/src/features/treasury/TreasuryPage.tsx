import React, { useEffect, useMemo, useState } from 'react'
import { useBalance } from '../../hooks/useBalance'
import { loadTxHistory, type TxRecord } from '../../lib/txHistory'
import { decodePreimageHex, getTokenInfo, formatPlanck } from '../governance/lib/governance'

/**
 * 函数级详细中文注释：国库信息页面（移动端优先）
 * - 显示链上国库账户地址与实时余额（使用已有 useBalance 钩子）
 * - 地址依据当前运行时配置：TreasuryAccount=PlatformAccount=AccountId32(全0)，在 SS58(42) 下为固定值
 * - 页面简单自适应 ≤640px，提供复制地址与轻量刷新（通过轮询）
 */
const TREASURY_ADDRESS = '5C4hrfjw9DjXZTzV3MwzrrAr9P1MJhSrvWGWqi1eSuyUpnhM'

const TreasuryPage: React.FC = () => {
  // 轮询间隔（毫秒）：5s 刷新一次，便于观察余额变动
  const { loading, error, formatted, symbol, raw } = useBalance(TREASURY_ADDRESS, 5000)

  /**
   * 函数级详细中文注释：复制国库地址到剪贴板
   * - 捕获可能的浏览器权限异常，静默失败
   */
  function copy() {
    try { navigator.clipboard.writeText(TREASURY_ADDRESS) } catch {}
  }

  /**
   * 函数级详细中文注释：本地交易历史（前端存储）读取与过滤
   * - 仅展示“与国库地址相关”的交易：
   *   1) 交易参数中包含该地址（如 treasury.spend 的 beneficiary）
   *   2) 交易发起方等于该地址（一般不会出现，但保留逻辑）
   * - 通过监听 'mp.txUpdate' 事件实时刷新
   */
  const [txs, setTxs] = useState<TxRecord[]>([])
  useEffect(() => {
    const refresh = () => {
      const all = loadTxHistory()
      const related = all.filter(r => {
        if (r.from === TREASURY_ADDRESS) return true
        try {
          if (!r.args) return false
          const s = JSON.stringify(r.args)
          return s.includes(TREASURY_ADDRESS)
        } catch { return false }
      })
      setTxs(related)
    }
    refresh()
    const on = () => refresh()
    window.addEventListener('mp.txUpdate', on)
    return () => window.removeEventListener('mp.txUpdate', on)
  }, [])

  const txList = useMemo(() => txs.slice(0, 20), [txs])

  /**
   * 函数级详细中文注释：对本地交易记录做“与国库相关”的语义解析
   * - 若记录为 preimage.notePreimage 且 args[0] 为 hex，则尝试解码：
   *   - treasury.spend/proposeSpend → 解析 amount/beneficiary 并标为“流出”
   */
  const [decoded, setDecoded] = useState<Record<string, { text: string }>>({})
  useEffect(() => {
    (async () => {
      const map: Record<string, { text: string }> = {}
      const { decimals, symbol } = await getTokenInfo().catch(()=>({ decimals: 12, symbol: 'MEMO' }))
      for (const r of txList) {
        try {
          if (r.section === 'preimage' && (r.method || '').toLowerCase().includes('notepreimage')) {
            const hex = Array.isArray(r.args) ? r.args[0] : undefined
            if (typeof hex === 'string' && hex.startsWith('0x')) {
              const d = await decodePreimageHex(hex)
              if (d && d.section === 'treasury' && (d.method === 'spend' || d.method === 'proposeSpend')) {
                const planck = String((d.args as any)?.[0] ?? '0')
                const beneficiary = String((d.args as any)?.[1] ?? '-')
                const amt = formatPlanck(planck, decimals)
                map[r.hash] = { text: `流出 ${amt} ${symbol} → ${beneficiary}` }
                continue
              }
            }
          }
        } catch {}
      }
      setDecoded(map)
    })()
  }, [txList])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '4px 0' }}>
        <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
      </div>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>国库信息</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>国库地址</div>
          <div style={{
            padding: 12,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            background: '#fafafa'
          }}>{TREASURY_ADDRESS}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={copy} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>复制地址</button>
            <button onClick={()=> window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'gov-new' } }))} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginLeft: 8 }}>发起财库支出提案</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>余额</div>
          {loading && <div style={{ color: '#999' }}>查询中…</div>}
          {error && <div style={{ color: '#ef4444' }}>查询失败：{error}</div>}
          {!loading && !error && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatted}</div>
              <div style={{ color: '#666' }}>{symbol}</div>
            </div>
          )}
          {!loading && !error && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>原始：{raw}</div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>最近本地交易（与国库相关，最多显示 20 条）</div>
          {txList.length === 0 ? (
            <div style={{ color: '#999' }}>暂无本地记录。发起提案或执行交易后会显示在此（仅本机可见）。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {txList.map((r, i) => (
                <div key={`${r.hash}-${i}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{r.hash}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{r.section || '-'}.{r.method || '-'} · {new Date(r.timestamp).toLocaleString()}</div>
                  {decoded[r.hash]?.text && (
                    <div style={{ fontSize: 12, color: '#0f766e', background: '#ecfeff', border: '1px solid #99f6e4', marginTop: 6, padding: 6, borderRadius: 6 }}>{decoded[r.hash].text}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TreasuryPage


