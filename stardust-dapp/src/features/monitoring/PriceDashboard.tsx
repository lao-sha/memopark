import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Typography, Space, Tag, Alert, Spin, Progress, Table, Tabs } from 'antd'
import { LineChartOutlined, DollarOutlined, RiseOutlined, FallOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'

const { Title, Text } = Typography
const { TabPane } = Tabs

/**
 * 函数级详细中文注释：价格监控 Dashboard
 * 
 * 功能：
 * 1. 实时显示市场加权均价（OTC + Bridge）
 * 2. 分别显示 OTC 和 Bridge 的平均价格
 * 3. 显示价格统计信息（累计成交量、滑动窗口大小）
 * 4. 显示冷启动状态
 * 5. 提供价格偏离计算工具
 */
const PriceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [marketPrice, setMarketPrice] = useState<number>(0)
  const [otcAvgPrice, setOtcAvgPrice] = useState<number>(0)
  const [bridgeAvgPrice, setBridgeAvgPrice] = useState<number>(0)
  const [otcVolume, setOtcVolume] = useState<number>(0)
  const [bridgeVolume, setBridgeVolume] = useState<number>(0)
  const [otcWindowSize, setOtcWindowSize] = useState<number>(0)
  const [bridgeWindowSize, setBridgeWindowSize] = useState<number>(0)
  const [maxDeviation, setMaxDeviation] = useState<number>(2000)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  // 函数级中文注释：加载价格数据
  const loadPriceData = async () => {
    try {
      const api = await getApi()
      
      // 查询市场加权均价
      const marketPriceRaw = await api.query.pricing.getMemoMarketPriceWeighted()
      const marketPriceNum = Number(marketPriceRaw.toString())
      setMarketPrice(marketPriceNum)
      
      // 查询 OTC 平均价格
      const otcAvgPriceRaw = await api.query.pricing.otcAvgPrice()
      const otcAvgPriceNum = Number(otcAvgPriceRaw.toString())
      setOtcAvgPrice(otcAvgPriceNum)
      
      // 查询 Bridge 平均价格
      const bridgeAvgPriceRaw = await api.query.pricing.bridgeAvgPrice()
      const bridgeAvgPriceNum = Number(bridgeAvgPriceRaw.toString())
      setBridgeAvgPrice(bridgeAvgPriceNum)
      
      // 查询累计成交量
      const otcVolumeRaw = await api.query.pricing.otcCumulativeVolume()
      const otcVolumeNum = Number(otcVolumeRaw.toString())
      setOtcVolume(otcVolumeNum)
      
      const bridgeVolumeRaw = await api.query.pricing.bridgeCumulativeVolume()
      const bridgeVolumeNum = Number(bridgeVolumeRaw.toString())
      setBridgeVolume(bridgeVolumeNum)
      
      // 查询滑动窗口大小
      const otcWindowSizeRaw = await api.consts.pricing.otcVolumeWindowSize
      const otcWindowSizeNum = Number(otcWindowSizeRaw.toString())
      setOtcWindowSize(otcWindowSizeNum)
      
      const bridgeWindowSizeRaw = await api.consts.pricing.bridgeVolumeWindowSize
      const bridgeWindowSizeNum = Number(bridgeWindowSizeRaw.toString())
      setBridgeWindowSize(bridgeWindowSizeNum)
      
      // 查询最大价格偏离
      const maxDeviationRaw = await api.query.otcListing.maxPriceDeviation()
      const maxDeviationNum = Number(maxDeviationRaw.toString())
      setMaxDeviation(maxDeviationNum)
      
      setLoading(false)
    } catch (e) {
      console.error('Failed to load price data:', e)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPriceData()
    
    // 函数级中文注释：每 30 秒自动刷新价格数据
    const interval = setInterval(loadPriceData, 30000)
    setRefreshInterval(interval)
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  // 函数级中文注释：计算价格偏离
  const calculateDeviation = (price: number) => {
    if (marketPrice === 0) return 0
    return ((price - marketPrice) / marketPrice * 100)
  }

  // 函数级中文注释：计算允许的价格范围
  const getPriceRange = () => {
    if (marketPrice === 0 || maxDeviation === 0) {
      return { min: 0, max: 0, enabled: false }
    }
    const min = Math.floor(marketPrice * (10000 - maxDeviation) / 10000)
    const max = Math.ceil(marketPrice * (10000 + maxDeviation) / 10000)
    return { min, max, enabled: true }
  }

  // 函数级中文注释：计算窗口填充进度
  const getWindowProgress = (volume: number, windowSize: number) => {
    if (windowSize === 0) return 0
    return Math.min(100, (volume / windowSize) * 100)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="加载价格数据..." />
      </div>
    )
  }

  const range = getPriceRange()
  const isColdStart = marketPrice === 0

  // 价格偏离示例数据
  const deviationExamples = [
    { price: range.enabled ? marketPrice * 0.85 : 425000, label: '市价 -15%' },
    { price: range.enabled ? marketPrice * 0.90 : 450000, label: '市价 -10%' },
    { price: range.enabled ? marketPrice * 0.95 : 475000, label: '市价 -5%' },
    { price: marketPrice || 500000, label: '市价' },
    { price: range.enabled ? marketPrice * 1.05 : 525000, label: '市价 +5%' },
    { price: range.enabled ? marketPrice * 1.10 : 550000, label: '市价 +10%' },
    { price: range.enabled ? marketPrice * 1.15 : 575000, label: '市价 +15%' },
  ].map(item => {
    const deviation = calculateDeviation(item.price)
    const isInRange = range.enabled ? (item.price >= range.min && item.price <= range.max) : true
    return {
      label: item.label,
      price: (item.price / 1_000_000).toFixed(6),
      deviation: deviation.toFixed(2),
      status: isInRange ? '✅ 允许' : '❌ 拒绝',
      color: isInRange ? '#52c41a' : '#ff4d4f',
    }
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
      <Title level={3}>
        <LineChartOutlined /> 价格监控 Dashboard
      </Title>

      {/* 冷启动状态提示 */}
      {isColdStart && (
        <Alert
          type="warning"
          showIcon
          message="冷启动状态"
          description="市场价格尚未形成，等待第一批订单成交。冷启动期间，挂单不进行价格偏离检查。"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 核心价格指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="市场加权均价"
              value={marketPrice / 1_000_000}
              precision={6}
              suffix="USDT/DUST"
              prefix={<DollarOutlined />}
              valueStyle={{ color: isColdStart ? '#999' : '#1890ff' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              OTC + Bridge 加权平均
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="OTC 平均价格"
              value={otcAvgPrice / 1_000_000}
              precision={6}
              suffix="USDT/DUST"
              prefix={<RiseOutlined />}
              valueStyle={{ color: otcAvgPrice > 0 ? '#52c41a' : '#999' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              滑动窗口统计
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Bridge 平均价格"
              value={bridgeAvgPrice / 1_000_000}
              precision={6}
              suffix="USDT/DUST"
              prefix={<FallOutlined />}
              valueStyle={{ color: bridgeAvgPrice > 0 ? '#fa8c16' : '#999' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              滑动窗口统计
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 价格范围 */}
      {range.enabled && (
        <Card title="允许的挂单价格范围" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="最低价"
                value={range.min / 1_000_000}
                precision={6}
                suffix="USDT"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="偏离范围"
                value={maxDeviation / 100}
                precision={0}
                suffix="%"
                prefix="±"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="最高价"
                value={range.max / 1_000_000}
                precision={6}
                suffix="USDT"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 成交量统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="OTC 累计成交量" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong style={{ fontSize: 24 }}>
                  {(otcVolume / 1e18).toFixed(2)}
                </Text>
                <Text type="secondary"> DUST</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  滑动窗口大小: {(otcWindowSize / 1e18).toFixed(0)} DUST
                </Text>
              </div>
              <Progress
                percent={getWindowProgress(otcVolume, otcWindowSize)}
                strokeColor={getWindowProgress(otcVolume, otcWindowSize) >= 100 ? '#52c41a' : '#1890ff'}
                format={(percent) => `${percent?.toFixed(1)}% 填充`}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Bridge 累计成交量" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong style={{ fontSize: 24 }}>
                  {(bridgeVolume / 1e18).toFixed(2)}
                </Text>
                <Text type="secondary"> DUST</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  滑动窗口大小: {(bridgeWindowSize / 1e18).toFixed(0)} DUST
                </Text>
              </div>
              <Progress
                percent={getWindowProgress(bridgeVolume, bridgeWindowSize)}
                strokeColor={getWindowProgress(bridgeVolume, bridgeWindowSize) >= 100 ? '#52c41a' : '#fa8c16'}
                format={(percent) => `${percent?.toFixed(1)}% 填充`}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 价格偏离示例 */}
      <Card title="价格偏离计算示例" size="small">
        <Table
          dataSource={deviationExamples}
          columns={[
            {
              title: '价格档位',
              dataIndex: 'label',
              key: 'label',
              width: 120,
            },
            {
              title: '价格 (USDT)',
              dataIndex: 'price',
              key: 'price',
              width: 140,
            },
            {
              title: '偏离度',
              dataIndex: 'deviation',
              key: 'deviation',
              width: 100,
              render: (value: string) => {
                const num = parseFloat(value)
                return (
                  <Text style={{ color: num > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {num > 0 ? '+' : ''}{value}%
                  </Text>
                )
              },
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: (value: string, record: any) => (
                <Tag color={record.color}>{value}</Tag>
              ),
            },
          ]}
          pagination={false}
          size="small"
        />
        {!range.enabled && (
          <Alert
            type="info"
            showIcon
            message="冷启动状态下不进行价格偏离检查，上述示例仅供参考。"
            style={{ marginTop: 12 }}
          />
        )}
      </Card>

      {/* 说明 */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="说明"
        description={
          <Space direction="vertical" size="small">
            <Text>• 市场加权均价 = (OTC均价 × OTC成交量 + Bridge均价 × Bridge成交量) / (OTC成交量 + Bridge成交量)</Text>
            <Text>• 滑动窗口：统计最近 N DUST 的成交均价，防止单笔大额交易影响过大</Text>
            <Text>• 价格偏离检查：挂单创建时，链上自动检查价格是否在市场均价 ±{maxDeviation / 100}% 范围内</Text>
            <Text>• 冷启动保护：市场价格为 0 时，允许自由定价，不进行偏离检查</Text>
            <Text>• 数据刷新：页面每 30 秒自动刷新价格数据</Text>
          </Space>
        }
        style={{ marginTop: 16 }}
      />
    </div>
  )
}

export default PriceDashboard

