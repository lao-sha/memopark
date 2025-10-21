/**
 * 函数级详细中文注释：EPAY服务
 * - 查询待处理订单
 * - 更新订单状态
 */
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

class EPAYService {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  /**
   * 函数级详细中文注释：初始化数据库连接池
   */
  async init() {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // 测试连接
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      logger.info('✅ EPAY数据库连接成功');
    } catch (error) {
      logger.error('❌ EPAY数据库连接失败:', error);
      throw error;
    }
  }

  /**
   * 函数级详细中文注释：查询待处理订单
   * - 状态为 'paid'（已支付）
   * - claim_status 为 'pending'（未领取）
   */
  async getPendingOrders() {
    try {
      const [rows] = await this.pool.execute(
        `SELECT * FROM first_purchase_orders 
         WHERE status = 'paid' 
           AND claim_status = 'pending'
         ORDER BY created_at ASC
         LIMIT 100`
      );

      return rows;
    } catch (error) {
      logger.error('❌ 查询订单失败:', error);
      throw error;
    }
  }

  /**
   * 函数级详细中文注释：更新订单claim状态
   */
  async updateClaimStatus(orderId, data) {
    try {
      await this.pool.execute(
        `UPDATE first_purchase_orders 
         SET claim_status = ?,
             tx_hash = ?,
             claimed_at = NOW()
         WHERE id = ?`,
        [data.claimStatus, data.txHash, orderId]
      );

      logger.info(`✅ 订单状态已更新: ${orderId}`);
    } catch (error) {
      logger.error(`❌ 更新订单状态失败: ${orderId}`, error);
      throw error;
    }
  }

  /**
   * 函数级详细中文注释：关闭连接池
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('✅ EPAY数据库连接已关闭');
    }
  }
}

module.exports = EPAYService;

