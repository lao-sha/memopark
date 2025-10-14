/**
 * 函数级详细中文注释：订单管理服务模块
 * 
 * 职责：
 * 1. 创建首购订单
 * 2. 处理支付回调
 * 3. 查询订单状态
 * 4. 处理订单过期
 */

const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const redisService = require('./redis');
const blockchainService = require('./blockchain');
const epayService = require('./epay');

class OrderService {
    /**
     * 函数级详细中文注释：生成订单ID
     * 格式: MEMO_YYYYMMDD_随机8位
     */
    generateOrderId() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
        return `MEMO_${date}_${random}`;
    }

    /**
     * 函数级详细中文注释：计算支付金额
     * 
     * @param {Number} memoAmount - MEMO数量
     * @param {Boolean} hasReferrer - 是否有推荐人
     * @returns {Object} - { total, discount, final }
     */
    calculatePaymentAmount(memoAmount, hasReferrer) {
        // MEMO转CNY
        const total = memoAmount * config.firstPurchase.memoToCnyRate;
        
        // 有推荐人打9折
        const discount = hasReferrer ? (1 - config.firstPurchase.referralDiscountRate) : 0;
        const final = hasReferrer ? total * config.firstPurchase.referralDiscountRate : total;
        
        return {
            total,
            discount,
            final,
        };
    }

    /**
     * 函数级详细中文注释：创建首购订单
     */
    async createOrder({ walletAddress, amount, referralCode, clientIp }) {
        try {
            // 1. 验证金额范围
            if (amount < config.firstPurchase.minAmount || amount > config.firstPurchase.maxAmount) {
                throw new Error(`金额必须在${config.firstPurchase.minAmount}-${config.firstPurchase.maxAmount} MEMO之间`);
            }
            
            // 2. 检查是否已首购（链上查询）
            const hasFirstPurchased = await blockchainService.hasFirstPurchased(walletAddress);
            if (hasFirstPurchased) {
                throw new Error('该地址已完成首购');
            }
            
            // 3. 检查是否已首购（链下缓存）
            const hasCachedPurchase = await redisService.hasFirstPurchased(walletAddress);
            if (hasCachedPurchase) {
                throw new Error('该地址已完成首购');
            }
            
            // 4. IP风控
            const dailyLimitOk = await redisService.checkIpDailyLimit(clientIp);
            if (!dailyLimitOk) {
                throw new Error('您今日创建订单次数已达上限');
            }
            
            const hourlyLimitOk = await redisService.checkIpHourlyLimit(clientIp);
            if (!hourlyLimitOk) {
                throw new Error('您本小时创建订单次数已达上限');
            }
            
            // 5. 处理推荐码（可选）
            let referrer = null;
            if (referralCode) {
                // 查询推荐人
                referrer = await blockchainService.getReferrerByCode(referralCode);
                if (!referrer) {
                    throw new Error('无效的推荐码');
                }
                
                // 验证推荐人是否有效会员
                const isValid = await blockchainService.isValidMember(referrer);
                if (!isValid) {
                    throw new Error('推荐人不是有效会员');
                }
            }
            
            // 6. 计算支付金额
            const payment = this.calculatePaymentAmount(amount, !!referrer);
            
            // 7. 生成订单ID
            const orderId = this.generateOrderId();
            
            // 8. 创建epay支付订单
            const paymentUrl = epayService.createPayment({
                orderId,
                amount: payment.final,
                name: `MEMO首购 ${amount} MEMO`,
            });
            
            // 9. 保存订单到Redis
            const expiresAt = Date.now() + config.firstPurchase.expirySeconds * 1000;
            await redisService.createOrder(orderId, {
                walletAddress,
                amount,
                referrer: referrer || '',
                referralCode: referralCode || '',
                paymentAmount: payment.final,
                paymentDiscount: payment.discount,
                paymentUrl,
                clientIp,
            });
            
            logger.info('首购订单已创建', {
                orderId,
                walletAddress,
                amount,
                referrer: referrer || 'None',
                paymentAmount: payment.final,
            });
            
            return {
                orderId,
                paymentUrl,
                amount,
                paymentAmount: payment.final,
                discount: payment.discount,
                referrer,
                expiresAt: new Date(expiresAt).toISOString(),
                countdown: config.firstPurchase.expirySeconds,
            };
            
        } catch (error) {
            logger.error('创建订单失败', {
                walletAddress,
                amount,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 函数级详细中文注释：处理支付回调
     */
    async handlePaymentCallback(callbackData) {
        try {
            // 1. 验证支付签名
            const paymentResult = epayService.handleCallback(callbackData);
            if (!paymentResult.success) {
                throw new Error(paymentResult.error);
            }
            
            const { orderId, tradeNo, amount } = paymentResult;
            
            // 2. 查询订单
            const order = await redisService.getOrder(orderId);
            if (!order) {
                throw new Error('订单不存在');
            }
            
            // 3. 检查订单状态
            if (order.status === 'completed') {
                logger.warn('订单已完成，忽略重复回调', { orderId });
                return { success: true, message: 'Order already completed' };
            }
            
            if (order.status === 'expired') {
                throw new Error('订单已过期');
            }
            
            // 4. 验证金额
            const expectedAmount = parseFloat(order.paymentAmount);
            if (Math.abs(amount - expectedAmount) > 0.01) {
                throw new Error(`支付金额不匹配: 期望${expectedAmount}，实际${amount}`);
            }
            
            // 5. 更新订单状态为已支付
            await redisService.updateOrderStatus(orderId, 'paid', {
                tradeNo,
                paidAt: Date.now(),
            });
            
            // 6. 调用链上接口
            const memoAmount = parseInt(order.amount, 10);
            const buyer = order.walletAddress;
            const referrer = order.referrer || null;
            
            logger.info('准备调用链上接口', {
                orderId,
                buyer,
                memoAmount,
                referrer: referrer || 'None',
            });
            
            const blockchainResult = await blockchainService.callFirstPurchaseByFiat({
                buyer,
                amount: memoAmount,
                referrer,
                orderId,
            });
            
            // 7. 更新订单状态为已完成
            await redisService.updateOrderStatus(orderId, 'completed', {
                completedAt: Date.now(),
                blockHash: blockchainResult.blockHash,
            });
            
            // 8. 标记地址已首购
            await redisService.markFirstPurchased(buyer, orderId);
            
            logger.info('首购订单已完成', {
                orderId,
                buyer,
                amount: memoAmount,
                blockHash: blockchainResult.blockHash,
            });
            
            return {
                success: true,
                orderId,
                blockHash: blockchainResult.blockHash,
            };
            
        } catch (error) {
            logger.error('处理支付回调失败', {
                orderId: callbackData.out_trade_no,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 函数级详细中文注释：查询订单状态
     */
    async getOrderStatus(orderId) {
        try {
            const order = await redisService.getOrder(orderId);
            
            if (!order) {
                return {
                    exists: false,
                    message: '订单不存在',
                };
            }
            
            const now = Date.now();
            const expiresAt = parseInt(order.expiresAt, 10);
            const countdown = Math.max(0, Math.floor((expiresAt - now) / 1000));
            
            // 检查是否过期
            if (order.status === 'pending' && now > expiresAt) {
                await redisService.updateOrderStatus(orderId, 'expired');
                order.status = 'expired';
            }
            
            return {
                exists: true,
                orderId,
                status: order.status,
                walletAddress: order.walletAddress,
                amount: parseInt(order.amount, 10),
                paymentAmount: parseFloat(order.paymentAmount),
                referrer: order.referrer || null,
                paymentUrl: order.paymentUrl,
                expiresAt: new Date(expiresAt).toISOString(),
                countdown,
                blockHash: order.blockHash || null,
                createdAt: new Date(parseInt(order.createdAt, 10)).toISOString(),
            };
            
        } catch (error) {
            logger.error('查询订单失败', { orderId, error: error.message });
            throw error;
        }
    }

    /**
     * 函数级详细中文注释：处理过期订单（定时任务调用）
     */
    async processExpiredOrders() {
        try {
            const expiredOrderIds = await redisService.getExpiredOrders();
            
            if (expiredOrderIds.length === 0) {
                return;
            }
            
            logger.info('发现过期订单', { count: expiredOrderIds.length });
            
            for (const orderId of expiredOrderIds) {
                const order = await redisService.getOrder(orderId);
                
                if (order && order.status === 'pending') {
                    await redisService.updateOrderStatus(orderId, 'expired');
                    logger.info('订单已标记为过期', { orderId });
                }
                
                // 从过期队列移除
                await redisService.removeExpiredOrder(orderId);
            }
            
        } catch (error) {
            logger.error('处理过期订单失败', { error: error.message });
        }
    }
}

module.exports = new OrderService();

