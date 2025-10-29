/**
 * 格式化工具函数
 */

/**
 * 格式化余额
 * @param balance - 余额（最小单位）
 * @param decimals - 小数位数
 * @returns 格式化后的余额字符串
 */
export function formatBalance(balance: bigint | number | string, decimals: number = 12): string {
  const balanceBigInt = typeof balance === 'bigint' ? balance : BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = balanceBigInt / divisor;
  const fractionalPart = balanceBigInt % divisor;
  
  // 格式化小数部分（保留4位有效数字）
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 4);
  
  return `${integerPart}.${fractionalStr}`;
}

/**
 * 格式化地址
 * @param address - 完整地址
 * @param prefixLength - 前缀长度
 * @param suffixLength - 后缀长度
 * @returns 格式化后的地址
 */
export function formatAddress(address: string, prefixLength: number = 6, suffixLength: number = 4): string {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address;
  }
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * 格式化时间戳
 * @param timestamp - 时间戳（毫秒）
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

