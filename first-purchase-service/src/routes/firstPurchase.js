/**
 * 函数级详细中文注释：首购API路由模块
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const validator = require('../utils/validator');
const orderService = require('../services/order');

/**
 * POST /api/first-purchase/create
 * 创建首购订单
 */
router.post('/create', async (req, res) => {
    try {
        const { walletAddress, amount, referralCode } = req.body;
        
        // 验证参数
        if (!walletAddress || !validator.isValidSubstrateAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: '无效的钱包地址',
            });
        }
        
        if (!amount || !validator.isValidFirstPurchaseAmount(amount)) {
            return res.status(400).json({
                success: false,
                error: '金额必须在50-100 MEMO之间',
            });
        }
        
        if (referralCode && !validator.isValidReferralCode(referralCode)) {
            return res.status(400).json({
                success: false,
                error: '无效的推荐码格式',
            });
        }
        
        // 获取客户端IP
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // 创建订单
        const result = await orderService.createOrder({
            walletAddress,
            amount: parseInt(amount, 10),
            referralCode: referralCode || null,
            clientIp,
        });
        
        res.json({
            success: true,
            data: result,
        });
        
    } catch (error) {
        logger.error('创建订单API错误', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/first-purchase/notify
 * epay支付回调接口
 */
router.post('/notify', async (req, res) => {
    try {
        logger.info('收到支付回调', req.body);
        
        // 处理回调
        const result = await orderService.handlePaymentCallback(req.body);
        
        if (result.success) {
            // 返回success给epay
            res.send('success');
        } else {
            res.send('fail');
        }
        
    } catch (error) {
        logger.error('支付回调处理错误', { error: error.message });
        res.send('fail');
    }
});

/**
 * GET /api/first-purchase/status/:orderId
 * 查询订单状态
 */
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // 验证订单ID格式
        if (!validator.isValidOrderId(orderId)) {
            return res.status(400).json({
                success: false,
                error: '无效的订单ID格式',
            });
        }
        
        // 查询订单
        const result = await orderService.getOrderStatus(orderId);
        
        res.json({
            success: true,
            data: result,
        });
        
    } catch (error) {
        logger.error('查询订单API错误', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/first-purchase/check/:walletAddress
 * 检查地址是否已首购
 */
router.get('/check/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        // 验证地址
        if (!validator.isValidSubstrateAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: '无效的钱包地址',
            });
        }
        
        // 查询链上数据
        const blockchainService = require('../services/blockchain');
        const hasFirstPurchased = await blockchainService.hasFirstPurchased(walletAddress);
        
        res.json({
            success: true,
            data: {
                walletAddress,
                hasFirstPurchased,
            },
        });
        
    } catch (error) {
        logger.error('检查首购API错误', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 🆕 GET /api/first-purchase/market-makers/available
 * 查询可用做市商列表
 */
router.get('/market-makers/available', async (req, res) => {
    try {
        const marketMakerService = require('../services/marketMaker');
        const result = await marketMakerService.getAvailableMarketMakers();
        
        res.json({
            success: true,
            data: result,
        });
        
    } catch (error) {
        logger.error('查询做市商列表API错误', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 🆕 GET /api/first-purchase/market-makers/:mmId
 * 查询指定做市商详情
 */
router.get('/market-makers/:mmId', async (req, res) => {
    try {
        const { mmId } = req.params;
        
        // 验证做市商ID
        const mmIdNum = parseInt(mmId, 10);
        if (isNaN(mmIdNum) || mmIdNum < 0) {
            return res.status(400).json({
                success: false,
                error: '无效的做市商ID',
            });
        }
        
        const marketMakerService = require('../services/marketMaker');
        const result = await marketMakerService.getMarketMakerInfo(mmIdNum);
        
        res.json({
            success: true,
            data: result,
        });
        
    } catch (error) {
        logger.error('查询做市商详情API错误', { mmId: req.params.mmId, error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/first-purchase/health
 * 健康检查
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'first-purchase-service',
        status: 'running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;

