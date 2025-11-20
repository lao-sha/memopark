/**
 * 委员会共享密钥 + 门限加密工具类
 * 
 * 实现方案A：委员会动态成员解密权限方案
 * - 使用门限加密（Shamir秘密共享）
 * - 委员会共享密钥分割为N份，任意K份可恢复
 * - 做市商加密数据给"委员会"角色，而不是单个成员
 * - 委员会成员变更时无需重新加密历史数据
 * 
 * @author Memopark Team
 * @date 2025-10-23
 */

import { ApiPromise } from '@polkadot/api';
import { encodeAddress } from '@polkadot/util-crypto';
import { u8aToHex, hexToU8a, stringToU8a } from '@polkadot/util';
import nacl from 'tweetnacl';
// @ts-ignore
import secrets from 'secrets.js-grempe';

/**
 * 委员会加密数据格式（IPFS存储）
 * 使用门限加密方案，委员会成员可以联合解密
 */
export interface CommitteeEncryptedData {
  version: string;
  encrypted_content: string;  // Base64编码的AES加密内容
  nonce: string;  // AES-GCM nonce (24字节)
  encrypted_keys: {
    owner: string;  // 用做市商自己公钥加密的AES密钥
    committee: string;  // 用委员会共享公钥加密的AES密钥
  };
  metadata: {
    content_type: string;
    original_size: number;
    encrypted_at: number;
    encryptor: string;  // 加密者账户ID
  };
}

/**
 * 委员会加密工具类
 */
export class CommitteeEncryption {
  /**
   * 生成委员会共享密钥并分割为分片
   * 
   * @param totalShares - 总分片数量（委员会成员数量）
   * @param threshold - 门限值（需要多少个分片才能恢复，建议 2/3 * totalShares）
   * @returns 共享密钥和分片列表
   */
  static generateCommitteeSharedKey(
    totalShares: number = 5,
    threshold: number = 3
  ): {
    sharedKey: Uint8Array;
    shares: string[];
  } {
    // 1. 生成32字节随机共享密钥（AES-256）
    const sharedKey = nacl.randomBytes(32);
    
    // 2. 使用Shamir秘密共享分割密钥
    //    将32字节密钥转换为十六进制字符串
    const sharedKeyHex = Buffer.from(sharedKey).toString('hex');
    
    // 3. 分割为N份，任意K份可恢复
    const shares = secrets.share(sharedKeyHex, totalShares, threshold);
    
    console.log('✅ 委员会共享密钥已生成并分割');
    console.log(`   - 总分片数：${totalShares}`);
    console.log(`   - 门限值：${threshold}`);
    console.log(`   - 任意 ${threshold} 个分片可恢复共享密钥`);
    
    return {
      sharedKey,
      shares,
    };
  }

  /**
   * 组合分片恢复共享密钥
   * 
   * @param shares - 至少K个分片（十六进制字符串）
   * @returns 恢复的共享密钥
   */
  static combineKeyShares(shares: string[]): Uint8Array {
    // 使用Shamir秘密共享组合分片
    const recoveredHex = secrets.combine(shares);
    
    // 转换回Uint8Array
    const recoveredKey = new Uint8Array(Buffer.from(recoveredHex, 'hex'));
    
    console.log('✅ 共享密钥已从分片恢复');
    
    return recoveredKey;
  }

  /**
   * 为委员会成员加密密钥分片
   * 
   * @param share - 密钥分片（十六进制字符串）
   * @param memberPublicKey - 委员会成员的公钥
   * @returns 加密后的分片
   */
  static encryptShareForMember(
    share: string,
    memberPublicKey: Uint8Array
  ): Uint8Array {
    const shareBytes = new Uint8Array(Buffer.from(share, 'hex'));
    
    // 生成临时密钥对用于加密
    const ephemeralKeyPair = nacl.box.keyPair();
    const nonce = nacl.randomBytes(24);
    
    // 使用成员公钥加密分片
    const encryptedShare = nacl.box(
      shareBytes,
      nonce,
      memberPublicKey,
      ephemeralKeyPair.secretKey
    );
    
    if (!encryptedShare) {
      throw new Error('加密分片失败');
    }
    
    // 组合：nonce + ephemeral公钥 + 加密内容
    const result = new Uint8Array(
      nonce.length + ephemeralKeyPair.publicKey.length + encryptedShare.length
    );
    result.set(nonce, 0);
    result.set(ephemeralKeyPair.publicKey, nonce.length);
    result.set(encryptedShare, nonce.length + ephemeralKeyPair.publicKey.length);
    
    return result;
  }

