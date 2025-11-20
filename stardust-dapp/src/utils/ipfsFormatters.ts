/**
 * IPFS域监控格式化工具
 * 
 * 提供数据格式化、颜色计算等工具函数
 * 
 * @date 2025-11-18
 */

import type { DomainStats } from '../types/ipfs-domain';

/**
 * 格式化字节大小
 * @param bytes 字节数
 * @returns 格式化后的字符串（如 "1.5 GB"）
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 计算健康率
 * @param stats 域统计信息
 * @returns 健康率百分比（0-100）
 */
export function calculateHealthRate(stats: DomainStats): number {
  if (stats.totalPins === 0) return 0;
  return (stats.healthyCount / stats.totalPins) * 100;
}

/**
 * 获取健康状态的Tailwind CSS类名
 * @param healthRate 健康率（0-100）
 * @returns Tailwind CSS类名
 */
export function getHealthColor(healthRate: number): string {
  if (healthRate >= 95) return 'text-green-600';
  if (healthRate >= 85) return 'text-yellow-600';
  if (healthRate >= 70) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * 获取健康状态的背景色类名
 * @param healthRate 健康率（0-100）
 * @returns Tailwind CSS类名
 */
export function getHealthBgColor(healthRate: number): string {
  if (healthRate >= 95) return 'bg-green-100';
  if (healthRate >= 85) return 'bg-yellow-100';
  if (healthRate >= 70) return 'bg-orange-100';
  return 'bg-red-100';
}

/**
 * 获取优先级标签文本
 * @param priority 优先级（0-255）
 * @returns 优先级标签
 */
export function getPriorityLabel(priority: number): string {
  if (priority === 0) return '最高';
  if (priority <= 10) return '次高';
  if (priority <= 20) return '高';
  if (priority <= 50) return '中高';
  if (priority <= 100) return '普通';
  return '低';
}

/**
 * 获取优先级的Tailwind CSS类名
 * @param priority 优先级（0-255）
 * @returns Tailwind CSS类名
 */
export function getPriorityColor(priority: number): string {
  if (priority === 0) return 'bg-red-100 text-red-800 border-red-200';
  if (priority <= 10) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (priority <= 20) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (priority <= 50) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (priority <= 100) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * 格式化时间戳为可读日期
 * @param timestamp 时间戳（秒）
 * @returns 格式化的日期字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化时间为相对时间
 * @param timestamp 时间戳（秒）
 * @returns 相对时间字符串（如 "3天前"）
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const past = timestamp * 1000;
  const diff = now - past;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

/**
 * 计算健康状态的分布比例
 * @param stats 域统计信息
 * @returns 健康状态分布
 */
export function calculateHealthDistribution(stats: DomainStats): {
  healthy: number;
  degraded: number;
  critical: number;
} {
  if (stats.totalPins === 0) {
    return { healthy: 0, degraded: 0, critical: 0 };
  }
  
  return {
    healthy: (stats.healthyCount / stats.totalPins) * 100,
    degraded: (stats.degradedCount / stats.totalPins) * 100,
    critical: (stats.criticalCount / stats.totalPins) * 100,
  };
}
