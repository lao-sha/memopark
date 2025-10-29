/**
 * useApi Hook
 * 提供Polkadot API访问
 */

import { useWallet } from '../providers/WalletProvider';

/**
 * 获取Polkadot API实例
 */
export function useApi() {
  const { api } = useWallet();
  return api;
}

