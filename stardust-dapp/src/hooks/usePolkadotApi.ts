/// Stardust Polkadot API Hook - 统一API状态管理

import { useState, useEffect } from 'react';
import { ApiPromise } from '@polkadot/api';
import { getApi } from '../lib/providers';

export interface PolkadotApiState {
  api: ApiPromise | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

export const usePolkadotApi = () => {
  const [state, setState] = useState<PolkadotApiState>({
    api: null,
    isReady: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const initializeApi = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        const api = await getApi();

        if (!isMounted) return;

        setState({
          api,
          isReady: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) return;

        console.error('API初始化失败:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : '未知错误',
        }));
      }
    };

    initializeApi();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
};