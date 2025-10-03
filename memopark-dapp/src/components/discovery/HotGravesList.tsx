import React, { useState, useEffect } from 'react'
import { Card, List, Typography, Tag, Skeleton, Empty } from 'antd'
import { FireOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：热门墓地列表组件
 * - 展示最近活跃的墓地
 * - 点击跳转到墓地详情
 * - 移动端卡片式布局
 */

interface HotGrave {
  id: number
  name: string
  coverCid?: string
  deceasedCount: number
  offeringsCount: number
}

export const HotGravesList: React.FC = () => {
  const [graves, setGraves] = useState<HotGrave[]>([])
  const [loading, setLoading] = useState(false)

  /**
   * 加载热门墓地（简化版：最近创建的前10个）
   */
  const loadHotGraves = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      let q: any = queryRoot.memo_grave || queryRoot.memoGrave || queryRoot.grave
      
      if (!q?.nextGraveId || !q?.graves) {
        setGraves([])
        return
      }

      const nextId = await q.nextGraveId().then((x:any)=>x?.toNumber? x.toNumber(): 0)
      const start = Math.max(0, nextId - 10)
      const ids = Array.from({ length: Math.min(10, nextId) }).map((_, i) => start + i)
      
      const all = await Promise.all(ids.map(async (id)=>{
        try {
          const gOpt = await q.graves(id)
          if (!gOpt || !gOpt.isSome) return null
          
          const g = gOpt.unwrap()
          let name: string | undefined = undefined
          try {
            const nmU8 = g.name?.toU8a ? g.name.toU8a() : (g.name?.toJSON ? new Uint8Array(g.name.toJSON()) : undefined)
            if (nmU8) name = new TextDecoder().decode(nmU8)
          } catch {}
          
          let coverCid: string | undefined = undefined
          try {
            const cOpt = await (q.coverCidOf ? q.coverCidOf(id) : null)
            if (cOpt && cOpt.isSome) {
              const u8 = (cOpt.unwrap() as any).toU8a ? (cOpt.unwrap() as any).toU8a() : new Uint8Array([])
              coverCid = new TextDecoder().decode(u8)
            }
          } catch {}
          
          return {
            id,
            name: name || `墓地 #${id}`,
            coverCid,
            deceasedCount: 0,  // TODO: 从链上查询
            offeringsCount: 0   // TODO: 从链上查询
          }
        } catch {
          return null
        }
      }))
      
      setGraves((all.filter(Boolean) as HotGrave[]).reverse())
    } catch (e) {
      console.error('加载热门墓地失败:', e)
      setGraves([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHotGraves()
  }, [])

  if (loading) {
    return (
      <Card title="🔥 热门纪念馆" size="small">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    )
  }

  if (graves.length === 0) {
    return (
      <Card title="🔥 热门纪念馆" size="small">
        <Empty 
          description="暂无数据" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <Card 
      title={
        <span>
          <FireOutlined style={{ color: 'var(--color-accent)', marginRight: 6 }} />
          热门纪念馆
        </span>
      }
      size="small"
      style={{
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <List
        dataSource={graves.slice(0, 5)}
        renderItem={(grave) => (
          <List.Item
            style={{
              padding: '12px 0',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onClick={() => {
              try {
                localStorage.setItem('mp.grave.detailId', String(grave.id))
                window.location.hash = `#/grave/detail?gid=${grave.id}`
              } catch {}
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
              {/* 封面缩略图 */}
              {grave.coverCid ? (
                <img
                  src={`https://ipfs.io/ipfs/${grave.coverCid}`}
                  alt={grave.name}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 'var(--radius-md)',
                    objectFit: 'cover',
                    border: '2px solid var(--color-border-light)'
                  }}
                />
              ) : (
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--color-primary-bg) 0%, var(--color-bg-secondary) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  border: '2px solid var(--color-border-light)'
                }}>
                  🏛️
                </div>
              )}
              
              {/* 信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text 
                  strong 
                  style={{ 
                    display: 'block',
                    marginBottom: 4,
                    color: 'var(--color-text-primary)',
                    fontSize: 15
                  }}
                  ellipsis
                >
                  {grave.name}
                </Typography.Text>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag 
                    color="gold" 
                    style={{ 
                      margin: 0,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 11
                    }}
                  >
                    #{grave.id}
                  </Tag>
                  {grave.deceasedCount > 0 && (
                    <Tag 
                      style={{ 
                        margin: 0,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11
                      }}
                    >
                      {grave.deceasedCount} 位逝者
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </List.Item>
        )}
      />
    </Card>
  )
}

export default HotGravesList

