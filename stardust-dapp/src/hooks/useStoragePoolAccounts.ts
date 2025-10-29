/**
 * useStoragePoolAccounts Hook
 * 
 * 功能：查询存储池账户余额和配额信息
 * 
 * 使用场景：
 * - StorageTreasuryDashboard显示池账户余额
 * - 费用监控页面显示配额使用情况
 * - 充值引导页面显示余额不足提示
 * 
 * 创建时间：2025-10-12
 */

import { useState, useEffect, useCallback } from 'react';
import type { 
  StoragePoolAccount, 
  OperatorEscrowAccount,
  StoragePoolAccountsResponse,
} from '@/types';
import {
  StoragePoolType,
  POOL_ADDRESSES,
  CHAIN_CONSTANTS
} from '@/types';

/**
 * useStoragePoolAccounts Hook 参数
 */
export interface UseStoragePoolAccountsOptions {
  /** 是否启用自动刷新 */
  enablePolling?: boolean;
  /** 轮询间隔（毫秒），默认30秒 */
  pollingInterval?: number;
  /** 是否在挂载时立即查询 */
  immediate?: boolean;
}

/**
 * useStoragePoolAccounts Hook 返回值
 */
export interface UseStoragePoolAccountsResult {
  /** IPFS存储池 */
  ipfsPool: StoragePoolAccount | null;
  /** Arweave存储池 */
  arweavePool: StoragePoolAccount | null;
  /** 节点维护池 */
  nodeMaintenancePool: StoragePoolAccount | null;
  /** 运营者托管账户 */
  operatorEscrow: OperatorEscrowAccount | null;
  /** 所有池账户列表 */
  pools: StoragePoolAccount[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动刷新函数 */
  refresh: () => Promise<void>;
  /** 是否正在轮询 */
  isPolling: boolean;
}

/**
 * 查询存储池账户信息
 * 
 * @param options - Hook配置选项
 * @returns 池账户信息和控制函数
 * 
 * @example
 * ```tsx
 * const { ipfsPool, loading, refresh } = useStoragePoolAccounts({
 *   enablePolling: true,
 * });
 * 
 * if (loading) return <Spin />;
 * 
 * return (
 *   <Card title="IPFS存储池">
 *     <Statistic 
 *       title="余额" 
 *       value={formatBalance(ipfsPool?.balance || 0n)} 
 *       suffix="DUST"
 *     />
 *     <Progress 
 *       percent={(ipfsPool?.quotaUsed || 0n) * 100n / (ipfsPool?.quotaTotal || 1n)}
 *       format={() => `${ipfsPool?.quotaUsed}/${ipfsPool?.quotaTotal} DUST`}
 *     />
 *   </Card>
 * );
 * ```
 */
export function useStoragePoolAccounts(
  options: UseStoragePoolAccountsOptions = {}
): UseStoragePoolAccountsResult {
  const { 
    enablePolling = false, 
    pollingInterval = 30000,
    immediate = true 
  } = options;

  const [ipfsPool, setIpfsPool] = useState<StoragePoolAccount | null>(null);
  const [arweavePool, setArweavePool] = useState<StoragePoolAccount | null>(null);
  const [nodeMaintenancePool, setNodeMaintenancePool] = useState<StoragePoolAccount | null>(null);
  const [operatorEscrow, setOperatorEscrow] = useState<OperatorEscrowAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  /**
   * 查询池账户信息
   */
  const fetchPoolAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ⚠️ 当前使用模拟数据，等待pallet-memo-ipfs启用后替换为实际API调用
      const response = await fetchPoolAccountsFromChain();

      if (response.success && response.data) {
        const pools = response.data;
        setIpfsPool(pools.find(p => p.poolType === StoragePoolType.Ipfs) || null);
        setArweavePool(pools.find(p => p.poolType === StoragePoolType.Arweave) || null);
        setNodeMaintenancePool(pools.find(p => p.poolType === StoragePoolType.NodeMaintenance) || null);
        setOperatorEscrow(response.operatorEscrow || null);
      } else {
        setError(response.error || '查询失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 手动刷新
   */
  const refresh = useCallback(async () => {
    await fetchPoolAccounts();
  }, [fetchPoolAccounts]);

  /**
   * 初始查询
   */
  useEffect(() => {
    if (immediate) {
      fetchPoolAccounts();
    }
  }, [immediate, fetchPoolAccounts]);

  /**
   * 轮询逻辑
   */
  useEffect(() => {
    if (!enablePolling) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const timer = setInterval(() => {
      fetchPoolAccounts();
    }, pollingInterval);

    return () => {
      clearInterval(timer);
      setIsPolling(false);
    };
  }, [enablePolling, pollingInterval, fetchPoolAccounts]);

  return {
    ipfsPool,
    arweavePool,
    nodeMaintenancePool,
    operatorEscrow,
    pools: [ipfsPool, arweavePool, nodeMaintenancePool].filter(Boolean) as StoragePoolAccount[],
    loading,
    error,
    refresh,
    isPolling,
  };
}

/**
 * 从链上查询池账户信息（占位实现）
 * 
 * ⚠️ 当前返回模拟数据，需要在pallet-memo-ipfs启用后实现实际查询
 * 
 * 实际实现需要：
 * 1. 查询各池账户的余额：api.query.system.account(poolAddress)
 * 2. 查询IPFS池的配额使用情况：api.query.memoIpfs.publicFeeQuotaUsage()
 * 3. 查询配额重置剩余区块数：计算当前区块到下一个重置点的距离
 * 4. 查询运营者托管账户余额
 */
async function fetchPoolAccountsFromChain(): Promise<StoragePoolAccountsResponse> {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  // 模拟数据
  const now = Date.now();
  const blocksToReset = 50000;
  const resetEta = now + blocksToReset * CHAIN_CONSTANTS.BLOCK_TIME_SECONDS * 1000;

  const mockPools: StoragePoolAccount[] = [
    {
      poolType: StoragePoolType.Ipfs,
      address: POOL_ADDRESSES.IPFS_POOL,
      balance: 1234n * CHAIN_CONSTANTS.UNIT,
      quotaUsed: 23n * CHAIN_CONSTANTS.UNIT,
      quotaTotal: CHAIN_CONSTANTS.MONTHLY_PUBLIC_FEE_QUOTA,
      quotaRemaining: 77n * CHAIN_CONSTANTS.UNIT,
      resetInBlocks: blocksToReset,
      resetEta,
      displayName: 'IPFS存储池',
    },
    {
      poolType: StoragePoolType.Arweave,
      address: POOL_ADDRESSES.ARWEAVE_POOL,
      balance: 567n * CHAIN_CONSTANTS.UNIT,
      displayName: 'Arweave存储池',
    },
    {
      poolType: StoragePoolType.NodeMaintenance,
      address: POOL_ADDRESSES.NODE_MAINTENANCE_POOL,
      balance: 890n * CHAIN_CONSTANTS.UNIT,
      displayName: '节点维护池',
    },
  ];

  const mockOperatorEscrow: OperatorEscrowAccount = {
    address: POOL_ADDRESSES.OPERATOR_ESCROW,
    balance: 345n * CHAIN_CONSTANTS.UNIT,
    totalReceived: 1000n * CHAIN_CONSTANTS.UNIT,
    displayName: '运营者托管',
  };

  return {
    success: true,
    data: mockPools,
    operatorEscrow: mockOperatorEscrow,
  };
}

