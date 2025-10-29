import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Empty } from 'antd'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined
} from '@ant-design/icons'
import { Column, Pie } from '@ant-design/charts'
import { useProposals } from '@/hooks/useProposals'
import { useCouncilMembers } from '@/hooks/useCouncilMembers'

/**
 * 数据分析页面
 * 显示提案统计、投票趋势、成员活跃度等
 */
export default function Analytics() {
  const { proposals } = useProposals()
  const { members, memberCount } = useCouncilMembers()
  
  const [typeStats, setTypeStats] = useState<any[]>([])
  const [statusStats, setStatusStats] = useState<any[]>([])
  const [memberActivity, setMemberActivity] = useState<any[]>([])

  /**
   * 计算统计数据
   */
  useEffect(() => {
    // 按类型统计
    const approveCount = proposals.filter(
      (p) => p.call?.method === 'approve'
    ).length
    const rejectCount = proposals.filter(
      (p) => p.call?.method === 'reject'
    ).length

    setTypeStats([
      { type: '批准', value: approveCount },
      { type: '驳回', value: rejectCount }
    ])

    // 按状态统计
    const executable = proposals.filter(
      (p) => p.ayes.length >= p.threshold
    ).length
    const voting = proposals.filter(
      (p) => p.ayes.length < p.threshold
    ).length

    setStatusStats([
      { status: '可执行', value: executable },
      { status: '投票中', value: voting }
    ])

    // 成员活跃度统计
    const activityMap = new Map<string, number>()
    
    proposals.forEach((proposal) => {
      proposal.ayes.forEach((addr) => {
        activityMap.set(addr, (activityMap.get(addr) || 0) + 1)
      })
      proposal.nays.forEach((addr) => {
        activityMap.set(addr, (activityMap.get(addr) || 0) + 1)
      })
    })

    const activity = Array.from(activityMap.entries())
      .map(([address, count]) => ({
        address: address.slice(0, 8) + '...' + address.slice(-8),
        fullAddress: address,
        votes: count
      }))
      .sort((a, b) => b.votes - a.votes)

    setMemberActivity(activity)
  }, [proposals, members])

  /**
   * 饼图配置
   */
  const pieConfig = {
    data: typeStats,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'inner',
      offset: '-30%',
      content: '{value}',
      style: {
        fontSize: 14,
        textAlign: 'center'
      }
    },
    legend: {
      position: 'bottom' as const
    }
  }

  /**
   * 柱状图配置
   */
  const columnConfig = {
    data: memberActivity,
    xField: 'address',
    yField: 'votes',
    label: {
      position: 'top' as const,
      style: {
        fill: '#000',
        opacity: 0.6
      }
    },
    xAxis: {
      label: {
        autoRotate: true
      }
    }
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[24, 24]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃提案"
              value={proposals.length}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="可执行"
              value={proposals.filter((p) => p.ayes.length >= p.threshold).length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="投票中"
              value={proposals.filter((p) => p.ayes.length < p.threshold).length}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="委员会成员"
              value={memberCount}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        {/* 提案类型分布 */}
        <Col span={12}>
          <Card title="提案类型分布">
            {typeStats.length > 0 ? (
              <Pie {...pieConfig} />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>

        {/* 提案状态分布 */}
        <Col span={12}>
          <Card title="提案状态分布">
            {statusStats.length > 0 ? (
              <Pie
                {...pieConfig}
                data={statusStats}
                colorField="status"
                angleField="value"
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>

        {/* 成员活跃度 */}
        <Col span={24}>
          <Card title="委员会成员投票活跃度">
            {memberActivity.length > 0 ? (
              <Column {...columnConfig} />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 活跃度详细表格 */}
      {memberActivity.length > 0 && (
        <Card title="成员活跃度详情" style={{ marginTop: 24 }}>
          <Table
            columns={[
              {
                title: '排名',
                key: 'rank',
                width: 80,
                render: (_, __, index) => index + 1
              },
              {
                title: '成员地址',
                dataIndex: 'fullAddress',
                key: 'fullAddress'
              },
              {
                title: '投票次数',
                dataIndex: 'votes',
                key: 'votes',
                width: 120,
                sorter: (a, b) => b.votes - a.votes
              }
            ]}
            dataSource={memberActivity}
            rowKey="fullAddress"
            pagination={false}
          />
        </Card>
      )}
    </div>
  )
}

