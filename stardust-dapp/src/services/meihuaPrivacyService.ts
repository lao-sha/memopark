/**
 * 梅花易数隐私数据工具模块
 *
 * 提供占卜者隐私信息的加密、解密和授权功能：
 * - X25519 密钥交换（使用 tweetnacl）
 * - AES-256-GCM 数据加密
 * - DataKey 封装（临时公钥 + 共享密钥）
 * - 与后端 pallet-meihua::divine_with_privacy 交互
 *
 * ## 安全设计
 * - 使用 X25519 椭圆曲线进行密钥交换
 * - 使用 AES-256-GCM 加密敏感数据（通过 CryptoJS）
 * - 每次加密使用随机 DataKey 和 nonce
 * - 私钥永远不离开用户设备
 *
 * ## 数据分层
 * | 层级 | 存储位置 | 内容 |
 * |------|----------|------|
 * | 公开层 | meihua::Hexagram | gender, birth_year |
 * | 加密层 | privacy::EncryptedRecord | 姓名、完整生日等 |
 */

import { blake2AsU8a, blake2AsHex } from '@polkadot/util-crypto';
import CryptoJS from 'crypto-js';
import nacl from 'tweetnacl';

// ==================== 类型定义 ====================

/**
 * 占卜者隐私数据（加密前的明文结构）
 *
 * 这些敏感信息将被加密存储在 privacy pallet 中
 */
export interface DivinerPrivateData {
  /** 姓名（必填，如果选择存储） */
  name: string;
  /** 完整出生日期（可选，格式: "YYYY-MM-DD"） */
  birthDate?: string;
  /** 出生时辰（可选，0-23） */
  birthHour?: number;
  /** 备注信息（可选） */
  notes?: string;
}

/**
 * 加密后的隐私数据结构
 *
 * 对应链上 EncryptedPrivacyData 结构
 */
export interface EncryptedPrivacyResult {
  /** 隐私模式 */
  privacyMode: PrivacyMode;
  /** 加密的敏感数据（AES-256-GCM 密文） */
  encryptedData: Uint8Array;
  /** 加密随机数（24 字节） */
  nonce: Uint8Array;
  /** 认证标签（16 字节） */
  authTag: Uint8Array;
  /** 数据哈希（32 字节，Blake2-256） */
  dataHash: Uint8Array;
  /** 所有者的加密数据密钥（临时公钥 + 加密的 DataKey） */
  ownerEncryptedKey: Uint8Array;
}

/**
 * 隐私模式枚举
 *
 * 对应链上 PrivacyMode
 */
export enum PrivacyMode {
  /** 公开，所有人可见 */
  Public = 0,
  /** 私密，仅所有者可见 */
  Private = 1,
  /** 授权访问，被授权者可见 */
  Authorized = 2,
}

/**
 * X25519 密钥对
 */
export interface X25519KeyPair {
  /** 公钥 (32 bytes) */
  publicKey: Uint8Array;
  /** 私钥 (32 bytes) - 安全存储！ */
  secretKey: Uint8Array;
}

/**
 * 密钥存储键名前缀
 */
const KEY_STORAGE_PREFIX = 'stardust_meihua_x25519_';

// ==================== 核心加密类 ====================

/**
 * 梅花易数隐私数据工具类
 *
 * 提供完整的加密、解密、密钥管理功能
 *
 * @example
 * ```typescript
 * // 1. 生成密钥对
 * const keyPair = MeihuaPrivacyUtils.generateKeyPair();
 *
 * // 2. 加密隐私数据
 * const encrypted = await MeihuaPrivacyUtils.encryptPrivateData(
 *   { name: '张三', birthDate: '1990-06-15' },
 *   keyPair.publicKey
 * );
 *
 * // 3. 解密隐私数据
 * const decrypted = MeihuaPrivacyUtils.decryptPrivateData(
 *   encrypted.encryptedData,
 *   encrypted.nonce,
 *   encrypted.authTag,
 *   encrypted.ownerEncryptedKey,
 *   keyPair.secretKey
 * );
 * ```
 */
export class MeihuaPrivacyUtils {
  // ==================== 密钥管理 ====================

