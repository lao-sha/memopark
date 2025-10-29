import React from 'react'
import { Card, List, Tag, Typography, Spin, Alert, Space, Button, message, Empty } from 'antd'
import { ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ShoppingOutlined, CloseCircleOutlined, MessageOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useWallet } from '../../providers/WalletProvider'
import { formatTimestamp, formatRelativeTime, isExpired as isTimestampExpired, formatRemainingTime } from '../../utils/timeFormat'
import { parseChainUsdt, usdtToCny, formatCny, calculateTotalUsdt, calculateTotalCny } from '../../utils/currencyConverter'
import { getOrCreateChatSession } from '../../lib/chat'  // 🆕 2025-10-22：聊天功能集成

const { Text, Title } = Typography

/**
 * 函数级详细中文注释：订单状态接口
 * - 订单的各种状态枚举（与链上 OrderState 保持一致）
 * - Created: 已创建（等待支付）
 * - PaidOrCommitted: 已支付/已承诺（等待做市商确认）
 * - Released: 已完成（做市商已释放资金）
 * - Refunded: 已退款
 * - Canceled: 已取消
 * - Disputed: 争议中（需要仲裁）
 * - Closed: 已关闭
 */
type OrderState = 'Created' | 'PaidOrCommitted' | 'Released' | 'Refunded' | 'Canceled' | 'Disputed' | 'Closed'

/**
 * 函数级详细中文注释：订单数据接口
 * - 包含订单的完整信息
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
}

/**
 * 函数级详细中文注释：我的订单卡片组件
 * - 直接从链上查询当前账户的所有订单
 * - 显示订单列表，包含状态、金额、时间等信息
 * - 提供订单操作入口（查看详情、标记已付等）
 * - UI风格与欢迎页、创建钱包页保持一致
 */
