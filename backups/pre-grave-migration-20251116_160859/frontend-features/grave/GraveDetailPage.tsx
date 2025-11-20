import React from 'react'
import { Alert, Button, Card, Divider, Input, InputNumber, List, Space, Tabs, Tag, Typography, message, Modal, Upload, Select } from 'antd'
import './GraveDetailPage.css'
import GraveAudioPlayer from './GraveAudioPlayer'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { buildCallPreimageHex, submitPreimage, submitProposal } from '../governance/lib/governance'
import { uploadToIpfs } from '../../lib/ipfs'
import { signAndSendLocalWithPassword as _s } from '../../lib/polkadot-safe'
import OwnerChangeLogInline from './components/OwnerChangeLogInline'
import { ApiPromise } from '@polkadot/api'
import OfferingSubjectAccount from '../../components/OfferingSubjectAccount'
import RelationshipList from '../../components/deceased/RelationshipList'
import RelationshipGraph from '../../components/deceased/RelationshipGraph'

/**
 * 函数级详细中文注释：墓地详情页（移动端）
 * - 内容分区：逝者信息、相册、视频、生平、追忆文章
 * - 数据来源：
 *   1) 墓地详情：pallet-memo-grave → Graves, SlugOf
 *   2) 逝者列表：pallet-deceased → DeceasedByGrave, DeceasedOf
 *   3) 媒体与文本：pallet-deceased-media（albumsByDeceased/mediaByAlbum/mediaOf），pallet-deceased-text（lifeOf/messagesByDeceased/textOf/articlesByDeceased）
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
  const [deceased, setDeceased] = React.useState<Array<{ id: number; owner?: string; name?: string; nameBadge?: string; gender?: string; genderCode?: number; birth?: string|null; death?: string|null; token?: string; links?: string[]; nameFullCid?: string|null; mainImageCid?: string|null }>>([])
  // 选中逝者详情弹窗
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailItem, setDetailItem] = React.useState<null | { id: number; owner?: string; name?: string; nameBadge?: string; gender?: string; genderCode?: number; birth?: string|null; death?: string|null; token?: string; links?: string[]; nameFullCid?: string|null; mainImageCid?: string|null }>(null)
  // 聚合媒体（相册/视频/文章）
  const [albums, setAlbums] = React.useState<Array<{ albumId: number; mediaIds: number[] }>>([])
  const [videos, setVideos] = React.useState<Array<{ id: string; title?: string; uri?: string }>>([])
  const [articles, setArticles] = React.useState<Array<{ id: string; title?: string; summary?: string; uri?: string }>>([])
  // 相册图片（按相册ID分组的缩略图数据）
  const [albumPhotos, setAlbumPhotos] = React.useState<Record<number, Array<{ id: number; cid: string; w?: number|null; h?: number|null }>>>({})
  // 留言（Message）聚合
  const [messages, setMessages] = React.useState<Array<{ id: number; deceasedId: number; cid: string; thumb?: string }>>([])
  // 留言明文缓存（id -> text）
  const [messageTexts, setMessageTexts] = React.useState<Record<number, string>>({})
  // 封面CID与设置弹窗
  const [coverCid, setCoverCid] = React.useState<string>('')
  const [coverErr, setCoverErr] = React.useState('')
  const [coverOpen, setCoverOpen] = React.useState(false)
  const [cidInput, setCidInput] = React.useState('')
  const [pwdInput, setPwdInput] = React.useState('')
  const [coverSubmitting, setCoverSubmitting] = React.useState(false)
  // 逝者主图设置弹窗
  const [mainOpen, setMainOpen] = React.useState(false)
  const [mainCidInput, setMainCidInput] = React.useState('')
  const [mainPwdInput, setMainPwdInput] = React.useState('')
  const [mainSubmitting, setMainSubmitting] = React.useState(false)
  const [mainErr, setMainErr] = React.useState('')
  // 在“设置逝者主图”弹窗中选择的逝者ID
  const [mainSelectedDid, setMainSelectedDid] = React.useState<number | null>(null)
  // 创建留言弹窗
  const [msgOpen, setMsgOpen] = React.useState(false)

  // 编辑器弹窗（生平/相册/视频/文章/删除/上传）
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorTab, setEditorTab] = React.useState<'life'|'album'|'video'|'article'|'remove'>('life')
  const [selectedDid, setSelectedDid] = React.useState<number | null>(null)
  const [txPwd, setTxPwd] = React.useState('')
  // 生平
  const [lifeCid, setLifeCid] = React.useState('')
  const [lifeText, setLifeText] = React.useState('')
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
  // 相册下拉选项（仅当前选中逝者）
  const [albumOptions, setAlbumOptions] = React.useState<Array<{ value: number; label: string }>>([])
  const [albumLoading2, setAlbumLoading2] = React.useState(false)

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
   * - 优先尝试 UTF-8 解码
   * - 失败时返回十六进制字符串（用于包含二进制哈希的字段，如 deceasedToken）
   */
  const toStringFromAny = (x: any): string | undefined => {
    try {
      if (!x) return undefined
      
      // 尝试 UTF-8 解码
      let bytes: Uint8Array | undefined = undefined
      
      if (x.toU8a) {
        bytes = x.toU8a()
      } else if (x.isSome && x.unwrap) {
        bytes = x.unwrap().toU8a ? x.unwrap().toU8a() : new Uint8Array([])
      } else if (x.toJSON) {
        const json = x.toJSON()
        if (typeof json === 'string' && json.startsWith('0x')) {
          // 已经是十六进制字符串，直接返回
          return json
        }
        bytes = new Uint8Array(json)
      }
      
      if (bytes) {
        try {
          // 尝试 UTF-8 解码（strict 模式）
          return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        } catch {
          // UTF-8 解码失败，返回十六进制（适用于包含二进制哈希的字段）
          return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      }
      }
      
      return String(x)
    } catch { 
      return undefined 
    }
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
          const owner = d.owner?.toString?.() || String(d.owner || '')
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
          const mainImageCid = toStringFromAny(d.main_image_cid || d.mainImageCid) || null
          return { id: idNum, owner, name, nameBadge: badge, gender, genderCode, birth, death, token, links, nameFullCid, mainImageCid }
        } catch { return null }
      }).filter(Boolean) as any[]
      setDeceased(parsed)

      // ===== 3) 聚合媒体（按每位逝者 → 相册 → 媒体）（已整合到 deceased pallet）
      const qr2: any = (api.query as any)
      // 2025-11-08 修复：media 和 text 已整合到 deceased pallet
      let dmq: any = qr2.deceased
      if (!dmq) {
        console.error('未找到 deceased pallet');
        throw new Error('未找到 deceased 查询接口');
      }
      
      // 检查 media 相关查询接口是否可用
      const mediaKeys = Object.keys(dmq).filter(k => /album|media|video/i.test(k));
      console.log('📊 deceased pallet 可用的 media 查询接口:', mediaKeys);
      
      // 2025-11-08 临时处理：Media 模块存储项未实现
      if (!dmq.albumsByDeceased || !dmq.mediaByAlbum || !dmq.mediaOf) {
        console.warn('⚠️  Media 模块存储项未在链上实现，跳过媒体加载');
        console.warn('缺失的接口:', {
          albumsByDeceased: !dmq.albumsByDeceased,
          albumOf: !dmq.albumOf,
          mediaByAlbum: !dmq.mediaByAlbum,
          mediaOf: !dmq.mediaOf
        });
        setAlbums([]);
        setVideos([]);
        setArticles([]);
        // 继续加载其他数据，不中断流程
      } else {
        const albumIdLists: any[] = await dmq.albumsByDeceased.multi(ids)
        const allAlbumIds: number[] = albumIdLists.flatMap((v: any) => (v?.toJSON?.() as any[]) || [])
        // 新命名：MediaByAlbum
        const mediaIdLists: any[] = allAlbumIds.length ? await dmq.mediaByAlbum.multi(allAlbumIds) : []
        const grouped = allAlbumIds.map((aid: any, idx: number) => ({ albumId: Number(aid), mediaIds: ((mediaIdLists[idx]?.toJSON?.() as any[]) || []).map((x:any)=> Number(x)) }))
        setAlbums(grouped)
        const allMediaIds: number[] = grouped.flatMap(g => g.mediaIds)
        if (!allMediaIds.length) { 
          setVideos([]); 
          setArticles([]); 
        } else {
          // 新命名：MediaOf
          const media: any[] = await dmq.mediaOf.multi(allMediaIds)
          // 解析 kind/title/summary/uri，并额外聚合图片到相册（兼容 toHuman/toJSON 字段命名）
          const videoList: Array<{ id: string; title?: string; uri?: string }> = []
          const articleList: Array<{ id: string; title?: string; summary?: string; uri?: string }> = []
          const photoMap: Record<number, Array<{ id: number; cid: string; w?: number|null; h?: number|null }>> = {}
          const dataIdToAlbumId: Record<number, number> = {}
          grouped.forEach(g => g.mediaIds.forEach(mid => { dataIdToAlbumId[Number(mid)] = g.albumId }))
          const decodeBytes = (val: any): string => {
            try {
              if (!val) return ''
              if (typeof val === 'string') return val
              const u8 = new Uint8Array(val)
              return new TextDecoder().decode(u8)
            } catch { return '' }
          }
          media.forEach((m: any, idx: number) => {
            try {
              const dataId = Number(allMediaIds[idx])
              const human: any = m?.toHuman?.() || m?.toJSON?.() || m
              const kindStr: string = String(human?.kind ?? human?.Kind ?? human?.kind?.__kind ?? '')
              const title = human?.title || human?.Title || ''
              const summary = human?.summary || human?.Summary || ''
              // 优先从 toHuman 读取 uri；若为空则尝试从 toJSON 的字节数组解码
              let uri: string = human?.uri || human?.Uri || ''
              if (!uri) {
                const j: any = m?.toJSON?.() || {}
                const uriBytes = j?.uri || j?.Uri
                uri = decodeBytes(uriBytes)
              }
              if (/Video/i.test(kindStr)) {
                videoList.push({ id: String(dataId), title, uri })
                return
              }
              if (/Article/i.test(kindStr)) {
                articleList.push({ id: String(dataId), title, summary, uri })
                return
              }
              // 其余类型默认按"图片/照片"处理（因本分支 dataOf 来源于相册容器，不包含留言等）
              const albumIdForData = dataIdToAlbumId[dataId]
              if (albumIdForData != null && uri) {
                const w = (human?.width ?? human?.Width) ?? null
                const h = (human?.height ?? human?.Height) ?? null
                if (!photoMap[albumIdForData]) photoMap[albumIdForData] = []
                photoMap[albumIdForData].push({ id: dataId, cid: uri, w: w==null? null:Number(w), h: h==null? null:Number(h) })
              }
            } catch {}
          })
          setVideos(videoList)
          setArticles(articleList)
          setAlbumPhotos(photoMap)
        }
      }

      // ===== 3.1) 生平（Life，已整合到 deceased pallet）：为每位逝者读取 CID
      try {
        // 2025-11-08 修复：text 已整合到 deceased pallet
        let dtq: any = qr2.deceased
        if (!dtq) throw new Error('未找到 deceased 查询接口')
        
        // 检查 lifeOf 接口是否可用
        if (!dtq.lifeOf) {
          console.warn('⚠️  Text 模块的 lifeOf 接口未在链上实现，跳过生平加载');
        } else {
          const lifeOpts: any[] = await dtq.lifeOf.multi(ids)
        // 在 UI 渲染时用 LifeText 组件通过 CID 拉取明文，不做此处并发拉取
        // 仅将 CID 临时附加到 deceased 列表用于展示
        const cidMap: Record<number, string> = {}
          lifeOpts.forEach((opt: any, idx: number) => {
            try {
              if (opt && opt.isSome) {
                const life = opt.unwrap()
                const u8 = life.cid?.toU8a ? life.cid.toU8a() : (life.cid?.toJSON ? new Uint8Array(life.cid.toJSON()) : undefined)
                if (u8) cidMap[Number(ids[idx])] = new TextDecoder().decode(u8)
              }
            } catch {}
          })
          // 将 CID 合并进 state（不改变原字段结构，渲染时按需读取）
          setDeceased(prev => prev.map(d => ({ ...d, lifeCid: cidMap[d.id] })) as any)
        }
      } catch {}

      // ===== 4) 留言（Message，按整个墓位下所有逝者聚合，已整合到 deceased pallet）
      try {
        // 2025-11-08 修复：text 已整合到 deceased pallet
        let dtq2: any = qr2.deceased
        if (!dtq2) throw new Error('未找到 deceased 查询接口')
        
        // 检查 messagesByDeceased 和 textOf 接口是否可用
        if (!dtq2.messagesByDeceased || !dtq2.textOf) {
          console.warn('⚠️  Text 模块的留言接口未在链上实现，跳过留言加载');
          setMessages([]);
        } else {
          const msgIdLists: any[] = await dtq2.messagesByDeceased.multi(ids)
        let allMsgIds: number[] = msgIdLists.flatMap((v: any) => (v?.toJSON?.() as any[]) || []).map((x:any)=> Number(x))
        // 留言按倒序展示：按 ID 倒序请求与渲染
        allMsgIds = allMsgIds.sort((a,b)=> b-a)
        if (allMsgIds.length) {
          const msgItems: any[] = dtq2.textOf ? await dtq2.textOf.multi(allMsgIds) : []
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
              const cidBytes = j?.cid || j?.Cid
              const titleBytes = j?.title || j?.Title
              const cid = decodeBytes(cidBytes)
              const title = decodeBytes(titleBytes)
              return { id: Number(allMsgIds[idx]), deceasedId: 0, cid, thumb: undefined, title }
            } catch { return null }
          }).filter(Boolean) as Array<{ id:number; deceasedId:number; cid:string; thumb?:string }>
          setMessages(parsedMsg as any)
        } else { 
          setMessages([]) 
        }
      }
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

  // 解析模块 tx section（媒体/文本已整合到 deceased pallet）
  const resolveDeceasedMediaSectionFor = React.useCallback(async (method: string): Promise<string> => {
    const api = await getApi(); const txRoot: any = (api.tx as any)
    // 2025-11-08 修复：media 已整合到 deceased pallet
    const c = ['deceased', ...Object.keys(txRoot)]
    for (const s of c) { if (txRoot[s] && typeof txRoot[s][method] === 'function') return s }
    throw new Error(`运行时未找到媒体方法：${method}`)
  }, [])

  const resolveDeceasedTextSectionFor = React.useCallback(async (method: string): Promise<string> => {
    const api = await getApi(); const txRoot: any = (api.tx as any)
    // 2025-11-08 修复：text 已整合到 deceased pallet
    const c = ['deceased', ...Object.keys(txRoot)]
    for (const s of c) { if (txRoot[s] && typeof txRoot[s][method] === 'function') return s }
    throw new Error(`运行时未找到文本方法：${method}`)
  }, [])

  /**
   * 函数级中文注释：上传“逝者主图”到 IPFS 并自动回填 CID（不加密）。
   * - 参数：file 浏览器文件对象
   * - 行为：调用通用 uploadToIpfs，将返回的 CID 写入 mainCidInput，并提示成功。
   * - 返回：Promise<boolean>，用于配合 beforeUpload 拦截默认上传。
   */
  const handleUploadMainImage = React.useCallback(async (file: File): Promise<boolean> => {
    try {
      message.loading({ key: 'up-main', content: '正在上传主图到 IPFS…' })
      const cid = await uploadToIpfs(file as any)
      setMainCidInput(cid)
      message.success({ key: 'up-main', content: '已上传：'+cid })
      return false
    } catch (e:any) {
      message.error({ key: 'up-main', content: e?.message || '上传失败' })
      return false
    }
  }, [])

  /**
   * 函数级中文注释：跳转到供奉页面（携带 domain/target 参数）
   * - domain：供奉域编码（示例：0=Grave，1=Deceased）
   * - target：目标对象ID
   */
  const goOfferings = React.useCallback((domain: number, target: number) => {
    try {
      window.location.hash = `#/browse/category?domain=${Number(domain)}&target=${Number(target)}`
    } catch {}
  }, [])

  /**
   * 函数级中文注释：解析 deceased Pallet 的 tx section 名称（兼容不同命名风格）。
   * - 用于 setMainImage/clearMainImage 等接口。
   */
  const resolveDeceasedSectionFor = React.useCallback(async (method: string): Promise<string> => {
    const api = await getApi()
    const txRoot: any = (api.tx as any)
    const candidates = ['deceased','deceased_', 'memo_deceased', ...Object.keys(txRoot)]
    for (const s of candidates) { if (txRoot[s] && typeof txRoot[s][method] === 'function') return s }
    // 尝试下划线命名
    const snake = method.replace(/[A-Z]/g, m=> '_'+m.toLowerCase())
    for (const s of candidates) { if (txRoot[s] && typeof txRoot[s][snake] === 'function') return s }
    throw new Error(`运行时未找到方法：${method}`)
  }, [])

  /**
   * 函数级中文注释：只读查询组件 - 显示逝者最近活跃块高（LastActiveOf）
   * - 从 `pallet-deceased::LastActiveOf` 读取；若无记录则显示“-”。
   */
  const LastActiveInline: React.FC<{ deceasedId: number }> = ({ deceasedId }) => {
    const [bn, setBn] = React.useState<number | null>(null)
    React.useEffect(() => {
      let mounted = true
      const run = async () => {
        try {
          const api: ApiPromise = await getApi()
          const q: any = (api.query as any).deceased
          const v = await q.lastActiveOf(deceasedId)
          if (!mounted) return
          if (v && v.isSome) setBn(Number(v.unwrap().toString()))
          else setBn(null)
        } catch { if (mounted) setBn(null) }
      }
      run(); return ()=> { mounted = false }
    }, [deceasedId])
    return (
      <div>
        <Typography.Text type="secondary">最近活跃块高：</Typography.Text>
        <Typography.Text code>{bn==null? '-' : bn}</Typography.Text>
      </div>
    )
  }

  // 旧解析器（deceasedData）已废弃

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

  /**
   * 函数级中文注释：加载“当前选中逝者”的相册下拉选项
   * - 查询 deceasedMedia.albumsByDeceased(did) 获取相册ID列表
   * - 批量读取 albumOf 解析标题，生成下拉 label
   */
  const loadAlbumOptions = React.useCallback(async (did: number) => {
    setAlbumLoading2(true)
    try {
      const api = await getApi()
      const qr3: any = (api.query as any)
      // 2025-11-08 修复：media 已整合到 deceased pallet
      let dq: any = qr3.deceased
      if (!dq) throw new Error('未找到 deceased 查询接口')
      const listAny: any = await dq.albumsByDeceased(did)
      const ids: number[] = (listAny?.toJSON?.() as any[])?.map((x:any)=> Number(x)) || []
      if (!ids.length) { setAlbumOptions([]); return }
      const details: any[] = await dq.albumOf.multi(ids)
      const opts = details.map((a: any, idx: number) => {
        try {
          const id = ids[idx]
          const j: any = a?.toJSON?.() || a
          // 标题为字节数组，转 UTF-8
          const titleU8: any = j?.title
          let title = ''
          try { if (titleU8) title = new TextDecoder().decode(new Uint8Array(titleU8)) } catch {}
          return { value: id, label: `#${id}${title? ' · '+title: ''}` }
        } catch { return null }
      }).filter(Boolean)
      setAlbumOptions(opts as any)
    } catch { setAlbumOptions([]) }
    finally { setAlbumLoading2(false) }
  }, [])

  React.useEffect(() => {
    try { if (editorOpen && editorTab === 'album' && selectedDid != null) loadAlbumOptions(Number(selectedDid)) } catch {}
  }, [editorOpen, editorTab, selectedDid, loadAlbumOptions])

  return (
    <div className="grave-detail-page">
      {/* 顶部导航区域 */}
      <div className="grave-detail-header">
        <div className="grave-detail-header-content">
          <button className="grave-detail-back-btn" onClick={()=> window.history.back()}>
            <span>←</span>
            <span>返回</span>
          </button>
          <h1 className="grave-detail-title">墓地详情</h1>
          <div style={{ width: 48 }}></div>
        </div>
        
        {/* GraveId 输入区域 */}
        <div className="grave-id-input-area">
          <InputNumber 
            min={0} 
            value={graveId as any} 
            onChange={(v)=> setGraveId((v as any) ?? null)} 
            placeholder="墓地 ID" 
            style={{ flex: 1 }}
          />
          <button onClick={()=> { if (graveId!=null) loadAll(graveId) }}>
            {loading ? '加载中...' : '加载'}
          </button>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        
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
              {(() => {
                const firstWithMain = deceased.find(d => d.mainImageCid)
                if (!firstWithMain) return null
                const gw = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()
                const clean = String(firstWithMain.mainImageCid).replace(/^ipfs:\/\//i,'')
                return (
                  <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                    <img src={`${gw}/ipfs/${clean}`} alt="main" style={{ width: '100%', display: 'block' }} />
                  </div>
                )
              })()}
            </Space>
          </Card>
        )}

        {/* 背景音乐播放器 */}
        {graveId!=null && (
          <div className="grave-detail-music">
            <GraveAudioPlayer graveId={Number(graveId)} sticky />
          </div>
        )}

        {/* 标签页容器 */}
        <div className="grave-detail-tabs">
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            { key:'deceased', label:'逝者信息' },
            { key:'relationships', label:'家族关系' },
            { key:'album', label:'相册' },
            { key:'video', label:'视频' },
            { key:'life', label:'生平' },
            { key:'article', label:'追忆文章' },
          ]} />
        </div>

        {/* 底部操作按钮区域 */}
        <div className="grave-detail-actions">
          <button 
            className="grave-action-btn"
            onClick={()=> { setMainOpen(true); setMainCidInput(''); setMainPwdInput(''); setMainErr(''); try { const d0 = deceased?.[0]?.id; setMainSelectedDid((selectedDid as any) ?? (d0!=null? Number(d0): null)) } catch {} }}
          >
            <span>🖼</span>
            <span>设置逝者主图</span>
          </button>
          
          <button 
            className="grave-action-btn grave-action-btn-secondary"
            onClick={()=> setEditorOpen(true)}
          >
            <span>✏️</span>
            <span>编辑</span>
          </button>
          
          <button 
            className="grave-action-btn grave-action-btn-secondary"
            onClick={()=> {
              try {
                if (!deceased || deceased.length===0) { message.warning('暂无逝者可提议'); return }
                const first = Number(deceased[0].id)
                Modal.confirm({
                  title: '公众提议：治理转移逝者 owner',
                  content: (
                    <OwnerTransferAppealInline
                      defaultDeceasedId={first}
                      onSubmitted={async ()=> { try { if (graveId!=null) await loadAll(graveId) } catch {} }}
                    />
                  ),
                  icon: null,
                  okButtonProps: { style: { display: 'none' } },
                  cancelText: '关闭'
                })
              } catch {}
            }}
          >
            <span>🔄</span>
            <span>公众提议转移 owner</span>
          </button>
          
          <button 
            className="grave-action-btn"
            onClick={()=>{
              const tgt = Number(graveId||0)
              if (!Number.isFinite(tgt) || tgt<=0) return message.warning('无效的墓位ID')
              goOfferings(0, tgt)
            }}
          >
            <span>🕯</span>
            <span>前往供奉</span>
          </button>
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
                      <Button size="small" onClick={(e)=>{ e.stopPropagation(); goOfferings(1, Number(it.id)) }}>供奉TA</Button>
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
                      <MessageText cid={it.cid} cache={messageTexts} setCache={setMessageTexts} />
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
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <Space>
                    <Typography.Text strong>相册ID：</Typography.Text>
                    <Typography.Text code>{it.albumId}</Typography.Text>
                  </Space>
                  <div style={{ fontSize: 12, color: '#666' }}>媒体数：{it.mediaIds.length}</div>
                  <AlbumThumbGrid albumId={it.albumId} photos={albumPhotos[it.albumId] || []} />
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
              生平详情由 `deceased-text` 模块提供（Life），当前展示逝者 token 与日期作为概览。
            </Typography.Paragraph>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
              message="公示与自动否决机制"
              description={<div>
                <div>若对逝者发起“治理转移 owner”申诉并被批准，将进入 ≥30 天公示期。</div>
                <div>期间该逝者的 owner 只要有一次成功签名写操作，即视为“应答”，系统将自动否决该申诉的执行。</div>
              </div>}
            />
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
                      {/* 最近活跃块高（只读）：显示来自 pallet-deceased::LastActiveOf */}
                      <LastActiveInline deceasedId={Number(it.id)} />
                      {/* 最近一次 owner 变更（读取 OwnerChangeLogOf） */}
                      <OwnerChangeLogInline deceasedId={Number(it.id)} />
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

        {activeTab === 'relationships' && (
          <Card size="small">
            {selectedDid == null ? (
              <Alert
                type="info"
                showIcon
                message="请选择逝者"
                description="请先在'逝者信息'标签页中选择一个逝者，然后查看TA的家族关系。"
              />
            ) : (
              <Tabs defaultActiveKey="list" items={[
                {
                  key: 'list',
                  label: '列表视图',
                  children: (
                    <RelationshipList
                      deceasedId={selectedDid}
                      onDeceasedClick={(id) => {
                        try {
                          // 如果是本墓位的逝者，直接选中
                          const found = deceased.find(d => d.id === id)
                          if (found) {
                            setSelectedDid(id)
                            setDetailItem(found as any)
                            setDetailOpen(true)
                          } else {
                            // 否则跳转到逝者详情页（新页面）
                            message.info(`逝者 #${id} 不在当前墓位，点击查看详情`)
                          }
                        } catch {}
                      }}
                      showDetails={true}
                      groupByKind={true}
                    />
                  ),
                },
                {
                  key: 'graph',
                  label: '图谱视图',
                  children: (
                    <RelationshipGraph
                      rootDeceasedId={selectedDid}
                      maxDepth={3}
                      onNodeClick={(id) => {
                        try {
                          const found = deceased.find(d => d.id === id)
                          if (found) {
                            setSelectedDid(id)
                            setDetailItem(found as any)
                            setDetailOpen(true)
                          } else {
                            message.info(`逝者 #${id} 不在当前墓位`)
                          }
                        } catch {}
                      }}
                      height={600}
                    />
                  ),
                },
              ]} />
            )}
          </Card>
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
      {/* 逝者主图设置/治理弹窗 */}
      <Modal
        open={mainOpen}
        onCancel={()=> { setMainOpen(false); setMainCidInput(''); setMainPwdInput(''); setMainErr('') }}
        title="设置逝者主图（Owner直改/非Owner走治理）"
        okText="提交"
        cancelText="取消"
        confirmLoading={mainSubmitting}
        onOk={async ()=>{
          try {
            if (mainSelectedDid==null) { message.warning('请选择逝者'); return }
            if (!mainCidInput) { message.warning('请填写主图 CID'); return }
            if (!pwdInput && !current) { /* 无法判断 owner，这里要求密码 */ }
            if (!mainPwdInput || mainPwdInput.length < 8) { message.warning('请输入至少 8 位签名密码'); return }
            setMainSubmitting(true); setMainErr('')
            const section = await resolveDeceasedSectionFor('setMainImage')
            const bytes = Array.from(new TextEncoder().encode(mainCidInput))
            const hash = await signAndSendLocalWithPassword(section, 'setMainImage', [Number(mainSelectedDid), bytes], mainPwdInput)
            message.success('主图已提交：'+hash)
            setMainOpen(false); setMainPwdInput(''); setMainCidInput('')
            try { if (graveId!=null) await loadAll(graveId) } catch {}
          } catch (e:any) { setMainErr(e?.message || '提交失败') } finally { setMainSubmitting(false) }
        }}
        centered
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert type="info" showIcon message="说明" description="如果当前账户不是逝者 owner，请通过治理入口使用 govSetPrimaryImageFor（媒体域）。" />
          <div>
            <Typography.Text type="secondary">选择逝者：</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 6, marginBottom: 6 }}
              placeholder="请选择逝者"
              value={mainSelectedDid as any}
              options={deceased.map(d=> ({ value: d.id, label: `#${d.id} ${d.name || ''}` }))}
              onChange={(v)=> setMainSelectedDid(Number(v))}
            />
          </div>
          <Input placeholder="主图 CID（ipfs://CID 的 CID 部分）" value={mainCidInput} onChange={e=> setMainCidInput(e.target.value)} />
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={async (file) => { await handleUploadMainImage(file as any); return false }}
          >
            <Button>上传图片并自动回填 CID</Button>
          </Upload>
          <Input.Password placeholder="签名密码（至少 8 位）" value={mainPwdInput} onChange={e=> setMainPwdInput(e.target.value)} />
          {mainCidInput && (
            <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <img src={`https://ipfs.io/ipfs/${mainCidInput}`} alt="preview" style={{ width: '100%', display: 'block' }} />
            </div>
          )}
          {mainErr && <Alert type="error" showIcon message={mainErr} />}
        </Space>
      </Modal>
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
                <Input.TextArea rows={4} placeholder="生平明文（可直接粘贴；不填则使用上方 CID）" value={lifeText} onChange={e=> setLifeText(e.target.value)} />
                <Button onClick={async ()=>{
                  try {
                    if (!lifeText || !lifeText.trim()) return message.warning('请填写生平明文')
                    const blob = new Blob([lifeText], { type: 'text/plain; charset=utf-8' })
                    const file = new File([blob], 'life.txt', { type: 'text/plain' })
                    const cid = await uploadToIpfs(file)
                    setLifeCid(cid)
                    message.success('已上传到 IPFS：'+cid)
                  } catch(e:any) { message.error(e?.message || '上传失败') }
                }}>将明文上传到 IPFS 并回填 CID</Button>
                <Space>
                  <Button
                    type="primary"
                    loading={editorSubmitting}
                    onClick={async ()=>{
                      try {
                        if (selectedDid==null) return message.warning('请选择逝者')
                        if (!txPwd || txPwd.length<8) return message.warning('请输入至少 8 位签名密码')
                        let cidToUse = (lifeCid||'').trim()
                        if (!cidToUse) {
                          if (!lifeText || !lifeText.trim()) return message.warning('请填写生平明文或 CID')
                          // 若未填写 CID，则自动上传明文到 IPFS 生成 CID
                          const blob = new Blob([lifeText], { type: 'text/plain; charset=utf-8' })
                          const file = new File([blob], 'life.txt', { type: 'text/plain' })
                          cidToUse = await uploadToIpfs(file)
                          setLifeCid(cidToUse)
                        }
                        setEditorSubmitting(true)
                        const section = await resolveDeceasedTextSectionFor('updateLife').catch(async ()=> resolveDeceasedTextSectionFor('createLife'))
                        const did = Number(selectedDid)
                        // 优先尝试 update_life，若失败再回退 create_life
                        const bytes = strToBytes(cidToUse)
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
                      const section = await resolveDeceasedMediaSectionFor('createAlbum')
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
                  <Space style={{ width:'100%', justifyContent:'space-between' }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <Select
                        showSearch
                        placeholder={selectedDid==null? '请先选择逝者' : '选择相册'}
                        options={albumOptions}
                        loading={albumLoading2}
                        value={albumId as any}
                        onChange={(v)=> setAlbumId(Number(v))}
                        style={{ width:'100%' }}
                        optionFilterProp="label"
                      />
                    </div>
                    <Button size="small" onClick={()=> selectedDid!=null && loadAlbumOptions(Number(selectedDid))} loading={albumLoading2}>刷新</Button>
                  </Space>
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
                      const section = await resolveDeceasedMediaSectionFor('addMedia')
                      const bytes = strToBytes(photoCid)
                      const w = photoWidth==null? null : Number(photoWidth)
                      const h = photoHeight==null? null : Number(photoHeight)
                      const txh = await signAndSendLocalWithPassword(section, 'addMedia', [0, Number(albumId), 0, bytes, null, null, null, w, h, null], txPwd)
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
                      const section = await resolveDeceasedMediaSectionFor('createVideoCollection')
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
                      const section = await resolveDeceasedMediaSectionFor('addMedia')
                      const txh = await signAndSendLocalWithPassword(section, 'addMedia', [1, Number(vcId), 1, strToBytes(videoUri), null, null, videoDuration==null? null:Number(videoDuration), null, null, null], txPwd)
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
                    const section = await resolveDeceasedTextSectionFor('setArticle')
                    const bytes = strToBytes(articleCid)
                    const did = Number(selectedDid)
                    const txh = await signAndSendLocalWithPassword(section, 'setArticle', [did, bytes, articleTitle? strToBytes(articleTitle): null, articleSummary? strToBytes(articleSummary): null], txPwd)
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
                      const section = await resolveDeceasedMediaSectionFor('removeMedia')
                      const h = await signAndSendLocalWithPassword(section, 'removeMedia', [Number(removeDataId)], txPwd)
                      message.success('已提交删除媒体：'+h)
                      if (graveId!=null) await loadAll(graveId)
                    } catch(e:any) { message.error(e?.message || '提交失败') } finally { setEditorSubmitting(false) }
                  }}>删除媒体</Button>
                </Space>
                {/* 相册删除入口暂未提供（需治理端实现 gov 接口） */}
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
        width={720}
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
            
            <Divider style={{ margin: '12px 0' }} />
            
            {/* 供奉主题资金账户 */}
            <Card size="small" title="供奉主题资金账户" style={{ marginTop: 8 }}>
              <OfferingSubjectAccount deceasedId={detailItem.id} showBalance={true} />
            </Card>
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

  // 函数级中文注释：在内联组件中本地解析 section 名称（text 已整合到 deceased）
  const resolveTextSectionLocal = React.useCallback(async (): Promise<string> => {
    try {
      const api = await getApi()
      const txRoot: any = (api.tx as any)
      // 2025-11-08 修复：text 已整合到 deceased pallet
      const candidates = ['deceased', ...Object.keys(txRoot)]
      for (const s of candidates) { if (txRoot[s]?.addMessage) return s }
    } catch {}
    return 'deceased'
  }, [])

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
          // 先上传明文到 IPFS，获取 CID
          const blob = new Blob([text], { type: 'text/plain; charset=utf-8' })
          const file = new File([blob], 'message.txt', { type: 'text/plain' })
          const cid = await uploadToIpfs(file)
          const section = await resolveTextSectionLocal()
          const args = [Number(did), strToBytes(cid), null]
          const h = await _s(section, 'addMessage', args as any, pwd)
          message.success('已提交留言：'+h)
          setText(''); setThumbCid('')
          onSubmitted && onSubmitted()
        } catch(e:any) { message.error(e?.message || '提交失败') } finally { setLoading(false) }
      }}>提交留言</Button>
    </Space>
  )
}

