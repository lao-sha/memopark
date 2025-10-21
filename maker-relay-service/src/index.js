/**
 * 函数级详细中文注释：做市商中继服务主程序
 * - 接收 EPAY 支付通知
 * - 验证签名和 IP 白名单
 * - 调用链上接口标记订单已支付
 * - 返回 success 给 EPAY
 */

const express = require('express');
const cors = require('cors');
const { connectChain, markOrderPaid, getOrder } = require('./chain');
const { verifyEpaySign, verifyIPWhitelist } = require('./utils');
const logger = require('./logger');
require('dotenv').config();

const app = express();

// 配置
const CONFIG = {
  EPAY_PID: process.env.EPAY_PID,
  EPAY_KEY: process.env.EPAY_KEY,
  CHAIN_WS: process.env.CHAIN_WS || 'ws://127.0.0.1:9944',
  MAKER_MNEMONIC: process.env.MAKER_MNEMONIC,
  MM_ID: parseInt(process.env.MM_ID || '1'),
  PORT: parseInt(process.env.PORT || '3000'),
  ALLOWED_IPS: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [],
};

// 验证必要的配置
if (!CONFIG.EPAY_PID || !CONFIG.EPAY_KEY) {
  logger.error('❌ 缺少 EPAY 配置: EPAY_PID 和 EPAY_KEY 是必需的');
  process.exit(1);
}

if (!CONFIG.MAKER_MNEMONIC) {
  logger.error('❌ 缺少 MAKER_MNEMONIC 配置');
  process.exit(1);
}

// 全局变量
let chainApi = null;
let makerAccount = null;
let isReady = false;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  logger.info(`📨 ${req.method} ${req.path} from ${clientIP}`);
  next();
});

/**
 * 函数级详细中文注释：初始化服务
 * - 连接到链
 * - 加载做市商账户
 */
async function init() {
  try {
    logger.info('🚀 正在初始化做市商中继服务...');
    logger.info('📋 配置信息:', {
      EPAY_PID: CONFIG.EPAY_PID,
      MM_ID: CONFIG.MM_ID,
      CHAIN_WS: CONFIG.CHAIN_WS,
      PORT: CONFIG.PORT,
    });
    
    // 连接到链
    const { api, account } = await connectChain(
      CONFIG.CHAIN_WS,
      CONFIG.MAKER_MNEMONIC
    );
    
    chainApi = api;
    makerAccount = account;
    isReady = true;
    
    logger.info('✅ 服务初始化完成');
    
  } catch (error) {
    logger.error('❌ 服务初始化失败:', error);
    process.exit(1);
  }
}

/**
 * 函数级详细中文注释：接收 EPAY 异步通知
 * @route GET /api/relay/notify
 * @query {string} pid - 商户ID
 * @query {string} trade_no - EPAY 订单号
 * @query {string} out_trade_no - 链上订单ID
 * @query {string} type - 支付方式
 * @query {string} name - 商品名称
 * @query {string} money - 支付金额
 * @query {string} trade_status - 交易状态
 * @query {string} sign - 签名
 * @query {string} sign_type - 签名类型
 * @query {string} [param] - 业务扩展参数（买家地址）
 */
