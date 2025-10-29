/**
 * 做市商列表组件
 * 
 * 功能说明：
 * 1. 展示做市商列表（卡片或表格）
 * 2. 显示做市商状态、溢价信息
 * 3. 支持筛选（状态、方向）
 * 4. 支持选择做市商进行交易
 * 
 * 创建日期：2025-10-28
 */

import React, { useEffect, useState } from 'react'
import { 
  List, 
  Card, 
  Space, 
  Typography, 
  Tag, 
  Button, 
  Empty, 
  Spin,
  Select,
  Row,
  Col,
} from 'antd'
import { 
  UserOutlined, 
  CrownOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createTradingService, 
  type MakerApplication,
  ApplicationStatus,
  Direction,
} from '../../services/tradingService'

const { Text } = Typography

interface MarketMakerListProps {
  /** 选择回调 */
  onSelect?: (maker: MakerApplication) => void
  /** 是否显示选择按钮 */
  showSelectButton?: boolean
  /** 筛选选项 */
  filterStatus?: ApplicationStatus
  /** 筛选方向 */
  filterDirection?: Direction
  /** 数量限制 */
  limit?: number
}

/**
 * 函数级详细中文注释：状态标签配置
 */
const statusConfig = {
  [ApplicationStatus.Active]: { label: '活跃', color: 'success' },
  [ApplicationStatus.Paused]: { label: '暂停', color: 'default' },
  [ApplicationStatus.PendingReview]: { label: '审核中', color: 'processing' },
  [ApplicationStatus.DepositLocked]: { label: '押金已锁定', color: 'blue' },
  [ApplicationStatus.WithdrawalRequested]: { label: '提现申请中', color: 'warning' },
  [ApplicationStatus.Withdrawn]: { label: '已提现', color: 'default' },
}

/**
 * 函数级详细中文注释：方向标签配置
 */
const directionConfig = {
  [Direction.Buy]: { label: '买入DUST', color: 'green', icon: <RiseOutlined /> },
  [Direction.Sell]: { label: '卖出DUST', color: 'red', icon: <FallOutlined /> },
  [Direction.BuyAndSell]: { label: '双向', color: 'blue', icon: <CrownOutlined /> },
}

/**
 * 函数级详细中文注释：做市商列表组件
 */
export const MarketMakerList: React.FC<MarketMakerListProps> = ({ 
  onSelect,
  showSelectButton = false,
  filterStatus,
  filterDirection,
  limit = 50,
}) => {
  const [makers, setMakers] = useState<MakerApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [localFilterStatus, setLocalFilterStatus] = useState<ApplicationStatus | undefined>(filterStatus)
  const [localFilterDirection, setLocalFilterDirection] = useState<Direction | undefined>(filterDirection)

  /**
   * 函数级详细中文注释：加载做市商列表
   */
  const loadMakers = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const service = createTradingService(api)
      
      const allMakers = await service.listMakers({
        status: localFilterStatus,
        direction: localFilterDirection,
        limit,
      })
      
      setMakers(allMakers)
    } catch (error) {
      console.error('加载做市商失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMakers()
  }, [localFilterStatus, localFilterDirection, limit])

  /**
   * 函数级详细中文注释：渲染做市商卡片
   */
  const renderMakerCard = (maker: MakerApplication) => {
    const statusInfo = statusConfig[maker.status]
    const directionInfo = directionConfig[maker.direction]

    return (
      <List.Item key={maker.id}>
        <Card
          style={{ width: '100%', borderRadius: 12 }}
          hoverable={showSelectButton}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 头部 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Text strong style={{ fontSize: 16 }}>
                  {maker.maskedFullName}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ID: {maker.id}
                </Text>
              </Space>
              <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            </div>

            {/* 方向和溢价 */}
            <Row gutter={16}>
              <Col span={12}>
                <Space direction="vertical" size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>交易方向</Text>
                  <Tag color={directionInfo.color} icon={directionInfo.icon}>
                    {directionInfo.label}
                  </Tag>
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical" size="small">
                  <Text type="secondary" style={{ fontSize: 12 }}>溢价</Text>
                  <div>
                    {maker.direction !== Direction.Sell && (
                      <Tag color={maker.buyPremiumBps > 0 ? 'red' : 'green'}>
                        买: {maker.buyPremiumBps > 0 ? '+' : ''}{(maker.buyPremiumBps / 100).toFixed(2)}%
                      </Tag>
                    )}
                    {maker.direction !== Direction.Buy && (
                      <Tag color={maker.sellPremiumBps > 0 ? 'red' : 'green'}>
                        卖: {maker.sellPremiumBps > 0 ? '+' : ''}{(maker.sellPremiumBps / 100).toFixed(2)}%
                      </Tag>
                    )}
                  </div>
                </Space>
              </Col>
            </Row>

            {/* 选择按钮 */}
            {showSelectButton && (
              <Button 
                type="primary" 
                block
                onClick={() => onSelect?.(maker)}
                disabled={maker.status !== ApplicationStatus.Active}
              >
                选择此做市商
              </Button>
            )}
          </Space>
        </Card>
      </List.Item>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#999' }}>加载做市商列表...</div>
      </div>
    )
  }

  return (
    <div>
      {/* 筛选器 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="状态筛选"
            style={{ width: 150 }}
            allowClear
            value={localFilterStatus}
            onChange={setLocalFilterStatus}
          >
            <Select.Option value={ApplicationStatus.Active}>活跃</Select.Option>
            <Select.Option value={ApplicationStatus.Paused}>暂停</Select.Option>
            <Select.Option value={ApplicationStatus.PendingReview}>审核中</Select.Option>
          </Select>
          
          <Select
            placeholder="方向筛选"
            style={{ width: 150 }}
            allowClear
            value={localFilterDirection}
            onChange={setLocalFilterDirection}
          >
            <Select.Option value={Direction.Buy}>买入DUST</Select.Option>
            <Select.Option value={Direction.Sell}>卖出DUST</Select.Option>
            <Select.Option value={Direction.BuyAndSell}>双向</Select.Option>
          </Select>
        </Space>
      </div>

      {/* 列表 */}
      {makers.length === 0 ? (
        <Empty
          description="暂无做市商"
          style={{ padding: '60px 0' }}
        />
      ) : (
        <List
          dataSource={makers}
          renderItem={renderMakerCard}
          pagination={
            makers.length > 10
              ? {
                  pageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total) => `共 ${total} 个做市商`,
                }
              : false
          }
        />
      )}
    </div>
  )
}

