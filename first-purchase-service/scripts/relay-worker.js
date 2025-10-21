/**
 * 函数级详细中文注释：Claim中继工作进程
 * - 定期轮询EPAY订单
 * - 自动代付GAS执行claim
 * - 记录执行结果
 */
const config = require('../src/config');
const ClaimRelayService = require('../src/services/claim-relay-service');
const EPAYService = require('../src/services/epay-service');
const logger = require('../src/utils/logger');

class RelayWorker {
  constructor() {
    this.claimService = new ClaimRelayService(config.chain);
    this.epayService = new EPAYService(config.epay);
    this.isRunning = false;
    this.processedOrders = new Set();
  }

  /**
   * 函数级详细中文注释：启动工作进程
   */
  async start() {
    try {
      logger.info('🚀 启动Claim中继工作进程...\n');

      // 初始化服务
      await this.claimService.init();
      await this.epayService.init();

      this.isRunning = true;

      logger.info('✅ 工作进程已启动，开始轮询...\n');

      // 开始轮询
      await this.poll();
    } catch (error) {
      logger.error('❌ 启动失败:', error);
      process.exit(1);
    }
  }

  /**
   * 函数级详细中文注释：轮询处理
   */
  async poll() {
    while (this.isRunning) {
      try {
        const now = new Date().toISOString();
        logger.info(`\n⏰ [${now}] 开始轮询订单...`);

        // 1. 查询待处理订单
        const pendingOrders = await this.epayService.getPendingOrders();

        logger.info(`📋 待处理订单数: ${pendingOrders.length}`);

        // 2. 处理每个订单
        for (const order of pendingOrders) {
          await this.processOrder(order);

          // 避免过快请求
          await this.sleep(2000);
        }

        // 3. 等待下次轮询
        logger.info(
          `\n⏸️  等待 ${config.service.pollInterval / 1000} 秒后继续...\n`
        );
        await this.sleep(config.service.pollInterval);
      } catch (error) {
        logger.error('❌ 轮询出错:', error);
        await this.sleep(config.service.pollInterval);
      }
    }
  }

  /**
   * 函数级详细中文注释：处理单个订单
   */
  async processOrder(order) {
    try {
      logger.info(`\n📦 处理订单: ${order.id}`);
      logger.info(`   用户地址: ${order.user_address}`);
      logger.info(`   MEMO金额: ${order.memo_amount}`);
      logger.info(`   支付状态: ${order.status}`);

      // 1. 防重复检查
      if (this.processedOrders.has(order.id)) {
        logger.info('   ⏸️  订单已处理，跳过');
        return;
      }

      // 2. 验证订单数据
      if (!order.auth_data) {
        logger.error('   ❌ 订单缺少授权数据');
        return;
      }

      // 3. 解析授权数据
      let authData;
      try {
        authData =
          typeof order.auth_data === 'string'
            ? JSON.parse(order.auth_data)
            : order.auth_data;
      } catch (error) {
        logger.error('   ❌ 授权数据格式错误:', error);
        return;
      }

      // 4. 执行claim中继
      const result = await this.claimService.relayClaim(authData);

      // 5. 更新EPAY订单状态
      await this.epayService.updateClaimStatus(order.id, {
        claimStatus: 'completed',
        txHash: result.txHash,
      });

      // 6. 标记已处理
      this.processedOrders.add(order.id);

      logger.info(`✅ 订单处理完成: ${order.id}`);
      logger.info(`   TxHash: ${result.txHash}`);
      logger.info(`   GAS费用: ${result.gasCostMEMO} MEMO（做市商支付）`);
      logger.info(`   用户收到: ${order.memo_amount} MEMO（全额）`);
    } catch (error) {
      logger.error(`❌ 订单处理失败: ${order.id}`, error);

      // 更新失败状态
      try {
        await this.epayService.updateClaimStatus(order.id, {
          claimStatus: 'failed',
          txHash: null,
        });
      } catch (updateError) {
        logger.error('   ❌ 更新失败状态失败:', updateError);
      }
    }
  }

  /**
   * 函数级详细中文注释：休眠函数
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 函数级详细中文注释：停止工作进程
   */
  async stop() {
    logger.info('\n⏸️  停止工作进程...');
    this.isRunning = false;
    await this.claimService.close();
    await this.epayService.close();
    logger.info('✅ 工作进程已停止');
  }
}

// 主程序
async function main() {
  const worker = new RelayWorker();

  // 优雅退出
  process.on('SIGINT', async () => {
    logger.info('\n\n收到退出信号 (Ctrl+C)...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('\n\n收到终止信号...');
    await worker.stop();
    process.exit(0);
  });

  // 启动
  await worker.start();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('❌ 程序异常退出:', error);
    process.exit(1);
  });
}

module.exports = RelayWorker;

