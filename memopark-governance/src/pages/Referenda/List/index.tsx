import { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Progress,
  Space,
  Button,
  Menu,
  Row,
  Col,
  Statistic,
  Alert
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useReferenda } from '@/hooks/useReferenda'
import { useTracks } from '@/hooks/useTracks'
import {
  calculateApproval,
  getReferendumStatusText,
  getReferendumStatusColor,
  formatOrigin,
  getPreimageHash
} from '@/services/blockchain/referenda'
import { getTrackColor, getTrackName } from '@/services/blockchain/tracks'
import { formatBalance } from '@/utils/format'
import type { ReferendumInfo } from '@/services/blockchain/referenda'
import type { ColumnsType } from 'antd/es/table'

/**
 * 公投列表页面
 * 按轨道分类展示所有公投
 */
export default function ReferendaList() {
  const navigate = useNavigate()
  const [selectedTrack, setSelectedTrack] = useState<number | undefined>()
  const { tracks } = useTracks()
  const { referenda, loading, reload } = useReferenda(selectedTrack)

  // 计算统计数据
  const stats = {
    total: referenda.length,
    deciding: referenda.filter((r) => r.deciding !== null).length,
    confirming: referenda.filter((r) => r.deciding?.confirming !== null).length,
    inQueue: referenda.filter((r) => r.inQueue).length
  }

  // 按轨道统计
  const trackCounts = tracks.reduce((acc, track) => {
    acc[track.id] = referenda.filter((r) => r.trackId === track.id).length
    return acc
  }, {} as Record<number, number>)

  /**
   * 表格列配置
   */
  const columns: ColumnsType<ReferendumInfo> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id) => <strong>#{id}</strong>
    },
    {
      title: '轨道',
      dataIndex: 'trackId',
      key: 'trackId',
      width: 180,
      render: (trackId) => (
        <Tag color={getTrackColor(trackId)}>{getTrackName(trackId)}</Tag>
      )
    },
    {
      title: 'Origin',
      dataIndex: 'origin',
      key: 'origin',
      width: 120,
      render: (origin) => (
        <Tag color="purple">{formatOrigin(origin)}</Tag>
      )
    },
    {
      title: 'Preimage',
      key: 'preimage',
      width: 150,
      render: (_, record) => {
        const hash = getPreimageHash(record.proposal)
        return hash ? (
          <code style={{ fontSize: 11 }}>
            {hash.slice(0, 8)}...{hash.slice(-8)}
          </code>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )
      }
    },
    {
      title: '投票进度',
      key: 'tally',
      width: 220,
      render: (_, record) => {
        const approval = calculateApproval(record.tally)

        return (
          <div>
            <Progress
              percent={approval}
              status={approval >= 50 ? 'success' : 'active'}
              format={() => `${approval.toFixed(1)}%`}
            />
            <div style={{ fontSize: 11, marginTop: 4 }}>
              <Space split="|">
                <span style={{ color: '#52c41a' }}>
                  Aye: {formatBalance(record.tally.ayes)}
                </span>
                <span style={{ color: '#ff4d4f' }}>
                  Nay: {formatBalance(record.tally.nays)}
                </span>
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
      render: (_, record) => (
        <Tag color={getReferendumStatusColor(record)}>
          {getReferendumStatusText(record)}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/referenda/${record.id}`)}
        >
          查看详情
        </Button>
      )
    }
  ]

  return (
    <div>
      <Row gutter={24}>
        {/* 左侧：轨道筛选 */}
        <Col span={6}>
          <Card title="按轨道筛选" style={{ marginBottom: 16 }}>
            <Menu
              selectedKeys={selectedTrack !== undefined ? [String(selectedTrack)] : ['all']}
              onClick={({ key }) =>
                setSelectedTrack(key === 'all' ? undefined : Number(key))
              }
              mode="inline"
            >
              <Menu.Item key="all">
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>全部轨道</span>
                  <Tag>{referenda.length}</Tag>
                </Space>
              </Menu.Item>

              <Menu.Divider />

              {tracks.map((track) => (
                <Menu.Item key={track.id}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Tag color={getTrackColor(track.id)} style={{ margin: 0 }}>
                        {track.name}
                      </Tag>
                    </Space>
                    <Tag>{trackCounts[track.id] || 0}</Tag>
                  </Space>
                </Menu.Item>
              ))}
            </Menu>
          </Card>

          {/* 统计卡片 */}
          <Card title="统计" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic title="总公投" value={stats.total} />
              <Statistic
                title="决策中"
                value={stats.deciding}
                valueStyle={{ color: '#52c41a' }}
              />
              <Statistic
                title="确认中"
                value={stats.confirming}
                valueStyle={{ color: '#1890ff' }}
              />
              <Statistic
                title="队列中"
                value={stats.inQueue}
                valueStyle={{ color: '#faad14' }}
              />
            </Space>
          </Card>
        </Col>

        {/* 右侧：公投列表 */}
        <Col span={18}>
          <Card
            title={
              <Space>
                <span>公投列表</span>
                {selectedTrack !== undefined && (
                  <Tag color={getTrackColor(selectedTrack)}>
                    {getTrackName(selectedTrack)}
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>
                刷新
              </Button>
            }
          >
            <Alert
              message="公投说明"
              description="公投（Referenda）是OpenGov的核心机制，允许代币持有者直接投票决策。不同轨道的公投有不同的参数配置。"
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              style={{ marginBottom: 16 }}
              closable
            />

            <Table
              columns={columns}
              dataSource={referenda}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showTotal: (total) => `共 ${total} 个公投`
              }}
              locale={{ emptyText: '暂无进行中的公投' }}
              scroll={{ x: 1000 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

