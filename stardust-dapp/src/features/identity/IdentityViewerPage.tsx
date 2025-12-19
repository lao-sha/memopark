import React from 'react'
import { Card, Descriptions, Typography, Space, Alert, Input, Button, message } from 'antd'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：Identity 只读查看器
 * - 输入账户地址，读取 identity.IdentityOf / UsernameOf / Registrars 等信息
 * - 仅展示核心字段，便于移动端查看
 */
const IdentityViewerPage: React.FC = () => {
  const [addr, setAddr] = React.useState('')
  const [data, setData] = React.useState<any>(null)
  const [error, setError] = React.useState('')

  const load = async () => {
    setError(''); setData(null)
    try {
      const api = await getApi()
      const q: any = (api.query as any).identity
      if (!q) throw new Error('运行时未启用 identity')
      const [id, username, regs] = await Promise.all([
        q.IdentityOf?.(addr),
        q.UsernameOf?.(addr),
        q.Registrars?.(),
      ])
      setData({
        identity: id?.toHuman?.() || id?.toJSON?.() || null,
        username: username?.toHuman?.() || username?.toJSON?.() || null,
        registrars: regs?.toHuman?.() || regs?.toJSON?.() || null,
      })
    } catch (e:any) { setError(e?.message || '查询失败') }
  }

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>身份(Identity) 查看</Typography.Title>
        <Input placeholder="账户地址" value={addr} onChange={e=> setAddr(e.target.value)} />
        <Button type="primary" onClick={load}>查询</Button>
        {data && (
          <Card size="small" title="结果">
            <Descriptions column={1}>
              <Descriptions.Item label="IdentityOf">
                <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(data.identity, null, 2)}</pre>
              </Descriptions.Item>
              <Descriptions.Item label="UsernameOf">
                <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(data.username, null, 2)}</pre>
              </Descriptions.Item>
              <Descriptions.Item label="Registrars">
                <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(data.registrars, null, 2)}</pre>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Space>
    </div>
  )
}

export default IdentityViewerPage