  /**
   * 用私钥解密密钥分片
   * 
   * @param encryptedShare - 加密的分片
   * @param memberPrivateKey - 委员会成员的私钥
   * @returns 解密后的分片（十六进制字符串）
   */
  static decryptShareWithPrivateKey(
    encryptedShare: Uint8Array,
    memberPrivateKey: Uint8Array
  ): string {
    // 解析：nonce + ephemeral公钥 + 加密内容
    const nonce = encryptedShare.slice(0, 24);
    const ephemeralPublicKey = encryptedShare.slice(24, 56);
    const ciphertext = encryptedShare.slice(56);
    
    // 使用私钥解密
    const decryptedBytes = nacl.box.open(
      ciphertext,
      nonce,
      ephemeralPublicKey,
      memberPrivateKey
    );
    
    if (!decryptedBytes) {
      throw new Error('解密分片失败：密钥不正确');
    }
    
    // 转换为十六进制字符串
    return Buffer.from(decryptedBytes).toString('hex');
  }

  /**
   * 加密敏感数据给委员会
   * 
   * @param data - 原始敏感数据（对象或字符串）
   * @param ownerPublicKey - 做市商自己的公钥
   * @param committeePublicKey - 委员会共享公钥（从分片恢复或预先存储）
   * @param encryptorAccount - 加密者账户地址
   * @returns IPFS上传的数据结构
   */
  static async encryptForCommittee(
    data: any,
    ownerPublicKey: Uint8Array,
    committeePublicKey: Uint8Array,
    encryptorAccount: string
  ): Promise<CommitteeEncryptedData> {
    // 1. 生成随机AES密钥
    const aesKey = nacl.randomBytes(32);
    
    // 2. 序列化数据
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBytes = stringToU8a(dataStr);
    
    // 3. 使用AES密钥加密数据（使用NaCl的secretbox，相当于AES-256）
    const nonce = nacl.randomBytes(24);
    const encryptedContent = nacl.secretbox(dataBytes, nonce, aesKey);
    
    if (!encryptedContent) {
      throw new Error('加密内容失败');
    }
    
    // 4. 为做市商自己加密AES密钥
    const ownerEncryptedKey = CommitteeEncryption.encryptAesKeyForUser(
      aesKey,
      ownerPublicKey
    );
    
    // 5. 为委员会加密AES密钥
    const committeeEncryptedKey = CommitteeEncryption.encryptAesKeyForUser(
      aesKey,
      committeePublicKey
    );
    
    // 6. 构造返回数据
    return {
      version: '2.0',  // 版本2.0支持委员会共享密钥
      encrypted_content: Buffer.from(encryptedContent).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
      encrypted_keys: {
        owner: Buffer.from(ownerEncryptedKey).toString('base64'),
        committee: Buffer.from(committeeEncryptedKey).toString('base64'),
      },
      metadata: {
        content_type: 'application/json',
        original_size: dataBytes.length,
        encrypted_at: Math.floor(Date.now() / 1000),
        encryptor: encryptorAccount,
      },
    };
  }

  /**
   * 为用户加密AES密钥
   */
  private static encryptAesKeyForUser(
    aesKey: Uint8Array,
    userPublicKey: Uint8Array
  ): Uint8Array {
    const ephemeralKeyPair = nacl.box.keyPair();
    const nonce = nacl.randomBytes(24);
    
    const encrypted = nacl.box(
      aesKey,
      nonce,
      userPublicKey,
      ephemeralKeyPair.secretKey
    );
    
    if (!encrypted) {
      throw new Error('加密AES密钥失败');
    }
    
    // 组合：nonce + ephemeral公钥 + 加密内容
    const result = new Uint8Array(
      nonce.length + ephemeralKeyPair.publicKey.length + encrypted.length
    );
    result.set(nonce, 0);
    result.set(ephemeralKeyPair.publicKey, nonce.length);
    result.set(encrypted, nonce.length + ephemeralKeyPair.publicKey.length);
    
    return result;
  }

