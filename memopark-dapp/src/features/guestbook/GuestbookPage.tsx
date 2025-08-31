import React from 'react'
import { Alert, List, Skeleton, Typography, Tag } from 'antd'
import { query } from '../../lib/graphql'

/**
 * 函数级详细中文注释：留言板（只读时间线，数据来自 Subsquid）
 * 前端操作方法：
 * - 输入 graveId，自动分页拉取留言；后续可加入发帖/编辑（链上直发）。
 */
const GuestbookPage: React.FC = () => {
  const [graveId, setGraveId] = React.useState<string>('1')
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!graveId) return
    setLoading(true)
    try {
      const data = await query<{ guestbookMessages: any[] }>(`query Q($gid:BigInt!){ guestbookMessages(where:{graveId_eq:$gid}, orderBy: created_DESC, limit: 50){ id graveId author content created hidden } }`, { gid: graveId })
      setItems(data.guestbookMessages)
    } finally { setLoading(false) }
  }, [graveId])

  React.useEffect(()=>{ load() }, [load])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>留言板</Typography.Title>
        <Alert type="info" showIcon message="只读时间线来自 Subsquid；发帖/编辑稍后接入链上直发。" />
      </div>
      <div style={{ padding: 8 }}>
        <input value={graveId} onChange={e=>setGraveId(e.target.value)} placeholder="输入墓位ID" style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
      </div>
      <div style={{ padding: 8 }}>
        {loading? <Skeleton active/> : (
          <List dataSource={items} renderItem={(it:any)=> (
            <List.Item>
              <List.Item.Meta
                title={`#${it.id} by ${it.author}`}
                description={<>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{it.content}</div>
                  {it.hidden && <Tag color="default">已隐藏</Tag>}
                </>}
              />
            </List.Item>
          )}/>
        )}
      </div>
    </div>
  )
}

export default GuestbookPage


