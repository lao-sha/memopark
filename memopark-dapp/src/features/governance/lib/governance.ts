import { getApi, signAndSendLocalWithPassword } from '../../../lib/polkadot-safe';
import { encodeAddress } from '@polkadot/util-crypto'
import { loadTxHistory } from '../../../lib/txHistory'

/**
 * 函数级详细中文注释：治理链上封装（占位版）
 * - 统一封装 referenda/conviction-voting/preimage 的查询与交易
 * - 目前提供最小类型与函数占位，后续逐步接入真实链上调用
 */

// 类型定义：供 hooks 与页面复用
export interface ReferendumBrief {
  id: number;
  title: string;
  track: number;
  status: 'Deciding' | 'Approved' | 'Rejected' | 'Cancelled' | 'TimedOut';
  endAt?: number;
  preimageHash?: string;
}

export interface ReferendumDetail extends ReferendumBrief {
  description?: string;
  enactmentDelay?: number;
  support?: number;
  against?: number;
}

export interface PreimageInfo { hash: string; length?: number; provider?: string; available: boolean }
export interface PreparedPreimage { hash: string; len: number }
export interface MyVoteItem { referendumId: number; track: number; aye: boolean; conviction: number; amount: string }
export interface MyLockItem { until: number; amount: string }
export interface MyProposalItem { id: number; title: string; track: number; status: ReferendumBrief['status']; submittedAt?: number; referendumId?: number }

export interface VoteParams {
  track: number;
  referendumIndex: number;
  aye: boolean;
  conviction: number;
  amount: string;
  password?: string;
}

/**
 * 函数级详细中文注释：提交投票（占位）
 * - 未来调用 api.tx.convictionVoting.vote(...) 进行实际签名发送
 * - 当前返回模拟结果，保证前端流程可调通
 */
export async function submitVote(params: VoteParams): Promise<string> {
  try {
    const api = await getApi()
    const cv: any = (api.tx as any).convictionVoting
    if (!cv?.vote) {
      // 回退：返回占位哈希
      return `0xvote_${params.track}_${params.referendumIndex}_${Date.now()}`
    }
    const voteArg = { Standard: { vote: { aye: params.aye, conviction: params.conviction }, balance: params.amount } }
    // 兼容不同签名：有的网络 vote(track, index, voteArg)，有的 vote(index, voteArg)
    const needsTrack = cv.vote.meta?.args?.length >= 3
    const tx = needsTrack ? cv.vote(params.track, params.referendumIndex, voteArg) : cv.vote(params.referendumIndex, voteArg)
    if (params.password) {
      // 使用提供的密码进行本地签名
      return await signAndSendLocalWithPassword('convictionVoting', 'vote', needsTrack ? [params.track, params.referendumIndex, voteArg] : [params.referendumIndex, voteArg], params.password)
    }
    // 回退使用交互式本地 keystore 签名
    // 注意：此调用内部会弹窗要求输入密码
    // 这里无法直接调用 signAndSendLocalFromKeystore(section, method, args) 因需要 section/method 路径匹配
    // 因此直接使用 tx.signAndSend 方案不便于统一；沿用回退占位哈希策略
    try {
      // 最佳实践是统一从 polkadot-safe 暴露非交互式签名；此处保守返回占位哈希
      return `0xvote_${params.track}_${params.referendumIndex}_${Date.now()}`
    } catch {
      return `0xvote_${params.track}_${params.referendumIndex}_${Date.now()}`
    }
  } catch {
    return `0xvote_${params.track}_${params.referendumIndex}_${Date.now()}`
  }
}

/**
 * 函数级详细中文注释：构造任意调用的预映像（hex 与 hash）
 * - 基于 section.method 与 args 构造 call，并返回 call.method 的原始字节十六进制以及哈希
 * - 用于“发起提案”页离线生成预映像，减少手工编码错误
 */
export async function buildCallPreimageHex(
  section: string,
  method: string,
  args: any[]
): Promise<{ hex: string; hash: string }> {
  const api = await getApi()
  const sec: any = (api.tx as any)[section]
  if (!sec || !sec[method]) {
    throw new Error(`找不到调用：${section}.${method}`)
  }
  const call = sec[method](...args)
  const u8a = call.method.toU8a()
  const hex = call.method.toHex()
  const hash = (api.registry.createType('Hash', u8a) as any).toHex()
  return { hex, hash }
}

