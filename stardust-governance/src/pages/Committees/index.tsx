import { useState } from 'react'
import {
  Card,
  Descriptions,
  Tabs,
  Table,
  Tag,
  Progress,
  Space,
  Button,
  Alert,
  List,
  Avatar,
  Statistic,
  Row,
  Col,
  Typography,
  Modal,
  message
} from 'antd'
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  CrownOutlined,
  TeamOutlined,
  CodeOutlined,
  SafetyOutlined
} from '@ant-design/icons'
import CommitteeSwitch from '@/components/CommitteeSwitch'
import { useCollective } from '@/hooks/useCollective'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { signAndSend } from '@/services/wallet/signer'
import { createVoteTx, createCloseTx } from '@/services/blockchain/council'
import { formatAddress, generateAvatar } from '@/utils/format'
import type { CommitteeType } from '@/types/committee'
import type { ProposalInfo } from '@/services/blockchain/council'
import type { ColumnsType } from 'antd/es/table'

/**
 * 获取图标组件
 */
function getIcon(iconName: string) {
  const icons: Record<string, any> = {
    TeamOutlined: <TeamOutlined />,
    CodeOutlined: <CodeOutlined />,
    SafetyOutlined: <SafetyOutlined />
  }
  return icons[iconName] || <TeamOutlined />
}

/**
 * 委员会管理页面
 * 统一管理3个委员会（Council、Technical、Content）
 */
export default function CommitteesPage() {
  const { api } = useApi()
  const { activeAccount } = useWallet()
  const [currentCommittee, setCurrentCommittee] = useState<CommitteeType>('council')
  const [activeTab, setActiveTab] = useState('proposals')
  const [actionLoading, setActionLoading] = useState(false)

  // 使用通用委员会Hook
  const { proposals, members, prime, isMember, loading, config, reload } =
    useCollective(currentCommittee)

  /**
   * 投票处理
   */
  const handleVote = async (proposal: ProposalInfo, approve: boolean) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (!isMember) {
      message.error(`您不是${config.name}成员，无权投票`)
      return
    }

    Modal.confirm({
      title: approve ? '投赞成票' : '投反对票',
      content: `确定对${config.name}提案 #${proposal.index} 投${approve ? '赞成' : '反对'}票吗？`,
      onOk: async () => {
        setActionLoading(true)
        try {
          const tx = createVoteTx(api, proposal.hash, proposal.index, approve)

          await signAndSend(activeAccount, tx, {
            onSuccess: () => {
              message.success(`投票成功！`)
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
      content: `确定执行${config.name}提案 #${proposal.index} 吗？`,
      onOk: async () => {
        setActionLoading(true)
        try {
          const tx = createCloseTx(
            api,
            proposal.hash,
            proposal.index,
            { refTime: 1_000_000_000, proofSize: 1000 },
            1000
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
   * 提案列表列配置
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
      render: (call) => {
        if (!call) return <Tag>未知调用</Tag>
        return (
          <Space>
            <Tag>{call.section}.{call.method}</Tag>
            {call.args && call.args.length > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                ({call.args.length}个参数)
              </Typography.Text>
            )}
          </Space>
        )
      }
    },
    {
      title: '投票进度',
      key: 'progress',
      width: 220,
      render: (_, record) => {
        const ayesCount = record.ayes.length
        const percent = (ayesCount / record.threshold) * 100
        const canExecute = ayesCount >= record.threshold

        return (
          <div>
            <Progress
              percent={Math.min(percent, 100)}
              status={canExecute ? 'success' : 'active'}
              format={() => `${ayesCount}/${record.threshold}`}
            />
            <div style={{ fontSize: 11, marginTop: 4 }}>
              <Space split="|">
                <span style={{ color: '#52c41a' }}>赞成: {ayesCount}</span>
                <span style={{ color: '#ff4d4f' }}>反对: {record.nays.length}</span>
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
        return canExecute ? <Tag color="success">可执行</Tag> : <Tag>投票中</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        const hasVoted =
          record.ayes.includes(activeAccount || '') ||
          record.nays.includes(activeAccount || '')
        const canExecute = record.ayes.length >= record.threshold

        return (
          <Space direction="vertical" size={4}>
            {!hasVoted && isMember && (
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
                style={{ width: '100%' }}
              >
                执行
              </Button>
            )}
          </Space>
        )
      }
    }
  ]

  /**
   * Tab配置
   */
  const tabItems = [
    {
      key: 'proposals',
      label: `提案列表 (${proposals.length})`,
      children: (
        <div>
          {!isMember && (
            <Alert
              message="权限提示"
              description={`您不是${config.name}成员，只能查看提案，无法投票。`}
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
              pageSize: 10,
              showTotal: (total) => `共 ${total} 个提案`
            }}
            locale={{ emptyText: '暂无活跃提案' }}
            scroll={{ x: 1000 }}
          />
        </div>
      )
    },
    {
      key: 'members',
      label: `成员列表 (${members.length})`,
      children: (
        <div>
          <List
            dataSource={members}
            renderItem={(member) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={generateAvatar(member)} />}
                  title={
                    <Space>
                      <Typography.Text copyable={{ text: member }}>
                        {formatAddress(member)}
                      </Typography.Text>
                      {member === prime && (
                        <Tag color="gold" icon={<CrownOutlined />}>
                          Prime
                        </Tag>
                      )}
                      {member === activeAccount && (
                        <Tag color="blue">当前账户</Tag>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `共 ${total} 个成员`
            }}
          />
        </div>
      )
    }
  ]

  return (
    <div>
      <Card>
        {/* 委员会切换器 */}
        <CommitteeSwitch
          value={currentCommittee}
          onChange={(type) => {
            setCurrentCommittee(type)
            setActiveTab('proposals')
          }}
        />

        {/* 委员会信息 */}
        <Descriptions
          column={3}
          bordered
          size="small"
          style={{ marginTop: 16 }}
        >
          <Descriptions.Item label="名称">
            <Space>
              {getIcon(config.iconName)}
              <span>{config.name}</span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="成员数">
            {members.length} 人
          </Descriptions.Item>
          <Descriptions.Item label="默认阈值">
            {config.defaultThreshold} / {members.length}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>
            {config.description}
          </Descriptions.Item>
          <Descriptions.Item label="职责范围" span={3}>
            <Space wrap>
              {config.responsibilities.map((r, i) => (
                <Tag key={i} color={config.color}>
                  {r}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>

        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="活跃提案"
                value={proposals.length}
                valueStyle={{ color: config.color }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="可执行"
                value={proposals.filter((p) => p.ayes.length >= p.threshold).length}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="我的投票"
                value={
                  proposals.filter(
                    (p) =>
                      p.ayes.includes(activeAccount || '') ||
                      p.nays.includes(activeAccount || '')
                  ).length
                }
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Tab内容 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginTop: 16 }}
          tabBarExtraContent={
            <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
              刷新
            </Button>
          }
        />
      </Card>
    </div>
  )
}

