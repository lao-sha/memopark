/**
 * 免费配额服务
 * 
 * 功能级详细中文注释：
 * 提供买家和做市商的免费配额管理功能，包括查询配额、设置配额、授予配额等。
 * 
 * @module freeQuotaService
 * @created 2025-10-22
 */

import { ApiPromise } from '@polkadot/api';
import type { AccountId32 } from '@polkadot/types/interfaces';

/**
 * 函数级详细中文注释：免费配额接口定义
 */
export interface FreeQuotaInfo {
  /** 剩余免费次数 */
  remaining: number;
  /** 是否为新买家 */
  isNewBuyer: boolean;
  /** 默认配额（新买家） */
  defaultQuota: number;
}

/**
 * 函数级详细中文注释：代付统计接口定义
 */
export interface SponsoredStats {
  /** 累计代付次数 */
  totalCount: number;
  /** 累计代付金额（DUST） */
  totalAmount: number;
  /** 平均每笔Gas */
  avgGasPerOrder: number;
}

/**
 * 函数级详细中文注释：查询买家的剩余免费次数
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param buyerAddress - 买家地址
 * @returns 免费配额信息
 * 
 * @example
 * ```typescript
 * const quotaInfo = await getRemainingQuota(api, 1, buyerAddress);
 * console.log('剩余免费次数:', quotaInfo.remaining);
 * ```
 */
export async function getRemainingQuota(
  api: ApiPromise,
  makerId: number,
  buyerAddress: string
): Promise<FreeQuotaInfo> {
  try {
    // 注意：首购功能在新架构中可能由 pallet-otc-order 管理
    // 查询当前配额
    const currentQuota = await api.query.otcOrder.hasFirstPurchased(buyerAddress);
    const hasUsedFirstPurchase = currentQuota.isTrue || currentQuota === true;
    
    // 查询做市商的首购订单数量
    const makerFirstPurchaseCount = await api.query.otcOrder.makerFirstPurchaseCount(makerId);
    const countNum = makerFirstPurchaseCount.toNumber();
    
    // 如果用户还没有首购过，返回可用配额
    if (!hasUsedFirstPurchase) {
      return {
        remaining: 1,  // 首购只能使用一次
        isNewBuyer: true,
        defaultQuota: 1,
      };
    }
    
    return {
      remaining: 0,
      isNewBuyer: false,
      defaultQuota: 1,
    };
  } catch (error) {
    console.error('查询免费配额失败:', error);
    throw new Error('查询免费配额失败');
  }
}

/**
 * 函数级详细中文注释：查询做市商的默认免费配额
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 默认免费次数
 * 
 * @example
 * ```typescript
 * const defaultQuota = await getDefaultQuota(api, 1);
 * console.log('默认配额:', defaultQuota); // 如 3
 * ```
 */
export async function getDefaultQuota(
  api: ApiPromise,
  makerId: number
): Promise<number> {
  try {
    // 新架构中，首购配额是固定的 1 次，不需要链上配置
    return 1;
  } catch (error) {
    console.error('查询默认配额失败:', error);
    throw new Error('查询默认配额失败');
  }
}

/**
 * 函数级详细中文注释：查询做市商的代付统计
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @returns 代付统计信息
 * 
 * @example
 * ```typescript
 * const stats = await getSponsoredStats(api, 1);
 * console.log('累计代付次数:', stats.totalCount);
 * console.log('累计代付金额:', stats.totalAmount, 'DUST');
 * ```
 */
export async function getSponsoredStats(
  api: ApiPromise,
  makerId: number
): Promise<SponsoredStats> {
  try {
    // 查询做市商的首购订单计数
    const totalCount = await api.query.otcOrder.makerFirstPurchaseCount(makerId);
    const countNum = totalCount.toNumber();
    
    // 新架构中暂时没有总金额统计，返回基本信息
    return {
      totalCount: countNum,
      totalAmount: 0,  // TODO: 需要遍历订单计算总金额
      avgGasPerOrder: 0,
    };
  } catch (error) {
    console.error('查询代付统计失败:', error);
    return {
      totalCount: 0,
      totalAmount: 0,
      avgGasPerOrder: 0,
    };
  }
}

/**
 * 函数级详细中文注释：做市商设置默认免费配额
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param quota - 每个新买家的默认免费次数
 * @param signer - 做市商账户
 * @param onStatusChange - 状态变化回调
 * @returns 交易哈希
 * 
 * @example
 * ```typescript
 * const txHash = await setFreeQuotaConfig(
 *   api, 
 *   1, 
 *   3, 
 *   makerAccount,
 *   (status) => console.log('状态:', status)
 * );
 * ```
 */
export async function setFreeQuotaConfig(
  api: ApiPromise,
  makerId: number,
  quota: number,
  signer: any,
  onStatusChange?: (status: string) => void
): Promise<string> {
  // 新架构中，首购配额是固定的，不需要设置
  // 该功能已移除
  throw new Error('首购配额设置功能已移除：新架构中首购配额固定为 1 次');
}

