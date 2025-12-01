import { ApiPromise, WsProvider } from '@polkadot/api';
import type { KeyringPair } from '@polkadot/keyring/types';
import { AppConfig } from './config';
import { createSessionSignerAdapter } from './sessionSignerAdapter';
import sessionSigner from './session-signer';
import { getCurrentAddress } from './keystore';
import { getApi as getApiSafe, signAndSend, sendViaForwarder } from './polkadot-safe';

// 兼容旧代码：重新导出安全封装的API工具函数
export { signAndSend, sendViaForwarder };

export const getApi = getApiSafe;

export type SignedApi = ApiPromise & { signer: KeyringPair };

/**
 * 函数级详细中文注释：获取带签名器的 API 实例
 * - 复用 getApiSafe 建立的全局连接
 * - 确保本地钱包已选择账户并初始化会话
 * - 在 ApiPromise 上附加 signer（KeyringPair），兼容旧服务层调用
 */
export const getSignedApi = async (): Promise<SignedApi> => {
  const api = await getApiSafe();
  const currentAddress = getCurrentAddress();
  if (!currentAddress) {
    throw new Error('未找到当前账户，请先在本地钱包中选择账户');
  }

  const signerPair = await sessionSigner.getKeyPairForAddress(currentAddress);
  const signedApi = api as SignedApi;
  signedApi.signer = signerPair;
  return signedApi;
};

// 导出 useApi hook（从 hooks 重新导出）
export { useApi } from '../hooks/useApi';

/**
 * 函数级详细中文注释：创建 Polkadot API 实例
 * - 优先读取环境变量注入的 `VITE_WS`（通过 `AppConfig.wsEndpoint`）
 * - 默认使用 `ws://127.0.0.1:9944`，避免 localhost 触发 IPv6 或证书问题
 * - 设置 1 秒重连间隔与 10 秒连接超时，`throwOnConnect` 便于错误早失败
 * - 返回已就绪的 `ApiPromise` 实例
 */
export const createPolkadotApi = async (): Promise<ApiPromise> => {
  const endpoint = (AppConfig.wsEndpoint || '').replace('wss://localhost', 'ws://127.0.0.1').replace('ws://localhost', 'ws://127.0.0.1') || 'ws://127.0.0.1:9944';

  const wsProvider = new WsProvider(endpoint, 1000, {}, 10000);

  console.log('[Polkadot] 正在创建API连接到:', endpoint);
  const api = await ApiPromise.create({
    provider: wsProvider,
    throwOnConnect: true,
  });

  console.log('[Polkadot] 等待API就绪...');
  await api.isReady;
  try {
    api.setSigner(createSessionSignerAdapter(api.registry));
  } catch (error) {
    console.warn('[Polkadot] 设置本地签名器失败:', error);
  }
  console.log('[Polkadot] API连接就绪');

  return api;
};
