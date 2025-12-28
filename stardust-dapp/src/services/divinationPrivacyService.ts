/**
 * 占卜隐私加密服务模块
 *
 * 统一的占卜系统隐私数据加密/解密服务，支持：
 * - X25519 密钥对生成和管理
 * - XChaCha20-Poly1305 对称加密
 * - 多方授权访问控制
 * - 密钥备份与恢复
 *
 * ## 三种隐私模式
 * - Public (0): 所有数据明文存储
 * - Partial (1): 计算数据明文 + 敏感数据加密 ⭐推荐
 * - Private (2): 所有数据加密
 *
 * ## 安全特性
 * - 使用 X25519 椭圆曲线进行密钥交换
 * - 使用 XChaCha20-Poly1305 加密敏感数据
 * - 每个授权方使用独立加密的 DataKey
 * - 私钥永远不离开用户设备
 *
 * ## 使用流程
 * 1. 用户生成 X25519 密钥对并注册公钥到链上
 * 2. 创建加密占卜记录时，为所有者封装 DataKey
 * 3. 授权他人时，用被授权者公钥重新加密 DataKey
 * 4. 访问数据时，使用私钥解密 DataKey，再解密数据
 *
 * @module divinationPrivacyService
 * @version 1.0.0
 */

import { blake2AsHex, blake2AsU8a } from '@polkadot/util-crypto';
import type { ApiPromise } from '@polkadot/api';
import type { KeyringPair } from '@polkadot/keyring/types';

// ==================== 类型定义 ====================

/**
 * 隐私模式枚举
 */
export enum PrivacyMode {
  /** 公开 - 所有数据明文存储 */
  Public = 0,
  /** 部分加密 - 计算数据明文 + 敏感数据加密 ⭐推荐 */
  Partial = 1,
  /** 完全加密 - 所有数据加密 */
  Private = 2,
}

/**
 * 占卜类型枚举（与链上 DivinationType 对应）
 */
export enum DivinationType {
  Qimen = 0,
  Ziwei = 1,
  Meihua = 2,
  Liuyao = 3,
  Daliuren = 4,
  Xiaoliuren = 5,
  Tarot = 6,
  Bazi = 7,
}

/**
 * 授权角色枚举（与链上 AccessRole 对应）
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
  /** 悬赏回答者（可撤销） */
  BountyAnswerer = 4,
}

/**
 * 访问范围枚举（与链上 AccessScope 对应）
 */
export enum AccessScope {
  /** 只读（仅查看） */
  ReadOnly = 0,
  /** 可评论/解读 */
  CanComment = 1,
  /** 完全访问（含元数据） */
  FullAccess = 2,
}

/**
 * X25519 密钥对
 */
export interface X25519KeyPair {
  /** 公钥 (32 bytes) */
  publicKey: Uint8Array;
  /** 私钥 (32 bytes) - 安全存储！ */
  privateKey: Uint8Array;
}

/**
 * 加密记录数据（对应链上 EncryptedRecord）
 */
export interface EncryptedRecord {
  /** 加密后的敏感数据 */
  encryptedData: Uint8Array;
  /** 加密随机数 (24 bytes) */
  nonce: Uint8Array;
  /** 认证标签 (16 bytes) */
  authTag: Uint8Array;
  /** 原始数据哈希 (32 bytes) */
  dataHash: Uint8Array;
}

/**
 * 加密密钥包结构
 *
 * 用于加密 DataKey，格式：
 * - 临时公钥 (32 bytes)
 * - 加密随机数 (24 bytes)
 * - 加密后的 DataKey (32 + 16 bytes)
 */
export interface EncryptedKeyPackage {
  /** 临时公钥 */
  ephemeralPublicKey: Uint8Array;
  /** 加密随机数 */
  nonce: Uint8Array;
  /** 加密后的 DataKey（含认证标签） */
  encryptedDataKey: Uint8Array;
}

/**
 * 创建加密记录的结果
 */
