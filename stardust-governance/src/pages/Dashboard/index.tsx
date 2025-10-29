import { Row, Col, Card, Statistic, Alert, Button, Space, List, Tag } from 'antd'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { useProposals } from '@/hooks/useProposals'
import { useCouncilMembers } from '@/hooks/useCouncilMembers'

/**
 * 仪表盘页面
 * 显示关键统计数据和快速操作
 */
export default function Dashboard() {
  const navigate = useNavigate()
  const { isReady, error } = useApi()
  const { isConnected, activeAccount } = useWallet()
  const { proposals } = useProposals()
  const { memberCount, members } = useCouncilMembers()

  // 计算统计数据
  const stats = {
    totalProposals: proposals.length,
    executable: proposals.filter((p) => p.ayes.length >= p.threshold).length,
    myVotesToday: proposals.filter((p) => 
      p.ayes.includes(activeAccount || '') || p.nays.includes(activeAccount || '')
    ).length,
    activeMembers: members.length
  }

  // 最近的提案
  const recentProposals = proposals.slice(0, 5)

  // 显示连接状态
  if (!isReady) {
    return (
      <Alert
        message="正在连接区块链节点..."
        description="请稍候，系统正在建立与区块链的连接"
        type="info"
        showIcon
      />
    )
  }

  if (error) {
    return (
      <Alert
        message="连接失败"
        description={error.message}
        type="error"
        showIcon
      />
    )
  }

  if (!isConnected) {
    return (
      <Alert
        message="请连接钱包"
        description="您需要连接钱包才能使用治理功能"
        type="warning"
        showIcon
      />
    )
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃提案"
              value={stats.totalProposals}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="可执行"
              value={stats.executable}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="我的投票"
              value={stats.myVotesToday}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="委员会成员"
              value={`${stats.activeMembers}/${memberCount}`}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card title="快速操作" style={{ marginTop: 24 }}>
        <Space size="large" wrap>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate('/proposals/create')}
          >
            创建新提案
          </Button>

          <Button
            size="large"
            onClick={() => navigate('/proposals')}
          >
            查看提案列表
          </Button>

          <Button
            size="large"
            onClick={() => navigate('/applications')}
          >
            审核申请
          </Button>
        </Space>
      </Card>

      {/* 最近提案 */}
      {recentProposals.length > 0 && (
        <Card title="最近提案" style={{ marginTop: 24 }}>
          <List
            dataSource={recentProposals}
            renderItem={(proposal) => {
              const canExecute = proposal.ayes.length >= proposal.threshold
              
              return (
                <List.Item
                  key={proposal.hash}
                  actions={[
                    <Button
                      type="link"
                      onClick={() => navigate(`/proposals`)}
                    >
                      查看
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>提案 #{proposal.index}</span>
                        {canExecute && <Tag color="success">可执行</Tag>}
                      </Space>
                    }
                    description={
                      <Space>
                        {proposal.call?.section === 'marketMaker' && proposal.call?.method === 'approve' && (
                          <Tag color="green">批准做市商 #{proposal.call.args[0]}</Tag>
                        )}
                        {proposal.call?.section === 'marketMaker' && proposal.call?.method === 'reject' && (
                          <Tag color="red">驳回做市商 #{proposal.call.args[0]}</Tag>
                        )}
                        <span style={{ fontSize: 12, color: '#999' }}>
                          进度: {proposal.ayes.length}/{proposal.threshold}
                        </span>
                      </Space>
                    }
                  />
                </List.Item>
              )
            }}
          />
        </Card>
      )}

      {/* 提示信息 */}
      <Alert
        message="欢迎使用 Memopark 治理平台"
        description="这是一个专业的委员会提案和投票管理系统。您可以创建提案、投票决策、审核申请、查看数据分析等。"
        type="success"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  )
}

