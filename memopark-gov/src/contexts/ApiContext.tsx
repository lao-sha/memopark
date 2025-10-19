/**
 * API Context - 区块链连接管理
 * 函数级中文注释：提供全局的 Polkadot API 连接
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { message } from 'antd';
import type { ApiContextType } from '@/types';

const ApiContext = createContext<ApiContextType | undefined>(undefined);

interface ApiProviderProps {
  children: ReactNode;
  endpoint?: string;
}

/**
 * 函数级中文注释：API Provider 组件
 * - 自动连接到本地节点
 * - 提供全局 API 实例
 * - 处理连接状态和错误
 */
export const ApiProvider: React.FC<ApiProviderProps> = ({ 
  children,
  endpoint = 'ws://127.0.0.1:9944' 
}) => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let apiInstance: ApiPromise | null = null;
    let providerInstance: WsProvider | null = null;

    /**
     * 函数级中文注释：事件处理函数
     * - 单独定义以便正确移除监听器
     * - 检查组件挂载状态避免内存泄漏
     */
    const handleDisconnected = () => {
      if (!isMounted) return;
      console.log('❌ 链端连接断开');
      setIsConnected(false);
      message.error('链端连接断开');
    };

    const handleConnected = () => {
      if (!isMounted) return;
      console.log('✅ 链端重新连接');
      setIsConnected(true);
      message.success('链端重新连接');
    };

    const handleError = (error: Error) => {
      if (!isMounted) return;
      console.error('❌ 链端连接错误:', error);
      message.error(`连接错误: ${error.message}`);
    };

    const connectToChain = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('🔗 正在连接到链端:', endpoint);

        // 创建 Provider
        providerInstance = new WsProvider(endpoint);
        
        // 注册事件监听器
        providerInstance.on('disconnected', handleDisconnected as any);
        providerInstance.on('connected', handleConnected as any);
        providerInstance.on('error', handleError as any);

        // 创建 API
        apiInstance = await ApiPromise.create({ provider: providerInstance });

        if (!isMounted) {
          await apiInstance.disconnect();
          return;
        }

        await apiInstance.isReady;

        if (!isMounted) {
          await apiInstance.disconnect();
          return;
        }

        setApi(apiInstance);
        setIsConnected(true);
        setIsLoading(false);

        console.log('✅ 链端连接成功');
        message.success('链端连接成功');

      } catch (err: any) {
        console.error('❌ 链端连接失败:', err);
        const errorMsg = err?.message || '未知错误';
        setError(errorMsg);
        setIsLoading(false);
        message.error(`链端连接失败: ${errorMsg}`);
      }
    };

    connectToChain();

    /**
     * 函数级中文注释：清理函数
     * - 移除事件监听器防止内存泄漏
     * - 断开 API 连接
     */
    return () => {
      isMounted = false;
      
      console.log('🧹 清理 API 连接...');
      
      // 移除事件监听器
      if (providerInstance) {
        try { (providerInstance as any).off?.('disconnected', handleDisconnected as any); } catch {}
        try { (providerInstance as any).off?.('connected', handleConnected as any); } catch {}
        try { (providerInstance as any).off?.('error', handleError as any); } catch {}
      }
      
      // 断开连接
      if (apiInstance) {
        apiInstance.disconnect()
          .then(() => console.log('🔌 API 已断开'))
          .catch(err => console.error('断开连接失败:', err));
      }
    };
  }, [endpoint]);

  return (
    <ApiContext.Provider value={{ api, isConnected, isLoading, error }}>
      {children}
    </ApiContext.Provider>
  );
};

/**
 * 函数级中文注释：使用 API Context 的 Hook
 */
export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
};