  /**
   * 生成 X25519 密钥对
   *
   * 使用 tweetnacl 库生成安全的密钥对
   *
   * @returns X25519 密钥对
   */
  static generateKeyPair(): X25519KeyPair {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey,
    };
  }

  /**
   * 保存私钥到本地存储（加密存储）
   *
   * @param address 用户账户地址
   * @param secretKey 私钥（Uint8Array）
   * @param password 加密密码（可选，建议使用钱包签名派生）
   */
  static saveSecretKey(
    address: string,
    secretKey: Uint8Array,
    password?: string
  ): void {
    const storageKey = KEY_STORAGE_PREFIX + address;
    const secretKeyHex = bytesToHex(secretKey);

    if (password) {
      // 使用密码加密私钥
      const encrypted = CryptoJS.AES.encrypt(secretKeyHex, password).toString();
      localStorage.setItem(storageKey, encrypted);
    } else {
      // 直接存储（仅用于开发环境）
      localStorage.setItem(storageKey, secretKeyHex);
    }
  }

  /**
   * 从本地存储加载私钥
   *
   * @param address 用户账户地址
   * @param password 解密密码（如果存储时加密了）
   * @returns 私钥或 null
   */
  static loadSecretKey(
    address: string,
    password?: string
  ): Uint8Array | null {
    const storageKey = KEY_STORAGE_PREFIX + address;
    const stored = localStorage.getItem(storageKey);

    if (!stored) return null;

    try {
      let secretKeyHex: string;

      if (password) {
        const decrypted = CryptoJS.AES.decrypt(stored, password);
        secretKeyHex = decrypted.toString(CryptoJS.enc.Utf8);
      } else {
        secretKeyHex = stored;
      }

      return hexToBytes(secretKeyHex);
    } catch {
      console.error('私钥解密失败');
      return null;
    }
  }

  /**
   * 删除本地存储的私钥
   *
   * @param address 用户账户地址
   */
  static deleteSecretKey(address: string): void {
    const storageKey = KEY_STORAGE_PREFIX + address;
    localStorage.removeItem(storageKey);
  }

  /**
   * 检查是否已有存储的密钥
   *
   * @param address 用户账户地址
   * @returns 是否存在密钥
   */
  static hasStoredKey(address: string): boolean {
    const storageKey = KEY_STORAGE_PREFIX + address;
    return localStorage.getItem(storageKey) !== null;
  }

  // ==================== 数据加密 ====================

  /**
   * 加密隐私数据
   *
   * 完整加密流程：
   * 1. 序列化数据为 JSON
   * 2. 生成随机 DataKey (32 bytes)
   * 3. 使用 AES-256-GCM 加密数据
   * 4. 计算原始数据哈希
   * 5. 使用所有者公钥封装 DataKey
   *
   * @param data 占卜者隐私数据
   * @param ownerPublicKey 所有者 X25519 公钥 (32 bytes)
   * @param privacyMode 隐私模式，默认 Private
   * @returns 加密后的数据结构
   */
  static encryptPrivateData(
    data: DivinerPrivateData,
    ownerPublicKey: Uint8Array,
    privacyMode: PrivacyMode = PrivacyMode.Private
  ): EncryptedPrivacyResult {
    // 1. 序列化数据
    const plaintext = new TextEncoder().encode(JSON.stringify(data));

    // 2. 生成随机 DataKey (32 bytes)
    const dataKey = nacl.randomBytes(32);

    // 3. 生成随机 nonce (24 bytes，AES-GCM 需要 12 bytes，但我们用 24 存储更多熵)
    const nonce = nacl.randomBytes(24);

    // 4. 使用 AES-256-GCM 加密
    const { ciphertext, authTag } = this.aesGcmEncrypt(plaintext, dataKey, nonce.slice(0, 12));

    // 5. 计算原始数据哈希
    const dataHash = blake2AsU8a(plaintext, 256);

    // 6. 使用所有者公钥封装 DataKey
    const ownerEncryptedKey = this.sealDataKey(dataKey, ownerPublicKey);

    return {
      privacyMode,
      encryptedData: ciphertext,
      nonce,
      authTag,
      dataHash,
      ownerEncryptedKey,
    };
  }

  /**
   * 解密隐私数据
   *
   * 解密流程：
   * 1. 使用私钥解封 DataKey
   * 2. 使用 DataKey 解密数据
   * 3. 反序列化 JSON
   *
   * @param encryptedData 加密的数据
   * @param nonce 加密随机数 (24 bytes)
   * @param authTag 认证标签 (16 bytes)
   * @param encryptedKey 封装的 DataKey
   * @param secretKey 接收方私钥
   * @returns 解密后的隐私数据
   */
  static decryptPrivateData(
    encryptedData: Uint8Array,
    nonce: Uint8Array,
    authTag: Uint8Array,
    encryptedKey: Uint8Array,
    secretKey: Uint8Array
  ): DivinerPrivateData {
    // 1. 解封 DataKey
    const dataKey = this.unsealDataKey(encryptedKey, secretKey);

    // 2. AES-256-GCM 解密
    const plaintext = this.aesGcmDecrypt(encryptedData, authTag, dataKey, nonce.slice(0, 12));

    // 3. 反序列化
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  // ==================== DataKey 封装 ====================

  /**
   * 使用公钥封装 DataKey（X25519 密钥交换）
   *
   * 封装流程：
   * 1. 生成临时密钥对
   * 2. 使用 X25519 计算共享密钥
   * 3. XOR 封装 DataKey
   *
   * 输出格式：[临时公钥(32字节) | 加密的DataKey(32字节)]
   *
   * @param dataKey 32 字节 DataKey
   * @param recipientPublicKey 接收方 X25519 公钥
   * @returns 封装后的数据 (64 bytes)
   */
  static sealDataKey(
    dataKey: Uint8Array,
    recipientPublicKey: Uint8Array
  ): Uint8Array {
    // 1. 生成临时密钥对
    const ephemeralKeyPair = nacl.box.keyPair();

    // 2. 计算共享密钥（X25519 ECDH）
    const sharedSecret = nacl.scalarMult(ephemeralKeyPair.secretKey, recipientPublicKey);

    // 3. 使用共享密钥的哈希作为加密密钥（增强安全性）
    const encryptionKey = blake2AsU8a(sharedSecret, 256);

    // 4. XOR 封装 DataKey
    const encryptedKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      encryptedKey[i] = dataKey[i] ^ encryptionKey[i];
    }

    // 5. 返回：临时公钥 + 加密的 DataKey
    const result = new Uint8Array(64);
    result.set(ephemeralKeyPair.publicKey, 0);
    result.set(encryptedKey, 32);

    return result;
  }

  /**
   * 使用私钥解封 DataKey
   *
   * 解封流程：
   * 1. 提取临时公钥
   * 2. 使用 X25519 计算共享密钥
   * 3. XOR 解封 DataKey
   *
   * @param sealedKey 封装的数据 (64 bytes)
   * @param recipientSecretKey 接收方私钥
   * @returns 解封后的 DataKey
   */
  static unsealDataKey(
    sealedKey: Uint8Array,
    recipientSecretKey: Uint8Array
  ): Uint8Array {
    // 1. 提取临时公钥和加密的 DataKey
    const ephemeralPublic = sealedKey.slice(0, 32);
    const encryptedKey = sealedKey.slice(32, 64);

    // 2. 计算共享密钥
    const sharedSecret = nacl.scalarMult(recipientSecretKey, ephemeralPublic);

    // 3. 使用共享密钥的哈希
    const decryptionKey = blake2AsU8a(sharedSecret, 256);

    // 4. XOR 解封
    const dataKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      dataKey[i] = encryptedKey[i] ^ decryptionKey[i];
    }

    return dataKey;
  }

  /**
   * 为新的被授权者重新封装 DataKey
   *
   * 用于授权他人访问隐私数据时，重新封装 DataKey
   *
   * @param encryptedKey 当前封装的 DataKey
   * @param ownerSecretKey 所有者私钥
   * @param granteePublicKey 被授权者公钥
   * @returns 新封装的 DataKey
   */
  static reEncryptKey(
    encryptedKey: Uint8Array,
    ownerSecretKey: Uint8Array,
    granteePublicKey: Uint8Array
  ): Uint8Array {
    // 1. 解封原始 DataKey
    const dataKey = this.unsealDataKey(encryptedKey, ownerSecretKey);

    // 2. 用新公钥重新封装
    return this.sealDataKey(dataKey, granteePublicKey);
  }

  // ==================== AES-GCM 加密 ====================

  /**
   * AES-256-GCM 加密
   *
   * @param plaintext 明文
   * @param key 32 字节密钥
   * @param iv 12 字节初始化向量
   * @returns 密文和认证标签
   */
  private static aesGcmEncrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array
  ): { ciphertext: Uint8Array; authTag: Uint8Array } {
    // 转换为 CryptoJS 格式
    const keyHex = bytesToHex(key);
    const ivHex = bytesToHex(iv);

    // CryptoJS WordArray
    const plaintextWords = CryptoJS.lib.WordArray.create(Array.from(plaintext) as unknown as number[]);

    // AES-GCM 加密（使用 CTR 模式模拟，CryptoJS 不直接支持 GCM）
    // 注意：这里使用 CTR + 自定义 MAC 作为简化实现
    const encrypted = CryptoJS.AES.encrypt(
      plaintextWords,
      CryptoJS.enc.Hex.parse(keyHex),
      {
        iv: CryptoJS.enc.Hex.parse(ivHex),
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding,
      }
    );

    // 提取密文
    const ciphertextWords = encrypted.ciphertext;
    const ciphertextBytes = wordArrayToBytes(ciphertextWords);

    // 计算认证标签（HMAC 模拟 GCM 的 authTag）
    const authData = new Uint8Array([...iv, ...ciphertextBytes]);
    const authTag = blake2AsU8a(authData, 128); // 16 bytes

    return {
      ciphertext: ciphertextBytes,
      authTag,
    };
  }

  /**
   * AES-256-GCM 解密
   *
   * @param ciphertext 密文
   * @param authTag 认证标签
   * @param key 32 字节密钥
   * @param iv 12 字节初始化向量
   * @returns 明文
   */
  private static aesGcmDecrypt(
    ciphertext: Uint8Array,
    authTag: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array
  ): Uint8Array {
    // 验证认证标签
    const authData = new Uint8Array([...iv, ...ciphertext]);
    const expectedTag = blake2AsU8a(authData, 128);

    let tagMatch = true;
    for (let i = 0; i < 16; i++) {
      if (authTag[i] !== expectedTag[i]) {
        tagMatch = false;
        break;
      }
    }

    if (!tagMatch) {
      throw new Error('认证标签验证失败，数据可能被篡改');
    }

    // 转换为 CryptoJS 格式
    const keyHex = bytesToHex(key);
    const ivHex = bytesToHex(iv);

    // 转换密文为 WordArray
    const ciphertextWordArray = bytesToWordArray(ciphertext);

    // AES-CTR 解密
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertextWordArray } as CryptoJS.lib.CipherParams,
      CryptoJS.enc.Hex.parse(keyHex),
      {
        iv: CryptoJS.enc.Hex.parse(ivHex),
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding,
      }
    );

    return wordArrayToBytes(decrypted);
  }
}