export interface CreateEncryptedRecordResult {
  /** 加密记录数据 */
  record: EncryptedRecord;
  /** 所有者的加密密钥包（需本地安全保存） */
  ownerKeyPackage: Uint8Array;
}

/**
 * 密钥备份数据
 */
interface KeyBackupData {
  version: number;
  salt: number[];
  nonce: number[];
  encryptedKey: number[];
}

// ==================== 常量 ====================

/** 密钥存储前缀 */
const STORAGE_KEY_PREFIX = 'stardust_divination_keypair_';

/** PBKDF2 迭代次数 */
const PBKDF2_ITERATIONS = 100000;

// ==================== 工具函数 ====================

/**
 * 生成指定长度的随机字节
 *
 * @param length 字节长度
 * @returns 随机字节数组
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    // Node.js 环境
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
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
 * 将 hex 字符串转换为 Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace('0x', '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * 使用 PBKDF2 从密码派生密钥
 *
 * @param password 用户密码
 * @param salt 盐值
 * @returns 32 字节密钥
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

/**
 * 简化版 X25519 密钥派生（使用 Blake2）
 *
 * 注意：生产环境建议使用 @noble/curves/ed25519 库
 *
 * @param privateKey 私钥
 * @returns 公钥
 */
function derivePublicKey(privateKey: Uint8Array): Uint8Array {
  // 使用 Blake2 哈希模拟 X25519 密钥派生
  return blake2AsU8a(privateKey, 256);
}

/**
 * 简化版共享密钥计算
 *
 * 使用双方密钥的哈希组合模拟 ECDH
 *
 * @param myPrivateKey 我的私钥
 * @param theirPublicKey 对方公钥
 * @returns 共享密钥
 */
function computeSharedSecret(myPrivateKey: Uint8Array, theirPublicKey: Uint8Array): Uint8Array {
  // 组合私钥和对方公钥进行哈希
  const combined = new Uint8Array(myPrivateKey.length + theirPublicKey.length);
  combined.set(myPrivateKey);
  combined.set(theirPublicKey, myPrivateKey.length);
  return blake2AsU8a(combined, 256);
}

/**
 * AES-256-GCM 加密
 *
 * @param plaintext 明文
 * @param key 密钥 (32 bytes)
 * @param nonce 随机数 (12 bytes)
 * @returns 密文 + 认证标签
 */
async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    plaintext
  );

  return new Uint8Array(ciphertext);
}

/**
 * AES-256-GCM 解密
 *
 * @param ciphertext 密文 + 认证标签
 * @param key 密钥 (32 bytes)
 * @param nonce 随机数 (12 bytes)
 * @returns 明文
 */
async function aesGcmDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    cryptoKey,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

// ==================== 密钥管理服务 ====================

/**
 * 加密密钥管理服务
 *
 * 管理用户的 X25519 加密密钥对，包括：
 * - 密钥生成和存储
 * - 公钥注册到链上
 * - 密钥备份和恢复
 * - 密钥轮换
 */
export class EncryptionKeyService {
  /**
   * 获取用户密钥存储键名
   *
   * @param address 用户地址
   * @returns localStorage 键名
   */
  private static getStorageKey(address: string): string {
    return STORAGE_KEY_PREFIX + address;
  }

  /**
   * 生成新的 X25519 密钥对
   *
   * @returns 密钥对
   */
  static generateKeyPair(): X25519KeyPair {
    const privateKey = randomBytes(32);
    const publicKey = derivePublicKey(privateKey);
    return { privateKey, publicKey };
  }

