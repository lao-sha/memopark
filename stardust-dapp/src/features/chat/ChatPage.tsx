/**
 * 聊天页面（移动端）
 *
 * 功能：
 * - 移动端APP风格设计
 * - 全屏显示聊天列表
 * - 响应式布局
 */

import React, { useState } from 'react';
import { List, Avatar, Badge, Input, Empty, Typography, Button } from 'antd';
import { SearchOutlined, UserOutlined, MessageOutlined } from '@ant-design/icons';
import './ChatPage.css';

const { Text } = Typography;

/**
 * 聊天页面主组件
 */
export const ChatPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');

  // 模拟会话数据
  const mockSessions = [
    {
      id: '1',
      name: '张三',
      lastMessage: '你好，最近怎么样？',
      lastTime: '10:30',
      unreadCount: 2,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: '2',
      name: '李四',
      lastMessage: '明天见面吗？',
      lastTime: '昨天',
      unreadCount: 0,
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b60c57a4?w=40&h=40&fit=crop&crop=face'
    },
    {
      id: '3',
      name: '王五',
      lastMessage: '好的，收到了',
      lastTime: '周三',
      unreadCount: 5,
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=40&h=40&fit=crop&crop=face'
    }
  ];

  return (
    <div className="chat-page-mobile">
      {/* 顶部搜索栏 */}
      <div className="chat-header">
        <div className="chat-search-container">
          <Input
            prefix={<SearchOutlined style={{ color: '#fff' }} />}
            placeholder="搜索会话"
            className="chat-search-input"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* 聊天列表 */}
      <div className="chat-content">
        {mockSessions.length === 0 ? (
          <div className="chat-empty">
            <Empty
              image={<MessageOutlined style={{ fontSize: 64, color: '#ccc' }} />}
              description={
                <div>
                  <Text type="secondary">暂无会话</Text>
                  <div style={{ marginTop: 16 }}>
                    <Button type="primary">开始新对话</Button>
                  </div>
                </div>
              }
            />
          </div>
        ) : (
          <List
            className="chat-list"
            dataSource={mockSessions}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                className="chat-list-item"
                onClick={() => {
                  // TODO: 跳转到聊天窗口
                  console.log('打开会话:', session.id);
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={session.unreadCount} offset={[-5, 5]}>
                      <Avatar
                        size={48}
                        icon={<UserOutlined />}
                        src={session.avatar}
                      >
                        {session.name[0]}
                      </Avatar>
                    </Badge>
                  }
                  title={
                    <div className="chat-item-header">
                      <Text strong style={{ fontSize: 16 }}>
                        {session.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {session.lastTime}
                      </Text>
                    </div>
                  }
                  description={
                    <Text
                      ellipsis
                      style={{
                        fontSize: 14,
                        color: session.unreadCount > 0 ? '#000' : '#999',
                        fontWeight: session.unreadCount > 0 ? 500 : 400
                      }}
                    >
                      {session.lastMessage}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* 底部间距 */}
      <div className="bottom-spacing" />
    </div>
  );
};

export default ChatPage;

