/**
 * 函数级详细中文注释：消息转发组件
 * - 选择目标会话
 * - 批量转发到多个会话
 * - 保留原消息格式
 */

import React, { useState, useEffect } from 'react';
import { Modal, List, Avatar, Checkbox, Button, message as antMessage, Empty, Typography } from 'antd';
import { UserOutlined, SendOutlined } from '@ant-design/icons';
import type { Session, Message } from '../../types/chat';

const { Text } = Typography;

interface MessageForwardProps {
  message: Message | null;
  visible: boolean;
  sessions: Session[];  // 可转发的会话列表
  onClose: () => void;
  onForward: (targetSessionIds: string[]) => Promise<void>;
}

/**
 * 消息转发组件
 */
export const MessageForward: React.FC<MessageForwardProps> = ({
  message,
  visible,
  sessions,
  onClose,
  onForward,
}) => {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);
  
  // 重置选择
  useEffect(() => {
    if (visible) {
      setSelectedSessionIds([]);
    }
  }, [visible]);
  
  /**
   * 函数级详细中文注释：处理转发
   */
  const handleForward = async () => {
    if (selectedSessionIds.length === 0) {
      antMessage.warning('请选择至少一个会话');
      return;
    }
    
    setForwarding(true);
    try {
      await onForward(selectedSessionIds);
      antMessage.success(`已转发到 ${selectedSessionIds.length} 个会话`);
      onClose();
    } catch (error) {
      console.error('转发失败:', error);
      antMessage.error('转发失败，请重试');
    } finally {
      setForwarding(false);
    }
  };
  
  /**
   * 函数级详细中文注释：切换会话选择
   */
  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };
  
  if (!message) return null;
  
  // 过滤掉当前会话
  const availableSessions = sessions.filter(s => s.id !== message.sessionId);
  
  return (
    <Modal
      open={visible}
      title="转发消息"
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="forward"
          type="primary"
          icon={<SendOutlined />}
          loading={forwarding}
          onClick={handleForward}
          disabled={selectedSessionIds.length === 0}
          style={{
            background: selectedSessionIds.length > 0
              ? 'linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)'
              : undefined,
            border: 'none',
          }}
        >
          转发 {selectedSessionIds.length > 0 && `(${selectedSessionIds.length})`}
        </Button>,
      ]}
      centered
      width={400}
    >
      {/* 消息预览 */}
      <div style={{
        padding: 12,
        background: 'linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%)',
        borderRadius: 8,
        marginBottom: 16,
        border: '2px solid rgba(184, 134, 11, 0.1)',
      }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
          将转发以下消息：
        </Text>
        <Text style={{ fontSize: 14 }}>
          {message.content.text || '（非文本消息）'}
        </Text>
      </div>
      
      {/* 会话选择列表 */}
      {availableSessions.length === 0 ? (
        <Empty
          description="暂无其他会话"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={availableSessions}
          style={{ maxHeight: 400, overflowY: 'auto' }}
          renderItem={(session) => (
            <List.Item
              onClick={() => toggleSession(session.id)}
              style={{
                cursor: 'pointer',
                padding: '12px 8px',
                borderRadius: 8,
                transition: 'all 0.2s ease',
                background: selectedSessionIds.includes(session.id)
                  ? 'rgba(184, 134, 11, 0.05)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!selectedSessionIds.includes(session.id)) {
                  e.currentTarget.style.background = 'rgba(184, 134, 11, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!selectedSessionIds.includes(session.id)) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Checkbox
                checked={selectedSessionIds.includes(session.id)}
                style={{ marginRight: 12 }}
              />
              <List.Item.Meta
                avatar={
                  <Avatar 
                    icon={<UserOutlined />}
                    style={{
                      backgroundColor: '#B8860B',
                    }}
                  />
                }
                title={
                  <Text strong style={{ fontSize: 15 }}>
                    {session.otherUser?.name || '未知用户'}
                  </Text>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {session.otherUser?.address?.slice(0, 10)}...
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};

