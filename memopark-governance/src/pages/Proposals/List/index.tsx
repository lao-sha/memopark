import { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Progress,
  message,
  Modal,
  Alert
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useProposals } from '@/hooks/useProposals'
import { useWallet } from '@/contexts/Wallet'
import { useApi } from '@/contexts/Api'
import { useCouncilMembers } from '@/hooks/useCouncilMembers'
import { signAndSend } from '@/services/wallet/signer'
import { createVoteTx, createCloseTx } from '@/services/blockchain/council'
import type { ProposalInfo } from '@/services/blockchain/council'
import type { ColumnsType } from 'antd/es/table'

/**
 * 提案列表页面
 * 参考：Polkadot.js Apps packages/page-council/src/Motions
 */
export default function ProposalList() {
  const navigate = useNavigate()
  const { api } = useApi()
  const { activeAccount } = useWallet()
  const { isCurrentMember } = useCouncilMembers()
  const { proposals, loading, reload } = useProposals()
  const [actionLoading, setActionLoading] = useState(false)

  /**
   * 投票处理
   */
  const handleVote = async (proposal: ProposalInfo, approve: boolean) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (!isCurrentMember) {
      message.error('您不是委员会成员，无权投票')
      return
    }

    Modal.confirm({
      title: approve ? '投赞成票' : '投反对票',
      content: `确定对提案 #${proposal.index} 投${approve ? '赞成' : '反对'}票吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true)
        try {
          const tx = createVoteTx(api, proposal.hash, proposal.index, approve)

          await signAndSend(activeAccount, tx, {
            onSuccess: () => {
              message.success(`投票成功！已投${approve ? '赞成' : '反对'}票`)
              setTimeout(() => reload(), 3000)
            },
            onError: (error) => {
              message.error('投票失败：' + error.message)
            }
          })
        } catch (e: any) {
          message.error('操作失败：' + (e?.message || ''))
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  /**
   * 执行提案
   */
  const handleExecute = async (proposal: ProposalInfo) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    Modal.confirm({
      title: '执行提案',
      content: `确定执行提案 #${proposal.index} 吗？提案已达到投票阈值。`,
      okText: '确认执行',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true)
        try {
          const weightBound = {
            refTime: 1_000_000_000,
            proofSize: 1000
          }
          const lengthBound = 1000

          const tx = createCloseTx(
            api,
            proposal.hash,
            proposal.index,
            weightBound,
            lengthBound
          )

          await signAndSend(activeAccount, tx, {
            onSuccess: () => {
              message.success('提案执行成功！')
              setTimeout(() => reload(), 3000)
            },
            onError: (error) => {
              message.error('执行失败：' + error.message)
            }
          })
        } catch (e: any) {
          message.error('操作失败：' + (e?.message || ''))
        } finally {
          setActionLoading(false)
        }
      }
    })
  }

  /**
   * 渲染调用信息
   */
  const renderCall = (call: ProposalInfo['call']) => {
    if (!call) return <Tag>未知调用</Tag>

    const { section, method, args } = call

    if (section === 'marketMaker' && method === 'approve') {
      return (
        <Space>
          <Tag color="green">批准做市商</Tag>
          <span>#{args[0]}</span>
        </Space>
      )
    }

    if (section === 'marketMaker' && method === 'reject') {
      return (
        <Space>
          <Tag color="red">驳回做市商</Tag>
          <span>#{args[0]}</span>
          <Tag>{args[1]} bps</Tag>
        </Space>
      )
    }

    return <Tag>{section}.{method}</Tag>
  }

  /**
   * 表格列配置
   */
  const columns: ColumnsType<ProposalInfo> = [
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
      render: renderCall
    },
    {
      title: '投票进度',
      key: 'progress',
      width: 250,
      render: (_, record) => {
        const ayesCount = record.ayes.length
        const naysCount = record.nays.length
        const percent = (ayesCount / record.threshold) * 100
        const canExecute = ayesCount >= record.threshold

        return (
          <div>
            <Progress
              percent={Math.min(percent, 100)}
              status={canExecute ? 'success' : 'active'}
              format={() => `${ayesCount}/${record.threshold}`}
            />
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <Space split="|">
                <span style={{ color: '#52c41a' }}>赞成: {ayesCount}</span>
                <span style={{ color: '#ff4d4f' }}>反对: {naysCount}</span>
              </Space>
            </div>
          </div>
        )
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const canExecute = record.ayes.length >= record.threshold
        const hasVoted = 
          record.ayes.includes(activeAccount || '') ||
          record.nays.includes(activeAccount || '')

        return (
          <Space direction="vertical" size={4}>
            {canExecute && <Tag color="success">可执行</Tag>}
            {hasVoted && (
              <Tag color={record.ayes.includes(activeAccount || '') ? 'green' : 'red'}>
                已投票
              </Tag>
            )}
          </Space>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const hasVoted =
          record.ayes.includes(activeAccount || '') ||
          record.nays.includes(activeAccount || '')
        const canExecute = record.ayes.length >= record.threshold

        return (
          <Space direction="vertical" size={4}>
            {!hasVoted && isCurrentMember && (
              <Space size={4}>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleVote(record, true)}
                  loading={actionLoading}
                >
                  赞成
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleVote(record, false)}
                  loading={actionLoading}
                >
                  反对
                </Button>
              </Space>
            )}

            {canExecute && (
              <Button
                type="primary"
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => handleExecute(record)}
                loading={actionLoading}
                style={{ background: '#722ed1', width: '100%' }}
              >
                执行提案
              </Button>
            )}

            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/proposals/${record.index}`)}
            >
              查看详情
            </Button>
          </Space>
        )
      }
    }
  ]

  return (
    <div>
      <Card
        title="提案列表"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={reload}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/proposals/create')}
            >
              创建提案
            </Button>
          </Space>
        }
      >
        {!isCurrentMember && (
          <Alert
            message="权限提示"
            description="您不是委员会成员，只能查看提案，无法投票。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={proposals}
          rowKey="hash"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个提案`
          }}
          locale={{
            emptyText: '暂无活跃提案'
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  )
}
