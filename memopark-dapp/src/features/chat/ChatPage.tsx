/**
 * 聊天页面
 * 
 * 功能：
 * - 展示聊天列表和聊天窗口
 * - 响应式布局（移动端/桌面端自适应）
 * - 管理会话状态
 */

import React, { useState } from 'react';
import { Layout, Button, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import type { Session } from '../../types/chat';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import './ChatPage.css';

const { Content } = Layout;

/**
 * 聊天页面主组件
 */
export const ChatPage: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  /**
   * 选择会话
   */
  const handleSelectSession = (session: Session) => {
    setSelectedSession(session);
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  /**
   * 渲染聊天列表
   */
  const renderChatList = () => (
    <ChatList
      selectedSessionId={selectedSession?.id}
      onSelectSession={handleSelectSession}
    />
  );

  return (
    <Layout className="chat-page">
      <Content className="chat-page-content">
        {/* 移动端：抽屉式列表 */}
        {isMobile ? (
          <>
            {/* 顶部工具栏 */}
            {selectedSession && (
              <div className="chat-page-mobile-header">
                <Button
                  icon={<MenuOutlined />}
                  onClick={() => setDrawerVisible(true)}
                  type="text"
                />
              </div>
            )}

            {/* 抽屉 */}
            <Drawer
              title="聊天列表"
              placement="left"
              open={drawerVisible}
              onClose={() => setDrawerVisible(false)}
              width="80%"
              bodyStyle={{ padding: 0 }}
            >
              {renderChatList()}
            </Drawer>

            {/* 聊天窗口 */}
            <div className="chat-page-window">
              {selectedSession ? (
                <ChatWindow session={selectedSession} />
              ) : (
                <div className="chat-page-empty">
                  <Button onClick={() => setDrawerVisible(true)}>
                    选择会话
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* 桌面端：左右分栏 */
          <>
            <div className="chat-page-list">{renderChatList()}</div>
            <div className="chat-page-window">
              {selectedSession ? (
                <ChatWindow session={selectedSession} />
              ) : (
                <div className="chat-page-empty">
                  <p>选择一个会话开始聊天</p>
                </div>
              )}
            </div>
          </>
        )}
      </Content>
    </Layout>
  );
};

