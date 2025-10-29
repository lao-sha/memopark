/**
 * 本地密钥存储管理
 * 函数级中文注释：提供不依赖浏览器扩展的钱包管理功能
 * - 使用 localStorage 存储加密后的助记词
 * - 支持多账户管理
 * - 使用 PBKDF2 + AES-GCM 加密
 */

import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';

/**
 * 函数级中文注释：本地 Keystore 类型定义
 */
export interface LocalKeystore {
  address: string;
  ciphertext: string;
  salt: string;
  iv: string;
  createdAt: number;
  name?: string;
}

/**
 * 函数级中文注释：从助记词派生地址
 * @param mnemonic 助记词
 * @returns 地址字符串
 */
export async function deriveAddressFromMnemonic(mnemonic: string): Promise<string> {
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });
  const pair = keyring.addFromUri(mnemonic);
  return pair.address;
}

/**
 * 函数级中文注释：生成新钱包
 * @returns { mnemonic, address }
 */
export async function generateLocalWallet(): Promise<{ mnemonic: string; address: string }> {
  const mnemonic = mnemonicGenerate();
  const address = await deriveAddressFromMnemonic(mnemonic);
  return { mnemonic, address };
}

/**
 * 函数级中文注释：使用密码加密数据
 * - 使用 PBKDF2 派生密钥
 * - 使用 AES-GCM 加密
 * @param password 用户密码
 * @param data 待加密数据（助记词）
 * @returns 加密结果
 */
export async function encryptWithPassword(
  password: string,
  data: string
): Promise<{ ciphertext: string; salt: string; iv: string }> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 210000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 加密
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * 函数级中文注释：使用密码解密数据
 * @param password 用户密码
 * @param payload 加密数据
 * @returns 解密后的明文
 */
export async function decryptWithPassword(
  password: string,
  payload: { ciphertext: string; salt: string; iv: string }
): Promise<string> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();

  const salt = Uint8Array.from(atob(payload.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));

  // 派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 210000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 解密
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return dec.decode(plain);
}

/**
 * 函数级中文注释：加载所有 Keystores
 */
export function loadAllKeystores(): LocalKeystore[] {
  try {
    const txt = localStorage.getItem('mg.keystores');
    const list = txt ? JSON.parse(txt) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * 函数级中文注释：保存所有 Keystores
 */
function saveAllKeystores(keystores: LocalKeystore[]): void {
  localStorage.setItem('mg.keystores', JSON.stringify(keystores));
  try {
    window.dispatchEvent(new Event('mg.accountsUpdate'));
  } catch {}
}

/**
 * 函数级中文注释：添加或更新 Keystore
 */
export function upsertKeystore(entry: LocalKeystore): void {
  const list = loadAllKeystores();
  const index = list.findIndex((x) => x.address === entry.address);

  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }

  saveAllKeystores(list);
}

/**
 * 函数级中文注释：删除 Keystore
 */
export function removeKeystore(address: string): void {
  const list = loadAllKeystores().filter((x) => x.address !== address);
  saveAllKeystores(list);

  // 如果删除的是当前账户，切换到第一个账户
  const current = getCurrentAddress();
  if (current === address) {
    setCurrentAddress(list[0]?.address || '');
  }
}

/**
 * 函数级中文注释：获取当前选中的地址
 */
export function getCurrentAddress(): string | null {
  return localStorage.getItem('mg.current') || null;
}

/**
 * 函数级中文注释：设置当前选中的地址
 */
export function setCurrentAddress(address: string): void {
  if (address) {
    localStorage.setItem('mg.current', address);
  } else {
    localStorage.removeItem('mg.current');
  }

  try {
    window.dispatchEvent(new Event('mg.accountsUpdate'));
  } catch {}
}

/**
 * 函数级中文注释：按地址查找 Keystore
 */
export function loadKeystoreByAddress(address: string | null): LocalKeystore | null {
  if (!address) return null;
  const list = loadAllKeystores();
  return list.find((x) => x.address === address) || null;
}

/**
 * 函数级中文注释：获取当前账户的 Keystore
 */
export function loadCurrentKeystore(): LocalKeystore | null {
  const current = getCurrentAddress();
  return loadKeystoreByAddress(current);
}

/**
 * 函数级中文注释：创建密钥对
 * @param mnemonic 助记词
 * @returns KeyringPair
 */
export async function createKeyPair(mnemonic: string) {
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });
  return keyring.addFromUri(mnemonic);
}

/**
 * 函数级中文注释：导出 Keystore JSON
 */
export function exportKeystoreJson(address: string, filename?: string): boolean {
  const keystore = loadKeystoreByAddress(address);
  if (!keystore) return false;

  const blob = new Blob([JSON.stringify(keystore, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `keystore-${address.slice(0, 6)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}

/**
 * 函数级中文注释：导入 Keystore JSON
 */
export async function importKeystoreJson(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || !data.ciphertext || !data.salt || !data.iv) {
      return false;
    }

    const keystore: LocalKeystore = {
      address: data.address || '',
      ciphertext: String(data.ciphertext),
      salt: String(data.salt),
      iv: String(data.iv),
      createdAt: Number(data.createdAt || Date.now()),
      name: data.name || '',
    };

    upsertKeystore(keystore);
    return true;
  } catch {
    return false;
  }
}

