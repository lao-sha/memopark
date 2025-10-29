/**
 * OTC订单卡片组件
 * 
 * 功能说明：
 * 1. 展示OTC订单的完整信息
 * 2. 显示订单状态和进度
 * 3. 根据用户角色显示不同操作
 * 4. 支持买家标记已付款
 * 5. 支持做市商释放MEMO
 * 6. 支持取消订单和发起争议
 * 
 * 创建日期：2025-10-28
 */

import React, { useState } from 'react'
import { Card, Space, Typography, Tag, Button, Steps, Tooltip, message, Modal, Input } from 'antd'
import { 
  DollarOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createTradingService, 
  type Order,
  OrderState,
} from '../../services/tradingService'

const { Text, Title } = Typography

interface OTCOrderCardProps {
  /** 订单信息 */
  order: Order
  /** 当前用户地址 */
  currentAccount?: string
  /** 刷新回调 */
  onRefresh?: () => void
  /** 是否显示详细信息 */
  detailed?: boolean
}

/**
 * 函数级详细中文注释：订单状态配置
 */
const stateConfig = {
  [OrderState.Created]: { 
    label: '已创建', 
    color: 'blue',
    icon: <ClockCircleOutlined />,
    step: 0,
  },
  [OrderState.PaidOrCommitted]: { 
    label: '已付款', 
    color: 'processing',
    icon: <DollarOutlined />,
    step: 1,
  },
  [OrderState.Released]: { 
    label: '已完成', 
    color: 'success',
    icon: <CheckCircleOutlined />,
    step: 2,
  },
  [OrderState.Disputed]: { 
    label: '争议中', 
    color: 'warning',
    icon: <WarningOutlined />,
    step: 1,
  },
  [OrderState.Arbitrating]: { 
    label: '仲裁中', 
    color: 'warning',
    icon: <WarningOutlined />,
    step: 1,
  },
  [OrderState.Canceled]: { 
    label: '已取消', 
    color: 'default',
    icon: <CloseCircleOutlined />,
    step: 0,
  },
  [OrderState.Refunded]: { 
    label: '已退款', 
    color: 'default',
    icon: <CloseCircleOutlined />,
    step: 0,
  },
  [OrderState.Closed]: { 
    label: '已关闭', 
    color: 'default',
    icon: <CloseCircleOutlined />,
    step: 2,
  },
}

/**
 * 函数级详细中文注释：格式化MEMO金额
 */
const formatMEMO = (amount: string): string => {
  const memo = BigInt(amount) / BigInt(1_000_000)
  return memo.toLocaleString() + ' MEMO'
}

/**
 * 函数级详细中文注释：格式化USDT金额
 */
const formatUSDT = (amount: number): string => {
  return amount.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + ' USDT'
}

/**
 * 函数级详细中文注释：格式化地址（显示前6后4）
 */
