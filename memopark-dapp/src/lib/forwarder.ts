/**
 * 函数级详细中文注释：Forwarder 元交易工具（前端侧）
 * - 目的：在仅有普通用户钱包（无平台赞助者私钥）的前提下，构造可供后端赞助者服务（PlatformAccount）代付执行的请求负载。
 * - 安全：不在前端签名赞助交易；仅生成 JSON 负载，交由可信后端签名并上链（forwarder.forward）。
 * - 低耦合：使用通用的 section/method/args 描述 RuntimeCall，避免耦合 SCALE 编码细节。
 */

export type RuntimeCallSpec = {
  /** Pallet 名称，如 'evidence' / 'arbitration' */
  section: string
  /** 方法名称，如 'commit' / 'commitHash' / 'dispute' / 'arbitrate' */
  method: string
  /** 方法参数对象（键名与链上方法签名一致） */
  args: Record<string, unknown>
}

export type ForwardMetaTx = {
  /** 命名空间（8 字节字符串），与运行时 Forwader Authorizer 校验一致 */
  ns: string
  /** 会话 ID（16 字节建议使用 UUIDv4 字节，前端可留空交由后端生成） */
  sessionId?: string
  /** 被代付用户地址（owner） */
  owner: string
  /** 目标调用（未编码） */
  call: RuntimeCallSpec
  /** 重放保护：nonce 建议由后端生成/维护，前端可从 0 开始 */
  nonce: number
  /** 过期区块高度（由后端估计当前链高度 + TTL） */
  validTill: number
}

export const NAMESPACES = {
  /** 证据域（见 runtime::configs::EvidenceNsBytes） */
  evidence: 'evid___ ',
  /** 仲裁域（见 runtime::configs::ArbitrationNsBytes） */
  arbitration: 'arb___ _',
  /** OTC 挂单/吃单命名空间（已接入代付） */
  otcListing: 'otc_lst_',
  otcOrder: 'otc_ord_',
} as const

/**
 * 函数级详细中文注释：构造标准 Forwarder 元交易 JSON。
 * - 仅组织字段与基本校验，不做 SCALE 编码或链上发送；
 * - 返回的对象可直接传给后端赞助者服务，由其完成签名与上链。
 */
export function buildForwardRequest(params: ForwardMetaTx) {
  if (!params.owner || typeof params.owner !== 'string') {
    throw new Error('缺少被代付用户地址 owner')
  }
  if (!params.ns || params.ns.length !== 8) {
    throw new Error('ns 必须是 8 字节字符串（命名空间）')
  }
  if (!params.call?.section || !params.call?.method) {
    throw new Error('缺少调用标识 section/method')
  }
  return {
    ns: params.ns,
    sessionId: params.sessionId || undefined,
    owner: params.owner,
    call: params.call,
    nonce: params.nonce >>> 0,
    validTill: params.validTill >>> 0,
    // 预留：签名字段（由后端填充）
    signature: undefined,
  }
}

/**
 * 函数级中文注释：将对象美化为可复制字符串。
 */
export function pretty(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}


