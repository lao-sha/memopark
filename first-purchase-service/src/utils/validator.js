/**
 * 函数级详细中文注释：数据验证工具
 */

const { decodeAddress, encodeAddress } = require('@polkadot/keyring');
const { hexToU8a, isHex } = require('@polkadot/util');

/**
 * 验证Substrate地址格式
 */
function isValidSubstrateAddress(address) {
    try {
        encodeAddress(
            isHex(address)
                ? hexToU8a(address)
                : decodeAddress(address)
        );
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 验证MEMO金额（50-100）
 */
function isValidFirstPurchaseAmount(amount, min = 50, max = 100) {
    const num = Number(amount);
    return !isNaN(num) && num >= min && num <= max && Number.isInteger(num);
}

/**
 * 验证推荐码格式（可选）
 */
function isValidReferralCode(code) {
    if (!code) return true; // 可选字段
    return /^[A-Z0-9]{6}$/.test(code);
}

/**
 * 验证订单ID格式
 */
function isValidOrderId(orderId) {
    return /^MEMO_\d{8}_[A-Z0-9]{8}$/.test(orderId);
}

/**
 * 验证IP地址
 */
function isValidIp(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

module.exports = {
    isValidSubstrateAddress,
    isValidFirstPurchaseAmount,
    isValidReferralCode,
    isValidOrderId,
    isValidIp,
};

