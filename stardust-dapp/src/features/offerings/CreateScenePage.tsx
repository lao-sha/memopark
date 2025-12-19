import React from 'react'
import { Card, Form, Input, InputNumber, Button, Space, Switch, message, Alert, Typography } from 'antd'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：创建场景页面
 * - 对接 memoSacrifice.createScene(name, desc?, domain?)
 * - 场景用于目录筛选/展示，不影响资金路径
 */
const CreateScenePage: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  const onSubmit = async (v: any) => {
    setError('')
    try {
      setSubmitting(true)
      const nameBytes = Array.from(new TextEncoder().encode(String(v.name||'')))
      const descBytes = v.desc? Array.from(new TextEncoder().encode(String(v.desc))) : null
      const domainOpt = v.domain===''||v.domain==null? null : Number(v.domain)
      const hash = await signAndSendLocalFromKeystore('memoSacrifice','createScene',[nameBytes, descBytes, domainOpt])
      message.success('已提交创建场景：'+hash)
      form.resetFields()
    } catch (e:any) { setError(e?.message||'提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Card title="创建场景">
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Paragraph type="secondary">可选填写 domain（例如 1=纪念馆，3=宠物），仅用于前端筛选。</Typography.Paragraph>
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <Form.Item name="name" label="场景名称" rules={[{ required: true }]}>
              <Input placeholder="如：清明、周年、满月等" />
            </Form.Item>
            <Form.Item name="desc" label="描述（可空）">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="domain" label="域编码（可空）">
              <InputNumber min={0} style={{ width: '100%' }} />
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

export default CreateScenePage


