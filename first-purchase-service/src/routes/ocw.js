/**
 * 函数级详细中文注释：OCW查询接口
 * 
 * 提供给链上OCW查询待处理订单的HTTP接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * GET /api/ocw/pending-orders
 * 获取所有待处理订单（供OCW查询）
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "buyer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
 *       "amount": 80000000000000,  // 80 MEMO的最小单位
 *       "referrer": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty" | null,
 *       "order_id": "MEMO_20251013_A1B2C3D4"
 *     }
 *   ]
 * }
 */
router.get('/pending-orders', async (req, res) => {
    try {
        logger.info('OCW请求待处理订单', {
            ip: req.ip,
            timestamp: new Date().toISOString(),
        });
        
        const redisService = require('../services/redis');
        
        // 1. ✅ 从Redis获取所有待处理订单的key
        const keys = await redisService.client.keys('pending_order:*');
        
        logger.info(`找到 ${keys.length} 个待处理订单key`);
        
        const orders = [];
        const now = Date.now();
        
        // 2. ✅ 遍历每个订单
        for (const key of keys) {
            try {
                const orderData = await redisService.client.hgetall(key);
                
                // 检查订单数据完整性
                if (!orderData || !orderData.walletAddress || !orderData.amount) {
                    logger.warn('订单数据不完整', { key });
                    continue;
                }
                
                // 3. ✅ 检查订单是否未过期
                const expiresAt = parseInt(orderData.expiresAt, 10);
                if (now >= expiresAt) {
                    logger.info('订单已过期，跳过', {
                        orderId: orderData.orderId,
                        expiresAt: new Date(expiresAt).toISOString(),
                    });
                    continue;
                }
                
                // 4. ✅ 检查订单状态
                if (orderData.status !== 'paid') {
                    logger.info('订单未支付，跳过', {
                        orderId: orderData.orderId,
                        status: orderData.status,
                    });
                    continue;
                }
                
                // 5. ✅ 构建订单对象
                const order = {
                    buyer: orderData.walletAddress,
                    amount: parseInt(orderData.amount, 10) * 1_000_000_000_000, // MEMO转最小单位
                    referrer: orderData.referrer || null,
                    order_id: orderData.orderId,
                };
                
                orders.push(order);
                
                logger.debug('添加订单到待处理列表', {
                    orderId: orderData.orderId,
                    buyer: orderData.walletAddress.slice(0, 10) + '...',
                    amount: orderData.amount,
                });
                
            } catch (err) {
                logger.error('处理订单失败', {
                    key,
                    error: err.message,
                });
            }
        }
        
        logger.info(`返回 ${orders.length} 个待处理订单给OCW`);
        
        // 6. ✅ 返回订单列表
        res.json({
            success: true,
            data: orders,
            timestamp: new Date().toISOString(),
            count: orders.length,
        });
        
    } catch (error) {
        logger.error('获取待处理订单失败', {
            error: error.message,
            stack: error.stack,
        });
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * POST /api/ocw/mark-processed
 * 标记订单已被OCW处理（可选接口）
 * 
 * 请求体：
 * {
 *   "order_id": "MEMO_20251013_A1B2C3D4",
 *   "block_hash": "0x1234..."
 * }
 */
router.post('/mark-processed', async (req, res) => {
    try {
        const { order_id, block_hash } = req.body;
        
        if (!order_id) {
            return res.status(400).json({
                success: false,
                error: 'order_id is required',
            });
        }
        
        logger.info('标记订单已处理', { order_id, block_hash });
        
        const redisService = require('../services/redis');
        
        // 更新订单状态
        await redisService.updateOrderStatus(order_id, 'completed', {
            completedAt: Date.now(),
            blockHash: block_hash,
            processedBy: 'OCW',
        });
        
        // 从待处理队列移除
        await redisService.client.del(`pending_order:${order_id}`);
        
        res.json({
            success: true,
            message: 'Order marked as processed',
        });
        
    } catch (error) {
        logger.error('标记订单失败', {
            error: error.message,
        });
        
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/ocw/health
 * OCW服务健康检查
 */
router.get('/health', async (req, res) => {
    try {
        const redisService = require('../services/redis');
        
        // 检查Redis连接
        await redisService.client.ping();
        
        // 获取待处理订单数量
        const keys = await redisService.client.keys('pending_order:*');
        
        res.json({
            success: true,
            service: 'ocw-api',
            status: 'healthy',
            redis: 'connected',
            pending_orders: keys.length,
            timestamp: new Date().toISOString(),
        });
        
    } catch (error) {
        logger.error('健康检查失败', { error: error.message });
        
        res.status(503).json({
            success: false,
            service: 'ocw-api',
            status: 'unhealthy',
            error: error.message,
        });
    }
});

module.exports = router;