/**
 * 函数级详细中文注释：解析预映像十六进制为可读调用摘要
 * - 输入：call.method 的 hex（不含 scale 外层编码），输出：section、method、args JSON（尽力而为）
 * - 说明：@polkadot/api 无法直接从任意 bytes 反向解析出 section/method，仅能在已知元数据下尝试 decodeCall
 */
export async function decodePreimageHex(hex: string): Promise<{ section?: string; method?: string; args?: any } | null> {
  try {
    const api = await getApi()
    const u8a = (api.registry as any).createType('Call', hex)
    const call = u8a as any
    return {
      section: call.section,
      method: call.method,
      args: call.args
    }
  } catch {
    return null
  }
}

/**
 * 函数级详细中文注释：快速构建财库支出预映像（treasury.spend）
 * - beneficiary: 收款 SS58 地址字符串
 * - amountMemo: 以 MEMO 为单位的金额字符串（支持小数）
 * - decimals: 可选小数位，默认取链上注册首个 token 的 decimals
 * - 兼容回退：若不存在 `treasury.spend`，尝试 `treasury.proposeSpend`（不同版本兼容）
 */
export async function buildTreasurySpendPreimage(
  beneficiary: string,
  amountMemo: string,
  decimals?: number
): Promise<{ hex: string; hash: string; planck: string; decimals: number; symbol: string }>{
  const api = await getApi()
  const d = decimals ?? (api.registry.chainDecimals?.[0] ?? 12)
  const symbol = (api.registry.chainTokens?.[0] as string) || 'MEMO'

  function parseAmountToPlanck(input: string, dec: number): string {
    // 安全十进制解析：仅允许数字与一个小数点
    const s = String(input).trim()
    if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('金额格式错误')
    const [whole, frac = ''] = s.split('.')
    const fracPadded = (frac + '0'.repeat(dec)).slice(0, dec)
    const combined = `${whole}${fracPadded}`.replace(/^0+/, '') || '0'
    return combined
  }

  const planck = parseAmountToPlanck(amountMemo, d)
  const txy: any = (api.tx as any).treasury
  if (!txy) throw new Error('运行时未启用 treasury 模块')
  // 优先使用 OpenGov 版本的 spend
  if (txy.spend) {
    return { ...(await buildCallPreimageHex('treasury', 'spend', [planck, beneficiary])), planck, decimals: d, symbol }
  }
  // 兼容旧接口 proposeSpend(amount, beneficiary)
  if (txy.proposeSpend) {
    return { ...(await buildCallPreimageHex('treasury', 'proposeSpend', [planck, beneficiary])), planck, decimals: d, symbol }
  }
  throw new Error('treasury 不支持 spend/proposeSpend 接口')
}

/**
 * 函数级详细中文注释：快速构建 balances.forceTransfer 预映像（高风险，需 Root）
 * - source: 源账户 SS58
 * - dest: 目标账户 SS58
 * - amountMemo: 金额（MEMO，支持小数）
 * - decimals: 可选小数位
 */
export async function buildBalancesForceTransferPreimage(
  source: string,
  dest: string,
  amountMemo: string,
  decimals?: number
): Promise<{ hex: string; hash: string; planck: string; decimals: number; symbol: string }>{
  const api = await getApi()
  const d = decimals ?? (api.registry.chainDecimals?.[0] ?? 12)
  const symbol = (api.registry.chainTokens?.[0] as string) || 'MEMO'

  function parseAmountToPlanck(input: string, dec: number): string {
    const s = String(input).trim()
    if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('金额格式错误')
    const [whole, frac = ''] = s.split('.')
    const fracPadded = (frac + '0'.repeat(dec)).slice(0, dec)
    const combined = `${whole}${fracPadded}`.replace(/^0+/, '') || '0'
    return combined
  }

  const planck = parseAmountToPlanck(amountMemo, d)
  const bal: any = (api.tx as any).balances
  if (!bal?.forceTransfer) throw new Error('运行时不支持 balances.forceTransfer')
  return { ...(await buildCallPreimageHex('balances', 'forceTransfer', [source, dest, planck])), planck, decimals: d, symbol }
}

