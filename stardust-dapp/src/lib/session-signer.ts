/**
 * 会话签名管理器
 *
 * 用户输入一次密码后，密钥对缓存在内存中，会话期间自动签名
 * 默认会话时长：10天
 */

import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { decryptWithPassword, loadCurrentKeystore, getCurrentAddress } from './keystore';

/// 会话状态
export interface SessionState {
  isActive: boolean;
  address: string | null;
  expiresAt: number | null;
  remainingTime: number; // 剩余时间（毫秒）
}

/// 会话签名管理器类
class SessionSignerManager {
  private keyPair: KeyringPair | null = null;
  private address: string | null = null;
  private expiresAt: number = 0;
  private sessionDuration: number = 10 * 24 * 60 * 60 * 1000; // 默认10天

  /// 检查会话是否有效
  isSessionActive(): boolean {
    return this.keyPair !== null && Date.now() < this.expiresAt;
  }

  /// 获取会话状态
  getSessionState(): SessionState {
    const now = Date.now();
    return {
      isActive: this.isSessionActive(),
      address: this.address,
      expiresAt: this.expiresAt > 0 ? this.expiresAt : null,
      remainingTime: this.expiresAt > now ? this.expiresAt - now : 0,
    };
  }

  /// 获取剩余时间（格式化）
  getRemainingTimeFormatted(): string {
    const remaining = this.expiresAt - Date.now();
    if (remaining <= 0) return '已过期';

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  /// 初始化会话（用户输入密码）
  async initSession(password: string, durationMs?: number): Promise<void> {
    try {
      const ks = loadCurrentKeystore();
      if (!ks) {
        throw new Error('未找到本地钱包，请先创建钱包');
      }

      const currentAddr = getCurrentAddress();
      if (!currentAddr) {
        throw new Error('未选择当前账户');
      }

      if (!password || password.length < 8) {
        throw new Error('密码不能少于8位');
      }

      // 解密助记词
      const mnemonic = await decryptWithPassword(password, ks);

      // 等待加密库就绪
      await cryptoWaitReady();

      // 创建密钥对
      const keyring = new Keyring({ type: 'sr25519' });
      const pair = keyring.addFromUri(mnemonic);

      // 验证地址匹配
      if (pair.address !== currentAddr) {
        throw new Error(`地址不匹配：keystore解密出的地址与当前账户不符`);
      }

      // 保存会话
      this.keyPair = pair;
      this.address = currentAddr;
      this.expiresAt = Date.now() + (durationMs || this.sessionDuration);

      console.log('[SessionSigner] 会话已初始化');
      console.log('[SessionSigner] 地址:', this.address);
      console.log('[SessionSigner] 过期时间:', new Date(this.expiresAt).toLocaleString());
      console.log('[SessionSigner] 剩余时间:', this.getRemainingTimeFormatted());

    } catch (error) {
      console.error('[SessionSigner] 初始化会话失败:', error);
      throw error;
    }
  }

  /// 使用弹窗初始化会话
  async initSessionWithPrompt(): Promise<boolean> {
    // 如果会话仍然有效，无需重新初始化
    if (this.isSessionActive()) {
      console.log('[SessionSigner] 会话仍然有效，剩余:', this.getRemainingTimeFormatted());
      return true;
    }

    // 弹窗提示输入密码
    let password: string | null = null;
    for (let i = 0; i < 3; i++) {
      const input = window.prompt(
        i === 0
          ? '请输入钱包密码以开启签名会话（有效期10天）：'
          : '密码错误，请重新输入（至少8位）：'
      );

      if (input === null) {
        // 用户点击了取消
        return false;
      }

      if (input && input.length >= 8) {
        password = input;
        break;
      }

      window.alert('密码必须至少8位');
    }

    if (!password) {
      return false;
    }

    try {
      await this.initSession(password);
      window.alert(`签名会话已开启，有效期：${this.getRemainingTimeFormatted()}`);
      return true;
    } catch (error) {
      window.alert(`会话初始化失败：${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }

  /// 签名并发送交易（自动使用缓存的密钥对）
  async signAndSendTx(tx: any): Promise<string> {
    // 检查会话是否有效
    if (!this.isSessionActive()) {
      // 尝试初始化会话
      const success = await this.initSessionWithPrompt();
      if (!success) {
        throw new Error('用户取消了签名');
      }
    }

    // 验证地址匹配
    const currentAddr = getCurrentAddress();
    if (currentAddr !== this.address) {
      // 地址变了，需要重新初始化
      this.clearSession();
      const success = await this.initSessionWithPrompt();
      if (!success) {
        throw new Error('用户取消了签名');
      }
    }

    // 签名并发送
    return new Promise((resolve, reject) => {
      tx.signAndSend(this.keyPair!, ({ status, dispatchError }: any) => {
        console.log('[SessionSigner] 交易状态:', status.type);

        if (status.isInBlock) {
          console.log('[SessionSigner] ✓ 交易已打包进区块:', status.asInBlock.toString());
        }

        if (status.isFinalized) {
          console.log('[SessionSigner] ✓ 交易已最终确认:', status.asFinalized.toString());

          // 检查是否有调度错误
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = tx.registry.findMetaError(dispatchError.asModule);
              const { docs, name, section } = decoded;
              reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
          } else {
            resolve(status.asFinalized.toString());
          }
        }
      }).catch(reject);
    });
  }

  /// 清除会话
  clearSession(): void {
    this.keyPair = null;
    this.address = null;
    this.expiresAt = 0;
    console.log('[SessionSigner] 会话已清除');
  }

  /// 延长会话
  extendSession(additionalMs?: number): void {
    if (this.keyPair) {
      this.expiresAt = Date.now() + (additionalMs || this.sessionDuration);
      console.log('[SessionSigner] 会话已延长至:', new Date(this.expiresAt).toLocaleString());
    }
  }

  /// 获取当前密钥对（仅供内部使用）
  getKeyPair(): KeyringPair | null {
    if (!this.isSessionActive()) {
      return null;
    }
    return this.keyPair;
  }
}

/// 单例实例
export const sessionSigner = new SessionSignerManager();

/// 导出默认实例
export default sessionSigner;
