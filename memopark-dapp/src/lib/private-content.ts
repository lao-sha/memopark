/**
 * 前端私密内容加密上传工具
 * 实现"内容加密+密钥包，CID明文"的隐私保护方案
 */

import type { ApiPromise } from '@polkadot/api'
// 函数级中文注释：为满足 TypeScript 的 verbatimModuleSyntax/erasableSyntaxOnly 约束，
// 将仅类型的导入改为 type-only import，避免编译器错误。
import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex, hexToU8a } from '@polkadot/util'
import { uploadToIpfs } from './ipfs'

// 支持的加密方法
// 函数级中文注释：为兼容 TypeScript `erasableSyntaxOnly`，将 enum 改为 const 对象。
export const EncryptionMethod = {
  AES_256_GCM: 1,
  CHACHA20_POLY1305: 2,
} as const
export type EncryptionMethod = typeof EncryptionMethod[keyof typeof EncryptionMethod]

// 访问策略类型
export interface AccessPolicy {
  type: 'OwnerOnly' | 'SharedWith' | 'FamilyMembers' | 'TimeboxedAccess' | 'GovernanceControlled'
  params?: any
}

/**
 * 私密内容加密上传器
 */
export class PrivateContentUploader {
  // 函数级中文注释：显式声明字段，避免参数属性在 `erasableSyntaxOnly` 下报错。
  private api: ApiPromise
  private keyring: KeyringPair
  // 函数级中文注释：标准构造函数体内赋值，兼容严格 TS 设置。
  constructor(api: ApiPromise, keyring: KeyringPair) {
    this.api = api
    this.keyring = keyring
  }
  /**
   * 上传加密的私密内容
   */
  async uploadPrivateContent(
    file: File,
    ns: string, // 8字节命名空间
    subjectId: number,
    authorizedUsers: string[], // 授权用户账户地址
    accessPolicy: AccessPolicy
  ): Promise<{ contentId: number; cid: string; txHash: string }> {
    // 1. 生成随机AES密钥
    const aesKey = crypto.getRandomValues(new Uint8Array(32))
    
    // 2. 加密文件内容
    const { encryptedData, contentHash } = await this.encryptFile(file, aesKey)
    
    // 3. 上传加密内容到IPFS (CID明文存储)
    const encryptedFile = new File([encryptedData], `${file.name}.enc`, { 
      type: 'application/octet-stream' 
    })
    const cid = await uploadToIpfs(encryptedFile)
    
    // 4. 为每个授权用户加密AES密钥
    const encryptedKeys: Array<[string, Uint8Array]> = []
    
    // 先为自己加密密钥
    const ownPublicKey = await this.getUserPublicKey(this.keyring.address)
    if (ownPublicKey) {
      const ownEncryptedKey = await this.encryptKeyForUser(aesKey, ownPublicKey)
      encryptedKeys.push([this.keyring.address, ownEncryptedKey])
    }
    
    // 为其他用户加密密钥
    for (const userAddress of authorizedUsers) {
      if (userAddress === this.keyring.address) continue // 跳过自己
      
      const publicKey = await this.getUserPublicKey(userAddress)
      if (publicKey) {
        const encryptedKey = await this.encryptKeyForUser(aesKey, publicKey)
        encryptedKeys.push([userAddress, encryptedKey])
      }
    }
    
    // 5. 调用链上存储
    const nsBytes = this.stringToNsBytes(ns)
    const tx = this.api.tx.evidence.storePrivateContent(
      nsBytes,
      subjectId,
      Array.from(new TextEncoder().encode(cid)), // CID明文
      u8aToHex(contentHash),
      EncryptionMethod.AES_256_GCM,
      this.convertAccessPolicy(accessPolicy),
      encryptedKeys.map(([addr, key]) => [addr, Array.from(key)])
    )
    
    const txHash = await new Promise<string>((resolve, reject) => {
      tx.signAndSend(this.keyring, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          reject(new Error(`Transaction failed: ${dispatchError.toString()}`))
        } else if (status.isInBlock) {
          // 从事件中提取content_id
          const event = events.find(({ event }) => 
            event.section === 'evidence' && event.method === 'PrivateContentStored'
          )
          if (event) {
            const contentId = (event.event.data as any).content_id?.toNumber() || 0
            resolve(status.asInBlock.toString())
          } else {
            reject(new Error('PrivateContentStored event not found'))
          }
        }
      })
    })
    
    // TODO: 从事件中提取真实的content_id
    const contentId = 0 // 占位符
    
    return { contentId, cid, txHash }
  }

  /**
   * 下载并解密私密内容
   */
  async downloadPrivateContent(contentId: number): Promise<Blob> {
    // 1. 从链上获取加密信息
    const content = (await this.api.query.evidence.privateContents(contentId)) as any
    if (!content?.isSome) {
      throw new Error('Private content not found')
    }
    
    // 函数级中文注释：Polkadot.js 的 Option 在类型系统中为 Codec，运行时具有 isSome/unwrap，
    // 在严格类型下使用 any 短期规避，后续可定义精确链上类型。
    const contentData = content.unwrap()
    const cid = new TextDecoder().decode(new Uint8Array(contentData.cid as any))
    
    // 2. 检查访问权限并获取加密密钥
    const myEncryptedKey = (contentData.encrypted_keys as any).find(
      ([user]: [string, Uint8Array]) => user === this.keyring.address
    )
    
    if (!myEncryptedKey) {
      throw new Error('Access denied: no encrypted key found for current user')
    }
    
    // 3. 解密AES密钥
    const aesKey = await this.decryptKeyWithPrivateKey(myEncryptedKey[1])
    
    // 4. 从IPFS下载加密内容
    const response = await fetch(`${this.getIpfsGateway()}/ipfs/${cid}`)
    if (!response.ok) {
      throw new Error('Failed to download encrypted content from IPFS')
    }
    const encryptedData = await response.arrayBuffer()
    
    // 5. 解密内容
    const decryptedData = await this.decryptData(new Uint8Array(encryptedData), aesKey)
    
    // 6. 验证内容完整性
    const actualHash = await crypto.subtle.digest('SHA-256', decryptedData)
    const expectedHash = hexToU8a(contentData.content_hash as string)
    
    if (!this.compareHashes(new Uint8Array(actualHash), expectedHash)) {
      throw new Error('Content integrity check failed')
    }
    
    return new Blob([decryptedData])
  }

  /**
   * 授权新用户访问
   */
  async grantAccess(
    contentId: number, 
    userAddress: string, 
    originalKey: Uint8Array
  ): Promise<string> {
    // 获取用户公钥
    const publicKey = await this.getUserPublicKey(userAddress)
    if (!publicKey) {
      throw new Error('User public key not found')
    }
    
    // 为用户加密密钥
    const encryptedKey = await this.encryptKeyForUser(originalKey, publicKey)
    
    // 调用链上接口
    const tx = this.api.tx.evidence.grantAccess(
      contentId,
      userAddress,
      Array.from(encryptedKey)
    )
    
    return new Promise((resolve, reject) => {
      tx.signAndSend(this.keyring, ({ status, dispatchError }) => {
        if (dispatchError) {
          reject(new Error(`Grant access failed: ${dispatchError.toString()}`))
        } else if (status.isInBlock) {
          resolve(status.asInBlock.toString())
        }
      })
    })
  }

  // ===== 私有辅助方法 =====

  /**
   * 加密文件内容
   */
  private async encryptFile(file: File, aesKey: Uint8Array): Promise<{
    encryptedData: Uint8Array,
    contentHash: Uint8Array
  }> {
    const fileData = await file.arrayBuffer()
    const originalData = new Uint8Array(fileData)
    
    // 计算原始内容哈希
    const contentHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', originalData)
    )
    
    // AES-256-GCM 加密
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    )
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      originalData
    )
    
    // 组合 IV + 加密数据
    const encryptedData = new Uint8Array(iv.length + encrypted.byteLength)
    encryptedData.set(iv)
    encryptedData.set(new Uint8Array(encrypted), iv.length)
    
    return { encryptedData, contentHash }
  }

  /**
   * 解密数据
   */
  private async decryptData(encryptedData: Uint8Array, aesKey: Uint8Array): Promise<Uint8Array> {
    // 提取 IV 和密文
    const iv = encryptedData.slice(0, 12)
    const ciphertext = encryptedData.slice(12)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      aesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    )
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    )
    
    return new Uint8Array(decrypted)
  }

  /**
   * 为用户加密AES密钥
   */
  private async encryptKeyForUser(aesKey: Uint8Array, publicKey: CryptoKey): Promise<Uint8Array> {
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKey
    )
    
    return new Uint8Array(encrypted)
  }

  /**
   * 用私钥解密AES密钥
   */
  private async decryptKeyWithPrivateKey(encryptedKey: Uint8Array): Promise<Uint8Array> {
    // 这里需要用户的私钥，通常存储在安全的地方
    // 为了演示，这里使用一个占位符实现
    const privateKey = await this.getUserPrivateKey()
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedKey
    )
    
    return new Uint8Array(decrypted)
  }

  /**
   * 获取用户公钥
   */
  private async getUserPublicKey(userAddress: string): Promise<CryptoKey | null> {
    try {
      const keyInfo = (await this.api.query.evidence.userPublicKeys(userAddress)) as any
      if (!keyInfo?.isSome) return null
      
      const keyData = keyInfo.unwrap()
      const keyBytes = new Uint8Array(keyData.key_data as any)
      
      // 假设是RSA-2048公钥（DER格式）
      return await crypto.subtle.importKey(
        'spki',
        keyBytes,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        false,
        ['encrypt']
      )
    } catch (error) {
      console.error('Failed to get user public key:', error)
      return null
    }
  }

  /**
   * 获取当前用户私钥（占位符实现）
   */
  private async getUserPrivateKey(): Promise<CryptoKey> {
    // 实际实现中，这应该从安全存储（如硬件钱包）中获取
    // 这里仅作演示用途
    throw new Error('Private key access not implemented - use hardware wallet or secure storage')
  }

  /**
   * 字符串转命名空间字节数组
   */
  private stringToNsBytes(ns: string): Uint8Array {
    const bytes = new Uint8Array(8)
    const encoded = new TextEncoder().encode(ns.slice(0, 8))
    bytes.set(encoded)
    return bytes
  }

  /**
   * 转换访问策略格式
   */
  private convertAccessPolicy(policy: AccessPolicy): any {
    switch (policy.type) {
      case 'OwnerOnly':
        return { OwnerOnly: null }
      case 'SharedWith':
        return { SharedWith: policy.params?.users || [] }
      case 'FamilyMembers':
        return { FamilyMembers: policy.params?.deceasedId || 0 }
      case 'TimeboxedAccess':
        return { 
          TimeboxedAccess: {
            users: policy.params?.users || [],
            expires_at: policy.params?.expiresAt || 0
          }
        }
      default:
        return { OwnerOnly: null }
    }
  }

  /**
   * 比较哈希值
   */
  private compareHashes(hash1: Uint8Array, hash2: Uint8Array): boolean {
    if (hash1.length !== hash2.length) return false
    
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) return false
    }
    
    return true
  }

  /**
   * 获取IPFS网关URL
   */
  private getIpfsGateway(): string {
    return (import.meta as any)?.env?.VITE_IPFS_GATEWAY || 'https://ipfs.io'
  }
}

