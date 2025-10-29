import { SecureHttpClient } from './secureHttpClient'
import { pickProvider } from './providers'

/**
 * 函数级详细中文注释：做市商适配层 API 客户端（支持多提供方）
 * - 通过 providers.ts 选择 provider，再与其 /otc/** 通信
 */
export interface CreateOrderRequest {
  fiatAmount?: string
  dustAmount?: string
  payType: string
  returnUrl?: string
  notifyUrl?: string
  providerId?: string
}

export interface SignedOrder {
  order_id: string
  memo_amount: string
  fiat_amount: string
  pay_qr?: string
  url?: string
  expired_at: number
  issuer_pubkey: string
  sig: string
}

export interface OrderStatus {
  order_id: string
  status: 'pending' | 'paid_reviewing' | 'paid_confirmed' | 'authorized' | 'settled' | 'expired' | 'failed'
  channel_txid?: string
  error?: string
  detail?: any
}

export interface ClaimAuthorization {
  version: string
  genesis_hash: string
  issuer_account: string
  order_id: string
  beneficiary: string
  amount_memo: string
  deadline_block: number
  nonce: string
  signature: string
}

export async function createOrder(req: CreateOrderRequest): Promise<SignedOrder> {
  const p = pickProvider(req.providerId)
  const url = `${p.apiBase}/otc/orders`
  const resp = await SecureHttpClient.post(url, { ...req, providerId: p.id }, false)
  if (!resp) throw new Error('NETWORK_UNREACHABLE')
  if (resp.error) throw new Error(resp.error)
  return resp as SignedOrder
}

export async function getOrderStatus(orderId: string, providerId?: string): Promise<OrderStatus> {
  const p = pickProvider(providerId)
  const url = `${p.apiBase}/otc/orders/${encodeURIComponent(orderId)}`
  const res = await SecureHttpClient.request(url, { method: 'GET', requireAuth: false, csrfProtection: false })
  if (!res?.ok) throw new Error(`HTTP_${res?.status || 'ERR'}`)
  return await res.json()
}

export async function authorizeClaim(orderId: string, beneficiary: string, providerId?: string): Promise<ClaimAuthorization> {
  const p = pickProvider(providerId)
  const url = `${p.apiBase}/otc/orders/${encodeURIComponent(orderId)}/authorize-claim`
  const res = await SecureHttpClient.post(url, { beneficiary, providerId: p.id }, false)
  if (!res) throw new Error('NETWORK_UNREACHABLE')
  if (res.error) throw new Error(res.error)
  return res as ClaimAuthorization
}


