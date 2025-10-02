/**
 * 格式化工具函数
 */

/**
 * 格式化地址（显示前8位和后8位）
 */
export function formatAddress(address: string | undefined): string {
  if (!address) return ''
  if (address.length <= 16) return address
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

/**
 * 格式化余额（从最小单位转换为显示单位）
 */
export function formatBalance(balance: bigint | number | string, decimals = 12): string {
  const value = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const fraction = value % divisor
  
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4)
  return `${whole}.${fractionStr}`
}

/**
 * 格式化CID（IPFS内容标识符）
 */
export function formatCid(cid: string | undefined): string {
  if (!cid) return ''
  if (cid.length <= 20) return cid
  return `${cid.slice(0, 10)}...${cid.slice(-10)}`
}

/**
 * 生成头像URL（基于地址）
 */
export function generateAvatar(address: string | undefined): string {
  if (!address) return ''
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)
    return success
  }
}

