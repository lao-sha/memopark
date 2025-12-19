/**
 * 函数级详细中文注释：消息搜索组件
 * - 支持全文搜索
 * - 高亮显示匹配结果
 * - 点击跳转到消息位置
 * - 实时搜索，性能优化
 */

import React, { useState, useEffect } from 'react';
import { Input, List, Typography, Tag, Empty, Spin } from 'antd';
import { SearchOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import type { Message } from '../../types/chat';
import { searchCachedMessages } from '../../lib/chat-cache';

const { Text } = Typography;

interface MessageSearchProps {
  sessionId: string;
  currentAccount: string;
  onSelectMessage: (messageId: number) => void;
  onClose?: () => void;
}

/**
 * 消息搜索组件
 */
export const MessageSearch: React.FC<MessageSearchProps> = ({
  sessionId,
  currentAccount,
  onSelectMessage,
  onClose,
}) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  
  /**
   * 函数级详细中文注释：执行搜索
   * - 防抖处理（300ms）
   * - 从缓存中搜索
   */
  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      return;
    }
    
    const timer = setTimeout(() => {
      handleSearch(keyword);
    }, 300);  // 防抖300ms
    
    return () => clearTimeout(timer);
  }, [keyword, sessionId]);
  
  const handleSearch = async (value: string) => {
    setSearching(true);
    try {
      const matched = await searchCachedMessages(sessionId, value);
      setResults(matched);
    } catch (error) {
      console.error('搜索失败:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };
  
  /**
   * 函数级详细中文注释：高亮关键词
   */
  const highlightText = (text: string, keyword: string) => {
    if (!keyword.trim()) return <span>{text}</span>;
    
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <span>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <Text 
              key={index} 
              mark 
              style={{ 
                backgroundColor: '#B8860B', 
                color: '#fff',
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              {part}
            </Text>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };
  
  /**
   * 函数级详细中文注释：格式化时间
   */
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      // 今天：显示时间
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else {
      // 其他：显示日期
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };
  
  return (
    <div style={{ padding: 16, maxWidth: 414, margin: '0 auto' }}>
      {/* 搜索框 */}
      <Input
        placeholder="搜索消息内容"
        prefix={<SearchOutlined style={{ color: '#B8860B' }} />}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        size="large"
        allowClear
        autoFocus
        style={{
          borderRadius: 24,
          border: '2px solid rgba(184, 134, 11, 0.2)',
          fontSize: 15,
        }}
      />
      
      {/* 搜索结果 */}
      <div style={{ marginTop: 16 }}>
        {searching ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="搜索中..." />
          </div>
        ) : keyword && results.length === 0 ? (
          <Empty
            description="未找到相关消息"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : keyword && results.length > 0 ? (
          <>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
              找到 {results.length} 条消息
            </Text>
            
            <List
              dataSource={results}
              renderItem={(msg) => {
                const isMine = msg.sender === currentAccount;
                
                return (
                  <List.Item
                    onClick={() => {
                      onSelectMessage(msg.id);
                      if (onClose) onClose();
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 8,
                      background: '#fff',
                      border: '2px solid rgba(184, 134, 11, 0.1)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.3)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(47, 79, 79, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(184, 134, 11, 0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {/* 消息头部 */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 8,
                        marginBottom: 8,
                      }}>
                        <Tag 
                          icon={<UserOutlined />}
                          color={isMine ? 'blue' : 'green'}
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          {isMine ? '我' : '对方'}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <ClockCircleOutlined /> {formatTime(msg.sentAt)}
                        </Text>
                      </div>
                      
                      {/* 消息内容（高亮关键词） */}
                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                        {highlightText(msg.content.text || '', keyword)}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
};

