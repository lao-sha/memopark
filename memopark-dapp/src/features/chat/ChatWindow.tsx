/**
 * 聊天窗口组件
 * 
 * 功能：
 * - 显示聊天消息列表
 * - 发送文本消息
 * - 发送图片/文件消息（Phase 2）
 * - 标记消息已读
 * - 自动滚动到最新消息
 */

import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Avatar, Spin, Empty, message as antMessage, Typography, Modal, Alert } from 'antd';
import { SendOutlined, UserOutlined, WarningOutlined } from '@ant-design/icons';
import { MessageType } from '../../types/chat';
import type { Message, MessageContent, Session } from '../../types/chat';
import {
  sendMessage,
  queryMessage,
  querySessionMessages,
  markMessageAsRead,
  subscribeChatEvents,
} from '../../lib/chat';
import { useWallet } from '../../providers/WalletProvider';
import { FileUploader } from './FileUploader';
import { ImagePreview } from './ImagePreview';
import { FileMessage } from './FileMessage';
import {
  validateRecipientName,
  extractPaymentInfo,
  generatePaymentTemplate,
} from '../../lib/chat-validator';  // 🆕 2025-10-22：聊天验证工具
import './ChatWindow.css';

const { TextArea } = Input;
const { Text } = Typography;

interface ChatWindowProps {
  /** 当前会话 */
  session: Session;
}

/**
 * 聊天窗口组件
 */
export const ChatWindow: React.FC<ChatWindowProps> = ({ session }) => {
  const { currentAccount: account } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * 加载消息列表
   */
  useEffect(() => {
    if (!account || !session) return;

    loadMessages();

    // 监听新消息事件
    const unsubscribe = subscribeChatEvents((event) => {
      if (event.type === 'MessageSent' && event.data.sessionId === session.id) {
        // 收到新消息，重新加载
        loadMessages();
      } else if (event.type === 'MessageRead') {
        // 消息已读，更新状态
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === event.data.msgId ? { ...msg, isRead: true } : msg
          )
        );
      }
    });

    return () => {
      unsubscribe.then((unsub) => unsub());
    };
  }, [account, session]);

  /**
   * 自动滚动到底部
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * 加载消息数据
   */
  const loadMessages = async () => {
    if (!account) return;

    try {
      setLoading(true);

      // 1. 查询会话的所有消息ID
      const messageIds = await querySessionMessages(session.id);

      // 2. 查询每条消息的详细信息
      const messagesPromises = messageIds.map((msgId) =>
        queryMessage(msgId, account.keyring.secretKey, account.address)
      );

      const loadedMessages = (await Promise.all(messagesPromises)).filter(
        (msg): msg is Message => msg !== null
      );

      setMessages(loadedMessages);

      // 3. 标记未读消息为已读
      const unreadMessages = loadedMessages.filter(
        (msg) => !msg.isRead && msg.receiver === account.address
      );
      for (const msg of unreadMessages) {
        try {
          await markMessageAsRead(msg.id, account);
        } catch (error) {
          console.error('标记已读失败:', error);
        }
      }
    } catch (error) {
      console.error('加载消息失败:', error);
      antMessage.error('加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 发送文本消息
   */
  const handleSendMessage = async () => {
    if (!account || !inputText.trim()) return;

    const content: MessageContent = {
      text: inputText.trim(),
      timestamp: Date.now(),
    };

    try {
      setSending(true);

      await sendMessage(
        {
          receiver: session.otherUser!.address,
          content,
          type: MessageType.Text,
          sessionId: session.id,
        },
        account
      );

      // 清空输入框
      setInputText('');

      // 重新加载消息
      await loadMessages();

      antMessage.success('发送成功');
    } catch (error) {
      console.error('发送消息失败:', error);
      antMessage.error('发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  /**
   * 发送文件/图片消息
   */
  const handleSendFile = async (file: {
    cid: string;
    name: string;
    size: number;
    type: 'image' | 'file';
    url?: string;
  }) => {
    if (!account) return;

    const content: MessageContent = {
      timestamp: Date.now(),
    };

    // 根据文件类型设置内容
    if (file.type === 'image') {
      content.imageUrl = file.cid; // 存储 IPFS CID
    } else {
      content.fileUrl = file.cid;
      content.fileName = file.name;
      content.fileSize = file.size;
    }

    try {
      setSending(true);

      await sendMessage(
        {
          receiver: session.otherUser!.address,
          content,
          type: file.type === 'image' ? MessageType.Image : MessageType.File,
          sessionId: session.id,
        },
        account
      );

      // 重新加载消息
      await loadMessages();

      antMessage.success('发送成功');
    } catch (error) {
      console.error('发送文件失败:', error);
      antMessage.error('发送失败，请重试');
    } finally {
      setSending(false);
    }
  };

  /**
   * 处理Enter键发送
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * 滚动到底部
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * 格式化时间
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="chat-window">
      {/* 头部 */}
      <div className="chat-window-header">
        <Avatar icon={<UserOutlined />} src={session.otherUser?.avatar}>
          {session.otherUser?.name?.[0]}
        </Avatar>
        <Text strong style={{ marginLeft: 12 }}>
          {session.otherUser?.name || '未知用户'}
        </Text>
      </div>

      {/* 消息列表 */}
      <div className="chat-window-messages">
        {loading ? (
          <div className="chat-window-loading">
            <Spin tip="加载中..." />
          </div>
        ) : messages.length === 0 ? (
          <Empty description="暂无消息" />
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.isMine ? 'mine' : 'other'}`}
              >
                {!msg.isMine && (
                  <Avatar
                    size={32}
                    icon={<UserOutlined />}
                    src={session.otherUser?.avatar}
                  >
                    {session.otherUser?.name?.[0]}
                  </Avatar>
                )}
                <div className="chat-message-content">
                  <div className="chat-message-bubble">
                    {/* 文本消息 */}
                    {msg.type === MessageType.Text && (
                      <Text>{msg.content.text}</Text>
                    )}
                    
                    {/* 图片消息 */}
                    {msg.type === MessageType.Image && msg.content.imageUrl && (
                      <ImagePreview src={msg.content.imageUrl} width={200} />
                    )}
                    
                    {/* 文件消息 */}
                    {msg.type === MessageType.File && msg.content.fileUrl && (
                      <FileMessage
                        fileName={msg.content.fileName || '未知文件'}
                        fileSize={msg.content.fileSize || 0}
                        fileCid={msg.content.fileUrl}
                      />
                    )}
                  </div>
                  <Text type="secondary" className="chat-message-time">
                    {formatTime(msg.timestamp)}
                    {msg.isMine && msg.isRead && ' · 已读'}
                  </Text>
                </div>
                {msg.isMine && (
                  <Avatar size={32} icon={<UserOutlined />}>
                    {account?.address[0]}
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="chat-window-input">
        <div className="chat-window-input-toolbar">
          <FileUploader onFileUploaded={handleSendFile} disabled={sending} />
        </div>
        <div className="chat-window-input-main">
          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息... (Enter发送, Shift+Enter换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={sending}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={sending}
            disabled={!inputText.trim()}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

