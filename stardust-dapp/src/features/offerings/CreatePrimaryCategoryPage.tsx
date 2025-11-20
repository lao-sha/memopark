import React from 'react'
import { Card, Form, Input, Button, Space, message, Alert } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：创建一级类目页面
 * - 仅输入名称，调用 memoSacrifice.createCategory(name, None)
 */
const CreatePrimaryCategoryPage: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  const onSubmit = async (v: any) => {
    setError('')
    try {
      setSubmitting(true)
      const nameBytes = Array.from(new TextEncoder().encode(String(v.name||'')))
      const hash = await signAndSendLocalFromKeystore('memoSacrifice','createCategory',[nameBytes, null])
      message.success('已提交创建一级类目：'+hash)
      form.resetFields()
    } catch (e:any) { setError(e?.message||'提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Card title="创建一级类目">
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <Form.Item name="name" label="类目名" rules={[{ required: true }]}>
              <Input placeholder="请输入一级类目名称" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>创建</Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default CreatePrimaryCategoryPage


