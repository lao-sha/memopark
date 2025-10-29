import React from 'react'
import { Card, List, Button, Typography, Spin, Alert, Space, Tag, Modal, message, Empty, Descriptions, Divider } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, DollarOutlined, UserOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { formatTimestamp, formatRelativeTime, isExpired, getRemainingHours, formatRemainingTime } from '../../utils/timeFormat'
import { parseChainUsdt, usdtToCny, formatCny, calculateTotalUsdt, calculateTotalCny } from '../../utils/currencyConverter'

const { Text, Title } = Typography

/**
 * 函数级详细中文注释：订单状态类型
 * - 与链上 OrderState 枚举保持一致
 */
type OrderState = 'Created' | 'PaidOrCommitted' | 'Released' | 'Refunded' | 'Canceled' | 'Disputed' | 'Closed'

/**
 * 函数级详细中文注释：订单数据接口
 */
interface OrderData {
  id: number
  listingId: number
  maker: string
  taker: string
  price: string
  qty: string
  amount: string
  state: OrderState
  createdAt: number
  expireAt: number
  paymentCommit: string
  contactCommit: string
  evidenceUntil?: number
}

/**
 * 函数级详细中文注释：卖家释放DUST页面组件
 * 
 * 功能说明：
 * 1. 显示所有需要处理的订单（当前用户是卖家且状态为 PaidOrCommitted）
 * 2. 提供"释放DUST"按钮，让卖家确认收到法币后释放DUST给买家
 * 3. 显示订单详情，包括买家地址、购买数量、金额等
 * 4. 实时刷新订单状态
 * 
 * UI风格：
 * - 与项目整体风格保持一致
 * - 使用渐变背景
 * - 友好的视觉反馈
 */
