/**
 * 多接收方加密工具类
 * 
 * 使用混合加密方案：AES-256-GCM + X25519
 * 
 * @module multiRecipientEncryption
 * @author Memopark Team
 * @date 2025-10-23
 */

import nacl from 'tweetnacl';
import { u8aToHex, hexToU8a, u8aToString, stringToU8a } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

/**
 * 多接收方加密数据结构
 */
export interface MultiRecipientEncryptedData {
  /** 版本号 */
  version: string;
  
  /** Base64编码的AES-GCM加密内容 */
  encrypted_content: string;
  
  /** AES-GCM nonce (24字节) */
  nonce: string;
  
  /** 为每个接收方加密的AES密钥 */
  encrypted_keys: {
    [accountId: string]: {
      /** Base64编码的加密AES密钥 */
      encrypted_aes_key: string;
      
      /** 加密方法 */
      encryption_method: string;
      
      /** 临时公钥（用于X25519密钥交换） */
      ephemeral_public_key: string;
      
      /** Box nonce（用于nacl.box） */
      box_nonce: string;
    };
  };
  
  /** 元数据 */
  metadata: {
    /** 内容类型 */
    content_type: string;
    
    /** 原始内容大小（字节） */
    original_size: number;
    
    /** 加密时间戳 */
    encrypted_at: number;
    
    /** 加密者账户ID */
    encryptor: string;
    
    /** 可选：内容描述 */
    description?: string;
  };
}

/**
 * 多接收方加密类
 * 
 * ## 核心原理
 * 
 * 1. 生成随机AES密钥（32字节）
 * 2. 使用AES密钥加密消息内容（只加密一次）
 * 3. 为每个接收方用其公钥加密AES密钥
 * 4. 任意接收方用私钥解密AES密钥后即可解密内容
 * 
 * ## 优势
 * 
 * - ✅ 存储优化：内容只加密一次
 * - ✅ 性能好：对称加密速度快
 * - ✅ 可扩展：新增接收方只需加密密钥
 * - ✅ 安全性高：AES-256 + X25519双重保护
 */
export class MultiRecipientEncryption {
  /**
   * 加密数据给多个接收方
   */
  static async encrypt(
    content: any,
    recipientPublicKeys: { [accountId: string]: Uint8Array },
    encryptorAccountId?: string,
    description?: string
  ): Promise<MultiRecipientEncryptedData> {
    // 1. 生成随机AES密钥（32字节，用于XSalsa20-Poly1305）
    const aesKey = nacl.randomBytes(32);
    
    // 2. 生成随机nonce（24字节）
    const nonce = nacl.randomBytes(24);
    
    // 3. 序列化内容
    const contentStr = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);
    const contentBytes = stringToU8a(contentStr);
    
    // 4. 使用XSalsa20-Poly1305加密内容（nacl.secretbox）
    const encryptedContent = nacl.secretbox(
      contentBytes,
      nonce,
      aesKey
    );
    
    // 5. 为每个接收方加密AES密钥
    const encryptedKeys: any = {};
    
    for (const [accountId, publicKey] of Object.entries(recipientPublicKeys)) {
      try {
        // 生成临时密钥对（用于X25519密钥交换）
        const ephemeralKeyPair = nacl.box.keyPair();
        
        // 生成box nonce（24字节）
        const boxNonce = nacl.randomBytes(24);
        
        // 使用接收方公钥加密AES密钥（nacl.box使用X25519 + XSalsa20-Poly1305）
        const encryptedAesKey = nacl.box(
          aesKey,
          boxNonce,
          publicKey,
          ephemeralKeyPair.secretKey
        );
        
        if (!encryptedAesKey) {
          console.error(`加密失败: ${accountId}`);
          continue;
        }
        
        encryptedKeys[accountId] = {
          encrypted_aes_key: this.toBase64(encryptedAesKey),
          encryption_method: 'X25519-XSalsa20-Poly1305',
          ephemeral_public_key: this.toBase64(ephemeralKeyPair.publicKey),
          box_nonce: this.toBase64(boxNonce),
        };
      } catch (error) {
        console.error(`加密AES密钥失败 (${accountId}):`, error);
      }
    }
    
