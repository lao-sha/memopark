/**
 * 留言板组件
 * 
 * 功能说明：
 * 1. 展示留言列表
 * 2. 支持发布新留言
 * 3. 支持留言排序（最新/最热）
 * 4. 支持点赞功能
 * 
 * 创建日期：2025-11-02
 */

import React, { useState } from 'react'
import { Card, List, Avatar, Space, Typography, Input, Button, Empty, message, Tag } from 'antd'
import {
  MessageOutlined,
  SendOutlined,
  LikeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { MemorialColors } from '../../../theme/colors'

const { Text, Paragraph } = Typography
const { TextArea } = Input

interface Message {
  id: string
  author: string
  avatar?: string
  content: string
  timestamp: number
  likes: number
}

interface MessageBoardSectionProps {
  /** 逝者ID */
  deceasedId: number
  /** 当前用户地址 */
  currentAccount?: string
}

/**
 * 函数级详细中文注释：格式化地址
 */
const formatAddress = (address: string): string => {
  if (!address || address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 函数级详细中文注释：格式化时间
 */
const formatTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`
  return `${Math.floor(minutes / 1440)} 天前`
}

/**
 * 函数级详细中文注释：留言板组件
 */
export const MessageBoardSection: React.FC<MessageBoardSectionProps> = ({
  deceasedId,
  currentAccount,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    // 模拟数据
    {
      id: '1',
      author: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      content: '父亲，我们想您了。愿您在天堂安好。',
      timestamp: Date.now() - 3600000,
      likes: 15,
    },
    {
      id: '2',
      author: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      content: '一路走好，愿您安息。',
      timestamp: Date.now() - 7200000,
      likes: 8,
    },
  ])
  const [newMessage, setNewMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /**
   * 函数级详细中文注释：发布留言
   */
  const handleSubmit = async () => {
    if (!currentAccount) {
      message.warning('请先连接钱包')
      return
    }

    if (!newMessage.trim()) {
      message.warning('请输入留言内容')
      return
    }

    setSubmitting(true)
    try {
      // TODO: 实现链上或链下留言存储
      // 1. 将留言存储到IPFS或链下数据库
      // 2. 记录留言CID到链上（可选）
      
      const message: Message = {
        id: Date.now().toString(),
        author: currentAccount,
        content: newMessage,
        timestamp: Date.now(),
        likes: 0,
      }
      
      setMessages([message, ...messages])
      setNewMessage('')
      // message.success('留言发布成功')
    } catch (error: any) {
      message.error(error.message || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 函数级详细中文注释：点赞留言
   */
  const handleLike = (messageId: string) => {
    setMessages(
      messages.map(msg =>
        msg.id === messageId ? { ...msg, likes: msg.likes + 1 } : msg
      )
    )
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* 发布留言卡片 */}
      {currentAccount && (
        <Card
          bordered={false}
          style={{
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            marginBottom: 16,
          }}
          bodyStyle={{ padding: '16px' }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageOutlined style={{ fontSize: 18, color: MemorialColors.primary }} />
              <Text strong>写下您的思念</Text>
            </div>
            <TextArea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="留下您的祝福与思念..."
              rows={4}
              maxLength={500}
              showCount
              style={{ borderRadius: 8 }}
            />
            <div style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={handleSubmit}
                disabled={!newMessage.trim()}
                style={{
                  backgroundColor: MemorialColors.primary,
                  borderColor: MemorialColors.primary,
                }}
              >
                发布留言
              </Button>
            </div>
          </Space>
        </Card>
      )}

      {/* 留言列表 */}
      <Card
        bordered={false}
        title={
          <Space>
            <MessageOutlined style={{ color: MemorialColors.primary }} />
            <span>留言板</span>
            <Tag color={MemorialColors.primary}>{messages.length}</Tag>
          </Space>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ padding: '16px' }}
      >
        {messages.length > 0 ? (
          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item
                key={item.id}
                style={{
                  border: 'none',
                  padding: '16px 0',
                  borderBottom: `1px solid ${MemorialColors.borderLight}`,
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={40}
                      src={item.avatar || `https://picsum.photos/seed/${item.author}/80`}
                      style={{ border: `2px solid ${MemorialColors.borderLight}` }}
                    />
                  }
                  title={
                    <Space>
                      <Text strong style={{ fontSize: 14 }}>
                        {formatAddress(item.author)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {formatTime(item.timestamp)}
                      </Text>
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 8 }}>
                      <Paragraph
                        style={{
                          fontSize: 14,
                          color: MemorialColors.textPrimary,
                          marginBottom: 8,
                        }}
                      >
                        {item.content}
                      </Paragraph>
                      <Button
                        type="text"
                        size="small"
                        icon={<LikeOutlined />}
                        onClick={() => handleLike(item.id)}
                        style={{ padding: '0 8px' }}
                      >
                        {item.likes > 0 ? item.likes : '点赞'}
                      </Button>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无留言，快来留下第一条思念吧"
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>
    </div>
  )
}

