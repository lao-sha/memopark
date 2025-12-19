import React from 'react'
import { Card, Form, Input, InputNumber, Switch, Button, Space, Upload, Typography, message, Alert } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { uploadToIpfs } from '../../lib/ipfs'
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：创建祭祀品页面
 * - 普通用户：提交上架请求 `memoSacrifice.requestListSacrifice`
 * - 管理员：直接创建 `memoSacrifice.createSacrifice`
 * - 字段：name/resource_url/description/is_vip_exclusive/fixed_price/unit_price_per_week/category_id/scene_id
 */
const CreateSacrificePage: React.FC = () => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = React.useState(false)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(()=> {
    // 简易管理员检测：尝试读取链上某管理常量或留空；此处默认非管理员，由用户手动切换
    setIsAdmin(false)
  }, [])

  const onUpload = async (file: File) => {
    try {
      const cid = await uploadToIpfs(file)
      form.setFieldsValue({ resource_url: `ipfs://${cid}` })
      message.success('已上传 IPFS：'+cid)
    } catch (e:any) { message.error(e?.message || '上传失败') }
    return false
  }

  const toBytes = (s?: string) => Array.from(new TextEncoder().encode(String(s || '')))

  const onSubmit = async (v: any) => {
    setError('')
    try {
      setSubmitting(true)
      const section = 'memoSacrifice'
      const name = toBytes(v.name)
      const url = toBytes(v.resource_url)
      const desc = toBytes(v.description)
      const isVip = Boolean(v.is_vip_exclusive)
      const fp = v.fixed_price===''||v.fixed_price==null? null : BigInt(v.fixed_price)
      const upw = v.unit_price_per_week===''||v.unit_price_per_week==null? null : BigInt(v.unit_price_per_week)
      const cat = v.category_id===''||v.category_id==null? null : Number(v.category_id)
      const scene = v.scene_id===''||v.scene_id==null? null : Number(v.scene_id)
      if (!fp && !upw) { message.warning('fixed_price 或 unit_price_per_week 至少填一项'); setSubmitting(false); return }
      if (isAdmin) {
        const api = await getApi()
        const creator = (api?.tx as any)?.memoSacrifice ? null : null // 直接由 Runtime Admin 执行，creator_id 参数需要提供账户
        const creatorId = '0x0000000000000000000000000000000000000000000000000000000000000000'
        const hash = await signAndSendLocalFromKeystore(section, 'createSacrifice', [name, url, desc, isVip, fp, upw, cat, scene, creatorId])
        message.success('已创建（Admin）：'+hash)
      } else {
        const exclusive: Array<[number, number]> = []
        const hash = await signAndSendLocalFromKeystore(section, 'requestListSacrifice', [name, url, desc, isVip, fp, upw, cat, scene, exclusive])
        message.success('已提交上架请求：'+hash)
      }
      form.resetFields()
    } catch (e:any) {
      setError(e?.message || '提交失败')
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 12 }}>
      <Card title="创建祭祀品">
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Typography.Text type="secondary">管理员直建</Typography.Text>
            <Switch checked={isAdmin} onChange={setIsAdmin} style={{ marginLeft: 8 }} />
          </div>
          <Form form={form} layout="vertical" onFinish={onSubmit}>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="鲜花/香烛/供品等" />
            </Form.Item>
            <Form.Item name="resource_url" label="资源URL">
              <Input placeholder="ipfs://CID 或 https://..." />
            </Form.Item>
            <Upload beforeUpload={onUpload} maxCount={1} accept="image/*">
              <Button icon={<UploadOutlined />}>上传图片到 IPFS 并填充 URL</Button>
            </Upload>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={3} placeholder="简要描述" />
            </Form.Item>
            <Form.Item name="is_vip_exclusive" label="仅VIP可购" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="fixed_price" label="一次性价格（u128，可空）">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit_price_per_week" label="按周单价（u128，可空）">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="category_id" label="类目ID（可空）">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="scene_id" label="场景ID（可空）">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>提交</Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default CreateSacrificePage


