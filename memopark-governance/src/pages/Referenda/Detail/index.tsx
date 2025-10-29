import { useParams } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Progress,
  Alert,
  Button,
  Space,
  Typography,
  Divider,
  Statistic,
  Row,
  Col
} from 'antd'
import {
  ArrowLeftOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useReferendum } from '@/hooks/useReferenda'
import { useTrack } from '@/hooks/useTracks'
import {
  calculateApproval,
  getReferendumStatusText,
  getReferendumStatusColor,
  formatOrigin,
  getPreimageHash
} from '@/services/blockchain/referenda'
import { getTrackColor } from '@/services/blockchain/tracks'
import { formatBalance, copyToClipboard } from '@/utils/format'

/**
 * 公投详情页面
 * 显示单个公投的完整信息
 */
export default function ReferendumDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const refId = id ? Number(id) : 0
  const { referendum, loading } = useReferendum(refId)
  const { track } = useTrack(referendum?.trackId || 0)

  if (loading) {
    return (
      <Card loading={true}>
        <div style={{ height: 400 }} />
      </Card>
    )
  }

  if (!referendum) {
    return (
      <Card>
        <Alert
          message="公投不存在"
          description={`公投 #${refId} 不存在或已结束`}
          type="warning"
          showIcon
        />
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/referenda')}
          style={{ marginTop: 16 }}
        >
          返回公投列表
        </Button>
      </Card>
    )
  }

  const approval = calculateApproval(referendum.tally)
  const preimageHash = getPreimageHash(referendum.proposal)

  /**
   * 复制哈希
   */
  const handleCopyHash = async (hash: string) => {
    const success = await copyToClipboard(hash)
    if (success) {
      message.success('哈希已复制')
    }
  }

  return (
    <div>
      <Card>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/referenda')}
          style={{ marginBottom: 16 }}
        >
          返回列表
        </Button>

        <Typography.Title level={3}>公投 #{referendum.id} 详情</Typography.Title>

        {/* 基本信息 */}
        <Card title="基本信息" size="small" style={{ marginTop: 16 }}>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="公投ID">{referendum.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getReferendumStatusColor(referendum)}>
                {getReferendumStatusText(referendum)}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="轨道" span={2}>
              <Space>
                <Tag color={getTrackColor(referendum.trackId)}>
                  {track?.name || `Track ${referendum.trackId}`}
                </Tag>
                {track && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    决策期: {formatBlocks(track.decisionPeriod)} | 
                    押金: {formatBalance(track.decisionDeposit)} DUST
                  </Typography.Text>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="Origin">
              <Tag color="purple">{formatOrigin(referendum.origin)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="提交时间">
              {referendum.submitted ? `区块 #${referendum.submitted}` : '-'}
            </Descriptions.Item>

            <Descriptions.Item label="提交押金">
              {formatBalance(referendum.submissionDeposit.amount)} DUST
            </Descriptions.Item>
            <Descriptions.Item label="提交人">
              <Typography.Text
                copyable={{ text: referendum.submissionDeposit.who }}
                style={{ fontSize: 11 }}
              >
                {referendum.submissionDeposit.who.slice(0, 8)}...
                {referendum.submissionDeposit.who.slice(-8)}
              </Typography.Text>
            </Descriptions.Item>

            {referendum.decisionDeposit && (
              <>
                <Descriptions.Item label="决策押金">
                  {formatBalance(referendum.decisionDeposit.amount)} DUST
                </Descriptions.Item>
                <Descriptions.Item label="决策人">
                  <Typography.Text
                    copyable={{ text: referendum.decisionDeposit.who }}
                    style={{ fontSize: 11 }}
                  >
                    {referendum.decisionDeposit.who.slice(0, 8)}...
                    {referendum.decisionDeposit.who.slice(-8)}
                  </Typography.Text>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </Card>

        {/* 投票情况 */}
        <Card title="投票情况" size="small" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="批准率"
                  value={approval.toFixed(2)}
                  suffix="%"
                  valueStyle={{
                    color: approval >= 50 ? '#52c41a' : '#ff4d4f'
                  }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Aye票数"
                  value={formatBalance(referendum.tally.ayes)}
                  suffix="DUST"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Nay票数"
                  value={formatBalance(referendum.tally.nays)}
                  suffix="DUST"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>

          <Divider />

          <div>
            <div style={{ marginBottom: 8 }}>投票批准率：</div>
            <Progress
              percent={approval}
              status={approval >= 50 ? 'success' : 'exception'}
              strokeColor={approval >= 50 ? '#52c41a' : '#ff4d4f'}
            />
          </div>
        </Card>

        {/* Preimage */}
        {preimageHash && (
          <Card title="Preimage" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Typography.Text strong>Preimage Hash:</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space>
                    <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                      {preimageHash}
                    </code>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopyHash(preimageHash)}
                    >
                      复制
                    </Button>
                  </Space>
                </div>
              </div>

              <Alert
                message="查看Preimage内容"
                description="Preimage包含提案的实际调用内容。您可以在Polkadot.js Apps中查看或使用API解析。"
                type="info"
                showIcon
              />
            </Space>
          </Card>
        )}

        {/* 时间线 */}
        {referendum.deciding && (
          <Card title="决策时间线" size="small" style={{ marginTop: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="决策开始区块">
                #{referendum.deciding.since}
              </Descriptions.Item>

              {referendum.deciding.confirming !== null && (
                <Descriptions.Item label="确认开始区块">
                  <Tag color="blue">#{referendum.deciding.confirming}</Tag>
                </Descriptions.Item>
              )}

              <Descriptions.Item label="当前阶段">
                <Tag color={getReferendumStatusColor(referendum)}>
                  {getReferendumStatusText(referendum)}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 管理操作（仅Root） */}
        <Card title="管理操作" size="small" style={{ marginTop: 16 }}>
          <Alert
            message="需要Root权限"
            description="取消公投、强制通过等操作需要Root权限。"
            type="warning"
            showIcon
          />
          <Space style={{ marginTop: 12 }}>
            <Button danger disabled>
              取消公投（需Root）
            </Button>
            <Button type="primary" disabled>
              强制通过（需Root）
            </Button>
          </Space>
        </Card>
      </Card>
    </div>
  )
}

// 导入message和formatBlocks
import { message } from 'antd'
import { formatBlocks } from '@/services/blockchain/tracks'

