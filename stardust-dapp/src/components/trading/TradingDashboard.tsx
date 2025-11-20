/**
 * Trading交易总览仪表板组件
 * 
 * 功能说明：
 * 1. 整合所有Trading相关功能
 * 2. 我的订单列表（含筛选）
 * 3. 做市商列表
 * 4. 跨链桥交易表单
 * 5. 数据统计（订单数、交易额）
 * 6. 快捷操作入口
 * 
 * 创建日期：2025-10-28
 */

import React, { useState, useEffect } from 'react'
import { 
  Tabs, 
  Card, 
  Space, 
  Button, 
  Statistic, 
  Row, 
  Col,
  Typography,
  Empty,
  Spin,
  Badge,
  message,
  Select,
} from 'antd'
import { 
  ShoppingOutlined, 
  SwapOutlined,
  TeamOutlined,
  PlusOutlined,
  ReloadOutlined,
  FilterOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createTradingService, 
  type Order,
  OrderState,
} from '../../services/tradingService'
import { OTCOrderCard } from './OTCOrderCard'
import { CreateOTCOrderModal } from './CreateOTCOrderModal'
import { MarketMakerList } from './MarketMakerList'
import { BridgeTransactionForm } from './BridgeTransactionForm'
import { AITradingPanel } from '../../features/ai-trader/AITradingPanel'

const { Title, Text } = Typography

interface TradingDashboardProps {
  /** 当前账户地址 */
  account: string
}

/**
 * 函数级详细中文注释：Trading总览仪表板组件
 */
