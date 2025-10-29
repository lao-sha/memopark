/**
 * 查询缓存工具
 * 
 * 功能：
 * - 缓存链上查询结果
 * - 自动过期清理
 * - 内存管理
 * 
 * 使用场景：
 * - 频繁查询的申诉数据
 * - 短期内不会变化的数据
 * - 减少链上RPC调用
 */

/**
 * 缓存项
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * 缓存配置
 */
interface CacheConfig {
  maxSize?: number;        // 最大缓存条目数，默认100
  defaultTTL?: number;     // 默认过期时间（毫秒），默认60000（60秒）
}

/**
 * 查询缓存类
 * 
 * @example
 * ```typescript
 * const cache = new QueryCache<AppealInfo>({ defaultTTL: 30000 });
 * 
 * // 存储数据
 * cache.set('appeal-123', appealData);
 * 
 * // 获取数据
 * const data = cache.get('appeal-123');
 * if (data) {
 *   console.log('缓存命中');
 * } else {
 *   // 从链上查询
 *   const freshData = await api.query.stardustAppeals.appeals(123);
 *   cache.set('appeal-123', freshData);
 * }
 * ```
 */
export class QueryCache<T = any> {
  private cache: Map<string, CacheItem<T>>;
  private maxSize: number;
  private defaultTTL: number;
  
  /**
   * 构造函数
   * 
   * @param config - 缓存配置
   */
  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.maxSize = config.maxSize || 100;
    this.defaultTTL = config.defaultTTL || 60000; // 默认60秒
  }
  
  /**
   * 存储数据到缓存
   * 
   * @param key - 缓存键
   * @param data - 数据
   * @param ttl - 过期时间（毫秒），可选
   */
  set(key: string, data: T, ttl?: number): void {
    // 检查缓存大小，超过限制时删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }
  
  /**
   * 从缓存获取数据
   * 
   * @param key - 缓存键
   * @returns 数据或null（如果不存在或已过期）
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * 删除缓存项
   * 
   * @param key - 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
  
  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // 简化版不统计命中率
    };
  }
}

/**
 * 全局申诉缓存实例
 */
export const appealCache = new QueryCache({
  maxSize: 200,
  defaultTTL: 30000, // 30秒
});

/**
 * 缓存装饰器工厂
 * 
 * @param getCacheKey - 获取缓存键的函数
 * @param ttl - 过期时间（毫秒）
 * @returns 装饰器函数
 * 
 * @example
 * ```typescript
 * class AppealService {
 *   @cached((id: number) => `appeal-${id}`, 30000)
 *   async getAppeal(id: number): Promise<AppealInfo> {
 *     return await api.query.stardustAppeals.appeals(id);
 *   }
 * }
 * ```
 */
export function cached<T>(
  getCacheKey: (...args: any[]) => string,
  ttl?: number
) {
  const cache = new QueryCache<T>({ defaultTTL: ttl });
  
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = getCacheKey(...args);
      
      // 尝试从缓存获取
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // 调用原方法
      const result = await originalMethod.apply(this, args);
      
      // 存入缓存
      cache.set(cacheKey, result);
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * 批量查询缓存优化
 * 
 * @param keys - 缓存键数组
 * @param fetcher - 获取数据的函数（仅查询缺失的键）
 * @param cache - 缓存实例
 * @returns 数据数组
 * 
 * @example
 * ```typescript
 * const appealIds = [1, 2, 3, 4, 5];
 * const appeals = await batchGetWithCache(
 *   appealIds.map(id => `appeal-${id}`),
 *   async (missingKeys) => {
 *     const ids = missingKeys.map(k => Number(k.split('-')[1]));
 *     return await Promise.all(
 *       ids.map(id => api.query.stardustAppeals.appeals(id))
 *     );
 *   },
 *   appealCache
 * );
 * ```
 */
export async function batchGetWithCache<T>(
  keys: string[],
  fetcher: (missingKeys: string[]) => Promise<T[]>,
  cache: QueryCache<T>
): Promise<T[]> {
  const results: (T | null)[] = [];
  const missingKeys: string[] = [];
  const missingIndices: number[] = [];
  
  // 尝试从缓存获取
  for (let i = 0; i < keys.length; i++) {
    const cached = cache.get(keys[i]);
    if (cached !== null) {
      results.push(cached);
    } else {
      results.push(null);
      missingKeys.push(keys[i]);
      missingIndices.push(i);
    }
  }
  
  // 查询缺失的数据
  if (missingKeys.length > 0) {
    const fetchedData = await fetcher(missingKeys);
    
    // 填充结果并更新缓存
    for (let i = 0; i < fetchedData.length; i++) {
      const data = fetchedData[i];
      const key = missingKeys[i];
      const index = missingIndices[i];
      
      results[index] = data;
      cache.set(key, data);
    }
  }
  
  return results as T[];
}

/**
 * 自动清理过期缓存的定时器
 * 
 * @param cache - 缓存实例
 * @param interval - 清理间隔（毫秒），默认60000（60秒）
 * @returns 停止函数
 * 
 * @example
 * ```typescript
 * const stopCleanup = startAutoCleanup(appealCache, 30000);
 * 
 * // 停止自动清理
 * stopCleanup();
 * ```
 */
export function startAutoCleanup(
  cache: QueryCache,
  interval: number = 60000
): () => void {
  const timer = setInterval(() => {
    cache.cleanup();
  }, interval);
  
  return () => clearInterval(timer);
}

export default QueryCache;

