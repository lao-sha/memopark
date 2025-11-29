/**
 * IPFS 相关工具函数
 * - 统一规范 CID/URL，避免 ipfs://、各类网关 URL 互相混用导致图片无法加载
 */

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

/**
 * 清理 IPFS 资源输入，返回纯 CID（如果输入本身不是 CID 则原样返回）
 */
export function normalizeIpfsCid(raw?: string | null): string {
  if (!raw) return ''

  const value = raw.trim()
  if (!value) return ''

  // 处理 ipfs:// 或 ipfs://ipfs/xxx
  const protocolMatch = value.match(/^ipfs:\/\/(ipfs\/)?(.+)$/i)
  if (protocolMatch) {
    return protocolMatch[2]
  }

  // 处理 https://gateway/ipfs/xxx 场景
  const gatewayMatch = value.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i)
  if (gatewayMatch) {
    return gatewayMatch[1]
  }

  // 去掉前导的 ipfs/（部分接口会返回）
  if (/^ipfs\//i.test(value)) {
    return value.replace(/^ipfs\/+/, '')
  }

  return value
}

/**
 * 将任意 CID / URL 统一转换成可直接访问的 HTTP URL
 */
export function buildIpfsUrl(raw?: string | null, options?: { gateway?: string }): string | undefined {
  if (!raw) return undefined

  const value = raw.trim()
  if (!value) return undefined

  // 已经是 http(s)/data/blob 链接时直接返回
  if (/^(?:https?:|data:|blob:)/i.test(value)) {
    return value
  }

  const cid = normalizeIpfsCid(value)
  if (!cid) return undefined

  const gateway = options?.gateway || DEFAULT_IPFS_GATEWAY
  return gateway.endsWith('/') ? `${gateway}${cid}` : `${gateway}/${cid}`
}

export { DEFAULT_IPFS_GATEWAY }
