import React from 'react'
import { Alert, Button, Card, Divider, Input, InputNumber, List, Space, Tabs, Tag, Typography, message, Modal } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { buildCallPreimageHex, submitPreimage, submitProposal } from '../governance/lib/governance'

/**
 * 函数级详细中文注释：墓地详情页（移动端）
 * - 内容分区：逝者信息、相册、视频、生平、追忆文章
 * - 数据来源：
 *   1) 墓地详情：pallet-memo-grave → Graves, SlugOf
 *   2) 逝者列表：pallet-deceased → DeceasedByGrave, DeceasedOf
 *   3) 媒体与生平：pallet-deceased-data → albumsByDeceased, mediaByAlbum, mediaOf
 * - 交互：顶部输入 GraveId 或从其它页面传入 localStorage('mp.grave.detailId')
 * - 性能：小规模遍历（基于 nextId 的直接索引），后续可由 Subsquid 聚合替代
 */
const GraveDetailPage: React.FC = () => {
  const { current } = useWallet()
  const [graveId, setGraveId] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [activeTab, setActiveTab] = React.useState<string>('deceased')

  // 墓地信息
  const [graveInfo, setGraveInfo] = React.useState<{ id: number; owner?: string; parkId?: number|null; name?: string; slug?: string; active?: boolean; isPublic?: boolean } | null>(null)
  // 逝者列表
  const [deceased, setDeceased] = React.useState<Array<{ id: number; name?: string; nameBadge?: string; gender?: string; genderCode?: number; birth?: string|null; death?: string|null; token?: string; links?: string[]; nameFullCid?: string|null }>>([])
  // 选中逝者详情弹窗
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailItem, setDetailItem] = React.useState<null | { id: number; name?: string; nameBadge?: string; gender?: string; genderCode?: number; birth?: string|null; death?: string|null; token?: string; links?: string[]; nameFullCid?: string|null }>(null)
  // 聚合媒体（相册/视频/文章）
  const [albums, setAlbums] = React.useState<Array<{ albumId: number; mediaIds: number[] }>>([])
  const [videos, setVideos] = React.useState<Array<{ id: string; title?: string; uri?: string }>>([])
  const [articles, setArticles] = React.useState<Array<{ id: string; title?: string; summary?: string; uri?: string }>>([])
  // 封面CID与设置弹窗
  const [coverCid, setCoverCid] = React.useState<string>('')
  const [coverErr, setCoverErr] = React.useState('')
  const [coverOpen, setCoverOpen] = React.useState(false)
  const [cidInput, setCidInput] = React.useState('')
  const [pwdInput, setPwdInput] = React.useState('')
  const [coverSubmitting, setCoverSubmitting] = React.useState(false)

  /**
   * 函数级中文注释：初始化 GraveId
   * - 优先读取 localStorage('mp.grave.detailId')；若存在则设置并触发加载
   */
  React.useEffect(() => {
    try {
      const v = localStorage.getItem('mp.grave.detailId')
      if (v != null && v !== '') {
        const n = Number(v)
        if (!Number.isNaN(n)) setGraveId(n)
      }
    } catch {}
  }, [])

  /**
   * 函数级中文注释：解析 BoundedVec/Option<U8> 到字符串（UTF-8）
   */
  const toStringFromAny = (x: any): string | undefined => {
    try {
      if (!x) return undefined
      if (x.toU8a) return new TextDecoder().decode(x.toU8a())
      if (x.isSome && x.unwrap) return new TextDecoder().decode(x.unwrap().toU8a ? x.unwrap().toU8a() : new Uint8Array([]))
      if (x.toJSON) {
        const u8 = new Uint8Array(x.toJSON())
        return new TextDecoder().decode(u8)
      }
      return String(x)
    } catch { return undefined }
  }

  /**
   * 函数级中文注释：加载墓地详情、逝者与媒体（相册/视频/文章，聚合预览）
   */
  const loadAll = React.useCallback(async (gid: number) => {
    setLoading(true); setErr('')
    try {
      const api = await getApi()
      // ===== 1) grave 信息（动态 section 适配）
      const queryRoot: any = (api.query as any)
      let gq: any = queryRoot.memo_grave || queryRoot.memoGrave || queryRoot.grave
      if (!gq) {
        const foundKey = Object.keys(queryRoot).find(k => /memo[_-]?grave/i.test(k) || /^grave$/i.test(k))
        if (foundKey) gq = queryRoot[foundKey]
      }
      if (!gq?.graves) throw new Error('未找到 grave 存储')
      const gOpt = await gq.graves(gid)
      if (!gOpt || !gOpt.isSome) { setGraveInfo(null); setDeceased([]); setAlbums([]); setVideos([]); setArticles([]); setErr('墓地不存在'); setLoading(false); return }
      const g = gOpt.unwrap()
      const owner = g.owner?.toString?.() || String(g.owner)
      const parkId = g.parkId?.isSome ? g.parkId.unwrap().toNumber() : null
      const name = toStringFromAny(g.name)
      let slug: string | undefined = undefined
      try { const s = await (gq.slugOf? gq.slugOf(gid) : null); if (s && s.isSome) slug = toStringFromAny(s.unwrap()) } catch {}
      let active: boolean | undefined = undefined
      let isPublic: boolean | undefined = undefined
      try { active = Boolean((g as any).active?.isTrue ? (g as any).active.isTrue : (g as any).active) } catch {}
      try { isPublic = Boolean((g as any).isPublic?.isTrue ? (g as any).isPublic.isTrue : (g as any).isPublic ?? (g as any).is_public) } catch {}
      setGraveInfo({ id: gid, owner, parkId, name, slug, active, isPublic })
      // 读取封面CID（可选）
      try {
        const cv: any = await (gq.coverCidOf ? gq.coverCidOf(gid) : null)
        if (cv && cv.isSome) {
          const u8 = cv.unwrap().toU8a ? cv.unwrap().toU8a() : new Uint8Array([])
          setCoverCid(new TextDecoder().decode(u8))
        } else { setCoverCid('') }
      } catch { setCoverCid('') }

      // ===== 2) deceased 列表
      const dq: any = (api.query as any).deceased
      const listAny: any = await dq.deceasedByGrave(gid)
      const ids: any[] = Array.isArray(listAny) ? listAny as any : ((listAny?.toJSON?.() as any[]) || [])
      if (!ids.length) { setDeceased([]); setAlbums([]); setVideos([]); setArticles([]); setLoading(false); return }
      const details: any[] = await dq.deceasedOf.multi(ids)
      const parsed = details.map((raw, idx) => {
        try {
          const d: any = (raw && raw.isSome && raw.unwrap) ? raw.unwrap() : raw
          const idNum = (ids[idx]?.toString ? Number(ids[idx].toString()) : Number(ids[idx]))
          const name = toStringFromAny(d.name)
          const badge = toStringFromAny(d.name_badge || d.nameBadge)
          const genderEnum = String((d.gender?.toJSON?.() || d.gender || '')).toUpperCase()
          const gender = /M/.test(genderEnum) ? '男' : /F/.test(genderEnum) ? '女' : '保密'
          const genderCode = /M/.test(genderEnum) ? 0 : /F/.test(genderEnum) ? 1 : 2
          const birth = toStringFromAny(d.birth_ts || d.birthTs) || null
          const death = toStringFromAny(d.death_ts || d.deathTs) || null
          const token = toStringFromAny(d.deceased_token || d.deceasedToken)
          const linksArr = (d.links?.toJSON?.() as any[]) || []
          const links = linksArr.map((u8: any) => {
            try { return new TextDecoder().decode(new Uint8Array(u8)) } catch { return '' }
          }).filter(Boolean)
          const nameFullCid = toStringFromAny(d.name_full_cid || d.nameFullCid) || null
          return { id: idNum, name, nameBadge: badge, gender, genderCode, birth, death, token, links, nameFullCid }
        } catch { return null }
      }).filter(Boolean) as any[]
      setDeceased(parsed)

      // ===== 3) 聚合媒体（按每位逝者 → 相册 → 媒体）
      const ddq: any = (api.query as any).deceasedData
      const albumIdLists: any[] = await ddq.albumsByDeceased.multi(ids)
      const allAlbumIds: number[] = albumIdLists.flatMap((v: any) => (v?.toJSON?.() as any[]) || [])
      const mediaIdLists: any[] = allAlbumIds.length ? await ddq.mediaByAlbum.multi(allAlbumIds) : []
      const grouped = allAlbumIds.map((aid: any, idx: number) => ({ albumId: Number(aid), mediaIds: ((mediaIdLists[idx]?.toJSON?.() as any[]) || []).map((x:any)=> Number(x)) }))
      setAlbums(grouped)
      const allMediaIds: number[] = grouped.flatMap(g => g.mediaIds)
      if (!allMediaIds.length) { setVideos([]); setArticles([]); setLoading(false); return }
      const media: any[] = await ddq.mediaOf.multi(allMediaIds)
      // 解析 kind/title/summary/uri（兼容 toHuman）
      const videoList: Array<{ id: string; title?: string; uri?: string }> = []
      const articleList: Array<{ id: string; title?: string; summary?: string; uri?: string }> = []
      media.forEach((m: any, idx: number) => {
        try {
          const idStr = String(allMediaIds[idx])
          const human: any = m?.toHuman?.() || m?.toJSON?.() || m
          const kindStr: string = String(human?.kind ?? human?.Kind ?? human?.kind?.__kind ?? '')
          const title = human?.title || human?.Title || ''
          const summary = human?.summary || human?.Summary || ''
          const uri = human?.uri || human?.Uri || ''
          if (/Video/i.test(kindStr)) videoList.push({ id: idStr, title, uri })
          else if (/Article/i.test(kindStr)) articleList.push({ id: idStr, title, summary, uri })
        } catch {}
      })
      setVideos(videoList)
      setArticles(articleList)
    } catch (e: any) {
      setErr(e?.message || '加载失败')
      setGraveInfo(null); setDeceased([]); setAlbums([]); setVideos([]); setArticles([])
    } finally { setLoading(false) }
  }, [])

  React.useEffect(() => { if (graveId != null) loadAll(graveId) }, [graveId, loadAll])

  // 动态解析 grave tx section（兼容 memoGrave/memo_grave/grave）
  const resolveGraveSection = React.useCallback(async (): Promise<string> => {
    try {
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['memoGrave','memo_grave','grave', ...Object.keys(txRoot)]
      for (const s of candidates) { if (txRoot[s]?.setCover || txRoot[s]?.setCoverViaGovernance) return s }
    } catch {}
    return 'grave'
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      {/* 顶部栏 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', padding: '8px 8px 0 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
          <Typography.Title level={4} style={{ margin: 0 }}>墓地详情</Typography.Title>
          <Space>
            <InputNumber min={0} value={graveId as any} onChange={(v)=> setGraveId((v as any) ?? null)} placeholder="Grave ID" style={{ width: 120 }} />
            <Button size="small" onClick={()=> { if (graveId!=null) loadAll(graveId) }} loading={loading}>加载</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {/* 封面展示与操作 */}
        <Card size="small" title="墓地封面" style={{ marginBottom: 12 }}>
          {coverCid ? (
            <div style={{ width: '100%', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <img src={`https://ipfs.io/ipfs/${coverCid}`} alt="cover" style={{ width: '100%', display: 'block' }} />
            </div>
          ) : (
            <Alert type="info" showIcon message="尚未设置封面" />
          )}
          <div style={{ marginTop: 8 }}>
            <Space>
              <Button size="small" onClick={()=> { setCidInput(coverCid||''); setCoverOpen(true) }}>设置/提议封面</Button>
            </Space>
          </div>
          {coverErr && <Alert type="error" showIcon message={coverErr} style={{ marginTop: 8 }} />}
        </Card>
        {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 8 }} />}
        {graveInfo && (
          <Card size="small" title={`#${graveInfo.id} ${graveInfo.name || ''}`} extra={<Space>
            {typeof graveInfo.active === 'boolean' && <Tag color={graveInfo.active? 'blue':'default'}>{graveInfo.active? 'active':'inactive'}</Tag>}
            {typeof graveInfo.isPublic === 'boolean' && <Tag color={graveInfo.isPublic? 'gold':'default'}>{graveInfo.isPublic? 'public':'private'}</Tag>}
          </Space>}>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {graveInfo.slug && <div><Typography.Text type="secondary">Slug：</Typography.Text><Typography.Text code>{graveInfo.slug}</Typography.Text></div>}
              {graveInfo.parkId!=null && <div><Typography.Text type="secondary">园区：</Typography.Text><span>{graveInfo.parkId}</span></div>}
              {graveInfo.owner && <div><Typography.Text type="secondary">墓主：</Typography.Text><Typography.Text code>{graveInfo.owner}</Typography.Text></div>}
            </Space>
          </Card>
        )}

        <Divider style={{ margin: '12px 0' }} />

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key:'deceased', label:'逝者信息' },
          { key:'album', label:'相册' },
          { key:'video', label:'视频' },
          { key:'life', label:'生平' },
          { key:'article', label:'追忆文章' },
        ]} />

        {activeTab === 'deceased' && (
          <List
            bordered
            loading={loading}
            dataSource={deceased}
            locale={{ emptyText: '暂无逝者' }}
            renderItem={(it)=> (
              <List.Item onClick={()=> { setDetailItem(it as any); setDetailOpen(true) }} style={{ cursor: 'pointer' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Typography.Text strong>#{it.id}</Typography.Text>
                    {it.name && <Tag color="green">{it.name}</Tag>}
                    {it.nameBadge && <Tag>{it.nameBadge}</Tag>}
                    {it.gender && <Tag color="blue">{it.gender}</Tag>}
                  </Space>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {it.birth && <span style={{ marginRight: 12 }}>出生：{it.birth}</span>}
                    {it.death && <span>离世：{it.death}</span>}
                  </div>
                  {it.token && <div><Typography.Text type="secondary">Token：</Typography.Text><Typography.Text code>{it.token}</Typography.Text></div>}
                  {it.links && it.links.length>0 && (
                    <div>
                      <Typography.Text type="secondary">链接：</Typography.Text>
                      <Space wrap>
                        {it.links.map((u,idx)=> <Typography.Text key={idx} code>{u}</Typography.Text>)}
                      </Space>
                    </div>
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}

        {activeTab === 'album' && (
          <List
            bordered
            loading={loading}
            dataSource={albums}
            locale={{ emptyText: '暂无相册' }}
            renderItem={(it)=> (
              <List.Item>
                <Space direction="vertical">
                  <Space>
                    <Typography.Text strong>相册ID：</Typography.Text>
                    <Typography.Text code>{it.albumId}</Typography.Text>
                  </Space>
                  <div style={{ fontSize: 12, color: '#666' }}>媒体数：{it.mediaIds.length}</div>
                </Space>
              </List.Item>
            )}
          />
        )}

        {activeTab === 'video' && (
          <List
            bordered
            loading={loading}
            dataSource={videos}
            locale={{ emptyText: '暂无视频' }}
            renderItem={(it)=> (
              <List.Item actions={it.uri? [<Button key="open" type="link" onClick={()=> message.info('请在后续版本中打开外部播放器')}>打开</Button>]: undefined}>
                <List.Item.Meta
                  title={<Space><Tag color="purple">Video</Tag><Typography.Text strong>{it.title || '(未命名视频)'}</Typography.Text></Space>}
                  description={it.uri && (<div>URI：<Typography.Text code>{it.uri}</Typography.Text></div>)}
                />
              </List.Item>
            )}
          />
        )}

        {activeTab === 'life' && (
          <Card size="small" title="生平（概览）" loading={loading}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              生平详情将接入 `deceased-data` 的专属 Life 模块或采用文章富文本呈现。当前展示逝者 token 与日期作为概览。
            </Typography.Paragraph>
            {deceased.length === 0 ? (
              <Typography.Text type="secondary">暂无逝者</Typography.Text>
            ) : (
              <List
                dataSource={deceased}
                renderItem={(it)=> (
                  <List.Item>
                    <Space direction="vertical">
                      <Space>
                        <Typography.Text strong>{it.name || '(未命名)'}</Typography.Text>
                        {it.gender && <Tag>{it.gender}</Tag>}
                      </Space>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {it.birth && <span style={{ marginRight: 12 }}>出生：{it.birth}</span>}
                        {it.death && <span>离世：{it.death}</span>}
                      </div>
                      {it.token && <div><Typography.Text type="secondary">Token：</Typography.Text><Typography.Text code>{it.token}</Typography.Text></div>}
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        )}

        {activeTab === 'article' && (
          <List
            bordered
            loading={loading}
            dataSource={articles}
            locale={{ emptyText: '暂无文章' }}
            renderItem={(it)=> (
              <List.Item actions={it.uri? [<Button key="open" type="link" onClick={()=> message.info('请在后续版本中打开文章详情')}>查看</Button>]: undefined}>
                <List.Item.Meta
                  title={<Space><Tag color="blue">Article</Tag><Typography.Text strong>{it.title || '(未命名文章)'}</Typography.Text></Space>}
                  description={
                    <div>
                      {it.summary && <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>{it.summary}</Typography.Paragraph>}
                      {it.uri && <div>URI：<Typography.Text code>{it.uri}</Typography.Text></div>}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
      {/* 封面设置/提议弹窗 */}
      <Modal
        open={coverOpen}
        onCancel={()=> { setCoverOpen(false); setCidInput(''); setPwdInput(''); setCoverErr('') }}
        title="设置或提议设置封面"
        okText="提交"
        cancelText="取消"
        confirmLoading={coverSubmitting}
        onOk={async ()=>{
          try {
            if (graveId==null) return
            if (!cidInput) { message.warning('请填写 CID'); return }
            if (!pwdInput || pwdInput.length < 8) { message.warning('请输入至少 8 位签名密码'); return }
            setCoverSubmitting(true); setCoverErr('')
            const section = await resolveGraveSection()
            const bytes = Array.from(new TextEncoder().encode(cidInput))
            const isOwner = current && graveInfo?.owner && String(current) === String(graveInfo.owner)
            if (isOwner) {
              const hash = await signAndSendLocalWithPassword(section, 'setCover', [Number(graveId), bytes], pwdInput)
              message.success('封面已提交：'+hash)
            } else {
              // 治理提议路径：构建并提交预映像与提案（尽力而为，兼容占位）
              const pre = await buildCallPreimageHex(section, 'setCoverViaGovernance', [Number(graveId), bytes])
              const prepared = await submitPreimage(pre.hex, pwdInput)
              const txh = await submitProposal(0, prepared, pwdInput, { origin: 'Content', enactmentAfter: 0 })
              message.success('已提交治理提案：'+txh)
            }
            setCoverOpen(false); setPwdInput(''); setCidInput('')
            try { if (graveId!=null) await loadAll(graveId) } catch {}
          } catch (e: any) {
            setCoverErr(e?.message || '提交失败')
          } finally { setCoverSubmitting(false) }
        }}
        centered
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input placeholder="封面 CID（ipfs://CID 的 CID 部分）" value={cidInput} onChange={e=> setCidInput(e.target.value)} />
          <Input.Password placeholder="签名密码（至少 8 位）" value={pwdInput} onChange={e=> setPwdInput(e.target.value)} />
          {cidInput && (
            <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <img src={`https://ipfs.io/ipfs/${cidInput}`} alt="preview" style={{ width: '100%', display: 'block' }} />
            </div>
          )}
        </Space>
      </Modal>
      {/* 逝者详情弹窗：展示创建时填写的信息 */}
      <Modal
        open={detailOpen}
        title={detailItem ? `逝者详情（#${detailItem.id}）` : '逝者详情'}
        onCancel={()=> { setDetailOpen(false); setDetailItem(null) }}
        footer={<Button type="primary" onClick={()=> { setDetailOpen(false); }}>关闭</Button>}
        centered
      >
        {detailItem ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div><Typography.Text type="secondary">姓名：</Typography.Text>{detailItem.name || '-'}</div>
            <div><Typography.Text type="secondary">姓名徽标：</Typography.Text>{detailItem.nameBadge || '-'}</div>
            <div><Typography.Text type="secondary">性别：</Typography.Text>{detailItem.gender || '-'}<Typography.Text type="secondary" style={{ marginLeft: 8 }}>(code: {detailItem.genderCode ?? '-'})</Typography.Text></div>
            <div>
              <Typography.Text type="secondary">出生/离世：</Typography.Text>
              {detailItem.birth || '-'} {detailItem.death ? ` / ${detailItem.death}` : ''}
            </div>
            <div><Typography.Text type="secondary">完整姓名CID：</Typography.Text>{detailItem.nameFullCid || '-'}</div>
            <div>
              <Typography.Text type="secondary">外部链接：</Typography.Text>
              {detailItem.links && detailItem.links.length>0 ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {detailItem.links.map((u, i)=> <Typography.Text key={i} code>{u}</Typography.Text>)}
                </Space>
              ) : ('-')}
            </div>
            <div>
              <Typography.Text type="secondary">逝者Token：</Typography.Text>
              <Typography.Text code copyable>{detailItem.token || '-'}</Typography.Text>
            </div>
            {graveId!=null && <div><Typography.Text type="secondary">所属墓位ID：</Typography.Text>{graveId}</div>}
          </Space>
        ) : null}
      </Modal>
    </div>
  )
}

export default GraveDetailPage


