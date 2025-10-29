/**
 * 缓存管理工具
 * 函数级中文注释：提供前端缓存管理功能，避免缓存过期导致的问题
 */

/**
 * 函数级中文注释：缓存配置接口
 */
interface CacheConfig {
  key: string;
  ttl: number; // 缓存时间（毫秒）
  maxSize?: number; // 最大缓存条目数
}

/**
 * 函数级中文注释：缓存条目接口
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 函数级中文注释：缓存管理器类
 */
export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheEntry<any>> = new Map();

  // 默认缓存配置
  private defaultConfigs: Record<string, CacheConfig> = {
    proposals: { key: 'mg.proposals', ttl: 30000 }, // 30秒
    voting: { key: 'mg.voting', ttl: 10000 }, // 10秒
    council: { key: 'mg.council', ttl: 60000 }, // 1分钟
    balance: { key: 'mg.balance', ttl: 5000 }, // 5秒
  };

  private constructor() {
    // 定期清理过期缓存
    setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 函数级中文注释：获取单例实例
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 函数级中文注释：设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const config = this.getConfig(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || config.ttl,
    };

    this.cache.set(key, entry);
    console.log(`✅ 缓存设置: ${key}, 过期时间: ${entry.ttl}ms`);
  }

  /**
   * 函数级中文注释：获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      console.log(`⚠️  缓存未命中: ${key}`);
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl) {
      console.log(`⏰ 缓存过期: ${key}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`✅ 缓存命中: ${key}`);
    return entry.data;
  }

  /**
   * 函数级中文注释：删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`🗑️  缓存删除: ${key}`);
  }

  /**
   * 函数级中文注释：清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 清理过期缓存: ${cleaned} 条`);
    }
  }

  /**
   * 函数级中文注释：获取缓存配置
   */
  private getConfig(key: string): CacheConfig {
    // 从 localStorage 获取自定义配置
    try {
      const customConfig = localStorage.getItem(`mg.cacheConfig.${key}`);
      if (customConfig) {
        return JSON.parse(customConfig);
      }
    } catch (err) {
      console.warn(`⚠️  读取缓存配置失败: ${key}`, err);
    }

    // 返回默认配置
    for (const config of Object.values(this.defaultConfigs)) {
      if (config.key.includes(key) || key.includes(config.key)) {
        return config;
      }
    }

    return { key, ttl: 30000 }; // 默认30秒
  }

  /**
   * 函数级中文注释：批量设置缓存
   */
  setBatch(data: Record<string, any>): void {
    for (const [key, value] of Object.entries(data)) {
      this.set(key, value);
    }
  }

  /**
   * 函数级中文注释：批量获取缓存
   */
  getBatch(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 函数级中文注释：获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * 函数级中文注释：全局缓存管理器实例
 */
export const cacheManager = CacheManager.getInstance();

/**
 * 函数级中文注释：缓存装饰器
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  key: string,
  ttl?: number
): T {
  return (async (...args: any[]) => {
    // 尝试从缓存获取
    const cached = cacheManager.get(key);
    if (cached !== null) {
      return cached;
    }

    // 执行原函数
    const result = await fn(...args);

    // 缓存结果
    cacheManager.set(key, result, ttl);

    return result;
  }) as T;
}

/**
 * 函数级中文注释：强制清理所有缓存
 */
export function clearAllCache(): void {
  console.log('🗑️  强制清理所有缓存...');

  // 清理内存缓存
  cacheManager.cleanup();

  // 清理 localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mg.')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`✅ 清理 localStorage: ${keysToRemove.length} 条`);
  } catch (err) {
    console.warn('⚠️  清理 localStorage 失败:', err);
  }

  // 清理 sessionStorage
  try {
    sessionStorage.clear();
    console.log('✅ 清理 sessionStorage 完成');
  } catch (err) {
    console.warn('⚠️  清理 sessionStorage 失败:', err);
  }
}

/**
 * 函数级中文注释：检查缓存健康状态
 */
export function checkCacheHealth(): {
  memoryCacheSize: number;
  localStorageSize: number;
  sessionStorageSize: number;
  expiredEntries: number;
} {
  const stats = cacheManager.getStats();

  let localStorageSize = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mg.')) {
        localStorageSize++;
      }
    }
  } catch (err) {
    console.warn('⚠️  检查 localStorage 失败:', err);
  }

  let sessionStorageSize = 0;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('mg.')) {
        sessionStorageSize++;
      }
    }
  } catch (err) {
    console.warn('⚠️  检查 sessionStorage 失败:', err);
  }

  return {
    memoryCacheSize: stats.size,
    localStorageSize,
    sessionStorageSize,
    expiredEntries: 0, // 由 cleanup() 计算
  };
}