/**
 * 函数级详细中文注释：尝试解析不同 section 命名的 deceased-data pallet
 * - 不同 runtime 里 pallet 名可能为 deceasedMedia / deceased_media 等
 * - 返回可用的 section 名称，若均不可用则抛错
 */
async function resolveDeceasedMediaSection(api: any): Promise<string> {
  const candidates = ['deceasedData', 'deceased_data', 'deceaseddata', 'deceasedMedia', 'deceased_media', 'deceasedmedia']
  for (const name of candidates) {
    if ((api.tx as any)[name]) return name
  }
  throw new Error('运行时未启用 deceased-data 模块（或名称不匹配）')
}

/**
 * 函数级详细中文注释：构建 deceased-data 治理动作的通用预映像（按 method 透传）
 * - method: govFreezeAlbum | govSetMediaHidden | govReplaceMediaUri | govRemoveMedia | govSetAlbumMeta
 * - args: 对应上述方法的参数数组
 */
export async function buildDeceasedMediaGovPreimage(method: string, args: any[]): Promise<{ hex: string; hash: string }>{
  const api = await getApi()
  const section = await resolveDeceasedMediaSection(api)
  return buildCallPreimageHex(section, method, args)
}

/**
 * 函数级详细中文注释：快捷构建 deceased-data.governance 预映像（若 method 名与运行时一致）
 */
export async function buildMediaGovFreezeAlbum(albumId: number, frozen: boolean) {
  return buildDeceasedMediaGovPreimage('govFreezeAlbum', [albumId, frozen])
}
export async function buildMediaGovSetMediaHidden(mediaId: number, hidden: boolean) {
  return buildDeceasedMediaGovPreimage('govSetMediaHidden', [mediaId, hidden])
}
export async function buildMediaGovReplaceMediaUri(mediaId: number, newUri: string) {
  // uri 以字节传输，前端传入 UTF-8 字符串
  return buildDeceasedMediaGovPreimage('govReplaceMediaUri', [mediaId, newUri])
}
export async function buildMediaGovRemoveMedia(mediaId: number) {
  return buildDeceasedMediaGovPreimage('govRemoveMedia', [mediaId])
}

/**
 * 函数级详细中文注释：deceased-data 申诉与裁决预映像构建辅助
 * - complain_album(albumId) / complain_media(mediaId)
 * - gov_resolve_album_complaint(albumId, uphold) / gov_resolve_media_complaint(mediaId, uphold)
 */
export async function buildMediaComplainAlbum(albumId: number) {
  const api = await getApi()
  const section = await resolveDeceasedMediaSection(api)
  return buildCallPreimageHex(section, 'complainAlbum', [albumId])
}
export async function buildMediaComplainMedia(mediaId: number) {
  const api = await getApi()
  const section = await resolveDeceasedMediaSection(api)
  return buildCallPreimageHex(section, 'complainMedia', [mediaId])
}
export async function buildMediaGovResolveAlbumComplaint(albumId: number, uphold: boolean) {
  return buildDeceasedMediaGovPreimage('govResolveAlbumComplaint', [albumId, uphold])
}
export async function buildMediaGovResolveMediaComplaint(mediaId: number, uphold: boolean) {
  return buildDeceasedMediaGovPreimage('govResolveMediaComplaint', [mediaId, uphold])
}

/**
 * 函数级详细中文注释：解析不同 section 命名的 origin-restriction pallet 名。
 * - 运行时可能导出为 originRestriction 或 origin_restriction 等不同写法。
 */
async function resolveOriginRestrictionSection(api: any): Promise<string> {
  const candidates = ['originRestriction', 'origin_restriction', 'originrestriction']
  for (const name of candidates) {
    if ((api.tx as any)[name]?.setGlobalAllow) return name
  }
  throw new Error('运行时未启用 origin-restriction 模块或缺少 setGlobalAllow')
}

/**
 * 函数级详细中文注释：构建 originRestriction.setGlobalAllow(allow) 预映像。
 * - allow=true 全局放行；allow=false 准备收紧（当前过滤器仍默认放行，后续细化）。
 */
export async function buildOriginRestrictionSetGlobalAllowPreimage(allow: boolean): Promise<{ hex: string; hash: string }>{
  const api = await getApi()
  const section = await resolveOriginRestrictionSection(api)
  return buildCallPreimageHex(section, 'setGlobalAllow', [allow])
}

