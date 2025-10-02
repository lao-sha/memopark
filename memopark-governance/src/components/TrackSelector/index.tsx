import { Card, Space, Tag, Typography, Descriptions, Row, Col, Spin } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useTracks, useTracksByCategory } from '@/hooks/useTracks'
import {
  getTrackColor,
  getTrackRiskLevel,
  getTrackRiskLabel,
  getTrackCategory,
  formatBlocks
} from '@/services/blockchain/tracks'
import { formatBalance } from '@/utils/format'
import type { TrackInfo } from '@/services/blockchain/tracks'

/**
 * 轨道选择器组件
 * 用于选择治理轨道
 */
interface Props {
  value?: number
  onChange?: (trackId: number) => void
  showDetails?: boolean
  filter?: (track: TrackInfo) => boolean
}

export default function TrackSelector({ value, onChange, showDetails = true, filter }: Props) {
  const { tracks, loading } = useTracks()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载轨道配置..." />
      </div>
    )
  }

  const displayTracks = filter ? tracks.filter(filter) : tracks

  if (displayTracks.length === 0) {
    return (
      <Card>
        <Typography.Text type="secondary">暂无可用轨道</Typography.Text>
      </Card>
    )
  }

  return (
    <div>
      <Typography.Title level={5} style={{ marginBottom: 16 }}>
        选择治理轨道
      </Typography.Title>

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {displayTracks.map((track) => {
          const riskLevel = getTrackRiskLevel(track.id)
          const isSelected = value === track.id

          return (
            <Card
              key={track.id}
              size="small"
              hoverable
              onClick={() => onChange?.(track.id)}
              style={{
                border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                background: isSelected ? '#e6f4ff' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {/* 标题行 */}
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Tag color={getTrackColor(track.id)} style={{ fontSize: 14 }}>
                      {track.name}
                    </Tag>
                    <Tag color={getTrackCategory(track.id) === '财务' ? 'green' : 'blue'}>
                      {getTrackCategory(track.id)}
                    </Tag>
                  </Space>
                  {isSelected && (
                    <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                  )}
                </Space>

                {/* 风险等级 */}
                <div>
                  <span style={{ fontSize: 12, marginRight: 8 }}>风险等级：</span>
                  <Tag
                    style={{ 
                      fontSize: 12,
                      backgroundColor: riskLevel >= 4 ? '#fff1f0' : riskLevel >= 3 ? '#fffbe6' : '#f6ffed',
                      color: riskLevel >= 4 ? '#cf1322' : riskLevel >= 3 ? '#d48806' : '#389e0d',
                      borderColor: riskLevel >= 4 ? '#ffa39e' : riskLevel >= 3 ? '#ffe58f' : '#b7eb8f'
                    }}
                  >
                    {'⭐'.repeat(riskLevel)} {getTrackRiskLabel(riskLevel)}
                  </Tag>
                </div>

                {/* 详细参数 */}
                {showDetails && (
                  <Descriptions size="small" column={2}>
                    <Descriptions.Item label="决策押金">
                      <strong>{formatBalance(track.decisionDeposit)} MEMO</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="最大并发">
                      {track.maxDeciding}
                    </Descriptions.Item>

                    <Descriptions.Item label="准备期">
                      {formatBlocks(track.preparePeriod)}
                    </Descriptions.Item>
                    <Descriptions.Item label="决策期">
                      <strong>{formatBlocks(track.decisionPeriod)}</strong>
                    </Descriptions.Item>

                    <Descriptions.Item label="确认期">
                      {formatBlocks(track.confirmPeriod)}
                    </Descriptions.Item>
                    <Descriptions.Item label="最小延迟">
                      {formatBlocks(track.minEnactmentPeriod)}
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Space>
            </Card>
          )
        })}
      </Space>
    </div>
  )
}

/**
 * 紧凑版轨道信息卡片
 */
interface TrackInfoCardProps {
  track: TrackInfo
  onClick?: () => void
}

export function TrackInfoCard({ track, onClick }: TrackInfoCardProps) {
  const riskLevel = getTrackRiskLevel(track.id)

  return (
    <Card
      size="small"
      hoverable={!!onClick}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Tag color={getTrackColor(track.id)}>{track.name}</Tag>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            押金: {formatBalance(track.decisionDeposit)} MEMO
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            决策期: {formatBlocks(track.decisionPeriod)}
          </Typography.Text>
        </Space>
        <Tag
          style={{ 
            fontSize: 11,
            backgroundColor: riskLevel >= 4 ? '#fff1f0' : riskLevel >= 3 ? '#fffbe6' : '#f6ffed',
            color: riskLevel >= 4 ? '#cf1322' : riskLevel >= 3 ? '#d48806' : '#389e0d',
            borderColor: riskLevel >= 4 ? '#ffa39e' : riskLevel >= 3 ? '#ffe58f' : '#b7eb8f'
          }}
        >
          {getTrackRiskLabel(riskLevel)}
        </Tag>
      </Space>
    </Card>
  )
}

/**
 * 轨道统计卡片（用于Dashboard）
 */
export function TrackStats() {
  const { loading } = useTracks()
  const { system, treasury, business, governance } = useTracksByCategory()

  if (loading) {
    return <Spin />
  }

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card size="small">
          <Typography.Text type="secondary">系统轨道</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
            {system.length}
          </div>
        </Card>
      </Col>

      <Col span={6}>
        <Card size="small">
          <Typography.Text type="secondary">财务轨道</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
            {treasury.length}
          </div>
        </Card>
      </Col>

      <Col span={6}>
        <Card size="small">
          <Typography.Text type="secondary">业务轨道</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
            {business.length}
          </div>
        </Card>
      </Col>

      <Col span={6}>
        <Card size="small">
          <Typography.Text type="secondary">治理轨道</Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>
            {governance.length}
          </div>
        </Card>
      </Col>
    </Row>
  )
}