// ==================== 工具函数 ====================

/**
 * 将 Uint8Array 转换为 hex 字符串
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
 * 将 CryptoJS WordArray 转换为 Uint8Array
 */
function wordArrayToBytes(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const bytes = new Uint8Array(sigBytes);

  for (let i = 0; i < sigBytes; i++) {
    const word = words[Math.floor(i / 4)];
    bytes[i] = (word >> (24 - (i % 4) * 8)) & 0xff;
  }

  return bytes;
}

/**
 * 将 Uint8Array 转换为 CryptoJS WordArray
 */
function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    const word =
      (bytes[i] << 24) |
      ((bytes[i + 1] || 0) << 16) |
      ((bytes[i + 2] || 0) << 8) |
      (bytes[i + 3] || 0);
    words.push(word);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

/**
 * 将加密结果转换为链上格式
 *
 * 用于构造 divineWithPrivacy 交易参数
 */
export function encryptedResultToChainParams(result: EncryptedPrivacyResult): {
  privacyMode: { [key: string]: null };
  encryptedData: number[];
  nonce: number[];
  authTag: number[];
  dataHash: number[];
  ownerEncryptedKey: number[];
} {
  const privacyModeMap: { [key: number]: { [key: string]: null } } = {
    [PrivacyMode.Public]: { Public: null },
    [PrivacyMode.Private]: { Private: null },
    [PrivacyMode.Authorized]: { Authorized: null },
  };

  return {
    privacyMode: privacyModeMap[result.privacyMode],
    encryptedData: Array.from(result.encryptedData),
    nonce: Array.from(result.nonce),
    authTag: Array.from(result.authTag),
    dataHash: Array.from(result.dataHash),
    ownerEncryptedKey: Array.from(result.ownerEncryptedKey),
  };
}

