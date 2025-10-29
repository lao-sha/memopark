/**
 * 聊天列表组件
 * 
 * 功能：
 * - 显示所有会话列表
 * - 支持搜索会话
 * - 显示未读消息数
 * - 点击会话切换聊天窗口
 */

import React, { useState, useEffect } from 'react';
import { List, Avatar, Badge, Input, Empty, Spin, Typography } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import type { Session } from '../../types/chat';
import { queryUserSessions, querySession, queryUnreadCount } from '../../lib/chat';
import { useWallet } from '../../providers/WalletProvider';
import './ChatList.css';

const { Text } = Typography;

interface ChatListProps {
  /** 选中的会话ID */
  selectedSessionId?: string;
  /** 选中会话回调 */
  onSelectSession: (session: Session) => void;
}

/**
 * 聊天列表组件
 */
export const ChatList: React.FC<ChatListProps> = ({
  selectedSessionId,
  onSelectSession,
}) => {
  const { currentAccount: account } = useWallet();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  /**
   * 加载会话列表
   */
  useEffect(() => {
    if (!account) {
      setSessions([]);
      setLoading(false);
      return;
    }

    loadSessions();
  }, [account]);

  /**
   * 加载会话数据
   */
  const loadSessions = async () => {
    if (!account) return;

    try {
      setLoading(true);

      // 1. 查询用户的所有会话ID
      const sessionIds = await queryUserSessions(account.address);

      // 2. 查询每个会话的详细信息
      const sessionsPromises = sessionIds.map(async (sessionId) => {
        const session = await querySession(sessionId);
        if (!session) return null;

        // 查询未读数
        const unreadCount = await queryUnreadCount(account.address, sessionId);
        session.unreadCount = unreadCount;

        // 获取对方信息
        const otherAddress = session.participants.find(
          (p) => p !== account.address
        );
        if (otherAddress) {
          session.otherUser = {
            address: otherAddress,
            // TODO: 从链上查询用户名和头像
          };
        }

        return session;
      });

      const loadedSessions = (await Promise.all(sessionsPromises)).filter(
        (s): s is Session => s !== null
      );

      // 按最后活跃时间排序
      loadedSessions.sort((a, b) => b.lastActive - a.lastActive);

      setSessions(loadedSessions);
    } catch (error) {
      console.error('加载会话列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 过滤会话列表
   */
  const filteredSessions = sessions.filter((session) => {
    if (!searchText) return true;
    const otherAddress = session.otherUser?.address || '';
    const otherName = session.otherUser?.name || '';
    return (
      otherAddress.toLowerCase().includes(searchText.toLowerCase()) ||
      otherName.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    // 昨天
    if (diff < 48 * 60 * 60 * 1000) {
      return '昨天';
    }
    
    // 更早
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="chat-list">
      {/* 搜索框 */}
      <div className="chat-list-search">
        <Input
          placeholder="搜索会话"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </div>

      {/* 会话列表 */}
      <div className="chat-list-content">
        {loading ? (
          <div className="chat-list-loading">
            <Spin tip="加载中..." />
          </div>
        ) : filteredSessions.length === 0 ? (
          <Empty description="暂无会话" />
        ) : (
          <List
            dataSource={filteredSessions}
            renderItem={(session) => (
              <List.Item
                key={session.id}
                className={`chat-list-item ${
                  selectedSessionId === session.id ? 'active' : ''
                }`}
                onClick={() => onSelectSession(session)}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={session.unreadCount} offset={[-5, 5]}>
                      <Avatar
                        size={48}
                        icon={<UserOutlined />}
                        src={session.otherUser?.avatar}
                      >
                        {session.otherUser?.name?.[0]}
                      </Avatar>
                    </Badge>
                  }
                  title={
                    <div className="chat-list-item-title">
                      <Text strong>
                        {session.otherUser?.name || '未知用户'}
                      </Text>
                      <Text type="secondary" className="chat-list-item-time">
                        {formatTime(session.lastActive)}
                      </Text>
                    </div>
                  }
                  description={
                    <Text
                      ellipsis
                      className="chat-list-item-desc"
                      style={{ color: session.unreadCount > 0 ? '#000' : undefined }}
                    >
                      {session.lastMessage?.content || '暂无消息'}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