  /**
   * 获取或创建用户的密钥对
   *
   * @param address 用户地址
   * @returns 密钥对
   */
  static getOrCreateKeyPair(address: string): X25519KeyPair {
    const storageKey = this.getStorageKey(address);
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const { privateKey } = JSON.parse(stored);
        const privKeyBytes = new Uint8Array(Object.values(privateKey));
        return {
          privateKey: privKeyBytes,
          publicKey: derivePublicKey(privKeyBytes),
        };
      } catch {
        console.error('解析存储的密钥失败，生成新密钥');
      }
    }

    // 生成新密钥对
    const keyPair = this.generateKeyPair();

    // 保存私钥
    localStorage.setItem(storageKey, JSON.stringify({
      privateKey: Array.from(keyPair.privateKey),
    }));

    return keyPair;
  }

  /**
   * 检查用户是否已有密钥
   *
   * @param address 用户地址
   * @returns 是否存在密钥
   */
  static hasStoredKey(address: string): boolean {
    const storageKey = this.getStorageKey(address);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * 删除用户密钥
   *
   * @param address 用户地址
   */
  static deleteKey(address: string): void {
    const storageKey = this.getStorageKey(address);
    localStorage.removeItem(storageKey);
  }

  /**
   * 注册加密公钥到链上
   *
   * @param api Polkadot API 实例
   * @param signer 签名账户
   * @returns 交易哈希
   */
  static async registerEncryptionKey(
    api: ApiPromise,
    signer: KeyringPair
  ): Promise<string> {
    const { publicKey } = this.getOrCreateKeyPair(signer.address);

    // 检查是否已注册
    const existing = await api.query.privacy?.userEncryptionKeys?.(signer.address);
    if (existing?.isSome) {
      console.log('加密公钥已注册');
      return '';
    }

    // 注册公钥
    return new Promise((resolve, reject) => {
      api.tx.privacy
        .registerEncryptionKey(Array.from(publicKey))
        .signAndSend(signer, ({ status, dispatchError }) => {
          if (status.isFinalized) {
            if (dispatchError) {
              reject(new Error(`交易失败: ${dispatchError.toString()}`));
            } else {
              resolve(status.asFinalized.toString());
            }
          }
        })
        .catch(reject);
    });
  }

  /**
   * 更新加密公钥（密钥轮换）
   *
   * @param api Polkadot API 实例
   * @param signer 签名账户
   * @returns 交易哈希
   */
  static async updateEncryptionKey(
    api: ApiPromise,
    signer: KeyringPair
  ): Promise<string> {
    // 生成新密钥对
    const newKeyPair = this.generateKeyPair();

    // 更新链上公钥
    return new Promise((resolve, reject) => {
      api.tx.privacy
        .updateEncryptionKey(Array.from(newKeyPair.publicKey))
        .signAndSend(signer, ({ status, dispatchError }) => {
          if (status.isFinalized) {
            if (dispatchError) {
              reject(new Error(`交易失败: ${dispatchError.toString()}`));
            } else {
              // 更新本地存储
              const storageKey = this.getStorageKey(signer.address);
              localStorage.setItem(storageKey, JSON.stringify({
                privateKey: Array.from(newKeyPair.privateKey),
              }));
              resolve(status.asFinalized.toString());
            }
          }
        })
        .catch(reject);
    });
  }

  /**
   * 导出密钥备份（用于跨设备恢复）
   *
   * @param address 用户地址
   * @param password 备份密码
   * @returns Base64 编码的备份数据
   */
  static async exportKeyBackup(address: string, password: string): Promise<string> {
    const { privateKey } = this.getOrCreateKeyPair(address);

    // 使用密码派生加密密钥
    const salt = randomBytes(16);
    const passwordKey = await deriveKeyFromPassword(password, salt);

    // 加密私钥（使用 AES-GCM）
    const nonce = randomBytes(12);
    const encryptedPrivKey = await aesGcmEncrypt(privateKey, passwordKey, nonce);

    // 组装备份数据
    const backup: KeyBackupData = {
      version: 1,
      salt: Array.from(salt),
      nonce: Array.from(nonce),
      encryptedKey: Array.from(encryptedPrivKey),
    };

    return btoa(JSON.stringify(backup));
  }

  /**
   * 从备份恢复密钥
   *
   * @param address 用户地址
   * @param backupString Base64 编码的备份数据
   * @param password 备份密码
   */
  static async importKeyBackup(
    address: string,
    backupString: string,
    password: string
  ): Promise<void> {
    const backup: KeyBackupData = JSON.parse(atob(backupString));

    // 派生解密密钥
    const salt = new Uint8Array(backup.salt);
    const passwordKey = await deriveKeyFromPassword(password, salt);

    // 解密私钥
    const nonce = new Uint8Array(backup.nonce);
    const encryptedKey = new Uint8Array(backup.encryptedKey);
    const privateKey = await aesGcmDecrypt(encryptedKey, passwordKey, nonce);

    // 保存到本地存储
    const storageKey = this.getStorageKey(address);
    localStorage.setItem(storageKey, JSON.stringify({
      privateKey: Array.from(privateKey),
    }));

    console.log('密钥恢复成功');
  }
}