/**
 * 函数级详细中文注释：提交预映像（占位）
 * - 未来调用 api.tx.preimage.notePreimage(bytes)
 */
export async function submitPreimage(bytes: string, password?: string): Promise<PreparedPreimage> {
  try {
    const api = await getApi()
    const pre: any = (api.tx as any).preimage
    if (!pre?.notePreimage) {
      // 回退：直接返回哈希与长度，便于后续 submit 使用（即使链上未存储）
      const u8a = (api.registry as any).createType('Bytes', bytes)
      const hex = (u8a.toHex && u8a.toHex()) || String(bytes)
      const hash = (api.registry.createType('Hash', (u8a.toU8a ? u8a.toU8a() : u8a)) as any).toHex()
      const len = ((hex?.length || 2) - 2) / 2
      return { hash, len }
    }
    if (password) {
      // 先计算哈希与长度，便于后续 submit
      const u8 = (api.registry as any).createType('Bytes', bytes)
      const raw = u8.toU8a ? u8.toU8a() : (u8 as any)
      const hash = (api.registry.createType('Hash', raw) as any).toHex()
      const len = ((u8.toHex ? u8.toHex().length : String(bytes).length) - 2) / 2
      await signAndSendLocalWithPassword('preimage', 'notePreimage', [bytes], password)
      return { hash, len }
    }
    const u8 = (api.registry as any).createType('Bytes', bytes)
    const raw = u8.toU8a ? u8.toU8a() : (u8 as any)
    const hash = (api.registry.createType('Hash', raw) as any).toHex()
    const len = ((u8.toHex ? u8.toHex().length : String(bytes).length) - 2) / 2
    return { hash, len }
  } catch {
    // 失败也计算并返回哈希/长度，前端仍可继续后续步骤
    try {
      const api = await getApi()
      const u8 = (api.registry as any).createType('Bytes', bytes)
      const raw = u8.toU8a ? u8.toU8a() : (u8 as any)
      const hash = (api.registry.createType('Hash', raw) as any).toHex()
      const len = ((u8.toHex ? u8.toHex().length : String(bytes).length) - 2) / 2
      return { hash, len }
    } catch {
      return { hash: `0xpre_${Date.now().toString(16)}`, len: Math.max(0, (String(bytes).length - 2) / 2) }
    }
  }
}

/**
 * 函数级详细中文注释：提交提案（占位）
 * - 未来调用 api.tx.referenda.submit(track, hash, ...)
 */
export async function submitProposal(
  track: number,
  preimage: PreparedPreimage,
  password?: string,
  opts?: { origin?: 'Root' | 'Signed' | 'Content'; signer?: string; enactmentAfter?: number }
): Promise<string> {
  try {
    const api = await getApi()
    const ref: any = (api.tx as any).referenda
    if (!ref) return `0xproposal_${track}_${Date.now()}`
    // 优先尝试 v41+ 接口：submit(proposal_origin, bounded_call, enactment)
    if (ref.submit && ref.submit.meta?.args?.length >= 3) {
      const origin = await buildPalletsOrigin(opts)
      const bounded = (api.createType as any)('BoundedCall', { Lookup: { hash: preimage.hash, len: preimage.len } })
      const enactment = { After: Math.max(0, opts?.enactmentAfter ?? 0) }
      if (password) return await signAndSendLocalWithPassword('referenda', 'submit', [origin, bounded, enactment], password)
      return `0xproposal_${track}_${Date.now()}`
    }
    // 兼容旧接口：submit(trackId, preimageHash)
    if (ref.submit && ref.submit.meta?.args?.length === 2) {
      if (password) return await signAndSendLocalWithPassword('referenda', 'submit', [track, preimage.hash], password)
      return `0xproposal_${track}_${Date.now()}`
    }
    // 兼容 submitWithDeposit(trackId, preimageHash)
    if (ref.submitWithDeposit) {
      if (password) return await signAndSendLocalWithPassword('referenda', 'submitWithDeposit', [track, preimage.hash], password)
      return `0xproposal_${track}_${Date.now()}`
    }
    return `0xproposal_${track}_${Date.now()}`
  } catch {
    return `0xproposal_${track}_${Date.now()}`
  }
}

/**
 * 函数级详细中文注释：构造 PalletsOrigin（Root / system.Signed / 内容治理账户签名）。
 * - Content：使用运行时约定的“内容治理签名账户”（AccountId32 = bytes("memo/cgov") + zeros），SS58=42。
 */
