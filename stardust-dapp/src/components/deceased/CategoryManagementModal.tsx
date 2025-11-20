/**
 * 分类管理弹窗组件（Root/委员会）
 *
 * 功能说明：
 * 1. Root账户直接修改分类（force_set_category）
 * 2. 委员会批准/拒绝分类修改申请
 * 3. 显示申请详情
 * 4. 支持添加备注/理由
 *
 * 创建日期：2025-11-09
 */

import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Alert,
  Space,
  Typography,
  message,
  Divider,
  Spin,
  Descriptions,
  Tag,
  Card,
} from 'antd'
import {
  CrownOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import {
  createDeceasedService,
  DeceasedCategory,
  RequestStatus,
  type CategoryChangeRequest,
  type ForceSetCategoryParams,
  type ProcessCategoryChangeParams,
} from '../../services/deceasedService'
import { CategoryBadge, getCategoryLabel } from './CategoryBadge'

const { TextArea } = Input
const { Text, Title } = Typography
const { Option } = Select

interface CategoryManagementModalProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 操作模式 */
  mode: 'force_set' | 'approve' | 'reject'
  /** 逝者ID（force_set模式） */
  deceasedId?: number
  /** 当前分类（force_set模式） */
  currentCategory?: DeceasedCategory
  /** 申请ID（approve/reject模式） */
  requestId?: number
  /** 当前账户地址 */
  account: string
  /** 操作成功回调 */
  onSuccess?: () => void
}

/**
 * 函数级详细中文注释：分类管理弹窗组件
 */
