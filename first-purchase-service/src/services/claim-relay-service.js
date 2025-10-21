/**
 * 函数级详细中文注释：Claim中继服务
 * - 做市商代替用户调用 claim()
 * - 做市商支付GAS费用
 * - 用户获得全额MEMO
 */
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const logger = require('../utils/logger');

class ClaimRelayService {
  constructor(config) {
    this.config = config;
    this.api = null;
    this.keyring = null;
    this.makerAccount = null;
    this.isInitialized = false;
  }

  /**
   * 函数级详细中文注释：初始化服务
   * - 连接链节点
   * - 加载做市商账户
   */
  async init() {
    try {
      logger.info('初始化Claim中继服务...');

      // 1. 初始化加密库
      await cryptoWaitReady();

      // 2. 连接链节点
      const provider = new WsProvider(this.config.wsEndpoint);
      this.api = await ApiPromise.create({ provider });

      logger.info('✅ 链节点连接成功');

      // 3. 加载做市商账户
      this.keyring = new Keyring({ type: 'sr25519' });
      this.makerAccount = this.keyring.addFromUri(this.config.makerSeed);

      logger.info(`✅ 做市商账户加载成功: ${this.makerAccount.address}`);

      // 4. 检查账户余额
      const balance = await this.getBalance(this.makerAccount.address);
      const balanceMEMO = Number(balance) / 1e12;
      logger.info(`💰 做市商余额: ${balanceMEMO.toFixed(4)} MEMO`);

      if (balanceMEMO < this.config.minReserveBalance) {
        throw new Error(
          `余额不足！当前: ${balanceMEMO.toFixed(4)} MEMO, 最低要求: ${this.config.minReserveBalance} MEMO`
        );
      }

      this.isInitialized = true;
      logger.info('✅ Claim中继服务初始化完成');
    } catch (error) {
      logger.error('❌ 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 函数级详细中文注释：查询账户余额
   */
  async getBalance(address) {
    const account = await this.api.query.system.account(address);
    return account.data.free.toBigInt();
  }

  /**
   * 函数级详细中文注释：代付GAS并执行claim
   * @param {Object} authData - 授权数据
   * @returns {Object} - 执行结果
   */
  async relayClaim(authData) {
    if (!this.isInitialized) {
      throw new Error('服务未初始化');
    }

    try {
      logger.info(`\n🔄 开始中继claim...`);
      logger.info(`  订单ID: ${authData.order_id}`);
      logger.info(`  受益人: ${authData.beneficiary}`);
      logger.info(`  金额: ${authData.amount_memo} MEMO`);

      // 1. 余额检查
      const balance = await this.getBalance(this.makerAccount.address);
      const balanceMEMO = Number(balance) / 1e12;
      const requiredMEMO = 0.1; // 预留GAS费用

      if (balanceMEMO < requiredMEMO) {
        throw new Error(
          `做市商余额不足以支付GAS: ${balanceMEMO.toFixed(4)} < ${requiredMEMO}`
        );
      }

      // 2. 创建claim交易
      const tx = this.api.tx.firstPurchase.claim(
        authData.issuer_account,
        authData.order_id,
        authData.beneficiary,
        authData.amount_memo,
        authData.deadline_block,
        authData.nonce,
        authData.signature
      );

      logger.info('📤 提交claim交易...');

      // 3. 做市商签名并发送（代付GAS）
      const result = await new Promise((resolve, reject) => {
        tx.signAndSend(
          this.makerAccount,
          { nonce: -1 }, // 自动获取nonce
          ({ status, events, dispatchError }) => {
            logger.info(`📊 交易状态: ${status.type}`);

            if (status.isInBlock) {
              logger.info(
                `✅ 交易已打包到区块: ${status.asInBlock.toHex()}`
              );
            }

            if (status.isFinalized) {
              logger.info(
                `✅ 交易已确认: ${status.asFinalized.toHex()}`
              );

              // 检查是否有错误
              if (dispatchError) {
                let errorInfo = dispatchError.toString();

                if (dispatchError.isModule) {
                  const decoded = this.api.registry.findMetaError(
                    dispatchError.asModule
                  );
                  errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
                }

                reject(new Error(`交易执行失败: ${errorInfo}`));
                return;
              }

              // 提取GAS费用
              const feeEvent = events.find(
                ({ event }) =>
                  event.section === 'transactionPayment' &&
                  event.method === 'TransactionFeePaid'
              );

              const gasCost = feeEvent
                ? feeEvent.event.data.actualFee.toBigInt()
                : 0n;
              const gasCostMEMO = Number(gasCost) / 1e12;

              logger.info(`💰 GAS费用: ${gasCostMEMO.toFixed(6)} MEMO`);

              // 查找ClaimSucceeded事件
              const claimEvent = events.find(
                ({ event }) =>
                  event.section === 'firstPurchase' &&
                  event.method === 'ClaimSucceeded'
              );

              if (claimEvent) {
                logger.info('✅ Claim执行成功！');
              }

              resolve({
                success: true,
                txHash: status.asFinalized.toHex(),
                blockNumber: status.asFinalized.toNumber
                  ? status.asFinalized.toNumber()
                  : 'unknown',
                gasCost: gasCost.toString(),
                gasCostMEMO: gasCostMEMO.toFixed(6),
                timestamp: Date.now(),
              });
            }

            if (status.isInvalid || status.isDropped || status.isUsurped) {
              reject(new Error(`交易失败: ${status.type}`));
            }
          }
        ).catch(reject);
      });

      logger.info(`✅ Claim中继完成！`);
      logger.info(`  TxHash: ${result.txHash}`);
      logger.info(`  做市商支付GAS: ${result.gasCostMEMO} MEMO`);
      logger.info(`  用户收到: ${authData.amount_memo} MEMO（全额）`);

      return result;
    } catch (error) {
      logger.error(`❌ Claim中继失败:`, error);
      throw error;
    }
  }

  /**
   * 函数级详细中文注释：验证地址格式
   */
  isValidAddress(address) {
    try {
      const { decodeAddress, encodeAddress } = require('@polkadot/keyring');
      const publicKey = decodeAddress(address);
      const encodedAddress = encodeAddress(publicKey);
      return encodedAddress === address;
    } catch {
      return false;
    }
  }

  /**
   * 函数级详细中文注释：关闭服务
   */
  async close() {
    if (this.api) {
      await this.api.disconnect();
      logger.info('✅ 链节点断开连接');
    }
  }
}

module.exports = ClaimRelayService;