export const TradingDashboard: React.FC<TradingDashboardProps> = ({ account }) => {
  const [activeTab, setActiveTab] = useState<string>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // 统计数据
  const [totalOrders, setTotalOrders] = useState(0)
  const [activeOrders, setActiveOrders] = useState(0)
  const [completedOrders, setCompletedOrders] = useState(0)
  const [totalVolume, setTotalVolume] = useState(0)

  // 筛选条件
  const [filterState, setFilterState] = useState<OrderState | undefined>(undefined)
  const [filterRole, setFilterRole] = useState<'buyer' | 'maker' | 'all'>('all')

  /**
   * 函数级详细中文注释：加载订单列表
   */
  const loadOrders = async () => {
    setLoadingOrders(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      // 根据角色筛选
      let allOrders: Order[] = []
      
      if (filterRole === 'buyer' || filterRole === 'all') {
        // 获取买家订单
        const buyerOrders = await service.listOrders({ taker: account })
        allOrders = [...allOrders, ...buyerOrders]
      }
      
      if (filterRole === 'maker' || filterRole === 'all') {
        // 获取做市商订单
        const makerOrders = await service.listOrders({ maker: account })
        allOrders = [...allOrders, ...makerOrders]
      }

      // 按状态筛选
      if (filterState !== undefined) {
        allOrders = allOrders.filter(order => order.state === filterState)
      }

      // 去重（可能同时是买家和卖家）
      const uniqueOrders = Array.from(new Map(allOrders.map(o => [o.id, o])).values())
      
      // 按创建时间倒序排序
      uniqueOrders.sort((a, b) => b.createdAt - a.createdAt)
      
      setOrders(uniqueOrders)
      calculateStats(uniqueOrders)
    } catch (error) {
      console.error('加载订单失败:', error)
      message.error('加载订单列表失败')
    } finally {
      setLoadingOrders(false)
    }
  }

  /**
   * 函数级详细中文注释：计算统计数据
   */
  const calculateStats = (orderList: Order[]) => {
    setTotalOrders(orderList.length)
    
    const active = orderList.filter(o => 
      o.state === OrderState.Created || 
      o.state === OrderState.PaidOrCommitted
    ).length
    setActiveOrders(active)
    
    const completed = orderList.filter(o => 
      o.state === OrderState.Released || 
      o.state === OrderState.Closed
    ).length
    setCompletedOrders(completed)
    
    const volume = orderList
      .filter(o => o.state === OrderState.Released || o.state === OrderState.Closed)
      .reduce((sum, o) => sum + o.amount, 0)
    setTotalVolume(volume)
  }

  /**
   * 函数级详细中文注释：初始加载
   */
  useEffect(() => {
    if (account && activeTab === 'orders') {
      loadOrders()
    }
  }, [account, activeTab, filterState, filterRole])

  /**
   * 函数级详细中文注释：渲染订单Tab
   */
  const renderOrdersTab = () => {
    return (
      <div>
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总订单"
                value={totalOrders}
                suffix="笔"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="进行中"
                value={activeOrders}
                suffix="笔"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已完成"
                value={completedOrders}
                suffix="笔"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="累计交易额"
                value={totalVolume}
                precision={2}
                suffix="USDT"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 操作栏 */}
        <Card style={{ marginBottom: 16 }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateModal(true)}
            >
              创建订单
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={loadOrders}
              loading={loadingOrders}
            >
              刷新
            </Button>

            <Select
              placeholder="筛选状态"
              style={{ width: 150 }}
              allowClear
              value={filterState}
              onChange={setFilterState}
              suffixIcon={<FilterOutlined />}
            >
              <Select.Option value={OrderState.Created}>已创建</Select.Option>
              <Select.Option value={OrderState.PaidOrCommitted}>已付款</Select.Option>
              <Select.Option value={OrderState.Released}>已完成</Select.Option>
              <Select.Option value={OrderState.Disputed}>争议中</Select.Option>
              <Select.Option value={OrderState.Canceled}>已取消</Select.Option>
            </Select>

            <Select
              placeholder="筛选角色"
              style={{ width: 150 }}
              value={filterRole}
              onChange={setFilterRole}
            >
              <Select.Option value="all">全部订单</Select.Option>
              <Select.Option value="buyer">我是买家</Select.Option>
              <Select.Option value="maker">我是做市商</Select.Option>
            </Select>
          </Space>
        </Card>

        {/* 订单列表 */}
        {loadingOrders ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#999' }}>加载订单列表...</div>
          </div>
        ) : orders.length === 0 ? (
          <Empty
            description={
              <Space direction="vertical">
                <Text type="secondary">暂无订单</Text>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setShowCreateModal(true)}
                >
                  创建第一笔订单
                </Button>
              </Space>
            }
            style={{ padding: '60px 0' }}
          />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {orders.map(order => (
              <OTCOrderCard
                key={order.id}
                order={order}
                currentAccount={account}
                onRefresh={loadOrders}
                detailed={true}
              />
            ))}
          </Space>
        )}

        {/* 创建订单弹窗 */}
        <CreateOTCOrderModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          account={account}
          onSuccess={() => {
            setShowCreateModal(false)
            loadOrders()
          }}
        />
      </div>
    )
  }

  /**
   * 函数级详细中文注释：渲染做市商Tab
   */
  const renderMakersTab = () => {
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Title level={5} style={{ margin: 0 }}>
              <TeamOutlined /> 做市商列表
            </Title>
            <Text type="secondary">
              选择信誉良好的做市商进行交易，查看他们的溢价和服务详情
            </Text>
          </Space>
        </Card>

        <MarketMakerList
          showSelectButton
          onSelect={(maker) => {
            message.success(`已选择做市商 ID:${maker.id}，请前往"我的订单"创建订单`)
            setActiveTab('orders')
            setTimeout(() => setShowCreateModal(true), 300)
          }}
          limit={50}
        />
      </div>
    )
  }

  /**
   * 函数级详细中文注释：渲染跨链桥Tab
   */
  const renderBridgeTab = () => {
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Title level={5} style={{ margin: 0 }}>
              <SwapOutlined /> 跨链桥交易
            </Title>
            <Text type="secondary">
              在MEMO和USDT之间快速兑换，支持首购优惠
            </Text>
          </Space>
        </Card>

        <BridgeTransactionForm
          account={account}
          onSuccess={() => {
            message.success('交易成功！')
            // 可选：刷新余额等
          }}
        />
      </div>
    )
  }

  /**
   * 函数级详细中文注释：渲染AI助手Tab
   */
  const renderAITab = () => {
    const handleExecuteTrade = async (signal: any) => {
      try {
        // 根据 AI 信号执行交易
        if (signal.signal === 'BUY' && signal.confidence >= 70) {
          message.info('AI 建议买入，置信度 ' + signal.confidence + '%')
          // 打开创建订单弹窗
          setShowCreateModal(true)
        } else if (signal.signal === 'SELL' && signal.confidence >= 70) {
          message.info('AI 建议卖出，置信度 ' + signal.confidence + '%')
          // 可以实现卖出逻辑或提示用户
          message.warning('卖出功能请前往做市商管理页面')
        } else {
          message.info('AI 建议持有观望')
        }
      } catch (error) {
        console.error('执行 AI 交易建议失败:', error)
        message.error('执行失败，请稍后重试')
      }
    }

    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Title level={5} style={{ margin: 0 }}>
              <ThunderboltOutlined /> AI 交易助手
            </Title>
            <Text type="secondary">
              基于深度学习的智能交易信号，帮助你做出更明智的交易决策
            </Text>
          </Space>
        </Card>

        <AITradingPanel
          symbol="DUST-USDT"
          currentPrice={0.1}
          onExecuteTrade={handleExecuteTrade}
        />
      </div>
    )
  }

  /**
   * 函数级详细中文注释：计算Tab徽章
   */
  const getTabBadge = (key: string): number | undefined => {
    if (key === 'orders') {
      return activeOrders > 0 ? activeOrders : undefined
    }
    return undefined
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card
        style={{ 
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'orders',
              label: (
                <Badge count={getTabBadge('orders')} offset={[10, 0]}>
                  <Space>
                    <ShoppingOutlined />
                    <span>我的订单</span>
                  </Space>
                </Badge>
              ),
              children: renderOrdersTab(),
            },
            {
              key: 'ai-assistant',
              label: (
                <Space>
                  <ThunderboltOutlined />
                  <span>AI 助手</span>
                </Space>
              ),
              children: renderAITab(),
            },
            {
              key: 'makers',
              label: (
                <Space>
                  <TeamOutlined />
                  <span>做市商</span>
                </Space>
              ),
              children: renderMakersTab(),
            },
            {
              key: 'bridge',
              label: (
                <Space>
                  <SwapOutlined />
                  <span>跨链桥</span>
                </Space>
              ),
              children: renderBridgeTab(),
            },
          ]}
        />
      </Card>
    </div>
  )
}

