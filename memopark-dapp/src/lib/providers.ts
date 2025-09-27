import { AppConfig } from './config'

/**
 * 函数级详细中文注释：做市商提供方注册表（前端内置演示版）
 * - 生产环境建议从后端网关获取 provider 列表与 SLA，或在远端配置中心维护
 * - 结构：id、名称、API 基址、公钥/发行方账户、权重/SLA、状态
 */
export interface ProviderInfo {
  id: string
  name: string
  apiBase: string
  issuerAccount: string
  issuerPubkey?: string
  weight?: number
  slaScore?: number
  status?: 'active' | 'disabled'
}

export const providerRegistry: ProviderInfo[] = [
  // 函数级中文注释：默认仅包含一个“本机”提供方，指向 AppConfig.backendUrl
  { id: 'self', name: '自建做市商', apiBase: AppConfig.backendUrl, issuerAccount: '' }
]

/**
 * 函数级详细中文注释：选择提供方（最小策略：指定为主；否则取首个 active）
 */
export function pickProvider(preferred?: string): ProviderInfo {
  if (preferred) {
    const hit = providerRegistry.find(p => p.id === preferred && p.status !== 'disabled')
    if (hit) return hit
  }
  return providerRegistry.find(p => p.status !== 'disabled') || providerRegistry[0]
}
