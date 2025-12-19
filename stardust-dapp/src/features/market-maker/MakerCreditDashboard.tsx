/**
 * 做市商信用仪表板页面
 * 
 * 功能说明：
 * 1. 展示做市商信用评分和等级
 * 2. 显示信用分组成明细（6个维度）
 * 3. 显示违约历史记录
 * 4. 显示服务状态和风险分衰减进度
 * 5. 美观的渐变卡片设计
 * 6. 响应式布局，移动端友好
 * 
 * 创建日期：2025-10-22
 */

import React, { useEffect, useState } from 'react'
import { Card, Typography, Alert, Button, Space, Row, Col, Progress, Table, Statistic, Tag, Spin } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'
import {
  getCreditRecord,
  getDefaultHistory,
  getCreditBreakdown,
  getLevelInfo,
  getStatusInfo,
  getDecayProgress,
  formatTimestamp,
  type CreditRecord,
  type DefaultRecord,
  type CreditBreakdown,
} from '../../services/makerCreditService'

const { Title, Text, Paragraph } = Typography

/**
 * 做市商信用仪表板页面组件
 */
const MakerCreditDashboard: React.FC = () => {
  const { selectedAccount } = useWallet()
  const [makerId, setMakerId] = useState<number | null>(null)
  const [creditRecord, setCreditRecord] = useState<CreditRecord | null>(null)
  const [defaultHistory, setDefaultHistory] = useState<DefaultRecord[]>([])
  const [breakdown, setBreakdown] = useState<CreditBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * 函数级详细中文注释：加载做市商ID
   */
  useEffect(() => {
    const loadMakerId = async () => {
      if (!selectedAccount) {
        setLoading(false)
        return
      }

      try {
        const api = await getApi()
        const qroot: any = api.query
        const marketMakerQuery = qroot.marketMaker || qroot.market_maker

        if (!marketMakerQuery?.activeMarketMakers) {
          setError('做市商模块不可用')
          setLoading(false)
          return
        }

        // 查询所有活跃做市商
        const entries = await marketMakerQuery.activeMarketMakers.entries()
        
        // 查找当前账户的做市商ID
        let foundMakerId: number | null = null
        for (const [key, value] of entries) {
          const makerIdRaw = key.args[0]
          const appData: any = value.toJSON()
          
          if (appData && appData.owner === selectedAccount.address) {
            foundMakerId = makerIdRaw.toNumber()
            break
          }
        }

        if (!foundMakerId) {
          setError('您不是活跃的做市商，无法查看信用记录')
          setLoading(false)
          return
        }

        setMakerId(foundMakerId)
      } catch (error) {
        console.error('加载做市商ID失败:', error)
        setError('加载做市商ID失败')
        setLoading(false)
      }
    }

    loadMakerId()
  }, [selectedAccount])

  /**
   * 函数级详细中文注释：加载信用记录和违约历史
   */
  useEffect(() => {
    const loadCreditData = async () => {
      if (!makerId) return

      try {
        setLoading(true)
        const api = await getApi()

        // 查询信用记录
        const credit = await getCreditRecord(api, makerId)
        if (!credit) {
          setError('未找到信用记录')
          setLoading(false)
          return
        }
        setCreditRecord(credit)

        // 计算信用分组成
        const breakdownData = getCreditBreakdown(credit)
        setBreakdown(breakdownData)

        // 查询违约历史
        const history = await getDefaultHistory(api, makerId)
        setDefaultHistory(history)

        setError(null)
      } catch (error) {
        console.error('加载信用数据失败:', error)
        setError('加载信用数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadCreditData()
  }, [makerId])

  // 违约历史表格列定义
  const historyColumns = [
    {
      title: '违约类型',
      dataIndex: 'defaultType',
      key: 'defaultType',
      render: (type: string) => (
        <Tag color={type === 'Timeout' ? 'orange' : 'red'}>
          {type === 'Timeout' ? '⏰ 超时' : '⚖️ 争议败诉'}
        </Tag>
      ),
    },
    {
      title: '订单ID',
      dataIndex: 'orderId',
      key: 'orderId',
    },
    {
      title: '违约时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: number) => formatTimestamp(timestamp),
    },
    {
      title: '信用分扣除',
      dataIndex: 'creditDeducted',
      key: 'creditDeducted',
      render: (value: number) => <Text type="danger">-{value}</Text>,
    },
    {
      title: '风险分增加',
      dataIndex: 'riskAdded',
      key: 'riskAdded',
      render: (value: number) => <Text type="warning">+{value}</Text>,
    },
  ]

  if (loading) {
    return (
      <div style={{ padding: 16, maxWidth: 414, margin: '0 auto', textAlign: 'center' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16 }}>加载中...</Paragraph>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 16, maxWidth: 414, margin: '0 auto' }}>
        <Card>
          <Space>
            <Button onClick={() => window.location.hash = '#/market-maker/center'}>
              ← 返回做市商中心
            </Button>
          </Space>
          <Alert
            type="error"
            message="加载失败"
            description={error}
            style={{ marginTop: 16 }}
          />
        </Card>
      </div>
    )
  }

  if (!creditRecord || !breakdown) {
    return (
      <div style={{ padding: 16, maxWidth: 414, margin: '0 auto' }}>
        <Card>
          <Space>
            <Button onClick={() => window.location.hash = '#/market-maker/center'}>
              ← 返回做市商中心
            </Button>
          </Space>
          <Alert
            type="info"
            message="暂无数据"
            description="未找到信用记录"
            style={{ marginTop: 16 }}
          />
        </Card>
      </div>
    )
  }

  const levelInfo = getLevelInfo(creditRecord.level)
  const statusInfo = getStatusInfo(creditRecord.serviceStatus)
  const currentTime = Math.floor(Date.now() / 1000)
  const decayProgress = getDecayProgress(creditRecord.lastDecay, currentTime)

  return (
    <div style={{ padding: 16, maxWidth: 414, margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Space>
            <Button onClick={() => window.location.hash = '#/market-maker/center'}>
              ← 返回做市商中心
            </Button>
          </Space>
          <Title level={2} style={{ marginTop: 16, marginBottom: 8 }}>
            💳 做市商信用仪表板
          </Title>
          <Paragraph type="secondary">
            查看您的信用评分、等级、违约历史和服务状态
          </Paragraph>
        </div>

        {/* 做市商ID */}
        {makerId && (
          <Card size="small" style={{ marginBottom: 16, background: '#f0f2f5' }}>
            <Text strong>做市商ID：</Text>
            <Text code style={{ marginLeft: 8 }}>#{makerId}</Text>
          </Card>
        )}

        {/* 信用总览卡片 */}
        <Card
          title="📊 信用总览"
          style={{
            marginBottom: 16,
            background: levelInfo.bgColor,
            border: 'none',
          }}
          headStyle={{
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: '8px',
                }}
              >
                <Statistic
                  title="信用分"
                  value={creditRecord.creditScore}
                  suffix="/ 1000"
                  valueStyle={{ color: levelInfo.color, fontWeight: 'bold' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>信用等级</Text>
                  <div style={{ fontSize: 20, fontWeight: 'bold', marginTop: 8 }}>
                    {levelInfo.name}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {levelInfo.desc}
                  </Text>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: '8px',
                }}
              >
                <Statistic
                  title="风险分"
                  value={creditRecord.riskScore}
                  suffix="/ 1000"
                  valueStyle={{
                    color: creditRecord.riskScore > 500 ? '#ff4d4f' : '#52c41a',
                    fontWeight: 'bold',
                  }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.95)',
                  borderRadius: '8px',
                }}
              >
                <Alert
                  type={statusInfo.color as any}
                  message={statusInfo.name}
                  description={statusInfo.desc}
                  style={{ padding: '8px 12px' }}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* 信用分组成明细 */}
        <Card title="📈 信用分组成明细" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[8, 16]}>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>基础分</Text>
                <Progress percent={(breakdown.baseScore / 800) * 100} strokeColor="#1890ff" />
                <Text type="secondary">{breakdown.baseScore} / 800</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>履约表现</Text>
                <Progress percent={(breakdown.fulfillmentScore / 250) * 100} strokeColor="#52c41a" />
                <Text type="secondary">{breakdown.fulfillmentScore} / 250</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>服务质量</Text>
                <Progress percent={(breakdown.serviceScore / 200) * 100} strokeColor="#faad14" />
                <Text type="secondary">{breakdown.serviceScore} / 200</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>资金充足</Text>
                <Progress percent={(breakdown.capitalScore / 150) * 100} strokeColor="#722ed1" />
                <Text type="secondary">{breakdown.capitalScore} / 150</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>活跃度</Text>
                <Progress percent={(breakdown.activityScore / 100) * 100} strokeColor="#13c2c2" />
                <Text type="secondary">{breakdown.activityScore} / 100</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong>买家评价</Text>
                <Progress percent={(breakdown.ratingScore / 100) * 100} strokeColor="#eb2f96" />
                <Text type="secondary">{breakdown.ratingScore} / 100</Text>
              </div>
            </Col>
            <Col xs={24}>
              <div>
                <Text strong>风险扣分</Text>
                <Progress
                  percent={(breakdown.riskDeduction / 100) * 100}
                  strokeColor="#ff4d4f"
                  status="exception"
                />
                <Text type="danger">-{breakdown.riskDeduction} 分</Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* 统计数据 */}
        <Card title="📋 统计数据" size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic title="累计订单" value={creditRecord.totalOrders} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="平均响应时间"
                value={creditRecord.avgResponseTime}
                suffix="秒"
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="超时违约"
                value={creditRecord.timeoutDefaults}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="争议败诉"
                value={creditRecord.disputeLosses}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
          </Row>
        </Card>

        {/* 风险分衰减进度 */}
        <Card title="⏳ 风险分衰减进度" size="small" style={{ marginBottom: 16 }}>
          <Paragraph type="secondary">
            风险分每30天自动衰减10%，当前进度：
          </Paragraph>
          <Progress percent={decayProgress} strokeColor="#52c41a" />
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            上次衰减时间：{formatTimestamp(creditRecord.lastDecay)}
          </Paragraph>
        </Card>

        {/* 违约历史 */}
        <Card title="📜 违约历史" size="small">
          {defaultHistory.length === 0 ? (
            <Alert type="success" message="暂无违约记录，保持良好！" />
          ) : (
            <Table
              columns={historyColumns}
              dataSource={defaultHistory}
              rowKey="orderId"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          )}
        </Card>
      </Card>
    </div>
  )
}

export default MakerCreditDashboard

