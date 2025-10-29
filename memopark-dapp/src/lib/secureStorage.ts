/**
 * 函数级详细中文注释：简化版安全存储
 * - 临时解决方案，避免crypto-js导入错误
 * - 使用基础编码替代加密，仅用于开发测试
 */

interface StorageItem {
  data: string
  timestamp: number
  expires?: number
}

export class SecureStorage {
  private static readonly STORAGE_PREFIX = 'mp.secure.'
  private static readonly DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24小时

  /**
   * 函数级详细中文注释：简化版密钥生成
   * - 使用基础信息生成简单密钥
   * - 避免复杂加密库依赖
   */
  private static generateSimpleKey(): string {
    const deviceInfo = [
      navigator.userAgent.substring(0, 50),
      navigator.language,
      screen.width + 'x' + screen.height,
    ].join('|')
    
    return btoa(deviceInfo).substring(0, 16)
  }

  /**
   * 函数级详细中文注释：简化版数据编码
   * - 使用Base64编码替代AES加密
   * - 临时方案，生产环境需要真正的加密
   */
  private static simpleEncode(data: string): string {
    return btoa(unescape(encodeURIComponent(data)))
  }

  /**
   * 函数级详细中文注释：简化版数据解码
   */
  private static simpleDecode(encoded: string): string {
    try {
      return decodeURIComponent(escape(atob(encoded)))
    } catch {
      return ''
    }
  }

  /**
   * 函数级详细中文注释：存储数据
   */
  static setItem(key: string, value: any, ttl?: number): boolean {
    try {
      const expires = ttl ? Date.now() + ttl : Date.now() + this.DEFAULT_TTL
      
      const item: StorageItem = {
        data: JSON.stringify(value),
        timestamp: Date.now(),
        expires
      }

      const encoded = this.simpleEncode(JSON.stringify(item))
      localStorage.setItem(this.STORAGE_PREFIX + key, encoded)
      return true
    } catch (error) {
      console.error('安全存储失败:', error)
      return false
    }
  }

  /**
   * 函数级详细中文注释：读取数据
   */
  static getItem<T = any>(key: string): T | null {
    try {
      const encoded = localStorage.getItem(this.STORAGE_PREFIX + key)
      if (!encoded) return null

      const decoded = this.simpleDecode(encoded)
      if (!decoded) {
        this.removeItem(key)
        return null
      }

      const item: StorageItem = JSON.parse(decoded)
      
      // 检查过期
      if (item.expires && Date.now() > item.expires) {
        this.removeItem(key)
        return null
      }

      return JSON.parse(item.data)
    } catch (error) {
      console.error('安全读取失败:', error)
      this.removeItem(key)
      return null
    }
  }

  /**
   * 函数级详细中文注释：删除数据
   */
  static removeItem(key: string): void {
    localStorage.removeItem(this.STORAGE_PREFIX + key)
  }

  /**
   * 函数级详细中文注释：清理所有数据
   */
  static clear(): void {
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith(this.STORAGE_PREFIX)
    )
    keys.forEach(key => localStorage.removeItem(key))
  }

  /**
   * 函数级详细中文注释：清理过期数据
   */
  static cleanup(): void {
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith(this.STORAGE_PREFIX)
    )
    
    keys.forEach(fullKey => {
      const key = fullKey.replace(this.STORAGE_PREFIX, '')
      this.getItem(key) // 会自动检查过期并清理
    })
  }
}

// 定期清理过期数据
setInterval(() => {
  SecureStorage.cleanup()
}, 60 * 60 * 1000) // 每小时清理一次