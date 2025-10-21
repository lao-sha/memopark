/**
 * 函数级详细中文注释：测试连接脚本
 * - 测试链节点连接
 * - 测试做市商账户
 * - 测试EPAY数据库连接
 */
const config = require('../src/config');
const ClaimRelayService = require('../src/services/claim-relay-service');
const EPAYService = require('../src/services/epay-service');
const logger = require('../src/utils/logger');

async function testConnection() {
  logger.info('🧪 开始测试连接...\n');

  try {
    // 1. 测试链节点
    logger.info('1️⃣ 测试链节点连接...');
    const claimService = new ClaimRelayService(config.chain);
    await claimService.init();
    logger.info('✅ 链节点连接成功\n');

    // 2. 测试EPAY数据库（如果配置了）
    if (config.epay.host) {
      logger.info('2️⃣ 测试EPAY数据库连接...');
      const epayService = new EPAYService(config.epay);
      await epayService.init();

      // 查询测试
      const orders = await epayService.getPendingOrders();
      logger.info(`✅ EPAY数据库连接成功，待处理订单: ${orders.length}\n`);

      await epayService.close();
    } else {
      logger.info('2️⃣ 跳过EPAY数据库测试（未配置）\n');
    }

    // 3. 测试完成
    logger.info('✅ 所有测试通过！\n');

    await claimService.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testConnection();

