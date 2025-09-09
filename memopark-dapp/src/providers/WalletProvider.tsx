import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ApiPromise } from '@polkadot/api';
// 已切换为本地钱包模式：提供最小账户类型以兼容旧组件（不依赖扩展）
type InjectedAccountWithMeta = { address: string; meta?: any }
import { createPolkadotApi } from '../lib/polkadot';
import { signAndSend as polkadotSignAndSend, sendViaForwarder as polkadotSendViaForwarder } from '../lib/polkadot-safe';
import { Spin } from 'antd';
import { signAndSendLocalFromKeystore } from '../lib/polkadot-safe'

/**
 * 函数级详细中文注释：钱包上下文接口定义
 * - 管理区块链API连接状态
 * - 处理钱包账户连接和选择
 * - 提供错误处理和加载状态
 */
interface WalletContextType {
  api: ApiPromise | null;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  isConnected: boolean;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  selectAccount: (account: InjectedAccountWithMeta) => void;
  error: string | null;
  current: string | null; // 兼容旧代码: 直接提供当前地址
  signAndSend: (section: string, method: string, args: any[]) => Promise<string>;
  sendViaForwarder: (namespace: any, section: string, method: string, args: any[]) => Promise<string>;
  signAndSendLocal: (section: string, method: string, args: any[]) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * 函数级详细中文注释：钱包Hook
 * - 提供访问钱包上下文的方法
 * - 确保在正确的提供者范围内使用
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * 函数级详细中文注释：钱包提供者组件
 * - 初始化区块链API连接
 * - 管理钱包连接状态
 * - 处理错误和加载状态
 */
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  console.log('WalletProvider组件开始渲染');
  
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('WalletProvider useEffect 触发');
    const timer = setTimeout(() => {
      initializeApi();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * 函数级详细中文注释：初始化API连接
   * - 创建Polkadot API实例
   * - 设置错误处理和超时机制
   * - 更新加载状态
   */
  const initializeApi = async () => {
    try {
      console.log('开始初始化API连接');
      setIsLoading(true);
      setError(null);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API连接超时')), 5000)
      );
      
      const apiPromise = createPolkadotApi();
      const apiInstance = await Promise.race([apiPromise, timeoutPromise]) as ApiPromise;
      
      console.log('API连接成功');
      setApi(apiInstance);
    } catch (err) {
      console.error('API初始化失败:', err);
      setError(err instanceof Error ? err.message : '连接区块链失败');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：连接钱包
   * - 启用浏览器扩展
   * - 获取可用账户列表
   * - 设置默认选中账户
   */
  const connectWallet = async () => { setError(null); setIsConnected(false); setAccounts([]); setSelectedAccount(null) };

  /**
   * 函数级详细中文注释：选择账户
   * - 更新当前选中的账户
   */
  const selectAccount = (account: InjectedAccountWithMeta) => {
    console.log('选择账户:', account.address);
    setSelectedAccount(account);
  };

  // 兼容旧版工具函数封装
  const signAndSend = async (section: string, method: string, args: any[]): Promise<string> => {
    return signAndSendLocalFromKeystore(section, method, args)
  };

  const sendViaForwarder = async (namespace: any, section: string, method: string, args: any[]): Promise<string> => {
    // 代付与签名者地址关系由后端决定；此处不强制依赖扩展地址
    return polkadotSendViaForwarder(namespace, '', section, method, args);
  };

  /**
   * 函数级详细中文注释：使用本地 keystore 签名并发送交易
   * - 不依赖浏览器扩展，读取本地加密 keystore 解密后进行 sr25519 签名
   * - 仅用于开发环境或无扩展的场景；主网建议使用扩展
   */
  const signAndSendLocal = async (section: string, method: string, args: any[]): Promise<string> => {
    return signAndSendLocalFromKeystore(section, method, args)
  }

  const value: WalletContextType = {
    api,
    accounts,
    selectedAccount,
    isConnected,
    isLoading,
    connectWallet,
    selectAccount,
    error,
    current: selectedAccount?.address || null,
    signAndSend,
    sendViaForwarder,
    signAndSendLocal,
  };

  // 页面渲染不再被阻塞：即使加载中/失败也渲染子组件，由子组件决定展示文案

  console.log('WalletProvider渲染子组件, API状态:', !!api);
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};