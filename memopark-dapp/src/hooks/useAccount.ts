/**
 * useAccount Hook
 * 提供当前账户信息
 */

import { useWallet } from '../providers/WalletProvider';

/**
 * 获取当前选中的账户
 */
export function useAccount() {
  const { selectedAccount, currentAccount } = useWallet();
  return selectedAccount || currentAccount;
}

