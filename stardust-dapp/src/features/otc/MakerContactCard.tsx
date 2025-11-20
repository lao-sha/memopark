import React, { useState, useEffect } from 'react'
import { Card, Button, Badge, Tag, Typography, Space, Avatar, Modal, message, Alert, Divider } from 'antd'
import { MessageOutlined, PhoneOutlined, WechatOutlined, QqOutlined, UserOutlined, StarOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { getOrCreateChatSession } from '../../lib/chat'
import { useWallet } from '../../providers/WalletProvider'
import type { MarketMaker } from './types/order.types'
import './MakerContactCard.css'

const { Text, Paragraph } = Typography

/**
 * 函数级详细中文注释：联系做市商交易卡片
 *
 * ### 功能说明
 * - 显示选中做市商的详细联系信息
 * - 提供一键开启聊天功能
 * - 显示做市商信用评级和交易统计
 * - 提供交易流程指导和安全提示
 *
 * ### 使用场景
 * - 用户选择做市商后显示在订单信息下方
 * - 订单创建成功后引导用户联系做市商
 * - 提供便捷的沟通渠道
 */
interface MakerContactCardProps {
  /** 选中的做市商信息 */
  selectedMaker: MarketMaker | null
  /** 是否显示完整信息 */
  showFullInfo?: boolean
  /** 订单创建状态 */
  orderStatus?: 'pending' | 'created' | 'completed'
  /** 订单ID（用于聊天上下文） */
  orderId?: string
  /** 自定义样式类名 */
  className?: string
}

const MakerContactCard: React.FC<MakerContactCardProps> = ({
  selectedMaker,
  showFullInfo = true,
  orderStatus = 'pending',
  orderId,
  className
}) => {
  const { currentAccount } = useWallet()
  const [chatLoading, setChatLoading] = useState(false)
  const [contactVisible, setContactVisible] = useState(false)

  // 如果没有选中做市商，不显示卡片
  if (!selectedMaker) {
    return null
  }

  /**
   * 打开与做市商的聊天窗口
   */
  const handleOpenChat = async () => {
    if (!currentAccount || !selectedMaker) {
      message.warning('请先连接钱包并选择做市商')
      return
    }

    try {
      setChatLoading(true)
      message.loading({ content: '正在创建聊天会话...', key: 'chat', duration: 0 })

      const sessionId = await getOrCreateChatSession(
        currentAccount.address,
        selectedMaker.owner
      )

      // 构建聊天URL，包含订单上下文
      let chatUrl = `#/chat/${sessionId}`
      if (orderId) {
        chatUrl += `?order=${orderId}`
      }

      message.success({ content: '聊天窗口已创建', key: 'chat', duration: 2 })
      window.location.hash = chatUrl
    } catch (error) {
      console.error('创建聊天会话失败:', error)
      message.error({ content: '创建聊天会话失败，请稍后重试', key: 'chat', duration: 3 })
    } finally {
      setChatLoading(false)
    }
  }

  /**
   * 显示详细联系方式（模拟）
   */
  const handleShowContact = () => {
    setContactVisible(true)
  }

  /**
   * 获取做市商状态标签
   */
  const getMakerStatusTag = () => {
    const { sellPremiumBps } = selectedMaker

    if (sellPremiumBps <= -200) {
      return <Tag color="green">🔥 优惠价格</Tag>
    } else if (sellPremiumBps <= 0) {
      return <Tag color="blue">💎 市价交易</Tag>
    } else if (sellPremiumBps <= 500) {
      return <Tag color="orange">⚡ 快速交易</Tag>
    } else {
      return <Tag color="red">💰 溢价交易</Tag>
    }
  }

  /**
   * 获取交易流程步骤
   */
  const getTradeSteps = () => {
    switch (orderStatus) {
      case 'pending':
        return [
          { step: 1, text: '选择做市商', status: 'finish' },
          { step: 2, text: '填写订单信息', status: 'process' },
          { step: 3, text: '联系做市商', status: 'wait' },
          { step: 4, text: '完成支付', status: 'wait' },
          { step: 5, text: '接收DUST', status: 'wait' }
        ]
      case 'created':
        return [
          { step: 1, text: '选择做市商', status: 'finish' },
          { step: 2, text: '填写订单信息', status: 'finish' },
          { step: 3, text: '联系做市商', status: 'process' },
          { step: 4, text: '完成支付', status: 'wait' },
          { step: 5, text: '接收DUST', status: 'wait' }
        ]
      case 'completed':
        return [
          { step: 1, text: '选择做市商', status: 'finish' },
          { step: 2, text: '填写订单信息', status: 'finish' },
          { step: 3, text: '联系做市商', status: 'finish' },
          { step: 4, text: '完成支付', status: 'finish' },
          { step: 5, text: '接收DUST', status: 'finish' }
        ]
      default:
        return []
    }
  }

  return (
    <Card
      className={`maker-contact-card ${className || ''}`}
      title={
        <div className="card-title">
          <UserOutlined style={{ marginRight: '8px', color: '#5DBAAA' }} />
          联系做市商完成交易
        </div>
      }
      extra={
        <Badge
          count={orderStatus === 'created' ? '待联系' : orderStatus === 'completed' ? '已完成' : ''}
          color={orderStatus === 'created' ? '#f50' : orderStatus === 'completed' ? '#52c41a' : '#d9d9d9'}
        />
      }
    >
      {/* 做市商基本信息 */}
      <div className="maker-info-section">
        <div className="maker-header">
          <Avatar
            size={48}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#5DBAAA' }}
          />
          <div className="maker-details">
            <div className="maker-id">
              <Text strong>做市商 #{selectedMaker.mmId}</Text>
              {getMakerStatusTag()}
            </div>
            <div className="maker-address">
              <Text type="secondary">
                {selectedMaker.owner.substring(0, 8)}...{selectedMaker.owner.substring(selectedMaker.owner.length - 6)}
              </Text>
            </div>
            <div className="maker-stats">
              <Space split={<Divider type="vertical" />}>
                <span>
                  <StarOutlined style={{ color: '#faad14' }} />
                  <Text style={{ marginLeft: '4px' }}>信用优良</Text>
                </span>
                <span>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text style={{ marginLeft: '4px' }}>已认证</Text>
                </span>
              </Space>
            </div>
          </div>
        </div>

        {/* 价格信息 */}
        <div className="price-info-compact">
          <div className="price-item">
            <Text type="secondary">溢价率:</Text>
            <Text strong style={{ color: selectedMaker.sellPremiumBps > 0 ? '#f5222d' : '#52c41a' }}>
              {selectedMaker.sellPremiumBps > 0 ? '+' : ''}{(selectedMaker.sellPremiumBps / 100).toFixed(2)}%
            </Text>
          </div>
          <div className="price-item">
            <Text type="secondary">最小额度:</Text>
            <Text strong>
              {(Number(BigInt(selectedMaker.minAmount) / BigInt(1e12))).toFixed(0)} DUST
            </Text>
          </div>
        </div>
      </div>

      {/* 联系方式区域 */}
      <div className="contact-section">
        <div className="contact-title">
          <MessageOutlined style={{ marginRight: '8px', color: '#5DBAAA' }} />
          <Text strong>联系方式</Text>
        </div>

        <div className="contact-buttons">
          <Button
            type="primary"
            icon={<MessageOutlined />}
            loading={chatLoading}
            onClick={handleOpenChat}
            className="chat-button"
            size="large"
          >
            开始聊天
          </Button>

          <Button
            ghost
            icon={<PhoneOutlined />}
            onClick={handleShowContact}
            className="contact-button"
          >
            查看联系方式
          </Button>
        </div>
      </div>

      {/* 交易流程提示 */}
      {showFullInfo && (
        <div className="trade-flow-section">
          <div className="flow-title">
            <Text strong>📋 交易流程</Text>
          </div>
          <div className="flow-steps">
            {getTradeSteps().map((item, index) => (
              <div
                key={index}
                className={`flow-step ${item.status}`}
              >
                <div className="step-number">{item.step}</div>
                <div className="step-text">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 安全提示 */}
      <Alert
        message="🛡️ 安全提醒"
        description="请通过官方聊天功能与做市商沟通，确认收款信息后再进行转账。切勿私下交易或透露钱包私钥。"
        type="info"
        showIcon
        className="security-tip"
      />

      {/* 联系方式详情模态框 */}
      <Modal
        title="做市商联系方式"
        open={contactVisible}
        onCancel={() => setContactVisible(false)}
        footer={null}
        width={400}
      >
        <div className="contact-modal-content">
          <Alert
            message="优先推荐使用聊天功能"
            description="为了保障交易安全和留下沟通记录，建议优先使用平台聊天功能与做市商沟通。"
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          <div className="contact-methods">
            <div className="contact-method">
              <MessageOutlined style={{ color: '#5DBAAA' }} />
              <span>平台聊天（推荐）</span>
              <Button size="small" type="primary" onClick={handleOpenChat}>
                立即开始
              </Button>
            </div>

            <Divider />

            <div className="contact-method">
              <WechatOutlined style={{ color: '#7bb32e' }} />
              <span>微信号</span>
              <Text type="secondary">需做市商主动提供</Text>
            </div>

            <div className="contact-method">
              <QqOutlined style={{ color: '#1890ff' }} />
              <span>QQ号</span>
              <Text type="secondary">需做市商主动提供</Text>
            </div>
          </div>

          <Alert
            message="🔍 如何获取联系方式"
            description="创建订单后，做市商会在聊天中主动提供其他联系方式。请耐心等待或主动发起聊天询问。"
            type="info"
            showIcon
            style={{ marginTop: '16px' }}
          />
        </div>
      </Modal>
    </Card>
  )
}

export default MakerContactCard