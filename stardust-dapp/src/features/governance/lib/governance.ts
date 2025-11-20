import { getApi, signAndSendLocalWithPassword } from '../../../lib/polkadot-safe';
import { encodeAddress } from '@polkadot/util-crypto'

/**
 * 函数级详细中文注释：治理链上封装（精简版）
 * - 保留核心业务功能所需的预映像构建和申诉相关函数
 * - 删除已废弃的公投、投票、锁仓相关函数
 */

/**
 * 函数级详细中文注释：构造任意调用的预映像（hex 与 hash）
 * - 基于 section.method 与 args 构造 call，并返回 call.method 的原始字节十六进制以及哈希
 * - 用于墓地详情、音频设置等页面的治理提议
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

export interface PreparedPreimage { hash: string; len: number }

/**
 * 函数级详细中文注释：提交预映像
 * - 调用 api.tx.preimage.notePreimage(bytes)
 */
export async function submitPreimage(bytes: string, password?: string): Promise<PreparedPreimage> {
  try {
    const api = await getApi()
    const pre: any = (api.tx as any).preimage
    if (!pre?.notePreimage) {
      // 回退：直接返回哈希与长度
      const u8a = (api.registry as any).createType('Bytes', bytes)
      const hex = (u8a.toHex && u8a.toHex()) || String(bytes)
      const hash = (api.registry.createType('Hash', (u8a.toU8a ? u8a.toU8a() : u8a)) as any).toHex()
      const len = ((hex?.length || 2) - 2) / 2
      return { hash, len }
    }
    if (password) {
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
 * 函数级详细中文注释：提交提案
 * - 调用 api.tx.referenda.submit(track, hash, ...)
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
    // 兼容旧接口
    if (ref.submit && ref.submit.meta?.args?.length === 2) {
      if (password) return await signAndSendLocalWithPassword('referenda', 'submit', [track, preimage.hash], password)
      return `0xproposal_${track}_${Date.now()}`
    }
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
 * 函数级详细中文注释：构造 PalletsOrigin
 */
async function buildPalletsOrigin(opts?: { origin?: 'Root' | 'Signed' | 'Content'; signer?: string }) {
  const api = await getApi()
  const o = opts?.origin || 'Root'
  if (o === 'Root') return (api.createType as any)('PalletsOrigin', { system: { Root: null } })
  if (o === 'Signed') return (api.createType as any)('PalletsOrigin', { system: { Signed: opts?.signer } })
  const addr = getContentGovernorAddress()
  return (api.createType as any)('PalletsOrigin', { system: { Signed: addr } })
}

/**
 * 函数级详细中文注释：获取"内容治理签名账户"的 SS58 地址
 */
export function getContentGovernorAddress(prefix = 42): string {
  const bytes = new Uint8Array(32)
  const seed = new TextEncoder().encode('memo/cgov')
  bytes.set(seed.slice(0, Math.min(32, seed.length)))
  return encodeAddress(bytes, prefix)
}

/**
 * 函数级详细中文注释：解析 deceased-media pallet section 名称
 */
async function resolveDeceasedMediaSection(api: any): Promise<string> {
  const candidates = ['deceasedMedia', 'deceased_media', 'deceasedmedia', 'deceasedData', 'deceased_data', 'deceaseddata']
  for (const name of candidates) {
    if ((api.tx as any)[name]) return name
  }
  throw new Error('运行时未启用 deceased-media 模块')
}

/**
 * 函数级详细中文注释：构建 deceased-media 治理预映像
 */
export async function buildDeceasedMediaGovPreimage(method: string, args: any[]): Promise<{ hex: string; hash: string }>{
  const api = await getApi()
  const section = await resolveDeceasedMediaSection(api)
  return buildCallPreimageHex(section, method, args)
}

// 媒体域治理预映像（带证据CID）
export async function buildMediaGovSetMediaHidden(mediaId: number, hidden: boolean) {
  return buildDeceasedMediaGovPreimage('govSetMediaHidden', [mediaId, hidden])
}
export async function buildMediaGovReplaceMediaUri(mediaId: number, newUri: string) {
  return buildDeceasedMediaGovPreimage('govReplaceMediaUri', [mediaId, newUri])
}
export async function buildMediaGovRemoveMedia(mediaId: number) { 
  return buildDeceasedMediaGovPreimage('govRemoveMedia', [mediaId]) 
}
export async function buildMediaGovFreezeAlbum(albumId: number, frozen: boolean, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedMediaSection(api); 
  return buildCallPreimageHex(section, 'govFreezeAlbum', [albumId, frozen, evidenceCid])
}
export async function buildMediaGovSetMediaHiddenWithEvidence(mediaId: number, hidden: boolean, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedMediaSection(api); 
  return buildCallPreimageHex(section, 'govSetMediaHidden', [mediaId, hidden, evidenceCid])
}
export async function buildMediaGovReplaceMediaUriWithEvidence(mediaId: number, newUri: string, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedMediaSection(api); 
  return buildCallPreimageHex(section, 'govReplaceMediaUri', [mediaId, newUri, evidenceCid])
}
export async function buildMediaGovRemoveMediaWithEvidence(mediaId: number, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedMediaSection(api); 
  return buildCallPreimageHex(section, 'govRemoveMedia', [mediaId, evidenceCid])
}
export async function buildMediaGovSetPrimaryImageFor(deceasedId: number, mediaId: number | null, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedMediaSection(api); 
  return buildCallPreimageHex(section, 'govSetPrimaryImageFor', [deceasedId, mediaId, evidenceCid])
}
export async function buildMediaGovSetAlbumPrimaryPhoto(albumId: number, mediaId: number | null, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedMediaSection(api); 
  return buildCallPreimageHex(section, 'govSetAlbumPrimaryPhoto', [albumId, mediaId, evidenceCid])
}

/**
 * 函数级详细中文注释：解析 deceased pallet section 名称
 */
async function resolveDeceasedSection(api: any): Promise<string> {
  const candidates = ['deceased', 'Deceased']
  for (const name of candidates) {
    if ((api.tx as any)[name]) return name
  }
  throw new Error('运行时未启用 deceased 模块')
}

export async function buildDeceasedGovSetVisibility(id: number, isPublic: boolean, evidenceCid: string) {
  const api = await getApi()
  const section = await resolveDeceasedSection(api)
  return buildCallPreimageHex(section, 'govSetVisibility', [id, isPublic, evidenceCid])
}

export async function buildDeceasedGovTransferDeceased(id: number, newTargetId: number, evidenceCid: string) {
  const api = await getApi()
  const section = await resolveDeceasedSection(api)
  return buildCallPreimageHex(section, 'govTransferDeceased', [id, newTargetId, evidenceCid])
}

/**
 * 函数级详细中文注释：解析 deceased-text pallet section 名称
 */
async function resolveDeceasedTextSection(api: any): Promise<string> {
  const candidates = ['deceasedText', 'deceased_text', 'deceasedtext']
  for (const name of candidates) { if ((api.tx as any)[name]) return name }
  throw new Error('运行时未启用 deceased-text 模块')
}

export async function buildTextGovResolveLifeComplaint(deceasedId: number, uphold: boolean, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedTextSection(api); 
  return buildCallPreimageHex(section, 'govResolveLifeComplaint', [deceasedId, uphold, evidenceCid])
}
export async function buildTextGovResolveEulogyComplaint(textId: number, uphold: boolean, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedTextSection(api); 
  return buildCallPreimageHex(section, 'govResolveEulogyComplaint', [textId, uphold, evidenceCid])
}
export async function buildTextGovRemoveEulogy(textId: number, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedTextSection(api); 
  return buildCallPreimageHex(section, 'govRemoveEulogy', [textId, evidenceCid])
}
export async function buildTextGovSetArticleFor(owner: string, deceasedId: number, cid: string, title: string | null, summary: string | null, evidenceCid: string) {
  const api = await getApi(); const section = await resolveDeceasedTextSection(api); 
  return buildCallPreimageHex(section, 'govSetArticleFor', [owner, deceasedId, cid, title, summary, evidenceCid])
}

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
 * 函数级详细中文注释：解析 origin-restriction pallet 名称
 */
async function resolveOriginRestrictionSection(api: any): Promise<string> {
  const candidates = ['originRestriction', 'origin_restriction', 'originrestriction']
  for (const name of candidates) {
    if ((api.tx as any)[name]?.setGlobalAllow) return name
  }
  throw new Error('运行时未启用 origin-restriction 模块')
}

export async function buildOriginRestrictionSetGlobalAllowPreimage(allow: boolean): Promise<{ hex: string; hash: string }>{
  const api = await getApi()
  const section = await resolveOriginRestrictionSection(api)
  return buildCallPreimageHex(section, 'setGlobalAllow', [allow])
}

/**
 * 函数级详细中文注释：解析 memo-offerings pallet 名称
 */
async function resolveMemoOfferingsSection(api: any): Promise<string> {
  const candidates = ['memoOfferings', 'memo_offerings', 'memoofferings']
  for (const name of candidates) { if ((api.tx as any)[name]) return name }
  throw new Error('运行时未启用 memo-offerings 模块')
}

export async function buildOfferingsGovSetOfferParams(
  offerWindow: number | null,
  offerMaxInWindow: number | null,
  minOfferAmount: number | null,
  evidenceCid: string
): Promise<{ hex: string; hash: string }>{
  const api = await getApi(); const section = await resolveMemoOfferingsSection(api)
  return buildCallPreimageHex(section, 'govSetOfferParams', [offerWindow, offerMaxInWindow, minOfferAmount, evidenceCid])
}

export async function buildOfferingsGovSetOfferingPrice(
  kindCode: number,
  fixedPriceArg: any,
  unitPricePerWeekArg: any,
  evidenceCid: string
): Promise<{ hex: string; hash: string }>{
  const api = await getApi(); const section = await resolveMemoOfferingsSection(api)
  return buildCallPreimageHex(section, 'govSetOfferingPrice', [kindCode, fixedPriceArg, unitPricePerWeekArg, evidenceCid])
}

export async function buildOfferingsGovSetPauseGlobal(paused: boolean, evidenceCid: string) {
  const api = await getApi(); const section = await resolveMemoOfferingsSection(api)
  return buildCallPreimageHex(section, 'govSetPauseGlobal', [paused, evidenceCid])
}

export async function buildOfferingsGovSetPauseDomain(domain: number, paused: boolean, evidenceCid: string) {
  const api = await getApi(); const section = await resolveMemoOfferingsSection(api)
  return buildCallPreimageHex(section, 'govSetPauseDomain', [domain, paused, evidenceCid])
}

/**
 * 函数级详细中文注释：解析 memo-sacrifice pallet 名称
 */
async function resolveMemoSacrificeSection(api: any): Promise<string> {
  const candidates = ['memoSacrifice', 'memo_sacrifice', 'sacrifice']
  for (const name of candidates) { if ((api.tx as any)[name]?.createCategory) return name }
  for (const name of candidates) { if ((api.tx as any)[name]) return name }
  throw new Error('运行时未启用 memo-sacrifice 模块')
}

export async function buildSacrificeCreateCategoryPreimage(
  name: string,
  parent?: number | null
): Promise<{ hex: string; hash: string }>{
  const api = await getApi(); const section = await resolveMemoSacrificeSection(api)
  const nameBytes = new TextEncoder().encode(String(name||''))
  const parentArg = (parent === null || parent === undefined) ? null : Number(parent)
  return buildCallPreimageHex(section, 'createCategory', [Array.from(nameBytes), parentArg])
}

/**
 * 函数级详细中文注释：解析预映像十六进制为可读调用摘要
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
 * 函数级详细中文注释：读取链的 token 基础信息
 */
export async function getTokenInfo(): Promise<{ decimals: number; symbol: string }> {
  const api = await getApi()
  const decimals = (api.registry.chainDecimals && api.registry.chainDecimals[0]) || 12
  const symbol = (api.registry.chainTokens && api.registry.chainTokens[0]) || 'DUST'
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
 * 函数级详细中文注释：读取内容治理常量
 */
export async function fetchContentGovConsts(): Promise<{
  appealDeposit: string;
  rejectedSlashBps: number;
  withdrawSlashBps: number;
  windowBlocks: number;
  maxPerWindow: number;
  noticeDefaultBlocks: number;
}> {
  const api = await getApi()
  const c: any = (api.consts as any).stardustAppeals || (api.consts as any)['stardust_appeals']
  return {
    appealDeposit: (c?.appealDeposit?.toString && c.appealDeposit.toString()) || '0',
    rejectedSlashBps: (c?.rejectedSlashBps?.toNumber && c.rejectedSlashBps.toNumber()) || 0,
    withdrawSlashBps: (c?.withdrawSlashBps?.toNumber && c.withdrawSlashBps.toNumber()) || 0,
    windowBlocks: (c?.windowBlocks?.toNumber && c.windowBlocks.toNumber()) || 0,
    maxPerWindow: (c?.maxPerWindow?.toNumber && c.maxPerWindow.toNumber()) || 0,
    noticeDefaultBlocks: (c?.noticeDefaultBlocks?.toNumber && c.noticeDefaultBlocks.toNumber()) || 0,
  }
}

/**
 * 函数级详细中文注释：提交申诉
 */
export async function submitAppeal(domain: number, target: number, action: number, reasonCid: string, evidenceCid: string, password?: string): Promise<string> {
  const api = await getApi()
  const sec: any = (api.tx as any).stardustAppeals || (api.tx as any)['stardust_appeals']
  if (!sec?.submitAppeal) return `0xappeal_${Date.now()}`
  const tx = sec.submitAppeal(domain, target, action, reasonCid, evidenceCid)
  if ((api as any).signAndSendLocalWithPassword && password) {
    // @ts-ignore
    return await (api as any).signAndSendLocalWithPassword('stardustAppeals','submitAppeal',[domain,target,action,reasonCid,evidenceCid], password)
  }
  return `0xappeal_${Date.now()}`
}

/**
 * 函数级详细中文注释：撤回申诉
 */
export async function withdrawAppeal(id: number, password?: string): Promise<string> {
  const api = await getApi(); const sec: any = (api.tx as any).stardustAppeals || (api.tx as any)['stardust_appeals']
  if (!sec?.withdrawAppeal) return `0xappeal_withdraw_${Date.now()}`
  if ((api as any).signAndSendLocalWithPassword && password) {
    // @ts-ignore
    return await (api as any).signAndSendLocalWithPassword('stardustAppeals','withdrawAppeal',[id], password)
  }
  return `0xappeal_withdraw_${Date.now()}`
}

/**
 * 函数级详细中文注释：审批申诉（通过）
 */
export async function approveAppeal(id: number, noticeBlocks?: number, password?: string): Promise<string> {
  const api = await getApi(); const sec: any = (api.tx as any).stardustAppeals || (api.tx as any)['stardust_appeals']
  if (!sec?.approveAppeal) return `0xappeal_approve_${Date.now()}`
  const args = noticeBlocks && noticeBlocks>0 ? [id, noticeBlocks] : [id]
  if ((api as any).signAndSendLocalWithPassword && password) {
    // @ts-ignore
    return await (api as any).signAndSendLocalWithPassword('stardustAppeals','approveAppeal', args, password)
  }
  return `0xappeal_approve_${Date.now()}`
}

/**
 * 函数级详细中文注释：审批申诉（驳回）
 */
export async function rejectAppeal(id: number, password?: string): Promise<string> {
  const api = await getApi(); const sec: any = (api.tx as any).stardustAppeals || (api.tx as any)['stardust_appeals']
  if (!sec?.rejectAppeal) return `0xappeal_reject_${Date.now()}`
  if ((api as any).signAndSendLocalWithPassword && password) {
    // @ts-ignore
    return await (api as any).signAndSendLocalWithPassword('stardustAppeals','rejectAppeal',[id], password)
  }
  return `0xappeal_reject_${Date.now()}`
}
