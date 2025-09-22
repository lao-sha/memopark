import React from 'react'
import { Card, Space, Typography, InputNumber, Button, Alert, message } from 'antd'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：Forwarder 会话台（MVP）
 * - 目标：提供最常用的维护操作入口（如 purge_expired(limit)）
 * - open/close_session/forward 因参数结构与签名细节依赖运行时版本，采用“存在即渲染”的动态检测策略
 * - 便于后续按 runtime 接口稳定后扩展为完整会话管理
 */
const ForwarderSessionPage: React.FC = () => {
  const [limit, setLimit] = React.useState<number>(100)
  const [error, setError] = React.useState('')
  const sectionCandidates = ['forwarder','pallet_forwarder','memo_forwarder']

  const runPurge = async () => {
    try {
      const api = await getApi()
      const txroot: any = api.tx as any
      let section: any
      for (const s of sectionCandidates) { if (txroot[s]) { section = txroot[s]; break } }
      if (!section) throw new Error('运行时未注册 Forwarder')
      const method = section.purgeExpired || section.purge_expired
      if (!method) throw new Error('找不到 purge_expired 方法')
      const h = await signAndSendLocalFromKeystore(Object.keys(txroot).find(k=> txroot[k]===section)!, method.name, [limit])
      message.success('已提交清理：'+h)
    } catch (e:any) { message.error(e?.message || '提交失败') }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="Forwarder 会话台">
        <Space direction="vertical" style={{ width:'100%' }} size={8}>
          {error && <Alert type="error" showIcon message={error} />}
          <Typography.Paragraph type="secondary">
            说明：该页面提供 Forwarder 的基础维护操作。会话开关与元交易转发因参数依赖运行时版本，将在后续增强。
          </Typography.Paragraph>
          <Space>
            <Typography.Text>清理过期会话（limit）</Typography.Text>
            <InputNumber min={1} max={10000} value={limit} onChange={(v)=> setLimit((v as number) || 0)} />
            <Button type="primary" onClick={runPurge}>执行清理</Button>
          </Space>
        </Space>
      </Card>
    </div>
  )
}

export default ForwarderSessionPage


