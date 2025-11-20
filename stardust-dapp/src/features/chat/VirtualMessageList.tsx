/**
 * 函数级详细中文注释：虚拟滚动消息列表组件
 * - 只渲染可见区域的消息
 * - 支持数千条消息流畅滚动
 * - 自动滚动到最新消息
 * - 性能优化：减少DOM节点
 */

import React, { useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { Message } from '../../types/chat';
import { Typography } from 'antd';

const { Text } = Typography;

interface VirtualMessageListProps {
  messages: Message[];
  currentAccount: string;
  height: number;
  onMessageClick?: (message: Message) => void;
}

/**
 * 虚拟滚动消息列表
 */
export const VirtualMessageList: React.FC<VirtualMessageListProps> = ({
  messages,
  currentAccount,
  height,
  onMessageClick,
}) => {
  const listRef = useRef<List>(null);
  
  /**
   * 函数级详细中文注释：自动滚动到底部
   * - 新消息时自动滚动
   */
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages.length]);
  
  /**
   * 函数级详细中文注释：渲染单条消息
   */
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const message = messages[index];
    const isMine = message.sender === currentAccount;
    
    return (
      <div style={style}>
        <div
          className={`chat-message ${isMine ? 'mine' : 'other'}`}
          style={{
            display: 'flex',
            flexDirection: isMine ? 'row-reverse' : 'row',
            gap: 8,
            padding: '8px 16px',
          }}
          onClick={() => onMessageClick?.(message)}
        >
          {/* 消息气泡 */}
          <div
            className="chat-message-bubble"
            style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: 12,
              background: isMine
                ? 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)'
                : '#fff',
              color: isMine ? '#fff' : '#333',
              border: isMine ? 'none' : '1px solid #e8e8e8',
              wordBreak: 'break-word',
            }}
          >
            <Text style={{ color: 'inherit', fontSize: 15 }}>
              {message.content.text}
            </Text>
            
            {/* 消息时间 */}
            <div style={{
              marginTop: 4,
              fontSize: 11,
              opacity: 0.7,
              textAlign: 'right',
            }}>
              {new Date(message.sentAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <List
      ref={listRef}
      height={height}
      itemCount={messages.length}
      itemSize={80}  // 每条消息约80px高（可动态计算）
      width="100%"
      overscanCount={5}  // 预渲染5条消息
    >
      {Row}
    </List>
  );
};

