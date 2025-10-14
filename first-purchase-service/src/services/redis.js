/**
 * 函数级详细中文注释：Redis服务模块
 * 
 * 职责：
 * 1. 管理Redis连接
 * 2. 提供订单存储接口
 * 3. 提供风控计数器
 * 4. 提供订单过期管理
 */

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

class RedisService {
    constructor() {
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.client.on('connect', () => {
            logger.info('Redis连接成功');
        });

        this.client.on('error', (err) => {
            logger.error('Redis连接错误:', err);
        });
    }

    /**
     * 函数级详细中文注释：创建订单
     */
    async createOrder(orderId, orderData) {
        const key = `order:${orderId}`;
        const expiryTimestamp = Date.now() + config.firstPurchase.expirySeconds * 1000;
        
        // 存储订单数据
        await this.client.hmset(key, {
            ...orderData,
            createdAt: Date.now(),
            expiresAt: expiryTimestamp,
            status: 'pending',
        });
        
        // 设置订单过期时间（秒）
        await this.client.expire(key, config.firstPurchase.expirySeconds + 60);
        
        // 添加到过期队列（用于定时检查）
        await this.client.zadd('first_purchase_orders', expiryTimestamp, orderId);
        
        logger.info('订单已创建', { orderId, expiresAt: new Date(expiryTimestamp) });
    }

    /**
     * 函数级详细中文注释：获取订单
     */
    async getOrder(orderId) {
        const key = `order:${orderId}`;
        const data = await this.client.hgetall(key);
        
        if (!data || Object.keys(data).length === 0) {
            return null;
        }
        
        return data;
    }

    /**
     * 函数级详细中文注释：更新订单状态
     */
    async updateOrderStatus(orderId, status, extraData = {}) {
        const key = `order:${orderId}`;
        
        await this.client.hmset(key, {
            status,
            updatedAt: Date.now(),
            ...extraData,
        });
        
        logger.info('订单状态已更新', { orderId, status });
    }

    /**
     * 函数级详细中文注释：检查地址是否已首购
     */
    async hasFirstPurchased(walletAddress) {
        const exists = await this.client.sismember('first_purchase_addresses', walletAddress);
        return exists === 1;
    }

    /**
     * 函数级详细中文注释：标记地址已首购
     */
    async markFirstPurchased(walletAddress, orderId) {
        await this.client.sadd('first_purchase_addresses', walletAddress);
        await this.client.hset(`address:${walletAddress}`, 'firstPurchaseOrderId', orderId);
        logger.info('地址已标记为首购', { walletAddress, orderId });
    }

    /**
     * 函数级详细中文注释：IP风控 - 每日计数
     */
    async checkIpDailyLimit(ip) {
        const today = new Date().toISOString().split('T')[0];
        const key = `ip_daily:${today}:${ip}`;
        
        const count = await this.client.incr(key);
        
        // 设置过期时间为明天凌晨
        if (count === 1) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const ttl = Math.floor((tomorrow - Date.now()) / 1000);
            await this.client.expire(key, ttl);
        }
        
        return count <= config.riskControl.maxOrdersPerIpPerDay;
    }

    /**
     * 函数级详细中文注释：IP风控 - 每小时计数
     */
    async checkIpHourlyLimit(ip) {
        const hour = new Date().toISOString().slice(0, 13);
        const key = `ip_hourly:${hour}:${ip}`;
        
        const count = await this.client.incr(key);
        
        if (count === 1) {
            await this.client.expire(key, 3600); // 1小时
        }
        
        return count <= config.riskControl.maxOrdersPerIpPerHour;
    }

    /**
     * 函数级详细中文注释：获取过期订单
     */
    async getExpiredOrders() {
        const now = Date.now();
        const expiredOrderIds = await this.client.zrangebyscore(
            'first_purchase_orders',
            0,
            now
        );
        
        return expiredOrderIds;
    }

    /**
     * 函数级详细中文注释：移除过期订单
     */
    async removeExpiredOrder(orderId) {
        await this.client.zrem('first_purchase_orders', orderId);
    }

    /**
     * 函数级详细中文注释：统计数据
     */
    async getStats() {
        const totalOrders = await this.client.zcard('first_purchase_orders');
        const totalAddresses = await this.client.scard('first_purchase_addresses');
        
        return {
            totalOrders,
            totalAddresses,
        };
    }

    /**
     * 关闭连接
     */
    async close() {
        await this.client.quit();
    }
}

module.exports = new RedisService();