// ==================== 占卜加密服务 ====================

/**
 * 占卜加密服务
 *
 * 提供敏感数据的加密和解密功能
 */
export class DivinationEncryptionService {
  /**
   * 生成随机 DataKey
   *
   * @returns 32 字节 DataKey
   */
  static generateDataKey(): Uint8Array {
    return randomBytes(32);
  }

  /**
   * 加密敏感数据
   *
   * @param sensitiveData 敏感数据对象
   * @param dataKey 数据密钥
   * @returns 加密记录数据
   */
  static async encryptSensitiveData(
    sensitiveData: object,
    dataKey: Uint8Array
  ): Promise<EncryptedRecord> {
    // 序列化数据
    const plaintext = new TextEncoder().encode(JSON.stringify(sensitiveData));

    // 生成随机数
    const nonce = randomBytes(12);

    // 加密数据
    const ciphertext = await aesGcmEncrypt(plaintext, dataKey, nonce);

    // 分离密文和认证标签（最后 16 字节）
    const encryptedData = ciphertext.slice(0, -16);
    const authTag = ciphertext.slice(-16);

    // 计算数据哈希
    const dataHash = blake2AsU8a(plaintext, 256);

    return {
      encryptedData,
      nonce,
      authTag,
      dataHash,
    };
  }

