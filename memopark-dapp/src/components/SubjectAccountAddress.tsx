import React from 'react'
import { Button, Input, InputNumber, Space, Typography, message } from 'antd'
import { getApi } from '../lib/polkadot-safe'
import { blake2AsU8a, encodeAddress } from '@polkadot/util-crypto'
import { hexToU8a, stringToU8a, u8aConcat } from '@polkadot/util'

/**
 * 函数级详细中文注释：主题资金账户展示组件（只读派生 + 一键复制 + 套用）
 * - 依据链上 memo-ipfs 常量（SubjectPalletId, DeceasedDomain）从 (domain, subject_id) 稳定派生账户地址
 * - 提供复制已派生地址、将派生地址回填到外层(onApply)
 * - 移动端友好：最大宽度不超过父容器
 */
export const SubjectAccountAddress: React.FC<{
  subjectId?: number
  domain?: number
  onApply?: (addr: string) => void
}> = ({ subjectId, domain, onApply }) => {
  const [computed, setComputed] = React.useState<string>('')

  React.useEffect(() => {
    (async () => {
      try {
        const api = await getApi()
        const sid = Number(subjectId || 0)
        if (!sid) { setComputed(''); return }
        const consts: any = (api.consts as any)
        const sec = ['memoIpfs','memo_ipfs','ipfs'].find(s => consts[s]) || 'memoIpfs'
        const pidHex = consts[sec]?.subjectPalletId?.toString?.() || ''
        const dom = domain ?? (consts[sec]?.deceasedDomain?.toNumber?.() ?? 1)
        const pidU8a = pidHex && pidHex.startsWith('0x') ? hexToU8a(pidHex) : new Uint8Array(8)
        const domU8a = api.createType('u8', dom).toU8a()
        const sidU8a = api.createType('u64', sid).toU8a()
        const data = u8aConcat(stringToU8a('modl'), pidU8a, domU8a, sidU8a)
        const hash = blake2AsU8a(data, 256)
        const ss58 = encodeAddress(hash, api.registry.chainSS58 || 42)
        setComputed(ss58)
      } catch { setComputed('') }
    })()
  }, [subjectId, domain])

  async function copy() {
    try { await navigator.clipboard.writeText(computed); message.success('已复制派生地址') } catch { message.error('复制失败') }
  }

  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>自动计算的派生资金账户地址（domain=逝者域）</Typography.Text>
      <Space.Compact style={{ width: '100%', marginTop: 6 }}>
        <Input readOnly placeholder="自动计算的派生地址" value={computed} />
        <Button onClick={copy} disabled={!computed}>复制</Button>
        <Button type="primary" onClick={() => computed && onApply?.(computed)} disabled={!computed}>套用</Button>
      </Space.Compact>
    </div>
  )
}

export default SubjectAccountAddress


