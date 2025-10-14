/**
 * 函数级详细中文注释：全局配置模块
 * 
 * 职责：
 * 1. 加载环境变量
 * 2. 验证必需配置
 * 3. 提供类型转换和默认值
 */

require('dotenv').config();

/**
 * 验证必需的环境变量
 */
function validateRequiredEnv() {
    const required = [
        'WS_ENDPOINT',
        'FIAT_GATEWAY_SEED',
        'REDIS_HOST',
        'EPAY_PID',
        'EPAY_KEY',
        'EPAY_GATEWAY',
        'EPAY_NOTIFY_URL',
        'EPAY_RETURN_URL',
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
    }
}

validateRequiredEnv();

module.exports = {
    // 服务配置
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3100,
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // 区块链配置
    blockchain: {
        wsEndpoint: process.env.WS_ENDPOINT,
        fiatGatewaySeed: process.env.FIAT_GATEWAY_SEED,
    },
    
    // Redis配置
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB, 10) || 0,
    },
    
    // epay配置
    epay: {
        pid: process.env.EPAY_PID,
        key: process.env.EPAY_KEY,
        gateway: process.env.EPAY_GATEWAY,
        notifyUrl: process.env.EPAY_NOTIFY_URL,
        returnUrl: process.env.EPAY_RETURN_URL,
    },
    
    // 首购配置
    firstPurchase: {
        minAmount: parseInt(process.env.MIN_FIRST_PURCHASE_AMOUNT, 10) || 50,
        maxAmount: parseInt(process.env.MAX_FIRST_PURCHASE_AMOUNT, 10) || 100,
        expirySeconds: parseInt(process.env.ORDER_EXPIRY_SECONDS, 10) || 900,
        memoToCnyRate: parseFloat(process.env.MEMO_TO_CNY_RATE) || 0.01,
        referralDiscountRate: parseFloat(process.env.REFERRAL_DISCOUNT_RATE) || 0.9,
        treasuryAccount: process.env.TREASURY_ACCOUNT,
    },
    
    // 风控配置
    riskControl: {
        maxOrdersPerIpPerDay: parseInt(process.env.MAX_ORDERS_PER_IP_PER_DAY, 10) || 5,
        maxOrdersPerIpPerHour: parseInt(process.env.MAX_ORDERS_PER_IP_PER_HOUR, 10) || 2,
    },
    
    // 监控配置
    monitoring: {
        treasuryBalanceAlertThreshold: parseInt(process.env.TREASURY_BALANCE_ALERT_THRESHOLD, 10) || 10000,
        alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
    },
};