  /**
   * 解密敏感数据（做市商自己或委员会成员）
   * 
   * @param encryptedData - 从IPFS下载的加密数据
   * @param userPrivateKey - 用户的私钥
   * @param isCommittee - 是否为委员会成员（影响使用哪个加密密钥）
   * @returns 解密后的原始数据
   */
  static async decryptSensitiveData(
    encryptedData: CommitteeEncryptedData,
    userPrivateKey: Uint8Array,
    isCommittee: boolean = false
  ): Promise<any> {
    // 1. 选择对应的加密密钥
    const encryptedAesKeyStr = isCommittee 
      ? encryptedData.encrypted_keys.committee
      : encryptedData.encrypted_keys.owner;
    
    const encryptedAesKey = Buffer.from(encryptedAesKeyStr, 'base64');
    
    // 2. 解密AES密钥
    const aesKey = CommitteeEncryption.decryptAesKeyWithPrivateKey(
      encryptedAesKey,
      userPrivateKey
    );
    
    // 3. 解密内容
    const encryptedContent = Buffer.from(
      encryptedData.encrypted_content,
      'base64'
    );
    const nonce = Buffer.from(encryptedData.nonce, 'base64');
    
    const decryptedBytes = nacl.secretbox.open(
      encryptedContent,
      nonce,
      aesKey
    );
    
    if (!decryptedBytes) {
      throw new Error('解密内容失败：密钥不正确或数据已损坏');
    }
    
    // 4. 反序列化
    const decryptedStr = Buffer.from(decryptedBytes).toString('utf8');
    
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  }

  /**
   * 用私钥解密AES密钥
   */
  private static decryptAesKeyWithPrivateKey(
    encryptedAesKey: Uint8Array,
    userPrivateKey: Uint8Array
  ): Uint8Array {
    // 解析：nonce + ephemeral公钥 + 加密内容
    const nonce = encryptedAesKey.slice(0, 24);
    const ephemeralPublicKey = encryptedAesKey.slice(24, 56);
    const ciphertext = encryptedAesKey.slice(56);
    
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      ephemeralPublicKey,
      userPrivateKey
    );
    
    if (!decrypted) {
      throw new Error('解密AES密钥失败');
    }
    
    return decrypted;
  }

  /**
   * 委员会成员协作解密
   * 
   * @param encryptedData - 从IPFS下载的加密数据
   * @param myPrivateKey - 我的私钥
   * @param myEncryptedShare - 我的加密密钥分片（从链上获取）
   * @param otherShares - 其他委员会成员的分片（至少K-1个）
   * @returns 解密后的原始数据
   */
  static async committeeCollaborativeDecrypt(
    encryptedData: CommitteeEncryptedData,
    myPrivateKey: Uint8Array,
    myEncryptedShare: Uint8Array,
    otherShares: string[]  // 十六进制字符串数组
  ): Promise<any> {
    // 1. 解密我的分片
    const myShare = CommitteeEncryption.decryptShareWithPrivateKey(
      myEncryptedShare,
      myPrivateKey
    );
    
    console.log('✅ 我的密钥分片已解密');
    
    // 2. 组合所有分片恢复委员会共享密钥
    const allShares = [myShare, ...otherShares];
    const committeeSharedKey = CommitteeEncryption.combineKeyShares(allShares);
    
    console.log('✅ 委员会共享密钥已恢复');
    
    // 3. 解密数据
    const decrypted = await CommitteeEncryption.decryptSensitiveData(
      encryptedData,
      committeeSharedKey,
      true  // 使用委员会密钥
    );
    
    console.log('✅ 数据解密成功');
    
    return decrypted;
  }
}

/**
 * 辅助函数：从链上获取委员会成员的密钥分片
 */
export async function getCommitteeKeyShare(
  api: ApiPromise,
  memberAccount: string
): Promise<Uint8Array | null> {
  // 注意：这个功能可能需要专门的 pallet，暂时保留接口但标记为待实现
  // TODO: 确认密钥分片应该存储在哪个 pallet
  throw new Error('委员会密钥分片功能待实现：需确定正确的存储位置');
  
  // const share = await api.query.maker.committeeKeyShares(memberAccount);
  // 
  // if (share.isNone) {
  //   return null;
  // }
  // 
  // return new Uint8Array(share.unwrap());
}

/**
 * 辅助函数：请求其他委员会成员提供分片
 * 
 * 注意：这需要链下协调机制，实际实现可以通过：
 * 1. WebSocket实时通信
 * 2. pallet-chat发送请求消息
 * 3. 专用的分片交换服务
 */
export async function requestSharesFromOtherMembers(
  api: ApiPromise,
  requiredCount: number,
  myAccount: string
): Promise<string[]> {
  // TODO: 实现实际的分片请求逻辑
  // 这里仅作为示例占位
  
  console.log(`请求 ${requiredCount} 个其他委员会成员的分片...`);
  console.log('⚠️ 需要实现链下协调机制');
  
  // 实际实现时，可能需要：
  // 1. 获取其他委员会成员列表
  // 2. 通过WebSocket或聊天发送请求
  // 3. 等待响应
  // 4. 验证分片有效性
  
  throw new Error('分片请求机制待实现，需要链下协调服务');
}

export default CommitteeEncryption;