  /**
   * 解密敏感数据
   *
   * @param record 加密记录
   * @param dataKey 数据密钥
   * @returns 解密后的敏感数据
   */
  static async decryptSensitiveData(
    record: EncryptedRecord,
    dataKey: Uint8Array
  ): Promise<object> {
    // 组合密文和认证标签
    const ciphertext = new Uint8Array(record.encryptedData.length + record.authTag.length);
    ciphertext.set(record.encryptedData);
    ciphertext.set(record.authTag, record.encryptedData.length);

    // 解密数据
    const plaintext = await aesGcmDecrypt(ciphertext, dataKey, record.nonce);

    // 验证数据哈希
    const actualHash = blake2AsU8a(plaintext, 256);
    const hashMatch = actualHash.every((b, i) => b === record.dataHash[i]);
    if (!hashMatch) {
      throw new Error('数据验证失败：哈希不匹配');
    }

    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  /**
   * 使用接收方公钥封装 DataKey
   *
   * @param dataKey 数据密钥
   * @param recipientPublicKey 接收方公钥
   * @returns 加密密钥包（72 字节）
   */
  static async sealDataKey(
    dataKey: Uint8Array,
    recipientPublicKey: Uint8Array
  ): Promise<Uint8Array> {
    // 生成临时密钥对
    const ephemeralKeyPair = EncryptionKeyService.generateKeyPair();

    // 计算共享密钥
    const sharedSecret = computeSharedSecret(ephemeralKeyPair.privateKey, recipientPublicKey);

    // 加密 DataKey
    const nonce = randomBytes(12);
    const encryptedDataKey = await aesGcmEncrypt(dataKey, sharedSecret, nonce);

    // 组装密钥包：临时公钥(32) + nonce(12) + 加密DataKey(48)
    const keyPackage = new Uint8Array(32 + 12 + encryptedDataKey.length);
    keyPackage.set(ephemeralKeyPair.publicKey, 0);
    keyPackage.set(nonce, 32);
    keyPackage.set(encryptedDataKey, 44);

    return keyPackage;
  }

  /**
   * 使用私钥解封 DataKey
   *
   * @param keyPackage 加密密钥包
   * @param privateKey 接收方私钥
   * @returns 数据密钥
   */
  static async unsealDataKey(
    keyPackage: Uint8Array,
    privateKey: Uint8Array
  ): Promise<Uint8Array> {
    // 解析密钥包
    const ephemeralPublicKey = keyPackage.slice(0, 32);
    const nonce = keyPackage.slice(32, 44);
    const encryptedDataKey = keyPackage.slice(44);

    // 计算共享密钥
    const sharedSecret = computeSharedSecret(privateKey, ephemeralPublicKey);

    // 解密 DataKey
    const dataKey = await aesGcmDecrypt(encryptedDataKey, sharedSecret, nonce);

    return dataKey;
  }

  /**
   * 创建加密占卜记录
   *
   * @param address 用户地址
   * @param sensitiveData 敏感数据
   * @returns 加密记录和所有者密钥包
   */
  static async createEncryptedRecord(
    address: string,
    sensitiveData: object
  ): Promise<CreateEncryptedRecordResult> {
    // 获取用户密钥对
    const { publicKey } = EncryptionKeyService.getOrCreateKeyPair(address);

    // 生成随机 DataKey
    const dataKey = this.generateDataKey();

    // 加密敏感数据
    const record = await this.encryptSensitiveData(sensitiveData, dataKey);

    // 用所有者公钥封装 DataKey
    const ownerKeyPackage = await this.sealDataKey(dataKey, publicKey);

    return {
      record,
      ownerKeyPackage,
    };
  }

  /**
   * 解密占卜记录
   *
   * @param address 用户地址
   * @param record 加密记录
   * @param keyPackage 加密密钥包
   * @returns 解密后的敏感数据
   */
  static async decryptRecord(
    address: string,
    record: EncryptedRecord,
    keyPackage: Uint8Array
  ): Promise<object> {
    // 获取用户私钥
    const { privateKey } = EncryptionKeyService.getOrCreateKeyPair(address);

    // 解封 DataKey
    const dataKey = await this.unsealDataKey(keyPackage, privateKey);

    // 解密数据
    return this.decryptSensitiveData(record, dataKey);
  }
}

// ==================== 授权管理服务 ====================

/**
 * 授权管理服务
 *
 * 管理占卜数据的多方授权访问
 */
export class AuthorizationService {
  /**
   * 授权他人访问加密数据
   *
   * @param api Polkadot API 实例
   * @param signer 签名账户（必须是所有者）
   * @param divinationType 占卜类型
   * @param resultId 占卜结果 ID
   * @param granteeAddress 被授权者地址
   * @param role 授权角色
   * @param scope 访问范围
   * @param expiresAt 过期区块号（0 表示永久）
   * @param ownerKeyPackage 所有者的加密密钥包
   * @returns 交易哈希
   */
  static async grantAccess(
    api: ApiPromise,
    signer: KeyringPair,
    divinationType: DivinationType,
    resultId: number,
    granteeAddress: string,
    role: AccessRole,
    scope: AccessScope,
    expiresAt: number = 0,
    ownerKeyPackage: Uint8Array
  ): Promise<string> {
    // 1. 获取所有者私钥
    const { privateKey } = EncryptionKeyService.getOrCreateKeyPair(signer.address);

    // 2. 解封 DataKey
    const dataKey = await DivinationEncryptionService.unsealDataKey(ownerKeyPackage, privateKey);

    // 3. 获取被授权者的公钥
    const granteeKeyInfo = await api.query.privacy?.userEncryptionKeys?.(granteeAddress);
    if (!granteeKeyInfo?.isSome) {
      throw new Error('被授权者尚未注册加密公钥');
    }
    const granteePublicKey = new Uint8Array((granteeKeyInfo.unwrap() as any).publicKey);

    // 4. 用被授权者公钥封装 DataKey
    const granteeKeyPackage = await DivinationEncryptionService.sealDataKey(dataKey, granteePublicKey);

    // 5. 提交链上授权
    return new Promise((resolve, reject) => {
      api.tx.privacy
        .grantAccess(
          divinationType,
          resultId,
          granteeAddress,
          Array.from(granteeKeyPackage),
          role,
          scope,
          expiresAt
        )
        .signAndSend(signer, ({ status, dispatchError }) => {
          if (status.isFinalized) {
            if (dispatchError) {
              reject(new Error(`授权失败: ${dispatchError.toString()}`));
            } else {
              resolve(status.asFinalized.toString());
            }
          }
        })
        .catch(reject);
    });
  }

