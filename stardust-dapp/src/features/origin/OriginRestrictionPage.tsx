import React from 'react'
import { Card, Typography, Space, Alert, Tag } from 'antd'
import { getApi } from '../../lib/polkadot'

/**
 * 函数级详细中文注释：Origin-Restriction 只读页
 * - 展示全局放行开关 GlobalAllow
 */
const OriginRestrictionPage: React.FC = () => {
  const [val, setVal] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState('')

  const load = async () => {
    setError('')
    try{
      const api = await getApi()
      const q: any = (api.query as any).originRestriction
      if(!q) throw new Error('运行时未启用 origin-restriction')
      const v = await q.globalAllow?.()
      setVal(Boolean(v?.toJSON?.()))
    }catch(e:any){ setError(e?.message||'查询失败') }
  }

  React.useEffect(()=> { load() }, [])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Space direction="vertical" style={{ width:'100%' }} size={12}>
        {error && <Alert type="error" showIcon message={error} />}
        <Typography.Title level={4} style={{ margin: 0 }}>Origin 限制策略</Typography.Title>
        <Card size="small" title="全局放行(GlobalAllow)">
          {val==null ? <Tag>加载中</Tag> : val ? <Tag color="green">允许</Tag> : <Tag color="red">关闭</Tag>}
        </Card>
      </Space>
    </div>
  )
}

export default OriginRestrictionPage
