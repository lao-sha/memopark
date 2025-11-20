/**
 * 函数级详细中文注释：聊天时间格式化工具
 * - 智能显示消息时间
 * - 消息分组
 * - 相对时间显示
 */

import type { Message } from '../types/chat';

/**
 * 函数级详细中文注释：智能格式化消息时间
 * - 1分钟内：刚刚
 * - 1小时内：X分钟前
 * - 今天：HH:MM
 * - 昨天：昨天 HH:MM
 * - 本周：星期X HH:MM
 * - 更早：MM-DD
 */
export function formatMessageTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const date = new Date(timestamp);
  const nowDate = new Date();
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  // 1分钟内
  if (diff < minute) {
    return '刚刚';
  }
  
  // 1小时内
  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}分钟前`;
  }
  
  // 今天
  if (date.toDateString() === nowDate.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // 昨天
  const yesterday = new Date(nowDate);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // 本周
  if (diff < 7 * day) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()] + ' ' + date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  // 更早：显示日期
  return date.toLocaleDateString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit' 
  });
}

/**
 * 函数级详细中文注释：消息分组（按时间）
 * - 超过5分钟显示时间分隔线
 * - 优化消息显示
 */
export function groupMessagesByTime(messages: Message[]): Array<{
  time: string;
  messages: Message[];
}> {
  if (!messages || messages.length === 0) return [];
  
  const groups: Array<{ time: string; messages: Message[] }> = [];
  let currentGroup: Message[] = [];
  let lastTime = 0;
  
  messages.forEach((msg, index) => {
    // 超过5分钟或第一条消息，插入时间分隔
    if (index === 0 || msg.sentAt - lastTime > 5 * 60 * 1000) {
      if (currentGroup.length > 0) {
        groups.push({
          time: formatMessageTime(lastTime),
          messages: currentGroup,
        });
      }
      currentGroup = [msg];
      lastTime = msg.sentAt;
    } else {
      currentGroup.push(msg);
    }
  });
  
  // 添加最后一组
  if (currentGroup.length > 0) {
    groups.push({
      time: formatMessageTime(lastTime),
      messages: currentGroup,
    });
  }
  
  return groups;
}

/**
 * 函数级详细中文注释：格式化会话最后活跃时间
 * - 用于会话列表显示
 */
export function formatSessionTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const date = new Date(timestamp);
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < 7 * day) {
    return `${Math.floor(diff / day)}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit' 
    });
  }
}

/**
 * 函数级详细中文注释：计算消息时间戳差异
 */
export function getTimeDiff(timestamp: number): {
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
} {
  const now = Date.now();
  const diff = now - timestamp;
  
  return {
    minutes: Math.floor(diff / (60 * 1000)),
    hours: Math.floor(diff / (60 * 60 * 1000)),
    days: Math.floor(diff / (24 * 60 * 60 * 1000)),
    weeks: Math.floor(diff / (7 * 24 * 60 * 60 * 1000)),
  };
}