/**
 * 便捷工厂函数
 */
export function createPrivateContentUploader(
  api: ApiPromise, 
  keyring: KeyringPair
): PrivateContentUploader {
  return new PrivateContentUploader(api, keyring)
}

/**
 * 用户密钥对管理工具
 */
export class KeyManager {
  // 函数级中文注释：显式字段与标准构造函数，避免参数属性语法。
  private api: ApiPromise
  private keyring: KeyringPair
  constructor(api: ApiPromise, keyring: KeyringPair) {
    this.api = api
    this.keyring = keyring
  }

  /**
   * 生成并注册用户密钥对
   */
  async generateAndRegisterKeyPair(): Promise<{ publicKey: CryptoKey; txHash: string }> {
    // 生成RSA-2048密钥对
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true, // 可导出
      ['encrypt', 'decrypt']
    )

    // 导出公钥（SPKI格式）
    const publicKeyData = await crypto.subtle.exportKey('spki', keyPair.publicKey)
    
    // 注册到链上
    const tx = this.api.tx.evidence.registerPublicKey(
      Array.from(new Uint8Array(publicKeyData)),
      1 // RSA-2048
    )

    const txHash = await new Promise<string>((resolve, reject) => {
      tx.signAndSend(this.keyring, ({ status, dispatchError }) => {
        if (dispatchError) {
          reject(new Error(`Key registration failed: ${dispatchError.toString()}`))
        } else if (status.isInBlock) {
          resolve(status.asInBlock.toString())
        }
      })
    })

    // 私钥应该安全存储（这里仅作演示）
    // await this.securelyStorePrivateKey(keyPair.privateKey)

    return { publicKey: keyPair.publicKey, txHash }
  }

  /**
   * 安全存储私钥（占位符实现）
   */
  private async securelyStorePrivateKey(privateKey: CryptoKey): Promise<void> {
    // 实际实现应该：
    // 1. 使用用户密码加密私钥
    // 2. 存储到安全的本地存储
    // 3. 或者使用硬件钱包
    console.warn('Private key should be securely stored - implementation needed')
  }
}
