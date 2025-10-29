/**
 * 函数级详细中文注释：支付相关工具函数
 * 
 * 本文件包含EPAY支付、订单号生成、签名计算等辅助函数。
 * 从CreateOrderPage.tsx提取，便于在其他组件复用。
 * 
 * @module PaymentUtils
 * @created 2025-10-29
 * @refactor Day 3优化 - 从CreateOrderPage.tsx提取
 */

import CryptoJS from 'crypto-js'

/**
 * 函数级详细中文注释：解码EPAY字段（处理十六进制字符串）
 * 
 * EPAY配置字段从链上返回时可能是十六进制格式（0x开头），
 * 需要解码为UTF-8字符串。
 * 
 * @param field - 链上返回的字段值（可能是字符串或十六进制）
 * @returns 解码后的UTF-8字符串，解码失败返回空字符串
 * 
 * @example
 * decodeEpayField('0x68656c6c6f') // 返回 'hello'
 * decodeEpayField('hello')         // 返回 'hello'
 * decodeEpayField(null)            // 返回 ''
 */
export const decodeEpayField = (field: any): string => {
  // 字段为空，返回空字符串
  if (!field) return ''
  
  // 字段是普通字符串（非十六进制），直接返回
  if (typeof field === 'string' && !field.startsWith('0x')) {
    return field
  }
  
  // 字段是十六进制字符串，解码为UTF-8
  if (typeof field === 'string' && field.startsWith('0x')) {
    try {
      const hex = field.slice(2)  // 移除 '0x' 前缀
      const byteArray: number[] = []
      
      // 将十六进制字符串转换为字节数组
      for (let i = 0; i < hex.length; i += 2) {
        byteArray.push(parseInt(hex.substr(i, 2), 16))
      }
      
      // 解码为UTF-8字符串
      return new TextDecoder().decode(new Uint8Array(byteArray))
    } catch (e) {
      console.warn('解码EPAY字段失败:', field, e)
      return ''
    }
  }
  
  return ''
}

/**
 * 函数级详细中文注释：生成唯一的商户订单号
 * 
 * 格式：MM + 年月日时分秒（14位） + 随机数（4位）
 * 
 * @returns 20位的唯一订单号
 * 
 * @example
 * generateMerchantOrderNo()
 * // 返回: 'MM202510291523451234' 
 * // 其中 MM=前缀，20251029152345=时间戳，1234=随机数
 */
export const generateMerchantOrderNo = (): string => {
  const now = new Date()
  
  // 构造时间戳部分：年月日时分秒（14位）
  const timestamp = now.getFullYear().toString() +
                   (now.getMonth() + 1).toString().padStart(2, '0') +
                   now.getDate().toString().padStart(2, '0') +
                   now.getHours().toString().padStart(2, '0') +
                   now.getMinutes().toString().padStart(2, '0') +
                   now.getSeconds().toString().padStart(2, '0')

  // 生成随机数部分（4位）
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  
  // 组合：MM + 时间戳 + 随机数
  return `MM${timestamp}${random}`
}

/**
 * 函数级详细中文注释：生成EPAY支付签名（MD5）
 * 
 * EPAY接口要求对请求参数进行MD5签名，防止篡改。
 * 签名步骤：
 * 1. 过滤掉sign字段
 * 2. 按键名升序排列
 * 3. 构造 key1=value1&key2=value2&...&key=商户密钥 格式
 * 4. 计算MD5哈希（小写）
 * 
 * @param params - 请求参数对象（包含所有字段）
 * @param secretKey - EPAY商户密钥
 * @returns MD5签名（小写32位十六进制字符串）
 * 
 * @example
 * generatePaymentSignature(
 *   { pid: '12345', amount: '100', notify_url: 'https://...' },
 *   'my_secret_key'
 * )
 * // 返回: 'a1b2c3d4e5f6...'（MD5哈希）
 */
