/**
 * 函数级详细中文注释：工具函数模块
 * - EPAY 签名验证
 * - IP 白名单验证
 * - 数据格式化
 */

const crypto = require('crypto');
const logger = require('./logger');

/**
 * 函数级详细中文注释：验证 EPAY 签名
 * @param {Object} params - 请求参数
 * @param {string} key - EPAY 密钥
 * @returns {boolean} 签名是否有效
 */
function verifyEpaySign(params, key) {
  const { sign, sign_type, ...paramsToSign } = params;
  
  // 过滤空值和 undefined
  const filtered = {};
  Object.keys(paramsToSign).forEach(k => {
    const value = paramsToSign[k];
    if (value !== undefined && value !== null && value !== '') {
      filtered[k] = value;
    }
  });
  
  // 按键名升序排列
  const sortedKeys = Object.keys(filtered).sort();
  
  // 构造签名字符串
  let signString = '';
  sortedKeys.forEach(k => {
    signString += `${k}=${filtered[k]}&`;
  });
  signString += key;
  
  // 计算 MD5
  const calculated = crypto
    .createHash('md5')
    .update(signString)
    .digest('hex');
  
  const isValid = calculated === sign;
  
  logger.debug('签名验证详情:', {
    signString: signString.replace(key, '***'),  // 隐藏密钥
    expected: sign,
    calculated: calculated,
    match: isValid,
  });
  
  return isValid;
}

/**
 * 函数级详细中文注释：验证 IP 白名单
 * @param {string} ip - 客户端 IP
 * @param {string[]} allowedIPs - 允许的 IP 列表
 * @returns {boolean} IP 是否在白名单中
 */
function verifyIPWhitelist(ip, allowedIPs) {
  if (!allowedIPs || allowedIPs.length === 0) {
    return true;  // 未配置白名单，允许所有
  }
  
  // 提取真实 IP（处理 IPv6 映射的 IPv4）
  const realIP = ip.replace(/^::ffff:/, '');
  
  const allowed = allowedIPs.some(allowedIP => {
    return realIP === allowedIP || realIP.startsWith(allowedIP);
  });
  
  if (!allowed) {
    logger.warn(`⚠️  IP 不在白名单中: ${realIP}`, { allowedIPs });
  }
  
  return allowed;
}

/**
 * 函数级详细中文注释：格式化金额
 * @param {string|number} amount - 金额
 * @returns {string} 格式化后的金额（保留2位小数）
 */
function formatAmount(amount) {
  return parseFloat(amount).toFixed(2);
}

/**
 * 函数级详细中文注释：格式化订单信息（用于日志）
 * @param {Object} order - 订单对象
 * @returns {Object} 格式化后的订单信息
 */
function formatOrder(order) {
  return {
    orderId: order.orderId,
    mmId: order.mmId,
    buyer: order.buyer,
    amount: order.amount,
    status: order.status,
  };
}

module.exports = {
  verifyEpaySign,
  verifyIPWhitelist,
  formatAmount,
  formatOrder,
};

