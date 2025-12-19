import React, { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Table, Typography, Space, Button, Tabs, Tag, Progress, Divider, Alert } from 'antd'
import { 
  UserOutlined, TeamOutlined, RiseOutlined, DollarOutlined, 
  TrophyOutlined, ArrowLeftOutlined, ReloadOutlined, DownloadOutlined 
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'

const { Title, Text } = Typography
const { TabPane } = Tabs

/**
 * 函数级详细中文注释：会员系统数据监控面板
 * 
 * 功能：
 * - 展示会员统计数据（总会员数、各等级分布）
 * - 展示推荐码申请统计
 * - 展示用户行为数据（埋点分析）
 * - 推荐转化率分析
 * - 数据导出功能
 */
const MembershipAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalMembers: 0,
    year1Count: 0,
    year3Count: 0,
    year5Count: 0,
    year10Count: 0,
    totalReferralCodes: 0,
    avgGenerations: 0
  })
  const [events, setEvents] = useState<any[]>([])
  const [conversionRate, setConversionRate] = useState<number>(0)

  useEffect(() => {
    refreshData()
  }, [])

  /**
   * 函数级中文注释：刷新链上数据
   * - 读取会员统计数据
   * - 读取推荐码统计数据
   * - 从 localStorage 读取用户行为数据
   */
  const refreshData = async () => {
    try {
      setLoading(true)
      
      // 1. 读取链上会员统计数据
      const api = await getApi()
      const qroot: any = api.query as any
      const membershipSec = qroot.membership
      
      // 读取各等级会员数量
      const year1Raw = await membershipSec.totalMembers(0)
      const year3Raw = await membershipSec.totalMembers(1)
      const year5Raw = await membershipSec.totalMembers(2)
      const year10Raw = await membershipSec.totalMembers(3)
      
      const year1 = year1Raw ? year1Raw.toNumber() : 0
      const year3 = year3Raw ? year3Raw.toNumber() : 0
      const year5 = year5Raw ? year5Raw.toNumber() : 0
      const year10 = year10Raw ? year10Raw.toNumber() : 0
      const total = year1 + year3 + year5 + year10

      setStats({
        totalMembers: total,
        year1Count: year1,
        year3Count: year3,
        year5Count: year5,
        year10Count: year10,
        totalReferralCodes: 0, // TODO: 从链上读取
        avgGenerations: 0 // TODO: 计算平均代数
      })

      // 2. 从 localStorage 读取用户行为数据
      const storedEvents = JSON.parse(localStorage.getItem('mp_analytics') || '[]')
      setEvents(storedEvents.reverse()) // 最新的在前

      // 3. 计算转化率
      const pageViews = storedEvents.filter((e: any) => e.event === 'membership_page_view').length
      const purchases = storedEvents.filter((e: any) => e.event === 'membership_purchase_success').length
      const rate = pageViews > 0 ? (purchases / pageViews * 100) : 0
      setConversionRate(rate)

    } catch (e) {
      console.error('刷新数据失败', e)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级中文注释：导出数据到 JSON 文件
   */
  const exportData = () => {
    try {
      const data = {
        stats,
        events,
        conversionRate,
        exportTime: new Date().toISOString()
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `membership-analytics-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('导出失败', e)
    }
  }

  /**
   * 函数级中文注释：清空本地数据
   */
  const clearLocalData = () => {
    if (window.confirm('确定要清空本地数据吗？此操作不可恢复。')) {
      localStorage.removeItem('mp_analytics')
      setEvents([])
    }
  }

  // 事件类型统计
  const eventStats = events.reduce((acc: any, e: any) => {
    acc[e.event] = (acc[e.event] || 0) + 1
    return acc
  }, {})

  // 表格列定义
  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '事件',
      dataIndex: 'event',
      key: 'event',
      render: (event: string) => {
        const colorMap: Record<string, string> = {
          'membership_page_view': 'blue',
          'membership_level_select': 'cyan',
          'membership_purchase_attempt': 'orange',
          'membership_purchase_success': 'green',
          'membership_purchase_fail': 'red'
        }
        return <Tag color={colorMap[event] || 'default'}>{event}</Tag>
      }
    },
    {
      title: '详情',
      dataIndex: 'data',
      key: 'data',
      render: (data: any) => {
        if (!data) return '-'
        return (
          <div style={{ fontSize: '12px', color: '#666' }}>
            {data.level !== undefined && `等级: ${data.level} | `}
            {data.address && `地址: ${data.address.slice(0, 8)}... | `}
            {data.error && `错误: ${data.error}`}
          </div>
        )
      }
    }
  ]

  return (
    <div style={{ padding: '60px 20px 80px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 返回按钮 */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => window.history.back()}
        style={{ marginBottom: '16px' }}
      >
        返回
      </Button>

      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Title level={2} style={{ color: '#B2955D', marginBottom: '8px' }}>
          会员系统数据监控
        </Title>
        <Text type="secondary">
          实时监控会员数据、推荐码统计、转化率分析
        </Text>
      </div>

      {/* 操作按钮 */}
      <div style={{ marginBottom: '24px', textAlign: 'right' }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refreshData} loading={loading}>
            刷新数据
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportData}>
            导出数据
          </Button>
          <Button danger onClick={clearLocalData}>
            清空本地数据
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总会员数"
              value={stats.totalMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="推荐码总数"
              value={stats.totalReferralCodes}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均代数"
              value={stats.avgGenerations}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#722ed1' }}
              precision={1}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="转化率"
              value={conversionRate}
              suffix="%"
              prefix={<DollarOutlined />}
              valueStyle={{ color: conversionRate > 20 ? '#3f8600' : '#cf1322' }}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      {/* 会员等级分布 */}
      <Card title="会员等级分布" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Year1 年费会员</Text>
              <Progress
                type="circle"
                percent={stats.totalMembers > 0 ? (stats.year1Count / stats.totalMembers * 100) : 0}
                format={() => stats.year1Count}
                strokeColor="#faad14"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Year3 三年会员</Text>
              <Progress
                type="circle"
                percent={stats.totalMembers > 0 ? (stats.year3Count / stats.totalMembers * 100) : 0}
                format={() => stats.year3Count}
                strokeColor="#1890ff"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Year5 五年会员</Text>
              <Progress
                type="circle"
                percent={stats.totalMembers > 0 ? (stats.year5Count / stats.totalMembers * 100) : 0}
                format={() => stats.year5Count}
                strokeColor="#722ed1"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Year10 十年会员</Text>
              <Progress
                type="circle"
                percent={stats.totalMembers > 0 ? (stats.year10Count / stats.totalMembers * 100) : 0}
                format={() => stats.year10Count}
                strokeColor="#f5222d"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 数据分析 Tabs */}
      <Card>
        <Tabs defaultActiveKey="events">
          <TabPane tab="用户行为事件" key="events">
            <Alert
              type="info"
              showIcon
              message="数据说明"
              description="以下数据来自前端埋点，存储在浏览器本地。刷新浏览器数据会保留，清除浏览器缓存会丢失。"
              style={{ marginBottom: '16px' }}
            />
            <Table
              columns={columns}
              dataSource={events.map((e, i) => ({ ...e, key: i }))}
              pagination={{ pageSize: 20 }}
              scroll={{ x: 800 }}
              size="small"
            />
          </TabPane>

          <TabPane tab="事件统计" key="event-stats">
            <div style={{ padding: '16px' }}>
              <Title level={4}>事件类型统计</Title>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {Object.entries(eventStats).map(([event, count]) => (
                  <div key={event} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color="blue">{event}</Tag>
                    <Text strong>{count as number} 次</Text>
                  </div>
                ))}
              </Space>
            </div>
          </TabPane>

          <TabPane tab="转化漏斗" key="funnel">
            <div style={{ padding: '16px' }}>
              <Title level={4}>购买转化漏斗</Title>
              <Space direction="vertical" style={{ width: '100%' }} size={24}>
                <div>
                  <Text>1. 页面访问</Text>
                  <Progress percent={100} />
                  <Text type="secondary">
                    {eventStats['membership_page_view'] || 0} 次
                  </Text>
                </div>
                <div>
                  <Text>2. 选择等级</Text>
                  <Progress 
                    percent={
                      eventStats['membership_page_view'] > 0
                        ? ((eventStats['membership_level_select'] || 0) / eventStats['membership_page_view'] * 100)
                        : 0
                    } 
                    strokeColor="#1890ff"
                  />
                  <Text type="secondary">
                    {eventStats['membership_level_select'] || 0} 次
                  </Text>
                </div>
                <div>
                  <Text>3. 尝试购买</Text>
                  <Progress 
                    percent={
                      eventStats['membership_page_view'] > 0
                        ? ((eventStats['membership_purchase_attempt'] || 0) / eventStats['membership_page_view'] * 100)
                        : 0
                    }
                    strokeColor="#722ed1"
                  />
                  <Text type="secondary">
                    {eventStats['membership_purchase_attempt'] || 0} 次
                  </Text>
                </div>
                <div>
                  <Text>4. 购买成功</Text>
                  <Progress 
                    percent={
                      eventStats['membership_page_view'] > 0
                        ? ((eventStats['membership_purchase_success'] || 0) / eventStats['membership_page_view'] * 100)
                        : 0
                    }
                    strokeColor="#52c41a"
                  />
                  <Text type="secondary">
                    {eventStats['membership_purchase_success'] || 0} 次
                  </Text>
                </div>
              </Space>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default MembershipAnalyticsPage

