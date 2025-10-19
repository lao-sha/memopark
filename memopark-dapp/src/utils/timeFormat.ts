/**
 * 时间格式化工具函数
 * 用于将Unix时间戳转换为人类可读的日期时间格式
 */

/**
 * 将Unix时间戳（毫秒）格式化为人类可读格式
 * @param timestamp - Unix时间戳（毫秒）或BigInt或字符串
 * @returns 格式化后的日期时间字符串（如：2025-10-18 16:40:30）
 */
export function formatTimestamp(timestamp: number | string | bigint): string {
  try {
    // 确保是数字类型
    const ts = typeof timestamp === 'bigint' 
      ? Number(timestamp) 
      : typeof timestamp === 'string'
        ? parseInt(timestamp, 10)
        : timestamp;
    
    // 创建Date对象
    const date = new Date(ts);
    
    // 检查是否是有效日期
    if (isNaN(date.getTime())) {
      return '无效时间';
    }
    
    // 格式化为 YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('时间格式化错误:', error);
    return '时间格式错误';
  }
}

/**
 * 将Unix时间戳转换为相对时间描述
 * @param timestamp - Unix时间戳（毫秒）或BigInt或字符串
 * @returns 相对时间描述（如：2小时前、昨天、3天前）
 */
export function formatRelativeTime(timestamp: number | string | bigint): string {
  try {
    const ts = typeof timestamp === 'bigint' 
      ? Number(timestamp) 
      : typeof timestamp === 'string'
        ? parseInt(timestamp, 10)
        : timestamp;
    
    const now = Date.now();
    const diff = now - ts;
    
    // 小于1分钟
    if (diff < 60 * 1000) {
      return '刚刚';
    }
    
    // 小于1小时
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}分钟前`;
    }
    
    // 小于24小时
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}小时前`;
    }
    
    // 小于7天
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      if (days === 1) return '昨天';
      return `${days}天前`;
    }
    
    // 超过7天，显示完整日期
    return formatTimestamp(ts);
  } catch (error) {
    console.error('相对时间格式化错误:', error);
    return formatTimestamp(timestamp);
  }
}

/**
 * 判断时间戳是否已过期
 * @param timestamp - Unix时间戳（毫秒）或BigInt或字符串
 * @returns 是否已过期
 */
export function isExpired(timestamp: number | string | bigint): boolean {
  try {
    const ts = typeof timestamp === 'bigint' 
      ? Number(timestamp) 
      : typeof timestamp === 'string'
        ? parseInt(timestamp, 10)
        : timestamp;
    
    return Date.now() > ts;
  } catch (error) {
    console.error('过期判断错误:', error);
    return false;
  }
}

/**
 * 计算剩余时间（小时）
 * @param timestamp - Unix时间戳（毫秒）或BigInt或字符串
 * @returns 剩余小时数，如果已过期返回0
 */
export function getRemainingHours(timestamp: number | string | bigint): number {
  try {
    const ts = typeof timestamp === 'bigint' 
      ? Number(timestamp) 
      : typeof timestamp === 'string'
        ? parseInt(timestamp, 10)
        : timestamp;
    
    const remaining = ts - Date.now();
    if (remaining <= 0) return 0;
    
    return Math.floor(remaining / (60 * 60 * 1000));
  } catch (error) {
    console.error('剩余时间计算错误:', error);
    return 0;
  }
}

/**
 * 格式化剩余时间为易读文本
 * @param timestamp - Unix时间戳（毫秒）或BigInt或字符串
 * @returns 剩余时间文本（如："2小时后过期"、"已过期"）
 */
export function formatRemainingTime(timestamp: number | string | bigint): string {
  try {
    const ts = typeof timestamp === 'bigint' 
      ? Number(timestamp) 
      : typeof timestamp === 'string'
        ? parseInt(timestamp, 10)
        : timestamp;
    
    const remaining = ts - Date.now();
    
    if (remaining <= 0) {
      return '已过期';
    }
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    if (hours < 1) {
      const minutes = Math.floor(remaining / (60 * 1000));
      return `${minutes}分钟后过期`;
    }
    
    if (hours < 24) {
      return `${hours}小时后过期`;
    }
    
    const days = Math.floor(hours / 24);
    return `${days}天后过期`;
  } catch (error) {
    console.error('剩余时间格式化错误:', error);
    return '未知';
  }
}