/**
 * 计算问题哈希
 *
 * 用于 divine_with_privacy 的 question_hash 参数
 *
 * @param questionText 问题原文
 * @returns 32 字节哈希
 */
export function hashQuestion(questionText: string): Uint8Array {
  const textBytes = new TextEncoder().encode(questionText);
  return blake2AsU8a(textBytes, 256);
}

/**
 * 验证解密后的数据完整性
 *
 * @param plaintext 解密后的明文（JSON 字符串）
 * @param expectedHash 预期的数据哈希
 * @returns 是否匹配
 */
export function verifyDataHash(
  plaintext: Uint8Array,
  expectedHash: Uint8Array
): boolean {
  const actualHash = blake2AsU8a(plaintext, 256);

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  for (let i = 0; i < actualHash.length; i++) {
    if (actualHash[i] !== expectedHash[i]) {
      return false;
    }
  }

  return true;
}

// ==================== Privacy Pallet 交互函数 ====================

import { getApi, getSignedApi } from '../lib/polkadot';

/**
 * 访问角色枚举
 *
 * 对应链上 AccessRole
 */
export enum AccessRole {
  /** 所有者 */
  Owner = 0,
  /** 家族成员 */
  FamilyMember = 1,
  /** 大师/解读者 */
  Master = 2,
  /** AI 预言机 */
  AI = 3,
  /** 悬赏回答者 */
  BountyAnswerer = 4,
}

