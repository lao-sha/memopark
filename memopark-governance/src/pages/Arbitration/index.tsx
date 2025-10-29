import { useState } from 'react'
import {
  Card,
  Table,
  Tabs,
  Tag,
  Space,
  Button,
  Modal,
  Select,
  message,
  Descriptions,
  Typography,
  Alert
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  CheckOutlined,
  ThunderboltOutlined,
  UnlockOutlined
} from '@ant-design/icons'
import { ViewEncryptedEvidence } from '../../components/Governance/ViewEncryptedEvidence'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import {
  DomainLabels,
  DecisionLabels,
  DecisionColors
} from '@/services/blockchain/arbitration'
import { formatAddress, formatBalance } from '@/utils/format'
import type { ColumnsType } from 'antd/es/table'

/**
 * 仲裁管理页面
 * 用于管理争议案件和执行裁决
 */
export default function ArbitrationPage() {
  const { api } = useApi()
  const { activeAccount } = useWallet()
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [decision, setDecision] = useState<string>('RefundBuyer')
  const [loading, setLoading] = useState(false)
  const [viewEvidenceModal, setViewEvidenceModal] = useState<{
    visible: boolean
    evidenceCid?: string
    orderId?: number
  }>({ visible: false })

  // 模拟数据（实际应从链上查询）
  const [pendingCases] = useState<any[]>([])
  const [resolvedCases] = useState<any[]>([])

  /**
   * 处理裁决
   */
  const handleArbitrate = async (caseInfo: any) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    Modal.confirm({
      title: '执行裁决',
      content: (
        <div>
          <p>案件 #{caseInfo.id}</p>
          <div style={{ marginTop: 12 }}>
            <label>裁决决定：</label>
            <Select
              value={decision}
              onChange={setDecision}
              style={{ width: '100%', marginTop: 8 }}
            >
              <Select.Option value="RefundBuyer">
                <Tag color="green">全额退款给买家</Tag>
              </Select.Option>
              <Select.Option value="PaySeller">
                <Tag color="blue">全额支付给卖家</Tag>
              </Select.Option>
              <Select.Option value="PartialRefund">
                <Tag color="orange">部分退款</Tag>
              </Select.Option>
            </Select>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            裁决后资金将自动分配，操作不可撤销。
          </p>
        </div>
      ),
      onOk: async () => {
        setLoading(true)
        try {
          // 实际应调用链上交易
          // const tx = createArbitrateTx(api, caseInfo.domain, caseInfo.orderId, decision)
          // await signAndSend(activeAccount, tx, {...})
          
          message.success('裁决已提交！')
          // 刷新数据
        } catch (e: any) {
          message.error('裁决失败：' + (e?.message || ''))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  /**
   * 表格列配置
   */
  const columns: ColumnsType<any> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id) => <strong>#{id}</strong>
    },
    {
      title: '域',
      dataIndex: 'domain',
      key: 'domain',
      width: 100,
      render: (domain) => (
        <Tag color="blue">{DomainLabels[domain] || `域${domain}`}</Tag>
      )
    },
    {
      title: '订单ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 100
    },
    {
      title: '买家',
      dataIndex: 'buyer',
      key: 'buyer',
      width: 150,
      render: (buyer) => (
        <Typography.Text copyable={{ text: buyer }}>
          {formatAddress(buyer)}
        </Typography.Text>
      )
    },
    {
      title: '卖家',
      dataIndex: 'seller',
      key: 'seller',
      width: 150,
      render: (seller) => (
        <Typography.Text copyable={{ text: seller }}>
          {formatAddress(seller)}
        </Typography.Text>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => `${formatBalance(amount)} MEMO`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colors: Record<string, string> = {
          Pending: 'orange',
          Resolved: 'green',
          Cancelled: 'default'
        }
        return <Tag color={colors[status] || 'default'}>{status}</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedCase(record)}
          >
            查看详情
          </Button>

          {record.evidenceCid && (
            <Button
              type="default"
              size="small"
              icon={<UnlockOutlined />}
              onClick={() => {
                setViewEvidenceModal({
                  visible: true,
                  evidenceCid: record.evidenceCid,
                  orderId: record.orderId
                })
              }}
            >
              查看加密证据
            </Button>
          )}

          {record.status === 'Pending' && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleArbitrate(record)}
              loading={loading}
            >
              执行裁决
            </Button>
          )}
        </Space>
      )
    }
  ]

  /**
   * Tab配置
   */
  const tabItems = [
    {
      key: 'pending',
      label: `待裁决 (${pendingCases.length})`,
      children: (
        <div>
          <Alert
            message="仲裁说明"
            description="仲裁员负责处理买卖双方的争议。裁决后资金将自动分配，请谨慎操作。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {pendingCases.length === 0 ? (
            <Alert
              message="暂无待裁决案件"
              description="Arbitration pallet已配置，但当前没有待裁决的争议案件。"
              type="success"
              showIcon
            />
          ) : (
            <Table
              columns={columns}
              dataSource={pendingCases}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showTotal: (total) => `共 ${total} 个待裁决案件`
              }}
              locale={{ emptyText: '暂无待裁决案件' }}
              scroll={{ x: 1000 }}
            />
          )}
        </div>
      )
    },
    {
      key: 'resolved',
      label: `已裁决 (${resolvedCases.length})`,
      children: (
        <Table
          columns={[
            ...columns,
            {
              title: '裁决决定',
              dataIndex: 'decision',
              key: 'decision',
              width: 180,
              render: (decision) => (
                <Tag color={DecisionColors[decision] || 'default'}>
                  {DecisionLabels[decision] || decision}
                </Tag>
              )
            }
          ]}
          dataSource={resolvedCases}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个已裁决案件`
          }}
          locale={{ emptyText: '暂无已裁决案件' }}
          scroll={{ x: 1200 }}
        />
      )
    }
  ]

  return (
    <div>
      <Card
        title="仲裁管理"
        extra={
          <Button icon={<ReloadOutlined />} loading={loading}>
            刷新
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Card>

      {/* 案件详情弹窗 */}
      <Modal
        title={`案件详情 #${selectedCase?.id}`}
        open={!!selectedCase}
        onCancel={() => setSelectedCase(null)}
        footer={
          selectedCase?.status === 'Pending' ? (
            <Space>
              <Button onClick={() => setSelectedCase(null)}>关闭</Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  if (selectedCase) {
                    handleArbitrate(selectedCase)
                    setSelectedCase(null)
                  }
                }}
              >
                执行裁决
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setSelectedCase(null)}>关闭</Button>
          )
        }
        width={800}
      >
        {selectedCase && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="案件ID">{selectedCase.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedCase.status === 'Pending' ? 'orange' : 'green'}>
                {selectedCase.status === 'Pending' ? '待裁决' : '已裁决'}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="域">
              {DomainLabels[selectedCase.domain] || `域${selectedCase.domain}`}
            </Descriptions.Item>
            <Descriptions.Item label="订单ID">
              {selectedCase.orderId}
            </Descriptions.Item>

            <Descriptions.Item label="买家" span={2}>
              <Typography.Text copyable={{ text: selectedCase.buyer }}>
                {selectedCase.buyer}
              </Typography.Text>
            </Descriptions.Item>

            <Descriptions.Item label="卖家" span={2}>
              <Typography.Text copyable={{ text: selectedCase.seller }}>
                {selectedCase.seller}
              </Typography.Text>
            </Descriptions.Item>

            <Descriptions.Item label="争议金额" span={2}>
              {formatBalance(selectedCase.amount)} MEMO
            </Descriptions.Item>

            <Descriptions.Item label="争议原因" span={2}>
              {selectedCase.reason || '未提供'}
            </Descriptions.Item>

            {selectedCase.evidenceCid && (
              <Descriptions.Item label="证据" span={2}>
                <Space>
                  <Tag color="blue">已提交加密证据</Tag>
                  <Button
                    size="small"
                    type="primary"
                    icon={<UnlockOutlined />}
                    onClick={() => {
                      setViewEvidenceModal({
                        visible: true,
                        evidenceCid: selectedCase.evidenceCid,
                        orderId: selectedCase.orderId
                      })
                      setSelectedCase(null)
                    }}
                  >
                    查看加密证据
                  </Button>
                </Space>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="创建时间">
              {new Date(selectedCase.createdAt * 1000).toLocaleString('zh-CN')}
            </Descriptions.Item>

            {selectedCase.decidedAt && (
              <Descriptions.Item label="裁决时间">
                {new Date(selectedCase.decidedAt * 1000).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}

            {selectedCase.decision && (
              <Descriptions.Item label="裁决决定" span={2}>
                <Tag color={DecisionColors[selectedCase.decision]}>
                  {DecisionLabels[selectedCase.decision]}
                </Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 查看加密证据模态框 */}
      {viewEvidenceModal.evidenceCid && viewEvidenceModal.orderId && (
        <ViewEncryptedEvidence
          evidenceCid={viewEvidenceModal.evidenceCid}
          orderId={viewEvidenceModal.orderId}
          visible={viewEvidenceModal.visible}
          onClose={() => {
            setViewEvidenceModal({ visible: false })
          }}
        />
      )}
    </div>
  )
}

