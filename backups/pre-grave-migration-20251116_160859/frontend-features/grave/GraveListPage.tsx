import React, { useEffect, useState } from 'react'
import { Card, List, Typography, Tag, Space, Input, Button, Pagination, Alert, Modal, Select, Avatar, Divider } from 'antd'
import { 
  ArrowLeftOutlined, 
  SearchOutlined, 
  EnvironmentOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  EditOutlined
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

const { Text } = Typography

/**
 * 函数级详细中文注释：纪念馆列表页面（移动端专用）
 * - 不再依赖 Subsquid；直接读取 pallet-memo-grave 的存储
 * - 移动端优化布局，卡片式设计
 * - 支持按 owner 过滤、名称搜索、排序
 * - 展示封面、名称、逝者信息
 */
const GraveListPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [owner, setOwner] = useState<string>('')
  const [nameKeyword, setNameKeyword] = useState<string>('')
  const [sortKey, setSortKey] = useState<'id'|'park'|'active'|'public'>('id')
  const [sortAsc, setSortAsc] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [maxNameLen, setMaxNameLen] = useState<number>(0)
  const [renameOpen, setRenameOpen] = useState<boolean>(false)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameVal, setRenameVal] = useState<string>('')
  const [filterOpen, setFilterOpen] = useState<boolean>(false)

  /**
   * 函数级详细中文注释：加载纪念馆列表数据
   * 从链上读取所有纪念馆，支持过滤和排序
   */
  const load = async (p: number, ps: number, ownerFilter: string) => {
    setLoading(true); setError('')
    try {
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      // 读取常量：MaxCidLen 作为名称最大字节数
      try { 
        const c: any = (api.consts as any)?.memoGrave?.maxCidLen
        if (c) setMaxNameLen(Number(c.toString())) 
      } catch {}
      
      // 兼容多种命名：memo_grave / memoGrave / grave
      let q: any = queryRoot.memo_grave || queryRoot.memoGrave || queryRoot.grave
      if (!q) {
        const foundKey = Object.keys(queryRoot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k))
        if (foundKey) q = queryRoot[foundKey]
      }
      if (!q?.nextGraveId || !q?.graves || !q?.slugOf) {
        throw new Error('运行时未启用 memo_grave 或元数据缺失')
      }
      
      // 读取逝者模块（可选）
      const dq: any = queryRoot.deceased || queryRoot.memo_deceased || queryRoot.memoDeceased
      const nextId = await q.nextGraveId().then((x:any)=>x?.toNumber? x.toNumber(): 0)
      const ids = Array.from({ length: nextId }).map((_,i)=>i)
      
      // 拉取所有存在的墓地
      const all = await Promise.all(ids.map(async (id)=>{
        try {
          const gOpt = await q.graves(id)
          if (!gOpt || !gOpt.isSome) return null
          const g = gOpt.unwrap()
          
          // 读取 slug
          let slug: string | undefined = undefined
          try {
            const sOpt = await q.slugOf(id)
            if (sOpt && sOpt.isSome) {
              const u8 = (sOpt.unwrap() as any).toU8a ? (sOpt.unwrap() as any).toU8a() : new Uint8Array([])
              slug = new TextDecoder().decode(u8)
            }
          } catch {}
          
          // 读取名称
          let name: string | undefined = undefined
          try {
            const nmU8 = (g.name?.toU8a ? g.name.toU8a() : (g.name?.toJSON ? new Uint8Array(g.name.toJSON()) : undefined)) as Uint8Array | undefined
            if (nmU8) name = new TextDecoder().decode(nmU8)
          } catch {}
          
          // 读取封面 CID
          let coverCid: string | undefined = undefined
          try {
            const cOpt = await (q.coverCidOf ? q.coverCidOf(id) : null)
            if (cOpt && cOpt.isSome) {
              const u8 = (cOpt.unwrap() as any).toU8a ? (cOpt.unwrap() as any).toU8a() : new Uint8Array([])
              coverCid = new TextDecoder().decode(u8)
            }
          } catch {}
          
          // 读取逝者姓名
          let names: string[] = []
          try {
            if (dq?.deceasedByGrave && dq?.deceasedOf) {
              const lst: any = await dq.deceasedByGrave(id)
              const arr: number[] = Array.isArray(lst) ? lst as any : (lst?.toJSON?.() || [])
              const top = (arr as number[]).slice(0, 2)
              for (const did of top) {
                try {
                  const dOpt = await dq.deceasedOf(did)
                  if (dOpt && dOpt.isSome) {
                    const d = dOpt.unwrap()
                    const nameU8 = d.name?.toU8a ? d.name.toU8a() : (d.name?.toJSON ? new Uint8Array(d.name.toJSON()) : undefined)
                    if (nameU8) names.push(new TextDecoder().decode(nameU8))
                  }
                } catch {}
              }
            }
          } catch {}
          
          return {
            id,
            owner: g.owner?.toString?.() || String(g.owner),
            parkId: g.parkId?.isSome ? g.parkId.unwrap().toNumber() : null,
            kind: g.kindCode?.toNumber ? g.kindCode.toNumber() : Number(g.kind_code ?? g.kindCode ?? 0),
            slug,
            name,
            names,
            coverCid,
          }
        } catch { return null }
      }))
      
      let list = all.filter(Boolean) as any[]
      if (ownerFilter) list = list.filter(it => String(it.owner) === ownerFilter)
      if (nameKeyword) list = list.filter(it => (it.name || '').includes(nameKeyword))
      
      // 排序
      list.sort((a,b)=>{
        const sgn = sortAsc ? 1 : -1
        if (sortKey === 'id') return sgn*(a.id - b.id)
        if (sortKey === 'park') return sgn*(((a.parkId??-1) - (b.parkId??-1)))
        if (sortKey === 'active') return sgn*(((a.active?1:0) - (b.active?1:0)))
        if (sortKey === 'public') return sgn*(((a.isPublic?1:0) - (b.isPublic?1:0)))
        return 0
      })
      
      // 客户端分页
      const offset = (p - 1) * ps
      setTotal(list.length)
      setItems(list.slice(offset, offset + ps))
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setItems([])
      setTotal(0)
    } finally { 
      setLoading(false) 
    }
  }

  useEffect(()=>{ load(page, pageSize, owner) }, [])

  /**
   * 函数级详细中文注释：搜索和刷新
   */
  const onSearch = () => { 
    setPage(1)
    load(1, pageSize, owner) 
  }

  return (
    <div style={{ 
      width: '100%',
      minHeight: '100vh',
      background: '#F5F5DC',
      paddingBottom: 24
    }}>
      {/* 顶部导航栏 */}
      <div style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'linear-gradient(135deg, #B8860B 0%, #2F4F4F 100%)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined style={{ fontSize: 20, color: '#fff' }} />} 
          onClick={() => window.history.back()}
          style={{ color: '#fff' }}
        />
        <Text style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: 18 }}>
          纪念馆列表
        </Text>
        <Button 
          type="text" 
          icon={<FilterOutlined style={{ fontSize: 20, color: '#fff' }} />}
          onClick={() => setFilterOpen(!filterOpen)}
          style={{ color: '#fff' }}
        />
      </div>

      {/* 内容区域 */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
        {/* 筛选器（可折叠） */}
        {filterOpen && (
          <Card 
            style={{ 
              marginBottom: 16,
              borderRadius: 12,
              border: '2px solid rgba(184, 134, 11, 0.15)',
              boxShadow: '0 2px 8px rgba(47, 79, 79, 0.1)'
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#2F4F4F' }}>
                  Owner地址过滤
                </Text>
                <Input 
                  placeholder="输入Owner地址（可选）" 
                  value={owner} 
                  onChange={e=> setOwner(e.target.value)} 
                  allowClear
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </div>
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#2F4F4F' }}>
                  名称关键词
                </Text>
                <Input 
                  placeholder="输入名称关键词" 
                  value={nameKeyword} 
                  onChange={e=> setNameKeyword(e.target.value)} 
                  allowClear
                  prefix={<SearchOutlined />}
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </div>
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#2F4F4F' }}>
                  排序方式
                </Text>
                <Space style={{ width: '100%' }} size={8}>
                  <Select 
                    value={sortKey} 
                    onChange={(v)=> setSortKey(v)} 
                    style={{ flex: 1 }}
                    size="large"
                    options={[
                      {value:'id',label:'按ID'},
                      {value:'park',label:'按园区'},
                      {value:'active',label:'按状态'},
                      {value:'public',label:'按公开'}
                    ]} 
                  />
                  <Button 
                    onClick={()=> setSortAsc(v=>!v)}
                    icon={sortAsc ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                    size="large"
                    style={{ flex: 0 }}
                  >
                    {sortAsc ? '升序' : '降序'}
                  </Button>
                </Space>
              </div>
              
              <Button 
                type="primary" 
                onClick={onSearch} 
                loading={loading}
                block
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)',
                  border: 'none',
                  borderRadius: 24,
                  height: 48,
                  fontWeight: 600
                }}
              >
                <SearchOutlined /> 查询
              </Button>
            </Space>
          </Card>
        )}

        {/* 错误提示 */}
        {error && (
          <Alert 
            type="error" 
            showIcon 
            style={{ 
              marginBottom: 16,
              borderRadius: 12,
              border: '2px solid rgba(220, 20, 60, 0.2)'
            }} 
            message={error} 
          />
        )}

        {/* 列表 */}
        <div style={{ marginBottom: 16 }}>
          <List
            loading={loading}
            dataSource={items}
            locale={{ emptyText: '暂无纪念馆' }}
            renderItem={(it:any)=> (
              <Card
                style={{
                  marginBottom: 12,
                  borderRadius: 12,
                  border: '2px solid rgba(184, 134, 11, 0.15)',
                  boxShadow: '0 2px 8px rgba(47, 79, 79, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                bodyStyle={{ padding: 16 }}
                onClick={()=>{ 
                  try { 
                    localStorage.setItem('mp.grave.detailId', String(it.id)) 
                  } catch {}
                  window.location.hash = '#/grave/detail' 
                }}
              >
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* 封面缩略图 */}
                  {it.coverCid ? (
                    <img 
                      alt="cover" 
                      src={`https://ipfs.io/ipfs/${it.coverCid}`} 
                      style={{ 
                        width: 80, 
                        height: 80, 
                        objectFit: 'cover', 
                        borderRadius: 10, 
                        border: '2px solid rgba(184, 134, 11, 0.2)',
                        flexShrink: 0
                      }} 
                    />
                  ) : (
                    <div style={{ 
                      width: 80, 
                      height: 80, 
                      borderRadius: 10, 
                      border: '2px solid rgba(184, 134, 11, 0.2)', 
                      background: 'linear-gradient(135deg, #F5F5DC 0%, #FEFAF5 100%)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#B8860B',
                      flexShrink: 0
                    }}>
                      <EnvironmentOutlined style={{ fontSize: 32 }} />
                    </div>
                  )}
                  
                  {/* 信息区域 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 16, color: '#2F4F4F' }}>
                        #{it.id} {it.name || '未命名'}
                      </Text>
                    </div>
                    
                    {/* 标签 */}
                    <Space wrap size={4} style={{ marginBottom: 8 }}>
                      {it.slug && (
                        <Tag 
                          color="blue"
                          style={{ 
                            borderRadius: 8, 
                            fontSize: 11,
                            padding: '2px 8px'
                          }}
                        >
                          {Array.isArray(it.slug) ? new TextDecoder().decode(new Uint8Array(it.slug)) : String(it.slug)}
                        </Tag>
                      )}
                      {it.parkId != null && (
                        <Tag 
                          color="purple"
                          style={{ 
                            borderRadius: 8, 
                            fontSize: 11,
                            padding: '2px 8px'
                          }}
                        >
                          园区{it.parkId}
                        </Tag>
                      )}
                    </Space>
                    
                    {/* 逝者姓名 */}
                    {Array.isArray(it.names) && it.names.length > 0 && (
                      <Text 
                        type="secondary" 
                        style={{ 
                          fontSize: 13,
                          display: 'block',
                          marginBottom: 8
                        }}
                      >
                        逝者：{it.names.join('、')}{it.names.length >= 2 ? ' 等' : ''}
                      </Text>
                    )}
                    
                    {/* Owner地址 */}
                    <Text 
                      type="secondary" 
                      style={{ 
                        fontSize: 11,
                        display: 'block',
                        wordBreak: 'break-all'
                      }}
                    >
                      {it.owner.slice(0, 10)}...{it.owner.slice(-8)}
                    </Text>
                  </div>
                  
                  {/* 编辑按钮 */}
                  <Button
                    type="text"
                    icon={<EditOutlined style={{ fontSize: 16, color: '#B8860B' }} />}
                    onClick={(e)=>{ 
                      e.stopPropagation()
                      setRenameId(it.id)
                      setRenameVal(it.name || '')
                      setRenameOpen(true) 
                    }}
                    style={{ 
                      alignSelf: 'flex-start',
                      padding: 8
                    }}
                  />
                </div>
              </Card>
            )}
          />
        </div>

        {/* 分页 */}
        {total > 0 && (
          <div style={{ 
            background: '#fff',
            padding: 16,
            borderRadius: 12,
            border: '2px solid rgba(184, 134, 11, 0.15)',
            boxShadow: '0 2px 8px rgba(47, 79, 79, 0.1)'
          }}>
            <Pagination 
              current={page} 
              pageSize={pageSize} 
              total={total} 
              onChange={(p, ps)=>{ 
                setPage(p)
                setPageSize(ps)
                load(p, ps, owner) 
              }} 
              showSizeChanger 
              showTotal={t=>`共 ${t} 个纪念馆`}
              simple
              style={{ textAlign: 'center' }}
            />
          </div>
        )}

        {/* 编辑名称弹窗 */}
        <Modal
          open={renameOpen}
          onCancel={()=> setRenameOpen(false)}
          onOk={async ()=>{
            try{
              if (renameId==null) return
              const val = (renameVal || '').trim()
              const u8 = new TextEncoder().encode(val)
              if (maxNameLen && u8.length > maxNameLen) { 
                Modal.error({ 
                  title:'名称过长', 
                  content:`UTF-8 字节 ${u8.length}/${maxNameLen}` 
                })
                return 
              }
              const hash = await signAndSendLocalFromKeystore('memoGrave','updateGrave',[renameId, u8, null, null])
              Modal.success({ 
                title:'已提交', 
                content: hash 
              })
              setRenameOpen(false)
              // 自动刷新当前页
              load(page, pageSize, owner)
            } catch(e:any) { 
              Modal.error({ 
                title:'提交失败', 
                content: String(e?.message||e) 
              }) 
            }
          }}
          title={`编辑名称 #${renameId ?? ''}`}
          okText="确认修改"
          cancelText="取消"
          centered
          style={{
            borderRadius: 16
          }}
        >
          <div style={{ padding: '20px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              最多 {maxNameLen || '未知'} 字节（约 {Math.floor((maxNameLen || 0) / 3)} 个中文字符）
            </Text>
            <Input 
              value={renameVal} 
              onChange={e=> setRenameVal(e.target.value)} 
              placeholder="请输入纪念馆名称"
              size="large"
              style={{ 
                borderRadius: 8,
                border: '2px solid rgba(184, 134, 11, 0.2)'
              }}
            />
          </div>
        </Modal>
      </div>
    </div>
  )
}

export default GraveListPage