export const MyOrdersCard: React.FC = () => {
  /**
   * 函数级中文注释：获取当前钱包账户
   */
  const { current: currentAccount } = useWallet()
  
  /**
   * 函数级中文注释：订单列表状态
   */
  const [orders, setOrders] = React.useState<OrderData[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string>('')
  const [currentBlock, setCurrentBlock] = React.useState<number>(0)

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
        console.error('加载区块高度失败:', e)
      }
    }
    loadBlockNumber()
    
    // 每10秒更新一次
    const interval = setInterval(loadBlockNumber, 10000)
    return () => clearInterval(interval)
  }, [])

  /**
   * 函数级中文注释：从链上加载当前用户的订单列表
   * - 查询 otcOrder.orders 存储
   * - 过滤出当前用户作为 taker 的订单
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
      
      const api = await getApi()
      
      // 检查 pallet 是否存在
      if (!(api.query as any).otcOrder) {
        setError('OTC 订单模块尚未在链上注册')
        setLoading(false)
        return
      }

      // 查询所有订单
      const entries = await (api.query as any).otcOrder.orders.entries()
      
      console.log('📊 查询到订单条目数:', entries.length)
      
      // 解析并过滤当前用户的订单
      const myOrders: OrderData[] = []
      for (const [key, value] of entries) {
        if (value.isSome) {
          const order = value.unwrap()
          const orderData = order.toJSON() as any
          const orderId = key.args[0].toNumber()
          
          console.log(`📦 订单 #${orderId}:`, {
            taker: orderData.taker,
            currentAccount,
            state: orderData.state,
            listingId: orderData.listingId
          })
          
          // 显示当前用户作为买方或卖方的订单
          // 处理不同的地址格式（SS58 vs 原始）
          const takerAddress = String(orderData.taker || '').toLowerCase()
          const makerAddress = String(orderData.maker || '').toLowerCase()
          const currentAddr = String(currentAccount || '').toLowerCase()
          
          // 如果当前用户是买方(taker)或卖方(maker)，则显示该订单
          if (takerAddress === currentAddr || makerAddress === currentAddr) {
            // 处理状态枚举：可能是对象或字符串
            let stateStr = 'Created'
            if (typeof orderData.state === 'string') {
              stateStr = orderData.state
            } else if (orderData.state && typeof orderData.state === 'object') {
              // 枚举可能以对象形式返回，如 { paidOrCommitted: null }
              const keys = Object.keys(orderData.state)
              if (keys.length > 0) {
                // 转换为 PascalCase
                stateStr = keys[0].charAt(0).toUpperCase() + keys[0].slice(1)
                // 转换驼峰命名：paidOrCommitted -> PaidOrCommitted
                stateStr = stateStr.replace(/([a-z])([A-Z])/g, '$1$2')
              }
            }
            
            myOrders.push({
              id: orderId,
              listingId: orderData.listingId || 0,
              maker: orderData.maker || '',
              taker: orderData.taker || '',
              price: orderData.price || '0',
              qty: orderData.qty || '0',
              amount: orderData.amount || '0',
              state: stateStr as OrderState,
              createdAt: orderData.createdAt || 0,
              expireAt: orderData.expireAt || 0,
              paymentCommit: orderData.paymentCommit || '',
              contactCommit: orderData.contactCommit || ''
            })
            
            console.log(`✅ 添加订单 #${orderId} 到列表`)
          }
        }
      }
      
      // 按创建时间倒序排列（最新的在前）
      myOrders.sort((a, b) => b.createdAt - a.createdAt)
      
      setOrders(myOrders)
      
      console.log('✅ 最终加载到', myOrders.length, '个我的订单')
    } catch (e: any) {
      console.error('加载订单列表失败:', e)
      setError(e?.message || '加载订单列表失败')
    } finally {
      setLoading(false)
    }
  }, [currentAccount])

  /**
   * 函数级中文注释：页面加载时自动查询订单
   */
  React.useEffect(() => {
    loadOrders()
  }, [loadOrders])

  /**
   * 函数级中文注释：获取订单状态的显示配置
   * - 返回状态的颜色、图标、文本
   * - 状态与链上 OrderState 枚举保持一致
   */
  const getStateDisplay = (state: OrderState | string) => {
    const stateMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      'Created': { 
        color: 'blue', 
        icon: <ClockCircleOutlined />, 
        text: '已创建' 
      },
      'PaidOrCommitted': { 
        color: 'processing', 
        icon: <ClockCircleOutlined />, 
        text: '已支付/已承诺' 
      },
      'Released': { 
        color: 'success', 
        icon: <CheckCircleOutlined />, 
        text: '已完成' 
      },
      'Refunded': { 
        color: 'default', 
        icon: <ExclamationCircleOutlined />, 
        text: '已退款' 
      },
      'Canceled': { 
        color: 'default', 
        icon: <CloseCircleOutlined />, 
        text: '已取消' 
      },
      'Disputed': { 
        color: 'error', 
        icon: <ExclamationCircleOutlined />, 
        text: '争议中' 
      },
      'Closed': { 
        color: 'default', 
        icon: <CheckCircleOutlined />, 
        text: '已关闭' 
      }
    }
    
    return stateMap[state] || { color: 'default', icon: null, text: String(state) }
  }

  /**
   * 函数级中文注释：判断订单是否过期（使用Unix时间戳判断）
   * @param expireAt - 过期时间戳（毫秒）
   * @returns 是否已过期
   */
  const isExpired = (expireAt: number) => {
    return expireAt > 0 && isTimestampExpired(expireAt)
  }

  /**
   * 函数级中文注释：处理查看订单详情
   */
  const handleViewDetail = (orderId: number) => {
    // 跳转到订单详情页
    window.location.hash = `#/otc/order/${orderId}`
    message.info(`跳转到订单 #${orderId} 详情页`)
  }

  /**
   * 函数级中文注释：没有连接钱包时的提示
   */
  if (!currentAccount) {
    return (
      <Card
        style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <Alert
          type="info"
          showIcon
          icon={<ShoppingOutlined />}
          message="请先连接钱包"
          description="连接钱包后即可查看您的订单列表"
        />
      </Card>
    )
  }

  return (
    <Card
      title={
        <Space>
          <ShoppingOutlined style={{ color: '#667eea' }} />
          <Text strong style={{ fontSize: '16px', color: '#667eea' }}>
            我的订单
          </Text>
        </Space>
      }
      extra={
        <Button 
          size="small" 
          onClick={loadOrders}
          loading={loading}
        >
          刷新
        </Button>
      }
      style={{
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="加载订单列表中..." />
        </div>
      ) : error ? (
        <Alert 
          type="warning" 
          showIcon 
          message="加载失败" 
          description={error}
        />
      ) : orders.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">暂无订单</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                创建订单后将在这里显示
              </Text>
            </Space>
          }
        />
      ) : (
        <List
          dataSource={orders}
          pagination={orders.length > 5 ? { pageSize: 5, size: 'small' } : false}
          renderItem={(order) => {
            const stateDisplay = getStateDisplay(order.state)
            const expired = isExpired(order.expireAt)
            
            // 判断当前用户的角色
            const isMaker = order.maker.toLowerCase() === currentAccount?.toLowerCase()
            const isTaker = order.taker.toLowerCase() === currentAccount?.toLowerCase()
            
            return (
              <List.Item
                key={order.id}
                actions={[
                  <Button 
                    key="view" 
                    type="link" 
                    size="small"
                    onClick={() => handleViewDetail(order.id)}
                  >
                    查看详情
                  </Button>,
                  // 🆕 2025-10-22：联系做市商按钮（仅买方可见）
                  ...(isTaker ? [
                    <Button
                      key="chat"
                      type="link"
                      size="small"
                      icon={<MessageOutlined />}
                      onClick={async () => {
                        try {
                          const sessionId = await getOrCreateChatSession(
                            currentAccount!,
                            order.maker
                          )
                          window.location.hash = `#/chat/${sessionId}`
                          message.success('正在打开聊天窗口...')
                        } catch (error) {
                          console.error('打开聊天失败:', error)
                          message.error('打开聊天失败，请稍后重试')
                        }
                      }}
                    >
                      联系做市商
                    </Button>
                  ] : [])
                ]}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>订单 #{order.id}</Text>
                      {isMaker && (
                        <Tag color="purple">我是卖方</Tag>
                      )}
                      {isTaker && (
                        <Tag color="cyan">我是买方</Tag>
                      )}
                      <Tag color={stateDisplay.color} icon={stateDisplay.icon}>
                        {stateDisplay.text}
                      </Tag>
                      {expired && order.state === 'Created' && (
                        <Tag color="red">已过期</Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Space size="large" wrap>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          挂单: <Text strong>#{order.listingId}</Text>
                        </Text>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          数量: <Text strong>{(Number(BigInt(order.qty) / BigInt(1e12))).toFixed(4)} DUST</Text>
                        </Text>
                      </Space>
                      
                      {/* 价格信息 */}
                      <Space size="large" wrap>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          USDT单价: <Tag color="blue">{parseChainUsdt(order.price).toFixed(4)} USDT</Tag>
                        </Text>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          人民币单价: <Tag color="green">¥{usdtToCny(parseChainUsdt(order.price)).toFixed(2)}</Tag>
                        </Text>
                      </Space>
                      
                      {/* 总金额 */}
                      <Space size="large" wrap>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          USDT总价: <Text strong style={{ color: '#1890ff' }}>
                            {calculateTotalUsdt(order.price, Number(BigInt(order.qty) / BigInt(1e12))).toFixed(2)} USDT
                          </Text>
                        </Text>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          人民币总价: <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                            ¥{calculateTotalCny(order.price, Number(BigInt(order.qty) / BigInt(1e12))).toFixed(2)}
                          </Text>
                        </Text>
                      </Space>
                      
                      <Space size="large" style={{ width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          创建时间: {order.createdAt > 0 
                            ? formatTimestamp(order.createdAt)
                            : '未知'}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px', color: '#999' }}>
                          ({order.createdAt > 0 ? formatRelativeTime(order.createdAt) : '-'})
                        </Text>
                      </Space>
                      {order.expireAt > 0 && (
                        <Space size="small">
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            超时时间: {formatTimestamp(order.expireAt)}
                          </Text>
                          <Tag 
                            color={expired ? 'red' : 'green'} 
                            style={{ fontSize: '11px', padding: '0 8px' }}
                          >
                            {formatRemainingTime(order.expireAt)}
                          </Tag>
                        </Space>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}

export default MyOrdersCard

