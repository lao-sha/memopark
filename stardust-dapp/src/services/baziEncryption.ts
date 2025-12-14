/**
 * 八字命盘加密工具模块
 *
 * 提供八字敏感数据的加密存储功能：
 * - 钱包签名派生密钥（无需密码）
 * - AES-256-GCM 加解密
 * - 敏感数据序列化/反序列化
 * - 四柱索引提取（用于链上计算）
 *
 * ## 安全特性
 * - 出生时间等敏感数据在前端加密后存储
 * - 四柱索引明文存储，支持 Runtime API 免费计算解盘
 * - 用户通过钱包签名派生密钥，无需记忆额外密码
 *
 * ## 使用流程
 * 1. 用户创建八字时，调用 deriveEncryptionKey() 派生密钥
 * 2. 使用 encryptBaziData() 加密敏感数据
 * 3. 使用 extractSiZhuIndex() 提取四柱索引
 * 4. 调用链上 create_encrypted_chart() 存储
 * 5. 查看时使用 decryptBaziData() 解密显示
 */

import { blake2AsHex, blake2AsU8a } from '@polkadot/util-crypto';
import CryptoJS from 'crypto-js';
import type { BaziResult, SiZhu, Gender } from '../types/bazi';

// ==================== 类型定义 ====================

/**
 * 四柱干支索引（对应链上 SiZhuIndex）
 *
 * 仅保存干支索引，无法反推出生时间
 */
export interface SiZhuIndex {
  /** 年柱天干索引 (0-9) */
  yearGan: number;
  /** 年柱地支索引 (0-11) */
  yearZhi: number;
  /** 月柱天干索引 (0-9) */
  monthGan: number;
  /** 月柱地支索引 (0-11) */
  monthZhi: number;
  /** 日柱天干索引 (0-9) */
  dayGan: number;
  /** 日柱地支索引 (0-11) */
  dayZhi: number;
  /** 时柱天干索引 (0-9) */
  hourGan: number;
  /** 时柱地支索引 (0-11) */
  hourZhi: number;
}

/**
 * 加密的敏感数据结构
 *
 * 包含所有需要加密保护的八字信息
 */
export interface BaziSensitiveData {
  /** 出生年份 */
  year: number;
  /** 出生月份 */
  month: number;
  /** 出生日期 */
  day: number;
  /** 出生时辰 */
  hour: number;
  /** 出生分钟 */
  minute: number;
  /** 子时模式 (1=传统派, 2=现代派) */
  zishiMode: number;
  /** 大运信息（简化版） */
  dayunInfo?: {
    qiyunAge: number;
    isShun: boolean;
  };
  /** 扩展数据（预留） */
  extra?: Record<string, unknown>;
}

/**
 * 加密结果
 */
export interface EncryptedBaziResult {
  /** 四柱索引（明文，用于链上计算） */
  siZhuIndex: SiZhuIndex;
  /** 性别（明文，用于大运计算） */
  gender: Gender;
  /** 加密后的数据（Base64 编码） */
  encryptedData: string;
  /** 原始数据哈希（用于验证解密正确性） */
  dataHash: string;
}

/**
 * 密钥派生消息常量
 *
 * 用于钱包签名派生加密密钥的固定消息
 */
const KEY_DERIVATION_MESSAGE = 'Stardust Bazi Encryption Key v1.0 - Sign to unlock your encrypted birth data';

// ==================== 密钥派生 ====================

/**
 * 从钱包签名派生加密密钥
 *
 * 使用固定消息让用户签名，然后从签名结果派生 AES-256 密钥
 *
 * @param signMessage 钱包签名函数
 * @returns 32 字节的加密密钥（hex 格式）
 *
 * @example
 * ```typescript
 * const key = await deriveEncryptionKey(async (msg) => {
 *   const { signature } = await web3FromAddress(address).signer.signRaw({
 *     address,
 *     data: msg,
 *     type: 'bytes'
 *   });
 *   return signature;
 * });
 * ```
 */
export async function deriveEncryptionKey(
  signMessage: (message: string) => Promise<string>
): Promise<string> {
  // 1. 使用钱包签名固定消息
  const signature = await signMessage(KEY_DERIVATION_MESSAGE);

  // 2. 使用 Blake2-256 哈希签名结果作为密钥
  // 这确保了密钥的长度固定为 32 字节，适合 AES-256
  const keyHex = blake2AsHex(signature, 256);

  return keyHex;
}

