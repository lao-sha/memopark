/**
 * 函数级详细中文注释：安全存储管理器
 * - 功能：提供加密的本地数据存储，防止敏感信息泄露
 * - 安全：AES加密存储，密钥派生，自动过期清理
 * - 便利：统一的安全存储接口，透明的加密解密操作
 */

import * as CryptoJS from 'crypto-js'

interface StorageItem {
  data: string
  timestamp: number
  expires?: number
}

export class SecureStorage {
  private static readonly STORAGE_PREFIX = 'mp.secure.'
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24小时

  /**
   * 函数级详细中文注释：生成加密密钥
   * - 基于用户设备特征生成固定密钥
   * - 包含浏览器指纹、时间戳等信息
   * - 确保同设备同用户的密钥一致性
   */
  private static generateEncryptionKey(): string {
    const deviceInfo = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      // 避免使用会变化的信息，确保密钥稳定
    ].join('|')
    
    return CryptoJS.SHA256(deviceInfo).toString()
  }

  /**
   * 函数级详细中文注释：安全存储数据
   * - 对敏感数据进行AES加密
   * - 添加时间戳和过期时间
   * - 使用设备特征派生的密钥加密
   */
  static setItem(key: string, value: any, ttl?: number): boolean {
    try {
      const encryptionKey = this.generateEncryptionKey()
      const expires = ttl ? Date.now() + ttl : Date.now() + this.DEFAULT_TTL
      
      const item: StorageItem = {
        data: JSON.stringify(value),
        timestamp: Date.now(),
        expires
      }

      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(item), 
        encryptionKey
      ).toString()

      localStorage.setItem(this.STORAGE_PREFIX + key, encrypted)
      return true
    } catch (error) {
      console.error('安全存储失败:', error)
      return false
    }
  }

  /**
   * 函数级详细中文注释：安全读取数据
   * - 解密存储的数据
   * - 检查过期时间
   * - 自动清理过期数据
   */
  static getItem<T = any>(key: string): T | null {
    try {
      const encrypted = localStorage.getItem(this.STORAGE_PREFIX + key)
      if (!encrypted) return null

      const encryptionKey = this.generateEncryptionKey()
      const decryptedBytes = CryptoJS.AES.decrypt(encrypted, encryptionKey)
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8)
      
      if (!decryptedText) {
        // 解密失败，可能密钥不匹配，清理数据
        this.removeItem(key)
        return null
      }

      const item: StorageItem = JSON.parse(decryptedText)
      
      // 检查过期
      if (item.expires && Date.now() > item.expires) {
        this.removeItem(key)
        return null
      }

      return JSON.parse(item.data)
    } catch (error) {
      console.error('安全读取失败:', error)
      // 数据损坏或解密失败，清理
      this.removeItem(key)
      return null
    }
  }

  /**
   * 函数级详细中文注释：删除安全存储
   * - 清除指定的加密数据
   * - 确保敏感数据完全删除
   */
  static removeItem(key: string): void {
    localStorage.removeItem(this.STORAGE_PREFIX + key)
  }

  /**
   * 函数级详细中文注释：清理所有安全存储
   * - 遍历并删除所有加密存储项
   * - 用于退出登录或安全清理
   */
  static clear(): void {
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith(this.STORAGE_PREFIX)
    )
    keys.forEach(key => localStorage.removeItem(key))
  }

  /**
   * 函数级详细中文注释：清理过期数据
   * - 定期清理过期的加密存储
   * - 释放存储空间，提升性能
   */
  static cleanup(): void {
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith(this.STORAGE_PREFIX)
    )
    
    keys.forEach(fullKey => {
      const key = fullKey.replace(this.STORAGE_PREFIX, '')
      // getItem 会自动检查过期并清理
      this.getItem(key)
    })
  }
}

// 定期清理过期数据
setInterval(() => {
  SecureStorage.cleanup()
}, 60 * 60 * 1000) // 每小时清理一次