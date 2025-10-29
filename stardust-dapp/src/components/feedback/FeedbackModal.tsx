import React, { useState } from 'react'
import { Modal, Form, Input, Rate, Select, Button, message, Typography } from 'antd'
import { SmileOutlined, MehOutlined, FrownOutlined } from '@ant-design/icons'

const { TextArea } = Input
const { Text } = Typography

/**
 * 函数级详细中文注释：用户反馈收集模态框组件
 * 
 * 功能：
 * - 收集用户对会员购买流程的反馈
 * - 评分：整体满意度（1-5星）
 * - 反馈类型：功能建议、Bug反馈、体验改进等
 * - 详细内容：文本描述
 * - 数据存储：本地 localStorage + 可扩展到服务器
 */
interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
  context?: string // 反馈上下文：如 'membership_purchase', 'referral_code', etc.
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose, context = 'general' }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  /**
   * 函数级中文注释：提交反馈
   * - 保存到 localStorage
   * - 后续可扩展到服务器端
   */
  const onSubmit = async (values: any) => {
    try {
      setLoading(true)

      // 构建反馈数据
      const feedback = {
        ...values,
        context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      // 保存到 localStorage
      const feedbacks = JSON.parse(localStorage.getItem('mp_feedbacks') || '[]')
      feedbacks.push(feedback)
      
      // 只保留最近100条反馈
      if (feedbacks.length > 100) {
        feedbacks.splice(0, feedbacks.length - 100)
      }
      
      localStorage.setItem('mp_feedbacks', JSON.stringify(feedbacks))

      // TODO: 发送到服务器
      // await api.post('/api/feedback', feedback)

      message.success('感谢您的反馈！')
      form.resetFields()
      onClose()

    } catch (e: any) {
      console.error('提交反馈失败', e)
      message.error('提交失败：' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="📝 用户反馈"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          type: 'suggestion'
        }}
      >
        <Form.Item
          label="整体满意度"
          name="rating"
          rules={[{ required: true, message: '请评分' }]}
        >
          <Rate />
        </Form.Item>

        <Form.Item
          label="反馈类型"
          name="type"
          rules={[{ required: true, message: '请选择反馈类型' }]}
        >
          <Select
            options={[
              { value: 'suggestion', label: '💡 功能建议' },
              { value: 'bug', label: '🐛 Bug反馈' },
              { value: 'experience', label: '✨ 体验改进' },
              { value: 'price', label: '💰 价格反馈' },
              { value: 'other', label: '📌 其他' }
            ]}
          />
        </Form.Item>

        <Form.Item
          label="详细描述"
          name="content"
          rules={[
            { required: true, message: '请填写详细描述' },
            { min: 10, message: '请至少输入10个字符' }
          ]}
        >
          <TextArea
            rows={6}
            placeholder="请详细描述您的反馈，包括遇到的问题、建议的改进方向等..."
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item label="联系方式（选填）" name="contact">
          <Input placeholder="邮箱或其他联系方式（方便我们跟进）" />
        </Form.Item>

        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button onClick={onClose}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交反馈
            </Button>
          </div>
        </Form.Item>

        <Text type="secondary" style={{ fontSize: '12px' }}>
          💡 提示：您的反馈将帮助我们改进产品，感谢您的支持！
        </Text>
      </Form>
    </Modal>
  )
}

export default FeedbackModal