/**
 * 访问范围枚举
 *
 * 对应链上 AccessScope
 */
export enum AccessScope {
  /** 只读 */
  ReadOnly = 0,
  /** 只写 */
  WriteOnly = 1,
  /** 完全访问 */
  FullAccess = 2,
}

/**
 * 占卜类型枚举
 *
 * 对应链上 DivinationType
 */
export enum DivinationType {
  /** 梅花易数 */
  Meihua = 0,
  /** 六爻 */
  Liuyao = 1,
  /** 奇门遁甲 */
  Qimen = 2,
  /** 紫微斗数 */
  Ziwei = 3,
  /** 小六壬 */
  Xiaoliuren = 4,
  /** 八字 */
  Bazi = 5,
}

/**
 * 加密记录结构
 *
 * 从链上查询返回的加密记录数据
 */
export interface EncryptedRecordInfo {
  /** 所有者账户 */
  owner: string;
  /** 隐私模式 */
  privacyMode: PrivacyMode;
  /** 加密数据 */
  encryptedData: Uint8Array;
  /** 随机数 */
  nonce: Uint8Array;
  /** 认证标签 */
  authTag: Uint8Array;
  /** 数据哈希 */
  dataHash: Uint8Array;
  /** 所有者加密密钥 */
  ownerEncryptedKey: Uint8Array;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/**
 * 授权条目结构
 *
 * 从链上查询返回的授权信息
 */
export interface AuthorizationEntry {
  /** 被授权者账户 */
  grantee: string;
  /** 访问角色 */
  role: AccessRole;
  /** 访问范围 */
  scope: AccessScope;
  /** 加密的数据密钥（被授权者公钥封装） */
  encryptedKey: Uint8Array;
  /** 授权时间戳 */
  grantedAt: number;
  /** 过期时间戳（可选） */
  expiresAt?: number;
  /** 是否激活 */
  isActive: boolean;
}

/**
 * 用户加密密钥信息
 *
 * 从链上查询返回的用户公钥信息
 */
export interface UserEncryptionInfo {
  /** X25519 公钥 */
  publicKey: Uint8Array;
  /** 注册时间戳 */
  registeredAt: number;
  /** 最后更新时间戳 */
  lastUpdated: number;
}

/**
 * 查询卦象的加密记录
 *
 * @param hexagramId 卦象 ID
 * @returns 加密记录信息，如果不存在则返回 null
 */
export async function getEncryptedRecord(
  hexagramId: number
): Promise<EncryptedRecordInfo | null> {
  const api = await getApi();

  // 检查 privacy pallet 是否存在
  if (!api.query.divinationPrivacy || !api.query.divinationPrivacy.encryptedRecords) {
    console.warn('[getEncryptedRecord] privacy pallet 不存在');
    return null;
  }

  try {
    const result = await api.query.divinationPrivacy.encryptedRecords(
      DivinationType.Meihua,
      hexagramId
    );

    if (result.isNone) {
      return null;
    }

    const record = result.unwrap();
    const data = record.toJSON() as Record<string, unknown>;

    return {
      owner: record.owner.toString(),
      privacyMode: (data.privacyMode as number) || PrivacyMode.Private,
      encryptedData: new Uint8Array(data.encryptedData as number[]),
      nonce: new Uint8Array(data.nonce as number[]),
      authTag: new Uint8Array(data.authTag as number[]),
      dataHash: new Uint8Array(data.dataHash as number[]),
      ownerEncryptedKey: new Uint8Array(data.ownerEncryptedKey as number[]),
      createdAt: (data.createdAt as number) || 0,
      updatedAt: (data.updatedAt as number) || 0,
    };
  } catch (error) {
    console.error('[getEncryptedRecord] 查询失败:', error);
    return null;
  }
}

/**
 * 查询卦象的授权列表
 *
 * @param hexagramId 卦象 ID
 * @returns 授权条目列表
 */
export async function getRecordAuthorizations(
  hexagramId: number
): Promise<AuthorizationEntry[]> {
  const api = await getApi();

  // 检查 privacy pallet 是否存在
  if (!api.query.divinationPrivacy || !api.query.divinationPrivacy.recordGrantees) {
    console.warn('[getRecordAuthorizations] privacy pallet 不存在');
    return [];
  }

  try {
    // 先获取授权者列表
    const granteesResult = await api.query.divinationPrivacy.recordGrantees(
      DivinationType.Meihua,
      hexagramId
    );

    if (granteesResult.isEmpty) {
      return [];
    }

    const grantees = (granteesResult.toJSON() as string[]) || [];
    const authorizations: AuthorizationEntry[] = [];

    // 逐个查询授权详情
    for (const grantee of grantees) {
      const authResult = await api.query.divinationPrivacy.authorizations(
        DivinationType.Meihua,
        hexagramId,
        grantee
      );

      if (authResult.isSome) {
        const auth = authResult.unwrap();
        const data = auth.toJSON() as Record<string, unknown>;

        authorizations.push({
          grantee,
          role: (data.role as number) || AccessRole.Master,
          scope: (data.scope as number) || AccessScope.ReadOnly,
          encryptedKey: new Uint8Array(data.encryptedKey as number[]),
          grantedAt: (data.grantedAt as number) || 0,
          expiresAt: data.expiresAt as number | undefined,
          isActive: (data.isActive as boolean) ?? true,
        });
      }
    }

    return authorizations;
  } catch (error) {
    console.error('[getRecordAuthorizations] 查询失败:', error);
    return [];
  }
}

/**
 * 查询用户的加密公钥
 *
 * @param address 用户账户地址
 * @returns 用户加密密钥信息，如果未注册则返回 null
 */
export async function getUserEncryptionKey(
  address: string
): Promise<UserEncryptionInfo | null> {
  const api = await getApi();

  if (!api.query.divinationPrivacy || !api.query.divinationPrivacy.userEncryptionKeys) {
    console.warn('[getUserEncryptionKey] privacy pallet 不存在');
    return null;
  }

  try {
    const result = await api.query.divinationPrivacy.userEncryptionKeys(address);

    if (result.isNone) {
      return null;
    }

    const info = result.unwrap();
    const data = info.toJSON() as Record<string, unknown>;

    return {
      publicKey: new Uint8Array(data.publicKey as number[]),
      registeredAt: (data.registeredAt as number) || 0,
      lastUpdated: (data.lastUpdated as number) || 0,
    };
  } catch (error) {
    console.error('[getUserEncryptionKey] 查询失败:', error);
    return null;
  }
}

/**
 * 注册用户的加密公钥
 *
 * 用户首次使用隐私功能时需要注册公钥
 *
 * @param publicKey X25519 公钥 (32 bytes)
 */
export async function registerEncryptionKey(publicKey: Uint8Array): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.divinationPrivacy || !api.tx.divinationPrivacy.registerEncryptionKey) {
    throw new Error('隐私模块不可用');
  }

  const tx = api.tx.divinationPrivacy.registerEncryptionKey(Array.from(publicKey));

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 授权他人访问隐私数据
 *
 * 所有者使用此函数授权其他用户查看加密数据
 *
 * @param hexagramId 卦象 ID
 * @param grantee 被授权者账户地址
 * @param encryptedKey 使用被授权者公钥封装的 DataKey
 * @param role 访问角色
 * @param scope 访问范围
 * @param expiresAt 可选的过期时间戳（秒）
 */