/**
 * 函数级详细中文注释：内联组件——提交“治理转移逝者 owner”的公众申诉
 * - 使用专用入口 submit_owner_transfer_appeal(domain=2, action=4)
 * - 必填：deceased_id、new_owner、evidence_cid；可选 reason_cid
 */
const OwnerTransferAppealInline: React.FC<{ defaultDeceasedId: number; onSubmitted?: ()=> void }> = ({ defaultDeceasedId, onSubmitted }) => {
  const [did, setDid] = React.useState<number>(defaultDeceasedId)
  const [newOwner, setNewOwner] = React.useState<string>('')
  const [evidenceCid, setEvidenceCid] = React.useState<string>('')
  const [reasonCid, setReasonCid] = React.useState<string>('')
  const [pwd, setPwd] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)

  const strToBytes = React.useCallback((s: string): number[] => Array.from(new TextEncoder().encode(String(s||''))), [])

  const resolveGovSection = React.useCallback(async (): Promise<string> => {
    const api = await getApi(); const txRoot: any = (api.tx as any)
    const cands = ['stardustAppeals','stardust_appeals','contentGovernance', ...Object.keys(txRoot)]
    for (const s of cands) { if (txRoot[s]?.submitOwnerTransferAppeal) return s }
    throw new Error('未找到内容治理提交入口')
  }, [])

  return (
    <div style={{ marginTop: 8 }}>
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        <InputNumber value={did as any} onChange={(v)=> setDid(Number(v))} style={{ width:'100%' }} placeholder="逝者ID" />
        <Input placeholder="新 owner 地址（SS58）" value={newOwner} onChange={e=> setNewOwner(e.target.value)} />
        <Input placeholder="证据 CID（必填）" value={evidenceCid} onChange={e=> setEvidenceCid(e.target.value)} />
        <Input placeholder="理由 CID（可选，≥8字节）" value={reasonCid} onChange={e=> setReasonCid(e.target.value)} />
        <Input.Password placeholder="签名密码（≥8位）" value={pwd} onChange={e=> setPwd(e.target.value)} />
        <Button type="primary" loading={loading} onClick={async ()=>{
          try {
            if (!did || did<=0) return message.warning('无效的逝者ID')
            if (!newOwner) return message.warning('请输入新 owner 地址')
            if (!evidenceCid) return message.warning('请填写证据 CID')
            if (!pwd || pwd.length<8) return message.warning('请输入至少 8 位签名密码')
            setLoading(true)
            const section = await resolveGovSection()
            const api = await getApi(); const txRoot: any = (api.tx as any)
            // 前端最小长度校验（与链端常量保持一致或更严格）
            if ((evidenceCid||'').length < 10) throw new Error('证据 CID 过短（至少 10 字符）')
            if (reasonCid && (reasonCid||'').length < 8) throw new Error('理由 CID 过短（至少 8 字符）')
            const hash = await signAndSendLocalWithPassword(section, 'submitOwnerTransferAppeal', [Number(did), newOwner, strToBytes(evidenceCid), strToBytes(reasonCid||'')], pwd)
            message.success('已提交公众申诉：'+hash)
            onSubmitted && onSubmitted()
          } catch(e:any) { message.error(e?.message || '提交失败') } finally { setLoading(false) }
        }}>提交治理申诉</Button>
        <Alert type="info" showIcon message="提示" description="提交后需经委员会 2/3 审核 + 30 天公示；期间 owner 有任意成功签名写操作将自动否决执行。" />
      </Space>
    </div>
  )
}