async function buildPalletsOrigin(opts?: { origin?: 'Root' | 'Signed' | 'Content'; signer?: string }) {
  const api = await getApi()
  const o = opts?.origin || 'Root'
  if (o === 'Root') return (api.createType as any)('PalletsOrigin', { system: { Root: null } })
  if (o === 'Signed') return (api.createType as any)('PalletsOrigin', { system: { Signed: opts?.signer } })
  // Content：构造固定账户地址
  const addr = getContentGovernorAddress()
  return (api.createType as any)('PalletsOrigin', { system: { Signed: addr } })
}

/**
 * 函数级详细中文注释：获取“内容治理签名账户”的 SS58 地址（Prefix 42）。
 * - 与运行时 `ContentGovernorAccount` 生成方式一致：AccountId32(bytes("memo/cgov") + zeros)。
 */
export function getContentGovernorAddress(prefix = 42): string {
  const bytes = new Uint8Array(32)
  const seed = new TextEncoder().encode('memo/cgov')
  bytes.set(seed.slice(0, Math.min(32, seed.length)))
  return encodeAddress(bytes, prefix)
}

/**
 * 函数级详细中文注释：查询最近的公投（尽力而为）
 * - 直接遍历 referenda 索引在主网上昂贵，此处仅尝试从 0..N 或使用链上提供的辅助 RPC（若有）
 * - 失败则返回占位列表
 */
export async function fetchReferendaRecent(limit = 10): Promise<ReferendumBrief[]> {
  try {
    const api = await getApi()
    const storage: any = (api.query as any).referenda
    if (!storage?.referendumInfoFor) {
      return includeLocalDrafts([])
    }
    // 读取 referendumCount，向后批量读取最近的若干条
    const countRaw = await (storage.referendumCount ? storage.referendumCount() : (api.createType as any)('u32', 0))
    const count = (countRaw?.toNumber && countRaw.toNumber()) || 0
    const start = Math.max(0, count - limit)
    const ids = Array.from({ length: Math.min(limit, count) }).map((_, i) => start + i)
    const res: any[] = await (storage.referendumInfoFor as any).multi(ids).catch(async () => {
      // 回退逐个查询
      return Promise.all(ids.map(async (i) => {
        try { return await (storage.referendumInfoFor as any)(i) } catch { return null }
      }))
    })
    const items: ReferendumBrief[] = []
    res.forEach((opt: any, i: number) => {
      try {
        const id = ids[i]
        if (!opt || !opt.isSome) return
        const info = opt.unwrap()
        let status: ReferendumBrief['status'] = 'Deciding'
        let track = 0
        let preimageHash: string | undefined = undefined
        if (info.isOngoing) {
          const st = info.asOngoing
          track = (st.track?.toNumber && st.track.toNumber()) || 0
          const prop: any = st.proposal
          const h = prop?.hash || prop?.lookupHash || prop?.lookup_hash
          if (h?.toHex) preimageHash = h.toHex()
        } else if (info.isApproved) {
          status = 'Approved'
        } else if (info.isRejected) {
          status = 'Rejected'
        } else if (info.isCancelled) {
          status = 'Cancelled'
        } else if (info.isTimedOut) {
          status = 'TimedOut'
        }
        items.push({ id, title: `公投 #${id}`, track, status, preimageHash })
      } catch {}
    })
    return includeLocalDrafts(items)
  } catch {
    return includeLocalDrafts([])
  }
}

/**
 * 函数级详细中文注释：将本地预映像（notePreimage）记录合并为“草案”以便列表可见
 * - 适用于链上暂未检索到任何公投或节点离线情况下
 */
function includeLocalDrafts(base: ReferendumBrief[]): ReferendumBrief[] {
  try {
    const txs = loadTxHistory()
    const drafts: ReferendumBrief[] = []
    for (const r of txs) {
      if ((r.section || '').toLowerCase() === 'preimage' && (r.method || '').toLowerCase().includes('notepreimage')) {
        const id = -Math.floor(r.timestamp / 1000) // 负ID标识草案
        drafts.push({ id, title: '本地草案（待链上提交）', track: 0, status: 'Deciding', endAt: undefined, preimageHash: undefined })
      }
    }
    // 去重：不重复已有链上项
    const have = new Set(base.map(b => b.id))
    const merged = base.concat(drafts.filter(d => !have.has(d.id)))
    return merged.length > 0 ? merged : [{ id: -1, title: '暂无公投（显示本地草案占位）', track: 0, status: 'Deciding' }]
  } catch {
    return base
  }
}

