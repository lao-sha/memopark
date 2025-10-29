import React from 'react'
import { Typography } from 'antd'
import { getApi } from '../../../lib/polkadot-safe'

/**
 * 函数级中文注释：读取 `deceased::OwnerChangeLogOf` 并内联展示最近一次 owner 变更。
 * - 展示：old_owner → new_owner，区块高 at，以及 evidence_cid（若有）。
 */
const OwnerChangeLogInline: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
  const [log, setLog] = React.useState<{ old: string, neo: string, at: string, ev: string } | null>(null)
  React.useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const qr: any = (api.query as any)
        const key = Object.keys(qr).find(k => /deceased$/i.test(k)) || 'deceased'
        const v = await qr[key]?.ownerChangeLogOf?.(deceasedId)
        if (v && v.isSome) {
          const t: any = v.unwrap()
          const old = String(t[0])
          const neo = String(t[1])
          const at = String(t[2].toString())
          let ev = ''
          try { const u8 = t[3].toU8a? t[3].toU8a(): new Uint8Array([]); ev = new TextDecoder().decode(u8) } catch {}
          setLog({ old, neo, at, ev })
        } else { setLog(null) }
      } catch { setLog(null) }
    })()
  }, [deceasedId])
  if (!log) return null
  return (
    <div style={{ fontSize: 12, color: '#666' }}>
      最近一次 owner 变更：<Typography.Text code>{log.old}</Typography.Text> → <Typography.Text code>{log.neo}</Typography.Text>
      ，区块：<Typography.Text code>{log.at}</Typography.Text>
      {log.ev && <>, 证据CID：<Typography.Text code>{log.ev}</Typography.Text></>}
    </div>
  )
}

export default OwnerChangeLogInline