/**
 * 函数级详细中文注释：根据 CID 拉取明文显示留言内容（带缓存）。
 */
const MessageText: React.FC<{ cid: string; cache: Record<number, string>; setCache: React.Dispatch<React.SetStateAction<Record<number, string>>> }> = ({ cid }) => {
  const [text, setText] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  React.useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        if (!cid) return
        setLoading(true)
        const clean = String(cid).replace(/^ipfs:\/\//i,'')
        const gw = (()=>{ try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' } })()
        const resp = await fetch(`${gw}/ipfs/${clean}`)
        const txt = await resp.text()
        if (mounted) setText(txt)
      } catch { if (mounted) setText('') } finally { if (mounted) setLoading(false) }
    }
    run()
    return () => { mounted = false }
  }, [cid])
  if (loading && !text) return <Typography.Text type="secondary">加载中…</Typography.Text>
  return <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{text || '(空)'}</Typography.Paragraph>
}


/**
 * 函数级详细中文注释：相册缩略图网格组件
 * - 输入：albumId（相册ID）、photos（该相册下的图片列表，包含 dataId 与 CID 及可选宽高）
 * - 展示：移动端优先的网格布局（每行最多4列，自动换行），图片裁剪为方形缩略图
 * - 交互：点击缩略图打开大图预览（Modal），可左右切换下一张/上一张
 * - 安全：仅从 IPFS 网关读取公开图片，不存储任何敏感数据
 * - 可扩展：后续可加入懒加载、骨架屏、长按保存/分享、Exif 信息等
 */