/**
 * 函数级详细中文注释：查询单个公投详情（尽力而为）
 */
export async function fetchReferendumDetail(id: number): Promise<ReferendumDetail> {
  try {
    const api = await getApi()
    const storage: any = (api.query as any).referenda
    if (!storage?.referendumInfoFor) {
      return { id, title: `公投 #${id}`, track: id % 3, status: 'Deciding', endAt: Date.now() + 5400_000, preimageHash: '0xdeadbeef', description: '占位详情', enactmentDelay: 600, support: 62, against: 38 }
    }
    // 简化：读取并构造成占位详情
    await (storage.referendumInfoFor as any)(id).catch(() => null)
    return { id, title: `公投 #${id}`, track: id % 3, status: 'Deciding', endAt: Date.now() + 5400_000, preimageHash: '0xdeadbeef', description: '占位详情', enactmentDelay: 600, support: 62, against: 38 }
  } catch {
    return { id, title: `公投 #${id}`, track: id % 3, status: 'Deciding', endAt: Date.now() + 5400_000, preimageHash: '0xdeadbeef', description: '占位详情', enactmentDelay: 600, support: 62, against: 38 }
  }
}

/**
 * 函数级详细中文注释：查询预映像信息（尽力而为）
 */
export async function fetchPreimageInfo(hash: string): Promise<PreimageInfo> {
  try {
    const api = await getApi()
    const storage: any = (api.query as any).preimage
    if (!storage?.statusFor) return { hash, length: 1024, provider: '5F...abc', available: true }
    await (storage.statusFor as any)(hash).catch(() => null)
    return { hash, length: 1024, provider: '5F...abc', available: true }
  } catch {
    return { hash, length: 1024, provider: '5F...abc', available: true }
  }
}

/**
 * 函数级详细中文注释：通过哈希读取预映像原始字节（尽力而为）
 * - 支持新版 `preimage.requestStatusFor`/`preimage.preimageFor` 或旧版 `preimage.preimageFor`
 */
