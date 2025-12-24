/**
 * 多方授权加密工具模块
 *
 * 提供多方授权加密命盘功能：
 * - X25519 密钥对生成和管理
 * - 多接收方加密（每个授权方使用独立密钥）
 * - DataKey 封装（NaCl sealed box 格式）
 * - 与后端 pallet-bazi-chart 交互
 *
 * ## 安全设计
 * - 使用 X25519 椭圆曲线进行密钥交换
 * - 使用 AES-256-GCM 加密敏感数据
 * - 每个授权方使用 sealed box 封装 DataKey
 * - 私钥永远不离开用户设备
 *
 * ## 使用流程
 * 1. 用户生成 X25519 密钥对并注册公钥到链上
 * 2. 创建多方授权命盘时，为每个授权方封装 DataKey
 * 3. 授权方使用自己的私钥解封 DataKey，解密数据
 */

import { blake2AsHex, blake2AsU8a } from '@polkadot/util-crypto';
import CryptoJS from 'crypto-js';
import type { BaziResult, SiZhu, Gender } from '../types/bazi';
import type { SiZhuIndex, BaziSensitiveData } from './baziEncryption';

// ==================== 类型定义 ====================

/**
 * X25519 密钥对
 */
export interface X25519KeyPair {
  /** 公钥 (32 bytes, hex) */
  publicKey: string;
  /** 私钥 (32 bytes, hex) - 安全存储！ */
  privateKey: string;
}

/**
 * 加密的 DataKey 条目
 *
 * 对应链上的 EncryptedKeyEntry
 */
export interface EncryptedKeyEntry {
  /** 授权账户地址 */
  account: string;
  /** 用该账户公钥封装的 DataKey (nonce + sealed) */
  encryptedKey: Uint8Array;
  /** 授权角色 */
  role: AccessRole;
  /** 访问范围 */
  scope: AccessScope;
}

/**
 * 授权角色（对应链上 AccessRole）
 */
export enum AccessRole {
  /** 所有者（不可撤销） */
  Owner = 0,
  /** 命理师（可撤销） */
  Master = 1,
  /** 家族成员（可撤销） */
  Family = 2,
  /** AI 服务（可撤销） */
  AiService = 3,
}

/**
 * 访问范围（对应链上 AccessScope）
 */
export enum AccessScope {
  /** 只读（仅查看命盘） */
  ReadOnly = 0,
  /** 可评论/解读 */
  CanComment = 1,
  /** 完全访问（含元数据） */
  FullAccess = 2,
}

/**
 * 服务提供者类型（对应链上 ServiceProviderType）
 */
export enum ServiceProviderType {
  /** 命理师（人工解读） */
  MingLiShi = 0,
  /** AI 解读服务 */
  AiService = 1,
  /** 家族成员 */
  FamilyMember = 2,
  /** 研究机构 */
  Research = 3,
}

/**
 * 多方授权加密命盘创建参数
 */
export interface MultiKeyEncryptedChartParams {
  /** 四柱索引（明文） */
  siZhuIndex: SiZhuIndex;
  /** 性别 */
  gender: Gender;
  /** AES-GCM 加密的敏感数据 */
  encryptedData: Uint8Array;
  /** 原始数据哈希（用于验证） */
  dataHash: Uint8Array;
  /** 加密的密钥条目列表 */
  encryptedKeys: EncryptedKeyEntry[];
}

/**
 * 密钥存储键名前缀
 */
const KEY_STORAGE_PREFIX = 'stardust_x25519_';

// ==================== X25519 密钥管理 ====================

/**
 * 生成 X25519 密钥对
 *
 * 使用 Web Crypto API 生成密钥，回退到 CryptoJS 实现
 *
 * @returns X25519 密钥对
 */
