/**
 * 函数级详细中文注释：配置文件
 * - 加载环境变量
 * - 导出配置对象
 */
require('dotenv').config();

module.exports = {
  // 链配置
  chain: {
    wsEndpoint: process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944',
    makerSeed: process.env.MAKER_SEED || '//Alice',
  },

  // EPAY数据库配置
  epay: {
    host: process.env.EPAY_DB_HOST || 'localhost',
    port: parseInt(process.env.EPAY_DB_PORT) || 3306,
    user: process.env.EPAY_DB_USER || 'epay',
    password: process.env.EPAY_DB_PASSWORD || 'password',
    database: process.env.EPAY_DB_NAME || 'epay',
  },

  // Redis配置
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // 服务配置
  service: {
    pollInterval: parseInt(process.env.POLL_INTERVAL) || 30000,
    port: parseInt(process.env.PORT) || 3000,
  },

  // 安全配置
  security: {
    maxSingleAmount: parseFloat(process.env.MAX_SINGLE_AMOUNT) || 10000,
    maxDailyAmount: parseFloat(process.env.MAX_DAILY_AMOUNT) || 100000,
    minReserveBalance: parseFloat(process.env.MIN_RESERVE_BALANCE) || 50000,
    reserveBuffer: 1000, // MEMO
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/service.log',
  },

  // 告警配置
  alerts: {
    email: process.env.ALERT_EMAIL,
    webhook: process.env.ALERT_WEBHOOK,
  },
};

