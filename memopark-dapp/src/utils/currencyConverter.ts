/**
 * 汇率转换工具
 * 用于USDT和CNY之间的转换
 * 
 * 功能：
 * - USDT ↔ CNY 汇率转换
 * - 链上USDT价格格式化（精度10^6）
 * - 统一的价格显示格式
 */

// 固定汇率：1 USDT = 7.12 CNY
export const USDT_TO_CNY_RATE = 7.12;

/**
 * 将USDT转换为CNY
 * @param usdt - USDT金额
 * @returns CNY金额
 * 
 * @example
 * usdtToCny(100) // 返回 712 (100 USDT = 712 CNY)
 */
export function usdtToCny(usdt: number): number {
  return usdt * USDT_TO_CNY_RATE;
}

/**
 * 将CNY转换为USDT
 * @param cny - CNY金额
 * @returns USDT金额
 * 
 * @example
 * cnyToUsdt(712) // 返回 100 (712 CNY = 100 USDT)
 */
export function cnyToUsdt(cny: number): number {
  return cny / USDT_TO_CNY_RATE;
}

/**
 * 格式化USDT金额（保留2位小数）
 * @param usdt - USDT金额（可以是链上格式或显示格式）
 * @returns 格式化后的字符串
 * 
 * @example
 * formatUsdt(0.5) // 返回 "0.50 USDT"
 * formatUsdt(500000) // 返回 "0.50 USDT" (自动识别链上格式)
 */
export function formatUsdt(usdt: number | string | bigint): string {
  try {
    let num: number;
    
    if (typeof usdt === 'bigint') {
      // BigInt 类型，假设是链上格式（精度10^6）
      num = Number(usdt) / 1_000_000;
    } else if (typeof usdt === 'string') {
      const parsed = parseFloat(usdt);
      // 如果数值很大，可能是链上格式
      if (parsed > 100_000) {
        num = parsed / 1_000_000;
      } else {
        num = parsed;
      }
    } else {
      // number 类型
      // 如果数值很大，可能是链上格式
      if (usdt > 100_000) {
        num = usdt / 1_000_000;
      } else {
        num = usdt;
      }
    }
    
    return num.toFixed(4) + ' USDT';
  } catch (error) {
    console.error('USDT格式化错误:', error);
    return '0.0000 USDT';
  }
}

/**
 * 格式化CNY金额（保留2位小数）
 * @param cny - CNY金额
 * @returns 格式化后的字符串
 * 
 * @example
 * formatCny(3.56) // 返回 "¥3.56"
 */
export function formatCny(cny: number): string {
  return '¥' + cny.toFixed(2);
}

/**
 * 将链上USDT价格（precision 10^6）转换为显示价格
 * @param priceUsdt - 链上USDT价格（例如：500000 表示 0.5 USDT）
 * @returns USDT金额
 * 
 * @example
 * parseChainUsdt(500000) // 返回 0.5
 * parseChainUsdt('1000000') // 返回 1.0
 */
export function parseChainUsdt(priceUsdt: number | string | bigint): number {
  try {
    let num: number;
    
    if (typeof priceUsdt === 'bigint') {
      num = Number(priceUsdt);
    } else if (typeof priceUsdt === 'string') {
      num = parseInt(priceUsdt, 10);
    } else {
      num = priceUsdt;
    }
    
    return num / 1_000_000;  // 除以10^6
  } catch (error) {
    console.error('链上USDT解析错误:', error, priceUsdt);
    return 0;
  }
}

/**
 * 将显示价格转换为链上USDT价格（precision 10^6）
 * @param usdt - USDT金额
 * @returns 链上USDT价格
 * 
 * @example
 * toChainUsdt(0.5) // 返回 500000
 * toChainUsdt(1.0) // 返回 1000000
 */
export function toChainUsdt(usdt: number): number {
  return Math.floor(usdt * 1_000_000);  // 乘以10^6
}

/**
 * 格式化价格显示（同时显示USDT和CNY）
 * @param priceUsdt - 链上USDT价格
 * @returns 格式化后的价格字符串
 * 
 * @example
 * formatPriceDisplay(500000) // 返回 "0.5000 USDT (≈¥3.56)"
 */
export function formatPriceDisplay(priceUsdt: number | string | bigint): string {
  const usdt = parseChainUsdt(priceUsdt);
  const cny = usdtToCny(usdt);
  
  return `${usdt.toFixed(4)} USDT (≈${formatCny(cny)})`;
}

/**
 * 计算订单总金额（USDT）
 * @param priceUsdt - 链上USDT单价
 * @param quantity - MEMO数量
 * @returns USDT总金额
 * 
 * @example
 * calculateTotalUsdt(500000, 1000) // 返回 500 (1000 MEMO * 0.5 USDT)
 */
export function calculateTotalUsdt(priceUsdt: number | string | bigint, quantity: number): number {
  const unitPrice = parseChainUsdt(priceUsdt);
  return unitPrice * quantity;
}

/**
 * 计算订单总金额（CNY）
 * @param priceUsdt - 链上USDT单价
 * @param quantity - MEMO数量
 * @returns CNY总金额
 * 
 * @example
 * calculateTotalCny(500000, 1000) // 返回 3560 (1000 MEMO * 0.5 USDT * 7.12)
 */
export function calculateTotalCny(priceUsdt: number | string | bigint, quantity: number): number {
  const totalUsdt = calculateTotalUsdt(priceUsdt, quantity);
  return usdtToCny(totalUsdt);
}