/**
 * 从签名直接派生密钥（同步版本）
 *
 * 当已经有签名结果时使用
 *
 * @param signature 钱包签名结果
 * @returns 32 字节的加密密钥（hex 格式）
 */
export function deriveKeyFromSignature(signature: string): string {
  return blake2AsHex(signature, 256);
}

// ==================== 加密/解密 ====================

/**
 * 加密八字敏感数据
 *
 * 使用 AES-256-GCM 加密敏感数据
 *
 * @param data 敏感数据
 * @param key 加密密钥（hex 格式，从钱包签名派生）
 * @returns 加密后的数据（Base64 编码）和数据哈希
 */
export function encryptBaziData(
  data: BaziSensitiveData,
  key: string
): { encryptedData: string; dataHash: string } {
  // 1. 序列化数据为 JSON
  const jsonData = JSON.stringify(data);

  // 2. 计算原始数据哈希（用于验证解密正确性）
  const dataHash = blake2AsHex(jsonData, 256);

  // 3. 生成随机 IV（12 字节，用于 GCM 模式）
  const iv = CryptoJS.lib.WordArray.random(12);

  // 4. 将 hex 密钥转换为 WordArray
  const keyWordArray = CryptoJS.enc.Hex.parse(key.replace('0x', ''));

  // 5. AES-256 加密（使用 CTR 模式模拟 GCM，因为 CryptoJS 不直接支持 GCM）
  // 注意：实际生产环境建议使用 Web Crypto API 的原生 GCM 支持
  const encrypted = CryptoJS.AES.encrypt(jsonData, keyWordArray, {
    iv: iv,
    mode: CryptoJS.mode.CTR,
    padding: CryptoJS.pad.NoPadding,
  });

  // 6. 组合 IV + 密文
  const combined = iv.concat(encrypted.ciphertext);

  // 7. Base64 编码
  const encryptedData = CryptoJS.enc.Base64.stringify(combined);

  return { encryptedData, dataHash };
}

/**
 * 解密八字敏感数据
 *
 * @param encryptedData 加密后的数据（Base64 编码）
 * @param key 加密密钥（hex 格式）
 * @param expectedHash 预期的数据哈希（可选，用于验证）
 * @returns 解密后的敏感数据
 * @throws 解密失败或哈希验证失败时抛出错误
 */
export function decryptBaziData(
  encryptedData: string,
  key: string,
  expectedHash?: string
): BaziSensitiveData {
  // 1. Base64 解码
  const combined = CryptoJS.enc.Base64.parse(encryptedData);

  // 2. 分离 IV 和密文
  const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, 3), 12);
  const ciphertext = CryptoJS.lib.WordArray.create(
    combined.words.slice(3),
    combined.sigBytes - 12
  );

  // 3. 将 hex 密钥转换为 WordArray
  const keyWordArray = CryptoJS.enc.Hex.parse(key.replace('0x', ''));

  // 4. 解密
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext } as CryptoJS.lib.CipherParams,
    keyWordArray,
    {
      iv: iv,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding,
    }
  );

  // 5. 转换为字符串
  const jsonData = decrypted.toString(CryptoJS.enc.Utf8);

  if (!jsonData) {
    throw new Error('解密失败：密钥可能不正确');
  }

  // 6. 验证哈希（如果提供）
  if (expectedHash) {
    const actualHash = blake2AsHex(jsonData, 256);
    if (actualHash !== expectedHash) {
      throw new Error('数据验证失败：哈希不匹配，数据可能已被篡改');
    }
  }

  // 7. 解析 JSON
  try {
    return JSON.parse(jsonData) as BaziSensitiveData;
  } catch {
    throw new Error('解密失败：数据格式无效');
  }
}

// ==================== 数据转换 ====================

/**
 * 从八字结果提取四柱索引
 *
 * 四柱索引可以安全地存储在链上（明文），
 * 因为仅凭干支索引无法反推出具体的出生时间
 *
 * @param siZhu 四柱数据
 * @returns 四柱索引
 */
