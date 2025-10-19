/**
 * Wallet Hook - 钱包管理
 * 函数级中文注释：提供本地钱包管理、账户管理、余额查询功能
 * - 不使用浏览器扩展
 * - 使用本地加密存储
 */

import { create } from 'zustand';
import { message } from 'antd';
import type { WalletStore } from '@/types';
import {
  loadAllKeystores,
  setCurrentAddress,
  createKeyPair,
  type LocalKeystore,
} from '@/lib/keystore';

/**
 * 函数级中文注释：Wallet Store - 使用 Zustand 管理钱包状态
 */
export const useWalletStore = create<WalletStore>((set) => ({
  accounts: [],
  currentAccount: null,
  balance: '0',
  isLoading: false,
  error: null,

  setAccounts: (accounts) => set({ accounts }),
  setCurrentAccount: (account) => set({ currentAccount: account }),
  setBalance: (balance) => set({ balance }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  reset: () =>
    set({
      accounts: [],
      currentAccount: null,
      balance: '0',
      isLoading: false,
      error: null,
    }),
}));

/**
 * 函数级中文注释：加载本地钱包账户
 * @returns 账户列表
 */
export const loadLocalAccounts = (): LocalKeystore[] => {
  try {
    const keystores = loadAllKeystores();
    console.log('✅ 加载本地账户，找到', keystores.length, '个账户');
    return keystores;
  } catch (err: any) {
    console.error('❌ 加载本地账户失败:', err);
    return [];
  }
};

/**
 * 函数级中文注释：切换当前账户
 * @param address 账户地址
 */
export const switchAccount = (address: string): void => {
  setCurrentAddress(address);
  message.success('已切换账户');
};

/**
 * 函数级中文注释：获取账户签名器
 * - 需要先解密助记词
 * @param address 账户地址
 * @param password 密码
 * @returns KeyringPair
 */
export const getSignerWithPassword = async (address: string, password: string) => {
  try {
    const { decryptWithPassword, loadKeystoreByAddress } = await import('@/lib/keystore');
    
    const keystore = loadKeystoreByAddress(address);
    if (!keystore) {
      throw new Error('账户不存在');
    }

    // 解密助记词
    const mnemonic = await decryptWithPassword(password, {
      ciphertext: keystore.ciphertext,
      salt: keystore.salt,
      iv: keystore.iv,
    });

    // 创建密钥对
    const pair = await createKeyPair(mnemonic);
    return pair;
  } catch (err: any) {
    console.error('❌ 获取签名器失败:', err);
    throw new Error('密码错误或账户不存在');
  }
};

/**
 * 函数级中文注释：查询账户余额
 * @param api Polkadot API 实例
 * @param address 账户地址
 * @returns 余额（MEMO）
 */
export const queryBalance = async (api: any, address: string): Promise<string> => {
  try {
    const accountInfo = await api.query.system.account(address);
    const free = accountInfo.data.free.toString();
    const freeMemo = (BigInt(free) / BigInt(1e12)).toString();
    return freeMemo;
  } catch (err: any) {
    console.error('❌ 查询余额失败:', err);
    throw new Error('查询余额失败');
  }
};

/**
 * 函数级中文注释：格式化余额显示
 * @param balance 余额（最小单位）
 * @param decimals 小数位数
 * @returns 格式化后的余额
 */
export const formatBalance = (balance: string | bigint, decimals: number = 12): string => {
  const balanceBigInt = typeof balance === 'string' ? BigInt(balance) : balance;
  // 函数级中文注释：使用 BigInt(10) ** BigInt(decimals) 避免 number 溢出
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = balanceBigInt / divisor;
  const fraction = balanceBigInt % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.replace(/0+$/, '');
  
  return `${whole}.${trimmed}`;
};

/**
 * 函数级中文注释：解析余额输入（MEMO -> 最小单位）
 * @param input 输入的余额字符串
 * @param decimals 小数位数
 * @returns 最小单位的余额
 */
export const parseBalance = (input: string, decimals: number = 12): string => {
  const parts = input.split('.');
  const whole = parts[0] || '0';
  const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
  
  // 函数级中文注释：使用 BigInt(10) ** BigInt(decimals) 避免 number 溢出
  const balanceBigInt = BigInt(whole) * (BigInt(10) ** BigInt(decimals)) + BigInt(fraction);
  return balanceBigInt.toString();
};

