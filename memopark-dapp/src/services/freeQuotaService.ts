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
  /** 累计代付金额（MEMO） */
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
    // 查询当前配额
    const currentQuota = await api.query.marketMaker.freeOrderQuota(makerId, buyerAddress);
    const currentQuotaNum = currentQuota.toNumber();
    
    // 查询默认配额
    const defaultQuota = await api.query.marketMaker.freeOrderQuotaConfig(makerId);
    const defaultQuotaNum = defaultQuota.toNumber();
    
    // 如果当前配额为0，检查是否为新买家
    if (currentQuotaNum === 0) {
      return {
        remaining: defaultQuotaNum,
        isNewBuyer: true,
        defaultQuota: defaultQuotaNum,
      };
    }
    
    return {
      remaining: currentQuotaNum,
      isNewBuyer: false,
      defaultQuota: defaultQuotaNum,
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
    const defaultQuota = await api.query.marketMaker.freeOrderQuotaConfig(makerId);
    return defaultQuota.toNumber();
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
    const statsData = await api.query.marketMaker.totalFreeOrdersConsumed(makerId);
    const [totalCount, totalAmount] = statsData.toJSON() as [number, string];
    
    const totalAmountNum = parseFloat(totalAmount) / 1e18;
    const avgGasPerOrder = totalCount > 0 ? totalAmountNum / totalCount : 0;
    
    return {
      totalCount,
      totalAmount: totalAmountNum,
      avgGasPerOrder,
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
  try {
    const tx = api.tx.marketMaker.setFreeQuotaConfig(makerId, quota);
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(signer, ({ status, events, dispatchError }) => {
        if (status.isInBlock) {
          onStatusChange?.('已打包到区块');
          
          if (dispatchError) {
            let errorMessage = '交易失败';
            
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
            }
            
            reject(new Error(errorMessage));
          } else {
            onStatusChange?.('交易成功');
            resolve(status.asInBlock.toString());
          }
        } else if (status.isFinalized) {
          onStatusChange?.('交易已确认');
        }
      }).catch(reject);
    });
  } catch (error) {
    console.error('设置默认配额失败:', error);
    throw error;
  }
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
  try {
    const tx = api.tx.marketMaker.grantFreeQuota(makerId, buyerAddress, additionalQuota);
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(signer, ({ status, events, dispatchError }) => {
        if (status.isInBlock) {
          onStatusChange?.('已打包到区块');
          
          if (dispatchError) {
            let errorMessage = '交易失败';
            
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
            }
            
            reject(new Error(errorMessage));
          } else {
            onStatusChange?.('交易成功');
            resolve(status.asInBlock.toString());
          }
        } else if (status.isFinalized) {
          onStatusChange?.('交易已确认');
        }
      }).catch(reject);
    });
  } catch (error) {
    console.error('授予免费配额失败:', error);
    throw error;
  }
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
  try {
    if (buyerAddresses.length > 100) {
      throw new Error('批量授予最多支持100个买家');
    }
    
    const tx = api.tx.marketMaker.batchGrantFreeQuota(makerId, buyerAddresses, quotaPerBuyer);
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(signer, ({ status, events, dispatchError }) => {
        if (status.isInBlock) {
          onStatusChange?.('已打包到区块');
          
          if (dispatchError) {
            let errorMessage = '交易失败';
            
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
            }
            
            reject(new Error(errorMessage));
          } else {
            onStatusChange?.('交易成功');
            resolve(status.asInBlock.toString());
          }
        } else if (status.isFinalized) {
          onStatusChange?.('交易已确认');
        }
      }).catch(reject);
    });
  } catch (error) {
    console.error('批量授予免费配额失败:', error);
    throw error;
  }
}

/**
 * 函数级详细中文注释：买家创建免费订单
 * 
 * @param api - Polkadot.js API 实例
 * @param makerId - 做市商 ID
 * @param qty - 购买数量（MEMO，精度 10^18）
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
  try {
    const qtyWithDecimals = BigInt(qty) * BigInt(1e18);
    const tx = api.tx.otcOrder.openOrderFree(
      makerId,
      qtyWithDecimals.toString(),
      paymentCommit,
      contactCommit
    );
    
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
              if (api.events.otcOrder.OrderOpened.is(event)) {
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
}