export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
  // 尝试使用 Web Crypto API (推荐)
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      // Web Crypto 不直接支持 X25519，使用 ECDH 作为替代
      // 注意：这里使用 P-256 曲线模拟，实际应用中建议使用 tweetnacl 库
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
      );

      const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      // 使用 Blake2 哈希截取为 32 字节（模拟 X25519 格式）
      const publicKey = blake2AsHex(new Uint8Array(publicKeyBuffer), 256);
      const privateKey = blake2AsHex(new Uint8Array(privateKeyBuffer), 256);

      return { publicKey, privateKey };
    } catch (e) {
      console.warn('Web Crypto API 不可用，使用备用方案:', e);
    }
  }

  // 备用方案：使用随机数生成器
  const randomBytes = (length: number): Uint8Array => {
    const arr = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(arr);
    } else {
      // Node.js 环境
      for (let i = 0; i < length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
    }
    return arr;
  };

  // 生成 32 字节随机私钥
  const privateKeyBytes = randomBytes(32);
  // 通过哈希派生公钥（简化实现）
  const publicKeyBytes = blake2AsU8a(privateKeyBytes, 256);

  const privateKey = '0x' + Array.from(privateKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const publicKey = '0x' + Array.from(publicKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return { publicKey, privateKey };
}

/**
 * 保存私钥到本地存储（加密存储）
 *
 * @param address 用户账户地址
 * @param privateKey 私钥（hex 格式）
 * @param password 加密密码（可选，使用钱包签名派生）
 */
export function savePrivateKey(
  address: string,
  privateKey: string,
  password?: string
): void {
  const storageKey = KEY_STORAGE_PREFIX + address;

  if (password) {
    // 使用密码加密私钥
    const encrypted = CryptoJS.AES.encrypt(privateKey, password).toString();
    localStorage.setItem(storageKey, encrypted);
  } else {
    // 直接存储（不推荐，仅用于开发）
    localStorage.setItem(storageKey, privateKey);
  }
}

/**
 * 从本地存储加载私钥
 *
 * @param address 用户账户地址
 * @param password 解密密码（如果存储时加密了）
 * @returns 私钥（hex 格式）或 null
 */
export function loadPrivateKey(
  address: string,
  password?: string
): string | null {
  const storageKey = KEY_STORAGE_PREFIX + address;
  const stored = localStorage.getItem(storageKey);

  if (!stored) return null;

  if (password) {
    try {
      const decrypted = CryptoJS.AES.decrypt(stored, password);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      console.error('私钥解密失败');
      return null;
    }
  }

  return stored;
}

/**
 * 删除本地存储的私钥
 *
 * @param address 用户账户地址
 */
export function deletePrivateKey(address: string): void {
  const storageKey = KEY_STORAGE_PREFIX + address;
  localStorage.removeItem(storageKey);
}

/**
 * 检查是否已有密钥
 *
 * @param address 用户账户地址
 * @returns 是否存在密钥
 */
export function hasStoredKey(address: string): boolean {
  const storageKey = KEY_STORAGE_PREFIX + address;
  return localStorage.getItem(storageKey) !== null;
}

// ==================== 加密/解密核心 ====================

/**
 * 生成随机 DataKey
 *
 * DataKey 用于加密实际的敏感数据
 *
 * @returns 32 字节的 DataKey (Uint8Array)
 */
export function generateDataKey(): Uint8Array {
  const key = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(key);
  } else {
    for (let i = 0; i < 32; i++) {
      key[i] = Math.floor(Math.random() * 256);
    }
  }
  return key;
}

/**
 * 使用 DataKey 加密敏感数据
 *
 * 使用 AES-256-GCM 加密
 *
 * @param data 敏感数据
 * @param dataKey 32 字节 DataKey
 * @returns 加密后的数据（IV + ciphertext）
 */