const AlbumThumbGrid: React.FC<{ albumId: number; photos: Array<{ id: number; cid: string; w?: number|null; h?: number|null }> }> = ({ albumId, photos }) => {
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [index, setIndex] = React.useState(0)

  const norm = React.useCallback((cid: string): string => String(cid || '').replace(/^ipfs:\/\//i, ''), [])
  const gateway = React.useMemo(() => {
    try { return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io' } catch { return 'https://ipfs.io' }
  }, [])

  if (!photos || photos.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#999' }}>该相册暂无图片</div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee', background: '#fafafa' }}>
            <img
              alt={`album-${albumId}-${p.id}`}
              src={`${gateway}/ipfs/${norm(p.cid)}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onClick={() => { setIndex(i); setPreviewOpen(true) }}
            />
          </div>
        ))}
      </div>
      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={
          photos.length > 1 ? (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button onClick={() => setIndex(prev => (prev - 1 + photos.length) % photos.length)}>上一张</Button>
              <div style={{ fontSize: 12, color: '#666' }}>#{photos[index]?.id}（{index + 1}/{photos.length}）</div>
              <Button onClick={() => setIndex(prev => (prev + 1) % photos.length)}>下一张</Button>
            </Space>
          ) : null
        }
        centered
        width={360}
      >
        <div style={{ width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
          <img
            alt={`preview-${albumId}-${photos[index]?.id}`}
            src={`${gateway}/ipfs/${norm(photos[index]?.cid || '')}`}
            style={{ width: '100%', display: 'block' }}
          />
        </div>
      </Modal>
    </div>
  )
}
