import { u8aToHex } from '@polkadot/util'
import { decodeAddress } from '@polkadot/util-crypto'

/**
 * 统一地址格式：不同 ss58 前缀的地址会映射为相同的公钥十六进制
 */
export function normalizeAddress(address?: string | null): string | null {
  if (!address) return null
  try {
    return u8aToHex(decodeAddress(address))
  } catch {
    return address
  }
}

/**
 * 判断两个地址是否相等（忽略 ss58 前缀差异）
 */
export function isSameAddress(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const na = normalizeAddress(a)
  const nb = normalizeAddress(b)
  return !!na && !!nb && na === nb
}