app.get('/api/relay/notify', async (req, res) => {
  logger.info('📬 收到 EPAY 通知', { query: req.query });
  
  try {
    // 1. 检查服务是否就绪
    if (!isReady) {
      logger.error('❌ 服务未就绪');
      return res.send('fail');
    }
    
    // 2. 验证 IP 白名单
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!verifyIPWhitelist(clientIP, CONFIG.ALLOWED_IPS)) {
      logger.error('❌ IP 验证失败:', clientIP);
      return res.send('fail');
    }
    
    const {
      pid,
      trade_no,
      out_trade_no,
      type,
      name,
      money,
      trade_status,
      sign,
      sign_type,
      param
    } = req.query;
    
    // 3. 验证必填参数
    if (!pid || !trade_no || !out_trade_no || !money || !trade_status || !sign) {
      logger.error('❌ 缺少必填参数');
      return res.send('fail');
    }
    
    // 4. 验证商户ID
    if (pid !== CONFIG.EPAY_PID) {
      logger.error('❌ 商户ID不匹配:', { expected: CONFIG.EPAY_PID, received: pid });
      return res.send('fail');
    }
    
    // 5. 验证签名
    if (!verifyEpaySign(req.query, CONFIG.EPAY_KEY)) {
      logger.error('❌ 签名验证失败');
      return res.send('fail');
    }
    
    logger.info('✅ 签名验证通过');
    
    // 6. 检查交易状态
    if (trade_status !== 'TRADE_SUCCESS') {
      logger.warn(`⚠️  非成功状态: ${trade_status}, 订单: ${out_trade_no}`);
      return res.send('success');  // 返回 success 避免重复通知
    }
    
    // 7. 查询订单是否存在
    logger.info(`🔍 查询链上订单: ${out_trade_no}`);
    const order = await getOrder(chainApi, out_trade_no);
    
    if (!order) {
      logger.error(`❌ 订单不存在: ${out_trade_no}`);
      return res.send('fail');
    }
    
    logger.info('📋 订单信息:', order);
    
    // 8. 检查订单状态（避免重复标记）
    if (order.status !== 'Pending') {
      logger.warn(`⚠️  订单状态非 Pending: ${order.status}, 跳过处理`);
      return res.send('success');
    }
    
    // 9. 调用链上接口标记订单已支付
    logger.info(`💰 订单支付成功，准备上链: ${out_trade_no}`);
    
    const result = await markOrderPaid(
      chainApi,
      makerAccount,
      {
        orderId: out_trade_no,
        epayTradeNo: trade_no,
        amount: money,
        buyerAddress: param,
      }
    );
    
    logger.info(`✅ 订单 ${out_trade_no} 已成功标记为已支付`, result);
    
    // 10. 返回 success 给 EPAY
    res.send('success');
    
  } catch (error) {
    logger.error('❌ 处理通知失败:', error);
    // 返回 success 避免 EPAY 重复通知，记录错误供后续手动处理
    res.send('success');
  }
});

/**
 * 函数级详细中文注释：健康检查
 * @route GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: isReady ? 'ok' : 'initializing',
    service: 'maker-relay-service',
    mmId: CONFIG.MM_ID,
    pid: CONFIG.EPAY_PID,
    chain: chainApi ? 'connected' : 'disconnected',
    address: makerAccount?.address,
  });
});

/**
 * 函数级详细中文注释：获取做市商配置信息
 * @route GET /api/info
 */
app.get('/api/info', (req, res) => {
  res.json({
    mmId: CONFIG.MM_ID,
    pid: CONFIG.EPAY_PID,
    address: makerAccount?.address,
    notifyUrl: `http://${req.get('host')}/api/relay/notify`,
    status: isReady ? 'ready' : 'initializing',
  });
});

/**
 * 函数级详细中文注释：测试签名验证（开发用）
 * @route POST /api/test/verify-sign
 */
app.post('/api/test/verify-sign', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  const { params, key } = req.body;
  const isValid = verifyEpaySign(params, key || CONFIG.EPAY_KEY);
  
  res.json({
    valid: isValid,
    params: params,
  });
});

/**
 * 函数级详细中文注释：手动标记订单已支付（应急用）
 * @route POST /api/manual/mark-paid
 */
app.post('/api/manual/mark-paid', async (req, res) => {
  try {
    const { orderId, epayTradeNo, amount } = req.body;
    
    if (!orderId || !epayTradeNo) {
      return res.status(400).json({ error: '缺少必填参数' });
    }
    
    logger.info(`🔧 手动标记订单: ${orderId}`);
    
    const result = await markOrderPaid(
      chainApi,
      makerAccount,
      {
        orderId,
        epayTradeNo,
        amount: amount || '0.00',
      }
    );
    
    res.json({
      success: true,
      result: result,
    });
    
  } catch (error) {
    logger.error('❌ 手动标记失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理
app.use((error, req, res, next) => {
  logger.error('❌ 服务器错误:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 启动服务
init().then(() => {
  app.listen(CONFIG.PORT, '0.0.0.0', () => {
    logger.info(`✅ 中继服务启动成功`);
    logger.info(`📍 服务地址: http://0.0.0.0:${CONFIG.PORT}`);
    logger.info(`📍 Notify URL: http://您的域名:${CONFIG.PORT}/api/relay/notify`);
    logger.info(`💼 商户ID: ${CONFIG.EPAY_PID}`);
    logger.info(`🆔 做市商ID: ${CONFIG.MM_ID}`);
  });
});

// 优雅退出
process.on('SIGINT', async () => {
  logger.info('👋 正在关闭服务...');
  
  if (chainApi) {
    await chainApi.disconnect();
    logger.info('🔌 链连接已断开');
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('👋 收到 SIGTERM 信号，正在关闭...');
  
  if (chainApi) {
    await chainApi.disconnect();
  }
  
  process.exit(0);
});

// 未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('💥 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 未处理的 Promise 拒绝:', reason);
});

module.exports = app;

