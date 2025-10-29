import { useState } from 'react'
import {
  Card,
  Table,
  Tabs,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Descriptions,
  Typography,
  InputNumber,
  Alert,
  Tooltip
} from 'antd'
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  CopyOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { useAppeals } from '@/hooks/useAppeals'
import { signAndSend, signAndSendBatch } from '@/services/wallet/signer'
import {
  createApproveAppealTx,
  createRejectAppealTx,
  AppealStatusLabels,
  AppealStatusColors,
  DomainLabels,
  type AppealInfo
} from '@/services/blockchain/contentGovernance'
import { formatAddress, formatBalance, copyToClipboard } from '@/utils/format'
import type { ColumnsType } from 'antd/es/table'

/**
 * 内容治理/申诉审核页面
 * 功能：查看申诉、批准/驳回、批量处理
 */
export default function ContentGovernance() {
  const { api } = useApi()
  const { activeAccount } = useWallet()
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectedAppeal, setSelectedAppeal] = useState<AppealInfo | null>(null)
  const [noticeBlocks, setNoticeBlocks] = useState<number>(100)
  const [actionLoading, setActionLoading] = useState(false)

  // 使用不同的Hook获取不同状态的申诉
  const pendingAppeals = useAppeals('pending')
  const approvedAppeals = useAppeals('approved')
  const rejectedAppeals = useAppeals('rejected')

  // 根据当前tab选择数据源
  const currentData =
    activeTab === 'pending'
      ? pendingAppeals
      : activeTab === 'approved'
      ? approvedAppeals
      : rejectedAppeals

  /**
   * 批准单个申诉
   */
  const handleApprove = async (appeal: AppealInfo) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    Modal.confirm({
      title: '批准申诉',
      content: (
        <div>
          <p>确定批准申诉 #{appeal.id} 吗？</p>
          <div style={{ marginTop: 12 }}>
            <label>公示期（区块数）：</label>
            <InputNumber
              min={0}
              max={10000}
              defaultValue={100}
              onChange={(val) => setNoticeBlocks(val || 100)}
              style={{ width: 120, marginLeft: 8 }}
            />
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            批准后将进入公示期，公示期结束后自动执行。
          </p>
        </div>
      ),
      onOk: async () => {
        setActionLoading(true)
        try {
          const tx = createApproveAppealTx(api, appeal.id, noticeBlocks)

          await signAndSend(activeAccount, tx, {
            onSuccess: () => {
              message.success('批准成功！申诉已进入公示期')
              setTimeout(() => currentData.reload(), 3000)
            },
            onError: (error) => {
              message.error('批准失败：' + error.message)
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
   * 驳回单个申诉
   */
  const handleReject = async (appeal: AppealInfo) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    Modal.confirm({
      title: '驳回申诉',
      content: `确定驳回申诉 #${appeal.id} 吗？将按配置的比例罚没押金。`,
      okText: '确认驳回',
      okType: 'danger',
      onOk: async () => {
        setActionLoading(true)
        try {
          const tx = createRejectAppealTx(api, appeal.id)

          await signAndSend(activeAccount, tx, {
            onSuccess: () => {
              message.success('驳回成功！')
              setTimeout(() => currentData.reload(), 3000)
            },
            onError: (error) => {
              message.error('驳回失败：' + error.message)
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
   * 批量批准
   */
  const handleBatchApprove = async () => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (selectedIds.length === 0) {
      message.warning('请至少选择一个申诉')
      return
    }

    Modal.confirm({
      title: '批量批准申诉',
      content: (
        <div>
          <p>确定批准 {selectedIds.length} 个申诉吗？</p>
          <div style={{ marginTop: 12 }}>
            <label>统一公示期（区块数）：</label>
            <InputNumber
              min={0}
              max={10000}
              defaultValue={100}
              onChange={(val) => setNoticeBlocks(val || 100)}
              style={{ width: 120, marginLeft: 8 }}
            />
          </div>
        </div>
      ),
      onOk: async () => {
        setActionLoading(true)
        try {
          const calls = selectedIds.map((id) =>
            createApproveAppealTx(api, id, noticeBlocks)
          )

          await signAndSendBatch(api, activeAccount, calls, {
            onSuccess: () => {
              message.success(`批量批准成功！已批准 ${selectedIds.length} 个申诉`)
              setSelectedIds([])
              setTimeout(() => currentData.reload(), 3000)
            },
            onError: (error) => {
              message.error('批量批准失败：' + error.message)
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
   * 批量驳回
   */
  const handleBatchReject = async () => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (selectedIds.length === 0) {
      message.warning('请至少选择一个申诉')
      return
    }

    Modal.confirm({
      title: '批量驳回申诉',
      content: `确定驳回 ${selectedIds.length} 个申诉吗？将按配置的比例罚没押金。`,
      okText: '确认批量驳回',
      okType: 'danger',
      onOk: async () => {
        setActionLoading(true)
        try {
          const calls = selectedIds.map((id) => createRejectAppealTx(api, id))

          await signAndSendBatch(api, activeAccount, calls, {
            onSuccess: () => {
              message.success(`批量驳回成功！已驳回 ${selectedIds.length} 个申诉`)
              setSelectedIds([])
              setTimeout(() => currentData.reload(), 3000)
            },
            onError: (error) => {
              message.error('批量驳回失败：' + error.message)
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
   * 复制CID
   */
  const handleCopyCid = async (cid: string, label: string) => {
    const success = await copyToClipboard(cid)
    if (success) {
      message.success(`${label}已复制`)
    } else {
      message.error('复制失败')
    }
  }

  /**
   * 表格列配置
   */
  const columns: ColumnsType<AppealInfo> = [
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
      title: '目标ID',
      dataIndex: 'target',
      key: 'target',
      width: 100
    },
    {
      title: '申诉人',
      dataIndex: 'submitter',
      key: 'submitter',
      width: 150,
      render: (submitter) => (
        <Tooltip title={submitter}>
          <Typography.Text copyable={{ text: submitter }}>
            {formatAddress(submitter)}
          </Typography.Text>
        </Tooltip>
      )
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      width: 120,
      render: (deposit) => `${formatBalance(deposit)} DUST`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusNum = typeof status === 'number' ? status : 0
        return (
          <Tag color={AppealStatusColors[statusNum]}>
            {AppealStatusLabels[statusNum] || '未知'}
          </Tag>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const statusNum = typeof record.status === 'number' ? record.status : 0
        const isPending = statusNum === 0

        return (
          <Space direction="vertical" size={4}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setSelectedAppeal(record)}
            >
              查看详情
            </Button>

            {isPending && (
              <Space size={4}>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleApprove(record)}
                  loading={actionLoading}
                >
                  批准
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleReject(record)}
                  loading={actionLoading}
                >
                  驳回
                </Button>
              </Space>
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
      key: 'pending',
      label: `待审核 (${pendingAppeals.appeals.length})`,
      children: (
        <div>
          {/* 批量操作 */}
          {selectedIds.length > 0 && (
            <Space style={{ marginBottom: 16 }} wrap>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleBatchApprove}
                loading={actionLoading}
              >
                批量批准 ({selectedIds.length})
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={handleBatchReject}
                loading={actionLoading}
              >
                批量驳回 ({selectedIds.length})
              </Button>
              <Button onClick={() => setSelectedIds([])}>清空选择</Button>
            </Space>
          )}

          <Table
            columns={columns}
            dataSource={pendingAppeals.appeals}
            rowKey="id"
            loading={pendingAppeals.loading}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys as number[])
            }}
            pagination={{
              pageSize: 20,
              showTotal: (total) => `共 ${total} 个待审申诉`
            }}
            locale={{ emptyText: '暂无待审申诉' }}
            scroll={{ x: 1000 }}
          />
        </div>
      )
    },
    {
      key: 'approved',
      label: `已批准 (${approvedAppeals.appeals.length})`,
      children: (
        <Table
          columns={columns}
          dataSource={approvedAppeals.appeals}
          rowKey="id"
          loading={approvedAppeals.loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个已批准申诉`
          }}
          locale={{ emptyText: '暂无已批准申诉' }}
          scroll={{ x: 1000 }}
        />
      )
    },
    {
      key: 'rejected',
      label: `已驳回 (${rejectedAppeals.appeals.length})`,
      children: (
        <Table
          columns={columns}
          dataSource={rejectedAppeals.appeals}
          rowKey="id"
          loading={rejectedAppeals.loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个已驳回申诉`
          }}
          locale={{ emptyText: '暂无已驳回申诉' }}
          scroll={{ x: 1000 }}
        />
      )
    }
  ]

  return (
    <div>
      <Card
        title="内容治理/申诉审核"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => currentData.reload()}
            loading={currentData.loading}
          >
            刷新
          </Button>
        }
      >
        <Alert
          message="内容治理说明"
          description="用户可以对违规内容提交申诉。委员会审核后，批准的申诉将进入公示期，公示期结束后自动执行治理动作（删除、恢复等）。"
          type="info"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            setSelectedIds([])
          }}
          items={tabItems}
        />
      </Card>

      {/* 申诉详情弹窗 */}
      <Modal
        title={`申诉详情 #${selectedAppeal?.id}`}
        open={!!selectedAppeal}
        onCancel={() => setSelectedAppeal(null)}
        footer={
          selectedAppeal && (typeof selectedAppeal.status === 'number' ? selectedAppeal.status : 0) === 0 ? (
            <Space>
              <Button onClick={() => setSelectedAppeal(null)}>关闭</Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => {
                  if (selectedAppeal) {
                    handleApprove(selectedAppeal)
                    setSelectedAppeal(null)
                  }
                }}
              >
                批准
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  if (selectedAppeal) {
                    handleReject(selectedAppeal)
                    setSelectedAppeal(null)
                  }
                }}
              >
                驳回
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setSelectedAppeal(null)}>关闭</Button>
          )
        }
        width={800}
      >
        {selectedAppeal && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="申诉ID">{selectedAppeal.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag
                color={
                  AppealStatusColors[
                    typeof selectedAppeal.status === 'number'
                      ? selectedAppeal.status
                      : 0
                  ]
                }
              >
                {
                  AppealStatusLabels[
                    typeof selectedAppeal.status === 'number'
                      ? selectedAppeal.status
                      : 0
                  ]
                }
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="域">
              {DomainLabels[selectedAppeal.domain] || `域${selectedAppeal.domain}`}
            </Descriptions.Item>
            <Descriptions.Item label="目标ID">
              {selectedAppeal.target}
            </Descriptions.Item>

            <Descriptions.Item label="申诉人" span={2}>
              <Typography.Text copyable={{ text: selectedAppeal.submitter }}>
                {selectedAppeal.submitter}
              </Typography.Text>
            </Descriptions.Item>

            <Descriptions.Item label="押金" span={2}>
              {formatBalance(selectedAppeal.deposit)} DUST
            </Descriptions.Item>

            <Descriptions.Item label="理由CID" span={2}>
              <Space>
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {selectedAppeal.reason_cid || '未提供'}
                </code>
                {selectedAppeal.reason_cid && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() =>
                      handleCopyCid(selectedAppeal.reason_cid, '理由CID')
                    }
                  >
                    复制
                  </Button>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="证据CID" span={2}>
              <Space>
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {selectedAppeal.evidence_cid || '未提供'}
                </code>
                {selectedAppeal.evidence_cid && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() =>
                      handleCopyCid(selectedAppeal.evidence_cid, '证据CID')
                    }
                  >
                    复制
                  </Button>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="提交时间">
              {new Date(selectedAppeal.submitted_at * 1000).toLocaleString('zh-CN')}
            </Descriptions.Item>

            {selectedAppeal.notice_blocks && (
              <Descriptions.Item label="公示期">
                {selectedAppeal.notice_blocks} 区块
              </Descriptions.Item>
            )}

            {selectedAppeal.execute_at && (
              <Descriptions.Item label="执行区块" span={2}>
                {selectedAppeal.execute_at}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