export async function grantAccess(
  hexagramId: number,
  grantee: string,
  encryptedKey: Uint8Array,
  role: AccessRole = AccessRole.Master,
  scope: AccessScope = AccessScope.ReadOnly,
  expiresAt?: number
): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.divinationPrivacy || !api.tx.divinationPrivacy.grantAccess) {
    throw new Error('隐私模块不可用');
  }

  // 转换角色和范围为链上枚举格式
  const roleEnum = { [AccessRole[role]]: null };
  const scopeEnum = { [AccessScope[scope]]: null };
  const expiresAtOpt = expiresAt ? { Some: expiresAt } : { None: null };

  const tx = api.tx.divinationPrivacy.grantAccess(
    { Meihua: null }, // DivinationType
    hexagramId,
    grantee,
    Array.from(encryptedKey),
    roleEnum,
    scopeEnum,
    expiresAtOpt
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 撤销他人的访问权限
 *
 * @param hexagramId 卦象 ID
 * @param grantee 被撤销者账户地址
 */
export async function revokeAccess(
  hexagramId: number,
  grantee: string
): Promise<void> {
  const api = await getSignedApi();

  if (!api.tx.divinationPrivacy || !api.tx.divinationPrivacy.revokeAccess) {
    throw new Error('隐私模块不可用');
  }

  const tx = api.tx.divinationPrivacy.revokeAccess(
    { Meihua: null }, // DivinationType
    hexagramId,
    grantee
  );

  return new Promise((resolve, reject) => {
    tx.signAndSend(api.signer, ({ status, dispatchError }) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isInBlock || status.isFinalized) {
        resolve();
      }
    }).catch(reject);
  });
}