    // 6. 构造返回数据
    return {
      version: '1.0',
      encrypted_content: this.toBase64(encryptedContent),
      nonce: this.toBase64(nonce),
      encrypted_keys: encryptedKeys,
      metadata: {
        content_type: 'application/json',
        original_size: contentBytes.length,
        encrypted_at: Math.floor(Date.now() / 1000),
        encryptor: encryptorAccountId || '',
        description,
      },
    };
  }
  
  /**
   * 解密数据
   */
  static async decrypt(
    encryptedData: MultiRecipientEncryptedData,
    recipientAccountId: string,
    recipientSecretKey: Uint8Array
  ): Promise<any> {
    // 1. 检查是否为授权接收方
    const keyInfo = encryptedData.encrypted_keys[recipientAccountId];
    if (!keyInfo) {
      throw new Error(`当前账户无权解密此内容 (${recipientAccountId})`);
    }
    
    try {
      // 2. 解析加密的AES密钥相关数据
      const encryptedAesKey = this.fromBase64(keyInfo.encrypted_aes_key);
      const ephemeralPublicKey = this.fromBase64(keyInfo.ephemeral_public_key);
      const boxNonce = this.fromBase64(keyInfo.box_nonce);
      
      // 3. 使用私钥解密AES密钥
      const aesKey = nacl.box.open(
        encryptedAesKey,
        boxNonce,
        ephemeralPublicKey,
        recipientSecretKey
      );
      
      if (!aesKey) {
        throw new Error('解密AES密钥失败，可能是私钥不匹配');
      }
      
      // 4. 使用AES密钥解密内容
      const encryptedContent = this.fromBase64(encryptedData.encrypted_content);
      const nonce = this.fromBase64(encryptedData.nonce);
      
      const contentBytes = nacl.secretbox.open(
        encryptedContent,
        nonce,
        aesKey
      );
      
      if (!contentBytes) {
        throw new Error('解密内容失败，内容可能已损坏');
      }
      
      // 5. 反序列化
      const contentStr = u8aToString(contentBytes);
      
      try {
        return JSON.parse(contentStr);
      } catch {
        // 如果不是JSON，返回原始字符串
        return contentStr;
      }
    } catch (error: any) {
      throw new Error(`解密失败: ${error.message}`);
    }
  }
  
  /**
   * 验证加密数据的完整性
   */
  static validate(encryptedData: MultiRecipientEncryptedData): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // 检查版本
    if (encryptedData.version !== '1.0') {
      errors.push(`不支持的版本: ${encryptedData.version}`);
    }
    
    // 检查必需字段
    if (!encryptedData.encrypted_content) {
      errors.push('缺少加密内容');
    }
    
    if (!encryptedData.nonce) {
      errors.push('缺少nonce');
    }
    
    if (!encryptedData.encrypted_keys || Object.keys(encryptedData.encrypted_keys).length === 0) {
      errors.push('缺少接收方密钥');
    }
    
    // 检查每个接收方的密钥信息
    for (const [accountId, keyInfo] of Object.entries(encryptedData.encrypted_keys || {})) {
      if (!keyInfo.encrypted_aes_key) {
        errors.push(`接收方 ${accountId} 缺少加密密钥`);
      }
      if (!keyInfo.ephemeral_public_key) {
        errors.push(`接收方 ${accountId} 缺少临时公钥`);
      }
      if (!keyInfo.box_nonce) {
        errors.push(`接收方 ${accountId} 缺少box nonce`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * 获取授权的接收方列表
   */
  static getRecipients(encryptedData: MultiRecipientEncryptedData): string[] {
    return Object.keys(encryptedData.encrypted_keys || {});
  }
  
  /**
   * 检查特定账户是否为授权接收方
   */
  static isAuthorized(encryptedData: MultiRecipientEncryptedData, accountId: string): boolean {
    return accountId in (encryptedData.encrypted_keys || {});
  }
  
  // ==================== 辅助方法 ====================
  
  /**
   * Uint8Array 转 Base64
   */
  private static toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString('base64');
  }
  
  /**
   * Base64 转 Uint8Array
   */
  private static fromBase64(str: string): Uint8Array {
    return new Uint8Array(Buffer.from(str, 'base64'));
  }
}

/**
 * 导出便捷函数
 */
export const encryptForMultipleRecipients = MultiRecipientEncryption.encrypt;
export const decryptFromMultipleRecipients = MultiRecipientEncryption.decrypt;
export const validateEncryptedData = MultiRecipientEncryption.validate;

