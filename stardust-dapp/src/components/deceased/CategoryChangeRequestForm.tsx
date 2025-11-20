/**
 * 分类修改申请表单组件（普通用户）
 *
 * 功能说明：
 * 1. 普通用户提交逝者分类修改申请
 * 2. 选择目标分类
 * 3. 上传申请理由和证据到IPFS
 * 4. 提交申请并冻结10 DUST押金
 * 5. 显示押金和截止日期信息
 *
 * 创建日期：2025-11-09
 */

import React, { useState } from 'react'
import {
  Modal,
  Form,
  Select,
  Input,
  Upload,
  Button,
  Alert,
  Space,
  Typography,
  message,
  Divider,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  InfoCircleOutlined,
  UploadOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import {
  createDeceasedService,
  DeceasedCategory,
  type SubmitCategoryChangeParams,
} from '../../services/deceasedService'
import { CategoryBadge, getCategoryLabel } from './CategoryBadge'

const { TextArea } = Input
const { Text, Title } = Typography
const { Option } = Select

interface CategoryChangeRequestFormProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 逝者ID */
  deceasedId: number
  /** 当前分类 */
  currentCategory: DeceasedCategory
  /** 当前账户地址 */
  account: string
  /** 提交成功回调 */
  onSuccess?: () => void
}

/**
 * 函数级详细中文注释：分类修改申请表单组件
 */
export const CategoryChangeRequestForm: React.FC<CategoryChangeRequestFormProps> = ({
  open,
  onClose,
  deceasedId,
  currentCategory,
  account,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [reasonFile, setReasonFile] = useState<UploadFile[]>([])
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)

  /**
   * 函数级详细中文注释：上传文件到IPFS
   */
  const uploadToIPFS = async (file: File): Promise<string> => {
    try {
      // TODO: 集成实际的IPFS上传服务
      console.log('Uploading file to IPFS:', file.name)

      // 模拟上传延迟
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 返回模拟CID
      return `Qm${Math.random().toString(36).substring(2, 15)}`
    } catch (error) {
      throw new Error('IPFS上传失败')
    }
  }

  /**
   * 函数级详细中文注释：提交申请
   */
  const handleSubmit = async (values: any) => {
    if (!reasonFile[0] || !reasonFile[0].originFileObj) {
      message.error('请上传申请理由文件')
      return
    }

    setLoading(true)
    setUploading(true)

    try {
      // 1. 上传申请理由到IPFS
      const reasonCid = await uploadToIPFS(reasonFile[0].originFileObj)
      message.success('申请理由上传成功')

      // 2. 上传证据文件到IPFS
      const evidenceCids: string[] = []
      for (const file of evidenceFiles) {
        if (file.originFileObj) {
          const cid = await uploadToIPFS(file.originFileObj)
          evidenceCids.push(cid)
          message.success(`${file.name} 上传成功`)
        }
      }

      setUploading(false)

      // 3. 构建交易
      const api = await getApi()
      const service = createDeceasedService(api)

      const params: SubmitCategoryChangeParams = {
        deceasedId,
        targetCategory: values.targetCategory,
        reasonCid,
        evidenceCids,
      }

      const tx = service.buildRequestCategoryChangeTx(params)

      // 4. 发送交易
      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status, events }) => {
          if (status.isInBlock) {
            message.success('申请已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('申请提交成功！押金已冻结，等待委员会审核')
            form.resetFields()
            setReasonFile([])
            setEvidenceFiles([])
            onSuccess?.()
            onClose()
          }
        }
      )
    } catch (error: any) {
      console.error('提交失败:', error)
      message.error(error.message || '提交失败')
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  /**
   * 函数级详细中文注释：获取可选的目标分类列表
   */
  const getTargetCategories = (): DeceasedCategory[] => {
    // 排除当前分类
    return Object.values(DeceasedCategory)
      .filter((value): value is DeceasedCategory => typeof value === 'number')
      .filter(cat => cat !== currentCategory)
  }

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <span>申请修改逝者分类</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      style={{ top: 40 }}
    >
      {/* 当前分类提示 */}
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

      {/* 申请说明 */}
      <Alert
        message="申请说明"
        description={
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>提交申请需要冻结 <Text strong>10 DUST</Text> 押金</li>
            <li>委员会将在 <Text strong>7天</Text> 内审核您的申请</li>
            <li>审核通过后，押金将全额退还</li>
            <li>审核拒绝后，将扣除50%押金作为处理费</li>
            <li>申请过期后，押金将全额退还</li>
          </ul>
        }
        type="warning"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        {/* 目标分类 */}
        <Form.Item
          label="目标分类"
          name="targetCategory"
          rules={[{ required: true, message: '请选择目标分类' }]}
          tooltip="选择您认为该逝者应该属于的分类"
        >
          <Select
            placeholder="请选择目标分类"
            size="large"
          >
            {getTargetCategories().map(cat => (
              <Option key={cat} value={cat}>
                <Space>
                  <CategoryBadge category={cat} showIcon />
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* 申请理由 */}
        <Form.Item
          label="申请理由"
          required
          tooltip="详细说明为什么需要修改分类（将上传到IPFS）"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <TextArea
              rows={4}
              placeholder="请详细描述申请修改分类的理由，例如：该逝者为抗日英雄，应归类为革命烈士..."
              maxLength={1000}
              showCount
            />
            <Upload
              accept=".txt,.pdf,.doc,.docx"
              fileList={reasonFile}
              onChange={({ fileList }) => setReasonFile(fileList.slice(-1))}
              beforeUpload={() => false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>
                上传理由文件（可选，建议上传详细文档）
              </Button>
            </Upload>
          </Space>
        </Form.Item>

        {/* 证据材料 */}
        <Form.Item
          label="证据材料"
          tooltip="上传支持您申请的证据文件（最多10个）"
        >
          <Upload
            multiple
            accept="image/*,.pdf,.doc,.docx"
            fileList={evidenceFiles}
            onChange={({ fileList }) => setEvidenceFiles(fileList)}
            beforeUpload={() => false}
            maxCount={10}
            listType="picture-card"
          >
            {evidenceFiles.length < 10 && (
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传证据</div>
              </div>
            )}
          </Upload>
          {uploading && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              正在上传到IPFS...
            </Text>
          )}
        </Form.Item>

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
              disabled={!reasonFile[0]}
            >
              {uploading ? '上传文件中...' : loading ? '提交中...' : '提交申请（冻结10 DUST）'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
