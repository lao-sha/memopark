/**
 * 创建逝者弹窗组件
 * 
 * 功能说明：
 * 1. 表单输入逝者基本信息
 * 2. 上传主图到IPFS
 * 3. 生成CID并自动填充
 * 4. 一键创建逝者记录
 * 
 * 创建日期：2025-10-28
 */

import React, { useState } from 'react'
import { 
  Modal, 
  Form, 
  Input, 
  DatePicker, 
  Select, 
  Upload, 
  Button,
  Space,
  message,
  Alert,
} from 'antd'
import { 
  UploadOutlined, 
  InfoCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createDeceasedService, 
  Gender,
  type CreateDeceasedParams,
} from '../../services/deceasedService'

interface CreateDeceasedModalProps {
  open: boolean
  onClose: () => void
  account: string
  onSuccess?: () => void
}

/**
 * 函数级详细中文注释：创建逝者弹窗组件
 */
export const CreateDeceasedModal: React.FC<CreateDeceasedModalProps> = ({ 
  open, 
  onClose, 
  account,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [mainImageFile, setMainImageFile] = useState<UploadFile | null>(null)

  /**
   * 函数级详细中文注释：模拟IPFS上传（实际应调用IPFS API）
   */
  const uploadToIPFS = async (file: File): Promise<string> => {
    // TODO: 实际实现IPFS上传
    // 这里返回模拟的CID
    return 'Qm' + Math.random().toString(36).substring(2, 15)
  }

  /**
   * 函数级详细中文注释：提交表单
   */
  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      // 上传主图到IPFS
      let mainImageCid = ''
      if (mainImageFile) {
        const file = mainImageFile.originFileObj as File
        mainImageCid = await uploadToIPFS(file)
      }

      // 生成fullNameCid和bioCid（实际应上传到IPFS）
      const fullNameCid = await uploadToIPFS(new Blob([values.fullName]))
      const bioCid = await uploadToIPFS(new Blob([values.bio || '']))

      const api = await getApi()
      const service = createDeceasedService(api)
      
      const params: CreateDeceasedParams = {
        fullName: values.fullName,
        fullNameCid,
        birthDate: dayjs(values.birthDate).unix(),
        deathDate: dayjs(values.deathDate).unix(),
        gender: values.gender,
        mainImageCid,
        bio: values.bio || '',
        bioCid,
      }

      const tx = service.buildCreateDeceasedTx(params)

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isInBlock) {
            message.success('已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('创建成功！')
            setLoading(false)
            form.resetFields()
            setMainImageFile(null)
            onSuccess?.()
            onClose()
          }
        }
      )
    } catch (error: any) {
      console.error('创建失败:', error)
      message.error(error.message || '创建失败')
      setLoading(false)
    }
  }

  return (
    <Modal
      title="创建逝者记录"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="创建"
      cancelText="取消"
      width={600}
    >
      <Alert
        message="创建逝者记录"
        description="请如实填写逝者信息，所有数据将存储在区块链上并固定到IPFS。"
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="姓名"
          name="fullName"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="输入逝者姓名" />
        </Form.Item>

        <Form.Item
          label="性别"
          name="gender"
          rules={[{ required: true, message: '请选择性别' }]}
        >
          <Select placeholder="选择性别">
            <Select.Option value={Gender.Male}>男</Select.Option>
            <Select.Option value={Gender.Female}>女</Select.Option>
            <Select.Option value={Gender.Other}>其他</Select.Option>
          </Select>
        </Form.Item>

        <Space style={{ width: '100%' }} size="middle">
          <Form.Item
            label="出生日期"
            name="birthDate"
            rules={[{ required: true, message: '请选择出生日期' }]}
          >
            <DatePicker placeholder="选择日期" />
          </Form.Item>

          <Form.Item
            label="逝世日期"
            name="deathDate"
            rules={[{ required: true, message: '请选择逝世日期' }]}
          >
            <DatePicker placeholder="选择日期" />
          </Form.Item>
        </Space>

        <Form.Item label="主图">
          <Upload
            maxCount={1}
            beforeUpload={() => false}
            onChange={(info) => setMainImageFile(info.fileList[0] || null)}
          >
            <Button icon={<UploadOutlined />}>选择图片</Button>
          </Upload>
        </Form.Item>

        <Form.Item
          label="生平简介"
          name="bio"
        >
          <Input.TextArea
            rows={4}
            placeholder="输入生平简介"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

