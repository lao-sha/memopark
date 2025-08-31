import React from 'react'
import { Alert, List, Skeleton, Select, Typography, Tag } from 'antd'
import { query } from '../../lib/graphql'

/**
 * 函数级详细中文注释：仲裁案件列表（Subsquid）
 * 前端操作方法：
 * - 可按域/状态筛选；从 GraphQL 拉取分页数据
 */
const CasesPage: React.FC = () => {
  const [status, setStatus] = React.useState<'All'|'Disputed'|'Arbitrated'>('All')
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const where = status==='All'? '' : `where: { status_eq: "${status}" }`
      const gql = `query { arbitrationCases(${where} orderBy: id_DESC, limit: 50){ id domainHex caseId status decision bps } }`
      const data = await query<{ arbitrationCases: any[] }>(gql)
      setItems(data.arbitrationCases)
    } finally { setLoading(false) }
  }, [status])

  React.useEffect(()=>{ load() }, [load])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>仲裁案件</Typography.Title>
        <Alert type="info" showIcon message="数据由 Subsquid 提供；点击案件可前往详情页（后续）。" />
      </div>
      <div style={{ padding: 8 }}>
        <Select value={status} onChange={v=>setStatus(v)} options={[{label:'全部',value:'All'},{label:'进行中',value:'Disputed'},{label:'已裁决',value:'Arbitrated'}]} style={{ width:'100%' }} />
      </div>
      <div style={{ padding: 8 }}>
        {loading? <Skeleton active/> : (
          <List dataSource={items} renderItem={(it:any) => (
            <List.Item>
              <List.Item.Meta
                title={`案件 ${it.id} (${it.domainHex})`}
                description={<>
                  <Tag color={it.status==='Arbitrated'?'green':'orange'}>{it.status}</Tag>
                  {it.decision!==undefined && <Tag color="blue">决策 {String(it.decision)} {it.bps?`(${it.bps} bps)`:''}</Tag>}
                </>}
              />
            </List.Item>
          )}/>
        )}
      </div>
    </div>
  )
}

export default CasesPage