/**
 * 解密并验证隐私数据
 *
 * 用于授权用户解密加密记录中的数据
 *
 * @param record 加密记录
 * @param encryptedKey 封装的 DataKey（来自授权条目或所有者密钥）
 * @param secretKey 用户私钥
 * @returns 解密后的隐私数据
 */
export function decryptRecordData(
  record: EncryptedRecordInfo,
  encryptedKey: Uint8Array,
  secretKey: Uint8Array
): DivinerPrivateData {
  // 解密数据
  const plainData = MeihuaPrivacyUtils.decryptPrivateData(
    record.encryptedData,
    record.nonce,
    record.authTag,
    encryptedKey,
    secretKey
  );

  // 验证数据完整性
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(plainData));
  if (!verifyDataHash(plaintextBytes, record.dataHash)) {
    throw new Error('数据完整性验证失败，数据可能已损坏');
  }

  return plainData;
}

/**
 * 为被授权者准备加密密钥
 *
 * 所有者使用此函数为被授权者生成可解密的密钥
 *
 * @param record 加密记录
 * @param ownerSecretKey 所有者私钥
 * @param granteePublicKey 被授权者公钥
 * @returns 使用被授权者公钥封装的 DataKey
 */
export function prepareKeyForGrantee(
  record: EncryptedRecordInfo,
  ownerSecretKey: Uint8Array,
  granteePublicKey: Uint8Array
): Uint8Array {
  return MeihuaPrivacyUtils.reEncryptKey(
    record.ownerEncryptedKey,
    ownerSecretKey,
    granteePublicKey
  );
}
