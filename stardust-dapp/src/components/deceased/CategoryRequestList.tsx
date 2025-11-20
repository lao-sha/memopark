/**
 * 分类修改申请列表组件
 *
 * 功能说明：
 * 1. 显示所有分类修改申请
 * 2. 支持按状态筛选（待审核/已批准/已拒绝/已过期）
 * 3. 显示申请详情
 * 4. 委员会/Root可以批准/拒绝申请
 * 5. 普通用户可以查看自己的申请历史
 *
 * 创建日期：2025-11-09
 */

import React, { useState, useEffect } from 'react'
import {
  List,
  Card,
  Space,
  Typography,
  Tag,
  Button,
  Select,
  Empty,
  Spin,
  message,
  Descriptions,
  Modal,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import {
  createDeceasedService,
  RequestStatus,
  type CategoryChangeRequest,
} from '../../services/deceasedService'
import { CategoryBadge } from './CategoryBadge'
import { CategoryManagementModal } from './CategoryManagementModal'
import { useAccountPermissions } from '../../hooks/useAccountPermissions'

const { Text, Title } = Typography
const { Option } = Select

interface CategoryRequestListProps {
  /** 当前账户地址 */
  account: string
}

/**
 * 函数级详细中文注释：分类修改申请列表组件
 */
export const CategoryRequestList: React.FC<CategoryRequestListProps> = ({
  account,
}) => {
  // 使用权限检查hook自动检测账户权限
  const { isAdmin, loading: permissionsLoading } = useAccountPermissions(account)

  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<CategoryChangeRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<CategoryChangeRequest[]>([])
  const [filterStatus, setFilterStatus] = useState<RequestStatus | 'all'>('all')
  const [managementModalOpen, setManagementModalOpen] = useState(false)
  const [currentMode, setCurrentMode] = useState<'approve' | 'reject'>('approve')
  const [currentRequestId, setCurrentRequestId] = useState<number>()
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [currentRequest, setCurrentRequest] = useState<CategoryChangeRequest | null>(null)

  /**
   * 函数级详细中文注释：加载申请列表
   */
  const loadRequests = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const service = createDeceasedService(api)

      // TODO: 实现查询所有申请的方法
      // 临时：这里需要遍历 CategoryChangeRequests 存储或通过事件查询
      // 实际使用时应该通过 Subsquid 索引查询

      const mockRequests: CategoryChangeRequest[] = []
      // 模拟数据（实际应该从链上查询）
      setRequests(mockRequests)
      setFilteredRequests(mockRequests)
    } catch (error: any) {
      console.error('加载申请列表失败:', error)
      message.error(error.message || '加载申请列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [account])

  /**
   * 函数级详细中文注释：根据状态筛选申请
   */
  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredRequests(requests)
    } else {
      setFilteredRequests(requests.filter(req => req.status === filterStatus))
    }
  }, [filterStatus, requests])

  /**
   * 函数级详细中文注释：打开管理弹窗
   */
  const handleManage = (requestId: number, mode: 'approve' | 'reject') => {
    setCurrentRequestId(requestId)
    setCurrentMode(mode)
    setManagementModalOpen(true)
  }

  /**
   * 函数级详细中文注释：查看申请详情
   */
  const handleViewDetail = (request: CategoryChangeRequest) => {
    setCurrentRequest(request)
    setDetailModalOpen(true)
  }

  /**
   * 函数级详细中文注释：获取状态标签
   */
  const getStatusTag = (status: RequestStatus) => {
    const configs: Record<RequestStatus, { color: string; text: string; icon: React.ReactNode }> = {
      [RequestStatus.Pending]: {
        color: 'processing',
        text: '待审核',
        icon: <ClockCircleOutlined />,
      },
      [RequestStatus.Approved]: {
        color: 'success',
        text: '已批准',
        icon: <CheckCircleOutlined />,
      },
      [RequestStatus.Rejected]: {
        color: 'error',
        text: '已拒绝',
        icon: <CloseCircleOutlined />,
      },
      [RequestStatus.Expired]: {
        color: 'default',
        text: '已过期',
        icon: <InfoCircleOutlined />,
      },
    }

    const config = configs[status]
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    )
  }

  /**
   * 函数级详细中文注释：渲染申请项
   */
  const renderRequestItem = (request: CategoryChangeRequest) => {
    const canManage = isAdmin && request.status === RequestStatus.Pending

    return (
      <List.Item
        key={request.id}
        actions={[
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(request)}
          >
            详情
          </Button>,
          ...(canManage ? [
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleManage(request.id, 'approve')}
              style={{ color: '#52c41a' }}
            >
              批准
            </Button>,
            <Button
              type="link"
              icon={<CloseCircleOutlined />}
              onClick={() => handleManage(request.id, 'reject')}
              danger
            >
              拒绝
            </Button>,
          ] : []),
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <Text strong>申请 #{request.id}</Text>
              {getStatusTag(request.status)}
            </Space>
          }
          description={
            <Space direction="vertical" size="small">
              <Space>
                <Text type="secondary">逝者ID:</Text>
                <Text>{request.deceasedId}</Text>
              </Space>
              <Space>
                <Text type="secondary">申请人:</Text>
                <Text code>{request.applicant}</Text>
              </Space>
              <Space>
                <Text type="secondary">分类变更:</Text>
                <CategoryBadge category={request.currentCategory} />
                <Text> → </Text>
                <CategoryBadge category={request.targetCategory} />
              </Space>
              <Space>
                <Text type="secondary">提交时间:</Text>
                <Text>区块 {request.submittedAt}</Text>
              </Space>
              {request.status === RequestStatus.Pending && (
                <Space>
                  <Text type="secondary">截止时间:</Text>
                  <Text>区块 {request.deadline}</Text>
                </Space>
              )}
            </Space>
          }
        />
      </List.Item>
    )
  }

  return (
    <div>
      {/* 筛选器 */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>{isAdmin ? '分类修改申请管理' : '我的分类修改申请'}</span>
            {permissionsLoading && <Tag color="processing">检查权限中...</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Text type="secondary">状态筛选:</Text>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value={RequestStatus.Pending}>待审核</Option>
              <Option value={RequestStatus.Approved}>已批准</Option>
              <Option value={RequestStatus.Rejected}>已拒绝</Option>
              <Option value={RequestStatus.Expired}>已过期</Option>
            </Select>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">加载申请列表...</Text>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <Empty
            description={
              filterStatus === 'all'
                ? '暂无申请记录'
                : `暂无${filterStatus === RequestStatus.Pending ? '待审核' : filterStatus === RequestStatus.Approved ? '已批准' : filterStatus === RequestStatus.Rejected ? '已拒绝' : '已过期'}的申请`
            }
          />
        ) : (
          <List
            dataSource={filteredRequests}
            renderItem={renderRequestItem}
            pagination={
              filteredRequests.length > 10
                ? {
                    pageSize: 10,
                    showSizeChanger: false,
                    showTotal: (total) => `共 ${total} 条申请`,
                  }
                : false
            }
          />
        )}
      </Card>

      {/* 管理弹窗 */}
      <CategoryManagementModal
        open={managementModalOpen}
        onClose={() => {
          setManagementModalOpen(false)
          setCurrentRequestId(undefined)
        }}
        mode={currentMode}
        requestId={currentRequestId}
        account={account}
        onSuccess={() => {
          loadRequests()
          message.success('操作成功')
        }}
      />

      {/* 详情弹窗 */}
      <Modal
        title="申请详情"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false)
          setCurrentRequest(null)
        }}
        footer={null}
        width={700}
      >
        {currentRequest && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="申请ID">{currentRequest.id}</Descriptions.Item>
            <Descriptions.Item label="逝者ID">{currentRequest.deceasedId}</Descriptions.Item>
            <Descriptions.Item label="申请人">
              <Text code copyable>{currentRequest.applicant}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="当前分类">
              <CategoryBadge category={currentRequest.currentCategory} />
            </Descriptions.Item>
            <Descriptions.Item label="目标分类">
              <CategoryBadge category={currentRequest.targetCategory} />
            </Descriptions.Item>
            <Descriptions.Item label="申请状态">
              {getStatusTag(currentRequest.status)}
            </Descriptions.Item>
            <Descriptions.Item label="提交时间">
              区块 {currentRequest.submittedAt}
            </Descriptions.Item>
            <Descriptions.Item label="截止时间">
              区块 {currentRequest.deadline}
            </Descriptions.Item>
            <Descriptions.Item label="申请理由CID">
              <Text code copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                {currentRequest.reasonCid}
              </Text>
            </Descriptions.Item>
            {currentRequest.evidenceCids.length > 0 && (
              <Descriptions.Item label="证据CID列表">
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {currentRequest.evidenceCids.map((cid, index) => (
                    <Text key={index} code copyable style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      {index + 1}. {cid}
                    </Text>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
