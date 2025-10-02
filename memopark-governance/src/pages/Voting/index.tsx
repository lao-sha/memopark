import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tabs,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  Button,
  message,
  Modal,
  Alert
} from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { useProposals } from '@/hooks/useProposals'
import { signAndSendBatch } from '@/services/wallet/signer'
import { createVoteTx } from '@/services/blockchain/council'
import type { ProposalInfo } from '@/services/blockchain/council'
import type { ColumnsType } from 'antd/es/table'

/**
 * 投票管理页面
 * 包含：我的投票记录、批量投票功能
 */
export default function Voting() {
  const { api } = useApi()
  const { activeAccount } = useWallet()
  const { proposals, loading, reload } = useProposals()
  const [activeTab, setActiveTab] = useState('my-votes')
  const [selectedProposalIds, setSelectedProposalIds] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    ayes: 0,
    nays: 0
  })

  // 我的投票记录
  const [myVotes, setMyVotes] = useState<ProposalInfo[]>([])

  // 未投票的提案
  const [pendingVotes, setPendingVotes] = useState<ProposalInfo[]>([])

  /**
   * 更新投票统计和分类
   */
  useEffect(() => {
    if (!activeAccount) {
      setMyVotes([])
      setPendingVotes([])
      setStats({ total: 0, ayes: 0, nays: 0 })
      return
    }

    const voted: ProposalInfo[] = []
    const pending: ProposalInfo[] = []
    let ayesCount = 0
    let naysCount = 0

    proposals.forEach((proposal) => {
      const hasVotedAye = proposal.ayes.includes(activeAccount)
      const hasVotedNay = proposal.nays.includes(activeAccount)

      if (hasVotedAye || hasVotedNay) {
        voted.push(proposal)
        if (hasVotedAye) ayesCount++
        if (hasVotedNay) naysCount++
      } else {
        pending.push(proposal)
      }
    })

    setMyVotes(voted)
    setPendingVotes(pending)
    setStats({
      total: voted.length,
      ayes: ayesCount,
      nays: naysCount
    })
  }, [proposals, activeAccount])

  /**
   * 批量投票处理
   */
  const handleBatchVote = async (approve: boolean) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (selectedProposalIds.length === 0) {
      message.warning('请至少选择一个提案')
      return
    }

    Modal.confirm({
      title: `批量${approve ? '赞成' : '反对'}`,
      content: `确定对 ${selectedProposalIds.length} 个提案投${approve ? '赞成' : '反对'}票吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setBatchLoading(true)
        try {
          // 构建批量投票交易
          const calls = selectedProposalIds.map((index) => {
            const proposal = pendingVotes.find((p) => p.index === index)
            if (!proposal) throw new Error(`提案 #${index} 不存在`)
            return createVoteTx(api, proposal.hash, proposal.index, approve)
          })

          message.loading({ content: '正在批量投票...', key: 'batch-vote', duration: 0 })

          await signAndSendBatch(api, activeAccount, calls, {
            onSuccess: () => {
              message.success({
                content: `批量投票成功！已对 ${selectedProposalIds.length} 个提案投${approve ? '赞成' : '反对'}票`,
                key: 'batch-vote',
                duration: 3
              })
              setSelectedProposalIds([])
              setTimeout(() => reload(), 3000)
            },
            onError: (error) => {
              message.error({
                content: '批量投票失败：' + error.message,
                key: 'batch-vote',
                duration: 5
              })
            }
          })
        } catch (e: any) {
          message.error('操作失败：' + (e?.message || ''))
        } finally {
          setBatchLoading(false)
        }
      }
    })
  }

  /**
   * 我的投票列表列配置
   */
  const myVotesColumns: ColumnsType<ProposalInfo> = [
    {
      title: 'ID',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      render: (index) => <strong>#{index}</strong>
    },
    {
      title: '调用内容',
      dataIndex: 'call',
      key: 'call',
      render: (call) => {
        if (!call) return <Tag>未知</Tag>
        if (call.section === 'marketMaker' && call.method === 'approve') {
          return (
            <Space>
              <Tag color="green">批准</Tag>
              <span>做市商 #{call.args[0]}</span>
            </Space>
          )
        }
        if (call.section === 'marketMaker' && call.method === 'reject') {
          return (
            <Space>
              <Tag color="red">驳回</Tag>
              <span>做市商 #{call.args[0]}</span>
              <Tag>{call.args[1]} bps</Tag>
            </Space>
          )
        }
        return <Tag>{call.section}.{call.method}</Tag>
      }
    },
    {
      title: '我的投票',
      key: 'myVote',
      width: 100,
      render: (_, record) => {
        const votedAye = record.ayes.includes(activeAccount || '')
        const votedNay = record.nays.includes(activeAccount || '')

        if (votedAye) {
          return <Tag color="success" icon={<CheckOutlined />}>赞成</Tag>
        }
        if (votedNay) {
          return <Tag color="error" icon={<CloseOutlined />}>反对</Tag>
        }
        return null
      }
    },
    {
      title: '当前进度',
      key: 'progress',
      width: 150,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.ayes.length}/{record.threshold}</div>
          {record.ayes.length >= record.threshold && (
            <Tag color="success" style={{ marginTop: 4 }}>已达阈值</Tag>
          )}
        </div>
      )
    }
  ]

  /**
   * 批量投票列表列配置
   */
  const batchVoteColumns: ColumnsType<ProposalInfo> = [
    {
      title: 'ID',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      render: (index) => <strong>#{index}</strong>
    },
    {
      title: '调用内容',
      dataIndex: 'call',
      key: 'call',
      render: (call) => {
        if (!call) return <Tag>未知</Tag>
        if (call.section === 'marketMaker' && call.method === 'approve') {
          return (
            <Space>
              <Tag color="green">批准</Tag>
              <span>做市商 #{call.args[0]}</span>
            </Space>
          )
        }
        if (call.section === 'marketMaker' && call.method === 'reject') {
          return (
            <Space>
              <Tag color="red">驳回</Tag>
              <span>做市商 #{call.args[0]}</span>
              <Tag>{call.args[1]} bps</Tag>
            </Space>
          )
        }
        return <Tag>{call.section}.{call.method}</Tag>
      }
    },
    {
      title: '进度',
      key: 'progress',
      width: 120,
      render: (_, record) => `${record.ayes.length}/${record.threshold}`
    }
  ]

  /**
   * Tab项配置
   */
  const tabItems = [
    {
      key: 'my-votes',
      label: `我的投票 (${myVotes.length})`,
      children: (
        <div>
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="总投票"
                  value={stats.total}
                  suffix="票"
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="赞成"
                  value={stats.ayes}
                  suffix="票"
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="反对"
                  value={stats.nays}
                  suffix="票"
                  valueStyle={{ color: '#ff4d4f' }}
                  prefix={<CloseOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* 投票记录表格 */}
          <Table
            columns={myVotesColumns}
            dataSource={myVotes}
            rowKey="hash"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 条投票记录`
            }}
            locale={{ emptyText: '暂无投票记录' }}
          />
        </div>
      )
    },
    {
      key: 'batch-vote',
      label: `批量投票 (${pendingVotes.length})`,
      children: (
        <div>
          {/* 批量操作栏 */}
          <Space style={{ marginBottom: 16 }} wrap>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleBatchVote(true)}
              disabled={selectedProposalIds.length === 0}
              loading={batchLoading}
            >
              批量赞成 ({selectedProposalIds.length})
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => handleBatchVote(false)}
              disabled={selectedProposalIds.length === 0}
              loading={batchLoading}
            >
              批量反对 ({selectedProposalIds.length})
            </Button>
            <Button
              onClick={() => setSelectedProposalIds(pendingVotes.map((p) => p.index))}
            >
              全选
            </Button>
            <Button onClick={() => setSelectedProposalIds([])}>清空</Button>
          </Space>

          {/* 未投票提案表格 */}
          <Table
            columns={batchVoteColumns}
            dataSource={pendingVotes}
            rowKey="index"
            rowSelection={{
              selectedRowKeys: selectedProposalIds,
              onChange: (selectedKeys) => setSelectedProposalIds(selectedKeys as number[])
            }}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 个未投票提案`
            }}
            locale={{ emptyText: '暂无未投票提案' }}
          />
        </div>
      )
    }
  ]

  return (
    <Card
      title="投票管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
          刷新
        </Button>
      }
    >
      {!activeAccount && (
        <Alert
          message="请先连接钱包"
          description="您需要连接钱包才能查看投票记录"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Card>
  )
}

