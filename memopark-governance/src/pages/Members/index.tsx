import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Avatar,
  Space,
  Statistic,
  Button,
  Typography,
  message,
  Row,
  Col,
  Empty
} from 'antd'
import {
  TeamOutlined,
  CrownOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { Pie, Column } from '@ant-design/charts'
import { useApi } from '@/contexts/Api'
import { useCouncilMembers } from '@/hooks/useCouncilMembers'
import { useProposals } from '@/hooks/useProposals'
import { formatAddress, generateAvatar } from '@/utils/format'
import type { ColumnsType } from 'antd/es/table'

/**
 * 成员信息接口
 */
interface MemberInfo {
  address: string
  totalVotes: number
  ayesCount: number
  naysCount: number
  participationRate: number
}

/**
 * 成员管理页面
 * 显示委员会成员列表、投票统计、活跃度等
 */
export default function Members() {
  const { api, isReady } = useApi()
  const { members, loading: membersLoading, memberCount } = useCouncilMembers()
  const { proposals } = useProposals()
  const [memberInfos, setMemberInfos] = useState<MemberInfo[]>([])
  const [prime, setPrime] = useState<string | null>(null)
  const [typeStats, setTypeStats] = useState<any[]>([])
  const [statusStats, setStatusStats] = useState<any[]>([])
  const [memberActivity, setMemberActivity] = useState<any[]>([])

  // 饼图配置
  const pieConfig = {
    angleField: 'value',
    radius: 0.8,
    label: {
      type: 'inner' as const,
      offset: '-30%',
      content: '{value}',
      style: {
        fontSize: 14,
        textAlign: 'center' as const
      }
    },
    legend: {
      position: 'bottom' as const
    }
  }

  // 柱状图配置
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

  /**
   * 加载Prime成员
   */
  useEffect(() => {
    if (!isReady || !api) return

    const loadPrime = async () => {
      try {
        const primeOption: any = await api.query.council.prime()
        if (primeOption && primeOption.isSome) {
          const primeAddr = primeOption.unwrap().toString()
          setPrime(primeAddr)
        }
      } catch (e) {
        console.error('加载Prime成员失败:', e)
      }
    }

    loadPrime()
  }, [api, isReady])

  /**
   * 计算成员统计数据
   */
  useEffect(() => {
    if (members.length === 0) {
      setMemberInfos([])
      setTypeStats([])
      setStatusStats([])
      setMemberActivity([])
      return
    }

    // 成员投票统计
    const infos: MemberInfo[] = members.map((address) => {
      let totalVotes = 0
      let ayesCount = 0
      let naysCount = 0

      proposals.forEach((proposal) => {
        const votedAye = proposal.ayes.includes(address)
        const votedNay = proposal.nays.includes(address)

        if (votedAye) {
          totalVotes++
          ayesCount++
        }
        if (votedNay) {
          totalVotes++
          naysCount++
        }
      })

      const participationRate =
        proposals.length > 0 ? (totalVotes / proposals.length) * 100 : 0

      return {
        address,
        totalVotes,
        ayesCount,
        naysCount,
        participationRate
      }
    })

    // 按参与率排序
    infos.sort((a, b) => b.participationRate - a.participationRate)
    setMemberInfos(infos)

    // 提案类型统计
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

    // 提案状态统计
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

    // 成员活跃度（用于图表）
    const activity = infos.map((info) => ({
      address: formatAddress(info.address),
      fullAddress: info.address,
      votes: info.totalVotes
    }))

    setMemberActivity(activity)
  }, [members, proposals])

  /**
   * 表格列配置
   */
  const columns: ColumnsType<MemberInfo> = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_, __, index) => (
        <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'default'}>
          #{index + 1}
        </Tag>
      )
    },
    {
      title: '成员',
      dataIndex: 'address',
      key: 'address',
      render: (address) => (
        <Space>
          <Avatar src={generateAvatar(address)} size="small" />
          <Typography.Text
            copyable={{ text: address, onCopy: () => message.success('地址已复制') }}
          >
            {formatAddress(address)}
          </Typography.Text>
          {address === prime && (
            <Tag color="gold" icon={<CrownOutlined />}>
              Prime
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '总投票',
      dataIndex: 'totalVotes',
      key: 'totalVotes',
      width: 120,
      sorter: (a, b) => b.totalVotes - a.totalVotes,
      render: (votes) => <strong>{votes}</strong>
    },
    {
      title: '赞成',
      dataIndex: 'ayesCount',
      key: 'ayesCount',
      width: 100,
      render: (count) => (
        <span style={{ color: '#52c41a' }}>
          <CheckOutlined /> {count}
        </span>
      )
    },
    {
      title: '反对',
      dataIndex: 'naysCount',
      key: 'naysCount',
      width: 100,
      render: (count) => (
        <span style={{ color: '#ff4d4f' }}>
          <CloseOutlined /> {count}
        </span>
      )
    },
    {
      title: '参与率',
      dataIndex: 'participationRate',
      key: 'participationRate',
      width: 150,
      sorter: (a, b) => b.participationRate - a.participationRate,
      render: (rate) => (
        <div>
          <div>{rate.toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: '#999' }}>
            {rate === 100 ? '全勤' : rate > 80 ? '活跃' : rate > 50 ? '一般' : '不活跃'}
          </div>
        </div>
      )
    }
  ]

  /**
   * 计算总体统计
   */
  const totalStats = {
    totalProposals: proposals.length,
    executable: proposals.filter((p) => p.ayes.length >= p.threshold).length,
    avgParticipation:
      memberInfos.length > 0
        ? memberInfos.reduce((sum, m) => sum + m.participationRate, 0) /
          memberInfos.length
        : 0,
    mostActive: memberInfos[0]?.address || null
  }

  return (
    <div>
      {/* 总体统计 */}
      <Row gutter={[24, 24]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="委员会成员"
              value={memberCount}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="活跃提案"
              value={totalStats.totalProposals}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="可执行"
              value={totalStats.executable}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="平均参与率"
              value={totalStats.avgParticipation.toFixed(1)}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 成员列表 */}
      <Card
        title="成员列表与活跃度"
        style={{ marginTop: 24 }}
        extra={
          <Button icon={<ReloadOutlined />} loading={membersLoading}>
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={memberInfos}
          rowKey="address"
          loading={membersLoading}
          pagination={false}
          locale={{ emptyText: '暂无成员数据' }}
        />
      </Card>

      {/* 图表区域 */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="提案类型分布">
            {typeStats.length > 0 ? (
              <Pie {...pieConfig} />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>

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
      </Row>

      {/* 成员活跃度图表 */}
      {memberActivity.length > 0 && (
        <Card title="成员投票活跃度" style={{ marginTop: 24 }}>
          <Column {...columnConfig} />
        </Card>
      )}
    </div>
  )
}

