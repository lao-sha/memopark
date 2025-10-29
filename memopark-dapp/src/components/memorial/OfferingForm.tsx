/**
 * 自定义供奉表单组件
 * 
 * 功能说明：
 * 1. 支持完全自定义的供奉创建
 * 2. 可选择供奉类型（Instant/Timed）
 * 3. 支持上传媒体文件（图片/视频）
 * 4. 自定义供奉金额和持续时长
 * 5. 集成IPFS上传
 * 
 * 创建日期：2025-10-28
 */

import React, { useState } from 'react'
import { 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  Button, 
  Upload, 
  Space, 
  Typography, 
  Alert,
  message,
  Card,
} from 'antd'
import { 
  GiftOutlined, 
  UploadOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createMemorialService, 
  type MediaItem,
} from '../../services/memorialService'

const { Text, Title } = Typography
const { TextArea } = Input

interface OfferingFormProps {
  /** 当前账户地址 */
  account: string
  /** 默认目标（域代码，对象ID） */
  defaultTarget?: [number, number]
  /** 提交成功回调 */
  onSuccess?: () => void
  /** 是否显示为卡片 */
  showAsCard?: boolean
}

/**
 * 函数级详细中文注释：自定义供奉表单组件
 */
export const OfferingForm: React.FC<OfferingFormProps> = ({ 
  account,
  defaultTarget,
  onSuccess,
  showAsCard = true,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)

  /**
   * 函数级详细中文注释：处理IPFS上传
   */
  const handleUploadToIPFS = async (file: File): Promise<string> => {
    try {
      // TODO: 集成实际的IPFS上传服务
      // 这里使用占位实现
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
   * 函数级详细中文注释：提交供奉
   */
  const handleSubmit = async (values: any) => {
    setLoading(true)
    setUploading(true)
    
    try {
      // 1. 上传媒体文件到IPFS
      const media: MediaItem[] = []
      for (const file of fileList) {
        if (file.originFileObj) {
          const cid = await handleUploadToIPFS(file.originFileObj)
          media.push({ cid })
          message.success(`${file.name} 上传成功`)
        }
      }

      setUploading(false)

      // 2. 构建交易
      const api = await getApi()
      const service = createMemorialService(api)
      
      // 转换金额（DUST -> 最小单位）
      const amount = (BigInt(values.amount) * BigInt(1_000_000)).toString()
      
      const tx = service.buildOfferTx({
        target: values.target,
        kindCode: values.kindCode,
        amount,
        media,
        duration: values.duration || null,
      })

      // 3. 发送交易
      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(account)

      await tx.signAndSend(
        account,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isInBlock) {
            message.success('供奉已提交，等待区块确认...')
          } else if (status.isFinalized) {
            message.success('供奉成功！')
            form.resetFields()
            setFileList([])
            onSuccess?.()
          }
        }
      )
    } catch (error: any) {
      console.error('供奉失败:', error)
      message.error(error.message || '供奉失败')
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  /**
   * 函数级详细中文注释：渲染表单内容
   */
  const renderFormContent = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        target: defaultTarget || [1, 0],
        kindCode: 0,
        amount: '0.001',
      }}
      autoComplete="off"
    >
      <Alert
        message="自定义供奉"
        description="您可以完全自定义供奉的金额、类型和媒体内容。建议优先使用「快速下单」功能享受智能定价和VIP折扣。"
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 目标选择 */}
      <Form.Item
        label="供奉目标"
        name="target"
        rules={[{ required: true, message: '请选择供奉目标' }]}
        tooltip="选择要供奉的对象（域代码，对象ID）"
      >
        <Space>
          <InputNumber placeholder="域代码" style={{ width: 120 }} />
          <InputNumber placeholder="对象ID" style={{ width: 200 }} />
        </Space>
      </Form.Item>

      {/* 供奉类型代码 */}
      <Form.Item
        label="供奉类型代码"
        name="kindCode"
        rules={[{ required: true, message: '请输入供奉类型代码' }]}
        tooltip="供奉类型的唯一标识，由管理员预先配置"
      >
        <InputNumber 
          min={0} 
          style={{ width: '100%' }}
          placeholder="0"
        />
      </Form.Item>

      {/* 供奉金额 */}
      <Form.Item
        label="供奉金额（MEMO）"
        name="amount"
        rules={[
          { required: true, message: '请输入供奉金额' },
          { 
            pattern: /^\d+(\.\d{1,6})?$/, 
            message: '请输入有效的金额（最多6位小数）' 
          },
        ]}
        tooltip="供奉的MEMO数量"
      >
        <Input
          addonBefore="DUST"
          placeholder="0.001"
        />
      </Form.Item>

      {/* 持续时长（可选） */}
      <Form.Item
        label="持续时长（周数）"
        name="duration"
        tooltip="可选：供奉的持续时长（按周计算）"
      >
        <InputNumber
          min={1}
          max={52}
          style={{ width: '100%' }}
          placeholder="留空表示永久供奉"
          addonAfter="周"
        />
      </Form.Item>

      {/* 媒体上传 */}
      <Form.Item
        label="供奉媒体"
        tooltip="可选：上传图片或视频（最多8个文件）"
      >
        <Upload
          multiple
          accept="image/*,video/*"
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          beforeUpload={() => false}
          maxCount={8}
          listType="picture-card"
        >
          {fileList.length < 8 && (
            <div>
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>上传</div>
            </div>
          )}
        </Upload>
        {uploading && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            正在上传到IPFS...
          </Text>
        )}
      </Form.Item>

      {/* 提交按钮 */}
      <Form.Item>
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loading}
          icon={<GiftOutlined />}
          size="large"
          block
        >
          {uploading ? '上传媒体中...' : loading ? '发送中...' : '确认供奉'}
        </Button>
      </Form.Item>
    </Form>
  )

  if (showAsCard) {
    return (
      <Card
        title={
          <Space>
            <GiftOutlined />
            <span>自定义供奉</span>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        {renderFormContent()}
      </Card>
    )
  }

  return renderFormContent()
}

