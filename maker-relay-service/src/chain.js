/**
 * 函数级详细中文注释：链交互模块
 * - 连接到 Memopark 链
 * - 调用 mark_order_paid 接口标记订单已支付
 * - 处理交易结果和错误
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const logger = require('./logger');

/**
 * 函数级详细中文注释：连接到链
 * @param {string} wsUrl - WebSocket 地址
 * @param {string} mnemonic - 做市商账户助记词
 * @returns {Promise<{api: ApiPromise, account: KeyringPair}>}
 */
async function connectChain(wsUrl, mnemonic) {
  logger.info(`🔗 正在连接到链: ${wsUrl}`);
  
  const provider = new WsProvider(wsUrl, 1000, {}, 10000);
  
  // 监听连接事件
  provider.on('connected', () => {
    logger.info('✅ WebSocket 连接成功');
  });
  
  provider.on('disconnected', () => {
    logger.warn('⚠️  WebSocket 连接断开');
  });
  
  provider.on('error', (error) => {
    logger.error('❌ WebSocket 错误:', error);
  });
  
  const api = await ApiPromise.create({ provider });
  
  const keyring = new Keyring({ type: 'sr25519' });
  const account = keyring.addFromMnemonic(mnemonic);
  
  // 获取链信息
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
  ]);
  
  logger.info(`✅ 链连接成功: ${chain} - ${nodeName} v${nodeVersion}`);
  logger.info(`📍 做市商账户: ${account.address}`);
  
  // 获取账户余额
  const { data: balance } = await api.query.system.account(account.address);
  logger.info(`💰 账户余额: ${balance.free.toHuman()}`);
  
  return { api, account };
}

/**
 * 函数级详细中文注释：标记订单已支付
 * @param {ApiPromise} api - API 实例
 * @param {KeyringPair} account - 做市商账户
 * @param {Object} proof - 支付证明
 * @param {string} proof.orderId - 订单ID
 * @param {string} proof.epayTradeNo - EPAY 交易号
 * @param {string} proof.amount - 支付金额
 * @param {string} proof.buyerAddress - 买家地址
 * @returns {Promise<Object>} 交易结果
 */
async function markOrderPaid(api, account, proof) {
  logger.info('📝 准备调用链上接口: mark_order_paid', {
    orderId: proof.orderId,
    epayTradeNo: proof.epayTradeNo,
    amount: proof.amount,
  });
  
  try {
    // 构造交易
    const tx = api.tx.otcOrder.markOrderPaidByMaker(
      proof.orderId,
      proof.epayTradeNo
    );
    
    // 签名并发送
    return new Promise((resolve, reject) => {
      const unsub = tx.signAndSend(account, ({ status, events, dispatchError }) => {
        logger.debug(`📡 交易状态: ${status.type}`);
        
        if (status.isInBlock) {
          logger.info(`📦 交易已打包到区块: ${status.asInBlock.toHex()}`);
          
          // 检查是否有错误
          if (dispatchError) {
            let errorInfo = '';
            
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
            } else {
              errorInfo = dispatchError.toString();
            }
            
            logger.error('❌ 链上错误:', errorInfo);
            unsub.then(() => reject(new Error(errorInfo)));
            return;
          }
          
          // 查找成功事件
          let successEvent = null;
          events.forEach(({ event }) => {
            logger.debug(`📋 事件: ${event.section}.${event.method}`);
            
            // 查找 PaymentConfirmedByMaker 事件
            if (event.section === 'otcOrder' && event.method === 'PaymentConfirmedByMaker') {
              successEvent = event;
              logger.info('✅ PaymentConfirmedByMaker 事件已触发');
            }
          });
          
          unsub.then(() => resolve({
            success: true,
            blockHash: status.asInBlock.toHex(),
            orderId: proof.orderId,
            epayTradeNo: proof.epayTradeNo,
            event: successEvent ? successEvent.toHuman() : null,
          }));
          
        } else if (status.isFinalized) {
          logger.info(`🎉 交易已最终确认: ${status.asFinalized.toHex()}`);
        }
      }).catch((error) => {
        logger.error('❌ 交易发送失败:', error);
        reject(error);
      });
    });
    
  } catch (error) {
    logger.error('❌ 调用链上接口失败:', error);
    throw error;
  }
}

/**
 * 函数级详细中文注释：获取订单信息
 * @param {ApiPromise} api - API 实例
 * @param {string} orderId - 订单ID
 * @returns {Promise<Object>} 订单信息
 */
async function getOrder(api, orderId) {
  try {
    const order = await api.query.marketMaker.orders(orderId);
    
    if (order.isEmpty) {
      return null;
    }
    
    return order.toHuman();
  } catch (error) {
    logger.error('❌ 查询订单失败:', error);
    throw error;
  }
}

/**
 * 函数级详细中文注释：获取做市商信息
 * @param {ApiPromise} api - API 实例
 * @param {number} mmId - 做市商ID
 * @returns {Promise<Object>} 做市商信息
 */
async function getMarketMaker(api, mmId) {
  try {
    const mm = await api.query.marketMaker.marketMakers(mmId);
    
    if (mm.isEmpty) {
      return null;
    }
    
    return mm.toHuman();
  } catch (error) {
    logger.error('❌ 查询做市商失败:', error);
    throw error;
  }
}

module.exports = {
  connectChain,
  markOrderPaid,
  getOrder,
  getMarketMaker,
};