/**
 * 函数级详细中文注释：做市商为特定买家授予免费配额
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param buyerAddress - 买家地址
 * @param additionalQuota - 增加的免费次数
 * @param signer - 做市商账户
 * @param onStatusChange - 状态变化回调
 * @returns 交易哈希
 * 
 * @example
 * ```typescript
 * await grantFreeQuota(api, 1, buyerAddress, 5, makerAccount);
 * ```
 */
export async function grantFreeQuota(
  api: ApiPromise,
  makerId: number,
  buyerAddress: string,
  additionalQuota: number,
  signer: any,
  onStatusChange?: (status: string) => void
): Promise<string> {
  // 新架构中，首购配额是一次性的，不支持额外授予
  throw new Error('首购配额授予功能已移除：新架构中首购只能使用一次');
}

/**
 * 函数级详细中文注释：做市商批量授予免费配额
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param buyerAddresses - 买家地址列表（最多100个）
 * @param quotaPerBuyer - 每个买家增加的免费次数
 * @param signer - 做市商账户
 * @param onStatusChange - 状态变化回调
 * @returns 交易哈希
 * 
 * @example
 * ```typescript
 * await batchGrantFreeQuota(api, 1, [buyer1, buyer2], 5, makerAccount);
 * ```
 */
export async function batchGrantFreeQuota(
  api: ApiPromise,
  makerId: number,
  buyerAddresses: string[],
  quotaPerBuyer: number,
  signer: any,
  onStatusChange?: (status: string) => void
): Promise<string> {
  // 新架构中，首购配额是一次性的，不支持批量授予
  throw new Error('首购配额批量授予功能已移除：新架构中首购只能使用一次');
}

/**
 * 函数级详细中文注释：买家创建免费订单
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param qty - 购买数量（DUST，精度 10^18）
 * @param paymentCommit - 支付凭证承诺（Hash）
 * @param contactCommit - 联系方式承诺（Hash）
 * @param signer - 买家账户
 * @param onStatusChange - 状态变化回调
 * @returns 交易哈希和订单ID
 * 
 * @example
 * ```typescript
 * const { txHash, orderId } = await createFreeOrder(
 *   api, 
 *   1, 
 *   1000, 
 *   paymentHash, 
 *   contactHash,
 *   buyerAccount
 * );
 * ```
 */
export async function createFreeOrder(
  api: ApiPromise,
  makerId: number,
  qty: number,
  paymentCommit: string,
  contactCommit: string,
  signer: any,
  onStatusChange?: (status: string) => void
): Promise<{ txHash: string; orderId?: number }> {
  // 🚧 临时禁用：等待 pallet-trading 实现 create_first_purchase 功能
  // 
  // 背景说明：
  // - pallet-otc-order 已从 Runtime 移除
  // - pallet-trading 尚未实现免费首购订单功能
  // - 需等待链端完成 create_first_purchase 接口开发
  // 
  // TODO: 链端实现后，迁移到 api.tx.trading.createFirstPurchase
  // 
  // @deprecated 功能升级中
  // @see docs/前端API迁移-遗留问题分析.md
  
  throw new Error(
    '⚠️ 首购免费订单功能正在升级中\n\n' +
    '升级原因：链端架构整合（Phase 2）\n' +
    '预计上线：请联系技术团队确认\n\n' +
    '💡 暂时建议：\n' +
    '1. 使用普通订单创建功能\n' +
    '2. 关注系统公告获取升级进度\n\n' +
    '如有疑问，请联系客服支持'
  );
  
  /* ============================================================
   * 原有实现已注释（等待链端实现后恢复）
   * ============================================================
   
  try {
    const qtyWithDecimals = BigInt(qty) * BigInt(1e18);
    
    // ❌ 旧 API（已移除）
    // const tx = api.tx.trading.openOrderFree(...);
    
    // ✅ 新 API（待链端实现）
    // const tx = api.tx.trading.createFirstPurchase(
    //   makerId,
    //   qtyWithDecimals.toString(),
    //   paymentCommit,
    //   contactCommit
    // );
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(signer, ({ status, events, dispatchError }) => {
        if (status.isInBlock) {
          onStatusChange?.('已打包到区块');
          
          if (dispatchError) {
            let errorMessage = '交易失败';
            
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
              
              // 特殊处理免费配额用完的错误
              if (decoded.name === 'FreeQuotaExhausted') {
                errorMessage = '免费配额已用完，请使用普通创建订单功能';
              }
            }
            
            reject(new Error(errorMessage));
          } else {
            // 解析订单ID
            let orderId: number | undefined;
            events.forEach(({ event }) => {
              if (api.events.trading.OrderOpened.is(event)) {
                orderId = event.data.id.toNumber();
              }
            });
            
            onStatusChange?.('交易成功');
            resolve({
              txHash: status.asInBlock.toString(),
              orderId,
            });
          }
        } else if (status.isFinalized) {
          onStatusChange?.('交易已确认');
        }
      }).catch(reject);
    });
  } catch (error) {
    console.error('创建免费订单失败:', error);
    throw error;
  }
  
  ============================================================ */
}