export const generatePaymentSignature = (params: any, secretKey: string): string => {
  // 1. 过滤掉不需要签名的字段（sign字段本身）
  const { sign, ...paramsToSign } = params

  // 2. 按键名升序排列
  const sortedKeys = Object.keys(paramsToSign).sort()

  // 3. 构造签名字符串 key1=value1&key2=value2&...
  let signString = ''
  sortedKeys.forEach(key => {
    const value = paramsToSign[key]
    // 只包含有效值（非undefined/null/空字符串）
    if (value !== undefined && value !== null && value !== '') {
      signString += `${key}=${value}&`
    }
  })

  // 4. 添加商户密钥
  signString += `key=${secretKey}`

  // 5. 计算MD5哈希（小写）
  const hash = CryptoJS.MD5(signString).toString().toLowerCase()

  // 打印签名信息（调试用）
  console.log('🔐 支付签名:', {
    signString: signString,
    hash: hash,
    secretKey: secretKey.substring(0, 4) + '***' // 只显示前4位，保护密钥安全
  })

  return hash
}

/**
 * 函数级详细中文注释：获取客户端IP地址
 * 
 * 通过第三方服务（ipify.org）获取客户端的公网IP地址。
 * 如果获取失败，返回默认值 '127.0.0.1'。
 * 
 * @returns Promise<string> - 客户端IP地址
 * 
 * @example
 * const ip = await getClientIP()
 * console.log(ip)  // '192.168.1.100' 或 '127.0.0.1'
 */
export const getClientIP = async (): Promise<string> => {
  try {
    // 使用ipify API获取公网IP
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip || '127.0.0.1'
  } catch (error) {
    console.warn('获取IP地址失败，使用默认值:', error)
    return '127.0.0.1'
  }
}

/**
 * 函数级详细中文注释：检测设备类型
 * 
 * 根据User-Agent判断当前设备是移动端还是PC端。
 * 
 * @returns 'mobile' 或 'pc'
 * 
 * @example
 * const deviceType = detectDeviceType()
 * if (deviceType === 'mobile') {
 *   // 移动端逻辑
 * } else {
 *   // PC端逻辑
 * }
 */
export const detectDeviceType = (): string => {
  const userAgent = navigator.userAgent.toLowerCase()
  
  // 检测移动设备特征
  if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
    return 'mobile'
  }
  
  return 'pc'
}

/**
 * 函数级详细中文注释：验证EPAY配置完整性
 * 
 * 检查做市商的EPAY配置是否完整，用于判断是否可以发起自动支付。
 * 
 * @param epayGateway - EPAY网关地址
 * @param epayPort - EPAY端口
 * @param epayPid - EPAY商户ID
 * @param epayKey - EPAY商户密钥
 * @returns boolean - 配置是否完整
 * 
 * @example
 * const isValid = validateEpayConfig(
 *   'https://pay.example.com',
 *   8080,
 *   '12345',
 *   'secret_key'
 * )
 * // 返回: true
 */
export const validateEpayConfig = (
  epayGateway: string,
  epayPort: number,
  epayPid: string,
  epayKey: string
): boolean => {
  // 检查所有必需字段是否存在且非空
  return !!(
    epayGateway &&
    epayPort > 0 &&
    epayPid &&
    epayKey
  )
}

/**
 * 函数级详细中文注释：构造EPAY支付URL
 * 
 * 根据EPAY配置和订单信息，构造完整的支付URL。
 * 
 * @param gateway - EPAY网关地址
 * @param port - EPAY端口
 * @param params - 支付参数（包含sign签名）
 * @returns 完整的支付URL
 * 
 * @example
 * const url = buildEpayUrl(
 *   'https://pay.example.com',
 *   8080,
 *   { pid: '12345', amount: '100', sign: 'abc...' }
 * )
 * // 返回: 'https://pay.example.com:8080/submit?pid=12345&amount=100&sign=abc...'
 */
export const buildEpayUrl = (
  gateway: string,
  port: number,
  params: Record<string, any>
): string => {
  // 构造基础URL
  const baseUrl = `${gateway}${port ? ':' + port : ''}/submit`
  
  // 构造查询字符串
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  
  return `${baseUrl}?${queryString}`
}

