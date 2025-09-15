import React, { useEffect, useState } from 'react'
import { Card, List, Typography, Tag, Space, Button, Alert, Modal, Input, message, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { uploadToIpfs } from '../../lib/ipfs'
import { useWallet } from '../../providers/WalletProvider'
import { getApi } from '../../lib/polkadot-safe'
import { signAndSendLocalFromKeystore, signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'

/**
 * 函数级详细中文注释：我的墓地页面（按当前钱包地址过滤）
 * - 直接读取 memo_grave 存储，筛选 owner == current
 * - 展示 id/name/park/slug，提供“编辑名称”跳转到列表页编辑
 */
const MyGravesPage: React.FC = () => {
  const { current } = useWallet()
  const [items, setItems] = useState<any[]>([])
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [keyword, setKeyword] = useState<string>('')
  const [sortKey, setSortKey] = useState<'id'|'park'|'active'|'public'>('id')
  const [sortAsc, setSortAsc] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parkOpen, setParkOpen] = useState(false)
  const [parkIdInput, setParkIdInput] = useState<string>('')
  const [adminOpen, setAdminOpen] = useState<null | { id: number; mode: 'add' | 'remove' }>(null)
  const [adminAddr, setAdminAddr] = useState<string>('')
  // 封面设置弹窗
  const [coverOpen, setCoverOpen] = useState<null | { id: number }>(null)
  const [coverCid, setCoverCid] = useState<string>('')
  // 函数级中文注释：封面提交时的加载状态，避免重复点击与给出进度反馈
  const [coverSubmitting, setCoverSubmitting] = useState<boolean>(false)
  // 函数级中文注释：封面设置时的签名密码输入值（至少 8 位）
  const [coverPwd, setCoverPwd] = useState<string>('')

  // 函数级中文注释：动态解析 grave 的 tx section 名称（兼容 memoGrave/memo_grave/grave）
  const resolveGraveSection = React.useCallback(async (): Promise<string> => {
    try {
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['memoGrave', 'memo_grave', 'grave', ...Object.keys(txRoot)]
      for (const s of candidates) {
        const m = txRoot[s]
        if (m && (typeof m.updateGrave === 'function' || typeof m.setPark === 'function')) return s
      }
    } catch {}
    return 'grave'
  }, [])

  const load = async (owner: string) => {
    setLoading(true); setError('')
    try{
      const api = await getApi()
      const queryRoot: any = (api.query as any)
      let q: any = queryRoot.memo_grave || queryRoot.memoGrave || queryRoot.grave
      if (!q) {
        const foundKey = Object.keys(queryRoot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k))
        if (foundKey) q = queryRoot[foundKey]
      }
      if (!q?.nextGraveId || !q?.graves || !q?.slugOf) throw new Error('运行时未启用 memo_grave 或元数据缺失')
      const nextId = await q.nextGraveId().then((x:any)=>x?.toNumber? x.toNumber(): 0)
      const ids = Array.from({ length: nextId }).map((_,i)=>i)
      const all = await Promise.all(ids.map(async (id)=>{
        try{
          const gOpt = await q.graves(id)
          if (!gOpt || !gOpt.isSome) return null
          const g = gOpt.unwrap()
          const ownerStr = g.owner?.toString?.() || String(g.owner)
          if (ownerStr !== owner) return null
          const sanitizeCid = (s: string | undefined): string | undefined => {
            try {
              if (!s) return undefined
              let v = String(s).trim()
              // 去掉常见前缀与引号
              v = v.replace(/^ipfs:\/\//i, '')
              v = v.replace(/^\/ipfs\//i, '')
              v = v.replace(/^"|"$/g, '').replace(/^'|'$/g, '')
              // 去除控制字符、零宽字符、BOM
              v = v.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
              // 去除非可见 ASCII（避免出现 � 等）
              v = v.replace(/[^\x21-\x7E]/g, '')
              // 去掉开头的非字母数字
              v = v.replace(/^[^A-Za-z0-9]+/, '')
              // 截断到首段（去掉空格、斜杠、查询串）
              v = v.split(/[\s/#?]/)[0]
              return v
            } catch { return s }
          }
          let name: string | undefined = undefined
          try { const nmU8 = g.name?.toU8a ? g.name.toU8a() : (g.name?.toJSON ? new Uint8Array(g.name.toJSON()) : undefined); if (nmU8) name = new TextDecoder().decode(nmU8) } catch {}
          let slug: string | undefined = undefined
          try { const sOpt = await q.slugOf(id); if (sOpt && sOpt.isSome) { const u8 = (sOpt.unwrap() as any).toU8a ? (sOpt.unwrap() as any).toU8a() : new Uint8Array([]); slug = new TextDecoder().decode(u8) } } catch {}
          // 函数级中文注释：读取封面 CID（可选）；解码为字符串供前端展示缩略图
          let coverCid: string | undefined = undefined
          try {
            const cOpt = await (q.coverCidOf ? q.coverCidOf(id) : null)
            if (cOpt && cOpt.isSome) {
              const u8 = (cOpt.unwrap() as any).toU8a ? (cOpt.unwrap() as any).toU8a() : new Uint8Array([])
              coverCid = sanitizeCid(new TextDecoder().decode(u8))
            }
          } catch {}
          const parkId = g.parkId?.isSome ? g.parkId.unwrap().toNumber() : null
          // 直接读取 active / is_public
          let active: boolean | undefined = undefined
          let isPublic: boolean | undefined = undefined
          try { active = Boolean((g as any).active?.isTrue ? (g as any).active.isTrue : (g as any).active) } catch {}
          try { isPublic = Boolean((g as any).isPublic?.isTrue ? (g as any).isPublic.isTrue : (g as any).isPublic ?? (g as any).is_public) } catch {}
          return { id, name, slug, parkId, active, isPublic, coverCid }
        } catch { return null }
      }))
      setItems((all.filter(Boolean) as any[]))
    }catch(e:any){ setError(e?.message||'加载失败'); setItems([]) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ if (current) load(current) }, [current])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="我的墓地" extra={<Button size="small" onClick={()=> current && load(current)} loading={loading}>刷新</Button>}>
        {!current && <Alert type="info" showIcon message="请先选择或创建钱包地址" style={{ marginBottom: 12 }} />}
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space style={{ marginBottom: 8 }}>
          <Input placeholder="按名称关键词过滤" value={keyword} onChange={e=> { setKeyword(e.target.value); setPage(1) }} allowClear />
          <select value={sortKey} onChange={e=> setSortKey(e.target.value as any)}>
            <option value="id">按ID</option>
            <option value="park">按ParkId</option>
            <option value="active">按Active</option>
            <option value="public">按Public</option>
          </select>
          <Button size="small" onClick={()=> setSortAsc(v=> !v)}>{sortAsc? '升序':'降序'}</Button>
        </Space>
        <List
          loading={loading}
          dataSource={items
            .filter(it=> !keyword || (it.name || '').includes(keyword))
            .sort((a,b)=>{
              const sgn = sortAsc ? 1 : -1
              if (sortKey === 'id') return sgn*(a.id - b.id)
              if (sortKey === 'park') return sgn*(((a.parkId??-1) - (b.parkId??-1)))
              if (sortKey === 'active') return sgn*(((a.active?1:0) - (b.active?1:0)))
              if (sortKey === 'public') return sgn*(((a.isPublic?1:0) - (b.isPublic?1:0)))
              return 0
            })
            .slice((page-1)*pageSize, (page-1)*pageSize + pageSize)}
          renderItem={(it:any)=> (
          <List.Item>
            <Space direction="vertical" style={{ width:'100%' }}>
              <Space align="start">
                {/* 函数级中文注释：封面缩略图（优先 IPFS 网关，未设置则渲染占位） */}
                {it.coverCid ? (
                  (() => {
                    const gwPrimary = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()
                    const gateways = [gwPrimary, 'http://127.0.0.1:8080', 'https://dweb.link']
                    const src0 = `${gateways[0]}/ipfs/${it.coverCid}`
                    return (
                      <img
                        alt="cover"
                        src={src0}
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }}
                        onError={(e)=>{
                          try{
                            const img = e.currentTarget as any
                            const idx = Number(img.dataset.idx || 0)
                            const next = idx + 1
                            if (next < gateways.length) {
                              img.dataset.idx = String(next)
                              img.src = `${gateways[next]}/ipfs/${it.coverCid}`
                            }
                          }catch{}
                        }}
                        data-idx={0}
                      />
                    )
                  })()
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 8, border: '1px solid #eee', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>封面</div>
                )}
                {/* 右侧信息区 */}
                <Space direction="vertical" style={{ minWidth: 0 }}>
                <Typography.Text strong>#{it.id}</Typography.Text>
                {it.name && <Tag color="green">{it.name}</Tag>}
                {it.slug && <Tag>{it.slug}</Tag>}
                {it.parkId!=null && <Tag color="purple">park {String(it.parkId)}</Tag>}
                {typeof it.active === 'boolean' && <Tag color={it.active? 'blue':'default'}>{it.active? 'active':'inactive'}</Tag>}
                {typeof it.isPublic === 'boolean' && <Tag color={it.isPublic? 'gold':'default'}>{it.isPublic? 'public':'private'}</Tag>}
                </Space>
              </Space>
              <Space>
                <Button size="small" onClick={()=>{ window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'grave-list' } })); window.location.hash = '#/grave/list' }}>去列表编辑名称</Button>
                <Button size="small" onClick={()=>{ setParkOpen(true); setParkIdInput(it.parkId==null? '': String(it.parkId)); (MyGravesPage as any)._editingId = it.id }}>设置园区</Button>
                <Button size="small" type="primary" onClick={()=>{ try { localStorage.setItem('mp.deceased.graveId', String(it.id)) } catch {}; window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'deceased-create' } })) }}>创建逝者</Button>
                <Button size="small" onClick={()=> { setCoverOpen({ id: it.id }); setCoverCid('') }}>上传封面</Button>
                <Button size="small" onClick={async ()=>{
                  try{ const section = await resolveGraveSection(); const hash = await signAndSendLocalFromKeystore(section,'updateGrave',[it.id, null, true, null]); message.success('已提交启用：'+hash); if (current) load(current) }catch(e:any){ message.error(String(e?.message||e)) }
                }}>启用</Button>
                <Button size="small" onClick={async ()=>{
                  try{ const section = await resolveGraveSection(); const hash = await signAndSendLocalFromKeystore(section,'updateGrave',[it.id, null, false, null]); message.success('已提交停用：'+hash); if (current) load(current) }catch(e:any){ message.error(String(e?.message||e)) }
                }}>停用</Button>
                <Button size="small" onClick={async ()=>{
                  try{ const section = await resolveGraveSection(); const hash = await signAndSendLocalFromKeystore(section,'updateGrave',[it.id, null, null, true]); message.success('已提交设为公开：'+hash); if (current) load(current) }catch(e:any){ message.error(String(e?.message||e)) }
                }}>设为公开</Button>
                <Button size="small" onClick={async ()=>{
                  try{ const section = await resolveGraveSection(); const hash = await signAndSendLocalFromKeystore(section,'updateGrave',[it.id, null, null, false]); message.success('已提交设为私有：'+hash); if (current) load(current) }catch(e:any){ message.error(String(e?.message||e)) }
                }}>设为私有</Button>
                <Button size="small" onClick={()=> { setAdminOpen({ id: it.id, mode: 'add' }); setAdminAddr('') }}>添加管理员</Button>
                <Button size="small" onClick={()=> { setAdminOpen({ id: it.id, mode: 'remove' }); setAdminAddr('') }}>移除管理员</Button>
              </Space>
            </Space>
          </List.Item>
        )}
        />
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button size="small" style={{ marginRight: 8 }} onClick={()=> setPage(1)} disabled={page===1}>首页</Button>
          <Button size="small" style={{ marginRight: 8 }} onClick={()=> setPage(p=> Math.max(1, p-1))} disabled={page===1}>上一页</Button>
          <Typography.Text>第 {page} 页 / 共 {Math.max(1, Math.ceil(items.length / pageSize))} 页</Typography.Text>
          <Button size="small" style={{ marginLeft: 8 }} onClick={()=> setPage(p=> Math.min(Math.ceil(items.length / pageSize)||1, p+1))} disabled={page >= Math.ceil(items.length / pageSize)}>下一页</Button>
        </div>
        {/* 设置园区 */}
        <Modal
          open={parkOpen}
          onCancel={()=> setParkOpen(false)}
          title={`设置园区 (#${(MyGravesPage as any)._editingId ?? ''})`}
          onOk={async ()=>{
            try{
              const gid = (MyGravesPage as any)._editingId as number
              const v = parkIdInput.trim()
              const parkArg = v === '' ? null : Number(v)
              const section = await resolveGraveSection();
              const hash = await signAndSendLocalFromKeystore(section,'setPark',[gid, parkArg])
              message.success('已提交：'+hash)
              setParkOpen(false)
            }catch(e:any){ message.error(String(e?.message||e)) }
          }}
        >
          <Input placeholder="输入园区ID（留空清除）" value={parkIdInput} onChange={e=> setParkIdInput(e.target.value)} />
        </Modal>
        {/* 上传封面 */}
        <Modal
          open={!!coverOpen}
          onCancel={()=> setCoverOpen(null)}
          title={`上传封面 (#${coverOpen?.id ?? ''})`}
          okText="确定"
          cancelText="取消"
          destroyOnClose
          confirmLoading={coverSubmitting}
          onOk={async ()=>{
            try{
              console.log('[setCover] onOk clicked', coverOpen, coverCid)
              setCoverSubmitting(true)
              // 函数级中文注释：允许 id=0 的墓位；仅在值为 null/undefined 时才中断
              if (coverOpen?.id == null) return
              const cid = coverCid.trim()
              if (!cid) { message.warning('请输入封面CID'); setCoverSubmitting(false); return }
              if (!coverPwd || coverPwd.length < 8) { message.warning('请输入至少 8 位签名密码'); setCoverSubmitting(false); return }
              const key = 'tx-set-cover'
              try { message.loading({ key, content: '正在提交封面设置…' }) } catch (e) { console.warn('[setCover] message.loading failed', e); try { alert('正在提交封面设置…') } catch {} }
              const section = await resolveGraveSection()
              console.log('[setCover] resolved section =', section)
              // 函数级中文注释：将 CID 文本编码为字节数组，并转换为 number[] 以兼容 BoundedVec<u8>
              const u8 = new TextEncoder().encode(cid)
              const bytes = Array.from(u8)
              console.log('[setCover] bytes length =', bytes.length)
              // 函数级中文注释：使用带密码的本地签名，避免浏览器 prompt 被拦截
              console.log('[setCover] signing…')
              const hash = await signAndSendLocalWithPassword(section, 'setCover', [coverOpen.id, bytes], coverPwd)
              console.log('[setCover] sent tx hash =', hash)
              message.success({ key, content: '已提交封面设置：'+hash })
              // 函数级中文注释：提交成功后关闭弹窗并进入“墓地详情”查看效果（使用查询参数 gid 直达）
              setCoverOpen(null)
              setCoverPwd('')
              try { localStorage.setItem('mp.grave.detailId', String(coverOpen.id)) } catch {}
              try {
                window.location.hash = `#/grave/detail?gid=${coverOpen.id}`
                window.dispatchEvent(new HashChangeEvent('hashchange'))
              } catch {}
              if (current) load(current)
            } catch (e:any) {
              const msg = mapDispatchErrorMessage(e, '提交失败')
              console.error('[setCover] failed:', e)
              message.error({ key: 'tx-set-cover', content: msg })
            }
            finally { setCoverSubmitting(false) }
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input placeholder="输入 IPFS CID（不含协议头）" value={coverCid} onChange={e=> setCoverCid(e.target.value)} />
            <Input.Password placeholder="签名密码（至少 8 位）" value={coverPwd} onChange={e=> setCoverPwd(e.target.value)} />
            <Upload
              maxCount={1}
              accept="image/*"
              beforeUpload={async (file) => {
                try {
                  const cid = await uploadToIpfs(file)
                  setCoverCid(cid)
                  message.success('已上传到 IPFS：'+cid)
                } catch (e:any) {
                  message.error(e?.message || '上传失败')
                }
                return false // 阻止 antd 默认上传
              }}
            >
              <Button icon={<UploadOutlined />}>选择本地图片并上传到IPFS</Button>
            </Upload>
          </Space>
          {coverCid && (
            <div style={{ marginTop: 8, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <img alt="cover" src={`https://ipfs.io/ipfs/${coverCid}`} style={{ width: '100%', display: 'block' }} />
            </div>
          )}
        </Modal>
        {/* 管理员添加/移除 */}
        <Modal
          open={!!adminOpen}
          onCancel={()=> setAdminOpen(null)}
          title={`${adminOpen?.mode === 'add' ? '添加' : '移除'} 管理员 (#${adminOpen?.id ?? ''})`}
          onOk={async ()=>{
            try{
              if (!adminOpen) return
              const section = await resolveGraveSection()
              const method = adminOpen.mode === 'add' ? 'addAdmin' : 'removeAdmin'
              const hash = await signAndSendLocalFromKeystore(section, method, [adminOpen.id, adminAddr.trim()])
              message.success('已提交：'+hash)
              setAdminOpen(null)
            }catch(e:any){ message.error(String(e?.message||e)) }
          }}
        >
          <Input placeholder="管理员地址（SS58）" value={adminAddr} onChange={e=> setAdminAddr(e.target.value)} />
        </Modal>
      </Card>
    </div>
  )
}

export default MyGravesPage