export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  open,
  onClose,
  mode,
  deceasedId,
  currentCategory,
  requestId,
  account,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [requestData, setRequestData] = useState<CategoryChangeRequest | null>(null)
  const [loadingRequest, setLoadingRequest] = useState(false)

  /**
   * 函数级详细中文注释：加载申请详情（approve/reject模式）
   */
  useEffect(() => {
    const loadRequest = async () => {
      if ((mode === 'approve' || mode === 'reject') && requestId !== undefined && open) {
        setLoadingRequest(true)
        try {
          const api = await getApi()
          const service = createDeceasedService(api)
          const request = await service.getCategoryChangeRequest(requestId)
          setRequestData(request)
        } catch (error: any) {
          console.error('加载申请详情失败:', error)
          message.error(error.message || '加载申请详情失败')
        } finally {
          setLoadingRequest(false)
        }
      }
    }
    loadRequest()
  }, [mode, requestId, open])

  /**
   * 函数级详细中文注释：提交操作
   */
  const handleSubmit = async (values: any) => {
    setLoading(true)

    try {
      const api = await getApi()
      const service = createDeceasedService(api)

      let tx

      // 根据操作模式构建交易
      if (mode === 'force_set') {
        if (deceasedId === undefined) {
          throw new Error('逝者ID不能为空')
        }

        const params: ForceSetCategoryParams = {
          deceasedId,
          category: values.targetCategory,
          noteCid: values.note || undefined,
        }

        tx = service.buildForceSetCategoryTx(params)
      } else if (mode === 'approve') {
        if (requestId === undefined) {
          throw new Error('申请ID不能为空')
        }

        tx = service.buildApproveCategoryChangeTx(requestId)
      } else if (mode === 'reject') {
        if (requestId === undefined) {
          throw new Error('申请ID不能为空')
        }

        const params: ProcessCategoryChangeParams = {
          requestId,
          reasonCid: values.reason,
        }

        tx = service.buildRejectCategoryChangeTx(params)
      } else {
        throw new Error('未知的操作模式')
      }

      // 发送交易
      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            message.success('交易已提交，等待区块确认...')
          } else if (status.isFinalized) {
            let successMsg = '操作成功'
            if (mode === 'force_set') {
              successMsg = '分类修改成功'
            } else if (mode === 'approve') {
              successMsg = '申请已批准，分类修改成功'
            } else if (mode === 'reject') {
              successMsg = '申请已拒绝'
            }

            message.success(successMsg)
            form.resetFields()
            onSuccess?.()
            onClose()
          }
        }
      )
    } catch (error: any) {
      console.error('操作失败:', error)
      message.error(error.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：渲染标题
   */
  const renderTitle = () => {
    const titles = {
      force_set: {
        icon: <CrownOutlined style={{ color: '#faad14' }} />,
        text: 'Root直接修改分类',
      },
      approve: {
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        text: '批准分类修改申请',
      },
      reject: {
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        text: '拒绝分类修改申请',
      },
    }

    const config = titles[mode]

    return (
      <Space>
        {config.icon}
        <span>{config.text}</span>
      </Space>
    )
  }

  /**
   * 函数级详细中文注释：渲染申请详情卡片
   */
  const renderRequestDetails = () => {
    if (!requestData || mode === 'force_set') return null

    const getStatusTag = (status: RequestStatus) => {
      const configs: Record<RequestStatus, { color: string; text: string }> = {
        [RequestStatus.Pending]: { color: 'processing', text: '待审核' },
        [RequestStatus.Approved]: { color: 'success', text: '已批准' },
        [RequestStatus.Rejected]: { color: 'error', text: '已拒绝' },
        [RequestStatus.Expired]: { color: 'default', text: '已过期' },
      }

      const config = configs[status]
      return <Tag color={config.color}>{config.text}</Tag>
    }

    const formatBlockNumber = (blockNumber: number) => {
      const now = Date.now()
      const blockTime = 6000 // 6秒一个区块
      const estimatedTime = new Date(now + (blockNumber - now / blockTime) * blockTime)
      return `区块 ${blockNumber} (约 ${estimatedTime.toLocaleString()})`
    }

    return (
      <Card
        title="申请详情"
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="申请人">
            {requestData.applicant}
          </Descriptions.Item>
          <Descriptions.Item label="逝者ID">
            {requestData.deceasedId}
          </Descriptions.Item>
          <Descriptions.Item label="当前分类">
            <CategoryBadge category={requestData.currentCategory} />
          </Descriptions.Item>
          <Descriptions.Item label="目标分类">
            <CategoryBadge category={requestData.targetCategory} />
          </Descriptions.Item>
          <Descriptions.Item label="申请状态">
            {getStatusTag(requestData.status)}
          </Descriptions.Item>
          <Descriptions.Item label="提交时间">
            {formatBlockNumber(requestData.submittedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {formatBlockNumber(requestData.deadline)}
          </Descriptions.Item>
          <Descriptions.Item label="申请理由CID">
            <Text code copyable style={{ fontSize: 12 }}>
              {requestData.reasonCid}
            </Text>
          </Descriptions.Item>
          {requestData.evidenceCids.length > 0 && (
            <Descriptions.Item label="证据CID列表">
              <Space direction="vertical" size="small">
                {requestData.evidenceCids.map((cid, index) => (
                  <Text key={index} code copyable style={{ fontSize: 12 }}>
                    {cid}
                  </Text>
                ))}
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
    )
  }

  /**
   * 函数级详细中文注释：渲染表单内容
   */
  const renderFormContent = () => {
    if (mode === 'force_set') {
      // Root直接修改分类
      return (
        <>
          {/* 当前分类提示 */}
          {currentCategory !== undefined && (
            <Alert
              message="当前分类"
              description={
                <Space>
                  <Text>该逝者当前的分类为：</Text>
                  <CategoryBadge category={currentCategory} />
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          {/* Root权限提示 */}
          <Alert
            message="Root权限"
            description="您正在使用Root权限直接修改分类，此操作不需要审核，将立即生效。"
            type="warning"
            showIcon
            icon={<CrownOutlined />}
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            label="目标分类"
            name="targetCategory"
            rules={[{ required: true, message: '请选择目标分类' }]}
          >
            <Select placeholder="请选择目标分类" size="large">
              {Object.values(DeceasedCategory)
                .filter((value): value is DeceasedCategory => typeof value === 'number')
                .map(cat => (
                  <Option key={cat} value={cat}>
                    <Space>
                      <CategoryBadge category={cat} showIcon />
                    </Space>
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="修改备注"
            name="note"
            tooltip="可选：说明为什么进行此修改"
          >
            <TextArea
              rows={4}
              placeholder="请输入修改备注（可选）"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </>
      )
    } else if (mode === 'approve') {
      // 批准申请
      return (
        <>
          {renderRequestDetails()}

          <Alert
            message="批准操作"
            description={
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>批准后，将立即执行分类修改</li>
                <li>申请人的押金（10 DUST）将全额退还</li>
                <li>操作不可撤销</li>
              </ul>
            }
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 24 }}
          />
        </>
      )
    } else if (mode === 'reject') {
      // 拒绝申请
      return (
        <>
          {renderRequestDetails()}

          <Alert
            message="拒绝操作"
            description={
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>拒绝后，分类不会被修改</li>
                <li>申请人的押金（10 DUST）将扣除50%，剩余50%退还</li>
                <li>操作不可撤销</li>
              </ul>
            }
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            label="拒绝理由"
            name="reason"
            rules={[{ required: true, message: '请输入拒绝理由' }]}
            tooltip="说明为什么拒绝此申请"
          >
            <TextArea
              rows={4}
              placeholder="请详细说明拒绝此申请的理由..."
              maxLength={500}
              showCount
            />
          </Form.Item>
        </>
      )
    }

    return null
  }

  return (
    <Modal
      title={renderTitle()}
      open={open}
      onCancel={onClose}
      footer={null}
      width={mode === 'force_set' ? 500 : 700}
      style={{ top: 40 }}
    >
      {loadingRequest ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">加载申请详情...</Text>
          </div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          {renderFormContent()}

          <Divider />

          {/* 提交按钮 */}
          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={onClose}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                danger={mode === 'reject'}
              >
                {mode === 'force_set' && '确认修改'}
                {mode === 'approve' && '批准申请'}
                {mode === 'reject' && '拒绝申请'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}
