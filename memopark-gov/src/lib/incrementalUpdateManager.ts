/**
 * 增量更新管理器
 * 函数级中文注释：实现增量数据更新机制，只获取和更新变化的数据
 */

/**
 * 函数级中文注释：更新检查结果接口
 */
interface UpdateCheckResult<T> {
  hasChanges: boolean;
  changes: T[];
  timestamp: number;
}

/**
 * 函数级中文注释：增量更新管理器类
 */
export class IncrementalUpdateManager {
  private lastUpdateTimes: Map<string, number> = new Map();
  private updateIntervals: Map<string, number> = new Map();

  /**
   * 函数级中文注释：构造函数，设置默认更新间隔
   */
  constructor() {
    // 设置默认更新间隔（毫秒）
    this.updateIntervals.set('proposals', 45000); // 提案数据45秒，降低负载
    this.updateIntervals.set('voting', 10000); // 投票数据10秒
    this.updateIntervals.set('council', 60000); // 成员数据60秒
    this.updateIntervals.set('balance', 5000); // 余额数据5秒
  }

  /**
   * 函数级中文注释：检查数据是否有更新
   */
  async checkForUpdates<T extends Record<string, any>>(
    dataType: string,
    fetcher: () => Promise<T[]>,
    comparer: (oldData: T[], newData: T[]) => Array<T & { _status: string }> = this.defaultComparer
  ): Promise<UpdateCheckResult<T>> {
    const lastUpdateTime = this.lastUpdateTimes.get(dataType) || 0;
    const currentTime = Date.now();

    // 检查是否达到更新间隔
    const interval = this.updateIntervals.get(dataType) || 30000;
    if (currentTime - lastUpdateTime < interval) {
      return {
        hasChanges: false,
        changes: [],
        timestamp: lastUpdateTime
      };
    }

    try {
      console.log(`🔍 检查 ${dataType} 数据更新...`);
      const newData = await fetcher();

      // 获取旧数据进行比较
      const oldData: T[] = this.getStoredData<T[]>(dataType) || [];

      // 找出变化的数据
      const changes = comparer(oldData, newData);

      const hasChanges = changes.length > 0;

      if (hasChanges) {
        console.log(`✅ ${dataType} 发现 ${changes.length} 条变化`);
        this.setStoredData(dataType, newData);
        this.lastUpdateTimes.set(dataType, currentTime);
      } else {
        console.log(`✅ ${dataType} 无变化`);
      }

      return {
        hasChanges,
        changes,
        timestamp: currentTime
      };
    } catch (error: any) {
      console.error(`❌ 检查 ${dataType} 更新失败:`, error?.message || error);
      return {
        hasChanges: false,
        changes: [],
        timestamp: lastUpdateTime
      };
    }
  }

  /**
   * 函数级中文注释：默认比较器，找出新增和修改的数据
   */
  private defaultComparer = <T>(oldData: T[], newData: T[]): Array<T & { _status: string }> => {
    const changes: Array<T & { _status: string }> = [];

    // 创建新数据的映射，便于查找
    const newDataMap = new Map<string, T>();
    newData.forEach(item => {
      const key = this.getItemKey(item);
      newDataMap.set(key, item);
    });

    // 检查旧数据中的变化
    oldData.forEach(oldItem => {
      const key = this.getItemKey(oldItem);
      const newItem = newDataMap.get(key);

      if (!newItem) {
        // 项目被删除
        changes.push({ ...oldItem, _status: 'deleted' });
      } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        // 项目被修改
        changes.push({ ...newItem, _status: 'modified' });
      }
    });

    // 检查新增的项目
    newData.forEach(newItem => {
      const key = this.getItemKey(newItem);
      if (!oldData.find(oldItem => this.getItemKey(oldItem) === key)) {
        // 新增项目
        changes.push({ ...newItem, _status: 'added' });
      }
    });

    return changes;
  }

  /**
   * 函数级中文注释：获取数据项的唯一键
   */
  private getItemKey<T>(item: T): string {
    // 根据数据类型生成唯一键
    if (typeof item === 'object' && item !== null) {
      if ('id' in item) return String((item as any).id);
      if ('mmId' in item) return String((item as any).mmId);
      if ('address' in item) return String((item as any).address);
      if ('proposalHash' in item) return String((item as any).proposalHash);
    }
    return JSON.stringify(item);
  }

  /**
   * 函数级中文注释：获取存储的数据
   */
  private getStoredData<T>(dataType: string): T | null {
    try {
      const stored = localStorage.getItem(`mg.${dataType}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * 函数级中文注释：存储数据
   */
  private setStoredData<T>(dataType: string, data: T[]): void {
    try {
      localStorage.setItem(`mg.${dataType}`, JSON.stringify(data));
    } catch (error) {
      console.warn(`⚠️  存储 ${dataType} 数据失败:`, error);
    }
  }

  /**
   * 函数级中文注释：设置更新间隔
   */
  setUpdateInterval(dataType: string, interval: number): void {
    this.updateIntervals.set(dataType, interval);
    console.log(`⏰ 设置 ${dataType} 更新间隔: ${interval}ms`);
  }

  /**
   * 函数级中文注释：获取上次更新时间
   */
  getLastUpdateTime(dataType: string): number {
    return this.lastUpdateTimes.get(dataType) || 0;
  }

  /**
   * 函数级中文注释：强制更新数据
   */
  async forceUpdate<T>(
    dataType: string,
    fetcher: () => Promise<T[]>
  ): Promise<T[]> {
    console.log(`🔄 强制更新 ${dataType}...`);
    const data = await fetcher();
    this.setStoredData(dataType, data);
    this.lastUpdateTimes.set(dataType, Date.now());
    return data;
  }

  /**
   * 函数级中文注释：清理过期数据
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // 检查所有存储的数据是否过期
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('mg.')) {
        try {
          // 尝试解析以检测格式是否有效
          void JSON.parse(localStorage.getItem(key) || '[]');
          const dataType = key.replace('mg.', '');

          // 如果数据存在但更新时间过长，可以考虑清理
          const lastUpdate = this.lastUpdateTimes.get(dataType) || 0;
          const maxAge = (this.updateIntervals.get(dataType) || 30000) * 10; // 10倍间隔

          if (now - lastUpdate > maxAge) {
            expiredKeys.push(key);
          }
        } catch {
          // 数据格式错误，也清理
          expiredKeys.push(key);
        }
      }
    });

    // 清理过期数据
    expiredKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️  清理过期缓存: ${key}`);
    });

    if (expiredKeys.length > 0) {
      console.log(`✅ 清理完成，共清理 ${expiredKeys.length} 条过期缓存`);
    }
  }

  /**
   * 函数级中文注释：获取统计信息
   */
  getStats(): {
    updateIntervals: Record<string, number>;
    lastUpdateTimes: Record<string, number>;
    storedDataTypes: string[];
  } {
    return {
      updateIntervals: Object.fromEntries(this.updateIntervals),
      lastUpdateTimes: Object.fromEntries(this.lastUpdateTimes),
      storedDataTypes: Array.from(this.lastUpdateTimes.keys())
    };
  }
}

/**
 * 函数级中文注释：全局增量更新管理器实例
 */
export const incrementalUpdateManager = new IncrementalUpdateManager();

// 定期清理过期数据
setInterval(() => {
  incrementalUpdateManager.cleanup();
}, 300000); // 每5分钟清理一次

