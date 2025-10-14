/**
 * 函数级详细中文注释：区块链交互服务模块
 * 
 * 职责：
 * 1. 连接到Substrate节点
 * 2. 查询链上数据
 * 3. 调用first_purchase_by_fiat接口
 * 4. 验证推荐人是否有效会员
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const config = require('../config');
const logger = require('../utils/logger');

class BlockchainService {
    constructor() {
        this.api = null;
        this.serviceAccount = null;
    }

    /**
     * 函数级详细中文注释：初始化区块链连接
     */
    async initialize() {
        try {
            // 等待crypto ready
            await cryptoWaitReady();
            
            // 连接到节点
            const wsProvider = new WsProvider(config.blockchain.wsEndpoint);
            this.api = await ApiPromise.create({ provider: wsProvider });
            
            // 初始化服务账户
            const keyring = new Keyring({ type: 'sr25519' });
            this.serviceAccount = keyring.addFromUri(config.blockchain.fiatGatewaySeed);
            
            logger.info('区块链连接成功', {
                endpoint: config.blockchain.wsEndpoint,
                serviceAccount: this.serviceAccount.address,
            });
            
            // 订阅链头
            await this.api.rpc.chain.subscribeFinalizedHeads((header) => {
                logger.debug('最新区块', { blockNumber: header.number.toNumber() });
            });
            
            // 监控托管账户余额
            this.monitorTreasuryBalance();
            
        } catch (error) {
            logger.error('区块链连接失败', { error: error.message });
            throw error;
        }
    }

    /**
     * 函数级详细中文注释：检查地址是否已首购
     */
    async hasFirstPurchased(walletAddress) {
        try {
            const record = await this.api.query.otcOrder.firstPurchaseRecords(walletAddress);
            return record.isSome;
        } catch (error) {
            logger.error('查询首购记录失败', { walletAddress, error: error.message });
            throw error;
        }
    }

    /**
     * 函数级详细中文注释：查询推荐人信息
     */
    async getReferrerByCode(referralCode) {
        try {
            // 调用链上接口查询推荐码对应的账户
            const account = await this.api.query.memoReferrals.referralCodeToAccount(referralCode);
            
            if (account.isNone) {
                return null;
            }
            
            return account.unwrap().toString();
        } catch (error) {
            logger.error('查询推荐人失败', { referralCode, error: error.message });
            return null;
        }
    }

    /**
     * 函数级详细中文注释：验证推荐人是否有效会员
     */
    async isValidMember(accountId) {
        try {
            // 查询会员信息
            const memberInfo = await this.api.query.membership.members(accountId);
            
            if (memberInfo.isNone) {
                return false;
            }
            
            const info = memberInfo.unwrap();
            const now = (await this.api.query.system.number()).toNumber();
            
            // 检查会员是否过期
            return info.expiresAt.toNumber() > now;
        } catch (error) {
            logger.error('验证会员失败', { accountId, error: error.message });
            return false;
        }
    }

    /**
     * 函数级详细中文注释：调用链上首购接口
     * 
     * @param {Object} params
     * @param {String} params.buyer - 购买者地址
     * @param {Number} params.amount - 购买金额（MEMO，整数）
     * @param {String|null} params.referrer - 推荐人地址（可选）
     * @param {String} params.orderId - 法币订单号
     * @returns {Object} - 交易结果
     */
    async callFirstPurchaseByFiat({ buyer, amount, referrer, orderId }) {
        try {
            // 转换金额（MEMO -> 最小单位）
            const amountInPlanck = BigInt(amount) * BigInt(1_000_000_000_000);
            
            // 构建交易
            const tx = this.api.tx.otcOrder.firstPurchaseByFiat(
                buyer,
                amountInPlanck.toString(),
                referrer || null,
                orderId
            );
            
            logger.info('准备提交首购交易', {
                buyer,
                amount,
                referrer: referrer || 'None',
                orderId,
            });
            
            // 签名并发送交易
            return await new Promise((resolve, reject) => {
                tx.signAndSend(this.serviceAccount, ({ status, events, dispatchError }) => {
                    if (status.isInBlock) {
                        logger.info('交易已打包', {
                            blockHash: status.asInBlock.toString(),
                        });
                    }
                    
                    if (status.isFinalized) {
                        // 检查是否有错误
                        if (dispatchError) {
                            let errorInfo = '';
                            
                            if (dispatchError.isModule) {
                                const decoded = this.api.registry.findMetaError(dispatchError.asModule);
                                errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                            } else {
                                errorInfo = dispatchError.toString();
                            }
                            
                            logger.error('交易执行失败', { errorInfo });
                            reject(new Error(errorInfo));
                            return;
                        }
                        
                        // 查找首购完成事件
                        let purchaseEvent = null;
                        events.forEach(({ event }) => {
                            if (this.api.events.otcOrder.FirstPurchaseCompleted.is(event)) {
                                purchaseEvent = event;
                            }
                        });
                        
                        if (purchaseEvent) {
                            const [eventBuyer, eventAmount, eventReferrer, eventOrderId] = purchaseEvent.data;
                            
                            logger.info('首购完成', {
                                buyer: eventBuyer.toString(),
                                amount: eventAmount.toString(),
                                referrer: eventReferrer.isSome ? eventReferrer.unwrap().toString() : 'None',
                                orderId: eventOrderId.toString(),
                                blockHash: status.asFinalized.toString(),
                            });
                            
                            resolve({
                                success: true,
                                blockHash: status.asFinalized.toString(),
                                buyer: eventBuyer.toString(),
                                amount: eventAmount.toString(),
                            });
                        } else {
                            reject(new Error('未找到首购完成事件'));
                        }
                    }
                }).catch(reject);
            });
            
        } catch (error) {
            logger.error('调用首购接口失败', {
                buyer,
                amount,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * 函数级详细中文注释：监控托管账户余额
     */
    async monitorTreasuryBalance() {
        try {
            const treasuryId = this.api.consts.otcOrder.fiatGatewayTreasuryAccount;
            
            await this.api.query.system.account(treasuryId, (account) => {
                const balance = account.data.free.toBigInt() / BigInt(1_000_000_000_000);
                
                logger.info('托管账户余额', {
                    account: treasuryId.toString(),
                    balance: balance.toString() + ' MEMO',
                });
                
                // 余额告警
                if (balance < BigInt(config.monitoring.treasuryBalanceAlertThreshold)) {
                    logger.warn('⚠️ 托管账户余额不足', {
                        balance: balance.toString(),
                        threshold: config.monitoring.treasuryBalanceAlertThreshold,
                    });
                    
                    // 发送告警通知
                    this.sendAlert(`托管账户余额不足 ${balance} MEMO，请及时充值！`);
                }
            });
        } catch (error) {
            logger.error('监控托管账户失败', { error: error.message });
        }
    }

    /**
     * 函数级详细中文注释：发送告警通知
     */
    async sendAlert(message) {
        if (!config.monitoring.alertWebhookUrl) {
            return;
        }
        
        try {
            await axios.post(config.monitoring.alertWebhookUrl, {
                msgtype: 'text',
                text: {
                    content: `[首购服务告警] ${message}`,
                },
            });
        } catch (error) {
            logger.error('发送告警失败', { error: error.message });
        }
    }

    /**
     * 关闭连接
     */
    async close() {
        if (this.api) {
            await this.api.disconnect();
            logger.info('区块链连接已关闭');
        }
    }
}

module.exports = new BlockchainService();

