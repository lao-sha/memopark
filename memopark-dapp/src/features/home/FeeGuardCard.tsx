import React, { useEffect, useState } from 'react'
import { Card, Button, Alert, Space, message } from 'antd'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { buildCallPreimageHex } from '../governance/lib/governance'

/**
 * 函数级详细中文注释：仅手续费保护（FeeGuard）状态卡片
 * - 展示当前账户是否启用 FeeGuard
 * - 提供生成治理预映像（mark_fee_only/unmark_fee_only）的能力，交由“发起提案”页使用
 */
const FeeGuardCard: React.FC = () => {
  const { current } = useWallet()
  const [marked, setMarked] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ (async()=>{
    try {
      if (!current) return
      const api = await getApi()
      const q: any = (api.query as any).feeGuard || (api.query as any).fee_guard
      if (!q?.feeOnlyAccounts) { setMarked(null); return }
      const res = await q.feeOnlyAccounts(current)
      setMarked(!!(res && res.isSome))
    } catch { setMarked(null) }
  })() }, [current])

  async function genPreimage(mark: boolean) {
    if (!current) return message.info('请先选择账户')
    try {
      const api = await getApi()
      const section = (api.tx as any).feeGuard ? 'feeGuard' : ((api.tx as any).fee_guard ? 'fee_guard' : null)
      if (!section) throw new Error('运行时未启用 fee-guard 模块')
      const method = mark ? 'markFeeOnly' : 'unmarkFeeOnly'
      const { hex, hash } = await buildCallPreimageHex(section, method, [current])
      message.success(`已生成预映像：${hash}`)
      // 复制到剪贴板给“发起提案”页使用
      try { await navigator.clipboard.writeText(hex) } catch {}
    } catch(e:any) {
      message.error(e?.message || '生成失败')
    }
  }

  return (
    <Card title="仅手续费保护（FeeGuard）" style={{ borderRadius: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {marked === null && (
          <Alert type="info" showIcon message="无法读取 FeeGuard 状态（可能未启用模块或未连接）。" />
        )}
        {marked === true && (
          <Alert type="success" showIcon message="当前账户已启用仅手续费保护：账户只用于扣除交易手续费，无法主动转出资金。" />
        )}
        {marked === false && (
          <Alert type="warning" showIcon message="未启用仅手续费保护。建议为派生费账户开启，防止误转出资金。" />
        )}
        <Space>
          <Button loading={loading} onClick={()=>genPreimage(true)}>生成启用预映像</Button>
          <Button loading={loading} onClick={()=>genPreimage(false)}>生成解除预映像</Button>
        </Space>
      </Space>
    </Card>
  )
}

export default FeeGuardCard