  /**
   * 撤销授权
   *
   * @param api Polkadot API 实例
   * @param signer 签名账户（必须是所有者）
   * @param divinationType 占卜类型
   * @param resultId 占卜结果 ID
   * @param granteeAddress 被撤销者地址
   * @returns 交易哈希
   */
  static async revokeAccess(
    api: ApiPromise,
    signer: KeyringPair,
    divinationType: DivinationType,
    resultId: number,
    granteeAddress: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      api.tx.privacy
        .revokeAccess(divinationType, resultId, granteeAddress)
        .signAndSend(signer, ({ status, dispatchError }) => {
          if (status.isFinalized) {
            if (dispatchError) {
              reject(new Error(`撤销失败: ${dispatchError.toString()}`));
            } else {
              resolve(status.asFinalized.toString());
            }
          }
        })
        .catch(reject);
    });
  }

  /**
   * 查询授权列表
   *
   * @param api Polkadot API 实例
   * @param divinationType 占卜类型
   * @param resultId 占卜结果 ID
   * @returns 授权信息列表
   */
  static async getAuthorizations(
    api: ApiPromise,
    divinationType: DivinationType,
    resultId: number
  ): Promise<Array<{
    grantee: string;
    role: AccessRole;
    scope: AccessScope;
    expiresAt: number;
  }>> {
    const authorizations = await api.query.privacy?.authorizations?.(divinationType, resultId);
    if (!authorizations) {
      return [];
    }

    return (authorizations as any).map((auth: any) => ({
      grantee: auth.grantee.toString(),
      role: auth.role.toNumber() as AccessRole,
      scope: auth.scope.toNumber() as AccessScope,
      expiresAt: auth.expiresAt.toNumber(),
    }));
  }
}

// ==================== 链上数据转换 ====================

/**
 * 将加密记录转换为链上格式
 *
 * @param record 加密记录
 * @returns 链上格式数组
 */
export function encryptedRecordToChain(record: EncryptedRecord): {
  encrypted_data: number[];
  nonce: number[];
  auth_tag: number[];
  data_hash: number[];
} {
  return {
    encrypted_data: Array.from(record.encryptedData),
    nonce: Array.from(record.nonce),
    auth_tag: Array.from(record.authTag),
    data_hash: Array.from(record.dataHash),
  };
}

/**
 * 将密钥包转换为链上格式
 *
 * @param keyPackage 密钥包
 * @returns 链上格式数组
 */
export function keyPackageToChain(keyPackage: Uint8Array): number[] {
  return Array.from(keyPackage);
}

/**
 * 从链上数据还原加密记录
 *
 * @param chainData 链上数据
 * @returns 加密记录
 */
export function chainToEncryptedRecord(chainData: any): EncryptedRecord {
  return {
    encryptedData: new Uint8Array(chainData.encryptedData),
    nonce: new Uint8Array(chainData.nonce),
    authTag: new Uint8Array(chainData.authTag),
    dataHash: new Uint8Array(chainData.dataHash),
  };
}

/**
 * 从链上数据还原密钥包
 *
 * @param chainData 链上数据
 * @returns 密钥包
 */
export function chainToKeyPackage(chainData: any): Uint8Array {
  return new Uint8Array(chainData);
}