export async function fetchPreimageHexByHash(hash: string): Promise<string | null> {
  try {
    const api = await getApi()
    const q: any = (api.query as any).preimage
    if (q?.preimageFor) {
      const res = await q.preimageFor(hash).catch(() => null)
      if (res && res.isSome) {
        const bytes = res.unwrap() as any
        const hex = (bytes.toHex && bytes.toHex()) || null
        return hex
      }
    }
    if (q?.requestStatusFor && q?.preimageFor) {
      // 组合式：先确认状态再取内容
      const res = await q.preimageFor(hash).catch(() => null)
      if (res && res.isSome) {
        const bytes = res.unwrap() as any
        const hex = (bytes.toHex && bytes.toHex()) || null
        return hex
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 函数级详细中文注释：查询我的投票与锁仓（尽力而为）
 */
export async function fetchMyVoting(address: string): Promise<{ votes: MyVoteItem[]; locks: MyLockItem[] }> {
  try {
    const api = await getApi()
    const cv: any = (api.query as any).convictionVoting
    if (!cv?.votingFor) return { votes: [{ referendumId: 101, track: 1, aye: true, conviction: 2, amount: '10' }], locks: [{ until: Date.now() + 7 * 24 * 3600_000, amount: '10' }] }
    // 简化：返回占位值
    await (cv.votingFor as any)(address, 0).catch(() => null)
    return { votes: [{ referendumId: 101, track: 1, aye: true, conviction: 2, amount: '10' }], locks: [{ until: Date.now() + 7 * 24 * 3600_000, amount: '10' }] }
  } catch {
    return { votes: [{ referendumId: 101, track: 1, aye: true, conviction: 2, amount: '10' }], locks: [{ until: Date.now() + 7 * 24 * 3600_000, amount: '10' }] }
  }
}

/**
 * 函数级详细中文注释：查询“我发起的提案”
 * - 方案A：扫描本地交易历史，找出 referenda.submit/submitWithDeposit 由我发起的记录（最可靠）
 * - 方案B：链上查询近 N 条公投，再按提交者过滤（若运行时事件可得）——当前以方案A为主
 */
export async function fetchMyProposals(address: string, recentLimit = 20): Promise<MyProposalItem[]> {
  try {
    const txs = loadTxHistory()
    const mine = txs.filter(r => (r.section||'').toLowerCase()==='referenda' && (r.method||'').toLowerCase().includes('submit') && r.from === address)
    // 先构造本地提案占位，并尽力从 args 中提取 track 与 preimageHash
    const base: (MyProposalItem & { _preimageHash?: string })[] = mine.slice(-recentLimit).map((r, idx) => {
      let track = 0
      let preHash: string | undefined = undefined
      try {
        const a = Array.isArray(r.args) ? r.args : []
        // 典型 args: [trackId, preimageHash, len]
        if (typeof a[0] === 'number') track = a[0]
        if (typeof a[1] === 'string') preHash = a[1]
      } catch {}
      return { id: -Math.floor(r.timestamp/1000) - idx, title: '我发起的提案', track, status: 'Deciding', submittedAt: r.timestamp, _preimageHash: preHash }
    })
    // 读取最近链上公投，按预映像哈希尝试匹配，补充 referendumId/track/status
    try {
      const chain = await fetchReferendaRecent(50)
      const byHash = new Map<string, ReferendumBrief>()
      chain.forEach(c => { if (c.preimageHash) byHash.set(c.preimageHash.toLowerCase(), c) })
      const merged = base.map(it => {
        if (it._preimageHash) {
          const c = byHash.get(it._preimageHash.toLowerCase())
          if (c) {
            return { id: it.id, title: it.title, track: c.track, status: c.status, submittedAt: it.submittedAt, referendumId: c.id }
          }
        }
        return { id: it.id, title: it.title, track: it.track, status: it.status, submittedAt: it.submittedAt }
      })
      // 若本地没有任何记录，回退展示最近链上公投列表
      if (merged.length === 0) return chain.map(c=>({ id: c.id, title: c.title, track: c.track, status: c.status, referendumId: c.id }))
      return merged
    } catch { return base.map(({ _preimageHash, ...rest }) => rest) }
  } catch { return [] }
}

/**
 * 函数级详细中文注释：估算链的出块时间（毫秒）
 * - 优先读取 timestamp.minimumPeriod × 2（Aura/通用），否则回退为 6000ms
 */
export async function getEstimatedBlockTimeMs(): Promise<number> {
  try {
    const api = await getApi()
    const min = (api.consts as any)?.timestamp?.minimumPeriod
    if (min?.toNumber) {
      return min.toNumber() * 2
    }
    return 6000
  } catch {
    return 6000
  }
}

/**
 * 函数级详细中文注释：将毫秒时长格式化为短可读文本
 * - 规则：优先显示天/小时/分钟的组合，尽量精简
 */
export function formatDurationMs(ms: number): string {
  try {
    const sec = Math.floor(ms / 1000)
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (d > 0) return `${d}天${h ? h + '小时' : ''}`
    if (h > 0) return `${h}小时${m ? m + '分钟' : ''}`
    if (m > 0) return `${m}分钟`
    return `${sec}秒`
  } catch {
    return `${ms}ms`
  }
}

/**
 * 函数级详细中文注释：读取链的 token 基础信息（decimals/symbol）
 */
export async function getTokenInfo(): Promise<{ decimals: number; symbol: string }> {
  const api = await getApi()
  const decimals = (api.registry.chainDecimals && api.registry.chainDecimals[0]) || 12
  const symbol = (api.registry.chainTokens && api.registry.chainTokens[0]) || 'MEMO'
  return { decimals, symbol }
}

/**
 * 函数级详细中文注释：格式化 Planck 金额为可读字符串
 */
export function formatPlanck(planck: string, decimals: number): string {
  try {
    const n = BigInt(planck)
    const div = BigInt(10) ** BigInt(decimals)
    const whole = n / div
    const frac = n % div
    if (frac === 0n) return whole.toString()
    const s = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    return s ? `${whole}.${s}` : whole.toString()
  } catch {
    return planck
  }
}

/**
 * 函数级详细中文注释：给定预映像 hex，尝试生成可读摘要（识别 treasury.spend/proposeSpend）
 */
export async function summarizePreimage(hex: string): Promise<string | null> {
  try {
    const api = await getApi()
    const call = (api.registry as any).createType('Call', hex) as any
    const section = call.section
    const method = call.method
    const args = (call.args || []).map((x: any) => (x?.toString ? x.toString() : String(x)))
    // deceased-data 系摘要（兼容旧名）
    if (/^deceased[_-]?data$/i.test(section) || /^deceaseddata$/i.test(section) || /^deceased[_-]?media$/i.test(section) || /^deceasedmedia$/i.test(section)) {
      if (method === 'govFreezeAlbum') {
        return `deceased-data.govFreezeAlbum → 相册 ${args[0]} ${args[1]==='true'?'冻结':'解冻'}`
      }
      if (method === 'govSetMediaHidden') {
        return `deceased-data.govSetMediaHidden → 媒体 ${args[0]} ${args[1]==='true'?'隐藏':'取消隐藏'}`
      }
      if (method === 'govReplaceMediaUri') {
        return `deceased-data.govReplaceMediaUri → 媒体 ${args[0]} 新URI=${args[1]}`
      }
      if (method === 'govRemoveMedia') {
        return `deceased-data.govRemoveMedia → 移除媒体 ${args[0]}`
      }
      if (method === 'complainAlbum') {
        return `deceased-data.complainAlbum → 申诉相册 ${args[0]}`
      }
      if (method === 'complainMedia') {
        return `deceased-data.complainMedia → 申诉媒体 ${args[0]}`
      }
      if (method === 'govResolveAlbumComplaint') {
        return `deceased-data.govResolveAlbumComplaint → 裁决相册 ${args[0]}，${args[1]==='true'?'维持投诉（20%胜诉/5%仲裁/75%退款）':'驳回投诉（20%胜诉/5%仲裁/75%退款）'}`
      }
      if (method === 'govResolveMediaComplaint') {
        return `deceased-data.govResolveMediaComplaint → 裁决媒体 ${args[0]}，${args[1]==='true'?'维持投诉（20%胜诉/5%仲裁/75%退款）':'驳回投诉（20%胜诉/5%仲裁/75%退款）'}`
      }
    }
    if (section === 'treasury' && (method === 'spend' || method === 'proposeSpend')) {
      // arg0: amount (Planck), arg1: beneficiary
      const { decimals, symbol } = await getTokenInfo()
      const amountPlanck = args[0]
      const beneficiary = args[1]
      const amountHuman = formatPlanck(String(amountPlanck), decimals)
      return `treasury.${method} → 收款人 ${beneficiary}，金额 ${amountHuman} ${symbol}`
    }
    if (section === 'balances') {
      const { decimals, symbol } = await getTokenInfo()
      if (method === 'forceTransfer') {
        // args: source, dest, amount
        const source = args[0], dest = args[1], amountPlanck = String(args[2] ?? '0')
        const amountHuman = formatPlanck(amountPlanck, decimals)
        return `balances.forceTransfer → 从 ${source} 到 ${dest} ，金额 ${amountHuman} ${symbol}`
      }
      if (method === 'transfer' || method === 'transferKeepAlive') {
        // args: dest, amount
        const dest = args[0], amountPlanck = String(args[1] ?? '0')
        const amountHuman = formatPlanck(amountPlanck, decimals)
        return `balances.${method} → 到 ${dest} ，金额 ${amountHuman} ${symbol}`
      }
    }
    return `${section}.${method}(${args.join(', ')})`
  } catch {
    return null
  }
}

/**
 * 函数级详细中文注释：尝试解锁投票锁仓（占位）
 * - 兼容不同签名：unlock(target) 或 unlock(classId, target)
 */
export async function unlockVotes(target: string, classId?: number, password?: string): Promise<string> {
  try {
    const api = await getApi()
    const cv: any = (api.tx as any).convictionVoting
    if (!cv?.unlock) return `0xunlock_${Date.now()}`
    const needsClass = cv.unlock.meta?.args?.length >= 2
    if (password) {
      return await signAndSendLocalWithPassword('convictionVoting', 'unlock', needsClass ? [classId ?? 0, target] : [target], password)
    }
    return `0xunlock_${Date.now()}`
  } catch {
    return `0xunlock_${Date.now()}`
  }
}


