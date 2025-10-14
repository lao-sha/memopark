/**
 * 函数级详细中文注释：做市商服务模块
 * 
 * 功能：
 * 1. 查询可用做市商列表
 * 2. 查询做市商详情
 * 3. 检查做市商服务状态
 * 4. 获取最佳做市商（自动选择）
 */

const logger = require('../utils/logger');
const blockchainService = require('./blockchain');

const marketMakerService = {
    /**
     * 函数级详细中文注释：获取所有可用做市商
     * 
     * 查询链上ActiveMarketMakers存储，返回所有活跃做市商的状态信息
     * 
     * @returns {Promise<Object>} { marketMakers: MarketMakerStatus[] }
     */
    async getAvailableMarketMakers() {
        try {
            const api = blockchainService.getApi();
            
            // 查询所有活跃做市商
            const entries = await api.query.marketMaker.activeMarketMakers.entries();
            
            if (!entries || entries.length === 0) {
                logger.warn('未找到活跃做市商');
                return { marketMakers: [] };
            }
            
            const marketMakers = [];
            
            // 遍历所有做市商
            for (const [storageKey, application] of entries) {
                const mmId = storageKey.args[0].toNumber();
                const appData = application.toJSON();
                
                // 计算可用余额
                const totalBalance = appData.firstPurchasePool || 0;
                const usedBalance = appData.firstPurchaseUsed || 0;
                const frozenBalance = appData.firstPurchaseFrozen || 0;
                const availableBalance = Math.max(0, totalBalance - usedBalance - frozenBalance);
                
                // 判断是否可提供服务
                const servicePaused = appData.servicePaused || false;
                const canServe = !servicePaused && availableBalance >= 100; // 至少100 MEMO
                
                // 确定状态
                let status = 'active';
                if (servicePaused) {
                    status = 'paused';
                } else if (availableBalance < 100) {
                    status = 'insufficient';
                }
                
                marketMakers.push({
                    mmId,
                    status,
                    servicePaused,
                    availableBalance,
                    frozenBalance,
                    totalBalance,
                    usedBalance,
                    canServe,
                    epayGateway: appData.epayGateway,
                    epayPid: appData.epayPid,
                    epayKey: appData.epayKey,
                });
            }
            
            // 按可用余额降序排序
            marketMakers.sort((a, b) => b.availableBalance - a.availableBalance);
            
            logger.info('查询到做市商', { count: marketMakers.length });
            
            return { marketMakers };
            
        } catch (error) {
            logger.error('查询做市商失败', { error: error.message });
            throw new Error('查询做市商失败: ' + error.message);
        }
    },
    
    /**
     * 函数级详细中文注释：获取指定做市商详情
     * 
     * @param {number} mmId - 做市商ID
     * @returns {Promise<Object>} MarketMakerStatus
     */
    async getMarketMakerInfo(mmId) {
        try {
            const api = blockchainService.getApi();
            
            // 查询做市商信息
            const application = await api.query.marketMaker.activeMarketMakers(mmId);
            
            if (application.isNone) {
                throw new Error('做市商不存在或未激活');
            }
            
            const appData = application.toJSON();
            
            // 计算可用余额
            const totalBalance = appData.firstPurchasePool || 0;
            const usedBalance = appData.firstPurchaseUsed || 0;
            const frozenBalance = appData.firstPurchaseFrozen || 0;
            const availableBalance = Math.max(0, totalBalance - usedBalance - frozenBalance);
            
            // 判断是否可提供服务
            const servicePaused = appData.servicePaused || false;
            const canServe = !servicePaused && availableBalance >= 100;
            
            // 确定状态
            let status = 'active';
            if (servicePaused) {
                status = 'paused';
            } else if (availableBalance < 100) {
                status = 'insufficient';
            }
            
            return {
                mmId,
                status,
                servicePaused,
                availableBalance,
                frozenBalance,
                totalBalance,
                usedBalance,
                canServe,
                epayGateway: appData.epayGateway,
                epayPid: appData.epayPid,
                epayKey: appData.epayKey,
            };
            
        } catch (error) {
            logger.error('查询做市商详情失败', { mmId, error: error.message });
            throw new Error('查询做市商详情失败: ' + error.message);
        }
    },
    
    /**
     * 函数级详细中文注释：选择最佳可用做市商
     * 
     * 自动选择可用余额最高且服务正常的做市商
     * 
     * @returns {Promise<Object>} MarketMakerStatus 或 null
     */
    async selectBestMarketMaker() {
        try {
            const { marketMakers } = await this.getAvailableMarketMakers();
            
            // 筛选可提供服务的做市商
            const available = marketMakers.filter(mm => mm.canServe);
            
            if (available.length === 0) {
                logger.warn('没有可用的做市商');
                return null;
            }
            
            // 返回可用余额最高的做市商
            const best = available[0]; // 已按余额降序排序
            
            logger.info('选择最佳做市商', {
                mmId: best.mmId,
                availableBalance: best.availableBalance,
            });
            
            return best;
            
        } catch (error) {
            logger.error('选择做市商失败', { error: error.message });
            throw new Error('选择做市商失败: ' + error.message);
        }
    },
};

module.exports = marketMakerService;

