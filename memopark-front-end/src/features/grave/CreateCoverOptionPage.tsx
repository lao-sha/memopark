import React from 'react'
import { Card, Form, Input, Button, Space, Upload, message, Alert, Typography } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { uploadToIpfs } from '../../lib/ipfs'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：创建封面图（公共封面库）页面
 * - 先上传图片到 IPFS，拿到 CID；
 * - 调用 memoGrave.addCoverOption(cidBytes) 由治理/签名账户新增目录项（开发网可直签）
 */
const CreateCoverOptionPage: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  const onUpload = async (file: File) => {
    try {
      const cid = await uploadToIpfs(file)
      form.setFieldsValue({ cid })
      message.success('已上传 IPFS：'+cid)
    } catch (e:any) { message.error(e?.message||'上传失败') }
    return false
  }

  const onSubmit = async (v:any) => {
    setError('')
    try {
      setSubmitting(true)
      const cid = String(v.cid||'').trim()
      if (!cid) { message.warning('请填写或上传得到 CID'); setSubmitting(false); return }
      const bytes = Array.from(new TextEncoder().encode(cid))
      const section = 'memoGrave'
      const hash = await signAndSendLocalFromKeystore(section, 'addCoverOption', [bytes])
      message.success('已提交新增封面：'+hash)
      form.resetFields()
    } catch (e:any) { setError(e?.message||'提交失败') } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Card title="创建封面图（公共封面库）">
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert type="info" showIcon message="目录由内容委员会维护：新增/下架需内容委员会审批。确保 CID 不加密。" />
          <Typography.Paragraph type="secondary">上传图片到 IPFS 获得 CID 后，提交到链上的公共封面库。此目录由治理维护，所有墓地可复用。</Typography.Paragraph>
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <Form.Item name="cid" label="IPFS CID" rules={[{ required: true }]}>
              <Input placeholder="例如：bafy..." />
            </Form.Item>
            <Upload beforeUpload={onUpload} maxCount={1} accept="image/*">
              <Button icon={<UploadOutlined />}>上传图片到 IPFS 并填充 CID</Button>
            </Upload>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>提交</Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default CreateCoverOptionPage