export const SellerReleasePage: React.FC = () => {
  /**
   * 函数级中文注释：获取当前钱包状态
   */
  const { current: currentAccount, password } = useWallet()
  
  /**
   * 函数级中文注释：组件状态
   */
  const [orders, setOrders] = React.useState<OrderData[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [currentBlock, setCurrentBlock] = React.useState<number>(0)
  const [releasingOrderId, setReleasingOrderId] = React.useState<number | null>(null)
  const [selectedOrder, setSelectedOrder] = React.useState<OrderData | null>(null)
  const [showDetailModal, setShowDetailModal] = React.useState<boolean>(false)

  /**
   * 函数级中文注释：加载当前区块高度
   * - 用于判断订单是否过期
   */
  React.useEffect(() => {
    const loadBlockNumber = async () => {
      try {
        const api = await getApi()
        const header = await api.rpc.chain.getHeader()
        setCurrentBlock(header.number.toNumber())
      } catch (e) {
        console.error('❌ 加载区块高度失败:', e)
      }
    }
    loadBlockNumber()
    
    // 每10秒更新一次
    const interval = setInterval(loadBlockNumber, 10000)
    return () => clearInterval(interval)
  }, [])

  /**
   * 函数级中文注释：从链上加载待处理的订单
   * - 查询 otcOrder.orders 存储
   * - 过滤出当前用户是卖家（maker）且状态为 PaidOrCommitted 的订单
   * - 按创建时间倒序排列
   */
  const loadOrders = React.useCallback(async () => {
    if (!currentAccount) {
      setOrders([])
      return
    }

    try {
      setLoading(true)
      setError('')
      
      console.log('📊 查询待处理订单...')
      console.log('  当前卖家账户:', currentAccount)
      
      const api = await getApi()
      
      // 查询所有订单
      const ordersEntries = await api.query.trading.orders.entries()
      
      console.log(`📊 查询到订单条目数: ${ordersEntries.length}`)
      
      if (ordersEntries.length === 0) {
        setOrders([])
        setLoading(false)
        return
      }
      
      // 解析并过滤订单
      const loadedOrders: OrderData[] = []
      
      for (const [key, value] of ordersEntries) {
        const orderId = key.args[0].toNumber()
        const orderData = value.toJSON() as any
        
        console.log(`\n📋 订单 #${orderId}:`)
        console.log('  maker:', orderData.maker)
        console.log('  taker:', orderData.taker)
        console.log('  状态:', orderData.state)
        
        // 只显示当前用户是卖家（maker）且状态为 PaidOrCommitted 的订单
        const makerAddress = String(orderData.maker || '').toLowerCase()
        const currentAddr = String(currentAccount || '').toLowerCase()
        const isPaidOrCommitted = orderData.state === 'PaidOrCommitted'
        
        if (makerAddress === currentAddr && isPaidOrCommitted) {
          console.log('  ✅ 这是待处理的订单（您是卖家，买家已支付）')
          
          loadedOrders.push({
            id: orderId,
            listingId: orderData.listingId,
            maker: orderData.maker,
            taker: orderData.taker,
            price: orderData.price,
            qty: orderData.qty,
            amount: orderData.amount,
            state: orderData.state,
            createdAt: orderData.createdAt,
            expireAt: orderData.expireAt,
            paymentCommit: orderData.paymentCommit,
            contactCommit: orderData.contactCommit,
            evidenceUntil: orderData.evidenceUntil
          })
        }
      }
      
      // 按创建时间倒序排序
      loadedOrders.sort((a, b) => b.createdAt - a.createdAt)
      
      setOrders(loadedOrders)
      console.log(`✅ 最终加载到 ${loadedOrders.length} 个待处理订单`)
      
    } catch (e: any) {
      console.error('❌ 加载订单失败:', e)
      setError(e.message || '加载订单失败')
    } finally {
      setLoading(false)
    }
  }, [currentAccount])

  /**
   * 函数级中文注释：在账户变化或组件挂载时加载订单
   */
  React.useEffect(() => {
    loadOrders()
  }, [loadOrders])

  /**
   * 函数级中文注释：格式化余额显示
   * - 将最小单位转换为 DUST
   */
  const formatBalance = (balance: string): string => {
    try {
      const bn = BigInt(balance)
      const memo = Number(bn) / 1e12
      return memo.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4
      })
    } catch {
      return '0'
    }
  }

  /**
   * 函数级中文注释：获取订单状态显示
   */
  const getOrderStateDisplay = (state: OrderState) => {
    switch (state) {
      case 'Created':
        return { text: '等待支付', color: 'default', icon: <ClockCircleOutlined /> }
      case 'PaidOrCommitted':
        return { text: '买家已支付', color: 'processing', icon: <ExclamationCircleOutlined /> }
      case 'Released':
        return { text: '已完成', color: 'success', icon: <CheckCircleOutlined /> }
      case 'Refunded':
        return { text: '已退款', color: 'warning', icon: <ExclamationCircleOutlined /> }
      case 'Disputed':
        return { text: '争议中', color: 'error', icon: <ExclamationCircleOutlined /> }
      default:
        return { text: state, color: 'default', icon: null }
    }
  }

  /**
   * 函数级中文注释：释放DUST给买家
   * - 调用 otcOrder.release 方法
   * - 从挂单托管中转账给买家
   * - 更新订单状态为 Released
   */
  const handleRelease = async (order: OrderData) => {
    if (!currentAccount || !password) {
      message.error('请先解锁钱包')
      return
    }

    Modal.confirm({
      title: '确认释放DUST',
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>您确认要释放 DUST 给买家吗？</Text>
          <Divider style={{ margin: '12px 0' }} />
          <Descriptions column={1} size="small">
            <Descriptions.Item label="订单 ID">#{order.id}</Descriptions.Item>
            <Descriptions.Item label="买家地址">{order.taker}</Descriptions.Item>
            <Descriptions.Item label="数量">{formatBalance(order.qty)} DUST</Descriptions.Item>
            <Descriptions.Item label="USDT单价">
              <Tag color="blue">{parseChainUsdt(order.price).toFixed(4)} USDT</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="人民币单价">
              <Tag color="green">¥{usdtToCny(parseChainUsdt(order.price)).toFixed(2)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="USDT总价">
              <Text strong style={{ color: '#1890ff' }}>
                {calculateTotalUsdt(order.price, Number(BigInt(order.qty) / BigInt(1e12))).toFixed(2)} USDT
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="人民币总价">
              <Text strong style={{ color: '#52c41a', fontSize: '15px' }}>
                ¥{calculateTotalCny(order.price, Number(BigInt(order.qty) / BigInt(1e12))).toFixed(2)}
              </Text>
            </Descriptions.Item>
          </Descriptions>
          <Divider style={{ margin: '12px 0' }} />
          <Alert
            message="重要提示"
            description="释放后，MEMO将从托管账户转移给买家，此操作不可撤销。请确保您已收到买家的法币支付。"
            type="warning"
            showIcon
          />
        </Space>
      ),
      okText: '确认释放',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setReleasingOrderId(order.id)
          
          console.log('📤 提交释放交易...')
          console.log('  订单 ID:', order.id)
          
          const api = await getApi()
          
          // 调用 releaseMemo 方法（🆕 pallet-trading）
          const tx = api.tx.trading.releaseMemo(order.id)
          
          console.log('🔐 使用本地密码签名并发送交易...')
          
          await signAndSendLocalWithPassword(
            tx,
            currentAccount,
            password,
            (result) => {
              console.log(`📡 交易状态: ${result.status.type}`)
            }
          )
          
          console.log('✅ 释放成功！')
          message.success('释放成功！MEMO已转给买家')
          
          // 延迟刷新订单列表
          setTimeout(() => {
            loadOrders()
          }, 2000)
          
        } catch (e: any) {
          console.error('❌ 释放失败:', e)
          message.error(e.message || '释放失败，请重试')
        } finally {
          setReleasingOrderId(null)
        }
      }
    })
  }

  /**
   * 函数级中文注释：显示订单详情弹窗
   */
  const showOrderDetail = (order: OrderData) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
  }

  /**
   * 函数级中文注释：判断订单是否过期（使用Unix时间戳判断）
   * @param expireAt - 过期时间戳（毫秒）
   * @returns 是否已过期
   */
  const isOrderExpired = (expireAt: number): boolean => {
    return expireAt > 0 && isExpired(expireAt)
  }

  /**
   * 函数级中文注释：渲染订单列表项
   */
  const renderOrderItem = (order: OrderData) => {
    const stateDisplay = getOrderStateDisplay(order.state)
    const expired = isOrderExpired(order.expireAt)
    const qtyFormatted = formatBalance(order.qty)
    const amountFormatted = formatBalance(order.amount)
    
    // 计算剩余时间（用于超时提醒）
    const remainingHours = getRemainingHours(order.expireAt)
    
    return (
      <List.Item
        key={order.id}
        actions={[
          <Button
            type="primary"
            onClick={() => showOrderDetail(order)}
            size="small"
          >
            查看详情
          </Button>,
          <Button
            type="primary"
            danger
            onClick={() => handleRelease(order)}
            loading={releasingOrderId === order.id}
            disabled={expired || releasingOrderId !== null}
            icon={<CheckCircleOutlined />}
          >
            {expired ? '已过期' : '释放DUST'}
          </Button>
        ]}
      >
        <List.Item.Meta
          avatar={<DollarOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
          title={
            <Space>
              <Text strong>订单 #{order.id}</Text>
              <Tag color={stateDisplay.color} icon={stateDisplay.icon}>
                {stateDisplay.text}
              </Tag>
              {expired && <Tag color="error">已过期</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space>
                <UserOutlined />
                <Text type="secondary">买家:</Text>
                <Text code>{order.taker.substring(0, 10)}...{order.taker.substring(order.taker.length - 8)}</Text>
              </Space>
              <Space>
                <Text type="secondary">数量:</Text>
                <Text strong style={{ color: '#52c41a' }}>{qtyFormatted} DUST</Text>
              </Space>
              <Space>
                <Text type="secondary">金额:</Text>
                <Text strong>{amountFormatted}</Text>
              </Space>
              <Space size="large" style={{ width: '100%' }}>
                <Space size="small">
                  <ClockCircleOutlined />
                  <Text type="secondary">创建时间:</Text>
                  <Text>{formatTimestamp(order.createdAt)}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: '11px', color: '#999' }}>
                  ({formatRelativeTime(order.createdAt)})
                </Text>
              </Space>
              <Space size="small">
                <ExclamationCircleOutlined style={{ color: expired ? '#ff4d4f' : remainingHours < 6 ? '#faad14' : '#52c41a' }} />
                <Text type="secondary">超时时间:</Text>
                <Text>{formatTimestamp(order.expireAt)}</Text>
                <Tag 
                  color={expired ? 'red' : remainingHours < 6 ? 'orange' : 'green'}
                  style={{ fontSize: '11px', padding: '0 8px' }}
                >
                  {formatRemainingTime(order.expireAt)}
                </Tag>
              </Space>
            </Space>
          }
        />
      </List.Item>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 页面标题 */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)'
          }}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Title level={2} style={{ margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              释放MEMO给买家
            </Title>
            <Text type="secondary">
              买家已完成法币支付后，您需要在此页面释放MEMO给买家
            </Text>
            {currentAccount && (
              <Space>
                <Text type="secondary">当前账户:</Text>
                <Text code>{currentAccount}</Text>
              </Space>
            )}
          </Space>
        </Card>

        {/* 订单列表卡片 */}
        <Card
          title={
            <Space>
              <ExclamationCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Text strong>待处理订单</Text>
              <Tag color="processing">{orders.length}</Tag>
            </Space>
          }
          extra={
            <Button onClick={loadOrders} loading={loading}>
              刷新
            </Button>
          }
          style={{
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }}
        >
          {!currentAccount && (
            <Alert
              message="请先解锁钱包"
              description="您需要解锁钱包才能查看和处理订单"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {error && (
            <Alert
              message="加载失败"
              description={error}
              type="error"
              closable
              onClose={() => setError('')}
              style={{ marginBottom: 16 }}
            />
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">正在加载订单...</Text>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <Empty
              description="暂无待处理订单"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Text type="secondary">
                当前没有需要处理的订单。买家支付后，订单会出现在这里。
              </Text>
            </Empty>
          ) : (
            <List
              dataSource={orders}
              renderItem={renderOrderItem}
              pagination={orders.length > 5 ? {
                pageSize: 5,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 个订单`
              } : false}
            />
          )}
        </Card>

        {/* 帮助提示 */}
        <Card
          style={{
            marginTop: 24,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
          }}
        >
          <Alert
            message="操作说明"
            description={
              <Space direction="vertical" size={8}>
                <Text>1. 买家创建订单后，会转入"等待支付"状态</Text>
                <Text>2. 买家完成法币支付并标记"已支付"后，订单会出现在此页面</Text>
                <Text>3. 请确认收到买家的法币支付后，点击"释放DUST"按钮</Text>
                <Text>4. 释放后，MEMO会从托管账户自动转给买家，订单完成</Text>
                <Text strong type="warning">⚠️ 释放前请务必确认已收到法币，释放操作不可撤销</Text>
              </Space>
            }
            type="info"
            showIcon
          />
        </Card>
      </div>

      {/* 订单详情弹窗 */}
      <Modal
        title={`订单详情 #${selectedOrder?.id}`}
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>
            关闭
          </Button>,
          selectedOrder && (
            <Button
              key="release"
              type="primary"
              danger
              onClick={() => {
                setShowDetailModal(false)
                handleRelease(selectedOrder)
              }}
              loading={releasingOrderId === selectedOrder.id}
              disabled={isOrderExpired(selectedOrder.expireAt)}
              icon={<CheckCircleOutlined />}
            >
              释放MEMO
            </Button>
          )
        ]}
        width={600}
      >
        {selectedOrder && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="订单 ID">#{selectedOrder.id}</Descriptions.Item>
            <Descriptions.Item label="挂单 ID">#{selectedOrder.listingId}</Descriptions.Item>
            <Descriptions.Item label="买家地址">
              <Text code>{selectedOrder.taker}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="卖家地址（您）">
              <Text code>{selectedOrder.maker}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="购买数量">
              <Text strong style={{ color: '#52c41a' }}>
                {formatBalance(selectedOrder.qty)} DUST
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="USDT单价">
              <Tag color="blue">{parseChainUsdt(selectedOrder.price).toFixed(4)} USDT</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="人民币单价">
              <Tag color="green">¥{usdtToCny(parseChainUsdt(selectedOrder.price)).toFixed(2)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="USDT总价">
              <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                {calculateTotalUsdt(selectedOrder.price, Number(BigInt(selectedOrder.qty) / BigInt(1e12))).toFixed(2)} USDT
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="人民币总价">
              <Text strong style={{ color: '#52c41a', fontSize: '15px' }}>
                ¥{calculateTotalCny(selectedOrder.price, Number(BigInt(selectedOrder.qty) / BigInt(1e12))).toFixed(2)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="订单状态">
              <Tag color={getOrderStateDisplay(selectedOrder.state).color}>
                {getOrderStateDisplay(selectedOrder.state).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建区块">
              #{selectedOrder.createdAt}
            </Descriptions.Item>
            <Descriptions.Item label="过期区块">
              #{selectedOrder.expireAt}
              {isOrderExpired(selectedOrder.expireAt) && (
                <Tag color="error" style={{ marginLeft: 8 }}>已过期</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="支付承诺">
              <Text code style={{ fontSize: 11 }}>{selectedOrder.paymentCommit}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="联系方式">
              <Text code style={{ fontSize: 11 }}>{selectedOrder.contactCommit}</Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default SellerReleasePage

