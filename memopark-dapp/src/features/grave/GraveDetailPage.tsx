import React from 'react'
import { Alert, Button, Card, Divider, Input, InputNumber, List, Space, Tabs, Tag, Typography, message, Modal, Upload, Select } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { buildCallPreimageHex, submitPreimage, submitProposal } from '../governance/lib/governance'
import { uploadToIpfs } from '../../lib/ipfs'
import { signAndSendLocalWithPassword as _s } from '../../lib/polkadot-safe'

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
  // 留言（Message）聚合
  const [messages, setMessages] = React.useState<Array<{ id: number; deceasedId: number; text: string; thumb?: string }>>([])
  // 封面CID与设置弹窗
  const [coverCid, setCoverCid] = React.useState<string>('')
  const [coverErr, setCoverErr] = React.useState('')
  const [coverOpen, setCoverOpen] = React.useState(false)
  const [cidInput, setCidInput] = React.useState('')
  const [pwdInput, setPwdInput] = React.useState('')
  const [coverSubmitting, setCoverSubmitting] = React.useState(false)
  // 创建留言弹窗
  const [msgOpen, setMsgOpen] = React.useState(false)

  // 编辑器弹窗（生平/相册/视频/文章/删除/上传）
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorTab, setEditorTab] = React.useState<'life'|'album'|'video'|'article'|'remove'>('life')
  const [selectedDid, setSelectedDid] = React.useState<number | null>(null)
  const [txPwd, setTxPwd] = React.useState('')
  // 生平
  const [lifeCid, setLifeCid] = React.useState('')
  // 相册与图片
  const [albumTitle, setAlbumTitle] = React.useState('')
  const [albumDesc, setAlbumDesc] = React.useState('')
  const [albumId, setAlbumId] = React.useState<number | null>(null)
  const [photoCid, setPhotoCid] = React.useState('')
  const [photoWidth, setPhotoWidth] = React.useState<number | null>(null)
  const [photoHeight, setPhotoHeight] = React.useState<number | null>(null)
  // 视频集与视频
  const [vcTitle, setVcTitle] = React.useState('')
  const [vcDesc, setVcDesc] = React.useState('')
  const [vcId, setVcId] = React.useState<number | null>(null)
  const [videoUri, setVideoUri] = React.useState('')
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null)
  // 文章
  const [articleAlbumId, setArticleAlbumId] = React.useState<number | null>(null)
  const [articleCid, setArticleCid] = React.useState('')
  const [articleTitle, setArticleTitle] = React.useState('')
  const [articleSummary, setArticleSummary] = React.useState('')
  // 删除
  const [removeDataId, setRemoveDataId] = React.useState<number | null>(null)
  const [deleteAlbumId, setDeleteAlbumId] = React.useState<number | null>(null)
  const [editorSubmitting, setEditorSubmitting] = React.useState(false)

  /**
   * 函数级中文注释：初始化与监听 GraveId 来源
   * - 1) 解析 hash 查询参数 ?gid= 或 ?id=
   * - 2) 兜底读取 localStorage('mp.grave.detailId')
   * - 3) 监听 hashchange，实时响应外部跳转
   */
  React.useEffect(() => {
    const parseFromHash = () => {
      try {
        const h = window.location.hash || ''
        const qIdx = h.indexOf('?')
        if (qIdx >= 0) {
          const qs = new URLSearchParams(h.slice(qIdx + 1))
          const v = qs.get('gid') || qs.get('id')
          if (v != null && v !== '') {
            const n = Number(v)
            if (!Number.isNaN(n)) { setGraveId(n); return true }
          }
        }
      } catch {}
      return false
    }
    const ok = parseFromHash()
    if (!ok) {
      try {
        const v = localStorage.getItem('mp.grave.detailId')
        if (v != null && v !== '') {
          const n = Number(v)
          if (!Number.isNaN(n)) setGraveId(n)
        }
      } catch {}
    }
    const onHash = () => { parseFromHash() }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
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

      // ===== 4) 留言（Message，按整个墓位下所有逝者聚合）
      try {
        const msgIdLists: any[] = await ddq.messagesByDeceased.multi(ids)
        const allMsgIds: number[] = msgIdLists.flatMap((v: any) => (v?.toJSON?.() as any[]) || []).map((x:any)=> Number(x))
        if (allMsgIds.length) {
          const dataQuery: any = ddq.dataOf || ddq.mediaOf
          const msgItems: any[] = dataQuery ? await dataQuery.multi(allMsgIds) : []
          const parsedMsg = msgItems.map((m: any, idx: number) => {
            try {
              // 优先以 toJSON 获取原始字节再解码，避免 toHuman 字段名不一致
              const j: any = m?.toJSON?.() || m
              // kind 可能以字符串或对象形式存在，尽力识别
              const kindVal: any = j?.kind ?? j?.Kind
              const kindStr = typeof kindVal === 'string' ? kindVal : String(kindVal?.__kind || '')
              const isMsg = /message/i.test(kindStr)
              if (!isMsg) return null
              const decodeBytes = (val: any): string => {
                try {
                  if (!val) return ''
                  const u8 = new Uint8Array(val)
                  return new TextDecoder().decode(u8)
                } catch { return '' }
              }
              const uriBytes = j?.uri || j?.Uri
              const thumbBytes = j?.thumbnail_uri || j?.ThumbnailUri
              const text = decodeBytes(uriBytes)
              const thumbStr = decodeBytes(thumbBytes)
              return { id: Number(allMsgIds[idx]), deceasedId: 0, text, thumb: thumbStr }
            } catch { return null }
          }).filter(Boolean) as Array<{ id:number; deceasedId:number; text:string; thumb?:string }>
          setMessages(parsedMsg)
        } else { setMessages([]) }
      } catch { setMessages([]) }
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

  /**
   * 函数级中文注释：解析 deceasedData Pallet 的 tx section 名称（兼容不同命名风格）。
   * - 优先尝试 deceasedData，其次 deceased_data，再次遍历匹配 /deceased[_-]?data/i。
   */
  const resolveDeceasedDataSection = React.useCallback(async (): Promise<string> => {
    try {
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      const candidates = ['deceasedData','deceased_data', ...Object.keys(txRoot)]
      for (const s of candidates) {
        if (txRoot[s]?.addData || txRoot[s]?.createAlbum) return s
      }
    } catch {}
    return 'deceasedData'
  }, [])

  /**
   * 函数级中文注释：工具 - 将字符串按 UTF-8 编码为 Array<number>，用于链上 BoundedVec<u8> 参数。
   */
  const strToBytes = React.useCallback((s: string): number[] => Array.from(new TextEncoder().encode(s || '')), [])

  /**
   * 函数级中文注释：当逝者列表变化时，自动选择第一个作为默认编辑目标，便于快速编辑。
   */
  React.useEffect(() => {
    try {
      if (deceased.length > 0) {
        if (selectedDid == null) setSelectedDid(Number(deceased[0].id))
      } else {
        setSelectedDid(null)
      }
    } catch {}
  }, [deceased, selectedDid])

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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            { key:'deceased', label:'逝者信息' },
            { key:'album', label:'相册' },
            { key:'video', label:'视频' },
            { key:'life', label:'生平' },
            { key:'article', label:'追忆文章' },
          ]} />
          <Button size="small" type="primary" onClick={()=> setEditorOpen(true)}>编辑</Button>
        </div>

        {activeTab === 'deceased' && (
          <>
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
            {/* 留言列表 + 右侧创建按钮 */}
            <Card size="small" style={{ marginTop: 12 }} title={
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>留言列表</span>
                <Button size="small" type="primary" onClick={()=> setMsgOpen(true)}>创建留言</Button>
              </div>
            }>
              <List
                bordered
                dataSource={messages}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: '暂无留言' }}
                renderItem={(it)=> (
                  <List.Item>
                    <Space direction="vertical" style={{ width:'100%' }} size={4}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <Typography.Text type="secondary">#{it.id}</Typography.Text>
                        {it.thumb && String(it.thumb).length>8 && (
                          <img alt="thumb" src={`https://ipfs.io/ipfs/${String(it.thumb).replace(/^ipfs:\/\//i,'')}`} style={{ width: 48, height: 48, objectFit:'cover', borderRadius: 6, border:'1px solid #eee' }} />
                        )}
                      </div>
                      <Typography.Paragraph style={{ marginBottom: 0 }}>{it.text}</Typography.Paragraph>
                    </Space>
                  </List.Item>
                )}
              />
              <Alert type="info" showIcon style={{ marginTop: 8 }} message="说明" description="留言作为 Message 类型写入链上（可退押金/可投诉），支持可选缩略图 CID。" />
            </Card>
            <Modal open={msgOpen} title="创建留言" onCancel={()=> setMsgOpen(false)} footer={null} centered>
              <CreateMessageInline
                deceasedList={deceased}
                graveId={graveId}
                onSubmitted={async ()=> { try { setMsgOpen(false); if (graveId!=null) await loadAll(graveId) } catch {} }}
              />
            </Modal>
          </>
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
      {/* 编辑器弹窗：生平/相册/视频/文章/删除/上传 */}
      <Modal
        open={editorOpen}
        title="编辑内容（生平/相册/视频/文章）"
        onCancel={()=> { setEditorOpen(false); setEditorSubmitting(false) }}
        footer={null}
        centered
      >
        {/* 全局控制区：选择逝者与签名密码 */}
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, marginRight: 8 }}>
              <Select
                style={{ width: '100%' }}
                placeholder="选择逝者"
                value={selectedDid as any}
                onChange={(v)=> setSelectedDid(Number(v))}
                options={deceased.map(d=> ({ label: `#${d.id} ${d.name || ''}`, value: d.id }))}
              />
            </div>
            <div style={{ width: 180 }}>
              <Input.Password placeholder="签名密码（≥8位）" value={txPwd} onChange={e=> setTxPwd(e.target.value)} />
            </div>
          </Space>

          <Tabs activeKey={editorTab} onChange={(k)=> setEditorTab(k as any)} items={[
            { key: 'life', label: '生平' },
            { key: 'album', label: '相册/图片' },
            { key: 'video', label: '视频/音频' },
            { key: 'article', label: '追忆文章' },
            { key: 'remove', label: '删除' },
          ]} />

          {editorTab === 'life' && (
            <Card size="small" title="生平（IPFS CID）">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input placeholder="生平 CID（如 Qm... 或 bafy...）" value={lifeCid} onChange={e=> setLifeCid(e.target.value)} />
                <Space>
                  <Button
                    type="primary"
                    loading={editorSubmitting}
                    onClick={async ()=>{
                      try {
                        if (selectedDid==null) return message.warning('请选择逝者')
                        if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                        if (!lifeCid) return message.warning('请填写生平 CID')
                        setEditorSubmitting(true)
                        const section = await resolveDeceasedDataSection()
                        const did = Number(selectedDid)
                        // 优先尝试 update_life，若失败再回退 create_life
                        const bytes = strToBytes(lifeCid)
                        try {
                          const h = await signAndSendLocalWithPassword(section, 'updateLife', [did, bytes], txPwd)
                          message.success('已提交更新生平：'+h)
                        } catch (e:any) {
                          const h2 = await signAndSendLocalWithPassword(section, 'createLife', [did, bytes], txPwd)
                          message.success('已提交创建生平：'+h2)
                        }
                        if (graveId!=null) await loadAll(graveId)
                      } catch (e:any) {
                        message.error(e?.message || '提交失败')
                      } finally { setEditorSubmitting(false) }
                    }}
                  >创建/更新</Button>
                </Space>
              </Space>
            </Card>
          )}

          {editorTab === 'album' && (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Card size="small" title="创建相册">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input placeholder="标题" value={albumTitle} onChange={e=> setAlbumTitle(e.target.value)} />
                  <Input.TextArea placeholder="描述" rows={2} value={albumDesc} onChange={e=> setAlbumDesc(e.target.value)} />
                  <Button type="primary" loading={editorSubmitting} onClick={async ()=>{
                    try {
                      if (selectedDid==null) return message.warning('请选择逝者')
                      if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                      if (!albumTitle) return message.warning('请填写标题')
                      const section = await resolveDeceasedDataSection()
                      setEditorSubmitting(true)
                      const did = Number(selectedDid)
                      const h = await signAndSendLocalWithPassword(section, 'createAlbum', [did, strToBytes(albumTitle), strToBytes(albumDesc||''), 0, []], txPwd)
                      message.success('已提交创建相册：'+h)
                      setAlbumTitle(''); setAlbumDesc('')
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>创建相册</Button>
                </Space>
              </Card>
              <Card size="small" title="添加图片到相册">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <InputNumber placeholder="相册ID" value={albumId as any} onChange={(v)=> setAlbumId((v as any) ?? null)} style={{ width: '100%' }} />
                  <Input placeholder="图片 CID（ipfs）" value={photoCid} onChange={e=> setPhotoCid(e.target.value)} />
                  <Space>
                    <InputNumber placeholder="宽" value={photoWidth as any} onChange={(v)=> setPhotoWidth((v as any) ?? null)} />
                    <InputNumber placeholder="高" value={photoHeight as any} onChange={(v)=> setPhotoHeight((v as any) ?? null)} />
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={async (file)=>{
                        try {
                          message.loading({ key: 'up-photo', content: '正在上传到 IPFS…' })
                          const cid = await uploadToIpfs(file as any)
                          setPhotoCid(cid)
                          message.success({ key: 'up-photo', content: '已上传：'+cid })
                        } catch(e:any) { message.error({ key: 'up-photo', content: e?.message || '上传失败' }) }
                        return false
                      }}
                    >
                      <Button>选择文件上传</Button>
                    </Upload>
                  </Space>
                  <Button type="primary" loading={editorSubmitting} onClick={async ()=>{
                    try {
                      if (selectedDid==null) return message.warning('请选择逝者')
                      if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                      if (albumId==null) return message.warning('请输入相册ID')
                      if (!photoCid) return message.warning('请填写或上传图片 CID')
                      setEditorSubmitting(true)
                      const section = await resolveDeceasedDataSection()
                      const bytes = strToBytes(photoCid)
                      const w = photoWidth==null? null : Number(photoWidth)
                      const h = photoHeight==null? null : Number(photoHeight)
                      const hsh = null
                      const txh = await signAndSendLocalWithPassword(section, 'addData', [0, Number(albumId), 0, bytes, null, hsh, null, null, null, w, h, null], txPwd)
                      message.success('已提交添加图片：'+txh)
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>添加图片</Button>
                </Space>
              </Card>
            </Space>
          )}

          {editorTab === 'video' && (
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Card size="small" title="创建视频集">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input placeholder="标题" value={vcTitle} onChange={e=> setVcTitle(e.target.value)} />
                  <Input.TextArea placeholder="描述" rows={2} value={vcDesc} onChange={e=> setVcDesc(e.target.value)} />
                  <Button type="primary" loading={editorSubmitting} onClick={async ()=>{
                    try {
                      if (selectedDid==null) return message.warning('请选择逝者')
                      if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                      if (!vcTitle) return message.warning('请填写标题')
                      setEditorSubmitting(true)
                      const section = await resolveDeceasedDataSection()
                      const did = Number(selectedDid)
                      const h = await signAndSendLocalWithPassword(section, 'createVideoCollection', [did, strToBytes(vcTitle), strToBytes(vcDesc||''), []], txPwd)
                      message.success('已提交创建视频集：'+h)
                      setVcTitle(''); setVcDesc('')
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>创建视频集</Button>
                </Space>
              </Card>
              <Card size="small" title="添加视频到视频集">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <InputNumber placeholder="视频集ID" value={vcId as any} onChange={(v)=> setVcId((v as any) ?? null)} style={{ width: '100%' }} />
                  <Input placeholder="视频 URI（如 ipfs://CID 或 https://...）" value={videoUri} onChange={e=> setVideoUri(e.target.value)} />
                  <InputNumber placeholder="时长（秒，可选）" value={videoDuration as any} onChange={(v)=> setVideoDuration((v as any) ?? null)} style={{ width: '100%' }} />
                  <Button type="primary" loading={editorSubmitting} onClick={async ()=>{
                    try {
                      if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                      if (vcId==null) return message.warning('请输入视频集ID')
                      if (!videoUri) return message.warning('请填写视频URI')
                      setEditorSubmitting(true)
                      const section = await resolveDeceasedDataSection()
                      const txh = await signAndSendLocalWithPassword(section, 'addData', [1, Number(vcId), 1, strToBytes(videoUri), null, null, null, null, videoDuration==null? null:Number(videoDuration), null, null, null], txPwd)
                      message.success('已提交添加视频：'+txh)
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>添加视频</Button>
                </Space>
              </Card>
            </Space>
          )}

          {editorTab === 'article' && (
            <Card size="small" title="添加追忆文章（需提供正文CID与可选标题/摘要）">
              <Space direction="vertical" style={{ width: '100%' }}>
                <InputNumber placeholder="相册ID（文章归属相册）" value={articleAlbumId as any} onChange={(v)=> setArticleAlbumId((v as any) ?? null)} style={{ width: '100%' }} />
                <Input placeholder="文章正文 CID（ipfs）" value={articleCid} onChange={e=> setArticleCid(e.target.value)} />
                <Input placeholder="标题（可选）" value={articleTitle} onChange={e=> setArticleTitle(e.target.value)} />
                <Input.TextArea placeholder="摘要（可选）" rows={2} value={articleSummary} onChange={e=> setArticleSummary(e.target.value)} />
                <Space>
                  <Upload accept="text/*,application/json" showUploadList={false} beforeUpload={async (file)=>{
                    try { message.loading({ key:'up-article', content:'正在上传到 IPFS…' }); const cid = await uploadToIpfs(file as any); setArticleCid(cid); message.success({ key:'up-article', content:'已上传：'+cid }) } catch(e:any) { message.error({ key:'up-article', content: e?.message || '上传失败' }) } return false
                  }}>
                    <Button>选择文件上传</Button>
                  </Upload>
                </Space>
                <Button type="primary" loading={editorSubmitting} onClick={async ()=>{
                  try {
                    if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                    if (articleAlbumId==null) return message.warning('请输入相册ID')
                    if (!articleCid) return message.warning('请填写文章正文 CID')
                    setEditorSubmitting(true)
                    const section = await resolveDeceasedDataSection()
                    const bytes = strToBytes(articleCid)
                    // 文章需要 content_hash 为 Some，这里占位 32 字节零值（后续可替换为 blake2_256(cid)）
                    const zero32 = new Array(32).fill(0)
                    const txh = await signAndSendLocalWithPassword(section, 'addData', [0, Number(articleAlbumId), 3, bytes, null, zero32, articleTitle? strToBytes(articleTitle): null, articleSummary? strToBytes(articleSummary): null, null, null, null, null], txPwd)
                    message.success('已提交添加文章：'+txh)
                    if (graveId!=null) await loadAll(graveId)
                  } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                }}>添加文章</Button>
              </Space>
            </Card>
          )}

          {editorTab === 'remove' && (
            <Card size="small" title="删除（媒体或相册）">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <InputNumber placeholder="媒体ID（DataId）" value={removeDataId as any} onChange={(v)=> setRemoveDataId((v as any) ?? null)} />
                  <Button danger loading={editorSubmitting} onClick={async ()=>{
                    try {
                      if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                      if (removeDataId==null) return message.warning('请输入媒体ID')
                      setEditorSubmitting(true)
                      const section = await resolveDeceasedDataSection()
                      const h = await signAndSendLocalWithPassword(section, 'removeData', [Number(removeDataId)], txPwd)
                      message.success('已提交删除媒体：'+h)
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>删除媒体</Button>
                </Space>
                <Space>
                  <InputNumber placeholder="相册ID" value={deleteAlbumId as any} onChange={(v)=> setDeleteAlbumId((v as any) ?? null)} />
                  <Button danger loading={editorSubmitting} onClick={async ()=>{
                    try {
                      if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                      if (deleteAlbumId==null) return message.warning('请输入相册ID')
                      setEditorSubmitting(true)
                      const section = await resolveDeceasedDataSection()
                      const h = await signAndSendLocalWithPassword(section, 'deleteAlbum', [Number(deleteAlbumId)], txPwd)
                      message.success('已提交删除相册：'+h)
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>删除相册</Button>
                </Space>
              </Space>
            </Card>
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


/**
 * 函数级详细中文注释：内联“创建留言”组件（Message 类型）
 * - container_kind=2（未分类，按 deceased_id 聚合）；container_id=Some(deceased_id)
 * - kind=4（Message）；uri 为 UTF-8 字节；thumbnail_uri 可选；其他均为 None
 * - 所有交易均使用本地密码签名 `signAndSendLocalWithPassword`
 */
const CreateMessageInline: React.FC<{
  deceasedList: Array<{ id: number; name?: string }>
  graveId: number | null
  onSubmitted?: ()=> void
}> = ({ deceasedList, onSubmitted }) => {
  const [did, setDid] = React.useState<number | null>(deceasedList?.[0]?.id ?? null)
  const [text, setText] = React.useState('')
  const [thumbCid, setThumbCid] = React.useState('')
  const [pwd, setPwd] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const strToBytes = React.useCallback((s: string): number[] => Array.from(new TextEncoder().encode(String(s || ''))), [])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      <Space style={{ width: '100%' }}>
        <Select
          style={{ flex: 1 }}
          placeholder="选择逝者"
          value={did as any}
          onChange={(v)=> setDid(Number(v))}
          options={(deceasedList||[]).map(d=> ({ value: d.id, label: `#${d.id}${d.name? ' · '+d.name: ''}` }))}
        />
        <Input.Password placeholder="签名密码（≥8位）" value={pwd} onChange={e=> setPwd(e.target.value)} style={{ width: 200 }} />
      </Space>
      <Input.TextArea rows={3} maxLength={500} placeholder="留言内容（必填）" value={text} onChange={e=> setText(e.target.value)} />
      <Space>
        <Input placeholder="缩略图 CID（可选）" value={thumbCid} onChange={e=> setThumbCid(e.target.value)} style={{ flex: 1 }} />
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={async (file)=>{
            try { message.loading({ key:'up-msg-thumb', content:'正在上传缩略图…' }); const cid = await uploadToIpfs(file as any); setThumbCid(cid); message.success({ key:'up-msg-thumb', content: '已上传：'+cid }) } catch(e:any) { message.error({ key:'up-msg-thumb', content: e?.message || '上传失败' }) } return false
          }}
        >
          <Button>上传缩略图</Button>
        </Upload>
      </Space>
      <Button type="primary" loading={loading} onClick={async ()=>{
        try {
          if (did==null) return message.warning('请选择逝者')
          if (!pwd || pwd.length<8) return message.warning('请输入至少 8 位签名密码')
          if (!text || !text.trim()) return message.warning('请填写留言内容')
          setLoading(true)
          const section = 'deceasedData'
          const args = [2, Number(did), 4, strToBytes(text), thumbCid? strToBytes(thumbCid): null, null, null, null, null, null, null, null]
          const h = await _s(section, 'addData', args as any, pwd)
          message.success('已提交留言：'+h)
          setText(''); setThumbCid('')
          onSubmitted && onSubmitted()
        } catch(e:any) { message.error(e?.message || '提交失败') } finally { setLoading(false) }
      }}>提交留言</Button>
    </Space>
  )
}