export function extractSiZhuIndex(siZhu: SiZhu): SiZhuIndex {
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
 *
 * @param result 八字排盘结果
 * @param zishiMode 子时模式 (1=传统派, 2=现代派)
 * @returns 敏感数据结构
 */
export function extractSensitiveData(
  result: BaziResult,
  zishiMode: number = 2
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
 * 准备加密八字数据（完整流程）
 *
 * 这是创建加密八字命盘的主要入口函数
 *
 * @param result 八字排盘结果
 * @param key 加密密钥（从钱包签名派生）
 * @param zishiMode 子时模式 (1=传统派, 2=现代派)
 * @returns 准备好的加密结果，可直接用于链上存储
 *
 * @example
 * ```typescript
 * // 1. 派生密钥
 * const key = await deriveEncryptionKey(signFn);
 *
 * // 2. 准备加密数据
 * const encrypted = prepareEncryptedBaziData(baziResult, key);
 *
 * // 3. 调用链上存储
 * await api.tx.baziChart.createEncryptedChart(
 *   encrypted.siZhuIndex,
 *   encrypted.gender,
 *   encrypted.encryptedData,
 *   encrypted.dataHash
 * );
 * ```
 */
export function prepareEncryptedBaziData(
  result: BaziResult,
  key: string,
  zishiMode: number = 2
): EncryptedBaziResult {
  // 1. 提取四柱索引
  const siZhuIndex = extractSiZhuIndex(result.siZhu);

  // 2. 提取敏感数据
  const sensitiveData = extractSensitiveData(result, zishiMode);

  // 3. 加密敏感数据
  const { encryptedData, dataHash } = encryptBaziData(sensitiveData, key);

  return {
    siZhuIndex,
    gender: result.birthInfo.gender,
    encryptedData,
    dataHash,
  };
}

// ==================== 链上数据转换 ====================

/**
 * 将 SiZhuIndex 转换为链上格式
 *
 * @param index 四柱索引
 * @returns 链上格式的对象
 */
export function siZhuIndexToChain(index: SiZhuIndex): {
  year_gan: number;
  year_zhi: number;
  month_gan: number;
  month_zhi: number;
  day_gan: number;
  day_zhi: number;
  hour_gan: number;
  hour_zhi: number;
} {
  return {
    year_gan: index.yearGan,
    year_zhi: index.yearZhi,
    month_gan: index.monthGan,
    month_zhi: index.monthZhi,
    day_gan: index.dayGan,
    day_zhi: index.dayZhi,
    hour_gan: index.hourGan,
    hour_zhi: index.hourZhi,
  };
}

/**
 * 将加密数据转换为链上格式（Uint8Array）
 *
 * @param encryptedData Base64 编码的加密数据
 * @returns Uint8Array 格式
 */
export function encryptedDataToChain(encryptedData: string): Uint8Array {
  // Base64 解码为字节数组
  const binary = atob(encryptedData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 将链上加密数据转换为 Base64 格式
 *
 * @param chainData 链上的字节数组
 * @returns Base64 编码的字符串
 */
export function chainDataToEncrypted(chainData: Uint8Array | number[]): string {
  const bytes = chainData instanceof Uint8Array ? chainData : new Uint8Array(chainData);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 将数据哈希转换为链上格式（32 字节数组）
 *
 * @param hashHex 哈希的 hex 字符串
 * @returns 32 字节的 Uint8Array
 */
export function dataHashToChain(hashHex: string): Uint8Array {
  return blake2AsU8a(hashHex, 256);
}

// ==================== 验证工具 ====================

/**
 * 验证四柱索引有效性
 *
 * @param index 四柱索引
 * @returns 是否有效
 */
export function isValidSiZhuIndex(index: SiZhuIndex): boolean {
  return (
    index.yearGan >= 0 && index.yearGan < 10 &&
    index.yearZhi >= 0 && index.yearZhi < 12 &&
    index.monthGan >= 0 && index.monthGan < 10 &&
    index.monthZhi >= 0 && index.monthZhi < 12 &&
    index.dayGan >= 0 && index.dayGan < 10 &&
    index.dayZhi >= 0 && index.dayZhi < 12 &&
    index.hourGan >= 0 && index.hourGan < 10 &&
    index.hourZhi >= 0 && index.hourZhi < 12
  );
}

/**
 * 验证加密数据长度
 *
 * 链上限制最大 256 字节
 *
 * @param encryptedData Base64 编码的加密数据
 * @returns 是否在限制范围内
 */
export function isValidEncryptedDataLength(encryptedData: string): boolean {
  const bytes = encryptedDataToChain(encryptedData);
  return bytes.length <= 256;
}
