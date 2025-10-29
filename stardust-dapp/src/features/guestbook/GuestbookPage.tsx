import React from 'react'
import { Alert, List, Skeleton, Typography, Tag } from 'antd'

/**
 * 函数级详细中文注释：留言板（只读时间线）
 * 前端操作方法：
 * - 输入 graveId，自动分页拉取留言；后续可加入发帖/编辑（链上直发）。
 * - 全局链上直连模式，移除 Subsquid 依赖
 */
const GuestbookPage: React.FC = () => {
  const [graveId, setGraveId] = React.useState<string>('1')
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)

  /**
   * 函数级中文注释：全局链上直连模式，暂时禁用 Subsquid 查询
   */
  const load = React.useCallback(async () => {
    if (!graveId) return
    setLoading(true)
    try {
      // 暂时禁用 Subsquid 查询
      setItems([])
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


