import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tabs,
  Button,
  Space,
  Tag,
  Descriptions,
  Modal,
  message,
  Typography,
  Tooltip
} from 'antd'
import { ReloadOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useApi } from '@/contexts/Api'
import {
  getPendingApplications,
  getApprovedApplications,
  type Application
} from '@/services/blockchain/marketMaker'
import { formatAddress, formatBalance, copyToClipboard } from '@/utils/format'
import type { ColumnsType } from 'antd/es/table'

/**
 * 申请审核页面
 * 显示待审核和已批准的做市商申请
 */
export default function Applications() {
  const navigate = useNavigate()
  const { api, isReady } = useApi()
  const [activeTab, setActiveTab] = useState('pending')
  const [pendingList, setPendingList] = useState<Application[]>([])
  const [approvedList, setApprovedList] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

  /**
   * 加载待审申请
   */
  const loadPending = async () => {
    if (!isReady || !api) return

    setLoading(true)
    try {
      const apps = await getPendingApplications(api)
      setPendingList(apps)
    } catch (e: any) {
      message.error('加载失败：' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  /**
   * 加载已批准申请
   */
  const loadApproved = async () => {
    if (!isReady || !api) return

    setLoading(true)
    try {
      const apps = await getApprovedApplications(api)
      setApprovedList(apps)
    } catch (e: any) {
      message.error('加载失败：' + (e?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  /**
   * 初始加载
   */
  useEffect(() => {
    if (activeTab === 'pending') {
      loadPending()
    } else {
      loadApproved()
    }
  }, [activeTab, api, isReady])

  /**
   * 创建提案（快捷操作）
   */
  const handleCreateProposal = (mmId: number, type: 'approve' | 'reject') => {
    navigate(`/proposals/create?mmId=${mmId}&type=${type}`)
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
  const columns: ColumnsType<Application> = [
    {
      title: 'ID',
      dataIndex: 'mm_id',
      key: 'mm_id',
      width: 80,
      render: (id) => <strong>#{id}</strong>
    },
    {
      title: '申请人',
      dataIndex: 'owner',
      key: 'owner',
      width: 150,
      render: (owner) => (
        <Tooltip title={owner}>
          <Typography.Text copyable={{ text: owner }}>
            {formatAddress(owner)}
          </Typography.Text>
        </Tooltip>
      )
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      width: 150,
      render: (deposit) => `${formatBalance(deposit)} MEMO`
    },
    {
      title: '费率',
      dataIndex: 'fee_bps',
      key: 'fee_bps',
      width: 100,
      render: (bps) => (
        <Tag color="blue">{(bps / 100).toFixed(2)}%</Tag>
      )
    },
    {
      title: '最小金额',
      dataIndex: 'min_amount',
      key: 'min_amount',
      width: 150,
      render: (amount) => `${formatBalance(amount)} MEMO`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'Active' ? 'success' : 'warning'}>
          {status === 'Active' ? '已批准' : '待审核'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedApp(record)}
          >
            查看详情
          </Button>

          {record.status === 'PendingReview' && (
            <Space size={4}>
              <Button
                type="primary"
                size="small"
                onClick={() => handleCreateProposal(record.mm_id, 'approve')}
              >
                创建批准提案
              </Button>
              <Button
                danger
                size="small"
                onClick={() => handleCreateProposal(record.mm_id, 'reject')}
              >
                创建驳回提案
              </Button>
            </Space>
          )}
        </Space>
      )
    }
  ]

  /**
   * Tab标签项
   */
  const tabItems = [
    {
      key: 'pending',
      label: `待审核 (${pendingList.length})`,
      children: (
        <Table
          columns={columns}
          dataSource={pendingList}
          rowKey="mm_id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个待审申请`
          }}
          locale={{ emptyText: '暂无待审申请' }}
          scroll={{ x: 1000 }}
        />
      )
    },
    {
      key: 'approved',
      label: `已批准 (${approvedList.length})`,
      children: (
        <Table
          columns={columns}
          dataSource={approvedList}
          rowKey="mm_id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `共 ${total} 个已批准做市商`
          }}
          locale={{ emptyText: '暂无已批准做市商' }}
          scroll={{ x: 1000 }}
        />
      )
    }
  ]

  return (
    <div>
      <Card
        title="做市商申请审核"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => (activeTab === 'pending' ? loadPending() : loadApproved())}
            loading={loading}
          >
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

      {/* 申请详情弹窗 */}
      <Modal
        title={`申请详情 #${selectedApp?.mm_id}`}
        open={!!selectedApp}
        onCancel={() => setSelectedApp(null)}
        footer={
          selectedApp?.status === 'PendingReview' ? (
            <Space>
              <Button onClick={() => setSelectedApp(null)}>关闭</Button>
              <Button
                type="primary"
                onClick={() => {
                  handleCreateProposal(selectedApp.mm_id, 'approve')
                  setSelectedApp(null)
                }}
              >
                创建批准提案
              </Button>
              <Button
                danger
                onClick={() => {
                  handleCreateProposal(selectedApp.mm_id, 'reject')
                  setSelectedApp(null)
                }}
              >
                创建驳回提案
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setSelectedApp(null)}>关闭</Button>
          )
        }
        width={800}
      >
        {selectedApp && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="申请编号">{selectedApp.mm_id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedApp.status === 'Active' ? 'success' : 'warning'}>
                {selectedApp.status === 'Active' ? '已批准' : '待审核'}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="申请人" span={2}>
              <Space>
                <Typography.Text copyable={{ text: selectedApp.owner }}>
                  {selectedApp.owner}
                </Typography.Text>
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="押金">
              {formatBalance(selectedApp.deposit)} MEMO
            </Descriptions.Item>
            <Descriptions.Item label="费率">
              {(selectedApp.fee_bps / 100).toFixed(2)}% ({selectedApp.fee_bps} bps)
            </Descriptions.Item>

            <Descriptions.Item label="最小金额" span={2}>
              {formatBalance(selectedApp.min_amount)} MEMO
            </Descriptions.Item>

            <Descriptions.Item label="公开资料CID" span={2}>
              <Space>
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {selectedApp.public_cid || '未提供'}
                </code>
                {selectedApp.public_cid && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyCid(selectedApp.public_cid, '公开CID')}
                  >
                    复制
                  </Button>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="私密资料CID" span={2}>
              <Space>
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {selectedApp.private_cid || '未提供'}
                </code>
                {selectedApp.private_cid && (
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyCid(selectedApp.private_cid, '私密CID')}
                  >
                    复制
                  </Button>
                )}
              </Space>
            </Descriptions.Item>

            <Descriptions.Item label="创建时间">
              {new Date(selectedApp.created_at * 1000).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="审核截止">
              {new Date(selectedApp.review_deadline * 1000).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

