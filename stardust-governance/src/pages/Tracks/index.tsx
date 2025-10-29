import { Card, Table, Tag, Descriptions, Alert, Space } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useTracks } from '@/hooks/useTracks'
import {
  getTrackColor,
  getTrackRiskLevel,
  getTrackRiskLabel,
  getTrackCategory,
  formatBlocks
} from '@/services/blockchain/tracks'
import { formatBalance } from '@/utils/format'
import type { TrackInfo } from '@/services/blockchain/tracks'
import type { ColumnsType } from 'antd/es/table'

/**
 * 轨道配置页面
 * 展示所有治理轨道的配置参数
 */
export default function TracksPage() {
  const { tracks, loading } = useTracks()

  /**
   * 表格列配置
   */
  const columns: ColumnsType<TrackInfo> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id) => <strong>#{id}</strong>
    },
    {
      title: '轨道名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name, record) => (
        <Space>
          <Tag color={getTrackColor(record.id)}>{name}</Tag>
          <Tag color="blue">{getTrackCategory(record.id)}</Tag>
        </Space>
      )
    },
    {
      title: '风险等级',
      key: 'risk',
      width: 120,
      render: (_, record) => {
        const riskLevel = getTrackRiskLevel(record.id)
        return (
          <Tag
            style={{
              backgroundColor: riskLevel >= 4 ? '#fff1f0' : riskLevel >= 3 ? '#fffbe6' : '#f6ffed',
              color: riskLevel >= 4 ? '#cf1322' : riskLevel >= 3 ? '#d48806' : '#389e0d',
              borderColor: riskLevel >= 4 ? '#ffa39e' : riskLevel >= 3 ? '#ffe58f' : '#b7eb8f'
            }}
          >
            {'⭐'.repeat(riskLevel)} {getTrackRiskLabel(riskLevel)}
          </Tag>
        )
      }
    },
    {
      title: '决策押金',
      dataIndex: 'decisionDeposit',
      key: 'decisionDeposit',
      width: 150,
      render: (deposit) => `${formatBalance(deposit)} DUST`
    },
    {
      title: '最大并发',
      dataIndex: 'maxDeciding',
      key: 'maxDeciding',
      width: 100
    },
    {
      title: '准备期',
      dataIndex: 'preparePeriod',
      key: 'preparePeriod',
      width: 120,
      render: (blocks) => formatBlocks(blocks)
    },
    {
      title: '决策期',
      dataIndex: 'decisionPeriod',
      key: 'decisionPeriod',
      width: 120,
      render: (blocks) => <strong>{formatBlocks(blocks)}</strong>
    },
    {
      title: '确认期',
      dataIndex: 'confirmPeriod',
      key: 'confirmPeriod',
      width: 120,
      render: (blocks) => formatBlocks(blocks)
    },
    {
      title: '最小延迟',
      dataIndex: 'minEnactmentPeriod',
      key: 'minEnactmentPeriod',
      width: 120,
      render: (blocks) => formatBlocks(blocks)
    }
  ]

  return (
    <div>
      <Card title="治理轨道配置">
        <Alert
          message="什么是轨道（Track）？"
          description={
            <div style={{ fontSize: 13 }}>
              <p>
                轨道是OpenGov（Governance v2）引入的概念，不同类型的治理提案使用不同的轨道，每个轨道有独立的参数配置。
              </p>
              <p style={{ marginTop: 8 }}>
                <strong>好处：</strong>
              </p>
              <ul style={{ marginBottom: 0 }}>
                <li>重要提案（如系统升级）使用高门槛参数（高押金、长时间）→ 保证安全</li>
                <li>简单提案（如内容治理）使用低门槛参数（低押金、短时间）→ 提高效率</li>
                <li>灵活适应不同的治理场景</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={tracks}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
          locale={{ emptyText: '暂无轨道配置' }}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="轨道ID">{record.id}</Descriptions.Item>
                <Descriptions.Item label="轨道名称">{record.name}</Descriptions.Item>

                <Descriptions.Item label="类别">
                  <Tag>{getTrackCategory(record.id)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  {(() => {
                    const risk = getTrackRiskLevel(record.id)
                    return (
                      <Tag
                        style={{
                          backgroundColor: risk >= 4 ? '#fff1f0' : risk >= 3 ? '#fffbe6' : '#f6ffed',
                          color: risk >= 4 ? '#cf1322' : risk >= 3 ? '#d48806' : '#389e0d',
                          borderColor: risk >= 4 ? '#ffa39e' : risk >= 3 ? '#ffe58f' : '#b7eb8f'
                        }}
                      >
                        {getTrackRiskLabel(risk)}
                      </Tag>
                    )
                  })()}
                </Descriptions.Item>

                <Descriptions.Item label="决策押金">
                  {formatBalance(record.decisionDeposit)} DUST
                </Descriptions.Item>
                <Descriptions.Item label="最大同时决策数">
                  {record.maxDeciding}
                </Descriptions.Item>

                <Descriptions.Item label="准备期">
                  {formatBlocks(record.preparePeriod)}（{record.preparePeriod} 区块）
                </Descriptions.Item>
                <Descriptions.Item label="决策期">
                  {formatBlocks(record.decisionPeriod)}（{record.decisionPeriod} 区块）
                </Descriptions.Item>

                <Descriptions.Item label="确认期">
                  {formatBlocks(record.confirmPeriod)}（{record.confirmPeriod} 区块）
                </Descriptions.Item>
                <Descriptions.Item label="最小延迟执行期">
                  {formatBlocks(record.minEnactmentPeriod)}（{record.minEnactmentPeriod} 区块）
                </Descriptions.Item>
              </Descriptions>
            ),
            rowExpandable: () => true
          }}
        />
      </Card>
    </div>
  )
}