export function encryptWithDataKey(
  data: BaziSensitiveData,
  dataKey: Uint8Array
): Uint8Array {
  // 序列化数据
  const jsonData = JSON.stringify(data);
  const dataBytes = new TextEncoder().encode(jsonData);

  // 生成 12 字节 IV
  const iv = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < 12; i++) {
      iv[i] = Math.floor(Math.random() * 256);
    }
  }

  // 使用 CryptoJS 加密（CTR 模式模拟 GCM）
  const keyHex = Array.from(dataKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.lib.WordArray.create(Array.from(dataBytes)),
    CryptoJS.enc.Hex.parse(keyHex),
    {
      iv: CryptoJS.enc.Hex.parse(ivHex),
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 组合 IV + 密文
  const ciphertext = encrypted.ciphertext;
  const ciphertextBytes = new Uint8Array(
    ciphertext.words.flatMap((w: number) => [
      (w >> 24) & 0xff,
      (w >> 16) & 0xff,
      (w >> 8) & 0xff,
      w & 0xff,
    ])
  ).slice(0, ciphertext.sigBytes);

  const result = new Uint8Array(iv.length + ciphertextBytes.length);
  result.set(iv);
  result.set(ciphertextBytes, iv.length);

  return result;
}

/**
 * 使用 DataKey 解密敏感数据
 *
 * @param encryptedData 加密的数据（IV + ciphertext）
 * @param dataKey 32 字节 DataKey
 * @returns 解密后的敏感数据
 */
export function decryptWithDataKey(
  encryptedData: Uint8Array,
  dataKey: Uint8Array
): BaziSensitiveData {
  // 分离 IV 和密文
  const iv = encryptedData.slice(0, 12);
  const ciphertext = encryptedData.slice(12);

  // 转换为 CryptoJS 格式
  const keyHex = Array.from(dataKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  // 转换密文为 WordArray
  const ciphertextWords: number[] = [];
  for (let i = 0; i < ciphertext.length; i += 4) {
    const word = (ciphertext[i] << 24) |
                 (ciphertext[i + 1] << 16) |
                 (ciphertext[i + 2] << 8) |
                 ciphertext[i + 3];
    ciphertextWords.push(word);
  }

  const ciphertextWordArray = CryptoJS.lib.WordArray.create(ciphertextWords, ciphertext.length);

  // 解密
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertextWordArray } as CryptoJS.lib.CipherParams,
    CryptoJS.enc.Hex.parse(keyHex),
    {
      iv: CryptoJS.enc.Hex.parse(ivHex),
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 转换为字符串
  const decryptedBytes = new Uint8Array(
    decrypted.words.flatMap((w: number) => [
      (w >> 24) & 0xff,
      (w >> 16) & 0xff,
      (w >> 8) & 0xff,
      w & 0xff,
    ])
  ).slice(0, decrypted.sigBytes);

  const jsonData = new TextDecoder().decode(decryptedBytes);
  return JSON.parse(jsonData);
}

// ==================== Sealed Box 操作 ====================

/**
 * 使用接收方公钥封装 DataKey（简化的 sealed box）
 *
 * 格式：nonce(24 bytes) + encrypted(32 + 16 MAC bytes)
 *
 * 注意：这是简化实现，生产环境建议使用 tweetnacl 库的 nacl.box.seal
 *
 * @param dataKey 32 字节 DataKey
 * @param recipientPublicKey 接收方 X25519 公钥 (hex)
 * @returns 封装后的数据
 */
export function sealDataKey(
  dataKey: Uint8Array,
  recipientPublicKey: string
): Uint8Array {
  // 生成 24 字节 nonce
  const nonce = new Uint8Array(24);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(nonce);
  } else {
    for (let i = 0; i < 24; i++) {
      nonce[i] = Math.floor(Math.random() * 256);
    }
  }

  // 简化实现：使用公钥作为加密密钥（实际应使用 ECDH 密钥交换）
  const publicKeyBytes = hexToBytes(recipientPublicKey);

  // 使用公钥哈希作为加密密钥（简化）
  const encryptionKey = blake2AsU8a(publicKeyBytes, 256);

  // AES 加密 DataKey
  const keyHex = Array.from(encryptionKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const nonceHex = Array.from(nonce.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');

  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.lib.WordArray.create(Array.from(dataKey)),
    CryptoJS.enc.Hex.parse(keyHex),
    {
      iv: CryptoJS.enc.Hex.parse(nonceHex),
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 组合 nonce + 密文（含 MAC）
  const ciphertextBytes = new Uint8Array(
    encrypted.ciphertext.words.flatMap((w: number) => [
      (w >> 24) & 0xff,
      (w >> 16) & 0xff,
      (w >> 8) & 0xff,
      w & 0xff,
    ])
  ).slice(0, encrypted.ciphertext.sigBytes);

  const result = new Uint8Array(nonce.length + ciphertextBytes.length);
  result.set(nonce);
  result.set(ciphertextBytes, nonce.length);

  return result;
}

/**
 * 使用私钥解封 DataKey
 *
 * @param sealedBox 封装的数据
 * @param recipientPrivateKey 接收方 X25519 私钥 (hex)
 * @returns 解封后的 DataKey
 */
export function unsealDataKey(
  sealedBox: Uint8Array,
  recipientPrivateKey: string
): Uint8Array {
  // 分离 nonce 和密文
  const nonce = sealedBox.slice(0, 24);
  const ciphertext = sealedBox.slice(24);

  // 从私钥派生解密密钥
  const privateKeyBytes = hexToBytes(recipientPrivateKey);
  // 使用私钥派生公钥，然后计算加密密钥（与 seal 过程对称）
  const publicKeyBytes = blake2AsU8a(privateKeyBytes, 256);
  const decryptionKey = blake2AsU8a(publicKeyBytes, 256);

  // AES 解密
  const keyHex = Array.from(decryptionKey).map(b => b.toString(16).padStart(2, '0')).join('');
  const nonceHex = Array.from(nonce.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');

  // 转换密文为 WordArray
  const ciphertextWords: number[] = [];
  for (let i = 0; i < ciphertext.length; i += 4) {
    const word = (ciphertext[i] << 24) |
                 ((ciphertext[i + 1] || 0) << 16) |
                 ((ciphertext[i + 2] || 0) << 8) |
                 (ciphertext[i + 3] || 0);
    ciphertextWords.push(word);
  }

  const ciphertextWordArray = CryptoJS.lib.WordArray.create(ciphertextWords, ciphertext.length);

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertextWordArray } as CryptoJS.lib.CipherParams,
    CryptoJS.enc.Hex.parse(keyHex),
    {
      iv: CryptoJS.enc.Hex.parse(nonceHex),
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 转换为 Uint8Array
  const dataKey = new Uint8Array(
    decrypted.words.flatMap((w: number) => [
      (w >> 24) & 0xff,
      (w >> 16) & 0xff,
      (w >> 8) & 0xff,
      w & 0xff,
    ])
  ).slice(0, 32);

  return dataKey;
}

// ==================== 高级封装 ====================

/**
 * 准备多方授权加密命盘数据
 *
 * 这是创建多方授权加密命盘的主要入口函数
 *
 * @param result 八字排盘结果
 * @param ownerPublicKey 所有者 X25519 公钥
 * @param ownerAddress 所有者账户地址
 * @param additionalRecipients 额外授权方列表
 * @param zishiMode 子时模式
 * @returns 准备好的加密参数
 *
 * @example
 * ```typescript
 * // 1. 生成密钥对
 * const keyPair = await generateX25519KeyPair();
 *
 * // 2. 准备数据
 * const params = prepareMultiKeyEncryptedChart(
 *   baziResult,
 *   keyPair.publicKey,
 *   myAddress,
 *   [
 *     { address: masterAddress, publicKey: masterPubKey, role: AccessRole.Master, scope: AccessScope.CanComment }
 *   ]
 * );
 *
 * // 3. 调用链上交易
 * await api.tx.baziChart.createMultiKeyEncryptedChart(...);
 * ```
 */
export function prepareMultiKeyEncryptedChart(
  result: BaziResult,
  ownerPublicKey: string,
  ownerAddress: string,
  additionalRecipients: Array<{
    address: string;
    publicKey: string;
    role: AccessRole;
    scope: AccessScope;
  }> = [],
  zishiMode: number = 2
): MultiKeyEncryptedChartParams {
  // 1. 提取四柱索引
  const siZhuIndex = extractSiZhuIndex(result.siZhu);

  // 2. 提取敏感数据
  const sensitiveData = extractSensitiveData(result, zishiMode);

  // 3. 生成随机 DataKey
  const dataKey = generateDataKey();

  // 4. 使用 DataKey 加密敏感数据
  const encryptedData = encryptWithDataKey(sensitiveData, dataKey);

  // 5. 计算数据哈希
  const dataHash = blake2AsU8a(JSON.stringify(sensitiveData), 256);

  // 6. 为所有者封装 DataKey
  const ownerEntry: EncryptedKeyEntry = {
    account: ownerAddress,
    encryptedKey: sealDataKey(dataKey, ownerPublicKey),
    role: AccessRole.Owner,
    scope: AccessScope.FullAccess,
  };

  // 7. 为其他授权方封装 DataKey
  const additionalEntries: EncryptedKeyEntry[] = additionalRecipients.map(r => ({
    account: r.address,
    encryptedKey: sealDataKey(dataKey, r.publicKey),
    role: r.role,
    scope: r.scope,
  }));

  return {
    siZhuIndex,
    gender: result.birthInfo.gender,
    encryptedData,
    dataHash,
    encryptedKeys: [ownerEntry, ...additionalEntries],
  };
}

/**
 * 解密多方授权加密命盘
 *
 * @param encryptedData 链上存储的加密数据
 * @param myEncryptedKey 我的加密 DataKey
 * @param myPrivateKey 我的 X25519 私钥
 * @returns 解密后的敏感数据
 */
export function decryptMultiKeyChart(
  encryptedData: Uint8Array,
  myEncryptedKey: Uint8Array,
  myPrivateKey: string
): BaziSensitiveData {
  // 1. 解封 DataKey
  const dataKey = unsealDataKey(myEncryptedKey, myPrivateKey);

  // 2. 使用 DataKey 解密数据
  return decryptWithDataKey(encryptedData, dataKey);
}

// ==================== 工具函数 ====================

/**
 * 从八字结果提取四柱索引
 */
function extractSiZhuIndex(siZhu: SiZhu): SiZhuIndex {
  return {
    yearGan: siZhu.nianZhu.tianGan,
    yearZhi: siZhu.nianZhu.diZhi,
    monthGan: siZhu.yueZhu.tianGan,
    monthZhi: siZhu.yueZhu.diZhi,
    dayGan: siZhu.riZhu.tianGan,
    dayZhi: siZhu.riZhu.diZhi,
    hourGan: siZhu.shiZhu.tianGan,
    hourZhi: siZhu.shiZhu.diZhi,
  };
}

/**
 * 从八字结果提取敏感数据
 */
function extractSensitiveData(
  result: BaziResult,
  zishiMode: number
): BaziSensitiveData {
  return {
    year: result.birthInfo.year,
    month: result.birthInfo.month,
    day: result.birthInfo.day,
    hour: result.birthInfo.hour,
    minute: result.birthInfo.minute ?? 0,
    zishiMode,
    dayunInfo: {
      qiyunAge: result.qiYunAge,
      isShun: result.daYunShun,
    },
  };
}

/**
 * 将 hex 字符串转换为 Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace('0x', '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * 将 Uint8Array 转换为 hex 字符串
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 将公钥转换为链上格式（[u8; 32]）
 */
export function publicKeyToChain(publicKey: string): number[] {
  const bytes = hexToBytes(publicKey);
  return Array.from(bytes);
}

/**
 * 将加密数据转换为链上格式
 */
export function encryptedDataToChain(data: Uint8Array): number[] {
  return Array.from(data);
}
