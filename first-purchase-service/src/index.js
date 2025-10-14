/**
 * 函数级详细中文注释：首购法币支付网关服务主入口
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const blockchainService = require('./services/blockchain');
const orderService = require('./services/order');
const firstPurchaseRoutes = require('./routes/firstPurchase');

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        body: req.body,
    });
    next();
});

// 路由
app.use('/api/first-purchase', firstPurchaseRoutes);

// OCW路由（如果使用OCW模式）
const ocwRoutes = require('./routes/ocw');
app.use('/api/ocw', ocwRoutes);

// 根路径
app.get('/', (req, res) => {
    res.json({
        service: 'MemoPark First Purchase Service',
        version: '1.0.0',
        status: 'running',
    });
});

// 错误处理
app.use((err, req, res, next) => {
    logger.error('未捕获错误', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
    });
});

// 启动服务
async function start() {
    try {
        // 初始化区块链连接
        logger.info('正在连接区块链...');
        await blockchainService.initialize();
        
        // 启动定时任务：处理过期订单
        setInterval(() => {
            orderService.processExpiredOrders();
        }, 30000); // 每30秒检查一次
        
        // 启动HTTP服务
        app.listen(config.port, () => {
            logger.info(`首购服务已启动`, {
                port: config.port,
                env: config.env,
            });
        });
        
    } catch (error) {
        logger.error('服务启动失败', { error: error.message });
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', async () => {
    logger.info('收到SIGINT信号，正在关闭服务...');
    await blockchainService.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('收到SIGTERM信号，正在关闭服务...');
    await blockchainService.close();
    process.exit(0);
});

// 启动
start();