const formatAddress = (address: string): string => {
  if (address.length < 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * 函数级详细中文注释：格式化区块号为相对时间
 */
const formatBlockTime = (blockNumber: number, currentBlock: number): string => {
  const blockDiff = currentBlock - blockNumber
  const minutes = Math.floor(blockDiff * 6 / 60) // 假设6秒/块
  
  if (minutes < 60) {
    return `${minutes} 分钟前`
  } else if (minutes < 1440) {
    return `${Math.floor(minutes / 60)} 小时前`
  } else {
    return `${Math.floor(minutes / 1440)} 天前`
  }
}

/**
 * 函数级详细中文注释：OTC订单卡片组件
 */
export const OTCOrderCard: React.FC<OTCOrderCardProps> = ({ 
  order, 
  currentAccount,
  onRefresh,
  detailed = true,
}) => {
  const [loading, setLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentCommit, setPaymentCommit] = useState('')

  const stateInfo = stateConfig[order.state]
  const isBuyer = currentAccount === order.taker
  const isMaker = currentAccount === order.maker

  /**
   * 函数级详细中文注释：买家标记已付款
   */
  const handleMarkPaid = async () => {
    if (!paymentCommit.trim()) {
      message.error('请输入付款凭证哈希')
      return
    }

    setLoading(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      const tx = service.buildMarkPaidTx({
        orderId: order.id,
        paymentCommit: paymentCommit.trim(),
      })

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(currentAccount!)

      await tx.signAndSend(
        currentAccount!,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isFinalized) {
            message.success('标记成功！')
            setShowPaymentModal(false)
            setPaymentCommit('')
            onRefresh?.()
          }
        }
      )
    } catch (error: any) {
      message.error(error.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：做市商释放MEMO
   */
  const handleRelease = async () => {
    Modal.confirm({
      title: '确认释放MEMO',
      icon: <ExclamationCircleOutlined />,
      content: '确认买家已完成付款？释放后无法撤销。',
      okText: '确认释放',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const api = await getApi()
          const service = createTradingService(api)
          
          const tx = service.buildReleaseMemoTx(order.id)

          const { web3FromAddress } = await import('@polkadot/extension-dapp')
          const injector = await web3FromAddress(currentAccount!)

          await tx.signAndSend(
            currentAccount!,
            { signer: injector.signer },
            ({ status }) => {
              if (status.isFinalized) {
                message.success('释放成功！')
                onRefresh?.()
              }
            }
          )
        } catch (error: any) {
          message.error(error.message || '操作失败')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  /**
   * 函数级详细中文注释：取消订单
   */
  const handleCancel = async () => {
    Modal.confirm({
      title: '确认取消订单',
      icon: <ExclamationCircleOutlined />,
      content: '确定要取消此订单吗？',
      okText: '确认取消',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        setLoading(true)
        try {
          const api = await getApi()
          const service = createTradingService(api)
          
          const tx = service.buildCancelOrderTx(order.id)

          const { web3FromAddress } = await import('@polkadot/extension-dapp')
          const injector = await web3FromAddress(currentAccount!)

          await tx.signAndSend(
            currentAccount!,
            { signer: injector.signer },
            ({ status }) => {
              if (status.isFinalized) {
                message.success('取消成功！')
                onRefresh?.()
              }
            }
          )
        } catch (error: any) {
          message.error(error.message || '操作失败')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  /**
   * 函数级详细中文注释：发起争议
   */
  const handleDispute = async () => {
    Modal.confirm({
      title: '发起争议',
      icon: <WarningOutlined />,
      content: '确定要对此订单发起争议吗？这将进入仲裁流程。',
      okText: '确认发起',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const api = await getApi()
          const service = createTradingService(api)
          
          const tx = service.buildDisputeOrderTx(order.id)

          const { web3FromAddress } = await import('@polkadot/extension-dapp')
          const injector = await web3FromAddress(currentAccount!)

          await tx.signAndSend(
            currentAccount!,
            { signer: injector.signer },
            ({ status }) => {
              if (status.isFinalized) {
                message.success('争议已发起！')
                onRefresh?.()
              }
            }
          )
        } catch (error: any) {
          message.error(error.message || '操作失败')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  /**
   * 函数级详细中文注释：渲染操作按钮
   */
  const renderActions = () => {
    if (!currentAccount) return null

    const actions: React.ReactNode[] = []

    // 买家操作
    if (isBuyer) {
      if (order.state === OrderState.Created) {
        actions.push(
          <Button
            key="pay"
            type="primary"
            icon={<DollarOutlined />}
            onClick={() => setShowPaymentModal(true)}
            loading={loading}
          >
            标记已付款
          </Button>
        )
        actions.push(
          <Button
            key="cancel"
            danger
            onClick={handleCancel}
            loading={loading}
          >
            取消订单
          </Button>
        )
      } else if (order.state === OrderState.PaidOrCommitted) {
        actions.push(
          <Button
            key="dispute"
            danger
            icon={<WarningOutlined />}
            onClick={handleDispute}
            loading={loading}
          >
            发起争议
          </Button>
        )
      }
    }

    // 做市商操作
    if (isMaker) {
      if (order.state === OrderState.PaidOrCommitted) {
        actions.push(
          <Button
            key="release"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleRelease}
            loading={loading}
          >
            释放MEMO
          </Button>
        )
        actions.push(
          <Button
            key="dispute"
            danger
            icon={<WarningOutlined />}
            onClick={handleDispute}
            loading={loading}
          >
            发起争议
          </Button>
        )
      } else if (order.state === OrderState.Created) {
        actions.push(
          <Button
            key="cancel"
            danger
            onClick={handleCancel}
            loading={loading}
          >
            取消订单
          </Button>
        )
      }
    }

    return actions.length > 0 ? (
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Space>{actions}</Space>
      </div>
    ) : null
  }

  return (
    <>
      <Card
        style={{ 
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 头部：订单ID和状态 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <SwapOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Title level={5} style={{ margin: 0 }}>
                订单 #{order.id}
              </Title>
              {order.isFirstPurchase && (
                <Tag color="gold">首购</Tag>
              )}
            </Space>
            <Tag 
              color={stateInfo.color} 
              icon={stateInfo.icon}
              style={{ fontSize: 14, padding: '4px 12px' }}
            >
              {stateInfo.label}
            </Tag>
          </div>

          {/* 金额信息 */}
          <div style={{ 
            background: '#f5f5f5', 
            padding: 16, 
            borderRadius: 8,
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">数量：</Text>
                <Text strong style={{ fontSize: 16 }}>
                  {formatMEMO(order.qty)}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">单价：</Text>
                <Text strong style={{ fontSize: 16 }}>
                  {order.price.toFixed(4)} USDT/MEMO
                </Text>
              </div>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px dashed #d9d9d9',
                }}
              >
                <Text strong style={{ fontSize: 16 }}>总金额：</Text>
                <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                  {formatUSDT(order.amount)}
                </Text>
              </div>
            </Space>
          </div>

          {/* 用户信息 */}
          {detailed && (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Space>
                  <UserOutlined style={{ color: '#999' }} />
                  <Text type="secondary">买家：</Text>
                  <Tooltip title={order.taker}>
                    <Text>{formatAddress(order.taker)}</Text>
                  </Tooltip>
                  {isBuyer && <Tag color="green">我</Tag>}
                </Space>
              </div>
              <div>
                <Space>
                  <UserOutlined style={{ color: '#999' }} />
                  <Text type="secondary">做市商：</Text>
                  <Tooltip title={order.maker}>
                    <Text>{formatAddress(order.maker)}</Text>
                  </Tooltip>
                  {isMaker && <Tag color="blue">我</Tag>}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (ID: {order.makerId})
                  </Text>
                </Space>
              </div>
            </Space>
          )}

          {/* 进度条 */}
          {detailed && (
            <Steps
              current={stateInfo.step}
              status={
                order.state === OrderState.Disputed || 
                order.state === OrderState.Arbitrating
                  ? 'error'
                  : order.state === OrderState.Released || order.state === OrderState.Closed
                  ? 'finish'
                  : 'process'
              }
              size="small"
              items={[
                { title: '创建订单' },
                { title: '买家付款' },
                { title: '完成交易' },
              ]}
            />
          )}

          {/* 时间信息 */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
            <Space size="large" wrap>
              <Tooltip title={`区块 #${order.createdAt}`}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined /> 创建于: {order.createdAt.toLocaleString()}
                </Text>
              </Tooltip>
              {order.paidAt && (
                <Tooltip title={`区块 #${order.paidAt}`}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    付款于: {order.paidAt.toLocaleString()}
                  </Text>
                </Tooltip>
              )}
              {order.releasedAt && (
                <Tooltip title={`区块 #${order.releasedAt}`}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    完成于: {order.releasedAt.toLocaleString()}
                  </Text>
                </Tooltip>
              )}
            </Space>
          </div>

          {/* 操作按钮 */}
          {renderActions()}
        </Space>
      </Card>

      {/* 标记已付款弹窗 */}
      <Modal
        title="标记已付款"
        open={showPaymentModal}
        onCancel={() => {
          setShowPaymentModal(false)
          setPaymentCommit('')
        }}
        onOk={handleMarkPaid}
        confirmLoading={loading}
        okText="确认"
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>付款金额：</Text>
            <Text style={{ fontSize: 18, marginLeft: 8, color: '#1890ff' }}>
              {formatUSDT(order.amount)}
            </Text>
          </div>
          <div>
            <Text strong>做市商TRON地址：</Text>
            <Text 
              copyable 
              style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 12 }}
            >
              {order.makerTronAddress}
            </Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              请通过TRON网络向做市商转账，完成后输入付款凭证哈希。
            </Text>
          </div>
          <Input.TextArea
            rows={3}
            placeholder="输入付款凭证哈希（如交易ID或订单号）"
            value={paymentCommit}
            onChange={(e) => setPaymentCommit(e.target.value)}
            maxLength={200}
            showCount
          />
        </Space>
      </Modal>
    </>
  )
}

